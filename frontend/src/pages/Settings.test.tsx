import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/providers/AuthProvider';
import { Settings } from './Settings';
import * as authApi from '@/api/auth';
import { setToken } from '@/api/client';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const baseUser = { id: 2, name: 'Ana', email: 'ana@rotless.dev', households: [] };
let linkedChatId: string | null = null;

function renderSettings() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Settings />
      </AuthProvider>
    </MemoryRouter>
  );
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('Settings — Telegram linking', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    setToken('token_abc');
    linkedChatId = null;

    vi.spyOn(authApi, 'getMe').mockImplementation(async () => ({
      user: {
        ...baseUser,
        telegram_chat_id: linkedChatId,
        telegram_chat_name: linkedChatId ? 'Ana Silva' : null,
      },
    }));
    vi.spyOn(authApi, 'createTelegramLink').mockImplementation(async () => ({
      url: 'https://t.me/rotless_bot?start=abc',
      bot_username: 'rotless_bot',
      start_command: '/start abc',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    }));
    vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('confirms the linking automatically once the webhook links the account', async () => {
    vi.useFakeTimers();

    renderSettings();
    await flush();

    fireEvent.click(screen.getByRole('button', { name: /Vincular Telegram/i }));
    await flush();

    // The Telegram webhook links the account while the settings page polls.
    linkedChatId = '987654321';

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(screen.getByText(/Vinculado à conta Ana Silva/i)).toBeDefined();
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('vinculado'));
  });
});
