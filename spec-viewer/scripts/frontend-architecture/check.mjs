import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const SOURCE_FILE_PATTERN = /\.[cm]?[jt]sx?$/u;
const JSX_SOURCE_FILE_PATTERN = /\.[jt]sx$/u;
const NON_PRODUCTION_FILE_PATTERN = /\.(?:test|spec|stories)\.[cm]?[jt]sx?$/u;
const FEATURE_PATH_PATTERN = /^features\/([^/]+)(?:\/|$)/u;
const FEATURE_AGGREGATE_PATH_PATTERN =
  /^features(?:\/index(?:\.[cm]?[jt]sx?)?)?$/u;
const DOMAIN_PATH_PATTERN = /^features\/[^/]+\/domain(?:\/|$)/u;
const INTERNAL_ALIAS_PREFIX = "@/";
const TAURI_CORE_MODULE = "@tauri-apps/api/core";
const TAURI_TRANSPORT_KERNEL_PATH = "shared/api/tauri/invokeTauriCommand.ts";

const toPosixPath = (value) => value.split(path.sep).join("/");

const compareViolations = (left, right) =>
  violationKey(left).localeCompare(violationKey(right));

const isStringLiteral = (node) =>
  ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);

const isProductionSourceFile = (relativePath) => {
  const segments = relativePath.split("/");
  const fileName = segments.at(-1) ?? "";

  if (segments.includes("__tests__") || segments.includes("testing")) {
    return false;
  }

  if (NON_PRODUCTION_FILE_PATTERN.test(fileName)) {
    return false;
  }

  return SOURCE_FILE_PATTERN.test(fileName);
};

const listProductionSourceFiles = (sourceRoot) => {
  const files = [];

  const visitDirectory = (directory) => {
    const entries = readdirSync(directory, { withFileTypes: true }).sort(
      (left, right) => left.name.localeCompare(right.name),
    );

    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visitDirectory(absolutePath);
        continue;
      }

      const relativePath = toPosixPath(path.relative(sourceRoot, absolutePath));
      if (entry.isFile() && isProductionSourceFile(relativePath)) {
        files.push({ absolutePath, relativePath });
      }
    }
  };

  visitDirectory(sourceRoot);
  return files;
};

const internalTargetPath = ({ sourceRoot, sourcePath, specifier }) => {
  if (specifier.startsWith(INTERNAL_ALIAS_PREFIX)) {
    const aliasPath = specifier
      .slice(INTERNAL_ALIAS_PREFIX.length)
      .replace(/^\/+/u, "");
    const absoluteTarget = path.resolve(sourceRoot, aliasPath);
    return toPosixPath(path.relative(sourceRoot, absoluteTarget));
  }

  if (!specifier.startsWith(".")) {
    return null;
  }

  const absoluteTarget = path.resolve(path.dirname(sourcePath), specifier);
  return toPosixPath(path.relative(sourceRoot, absoluteTarget));
};

const featureName = (relativePath) =>
  FEATURE_PATH_PATTERN.exec(relativePath)?.[1] ?? null;

const packageName = (relativePath) => {
  const feature = featureName(relativePath);
  if (feature !== null) {
    return `features/${feature}`;
  }

  return relativePath.split("/")[0] ?? null;
};

const isFeaturePublicApi = (targetPath, targetFeature) => {
  const featureRoot = `features/${targetFeature}`;
  if (targetPath === featureRoot) {
    return true;
  }

  return new RegExp(`^${featureRoot}/index\\.[cm]?[jt]sx?$`, "u").test(
    targetPath,
  );
};

const isPathAtOrBelow = (candidate, boundary) =>
  candidate === boundary || candidate.startsWith(`${boundary}/`);

const isForbiddenDomainDependency = ({
  sourceFeature,
  specifier,
  targetPath,
}) => {
  if (
    specifier === "react" ||
    specifier.startsWith("react/") ||
    specifier === "react-dom" ||
    specifier.startsWith("react-dom/")
  ) {
    return true;
  }

  if (specifier.startsWith("@tauri-apps/")) {
    return true;
  }

  if (targetPath === null || sourceFeature === null) {
    return false;
  }

  const ownDomain = `features/${sourceFeature}/domain`;
  return (
    !isPathAtOrBelow(targetPath, ownDomain) &&
    !isPathAtOrBelow(targetPath, "shared/domain")
  );
};

