import type { ThemeAppearance } from "@/features/preferences/domain/theme";

export type SystemThemeUnsubscribe = () => void;

const systemThemeQuery = "(prefers-color-scheme: dark)";

/** @returns True when the browser can resolve system theme changes. */
export function canUseSystemThemeApi(): boolean {
  return (
    typeof window !== "undefined" && typeof window.matchMedia === "function"
  );
}

/** @returns Current system theme from the browser media query. */
export function getSystemTheme(): ThemeAppearance {
  const mediaQuery = getSystemThemeMediaQuery();

  if (mediaQuery === null) {
    return "light";
  }

  return getAppearanceFromMediaQuery(mediaQuery);
}

/** @returns Cleanup function for future system theme changes. */
export function subscribeSystemTheme(
  onChange: (nextTheme: ThemeAppearance) => void,
): SystemThemeUnsubscribe {
  const mediaQuery = getSystemThemeMediaQuery();

  if (mediaQuery === null) {
    return () => {};
  }

  const listener = (): void => {
    onChange(getAppearanceFromMediaQuery(mediaQuery));
  };

  mediaQuery.addEventListener("change", listener);

  return () => {
    mediaQuery.removeEventListener("change", listener);
  };
}

function getSystemThemeMediaQuery(): MediaQueryList | null {
  if (!canUseSystemThemeApi()) {
    return null;
  }

  return window.matchMedia(systemThemeQuery);
}

function getAppearanceFromMediaQuery(
  mediaQuery: MediaQueryList,
): ThemeAppearance {
  return mediaQuery.matches ? "dark" : "light";
}
