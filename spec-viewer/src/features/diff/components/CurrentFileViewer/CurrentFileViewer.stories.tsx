import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { type ReactElement, useState } from "react";

import { CurrentFileViewer } from "@/features/diff/components/CurrentFileViewer";
import { DiffViewer } from "@/features/diff/components/DiffViewer";
import { createDiffViewerFixture } from "@/features/diff/components/DiffViewer/testFixtures";
import { Hunk } from "@/features/diff/domain/fileDiff";

const DefaultFixture = createDiffViewerFixture({
  oldContent:
    "const removed = true;\nconst keepA = true;\nconst mode = 'legacy';\nconst keepB = true;",
  newContent:
    "const keepA = true;\nconst mode = 'editor';\nconst keepB = true;\nconst added = true;",
  hunks: [
    Hunk.fromLines("@@ -1,4 +1,4 @@", [
      { kind: "removed", text: "const removed = true;" },
      { kind: "context", text: "const keepA = true;" },
      { kind: "removed", text: "const mode = 'legacy';" },
      { kind: "added", text: "const mode = 'editor';" },
      { kind: "context", text: "const keepB = true;" },
      { kind: "added", text: "const added = true;" },
    ]),
  ],
});

const AllPropsFixture = createAllPropsFixture();

const meta = {
  component: CurrentFileViewer,
  parameters: { layout: "fullscreen" },
  args: {
    fileDiff: DefaultFixture,
    revisionKey: "story:default",
    activeChangeId: "hunk-0-change-0",
    onActiveChangeIdChange: fn(),
  },
  argTypes: {
    fileDiff: { control: false },
    revisionKey: { control: false },
    activeChangeId: { control: false },
    onActiveChangeIdChange: { control: false },
  },
} satisfies Meta<typeof CurrentFileViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllProps: Story = {
  args: {
    fileDiff: AllPropsFixture,
    revisionKey: "story:all-props",
    activeChangeId: "hunk-1-change-0",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole("button", { name: "1行削除" });
    await expect(buttons).toHaveLength(3);
    await expect(canvas.getByRole("grid")).toHaveAttribute(
      "aria-rowcount",
      "123",
    );
    for (const button of buttons) {
      await userEvent.click(button);
    }
    await expect(canvasElement).toHaveTextContent("old-start");
    await expect(canvasElement).toHaveTextContent("old-middle");
    await expect(canvasElement).toHaveTextContent("old-eof");
  },
};
export const EdgeCases: Story = {
  args: {
    fileDiff: createDiffViewerFixture({
      status: "renamed",
      oldPath: "src/old-name.ts",
      newPath: "src/new-name.ts",
      oldContent: "unchanged",
      newContent: "unchanged",
      lines: [],
    }),
    revisionKey: "story:renamed-empty-diff",
    activeChangeId: null,
  },
};

export const Empty: Story = {
  args: {
    fileDiff: createDiffViewerFixture({
      oldContent: "",
      newContent: "",
      lines: [],
    }),
    revisionKey: "story:empty",
    activeChangeId: null,
  },
};

export const Degraded: Story = {
  args: {
    fileDiff: createDegradedFixture(),
    revisionKey: "story:degraded",
    activeChangeId: null,
  },
};

export const Error: Story = {
  args: {
    fileDiff: createCurrentUnavailableFixture(),
    revisionKey: "story:binary",
    activeChangeId: null,
  },
};

export const AddedOrUntracked: Story = {
  args: {
    fileDiff: createDiffViewerFixture({
      status: "untracked",
      oldContent: undefined,
      newContent: "const first = true;\nconst second = true;",
      hunks: [
        Hunk.fromLines("@@ -0,0 +1,2 @@", [
          { kind: "added", text: "const first = true;" },
          { kind: "added", text: "const second = true;" },
        ]),
      ],
    }),
    revisionKey: "story:untracked",
    activeChangeId: "hunk-0-change-0",
  },
};

export const Deleted: Story = {
  args: {
    fileDiff: createDiffViewerFixture({
      status: "deleted",
      oldContent: "const first = true;\nconst second = true;",
      hunks: [
        Hunk.fromLines("@@ -1,2 +0,0 @@", [
          { kind: "removed", text: "const first = true;" },
          { kind: "removed", text: "const second = true;" },
        ]),
      ],
    }),
    revisionKey: "story:deleted",
    activeChangeId: "hunk-0-change-0",
  },
};

