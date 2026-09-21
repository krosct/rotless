import { describe, it, expect } from 'vitest';
import { expiryTone, getExpiryMeta } from './expiry';
import { addDays, subDays, format } from 'date-fns';

describe('expiry utility', () => {
  const today = new Date('2026-09-17T12:00:00Z');

  it('retorna "overdue" para datas passadas', () => {
    const yesterday = format(subDays(today, 1), 'yyyy-MM-dd');
    const pastFiveDays = format(subDays(today, 5), 'yyyy-MM-dd');

    expect(expiryTone(yesterday, today)).toBe('overdue');
    expect(expiryTone(pastFiveDays, today)).toBe('overdue');
  });

  it('retorna "soon" para hoje', () => {
    const todayStr = format(today, 'yyyy-MM-dd');
    expect(expiryTone(todayStr, today)).toBe('soon');
  });

  it('retorna "soon" para amanhã (+1d)', () => {
    const tomorrowStr = format(addDays(today, 1), 'yyyy-MM-dd');
    expect(expiryTone(tomorrowStr, today)).toBe('soon');
  });

  it('retorna "soon" para +3 dias', () => {
    const threeDaysStr = format(addDays(today, 3), 'yyyy-MM-dd');
    expect(expiryTone(threeDaysStr, today)).toBe('soon');
  });

  it('retorna "ok" para +10 dias (fresh)', () => {
    const tenDaysStr = format(addDays(today, 10), 'yyyy-MM-dd');
    expect(expiryTone(tenDaysStr, today)).toBe('ok');
  });

  it('fornece metadados corretos de badgeText', () => {
    const yesterday = format(subDays(today, 1), 'yyyy-MM-dd');
    const soon = format(addDays(today, 2), 'yyyy-MM-dd');
    const fresh = format(addDays(today, 5), 'yyyy-MM-dd');

    expect(getExpiryMeta(yesterday, today).badgeText).toBe('Expired');
    expect(getExpiryMeta(soon, today).badgeText).toBe('Expiring soon');
    expect(getExpiryMeta(fresh, today).badgeText).toBe('Fresh');
  });
});
