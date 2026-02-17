const WHITESPACE_REGEX = /\s+/g;

export function normalizeWhitespace(value: string): string {
  return value.replace(WHITESPACE_REGEX, ' ').trim();
}

export function canonicalizeOptionValue(value: string): string {
  return normalizeWhitespace(value).toUpperCase();
}

export function dedupePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}
