import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import {
  RepositoryFileTabs,
  type RepositoryFileTabsProps,
} from "@/features/repositoryDiff/components/RepositoryFileTabs";

function StatefulTabs(props: RepositoryFileTabsProps): React.ReactElement {
  const [items, setItems] = useState(props.items);
  const [activePath, setActivePath] = useState(props.activePath);
  return (
    <RepositoryFileTabs
      {...props}
      items={items}
      activePath={activePath}
      onActivate={(path) => {
        setActivePath(path);
        props.onActivate(path);
      }}
      onClose={(path) => {
        const index = items.findIndex((item) => item.path === path);
        const remaining = items.filter((item) => item.path !== path);
        setItems(remaining);
        if (activePath === path) {
          setActivePath(
            remaining[index]?.path ?? remaining[index - 1]?.path ?? null,
          );
        }
        props.onClose(path);
      }}
    />
  );
}

const meta = {
  component: RepositoryFileTabs,
  render: (args) => <StatefulTabs {...args} />,
  args: {
    items: [
      { path: "src/main.ts", change: "modified" },
      { path: "src/new-feature.ts", change: "added" },
      { path: "src/legacy.ts", change: "deleted" },
    ],
    activePath: "src/main.ts",
    onActivate: fn(),
    onClose: fn(),
  },
  argTypes: {
    items: { control: false },
    onActivate: { control: false },
    onClose: { control: false },
  },
} satisfies Meta<typeof RepositoryFileTabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllProps: Story = {
  args: {
    activePath: "src/new-feature.ts",
    disabled: false,
  },
};

export const EdgeCases: Story = {
  args: {
    items: [
      {
        path: "src/features/repositoryDiff/components/RepositoryFileTabs/a-very-long-file-name-that-overflows.tsx",
        change: "renamed",
      },
      { path: "vendor/ignored.log", change: null },
    ],
    activePath:
      "src/features/repositoryDiff/components/RepositoryFileTabs/a-very-long-file-name-that-overflows.tsx",
  },
};

export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tabs = canvas.getAllByRole("tab");
    tabs[0]?.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(tabs[1]).toHaveFocus();
    await expect(tabs[1]).toHaveAttribute("aria-selected", "true");
  },
};
