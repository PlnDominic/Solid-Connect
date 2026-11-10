import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useRealtimeInvalidate } from '../hooks/useRealtimeInvalidate';
import { uploadRequestPhoto } from './requests';
import { PROFILE_COLUMNS } from './profileColumns';
import type { Profile } from '../types/database';

// Job posts (supabase/migrations/0082_job_posts.sql): an open job board.
// Customers post a job once; it shows on every provider's feed, and
// providers who want it express interest.

export type JobPostStatus = 'open' | 'closed' | 'hired';
export type JobPostBudgetType = 'fixed' | 'range' | 'negotiable';
export type JobPostStart = 'asap' | 'this_week' | 'flexible' | 'date';
export type JobPostInterestStatus = 'pending' | 'shortlisted' | 'declined' | 'hired';

export interface JobPost {
  id: string;
  customer_id: string;
  category_id: string | null;
  category_label: string;
  title: string;
  description: string;
  budget_min: number | null;
  budget_max: number | null;
  budget_type: JobPostBudgetType;
  location_label: string;
  start_preference: JobPostStart;
  start_date: string | null;
  photos: string[];
  status: JobPostStatus;
  hired_provider_id: string | null;
  interest_count: number;
  created_at: string;
  updated_at: string;
  /** Added in 0083. Older rows and old databases may not have it. */
  expires_at?: string | null;
  /** Added in 0084: the direct request sent to the hired provider. */
  hire_request_id?: string | null;
}

export interface JobPostInterest {
  id: string;
  post_id: string;
  provider_id: string;
  message: string;
  proposed_price: number | null;
  status: JobPostInterestStatus;
  created_at: string;
}

export type JobPostInterestWithProvider = JobPostInterest & { provider: Profile | null };

/** Days a post stays on the board before it expires (also the repost length). */
export const POST_LIFETIME_DAYS = 14;

/** Open, and not past its expiry. This is what providers can still respond to. */
export function isPostOpen(post: Pick<JobPost, 'status' | 'expires_at'>): boolean {
  if (post.status !== 'open') return false;
  return !post.expires_at || new Date(post.expires_at).getTime() > Date.now();
}

export function isPostExpired(post: Pick<JobPost, 'status' | 'expires_at'>): boolean {
  return post.status === 'open' && !isPostOpen(post);
}

/** "Expires in 3 days", "Expires today" or "Expired". */
export function expiryLabel(post: Pick<JobPost, 'status' | 'expires_at'>): string | null {
  if (post.status !== 'open' || !post.expires_at) return null;
  const ms = new Date(post.expires_at).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const days = Math.ceil(ms / 86_400_000);
  return days <= 1 ? 'Expires today' : `Expires in ${days} days`;
}

export type JobPostDraft = {
  categoryId: string;
  categoryLabel: string;
  title: string;
  description: string;
  budgetType: JobPostBudgetType;
  budgetMin: number | null;
  budgetMax: number | null;
  locationLabel: string;
  startPreference: JobPostStart;
  startDate: string | null;
  photoUris: string[];
};

export const START_LABELS: Record<JobPostStart, string> = {
  asap: 'As soon as possible',
  this_week: 'This week',
  flexible: 'Flexible',
  date: 'On a set date',
};

/** "GHS 300 - 500", "GHS 400", or "Open to offers". */
export function formatJobPostBudget(post: Pick<JobPost, 'budget_type' | 'budget_min' | 'budget_max'>): string {
  if (post.budget_type === 'negotiable' || (post.budget_min == null && post.budget_max == null)) {
    return 'Open to offers';
  }
  if (post.budget_type === 'fixed' || post.budget_min === post.budget_max) {
    return `GHS ${Number(post.budget_max ?? post.budget_min).toLocaleString()}`;
  }
  return `GHS ${Number(post.budget_min).toLocaleString()} - ${Number(post.budget_max).toLocaleString()}`;
}

export function formatJobPostStart(post: Pick<JobPost, 'start_preference' | 'start_date'>): string {
  if (post.start_preference === 'date' && post.start_date) {
    return new Date(`${post.start_date}T00:00:00`).toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }
  return START_LABELS[post.start_preference];
}

