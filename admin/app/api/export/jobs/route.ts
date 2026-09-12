import { NextRequest } from 'next/server';
import { requireAdmin } from '../../../../lib/admin';
import { createServerSupabase } from '../../../../lib/supabase';
import { toCsv, csvResponse } from '../../../../lib/csv';

const sanitizeForFilter = (s: string) => s.replace(/[,()%_]/g, ' ').trim();
const statuses = ['all', 'in_progress', 'completed'];

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return new Response('Forbidden', { status: 403 });

  const q = request.nextUrl.searchParams.get('q');
  const statusParam = request.nextUrl.searchParams.get('status');
  const status = statuses.includes(statusParam ?? '') ? statusParam! : 'all';
  const term = q ? sanitizeForFilter(q) : '';
  const supabase = await createServerSupabase();

  let query = supabase
    .from('jobs')
    .select('title, price, location_label, status, started_at, completed_at')
    .order('started_at', { ascending: false })
    .limit(5000);
  if (status !== 'all') query = query.eq('status', status);
  if (term) query = query.or(`title.ilike.%${term}%,location_label.ilike.%${term}%`);

  const { data, error } = await query;
  if (error) return new Response(error.message, { status: 500 });

  const csv = toCsv(['title', 'price', 'location_label', 'status', 'started_at', 'completed_at'], data ?? []);
  return csvResponse('jobs.csv', csv);
}
