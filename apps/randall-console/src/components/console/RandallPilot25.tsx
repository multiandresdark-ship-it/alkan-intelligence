import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Phone,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { useConsole } from "@/components/console/console-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type PilotStatus = "REVIEW" | "HOLD";
type OperationalStatus = "READY TO QUALIFY" | "REVIEW WC" | "VERIFY WC" | "HOLD";
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

function operationalStatus(row:PilotRow):OperationalStatus{
  if(row.licenseStatus!=="ACTIVE") return "HOLD";
  if(row.workersComp===false) return "REVIEW WC";
  if(row.workersComp===null) return "VERIFY WC";
  return "READY TO QUALIFY";
}

function statusClass(status:OperationalStatus){
  if(status==="READY TO QUALIFY") return "border-risk-ok/35 bg-risk-ok/[0.08] text-risk-ok";
  if(status==="REVIEW WC") return "border-risk-warn/35 bg-risk-warn/[0.08] text-risk-warn";
  if(status==="VERIFY WC") return "border-tier-a/35 bg-tier-a/[0.08] text-tier-a";
  return "border-risk-critical/35 bg-risk-critical/[0.08] text-risk-critical";
}

function statusDetail(row:PilotRow){
  const status=operationalStatus(row);
  if(status==="READY TO QUALIFY") return "Active license + current workers' comp + verified business phone. Ready for a human qualification call.";
  if(status==="REVIEW WC") return "Identity and contact route are usable, but workers' comp requires review before outreach.";
  if(status==="VERIFY WC") return "Identity and active license are verified. Workers' comp was not confirmed in this run.";
  return "License is not active. Keep the company on hold until the public status changes.";
}

function Kpi({icon,label,value,hint,tone="default"}:{icon:React.ReactNode;label:string;value:string|number;hint:string;tone?:"default"|"gold"|"green"|"blue"|"risk"}){
  const toneClass=tone==="gold"?"text-primary":tone==="green"?"text-risk-ok":tone==="blue"?"text-tier-a":tone==="risk"?"text-risk-critical":"text-foreground";
  return <Card className="shadow-none">
    <CardContent className="py-4">
      <div className="flex items-center gap-1.5 text-muted-foreground">{icon}<span className="text-[0.58rem] font-medium uppercase tracking-[0.16em]">{label}</span></div>
      <p className={`mt-2 text-[1.9rem] font-semibold leading-none tabular-nums ${toneClass}`}>{value}</p>
      <p className="mt-2 text-[0.66rem] leading-5 text-muted-foreground">{hint}</p>
    </CardContent>
  </Card>;
}

function OperationalBadge({row}:{row:PilotRow}){
  const status=operationalStatus(row);
  return <Badge variant="outline" className={statusClass(status)}>{status}</Badge>;
}

