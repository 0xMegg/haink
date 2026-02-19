import { z } from 'zod';

const SOT_MODE_VALUES = ['LEGACY_IMWEB', 'MASTER'] as const;
const SOURCE_OF_TRUTH_VALUES = ['IMWEB', 'MASTER'] as const;

const sotModeSchema = z.enum(SOT_MODE_VALUES);
const sourceOfTruthSchema = z.enum(SOURCE_OF_TRUTH_VALUES);
const imageSchema = z.object({
  storageKey: z.string().min(1, '이미지 업로드에 실패했습니다. 다시 시도해주세요.'),
  type: z.string().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const productFormSchema = z.object({
  productId: z.string().min(1, 'IMWEB 상품번호를 입력하세요.'),
  name: z.string().min(1, '상품명을 입력하세요.'),
  categoryIdsRaw: z.string().min(1, '카테고리 ID를 입력하세요.'),
  priceSale: z.coerce.number().int().nonnegative('가격은 0 이상이어야 합니다.'),
  inventoryTrack: z.boolean(),
  stockQty: z.coerce.number().int().nonnegative().nullable().optional(),
  descriptionHtml: z.string().optional(),
  saleStatus: z.string().optional(),
  displayStatus: z.boolean(),
  optionName: z.string().optional().nullable(),
  optionValues: z.string().optional(),
  issuedCategoryId: z.string().optional(),
  currentCategoryId: z.string().optional(),
  sotMode: sotModeSchema.optional(),
  externalUrl: z
    .string()
    .url('올바른 URL 형식이 아닙니다.')
    .or(z.literal(''))
    .optional(),
  sourceOfTruth: sourceOfTruthSchema.optional(),
  rawSnapshot: z.string().optional(),
  images: z.array(imageSchema).optional(),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;
export const SOT_MODE_OPTIONS = SOT_MODE_VALUES;
export const SOURCE_OF_TRUTH_OPTIONS = SOURCE_OF_TRUTH_VALUES;
export type ProductImageInput = z.infer<typeof imageSchema>;
