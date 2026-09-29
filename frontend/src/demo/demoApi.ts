import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns';
import { ApiError } from '@/api/client';
import { clearDemoDb, readDemoDb, writeDemoDb } from './session';
import { buildDemoDb, DEMO_CATALOG, DemoBatch, DemoDb } from './demoData';

// The API of the demo mode: same routes, payloads and rules as the Laravel
// API (app/Http/Controllers/Api/V1), answered from the demo database in
// sessionStorage. Only the Telegram demo link talks to the real server.

type Handler = (ctx: RequestContext) => Promise<unknown> | unknown;

interface RequestContext {
  db: DemoDb;
  params: string[];
  query: URLSearchParams;
  body: unknown;
}

interface DemoRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

const LATENCY_MS = 120;

export function startDemo(now: Date = new Date()): void {
  writeDemoDb(buildDemoDb(now));
}

function validationError(field: string, message: string): ApiError {
  return new ApiError(422, message, { message, errors: { [field]: [message] } }, { [field]: [message] });
}

function notFound(): ApiError {
  return new ApiError(404, 'Not found.', { message: 'Not found.' });
}

function nowIso(): string {
  return new Date().toISOString();
}

function field(body: unknown, key: string): unknown {
  if (body instanceof FormData) {
    const value = body.get(key);
    return value === null || value === '' ? undefined : value;
  }
  if (body !== null && typeof body === 'object') {
    return (body as Record<string, unknown>)[key];
  }
  return undefined;
}

function isBeforeToday(date: string): boolean {
  return differenceInCalendarDays(startOfDay(parseISO(date)), startOfDay(new Date())) < 0;
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseISO(value).getTime());
}

function validQuantity(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// --- Serializers (same shapes as the controllers) ---------------------------

function actor(db: DemoDb, id: number | null) {
  const user = db.users.find((item) => item.id === id);
  return user ? { id: user.id, name: user.name } : null;
}

function serializeBatch(db: DemoDb, batch: DemoBatch) {
  const product = db.products.find((item) => item.id === batch.product_id)!;
  return {
    id: batch.id,
    household_id: db.household.id,
    product: { id: product.id, name: product.name, barcode: product.barcode, photo_url: product.photo_url },
    quantity: batch.quantity,
    expires_at: batch.expires_at,
    status: batch.status,
    created_at: batch.created_at,
    updated_at: batch.updated_at,
    created_by: actor(db, batch.created_by),
    updated_by: actor(db, batch.updated_by),
  };
}

function operationsCount(db: DemoDb, userId: number): number {
  return db.batches.filter((batch) => batch.created_by === userId || batch.updated_by === userId).length;
}

function serializeMembers(db: DemoDb, count: (userId: number) => number) {
  return db.memberships.map((membership) => {
    const user = db.users.find((item) => item.id === membership.user_id)!;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: membership.role,
      joined_at: membership.joined_at,
      operations_count: count(user.id),
    };
  });
}

function serializeMe(db: DemoDb) {
  const me = db.users.find((user) => user.id === db.me_id)!;
  const role = db.memberships.find((membership) => membership.user_id === db.me_id)!.role;
  // /me counts created batches only (AuthController::serializeUser).
  const created = (userId: number) => db.batches.filter((batch) => batch.created_by === userId).length;
  return {
    id: me.id,
    name: me.name,
    email: me.email,
    telegram_chat_id: db.telegram.chat_id,
    telegram_chat_name: db.telegram.chat_name,
    households: [
      {
        id: db.household.id,
        name: db.household.name,
        is_owner: role === 'owner',
        role,
        members: serializeMembers(db, created),
      },
    ],
  };
}

function findBatch(db: DemoDb, id: string): DemoBatch {
  const batch = db.batches.find((item) => item.id === Number(id));
  if (!batch) throw notFound();
  return batch;
}

function assertHousehold(db: DemoDb, id: string): void {
  if (Number(id) !== db.household.id) throw notFound();
}

function touch(batch: DemoBatch, db: DemoDb): void {
  batch.updated_at = nowIso();
  batch.updated_by = db.me_id;
}

// --- Telegram: the only calls that reach the server --------------------------