export const LongSingleLine: Story = {
  args: {
    fileDiff: createDiffViewerFixture({
      oldContent: "x".repeat(4_000),
      newContent: "x".repeat(4_000),
      lines: [],
    }),
    revisionKey: "story:long-line",
    activeChangeId: null,
  },
  play: async ({ canvasElement }) => {
    const surface = canvasElement.querySelector<HTMLElement>(
      ".current-file-viewer__scroll-surface",
    );
    const code = canvasElement.querySelector<HTMLElement>(
      ".current-file-viewer__code",
    );
    await expect(getComputedStyle(code!).whiteSpace).toBe("pre");
    await expect(surface!.scrollWidth).toBeGreaterThan(surface!.clientWidth);
    await expect(canvasElement.querySelectorAll('[role="row"]')).toHaveLength(
      1,
    );
  },
};

export const LargeLineCount: Story = {
  args: {
    fileDiff: createDiffViewerFixture({
      oldContent: createLargeContent(),
      newContent: createLargeContent(),
      lines: [],
    }),
    revisionKey: "story:large",
    activeChangeId: null,
  },
  play: async ({ canvasElement }) => {
    await expect(
      canvasElement.querySelectorAll('[role="row"]').length,
    ).toBeLessThanOrEqual(500);
    await expect(within(canvasElement).getByRole("grid")).toHaveAttribute(
      "aria-rowcount",
      "20000",
    );
  },
};

export const KeyboardPeek: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "変更前 1行" });
    button.focus();
    await userEvent.keyboard("{Enter}");
    const peekLine = canvasElement.querySelector('[data-row-kind="peek-line"]');
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(peekLine).toHaveTextContent("const mode = 'legacy';");
    await expect(peekLine).toHaveAttribute("data-commentable", "false");
  },
};

export const AvailabilityMatrix: Story = {
  render: () => <AvailabilityMatrixFixture />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { name: "Current unavailable" }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole("heading", {
        name: "Structured diff unavailable / degraded",
      }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole("heading", { name: "Pure rename" }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole("heading", { name: "Copy" }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole("heading", { name: "Type changed" }),
    ).toBeInTheDocument();
  },
};

export const LineEndings: Story = {
  render: () => <LineEndingsFixture />,
};

export const InvalidHunks: Story = {
  render: () => <InvalidHunkFixture />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole("alert")).toHaveLength(6);
  },
};

export const WorkspaceRefreshAndMode: Story = {
  render: () => <WorkspaceRefreshModeFixture />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const peek = canvas.getByRole("button", { name: "変更前 1行" });
    await userEvent.click(peek);
    await expect(peek).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(canvas.getByRole("button", { name: "Refresh" }));
    await expect(
      canvas.getByRole("button", { name: "変更前 1行" }),
    ).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(canvas.getByRole("button", { name: "Unified" }));
    await expect(canvas.getByLabelText(/の差分$/)).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Editor" }));
    await expect(canvas.getByLabelText(/のcurrent内容$/)).toBeInTheDocument();
  },
};

export const DarkTheme: Story = {
  globals: { theme: "Dark" },
};

/** Renders every independently classified availability state side by side. */
function AvailabilityMatrixFixture(): ReactElement {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <AvailabilityCase label="Current unavailable">
        <CurrentFileViewer
          fileDiff={createCurrentUnavailableFixture()}
          revisionKey="matrix:binary"
        />
      </AvailabilityCase>
      <AvailabilityCase label="Structured diff unavailable / degraded">
        <CurrentFileViewer
          fileDiff={createDegradedFixture()}
          revisionKey="matrix:degraded"
        />
      </AvailabilityCase>
      <AvailabilityCase label="Availability empty + non-empty current">
        <CurrentFileViewer
          fileDiff={createDiffViewerFixture({
            oldContent: "available-empty-diff",
            newContent: "available-empty-diff",
            lines: [],
          })}
          revisionKey="matrix:available-empty-diff"
        />
      </AvailabilityCase>
      <AvailabilityCase label="Empty file">
        <CurrentFileViewer
          fileDiff={createDiffViewerFixture({
            oldContent: "",
            newContent: "",
            lines: [],
          })}
          revisionKey="matrix:empty"
        />
      </AvailabilityCase>
      <AvailabilityCase label="Pure rename">
        <CurrentFileViewer
          fileDiff={createDiffViewerFixture({
            status: "renamed",
            oldPath: "src/old-name.ts",
            newPath: "src/new-name.ts",
            oldContent: "renamed-current",
            newContent: "renamed-current",
            lines: [],
          })}
          revisionKey="matrix:rename"
        />
      </AvailabilityCase>
      <AvailabilityCase label="Copy">
        <CurrentFileViewer
          fileDiff={createDiffViewerFixture({
            status: "copied",
            oldPath: "src/source.ts",
            newPath: "src/copy.ts",
            oldContent: "copied-current",
            newContent: "copied-current",
            lines: [],
          })}
          revisionKey="matrix:copy"
        />
      </AvailabilityCase>
      <AvailabilityCase label="Type changed">
        <CurrentFileViewer
          fileDiff={createDiffViewerFixture({
            status: "typeChanged",
            oldContent: "type-changed-current",
            newContent: "type-changed-current",
            lines: [],
          })}
          revisionKey="matrix:type-changed"
        />
      </AvailabilityCase>
    </div>
  );
}

