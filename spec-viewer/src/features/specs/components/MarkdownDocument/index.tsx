import {
  type ComponentPropsWithoutRef,
  createElement,
  type JSX,
  type ReactNode,
  type RefObject,
} from "react";
import ReactMarkdown, {
  type Components,
  type ExtraProps,
} from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

import type {
  Comment,
  CommentAnchorDisplayState,
  CommentId,
} from "@/features/comments/types/comment";
import { BlockIndexer } from "@/features/specs/domain/blockIndexer";
import { CommentAnchorDisplay } from "@/features/specs/domain/commentAnchorDisplay";
import { CommentBlockHighlight } from "@/features/specs/domain/commentBlockHighlight";
import {
  DocumentSearch,
  type DocumentSearchCursor,
} from "@/features/specs/domain/documentSearch";
import type { BlockType } from "@/features/specs/domain/markdownBlock";
import type { MarkdownBlockMetadata } from "@/features/specs/types/spec";
import { uiText } from "@/shared/lib/uiText";
import { getUtf8ByteLength } from "@/shared/lib/utf8";

import {
  MarkdownCommentableBlock,
  MarkdownListItem,
} from "./MarkdownCommentableBlock";
import { renderMarkdownTextChildren } from "./markdownTextChildren";
import type { CreateBlockCommentDraft, RequestCommentEdit } from "./types";

export type {
  CommentEditDraft,
  CreateBlockCommentDraft,
  RequestCommentEdit,
} from "./types";

type LinkProps = ComponentPropsWithoutRef<"a">;

/**
 * @param props - Anchor attributes from the rendered Markdown link
 * @returns A Markdown link with safe external navigation defaults.
 */
function SafeMarkdownLink({ href, ...props }: LinkProps) {
  const isExternalLink =
    typeof href === "string" &&
    (href.startsWith("http://") || href.startsWith("https://"));

  if (!isExternalLink) {
    return <a href={href} {...props} />;
  }

  return <a href={href} rel="noreferrer" target="_blank" {...props} />;
}

type InputProps = ComponentPropsWithoutRef<"input">;

/**
 * @param props - Input attributes from the rendered Markdown task list
 * @returns A read-only input for rendered Markdown task list items.
 */
function ReadOnlyMarkdownInput({ type, ...props }: InputProps) {
  if (type !== "checkbox") {
    return <input type={type} {...props} />;
  }

  return <input type={type} {...props} disabled={true} readOnly={true} />;
}

type CommentableBlockTag =
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "p"
  | "pre";

type MarkdownComponentsInput = Readonly<{
  blockIndexer: BlockIndexer;
  documentSearchCursor: DocumentSearchCursor | null;
  onCreateBlockDraft: CreateBlockCommentDraft;
  onSelectComment?: (commentId: CommentId) => void;
  onRequestCommentEdit?: RequestCommentEdit;
}>;

type CommentableBlockComponentProps = Readonly<{
  node?: unknown;
  children?: ReactNode;
}> &
  Record<string, unknown>;

/**
 * @param input - Block tag, rendered block type, and render-scoped services
 * @returns A renderer that wraps one Markdown element in the comment gutter.
 */
function createCommentableBlockComponent<Tag extends CommentableBlockTag>({
  tag,
  blockType,
  blockIndexer,
  documentSearchCursor,
  onCreateBlockDraft,
  onSelectComment,
  onRequestCommentEdit,
}: MarkdownComponentsInput &
  Readonly<{
    tag: Tag;
    blockType: BlockType;
  }>) {
  /**
   * @param componentProps - Element attributes passed by react-markdown
   * @returns One rendered Markdown block wrapped with comment affordances.
   */
  return function CommentableBlock(
    componentProps: JSX.IntrinsicElements[Tag] & ExtraProps,
  ) {
    const {
      node: _node,
      children,
      ...props
    } = componentProps as CommentableBlockComponentProps;
    const block = blockIndexer.next(blockType);

    return (
      <MarkdownCommentableBlock
        commentAnnotations={block.commentAnnotations}
        onCreateBlockDraft={onCreateBlockDraft}
        onSelectComment={onSelectComment}
        onRequestCommentEdit={onRequestCommentEdit}
      >
        {createElement(
          tag,
          { ...props, ...block.metadata },
          renderMarkdownTextChildren({
            children,
            rangeHighlights: block.rangeHighlights,
            documentSearchCursor,
          }),
        )}
      </MarkdownCommentableBlock>
    );
  };
}

/**
 * @param input - Render-scoped indexer, search cursor, and comment callbacks
 * @returns React Markdown component overrides with comment anchor metadata.
 */
