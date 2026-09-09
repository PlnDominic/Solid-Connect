/** Pure helpers for request matching scores (unit-tested). */
export function scoreOpportunity(input: {
  categoryMatch: boolean;
  rating: number;
  certified: boolean;
  verified: boolean;
  availableNow: boolean;
  distanceMeters: number | null;
}) {
  const distanceBonus =
    input.distanceMeters == null ? 5 : Math.max(0, 20 - input.distanceMeters / 1000);
  return (
    (input.categoryMatch ? 40 : 10) +
    input.rating * 8 +
    (input.certified ? 10 : input.verified ? 5 : 0) +
    (input.availableNow ? 15 : 0) +
    distanceBonus
  );
}

export function normalizeLocationLabel(label: string) {
  return label.includes('Accra') ? label : `${label}, Accra`;
}
