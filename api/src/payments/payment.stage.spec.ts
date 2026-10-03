import { nextCharge, stageReference } from './payment.stage';

describe('nextCharge', () => {
  const pay = (status: string, deposit = 90, amount = 300) => ({ amount, deposit_amount: deposit, status });

  it('asks for the deposit first, then the balance once the work is done', () => {
    expect(nextCharge(pay('pending'), 'accepted')).toEqual({ kind: 'deposit', amount: 90 });
    expect(nextCharge(pay('deposit_held'), 'in_progress')).toEqual({ kind: 'none', reason: 'BALANCE_NOT_DUE' });
    expect(nextCharge(pay('deposit_held'), 'awaiting_completion_confirmation')).toEqual({ kind: 'balance', amount: 210 });
    expect(nextCharge(pay('held'), 'awaiting_completion_confirmation')).toEqual({ kind: 'none', reason: 'PAID' });
  });

  it('falls back to one full payment when deposits are off', () => {
    expect(nextCharge(pay('pending', 0), 'accepted')).toEqual({ kind: 'full', amount: 300 });
    expect(nextCharge({ amount: 300, deposit_amount: null, status: 'pending' }, 'accepted')).toEqual({ kind: 'full', amount: 300 });
  });

  it('never charges a cancelled or refunded booking', () => {
    for (const status of ['forfeited', 'refunded', 'partially_refunded']) {
      expect(nextCharge(pay(status), 'cancelled')).toEqual({ kind: 'none', reason: 'NOT_PAYABLE' });
    }
  });

  it('gives each stage its own Hubtel reference', () => {
    const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
    expect(stageReference(id, 'deposit')).toBe('sd_0f8fad5bd9cb469fa16570867728950e');
    expect(stageReference(id, 'balance')).toBe('sc_0f8fad5bd9cb469fa16570867728950e');
  });
});
