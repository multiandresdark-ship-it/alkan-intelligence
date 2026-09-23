# Apify to Randall console

The console imports completed runs through the Supabase `apify-bridge` Edge Function. No token enters the browser. Actor runs are not started or scheduled by this integration.

## Configuration

1. Apply `supabase/APIFY_ACTOR_INGEST.sql` once after the existing workspace migrations.
2. Deploy `supabase/functions/apify-bridge/index.ts` with `normalize.ts`. The function validates each bearer token with Supabase Auth and resolves its assigned client before any data access. Gateway JWT verification is disabled because authentication is performed in the function.
3. Store `APIFY_TOKEN` in the project's Edge Function secrets. The existing deployment also accepts the legacy secret label `alkan leads`; it never returns either value. Supabase URL, anon key and service-role key are supplied by the Edge runtime.
4. Assign the correct actor IDs to each client in `apify_actor_bindings`. Only administrators can change assignments.
5. In the console, open **Actor Connections**, select an actor and a successful run, preview the records, then import each page.

The initial `alkan` bindings are:

| Actor | Kind | Behavior |
| --- | --- | --- |
| TjhMWf7k2yBWa9cxz | SERP discovery | Creates unverified business evidence |
| ARWSQq6yrTyaMbDND | Digital profile | Updates one existing business in the same workspace; unmatched rows are skipped |
| mbyWbXzahJnDWasbB | Legacy Seattle Accela | Imports permit identities and unverified document extraction |

## Ingestion boundary

The bridge checks that the run belongs to an assigned actor and is `SUCCEEDED`. It reads 25 rows per page, skips summary/error rows, and normalizes an explicit field allowlist. `ingest_apify_record` is service-only, deduplicates each run/item and source identity, rejects older observations, and preserves unrelated lead metadata. Database tests run in a rolled-back transaction.

Extracted owner names, phones and email addresses remain labeled evidence. They do not become confirmed contacts, borrower facts, financing scores, consent or partner decisions. Legacy Accela output requires review: a successful run can still contain failed AI extraction. A resurrected run's finish date never replaces the original record observation date.

No Gemini or OpenAI key is needed to import already completed runs. Repairing or launching the original actors is a separate operation. There are no webhooks or scheduled imports in this version.

## Verification

Live production verification on September 23, 2026 UTC: the assigned operator imported Accela run `hfcK46LqzbH90dgDb`. The first import inserted 22 distinct permits and skipped one summary row. Repeating it inserted zero and reported 22 already imported. Database checks found zero promoted contacts, zero financing scores and zero financing cases. Observations retained their original September 3 timestamps.

The same connection returned two failed SERP runs and no available Digital Profile runs. Actor assignment and an accepted API request do not establish healthy collection or usable output. The next operational work is to repair SERP, verify availability of digital-profile outputs, and replace or repair legacy Accela extraction before collecting a new batch.

Run `supabase/APIFY_INGEST_TEST.sql` with an administrator SQL connection to reproduce rolled-back integration assertions. No test data remains after the transaction.

```sh
node --test supabase/functions/apify-bridge/normalize.test.ts
cd apps/randall-console
npm test
npm run build
```

For a live test, preview a completed run, import once, then import the same page again. The second request should report `already imported` with no extra leads. Confirm evidence under Business Intelligence and confirm that the financing case count is unchanged.
