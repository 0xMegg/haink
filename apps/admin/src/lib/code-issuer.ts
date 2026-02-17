import type { Prisma } from '@prisma/client';

const MASTER_CODE_PAD = 5;

export class CodeIssuer {
  async issue(tx: Prisma.TransactionClient, issuedCategoryId: string) {
    const trimmed = issuedCategoryId.trim();
    if (!trimmed) {
      throw new Error('issued_category_id 가 비어있습니다.');
    }
    const seqRow = await tx.codeSequenceByCategory.upsert({
      where: { issued_category_id: trimmed },
      create: {
        issued_category_id: trimmed,
        next_seq: 2,
      },
      update: {
        next_seq: { increment: 1 },
      },
      select: { next_seq: true },
    });
    const sequence = seqRow.next_seq - 1;
    const masterCode = `${trimmed}-${sequence.toString().padStart(MASTER_CODE_PAD, '0')}`;
    return { masterCode };
  }
}
