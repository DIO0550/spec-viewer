import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { DiffReviewSidebar } from "@/features/diffComments/components/DiffReviewSidebar";

const meta = {
  component: DiffReviewSidebar,
  args: {
    comments: [
      {
        id: "exact",
        body: "Null caseを明示してください",
        status: "open",
        locationLabel: "src/parser.ts current 42行目",
        snippet: "return parse(value);",
        resolution: { status: "exact" },
        replies: [
          {
            id: "reply-1",
            body: "確認しました。nullのときは早期returnにします。",
            createdAt: "2026-08-21T00:00:00Z",
          },
        ],
      },
      {
        id: "stale",
        body: "削除理由を文書化してください",
        status: "resolved",
        locationLabel: "src/legacy.ts base 8行目",
        snippet: "legacy();",
        resolution: { status: "stale", reason: "deleted" },
      },
    ],
    filter: "all",
    search: "",
    selectedCommentId: "exact",
    loadState: "ready",
    warnings: [],
    onFilterChange: fn(),
    onSearchChange: fn(),
    onSelectComment: fn(),
    onJump: fn(),
    onResolve: fn(),
    onReply: fn(),
    onReopen: fn(),
    onDelete: fn(),
    onReload: fn(),
  },
  argTypes: {
    onFilterChange: { control: false },
    onSearchChange: { control: false },
    onSelectComment: { control: false },
    onJump: { control: false },
    onResolve: { control: false },
    onReply: { control: false },
    onReopen: { control: false },
    onDelete: { control: false },
    onReload: { control: false },
  },
} satisfies Meta<typeof DiffReviewSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllProps: Story = {
  args: {
    warnings: ["2件のコメント位置を一時的に確認できません"],
    comments: [
      ...meta.args.comments,
      {
        id: "unavailable",
        body: "sourceを再確認してください",
        status: "open",
        locationLabel: "src/io.ts current 3行目",
        snippet: "load();",
        resolution: { status: "unavailable", reason: "io" },
      },
    ],
  },
};

export const EdgeCases: Story = {
  args: { comments: [], selectedCommentId: null },
};

export const Loading: Story = {
  args: { loadState: "loading" },
};

export const Empty: Story = EdgeCases;

// biome-ignore lint/suspicious/noShadowRestrictedNames: Storybookの標準状態名としてErrorを使用する。
export const Error: Story = {
  args: { loadState: "error" },
};

export const StatusFilters: Story = {
  args: {
    comments: meta.args.comments,
    filter: "resolved",
    search: "legacy",
    selectedCommentId: "stale",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("button", { name: "解決済み 1" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      canvas.getByText("削除理由を文書化してください"),
    ).not.toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "コメントを展開 stale" }),
    );
    await expect(
      canvas.getByText("削除理由を文書化してください"),
    ).toBeVisible();
  },
};

export const ResolutionStates: Story = {
  args: {
    warnings: ["deadline と permission の位置解決を完了できませんでした"],
    comments: [
      {
        id: "exact-resolution",
        body: "exact",
        status: "open",
        locationLabel: "src/exact.ts current 1行目",
        snippet: "exact();",
        resolution: { status: "exact" },
      },
      {
        id: "relocated-resolution",
        body: "relocated",
        status: "open",
        locationLabel: "src/renamed.ts base 2行目",
        snippet: "relocated();",
        resolution: { status: "relocated" },
      },
      {
        id: "stale-resolution",
        body: "stale",
        status: "open",
        locationLabel: "src/deleted.ts base 3行目",
        snippet: "deleted();",
        resolution: { status: "stale", reason: "ambiguous" },
      },
      {
        id: "unavailable-resolution",
        body: "unavailable",
        status: "open",
        locationLabel: "src/io.ts current 4行目",
        snippet: "load();",
        resolution: { status: "unavailable", reason: "permission" },
      },
    ],
    selectedCommentId: "relocated-resolution",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("button", {
        name: /src\/exact\.ts current 1行目へ移動/,
      }),
    ).toBeEnabled();
    await expect(
      canvas.getByRole("button", { name: /src\/renamed\.ts base 2行目へ移動/ }),
    ).toBeEnabled();
    await expect(
      canvas.getByRole("button", { name: /src\/deleted\.ts base 3行目へ移動/ }),
    ).toBeDisabled();
    await expect(
      canvas.getByRole("button", { name: /src\/io\.ts current 4行目へ移動/ }),
    ).toBeDisabled();
  },
};

export const RevisionConflict: Story = {
  args: {
    warnings: [
      "競合後の最新revisionを読み込みました。編集内容は保持されています",
    ],
    onUpdate: async () => false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "コメントを編集 exact" }),
    );
    const editor = canvas.getByRole("textbox", { name: "コメント本文 exact" });
    await userEvent.clear(editor);
    await userEvent.type(editor, "競合後も保持する編集");
    await userEvent.click(canvas.getByRole("button", { name: "保存 exact" }));
    await expect(editor).toHaveValue("競合後も保持する編集");
    await expect(editor).toHaveFocus();
  },
};

export const CommittedWarnings: Story = {
  args: {
    warnings: [
      "保存は完了しましたが永続化の確認が不確実です",
      "1件のコメント位置を一時的に確認できません",
    ],
    selectedCommentId: "exact",
  },
};

export const ResolverStopped: Story = {
  args: {
    warnings: ["deadline、cancelled"],
    comments: [
      ...meta.args.comments,
      ...Array.from({ length: 4 }, (_, index) => ({
        id: `stopped-${index}`,
        body: `resolver suffix ${index}`,
        status: "open" as const,
        locationLabel: `src/stopped-${index}.ts current ${index + 1}行目`,
        snippet: "pending();",
        resolution: {
          status: "unavailable" as const,
          reason: index < 2 ? "budgetExceeded" : "cancelled",
        },
      })),
    ],
    selectedCommentId: "stopped-3",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText(/resolver suffix/)).toHaveLength(4);
    for (const button of canvas.getAllByRole("button", { name: /へ移動/ })) {
      if (button.getAttribute("aria-label")?.includes("stopped")) {
        await expect(button).toBeDisabled();
      }
    }
  },
};

export const LargeReviewList: Story = {
  args: {
    comments: Array.from({ length: 10_000 }, (_, index) => ({
      id: `large-${index}`,
      body: `Review comment ${index}`,
      status: "open" as const,
      locationLabel: `src/large.ts current ${index + 1}行目`,
      snippet: `line ${index + 1}`,
      resolution: { status: "exact" as const },
    })),
    selectedCommentId: "large-9999",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("button", {
        name: "src/large.ts current 10000行目のコメントを選択",
      }),
    ).toHaveFocus();
    await expect(
      canvasElement.querySelectorAll("article[data-comment-id]"),
    ).toHaveLength(100);
  },
};
