import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { ThemeProvider } from "@/features/preferences";
import { SidebarPreferenceProvider } from "@/features/sidebar/hooks/useSidebarPreference";
import { WorkspaceLayout } from "@/components/WorkspaceLayout";

import { SidebarLayout } from ".";

const layoutContent = (
  <>
    <WorkspaceLayout.Pathbar>
      <div style={{ padding: 12 }}>Toolbar content</div>
    </WorkspaceLayout.Pathbar>
    <WorkspaceLayout.LeftNavigation>
      <nav aria-label="Example navigation" style={{ padding: 12 }}>
        <p>Workspace</p>
        <button type="button">Tasks</button>
      </nav>
    </WorkspaceLayout.LeftNavigation>
    <WorkspaceLayout.Main>
      <WorkspaceLayout.Tabs>
        <div style={{ padding: 12 }}>Tabs</div>
      </WorkspaceLayout.Tabs>
      <WorkspaceLayout.Viewer>
        <div style={{ padding: 24 }}>
          <h1>Document preview</h1>
          <p>
            The sidebar-connected layout keeps the main review surface stable.
          </p>
        </div>
      </WorkspaceLayout.Viewer>
    </WorkspaceLayout.Main>
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
    leftNavigation: {
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
    leftNavigation: { control: false },
  },
};

export default meta;

type Story = StoryObj<typeof SidebarLayout>;

export const Default: Story = {};

export const AllProps: Story = {
  args: {
    leftNavigation: {
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
    children: (
      <WorkspaceLayout.Main>
        <WorkspaceLayout.Viewer>
          <div style={{ padding: 24 }}>
            <p>Minimal layout content</p>
          </div>
        </WorkspaceLayout.Viewer>
      </WorkspaceLayout.Main>
    ),
    leftNavigation: {
      isOpen: true,
      width: 420,
      minWidth: 216,
      maxWidth: 420,
    },
  },
};
