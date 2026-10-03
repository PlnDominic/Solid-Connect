import { clientReferenceFromCallback, isHubtelPaid, momoChannel, toMsisdn } from './hubtel.util';

describe('hubtel.util', () => {
  it('maps Ghana prefixes to Hubtel channels', () => {
    expect(momoChannel('0241234567')).toBe('mtn-gh');
    expect(momoChannel('+233501234567')).toBe('vodafone-gh');
    expect(momoChannel('0271234567')).toBe('tigo-gh');
    expect(momoChannel('0210000000')).toBeNull();
  });

  it('normalizes local numbers to MSISDN', () => {
    expect(toMsisdn('024 123 4567')).toBe('233241234567');
    expect(toMsisdn('233241234567')).toBe('233241234567');
    expect(toMsisdn('123')).toBeNull();
  });

  it('treats Hubtel success statuses as paid', () => {
    expect(isHubtelPaid('Paid')).toBe(true);
    expect(isHubtelPaid('Success')).toBe(true);
    expect(isHubtelPaid('Unpaid')).toBe(false);
  });

  it('reads ClientReference from either callback shape', () => {
    expect(clientReferenceFromCallback({ Data: { ClientReference: 'sc_1' } })).toBe('sc_1');
    expect(clientReferenceFromCallback({ clientReference: 'sc_2' })).toBe('sc_2');
    expect(clientReferenceFromCallback({})).toBeNull();
  });
});
