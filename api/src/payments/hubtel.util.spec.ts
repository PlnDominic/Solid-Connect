import { clientReferenceFromCallback, isHubtelPaid } from './hubtel.util';

describe('hubtel.util', () => {
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
