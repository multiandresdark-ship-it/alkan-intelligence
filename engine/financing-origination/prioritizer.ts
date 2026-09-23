import type {
  ContractorSnapshot,
  FinancingCandidate,
  FinancingSignal,
  PartnerBox,
} from "./types.ts";
import { evaluatePartnerFit } from "./partner-box.ts";
import { generateFinancingSignals } from "./signal-engine.ts";

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function freshnessFactor(signal: FinancingSignal, now: Date) {
  const observed = Date.parse(signal.observed_at);
  const expires = Date.parse(signal.expires_at);
  if (!Number.isFinite(observed) || !Number.isFinite(expires) || expires <= observed) return 0;
  if (now.getTime() >= expires) return 0;
  const remaining = expires - now.getTime();
  const life = expires - observed;
  return Math.max(0.25, Math.min(1, remaining / life));
}

function evidenceScore(snapshot: ContractorSnapshot) {
  const fresh = snapshot.evidence.filter((e) => {
    const age = Date.now() - Date.parse(e.observed_at);
    return Number.isFinite(age) && age >= 0 && age <= 90 * 86_400_000;
  });
  const uniqueSources = new Set(fresh.map((e) => new URL(e.url).hostname)).size;
  return clamp(Math.min(100, fresh.length * 18 + uniqueSources * 22));
}

function contactabilityScore(snapshot: ContractorSnapshot) {
  let score = 0;
  if (snapshot.owner_resolved) score += 40;
  if (snapshot.phone_verified) score += 35;
  if (snapshot.email_verified) score += 20;
  if (snapshot.company_name?.trim()) score += 5;
  return clamp(score);
}

function activityScore(signals: FinancingSignal[], now: Date) {
  const activityTypes = new Set([
    "PERMIT_BURST",
    "PROJECT_AWARD",
    "PUBLIC_CONTRACT",
    "BACKLOG_GROWTH",
    "REPEAT_PROJECT_ACTIVITY",
    "BUSINESS_GROWTH",
  ]);
  const ranked = signals
    .filter((s) => activityTypes.has(s.signal_type))
    .map((s) => s.score * freshnessFactor(s, now))
    .sort((a, b) => b - a);
  if (!ranked.length) return 0;
  return clamp(ranked[0] * 0.7 + (ranked[1] ?? 0) * 0.3);
}

function timingScore(signals: FinancingSignal[], now: Date) {
  const timingTypes = new Set(["PROJECT_START", "PROJECT_AWARD", "PERMIT_BURST", "BOND_RENEWAL"]);
  const ranked = signals
    .filter((s) => timingTypes.has(s.signal_type))
    .map((s) => s.score * freshnessFactor(s, now))
    .sort((a, b) => b - a);
  if (!ranked.length) return 0;
  return clamp(ranked[0] * 0.8 + (ranked[1] ?? 0) * 0.2);
}

export function buildFinancingCandidate(
  snapshot: ContractorSnapshot,
  partner: PartnerBox,
  now = new Date(),
): FinancingCandidate {
  const signals = generateFinancingSignals(snapshot);
  const fit = evaluatePartnerFit(snapshot, partner);

  const activity = activityScore(signals, now);
  const timing = timingScore(signals, now);
  const evidence = evidenceScore(snapshot);
  const contactability = contactabilityScore(snapshot);

  // Weighted exactly as the operating design:
  // ACTIVITY 30 / TIMING 25 / PARTNER FIT 25 / EVIDENCE 10 / CONTACTABILITY 10.
  const priority = clamp(
    activity * 0.30 +
    timing * 0.25 +
    fit.score * 0.25 +
    evidence * 0.10 +
    contactability * 0.10,
  );

  const activeSignals = signals.filter((s) => Date.parse(s.expires_at) > now.getTime());
  const reasons = activeSignals
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.detail);

  const observed_at = activeSignals.length
    ? activeSignals.map((s) => s.observed_at).sort().at(-1)!
    : snapshot.evidence.map((e) => e.observed_at).sort().at(-1)!;

  const expires_at = activeSignals.length
    ? activeSignals.map((s) => s.expires_at).sort().at(0)!
    : new Date(Date.parse(observed_at) + 14 * 86_400_000).toISOString();

  return {
    lead_id: snapshot.lead_id,
    client_id: snapshot.client_id,
    partner_id: partner.partner_id,
    company_name: snapshot.company_name,
    activity_score: activity,
    timing_score: timing,
    partner_fit_score: fit.score,
    evidence_score: evidence,
    contactability_score: contactability,
    priority_score: priority,
    reasons: reasons.length ? reasons : ["More recent public evidence is needed before prioritizing outreach."],
    signals,
    unknowns: fit.unknowns,
    verification_flags: fit.verification_flags,
    observed_at,
    expires_at,
    next_action:
      priority >= 75
        ? "Qualification call: confirm whether upcoming work is creating a working-capital need."
        : priority >= 55
          ? "Verify missing evidence and contact data, then reassess for a qualification call."
          : "Recheck later; do not send to partner review yet.",
  };
}
