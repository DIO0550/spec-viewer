import { useContext } from "react";

import { SpecViewSelectionContext } from "@/app/context/specViewSelection/context";
import type { SpecViewSelectionContextValue } from "@/app/context/specViewSelection/types";

/**
 * @returns Current spec view selection context value.
 * @throws Error when used outside SpecViewSelectionProvider.
 */
export function useSpecViewSelection(): SpecViewSelectionContextValue {
  const value = useContext(SpecViewSelectionContext);

  if (value === null) {
    throw new Error("SpecViewSelectionProvider is missing");
  }

  return value;
}
