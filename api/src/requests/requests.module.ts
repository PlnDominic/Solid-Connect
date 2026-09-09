import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FeedController } from './feed.controller';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';

@Module({
  imports: [AuthModule],
  controllers: [RequestsController, FeedController],
  providers: [RequestsService],
  exports: [RequestsService],
})
export class RequestsModule {}
