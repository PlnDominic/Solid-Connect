import { disputeWindowOpen, isReviewRating } from './trust.rules';

describe('trust.rules', () => {
  it('accepts star ratings 1 through 5', () => {
    expect(isReviewRating(1)).toBe(true);
    expect(isReviewRating(5)).toBe(true);
    expect(isReviewRating(0)).toBe(false);
    expect(isReviewRating(3.5)).toBe(false);
  });

  it('keeps the dispute window open until 48 hours after completion', () => {
    const completed = '2026-09-28T00:00:00.000Z';
    const inside = new Date(completed).getTime() + 47 * 60 * 60 * 1000;
    const outside = new Date(completed).getTime() + 49 * 60 * 60 * 1000;
    expect(disputeWindowOpen(null, inside)).toBe(true);
    expect(disputeWindowOpen(completed, inside)).toBe(true);
    expect(disputeWindowOpen(completed, outside)).toBe(false);
  });
});
