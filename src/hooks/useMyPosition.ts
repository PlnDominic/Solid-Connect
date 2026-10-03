import { useQuery } from '@tanstack/react-query';
import { getDevicePosition } from '../lib/devicePosition';

/** The phone's position, fetched once and reused for a few minutes (for
 * "nearest" sorting and the provider map). Null when it isn't available. */
export function useMyPosition(enabled = true) {
  return useQuery({
    queryKey: ['myPosition'],
    queryFn: async () => {
      const pos = await getDevicePosition();
      return pos.ok ? { lat: pos.lat, lng: pos.lng } : null;
    },
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
  });
}
