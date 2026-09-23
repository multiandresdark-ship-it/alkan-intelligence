# Integration status — 2026-09-22/23

## Implemented and verified
- Production: https://randall-console.vercel.app/ (Vercel, independent project `randall-console`).
- Public URL returns HTTP 200; login renders. An existing assigned operator signed in and opened the live workspace.
- Anonymous financing-case access returns HTTP 401. The verified workspace had no leads or cases; no pilot data was invented.
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
- Browser QA uses intercepted synthetic fixtures only; no test borrowers are written to production.
- Transactional database tests rolled back and passed the invalid-funding, milestone-preservation, idempotency and cross-client checks.

## Motor code retained
The Partner Mode and supplied v7 packages contain identical SAM, WSDOT, Owner360 and principal hunting implementations. The v7 name does not indicate a separate hosted motor.
This repository reuses the existing capital scorer and SAM/WSDOT public-source modules; it adds an executable event producer and a validated Supabase bridge.
The original complete Lovable/TanStack package remains preserved locally. Its admin/RLS schema and service integrations are not assumed compatible with alkanhunter.

## Still needed for an operational pilot
1. Load the agreed real pilot contacts or supply source records from the motor.
2. Set up Randall's own account if it differs from the operator account already verified. Existing access was reused; no new privileges or invitations were created.
3. Configure server-only motor credentials on its actual host; run one real lead through scoring -> ingestion -> console.
4. Collect Randall's actual financing criteria, required documents and rejection reasons at the meeting.
5. Verify one real contact and one motor signal end to end after real records are available. No sample prospects or funded outcomes are seeded.
6. Schedule/operate the original enrichment and discovery jobs once their host, credentials and source contract are confirmed. No scraper jobs are claimed live.
7. WSDOT filter/pagination remains unverified; the supplied notes only establish detail-page evidence. SAM/WSDOT live endpoint behavior has not been revalidated in this release.

## Existing platform advisory notices
Supabase reported pre-existing notices for pg_net in public, the authenticated get_my_client_id security-definer helper, and disabled leaked-password protection.
The existing tenant helper was reused without expanding its privileges. Those platform settings were not changed as part of the console release.

## Scope boundaries
Public activity is a sourcing signal, not underwriting or proof of monthly deposits or financing need.
This console records document readiness and decision notes; it does not store borrower documents, send outreach, issue financing decisions, charge customers or process payments.
