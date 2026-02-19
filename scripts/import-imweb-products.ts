#!/usr/bin/env tsx
import { promises as fs } from 'fs';
import path from 'path';
import process from 'process';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import {
  PrismaClient,
  ExternalSystem,
  SourceOfTruth,
  Prisma,
} from '@prisma/client';

import { loadImwebExcelRows } from '../src/lib/excel.js';
import { parseCategoryIds } from '../src/lib/categories.js';
import { canonicalizeOptionValue, normalizeWhitespace } from '../src/lib/canonicalize.js';
import { CodeIssuer } from '../src/lib/codeIssuer.js';
import {
  ensureDir,
  parseNonNegativeInt,
  parseYnToBoolean,
  resolveReportPath,
  normalizeYn,
} from '../src/lib/utils.js';

const prisma = new PrismaClient();
const codeIssuer = new CodeIssuer();

interface CliArgs {
  file: string;
  allowExisting: boolean;
  report?: string;
  sheet?: string;
  progressInterval: number;
}

interface ImportWarning {
  rowNumber: number;
  message: string;
}

interface ImportError {
  rowNumber: number;
  message: string;
  code?: string;
}

interface ImportReport {
  startedAt: string;
  finishedAt?: string;
  file: string;
  allowExisting: boolean;
  totalRows: number;
  processed: number;
  skippedExisting: number;
  warnings: ImportWarning[];
  errors: ImportError[];
  status: 'success' | 'failed' | 'partial';
}

interface OptionValueInput {
  displayValue: string;
  canonicalValue: string;
}

interface ParsedRow {
  rowNumber: number;
  productId: string;
  name: string;
  categories: string[];
  issuedCategoryId: string;
  currentCategoryId: string;
  priceSale: number;
  inventoryTrack: boolean;
  stockQty: number | null;
  saleStatus: string | null;
  displayStatus: boolean;
  descriptionHtml: string | null;
  optionName: string | null;
  optionValues: OptionValueInput[];
  thumbnailUrl?: string;
  productUrl?: string;
  raw?: Prisma.InputJsonValue;
}

class ImportRowError extends Error {
  constructor(public readonly rowNumber: number, message: string, public readonly code?: string) {
    super(`[Row ${rowNumber}] ${message}`);
    this.name = 'ImportRowError';
  }
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option('file', {
      type: 'string',
      demandOption: true,
      describe: 'Imweb Excel 파일 경로',
    })
    .option('allow-existing', {
      type: 'boolean',
      default: false,
      describe: '이미 매핑된 상품이 있을 경우 건너뛰고 계속 진행합니다.',
    })
    .option('sheet', {
      type: 'string',
      describe: '가져올 시트명 (기본은 첫번째 시트)',
    })
    .option('report', {
      type: 'string',
      describe: '리포트 JSON 저장 경로',
    })
    .option('progress-interval', {
      type: 'number',
      default: 50,
      describe: '몇 건마다 진행 상황을 로그로 남길지 설정',
    })
    .help()
    .parseAsync();

  const args: CliArgs = {
    file: path.resolve(argv.file),
    allowExisting: argv['allow-existing'] ?? false,
    report: argv.report,
    sheet: argv.sheet,
    progressInterval: Math.max(1, argv['progress-interval'] ?? 50),
  };

  const reportPath = path.resolve(
    resolveReportPath(args.report ?? path.join('reports', `imweb-import-${new Date().toISOString().replace(/[:.]/g, '-')}.json`))
  );
  const report: ImportReport = {
    startedAt: new Date().toISOString(),
    file: args.file,
    allowExisting: args.allowExisting,
    totalRows: 0,
    processed: 0,
    skippedExisting: 0,
    warnings: [],
    errors: [],
    status: 'failed',
  };

