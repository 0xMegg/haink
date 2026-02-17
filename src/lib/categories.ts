import { dedupePreserveOrder, normalizeWhitespace } from './canonicalize.js';

export class CategoryParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CategoryParseError';
  }
}

export function parseCategoryIds(raw: unknown): string[] {
  if (typeof raw !== 'string') {
    throw new CategoryParseError('카테고리ID 값이 비어있거나 문자열이 아닙니다.');
  }

  const parts = raw
    .split(',')
    .map((part) => normalizeWhitespace(part))
    .filter((part) => part.length > 0);

  const deduped = dedupePreserveOrder(parts);

  if (deduped.length === 0) {
    throw new CategoryParseError('카테고리ID에 유효한 아이템이 없습니다.');
  }

  return deduped;
}
