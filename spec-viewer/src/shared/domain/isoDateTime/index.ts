declare const isoDateTimeBrand: unique symbol;

export type IsoDateTime = string & {
  readonly [isoDateTimeBrand]: "IsoDateTime";
};
/** Raw date-time representation reserved for serialized output contracts. */
export type IsoDateTimeString = string;
export type IsoDateTimeParseError = Readonly<{
  reason: "invalidIsoDateTime";
  value: string;
  message: string;
}>;
export type IsoDateTimeParseResult =
  | Readonly<{ ok: true; value: IsoDateTime }>
  | Readonly<{ ok: false; error: IsoDateTimeParseError }>;

const rfc3339Pattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(?:Z|([+-])(\d{2}):(\d{2}))$/;

export const IsoDateTime = {
  /**
   * @param value - Raw date-time to validate.
   * @returns A validated RFC3339 date-time or a structured error.
   */
  parse(value: string): IsoDateTimeParseResult {
    const match = rfc3339Pattern.exec(value);
    if (match === null || !hasValidCalendarParts(match)) {
      return failure(value);
    }
    if (Number.isNaN(Date.parse(value))) {
      return failure(value);
    }
    return { ok: true, value: value as IsoDateTime };
  },

  /**
   * @param value - Raw date-time received from a wire DTO.
   * @returns A date-time restored from its wire DTO.
   */
  fromDto(value: string): IsoDateTimeParseResult {
    return IsoDateTime.parse(value);
  },

  /**
   * @param value - Validated date-time.
   * @returns The raw RFC3339 value for display boundaries.
   */
  toString(value: IsoDateTime): string {
    return value;
  },

  /**
   * @param value - Validated date-time.
   * @returns The raw RFC3339 value for transport boundaries.
   */
  toDto(value: IsoDateTime): string {
    return value;
  },

  /**
   * @param left - First validated date-time.
   * @param right - Second validated date-time.
   * @returns A negative value, zero, or a positive value according to instant order.
   */
  compare(left: IsoDateTime, right: IsoDateTime): -1 | 0 | 1 {
    const leftInstant = toComparableInstant(left);
    const rightInstant = toComparableInstant(right);

    if (leftInstant.epochSecond < rightInstant.epochSecond) {
      return -1;
    }
    if (leftInstant.epochSecond > rightInstant.epochSecond) {
      return 1;
    }

    return compareFractionalSeconds(
      leftInstant.fractionalSecond,
      rightInstant.fractionalSecond,
    );
  },
} as const;

type ComparableInstant = Readonly<{
  epochSecond: number;
  fractionalSecond: string;
}>;

/**
 * @param value - Validated RFC3339 date-time.
 * @returns Whole epoch seconds and the original arbitrary-precision fraction.
 */
function toComparableInstant(value: IsoDateTime): ComparableInstant {
  const match = rfc3339Pattern.exec(value);
  const wholeSecondValue = value.replace(/\.\d+/, "");

  return {
    epochSecond: Date.parse(wholeSecondValue) / 1_000,
    fractionalSecond: match?.[7] ?? "",
  };
}

/**
 * @param left - First decimal fraction without a leading dot.
 * @param right - Second decimal fraction without a leading dot.
 * @returns A negative value, zero, or a positive value according to fraction order.
 */
function compareFractionalSeconds(left: string, right: string): -1 | 0 | 1 {
  const comparisonLength = Math.max(left.length, right.length);
  const normalizedLeft = left.padEnd(comparisonLength, "0");
  const normalizedRight = right.padEnd(comparisonLength, "0");

  if (normalizedLeft < normalizedRight) {
    return -1;
  }
  if (normalizedLeft > normalizedRight) {
    return 1;
  }

  return 0;
}

/**
 * @param match - RFC3339 regular-expression capture groups.
 * @returns True when captured RFC3339 calendar and offset parts are valid.
 */
function hasValidCalendarParts(match: RegExpExecArray): boolean {
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[9] === undefined ? 0 : Number(match[9]);
  const offsetMinute = match[10] === undefined ? 0 : Number(match[10]);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59 &&
    offsetHour <= 23 &&
    offsetMinute <= 59
  );
}

/**
 * @param value - Raw date-time that failed validation.
 * @returns A structured IsoDateTime parse failure.
 */
function failure(value: string): IsoDateTimeParseResult {
  return {
    ok: false,
    error: {
      reason: "invalidIsoDateTime",
      value,
      message: "Date-time must be a valid RFC3339 value",
    },
  };
}
