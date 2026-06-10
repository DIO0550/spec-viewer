/**
 * Identifier for a document slot within a spec folder.
 *
 * Spec files, comment anchors, and review-run source files must all agree on
 * this closed vocabulary. It is therefore a shared-kernel concept owned by the
 * shared layer rather than by a single feature, so that features do not reach
 * into one another to reference a spec document key.
 */
export type SpecFileKey =
  | "exploration"
  | "hearing"
  | "impl"
  | "tasks"
  | "tech-reference"
  | "requirements"
  | "design";
