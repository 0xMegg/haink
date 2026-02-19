'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Identifier = 'MASTER_CODE' | 'IMWEB_ID' | 'PRODUCT_ID';

interface DeleteResponse {
  data?: {
    id: string;
    masterCode: string;
    name: string;
  };
  error?: string;
}

const identifierOptions: {
  value: Identifier;
  label: string;
  placeholder: string;
  description: string;
}[] = [
  {
    value: 'MASTER_CODE',
    label: '마스터코드',
    placeholder: '예: CATE9-00042',
    description: '발급된 master_code 기준으로 상품을 찾습니다.',
  },
  {
    value: 'IMWEB_ID',
    label: 'IMWEB 상품번호',
    placeholder: '예: 5757',
    description: 'ExternalProductMap(IMWEB) 기준으로 검색합니다.',
  },
  {
    value: 'PRODUCT_ID',
    label: '상품 UUID',
    placeholder: '예: 7a1b1d46-1c8c-4bf0...',
    description: 'Product 테이블의 기본 키(UUID)를 직접 입력합니다.',
  },
];

const selectClassName =
  'flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export function ProductDeletionPanel() {
  const [identifier, setIdentifier] = React.useState<Identifier>('MASTER_CODE');
  const [value, setValue] = React.useState('');
  const [isSubmitting, setSubmitting] = React.useState(false);
  const [lastDeleted, setLastDeleted] = React.useState<DeleteResponse['data'] | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!value.trim()) {
      toast.error('삭제할 값을 입력하세요.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/tools/delete-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier,
          value,
        }),
      });
      const data: DeleteResponse = await res.json();
      if (!res.ok || !data.data) {
        throw new Error(data.error ?? '상품 삭제에 실패했습니다.');
      }
      toast.success(`${data.data.name} (master_code: ${data.data.masterCode}) 삭제 완료`);
      setLastDeleted(data.data);
      setValue('');
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const option = identifierOptions.find((item) => item.value === identifier) ?? identifierOptions[0];

  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="mb-4 space-y-1">
        <h3 className="text-lg font-semibold">상품 삭제</h3>
        <p className="text-sm text-muted-foreground">식별자를 선택하고 값을 입력하면 해당 상품을 즉시 삭제합니다.</p>
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="delete-identifier">대상 구분</Label>
          <select
            id="delete-identifier"
            className={selectClassName}
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value as Identifier)}
            disabled={isSubmitting}
          >
            {identifierOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="delete-value">값</Label>
          <Input
            id="delete-value"
            placeholder={option.placeholder}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            disabled={isSubmitting}
          />
          <p className="text-xs text-muted-foreground">{option.description}</p>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting || value.trim().length === 0}>
            {isSubmitting ? '삭제 중...' : '상품 삭제'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setValue('');
              setLastDeleted(null);
            }}
            disabled={isSubmitting}
          >
            초기화
          </Button>
        </div>
      </form>
      {lastDeleted ? (
        <div className="mt-4 rounded-md bg-muted/50 p-3 text-sm">
          <p className="font-medium">{lastDeleted.name}</p>
          <p className="text-xs text-muted-foreground">master_code: {lastDeleted.masterCode}</p>
          <p className="text-xs text-muted-foreground break-all">UUID: {lastDeleted.id}</p>
        </div>
      ) : null}
    </section>
  );
}
