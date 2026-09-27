import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuthContext } from './AuthProvider';
import * as authApi from '@/api/auth';
import { ApiError, getToken, setToken } from '@/api/client';

function Probe() {
  const { isAuthenticated, isLoading } = useAuthContext();
  return <span data-testid="state">{isLoading ? 'loading' : isAuthenticated ? 'in' : 'out'}</span>;
}

function renderProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

describe('AuthProvider session handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    setToken('valid-token');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the stored token when /me fails transiently', async () => {
    vi.useFakeTimers();
    vi.spyOn(authApi, 'getMe').mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')));

    renderProvider();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(screen.getByTestId('state').textContent).toBe('out');
    expect(getToken()).toBe('valid-token');
  });

  it('clears the stored token when /me rejects with 401', async () => {
    vi.spyOn(authApi, 'getMe').mockImplementation(() => Promise.reject(new ApiError(401, 'Unauthenticated')));

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('state').textContent).toBe('out');
    });

    expect(getToken()).toBeNull();
  });
});
