import type {
  ThemeAppearance,
  ThemeMode,
} from "@/features/preferences/domain/theme";

/** Applies the selected theme mode and concrete appearance to document state. */
export function applyDocumentTheme(
  themeMode: ThemeMode,
  themeAppearance: ThemeAppearance,
): void {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = themeAppearance;
  document.documentElement.dataset.themeMode = themeMode;
  document.documentElement.style.colorScheme = themeAppearance;
}
