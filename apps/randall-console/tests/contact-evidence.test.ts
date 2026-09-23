import test from "node:test";
import assert from "node:assert/strict";
import {extractedPhones} from "../src/lib/contact-evidence.ts";
test("source phones are visible with role uncertainty and safe dial links",()=>{
 const r=extractedPhones({apify:{accela:{observed_at:"2026-09-03",document:"Cover sheet",extracted:{owner_phone:"(206) 555-0101"}}}});
 assert.equal(r[0].dial,"+12065550101");assert.match(r[0].role,/unconfirmed/);assert.equal(r[0].document,"Cover sheet");
});
test("malformed phone and missing output remain absent",()=>{
 assert.deepEqual(extractedPhones({apify:{accela:{extracted:{owner_phone:"Address"}}}}),[]);
 assert.deepEqual(extractedPhones({}),[]);
});
