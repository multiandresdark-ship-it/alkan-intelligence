-- ALKAN Financing Origination v3
-- Evidence-first sourcing layer in front of financing_cases.
-- Public signals prioritize outreach; confirmed borrower facts remain in financing_cases.

CREATE TABLE IF NOT EXISTS public.financing_partner_boxes (
  partner_id text NOT NULL,
  client_id text NOT NULL DEFAULT public.get_my_client_id(),
  partner_name text NOT NULL,
  min_years_in_business numeric,
  min_requested_amount numeric,
  max_requested_amount numeric,
  allowed_states text[] NOT NULL DEFAULT '{}',
  allowed_industries text[] NOT NULL DEFAULT '{}',
  required_documents text[] NOT NULL DEFAULT '{}',
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, partner_id)
  ,CHECK(min_years_in_business IS NULL OR min_years_in_business>=0)
  ,CHECK(min_requested_amount IS NULL OR min_requested_amount>=0)
  ,CHECK(max_requested_amount IS NULL OR max_requested_amount>0)
  ,CHECK(min_requested_amount IS NULL OR max_requested_amount IS NULL OR min_requested_amount<=max_requested_amount)
);

CREATE TABLE IF NOT EXISTS public.financing_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  partner_id text NOT NULL,
  company_name text NOT NULL,
  activity_score numeric NOT NULL CHECK (activity_score BETWEEN 0 AND 100),
  timing_score numeric NOT NULL CHECK (timing_score BETWEEN 0 AND 100),
  partner_fit_score numeric NOT NULL CHECK (partner_fit_score BETWEEN 0 AND 100),
  evidence_score numeric NOT NULL CHECK (evidence_score BETWEEN 0 AND 100),
  contactability_score numeric NOT NULL CHECK (contactability_score BETWEEN 0 AND 100),
  priority_score numeric NOT NULL CHECK (priority_score BETWEEN 0 AND 100),
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  unknowns jsonb NOT NULL DEFAULT '[]'::jsonb,
  verification_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  observed_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  next_action text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','queued','expired','dismissed')),
  source text NOT NULL DEFAULT 'motor_v3',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, lead_id, partner_id),
  FOREIGN KEY (client_id, partner_id)
    REFERENCES public.financing_partner_boxes(client_id, partner_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS financing_candidates_priority_idx
  ON public.financing_candidates(client_id, partner_id, status, priority_score DESC, observed_at DESC);

CREATE INDEX IF NOT EXISTS financing_candidates_expiry_idx
  ON public.financing_candidates(client_id, expires_at)
  WHERE status IN ('active','queued');

CREATE TABLE IF NOT EXISTS public.financing_partner_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  case_id uuid NOT NULL REFERENCES public.financing_cases(id) ON DELETE CASCADE,
  partner_id text NOT NULL,
  decision text NOT NULL CHECK(decision IN ('reviewed','declined','submitted','approved','funded')),
  reason_code text,
  partner_comment text,
  candidate_signal_types text[] NOT NULL DEFAULT '{}',
  decided_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(case_id, decision, decided_at)
);

ALTER TABLE public.financing_cases
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS source_candidate_id uuid REFERENCES public.financing_candidates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS auto_created_at timestamptz;

ALTER TABLE public.financing_partner_boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financing_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financing_partner_feedback ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.financing_partner_boxes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.financing_candidates FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.financing_partner_feedback FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.financing_partner_boxes TO authenticated;
GRANT SELECT ON public.financing_candidates TO authenticated;
GRANT SELECT, INSERT ON public.financing_partner_feedback TO authenticated;

GRANT ALL ON public.financing_partner_boxes TO service_role;
GRANT ALL ON public.financing_candidates TO service_role;
GRANT ALL ON public.financing_partner_feedback TO service_role;

DROP POLICY IF EXISTS financing_partner_boxes_client ON public.financing_partner_boxes;
CREATE POLICY financing_partner_boxes_client ON public.financing_partner_boxes
FOR ALL TO authenticated
USING (client_id=(select public.get_my_client_id()))
WITH CHECK (client_id=(select public.get_my_client_id()));

