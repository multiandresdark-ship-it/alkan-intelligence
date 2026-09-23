import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { scoreContratista, ganchosParaGuion, type ContratistaInput } from "./capital-scoring.ts";
type Input = {lead_id:string; client_id:string; observed_at:string; sources:string[]; contractor:ContratistaInput};
const numberKeys=["años_operando","fianza_monto","permisos_12m","valor_obra_12m","seguro_monto","suspensiones","infracciones","reseñas_count","rating","profesionalismo_score"];
const boolKeys=["licencia_vigente","dor_activo","dor_delincuente","fianza_cancelada","deuda_lni","direccion_residencial","sitio_web","google_maps"];
const textKeys=["id","nombre","ciudad","oficio","tipo_entidad","licencia_tipo","tamaño_estimado","fianza_vence"];
export function buildSignalEvent(input:Input) {
 if(Object.keys(input).some(k=>!["lead_id","client_id","observed_at","sources","contractor"].includes(k)))throw new Error("Unexpected input field.");
 if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(input.lead_id)||!input.client_id?.trim())throw new Error("A lead UUID and client workspace are required.");
 if(!/(Z|[+-]\d\d:\d\d)$/.test(input.observed_at)||!Number.isFinite(Date.parse(input.observed_at)))throw new Error("A zoned observation timestamp is required.");
 if(!Array.isArray(input.sources)||!input.sources.length||input.sources.length>20)throw new Error("Public evidence source URLs are required.");
 for(const source of input.sources){const url=new URL(source);if(url.protocol!=="https:"||url.username||url.password)throw new Error("Sources must use HTTPS without credentials.");}
 const contractor=input.contractor;
 if(!contractor||typeof contractor.nombre!=="string"||!contractor.nombre.trim())throw new Error("Business identity is required.");
 for(const [key,value] of Object.entries(contractor)){
  if(value==null)continue;
  if(numberKeys.includes(key)){if(typeof value!=="number"||!Number.isFinite(value)||value<0)throw new Error("Invalid numeric evidence: "+key);}
  else if(boolKeys.includes(key)){if(typeof value!=="boolean")throw new Error("Invalid boolean evidence: "+key);}
  else if(textKeys.includes(key)){if(typeof value!=="string")throw new Error("Invalid text evidence: "+key);}
  else if(key==="banderas_rojas"){if(!Array.isArray(value)||value.some(v=>typeof v!=="string"))throw new Error("Flags must be an array of strings.");}
  else throw new Error("Unrecognized contractor field: "+key);
 }
 const score=scoreContratista(contractor);
 const hooks=ganchosParaGuion(score);
 const signal={ruta:score.ruta,fit:score.fit.score,need:score.need.score,risk:score.risk.score,confianza:({alta:"high",media:"medium",baja:"low"} as const)[score.confianza],motivo:score.motivo,ganchos:hooks.length?hooks:[score.motivo],valor_obra_12m:contractor.valor_obra_12m??null,observed_at:new Date(input.observed_at).toISOString(),sources:input.sources};
 const hex=createHash("sha256").update(JSON.stringify([input.client_id,input.lead_id,signal])).digest("hex");
 const event_id=hex.slice(0,8)+"-"+hex.slice(8,12)+"-4"+hex.slice(13,16)+"-a"+hex.slice(17,20)+"-"+hex.slice(20,32);
 return {event_id,lead_id:input.lead_id,client_id:input.client_id,signal};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [inputPath,outputPath]=process.argv.slice(2);
 if(!inputPath||!outputPath)throw new Error("Usage: node engine/score-financing.ts input.json events.json");
 const raw=JSON.parse(readFileSync(inputPath,"utf8"));
 const events=(Array.isArray(raw)?raw:[raw]).map(buildSignalEvent);
 writeFileSync(outputPath,JSON.stringify(events,null,2)+"\n");
 console.log(JSON.stringify({events:events.length,writes_to_supabase:0,output:outputPath}));
}
