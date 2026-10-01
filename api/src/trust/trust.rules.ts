const DISPUTE_WINDOW_MS = 48 * 60 * 60 * 1000;

/** A completed job can be disputed for 48 hours. An unfinished job has no clock yet. */
export function disputeWindowOpen(completedAt: string | null | undefined, now = Date.now()): boolean {
  if (!completedAt) return true;
  const t = new Date(completedAt).getTime();
  if (Number.isNaN(t)) return false;
  return now - t <= DISPUTE_WINDOW_MS;
}

export function isReviewRating(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= 5;
}
