import { useCallback, useEffect, useState } from "react";
import type { SpecViewResetKeys } from "@/app/App/hooks/types";
import {
  type Comment,
  type CommentExportOperation,
  type CommentExportScope,
  createSpecSkillMcpFeedbackDryRunPayload,
  type ExportCommentsResponse,
  type ExportCommentsTarget,
  type GenerateLlmPromptResponse,
  renderSpecSkillMcpFeedbackDryRunPayload,
  type SpecSkillMcpFeedbackPayload,
} from "@/features/comments";
import {
  exportComments as defaultExportComments,
  generateLlmPrompt as defaultGenerateLlmPrompt,
  selectCommentExportDestination as defaultSelectCommentExportDestination,
} from "@/shared/api/tauri";
import { ExportCommentsCommandError } from "@/shared/api/tauri/exportComments";
import { GenerateLlmPromptCommandError } from "@/shared/api/tauri/generateLlmPrompt";
import { copyTextToClipboard } from "@/shared/lib/clipboard";
import { getUnknownErrorMessage } from "@/shared/lib/errorMessage";

export type CommentExportState =
  | Readonly<{ status: "idle"; operation: null; message: null }>
  | Readonly<{
      status: "saving";
      operation: CommentExportOperation;
      message: string;
    }>
  | Readonly<{
      status: "success";
      operation: CommentExportOperation;
      message: string;
    }>
  | Readonly<{
      status: "error";
      operation: CommentExportOperation;
      message: string;
    }>;

/** IPC コマンドの DI（useComments の `commands?` 規約に合わせて1オブジェクトに集約）。 */
export type CommentExportCommands = Readonly<{
  exportComments: typeof defaultExportComments;
  generateLlmPrompt: typeof defaultGenerateLlmPrompt;
  selectCommentExportDestination: typeof defaultSelectCommentExportDestination;
}>;

export type UseCommentExportOptions = Readonly<{
  resetKeys: SpecViewResetKeys;
  comments: readonly Comment[];
  commands?: CommentExportCommands;
  copyText?: (text: string) => Promise<void>;
}>;

export type UseCommentExportResult = Readonly<{
  commentExportState: CommentExportState;
  exportCommentScope: (scope: CommentExportScope) => void;
  copyLlmPromptScope: (scope: CommentExportScope) => void;
  copyMcpFeedbackPayload: () => Promise<void>;
}>;

const idleCommentExportState: CommentExportState = {
  status: "idle",
  operation: null,
  message: null,
};

const defaultCommentExportCommands: CommentExportCommands = {
  exportComments: defaultExportComments,
  generateLlmPrompt: defaultGenerateLlmPrompt,
  selectCommentExportDestination: defaultSelectCommentExportDestination,
};

/**
 * @param options - Reset keys, current comments and injectable commands / clipboard writer.
 * @returns Comment export / LLM prompt / MCP feedback progress state and triggers.
 */
