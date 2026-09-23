import unittest
from origination_bridge import validate_candidate

GOOD = {
    "lead_id":"00000000-0000-4000-8000-000000000001",
    "client_id":"alkan",
    "partner_id":"randall",
    "company_name":"QA Contractor LLC",
    "activity_score":80,
    "timing_score":75,
    "partner_fit_score":70,
    "evidence_score":90,
    "contactability_score":80,
    "priority_score":78,
    "reasons":["Recent award"],
    "signals":[],
    "unknowns":["Confirm monthly deposits"],
    "verification_flags":[],
    "observed_at":"2026-09-22T00:00:00Z",
    "expires_at":"2026-10-22T00:00:00Z",
    "next_action":"Qualification call",
}

class TestBridge(unittest.TestCase):
    def test_valid(self):
        self.assertEqual(validate_candidate(dict(GOOD))["priority_score"],78)

    def test_borrower_fact_rejected(self):
        bad=dict(GOOD)
        bad["monthly_deposits"]=100000
        with self.assertRaises(ValueError):
            validate_candidate(bad)

    def test_more_than_three_reasons_rejected(self):
        bad=dict(GOOD)
        bad["reasons"]=["a","b","c","d"]
        with self.assertRaises(ValueError):
            validate_candidate(bad)

if __name__ == "__main__":
    unittest.main()
