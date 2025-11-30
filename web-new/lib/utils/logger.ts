/**
 * Logger Utility
 * Environment-aware logging that respects NODE_ENV
 *
 * In production:
 * - Only errors and warnings are logged
 * - Debug/info/log messages are suppressed
 *
 * In development:
 * - All log levels are enabled
 * - Includes grouped logging for structured output
 *
 * Future: Can integrate with Sentry, LogRocket, or other monitoring services
 */

const isDevelopment = process.env.NODE_ENV !== 'production';
const isTest = process.env.NODE_ENV === 'test';

/**
 * Centralized logger
 * Use this instead of console.log/console.error throughout the app
 */
export const logger = {
  /**
   * Debug-level logging (development only)
   * Use for verbose debugging information
   */
  debug: (...args: unknown[]) => {
    if (isDevelopment && !isTest) {
      console.log('[DEBUG]', ...args);
    }
  },

  /**
   * Informational messages (development only)
   * Use for general application flow logging
   */
  log: (...args: unknown[]) => {
    if (isDevelopment && !isTest) {
      console.log(...args);
    }
  },

  /**
   * Info-level logging (development only)
   * Use for important but non-critical information
   */
  info: (...args: unknown[]) => {
    if (isDevelopment && !isTest) {
      console.info(...args);
    }
  },

  /**
   * Warning messages (all environments)
   * Use for recoverable issues that need attention
   */
  warn: (...args: unknown[]) => {
    if (!isTest) {
      console.warn('[WARN]', ...args);
    }
    // TODO: Send to error tracking service in production
  },

  /**
   * Error messages (all environments)
   * Use for critical errors that affect functionality
   */
  error: (...args: unknown[]) => {
    if (!isTest) {
      console.error('[ERROR]', ...args);
    }
    // TODO: Send to error tracking service (Sentry/LogRocket)
  },

  /**
   * Start grouped log messages (development only)
   * Use for structured logging of related operations
   */
  group: (label: string) => {
    if (isDevelopment && !isTest) {
      console.group(label);
    }
  },

  /**
   * End grouped log messages (development only)
   */
  groupEnd: () => {
    if (isDevelopment && !isTest) {
      console.groupEnd();
    }
  },
};
