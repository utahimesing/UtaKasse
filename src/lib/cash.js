/**
 * 收銀台小工具（純函式，可單元測試）
 */

/**
 * 預設收款方式：後台設為預設的 → 第一個現金 → 第一個。
 * 每筆結完都回到這個，避免沿用上一位客人的 LINE Pay。
 */
export function pickDefaultPaymentId(paymentMethods) {
  const list = Array.isArray(paymentMethods) ? paymentMethods : [];
  return (list.find((m) => m.isDefault) ?? list.find((m) => m.isCash) ?? list[0])?.id ?? null;
}

/**
 * 現金快捷鍵：「剛好」＋往上湊整的鈔票金額（下一個百、五百、千），最多 3 個。
 * 例：應收 200 → [200, 500, 1000]；應收 1230 → [1230, 1300, 1500, 2000]
 */
export function quickCashOptions(total) {
  const n = Math.floor(Number(total) || 0);
  if (n <= 0) return [];
  const ups = [100, 500, 1000]
    .map((step) => Math.ceil(n / step) * step)
    .filter((v) => v > n);
  return [n, ...[...new Set(ups)].slice(0, 3)];
}
