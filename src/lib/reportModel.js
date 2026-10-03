/**
 * 報表彙總純函式（Excel 匯出、報表頁交易明細共用，可直接單元測試）
 *
 * 輸入的 transactions 是「選定場次」的交易；這裡再用 dateKey 過濾出當天。
 */
import { calcTxKind, getTxPaymentLabel } from './reporting.js';
import { isVoided, VOID_KIND } from './voidTx.js';

export function txDiscountTotal(tx) {
  return (Array.isArray(tx?.discounts) ? tx.discounts : []).reduce((s, d) => s + (Number(d.amount) || 0), 0);
}

export function txGross(tx) {
  if (Number.isFinite(tx?.grossAmount)) return tx.grossAmount;
  return (tx?.subtotal ?? 0) + txDiscountTotal(tx);
}

function itemAmount(it) {
  return (Number(it?.qty) || 0) * (Number(it?.unitPrice) || 0);
}

function columnKeyOf(item) {
  return item?.productId ? String(item.productId) : `name:${item?.productName ?? ''}`;
}

function compareSortOrder(a, b) {
  const aHas = a != null && Number.isFinite(Number(a));
  const bHas = b != null && Number.isFinite(Number(b));
  if (aHas && bHas && a !== b) return a - b;
  if (aHas !== bHas) return aHas ? -1 : 1;
  return 0;
}

/** 交易裡「套用活動」文字：`海報 Buy 2 for 400 ×1；滿800送小卡` */
export function describeTxActivities(tx) {
  const parts = [];
  for (const d of tx?.discounts ?? []) parts.push(`${d.ruleName ?? d.ruleId} ×${d.times ?? 1}`);
  for (const b of tx?.bonusesTriggered ?? []) parts.push(b.ruleName ?? b.bonusText ?? b.ruleId);
  return parts.join('；');
}

/** 交易裡「套組內容」文字：`大套組[海報A]；大套組[海報C]×2` */
export function describeTxBundles(tx) {
  const parts = [];
  for (const it of tx?.items ?? []) {
    if (it.kind !== 'bundle') continue;
    const inner = (it.components ?? []).map((c) => (c.qty > 1 ? `${c.productName}×${c.qty}` : c.productName)).join('、');
    parts.push(`${it.productName}[${inner}]${it.qty > 1 ? `×${it.qty}` : ''}`);
  }
  return parts.join('；');
}

/** 報表頁品項摘要：`海報A×1、大套組[海報C]×1` */
export function describeTxItems(tx) {
  return (tx?.items ?? []).map((it) => {
    if (it.kind === 'bundle') {
      const inner = (it.components ?? []).map((c) => (c.qty > 1 ? `${c.productName}×${c.qty}` : c.productName)).join('、');
      return `${it.productName}[${inner}]×${it.qty}`;
    }
    return `${it.productName}×${it.qty}`;
  }).join('、');
}

/**
 * 流水帳模型
 * → { dateKey, txs, voidedTxs, columns, rows, footer }
 * txs        = 當天「有效」交易（作廢的不算），彙總一律用這個
 * columns[i] = { key, productId, name, categoryIds, isBundle }
 * rows[i]    = { id, receiptNo, createdAt, time, kind, qtyByKey(Map), discount(負數或 0), subtotal, paymentLabel, activities, bundleContents, note, voided }
 *              作廢的交易仍列一列（類型＝作廢，數量／金額都是 0，備註寫原內容），方便對帳
 * footer     = { qtyByKey(Map), amountByKey(Map), subtotal, discount, gross }
 */
