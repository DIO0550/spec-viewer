import {
  ComparisonRevision,
  type ComparisonRevision as ComparisonRevisionValue,
  type RevisionOption,
  type SpecFileHistory,
} from "@/features/diff/domain/comparisonRevision";

import { InvalidDiffResponseError } from "./diffPayloadDecoder";
import { isRecord } from "./isRecord";

/**
 * Raises a stable response-validation error for the given path.
 *
 * @param message - Path-and-constraint validation message.
 * @param raw - Complete raw IPC response.
 * @returns Never returns; always throws.
 * @throws InvalidDiffResponseError with the given message and raw payload.
 */
const fail = (message: string, raw: unknown): never => {
  throw new InvalidDiffResponseError(message, raw);
};

/**
 * Decodes an unknown value as a string at the specified validation path.
 *
 * @param value - Candidate value to validate.
 * @param path - Validation path used in the error message.
 * @param raw - Complete raw response, attached to the thrown error for debugging.
 * @returns The value, unchanged, when it is a string.
 * @throws InvalidDiffResponseError when the value is not a string.
 */
const stringAt = (value: unknown, path: string, raw: unknown): string => {
  return typeof value === "string"
    ? value
    : fail(`${path} must be a string`, raw);
};

/**
 * Decodes a Git object ID in SHA-1 or SHA-256 form.
 *
 * @param value - Candidate value to validate.
 * @param path - Validation path used in the error message.
 * @param raw - Complete raw response, attached to the thrown error for debugging.
 * @returns The value, unchanged, when it is a lowercase 40 or 64 character Git object id.
 * @throws InvalidDiffResponseError when the value is not a string, or is not a valid Git object id.
 */
const shaAt = (value: unknown, path: string, raw: unknown): string => {
  const sha = stringAt(value, path, raw);
  return /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(sha)
    ? sha
    : fail(`${path} must be a 40 or 64 character lowercase Git object id`, raw);
};

/**
 * Decodes a comparison revision discriminated union from an unknown value.
 *
 * @param value - Candidate value to validate.
 * @param path - Validation path used in error messages.
 * @param raw - Complete raw response, attached to any thrown error for debugging.
 * @returns The decoded comparison revision (head, commit, local branch, or tag).
 * @throws InvalidDiffResponseError when the value's shape or `kind` is unsupported or invalid.
 */
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

/**
 * Decodes the `list_spec_diff_revisions` response into revision options.
 *
 * @param value - Unknown IPC response.
 * @returns The validated readonly list of revision options.
 * @throws InvalidDiffResponseError when the response violates the contract.
 */
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

/**
 * Decodes the `list_spec_file_commit_history` response into commit history.
 *
 * @param value - Unknown IPC response.
 * @returns The validated commit history, including the truncation flag.
 * @throws InvalidDiffResponseError when the response violates the contract.
 */
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
