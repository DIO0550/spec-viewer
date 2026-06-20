import { createContext } from "react";

import type { SpecViewIdentityContextValue } from "@/app/context/specViewIdentity/types";

export const SpecViewIdentityContext =
  createContext<SpecViewIdentityContextValue | null>(null);
