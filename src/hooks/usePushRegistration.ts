import { useEffect } from 'react';
import { savePushSubscription } from '../api/profile';
import { registerForPushNotificationsAsync } from '../lib/pushNotifications';
import { getNotifications } from '../lib/runtime';
import { useSessionStore } from '../store/useSessionStore';

/**
 * Keeps the stored push token current for a signed-in user. The token is
 * only captured during onboarding otherwise, so a reinstall, a new device
 * or a rotated token would silently stop pushes. Runs once per session and
 * only when permission was already granted (never prompts).
 */
export function usePushRegistration() {
  const profile = useSessionStore((s) => s.profile);
  const setProfile = useSessionStore((s) => s.setProfile);

  useEffect(() => {
    const Notifications = getNotifications();
    if (!profile || !Notifications) return;
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') return;
        const { token } = await registerForPushNotificationsAsync();
        if (cancelled || !token || token === profile.push_token) return;
        await savePushSubscription(profile.id, 'granted', token);
        setProfile({ ...profile, push_token: token, push_permission_status: 'granted' });
      } catch {
        // Best-effort; retried on the next launch.
      }
    })();
    return () => {
      cancelled = true;
    };
    // Re-run only when the signed-in user changes, not on every profile edit.
  }, [profile?.id]);
}
