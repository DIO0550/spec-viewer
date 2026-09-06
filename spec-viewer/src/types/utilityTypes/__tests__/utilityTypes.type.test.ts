import { expectTypeOf, test } from "vitest";

import type { ArrayValueOf, Brand, ValueOf } from "@/types/utilityTypes";

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

test("Brandは同じ基底型と名前の型だけを互換にする", () => {
  type SidebarWidth = Brand<number, "SidebarWidth">;

  expectTypeOf<SidebarWidth>().toEqualTypeOf<Brand<number, "SidebarWidth">>();
  expectTypeOf<number>().not.toExtend<SidebarWidth>();
  expectTypeOf<Brand<number, "ViewportWidth">>().not.toExtend<SidebarWidth>();
  expectTypeOf<Brand<string, "SidebarWidth">>().not.toExtend<SidebarWidth>();
  expectTypeOf<SidebarWidth>().toExtend<number>();
});
