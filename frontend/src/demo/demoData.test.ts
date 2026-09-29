import { describe, it, expect } from 'vitest';
import { buildDemoDb, DEMO_ME_ID, DEMO_OPERATION_COUNT } from './demoData';
import { expiryTone } from '@/utils/expiry';

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
      ...db.operations.map((op) => op.at),
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
      expect(db.operations.every((op) => new Date(op.at).getTime() <= now.getTime())).toBe(true);
    }
  });

  it('has 100 operations of every kind, spread over the five people', () => {
    const db = buildDemoDb(new Date(2026, 8, 29, 10, 30));
    const byType = (type: string) => db.operations.filter((op) => op.type === type).length;

    expect(db.operations).toHaveLength(DEMO_OPERATION_COUNT);
    expect(byType('create')).toBe(62);
    expect(byType('edit')).toBe(8);
    expect(byType('consume_partial')).toBe(8);
    expect(byType('consume')).toBe(12);
    expect(byType('discard')).toBe(6);
    expect(byType('delete')).toBe(4);

    for (const user of db.users) {
      expect(db.operations.filter((op) => op.user_id === user.id).length).toBeGreaterThanOrEqual(10);
    }

    const sorted = [...db.operations].sort((a, b) => a.at.localeCompare(b.at));
    expect(db.operations).toEqual(sorted);
  });

  it('replays the history like the API: deleted batches are gone, statuses applied', () => {
    const db = buildDemoDb(new Date(2026, 8, 29, 10, 30));
    const deleted = db.operations.filter((op) => op.type === 'delete').map((op) => op.batch_id);
    const ids = db.batches.map((batch) => batch.id);

    expect(db.batches).toHaveLength(58);
    expect(new Set(ids).size).toBe(ids.length);
    expect(deleted.every((id) => !ids.includes(id))).toBe(true);
    expect(db.batches.filter((batch) => batch.status === 'consumed')).toHaveLength(12);
    expect(db.batches.filter((batch) => batch.status === 'discarded')).toHaveLength(6);
    expect(db.batches.some((batch) => batch.updated_by !== batch.created_by)).toBe(true);
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
