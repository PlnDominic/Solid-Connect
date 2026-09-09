import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@ApiTags('categories')
@Controller()
export class CategoriesController {
  constructor(private readonly supabase: SupabaseService) {}

  @Get('categories')
  async listCategories() {
    const { data, error } = await this.supabase.client
      .from('categories')
      .select('*')
      .order('sort_order');
    if (error) throw new BadRequestException({ code: 'CATEGORIES_FAILED', message: error.message });
    return { data: data ?? [], meta: {} };
  }

  @Get('skills')
  async listSkills(@Query('categoryId') categoryId?: string) {
    let q = this.supabase.client
      .from('skills')
      .select('id, category_id, name, description, status')
      .eq('status', 'ACTIVE')
      .order('name');
    if (categoryId) q = q.eq('category_id', categoryId);
    const { data, error } = await q;
    if (error) throw new BadRequestException({ code: 'SKILLS_FAILED', message: error.message });
    return { data: data ?? [], meta: { categoryId: categoryId ?? null } };
  }
}