DROP POLICY IF EXISTS financing_candidates_client ON public.financing_candidates;
CREATE POLICY financing_candidates_client ON public.financing_candidates
FOR SELECT TO authenticated
USING (
  client_id=(select public.get_my_client_id())
  AND EXISTS(
    SELECT 1 FROM public.leads l
    WHERE l.id=lead_id AND l.client_id=financing_candidates.client_id
  )
);

DROP POLICY IF EXISTS financing_candidates_insert_client ON public.financing_candidates;
CREATE POLICY financing_candidates_insert_client ON public.financing_candidates
FOR INSERT TO authenticated
WITH CHECK (
  client_id=(select public.get_my_client_id())
  AND EXISTS(
    SELECT 1 FROM public.leads l
    WHERE l.id=lead_id AND l.client_id=financing_candidates.client_id
  )
);

DROP POLICY IF EXISTS financing_candidates_update_client ON public.financing_candidates;
CREATE POLICY financing_candidates_update_client ON public.financing_candidates
FOR UPDATE TO authenticated
USING (client_id=(select public.get_my_client_id()))
WITH CHECK (client_id=(select public.get_my_client_id()));

DROP POLICY IF EXISTS financing_partner_feedback_client ON public.financing_partner_feedback;
CREATE POLICY financing_partner_feedback_client ON public.financing_partner_feedback
FOR SELECT TO authenticated
USING (client_id=(select public.get_my_client_id()));

DROP POLICY IF EXISTS financing_partner_feedback_insert_client ON public.financing_partner_feedback;
CREATE POLICY financing_partner_feedback_insert_client ON public.financing_partner_feedback
FOR INSERT TO authenticated
WITH CHECK (client_id=(select public.get_my_client_id()) AND EXISTS (SELECT 1 FROM public.financing_cases c WHERE c.id=case_id AND c.client_id=financing_partner_feedback.client_id) AND EXISTS (SELECT 1 FROM public.financing_partner_boxes b WHERE b.client_id=financing_partner_feedback.client_id AND b.partner_id=financing_partner_feedback.partner_id));

