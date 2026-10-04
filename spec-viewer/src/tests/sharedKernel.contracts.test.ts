import { expectTypeOf, test } from "vitest";
import type { IsoDateTimeString as CommentTimestamp } from "@/features/comments";
import type {
  IsoDateTimeString as DiffCommentTimestamp,
  StoredDiffComment,
} from "@/features/diffComments";
import type { SpecFileKey as PublicSpecFileKey } from "@/features/specs";
import type { SpecFileKey as DomainSpecFileKey } from "@/features/specs/domain";
import type { IsoDateTimeString } from "@/shared/kernel/isoDateTimeString";
import type { SpecFileKey } from "@/shared/kernel/specFileKey";

test("logical document keys keep all nine literals across public APIs", () => {
  expectTypeOf<SpecFileKey>().toEqualTypeOf<
    | "exploration"
    | "hearing"
    | "impl"
    | "tasks"
    | "tech-reference"
    | "test-cases"
    | "requirements"
    | "quiz-plan"
    | "quiz-impl"
  >();
  expectTypeOf<PublicSpecFileKey>().toEqualTypeOf<SpecFileKey>();
  expectTypeOf<DomainSpecFileKey>().toEqualTypeOf<SpecFileKey>();
});

test("comment timestamps share a string-compatible alias without changing validation", () => {
  expectTypeOf<IsoDateTimeString>().toEqualTypeOf<string>();
  expectTypeOf<CommentTimestamp>().toEqualTypeOf<IsoDateTimeString>();
  expectTypeOf<DiffCommentTimestamp>().toEqualTypeOf<IsoDateTimeString>();
  expectTypeOf<
    StoredDiffComment["createdAt"]
  >().toEqualTypeOf<IsoDateTimeString>();
});
