/**
 * What a new provider still has to do before customers can find, trust and
 * book them. Each step maps to something the business actually depends on:
 *
 * - services:  a provider with no trade chosen cannot be found or matched
 * - hours:     on "schedule" mode with no hours set, a provider is effectively
 *              never available, so they would not get matched
 * - verify:    customers filter and rank by verification; unverified providers
 *              carry no trust badge
 * - portfolio: photos of finished work are what a customer looks at first
 */
export type SetupKey = 'services' | 'hours' | 'verify' | 'portfolio';

export type SetupItem = { key: SetupKey; title: string; detail: string; done: boolean };

export function providerSetupItems(input: {
  weeklyDays: number;
  verified: boolean;
  verificationLevel?: string | null;
  portfolioCount: number;
  /** Has chosen at least one service. Defaults to true. */
  hasServices?: boolean;
}): SetupItem[] {
  const isVerified = input.verified || (!!input.verificationLevel && input.verificationLevel !== 'REGISTERED');
  return [
    {
      key: 'services',
      title: 'Choose your services',
      detail: 'Pick the trades you offer so customers can find you.',
      done: input.hasServices ?? true,
    },
    {
      key: 'hours',
      title: 'Set your working hours',
      detail: 'Tell customers when you can take jobs, so you get matched.',
      done: input.weeklyDays > 0,
    },
    {
      key: 'verify',
      title: 'Verify your identity',
      detail: 'A verified badge makes customers far more likely to hire you.',
      done: isVerified,
    },
    {
      key: 'portfolio',
      title: 'Add photos of your work',
      detail: 'Show finished jobs. It is the first thing customers look at.',
      done: input.portfolioCount > 0,
    },
  ];
}

export function setupProgress(items: SetupItem[]): { done: number; total: number; complete: boolean } {
  const done = items.filter((i) => i.done).length;
  return { done, total: items.length, complete: done === items.length };
}