export function useCommentExport(
  options: UseCommentExportOptions,
): UseCommentExportResult {
  const { resetKeys, comments } = options;
  const commands = options.commands ?? defaultCommentExportCommands;
  const copyText = options.copyText ?? copyTextToClipboard;
  const workspaceRoot = resetKeys.workspaceRoot;
  const specId = resetKeys.specId;
  const fileKey = resetKeys.fileKey;

  const [commentExportState, setCommentExportState] =
    useState<CommentExportState>(idleCommentExportState);

  useEffect(() => {
    setCommentExportState(idleCommentExportState);
  }, [resetKeys.fileKey, resetKeys.specId, resetKeys.workspaceRoot]);

  const runCommentExport = useCallback(
    async (target: ExportCommentsTarget): Promise<void> => {
      if (workspaceRoot === null) {
        return;
      }

      setCommentExportState({
        status: "saving",
        operation: target.scope,
        message: "export先を選択中",
      });

      try {
        const destinationPath =
          await commands.selectCommentExportDestination(target);

        if (destinationPath === null) {
          setCommentExportState(idleCommentExportState);
          return;
        }

        setCommentExportState({
          status: "saving",
          operation: target.scope,
          message: "コメントをexport中",
        });

        const response = await commands.exportComments({
          workspacePath: workspaceRoot,
          target,
          destinationPath,
        });

        setCommentExportState({
          status: "success",
          operation: target.scope,
          message: formatCommentExportSuccessMessage(response),
        });
      } catch (error) {
        setCommentExportState({
          status: "error",
          operation: target.scope,
          message: ExportCommentsCommandError.fromUnknown(error).message,
        });
      }
    },
    [commands, workspaceRoot],
  );

  const exportCommentScope = useCallback(
    (scope: CommentExportScope): void => {
      if (specId === null) {
        return;
      }

      if (scope === "workspace") {
        void runCommentExport({ scope });
        return;
      }

      if (scope === "spec") {
        void runCommentExport({ scope, specId });
        return;
      }

      if (fileKey === null) {
        return;
      }

      void runCommentExport({ scope, specId, fileKey });
    },
    [fileKey, runCommentExport, specId],
  );

  const runLlmPromptCopy = useCallback(
    async (target: ExportCommentsTarget): Promise<void> => {
      if (workspaceRoot === null) {
        return;
      }

      setCommentExportState({
        status: "saving",
        operation: target.scope,
        message: "LLM promptを生成中",
      });

      try {
        const response = await commands.generateLlmPrompt({
          workspacePath: workspaceRoot,
          target,
        });
        await copyText(response.prompt);

        setCommentExportState({
          status: "success",
          operation: target.scope,
          message: formatLlmPromptCopySuccessMessage(response),
        });
      } catch (error) {
        setCommentExportState({
          status: "error",
          operation: target.scope,
          message: GenerateLlmPromptCommandError.fromUnknown(error).message,
        });
      }
    },
    [commands, copyText, workspaceRoot],
  );

  const copyLlmPromptScope = useCallback(
    (scope: CommentExportScope): void => {
      if (specId === null) {
        return;
      }

      if (scope === "workspace") {
        void runLlmPromptCopy({ scope });
        return;
      }

      if (scope === "spec") {
        void runLlmPromptCopy({ scope, specId });
        return;
      }

      if (fileKey === null) {
        return;
      }

      void runLlmPromptCopy({ scope, specId, fileKey });
    },
    [fileKey, runLlmPromptCopy, specId],
  );

  const copyMcpFeedbackPayload = useCallback(async (): Promise<void> => {
    if (workspaceRoot === null || specId === null || fileKey === null) {
      return;
    }

    setCommentExportState({
      status: "saving",
      operation: "mcpFeedback",
      message: "MCP feedback dry-run payloadを準備中",
    });

    try {
      const payload = createSpecSkillMcpFeedbackDryRunPayload({
        workspacePath: workspaceRoot,
        specId,
        fileKey,
        comments,
        generatedAt: new Date().toISOString(),
      });

      await copyText(renderSpecSkillMcpFeedbackDryRunPayload(payload));

      setCommentExportState({
        status: "success",
        operation: "mcpFeedback",
        message: formatMcpFeedbackCopySuccessMessage(payload),
      });
    } catch (error) {
      setCommentExportState({
        status: "error",
        operation: "mcpFeedback",
        message: getUnknownErrorMessage(error),
      });
    }
  }, [comments, copyText, fileKey, specId, workspaceRoot]);

  return {
    commentExportState,
    exportCommentScope,
    copyLlmPromptScope,
    copyMcpFeedbackPayload,
  };
}

/** @returns A compact success message for exported comment bundles. */
function formatCommentExportSuccessMessage(
  response: ExportCommentsResponse,
): string {
  return `${response.commentCount}件のコメントを${response.destinationPath}へexportしました。`;
}

/** @returns A compact success message for copied LLM prompt bundles. */
function formatLlmPromptCopySuccessMessage(
  response: GenerateLlmPromptResponse,
): string {
  return `${response.contextFileCount}ファイル / ${response.commentCount}件のコメントを含むLLM promptをコピーしました。`;
}

/** @returns A compact success message for copied Spec Skill MCP feedback dry-runs. */
function formatMcpFeedbackCopySuccessMessage(
  payload: SpecSkillMcpFeedbackPayload,
): string {
  return `${payload.summary.commentCount}件のコメントを${payload.interface.toolName}向けdry-run MCP feedback payloadとしてコピーしました。`;
}
