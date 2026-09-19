import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { collectGraph } from "./graph.mjs";
import {
  findViolations,
  matchExceptions,
  validateExceptions,
  validatePolicy,
} from "./rules.mjs";

const defaultProject = fileURLToPath(new URL("../../", import.meta.url));

/** @param {object[]} diagnostics Failures. @param {number} allowedCount Existing accepted violations. @returns {object} Deterministic check result. */
function resultOf(diagnostics, allowedCount = 0) {
  const key = (value) =>
    JSON.stringify([
      value.rule,
      value.from,
      value.to,
      value.message,
      value.line,
    ]);
  const unique = new Map(diagnostics.map((value) => [key(value), value]));
  return {
    exitCode: diagnostics.length === 0 ? 0 : 1,
    diagnostics: Array.from(unique.values()).sort((a, b) =>
      key(a).localeCompare(key(b), "en"),
    ),
    allowedCount,
  };
}

/** @param {string} projectRoot Project root, independent of cwd. @returns {object} Check outcome without logging or writes. */
export function runCheck(projectRoot = defaultProject) {
  let policy;
  let exceptions;
  try {
    policy = JSON.parse(
      fs.readFileSync(
        path.join(projectRoot, "scripts/architecture/policy.json"),
        "utf8",
      ),
    );
    exceptions = JSON.parse(
      fs.readFileSync(
        path.join(projectRoot, "scripts/architecture/exceptions.json"),
        "utf8",
      ),
    );
  } catch (error) {
    return resultOf([
      {
        rule: "invalid-config",
        from: "scripts/architecture",
        to: "",
        line: 1,
        message: error instanceof Error ? error.message : String(error),
      },
    ]);
  }
  const graph = collectGraph(projectRoot);
  const diagnostics = [
    ...graph.diagnostics,
    ...validatePolicy(policy, graph.nodes),
    ...validateExceptions(exceptions, graph.nodes),
  ];
  if (diagnostics.length > 0) {
    return resultOf(diagnostics);
  }
  const violations = findViolations(graph, policy);
  const { unexpected, stale } = matchExceptions(violations, exceptions.entries);
  const unused = stale.map((entry) => ({
    ...entry,
    rule: "stale-exception",
    message: `Remove unused ${entry.rule} exception (#${entry.issue})`,
  }));
  return resultOf(
    [...unexpected, ...unused],
    violations.length - unexpected.length,
  );
}

/** @param {object} result Check outcome. @param {object} output Console-compatible sink. @returns {number} Exit code. */
export function reportResult(result, output) {
  for (const diagnostic of result.diagnostics) {
    const witness = diagnostic.path ? ` [${diagnostic.path.join(" -> ")}]` : "";
    const message = diagnostic.message ? `: ${diagnostic.message}` : "";
    output.error(
      `${diagnostic.rule}: ${diagnostic.from}:${diagnostic.line ?? 1} -> ${diagnostic.to}${message}${witness}`,
    );
  }
  if (result.exitCode === 0) {
    output.log(
      `architecture: passed (${result.allowedCount} approved existing violations)`,
    );
  }
  return result.exitCode;
}

/** @param {string[]} args CLI arguments. @returns {number} Process exit code. */
function main(args) {
  if (args.length === 0) {
    return reportResult(runCheck(), console);
  }
  if (
    args.length === 2 &&
    args[0] === "--project" &&
    !args[1].startsWith("--")
  ) {
    return reportResult(runCheck(path.resolve(args[1])), console);
  }
  console.error(
    "Usage: node scripts/architecture/check.mjs [--project <directory>]",
  );
  return 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = main(process.argv.slice(2));
}
