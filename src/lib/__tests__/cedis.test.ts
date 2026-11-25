import { parseWholeCedis } from '../cedis';

it.each(['150.50', '150,50', '-150', '150abc', '1e3', '0', '2147483648'])(
  'rejects %s without changing its value',
  (text) => expect(parseWholeCedis(text)).toBeNull(),
);

it.each([['150', 150], [' 1,500 ', 1500]])('accepts %s as %i whole cedis', (text, amount) => {
  expect(parseWholeCedis(text)).toBe(amount);
});
