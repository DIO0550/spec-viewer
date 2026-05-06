import { useCallback, useEffect, useState } from "react";

const leftNavigationPreferenceStorageKey = "spec-reviewer.left-navigation-open";

type UseLeftNavigationPreferenceResult = Readonly<{
  isLeftNavigationOpen: boolean;
  openLeftNavigation: () => void;
  closeLeftNavigation: () => void;
}>;

/** @returns Left spec navigation visibility persisted in browser storage. */
export function useLeftNavigationPreference(): UseLeftNavigationPreferenceResult {
  const [isLeftNavigationOpen, setIsLeftNavigationOpen] = useState<boolean>(
    readStoredLeftNavigationPreference,
  );

  useEffect(() => {
    writeStoredLeftNavigationPreference(isLeftNavigationOpen);
  }, [isLeftNavigationOpen]);

  const openLeftNavigation = useCallback((): void => {
    setIsLeftNavigationOpen(true);
  }, []);

  const closeLeftNavigation = useCallback((): void => {
    setIsLeftNavigationOpen(false);
  }, []);

  return {
    isLeftNavigationOpen,
    openLeftNavigation,
    closeLeftNavigation,
  };
}

/** @returns Stored left navigation visibility, defaulting to closed. */
function readStoredLeftNavigationPreference(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const storedPreference = window.localStorage.getItem(
      leftNavigationPreferenceStorageKey,
    );

    if (storedPreference === "true") {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/** Persists the left navigation visibility preference when storage is available. */
function writeStoredLeftNavigationPreference(
  isLeftNavigationOpen: boolean,
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      leftNavigationPreferenceStorageKey,
      String(isLeftNavigationOpen),
    );
  } catch {
    return;
  }
}
