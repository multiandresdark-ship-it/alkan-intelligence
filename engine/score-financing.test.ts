import {test} from "node:test";
import assert from "node:assert/strict";
import {buildSignalEvent} from "./score-financing.ts";
const input={lead_id:"00000000-0000-4000-8000-000000000001",client_id:"qa-only",observed_at:"2026-09-22T00:00:00Z",sources:["https://example.invalid/qa"],contractor:{nombre:"QA only",licencia_vigente:true,años_operando:5,permisos_12m:3,valor_obra_12m:125000}};
test("existing scoring becomes a traceable event without borrower facts",()=>{const e=buildSignalEvent(input);assert.ok(["low","medium","high"].includes(e.signal.confianza));assert.deepEqual(e.signal.sources,input.sources);assert.ok(!("amount_requested" in e.signal));assert.equal(e.event_id,buildSignalEvent(input).event_id);});
test("missing sources and borrower facts are rejected",()=>{assert.throws(()=>buildSignalEvent({...input,sources:[]}));assert.throws(()=>buildSignalEvent({...input,contractor:{...input.contractor,monthly_deposits:1000} as any}));});
