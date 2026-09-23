import {useEffect,useState,type FormEvent} from "react";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
const csv=(v:string)=>v.split(",").map(s=>s.trim()).filter(Boolean);
const nullable=(v:string)=>v.trim()===""?null:Number(v);
export function PartnerOperations(){
 const qc=useQueryClient(),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 const [form,setForm]=useState({states:"",industries:"",years:"",min:"",max:"",documents:"",notes:"",active:true});
 const box=useQuery({queryKey:["partner-box"],queryFn:async()=>{const r=await supabase.from("financing_partner_boxes").select("*").eq("partner_id","randall").maybeSingle();if(r.error)throw r.error;return r.data;}});
 const feedback=useQuery({queryKey:["partner-feedback"],queryFn:async()=>{const r=await supabase.from("financing_partner_feedback").select("*").order("decided_at",{ascending:false}).limit(100);if(r.error)throw r.error;return r.data??[];}});
 const cases=useQuery({queryKey:["feedback-cases"],queryFn:async()=>{const r=await supabase.from("financing_cases").select("id,stage,partner_name,leads(company,name)").order("updated_at",{ascending:false}).limit(200);if(r.error)throw r.error;return r.data??[];}});
 const [caseId,setCaseId]=useState(""),[reason,setReason]=useState(""),[comment,setComment]=useState("");
 useEffect(()=>{if(box.data){const d=box.data;setForm({states:d.allowed_states.join(", "),industries:d.allowed_industries.join(", "),years:d.min_years_in_business?.toString()??"",min:d.min_requested_amount?.toString()??"",max:d.max_requested_amount?.toString()??"",documents:d.required_documents.join(", "),notes:d.notes??"",active:d.active});}},[box.data]);
 async function save(e:FormEvent){e.preventDefault();if(!box.data)return;setBusy(true);setMessage("");try{
  const values=[nullable(form.years),nullable(form.min),nullable(form.max)];if(values.some(v=>v!==null&&(!Number.isFinite(v)||v<0)))throw new Error("Enter valid nonnegative thresholds or leave them unknown.");
  if(values[1]!=null&&values[2]!=null&&values[1]>values[2])throw new Error("Minimum amount cannot exceed maximum.");
  const r=await supabase.from("financing_partner_boxes").update({allowed_states:csv(form.states),allowed_industries:csv(form.industries),min_years_in_business:values[0],min_requested_amount:values[1],max_requested_amount:values[2],required_documents:csv(form.documents),notes:form.notes||null,active:form.active,updated_at:new Date().toISOString()}).eq("client_id",box.data.client_id).eq("partner_id","randall").select("partner_id");
  if(r.error)throw r.error;if(!r.data?.length)throw new Error("Partner settings were not saved.");await qc.invalidateQueries({queryKey:["partner-box"]});setMessage("Partner settings saved.");
 }catch(e){setMessage(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
 async function recordReview(e:FormEvent){e.preventDefault();if(!box.data||!caseId||!comment.trim())return;setBusy(true);setMessage("");try{
  const r=await supabase.from("financing_partner_feedback").insert({client_id:box.data.client_id,partner_id:"randall",case_id:caseId,decision:"reviewed",reason_code:reason||null,partner_comment:comment.trim()});
  if(r.error)throw r.error;setComment("");setReason("");await qc.invalidateQueries({queryKey:["partner-feedback"]});setMessage("Actual partner review recorded.");
 }catch(e){setMessage(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
 const labels={states:"Allowed states (comma-separated)",industries:"Allowed industries",years:"Minimum years in business",min:"Minimum requested amount",max:"Maximum requested amount",documents:"Required documents (comma-separated)",notes:"Partner notes"};
 return <details className="rounded-lg border border-border bg-surface-1 p-5"><summary className="cursor-pointer font-semibold">Partner configuration & feedback</summary>
 <p className="my-3 text-sm text-muted-foreground">Enter only criteria confirmed by Randall. Blank fields stay unknown. Outcomes below reflect recorded human decisions; they do not change the scoring weights automatically.</p>
 {(box.isError||feedback.isError||cases.isError)&&<p role="alert">{box.error?.message||feedback.error?.message||cases.error?.message}</p>}
 {message&&<p role="status" className="my-3 text-sm">{message}</p>}
 {box.data&&<form onSubmit={save} className="grid gap-3 md:grid-cols-2">{Object.entries(labels).map(([k,label])=><label key={k} className="text-xs">{label}<Input className="mt-1" value={form[k as keyof typeof labels]} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})}/>Active partner configuration</label><Button disabled={busy}>Save partner settings</Button></form>}
 <h2 className="mt-6 font-semibold">Partner outcomes</h2><p className="my-2 text-sm text-muted-foreground">Submitted, approved, funded and not-fit stage changes enter this history automatically. Note-only edits do not create another outcome.</p>
 <div className="my-3 flex flex-wrap gap-4 text-sm">{["reviewed","declined","submitted","approved","funded"].map(d=><span key={d}>{d}: {feedback.data?.filter(f=>f.decision===d).length??0}</span>)}</div>
 {!feedback.data?.length?<p className="text-sm text-muted-foreground">No recorded partner outcomes.</p>:<ul className="space-y-2 text-sm">{feedback.data.slice(0,20).map(f=><li key={f.id}>{new Date(f.decided_at).toLocaleDateString()} · {f.decision}{f.reason_code?" · "+f.reason_code:""}{f.partner_comment?" — "+f.partner_comment:""}</li>)}</ul>}
 {!!cases.data?.length&&<form onSubmit={recordReview} className="mt-5 space-y-3"><h3 className="font-semibold">Record an actual partner review</h3><label className="block text-sm">Case<select className="mt-1 w-full rounded border bg-background p-2" required value={caseId} onChange={e=>setCaseId(e.target.value)}><option value="">Choose an existing case</option>{cases.data.map((c:any)=><option key={c.id} value={c.id}>{c.leads?.company||c.leads?.name||c.id} · {c.stage}</option>)}</select></label><Input aria-label="Review reason code" placeholder="Reason code (optional)" value={reason} onChange={e=>setReason(e.target.value)}/><Input required aria-label="Partner review note" placeholder="What Randall actually said" value={comment} onChange={e=>setComment(e.target.value)}/><Button disabled={busy}>Record partner review</Button></form>}
 </details>;
}
