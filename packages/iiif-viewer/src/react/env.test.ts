import { describe, expect, it } from 'vitest';
import { format } from './env';
import { messages } from './messages';

describe('format', () => {
  it('replaces {name} placeholders', () => {
    expect(format('{a} and {b}', { a: 1, b: 'x' })).toBe('1 and x');
  });
  it('leaves unknown placeholders and plain text alone', () => {
    expect(format('{a} {c}', { a: 'z' })).toBe('z {c}');
    expect(format('plain')).toBe('plain');
  });
});

describe('messages', () => {
  it('ja and en have the same keys', () => {
    for (const ns of Object.keys(messages.ja)) {
      expect(Object.keys(messages.en[ns] ?? {}).sort()).toEqual(Object.keys(messages.ja[ns]).sort());
    }
    expect(Object.keys(messages.en).sort()).toEqual(Object.keys(messages.ja).sort());
  });
});
