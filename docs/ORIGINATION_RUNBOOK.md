# Motor v3 operating sequence

## Console integration and deployment

The independent app is `apps/randall-console`. Funding Radar runs `origination-bridge` for the signed-in user's assigned workspace, 50 records per page. Authentication is checked with `auth.getUser`; client identity is read from `client_profiles`, never trusted from request input. Only the backend can call `ingest_financing_candidate`.

Deploy the entrypoint `supabase/functions/origination-bridge/index.ts` together with its relative imports in `engine/financing-origination/*.ts`. The source imports are shared with the CLI; there is no second implementation of scoring. The function's custom authentication permits deployment with platform JWT verification disabled while rejecting unauthenticated requests itself.

Apply `supabase/FINANCING_ORIGINATION_V3.sql` through migration tooling. It was applied to alkanhunter as `randall_financing_origination_v3`. Run `supabase/ORIGINATION_V3_TEST.sql` for rollback-only tenant, empty-shell, deduplication, stage and feedback tests. Production partner `randall` has blank criteria; configure only confirmed criteria in Funding Radar > Partner configuration & feedback.

## Required upstream evidence contract

Console evaluation requires a nonempty `leads.company` and `enrichment_data.origination_snapshot` with `identity_verified: true`, a nonempty `evidence` array of HTTP(S) source URLs and actual `observed_at` timestamps, and observed metrics matching `ContractorSnapshot` in `engine/financing-origination/types.ts`. This contract belongs to an authorized collector after business identity resolution; do not set the flag merely to make an unresolved permit pass. Missing values remain absent. Public activity is never converted into revenue, deposits, requested amounts or borrower debt.

All metrics in one snapshot must describe the same observation bundle. The earliest source date controls freshness, so a fresh identity lookup cannot refresh old activity. Future-dated, malformed and unsafe evidence is rejected. The UI displays observation and expiry dates; expired records require re-verification.

Evaluation runs when requested from the console or when the existing motor CLI is invoked. No new paid Apify run or recurring collection schedule is enabled by this integration. Once a validated candidate is ingested, the database queues an empty shell automatically only when fresh, priority >=75, signals exist, verification flags are empty and the candidate is not dismissed.

## Real-data boundary

The current 22 Accela permit imports have unresolved business identities. Twenty contain extracted phone numbers in source metadata. These are displayed with source/date and uncertain contact role; they are not promoted to confirmed owner phones. Those permits must be matched to an actual company and dated activity evidence before v3 can rank them. No fake production contractor or borrower was inserted to bypass this boundary.

## Partner feedback

Case transitions to submitted, approved, funded or not_fit append actual outcomes to `financing_partner_feedback`. Note-only edits do not append outcomes. Operators can record a real partner review and reason from the configuration panel. Aggregation counts the latest outcome once per case/partner/signal; recorded outcomes do not silently modify scoring weights.

## 1. Generate candidates

```powershell
node engine/financing-origination.ts input.json candidates.json
```

## 2. Validate without writing

```powershell
python engine/origination_bridge.py candidates.json
```

Expected:

```json
{"mode":"dry-run","valid_candidates":10,"writes":0}
```

## 3. Apply to alkanhunter from the authorized motor host

Set server-only secrets:

```powershell
$env:SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="SERVER_ONLY_SECRET"
python engine/origination_bridge.py candidates.json --apply
```

For each candidate, the RPC returns:
- candidate_id
- priority_score
- financing_case = created / already_exists / not_created
- case_id when a case exists

## Queue rule

A fresh candidate with outreach priority >= 75 can create an **empty qualification case** automatically.

That shell contains only:
- client / lead identity
- partner name
- stage=new
- next action
- source metadata

It never copies public signals into:
- amount requested
- monthly deposits
- debt
- bankruptcy / NSF
- documents ready
- funded amount

Those remain human-confirmed facts.

## Feedback rule

Partner outcomes may tune sourcing and outreach priority analytics. They do not become an approval model.
