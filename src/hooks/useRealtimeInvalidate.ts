import { useEffect, useId } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

/**
 * Subscribes to Postgres changes on `table` (optionally filtered to one
 * row/owner) and invalidates the given React Query keys whenever a
 * matching row changes - the same live-update path chat already uses
 * (see api/chat.ts's `useMessages`), so a customer's and a provider's
 * screens watching the same request/quote/opportunity/job stay in sync
 * without either side needing to pull-to-refresh.
 *
 * `queryKeys` may use a partial prefix (e.g. `['feedRequests', providerId]`)
 * since React Query invalidates by prefix match.
 */
export function useRealtimeInvalidate(options: {
  /** Identifies what's being watched (e.g. include the filtered id so
   * re-renders with a new id resubscribe instead of reusing a stale
   * channel). Does not need to be globally unique - a per-instance suffix
   * is added automatically so two components watching the same row each
   * get their own channel instead of colliding on one Supabase reuses. */
  channel: string;
  table: string;
  /** Postgres changes filter, e.g. `id=eq.<uuid>`. Omit to watch the whole table. */
  filter?: string;
  events?: Array<'INSERT' | 'UPDATE' | 'DELETE'>;
  queryKeys: QueryKey[];
  enabled?: boolean;
}) {
  const { channel, table, filter, events = ['INSERT', 'UPDATE'], queryKeys, enabled = true } = options;
  const queryClient = useQueryClient();
  const eventsKey = events.join(',');
  // Supabase's client.channel(topic) reuses an existing channel object when
  // the topic string already exists (e.g. another mounted component - the
  // customer's Home and Requests screens both watch the same active
  // request). Reusing an already-subscribed channel and calling `.on()` on
  // it throws "cannot add postgres_changes callbacks ... after
  // subscribe()", so every hook instance gets its own topic via useId().
  const instanceId = useId();

  useEffect(() => {
    if (!enabled) return;

    let builder = supabase.channel(`${channel}:${instanceId}`);
    for (const event of events) {
      builder = builder.on(
        'postgres_changes' as any,
        { event, schema: 'public', table, ...(filter ? { filter } : {}) } as any,
        () => {
          for (const key of queryKeys) {
            queryClient.invalidateQueries({ queryKey: key });
          }
        },
      );
    }
    builder.subscribe();

    return () => {
      supabase.removeChannel(builder);
    };
    // queryKeys is derived fresh each render from the ids already covered by
    // channel/filter, so it's deliberately left out to avoid resubscribing
    // on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, table, filter, eventsKey, enabled, queryClient]);
}
