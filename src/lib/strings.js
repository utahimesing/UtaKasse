/**
 * 文案審核表 ID 對照（來源：APP 文案審核表格.csv 的「歌姬審核修改」欄位）
 *
 * 一般介面文字請放 src/i18n/strings.js（用 t()）。
 * 這裡只保留程式實際用到、且要跟審核表 ID 對得上的句子（用 getString()）。
 * v1.1.0 P6 清理：移除 30 個沒有任何程式引用的 ID（N1–N4、S1–S8、S10、P1、P3–P8、R1–R4、R6–R10、A5）。
 */

export const stringsById = {
  // 現場銷售
  S9: '找零: $',
  S11: '金額不足或未收銀',

  // 預購領取
  P2: '搜尋買家暱稱或末五碼...',

  // 後台
  R5: '清空數據',

  // 系統通知
  A1: '確定要移除這項商品嗎？',
  A2: '結帳成功！編號：',
  A3: '匯入完成！已自動使用 ... 解碼。',
  A4: 'CSV 解析失敗，請檢查編碼格式！',
  A6: '確定清空所有數據？',
};

/**
 * 填值模板工具
 *
 * - 若字串包含單一 `$`：用 `vars.money` 取代（你可以傳入 `123` 或 `NT$123`）
 * - 若字串包含 `...`：用 `vars.encoding` 取代（通常用於「自動使用 xxx 解碼」）
 *
 * 不做全域取代（只替換第一個匹配），避免未來字串擴充出現意外行為。
 */
export function fillStringTemplate(template, vars = {}) {
  if (typeof template !== 'string') return '';

  let out = template;

  if (out.includes('$') && vars.money !== undefined) {
    out = out.replace('$', String(vars.money));
  }

  if (out.includes('...') && vars.encoding !== undefined) {
    out = out.replace('...', String(vars.encoding));
  }

  return out;
}

/**
 * 依 id 取得字串；若提供 money / encoding 則會進行模板填值。
 */
export function getString(id, vars = undefined) {
  const template = stringsById[id] ?? '';
  if (!vars) return template;
  return fillStringTemplate(template, vars);
}
