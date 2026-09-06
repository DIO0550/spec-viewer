import type { Brand } from "@/types/utilityTypes";

export type SidebarWidth = Brand<number, "SidebarWidth">;

export type SidebarWidthConstraints = Readonly<{
  min: number;
  max: number;
}>;

const DefaultSidebarWidth = 300;
const MinSidebarWidth = 280;
const MaxSidebarWidth = 560;
const ViewportWidthRatio = 0.45;

export const SidebarWidth = {
  defaultValue: DefaultSidebarWidth as SidebarWidth,
  /**
   * @param viewportWidth - Current viewport width in pixels.
   * @returns Sidebar limits for the viewport, with the minimum width preserved.
   */
  constraints(viewportWidth: number): SidebarWidthConstraints {
    return {
      min: MinSidebarWidth,
      max: Math.max(
        MinSidebarWidth,
        Math.min(
          MaxSidebarWidth,
          Math.floor(viewportWidth * ViewportWidthRatio),
        ),
      ),
    };
  },
  /**
   * @param width - Candidate width in pixels.
   * @param constraints - Current viewport limits.
   * @returns Rounded and clamped width, or the legacy default for non-finite input.
   */
  fromNumber(
    width: number,
    constraints: SidebarWidthConstraints,
  ): SidebarWidth {
    if (!Number.isFinite(width)) {
      // Preserve the existing fallback even when the viewport limit is below 300.
      return DefaultSidebarWidth as SidebarWidth;
    }

    return Math.min(
      constraints.max,
      Math.max(constraints.min, Math.round(width)),
    ) as SidebarWidth;
  },
  /**
   * @param width - Domain width.
   * @returns Raw pixels for UI and persistence boundaries.
   */
  toNumber(width: SidebarWidth): number {
    return width;
  },
} as const;
