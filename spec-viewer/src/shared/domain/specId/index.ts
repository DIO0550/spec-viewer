declare const specIdBrand: unique symbol;

export type SpecId = string & {
  readonly [specIdBrand]: true;
};

export const SpecId = {
  /**
   * @param value - Raw spec identifier at an input boundary.
   * @returns Branded spec identifier for domain use.
   */
  fromString(value: string): SpecId {
    return value as SpecId;
  },

  /**
   * @param value - Branded spec identifier.
   * @returns Raw spec identifier for transport boundaries.
   */
  toString(value: SpecId): string {
    return value;
  },
} as const;
