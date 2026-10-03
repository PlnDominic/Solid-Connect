import { useQuery } from '@tanstack/react-query';
import { useRealtimeInvalidate } from '../hooks/useRealtimeInvalidate';
import { isApiConfigured, apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';

/**
 * Unread counters that feed the tab-bar badges. These live apart from
 * useThreadsForRole/useNotifications because the tab bar renders on every
 * screen for the whole session - a lightweight, never-expiring query here
 * beats inheriting the heavier hooks' options.
 */

/** How many chat threads have at least one message I haven't read yet.
 * Unread = sender isn't me and read_at is null (mark_thread_read, see
 * 0033, stamps read_at on the other participant's messages when a thread
 * is opened). Refetches on any chat_messages change via realtime, which
 * covers new messages AND the read receipt I just wrote from the thread
 * screen. */
export function useUnreadChatCount(userId: string | null, role: 'customer' | 'provider') {
  const peerColumn = role === 'customer' ? 'customer_id' : 'provider_id';
  const query = useQuery({
    queryKey: ['unreadChatCount', userId, isApiConfigured()],
    enabled: !!userId,
    staleTime: 10_000,
    queryFn: async (): Promise<number> => {
      if (isApiConfigured()) {
        const res = await apiFetch<{ data: { unreadCount: number } }>(
          `/api/v1/chat/threads/unread-count?role=${role}`,
        );
        return res.data?.unreadCount ?? 0;
      }
      const { data, error } = await supabase.rpc('count_unread_threads', {
        p_user_id: userId as string,
        p_role: role,
      });
      if (error) throw error;
      return (data as number) ?? 0;
    },
  });

  useRealtimeInvalidate({
    channel: `unread_chat:${userId}`,
    table: 'chat_messages',
    queryKeys: [['unreadChatCount', userId]],
    enabled: !!userId,
  });

  return query;
}

/** Unread in-app notifications (same rows NotificationsScreen renders). */
export function useUnreadNotificationCount(userId: string | null) {
  const query = useQuery({
    queryKey: ['unreadNotificationCount', userId, isApiConfigured()],
    enabled: !!userId,
    staleTime: 10_000,
    queryFn: async (): Promise<number> => {
      if (isApiConfigured()) {
        const res = await apiFetch<{ data: { unreadCount: number } }>(
          '/api/v1/requests/notifications/unread-count',
        );
        return res.data?.unreadCount ?? 0;
      }
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId as string)
        .is('read_at', null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  useRealtimeInvalidate({
    channel: `unread_notifications:${userId}`,
    table: 'notifications',
    filter: userId ? `user_id=eq.${userId}` : undefined,
    queryKeys: [['unreadNotificationCount', userId]],
    enabled: !!userId,
  });

  return query;
}
