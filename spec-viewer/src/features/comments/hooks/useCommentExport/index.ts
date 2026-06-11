import { useCallback, useEffect, useState } from "react";

import {
  CommentExport,
  type CommentExportState,
} from "@/features/comments/domain/commentExport";
import {
  createSpecSkillMcpFeedbackDryRunPayload,
  renderSpecSkillMcpFeedbackDryRunPayload,
} from "@/features/comments/lib/mcpFeedback";
import type {
  Comment,
  CommentExportScope,
  ExportCommentsTarget,
} from "@/features/comments/types/comment";
import type { SpecFileKey } from "@/features/specs/types/spec";
import {
  exportComments,
  generateLlmPrompt,
  normalizeCommandError,
  selectCommentExportDestination,
} from "@/shared/api/tauri";
import { copyTextToClipboard } from "@/shared/lib/clipboard";

const selectingDestinationMessage = "export先を選択中";
const exportingCommentsMessage = "コメントをexport中";
const generatingLlmPromptMessage = "LLM promptを生成中";
const preparingMcpFeedbackMessage = "MCP feedback dry-run payloadを準備中";

type UseCommentExportOptions = Readonly<{
  workspacePath: string | null;
  specId: string | null;
  fileKey: SpecFileKey | null;
  comments: readonly Comment[];
  resetKey: string;
}>;

export type UseCommentExportResult = Readonly<{
  exportState: CommentExportState;
  /** @param scope - Export scope resolved against the current selection */
  exportCommentScope: (scope: CommentExportScope) => void;
  /** @param scope - Prompt scope resolved against the current selection */
  copyLlmPromptScope: (scope: CommentExportScope) => void;
  /** Copies the dry-run MCP feedback payload for the current file. */
  copyMcpFeedback: () => void;
}>;

/**
 * Runs comment export, LLM prompt copy, and MCP feedback copy operations.
 *
 * @param options - Current selection, visible comments, and the view reset key
 * @returns Export progress state and export trigger operations.
 */
export function useCommentExport({
  workspacePath,
  specId,
  fileKey,
  comments,
  resetKey,
}: UseCommentExportOptions): UseCommentExportResult {
  const [exportState, setExportState] = useState<CommentExportState>(
    CommentExport.idleState,
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies(resetKey): 表示ビューの切り替え（resetKey変更）を契機にexport状態を初期化するための意図的な依存
  useEffect(() => {
    setExportState(CommentExport.idleState);
  }, [resetKey]);

  const runCommentExport = useCallback(
    async (target: ExportCommentsTarget): Promise<void> => {
      if (workspacePath === null) {
        return;
      }

      setExportState(
        CommentExport.savingState(target.scope, selectingDestinationMessage),
      );

      try {
        const destinationPath = await selectCommentExportDestination(target);

        if (destinationPath === null) {
          setExportState(CommentExport.idleState);
          return;
        }

        setExportState(
          CommentExport.savingState(target.scope, exportingCommentsMessage),
        );

        const response = await exportComments({
          workspacePath,
          target,
          destinationPath,
        });

        setExportState(
          CommentExport.successState(
            target.scope,
            CommentExport.formatExportSuccessMessage(response),
          ),
        );
      } catch (error) {
        setExportState(
          CommentExport.errorState(
            target.scope,
            normalizeCommandError(error).message,
          ),
        );
      }
    },
    [workspacePath],
  );

  const runLlmPromptCopy = useCallback(
    async (target: ExportCommentsTarget): Promise<void> => {
      if (workspacePath === null) {
        return;
      }

      setExportState(
        CommentExport.savingState(target.scope, generatingLlmPromptMessage),
      );

      try {
        const response = await generateLlmPrompt({ workspacePath, target });
        await copyTextToClipboard(response.prompt);

        setExportState(
          CommentExport.successState(
            target.scope,
            CommentExport.formatLlmPromptCopySuccessMessage(response),
          ),
        );
      } catch (error) {
        setExportState(
          CommentExport.errorState(
            target.scope,
            normalizeCommandError(error).message,
          ),
        );
      }
    },
    [workspacePath],
  );

  const exportCommentScope = useCallback(
    (scope: CommentExportScope): void => {
      const target = CommentExport.createTarget({ scope, specId, fileKey });

      if (target === null) {
        return;
      }

      void runCommentExport(target);
    },
    [fileKey, runCommentExport, specId],
  );

  const copyLlmPromptScope = useCallback(
    (scope: CommentExportScope): void => {
      const target = CommentExport.createTarget({ scope, specId, fileKey });

      if (target === null) {
        return;
      }

      void runLlmPromptCopy(target);
    },
    [fileKey, runLlmPromptCopy, specId],
  );

  const runMcpFeedbackCopy = useCallback(async (): Promise<void> => {
    if (workspacePath === null || specId === null || fileKey === null) {
      return;
    }

    setExportState(
      CommentExport.savingState("mcpFeedback", preparingMcpFeedbackMessage),
    );

    try {
      const payload = createSpecSkillMcpFeedbackDryRunPayload({
        workspacePath,
        specId,
        fileKey,
        comments,
        generatedAt: new Date().toISOString(),
      });

      await copyTextToClipboard(
        renderSpecSkillMcpFeedbackDryRunPayload(payload),
      );

      setExportState(
        CommentExport.successState(
          "mcpFeedback",
          CommentExport.formatMcpFeedbackCopySuccessMessage(payload),
        ),
      );
    } catch (error) {
      setExportState(
        CommentExport.errorState(
          "mcpFeedback",
          normalizeCommandError(error).message,
        ),
      );
    }
  }, [comments, fileKey, specId, workspacePath]);

  const copyMcpFeedback = useCallback((): void => {
    void runMcpFeedbackCopy();
  }, [runMcpFeedbackCopy]);

  return {
    exportState,
    exportCommentScope,
    copyLlmPromptScope,
    copyMcpFeedback,
  };
}
