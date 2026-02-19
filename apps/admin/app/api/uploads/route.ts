import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export const runtime = 'nodejs';

const DEFAULT_IMAGE_DIR = path.resolve(process.cwd(), 'storage/images');
const MAX_SIZE_MB = Number(process.env.PRODUCT_IMAGE_MAX_SIZE_MB ?? '8');
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

function getUploadDir() {
  const configured = process.env.PRODUCT_IMAGE_DIR;
  return configured ? path.resolve(configured) : DEFAULT_IMAGE_DIR;
}

function ensureSafeExt(filename: string, mimeType: string) {
  const extFromName = path.extname(filename).toLowerCase();
  if (extFromName) {
    return extFromName;
  }
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/gif') return '.gif';
  return '.bin';
}

function buildStorageKey(filename: string, mimeType: string) {
  const now = new Date();
  const parts = [
    now.getUTCFullYear().toString(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
  ];
  const ext = ensureSafeExt(filename, mimeType);
  const uuid = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
  return ['products', ...parts, `${uuid}${ext}`].join('/');
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: '업로드할 파일이 필요합니다.' }, { status: 400 });
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: '이미지 파일만 업로드할 수 있습니다.' }, { status: 400 });
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: `파일 크기가 너무 큽니다. 최대 ${MAX_SIZE_MB}MB 이하만 허용됩니다.` }, { status: 400 });
    }

    const storageKey = buildStorageKey(file.name, file.type);
    const uploadDir = getUploadDir();
    const absolutePath = path.join(uploadDir, storageKey);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(absolutePath, buffer);

    return NextResponse.json({ storageKey });
  } catch (error) {
    const message = error instanceof Error ? error.message : '업로드 처리 중 오류가 발생했습니다.';
    console.error('[upload] failed to save file', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
