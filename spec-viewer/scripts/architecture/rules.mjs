import path from "node:path";
import { isBuiltin } from "node:module";

const presentationFolders = new Set([
  "presentation",
  "components",
  "context",
  "hooks",
  "presenters",
]);
const sharedFolders = new Set([
  "shared",
  "lib",
  "hooks",
  "components",
  "types",
  "domains",
]);

/** @param {string} file Canonical module name. @returns {boolean} Whether module is test-only. */
function isTest(file) {
  return (
    /\.(?:test|spec|stories)\.[^/]+$/.test(file) ||
    /(?:^|\/)__tests__\//.test(file) ||
    file.startsWith("src/tests/")
  );
}

/** @param {string} file Canonical module name. @returns {object} Boundary classification. */
function classify(file) {
  if (
    file.startsWith("src/app/") ||
    ["src/App.tsx", "src/main.tsx"].includes(file)
  ) {
    return { layer: "app" };
  }
  const parts = file.split("/");
  if (parts[0] !== "src") {
    return { layer: "other" };
  }
  if (parts[1] === "features") {
    const folder = parts[3];
    const layer = presentationFolders.has(folder) ? "presentation" : folder;
    return { feature: parts[2], layer };
  }
  return { layer: sharedFolders.has(parts[1]) ? "shared" : "other" };
}

/** @param {string} target Canonical package name. @returns {boolean} Known framework or transport. */
function framework(target) {
  return /^npm:(?:react(?:-dom)?(?:\/|$)|@tauri-apps\/)/.test(target);
}

/** @param {object} value Violation or exception. @returns {string} Exact tuple key. */
export function violationKey(value) {
  return JSON.stringify([value.rule, value.from, value.to]);
}

/** @param {object} input Classified source and target. @returns {boolean} Disallowed layer direction. */
function reverseLayer({ source, target, to }) {
  if (!source.feature) {
    return false;
  }
  if (target.layer === "app") {
    return true;
  }
  if (source.layer === "application" && framework(to)) {
    return true;
  }
  if (source.feature !== target.feature) {
    return false;
  }
  const forbidden = {
    application: ["infra", "presentation"],
    infra: ["presentation"],
    presentation: ["infra"],
  };
  return forbidden[source.layer]?.includes(target.layer) ?? false;
}

/** @param {object} graph Resolved imports. @param {object} policy Approved entries. @returns {Array} Violations, sorted by tuple. */
export function findViolations(graph, policy) {
  const violations = new Map();
  const domainApis = new Set(policy.domainPublicApis.map((item) => item.entry));
  const kernelOf = (file) =>
    policy.kernelEntries.find((item) =>
      file.startsWith(item.entry.slice(0, -"index.ts".length)),
    )?.entry;
  const add = (rule, edge) => {
    const violation = {
      rule,
      from: edge.from,
      to: edge.to,
      line: edge.line,
      path: [edge.from, edge.to],
    };
    violations.set(violationKey(violation), violation);
  };
  for (const edge of graph.edges) {
    if (!edge.from.startsWith("src/")) {
      continue;
    }
    const source = classify(edge.from);
    const target = classify(edge.to);
    if (source.layer === "shared" && target.feature) {
      add("shared-to-feature", edge);
    }
    const publicApi =
      /^src\/features\/[^/]+\/index\.ts$/.test(edge.to) ||
      domainApis.has(edge.to);
    if (target.feature && source.feature !== target.feature && !publicApi) {
      add("feature-public-api", edge);
    }
    const targetKernel = kernelOf(edge.to);
    if (
      targetKernel &&
      targetKernel !== edge.to &&
      kernelOf(edge.from) !== targetKernel
    ) {
      add("kernel-public-api", edge);
    }
    if (reverseLayer({ source, target, to: edge.to })) {
      add("layer-direction", edge);
    }
    if (!isTest(edge.from) && isTest(edge.to)) {
      add("production-to-test", edge);
    }
  }
  const adjacency = new Map();
  for (const edge of graph.edges.toSorted((a, b) =>
    JSON.stringify(a).localeCompare(JSON.stringify(b), "en"),
  )) {
    const outgoing = adjacency.get(edge.from) ?? [];
    outgoing.push(edge);
    adjacency.set(edge.from, outgoing);
  }
  const kernels = new Set(policy.kernelEntries.map((item) => item.entry));
  const pure = new Set(
    policy.pureExternals.map((item) => `npm:${item.package}`),
  );
  for (const origin of graph.nodes.toSorted()) {
    if (isTest(origin)) {
      continue;
    }
    const root = classify(origin);
    const domainRoot = root.feature && root.layer === "domain";
    if (!domainRoot && !kernelOf(origin)) {
      continue;
    }
    const rule = domainRoot ? "domain-dependency" : "kernel-dependency";
    const queue = [{ node: origin, path: [origin], line: undefined }];
    const visited = new Set([origin]);
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      for (const edge of adjacency.get(current.node) ?? []) {
        const source = classify(edge.from);
        const target = classify(edge.to);
        const sameDomain =
          domainRoot &&
          target.layer === "domain" &&
          (target.feature === root.feature ||
            (target.feature === source.feature &&
              domainApis.has(
                `src/features/${source.feature}/domain/index.ts`,
              )));
        const domainEntry = domainRoot && domainApis.has(edge.to);
        const sameKernel =
          kernelOf(edge.from) !== undefined &&
          kernelOf(edge.from) === kernelOf(edge.to);
        const approved =
          sameDomain ||
          domainEntry ||
          sameKernel ||
          kernels.has(edge.to) ||
          pure.has(edge.to);
        const allowed = approved && !isTest(edge.to) && edge.kind !== "asset";
        const witness = [...current.path, edge.to];
        if (!allowed) {
          const violation = {
            rule,
            from: origin,
            to: edge.to,
            line: current.line ?? edge.line,
            path: witness,
          };
          const key = violationKey(violation);
          if (!violations.has(key)) {
            violations.set(key, violation);
          }
        }
        if (!visited.has(edge.to)) {
          visited.add(edge.to);
          queue.push({
            node: edge.to,
            path: witness,
            line: current.line ?? edge.line,
          });
        }
      }
    }
  }
  return Array.from(violations.values()).sort((a, b) =>
    violationKey(a).localeCompare(violationKey(b), "en"),
  );
}

