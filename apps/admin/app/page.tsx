import Link from 'next/link';
import { listProducts } from '@/lib/products';
import { ProductList } from '@/components/products/product-list';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const products = await listProducts();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">최근 등록된 상품</h2>
          <p className="text-sm text-muted-foreground">가장 최근 20개 상품을 표시합니다.</p>
        </div>
        <Button asChild>
          <Link href="/products/new">상품 등록</Link>
        </Button>
      </div>
      <ProductList products={products} />
    </div>
  );
}
