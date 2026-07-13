declare const userReviewIdBrand: unique symbol;

export type UserReviewId = string & {
  readonly [userReviewIdBrand]: "UserReviewId";
};
export type UserReviewIdParseErrorReason = "empty" | "invalidFormat";
export type UserReviewIdParseError = Readonly<{
  reason: UserReviewIdParseErrorReason;
  value: string;
  message: string;
}>;
export type UserReviewIdParseResult =
  | Readonly<{ ok: true; value: UserReviewId }>
  | Readonly<{ ok: false; error: UserReviewIdParseError }>;

const issuedPattern = /^urv_[0-9a-f]{32}$/;
const legacyPattern =
  /^\d{4}-\d{2}-\d{2}T\d{6}Z-(?:spec|file-(?:exploration|hearing|impl|tasks|tech-reference|test-cases|requirements|design))(?:-[0-9a-f]{8})?$/;

export const UserReviewId = {
  /**
   * @param value - Raw user-review identity to validate for new issuance.
   * @returns A v1 user-review identity or a validation error.
   */
  parse(value: string): UserReviewIdParseResult {
    return parseWithPattern(
      value,
      issuedPattern,
      "User review ID must match urv_<32 lowercase hex>",
    );
  },

  /**
   * @param value - Raw user-review identity received from a wire DTO.
   * @returns A v1 or legacy user-review identity restored from a wire DTO.
   */
  fromDto(value: string): UserReviewIdParseResult {
    const normalized = value.trim();
    if (normalized.length === 0) {
      return failure("empty", value, "User review ID must not be empty");
    }
    if (!issuedPattern.test(normalized) && !legacyPattern.test(normalized)) {
      return failure(
        "invalidFormat",
        value,
        "User review ID must use v1 or recognized legacy format",
      );
    }
    return { ok: true, value: normalized as UserReviewId };
  },

  /**
   * @param value - Validated user-review identity.
   * @returns The raw identity for display and DOM boundaries.
   */
  toString(value: UserReviewId): string {
    return value;
  },

  /**
   * @param value - Validated user-review identity.
   * @returns The raw identity for transport boundaries.
   */
  toDto(value: UserReviewId): string {
    return value;
  },
} as const;

/**
 * @param value - Raw user-review identity to validate.
 * @param pattern - Required identity format.
 * @param message - Developer-facing invalid-format description.
 * @returns A UserReviewId parsed with the required format.
 */
function parseWithPattern(
  value: string,
  pattern: RegExp,
  message: string,
): UserReviewIdParseResult {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return failure("empty", value, "User review ID must not be empty");
  }
  if (!pattern.test(normalized)) {
    return failure("invalidFormat", value, message);
  }
  return { ok: true, value: normalized as UserReviewId };
}

/**
 * @param reason - Stable validation failure reason.
 * @param value - Raw identity that failed validation.
 * @param message - Developer-facing failure description.
 * @returns A structured UserReviewId parse failure.
 */
function failure(
  reason: UserReviewIdParseErrorReason,
  value: string,
  message: string,
): UserReviewIdParseResult {
  return { ok: false, error: { reason, value, message } };
}
