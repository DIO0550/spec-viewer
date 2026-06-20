import type { ArrayValueOf } from "@/types/utilityTypes";

const themeAppearances = ["light", "dark"] as const;
export type ThemeAppearance = ArrayValueOf<typeof themeAppearances>;

export const ThemeAppearance = {
  defaultValue: "light" as ThemeAppearance,
  /** @returns True when the value is an applicable theme appearance. */
  is(value: unknown): value is ThemeAppearance {
    return themeAppearances.some(
      (themeAppearance) => themeAppearance === value,
    );
  },
};

const themeModes = ["system", ...themeAppearances] as const;
export type ThemeMode = ArrayValueOf<typeof themeModes>;

export const ThemeMode = {
  defaultValue: "system" as ThemeMode,
  /** @returns True when the value is a supported theme preference mode. */
  is(value: unknown): value is ThemeMode {
    return themeModes.some((themeMode) => themeMode === value);
  },
  /** @returns A valid theme mode, falling back to system for invalid input. */
  parse(value: unknown): ThemeMode {
    if (ThemeMode.is(value)) {
      return value;
    }

    return ThemeMode.defaultValue;
  },
  /** @returns The concrete theme appearance for a selected preference mode. */
  toAppearance(
    mode: ThemeMode,
    systemAppearance: ThemeAppearance,
  ): ThemeAppearance {
    if (mode === "system") {
      return systemAppearance;
    }

    return mode;
  },
};
