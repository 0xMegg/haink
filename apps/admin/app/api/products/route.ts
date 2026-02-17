import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { listProducts } from '@/lib/products';
import { productFormSchema } from '@/lib/product-schema';
import { parseCategoryIds } from '@/lib/category';
import { CodeIssuer } from '@/lib/code-issuer';

const codeIssuer = new CodeIssuer();

export async function GET() {
  const data = await listProducts(50);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const result = productFormSchema.parse(payload);
    const categories = parseCategoryIds(result.categoryIdsRaw);
    const issuedCategoryId = result.issuedCategoryId ?? categories[0];
    const currentCategoryId = result.currentCategoryId ?? categories[0];
    const description = result.descriptionHtml?.trim() ? result.descriptionHtml : null;
    const saleStatus = result.saleStatus?.trim() ? result.saleStatus : null;
    const optionName = result.optionName?.trim() ? result.optionName : null;
    const sotMode = result.sotMode ?? 'LEGACY_IMWEB';
    const sourceOfTruth = result.sourceOfTruth ?? 'IMWEB';
    const externalUrl = result.externalUrl?.trim() ? result.externalUrl.trim() : null;
    const rawSnapshot = parseRawSnapshot(result.rawSnapshot);

    const optionValues = (result.optionValues ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    const product = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.externalProductMap.findUnique({
        where: {
          system_external_id: {
            system: 'IMWEB',
            external_id: result.productId,
          },
        },
      });
      if (existing) {
        throw new Error('이미 존재하는 IMWEB 상품입니다.');
      }

      const { masterCode } = await codeIssuer.issue(tx, issuedCategoryId);

      const created = await tx.product.create({
        data: {
          master_code: masterCode,
          name: result.name,
          issued_category_id: issuedCategoryId,
          current_category_id: currentCategoryId,
          category_ids_raw: categories,
          price_sale: result.priceSale,
          inventory_track: result.inventoryTrack,
          stock_qty: result.inventoryTrack ? result.stockQty ?? null : null,
          sale_status: saleStatus,
          display_status: result.displayStatus,
          description_html: description,
          option_name: optionName,
          sot_mode: sotMode,
          externalProductMaps: {
            create: {
              system: 'IMWEB',
              external_id: result.productId,
              external_url: externalUrl,
              source_of_truth: sourceOfTruth,
              raw_snapshot: rawSnapshot ?? undefined,
            },
          },
          optionValues:
            optionValues.length > 0 && optionName
              ? {
                  createMany: {
                    data: optionValues.map((value: (typeof optionValues)[number]) => ({
                      option_name: optionName!,
                      display_value: value,
                      canonical_value: value.toUpperCase(),
                    })),
                  },
                }
              : undefined,
        },
        include: {
          externalProductMaps: true,
          optionValues: true,
        },
      });

      return created;
    });

    return NextResponse.json({ data: product }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function parseRawSnapshot(value?: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error('rawSnapshot 필드는 올바른 JSON 문자열이어야 합니다.');
  }
}
