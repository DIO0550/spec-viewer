import { RefreshCcw, RotateCcw } from "lucide-react";

type Props = Readonly<{
  workspacePath: string | null;
  inputValue: string;
  isLoading: boolean;
  errorMessage: string | null;
  onInputChange: (nextValue: string) => void;
  onLoad: () => void;
  onReset: () => void;
}>;

/** @returns Workspace path controls and current workspace status. */
export function WorkspaceToolbar({
  workspacePath,
  inputValue,
  isLoading,
  errorMessage,
  onInputChange,
  onLoad,
  onReset,
}: Props) {
  const canLoad = inputValue.trim().length > 0 && !isLoading;

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
          {createStatusLabel({ workspacePath, isLoading, errorMessage })}
        </span>
      </div>
      <label className="workspace-toolbar__field" htmlFor="workspace-path">
        <span>Workspace path</span>
        <input
          id="workspace-path"
          value={inputValue}
          placeholder="/workspace/spec-reviewer"
          autoComplete="off"
          disabled={isLoading}
          onChange={(event) => {
            onInputChange(event.currentTarget.value);
          }}
        />
      </label>
      <div className="workspace-toolbar__actions">
        <button
          className="button button--primary"
          type="submit"
          disabled={!canLoad}
        >
          <RefreshCcw aria-hidden="true" size={16} />
          {isLoading ? "Loading" : "Load"}
        </button>
        <button
          className="button button--ghost"
          type="button"
          disabled={isLoading && workspacePath === null}
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
  errorMessage,
}: Readonly<{
  workspacePath: string | null;
  isLoading: boolean;
  errorMessage: string | null;
}>): string {
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
