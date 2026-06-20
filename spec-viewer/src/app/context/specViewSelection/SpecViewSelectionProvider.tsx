import type { ReactElement } from "react";

import { SpecViewSelectionContext } from "@/app/context/specViewSelection/context";
import type { SpecViewSelectionProviderProps } from "@/app/context/specViewSelection/types";
import { useSpecViewSelectionState } from "@/app/context/specViewSelection/useSpecViewSelectionState";

/**
 * @param props - Provider props for the managed spec view section.
 * @returns Context provider that owns the active spec view selection.
 */
export function SpecViewSelectionProvider(
  props: SpecViewSelectionProviderProps,
): ReactElement {
  const { children } = props;
  const value = useSpecViewSelectionState();

  return (
    <SpecViewSelectionContext.Provider value={value}>
      {children}
    </SpecViewSelectionContext.Provider>
  );
}
