import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const sequences = await prisma.codeSequenceByCategory.findMany({
      orderBy: { issued_category_id: 'asc' },
    });
    return NextResponse.json({ data: sequences });
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
