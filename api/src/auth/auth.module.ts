import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { RolesGuard } from './guards/roles.guard';
import { SupabaseJwtGuard } from './guards/supabase-jwt.guard';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [SupabaseJwtGuard, RolesGuard],
  exports: [SupabaseJwtGuard, RolesGuard, UsersModule],
})
export class AuthModule {}
