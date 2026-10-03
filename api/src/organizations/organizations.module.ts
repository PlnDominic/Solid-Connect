import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RequestsModule } from '../requests/requests.module';
import { UsersModule } from '../users/users.module';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { RecurringWorker } from './recurring.worker';

@Module({
  imports: [AuthModule, UsersModule, RequestsModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, RecurringWorker],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