/** Labels one availability scenario without changing viewer behavior. */
function AvailabilityCase(
  props: Readonly<{ label: string; children: ReactElement }>,
): ReactElement {
  return (
    <section>
      <h3>{props.label}</h3>
      {props.children}
    </section>
  );
}

/** Renders canonical LF, CRLF, and final-newline variants. */
function LineEndingsFixture(): ReactElement {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section>
        <h3>LF</h3>
        <CurrentFileViewer
          fileDiff={createDiffViewerFixture({
            oldContent: "first\nsecond",
            newContent: "first\nsecond",
            lines: [],
          })}
          revisionKey="endings:lf"
        />
      </section>
      <section>
        <h3>CRLF</h3>
        <CurrentFileViewer
          fileDiff={createDiffViewerFixture({
            oldContent: "first\r\nsecond\r\n",
            newContent: "first\r\nsecond\r\n",
            lines: [],
          })}
          revisionKey="endings:crlf"
        />
      </section>
      <section>
        <h3>Final newlineなし</h3>
        <CurrentFileViewer
          fileDiff={createDiffViewerFixture({
            oldContent: "first\rsecond",
            newContent: "first\rsecond",
            lines: [],
          })}
          revisionKey="endings:cr"
        />
      </section>
    </div>
  );
}

/** Renders every invalid hunk class through the safe inconsistent fallback. */
function InvalidHunkFixture(): ReactElement {
  const invalidCases = [
    {
      label: "Old range",
      fileDiff: createDiffViewerFixture({
        oldContent: "old",
        newContent: "new",
        hunks: [
          {
            header: "@@ -1 +1 @@",
            lines: [
              {
                kind: "removed",
                text: "old",
                oldLineNumber: 2,
                newLineNumber: null,
              },
              {
                kind: "added",
                text: "new",
                oldLineNumber: null,
                newLineNumber: 1,
              },
            ],
          },
        ],
      }),
    },
    {
      label: "New range",
      fileDiff: createDiffViewerFixture({
        oldContent: "old",
        newContent: "new",
        hunks: [
          {
            header: "@@ -1 +1 @@",
            lines: [
              {
                kind: "removed",
                text: "old",
                oldLineNumber: 1,
                newLineNumber: null,
              },
              {
                kind: "added",
                text: "new",
                oldLineNumber: null,
                newLineNumber: 2,
              },
            ],
          },
        ],
      }),
    },
    {
      label: "Hunk order",
      fileDiff: createDiffViewerFixture({
        oldContent: "old-first\nold-second",
        newContent: "new-first\nnew-second",
        hunks: [
          Hunk.fromLines("@@ -2 +2 @@", [
            { kind: "removed", text: "old-second" },
            { kind: "added", text: "new-second" },
          ]),
          Hunk.fromLines("@@ -1 +1 @@", [
            { kind: "removed", text: "old-first" },
            { kind: "added", text: "new-first" },
          ]),
        ],
      }),
    },
    {
      label: "Hunk overlap",
      fileDiff: createDiffViewerFixture({
        oldContent: "old",
        newContent: "new",
        hunks: [
          Hunk.fromLines("@@ -1 +1 @@", [
            { kind: "removed", text: "old" },
            { kind: "added", text: "new" },
          ]),
          Hunk.fromLines("@@ -1 +1 @@", [
            { kind: "removed", text: "old" },
            { kind: "added", text: "new" },
          ]),
        ],
      }),
    },
    {
      label: "Old text mismatch",
      fileDiff: createDiffViewerFixture({
        oldContent: "old",
        newContent: "new",
        hunks: [
          Hunk.fromLines("@@ -1 +1 @@", [
            { kind: "removed", text: "different-old" },
            { kind: "added", text: "new" },
          ]),
        ],
      }),
    },
    {
      label: "New text mismatch",
      fileDiff: createDiffViewerFixture({
        oldContent: "old",
        newContent: "new",
        hunks: [
          Hunk.fromLines("@@ -1 +1 @@", [
            { kind: "removed", text: "old" },
            { kind: "added", text: "different-new" },
          ]),
        ],
      }),
    },
  ] as const;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {invalidCases.map((invalidCase) => (
        <section key={invalidCase.label}>
          <h3>{invalidCase.label}</h3>
          <CurrentFileViewer
            fileDiff={invalidCase.fileDiff}
            revisionKey={`invalid:${invalidCase.label}`}
          />
        </section>
      ))}
    </div>
  );
}

