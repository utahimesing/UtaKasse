import { describe, it, expect } from 'vitest';
import { buildLedgerModel, buildSummaryModel, buildCategorySheets, sanitizeSheetName, describeTxItems } from '../reportModel.js';
import { buildWorkbookModel, buildXlsxArrayBuffer, buildXlsxFileName, toTaipeiLocalDate } from '../exportXlsx.js';

const categories = [
  { id: 'c-poster', name: '海報', sortOrder: 1 },
  { id: 'c-book', name: '書', sortOrder: 2 },
  { id: 'c-set', name: '套組', sortOrder: 3 },
];
const products = [
  { id: 'pa', name: '海報A', price: 220, categoryIds: ['c-poster'], sortOrder: 0 },
  { id: 'pb', name: '海報B', price: 220, categoryIds: ['c-poster'], sortOrder: 1 },
  { id: 'bk', name: '寫真書', price: 600, categoryIds: ['c-book'], sortOrder: 0 },
  { id: 'set', name: '大套組', price: 1200, categoryIds: ['c-set'], sortOrder: 0, type: 'bundle', bundleSlots: [] },
];
const cash = [{ methodId: 'pm-01', methodName: '現金', amount: 0, isCash: true }];

const txs = [
  // 舊格式交易（沒有 grossAmount / discounts）
  { id: 't1', receiptNo: 'AAA11', date: '2026-06-01', createdAt: Date.UTC(2026, 5, 1, 2, 0, 0), time: '10:00:00', type: 'sale',
    items: [{ productId: 'bk', productName: '寫真書', qty: 1, unitPrice: 600 }], subtotal: 600, payments: cash, depositAlreadyPaid: 0, bonusesTriggered: [] },
  // B 組：海報×3＋書 → R2＋R1 折 160
  { id: 't2', receiptNo: 'BBB22', date: '2026-06-01', createdAt: Date.UTC(2026, 5, 1, 3, 0, 0), time: '11:00:00', type: 'sale',
    items: [{ lineId: 'pa', productId: 'pa', productName: '海報A', qty: 2, unitPrice: 220 }, { lineId: 'pb', productId: 'pb', productName: '海報B', qty: 1, unitPrice: 220 }, { lineId: 'bk', productId: 'bk', productName: '寫真書', qty: 1, unitPrice: 600 }],
    subtotal: 1100, grossAmount: 1260, discounts: [{ ruleId: 'r1', ruleName: '海報 Buy 2 for 400', times: 1, amount: 40 }, { ruleId: 'r2', ruleName: '海報＋寫真書 700', times: 1, amount: 120 }],
    discountApproximate: false, payments: cash, depositAlreadyPaid: 0, bonusesTriggered: [{ ruleId: 'g1', ruleName: '滿 1000 送小卡', bonusText: '送小卡' }] },
  // C 組：套組（選海報A）
  { id: 't3', receiptNo: 'CCC33', date: '2026-06-01', createdAt: Date.UTC(2026, 5, 1, 4, 0, 0), time: '12:00:00', type: 'sale',
    items: [{ lineId: 'set:pa', productId: 'set', productName: '大套組', qty: 1, unitPrice: 1200, kind: 'bundle', components: [{ productId: 'pa', productName: '海報A', qty: 1 }] }],
    subtotal: 1200, grossAmount: 1200, discounts: [], payments: cash, depositAlreadyPaid: 0, bonusesTriggered: [] },
  // 預購 B：訂金 300 已付、尾款 300
  { id: 't4', receiptNo: 'DDD44', date: '2026-06-01', createdAt: Date.UTC(2026, 5, 1, 5, 0, 0), time: '13:00:00', type: 'preorder_pickup',
    items: [{ productId: 'bk', productName: '寫真書', qty: 1, unitPrice: 600 }], subtotal: 300, payments: cash, depositAlreadyPaid: 300, bonusesTriggered: [], note: '買家・A0001' },
  // 別天的交易不能混進來
  { id: 't5', date: '2026-06-02', createdAt: Date.UTC(2026, 5, 2), type: 'sale', items: [{ productId: 'pa', productName: '海報A', qty: 1, unitPrice: 220 }], subtotal: 220, payments: cash },
];

describe('流水帳模型', () => {
  const ledger = buildLedgerModel({ dateKey: '2026-06-01', transactions: txs, products, categories });

  it('一筆交易一列、照時間排序、只有當天', () => {
    expect(ledger.rows.map((r) => r.receiptNo)).toEqual(['AAA11', 'BBB22', 'CCC33', 'DDD44']);
  });
  it('商品欄照類別 sortOrder 再照商品順序；套組也是一欄', () => {
    expect(ledger.columns.map((c) => c.name)).toEqual(['海報A', '海報B', '寫真書', '大套組']);
    expect(ledger.columns[3].isBundle).toBe(true);
  });
  it('折抵填負數、舊交易填 0；套用活動與套組內容文字正確', () => {
    const [r1, r2, r3] = ledger.rows;
    expect(r1.discount).toBe(0);
    expect(r2.discount).toBe(-160);
    expect(r2.activities).toBe('海報 Buy 2 for 400 ×1；海報＋寫真書 700 ×1；滿 1000 送小卡');
    expect(r3.bundleContents).toBe('大套組[海報A]');
    expect(r2.qtyByKey.get('pa')).toBe(2);
  });
  it('最下方兩列：銷售總數與總金額（用交易裡的 unitPrice）', () => {
    expect(ledger.footer.qtyByKey.get('pa')).toBe(2);
    expect(ledger.footer.amountByKey.get('bk')).toBe(600 * 3);
    expect(ledger.footer.subtotal).toBe(600 + 1100 + 1200 + 300);
    expect(ledger.footer.discount).toBe(-160);
  });
  it('報表頁品項摘要', () => {
    expect(describeTxItems(txs[2])).toBe('大套組[海報A]×1');
    expect(describeTxItems(txs[1])).toBe('海報A×2、海報B×1、寫真書×1');
  });
});

