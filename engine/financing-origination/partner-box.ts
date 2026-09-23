import type { ContractorSnapshot, PartnerBox, PartnerFit } from "./types.ts";

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const norm = (v: string | null | undefined) => String(v ?? "").trim().toLowerCase();

export function evaluatePartnerFit(snapshot: ContractorSnapshot, box: PartnerBox): PartnerFit {
  if (snapshot.client_id !== box.client_id) {
    throw new Error("Partner box and contractor snapshot must belong to the same client workspace.");
  }

  let score = 50;
  const reasons: string[] = [];
  const unknowns: string[] = [];
  const verification_flags: string[] = [];

  if (box.allowed_states?.length) {
    if (!snapshot.state) unknowns.push("Confirm operating state");
    else if (box.allowed_states.map(norm).includes(norm(snapshot.state))) {
      score += 15;
      reasons.push(`State fits ${box.name}'s box.`);
    } else {
      score -= 35;
      verification_flags.push(`State ${snapshot.state} is outside the configured partner box.`);
    }
  }

  if (box.allowed_industries?.length) {
    const observed = norm(snapshot.industry || snapshot.trade);
    if (!observed) unknowns.push("Confirm industry / trade");
    else if (box.allowed_industries.map(norm).some((i) => observed.includes(i) || i.includes(observed))) {
      score += 15;
      reasons.push("Observed industry fits the configured partner box.");
    } else {
      score -= 20;
      verification_flags.push("Observed industry may be outside the configured partner box.");
    }
  }

  if (box.min_years_in_business != null) {
    if (snapshot.years_in_business == null) unknowns.push("Confirm time in business");
    else if (snapshot.years_in_business >= box.min_years_in_business) {
      score += 15;
      reasons.push(`Business age meets the configured ${box.min_years_in_business}+ year threshold.`);
    } else {
      score -= 25;
      verification_flags.push("Observed business age is below the configured partner threshold.");
    }
  }

  if (snapshot.license_active === true) {
    score += 5;
    reasons.push("Contractor license is observed active.");
  } else if (snapshot.license_active === false) {
    verification_flags.push("Contractor license is observed inactive; verify before outreach.");
  } else {
    unknowns.push("Verify contractor license status");
  }

  if (snapshot.entity_active === false) {
    verification_flags.push("Business entity appears inactive; verify before outreach.");
  }

  // Requested amount and monthly deposits are intentionally not inferred from public data.
  if (box.min_requested_amount != null || box.max_requested_amount != null) {
    unknowns.push("Confirm requested financing amount on the call");
  }
  unknowns.push("Confirm actual financing requirement", "Confirm requested financing amount", "Confirm monthly deposits", "Confirm current debt / advances", "Confirm bankruptcy / NSF answers");
  for(const document of box.required_documents??[])unknowns.push("Confirm document readiness: "+document);

  return {
    score: clamp(score),
    reasons: [...new Set(reasons)],
    unknowns: [...new Set(unknowns)],
    verification_flags: [...new Set(verification_flags)],
  };
}
