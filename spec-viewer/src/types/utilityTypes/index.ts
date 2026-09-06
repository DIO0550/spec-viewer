export type ArrayValueOf<T extends readonly unknown[]> = T[number];

export type ValueOf<T extends Readonly<Record<PropertyKey, unknown>>> =
  T[keyof T];

declare const brand: unique symbol;

/** Distinguishes values by their domain meaning without adding runtime properties. */
export type Brand<T, Name extends string> = T & {
  readonly [brand]: Name;
};
