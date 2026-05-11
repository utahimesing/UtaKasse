import { createUUID } from '../db.js';
import { hasRequiredFields, parseCleanCsv, pickField } from './csvImport.js';

function toValidInt(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : NaN;
}

function normalizeName(v) {
  return String(v ?? '').replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * 預購 CSV 解析（逐行驗證 + 不整檔中止）。
 *
 * 會依 order_id（有值）或 buyer_name + phone_last5（無 order_id）合併成單一 preOrder。
 * A/B 判斷：balanceDue === 0 => A；>0 => B。
 */
export function parsePreordersCsvText(text, { productByName, eventId, expectedEventId, expectedEventName }) {
  const { fields, rows, errors } = parseCleanCsv(text);
  const headerErrors = [];
  const rowErrors = [];
  const warnings = [];

  if (rows.length === 0) headerErrors.push('CSV 內容為空。');

  const missing = hasRequiredFields(fields, [
    ['buyer_name', 'buyerName'],
    ['phone_last5', 'phoneLast5'],
    ['item_name', 'itemName'],
    ['item_qty', 'itemQty'],
    ['unit_price', 'unitPrice'],
    ['paid_amount', 'paidAmount', 'deposit_paid', 'depositPaid'],
  ]);
  missing.forEach((key) => headerErrors.push(`缺少必要欄位: ${key}`));
  if (errors.length > 0) {
    headerErrors.push(`CSV 結構異常: ${errors[0]?.message ?? '未知錯誤'}`);
  }

  if (headerErrors.length > 0) {
    return { preOrders: [], headerErrors, rowErrors, warnings };
  }

  const hasEventField = fields.some((f) => {
    const fl = String(f).toLowerCase();
    return fl === 'event_id' || fl === 'event_name';
  });
  if (hasEventField) {
    const expectedNameNorm = String(expectedEventName ?? '').trim().toLowerCase();
    const expectedIdNorm = String(expectedEventId ?? '').trim().toLowerCase();
    const mismatch = rows.some((r) => {
      const v = String(pickField(r, ['event_name', 'eventName', 'event_id', 'eventId']) ?? '').trim();
      if (!v) return false;
      const normalized = v.toLowerCase();
      return normalized !== expectedNameNorm && normalized !== expectedIdNorm;
    });
    if (mismatch) {
      headerErrors.push(`CSV 的場次名稱與目前選擇的活動「${expectedEventName}」不一致，請確認後重新匯入。`);
      return { preOrders: [], headerErrors, rowErrors, warnings };
    }
  }

  const productMap = productByName ?? new Map();
  const groupMap = new Map(); // orderKey => group

  rows.forEach((r, idx) => {
    const line = idx + 2; // header at line 1

    const buyerName = pickField(r, ['buyer_name', 'buyerName']);
    const phoneLast5 = pickField(r, ['phone_last5', 'phoneLast5']);
    const bankLast5 = pickField(r, ['bank_last5', 'bankLast5']);
    const orderId = pickField(r, ['order_id', 'orderId']);
    const itemName = pickField(r, ['item_name', 'itemName']);

    const itemQty = toValidInt(pickField(r, ['item_qty', 'itemQty']));
    const unitPrice = toValidInt(pickField(r, ['unit_price', 'unitPrice']));

    // paid amount may represent depositPaid (A+B distinction uses balanceDue)
    const paidAmount = toValidInt(pickField(r, ['paid_amount', 'paidAmount', 'deposit_paid', 'depositPaid']));
    const totalPriceField = pickField(r, ['total_price', 'totalPrice']);
    const balanceDueField = pickField(r, ['balance_due', 'balanceDue']);

    if (!buyerName || !phoneLast5 || !itemName || !Number.isFinite(itemQty) || itemQty <= 0) {
      rowErrors.push(`第 ${line} 行：buyer_name/phone_last5/item_name 或 item_qty 不正確。`);
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      rowErrors.push(`第 ${line} 行：unit_price 不正確。`);
      return;
    }
    if (!Number.isFinite(paidAmount) || paidAmount < 0) {
      rowErrors.push(`第 ${line} 行：paid_amount 不正確。`);
      return;
    }

    const totalPrice =
      totalPriceField !== undefined && String(totalPriceField).trim() !== ''
        ? toValidInt(totalPriceField)
        : unitPrice * itemQty;

    if (!Number.isFinite(totalPrice) || totalPrice < 0) {
      rowErrors.push(`第 ${line} 行：total_price 不正確。`);
      return;
    }

    const balanceDue =
      balanceDueField !== undefined && String(balanceDueField).trim() !== ''
        ? toValidInt(balanceDueField)
        : totalPrice - paidAmount;

    if (!Number.isFinite(balanceDue)) {
      rowErrors.push(`第 ${line} 行：balance_due 不正確。`);
      return;
    }
    if (balanceDue < 0) {
      rowErrors.push(`第 ${line} 行：balance_due 出現負值（檢查 paid_amount/total_price）。`);
      return;
    }

    const prod = productMap.get(normalizeName(itemName)) ?? productMap.get(itemName) ?? null;
    if (!prod) {
      warnings.push(`第 ${line} 行：找不到商品「${itemName}」，此項將不匯入並避免結帳/扣庫存出錯。`);
      return;
    }

    const orderKey = orderId ? orderId : `${buyerName}__${phoneLast5}`;
    if (!groupMap.has(orderKey)) {
      groupMap.set(orderKey, {
        id: createUUID(),
        eventId,
        buyerName,
        phoneLast5,
        bankLast5: bankLast5 || null,
        orderId: orderId || null,
        items: [],
        totalPrice: 0,
        depositPaid: 0,
        balanceDue: 0,
        status: 'pending',
        collectedAt: null,
        transactionId: null,
        note: r.note ?? '',
      });
    }

    const group = groupMap.get(orderKey);

    group.items.push({
      productId: prod.id,
      productName: itemName,
      qty: itemQty,
      unitPrice,
    });
    group.totalPrice += totalPrice;
    group.depositPaid += paidAmount;
    group.balanceDue += balanceDue;
  });

  const preOrders = [...groupMap.values()].filter((g) => (g.items ?? []).length > 0);
  return { preOrders, headerErrors, rowErrors, warnings };
}

