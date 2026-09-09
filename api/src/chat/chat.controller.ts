import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { RequestUser } from '../auth/guards/supabase-jwt.guard';
import { CreateThreadDto, SendMessageDto } from './dto/chat.dto';
import { ChatService } from './chat.service';

@ApiTags('chat')
@ApiBearerAuth()
@Controller('chat')
@UseGuards(SupabaseJwtGuard, RolesGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('threads')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async threads(
    @CurrentUser() user: RequestUser,
    @Query('role') role: 'customer' | 'provider' = 'customer',
  ) {
    const data = await this.chat.listThreads(user.id, role === 'provider' ? 'provider' : 'customer');
    return { data, meta: {} };
  }

  @Post('threads')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async ensure(@CurrentUser() user: RequestUser, @Body() body: CreateThreadDto) {
    const data = await this.chat.ensureThread(user.id, body);
    return { data, meta: {} };
  }

  @Get('threads/:id/messages')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async messages(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const data = await this.chat.listMessages(id, user.id);
    return { data, meta: { count: data.length } };
  }

  @Post('threads/:id/messages')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async send(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: SendMessageDto,
  ) {
    const data = await this.chat.sendMessage(id, user.id, body);
    return { data, meta: {} };
  }
}
