import { useCallback, useEffect, useMemo, useState } from "react";

import { readStorageValue, writeStorageValue } from "@/lib/storage";

import type { SidebarPreferenceContextValue } from "./types";

const SidebarPreferenceStorageKey = "spec-reviewer.comment-sidebar-open";

/** @returns Right comment sidebar visibility persisted in browser storage. */
export function useSidebarPreferenceState(): SidebarPreferenceContextValue {
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(
    () => readStorageValue(SidebarPreferenceStorageKey) !== "false",
  );

  useEffect(() => {
    writeStorageValue(SidebarPreferenceStorageKey, String(isSidebarOpen));
  }, [isSidebarOpen]);

  const openSidebar = useCallback((): void => {
    setIsSidebarOpen(true);
  }, []);

  const closeSidebar = useCallback((): void => {
    setIsSidebarOpen(false);
  }, []);

  return useMemo(
    () => ({ isSidebarOpen, openSidebar, closeSidebar }),
    [isSidebarOpen, openSidebar, closeSidebar],
  );
}
