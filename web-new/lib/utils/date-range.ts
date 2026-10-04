/**
 * Date-range semantics for the VOD Diary.
 *
 * A diary range is a span of whole *local calendar days*: "1 Sep – 30 Sep" means
 * every upload from the first instant of 1 Sep up to (not including) the first
 * instant of 1 Oct, in the viewer's own timezone. `upload_date` is a timestamp,
 * so the query must be `gte <start of from-day>` and `lt <start of the day after
 * to-day>` — comparing `lte` against the to-day's midnight silently drops the
 * whole last day.
 *
 * date-fns does the day arithmetic so DST transitions (a 23- or 25-hour day)
 * never shift a boundary.
 */

import { addDays, startOfDay, subDays, subMonths } from 'date-fns';

export interface DayRange {
  from: Date;
  to: Date;
}

/** The last `n` days up to and including today, as whole local days. */
export function lastNDays(n: number, today: Date = new Date()): DayRange {
  const to = startOfDay(today);
  return { from: subDays(to, n), to };
}

/** The last `n` calendar months up to and including today, as whole local days. */
export function lastNMonths(n: number, today: Date = new Date()): DayRange {
  const to = startOfDay(today);
  return { from: subMonths(to, n), to };
}

/**
 * Converts a picked range into the UTC instants to query `upload_date` with.
 * A range with only a `from` day (mid-selection) covers that single day.
 *
 * @returns `gte` (inclusive) and `lt` (exclusive) as ISO-8601 UTC strings
 */
export function toUploadDateBounds(from: Date, to?: Date | null): { gte: string; lt: string } {
  return {
    gte: startOfDay(from).toISOString(),
    lt: startOfDay(addDays(to ?? from, 1)).toISOString(),
  };
}
