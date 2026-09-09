import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { RequestUser } from '../auth/guards/supabase-jwt.guard';
import { AcceptQuoteDto, CreateQuoteDto, ReviseQuoteDto } from './dto/quotes.dto';
import { QuotesService } from './quotes.service';

@ApiTags('quotes')
@ApiBearerAuth()
@Controller()
@UseGuards(SupabaseJwtGuard, RolesGuard)
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  @Post('quotes')
  @Roles('PROVIDER', 'PROFESSIONAL', 'ADMIN', 'SUPER_ADMIN')
  async create(@CurrentUser() user: RequestUser, @Body() body: CreateQuoteDto) {
    const data = await this.quotes.create(user.id, body);
    return { data, meta: {} };
  }

  @Patch('quotes/:id')
  @Roles('PROVIDER', 'PROFESSIONAL', 'ADMIN', 'SUPER_ADMIN')
  async revise(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: ReviseQuoteDto,
  ) {
    const data = await this.quotes.revise(user.id, id, body);
    return { data, meta: {} };
  }

  @Get('requests/:requestId/quotes')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async list(@CurrentUser() user: RequestUser, @Param('requestId') requestId: string) {
    const data = await this.quotes.listForRequest(requestId, user.id);
    return { data, meta: { count: data.length } };
  }

  @Post('quotes/accept')
  @Roles('CUSTOMER', 'PROVIDER', 'PROFESSIONAL', 'ORGANIZATION_MEMBER', 'ADMIN', 'SUPER_ADMIN')
  async accept(@CurrentUser() user: RequestUser, @Body() body: AcceptQuoteDto) {
    const data = await this.quotes.accept(user.id, body);
    return { data, meta: {} };
  }
}
