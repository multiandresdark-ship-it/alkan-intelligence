-- Target: alkanhunter / qyesctuksvtblegkinrj. Additive: does not change leads or existing policies.
CREATE TABLE public.financing_cases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 client_id text NOT NULL DEFAULT public.get_my_client_id(),
 lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
 partner_name text NOT NULL DEFAULT 'Randall',
 stage text NOT NULL DEFAULT 'new' CHECK(stage IN ('new','contacted','qualified','docs_requested','ready_to_submit','submitted','approved','funded','not_fit','dormant')),
 amount_requested numeric CHECK(amount_requested>=0),
 use_of_funds text,
 monthly_deposits numeric CHECK(monthly_deposits>=0),
 current_debt text, bankruptcy_status text, nsf_status text, receivables_contracts text, funding_urgency text,
 documents_ready boolean,
 qualification_notes text, partner_notes text, next_action text, follow_up_at timestamptz,
 last_qualified_at timestamptz, submitted_at timestamptz, approved_at timestamptz, funded_at timestamptz,
 funded_amount numeric CHECK(funded_amount>=0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 created_by uuid DEFAULT auth.uid(), updated_by uuid DEFAULT auth.uid(),
 UNIQUE(client_id,lead_id),
 CONSTRAINT financing_qualified_facts CHECK(stage NOT IN ('qualified','docs_requested','ready_to_submit','submitted','approved','funded') OR (amount_requested IS NOT NULL AND amount_requested>0 AND length(trim(coalesce(use_of_funds,'')))>0)),
 CONSTRAINT financing_review_facts CHECK(stage NOT IN ('ready_to_submit','submitted','approved','funded') OR (
 monthly_deposits IS NOT NULL AND length(trim(coalesce(current_debt,'')))>0
 AND length(trim(coalesce(bankruptcy_status,'')))>0 AND length(trim(coalesce(nsf_status,'')))>0
 AND length(trim(coalesce(receivables_contracts,'')))>0 AND length(trim(coalesce(funding_urgency,'')))>0 AND documents_ready IS TRUE)),
 CONSTRAINT financing_partner_record CHECK(stage NOT IN ('submitted','approved','funded') OR length(trim(coalesce(partner_notes,'')))>0),
 CONSTRAINT financing_funded_amount CHECK(stage<>'funded' OR (funded_amount IS NOT NULL AND funded_amount>0))
);
CREATE INDEX financing_cases_stage_idx ON public.financing_cases(client_id,stage,updated_at DESC);
CREATE INDEX financing_cases_lead_idx ON public.financing_cases(lead_id);
CREATE INDEX financing_cases_follow_up_idx ON public.financing_cases(client_id,follow_up_at) WHERE follow_up_at IS NOT NULL;
ALTER TABLE public.financing_cases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.financing_cases FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.financing_cases TO authenticated;
GRANT ALL ON public.financing_cases TO service_role;
CREATE POLICY financing_cases_select_client ON public.financing_cases FOR SELECT TO authenticated USING (
 client_id=(select public.get_my_client_id()) AND EXISTS(SELECT 1 FROM public.leads l WHERE l.id=lead_id AND l.client_id=financing_cases.client_id));
CREATE POLICY financing_cases_insert_client ON public.financing_cases FOR INSERT TO authenticated WITH CHECK (
 client_id=(select public.get_my_client_id()) AND EXISTS(SELECT 1 FROM public.leads l WHERE l.id=lead_id AND l.client_id=financing_cases.client_id));
CREATE POLICY financing_cases_update_client ON public.financing_cases FOR UPDATE TO authenticated USING (
 client_id=(select public.get_my_client_id()) AND EXISTS(SELECT 1 FROM public.leads l WHERE l.id=lead_id AND l.client_id=financing_cases.client_id)) WITH CHECK (
 client_id=(select public.get_my_client_id()) AND EXISTS(SELECT 1 FROM public.leads l WHERE l.id=lead_id AND l.client_id=financing_cases.client_id));

CREATE SCHEMA IF NOT EXISTS private;
CREATE FUNCTION private.stamp_financing_case() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 NEW.updated_at=clock_timestamp(); NEW.updated_by=auth.uid();
 IF TG_OP='UPDATE' THEN
  NEW.client_id=OLD.client_id; NEW.lead_id=OLD.lead_id; NEW.created_at=OLD.created_at; NEW.created_by=OLD.created_by;
  NEW.last_qualified_at=OLD.last_qualified_at; NEW.submitted_at=OLD.submitted_at; NEW.approved_at=OLD.approved_at; NEW.funded_at=OLD.funded_at;
 ELSE
  NEW.created_at=NEW.updated_at; NEW.created_by=auth.uid();
  NEW.last_qualified_at=NULL; NEW.submitted_at=NULL; NEW.approved_at=NULL; NEW.funded_at=NULL;
 END IF;
 IF NEW.stage IN ('qualified','docs_requested','ready_to_submit','submitted','approved','funded') AND NEW.last_qualified_at IS NULL THEN NEW.last_qualified_at=NEW.updated_at; END IF;
 IF NEW.stage='submitted' AND NEW.submitted_at IS NULL THEN NEW.submitted_at=NEW.updated_at; END IF;
 IF NEW.stage='approved' AND NEW.approved_at IS NULL THEN NEW.approved_at=NEW.updated_at; END IF;
 IF NEW.stage='funded' AND NEW.funded_at IS NULL THEN NEW.funded_at=NEW.updated_at; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.stamp_financing_case() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER stamp_financing_case BEFORE INSERT OR UPDATE ON public.financing_cases FOR EACH ROW EXECUTE FUNCTION private.stamp_financing_case();
COMMENT ON TABLE public.financing_cases IS 'Human-confirmed financing facts. Public activity signals stay in leads.enrichment_data; unknown facts remain NULL.';
