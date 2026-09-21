import { apiClient } from './client';
import { HouseholdActor, HouseholdMember, MemberActivity } from '@/types';

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
  action?: 'created' | 'updated';
  status?: string;
  search?: string;
}

export async function listHouseholdActivities(
  householdId: number,
  filters: ActivityFilters = {}
): Promise<MemberActivity[]> {
  const params = new URLSearchParams();
  if (filters.userId) params.set('user_id', String(filters.userId));
  if (filters.action) params.set('action', filters.action);
  if (filters.status) params.set('status', filters.status);
  if (filters.search) params.set('search', filters.search);

  const query = params.toString();
  const payload = await apiClient<MemberActivity[] | DataEnvelope<MemberActivity[]>>(
    `/api/v1/households/${householdId}/activities${query ? `?${query}` : ''}`,
    { method: 'GET' }
  );
  return unwrap(payload);
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