const containsJsxSyntax = (sourceText) => {
  const sourceFile = ts.createSourceFile(
    "architecture-source.tsx",
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let containsJsx = false;

  const visit = (node) => {
    if (
      ts.isJsxElement(node) ||
      ts.isJsxSelfClosingElement(node) ||
      ts.isJsxFragment(node)
    ) {
      containsJsx = true;
      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return containsJsx;
};

const hasPath = ({ adjacency, from, to }) => {
  const pending = [from];
  const visited = new Set();

  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined || visited.has(current)) {
      continue;
    }

    if (current === to) {
      return true;
    }

    visited.add(current);
    for (const dependency of adjacency.get(current) ?? []) {
      pending.push(dependency);
    }
  }

  return false;
};

const createViolation = ({ rule, source, specifier, message }) => ({
  rule,
  source,
  specifier,
  message,
});

const isValidWaiver = (waiver) =>
  typeof waiver === "object" &&
  waiver !== null &&
  !Array.isArray(waiver) &&
  typeof waiver.rule === "string" &&
  typeof waiver.source === "string" &&
  typeof waiver.specifier === "string" &&
  Number.isInteger(waiver.issue) &&
  waiver.issue > 0;

const validateWaivers = (waivers) => {
  if (!Array.isArray(waivers)) {
    return ["Waivers must be an array."];
  }

  const errors = [];
  const seen = new Set();

  for (const waiver of waivers) {
    if (!isValidWaiver(waiver)) {
      errors.push(`Invalid waiver: ${JSON.stringify(waiver)}`);
      continue;
    }

    const key = violationKey(waiver);
    if (seen.has(key)) {
      errors.push(`Duplicate waiver: ${key}`);
      continue;
    }

    seen.add(key);
  }

  return errors;
};

/**
 * Collects every static or dynamic ECMAScript module dependency in source order.
 * @param {string} sourceText TypeScript or JavaScript source text.
 * @returns {ReadonlyArray<{specifier: string}>} Module specifiers found by the TypeScript parser.
 */
export const collectModuleSpecifiers = (sourceText) => {
  const sourceFile = ts.createSourceFile(
    "architecture-source.tsx",
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const dependencies = [];

  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      isStringLiteral(node.moduleSpecifier)
    ) {
      dependencies.push({ specifier: node.moduleSpecifier.text });
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length >= 1 &&
      isStringLiteral(node.arguments[0])
    ) {
      dependencies.push({ specifier: node.arguments[0].text });
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      isStringLiteral(node.argument.literal)
    ) {
      dependencies.push({ specifier: node.argument.literal.text });
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return dependencies;
};

/**
 * Builds a stable identity for a violation or waiver.
 * @param {{rule: string, source: string, specifier: string}} value Violation identity fields.
 * @returns {string} Stable key used for exact waiver matching.
 */
export const violationKey = ({ rule, source, specifier }) =>
  `${rule}|${source}|${specifier}`;

/**
 * Audits production frontend modules against the documented dependency policy.
 * @param {{sourceRoot: string, waivers: ReadonlyArray<object>}} options Audit inputs.
 * @returns {{violations: ReadonlyArray<object>, staleWaivers: ReadonlyArray<object>, configurationErrors: ReadonlyArray<string>}} Audit result.
 */
export const auditFrontendArchitecture = ({ sourceRoot, waivers }) => {
  const waiverList = Array.isArray(waivers) ? waivers : [];
  const validWaivers = waiverList.filter(isValidWaiver);
  const configurationErrors = validateWaivers(waivers);
  const files = listProductionSourceFiles(sourceRoot);
  const detectedViolations = [];
  const packageEdges = new Set();

  for (const file of files) {
    const sourceFeature = featureName(file.relativePath);
    const sourcePackage = packageName(file.relativePath);
    const sourceText = readFileSync(file.absolutePath, "utf8");
    const dependencies = collectModuleSpecifiers(sourceText);

    if (
      DOMAIN_PATH_PATTERN.test(file.relativePath) &&
      JSX_SOURCE_FILE_PATTERN.test(file.relativePath) &&
      containsJsxSyntax(sourceText)
    ) {
      detectedViolations.push(
        createViolation({
          rule: "domain-forbidden-dependency",
          source: file.relativePath,
          specifier: "<jsx>",
          message: "Domain modules cannot contain React JSX syntax.",
        }),
      );
    }

    for (const { specifier } of dependencies) {
      const targetPath = internalTargetPath({
        sourceRoot,
        sourcePath: file.absolutePath,
        specifier,
      });
      const targetFeature =
        targetPath === null ? null : featureName(targetPath);
      const targetPackage =
        targetPath === null ? null : packageName(targetPath);
      const targetsFeatureAggregate =
        targetPath !== null && FEATURE_AGGREGATE_PATH_PATTERN.test(targetPath);

      if (
        specifier === TAURI_CORE_MODULE &&
        file.relativePath !== TAURI_TRANSPORT_KERNEL_PATH
      ) {
        detectedViolations.push(
          createViolation({
            rule: "raw-tauri-core-dependency",
            source: file.relativePath,
            specifier,
            message:
              "Raw Tauri core transport is owned by shared/api/tauri/invokeTauriCommand.ts.",
          }),
        );
      }

      if (
        DOMAIN_PATH_PATTERN.test(file.relativePath) &&
        isForbiddenDomainDependency({ sourceFeature, specifier, targetPath })
      ) {
        detectedViolations.push(
          createViolation({
            rule: "domain-forbidden-dependency",
            source: file.relativePath,
            specifier,
            message:
              "Domain internal imports may target only their own domain or shared/domain; React, JSX, and Tauri are forbidden.",
          }),
        );
      }

      const importsFeaturePrivateApi =
        targetFeature !== null &&
        sourceFeature !== targetFeature &&
        targetPath !== null &&
        !isFeaturePublicApi(targetPath, targetFeature);
      if (
        sourcePackage !== "shared" &&
        sourcePackage !== "features" &&
        (importsFeaturePrivateApi || targetsFeatureAggregate)
      ) {
        detectedViolations.push(
          createViolation({
            rule: "cross-feature-deep-import",
            source: file.relativePath,
            specifier,
            message:
              "Cross-feature dependencies must use the target feature public API.",
          }),
        );
      }

      if (
        sourcePackage === "shared" &&
        (targetFeature !== null || targetsFeatureAggregate)
      ) {
        detectedViolations.push(
          createViolation({
            rule: "shared-feature-dependency",
            source: file.relativePath,
            specifier,
            message: "Shared modules cannot depend on a feature module.",
          }),
        );
      }

      if (
        sourcePackage !== null &&
        targetPackage !== null &&
        sourcePackage !== targetPackage
      ) {
        packageEdges.add(`${sourcePackage}\0${targetPackage}`);
      }
    }
  }

  const adjacency = new Map();
  for (const edge of packageEdges) {
    const [sourcePackage, targetPackage] = edge.split("\0");
    const dependencies = adjacency.get(sourcePackage) ?? new Set();
    dependencies.add(targetPackage);
    adjacency.set(sourcePackage, dependencies);
  }

  for (const edge of packageEdges) {
    const [sourcePackage, targetPackage] = edge.split("\0");
    if (hasPath({ adjacency, from: targetPackage, to: sourcePackage })) {
      detectedViolations.push(
        createViolation({
          rule: "package-cycle-dependency",
          source: sourcePackage,
          specifier: targetPackage,
          message:
            "Package dependency edges must form a directed acyclic graph.",
        }),
      );
    }
  }

  const uniqueViolations = new Map();
  for (const violation of detectedViolations) {
    uniqueViolations.set(violationKey(violation), violation);
  }

  const waiverKeys = new Set(validWaivers.map(violationKey));
  const allViolations = [...uniqueViolations.values()].sort(compareViolations);
  const violations = allViolations.filter(
    (violation) => !waiverKeys.has(violationKey(violation)),
  );
  const detectedKeys = new Set(allViolations.map(violationKey));
  const staleWaivers = validWaivers
    .filter((waiver) => !detectedKeys.has(violationKey(waiver)))
    .sort(compareViolations);

  return {
    violations,
    staleWaivers,
    configurationErrors,
  };
};

const formatFinding = (finding) =>
  `${finding.rule}: ${finding.source} -> ${finding.specifier}`;

const runCli = () => {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(scriptDirectory, "../..");
  const sourceRoot = path.join(projectRoot, "src");
  const waiverPath = path.join(scriptDirectory, "waivers.json");
  const reportOnly = process.argv.includes("--report");
  const waiverDocument = reportOnly
    ? { waivers: [] }
    : JSON.parse(readFileSync(waiverPath, "utf8"));
  const audit = auditFrontendArchitecture({
    sourceRoot,
    waivers: waiverDocument?.waivers,
  });

  if (reportOnly) {
    process.stdout.write(`${JSON.stringify(audit.violations, null, 2)}\n`);
    return;
  }

  for (const error of audit.configurationErrors) {
    process.stderr.write(`configuration: ${error}\n`);
  }
  for (const violation of audit.violations) {
    process.stderr.write(`violation: ${formatFinding(violation)}\n`);
  }
  for (const waiver of audit.staleWaivers) {
    process.stderr.write(
      `stale waiver (#${waiver.issue}): ${formatFinding(waiver)}\n`,
    );
  }

  const hasFailures =
    audit.configurationErrors.length > 0 ||
    audit.violations.length > 0 ||
    audit.staleWaivers.length > 0;
  if (hasFailures) {
    process.exitCode = 1;
    return;
  }

  process.stdout.write("Frontend architecture check passed.\n");
};

const isMainModule =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  runCli();
}
