import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize} from './normalize.ts';
const run={id:'runExample00001',actId:'actorExample0001',startedAt:'2026-09-03T12:00:00Z',finishedAt:'2026-09-21T12:00:00Z'};

test('permit fallback never promotes an extracted owner or contact',()=>{
 const x=normalize('accela',{permit_number:'7042001-CN',status:'ok',timestamp:'2026-09-03T13:00:00Z',llm_data:{owner_name:'Address',owner_phone:'2060000000',capital_score:99},lead_payload:{client_id:'another',phone:'2060000000'}},run,0);
 assert.ok(x.record);assert.equal(x.record.name,'Permit 7042001-CN');assert.equal(x.record.company,null);assert.equal(x.record.phone,null);
 assert.equal(x.observed_at,'2026-09-03T13:00:00.000Z');assert.equal(x.record.evidence.review_status,'unverified');
 assert.equal(x.record.evidence.extracted.capital_score,undefined);assert.equal((x.record as any).client_id,undefined);
});

test('summary and failed extraction rows are excluded',()=>{
 assert.ok(normalize('accela',{summary:{total:22}},run,22).skip);
 assert.ok(normalize('accela',{permit_number:'7042001-CN',status:'failed'},run,1).skip);
});

test('unknown observation stays unknown after resurrection',()=>{
 const x=normalize('accela',{permit_number:'7042001-CN',status:'ok'},run,0);
 assert.equal(x.observed_at,null);
});

test('untrusted source protocols and embedded credentials are rejected',()=>{
 for(const sourceUrl of ['javascript:alert(1)','https://user:secret@example.com/']){
  const x=normalize('serp',{nombre_contacto_o_empresa:'Example Roofing',url:sourceUrl},run,0);
  assert.equal(x.record?.evidence.source_url,null);
 }
});

test('digital analysis retains identity but never becomes a financial fact',()=>{
 const x=normalize('digital',{negocio:'Example Roofing',lead_id:'00000000-0000-4000-8000-000000000001',url:'https://example.com',inversion:'high',annual_revenue:900000,consent:true},run,0);
 assert.equal(x.record?.lead_id,'00000000-0000-4000-8000-000000000001');
 assert.equal(x.record?.evidence.extracted.annual_revenue,undefined);assert.equal(x.record?.evidence.extracted.consent,undefined);
});

test('malformed and junk identities do not enter the lead store',()=>{
 for(const raw of [null,[],{}, {nombre_contacto_o_empresa:'Address'}])assert.ok(normalize('serp',raw,run,0).skip);
});

test('WA enrichment preserves verified public evidence without borrower facts',()=>{
 const x=normalize('wa_enrichment',{
  input:{company_name:'PNW POST FRAME LLC',ubi:'604893720',license_number:'PNWPOPF783J7',phone:'5094649306',city:'COLBERT',trade:'GENERAL',lead_id:'00000000-0000-4000-8000-000000000001'},
  identity:{legal_name:'PNW POST FRAME LLC',ubi:'604893720',license_number:'PNWPOPF783J7',identity_confidence:'high',corroborated_sources:3,aliases_observed:['UBI/Account ID #'],conflicts:[{type:'LEGAL_NAME_CONFLICT',canonical:'PNW POST FRAME LLC',observed:'UBI/Account ID #'}]},
  principals:[{name:'LEWIS, JENSEN',role:'PARTNER/MEMBER',source:'WA_LNI_VERIFY',confidence:'high'}],
  contacts:[{type:'phone',value:'5094649306',roles:['business_phone'],sources:['WA_LNI_VERIFY'],confidence:'high'}],
  business_status:{lni_license_status:'ACTIVE',workers_comp_current:true,estimated_workers:"Quarter 2 of Year 2026 '4 to 6 Workers'",public_works_training:{HasCompletedTraining:true}},
  financial_safety_boundaries:{financing_need:'UNKNOWN',revenue:'UNKNOWN',monthly_deposits:'UNKNOWN',desired_amount:'UNKNOWN'},
  activity:[{source:'WA_LNI_DOSH',type:'JOBSITE_INSPECTION',event_date:'2026-05-19',city:'Kent'}],
  evidence:[{source:'WA_LNI_VERIFY',status:'ok',source_url:'https://secure.lni.wa.gov/verify/Detail.aspx?UBI=604893720&LIC=PNWPOPF783J7&SAW=',retrieved_at:'2026-09-24T11:59:56.919Z',exact_match:{ubi:true,license:true},identity_verified:true}],
  sources:{lni:{source_url:'https://secure.lni.wa.gov/verify/Detail.aspx?UBI=604893720&LIC=PNWPOPF783J7&SAW=',retrieved_at:'2026-09-24T11:59:56.919Z',business:{city:'COLBERT'}}},
  enrichment_quality_score:83,
  unknowns:['current_email'],
  enriched_at:'2026-09-24T12:01:09.619Z'
 },run,0);
 assert.ok(x.record);
 assert.equal(x.record.identity,'wa_enrichment:ubi:604893720');
 assert.equal(x.record.company,'PNW POST FRAME LLC');
 assert.equal(x.record.lead_id,'00000000-0000-4000-8000-000000000001');
 assert.equal(x.record.phone,null);
 assert.equal(x.record.email,null);
 assert.equal(x.observed_at,'2026-09-24T12:01:09.619Z');
 assert.equal(x.record.evidence.identity.ubi,'604893720');
 assert.equal(x.record.evidence.business_status.workers_comp_current,true);
 assert.equal(x.record.evidence.activity[0].type,'JOBSITE_INSPECTION');
 assert.equal(x.record.evidence.financing_need,undefined);
 assert.equal(x.record.evidence.revenue,undefined);
 assert.equal(x.record.evidence.monthly_deposits,undefined);
 assert.equal(x.record.evidence.desired_amount,undefined);
 assert.equal(x.record.evidence.identity.conflicts[0].observed,'UBI/Account ID #');
});
