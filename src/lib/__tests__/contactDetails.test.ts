import { findContactDetails, maskContactDetails, numberWordsToDigits } from '../contactDetails';

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
    'zero two four one two three four five six seven',
    'Zero Two Four, one two three, four five six seven'.replace(/,/g, ''),
    'oh two four double one two three four five six',
    '024 one two three 4567',
    'zero five five triple seven one two three',
  ])('flags the phone number written in words in %p', (text) => {
    expect(findContactDetails(text)).toBe('phone');
  });

  it.each([
    'pay into 1441002345678',
    'account no 123456',
    'MoMo 554 321',
    'Bank: GCB, acct 0012 3456 7890 12',
    'momo five five four three two one',
  ])('flags the account details in %p', (text) => {
    expect(findContactDetails(text)).toBe('account');
  });

  it.each([
    'email me at kofi.mensah@gmail.com',
    'kofi at gmail dot com',
    'kofi (at) yahoo (dot) com',
    'kofi[at]outlook.com',
    'send it to my gmail',
  ])('flags the email in %p', (text) => {
    expect(findContactDetails(text)).toBe('email');
  });

  it.each([
    'find me @kofi_fixes',
    'my IG is kofifixes',
    'just WhatsApp me',
    'add me on Facebook',
    'I am on TikTok',
    'message me on telegram',
    'snapchat: kofi',
  ])('flags the social media detail in %p', (text) => {
    expect(findContactDetails(text)).toBe('social');
  });

  it.each(['see https://example.com/work', 'www.kofifixes.com', 'kofifixes.com/gallery', 'wa.me'])(
    'flags the link in %p',
    (text) => {
      expect(findContactDetails(text)).not.toBeNull();
    },
  );

  it.each([
    'I can do it for GHS 1,500',
    'Can you come on 12/10/2026 at 10:30?',
    'Labour 300, materials 450, total 750',
    'Unit 12, house no. 45',
    'It is a 2 bedroom flat',
    'I need one or two workers for three days',
    'Oh no, the pipe burst at nine',
    'I will be there at eight, about two hours',
    'The hinge might snap, and the pipe threads are worn',
    'Meet at the gate, it is instant work',
    '',
  ])('lets %p through', (text) => {
    expect(findContactDetails(text)).toBeNull();
  });
});

describe('numberWordsToDigits', () => {
  it('turns number words into digits', () => {
    expect(numberWordsToDigits('zero two four double five')).toBe('0 2 4 5 5');
  });
});

describe('maskContactDetails', () => {
  it('keeps only the first three and last two digits', () => {
    expect(maskContactDetails('call 024 123 4567 now')).toBe('call 024•••••67 now');
  });

  it('masks spelled-out numbers too', () => {
    expect(maskContactDetails('zero two four one two three four five six seven')).toBe('024•••••67');
  });

  it('masks emails and handles', () => {
    expect(maskContactDetails('kofi.mensah@gmail.com')).toBe('ko•••@gmail.com');
    expect(maskContactDetails('find me @kofi_fixes')).toBe('find me @ko•••');
  });

  it('leaves short numbers alone', () => {
    expect(maskContactDetails('GHS 450')).toBe('GHS 450');
  });
});
