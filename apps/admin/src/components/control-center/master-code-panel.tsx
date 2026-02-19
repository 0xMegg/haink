'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type SequenceRow = {
  issued_category_id: string;
  next_seq: number;
};

interface Props {
  initialSequences: SequenceRow[];
}

type RowState = SequenceRow & {
  draft: string;
};

export function MasterCodePanel({ initialSequences }: Props) {
  const [rows, setRows] = React.useState<RowState[]>(() => prepareRows(initialSequences));
  const [pendingCategory, setPendingCategory] = React.useState<string | null>(null);
  const [newCategory, setNewCategory] = React.useState('');
  const [newSeq, setNewSeq] = React.useState('1');
  const [isCreating, setCreating] = React.useState(false);

  React.useEffect(() => {
    setRows(prepareRows(initialSequences));
  }, [initialSequences]);

  const handleDraftChange = (category: string, value: string) => {
    setRows((prev) =>
      prev.map((row) => (row.issued_category_id === category ? { ...row, draft: value } : row))
    );
  };

  const handleUpdate = async (category: string) => {
    const row = rows.find((item) => item.issued_category_id === category);
    if (!row) return;

    const parsed = Number(row.draft);
    if (!Number.isInteger(parsed) || parsed < 1) {
      toast.error('시퀀스는 1 이상의 정수여야 합니다.');
      return;
    }

    try {
      setPendingCategory(category);
      const res = await fetch(`/api/tools/master-codes/${encodeURIComponent(category)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nextSeq: parsed }),
      });
      const data = await res.json();
      if (!res.ok || !data.data) {
        throw new Error(data.error ?? '시퀀스 업데이트에 실패했습니다.');
      }
      toast.success(`${category} → next_seq ${parsed.toLocaleString()}로 갱신 완료`);
      setRows((prev) =>
        prev
          .map((item) =>
            item.issued_category_id === category
              ? { ...item, next_seq: parsed, draft: String(parsed) }
              : item
          )
          .sort(sortRows)
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류';
      toast.error(message);
    } finally {
      setPendingCategory(null);
    }
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const category = newCategory.trim();
    const parsedSeq = Number(newSeq);
    if (!category) {
      toast.error('카테고리 ID를 입력하세요.');
      return;
    }
    if (!Number.isInteger(parsedSeq) || parsedSeq < 1) {
      toast.error('시작 시퀀스는 1 이상의 정수여야 합니다.');
      return;
    }
    try {
      setCreating(true);
      const res = await fetch(`/api/tools/master-codes/${encodeURIComponent(category)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nextSeq: parsedSeq }),
      });
      const data = await res.json();
      if (!res.ok || !data.data) {
        throw new Error(data.error ?? '카테고리 생성/갱신에 실패했습니다.');
      }
      toast.success(`${category} 카테고리 등록 완료`);
      setRows((prev) => upsertRow(prev, category, parsedSeq));
      setNewCategory('');
      setNewSeq('1');
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류';
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  const totalCategories = rows.length;

  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">마스터코드 진행 관리</h3>
          <p className="text-sm text-muted-foreground">
            카테고리별 next_seq 값을 조정하여 master_code 발급 흐름을 제어하세요.
          </p>
        </div>
        <div className="rounded-md bg-muted/50 px-3 py-1 text-sm">
          총 카테고리: {totalCategories}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="pb-2 font-medium">카테고리 ID</th>
              <th className="pb-2 font-medium">진행 상황</th>
              <th className="pb-2 font-medium">next_seq 조정</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-6 text-center text-sm text-muted-foreground">
                  아직 발급된 카테고리가 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const lastSeq = Math.max(row.next_seq - 1, 0);
                const lastCode = lastSeq > 0 ? formatMasterCode(row.issued_category_id, lastSeq) : '발급 이력 없음';
                const nextCode = formatMasterCode(row.issued_category_id, row.next_seq);
                const isPending = pendingCategory === row.issued_category_id;
                return (
                  <tr key={row.issued_category_id} className="border-t">
                    <td className="py-3 font-medium">{row.issued_category_id}</td>
                    <td className="py-3">
                      <p>{lastCode}</p>
                      <p className="text-xs text-muted-foreground">다음: {nextCode}</p>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          value={row.draft}
                          onChange={(event) => handleDraftChange(row.issued_category_id, event.target.value)}
                          className="w-28"
                          disabled={isPending}
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleUpdate(row.issued_category_id)}
                          disabled={isPending}
                        >
                          {isPending ? '저장 중...' : '저장'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <form className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr),140px,auto]" onSubmit={handleCreate}>
        <div className="space-y-2">
          <Label htmlFor="new-category">카테고리 추가/갱신</Label>
          <Input
            id="new-category"
            placeholder="예: CATE9"
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value.toUpperCase())}
            disabled={isCreating}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-seq">next_seq</Label>
          <Input
            id="new-seq"
            type="number"
            min={1}
            value={newSeq}
            onChange={(event) => setNewSeq(event.target.value)}
            disabled={isCreating}
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={isCreating}>
            {isCreating ? '처리 중...' : '적용'}
          </Button>
        </div>
      </form>
    </section>
  );
}

function prepareRows(rows: SequenceRow[]): RowState[] {
  return rows
    .map((row) => ({
      ...row,
      draft: String(row.next_seq),
    }))
    .sort(sortRows);
}

function sortRows(a: RowState, b: RowState) {
  return a.issued_category_id.localeCompare(b.issued_category_id);
}

function upsertRow(rows: RowState[], category: string, nextSeq: number) {
  const exists = rows.some((row) => row.issued_category_id === category);
  if (exists) {
    return rows
      .map((row) =>
        row.issued_category_id === category ? { ...row, next_seq: nextSeq, draft: String(nextSeq) } : row
      )
      .sort(sortRows);
  }
  return [...rows, { issued_category_id: category, next_seq: nextSeq, draft: String(nextSeq) }].sort(sortRows);
}

function formatMasterCode(category: string, seq: number) {
  return `${category}-${seq.toString().padStart(5, '0')}`;
}
