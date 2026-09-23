import type { ContractorSnapshot, FinancingSignal, SignalType, Confidence } from "./types.ts";

const DAY = 86_400_000;

function isoAfter(observedAt: string, days: number) {
  return new Date(new Date(observedAt).getTime() + days * DAY).toISOString();
}

function latestObservedAt(snapshot: ContractorSnapshot) {
  const timestamps = snapshot.evidence
    .map((s) => Date.parse(s.observed_at))
    .filter(Number.isFinite);
  if (!timestamps.length) throw new Error("At least one evidence timestamp is required.");
  // A newer identity lookup must not refresh older activity in a bundled snapshot.
  return new Date(Math.min(...timestamps)).toISOString();
}

function sources(snapshot: ContractorSnapshot) {
  return [...new Set(snapshot.evidence.map((s) => s.url))];
}

function makeSignal(
  snapshot: ContractorSnapshot,
  type: SignalType,
  title: string,
  detail: string,
  score: number,
  confidence: Confidence,
  ttlDays: number,
): FinancingSignal {
  const observed_at = latestObservedAt(snapshot);
  return {
    signal_type: type,
    title,
    detail,
    score: Math.max(0, Math.min(100, Math.round(score))),
    confidence,
    observed_at,
    expires_at: isoAfter(observed_at, ttlDays),
    source_urls: sources(snapshot),
  };
}

export function generateFinancingSignals(snapshot: ContractorSnapshot, now = new Date()): FinancingSignal[] {
  if (!snapshot.lead_id || !snapshot.client_id || !snapshot.company_name?.trim()) {
    throw new Error("lead_id, client_id and company_name are required.");
  }
  if (!Array.isArray(snapshot.evidence) || snapshot.evidence.length === 0) {
    throw new Error("Evidence is required before creating financing signals.");
  }

  const signals: FinancingSignal[] = [];

  for (const source of snapshot.evidence) {
    const url = new URL(source.url);
    const observed = Date.parse(source.observed_at);
    if (!["https:","http:"].includes(url.protocol) || url.username || url.password || !Number.isFinite(observed) || observed > now.getTime() + 300000) throw new Error("Evidence needs a public URL and a valid observation date.");
  }
  for (const key of ["years_in_business","permits_30d","permits_90d","permits_12m","concurrent_projects","observed_work_value_12m","recent_award_value","public_contracts_12m","project_starts_30d","project_starts_60d","bond_renewal_days"] as const) {
    const value=snapshot[key];
    if(value!=null&&(typeof value!=="number"||!Number.isFinite(value)||value<0))throw new Error("Invalid numeric activity field: "+key);
  }

  const permits30 = snapshot.permits_30d ?? 0;
  const permits90 = snapshot.permits_90d ?? 0;
  if (permits30 >= 3 || permits90 >= 5) {
    signals.push(makeSignal(
      snapshot,
      "PERMIT_BURST",
      "Recent permit burst",
      `${permits30} permit(s) observed in 30 days and ${permits90} in 90 days.`,
      Math.min(100, 55 + permits30 * 8 + permits90 * 3),
      permits30 >= 3 ? "high" : "medium",
      45,
    ));
  }

  const starts30 = snapshot.project_starts_30d ?? 0;
  const starts60 = snapshot.project_starts_60d ?? 0;
  if (starts30 > 0 || starts60 >= 2) {
    signals.push(makeSignal(
      snapshot,
      "PROJECT_START",
      "Near-term project starts",
      `${starts30} project start(s) inside 30 days and ${starts60} inside 60 days.`,
      Math.min(100, 60 + starts30 * 15 + starts60 * 5),
      starts30 > 0 ? "high" : "medium",
      30,
    ));
  }

  const concurrent = snapshot.concurrent_projects ?? 0;
  if (concurrent >= 2) {
    signals.push(makeSignal(
      snapshot,
      "REPEAT_PROJECT_ACTIVITY",
      "Concurrent project activity",
      `${concurrent} concurrent projects are currently observed.`,
      Math.min(100, 50 + concurrent * 10),
      concurrent >= 3 ? "high" : "medium",
      45,
    ));
  }

  const award = snapshot.recent_award_value ?? 0;
  if (award > 0) {
    signals.push(makeSignal(
      snapshot,
      "PROJECT_AWARD",
      "Recent project award",
      `Recent observed award value: $${Math.round(award).toLocaleString("en-US")}.`,
      award >= 250_000 ? 90 : award >= 100_000 ? 78 : 65,
      award >= 100_000 ? "high" : "medium",
      60,
    ));
  }

  const publicContracts = snapshot.public_contracts_12m ?? 0;
  if (publicContracts > 0) {
    signals.push(makeSignal(
      snapshot,
      "PUBLIC_CONTRACT",
      "Public contract activity",
      `${publicContracts} public contract(s) observed in the last 12 months.`,
      Math.min(100, 55 + publicContracts * 8),
      publicContracts >= 2 ? "high" : "medium",
      90,
    ));
  }

  const workValue = snapshot.observed_work_value_12m ?? 0;
  if (workValue >= 250_000) {
    signals.push(makeSignal(
      snapshot,
      "BACKLOG_GROWTH",
      "Meaningful observed work volume",
      `Approximately $${Math.round(workValue).toLocaleString("en-US")} in observed project activity over 12 months.`,
      workValue >= 1_000_000 ? 95 : workValue >= 500_000 ? 82 : 68,
      workValue >= 500_000 ? "high" : "medium",
      90,
    ));
  }

  const renewal = snapshot.bond_renewal_days;
  if (renewal != null && renewal >= 0 && renewal <= 90) {
    signals.push(makeSignal(
      snapshot,
      "BOND_RENEWAL",
      "Bond renewal approaching",
      `Observed bond renewal is approximately ${renewal} day(s) away.`,
      renewal <= 30 ? 72 : 58,
      "medium",
      Math.max(14, Math.min(90, renewal + 14)),
    ));
  }

  const years = snapshot.years_in_business ?? 0;
  const permits12 = snapshot.permits_12m ?? 0;
  if (years >= 2 && permits12 >= 4 && workValue >= 150_000) {
    signals.push(makeSignal(
      snapshot,
      "BUSINESS_GROWTH",
      "Established business with active project flow",
      `${years} year(s) in business with ${permits12} permit(s) and active observed work.`,
      Math.min(100, 55 + Math.min(years, 10) * 2 + Math.min(permits12, 10) * 3),
      "medium",
      90,
    ));
  }

  return signals.sort((a, b) => b.score - a.score);
}