CREATE OR REPLACE FUNCTION public.ingest_financing_candidate(p_candidate jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path=''
AS $$
DECLARE
  v_client text;
  v_lead uuid;
  v_partner text;
  v_priority numeric;
  v_observed timestamptz;
  v_expires timestamptz;
  v_candidate_id uuid;
  v_case_id uuid;
  v_case_created boolean := false;
  v_existing public.financing_candidates;
BEGIN
  IF jsonb_typeof(p_candidate) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Candidate must be an object';
  END IF;

  IF octet_length(p_candidate::text)>100000 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_candidate) k WHERE k NOT IN ('client_id','lead_id','partner_id','company_name','activity_score','timing_score','partner_fit_score','evidence_score','contactability_score','priority_score','reasons','signals','unknowns','verification_flags','observed_at','expires_at','next_action')) THEN
    RAISE EXCEPTION 'Unsupported candidate fields or oversized payload';
  END IF;
  IF jsonb_typeof(p_candidate->'signals') IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_candidate->'reasons') IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_candidate->'unknowns') IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_candidate->'verification_flags') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Candidate evidence must use arrays';
  END IF;
  IF jsonb_array_length(p_candidate->'reasons')>3 OR jsonb_array_length(p_candidate->'signals')>30 THEN RAISE EXCEPTION 'Candidate arrays exceed limits'; END IF;

  v_client = nullif(trim(p_candidate->>'client_id'),'');
  v_partner = nullif(trim(p_candidate->>'partner_id'),'');
  v_lead = (p_candidate->>'lead_id')::uuid;
  v_priority = (p_candidate->>'priority_score')::numeric;
  v_observed = (p_candidate->>'observed_at')::timestamptz;
  v_expires = (p_candidate->>'expires_at')::timestamptz;

  IF v_client IS NULL OR v_partner IS NULL OR v_priority IS NULL OR v_priority < 0 OR v_priority > 100 THEN
    RAISE EXCEPTION 'Invalid candidate identity or priority';
  END IF;
  IF v_observed IS NULL OR v_expires IS NULL OR NOT isfinite(v_observed) OR NOT isfinite(v_expires) OR v_expires<=v_observed OR v_observed>now()+interval '5 minutes' THEN
    RAISE EXCEPTION 'Invalid candidate dates';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_client||':'||v_lead::text||':'||v_partner,0));
  SELECT * INTO v_existing FROM public.financing_candidates WHERE client_id=v_client AND lead_id=v_lead AND partner_id=v_partner FOR UPDATE;
  IF FOUND AND v_existing.observed_at>v_observed THEN RETURN jsonb_build_object('status','stale','candidate_id',v_existing.id,'financing_case','not_created'); END IF;

  IF NOT EXISTS(
    SELECT 1 FROM public.leads
    WHERE id=v_lead AND client_id=v_client
  ) THEN
    RAISE EXCEPTION 'Lead does not belong to this workspace';
  END IF;

  IF NOT EXISTS(
    SELECT 1 FROM public.financing_partner_boxes
    WHERE client_id=v_client AND partner_id=v_partner AND active
  ) THEN
    RAISE EXCEPTION 'Active partner box not found';
  END IF;

  INSERT INTO public.financing_candidates(
    client_id,lead_id,partner_id,company_name,
    activity_score,timing_score,partner_fit_score,evidence_score,contactability_score,priority_score,
    reasons,signals,unknowns,verification_flags,observed_at,expires_at,next_action,status,source,updated_at
  )
  VALUES(
    v_client,
    v_lead,
    v_partner,
    p_candidate->>'company_name',
    (p_candidate->>'activity_score')::numeric,
    (p_candidate->>'timing_score')::numeric,
    (p_candidate->>'partner_fit_score')::numeric,
    (p_candidate->>'evidence_score')::numeric,
    (p_candidate->>'contactability_score')::numeric,
    v_priority,
    coalesce(p_candidate->'reasons','[]'::jsonb),
    coalesce(p_candidate->'signals','[]'::jsonb),
    coalesce(p_candidate->'unknowns','[]'::jsonb),
    coalesce(p_candidate->'verification_flags','[]'::jsonb),
    v_observed,
    v_expires,
    p_candidate->>'next_action',
    CASE WHEN v_expires <= now() THEN 'expired' ELSE 'active' END,
    'motor_v3',
    now()
  )
  ON CONFLICT(client_id,lead_id,partner_id)
  DO UPDATE SET
    company_name=excluded.company_name,
    activity_score=excluded.activity_score,
    timing_score=excluded.timing_score,
    partner_fit_score=excluded.partner_fit_score,
    evidence_score=excluded.evidence_score,
    contactability_score=excluded.contactability_score,
    priority_score=excluded.priority_score,
    reasons=excluded.reasons,
    signals=excluded.signals,
    unknowns=excluded.unknowns,
    verification_flags=excluded.verification_flags,
    observed_at=excluded.observed_at,
    expires_at=excluded.expires_at,
    next_action=excluded.next_action,
    status=CASE
      WHEN public.financing_candidates.status IN ('dismissed') THEN public.financing_candidates.status
      WHEN excluded.expires_at <= now() THEN 'expired'
      ELSE 'active'
    END,
    updated_at=now()
  RETURNING id INTO v_candidate_id;

  -- Deterministic outreach threshold only. This is NOT underwriting.
  IF v_priority >= 75 AND v_expires > now() AND jsonb_array_length(p_candidate->'signals')>0 AND jsonb_array_length(p_candidate->'verification_flags')=0
     AND EXISTS(SELECT 1 FROM public.financing_candidates WHERE id=v_candidate_id AND status<>'dismissed') THEN
    INSERT INTO public.financing_cases(
      client_id,lead_id,partner_name,stage,next_action,source,source_candidate_id,auto_created_at
    )
    SELECT
      v_client,
      v_lead,
      b.partner_name,
      'new',
      'Qualification call: confirm whether current or upcoming work is creating a working-capital need.',
      'motor_v3',
      v_candidate_id,
      now()
    FROM public.financing_partner_boxes b
    WHERE b.client_id=v_client AND b.partner_id=v_partner
    ON CONFLICT(client_id,lead_id) DO NOTHING
    RETURNING id INTO v_case_id;

    IF v_case_id IS NOT NULL THEN
      v_case_created := true;
      UPDATE public.financing_candidates
      SET status='queued',updated_at=now()
      WHERE id=v_candidate_id;
    ELSE
      SELECT id INTO v_case_id
      FROM public.financing_cases
      WHERE client_id=v_client AND lead_id=v_lead;
      UPDATE public.financing_candidates SET status='queued' WHERE id=v_candidate_id AND status<>'dismissed' AND v_case_id IS NOT NULL;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'status','applied',
    'candidate_id',v_candidate_id,
    'priority_score',v_priority,
    'financing_case',CASE
      WHEN v_case_id IS NULL THEN 'not_created'
      WHEN v_case_created THEN 'created'
      ELSE 'already_exists'
    END,
    'case_id',v_case_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ingest_financing_candidate(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_financing_candidate(jsonb) TO service_role;

COMMENT ON FUNCTION public.ingest_financing_candidate(jsonb) IS
'Evidence-first origination ingestion. High outreach priority can create an empty qualification case; it never populates confirmed borrower facts.';

-- Scores are server-produced. Remove unused browser write policies.
DROP POLICY IF EXISTS financing_candidates_insert_client ON public.financing_candidates;
DROP POLICY IF EXISTS financing_candidates_update_client ON public.financing_candidates;
DROP POLICY IF EXISTS financing_partner_feedback_insert_client ON public.financing_partner_feedback;
CREATE POLICY financing_partner_feedback_insert_client ON public.financing_partner_feedback
FOR INSERT TO authenticated WITH CHECK (
 client_id=(select public.get_my_client_id())
 AND EXISTS(SELECT 1 FROM public.financing_partner_boxes b WHERE b.client_id=financing_partner_feedback.client_id AND b.partner_id=financing_partner_feedback.partner_id)
 AND EXISTS(SELECT 1 FROM public.financing_cases c WHERE c.id=case_id AND c.client_id=financing_partner_feedback.client_id
  AND (decision='reviewed' OR decision=c.stage OR decision='declined' AND c.stage='not_fit'))
);
CREATE INDEX financing_partner_feedback_client_idx ON public.financing_partner_feedback(client_id,partner_id,decided_at DESC);
CREATE INDEX financing_candidates_lead_idx ON public.financing_candidates(lead_id);
CREATE INDEX financing_cases_candidate_idx ON public.financing_cases(source_candidate_id);

CREATE OR REPLACE FUNCTION private.validate_case_candidate() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NEW.source_candidate_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.financing_candidates c WHERE c.id=NEW.source_candidate_id AND c.client_id=NEW.client_id AND c.lead_id=NEW.lead_id) THEN RAISE EXCEPTION 'Candidate belongs to another case or workspace'; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.validate_case_candidate() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER validate_case_candidate BEFORE INSERT OR UPDATE ON public.financing_cases FOR EACH ROW EXECUTE FUNCTION private.validate_case_candidate();

