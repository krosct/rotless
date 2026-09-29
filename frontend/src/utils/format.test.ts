import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTodayISODate } from './format';

afterEach(() => vi.useRealTimers());

describe('getTodayISODate', () => {
  it('returns the local calendar day, not the UTC one', () => {
    // 23:00 in São Paulo is already the next day in UTC; the form must still
    // offer today's local date.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 29, 23, 0, 0));

    expect(getTodayISODate()).toBe('2026-09-29');
  });
});
