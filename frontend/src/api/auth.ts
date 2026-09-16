import { z } from 'zod';
import { apiFetch, clearToken, setToken } from './client';

const householdSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const userSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  households: z.array(householdSchema).optional(),
});

export type User = z.infer<typeof userSchema>;
export type Household = z.infer<typeof householdSchema>;

const tokenResponseSchema = z.object({
  user: userSchema,
  token: z.string(),
});

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export async function register(input: RegisterInput): Promise<{ user: User; householdId: number }> {
  const data = await apiFetch<unknown>('/api/v1/register', { method: 'POST', body: input });
  const parsed = tokenResponseSchema.parse(data);
  setToken(parsed.token);
  const householdId = parsed.user.households?.[0]?.id ?? 0;
  return { user: parsed.user, householdId };
}

export async function login(input: LoginInput): Promise<{ user: User; householdId: number }> {
  const data = await apiFetch<unknown>('/api/v1/login', { method: 'POST', body: input });
  const parsed = tokenResponseSchema.parse(data);
  setToken(parsed.token);
  const householdId = parsed.user.households?.[0]?.id ?? 0;
  return { user: parsed.user, householdId };
}

export async function logout(): Promise<void> {
  try {
    await apiFetch<unknown>('/api/v1/logout', { method: 'POST' });
  } finally {
    clearToken();
  }
}
