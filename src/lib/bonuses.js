import { canFillOnce } from './promo.js';

/**
 * 活動提醒引擎 evalBonuses（滿額禮 amount ＋ 合購 gift 模式）
 *
 * cartItems: [{ productId, qty, sub, catIds, kind }]
 *   - sub：這一行「折扣後」的金額（Sales 已把合購折扣攤進去；沒有折扣就是 unitPrice × qty）
 *   - kind === 'bundle' 的行不參與合購 gift 判斷，但金額算進滿額禮
 *
 * 規則重點：
 * - amount 型：依類別（categoryId）計算小計；categoryId=null 時計算全車。門檻用折扣後金額（需求單 Q5）
 * - combo 型（rewardType 'gift'）：購物車（不含套組）能湊滿至少 1 組 slots 就提醒；price 模式由 promo.js 處理，不在這裡
 * - exclusiveGroup 互斥：
 *   - exclusiveGroup == null => 獨立觸發（全部通過）
 *   - 同一 exclusiveGroup 只取一條；比對順序：
 *     1) combo 型優先於 amount 型
 *     2) 門檻高者（amount 比 triggerAmount；combo 比 slots 總件數）
 *     3) sortOrder 小者
 */
export function evalBonuses(cartItems, bonusRules) {
  const items = cartItems ?? [];
  const rules = bonusRules ?? [];

  const getItemSubtotal = (it) => {
    if (typeof it?.sub === 'number') return it.sub;
    if (typeof it?.unitPrice === 'number' && typeof it?.qty === 'number') return it.unitPrice * it.qty;
    return 0;
  };

  const triggered = [];

  for (const rule of rules) {
    if (!rule || !rule.enabled) continue;

    if (rule.triggerType === 'amount') {
      const scopedItems =
        rule.categoryId == null
          ? items
          : items.filter((it) => Array.isArray(it.catIds) && it.catIds.includes(rule.categoryId));

      const sum = scopedItems.reduce((s, it) => s + getItemSubtotal(it), 0);
      const threshold = rule.triggerAmount ?? 0;
      if (sum >= threshold) triggered.push(rule);
    } else if (rule.triggerType === 'combo' && rule.rewardType !== 'price') {
      if (canFillOnce(items, rule)) triggered.push(rule);
    }
  }

  const independent = [];
  const groupWinnersById = new Map(); // exclusiveGroup => rule

  const typeRank = (r) => (r.triggerType === 'combo' ? 2 : 1);
  const thresholdOf = (r) => (r.triggerType === 'combo'
    ? (r.slots ?? []).reduce((s, slot) => s + (parseInt(slot.qty, 10) || 1), 0)
    : r.triggerAmount ?? 0);
  const sortOrderOf = (r) => (Number.isFinite(r.sortOrder) ? r.sortOrder : 999999);

  for (const rule of triggered) {
    const g = rule.exclusiveGroup ?? null;
    if (g == null) {
      independent.push(rule);
      continue;
    }

    const cur = groupWinnersById.get(g);
    if (!cur) {
      groupWinnersById.set(g, rule);
      continue;
    }

    const rRank = typeRank(rule);
    const cRank = typeRank(cur);

    if (rRank > cRank) {
      groupWinnersById.set(g, rule);
      continue;
    }

    if (rRank < cRank) continue;

    // Same triggerType: compare threshold first.
    const rTh = thresholdOf(rule);
    const cTh = thresholdOf(cur);
    if (rTh > cTh) {
      groupWinnersById.set(g, rule);
      continue;
    }
    if (rTh < cTh) continue;

    // Same threshold: smaller sortOrder wins.
    if (sortOrderOf(rule) < sortOrderOf(cur)) {
      groupWinnersById.set(g, rule);
    }
  }

  const winners = [...independent, ...Array.from(groupWinnersById.values())];
  winners.sort((a, b) => sortOrderOf(a) - sortOrderOf(b));

  return winners.map((r) => ({
    ruleId: r.id,
    ruleName: r.name,
    bonusText: r.bonusText ?? r.name,
    sortOrder: sortOrderOf(r),
  }));
}
