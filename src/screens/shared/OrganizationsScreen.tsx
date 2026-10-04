import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Building2 } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { useCreateOrganization, useMyOrganizations } from '../../api/organizations';
import { fonts, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';
import { isApiConfigured } from '../../lib/api';

export function OrganizationsScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { data: orgs, isLoading } = useMyOrganizations();
  const createOrg = useCreateOrganization();
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onCreate() {
    setError(null);
    if (!isApiConfigured()) {
      setError('Start the API to create an organization.');
      return;
    }
    if (name.trim().length < 2) {
      setError('Enter an organization name.');
      return;
    }
    try {
      const org = await createOrg.mutateAsync({ name: name.trim(), area: area.trim() || undefined });
      setName('');
      setArea('');
      navigation.navigate('OrganizationDetail', { orgId: org.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create organization.');
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Organizations" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.lead}>
          Create a business or agency account to manage projects, team members, and workforce requests.
        </Text>

        <View style={styles.card}>
          <Text style={styles.section}>New organization</Text>
          <TextInput
            style={styles.input}
            placeholder="Organization name"
            placeholderTextColor={colors.inkMuted}
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.input}
            placeholder="Area (e.g. Accra)"
            placeholderTextColor={colors.inkMuted}
            value={area}
            onChangeText={setArea}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Create organization" onPress={onCreate} loading={createOrg.isPending} />
        </View>

        <Text style={styles.section}>Your organizations</Text>
        {isLoading ? (
          <ActivityIndicator color={colors.ink} />
        ) : (orgs ?? []).length === 0 ? (
          <EmptyState title="No organizations yet" subtitle="Create one above to start a project." />
        ) : (
          (orgs ?? []).map((org) => (
            <Pressable
              key={org.id}
              style={styles.row}
              onPress={() => navigation.navigate('OrganizationDetail', { orgId: org.id })}
            >
              <Building2 size={20} color={colors.ink} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{org.name}</Text>
                <Text style={styles.rowSub}>
                  {org.myRole ?? 'member'}
                  {org.area ? ` · ${org.area}` : ''}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
    lead: { fontFamily: fonts.regular, fontSize: 17, color: colors.inkMuted, lineHeight: 25 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      gap: spacing.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.hairline,
    },
    section: {
      fontFamily: fonts.semibold,
      fontSize: 15,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.inkMuted,
      marginTop: spacing.sm,
    },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.hairline,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      fontFamily: fonts.regular,
      fontSize: 18,
      color: colors.ink,
      backgroundColor: colors.bg,
    },
    error: { fontFamily: fonts.regular, color: colors.danger ?? '#b42318', fontSize: 16 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.lg,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.hairline,
    },
    rowTitle: { fontFamily: fonts.semibold, fontSize: 18, color: colors.ink },
    rowSub: { fontFamily: fonts.regular, fontSize: 15, color: colors.inkMuted, marginTop: 2 },
  });
}
