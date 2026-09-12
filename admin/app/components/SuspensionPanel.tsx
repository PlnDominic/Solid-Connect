import { suspendProfile, unsuspendProfile } from '../(protected)/suspension-actions';

/** Suspend/unsuspend block shared by the provider and customer detail
 * pages - same table (profiles), same action, same shape either way. */
export function SuspensionPanel({
  id,
  redirectPath,
  suspendedAt,
  suspendedReason,
}: {
  id: string;
  redirectPath: string;
  suspendedAt: string | null;
  suspendedReason: string | null;
}) {
  if (suspendedAt) {
    return (
      <form action={unsuspendProfile.bind(null, id, redirectPath)} style={{ display: 'grid', gap: 10 }}>
        <p style={{ fontSize: 13, color: 'var(--red)' }}>
          Suspended {new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(new Date(suspendedAt))}
        </p>
        {suspendedReason && (
          <>
            <label>Reason</label>
            <p style={{ fontSize: 13, margin: 0 }}>{suspendedReason}</p>
          </>
        )}
        <button className="btn" style={{ background: 'var(--green)' }}>Re-enable account</button>
      </form>
    );
  }

  return (
    <form action={suspendProfile.bind(null, id, redirectPath)} className="actions">
      <textarea className="field" name="reason" required placeholder="Reason for suspension - shown to the account holder." />
      <button className="btn reject">Suspend account</button>
    </form>
  );
}
