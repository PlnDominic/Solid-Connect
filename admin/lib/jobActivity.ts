import type { createServerSupabase } from './supabase';

type SupabaseServer = Awaited<ReturnType<typeof createServerSupabase>>;

export type JobEvent = {
  id: string;
  actor_id: string;
  event_type: string;
  from_step: number | null;
  to_step: number | null;
  note: string;
  created_at: string;
};

export type ChatMessage = {
  id: string;
  sender_id: string;
  sender_role: 'customer' | 'provider';
  text: string;
  created_at: string;
};

/**
 * Shared read for the job detail and dispute detail admin pages: the full
 * job_events audit trail plus the job's chat transcript (if a thread was
 * ever created for it), with actor names resolved. Both pages need the
 * same evidence to let an admin actually see what happened, not just the
 * current status.
 */
export async function getJobActivity(supabase: SupabaseServer, jobId: string) {
  const [{ data: events }, { data: thread }] = await Promise.all([
    supabase
      .from('job_events')
      .select('id, actor_id, event_type, from_step, to_step, note, created_at')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true }),
    supabase.from('chat_threads').select('id').eq('job_id', jobId).maybeSingle(),
  ]);

  let messages: ChatMessage[] = [];
  if (thread?.id) {
    const { data } = await supabase
      .from('chat_messages')
      .select('id, sender_id, sender_role, text, created_at')
      .eq('thread_id', thread.id)
      .order('created_at', { ascending: true });
    messages = data ?? [];
  }

  const eventRows: JobEvent[] = events ?? [];
  const actorIds = [...new Set(eventRows.map((e) => e.actor_id).filter(Boolean))];
  const { data: actors } = actorIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', actorIds)
    : { data: [] as { id: string; full_name: string }[] };

  const actorMap: Record<string, string> = {};
  (actors ?? []).forEach((a: { id: string; full_name: string }) => {
    actorMap[a.id] = a.full_name;
  });

  return { events: eventRows, messages, actorMap, threadId: thread?.id ?? null };
}

export const EVENT_LABELS: Record<string, string> = {
  CREATED: 'Job created',
  STEP_ADVANCED: 'Step advanced',
  PROVIDER_COMPLETED: 'Provider marked complete',
  CUSTOMER_CONFIRMED: 'Customer confirmed completion',
  MESSAGE_HINT: 'New message',
};
