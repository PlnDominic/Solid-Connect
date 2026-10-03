import type { Dispute } from '../types/database';

/** Photos each side may attach to one dispute (enforced again in the database). */
export const MAX_EVIDENCE_PER_PARTY = 5;

export type TimelineStep = { key: 'filed' | 'response' | 'resolved'; done: boolean; at: string | null };

/** The three stops a case moves through, for the progress display. */
export function disputeTimeline(d: Dispute): TimelineStep[] {
  return [
    { key: 'filed', done: true, at: d.created_at },
    { key: 'response', done: !!d.provider_responded_at, at: d.provider_responded_at ?? null },
    { key: 'resolved', done: d.status === 'resolved', at: d.resolved_at },
  ];
}

/** What the signed-in user may do on this case. The database enforces the
 * same rules; this only decides which controls to show. */
export function disputeAccess(
  d: Dispute,
  userId: string | null | undefined,
  myEvidenceCount: number,
): { canRespond: boolean; canAddEvidence: boolean; evidenceLeft: number } {
  const isProvider = !!userId && d.provider_id === userId;
  const isParty = isProvider || (!!userId && d.customer_id === userId);
  const open = d.status === 'open';
  const evidenceLeft = Math.max(0, MAX_EVIDENCE_PER_PARTY - myEvidenceCount);
  return {
    // An unpaid-balance report is the provider's own case (0065) - there's
    // nothing for them to respond to.
    canRespond: isProvider && open && !d.provider_responded_at && d.reason !== 'unpaid_balance',
    canAddEvidence: isParty && open && evidenceLeft > 0,
    evidenceLeft,
  };
}

/** Storage path: <dispute>/<author>/<file>. The bucket policy reads the
 * first two folders, so the shape must not change. */
export function evidencePath(disputeId: string, authorId: string, now: number, index: number): string {
  return `${disputeId}/${authorId}/${now}-${index}.jpg`;
}
