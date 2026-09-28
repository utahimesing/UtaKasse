import { describe, it, expect } from 'vitest';
import { migrateBonusRuleV3toV4, migrateBackupPayload, normalizeProductV5 } from '../migrations.js';

describe('migrateBonusRuleV3toV4', () => {
  it('舊的合購特典 product → combo + gift，行為不變（只提醒）', () => {
    const legacy = {
      id: 'br1', name: '範例特典', enabled: true, triggerType: 'product',
      exclusiveGroup: null, sortOrder: 1,
      triggerProductIds: ['p-04', 'p-05'], triggerProductQty: 2, bonusText: '送贈品',
    };
    const out = migrateBonusRuleV3toV4(legacy);
    expect(out.triggerType).toBe('combo');
    expect(out.rewardType).toBe('gift');
    expect(out.slots).toHaveLength(1);
    expect(out.slots[0].qty).toBe(2);
    expect(out.slots[0].poolProductIds).toEqual(['p-04', 'p-05']);
    expect(out.bonusText).toBe('送贈品');
    // 舊欄位保留
    expect(out.triggerProductIds).toEqual(['p-04', 'p-05']);
    // 不改到原物件
    expect(legacy.triggerType).toBe('product');
  });

  it('更舊的單一 triggerProductId 也能轉', () => {
    const out = migrateBonusRuleV3toV4({ id: 'x', triggerType: 'product', triggerProductId: 'p-1' });
    expect(out.slots[0].poolProductIds).toEqual(['p-1']);
    expect(out.slots[0].qty).toBe(1);
  });

  it('amount 規則原樣回傳', () => {
    const rule = { id: 'br2', triggerType: 'amount', triggerAmount: 300, categoryId: null };
    expect(migrateBonusRuleV3toV4(rule)).toEqual(rule);
  });

  it('已是 combo 的規則補齊 rewardType／slots，不重複轉', () => {
    const rule = { id: 'br3', triggerType: 'combo', rewardType: 'price', comboPrice: 400, slots: [{ id: 's', qty: 2, poolProductIds: ['a'] }] };
    const out = migrateBonusRuleV3toV4(rule);
    expect(out).toEqual(rule);
  });
});

describe('migrateBackupPayload', () => {
  it('v3 備份 → v5：version 改 5、規則轉換、products 補 type', () => {
    const v3 = {
      version: 3,
      exportedAt: '2026-01-01T00:00:00.000Z',
      products: [{ id: 'p-1', name: 'A', price: 100, stock: 3, archived: false, isNew: false }],
      bonusRules: [{ id: 'br1', triggerType: 'product', triggerProductIds: ['p-1'], triggerProductQty: 1, bonusText: 'x' }],
      transactions: [{ id: 't1', subtotal: 100, bonusesTriggered: [] }],
    };
    const out = migrateBackupPayload(v3);
    expect(out.version).toBe(5);
    expect(out.products[0].type).toBe('single');
    expect(out.bonusRules[0].triggerType).toBe('combo');
    expect(out.bonusRules[0].rewardType).toBe('gift');
    // 交易既有欄位不動
    expect(out.transactions[0]).toEqual(v3.transactions[0]);
    // 原物件不變
    expect(v3.version).toBe(3);
  });

  it('bundle 商品缺 bundleSlots 時補成空陣列', () => {
    expect(normalizeProductV5({ id: 'b', type: 'bundle' }).bundleSlots).toEqual([]);
    expect(normalizeProductV5({ id: 's' }).type).toBe('single');
  });
});
