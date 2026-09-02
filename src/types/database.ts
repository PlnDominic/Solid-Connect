// Hand-written to match supabase/migrations/0001_init.sql.
// Once the Supabase project is live, regenerate with the Supabase CLI
// (`supabase gen types typescript`) and this file becomes redundant.

export type Role = 'customer' | 'provider';
export type RequestStatus = 'open' | 'matching' | 'quoted' | 'accepted' | 'completed' | 'cancelled';
export type QuoteStatus = 'sent' | 'accepted' | 'declined';
export type BadgeKind = 'certified' | 'verified';
export type JobStatus = 'in_progress' | 'completed';
export type PaymentStatus = 'pending' | 'released' | 'refunded';

export interface Profile {
  id: string;
  role: Role;
  full_name: string;
  initials: string;
  area: string;
  is_seed: boolean;
  provider_category: string | null;
  provider_rating: number;
  provider_jobs_count: number;
  provider_distance_km: number | null;
  provider_verified: boolean;
  provider_certified: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  abbr: string;
  default_label: string;
  sort_order: number;
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
    };
  };
}
