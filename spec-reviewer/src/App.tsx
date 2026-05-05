import { useState } from "react";

import "./App.css";
import { AppShell } from "./components/AppShell";
import { MarkdownViewer } from "./components/MarkdownViewer";
import { SpecTabs } from "./components/SpecTabs";
import { SpecTree } from "./components/SpecTree";
import { WorkspaceToolbar } from "./components/WorkspaceToolbar";
import { useSpecs } from "./hooks/useSpecs";
import { useWorkspace } from "./hooks/useWorkspace";

function App() {
  const workspace = useWorkspace();
  const specs = useSpecs({ workspacePath: workspace.workspace?.root ?? null });
  const [workspaceInput, setWorkspaceInput] = useState("");

  const loadWorkspace = (): void => {
    const selectedDirectory = workspaceInput.trim();

    if (selectedDirectory.length === 0) {
      return;
    }

    void workspace.load(selectedDirectory);
  };

  const resetWorkspace = (): void => {
    setWorkspaceInput("");
    workspace.reset();
  };

  return (
    <AppShell
      toolbar={
        <WorkspaceToolbar
          workspacePath={workspace.workspacePath}
          inputValue={workspaceInput}
          isLoading={workspace.isLoading}
          errorMessage={workspace.error?.message ?? null}
          onInputChange={setWorkspaceInput}
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
        <MarkdownViewer
          state={specs.documentState}
          selectedSpecLabel={specs.selectedSpec?.label ?? null}
          selectedFileLabel={specs.selectedFile?.label ?? null}
          onReload={() => {
            void specs.reloadDocument();
          }}
        />
      }
    />
  );
}

export default App;
