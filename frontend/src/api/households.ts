import { apiClient } from './client';
import { HouseholdActor, HouseholdMember, HouseholdReport, MovementAction, MovementPage } from '@/types';

interface DataEnvelope<T> {
  data: T;
}

function unwrap<T>(payload: T | DataEnvelope<T>): T {
  if (payload !== null && typeof payload === 'object' && 'data' in payload) {
    return (payload as DataEnvelope<T>).data;
  }
  return payload as T;
}

export async function updateHousehold(
  householdId: number,
  name: string
): Promise<{ message: string; household: { id: number; name: string } }> {
  return apiClient<{ message: string; household: { id: number; name: string } }>(
    `/api/v1/households/${householdId}`,
    {
      method: 'PATCH',
      body: { name },
    }
  );
}

export async function listMembers(householdId: number): Promise<HouseholdMember[]> {
  const payload = await apiClient<HouseholdMember[] | DataEnvelope<HouseholdMember[]>>(
    `/api/v1/households/${householdId}/members`,
    { method: 'GET' }
  );
  return unwrap(payload);
}

export async function listHouseholdActors(householdId: number): Promise<HouseholdActor[]> {
  const payload = await apiClient<HouseholdActor[] | DataEnvelope<HouseholdActor[]>>(
    `/api/v1/households/${householdId}/actors`,
    { method: 'GET' }
  );
  return unwrap(payload);
}

export interface ActivityFilters {
  userId?: number;
  /** A movement action, or 'members' for every member/household event. */
  action?: MovementAction | 'members';
  search?: string;
  /** Next page: the `meta.next_before` of the previous one. */
  before?: number;
}

export async function listHouseholdActivities(
  householdId: number,
  filters: ActivityFilters = {}
): Promise<MovementPage> {
  const params = new URLSearchParams();
  if (filters.userId) params.set('user_id', String(filters.userId));
  if (filters.action) params.set('action', filters.action);
  if (filters.search) params.set('search', filters.search);
  if (filters.before) params.set('before', String(filters.before));

  const query = params.toString();
  return apiClient<MovementPage>(
    `/api/v1/households/${householdId}/activities${query ? `?${query}` : ''}`,
    { method: 'GET' }
  );
}

export async function getHouseholdReport(householdId: number, days: 7 | 30 | 90): Promise<HouseholdReport> {
  const params = new URLSearchParams({ days: String(days) });
  // Days are bucketed in the viewer's timezone.
  try {
    params.set('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    // The API falls back to its own timezone.
  }
  const payload = await apiClient<{ data: HouseholdReport }>(
    `/api/v1/households/${householdId}/reports?${params.toString()}`,
    { method: 'GET' }
  );
  return payload.data;
}

export async function removeMember(householdId: number, userId: number): Promise<{ message: string }> {
  return apiClient<{ message: string }>(`/api/v1/households/${householdId}/members/${userId}`, {
    method: 'DELETE',
  });
}

export async function updateMemberRole(
  householdId: number,
  userId: number,
  role: 'manager' | 'member'
): Promise<{ message: string; member: { id: number; role: string } }> {
  return apiClient<{ message: string; member: { id: number; role: string } }>(
    `/api/v1/households/${householdId}/members/${userId}/role`,
    {
      method: 'PATCH',
      body: { role },
    }
  );
}
