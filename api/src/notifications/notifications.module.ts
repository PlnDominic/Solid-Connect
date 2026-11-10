import { Module } from '@nestjs/common';
import { PushService } from './push.service';
import { PushWorker } from './push.worker';
import { JobPostWorker } from './job-post.worker';

@Module({
  providers: [PushService, PushWorker, JobPostWorker],
})
export class NotificationsModule {}
