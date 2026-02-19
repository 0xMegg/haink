import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Identifier = 'PRODUCT_ID' | 'MASTER_CODE' | 'IMWEB_ID';

interface DeletePayload {
  identifier?: Identifier;
  value?: string;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as DeletePayload;
    const identifier = payload.identifier;
    const value = payload.value?.trim();

    if (!identifier || !isIdentifier(identifier)) {
      return NextResponse.json({ error: 'identifier 값이 올바르지 않습니다.' }, { status: 400 });
    }
    if (!value) {
      return NextResponse.json({ error: '삭제할 대상 값을 입력하세요.' }, { status: 400 });
    }

    const product = await resolveProduct(identifier, value);
    if (!product) {
      return NextResponse.json({ error: '해당 조건의 상품을 찾을 수 없습니다.' }, { status: 404 });
    }

    await prisma.product.delete({ where: { id: product.id } });

    return NextResponse.json({
      data: {
        id: product.id,
        masterCode: product.master_code,
        name: product.name,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function resolveProduct(identifier: Identifier, value: string) {
  if (identifier === 'PRODUCT_ID') {
    return prisma.product.findUnique({
      where: { id: value },
      select: {
        id: true,
        name: true,
        master_code: true,
      },
    });
  }
  if (identifier === 'MASTER_CODE') {
    return prisma.product.findUnique({
      where: { master_code: value },
      select: {
        id: true,
        name: true,
        master_code: true,
      },
    });
  }
  if (identifier === 'IMWEB_ID') {
    const map = await prisma.externalProductMap.findUnique({
      where: {
        system_external_id: {
          system: 'IMWEB',
          external_id: value,
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            master_code: true,
          },
        },
      },
    });
    return map?.product ?? null;
  }
  return null;
}

function isIdentifier(value: string): value is Identifier {
  return value === 'PRODUCT_ID' || value === 'MASTER_CODE' || value === 'IMWEB_ID';
}
