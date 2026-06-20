import { useContext } from "react";

import { SpecViewIdentityContext } from "@/app/context/specViewIdentity/context";
import type { SpecViewIdentityContextValue } from "@/app/context/specViewIdentity/types";

/**
 * @returns Current spec view identity context value.
 * @throws Error when used outside SpecViewIdentityProvider.
 */
export function useSpecViewIdentity(): SpecViewIdentityContextValue {
  const value = useContext(SpecViewIdentityContext);

  if (value === null) {
    throw new Error("SpecViewIdentityProvider is missing");
  }

  return value;
}