const ruleIds = new Set([
  "domain-dependency",
  "kernel-dependency",
  "kernel-public-api",
  "shared-to-feature",
  "feature-public-api",
  "layer-direction",
  "production-to-test",
]);

/** @param {unknown} value Input record. @param {string[]} keys Exact keys. @returns {boolean} Schema shape. */
function exactRecord(value, keys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const actual = Object.keys(value);
  return (
    actual.length === keys.length && actual.every((key) => keys.includes(key))
  );
}

/** @param {unknown} value Metadata record. @returns {boolean} Reviewable reason and issue. */
function reviewed(value) {
  return (
    typeof value.reason === "string" &&
    value.reason.trim().length > 0 &&
    Number.isSafeInteger(value.issue) &&
    value.issue > 0
  );
}

/** @param {unknown} file Local name. @returns {boolean} Normalized relative path without glob syntax. */
function canonicalPath(file) {
  if (
    typeof file !== "string" ||
    file.length === 0 ||
    Array.from(file).some(
      (character) =>
        character.charCodeAt(0) < 32 || "\\*?[]{}".includes(character),
    )
  ) {
    return false;
  }
  return (
    !path.posix.isAbsolute(file) &&
    !file.startsWith("../") &&
    file !== ".." &&
    path.posix.normalize(file) === file
  );
}

/** @param {unknown} value External specifier. @returns {boolean} Exact package/subpath. */
function packageName(value) {
  if (
    typeof value !== "string" ||
    !/^(?:@[\w.-]+\/)?[\w.-]+(?:\/[\w.-]+)*$/.test(value)
  ) {
    return false;
  }
  return value.split("/").every((part) => part !== "." && part !== "..");
}

/** @param {string} from Configuration field. @param {string} message Failure. @returns {object} Diagnostic. */
function invalid(from, message) {
  return { rule: "invalid-config", from, to: "", message, line: 1 };
}

