import type { VerificationRepo } from './verification-repo';

export type ReviewError = 'not_found' | 'already_reviewed' | 'missing_reason';
export type ReviewResult = { ok: true } | { ok: false; error: ReviewError };

export async function approveVerification(repo: VerificationRepo, id: string, adminId: string): Promise<ReviewResult> {
  const record = await repo.getById(id);
  if (!record) return { ok: false, error: 'not_found' };
  if (record.status !== 'pending') return { ok: false, error: 'already_reviewed' };
  await repo.markApproved(id, adminId);
  await repo.setProviderVerified(record.providerId);
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
  await repo.markRejected(id, adminId, note.trim());
  return { ok: true };
}
