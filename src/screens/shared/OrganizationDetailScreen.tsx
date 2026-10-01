import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Button } from '../../components/Button';
import {
  findProfileIdByEmail,
  useAddOrgMember,
  useCreateProject,
  useCreateRecurringService,
  useCreateWorkforceRequest,
  useOrganization,
} from '../../api/organizations';
import { useCategories } from '../../api/marketplace';
import { fonts, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

export function OrganizationDetailScreen({ navigation, route }: { navigation: any; route: any }) {
  const orgId = route.params?.orgId as string;
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { data: org, isLoading } = useOrganization(orgId);
  const { data: categories } = useCategories();
  const createProject = useCreateProject(orgId);
  const createRequest = useCreateWorkforceRequest(orgId);
  const addMember = useAddOrgMember(orgId);
  const createRecurring = useCreateRecurringService(orgId);

  const [projectTitle, setProjectTitle] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [requestDesc, setRequestDesc] = useState('');
  const [requestBudget, setRequestBudget] = useState('500');
  const [requestLocation, setRequestLocation] = useState('Accra');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const firstCategory = categories?.[0];

  async function onAddProject() {
    setError(null);
    setMessage(null);
    if (projectTitle.trim().length < 2) {
      setError('Enter a project title.');
      return;
    }
    try {
      await createProject.mutateAsync({ title: projectTitle.trim(), locationLabel: requestLocation });
      setProjectTitle('');
      setMessage('Project created.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create project.');
    }
  }

  async function onAddMember() {
    setError(null);
    setMessage(null);
    const profileId = await findProfileIdByEmail(memberEmail);
    if (!profileId) {
      setError('No Solid Connect account found with that email.');
      return;
    }
    try {
      await addMember.mutateAsync({ profileId, role: 'member' });
      setMemberEmail('');
      setMessage('Member added.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add member.');
    }
  }

  async function onWorkforceRequest() {
    setError(null);
    setMessage(null);
    if (!firstCategory) {
      setError('No service categories available.');
      return;
    }
    const budget = parseInt(requestBudget, 10);
    if (!budget || budget < 1) {
      setError('Enter a budget.');
      return;
    }
    try {
      await createRequest.mutateAsync({
        categoryId: firstCategory.id,
        categoryLabel: firstCategory.name,
        description: requestDesc.trim() || `${firstCategory.name} workforce request`,
        locationLabel: requestLocation.trim() || 'Accra',
        budget,
        projectId: org?.projects?.[0]?.id,
      });
      setRequestDesc('');
      setMessage('Workforce request posted. Providers will be matched.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create request.');
    }
  }

  async function onRecurring() {
    setError(null);
    setMessage(null);
    if (!firstCategory) {
      setError('No service categories available.');
      return;
    }
    const budget = parseInt(requestBudget, 10);
    if (!budget || budget < 1) {
      setError('Enter a budget.');
      return;
    }
    try {
      await createRecurring.mutateAsync({
        categoryId: firstCategory.id,
        categoryLabel: firstCategory.name,
        description: requestDesc.trim() || `Recurring ${firstCategory.name}`,
        locationLabel: requestLocation.trim() || 'Accra',
        budget,
        cadence: 'weekly',
        projectId: org?.projects?.[0]?.id,
      });
      setMessage('Weekly recurring service scheduled.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not schedule recurring service.');
    }
  }

  return (
    <Screen>
      <ScreenHeader title={org?.name ?? 'Organization'} onBack={() => navigation.goBack()} />
      {isLoading || !org ? (
        <ActivityIndicator color={colors.ink} style={{ marginTop: spacing.xl }} />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.meta}>
            {(org as any).myRole ? `${(org as any).myRole} · ` : ''}
            {org.area || 'No area'} · {org.status}
          </Text>
          {org.description ? <Text style={styles.lead}>{org.description}</Text> : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {message ? <Text style={styles.ok}>{message}</Text> : null}

          <Text style={styles.section}>Members</Text>
          {(org.members ?? []).map((m) => {
            const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
            return (
              <View key={m.profile_id} style={styles.row}>
                <Text style={styles.rowTitle}>{profile?.full_name ?? 'Member'}</Text>
                <Text style={styles.rowSub}>{m.role}</Text>
              </View>
            );
          })}
          <TextInput
            style={styles.input}
            placeholder="Add member by email"
            placeholderTextColor={colors.inkMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={memberEmail}
            onChangeText={setMemberEmail}
          />
          <Button title="Add member" variant="outline" onPress={onAddMember} loading={addMember.isPending} />

          <Text style={styles.section}>Projects</Text>
          {(org.projects ?? []).length === 0 ? (
            <Text style={styles.rowSub}>No projects yet.</Text>
          ) : (
            org.projects.map((p) => (
              <View key={p.id} style={styles.row}>
                <Text style={styles.rowTitle}>{p.title}</Text>
                <Text style={styles.rowSub}>{p.status.replaceAll('_', ' ')}</Text>
              </View>
            ))
          )}
          <TextInput
            style={styles.input}
            placeholder="New project title"
            placeholderTextColor={colors.inkMuted}
            value={projectTitle}
            onChangeText={setProjectTitle}
          />
          <Button title="Create project" variant="outline" onPress={onAddProject} loading={createProject.isPending} />

          <Text style={styles.section}>Workforce request</Text>
          <Text style={styles.rowSub}>
            Uses {firstCategory?.name ?? 'the first category'} · attaches to the first project when one exists.
          </Text>
          <TextInput
            style={[styles.input, styles.area]}
            placeholder="What do you need?"
            placeholderTextColor={colors.inkMuted}
            multiline
            value={requestDesc}
            onChangeText={setRequestDesc}
          />
          <TextInput
            style={styles.input}
            placeholder="Budget (GHS)"
            placeholderTextColor={colors.inkMuted}
            keyboardType="number-pad"
            value={requestBudget}
            onChangeText={setRequestBudget}
          />
          <TextInput
            style={styles.input}
            placeholder="Location"
            placeholderTextColor={colors.inkMuted}
            value={requestLocation}
            onChangeText={setRequestLocation}
          />
          <Button title="Post workforce request" onPress={onWorkforceRequest} loading={createRequest.isPending} />
          <Button title="Schedule weekly recurring" variant="outline" onPress={onRecurring} loading={createRecurring.isPending} />

          <Text style={styles.section}>Recurring</Text>
          {(org.recurring ?? []).length === 0 ? (
            <Text style={styles.rowSub}>No recurring schedules.</Text>
          ) : (
            org.recurring.map((r) => (
              <View key={r.id} style={styles.row}>
                <Text style={styles.rowTitle}>{r.category_label}</Text>
                <Text style={styles.rowSub}>
                  {r.cadence} · next {new Date(r.next_run_at).toLocaleDateString()} · {r.active ? 'active' : 'paused'}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    body: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxxl },
    meta: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkMuted },
    lead: { fontFamily: fonts.regular, fontSize: 15, color: colors.ink, lineHeight: 22 },
    section: {
      fontFamily: fonts.semibold,
      fontSize: 13,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.inkMuted,
      marginTop: spacing.lg,
    },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      fontFamily: fonts.regular,
      fontSize: 16,
      color: colors.ink,
      backgroundColor: colors.surface,
    },
    area: { minHeight: 88, textAlignVertical: 'top' },
    error: { fontFamily: fonts.regular, color: colors.danger, fontSize: 14 },
    ok: { fontFamily: fonts.regular, color: colors.confirm, fontSize: 14 },
    row: {
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
    rowSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkMuted, marginTop: 2 },
  });
}
