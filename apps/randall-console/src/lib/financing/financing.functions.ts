import { supabase } from "@/integrations/supabase/client";
import { caseInput, milestonePatch, type SaveFinancingCaseInput } from "./qualification";
export { FINANCING_STAGES, FINANCING_STAGE_LABELS, type FinancingStage, type SaveFinancingCaseInput } from "./qualification";
import type { FinancingStage } from "./qualification";
export type FinancingCase = {
  id: string;
  client_id: string;
  lead_id: string;
  partner_name: string;
  stage: FinancingStage;
  amount_requested: number | null;
  use_of_funds: string | null;
  monthly_deposits: number | null;
  current_debt: string | null;
  bankruptcy_status: string | null;
  nsf_status: string | null;
  receivables_contracts: string | null;
  funding_urgency: string | null;
  documents_ready: boolean | null;
  qualification_notes: string | null;
  partner_notes: string | null;
  next_action: string | null;
  follow_up_at: string | null;
  last_qualified_at: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  funded_at: string | null;
  funded_amount: number | null;
  created_at: string;
  updated_at: string;
  company: string | null;
  owner_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  trade: string | null;
  license_number: string | null;
};


const selection = "*, leads(company, name, phone, email, enrichment_data, permit_data)";
function mapCase(row: Record<string, any>): FinancingCase {
 const lead=Array.isArray(row.leads)?row.leads[0]:row.leads;
 const e=lead?.enrichment_data??{}, p=lead?.permit_data??{};
 return { ...row, company:lead?.company??null, owner_name:lead?.name??null, phone:lead?.phone??null, email:lead?.email??null,
 city:e.city??p.city??null, trade:e.trade??p.trade??null, license_number:e.license_number??null } as FinancingCase;
}
export async function listFinancingCases(): Promise<FinancingCase[]> {
 const rows: FinancingCase[]=[];
 for(let offset=0;;offset+=500) {
  const {data,error}=await supabase.from("financing_cases").select(selection).order("updated_at",{ascending:false}).order("id").range(offset,offset+499);
  if(error) throw new Error(error.code==="42P01" || error.code==="PGRST205" ? "The financing workspace migration must be installed in alkanhunter." : error.message);
  rows.push(...(data??[]).map(mapCase));
  if(!data || data.length<500) return rows;
 }
}
export async function saveFinancingCase({data: input}:{data:SaveFinancingCaseInput}): Promise<FinancingCase> {
 const parsed=caseInput.safeParse(input);
 if(!parsed.success) throw new Error([...new Set(parsed.error.issues.map(i=>i.message))].join(" "));
 const {expected_updated_at,...data}=parsed.data;
 const {data:clientId,error:clientError}=await supabase.rpc("get_my_client_id");
 if(clientError || !clientId) throw new Error("Your account needs a client workspace assignment before saving.");
 const {data:old,error:loadError}=await supabase.from("financing_cases").select("*").eq("client_id",clientId).eq("lead_id",data.lead_id).maybeSingle();
 if(loadError) throw new Error(loadError.message);
 if((old?.updated_at??null)!==expected_updated_at) throw new Error("This case changed in another session. Close, refresh, and reopen before saving.");
 const payload={...data,client_id:clientId,...milestonePatch(data.stage,old,new Date().toISOString())};
 const query=old ? supabase.from("financing_cases").update(payload).eq("id",old.id).eq("updated_at",expected_updated_at!) : supabase.from("financing_cases").insert(payload);
 const {data:saved,error}=await query.select(selection).single();
 if(error) throw new Error(error.code==="PGRST116" || error.code==="23505" ? "This case changed in another session. Close, refresh, and reopen before saving." : error.message);
 return mapCase(saved);
}
