import { useEffect, useMemo, useState, useId, cloneElement, isValidElement, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgeDollarSign,
  Banknote,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  FileCheck2,
  History,
  Phone,
  Radar,
  RefreshCw,
  ShieldCheck,
  Target,
  UserRoundSearch,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

import type { LeadRow } from "@/lib/leads.functions";
import {
  FINANCING_STAGE_LABELS,
  FINANCING_STAGES,
  listFinancingCases,
  saveFinancingCase,
  type FinancingCase,
  type FinancingStage,
} from "@/lib/financing/financing.functions";
import { RUTA_LABELS } from "@/lib/lead-hunter/capital-scoring";
import { useConsole } from "@/components/console/console-context";
import { ErrorBanner, EmptyState, TableRowsSkeleton } from "@/components/console/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { qualificationCompletion, nextMissingQualification, toLocalDateTime, parseMoney } from "@/lib/financing/qualification";
import { mapLead } from "@/lib/partner-data";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const STAGE_TONE: Record<FinancingStage, string> = {
  new: "border-border bg-surface-2 text-muted-foreground",
  contacted: "border-primary/30 bg-primary/[0.07] text-primary",
  qualified: "border-tier-a/35 bg-tier-a/[0.08] text-tier-a",
  docs_requested: "border-risk-warn/35 bg-risk-warn/[0.08] text-risk-warn",
  ready_to_submit: "border-primary/40 bg-primary/10 text-primary",
  submitted: "border-primary/40 bg-primary/10 text-primary",
  approved: "border-risk-ok/35 bg-risk-ok/[0.08] text-risk-ok",
  funded: "border-risk-ok/45 bg-risk-ok/10 text-risk-ok",
  not_fit: "border-risk-critical/30 bg-risk-critical/[0.07] text-risk-critical",
  dormant: "border-border bg-surface-2 text-muted-foreground",
};

function isPriority(lead: LeadRow) {
  return lead.credit_ruta === "TIER_S_FINANCIAMIENTO";
}

function isVerificationFirst(lead: LeadRow) {
  return lead.credit_ruta === "TIER_A_BLINDAJE";
}

function priorityRank(lead: LeadRow) {
  const route = lead.credit_ruta;
  const base =
    route === "TIER_S_FINANCIAMIENTO"
      ? 500
      : route === "TIER_A_BLINDAJE"
        ? 400
        : route === "TIER_B"
          ? 300
          : route === "NURTURE"
            ? 200
            : 0;
  return (
    base +
    (lead.capital_need ?? 0) * 1.5 +
    (lead.capital_fit ?? 0) +
    (lead.opportunity_score ?? 0) +
    Math.min(100, Math.round((lead.valor_obra_12m ?? lead.project_value ?? 0) / 10_000))
  );
}

function companyName(lead: LeadRow) {
  return lead.company || lead.name || "Unnamed business";
}

function knownSignal(lead: LeadRow) {
  return (
    lead.credit_hooks[0] ||
    lead.capital_reason ||
    (lead.valor_obra_12m
      ? `${money.format(lead.valor_obra_12m)} observed construction activity`
      : null) ||
    (lead.permit_number ? `Active permit signal: ${lead.permit_number}` : null) ||
    "More evidence is needed before qualification."
  );
}

function routeLabel(lead: LeadRow) {
  return lead.credit_ruta ? RUTA_LABELS[lead.credit_ruta] : "Not scored";
}

function callsDue(leads: LeadRow[]) {
  return leads.filter(
    (l) =>
      isPriority(l) &&
      !["contacted", "qualified", "negotiating"].includes(
        String(l.contact_status ?? l.lead_status ?? "").toLowerCase(),
      ),
  ).length;
}

function observedValue(leads: LeadRow[]) {
  return leads.reduce((sum, l) => sum + (l.valor_obra_12m ?? l.project_value ?? 0), 0);
}

function filterSearch<T extends { company?: string | null; owner_name?: string | null; city?: string | null; trade?: string | null }>(
  rows: T[],
  search: string,
) {
  const q = search.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) =>
    [row.company, row.owner_name, row.city, row.trade]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q)),
  );
}

