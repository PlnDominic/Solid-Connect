import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { ProviderPortfolioPhoto } from '../types/database';

/** A provider's portfolio photos, newest first. Public table - no auth required to read. */
export function usePortfolioPhotos(providerId: string | null | undefined) {
  return useQuery({
    queryKey: ['portfolio', providerId],
    queryFn: async (): Promise<ProviderPortfolioPhoto[]> => {
      const { data, error } = await supabase
        .from('provider_portfolio_photos')
        .select('*')
        .eq('provider_id', providerId as string)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!providerId,
  });
}

/**
 * Uploads one picked image to the public portfolio-photos bucket under the
 * provider's own folder, then inserts a row pointing at its public URL.
 * Upload happens before the insert, same order as profile/verification
 * photo uploads, so a failed upload never leaves behind a broken row.
 */
export function useUploadPortfolioPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ providerId, imageUri }: { providerId: string; imageUri: string }) => {
      const response = await fetch(imageUri);
      const arrayBuffer = await response.arrayBuffer();
      const path = `${providerId}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('portfolio-photos')
        .upload(path, arrayBuffer, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;
      const { data: publicUrl } = supabase.storage.from('portfolio-photos').getPublicUrl(path);
      const { error: insertError } = await supabase
        .from('provider_portfolio_photos')
        .insert({ provider_id: providerId, photo_url: publicUrl.publicUrl });
      if (insertError) throw insertError;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['portfolio', vars.providerId] });
    },
  });
}

/** Storage path convention matches the bucket's own RLS: first path segment must be auth.uid(). */
function storagePathFromPublicUrl(publicUrl: string): string {
  const marker = '/object/public/portfolio-photos/';
  const index = publicUrl.indexOf(marker);
  return index === -1 ? publicUrl : publicUrl.slice(index + marker.length);
}

/** Removes a photo's Storage object, then its row. No optimistic removal - see design doc. */
export function useDeletePortfolioPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ providerId, id, photoUrl }: { providerId: string; id: string; photoUrl: string }) => {
      const { error: removeError } = await supabase.storage
        .from('portfolio-photos')
        .remove([storagePathFromPublicUrl(photoUrl)]);
      if (removeError) throw removeError;
      const { error: deleteError } = await supabase.from('provider_portfolio_photos').delete().eq('id', id);
      if (deleteError) throw deleteError;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['portfolio', vars.providerId] });
    },
  });
}
