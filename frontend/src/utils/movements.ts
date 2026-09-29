import { formatDate } from '@/utils/format';
import type { Movement, MovementAction, MovementChange } from '@/types';

// Turns a household movement into the words of the history screen: who did
// what ("consumiu 2 un de Leite") and, field by field, what changed
// ("Validade: 01/10/2026 → 03/10/2026").

export const ACTION_LABELS: Record<MovementAction, string> = {
  created: 'Inclusão',
  updated: 'Edição',
  consumed: 'Consumo',
  discarded: 'Descarte',
  deleted: 'Exclusão',
  product_updated: 'Produto',
  household_renamed: 'Despensa',
  member_invited: 'Convite',
  member_joined: 'Entrada',
  member_removed: 'Remoção de membro',
  member_role_changed: 'Papel',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  consumed: 'Consumido',
  discarded: 'Descartado',
};

const ROLE_LABELS: Record<string, string> = {
  owner: 'Dono',
  manager: 'Gerente',
  member: 'Membro',
};

const FIELD_LABELS: Record<string, string> = {
  expires_at: 'Validade',
  quantity: 'Quantidade',
  status: 'Status',
  name: 'Nome',
  role: 'Papel',
  email: 'E-mail',
  photo: 'Foto',
};

// Order the lines read in, whatever order the API sent them.
const FIELD_ORDER = ['name', 'expires_at', 'quantity', 'status', 'role', 'email', 'photo'];

function units(quantity: number | null): string {
  return quantity === null ? '' : `${quantity} un`;
}

function product(movement: Movement): string {
  return movement.product_name ?? 'um item';
}

/** The verb phrase after the person's name. */
export function describeAction(movement: Movement): string {
  const qty = units(movement.quantity);
  const subject = movement.subject?.name ?? 'um membro';
  const status = (movement.changes?.status as MovementChange | undefined)?.to;

  switch (movement.action) {
    case 'created':
      return `adicionou ${qty ? `${qty} de ` : ''}${product(movement)}`;
    case 'updated':
      return `editou ${product(movement)}`;
    case 'consumed':
      return `consumiu ${qty ? `${qty} de ` : ''}${product(movement)}${status === 'consumed' ? ' (tudo o que restava)' : ''}`;
    case 'discarded':
      return `descartou ${qty ? `${qty} de ` : ''}${product(movement)}${status === 'discarded' ? ' (tudo o que restava)' : ''}`;
    case 'deleted':
      return `excluiu ${product(movement)}`;
    case 'product_updated':
      return `editou o produto ${product(movement)}`;
    case 'household_renamed':
      return 'renomeou a despensa';
    case 'member_invited':
      return 'enviou um convite';
    case 'member_joined':
      return 'entrou na despensa';
    case 'member_removed':
      return `removeu ${subject} da despensa`;
    case 'member_role_changed':
      return `mudou o papel de ${subject}`;
  }
}

function formatValue(field: string, value: string | number | null): string {
  if (value === null) return '—';
  switch (field) {
    case 'expires_at':
      return formatDate(String(value));
    case 'quantity':
      return `${value} un`;
    case 'status':
      return STATUS_LABELS[String(value)] ?? String(value);
    case 'role':
      return ROLE_LABELS[String(value)] ?? String(value);
    case 'photo':
      return 'atualizada';
    default:
      return String(value);
  }
}

export interface ChangeLine {
  label: string;
  /** Null when the field had no previous value (e.g. on creation). */
  from: string | null;
  /** Null when the value went away (e.g. on deletion). */
  to: string | null;
}

/** One line per changed field. */
export function describeChanges(movement: Movement): ChangeLine[] {
  const changes = movement.changes ?? {};
  return Object.entries(changes)
    .filter((entry): entry is [string, MovementChange] => typeof entry[1] === 'object' && entry[1] !== null)
    .sort(([a], [b]) => FIELD_ORDER.indexOf(a) - FIELD_ORDER.indexOf(b))
    .map(([field, change]) => ({
      label: FIELD_LABELS[field] ?? field,
      from: change.from === null ? null : formatValue(field, change.from),
      to: change.to === null ? null : formatValue(field, change.to),
    }));
}

/** Entries rebuilt from batches that existed before the detailed history. */
export function isBackfilled(movement: Movement): boolean {
  return movement.changes?.backfilled === true;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
