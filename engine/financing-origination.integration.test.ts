import test from "node:test";
import assert from "node:assert/strict";
import {buildFinancingCandidate} from "./financing-origination/prioritizer.ts";
import {snapshotFromLead} from "./financing-origination/snapshot.ts";
import {summarizeFeedback} from "./financing-origination/feedback.ts";
const now=new Date("2026-09-23T12:00:00Z");
const partner={client_id:"qa",partner_id:"randall",name:"Randall",allowed_states:["WA"],required_documents:["Bank statements"]};
const source={url:"https://example.org/permit",observed_at:"2026-09-22T12:00:00Z"};
const snapshot={lead_id:"00000000-0000-4000-8000-000000000001",client_id:"qa",company_name:"QA Contractor",permits_30d:4,project_starts_30d:2,state:"WA",evidence:[source]};
test("weights, unknowns and bounded why-now are deterministic",()=>{
 const c=buildFinancingCandidate(snapshot,partner,now);
 assert.equal(c.priority_score,Math.round(c.activity_score*.3+c.timing_score*.25+c.partner_fit_score*.25+c.evidence_score*.1+c.contactability_score*.1));
 assert.ok(c.reasons.length<=3);assert.ok(c.unknowns.includes("Confirm document readiness: Bank statements"));
 assert.deepEqual(c,buildFinancingCandidate(snapshot,partner,now));
});
test("new identity evidence does not refresh an old activity bundle",()=>{
 const c=buildFinancingCandidate({...snapshot,evidence:[source,{...source,observed_at:"2025-01-01T00:00:00Z"}]},partner,now);
 assert.equal(c.activity_score,0);assert.equal(c.timing_score,0);assert.ok(Date.parse(c.expires_at)<now.getTime());
});
test("future evidence, unsafe URLs and invalid measurements are rejected",()=>{
 for(const broken of [{...snapshot,permits_30d:NaN},{...snapshot,evidence:[{...source,url:"javascript:alert(1)"}]},{...snapshot,evidence:[{...source,observed_at:"2099-01-01"}]}])assert.throws(()=>buildFinancingCandidate(broken,partner,now));
});
test("partner box cannot cross workspaces",()=>assert.throws(()=>buildFinancingCandidate(snapshot,{...partner,client_id:"other"},now)));
test("unresolved permit and unverified extracted phone never become a contractor snapshot",()=>{
 assert.equal(snapshotFromLead({name:"Permit QA-001",enrichment_data:{apify:{accela:{extracted:{owner_phone:"2065550101"}}}}}).snapshot,undefined);
 assert.equal(snapshotFromLead({company:"QA",enrichment_data:{origination_snapshot:{evidence:[source]}}}).snapshot,undefined);
 const x=snapshotFromLead({id:snapshot.lead_id,client_id:"qa",company:"QA",enrichment_data:{origination_snapshot:{identity_verified:true,evidence:[source],monthly_deposits:50000}}}).snapshot;
 assert.equal((x as any).monthly_deposits,undefined);assert.equal(x?.phone_verified,undefined);
});
test("feedback counts the latest outcome once per case and signal",()=>{
 const r=summarizeFeedback([{case_id:"a",partner_id:"p",decision:"approved",decided_at:"2026-09-21",candidate_signal_types:["PERMIT_BURST"]},{case_id:"a",partner_id:"p",decision:"funded",decided_at:"2026-09-22",candidate_signal_types:["PERMIT_BURST","PERMIT_BURST"]}]);
 assert.equal(r[0].reviewed,1);assert.equal(r[0].funded,1);
});
