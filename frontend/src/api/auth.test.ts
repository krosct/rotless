import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as authApi from './auth';
import { getToken } from './client';

describe('auth api service', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('login armazena token e retorna dados do usuário', async () => {
    const mockAuthResponse = {
      user: { id: 1, name: 'Ana Silva', email: 'ana@rotless.dev' },
      token: 'token_sanctum_abc123',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockAuthResponse,
    });

    const res = await authApi.login({ email: 'ana@rotless.dev', password: 'password123' });

    expect(res.token).toBe('token_sanctum_abc123');
    expect(res.user.name).toBe('Ana Silva');
    expect(getToken()).toBe('token_sanctum_abc123');
  });

  it('register armazena token e retorna dados do usuário e household', async () => {
    const mockRegisterResponse = {
      user: {
        id: 2,
        name: 'Carlos',
        email: 'carlos@rotless.dev',
        households: [{ id: 1, name: "Carlos's pantry", role: 'owner' }],
      },
      token: 'token_registered_xyz',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockRegisterResponse,
    });

    const res = await authApi.register({
      name: 'Carlos',
      email: 'carlos@rotless.dev',
      password: 'password123',
    });

    expect(res.token).toBe('token_registered_xyz');
    expect(getToken()).toBe('token_registered_xyz');
    expect(res.user.households?.[0].name).toBe("Carlos's pantry");
  });

  it('logout remove o token do localStorage', async () => {
    localStorage.setItem('rotless_token', 'active_token');

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ message: 'Desconectado' }),
    });

    await authApi.logout();
    expect(getToken()).toBeNull();
  });
});
