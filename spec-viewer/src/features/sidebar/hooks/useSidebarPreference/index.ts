import { useContext } from "react";

import { SidebarPreferenceContext } from "./context";
import type { SidebarPreferenceContextValue } from "./types";

export { SidebarPreferenceProvider } from "./SidebarPreferenceProvider";
export type { SidebarPreferenceContextValue } from "./types";

/**
 * @returns Current sidebar preference context value.
 * @throws Error when used outside SidebarPreferenceProvider.
 */
export function useSidebarPreference(): SidebarPreferenceContextValue {
  const value = useContext(SidebarPreferenceContext);

  if (value === null) {
    throw new Error("SidebarPreferenceProvider is missing");
  }

  return value;
}
