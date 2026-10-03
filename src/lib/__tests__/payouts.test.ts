import {
  cleanDigits,
  isValidGhanaPhone,
  maskAccount,
  validateMoMoPayout,
  validateBankPayout,
  formatPayoutAccountSummary,
  formatGhanaPhone,
} from '../payouts';

describe('src/lib/payouts', () => {
  describe('cleanDigits', () => {
    it('strips non-digit characters', () => {
      expect(cleanDigits('+233 (024) 123-4567')).toBe('2330241234567');
      expect(cleanDigits('050 482 1999')).toBe('0504821999');
      expect(cleanDigits('abc')).toBe('');
    });
  });

  describe('isValidGhanaPhone', () => {
    it('accepts standard 10-digit local numbers', () => {
      expect(isValidGhanaPhone('0241234567')).toBe(true);
      expect(isValidGhanaPhone('055 987 6543')).toBe(true);
      expect(isValidGhanaPhone('020 111 2233')).toBe(true);
    });

    it('accepts international +233 numbers', () => {
      expect(isValidGhanaPhone('+233241234567')).toBe(true);
      expect(isValidGhanaPhone('233 24 123 4567')).toBe(true);
    });

    it('rejects too short or malformed numbers', () => {
      expect(isValidGhanaPhone('12345')).toBe(false);
      expect(isValidGhanaPhone('')).toBe(false);
    });
  });

  describe('formatGhanaPhone', () => {
    it('formats local 10-digit number with spaces', () => {
      expect(formatGhanaPhone('0241234567')).toBe('024 123 4567');
    });

    it('formats 233 number', () => {
      expect(formatGhanaPhone('+233241234567')).toBe('+233 24 123 4567');
    });
  });

  describe('maskAccount', () => {
    it('masks phone or account numbers leaving only last 4 digits', () => {
      expect(maskAccount('0241234821')).toBe('•••• 4821');
      expect(maskAccount('1441001234567890')).toBe('•••• 7890');
      expect(maskAccount('')).toBe('••••');
    });
  });

  describe('validateMoMoPayout', () => {
    it('validates a correct MoMo payload', () => {
      const res = validateMoMoPayout({
        network: 'MTN',
        phone: '024 123 4567',
        accountName: 'Kwame Mensah',
      });
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('fails if network is missing or invalid', () => {
      const res = validateMoMoPayout({
        phone: '024 123 4567',
        accountName: 'Kwame Mensah',
      });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('network');
    });

    it('fails if phone number is invalid', () => {
      const res = validateMoMoPayout({
        network: 'MTN',
        phone: '123',
        accountName: 'Kwame Mensah',
      });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('mobile number');
    });

    it('fails if account name is missing', () => {
      const res = validateMoMoPayout({
        network: 'Telecel',
        phone: '020 123 4567',
        accountName: '',
      });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('account holder name');
    });
  });

  describe('validateBankPayout', () => {
    it('validates a correct Bank payload', () => {
      const res = validateBankPayout({
        bankName: 'GCB Bank',
        accountNumber: '10123456789',
        accountName: 'Kwame Mensah',
      });
      expect(res.valid).toBe(true);
    });

    it('fails on short account number', () => {
      const res = validateBankPayout({
        bankName: 'GCB Bank',
        accountNumber: '123',
        accountName: 'Kwame Mensah',
      });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('account number');
    });
  });

  describe('formatPayoutAccountSummary', () => {
    it('handles unset account', () => {
      const res = formatPayoutAccountSummary(null);
      expect(res.title).toBe('No payout account');
      expect(res.masked).toBe('Not configured');
    });

    it('handles MoMo account', () => {
      const res = formatPayoutAccountSummary({
        type: 'momo',
        network: 'MTN',
        phone: '0241234821',
        accountName: 'Kofi Manu',
      });
      expect(res.title).toBe('MTN Mobile Money');
      expect(res.masked).toBe('•••• 4821');
      expect(res.holder).toBe('Kofi Manu');
      expect(res.badge).toBe('MTN');
    });

    it('handles Bank account', () => {
      const res = formatPayoutAccountSummary({
        type: 'bank',
        bankName: 'Stanbic Bank',
        accountNumber: '9040001234',
        accountName: 'Kofi Manu',
      });
      expect(res.title).toBe('Stanbic Bank');
      expect(res.masked).toBe('•••• 1234');
      expect(res.holder).toBe('Kofi Manu');
      expect(res.badge).toBe('Bank');
    });
  });
});
