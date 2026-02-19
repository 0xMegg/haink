import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ProductForm } from '@/components/products/product-form';
import { Button } from '@/components/ui/button';

interface Props {
  params: { id: string };
}

export default async function EditProductPage({ params }: Props) {
  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: {
      externalProductMaps: true,
      optionValues: true,
      images: true,
    },
  });

  if (!product) {
    notFound();
  }

  const imweb = product.externalProductMaps.find(
    (map: (typeof product.externalProductMaps)[number]) => map.system === 'IMWEB'
  );
  const categoryIds = Array.isArray(product.category_ids_raw) ? product.category_ids_raw.join(',') : '';
  const rawSnapshot = imweb?.raw_snapshot ? JSON.stringify(imweb.raw_snapshot, null, 2) : '';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">master_code: {product.master_code}</p>
          <h2 className="text-xl font-semibold">상품 수정</h2>
        </div>
        <Button variant="outline" asChild>
          <Link href="/">목록으로</Link>
        </Button>
      </div>
      <ProductForm
        mode="edit"
        productId={product.id}
        defaultValues={{
          productId: imweb?.external_id ?? '',
          name: product.name,
          categoryIdsRaw: categoryIds,
          priceSale: product.price_sale,
          inventoryTrack: product.inventory_track,
          stockQty: product.stock_qty ?? undefined,
          saleStatus: product.sale_status ?? undefined,
          displayStatus: product.display_status,
          descriptionHtml: product.description_html ?? undefined,
          optionName: product.option_name ?? undefined,
          optionValues: product.optionValues
            .map((value: (typeof product.optionValues)[number]) => value.display_value)
            .join(','),
          issuedCategoryId: product.issued_category_id,
          currentCategoryId: product.current_category_id,
          sotMode: product.sot_mode,
          externalUrl: imweb?.external_url ?? '',
          sourceOfTruth: imweb?.source_of_truth ?? 'IMWEB',
          rawSnapshot,
          images: product.images
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((image) => ({
              storageKey: image.storage_key,
              type: image.type,
              sortOrder: image.sort_order,
            })),
        }}
      />
    </div>
  );
}
