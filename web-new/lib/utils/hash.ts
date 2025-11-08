/**
 * Video URL hashing utilities
 * Generates SHA-256 hashes for consistent database lookups
 */

/**
 * Computes a SHA-256 hash of a video URL
 *
 * This function creates a unique, fixed-length identifier from any video URL.
 * The hash is used as a consistent database key for video metadata lookups in Supabase.
 *
 * How it works:
 * 1. Validates the input URL string
 * 2. Encodes the URL to UTF-8 bytes (preserving special characters)
 * 3. Generates a SHA-256 hash (256-bit / 32-byte)
 * 4. Converts to a 64-character hexadecimal string
 *
 * @param videoUrl - The video URL from archive.wubby.tv
 * @returns A 64-character hexadecimal hash string
 * @throws Error if URL is invalid, crypto API unavailable, or hash computation fails
 *
 * @example
 * ```ts
 * const hash = await computeVideoHash('https://archive.wubby.tv/vods/public/...');
 * // Returns: "a1b2c3d4e5f6...xyz" (64 characters)
 * ```
 */
export async function computeVideoHash(videoUrl: string): Promise<string> {
  console.group('🔐 Computing Video Hash');
  console.log('Input URL:', videoUrl);
  console.log('URL length:', videoUrl.length);

  try {
    // Validate input
    if (!videoUrl || typeof videoUrl !== 'string') {
      console.error('❌ Invalid video URL:', typeof videoUrl);
      throw new Error('Invalid video URL provided');
    }

    // Get the crypto object - works in both browser and Node.js environments
    // In browsers: global crypto object
    // In Node.js 15+: globalThis.crypto or require('crypto').webcrypto
    const cryptoApi =
      typeof globalThis !== 'undefined' && globalThis.crypto
        ? globalThis.crypto
        : typeof crypto !== 'undefined'
          ? crypto
          : undefined;

    // Check if Web Crypto API is available
    if (!cryptoApi || !cryptoApi.subtle) {
      console.error('❌ Web Crypto API not available');
      console.log('globalThis.crypto available:', typeof globalThis?.crypto !== 'undefined');
      console.log('crypto available:', typeof crypto !== 'undefined');
      console.log('crypto.subtle available:', cryptoApi && !!cryptoApi.subtle);
      throw new Error('Web Crypto API is not available in this environment');
    }

    console.log('✅ Web Crypto API available');

    // TextEncoder converts the string to UTF-8 bytes
    // This preserves URL encoding exactly (crucial for URLs with special characters)
    const encoder = new TextEncoder();
    const data = encoder.encode(videoUrl);
    console.log('Encoded data length:', data.length, 'bytes');

    // Generate SHA-256 hash using Web Crypto API
    // Returns a 256-bit (32-byte) ArrayBuffer
    console.log('Computing SHA-256 hash...');
    const hashBuffer = await cryptoApi.subtle.digest('SHA-256', data);
    console.log('Hash buffer size:', hashBuffer.byteLength, 'bytes');

    // Convert ArrayBuffer to Uint8Array for easier manipulation
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    console.log('Hash array length:', hashArray.length, 'bytes');

    // Convert each byte to a 2-digit hexadecimal string
    // padStart(2, '0') ensures consistent formatting (e.g., '0A' not 'A')
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    console.log('Hash hex length:', hashHex.length, 'characters');
    console.log('Hash result:', hashHex);

    // Validate output - SHA-256 should always produce 64 hex characters
    if (!hashHex || hashHex.length !== 64) {
      console.error('❌ Invalid hash output:', {
        length: hashHex.length,
        expected: 64,
      });
      throw new Error('Hash computation failed - invalid output length');
    }

    console.log('✅ Hash computed successfully');
    console.groupEnd();
    return hashHex;
  } catch (error) {
    // Log error for debugging
    console.error('❌ Hash computation error:', error);
    console.groupEnd();

    // Provide user-friendly error messages based on error type
    if (error instanceof Error) {
      if (error.name === 'NotSupportedError') {
        throw new Error(
          'Hash computation not supported in this browser. Please use a modern browser.'
        );
      } else if (error.name === 'QuotaExceededError') {
        throw new Error('Browser quota exceeded. Please try again later.');
      } else if (error.message.includes('Invalid video URL')) {
        throw error; // Re-throw validation errors as-is
      }
    }

    throw new Error(
      `Hash computation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Validates if a string is a valid SHA-256 hash
 *
 * @param hash - String to validate
 * @returns True if the string is a valid 64-character hex hash
 *
 * @example
 * ```ts
 * isValidHash('a1b2c3...'); // true if 64 hex chars
 * isValidHash('invalid'); // false
 * ```
 */
export function isValidHash(hash: string): boolean {
  return typeof hash === 'string' && /^[a-f0-9]{64}$/i.test(hash);
}
