declare const specIdBrand: unique symbol;

export type SpecId = string & { readonly [specIdBrand]: "SpecId" };
export type SpecIdParseErrorReason = "empty" | "unsafePath";
export type SpecIdParseError = Readonly<{
  reason: SpecIdParseErrorReason;
  value: string;
  message: string;
}>;
export type SpecIdParseResult =
  | Readonly<{ ok: true; value: SpecId }>
  | Readonly<{ ok: false; error: SpecIdParseError }>;

export const SpecId = {
  /**
   * @param value - Raw spec identity to validate.
   * @returns A path-safe spec identity or a structured validation error.
   */
  parse(value: string): SpecIdParseResult {
    const normalized = value.trim();
    if (normalized.length === 0) {
      return failure("empty", value, "Spec ID must not be empty");
    }
    if (!isSafeRelativeSpecId(normalized)) {
      return failure(
        "unsafePath",
        value,
        "Spec ID must be a safe relative path",
      );
    }
    return { ok: true, value: normalized as SpecId };
  },

  /**
   * @param value - Raw spec identity received from a wire DTO.
   * @returns A spec identity restored from its wire DTO.
   */
  fromDto(value: string): SpecIdParseResult {
    return SpecId.parse(value);
  },

  /**
   * @param candidate - Candidate ancestor identity.
   * @param descendant - Candidate descendant identity.
   * @returns True when candidate is a strict segment ancestor of descendant.
   */
  isStrictAncestorOf(candidate: SpecId, descendant: SpecId): boolean {
    const candidateSegments = candidate.split("/");
    const descendantSegments = descendant.split("/");
    if (candidateSegments.length >= descendantSegments.length) {
      return false;
    }

    return candidateSegments.every(
      (segment, index) => segment === descendantSegments[index],
    );
  },

  /**
   * @param value - Validated spec identity.
   * @returns The raw identity for display and DOM boundaries.
   */
  toString(value: SpecId): string {
    return value;
  },

  /**
   * @param value - Validated spec identity.
   * @returns The raw identity for transport boundaries.
   */
  toDto(value: SpecId): string {
    return value;
  },
} as const;

/**
 * @param value - Normalized spec identity to inspect.
 * @returns True when every path component is normal and relative.
 */
function isSafeRelativeSpecId(value: string): boolean {
  if (
    value.startsWith("/") ||
    value.includes("\\") ||
    value.includes(":") ||
    value.includes("\0")
  ) {
    return false;
  }
  const components = value.split("/");
  return components.every(
    (component) =>
      component.length > 0 && component !== "." && component !== "..",
  );
}

/**
 * @param reason - Stable validation failure reason.
 * @param value - Raw identity that failed validation.
 * @param message - Developer-facing failure description.
 * @returns A structured SpecId parse failure.
 */
function failure(
  reason: SpecIdParseErrorReason,
  value: string,
  message: string,
): SpecIdParseResult {
  return { ok: false, error: { reason, value, message } };
}
