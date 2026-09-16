export type ExpiryTone = 'ok' | 'soon' | 'overdue';

const WARNING_DAYS = 3;

function todayString(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function addDaysString(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const result = new Date(year, month - 1, day);
  result.setDate(result.getDate() + days);
  const resultMonth = String(result.getMonth() + 1).padStart(2, '0');
  const resultDay = String(result.getDate()).padStart(2, '0');
  return `${result.getFullYear()}-${resultMonth}-${resultDay}`;
}

/** Classify a YYYY-MM-DD expiry date relative to today. */
export function expiryTone(expiresAt: string, today: string = todayString()): ExpiryTone {
  if (expiresAt < today) {
    return 'overdue';
  }
  if (expiresAt <= addDaysString(today, WARNING_DAYS)) {
    return 'soon';
  }
  return 'ok';
}