export function postedAgo(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

const KEYS = {
  mine: (customerId: string | null) => ['jobPosts', 'mine', customerId] as const,
  board: ['jobPosts', 'board'] as const,
  one: (postId: string | null | undefined) => ['jobPosts', 'one', postId] as const,
  interests: (postId: string | null | undefined) => ['jobPosts', 'interests', postId] as const,
  myInterests: (providerId: string | null) => ['jobPosts', 'myInterests', providerId] as const,
};

/** The customer's own posts, newest first. */
export function useMyJobPosts(customerId: string | null) {
  const query = useQuery({
    queryKey: KEYS.mine(customerId),
    enabled: !!customerId,
    queryFn: async (): Promise<JobPost[]> => {
      const { data, error } = await supabase
        .from('job_posts')
        .select('*')
        .eq('customer_id', customerId as string)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as JobPost[];
    },
  });

  useRealtimeInvalidate({
    channel: `job_posts_mine:${customerId}`,
    table: 'job_posts',
    filter: customerId ? `customer_id=eq.${customerId}` : undefined,
    queryKeys: [KEYS.mine(customerId)],
    enabled: !!customerId,
  });

  return query;
}

/** Open posts for the provider feed. Excludes the viewer's own posts. */
export function useJobBoard(viewerId: string | null) {
  const query = useQuery({
    queryKey: [...KEYS.board, viewerId],
    enabled: !!viewerId,
    queryFn: async (): Promise<JobPost[]> => {
      const { data, error } = await supabase
        .from('job_posts')
        .select('*')
        .eq('status', 'open')
        .gt('expires_at', new Date().toISOString())
        .neq('customer_id', viewerId as string)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as JobPost[];
    },
  });

  useRealtimeInvalidate({
    channel: 'job_posts_board',
    table: 'job_posts',
    events: ['INSERT', 'UPDATE', 'DELETE'],
    queryKeys: [KEYS.board],
    enabled: !!viewerId,
  });

  return query;
}

export function useJobPost(postId: string | null | undefined) {
  const query = useQuery({
    queryKey: KEYS.one(postId),
    enabled: !!postId,
    queryFn: async (): Promise<JobPost | null> => {
      const { data, error } = await supabase.from('job_posts').select('*').eq('id', postId as string).maybeSingle();
      if (error) throw error;
      return (data as JobPost) ?? null;
    },
  });

  useRealtimeInvalidate({
    channel: `job_post:${postId}`,
    table: 'job_posts',
    filter: postId ? `id=eq.${postId}` : undefined,
    queryKeys: [KEYS.one(postId)],
    enabled: !!postId,
  });

  return query;
}

/** The customer's view: every provider interested in one post. */
export function useJobPostInterests(postId: string | null | undefined) {
  const query = useQuery({
    queryKey: KEYS.interests(postId),
    enabled: !!postId,
    queryFn: async (): Promise<JobPostInterestWithProvider[]> => {
      const { data, error } = await supabase
        .from('job_post_interests')
        .select('*')
        .eq('post_id', postId as string)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as JobPostInterest[];
      if (!rows.length) return [];
      const { data: providers } = await supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .in(
          'id',
          rows.map((r) => r.provider_id),
        );
      const byId = new Map(((providers ?? []) as unknown as Profile[]).map((p) => [p.id, p]));
      return rows.map((r) => ({ ...r, provider: byId.get(r.provider_id) ?? null }));
    },
  });

  useRealtimeInvalidate({
    channel: `job_post_interests:${postId}`,
    table: 'job_post_interests',
    filter: postId ? `post_id=eq.${postId}` : undefined,
    events: ['INSERT', 'UPDATE', 'DELETE'],
    queryKeys: [KEYS.interests(postId)],
    enabled: !!postId,
  });

  return query;
}

/** The provider's own interest rows, keyed by post id. */
export function useMyJobPostInterests(providerId: string | null) {
  return useQuery({
    queryKey: KEYS.myInterests(providerId),
    enabled: !!providerId,
    queryFn: async (): Promise<Map<string, JobPostInterest>> => {
      const { data, error } = await supabase
        .from('job_post_interests')
        .select('*')
        .eq('provider_id', providerId as string);
      if (error) throw error;
      return new Map(((data ?? []) as JobPostInterest[]).map((r) => [r.post_id, r]));
    },
  });
}

export function useCreateJobPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: JobPostDraft & { customerId: string }): Promise<JobPost> => {
      const photos: string[] = [];
      for (const uri of input.photoUris) {
        photos.push(await uploadRequestPhoto(input.customerId, uri));
      }
      const { data, error } = await supabase
        .from('job_posts')
        .insert({
          customer_id: input.customerId,
          category_id: input.categoryId,
          category_label: input.categoryLabel,
          title: input.title.trim(),
          description: input.description.trim(),
          budget_type: input.budgetType,
          budget_min: input.budgetType === 'negotiable' ? null : input.budgetMin,
          budget_max: input.budgetType === 'negotiable' ? null : input.budgetMax,
          location_label: input.locationLabel,
          start_preference: input.startPreference,
          start_date: input.startPreference === 'date' ? input.startDate : null,
          photos,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data as JobPost;
    },
    onSuccess: (post) => {
      qc.invalidateQueries({ queryKey: KEYS.mine(post.customer_id) });
      qc.invalidateQueries({ queryKey: KEYS.board });
    },
  });
}

