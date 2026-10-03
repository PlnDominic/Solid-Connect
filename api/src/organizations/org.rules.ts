export type OrgMemberRole = 'owner' | 'admin' | 'member';
export type ProjectStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';
export type RecurringCadence = 'weekly' | 'biweekly' | 'monthly';

export function canManageMembers(role: OrgMemberRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

export function canManageProjects(role: OrgMemberRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin' || role === 'member';
}

export function nextRunAfter(cadence: RecurringCadence, from: Date = new Date()): Date {
  const d = new Date(from.getTime());
  if (cadence === 'weekly') d.setUTCDate(d.getUTCDate() + 7);
  else if (cadence === 'biweekly') d.setUTCDate(d.getUTCDate() + 14);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

export function isOrgMemberRole(value: string): value is OrgMemberRole {
  return value === 'owner' || value === 'admin' || value === 'member';
}
