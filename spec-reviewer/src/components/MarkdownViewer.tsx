import {
  type ComponentPropsWithoutRef,
  type RefObject,
  useEffect,
  useRef,
} from "react";
import { RefreshCcw } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import type { SpecDocumentState } from "../hooks/useSpecs";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";

type BlockType = "heading" | "paragraph" | "list-item" | "table" | "code";

type BlockMetadata = Readonly<{
  "data-block-type": BlockType;
  "data-block-index": number;
}>;

type BlockIndexer = Readonly<{
  next: (blockType: BlockType) => BlockMetadata;
}>;

type Props = Readonly<{
  state: SpecDocumentState;
  selectedSpecLabel: string | null;
  selectedFileLabel: string | null;
  onReload: () => void;
}>;

/** @returns The Markdown viewer shell with document loading states. */
export function MarkdownViewer({
  state,
  selectedSpecLabel,
  selectedFileLabel,
  onReload,
}: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const resetKey = createViewerResetKey(state);
  useViewerReset(panelRef, resetKey, state.status !== "idle");

  if (state.status === "idle") {
    return (
      <section
        ref={panelRef}
        id="markdown-viewer-panel"
        className="markdown-viewer markdown-viewer--center"
        role="tabpanel"
        tabIndex={-1}
      >
        <EmptyState
          title={selectedSpecLabel === null ? "Choose a spec" : "Choose a file"}
          description="Open a workspace and choose a Markdown file to start reading."
        />
      </section>
    );
  }

  if (state.status === "loading") {
    return (
      <section
        ref={panelRef}
        id="markdown-viewer-panel"
        className="markdown-viewer markdown-viewer--center"
        role="tabpanel"
        aria-live="polite"
        tabIndex={-1}
      >
        <div className="viewer-loading" role="status">
          <span className="viewer-loading__indicator" aria-hidden="true" />
          <span>Loading Markdown...</span>
        </div>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section
        ref={panelRef}
        id="markdown-viewer-panel"
        className="markdown-viewer markdown-viewer--center"
        role="tabpanel"
        tabIndex={-1}
      >
        <ErrorState
          title="Could not load Markdown"
          message={state.error.message}
          actionLabel="Retry"
          onAction={onReload}
        />
      </section>
    );
  }

  if (state.status === "missing") {
    return (
      <section
        ref={panelRef}
        id="markdown-viewer-panel"
        className="markdown-viewer markdown-viewer--center"
        role="tabpanel"
        tabIndex={-1}
      >
        <EmptyState
          title="File missing"
          description={`${state.document.path} is not available in this workspace.`}
        />
      </section>
    );
  }

  const contents = state.document.contents;

  if (contents === null || contents.trim().length === 0) {
    return (
      <section
        ref={panelRef}
        id="markdown-viewer-panel"
        className="markdown-viewer markdown-viewer--center"
        role="tabpanel"
        tabIndex={-1}
      >
        <EmptyState title="File is empty" description={state.document.path} />
      </section>
    );
  }

  return (
    <article
      ref={panelRef}
      id="markdown-viewer-panel"
      className="markdown-viewer"
      role="tabpanel"
      tabIndex={-1}
    >
      <header className="markdown-viewer__header">
        <div>
          <p className="markdown-viewer__eyebrow">{selectedSpecLabel}</p>
          <h1>{selectedFileLabel ?? state.fileKey}</h1>
          <p className="markdown-viewer__path">{state.document.path}</p>
        </div>
        <button
          className="icon-button"
          type="button"
          aria-label="Reload Markdown"
          title="Reload Markdown"
          onClick={onReload}
        >
          <RefreshCcw aria-hidden="true" size={16} />
        </button>
      </header>
      <MarkdownDocument contents={contents} />
    </article>
  );
}

/** Resets the viewer scroll position and focus whenever loaded content changes. */
function useViewerReset(
  panelRef: RefObject<HTMLElement | null>,
  resetKey: string,
  shouldFocus: boolean,
): void {
  const previousResetKeyRef = useRef(resetKey);

  useEffect(() => {
    if (previousResetKeyRef.current === resetKey) {
      return;
    }

    previousResetKeyRef.current = resetKey;
    const panel = panelRef.current;

    if (panel === null) {
      return;
    }

    panel.parentElement?.scrollTo({ top: 0, left: 0, behavior: "auto" });

    if (shouldFocus) {
      panel.focus({ preventScroll: true });
    }
  }, [panelRef, resetKey, shouldFocus]);
}

