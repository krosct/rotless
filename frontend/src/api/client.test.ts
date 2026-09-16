import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch, clearToken, getToken, setToken } from './client';

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as unknown as Response;
}

describe('token storage', () => {
  beforeEach(() => {
    clearToken();
    vi.unstubAllGlobals();
  });

  it('stores and clears the token', () => {
    expect(getToken()).toBeNull();

    setToken('abc');
    expect(getToken()).toBe('abc');

    clearToken();
    expect(getToken()).toBeNull();
  });
});

describe('apiFetch', () => {
  beforeEach(() => {
    clearToken();
    vi.unstubAllGlobals();
  });

  it('returns the parsed body on success', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ data: [1, 2] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiFetch<{ data: number[] }>('/api/v1/batches');

    expect(result).toEqual({ data: [1, 2] });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('sends the bearer token when stored', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    setToken('secret-token');

    await apiFetch('/api/v1/batches');

    const [, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(init.headers['Authorization']).toBe('Bearer secret-token');
  });

  it('throws an ApiError with field errors on validation failure', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ message: 'Invalid data.', errors: { email: ['Invalid email.'] } }, 422),
      );
    vi.stubGlobal('fetch', fetchMock);

    const failure = apiFetch('/api/v1/register', { method: 'POST', body: {} });
    await expect(failure).rejects.toMatchObject({
      status: 422,
      message: 'Invalid data.',
      errors: { email: ['Invalid email.'] },
    });
    await expect(failure).rejects.toBeInstanceOf(ApiError);
  });

  it('throws a generic ApiError when the body is not an envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(null, 500));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/api/v1/batches')).rejects.toMatchObject({
      status: 500,
      message: 'Request failed (500)',
    });
  });
});