CREATE OR REPLACE FUNCTION private.capture_partner_outcome() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p text; outcome text; sigs text[];
BEGIN
 IF TG_OP='UPDATE' AND NEW.stage IS NOT DISTINCT FROM OLD.stage THEN RETURN NEW; END IF;
 outcome=CASE WHEN NEW.stage='not_fit' THEN 'declined' WHEN NEW.stage IN ('submitted','approved','funded') THEN NEW.stage ELSE NULL END;
 IF outcome IS NULL THEN RETURN NEW; END IF;
 SELECT partner_id,ARRAY(SELECT DISTINCT x->>'signal_type' FROM jsonb_array_elements(c.signals) x WHERE x->>'signal_type' IS NOT NULL) INTO p,sigs
 FROM public.financing_candidates c WHERE c.id=NEW.source_candidate_id AND c.client_id=NEW.client_id AND c.lead_id=NEW.lead_id;
 IF p IS NULL THEN
  SELECT min(partner_id) INTO p FROM public.financing_partner_boxes WHERE client_id=NEW.client_id AND partner_name=NEW.partner_name HAVING count(*)=1;
 END IF;
 IF p IS NOT NULL THEN
  INSERT INTO public.financing_partner_feedback(client_id,case_id,partner_id,decision,partner_comment,candidate_signal_types,decided_at)
  VALUES(NEW.client_id,NEW.id,p,outcome,NEW.partner_notes,coalesce(sigs,'{}'::text[]),NEW.updated_at)
  ON CONFLICT(case_id,decision,decided_at) DO NOTHING;
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.capture_partner_outcome() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER capture_partner_outcome AFTER INSERT OR UPDATE ON public.financing_cases FOR EACH ROW EXECUTE FUNCTION private.capture_partner_outcome();
