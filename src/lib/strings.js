/**
 * 基礎文案（第一階段：基礎文案與規則引擎）
 *
 * 來源：APP 文案審核表格.csv 的「歌姬審核修改」欄位
 *
 * 這份檔案目前不會取代既有 `src/i18n/strings.js`，
 * 而是提供一個「規則/提示顯示」可直接引用的模板集合。
 */

export const stringsById = {
  // 導覽介面
  N1: '姬帳 UtaKasse',
  N2: '販售',
  N3: '預購',
  N4: '報表',

  // 現場銷售
  S1: '全部',
  S2: '購物車',
  S3: '特典提醒',
  S4: '應收: $',
  S5: '實收:',
  S6: '請輸入金額',
  S7: '尚未輸入金額',
  S8: '不足額',
  S9: '找零: $',
  S10: '結帳完成?',
  S11: '金額不足或未收銀',

  // 預購領取
  P1: '上傳預購 CSV (自動辨認編碼)：',
  P2: '搜尋買家暱稱或末五碼...',
  P3: '已領取',
  P4: '已付清',
  P5: '收尾款: $',
  P6: '品項：',
  P7: '確認取件',
  P8: '撤銷標記',

  // 報表匯出
  R1: '今日現金實收',
  R2: '現場銷售總額:',
  R3: '預購尾款實收:',
  R4: '匯出 CSV 完整報表',
  R5: '清空數據',
  R6: 'CWT_財務總表_',
  R7: '場次',
  R8: '現場銷售',
  R9: '預購尾款實收',
  R10: '特典',

  // 系統通知
  A1: '確定要移除這項商品嗎？',
  A2: '結帳成功！編號：',
  A3: '匯入完成！已自動使用 ... 解碼。',
  A4: 'CSV 解析失敗，請檢查編碼格式！',
  A5: '需收尾款: $',
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

export default {
  stringsById,
  fillStringTemplate,
  getString,
};

