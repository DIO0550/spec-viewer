import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { DiffWorkspace, ViewModeToolbar } from "@/features/diff";
import type { ViewMode } from "@/features/workspace/types/viewMode";
import App from ".";

const meta = {
  title: "App",
  component: App,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div style={{ height: "100vh" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof App>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const DiffIntegration: Story = {
  /** Renders the standalone fixture that toggles between Specs and Diff modes. */
  render: () => <DiffIntegrationFixture />,
  /**
   * Verifies the comment sidebar is shown in Specs mode, hidden in Diff
   * mode, and shown again when switching back to Specs.
   *
   * @param context - Storybook play context providing the rendered canvas element.
   */
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByLabelText("コメントサイドバー"),
    ).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("tab", { name: "Diff" }));
    await expect(
      canvas.queryByLabelText("コメントサイドバー"),
    ).not.toBeInTheDocument();
    await expect(
      canvas.getByText("選択中のファイルに変更はありません。"),
    ).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("tab", { name: "Specs" }));
    await expect(
      canvas.getByLabelText("コメントサイドバー"),
    ).toBeInTheDocument();
  },
};

/**
 * Standalone fixture pairing `ViewModeToolbar` with a Diff/Specs body so
 * the comment sidebar's mode-dependent visibility can be exercised in
 * isolation from the full `App` tree.
 */
function DiffIntegrationFixture() {
  const [mode, setMode] = useState<ViewMode>("specs");
  return (
    <div style={{ minHeight: 420 }}>
      <ViewModeToolbar
        mode={mode}
        activeItemLabel="079-issue-168 / tasks.md"
        diffAvailability={{ status: "ready" }}
        onModeChange={setMode}
      />
      {mode === "diff" ? (
        <DiffWorkspace
          state={{ status: "unchanged" }}
          selectedPath={null}
          preview={null}
          availability={{ status: "ready" }}
        />
      ) : (
        <main aria-label="Spec document">Spec document preview</main>
      )}
      {mode === "specs" ? (
        <aside aria-label="コメントサイドバー">Review comments</aside>
      ) : null}
    </div>
  );
}
