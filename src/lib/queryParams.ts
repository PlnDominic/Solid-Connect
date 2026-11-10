/**
 * Reads the parameters of an auth redirect URL - the query string and the
 * #fragment merged, with `errorCode` pulled out. Same behaviour as
 * expo-auth-session's internal getQueryParams, which SDK 58 no longer lets
 * apps import (its package `exports` omit build/QueryParams).
 */
export function getQueryParams(input: string): { errorCode: string | null; params: Record<string, string> } {
  const url = new URL(input, 'https://phony.example');
  const errorCode = url.searchParams.get('errorCode');
  url.searchParams.delete('errorCode');
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  if (url.hash) {
    new URLSearchParams(url.hash.replace(/^#/, '')).forEach((value, key) => {
      params[key] = value;
    });
  }
  return { errorCode, params };
}
