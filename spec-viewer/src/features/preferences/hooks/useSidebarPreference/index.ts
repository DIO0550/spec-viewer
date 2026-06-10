import { useCallback, useEffect, useState } from "react";

const sidebarPreferenceStorageKey = "spec-reviewer.comment-sidebar-open";

type UseSidebarPreferenceResult = Readonly<{
  isSidebarOpen: boolean;
  /** Opens the comment sidebar. */
  openSidebar: () => void;
  /** Closes the comment sidebar. */
  closeSidebar: () => void;
}>;

/** @returns Right comment sidebar visibility persisted in browser storage. */
export function useSidebarPreference(): UseSidebarPreferenceResult {
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(
    readStoredSidebarPreference,
  );

  useEffect(() => {
    writeStoredSidebarPreference(isSidebarOpen);
  }, [isSidebarOpen]);

  const openSidebar = useCallback((): void => {
    setIsSidebarOpen(true);
  }, []);

  const closeSidebar = useCallback((): void => {
    setIsSidebarOpen(false);
  }, []);

  return { isSidebarOpen, openSidebar, closeSidebar };
}

/** @returns Stored sidebar visibility, defaulting to open. */
function readStoredSidebarPreference(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  try {
    const storedPreference = window.localStorage.getItem(
      sidebarPreferenceStorageKey,
    );

    if (storedPreference === "false") {
      return false;
    }

    return true;
  } catch {
    return true;
  }
}

/**
 * Persists the sidebar visibility preference when storage is available.
 * @param isSidebarOpen - Sidebar visibility to store.
 */
function writeStoredSidebarPreference(isSidebarOpen: boolean): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      sidebarPreferenceStorageKey,
      String(isSidebarOpen),
    );
  } catch {
    return;
  }
}
