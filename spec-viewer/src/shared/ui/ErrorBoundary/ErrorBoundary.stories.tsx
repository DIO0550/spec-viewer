import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactElement } from "react";

import { ErrorBoundary } from ".";

function ThrowingChild(): ReactElement {
  throw new globalThis.Error("Story child render failed");
}

const meta: Meta<typeof ErrorBoundary> = {
  component: ErrorBoundary,
  decorators: [
    (Story) => (
      <div style={{ minHeight: 320 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    children: <p>Child content rendered inside the boundary.</p>,
  },
  argTypes: {
    children: { control: false },
  },
};

export default meta;

type Story = StoryObj<typeof ErrorBoundary>;

export const Default: Story = {};

export const Error: Story = {
  args: {
    children: <ThrowingChild />,
  },
};

export const EdgeCases: Story = {
  args: {
    children: (
      <div>
        <h2>Recoverable content</h2>
        <p>
          The boundary passes through nested children when there is no error.
        </p>
      </div>
    ),
  },
};
