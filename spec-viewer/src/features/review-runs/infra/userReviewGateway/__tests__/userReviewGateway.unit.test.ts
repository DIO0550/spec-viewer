import { expect, test, vi } from "vitest";
import { CommentId } from "@/features/comments/types/comment";
import type { CreateUserReviewCommand } from "@/features/review-runs/domain/createUserReviewCommand";
import type { ActiveUserReview } from "@/features/review-runs/domain/userReview";
import {
  archiveUserReview,
  createListUserReviewsRequest,
  createUserReview,
  listUserReviews,
} from "@/features/review-runs/infra/userReviewGateway";
import type { UserReviewDto } from "@/features/review-runs/types/userReviewIpc";
import type { UserReviewCommands } from "@/shared/api/tauri";
import { WorkspacePath } from "@/shared/domain/workspacePath";

const target = {
  scope: "file",
  specId: "auth",
  fileKey: "tasks",
} as const;

const otherTarget = {
  scope: "file",
  specId: "billing",
  fileKey: "requirements",
} as const;

const activeReview = createUserReviewDto({
  id: "review-active",
  status: "active",
  archivedAt: null,
});

const createCommand: CreateUserReviewCommand = {
  workspacePath: WorkspacePath.fromString("/workspace/spec-reviewer"),
  target,
  commentIds: [CommentId.fromString("cmt_1")],
};

test("createListUserReviewsRequestはcorrelationIdがnullなら省略する", () => {
  expect(
    createListUserReviewsRequest("/workspace/spec-reviewer", target, null),
  ).toEqual({
    workspacePath: "/workspace/spec-reviewer",
    target,
  });
});

test("listUserReviewsはresponseをnormalizeして返す", async () => {
  const commands = createCommands({
    listUserReviews: vi.fn().mockResolvedValue({
      active: [activeReview],
      archived: [],
      problems: [],
    }),
  });

  const response = await listUserReviews(
    commands,
    "/workspace/spec-reviewer",
    target,
    "corr-1",
  );

  expect(response.active).toEqual([activeReview]);
  expect(commands.listUserReviews).toHaveBeenCalledWith({
    workspacePath: "/workspace/spec-reviewer",
    target,
    correlationId: "corr-1",
  });
});

test("listUserReviewsはcollection status不整合entryをrejectする", async () => {
  const commands = createCommands({
    listUserReviews: vi.fn().mockResolvedValue({
      active: [
        createUserReviewDto({
          id: "review-invalid-list",
          status: "archived",
          archivedAt: "2026-05-06T12:30:00Z",
        }),
      ],
      archived: [],
      problems: [],
    }),
  });

  await expect(
    listUserReviews(commands, "/workspace/spec-reviewer", target, "corr-1"),
  ).rejects.toThrow(
    "User review review-invalid-list has status archived in active collection",
  );
});

test("createUserReviewはinvalid lifecycle responseをrejectする", async () => {
  const commands = createCommands({
    createUserReview: vi.fn().mockResolvedValue({
      userReview: createUserReviewDto({
        id: "review-invalid",
        status: "archived",
        archivedAt: null,
      }),
    }),
  });

  await expect(createUserReview(commands, createCommand)).rejects.toThrow(
    "Invalid user review review-invalid: archivedMissingArchivedAt",
  );
});
test("createUserReviewはvalid archived responseをtyped mismatchとして拒否する", async () => {
  const archivedReview = createUserReviewDto({
    id: "review-create-archived",
    status: "archived",
    archivedAt: "2026-05-06T12:30:00Z",
  });
  const commands = createCommands({
    createUserReview: vi.fn().mockResolvedValue({
      userReview: archivedReview,
    }),
  });

  await expect(createUserReview(commands, createCommand)).rejects.toMatchObject(
    {
      name: "UserReviewMutationRestoreError",
      reason: "createReturnedArchived",
      userReviewId: "review-create-archived",
    },
  );
});

test("archiveUserReviewはresponseをnormalizeして返す", async () => {
  const archivedReview = createUserReviewDto({
    id: "review-archived",
    status: "archived",
    archivedAt: "2026-05-06T12:30:00Z",
  });
  const commands = createCommands({
    archiveUserReview: vi.fn().mockResolvedValue({
      userReview: archivedReview,
    }),
  });

  const response = await archiveUserReview(
    commands,
    "/workspace/spec-reviewer",
    createActiveUserReview("review-archived"),
  );

  expect(response.userReview).toEqual(archivedReview);
});

