import { useQuery } from '@tanstack/react-query';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMyBlocks, useUnblockUser } from '../../api/safety';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { supabase } from '../../lib/supabase';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, fontSizes, radii, shadow, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

export function BlockedUsersScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const profile = useSessionStore((s) => s.profile);
  const { data: blocks = [], isLoading } = useMyBlocks(profile?.id);
  const unblock = useUnblockUser(profile?.id);

  const ids = blocks.map((b) => b.blocked_id);
  const { data: names = {} } = useQuery({
    queryKey: ['blockedNames', ids.join(',')],
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.from('profiles').select('id, full_name').in('id', ids);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((p) => [p.id, p.full_name]));
    },
    enabled: ids.length > 0,
  });

  return (
    <Screen bg={colors.paperDim}>
      <ScreenHeader title="Blocked users" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        {!isLoading && blocks.length === 0 ? (
          <Text style={styles.empty}>You have not blocked anyone. Blocked people cannot message you and you cannot message them.</Text>
        ) : null}
        {blocks.map((b) => (
          <View key={b.blocked_id} style={styles.row}>
            <Text style={styles.name} numberOfLines={1}>
              {names[b.blocked_id] ?? 'Solid Connect user'}
            </Text>
            <Button
              title="Unblock"
              variant="outline"
              onPress={() => unblock.mutate(b.blocked_id)}
              disabled={unblock.isPending}
              style={styles.btn}
            />
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    body: { padding: spacing.lg, gap: spacing.md },
    empty: { fontSize: fontSizes.md, lineHeight: 25, fontFamily: fonts.regular, color: colors.inkMuted },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: radii.xxxl,
      backgroundColor: colors.card,
      padding: spacing.md,
      ...shadow.card,
    },
    name: { flex: 1, fontSize: fontSizes.lg, fontFamily: fonts.semibold, color: colors.ink },
    btn: { height: 40, paddingHorizontal: 16 },
  });
}