export function RandallDashboard(){
  const {setSection}=useConsole();
  const ready=RANDALL_PILOT_25.filter(x=>operationalStatus(x)==="READY TO QUALIFY").length;
  const reviewWc=RANDALL_PILOT_25.filter(x=>operationalStatus(x)==="REVIEW WC").length;
  const verifyWc=RANDALL_PILOT_25.filter(x=>operationalStatus(x)==="VERIFY WC").length;
  const hold=RANDALL_PILOT_25.filter(x=>operationalStatus(x)==="HOLD").length;
  const active=RANDALL_PILOT_25.filter(x=>x.licenseStatus==="ACTIVE").length;

  return <div className="space-y-5">
    <section className="overflow-hidden rounded-xl border border-border bg-surface-1 shadow-sm">
      <div className="h-0.5 bg-gradient-to-r from-primary via-tier-a to-transparent"/>
      <div className="grid gap-6 p-6 xl:grid-cols-[1.35fr_.65fr] xl:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-risk-ok"/>
            <p className="intelligence-eyebrow text-primary">Randall partner console · pilot 25</p>
          </div>
          <h1 className="mt-3 max-w-4xl font-display text-4xl leading-[1.02] md:text-5xl">200 contractor records became 25 researched opportunities.</h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">ALKAN resolves exact business identity, checks Washington public records, preserves the phone route and separates what is ready for a qualification call from what still needs verification. Borrower financial facts stay unknown until the borrower confirms them.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={()=>setSection("funding_radar")}>Open Funding Radar <ArrowRight className="ml-2 h-4 w-4"/></Button>
            <Button variant="outline" onClick={()=>setSection("apify")}><Sparkles className="mr-2 h-4 w-4"/>Permit Opportunities</Button>
            <Button variant="ghost" onClick={()=>setSection("qualification")}>Qualification Queue</Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border bg-background/55 p-4">
            <p className="intelligence-eyebrow text-muted-foreground">Call-ready</p>
            <p className="mt-2 editorial-number text-4xl font-semibold text-risk-ok">{ready}</p>
            <p className="mt-1 text-xs text-muted-foreground">60% of enriched batch</p>
          </div>
          <div className="rounded-lg border border-border bg-background/55 p-4">
            <p className="intelligence-eyebrow text-muted-foreground">Active licenses</p>
            <p className="mt-2 editorial-number text-4xl font-semibold">{active}</p>
            <p className="mt-1 text-xs text-muted-foreground">1 profile held back</p>
          </div>
          <div className="col-span-2 rounded-lg border border-primary/25 bg-primary/[0.05] p-4">
            <p className="intelligence-eyebrow text-primary">Current intelligence boundary</p>
            <p className="mt-2 text-sm leading-6 text-foreground/85">No current activity event was promoted in this batch. “Ready to qualify” means the public-record package is usable for outreach — not that the company needs financing.</p>
          </div>
        </div>
      </div>
    </section>

    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Kpi icon={<UsersRound className="h-3.5 w-3.5"/>} label="Source universe" value="200" hint="Original contractor research pool"/>
      <Kpi icon={<BadgeCheck className="h-3.5 w-3.5"/>} label="Enriched" value="25" hint="25/25 high-confidence identities" tone="gold"/>
      <Kpi icon={<Phone className="h-3.5 w-3.5"/>} label="Phone routes" value="25" hint="Usable route on every profile" tone="blue"/>
      <Kpi icon={<CheckCircle2 className="h-3.5 w-3.5"/>} label="Ready to qualify" value={ready} hint="Active license + current WC" tone="green"/>
      <Kpi icon={<ShieldCheck className="h-3.5 w-3.5"/>} label="Needs WC review" value={reviewWc+verifyWc} hint={`${reviewWc} issue · ${verifyWc} verify`}/>
      <Kpi icon={<CircleDollarSign className="h-3.5 w-3.5"/>} label="Borrower facts inferred" value="0" hint="Financial facts remain confirmed-only"/>
    </div>

    <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium"><Radar className="h-4 w-4 text-primary"/>Funding intelligence funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["200","Source profiles","Names, phones, coarse contractor data"],
              ["25","Enriched","Identity + public-record evidence"],
              [String(ready),"Call-ready","Public package supports qualification"],
              ["0","Confirmed needs","Requires a real borrower conversation"],
            ].map(([value,label,detail],i)=><div key={label} className="relative rounded-md border border-border bg-background/45 p-3">
              <p className={`editorial-number text-3xl font-semibold ${i===2?"text-risk-ok":i===3?"text-muted-foreground":""}`}>{value}</p>
              <p className="mt-1 text-xs font-medium">{label}</p>
              <p className="mt-1 text-[0.64rem] leading-5 text-muted-foreground">{detail}</p>
              {i<3&&<ArrowRight className="absolute -right-3 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-border-strong sm:block"/>}
            </div>)}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="h-4 w-4 text-primary"/>Operational triage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            ["READY TO QUALIFY",ready,"Public package is ready for human qualification","bg-risk-ok"],
            ["REVIEW WC",reviewWc,"Workers' comp issue needs review","bg-risk-warn"],
            ["VERIFY WC",verifyWc,"Workers' comp unknown in this run","bg-tier-a"],
            ["HOLD",hold,"License or hard public-record issue","bg-risk-critical"],
          ].map(([label,count,detail,bar])=><div key={String(label)} className="grid grid-cols-[110px_1fr_36px] items-center gap-3 text-xs">
            <span className="font-medium">{label}</span>
            <div><div className="h-1.5 overflow-hidden rounded-sm bg-surface-2"><div className={`h-full ${bar}`} style={{width:`${(Number(count)/25)*100}%`}}/></div><p className="mt-1 text-[0.6rem] text-muted-foreground">{detail}</p></div>
            <span className="text-right font-semibold tabular-nums">{count}</span>
          </div>)}
        </CardContent>
      </Card>
    </div>

    <Card className="shadow-none">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">What the enrichment actually bought</CardTitle></CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-border bg-background/40 p-4">
            <p className="intelligence-eyebrow text-muted-foreground">Before · raw profile</p>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <p>Company name + phone</p><p>City / trade / license number</p><p>Coarse status or generic score</p><p>Little confidence about who deserves the first call</p>
            </div>
          </div>
          <div className="rounded-md border border-primary/25 bg-primary/[0.04] p-4">
            <p className="intelligence-eyebrow text-primary">After · funding radar</p>
            <div className="mt-3 grid gap-2 text-sm text-foreground/85 sm:grid-cols-2">
              <p>Exact UBI + license identity</p><p>Principal / governing person</p><p>License + workers' comp state</p><p>Estimated workforce</p><p>Verified phone route</p><p>Evidence quality + next action</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>;
}

