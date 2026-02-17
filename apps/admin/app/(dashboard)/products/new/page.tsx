import Link from 'next/link';
import { ProductForm } from '@/components/products/product-form';
import { Button } from '@/components/ui/button';

export default function NewProductPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">신규 상품 등록</h2>
          <p className="text-sm text-muted-foreground">카테고리 ID, 가격 등 필수 정보를 입력하세요.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/">목록으로</Link>
        </Button>
      </div>
      <ProductForm mode="create" />
    </div>
  );
}
