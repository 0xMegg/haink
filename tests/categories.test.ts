import { describe, expect, it } from 'vitest';

import { parseCategoryIds, CategoryParseError } from '../src/lib/categories.js';

describe('parseCategoryIds', () => {
  it('trim, dedupe, preserve order', () => {
    const result = parseCategoryIds(' CATE9 , CATE44, CATE9 ,CATE55 ');
    expect(result).toEqual(['CATE9', 'CATE44', 'CATE55']);
  });

  it('throws when empty', () => {
    expect(() => parseCategoryIds(' , , ')).toThrow(CategoryParseError);
  });

  it('throws when not string', () => {
    expect(() => parseCategoryIds(null as unknown as string)).toThrow(CategoryParseError);
  });
});
