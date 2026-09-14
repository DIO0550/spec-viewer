import fs from "node:fs";
import path from "node:path";
import { createRequire, isBuiltin } from "node:module";
import ts from "typescript";

const sourceExtension = /\.(?:[cm]?ts|tsx)$/;
const scriptExtension = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const ignoredDirectories = new Set([
  "node_modules",
  ".git",
  "dist",
  "storybook-static",
]);

/** @param {string} value Path to normalize. @returns {string} POSIX path. */
function posix(value) {
  return value.split(path.sep).join("/");
}

/** @param {object} paths Root and candidate. @returns {boolean} Whether candidate is within root. */
function within({ root, candidate }) {
  const relative = path.relative(root, candidate);
  return (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

/** @param {unknown} error I/O failure. @returns {string} Diagnostic text. */
function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

/** @param {ts.Node} node Syntax node. @param {Function} visit Callback for every node. */
function walkSyntax(node, visit) {
  visit(node);
  ts.forEachChild(node, (child) => walkSyntax(child, visit));
}

/** @param {object} input Project root and diagnostic collector. @returns {string[]} Canonical source paths. */
function listSources({ root, diagnose }) {
  const files = new Set();
  const visited = new Set();
  const visit = (file) => {
    try {
      const actual = fs.realpathSync(file);
      if (!within({ root, candidate: actual })) {
        diagnose(
          "outside-project",
          posix(path.relative(root, file)),
          "",
          "Source resolves outside project",
        );
        return;
      }
      if (visited.has(actual)) {
        return;
      }
      visited.add(actual);
      if (fs.statSync(actual).isDirectory()) {
        for (const entry of fs.readdirSync(actual).sort()) {
          if (!ignoredDirectories.has(entry)) {
            visit(path.join(actual, entry));
          }
        }
        return;
      }
      if (sourceExtension.test(actual)) {
        files.add(actual);
      }
    } catch (error) {
      diagnose(
        "read-error",
        posix(path.relative(root, file)),
        "",
        errorText(error),
      );
    }
  };
  visit(path.join(root, "src"));
  return Array.from(files).sort();
}

/** @param {object} input Specifier and configuration. @returns {string[]} Possible asset paths. */
function assetCandidates({ specifier, file, options, root }) {
  if (specifier.startsWith(".")) {
    return [path.resolve(path.dirname(file), specifier)];
  }
  if (path.isAbsolute(specifier)) {
    return [specifier];
  }
  const base = options.baseUrl ?? root;
  const candidates = [];
  for (const [alias, targets] of Object.entries(options.paths ?? {})) {
    const star = alias.indexOf("*");
    if (star === -1) {
      if (alias === specifier) {
        candidates.push(...targets.map((target) => path.resolve(base, target)));
      }
      continue;
    }
    const prefix = alias.slice(0, star);
    const suffix = alias.slice(star + 1);
    if (specifier.startsWith(prefix) && specifier.endsWith(suffix)) {
      const middle = specifier.slice(
        prefix.length,
        specifier.length - suffix.length,
      );
      candidates.push(
        ...targets.map((target) =>
          path.resolve(base, target.replace("*", middle)),
        ),
      );
    }
  }
  return candidates;
}

/** @param {object} input Import resolution inputs. @returns {object} Resolved target or error. */
function resolveTarget({ specifier, file, options, root }) {
  if (isBuiltin(specifier)) {
    return { to: `node:${specifier.replace(/^node:/, "")}` };
  }
  const hasQuery = /\?(?:raw|url)$/.test(specifier);
  const clean = specifier.replace(/\?(?:raw|url)$/, "");
  const resolved = ts.resolveModuleName(
    clean,
    file,
    options,
    ts.sys,
  ).resolvedModule;
  if (resolved?.isExternalLibraryImport && !hasQuery) {
    return { to: `npm:${clean}` };
  }
  const candidates = assetCandidates({ specifier: clean, file, options, root });
  // A declaration such as style.d.css.ts does not establish that style.css exists.
  const declarationForAsset = resolved?.resolvedFileName.endsWith(
    `.d${path.extname(clean)}.ts`,
  );
  const explicitAsset =
    candidates.length > 0 && path.extname(clean) !== "" && declarationForAsset;
  let target = explicitAsset ? undefined : resolved?.resolvedFileName;
  if (target === undefined) {
    target = candidates.find((candidate) => ts.sys.fileExists(candidate));
  }
  // TypeScript does not resolve CSS or images in packages. Node only supplies their location.
  if (target === undefined && candidates.length === 0) {
    try {
      target = createRequire(file).resolve(clean);
      if (!scriptExtension.test(target)) {
        return { to: `npm:${clean}`, asset: true };
      }
    } catch {
      return { error: "Cannot resolve module" };
    }
  }
  if (target === undefined) {
    return { error: "Cannot resolve module" };
  }
  const actual = fs.realpathSync(target);
  if (!within({ root, candidate: actual })) {
    return { error: "Local module resolves outside project" };
  }
  const asset = hasQuery || !scriptExtension.test(actual);
  return { to: posix(path.relative(root, actual)), file: actual, asset };
}

/** @param {ts.Node} node Syntax node. @returns {object|undefined} Import expression and kind. */
function importExpression(node) {
  if (ts.isImportDeclaration(node)) {
    return {
      expression: node.moduleSpecifier,
      kind: node.importClause?.isTypeOnly ? "type" : "static",
    };
  }
  if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
    return { expression: node.moduleSpecifier, kind: "export" };
  }
  if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
    return { expression: node.argument.literal, kind: "type" };
  }
  if (
    ts.isImportEqualsDeclaration(node) &&
    ts.isExternalModuleReference(node.moduleReference)
  ) {
    return { expression: node.moduleReference.expression, kind: "require" };
  }
  if (!ts.isCallExpression(node)) {
    return undefined;
  }
  if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
    return { expression: node.arguments[0], kind: "dynamic" };
  }
  if (ts.isIdentifier(node.expression) && node.expression.text === "require") {
    return { expression: node.arguments[0], kind: "require" };
  }
  return undefined;
}

