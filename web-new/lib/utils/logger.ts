/**
 * Logger Utility
 * Provides console logging that respects NODE_ENV
 * In production, only errors and warnings are logged
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = {
  /**
   * Log informational messages (development only)
   */
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * Log warning messages (all environments)
   */
  warn: (...args: any[]) => {
    console.warn(...args);
  },

  /**
   * Log error messages (all environments)
   */
  error: (...args: any[]) => {
    console.error(...args);
  },

  /**
   * Log informational messages (development only)
   */
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  /**
   * Log grouped messages (development only)
   */
  group: (label: string) => {
    if (isDevelopment) {
      console.group(label);
    }
  },

  /**
   * End log group (development only)
   */
  groupEnd: () => {
    if (isDevelopment) {
      console.groupEnd();
    }
  },
};
