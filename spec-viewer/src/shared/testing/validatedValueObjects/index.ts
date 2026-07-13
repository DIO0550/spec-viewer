import {
  CommentId,
  type CommentId as CommentIdType,
} from "@/shared/domain/commentId";
import {
  IsoDateTime,
  type IsoDateTime as IsoDateTimeType,
} from "@/shared/domain/isoDateTime";
import { SpecId, type SpecId as SpecIdType } from "@/shared/domain/specId";

type ParseResult<Value> =
  | Readonly<{ ok: true; value: Value }>
  | Readonly<{ ok: false; error: Readonly<{ message: string }> }>;

/**
 * @param result - Production parser result for the fixture.
 * @returns A validated test fixture value or throws for an invalid fixture.
 * @throws Error when the fixture violates production restoration rules.
 */
function unwrapFixture<Value>(result: ParseResult<Value>): Value {
  if (!result.ok) {
    throw new Error(result.error.message);
  }

  return result.value;
}

/**
 * @param value - Raw SpecId fixture.
 * @returns A validated SpecId fixture restored with production rules.
 * @throws Error when the fixture violates production restoration rules.
 */
export const specId = (value: string): SpecIdType =>
  unwrapFixture(SpecId.fromDto(value));

/**
 * @param value - Raw CommentId fixture.
 * @returns A validated CommentId fixture restored with production rules.
 * @throws Error when the fixture violates production restoration rules.
 */
export const commentId = (value: string): CommentIdType =>
  unwrapFixture(CommentId.fromDto(value));

/**
 * @param value - Raw IsoDateTime fixture.
 * @returns A validated IsoDateTime fixture restored with production rules.
 * @throws Error when the fixture violates production restoration rules.
 */
export const isoDateTime = (value: string): IsoDateTimeType =>
  unwrapFixture(IsoDateTime.fromDto(value));
