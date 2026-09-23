import {extractedPhones} from "@/lib/contact-evidence";
export function ContactEvidence({evidence,compact=false}:{evidence:Record<string,any>;compact?:boolean}){
 const phones=extractedPhones(evidence);
 if(!phones.length)return compact?null:<p className="text-sm text-muted-foreground">No usable phone was found in the source output.</p>;
 return <div className="space-y-2">{phones.map(p=><div key={p.dial} className={compact?"text-xs text-muted-foreground":"rounded-lg border border-border bg-surface-1 p-4"}>
 {compact?<span>Extracted phone: {p.phone} · unverified</span>:<><a className="font-semibold text-primary underline" href={"tel:"+p.dial}>{p.phone}</a><p className="mt-1 text-xs">{p.role}</p><p className="mt-2 text-xs text-muted-foreground">{p.source}{p.document?" · "+p.document:""}{p.observed_at?" · "+new Date(p.observed_at).toLocaleDateString():""}</p></>}
 </div>)}</div>;
}
