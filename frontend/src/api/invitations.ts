import { apiClient } from './client';
import { InvitationInfo } from '@/types';

export interface CreateInvitationResponse {
  message: string;
  invitation: {
    token: string;
    email: string;
    household_name: string;
    invite_url: string;
    expires_at: string;
  };
}

export interface AcceptInvitationResponse {
  message: string;
  household: {
    id: number;
    name: string;
    role: 'owner' | 'member';
  };
}

export async function createInvitation(householdId: number, email: string): Promise<CreateInvitationResponse> {
  return apiClient<CreateInvitationResponse>(`/api/v1/households/${householdId}/invitations`, {
    method: 'POST',
    body: { email },
  });
}

export async function getInvitationInfo(token: string): Promise<InvitationInfo> {
  return apiClient<InvitationInfo>(`/api/v1/invitations/info/${token}`, {
    method: 'GET',
  });
}

export async function acceptInvitation(token: string): Promise<AcceptInvitationResponse> {
  return apiClient<AcceptInvitationResponse>('/api/v1/invitations/accept', {
    method: 'POST',
    body: { token },
  });
}
