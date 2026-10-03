/**
 * 交易作廢（v1.1.1）純函式
 *
 * 作廢＝軟刪除：交易紀錄保留，只加上
 *   voided: true, voidedAt: epoch ms, voidReason: 字串
 * 營收、SUMMARY、CSV 一律不計入；Excel 流水帳保留一列標「作廢」，數量與金額為 0。
 * 實際寫入資料庫的動作在 db.js 的 voidTransaction()。
 */
import { perUnitUsage } from './cart.js';

export const VOID_KIND = '作廢';
export const VOID_REASON_PRESETS = ['結錯帳', '客人退款'];
export const VOID_REASON_MAX = 100;

export function isVoided(tx) {
  return tx?.voided === true;
}

export function activeTxs(transactions) {
  return (transactions ?? []).filter((tx) => !isVoided(tx));
}

/**
 * 這筆交易當初扣了哪些商品各幾個（作廢時要加回去）。
 * 跟結帳扣庫存的算法一致：單賣 ＋ 套組本身 ＋ 套組內容物。
 */
export function txStockUsage(tx) {
  const m = new Map();
  for (const it of tx?.items ?? []) {
    const qty = Number(it?.qty) || 0;
    if (qty <= 0) continue;
    for (const [pid, per] of perUnitUsage(it)) {
      if (!pid) continue;
      m.set(pid, (m.get(pid) ?? 0) + per * qty);
    }
  }
  return m;
}

export function normalizeVoidReason(reason) {
  return String(reason ?? '').trim().slice(0, VOID_REASON_MAX);
}
