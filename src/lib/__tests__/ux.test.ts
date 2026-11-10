import { budgetAllowed, budgetStatus } from '../budget';
import { providerSetupItems, setupProgress } from '../providerSetup';
import { roleSwitchCopy } from '../confirmRoleSwitch';

const band = { min: 150, max: 900 };

describe('budgetStatus', () => {
  it('allows the usual range and bigger jobs, refuses under the minimum', () => {
    expect(budgetStatus(400, band)).toBe('ok');
    expect(budgetStatus(5000, band)).toBe('above');
    expect(budgetAllowed(budgetStatus(5000, band))).toBe(true);
    expect(budgetStatus(100, band)).toBe('below');
    expect(budgetAllowed(budgetStatus(100, band))).toBe(false);
  });
  it('rejects empty, zero, and absurd amounts', () => {
    expect(budgetStatus(NaN, band, false)).toBe('empty');
    expect(budgetStatus(0, band)).toBe('invalid');
    expect(budgetStatus(2_000_000, band)).toBe('invalid');
  });
});

describe('providerSetupItems', () => {
  it('lists what a brand-new provider still has to do', () => {
    const items = providerSetupItems({ weeklyDays: 0, verified: false, portfolioCount: 0, hasServices: false });
    expect(items.map((i) => i.key)).toEqual(['services', 'hours', 'verify', 'portfolio']);
    expect(setupProgress(items)).toEqual({ done: 0, total: 4, complete: false });
  });
  it('counts verification by level or flag and completes when all done', () => {
    const items = providerSetupItems({ weeklyDays: 5, verified: false, verificationLevel: 'IDENTITY_VERIFIED', portfolioCount: 2 });
    expect(setupProgress(items).complete).toBe(true);
    expect(providerSetupItems({ weeklyDays: 1, verified: false, verificationLevel: 'REGISTERED', portfolioCount: 1 })[2].done).toBe(false);
  });
});

describe('roleSwitchCopy', () => {
  it('explains the business terms when becoming a provider', () => {
    expect(roleSwitchCopy('provider').message).toMatch(/first job is free/i);
    expect(roleSwitchCopy('customer').title).toMatch(/customer/i);
  });
});