  try {
    const rows = loadImwebExcelRows(args.file, { sheetName: args.sheet });
    report.totalRows = rows.length;
    console.log(`총 ${rows.length}개의 행을 감지했습니다.`);

    for (let index = 0; index < rows.length; index += 1) {
      const excelRow = rows[index];
      const rowNumber = index + 2; // 헤더가 1행이라고 가정

      try {
        const parsed = parseRow(excelRow, rowNumber, report.warnings);
        const result = await importRow(parsed, args.allowExisting);
        if (result === 'skipped') {
          report.skippedExisting += 1;
        } else {
          report.processed += 1;
        }
      } catch (error) {
        const rowError = ensureImportRowError(error, rowNumber);
        report.errors.push({ rowNumber: rowError.rowNumber, message: rowError.message, code: rowError.code });
        console.error(`[에러] ${rowError.message}`);
        continue;
      }

      if ((index + 1) % args.progressInterval === 0) {
        console.log(`[진행] ${index + 1}/${rows.length} 건 처리 완료`);
      }
    }

    if (report.errors.length > 0) {
      report.status = 'partial';
      process.exitCode = 1;
      console.warn(`총 ${report.errors.length}건의 에러가 있었지만 나머지 행 처리를 완료했습니다.`);
    } else {
      report.status = 'success';
      console.log('모든 행 처리가 완료되었습니다.');
    }
  } catch (error) {
    console.error('가져오기 중 오류 발생:', error);
    process.exitCode = 1;
  } finally {
    report.finishedAt = new Date().toISOString();
    await writeReport(reportPath, report);
    await prisma.$disconnect();
    console.log(`리포트: ${reportPath}`);
  }
}

function parseRow(row: Record<string, unknown>, rowNumber: number, warnings: ImportWarning[]): ParsedRow {
  const productId = coerceString(row['상품번호'], '상품번호');
  if (!productId) {
    throw new ImportRowError(rowNumber, '상품번호가 비어있습니다.', 'PRODUCT_ID');
  }

  const name = coerceString(row['상품명'], '상품명');
  if (!name) {
    throw new ImportRowError(rowNumber, '상품명이 비어있습니다.', 'PRODUCT_NAME');
  }

  let categories: string[];
  try {
    categories = parseCategoryIds(coerceString(row['카테고리ID'], '카테고리ID'));
  } catch (categoryError) {
    throw new ImportRowError(rowNumber, categoryError instanceof Error ? categoryError.message : '카테고리 파싱 실패', 'CATEGORY');
  }

  const issuedCategoryId = categories[0];
  const currentCategoryId = issuedCategoryId;

  const priceSale = parsePrice(row['판매가'], rowNumber);

  const inventoryFlagRaw = normalizeYn(row['재고사용']);
  if (inventoryFlagRaw !== 'Y' && inventoryFlagRaw !== 'N') {
    warnings.push({ rowNumber, message: '재고사용 플래그가 Y/N 이 아님. 기본값 N 처리' });
  }
  const inventoryTrack = parseYnToBoolean(row['재고사용'], false);

  const currentQty = parseNonNegativeInt(row['현재 재고수량']);
  const optionQty = parseNonNegativeInt(row['필수옵션재고수량합계']);

  if (!inventoryTrack && (currentQty !== null || optionQty !== null)) {
    throw new ImportRowError(rowNumber, '재고사용=N 인데 재고수량 데이터가 존재합니다.', 'INVENTORY_MISMATCH');
  }

  let stockQty: number | null = null;
  if (inventoryTrack) {
    if (currentQty !== null) {
      stockQty = currentQty;
    } else if (optionQty !== null) {
      stockQty = optionQty;
    } else {
      warnings.push({ rowNumber, message: '재고사용=Y 이지만 사용 가능한 재고 숫자가 없어 null 저장' });
    }
  }

  const displayStatus = parseYnToBoolean(row['진열상태'], false);
  const saleStatusRaw = coerceOptionalString(row['판매상태']);

  const descriptionHtml = coerceOptionalString(row['상품상세정보']);

  const optionUsed = parseYnToBoolean(row['옵션사용'], false);
  let optionName: string | null = null;
  let optionValues: OptionValueInput[] = [];
  if (optionUsed) {
    const optionNameRaw = coerceOptionalString(row['필수옵션명']);
    const optionValuesRaw = coerceOptionalString(row['필수옵션값']);

    if (!optionNameRaw) {
      warnings.push({ rowNumber, message: '옵션사용=Y 이지만 필수옵션명이 없어 옵션 정보를 건너뜁니다.' });
    } else if (!optionValuesRaw) {
      throw new ImportRowError(rowNumber, '옵션사용=Y 이지만 필수옵션값이 없습니다.', 'OPTION_VALUES');
    } else {
      optionName = optionNameRaw;
      optionValues = buildOptionValues(optionValuesRaw, rowNumber);
      if (optionValues.length === 0) {
        throw new ImportRowError(rowNumber, '옵션값이 비어있습니다.', 'OPTION_VALUES');
      }
    }
  }

  const thumbnailUrl = coerceOptionalString(row['대표이미지URL']);
  const productUrl = coerceOptionalString(row['상품URL']);

  return {
    rowNumber,
    productId,
    name,
    categories,
    issuedCategoryId,
    currentCategoryId,
    priceSale,
    inventoryTrack,
    stockQty,
    saleStatus: saleStatusRaw,
    displayStatus,
    descriptionHtml,
    optionName,
    optionValues,
    thumbnailUrl: thumbnailUrl ?? undefined,
    productUrl: productUrl ?? undefined,
    raw: row as Prisma.InputJsonValue,
  };
}

