/**
 * Unit tests for lib/utils/date-range.ts — whole-local-day range semantics.
 *
 * The suite pins process.env.TZ per block (Node re-reads it at runtime), so the
 * same assertions run for an Australian and a US viewer, including across the
 * Sydney DST start on 2026-10-04 (a 23-hour day).
 *
 * WHAT THIS FILE CANNOT COVER (needs a human or E2E against live Supabase):
 * - That PostgREST compares the `gte`/`lt` instants against the timestamptz
 *   column as UTC — i.e. that a real 23:30-local upload shows up in the diary.
 * - That the calendar popover hands back local-midnight dates in every browser.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { differenceInCalendarDays } from 'date-fns';
import { lastNDays, lastNMonths, toUploadDateBounds } from '@/lib/utils/date-range';

const originalTZ = process.env.TZ;

/** True if an upload instant falls inside the half-open [gte, lt) query bounds. */
function inBounds(uploadISO: string, b: { gte: string; lt: string }) {
  const t = Date.parse(uploadISO);
  return t >= Date.parse(b.gte) && t < Date.parse(b.lt);
}

describe.each([
  { tz: 'Australia/Sydney' },
  { tz: 'America/New_York' },
])('date ranges in $tz', ({ tz }) => {
  beforeAll(() => {
    process.env.TZ = tz;
  });
  afterAll(() => {
    process.env.TZ = originalTZ;
  });

  it('includes an upload at 23:30 local on the last selected day', () => {
    const from = new Date(2026, 8, 1); // 1 Sep, local midnight (as the calendar gives it)
    const to = new Date(2026, 8, 30); // 30 Sep, local midnight
    const lateOnLastDay = new Date(2026, 8, 30, 23, 30).toISOString();

    expect(inBounds(lateOnLastDay, toUploadDateBounds(from, to))).toBe(true);
  });

  it('includes an upload at 00:00 local on the first day and excludes the next day', () => {
    const from = new Date(2026, 8, 1);
    const to = new Date(2026, 8, 30);
    const b = toUploadDateBounds(from, to);

    const firstInstant = new Date(2026, 8, 1, 0, 0);
    const justBefore = new Date(firstInstant.getTime() - 1);

    expect(inBounds(firstInstant.toISOString(), b)).toBe(true);
    expect(inBounds(justBefore.toISOString(), b)).toBe(false);
    expect(inBounds(new Date(2026, 9, 1, 0, 0).toISOString(), b)).toBe(false);
  });

  it('treats a from-only range as that single day', () => {
    const day = new Date(2026, 8, 15);
    const b = toUploadDateBounds(day);

    expect(inBounds(new Date(2026, 8, 15, 12).toISOString(), b)).toBe(true);
    expect(inBounds(new Date(2026, 8, 16, 0, 1).toISOString(), b)).toBe(false);
  });

  it('ignores the time-of-day on the picked dates (presets pass "now")', () => {
    const b1 = toUploadDateBounds(new Date(2026, 8, 1, 17, 45), new Date(2026, 8, 30, 9, 15));
    const b2 = toUploadDateBounds(new Date(2026, 8, 1), new Date(2026, 8, 30));
    expect(b1).toEqual(b2);
  });

  it('lastNDays(7) spans 7 calendar days ending today, even across a DST change', () => {
    const today = new Date(2026, 9, 4, 15, 0); // Sydney DST starts 2026-10-04
    const { from, to } = lastNDays(7, today);

    expect(differenceInCalendarDays(to, from)).toBe(7);
    expect(to.toDateString()).toBe(today.toDateString());
    expect([from.getHours(), from.getMinutes(), to.getHours(), to.getMinutes()]).toEqual([0, 0, 0, 0]);
  });

  it('lastNMonths produces whole-day bounds', () => {
    const { from, to } = lastNMonths(3, new Date(2026, 9, 4, 15, 0));
    expect(from.toDateString()).toBe(new Date(2026, 6, 4).toDateString());
    expect(from.getHours()).toBe(0);
    expect(to.getHours()).toBe(0);
  });

  it('a preset and the same hand-picked days query identical bounds', () => {
    const today = new Date(2026, 9, 4, 15, 0);
    const preset = lastNDays(7, today);
    const handPicked = { from: new Date(2026, 8, 27), to: new Date(2026, 9, 4) };

    expect(toUploadDateBounds(preset.from, preset.to)).toEqual(
      toUploadDateBounds(handPicked.from, handPicked.to)
    );
  });
});
