import { addDays, addMinutes, differenceInCalendarDays, format, startOfDay } from 'date-fns';
import type { BatchStatus, HouseholdRole } from '@/types';

// The demo database: one household with five people and a history of 100
// operations, replayed in order so every batch ends up exactly as the real
// API would leave it (creator, last updater, status, timestamps; deleted
// batches are gone, as in the real system).
//
// Every date is relative to `now` (the moment the demo starts), so the pantry
// looks the same whenever it is opened: of the active batches, 10% expired,
// 40% expire within 3 days and 50% later. A fixed seed makes the story the
// same for everyone.

export interface DemoUser {
  id: number;
  name: string;
  email: string;
}

export interface DemoMembership {
  user_id: number;
  role: HouseholdRole;
  joined_at: string;
}

export interface DemoProduct {
  id: number;
  name: string;
  barcode: string | null;
  photo_url: string | null;
}

export interface DemoBatch {
  id: number;
  product_id: number;
  quantity: number;
  expires_at: string; // YYYY-MM-DD
  status: BatchStatus;
  created_at: string;
  updated_at: string;
  created_by: number | null;
  updated_by: number | null;
}

export type DemoOperationType = 'create' | 'edit' | 'consume_partial' | 'consume' | 'discard' | 'delete';

export interface DemoOperation {
  at: string;
  user_id: number;
  type: DemoOperationType;
  batch_id: number;
}

export interface DemoDb {
  version: 1;
  created_at: string;
  me_id: number;
  household: { id: number; name: string };
  users: DemoUser[];
  memberships: DemoMembership[];
  products: DemoProduct[];
  batches: DemoBatch[];
  operations: DemoOperation[];
  next_batch_id: number;
  next_product_id: number;
  telegram: {
    chat_id: string | null;
    chat_name: string | null;
    pending_token: string | null;
  };
}

// Ids far from real ones, so cached queries of a real account never collide.
const HOUSEHOLD_ID = 900001;
export const DEMO_ME_ID = 900011;

const PEOPLE: { id: number; name: string; email: string; role: HouseholdRole; joinedDaysAgo: number; quota: number }[] = [
  { id: DEMO_ME_ID, name: 'Teste', email: 'teste@demo.rotless', role: 'owner', joinedDaysAgo: 60, quota: 20 },
  { id: 900012, name: 'Marina Costa', email: 'marina@demo.rotless', role: 'manager', joinedDaysAgo: 52, quota: 24 },
  { id: 900013, name: 'Rafael Lima', email: 'rafael@demo.rotless', role: 'member', joinedDaysAgo: 45, quota: 20 },
  { id: 900014, name: 'Júlia Souza', email: 'julia@demo.rotless', role: 'member', joinedDaysAgo: 41, quota: 19 },
  { id: 900015, name: 'Pedro Alves', email: 'pedro@demo.rotless', role: 'member', joinedDaysAgo: 38, quota: 17 },
];

interface CatalogItem {
  name: string;
  barcode: string | null;
  shelfDays: number;
  qty: [number, number];
}

// Barcodes are fictitious; the demo barcode lookup answers from this list.
export const DEMO_CATALOG: CatalogItem[] = [
  { name: 'Leite integral 1L', barcode: '7890000000011', shelfDays: 7, qty: [2, 6] },
  { name: 'Iogurte natural', barcode: '7890000000028', shelfDays: 10, qty: [2, 6] },
  { name: 'Queijo muçarela fatiado', barcode: '7890000000035', shelfDays: 12, qty: [1, 2] },
  { name: 'Presunto fatiado', barcode: '7890000000042', shelfDays: 6, qty: [1, 2] },
  { name: 'Requeijão cremoso', barcode: '7890000000059', shelfDays: 20, qty: [1, 2] },
  { name: 'Manteiga com sal', barcode: '7890000000066', shelfDays: 45, qty: [1, 2] },
  { name: 'Queijo minas frescal', barcode: '7890000000073', shelfDays: 10, qty: [1, 2] },
  { name: 'Peito de peru defumado', barcode: '7890000000080', shelfDays: 8, qty: [1, 2] },
  { name: 'Pão de forma integral', barcode: '7890000000097', shelfDays: 7, qty: [1, 2] },
  { name: 'Suco de laranja integral', barcode: '7890000000103', shelfDays: 5, qty: [1, 3] },
  { name: 'Creme de leite', barcode: '7890000000110', shelfDays: 90, qty: [1, 4] },
  { name: 'Molho de tomate', barcode: '7890000000127', shelfDays: 120, qty: [1, 4] },
  { name: 'Salsicha', barcode: '7890000000134', shelfDays: 15, qty: [1, 2] },
  { name: 'Ovos (dúzia)', barcode: null, shelfDays: 21, qty: [1, 2] },
  { name: 'Peito de frango', barcode: null, shelfDays: 3, qty: [1, 3] },
  { name: 'Carne moída', barcode: null, shelfDays: 2, qty: [1, 2] },
  { name: 'Filé de tilápia', barcode: null, shelfDays: 3, qty: [1, 2] },
  { name: 'Alface crespa', barcode: null, shelfDays: 4, qty: [1, 2] },
  { name: 'Tomate italiano', barcode: null, shelfDays: 7, qty: [3, 8] },
  { name: 'Banana prata', barcode: null, shelfDays: 6, qty: [4, 10] },
  { name: 'Maçã gala', barcode: null, shelfDays: 20, qty: [3, 8] },
  { name: 'Morango (bandeja)', barcode: null, shelfDays: 4, qty: [1, 2] },
  { name: 'Cenoura', barcode: null, shelfDays: 20, qty: [3, 6] },
  { name: 'Brócolis', barcode: null, shelfDays: 5, qty: [1, 2] },
  { name: 'Pão francês', barcode: null, shelfDays: 2, qty: [4, 10] },
  { name: 'Bolo de cenoura caseiro', barcode: null, shelfDays: 4, qty: [1, 1] },
];

