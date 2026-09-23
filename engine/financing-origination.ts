import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { buildFinancingCandidate } from "./financing-origination/prioritizer.ts";
import type { ContractorSnapshot, PartnerBox } from "./financing-origination/types.ts";

type Input = {
  partner: PartnerBox;
  contractors: ContractorSnapshot[];
};

export function buildCandidateBatch(input: Input) {
  if (!input?.partner || !Array.isArray(input.contractors)) {
    throw new Error("Input must contain partner and contractors.");
  }
  return input.contractors
    .map((snapshot) => buildFinancingCandidate(snapshot, input.partner))
    .sort((a, b) => b.priority_score - a.priority_score);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath || !outputPath) {
    throw new Error("Usage: node engine/financing-origination.ts input.json candidates.json");
  }

  const input = JSON.parse(readFileSync(inputPath, "utf8")) as Input;
  const candidates = buildCandidateBatch(input);
  writeFileSync(outputPath, JSON.stringify(candidates, null, 2) + "\n");

  console.log(JSON.stringify({
    candidates: candidates.length,
    high_priority: candidates.filter((c) => c.priority_score >= 75).length,
    output: outputPath,
  }));
}
