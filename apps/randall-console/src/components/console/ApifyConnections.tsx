import {useState} from "react";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
import {toast} from "sonner";
type Actor={actor_id:string;kind:string;label:string};
type Run={id:string;actor_id:string;status:string;started_at:string;finished_at:string|null};
type Preview={run:Run;offset:number;next_offset:number|null;total_items:number;page_items:number;records:{index:number;title:string|null;permit_number:string|null;source_url:string|null;observed_at:string|null;skip:string|null}[];notice:string};
async function call<T>(body:Record<string,unknown>):Promise<T>{
 const {data:session}=await supabase.auth.getSession();
 if(!session.session)throw new Error("Sign in again.");
 const {data,error}=await supabase.functions.invoke("apify-bridge",{body,headers:{Authorization:"Bearer "+session.session.access_token}});
 if(error){let message=error.message;try{const payload=await (error as any).context?.json();message=payload?.error??message;}catch{}throw new Error(message);}
 if(data?.error)throw new Error(data.error);return data as T;
}
export function ApifyConnections(){
 const qc=useQueryClient();const [actorId,setActorId]=useState(""),[runId,setRunId]=useState(""),[preview,setPreview]=useState<Preview|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[result,setResult]=useState<Record<string,number>|null>(null);
 const connections=useQuery({queryKey:["apify-connections"],queryFn:()=>call<{configured:boolean;actors:Actor[]}>({action:"connections"}),retry:false});
 const runs=useQuery({queryKey:["apify-runs",actorId],queryFn:()=>call<{runs:Run[]}>({action:"runs",actor_id:actorId}),enabled:Boolean(actorId&&connections.data?.configured),retry:false});
 async function inspect(offset=0){setBusy(true);setError("");setResult(null);try{setPreview(await call<Preview>({action:"preview",run_id:runId,offset}));}catch(e){setError(e instanceof Error?e.message:String(e));setPreview(null);}finally{setBusy(false);}}
 async function importPage(){if(!preview)return;setBusy(true);setError("");try{const r=await call<{counts:Record<string,number>}>({action:"import",run_id:runId,offset:preview.offset});setResult(r.counts);await qc.invalidateQueries({queryKey:["leads"]});toast.success("Actor results imported as source evidence.");}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
 const selected=connections.data?.actors.find(a=>a.actor_id===actorId);
 return <div className="space-y-6">
 <header className="rounded-xl border border-border bg-surface-1 p-6"><p className="text-xs uppercase tracking-[.2em] text-primary">Source operations</p><h1 className="mt-3 font-display text-4xl">Connect the work already done.</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Review completed Apify runs and bring their evidence into this workspace. Imported records remain unverified until reviewed. Importing does not start a paid actor run.</p></header>
 <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Connected actors</h2><Button variant="outline" disabled={busy} onClick={()=>{void connections.refetch();if(actorId)void runs.refetch();}}>Refresh connections</Button></div>
 {connections.isPending&&<p role="status">Checking actor connections…</p>}
 {connections.isError&&<p role="alert" className="text-destructive">{connections.error.message}</p>}
 {connections.data&&!connections.data.configured&&<div role="alert" className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">The backend needs its Apify connection key. Ask your ALKAN administrator to finish the connection, then refresh.</div>}
 {connections.data?.actors.length===0&&<p>No actors are assigned to this workspace.</p>}
 <div className="grid gap-3 lg:grid-cols-3">{connections.data?.actors.map(a=><button key={a.actor_id} disabled={busy} onClick={()=>{setActorId(a.actor_id);setRunId("");setPreview(null);setResult(null);setError("");}} className={"rounded-lg border bg-surface-1 p-5 text-left "+(a.actor_id===actorId?"border-primary":"border-border")}><p className="text-xs uppercase tracking-wide text-muted-foreground">{a.kind}</p><h3 className="mt-2 font-semibold">{a.label}</h3><p className="mt-3 text-xs text-muted-foreground">{a.kind==="accela"?"Legacy extraction · document review required":"Evidence source · qualification stays separate"}</p></button>)}</div>
 {selected&&<section className="space-y-4 rounded-lg border border-border bg-surface-1 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{selected.label}</h2><a className="text-sm text-primary underline" href={"https://console.apify.com/actors/"+actorId} target="_blank" rel="noopener noreferrer">Open actor in Apify</a></div>
 {runs.isPending&&connections.data?.configured&&<p role="status">Loading runs…</p>}
 {runs.isError&&<p role="alert" className="text-destructive">{runs.error.message}</p>}
 <label className="block text-sm" htmlFor="apify-run">Completed run</label>
 <select id="apify-run" className="w-full rounded-md border border-border bg-background p-3 text-sm" value={runId} onChange={e=>{setRunId(e.target.value);setPreview(null);setResult(null);setError("");}} disabled={busy}><option value="">Choose a run</option>{runs.data?.runs.map(r=><option key={r.id} value={r.id} disabled={r.status!=="SUCCEEDED"}>{new Date(r.started_at).toLocaleString()} · {r.status} · {r.id}</option>)}</select>
 {runs.data?.runs.length===0&&<p>No recent runs were found.</p>}
 {runs.data&&runs.data.runs.length>0&&!runs.data.runs.some(r=>r.status==="SUCCEEDED")&&<p className="text-sm text-muted-foreground">No successful run is available. Review the failed runs in Apify before importing new results.</p>}
 <Button disabled={!runId||busy} onClick={()=>void inspect()}>Preview results</Button>
 </section>}
 {error&&<p role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">{error}</p>}
 {preview&&<section className="space-y-4 rounded-lg border border-border bg-surface-1 p-5"><div className="flex flex-wrap justify-between gap-3"><h2 className="font-semibold">Review before importing</h2><span className="text-xs text-muted-foreground">{preview.page_items} rows · starting at {preview.offset+1}{preview.total_items? " · "+preview.total_items+" total":""}</span></div><p className="text-sm text-muted-foreground">{preview.notice}</p>
 <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-border"><th className="p-2">Business / permit</th><th className="p-2">Observed</th><th className="p-2">Review</th></tr></thead><tbody>{preview.records.map(r=><tr key={r.index} className="border-b border-border"><td className="p-2">{r.title??"Skipped row"}{r.source_url&&<a className="ml-2 text-primary underline" href={r.source_url} target="_blank" rel="noopener noreferrer">Source</a>}</td><td className="p-2">{r.observed_at?new Date(r.observed_at).toLocaleDateString():"Unknown"}</td><td className="p-2">{r.skip??(selected?.kind==="digital"?"Matches an existing business only":"Unverified evidence")}</td></tr>)}</tbody></table></div>
 <div className="flex flex-wrap gap-3"><Button disabled={busy||!preview.records.some(r=>!r.skip)} onClick={()=>void importPage()}>{busy?"Processing…":"Import this page"}</Button>{preview.next_offset!==null&&<Button variant="outline" disabled={busy} onClick={()=>void inspect(preview.next_offset!)}>Preview next page</Button>}</div>
 {result&&<p role="status" className="rounded-md bg-primary/5 p-3 text-sm">{Object.entries(result).map(([k,v])=>k.replaceAll("_"," ")+": "+v).join(" · ")}</p>}
 </section>}
 </div>;
}
