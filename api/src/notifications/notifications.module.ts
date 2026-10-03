import { Module } from '@nestjs/common';
import { PushService } from './push.service';
import { PushWorker } from './push.worker';

@Module({
  providers: [PushService, PushWorker],
})
export class NotificationsModule {}
