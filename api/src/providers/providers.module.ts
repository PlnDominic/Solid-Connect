import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProvidersController } from './providers.controller';
import { ProvidersLocationService } from './providers-location.service';

@Module({
  imports: [AuthModule],
  controllers: [ProvidersController],
  providers: [ProvidersLocationService],
  exports: [ProvidersLocationService],
})
export class ProvidersModule {}
