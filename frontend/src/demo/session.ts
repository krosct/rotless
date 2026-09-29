// Demo mode: a fake account ("Teste") on a fake database that lives only in
// this browser tab. Nothing reaches the real API except the Telegram demo
// message. The database sits in sessionStorage, so a reload keeps it and
// closing the tab or signing out throws it away.
//
// This module stays tiny on purpose: the API client checks it on every
// request. The data and the fake API load only when the demo starts.

export const DEMO_TOKEN = 'rotless-demo-session';

const DB_STORAGE_KEY = 'rotless_demo_db';

// Used when sessionStorage is unavailable or full (large photos).
let memoryDb: string | null = null;

export function isDemoActive(): boolean {
  if (memoryDb !== null) {
    return true;
  }
  try {
    return sessionStorage.getItem(DB_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function readDemoDb<T>(): T | null {
  let raw = memoryDb;
  if (raw === null) {
    try {
      raw = sessionStorage.getItem(DB_STORAGE_KEY);
    } catch {
      raw = null;
    }
  }
  return raw === null ? null : (JSON.parse(raw) as T);
}

export function writeDemoDb(db: unknown): void {
  const raw = JSON.stringify(db);
  try {
    sessionStorage.setItem(DB_STORAGE_KEY, raw);
    memoryDb = null;
  } catch {
    memoryDb = raw;
  }
}

export function clearDemoDb(): void {
  memoryDb = null;
  try {
    sessionStorage.removeItem(DB_STORAGE_KEY);
  } catch {
    // Ignore
  }
}