describe('類別分帳頁', () => {
  const ledger = buildLedgerModel({ dateKey: '2026-06-01', transactions: txs, products, categories });
  const sheets = buildCategorySheets(ledger, categories);
  it('每個有賣出的類別一頁，只放該類別商品欄、只列相關交易', () => {
    expect(sheets.map((s) => s.name)).toEqual(['海報', '書', '套組']);
    const poster = sheets[0];
    expect(poster.columns.map((c) => c.name)).toEqual(['海報A', '海報B']);
    expect(poster.rows.map((r) => r.receiptNo)).toEqual(['BBB22']);
    expect(poster.footer.qtyByKey.get('pa')).toBe(2);
  });
  it('工作表名稱去掉不合法字元、截到 31 字、不重複', () => {
    const used = new Set();
    expect(sanitizeSheetName('A/B:C*D?[E]\\', used)).toBe('ABCDE');
    expect(sanitizeSheetName('ABCDE', used)).toBe('ABCDE (2)');
    expect(sanitizeSheetName('x'.repeat(40), used)).toHaveLength(31);
  });
});

describe('SUMMARY 模型（E 組對帳）', () => {
  const summary = buildSummaryModel({ dateKey: '2026-06-01', transactions: txs, products, categories });
  it('實際出貨數量有算到套組裡的海報', () => {
    expect(summary.totals.shippedByKey.get('pa')).toBe(3); // 單賣 2 ＋ 套組內 1
    expect(summary.totals.shippedByKey.get('set')).toBe(1);
  });
  it('活動折抵合計為負數列', () => {
    const row = summary.rows.find((r) => r[0] === '活動折抵合計');
    expect(row.at(-3)).toBe(-160);
  });
  it('等式：Σ 各商品金額 − 活動折抵 = 總銷售金額 + 預購B訂金', () => {
    expect(summary.totals.goodsTotal).toBe(600 + 1260 + 1200 + 600);
    expect(summary.totals.discountTotal).toBe(160);
    expect(summary.totals.allTotal).toBe(600 + 1100 + 1200 + 300);
    expect(summary.totals.preorderBDepositTotal).toBe(300);
    expect(summary.totals.equationDiff).toBe(0);
  });
});

describe('Excel 匯出', () => {
  it('檔名格式 {場次}_{YYYYMMDD}_SALES.xlsx', () => {
    expect(buildXlsxFileName('CWT72_250601', '2025-06-01')).toBe('CWT72_250601_20250601_SALES.xlsx');
  });
  it('日期用台北時間', () => {
    const d = toTaipeiLocalDate(Date.UTC(2026, 5, 1, 2, 30, 0)); // 10:30 台北
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 5, 1, 10, 30]);
  });
  it('工作簿模型：流水帳＋SUMMARY＋類別頁', () => {
    const wb = buildWorkbookModel({ dateKey: '2026-06-01', transactions: txs, products, categories });
    expect(wb.ledger.rows).toHaveLength(4);
    expect(wb.categorySheets).toHaveLength(3);
  });
  it('能真的產生一個 xlsx 檔（SheetJS 動態載入）', async () => {
    const buf = await buildXlsxArrayBuffer({ dateKey: '2026-06-01', transactions: txs, products, categories });
    expect(buf.byteLength).toBeGreaterThan(1000);
    const XLSX = await import('xlsx');
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    expect(wb.SheetNames).toEqual(['流水帳', 'SUMMARY', '海報', '書', '套組']);
    const ws = wb.Sheets['流水帳'];
    expect(ws['A1'].v).toBe('編號');
    expect(ws['B2'].t).toBe('d');
    expect(ws['B2'].v instanceof Date).toBe(true);
    const lastRow = XLSX.utils.decode_range(ws['!ref']).e.r + 1;
    expect(ws[`A${lastRow}`].v).toBe('總金額');
    expect(ws[`A${lastRow - 1}`].v).toBe('銷售總數');
  });
  it('流水帳與類別頁凍結第 1 列＋前 2 欄、第 1 列自動換行；SUMMARY 不凍結', async () => {
    const buf = await buildXlsxArrayBuffer({ dateKey: '2026-06-01', transactions: txs, products, categories });
    const XLSX = await import('xlsx');
    const cfb = XLSX.CFB.read(new Uint8Array(buf), { type: 'buffer' });
    const read = (p) => new TextDecoder().decode(XLSX.CFB.find(cfb, p).content);
    const styles = read('/xl/styles.xml');
    const wrapIdx = Number(styles.match(/<cellXfs count="(\d+)">/)[1]) - 1;
    expect(styles).toContain('wrapText="1"');
    const s1 = read('/xl/worksheets/sheet1.xml');
    expect(s1).toContain('xSplit="2" ySplit="1"');
    expect(s1).toContain('state="frozen"');
    expect(s1).toMatch(new RegExp(`<c r="D1" s="${wrapIdx}"`));
    expect(read('/xl/worksheets/sheet3.xml')).toContain('state="frozen"');
    expect(read('/xl/worksheets/sheet2.xml')).not.toContain('state="frozen"');
    // 改過 XML 後檔案仍能正常讀回，日期格也還在
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    expect(wb.Sheets['流水帳']['B2'].v instanceof Date).toBe(true);
  });
});
