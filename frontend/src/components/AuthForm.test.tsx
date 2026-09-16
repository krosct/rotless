import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthForm } from './AuthForm';

const { loginMock, registerMock } = vi.hoisted(() => ({
  loginMock: vi.fn(),
  registerMock: vi.fn(),
}));

vi.mock('../api/auth', () => ({
  login: loginMock,
  register: registerMock,
}));

describe('AuthForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs in and notifies the parent', async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValueOnce({ id: 1, name: 'PH', email: 'ph@example.com' });
    const onAuthenticated = vi.fn();
    render(<AuthForm onAuthenticated={onAuthenticated} />);

    await user.type(screen.getByLabelText(/email/i), 'ph@example.com');
    await user.type(screen.getByLabelText(/password/i), 'supersecret');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(loginMock).toHaveBeenCalledWith({ email: 'ph@example.com', password: 'supersecret' });
    expect(onAuthenticated).toHaveBeenCalledOnce();
  });

  it('shows the backend error message on failure', async () => {
    const user = userEvent.setup();
    const { ApiError } = await import('../api/client');
    loginMock.mockRejectedValueOnce(new ApiError(422, 'Invalid credentials.'));
    render(<AuthForm onAuthenticated={() => {}} />);

    await user.type(screen.getByLabelText(/email/i), 'ph@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials.');
  });

  it('registers with a name in register mode', async () => {
    const user = userEvent.setup();
    registerMock.mockResolvedValueOnce({ id: 2, name: 'Ana', email: 'ana@example.com' });
    const onAuthenticated = vi.fn();
    render(<AuthForm onAuthenticated={onAuthenticated} />);

    // Click the Register tab button (the one that's not disabled)
    await user.click(screen.getByRole('button', { name: /^register$/i }));
    await user.type(screen.getByLabelText(/name/i), 'Ana');
    await user.type(screen.getByLabelText(/email/i), 'ana@example.com');
    await user.type(screen.getByLabelText(/password/i), 'supersecret');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(registerMock).toHaveBeenCalledWith({
      name: 'Ana',
      email: 'ana@example.com',
      password: 'supersecret',
    });
    expect(onAuthenticated).toHaveBeenCalledOnce();
  });
});
