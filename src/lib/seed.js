import db from '../db.js';
import { getTaipeiDateKey } from './dateTaipei.js';
import { PRODUCT_COLOR_PRESETS } from './uiPalette.js';

export async function ensureSeedData() {
  const catCount = await db.categories.count();
  if (catCount > 0) return;

  const todayKey = getTaipeiDateKey(new Date());

  const defaultCategories = [
    { id: 'cat-01', name: '類別A', color: PRODUCT_COLOR_PRESETS[0], sortOrder: 1, createdAt: Date.now() },
    { id: 'cat-02', name: '類別B', color: PRODUCT_COLOR_PRESETS[1], sortOrder: 2, createdAt: Date.now() },
  ];
  await db.categories.bulkAdd(defaultCategories);

  const defaultPaymentMethods = [
    { id: 'pm-01', name: '現金', isCash: true, enabled: true, isDefault: true, sortOrder: 1 },
    { id: 'pm-02', name: 'LINE Pay', isCash: false, enabled: true, isDefault: false, sortOrder: 2 },
    { id: 'pm-03', name: '轉帳', isCash: false, enabled: false, isDefault: false, sortOrder: 3 },
  ];
  await db.paymentMethods.bulkAdd(defaultPaymentMethods);

  const defaultProducts = [
    { id: 'p-01', name: '測試商品A', price: 100, stock: 10, color: PRODUCT_COLOR_PRESETS[0], categoryIds: ['cat-01'], imageUrl: null, isNew: false, archived: false },
    { id: 'p-02', name: '測試商品B', price: 200, stock: 10, color: PRODUCT_COLOR_PRESETS[1], categoryIds: ['cat-01'], imageUrl: null, isNew: false, archived: false },
    { id: 'p-03', name: '測試商品C', price: 300, stock: 5,  color: PRODUCT_COLOR_PRESETS[2], categoryIds: ['cat-01'], imageUrl: null, isNew: false, archived: false },
    { id: 'p-04', name: '測試商品D', price: 500, stock: null, color: PRODUCT_COLOR_PRESETS[0], categoryIds: ['cat-02'], imageUrl: null, isNew: true, archived: false },
    { id: 'p-05', name: '測試商品E', price: 100, stock: 20, color: PRODUCT_COLOR_PRESETS[1], categoryIds: ['cat-02'], imageUrl: null, isNew: true, archived: false },
    { id: 'p-06', name: '測試商品F', price: 150, stock: 20, color: PRODUCT_COLOR_PRESETS[2], categoryIds: ['cat-02'], imageUrl: null, isNew: false, archived: false },
  ];
  await db.products.bulkAdd(defaultProducts);

  const bonusRules = [
    {
      id: 'br1',
      name: '範例特典（商品觸發）',
      enabled: true,
      triggerType: 'product',
      exclusiveGroup: null,
      sortOrder: 1,
      triggerProductIds: ['p-04'],
      triggerProductQty: 1,
      bonusText: '含「測試商品D」➜ 送【範例贈品】',
    },
    {
      id: 'br2',
      name: '範例特典（滿額小）',
      enabled: true,
      triggerType: 'amount',
      exclusiveGroup: '範例好禮',
      sortOrder: 2,
      categoryId: 'cat-02',
      triggerAmount: 300,
      bonusText: '範例贈品 × 1（小）',
    },
    {
      id: 'br3',
      name: '範例特典（滿額大）',
      enabled: true,
      triggerType: 'amount',
      exclusiveGroup: '範例好禮',
      sortOrder: 3,
      categoryId: 'cat-02',
      triggerAmount: 600,
      bonusText: '範例贈品 × 1（大）',
    },
  ];
  await db.bonusRules.bulkAdd(bonusRules);

  const hasEvent = await db.events.count();
  if (hasEvent === 0) {
    await db.events.add({
      id: 'evt-01',
      name: '範例活動',
      date: todayKey,
      status: 'active',
      createdAt: Date.now(),
    });
  }
}
