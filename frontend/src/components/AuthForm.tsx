import { useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError } from '../api/client';
import { login, register } from '../api/auth';

interface AuthFormProps {
  onAuthenticated: (householdId: number) => void;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const fieldErrors = error.errors ? ` ${Object.values(error.errors).flat().join(' ')}` : '';
    return `${error.message}${fieldErrors}`;
  }
  return 'Something went wrong.';
}

export function AuthForm({ onAuthenticated }: AuthFormProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      let householdId: number;
      if (mode === 'login') {
        const result = await login({ email, password });
        householdId = result.householdId;
      } else {
        const result = await register({ name, email, password });
        householdId = result.householdId;
      }
      onAuthenticated(householdId);
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>rotless</h1>
      <div>
        <button type="button" onClick={() => setMode('login')} disabled={mode === 'login'}>
          Login
        </button>
        <button type="button" onClick={() => setMode('register')} disabled={mode === 'register'}>
          Register
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        {mode === 'register' && (
          <label>
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
        )}
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
          />
        </label>
        {error !== null && <p role="alert">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
      </form>
    </div>
  );
}
