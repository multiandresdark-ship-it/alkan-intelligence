# ALKAN Financing Origination Engine v3

This layer sits in front of the existing Randall Partner Mode console.

## Goal

Continuously turn traceable public construction activity into a ranked list of contractors worth a **qualification call**.

It does **not** infer or invent borrower facts such as:
- requested loan amount
- monthly deposits
- current debt
- bankruptcy / NSF answers
- approval likelihood
- funded amount

Those remain in `financing_cases` only after a real conversation or partner decision.

## Flow

```text
public sources
  -> identity / source normalization
  -> financing signal engine
  -> partner box
  -> opportunity prioritizer
  -> Funding Radar
  -> human qualification call
  -> financing_cases
  -> partner decision
  -> feedback analytics
```

## Priority model

```text
ACTIVITY        30%
TIMING          25%
PARTNER FIT     25%
EVIDENCE        10%
CONTACTABILITY  10%
```

Verification flags remain outside the priority score so the system does not drift into pseudo-underwriting.

## Run locally

Node 24 can execute the TypeScript entrypoint directly:

```powershell
node engine/financing-origination.ts input.json candidates.json
node --test engine/financing-origination.test.ts
```

## Input

```json
{
  "partner": {
    "partner_id": "randall",
    "client_id": "alkan",
    "name": "Randall",
    "allowed_states": ["WA"],
    "allowed_industries": ["construction"],
    "min_years_in_business": 2
  },
  "contractors": []
}
```

## Output

Each candidate contains:
- evidence-backed signals
- freshness / expiry
- activity score
- timing score
- partner-fit score
- evidence score
- contactability score
- final outreach priority
- up to 3 "why now" reasons
- unknowns that must be asked
- verification flags
- next action

## Automatic financing case creation

Recommended next database step:

When a candidate crosses a configured outreach threshold (for example 75+) and has fresh evidence, create **only an empty `financing_cases` shell** with:

```text
client_id
lead_id
partner_name
stage = new
next_action = qualification call
```

Do not copy public-signal estimates into confirmed borrower fields.

The existing `UNIQUE(client_id, lead_id)` constraint should be used to make this idempotent.

## Feedback

`feedback.ts` summarizes which signal types are associated with partner review, submission, approval and funding.

This feedback may tune **sourcing and outreach priority**. It must not silently become an automated loan-approval model.
