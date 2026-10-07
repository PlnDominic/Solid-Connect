/**
 * Accra map / matching centroids only — NOT a full Ghana place list.
 *
 * profiles.area is free text (anywhere in Ghana). These coordinates exist
 * so we can put "Labadi" on the map and compute distance when the label
 * matches. "Use my current location" reverse-geocodes nationwide; it only
 * falls back to the nearest of these when geocode fails and GPS is nearby.
 *
 * Mirrors public.area_centroids (0012 + 0068 + 0077). Add a neighbourhood
 * here and in a migration together when you need Accra map coverage.
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
  // Ga West / NW Accra (0077) — without these, Sapiman/Opa snapped to Kwabenya.
  Sapiman: { lng: -0.312, lat: 5.725 },
  Opa: { lng: -0.324, lat: 5.721 },
  Ofankor: { lng: -0.28, lat: 5.68 },
  Pokuase: { lng: -0.283, lat: 5.69 },
  Amasaman: { lng: -0.305, lat: 5.705 },
  Achiman: { lng: -0.295, lat: 5.695 },
  Taifa: { lng: -0.245, lat: 5.675 },
  Atomic: { lng: -0.215, lat: 5.67 },
  'Dome Pillar 2': { lng: -0.24, lat: 5.655 },
  Ablekuma: { lng: -0.28, lat: 5.57 },
  Mallam: { lng: -0.295, lat: 5.555 },
  Gbawe: { lng: -0.31, lat: 5.565 },
  'McCarthy Hill': { lng: -0.275, lat: 5.575 },
  Sowutuom: { lng: -0.27, lat: 5.62 },
  Anyaa: { lng: -0.275, lat: 5.64 },
  CP: { lng: -0.255, lat: 5.64 },
};

/** Common spellings / alternate names → canonical AREA_COORDS key. */
const AREA_ALIASES: Record<string, string> = {
  sapeman: 'Sapiman',
  sapieman: 'Sapiman',
  sarpeiman: 'Sapiman',
  pokoasi: 'Pokuase',
  achiaman: 'Achiman',
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
  if (AREA_ALIASES[n]) return AREA_ALIASES[n];
  for (const [alias, canonical] of Object.entries(AREA_ALIASES)) {
    if (alias.length >= 4 && n.includes(alias)) return canonical;
  }
  // Exact match first (covers short names like Osu / CP).
  const exact = NAMES_LONGEST_FIRST.find((name) => name.toLowerCase() === n);
  if (exact) return exact;
  // Substring match only for names 4+ chars ("Osu" inside "Osudoku" is ok
  // to miss; "CP" must not match inside unrelated words).
  const inLabel = NAMES_LONGEST_FIRST.find((name) => {
    const key = name.toLowerCase();
    return key.length >= 4 && n.includes(key);
  });
  if (inLabel) return inLabel;
  if (n.length < 4) return null;
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
