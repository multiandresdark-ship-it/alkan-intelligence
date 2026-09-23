import test from "node:test";
import assert from "node:assert/strict";
import { buildCandidateBatch } from "./financing-origination.ts";
import type { ContractorSnapshot, PartnerBox } from "./financing-origination/types.ts";

const partner: PartnerBox = {
  partner_id: "randall",
  client_id: "alkan",
  name: "Randall",
  allowed_states: ["WA"],
  allowed_industries: ["construction", "framing", "concrete", "roofing"],
  min_years_in_business: 2,
};

const strong: ContractorSnapshot = {
  lead_id: "00000000-0000-4000-8000-000000000001",
  client_id: "alkan",
  company_name: "Strong Contractor LLC",
  state: "WA",
  industry: "construction",
  years_in_business: 6,
  license_active: true,
  entity_active: true,
  permits_30d: 3,
  permits_90d: 6,
  permits_12m: 9,
  concurrent_projects: 3,
  observed_work_value_12m: 900000,
  recent_award_value: 350000,
  project_starts_30d: 1,
  project_starts_60d: 2,
  owner_resolved: true,
  phone_verified: true,
  email_verified: true,
  evidence: [
    { url: "https://example.com/source-a", observed_at: "2026-09-22T12:00:00Z" },
    { url: "https://example.org/source-b", observed_at: "2026-09-22T13:00:00Z" },
  ],
};

test("strong evidence produces a high-priority candidate without inventing borrower facts", () => {
  const [candidate] = buildCandidateBatch({ partner, contractors: [strong] });
  assert.ok(candidate.priority_score >= 75);
  assert.ok(candidate.reasons.length <= 3);
  assert.ok(candidate.unknowns.includes("Confirm monthly deposits"));
  assert.equal((candidate as any).amount_requested, undefined);
  assert.equal((candidate as any).monthly_deposits, undefined);
});

test("risk / verification flags do not become an approval decision", () => {
  const [candidate] = buildCandidateBatch({
    partner,
    contractors: [{ ...strong, license_active: false }],
  });
  assert.ok(candidate.verification_flags.some((x) => x.toLowerCase().includes("license")));
  assert.equal((candidate as any).approved, undefined);
});