/** @param {string} projectRoot Project to inspect. @returns {object} Canonical graph and non-suppressible diagnostics. */
export function collectGraph(projectRoot) {
  const nodes = new Set();
  const edges = [];
  const diagnostics = [];
  const diagnose = (rule, from, to, message, line = 1) =>
    diagnostics.push({ rule, from, to, message, line });
  try {
    const root = fs.realpathSync(projectRoot);
    const config = ts.readConfigFile(
      path.join(root, "tsconfig.json"),
      ts.sys.readFile,
    );
    if (config.error) {
      diagnose(
        "invalid-config",
        "tsconfig.json",
        "",
        ts.flattenDiagnosticMessageText(config.error.messageText, "\n"),
      );
      return { nodes: [], edges, diagnostics };
    }
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
    for (const diagnostic of parsed.errors) {
      // Source discovery intentionally ignores include/exclude, but compiler option errors remain fatal.
      if (diagnostic.code !== 18003) {
        diagnose(
          "invalid-config",
          "tsconfig.json",
          "",
          ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
        );
      }
    }
    const pending = listSources({ root, diagnose });
    if (pending.length === 0) {
      diagnose("empty-source", "src", "", "No TypeScript sources found");
    }
    const visited = new Set();
    for (let index = 0; index < pending.length; index += 1) {
      const file = pending[index];
      if (visited.has(file)) {
        continue;
      }
      visited.add(file);
      const from = posix(path.relative(root, file));
      nodes.add(from);
      try {
        const source = ts.createSourceFile(
          file,
          fs.readFileSync(file, "utf8"),
          ts.ScriptTarget.Latest,
          true,
        );
        for (const diagnostic of source.parseDiagnostics) {
          diagnose(
            "parse-error",
            from,
            "",
            ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
            source.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line +
              1,
          );
        }
        let jsxLine;
        walkSyntax(source, (node) => {
          const line =
            source.getLineAndCharacterOfPosition(node.getStart(source)).line +
            1;
          if (
            ts.isJsxElement(node) ||
            ts.isJsxSelfClosingElement(node) ||
            ts.isJsxFragment(node)
          ) {
            jsxLine ??= line;
          }
          const reference = importExpression(node);
          if (reference === undefined) {
            return;
          }
          if (
            !reference.expression ||
            !ts.isStringLiteralLike(reference.expression)
          ) {
            diagnose(
              "unresolved-import",
              from,
              "",
              "Import/require must use a literal module specifier",
              line,
            );
            return;
          }
          const specifier = reference.expression.text;
          const target = resolveTarget({
            specifier,
            file,
            options: parsed.options,
            root,
          });
          if (target.error) {
            diagnose("unresolved-import", from, specifier, target.error, line);
            return;
          }
          nodes.add(target.to);
          edges.push({
            from,
            to: target.to,
            specifier,
            line,
            kind: target.asset ? "asset" : reference.kind,
          });
          if (target.file && !target.asset) {
            pending.push(target.file);
          }
        });
        if (jsxLine !== undefined) {
          const to = "npm:react/jsx-runtime";
          nodes.add(to);
          edges.push({
            from,
            to,
            specifier: "react/jsx-runtime",
            line: jsxLine,
            kind: "static",
          });
        }
      } catch (error) {
        diagnose("read-error", from, "", errorText(error));
      }
    }
  } catch (error) {
    diagnose("read-error", "", "", errorText(error));
  }
  return { nodes: Array.from(nodes).sort(), edges, diagnostics };
}
