import { useCallback, useEffect, useState } from "react";

import {
  ThemeAppearance,
  ThemeMode,
  type ThemeMode as ThemeModeType,
} from "@/features/preferences/domain/theme";
import { readStorageValue, writeStorageValue } from "@/lib/storage";

const ThemeStorageKey = "spec-reviewer.theme-mode";
const SystemThemeQuery = "(prefers-color-scheme: dark)";

export type { ThemeModeType as ThemeMode, ThemeAppearance };
export type ResolvedTheme = ThemeAppearance;

type UseThemeResult = Readonly<{
  themeMode: ThemeModeType;
  resolvedTheme: ResolvedTheme;
  setThemeMode: (nextThemeMode: ThemeModeType) => void;
}>;

/** @returns Theme preference state synchronized with document attributes. */
export function useTheme(): UseThemeResult {
  const [themeMode, setThemeModeState] = useState<ThemeModeType>(() =>
    ThemeMode.parse(readStorageValue(ThemeStorageKey)),
  );
  const [systemTheme, setSystemTheme] = useState<ThemeAppearance>(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return ThemeAppearance.defaultValue;
    }

    return window.matchMedia(SystemThemeQuery).matches
      ? "dark"
      : ThemeAppearance.defaultValue;
  });

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

  const resolvedTheme = ThemeMode.toAppearance(themeMode, systemTheme);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = resolvedTheme;
      document.documentElement.dataset.themeMode = themeMode;
      document.documentElement.style.colorScheme = resolvedTheme;
    }

    writeStorageValue(ThemeStorageKey, themeMode);
  }, [resolvedTheme, themeMode]);

  const setThemeMode = useCallback((nextThemeMode: ThemeModeType): void => {
    setThemeModeState(nextThemeMode);
  }, []);

  return { themeMode, resolvedTheme, setThemeMode };
}
