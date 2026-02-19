import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { productFormSchema, type ProductImageInput } from '@/lib/product-schema';
import { parseCategoryIds } from '@/lib/category';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: {
      externalProductMaps: true,
      optionValues: true,
      images: true,
    },
  });
  if (!product) {
    return NextResponse.json({ error: '상품을 찾을 수 없습니다.' }, { status: 404 });
  }
  return NextResponse.json({ data: product });
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const payload = await request.json();
    const parsed = productFormSchema.parse(payload);
    const categories = parseCategoryIds(parsed.categoryIdsRaw);
    const optionValues = (parsed.optionValues ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const saleStatus = parsed.saleStatus?.trim() ? parsed.saleStatus : null;
    const description = parsed.descriptionHtml?.trim() ? parsed.descriptionHtml : null;
    const optionName = parsed.optionName?.trim() ? parsed.optionName : null;
    const currentCategoryId = parsed.currentCategoryId ?? categories[0];
    const sotMode = parsed.sotMode ?? 'LEGACY_IMWEB';
    const sourceOfTruth = parsed.sourceOfTruth ?? 'IMWEB';
    const externalUrl = parsed.externalUrl?.trim() ? parsed.externalUrl.trim() : null;
    const rawSnapshot = parseRawSnapshot(parsed.rawSnapshot);
    const imageInputs = normalizeImages(parsed.images);

    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.productOptionValue.deleteMany({ where: { product_id: params.id } });
      await tx.productImage.deleteMany({ where: { product_id: params.id } });
      const imwebMap = await tx.externalProductMap.findFirst({
        where: { product_id: params.id, system: 'IMWEB' },
      });

      await tx.product.update({
        where: { id: params.id },
        data: {
          name: parsed.name,
          current_category_id: currentCategoryId,
          category_ids_raw: categories,
          price_sale: parsed.priceSale,
          inventory_track: parsed.inventoryTrack,
          stock_qty: parsed.inventoryTrack ? parsed.stockQty ?? null : null,
          sale_status: saleStatus,
          display_status: parsed.displayStatus,
          description_html: description,
          option_name: optionName,
          sot_mode: sotMode,
          images:
            imageInputs.length > 0
              ? {
                  createMany: {
                    data: imageInputs,
                  },
                }
              : undefined,
          optionValues:
            optionValues.length > 0 && optionName
              ? {
                  createMany: {
                    data: optionValues.map((value) => ({
                      option_name: optionName!,
                      display_value: value,
                      canonical_value: value.toUpperCase(),
                    })),
                  },
                }
              : undefined,
        },
      });

      if (imwebMap) {
        await tx.externalProductMap.update({
          where: { id: imwebMap.id },
          data: {
            external_url: externalUrl,
            source_of_truth: sourceOfTruth,
            raw_snapshot: rawSnapshot ?? undefined,
          },
        });
      }

      const refreshed = await tx.product.findUnique({
        where: { id: params.id },
        include: {
          externalProductMaps: true,
          optionValues: true,
          images: true,
        },
      });

      if (!refreshed) {
        throw new Error('업데이트된 상품을 찾을 수 없습니다.');
      }

      return refreshed;
    });

    return NextResponse.json({ data: updated });
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

function normalizeImages(images?: ProductImageInput[] | null) {
  if (!images || images.length === 0) {
    return [];
  }
  return images
    .filter((image) => Boolean(image.storageKey))
    .map((image, index) => ({
      type: image.type ?? 'THUMBNAIL',
      storage_key: image.storageKey,
      sort_order: image.sortOrder ?? index,
    }));
}