test("archiveUserReviewはarchive state不整合responseをrejectする", async () => {
  const commands = createCommands({
    archiveUserReview: vi.fn().mockResolvedValue({
      userReview: createUserReviewDto({
        id: "review-invalid-archive",
        status: "archived",
        archivedAt: null,
      }),
    }),
  });

  await expect(
    archiveUserReview(
      commands,
      "/workspace/spec-reviewer",
      createActiveUserReview("review-invalid-archive"),
    ),
  ).rejects.toThrow(
    "Invalid user review review-invalid-archive: archivedMissingArchivedAt",
  );
});
test("archiveUserReviewはvalid active responseをtyped mismatchとして拒否する", async () => {
  const commands = createCommands({
    archiveUserReview: vi.fn().mockResolvedValue({
      userReview: activeReview,
    }),
  });

  await expect(
    archiveUserReview(
      commands,
      "/workspace/spec-reviewer",
      createActiveUserReview("review-active"),
    ),
  ).rejects.toMatchObject({
    name: "UserReviewMutationRestoreError",
    reason: "archiveReturnedActive",
    userReviewId: "review-active",
  });
});

test.each([
  {
    collection: "active",
    response: {
      active: [{ ...activeReview, target: otherTarget }],
      archived: [],
      problems: [],
    },
    userReviewId: activeReview.id,
  },
  {
    collection: "archived",
    response: {
      active: [],
      archived: [
        {
          ...createUserReviewDto({
            id: "review-archived-target-mismatch",
            status: "archived",
            archivedAt: "2026-05-06T12:30:00Z",
          }),
          target: otherTarget,
        },
      ],
      problems: [],
    },
    userReviewId: "review-archived-target-mismatch",
  },
] as const)("listUserReviewsは$collection各要素のtarget不整合をtyped mismatchとして拒否する", async ({
  response,
  userReviewId,
}) => {
  const commands = createCommands({
    listUserReviews: vi.fn().mockResolvedValue(response),
  });

  await expect(
    listUserReviews(commands, "/workspace/spec-reviewer", target, null),
  ).rejects.toMatchObject({
    name: "UserReviewGatewayResponseMismatchError",
    reason: "listTargetMismatch",
    userReviewId,
  });
});

test("listUserReviewsは不正response envelopeをtyped codec errorで拒否する", async () => {
  const commands = createCommands({
    listUserReviews: vi.fn().mockResolvedValue(null),
  });

  await expect(
    listUserReviews(commands, "/workspace/spec-reviewer", target, null),
  ).rejects.toMatchObject({
    name: "UserReviewIpcCodecError",
    reason: "invalidShape",
    path: "response",
  });
});

test("createUserReviewはresponse target不整合をtyped mismatchとして拒否する", async () => {
  const commands = createCommands({
    createUserReview: vi.fn().mockResolvedValue({
      userReview: { ...activeReview, target: otherTarget },
    }),
  });

  await expect(createUserReview(commands, createCommand)).rejects.toMatchObject(
    {
      name: "UserReviewGatewayResponseMismatchError",
      reason: "createTargetMismatch",
      userReviewId: activeReview.id,
    },
  );
});

test("createUserReviewはresponse commentCount不整合をtyped mismatchとして拒否する", async () => {
  const commands = createCommands({
    createUserReview: vi.fn().mockResolvedValue({
      userReview: { ...activeReview, commentCount: 2 },
    }),
  });

  await expect(createUserReview(commands, createCommand)).rejects.toMatchObject(
    {
      name: "UserReviewGatewayResponseMismatchError",
      reason: "createCommentCountMismatch",
      userReviewId: activeReview.id,
    },
  );
});

test("createUserReviewは不正response envelopeをtyped codec errorで拒否する", async () => {
  const commands = createCommands({
    createUserReview: vi.fn().mockResolvedValue(undefined),
  });

  await expect(createUserReview(commands, createCommand)).rejects.toMatchObject(
    {
      name: "UserReviewIpcCodecError",
      reason: "invalidShape",
      path: "response",
    },
  );
});

