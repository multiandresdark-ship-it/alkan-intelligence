import React, { useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { Toaster, toast } from "sonner";
import { ShieldCheck, Building2, ExternalLink, Radar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getLeads, getWorkspace, type EvidenceLead } from "@/lib/partner-data";
import { ConsoleProvider, useConsole } from "@/components/console/console-context";
import { AppSidebar } from "@/components/console/AppSidebar";
import { Topbar } from "@/components/console/Topbar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import {ContactEvidence} from "@/components/console/ContactEvidence";
const OriginationPanel = React.lazy(() => import("@/components/console/OriginationPanel").then(m=>({default:m.OriginationPanel})));
const ApifyConnections = React.lazy(() => import("@/components/console/ApifyConnections").then(m=>({default:m.ApifyConnections})));
const FundingRadarPanel = React.lazy(() => import("@/components/console/FinancingWorkspace").then(m => ({default:m.FundingRadarPanel})));
const QualificationQueuePanel = React.lazy(() => import("@/components/console/FinancingWorkspace").then(m => ({default:m.QualificationQueuePanel})));
const DealPipelinePanel = React.lazy(() => import("@/components/console/FinancingWorkspace").then(m => ({default:m.DealPipelinePanel})));
const PortfolioPanel = React.lazy(() => import("@/components/console/FinancingWorkspace").then(m => ({default:m.PortfolioPanel})));
import { SectionErrorBoundary } from "@/components/console/SectionErrorBoundary";
import { RandallDashboard, RandallPilotFundingRadar } from "@/components/console/RandallPilot25";
import { ErrorBanner, EmptyState } from "@/components/console/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
const PartnerIntake = React.lazy(() => import("@/components/console/PartnerFollowUp").then(m=>({default:m.PartnerIntake})));
const FollowUpDesk = React.lazy(() => import("@/components/console/PartnerFollowUp").then(m=>({default:m.FollowUpDesk})));
import "./styles.css";

const qc = new QueryClient({defaultOptions:{queries:{retry:1,staleTime:30_000,refetchOnWindowFocus:true}}});
function Auth({onReady}:{onReady:(session:Session|null)=>void}) {
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 async function submit(e:FormEvent){ e.preventDefault();setBusy(true);setError("");try{
  const {data,error}=await supabase.auth.signInWithPassword({email,password});
  if(error)throw error;onReady(data.session);
 }catch(e){setError(e instanceof Error?e.message:"Sign-in failed");}finally{setBusy(false);}}
 return <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
 <section className="flex flex-col justify-between bg-sidebar px-8 py-12 text-sidebar-foreground lg:px-20">
 <p className="text-sm font-semibold tracking-[0.3em] text-sidebar-primary">ALKAN / RANDALL</p>
 <div className="max-w-xl py-14"><p className="text-xs uppercase tracking-[0.2em] text-sidebar-primary">Financing intelligence</p><h1 className="mt-6 font-display text-5xl leading-tight lg:text-7xl">A better first conversation.</h1><p className="mt-6 max-w-md text-sm leading-7 text-sidebar-foreground/65">Discover active businesses. Verify the opportunity. Keep every confirmed fact and partner decision in one workspace.</p></div>
 <div className="grid grid-cols-3 gap-4 border-t border-white/15 pt-6 text-xs"><p>01<br/><span className="mt-2 block text-sidebar-foreground/50">Evidence</span></p><p>02<br/><span className="mt-2 block text-sidebar-foreground/50">Qualification</span></p><p>03<br/><span className="mt-2 block text-sidebar-foreground/50">Partner review</span></p></div>
 </section>
 <section className="flex items-center justify-center px-6 py-12"><div className="w-full max-w-sm"><ShieldCheck className="h-8 w-8 text-primary"/><h2 className="mt-6 text-2xl font-semibold">Your partner workspace</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Sign in with your ALKAN account. Access follows your assigned client workspace.</p>
 <form onSubmit={submit} className="mt-8 space-y-4"><div><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" required/></div><div><Label htmlFor="password">Password</Label><Input id="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/></div>{error&&<p role="alert" className="text-sm text-risk-critical">{error}</p>}<Button className="w-full" disabled={busy}>{busy?"Signing in…":"Open workspace"}</Button></form>
 <p className="mt-6 text-xs leading-5 text-muted-foreground">Need access? Ask your ALKAN administrator to assign your account to a client workspace.</p>
 </div></section></main>;
}
function safeUrl(value:unknown){if(typeof value!=="string")return null;try{const u=new URL(value);return ["https:","http:"].includes(u.protocol)?u.href:null;}catch{return null;}}
function EvidenceValue({value,depth=0}:{value:unknown;depth?:number}):React.ReactNode {
 if(value==null||value==="")return <span className="text-muted-foreground">Unknown</span>;
 const url=safeUrl(value);
 if(url)return <a href={url} target="_blank" rel="noopener noreferrer" className="break-all text-tier-a underline">{url}<ExternalLink className="ml-1 inline h-3 w-3"/></a>;
 if(typeof value==="boolean")return <span>{value?"Yes":"No"}</span>;
 if(typeof value!=="object")return <span className="break-words">{String(value)}</span>;
 if(depth>4)return <pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(value,null,2)}</pre>;
 if(Array.isArray(value))return <ul className="space-y-2">{value.map((v,i)=><li key={i}><EvidenceValue value={v} depth={depth+1}/></li>)}</ul>;
 return <dl className="space-y-3">{Object.entries(value).map(([key,v])=><div key={key} className="border-l border-border pl-3"><dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{key.replace(/_/g," ")}</dt><dd className="mt-1 text-sm"><EvidenceValue value={v} depth={depth+1}/></dd></div>)}</dl>;
}
function Evidence({leads,selected,onSelect}:{leads:EvidenceLead[];selected:string|null;onSelect:(id:string|null)=>void}) {
 const {search,section}=useConsole(); const q=search.trim().toLowerCase();
 const rows=leads.filter(l=>[l.company,l.name,l.city,l.trade,l.permit_number].some(v=>v?.toLowerCase().includes(q)));
 const lead=leads.find(l=>l.id===selected);
 return <><div className="space-y-4"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-primary">Source evidence</p><h1 className="mt-2 font-display text-4xl">{section==="project_intelligence"?"Projects & owner evidence":"Business intelligence"}</h1><p className="mt-2 text-sm text-muted-foreground">Recorded source material and enrichment. Missing facts remain unknown.</p></div><p className="text-xs text-muted-foreground">{rows.length} source records</p></div>
 <div className="grid gap-3 xl:grid-cols-2">{rows.map(l=><button key={l.id} onClick={()=>onSelect(l.id)} className="rounded-lg border border-border bg-surface-1 p-5 text-left hover:border-primary"><div className="flex justify-between gap-3"><h2 className="font-semibold">{l.company||l.name||"Unnamed business"}</h2><Building2 className="h-4 w-4 text-primary"/></div><p className="mt-1 text-xs text-muted-foreground">{[l.city,l.trade].filter(Boolean).join(" · ")||"Location / trade unknown"}</p><div className="mt-3"><ContactEvidence evidence={l.evidence} compact/></div><p className="mt-4 text-sm">{l.credit_hooks[0]||l.capital_reason||"No financing signal recorded"}</p><div className="mt-5 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>{l.permit_number? "Permit "+l.permit_number:"No linked permit"}</span><span>{l.analyzed_at?"Analyzed "+new Date(l.analyzed_at).toLocaleDateString():"Not analyzed"}</span></div></button>)}</div>{rows.length===0&&<EmptyState icon={Building2} title="No matching source records" description="Clear the search or wait for the motor to supply source records."/>}</div>
 <Dialog open={Boolean(lead)} onOpenChange={v=>!v&&onSelect(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{lead?.company||lead?.name||"Business evidence"}</DialogTitle><DialogDescription>Evidence from the motor. These records do not confirm borrower need, revenue or a financing decision.</DialogDescription></DialogHeader>{lead&&<div className="space-y-6">{lead.source?.startsWith("apify_")&&<p className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">Unverified source extraction. Review the original evidence before relying on owner names, contact roles or project details.</p>}<div className="grid gap-3 sm:grid-cols-3">{[["Recorded name",lead.name],["Confirmed phone",lead.phone],["Email",lead.email],["License",lead.license_number],["Source",lead.source],["Last record update",lead.updated_at?new Date(lead.updated_at).toLocaleString():null]].map(([label,value])=><div key={label} className="rounded border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-all text-sm">{value||"Unknown"}</p></div>)}</div><section><h3 className="mb-3 font-semibold">Phones found in source evidence</h3><ContactEvidence evidence={lead.evidence}/></section><section><h3 className="mb-3 font-semibold">Enrichment & business evidence</h3><EvidenceValue value={lead.evidence}/></section><section><h3 className="mb-3 font-semibold">Project / permit evidence</h3><EvidenceValue value={lead.permit}/></section>{lead.notes&&<section><h3 className="mb-2 font-semibold">Source notes</h3><p className="whitespace-pre-wrap text-sm">{lead.notes}</p></section>}</div>}</DialogContent></Dialog></>;
}
function Analytics({leads}:{leads:EvidenceLead[]}) {
 const scored=leads.filter(l=>l.credit_ruta);const groups=new Map<string,number>();for(const l of leads)groups.set(l.jurisdiction||"Unknown",(groups.get(l.jurisdiction||"Unknown")??0)+1);
 return <div className="space-y-5"><h1 className="font-display text-4xl">Evidence coverage</h1><p className="text-sm text-muted-foreground">Coverage of the records visible to your workspace. This is not an underwriting model.</p><div className="grid gap-4 sm:grid-cols-3">{[["Source records",leads.length],["With financing signals",scored.length],["Missing signals",leads.length-scored.length]].map(([label,value])=><Card key={label}><CardContent className="pt-5"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-3 text-3xl font-semibold">{value}</p></CardContent></Card>)}</div><Card><CardHeader><CardTitle>Source jurisdictions</CardTitle></CardHeader><CardContent className="space-y-4">{[...groups].sort((a,b)=>b[1]-a[1]).map(([name,count])=><div key={name}><div className="mb-2 flex justify-between text-sm"><span>{name}</span><span>{count}</span></div><div className="h-2 bg-surface-2"><div className="h-2 bg-primary" style={{width:leads.length?(count/leads.length*100)+"%":"0%"}}/></div></div>)}</CardContent></Card></div>;
}
function Workspace(){
 const {section,setSection,search,setSearch,setLastUpdated}=useConsole();
 const [selected,setSelected]=useState<string|null>(null);
 const client=useQuery({queryKey:["workspace"],queryFn:getWorkspace});
 const leads=useQuery({queryKey:["leads"],queryFn:getLeads,enabled:Boolean(client.data)});
 useEffect(()=>{if(leads.dataUpdatedAt)setLastUpdated(new Date(leads.dataUpdatedAt));},[leads.dataUpdatedAt,setLastUpdated]);
 function openEvidence(id:string){setSection("business_intelligence");setSelected(id);}
 return <SidebarProvider><div className="flex min-h-screen w-full"><AppSidebar/><SidebarInset className="min-w-0 bg-background"><Topbar/><main className="min-w-0 p-4 md:p-7"><div className="mb-4 sm:hidden"><Input aria-label="Search workspace" placeholder="Search businesses…" value={search} onChange={e=>setSearch(e.target.value)}/></div><SectionErrorBoundary key={section}>
 {client.isPending?<p role="status">Checking workspace access…</p>:client.isError?<ErrorBanner error={client.error} onRetry={()=>void client.refetch()}/>:!client.data?<EmptyState icon={ShieldCheck} title="Workspace access is not assigned" description="Your account is signed in, but an ALKAN administrator must assign your client workspace before records are available."/>:<>
 {leads.isError&&section!=="funding_radar"&&<ErrorBanner error={leads.error} onRetry={()=>void leads.refetch()}/>}
 {section==="dashboard"&&<RandallDashboard/>}
 {section==="apify"&&<ApifyConnections/>}
 {section==="follow_up"&&<FollowUpDesk/>}
 {section==="funding_radar"&&<div className="space-y-6"><RandallPilotFundingRadar/><details className="rounded-lg border border-border bg-surface-1 p-4"><summary className="cursor-pointer text-sm font-medium">Live engine queue & evaluation</summary><div className="mt-5"><OriginationPanel onOpenProfile={openEvidence}/></div></details><details className="rounded-lg border border-border bg-surface-1 p-4"><summary className="cursor-pointer text-sm text-muted-foreground">Legacy financing signals</summary><div className="mt-5"><FundingRadarPanel leads={leads.data??[]} isLoading={leads.isPending} isError={leads.isError} error={leads.error} onRetry={()=>void leads.refetch()} onOpenProfile={openEvidence}/></div></details></div>}
 {section==="qualification"&&(leads.isPending?<p role="status">Loading qualification queue…</p>:<QualificationQueuePanel leads={leads.data??[]}/>)}
 {section==="deal_pipeline"&&<DealPipelinePanel/>}{section==="portfolio"&&<PortfolioPanel/>}
 {["business_intelligence","project_intelligence"].includes(section)&&<Evidence leads={leads.data??[]} selected={selected} onSelect={setSelected}/>}
 {section==="market_analytics"&&<Analytics leads={leads.data??[]}/>}
 </>}
 </SectionErrorBoundary></main></SidebarInset></div></SidebarProvider>;
}
function App(){
 const [session,setSession]=useState<Session|null>(null),[ready,setReady]=useState(false),[error,setError]=useState("");
 useEffect(()=>{let active=true;supabase.auth.getSession().then(({data,error})=>{if(!active)return;if(error)setError(error.message);setSession(data.session);setReady(true);}).catch(e=>{if(active){setError(String(e));setReady(true);}});
 const {data}=supabase.auth.onAuthStateChange((_event,next)=>{if(active){if(!next)qc.clear();setSession(next);setReady(true);}});
 return()=>{active=false;data.subscription.unsubscribe();};},[]);
 if(!ready)return <p role="status" className="p-8">Verifying access…</p>;
 if(error)return <div className="p-8"><ErrorBanner error={error} onRetry={()=>window.location.reload()}/></div>;
 return <>{session?<ConsoleProvider><React.Suspense fallback={<p role="status" className="p-8">Loading workspace…</p>}><Workspace/></React.Suspense></ConsoleProvider>:<Auth onReady={setSession}/>}<Toaster richColors/></>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><QueryClientProvider client={qc}><App/></QueryClientProvider></React.StrictMode>);
