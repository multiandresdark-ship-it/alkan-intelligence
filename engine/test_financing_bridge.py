import unittest
from financing_bridge import validate_event, submit_event
def event():
 return {"event_id":"00000000-0000-4000-8000-000000000010","lead_id":"00000000-0000-4000-8000-000000000001","client_id":"qa-only","signal":{"ruta":"TIER_S_FINANCIAMIENTO","fit":80,"need":70,"risk":10,"confianza":"medium","motivo":"QA only","ganchos":["QA public activity"],"valor_obra_12m":125000,"observed_at":"2026-09-22T00:00:00Z","sources":["https://example.invalid/qa"]}}
class Tests(unittest.TestCase):
 def test_valid(self): self.assertEqual(validate_event(event())["client_id"],"qa-only")
 def test_no_borrower_facts(self):
  for key in ["amount_requested","monthly_deposits","funded_amount","bankruptcy_status","stage"]:
   e=event();e["signal"][key]=1
   with self.assertRaises(ValueError):validate_event(e)
 def test_scores(self):
  for value in [True,-1,101,float("nan"),"90"]:
   e=event();e["signal"]["need"]=value
   with self.assertRaises(ValueError):validate_event(e)
 def test_sources(self):
  for sources in [[],["javascript:alert(1)"],["https://user:pass@example.com"]]:
   e=event();e["signal"]["sources"]=sources
   with self.assertRaises(ValueError):validate_event(e)
 def test_no_credential_redirect(self):
  for url in ["http://example.com","https://example.com","https://x.supabase.co@evil.example","https://x.supabase.co/other"]:
   with self.assertRaises(ValueError):submit_event(event(),url,"never-sent")
if __name__=="__main__":unittest.main()
