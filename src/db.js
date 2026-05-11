import Dexie from 'dexie';

/**
 * Dexie database (IndexedDB)
 * All app features are offline-first; everything writes/reads from here.
 */
const db = new Dexie('UtakasseDB');

// Version 1: legacy schema (kept only to allow Dexie upgrade)
db.version(1).stores({
  products: '++id, name, price, category, color, isNew, archived',
  categories: '++id, name',
  preorders: '++id, order_id, buyer_name, phone_last5, pickup_status',
  transactions: '++id, date, timestamp, type',
  events: '++id, dateName',
});

// Version 2:姬帳 schema (handoff v1.0)
db.version(2).stores({
  events: 'id, status, date, createdAt',
  categories: 'id, sortOrder',
  products: 'id, archived, *categoryIds, isNew, stock',
  bonusRules: 'id, enabled, triggerType, exclusiveGroup, sortOrder',
  paymentMethods: 'id, enabled, isDefault, sortOrder',
  preOrders: 'id, eventId, status, phoneLast5, bankLast5',
  transactions: 'id, eventId, date, type, createdAt, preorderId',
});

// Version 3: add events.name index (needed for report export filename)
db.version(3).stores({
  events: 'id, name, status, date, createdAt',
  categories: 'id, sortOrder',
  products: 'id, archived, *categoryIds, isNew, stock',
  bonusRules: 'id, enabled, triggerType, exclusiveGroup, sortOrder',
  paymentMethods: 'id, enabled, isDefault, sortOrder',
  preOrders: 'id, eventId, status, phoneLast5, bankLast5',
  transactions: 'id, eventId, date, type, createdAt, preorderId',
});

