import type { Meta, StoryObj } from "@storybook/react-vite";

import { HtmlDocument } from ".";
import {
  understandingQuizImplFixture,
  understandingQuizPlanFixture,
} from "./fixtures/understandingQuizFixture";

const htmlContents = `<!doctype html>
<html>
  <body>
    <main>
      <h1 id="overview">Technical reference</h1>
      <p>HTML documents render in a sandboxed preview frame.</p>
      <h2 id="schema">Schema</h2>
      <p>Search highlighting stays inside the preview document.</p>
    </main>
  </body>
</html>`;

const meta: Meta<typeof HtmlDocument> = {
  component: HtmlDocument,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div style={{ height: "80vh", minHeight: 360 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    contents: htmlContents,
    path: "/workspace/spec-reviewer/.plugin-workspace/.specs/reference/reference.html",
    zoomPercent: 100,
    searchQuery: "",
    activeSearchMatchIndex: -1,
  },
  argTypes: {
    contents: { control: false },
  },
};

export default meta;

type Story = StoryObj<typeof HtmlDocument>;

export const Default: Story = {};

export const AllProps: Story = {
  args: {
    zoomPercent: 125,
    searchQuery: "schema",
    activeSearchMatchIndex: 0,
  },
};

export const EdgeCases: Story = {
  args: {
    contents: "<main><p>No searchable heading here.</p></main>",
    path: "/workspace/spec-reviewer/test-cases.html",
    zoomPercent: 50,
    searchQuery: "missing phrase",
    activeSearchMatchIndex: -1,
  },
};

export const UnderstandingQuizPlan: Story = {
  args: {
    contents: understandingQuizPlanFixture,
    path: "/workspace/spec-reviewer/.plugin-workspace/.specs/reference/understanding-quiz-plan.html",
    searchQuery: "Missing",
    activeSearchMatchIndex: 0,
  },
};

export const UnderstandingQuizImpl: Story = {
  args: {
    contents: understandingQuizImplFixture,
    path: "/workspace/spec-reviewer/.plugin-workspace/.specs/reference/understanding-quiz-impl.html",
  },
};
