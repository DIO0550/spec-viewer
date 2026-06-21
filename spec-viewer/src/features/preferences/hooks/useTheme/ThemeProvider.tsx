import type { ReactElement } from "react";

import { ThemeContext } from "./context";
import type { ThemeProviderProps } from "./types";
import { useThemeState } from "./useThemeState";

/**
 * @param props - Provider props for the managed theme preference.
 * @returns Context provider that owns the application theme state.
 */
export function ThemeProvider(props: ThemeProviderProps): ReactElement {
  const { children } = props;
  const value = useThemeState();

  return <ThemeContext value={value}>{children}</ThemeContext>;
}
