import { buildQuoteDraft, compareHighlights, etaLabelFor, itemsTotal, validateCounter, MAX_QUOTE_ITEMS } from '../quoteLogic';

describe('itemsTotal', () => {
  it('adds up the amounts', () => {
    expect(itemsTotal([{ label: 'Labour', amount: 300 }, { label: 'Pipes', amount: 120 }])).toBe(420);
    expect(itemsTotal([])).toBe(0);
  });
});

describe('buildQuoteDraft', () => {
  it('uses the single total when no breakdown rows are filled in', () => {
    const r = buildQuoteDraft([{ label: '', amount: '' }], '450');
    expect(r).toEqual({ ok: true, price: 450, items: [] });
  });

  it('sums breakdown rows into the price and ignores blank rows', () => {
    const r = buildQuoteDraft(
      [{ label: 'Labour', amount: '300' }, { label: '', amount: '' }, { label: 'Parts', amount: 'GHS 120' }],
      '',
    );
    expect(r).toEqual({ ok: true, price: 420, items: [{ label: 'Labour', amount: 300 }, { label: 'Parts', amount: 120 }] });
  });

  it('rejects a half-filled row', () => {
    expect(buildQuoteDraft([{ label: 'Labour', amount: '' }], '')).toMatchObject({ ok: false });
    expect(buildQuoteDraft([{ label: '', amount: '50' }], '')).toMatchObject({ ok: false });
  });

  it('rejects a missing or zero price', () => {
    expect(buildQuoteDraft([], '')).toMatchObject({ ok: false });
    expect(buildQuoteDraft([], '0')).toMatchObject({ ok: false });
  });

  it('rejects more rows than the limit', () => {
    const rows = Array.from({ length: MAX_QUOTE_ITEMS + 1 }, (_, i) => ({ label: `Item ${i}`, amount: '10' }));
    expect(buildQuoteDraft(rows, '')).toMatchObject({ ok: false });
  });
});

describe('validateCounter', () => {
  it('accepts a lower offer of at least half the price', () => {
    expect(validateCounter(400, 350)).toBeNull();
    expect(validateCounter(400, 200)).toBeNull();
  });

  it('rejects an offer that is not lower', () => {
    expect(validateCounter(400, 400)).not.toBeNull();
    expect(validateCounter(400, 500)).not.toBeNull();
  });

  it('rejects a lowball under half the price', () => {
    expect(validateCounter(400, 199)).not.toBeNull();
  });

  it('rejects non-integers and non-positive numbers', () => {
    expect(validateCounter(400, 350.5)).not.toBeNull();
    expect(validateCounter(400, 0)).not.toBeNull();
    expect(validateCounter(400, NaN)).not.toBeNull();
  });
});

describe('compareHighlights', () => {
  const entries = [
    { id: 'a', price: 300, rating: 4.2, distanceKm: 5 },
    { id: 'b', price: 350, rating: 4.9, distanceKm: 2 },
    { id: 'c', price: 400, rating: 4.5, distanceKm: 9 },
  ];

  it('flags the lowest price, top rating and closest provider', () => {
    const h = compareHighlights(entries);
    expect(h.get('a')).toEqual(['Lowest price']);
    expect(h.get('b')).toEqual(['Top rated', 'Closest']);
    expect(h.get('c')).toEqual([]);
  });

  it('flags nothing when every value is the same', () => {
    const same = [
      { id: 'a', price: 300, rating: 4, distanceKm: 3 },
      { id: 'b', price: 300, rating: 4, distanceKm: 3 },
    ];
    expect(compareHighlights(same).get('a')).toEqual([]);
  });

  it('ignores missing values', () => {
    const h = compareHighlights([
      { id: 'a', price: 300, rating: null, distanceKm: null },
      { id: 'b', price: 250, rating: null, distanceKm: null },
    ]);
    expect(h.get('b')).toEqual(['Lowest price']);
  });

  it('flags nothing for a single quote', () => {
    expect(compareHighlights([entries[0]]).get('a')).toEqual([]);
  });
});

describe('etaLabelFor', () => {
  it('says Flexible when no start time was proposed', () => {
    expect(etaLabelFor(null)).toBe('Flexible');
  });

  it('includes a time when one was proposed', () => {
    expect(etaLabelFor('2030-01-07T10:00:00.000Z')).toMatch(/\d/);
  });
});
