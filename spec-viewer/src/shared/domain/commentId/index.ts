declare const commentIdBrand: unique symbol;

export type CommentId = string & { readonly [commentIdBrand]: "CommentId" };
export type CommentIdParseErrorReason = "empty" | "invalidFormat";
export type CommentIdParseError = Readonly<{
  reason: CommentIdParseErrorReason;
  value: string;
  message: string;
}>;
export type CommentIdParseResult =
  | Readonly<{ ok: true; value: CommentId }>
  | Readonly<{ ok: false; error: CommentIdParseError }>;

const issuedPattern = /^cmt_[0-9a-f]{32}$/;

export const CommentId = {
  /**
   * @param value - Raw comment identity to validate for new issuance.
   * @returns A newly-issued-format comment identity or a validation error.
   */
  parse(value: string): CommentIdParseResult {
    if (value.trim().length === 0) {
      return failure("empty", value, "Comment ID must not be empty");
    }
    if (!issuedPattern.test(value)) {
      return failure(
        "invalidFormat",
        value,
        "Comment ID must match cmt_<32 lowercase hex>",
      );
    }
    return { ok: true, value: value as CommentId };
  },

  /**
   * @param value - Raw comment identity received from a wire DTO.
   * @returns A current or legacy comment identity restored from a wire DTO.
   */
  fromDto(value: string): CommentIdParseResult {
    const normalized = value.trim();
    if (normalized.length === 0) {
      return failure("empty", value, "Comment ID must not be empty");
    }
    return { ok: true, value: normalized as CommentId };
  },

  /**
   * @param value - Validated comment identity.
   * @returns The raw identity for display and DOM boundaries.
   */
  toString(value: CommentId): string {
    return value;
  },

  /**
   * @param value - Validated comment identity.
   * @returns The raw identity for transport boundaries.
   */
  toDto(value: CommentId): string {
    return value;
  },
} as const;

/**
 * @param reason - Stable validation failure reason.
 * @param value - Raw identity that failed validation.
 * @param message - Developer-facing failure description.
 * @returns A structured CommentId parse failure.
 */
function failure(
  reason: CommentIdParseErrorReason,
  value: string,
  message: string,
): CommentIdParseResult {
  return { ok: false, error: { reason, value, message } };
}
