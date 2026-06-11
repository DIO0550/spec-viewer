import { useCallback, useEffect, useState } from "react";

const themeStorageKey = "spec-reviewer.theme-mode";
const darkSchemeQuery = "(prefers-color-scheme: dark)";
const themeModes = ["system", "light", "dark"] as const;

export type ThemeMode = (typeof themeModes)[number];
export type ResolvedTheme = Exclude<ThemeMode, "system">;

type UseThemeResult = Readonly<{
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  /** @param nextThemeMode - Theme preference to apply and persist */
  setThemeMode: (nextThemeMode: ThemeMode) => void;
}>;

/** @returns Theme preference state synchronized with document attributes. */
export function useTheme(): UseThemeResult {
  const [themeMode, setThemeModeState] =
    useState<ThemeMode>(readStoredThemeMode);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);

  useEffect(() => {
    if (!canUseBrowserThemeApi()) {
      return;
    }

    const mediaQuery = window.matchMedia(darkSchemeQuery);
    const updateSystemTheme = (): void => {
      setSystemTheme(mediaQuery.matches ? "dark" : "light");
    };

    updateSystemTheme();
    mediaQuery.addEventListener("change", updateSystemTheme);

    return () => {
      mediaQuery.removeEventListener("change", updateSystemTheme);
    };
  }, []);

  const resolvedTheme = themeMode === "system" ? systemTheme : themeMode;

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = resolvedTheme;
      document.documentElement.dataset.themeMode = themeMode;
      document.documentElement.style.colorScheme = resolvedTheme;
    }

    writeStoredThemeMode(themeMode);
  }, [resolvedTheme, themeMode]);

  const setThemeMode = useCallback((nextThemeMode: ThemeMode): void => {
    setThemeModeState(nextThemeMode);
  }, []);

  return { themeMode, resolvedTheme, setThemeMode };
}

/** @returns True when the browser can resolve system theme changes. */
function canUseBrowserThemeApi(): boolean {
  return typeof window !== "undefined" && "matchMedia" in window;
}

/** @returns Stored theme preference, falling back to system mode. */
function readStoredThemeMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "system";
  }

  try {
    const storedThemeMode = window.localStorage.getItem(themeStorageKey);

    if (isThemeMode(storedThemeMode)) {
      return storedThemeMode;
    }

    return "system";
  } catch {
    return "system";
  }
}

/**
 * Persists the selected theme preference when storage is available.
 * @param themeMode - Theme preference to store
 */
function writeStoredThemeMode(themeMode: ThemeMode): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(themeStorageKey, themeMode);
  } catch {
    return;
  }
}

/** @returns Current system theme from the browser media query. */
function getSystemTheme(): ResolvedTheme {
  if (!canUseBrowserThemeApi()) {
    return "light";
  }

  return window.matchMedia(darkSchemeQuery).matches ? "dark" : "light";
}

/**
 * @param value - Storage value to inspect
 * @returns True when a storage value is a supported theme mode.
 */
function isThemeMode(value: string | null): value is ThemeMode {
  return themeModes.some((themeMode) => themeMode === value);
}
