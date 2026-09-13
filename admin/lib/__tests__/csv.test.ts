import { describe, it, expect } from 'vitest';
import { toCsv } from '../csv';

describe('toCsv', () => {
  it('renders a header row followed by one row per record', () => {
    const csv = toCsv(['name', 'age'], [{ name: 'Kwame', age: 34 }]);
    expect(csv).toBe('name,age\r\nKwame,34');
  });

  it('renders nothing but the header row for an empty dataset', () => {
    expect(toCsv(['name', 'age'], [])).toBe('name,age');
  });

  it('renders an empty string for a missing/null/undefined field, not the literal word', () => {
    const csv = toCsv(['name', 'note'], [{ name: 'Ama', note: null }, { name: 'Kojo' }]);
    expect(csv).toBe('name,note\r\nAma,\r\nKojo,');
  });

  it('quotes a field containing a comma', () => {
    expect(toCsv(['location'], [{ location: 'Achimota, Accra' }])).toBe('location\r\n"Achimota, Accra"');
  });

  it('quotes a field containing a newline', () => {
    expect(toCsv(['note'], [{ note: 'Line one\nLine two' }])).toBe('note\r\n"Line one\nLine two"');
  });

  it('quotes a field containing a double quote and doubles the embedded quote (RFC 4180)', () => {
    expect(toCsv(['note'], [{ note: 'She said "hello"' }])).toBe('note\r\n"She said ""hello"""');
  });

  it('does not quote a plain field with no special characters', () => {
    expect(toCsv(['status'], [{ status: 'released' }])).toBe('status\r\nreleased');
  });

  it('only pulls the requested columns, in the requested order, ignoring extra fields on the row', () => {
    const csv = toCsv(['b', 'a'], [{ a: 1, b: 2, c: 3 }]);
    expect(csv).toBe('b,a\r\n2,1');
  });
});
