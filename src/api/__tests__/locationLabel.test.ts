/** Mirrors the coarse-admin filter in location.ts (keep in sync). */
const COARSE_ADMIN_RE =
  /\b(municipal|metropolis|metropolitan|district assembly|district|region|constituency)\b/i;

function isUsableLabel(label: string): boolean {
  return label.length >= 2 && !COARSE_ADMIN_RE.test(label);
}

describe('location label quality', () => {
  it('rejects Ghana municipal assembly names from OS geocoders', () => {
    expect(isUsableLabel('Ga North Municipal')).toBe(false);
    expect(isUsableLabel('Ga West Municipal District')).toBe(false);
    expect(isUsableLabel('Accra Metropolitan')).toBe(false);
  });

  it('keeps town / neighbourhood names', () => {
    expect(isUsableLabel('Sapiman')).toBe(true);
    expect(isUsableLabel('Amasaman')).toBe(true);
    expect(isUsableLabel('Kumasi')).toBe(true);
  });
});
