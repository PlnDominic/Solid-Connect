import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { HubtelService } from './hubtel.service';
import { nextPeriod, SUBSCRIPTION_REFERENCE, subscriptionReference, workAccess } from './subscription.rules';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly hubtel: HubtelService,
    private readonly config: ConfigService,
  ) {}

  private get price(): number {
    return this.config.get<number>('subscription.priceGhs') ?? 50;
  }
  private get periodDays(): number {
    return this.config.get<number>('subscription.periodDays') ?? 365;
  }

  async status(providerId: string) {
    const [trialUsed, expiresAt] = await Promise.all([this.trialUsed(providerId), this.expiry(providerId)]);
    const access = workAccess({ trialUsed, expiresAt, now: new Date() });
    return {
      active: Boolean(expiresAt && expiresAt.getTime() > Date.now()),
      expiresAt: expiresAt?.toISOString() ?? null,
      trialUsed,
      canTakeWork: access.allowed,
      price: this.price,
      periodDays: this.periodDays,
      currency: 'GHS',
    };
  }

  /**
   * Block quoting / accepting direct requests once the free trial job is used
   * and there is no active subscription. Like the job-payment gate, this only
   * applies when Hubtel is live - otherwise providers couldn't pay to unblock.
   */
  async assertCanTakeWork(providerId: string) {
    if (!this.hubtel.isConfigured()) return;
    const [trialUsed, expiresAt] = await Promise.all([this.trialUsed(providerId), this.expiry(providerId)]);
    const access = workAccess({ trialUsed, expiresAt, now: new Date() });
    if (!access.allowed) {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_REQUIRED',
        message: `Your free job is used. Subscribe (GHS ${this.price} per year) to keep taking new work.`,
      });
    }
  }

  async checkout(providerId: string) {
    const callback = this.hubtel.callbackUrl();
    if (!callback) {
      throw new BadRequestException({ code: 'HUBTEL_CALLBACK_MISSING', message: 'HUBTEL_CALLBACK_URL is not set.' });
    }
    // Reuse a still-pending checkout started in the last 30 minutes.
    const since = new Date(Date.now() - 30 * 60_000).toISOString();
    const { data: open } = await this.supabase.client
      .from('provider_subscriptions')
      .select('id, checkout_url')
      .eq('provider_id', providerId)
      .eq('status', 'pending')
      .not('checkout_url', 'is', null)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (open?.checkout_url) return { checkoutUrl: open.checkout_url as string };

    const { data: row, error } = await this.supabase.client
      .from('provider_subscriptions')
      .insert({ provider_id: providerId, amount: this.price, period_days: this.periodDays })
      .select('id')
      .single();
    if (error || !row) {
      throw new BadRequestException({ code: 'SUBSCRIPTION_CREATE_FAILED', message: error?.message ?? 'Could not start subscription.' });
    }

    const reference = subscriptionReference(row.id as string);
    const returnUrl = this.hubtel.returnUrl();
    try {
      const session = await this.hubtel.initiateCheckout({
        amount: this.price,
        description: `Solid Connect provider subscription (${this.periodDays} days)`,
        clientReference: reference,
        callbackUrl: callback,
        returnUrl,
        cancellationUrl: returnUrl,
      });
      await this.supabase.client
        .from('provider_subscriptions')
        .update({ client_reference: reference, checkout_url: session.checkoutUrl, gateway_transaction_id: session.checkoutId })
        .eq('id', row.id);
      return { checkoutUrl: session.checkoutUrl };
    } catch (err) {
      await this.supabase.client.from('provider_subscriptions').update({ status: 'failed' }).eq('id', row.id);
      throw err;
    }
  }

  /** Provider came back from Hubtel: confirm any pending checkout. */
  async refresh(providerId: string) {
    const { data: pending } = await this.supabase.client
      .from('provider_subscriptions')
      .select('client_reference')
      .eq('provider_id', providerId)
      .eq('status', 'pending')
      .not('client_reference', 'is', null);
    for (const row of pending ?? []) {
      await this.captureIfPaid(row.client_reference as string);
    }
    return this.status(providerId);
  }

  /** Called from the Hubtel webhook for ss_ references. */
  async captureIfPaid(clientReference: string) {
    if (!SUBSCRIPTION_REFERENCE.test(clientReference)) return;
    const { data: sub } = await this.supabase.client
      .from('provider_subscriptions')
      .select('id, provider_id, period_days, status')
      .eq('client_reference', clientReference)
      .maybeSingle();
    if (!sub || sub.status !== 'pending') return;

    const check = await this.hubtel.isReferencePaid(clientReference);
    if (!check.paid) return;

    const now = new Date();
    const period = nextPeriod(now, await this.expiry(sub.provider_id as string), Number(sub.period_days));
    await this.supabase.client
      .from('provider_subscriptions')
      .update({
        status: 'paid',
        paid_at: now.toISOString(),
        starts_at: period.startsAt.toISOString(),
        expires_at: period.expiresAt.toISOString(),
        gateway_transaction_id: check.transactionId,
        channel: check.channel,
      })
      .eq('id', sub.id)
      .eq('status', 'pending'); // idempotent: a duplicate callback finds nothing pending
  }

  private async trialUsed(providerId: string): Promise<boolean> {
    const { data } = await this.supabase.client.rpc('provider_trial_used', { p_provider_id: providerId });
    return Boolean(data);
  }

  private async expiry(providerId: string): Promise<Date | null> {
    const { data } = await this.supabase.client.rpc('provider_subscription_expiry', { p_provider_id: providerId });
    return typeof data === 'string' ? new Date(data) : null;
  }
}
