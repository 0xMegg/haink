import { describe, expect, it } from 'vitest';

import { canonicalizeOptionValue, normalizeWhitespace } from '../src/lib/canonicalize.js';

describe('canonicalizeOptionValue', () => {
  it('uppercases and collapses spaces', () => {
    const input = '  Ka ri na  ver.1 ';
    expect(canonicalizeOptionValue(input)).toBe('KA RI NA VER.1');
  });
});

describe('normalizeWhitespace', () => {
  it('trims and collapses gaps', () => {
    expect(normalizeWhitespace('  A   B   C  ')).toBe('A B C');
  });
});
