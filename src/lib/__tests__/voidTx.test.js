import { describe, it, expect } from 'vitest';
import { isVoided, activeTxs, txStockUsage, normalizeVoidReason, VOID_KIND } from '../voidTx.js';
import { buildLedgerModel, buildSummaryModel, buildCategorySheets } from '../reportModel.js';
import { calcTodayRevenueSummaryForEventDate, buildTransactionsCsvText, buildSummaryCsvText } from '../reporting.js';
import { buildXlsxArrayBuffer } from '../exportXlsx.js';

const categories = [
  { id: 'c-poster', name: '海報', sortOrder: 1 },
  { id: 'c-book', name: '書', sortOrder: 2 },
];
const products = [
  { id: 'pa', name: '海報A', price: 220, categoryIds: ['c-poster'], sortOrder: 0 },
  { id: 'bk', name: '寫真書', price: 600, categoryIds: ['c-book'], sortOrder: 0 },
  { id: 'set', name: '大套組', price: 1200, categoryIds: [], sortOrder: 0, type: 'bundle', bundleSlots: [] },
];
const cash = [{ methodId: 'pm-01', methodName: '現金', amount: 0, isCash: true }];
const D = '2026-10-04';

const ok = { id: 'ok', receiptNo: 'OK111', date: D, createdAt: 1, time: '10:00:00', type: 'sale',
  items: [{ productId: 'pa', productName: '海報A', qty: 1, unitPrice: 220 }], subtotal: 220, payments: cash, depositAlreadyPaid: 0 };
// 結錯帳：寫真書只在這筆出現，作廢後不該多出一欄
const wrong = { id: 'bad', receiptNo: 'BAD22', date: D, createdAt: 2, time: '10:05:00', type: 'sale',
  items: [{ productId: 'bk', productName: '寫真書', qty: 2, unitPrice: 600 }], subtotal: 1100,
  discounts: [{ ruleId: 'r', ruleName: '折 100', times: 1, amount: 100 }], payments: cash, depositAlreadyPaid: 0,
  voided: true, voidedAt: 3, voidReason: '結錯帳' };
const pickupB = { id: 'pb', date: D, createdAt: 4, time: '11:00:00', type: 'preorder_pickup', preorderId: 'po1',
  items: [{ productId: 'pa', productName: '海報A', qty: 1, unitPrice: 220 }], subtotal: 120, payments: cash, depositAlreadyPaid: 100,
  voided: true, voidedAt: 5, voidReason: '' };
const txs = [ok, wrong, pickupB];

describe('作廢判斷', () => {
  it('只有 voided === true 才算作廢', () => {
    expect(isVoided(wrong)).toBe(true);
    expect(isVoided(ok)).toBe(false);
    expect(isVoided({ voided: 'true' })).toBe(false);
    expect(isVoided(null)).toBe(false);
    expect(activeTxs(txs).map((t) => t.id)).toEqual(['ok']);
  });
  it('原因去頭尾空白、最多 100 字', () => {
    expect(normalizeVoidReason('  退款 ')).toBe('退款');
    expect(normalizeVoidReason(null)).toBe('');
    expect(normalizeVoidReason('x'.repeat(150))).toHaveLength(100);
  });
});

describe('作廢要加回的庫存', () => {
  it('單賣：數量照加', () => {
    expect([...txStockUsage(wrong)]).toEqual([['bk', 2]]);
  });
  it('套組：套組本身＋內容物 × 組數（跟結帳扣庫存一致）', () => {
    const tx = { items: [
      { productId: 'set', qty: 2, kind: 'bundle', components: [{ productId: 'pa', qty: 1 }, { productId: 'pb', qty: 2 }] },
      { productId: 'pa', qty: 1 },
    ] };
    expect(Object.fromEntries(txStockUsage(tx))).toEqual({ set: 2, pa: 3, pb: 4 });
  });
  it('沒有 productId（舊預購匯入）或數量 0 的品項跳過', () => {
    const tx = { items: [{ productName: '舊品', qty: 1 }, { productId: 'pa', qty: 0 }] };
    expect(txStockUsage(tx).size).toBe(0);
  });
});

