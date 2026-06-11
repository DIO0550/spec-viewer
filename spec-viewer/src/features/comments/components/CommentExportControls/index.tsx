import { Clipboard, Download, MoreHorizontal, Sparkles } from "lucide-react";
import { useId, useState } from "react";

import type { CommentExportState } from "@/features/comments/domain/commentExport";
import type {
  ApplyWithAiPlaceholderState,
  CommentExportScope,
} from "@/features/comments/types/comment";
import { uiText } from "@/shared/lib/uiText";

type Props = Readonly<{
  exportState: CommentExportState;
  onExportComments?: (scope: CommentExportScope) => void;
  onCopyLlmPrompt?: (scope: CommentExportScope) => void;
  onCopyMcpFeedback?: () => void;
}>;

const applyWithAiPlaceholderState: ApplyWithAiPlaceholderState = {
  availability: "placeholder",
  enabled: false,
  selectedCommentsInput: null,
  generatedDiffPreview: {
    status: "notGenerated",
    files: [],
  },
  requiresExplicitUserConfirmationBeforeWrite: true,
  markdownWriteSupport: "notConnected",
  explanation: uiText.sidebar.applyAiPlaceholder,
};

const commentExportOptions: readonly Readonly<{
  scope: CommentExportScope;
  exportLabel: string;
  exportAriaLabel: string;
  promptLabel: string;
  promptAriaLabel: string;
}>[] = [
  {
    scope: "file",
    exportLabel: uiText.sidebar.exportFileComments,
    exportAriaLabel: uiText.sidebar.exportFileComments,
    promptLabel: `${uiText.sidebar.file}の${uiText.sidebar.copyPrompt}`,
    promptAriaLabel: `${uiText.sidebar.file}の${uiText.sidebar.copyPrompt}`,
  },
  {
    scope: "spec",
    exportLabel: uiText.sidebar.exportSpecComments,
    exportAriaLabel: uiText.sidebar.exportSpecComments,
    promptLabel: `${uiText.sidebar.spec}の${uiText.sidebar.copyPrompt}`,
    promptAriaLabel: `${uiText.sidebar.spec}の${uiText.sidebar.copyPrompt}`,
  },
  {
    scope: "workspace",
    exportLabel: uiText.sidebar.exportWorkspaceComments,
    exportAriaLabel: uiText.sidebar.exportWorkspaceComments,
    promptLabel: `${uiText.sidebar.workspace}の${uiText.sidebar.copyPrompt}`,
    promptAriaLabel: `${uiText.sidebar.workspace}の${uiText.sidebar.copyPrompt}`,
  },
];

/** @returns Secondary comment export and AI handoff actions for the selected review scope. */
export function CommentExportControls({
  exportState,
  onExportComments,
  onCopyLlmPrompt,
  onCopyMcpFeedback,
}: Props) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuId = useId();
  const placeholderDescriptionId = useId();
  const isCopyingMcpFeedback =
    exportState.status === "saving" && exportState.operation === "mcpFeedback";

  return (
    <div className="comment-sidebar__secondary-actions">
      <button
        className="icon-button comment-sidebar__secondary-trigger"
        type="button"
        aria-label={uiText.sidebar.moreActions}
        title={uiText.sidebar.moreActions}
        aria-controls={menuId}
        aria-expanded={isMenuOpen}
        aria-haspopup="menu"
        onClick={() => {
          setIsMenuOpen((currentIsMenuOpen) => !currentIsMenuOpen);
        }}
      >
        <MoreHorizontal aria-hidden="true" size={14} />
      </button>
      {isMenuOpen ? (
        <div
          id={menuId}
          className="comment-sidebar__exports"
          role="menu"
          aria-label={uiText.sidebar.exports}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setIsMenuOpen(false);
            }
          }}
        >
          {onExportComments === undefined
            ? null
            : commentExportOptions.map((option) => {
                const isSaving =
                  exportState.status === "saving" &&
                  exportState.operation === option.scope;

                return (
                  <button
                    key={`comments-${option.scope}`}
                    className="comment-sidebar__export"
                    type="button"
                    role="menuitem"
                    aria-label={option.exportAriaLabel}
                    disabled={exportState.status === "saving"}
                    onClick={() => {
                      onExportComments(option.scope);
                    }}
                  >
                    <Download aria-hidden="true" size={14} />
                    <span>
                      {isSaving ? uiText.sidebar.saving : option.exportLabel}
                    </span>
                  </button>
                );
              })}
          {onCopyLlmPrompt === undefined
            ? null
            : commentExportOptions.map((option) => (
                <button
                  key={`prompt-${option.scope}`}
                  className="comment-sidebar__export"
                  type="button"
                  role="menuitem"
                  aria-label={option.promptAriaLabel}
                  disabled={exportState.status === "saving"}
                  onClick={() => {
                    onCopyLlmPrompt(option.scope);
                  }}
                >
                  <Clipboard aria-hidden="true" size={14} />
                  <span>{option.promptLabel}</span>
                </button>
              ))}
          {onCopyMcpFeedback === undefined ? null : (
            <button
              className="comment-sidebar__export"
              type="button"
              role="menuitem"
              aria-label="現在のファイルのMCP feedback payloadをコピー"
              disabled={exportState.status === "saving"}
              onClick={onCopyMcpFeedback}
            >
              <Clipboard aria-hidden="true" size={14} />
              <span>
                {isCopyingMcpFeedback
                  ? uiText.sidebar.copying
                  : uiText.sidebar.mcpFeedback}
              </span>
            </button>
          )}
          <button
            className="comment-sidebar__export comment-sidebar__export--placeholder"
            type="button"
            role="menuitem"
            aria-label={uiText.sidebar.applyAiLabel}
            aria-describedby={placeholderDescriptionId}
            disabled={!applyWithAiPlaceholderState.enabled}
          >
            <Sparkles aria-hidden="true" size={14} />
            <span>{uiText.sidebar.applyAi}</span>
          </button>
          <p
            id={placeholderDescriptionId}
            className="comment-sidebar__apply-ai-note"
          >
            {applyWithAiPlaceholderState.explanation}
          </p>
        </div>
      ) : null}
    </div>
  );
}
