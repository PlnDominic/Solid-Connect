import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { File } from 'expo-file-system';
import { supabase } from '../lib/supabase';
import type { ProviderVerification } from '../types/database';

const BUCKET = 'verification-docs';

export interface PickedDoc {
  uri: string;
  fileName: string;
  mimeType: string;
}

export async function fetchLatestVerification(providerId: string): Promise<ProviderVerification | null> {
  const { data, error } = await supabase
    .from('provider_verifications')
    .select('*')
    .eq('provider_id', providerId)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function useLatestVerification(providerId: string | null) {
  return useQuery({
    queryKey: ['verification', providerId],
    queryFn: () => fetchLatestVerification(providerId as string),
    enabled: !!providerId,
  });
}

async function uploadDoc(providerId: string, doc: PickedDoc, index: number): Promise<string> {
  const file = new File(doc.uri);
  const bytes = await file.bytes();
  const path = `${providerId}/${Date.now()}-${index}-${doc.fileName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: doc.mimeType,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

/**
 * Uploads each picked photo to the provider's own folder in the
 * verification-docs bucket, then inserts one provider_verifications row
 * referencing all of them - a submission is only created once every
 * upload has confirmed, so a mid-upload network drop never leaves a
 * pending row with missing documents.
 */
export async function submitVerification(providerId: string, docs: PickedDoc[]): Promise<ProviderVerification> {
  if (docs.length === 0) throw new Error('Add at least one document photo.');
  const docUrls = await Promise.all(docs.map((doc, i) => uploadDoc(providerId, doc, i)));
  const { data, error } = await supabase
    .from('provider_verifications')
    .insert({ provider_id: providerId, doc_urls: docUrls, status: 'pending' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export function useSubmitVerification(providerId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (docs: PickedDoc[]) => {
      if (!providerId) throw new Error('Not signed in');
      return submitVerification(providerId, docs);
    },
    onSuccess: (record) => {
      queryClient.setQueryData(['verification', record.provider_id], record);
    },
  });
}
