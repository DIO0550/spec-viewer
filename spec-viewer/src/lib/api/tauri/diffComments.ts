import type {
  DiffAnchorTarget,
  DiffCommentMutationOutcome,
  DiffReviewIdentity,
  ResolvedDiffComments,
} from "@/features/diffComments";
import {
  decodeDiffCommentDocument,
  decodeDiffCommentMutationOutcome,
  decodeDiffReviewIdentity,
  InvalidDiffCommentResponseError,
} from "./diffCommentDecoder";
import { invokeTauriCommand } from "./invokeTauriCommand";
import { isRecord } from "./isRecord";

export const LOAD_DIFF_COMMENTS_COMMAND = "load_diff_comments" as const;
export const SAVE_DIFF_COMMENT_COMMAND = "save_diff_comment" as const;
export const UPDATE_DIFF_COMMENT_COMMAND = "update_diff_comment" as const;
export type DiffCommentCommandName =
  | typeof LOAD_DIFF_COMMENTS_COMMAND
  | typeof SAVE_DIFF_COMMENT_COMMAND
  | typeof UPDATE_DIFF_COMMENT_COMMAND;
export type LoadDiffCommentsRequest = Readonly<{
  identity: DiffReviewIdentity;
}>;
export type SaveDiffCommentRequest = Readonly<{
  identity: DiffReviewIdentity;
  expectedRevision: string;
  target: DiffAnchorTarget;
  body: string;
}>;
export type UpdateDiffCommentRequest = Readonly<{
  identity: DiffReviewIdentity;
  expectedRevision: string;
  commentId: string;
  body?: string;
  resolved?: boolean;
  replyBody?: string;
  deleted?: boolean;
}>;
export type DiffCommentBackendErrorCode =
  | "invalidRequest"
  | "invalidRevision"
  | "identityMismatch"
  | "staleSnapshot"
  | "staleBase"
  | "schema"
  | "pathBoundary"
  | "lineAlreadyCommented"
  | "unavailable"
  | "unexpected";
export type DiffCommentCommandErrorCode =
  | DiffCommentBackendErrorCode
  | "invalidResponse"
  | "unknown";
export type DiffCommentCommandError = Readonly<{
  command: DiffCommentCommandName;
  code: DiffCommentCommandErrorCode;
  message: string;
  raw: unknown;
}>;
export type DiffCommentCommands = Readonly<{
  load: (request: LoadDiffCommentsRequest) => Promise<ResolvedDiffComments>;
  save: (
    request: SaveDiffCommentRequest,
  ) => Promise<DiffCommentMutationOutcome>;
  update: (
    request: UpdateDiffCommentRequest,
  ) => Promise<DiffCommentMutationOutcome>;
}>;

const BACKEND_ERROR_CODES = [
  "invalidRequest",
  "invalidRevision",
  "identityMismatch",
  "staleSnapshot",
  "staleBase",
  "schema",
  "pathBoundary",
  "lineAlreadyCommented",
  "unavailable",
  "unexpected",
] as const satisfies readonly DiffCommentBackendErrorCode[];

/** @returns Whether the candidate is a known backend error code. */
function isBackendErrorCode(
  value: unknown,
): value is DiffCommentBackendErrorCode {
  return (
    typeof value === "string" &&
    BACKEND_ERROR_CODES.includes(value as DiffCommentBackendErrorCode)
  );
}

/** @returns A normalized command-local error. */
function normalizeError(
  command: DiffCommentCommandName,
  error: unknown,
): DiffCommentCommandError {
  if (
    isRecord(error) &&
    isBackendErrorCode(error.code) &&
    typeof error.message === "string"
  ) {
    return { command, code: error.code, message: error.message, raw: error };
  }
  if (error instanceof InvalidDiffCommentResponseError) {
    return {
      command,
      code: error.code,
      message: error.message,
      raw: error.raw,
    };
  }
  const message =
    error instanceof Error ? error.message : `Unknown ${command} failure`;
  return { command, code: "unknown", message, raw: error };
}

/** @returns A decoded command response. */
async function invokeAndDecode<Request, Response>(
  command: DiffCommentCommandName,
  request: Request,
  decode: (value: unknown) => Response,
): Promise<Response> {
  const response = await invokeTauriCommand<
    unknown,
    Request,
    DiffCommentCommandError
  >(command, request, (error) => normalizeError(command, error));
  try {
    return decode(response);
  } catch (error) {
    throw normalizeError(command, error);
  }
}

/** @throws InvalidDiffCommentResponseError when a response crosses scopes. */
function assertDocumentScope(
  identity: DiffReviewIdentity,
  document: ResolvedDiffComments,
  raw: unknown,
): void {
  if (
    document.repositoryId !== identity.repositoryId ||
    document.worktreeId !== identity.worktreeId
  ) {
    throw new InvalidDiffCommentResponseError(
      "response document scope must match the request identity",
      raw,
    );
  }
}

/** @throws InvalidDiffCommentResponseError when an outcome crosses scopes. */
function assertOutcomeScope(
  identity: DiffReviewIdentity,
  outcome: DiffCommentMutationOutcome,
): void {
  if (outcome.kind === "committed") {
    assertDocumentScope(identity, outcome.document, outcome);
    return;
  }
  if (outcome.kind === "conflict") {
    assertDocumentScope(identity, outcome.latestDocument, outcome);
    return;
  }
  if (outcome.code === "revisionOverflow") {
    assertDocumentScope(identity, outcome.currentDocument, outcome);
  }
}

/** @returns The resolved worktree-wide document. */
export async function loadDiffComments(
  request: LoadDiffCommentsRequest,
): Promise<ResolvedDiffComments> {
  return invokeAndDecode(LOAD_DIFF_COMMENTS_COMMAND, request, (value) => {
    const document = decodeDiffCommentDocument(value);
    assertDocumentScope(request.identity, document, value);
    return document;
  });
}

/** @returns The exhaustive CAS create outcome. */
export async function saveDiffComment(
  request: SaveDiffCommentRequest,
): Promise<DiffCommentMutationOutcome> {
  return invokeAndDecode(SAVE_DIFF_COMMENT_COMMAND, request, (value) => {
    const outcome = decodeDiffCommentMutationOutcome(value);
    assertOutcomeScope(request.identity, outcome);
    return outcome;
  });
}

/** @returns The exhaustive CAS update outcome. */
export async function updateDiffComment(
  request: UpdateDiffCommentRequest,
): Promise<DiffCommentMutationOutcome> {
  return invokeAndDecode(UPDATE_DIFF_COMMENT_COMMAND, request, (value) => {
    const outcome = decodeDiffCommentMutationOutcome(value);
    assertOutcomeScope(request.identity, outcome);
    return outcome;
  });
}

export const diffCommentCommands: DiffCommentCommands = {
  load: loadDiffComments,
  save: saveDiffComment,
  update: updateDiffComment,
};

/**
 * @param overview - Decoded repository overview carrying optional Diff identity.
 * @returns The complete identity when the base is resolved, otherwise null.
 */
export function getDiffReviewIdentity(
  overview: unknown,
): DiffReviewIdentity | null {
  if (
    !isRecord(overview) ||
    overview.diffReviewIdentity === undefined ||
    overview.diffReviewIdentity === null
  ) {
    return null;
  }

  return decodeDiffReviewIdentity(
    overview.diffReviewIdentity,
    "diffReviewIdentity",
    overview,
  );
}
