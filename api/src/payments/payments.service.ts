import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { HubtelService } from './hubtel.service';
import { clientReferenceFromCallback, momoChannel, toMsisdn } from './hubtel.util';
import { nextCharge, stageReference } from './payment.stage';

type PaymentRow = {
  id: string;
  job_id: string;
  amount: number;
  deposit_amount: number | null;
  status: string;
  client_reference: string | null;
  deposit_reference: string | null;
  checkout_url: string | null;
};

const NOT_DUE_MESSAGES = {
  PAID: 'This job is already paid.',
  BALANCE_NOT_DUE: 'The balance is due once the provider has finished the job.',
  NOT_PAYABLE: 'This job cannot be paid right now.',
} as const;

@Injectable()
export class PaymentsService {
  private readonly log = new Logger(PaymentsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly hubtel: HubtelService,
  ) {}

  async checkout(jobId: string, customerId: string) {
    const job = await this.loadJob(jobId);
    if (job.customer_id !== customerId) {
      throw new ForbiddenException({ code: 'NOT_JOB_CUSTOMER', message: 'Only the customer can pay for this job.' });
    }
    if (job.status === 'cancelled' || job.status === 'completed') {
      throw new BadRequestException({ code: 'JOB_NOT_PAYABLE', message: 'This job cannot be paid right now.' });
    }

    const payment = await this.loadPayment(jobId);
    // Deposit to secure the booking, then the balance once the work is done -
    // both to Solid Connect, never to the provider.
    const charge = nextCharge(payment, job.status);
    if (charge.kind === 'none') {
      if (charge.reason === 'PAID') {
        return { payment, checkoutUrl: null as string | null, alreadyPaid: true, stage: null };
      }
      throw new BadRequestException({ code: charge.reason, message: NOT_DUE_MESSAGES[charge.reason] });
    }

    const clientReference = stageReference(payment.id, charge.kind);
    const callback = this.hubtel.callbackUrl();
    if (!callback) {
      throw new BadRequestException({
        code: 'HUBTEL_CALLBACK_MISSING',
        message: 'HUBTEL_CALLBACK_URL is not set.',
      });
    }
    const returnUrl = this.hubtel.returnUrl();
    const session = await this.hubtel.initiateCheckout({
      amount: charge.amount,
      description: `Solid Connect · ${charge.kind === 'deposit' ? 'Deposit' : charge.kind === 'balance' ? 'Balance' : 'Payment'} · ${job.title ?? 'Job'}`.slice(0, 100),
      clientReference,
      callbackUrl: callback,
      returnUrl,
      cancellationUrl: returnUrl,
    });

    const { error } = await this.supabase.client
      .from('payments')
      .update({
        gateway: 'hubtel',
        ...(charge.kind === 'deposit'
          ? { deposit_reference: session.clientReference }
          : { client_reference: session.clientReference, gateway_transaction_id: session.checkoutId }),
        checkout_url: session.checkoutUrl,
      })
      .eq('id', payment.id)
      .eq('status', payment.status);
    if (error) throw new BadRequestException({ code: 'PAYMENT_SAVE_FAILED', message: error.message });

    return {
      payment,
      checkoutUrl: session.checkoutUrl,
      alreadyPaid: false,
      stage: { kind: charge.kind, amount: charge.amount },
    };
  }

  /** Customer returned from Hubtel — confirm with their status API. */
  async refresh(jobId: string, customerId: string) {
    const job = await this.loadJob(jobId);
    if (job.customer_id !== customerId) {
      throw new ForbiddenException({ code: 'NOT_JOB_CUSTOMER', message: 'Only the customer can refresh this payment.' });
    }
    const payment = await this.loadPayment(jobId);
    // Check whichever checkout is outstanding.
    if (payment.status === 'pending' && payment.deposit_reference) {
      await this.captureIfPaid(payment.deposit_reference);
    } else if ((payment.status === 'pending' || payment.status === 'deposit_held') && payment.client_reference) {
      await this.captureIfPaid(payment.client_reference);
    } else {
      return payment;
    }
    return this.loadPayment(jobId);
  }

  async handleCallback(body: Record<string, unknown>) {
    const reference = clientReferenceFromCallback(body);
    if (!reference) return { ok: true, ignored: true };
    await this.captureIfPaid(reference);
    return { ok: true };
  }

  /** When Hubtel is live, confirmation cannot release an unpaid row. Only a
   * payment Hubtel actually captured (`held`) - or one already released -
   * counts as paid. */
  async assertHeldIfGatewayLive(jobId: string) {
    if (!this.hubtel.isConfigured()) return;
    const payment = await this.loadPayment(jobId);
    if (payment.status !== 'held' && payment.status !== 'released') {
      throw new BadRequestException({
        code: 'PAYMENT_REQUIRED',
        message: 'Pay the balance to Solid Connect before confirming completion.',
      });
    }
  }

