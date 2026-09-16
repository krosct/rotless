import { describe, expect, it } from 'vitest';
import { expiryTone } from './expiry';

describe('expiryTone', () => {
  it('marks past dates as overdue', () => {
    expect(expiryTone('2026-09-01', '2026-09-16')).toBe('overdue');
  });

  it('marks dates within the warning window as soon', () => {
    expect(expiryTone('2026-09-16', '2026-09-16')).toBe('soon');
    expect(expiryTone('2026-09-19', '2026-09-16')).toBe('soon');
  });

  it('marks distant dates as ok', () => {
    expect(expiryTone('2026-09-20', '2026-09-16')).toBe('ok');
    expect(expiryTone('2026-12-01', '2026-09-16')).toBe('ok');
  });
});
