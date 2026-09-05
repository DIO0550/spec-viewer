import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

import { DiffCommentComposer } from "@/features/diffComments/components/DiffCommentComposer";
import {
  DiffReviewSidebar,
  type DiffReviewComment,
} from "@/features/diffComments/components/DiffReviewSidebar";

type WorkspaceScenario =
  | "create-jump-refresh"
  | "pending-a-b-a"
  | "stale"
  | "base-editor"
  | "all-unchanged";

type Props = Readonly<{ scenario: WorkspaceScenario }>;

const meta = {
  title: "Diff/Comments/StatefulWorkspace",
  component: StatefulWorkspace,
  parameters: { layout: "fullscreen" },
  args: { scenario: "create-jump-refresh" },
} satisfies Meta<typeof StatefulWorkspace>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CreateJumpRefresh: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = canvas.getByRole("textbox", { name: "Diff comment draft" });
    await userEvent.type(editor, "created in workspace");
    await userEvent.click(canvas.getByRole("button", { name: "保存" }));
    await userEvent.click(canvas.getByRole("button", { name: /へ移動/ }));
    await expect(canvas.getByRole("status")).toHaveTextContent("jumped");
    await userEvent.click(canvas.getByRole("button", { name: "Refresh" }));
    await expect(canvas.getByText("created in workspace")).toBeVisible();
  },
};

export const PendingIdentityABA: Story = {
  args: { scenario: "pending-a-b-a" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Diff comment draft" }),
      "pending A",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Worktree B" }));
    await expect(canvas.queryByDisplayValue("pending A")).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Worktree A" }));
    await expect(canvas.getByDisplayValue("pending A")).toBeVisible();
  },
};

export const StaleReanchorAndDiscard: Story = {
  args: { scenario: "stale" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Snapshot changed" }),
    );
    await expect(canvas.getByRole("button", { name: "保存" })).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", { name: "再アンカー" }));
    await expect(canvas.getByRole("button", { name: "保存" })).toBeEnabled();
    await userEvent.click(
      canvas.getByRole("button", { name: "Snapshot changed" }),
    );
    await userEvent.click(canvas.getByRole("button", { name: "キャンセル" }));
    await expect(
      canvas.queryByRole("textbox", { name: "Diff comment draft" }),
    ).toBeNull();
  },
};

export const BaseEditorHideRestore: Story = {
  args: { scenario: "base-editor" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Editor" }));
    await expect(
      canvas.queryByRole("textbox", { name: "Diff comment draft" }),
    ).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Unified" }));
    await expect(canvas.getByDisplayValue("base draft")).toBeVisible();
  },
};

export const AllUnchangedPersistence: Story = {
  args: { scenario: "all-unchanged" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Save unchanged" }),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Reload workspace" }),
    );
    await expect(canvas.getByText("unchanged persisted")).toBeVisible();
  },
};

/**
 * Renders a stateful production-component fixture for workspace interaction stories.
 *
 * @param props - The workspace transition scenario to initialize.
 * @returns A controlled composer and Review sidebar with workspace controls.
 */
function StatefulWorkspace({ scenario }: Props) {
  const [identity, setIdentity] = useState<"A" | "B">("A");
  const [drafts, setDrafts] = useState({
    A: scenario === "base-editor" ? "base draft" : "",
    B: "",
  });
  const [comments, setComments] = useState<readonly DiffReviewComment[]>([]);
  const [isStale, setIsStale] = useState(false);
  const [isComposerVisible, setIsComposerVisible] = useState(true);
  const [status, setStatus] = useState("ready");

  const save = (body: string): void => {
    setComments([
      ...comments,
      {
        id: `comment-${comments.length + 1}`,
        body,
        status: "open",
        locationLabel: "implementation-plan.md current 2行目",
        snippet: "current",
        resolution: { status: "exact" },
      },
    ]);
    setDrafts((current) => ({ ...current, [identity]: "" }));
  };

  return (
    <main aria-label="Stateful Diff comment workspace">
      <nav aria-label="Workspace fixture controls">
        <button type="button" onClick={() => setIdentity("A")}>
          Worktree A
        </button>
        <button type="button" onClick={() => setIdentity("B")}>
          Worktree B
        </button>
        <button type="button" onClick={() => setStatus("refreshed")}>
          Refresh
        </button>
        <button type="button" onClick={() => setIsStale(true)}>
          Snapshot changed
        </button>
        <button type="button" onClick={() => setIsComposerVisible(false)}>
          Editor
        </button>
        <button type="button" onClick={() => setIsComposerVisible(true)}>
          Unified
        </button>
        <button type="button" onClick={() => save("unchanged persisted")}>
          Save unchanged
        </button>
        <button type="button" onClick={() => setStatus("reloaded")}>
          Reload workspace
        </button>
      </nav>
      <p role="status">{status}</p>
      {isComposerVisible ? (
        <DiffCommentComposer
          id={`stateful-${identity}`}
          label="Diff comment draft"
          body={drafts[identity]}
          isSaving={false}
          canSubmit={!isStale}
          disabledReason={isStale ? "staleTarget" : null}
          onBodyChange={(body) =>
            setDrafts((current) => ({ ...current, [identity]: body }))
          }
          onCancel={() => setIsComposerVisible(false)}
          onSubmit={save}
          onReanchor={() => setIsStale(false)}
        />
      ) : null}
      <DiffReviewSidebar
        comments={comments}
        filter="all"
        search=""
        selectedCommentId={null}
        loadState="ready"
        warnings={[]}
        onFilterChange={() => undefined}
        onSearchChange={() => undefined}
        onSelectComment={() => undefined}
        onJump={() => setStatus("jumped")}
        onResolve={() => undefined}
        onReopen={() => undefined}
      />
    </main>
  );
}