export function buildLedgerModel({ dateKey, transactions, products = [], categories = [] }) {
  const dayTxs = (transactions ?? [])
    .filter((tx) => tx.date === dateKey)
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  const txs = dayTxs.filter((tx) => !isVoided(tx));
  const voidedTxs = dayTxs.filter((tx) => isVoided(tx));

  const productsById = new Map(products.map((p) => [p.id, p]));
  const catOrder = new Map(categories.map((c) => [c.id, Number.isFinite(c.sortOrder) ? c.sortOrder : 999999]));

  // 只列出當天有賣出的商品（套組本身也是一欄）
  const colMap = new Map();
  for (const tx of txs) {
    for (const it of tx.items ?? []) {
      const key = columnKeyOf(it);
      if (colMap.has(key)) continue;
      const p = it.productId ? productsById.get(it.productId) : null;
      colMap.set(key, {
        key,
        productId: it.productId ?? null,
        name: p?.name ?? it.productName ?? '',
        categoryIds: p?.categoryIds ?? [],
        productSortOrder: p?.sortOrder,
        isBundle: it.kind === 'bundle' || (p?.type ?? 'single') === 'bundle',
      });
    }
  }

  const columns = [...colMap.values()].sort((a, b) => {
    // 多類別的商品放在第一個類別；沒類別的排最後
    const ca = a.categoryIds[0] != null ? (catOrder.get(a.categoryIds[0]) ?? 999998) : 999999;
    const cb = b.categoryIds[0] != null ? (catOrder.get(b.categoryIds[0]) ?? 999998) : 999999;
    if (ca !== cb) return ca - cb;
    const so = compareSortOrder(a.productSortOrder, b.productSortOrder);
    if (so !== 0) return so;
    return String(a.name).localeCompare(String(b.name), 'zh-Hant');
  });

  const rows = dayTxs.map((tx, idx) => {
    if (isVoided(tx)) return voidedRow(tx, idx);
    const qtyByKey = new Map();
    for (const it of tx.items ?? []) {
      const key = columnKeyOf(it);
      qtyByKey.set(key, (qtyByKey.get(key) ?? 0) + (Number(it.qty) || 0));
    }
    const discount = txDiscountTotal(tx);
    return {
      id: tx.id,
      receiptNo: tx.receiptNo ?? String(idx + 1),
      createdAt: tx.createdAt ?? null,
      time: tx.time ?? '',
      kind: calcTxKind(tx),
      qtyByKey,
      discount: discount > 0 ? -discount : 0,
      subtotal: tx.subtotal ?? 0,
      paymentLabel: getTxPaymentLabel(tx),
      activities: describeTxActivities(tx),
      bundleContents: describeTxBundles(tx),
      note: tx.note ?? '',
      voided: false,
    };
  });

  return { dateKey, txs, voidedTxs, columns, rows, footer: buildFooter(columns, rows, txs) };
}

/** 作廢交易的備註：`作廢｜原 NT$300：海報A×1｜原因：結錯帳｜原備註` */
export function describeVoidedTx(tx) {
  const parts = [`${VOID_KIND}｜原 NT$${tx?.subtotal ?? 0}：${describeTxItems(tx)}`];
  if (tx?.voidReason) parts.push(`原因：${tx.voidReason}`);
  if (tx?.note) parts.push(tx.note);
  return parts.join('｜');
}

function voidedRow(tx, idx) {
  return {
    id: tx.id,
    receiptNo: tx.receiptNo ?? String(idx + 1),
    createdAt: tx.createdAt ?? null,
    time: tx.time ?? '',
    kind: VOID_KIND,
    qtyByKey: new Map(), // 數量全部 0：Excel 欄位加總不會算到
    discount: 0,
    subtotal: 0,
    paymentLabel: getTxPaymentLabel(tx),
    activities: '',
    bundleContents: '',
    note: describeVoidedTx(tx),
    voided: true,
  };
}

function buildFooter(columns, rows, txs) {
  const qtyByKey = new Map(columns.map((c) => [c.key, 0]));
  const amountByKey = new Map(columns.map((c) => [c.key, 0]));
  for (const tx of txs) {
    for (const it of tx.items ?? []) {
      const key = columnKeyOf(it);
      if (!qtyByKey.has(key)) continue;
      qtyByKey.set(key, qtyByKey.get(key) + (Number(it.qty) || 0));
      amountByKey.set(key, amountByKey.get(key) + itemAmount(it));
    }
  }
  return {
    qtyByKey,
    amountByKey,
    subtotal: rows.reduce((s, r) => s + r.subtotal, 0),
    discount: rows.reduce((s, r) => s + r.discount, 0),
    gross: [...amountByKey.values()].reduce((s, v) => s + v, 0),
  };
}

