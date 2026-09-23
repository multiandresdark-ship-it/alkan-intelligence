-- Integration assertions; all fixtures are rolled back.
begin;
do $test$
declare a jsonb; b jsonb; lid uuid; other_id uuid; r jsonb; before_cases bigint;
begin
 if has_function_privilege('authenticated','public.ingest_apify_record(text,text,text,integer,timestamptz,jsonb)','EXECUTE') or has_function_privilege('anon','public.ingest_apify_record(text,text,text,integer,timestamptz,jsonb)','EXECUTE') then raise exception 'RPC leaked'; end if;
 select count(*) into before_cases from public.financing_cases;
 r=jsonb_build_object('identity','permit:seattle:QA-ROLLBACK-APIFY','name','Permit QA-ROLLBACK-APIFY','permit_number','QA-ROLLBACK-APIFY','jurisdiction','seattle','evidence',jsonb_build_object('review_status','unverified'));
 a=public.ingest_apify_record('alkan','mbyWbXzahJnDWasbB','testApifyRollback0001',0,'2026-09-03',r);
 if a->>'result'<>'inserted' then raise exception 'Insert failed %',a; end if;
 lid=(a->>'lead_id')::uuid;
 update public.leads set enrichment_data=enrichment_data||'{"existing":{"keep":true},"capital_score":73}'::jsonb,phone='preserved-test' where id=lid;
 b=public.ingest_apify_record('alkan','mbyWbXzahJnDWasbB','testApifyRollback0001',0,'2026-09-03',r);
 if b->>'result'<>'already_imported' then raise exception 'Retry duplicated'; end if;
 b=public.ingest_apify_record('alkan','mbyWbXzahJnDWasbB','testApifyRollback0002',0,'2026-09-02',r);
 if b->>'result'<>'stale' then raise exception 'Stale date overwritten'; end if;
 b=public.ingest_apify_record('alkan','mbyWbXzahJnDWasbB','testApifyRollback0003',0,'2026-09-04',r);
 if b->>'result'<>'updated' or b->>'lead_id'<>lid::text then raise exception 'Cross-run duplicate'; end if;
 if not exists(select 1 from public.leads where id=lid and phone='preserved-test' and enrichment_data->'existing'->>'keep'='true' and enrichment_data->>'capital_score'='73') then raise exception 'Metadata corrupted'; end if;
 insert into public.leads(client_id,company) values('apify-rollback-other','QA Different Client') returning id into other_id;
 r=jsonb_build_object('identity','digital:qa-other','company','QA Different Client','lead_id',other_id,'evidence','{}'::jsonb);
 b=public.ingest_apify_record('alkan','ARWSQq6yrTyaMbDND','testApifyRollback0004',0,null,r);
 if b->>'result'<>'unmatched' then raise exception 'Cross tenant import'; end if;
 if (select count(*) from public.financing_cases)<>before_cases then raise exception 'Financial cases changed'; end if;
end $test$;
rollback;

