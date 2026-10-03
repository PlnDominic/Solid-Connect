import { bookingSecured, paymentStep } from '../paymentStage';

describe('paymentStep', () => {
  const pay = (status: any, deposit_amount = 90, amount = 300) => ({ status, deposit_amount, amount });

  it('deposit first, balance after the work, then nothing', () => {
    expect(paymentStep(pay('pending'), 'accepted')).toEqual({ kind: 'deposit', amount: 90 });
    expect(paymentStep(pay('deposit_held'), 'in_progress')).toEqual({ kind: 'balance_not_due' });
    expect(paymentStep(pay('deposit_held'), 'awaiting_completion_confirmation')).toEqual({ kind: 'balance', amount: 210 });
    expect(paymentStep(pay('held'), 'awaiting_completion_confirmation')).toEqual({ kind: 'paid' });
    expect(paymentStep(pay('forfeited'), 'cancelled')).toEqual({ kind: 'closed' });
  });

  it('one full payment when deposits are off', () => {
    expect(paymentStep(pay('pending', 0), 'accepted')).toEqual({ kind: 'full', amount: 300 });
  });
});

describe('bookingSecured', () => {
  it('needs the deposit unless none is required', () => {
    expect(bookingSecured({ status: 'pending', deposit_amount: 90 })).toBe(false);
    expect(bookingSecured({ status: 'deposit_held', deposit_amount: 90 })).toBe(true);
    expect(bookingSecured({ status: 'pending', deposit_amount: 0 })).toBe(true);
    expect(bookingSecured(null)).toBe(true);
  });
});
