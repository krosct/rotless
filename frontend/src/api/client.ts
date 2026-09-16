const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

const TOKEN_KEY = 'rotless_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  readonly status: number;

  readonly errors?: Record<string, string[]>;

  constructor(status: number, message: string, errors?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

interface ApiFetchOptions {
  method?: string;
  body?: unknown;
}

interface ErrorEnvelope {
  message: string;
  errors?: Record<string, string[]>;
}

function parseErrorEnvelope(data: unknown): ErrorEnvelope | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const record = data as Record<string, unknown>;
  if (typeof record['message'] !== 'string') {
    return null;
  }
  const envelope: ErrorEnvelope = { message: record['message'] };
  if (typeof record['errors'] === 'object' && record['errors'] !== null) {
    const errors: Record<string, string[]> = {};
    for (const [field, messages] of Object.entries(record['errors'] as Record<string, unknown>)) {
      if (Array.isArray(messages) && messages.every((entry): entry is string => typeof entry === 'string')) {
        errors[field] = messages;
      }
    }
    envelope.errors = errors;
  }
  return envelope;
}

export async function apiFetch<T>(path: string, { method = 'GET', body }: ApiFetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = getToken();
  if (token !== null) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    // Let the browser set the multipart boundary.
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${path}`, { method, headers, body: payload });
  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const envelope = parseErrorEnvelope(data);
    throw new ApiError(response.status, envelope?.message ?? `Request failed (${response.status})`, envelope?.errors);
  }

  return data as T;
}
