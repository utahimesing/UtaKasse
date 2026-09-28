/**
 * Excel 報表匯出（SheetJS CE，動態載入，離線可用）
 * 一個 .xlsx：流水帳、SUMMARY、每個類別一頁
 */
import { buildLedgerModel, buildSummaryModel, buildCategorySheets, sanitizeSheetName } from './reportModel.js';

const DATE_FMT = 'yyyy/m/d hh:mm:ss';

/** epoch ms → 一個「本機時間元件＝台北時間」的 Date，讓 Excel 顯示台北時間（不受裝置時區影響） */
export function toTaipeiLocalDate(ms) {
  if (!Number.isFinite(ms)) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(ms));
  const get = (type) => Number(parts.find((p) => p.type === type)?.value);
  return new Date(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
}

function sanitizeFileName(name) {
  const raw = String(name ?? '').trim() || '場次';
  return raw.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_');
}

export function buildXlsxFileName(eventName, dateKey) {
  return `${sanitizeFileName(eventName)}_${String(dateKey ?? '').replace(/-/g, '')}_SALES.xlsx`;
}

/** 流水帳／類別頁：轉成 AOA，日期欄用真正的 Date 物件 */
function ledgerToAoa(sheet, { includeDateAsObject = true } = {}) {
  const header = ['編號', '日期和時間', '類型', ...sheet.columns.map((c) => c.name), '活動折抵', '小計', '收款方式', '套用活動', '套組內容', '備註'];
  const rows = sheet.rows.map((r) => {
    const d = includeDateAsObject ? toTaipeiLocalDate(r.createdAt) : null;
    return [
      r.receiptNo,
      d ?? r.time,
      r.kind,
      ...sheet.columns.map((c) => r.qtyByKey.get(c.key) ?? 0),
      r.discount,
      r.subtotal,
      r.paymentLabel,
      r.activities,
      r.bundleContents,
      r.note,
    ];
  });
  const blanks = ['', '', '', ''];
  const totalQty = ['銷售總數', '', '', ...sheet.columns.map((c) => sheet.footer.qtyByKey.get(c.key) ?? 0), '', '', ...blanks];
  const totalAmt = ['總金額', '', '', ...sheet.columns.map((c) => sheet.footer.amountByKey.get(c.key) ?? 0), sheet.footer.discount, sheet.footer.subtotal, ...blanks];
  return { header, rows, totalQty, totalAmt };
}

function makeLedgerSheet(XLSX, sheet) {
  const { header, rows, totalQty, totalAmt } = ledgerToAoa(sheet);
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows, totalQty, totalAmt], { cellDates: true });
  // 日期格式（台北時間）
  for (let r = 0; r < rows.length; r++) {
    const addr = XLSX.utils.encode_cell({ r: r + 1, c: 1 });
    const cell = ws[addr];
    if (cell && cell.v instanceof Date) { cell.t = 'd'; cell.z = DATE_FMT; }
  }
  // 欄寬：商品欄窄一點（多行商品名靠列高顯示）
  const productCols = sheet.columns.length;
  ws['!cols'] = [
    { wch: 8 }, { wch: 20 }, { wch: 7 },
    ...new Array(productCols).fill({ wch: 10 }),
    { wch: 9 }, { wch: 9 }, { wch: 11 }, { wch: 28 }, { wch: 28 }, { wch: 24 },
  ];
  // 第 1 列列高足夠顯示兩行商品名稱（換行樣式與凍結窗格由 applyLedgerSheetXml 補上）
  ws['!rows'] = [{ hpt: 34 }];
  return ws;
}

const FROZEN_VIEW =
  '<sheetViews><sheetView workbookViewId="0">'
  + '<pane xSplit="2" ySplit="1" topLeftCell="C2" activePane="bottomRight" state="frozen"/>'
  + '<selection pane="topRight"/><selection pane="bottomLeft"/><selection pane="bottomRight" activeCell="C2" sqref="C2"/>'
  + '</sheetView></sheetViews>';

/**
 * SheetJS 社群版寫不出「凍結窗格」和「儲存格樣式」，所以產生檔案後直接改 zip 裡的 XML：
 * 1. styles.xml 新增一個「自動換行、垂直置中」的樣式
 * 2. 流水帳／類別頁：第 1 列套用換行樣式、凍結第 1 列與前 2 欄
 * 純字串處理，每個 regex 只掃一次，不會有迴圈卡住的問題。
 */
