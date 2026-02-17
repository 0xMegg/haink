import { promises as fs } from 'fs';
import path from 'path';

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function normalizeYn(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().toUpperCase();
}

export function parseYnToBoolean(value: unknown, fallback = false): boolean {
  const normalized = normalizeYn(value);
  if (normalized === 'Y') return true;
  if (normalized === 'N') return false;
  return fallback;
}

export function parseNonNegativeInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const rounded = Math.trunc(value);
    return rounded >= 0 ? rounded : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (!/^\d+$/.test(trimmed)) return null;
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

export async function ensureDir(targetPath: string): Promise<void> {
  await fs.mkdir(targetPath, { recursive: true });
}

export function resolveReportPath(reportPath?: string): string {
  if (!reportPath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return path.join('reports', `report-${timestamp}.json`);
  }
  return reportPath;
}
