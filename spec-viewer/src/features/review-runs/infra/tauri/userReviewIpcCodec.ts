import type {
  StoredUserReview,
  UserReview,
  UserReviewWorkspace,
} from "@/features/review-runs/domain/userReview";
import type { UserReviewListProblem } from "@/features/review-runs/domain/userReviewListProblem";
import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import { ValidatedStoredUserReview } from "@/features/review-runs/domain/validatedStoredUserReview";
import type {
  ArchiveUserReviewRequest,
  ArchiveUserReviewResponse,
  CreateUserReviewRequest,
  CreateUserReviewResponse,
  ListUserReviewsRequest,
  ListUserReviewsResponse,
} from "@/features/review-runs/types/userReviewIpc";
import {
  IpcResponseDecodeError,
  RuntimeCodec,
  decodeRuntimeValue,
  type RuntimeCodec as RuntimeCodecType,
} from "@/shared/lib/runtimeCodec";

const fileKeyCodec = RuntimeCodec.literalUnion([
  "exploration",
  "hearing",
  "impl",
  "tasks",
  "tech-reference",
  "test-cases",
  "requirements",
  "design",
] as const);

type SpecFileKeyDto =
  | "exploration"
  | "hearing"
  | "impl"
  | "tasks"
  | "tech-reference"
  | "test-cases"
  | "requirements"
  | "design";

export type UserReviewDto = Readonly<{
  id: string;
  status: "active" | "inProgress" | "completed" | "archived";
  target:
    | Readonly<{ scope: "file"; specId: string; fileKey: SpecFileKeyDto }>
    | Readonly<{ scope: "spec"; specId: string }>;
  workspace:
    | Readonly<{ mode: "currentWorkspace"; workspacePath: string }>
    | Readonly<{
        mode: "worktree";
        repositoryPath: string;
        worktreePath: string;
        branchName: string;
      }>;
  specFolderPath: string;
  folderPath: string;
  sourceFiles: readonly Readonly<{
    specId: string;
    fileKey: SpecFileKeyDto;
    relativePath: string;
  }>[];
  commentCount: number;
  createdAt: string;
  archivedAt: string | null;
  summary: string | null;
  warnings: readonly string[];
}>;

type CreateUserReviewResponseDto = Readonly<{ userReview: UserReviewDto }>;
type ListUserReviewsResponseDto = Readonly<{
  active: readonly UserReviewDto[];
  archived: readonly UserReviewDto[];
  problems: readonly Readonly<{
    folderPath: string;
    state: "malformed" | "missingFolder";
    message: string;
  }>[];
}>;
type ArchiveUserReviewResponseDto = Readonly<{ userReview: UserReviewDto }>;

const targetCodec: RuntimeCodecType<UserReviewDto["target"]> = {
  decode(value, path = "$") {
    const scopeResult = RuntimeCodec.object({
      scope: RuntimeCodec.string,
    }).decode(value, path);
    if (!scopeResult.ok) {
      return scopeResult;
    }
    if (scopeResult.value.scope === "file") {
      return RuntimeCodec.object({
        scope: RuntimeCodec.literalUnion(["file"] as const),
        specId: RuntimeCodec.nonEmptyString,
        fileKey: fileKeyCodec,
      }).decode(value, path);
    }
    return RuntimeCodec.object({
      scope: RuntimeCodec.literalUnion(["spec"] as const),
      specId: RuntimeCodec.nonEmptyString,
    }).decode(value, path);
  },
};

const workspaceCodec: RuntimeCodecType<UserReviewDto["workspace"]> = {
  decode(value, path = "$") {
    const modeResult = RuntimeCodec.object({
      mode: RuntimeCodec.string,
    }).decode(value, path);
    if (!modeResult.ok) {
      return modeResult;
    }
    if (modeResult.value.mode === "currentWorkspace") {
      return RuntimeCodec.object({
        mode: RuntimeCodec.literalUnion(["currentWorkspace"] as const),
        workspacePath: RuntimeCodec.nonEmptyString,
      }).decode(value, path);
    }
    return RuntimeCodec.object({
      mode: RuntimeCodec.literalUnion(["worktree"] as const),
      repositoryPath: RuntimeCodec.nonEmptyString,
      worktreePath: RuntimeCodec.nonEmptyString,
      branchName: RuntimeCodec.nonEmptyString,
    }).decode(value, path);
  },
};

const sourceFileCodec = RuntimeCodec.object({
  specId: RuntimeCodec.nonEmptyString,
  fileKey: fileKeyCodec,
  relativePath: RuntimeCodec.nonEmptyString,
});
const userReviewCodec: RuntimeCodecType<UserReviewDto> = RuntimeCodec.object({
  id: RuntimeCodec.nonEmptyString,
  status: RuntimeCodec.literalUnion([
    "active",
    "inProgress",
    "completed",
    "archived",
  ] as const),
  target: targetCodec,
  workspace: workspaceCodec,
  specFolderPath: RuntimeCodec.nonEmptyString,
  folderPath: RuntimeCodec.nonEmptyString,
  sourceFiles: RuntimeCodec.array(sourceFileCodec),
  commentCount: RuntimeCodec.nonNegativeInteger,
  createdAt: RuntimeCodec.isoDateTime,
  archivedAt: RuntimeCodec.nullable(RuntimeCodec.isoDateTime),
  summary: RuntimeCodec.nullable(RuntimeCodec.string),
  warnings: RuntimeCodec.array(RuntimeCodec.string),
});
const problemCodec = RuntimeCodec.object({
  folderPath: RuntimeCodec.nonEmptyString,
  state: RuntimeCodec.literalUnion(["malformed", "missingFolder"] as const),
  message: RuntimeCodec.string,
});
const createResponseCodec: RuntimeCodecType<CreateUserReviewResponseDto> =
  RuntimeCodec.object({ userReview: userReviewCodec });
