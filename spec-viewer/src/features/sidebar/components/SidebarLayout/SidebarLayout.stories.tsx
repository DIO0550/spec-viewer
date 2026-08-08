import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { WorkspaceLayout } from "@/components/WorkspaceLayout";
import { ThemeProvider } from "@/features/preferences";
import { SidebarPreferenceProvider } from "@/features/sidebar/hooks/useSidebarPreference";

import { SidebarLayout } from ".";

/** Fixture slot content covering every `WorkspaceLayout` region for the default story. */
const layoutContent = (
  <>
    <WorkspaceLayout.Toolbar>
      <div style={{ padding: 12 }}>Toolbar content</div>
    </WorkspaceLayout.Toolbar>
    <WorkspaceLayout.Worktrees>
      <nav aria-label="Example navigation" style={{ padding: 12 }}>
        <p>Workspace</p>
        <button type="button">Tasks</button>
      </nav>
    </WorkspaceLayout.Worktrees>
    <WorkspaceLayout.ModeNavigation>
      <div style={{ padding: 12 }}>Tabs</div>
    </WorkspaceLayout.ModeNavigation>
    <WorkspaceLayout.Content>
      <div style={{ padding: 24 }}>
        <h1>Document preview</h1>
        <p>
          The sidebar-connected layout keeps the main review surface stable.
        </p>
      </div>
    </WorkspaceLayout.Content>
    <WorkspaceLayout.Comments>
      <div style={{ padding: 16 }}>
        <h2>Comments</h2>
        <p>Right sidebar content.</p>
      </div>
    </WorkspaceLayout.Comments>
  </>
);

const meta: Meta<typeof SidebarLayout> = {
  component: SidebarLayout,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <ThemeProvider>
        <SidebarPreferenceProvider>
          <Story />
        </SidebarPreferenceProvider>
      </ThemeProvider>
    ),
  ],
  args: {
    children: layoutContent,
    worktrees: {
      isOpen: true,
      width: 268,
      minWidth: 216,
      maxWidth: 420,
      onOpen: fn(),
      onClose: fn(),
      onWidthChange: fn(),
    },
  },
  argTypes: {
    children: { control: false },
    worktrees: { control: false },
  },
};

export default meta;

type Story = StoryObj<typeof SidebarLayout>;

export const Default: Story = {};

export const AllProps: Story = {
  args: {
    worktrees: {
      isOpen: false,
      width: 216,
      minWidth: 216,
      maxWidth: 420,
      onOpen: fn(),
      onClose: fn(),
      onWidthChange: fn(),
    },
  },
};

export const EdgeCases: Story = {
  args: {
    /** Minimal single-region content to check the layout with sparse slots. */
    children: (
      <WorkspaceLayout.Content>
        <div style={{ padding: 24 }}>
          <p>Minimal layout content</p>
        </div>
      </WorkspaceLayout.Content>
    ),
    worktrees: {
      isOpen: true,
      width: 420,
      minWidth: 216,
      maxWidth: 420,
    },
  },
};
