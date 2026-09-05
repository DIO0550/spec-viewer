import { expect, test } from "vitest";

import { Workspace } from "@/features/workspace/domain/workspace";

test("Workspace.fromDtoは有効なDTOを検証済みaggregateへ変換する", () => {
  const dto = {
    root: "/workspace/spec-reviewer",
    kind: "plugin-workspace",
    files: [
      {
        key: "tasks",
        label: "Tasks",
        fileName: "tasks.md",
        configSource: "workspaceConfig",
      },
    ],
  };

  const result = Workspace.fromDto(dto);

  expect(result).toEqual({
    ok: true,
    workspace: {
      root: "/workspace/spec-reviewer",
      kind: "plugin-workspace",
      files: [
        {
          key: "tasks",
          label: "Tasks",
          fileName: "tasks.md",
          configSource: "workspaceConfig",
        },
      ],
    },
  });
});

test("Workspace.fromDtoは入力DTOから独立したaggregateを返す", () => {
  const dto = {
    root: "/workspace/spec-reviewer",
    kind: "plugin-workspace",
    files: [{ key: "tasks", label: "Tasks", fileName: "tasks.md" }],
  };

  const result = Workspace.fromDto(dto);
  dto.files[0]!.label = "Changed";

  expect(result).toMatchObject({
    ok: true,
    workspace: { files: [{ label: "Tasks" }] },
  });
});

test.each([
  ["rootが空", { root: "", kind: "plugin-workspace", files: [] }, "root"],
  ["kindが未知", { root: "/workspace", kind: "unknown", files: [] }, "kind"],
  [
    "filesが配列でない",
    { root: "/workspace", kind: "plugin-workspace", files: null },
    "files",
  ],
  [
    "file keyが空",
    {
      root: "/workspace",
      kind: "plugin-workspace",
      files: [{ key: "", label: "Tasks", fileName: "tasks.md" }],
    },
    "files[0].key",
  ],
  [
    "configSourceが未知",
    {
      root: "/workspace",
      kind: "plugin-workspace",
      files: [
        {
          key: "tasks",
          label: "Tasks",
          fileName: "tasks.md",
          configSource: "unknown",
        },
      ],
    },
    "files[0].configSource",
  ],
] as const)("Workspace.fromDtoは%sDTOを拒否する", (_case, dto, field) => {
  const result = Workspace.fromDto(dto);

  expect(result).toMatchObject({
    ok: false,
    error: { field },
  });
});
