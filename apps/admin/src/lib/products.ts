import { prisma } from './prisma';
import type { Product, ExternalProductMap } from '@prisma/client';

export async function listProducts(limit = 20): Promise<(Product & { externalProductMaps: ExternalProductMap[] })[]> {
  try {
    return await prisma.product.findMany({
      orderBy: { created_at: 'desc' },
      take: limit,
      include: {
        externalProductMaps: true,
      },
    });
  } catch (error) {
    console.warn('상품 목록을 가져오지 못했습니다.', error);
    return [];
  }
}

export async function getProduct(productId: string) {
  try {
    return await prisma.product.findUnique({
      where: { id: productId },
      include: {
        externalProductMaps: true,
        optionValues: true,
      },
    });
  } catch (error) {
    console.warn('상품 정보를 가져오지 못했습니다.', error);
    return null;
  }
}
