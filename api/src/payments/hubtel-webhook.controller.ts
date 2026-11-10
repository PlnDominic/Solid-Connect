import { Body, Controller, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { clientReferenceFromCallback } from './hubtel.util';
import { SubscriptionsService } from './subscriptions.service';

/**
 * Hubtel server callback. The only thing Solid Connect charges through
 * Hubtel is the provider subscription (references start with ss_); job
 * payments are settled directly between customer and provider. The route
 * keeps its original path so the callback URL already configured with
 * Hubtel keeps working. The outcome is confirmed with Hubtel's status API.
 */
@Controller('payments')
export class HubtelWebhookController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Post('webhooks/hubtel')
  @SkipThrottle()
  async webhook(@Body() body: Record<string, unknown>) {
    const reference = clientReferenceFromCallback(body ?? {});
    if (!reference) return { ok: true, ignored: true };
    if (reference.startsWith('ss_')) {
      await this.subscriptions.captureIfPaid(reference);
      return { ok: true };
    }
    // Anything else (for example a callback for an old job payment) is ignored.
    return { ok: true, ignored: true };
  }
}
