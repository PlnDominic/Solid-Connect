import { NextRequest } from 'next/server';
import { requireAdmin } from '../../../../lib/admin';
import { createServerSupabase } from '../../../../lib/supabase';
import { toCsv, csvResponse } from '../../../../lib/csv';

const sanitizeForFilter = (s: string) => s.replace(/[,()%_]/g, ' ').trim();

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return new Response('Forbidden', { status: 403 });

  const q = request.nextUrl.searchParams.get('q');
  const category = request.nextUrl.searchParams.get('category');
  const term = q ? sanitizeForFilter(q) : '';
  const supabase = await createServerSupabase();

  let query = supabase
    .from('profiles')
    .select('full_name, email, phone, area, provider_category, provider_rating, provider_jobs_count, provider_verified, created_at')
    .eq('role', 'provider')
    .order('created_at', { ascending: false })
    .limit(5000);
  if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,provider_category.ilike.%${term}%,area.ilike.%${term}%`);
  if (category) query = query.eq('provider_category', category);

  const { data, error } = await query;
  if (error) return new Response(error.message, { status: 500 });

  const csv = toCsv(
    ['full_name', 'email', 'phone', 'area', 'provider_category', 'provider_rating', 'provider_jobs_count', 'provider_verified', 'created_at'],
    data ?? [],
  );
  return csvResponse('providers.csv', csv);
}
