import type { BankPayoutDetails, MoMoNetwork, MoMoPayoutDetails, ProviderPayoutAccount } from '../types/database';

export const MOMO_NETWORKS: { id: MoMoNetwork; label: string; short: string }[] = [
  { id: 'MTN', label: 'MTN Mobile Money', short: 'MTN MoMo' },
  { id: 'Telecel', label: 'Telecel Cash', short: 'Telecel' },
  { id: 'AirtelTigo', label: 'AirtelTigo Money', short: 'AirtelTigo' },
];

export const GHANA_BANKS = [
  'GCB Bank',
  'Ecobank Ghana',
  'Stanbic Bank',
  'Absa Bank Ghana',
  'Fidelity Bank',
  'CalBank',
  'Zenith Bank Ghana',
  'Standard Chartered Ghana',
  'Access Bank Ghana',
  'Agricultural Development Bank (ADB)',
  'Consolidated Bank Ghana (CBG)',
  'Prudential Bank',
  'Republic Bank',
  'Societe Generale Ghana',
  'First National Bank',
  'Other Bank',
] as const;

/** Cleans a phone string to plain digits. */
export function cleanDigits(v: string): string {
  return v.replace(/[^\d]/g, '');
}

/**
 * Validates a Ghanaian phone number:
 * Accepts local format (e.g. 024 123 4567, 10 digits) or international (+233 24 123 4567, 12 digits).
 */
export function isValidGhanaPhone(phone: string): boolean {
  const digits = cleanDigits(phone);
  if (digits.startsWith('233') && digits.length === 12) return true;
  if (digits.startsWith('0') && digits.length === 10) return true;
  return digits.length >= 9 && digits.length <= 13;
}

/** Formats a phone number for display with spacing. */
export function formatGhanaPhone(phone: string): string {
  const digits = cleanDigits(phone);
  if (digits.startsWith('233') && digits.length === 12) {
    return `+233 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return phone.trim();
}

/** Returns the last 4 digits preceded by bullet mask. */
export function maskAccount(numberOrPhone: string): string {
  const digits = cleanDigits(numberOrPhone);
  if (!digits) return '••••';
  const lastFour = digits.slice(-4);
  return `•••• ${lastFour}`;
}

export function validateMoMoPayout(details: {
  network?: string;
  phone?: string;
  accountName?: string;
}): { valid: boolean; error?: string } {
  if (!details.network || !MOMO_NETWORKS.some((n) => n.id === details.network)) {
    return { valid: false, error: 'Please select a Mobile Money network.' };
  }
  if (!details.phone || !isValidGhanaPhone(details.phone)) {
    return { valid: false, error: 'Please enter a valid 10-digit Ghanaian mobile number.' };
  }
  if (!details.accountName || details.accountName.trim().length < 2) {
    return { valid: false, error: 'Please enter the registered account holder name.' };
  }
  return { valid: true };
}

export function validateBankPayout(details: {
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
}): { valid: boolean; error?: string } {
  if (!details.bankName || details.bankName.trim().length < 2) {
    return { valid: false, error: 'Please select or enter your bank name.' };
  }
  const digits = cleanDigits(details.accountNumber ?? '');
  if (digits.length < 6 || digits.length > 20) {
    return { valid: false, error: 'Please enter a valid bank account number (at least 6 digits).' };
  }
  if (!details.accountName || details.accountName.trim().length < 2) {
    return { valid: false, error: 'Please enter the exact bank account holder name.' };
  }
  return { valid: true };
}

export function formatPayoutAccountSummary(account?: ProviderPayoutAccount | null): {
  title: string;
  masked: string;
  holder: string;
  badge: string;
} {
  if (!account) {
    return {
      title: 'No payout account',
      masked: 'Not configured',
      holder: '',
      badge: 'Unset',
    };
  }

  if (account.type === 'momo') {
    const net = MOMO_NETWORKS.find((n) => n.id === account.network)?.label ?? `${account.network} MoMo`;
    return {
      title: net,
      masked: maskAccount(account.phone),
      holder: account.accountName,
      badge: account.network,
    };
  }

  return {
    title: account.bankName,
    masked: maskAccount(account.accountNumber),
    holder: account.accountName,
    badge: 'Bank',
  };
}
