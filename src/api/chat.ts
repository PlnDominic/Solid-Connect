import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { ChatMessage, ChatThread, Role } from '../types/database';

export async function getOrCreateThread(input: {
  requestId?: string | null;
  jobId?: string | null;
  customerId: string;
  providerId: string;
}): Promise<ChatThread> {
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
  return useQuery({
    queryKey: ['chatThreads', role, userId],
    queryFn: async (): Promise<ChatThread[]> => {
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
}

export function useMessages(threadId: string | null | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['messages', threadId],
    queryFn: async (): Promise<ChatMessage[]> => {
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

  useEffect(() => {
    if (!threadId) return;
    const channel = supabase
      .channel(`chat_messages:${threadId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `thread_id=eq.${threadId}` },
        (payload) => {
          queryClient.setQueryData<ChatMessage[]>(['messages', threadId], (prev) => {
            const next = payload.new as ChatMessage;
            if (prev?.some((m) => m.id === next.id)) return prev;
            return [...(prev ?? []), next];
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, queryClient]);

  return query;
}

export function useLatestMessage(threadId: string | null | undefined) {
  return useQuery({
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
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { threadId: string; senderId: string; senderRole: Role; text: string }) => {
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
      queryClient.setQueryData<ChatMessage[]>(['messages', message.thread_id], (prev) => {
        if (prev?.some((m) => m.id === message.id)) return prev;
        return [...(prev ?? []), message];
      });
    },
  });
}
