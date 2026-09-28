import { describe, it, expect } from 'vitest';
import { optimizeCombos, calcCartTotals, canFillOnce, evalComboGifts } from '../promo.js';
import { evalBonuses } from '../bonuses.js';

// 需求單第 10 節測試資料
const A = { productId: 'pa', unitPrice: 220 };
const B = { productId: 'pb', unitPrice: 220 };
const C = { productId: 'pc', unitPrice: 220 };
const D = { productId: 'pd', unitPrice: 250 };
const BOOK = { productId: 'bk', unitPrice: 600 };
const POSTERS = ['pa', 'pb', 'pc'];

const R1 = { id: 'r1', name: '海報 Buy 2 for 400', enabled: true, triggerType: 'combo', rewardType: 'price', sortOrder: 1, comboPrice: 400,
  slots: [{ id: 's1', label: '海報', qty: 2, poolProductIds: POSTERS }] };
const R2 = { id: 'r2', name: '海報＋寫真書 700', enabled: true, triggerType: 'combo', rewardType: 'price', sortOrder: 2, comboPrice: 700,
  slots: [{ id: 's1', qty: 1, poolProductIds: POSTERS }, { id: 's2', qty: 1, poolProductIds: ['bk'] }] };
const GIFT = { id: 'g1', name: '滿 1000 送小卡', enabled: true, triggerType: 'amount', triggerAmount: 1000, categoryId: null, bonusText: '送小卡' };
const RULES = [R1, R2];

const line = (p, qty) => ({ ...p, lineId: p.productId, qty });

function run(cart, rules = RULES) {
  const t = calcCartTotals(cart, rules);
  return { gross: t.grossAmount, discount: t.totalDiscount, due: t.subtotal, discounts: t.discounts, approximate: t.approximate };
}

describe('B 組：合購折扣最佳化', () => {
  it('B1 海報×1 → 0', () => {
    expect(run([line(A, 1)])).toMatchObject({ gross: 220, discount: 0, due: 220 });
  });
  it('B2 海報×2 → R1 折 40（同款或不同款都一樣）', () => {
    expect(run([line(A, 2)])).toMatchObject({ gross: 440, discount: 40, due: 400 });
    expect(run([line(A, 1), line(B, 1)])).toMatchObject({ gross: 440, discount: 40, due: 400 });
  });
  it('B3 海報×3 → 40', () => {
    expect(run([line(A, 1), line(B, 1), line(C, 1)])).toMatchObject({ gross: 660, discount: 40, due: 620 });
  });
  it('B4 海報×2＋書 → R2（120）比 R1（40）划算', () => {
    const r = run([line(A, 1), line(B, 1), line(BOOK, 1)]);
    expect(r).toMatchObject({ gross: 1040, discount: 120, due: 920 });
    expect(r.discounts).toEqual([{ ruleId: 'r2', ruleName: R2.name, times: 1, amount: 120 }]);
  });
  it('B5 海報×3＋書 → R2＋R1 = 160', () => {
    const r = run([line(A, 1), line(B, 1), line(C, 1), line(BOOK, 1)]);
    expect(r).toMatchObject({ gross: 1260, discount: 160, due: 1100 });
    expect(r.discounts.map((d) => d.ruleId)).toEqual(['r1', 'r2']);
  });
  it('B6 海報×4＋書 → 160', () => {
    expect(run([line(A, 2), line(B, 1), line(C, 1), line(BOOK, 1)])).toMatchObject({ gross: 1480, discount: 160, due: 1320 });
  });
  it('B7 海報×4＋書×2 → R2×2＋R1 = 280', () => {
    const r = run([line(A, 2), line(B, 1), line(C, 1), line(BOOK, 2)]);
    expect(r).toMatchObject({ gross: 2080, discount: 280, due: 1800 });
    expect(r.discounts).toEqual([
      { ruleId: 'r1', ruleName: R1.name, times: 1, amount: 40 },
      { ruleId: 'r2', ruleName: R2.name, times: 2, amount: 240 },
    ]);
  });
  it('B8 書×2 → 0（slot 結構：兩本書不能當成 R2）', () => {
    expect(run([line(BOOK, 2)])).toMatchObject({ gross: 1200, discount: 0, due: 1200 });
  });
  it('B9 海報×5 → R1×2 = 80', () => {
    expect(run([line(A, 3), line(B, 2)])).toMatchObject({ gross: 1100, discount: 80, due: 1020 });
  });
  it('B10 comboPrice 500（比原價貴）→ 不套用', () => {
    const r1Expensive = { ...R1, comboPrice: 500 };
    expect(run([line(A, 2)], [r1Expensive, R2])).toMatchObject({ gross: 440, discount: 0, due: 440 });
  });
  it('B11 價格不同：A×1＋D×2，R1 範圍 A＋D → 湊 D＋D 折 100，不是 A＋D 折 70', () => {
    const r1AD = { ...R1, slots: [{ id: 's1', qty: 2, poolProductIds: ['pa', 'pd'] }] };
    const r = run([line(A, 1), line(D, 2)], [r1AD]);
    expect(r).toMatchObject({ gross: 720, discount: 100, due: 620 });
  });
  it('B12 60 件、3 條規則 → 1 秒內算完（可為近似解）', () => {
    const many = [];
    for (let i = 0; i < 20; i++) many.push({ productId: `p${i}`, unitPrice: 100 + (i % 7) * 30, qty: 3, lineId: `p${i}` });
    const pool = many.map((m) => m.productId);
    const rules = [
      { id: 'x1', name: 'x1', enabled: true, triggerType: 'combo', rewardType: 'price', sortOrder: 1, comboPrice: 350, slots: [{ qty: 2, poolProductIds: pool }] },
      { id: 'x2', name: 'x2', enabled: true, triggerType: 'combo', rewardType: 'price', sortOrder: 2, comboPrice: 500, slots: [{ qty: 3, poolProductIds: pool.slice(0, 10) }] },
      { id: 'x3', name: 'x3', enabled: true, triggerType: 'combo', rewardType: 'price', sortOrder: 3, comboPrice: 250, slots: [{ qty: 1, poolProductIds: pool.slice(0, 5) }, { qty: 1, poolProductIds: pool.slice(5, 15) }] },
    ];
    const t0 = Date.now();
    const r = optimizeCombos(many, rules);
    const ms = Date.now() - t0;
    expect(ms).toBeLessThan(1000);
    expect(r.totalDiscount).toBeGreaterThan(0);
    expect(typeof r.approximate).toBe('boolean');
    // 每件商品最多只屬於一組
    const used = new Map();
    for (const g of r.groups) for (const k of g.unitKeys) used.set(k, (used.get(k) ?? 0) + 1);
    for (const m of many) expect(used.get(m.productId) ?? 0).toBeLessThanOrEqual(m.qty);
  });

  it('套組行不參與合購（C4：大套組＋海報×1 → 1420）', () => {
    const cart = [
      { lineId: 'set:pa', productId: 'set', unitPrice: 1200, qty: 1, kind: 'bundle', components: [{ productId: 'pa', productName: '海報A', qty: 1 }] },
      line(B, 1),
    ];
    expect(run(cart)).toMatchObject({ gross: 1420, discount: 0, due: 1420 });
  });

  it('同分決勝：組數少者優先', () => {
    // 兩條規則都能給 40：R1（2 件一組）與 Rx（1 件一組，兩組共 40）→ 選 R1 一組
    const rx = { id: 'rx', name: 'rx', enabled: true, triggerType: 'combo', rewardType: 'price', sortOrder: 0, comboPrice: 200, slots: [{ qty: 1, poolProductIds: POSTERS }] };
    const r = calcCartTotals([line(A, 2)], [R1, rx]);
    expect(r.totalDiscount).toBe(40);
    expect(r.discounts).toEqual([{ ruleId: 'r1', ruleName: R1.name, times: 1, amount: 40 }]);
  });
});

