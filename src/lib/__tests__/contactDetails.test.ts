import { findContactDetails, maskContactDetails } from '../contactDetails';

describe('findContactDetails', () => {
  it.each([
    'call me on 0241234567',
    'my number is 024 123 4567',
    'WhatsApp +233 24-123-4567',
    '(024) 123.4567',
    '233241234567',
  ])('flags the phone number in %p', (text) => {
    expect(findContactDetails(text)).toBe('phone');
  });

  it.each([
    'pay into 1441002345678',
    'account no 123456',
    'MoMo 554 321',
    'Bank: GCB, acct 0012 3456 7890 12',
  ])('flags the account details in %p', (text) => {
    expect(findContactDetails(text)).toBe('account');
  });

  it.each([
    'I can do it for GHS 1,500',
    'Can you come on 12/10/2026 at 10:30?',
    'Labour 300, materials 450, total 750',
    'Unit 12, house no. 45',
    'It is a 2 bedroom flat',
    '',
  ])('lets %p through', (text) => {
    expect(findContactDetails(text)).toBeNull();
  });
});

describe('maskContactDetails', () => {
  it('keeps only the first three and last two digits', () => {
    expect(maskContactDetails('call 024 123 4567 now')).toBe('call 024•••••67 now');
  });

  it('leaves short numbers alone', () => {
    expect(maskContactDetails('GHS 450')).toBe('GHS 450');
  });
});
