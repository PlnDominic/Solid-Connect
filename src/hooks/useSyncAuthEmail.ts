import { useEffect } from 'react';
import { updateOwnProfileEmail } from '../api/profile';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../store/useSessionStore';

/**
 * Changing your email (EditProfileScreen) goes through Supabase auth's own
 * confirmation flow - the real identity email only actually changes once
 * the user clicks the link Supabase sends, at which point the session
 * refreshes and fires USER_UPDATED. This is the other half of that: catch
 * that event and mirror the now-confirmed email onto profiles.email (and
 * the in-memory profile), which until now still shows the old address.
 * Mounted once at the root - the profile is only touched when there's
 * actually a mismatch to fix, so this is a no-op the rest of the time.
 */
export function useSyncAuthEmail() {
  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event !== 'USER_UPDATED') return;
      const newEmail = session?.user?.email;
      const { profile, setProfile } = useSessionStore.getState();
      if (!newEmail || !profile || profile.email === newEmail) return;
      try {
        await updateOwnProfileEmail(profile.id, newEmail);
        setProfile({ ...profile, email: newEmail });
      } catch {
        // Best-effort - it'll catch up next time this fires (another
        // refresh, another launch) rather than surface an error here.
      }
    });
    return () => subscription.subscription.unsubscribe();
  }, []);
}
