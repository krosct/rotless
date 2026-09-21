import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getToken,
  setToken,
  removeToken,
  TOKEN_STORAGE_KEY,
  ApiError,
  apiClient,
} from './client';

describe('client utility and token storage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('salva, recupera e remove token do localStorage', () => {
    expect(getToken()).toBeNull();

    setToken('test_token_123');
    expect(getToken()).toBe('test_token_123');
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('test_token_123');

    removeToken();
    expect(getToken()).toBeNull();
  });

  it('constrói ApiError com status e campos de erro corretos', () => {
    const error422 = new ApiError(422, 'Dados inválidos', null, {
      email: ['E-mail já cadastrado'],
    });

    expect(error422.status).toBe(422);
    expect(error422.message).toBe('Dados inválidos');
    expect(error422.errors?.email).toContain('E-mail já cadastrado');

    const error500 = new ApiError(500, 'Server error');
    expect(error500.status).toBe(500);
    expect(error500.message).toBe('Server error');
  });

  it('lança ApiError com envelope 422 quando endpoint falha com 422', async () => {
    const mockResponse = {
      message: 'Os dados fornecidos são inválidos.',
      errors: {
        quantity: ['A quantidade deve ser maior que 0.'],
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockResponse,
    });

    try {
      await apiClient('/api/v1/batches', { method: 'POST', body: {} });
      expect.fail('Deveria ter lançado ApiError');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(422);
      expect(apiErr.message).toBe('Os dados fornecidos são inválidos.');
      expect(apiErr.errors?.quantity).toContain('A quantidade deve ser maior que 0.');
    }
  });

  it('lança ApiError quando endpoint retorna 500', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ message: 'Erro interno no servidor' }),
    });

    try {
      await apiClient('/api/v1/batches');
      expect.fail('Deveria ter lançado ApiError');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(500);
      expect(apiErr.message).toBe('Erro interno no servidor');
    }
  });
});
