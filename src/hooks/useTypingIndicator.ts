import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const TYPING_TIMEOUT_MS = 3000;
const SEND_THROTTLE_MS = 1500;

/**
 * "X is typing…" for one chat thread - deliberately not a database column
 * (see 0033_chat_richness_and_request_cancel.sql's own comment on why):
 * this is purely ephemeral, so it rides a Supabase Realtime broadcast
 * channel instead of a persisted row. Each side announces itself while
 * composing; the other side clears the flag if nothing arrives for
 * TYPING_TIMEOUT_MS, so a dropped connection or a closed app doesn't
 * leave a stale "typing…" showing forever.
 */
export function useTypingIndicator(threadId: string | null | undefined, selfId: string | null | undefined) {
  const [peerTyping, setPeerTyping] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentAt = useRef(0);

  useEffect(() => {
    setPeerTyping(false);
    if (!threadId) return;

    const channel = supabase.channel(`typing:${threadId}`, { config: { broadcast: { self: false } } });
    channel
      .on('broadcast', { event: 'typing' }, (message) => {
        if (message.payload?.userId === selfId) return;
        setPeerTyping(true);
        if (clearTimer.current) clearTimeout(clearTimer.current);
        clearTimer.current = setTimeout(() => setPeerTyping(false), TYPING_TIMEOUT_MS);
      })
      .subscribe();
    channelRef.current = channel;

    return () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [threadId, selfId]);

  /** Call on every keystroke - throttled internally, so callers don't need
   * their own debounce. */
  function notifyTyping() {
    if (!channelRef.current || !selfId) return;
    const now = Date.now();
    if (now - lastSentAt.current < SEND_THROTTLE_MS) return;
    lastSentAt.current = now;
    channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { userId: selfId } });
  }

  return { peerTyping, notifyTyping };
}
