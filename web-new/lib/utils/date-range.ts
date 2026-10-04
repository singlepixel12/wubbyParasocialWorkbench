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

import { addDays, format, isValid, parse, startOfDay, subDays, subMonths } from 'date-fns';

/** Day format used in the diary URL (`?from=2026-09-01&to=2026-09-30`). */
const DAY_PARAM_FORMAT = 'yyyy-MM-dd';

/** Serialises a local calendar day for the URL (no time, no timezone). */
export function formatDayParam(date: Date): string {
  return format(date, DAY_PARAM_FORMAT);
}

/**
 * Parses a `yyyy-MM-dd` URL param back to that local day's midnight.
 * Returns null for a missing or malformed value (e.g. a hand-edited URL), so
 * callers fall back to their default instead of querying an Invalid Date.
 */
export function parseDayParam(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = parse(value, DAY_PARAM_FORMAT, new Date());
  return isValid(date) ? date : null;
}

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
