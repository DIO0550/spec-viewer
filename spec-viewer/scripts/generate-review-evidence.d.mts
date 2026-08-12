import type { AcceptanceLeaf } from "../src/tests/acceptance/review-phase-1";
type Result = Readonly<{
  leafId: string;
  os: string;
  ciJob: string;
  artifact: string;
  status: string;
}>;
export function buildEvidence(
  manifest: readonly AcceptanceLeaf[],
  results: readonly Result[],
): Readonly<{
  generatedAt: string;
  summary: Readonly<{ passed: number; required: number }>;
  records: readonly object[];
}>;
