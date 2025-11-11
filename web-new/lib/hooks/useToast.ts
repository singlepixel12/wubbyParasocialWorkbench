'use client';

/**
 * Toast Hook - Sonner Wrapper
 * Simple API for displaying toast notifications using Sonner
 */

import { toast } from 'sonner';

export interface ToastOptions {
  duration?: number;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Show error toast (5s default)
 */
export function showError(
  message: string,
  options?: ToastOptions | number
): string | number {
  const opts = typeof options === 'number' ? { duration: options } : options;
  return toast.error(message, { duration: 5000, ...opts });
}

/**
 * Show warning toast (4s default)
 */
export function showWarning(
  message: string,
  options?: ToastOptions | number
): string | number {
  const opts = typeof options === 'number' ? { duration: options } : options;
  return toast.warning(message, { duration: 4000, ...opts });
}

/**
 * Show success toast (3s default)
 */
export function showSuccess(
  message: string,
  options?: ToastOptions | number
): string | number {
  const opts = typeof options === 'number' ? { duration: options } : options;
  return toast.success(message, { duration: 3000, ...opts });
}

/**
 * Show info toast (4s default)
 */
export function showInfo(
  message: string,
  options?: ToastOptions | number
): string | number {
  const opts = typeof options === 'number' ? { duration: options } : options;
  return toast.info(message, { duration: 4000, ...opts });
}

/**
 * Show loading toast (persists until dismissed)
 */
export function showLoading(message: string): string | number {
  return toast.loading(message, { duration: Infinity });
}

/**
 * Dismiss toast by ID (or all if no ID provided)
 */
export function dismissToast(toastId?: string | number): void {
  toast.dismiss(toastId);
}

/**
 * Hook for using toasts in components
 */
export function useToast() {
  return {
    showError,
    showWarning,
    showSuccess,
    showInfo,
    showLoading,
    dismissToast,
  };
}
