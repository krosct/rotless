import { addDays, differenceInCalendarDays, differenceInHours, format, parseISO, startOfDay, startOfWeek } from 'date-fns';
import { ApiError } from '@/api/client';
import { clearDemoDb, readDemoDb, writeDemoDb } from './session';
import { buildDemoDb, DEMO_CATALOG, DemoBatch, DemoDb, DemoMovement } from './demoData';
import type { HouseholdReport, MovementAction, MovementChange } from '@/types';

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
  return db.movements.filter((movement) => movement.user_id === userId).length;
}

const MEMBER_ACTIONS: MovementAction[] = [
  'household_renamed',
  'member_invited',
  'member_joined',
  'member_removed',
  'member_role_changed',
];

type Changes = Record<string, [string | number | null, string | number | null]>;

function formatChanges(changes: Changes): Record<string, MovementChange> | null {
  const result: Record<string, MovementChange> = {};
  for (const [field, [from, to]] of Object.entries(changes)) {
    if (from !== to) result[field] = { from, to };
  }
  return Object.keys(result).length === 0 ? null : result;
}

// Same as HouseholdMovement::forBatch / forHousehold.
function record(
  db: DemoDb,
  movement: Omit<DemoMovement, 'id' | 'created_at' | 'changes' | 'user_id'> & { changes?: Changes }
): void {
  db.movements.push({
    ...movement,
    id: db.next_movement_id++,
    created_at: nowIso(),
    user_id: db.me_id,
    changes: formatChanges(movement.changes ?? {}),
  });
}

function recordBatch(db: DemoDb, batch: DemoBatch, action: MovementAction, quantity: number | null, changes: Changes): void {
  const product = db.products.find((item) => item.id === batch.product_id)!;
  record(db, { action, batch_id: batch.id, product_name: product.name, quantity, subject_user_id: null, changes });
}

