export type Kind = "serp" | "digital" | "accela";
export const obj = (v: unknown): Record<string, any> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, any> : {};
const text = (v: unknown, max=1500): string|null => typeof v === "string" && v.trim() ? v.trim().slice(0,max) : null;
function url(v:unknown){const s=text(v,2000);if(!s)return null;try{const u=new URL(s);return ["https:","http:"].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
const cleanName=(v:unknown)=>{const s=text(v,250);return s&&!/^(address|filter|null|undefined|docusign envelope id|named above)/i.test(s)?s:null;};
const projected=(x:Record<string,any>,keys:string[])=>Object.fromEntries(keys.map(k=>[k,x[k]]).filter(([,v])=>typeof v==="boolean"||typeof v==="number"&&Number.isFinite(v)||typeof v==="string"&&v.length<=3000||Array.isArray(v)&&v.length<=30&&v.every(t=>typeof t==="string"&&t.length<=500)));
export function normalize(kind:Kind,raw:unknown,run:{id:string;actId:string;startedAt:string;finishedAt:string},index:number){
 const row=obj(raw), lead=obj(row.lead_payload), llm=obj(row.llm_data);
 const timestamp=text(row.timestamp??row.observed_at);
 // A resurrected run's finish time is not the source observation time.
 const observed=timestamp&&Number.isFinite(Date.parse(timestamp))?new Date(timestamp).toISOString():null;
 const evidence:Record<string,any>={actor_id:run.actId,run_id:run.id,item_index:index,observed_at:observed,run_started_at:run.startedAt,run_finished_at:run.finishedAt,review_status:"unverified",source_url:null};
 if(kind==="accela"){
  const permit=text(row.permit_number??lead.permit_number,80);
  if(!permit||!/^[A-Za-z0-9-]{4,80}$/.test(permit)||row.status!=="ok")return {skip:"Not a successful permit record"};
  const source=url(obj(lead.enrichment_data).source_url??row.source_url);
  evidence.source_url=source;
  evidence.document=text(row.attachment_name,300);
  evidence.extracted=projected(llm,["project_address","parcel_number","project_description","project_type","estimated_value","owner_name","owner_phone","owner_email","contractor_name","architect_firm","confidence","notes"]);
  evidence.review_note="Legacy extraction requires document review. Contact roles and owner names are unverified; no financing score is assigned.";
  return {record:{identity:"permit:seattle:"+permit.toUpperCase(),company:null,name:"Permit "+permit,permit_number:permit,jurisdiction:"seattle",city:"Seattle",trade:null,phone:null,email:null,website:null,lead_id:null,evidence},observed_at:observed};
 }
 const company=cleanName(kind==="serp"?row.nombre_contacto_o_empresa:row.negocio??row.company);
 if(!company)return {skip:"No usable business identity"};
 const source=url(kind==="serp"?row.url??row.fuente_url??row.url_fuente??row.link:row.url??row.sitio);
 const city=text(kind==="serp"?row.ubicacion:row.ciudad,200);
 evidence.source_url=source;
 evidence.extracted=projected(row,kind==="serp"?["ubicacion","tipo_de_trabajo","relevancia","descripcion","resumen","motivo","telefono","email","fecha"]:["segmento","prioridad","inversion","modernidad","vender","apertura","sitio","url","telefono"]);
 evidence.review_note=kind==="serp"?"Search discovery; verify the business, contact and current demand before qualification.":"Website analysis; it is not credit qualification.";
 const leadId=text(row.lead_id,36);
 return {record:{identity:kind+":"+company.toLowerCase()+":"+String(source??city??"unknown").toLowerCase(),company,name:null,permit_number:null,jurisdiction:null,city,trade:text(row.tipo_de_trabajo??row.oficio,200),phone:null,email:null,website:kind==="digital"?source:null,lead_id:leadId&&/^[0-9a-f-]{36}$/i.test(leadId)?leadId:null,evidence},observed_at:observed};
}
