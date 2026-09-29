import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient, ApiError, getToken } from '@/api/client';
import { consumeBatch, createBatch, deleteBatch, listBatches, updateBatch } from '@/api/batches';
import { getMe, logout } from '@/api/auth';
import { getHouseholdReport, listHouseholdActivities, listMembers, removeMember } from '@/api/households';
import { format } from 'date-fns';
import { startDemo } from './demoApi';
import { DEMO_TOKEN, clearDemoDb, isDemoActive } from './session';
import { DEMO_ME_ID } from './demoData';

describe('demo API', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    clearDemoDb();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    startDemo();
  });

  afterEach(() => {
    clearDemoDb();
    vi.unstubAllGlobals();
  });

  it('answers from the demo database without calling the server', async () => {
    const { user } = await getMe();

    expect(isDemoActive()).toBe(true);
    expect(getToken()).toBe(DEMO_TOKEN);
    expect(user.name).toBe('Teste');
    expect(user.households?.[0].role).toBe('owner');
    expect(user.households?.[0].members).toHaveLength(5);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('adds, consumes and removes batches', async () => {
    const household = (await getMe()).user.households![0];
    const before = await listBatches(household.id);

    const created = await createBatch({
      household_id: household.id,
      name: 'Queijo coalho',
      quantity: 2,
      expires_at: format(new Date(), 'yyyy-MM-dd'),
    });
    expect(created.created_by?.id).toBe(DEMO_ME_ID);
    expect(await listBatches(household.id)).toHaveLength(before.length + 1);

    const consumed = await updateBatch(created.id, { status: 'consumed' });
    expect(consumed.status).toBe('consumed');

    await deleteBatch(created.id);
    expect(await listBatches(household.id)).toHaveLength(before.length);
  });

  it('applies the API validation rules', async () => {
    const household = (await getMe()).user.households![0];

    await expect(
      createBatch({ household_id: household.id, name: 'Velho', quantity: 1, expires_at: '2000-01-01' })
    ).rejects.toMatchObject({ status: 422, errors: { expires_at: expect.any(Array) } });

    const owner = household.members!.find((member) => member.role === 'owner')!;
    await expect(removeMember(household.id, owner.id)).rejects.toBeInstanceOf(ApiError);
  });

  it('filters and pages the history like the API', async () => {
    const household = (await getMe()).user.households![0];
    const first = await listHouseholdActivities(household.id);
    const second = await listHouseholdActivities(household.id, { before: first.meta.next_before! });
    const discarded = await listHouseholdActivities(household.id, { action: 'discarded' });
    const members = await listHouseholdActivities(household.id, { action: 'members' });

    expect(first.data).toHaveLength(50);
    expect(first.data[0].id).toBeGreaterThan(first.data[49].id);
    expect(second.data[0].id).toBeLessThan(first.data[49].id);
    expect(discarded.data).toHaveLength(6);
    expect(members.data.map((row) => row.action)).toContain('member_role_changed');
    expect((await listMembers(household.id)).every((member) => (member.operations_count ?? 0) > 0)).toBe(true);
  });

  it('records every operation of the session, with what changed', async () => {
    const household = (await getMe()).user.households![0];
    const batch = await createBatch({
      household_id: household.id,
      name: 'Queijo coalho',
      quantity: 5,
      expires_at: format(new Date(), 'yyyy-MM-dd'),
    });

    await consumeBatch(batch.id, { quantity: 2, action: 'consumed' });
    await consumeBatch(batch.id, { quantity: 3, action: 'discarded' });
    await deleteBatch(batch.id);

    const { data } = await listHouseholdActivities(household.id, { search: 'coalho' });
    expect(data.map((row) => row.action)).toEqual(['deleted', 'discarded', 'consumed', 'created']);
    expect(data.every((row) => row.user?.id === DEMO_ME_ID)).toBe(true);
    expect(data[2]).toMatchObject({ quantity: 2, changes: { quantity: { from: 5, to: 3 } } });
    expect(data[1]).toMatchObject({ quantity: 3, changes: { status: { from: 'active', to: 'discarded' } } });
  });

  it('rejects consuming more than what is left', async () => {
    const household = (await getMe()).user.households![0];
    const batch = await createBatch({
      household_id: household.id,
      name: 'Pão',
      quantity: 1,
      expires_at: format(new Date(), 'yyyy-MM-dd'),
    });

    await expect(consumeBatch(batch.id, { quantity: 2, action: 'consumed' })).rejects.toMatchObject({ status: 422 });
  });

  it('builds the reports from the history', async () => {
    const household = (await getMe()).user.households![0];
    const report = await getHouseholdReport(household.id, 90);

    expect(report.period.bucket).toBe('week');
    expect(report.totals.consumed_units).toBeGreaterThan(0);
    expect(report.totals.discarded_units).toBeGreaterThan(0);
    expect(report.totals.use_rate).toBeGreaterThan(0);
    expect(report.totals.use_rate).toBeLessThan(1);
    expect(report.timeline.reduce((sum, point) => sum + point.discarded, 0)).toBe(report.totals.discarded_units);
    expect(report.top_discarded.length).toBeGreaterThan(0);
    expect(report.members).toHaveLength(5);
    expect(report.members.reduce((sum, member) => sum + member.total, 0)).toBe(report.totals.operations);
  });

  it('asks the server only for the Telegram demo link', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { url: 'https://t.me/bot?start=abc', bot_username: 'bot', start_command: '/start abc', expires_at: '' } }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { linked: true, chat_name: 'Ana' } }), { status: 200 })
      );

    await apiClient('/api/v1/telegram/link', { method: 'POST' });
    const { user } = await getMe();

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/telegram/demo-link',
      '/api/v1/telegram/demo-link/abc',
    ]);
    expect(user.telegram_chat_id).toBe('demo');
    expect(user.telegram_chat_name).toBe('Ana (demonstração)');
  });

  it.each([
    [502, 'O servidor do rotless não respondeu'],
    [503, 'O bot do Telegram não está disponível'],
    [429, 'Muitas tentativas seguidas'],
  ])('explains a %i from the Telegram demo link in Portuguese', async (status, message) => {
    fetchMock.mockResolvedValueOnce(new Response('Bad Gateway', { status }));

    await expect(apiClient('/api/v1/telegram/link', { method: 'POST' })).rejects.toThrow(message);
  });

  it('explains a network failure on the Telegram demo link', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(apiClient('/api/v1/telegram/link', { method: 'POST' })).rejects.toThrow(
      'O servidor do rotless não respondeu'
    );
  });

  it('throws everything away on logout', async () => {
    await logout();

    expect(isDemoActive()).toBe(false);
    expect(getToken()).toBeNull();
  });
});
