/** Pure job lifecycle rules for unit tests. */

export function canStartJob(input: {
  actorId: string;
  providerId: string;
  status: string;
}) {
  if (input.actorId !== input.providerId) return { ok: false as const, code: 'NOT_JOB_PROVIDER' };
  if (input.status === 'completed') return { ok: false as const, code: 'JOB_ALREADY_COMPLETED' };
  if (input.status === 'awaiting_completion_confirmation') {
    return { ok: false as const, code: 'JOB_AWAITING_CUSTOMER' };
  }
  if (input.status === 'in_progress') return { ok: true as const, idempotent: true };
  if (input.status !== 'accepted') return { ok: false as const, code: 'JOB_NOT_STARTABLE' };
  return { ok: true as const };
}

export function canFinishJob(input: {
  actorId: string;
  providerId: string;
  status: string;
}) {
  if (input.actorId !== input.providerId) return { ok: false as const, code: 'NOT_JOB_PROVIDER' };
  if (input.status === 'completed') return { ok: false as const, code: 'JOB_ALREADY_COMPLETED' };
  if (input.status === 'awaiting_completion_confirmation') {
    return { ok: true as const, idempotent: true };
  }
  if (input.status !== 'in_progress') return { ok: false as const, code: 'JOB_NOT_IN_PROGRESS' };
  return { ok: true as const };
}

/** @deprecated Prefer canStartJob / canFinishJob */
export function canAdvanceJob(input: {
  actorId: string;
  providerId: string;
  status: string;
  step: number;
  providerCompletedAt: string | null;
}) {
  if (input.status === 'accepted') return canStartJob(input);
  if (input.status === 'in_progress') return canFinishJob(input);
  if (input.actorId !== input.providerId) return { ok: false as const, code: 'NOT_JOB_PROVIDER' };
  if (input.status === 'completed') return { ok: false as const, code: 'JOB_ALREADY_COMPLETED' };
  if (input.status === 'awaiting_completion_confirmation' || input.providerCompletedAt || input.step >= 5) {
    return { ok: false as const, code: 'JOB_AWAITING_CUSTOMER' };
  }
  return { ok: false as const, code: 'JOB_NOT_ADVANCEABLE' };
}

export function canConfirmJob(input: {
  actorId: string;
  customerId: string;
  status: string;
  step: number;
  providerCompletedAt: string | null;
}) {
  if (input.actorId !== input.customerId) return { ok: false as const, code: 'NOT_JOB_CUSTOMER' };
  if (input.status === 'awaiting_completion_confirmation') return { ok: true as const };
  if (input.providerCompletedAt || input.step >= 5) return { ok: true as const };
  return { ok: false as const, code: 'JOB_NOT_READY' };
}
