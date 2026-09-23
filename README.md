# ALKAN Intelligence — Randall partner workspace

Independent financing console plus the motor's evidence-ingestion boundary.
The repository was empty when this integration was prepared. This does not claim that a complete scraping/enrichment motor is deployed here.

- `apps/randall-console`: React + Vite console. Supabase authentication and tenant-scoped RLS.
- `engine/score-financing.ts`: executable adapter for the existing public-signal scorer.
- `engine/collectors`: retained SAM/WSDOT modules; live operation remains to be verified.
- `docs/MOTOR_CONTRACT.md`: input contract and scoring/ingestion commands.
- `engine/financing_bridge.py`: validates motor events; dry-run by default, explicit `--apply` to ingest.
- `supabase`: reviewed SQL for alkanhunter. Qualification facts stay separate from public signals.
- `supabase/functions/apify-bridge`: authenticated actor-run previews and idempotent source imports. See [Apify connection](docs/APIFY_CONNECTION.md).
- `docs/INTEGRATION_STATUS.md`: verified state and the remaining operational setup.

## Console

Live console: https://randall-console.vercel.app/

Production login and an existing assigned operator session were verified on 2026-09-23 UTC. See [puesta en marcha](docs/PUESTA_EN_MARCHA.md) for the remaining data and motor setup.

Node 24 recommended.

```sh
cd apps/randall-console
npm ci
# Copy .env.example to .env and set only the public project URL and publishable key.
npm test
npm run build
npm run dev
```

The user must exist in Supabase Auth and have a client_profiles assignment, using the existing alkanhunter access model. An unassigned account gets an explicit access message; the application never self-grants access.

## Motor handoff

The motor supplies public source evidence. It does not supply requested loan amounts, bank deposits, bankruptcy/NSF answers, underwriting decisions, or funded amounts.

```sh
python engine/financing_bridge.py path/to/events.json
python engine/financing_bridge.py path/to/events.json --apply
```

For actual ingestion, set server-only credentials in the motor host's secret manager. Never copy them into the browser or commit them. Leads must already exist and belong to the supplied client ID. The RPC rejects duplicate IDs with different content, old observations, and borrower fact fields.

## Hosting

The console is a static Vite build (`dist`). Vercel configuration is included. Publishing and account onboarding are tracked separately from a passing local build.
