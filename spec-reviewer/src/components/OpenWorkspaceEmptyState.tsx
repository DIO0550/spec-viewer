import { FolderOpen } from "lucide-react";

import { EmptyState } from "./EmptyState";

type Props = Readonly<{
  isOpening: boolean;
  onOpenWorkspace: () => void;
}>;

/** @returns An initial empty state that opens the native workspace picker. */
export function OpenWorkspaceEmptyState({ isOpening, onOpenWorkspace }: Props) {
  return (
    <section
      id="markdown-viewer-panel"
      className="markdown-viewer markdown-viewer--center"
      role="tabpanel"
      tabIndex={-1}
    >
      <EmptyState
        title="Open a workspace"
        description="Choose a supported spec workspace to read Markdown files."
        action={
          <button
            className="button button--primary"
            type="button"
            disabled={isOpening}
            onClick={onOpenWorkspace}
          >
            <FolderOpen aria-hidden="true" size={16} />
            {isOpening ? "Opening" : "Open workspace"}
          </button>
        }
      />
    </section>
  );
}
