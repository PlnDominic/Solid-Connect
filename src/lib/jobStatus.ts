import { Check, Clock, Wrench, type LucideIcon } from 'lucide-react-native';
import type { ThemeColors } from '../theme/ThemeProvider';
import type { JobStatus } from '../types/database';

/**
 * Every screen that shows a job's status (customer/provider Jobs lists,
 * customer/provider Job Detail) used to spell out the raw status enum
 * inline ("AWAITING_COMPLETION_CONFIRMATION") - technically accurate, but
 * exactly the jargon writing.md warns against. One shared table, one
 * wording per status per role, used everywhere a job's status is shown.
 */
export type JobStatusTone = 'pending' | 'active' | 'confirm';

interface JobStatusMeta {
  tone: JobStatusTone;
  customerLabel: string;
  providerLabel: string;
  customerHint: string;
  providerHint: string;
}

export const JOB_STATUS_META: Record<JobStatus, JobStatusMeta> = {
  accepted: {
    tone: 'pending',
    customerLabel: 'Waiting to start',
    providerLabel: 'Ready to start',
    customerHint: 'Your provider hasn’t started yet.',
    providerHint: 'Tap Start work when you begin on site.',
  },
  in_progress: {
    tone: 'active',
    customerLabel: 'In progress',
    providerLabel: 'In progress',
    customerHint: 'Provider is on site, working.',
    providerHint: 'When you finish, mark the job complete for the customer to confirm.',
  },
  awaiting_completion_confirmation: {
    tone: 'pending',
    customerLabel: 'Confirm completion',
    providerLabel: 'Awaiting customer',
    customerHint: 'Provider marked the job finished. Confirm to release payment.',
    providerHint: 'Waiting for the customer to confirm completion and release payment.',
  },
  completed: {
    tone: 'confirm',
    customerLabel: 'Completed',
    providerLabel: 'Completed',
    customerHint: 'Job completed. Payment released.',
    providerHint: 'Job completed. Payment released.',
  },
};

export function jobStatusLabel(status: JobStatus, role: 'customer' | 'provider'): string {
  const meta = JOB_STATUS_META[status];
  return role === 'customer' ? meta.customerLabel : meta.providerLabel;
}

export function jobStatusHint(status: JobStatus, role: 'customer' | 'provider'): string {
  const meta = JOB_STATUS_META[status];
  return role === 'customer' ? meta.customerHint : meta.providerHint;
}

/** The bg/fg pair for a tone - one definition, shared by JobStatusBadge
 * and any other status-colored element (e.g. the Job Detail progress
 * card's icon chip and left accent) so "in progress" is always the same
 * orange, never a slightly different one per screen. */
export function jobStatusToneColors(tone: JobStatusTone, colors: ThemeColors): { bg: string; fg: string } {
  if (tone === 'confirm') return { bg: colors.confirmBg, fg: colors.confirm };
  if (tone === 'active') return { bg: colors.activeBg, fg: colors.activeDeep };
  return { bg: colors.pendingBg, fg: colors.pending };
}

/** The one icon per tone - Wrench for "actively being worked on", Clock
 * for "waiting on someone", Check for "done". */
export function jobStatusToneIcon(tone: JobStatusTone): LucideIcon {
  if (tone === 'confirm') return Check;
  if (tone === 'active') return Wrench;
  return Clock;
}
