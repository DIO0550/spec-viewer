import { useCallback, useEffect, useState } from "react";

import {
  ThemeMode,
  type ThemeAppearance,
  type ThemeMode as ThemeModeType,
} from "@/features/preferences/domain/theme";
import { applyDocumentTheme } from "@/lib/documentTheme";
import { readStorageValue, writeStorageValue } from "@/lib/storage";
import { getSystemTheme, subscribeSystemTheme } from "@/lib/systemTheme";

const themeStorageKey = "spec-reviewer.theme-mode";

export type { ThemeModeType as ThemeMode, ThemeAppearance };
export type ResolvedTheme = ThemeAppearance;

type UseThemeResult = Readonly<{
  themeMode: ThemeModeType;
  resolvedTheme: ResolvedTheme;
  setThemeMode: (nextThemeMode: ThemeModeType) => void;
}>;

/** @returns Theme preference state synchronized with document attributes. */
export function useTheme(): UseThemeResult {
  const [themeMode, setThemeModeState] =
    useState<ThemeModeType>(readStoredThemeMode);
  const [systemTheme, setSystemTheme] =
    useState<ThemeAppearance>(getSystemTheme);

  useEffect(() => {
    return subscribeSystemTheme(setSystemTheme);
  }, []);

  const resolvedTheme = ThemeMode.toAppearance(themeMode, systemTheme);

  useEffect(() => {
    applyDocumentTheme(themeMode, resolvedTheme);
    writeStoredThemeMode(themeMode);
  }, [resolvedTheme, themeMode]);

  const setThemeMode = useCallback((nextThemeMode: ThemeModeType): void => {
    setThemeModeState(nextThemeMode);
  }, []);

  return { themeMode, resolvedTheme, setThemeMode };
}

/** @returns Stored theme preference, falling back to system mode. */
function readStoredThemeMode(): ThemeModeType {
  return ThemeMode.parse(readStorageValue(themeStorageKey));
}

/** Persists the selected theme preference when storage is available. */
function writeStoredThemeMode(themeMode: ThemeModeType): void {
  writeStorageValue(themeStorageKey, themeMode);
}
