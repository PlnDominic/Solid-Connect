import { Module } from '@nestjs/common';
import { JobPostWorker } from './job-post.worker';

// Pushes are sent by the database itself (migration 0092).
@Module({
  providers: [JobPostWorker],
})
export class NotificationsModule {}
