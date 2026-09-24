import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Radar, Search, ShieldCheck, UsersRound } from "lucide-react";
import { useConsole } from "@/components/console/console-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type PilotStatus = "REVIEW" | "HOLD";
type PilotRow = {
  rank:number; company:string; ubi:string; license:string; phone:string; city:string;
  principal:string; licenseStatus:string; workersComp:boolean|null; workers:string;
  evidence:number; status:PilotStatus; note:string;
};

export const RANDALL_PILOT_25: PilotRow[] = [{"rank":1,"company":"PNW POST FRAME LLC","ubi":"604893720","license":"PNWPOPF783J7","phone":"5094649306","city":"COLBERT","principal":"LEWIS, JENSEN","licenseStatus":"ACTIVE","workersComp":true,"workers":"4 to 6 workers","evidence":83,"status":"REVIEW","note":"Identity verified; no current public activity trigger was promoted in this run."},{"rank":2,"company":"MIRANDA METAL BUILDINGS LLC","ubi":"604940637","license":"MIRANMB781MH","phone":"5416677226","city":"IRRIGON","principal":"MIRANDA, RAYMUNDO RIOS","licenseStatus":"ACTIVE","workersComp":true,"workers":"Less than 1 workers","evidence":68,"status":"REVIEW","note":"Identity verified; no current public activity trigger was promoted in this run."},{"rank":3,"company":"LYNDEN SHEET METAL INC","ubi":"600349811","license":"LYNDESM800PB","phone":"3603543991","city":"LYNDEN","principal":"Kreider, Bobbi J","licenseStatus":"ACTIVE","workersComp":true,"workers":"76 to 100 workers","evidence":68,"status":"REVIEW","note":"Identity verified; no current public activity trigger was promoted in this run."},{"rank":4,"company":"HEAVY METAL CARPORTS LLC","ubi":"604674528","license":"HEAVYMC798PG","phone":"5414495019","city":"Hermiston","principal":"GARCIA GARCIA, JOSE OMAR","licenseStatus":"ACTIVE","workersComp":false,"workers":"N/A","evidence":68,"status":"HOLD","note":"Workers' comp is not current; verify before outreach."},{"rank":5,"company":"NORTHWEST FRAMING PROS LLC","ubi":"605369155","license":"NORTHFP762DL","phone":"6783380185","city":"TACOMA","principal":"HENRIQUEZ, JOSHUE","licenseStatus":"ACTIVE","workersComp":true,"workers":"11 to 20 workers","evidence":68,"status":"REVIEW","note":"Identity verified; no current public activity trigger was promoted in this run."},{"rank":6,"company":"J & M FABRICATION LLC","ubi":"602139030","license":"JMFABFL782PC","phone":"5099932890","city":"MEDICAL LAKE","principal":"MILLER, JUSTIN ARE","licenseStatus":"ACTIVE","workersComp":true,"workers":"21 to 30 workers","evidence":68,"status":"REVIEW","note":"Identity verified; no current public activity trigger was promoted in this run."},{"rank":7,"company":"HALL OF FRAMERS CONST INC","ubi":"604842931","license":"HALLFFC785M8","phone":"2532121766","city":"LAKEWOOD","principal":"TARTAGLIA, BRANDON JAMES","licenseStatus":"ACTIVE","workersComp":true,"workers":"0 workers","evidence":68,"status":"REVIEW","note":"Identity verified; no current public activity trigger was promoted in this run."},{"rank":8,"company":"ALPHA RAILING COMPANY","ubi":"604770821","license":"ALPHARC798NC","phone":"2534411232","city":"OLYMPIA","principal":"DUNN, MATTHEW SCOTT","licenseStatus":"ACTIVE","workersComp":true,"workers":"4 to 6 workers","evidence":68,"status":"REVIEW","note":"Identity verified; no current public activity trigger was promoted in this run."},{"rank":9,"company":"KAIZEN CUSTOM RAILING LLC","ubi":"605396578","license":"KAIZECR763DF","phone":"7037253869","city":"Ferndale","principal":"MASIWEMAI, JOHN KISA","licenseStatus":"ACTIVE","workersComp":null,"workers":"Unknown","evidence":68,"status":"REVIEW","note":"Identity verified; no current public activity trigger was promoted in this run."},{"rank":10,"company":"PROBUILT METAL BUILDINGS","ubi":"605257599","license":"PROBUMB777L6","phone":"2533246607","city":"PUYALLUP","principal":"FINCH, BRANDON LEE","licenseStatus":"ACTIVE","workersComp":null,"workers":"Unknown","evidence":68,"status":"REVIEW","note":"Identity verified; no current public activity trigger was promoted in this run."},{"rank":11,"company":"MEYER METALS LLC","ubi":"604689680","license":"MEYERML790CA","phone":"3603227358","city":"MARYSVILLE","principal":"MEYER, TYLER CHARLES","licenseStatus":"ACTIVE","workersComp":true,"workers":"11 to 20 workers","evidence":68,"status":"REVIEW","note":"Identity verified; no current public activity trigger was promoted in this run."},{"rank":12,"company":"CUSTOM WELDING & FAB INC","ubi":"600464803","license":"CUSTOWF765BU","phone":"5093530664","city":"SPOKANE","principal":"BEHAR, SHERRI M","licenseStatus":"ACTIVE","workersComp":true,"workers":"1 to 3 workers","evidence":68,"status":"REVIEW","note":"Identity verified; no current public activity trigger was promoted in this run."},{"rank":13,"company":"AMC FRAMING LLC","ubi":"604548723","license":"AMCFRFL772DB","phone":"2062226903","city":"CLINTON","principal":"CORTES, ADRIAN MANUEL","licenseStatus":"ACTIVE","workersComp":true,"workers":"Less than 1 workers","evidence":68,"status":"REVIEW","note":"Identity verified; no current public activity trigger was promoted in this run."},{"rank":14,"company":"Alex Fabrication & Welding LLC","ubi":"604946154","license":"ALEXFFW773DN","phone":"2062319215","city":"DES MOINES","principal":"AMAYA GOMEZ, ALEX ORLANDO","licenseStatus":"ACTIVE","workersComp":false,"workers":"N/A","evidence":68,"status":"HOLD","note":"Workers' comp is not current; verify before outreach."},{"rank":15,"company":"EASTMOND FRAMING LLC","ubi":"605287659","license":"EASTMFL770N1","phone":"4253219722","city":"EVERETT","principal":"MERCADO, BRYAN","licenseStatus":"ACTIVE","workersComp":false,"workers":"Incomplete premium report received.","evidence":68,"status":"HOLD","note":"Workers' comp is not current; verify before outreach."},{"rank":16,"company":"HUIZAR'S FRAMING LLC","ubi":"604961559","license":"HUIZAFL781QM","phone":"2533534282","city":"TACOMA","principal":"HUIZAR AVILA, RENE ALEJANDRO","licenseStatus":"ACTIVE","workersComp":true,"workers":"1 to 3 workers","evidence":68,"status":"REVIEW","note":"Identity verified; no current public activity trigger was promoted in this run."},{"rank":17,"company":"ELITE FRAMING CONSTRUCTION","ubi":"605173316","license":"ELITEFC776KH","phone":"2538880371","city":"TACOMA","principal":"RODRIGUEZ ALEGRIA, OSCAR","licenseStatus":"ACTIVE","workersComp":true,"workers":"0 workers","evidence":68,"status":"REVIEW","note":"Identity verified; no current public activity trigger was promoted in this run."},{"rank":18,"company":"H A FRAMING LLC","ubi":"605323458","license":"HAFRAFL773O1","phone":"4252314808","city":"Everett","principal":"JARA, MELINA ANDREA","licenseStatus":"SUSPENDED","workersComp":true,"workers":"0 workers","evidence":68,"status":"HOLD","note":"License suspended; resolve status before outreach."},{"rank":19,"company":"ARC MOBILE WELDING INC","ubi":"604638860","license":"ARCMOMW806Q1","phone":"2088193175","city":"COEUR D ALENE","principal":"MOORE, KEVIN DOUGLAS","licenseStatus":"ACTIVE","workersComp":null,"workers":"Unknown","evidence":68,"status":"REVIEW","note":"Identity verified; no current public activity trigger was promoted in this run."},{"rank":20,"company":"KITSAP METAL AND DESIGN LLC","ubi":"604867097","license":"KITSAMD785LB","phone":"5642328484","city":"KINGSTON","principal":"JAMES, KYLE","licenseStatus":"ACTIVE","workersComp":false,"workers":"Incomplete premium report received.","evidence":68,"status":"HOLD","note":"Workers' comp is not current; verify before outreach."},{"rank":21,"company":"EAGLE WELDING LLC","ubi":"605246673","license":"EAGLEWL779OE","phone":"2533352310","city":"PUYALLUP","principal":"FLORES APARICIO, RAUL","licenseStatus":"ACTIVE","workersComp":true,"workers":"Less than 1 workers","evidence":68,"status":"REVIEW","note":"Identity verified; no current public activity trigger was promoted in this run."},{"rank":22,"company":"JJ & KL CHAVEZ WELDING LLC","ubi":"605161514","license":"JJKLCKC774KT","phone":"2068522611","city":"AUBURN","principal":"CHAVEZ, JESUS A","licenseStatus":"ACTIVE","workersComp":null,"workers":"Unknown","evidence":68,"status":"REVIEW","note":"Identity verified; no current public activity trigger was promoted in this run."},{"rank":23,"company":"POPOVA FRAMING LLC","ubi":"605272258","license":"POPOVFL774OF","phone":"5099985690","city":"City Of Spokane Vall","principal":"POPOVA, MARYANA","licenseStatus":"ACTIVE","workersComp":null,"workers":"Unknown","evidence":68,"status":"REVIEW","note":"Identity verified; no current public activity trigger was promoted in this run."},{"rank":24,"company":"MARCON METAL USA INC","ubi":"604653059","license":"MARCOMU798JB","phone":"3602260657","city":"FERNDALE","principal":"Burstein, Ari Paulus","licenseStatus":"ACTIVE","workersComp":true,"workers":"51 to 75 workers","evidence":68,"status":"REVIEW","note":"Identity verified; no current public activity trigger was promoted in this run."},{"rank":25,"company":"TECHNO METAL POST EVERGREEN","ubi":"605583674","license":"TECHNMP764QD","phone":"2533415221","city":"UNIVERSITY PLACE","principal":"HERBERT, CHRISTOPHER LEE","licenseStatus":"ACTIVE","workersComp":true,"workers":"0 workers","evidence":68,"status":"REVIEW","note":"Identity verified; no current public activity trigger was promoted in this run."}];

