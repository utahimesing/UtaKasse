/**
 * 資料遷移（純函式，DB upgrade 與備份還原共用）
 *
 * 歷史：
 * - DB v2/v3（App v1.0.0）：bonusRules.triggerType 只有 'amount'（滿額禮）與 'product'（舊合購特典，只提醒）
 * - DB v4（未發布的工作區）：加 products.sortOrder 索引，資料格式同 v3
 * - DB v5（App v1.1.0）：活動系統改版
 *     'product' → 'combo' + rewardType 'gift'（行為不變：只提醒，不改金額）
 *     新增 'bundle'（套組活動）與 products.type / bundleSlots
 *
 * 函式名沿用需求單的 migrateBonusRuleV3toV4：它負責把「v5 以前」的規則轉成新格式。
 */

export const CURRENT_BACKUP_VERSION = 5;
export const SUPPORTED_BACKUP_VERSIONS = [3, 4, 5];

function makeSlotId(ruleId) {
  return `slot-${ruleId ?? 'legacy'}-1`;
}

/**
 * 把一條 bonusRule 轉成 v5 格式。已經是新格式的規則原樣回傳（新物件）。
 * 舊欄位（triggerProductIds / triggerProductQty）保留不刪，方便對照。
 */
export function migrateBonusRuleV3toV4(rule) {
  if (!rule || typeof rule !== 'object') return rule;

  if (rule.triggerType === 'product') {
    const ids = Array.isArray(rule.triggerProductIds)
      ? rule.triggerProductIds.filter(Boolean)
      : rule.triggerProductId
        ? [rule.triggerProductId]
        : [];
    const qty = Math.max(1, parseInt(rule.triggerProductQty, 10) || 1);
    return {
      ...rule,
      triggerType: 'combo',
      rewardType: 'gift',
      slots: [
        { id: makeSlotId(rule.id), label: '指定商品', qty, poolProductIds: ids },
      ],
      comboPrice: null,
    };
  }

  if (rule.triggerType === 'combo') {
    return {
      ...rule,
      rewardType: rule.rewardType === 'price' ? 'price' : 'gift',
      slots: Array.isArray(rule.slots) ? rule.slots : [],
    };
  }

  return { ...rule };
}

/** products：沒有 type 一律視為 single；bundle 補齊 bundleSlots 陣列 */
export function normalizeProductV5(product) {
  if (!product || typeof product !== 'object') return product;
  const type = product.type === 'bundle' ? 'bundle' : 'single';
  const out = { ...product, type };
  if (type === 'bundle') out.bundleSlots = Array.isArray(product.bundleSlots) ? product.bundleSlots : [];
  return out;
}

/**
 * 把整份備份（v3／v4／v5）轉成 v5。不會改到傳入的物件。
 */
export function migrateBackupPayload(data) {
  if (!data || typeof data !== 'object') return data;
  return {
    ...data,
    version: CURRENT_BACKUP_VERSION,
    products: (data.products ?? []).map(normalizeProductV5),
    bonusRules: (data.bonusRules ?? []).map(migrateBonusRuleV3toV4),
  };
}
