import { ArrowLeft } from "lucide-react";
import { type ReactElement, useState } from "react";
import { uiText } from "@/utils/uiText";

export type ApplyAiDiffPreviewRoute = Readonly<{
  fileKey: string;
}>;

type Props = Readonly<{
  route: ApplyAiDiffPreviewRoute;
}>;

type ApplyAiDiffPreviewFile = Readonly<{
  key: string;
  label: string;
  path: string;
  changeSummary: string;
  before: string;
  after: string;
}>;

const applyAiPreviewFiles: readonly ApplyAiDiffPreviewFile[] = [
  {
    key: "tasks",
    label: "tasks.md",
    path: "docs/plans/tasks/later-phases/tasks.md",
    changeSummary: "詳細ページ遷移と比較UIの受け入れ条件を追記",
    before: `## 要件

- レビューコメントを一覧で確認する。
- AI適用は後続実装で接続する。`,
    after: `## 要件

- レビューコメントを一覧で確認し、対象ファイルをクリックして詳細ページへ遷移する。
- 差分詳細ではSplit表示、重ね合わせ表示、スライダー比較を選べる。
- AI適用は後続実装で接続する。`,
  },
  {
    key: "design",
    label: "design.md",
    path: "docs/design/apply-ai-diff-preview.md",
    changeSummary: "差分レビュー画面の操作モデルを明文化",
    before: `## 画面

AI適用前に差分を確認する。`,
    after: `## 画面

AI適用前に差分を確認する。

1. 変更ファイル一覧から対象を選ぶ。
2. 詳細ページでSplitまたは重ね合わせを確認する。
3. スライダーで古い内容と新しい内容の領域を調整する。`,
  },
];

/** @returns Dedicated page for an AI apply generated file diff preview. */
export function ApplyAiDiffPreviewPage({ route }: Props): ReactElement {
  const [diffPreviewPosition, setDiffPreviewPosition] = useState(50);
  const previewFile =
    applyAiPreviewFiles.find((file) => file.key === route.fileKey) ??
    applyAiPreviewFiles[0];

  return (
    <main
      className="apply-ai-preview-page"
      aria-label={uiText.sidebar.applyAiDetails}
    >
      <div className="apply-ai-preview-page__shell">
        <a className="apply-ai-preview-page__back" href="#/">
          <ArrowLeft aria-hidden="true" size={15} />
          <span>{uiText.sidebar.backToReviewer}</span>
        </a>
        <header className="apply-ai-preview-page__header">
          <div>
            <p>{uiText.sidebar.applyAiDetails}</p>
            <h1>{previewFile.label}</h1>
            <span>{previewFile.path}</span>
          </div>
          <strong>{uiText.sidebar.previewOnly}</strong>
        </header>
        <p className="apply-ai-preview-page__summary">
          {previewFile.changeSummary}
        </p>
        <p className="apply-ai-preview-page__description">
          {uiText.sidebar.applyAiDetailsDescription}
        </p>
        <section
          className="apply-ai-preview-page__split"
          aria-label={uiText.sidebar.splitPreview}
        >
          <DiffPreviewPane
            label={uiText.sidebar.beforePreview}
            content={previewFile.before}
          />
          <DiffPreviewPane
            label={uiText.sidebar.afterPreview}
            content={previewFile.after}
          />
        </section>
        <section
          className="apply-ai-preview-page__overlay"
          aria-label={uiText.sidebar.overlaySlider}
        >
          <div className="apply-ai-preview-page__overlay-frame">
            <pre className="apply-ai-preview-page__diff-layer">
              {previewFile.after}
            </pre>
            <pre
              className="apply-ai-preview-page__diff-layer apply-ai-preview-page__diff-layer--before"
              style={{ clipPath: `inset(0 ${100 - diffPreviewPosition}% 0 0)` }}
            >
              {previewFile.before}
            </pre>
            <span
              className="apply-ai-preview-page__diff-divider"
              style={{ left: `${diffPreviewPosition}%` }}
              aria-hidden="true"
            />
          </div>
          <label className="apply-ai-preview-page__slider">
            <span>{uiText.sidebar.overlaySlider}</span>
            <input
              type="range"
              min="0"
              max="100"
              value={diffPreviewPosition}
              aria-label={uiText.sidebar.overlaySlider}
              onInput={(event) => {
                setDiffPreviewPosition(event.currentTarget.valueAsNumber);
              }}
            />
          </label>
        </section>
      </div>
    </main>
  );
}

type DiffPreviewPaneProps = Readonly<{
  label: string;
  content: string;
}>;

/** @returns One before/after Markdown preview pane. */
function DiffPreviewPane({
  label,
  content,
}: DiffPreviewPaneProps): ReactElement {
  return (
    <article className="apply-ai-preview-page__pane">
      <h2>{label}</h2>
      <pre>{content}</pre>
    </article>
  );
}