function phone(value:string){
  const d=value.replace(/\D/g,"");
  return d.length===10 ? `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}` : value;
}
function StatusBadge({status}:{status:PilotStatus}){
  return <Badge variant="outline" className={status==="HOLD"?"border-risk-critical/35 bg-risk-critical/[0.06] text-risk-critical":"border-risk-warn/35 bg-risk-warn/[0.07] text-risk-warn"}>{status}</Badge>;
}
function Kpi({label,value,hint}:{label:string;value:string|number;hint:string}){
  return <Card><CardContent className="py-5"><p className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted-foreground">{hint}</p></CardContent></Card>;
}

export function RandallDashboard(){
  const {setSection}=useConsole();
  const review=RANDALL_PILOT_25.filter(x=>x.status==="REVIEW").length;
  const hold=RANDALL_PILOT_25.filter(x=>x.status==="HOLD").length;
  const wcCurrent=RANDALL_PILOT_25.filter(x=>x.workersComp===true).length;
  return <div className="space-y-6">
    <section className="overflow-hidden rounded-xl border border-primary/20 bg-surface-1 shadow-sm">
      <div className="h-0.5 bg-gradient-to-r from-primary via-tier-a to-transparent"/>
      <div className="p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Randall partner console</p>
        <h1 className="mt-3 font-display text-4xl">Funding opportunities, without the noise.</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">ALKAN resolves the business, checks public records and surfaces what should be reviewed next. Borrower financial facts remain unknown until confirmed directly.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={()=>setSection("funding_radar")}>Open Funding Radar</Button>
          <Button variant="outline" onClick={()=>setSection("qualification")}>Qualification Queue</Button>
        </div>
      </div>
    </section>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi label="Pilot batch" value="25" hint="Investigated contractor profiles"/>
      <Kpi label="Review" value={review} hint="Verified identity · trigger still needed"/>
      <Kpi label="Hold" value={hold} hint="Compliance or license issue to resolve"/>
      <Kpi label="WC current" value={wcCurrent} hint="Public-record employer status"/>
    </div>
    <Card>
      <CardContent className="py-5">
        <div className="flex items-start gap-3">
          <Radar className="mt-0.5 h-5 w-5 text-primary"/>
          <div><h2 className="font-semibold">Current batch truth</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">All 25 have high-confidence identity matches in the enrichment run. This run did not promote a current public activity event for any of the 25, so none is labeled PURSUE yet. REVIEW means worth qualifying; HOLD means resolve the displayed issue first.</p></div>
        </div>
      </CardContent>
    </Card>
  </div>;
}