function recordHousehold(db: DemoDb, action: MovementAction, subjectId: number | null, changes: Changes = {}): void {
  record(db, { action, batch_id: null, product_name: null, quantity: null, subject_user_id: subjectId, changes });
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
  const created = (userId: number) => operationsCount(db, userId);
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

// Shown to demo visitors instead of raw HTTP errors.
const SERVER_UNAVAILABLE =
  'O servidor do rotless não respondeu. A mensagem de demonstração do Telegram precisa do servidor no ar.';
const BOT_UNAVAILABLE = 'O bot do Telegram não está disponível agora. Tente novamente em alguns minutos.';
const TOO_MANY_REQUESTS = 'Muitas tentativas seguidas. Aguarde um minuto e tente novamente.';

async function realRequest<T>(url: string, method: 'GET' | 'POST'): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { method, headers: { Accept: 'application/json' } });
  } catch {
    throw new ApiError(0, SERVER_UNAVAILABLE);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    // 503 is the API saying the bot is unreachable; other 5xx (502/504) come
    // from a proxy with no API behind it.
    const message =
      response.status === 503
        ? BOT_UNAVAILABLE
        : response.status === 429
        ? TOO_MANY_REQUESTS
        : response.status >= 500
        ? SERVER_UNAVAILABLE
        : (data as { message?: string } | null)?.message ?? SERVER_UNAVAILABLE;
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

// --- Reports (same rules as ReportController) ---------------------------------

function totalsOf(movements: DemoMovement[]) {
  const units = (action: MovementAction) =>
    movements.filter((movement) => movement.action === action).reduce((sum, movement) => sum + (movement.quantity ?? 0), 0);
  const consumed = units('consumed');
  const discarded = units('discarded');
  return {
    added_units: units('created'),
    consumed_units: consumed,
    discarded_units: discarded,
    use_rate: consumed + discarded === 0 ? null : Math.round((consumed / (consumed + discarded)) * 10000) / 10000,
  };
}

function productItems(movements: DemoMovement[], action: MovementAction, limit: number) {
  const byName = new Map<string, number>();
  for (const movement of movements) {
    if (movement.action !== action || !movement.product_name) continue;
    byName.set(movement.product_name, (byName.get(movement.product_name) ?? 0) + (movement.quantity ?? 0));
  }
  return [...byName.entries()]
    .map(([product_name, units]) => ({ product_name, units }))
    .sort((a, b) => b.units - a.units)
    .slice(0, limit);
}

function medianOf(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return Math.round(median * 10) / 10;
}

function topProducts(movements: DemoMovement[], action: MovementAction) {
  const byName = new Map<string, { units: number; events: number; last: string }>();
  for (const movement of movements) {
    if (movement.action !== action || !movement.product_name) continue;
    const entry = byName.get(movement.product_name) ?? { units: 0, events: 0, last: movement.created_at };
    entry.units += movement.quantity ?? 0;
    entry.events += 1;
    if (movement.created_at > entry.last) entry.last = movement.created_at;
    byName.set(movement.product_name, entry);
  }
  return [...byName.entries()]
    .map(([product_name, entry]) => ({
      product_name,
      units: entry.units,
      events: entry.events,
      last_at: format(parseISO(entry.last), 'yyyy-MM-dd'),
    }))
    .sort((a, b) => b.units - a.units)
    .slice(0, 20);
}

export function buildReport(db: DemoDb, days: 7 | 30 | 90, now: Date = new Date()): HouseholdReport {
  const today = startOfDay(now);
  const start = addDays(today, -(days - 1));
  const previousStart = addDays(start, -days);
  const bucket = days === 90 ? 'week' : 'day';

  const inWindow = db.movements.filter((movement) => new Date(movement.created_at) >= previousStart);
  const current = inWindow.filter((movement) => new Date(movement.created_at) >= start);
  const previous = inWindow.filter((movement) => new Date(movement.created_at) < start);

  const keyOf = (date: Date) => format(bucket === 'week' ? startOfWeek(date, { weekStartsOn: 1 }) : date, 'yyyy-MM-dd');
  const byBucket = new Map<string, DemoMovement[]>();
  for (const movement of current) {
    const key = keyOf(new Date(movement.created_at));
    byBucket.set(key, [...(byBucket.get(key) ?? []), movement]);
  }
  const points = new Map<
    string,
    {
      date: string;
      consumed: number;
      discarded: number;
      added: number;
      use_rate: number | null;
      consumed_items: { product_name: string; units: number }[];
      discarded_items: { product_name: string; units: number }[];
    }
  >();
  for (
    let cursor = bucket === 'week' ? startOfWeek(start, { weekStartsOn: 1 }) : start;
    cursor <= today;
    cursor = addDays(cursor, bucket === 'week' ? 7 : 1)
  ) {
    const key = format(cursor, 'yyyy-MM-dd');
    const inBucket = byBucket.get(key) ?? [];
    const units = (action: MovementAction) =>
      inBucket.filter((movement) => movement.action === action).reduce((sum, movement) => sum + (movement.quantity ?? 0), 0);
    const consumed = units('consumed');
    const discarded = units('discarded');
    points.set(key, {
      date: key,
      consumed,
      discarded,
      added: units('created'),
      use_rate: consumed + discarded === 0 ? null : Math.round((consumed / (consumed + discarded)) * 10000) / 10000,
      consumed_items: productItems(inBucket, 'consumed', 3),
      discarded_items: productItems(inBucket, 'discarded', 3),
    });
  }

  const createdAt = new Map(db.batches.map((batch) => [batch.id, batch.created_at]));
  const spans = current
    .filter((movement) => movement.action === 'consumed' && movement.batch_id !== null && createdAt.has(movement.batch_id))
    .map((movement) => Math.max(0, differenceInHours(new Date(movement.created_at), new Date(createdAt.get(movement.batch_id!)!))) / 24);

  const memberIds = db.memberships.map((membership) => membership.user_id);
  const ids = new Set([...memberIds, ...current.map((movement) => movement.user_id).filter((id): id is number => id !== null)]);
  const members = db.users
    .filter((user) => ids.has(user.id))
    .map((user) => {
      const own = current.filter((movement) => movement.user_id === user.id);
      const count = (action: MovementAction) => own.filter((movement) => movement.action === action).length;
      const added = count('created');
      const consumed = count('consumed');
      const discarded = count('discarded');
      return {
        user: { id: user.id, name: user.name },
        is_member: memberIds.includes(user.id),
        added,
        consumed,
        discarded,
        other: own.length - added - consumed - discarded,
        total: own.length,
      };
    })
    .sort((a, b) => b.total - a.total);

  return {
    period: { days, from: format(start, 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd'), timezone: 'local', bucket },
    totals: {
      ...totalsOf(current),
      operations: current.length,
      avg_days_to_consume: spans.length === 0 ? null : Math.round((spans.reduce((a, b) => a + b, 0) / spans.length) * 10) / 10,
      median_days_to_consume: medianOf(spans),
    },
    previous: totalsOf(previous),
    timeline: [...points.values()],
    top_consumed: topProducts(current, 'consumed'),
    top_discarded: topProducts(current, 'discarded'),
    members,
  };
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
    recordBatch(db, batch, 'created', quantity, { quantity: [null, quantity], expires_at: [null, expiresAt] });
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

    const before = { quantity: batch.quantity, expires_at: batch.expires_at, status: batch.status };
    if (quantity !== undefined) batch.quantity = validQuantity(quantity)!;
    if (expiresAt !== undefined) batch.expires_at = expiresAt as string;
    if (status !== undefined) batch.status = status as DemoBatch['status'];
    touch(batch, db);

    const changes: Changes = {
      quantity: [before.quantity, batch.quantity],
      expires_at: [before.expires_at, batch.expires_at],
      status: [before.status, batch.status],
    };
    if (formatChanges(changes) !== null) {
      const action: MovementAction =
        before.status === 'active' && batch.status === 'consumed'
          ? 'consumed'
          : before.status === 'active' && batch.status === 'discarded'
          ? 'discarded'
          : 'updated';
      recordBatch(db, batch, action, action === 'updated' ? null : batch.quantity, changes);
    }
    return { data: serializeBatch(db, batch) };
  }],

  ['POST', /^\/api\/v1\/batches\/(\d+)\/consume$/, ({ db, params, body }) => {
    const batch = findBatch(db, params[0]);
    const units = validQuantity(field(body, 'quantity'));
    const action = field(body, 'action');
    if (units === null) throw validationError('quantity', 'The quantity field must be at least 1.');
    if (action !== 'consumed' && action !== 'discarded') throw validationError('action', 'The selected action is invalid.');
    if (batch.status !== 'active') throw validationError('action', 'Only active batches can be consumed or discarded.');
    if (units > batch.quantity) throw validationError('quantity', 'The quantity is larger than what is left in this batch.');

    const all = units === batch.quantity;
    const changes: Changes = all
      ? { status: ['active', action] }
      : { quantity: [batch.quantity, batch.quantity - units] };
    if (all) {
      batch.status = action;
    } else {
      batch.quantity -= units;
    }
    touch(batch, db);
    recordBatch(db, batch, action, units, changes);
    return { data: serializeBatch(db, batch) };
  }],

  ['DELETE', /^\/api\/v1\/batches\/(\d+)$/, ({ db, params }) => {
    const batch = findBatch(db, params[0]);
    recordBatch(db, batch, 'deleted', batch.quantity, {
      quantity: [batch.quantity, null],
      expires_at: [batch.expires_at, null],
      status: [batch.status, null],
    });
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
    const before = product.name;
    if (typeof name === 'string' && name.trim() !== '') product.name = name.trim();
    if (photo instanceof File) product.photo_url = await fileToDataUrl(photo);
    const changes: Changes = { name: [before, product.name] };
    if (photo instanceof File) changes.photo = [null, 'updated'];
    if (formatChanges(changes) !== null) {
      record(db, { action: 'product_updated', batch_id: null, product_name: product.name, quantity: null, subject_user_id: null, changes });
    }
    return { data: product };
  }],

  ['PATCH', /^\/api\/v1\/households\/(\d+)$/, ({ db, params, body }) => {
    assertHousehold(db, params[0]);
    const name = field(body, 'name');
    if (typeof name !== 'string' || name.trim().length < 2) {
      throw validationError('name', 'The name field must be at least 2 characters.');
    }
    const before = db.household.name;
    db.household.name = name.trim();
    if (before !== db.household.name) recordHousehold(db, 'household_renamed', null, { name: [before, db.household.name] });
    return { message: 'Household updated.', household: { ...db.household } };
  }],

  ['GET', /^\/api\/v1\/households\/(\d+)\/members$/, ({ db, params }) => {
    assertHousehold(db, params[0]);
    return { data: serializeMembers(db, (userId) => operationsCount(db, userId)) };
  }],

  ['GET', /^\/api\/v1\/households\/(\d+)\/actors$/, ({ db, params }) => {
    assertHousehold(db, params[0]);
    const memberIds = db.memberships.map((membership) => membership.user_id);
    const operatorIds = db.movements.map((movement) => movement.user_id);
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
    const search = query.get('search')?.toLocaleLowerCase('pt-BR');
    const before = query.get('before') ? Number(query.get('before')) : null;
    const limit = Math.min(100, Number(query.get('limit') ?? 50));

    const rows = db.movements
      .filter((movement) => userId === null || movement.user_id === userId)
      .filter((movement) =>
        !action ? true : action === 'members' ? MEMBER_ACTIONS.includes(movement.action) : movement.action === action
      )
      .filter((movement) => !search || (movement.product_name ?? '').toLocaleLowerCase('pt-BR').includes(search))
      .filter((movement) => before === null || movement.id < before)
      .sort((a, b) => b.id - a.id);

    const page = rows.slice(0, limit);
    return {
      data: page.map((movement) => ({
        id: movement.id,
        action: movement.action,
        created_at: movement.created_at,
        user: actor(db, movement.user_id),
        subject: actor(db, movement.subject_user_id),
        batch_id: movement.batch_id,
        product_name: movement.product_name,
        quantity: movement.quantity,
        changes: movement.changes,
      })),
      meta: { next_before: rows.length > limit ? page[page.length - 1].id : null },
    };
  }],

  ['GET', /^\/api\/v1\/households\/(\d+)\/reports$/, ({ db, params, query }) => {
    assertHousehold(db, params[0]);
    const days = Number(query.get('days') ?? 30);
    if (![7, 30, 90].includes(days)) throw validationError('days', 'The selected days is invalid.');
    return { data: buildReport(db, days as 7 | 30 | 90) };
  }],

  ['DELETE', /^\/api\/v1\/households\/(\d+)\/members\/(\d+)$/, ({ db, params }) => {
    assertHousehold(db, params[0]);
    const membership = db.memberships.find((item) => item.user_id === Number(params[1]));
    if (!membership) throw notFound();
    if (membership.role === 'owner') {
      throw new ApiError(422, 'The owner cannot be removed.', { message: 'The owner cannot be removed.' });
    }
    db.memberships = db.memberships.filter((item) => item !== membership);
    recordHousehold(db, 'member_removed', membership.user_id);
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
    const before = membership.role;
    membership.role = role;
    if (before !== role) recordHousehold(db, 'member_role_changed', membership.user_id, { role: [before, role] });
    return { message: 'Member role updated.', member: { id: membership.user_id, role } };
  }],

  ['POST', /^\/api\/v1\/households\/(\d+)\/invitations$/, ({ db, params, body }) => {
    assertHousehold(db, params[0]);
    const email = field(body, 'email');
    if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
      throw validationError('email', 'The email field must be a valid email address.');
    }
    recordHousehold(db, 'member_invited', null, { email: [null, email] });
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
