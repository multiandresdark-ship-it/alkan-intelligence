"""Validated financing-candidate -> Supabase bridge. Dry-run unless --apply."""
import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid

REQUIRED = {
    "lead_id","client_id","partner_id","company_name",
    "activity_score","timing_score","partner_fit_score","evidence_score","contactability_score","priority_score",
    "reasons","signals","unknowns","verification_flags","observed_at","expires_at","next_action"
}

FORBIDDEN = {
    "amount_requested","monthly_deposits","current_debt","bankruptcy_status",
    "nsf_status","funded_amount","approved","approval_probability"
}

def validate_candidate(candidate):
    if not isinstance(candidate, dict):
        raise ValueError("Candidate must be an object.")
    missing = REQUIRED - set(candidate)
    if missing:
        raise ValueError("Missing candidate fields: " + ", ".join(sorted(missing)))
    if FORBIDDEN & set(candidate):
        raise ValueError("Borrower facts / approval fields are forbidden in origination candidates.")
    uuid.UUID(str(candidate["lead_id"]))
    for key in ("client_id","partner_id","company_name","observed_at","expires_at","next_action"):
        if not isinstance(candidate[key], str) or not candidate[key].strip():
            raise ValueError(key + " must be a nonempty string.")
    for key in ("activity_score","timing_score","partner_fit_score","evidence_score","contactability_score","priority_score"):
        value = candidate[key]
        if isinstance(value, bool) or not isinstance(value, (int,float)) or not 0 <= value <= 100:
            raise ValueError(key + " must be between 0 and 100.")
    for key in ("reasons","signals","unknowns","verification_flags"):
        if not isinstance(candidate[key], list):
            raise ValueError(key + " must be an array.")
    if len(candidate["reasons"]) > 3:
        raise ValueError("At most three why-now reasons are allowed.")
    return candidate

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise RuntimeError("Unexpected API redirect refused.")

def submit(candidate, api_url, service_key):
    validate_candidate(candidate)
    url = urllib.parse.urlparse(api_url)
    if url.scheme != "https" or not url.hostname or not url.hostname.endswith(".supabase.co"):
        raise ValueError("SUPABASE_URL must be a Supabase HTTPS origin.")
    headers = {"Content-Type":"application/json","apikey":service_key}
    if not service_key.startswith("sb_secret_"):
        headers["Authorization"] = "Bearer " + service_key
    body = json.dumps({"p_candidate":candidate}, allow_nan=False).encode()
    request = urllib.request.Request(
        api_url.rstrip("/") + "/rest/v1/rpc/ingest_financing_candidate",
        data=body,
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.build_opener(NoRedirect).open(request, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError("Candidate ingestion rejected (HTTP %s): %s" % (error.code, detail[:500])) from None

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", help="Candidate JSON object or array")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    with open(args.input, encoding="utf-8") as file:
        candidates = json.load(file)
    if not isinstance(candidates, list):
        candidates = [candidates]

    for candidate in candidates:
        validate_candidate(candidate)

    if not args.apply:
        print(json.dumps({"mode":"dry-run","valid_candidates":len(candidates),"writes":0}))
        return

    url = os.environ.get("SUPABASE_URL","")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY","")
    if not url or not key:
        raise ValueError("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the motor host.")

    for candidate in candidates:
        result = submit(candidate,url,key)
        print(json.dumps({
            "lead_id":candidate["lead_id"],
            "company_name":candidate["company_name"],
            "priority_score":candidate["priority_score"],
            "result":result,
        }))

if __name__ == "__main__":
    try:
        main()
    except (ValueError,TypeError,KeyError,OSError,RuntimeError) as error:
        print(str(error),file=sys.stderr)
        sys.exit(1)
