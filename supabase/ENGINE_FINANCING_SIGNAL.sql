-- Motor-only ingestion. Never call this from the browser.
CREATE TABLE private.financing_signal_events (
 event_id uuid PRIMARY KEY,
 lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
 client_id text NOT NULL,
 signal jsonb NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.financing_signal_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.financing_signal_events FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT SELECT,INSERT ON private.financing_signal_events TO service_role;
CREATE INDEX financing_signal_events_lead_idx ON private.financing_signal_events(lead_id);
CREATE FUNCTION public.ingest_financing_signal(p_event_id uuid,p_lead_id uuid,p_client_id text,p_signal jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE prior private.financing_signal_events%ROWTYPE; lead_record public.leads%ROWTYPE; k text; v jsonb; observed timestamptz; current_observed timestamptz;
BEGIN
 IF p_event_id IS NULL OR p_lead_id IS NULL OR p_client_id IS NULL OR length(trim(p_client_id))=0 OR jsonb_typeof(p_signal) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid event'; END IF;
 IF NOT p_signal ?& ARRAY['ruta','fit','need','risk','confianza','motivo','ganchos','valor_obra_12m','observed_at','sources'] THEN RAISE EXCEPTION 'Incomplete signal contract'; END IF;
 FOR k IN SELECT jsonb_object_keys(p_signal) LOOP
  IF NOT k=ANY(ARRAY['ruta','fit','need','risk','confianza','motivo','ganchos','valor_obra_12m','observed_at','sources']) THEN RAISE EXCEPTION 'Unexpected signal field'; END IF;
 END LOOP;
 IF coalesce(p_signal->>'ruta','') NOT IN ('TIER_S_FINANCIAMIENTO','TIER_A_BLINDAJE','TIER_B','NURTURE','DESCARTE') OR coalesce(p_signal->>'confianza','') NOT IN ('low','medium','high') THEN RAISE EXCEPTION 'Invalid route or confidence'; END IF;
 FOREACH k IN ARRAY ARRAY['fit','need','risk','valor_obra_12m'] LOOP
  IF p_signal->k <> 'null'::jsonb THEN
   IF jsonb_typeof(p_signal->k)<>'number' THEN RAISE EXCEPTION 'Invalid numeric signal'; END IF;
   IF (p_signal->>k)::numeric<0 OR (k<>'valor_obra_12m' AND (p_signal->>k)::numeric>100) THEN RAISE EXCEPTION 'Signal out of range'; END IF;
  END IF;
 END LOOP;
 IF jsonb_typeof(p_signal->'motivo') IS DISTINCT FROM 'string' OR length(trim(p_signal->>'motivo')) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Reason required'; END IF;
 IF jsonb_typeof(p_signal->'ganchos') IS DISTINCT FROM 'array' OR jsonb_typeof(p_signal->'sources') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Reasons and sources must be arrays'; END IF;
 IF jsonb_array_length(p_signal->'ganchos') NOT BETWEEN 1 AND 3 OR jsonb_array_length(p_signal->'sources') NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Reasons and sources required'; END IF;
 FOR v IN SELECT value FROM jsonb_array_elements(p_signal->'ganchos') LOOP
  IF jsonb_typeof(v) IS DISTINCT FROM 'string' OR length(trim(v#>>'{}')) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Invalid evidence reason'; END IF;
 END LOOP;
 FOR v IN SELECT value FROM jsonb_array_elements(p_signal->'sources') LOOP
  IF jsonb_typeof(v) IS DISTINCT FROM 'string' OR (v#>>'{}') !~ '^https://[^/@[:space:]]+([/?#]|$)' THEN RAISE EXCEPTION 'HTTPS source URL required'; END IF;
 END LOOP;
 IF jsonb_typeof(p_signal->'observed_at') IS DISTINCT FROM 'string' OR (p_signal->>'observed_at') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' THEN RAISE EXCEPTION 'Zoned observation timestamp required'; END IF;
 observed=(p_signal->>'observed_at')::timestamptz;
 SELECT * INTO lead_record FROM public.leads WHERE id=p_lead_id AND client_id=p_client_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lead does not belong to this workspace'; END IF;
 SELECT * INTO prior FROM private.financing_signal_events WHERE event_id=p_event_id;
 IF FOUND THEN
  IF prior.lead_id<>p_lead_id OR prior.client_id<>p_client_id OR prior.signal<>p_signal THEN RAISE EXCEPTION 'Event ID reused with different content'; END IF;
  RETURN jsonb_build_object('status','already_applied');
 END IF;
 BEGIN current_observed=(lead_record.enrichment_data->'capital'->>'observed_at')::timestamptz; EXCEPTION WHEN OTHERS THEN current_observed=NULL; END;
 IF current_observed IS NOT NULL AND observed<current_observed THEN RAISE EXCEPTION 'Stale signal rejected'; END IF;
 INSERT INTO private.financing_signal_events(event_id,lead_id,client_id,signal) VALUES(p_event_id,p_lead_id,p_client_id,p_signal);
 UPDATE public.leads SET enrichment_data=coalesce(enrichment_data,'{}'::jsonb)||jsonb_build_object('capital',p_signal),updated_at=now() WHERE id=p_lead_id AND client_id=p_client_id;
 RETURN jsonb_build_object('status','applied');
END; $$;
REVOKE ALL ON FUNCTION public.ingest_financing_signal(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_financing_signal(uuid,uuid,text,jsonb) TO service_role;
