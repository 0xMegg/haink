import Link from 'next/link';
import type { Product, ExternalProductMap, ProductImage } from '@prisma/client';
import { resolveImageUrl } from '@/lib/image-url';
import { Badge } from '@/components/ui/badge';

interface Props {
  products: (Product & { externalProductMaps: ExternalProductMap[]; images: ProductImage[] })[];
}

export function ProductList({ products }: Props) {
  if (products.length === 0) {
    return <p className="text-sm text-muted-foreground">아직 등록된 상품이 없습니다.</p>;
  }

  return (
    <div className="space-y-3">
      {products.map((product) => {
        const imwebId = product.externalProductMaps.find((m) => m.system === 'IMWEB');
        const thumbnail = [...product.images].sort((a, b) => a.sort_order - b.sort_order)[0];
        const thumbnailUrl = thumbnail ? resolveImageUrl(thumbnail.storage_key) : null;
        return (
          <div key={product.id} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{product.name}</p>
                <p className="text-xs text-muted-foreground">master_code: {product.master_code}</p>
              </div>
              <div className="flex items-center gap-2">
                {product.display_status ? <Badge>진열중</Badge> : <Badge variant="secondary">숨김</Badge>}
                <Link href={`/products/${product.id}`} className="text-sm text-primary underline">
                  수정
                </Link>
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {thumbnailUrl ? <img src={thumbnailUrl} alt={product.name} className="mb-2 h-24 w-24 rounded-md object-cover" /> : null}
              <p>가격: {product.price_sale.toLocaleString()}원 · 재고관리: {product.inventory_track ? 'Y' : 'N'}</p>
              <p>IMWEB 상품번호: {imwebId?.external_id ?? '-'}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
