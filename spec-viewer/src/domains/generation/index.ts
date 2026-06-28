const initialGenerationValue = 0;

export type GenerationToken = number & {
  readonly __brand: "GenerationToken";
};

export type Generation = Readonly<{
  next: () => GenerationToken;
  invalidate: () => void;
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
