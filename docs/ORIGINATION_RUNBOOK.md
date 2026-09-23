# Motor v3 operating sequence

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
