export type ContactEvidence={phone:string;dial:string;source:string;role:string;observed_at:string|null;document:string|null};
export function extractedPhones(evidence:Record<string,any>):ContactEvidence[]{
 const rows:ContactEvidence[]=[];const apify=evidence.apify??{};
 for(const [kind,raw] of Object.entries(apify)){
  if(!raw||typeof raw!=="object")continue;const e=raw as Record<string,any>,x=e.extracted??{};
  const phone=kind==="accela"?x.owner_phone:x.telefono??x.phone;
  if(typeof phone!=="string"||phone.length>100)continue;
  const digits=phone.split(/(?:ext\.?|extension|x)\s*\d+/i)[0].replace(/\D/g,"");
  if(!(digits.length===10||digits.length===11&&digits.startsWith("1")))continue;
  rows.push({phone,dial:"+"+(digits.length===10?"1":"")+digits,source:"Apify / "+kind,role:kind==="accela"?"Role unconfirmed; may belong to another project participant":"Business contact unverified",observed_at:e.observed_at??null,document:e.document??null});
 }
 return rows.filter((r,i,a)=>a.findIndex(x=>x.dial===r.dial)===i);
}
