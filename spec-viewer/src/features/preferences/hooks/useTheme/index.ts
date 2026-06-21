import { useContext } from "react";

import { ThemeContext } from "./context";
import type { ThemeContextValue } from "./types";

export { ThemeProvider } from "./ThemeProvider";
export type {
  ThemeAppearance,
  ThemeMode,
} from "@/features/preferences/domain/theme";
export type { ResolvedTheme } from "./types";

/**
 * @returns Current theme context value.
 * @throws Error when used outside ThemeProvider.
 */
export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);

  if (value === null) {
    throw new Error("ThemeProvider is missing");
  }

  return value;
}
