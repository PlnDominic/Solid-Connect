import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { approveAction, rejectAction } from './actions';

export default async function VerificationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: verification, error } = await supabase
    .from('provider_verifications')
    .select('id, provider_id, status, doc_urls, note, submitted_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!verification) notFound();

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('full_name, provider_category, area, phone, email')
    .eq('id', verification.provider_id)
    .maybeSingle();
  if (profileError) throw profileError;

  const { data: signedUrls, error: signedUrlsError } = await supabase.storage
    .from('verification-docs')
    .createSignedUrls(verification.doc_urls, 60 * 10);
  if (signedUrlsError) throw signedUrlsError;

  const docsFailedToLoad = verification.doc_urls.length > 0 && (signedUrls ?? []).every((u) => !u.signedUrl);

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-xl font-semibold">{profile?.full_name ?? 'Unknown provider'}</h1>
      <p className="text-sm text-gray-500">
        {profile?.provider_category} · {profile?.area}
      </p>
      <p className="text-sm text-gray-500">
        {profile?.phone} · {profile?.email}
      </p>
      <p className="mt-2 text-sm uppercase tracking-wide text-gray-400">{verification.status}</p>

      <div className="mt-6 grid grid-cols-2 gap-4">
        {(signedUrls ?? []).map((u, i) =>
          // eslint-disable-next-line @next/next/no-img-element
          u.signedUrl ? <img key={i} src={u.signedUrl} alt={`Document ${i + 1}`} className="rounded border" /> : null
        )}
      </div>

      {docsFailedToLoad ? (
        <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          Documents failed to load — do not approve without reviewing them. Reload the page; if this persists, check the storage bucket.
        </p>
      ) : null}

      {verification.status === 'pending' ? (
        <div className="mt-8 flex flex-col gap-4">
          <form action={approveAction}>
            <input type="hidden" name="id" value={verification.id} />
            <button type="submit" className="rounded bg-emerald-700 px-4 py-2 text-white">
              Approve
            </button>
          </form>
          <form action={rejectAction} className="flex flex-col gap-2">
            <input type="hidden" name="id" value={verification.id} />
            <textarea name="note" required placeholder="Reason for rejection" className="rounded border p-2" />
            <button type="submit" className="self-start rounded bg-red-700 px-4 py-2 text-white">
              Reject
            </button>
          </form>
        </div>
      ) : (
        <p className="mt-8 text-sm text-gray-600">
          Already {verification.status}
          {verification.note ? ` — ${verification.note}` : ''}.
        </p>
      )}
    </main>
  );
}