function buildOptionValues(rawValues: string, rowNumber: number): OptionValueInput[] {
  const parts = rawValues
    .split(',')
    .map((part) => normalizeWhitespace(part))
    .filter((part) => part.length > 0);

  const seen = new Set<string>();
  const result: OptionValueInput[] = [];

  for (const part of parts) {
    const canonicalValue = canonicalizeOptionValue(part);
    if (seen.has(canonicalValue)) {
      continue;
    }
    seen.add(canonicalValue);
    result.push({ displayValue: part, canonicalValue });
  }

  return result;
}

function coerceString(value: unknown, fieldName: string): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  if (value == null) {
    return '';
  }
  throw new Error(`${fieldName} 필드가 문자열이 아닙니다.`);
}

function coerceOptionalString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

function parsePrice(value: unknown, rowNumber: number): number {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.replace(/,/g, '').trim()) : NaN;
  if (!Number.isFinite(numeric)) {
    throw new ImportRowError(rowNumber, '판매가가 숫자가 아닙니다.', 'PRICE');
  }
  const price = Math.trunc(numeric);
  if (price < 0) {
    throw new ImportRowError(rowNumber, '판매가가 0 이상이어야 합니다.', 'PRICE');
  }
  return price;
}

async function importRow(parsed: ParsedRow, allowExisting: boolean): Promise<'created' | 'skipped'> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.externalProductMap.findUnique({
      where: {
        system_external_id: {
          system: ExternalSystem.IMWEB,
          external_id: parsed.productId,
        },
      },
      include: { product: true },
    });

    if (existing) {
      if (!allowExisting) {
        throw new ImportRowError(parsed.rowNumber, `이미 존재하는 외부상품 매핑 (product_id=${existing.product_id})`, 'EXISTS');
      }
      console.log(`[SKIP] 이미 존재하는 상품 -> ${parsed.productId}`);
      return 'skipped';
    }

    const { masterCode } = await codeIssuer.issueMasterCode(tx, parsed.issuedCategoryId);

    const masterCodeCollision = await tx.product.findUnique({ where: { master_code: masterCode } });
    if (masterCodeCollision) {
      throw new ImportRowError(parsed.rowNumber, `master_code 중복 감지 (${masterCode})`, 'MASTER_CODE_COLLISION');
    }

    await tx.product.create({
      data: {
        master_code: masterCode,
        name: parsed.name,
        issued_category_id: parsed.issuedCategoryId,
        current_category_id: parsed.currentCategoryId,
        category_ids_raw: parsed.categories as Prisma.JsonArray,
        price_sale: parsed.priceSale,
        inventory_track: parsed.inventoryTrack,
        stock_qty: parsed.stockQty,
        sale_status: parsed.saleStatus,
        display_status: parsed.displayStatus,
        description_html: parsed.descriptionHtml,
        option_name: parsed.optionName,
        optionValues:
          parsed.optionValues.length > 0 && parsed.optionName
            ? {
                createMany: {
                  data: parsed.optionValues.map((value) => ({
                    option_name: parsed.optionName!,
                    display_value: value.displayValue,
                    canonical_value: value.canonicalValue,
                  })),
                },
              }
            : undefined,
        images: parsed.thumbnailUrl
          ? {
              create: {
                type: 'THUMBNAIL',
                storage_key: parsed.thumbnailUrl,
                sort_order: 0,
              },
            }
          : undefined,
        externalProductMaps: {
          create: {
            system: ExternalSystem.IMWEB,
            external_id: parsed.productId,
            external_url: parsed.productUrl,
            source_of_truth: SourceOfTruth.IMWEB,
            raw_snapshot: parsed.raw,
          },
        },
      },
    });

    return 'created';
  }, {
    timeout: 60000,
  });
}

function ensureImportRowError(error: unknown, fallbackRowNumber: number): ImportRowError {
  if (error instanceof ImportRowError) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  return new ImportRowError(fallbackRowNumber, message);
}

async function writeReport(reportPath: string, report: ImportReport): Promise<void> {
  await ensureDir(path.dirname(reportPath));
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
}

void main();
