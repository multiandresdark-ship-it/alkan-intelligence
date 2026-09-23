import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getWorkspace } from "@/lib/partner-data";
import { listFinancingCases, FINANCING_STAGE_LABELS, type FinancingCase } from "@/lib/financing/financing.functions";
import { CaseEditor } from "@/components/console/FinancingWorkspace";
import { useConsole } from "@/components/console/console-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorBanner } from "@/components/console/states";
export function PartnerIntake() {
 const [open,setOpen]=useState(false);
 const [company,setCompany]=useState(""),[name,setName]=useState(""),[email,setEmail]=useState(""),[phone,setPhone]=useState(""),[notes,setNotes]=useState("");
 const qc=useQueryClient();const {setSection}=useConsole();
 const save=useMutation({mutationFn:async()=>{
  const clientId=await getWorkspace();if(!clientId)throw new Error("Your account needs a workspace assignment.");
  const {data:existing,error:lookupError}=await supabase.from("leads").select("id").eq("client_id",clientId).eq("company",company.trim()).limit(1);
  if(lookupError)throw new Error(lookupError.message);if(existing?.length)throw new Error("This business is already in your workspace. Search for it in the qualification queue.");
  const {error}=await supabase.from("leads").insert({client_id:clientId,company:company.trim(),name:name.trim()||null,email:email.trim()||null,phone:phone.trim()||null,notes:notes.trim()||null,source:"randall_existing_contact",status:"new"});
  if(error)throw new Error(error.message);
 },onSuccess:async()=>{await qc.invalidateQueries({queryKey:["leads"]});setOpen(false);setCompany("");setName("");setEmail("");setPhone("");setNotes("");setSection("qualification");toast.success("Partner contact added. Confirm the need before qualifying.");}});
 return <><Button variant="outline" onClick={()=>{save.reset();setOpen(true);}}><Plus className="mr-2 h-4 w-4"/>Add partner contact</Button><Dialog open={open} onOpenChange={v=>!save.isPending&&setOpen(v)}><DialogContent><DialogHeader><DialogTitle>Add an existing partner contact</DialogTitle><DialogDescription>Start follow-up with a business already known to Randall. No public-data score or financing facts will be invented.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={e=>{e.preventDefault();save.mutate();}}>
 {([["intake-company","Business",company,setCompany,"text",true],["intake-name","Contact name",name,setName,"text",false],["intake-email","Email",email,setEmail,"email",false],["intake-phone","Phone",phone,setPhone,"tel",false]] as const).map(([id,label,value,set,type,required])=><div key={id}><Label htmlFor={id}>{label}</Label><Input id={id} value={value} onChange={e=>set(e.target.value)} type={type} required={required} maxLength={300}/></div>)}
 <div><Label htmlFor="intake-notes">Context / previous relationship</Label><Textarea id="intake-notes" value={notes} onChange={e=>setNotes(e.target.value)} maxLength={2000}/></div>
 {save.isError&&<p role="alert" className="text-sm text-risk-critical">{save.error.message}</p>}<Button disabled={save.isPending||!company.trim()}>{save.isPending?"Adding…":"Add to qualification queue"}</Button></form></DialogContent></Dialog></>;
}
export function FollowUpDesk() {
 const {search}=useConsole();const [filter,setFilter]=useState<"due"|"scheduled"|"unscheduled">("due");
 const [selected,setSelected]=useState<FinancingCase|null>(null);
 const cases=useQuery({queryKey:["financing-cases"],queryFn:listFinancingCases});
 const active=(cases.data??[]).filter(c=>c.stage!=="not_fit"&&[c.company,c.owner_name,c.next_action].some(v=>v?.toLowerCase().includes(search.toLowerCase())));
 const endOfDay=new Date();endOfDay.setHours(23,59,59,999);
 const groups={due:active.filter(c=>c.follow_up_at&&Date.parse(c.follow_up_at)<=endOfDay.getTime()),scheduled:active.filter(c=>c.follow_up_at),unscheduled:active.filter(c=>!c.follow_up_at)};
 const visible=[...groups[filter]].sort((a,b)=>(a.follow_up_at?Date.parse(a.follow_up_at):Infinity)-(b.follow_up_at?Date.parse(b.follow_up_at):Infinity));
 return <div className="space-y-5"><div><p className="text-xs uppercase tracking-widest text-primary">Existing relationships · new opportunities</p><h1 className="mt-2 font-display text-4xl">No next step left to memory.</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Open a case, record what happened and set the next action. This desk includes qualified prospects, dormant relationships and funded clients with a follow-up date.</p></div>
 <div className="flex flex-wrap gap-2">{(["due","scheduled","unscheduled"] as const).map(f=><Button key={f} variant={filter===f?"default":"outline"} onClick={()=>setFilter(f)}>{f==="due"?"Due today / overdue":f==="scheduled"?"All scheduled":"Needs a date"} · {groups[f].length}</Button>)}</div>
 {cases.isError&&<ErrorBanner error={cases.error} onRetry={()=>void cases.refetch()}/>}
 {cases.isPending&&<p role="status">Loading follow-ups…</p>}
 <div className="grid gap-3 xl:grid-cols-2">{visible.map(c=><Card key={c.id}><CardHeader><div className="flex justify-between gap-3"><CardTitle className="text-base">{c.company||c.owner_name||"Unnamed business"}</CardTitle><span className="text-xs text-muted-foreground">{FINANCING_STAGE_LABELS[c.stage]}</span></div></CardHeader><CardContent><p className="text-sm">{c.next_action||"Define the next action"}</p><p className="mt-2 text-xs text-muted-foreground">{c.follow_up_at?new Date(c.follow_up_at).toLocaleString():"No follow-up date"}</p><div className="mt-5 flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{c.phone||"Phone unknown"}</span><Button size="sm" onClick={()=>setSelected(c)}>Record follow-up</Button></div></CardContent></Card>)}</div>
 {cases.isSuccess&&!visible.length&&<EmptyState icon={CalendarClock} title="No follow-ups in this view" description="Add an existing partner contact or schedule the next action from a qualification case."/>}
 <CaseEditor selected={selected} onClose={()=>setSelected(null)}/></div>;
}
