'use client';
import { useActionState } from 'react';
type ReviewAction = (state: { error?: string; success?: boolean }, formData: FormData) => Promise<{ error?: string; success?: boolean }>;
export function ReviewControls({ approve, reject }: { approve: ReviewAction; reject: ReviewAction }) {
  const [approveState, approveAction, approvePending] = useActionState(approve, {});
  const [rejectState, rejectAction, rejectPending] = useActionState(reject, {});
  return <div className="actions"><form action={approveAction}><button className="button approve" disabled={approvePending}>{approvePending ? 'Approving…' : 'Approve verification'}</button>{approveState.error && <p className="notice">{approveState.error}</p>}{approveState.success && <p>Approved.</p>}</form><form action={rejectAction}><label htmlFor="note">Reason for rejection</label><textarea className="field" id="note" name="note" required placeholder="Explain what the provider needs to correct." /><button className="button reject" disabled={rejectPending}>{rejectPending ? 'Rejecting…' : 'Reject submission'}</button>{rejectState.error && <p className="notice">{rejectState.error}</p>}</form></div>;
}
