import { summarizePayouts, type PayoutRow } from '../earnings';

const row = (over: Partial<PayoutRow>): PayoutRow => ({
  id: 'p',
  gross_amount: 100,
  commission_amount: 10,
  net_amount: 90,
  status: 'pending',
  payout_method: null,
  payout_reference: null,
  paid_at: null,
  created_at: '2026-09-10T10:00:00Z',
  job_title: null,
  ...over,
});

describe('summarizePayouts', () => {
  const now = new Date('2026-09-20T12:00:00Z');

  it('splits pending and paid and ignores failed payouts', () => {
    const s = summarizePayouts(
      [row({ status: 'pending', net_amount: 90 }), row({ status: 'paid', net_amount: 45, commission_amount: 5 }), row({ status: 'failed', net_amount: 999 })],
      now,
    );
    expect(s.pendingNet).toBe(90);
    expect(s.paidNet).toBe(45);
    expect(s.jobsPaid).toBe(1);
    expect(s.commissionTotal).toBe(15);
  });

  it('counts only this calendar month in monthNet and buckets the last six months', () => {
    const s = summarizePayouts(
      [row({ net_amount: 90, created_at: '2026-09-02T10:00:00Z' }), row({ net_amount: 50, created_at: '2026-07-15T10:00:00Z' }), row({ net_amount: 7, created_at: '2025-01-01T10:00:00Z' })],
      now,
    );
    expect(s.monthNet).toBe(90);
    expect(s.months).toHaveLength(6);
    expect(s.months[5].net).toBe(90);
    expect(s.months[3].net).toBe(50);
    expect(s.months.reduce((t, m) => t + m.net, 0)).toBe(140);
  });

  it('handles no payouts', () => {
    const s = summarizePayouts([], now);
    expect(s.pendingNet + s.paidNet + s.monthNet).toBe(0);
  });
});
