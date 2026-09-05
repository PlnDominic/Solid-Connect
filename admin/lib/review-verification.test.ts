import { describe, expect, it } from 'vitest';
import { approveVerification, rejectVerification } from './review-verification';
import type { VerificationRecord, VerificationRepo } from './verification-repo';

class FakeVerificationRepo implements VerificationRepo {
  records = new Map<string, VerificationRecord>();
  providerVerified = new Set<string>();
  reviews: { id: string; adminId: string; status: string; note?: string }[] = [];

  seed(record: VerificationRecord) {
    this.records.set(record.id, record);
  }

  async getById(id: string) {
    return this.records.get(id) ?? null;
  }

  async markApproved(id: string, adminId: string) {
    const record = this.records.get(id);
    if (record) this.records.set(id, { ...record, status: 'approved' });
    this.reviews.push({ id, adminId, status: 'approved' });
  }

  async markRejected(id: string, adminId: string, note: string) {
    const record = this.records.get(id);
    if (record) this.records.set(id, { ...record, status: 'rejected' });
    this.reviews.push({ id, adminId, status: 'rejected', note });
  }

  async setProviderVerified(providerId: string) {
    this.providerVerified.add(providerId);
  }
}

describe('approveVerification', () => {
  it('approves a pending submission and marks the provider verified', async () => {
    const repo = new FakeVerificationRepo();
    repo.seed({ id: 'v1', providerId: 'p1', status: 'pending' });

    const result = await approveVerification(repo, 'v1', 'admin-1');

    expect(result).toEqual({ ok: true });
    expect(repo.records.get('v1')?.status).toBe('approved');
    expect(repo.providerVerified.has('p1')).toBe(true);
  });

  it('rejects approving a submission that is not pending', async () => {
    const repo = new FakeVerificationRepo();
    repo.seed({ id: 'v1', providerId: 'p1', status: 'approved' });

    const result = await approveVerification(repo, 'v1', 'admin-1');

    expect(result).toEqual({ ok: false, error: 'already_reviewed' });
    expect(repo.providerVerified.has('p1')).toBe(false);
  });

  it('returns not_found for a missing submission', async () => {
    const repo = new FakeVerificationRepo();
    const result = await approveVerification(repo, 'missing', 'admin-1');
    expect(result).toEqual({ ok: false, error: 'not_found' });
  });
});

describe('rejectVerification', () => {
  it('rejects a pending submission with a reason', async () => {
    const repo = new FakeVerificationRepo();
    repo.seed({ id: 'v1', providerId: 'p1', status: 'pending' });

    const result = await rejectVerification(repo, 'v1', 'admin-1', 'Blurry ID photo');

    expect(result).toEqual({ ok: true });
    expect(repo.records.get('v1')?.status).toBe('rejected');
    expect(repo.reviews[0]).toMatchObject({ status: 'rejected', note: 'Blurry ID photo' });
  });

  it('requires a non-empty reason', async () => {
    const repo = new FakeVerificationRepo();
    repo.seed({ id: 'v1', providerId: 'p1', status: 'pending' });

    const result = await rejectVerification(repo, 'v1', 'admin-1', '   ');

    expect(result).toEqual({ ok: false, error: 'missing_reason' });
  });

  it('blocks rejecting an already-reviewed submission', async () => {
    const repo = new FakeVerificationRepo();
    repo.seed({ id: 'v1', providerId: 'p1', status: 'rejected' });

    const result = await rejectVerification(repo, 'v1', 'admin-1', 'reason');

    expect(result).toEqual({ ok: false, error: 'already_reviewed' });
  });
});
