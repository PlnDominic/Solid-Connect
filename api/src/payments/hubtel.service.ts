import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isHubtelPaid } from './hubtel.util';

export type CheckoutSession = {
  checkoutUrl: string;
  checkoutId: string | null;
  clientReference: string;
};

@Injectable()
export class HubtelService {
  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.merchantAccount);
  }

  async initiateCheckout(input: {
    amount: number;
    description: string;
    clientReference: string;
    callbackUrl: string;
    returnUrl: string;
    cancellationUrl: string;
  }): Promise<CheckoutSession> {
    this.assertConfigured();
    const res = await fetch('https://payproxyapi.hubtel.com/items/initiate', {
      method: 'POST',
      headers: {
        Authorization: this.basicAuth(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        totalAmount: input.amount,
        description: input.description,
        callbackUrl: input.callbackUrl,
        returnUrl: input.returnUrl,
        cancellationUrl: input.cancellationUrl,
        merchantAccountNumber: this.merchantAccount,
        clientReference: input.clientReference,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      responseCode?: string;
      message?: string;
      data?: { checkoutUrl?: string; checkoutId?: string; clientReference?: string };
    };
    if (!res.ok || json.responseCode !== '0000' || !json.data?.checkoutUrl) {
      throw new ServiceUnavailableException({
        code: 'HUBTEL_CHECKOUT_FAILED',
        message: json.message || 'Hubtel could not start checkout.',
      });
    }
    return {
      checkoutUrl: json.data.checkoutUrl,
      checkoutId: json.data.checkoutId ?? null,
      clientReference: json.data.clientReference || input.clientReference,
    };
  }

  /** Re-query Hubtel before trusting a callback. */
  async isReferencePaid(clientReference: string): Promise<{ paid: boolean; transactionId: string | null; channel: string | null }> {
    this.assertConfigured();
    const url = `https://api-txnstatus.hubtel.com/transactions/${encodeURIComponent(this.merchantAccount!)}/status?clientReference=${encodeURIComponent(clientReference)}`;
    const res = await fetch(url, { headers: { Authorization: this.basicAuth() } });
    const json = (await res.json().catch(() => ({}))) as {
      responseCode?: string;
      data?: { status?: string; transactionId?: string; paymentMethod?: string };
    };
    const paid = res.ok && (json.responseCode === '0000' || json.responseCode === undefined) && isHubtelPaid(json.data?.status);
    return {
      paid,
      transactionId: json.data?.transactionId ?? null,
      channel: json.data?.paymentMethod ?? null,
    };
  }

  async sendMobileMoney(input: {
    recipientName: string;
    recipientMsisdn: string;
    channel: string;
    amount: number;
    clientReference: string;
    description: string;
    callbackUrl: string;
  }): Promise<{ ok: boolean; reference: string | null; message: string }> {
    this.assertConfigured();
    const account = this.config.get<string>('hubtel.prepaidAccount') || this.merchantAccount;
    const res = await fetch(
      `https://smp.hubtel.com/api/merchants/${encodeURIComponent(account!)}/send/mobilemoney`,
      {
        method: 'POST',
        headers: {
          Authorization: this.basicAuth(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          RecipientName: input.recipientName,
          RecipientMsisdn: input.recipientMsisdn,
          CustomerEmail: '',
          Channel: input.channel,
          Amount: input.amount,
          PrimaryCallbackURL: input.callbackUrl,
          Description: input.description,
          ClientReference: input.clientReference,
        }),
      },
    );
    const json = (await res.json().catch(() => ({}))) as {
      responseCode?: string;
      ResponseCode?: string;
      message?: string;
      Message?: string;
      data?: { transactionId?: string; TransactionId?: string };
      Data?: { TransactionId?: string };
    };
    const code = json.responseCode ?? json.ResponseCode;
    const reference =
      json.data?.transactionId ?? json.data?.TransactionId ?? json.Data?.TransactionId ?? input.clientReference;
    return {
      ok: res.ok && (code === '0000' || code === '0001'),
      reference,
      message: json.message ?? json.Message ?? '',
    };
  }

  callbackUrl(): string {
    return this.config.get<string>('hubtel.callbackUrl') ?? '';
  }

  returnUrl(): string {
    return this.config.get<string>('hubtel.returnUrl') || 'solidconnect://payment-return';
  }

  private assertConfigured() {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException({
        code: 'PAYMENTS_NOT_CONFIGURED',
        message: 'Hubtel payments are not configured on this server.',
      });
    }
  }

  private basicAuth() {
    return `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`;
  }

  private get clientId() {
    return this.config.get<string>('hubtel.clientId');
  }
  private get clientSecret() {
    return this.config.get<string>('hubtel.clientSecret');
  }
  private get merchantAccount() {
    return this.config.get<string>('hubtel.merchantAccount');
  }
}
