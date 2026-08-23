const viewerFontSizes = ["small", "medium", "large"] as const;

export type ViewerFontSize = (typeof viewerFontSizes)[number];

export const ViewerFontSize = {
  defaultValue: "medium" as ViewerFontSize,

  /**
   * @param value - Unknown persisted preference.
   * @returns Whether value is a supported viewer font size.
   */
  is(value: unknown): value is ViewerFontSize {
    return viewerFontSizes.some((candidate) => candidate === value);
  },

  /**
   * @param value - Unknown persisted preference.
   * @returns A supported viewer font size.
   */
  parse(value: unknown): ViewerFontSize {
    return ViewerFontSize.is(value) ? value : ViewerFontSize.defaultValue;
  },
} as const;
