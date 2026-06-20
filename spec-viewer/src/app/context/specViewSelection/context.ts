import { createContext } from "react";

import type { SpecViewSelectionContextValue } from "@/app/context/specViewSelection/types";

export const SpecViewSelectionContext =
  createContext<SpecViewSelectionContextValue | null>(null);
