import type { VerificationRepo } from './verification-repo';

export type ReviewError = 'not_found' | 'already_reviewed' | 'missing_reason';
export type ReviewResult = { ok: true } | { ok: false; error: ReviewError };

export async function approveVerification(repo: VerificationRepo, id: string, adminId: string): Promise<ReviewResult> {
  const record = await repo.getById(id);
  if (!record) return { ok: false, error: 'not_found' };
  if (record.status !== 'pending') return { ok: false, error: 'already_reviewed' };
  // Mark the provider verified before flipping the submission's own status:
  // setProviderVerified is idempotent, so if this succeeds but markApproved
  // then fails (network blip, transient error), retrying is safe - the
  // submission is still pending and can be approved again. Doing it in the
  // other order would leave a permanently-stuck approved-but-not-verified
  // row, since the pending-only guard blocks any retry once markApproved
  // has run.
  await repo.setProviderVerified(record.providerId);
  const updated = await repo.markApproved(id, adminId);
  if (!updated) return { ok: false, error: 'already_reviewed' };
  return { ok: true };
}

export async function rejectVerification(
  repo: VerificationRepo,
  id: string,
  adminId: string,
  note: string
): Promise<ReviewResult> {
  if (!note.trim()) return { ok: false, error: 'missing_reason' };
  const record = await repo.getById(id);
  if (!record) return { ok: false, error: 'not_found' };
  if (record.status !== 'pending') return { ok: false, error: 'already_reviewed' };
  const updated = await repo.markRejected(id, adminId, note.trim());
  if (!updated) return { ok: false, error: 'already_reviewed' };
  return { ok: true };
}
