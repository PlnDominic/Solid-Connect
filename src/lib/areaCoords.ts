/**
 * Approximate centres of the Accra neighbourhoods the app can place on a
 * map. Mirrors public.area_centroids (0012 + 0068) - the same table the
 * server uses to place providers and requests - so a request in "Labadi"
 * lands in the same spot for a provider as it does server-side. Add a
 * neighbourhood there and here together.
 */
export const AREA_COORDS: Record<string, { lng: number; lat: number }> = {
  Achimota: { lng: -0.232, lat: 5.627 },
  'Trasacco Valley': { lng: -0.158, lat: 5.635 },
  'Airport Residential': { lng: -0.177, lat: 5.605 },
  Cantonments: { lng: -0.173, lat: 5.575 },
  Osu: { lng: -0.183, lat: 5.558 },
  Spintex: { lng: -0.098, lat: 5.636 },
  Tema: { lng: -0.017, lat: 5.669 },
  Dansoman: { lng: -0.266, lat: 5.548 },
  Labadi: { lng: -0.15, lat: 5.56 },
  Labone: { lng: -0.17, lat: 5.565 },
  'East Legon': { lng: -0.16, lat: 5.635 },
  Madina: { lng: -0.166, lat: 5.683 },
  Adenta: { lng: -0.168, lat: 5.705 },
  Haatso: { lng: -0.205, lat: 5.666 },
  Dome: { lng: -0.235, lat: 5.65 },
  Kwabenya: { lng: -0.229, lat: 5.68 },
  Dzorwulu: { lng: -0.2, lat: 5.61 },
  'Roman Ridge': { lng: -0.192, lat: 5.602 },
  Tesano: { lng: -0.228, lat: 5.598 },
  Abeka: { lng: -0.234, lat: 5.598 },
  Lapaz: { lng: -0.252, lat: 5.606 },
  Kaneshie: { lng: -0.236, lat: 5.567 },
  Kokomlemle: { lng: -0.208, lat: 5.574 },
  Adabraka: { lng: -0.208, lat: 5.56 },
  Ridge: { lng: -0.197, lat: 5.565 },
  'Accra Central': { lng: -0.205, lat: 5.55 },
  Teshie: { lng: -0.107, lat: 5.583 },
  Nungua: { lng: -0.079, lat: 5.6 },
  Sakumono: { lng: -0.062, lat: 5.618 },
  Ashaiman: { lng: -0.033, lat: 5.694 },
  Weija: { lng: -0.336, lat: 5.556 },
  Kasoa: { lng: -0.425, lat: 5.534 },
};

// Longest first, so "Roman Ridge, Accra" resolves to Roman Ridge, not Ridge.
const NAMES_LONGEST_FIRST = Object.keys(AREA_COORDS).sort((a, b) => b.length - a.length);

/**
 * The known neighbourhood a free-text location label refers to ("Labadi,
 * Accra" -> "Labadi"), or null. Mainly matches a name inside the label, as
 * area_centroids does server-side; a short typed fragment ("east leg") also
 * matches the name that contains it.
 */
export function matchAreaName(label: string | null | undefined): string | null {
  const n = (label ?? '').trim().toLowerCase();
  if (n.length < 2) return null;
  const inLabel = NAMES_LONGEST_FIRST.find((name) => n.includes(name.toLowerCase()));
  if (inLabel) return inLabel;
  if (n.length < 3) return null;
  return NAMES_LONGEST_FIRST.find((name) => name.toLowerCase().includes(n)) ?? null;
}

export function coordsForArea(name: string): { lng: number; lat: number } | null {
  return AREA_COORDS[name] ?? null;
}

/** Coordinates for a free-text location label, or null when it names no known area. */
export function coordsForLabel(label: string | null | undefined): { lat: number; lng: number } | null {
  const area = matchAreaName(label);
  return area ? coordsForArea(area) : null;
}
