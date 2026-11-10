/** The most a request budget can be (a sanity limit, not a price opinion). */
export const MAX_BUDGET_GHS = 1_000_000;

export type BudgetStatus = 'empty' | 'invalid' | 'below' | 'ok' | 'above';

/**
 * How a typed budget compares with the usual range for a service.
 *
 * - below: under the usual minimum. Not allowed: providers rarely take work
 *   that pays less, so a request like that would just sit unanswered.
 * - above: over the usual maximum. Allowed: bigger jobs are real; providers
 *   quote what the job needs. The screen explains instead of blocking.
 */
export function budgetStatus(amount: number, band: { min: number; max: number }, hasText = true): BudgetStatus {
  if (!hasText) return 'empty';
  if (!Number.isFinite(amount) || amount < 1 || amount > MAX_BUDGET_GHS) return 'invalid';
  if (amount < band.min) return 'below';
  if (amount > band.max) return 'above';
  return 'ok';
}

export function budgetAllowed(status: BudgetStatus): boolean {
  return status === 'ok' || status === 'above';
}
