import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HubtelService } from './hubtel.service';
import { HubtelWebhookController } from './hubtel-webhook.controller';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

// Only the provider subscription runs through here. Solid Connect does not
// collect job payments on behalf of providers.
@Module({
  imports: [AuthModule],
  controllers: [HubtelWebhookController, SubscriptionsController],
  providers: [HubtelService, SubscriptionsService],
  exports: [HubtelService, SubscriptionsService],
})
export class PaymentsModule {}
