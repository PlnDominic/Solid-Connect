import { canAcceptQuote, canReviseQuote } from './quotes.rules';

describe('quote rules', () => {
  it('allows customer to accept an open quote on an open request', () => {
    expect(
      canAcceptQuote({
        quoteStatus: 'sent',
        requestStatus: 'quoted',
        requestCustomerId: 'c1',
        actorId: 'c1',
      }).ok,
    ).toBe(true);
  });

  it('blocks non-owner accept', () => {
    expect(
      canAcceptQuote({
        quoteStatus: 'sent',
        requestStatus: 'quoted',
        requestCustomerId: 'c1',
        actorId: 'c2',
      }).code,
    ).toBe('NOT_REQUEST_OWNER');
  });

  it('blocks revise after accept', () => {
    expect(
      canReviseQuote({ quoteStatus: 'accepted', providerId: 'p1', actorId: 'p1' }).code,
    ).toBe('QUOTE_LOCKED');
  });
});
