import type { Meta, StoryObj } from "@storybook/react-vite";

import { RevisionSelector } from ".";

const sha = "a".repeat(40);
const branch = {
  kind: "localBranch",
  name: "refs/heads/feature/revision",
} as const;
const tag = { kind: "tag", name: "refs/tags/v1.0.0" } as const;
const commit = { kind: "commit", sha } as const;
const options = [
  {
    id: "head",
    revision: { kind: "head" } as const,
    label: "HEAD",
    resolvedCommitSha: sha,
  },
  {
    id: `localBranch:${branch.name}`,
    revision: branch,
    label: "feature/revision",
    resolvedCommitSha: sha,
  },
  {
    id: `tag:${tag.name}`,
    revision: tag,
    label: "v1.0.0",
    resolvedCommitSha: sha,
  },
];
const history = {
  items: [
    {
      sha,
      committedAt: "2026-08-04T00:00:00Z",
      message: "Add revision selector",
    },
  ],
  truncated: false,
};

const meta = {
  title: "Features/Diff/RevisionSelector",
  component: RevisionSelector,
  args: {
    value: { kind: "head" },
    options,
    history,
    optionsStatus: "ready",
    historyStatus: "ready",
    isComparing: false,
    errorMessage: null,
    /** No-op story stub; the story does not model revision selection. */
    onChange: () => undefined,
    /** No-op story stub; the story does not model an options retry. */
    onRetryOptions: () => undefined,
    /** No-op story stub; the story does not model a history retry. */
    onRetryHistory: () => undefined,
  },
  decorators: [
    (Story) => (
      <div style={{ minHeight: 520, padding: 32 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RevisionSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DefaultHead: Story = {};
export const BranchSelected: Story = { args: { value: branch } };
export const TagSelected: Story = { args: { value: tag } };
export const CommitSelected: Story = { args: { value: commit } };
export const Loading: Story = {
  args: { optionsStatus: "loading", historyStatus: "loading" },
};
export const EmptyHistory: Story = {
  args: { history: { items: [], truncated: false } },
};
export const Failed: Story = {
  args: {
    optionsStatus: "failed",
    historyStatus: "failed",
    optionsErrorMessage: "ブランチとタグを取得できませんでした。",
    historyErrorMessage: "ファイル履歴を取得できませんでした。",
    errorMessage: "選択したリビジョンを解決できませんでした。",
  },
};
export const LongMessages: Story = {
  args: {
    options: [
      ...options,
      {
        id: "localBranch:refs/heads/feature/a-very-long-revision-name-for-layout-verification",
        revision: {
          kind: "localBranch",
          name: "refs/heads/feature/a-very-long-revision-name-for-layout-verification",
        },
        label: "feature/a-very-long-revision-name-for-layout-verification",
        resolvedCommitSha: sha,
      },
    ],
    history: {
      items: [
        {
          sha,
          committedAt: "2026-08-04T00:00:00Z",
          message:
            "A deliberately long commit subject that verifies wrapping without overflowing the selector",
        },
      ],
      truncated: true,
    },
  },
};
