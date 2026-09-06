import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { ProviderVerification } from '../types/database';

/**
 * The provider's own most recent verification submission, or null if
 * they've never submitted one. Providers can only ever insert a new row
 * (see 0005_admin_verification.sql's RLS policies) - there's no "the"
 * submission to update, so the latest one is what the screen goes by.
 */
export function useLatestVerification(providerId: string | null) {
  return useQuery({
    queryKey: ['verification', 'latest', providerId],
    queryFn: async (): Promise<ProviderVerification | null> => {
      const { data, error } = await supabase
        .from('provider_verifications')
        .select('*')
        .eq('provider_id', providerId as string)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!providerId,
  });
}

/** Storage path convention matches the bucket's own RLS: first path segment must be auth.uid(). */
function docPath(providerId: string, index: number) {
  return `${providerId}/${Date.now()}-${index}.jpg`;
}

/**
 * Uploads each picked image to the private verification-docs bucket, then
 * inserts one new provider_verifications row pointing at them. Runs the
 * uploads before the insert so a failed upload never leaves behind a row
 * with missing documents.
 */
export function useSubmitVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ providerId, imageUris }: { providerId: string; imageUris: string[] }) => {
      const paths: string[] = [];
      for (let i = 0; i < imageUris.length; i++) {
        const response = await fetch(imageUris[i]);
        const arrayBuffer = await response.arrayBuffer();
        const path = docPath(providerId, i);
        const { error: uploadError } = await supabase.storage
          .from('verification-docs')
          .upload(path, arrayBuffer, { contentType: 'image/jpeg' });
        if (uploadError) throw uploadError;
        paths.push(path);
      }

      const { error: insertError } = await supabase
        .from('provider_verifications')
        .insert({ provider_id: providerId, doc_urls: paths });
      if (insertError) throw insertError;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['verification', 'latest', vars.providerId] });
    },
  });
}
