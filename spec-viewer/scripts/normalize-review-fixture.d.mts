export function normalizeReviewFixture<T>(value: T): T;
export function createGoldenMetadata(
  raw: string,
  command: string,
): Readonly<{ command: string; normalizerVersion: number; rawHash: string }>;
