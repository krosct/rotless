import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listBatches } from './batches';

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as unknown as Response;
}

describe('listBatches', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the batches from the data envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        data: [
          {
            id: 1,
            product: { id: 2, name: 'Rice' },
            quantity: 3,
            expires_at: '2026-10-01',
            status: 'active',
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const batches = await listBatches();

    expect(batches).toEqual([
      {
        id: 1,
        product: { id: 2, name: 'Rice' },
        quantity: 3,
        expires_at: '2026-10-01',
        status: 'active',
      },
    ]);
  });

  it('rejects a malformed envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ data: [{ id: 'x' }] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(listBatches()).rejects.toThrow();
  });
});
