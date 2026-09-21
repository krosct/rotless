export type BatchStatus = 'active' | 'consumed' | 'discarded';

export interface Product {
  id: number;
  name: string;
  barcode?: string | null;
  photo_url?: string | null;
}

export interface BatchActor {
  id: number;
  name: string;
}

export interface Batch {
  id: number;
  household_id?: number;
  product: Product;
  quantity: number; // inteiro >= 1
  expires_at: string; // YYYY-MM-DD
  status: BatchStatus;
  created_at?: string;
  updated_at?: string;
  created_by?: BatchActor | null;
  updated_by?: BatchActor | null;
}

export interface HouseholdMember {
  id: number;
  name: string;
  email: string;
  role: 'owner' | 'member';
  joined_at?: string;
}

export interface Household {
  id: number;
  name: string;
  is_owner?: boolean;
  role?: 'owner' | 'member';
  members?: HouseholdMember[];
}

export interface User {
  id: number;
  name: string;
  email: string;
  telegram_chat_id?: string | null;
  households?: Household[];
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface ApiValidationError {
  message: string;
  errors?: Record<string, string[]>;
}

export type InvitationState = 'invited' | 'already_member' | 'not_invited';

export interface InvitationInfo {
  token: string;
  email: string;
  household_id: number;
  household_name: string;
  expires_at: string;
  state: InvitationState;
}

export type ExpiryTone = 'ok' | 'soon' | 'overdue';