export function createUUID() {
  // Browser-native UUID; falls back to random string for older runtimes.
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

export function normalizeStockInput(v) {
  // Admin form: empty => unlimited (null)
  if (v === '' || v === null || typeof v === 'undefined') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function ensureString(v, label, { max = 500, allowEmpty = false } = {}) {
  if (typeof v !== 'string') throw new Error(`備份格式錯誤：${label} 必須是字串`);
  if (!allowEmpty && v.trim() === '') throw new Error(`備份格式錯誤：${label} 不可空白`);
  if (v.length > max) throw new Error(`備份格式錯誤：${label} 長度超過限制`);
}

function ensureNumber(v, label) {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(`備份格式錯誤：${label} 必須是數字`);
  }
}

function ensureBoolean(v, label) {
  if (typeof v !== 'boolean') throw new Error(`備份格式錯誤：${label} 必須是布林值`);
}

function ensureArray(v, label) {
  if (!Array.isArray(v)) throw new Error(`備份格式錯誤：${label} 必須是陣列`);
}

function validateTableRows(rows, tableName) {
  ensureArray(rows, tableName);
  const MAX_ROWS = 20000;
  if (rows.length > MAX_ROWS) {
    throw new Error(`備份格式錯誤：${tableName} 筆數超過上限 ${MAX_ROWS}`);
  }

  rows.forEach((row, idx) => {
    if (!isPlainObject(row)) throw new Error(`備份格式錯誤：${tableName}[${idx}] 必須是物件`);
    if (typeof row.id !== 'string' || row.id.trim() === '') {
      throw new Error(`備份格式錯誤：${tableName}[${idx}].id 必須是非空字串`);
    }
  });
}

export function validateBackupPayload(data) {
  if (!isPlainObject(data)) throw new Error('備份格式錯誤：根節點必須是物件');

  const allowedTopLevelKeys = new Set([
    'version',
    'exportedAt',
    'events',
    'categories',
    'products',
    'bonusRules',
    'paymentMethods',
    'preOrders',
    'transactions',
  ]);

  Object.keys(data).forEach((key) => {
    if (!allowedTopLevelKeys.has(key)) {
      throw new Error(`備份格式錯誤：不支援欄位 ${key}`);
    }
  });

  ensureNumber(data.version, 'version');
  if (data.version !== 3) {
    throw new Error(`備份版本不支援：${data.version}，目前僅支援版本 3`);
  }
  ensureString(data.exportedAt, 'exportedAt', { max: 64 });
  if (Number.isNaN(Date.parse(data.exportedAt))) {
    throw new Error('備份格式錯誤：exportedAt 不是合法時間');
  }

  validateTableRows(data.events ?? [], 'events');
  validateTableRows(data.categories ?? [], 'categories');
  validateTableRows(data.products ?? [], 'products');
  validateTableRows(data.bonusRules ?? [], 'bonusRules');
  validateTableRows(data.paymentMethods ?? [], 'paymentMethods');
  validateTableRows(data.preOrders ?? [], 'preOrders');
  validateTableRows(data.transactions ?? [], 'transactions');

  // Core field checks for highest-impact records.
  (data.events ?? []).forEach((event, idx) => {
    ensureString(event.name, `events[${idx}].name`, { max: 120 });
    ensureString(event.date, `events[${idx}].date`, { max: 32 });
    ensureString(event.status, `events[${idx}].status`, { max: 32 });
    ensureNumber(event.createdAt, `events[${idx}].createdAt`);
  });

  (data.categories ?? []).forEach((category, idx) => {
    ensureString(category.name, `categories[${idx}].name`, { max: 80 });
    ensureNumber(category.sortOrder, `categories[${idx}].sortOrder`);
  });

  (data.products ?? []).forEach((product, idx) => {
    ensureString(product.name, `products[${idx}].name`, { max: 120 });
    ensureNumber(product.price, `products[${idx}].price`);
    if (product.stock !== null && typeof product.stock !== 'undefined') {
      ensureNumber(product.stock, `products[${idx}].stock`);
    }
    ensureBoolean(product.archived, `products[${idx}].archived`);
    ensureBoolean(product.isNew, `products[${idx}].isNew`);
    if (typeof product.categoryIds !== 'undefined') {
      ensureArray(product.categoryIds, `products[${idx}].categoryIds`);
    }
  });

  (data.paymentMethods ?? []).forEach((pm, idx) => {
    ensureString(pm.name, `paymentMethods[${idx}].name`, { max: 80 });
    ensureBoolean(pm.enabled, `paymentMethods[${idx}].enabled`);
    ensureBoolean(pm.isDefault, `paymentMethods[${idx}].isDefault`);
    ensureNumber(pm.sortOrder, `paymentMethods[${idx}].sortOrder`);
  });
}

export default db;
// ===== 備份：讀出所有資料 =====
export async function exportAllData() {
  const [
    events,
    categories,
    products,
    bonusRules,
    paymentMethods,
    preOrders,
    transactions,
  ] = await Promise.all([
    db.events.toArray(),
    db.categories.toArray(),
    db.products.toArray(),
    db.bonusRules.toArray(),
    db.paymentMethods.toArray(),
    db.preOrders.toArray(),
    db.transactions.toArray(),
  ])

  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    events,
    categories,
    products,
    bonusRules,
    paymentMethods,
    preOrders,
    transactions,
  }
}

// ===== 還原：把資料寫回所有資料表 =====
export async function importAllData(data) {
  validateBackupPayload(data);

  await db.transaction(
    'rw',
    [
      db.events,
      db.categories,
      db.products,
      db.bonusRules,
      db.paymentMethods,
      db.preOrders,
      db.transactions,
    ],
    async () => {
      await db.events.clear()
      await db.categories.clear()
      await db.products.clear()
      await db.bonusRules.clear()
      await db.paymentMethods.clear()
      await db.preOrders.clear()
      await db.transactions.clear()

      if (data.events?.length) await db.events.bulkAdd(data.events)
      if (data.categories?.length) await db.categories.bulkAdd(data.categories)
      if (data.products?.length) await db.products.bulkAdd(data.products)
      if (data.bonusRules?.length) await db.bonusRules.bulkAdd(data.bonusRules)
      if (data.paymentMethods?.length) await db.paymentMethods.bulkAdd(data.paymentMethods)
      if (data.preOrders?.length) await db.preOrders.bulkAdd(data.preOrders)
      if (data.transactions?.length) await db.transactions.bulkAdd(data.transactions)
    }
  )
}