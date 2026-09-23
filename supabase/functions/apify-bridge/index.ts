import { createClient } from "npm:@supabase/supabase-js@2.112.0";
import { normalize, obj, type Kind } from "./normalize.ts";
const origins = new Set(["https://randall-console.vercel.app","http://127.0.0.1:5187","http://localhost:5187"]);
class ApiError extends Error { status:number; constructor(status:number,message:string){super(message);this.status=status;} }
export async function handle(req:Request){
 const origin=req.headers.get("origin")??"";
 const headers={"Content-Type":"application/json","Cache-Control":"no-store","Vary":"Origin","Access-Control-Allow-Origin":origins.has(origin)?origin:"https://randall-console.vercel.app","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"};
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&!origins.has(origin))return reply({error:"Origin is not allowed."},403);
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return reply({error:"POST required."},405);
 try{
  const authorization=req.headers.get("authorization")??"";
  if(!authorization.startsWith("Bearer "))throw new ApiError(401,"Sign in to the console.");
  const supabaseUrl=Deno.env.get("SUPABASE_URL")!;
  const user=createClient(supabaseUrl,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
  const auth=await user.auth.getUser(authorization.slice(7));
  if(auth.error||!auth.data.user)throw new ApiError(401,"Your session expired. Sign in again.");
  const profile=await user.from("client_profiles").select("client_id").eq("user_id",auth.data.user.id).maybeSingle();
  if(profile.error||!profile.data?.client_id)throw new ApiError(403,"Your account has no workspace assignment.");
  const clientId=profile.data.client_id;
  const admin=createClient(supabaseUrl,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
  const bindings=await admin.from("apify_actor_bindings").select("actor_id,kind,label").eq("client_id",clientId).eq("enabled",true);
  if(bindings.error)throw new ApiError(503,"Actor bindings are unavailable.");
  const actors=bindings.data??[];
  const text=await req.text();if(text.length>8000)throw new ApiError(413,"Request is too large.");
  let input;try{input=obj(JSON.parse(text));}catch{throw new ApiError(400,"Invalid JSON.");}
  // Compatibility with the existing secret label; never return its value.
  const token=Deno.env.get("APIFY_TOKEN")??Deno.env.get("alkan leads");
  if(input.action==="connections")return reply({configured:Boolean(token),actors});
  if(!token)throw new ApiError(503,"APIFY_TOKEN is missing from the backend secrets.");
  const api=async(path:string)=>{
   let response:Response;
   try{response=await fetch("https://api.apify.com/v2"+path,{headers:{Authorization:"Bearer "+token},redirect:"error",signal:AbortSignal.timeout(20000)});}catch{throw new ApiError(502,"Apify did not respond. Retry this page.");}
   if(!response.ok)throw new ApiError(response.status===401||response.status===403?502:response.status===429?429:502,"Apify request failed (HTTP "+response.status+"). Check token access, resource availability or usage limits.");
   const body=await response.text();if(body.length>2000000)throw new ApiError(502,"Dataset page is too large.");
   return {body:JSON.parse(body),total:Number(response.headers.get("x-apify-pagination-total")??0)};
  };
  const id=(v:unknown)=>{if(typeof v!=="string"||!/^[A-Za-z0-9]{10,40}$/.test(v))throw new ApiError(400,"Invalid actor/run ID.");return v;};
  const runSummary=(run:any)=>({id:run.id,actor_id:run.actId,status:run.status,started_at:run.startedAt,finished_at:run.finishedAt,dataset_id:run.defaultDatasetId});
  if(input.action==="runs"){
   const actorId=id(input.actor_id);if(!actors.some(a=>a.actor_id===actorId))throw new ApiError(403,"Actor is not assigned to your workspace.");
   const result=await api("/acts/"+actorId+"/runs?desc=true&limit=30");
   return reply({runs:(result.body.data?.items??[]).map(runSummary)});
  }
  if(!["preview","import"].includes(input.action))throw new ApiError(400,"Unknown action.");
  const runId=id(input.run_id);
  const run=obj((await api("/actor-runs/"+runId)).body.data);
  const binding=actors.find(a=>a.actor_id===run.actId);
  if(!binding)throw new ApiError(403,"This run's actor is not assigned to your workspace.");
  if(run.status!=="SUCCEEDED")throw new ApiError(409,"Only successful, completed runs can be imported.");
  const datasetId=id(run.defaultDatasetId);
  const offset=input.offset??0;
  if(!Number.isInteger(offset)||offset<0||offset>1000000)throw new ApiError(400,"Invalid dataset offset.");
  const limit=25;
  const page=await api("/datasets/"+datasetId+"/items?format=json&clean=false&offset="+offset+"&limit="+limit);
  if(!Array.isArray(page.body))throw new ApiError(502,"Dataset returned an unexpected format.");
  const items=page.body.map((item:unknown,i:number)=>normalize(binding.kind as Kind,item,run as any,offset+i));
  const next=page.body.length<limit?null:offset+page.body.length;
  const common={run:runSummary(run),kind:binding.kind,offset,next_offset:next,total_items:page.total,page_items:items.length};
  if(input.action==="preview")return reply({...common,records:items.map((r:any,i:number)=>({index:offset+i,title:r.record?.company??r.record?.name??null,permit_number:r.record?.permit_number??null,source_url:r.record?.evidence.source_url??null,observed_at:r.observed_at??null,skip:r.skip??null})),notice:"Imported output remains unverified evidence. No borrower facts, financial score or partner decisions are inferred."});
  const counts:Record<string,number>={inserted:0,updated:0,already_imported:0,unmatched:0,stale:0,ambiguous:0,skipped:0};
  for(let i=0;i<items.length;i++){
   const item:any=items[i];if(item.skip){counts.skipped++;continue;}
   const result=await admin.rpc("ingest_apify_record",{p_client_id:clientId,p_actor_id:run.actId,p_run_id:runId,p_item_index:offset+i,p_observed_at:item.observed_at,p_record:item.record});
   if(result.error)throw new ApiError(503,"Import stopped at item "+(offset+i)+". Retry this page safely; imported items will not be duplicated.");
   const status=result.data?.result;counts[status]=(counts[status]??0)+1;
  }
  return reply({...common,counts});
 }catch(error){return reply({error:error instanceof ApiError?error.message:"The actor connection could not complete the request."},error instanceof ApiError?error.status:500);}
}
Deno.serve(handle);
