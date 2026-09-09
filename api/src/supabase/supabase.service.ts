import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private admin!: SupabaseClient;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url = this.config.get<string>('supabase.url');
    const key = this.config.get<string>('supabase.secretKey');
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required for the API.');
    }
    this.admin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  get client(): SupabaseClient {
    return this.admin;
  }
}
