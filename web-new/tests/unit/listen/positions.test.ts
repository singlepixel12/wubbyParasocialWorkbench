import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  readPosition, writePosition, resumeTime, isFinished, readRate, writeRate, formatClock, positionKey,
} from '@/lib/listen/positions';
import { useSavedPosition } from '@/lib/listen/useSavedPosition';

beforeEach(() => localStorage.clear());

describe('positions', () => {
  it('round-trips a position', () => {
    writePosition('h', 8054.6, 21270, localStorage, 1000);
    expect(readPosition('h')).toEqual({ t: 8055, d: 21270, at: 1000 });
  });

  it('ignores the first 5 seconds (an accidental tap is not a listen)', () => {
    writePosition('h', 4, 100);
    expect(readPosition('h')).toBeNull();
  });

  it('survives garbage in storage', () => {
    localStorage.setItem(positionKey('h'), '{nope');
    expect(readPosition('h')).toBeNull();
  });

  it('resumes 3 s early, and from 0 once within the last 2 minutes', () => {
    expect(resumeTime(null)).toBe(0);
    expect(resumeTime({ t: 100, d: 1000, at: 0 })).toBe(97);
    expect(isFinished({ t: 900, d: 1000, at: 0 })).toBe(true);
    expect(resumeTime({ t: 900, d: 1000, at: 0 })).toBe(0);
  });

  it('remembers the speed, defaulting to 1×', () => {
    expect(readRate()).toBe(1);
    writeRate(1.5);
    expect(readRate()).toBe(1.5);
    writeRate(1);
    expect(readRate()).toBe(1);
  });

  it('formats clocks', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(8045)).toBe('2:14:05');
  });
});

describe('useSavedPosition', () => {
  it('updates when a position is written in the same tab', () => {
    const { result } = renderHook(() => useSavedPosition('h'));
    expect(result.current).toBeNull();
    act(() => writePosition('h', 120, 1000));
    expect(result.current?.t).toBe(120);
  });

  it('returns null with no hash', () => {
    const { result } = renderHook(() => useSavedPosition(undefined));
    expect(result.current).toBeNull();
  });
});
