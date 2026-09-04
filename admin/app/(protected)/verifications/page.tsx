import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

const STATUSES = ['pending', 'approved', 'rejected'] as const;

export default async function VerificationsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status: rawStatus } = await searchParams;
  const status = (STATUSES as readonly string[]).includes(rawStatus ?? '') ? (rawStatus as (typeof STATUSES)[number]) : 'pending';

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from('provider_verifications')
    .select('id, provider_id, status, submitted_at')
    .eq('status', status)
    .order('submitted_at', { ascending: true });
  if (error) throw error;

  const providerIds = [...new Set((rows ?? []).map((r) => r.provider_id))];
  const { data: profiles } = providerIds.length
    ? await supabase.from('profiles').select('id, full_name, provider_category').in('id', providerIds)
    : { data: [] as { id: string; full_name: string; provider_category: string | null }[] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="mb-1 text-xl font-semibold">Provider verifications</h1>
      <p className="mb-6 text-sm text-gray-500">
        {rows?.length ?? 0} {status}
      </p>

      <div className="mb-6 flex gap-2 text-sm">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/verifications?status=${s}`}
            className={`rounded border px-3 py-1 ${status === s ? 'bg-gray-900 text-white' : 'text-gray-600'}`}
          >
            {s}
          </Link>
        ))}
      </div>

      {(rows ?? []).length === 0 ? (
        <p className="text-sm text-gray-500">No {status} submissions.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded border">
          {(rows ?? []).map((r) => {
            const profile = profileById.get(r.provider_id);
            return (
              <li key={r.id}>
                <Link href={`/verifications/${r.id}`} className="flex justify-between px-4 py-3 hover:bg-gray-50">
                  <span>{profile?.full_name ?? 'Unknown provider'}</span>
                  <span className="text-gray-500">{profile?.provider_category}</span>
                  <span className="text-sm text-gray-400">{new Date(r.submitted_at).toLocaleDateString()}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
