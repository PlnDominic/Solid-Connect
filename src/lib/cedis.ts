export function parseWholeCedis(value: string): number | null {
  const text = value.trim();
  if (!/^(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+)$/.test(text)) return null;
  const amount = Number(text.replace(/,/g, ''));
  return Number.isInteger(amount) && amount > 0 && amount <= 2147483647 ? amount : null;
}
