import { expectTypeOf, test } from "vitest";

import type { ArrayValueOf, ValueOf } from "@/types/utilityTypes";

test("ArrayValueOfはreadonly配列から要素のunionを導出する", () => {
  const values = ["system", "light", "dark"] as const;

  expectTypeOf<ArrayValueOf<typeof values>>().toEqualTypeOf<
    "system" | "light" | "dark"
  >();
});

test("ValueOfはreadonly objectから値のunionを導出する", () => {
  const labels = {
    system: "System",
    light: "Light",
    dark: "Dark",
  } as const;

  expectTypeOf<ValueOf<typeof labels>>().toEqualTypeOf<
    "System" | "Light" | "Dark"
  >();
});
