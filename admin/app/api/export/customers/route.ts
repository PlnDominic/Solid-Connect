import { NextRequest } from 'next/server';
import { requireAdmin } from '../../../../lib/admin';
import { createServerSupabase } from '../../../../lib/supabase';
import { toCsv, csvResponse } from '../../../../lib/csv';

const sanitizeForFilter = (s: string) => s.replace(/[,()%_]/g, ' ').trim();

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return new Response('Forbidden', { status: 403 });

  const q = request.nextUrl.searchParams.get('q');
  const term = q ? sanitizeForFilter(q) : '';
  const supabase = await createServerSupabase();

  let query = supabase
    .from('profiles')
    .select('full_name, email, phone, area, created_at')
    .eq('role', 'customer')
    .order('created_at', { ascending: false })
    .limit(5000);
  if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,area.ilike.%${term}%`);

  const { data, error } = await query;
  if (error) return new Response(error.message, { status: 500 });

  const csv = toCsv(['full_name', 'email', 'phone', 'area', 'created_at'], data ?? []);
  return csvResponse('customers.csv', csv);
}
