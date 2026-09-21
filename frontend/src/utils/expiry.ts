import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns';
import { ExpiryTone } from '@/types';

/**
 * Computes the expiry tone based on the expiration date compared to a reference date (default: today).
 * - 'overdue': expires_at < today (< 0 days)
 * - 'soon': expires_at <= today + 3 days (0 to 3 days remaining)
 * - 'ok': expires_at > today + 3 days (> 3 days remaining)
 */
export function expiryTone(dateStrOrDate: string | Date, referenceDate: Date = new Date()): ExpiryTone {
  const targetDate = typeof dateStrOrDate === 'string' ? parseISO(dateStrOrDate) : dateStrOrDate;
  const daysDiff = differenceInCalendarDays(startOfDay(targetDate), startOfDay(referenceDate));

  if (daysDiff < 0) {
    return 'overdue';
  }
  if (daysDiff <= 3) {
    return 'soon';
  }
  return 'ok';
}

/**
 * Returns human-readable relative label and styling info
 */
export function getExpiryMeta(dateStr: string, referenceDate: Date = new Date()) {
  const tone = expiryTone(dateStr, referenceDate);
  const targetDate = parseISO(dateStr);
  const days = differenceInCalendarDays(startOfDay(targetDate), startOfDay(referenceDate));

  let label = '';
  let badgeText = '';

  if (days < 0) {
    const absDays = Math.abs(days);
    badgeText = 'Expired';
    label = absDays === 1 ? 'Venceu ontem' : `Venceu há ${absDays} dias`;
  } else if (days === 0) {
    badgeText = 'Expiring soon';
    label = 'Vence hoje!';
  } else if (days === 1) {
    badgeText = 'Expiring soon';
    label = 'Vence amanhã';
  } else if (days <= 3) {
    badgeText = 'Expiring soon';
    label = `Vence em ${days} dias`;
  } else {
    badgeText = 'Fresh';
    label = `Vence em ${days} dias`;
  }

  return {
    tone,
    days,
    badgeText,
    label,
  };
}
