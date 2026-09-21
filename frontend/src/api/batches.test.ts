import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as batchesApi from './batches';

describe('batches api service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('lista os lotes da despensa', async () => {
    const mockBatches = [
      {
        id: 1,
        household_id: 1,
        product: { id: 10, name: 'Leite Integral' },
        quantity: 2,
        expires_at: '2026-09-25',
        status: 'active',
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: mockBatches }),
    });

    const res = await batchesApi.listBatches(1);
    expect(res).toHaveLength(1);
    expect(res[0].product.name).toBe('Leite Integral');
  });

  it('aceita lista sem envelope (array direto)', async () => {
    const mockBatches = [
      {
        id: 1,
        product: { id: 10, name: 'Leite Integral' },
        quantity: 2,
        expires_at: '2026-09-25',
        status: 'active',
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockBatches,
    });

    const res = await batchesApi.listBatches(1);
    expect(res).toHaveLength(1);
  });

  it('cria lote com FormData (suporte a foto/barcode)', async () => {
    const newBatch = {
      id: 2,
      product: { id: 11, name: 'Iogurte Grego' },
      quantity: 1,
      expires_at: '2026-09-30',
      status: 'active',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: newBatch }),
    });

    const res = await batchesApi.createBatch({
      name: 'Iogurte Grego',
      quantity: 1,
      expires_at: '2026-09-30',
    });

    expect(res.id).toBe(2);
    expect(res.product.name).toBe('Iogurte Grego');
  });

  it('atualiza quantidade e status de um lote', async () => {
    const updated = {
      id: 1,
      product: { id: 10, name: 'Leite Integral' },
      quantity: 1,
      expires_at: '2026-09-25',
      status: 'consumed',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: updated }),
    });

    const res = await batchesApi.updateBatch(1, { quantity: 1, status: 'consumed' });
    expect(res.status).toBe('consumed');
    expect(res.quantity).toBe(1);
  });

  it('exclui um lote com sucesso', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ message: 'Lote excluído com sucesso.' }),
    });

    const res = await batchesApi.deleteBatch(1);
    expect(res.message).toBe('Lote excluído com sucesso.');
  });
});
