import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { DiffCommentComposer } from "@/features/diffComments/components/DiffCommentComposer";

const meta = {
  component: DiffCommentComposer,
  args: {
    id: "diff-comment-story",
    label: "src/parser.ts current 42行目へのコメント",
    body: "Null caseを明示してください",
    isSaving: false,
    onBodyChange: fn(),
    onCancel: fn(),
    onSubmit: fn(),
  },
  argTypes: {
    origin: { control: false },
    onBodyChange: { control: false },
    onCancel: { control: false },
    onSubmit: { control: false },
  },
} satisfies Meta<typeof DiffCommentComposer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllProps: Story = {
  args: {
    statusMessage: "保存しています",
    errorMessage: "競合を解消してから再試行してください",
  },
};

export const EdgeCases: Story = {
  args: { body: "", isSaving: true },
};

export const StaleTarget: Story = {
  args: {
    canSubmit: false,
    disabledReason: "staleTarget",
    onReanchor: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "保存" })).toBeDisabled();
    await expect(canvas.getByRole("alert")).toHaveTextContent("再アンカー");
    await userEvent.click(canvas.getByRole("button", { name: "再アンカー" }));
  },
};

export const RevisionOverflow: Story = {
  args: { canSubmit: false, disabledReason: "revisionOverflow" },
};

export const RevisionConflict: Story = {
  args: {
    errorMessage: "他の更新と競合しました。入力内容を保持しています。",
    onRetry: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = canvas.getByRole("textbox");
    await expect(editor).toHaveValue("Null caseを明示してください");
    await expect(
      canvas.getByRole("button", { name: "保存を再試行" }),
    ).toBeEnabled();
  },
};

export const CommittedWarnings: Story = {
  args: {
    body: "",
    statusMessage: "コメントを保存しました",
    isDurabilityUncertain: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.queryByRole("button", { name: "保存を再試行" }),
    ).toBeNull();
    await expect(canvas.getByText(/再読み込みして確認/)).toBeVisible();
  },
};

export const PreCommitFailures: Story = {
  render: () => (
    <div style={{ display: "grid", gap: 24 }}>
      <DiffCommentComposer
        {...meta.args}
        id="transient-failure"
        label="一時的な保存失敗"
        errorMessage="storeBusy: 入力内容を保持しています。"
        onRetry={fn()}
      />
      <DiffCommentComposer
        {...meta.args}
        id="permission-failure"
        label="権限エラー"
        canSubmit={false}
        disabledReason="permission"
      />
      <DiffCommentComposer
        {...meta.args}
        id="overflow-failure"
        label="revision上限"
        canSubmit={false}
        disabledReason="revisionOverflow"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("button", { name: "保存を再試行" }),
    ).toBeEnabled();
    await expect(
      canvas
        .getByRole("form", { name: "権限エラー" })
        .querySelector("textarea"),
    ).toHaveValue("Null caseを明示してください");
    await expect(
      canvas
        .getByRole("form", { name: "revision上限" })
        .querySelector("textarea"),
    ).toHaveValue("Null caseを明示してください");
    await expect(
      canvas.getAllByRole("button", { name: "保存" })[1],
    ).toBeDisabled();
    await expect(
      canvas.getAllByRole("button", { name: "保存" })[2],
    ).toBeDisabled();
    await expect(canvas.queryByText(/export/i)).toBeNull();
  },
};

export const DurabilityUncertain: Story = {
  args: { isDurabilityUncertain: true, onRetry: fn() },
  parameters: { themes: { themeOverride: "dark" } },
};
