import type { ReactNode } from "react";

import type {
  ThemeAppearance,
  ThemeMode as ThemeModeType,
} from "@/features/preferences/domain/theme";

export type ResolvedTheme = ThemeAppearance;

export type ThemeContextValue = Readonly<{
  themeMode: ThemeModeType;
  resolvedTheme: ResolvedTheme;
  setThemeMode: (nextThemeMode: ThemeModeType) => void;
}>;

export type ThemeProviderProps = Readonly<{
  children: ReactNode;
}>;