const listResponseCodec: RuntimeCodecType<ListUserReviewsResponseDto> =
  RuntimeCodec.object({
    active: RuntimeCodec.array(userReviewCodec),
    archived: RuntimeCodec.array(userReviewCodec),
    problems: RuntimeCodec.array(problemCodec),
  });
const archiveResponseCodec: RuntimeCodecType<ArchiveUserReviewResponseDto> =
  RuntimeCodec.object({ userReview: userReviewCodec });

export function encodeCreateUserReviewRequest(
  request: CreateUserReviewRequest,
) {
  return {
    workspacePath: request.workspacePath,
    target: encodeTarget(request.target),
    commentIds: request.commentIds.map((id) => String(id)),
    workspaceMode: request.workspaceMode,
  };
}

export function encodeListUserReviewsRequest(request: ListUserReviewsRequest) {
  return {
    workspacePath: request.workspacePath,
    target: encodeTarget(request.target),
    ...(request.correlationId === undefined
      ? {}
      : { correlationId: request.correlationId }),
  };
}

export function encodeArchiveUserReviewRequest(
  request: ArchiveUserReviewRequest,
) {
  return {
    workspacePath: request.workspacePath,
    target: encodeTarget(request.target),
    userReviewId: request.userReviewId,
  };
}

export function decodeCreateUserReviewResponse(
  value: unknown,
): CreateUserReviewResponse {
  const dto = decodeRuntimeValue(
    "create_user_review",
    createResponseCodec,
    value,
  );
  return {
    userReview: mapUserReviewDtoToDomain("create_user_review", dto.userReview),
  };
}

export function decodeListUserReviewsResponse(
  value: unknown,
): ListUserReviewsResponse {
  const dto = decodeRuntimeValue("list_user_reviews", listResponseCodec, value);
  const active = dto.active.map((review, index) => {
    const domain = mapUserReviewDtoToDomain(
      "list_user_reviews",
      review,
      `$.active[${index}]`,
    );
    if (domain.status === "archived") {
      throw new IpcResponseDecodeError(
        "list_user_reviews",
        `$.active[${index}].status`,
        "non-archived status",
        domain.status,
      );
    }
    return domain;
  });
  const archived = dto.archived.map((review, index) => {
    const domain = mapUserReviewDtoToDomain(
      "list_user_reviews",
      review,
      `$.archived[${index}]`,
    );
    if (domain.status !== "archived") {
      throw new IpcResponseDecodeError(
        "list_user_reviews",
        `$.archived[${index}].status`,
        '"archived"',
        domain.status,
      );
    }
    return domain;
  });
  return {
    active,
    archived,
    problems: dto.problems.map(mapProblemDtoToDomain),
  };
}

export function decodeArchiveUserReviewResponse(
  value: unknown,
): ArchiveUserReviewResponse {
  const dto = decodeRuntimeValue(
    "archive_user_review",
    archiveResponseCodec,
    value,
  );
  const userReview = mapUserReviewDtoToDomain(
    "archive_user_review",
    dto.userReview,
  );
  if (userReview.status !== "archived") {
    throw new IpcResponseDecodeError(
      "archive_user_review",
      "$.userReview.status",
      '"archived"',
      userReview.status,
    );
  }
  return { userReview };
}

export function mapUserReviewDtoToDomain(
  command: string,
  dto: UserReviewDto,
  path = "$.userReview",
): UserReview {
  const stored: StoredUserReview = {
    ...dto,
    target: mapTargetDtoToDomain(dto.target),
    workspace: mapWorkspaceDtoToDomain(dto.workspace),
    sourceFiles: dto.sourceFiles.map((file) => ({ ...file })),
  };
  const result = ValidatedStoredUserReview.from(stored);
  if (!result.ok) {
    throw new IpcResponseDecodeError(
      command,
      `${path}.archivedAt`,
      dto.status === "archived" ? "ISO date-time string" : "null",
      dto.archivedAt === null ? "null" : "string",
    );
  }
  return ValidatedStoredUserReview.to(result.validatedStoredUserReview);
}

function encodeTarget(target: UserReviewTarget) {
  return target.scope === "file"
    ? { scope: "file" as const, specId: target.specId, fileKey: target.fileKey }
    : { scope: "spec" as const, specId: target.specId };
}

function mapProblemDtoToDomain(
  problem: ListUserReviewsResponseDto["problems"][number],
): UserReviewListProblem {
  return { ...problem };
}

function mapTargetDtoToDomain(
  target: UserReviewDto["target"],
): UserReviewTarget {
  if (target.scope === "file") {
    return { ...target };
  }
  return { ...target };
}

function mapWorkspaceDtoToDomain(
  workspace: UserReviewDto["workspace"],
): UserReviewWorkspace {
  if (workspace.mode === "currentWorkspace") {
    return { ...workspace };
  }
  return { ...workspace };
}
