/**
 * Unit tests for hash utility functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeVideoHash, isValidHash } from '@/lib/utils/hash';

// Mock logger
vi.mock('@/lib/utils/logger', () => ({
  logger: {
    group: vi.fn(),
    groupEnd: vi.fn(),
    log: vi.fn(),
    error: vi.fn(),
  },
}));

describe('computeVideoHash', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should compute SHA-256 hash for valid URL', async () => {
    const url = 'https://archive.wubby.tv/vods/public/test.mp4';
    const hash = await computeVideoHash(url);

    expect(hash).toBeDefined();
    expect(typeof hash).toBe('string');
    expect(hash.length).toBe(64);
    expect(/^[a-f0-9]{64}$/i.test(hash)).toBe(true);
  });

  it('should produce consistent hashes for same URL', async () => {
    const url = 'https://archive.wubby.tv/vods/public/test.mp4';
    const hash1 = await computeVideoHash(url);
    const hash2 = await computeVideoHash(url);

    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different URLs', async () => {
    const url1 = 'https://archive.wubby.tv/vods/public/test1.mp4';
    const url2 = 'https://archive.wubby.tv/vods/public/test2.mp4';

    const hash1 = await computeVideoHash(url1);
    const hash2 = await computeVideoHash(url2);

    expect(hash1).not.toBe(hash2);
  });

  it('should handle URLs with special characters', async () => {
    const url =
      'https://archive.wubby.tv/vods/public/SPECIAL%20CHARS%20-%20TEST_1234567890_000.mp4';
    const hash = await computeVideoHash(url);

    expect(hash).toBeDefined();
    expect(hash.length).toBe(64);
  });

  it('should handle URLs with spaces (encoded)', async () => {
    const url = 'https://archive.wubby.tv/vods/public/test%20with%20spaces.mp4';
    const hash = await computeVideoHash(url);

    expect(hash).toBeDefined();
    expect(hash.length).toBe(64);
  });

  it('should throw error for invalid URL (empty string)', async () => {
    await expect(computeVideoHash('')).rejects.toThrow('Invalid video URL');
  });

  it('should throw error for invalid URL (null)', async () => {
    await expect(computeVideoHash(null as any)).rejects.toThrow();
  });

  it('should throw error for invalid URL (undefined)', async () => {
    await expect(computeVideoHash(undefined as any)).rejects.toThrow();
  });

  it('should throw error for non-string input', async () => {
    await expect(computeVideoHash(123 as any)).rejects.toThrow('Invalid video URL');
  });

  it('should handle very long URLs', async () => {
    const longUrl =
      'https://archive.wubby.tv/vods/public/' + 'a'.repeat(500) + '.mp4';
    const hash = await computeVideoHash(longUrl);

    expect(hash).toBeDefined();
    expect(hash.length).toBe(64);
  });

  it('should handle URLs with query parameters', async () => {
    const url = 'https://archive.wubby.tv/vods/public/test.mp4?timestamp=123&quality=720p';
    const hash = await computeVideoHash(url);

    expect(hash).toBeDefined();
    expect(hash.length).toBe(64);
  });

  it('should handle URLs with fragments', async () => {
    const url = 'https://archive.wubby.tv/vods/public/test.mp4#section';
    const hash = await computeVideoHash(url);

    expect(hash).toBeDefined();
    expect(hash.length).toBe(64);
  });

  it('should produce different hashes for URLs differing only in query params', async () => {
    const url1 = 'https://archive.wubby.tv/vods/public/test.mp4?v=1';
    const url2 = 'https://archive.wubby.tv/vods/public/test.mp4?v=2';

    const hash1 = await computeVideoHash(url1);
    const hash2 = await computeVideoHash(url2);

    expect(hash1).not.toBe(hash2);
  });
});

describe('isValidHash', () => {
  it('should return true for valid 64-character hex string', () => {
    const validHash = 'a'.repeat(64);
    expect(isValidHash(validHash)).toBe(true);
  });

  it('should return true for valid hash with mixed case', () => {
    const validHash = 'Aa'.repeat(32);
    expect(isValidHash(validHash)).toBe(true);
  });

  it('should return true for valid hash with numbers', () => {
    const validHash = '0123456789abcdef'.repeat(4);
    expect(isValidHash(validHash)).toBe(true);
  });

  it('should return false for hash with invalid length (too short)', () => {
    const invalidHash = 'a'.repeat(63);
    expect(isValidHash(invalidHash)).toBe(false);
  });

  it('should return false for hash with invalid length (too long)', () => {
    const invalidHash = 'a'.repeat(65);
    expect(isValidHash(invalidHash)).toBe(false);
  });

  it('should return false for hash with invalid characters', () => {
    const invalidHash = 'g'.repeat(64); // 'g' is not a hex character
    expect(isValidHash(invalidHash)).toBe(false);
  });

  it('should return false for hash with spaces', () => {
    const invalidHash = 'a'.repeat(32) + ' '.repeat(32);
    expect(isValidHash(invalidHash)).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isValidHash('')).toBe(false);
  });

  it('should return false for non-string input', () => {
    expect(isValidHash(123 as any)).toBe(false);
  });

  it('should return false for null', () => {
    expect(isValidHash(null as any)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isValidHash(undefined as any)).toBe(false);
  });

  it('should return false for hash with special characters', () => {
    const invalidHash = 'a'.repeat(32) + '!@#$'.repeat(8);
    expect(isValidHash(invalidHash)).toBe(false);
  });
});
