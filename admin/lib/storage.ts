import { createAdminClient } from './admin';

/**
 * Chat photos, chat audio and request photos are private (migration 0089), so
 * the admin site shows them through short-lived signed links made with its
 * server key. Handles both the old public URL form and a signed one; any URL
 * that is not a private-bucket file is returned unchanged.
 */
const PRIVATE_BUCKETS = new Set(['chat-photos', 'chat-audio', 'request-photos']);
const SIGNED_FOR_SECONDS = 60 * 60;

export function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  const match = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?#]+)/.exec(url);
  if (!match || !PRIVATE_BUCKETS.has(match[1])) return null;
  try {
    return { bucket: match[1], path: decodeURIComponent(match[2]) };
  } catch {
    return null;
  }
}

export async function signPrivateUrls(urls: readonly (string | null | undefined)[]): Promise<(string | null)[]> {
  const out: (string | null)[] = urls.map((u) => u ?? null);
  const byBucket = new Map<string, { index: number; path: string }[]>();
  urls.forEach((u, index) => {
    const ref = u ? parseStorageUrl(u) : null;
    if (ref) byBucket.set(ref.bucket, [...(byBucket.get(ref.bucket) ?? []), { index, path: ref.path }]);
  });
  if (!byBucket.size) return out;

  const admin = createAdminClient();
  for (const [bucket, items] of byBucket) {
    const { data } = await admin.storage.from(bucket).createSignedUrls(
      items.map((i) => i.path),
      SIGNED_FOR_SECONDS,
    );
    items.forEach((item, i) => {
      const signed = data?.[i]?.signedUrl;
      // If signing fails keep the original so the page still renders something.
      if (signed) out[item.index] = signed;
    });
  }
  return out;
}

/** The suspension reason is not publicly readable (0089); the admin site reads it with its server key. */
export async function readSuspensionReason(profileId: string): Promise<string | null> {
  const { data } = await createAdminClient().from('profiles').select('suspended_reason').eq('id', profileId).maybeSingle();
  return (data?.suspended_reason as string | null | undefined) ?? null;
}
