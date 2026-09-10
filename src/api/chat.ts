import { useEffect, useId } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, isApiConfigured } from '../lib/api';
import { useRealtimeInvalidate } from '../hooks/useRealtimeInvalidate';
import { supabase } from '../lib/supabase';
import type { ChatMessage, ChatThread, Role } from '../types/database';

export async function getOrCreateThread(input: {
  requestId?: string | null;
  jobId?: string | null;
  customerId: string;
  providerId: string;
  /** Whose perspective is the signed-in user. Required for Nest path. */
  asRole: Role;
}): Promise<ChatThread> {
  if (isApiConfigured()) {
    const peerId = input.asRole === 'customer' ? input.providerId : input.customerId;
    const res = await apiFetch<{ data: ChatThread }>('/api/v1/chat/threads', {
      method: 'POST',
      body: JSON.stringify({
        requestId: input.requestId ?? undefined,
        jobId: input.jobId ?? undefined,
        peerId,
        asRole: input.asRole,
      }),
    });
    return res.data;
  }

  if (input.requestId) {
    const { data: existing } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('request_id', input.requestId)
      .eq('provider_id', input.providerId)
      .maybeSingle();
    if (existing) return existing;
  }
  const { data, error } = await supabase
    .from('chat_threads')
    .insert({
      request_id: input.requestId ?? null,
      job_id: input.jobId ?? null,
      customer_id: input.customerId,
      provider_id: input.providerId,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export function useThreadsForRole(userId: string | null, role: Role) {
  const column = role === 'customer' ? 'customer_id' : 'provider_id';
  const query = useQuery({
    queryKey: ['chatThreads', role, userId, isApiConfigured()],
    queryFn: async (): Promise<ChatThread[]> => {
      if (isApiConfigured()) {
        const res = await apiFetch<{ data: ChatThread[] }>(`/api/v1/chat/threads?role=${role}`);
        return res.data ?? [];
      }
      const { data, error } = await supabase
        .from('chat_threads')
        .select('*')
        .eq(column, userId as string)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

  // A new thread (e.g. created when a quote is accepted) should appear on
  // the chat list without a manual pull-to-refresh.
  useRealtimeInvalidate({
    channel: `chat_threads:${role}:${userId}`,
    table: 'chat_threads',
    filter: userId ? `${column}=eq.${userId}` : undefined,
    events: ['INSERT'],
    queryKeys: [['chatThreads', role, userId]],
    enabled: !!userId,
  });

  return query;
}

export function useMessages(threadId: string | null | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['messages', threadId, isApiConfigured()],
    queryFn: async (): Promise<ChatMessage[]> => {
      if (isApiConfigured()) {
        const res = await apiFetch<{ data: ChatMessage[] }>(`/api/v1/chat/threads/${threadId}/messages`);
        return res.data ?? [];
      }
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', threadId as string)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!threadId,
  });

  // Suffixed with a per-instance id: supabase.channel() reuses an existing
  // channel object for the same topic string, and calling .on() on one
  // that's already subscribed throws - see useRealtimeInvalidate for the
  // same fix applied to its callers.
  const instanceId = useId();

  useEffect(() => {
    if (!threadId) return;
    const channel = supabase
      .channel(`chat_messages:${threadId}:${instanceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `thread_id=eq.${threadId}` },
        (payload) => {
          queryClient.setQueryData<ChatMessage[]>(['messages', threadId, isApiConfigured()], (prev) => {
            const next = payload.new as ChatMessage;
            if (prev?.some((m) => m.id === next.id)) return prev;
            return [...(prev ?? []), next];
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, queryClient]);

  return query;
}

/** One thread's most recent message - used for the chat list's preview text
 * and timestamp, so realtime here is what makes a new message update that
 * preview live while its sender is still sitting on the list. */
export function useLatestMessage(threadId: string | null | undefined) {
  const query = useQuery({
    queryKey: ['latestMessage', threadId],
    queryFn: async (): Promise<ChatMessage | null> => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', threadId as string)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!threadId,
  });

  useRealtimeInvalidate({
    channel: `latest_message:${threadId}`,
    table: 'chat_messages',
    filter: threadId ? `thread_id=eq.${threadId}` : undefined,
    queryKeys: [['latestMessage', threadId]],
    enabled: !!threadId,
  });

  return query;
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { threadId: string; senderId: string; senderRole: Role; text: string }) => {
      if (isApiConfigured()) {
        const res = await apiFetch<{ data: ChatMessage }>(`/api/v1/chat/threads/${input.threadId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ text: input.text }),
        });
        return res.data;
      }
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          thread_id: input.threadId,
          sender_id: input.senderId,
          sender_role: input.senderRole,
          text: input.text,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data as ChatMessage;
    },
    onSuccess: (message) => {
      queryClient.setQueryData<ChatMessage[]>(['messages', message.thread_id, isApiConfigured()], (prev) => {
        if (prev?.some((m) => m.id === message.id)) return prev;
        return [...(prev ?? []), message];
      });
    },
  });
}
