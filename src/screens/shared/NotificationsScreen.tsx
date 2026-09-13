import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Switch, Text, View, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { EmptyState } from '../../components/EmptyState';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '../../api/requests';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, radii, shadow, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';
import type { AppNotification } from '../../types/database';

const STORAGE_KEY = 'solid-connect:notification-prefs';

const DEFAULT_PREFS = {
  jobUpdates: true,
  newQuotes: true,
  messages: true,
  promotions: false,
};

type Prefs = typeof DEFAULT_PREFS;

const ROWS: { key: keyof Prefs; label: string; detail: string }[] = [
  { key: 'jobUpdates', label: 'Job updates', detail: 'Progress, completion and payment status' },
  { key: 'newQuotes', label: 'New quotes', detail: 'When a provider responds to your request' },
  { key: 'messages', label: 'Messages', detail: 'New chat messages from providers or customers' },
  { key: 'promotions', label: 'Promotions', detail: 'Offers and product updates from Solid Connect' },
];

function relativeTime(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationsScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const profile = useSessionStore((s) => s.profile);
  const { data: notifications, isLoading } = useNotifications(profile?.id ?? null);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
      })
      .catch(() => {});
  }, []);

  function toggle(key: keyof Prefs) {
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  const rows: AppNotification[] = notifications ?? [];
  const unreadCount = rows.filter((n) => !n.read_at).length;

  return (
    <Screen>
      <ScreenHeader title="Notifications" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>INBOX{unreadCount > 0 ? ` · ${unreadCount} unread` : ''}</Text>
          {unreadCount > 0 && (
            <Pressable onPress={() => profile && markAllRead.mutate(profile.id)} hitSlop={8}>
              <Text style={styles.clearAll}>Clear all</Text>
            </Pressable>
          )}
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.ink} style={{ marginVertical: spacing.xl }} />
        ) : rows.length === 0 ? (
          <View style={styles.cardShadow}>
            <View style={styles.card}>
              <EmptyState title="No notifications yet" subtitle="Job updates, quotes, and messages will show up here." />
            </View>
          </View>
        ) : (
          <View style={styles.cardShadow}>
            <View style={styles.card}>
              {rows.map((n, i) => {
                const unread = !n.read_at;
                return (
                  <Pressable
                    key={n.id}
                    onPress={() => unread && markRead.mutate(n.id)}
                    style={[styles.row, i < rows.length - 1 && styles.rowBorder]}
                  >
                    <View style={styles.dotSlot}>{unread ? <View style={styles.dot} /> : null}</View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.title, unread && styles.titleUnread]} numberOfLines={2}>{n.title}</Text>
                      {n.body ? <Text style={styles.notifBody} numberOfLines={3}>{n.body}</Text> : null}
                      <Text style={styles.time}>{relativeTime(n.created_at)}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>PREFERENCES</Text>
        <View style={styles.cardShadow}>
          <View style={styles.card}>
            {ROWS.map((row, i) => (
              <View key={row.key} style={[styles.row, i < ROWS.length - 1 && styles.rowBorder]}>
                <View style={{ flex: 1, gap: 2, paddingRight: spacing.md }}>
                  <Text style={styles.rowLabel}>{row.label}</Text>
                  <Text style={styles.rowDetail}>{row.detail}</Text>
                </View>
                <Switch
                  value={prefs[row.key]}
                  onValueChange={() => toggle(row.key)}
                  trackColor={{ false: colors.hairline, true: colors.ink }}
                  thumbColor={Platform.OS === 'android' ? colors.white : undefined}
                />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    body: { padding: spacing.lg, gap: spacing.sm },
    sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2, marginBottom: 4 },
    sectionLabel: { fontSize: 11, fontFamily: fonts.extrabold, color: colors.inkFaint, letterSpacing: 0.6 },
    clearAll: { fontSize: 12.5, fontFamily: fonts.semibold, color: colors.ink },
    cardShadow: { borderRadius: radii.lg, backgroundColor: colors.card, ...shadow.card, marginBottom: spacing.md },
    card: { borderRadius: radii.lg, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'flex-start', padding: spacing.md, paddingHorizontal: spacing.lg, gap: spacing.sm },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
    dotSlot: { width: 8, alignItems: 'center', paddingTop: 6 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.ink },
    title: { fontSize: 14, fontFamily: fonts.medium, color: colors.inkMuted },
    titleUnread: { fontFamily: fonts.bold, color: colors.ink },
    notifBody: { fontSize: 12.5, fontFamily: fonts.regular, color: colors.inkFaint, lineHeight: 17 },
    time: { fontSize: 11, fontFamily: fonts.medium, color: colors.inkFainter, marginTop: 2 },
    rowLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink },
    rowDetail: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkFaint, marginTop: 2 },
  });
}