function createMarkdownComponents(input: MarkdownComponentsInput): Components {
  const {
    blockIndexer,
    documentSearchCursor,
    onCreateBlockDraft,
    onSelectComment,
    onRequestCommentEdit,
  } = input;
  /**
   * @param tag - Intrinsic element rendered for the block
   * @param blockType - Rendered block type counted by the indexer
   * @returns A renderer for one commentable Markdown element.
   */
  const commentableBlock = (tag: CommentableBlockTag, blockType: BlockType) =>
    createCommentableBlockComponent({ ...input, tag, blockType });

  return {
    h1: commentableBlock("h1", "heading"),
    h2: commentableBlock("h2", "heading"),
    h3: commentableBlock("h3", "heading"),
    h4: commentableBlock("h4", "heading"),
    h5: commentableBlock("h5", "heading"),
    h6: commentableBlock("h6", "heading"),
    p: commentableBlock("p", "paragraph"),
    pre: commentableBlock("pre", "code"),
    li: ({ children, ...props }) => {
      const block = blockIndexer.next("list-item");

      return (
        <MarkdownListItem
          {...props}
          {...block.metadata}
          commentAnnotations={block.commentAnnotations}
          onCreateBlockDraft={onCreateBlockDraft}
          onSelectComment={onSelectComment}
          onRequestCommentEdit={onRequestCommentEdit}
        >
          {renderMarkdownTextChildren({
            children,
            rangeHighlights: block.rangeHighlights,
            documentSearchCursor,
          })}
        </MarkdownListItem>
      );
    },
    table: ({ node: _node, children, ...props }) => {
      const block = blockIndexer.next("table");

      return (
        <MarkdownCommentableBlock
          commentAnnotations={block.commentAnnotations}
          onCreateBlockDraft={onCreateBlockDraft}
          onSelectComment={onSelectComment}
          onRequestCommentEdit={onRequestCommentEdit}
        >
          <div className="markdown-rendered__table-scroll" {...block.metadata}>
            <table {...props}>
              {renderMarkdownTextChildren({
                children,
                rangeHighlights: block.rangeHighlights,
                documentSearchCursor,
              })}
            </table>
          </div>
        </MarkdownCommentableBlock>
      );
    },
    a: ({ node: _node, ...props }) => <SafeMarkdownLink {...props} />,
    input: ({ node: _node, ...props }) => <ReadOnlyMarkdownInput {...props} />,
  };
}

type Props = Readonly<{
  contents: string;
  blocks: readonly MarkdownBlockMetadata[];
  renderedRootRef: RefObject<HTMLDivElement | null>;
  comments: readonly Comment[];
  activeCommentId: CommentId | null;
  anchorDisplayStates: readonly CommentAnchorDisplayState[];
  documentSearchQuery: string;
  activeDocumentSearchIndex: number;
  syntaxHighlightMaxBytes: number;
  /** @param commentId - Comment selected from the annotation card */
  onSelectComment?: (commentId: CommentId) => void;
  /** @param input - Comment edit request with the anchoring bounds */
  onRequestCommentEdit?: RequestCommentEdit;
  /** @param block - Rendered Markdown block targeted by the new draft */
  onCreateBlockDraft: CreateBlockCommentDraft;
}>;

/** @returns Rendered Markdown with stable block metadata for comments. */
export function MarkdownDocument({
  contents,
  blocks,
  renderedRootRef,
  comments,
  activeCommentId,
  anchorDisplayStates,
  documentSearchQuery,
  activeDocumentSearchIndex,
  syntaxHighlightMaxBytes,
  onSelectComment,
  onRequestCommentEdit,
  onCreateBlockDraft,
}: Props) {
  const anchorDisplayStateByCommentId =
    CommentAnchorDisplay.createStateByCommentId(anchorDisplayStates);
  const highlights = CommentBlockHighlight.fromComments({
    comments,
    activeCommentId,
    anchorDisplayStateByCommentId,
  });
  const blockIndexer = BlockIndexer.create({
    blocks,
    highlights,
  });
  const documentSearchCursor = DocumentSearch.createCursor({
    query: documentSearchQuery,
    activeIndex: activeDocumentSearchIndex,
  });
  const components = createMarkdownComponents({
    blockIndexer,
    documentSearchCursor,
    onCreateBlockDraft,
    onSelectComment,
    onRequestCommentEdit,
  });
  const shouldHighlightSyntax =
    getUtf8ByteLength(contents) <= syntaxHighlightMaxBytes;
  const rehypePlugins = shouldHighlightSyntax ? [rehypeHighlight] : [];

  return (
    <div
      ref={renderedRootRef}
      className="markdown-rendered"
      role="document"
      aria-label={uiText.markdown.renderedDocument}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {contents}
      </ReactMarkdown>
    </div>
  );
}
