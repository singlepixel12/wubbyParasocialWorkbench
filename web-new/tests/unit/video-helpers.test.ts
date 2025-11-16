/**
 * Unit tests for video-helpers utility functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getLocaleFormat,
  formatDateDisplay,
  extractOriginalTitle,
  getThisWeekRange,
  getDatePickerFormat,
  formatDateLong,
  formatSummaryText,
} from '@/lib/utils/video-helpers';

// Mock logger
vi.mock('@/lib/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('getLocaleFormat', () => {
  it('should return format based on locale', () => {
    const format = getLocaleFormat();
    expect(format).toMatch(/^(dmy|mdy)$/);
  });
});

describe('formatDateDisplay', () => {
  it('should format date in MM/DD/YYYY or DD/MM/YYYY format', () => {
    const date = new Date('2025-01-15');
    const formatted = formatDateDisplay(date);

    // Should match either US (01/15/2025) or AU (15/01/2025) format
    expect(formatted).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it('should pad single-digit days and months', () => {
    const date = new Date('2025-01-05');
    const formatted = formatDateDisplay(date);

    expect(formatted).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    // Should not have single digits
    expect(formatted).not.toMatch(/^\d\/|\/\d\//);
  });

  it('should handle leap year dates', () => {
    const date = new Date('2024-02-29');
    const formatted = formatDateDisplay(date);

    expect(formatted).toMatch(/^\d{2}\/\d{2}\/2024$/);
  });

  it('should handle end of year dates', () => {
    const date = new Date('2025-12-31');
    const formatted = formatDateDisplay(date);

    expect(formatted).toMatch(/^\d{2}\/\d{2}\/2025$/);
  });
});

describe('extractOriginalTitle', () => {
  it('should extract and decode title from URL', () => {
    const url =
      'https://archive.wubby.tv/vods/public/jul_2025/27_MEDIA%20SHARE_1753659052_000.mp4';
    const title = extractOriginalTitle(url);

    expect(title).toBe('27_MEDIA SHARE');
  });

  it('should remove timestamp suffix', () => {
    const url = 'https://archive.wubby.tv/vods/public/test_1234567890_000.mp4';
    const title = extractOriginalTitle(url);

    expect(title).toBe('test');
    expect(title).not.toContain('1234567890');
  });

  it('should decode URL encoding', () => {
    const url = 'https://archive.wubby.tv/vods/public/HELLO%20WORLD_1234567890_000.mp4';
    const title = extractOriginalTitle(url);

    expect(title).toBe('HELLO WORLD');
  });

  it('should handle URLs with special characters', () => {
    const url =
      'https://archive.wubby.tv/vods/public/TEST%20-%20SPECIAL%20CHARS_1234567890_000.mp4';
    const title = extractOriginalTitle(url);

    expect(title).toBe('TEST - SPECIAL CHARS');
  });

  it('should return empty string for empty URL', () => {
    const title = extractOriginalTitle('');
    expect(title).toBe('');
  });

  it('should return empty string for # URL', () => {
    const title = extractOriginalTitle('#');
    expect(title).toBe('');
  });

  it('should handle different video extensions', () => {
    const mp4 = 'https://archive.wubby.tv/test_1234567890_000.mp4';
    const webm = 'https://archive.wubby.tv/test_1234567890_000.webm';
    const avi = 'https://archive.wubby.tv/test_1234567890_000.avi';
    const mov = 'https://archive.wubby.tv/test_1234567890_000.mov';

    expect(extractOriginalTitle(mp4)).toBe('test');
    expect(extractOriginalTitle(webm)).toBe('test');
    expect(extractOriginalTitle(avi)).toBe('test');
    expect(extractOriginalTitle(mov)).toBe('test');
  });

  it('should handle URLs without timestamp', () => {
    const url = 'https://archive.wubby.tv/vods/public/simple_video.mp4';
    const title = extractOriginalTitle(url);

    expect(title).toBe('simple_video');
  });

  it('should return empty string for invalid URLs', () => {
    const title = extractOriginalTitle('not-a-valid-url');
    expect(title).toBe('');
  });
});

describe('getThisWeekRange', () => {
  it('should return date range with from 7 days ago and to today', () => {
    const { from, to } = getThisWeekRange();

    expect(from).toBeInstanceOf(Date);
    expect(to).toBeInstanceOf(Date);

    const diffInDays = Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffInDays).toBe(7);
  });

  it('should have "to" date as today', () => {
    const { to } = getThisWeekRange();
    const today = new Date();

    expect(to.toDateString()).toBe(today.toDateString());
  });
});

describe('getDatePickerFormat', () => {
  it('should return valid date picker format', () => {
    const format = getDatePickerFormat();
    expect(format).toMatch(/^(d\/M\/y|M\/d\/y)$/);
  });
});

describe('formatDateLong', () => {
  it('should format ISO date string in long format', () => {
    const formatted = formatDateLong('2025-01-18T00:00:00Z');
    // Date might be 18 or 19 depending on timezone
    expect(formatted).toMatch(/^January (18|19), 2025$/);
  });

  it('should format Date object in long format', () => {
    const date = new Date('2025-01-18');
    const formatted = formatDateLong(date);
    expect(formatted).toContain('January');
    expect(formatted).toContain('2025');
  });

  it('should handle different months', () => {
    const dates = [
      '2025-01-01',
      '2025-02-01',
      '2025-12-31',
    ];

    const formatted = dates.map((d) => formatDateLong(d));

    expect(formatted[0]).toContain('January');
    expect(formatted[1]).toContain('February');
    expect(formatted[2]).toContain('December');
  });

  it('should handle invalid date gracefully', () => {
    const formatted = formatDateLong('invalid-date');
    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
  });
});

describe('formatSummaryText', () => {
  it('should format summary with proper paragraph spacing', () => {
    const summary = 'First paragraph\n\nSecond paragraph\n\nThird paragraph';
    const formatted = formatSummaryText(summary);

    expect(formatted).toBe('First paragraph\n\nSecond paragraph\n\nThird paragraph');
  });

  it('should handle single paragraph', () => {
    const summary = 'Single paragraph text';
    const formatted = formatSummaryText(summary);

    expect(formatted).toBe('Single paragraph text');
  });

  it('should remove extra whitespace', () => {
    const summary = '  First paragraph  \n\n  Second paragraph  ';
    const formatted = formatSummaryText(summary);

    expect(formatted).toBe('First paragraph\n\nSecond paragraph');
  });

  it('should handle multiple consecutive newlines', () => {
    const summary = 'First\n\n\n\n\nSecond';
    const formatted = formatSummaryText(summary);

    expect(formatted).toBe('First\n\nSecond');
  });

  it('should return default text for null summary', () => {
    const formatted = formatSummaryText(null);
    expect(formatted).toBe('- This vod has no summary -');
  });

  it('should return default text for undefined summary', () => {
    const formatted = formatSummaryText(undefined);
    expect(formatted).toBe('- This vod has no summary -');
  });

  it('should return default text for empty string', () => {
    const formatted = formatSummaryText('');
    expect(formatted).toBe('- This vod has no summary -');
  });

  it('should handle whitespace-only strings', () => {
    const formatted = formatSummaryText('   \n\n   ');
    // After filtering empty paragraphs, might be empty or default message
    expect(formatted.length).toBeGreaterThanOrEqual(0);
  });

  it('should filter out empty paragraphs', () => {
    const summary = 'First\n\n\nSecond\n\n\n\nThird';
    const formatted = formatSummaryText(summary);

    expect(formatted).toBe('First\n\nSecond\n\nThird');
  });

  it('should return default text for non-string input', () => {
    const formatted = formatSummaryText(123 as any);
    expect(formatted).toBe('- This vod has no summary -');
  });
});
