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
 for(const url of ['javascript:alert(1)','https://user:secret@example.com/']){
  const x=normalize('serp',{nombre_contacto_o_empresa:'Example Roofing',url},run,0);
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
