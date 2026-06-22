import type { ReactElement } from "react";

import { SidebarPreferenceContext } from "./context";
import type { SidebarPreferenceProviderProps } from "./types";
import { useSidebarPreferenceState } from "./useSidebarPreferenceState";

/**
 * @param props - Provider props for the managed sidebar preference.
 * @returns Context provider that owns right comment sidebar visibility state.
 */
export function SidebarPreferenceProvider(
  props: SidebarPreferenceProviderProps,
): ReactElement {
  const { children } = props;
  const value = useSidebarPreferenceState();

  return <SidebarPreferenceContext value={value}>{children}</SidebarPreferenceContext>;
}
