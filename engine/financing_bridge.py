"""Validated motor -> ALKAN financing signals bridge. Dry-run unless --apply."""
import argparse
import datetime as dt
import json
import math
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid

ROUTES = {"TIER_S_FINANCIAMIENTO", "TIER_A_BLINDAJE", "TIER_B", "NURTURE", "DESCARTE"}
SIGNAL_KEYS = {"ruta", "fit", "need", "risk", "confianza", "motivo", "ganchos", "valor_obra_12m", "observed_at", "sources"}
EVENT_KEYS = {"event_id", "lead_id", "client_id", "signal"}

def validate_event(event):
    if not isinstance(event, dict) or set(event) != EVENT_KEYS:
        raise ValueError("Each event requires exactly event_id, lead_id, client_id, signal.")
    for name in ("event_id", "lead_id"):
        uuid.UUID(str(event[name]))
    if not isinstance(event["client_id"], str) or not event["client_id"].strip() or len(event["client_id"]) > 100:
        raise ValueError("client_id must be a nonempty workspace identifier.")
    signal = event["signal"]
    if not isinstance(signal, dict) or set(signal) != SIGNAL_KEYS:
        raise ValueError("Signal fields must match the evidence contract; borrower facts are forbidden.")
    if signal["ruta"] not in ROUTES:
        raise ValueError("Invalid qualification-priority route.")
    for key in ("fit", "need", "risk"):
        value = signal[key]
        if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 <= value <= 100):
            raise ValueError(key + " must be null or a finite score from 0 to 100.")
    value = signal["valor_obra_12m"]
    if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0):
        raise ValueError("Observed work value must be null or nonnegative.")
    if signal["confianza"] not in {"low", "medium", "high"}:
        raise ValueError("Confidence must be low, medium or high.")
    if not isinstance(signal["motivo"], str) or not signal["motivo"].strip() or len(signal["motivo"]) > 2000:
        raise ValueError("A concise reason is required.")
    if not isinstance(signal["ganchos"], list) or not 1 <= len(signal["ganchos"]) <= 3 or any(not isinstance(v, str) or not v.strip() or len(v) > 500 for v in signal["ganchos"]):
        raise ValueError("Supply one to three evidence-based reasons.")
    observed = dt.datetime.fromisoformat(signal["observed_at"].replace("Z", "+00:00"))
    if observed.tzinfo is None:
        raise ValueError("observed_at must include a time zone.")
    sources = signal["sources"]
    if not isinstance(sources, list) or not 1 <= len(sources) <= 20:
        raise ValueError("At least one public source URL is required.")
    for value in sources:
        if not isinstance(value, str):
            raise ValueError("Source URLs must be strings.")
        url = urllib.parse.urlparse(value)
        if url.scheme != "https" or not url.hostname or url.username or url.password:
            raise ValueError("Source URLs must use HTTPS without credentials.")
    return event

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise RuntimeError("Unexpected API redirect refused.")

def submit_event(event, api_url, service_key):
    validate_event(event)
    url = urllib.parse.urlparse(api_url)
    if url.scheme != "https" or not url.hostname or not url.hostname.endswith(".supabase.co") or url.username or url.password or url.query or url.fragment or url.path not in ("", "/"):
        raise ValueError("SUPABASE_URL must be a Supabase HTTPS project origin.")
    headers = {"Content-Type": "application/json", "apikey": service_key}
    if not service_key.startswith("sb_secret_"):
        headers["Authorization"] = "Bearer " + service_key
    payload = {"p_event_id": event["event_id"], "p_lead_id": event["lead_id"], "p_client_id": event["client_id"], "p_signal": event["signal"]}
    request = urllib.request.Request(api_url.rstrip("/") + "/rest/v1/rpc/ingest_financing_signal", data=json.dumps(payload, allow_nan=False).encode(), headers=headers, method="POST")
    try:
        with urllib.request.build_opener(NoRedirect).open(request, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError("Signal ingestion rejected (HTTP " + str(error.code) + "). Check the workspace, lead ID, credentials and migration.") from None

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", help="JSON event or array of events; no borrower financial facts")
    parser.add_argument("--apply", action="store_true", help="Write validated signals using server-side Supabase credentials")
    args = parser.parse_args()
    with open(args.input, encoding="utf-8") as file:
        events = json.load(file)
    if not isinstance(events, list):
        events = [events]
    for event in events:
        validate_event(event)
    if len({event["event_id"] for event in events}) != len(events):
        raise ValueError("Duplicate event_id in input.")
    if not args.apply:
        print(json.dumps({"mode": "dry-run", "valid_events": len(events), "writes": 0}))
        return
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        raise ValueError("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the motor environment.")
    for event in events:
        print(json.dumps({"event_id": event["event_id"], "result": submit_event(event, url, key)}))

if __name__ == "__main__":
    try:
        main()
    except (ValueError, TypeError, KeyError, OSError, RuntimeError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
