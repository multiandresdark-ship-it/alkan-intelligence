# Motor -> Randall console contract

Keep confirmed borrower information in financing_cases. Motor output only writes leads.enrichment_data.capital.

## Generate and validate
1. Prepare an input JSON object or array with lead_id, client_id, observed_at (with timezone), sources (HTTPS public evidence URLs), and contractor (the existing ContratistaInput shape).
2. Run `node engine/score-financing.ts input.json events.json`.
3. Run `python engine/financing_bridge.py events.json` for a dry-run.
4. On the authorized motor host, configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY and run the same command with `--apply`.
5. Refresh the console. Check source evidence, observation time, confidence and reasons.

Node 24 runs the TypeScript scorer directly; no npm packages are required by these engine entrypoints. The Python bridge uses the standard library.
The event producer converts the scorer's alta/media/baja confidence to high/medium/low. It preserves unknown observed work value as null.
Observation time must come from the source run. Do not substitute a retrieval time for an old underlying record without preserving that distinction in the evidence.

## Event fields
- event_id: deterministic UUID for the normalized signal; repeated delivery is idempotent.
- lead_id: existing leads.id.
- client_id: must match the existing lead.
- signal: exactly ruta, fit, need, risk, confianza, motivo, ganchos, valor_obra_12m, observed_at, sources.
- Sources and one to three reasons are required.
- Scores are 0-100 or null. Observed work value is nonnegative or null.
- Fields such as amount_requested, monthly_deposits, bankruptcy_status, stage and funded_amount are rejected.

The database locks the target lead, checks source timestamps, records the event and merges only the capital object. No financing case is created or advanced.
Service keys remain on the motor host. Browser users cannot call the ingestion RPC.

## Retained source collectors
`engine/collectors/sam.ts` and `wsdot.ts` come from the supplied package, with the shared fetch helper import made relative.
They are source modules, not scheduled deployments. Portal availability, rate limits and the incomplete WSDOT search/pagination capture still require live verification.
