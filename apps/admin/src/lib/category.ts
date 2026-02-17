export function parseCategoryIds(input: string): string[] {
  const parts = input
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    if (seen.has(part)) continue;
    seen.add(part);
    unique.push(part);
  }
  if (unique.length === 0) {
    throw new Error('카테고리 ID는 최소 1개 이상이어야 합니다.');
  }
  return unique;
}
