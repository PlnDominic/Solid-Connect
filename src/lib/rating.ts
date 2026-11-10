/** A provider's rating as shown to people: the real average once they have
 * at least one review, "New" before that (never an invented number). */
export function ratingLabel(p: { provider_rating?: number | null; provider_jobs_count?: number | null }): string {
  const reviews = Number(p.provider_jobs_count ?? 0);
  const rating = Number(p.provider_rating ?? 0);
  if (reviews <= 0 || rating <= 0) return 'New';
  return rating.toFixed(1);
}
