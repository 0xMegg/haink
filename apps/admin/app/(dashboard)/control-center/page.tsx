import { prisma } from '@/lib/prisma';
import { ProductDeletionPanel } from '@/components/control-center/product-deletion-panel';
import { MasterCodePanel } from '@/components/control-center/master-code-panel';

export const dynamic = 'force-dynamic';

export default async function ControlCenterPage() {
  const [sequences, totalProducts, imwebMapCount] = await Promise.all([
    prisma.codeSequenceByCategory.findMany({
      orderBy: { issued_category_id: 'asc' },
    }),
    prisma.product.count(),
    prisma.externalProductMap.count({
      where: { system: 'IMWEB' },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Control</p>
          <h2 className="text-2xl font-semibold">제어 센터</h2>
          <p className="text-sm text-muted-foreground">상품 삭제 및 마스터코드 시퀀스를 한 곳에서 관리합니다.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ProductDeletionPanel />
        <section className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="mb-4 space-y-1">
            <h3 className="text-lg font-semibold">상태 요약</h3>
            <p className="text-sm text-muted-foreground">현재 데이터 규모를 빠르게 확인하세요.</p>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border p-3">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">등록된 상품</dt>
              <dd className="text-2xl font-semibold">{totalProducts.toLocaleString()}</dd>
            </div>
            <div className="rounded-md border p-3">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">IMWEB 매핑</dt>
              <dd className="text-2xl font-semibold">{imwebMapCount.toLocaleString()}</dd>
            </div>
            <div className="rounded-md border p-3 sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">마스터코드 카테고리</dt>
              <dd className="text-2xl font-semibold">{sequences.length.toLocaleString()}</dd>
            </div>
          </dl>
        </section>
      </div>

      <MasterCodePanel initialSequences={sequences} />
    </div>
  );
}
