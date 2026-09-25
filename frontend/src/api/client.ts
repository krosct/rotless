import { ApiValidationError } from '@/types';

export const TOKEN_STORAGE_KEY = 'rotless_token';

export class ApiError extends Error {
  status: number;
  data?: unknown;
  errors?: Record<string, string[]>;

  constructor(status: number, message: string, data?: unknown, errors?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.errors = errors;
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Handle quota or private mode
  }
}

export function removeToken(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export async function apiClient<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  // The API always lives on the same origin as the app, under /api/*. In
  // development Vite proxies that prefix to Laravel; in production Caddy routes
  // it. Keeping every request relative guarantees dev and prod behave the same.
  const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  const headers = new Headers(options.headers || {});

  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let body: BodyInit | null | undefined = undefined;

  if (options.body instanceof FormData) {
    // Let browser set multipart/form-data boundary automatically
    body = options.body;
  } else if (options.body !== undefined && options.body !== null) {
    headers.set('Content-Type', 'application/json');
    headers.set('Accept', 'application/json');
    body = JSON.stringify(options.body);
  } else {
    headers.set('Accept', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
    body,
  });

  let responseData: unknown = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }
  } else {
    try {
      responseData = await response.text();
    } catch {
      responseData = null;
    }
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    let errors: Record<string, string[]> | undefined = undefined;

    if (responseData && typeof responseData === 'object') {
      const errObj = responseData as ApiValidationError;
      if (errObj.message) {
        message = errObj.message;
      }
      if (errObj.errors && typeof errObj.errors === 'object') {
        errors = errObj.errors;
      }
    }

    if (response.status === 401) {
      removeToken();
    }

    throw new ApiError(response.status, message, responseData, errors);
  }

  return responseData as T;
}
