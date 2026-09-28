/**
 * 購物車純函式（Sales 收銀台與 Preorders 加購共用）
 *
 * 一行（line）的形狀：
 * {
 *   lineId, productId, name, unitPrice, qty, color, categoryIds, stock,
 *   kind?: 'bundle',                                  // 一般商品省略
 *   components?: [{ productId, productName, qty }],   // 每 1 組套組的內容
 * }
 *
 * lineId 規則：
 * - 一般商品：就是 productId → 同一商品合併成一行
 * - 套組：productId + ':' + 內容物 id（依數量展開、排序）→ 選款一樣合併，不一樣另開一行
 */

export function makeLineId(productId, components) {
  const comps = Array.isArray(components) ? components : [];
  if (comps.length === 0) return String(productId);
  const key = comps
    .flatMap((c) => new Array(Math.max(0, c.qty ?? 0)).fill(String(c.productId)))
    .sort()
    .join('+');
  return `${productId}:${key}`;
}

export function isBundleLine(line) {
  return line?.kind === 'bundle';
}

/** 每 1 單位這一行會用到哪些商品各幾個（套組＝套組本身 1 ＋ 內容物） */
export function perUnitUsage(line) {
  const m = new Map();
  if (!line) return m;
  m.set(line.productId, (m.get(line.productId) ?? 0) + 1);
  for (const c of line.components ?? []) {
    m.set(c.productId, (m.get(c.productId) ?? 0) + (c.qty ?? 0));
  }
  return m;
}

/** 整台購物車（可排除某一行）對每個商品的用量：單賣 ＋ 套組內容物 合併 */
export function usageByProduct(cart, { excludeLineId = null } = {}) {
  const m = new Map();
  for (const line of cart ?? []) {
    if (excludeLineId && line.lineId === excludeLineId) continue;
    for (const [pid, per] of perUnitUsage(line)) {
      m.set(pid, (m.get(pid) ?? 0) + per * (line.qty ?? 0));
    }
  }
  return m;
}

/**
 * 這一行最多可以到幾個（考慮其他行已占用的庫存）。
 * getStock(productId) 回傳數字或 null/undefined（不限）。
 */
export function maxQtyForLine(line, cart, getStock) {
  const others = usageByProduct(cart, { excludeLineId: line.lineId });
  let max = Number.MAX_SAFE_INTEGER;
  for (const [pid, per] of perUnitUsage(line)) {
    const stock = getStock(pid);
    if (typeof stock !== 'number') continue;
    const avail = stock - (others.get(pid) ?? 0);
    max = Math.min(max, Math.floor(avail / per));
  }
  return Math.max(0, max);
}

/** 某個商品在目前購物車之外還剩幾個可用（null = 不限） */
export function remainingStock(productId, cart, getStock, { extraUsage = null } = {}) {
  const stock = getStock(productId);
  if (typeof stock !== 'number') return null;
  const used = usageByProduct(cart).get(productId) ?? 0;
  const extra = extraUsage?.get?.(productId) ?? 0;
  return Math.max(0, stock - used - extra);
}

/**
 * 加入或合併一行。回傳新的購物車；加不進去（庫存不夠）就回傳原本的陣列。
 */
export function addLine(cart, line, getStock) {
  const list = cart ?? [];
  const existing = list.find((x) => x.lineId === line.lineId);
  if (!existing) {
    const probe = { ...line, qty: 0 };
    const max = maxQtyForLine(probe, list, getStock);
    if (max < 1) return list;
    return [...list, { ...line, qty: 1 }];
  }
  const max = maxQtyForLine(existing, list, getStock);
  const nextQty = Math.min(existing.qty + 1, max);
  if (nextQty === existing.qty) return list;
  return list.map((x) => (x.lineId === line.lineId ? { ...x, qty: nextQty } : x));
}

export function setLineQty(cart, lineId, qty, getStock) {
  const list = cart ?? [];
  const line = list.find((x) => x.lineId === lineId);
  if (!line) return list;
  const max = maxQtyForLine(line, list, getStock);
  const next = Math.max(1, Math.min(qty, Math.max(1, max)));
  if (next === line.qty) return list;
  return list.map((x) => (x.lineId === lineId ? { ...x, qty: next } : x));
}

export function removeLine(cart, lineId) {
  return (cart ?? []).filter((x) => x.lineId !== lineId);
}

/** 給 ProductCard 顯示：這個商品目前在購物車裡（任何一行）的數量 */
export function qtyOfProductInCart(cart, productId) {
  return (cart ?? []).reduce((s, l) => s + (l.productId === productId ? l.qty : 0), 0);
}

/** 建立套組行（由 BundlePickerModal 選好內容物後呼叫） */
export function makeBundleLine(product, components) {
  const comps = (components ?? []).map((c) => ({
    productId: c.productId,
    productName: c.productName,
    qty: c.qty ?? 1,
  }));
  return {
    lineId: makeLineId(product.id, comps),
    productId: product.id,
    name: product.name,
    unitPrice: product.price,
    qty: 1,
    color: product.color,
    categoryIds: product.categoryIds ?? [],
    stock: product.stock,
    kind: 'bundle',
    components: comps,
  };
}

export function makeSingleLine(product) {
  return {
    lineId: makeLineId(product.id),
    productId: product.id,
    name: product.name,
    unitPrice: product.price,
    qty: 1,
    color: product.color,
    categoryIds: product.categoryIds ?? [],
    stock: product.stock,
  };
}

/** 交易 items 用：把一行轉成寫進 DB 的格式（一般商品不帶 kind/components） */
export function lineToTxItem(line) {
  const base = {
    lineId: line.lineId,
    productId: line.productId,
    productName: line.name,
    qty: line.qty,
    unitPrice: line.unitPrice,
  };
  if (isBundleLine(line)) {
    return { ...base, kind: 'bundle', components: (line.components ?? []).map((c) => ({ ...c })) };
  }
  return base;
}

/** 顯示用：套組內容摘要，例如「海報A、海報C×2」 */
export function describeComponents(components) {
  return (components ?? [])
    .map((c) => (c.qty > 1 ? `${c.productName}×${c.qty}` : c.productName))
    .join('、');
}
