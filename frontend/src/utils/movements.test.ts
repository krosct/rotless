import { describe, it, expect } from 'vitest';
import { describeAction, describeChanges, initials, isBackfilled } from './movements';
import type { Movement } from '@/types';

function movement(overrides: Partial<Movement>): Movement {
  return {
    id: 1,
    action: 'created',
    created_at: '2026-09-29T12:00:00Z',
    user: { id: 1, name: 'Marina Costa' },
    subject: null,
    batch_id: 10,
    product_name: 'Leite integral',
    quantity: null,
    changes: null,
    ...overrides,
  };
}

describe('describeAction', () => {
  it('says what happened to how many units of what', () => {
    expect(describeAction(movement({ action: 'created', quantity: 6 }))).toBe('adicionou 6 un de Leite integral');
    expect(describeAction(movement({ action: 'consumed', quantity: 2, changes: { quantity: { from: 6, to: 4 } } }))).toBe(
      'consumiu 2 un de Leite integral'
    );
    expect(
      describeAction(movement({ action: 'discarded', quantity: 4, changes: { status: { from: 'active', to: 'discarded' } } }))
    ).toBe('descartou 4 un de Leite integral (tudo o que restava)');
    expect(describeAction(movement({ action: 'deleted', quantity: 3 }))).toBe('excluiu Leite integral');
    expect(describeAction(movement({ action: 'member_removed', subject: { id: 2, name: 'Pedro' }, product_name: null }))).toBe(
      'removeu Pedro da despensa'
    );
  });
});

describe('describeChanges', () => {
  it('lists each field from -> to, in a fixed order, with readable values', () => {
    const lines = describeChanges(
      movement({
        action: 'updated',
        changes: {
          quantity: { from: 6, to: 5 },
          expires_at: { from: '2026-10-01', to: '2026-10-03' },
        },
      })
    );

    expect(lines).toEqual([
      { label: 'Validade', from: '01/10/2026', to: '03/10/2026' },
      { label: 'Quantidade', from: '6 un', to: '5 un' },
    ]);
  });

  it('translates status and role, and keeps one-sided values', () => {
    expect(describeChanges(movement({ changes: { status: { from: 'active', to: 'consumed' } } }))).toEqual([
      { label: 'Status', from: 'Ativo', to: 'Consumido' },
    ]);
    expect(describeChanges(movement({ changes: { role: { from: 'member', to: 'manager' } } }))).toEqual([
      { label: 'Papel', from: 'Membro', to: 'Gerente' },
    ]);
    expect(describeChanges(movement({ changes: { quantity: { from: 3, to: null } } }))).toEqual([
      { label: 'Quantidade', from: '3 un', to: null },
    ]);
  });

  it('ignores the backfilled marker', () => {
    const backfilled = movement({ changes: { backfilled: true, quantity: { from: null, to: 2 } } });

    expect(describeChanges(backfilled)).toEqual([{ label: 'Quantidade', from: null, to: '2 un' }]);
    expect(isBackfilled(backfilled)).toBe(true);
  });
});

describe('initials', () => {
  it('takes the first and last names', () => {
    expect(initials('Marina Costa')).toBe('MC');
    expect(initials('Teste')).toBe('T');
    expect(initials('Júlia de Souza')).toBe('JS');
  });
});
