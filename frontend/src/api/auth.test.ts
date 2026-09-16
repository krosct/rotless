import { beforeEach, describe, expect, it, vi } from 'vitest';
import { login, logout, register } from './auth';
import { clearToken, getToken } from './client';

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as unknown as Response;
}

describe('auth', () => {
  beforeEach(() => {
    clearToken();
    vi.unstubAllGlobals();
  });

  it('stores the token and returns the user on login', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ user: { id: 1, name: 'PH', email: 'ph@example.com', households: [] }, token: 'tok-123' }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await login({ email: 'ph@example.com', password: 'supersecret' });

    expect(result.user).toEqual({ id: 1, name: 'PH', email: 'ph@example.com', households: [] });
    expect(result.householdId).toBe(0);
    expect(getToken()).toBe('tok-123');

    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string }];
    expect(url).toContain('/api/v1/login');
    expect(init.method).toBe('POST');
  });

  it('stores the token on registration', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(
        {
          user: { id: 2, name: 'Ana', email: 'ana@example.com', households: [{ id: 7, name: "Ana's pantry" }] },
          token: 'tok-456',
        },
        201,
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await register({ name: 'Ana', email: 'ana@example.com', password: 'supersecret' });

    expect(result.user.households).toEqual([{ id: 7, name: "Ana's pantry" }]);
    expect(result.householdId).toBe(7);
    expect(getToken()).toBe('tok-456');
  });

  it('rejects a malformed login response', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ token: 'tok-789' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(login({ email: 'ph@example.com', password: 'supersecret' })).rejects.toThrow();
    expect(getToken()).toBeNull();
  });

  it('clears the token on logout even when the request fails', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ message: 'Unauthenticated.' }, 401));
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem('rotless_token', 'stale-token');

    await expect(logout()).rejects.toThrow();
    expect(getToken()).toBeNull();
  });
});
