import { useCallback, useEffect, useState } from "react";

const workspaceSidebarSectionPreferenceStorageKey =
  "spec-reviewer.workspace-sidebar-section-open";

type UseWorkspaceSidebarSectionPreferenceResult = Readonly<{
  isWorkspaceSidebarSectionOpen: boolean;
  /** ワークスペース切替セクションの開閉を切り替える。 */
  toggleWorkspaceSidebarSection: () => void;
}>;

/** @returns Workspace switcher section visibility persisted in browser storage. */
export function useWorkspaceSidebarSectionPreference(): UseWorkspaceSidebarSectionPreferenceResult {
  const [isWorkspaceSidebarSectionOpen, setIsWorkspaceSidebarSectionOpen] =
    useState<boolean>(readStoredWorkspaceSidebarSectionPreference);

  useEffect(() => {
    writeStoredWorkspaceSidebarSectionPreference(isWorkspaceSidebarSectionOpen);
  }, [isWorkspaceSidebarSectionOpen]);

  const toggleWorkspaceSidebarSection = useCallback((): void => {
    setIsWorkspaceSidebarSectionOpen((currentValue) => !currentValue);
  }, []);

  return {
    isWorkspaceSidebarSectionOpen,
    toggleWorkspaceSidebarSection,
  };
}

/** @returns Stored workspace section visibility, defaulting to open. */
function readStoredWorkspaceSidebarSectionPreference(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  try {
    const storedPreference = window.localStorage.getItem(
      workspaceSidebarSectionPreferenceStorageKey,
    );

    if (storedPreference === "false") {
      return false;
    }

    return true;
  } catch {
    return true;
  }
}

/** Persists the workspace section visibility preference when storage is available. */
function writeStoredWorkspaceSidebarSectionPreference(
  isWorkspaceSidebarSectionOpen: boolean,
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      workspaceSidebarSectionPreferenceStorageKey,
      String(isWorkspaceSidebarSectionOpen),
    );
  } catch {
    return;
  }
}
