import { z } from "zod";

export const FINANCING_STAGES = ["new", "contacted", "qualified", "docs_requested", "ready_to_submit", "submitted", "approved", "funded", "not_fit", "dormant"] as const;
export type FinancingStage = (typeof FINANCING_STAGES)[number];
export const FINANCING_STAGE_LABELS: Record<FinancingStage, string> = {
  new: "New", contacted: "Contacted", qualified: "Qualified", docs_requested: "Docs requested",
  ready_to_submit: "Ready for partner review", submitted: "Submitted", approved: "Approved",
  funded: "Funded", not_fit: "Not fit", dormant: "Dormant",
};

const note = (max: number) => z.string().trim().max(max).nullable().optional();
export const caseInput = z.object({
  lead_id: z.string().uuid(),
  expected_updated_at: z.string().datetime().nullable(),
  partner_name: z.string().trim().min(1).max(100).default("Randall"),
  stage: z.enum(FINANCING_STAGES).default("new"),
  amount_requested: z.number().finite().nonnegative().nullable().optional(),
  use_of_funds: note(1000), monthly_deposits: z.number().finite().nonnegative().nullable().optional(),
  current_debt: note(1000), bankruptcy_status: note(500), nsf_status: note(500),
  receivables_contracts: note(2000), funding_urgency: note(500),
  documents_ready: z.boolean().nullable().optional(), qualification_notes: note(4000),
  partner_notes: note(4000), next_action: note(1000),
  follow_up_at: z.string().datetime().nullable().optional(),
  funded_amount: z.number().finite().nonnegative().nullable().optional(),
}).superRefine((data, ctx) => {
  for (const message of transitionIssues(data)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: ["stage"] });
  }
});
export type SaveFinancingCaseInput = z.infer<typeof caseInput>;

type QualificationFacts = {
  amount_requested?: number | null; use_of_funds?: string | null; monthly_deposits?: number | null;
  current_debt?: string | null; bankruptcy_status?: string | null; nsf_status?: string | null;
  receivables_contracts?: string | null; funding_urgency?: string | null; documents_ready?: boolean | null;
};
const fields = [
  ["amount_requested", "amount requested"], ["use_of_funds", "use of funds"],
  ["monthly_deposits", "monthly deposits"], ["current_debt", "current debt / advances"],
  ["bankruptcy_status", "bankruptcy answer"], ["nsf_status", "NSF history"],
  ["receivables_contracts", "receivables / active contracts"], ["funding_urgency", "funding urgency"],
  ["documents_ready", "document readiness"],
] as const;
const isKnown = (v: unknown) => v != null && (typeof v !== "string" || v.trim() !== "");
export function qualificationCompletion(facts: QualificationFacts) {
  return { done: fields.filter(([key]) => isKnown(facts[key])).length, total: fields.length };
}
export function nextMissingQualification(facts: QualificationFacts) {
  const missing = fields.find(([key]) => !isKnown(facts[key]));
  if (missing) return `Confirm ${missing[1]}`;
  return facts.documents_ready ? "Review for partner submission" : "Request required documents";
}
export function transitionIssues(data: QualificationFacts & { stage: FinancingStage; partner_notes?: string | null; funded_amount?: number | null }) {
  const issues: string[] = [];
  if (["qualified", "docs_requested", "ready_to_submit", "submitted", "approved", "funded"].includes(data.stage)) {
    if (data.amount_requested == null || data.amount_requested <= 0) issues.push("Confirm a requested amount greater than zero.");
    if (!data.use_of_funds?.trim()) issues.push("Confirm the use of funds.");
  }
  if (["ready_to_submit", "submitted", "approved", "funded"].includes(data.stage)) {
    const missing = fields.filter(([key]) => !isKnown(data[key])).map(([, label]) => label);
    if (missing.length) issues.push(`Complete qualification: ${missing.join(", ")}.`);
    if (data.documents_ready !== true) issues.push("Confirm the required documents are ready before partner review.");
  }
  if (["submitted", "approved", "funded"].includes(data.stage) && !data.partner_notes?.trim()) {
    issues.push("Record the partner confirmation or submission reference in Partner notes.");
  }
  if (data.stage === "funded" && !(data.funded_amount != null && data.funded_amount > 0)) {
    issues.push("Record the actual funded amount greater than zero.");
  }
  return issues;
}

type Milestones = { last_qualified_at?: string | null; submitted_at?: string | null; approved_at?: string | null; funded_at?: string | null };
export function milestonePatch(stage: FinancingStage, existing: Milestones | null, now: string) {
  const patch: Milestones = {};
  if (["qualified", "docs_requested", "ready_to_submit", "submitted", "approved", "funded"].includes(stage) && !existing?.last_qualified_at) patch.last_qualified_at = now;
  // A later stage is not evidence that earlier milestones were recorded.
  if (stage === "submitted" && !existing?.submitted_at) patch.submitted_at = now;
  if (stage === "approved" && !existing?.approved_at) patch.approved_at = now;
  if (stage === "funded" && !existing?.funded_at) patch.funded_at = now;
  return patch;
}

export function toLocalDateTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
}

export function parseMoney(value: string) {
  if (!value.trim()) return null;
  const clean = value.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) throw new Error("Enter a valid non-negative amount with at most two decimals.");
  const parsed = Number(clean);
  if (!Number.isFinite(parsed)) throw new Error("Enter a finite amount.");
  return parsed;
}
