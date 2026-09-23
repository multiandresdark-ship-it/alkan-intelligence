BEGIN;
DO $test$
DECLARE lead_high uuid; lead_low uuid; lead_other uuid; other_case uuid; c jsonb; r jsonb; first_case uuid; stamp timestamptz; n bigint;
BEGIN
 INSERT INTO public.financing_partner_boxes(client_id,partner_id,partner_name) VALUES('alkan','qa-v3','QA partner'),('qa-v3-other','qa-v3','QA other');
 INSERT INTO public.leads(client_id,company) VALUES('alkan','QA v3 high') RETURNING id INTO lead_high;
 INSERT INTO public.leads(client_id,company) VALUES('alkan','QA v3 low') RETURNING id INTO lead_low;
 INSERT INTO public.leads(client_id,company) VALUES('qa-v3-other','QA v3 isolated') RETURNING id INTO lead_other;
 INSERT INTO public.financing_cases(client_id,lead_id) VALUES('qa-v3-other',lead_other) RETURNING id INTO other_case;
 PERFORM set_config('alkan.test_other_case',other_case::text,true);
 c=jsonb_build_object('client_id','alkan','lead_id',lead_high,'partner_id','qa-v3','company_name','QA v3 high','activity_score',90,'timing_score',90,'partner_fit_score',90,'evidence_score',90,'contactability_score',90,'priority_score',90,'reasons',jsonb_build_array('QA source activity'),'signals',jsonb_build_array(jsonb_build_object('signal_type','PERMIT_BURST','source_urls',jsonb_build_array('https://example.invalid/qa'),'observed_at',now()-interval '1 day','expires_at',now()+interval '10 days')),'unknowns',jsonb_build_array('Confirm deposits'),'verification_flags','[]'::jsonb,'observed_at',now()-interval '1 day','expires_at',now()+interval '10 days','next_action','Qualification call');
 r=public.ingest_financing_candidate(c);first_case=(r->>'case_id')::uuid;
 IF r->>'financing_case'<>'created' THEN RAISE EXCEPTION 'High priority did not create shell'; END IF;
 IF EXISTS(SELECT 1 FROM public.financing_cases WHERE id=first_case AND (amount_requested IS NOT NULL OR use_of_funds IS NOT NULL OR monthly_deposits IS NOT NULL OR current_debt IS NOT NULL OR bankruptcy_status IS NOT NULL OR nsf_status IS NOT NULL OR documents_ready IS NOT NULL OR funded_amount IS NOT NULL)) THEN RAISE EXCEPTION 'Invented borrower facts'; END IF;
 r=public.ingest_financing_candidate(c);
 IF r->>'financing_case'<>'already_exists' OR (SELECT count(*) FROM public.financing_cases WHERE client_id='alkan' AND lead_id=lead_high)<>1 THEN RAISE EXCEPTION 'Duplicate case'; END IF;
 r=public.ingest_financing_candidate(c||jsonb_build_object('observed_at',now()-interval '2 days'));
 IF r->>'status'<>'stale' THEN RAISE EXCEPTION 'Stale candidate overwritten'; END IF;
 r=public.ingest_financing_candidate(c||jsonb_build_object('lead_id',lead_low,'priority_score',40));
 IF r->>'financing_case'<>'not_created' THEN RAISE EXCEPTION 'Low priority created shell'; END IF;
 r=public.ingest_financing_candidate(c||jsonb_build_object('lead_id',lead_low,'priority_score',90,'observed_at',now()-interval '1 day','expires_at',now()-interval '1 hour'));
 IF r->>'financing_case'<>'not_created' THEN RAISE EXCEPTION 'Expired candidate created shell'; END IF;
 UPDATE public.financing_candidates SET status='dismissed' WHERE lead_id=lead_low;
 r=public.ingest_financing_candidate(c||jsonb_build_object('lead_id',lead_low));
 IF r->>'financing_case'<>'not_created' THEN RAISE EXCEPTION 'Dismissed candidate created shell'; END IF;
 BEGIN PERFORM public.ingest_financing_candidate(c||jsonb_build_object('lead_id',lead_other));RAISE EXCEPTION 'Expected workspace rejection';EXCEPTION WHEN raise_exception THEN IF SQLERRM='Expected workspace rejection' THEN RAISE; END IF;END;
 BEGIN PERFORM public.ingest_financing_candidate(c||'{"monthly_deposits":5000}');RAISE EXCEPTION 'Expected borrower-field rejection';EXCEPTION WHEN raise_exception THEN IF SQLERRM='Expected borrower-field rejection' THEN RAISE; END IF;END;
 BEGIN UPDATE public.financing_cases SET stage='qualified' WHERE id=first_case;RAISE EXCEPTION 'Qualified facts not enforced';EXCEPTION WHEN check_violation THEN NULL;END;
 UPDATE public.financing_cases SET amount_requested=5000,use_of_funds='QA fixture only',stage='qualified' WHERE id=first_case;
 BEGIN UPDATE public.financing_cases SET stage='ready_to_submit' WHERE id=first_case;RAISE EXCEPTION 'Review completeness not enforced';EXCEPTION WHEN check_violation THEN NULL;END;
 UPDATE public.financing_cases SET monthly_deposits=0,current_debt='None - QA',bankruptcy_status='No - QA',nsf_status='No - QA',receivables_contracts='None - QA',funding_urgency='QA',documents_ready=true,stage='ready_to_submit' WHERE id=first_case;
 BEGIN UPDATE public.financing_cases SET stage='submitted' WHERE id=first_case;RAISE EXCEPTION 'Partner note not enforced';EXCEPTION WHEN check_violation THEN NULL;END;
 UPDATE public.financing_cases SET stage='submitted',partner_notes='QA recorded decision' WHERE id=first_case;
 UPDATE public.financing_cases SET stage='approved' WHERE id=first_case;
 BEGIN UPDATE public.financing_cases SET stage='funded' WHERE id=first_case;RAISE EXCEPTION 'Funded amount not enforced';EXCEPTION WHEN check_violation THEN NULL;END;
 UPDATE public.financing_cases SET stage='funded',funded_amount=4000 WHERE id=first_case;
 SELECT funded_at INTO stamp FROM public.financing_cases WHERE id=first_case;
 UPDATE public.financing_cases SET partner_notes='QA note edited' WHERE id=first_case;
 IF (SELECT funded_at FROM public.financing_cases WHERE id=first_case) IS DISTINCT FROM stamp THEN RAISE EXCEPTION 'Milestone overwritten'; END IF;
 SELECT count(*) INTO n FROM public.financing_partner_feedback WHERE case_id=first_case;
 IF n<>3 THEN RAISE EXCEPTION 'Expected three outcomes, got %',n; END IF;
 IF has_function_privilege('authenticated','public.ingest_financing_candidate(jsonb)','EXECUTE') OR has_function_privilege('anon','public.ingest_financing_candidate(jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Motor RPC exposed'; END IF;
END $test$;
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',(select user_id from public.client_profiles where client_id='alkan' limit 1),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $test$
BEGIN
 IF EXISTS(SELECT 1 FROM public.financing_cases WHERE client_id='qa-v3-other') OR EXISTS(SELECT 1 FROM public.financing_partner_boxes WHERE client_id='qa-v3-other') THEN RAISE EXCEPTION 'Cross-client read leaked'; END IF;
 BEGIN INSERT INTO public.financing_partner_feedback(client_id,case_id,partner_id,decision) VALUES('alkan',current_setting('alkan.test_other_case')::uuid,'qa-v3','reviewed');RAISE EXCEPTION 'Cross-client feedback accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.ingest_financing_candidate('{}');RAISE EXCEPTION 'Browser invoked motor ingestion';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $test$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $test$ BEGIN
 BEGIN PERFORM 1 FROM public.financing_cases;RAISE EXCEPTION 'Anonymous case read accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $test$;
RESET ROLE;
ROLLBACK;
