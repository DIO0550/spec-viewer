import {
  ComparisonRevision,
  type ComparisonRevision as ComparisonRevisionValue,
  type RevisionOption,
  type SpecFileHistory,
} from "@/features/diff/domain/comparisonRevision";

import { isRecord } from "./isRecord";
import { InvalidSpecDiffResponseError } from "./specDiffDecoder";

const fail = (message: string, raw: unknown): never => {
  throw new InvalidSpecDiffResponseError(message, raw);
};

const stringAt = (value: unknown, path: string, raw: unknown): string => {
  return typeof value === "string"
    ? value
    : fail(`${path} must be a string`, raw);
};

const shaAt = (value: unknown, path: string, raw: unknown): string => {
  const sha = stringAt(value, path, raw);
  return /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(sha)
    ? sha
    : fail(`${path} must be a 40 or 64 character lowercase Git object id`, raw);
};

const revisionAt = (
  value: unknown,
  path: string,
  raw: unknown,
): ComparisonRevisionValue => {
  if (!isRecord(value)) {
    return fail(`${path} must be an object`, raw);
  }
  if (value.kind === "head") {
    return ComparisonRevision.head();
  }
  if (value.kind === "commit") {
    return { kind: "commit", sha: shaAt(value.sha, `${path}.sha`, raw) };
  }
  if (value.kind === "localBranch") {
    const name = stringAt(value.name, `${path}.name`, raw);
    return name.startsWith("refs/heads/")
      ? { kind: "localBranch", name }
      : fail(`${path}.name must be a canonical local branch ref`, raw);
  }
  if (value.kind === "tag") {
    const name = stringAt(value.name, `${path}.name`, raw);
    return name.startsWith("refs/tags/")
      ? { kind: "tag", name }
      : fail(`${path}.name must be a canonical tag ref`, raw);
  }
  return fail(`${path}.kind is unsupported`, raw);
};

export function decodeRevisionOptions(
  value: unknown,
): readonly RevisionOption[] {
  if (!isRecord(value) || !Array.isArray(value.options)) {
    return fail("response.options must be an array", value);
  }
  return value.options.map((candidate, index) => {
    const path = `options[${index}]`;
    if (!isRecord(candidate)) {
      return fail(`${path} must be an object`, value);
    }
    const revision = revisionAt(candidate.revision, `${path}.revision`, value);
    return {
      id: ComparisonRevision.idOf(revision),
      revision,
      label: stringAt(candidate.label, `${path}.label`, value),
      resolvedCommitSha: shaAt(
        candidate.resolvedCommitSha,
        `${path}.resolvedCommitSha`,
        value,
      ),
    };
  });
}

export function decodeSpecFileHistory(value: unknown): SpecFileHistory {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    return fail("response.items must be an array", value);
  }
  if (typeof value.truncated !== "boolean") {
    return fail("response.truncated must be a boolean", value);
  }
  return {
    items: value.items.map((candidate, index) => {
      const path = `items[${index}]`;
      if (!isRecord(candidate)) {
        return fail(`${path} must be an object`, value);
      }
      return {
        sha: shaAt(candidate.sha, `${path}.sha`, value),
        committedAt: stringAt(
          candidate.committedAt,
          `${path}.committedAt`,
          value,
        ),
        message: stringAt(candidate.message, `${path}.message`, value),
      };
    }),
    truncated: value.truncated,
  };
}