// Final fate of each batch ever created (62 creates). Active: 4 expired
// (10%), 16 within 3 days (40%), 20 later (50%).
type Fate = 'overdue' | 'soon' | 'ok' | 'consumed' | 'discarded' | 'deleted';
const FATE_COUNTS: Record<Fate, number> = { overdue: 4, soon: 16, ok: 20, consumed: 12, discarded: 6, deleted: 4 };
const PARTIAL_CONSUMES = 8;
const EDITS = 8;
// 62 creates + 12 consumes + 6 discards + 4 deletes + 8 partial + 8 edits = 100
export const DEMO_OPERATION_COUNT = 100;

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Plan {
  item: CatalogItem;
  fate: Fate;
  createdAt: Date;
  initialExpiry: Date;
  finalExpiry: Date;
  initialQty: number;
  finalQty: number;
  ops: { type: Exclude<DemoOperationType, 'create'>; at: Date }[];
}

export function buildDemoDb(now: Date = new Date()): DemoDb {
  const random = mulberry32(20260929);
  const int = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  const pick = <T,>(list: T[]): T => list[Math.floor(random() * list.length)];
  const shuffle = <T,>(list: T[]): T[] => {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const today = startOfDay(now);
  const latest = addMinutes(now, -2);
  // A time of day on `day` (7h-22h), never later than a couple of minutes ago.
  const timeOn = (day: Date): Date => {
    const at = addMinutes(startOfDay(day), int(7 * 60, 22 * 60));
    return at > latest ? addMinutes(latest, -int(3, 120)) : at;
  };
  // A moment between `from` and `to`, never in the future. When `from` itself
  // is too recent, it is squeezed to "just now" (still after the batch was
  // created, which is never later than `latest`).
  const between = (from: Date, to: Date): Date => {
    const end = to > latest ? latest : to;
    const start = from > end ? end : from;
    const span = Math.floor((end.getTime() - start.getTime()) / 60000);
    return addMinutes(start, span > 0 ? int(1, span) : 0);
  };

  const perishable = DEMO_CATALOG.filter((item) => item.shelfDays <= 21);
  const lasting = DEMO_CATALOG.filter((item) => item.shelfDays >= 7);

  const fates = shuffle(
    (Object.keys(FATE_COUNTS) as Fate[]).flatMap((fate) => Array<Fate>(FATE_COUNTS[fate]).fill(fate))
  );
  const soonDays = shuffle([0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3]);
  const overdueDays = shuffle([1, 2, 3, 5]);

  const plans: Plan[] = fates.map((fate) => {
    const item = pick(fate === 'ok' ? lasting : fate === 'overdue' || fate === 'soon' ? perishable : DEMO_CATALOG);

    let expiry: Date;
    switch (fate) {
      case 'overdue':
        expiry = addDays(today, -overdueDays.pop()!);
        break;
      case 'soon':
        expiry = addDays(today, soonDays.pop()!);
        break;
      case 'ok':
        expiry = addDays(today, int(4, Math.max(8, Math.min(item.shelfDays, 90))));
        break;
      case 'discarded':
        expiry = addDays(today, -int(0, 8));
        break;
      case 'consumed':
        expiry = addDays(today, int(-10, Math.min(item.shelfDays, 30)));
        break;
      default:
        expiry = addDays(today, int(1, Math.min(item.shelfDays, 30)));
    }

    // Bought some days before it expires, within the last 35 days.
    const lastPossible = expiry < today ? addDays(expiry, -1) : today;
    let createdDay = addDays(lastPossible, -int(0, Math.min(item.shelfDays, 20)));
    if (differenceInCalendarDays(today, createdDay) > 35) {
      createdDay = addDays(today, -35);
    }
    const createdAt = timeOn(createdDay);
    const qty = int(item.qty[0], item.qty[1]);

    const plan: Plan = {
      item,
      fate,
      createdAt,
      initialExpiry: expiry,
      finalExpiry: expiry,
      initialQty: qty,
      finalQty: qty,
      ops: [],
    };

    if (fate === 'consumed') {
      plan.ops.push({ type: 'consume', at: between(addMinutes(createdAt, 60), addDays(expiry, 1)) });
    } else if (fate === 'discarded') {
      const from = expiry > createdAt ? timeOn(expiry) : createdAt;
      plan.ops.push({ type: 'discard', at: between(from < createdAt ? createdAt : from, latest) });
    } else if (fate === 'deleted') {
      // Registered by mistake and removed right after.
      plan.ops.push({ type: 'delete', at: between(createdAt, addMinutes(createdAt, 90)) });
    }
    return plan;
  });

  // Partial consumption and edits go to distinct active batches.
  const active = shuffle(plans.filter((plan) => ['overdue', 'soon', 'ok'].includes(plan.fate)));
  for (const plan of active.slice(0, PARTIAL_CONSUMES)) {
    plan.initialQty = Math.max(plan.initialQty, 2) + 1;
    plan.finalQty = plan.initialQty - int(1, plan.initialQty - 1);
    plan.ops.push({ type: 'consume_partial', at: between(addMinutes(plan.createdAt, 30), latest) });
  }
  for (const plan of active.slice(PARTIAL_CONSUMES, PARTIAL_CONSUMES + EDITS)) {
    if (random() < 0.5) {
      // Typed a later date, then corrected it.
      plan.initialExpiry = addDays(plan.finalExpiry, int(1, 3));
    } else {
      plan.initialQty = plan.finalQty + 1;
    }
    plan.ops.push({ type: 'edit', at: between(plan.createdAt, addDays(plan.createdAt, 2)) });
  }

  // Ids follow creation order, like an auto-increment column.
  plans.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const products: DemoProduct[] = [];
  const productIdByName = new Map<string, number>();
  let nextProductId = 900101;
  const productFor = (item: CatalogItem): number => {
    const existing = productIdByName.get(item.name);
    if (existing !== undefined) return existing;
    const id = nextProductId++;
    products.push({ id, name: item.name, barcode: item.barcode, photo_url: null });
    productIdByName.set(item.name, id);
    return id;
  };

  // Who does what: a shuffled pool with each person's share of the 100.
  const actors = shuffle(PEOPLE.flatMap((person) => Array<number>(person.quota).fill(person.id)));

  interface Event extends DemoOperation {
    plan: Plan;
    when: Date;
  }
  const events: Event[] = [];
  let nextBatchId = 900201;
  for (const plan of plans) {
    const batchId = nextBatchId++;
    const creator = actors.pop()!;
    events.push({ at: '', when: plan.createdAt, user_id: creator, type: 'create', batch_id: batchId, plan });
    for (const op of plan.ops) {
      // Removing a batch registered by mistake is done by whoever created it.
      const actor = op.type === 'delete' ? creator : actors.pop() ?? creator;
      events.push({ at: '', when: op.at, user_id: actor, type: op.type, batch_id: batchId, plan });
    }
  }
  events.sort((a, b) => a.when.getTime() - b.when.getTime());

  // Replay, as the API would have applied each request.
  const batches = new Map<number, DemoBatch>();
  const operations: DemoOperation[] = [];
  for (const event of events) {
    const at = event.when.toISOString();
    const { plan } = event;
    operations.push({ at, user_id: event.user_id, type: event.type, batch_id: event.batch_id });

    if (event.type === 'create') {
      batches.set(event.batch_id, {
        id: event.batch_id,
        product_id: productFor(plan.item),
        quantity: plan.initialQty,
        expires_at: format(plan.initialExpiry, 'yyyy-MM-dd'),
        status: 'active',
        created_at: at,
        updated_at: at,
        created_by: event.user_id,
        updated_by: event.user_id,
      });
      continue;
    }

    const batch = batches.get(event.batch_id);
    if (!batch) continue;
    if (event.type === 'delete') {
      batches.delete(event.batch_id);
      continue;
    }
    if (event.type === 'edit') {
      batch.expires_at = format(plan.finalExpiry, 'yyyy-MM-dd');
      batch.quantity = plan.finalQty;
    } else if (event.type === 'consume_partial') {
      batch.quantity = plan.finalQty;
    } else {
      batch.status = event.type === 'consume' ? 'consumed' : 'discarded';
    }
    batch.updated_at = at;
    batch.updated_by = event.user_id;
  }

  return {
    version: 1,
    created_at: now.toISOString(),
    me_id: DEMO_ME_ID,
    household: { id: HOUSEHOLD_ID, name: 'Casa Girassol' },
    users: PEOPLE.map(({ id, name, email }) => ({ id, name, email })),
    memberships: PEOPLE.map((person) => ({
      user_id: person.id,
      role: person.role,
      joined_at: timeOn(addDays(today, -person.joinedDaysAgo)).toISOString(),
    })),
    products,
    batches: [...batches.values()],
    operations,
    next_batch_id: nextBatchId,
    next_product_id: nextProductId,
    telegram: { chat_id: null, chat_name: null, pending_token: null },
  };
}