export function useUpdateJobPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: JobPostDraft & { postId: string; customerId: string; keepPhotos: string[] }): Promise<void> => {
      const photos = [...input.keepPhotos];
      for (const uri of input.photoUris) {
        photos.push(await uploadRequestPhoto(input.customerId, uri));
      }
      const { error } = await supabase
        .from('job_posts')
        .update({
          category_id: input.categoryId,
          category_label: input.categoryLabel,
          title: input.title.trim(),
          description: input.description.trim(),
          budget_type: input.budgetType,
          budget_min: input.budgetType === 'negotiable' ? null : input.budgetMin,
          budget_max: input.budgetType === 'negotiable' ? null : input.budgetMax,
          location_label: input.locationLabel,
          start_preference: input.startPreference,
          start_date: input.startPreference === 'date' ? input.startDate : null,
          photos,
        })
        .eq('id', input.postId)
        .eq('status', 'open');
      if (error) throw error;
    },
    onSuccess: (_d, input) => {
      qc.invalidateQueries({ queryKey: ['jobPosts'] });
      qc.invalidateQueries({ queryKey: KEYS.one(input.postId) });
    },
  });
}

export function useSetJobPostStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { postId: string; status: JobPostStatus; hiredProviderId?: string | null }) => {
      const { error } = await supabase
        .from('job_posts')
        .update({
          status: input.status,
          ...(input.hiredProviderId !== undefined ? { hired_provider_id: input.hiredProviderId } : {}),
          // Reopening (or reposting) starts a fresh lifetime.
          ...(input.status === 'open' ? { expires_at: new Date(Date.now() + POST_LIFETIME_DAYS * 86_400_000).toISOString() } : {}),
        })
        .eq('id', input.postId);
      if (error) throw error;
    },
    onSuccess: (_d, input) => {
      qc.invalidateQueries({ queryKey: ['jobPosts'] });
      qc.invalidateQueries({ queryKey: KEYS.one(input.postId) });
    },
  });
}

export function useDeleteJobPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from('job_posts').delete().eq('id', postId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobPosts'] }),
  });
}

export function useExpressInterest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      postId: string;
      providerId: string;
      message: string;
      proposedPrice: number | null;
    }) => {
      const { error } = await supabase.from('job_post_interests').upsert(
        {
          post_id: input.postId,
          provider_id: input.providerId,
          message: input.message.trim(),
          proposed_price: input.proposedPrice,
        },
        { onConflict: 'post_id,provider_id' },
      );
      if (error) throw error;
    },
    onSuccess: (_d, input) => {
      qc.invalidateQueries({ queryKey: KEYS.myInterests(input.providerId) });
      qc.invalidateQueries({ queryKey: KEYS.one(input.postId) });
      qc.invalidateQueries({ queryKey: KEYS.board });
    },
  });
}

export function useWithdrawInterest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { postId: string; providerId: string }) => {
      const { error } = await supabase
        .from('job_post_interests')
        .delete()
        .eq('post_id', input.postId)
        .eq('provider_id', input.providerId);
      if (error) throw error;
    },
    onSuccess: (_d, input) => {
      qc.invalidateQueries({ queryKey: KEYS.myInterests(input.providerId) });
      qc.invalidateQueries({ queryKey: KEYS.one(input.postId) });
      qc.invalidateQueries({ queryKey: KEYS.board });
    },
  });
}

export function useSetInterestStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { interestId: string; postId: string; status: JobPostInterestStatus }) => {
      const { error } = await supabase
        .from('job_post_interests')
        .update({ status: input.status })
        .eq('id', input.interestId);
      if (error) throw error;
    },
    onSuccess: (_d, input) => qc.invalidateQueries({ queryKey: KEYS.interests(input.postId) }),
  });
}

/** Called once the direct request to the chosen provider has actually been
 * sent: only then is the post marked hired and its other interest closed
 * out. Backing out of the request screen leaves the post untouched. The
 * request id is kept so the post reopens if that request is declined. */
export async function completeJobPostHire(input: { postId: string; interestId: string; providerId: string; requestId: string }) {
  const { error: interestError } = await supabase
    .from('job_post_interests')
    .update({ status: 'hired' })
    .eq('id', input.interestId);
  if (interestError) throw interestError;
  const { error } = await supabase
    .from('job_posts')
    .update({ status: 'hired', hired_provider_id: input.providerId, hire_request_id: input.requestId })
    .eq('id', input.postId);
  if (error) throw error;
}

/** Turns a database error from posting into something a person can act on. */
export function friendlyPostError(e: unknown): string {
  const message = e instanceof Error ? e.message : typeof (e as { message?: unknown })?.message === 'string' ? (e as { message: string }).message : '';
  if (message.includes('JOB_POST_RATE_LIMIT')) {
    return 'You have reached the limit of 5 job posts a day. Try again tomorrow, or close an old post and reuse it.';
  }
  return message || 'Could not post that job. Please try again.';
}

/** Opens (or reuses) the chat thread for one interest on a post, so the
 * customer and the provider can talk before anyone is hired. */
export async function openJobPostThread(postId: string, providerId: string): Promise<string> {
  const { data, error } = await supabase.rpc('open_job_post_thread', { p_post_id: postId, p_provider_id: providerId });
  if (error) throw error;
  return data as string;
}
