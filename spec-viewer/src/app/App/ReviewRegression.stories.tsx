import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

type Scenario =
  | "specs-hierarchy"
  | "archive"
  | "progress"
  | "changed-tree"
  | "all-lazy"
  | "unified"
  | "split"
  | "editor"
  | "conflict"
  | "stale"
  | "review-filters"
  | "convergence"
  | "unmanaged"
  | "base-error"
  | "read-denied"
  | "deleted-file";

type Props = Readonly<{ scenario: Scenario; theme: "light" | "dark" }>;

const meta = {
  title: "App/ReviewRegression",
  component: ReviewRegressionFixture,
  parameters: { layout: "fullscreen" },
  args: { scenario: "specs-hierarchy", theme: "light" },
} satisfies Meta<typeof ReviewRegressionFixture>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SpecsHierarchy: Story = {};
export const Archive: Story = { args: { scenario: "archive" } };
export const Progress: Story = { args: { scenario: "progress" } };
export const ChangedTree: Story = { args: { scenario: "changed-tree" } };
export const AllLazy: Story = { args: { scenario: "all-lazy" } };
export const Unified: Story = { args: { scenario: "unified" } };
export const Split: Story = { args: { scenario: "split", theme: "dark" } };
export const Editor: Story = { args: { scenario: "editor", theme: "dark" } };
export const Conflict: Story = { args: { scenario: "conflict" } };
export const Stale: Story = { args: { scenario: "stale", theme: "dark" } };
export const ReviewFilters: Story = { args: { scenario: "review-filters" } };
export const Convergence: Story = {
  args: { scenario: "convergence", theme: "dark" },
};
export const Unmanaged: Story = {
  args: { scenario: "unmanaged" },
  play: assertRetryableError("[R199-ERR-001]", "unmanaged repository"),
};
export const BaseError: Story = {
  args: { scenario: "base-error" },
  play: assertRetryableError("[R199-VIEW-005]", "base resolution failed"),
};
export const ReadDenied: Story = {
  args: { scenario: "read-denied" },
  play: assertRetryableError("[R199-ERR-002]", "read permission denied"),
};
export const DeletedFile: Story = { args: { scenario: "deleted-file" } };

function assertRetryableError(leafId: string, message: string) {
  return async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("alert")).toHaveTextContent(message);
    await userEvent.click(
      canvas.getByRole("button", { name: `${leafId} Retry` }),
    );
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "retry requested",
    );
  };
}

/** Stable cross-feature composition used by required visual tuples. */
function ReviewRegressionFixture({ scenario, theme }: Props) {
  const [status, setStatus] = useState("ready");
  const errors: Partial<Record<Scenario, string>> = {
    unmanaged: "unmanaged repository",
    "base-error": "base resolution failed",
    "read-denied": "read permission denied",
  };
  const error = errors[scenario];
  return (
    <main
      data-theme={theme}
      aria-label="Review regression fixture"
      style={{
        minHeight: "100vh",
        padding: 24,
        background: theme === "dark" ? "#111827" : "#f8fafc",
        color: theme === "dark" ? "#f8fafc" : "#111827",
      }}
    >
      <header>
        <h1>Specs / Diff / Review</h1>
        <p>Scenario: {scenario}</p>
      </header>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(180px, 1fr) 2fr minmax(220px, 1fr)",
          gap: 16,
        }}
      >
        <nav aria-label="Specs hierarchy">
          <strong>Specs</strong>
          <ul>
            <li>Active / 199-regression</li>
            <li>Archive / 198-comments</li>
            <li>Progress: processing → complete</li>
          </ul>
        </nav>
        <section aria-label="Diff workspace">
          <div role="tablist" aria-label="Diff modes">
            <button role="tab" aria-selected={scenario === "unified"}>
              Unified
            </button>
            <button role="tab" aria-selected={scenario === "split"}>
              Split
            </button>
            <button role="tab" aria-selected={scenario === "editor"}>
              Editor
            </button>
          </div>
          <pre>
            {scenario === "deleted-file"
              ? "Selected file was deleted; fallback selected"
              : "+ deterministic review line\n- previous review line"}
          </pre>
        </section>
        <aside aria-label="Review">
          <strong>Review</strong>
          <p>
            {scenario === "conflict"
              ? "Revision conflict — draft preserved"
              : scenario === "stale"
                ? "Stale anchor — re-anchor required"
                : "2 open / 1 resolved"}
          </p>
          <article>implementation-plan.md current 42</article>
        </aside>
      </div>
      {error ? <div role="alert">{error}</div> : null}
      {error ? (
        <button type="button" onClick={() => setStatus("retry requested")}>
          {scenario === "unmanaged"
            ? "[R199-ERR-001]"
            : scenario === "base-error"
              ? "[R199-VIEW-005]"
              : "[R199-ERR-002]"}{" "}
          Retry
        </button>
      ) : null}
      <p role="status">{status}</p>
    </main>
  );
}
