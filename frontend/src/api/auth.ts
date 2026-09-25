import { apiClient, setToken, removeToken } from './client';
import { AuthResponse, User } from '@/types';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const data = await apiClient<AuthResponse>('/api/v1/register', {
    method: 'POST',
    body: input,
  });
  if (data.token) {
    setToken(data.token);
  }
  return data;
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const data = await apiClient<AuthResponse>('/api/v1/login', {
    method: 'POST',
    body: input,
  });
  if (data.token) {
    setToken(data.token);
  }
  return data;
}

export async function logout(): Promise<{ message: string }> {
  try {
    const res = await apiClient<{ message: string }>('/api/v1/logout', {
      method: 'POST',
    });
    removeToken();
    return res;
  } catch (err) {
    removeToken();
    return { message: 'Desconectado com sucesso' };
  }
}

export async function getMe(): Promise<{ user: User }> {
  return apiClient<{ user: User }>('/api/v1/me', {
    method: 'GET',
  });
}

export async function updateProfile(data: { name?: string }): Promise<{ user: User; message: string }> {
  return apiClient<{ user: User; message: string }>('/api/v1/user/profile', {
    method: 'PATCH',
    body: data,
  });
}

export interface ChangePasswordInput {
  current_password: string;
  password: string;
  password_confirmation: string;
}

export async function changePassword(data: ChangePasswordInput): Promise<{ message: string }> {
  return apiClient<{ message: string }>('/api/v1/user/password', {
    method: 'PATCH',
    body: data,
  });
}

export interface TelegramLink {
  url: string;
  bot_username: string;
  start_command: string;
  expires_at: string;
}

export async function createTelegramLink(): Promise<TelegramLink> {
  const res = await apiClient<{ data: TelegramLink }>('/api/v1/telegram/link', {
    method: 'POST',
  });
  return res.data;
}

export async function unlinkTelegram(): Promise<{ message: string }> {
  return apiClient<{ message: string }>('/api/v1/telegram/link', {
    method: 'DELETE',
  });
}
