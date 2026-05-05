import { FolderOpen, RefreshCcw, RotateCcw } from "lucide-react";

type Props = Readonly<{
  workspacePath: string | null;
  inputValue: string;
  isLoading: boolean;
  isBrowsing: boolean;
  errorMessage: string | null;
  onInputChange: (nextValue: string) => void;
  onBrowse: () => void;
  onLoad: () => void;
  onReset: () => void;
}>;

/** @returns Workspace path controls and current workspace status. */
export function WorkspaceToolbar({
  workspacePath,
  inputValue,
  isLoading,
  isBrowsing,
  errorMessage,
  onInputChange,
  onBrowse,
  onLoad,
  onReset,
}: Props) {
  const isBusy = isLoading || isBrowsing;
  const canLoad = inputValue.trim().length > 0 && !isBusy;

  return (
    <form
      className="workspace-toolbar"
      aria-label="Workspace controls"
      onSubmit={(event) => {
        event.preventDefault();
        onLoad();
      }}
    >
      <div className="workspace-toolbar__brand">
        <span className="workspace-toolbar__title">Spec Reviewer</span>
        <span className="workspace-toolbar__status" aria-live="polite">
          {createStatusLabel({
            workspacePath,
            isLoading,
            isBrowsing,
            errorMessage,
          })}
        </span>
      </div>
      <label className="workspace-toolbar__field" htmlFor="workspace-path">
        <span>Workspace path</span>
        <input
          id="workspace-path"
          value={inputValue}
          placeholder="/workspace/spec-reviewer"
          autoComplete="off"
          disabled={isBusy}
          onChange={(event) => {
            onInputChange(event.currentTarget.value);
          }}
        />
      </label>
      <div className="workspace-toolbar__actions">
        <button
          className="icon-button icon-button--primary"
          type="button"
          aria-label="Open workspace folder"
          title="Open workspace folder"
          disabled={isBusy}
          onClick={onBrowse}
        >
          <FolderOpen aria-hidden="true" size={16} />
        </button>
        <button
          className="button button--secondary"
          type="submit"
          disabled={!canLoad}
        >
          <RefreshCcw aria-hidden="true" size={16} />
          {isLoading ? "Loading" : "Load"}
        </button>
        <button
          className="button button--ghost"
          type="button"
          disabled={isBusy && workspacePath === null}
          onClick={onReset}
        >
          <RotateCcw aria-hidden="true" size={16} />
          Reset
        </button>
      </div>
    </form>
  );
}

/** @returns Human-readable workspace status for toolbar assistive text. */
function createStatusLabel({
  workspacePath,
  isLoading,
  isBrowsing,
  errorMessage,
}: Readonly<{
  workspacePath: string | null;
  isLoading: boolean;
  isBrowsing: boolean;
  errorMessage: string | null;
}>): string {
  if (isBrowsing) {
    return "Opening workspace picker";
  }

  if (isLoading) {
    return "Loading workspace";
  }

  if (errorMessage !== null) {
    return errorMessage;
  }

  if (workspacePath !== null) {
    return workspacePath;
  }

  return "No workspace selected";
}
