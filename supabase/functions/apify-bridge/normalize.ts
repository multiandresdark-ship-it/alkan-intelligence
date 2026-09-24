export type Kind = "serp" | "digital" | "accela" | "wa_enrichment";
export const obj = (v: unknown): Record<string, any> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, any> : {};
const text = (v: unknown, max=1500): string|null => typeof v === "string" && v.trim() ? v.trim().slice(0,max) : null;
const arr = (v: unknown): any[] => Array.isArray(v) ? v : [];
function url(v:unknown){const s=text(v,2000);if(!s)return null;try{const u=new URL(s);return ["https:","http:"].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
function iso(v:unknown){const s=text(v,100);return s&&Number.isFinite(Date.parse(s))?new Date(s).toISOString():null;}
const cleanName=(v:unknown)=>{const s=text(v,250);return s&&!/^(address|filter|null|undefined|docusign envelope id|named above|ubi\/account id #)$/i.test(s)?s:null;};
const projected=(x:Record<string,any>,keys:string[])=>Object.fromEntries(keys.map(k=>[k,x[k]]).filter(([,v])=>typeof v==="boolean"||typeof v==="number"&&Number.isFinite(v)||typeof v==="string"&&v.length<=3000||Array.isArray(v)&&v.length<=30&&v.every(t=>typeof t==="string"&&t.length<=500)));
const compactPeople=(v:unknown)=>arr(v).slice(0,12).map((item)=>{const x=obj(item);return projected(x,["name","role","source","confidence"]);}).filter(x=>Object.keys(x).length>0);
const compactContacts=(v:unknown)=>arr(v).slice(0,12).map((item)=>{const x=obj(item);const out=projected(x,["type","value","confidence"]);const roles=arr(x.roles).filter(v=>typeof v==="string").slice(0,8);const sources=arr(x.sources).filter(v=>typeof v==="string").slice(0,8);if(roles.length)out.roles=roles;if(sources.length)out.sources=sources;return out;}).filter(x=>Object.keys(x).length>0);
const compactActivity=(v:unknown)=>arr(v).slice(0,25).map((item)=>{const x=obj(item);return projected(x,["source","type","event_type","date","event_date","observed_at","permit_number","project_number","project_name","project_address","city","status","value","estimated_value","amount","description","source_url","confidence"]);}).filter(x=>Object.keys(x).length>0);
const compactSourceEvidence=(v:unknown)=>arr(v).slice(0,16).map((item)=>{const x=obj(item);const out=projected(x,["source","status","retrieved_at","identity_verified"]);const sourceUrl=url(x.source_url);if(sourceUrl)out.source_url=sourceUrl;const exact=obj(x.exact_match);const exactMatch=projected(exact,["ubi","license","name"]);if(Object.keys(exactMatch).length)out.exact_match=exactMatch;return out;}).filter(x=>Object.keys(x).length>0);

export function normalize(kind:Kind,raw:unknown,run:{id:string;actId:string;startedAt:string;finishedAt:string},index:number){
 const row=obj(raw), lead=obj(row.lead_payload), llm=obj(row.llm_data);
 const timestamp=text(row.timestamp??row.observed_at);
 // A resurrected run's finish time is not the source observation time.
 let observed=timestamp&&Number.isFinite(Date.parse(timestamp))?new Date(timestamp).toISOString():null;
 const evidence:Record<string,any>={actor_id:run.actId,run_id:run.id,item_index:index,observed_at:observed,run_started_at:run.startedAt,run_finished_at:run.finishedAt,review_status:"unverified",source_url:null};

 if(kind==="wa_enrichment"){
  const input=obj(row.input), identity=obj(row.identity), business=obj(row.business_status), sources=obj(row.sources), lni=obj(sources.lni), lniBusiness=obj(lni.business);
  const legalName=cleanName(identity.legal_name??input.company_name??input.company??input.name);
  const ubi=text(identity.ubi??input.ubi,40);
  const license=text(identity.license_number??input.license_number??input.license,100);
  if(!legalName&&!ubi&&!license)return {skip:"No usable business identity"};

  observed=iso(row.enriched_at)??iso(lni.retrieved_at)??observed;
  evidence.observed_at=observed;
  const sourceUrl=url(lni.source_url)??compactSourceEvidence(row.evidence).map((x:any)=>x.source_url).find(Boolean)??null;
  evidence.source_url=sourceUrl;
  evidence.identity={
   legal_name:legalName,
   ubi,
   license_number:license,
   identity_confidence:text(identity.identity_confidence,40),
   corroborated_sources:typeof identity.corroborated_sources==="number"&&Number.isFinite(identity.corroborated_sources)?identity.corroborated_sources:null,
   conflicts:arr(identity.conflicts).slice(0,12).map((c)=>projected(obj(c),["type","canonical","observed"])).filter(c=>Object.keys(c).length>0),
  };
  evidence.business_status=projected(business,["lni_license_status","lni_expiration","workers_comp_current","estimated_workers","sos_status","dor_location_status"]);
  const training=obj(business.public_works_training);
  const compactTraining=projected(training,["QualificationExistsForUBI","IsGrandfathered","HasCompletedTraining","TrainingCompletionDate","ExcludeFromTraining"]);
  if(Object.keys(compactTraining).length)evidence.business_status.public_works_training=compactTraining;
  evidence.principals=compactPeople(row.principals);
  evidence.contacts=compactContacts(row.contacts);
  evidence.activity=compactActivity(row.activity);
  evidence.sources=compactSourceEvidence(row.evidence);
  if(typeof row.enrichment_quality_score==="number"&&Number.isFinite(row.enrichment_quality_score))evidence.enrichment_quality_score=row.enrichment_quality_score;
  evidence.unknowns=arr(row.unknowns).filter(v=>typeof v==="string").slice(0,30);
  evidence.source_failures=arr(row.source_failures).slice(0,12).map(v=>projected(obj(v),["source","error"])).filter(v=>Object.keys(v).length>0);
  evidence.review_note="Official public-record enrichment. It may establish business identity, registration, compliance and observed activity, but it does not establish borrower need, revenue, deposits, debt, NSF history, bankruptcy status, desired amount or a financing decision.";

  const identityKey=ubi?("ubi:"+ubi):license?("license:"+license.toUpperCase()):("name:"+String(legalName).toLowerCase());
  const leadId=text(input.lead_id??row.lead_id,36);
  return {record:{
   identity:"wa_enrichment:"+identityKey,
   company:legalName,
   name:null,
   permit_number:null,
   jurisdiction:text(input.jurisdiction,80),
   city:text(input.city??lniBusiness.city,200),
   trade:text(input.trade,200),
   phone:null,
   email:null,
   website:null,
   lead_id:leadId&&/^[0-9a-f-]{36}$/i.test(leadId)?leadId:null,
   evidence
  },observed_at:observed};
 }

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
