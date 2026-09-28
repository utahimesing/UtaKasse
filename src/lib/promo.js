/**
 * 合購折扣：全購物車最佳化（純函式，無副作用）
 *
 * optimizeCombos(lines, comboRules, { maxStates })
 *   → { groups: [{ ruleId, unitKeys, discount }], totalDiscount, approximate }
 *
 * 規則（需求單 7.1）：
 * 1. 同一台購物車可同時套多個折扣，同一活動可套多次
 * 2. 每一件商品最多只屬於一組
 * 3. 找總折扣最大的組合
 * 4. 套組行與套組內容物不參與
 * 5. 一組 = 活動每個 slot 都填滿；折扣 = 組內原價合計 − comboPrice，≤ 0 的組合不能套
 * 7. 同分時：組數少者優先，再比活動 sortOrder 加總小者
 *
 * 做法：記憶化搜尋（狀態 = 每個商品剩幾件）。狀態數或候選數超過 maxStates
 * 就中止改用貪婪法，並回傳 approximate: true。
 */

class BudgetExceeded extends Error {}

function sortOrderOf(rule) {
  return Number.isFinite(rule?.sortOrder) ? rule.sortOrder : 999999;
}

/** 只保留 enabled、rewardType === 'price'、結構完整的合購規則 */
export function activePriceRules(rules) {
  return (rules ?? []).filter((r) => isValidComboRule(r) && r.rewardType === 'price' && Number.isFinite(Number(r.comboPrice)) && Number(r.comboPrice) >= 0);
}

export function activeGiftRules(rules) {
  return (rules ?? []).filter((r) => isValidComboRule(r) && r.rewardType !== 'price');
}

function isValidComboRule(r) {
  return !!r && !!r.enabled && r.triggerType === 'combo'
    && Array.isArray(r.slots) && r.slots.length > 0
    && r.slots.every((s) => s && Number(s.qty) >= 1 && Array.isArray(s.poolProductIds) && s.poolProductIds.length > 0);
}

/**
 * 把購物車的一般商品彙整成 items[]：{ key, productId, price, count }
 * 只留至少符合一條規則的商品，依 key 固定排序（同商品不同單價視為不同 item）。
 */
