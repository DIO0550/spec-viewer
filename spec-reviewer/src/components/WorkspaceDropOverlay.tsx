import { FolderInput } from "lucide-react";

type Props = Readonly<{
  isVisible: boolean;
}>;

/** @returns A full-window affordance shown while dragging a workspace path. */
export function WorkspaceDropOverlay({ isVisible }: Props) {
  if (!isVisible) {
    return null;
  }

  return (
    <div className="workspace-drop-overlay" role="status" aria-live="polite">
      <div className="workspace-drop-overlay__content">
        <FolderInput aria-hidden="true" size={26} />
        <div>
          <p>Drop workspace folder</p>
          <span>Release to open it in Spec Viewer.</span>
        </div>
      </div>
    </div>
  );
}
