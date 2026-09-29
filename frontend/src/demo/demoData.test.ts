import { describe, it, expect } from 'vitest';
import { buildDemoDb, DEMO_ME_ID, DEMO_OPERATION_COUNT, DemoDb } from './demoData';
import { expiryTone } from '@/utils/expiry';

const MEMBER_ACTIONS = ['household_renamed', 'member_invited', 'member_joined', 'member_removed', 'member_role_changed'];

/** The pantry operations (what the 100 are about), without member events. */
function batchMovements(db: DemoDb) {
  return db.movements.filter((movement) => !MEMBER_ACTIONS.includes(movement.action));
}

// Opening the demo on any day must show the same picture relative to that day.
const OPENED_AT = [
  new Date(),
  new Date(2026, 8, 29, 10, 30),
  new Date(2027, 2, 15, 8, 0),
  new Date(2030, 11, 31, 23, 50),
  new Date(2031, 0, 1, 0, 5),
];

describe('buildDemoDb', () => {
  it.each(OPENED_AT)('keeps 10%% expired, 40%% within 3 days and 50%% later (opened %s)', (now) => {
    const db = buildDemoDb(now);
    const active = db.batches.filter((batch) => batch.status === 'active');
    const tones = active.map((batch) => expiryTone(batch.expires_at, now));

    expect(active).toHaveLength(40);
    expect(tones.filter((tone) => tone === 'overdue')).toHaveLength(4);
    expect(tones.filter((tone) => tone === 'soon')).toHaveLength(16);
    expect(tones.filter((tone) => tone === 'ok')).toHaveLength(20);
  });

  it.each(OPENED_AT)('never dates anything in the future (opened %s)', (now) => {
    const db = buildDemoDb(now);
    const times = [
      ...db.movements.map((movement) => movement.created_at),
      ...db.batches.flatMap((batch) => [batch.created_at, batch.updated_at]),
      ...db.memberships.map((membership) => membership.joined_at),
    ];

    for (const at of times) {
      expect(new Date(at).getTime()).toBeLessThanOrEqual(now.getTime());
    }
    for (const batch of db.batches) {
      expect(new Date(batch.created_at).getTime()).toBeLessThanOrEqual(new Date(batch.updated_at).getTime());
    }
  });

  it('holds on every day of a year, at any hour', () => {
    for (let day = 0; day < 366; day++) {
      const now = new Date(2027, 0, 1 + day, day % 24, (day * 7) % 60);
      const db = buildDemoDb(now);
      const tones = db.batches
        .filter((batch) => batch.status === 'active')
        .map((batch) => expiryTone(batch.expires_at, now));

      expect([
        tones.filter((tone) => tone === 'overdue').length,
        tones.filter((tone) => tone === 'soon').length,
        tones.filter((tone) => tone === 'ok').length,
      ]).toEqual([4, 16, 20]);
      expect(db.movements.every((movement) => new Date(movement.created_at).getTime() <= now.getTime())).toBe(true);
    }
  });

  it('happens mostly in the daytime, and spreads over the month', () => {
    const db = buildDemoDb(new Date(2026, 8, 29, 1, 20));
    const hours = db.movements.map((movement) => new Date(movement.created_at).getHours());
    const days = new Set(db.movements.map((movement) => movement.created_at.slice(0, 10)));

    expect(hours.filter((hour) => hour < 7 || hour > 22).length).toBeLessThanOrEqual(3);
    expect(days.size).toBeGreaterThanOrEqual(20);
  });

  it('has 100 pantry operations of every kind, spread over the five people', () => {
    const db = buildDemoDb(new Date(2026, 8, 29, 10, 30));
    const operations = batchMovements(db);
    const byAction = (action: string) => operations.filter((movement) => movement.action === action);
    const partial = byAction('consumed').filter((movement) => movement.changes?.quantity);

    expect(operations).toHaveLength(DEMO_OPERATION_COUNT);
    expect(byAction('created')).toHaveLength(62);
    expect(byAction('updated')).toHaveLength(8);
    expect(byAction('consumed')).toHaveLength(20);
    expect(partial).toHaveLength(8);
    expect(byAction('discarded')).toHaveLength(6);
    expect(byAction('deleted')).toHaveLength(4);

    for (const user of db.users) {
      expect(operations.filter((movement) => movement.user_id === user.id).length).toBeGreaterThanOrEqual(10);
    }

    // Ids grow with time, like the auto-increment column.
    const byTime = [...db.movements].sort((a, b) => a.created_at.localeCompare(b.created_at));
    expect(db.movements.map((movement) => movement.id)).toEqual(byTime.map((movement) => movement.id));
  });

  it('records what changed in every edit, partial consumption and deletion', () => {
    const db = buildDemoDb(new Date(2026, 8, 29, 10, 30));

    for (const movement of batchMovements(db)) {
      expect(movement.product_name).toBeTruthy();
      expect(movement.changes).not.toBeNull();
      for (const change of Object.values(movement.changes!)) {
        expect(change.from).not.toBe(change.to);
      }
      if (movement.action !== 'updated') {
        expect(movement.quantity).toBeGreaterThan(0);
      }
    }

    for (const movement of batchMovements(db).filter((m) => m.action === 'consumed' && m.changes?.quantity)) {
      const { from, to } = movement.changes!.quantity;
      expect(Number(from) - Number(to)).toBe(movement.quantity);
    }
  });

  it('replays the history like the API: deleted batches are gone, statuses applied', () => {
    const db = buildDemoDb(new Date(2026, 8, 29, 10, 30));
    const deleted = db.movements.filter((movement) => movement.action === 'deleted').map((movement) => movement.batch_id);
    const ids = db.batches.map((batch) => batch.id);

    expect(db.batches).toHaveLength(58);
    expect(new Set(ids).size).toBe(ids.length);
    expect(deleted.every((id) => !ids.includes(id!))).toBe(true);
    expect(db.batches.filter((batch) => batch.status === 'consumed')).toHaveLength(12);
    expect(db.batches.filter((batch) => batch.status === 'discarded')).toHaveLength(6);
  });

  it('has the members joining and the manager promoted by the owner', () => {
    const db = buildDemoDb(new Date(2026, 8, 29, 10, 30));
    const events = db.movements.filter((movement) => MEMBER_ACTIONS.includes(movement.action));

    expect(events.filter((movement) => movement.action === 'member_joined')).toHaveLength(4);
    const promotion = events.find((movement) => movement.action === 'member_role_changed');
    expect(promotion?.user_id).toBe(DEMO_ME_ID);
    expect(promotion?.changes?.role).toEqual({ from: 'member', to: 'manager' });
  });

  it('has one owner (the test account), one manager and three members', () => {
    const db = buildDemoDb();
    const roles = db.memberships.map((membership) => membership.role).sort();

    expect(roles).toEqual(['manager', 'member', 'member', 'member', 'owner']);
    expect(db.memberships.find((membership) => membership.role === 'owner')?.user_id).toBe(DEMO_ME_ID);
    expect(db.users.find((user) => user.id === DEMO_ME_ID)?.name).toBe('Teste');
  });

  it('tells the same story for everyone', () => {
    const now = new Date(2027, 2, 15, 8, 0);
    expect(buildDemoDb(now)).toEqual(buildDemoDb(now));
  });
});
