import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
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
  /**
   * Keeps the historical story ID while exercising the production App shell.
   * Repository journeys live in the stateful-invoke Playwright suite.
   *
   * @param context - Storybook play context providing the rendered canvas element.
   */
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("textbox", { name: "PATH" }),
    ).toBeInTheDocument();
    await expect(canvas.getByRole("tab", { name: "Diff" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expect(
      canvas.getByRole("button", { name: "Worktree一覧を再読み込み" }),
    ).toBeDisabled();
    await expect(canvas.queryByLabelText("テーマモード")).toBeNull();
    await expect(document.documentElement).toHaveAttribute(
      "data-theme",
      "light",
    );
  },
};
