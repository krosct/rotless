import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient, ApiError, getToken } from '@/api/client';
import { createBatch, deleteBatch, listBatches, updateBatch } from '@/api/batches';
import { getMe, logout } from '@/api/auth';
import { listHouseholdActivities, listMembers, removeMember } from '@/api/households';
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

  it('filters activities like the API', async () => {
    const household = (await getMe()).user.households![0];
    const updated = await listHouseholdActivities(household.id, { action: 'updated' });
    const discarded = await listHouseholdActivities(household.id, { status: 'discarded' });

    expect(updated.length).toBeGreaterThan(0);
    expect(updated.every((row) => row.updated_by?.id !== row.created_by?.id)).toBe(true);
    expect(discarded).toHaveLength(6);
    expect((await listMembers(household.id)).every((member) => (member.operations_count ?? 0) > 0)).toBe(true);
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

  it('throws everything away on logout', async () => {
    await logout();

    expect(isDemoActive()).toBe(false);
    expect(getToken()).toBeNull();
  });
});
