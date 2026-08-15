import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import {
  SpecArtifact as SpecArtifactDomain,
  type SpecArtifactIdentity,
} from "@/features/specs/domain/specArtifact";
import type { SpecArtifact } from "@/features/specs/types/spec";
import { SpecArtifactTabs } from ".";

const artifacts: readonly SpecArtifact[] = [
  {
    identity: { kind: "standard", fileKey: "impl" },
    fileKey: "impl",
    fileName: "implementation-plan.md",
    label: "Implementation",
    format: "markdown",
    progress: "notStarted",
    path: "implementation-plan.md",
    contents: "",
    blocks: [],
    error: null,
  },
  {
    identity: { kind: "standard", fileKey: "tasks" },
    fileKey: "tasks",
    fileName: "tasks.md",
    label: "Tasks",
    format: "markdown",
    progress: "inProgress",
    path: "tasks.md",
    contents: "- [ ] Continue",
    blocks: [],
    error: null,
  },
  {
    identity: { kind: "directMarkdown", fileName: "Complete.md" },
    fileKey: null,
    fileName: "Complete.md",
    label: "Complete",
    format: "markdown",
    progress: "completed",
    path: "Complete.md",
    contents: "Complete",
    blocks: [],
    error: null,
  },
  {
    identity: { kind: "directMarkdown", fileName: "Unknown.md" },
    fileKey: null,
    fileName: "Unknown.md",
    label: "Unknown",
    format: "markdown",
    progress: "unknown",
    path: "Unknown.md",
    contents: null,
    blocks: [],
    error: { code: "markdownRead", message: "Could not read artifact." },
  },
];

const meta = {
  component: SpecArtifactTabs,
  decorators: [
    (Story) => (
      <div style={{ width: "100%" }}>
        <Story />
      </div>
    ),
  ],
  args: {
    specLabel: "Issue 194",
    artifacts,
    selectedIdentity: artifacts[3]!.identity,
    isSelectionDisabled: false,
    onSelectArtifact: fn(),
  },
} satisfies Meta<typeof SpecArtifactTabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllProgressStates: Story = {};

export const ZeroArtifacts: Story = {
  args: { artifacts: [], selectedIdentity: null },
};

/** Demonstrates selection fallback when the currently selected artifact disappears on reload. */
function ReloadSelectionFallbackDemo() {
  const [visibleArtifacts, setVisibleArtifacts] = useState(artifacts);
  const [selectedIdentity, setSelectedIdentity] =
    useState<SpecArtifactIdentity | null>(artifacts[2]!.identity);

  /** Simulates a reload that removes the currently selected artifact from the list. */
  const simulateReload = (): void => {
    const selectedId =
      selectedIdentity === null
        ? null
        : SpecArtifactDomain.stableId(selectedIdentity);
    const reloadedArtifacts = visibleArtifacts.filter(
      (artifact) =>
        SpecArtifactDomain.stableId(artifact.identity) !== selectedId,
    );
    setVisibleArtifacts(reloadedArtifacts);
    setSelectedIdentity(
      SpecArtifactDomain.preserveOrFirst(reloadedArtifacts, selectedIdentity),
    );
  };

  return (
    <>
      <button type="button" onClick={simulateReload}>
        Reload without selected artifact
      </button>
      <SpecArtifactTabs
        specLabel="Issue 194"
        artifacts={visibleArtifacts}
        selectedIdentity={selectedIdentity}
        isSelectionDisabled={false}
        onSelectArtifact={setSelectedIdentity}
      />
    </>
  );
}

export const ReloadSelectionFallback: Story = {
  /** Renders the interactive selection-fallback demo component. */
  render: () => <ReloadSelectionFallbackDemo />,
};
