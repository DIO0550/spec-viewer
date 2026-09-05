export type CargoLeafResolution =
  | Readonly<{ kind: "resolved"; testName: string }>
  | Readonly<{ kind: "invalid"; reason: "notFound" | "ambiguous" }>;

export declare const resolveCargoLeafName: (
  listedTests: string,
  suffix: string,
) => CargoLeafResolution;
