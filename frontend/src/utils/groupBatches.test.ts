import { describe, it, expect } from 'vitest';
import { groupBatchesByProduct } from './groupBatches';
import { Batch } from '@/types';

function makeBatch(overrides: Partial<Batch> & { id: number; productId: number }): Batch {
  return {
    id: overrides.id,
    product: { id: overrides.productId, name: overrides.product?.name ?? 'Leite' },
    quantity: overrides.quantity ?? 1,
    expires_at: overrides.expires_at ?? '2026-10-01',
    status: overrides.status ?? 'active',
  };
}

describe('groupBatchesByProduct', () => {
  it('agrupa lotes do mesmo produto em uma única entrada', () => {
    const batches = [
      makeBatch({ id: 1, productId: 10, quantity: 2, expires_at: '2026-10-10' }),
      makeBatch({ id: 2, productId: 10, quantity: 3, expires_at: '2026-10-01' }),
    ];

    const groups = groupBatchesByProduct(batches);

    expect(groups).toHaveLength(1);
    expect(groups[0].entries).toHaveLength(2);
    expect(groups[0].totalQuantity).toBe(5);
  });

  it('ordena as entradas pela validade mais próxima', () => {
    const batches = [
      makeBatch({ id: 1, productId: 10, expires_at: '2026-12-01' }),
      makeBatch({ id: 2, productId: 10, expires_at: '2026-10-01' }),
      makeBatch({ id: 3, productId: 10, expires_at: '2026-11-01' }),
    ];

    const groups = groupBatchesByProduct(batches);

    expect(groups[0].entries.map((entry) => entry.batch.id)).toEqual([2, 3, 1]);
    expect(groups[0].earliestExpiresAt).toBe('2026-10-01');
  });

  it('mantém produtos diferentes em grupos separados', () => {
    const batches = [
      makeBatch({ id: 1, productId: 10 }),
      makeBatch({ id: 2, productId: 20, product: { id: 20, name: 'Arroz' } }),
    ];

    const groups = groupBatchesByProduct(batches);

    expect(groups).toHaveLength(2);
  });

  it('mantém o grupo ativo enquanto houver qualquer entrada ativa', () => {
    const batches = [
      makeBatch({ id: 1, productId: 10, status: 'consumed', expires_at: '2026-10-01' }),
      makeBatch({ id: 2, productId: 10, status: 'active', expires_at: '2026-11-01' }),
    ];

    const groups = groupBatchesByProduct(batches);

    expect(groups[0].status).toBe('active');
    expect(groups[0].totalQuantity).toBe(1);
    expect(groups[0].earliestExpiresAt).toBe('2026-11-01');
  });

  it('remove entradas resolvidas da lista e conta em resolvedCount', () => {
    const batches = [
      makeBatch({ id: 1, productId: 10, status: 'consumed', expires_at: '2026-10-01' }),
      makeBatch({ id: 2, productId: 10, status: 'active', expires_at: '2026-11-01' }),
    ];

    const groups = groupBatchesByProduct(batches);

    expect(groups[0].entries).toHaveLength(1);
    expect(groups[0].entries[0].batch.id).toBe(2);
    expect(groups[0].resolvedCount).toBe(1);
  });

  it('marca o grupo como consumido quando todas as entradas foram resolvidas', () => {
    const batches = [
      makeBatch({ id: 1, productId: 10, status: 'consumed', expires_at: '2026-10-01' }),
      makeBatch({ id: 2, productId: 10, status: 'consumed', expires_at: '2026-11-01' }),
    ];

    const groups = groupBatchesByProduct(batches);

    expect(groups[0].status).toBe('consumed');
    expect(groups[0].totalQuantity).toBe(0);
    expect(groups[0].entries).toHaveLength(0);
    expect(groups[0].resolvedCount).toBe(2);
  });
});
