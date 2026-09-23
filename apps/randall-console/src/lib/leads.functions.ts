import type { RutaCredito } from "./lead-hunter/capital-scoring";
export type LeadRow = {
  id: string;
  company: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  trade: string | null;
  license_number: string | null;
  years_licensed: number | null;
  analysis_tier: string | null;
  analyzed_at: string | null;
  credit_ruta: RutaCredito | null;
  origen: string | null;
  created_at: string | null;
  valor_obra_12m: number | null;
  contact_status: string | null;
  credit_hooks: string[];
  capital_fit: number | null;
  capital_need: number | null;
  capital_risk: number | null;
  capital_confidence: string | null;
  capital_reason: string | null;
  /** Permit / project intelligence fields (lead → project feedback loop) */
  permit_number: string | null;
  jurisdiction: string | null;
  permit_score: number | null;
  golden_lead: boolean;
  lead_status: string | null;
  last_contacted: string | null;
  opportunity_score: number | null;
  opportunity_urgency: string | null;
  project_value: number | null;
};

