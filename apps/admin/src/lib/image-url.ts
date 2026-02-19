const PUBLIC_BASE_URL = (process.env.NEXT_PUBLIC_IMAGE_BASE_URL ?? '/images').replace(/\/$/, '');

export function resolveImageUrl(storageKey?: string | null): string | null {
  if (!storageKey) return null;
  if (/^https?:\/\//i.test(storageKey)) {
    return storageKey;
  }
  const key = storageKey.replace(/^\/+/, '');
  return `${PUBLIC_BASE_URL}/${key}`;
}
