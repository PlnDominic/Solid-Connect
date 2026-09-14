import { Check, Clock, Wrench } from 'lucide-react-native';
import { Badge } from './Badge';
import { JOB_STATUS_META, jobStatusLabel } from '../lib/jobStatus';
import { useTheme } from '../theme/ThemeProvider';
import type { JobStatus } from '../types/database';

/** The one badge every job card/row uses for status - shared so "in
 * progress" always looks like "in progress", never a different color or
 * icon depending on which screen happens to render it. */
export function JobStatusBadge({ status, role }: { status: JobStatus; role: 'customer' | 'provider' }) {
  const { colors } = useTheme();
  const tone = JOB_STATUS_META[status].tone;
  const label = jobStatusLabel(status, role);
  const toneStyle =
    tone === 'confirm'
      ? { bg: colors.confirmBg, fg: colors.confirm, icon: <Check size={11} strokeWidth={3} color={colors.confirm} /> }
      : tone === 'active'
        ? { bg: colors.activeBg, fg: colors.activeDeep, icon: <Wrench size={11} strokeWidth={2.4} color={colors.activeDeep} /> }
        : { bg: colors.pendingBg, fg: colors.pending, icon: <Clock size={11} strokeWidth={2.6} color={colors.pending} /> };
  return <Badge label={label} bg={toneStyle.bg} fg={toneStyle.fg} icon={toneStyle.icon} />;
}
