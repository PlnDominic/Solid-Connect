// Hand-written to match supabase/migrations/0001_init.sql.
// Once the Supabase project is live, regenerate with the Supabase CLI
// (`supabase gen types typescript`) and this file becomes redundant.

export type Role = 'customer' | 'provider';
export type RequestStatus =
  | 'open'
  | 'matching'
  | 'awaiting_provider'
  | 'quoted'
  | 'accepted'
  | 'completed'
  | 'cancelled'
  | 'rejected';
export type RequestMode = 'GENERAL' | 'DIRECT';
export type QuoteStatus = 'sent' | 'accepted' | 'declined';
export type BadgeKind = 'certified' | 'verified';
export type JobStatus =
  | 'accepted'
  | 'in_progress'
  | 'awaiting_completion_confirmation'
  | 'completed';
export type PaymentStatus = 'pending' | 'released' | 'refunded';
export type VerificationStatus = 'pending' | 'approved' | 'rejected';
export type DisputeReason = 'not_completed' | 'poor_quality' | 'overcharged' | 'no_show' | 'other';
export type DisputeStatus = 'open' | 'resolved';

export interface Profile {
  id: string;
  role: Role;
  full_name: string;
  initials: string;
  area: string;
  phone: string | null;
  email: string | null;
  push_token: string | null;
  push_permission_status: string | null;
  is_seed: boolean;
  provider_category: string | null;
  provider_rating: number;
  provider_jobs_count: number;
  provider_distance_km: number | null;
  provider_verified: boolean;
  provider_certified: boolean;
  /** Phase C trust ladder; defaults REGISTERED when column missing on old clients. */
  verification_level?:
    | 'REGISTERED'
    | 'IDENTITY_VERIFIED'
    | 'PROFESSION_VERIFIED'
    | 'EXPERIENCE_VERIFIED'
    | 'SOLID_CONNECT_VERIFIED';
  availability_mode?: 'AVAILABLE_NOW' | 'UNAVAILABLE' | 'SCHEDULE' | 'PAUSED';
  created_at: string;
  // Added in supabase/migrations/0009_profile_photo.sql.
  photo_url: string | null;
  tagline: string | null;
}

export interface Category {
  id: string;
  name: string;
  abbr: string;
  default_label: string;
  sort_order: number;
  /** Catalog budget band (GHS) for this service. */
  budget_min?: number;
  budget_max?: number;
}

export interface ServiceRequest {
  id: string;
  customer_id: string;
  category_id: string | null;
  category_label: string;
  description: string;
  photos: string[];
  budget_min: number | null;
  budget_max: number | null;
  location_label: string;
  status: RequestStatus;
  created_at: string;
  /** When set, only this provider was invited (direct request). */
  preferred_provider_id?: string | null;
  request_mode?: RequestMode;
  customer_budget?: number | null;
  rejection_reason?: string | null;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface Quote {
  id: string;
  request_id: string;
  provider_id: string;
  price: number;
  eta_label: string;
  badge_label: string;
  badge_kind: BadgeKind;
  status: QuoteStatus;
  created_at: string;
  note?: string;
  revision?: number;
  updated_at?: string;
}

export interface Job {
  id: string;
  request_id: string;
  quote_id: string;
  customer_id: string;
  provider_id: string;
  title: string;
  price: number;
  location_label: string;
  step: number;
  status: JobStatus;
  started_at: string;
  completed_at: string | null;
  provider_completed_at?: string | null;
  customer_confirmed_at?: string | null;
}

export interface Payment {
  id: string;
  job_id: string;
  amount: number;
  status: PaymentStatus;
  released_at: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  job_id: string;
  provider_id: string;
  customer_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface ChatThread {
  id: string;
  request_id: string | null;
  job_id: string | null;
  customer_id: string;
  provider_id: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_role: Role;
  text: string;
  created_at: string;
}

export interface SavedProvider {
  customer_id: string;
  provider_id: string;
  created_at: string;
}

// Added in supabase/migrations/0005_admin_verification.sql, after this file
// was first written. Providers may only insert/select their own row (see
// that migration's RLS policies) - status transitions to approved/rejected
// happen only from the admin portal via its service-role client.
export interface ProviderVerification {
  id: string;
  provider_id: string;
  status: VerificationStatus;
  doc_urls: string[];
  note: string | null;
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

// Added in supabase/migrations/0007_disputes.sql - a customer's report of
// an issue on a completed/in-progress job. Read-only from the client once
// filed; resolution is an admin-side action.
export interface Dispute {
  id: string;
  job_id: string;
  customer_id: string;
  provider_id: string;
  reason: DisputeReason;
  description: string;
  status: DisputeStatus;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
}

// Added in supabase/migrations/0008_provider_portfolio.sql - public photos
// of a provider's past work, shown on the customer-facing Provider Detail
// screen. Public bucket/table (unlike verification docs); no per-photo
// caption or ordering yet.
export interface ProviderPortfolioPhoto {
  id: string;
  provider_id: string;
  photo_url: string;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile> & { id: string; full_name: string; initials: string }; Update: Partial<Profile> };
      categories: { Row: Category; Insert: Category; Update: Partial<Category> };
      service_requests: { Row: ServiceRequest; Insert: Partial<ServiceRequest> & { customer_id: string; category_label: string }; Update: Partial<ServiceRequest> };
      quotes: { Row: Quote; Insert: Partial<Quote> & { request_id: string; provider_id: string; price: number }; Update: Partial<Quote> };
      jobs: { Row: Job; Insert: Partial<Job> & { request_id: string; quote_id: string; customer_id: string; provider_id: string; title: string; price: number; location_label: string }; Update: Partial<Job> };
      payments: { Row: Payment; Insert: Partial<Payment> & { job_id: string; amount: number }; Update: Partial<Payment> };
      reviews: { Row: Review; Insert: Partial<Review> & { job_id: string; provider_id: string; customer_id: string; rating: number }; Update: Partial<Review> };
      chat_threads: { Row: ChatThread; Insert: Partial<ChatThread> & { customer_id: string; provider_id: string }; Update: Partial<ChatThread> };
      chat_messages: { Row: ChatMessage; Insert: Partial<ChatMessage> & { thread_id: string; sender_id: string; sender_role: Role; text: string }; Update: Partial<ChatMessage> };
      saved_providers: { Row: SavedProvider; Insert: SavedProvider; Update: Partial<SavedProvider> };
      provider_verifications: { Row: ProviderVerification; Insert: Partial<ProviderVerification> & { provider_id: string }; Update: Partial<ProviderVerification> };
      disputes: { Row: Dispute; Insert: Partial<Dispute> & { job_id: string; customer_id: string; provider_id: string; reason: DisputeReason }; Update: Partial<Dispute> };
      provider_portfolio_photos: { Row: ProviderPortfolioPhoto; Insert: Partial<ProviderPortfolioPhoto> & { provider_id: string; photo_url: string }; Update: Partial<ProviderPortfolioPhoto> };
    };
  };
}