export function RandallPilotFundingRadar(){
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState<"ALL"|OperationalStatus>("ALL");
  const [selected,setSelected]=useState<PilotRow|null>(null);

  const rows=useMemo(()=>RANDALL_PILOT_25.filter(row=>{
    const q=query.trim().toLowerCase();
    const text=[row.company,row.principal,row.city,row.ubi,row.license,row.phone,row.workers].join(" ").toLowerCase();
    const state=operationalStatus(row);
    return (filter==="ALL"||state===filter)&&(!q||text.includes(q));
  }),[query,filter]);

  const ready=RANDALL_PILOT_25.filter(x=>operationalStatus(x)==="READY TO QUALIFY").length;
  const reviewWc=RANDALL_PILOT_25.filter(x=>operationalStatus(x)==="REVIEW WC").length;
  const verifyWc=RANDALL_PILOT_25.filter(x=>operationalStatus(x)==="VERIFY WC").length;
  const hold=RANDALL_PILOT_25.filter(x=>operationalStatus(x)==="HOLD").length;

  return <section className="space-y-4">
    <div className="rounded-xl border border-border bg-surface-1 shadow-sm">
      <div className="flex flex-col gap-5 p-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-risk-ok"/><p className="intelligence-eyebrow text-primary">Funding Radar · enriched pilot</p></div>
          <h1 className="mt-2 font-display text-4xl">Who deserves the next conversation?</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Operational outreach states based on verified public-record evidence. They are not underwriting decisions, approval probabilities or proof of financing need.</p>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[["Ready",ready,"text-risk-ok"],["Review WC",reviewWc,"text-risk-warn"],["Verify WC",verifyWc,"text-tier-a"],["Hold",hold,"text-risk-critical"]].map(([label,value,cls])=><div key={String(label)} className="min-w-[84px] rounded-md border border-border bg-background/50 px-3 py-2 text-center">
            <p className="text-[0.52rem] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
            <p className={`mt-1 text-xl font-semibold tabular-nums ${cls}`}>{value}</p>
          </div>)}
        </div>
      </div>
    </div>

    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-1 p-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative min-w-0 flex-1">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"/>
        <Input aria-label="Search pilot batch" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search company, principal, city, UBI, license or phone…" className="h-9 bg-background/70 pl-9"/>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(["ALL","READY TO QUALIFY","REVIEW WC","VERIFY WC","HOLD"] as const).map(x=><Button key={x} size="sm" variant={filter===x?"default":"outline"} onClick={()=>setFilter(x)} className="h-8 text-[0.65rem]">{x}</Button>)}
      </div>
    </div>

    <Card className="overflow-hidden shadow-none">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-2/80 hover:bg-surface-2/80">
                <TableHead className="w-[310px] text-[0.6rem] uppercase tracking-[0.14em]">Business</TableHead>
                <TableHead className="text-[0.6rem] uppercase tracking-[0.14em]">Operational state</TableHead>
                <TableHead className="text-[0.6rem] uppercase tracking-[0.14em]">License / WC</TableHead>
                <TableHead className="text-[0.6rem] uppercase tracking-[0.14em]">Workforce</TableHead>
                <TableHead className="text-[0.6rem] uppercase tracking-[0.14em]">Phone route</TableHead>
                <TableHead className="text-right text-[0.6rem] uppercase tracking-[0.14em]">Evidence</TableHead>
                <TableHead className="w-[80px]"/>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row=>{
                const status=operationalStatus(row);
                return <TableRow key={row.ubi} className="cursor-pointer hover:bg-primary/[0.035]" onClick={()=>setSelected(row)}>
                  <TableCell>
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border bg-background text-[0.62rem] font-semibold tabular-nums text-muted-foreground">{String(row.rank).padStart(2,"0")}</span>
                      <div className="min-w-0"><p className="font-medium">{row.company}</p><p className="mt-0.5 truncate text-[0.68rem] text-muted-foreground">{row.city} · {row.principal}</p><p className="mt-1 font-mono text-[0.62rem] text-muted-foreground">UBI {row.ubi} · {row.license}</p></div>
                    </div>
                  </TableCell>
                  <TableCell><OperationalBadge row={row}/></TableCell>
                  <TableCell><p className={`text-xs font-medium ${row.licenseStatus==="ACTIVE"?"text-risk-ok":"text-risk-critical"}`}>{row.licenseStatus}</p><p className="mt-1 text-[0.65rem] text-muted-foreground">WC {row.workersComp===true?"current":row.workersComp===false?"issue":"verify"}</p></TableCell>
                  <TableCell className="text-xs">{row.workers}</TableCell>
                  <TableCell><p className="font-mono text-xs">{phone(row.phone)}</p><p className="mt-1 text-[0.62rem] text-muted-foreground">source evidence</p></TableCell>
                  <TableCell className="text-right"><span className="editorial-number text-lg font-semibold">{row.evidence}</span><span className="text-[0.65rem] text-muted-foreground">/100</span></TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={(e)=>{e.stopPropagation();setSelected(row);}}>Review</Button></TableCell>
                </TableRow>;
              })}
            </TableBody>
          </Table>
        </div>
        {rows.length===0&&<div className="p-10 text-center text-sm text-muted-foreground">No profiles match this filter.</div>}
      </CardContent>
    </Card>

    <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/[0.04] p-4">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary"/>
      <p className="text-xs leading-5 text-muted-foreground">This batch verified the businesses and created a usable outreach triage. It did not promote a current activity event, so “Ready to Qualify” means the public-record package is sufficiently complete for a human call — not that a financing need is already known.</p>
    </div>

    <Dialog open={Boolean(selected)} onOpenChange={open=>!open&&setSelected(null)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        {selected&&<>
          <DialogHeader>
            <p className="intelligence-eyebrow text-primary">Research candidate #{String(selected.rank).padStart(2,"0")}</p>
            <DialogTitle className="font-display text-3xl">{selected.company}</DialogTitle>
            <DialogDescription>{selected.city} · {selected.principal}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2"><OperationalBadge row={selected}/><Badge variant="outline" className={selected.licenseStatus==="ACTIVE"?"border-risk-ok/30 text-risk-ok":"border-risk-critical/30 text-risk-critical"}>License {selected.licenseStatus}</Badge><Badge variant="outline">Evidence {selected.evidence}/100</Badge></div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border bg-surface-2/45 p-4">
              <p className="intelligence-eyebrow text-muted-foreground">Verified identity</p>
              <dl className="mt-3 space-y-3 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">UBI</dt><dd className="font-mono">{selected.ubi}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">License</dt><dd className="font-mono">{selected.license}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Principal</dt><dd className="text-right">{selected.principal}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Location</dt><dd>{selected.city}</dd></div>
              </dl>
            </div>
            <div className="rounded-md border border-border bg-surface-2/45 p-4">
              <p className="intelligence-eyebrow text-muted-foreground">Public-record status</p>
              <dl className="mt-3 space-y-3 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Business phone</dt><dd className="font-mono">{phone(selected.phone)}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">License</dt><dd>{selected.licenseStatus}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Workers' comp</dt><dd>{selected.workersComp===true?"Current":selected.workersComp===false?"Issue / review":"Verify"}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Estimated workers</dt><dd>{selected.workers}</dd></div>
              </dl>
            </div>
          </div>

          <div className="rounded-md border border-risk-ok/25 bg-risk-ok/[0.04] p-4">
            <p className="intelligence-eyebrow text-risk-ok">Value created by enrichment</p>
            <p className="mt-2 text-sm font-medium leading-6">{statusDetail(selected)}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-[0.62rem] text-muted-foreground">
              {["Legal identity resolved","UBI + license matched","Principal identified","Phone route preserved","WC / workforce checked","Next action classified"].map(x=><span key={x} className="rounded-full border border-border bg-background/60 px-2 py-1">{x}</span>)}
            </div>
          </div>

          <div className="rounded-md border border-primary/25 bg-primary/[0.04] p-4">
            <div className="flex gap-3"><CircleDollarSign className="mt-0.5 h-4 w-4 shrink-0 text-primary"/><div><p className="text-sm font-semibold">Borrower facts remain unknown.</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Revenue, deposits, current debt, NSF history, bankruptcy status, desired amount and actual financing need are not inferred from public records. Those facts begin in Qualification.</p></div></div>
          </div>

          <div className="rounded-md border border-border p-4">
            <p className="intelligence-eyebrow text-muted-foreground">Recommended next action</p>
            <p className="mt-2 text-sm leading-6">{selected.note}</p>
          </div>
        </>}
      </DialogContent>
    </Dialog>
  </section>;
}
