# Integration status — 2026-09-22/23

## Implemented and verified
- Production: https://randall-console.vercel.app/ (Vercel, independent project `randall-console`).
- Public URL returns HTTP 200; login renders. An existing assigned operator signed in and opened the live workspace.
- Anonymous financing-case access returns HTTP 401. Apify bridge calls without a valid user session also return HTTP 401.
- Actor Connections is deployed with three assigned actors. A live Accela import created 22 distinct permit records; repeating it reported 22 already imported and zero inserts. One summary row was skipped. Source dates remain September 3, 2026. No confirmed contacts, financial scores or financing cases were created.
- Independent Randall console targets alkanhunter (qyesctuksvtblegkinrj).
- Funding Radar, Qualification Queue, Business Intelligence, Deal Pipeline, Portfolio.
- Partner-contact intake and a dedicated Follow-up Desk; no invented financial facts.
- Optimistic concurrency checks prevent overwriting a case changed in another session.
- Follow-up inputs preserve local wall time; milestones are stamped and preserved by the database.
- Requested amounts and recorded funded amounts are displayed separately.
- Qualification and stage constraints run in the client and PostgreSQL.
- Client-scoped financing_cases RLS is installed. Anonymous access is revoked; authenticated DELETE/TRUNCATE privileges are revoked.
- Motor-only ingestion RPC is installed; preserves unrelated enrichment fields, verifies client/lead ownership, rejects stale events and conflicting retries.
- Six qualification unit tests, five Python bridge tests and two scoring adapter tests pass.
- Six Apify normalization tests pass; live transaction tests verify workspace isolation, stale observations, metadata preservation and idempotency. Fixtures were rolled back.
- Browser QA uses intercepted synthetic fixtures only; no test borrowers are written to production.
- Transactional database tests rolled back and passed the invalid-funding, milestone-preservation, idempotency and cross-client checks.

## Motor code retained
The Partner Mode and supplied v7 packages contain identical SAM, WSDOT, Owner360 and principal hunting implementations. The v7 name does not indicate a separate hosted motor.
This repository reuses the existing capital scorer and SAM/WSDOT public-source modules; it adds an executable event producer and a validated Supabase bridge.
The original complete Lovable/TanStack package remains preserved locally. Its admin/RLS schema and service integrations are not assumed compatible with alkanhunter.

## Still needed for an operational pilot
1. Review the imported public permit evidence and load the agreed real pilot contacts. The 22 permit records are not verified borrower relationships.
2. Set up Randall's own account if it differs from the operator account already verified. Existing access was reused; no new privileges or invitations were created.
3. Origination v3 now runs through the authenticated Supabase `origination-bridge`. The remaining real-data input is a resolved company plus a dated `origination_snapshot`; the current permit imports do not satisfy that contract. The CLI bridge remains available for an external motor host.
4. Collect Randall's actual financing criteria, required documents and rejection reasons at the meeting.
5. Verify one real contact and one motor signal end to end after real records are available. No sample prospects or funded outcomes are seeded.
6. Repair and validate original enrichment/discovery jobs before scheduling new runs. Completed Apify runs can now be previewed and imported manually; no scheduled scrape or automatic import is enabled.
7. WSDOT filter/pagination remains unverified; the supplied notes only establish detail-page evidence. SAM/WSDOT live endpoint behavior has not been revalidated in this release.

## Existing platform advisory notices
Supabase reported pre-existing notices for pg_net in public, the authenticated get_my_client_id security-definer helper, and disabled leaked-password protection.
The existing tenant helper was reused without expanding its privileges. Those platform settings were not changed as part of the console release.

## Scope boundaries
Public activity is a sourcing signal, not underwriting or proof of monthly deposits or financing need.
This console records document readiness and decision notes; it does not store borrower documents, send outreach, issue financing decisions, charge customers or process payments.

## Origination v3 integration validation

- Shared engine powers the CLI and the authenticated Edge Function. Activity freshness cannot be reset by adding a newer identity lookup.
- Funding Radar exposes evaluation, observation/expiry, verification flags, questions, configurable partner criteria and actual feedback history.
- Twenty of the 22 real permit records have extracted phone evidence; the UI surfaces it without claiming a verified owner match.
- Candidate writes are service-only. Tenant-scoped operators can configure their own partner box and record actual reviews. Candidate and case client/lead references are checked.
- Fresh candidates at priority >=75 can create only empty, deduplicated qualification cases. Existing borrower facts are preserved.
- Validation: 16 Node engine/normalizer tests, eight Python tests, eight console tests, TypeScript and production build passed. Fourteen browser checks passed using intercepted fixtures and zero external writes. V3 database transaction tests passed and rolled back.
- Real-data E2E boundary: no verified contractor snapshot exists among the current 22 permit imports. No production borrower or financing outcome was fabricated to make a demonstration pass.
