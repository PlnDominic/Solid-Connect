import { describe, it, expect } from 'vitest';
import { applyPaymentStatus, assertOk } from '../payments';

type Row = Record<string, any>;

/** Minimal in-memory stand-in for the slice of the Supabase client the
 * payment helper uses. `failOn` makes a given table/operation error. */
function fakeClient(tables: Record<string, Row[]>, failOn: string[] = []) {
  const from = (table: string) => {
    const filters: [string, any][] = [];
    let op: 'select' | 'update' | 'upsert' | 'delete' = 'select';
    let payload: Row | null = null;
    let single = false;
    const rows = () => (tables[table] ??= []).filter((r) => filters.every(([k, v]) => r[k] === v));
    const run = async () => {
      if (failOn.includes(`${table}.${op}`)) return { data: null, error: { message: `${table}.${op} boom` } };
      if (op === 'update') rows().forEach((r) => Object.assign(r, payload));
      if (op === 'delete') tables[table] = tables[table].filter((r) => !rows().includes(r));
      if (op === 'upsert') {
        const key = 'payment_id';
        const existing = tables[table].find((r) => r[key] === payload![key]);
        if (existing) Object.assign(existing, payload);
        else tables[table].push({ ...payload });
      }
      const found = op === 'select' ? rows().map((r) => ({ ...r })) : [];
      return { data: single ? (found[0] ?? null) : found, error: null };
    };
    const b: any = {
      select: () => b,
      update: (p: Row) => ((op = 'update'), (payload = p), b),
      upsert: (p: Row) => ((op = 'upsert'), (payload = p), b),
      delete: () => ((op = 'delete'), b),
      eq: (k: string, v: any) => (filters.push([k, v]), b),
      maybeSingle: () => ((single = true), run()),
      then: (res: any, rej: any) => run().then(res, rej),
    };
    return b;
  };
  return { from } as any;
}

const seed = () => ({
  payments: [{ id: 'p1', job_id: 'j1', amount: 100, status: 'pending', released_at: null, refund_reason: null, refund_amount: null, overridden_by: null, overridden_at: null }],
  jobs: [{ id: 'j1', provider_id: 'prov1' }],
  platform_config: [{ id: true, commission_percent: 10 }],
  provider_payouts: [] as Row[],
});

describe('assertOk', () => {
  it('throws with context when a write failed and is silent otherwise', () => {
    expect(() => assertOk({ message: 'nope' }, 'Saving')).toThrow('Saving failed: nope');
    expect(() => assertOk(null, 'Saving')).not.toThrow();
  });
});

describe('applyPaymentStatus', () => {
  it('releasing a payment creates a payout net of commission', async () => {
    const t = seed();
    await applyPaymentStatus(fakeClient(t), { paymentId: 'p1', status: 'released', adminId: 'a1' });
    expect(t.payments[0].status).toBe('released');
    expect(t.provider_payouts[0]).toMatchObject({ gross_amount: 100, commission_amount: 10, net_amount: 90 });
  });

  it('a partial refund pays the provider only the remainder', async () => {
    const t = seed();
    await applyPaymentStatus(fakeClient(t), { paymentId: 'p1', status: 'partially_refunded', adminId: 'a1', refundAmount: 40 });
    expect(t.payments[0]).toMatchObject({ status: 'partially_refunded', refund_amount: 40 });
    expect(t.provider_payouts[0]).toMatchObject({ gross_amount: 60, net_amount: 54 });
  });

  it('rejects a partial refund that is zero or covers the whole amount', async () => {
    await expect(applyPaymentStatus(fakeClient(seed()), { paymentId: 'p1', status: 'partially_refunded', adminId: 'a1', refundAmount: 0 })).rejects.toThrow();
    await expect(applyPaymentStatus(fakeClient(seed()), { paymentId: 'p1', status: 'partially_refunded', adminId: 'a1', refundAmount: 100 })).rejects.toThrow();
  });

  it('refunding cancels a pending payout but leaves a paid one alone', async () => {
    const pending = seed();
    pending.provider_payouts.push({ payment_id: 'p1', status: 'pending' });
    await applyPaymentStatus(fakeClient(pending), { paymentId: 'p1', status: 'refunded', adminId: 'a1' });
    expect(pending.provider_payouts).toHaveLength(0);

    const paid = seed();
    paid.provider_payouts.push({ payment_id: 'p1', status: 'paid' });
    await applyPaymentStatus(fakeClient(paid), { paymentId: 'p1', status: 'refunded', adminId: 'a1' });
    expect(paid.provider_payouts).toHaveLength(1);
  });

  it('restores the payment and rethrows when the payout write fails', async () => {
    const t = seed();
    await expect(
      applyPaymentStatus(fakeClient(t, ['provider_payouts.upsert']), { paymentId: 'p1', status: 'released', adminId: 'a1' }),
    ).rejects.toThrow('Saving the payout failed');
    expect(t.payments[0]).toMatchObject({ status: 'pending', released_at: null, overridden_by: null });
    expect(t.provider_payouts).toHaveLength(0);
  });
});
