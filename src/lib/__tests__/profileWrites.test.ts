import { isProfileAlreadyExists } from '../profileWrites';

describe('isProfileAlreadyExists', () => {
  it('is true when the profile row for this id already exists', () => {
    expect(
      isProfileAlreadyExists({
        code: '23505',
        message: 'duplicate key value violates unique constraint "profiles_pkey"',
        details: 'Key (id)=(1b2c) already exists.',
      }),
    ).toBe(true);
  });

  it('recognises it from the details alone', () => {
    expect(isProfileAlreadyExists({ code: '23505', message: 'duplicate key', details: 'Key (id)=(x) already exists.' })).toBe(true);
  });

  it('is false when the phone number is what clashed', () => {
    expect(
      isProfileAlreadyExists({
        code: '23505',
        message: 'duplicate key value violates unique constraint "profiles_phone_key"',
        details: 'Key (phone)=(0241234567) already exists.',
      }),
    ).toBe(false);
  });

  it('is false for other errors and for no error', () => {
    expect(isProfileAlreadyExists({ code: '42501', message: 'permission denied for table profiles' })).toBe(false);
    expect(isProfileAlreadyExists({ message: 'network request failed' })).toBe(false);
    expect(isProfileAlreadyExists(null)).toBe(false);
    expect(isProfileAlreadyExists(undefined)).toBe(false);
  });
});
