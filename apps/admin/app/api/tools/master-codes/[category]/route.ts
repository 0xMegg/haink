import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface UpdatePayload {
  nextSeq?: number;
}

export async function PATCH(request: Request, { params }: { params: { category: string } }) {
  try {
    const payload = (await request.json()) as UpdatePayload;
    const rawCategory = params.category ? decodeURIComponent(params.category) : '';
    const trimmedCategory = rawCategory.trim();
    const nextSeq = payload.nextSeq;

    if (!trimmedCategory) {
      return NextResponse.json({ error: '카테고리 ID가 필요합니다.' }, { status: 400 });
    }
    if (typeof nextSeq !== 'number' || !Number.isInteger(nextSeq) || nextSeq < 1) {
      return NextResponse.json({ error: 'nextSeq는 1 이상의 정수여야 합니다.' }, { status: 400 });
    }

    const updated = await prisma.codeSequenceByCategory.upsert({
      where: { issued_category_id: trimmedCategory },
      update: { next_seq: nextSeq },
      create: {
        issued_category_id: trimmedCategory,
        next_seq: nextSeq,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
