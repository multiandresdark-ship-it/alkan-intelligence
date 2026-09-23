import {useState} from "react";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
import {PartnerOperations} from "./PartnerOperations";
type Candidate={id:string;lead_id:string;company_name:string;priority_score:number;reasons:string[];verification_flags:string[];unknowns:string[];observed_at:string;expires_at:string;next_action:string;status:string};
export function OriginationPanel({onOpenProfile}:{onOpenProfile:(id:string)=>void}){
 const qc=useQueryClient(),[busy,setBusy]=useState(false),[error,setError]=useState(""),[result,setResult]=useState<{counts:Record<string,number>;reasons:Record<string,number>;next_offset:number|null}|null>(null);
 const candidates=useQuery({queryKey:["origination-candidates"],queryFn:async()=>{const r=await supabase.from("financing_candidates").select("*").order("priority_score",{ascending:false}).limit(500);if(r.error)throw r.error;return r.data as Candidate[];}});
 async function evaluate(offset=0){setBusy(true);setError("");try{
  const {data,error}=await supabase.functions.invoke("origination-bridge",{body:{action:"evaluate",offset}});
  if(error){let message=error.message;try{message=(await (error as any).context.json()).error??message;}catch{}throw new Error(message);}
  setResult(data);await Promise.all([qc.invalidateQueries({queryKey:["origination-candidates"]}),qc.invalidateQueries({queryKey:["financing-cases"]})]);
 }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
 return <section className="space-y-5">
 <div className="rounded-xl border border-border bg-surface-1 p-6"><p className="text-xs uppercase tracking-widest text-primary">Origination engine v3</p><h1 className="mt-3 font-display text-4xl">Evidence into the next conversation.</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Ranks businesses for outreach using dated activity and a verified business match. Unresolved permits stay in the evidence desk. This engine does not make financing decisions.</p><Button className="mt-5" disabled={busy} onClick={()=>void evaluate()}>{busy?"Evaluating…":"Evaluate workspace"}</Button></div>
 <p className="text-sm text-muted-foreground">A fresh priority of 75+ with signals and no verification flags can create an empty qualification case. Expired records are marked for re-verification.</p>
 <PartnerOperations/>
 {(error||candidates.isError)&&<p role="alert" className="text-destructive">{error||candidates.error?.message}</p>}
 {result&&<div role="status" className="rounded-lg border border-border p-4"><p>{Object.entries(result.counts).map(([k,v])=>k.replaceAll("_"," ")+": "+v).join(" · ")}</p>{Object.entries(result.reasons).map(([k,v])=><p key={k} className="mt-2 text-sm text-muted-foreground">{k}: {v}</p>)}{result.next_offset!==null&&<Button className="mt-3" disabled={busy} onClick={()=>void evaluate(result.next_offset!)}>Evaluate next 50 records</Button>}</div>}
 {candidates.isPending?<p>Loading candidates…</p>:!candidates.data?.length?<div className="rounded-lg border border-border p-6"><h2 className="font-semibold">No evaluated businesses yet</h2><p className="mt-2 text-sm text-muted-foreground">The motor needs a resolved company and a dated activity snapshot. An extracted phone alone does not establish a business match or financing need.</p></div>:candidates.data.map(c=><article key={c.id} className="rounded-lg border border-border bg-surface-1 p-5"><div className="flex justify-between"><h2 className="font-semibold">{c.company_name}</h2><strong>{c.priority_score}/100 · outreach</strong></div><p className="mt-2 text-xs text-muted-foreground">{Date.parse(c.expires_at)<=Date.now()?"Expired":c.status} · observed {new Date(c.observed_at).toLocaleDateString()} · expires {new Date(c.expires_at).toLocaleDateString()}</p><ul className="my-3 list-disc pl-5 text-sm">{c.reasons.map((r,i)=><li key={i}>{r}</li>)}</ul>{c.verification_flags.map((r,i)=><p key={i} className="text-sm text-destructive">{r}</p>)}<p className="mt-2 text-sm">{Date.parse(c.expires_at)<=Date.now()?"Reverify dated activity before outreach.":c.next_action}</p><details className="my-3 text-sm"><summary>Questions to confirm</summary><ul className="list-disc pl-5">{c.unknowns.map((r,i)=><li key={i}>{r}</li>)}</ul></details><Button variant="outline" onClick={()=>onOpenProfile(c.lead_id)}>Open source evidence</Button></article>)}
 </section>;
}
