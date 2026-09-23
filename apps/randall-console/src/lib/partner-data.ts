import { supabase } from "@/integrations/supabase/client";
import type { LeadRow } from "@/lib/leads.functions";
export type EvidenceLead = LeadRow & { evidence: Record<string, unknown>; permit: Record<string, unknown>; source: string | null; notes: string | null; updated_at: string | null };
const record = (v: unknown): Record<string, any> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, any> : {};
const str = (v: unknown) => typeof v === "string" && v.trim() ? v : null;
const num = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? v : null;
export function mapLead(r: Record<string, any>): EvidenceLead {
  const e = record(r.enrichment_data), p = record(r.permit_data), c = record(e.capital);
  const company = record(e.company), legal = record(e.legal_data), lni = record(legal.lni);
  const ruta = c.ruta ?? e.ruta;
  return { id: r.id, company: str(r.company), name: str(r.name), phone: str(r.phone), email: str(r.email),
    city: str(e.city ?? company.city ?? p.city), trade: str(e.trade ?? company.trade ?? p.trade),
    license_number: str(e.license_number ?? lni.license_number), years_licensed: num(e.years_licensed),
    analysis_tier: str(e.analysis_tier), analyzed_at: str(c.observed_at ?? e.analysis_at), credit_ruta: ["TIER_S_FINANCIAMIENTO","TIER_A_BLINDAJE","TIER_B","NURTURE","DESCARTE"].includes(ruta) ? ruta : null,
    origen: str(r.source), created_at: str(r.created_at), valor_obra_12m: num(c.valor_obra_12m ?? e.valor_obra_12m),
    contact_status: str(e.contact_status ?? r.status), credit_hooks: (Array.isArray(c.ganchos ?? e.ganchosParaGuion) ? c.ganchos ?? e.ganchosParaGuion : []).filter((s: unknown) => typeof s === "string"),
    capital_fit: num(c.fit), capital_need: num(c.need), capital_risk: num(c.risk), capital_confidence: str(c.confianza), capital_reason: str(c.motivo),
    permit_number: str(r.permit_number), jurisdiction: str(r.jurisdiction), permit_score: num(r.permit_score),
    golden_lead: e.golden_lead === true, lead_status: str(r.status), last_contacted: str(e.last_contacted),
    opportunity_score: num(record(e.opportunity).score), opportunity_urgency: str(record(e.opportunity).urgency),
    project_value: num(p.value ?? p.valuation), evidence: e, permit: p, source: str(r.source), notes: str(r.notes), updated_at: str(r.updated_at) };
}
export async function getLeads() {
  const rows: EvidenceLead[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from("leads").select("*").order("created_at", {ascending:false}).order("id").range(offset,offset+499);
    if(error) throw new Error(error.message);
    rows.push(...(data ?? []).map(mapLead));
    if(!data || data.length<500) break;
  }
  return rows;
}
export async function getWorkspace() {
  const {data,error}=await supabase.rpc("get_my_client_id");
  if(error) throw new Error(error.message);
  return typeof data==="string" && data ? data : null;
}
