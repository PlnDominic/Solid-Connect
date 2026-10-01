import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HubtelService } from './hubtel.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [AuthModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, HubtelService],
  exports: [PaymentsService, HubtelService],
})
export class PaymentsModule {}
