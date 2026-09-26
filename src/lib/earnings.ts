// Pure earnings maths (no network) so it can be unit-tested.

export type PayoutStatus = 'pending' | 'paid' | 'failed';

export interface PayoutRow {
  id: string;
  gross_amount: number;
  commission_amount: number;
  net_amount: number;
  status: PayoutStatus;
  payout_method: string | null;
  payout_reference: string | null;
  paid_at: string | null;
  created_at: string;
  job_title: string | null;
}

export interface EarningsSummary {
  /** Owed to the provider, not yet sent. */
  pendingNet: number;
  /** Already sent to the provider. */
  paidNet: number;
  /** Net earned (pending + paid) with a payout created this calendar month. */
  monthNet: number;
  /** Total commission Solid Connect kept, all time. */
  commissionTotal: number;
  jobsPaid: number;
  /** Net earned per month for the last 6 months, oldest first. */
  months: { key: string; label: string; net: number }[];
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Pure so it can be unit-tested without a network. */
export function summarizePayouts(rows: PayoutRow[], now = new Date()): EarningsSummary {
  const months: EarningsSummary['months'] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: monthKey(d), label: d.toLocaleDateString('en-GB', { month: 'short' }), net: 0 });
  }
  const byKey = Object.fromEntries(months.map((m) => [m.key, m]));

  let pendingNet = 0;
  let paidNet = 0;
  let monthNet = 0;
  let commissionTotal = 0;
  let jobsPaid = 0;
  const thisMonth = monthKey(now);

  for (const r of rows) {
    if (r.status === 'failed') continue;
    const net = Number(r.net_amount) || 0;
    if (r.status === 'pending') pendingNet += net;
    if (r.status === 'paid') {
      paidNet += net;
      jobsPaid += 1;
    }
    commissionTotal += Number(r.commission_amount) || 0;
    const key = monthKey(new Date(r.created_at));
    if (key === thisMonth) monthNet += net;
    if (byKey[key]) byKey[key].net += net;
  }

  return { pendingNet, paidNet, monthNet, commissionTotal, jobsPaid, months };
}
