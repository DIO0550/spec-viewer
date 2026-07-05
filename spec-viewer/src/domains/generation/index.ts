const initialGenerationValue = 0;

export type GenerationToken = number & {
  readonly __brand: "GenerationToken";
};

export type Generation = Readonly<{
  /** Advances to and returns the next generation token. */
  next: () => GenerationToken;
  /** Invalidates the current generation so existing tokens become stale. */
  invalidate: () => void;
  /**
   * Checks whether a token matches the current generation.
   * @param token - The generation token to compare.
   */
  isCurrent: (token: GenerationToken) => boolean;
}>;

/** @returns A generation tracker for ignoring stale async results. */
export function createGeneration(): Generation {
  let current = initialGenerationValue;

  return {
    next: (): GenerationToken => {
      current += 1;
      return current as GenerationToken;
    },
    invalidate: (): void => {
      current += 1;
    },
    isCurrent: (token: GenerationToken): boolean => token === current,
  };
}