  /** Best-effort MoMo payout after the payment is released. Failures stay pending. */
  async disburse(jobId: string) {
    if (!this.hubtel.isConfigured()) return;
    const payment = await this.loadPayment(jobId);
    if (payment.status !== 'released') return;

    const { data: payout } = await this.supabase.client
      .from('provider_payouts')
      .select('id, status, net_amount, provider_id')
      .eq('payment_id', payment.id)
      .maybeSingle();
    if (!payout || payout.status === 'paid') return;

    const { data: provider } = await this.supabase.client
      .from('profiles')
      .select('full_name, phone, payout_account')
      .eq('id', payout.provider_id)
      .maybeSingle();
    // A Mobile Money account set on the payout screen wins; otherwise the
    // profile phone. Bank accounts can't be paid through this MoMo transfer.
    const account = provider?.payout_account as { type?: string; phone?: string; accountName?: string } | null;
    const momoAccount = account?.type === 'momo' && account.phone ? account : null;
    const phone = momoAccount?.phone ?? provider?.phone ?? '';
    const msisdn = toMsisdn(phone);
    const channel = momoChannel(phone);
    if (!msisdn || !channel) {
      await this.supabase.client
        .from('provider_payouts')
        .update({ status: 'failed', payout_method: 'hubtel_momo', payout_reference: 'MISSING_MOMO_NUMBER' })
        .eq('id', payout.id)
        .eq('status', 'pending');
      return;
    }

    const callback = this.hubtel.callbackUrl();
    try {
      const sent = await this.hubtel.sendMobileMoney({
        recipientName: momoAccount?.accountName || provider?.full_name || 'Provider',
        recipientMsisdn: msisdn,
        channel,
        amount: Number(payout.net_amount),
        clientReference: `po_${payout.id.replace(/-/g, '')}`,
        description: 'Solid Connect payout',
        callbackUrl: callback || 'https://example.invalid/hubtel',
      });
      await this.supabase.client
        .from('provider_payouts')
        .update({
          status: sent.ok ? 'paid' : 'failed',
          payout_method: 'hubtel_momo',
          payout_reference: sent.reference,
          paid_at: sent.ok ? new Date().toISOString() : null,
        })
        .eq('id', payout.id)
        .eq('status', 'pending');
    } catch (err) {
      this.log.warn(`Hubtel payout failed for job ${jobId}: ${(err as Error).message}`);
    }
  }

  private async captureIfPaid(clientReference: string) {
    // References come from Hubtel's callback; only ever our own sd_/sc_ form.
    if (!/^s[cd]_[a-f0-9]{32}$/.test(clientReference)) return;
    const isDeposit = clientReference.startsWith('sd_');
    const { data: payment } = await this.supabase.client
      .from('payments')
      .select('id, status')
      .eq(isDeposit ? 'deposit_reference' : 'client_reference', clientReference)
      .maybeSingle();
    if (!payment) return;
    const from = isDeposit ? ['pending'] : ['pending', 'deposit_held'];
    if (!from.includes(payment.status)) return;

    const check = await this.hubtel.isReferencePaid(clientReference);
    if (!check.paid) return;

    const now = new Date().toISOString();
    await this.supabase.client
      .from('payments')
      .update(
        isDeposit
          ? { status: 'deposit_held', deposit_paid_at: now, deposit_transaction_id: check.transactionId, gateway: 'hubtel', channel: check.channel }
          : { status: 'held', paid_at: now, gateway: 'hubtel', gateway_transaction_id: check.transactionId, channel: check.channel },
      )
      .eq('id', payment.id)
      .eq('status', payment.status);
  }

  private async loadJob(jobId: string) {
    const { data, error } = await this.supabase.client
      .from('jobs')
      .select('id, customer_id, provider_id, status, title, price')
      .eq('id', jobId)
      .maybeSingle();
    if (error) throw new BadRequestException({ code: 'JOB_LOOKUP_FAILED', message: error.message });
    if (!data) throw new NotFoundException({ code: 'JOB_NOT_FOUND', message: 'Job not found.' });
    return data;
  }

  private async loadPayment(jobId: string): Promise<PaymentRow> {
    const { data, error } = await this.supabase.client
      .from('payments')
      .select('id, job_id, amount, deposit_amount, status, client_reference, deposit_reference, checkout_url')
      .eq('job_id', jobId)
      .maybeSingle();
    if (error) throw new BadRequestException({ code: 'PAYMENT_LOOKUP_FAILED', message: error.message });
    if (!data) throw new NotFoundException({ code: 'PAYMENT_NOT_FOUND', message: 'No payment exists for this job yet.' });
    return data as PaymentRow;
  }
}
