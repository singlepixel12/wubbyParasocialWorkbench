/**
 * Unit tests for useToast hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useToast,
  showError,
  showWarning,
  showSuccess,
  showInfo,
  showLoading,
  dismissToast,
  clearAllToasts,
} from '@/lib/hooks/useToast';
import { toast } from 'sonner';

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn((msg, opts) => 'toast-error-id'),
    warning: vi.fn((msg, opts) => 'toast-warning-id'),
    success: vi.fn((msg, opts) => 'toast-success-id'),
    info: vi.fn((msg, opts) => 'toast-info-id'),
    loading: vi.fn((msg, opts) => 'toast-loading-id'),
    dismiss: vi.fn(),
  },
}));

describe('useToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return all toast utility functions', () => {
    const { result } = renderHook(() => useToast());

    expect(result.current).toHaveProperty('showToast');
    expect(result.current).toHaveProperty('showError');
    expect(result.current).toHaveProperty('showWarning');
    expect(result.current).toHaveProperty('showSuccess');
    expect(result.current).toHaveProperty('showInfo');
    expect(result.current).toHaveProperty('showLoading');
    expect(result.current).toHaveProperty('dismissToast');
    expect(result.current).toHaveProperty('clearAllToasts');
  });
});

describe('showError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call toast.error with message', () => {
    showError('Error message');

    expect(toast.error).toHaveBeenCalledWith('Error message', expect.any(Object));
  });

  it('should set default duration of 5000ms', () => {
    showError('Error message');

    expect(toast.error).toHaveBeenCalledWith(
      'Error message',
      expect.objectContaining({ duration: 5000 })
    );
  });

  it('should accept custom duration as number', () => {
    showError('Error message', 10000);

    expect(toast.error).toHaveBeenCalledWith(
      'Error message',
      expect.objectContaining({ duration: 10000 })
    );
  });

  it('should accept options object with description', () => {
    showError('Error message', {
      duration: 8000,
      description: 'Error details',
    });

    expect(toast.error).toHaveBeenCalledWith(
      'Error message',
      expect.objectContaining({
        duration: 8000,
        description: 'Error details',
      })
    );
  });

  it('should accept options with action button', () => {
    const actionFn = vi.fn();
    showError('Error message', {
      action: {
        label: 'Retry',
        onClick: actionFn,
      },
    });

    expect(toast.error).toHaveBeenCalledWith(
      'Error message',
      expect.objectContaining({
        action: {
          label: 'Retry',
          onClick: actionFn,
        },
      })
    );
  });
});

describe('showWarning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call toast.warning with message', () => {
    showWarning('Warning message');

    expect(toast.warning).toHaveBeenCalledWith('Warning message', expect.any(Object));
  });

  it('should set default duration of 4000ms', () => {
    showWarning('Warning message');

    expect(toast.warning).toHaveBeenCalledWith(
      'Warning message',
      expect.objectContaining({ duration: 4000 })
    );
  });
});

describe('showSuccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call toast.success with message', () => {
    showSuccess('Success message');

    expect(toast.success).toHaveBeenCalledWith('Success message', expect.any(Object));
  });

  it('should set default duration of 3000ms', () => {
    showSuccess('Success message');

    expect(toast.success).toHaveBeenCalledWith(
      'Success message',
      expect.objectContaining({ duration: 3000 })
    );
  });
});

describe('showInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call toast.info with message', () => {
    showInfo('Info message');

    expect(toast.info).toHaveBeenCalledWith('Info message', expect.any(Object));
  });

  it('should set default duration of 4000ms', () => {
    showInfo('Info message');

    expect(toast.info).toHaveBeenCalledWith(
      'Info message',
      expect.objectContaining({ duration: 4000 })
    );
  });
});

describe('showLoading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call toast.loading with infinite duration', () => {
    showLoading('Loading...');

    expect(toast.loading).toHaveBeenCalledWith(
      'Loading...',
      expect.objectContaining({ duration: Infinity })
    );
  });

  it('should return toast ID', () => {
    const id = showLoading('Loading...');

    expect(id).toBe('toast-loading-id');
  });
});

describe('dismissToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call toast.dismiss with ID', () => {
    dismissToast('toast-123');

    expect(toast.dismiss).toHaveBeenCalledWith('toast-123');
  });

  it('should call toast.dismiss without ID', () => {
    dismissToast();

    expect(toast.dismiss).toHaveBeenCalledWith(undefined);
  });
});

describe('clearAllToasts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call toast.dismiss to clear all toasts', () => {
    clearAllToasts();

    expect(toast.dismiss).toHaveBeenCalled();
  });
});
