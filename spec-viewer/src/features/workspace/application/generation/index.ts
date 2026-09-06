const InitialGenerationValue = 0;

export type GenerationToken = number & {
  readonly __brand: "GenerationToken";
};

export type Generation = Readonly<{
  /** Advances to and returns the next generation token. */
  next: () => GenerationToken;
  /** Invalidates the current generation so existing tokens become stale. */
  invalidate: () => void;
  /**
   * @param token - The generation token to compare.
   * @returns True when the token matches the current generation.
   */
  isCurrent: (token: GenerationToken) => boolean;
}>;

/** @returns An application-level tracker for ordering async completions. */
export function createGeneration(): Generation {
  let current = InitialGenerationValue;

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
