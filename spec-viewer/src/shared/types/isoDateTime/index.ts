/**
 * ISO-8601 date-time string exchanged across the backend command boundary.
 *
 * This is a cross-cutting primitive shared by multiple features (comments,
 * review runs, …). It belongs to the shared kernel rather than to any single
 * feature so features never depend on one another merely to name a timestamp.
 */
export type IsoDateTimeString = string;
