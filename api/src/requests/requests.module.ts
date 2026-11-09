import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { FeedController } from './feed.controller';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';

@Module({
  imports: [AuthModule, PaymentsModule],
  controllers: [RequestsController, FeedController],
  providers: [RequestsService],
  exports: [RequestsService],
})
export class RequestsModule {}
