import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import {
  SpecTreeState,
  type SpecTreeState as SpecTreeStateType,
} from "@/features/specs/domain/specTreeState";
import { createSpecNodeFixture } from "@/features/specs/testing/specNodeFixture";

import { SpecTree } from ".";

const workspacePath = "/workspace/spec-reviewer";
const activeSpec = createSpecNodeFixture({
  id: "primary/074-issue-193",
  label: "074-issue-193",
  sourceGroupId: "primary",
  relativeId: "074-issue-193",
  presentDocumentCount: 3,
});
const archivedSpec = createSpecNodeFixture({
  id: "primary/.archive/074-issue-193",
  label: "074-issue-193",
  sourceGroupId: "primary",
  relativeId: ".archive/074-issue-193",
  presentDocumentCount: 2,
});
const archive = createSpecNodeFixture({
  id: "primary/.archive",
  label: "Archive",
  kind: "archive",
  sourceGroupId: "primary",
  relativeId: ".archive",
  descendantSpecCount: 1,
  children: [archivedSpec],
});
const secondarySpec = createSpecNodeFixture({
  id: "secondary/021-issue-262",
  label: "021-issue-262",
  sourceGroupId: "secondary",
  relativeId: "021-issue-262",
  presentDocumentCount: 1,
});
const secondarySource = createSpecNodeFixture({
  id: "secondary",
  label: "feature-auth (.plugin-worktree)",
  kind: "sourceGroup",
  sourceGroupId: "secondary",
  relativeId: ".",
  descendantSpecCount: 1,
  children: [secondarySpec],
});
const hierarchyState: SpecTreeStateType = {
  status: "ready",
  workspacePath,
  tree: { specs: [activeSpec, archive, secondarySource] },
  error: null,
};
const treeError = {
  feature: "specs" as const,
  code: "specTreeScan" as const,
  message: "The spec tree could not be scanned.",
  cause: {
    command: "list_specs" as const,
    code: "specTreeScan" as const,
    message: "The spec tree could not be scanned.",
    raw: "story fixture",
  },
};
const archiveError = {
  feature: "specs" as const,
  code: "specArchive" as const,
  message: "The spec could not be archived.",
  cause: {
    command: "archive_spec" as const,
    code: "specArchive" as const,
    message: "The spec could not be archived.",
    raw: "story fixture",
  },
};
const archiveResponse = {
  archivedSpecId: activeSpec.id,
  archivePath: "/workspace/spec-reviewer/.plugin-workspace/.specs/.archive/074-issue-193",
  sourceGroupId: "primary",
  destinationNodeId: ".archive/074-issue-193",
} as const;

const meta: Meta<typeof SpecTree> = {
  component: SpecTree,
  decorators: [
    (Story) => (
      <div style={{ minHeight: 480, width: 320 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    state: hierarchyState,
    selectedSpecId: activeSpec.id,
    archivingSpecId: null,
    archiveFailure: null,
    archiveReveal: null,
    isLoading: false,
    onSelectSpec: fn(),
    onArchiveSpec: fn(),
    onRetryArchive: fn(),
    onRefreshArchiveReveal: fn(),
    onReload: fn(),
  },
  argTypes: {
    state: { control: false },
    archiveFailure: { control: false },
    archiveReveal: { control: false },
    onSelectSpec: { control: false },
    onArchiveSpec: { control: false },
    onRetryArchive: { control: false },
    onRefreshArchiveReveal: { control: false },
    onReload: { control: false },
  },
};

export default meta;
type Story = StoryObj<typeof SpecTree>;

export const Hierarchy: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("tree")).toBeInTheDocument();
    await expect(canvas.queryByText("073-issue-192")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByLabelText("Archiveを展開"));
    await expect(canvas.getByText("073-issue-192")).toBeInTheDocument();
    const active = canvas.getByRole("treeitem", { name: /074-issue-193/ });
    active.focus();
    await userEvent.hover(active);
    await userEvent.click(
      canvas.getByLabelText("074-issue-193をアーカイブへ移動"),
    );
    await expect(args.onArchiveSpec).toHaveBeenCalledWith(activeSpec.id);
    active.focus();
    await userEvent.keyboard("{ArrowDown}{Home}{End}");
    await expect(
      canvas.getByRole("treeitem", { name: /feature-auth/ }),
    ).toHaveFocus();
  },
};

export const Processing: Story = {
  args: {
    archivingSpecId: activeSpec.id,
    isLoading: true,
  },
};

export const SuccessReveal: Story = {
  args: {
    selectedSpecId: null,
    archiveReveal: {
      status: "success",
      workspacePath,
      response: archiveResponse,
    },
  },
};

export const FailureRetry: Story = {
  args: {
    archiveFailure: { specId: activeSpec.id, error: archiveError },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "The spec could not be archived.",
    );
    await userEvent.click(canvas.getByRole("button", { name: "アーカイブを再試行" }));
    await expect(args.onRetryArchive).toHaveBeenCalledOnce();
  },
};

export const RevealMissing: Story = {
  args: {
    archiveReveal: {
      status: "missing",
      workspacePath,
      response: {
        ...archiveResponse,
        destinationNodeId: ".archive/missing",
      },
    },
  },
};

export const Loading: Story = {
  args: {
    state: SpecTreeState.loading(workspacePath),
    selectedSpecId: null,
  },
};

export const Error: Story = {
  args: {
    state: SpecTreeState.failed(workspacePath, treeError),
    selectedSpecId: null,
  },
};

export const Empty: Story = {
  args: {
    state: SpecTreeState.loaded(workspacePath, { specs: [] }),
    selectedSpecId: null,
  },
};

export const LongList: Story = {
  args: {
    state: SpecTreeState.loaded(workspacePath, {
      specs: Array.from({ length: 36 }, (_, index) =>
        createSpecNodeFixture({
          id: "primary/" + String(index).padStart(3, "0") + "-long-spec-name",
          label:
            String(index).padStart(3, "0") +
            "-a-very-long-specification-label-for-overflow-verification",
          sourceGroupId: "primary",
          relativeId: String(index).padStart(3, "0") + "-long-spec-name",
          presentDocumentCount: index % 4,
        }),
      ),
    }),
    selectedSpecId: null,
  },
};

export const EdgeCases: Story = {
  args: {
    state: SpecTreeState.idle(),
    selectedSpecId: null,
    onArchiveSpec: undefined,
  },
};
