/**
 * Fullfillment of交接包：滿額禮規則引擎 evalBonuses
 * 規則重點：
 * - amount 型：依類別（categoryId）計算小計；categoryId=null 時計算全車
 * - product 型：購物車含指定商品且 qty >= triggerProductQty
 * - exclusiveGroup 互斥：
 *   - exclusiveGroup == null => 獨立觸發（全部通過）
 *   - 同一 exclusiveGroup 只取一條；比對順序：
 *     1) product 型優先於 amount 型
 *     2) 門檻高者（amount 比 triggerAmount；product 比 triggerProductQty）
 *     3) sortOrder 小者
 */
export function evalBonuses(cartItems, bonusRules) {
  const items = cartItems ?? [];
  const rules = bonusRules ?? [];

  const getItemSubtotal = (it) => {
    // Sales 已傳 sub；此處保底讓引擎在其他呼叫端也不會壞。
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
    } else if (rule.triggerType === 'product') {
      const triggerIds = Array.isArray(rule.triggerProductIds)
        ? rule.triggerProductIds
        : rule.triggerProductId
          ? [rule.triggerProductId]
          : [];

      const triggerQty = rule.triggerProductQty ?? 1;
      const ok = items.some(
        (it) => triggerIds.includes(it.productId) && (it.qty ?? 0) >= triggerQty,
      );
      if (ok) triggered.push(rule);
    }
  }

  const independent = [];
  const groupWinnersById = new Map(); // exclusiveGroup => rule

  const typeRank = (r) => (r.triggerType === 'product' ? 2 : 1);
  const thresholdOf = (r) => (r.triggerType === 'product' ? (r.triggerProductQty ?? 1) : r.triggerAmount ?? 0);
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

