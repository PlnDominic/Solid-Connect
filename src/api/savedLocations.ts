import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

/**
 * "Address book" for a marketplace that only ever asks for a neighborhood
 * (src/components/AreaPicker.tsx), not a street address - a named shortcut
 * to one of those areas ("Home" -> Achimota), not a full postal address.
 * Same shape/CRUD pattern as api/saved.ts's saved providers.
 */
export interface SavedLocation {
  id: string;
  user_id: string;
  label: string;
  area: string;
  created_at: string;
}

export function useSavedLocations(userId: string | null) {
  return useQuery({
    queryKey: ['savedLocations', userId],
    queryFn: async (): Promise<SavedLocation[]> => {
      const { data, error } = await supabase
        .from('saved_locations')
        .select('*')
        .eq('user_id', userId as string)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });
}

export function useAddSavedLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; label: string; area: string }) => {
      const { data, error } = await supabase
        .from('saved_locations')
        .upsert(
          { user_id: input.userId, label: input.label.trim(), area: input.area },
          { onConflict: 'user_id,area' },
        )
        .select('*')
        .single();
      if (error) throw error;
      return data as SavedLocation;
    },
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: ['savedLocations', row.user_id] });
    },
  });
}

export function useDeleteSavedLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; userId: string }) => {
      const { error } = await supabase.from('saved_locations').delete().eq('id', input.id);
      if (error) throw error;
      return input.userId;
    },
    onSuccess: (userId) => {
      queryClient.invalidateQueries({ queryKey: ['savedLocations', userId] });
    },
  });
}
