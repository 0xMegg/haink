import xlsx from 'xlsx';

export type ImwebExcelRow = Record<string, unknown>;

export interface ExcelLoadOptions {
  sheetName?: string;
}

export function loadImwebExcelRows(filePath: string, options: ExcelLoadOptions = {}): ImwebExcelRow[] {
  const workbook = xlsx.readFile(filePath, { cellDates: false });
  const sheetName = options.sheetName ?? workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error('엑셀 파일에 워크시트가 없습니다.');
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`시트 ${sheetName}을(를) 찾을 수 없습니다.`);
  }

  const rows = xlsx.utils.sheet_to_json<ImwebExcelRow>(sheet, { defval: null });
  return rows;
}
