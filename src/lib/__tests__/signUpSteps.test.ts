import {
  firstMissingSignUpStep,
  isPlausiblePhone,
  isProfileOnboarded,
  profileSignUpDetails,
} from '../signUpSteps';

const complete = {
  fullName: 'Ama Mensah',
  phone: '024 123 4567',
  area: 'Achimota',
  email: 'ama@example.com',
  role: 'customer' as const,
  termsAccepted: true,
  hasProviderCategory: false,
};

describe('firstMissingSignUpStep', () => {
  it('returns null when every required detail is present', () => {
    expect(firstMissingSignUpStep(complete)).toBeNull();
  });

  it('sends a first-time Google user (name + email only) to the phone step, not straight to role', () => {
    expect(
      firstMissingSignUpStep({ fullName: 'Ama Mensah', email: 'ama@gmail.com', phone: '', area: '' }),
    ).toBe('phone');
  });

  it('asks for the name first when there is none', () => {
    expect(firstMissingSignUpStep({ ...complete, fullName: ' ' })).toBe('name');
  });

  it('asks for location when the phone is there but the area is not', () => {
    expect(firstMissingSignUpStep({ ...complete, area: '' })).toBe('location');
  });

  it('asks for email when it is missing or malformed', () => {
    expect(firstMissingSignUpStep({ ...complete, email: '' })).toBe('email');
    expect(firstMissingSignUpStep({ ...complete, email: 'not-an-email' })).toBe('email');
  });

  it('asks for role when no role is chosen or the terms were never accepted', () => {
    expect(firstMissingSignUpStep({ ...complete, role: undefined })).toBe('role');
    expect(firstMissingSignUpStep({ ...complete, termsAccepted: false })).toBe('role');
  });

  it('asks a provider with no trade to pick one', () => {
    expect(firstMissingSignUpStep({ ...complete, role: 'provider', hasProviderCategory: false })).toBe('category');
    expect(firstMissingSignUpStep({ ...complete, role: 'provider', hasProviderCategory: true })).toBeNull();
  });

  it('rejects an implausible phone number', () => {
    expect(firstMissingSignUpStep({ ...complete, phone: '123' })).toBe('phone');
  });
});

describe('profileSignUpDetails', () => {
  it('flags a profile created by the old Google shortcut (no phone, no terms) as incomplete', () => {
    const details = profileSignUpDetails({
      full_name: 'Kofi Boateng',
      phone: null,
      area: 'Achimota, Accra',
      email: 'kofi@gmail.com',
      role: 'customer',
      terms_accepted_at: null,
      provider_category: null,
    });
    expect(firstMissingSignUpStep(details)).toBe('phone');
  });

  it('treats a fully onboarded provider profile as complete', () => {
    const details = profileSignUpDetails({
      full_name: 'Kofi Boateng',
      phone: '0241234567',
      area: 'Osu, Accra',
      email: 'kofi@example.com',
      role: 'provider',
      terms_accepted_at: '2026-09-01T00:00:00Z',
      provider_category: 'Plumbing',
    });
    expect(firstMissingSignUpStep(details)).toBeNull();
    expect(isProfileOnboarded(details)).toBe(true);
  });

  it('treats an onboarded Google provider with no phone as already done', () => {
    const details = profileSignUpDetails({
      full_name: 'Benjamin Tetteh Nartey',
      phone: null,
      area: 'Achimota, Accra',
      email: 'benjaminnartey37@gmail.com',
      role: 'provider',
      terms_accepted_at: '2026-10-01T07:43:26Z',
      provider_category: 'Web & Tech',
    });
    expect(firstMissingSignUpStep(details)).toBe('phone');
    expect(isProfileOnboarded(details)).toBe(true);
  });
});

describe('isProfileOnboarded', () => {
  it('rejects a profile that never accepted terms', () => {
    expect(isProfileOnboarded({ ...complete, termsAccepted: false })).toBe(false);
  });
});

describe('isPlausiblePhone', () => {
  it('accepts local and international formats with at least 9 digits', () => {
    expect(isPlausiblePhone('024 123 4567')).toBe(true);
    expect(isPlausiblePhone('+233 24 123 4567')).toBe(true);
  });
  it('rejects letters and short numbers', () => {
    expect(isPlausiblePhone('024-abc')).toBe(false);
    expect(isPlausiblePhone('12345')).toBe(false);
  });
});
