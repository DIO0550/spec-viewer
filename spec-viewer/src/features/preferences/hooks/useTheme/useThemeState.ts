import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ThemeAppearance,
  ThemeMode,
  type ThemeMode as ThemeModeType,
} from "@/features/preferences/domain/theme";
import { readStorageValue, writeStorageValue } from "@/lib/storage";

import type { ThemeContextValue } from "./types";

const ThemeStorageKey = "spec-reviewer.theme-mode";
const SystemThemeQuery = "(prefers-color-scheme: dark)";

/** @returns Theme preference state synchronized with document attributes. */
export function useThemeState(): ThemeContextValue {
  const [themeMode, setThemeModeState] = useState<ThemeModeType>(() =>
    ThemeMode.parse(readStorageValue(ThemeStorageKey)),
  );
  const [systemTheme, setSystemTheme] = useState<ThemeAppearance>(
    getInitialSystemTheme,
  );

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }

    const mediaQuery = window.matchMedia(SystemThemeQuery);
    const listener = (): void => {
      setSystemTheme(
        mediaQuery.matches ? "dark" : ThemeAppearance.defaultValue,
      );
    };

    mediaQuery.addEventListener("change", listener);

    return () => {
      mediaQuery.removeEventListener("change", listener);
    };
  }, []);

  const setThemeMode = useCallback((nextThemeMode: ThemeModeType): void => {
    setThemeModeState(nextThemeMode);
  }, []);

  const resolvedTheme = ThemeMode.toAppearance(themeMode, systemTheme);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = resolvedTheme;
      document.documentElement.dataset.themeMode = themeMode;
      document.documentElement.style.colorScheme = resolvedTheme;
    }

    writeStorageValue(ThemeStorageKey, themeMode);
  }, [resolvedTheme, themeMode]);

  return useMemo(
    () => ({ themeMode, resolvedTheme, setThemeMode }),
    [themeMode, resolvedTheme, setThemeMode],
  );
}

/** @returns Initial system theme appearance from the browser preference. */
function getInitialSystemTheme(): ThemeAppearance {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return ThemeAppearance.defaultValue;
  }

  return window.matchMedia(SystemThemeQuery).matches
    ? "dark"
    : ThemeAppearance.defaultValue;
}
