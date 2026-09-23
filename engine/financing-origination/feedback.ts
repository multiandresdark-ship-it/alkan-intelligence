import type { PartnerFeedback, SignalType } from "./types.ts";

export type SignalOutcomeSummary = {
  signal_type: SignalType;
  reviewed: number;
  submitted: number;
  approved: number;
  funded: number;
  declined: number;
  funded_rate_after_review: number;
};

export function summarizeFeedback(feedback: PartnerFeedback[]): SignalOutcomeSummary[] {
  const rows = new Map<SignalType, Omit<SignalOutcomeSummary, "signal_type" | "funded_rate_after_review">>();

  const latest=new Map<string,PartnerFeedback>();
  for(const item of feedback){const key=item.partner_id+":"+item.case_id;const prior=latest.get(key);if(!prior||Date.parse(item.decided_at)>=Date.parse(prior.decided_at))latest.set(key,item);}
  for (const item of latest.values()) {
    for (const signal of new Set(item.candidate_signal_types ?? [])) {
      const row = rows.get(signal) ?? { reviewed: 0, submitted: 0, approved: 0, funded: 0, declined: 0 };
      row.reviewed += 1;
      if (item.decision === "submitted") row.submitted += 1;
      if (item.decision === "approved") row.approved += 1;
      if (item.decision === "funded") row.funded += 1;
      if (item.decision === "declined") row.declined += 1;
      rows.set(signal, row);
    }
  }

  return [...rows.entries()]
    .map(([signal_type, row]) => ({
      signal_type,
      ...row,
      funded_rate_after_review: row.reviewed ? row.funded / row.reviewed : 0,
    }))
    .sort((a, b) => b.reviewed - a.reviewed || b.funded - a.funded);
}

/**
 * Feedback is deliberately analytics-only.
 * It can inform sourcing and outreach prioritization, but it must not silently
 * become an automated underwriting or approval model.
 */
