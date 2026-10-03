import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { HubtelService } from './hubtel.service';
import { clientReferenceFromCallback, momoChannel, toMsisdn } from './hubtel.util';

type PaymentRow = {
  id: string;
  job_id: string;
  amount: number;
  status: string;
  client_reference: string | null;
  checkout_url: string | null;
};

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
    if (payment.status === 'held' || payment.status === 'released') {
      return { payment, checkoutUrl: null as string | null, alreadyPaid: true };
    }

    const clientReference = `sc_${payment.id.replace(/-/g, '')}`;
    const callback = this.hubtel.callbackUrl();
    if (!callback) {
      throw new BadRequestException({
        code: 'HUBTEL_CALLBACK_MISSING',
        message: 'HUBTEL_CALLBACK_URL is not set.',
      });
    }
    const returnUrl = this.hubtel.returnUrl();
    const session = await this.hubtel.initiateCheckout({
      amount: Number(payment.amount),
      description: `Solid Connect · ${job.title ?? 'Job'}`.slice(0, 100),
      clientReference,
      callbackUrl: callback,
      returnUrl,
      cancellationUrl: returnUrl,
    });

    const { error } = await this.supabase.client
      .from('payments')
      .update({
        gateway: 'hubtel',
        client_reference: session.clientReference,
        checkout_url: session.checkoutUrl,
        gateway_transaction_id: session.checkoutId,
      })
      .eq('id', payment.id)
      .eq('status', 'pending');
    if (error) throw new BadRequestException({ code: 'PAYMENT_SAVE_FAILED', message: error.message });

    return { payment: { ...payment, client_reference: session.clientReference }, checkoutUrl: session.checkoutUrl, alreadyPaid: false };
  }

  /** Customer returned from Hubtel — confirm with their status API. */
  async refresh(jobId: string, customerId: string) {
    const job = await this.loadJob(jobId);
    if (job.customer_id !== customerId) {
      throw new ForbiddenException({ code: 'NOT_JOB_CUSTOMER', message: 'Only the customer can refresh this payment.' });
    }
    const payment = await this.loadPayment(jobId);
    if (payment.status !== 'pending' || !payment.client_reference) return payment;
    await this.captureIfPaid(payment.client_reference);
    return this.loadPayment(jobId);
  }

  async handleCallback(body: Record<string, unknown>) {
    const reference = clientReferenceFromCallback(body);
    if (!reference) return { ok: true, ignored: true };
    await this.captureIfPaid(reference);
    return { ok: true };
  }

  /** When Hubtel is live, confirmation cannot release an unpaid row. */
  async assertHeldIfGatewayLive(jobId: string) {
    if (!this.hubtel.isConfigured()) return;
    const payment = await this.loadPayment(jobId);
    if (payment.status === 'pending') {
      throw new BadRequestException({
        code: 'PAYMENT_REQUIRED',
        message: 'Pay with Hubtel before confirming completion.',
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
      .select('full_name, phone')
      .eq('id', payout.provider_id)
      .maybeSingle();
    const phone = provider?.phone ?? '';
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
        recipientName: provider?.full_name || 'Provider',
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
    const { data: payment } = await this.supabase.client
      .from('payments')
      .select('id, status, client_reference')
      .eq('client_reference', clientReference)
      .maybeSingle();
    if (!payment || payment.status !== 'pending') return;

    const check = await this.hubtel.isReferencePaid(clientReference);
    if (!check.paid) return;

    await this.supabase.client
      .from('payments')
      .update({
        status: 'held',
        paid_at: new Date().toISOString(),
        gateway: 'hubtel',
        gateway_transaction_id: check.transactionId,
        channel: check.channel,
      })
      .eq('id', payment.id)
      .eq('status', 'pending');
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
      .select('id, job_id, amount, status, client_reference, checkout_url')
      .eq('job_id', jobId)
      .maybeSingle();
    if (error) throw new BadRequestException({ code: 'PAYMENT_LOOKUP_FAILED', message: error.message });
    if (!data) throw new NotFoundException({ code: 'PAYMENT_NOT_FOUND', message: 'No payment exists for this job yet.' });
    return data as PaymentRow;
  }
}