export function applyLedgerSheetXml(XLSX, buffer, ledgerSheetNumbers) {
  const cfb = XLSX.CFB.read(new Uint8Array(buffer), { type: 'buffer' });
  const dec = new TextDecoder();
  const enc = new TextEncoder();

  const stylesEntry = XLSX.CFB.find(cfb, '/xl/styles.xml');
  if (!stylesEntry) return buffer;
  let styles = dec.decode(stylesEntry.content);
  const m = styles.match(/<cellXfs count="(\d+)">/);
  if (!m) return buffer;
  const wrapIdx = Number(m[1]);
  styles = styles
    .replace(`<cellXfs count="${wrapIdx}">`, `<cellXfs count="${wrapIdx + 1}">`)
    .replace('</cellXfs>', '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf></cellXfs>');
  stylesEntry.content = enc.encode(styles);
  stylesEntry.size = stylesEntry.content.length;

  for (const n of ledgerSheetNumbers) {
    const entry = XLSX.CFB.find(cfb, `/xl/worksheets/sheet${n}.xml`);
    if (!entry) continue;
    let xml = dec.decode(entry.content);
    xml = xml.replace(/<sheetViews>[\s\S]*?<\/sheetViews>/, FROZEN_VIEW);
    xml = xml.replace(/<row r="1"[^>]*>[\s\S]*?<\/row>/, (row) => row.replace(/<c r="([A-Z]+1)"(?![^>]*\ss=)/g, `<c r="$1" s="${wrapIdx}"`));
    entry.content = enc.encode(xml);
    entry.size = entry.content.length;
  }
  return XLSX.CFB.write(cfb, { fileType: 'zip', type: 'array' });
}

function makeSummarySheet(XLSX, summary) {
  const ws = XLSX.utils.aoa_to_sheet(summary.rows);
  ws['!cols'] = [{ wch: 36 }, { wch: 6 }, { wch: 4 }, ...summary.columns.map(() => ({ wch: 10 })), { wch: 12 }, { wch: 4 }, { wch: 14 }];
  return ws;
}

export function buildWorkbookModel({ dateKey, transactions, products, categories }) {
  const ledger = buildLedgerModel({ dateKey, transactions, products, categories });
  const summary = buildSummaryModel({ dateKey, transactions, products, categories });
  const categorySheets = buildCategorySheets(ledger, categories);
  return { ledger, summary, categorySheets };
}

/** 產生 xlsx 的 ArrayBuffer（給下載用；測試也能直接驗證） */
export async function buildXlsxArrayBuffer({ dateKey, transactions, products, categories }) {
  const XLSX = await import('xlsx');
  const { ledger, summary, categorySheets } = buildWorkbookModel({ dateKey, transactions, products, categories });
  const wb = XLSX.utils.book_new();
  const used = new Set();
  XLSX.utils.book_append_sheet(wb, makeLedgerSheet(XLSX, ledger), sanitizeSheetName('流水帳', used));
  XLSX.utils.book_append_sheet(wb, makeSummarySheet(XLSX, summary), sanitizeSheetName('SUMMARY', used));
  for (const cs of categorySheets) {
    XLSX.utils.book_append_sheet(wb, makeLedgerSheet(XLSX, cs), sanitizeSheetName(cs.name, used));
  }
  const raw = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellDates: true });
  // 工作表順序：1 流水帳、2 SUMMARY、3 起是類別頁
  const ledgerSheetNumbers = [1, ...categorySheets.map((_, i) => i + 3)];
  return applyLedgerSheetXml(XLSX, raw, ledgerSheetNumbers);
}

export function downloadArrayBuffer(buffer, filename, mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
  const blob = new Blob([buffer], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 延後 revoke：iOS Safari 需要時間開始下載
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function exportSalesXlsx({ eventName, dateKey, transactions, products, categories }) {
  const buffer = await buildXlsxArrayBuffer({ dateKey, transactions, products, categories });
  const filename = buildXlsxFileName(eventName, dateKey);
  downloadArrayBuffer(buffer, filename);
  return filename;
}