/** Exercises revision-local reset while switching between production viewers. */
function WorkspaceRefreshModeFixture(): ReactElement {
  const [revision, setRevision] = useState(1);
  const [mode, setMode] = useState<"editor" | "unified">("editor");
  return (
    <div style={{ display: "grid", height: 360 }}>
      <div role="toolbar" aria-label="Story controls">
        <button type="button" onClick={() => setMode("unified")}>
          Unified
        </button>
        <button type="button" onClick={() => setMode("editor")}>
          Editor
        </button>
        <button type="button" onClick={() => setRevision((value) => value + 1)}>
          Refresh
        </button>
      </div>
      {mode === "editor" ? (
        <CurrentFileViewer
          fileDiff={DefaultFixture}
          revisionKey={`workspace:snapshot-${revision}:file.ts`}
          activeChangeId="hunk-0-change-1"
          onActiveChangeIdChange={fn()}
        />
      ) : (
        <DiffViewer
          fileDiff={DefaultFixture}
          mode="unified"
          activeChangeId="hunk-0-change-1"
          onActiveChangeIdChange={fn()}
        />
      )}
    </div>
  );
}

/**
 * Creates 120 current lines with deletion peeks at start, middle, and EOF.
 *
 * @returns Valid multi-hunk Story data exercising every deletion boundary.
 */
function createAllPropsFixture(): ReturnType<typeof createDiffViewerFixture> {
  const currentLines = Array.from(
    { length: 120 },
    (_, index) => `current-${index + 1}`,
  );
  const oldLines = [
    "old-start",
    ...currentLines.slice(0, 60),
    "old-middle",
    ...currentLines.slice(60),
    "old-eof",
  ];
  return createDiffViewerFixture({
    oldContent: oldLines.join("\n"),
    newContent: currentLines.join("\n"),
    hunks: [
      Hunk.fromLines("@@ -1 +1,0 @@", [{ kind: "removed", text: "old-start" }]),
      Hunk.fromLines("@@ -62 +61,0 @@", [
        { kind: "removed", text: "old-middle" },
      ]),
      Hunk.fromLines("@@ -123 +121,0 @@", [
        { kind: "removed", text: "old-eof" },
      ]),
    ],
  });
}

/** Creates a binary fixture whose current content itself is unavailable. */
function createCurrentUnavailableFixture() {
  const base = createDiffViewerFixture({ omissionReason: "binary" });
  return {
    ...base,
    review: {
      ...base.review,
      newContent: {
        state: "omitted" as const,
        text: null,
        reason: "binary" as const,
        byteLength: 12,
      },
    },
    availability: { kind: "omitted" as const, reason: "binary" as const },
  };
}

/** Creates a current-available fixture whose structured change metadata is omitted. */
function createDegradedFixture() {
  const base = createDiffViewerFixture({ newContent: "current\ncontent" });
  return {
    ...base,
    review: {
      ...base.review,
      structuredDiff: {
        state: "omitted" as const,
        hunks: [] as const,
        reason: "diffLimit" as const,
      },
    },
    availability: { kind: "omitted" as const, reason: "diffLimit" as const },
  };
}

/** Creates the large unchanged content independently from Story rendering. */
function createLargeContent(): string {
  return Array.from(
    { length: 20_000 },
    (_, index) => `export const line${index + 1} = true;`,
  ).join("\n");
}
