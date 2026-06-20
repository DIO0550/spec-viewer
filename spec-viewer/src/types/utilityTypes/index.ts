export type ArrayValueOf<T extends readonly unknown[]> = T[number];

export type ValueOf<T extends Readonly<Record<PropertyKey, unknown>>> =
  T[keyof T];
