'use client';

/**
 * Toast Hook
 * Provides a simple API for displaying toast notifications
 * Wraps Sonner (mobile-optimized toast library) to match vanilla API
 *
 * Mobile-first features:
 * - Swipe to dismiss
 * - Touch-optimized
 * - Smart positioning (top-center on mobile)
 * - Beautiful animations
 */

import { toast as sonnerToast } from 'sonner';

export type ToastType = 'error' | 'warning' | 'success' | 'info' | 'loading';

export interface ToastOptions {
  /**
   * Duration in milliseconds (0 = no auto-dismiss)
   * Default: 5000ms for errors, 4000ms for warnings, 3000ms for success
   */
  duration?: number;

  /**
   * Optional description text (appears below main message)
   */
  description?: string;

  /**
   * Optional action button
   */
  action?: {
    label: string;
    onClick: () => void;
  };

  /**
   * Optional cancel button
   */
  cancel?: {
    label: string;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  };
}

/**
 * Main toast function
 * @param message - The message to display
 * @param type - Toast type (error, warning, success, info, loading)
 * @param options - Additional options (duration, description, action, etc.)
 * @returns Toast ID (can be used to dismiss specific toast)
 */
export function showToast(
  message: string,
  type: ToastType = 'error',
  options?: ToastOptions | number
): string | number {
  // Handle legacy API: showToast(message, type, duration)
  const opts: ToastOptions = typeof options === 'number'
    ? { duration: options }
    : (options || {});

  // Build toast options, only including cancel if onClick is defined
  const toastOptions: any = {
    description: opts.description,
    duration: opts.duration,
    action: opts.action,
  };

  // Only include cancel if onClick is provided
  if (opts.cancel?.onClick) {
    toastOptions.cancel = opts.cancel;
  }

  switch (type) {
    case 'error':
      return sonnerToast.error(message, toastOptions);
    case 'warning':
      return sonnerToast.warning(message, toastOptions);
    case 'success':
      return sonnerToast.success(message, toastOptions);
    case 'info':
      return sonnerToast.info(message, toastOptions);
    case 'loading':
      return sonnerToast.loading(message, toastOptions);
    default:
      return sonnerToast(message, toastOptions);
  }
}

/**
 * Show error toast
 * @param message - Error message
 * @param options - Duration (ms) or full options object
 * @returns Toast ID
 */
export function showError(
  message: string,
  options?: ToastOptions | number
): string | number {
  const opts: ToastOptions = typeof options === 'number'
    ? { duration: options }
    : (options || { duration: 5000 });

  return showToast(message, 'error', opts);
}

/**
 * Show warning toast
 * @param message - Warning message
 * @param options - Duration (ms) or full options object
 * @returns Toast ID
 */
export function showWarning(
  message: string,
  options?: ToastOptions | number
): string | number {
  const opts: ToastOptions = typeof options === 'number'
    ? { duration: options }
    : (options || { duration: 4000 });

  return showToast(message, 'warning', opts);
}

/**
 * Show success toast
 * @param message - Success message
 * @param options - Duration (ms) or full options object
 * @returns Toast ID
 */
export function showSuccess(
  message: string,
  options?: ToastOptions | number
): string | number {
  const opts: ToastOptions = typeof options === 'number'
    ? { duration: options }
    : (options || { duration: 3000 });

  return showToast(message, 'success', opts);
}

/**
 * Show info toast
 * @param message - Info message
 * @param options - Duration (ms) or full options object
 * @returns Toast ID
 */
export function showInfo(
  message: string,
  options?: ToastOptions | number
): string | number {
  const opts: ToastOptions = typeof options === 'number'
    ? { duration: options }
    : (options || { duration: 4000 });

  return showToast(message, 'info', opts);
}

/**
 * Show loading toast (no auto-dismiss)
 * @param message - Loading message
 * @returns Toast ID (use this to dismiss or update the toast later)
 */
export function showLoading(message: string): string | number {
  return showToast(message, 'loading', { duration: Infinity });
}

/**
 * Dismiss a specific toast
 * @param toastId - Toast ID returned from show* functions
 */
export function dismissToast(toastId: string | number): void {
  sonnerToast.dismiss(toastId);
}

/**
 * Clear all toasts
 */
export function clearAllToasts(): void {
  sonnerToast.dismiss();
}

/**
 * Update an existing toast (useful for loading states)
 * @param toastId - Toast ID to update
 * @param message - New message
 * @param type - New type
 * @param options - Additional options
 */
export function updateToast(
  toastId: string | number,
  message: string,
  type: ToastType = 'info',
  options?: ToastOptions
): void {
  // Dismiss old toast and show new one
  // Sonner doesn't have a direct update API, so we dismiss and re-show
  sonnerToast.dismiss(toastId);
  showToast(message, type, options);
}

/**
 * Promise-based toast (shows loading, then success/error)
 * Perfect for async operations
 *
 * @example
 * ```ts
 * await showPromiseToast(
 *   fetchData(),
 *   {
 *     loading: 'Fetching data...',
 *     success: 'Data loaded!',
 *     error: 'Failed to load data',
 *   }
 * );
 * ```
 */
export function showPromiseToast<T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((error: any) => string);
  },
  options?: ToastOptions
): any {
  // Build promise toast options, excluding cancel if onClick is not provided
  const promiseOptions: any = {
    loading: messages.loading,
    success: messages.success,
    error: messages.error,
    description: options?.description,
    duration: options?.duration,
    action: options?.action,
  };

  // Only include cancel if onClick is provided
  if (options?.cancel?.onClick) {
    promiseOptions.cancel = options.cancel;
  }

  return sonnerToast.promise(promise, promiseOptions);
}

/**
 * Custom hook for using toasts in components
 * Returns all toast utility functions
 */
export function useToast() {
  return {
    showToast,
    showError,
    showWarning,
    showSuccess,
    showInfo,
    showLoading,
    dismissToast,
    clearAllToasts,
    updateToast,
    showPromiseToast,
  };
}
