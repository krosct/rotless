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

export type HouseholdRole = 'owner' | 'manager' | 'member';

export interface HouseholdMember {
  id: number;
  name: string;
  email: string;
  role: HouseholdRole;
  joined_at?: string;
  operations_count?: number;
}

export interface HouseholdActor {
  id: number;
  name: string;
  is_member: boolean;
}

export type MovementAction =
  | 'created'
  | 'updated'
  | 'consumed'
  | 'discarded'
  | 'deleted'
  | 'product_updated'
  | 'household_renamed'
  | 'member_invited'
  | 'member_joined'
  | 'member_removed'
  | 'member_role_changed';

export interface MovementChange {
  from: string | number | null;
  to: string | number | null;
}

/** One entry of the household history (household_movements). */
export interface Movement {
  id: number;
  action: MovementAction;
  created_at: string;
  user: BatchActor | null;
  subject: BatchActor | null;
  batch_id: number | null;
  product_name: string | null;
  quantity: number | null;
  /** Field -> change; `backfilled: true` marks entries rebuilt from old data. */
  changes: Record<string, MovementChange | boolean> | null;
}

export interface MovementPage {
  data: Movement[];
  meta: { next_before: number | null };
}

export interface ReportTotals {
  added_units: number;
  consumed_units: number;
  discarded_units: number;
  use_rate: number | null;
}

export interface HouseholdReport {
  period: { days: 7 | 30 | 90; from: string; to: string; timezone: string; bucket: 'day' | 'week' };
  totals: ReportTotals & { operations: number; avg_days_to_consume: number | null };
  previous: ReportTotals;
  timeline: { date: string; consumed: number; discarded: number }[];
  top_consumed: { product_name: string; units: number }[];
  top_discarded: { product_name: string; units: number }[];
  members: {
    user: BatchActor;
    is_member: boolean;
    added: number;
    consumed: number;
    discarded: number;
    other: number;
    total: number;
  }[];
}

export interface Household {
  id: number;
  name: string;
  is_owner?: boolean;
  role?: HouseholdRole;
  members?: HouseholdMember[];
}

export interface User {
  id: number;
  name: string;
  email: string;
  telegram_chat_id?: string | null;
  telegram_chat_name?: string | null;
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
