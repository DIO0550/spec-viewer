import type { ReactElement } from "react";

import type { FileDiff, OmissionReason } from "@/features/diff/domain/fileDiff";

export type CurrentFileViewerProps = Readonly<{
  fileDiff: FileDiff;
}>;

const CurrentContentMessages = {
  binary: "バイナリファイルは表示できません。",
  largeFile: "ファイルが大きすぎるため表示できません。",
  diffLimit: "表示上限を超えています。",
  missingSide: "current側の内容がありません。",
  unsupportedEntryKind: "このファイル種類は表示できません。",
} satisfies Record<OmissionReason, string>;

/**
 * Displays the current file content without editing semantics.
 *
 * @param props - Source-neutral file diff containing current content.
 * @returns Line-numbered content or a reason-specific status.
 */
export function CurrentFileViewer(props: CurrentFileViewerProps): ReactElement {
  const { fileDiff } = props;
  if (fileDiff.review.file.change === "deleted") {
    return (
      <p className="current-file-viewer__state" role="status">
        削除されたためcurrent側に存在しません。
      </p>
    );
  }

  const content = fileDiff.review.newContent;
  if (content.state === "omitted") {
    return (
      <p className="current-file-viewer__state" role="status">
        {CurrentContentMessages[content.reason]}
      </p>
    );
  }

  if (content.text === "") {
    return (
      <p className="current-file-viewer__state" role="status">
        空のファイルです。
      </p>
    );
  }

  const lines = content.text.split("\n");
  return (
    <section
      className="current-file-viewer"
      aria-label={`${fileDiff.identity.path} のcurrent内容`}
    >
      {lines.map((line, index) => (
        <div className="current-file-viewer__row" key={index}>
          <span className="current-file-viewer__line-number" aria-hidden="true">
            {index + 1}
          </span>
          <code>{line || " "}</code>
        </div>
      ))}
    </section>
  );
}