describe('D 組：滿額禮用折扣後金額、gift 模式', () => {
  function bonusesFor(cart) {
    const totals = calcCartTotals(cart, [...RULES, GIFT]);
    const items = cart.map((l) => ({
      productId: l.productId, qty: l.qty, kind: l.kind,
      sub: l.unitPrice * l.qty - (totals.discountByProductId.get(l.productId) ?? 0),
      catIds: [],
    }));
    return evalBonuses(items, [...RULES, GIFT]).map((b) => b.ruleId);
  }
  it('D1 海報×4＋書（折後 1320）→ 觸發滿 1000', () => {
    expect(bonusesFor([line(A, 2), line(B, 1), line(C, 1), line(BOOK, 1)])).toContain('g1');
  });
  it('D2 海報×5（折後 1020）觸發；海報×4（折後 800）不觸發', () => {
    expect(bonusesFor([line(A, 3), line(B, 2)])).toContain('g1');
    expect(bonusesFor([line(A, 2), line(B, 2)])).not.toContain('g1');
  });
  it('gift 模式：湊滿一組就提醒，不影響折扣', () => {
    const gift = { id: 'gg', name: 'gift', enabled: true, triggerType: 'combo', rewardType: 'gift', sortOrder: 5, bonusText: '送贈品',
      slots: [{ qty: 2, poolProductIds: POSTERS }] };
    expect(canFillOnce([line(A, 1)], gift)).toBe(false);
    expect(canFillOnce([line(A, 1), line(B, 1)], gift)).toBe(true);
    expect(evalComboGifts([line(A, 2)], [gift, R1]).map((r) => r.id)).toEqual(['gg']);
    const t = calcCartTotals([line(A, 2)], [gift, R1]);
    expect(t.totalDiscount).toBe(40);
    expect(t.comboGifts.map((r) => r.id)).toEqual(['gg']);
    const b = evalBonuses([{ productId: 'pa', qty: 2, sub: 400, catIds: [] }], [gift]);
    expect(b.map((x) => x.bonusText)).toEqual(['送贈品']);
  });
});
