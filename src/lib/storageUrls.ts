import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

/**
 * Chat photos, voice notes and request photos are private (migration 0089):
 * the app shows them through short-lived signed links instead of their public
 * URL. Rows saved before that still hold the old public URL, so everything
 * here accepts either form. Signed links also work while a bucket is still
 * public, so this is safe to ship before the migration runs.
 */

export const PRIVATE_BUCKETS = ['chat-photos', 'chat-audio', 'request-photos'] as const;
export type PrivateBucket = (typeof PRIVATE_BUCKETS)[number];

const SIGNED_FOR_SECONDS = 60 * 60;
// Re-sign a little before the link would expire.
const STALE_MS = (SIGNED_FOR_SECONDS - 10 * 60) * 1000;

export type StorageRef = { bucket: PrivateBucket; path: string };

/** The bucket and object path inside a Supabase Storage URL, if it is one of
 * the private buckets. Handles both the public and the signed URL forms. */
export function parseStorageUrl(url: string | null | undefined): StorageRef | null {
  if (!url) return null;
  const match = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?#]+)/.exec(url);
  if (!match) return null;
  const bucket = match[1] as PrivateBucket;
  if (!(PRIVATE_BUCKETS as readonly string[]).includes(bucket)) return null;
  try {
    return { bucket, path: decodeURIComponent(match[2]) };
  } catch {
    return null;
  }
}

async function sign(ref: StorageRef): Promise<string | null> {
  const { data, error } = await supabase.storage.from(ref.bucket).createSignedUrl(ref.path, SIGNED_FOR_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** A link that can be shown right now for this stored URL. Returns the URL
 * unchanged when it is not a private-bucket file, and null while signing. */
export function useSignedUrl(url: string | null | undefined): string | null {
  const ref = parseStorageUrl(url);
  const { data } = useQuery({
    queryKey: ['signedUrl', ref?.bucket, ref?.path],
    enabled: !!ref,
    staleTime: STALE_MS,
    gcTime: STALE_MS + 60_000,
    queryFn: async () => (await sign(ref as StorageRef)) ?? (url as string),
  });
  if (!url) return null;
  if (!ref) return url;
  return data ?? null;
}

/** Same, for a list (a job's photos). Order is kept; entries still being
 * signed are skipped so the gallery fills in as links arrive. */
export function useSignedUrls(urls: readonly string[] | null | undefined): string[] {
  const list = urls ?? [];
  const refs = list.map(parseStorageUrl);
  const key = refs.map((r) => (r ? `${r.bucket}/${r.path}` : '')).join('|');
  const { data } = useQuery({
    queryKey: ['signedUrls', key],
    enabled: refs.some(Boolean),
    staleTime: STALE_MS,
    gcTime: STALE_MS + 60_000,
    queryFn: async () => {
      const out: string[] = [];
      for (let i = 0; i < list.length; i += 1) {
        const ref = refs[i];
        out.push(ref ? ((await sign(ref)) ?? list[i]) : list[i]);
      }
      return out;
    },
  });
  if (!refs.some(Boolean)) return [...list];
  return data ?? [];
}
