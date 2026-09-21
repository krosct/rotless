import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthForm } from './AuthForm';
import { AuthProvider } from '@/providers/AuthProvider';
import * as authApi from '@/api/auth';
import { ApiError } from '@/api/client';

describe('AuthForm component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  const renderWithProviders = (component: React.ReactNode) => {
    return render(<AuthProvider>{component}</AuthProvider>);
  };

  it('alterna entre as abas de Login e Criar conta', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AuthForm defaultMode="login" />);

    // Deve mostrar o botão "Entrar na Despensa"
    expect(screen.getByRole('button', { name: /Entrar na Despensa/i })).toBeDefined();

    // Clica na tab "Criar conta"
    const registerTab = screen.getByRole('tab', { name: /Criar conta/i });
    await user.click(registerTab);

    // Agora deve exibir o botão de cadastro e o campo nome
    expect(screen.getByRole('button', { name: /Criar Minha Despensa/i })).toBeDefined();
    expect(screen.getByLabelText(/Nome completo/i)).toBeDefined();
  });

  it('exibe erro de validação inline ao submeter e-mail inválido', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AuthForm defaultMode="login" />);

    const emailInput = screen.getByLabelText(/E-mail/i);
    const passwordInput = screen.getByLabelText(/Senha/i);
    await user.type(emailInput, 'invalid-email');
    await user.type(passwordInput, 'secret123');

    const submitBtn = screen.getByRole('button', { name: /Entrar na Despensa/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/E-mail em formato inválido/i)).toBeDefined();
    });
  });

  it('lida com erro 422 da API exibindo mensagem no formulário', async () => {
    const user = userEvent.setup();

    vi.spyOn(authApi, 'login').mockRejectedValueOnce(
      new ApiError(422, 'Credenciais inválidas.', null, {
        email: ['E-mail ou senha incorretos.'],
      })
    );

    renderWithProviders(<AuthForm defaultMode="login" />);

    const emailInput = screen.getByLabelText(/E-mail/i);
    const passwordInput = screen.getByLabelText(/Senha/i);

    await user.type(emailInput, 'user@rotless.dev');
    await user.type(passwordInput, 'wrongpass');

    const submitBtn = screen.getByRole('button', { name: /Entrar na Despensa/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/E-mail ou senha incorretos./i)).toBeDefined();
    });
  });

  it('mantém o formulário montado e exibe o erro quando o login falha', async () => {
    const user = userEvent.setup();

    vi.spyOn(authApi, 'login').mockRejectedValueOnce(
      new ApiError(422, 'Credenciais inválidas.', null, {
        email: ['E-mail ou senha incorretos.'],
      })
    );

    renderWithProviders(<AuthForm defaultMode="login" />);

    await user.type(screen.getByLabelText(/E-mail/i), 'user@rotless.dev');
    await user.type(screen.getByLabelText(/Senha/i), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /Entrar na Despensa/i }));

    await waitFor(() => {
      expect(screen.getByTestId('login-form')).toBeDefined();
      expect(screen.getByRole('alert')).toBeDefined();
    });
  });

  it('exige senha com pelo menos 8 caracteres no cadastro', async () => {
    const user = userEvent.setup();
    const registerSpy = vi.spyOn(authApi, 'register');

    renderWithProviders(<AuthForm defaultMode="register" />);

    await user.type(screen.getByLabelText(/Nome completo/i), 'Ana Silva');
    await user.type(screen.getByLabelText(/E-mail/i), 'ana@rotless.dev');
    await user.type(screen.getByLabelText(/Senha/i), 'short12');
    await user.click(screen.getByRole('button', { name: /Criar Minha Despensa/i }));

    await waitFor(() => {
      expect(screen.getByText(/pelo menos 8 caracteres/i)).toBeDefined();
    });
    expect(registerSpy).not.toHaveBeenCalled();
  });
});