export function RandallPilotFundingRadar(){
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState<"ALL"|PilotStatus>("ALL");
  const rows=useMemo(()=>RANDALL_PILOT_25.filter(row=>{
    const q=query.trim().toLowerCase();
    const text=[row.company,row.principal,row.city,row.ubi,row.license,row.phone].join(" ").toLowerCase();
    return (filter==="ALL"||row.status===filter)&&(!q||text.includes(q));
  }),[query,filter]);
  return <section className="space-y-5">
    <div className="flex flex-col gap-4 rounded-xl border border-primary/20 bg-surface-1 p-6 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Funding Radar · Pilot 25</p><h1 className="mt-2 font-display text-4xl">Who deserves the next conversation?</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Public-record research candidates. REVIEW is not a financing approval or confirmed capital need. Only a verified current trigger should move a company to PURSUE.</p></div>
      <div className="flex gap-2">{(["ALL","REVIEW","HOLD"] as const).map(x=><Button key={x} size="sm" variant={filter===x?"default":"outline"} onClick={()=>setFilter(x)}>{x}</Button>)}</div>
    </div>
    <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><input aria-label="Search pilot batch" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search company, principal, city, UBI or license…" className="h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"/></div>
    <div className="grid gap-4 xl:grid-cols-2">
      {rows.map(row=><article key={row.ubi} className="rounded-xl border border-border bg-surface-1 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div><p className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">Batch #{String(row.rank).padStart(2,"0")}</p><h2 className="mt-1 text-lg font-semibold">{row.company}</h2><p className="mt-1 text-xs text-muted-foreground">{row.city} · {row.principal}</p></div><StatusBadge status={row.status}/></div>
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-md bg-surface-2 p-3"><p className="text-[0.62rem] uppercase tracking-wide text-muted-foreground">Identity</p><p className="mt-1 font-medium">UBI {row.ubi}</p><p className="text-xs text-muted-foreground">{row.license}</p></div>
          <div className="rounded-md bg-surface-2 p-3"><p className="text-[0.62rem] uppercase tracking-wide text-muted-foreground">Contact</p><p className="mt-1 font-medium">{phone(row.phone)}</p><p className="text-xs text-muted-foreground">Business phone from source evidence</p></div>
          <div className="rounded-md bg-surface-2 p-3"><p className="text-[0.62rem] uppercase tracking-wide text-muted-foreground">Compliance</p><p className="mt-1 font-medium">License {row.licenseStatus}</p><p className="text-xs text-muted-foreground">Workers' comp: {row.workersComp===true?"current":row.workersComp===false?"issue":"unknown"}</p></div>
          <div className="rounded-md bg-surface-2 p-3"><p className="text-[0.62rem] uppercase tracking-wide text-muted-foreground">Evidence</p><p className="mt-1 font-medium">{row.evidence}/100 enrichment quality</p><p className="text-xs text-muted-foreground">{row.workers}</p></div>
        </div>
        <div className={"mt-4 flex gap-3 rounded-md border p-3 "+(row.status==="HOLD"?"border-risk-critical/25 bg-risk-critical/[0.04]":"border-risk-warn/25 bg-risk-warn/[0.04]")}>
          {row.status==="HOLD"?<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-risk-critical"/>:<ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-risk-warn"/>}
          <div><p className="text-xs font-semibold uppercase tracking-wide">Next review</p><p className="mt-1 text-sm text-muted-foreground">{row.note}</p></div>
        </div>
      </article>)}
    </div>
    {rows.length===0&&<div className="rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">No profiles match this filter.</div>}
    <p className="text-xs leading-5 text-muted-foreground">Pilot data is frozen from the September 24, 2026 enrichment run for preview review. The live Funding Radar remains backed by the origination engine and actor import workflow.</p>
  </section>;
}