/** Excel 工作表名稱：去掉 []:*?/\ 、截到 31 字、避免重複 */
export function sanitizeSheetName(name, used = new Set()) {
  let base = String(name ?? '').replace(/[[\]:*?/\\]/g, '').trim().slice(0, 31) || 'Sheet';
  let out = base;
  let n = 2;
  while (used.has(out)) {
    const suffix = ` (${n})`;
    out = base.slice(0, 31 - suffix.length) + suffix;
    n += 1;
  }
  used.add(out);
  return out;
}

/**
 * 類別分帳頁：每個「當天有賣出商品的類別」各一頁，只放該類別的商品欄、只列有買該類別商品的交易。
 * 商品屬於多個類別時每一頁都會出現。
 */
export function buildCategorySheets(ledger, categories = []) {
  const sheets = [];
  const sorted = [...categories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  for (const cat of sorted) {
    const columns = ledger.columns.filter((c) => c.categoryIds.includes(cat.id));
    if (columns.length === 0) continue;
    const keys = new Set(columns.map((c) => c.key));
    const rows = ledger.rows.filter((r) => [...r.qtyByKey.entries()].some(([k, q]) => keys.has(k) && q > 0));
    const txIds = new Set(rows.map((r) => r.id));
    const txs = ledger.txs.filter((tx) => txIds.has(tx.id));
    sheets.push({ categoryId: cat.id, name: cat.name, columns, rows, footer: buildFooter(columns, rows, txs) });
  }
  return sheets;
}

/**
 * SUMMARY 模型：商品彙整＋收款摘要（沿用舊 CSV 的內容），再補上
 *  - 各商品實際出貨數量（含套組內容物）
 *  - 活動折抵合計（負數）
 *  - 等式檢查：Σ 各商品金額 − 活動折抵 = 所有管道總銷售金額 + 預購B訂金（場外已收）
 * → { columns, rows: AOA（字串／數字）, totals }
 */
export function buildSummaryModel({ dateKey, transactions, products = [], categories = [] }) {
  const ledger = buildLedgerModel({ dateKey, transactions, products, categories });
  const { txs, columns } = ledger;
  const productsById = new Map(products.map((p) => [p.id, p]));

  const kindOf = (tx) => calcTxKind(tx);
  const saleTxs = txs.filter((t) => kindOf(t) === '現場');
  const preorderATxs = txs.filter((t) => kindOf(t) === '預購A');
  const preorderBTxs = txs.filter((t) => kindOf(t) === '預購B');
  const onlineTxs = txs.filter((t) => kindOf(t) === '通販');

  const zero = () => new Map(columns.map((c) => [c.key, 0]));
  const countsAll = zero();
  const amountsAll = zero();
  const countsSale = zero();
  const countsPreorder = zero();
  const countsOnline = zero();
  const shipped = zero(); // 實際出貨：單賣 ＋ 套組內容物

  const nameToKey = new Map(columns.map((c) => [c.name, c.key]));
  const addShipped = (productId, productName, qty) => {
    const key = productId ? String(productId) : nameToKey.get(productName) ?? `name:${productName}`;
    if (!shipped.has(key)) {
      // 內容物當天沒有單賣過：仍要列出來盤點，補一欄
      const p = productId ? productsById.get(productId) : null;
      columns.push({ key, productId: productId ?? null, name: p?.name ?? productName ?? '', categoryIds: p?.categoryIds ?? [], isBundle: false, extraForShipping: true });
      for (const m of [countsAll, amountsAll, countsSale, countsPreorder, countsOnline, shipped]) m.set(key, 0);
    }
    shipped.set(key, shipped.get(key) + qty);
  };

  const accumulate = (list, map) => {
    for (const tx of list) {
      for (const it of tx.items ?? []) {
        const key = columnKeyOf(it);
        if (!map.has(key)) continue;
        map.set(key, map.get(key) + (Number(it.qty) || 0));
      }
    }
  };
  for (const tx of txs) {
    for (const it of tx.items ?? []) {
      const key = columnKeyOf(it);
      if (!countsAll.has(key)) continue;
      const qty = Number(it.qty) || 0;
      countsAll.set(key, countsAll.get(key) + qty);
      amountsAll.set(key, amountsAll.get(key) + itemAmount(it));
      if (it.kind === 'bundle') {
        shipped.set(key, shipped.get(key) + qty);
        for (const c of it.components ?? []) addShipped(c.productId, c.productName, (Number(c.qty) || 0) * qty);
      } else {
        shipped.set(key, shipped.get(key) + qty);
      }
    }
  }
  accumulate(saleTxs, countsSale);
  accumulate([...preorderATxs, ...preorderBTxs], countsPreorder);
  accumulate(onlineTxs, countsOnline);

  const sum = (m) => [...m.values()].reduce((s, v) => s + v, 0);
  const sumBy = (arr, fn) => arr.reduce((s, x) => s + (fn(x) ?? 0), 0);

  const discountTotal = txs.reduce((s, tx) => s + txDiscountTotal(tx), 0);
  const todayRealTotal = sumBy(saleTxs, (t) => t.subtotal ?? 0) + sumBy(preorderBTxs, (t) => t.subtotal ?? 0);
  const preorderARefTotal = sumBy(preorderATxs, (t) => t.depositAlreadyPaid ?? 0);
  const preorderBDepositTotal = sumBy(preorderBTxs, (t) => t.depositAlreadyPaid ?? 0);
  const onlineStoreTotal = sumBy(onlineTxs, (t) => t.subtotal ?? 0);
  const allTotal = todayRealTotal + preorderARefTotal + onlineStoreTotal;
  const goodsTotal = sum(amountsAll);
  const equationLhs = goodsTotal - discountTotal;
  const equationRhs = allTotal + preorderBDepositTotal;

  const paymentGroup = (list, { includeCash }) => {
    const byMethod = {};
    for (const tx of list) {
      const pm = Array.isArray(tx.payments) ? tx.payments[0] : null;
      if (!pm) continue;
      if (includeCash === true && !pm.isCash) continue;
      if (includeCash === false && pm.isCash) continue;
      const name = pm.methodName ?? '（未命名）';
      if (!byMethod[name]) byMethod[name] = { amount: 0, count: 0 };
      byMethod[name].amount += tx.subtotal ?? 0;
      byMethod[name].count += 1;
    }
    return byMethod;
  };
  const saleCash = paymentGroup(saleTxs, { includeCash: true });
  const saleElectronic = paymentGroup(saleTxs, { includeCash: false });
  const preorderBAll = { ...paymentGroup(preorderBTxs, { includeCash: true }), ...paymentGroup(preorderBTxs, { includeCash: false }) };

  const colVals = (m) => columns.map((c) => m.get(c.key) ?? 0);
  const blank = () => columns.map(() => '');
  const rows = [];
  rows.push(['商品彙整', '區塊二']);
  rows.push(['', '', '', ...columns.map((c) => c.name), '合計', '', '']);
  rows.push(['各商品銷售數量（含預購+通販）', '', '', ...colVals(countsAll), sum(countsAll), '', '']);
  rows.push(['各商品銷售金額（含預購+通販）', '', '', ...colVals(amountsAll), goodsTotal, '', '']);
  rows.push(['各商品實際出貨數量（含套組內容物）', '', '', ...colVals(shipped), sum(shipped), '', '']);
  rows.push(['活動折抵合計', '', '', ...blank(), -discountTotal, '', '']);
  rows.push(['（參考）僅現場銷售數量', '', '', ...colVals(countsSale), sum(countsSale), '', '']);
  rows.push(['（參考）預購取件數量（A+B型）', '', '', ...colVals(countsPreorder), sum(countsPreorder), '', '']);
  rows.push(['（參考）通販數量', '', '', ...colVals(countsOnline), sum(countsOnline), '', '']);
  rows.push([]);
  rows.push(['收款摘要', '區塊三']);
  rows.push(['▸ 今日現場收款（需對到錢包的數字）']);
  const saleCashName = Object.keys(saleCash)[0] ?? '現金';
  rows.push(['現場銷售・現金', '', '', ...blank(), saleCash[saleCashName]?.amount ?? 0, '', `（筆數 ${saleCash[saleCashName]?.count ?? 0}）`]);
  for (const [name, info] of Object.entries(saleElectronic).sort((a, b) => a[0].localeCompare(b[0]))) {
    rows.push([`現場銷售・${name}`, '', '', ...blank(), info.amount, '', `（筆數 ${info.count}）`]);
  }
  rows.push([]);
  rows.push(['預購尾款收款（B型）']);
  for (const [name, info] of Object.entries(preorderBAll).sort((a, b) => a[0].localeCompare(b[0]))) {
    rows.push([`預購尾款收款（B型）・${name}`, '', '', ...blank(), info.amount, '', `（筆數 ${info.count}）`]);
  }
  rows.push(['✦ 今日現場實收合計', '', '', ...blank(), todayRealTotal, '', '']);
  rows.push(['▸ 參考數字（非今日現場收款，不需對現金）']);
  rows.push(['預購場外已付（A型，場次前已收）', '', '', ...blank(), preorderARefTotal, '', `（筆數 ${preorderATxs.length}）`]);
  rows.push(['預購訂金已付（B型，場次前已收）', '', '', ...blank(), preorderBDepositTotal, '', `（筆數 ${preorderBTxs.length}）`]);
  rows.push(['通販回填金額（賣貨便等平台，場外收款）', '', '', ...blank(), onlineStoreTotal, '', `（筆數 ${onlineTxs.length}）`]);
  rows.push(['▸ 綜合統計']);
  rows.push(['所有管道總銷售金額（含場外）', '', '', ...blank(), allTotal, '', '']);
  rows.push([`= 現場實收 NT$${todayRealTotal} + 預購場外已付 NT$${preorderARefTotal} + 通販 NT$${onlineStoreTotal}`]);
  rows.push(['▸ 對帳等式']);
  rows.push(['Σ 各商品金額 − 活動折抵', '', '', ...blank(), equationLhs, '', '']);
  rows.push(['所有管道總銷售金額 + 預購B訂金（場外已收）', '', '', ...blank(), equationRhs, '', '']);
  rows.push(['差異（應為 0）', '', '', ...blank(), equationLhs - equationRhs, '', '']);

  const { voidedTxs } = ledger;
  const voidedAmount = sumBy(voidedTxs, (t) => t.subtotal ?? 0);
  if (voidedTxs.length > 0) {
    rows.push([]);
    rows.push(['▸ 作廢紀錄（已從以上所有數字扣除）']);
    rows.push(['作廢交易原金額合計', '', '', ...blank(), voidedAmount, '', `（筆數 ${voidedTxs.length}）`]);
    for (const tx of voidedTxs) {
      rows.push([`#${tx.receiptNo ?? '—'} ${tx.time ?? ''}`, '', '', ...blank(), tx.subtotal ?? 0, '', describeVoidedTx(tx)]);
    }
  }

  return {
    columns,
    rows,
    totals: {
      goodsTotal, discountTotal, todayRealTotal, preorderARefTotal, preorderBDepositTotal, onlineStoreTotal, allTotal,
      equationLhs, equationRhs, equationDiff: equationLhs - equationRhs,
      voidedCount: voidedTxs.length, voidedAmount,
      shippedByKey: shipped,
    },
  };
}
