/** Pure quote rules shared by the provider form, the customer's quote
 * cards and the compare screen. The database enforces the same limits
 * (0055_quote_negotiation.sql); this is what shows the message first. */

export const MAX_QUOTE_ITEMS = 8;
export const MIN_COUNTER_FRACTION = 0.5;

export type QuoteItem = { label: string; amount: number };
export type DraftRow = { label: string; amount: string };

export function itemsTotal(items: QuoteItem[]): number {
  return items.reduce((sum, i) => sum + i.amount, 0);
}

/** "GHS 120" / "1,200" -> 1200; null when there's no positive whole number. */
function parseAmount(text: string): number | null {
  const digits = text.replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return n > 0 ? n : null;
}

/**
 * Turns what the provider typed into a price and line items. With no
 * breakdown rows filled in, the single `total` is the price and there are
 * no items; otherwise the price is the sum of the rows, so the two can
 * never disagree.
 */
export function buildQuoteDraft(
  rows: DraftRow[],
  total: string,
): { ok: true; price: number; items: QuoteItem[] } | { ok: false; error: string } {
  const used = rows.filter((r) => r.label.trim() || r.amount.trim());
  if (used.length === 0) {
    const price = parseAmount(total);
    return price ? { ok: true, price, items: [] } : { ok: false, error: 'Enter your price.' };
  }
  if (used.length > MAX_QUOTE_ITEMS) return { ok: false, error: `Use at most ${MAX_QUOTE_ITEMS} line items.` };

  const items: QuoteItem[] = [];
  for (const r of used) {
    const amount = parseAmount(r.amount);
    if (!r.label.trim() || !amount) return { ok: false, error: 'Give every line item a name and an amount.' };
    items.push({ label: r.label.trim().slice(0, 60), amount });
  }
  return { ok: true, price: itemsTotal(items), items };
}

/** null when the counter-offer is acceptable, otherwise why not. */
export function validateCounter(currentPrice: number, counter: number): string | null {
  if (!Number.isInteger(counter) || counter <= 0) return 'Enter a whole amount.';
  if (counter >= currentPrice) return 'Your offer must be lower than the quote.';
  if (counter < Math.ceil(currentPrice * MIN_COUNTER_FRACTION)) {
    return `Offers can be at most ${Math.round((1 - MIN_COUNTER_FRACTION) * 100)}% below the quote.`;
  }
  return null;
}

export type CompareEntry = { id: string; price: number; rating: number | null; distanceKm: number | null };
export type Highlight = 'Lowest price' | 'Top rated' | 'Closest';

/** Which quotes are best on each measurable fact. Deliberately facts, not a
 * blended "best value" score. Ties all get the flag; nothing is flagged
 * when every value is identical or there is only one quote. */
export function compareHighlights(entries: CompareEntry[]): Map<string, Highlight[]> {
  const out = new Map<string, Highlight[]>(entries.map((e) => [e.id, []]));
  if (entries.length < 2) return out;

  const flag = (label: Highlight, pick: (e: CompareEntry) => number | null, best: 'min' | 'max') => {
    const values = entries.map(pick).filter((v): v is number => v != null);
    if (values.length < 2 || new Set(values).size === 1) return;
    const target = best === 'min' ? Math.min(...values) : Math.max(...values);
    for (const e of entries) if (pick(e) === target) out.get(e.id)!.push(label);
  };

  flag('Lowest price', (e) => e.price, 'min');
  flag('Top rated', (e) => e.rating, 'max');
  flag('Closest', (e) => e.distanceKm, 'min');
  return out;
}

/** The short "when" text shown on a quote. */
export function etaLabelFor(proposedStart: string | null | undefined): string {
  if (!proposedStart) return 'Flexible';
  const d = new Date(proposedStart);
  const day = d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${day}, ${time}`;
}
