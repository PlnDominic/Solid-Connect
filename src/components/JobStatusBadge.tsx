import { Badge } from './Badge';
import { JOB_STATUS_META, jobStatusLabel, jobStatusToneColors, jobStatusToneIcon } from '../lib/jobStatus';
import { useTheme } from '../theme/ThemeProvider';
import type { JobStatus } from '../types/database';

/** The one badge every job card/row uses for status - shared so "in
 * progress" always looks like "in progress", never a different color or
 * icon depending on which screen happens to render it. */
export function JobStatusBadge({ status, role }: { status: JobStatus; role: 'customer' | 'provider' }) {
  const { colors } = useTheme();
  const tone = JOB_STATUS_META[status].tone;
  const label = jobStatusLabel(status, role);
  const { bg, fg } = jobStatusToneColors(tone, colors);
  const Icon = jobStatusToneIcon(tone);
  return <Badge label={label} bg={bg} fg={fg} icon={<Icon size={11} strokeWidth={2.6} color={fg} />} />;
}
