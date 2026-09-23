import {createClient} from "npm:@supabase/supabase-js@2.112.0";
import {buildFinancingCandidate} from "../../../engine/financing-origination/prioritizer.ts";
import {snapshotFromLead} from "../../../engine/financing-origination/snapshot.ts";
const allowed=new Set(["https://randall-console.vercel.app","http://127.0.0.1:5187","http://localhost:5187"]);
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get("origin")??"";
 const headers={"Content-Type":"application/json","Cache-Control":"no-store","Vary":"Origin","Access-Control-Allow-Origin":allowed.has(origin)?origin:"https://randall-console.vercel.app","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"};
 const reply=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers});
 if(origin&&!allowed.has(origin))return reply({error:"Origin is not allowed"},403);
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return reply({error:"POST required"},405);
 try {
  const authHeader=req.headers.get("authorization")??"";
  if(!authHeader.startsWith("Bearer "))return reply({error:"Sign in to the console"},401);
  const url=Deno.env.get("SUPABASE_URL")!;
  const user=createClient(url,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false}});
  const auth=await user.auth.getUser(authHeader.slice(7));
  if(auth.error||!auth.data.user)return reply({error:"Session expired"},401);
  const profile=await user.from("client_profiles").select("client_id").eq("user_id",auth.data.user.id).maybeSingle();
  if(profile.error||!profile.data?.client_id)return reply({error:"Workspace is not assigned"},403);
  const raw=await req.text();if(raw.length>2000)return reply({error:"Request too large"},413);
  let input;try{input=JSON.parse(raw);}catch{return reply({error:"Invalid JSON"},400);}
  if(input?.action!=="evaluate")return reply({error:"Unknown action"},400);
  const offset=input.offset??0;if(!Number.isInteger(offset)||offset<0||offset>1000000)return reply({error:"Invalid offset"},400);
  const admin=createClient(url,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
  const client=profile.data.client_id;
  const box=await admin.from("financing_partner_boxes").select("*").eq("client_id",client).eq("partner_id","randall").eq("active",true).maybeSingle();
  if(box.error||!box.data)return reply({error:"An active partner configuration is required"},409);
  const rows=await admin.from("leads").select("id,client_id,company,enrichment_data").eq("client_id",client).order("id").range(offset,offset+49);
  if(rows.error)return reply({error:"Source records could not be loaded"},503);
  const counts={reviewed:0,evaluated:0,skipped:0,cases_created:0};const reasons:Record<string,number>={};
  const partner={...box.data,name:box.data.partner_name};
  for(const lead of rows.data??[]){
   counts.reviewed++;
   const built=snapshotFromLead(lead);
   if(!built.snapshot){counts.skipped++;const key=built.skip??"Missing evidence";reasons[key]=(reasons[key]??0)+1;continue;}
   let candidate;
   try{candidate=buildFinancingCandidate(built.snapshot,partner);}catch{counts.skipped++;reasons["Invalid or future-dated source evidence"]=(reasons["Invalid or future-dated source evidence"]??0)+1;continue;}
   const saved=await admin.rpc("ingest_financing_candidate",{p_candidate:candidate});
   if(saved.error)return reply({error:"Evaluation stopped; retry this page safely",counts,reasons},503);
   counts.evaluated++;if(saved.data?.financing_case==="created")counts.cases_created++;
  }
  return reply({counts,reasons,next_offset:(rows.data?.length??0)<50?null:offset+50});
 }catch{return reply({error:"The origination engine could not complete the request"},500);}
});