/** @returns A stable key for viewer content state transitions. */
function createViewerResetKey(state: SpecDocumentState): string {
  const path = state.document?.path ?? "";

  return [
    state.status,
    state.workspacePath ?? "",
    state.specId ?? "",
    state.fileKey ?? "",
    path,
  ].join(":");
}

type MarkdownDocumentProps = Readonly<{
  contents: string;
}>;

/** @returns Rendered Markdown with stable block metadata for comments. */
function MarkdownDocument({ contents }: MarkdownDocumentProps) {
  const blockIndexer = createBlockIndexer();
  const components = createMarkdownComponents(blockIndexer);

  return (
    <div className="markdown-rendered" aria-label="Rendered Markdown document">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {contents}
      </ReactMarkdown>
    </div>
  );
}

/** @returns A sequential block indexer scoped to one Markdown render. */
function createBlockIndexer(): BlockIndexer {
  let blockIndex = 0;

  return {
    next: (blockType: BlockType): BlockMetadata => {
      const metadata = {
        "data-block-type": blockType,
        "data-block-index": blockIndex,
      };
      blockIndex += 1;
      return metadata;
    },
  };
}

/** @returns React Markdown component overrides with comment anchor metadata. */
function createMarkdownComponents(blockIndexer: BlockIndexer): Components {
  return {
    h1: ({ node: _node, ...props }) => (
      <h1 {...props} {...blockIndexer.next("heading")} />
    ),
    h2: ({ node: _node, ...props }) => (
      <h2 {...props} {...blockIndexer.next("heading")} />
    ),
    h3: ({ node: _node, ...props }) => (
      <h3 {...props} {...blockIndexer.next("heading")} />
    ),
    h4: ({ node: _node, ...props }) => (
      <h4 {...props} {...blockIndexer.next("heading")} />
    ),
    h5: ({ node: _node, ...props }) => (
      <h5 {...props} {...blockIndexer.next("heading")} />
    ),
    h6: ({ node: _node, ...props }) => (
      <h6 {...props} {...blockIndexer.next("heading")} />
    ),
    p: ({ node: _node, ...props }) => (
      <p {...props} {...blockIndexer.next("paragraph")} />
    ),
    li: (props) => (
      <MarkdownListItem {...props} {...blockIndexer.next("list-item")} />
    ),
    pre: ({ node: _node, ...props }) => (
      <pre {...props} {...blockIndexer.next("code")} />
    ),
    table: ({ node: _node, ...props }) => (
      <div
        className="markdown-rendered__table-scroll"
        {...blockIndexer.next("table")}
      >
        <table {...props} />
      </div>
    ),
    a: ({ node: _node, ...props }) => <SafeMarkdownLink {...props} />,
    input: ({ node: _node, ...props }) => <ReadOnlyMarkdownInput {...props} />,
  };
}

type LinkProps = ComponentPropsWithoutRef<"a">;

/** @returns A Markdown link with safe external navigation defaults. */
function SafeMarkdownLink({ href, ...props }: LinkProps) {
  const isExternalLink =
    typeof href === "string" &&
    (href.startsWith("http://") || href.startsWith("https://"));

  if (!isExternalLink) {
    return <a href={href} {...props} />;
  }

  return <a href={href} rel="noreferrer" target="_blank" {...props} />;
}

type ListItemProps = ComponentPropsWithoutRef<"li"> &
  Readonly<{
    checked?: boolean | null;
    node?: unknown;
  }> &
  BlockMetadata;

/** @returns A rendered Markdown list item without parser-only props. */
function MarkdownListItem({
  checked: _checked,
  node: _node,
  ...props
}: ListItemProps) {
  return <li {...props} />;
}

type InputProps = ComponentPropsWithoutRef<"input">;

/** @returns A read-only input for rendered Markdown task list items. */
function ReadOnlyMarkdownInput({ type, ...props }: InputProps) {
  if (type !== "checkbox") {
    return <input type={type} {...props} />;
  }

  return <input type={type} {...props} disabled={true} readOnly={true} />;
}
