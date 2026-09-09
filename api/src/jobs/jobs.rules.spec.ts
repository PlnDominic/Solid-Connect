import { canAdvanceJob, canConfirmJob, canFinishJob, canStartJob } from './jobs.rules';

describe('job rules', () => {
  it('allows provider to start an accepted job', () => {
    expect(
      canStartJob({
        actorId: 'p1',
        providerId: 'p1',
        status: 'accepted',
      }).ok,
    ).toBe(true);
  });

  it('allows provider to finish an in-progress job', () => {
    expect(
      canFinishJob({
        actorId: 'p1',
        providerId: 'p1',
        status: 'in_progress',
      }).ok,
    ).toBe(true);
  });

  it('blocks finish before start', () => {
    expect(
      canFinishJob({
        actorId: 'p1',
        providerId: 'p1',
        status: 'accepted',
      }).code,
    ).toBe('JOB_NOT_IN_PROGRESS');
  });

  it('blocks advance while awaiting customer', () => {
    expect(
      canAdvanceJob({
        actorId: 'p1',
        providerId: 'p1',
        status: 'awaiting_completion_confirmation',
        step: 5,
        providerCompletedAt: '2026-01-01',
      }).code,
    ).toBe('JOB_AWAITING_CUSTOMER');
  });

  it('requires awaiting confirmation before customer confirm', () => {
    expect(
      canConfirmJob({
        actorId: 'c1',
        customerId: 'c1',
        status: 'in_progress',
        step: 2,
        providerCompletedAt: null,
      }).code,
    ).toBe('JOB_NOT_READY');
  });

  it('allows customer confirm when awaiting', () => {
    expect(
      canConfirmJob({
        actorId: 'c1',
        customerId: 'c1',
        status: 'awaiting_completion_confirmation',
        step: 5,
        providerCompletedAt: '2026-01-01',
      }).ok,
    ).toBe(true);
  });
});
