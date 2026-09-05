#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const resultKey = ({ leafId, os, ciJob, artifact }) =>
  `${leafId}|${os}|${ciJob}|${artifact}`;

/** Builds complete, one-result-per-target Issue #199 acceptance evidence. */
export function buildEvidence(manifest, results) {
  const indexed = new Map();
  for (const result of results) {
    const key = resultKey(result);
    if (indexed.has(key)) throw new Error(`duplicate evidence for ${key}`);
    indexed.set(key, result);
  }
  const records = manifest.flatMap((leaf) =>
    leaf.targets.map((target) => {
      const key = resultKey({ leafId: leaf.id, ...target });
      const result = indexed.get(key);
      if (!result) throw new Error(`missing evidence for ${key}`);
      if (result.status !== "passed")
        throw new Error(`non-passing evidence for ${key}`);
      return {
        leafId: leaf.id,
        requirement: leaf.requirement,
        runner: leaf.runner,
        selector: leaf.selector,
        ...target,
        status: result.status,
      };
    }),
  );
  if (indexed.size !== records.length)
    throw new Error("evidence contains undeclared results");
  return {
    generatedAt: new Date().toISOString(),
    summary: { passed: records.length, required: records.length },
    records,
  };
}

function runCli() {
  const inputs = process.argv.slice(2).filter((token) => token !== "--");
  if (inputs.length === 0)
    throw new Error("provide one or more result JSON paths");
  const manifest = JSON.parse(
    readFileSync(
      new URL(
        "../src/tests/acceptance/review-phase-1.generated.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const results = inputs.flatMap((path) =>
    JSON.parse(readFileSync(path, "utf8")),
  );
  writeFileSync(
    "evidence.json",
    `${JSON.stringify(buildEvidence(manifest, results), null, 2)}\n`,
    { flag: "wx" },
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  runCli();
