import { useState } from "react";

import "./App.css";
import { AppShell } from "./components/AppShell";
import { MarkdownViewer } from "./components/MarkdownViewer";
import { OpenWorkspaceEmptyState } from "./components/OpenWorkspaceEmptyState";
import { SpecTabs } from "./components/SpecTabs";
import { SpecTree } from "./components/SpecTree";
import { WorkspaceToolbar } from "./components/WorkspaceToolbar";
import { useSpecs } from "./hooks/useSpecs";
import { useWorkspace } from "./hooks/useWorkspace";
import { normalizeCommandError, selectWorkspaceDirectory } from "./lib/tauri";

function App() {
  const workspace = useWorkspace();
  const specs = useSpecs({ workspacePath: workspace.workspace?.root ?? null });
  const [workspaceInput, setWorkspaceInput] = useState("");
  const [isBrowsingWorkspace, setIsBrowsingWorkspace] = useState(false);
  const [dialogErrorMessage, setDialogErrorMessage] = useState<string | null>(
    null,
  );

  const loadWorkspacePath = async (
    selectedDirectory: string,
  ): Promise<void> => {
    setDialogErrorMessage(null);
    setWorkspaceInput(selectedDirectory);
    await workspace.load(selectedDirectory);
  };

  const browseWorkspace = async (): Promise<void> => {
    if (workspace.isLoading || isBrowsingWorkspace) {
      return;
    }

    setDialogErrorMessage(null);
    setIsBrowsingWorkspace(true);

    try {
      const selectedDirectory = await selectWorkspaceDirectory();

      if (selectedDirectory === null) {
        return;
      }

      await loadWorkspacePath(selectedDirectory);
    } catch (error) {
      setDialogErrorMessage(normalizeCommandError(error).message);
    } finally {
      setIsBrowsingWorkspace(false);
    }
  };

  const loadWorkspace = (): void => {
    const selectedDirectory = workspaceInput.trim();

    if (selectedDirectory.length === 0) {
      return;
    }

    void loadWorkspacePath(selectedDirectory);
  };

  const resetWorkspace = (): void => {
    setWorkspaceInput("");
    setDialogErrorMessage(null);
    workspace.reset();
  };

  const toolbarErrorMessage =
    dialogErrorMessage ?? workspace.error?.message ?? null;
  const shouldShowOpenWorkspacePrompt =
    workspace.workspace === null && !workspace.isLoading;

  return (
    <AppShell
      toolbar={
        <WorkspaceToolbar
          workspacePath={workspace.workspacePath}
          inputValue={workspaceInput}
          isLoading={workspace.isLoading}
          isBrowsing={isBrowsingWorkspace}
          errorMessage={toolbarErrorMessage}
          onInputChange={setWorkspaceInput}
          onBrowse={() => {
            void browseWorkspace();
          }}
          onLoad={loadWorkspace}
          onReset={resetWorkspace}
        />
      }
      sidebar={
        <SpecTree
          state={specs.specTreeState}
          selectedSpecId={specs.selectedSpecId}
          onSelectSpec={(specId) => {
            void specs.selectSpec(specId);
          }}
          onReload={() => {
            void specs.reloadSpecs();
          }}
        />
      }
      tabs={
        <SpecTabs
          spec={specs.selectedSpec}
          selectedFileKey={specs.selectedFileKey}
          onSelectFile={(fileKey) => {
            void specs.selectFileKey(fileKey);
          }}
        />
      }
      viewer={
        shouldShowOpenWorkspacePrompt ? (
          <OpenWorkspaceEmptyState
            isOpening={isBrowsingWorkspace}
            onOpenWorkspace={() => {
              void browseWorkspace();
            }}
          />
        ) : (
          <MarkdownViewer
            state={specs.documentState}
            selectedSpecLabel={specs.selectedSpec?.label ?? null}
            selectedFileLabel={specs.selectedFile?.label ?? null}
            onReload={() => {
              void specs.reloadDocument();
            }}
          />
        )
      }
    />
  );
}

export default App;