describe('報表頁營收不計入作廢', () => {
  it('本日營收只算有效交易，並回報作廢筆數', () => {
    const s = calcTodayRevenueSummaryForEventDate({ dateKey: D, transactions: txs });
    expect(s.saleTotal).toBe(220);
    expect(s.preorderBTotal).toBe(0);
    expect(s.todayRealTotal).toBe(220);
    expect(s.allTotal).toBe(220);
    expect(s.voidedCount).toBe(2);
  });
});

describe('Excel 流水帳：作廢保留一列但不計入', () => {
  const ledger = buildLedgerModel({ dateKey: D, transactions: txs, products, categories });

  it('作廢的仍列出、照時間排序，類型＝作廢', () => {
    expect(ledger.rows.map((r) => r.id)).toEqual(['ok', 'bad', 'pb']);
    expect(ledger.rows[1].kind).toBe(VOID_KIND);
    expect(ledger.rows[1].voided).toBe(true);
  });
  it('作廢列數量、折抵、小計都是 0，備註寫原內容與原因', () => {
    const r = ledger.rows[1];
    expect(r.qtyByKey.size).toBe(0);
    expect(r.discount).toBe(0);
    expect(r.subtotal).toBe(0);
    expect(r.note).toBe('作廢｜原 NT$1100：寫真書×2｜原因：結錯帳');
    expect(r.receiptNo).toBe('BAD22');
  });
  it('只出現在作廢交易的商品不另開一欄', () => {
    expect(ledger.columns.map((c) => c.name)).toEqual(['海報A']);
  });
  it('最下方合計只算有效交易', () => {
    expect(ledger.footer.qtyByKey.get('pa')).toBe(1);
    expect(ledger.footer.subtotal).toBe(220);
    expect(ledger.footer.discount).toBe(0);
    expect(ledger.txs.map((t) => t.id)).toEqual(['ok']);
    expect(ledger.voidedTxs.map((t) => t.id)).toEqual(['bad', 'pb']);
  });
  it('類別分帳頁不放作廢交易', () => {
    const sheets = buildCategorySheets(ledger, categories);
    expect(sheets.map((s) => s.name)).toEqual(['海報']);
    expect(sheets[0].rows.map((r) => r.id)).toEqual(['ok']);
  });
});

describe('Excel SUMMARY：扣掉作廢，另列作廢紀錄', () => {
  const summary = buildSummaryModel({ dateKey: D, transactions: txs, products, categories });

  it('金額、等式只算有效交易，差異仍為 0', () => {
    expect(summary.totals.goodsTotal).toBe(220);
    expect(summary.totals.discountTotal).toBe(0);
    expect(summary.totals.todayRealTotal).toBe(220);
    expect(summary.totals.preorderBDepositTotal).toBe(0);
    expect(summary.totals.equationDiff).toBe(0);
  });
  it('作廢紀錄區塊：筆數、原金額與每筆明細', () => {
    expect(summary.totals.voidedCount).toBe(2);
    expect(summary.totals.voidedAmount).toBe(1220);
    const labels = summary.rows.map((r) => r[0]);
    expect(labels).toContain('▸ 作廢紀錄（已從以上所有數字扣除）');
    expect(labels).toContain('#BAD22 10:05:00');
    expect(labels).toContain('#— 11:00:00');
  });
  it('沒有作廢時不出現作廢區塊', () => {
    const s = buildSummaryModel({ dateKey: D, transactions: [ok], products, categories });
    expect(s.rows.some((r) => String(r[0] ?? '').startsWith('▸ 作廢紀錄'))).toBe(false);
    expect(s.totals.voidedCount).toBe(0);
  });
});

describe('舊格式 CSV 也不計入作廢', () => {
  it('流水帳 CSV 只有有效交易', () => {
    const csv = buildTransactionsCsvText({ dateKey: D, transactions: txs });
    expect(csv).toContain('OK111');
    expect(csv).not.toContain('BAD22');
    expect(csv.split('\n')).toHaveLength(2);
  });
  it('摘要 CSV 實收合計只有 220', () => {
    const csv = buildSummaryCsvText({ dateKey: D, transactions: txs });
    expect(csv).toContain('✦ 今日現場實收合計,,,,NT$220');
  });
});

describe('xlsx 檔案可以產生', () => {
  it('含作廢交易也能正常輸出', async () => {
    const buf = await buildXlsxArrayBuffer({ dateKey: D, transactions: txs, products, categories });
    expect(buf.byteLength ?? buf.length).toBeGreaterThan(1000);
  });
});
