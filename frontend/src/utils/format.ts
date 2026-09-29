import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function formatDate(dateString?: string | null, formatStr: string = 'dd/MM/yyyy'): string {
  if (!dateString) return '';
  try {
    const d = parseISO(dateString);
    return format(d, formatStr, { locale: ptBR });
  } catch {
    return dateString;
  }
}

export function formatQuantity(quantity: number, unit: string = 'un'): string {
  if (quantity === 1) {
    return `1 ${unit}`;
  }
  return `${quantity} ${unit}`;
}

export function getTodayISODate(): string {
  // Local calendar day. toISOString() would return the UTC day, which is
  // already tomorrow in the evening in Brasília (UTC-3).
  return format(new Date(), 'yyyy-MM-dd');
}
