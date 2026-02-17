'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { productFormSchema, type ProductFormValues, SOT_MODE_OPTIONS, SOURCE_OF_TRUTH_OPTIONS } from '@/lib/product-schema';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface ProductFormProps {
  mode: 'create' | 'edit';
  productId?: string;
  defaultValues?: Partial<ProductFormValues>;
}

const emptyDefaults: ProductFormValues = {
  productId: '',
  name: '',
  categoryIdsRaw: '',
  priceSale: 0,
  inventoryTrack: false,
  stockQty: null,
  descriptionHtml: '',
  saleStatus: '',
  displayStatus: true,
  optionName: '',
  optionValues: '',
  issuedCategoryId: '',
  currentCategoryId: '',
  sotMode: 'LEGACY_IMWEB',
  externalUrl: '',
  sourceOfTruth: 'IMWEB',
  rawSnapshot: '',
};
const selectClassName =
  'flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export function ProductForm({ mode, productId, defaultValues }: ProductFormProps) {
  const router = useRouter();
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      ...emptyDefaults,
      ...defaultValues,
      productId: defaultValues?.productId ?? '',
      optionValues: defaultValues?.optionValues ?? '',
      currentCategoryId: defaultValues?.currentCategoryId ?? '',
      issuedCategoryId: defaultValues?.issuedCategoryId ?? '',
      sotMode: defaultValues?.sotMode ?? 'LEGACY_IMWEB',
      sourceOfTruth: defaultValues?.sourceOfTruth ?? 'IMWEB',
      externalUrl: defaultValues?.externalUrl ?? '',
      rawSnapshot: defaultValues?.rawSnapshot ?? '',
    },
  });
  const [isSubmitting, setSubmitting] = React.useState(false);
  const inventoryTrack = form.watch('inventoryTrack');

  React.useEffect(() => {
    if (!inventoryTrack) {
      form.setValue('stockQty', null, { shouldDirty: true });
    }
  }, [inventoryTrack, form]);

  type ApiResponse = {
    error?: string;
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      setSubmitting(true);
      const endpoint = mode === 'create' ? '/api/products' : `/api/products/${productId}`;
      const res = await fetch(endpoint, {
        method: mode === 'create' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data: ApiResponse = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? '요청이 실패했습니다.');
      }
      toast.success(mode === 'create' ? '상품이 등록되었습니다.' : '상품이 수정되었습니다.');
      router.refresh();
      if (mode === 'create') {
        form.reset(emptyDefaults);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2">
        <Field label="IMWEB 상품번호" required>
          <Input placeholder="예: 5757" disabled={mode === 'edit'} {...form.register('productId')} />
          <FormError message={form.formState.errors.productId?.message} />
        </Field>
        <Field label="상품명" required>
          <Input placeholder="상품명" {...form.register('name')} />
          <FormError message={form.formState.errors.name?.message} />
        </Field>
        <Field label="카테고리 ID (쉼표 구분)" required>
          <Input placeholder="CATE9,CATE44" {...form.register('categoryIdsRaw')} />
          <FormError message={form.formState.errors.categoryIdsRaw?.message} />
        </Field>
        <Field label="판매가" required>
          <Input type="number" min={0} step={1} {...form.register('priceSale', { valueAsNumber: true })} />
          <FormError message={form.formState.errors.priceSale?.message} />
        </Field>
        <Field label="판매 상태">
          <Input placeholder="판매중" {...form.register('saleStatus')} />
        </Field>
        <Field label="SOT 모드" required>
          <select className={selectClassName} {...form.register('sotMode')}>
            {SOT_MODE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <FormError message={form.formState.errors.sotMode?.message} />
        </Field>
        <Field label="옵션 이름">
          <Input placeholder="예: VERSION" {...form.register('optionName')} />
        </Field>
        <Field className="md:col-span-2" label="옵션 값 (쉼표 구분)">
          <Input placeholder="KARINA,GISELLE" {...form.register('optionValues')} />
        </Field>
        <Field className="md:col-span-2" label="상품 상세">
          <Textarea rows={4} {...form.register('descriptionHtml')} />
        </Field>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Field label="발급 기준 카테고리 ID">
          <Input placeholder="issued_category_id" {...form.register('issuedCategoryId')} />
          <FormError message={form.formState.errors.issuedCategoryId?.message} />
        </Field>
        <Field label="현재 카테고리 ID">
          <Input placeholder="current_category_id" {...form.register('currentCategoryId')} />
          <FormError message={form.formState.errors.currentCategoryId?.message} />
        </Field>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <ToggleField label="재고 관리" description="Y면 수량 입력 필요">
          <Switch
            checked={form.watch('inventoryTrack')}
            onCheckedChange={(value) => form.setValue('inventoryTrack', value, { shouldDirty: true })}
          />
        </ToggleField>
        <Field label="재고 수량">
          <Input type="number" min={0} step={1} disabled={!inventoryTrack} {...form.register('stockQty', { valueAsNumber: true })} />
        </Field>
        <ToggleField label="노출 상태">
          <Switch
            checked={form.watch('displayStatus')}
            onCheckedChange={(value) => form.setValue('displayStatus', value, { shouldDirty: true })}
          />
        </ToggleField>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Field label="외부 상품 URL">
          <Input type="url" placeholder="https://..." {...form.register('externalUrl')} />
          <FormError message={form.formState.errors.externalUrl?.message} />
        </Field>
        <Field label="Source of Truth">
          <select className={selectClassName} {...form.register('sourceOfTruth')}>
            {SOURCE_OF_TRUTH_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <FormError message={form.formState.errors.sourceOfTruth?.message} />
        </Field>
        <Field className="md:col-span-2" label="Raw Snapshot JSON">
          <Textarea rows={4} placeholder='{"foo":"bar"}' {...form.register('rawSnapshot')} />
        </Field>
      </section>

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {mode === 'create' ? '상품 등록' : '상품 수정'}
        </Button>
        {mode === 'edit' && (
          <Button type="button" variant="outline" onClick={() => form.reset(form.getValues())}>
            변경 취소
          </Button>
        )}
      </div>
    </form>
  );
}

function Field({ label, children, required, className }: { label: string; children: React.ReactNode; required?: boolean; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label>
        {label}
        {required ? <span className="ml-1 text-destructive">*</span> : null}
      </Label>
      {children}
    </div>
  );
}

function ToggleField({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}
