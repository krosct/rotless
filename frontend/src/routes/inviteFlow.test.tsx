import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter, type InitialEntry } from 'react-router-dom';
import { AuthProvider } from '@/providers/AuthProvider';
import { Login } from '@/pages/Login';
import { Register } from '@/pages/Register';
import { AcceptInvite } from '@/pages/AcceptInvite';
import { PublicOnlyRoute } from '@/routes/router';
import * as authApi from '@/api/auth';
import * as invitationsApi from '@/api/invitations';
import { setToken, getToken } from '@/api/client';

vi.mock('@/pages/Dashboard', () => ({
  Dashboard: () => <div data-testid="dashboard-page">Dashboard</div>,
}));

const inviteInfo = {
  token: 'tok123',
  email: 'guest@rotless.dev',
  household_id: 1,
  household_name: 'Casa',
  expires_at: '2030-01-01',
  state: 'invited' as const,
};

function renderRouter(initialEntries: InitialEntry[]) {
  const router = createMemoryRouter(
    [
      {
        path: '/login',
        element: (
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        ),
      },
      {
        path: '/register',
        element: (
          <PublicOnlyRoute>
            <Register />
          </PublicOnlyRoute>
        ),
      },
      { path: '/invite/:token', element: <AcceptInvite /> },
      { path: '/dashboard', element: <div data-testid="dashboard-page">Dashboard</div> },
    ],
    { initialEntries }
  );

  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

describe('invite returnTo flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();

    vi.spyOn(invitationsApi, 'getInvitationInfo').mockResolvedValue(inviteInfo);
    vi.spyOn(authApi, 'getMe').mockResolvedValue({
      user: { id: 2, name: 'Guest', email: 'guest@rotless.dev', households: [] },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sends an already authenticated user straight to the invite page', async () => {
    setToken('existing_token');

    renderRouter([{ pathname: '/invite/tok123' }]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Aceitar Convite/i })).toBeDefined();
    });
    expect(screen.getByText(/Você está conectado/i)).toBeDefined();
  });

  it('keeps an anonymous visitor on the invite and returns after login', async () => {
    const user = userEvent.setup();

    // Mirrors the backend: an unauthenticated request is reported as not_invited.
    vi.spyOn(invitationsApi, 'getInvitationInfo').mockImplementation(async () => ({
      ...inviteInfo,
      state: getToken() ? 'invited' : 'not_invited',
    }));

    vi.spyOn(authApi, 'login').mockImplementation(async () => {
      setToken('token_abc');
      return {
        user: { id: 2, name: 'Guest', email: 'guest@rotless.dev' },
        token: 'token_abc',
      };
    });

    renderRouter([{ pathname: '/invite/tok123' }]);

    // The anonymous visitor must see the invite, not be bounced away.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Aceitar Convite/i })).toBeDefined();
    });
    expect(screen.getByText(/Você precisará entrar ou criar uma conta/i)).toBeDefined();

    await user.click(screen.getByRole('button', { name: /Aceitar Convite/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Entrar na Despensa/i })).toBeDefined();
    });

    await user.type(screen.getByLabelText(/E-mail/i), 'guest@rotless.dev');
    await user.type(screen.getByLabelText(/Senha/i), 'password123');
    await user.click(screen.getByRole('button', { name: /Entrar na Despensa/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Aceitar Convite/i })).toBeDefined();
    });
    expect(screen.getByText(/Você está conectado/i)).toBeDefined();
  });

  it('returns to the invite page after logging in', async () => {
    const user = userEvent.setup();

    vi.spyOn(authApi, 'login').mockImplementation(async () => {
      setToken('token_abc');
      return {
        user: { id: 2, name: 'Guest', email: 'guest@rotless.dev' },
        token: 'token_abc',
      };
    });

    renderRouter([{ pathname: '/login', state: { returnTo: '/invite/tok123' } }]);

    await user.type(screen.getByLabelText(/E-mail/i), 'guest@rotless.dev');
    await user.type(screen.getByLabelText(/Senha/i), 'password123');
    await user.click(screen.getByRole('button', { name: /Entrar na Despensa/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Aceitar Convite/i })).toBeDefined();
    });
    expect(screen.getByText(/Você está conectado/i)).toBeDefined();
  });

  it('returns to the invite page after registering', async () => {
    vi.stubEnv('VITE_REGISTRATION_ENABLED', 'true');
    const user = userEvent.setup();

    vi.spyOn(authApi, 'register').mockImplementation(async () => {
      setToken('token_new');
      return {
        user: { id: 3, name: 'New', email: 'new@rotless.dev' },
        token: 'token_new',
      };
    });

    renderRouter([{ pathname: '/register', state: { returnTo: '/invite/tok123' } }]);

    await user.type(screen.getByLabelText(/Nome completo/i), 'New User');
    await user.type(screen.getByLabelText(/E-mail/i), 'new@rotless.dev');
    await user.type(screen.getByPlaceholderText(/Mínimo 8 caracteres/i), 'password123');
    await user.type(screen.getByLabelText(/Confirmar senha/i), 'password123');
    await user.click(screen.getByRole('button', { name: /Criar Minha Despensa/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Aceitar Convite/i })).toBeDefined();
    });
    expect(screen.getByText(/Você está conectado/i)).toBeDefined();
  });

  it('sends /register to the login page while sign-ups are closed, keeping the invite', async () => {
    const user = userEvent.setup();

    vi.spyOn(authApi, 'login').mockImplementation(async () => {
      setToken('token_abc');
      return {
        user: { id: 2, name: 'Guest', email: 'guest@rotless.dev' },
        token: 'token_abc',
      };
    });

    renderRouter([{ pathname: '/register', state: { returnTo: '/invite/tok123' } }]);

    expect(screen.getByTestId('login-form')).toBeDefined();
    expect(screen.getByTestId('demo-hint')).toBeDefined();

    await user.type(screen.getByLabelText(/E-mail/i), 'guest@rotless.dev');
    await user.type(screen.getByLabelText(/Senha/i), 'password123');
    await user.click(screen.getByRole('button', { name: /Entrar na Despensa/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Aceitar Convite/i })).toBeDefined();
    });
  });

  it('remembers the invite when the user opens the auth page directly', async () => {
    const user = userEvent.setup();

    vi.spyOn(authApi, 'login').mockImplementation(async () => {
      setToken('token_abc');
      return {
        user: { id: 2, name: 'Guest', email: 'guest@rotless.dev' },
        token: 'token_abc',
      };
    });

    // First visit the invite (stores the return path), then go to login manually.
    const router = createMemoryRouter(
      [
        {
          path: '/login',
          element: (
            <PublicOnlyRoute>
              <Login />
            </PublicOnlyRoute>
          ),
        },
        { path: '/invite/:token', element: <AcceptInvite /> },
        { path: '/dashboard', element: <div data-testid="dashboard-page">Dashboard</div> },
      ],
      { initialEntries: ['/invite/tok123'] }
    );

    render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Aceitar Convite/i })).toBeDefined();
    });

    expect(sessionStorage.getItem('rotless_invite_return_to')).toBe('/invite/tok123');

    await router.navigate('/login');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Entrar na Despensa/i })).toBeDefined();
    });

    await user.type(screen.getByLabelText(/E-mail/i), 'guest@rotless.dev');
    await user.type(screen.getByLabelText(/Senha/i), 'password123');
    await user.click(screen.getByRole('button', { name: /Entrar na Despensa/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Aceitar Convite/i })).toBeDefined();
    });
  });
});
