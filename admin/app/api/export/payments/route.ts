import { NextRequest } from 'next/server';
import { requireAdmin } from '../../../../lib/admin';
import { createServerSupabase } from '../../../../lib/supabase';
import { toCsv, csvResponse } from '../../../../lib/csv';

const statuses = ['all', 'pending', 'released', 'refunded'];

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return new Response('Forbidden', { status: 403 });

  const statusParam = request.nextUrl.searchParams.get('status');
  const status = statuses.includes(statusParam ?? '') ? statusParam! : 'all';
  const supabase = await createServerSupabase();

  let query = supabase
    .from('payments')
    .select('id, job_id, amount, status, refund_reason, released_at, created_at')
    .order('created_at', { ascending: false })
    .limit(5000);
  if (status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return new Response(error.message, { status: 500 });

  const csv = toCsv(['id', 'job_id', 'amount', 'status', 'refund_reason', 'released_at', 'created_at'], data ?? []);
  return csvResponse('payments.csv', csv);
}