function WorkspaceIntro({
  eyebrow,
  title,
  copy,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  icon: typeof Radar;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-primary/20 bg-surface-1 shadow-sm">
      <div className="h-0.5 bg-gradient-to-r from-primary via-tier-a to-transparent" />
      <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-primary">
            <Icon className="h-4 w-4" />
            <span className="text-[0.62rem] font-semibold uppercase tracking-[0.22em]">{eyebrow}</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface-2/70 px-4 py-3 text-xs leading-5 text-muted-foreground lg:max-w-sm">
          <span className="font-semibold text-foreground">Partner rule:</span> ALKAN prioritizes and qualifies opportunities. Public signals are not loan approvals; final underwriting stays with the financing partner.
        </div>
      </div>
    </section>
  );
}

function KpiStrip({ items }: { items: Array<{ label: string; value: string; hint?: string }> }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="py-4">
            <p className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">{item.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{item.value}</p>
            {item.hint && <p className="mt-1 text-[0.68rem] text-muted-foreground">{item.hint}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function FundingRadarPanel({
  leads,
  isLoading,
  isError,
  error,
  onRetry,
  onOpenProfile,
}: {
  leads: LeadRow[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  onOpenProfile: (id: string) => void;
}) {
  const { search } = useConsole();
  const [visibleCount, setVisibleCount] = useState(50);
  const [qualifyLead, setQualifyLead] = useState<LeadRow | null>(null);
  const cases = useQuery({ queryKey: ["financing-cases"], queryFn: () => listFinancingCases() });
  const caseByLead = useMemo(() => new Map((cases.data ?? []).map((c) => [c.lead_id, c])), [cases.data]);
  const candidates = useMemo(
    () =>
      leads
        .filter((l) => {
          if (l.credit_ruta === "DESCARTE") return false;
          const stage = caseByLead.get(l.id)?.stage;
          return !stage || !["funded", "not_fit", "dormant"].includes(stage);
        })
        .sort((a, b) => priorityRank(b) - priorityRank(a)),
    [leads, caseByLead],
  );
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((l) =>
      [l.company, l.name, l.city, l.trade, l.license_number]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [candidates, search]);
  const priority = candidates.filter(isPriority);

  return (
    <div className="space-y-5">
      <WorkspaceIntro
        eyebrow="ALKAN Financing Intelligence"
        title="Find the borrower before the borrower searches for money."
        copy="Construction activity, business history and public evidence identify who deserves a financing conversation now. The call confirms the actual need before anything reaches partner review."
        icon={WalletCards}
      />

      {cases.isError && <ErrorBanner title="Could not load saved qualification cases" error={cases.error} onRetry={() => void cases.refetch()} />}
      <KpiStrip
        items={[
          {
            label: "Priority to qualify",
            value: priority.length.toLocaleString("en-US"),
            hint: "Strong public financing signals",
          },
          {
            label: "Calls due",
            value: priority
              .filter((lead) => !caseByLead.get(lead.id) || caseByLead.get(lead.id)?.stage === "new")
              .length.toLocaleString("en-US"),
            hint: "Priority candidates not yet reached",
          },
          {
            label: "Verification first",
            value: leads.filter(isVerificationFirst).length.toLocaleString("en-US"),
            hint: "Potential fit with risk/compliance flags",
          },
          {
            label: "Observed work value",
            value: money.format(observedValue(priority)),
            hint: "Activity signal, not borrower revenue",
          },
        ]}
      />

      {isError && (
        <ErrorBanner
          title="Could not load financing radar"
          error={error}
          onRetry={onRetry}
          isRetrying={isLoading}
        />
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="text-base">Opportunity radar</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Ranked for qualification priority. No row below implies approval or confirmed capital need.
              </p>
            </div>
            <Badge variant="outline" className="w-fit">
              {filtered.length} visible
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>Why now</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead>Financing signal</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead className="text-right">Next action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRowsSkeleton rows={8} widths={["w-40", "w-64", "w-32", "w-36", "w-20", "w-36 ml-auto"]} />
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6}>
                    <EmptyState
                      icon={Radar}
                      title="No financing candidates match"
                      description="Run contractor enrichment or clear the current search to repopulate the radar."
                    />
                  </TableCell>
                </TableRow>
              )}
              {filtered.slice(0, visibleCount).map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{companyName(lead)}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {[lead.name, lead.city ? `${lead.city}, WA` : null, lead.trade].filter(Boolean).join(" · ")}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[330px]">
                    <p className="text-xs leading-5 text-foreground/90">{knownSignal(lead)}</p>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium tabular-nums">
                      {lead.valor_obra_12m != null || lead.project_value != null ? money.format(lead.valor_obra_12m ?? lead.project_value!) : "Unknown"}
                    </div>
                    <div className="text-[0.65rem] text-muted-foreground">
                      observed project activity
                    </div>
                  </TableCell>
                  <TableCell>
                    <FinancingSignalBadge lead={lead} />
                    {lead.capital_need != null && (
                      <div className="mt-1 text-[0.65rem] text-muted-foreground tabular-nums">
                        signal {lead.capital_need}/100
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs capitalize text-muted-foreground">
                      {lead.capital_confidence ?? "unscored"}
                    </span>
                    {caseByLead.get(lead.id) && (
                      <div className="mt-1">
                        <Badge variant="outline" className={cn("text-[9px]", STAGE_TONE[caseByLead.get(lead.id)!.stage])}>
                          {FINANCING_STAGE_LABELS[caseByLead.get(lead.id)!.stage]}
                        </Badge>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => onOpenProfile(lead.id)}>
                        Evidence
                      </Button>
                      <Button size="sm" disabled={!cases.isSuccess} onClick={() => setQualifyLead(lead)}>
                        <Phone className="mr-1.5 h-3.5 w-3.5" /> {caseByLead.get(lead.id) ? "Update" : "Qualify"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {filtered.length > visibleCount && <Button variant="outline" onClick={() => setVisibleCount(n => n + 50)}>Show 50 more ({filtered.length - visibleCount} remaining)</Button>}
      <QualificationDialog lead={qualifyLead} existing={qualifyLead ? caseByLead.get(qualifyLead.id) ?? null : null} open={Boolean(qualifyLead)} onOpenChange={(v) => !v && setQualifyLead(null)} />
    </div>
  );
}

export function QualificationQueuePanel({ leads }: { leads: LeadRow[] }) {
  const { search } = useConsole();
  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null);
  const cases = useQuery({
    queryKey: ["financing-cases"],
    queryFn: () => listFinancingCases(),
    refetchInterval: 30_000,
  });
  const caseByLead = useMemo(() => new Map((cases.data ?? []).map((c) => [c.lead_id, c])), [cases.data]);
  const queue = useMemo(() => {
    const ordered = leads
      .filter((l) => (l.credit_ruta !== "DESCARTE" || caseByLead.has(l.id)) && !["funded", "not_fit", "dormant", "submitted", "approved"].includes(caseByLead.get(l.id)?.stage ?? ""))
      .sort((a, b) => priorityRank(b) - priorityRank(a));
    const q = search.trim().toLowerCase();
    return q
      ? ordered.filter((l) =>
          [l.company, l.name, l.city, l.trade, l.license_number]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q)),
        )
      : ordered;
  }, [leads, search, caseByLead]);

  return (
    <div className="space-y-5">
      <WorkspaceIntro
        eyebrow="Human qualification layer"
        title="Separate what we know from what we still need to ask."
        copy="Public records can justify a call. They cannot tell us the requested amount, actual cash-flow gap, bank activity or funding urgency. This queue is where those unknowns become confirmed borrower facts."
        icon={ClipboardCheck}
      />

      {cases.isError && (
        <ErrorBanner
          title="Could not load qualification cases"
          error={cases.error}
          onRetry={() => void cases.refetch()}
          isRetrying={cases.isFetching}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Qualification queue</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>Signal</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Confirmed facts</TableHead>
                <TableHead>Next action</TableHead>
                <TableHead className="text-right">Work</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue.map((lead) => {
                const c = caseByLead.get(lead.id);
                const confirmed = c ? qualificationCompletion(c) : { done: 0, total: 9 };
                return (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <div className="font-medium">{companyName(lead)}</div>
                      <div className="text-xs text-muted-foreground">
                        {[lead.name, lead.phone, lead.city].filter(Boolean).join(" · ")}
                      </div>
                    </TableCell>
                    <TableCell><FinancingSignalBadge lead={lead} /></TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[10px]", STAGE_TONE[c?.stage ?? "new"])}>
                        {FINANCING_STAGE_LABELS[c?.stage ?? "new"]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-medium tabular-nums">
                        {confirmed.done}/{confirmed.total} confirmed
                      </div>
                      <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${Math.round((confirmed.done / confirmed.total) * 100)}%` }}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[260px] text-xs text-muted-foreground">
                      {c?.next_action || (c ? nextMissingQualification(c) : "Call and confirm actual capital need")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" disabled={!cases.isSuccess} onClick={() => setSelectedLead(lead)}>
                        {c ? "Update" : "Start qualification"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {queue.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6}>
                    <EmptyState
                      icon={ClipboardCheck}
                      title="Qualification queue is empty"
                      description="Financing candidates appear here after the intelligence layer produces a usable signal."
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <QualificationDialog
        lead={selectedLead}
        existing={selectedLead ? caseByLead.get(selectedLead.id) ?? null : null}
        open={Boolean(selectedLead)}
        onOpenChange={(v) => !v && setSelectedLead(null)}
      />
    </div>
  );
}

function caseLead(c: FinancingCase): LeadRow {
 return mapLead({ id:c.lead_id, company:c.company, name:c.owner_name, phone:c.phone, email:c.email, enrichment_data:{city:c.city,trade:c.trade,license_number:c.license_number} });
}
export function CaseEditor({ selected, onClose }: {selected:FinancingCase|null;onClose:()=>void}) {
 const qc=useQueryClient();
 const lead=selected ? qc.getQueryData<LeadRow[]>(["leads"])?.find(l=>l.id===selected.lead_id)??caseLead(selected) : null;
 return <QualificationDialog lead={lead} existing={selected} open={Boolean(selected)} onOpenChange={v=>!v&&onClose()} />;
}
export function DealPipelinePanel() {
 const {search}=useConsole();
 const cases=useQuery({queryKey:["financing-cases"],queryFn:listFinancingCases});
 const [selected,setSelected]=useState<FinancingCase|null>(null);
 const [includeClosed,setIncludeClosed]=useState(false);
 const visible=filterSearch(cases.data??[],search);
 const stages=FINANCING_STAGES.filter(s=>includeClosed||!["not_fit","dormant"].includes(s));
 const due=visible.filter(c=>c.follow_up_at && Date.parse(c.follow_up_at)<=Date.now()&&!["funded","not_fit","dormant"].includes(c.stage));
 return <div className="space-y-5">
 <WorkspaceIntro eyebrow="Partner handoff" title="Every conversation has a next step." copy="Follow the opportunity from first contact to documented partner decision. Open a case to qualify, record an outcome or schedule the next touch." icon={BriefcaseBusiness}/>
 <KpiStrip items={[
 {label:"Active cases",value:visible.filter(c=>!["funded","not_fit","dormant"].includes(c.stage)).length.toString()},
 {label:"Ready for partner",value:visible.filter(c=>c.stage==="ready_to_submit").length.toString()},
 {label:"Submitted",value:visible.filter(c=>c.stage==="submitted").length.toString()},
 {label:"Follow-ups due",value:due.length.toString(),hint:"Open cases requiring attention"}
 ]}/>
 {cases.isError&&<ErrorBanner error={cases.error} onRetry={()=>void cases.refetch()}/>}
 {cases.isPending&&<p role="status">Loading pipeline…</p>}
 <div className="flex items-center justify-between gap-4"><p className="text-xs text-muted-foreground">{visible.length} cases · amounts below are requested, unless marked funded</p><Button variant="outline" onClick={()=>setIncludeClosed(v=>!v)}>{includeClosed?"Hide":"Show"} dormant / not fit</Button></div>
 <div className="flex gap-3 overflow-x-auto pb-4" aria-label="Deal pipeline">
 {stages.map(stage=><section key={stage} className="w-72 shrink-0 rounded-lg border border-border bg-surface-2/60 p-3">
  <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-xs font-semibold">{FINANCING_STAGE_LABELS[stage]}</h2><Badge variant="outline">{visible.filter(c=>c.stage===stage).length}</Badge></div>
  <div className="space-y-3">{visible.filter(c=>c.stage===stage).map(c=><button key={c.id} onClick={()=>setSelected(c)} className="block w-full rounded-md border border-border bg-surface-1 p-4 text-left shadow-sm hover:border-primary">
   <p className="font-medium">{c.company||c.owner_name||"Unnamed business"}</p>
   <p className="mt-1 text-xs text-muted-foreground">{[c.city,c.trade].filter(Boolean).join(" · ")||"Business details pending"}</p>
   <p className="mt-4 text-xl font-semibold tabular-nums">{(stage==="funded"?c.funded_amount:c.amount_requested)!=null?money.format((stage==="funded"?c.funded_amount:c.amount_requested)!):"Amount unknown"}</p>
   <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{stage==="funded"?"Recorded funding":"Requested"}</p>
   <p className="mt-3 text-xs">{c.next_action||nextMissingQualification(c)}</p>
   {c.follow_up_at&&<p className={cn("mt-3 text-xs",Date.parse(c.follow_up_at)<=Date.now()?"text-risk-warn":"text-muted-foreground")}>Follow-up · {new Date(c.follow_up_at).toLocaleString()}</p>}
  </button>)}
  {!visible.some(c=>c.stage===stage)&&<p className="py-10 text-center text-xs text-muted-foreground">No cases in this stage</p>}</div>
 </section>)}
 </div>
 <CaseEditor selected={selected} onClose={()=>setSelected(null)}/>
 </div>;
}
export function PortfolioPanel() {
 const {search}=useConsole();
 const cases=useQuery({queryKey:["financing-cases"],queryFn:listFinancingCases});
 const [selected,setSelected]=useState<FinancingCase|null>(null);
 const visible=filterSearch(cases.data??[],search);
 const funded=visible.filter(c=>c.stage==="funded"&&c.funded_at&&c.funded_amount!=null);
 const approved=visible.filter(c=>c.stage==="approved"&&c.approved_at);
 const outcomes=[...funded,...approved];
 return <div className="space-y-5">
 <WorkspaceIntro eyebrow="Documented outcomes" title="Relationships worth returning to." copy="Approved and funded cases, with the recorded partner outcome and next follow-up. Requested amounts are shown separately from actual funding." icon={History}/>
 <KpiStrip items={[{label:"Funded relationships",value:funded.length.toString()},{label:"Recorded funded amount",value:money.format(funded.reduce((sum,c)=>sum+(c.funded_amount??0),0))},{label:"Approved, awaiting funding",value:approved.length.toString()},{label:"Follow-ups due",value:outcomes.filter(c=>c.follow_up_at&&Date.parse(c.follow_up_at)<=Date.now()).length.toString()}]}/>
 {cases.isError&&<ErrorBanner error={cases.error} onRetry={()=>void cases.refetch()}/>}
 <Card><CardHeader><CardTitle>Approved & funded relationships</CardTitle></CardHeader><CardContent className="overflow-x-auto">
 <Table><TableHeader><TableRow><TableHead>Business</TableHead><TableHead>Outcome</TableHead><TableHead>Requested</TableHead><TableHead>Actual funded</TableHead><TableHead>Partner record</TableHead><TableHead>Next touch</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
 <TableBody>
 {cases.isPending&&<TableRowsSkeleton rows={3} widths={["w-36","w-16","w-20","w-20","w-36","w-24","w-16"]}/>}
 {outcomes.map(c=><TableRow key={c.id}><TableCell className="font-medium">{c.company||c.owner_name||"Unnamed business"}</TableCell><TableCell><Badge variant="outline" className={STAGE_TONE[c.stage]}>{FINANCING_STAGE_LABELS[c.stage]}</Badge><p className="mt-1 text-xs">{new Date((c.stage==="funded"?c.funded_at:c.approved_at)!).toLocaleDateString()}</p></TableCell><TableCell>{c.amount_requested!=null?money.format(c.amount_requested):"Unknown"}</TableCell><TableCell className="font-semibold">{c.stage==="funded"&&c.funded_amount!=null?money.format(c.funded_amount):"Not funded"}</TableCell><TableCell className="max-w-64 whitespace-normal text-xs">{c.partner_notes||"No reference recorded"}</TableCell><TableCell className="text-xs">{c.follow_up_at?new Date(c.follow_up_at).toLocaleString():c.next_action||"Not scheduled"}</TableCell><TableCell><Button variant="outline" size="sm" onClick={()=>setSelected(c)}>Update case</Button></TableCell></TableRow>)}
 {cases.isSuccess&&outcomes.length===0&&<TableRow><TableCell colSpan={7}><EmptyState icon={History} title="No documented outcomes yet" description="Approved and funded relationships will appear after the partner's actual decision is recorded."/></TableCell></TableRow>}
 </TableBody></Table></CardContent></Card>
 <CaseEditor selected={selected} onClose={()=>setSelected(null)}/>
 </div>;
}

function FinancingSignalBadge({ lead }: { lead: LeadRow }) {
  const tone = isPriority(lead)
    ? "border-risk-ok/35 bg-risk-ok/[0.08] text-risk-ok"
    : isVerificationFirst(lead)
      ? "border-risk-warn/35 bg-risk-warn/[0.08] text-risk-warn"
      : lead.credit_ruta === "TIER_B"
        ? "border-primary/30 bg-primary/[0.07] text-primary"
        : "border-border bg-surface-2 text-muted-foreground";
  return <Badge variant="outline" className={cn("text-[10px]", tone)}>{routeLabel(lead)}</Badge>;
}

type FormState = {
  stage: FinancingStage;
  amountRequested: string;
  useOfFunds: string;
  monthlyDeposits: string;
  currentDebt: string;
  bankruptcyStatus: string;
  nsfStatus: string;
  receivablesContracts: string;
  fundingUrgency: string;
  documentsReady: "unknown" | "yes" | "no";
  qualificationNotes: string;
  partnerNotes: string;
  nextAction: string;
  followUpAt: string;
  fundedAmount: string;
};

function formFromCase(c?: FinancingCase | null): FormState {
  return {
    stage: c?.stage ?? "new",
    amountRequested: c?.amount_requested != null ? String(c.amount_requested) : "",
    useOfFunds: c?.use_of_funds ?? "",
    monthlyDeposits: c?.monthly_deposits != null ? String(c.monthly_deposits) : "",
    currentDebt: c?.current_debt ?? "",
    bankruptcyStatus: c?.bankruptcy_status ?? "",
    nsfStatus: c?.nsf_status ?? "",
    receivablesContracts: c?.receivables_contracts ?? "",
    fundingUrgency: c?.funding_urgency ?? "",
    documentsReady: c?.documents_ready == null ? "unknown" : c.documents_ready ? "yes" : "no",
    qualificationNotes: c?.qualification_notes ?? "",
    partnerNotes: c?.partner_notes ?? "",
    nextAction: c?.next_action ?? "",
    followUpAt: toLocalDateTime(c?.follow_up_at),
    fundedAmount: c?.funded_amount != null ? String(c.funded_amount) : "",
  };
}

const numOrNull = parseMoney;

function QualificationDialog({
  lead,
  existing = null,
  open,
  onOpenChange,
}: {
  lead: LeadRow | null;
  existing?: FinancingCase | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const resolvedExisting = existing;
  const [form, setForm] = useState<FormState>(() => formFromCase(existing));

  useEffect(() => {
    if (open) setForm(formFromCase(resolvedExisting));
  }, [open, lead?.id]);

  const save = useMutation({
    mutationFn: async () => {
      if (!lead) throw new Error("No lead selected");
      return saveFinancingCase({
        data: {
          lead_id: lead.id,
          partner_name: "Randall",
          expected_updated_at: resolvedExisting?.updated_at ?? null,
          partner_notes: form.partnerNotes.trim() || null,
          stage: form.stage,
          amount_requested: numOrNull(form.amountRequested),
          use_of_funds: form.useOfFunds.trim() || null,
          monthly_deposits: numOrNull(form.monthlyDeposits),
          current_debt: form.currentDebt.trim() || null,
          bankruptcy_status: form.bankruptcyStatus.trim() || null,
          nsf_status: form.nsfStatus.trim() || null,
          receivables_contracts: form.receivablesContracts.trim() || null,
          funding_urgency: form.fundingUrgency.trim() || null,
          documents_ready: form.documentsReady === "unknown" ? null : form.documentsReady === "yes",
          qualification_notes: form.qualificationNotes.trim() || null,
          next_action: form.nextAction.trim() || null,
          follow_up_at: form.followUpAt ? new Date(form.followUpAt).toISOString() : null,
          funded_amount: numOrNull(form.fundedAmount),
        },
      });
    },
    onSuccess: () => {
      toast.success("Financing qualification saved");
      void qc.invalidateQueries({ queryKey: ["financing-cases"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error("Could not save qualification", { description: e.message }),
  });

  if (!lead) return null;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={(value) => !save.isPending && onOpenChange(value)}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Qualify financing opportunity · {companyName(lead)}</DialogTitle>
          <DialogDescription>
            Confirm borrower facts from the conversation. Leave unknown fields blank. Public intelligence is shown only as call context.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.4fr]">
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-surface-2/60 p-4">
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Pre-call evidence</p>
              <div className="mt-3 space-y-3 text-sm">
                <FactLine icon={Building2} label="Business" value={companyName(lead)} />
                <FactLine icon={UserRoundSearch} label="Contact" value={lead.name || "Unresolved"} />
                <FactLine icon={Phone} label="Phone" value={lead.phone || "Unknown"} />
                <FactLine icon={ShieldCheck} label="License" value={lead.license_number || "Unknown"} />
                <FactLine icon={CircleDollarSign} label="Observed work" value={lead.valor_obra_12m != null || lead.project_value != null ? money.format(lead.valor_obra_12m ?? lead.project_value!) : "Unknown"} />
                <FactLine icon={Target} label="Signal" value={routeLabel(lead)} />
              </div>
              <div className="mt-4 rounded-md border border-primary/20 bg-primary/[0.04] p-3 text-xs leading-5 text-muted-foreground">
                <span className="font-medium text-foreground">Why call:</span> {knownSignal(lead)}
              </div>
            </div>

            <div className="rounded-lg border border-risk-warn/25 bg-risk-warn/[0.04] p-4 text-xs leading-5 text-muted-foreground">
              <div className="flex items-center gap-2 font-medium text-risk-warn">
                <AlertTriangle className="h-4 w-4" /> Qualification boundary
              </div>
              <p className="mt-2">
                Project volume, permits and public records can prioritize outreach. They do not prove monthly deposits, cash-flow need, repayment capacity or approval eligibility.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Pipeline stage">
              <Select value={form.stage} onValueChange={(v) => set("stage", v as FinancingStage)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FINANCING_STAGES.map((stage) => (
                    <SelectItem key={stage} value={stage}>{FINANCING_STAGE_LABELS[stage]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Amount requested">
              <Input value={form.amountRequested} onChange={(e) => set("amountRequested", e.target.value)} placeholder="$40,000" inputMode="decimal" />
            </Field>
            <Field label="Use of funds">
              <Input value={form.useOfFunds} onChange={(e) => set("useOfFunds", e.target.value)} placeholder="Payroll + materials" />
            </Field>
            <Field label="Monthly deposits">
              <Input value={form.monthlyDeposits} onChange={(e) => set("monthlyDeposits", e.target.value)} placeholder="$95,000" inputMode="decimal" />
            </Field>
            <Field label="Current debt / advances">
              <Input value={form.currentDebt} onChange={(e) => set("currentDebt", e.target.value)} placeholder="None / LOC / MCA / unknown" />
            </Field>
            <Field label="Funding urgency">
              <Input value={form.fundingUrgency} onChange={(e) => set("fundingUrgency", e.target.value)} placeholder="This week / before payroll Friday" />
            </Field>
            <Field label="Bankruptcy status">
              <Input value={form.bankruptcyStatus} onChange={(e) => set("bankruptcyStatus", e.target.value)} placeholder="Ask and document answer" />
            </Field>
            <Field label="NSF history">
              <Input value={form.nsfStatus} onChange={(e) => set("nsfStatus", e.target.value)} placeholder="Ask and document answer" />
            </Field>
            <Field label="Receivables / active contracts" className="sm:col-span-2">
              <Textarea value={form.receivablesContracts} onChange={(e) => set("receivablesContracts", e.target.value)} placeholder="What is signed, billed, pending collection, or starting next?" />
            </Field>
            <Field label="Documents ready">
              <Select value={form.documentsReady} onValueChange={(v) => set("documentsReady", v as FormState["documentsReady"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">Unknown</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Funded amount">
              <Input value={form.fundedAmount} onChange={(e) => set("fundedAmount", e.target.value)} placeholder="Only after funding" inputMode="decimal" />
            </Field>
            <Field label="Next action" className="sm:col-span-2">
              <Input value={form.nextAction} onChange={(e) => set("nextAction", e.target.value)} placeholder="Request 3 months bank statements / send to Randal / call Tuesday" />
            </Field>
            <Field label="Follow-up" className="sm:col-span-2">
              <Input type="datetime-local" value={form.followUpAt} onChange={(e) => set("followUpAt", e.target.value)} />
            </Field>
            <Field label="Partner notes / decision reference" className="sm:col-span-2">
              <Textarea value={form.partnerNotes} onChange={(e) => set("partnerNotes", e.target.value)} placeholder="Partner confirmation, submission reference and date. Required for submitted, approved or funded cases." />
            </Field>
            <Field label="Qualification notes" className="sm:col-span-2">
              <Textarea className="min-h-28" value={form.qualificationNotes} onChange={(e) => set("qualificationNotes", e.target.value)} placeholder="Record only what the borrower actually said or supplied." />
            </Field>
          </div>
        </div>

        {save.isError && <p role="alert" className="text-sm text-risk-critical">{save.error.message}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={save.isPending} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <FileCheck2 className="mr-2 h-4 w-4" />}
            Save qualification
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  const id = useId();
  const isSelect = isValidElement(children) && children.type === Select;
  return (
    <div role={isSelect ? "group" : undefined} aria-label={isSelect ? label : undefined} className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-xs">{label}</Label>
      {isValidElement(children) ? cloneElement(children as React.ReactElement<{ "aria-label"?: string; id?: string }>, { "aria-label": label, id }) : children}
    </div>
  );
}

function FactLine({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        <p className="truncate text-xs font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}
