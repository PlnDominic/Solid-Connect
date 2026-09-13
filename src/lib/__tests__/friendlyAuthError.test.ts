import { friendlyAuthError } from '../friendlyAuthError';

const NETWORK_FALLBACK = "Couldn't reach Solid Connect. Check your connection and try again.";

describe('friendlyAuthError', () => {
  it('passes through a real Supabase auth error message unchanged', () => {
    expect(friendlyAuthError({ message: 'Invalid login credentials' }, 'fallback')).toBe('Invalid login credentials');
  });

  it('accepts a plain string error', () => {
    expect(friendlyAuthError('Email already registered', 'fallback')).toBe('Email already registered');
  });

  it('recognizes a native network exception and returns the friendly message', () => {
    const nativeError = {
      message: 'UnexpectedException: The network connection was lost. (at ExpoModulesCore/Promise.swift:56)',
    };
    expect(friendlyAuthError(nativeError, 'fallback')).toBe(NETWORK_FALLBACK);
  });

  it('recognizes "network request failed" (React Native fetch)', () => {
    expect(friendlyAuthError({ message: 'Network request failed' }, 'fallback')).toBe(NETWORK_FALLBACK);
  });

  it('recognizes "timed out" and "timeout" variants case-insensitively', () => {
    expect(friendlyAuthError({ message: 'Request TIMED OUT' }, 'fallback')).toBe(NETWORK_FALLBACK);
    expect(friendlyAuthError({ message: 'connection timeout' }, 'fallback')).toBe(NETWORK_FALLBACK);
  });

  it('does not treat an unrelated message containing similar words as a network error', () => {
    // Guards against an overly broad regex swallowing real auth errors.
    expect(friendlyAuthError({ message: 'Password must be at least 8 characters' }, 'fallback')).toBe(
      'Password must be at least 8 characters',
    );
  });

  it('handles a PostgrestError/StorageError-shaped object (plain object, not instanceof Error)', () => {
    const postgrestError = { message: 'duplicate key value violates unique constraint', code: '23505' };
    expect(friendlyAuthError(postgrestError, 'fallback')).toBe('duplicate key value violates unique constraint');
  });

  it('falls back when the error has no usable message', () => {
    expect(friendlyAuthError({}, 'Something went wrong.')).toBe('Something went wrong.');
    expect(friendlyAuthError(null, 'Something went wrong.')).toBe('Something went wrong.');
    expect(friendlyAuthError(undefined, 'Something went wrong.')).toBe('Something went wrong.');
  });

  it('falls back when the message is an empty string', () => {
    expect(friendlyAuthError({ message: '' }, 'Something went wrong.')).toBe('Something went wrong.');
  });
});
