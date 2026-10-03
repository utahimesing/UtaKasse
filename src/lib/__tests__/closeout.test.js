import { describe, it, expect } from 'vitest';
import { pickDefaultPaymentId, quickCashOptions } from '../cash.js';
import { buildCloseoutModel } from '../reportModel.js';
import { getTaipeiNextMidnightMs } from '../dateTaipei.js';

const CASH = { id: 'pm-cash', name: '現金', isCash: true };
const LINE = { id: 'pm-line', name: 'LINE Pay', isCash: false };
const CARD = { id: 'pm-card', name: '街口', isCash: false, isDefault: true };

describe('預設收款方式', () => {
  it('有設預設的就用預設', () => {
    expect(pickDefaultPaymentId([LINE, CASH, CARD])).toBe('pm-card');
  });
  it('沒有預設 → 第一個現金', () => {
    expect(pickDefaultPaymentId([LINE, CASH])).toBe('pm-cash');
  });
  it('沒有現金 → 第一個；空清單 → null', () => {
    expect(pickDefaultPaymentId([LINE])).toBe('pm-line');
    expect(pickDefaultPaymentId([])).toBeNull();
    expect(pickDefaultPaymentId(undefined)).toBeNull();
  });
});

describe('現金快捷鍵', () => {
  it('應收 200 → 剛好、500、1000', () => {
    expect(quickCashOptions(200)).toEqual([200, 500, 1000]);
  });
  it('應收 1230 → 剛好、1300、1500、2000', () => {
    expect(quickCashOptions(1230)).toEqual([1230, 1300, 1500, 2000]);
  });
  it('應收 450 → 剛好、500、1000（不重複）', () => {
    expect(quickCashOptions(450)).toEqual([450, 500, 1000]);
  });
  it('剛好是整千 → 只有剛好', () => {
    expect(quickCashOptions(1000)).toEqual([1000]);
  });
  it('0 或不是數字 → 不顯示', () => {
    expect(quickCashOptions(0)).toEqual([]);
    expect(quickCashOptions('abc')).toEqual([]);
  });
});

describe('收攤對帳', () => {
  const D = '2026-10-04';
  const categories = [{ id: 'c1', name: '海報', sortOrder: 1 }];
  const products = [
    { id: 'pa', name: '海報A', price: 200, stock: 7, categoryIds: ['c1'], sortOrder: 0 },
    { id: 'pb', name: '海報B', price: 200, stock: null, categoryIds: ['c1'], sortOrder: 1 },
    { id: 'set', name: '大套組', price: 500, stock: 0, categoryIds: [], type: 'bundle', bundleSlots: [] },
  ];
  const pay = (m) => [{ methodId: m.id, methodName: m.name, isCash: m.isCash, amount: 0 }];
  const txs = [
    { id: 'a', date: D, createdAt: 1, type: 'sale', subtotal: 400, payments: pay(CASH),
      items: [{ productId: 'pa', productName: '海報A', qty: 2, unitPrice: 200 }], discounts: [] },
    { id: 'b', date: D, createdAt: 2, type: 'sale', subtotal: 450, payments: pay(LINE),
      items: [{ productId: 'set', productName: '大套組', qty: 1, unitPrice: 500, kind: 'bundle', components: [{ productId: 'pa', productName: '海報A', qty: 1 }, { productId: 'pb', productName: '海報B', qty: 1 }] }],
      discounts: [{ ruleId: 'r', ruleName: '折 50', times: 1, amount: 50 }] },
    // 預購 B 尾款用現金
    { id: 'c', date: D, createdAt: 3, type: 'preorder_pickup', subtotal: 100, depositAlreadyPaid: 100, payments: pay(CASH),
      items: [{ productId: 'pb', productName: '海報B', qty: 1, unitPrice: 200 }] },
    // 預購 A（已付清）不算現場收款，但算出貨
    { id: 'd', date: D, createdAt: 4, type: 'preorder_pickup', subtotal: 0, depositAlreadyPaid: 200,
      payments: [{ methodId: null, methodName: '（已付清）', amount: 0, isCash: false }],
      items: [{ productId: 'pa', productName: '海報A', qty: 1, unitPrice: 200 }] },
    // 作廢的不算
    { id: 'e', date: D, createdAt: 5, type: 'sale', subtotal: 999, payments: pay(CASH), voided: true,
      items: [{ productId: 'pa', productName: '海報A', qty: 5, unitPrice: 200 }] },
    // 別天的不算
    { id: 'f', date: '2026-10-05', createdAt: 6, type: 'sale', subtotal: 200, payments: pay(CASH),
      items: [{ productId: 'pa', productName: '海報A', qty: 1, unitPrice: 200 }] },
  ];
  const m = buildCloseoutModel({ dateKey: D, transactions: txs, products, categories });

  it('收款方式拆分：現金在前，預購B尾款算進去，預購A／作廢／別天不算', () => {
    expect(m.payments).toEqual([
      { name: '現金', isCash: true, amount: 500, count: 2 },
      { name: 'LINE Pay', isCash: false, amount: 450, count: 1 },
    ]);
    expect(m.cashTotal).toBe(500);
    expect(m.electronicTotal).toBe(450);
    expect(m.realTotal).toBe(950);
    expect(m.discountTotal).toBe(50);
  });

  it('商品出貨：含套組內容物與預購取件，附上現在庫存', () => {
    const byName = Object.fromEntries(m.products.map((p) => [p.name, p]));
    expect(byName['海報A']).toMatchObject({ shipped: 2 + 1 + 1, stock: 7, isBundle: false });
    expect(byName['海報B']).toMatchObject({ shipped: 1 + 1, stock: null });
    expect(byName['大套組']).toMatchObject({ shipped: 1, stock: 0, isBundle: true });
  });

  it('排序照類別再照商品順序；件數不重複算套組本身', () => {
    expect(m.products.map((p) => p.name)).toEqual(['海報A', '海報B', '大套組']);
    expect(m.shippedTotal).toBe(4 + 2);
  });

  it('沒有交易 → 空的但不會壞', () => {
    const empty = buildCloseoutModel({ dateKey: '2020-01-01', transactions: txs, products, categories });
    expect(empty.payments).toEqual([]);
    expect(empty.realTotal).toBe(0);
    expect(empty.products).toEqual([]);
    expect(empty.shippedTotal).toBe(0);
  });
});

describe('午夜計時器', () => {
  it('台北 23:59:59 → 約 2 秒後；00:00:00 → 約 24 小時後，永遠 ≥ 1 秒', () => {
    expect(getTaipeiNextMidnightMs(new Date('2026-10-03T15:59:59Z'))).toBe(2000);
    expect(getTaipeiNextMidnightMs(new Date('2026-10-03T16:00:00Z'))).toBe(24 * 3600 * 1000 + 1000);
  });
});
