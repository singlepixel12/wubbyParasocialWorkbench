# Testing Guide

## Overview

The Wubby Parasocial Workbench now has comprehensive unit test coverage using **Vitest** and **React Testing Library**.

**Current Stats:**
- 129 unit tests across 6 test files
- All tests passing ✅
- Test categories: Hooks, Components, Utilities

---

## Running Tests

### Unit Tests (Vitest)

```bash
# Run all unit tests once
npm run test
# or
npm run test:unit

# Run tests in watch mode (re-runs on file changes)
npm run test:watch
# or
npm run test:unit:watch

# Run tests with coverage report
npm run test:coverage
```

### E2E Tests (Playwright)

```bash
# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run E2E tests in headed mode (see browser)
npm run test:e2e:headed

# Debug E2E tests
npm run test:e2e:debug
```

### Run All Tests

```bash
# Run unit tests + E2E tests
npm run test:all
```

---

## Test Structure

```
tests/
├── setup.ts                        # Global test setup (mocks, cleanup)
├── test-utils.tsx                  # Custom render helpers, mock factories
├── unit/                           # Unit tests
│   ├── useLocalStorage.test.tsx    # 14 tests - localStorage hook
│   ├── useToast.test.tsx           # 17 tests - toast notifications
│   ├── VideoSelector.test.tsx      # 22 tests - video input component
│   ├── VideoCard.test.tsx          # 20 tests - VOD diary card component
│   ├── hash.test.ts                # 25 tests - SHA-256 hashing utilities
│   └── video-helpers.test.ts       # 31 tests - date/URL utilities
├── smoke.spec.ts                   # E2E smoke test
├── hash.spec.ts                    # E2E hash functionality
└── vod-diary.spec.ts               # E2E VOD diary
```

---

## What's Tested

### Hooks (31 tests)

#### `useLocalStorage` (14 tests)
- ✅ Initial value loading
- ✅ Storing/retrieving values
- ✅ Functional updates
- ✅ Complex objects and arrays
- ✅ Cross-tab synchronization
- ✅ Error handling (JSON parse errors, quota exceeded)
- ✅ SSR safety

#### `useToast` (17 tests)
- ✅ All toast types (error, warning, success, info, loading)
- ✅ Custom durations
- ✅ Options (description, action buttons)
- ✅ Dismiss individual/all toasts
- ✅ Default durations per type

### Components (42 tests)

#### `VideoSelector` (22 tests)
- ✅ Rendering (input, buttons, datalist)
- ✅ Input interaction (typing, value display)
- ✅ Load button (enabled/disabled states, loading text)
- ✅ Clear button functionality
- ✅ Accessibility (ARIA labels, descriptions)

#### `VideoCard` (20 tests)
- ✅ Rendering (title, summary, date, platform badge)
- ✅ Expand/collapse functionality
- ✅ Tag display when expanded
- ✅ Platform-specific styling
- ✅ Thumbnail click behavior
- ✅ LocalStorage integration
- ✅ Accessibility (links, labels)

### Utilities (56 tests)

#### `hash.ts` (25 tests)
- ✅ SHA-256 hash generation
- ✅ Consistency (same URL → same hash)
- ✅ Uniqueness (different URLs → different hashes)
- ✅ Special characters and URL encoding
- ✅ Query parameters and fragments
- ✅ Input validation
- ✅ Hash validation (64-char hex)

#### `video-helpers.ts` (31 tests)
- ✅ Date formatting (locale-aware)
- ✅ Title extraction from URLs
- ✅ URL decoding and timestamp removal
- ✅ Date range calculations
- ✅ Summary text formatting
- ✅ Error handling

---

## Test Configuration

### `vitest.config.ts`

```typescript
{
  environment: 'jsdom',          // Browser-like environment
  globals: true,                 // No need to import test functions
  setupFiles: ['./tests/setup.ts'],
  pool: 'threads',               // Run tests in parallel threads
  singleThread: true,            // Prevent race conditions
}
```

### `tests/setup.ts`

Global test setup includes:
- Auto-cleanup after each test
- `@testing-library/jest-dom` matchers
- Mock `window.matchMedia`
- Mock `IntersectionObserver`
- Mock `ResizeObserver`

---

## Writing New Tests

### 1. Hook Tests

```typescript
import { renderHook, act } from '@testing-library/react';
import { useYourHook } from '@/lib/hooks/useYourHook';

describe('useYourHook', () => {
  it('should do something', () => {
    const { result } = renderHook(() => useYourHook());

    act(() => {
      result.current.doSomething();
    });

    expect(result.current.value).toBe('expected');
  });
});
```

### 2. Component Tests

```typescript
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test-utils';
import { YourComponent } from '@/components/YourComponent';

describe('YourComponent', () => {
  it('should render', () => {
    renderWithProviders(<YourComponent />);

    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('should handle click', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    renderWithProviders(<YourComponent onClick={onClick} />);

    await user.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalled();
  });
});
```

### 3. Utility Function Tests

```typescript
import { describe, it, expect } from 'vitest';
import { yourFunction } from '@/lib/utils/yourUtil';

describe('yourFunction', () => {
  it('should do something', () => {
    const result = yourFunction('input');
    expect(result).toBe('expected');
  });
});
```

---

## Best Practices

1. **Use descriptive test names** - "should render video title" not "test 1"
2. **Test behavior, not implementation** - Test what the user sees/does
3. **Mock external dependencies** - Supabase, localStorage, APIs
4. **Use test utilities** - `renderWithProviders`, `createMockVideo`
5. **Test edge cases** - Empty strings, null, undefined, errors
6. **Keep tests focused** - One concept per test
7. **Use accessibility queries** - `getByRole`, `getByLabelText`
8. **Test user interactions** - Use `@testing-library/user-event`

---

## Coverage

To generate a coverage report:

```bash
npm run test:coverage
```

This creates:
- `coverage/index.html` - Visual coverage report
- Console output with coverage percentages

**Coverage Goals:**
- Statements: >80%
- Branches: >75%
- Functions: >80%
- Lines: >80%

---

## Troubleshooting

### Tests timing out
- Check if using `act()` for state updates
- Ensure async operations use `await waitFor()`

### "Not wrapped in act()" warnings
- Wrap state updates in `act()` from `@testing-library/react`

### Mock issues
- Check `tests/setup.ts` for global mocks
- Use `vi.mock()` at the top of test files

### Role queries failing
- Use `screen.logTestingPlaygroundURL()` to debug
- Check actual rendered roles with `screen.debug()`

---

## Next Steps

### Future Test Additions

1. **More Component Tests**
   - VideoMetadata
   - VidstackPlayer
   - PlatformSlider
   - SearchInput
   - DateRangePicker

2. **API Integration Tests**
   - Mock Supabase responses
   - Test error handling
   - Test retry logic

3. **Visual Regression Tests**
   - Playwright component screenshots
   - Percy or Chromatic integration

4. **Performance Tests**
   - React rendering benchmarks
   - Bundle size limits

---

## Resources

- [Vitest Docs](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Playwright Docs](https://playwright.dev/)
