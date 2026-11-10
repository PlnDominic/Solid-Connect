import { getQueryParams } from '../queryParams';

describe('getQueryParams', () => {
  it('reads PKCE code from the query string', () => {
    expect(getQueryParams('solidconnect://auth/callback?code=abc123').params).toEqual({ code: 'abc123' });
  });

  it('merges implicit-flow tokens from the fragment', () => {
    const { params, errorCode } = getQueryParams(
      'solidconnect://auth/callback?x=1#access_token=at&refresh_token=rt&expires_in=3600',
    );
    expect(errorCode).toBeNull();
    expect(params).toEqual({ x: '1', access_token: 'at', refresh_token: 'rt', expires_in: '3600' });
  });

  it('pulls errorCode out of the params', () => {
    const { params, errorCode } = getQueryParams('solidconnect://auth/callback?errorCode=access_denied&state=s');
    expect(errorCode).toBe('access_denied');
    expect(params).toEqual({ state: 's' });
  });

  it('decodes an error description from the fragment', () => {
    const { params } = getQueryParams('solidconnect://cb#error=access_denied&error_description=Email+link+expired');
    expect(params.error_description).toBe('Email link expired');
  });
});
