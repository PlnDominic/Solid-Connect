import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HubtelService } from './hubtel.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [AuthModule],
  controllers: [PaymentsController, SubscriptionsController],
  providers: [PaymentsService, HubtelService, SubscriptionsService],
  exports: [PaymentsService, HubtelService, SubscriptionsService],
})
export class PaymentsModule {}
