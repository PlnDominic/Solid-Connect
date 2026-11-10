import { ratingLabel } from '../rating';

describe('ratingLabel', () => {
  it('shows New for a provider with no reviews, whatever number is stored', () => {
    expect(ratingLabel({ provider_rating: 4.8, provider_jobs_count: 0 })).toBe('New');
    expect(ratingLabel({ provider_rating: 0, provider_jobs_count: 0 })).toBe('New');
  });
  it('shows New when a count exists but there is no rating yet', () => {
    expect(ratingLabel({ provider_rating: 0, provider_jobs_count: 3 })).toBe('New');
  });
  it('shows the real average once there are reviews', () => {
    expect(ratingLabel({ provider_rating: 4.5, provider_jobs_count: 2 })).toBe('4.5');
    expect(ratingLabel({ provider_rating: 5, provider_jobs_count: 1 })).toBe('5.0');
  });
  it('copes with missing values', () => {
    expect(ratingLabel({})).toBe('New');
    expect(ratingLabel({ provider_rating: null, provider_jobs_count: null })).toBe('New');
  });
});