/** @param {unknown} value Policy JSON. @param {string[]} nodes Graph module names. @returns {object[]} Schema errors; empty means valid. */
export function validatePolicy(value, nodes) {
  const diagnostics = [];
  const fields = ["domainPublicApis", "kernelEntries", "pureExternals"];
  if (!exactRecord(value, ["version", ...fields]) || value.version !== 1) {
    return [
      invalid("policy.json", "Expected version 1 and exact policy fields"),
    ];
  }
  const known = new Set(nodes);
  const seen = new Set();
  for (const field of fields) {
    if (!Array.isArray(value[field])) {
      diagnostics.push(invalid(field, "Expected an array"));
      continue;
    }
    for (const [index, item] of value[field].entries()) {
      const location = `${field}[${index}]`;
      const key = field === "pureExternals" ? "package" : "entry";
      if (!exactRecord(item, [key, "reason", "issue"]) || !reviewed(item)) {
        diagnostics.push(
          invalid(
            location,
            "Expected exact fields, nonempty reason and positive integer issue",
          ),
        );
        continue;
      }
      const entry = item[key];
      if (field === "pureExternals") {
        if (
          !packageName(entry) ||
          framework(`npm:${entry}`) ||
          isBuiltin(entry)
        ) {
          diagnostics.push(
            invalid(location, "Cannot approve this external dependency"),
          );
        }
      } else {
        const validLocation =
          field === "domainPublicApis"
            ? /^src\/features\/[^/]+\/domain\/index\.ts$/.test(entry)
            : /^src\/(?:domains|types|shared\/kernel)\/.+\/index\.ts$/.test(
                entry,
              );
        if (
          !canonicalPath(entry) ||
          !validLocation ||
          !known.has(entry) ||
          isTest(entry)
        ) {
          diagnostics.push(
            invalid(
              location,
              "Expected an existing canonical entry in an approved location",
            ),
          );
        }
      }
      if (seen.has(entry)) {
        diagnostics.push(invalid(location, "Duplicate approval"));
      }
      seen.add(entry);
    }
  }
  if (diagnostics.length > 0) {
    return diagnostics;
  }
  const directories = value.kernelEntries.map((item) =>
    item.entry.slice(0, -"index.ts".length),
  );
  for (const directory of directories) {
    if (
      directories.some(
        (other) => other !== directory && directory.startsWith(other),
      )
    ) {
      diagnostics.push(
        invalid("kernelEntries", `Overlapping kernel: ${directory}`),
      );
    }
  }
  return diagnostics;
}

/** @param {unknown} value Exceptions JSON. @param {string[]} nodes Graph module names. @returns {object[]} Schema errors; empty means valid. */
export function validateExceptions(value, nodes) {
  if (
    !exactRecord(value, ["version", "entries"]) ||
    value.version !== 1 ||
    !Array.isArray(value.entries)
  ) {
    return [invalid("exceptions.json", "Expected version 1 and entries array")];
  }
  const diagnostics = [];
  const known = new Set(nodes);
  const seen = new Set();
  for (const [index, entry] of value.entries.entries()) {
    const location = `exceptions.json entries[${index}]`;
    if (
      !exactRecord(entry, ["rule", "from", "to", "reason", "issue"]) ||
      !reviewed(entry)
    ) {
      diagnostics.push(
        invalid(
          location,
          "Expected exact fields, nonempty reason and positive integer issue",
        ),
      );
      continue;
    }
    if (!ruleIds.has(entry.rule)) {
      diagnostics.push(invalid(location, "Unknown or non-suppressible rule"));
    }
    if (
      !canonicalPath(entry.from) ||
      !entry.from.startsWith("src/") ||
      !known.has(entry.from)
    ) {
      diagnostics.push(
        invalid(location, "Expected an existing canonical src origin"),
      );
    }
    // All targets, including external modules, must be in the current graph.
    if (typeof entry.to !== "string" || !known.has(entry.to)) {
      diagnostics.push(
        invalid(location, "Expected an existing canonical target"),
      );
    }
    const key = violationKey(entry);
    if (seen.has(key)) {
      diagnostics.push(invalid(location, "Duplicate exception"));
    }
    seen.add(key);
  }
  return diagnostics;
}

/** @param {object[]} violations Actual violations. @param {object[]} exceptions Approved tuples. @returns {object} New violations and unused exceptions. */
export function matchExceptions(violations, exceptions) {
  const current = new Map(
    violations.map((value) => [violationKey(value), value]),
  );
  const allowed = new Map(
    exceptions.map((value) => [violationKey(value), value]),
  );
  return {
    unexpected: Array.from(current.values()).filter(
      (value) => !allowed.has(violationKey(value)),
    ),
    stale: Array.from(allowed.values()).filter(
      (value) => !current.has(violationKey(value)),
    ),
  };
}
