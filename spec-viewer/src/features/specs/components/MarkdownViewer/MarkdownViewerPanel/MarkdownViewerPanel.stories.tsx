import type { Meta, StoryObj } from "@storybook/react-vite";
import { createRef } from "react";

import { MarkdownViewerPanel } from "./index";

const meta: Meta<typeof MarkdownViewerPanel> = {
  component: MarkdownViewerPanel,
  parameters: {
    layout: "fullscreen",
  },
  /**
   * Renders the panel with the story's resolved args and a fresh panel ref.
   * @param args - The story's resolved component args.
   */
  render: (args) => (
    <MarkdownViewerPanel {...args} panelRef={createRef<HTMLElement>()} />
  ),
  args: {
    panelRef: createRef<HTMLElement>(),
    as: "section",
    variant: "default",
    /** Sample rendered Markdown content shown inside the default panel. */
    children: (
      <div className="markdown-rendered">
        <h1>Markdown preview</h1>
        <p>Viewer content keeps the stable tabpanel shell.</p>
      </div>
    ),
  },
  argTypes: {
    panelRef: { control: false },
    children: { control: false },
  },
};

export default meta;

type Story = StoryObj<typeof MarkdownViewerPanel>;

export const Default: Story = {};

export const AllProps: Story = {
  args: {
    as: "article",
    variant: "html",
    interactionOverlayOpen: true,
    /** Sample sandboxed HTML content shown inside the html-variant panel. */
    children: (
      <iframe
        className="html-rendered"
        title="Rendered HTML document"
        sandbox=""
        srcDoc="<main><h1>HTML preview</h1><p>Sandboxed HTML content.</p></main>"
      />
    ),
  },
};

export const EdgeCases: Story = {
  args: {
    variant: "center",
    ariaLive: "polite",
    /** Sample empty-state content shown inside the centered panel variant. */
    children: (
      <section className="empty-state empty-state--panel" aria-live="polite">
        <h2>ファイルを選択</h2>
        <p>ワークスペースを開いてMarkdownファイルを選ぶと読み始められます。</p>
      </section>
    ),
  },
};