test("archiveUserReviewはresponse id不整合をtyped mismatchとして拒否する", async () => {
  const commands = createCommands({
    archiveUserReview: vi.fn().mockResolvedValue({
      userReview: createUserReviewDto({
        id: "review-other",
        status: "archived",
        archivedAt: "2026-05-06T12:30:00Z",
      }),
    }),
  });

  await expect(
    archiveUserReview(
      commands,
      "/workspace/spec-reviewer",
      createActiveUserReview("review-archived"),
    ),
  ).rejects.toMatchObject({
    name: "UserReviewGatewayResponseMismatchError",
    reason: "archiveIdMismatch",
    userReviewId: "review-other",
  });
});

test("archiveUserReviewはresponse target不整合をtyped mismatchとして拒否する", async () => {
  const commands = createCommands({
    archiveUserReview: vi.fn().mockResolvedValue({
      userReview: {
        ...createUserReviewDto({
          id: "review-archived",
          status: "archived",
          archivedAt: "2026-05-06T12:30:00Z",
        }),
        target: otherTarget,
      },
    }),
  });

  await expect(
    archiveUserReview(
      commands,
      "/workspace/spec-reviewer",
      createActiveUserReview("review-archived"),
    ),
  ).rejects.toMatchObject({
    name: "UserReviewGatewayResponseMismatchError",
    reason: "archiveTargetMismatch",
    userReviewId: "review-archived",
  });
});

test.each([
  {
    field: "recordLocator",
    value: "review-other.json",
    reason: "archiveRecordLocatorMismatch",
  },
  {
    field: "commentCount",
    value: 2,
    reason: "archiveCommentCountMismatch",
  },
  {
    field: "createdAt",
    value: "2026-05-06T11:00:00Z",
    reason: "archiveCreatedAtMismatch",
  },
] as const)("archiveUserReviewはresponse $field不整合をtyped mismatchとして拒否する", async ({
  field,
  reason,
  value,
}) => {
  const reviewToArchive = createActiveUserReview("review-archived");
  const commands = createCommands({
    archiveUserReview: vi.fn().mockResolvedValue({
      userReview: {
        ...createUserReviewDto({
          id: reviewToArchive.id,
          status: "archived",
          archivedAt: "2026-05-06T12:30:00Z",
        }),
        [field]: value,
      },
    }),
  });

  await expect(
    archiveUserReview(commands, "/workspace/spec-reviewer", reviewToArchive),
  ).rejects.toMatchObject({
    name: "UserReviewGatewayResponseMismatchError",
    reason,
    userReviewId: reviewToArchive.id,
  });
});

function createActiveUserReview(id: string): ActiveUserReview {
  return {
    ...createUserReviewDto({ id, status: "active", archivedAt: null }),
    schemaVersion: "spec-reviewer.user-review.v1",
    status: "active",
    archivedAt: null,
  };
}

test("archiveUserReviewは不正response envelopeをtyped codec errorで拒否する", async () => {
  const commands = createCommands({
    archiveUserReview: vi.fn().mockResolvedValue({ userReview: null }),
  });

  await expect(
    archiveUserReview(
      commands,
      "/workspace/spec-reviewer",
      createActiveUserReview("review-archived"),
    ),
  ).rejects.toMatchObject({
    name: "UserReviewIpcCodecError",
    reason: "invalidShape",
    path: "response.userReview",
  });
});

function createCommands(
  commands: Partial<UserReviewCommands>,
): UserReviewCommands {
  return {
    createUserReview: vi.fn().mockResolvedValue({ userReview: activeReview }),
    listUserReviews: vi.fn().mockResolvedValue({
      active: [],
      archived: [],
      problems: [],
    }),
    archiveUserReview: vi.fn().mockResolvedValue({ userReview: activeReview }),
    ...commands,
  };
}

function createUserReviewDto(
  input: Pick<UserReviewDto, "archivedAt" | "id" | "status">,
): UserReviewDto {
  return {
    schemaVersion: "spec-reviewer.user-review.v1",
    id: input.id,
    status: input.status,
    target,
    recordLocator: `${input.id}.json`,
    commentCount: 1,
    createdAt: "2026-05-06T12:00:00Z",
    updatedAt: input.archivedAt ?? "2026-05-06T12:00:00Z",
    archivedAt: input.archivedAt,
  };
}
