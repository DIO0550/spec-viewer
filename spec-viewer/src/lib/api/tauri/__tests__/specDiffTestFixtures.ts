export type ContentFixture = {
  state: string;
  text: string | null;
  reason: string | null;
  byteLength: number | null;
};

export type HunkFixture = {
  header: string;
  lines: Array<{ kind: string; text: string }>;
};

export type DetailResponseFixture = {
  specId: string;
  fileKey: string;
  review: {
    file: {
      oldPath: string | null;
      newPath: string | null;
      change: string;
      entryKind: string;
      contentClassification: string;
      similarity: number | null;
      oldMode: string | number | null;
      newMode: string | number | null;
    };
    oldContent: ContentFixture;
    newContent: ContentFixture;
    patch: ContentFixture;
    structuredDiff: {
      state: string;
      hunks: HunkFixture[];
      reason: string | null;
    };
    submodule: null | {
      baseGitlinkOid: string | null;
      indexGitlinkOid: string | null;
      worktreeHeadOid: string | null;
      commitChanged: boolean;
      trackedChanges: boolean;
      untrackedChanges: boolean;
      uninitialized: boolean;
    };
  };
};

export const createMinimalDetailResponse = (): DetailResponseFixture => ({
  specId: "077-issue-166",
  fileKey: "tasks",
  review: {
    file: {
      oldPath: null,
      newPath: "tasks.md",
      change: "added",
      entryKind: "regular",
      contentClassification: "text",
      similarity: null,
      oldMode: null,
      newMode: "100644",
    },
    oldContent: {
      state: "omitted",
      text: null,
      reason: "missingSide",
      byteLength: null,
    },
    newContent: {
      state: "available",
      text: "# Tasks",
      reason: null,
      byteLength: null,
    },
    patch: {
      state: "available",
      text: "@@ -0,0 +1 @@",
      reason: null,
      byteLength: null,
    },
    structuredDiff: {
      state: "available",
      hunks: [],
      reason: null,
    },
    submodule: null,
  },
});

export const createMinimalListResponse = () => ({
  currentSnapshotId: "rs1_snapshot",
  files: [
    {
      specId: "077-issue-166",
      fileKey: "tasks",
      targetPath: ".plugin-workspace/.specs/077-issue-166/tasks.md",
      oldPath: null,
      newPath: "tasks.md",
      change: "added",
    },
  ],
});