async function realRequest<T>(url: string, method: 'GET' | 'POST'): Promise<T> {
  const response = await fetch(url, { method, headers: { Accept: 'application/json' } });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (data as { message?: string } | null)?.message ?? `Request failed with status ${response.status}`;
    throw new ApiError(response.status, message, data);
  }
  return data as T;
}

async function refreshTelegramLink(db: DemoDb): Promise<void> {
  const token = db.telegram.pending_token;
  if (!token || db.telegram.chat_id) return;
  try {
    const res = await realRequest<{ data: { linked: boolean; chat_name: string | null } }>(
      `/api/v1/telegram/demo-link/${encodeURIComponent(token)}`,
      'GET'
    );
    if (res.data.linked) {
      db.telegram = {
        chat_id: 'demo',
        chat_name: res.data.chat_name ? `${res.data.chat_name} (demonstração)` : 'Telegram (demonstração)',
        pending_token: null,
      };
    }
  } catch {
    // The profile still answers; the next poll tries again.
  }
}

// --- Routes -------------------------------------------------------------------

const routes: [string, RegExp, Handler][] = [
  ['GET', /^\/api\/v1\/me$/, async ({ db }) => {
    await refreshTelegramLink(db);
    return { user: serializeMe(db) };
  }],

  ['POST', /^\/api\/v1\/logout$/, () => {
    clearDemoDb();
    return { message: 'Logged out.' };
  }],

  ['PATCH', /^\/api\/v1\/user\/profile$/, ({ db, body }) => {
    const name = field(body, 'name');
    if (typeof name !== 'string' || name.trim().length < 2) {
      throw validationError('name', 'The name field must be at least 2 characters.');
    }
    db.users.find((user) => user.id === db.me_id)!.name = name.trim();
    return { user: serializeMe(db), message: 'Profile updated successfully.' };
  }],

  ['PATCH', /^\/api\/v1\/user\/password$/, ({ body }) => {
    const password = field(body, 'password');
    if (!field(body, 'current_password')) {
      throw validationError('current_password', 'The current password field is required.');
    }
    if (typeof password !== 'string' || password.length < 8) {
      throw validationError('password', 'The password field must be at least 8 characters.');
    }
    if (password !== field(body, 'password_confirmation')) {
      throw validationError('password', 'The password field confirmation does not match.');
    }
    return { message: 'Password updated.' };
  }],

  ['GET', /^\/api\/v1\/batches$/, ({ db }) => ({
    data: [...db.batches]
      .sort((a, b) => a.expires_at.localeCompare(b.expires_at))
      .map((batch) => serializeBatch(db, batch)),
  })],

  ['POST', /^\/api\/v1\/batches$/, async ({ db, body }) => {
    const expiresAt = field(body, 'expires_at');
    const barcode = field(body, 'barcode');
    const name = field(body, 'name');
    const photo = field(body, 'photo');
    const quantityInput = field(body, 'quantity');
    const quantity = quantityInput === undefined ? 1 : validQuantity(quantityInput);

    if (quantity === null) throw validationError('quantity', 'The quantity field must be at least 1.');
    if (!validDate(expiresAt)) throw validationError('expires_at', 'The expires at field must be a valid date.');
    if (isBeforeToday(expiresAt)) {
      throw validationError('expires_at', 'The expires at field must be a date after or equal to today.');
    }
    if (!barcode && !name) throw validationError('name', 'The name field is required when barcode is not present.');

    let productId: number;
    if (typeof barcode === 'string') {
      const cached = db.products.find((product) => product.barcode === barcode);
      const known = DEMO_CATALOG.find((item) => item.barcode === barcode);
      if (cached) {
        productId = cached.id;
      } else if (known) {
        productId = db.next_product_id++;
        db.products.push({ id: productId, name: known.name, barcode, photo_url: null });
      } else {
        throw new ApiError(422, 'Product not found for this barcode.', { message: 'Product not found for this barcode.' });
      }
    } else {
      productId = db.next_product_id++;
      db.products.push({
        id: productId,
        name: String(name).trim(),
        barcode: null,
        photo_url: photo instanceof File ? await fileToDataUrl(photo) : null,
      });
    }

    const at = nowIso();
    const batch: DemoBatch = {
      id: db.next_batch_id++,
      product_id: productId,
      quantity,
      expires_at: expiresAt,
      status: 'active',
      created_at: at,
      updated_at: at,
      created_by: db.me_id,
      updated_by: db.me_id,
    };
    db.batches.push(batch);
    return { data: serializeBatch(db, batch) };
  }],

  ['GET', /^\/api\/v1\/batches\/(\d+)$/, ({ db, params }) => ({ data: serializeBatch(db, findBatch(db, params[0])) })],

  ['PATCH', /^\/api\/v1\/batches\/(\d+)$/, ({ db, params, body }) => {
    const batch = findBatch(db, params[0]);
    const quantity = field(body, 'quantity');
    const expiresAt = field(body, 'expires_at');
    const status = field(body, 'status');

    if (quantity !== undefined && validQuantity(quantity) === null) {
      throw validationError('quantity', 'The quantity field must be at least 1.');
    }
    if (expiresAt !== undefined && (!validDate(expiresAt) || isBeforeToday(expiresAt))) {
      throw validationError('expires_at', 'The expires at field must be a date after or equal to today.');
    }
    if (status !== undefined && !['active', 'consumed', 'discarded'].includes(String(status))) {
      throw validationError('status', 'The selected status is invalid.');
    }

    if (quantity !== undefined) batch.quantity = validQuantity(quantity)!;
    if (expiresAt !== undefined) batch.expires_at = expiresAt as string;
    if (status !== undefined) batch.status = status as DemoBatch['status'];
    touch(batch, db);
    return { data: serializeBatch(db, batch) };
  }],

  ['DELETE', /^\/api\/v1\/batches\/(\d+)$/, ({ db, params }) => {
    const batch = findBatch(db, params[0]);
    db.batches = db.batches.filter((item) => item.id !== batch.id);
    return '';
  }],

  ['GET', /^\/api\/v1\/openfoodfacts\/(.+)$/, ({ params }) => {
    const barcode = decodeURIComponent(params[0]);
    const known = DEMO_CATALOG.find((item) => item.barcode === barcode);
    return { name: known?.name ?? null, photo_url: null, barcode };
  }],

  ['PATCH', /^\/api\/v1\/products\/(\d+)$/, async ({ db, params, body }) => {
    const product = db.products.find((item) => item.id === Number(params[0]));
    if (!product) throw notFound();
    const name = field(body, 'name');
    const photo = field(body, 'photo');
    if (typeof name === 'string' && name.trim() !== '') product.name = name.trim();
    if (photo instanceof File) product.photo_url = await fileToDataUrl(photo);
    return { data: product };
  }],

  ['PATCH', /^\/api\/v1\/households\/(\d+)$/, ({ db, params, body }) => {
    assertHousehold(db, params[0]);
    const name = field(body, 'name');
    if (typeof name !== 'string' || name.trim().length < 2) {
      throw validationError('name', 'The name field must be at least 2 characters.');
    }
    db.household.name = name.trim();
    return { message: 'Household updated.', household: { ...db.household } };
  }],

  ['GET', /^\/api\/v1\/households\/(\d+)\/members$/, ({ db, params }) => {
    assertHousehold(db, params[0]);
    return { data: serializeMembers(db, (userId) => operationsCount(db, userId)) };
  }],

  ['GET', /^\/api\/v1\/households\/(\d+)\/actors$/, ({ db, params }) => {
    assertHousehold(db, params[0]);
    const memberIds = db.memberships.map((membership) => membership.user_id);
    const operatorIds = db.batches.flatMap((batch) => [batch.created_by, batch.updated_by]);
    const ids = new Set([...memberIds, ...operatorIds].filter((id): id is number => id !== null));
    return {
      data: db.users
        .filter((user) => ids.has(user.id))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((user) => ({ id: user.id, name: user.name, is_member: memberIds.includes(user.id) })),
    };
  }],

  ['GET', /^\/api\/v1\/households\/(\d+)\/activities$/, ({ db, params, query }) => {
    assertHousehold(db, params[0]);
    const userId = query.get('user_id') ? Number(query.get('user_id')) : null;
    const action = query.get('action');
    const status = query.get('status');
    const search = query.get('search')?.toLocaleLowerCase('pt-BR');

    const rows = db.batches
      .filter((batch) => userId === null || batch.created_by === userId || batch.updated_by === userId)
      .filter((batch) => action !== 'created' || batch.created_by !== null)
      .filter((batch) => action !== 'updated' || (batch.updated_by !== null && batch.updated_by !== batch.created_by))
      .filter((batch) => !status || batch.status === status)
      .filter((batch) => {
        if (!search) return true;
        const product = db.products.find((item) => item.id === batch.product_id)!;
        return product.name.toLocaleLowerCase('pt-BR').includes(search);
      })
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

    return {
      data: rows.map((batch) => {
        const full = serializeBatch(db, batch);
        return {
          batch_id: full.id,
          product_name: full.product.name,
          quantity: full.quantity,
          expires_at: full.expires_at,
          status: full.status,
          created_at: full.created_at,
          updated_at: full.updated_at,
          created_by: full.created_by,
          updated_by: full.updated_by,
        };
      }),
    };
  }],

  ['DELETE', /^\/api\/v1\/households\/(\d+)\/members\/(\d+)$/, ({ db, params }) => {
    assertHousehold(db, params[0]);
    const membership = db.memberships.find((item) => item.user_id === Number(params[1]));
    if (!membership) throw notFound();
    if (membership.role === 'owner') {
      throw new ApiError(422, 'The owner cannot be removed.', { message: 'The owner cannot be removed.' });
    }
    db.memberships = db.memberships.filter((item) => item !== membership);
    return { message: 'Member removed.' };
  }],

  ['PATCH', /^\/api\/v1\/households\/(\d+)\/members\/(\d+)\/role$/, ({ db, params, body }) => {
    assertHousehold(db, params[0]);
    const membership = db.memberships.find((item) => item.user_id === Number(params[1]));
    if (!membership) throw notFound();
    const role = field(body, 'role');
    if (role !== 'manager' && role !== 'member') throw validationError('role', 'The selected role is invalid.');
    if (membership.role === 'owner') {
      throw new ApiError(422, 'The owner role cannot be changed.', { message: 'The owner role cannot be changed.' });
    }
    membership.role = role;
    return { message: 'Member role updated.', member: { id: membership.user_id, role } };
  }],

  ['POST', /^\/api\/v1\/households\/(\d+)\/invitations$/, ({ db, params, body }) => {
    assertHousehold(db, params[0]);
    const email = field(body, 'email');
    if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
      throw validationError('email', 'The email field must be a valid email address.');
    }
    return {
      message: 'Invitation created.',
      invitation: {
        token: 'demo',
        email,
        household_name: db.household.name,
        invite_url: `${window.location.origin}/invite/demo`,
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      },
    };
  }],

  ['POST', /^\/api\/v1\/telegram\/link$/, async ({ db }) => {
    const res = await realRequest<{ data: { start_command: string } }>('/api/v1/telegram/demo-link', 'POST');
    db.telegram.pending_token = res.data.start_command.replace(/^\/start\s+/, '');
    return res;
  }],

  ['DELETE', /^\/api\/v1\/telegram\/link$/, ({ db }) => {
    db.telegram = { chat_id: null, chat_name: null, pending_token: null };
    return { message: 'Telegram account unlinked.' };
  }],
];

export async function handleDemoRequest<T>(url: string, options: DemoRequestOptions = {}): Promise<T> {
  const db = readDemoDb<DemoDb>();
  if (!db) {
    throw new ApiError(401, 'Unauthenticated.', { message: 'Unauthenticated.' });
  }

  const method = (options.method ?? 'GET').toUpperCase();
  const parsed = new URL(url, window.location.origin);

  for (const [routeMethod, pattern, handler] of routes) {
    const match = routeMethod === method ? pattern.exec(parsed.pathname) : null;
    if (!match) continue;

    await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
    const result = await handler({ db, params: match.slice(1), query: parsed.searchParams, body: options.body });
    // Logout clears the database; everything else persists its changes.
    if (!(method === 'POST' && parsed.pathname === '/api/v1/logout')) {
      writeDemoDb(db);
    }
    return result as T;
  }

  throw new ApiError(404, 'Não disponível no modo demonstração.', { message: 'Não disponível no modo demonstração.' });
}
