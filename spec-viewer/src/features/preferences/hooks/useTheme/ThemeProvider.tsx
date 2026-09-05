import { type ReactElement, useLayoutEffect, useMemo } from "react";

import { ThemeContext } from "./context";
import type { ThemeProviderProps } from "./types";
import { useThemeState } from "./useThemeState";

/**
 * @param props - Provider props for the managed theme preference.
 * @returns Context provider that owns the application theme state.
 */
export function ThemeProvider(props: ThemeProviderProps): ReactElement {
  if (props.fixedTheme !== undefined) {
    return (
      <FixedThemeProvider theme={props.fixedTheme}>
        {props.children}
      </FixedThemeProvider>
    );
  }

  return <ManagedThemeProvider>{props.children}</ManagedThemeProvider>;
}

/** @returns Context provider backed by the persisted theme preference. */
function ManagedThemeProvider(
  props: Readonly<{ children: ThemeProviderProps["children"] }>,
): ReactElement {
  const value = useThemeState();

  return <ThemeContext value={value}>{props.children}</ThemeContext>;
}

/** @returns Context provider that pins the product to one appearance. */
function FixedThemeProvider(
  props: Readonly<{
    children: ThemeProviderProps["children"];
    theme: NonNullable<ThemeProviderProps["fixedTheme"]>;
  }>,
): ReactElement {
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = props.theme;
    document.documentElement.dataset.themeMode = props.theme;
    document.documentElement.style.colorScheme = props.theme;
  }, [props.theme]);
  const value = useMemo(
    () => ({
      themeMode: props.theme,
      resolvedTheme: props.theme,
      setThemeMode: () => undefined,
    }),
    [props.theme],
  );

  return <ThemeContext value={value}>{props.children}</ThemeContext>;
}
