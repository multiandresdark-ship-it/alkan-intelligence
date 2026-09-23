import type {ContractorSnapshot} from "./types.ts";
const record=(v:unknown):Record<string,any>=>v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,any>:{};
export function snapshotFromLead(lead:Record<string,any>): {snapshot?:ContractorSnapshot;skip?:string} {
 if(typeof lead.company!=="string"||!lead.company.trim())return {skip:"Business identity is not resolved"};
 const s=record(record(lead.enrichment_data).origination_snapshot);
 if(s.identity_verified!==true)return {skip:"Business-to-evidence match needs verification"};
 if(!Array.isArray(s.evidence)||!s.evidence.length)return {skip:"Dated source evidence is missing"};
 if(s.evidence.some((e:unknown)=>!e||typeof e!=="object"||Array.isArray(e)))return {skip:"Source evidence is malformed"};
 const snapshot:ContractorSnapshot={lead_id:lead.id,client_id:lead.client_id,company_name:lead.company,evidence:s.evidence.map((e:any)=>({url:e.url,observed_at:e.observed_at,source_type:e.source_type,reference:e.reference}))};
 for(const k of ["state","industry","trade"] as const)if(typeof s[k]==="string")snapshot[k]=s[k];
 for(const k of ["years_in_business","permits_30d","permits_90d","permits_12m","concurrent_projects","observed_work_value_12m","recent_award_value","public_contracts_12m","project_starts_30d","project_starts_60d","bond_renewal_days"] as const)if(typeof s[k]==="number")snapshot[k]=s[k];
 for(const k of ["license_active","entity_active","owner_resolved","phone_verified","email_verified"] as const)if(typeof s[k]==="boolean")snapshot[k]=s[k];
 return {snapshot};
}
