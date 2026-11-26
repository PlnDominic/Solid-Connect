import { isOlderVersion } from '../appVersion';

describe('isOlderVersion', () => {
  it('compares each part as a number', () => {
    expect(isOlderVersion('1.9.0', '1.10.0')).toBe(true);
    expect(isOlderVersion('1.0.0', '1.0.1')).toBe(true);
    expect(isOlderVersion('1.1', '1.1.0')).toBe(false);
    expect(isOlderVersion('2.0.0', '1.9.9')).toBe(false);
  });

  it('never locks anyone out when a value is missing or unreadable', () => {
    expect(isOlderVersion('1.0.0', null)).toBe(false);
    expect(isOlderVersion(undefined, '2.0.0')).toBe(false);
    expect(isOlderVersion('1.0.0', 'latest')).toBe(false);
    expect(isOlderVersion('1.0.0-beta', '2.0.0')).toBe(false);
  });
});