export function prepareItems(lines, rules) {
  const inAnyRule = new Set();
  for (const r of rules) for (const s of r.slots) for (const pid of s.poolProductIds) inAnyRule.add(pid);

  const byKey = new Map();
  for (const line of lines ?? []) {
    if (!line || line.kind === 'bundle') continue;
    const qty = Number(line.qty ?? line.count ?? 0);
    if (!(qty > 0)) continue;
    if (!inAnyRule.has(line.productId)) continue;
    const price = Number(line.unitPrice ?? line.price ?? 0);
    const key = `${line.productId}@${price}`;
    const cur = byKey.get(key);
    if (cur) cur.count += qty;
    else byKey.set(key, { key, productId: line.productId, price, count: qty });
  }
  return [...byKey.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

function buildRuleDefs(rules, items) {
  const idxByProduct = new Map();
  items.forEach((it, i) => {
    if (!idxByProduct.has(it.productId)) idxByProduct.set(it.productId, []);
    idxByProduct.get(it.productId).push(i);
  });
  return rules
    .map((r) => ({
      id: r.id,
      name: r.name,
      sortOrder: sortOrderOf(r),
      comboPrice: Number(r.comboPrice) || 0,
      slots: r.slots.map((s) => ({
        qty: Math.max(1, parseInt(s.qty, 10) || 1),
        pool: [...new Set(s.poolProductIds.flatMap((pid) => idxByProduct.get(pid) ?? []))].sort((a, b) => a - b),
      })),
    }))
    // 有任何一個 slot 在購物車裡完全沒商品，這條規則就不可能成組
    .filter((rd) => rd.slots.every((s) => s.pool.length > 0));
}

function better(a, b) {
  if (!b) return true;
  if (a.discount !== b.discount) return a.discount > b.discount;
  if (a.groups !== b.groups) return a.groups < b.groups;
  return a.sortSum < b.sortSum;
}

/**
 * 列出「把第 i 個 item 的 1 件放進規則 rd 的某個 slot，其餘 slot 從 index ≥ i 的商品填滿」
 * 的所有用量向量（去重）。avail 是已扣掉那 1 件的剩餘數量。
 */
function enumerateFills(rd, i, avail, tick) {
  const n = avail.length;
  const results = new Map(); // key → use[]

  for (let placed = 0; placed < rd.slots.length; placed++) {
    if (!rd.slots[placed].pool.includes(i)) continue;
    const needs = rd.slots.map((s, k) => s.qty - (k === placed ? 1 : 0));
    const use = new Array(n).fill(0);
    const remain = avail.slice();

    const fillSlot = (slotIdx) => {
      if (slotIdx === rd.slots.length) {
        const out = use.slice();
        out[i] += 1;
        const key = out.join(',');
        if (!results.has(key)) results.set(key, out);
        return;
      }
      const pool = rd.slots[slotIdx].pool;
      const need = needs[slotIdx];
      // 非遞減順序挑 need 件（重複組合），只用 index ≥ i 的商品
      const pick = (left, startPos) => {
        if (left === 0) {
          fillSlot(slotIdx + 1);
          return;
        }
        for (let p = startPos; p < pool.length; p++) {
          const idx = pool[p];
          if (idx < i || remain[idx] <= 0) continue;
          tick();
          remain[idx] -= 1;
          use[idx] += 1;
          pick(left - 1, p);
          remain[idx] += 1;
          use[idx] -= 1;
        }
      };
      pick(need, 0);
    };
    fillSlot(0);
  }
  return [...results.values()];
}

function exactSearch(items, ruleDefs, maxStates) {
  const n = items.length;
  const memo = new Map();
  let budget = 0;
  const tick = () => {
    budget += 1;
    if (budget > maxStates) throw new BudgetExceeded();
  };

  function best(counts) {
    const key = counts.join(',');
    const hit = memo.get(key);
    if (hit) return hit;
    tick();

    const i = counts.findIndex((c) => c > 0);
    if (i < 0) {
      const base = { discount: 0, groups: 0, sortSum: 0, choice: null, next: null };
      memo.set(key, base);
      return base;
    }

    // 選項 A：這 1 件不參加任何折扣
    const skip = counts.slice();
    skip[i] -= 1;
    const skipRes = best(skip);
    let bestRes = { discount: skipRes.discount, groups: skipRes.groups, sortSum: skipRes.sortSum, choice: null, next: skip };

    // 選項 B：這 1 件放進某條規則的某個 slot，成一組
    for (const rd of ruleDefs) {
      const uses = enumerateFills(rd, i, skip, tick);
      for (const use of uses) {
        let total = 0;
        for (let k = 0; k < n; k++) total += use[k] * items[k].price;
        const discount = total - rd.comboPrice;
        if (discount <= 0) continue;
        const rest = counts.map((c, k) => c - use[k]);
        const sub = best(rest);
        const cand = {
          discount: discount + sub.discount,
          groups: 1 + sub.groups,
          sortSum: rd.sortOrder + sub.sortSum,
          choice: { ruleId: rd.id, use, discount },
          next: rest,
        };
        if (better(cand, bestRes)) bestRes = cand;
      }
    }

    memo.set(key, bestRes);
    return bestRes;
  }

  const start = items.map((it) => it.count);
  best(start);

  // 重建組合：每一步 counts 總數都會減少，保證會結束
  const groups = [];
  let counts = start;
  let guard = start.reduce((s, c) => s + c, 0) + 1;
  while (counts && guard-- > 0) {
    const res = memo.get(counts.join(','));
    if (!res) break;
    if (res.choice) groups.push(toGroup(res.choice, items));
    counts = res.next;
  }
  return { groups, totalDiscount: groups.reduce((s, g) => s + g.discount, 0), approximate: false };
}

function toGroup(choice, items) {
  const unitKeys = [];
  choice.use.forEach((cnt, k) => {
    for (let x = 0; x < cnt; x++) unitKeys.push(items[k].productId);
  });
  return { ruleId: choice.ruleId, unitKeys, discount: choice.discount };
}

/** 貪婪備援：每條規則各自用「剩下商品中單價最高的」填滿，挑折扣最大的那組套用，重複到沒有折扣 > 0 */
function greedySearch(items, ruleDefs) {
  const n = items.length;
  const avail = items.map((it) => it.count);
  const groups = [];
  const totalUnits = avail.reduce((s, c) => s + c, 0);

  for (let iter = 0; iter < totalUnits; iter++) {
    let bestG = null;
    for (const rd of ruleDefs) {
      const tmp = avail.slice();
      const use = new Array(n).fill(0);
      let sum = 0;
      let ok = true;
      for (const slot of rd.slots) {
        let need = slot.qty;
        const pool = [...slot.pool].sort((a, b) => items[b].price - items[a].price);
        for (const idx of pool) {
          while (need > 0 && tmp[idx] > 0) {
            tmp[idx] -= 1;
            use[idx] += 1;
            sum += items[idx].price;
            need -= 1;
          }
          if (need === 0) break;
        }
        if (need > 0) { ok = false; break; }
      }
      if (!ok) continue;
      const discount = sum - rd.comboPrice;
      if (discount <= 0) continue;
      if (!bestG || discount > bestG.discount || (discount === bestG.discount && rd.sortOrder < bestG.rd.sortOrder)) {
        bestG = { rd, use, discount };
      }
    }
    if (!bestG) break;
    bestG.use.forEach((cnt, k) => { avail[k] -= cnt; });
    groups.push(toGroup({ ruleId: bestG.rd.id, use: bestG.use, discount: bestG.discount }, items));
  }
  return { groups, totalDiscount: groups.reduce((s, g) => s + g.discount, 0), approximate: true };
}

export function optimizeCombos(lines, comboRules, { maxStates = 50000 } = {}) {
  const rules = activePriceRules(comboRules);
  const items = prepareItems(lines, rules);
  const ruleDefs = buildRuleDefs(rules, items);
  if (rules.length === 0 || items.length === 0 || ruleDefs.length === 0) {
    return { groups: [], totalDiscount: 0, approximate: false };
  }
  try {
    return exactSearch(items, ruleDefs, maxStates);
  } catch (e) {
    if (e instanceof BudgetExceeded) return greedySearch(items, ruleDefs);
    throw e;
  }
}

/** 購物車（不含套組）能不能把這條規則的 slots 湊滿至少 1 組（gift 模式用） */
export function canFillOnce(lines, rule) {
  if (!isValidComboRule(rule)) return false;
  const counts = new Map();
  for (const line of lines ?? []) {
    if (!line || line.kind === 'bundle') continue;
    counts.set(line.productId, (counts.get(line.productId) ?? 0) + Number(line.qty ?? 0));
  }
  const slots = rule.slots.map((s) => ({ qty: Math.max(1, parseInt(s.qty, 10) || 1), pool: [...new Set(s.poolProductIds)] }));
  const fill = (slotIdx) => {
    if (slotIdx === slots.length) return true;
    const { qty, pool } = slots[slotIdx];
    const pick = (left, startPos) => {
      if (left === 0) return fill(slotIdx + 1);
      for (let p = startPos; p < pool.length; p++) {
        const pid = pool[p];
        if ((counts.get(pid) ?? 0) <= 0) continue;
        counts.set(pid, counts.get(pid) - 1);
        const ok = pick(left - 1, p);
        counts.set(pid, counts.get(pid) + 1);
        if (ok) return true;
      }
      return false;
    };
    return pick(qty, 0);
  };
  return fill(0);
}

export function evalComboGifts(lines, rules) {
  return activeGiftRules(rules).filter((r) => canFillOnce(lines, r));
}

/** 把 groups 彙整成交易要存的 discounts：[{ ruleId, ruleName, times, amount }]，依 sortOrder 排序 */
export function summarizeDiscounts(groups, rules) {
  const byRule = new Map();
  for (const g of groups ?? []) {
    const cur = byRule.get(g.ruleId) ?? { ruleId: g.ruleId, times: 0, amount: 0 };
    cur.times += 1;
    cur.amount += g.discount;
    byRule.set(g.ruleId, cur);
  }
  const ruleById = new Map((rules ?? []).map((r) => [r.id, r]));
  return [...byRule.values()]
    .map((d) => ({ ...d, ruleName: ruleById.get(d.ruleId)?.name ?? d.ruleId }))
    .sort((a, b) => sortOrderOf(ruleById.get(a.ruleId)) - sortOrderOf(ruleById.get(b.ruleId)));
}

/**
 * 購物車總額（Sales、Preorders 加購共用）
 * → { grossAmount, totalDiscount, subtotal, discounts, approximate, discountByProductId, comboGifts }
 * discountByProductId：把每組折扣依組內單價比例攤到各商品（只給滿額禮「類別小計」用，不寫進交易）。
 */
export function calcCartTotals(cart, rules, opts) {
  const lines = cart ?? [];
  const grossAmount = lines.reduce((s, l) => s + (Number(l.unitPrice) || 0) * (Number(l.qty) || 0), 0);
  const singles = lines.filter((l) => l.kind !== 'bundle');
  const opt = optimizeCombos(singles, rules, opts);
  const totalDiscount = Math.min(grossAmount, opt.totalDiscount);
  const subtotal = Math.max(0, grossAmount - totalDiscount);

  const priceOf = new Map();
  for (const l of singles) priceOf.set(l.productId, Number(l.unitPrice) || 0);
  const discountByProductId = new Map();
  for (const g of opt.groups) {
    const total = g.unitKeys.reduce((s, pid) => s + (priceOf.get(pid) ?? 0), 0);
    for (const pid of g.unitKeys) {
      const share = total > 0 ? (g.discount * (priceOf.get(pid) ?? 0)) / total : g.discount / g.unitKeys.length;
      discountByProductId.set(pid, (discountByProductId.get(pid) ?? 0) + share);
    }
  }

  return {
    grossAmount,
    totalDiscount,
    subtotal,
    discounts: summarizeDiscounts(opt.groups, rules),
    groups: opt.groups,
    approximate: opt.approximate,
    discountByProductId,
    comboGifts: evalComboGifts(singles, rules),
  };
}

/** 後台軟性提醒：comboPrice 是否 ≥「每個 slot 用最便宜商品填滿」的合計 */
export function minFillPrice(slots, productsById) {
  let sum = 0;
  for (const s of slots ?? []) {
    const prices = (s.poolProductIds ?? [])
      .map((pid) => productsById.get(pid)?.price)
      .filter((p) => Number.isFinite(p));
    if (prices.length === 0) return null;
    sum += Math.min(...prices) * (Math.max(1, parseInt(s.qty, 10) || 1));
  }
  return sum;
}
