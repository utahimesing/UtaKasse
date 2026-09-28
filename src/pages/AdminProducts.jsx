import { useEffect, useMemo, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import ProductCard from '../components/ProductCard.jsx';
import db, { createUUID, normalizeStockInput } from '../db.js';
import { fileToDataUrl, validateImageFile } from '../lib/image.js';
import { t } from '../i18n/t.js';
import { ensureSeedData } from '../lib/seed.js';
import Toast from '../components/Toast.jsx';
import { getString } from '../lib/strings.js';
import { useToast } from '../lib/useToast.js';
import { buildCsvParseError, hasRequiredFields, parseCleanCsv, pickField, readCsvFileWithEncoding, withBom } from '../lib/csvImport.js';
import { PRODUCT_COLOR_PRESETS as COLOR_PRESETS, ui, border, shadow, surface, buttonVariants } from '../lib/uiPalette.js';
import BackupRestore from '../components/BackupRestore.jsx';
import Button from '../components/Button.jsx';
import SectionHeader from '../components/SectionHeader.jsx';
import SlotEditor from '../components/SlotEditor.jsx';
import { makeEmptySlot } from '../lib/slots.js';
import { minFillPrice } from '../lib/promo.js';
import EmptyState from '../components/EmptyState.jsx';

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: 'transparent',
    paddingBottom: 40,
    fontFamily: 'inherit',
    color: ui.ink,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 12,
    padding: '2px 6px 6px 2px', // 右／下留給硬陰影
  },
  // 資訊卡：白底＋黑框＋硬陰影，內距 16
  formCard: {
    ...surface.card,
    padding: 16,
  },
  // 列表內的小卡（場次／活動規則／付款方式）
  rowCard: {
    background: ui.white,
    border: border.solidSm,
    borderRadius: 10,
    padding: '10px 12px',
    boxShadow: shadow.sm,
  },
  // H2 區塊標題＋偏左橘色粗色條
  h2: { fontWeight: 800, fontSize: 20, color: ui.ink, letterSpacing: '-0.01em', lineHeight: 1.2 },
  h2Bar: { width: 48, height: 6, background: ui.orange, border: border.solidSm, marginTop: 6, marginBottom: 10 },
  caption: { color: ui.muted, fontWeight: 600, fontSize: 12 },
  typeBadge: { display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, border: border.solidSm, background: ui.mint },
  label: {
    fontWeight: 700, fontSize: 12, color: ui.ink, marginBottom: 8,
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  input: {
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
    minHeight: 44,
    borderRadius: 10,
    border: border.solidSm,
    padding: '10px 14px', fontWeight: 700,
    background: ui.white,
    color: ui.ink, fontFamily: 'inherit',
    fontSize: 15,
  },
  // 按鈕代幣（沿用 Button.jsx 的 variant，給原生 <button> 用）
  btnBase: {
    minHeight: 44, borderRadius: 10, padding: '10px 14px',
    fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  get btnPrimary() { return { ...this.btnBase, ...buttonVariants.primary }; },
  get btnSecondary() { return { ...this.btnBase, ...buttonVariants.secondary }; },
  get btnDanger() { return { ...this.btnBase, ...buttonVariants.destructive }; },
  get btnDangerFilled() { return { ...this.btnBase, ...buttonVariants.destructiveFilled }; },
  // 列表內的小按鈕（編輯／封存／刪除）：高度仍 ≥ 44
  get btnSmall() { return { ...this.btnBase, ...buttonVariants.secondary, padding: '6px 12px', fontSize: 13 }; },
  get btnSmallDanger() { return { ...this.btnBase, ...buttonVariants.destructive, padding: '6px 12px', fontSize: 13 }; },
  // chip：pill、黑框、選中杏色
  chip: (active) => ({
    minHeight: 36, padding: '0 14px', borderRadius: 999,
    fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
    border: border.solidSm,
    background: active ? ui.apricot : ui.white,
    color: ui.ink,
    boxShadow: active ? shadow.sm : 'none',
    transition: 'background 0.15s ease',
  }),
  // 底部抽屜（商品表單）
  overlay: {
    position: 'fixed', inset: 0, ...surface.overlay,
    zIndex: 3000, display: 'flex', alignItems: 'flex-end',
  },
  sheet: {
    width: '100%', boxSizing: 'border-box',
    ...surface.sheet, boxShadow: 'none',
    padding: 20, maxHeight: '90vh', overflowY: 'auto',
    background: ui.mint,
  },
  swatch: (active, color) => ({
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: color,
    border: border.solidSm,
    boxShadow: active ? '3px 3px 0 #1A1A1A' : 'none',
    transform: active ? 'translate(-1px, -1px)' : 'none',
    cursor: 'pointer',
  }),
};

function parseBool(v) {
  if (typeof v === 'boolean') return v;
  const s = String(v ?? '').toLowerCase().trim();
  return s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === 'on';
}

function isArchivedProduct(product) {
  const v = product?.archived;
  return v === true || String(v).toLowerCase() === 'true' || String(v) === '1';
}

function compareProductSortOrder(a, b) {
  const aOrder = a.sortOrder;
  const bOrder = b.sortOrder;
  const aHasOrder = aOrder != null && Number.isFinite(Number(aOrder));
  const bHasOrder = bOrder != null && Number.isFinite(Number(bOrder));
  if (aHasOrder && bHasOrder && aOrder !== bOrder) return aOrder - bOrder;
  if (aHasOrder !== bHasOrder) return aHasOrder ? -1 : 1;
  return String(a.name ?? '').localeCompare(String(b.name ?? ''), 'zh-Hant');
}

function DraggableProductGrid({ orderedProducts, onEdit, onReorder }) {
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const dragStateRef = useRef({ active: false, productId: null });
  const dragOverIdRef = useRef(null);

  function beginDrag(e, productId) {
    e.stopPropagation();
    e.preventDefault();
    dragStateRef.current = { active: true, productId };
    dragOverIdRef.current = productId;
    setDraggingId(productId);
    setDragOverId(productId);

    function handlePointerMove(ev) {
      if (!dragStateRef.current.active) return;
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const target = el?.closest('[data-product-id]');
      const overId = target?.getAttribute('data-product-id');
      if (overId) {
        dragOverIdRef.current = overId;
        setDragOverId(overId);
      }
    }

    function endDrag() {
      if (!dragStateRef.current.active) return;
      const fromId = dragStateRef.current.productId;
      const toId = dragOverIdRef.current;
      dragStateRef.current = { active: false, productId: null };
      setDraggingId(null);
      setDragOverId(null);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
      if (fromId && toId && fromId !== toId) {
        onReorder(fromId, toId);
      }
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
  }

  return (
    <div style={styles.grid}>
      {orderedProducts.map((p) => {
        const stock = typeof p.stock === 'number' ? p.stock : null;
        const isDragging = draggingId === p.id;
        const isDropTarget = dragOverId === p.id && draggingId !== p.id;
        return (
          <div
            key={p.id}
            data-product-id={p.id}
            style={{
              position: 'relative',
              opacity: isDragging ? 0.55 : 1,
              transform: isDragging ? 'scale(0.98)' : 'none',
              outline: isDropTarget ? `3px dashed ${ui.ink}` : 'none',
              outlineOffset: 3,
              borderRadius: 14,
              transition: isDragging ? 'none' : 'transform 0.15s ease, opacity 0.15s ease',
            }}
          >
            <button
              type="button"
              aria-label="拖曳調整排序"
              onPointerDown={(e) => beginDrag(e, p.id)}
              style={{
                position: 'absolute',
                top: -6,
                right: -6,
                zIndex: 2,
                width: 44,
                height: 44,
                borderRadius: 999,
                border: border.solidSm,
                background: ui.apricot,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'grab',
                touchAction: 'none',
                color: ui.ink,
                boxShadow: shadow.sm,
              }}
            >
              <GripVertical size={16} />
            </button>
            <div onClick={() => onEdit(p)} style={{ cursor: 'pointer' }}>
              <ProductCard
                product={{
                  ...p,
                  stock,
                  categoryIds: p.categoryIds ?? [],
                  isNew: p.isNew,
                  imageUrl: p.imageUrl ?? null,
                  archived: p.archived,
                }}
                cartQty={0}
                onClick={() => onEdit(p)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminProducts({ products = [], refreshProducts }) {
  const [categories, setCategories] = useState([]);
  const [bonusRules, setBonusRules] = useState([]);
  const [ruleProducts, setRuleProducts] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [events, setEvents] = useState([]);
  const [showArchivedEvents, setShowArchivedEvents] = useState(false);
  const [adminTab, setAdminTab] = useState('products');
  const [eventDraft, setEventDraft] = useState(null);
  const [paymentDraft, setPaymentDraft] = useState(null);
  const [bonusDraft, setBonusDraft] = useState(null);

  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [activeProductId, setActiveProductId] = useState(null);
  const [draft, setDraft] = useState(null);

  const toast = useToast();

  const filteredProducts = useMemo(() => {
    const q = search.trim();
    return products.filter((p) => {
      if (!showArchived && p.archived) return false;
      if (showArchived && !p.archived) return false;
      if (!q) return true;
      return (p.name ?? '').includes(q);
    });
  }, [products, search, showArchived]);

  const orderedProducts = useMemo(
    () => [...filteredProducts].sort(compareProductSortOrder),
    [filteredProducts],
  );

  const activeProductsForRules = useMemo(() => {
    const source = ruleProducts.length > 0 ? ruleProducts : products;
    return source
      .filter((p) => !isArchivedProduct(p) && (p.type ?? 'single') === 'single')
      .slice()
      .sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')));
  }, [ruleProducts, products]);

  async function loadAll() {
    const [cats, rules, allProducts, pms, evts] = await Promise.all([
      db.categories.orderBy('sortOrder').toArray(),
      db.bonusRules.orderBy('sortOrder').toArray(),
      db.products.toArray(),
      db.paymentMethods.orderBy('sortOrder').toArray(),
      db.events.orderBy('createdAt').toArray(),
    ]);
    setCategories(cats);
    setBonusRules(rules);
    setRuleProducts(allProducts.filter((p) => !isArchivedProduct(p)));
    setPaymentMethods(pms);
    setEvents(evts);
  }

  async function reorderProducts(fromId, toId) {
    const list = [...orderedProducts];
    const fromIdx = list.findIndex((p) => p.id === fromId);
    const toIdx = list.findIndex((p) => p.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;

    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);

    await Promise.all(
      list.map((product, order) => db.products.update(product.id, { sortOrder: order })),
    );
    await refreshProducts?.();
    await loadAll();
  }

  async function clearAllDataAndToast() {
    const confirmMessages = [
      '確定清空所有數據？',
      '你真的要確定喔？',
      '你有問過歌姬了嗎？',
      '真的確定歌姬說可以刪掉了嗎？',
      '你現在還有住手的機會，最後一次！',
    ];
    const allConfirmed = confirmMessages.every((message) => window.confirm(message));
    if (!allConfirmed) return;

    await db.transaction('rw', [
      db.events, db.categories, db.products,
      db.bonusRules, db.paymentMethods, db.preOrders, db.transactions,
    ], async () => {
      await Promise.all([
        db.events.clear(),
        db.categories.clear(),
        db.products.clear(),
        db.bonusRules.clear(),
        db.paymentMethods.clear(),
        db.preOrders.clear(),
        db.transactions.clear(),
      ]);
    });

    await ensureSeedData();
    toast.show(getString('A6'));
    await refreshProducts?.();
    await loadAll();
  }

  useEffect(() => {
    Promise.resolve(refreshProducts?.())
      .catch((e) => console.error(e))
      .finally(() => loadAll().catch((e) => console.error(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startNew() {
    setActiveProductId(null);
    setDraft({
      id: createUUID(),
      name: '',
      price: 0,
      stock: null,
      categoryIds: [],
      color: COLOR_PRESETS[0],
      imageUrl: null,
      isNew: false,
      archived: false,
    });
  }

  function startEdit(product) {
    if ((product.type ?? 'single') === 'bundle') {
      // 套組的建立和編輯都在活動頁
      setAdminTab('events');
      const rule = bundleRuleForProduct(product.id);
      if (rule) startEditBonusRule(rule);
      else toast.show(t('admin.bundleEditHint'));
      return;
    }
    setActiveProductId(product.id);
    setDraft({
      id: product.id,
      name: product.name ?? '',
      price: product.price ?? 0,
      stock: typeof product.stock === 'number' ? product.stock : null,
      categoryIds: product.categoryIds ?? [],
      color: product.color ?? COLOR_PRESETS[0],
      imageUrl: product.imageUrl ?? null,
      isNew: !!product.isNew,
      archived: !!product.archived,
    });
  }

  function toggleCategory(catId) {
    setDraft((prev) => {
      if (!prev) return prev;
      const exists = prev.categoryIds.includes(catId);
      const next = exists ? prev.categoryIds.filter((id) => id !== catId) : [...prev.categoryIds, catId];
      return { ...prev, categoryIds: next };
    });
  }

  async function createCategoryFromName(name) {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const existing = categories.find((c) => c.name === trimmed);
    if (existing) return existing.id;

    const usedColors = new Set(categories.map((c) => c.color));
    const nextColor = COLOR_PRESETS.find((c) => !usedColors.has(c)) ?? COLOR_PRESETS[categories.length % COLOR_PRESETS.length];
    const cat = {
      id: createUUID(),
      name: trimmed,
      color: nextColor,
      sortOrder: categories.length + 1,
      createdAt: Date.now(),
    };
    await db.categories.add(cat);
    // 立即把新類別加到列表最後，避免要重開/重整才看到
    setCategories((prev) => [...prev, cat]);
    return cat.id;
  }

  async function deleteCategory(catId) {
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;
    const ok = window.confirm(`確定刪除類別「${cat.name}」嗎？`);
    if (!ok) return;

    await db.transaction('rw', db.categories, db.products, db.bonusRules, async () => {
      await db.categories.delete(catId);

      const allProducts = await db.products.toArray();
      const touchedProducts = allProducts.filter((p) => Array.isArray(p.categoryIds) && p.categoryIds.includes(catId));
      if (touchedProducts.length > 0) {
        await db.products.bulkPut(
          touchedProducts.map((p) => ({
            ...p,
            categoryIds: (p.categoryIds ?? []).filter((id) => id !== catId),
          })),
        );
      }

      const rules = await db.bonusRules.toArray();
      const touchedRules = rules.filter((r) => r.categoryId === catId);
      if (touchedRules.length > 0) {
        await db.bonusRules.bulkPut(
          touchedRules.map((r) => ({
            ...r,
            categoryId: null,
          })),
        );
      }
    });

    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        categoryIds: (prev.categoryIds ?? []).filter((id) => id !== catId),
      };
    });
    await refreshProducts?.();
    await loadAll();
    toast.show('類別已刪除');
  }

  async function onSave() {
    if (!draft) return;
    if (!draft.name.trim()) return;

    const existingProduct = activeProductId ? products.find((p) => p.id === activeProductId) ?? null : null;
    const isArchiving = !!activeProductId && !!draft.archived && !existingProduct?.archived;

    const stock = draft.stock === '' || draft.stock === null ? null : normalizeStockInput(draft.stock);
    const payload = {
      id: draft.id,
      name: draft.name.trim(),
      price: Math.max(0, parseInt(draft.price, 10) || 0),
      stock,
      categoryIds: draft.categoryIds ?? [],
      color: draft.color || COLOR_PRESETS[0],
      imageUrl: draft.imageUrl ?? null,
      isNew: !!draft.isNew,
      archived: !!draft.archived,
    };

    if (activeProductId) {
      await db.products.update(activeProductId, payload);
    } else {
      await db.products.add(payload);
    }

    setDraft(null);
    setActiveProductId(null);
    await refreshProducts?.();
    await loadAll();

    toast.show(isArchiving ? '封存商品成功✅！' : '商品新增成功！✅');
  }

  // ─── 活動（滿額禮／合購折扣／套組活動） ─────────────────────
  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  function bundleRuleForProduct(productId) {
    return bonusRules.find((r) => r.triggerType === 'bundle' && r.productId === productId) ?? null;
  }

  function emptyActivityDraft(kind) {
    const nextSortOrder = (bonusRules.at(-1)?.sortOrder ?? 0) + 1;
    const base = { id: createUUID(), kind, isExisting: false, name: '', enabled: true, exclusiveGroup: '', sortOrder: nextSortOrder };
    if (kind === 'combo') {
      return { ...base, slots: [makeEmptySlot('qty')], rewardType: 'price', comboPrice: 0, bonusText: '' };
    }
    if (kind === 'bundle') {
      return {
        ...base,
        bundle: {
          productId: createUUID(), price: 0, stock: null, categoryIds: [],
          color: COLOR_PRESETS[0], imageUrl: null, bundleSlots: [makeEmptySlot('pickQty')],
        },
      };
    }
    return { ...base, categoryId: null, triggerAmount: 0, bonusText: '' };
  }

  function startNewBonusRule(kind = 'amount') {
    setBonusDraft(emptyActivityDraft(kind));
  }

  function changeActivityKind(kind) {
    setBonusDraft((prev) => {
      if (!prev || prev.isExisting || prev.kind === kind) return prev;
      return { ...emptyActivityDraft(kind), id: prev.id, name: prev.name, sortOrder: prev.sortOrder };
    });
  }

  function startEditBonusRule(rule) {
    const kind = rule.triggerType === 'bundle' ? 'bundle' : rule.triggerType === 'combo' ? 'combo' : 'amount';
    const base = {
      id: rule.id, kind, isExisting: true,
      name: rule.name ?? '', enabled: rule.enabled !== false,
      exclusiveGroup: rule.exclusiveGroup ?? '', sortOrder: rule.sortOrder ?? 9999,
    };
    if (kind === 'combo') {
      setBonusDraft({
        ...base,
        slots: (rule.slots ?? []).map((s) => ({ ...s })),
        rewardType: rule.rewardType === 'price' ? 'price' : 'gift',
        comboPrice: rule.comboPrice ?? 0,
        bonusText: rule.bonusText ?? '',
      });
      return;
    }
    if (kind === 'bundle') {
      const product = productsById.get(rule.productId) ?? null;
      setBonusDraft({
        ...base,
        name: product?.name ?? rule.name ?? '',
        bundle: {
          productId: rule.productId,
          price: product?.price ?? 0,
          stock: typeof product?.stock === 'number' ? product.stock : null,
          categoryIds: product?.categoryIds ?? [],
          color: product?.color ?? COLOR_PRESETS[0],
          imageUrl: product?.imageUrl ?? null,
          bundleSlots: (product?.bundleSlots ?? []).map((s) => ({ ...s })),
        },
      });
      return;
    }
    setBonusDraft({
      ...base,
      categoryId: rule.categoryId ?? null,
      triggerAmount: rule.triggerAmount ?? 0,
      bonusText: rule.bonusText ?? '',
    });
  }

  function slotsValid(slots, qtyKey) {
    return Array.isArray(slots) && slots.length > 0
      && slots.every((s) => (parseInt(s[qtyKey], 10) || 0) >= 1 && Array.isArray(s.poolProductIds) && s.poolProductIds.length > 0);
  }

  const activeSingleProductIds = useMemo(
    () => new Set(products.filter((p) => !isArchivedProduct(p) && (p.type ?? 'single') === 'single').map((p) => p.id)),
    [products],
  );

  /** 內容物被封存或刪除 → 活動列表標 ⚠️ */
  function ruleHasInvalidComponents(rule) {
    const poolBad = (slots) => (slots ?? []).some((s) => (s.poolProductIds ?? []).some((id) => !activeSingleProductIds.has(id)));
    if (rule.triggerType === 'combo') return poolBad(rule.slots);
    if (rule.triggerType === 'bundle') {
      const p = productsById.get(rule.productId);
      if (!p || isArchivedProduct(p)) return true;
      return poolBad(p.bundleSlots);
    }
    return false;
  }

  function describeRule(rule) {
    if (rule.triggerType === 'bundle') {
      const p = productsById.get(rule.productId);
      const slots = (p?.bundleSlots ?? []).map((s) => `${s.label || t('bundle.contents')}×${s.pickQty ?? 1}`).join('、');
      return { typeLabel: t('admin.type.bundle'), detail: `NT$${p?.price ?? 0}・${slots || '—'}`, text: '' };
    }
    if (rule.triggerType === 'combo') {
      const slots = (rule.slots ?? []).map((s) => `${s.label || t('bundle.contents')}×${s.qty ?? 1}`).join('＋');
      const mode = rule.rewardType === 'price' ? `${t('admin.rewardPrice')} NT$${rule.comboPrice ?? 0}` : t('admin.rewardGift');
      return { typeLabel: t('admin.type.combo'), detail: `${slots || '—'}・${mode}`, text: rule.rewardType === 'price' ? '' : (rule.bonusText ?? '') };
    }
    const cat = rule.categoryId ? (categories.find((c) => c.id === rule.categoryId)?.name ?? '') : t('admin.amountAll');
    return { typeLabel: t('admin.type.amount'), detail: `${cat}・門檻 NT$${rule.triggerAmount ?? 0}`, text: rule.bonusText ?? '' };
  }

  const comboNotCheaper = useMemo(() => {
    if (!bonusDraft || bonusDraft.kind !== 'combo' || bonusDraft.rewardType !== 'price') return false;
    const min = minFillPrice(bonusDraft.slots, productsById);
    return min !== null && Number(bonusDraft.comboPrice) >= min;
  }, [bonusDraft, productsById]);

  async function saveBonusRule() {
    if (!bonusDraft) return;
    const name = String(bonusDraft.name ?? '').trim();
    if (!name) {
      toast.show(t('admin.err.name'), 'error');
      return;
    }
    const common = {
      id: bonusDraft.id,
      name,
      enabled: !!bonusDraft.enabled,
      exclusiveGroup: String(bonusDraft.exclusiveGroup ?? '').trim() || null,
      sortOrder: Number.isFinite(Number(bonusDraft.sortOrder)) ? Number(bonusDraft.sortOrder) : 9999,
    };

    if (bonusDraft.kind === 'amount') {
      if (!Number.isFinite(Number(bonusDraft.triggerAmount)) || Number(bonusDraft.triggerAmount) <= 0) {
        toast.show(t('admin.err.threshold'), 'error');
        return;
      }
      if (!String(bonusDraft.bonusText ?? '').trim()) {
        toast.show(t('admin.err.bonusText'), 'error');
        return;
      }
      await db.bonusRules.put({
        ...common,
        triggerType: 'amount',
        categoryId: bonusDraft.categoryId || null,
        triggerAmount: Math.max(0, parseInt(bonusDraft.triggerAmount, 10) || 0),
        bonusText: String(bonusDraft.bonusText).trim(),
      });
    } else if (bonusDraft.kind === 'combo') {
      const slots = (bonusDraft.slots ?? []).map((s) => ({
        id: s.id ?? createUUID(), label: String(s.label ?? '').trim(),
        qty: Math.max(1, parseInt(s.qty, 10) || 1), poolProductIds: [...new Set(s.poolProductIds ?? [])],
      }));
      if (!slotsValid(slots, 'qty')) {
        toast.show(t('admin.err.slots'), 'error');
        return;
      }
      const isPrice = bonusDraft.rewardType === 'price';
      const totalQty = slots.reduce((s, x) => s + x.qty, 0);
      if (isPrice && totalQty < 2) {
        toast.show(t('admin.err.comboQty'), 'error');
        return;
      }
      const comboPrice = Math.max(0, parseInt(bonusDraft.comboPrice, 10) || 0);
      if (isPrice && (!Number.isFinite(Number(bonusDraft.comboPrice)) || Number(bonusDraft.comboPrice) < 0)) {
        toast.show(t('admin.err.comboPrice'), 'error');
        return;
      }
      if (!isPrice && !String(bonusDraft.bonusText ?? '').trim()) {
        toast.show(t('admin.err.bonusText'), 'error');
        return;
      }
      await db.bonusRules.put({
        ...common,
        triggerType: 'combo',
        slots,
        rewardType: isPrice ? 'price' : 'gift',
        comboPrice: isPrice ? comboPrice : null,
        bonusText: String(bonusDraft.bonusText ?? '').trim(),
      });
    } else if (bonusDraft.kind === 'bundle') {
      const b = bonusDraft.bundle;
      const price = parseInt(b.price, 10);
      if (!Number.isFinite(price) || price < 0) {
        toast.show(t('admin.err.bundlePrice'), 'error');
        return;
      }
      const bundleSlots = (b.bundleSlots ?? []).map((s) => ({
        id: s.id ?? createUUID(), label: String(s.label ?? '').trim(),
        pickQty: Math.max(1, parseInt(s.pickQty, 10) || 1),
        poolProductIds: [...new Set(s.poolProductIds ?? [])].filter((id) => activeSingleProductIds.has(id) || productsById.has(id)),
        allowDuplicate: s.allowDuplicate !== false,
      }));
      if (!slotsValid(bundleSlots, 'pickQty')) {
        toast.show(t('admin.err.slots'), 'error');
        return;
      }
      // 套組商品與活動規則包在同一個 transaction
      await db.transaction('rw', db.products, db.bonusRules, async () => {
        const existing = await db.products.get(b.productId);
        await db.products.put({
          ...(existing ?? { isNew: false, archived: false }),
          id: b.productId,
          name,
          price,
          stock: b.stock === '' || b.stock === null ? null : normalizeStockInput(b.stock),
          categoryIds: b.categoryIds ?? [],
          color: b.color || COLOR_PRESETS[0],
          imageUrl: b.imageUrl ?? null,
          type: 'bundle',
          bundleSlots,
        });
        await db.bonusRules.put({
          ...common,
          exclusiveGroup: null,
          triggerType: 'bundle',
          productId: b.productId,
        });
      });
    }

    setBonusDraft(null);
    await refreshProducts?.();
    await loadAll();
    toast.show(t('admin.activitySaved'), 'success');
  }

  async function deleteBonusRule(rule) {
    if (rule.triggerType === 'bundle') {
      if (!window.confirm(t('admin.bundleDeleteConfirm1'))) return;
      if (!window.confirm(t('admin.bundleDeleteConfirm2'))) return;
      const txs = await db.transactions.toArray();
      const hasHistory = txs.some((tx) => (tx.items ?? []).some((it) => it.productId === rule.productId));
      await db.transaction('rw', db.products, db.bonusRules, async () => {
        if (hasHistory) {
          // 有歷史交易：改成封存，不刪除（報表還對得到名稱）
          await db.products.update(rule.productId, { archived: true });
          await db.bonusRules.update(rule.id, { enabled: false });
        } else {
          await db.products.delete(rule.productId);
          await db.bonusRules.delete(rule.id);
        }
      });
      await refreshProducts?.();
      await loadAll();
      toast.show(hasHistory ? t('admin.bundleArchivedInstead') : t('admin.activityDeleted'));
      return;
    }
    if (!window.confirm(t('admin.activityDeleteConfirm'))) return;
    await db.bonusRules.delete(rule.id);
    await loadAll();
    toast.show(t('admin.activityDeleted'));
  }

  function startNewPaymentMethod() {
    setPaymentDraft({
      id: createUUID(),
      name: '',
      isCash: false,
      enabled: true,
      isDefault: false,
      sortOrder: (paymentMethods.at(-1)?.sortOrder ?? 0) + 1,
    });
  }

  function startEditPaymentMethod(pm) {
    setPaymentDraft({ ...pm });
  }

  async function savePaymentMethod() {
    if (!paymentDraft) return;
    const name = String(paymentDraft.name ?? '').trim();
    if (!name) return;
    const payload = {
      ...paymentDraft,
      name,
      isCash: !!paymentDraft.isCash,
      enabled: !!paymentDraft.enabled,
      isDefault: !!paymentDraft.isDefault,
      sortOrder: Number.isFinite(Number(paymentDraft.sortOrder)) ? Number(paymentDraft.sortOrder) : 9999,
    };
    await db.paymentMethods.put(payload);
    setPaymentDraft(null);
    await loadAll();
    toast.show('付款方式已儲存');
  }

  async function deletePaymentMethod(id) {
    const ok = window.confirm('確定刪除此付款方式嗎？');
    if (!ok) return;
    await db.paymentMethods.delete(id);
    await loadAll();
  }

  function formatEventDisplayName(name, date) {
    const cleanName = String(name ?? '').trim();
    const d = String(date ?? '').trim();
    if (!cleanName || !d) return '';
    const compact = d.replace(/-/g, '');
    const yymmdd = compact.length === 8 ? compact.slice(2) : compact;
    return `${cleanName}_${yymmdd}`;
  }

  function startNewEvent() {
    setEventDraft({
      id: null,
      name: '',
      date: '',
    });
  }

  function startEditEvent(evt) {
    const rawName = String(evt.name ?? '').includes('_')
      ? String(evt.name).split('_').slice(0, -1).join('_')
      : String(evt.name ?? '');
    setEventDraft({
      id: evt.id,
      name: rawName,
      date: evt.date ?? '',
    });
  }

  async function saveEvent() {
    if (!eventDraft) return;
    const displayName = formatEventDisplayName(eventDraft.name, eventDraft.date);
    if (!displayName || !eventDraft.date) return;

    if (eventDraft.id) {
      await db.events.update(eventDraft.id, { name: displayName, date: eventDraft.date });
      toast.show('場次已更新');
    } else {
      await db.events.add({
        id: createUUID(),
        name: displayName,
        date: eventDraft.date,
        status: 'inactive',
        archived: false,
        createdAt: Date.now(),
      });
      toast.show('場次已新增');
    }

    setEventDraft(null);
    await loadAll();
  }

  async function setActiveEvent(eventId) {
    const allEvents = await db.events.toArray();
    await Promise.all(
      allEvents.map((e) =>
        db.events.update(e.id, {
          status: !e.archived && e.id === eventId ? 'active' : 'inactive',
        }),
      ),
    );
    await loadAll();
    toast.show('已切換場次');
  }

  async function archiveEvent(eventId) {
    const target = events.find((e) => e.id === eventId);
    if (!target) return;
    const ok = window.confirm(`確定封存場次「${target.name}」？`);
    if (!ok) return;

    await db.events.update(eventId, { archived: true, status: 'inactive' });
    const allEvents = await db.events.toArray();
    const activeNonArchived = allEvents.find((e) => e.status === 'active' && !e.archived);
    if (!activeNonArchived) {
      const fallback = [...allEvents]
        .filter((e) => !e.archived)
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))[0];
      if (fallback) await db.events.update(fallback.id, { status: 'active' });
    }
    await loadAll();
    toast.show('場次已封存');
  }

  function downloadTemplate() {
    const header = ['name', 'price', 'stock', 'categories', 'color', 'isNew', 'imageUrl', 'archived'];
    const example = [
      '範例商品1,100,10,類別A,#E8B4B0,false,,false',
      '範例商品2,300,5,類別A;類別B,#8EBFAD,true,,false',
      '範例商品3,500,,類別B,#C9A8F5,false,,false',
    ];
    const csv = [header.join(','), ...example].join('\n');
    const blob = new Blob([withBom(csv)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importProducts(file) {
    const { text, encoding } = await readCsvFileWithEncoding(file);
    const parsed = parseCleanCsv(text);
    const rows = parsed.rows;
    const missingHeaders = hasRequiredFields(parsed.fields, [['name'], ['price']]);
    if (parsed.errors.length > 0 || missingHeaders.length > 0) {
      const headerMessage = missingHeaders.length > 0 ? `缺少必要欄位: ${missingHeaders.join(', ')}` : '';
      const parseMessage = parsed.errors[0]?.message ? `CSV 結構錯誤: ${parsed.errors[0].message}` : '';
      const msg = buildCsvParseError('商品 CSV 解析失敗', [headerMessage, parseMessage]);
      toast.show(msg);
      return;
    }

    const importErrors = [];
    const normalizeName = (v) => String(v ?? '').replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim();

    const existingCats = await db.categories.toArray();
    const existingProducts = await db.products.toArray();
    const catByName = new Map(existingCats.map((c) => [c.name, c]));
    const productByName = new Map(existingProducts.map((p) => [normalizeName(p.name), p]));
    const createdCatIds = [];
    const upsertProducts = [];
    let updatedCount = 0;
    let createdCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] ?? {};
      const line = i + 2;
      const name = pickField(r, ['name']);
      const normalizedName = normalizeName(name);
      const price = parseInt(pickField(r, ['price']), 10);
      if (!normalizedName) {
        importErrors.push(`第 ${line} 行：name 為空`);
        continue;
      }
      if (!Number.isFinite(price) || price < 0) {
        importErrors.push(`第 ${line} 行：price 不正確`);
        continue;
      }

      const stockRaw = pickField(r, ['stock']);
      const stock = stockRaw === '' ? null : normalizeStockInput(stockRaw);

      const categoryNames = pickField(r, ['categories', 'category'])
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean);
      const categoryIds = [];
      for (const cn of categoryNames) {
        const ex = catByName.get(cn);
        if (ex) {
          categoryIds.push(ex.id);
        } else {
          const usedColors = new Set(existingCats.map((c) => c.color));
          const nextColor = COLOR_PRESETS.find((c) => !usedColors.has(c)) ?? COLOR_PRESETS[createdCatIds.length % COLOR_PRESETS.length];
          const cat = {
            id: createUUID(),
            name: cn,
            color: nextColor,
            sortOrder: (existingCats.length + createdCatIds.length) + 1,
            createdAt: Date.now(),
          };
          await db.categories.add(cat);
          catByName.set(cn, cat);
          createdCatIds.push(cat.id);
          categoryIds.push(cat.id);
        }
      }

      const existing = productByName.get(normalizedName) ?? null;
      const color = pickField(r, ['color']) || existing?.color || COLOR_PRESETS[0];
      const imageUrl = pickField(r, ['imageUrl']) || existing?.imageUrl || null;
      const isNew = pickField(r, ['isNew']) === '' ? !!existing?.isNew : parseBool(pickField(r, ['isNew']));
      const archived = pickField(r, ['archived']) === '' ? !!existing?.archived : parseBool(pickField(r, ['archived']));

      const payload = {
        // 保留既有商品的其他欄位（sortOrder、type、bundleSlots…），CSV 只覆蓋它有的欄位
        ...(existing ?? { type: 'single' }),
        id: existing?.id || (crypto?.randomUUID ? crypto.randomUUID() : createUUID()),
        name: normalizedName,
        price: parseInt(String(price), 10),
        stock,
        categoryIds,
        color,
        imageUrl,
        isNew,
        archived,
      };
      upsertProducts.push(payload);
      if (existing) updatedCount += 1;
      else createdCount += 1;
    }

    if (upsertProducts.length > 0) {
      await db.products.bulkPut(upsertProducts);
    }
    await refreshProducts?.();
    await loadAll();

    if (importErrors.length > 0) {
      toast.show(`匯入完成（新增 ${createdCount}、更新 ${updatedCount}；編碼: ${encoding}），但有錯誤：${importErrors[0]}`);
      return;
    }
    toast.show(`匯入完成（新增 ${createdCount}、更新 ${updatedCount}；編碼: ${encoding}）`);
  }

  return (
    <div style={styles.page}>
      {/* ── Admin Tab Bar ── */}
      <div style={{ padding: '0 6px 0 0' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: ui.muted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
          {t('admin.pageLabel')}
        </div>
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '0 0 12px',
            marginBottom: 12,
          }}
        >
          {[
            { id: 'products', label: t('admin.tab.products') },
            { id: 'events',   label: t('admin.tab.events') },
            { id: 'system',   label: t('admin.tab.system') },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setAdminTab(tab.id)}
              style={{ ...styles.chip(adminTab === tab.id), flex: 1, minHeight: 40 }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {adminTab === 'products' && (
      <div style={{ padding: 14 }}>
        <SectionHeader
          title={t('admin.title')}
          subtitle={`${showArchived ? t('admin.showArchivedLabel') : t('admin.showSellingLabel')} · ${filteredProducts.length} 件`}
          action={(
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end', padding: '0 4px 4px 0' }}>
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                style={{ ...styles.chip(showArchived), minHeight: 44 }}
              >
                {showArchived ? t('admin.showSellingToggle') : t('admin.showArchivedToggle')}
              </button>
              <Button variant="primary" size="md" onClick={startNew}>
                {t('admin.newProduct')}
              </Button>
            </div>
          )}
        />

        <div style={{ marginTop: 14, display: 'flex', gap: 16 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('admin.searchPlaceholder')}
            style={styles.input}
          />
        </div>
      </div>
      )}

      {adminTab === 'events' && (
      <div style={{ padding: 14 }}>
        <div style={styles.formCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <div>
              <div style={styles.h2}>{t('admin.eventsTitle')}</div>
            <div style={styles.h2Bar} />
              <div style={{ color: ui.muted, fontWeight: 600, fontSize: 12, marginTop: 6 }}>
                {t('admin.eventsSubtitle')}
              </div>
            </div>
            <button
              type="button"
              onClick={startNewEvent}
              style={styles.btnPrimary}
            >
              {t('admin.newEvent')}
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button
              type="button"
              onClick={() => setShowArchivedEvents((v) => !v)}
              style={styles.chip(showArchivedEvents)}
            >
              {showArchivedEvents ? t('admin.hideArchivedEvents') : t('admin.showArchivedEvents')}
            </button>
          </div>
          <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
            {events
              .filter((evt) => (showArchivedEvents ? !!evt.archived : !evt.archived))
              .map((evt) => (
              <div key={evt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', ...styles.rowCard }}>
                <div>
                  <div style={{ fontWeight: 800, color: ui.ink }}>{evt.name}</div>
                  <div style={{ fontWeight: 700, color: ui.muted, fontSize: 12 }}>{evt.date}{evt.archived ? ` · ${t('common.archive')}` : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => startEditEvent(evt)}
                    style={styles.btnSmall}
                  >
                    {t('common.edit')}
                  </button>
                  {!evt.archived ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setActiveEvent(evt.id).catch((e) => console.error(e))}
                        style={{
                          ...styles.btnSmall,
                          background: evt.status === 'active' ? ui.orange : ui.white,
                        }}
                      >
                        {evt.status === 'active' ? t('admin.eventActive') : t('admin.eventSetActive')}
                      </button>
                      <button
                        type="button"
                        onClick={() => archiveEvent(evt.id).catch((e) => console.error(e))}
                        style={styles.btnSmallDanger}
                      >
                        {t('common.archive')}
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
            {events.filter((evt) => (showArchivedEvents ? !!evt.archived : !evt.archived)).length === 0
              ? <EmptyState icon="📅" title={showArchivedEvents ? t('admin.noArchivedEvents') : t('admin.noEvents')} />
              : null}
          </div>

          {eventDraft ? (
            <div style={{ marginTop: 20, paddingTop: 16, width: '100%', minWidth: 0 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>{eventDraft.id ? t('admin.eventEdit') : t('admin.eventNew')}</div>
              <input
                value={eventDraft.name}
                onChange={(e) => setEventDraft((prev) => ({ ...prev, name: e.target.value }))}
                style={styles.input}
                placeholder={t('admin.eventNamePlaceholder')}
              />
              <input
                type="date"
                value={eventDraft.date}
                onChange={(e) => setEventDraft((prev) => ({ ...prev, date: e.target.value }))}
                style={{ ...styles.input, marginTop: 10 }}
              />
              <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                <button type="button" onClick={() => setEventDraft(null)} style={styles.btnSecondary}>
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => saveEvent().catch((e) => console.error(e))}
                  style={styles.btnPrimary}
                >
                  {t('admin.eventSave')}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      )}

      {adminTab === 'products' && (
      <div style={{ padding: 14 }}>
        <div style={{ color: ui.muted, fontWeight: 600, fontSize: 12, marginTop: 6, lineHeight: 1.5, textAlign: 'right' }}>
          {t('admin.dragHint')}
        </div>
        <DraggableProductGrid
          orderedProducts={orderedProducts}
          onEdit={startEdit}
          onReorder={(fromId, toId) => reorderProducts(fromId, toId).catch((err) => console.error(err))}
        />

        {filteredProducts.length === 0 ? (
          <div style={{ padding: 20, color: ui.muted, fontWeight: 800 }}>{t('admin.noProducts')}</div>
        ) : null}
      </div>
      )}

      {/* Form */}
      {draft ? (
        <div style={styles.overlay}>
          <div style={styles.sheet}>
            {/* 復古視窗標題列：杏色色帶＋黑色底線＋右側關閉鈕 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, margin: '-20px -20px 0', padding: '10px 14px 10px 20px', ...surface.titleBar }}>
              <div style={{ fontWeight: 800, fontSize: 17 }}>{activeProductId ? t('admin.editTitle') : t('admin.addTitle')}</div>
              <Button variant="secondary" size="sm" onClick={() => setDraft(null)} aria-label={t('admin.form.cancel')}>
                ✕
              </Button>
            </div>

            <div style={{ ...styles.formCard, marginTop: 16 }}>
              <div style={styles.label}>{t('admin.photoSection')}</div>

              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div
                  style={{
                    width: 110,
                    height: 110,
                    borderRadius: 10,
                    border: border.solidSm,
                    overflow: 'hidden',
                    backgroundColor: draft.color || ui.mint,
                    boxShadow: shadow.sm,
                    position: 'relative',
                    flexShrink: 0,
                  }}
                >
                  {draft.imageUrl ? (
                    <img src={draft.imageUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: ui.muted }}>
                      {t('admin.tapUpload')}
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const check = validateImageFile(file);
                      if (!check.ok) {
                        window.alert(check.reason);
                        return;
                      }
                      const dataUrl = await fileToDataUrl(file, { maxDimension: 1024, quality: 0.85, outputMime: 'image/jpeg' });
                      setDraft((prev) => ({ ...prev, imageUrl: dataUrl }));
                    }}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '0 4px 4px 0' }}>
                    <button
                      type="button"
                      onClick={() => setDraft((prev) => ({ ...prev, imageUrl: null }))}
                      disabled={!draft.imageUrl}
                      style={draft.imageUrl ? styles.btnDanger : { ...styles.btnBase, ...buttonVariants.disabled }}
                    >
                      {t('admin.deleteImage')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraft((prev) => ({ ...prev, color: COLOR_PRESETS[0] }))}
                      style={styles.btnSecondary}
                    >
                      {t('admin.deleteColor')}
                    </button>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div style={styles.label}>{t('admin.colorLabel')}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '2px 4px 4px 2px' }}>
                      {COLOR_PRESETS.map((c) => (
                        <div key={c} style={styles.swatch(draft.color === c, c)} onClick={() => setDraft((prev) => ({ ...prev, color: c }))} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ ...styles.formCard, marginTop: 12 }}>
              <div style={styles.label}>{t('admin.nameLabel')}</div>
              <input value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} style={styles.input} />

              <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={styles.label}>{t('admin.priceLabel')}</div>
                  <input
                    value={draft.price}
                    onChange={(e) => setDraft((prev) => ({ ...prev, price: e.target.value }))}
                    type="number"
                    min={0}
                    style={styles.input}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={styles.label}>{t('admin.stockLabel')}</div>
                  <input
                    value={draft.stock === null ? '' : draft.stock}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDraft((prev) => ({ ...prev, stock: v === '' ? null : parseInt(v, 10) }));
                    }}
                    type="number"
                    min={0}
                    style={styles.input}
                    placeholder="（留空不限）"
                  />
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={styles.label}>{t('admin.categoryLabel')}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '0 4px 4px 0' }}>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCategory(c.id)}
                      style={styles.chip(draft.categoryIds.includes(c.id))}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>

                <AddCategoryBox
                  categories={categories}
                  onCreated={async (name) => {
                    const id = await createCategoryFromName(name);
                    if (!id) return;
                    setDraft((prev) => ({ ...prev, categoryIds: Array.from(new Set([...(prev.categoryIds ?? []), id])) }));
                  }}
                  onDeleted={(catId) => deleteCategory(catId).catch((e) => console.error(e))}
                />
              </div>

              <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, fontWeight: 800 }}>
                  <input
                    type="checkbox"
                    checked={draft.isNew}
                    onChange={(e) => setDraft((prev) => ({ ...prev, isNew: e.target.checked }))}
                  />
                    {t('admin.newBadgeLabel')}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, fontWeight: 800 }}>
                  <input
                    type="checkbox"
                    checked={draft.archived}
                    onChange={(e) => setDraft((prev) => ({ ...prev, archived: e.target.checked }))}
                  />
                    {t('admin.archivedLabel')}
                </label>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 16, padding: '0 6px 6px 0' }}>
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  style={{ ...styles.btnSecondary, flex: 1 }}
                >
                  {t('admin.form.cancel')}
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  style={{ ...styles.btnPrimary, flex: 1, fontSize: 16, fontWeight: 800, boxShadow: shadow.md }}
                >
                  {t('admin.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* CSV import (right below list) */}
      {adminTab === 'products' && !draft ? (
        <div style={{ padding: 14 }}>
          <div style={{ ...styles.formCard, marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
              <div>
                <div style={styles.h2}>{t('admin.csv.title')}</div>
            <div style={styles.h2Bar} />
                <div style={{ color: ui.muted, fontWeight: 600, fontSize: 12, marginTop: 6 }}>
                  {t('admin.csv.subtitle')}
                </div>
              </div>
              <button
                type="button"
                onClick={downloadTemplate}
                style={styles.btnSecondary}
              >
                {t('admin.csv.template')}
              </button>
            </div>

            <div style={{ marginTop: 10 }}>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  importProducts(f).catch((err) => {
                    console.error(err);
                    toast.show(`商品 CSV 解析失敗：${err instanceof Error ? err.message : '未知錯誤'}`);
                  });
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* 活動設定：滿額禮／合購折扣／套組活動 */}
      {adminTab === 'events' && !draft ? (
        <div style={{ padding: 14 }}>
          <div style={{ ...styles.formCard, marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px' }}>
                <div style={styles.h2}>{t('admin.activityTitle')}</div>
                <div style={styles.h2Bar} />
                <div style={{ ...styles.caption, lineHeight: 1.5 }}>{t('admin.activitySubtitle')}</div>
              </div>
              <button type="button" onClick={() => startNewBonusRule('amount')} style={styles.btnPrimary}>
                {t('admin.newActivity')}
              </button>
            </div>

            <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
              {bonusRules.map((r) => {
                const info = describeRule(r);
                const invalid = ruleHasInvalidComponents(r);
                return (
                  <div key={r.id} style={{ ...styles.rowCard, opacity: r.enabled === false ? 0.6 : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={styles.typeBadge}>{info.typeLabel}</span>
                          <span style={{ fontWeight: 800 }}>{r.name}</span>
                          {r.enabled === false ? <span style={styles.caption}>（停用）</span> : null}
                          {invalid ? <span style={{ ...styles.typeBadge, background: ui.apricot }}>{t('admin.invalidComponents')}</span> : null}
                        </div>
                        <div style={{ ...styles.caption, marginTop: 4 }}>{info.detail}</div>
                        {info.text ? <div style={{ fontWeight: 700, fontSize: 12, marginTop: 4 }}>{info.text}</div> : null}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" style={styles.btnSmall} onClick={() => startEditBonusRule(r)}>
                          {t('common.edit')}
                        </button>
                        <button type="button" style={styles.btnSmallDanger} onClick={() => deleteBonusRule(r).catch((e) => { console.error(e); toast.show(t('admin.err.saveFailed'), 'error'); })}>
                          {t('common.delete')}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {bonusRules.length === 0
                ? <EmptyState icon="🎁" title={t('admin.noActivities')} subtitle={t('admin.noActivitiesHint')} />
                : null}
            </div>

            {bonusDraft ? (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: `2px solid ${ui.ink}`, width: '100%', minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 10 }}>{t('admin.editActivity')}</div>

                <div style={styles.label}>{t('admin.activityType')}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '0 4px 4px 0' }}>
                  {['amount', 'combo', 'bundle'].map((k) => (
                    <button
                      key={k}
                      type="button"
                      style={{ ...styles.chip(bonusDraft.kind === k), opacity: bonusDraft.isExisting && bonusDraft.kind !== k ? 0.4 : 1 }}
                      disabled={bonusDraft.isExisting && bonusDraft.kind !== k}
                      onClick={() => changeActivityKind(k)}
                    >
                      {t(`admin.type.${k}`)}
                    </button>
                  ))}
                </div>

                <div style={{ marginTop: 12 }}>
                  <div style={styles.label}>{bonusDraft.kind === 'bundle' ? t('admin.bundleName') : t('admin.activityName')}</div>
                  <input
                    value={bonusDraft.name}
                    onChange={(e) => setBonusDraft((prev) => ({ ...prev, name: e.target.value }))}
                    style={styles.input}
                  />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, marginTop: 10 }}>
                  <input
                    type="checkbox"
                    checked={!!bonusDraft.enabled}
                    onChange={(e) => setBonusDraft((prev) => ({ ...prev, enabled: e.target.checked }))}
                  />
                  {t('admin.enabled')}
                </label>

                {bonusDraft.kind === 'amount' ? (
                  <>
                    <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                      <div style={{ flex: '1 1 160px' }}>
                        <div style={styles.label}>{t('admin.amountCategory')}</div>
                        <select
                          value={bonusDraft.categoryId ?? ''}
                          onChange={(e) => setBonusDraft((prev) => ({ ...prev, categoryId: e.target.value || null }))}
                          style={styles.input}
                        >
                          <option value="">{t('admin.amountAll')}</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ flex: '1 1 140px' }}>
                        <div style={styles.label}>{t('admin.amountThreshold')}</div>
                        <input
                          type="number"
                          min={1}
                          value={bonusDraft.triggerAmount}
                          onChange={(e) => setBonusDraft((prev) => ({ ...prev, triggerAmount: e.target.value }))}
                          style={styles.input}
                        />
                      </div>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <div style={styles.label}>{t('admin.exclusiveGroup')}</div>
                      <input
                        value={bonusDraft.exclusiveGroup}
                        onChange={(e) => setBonusDraft((prev) => ({ ...prev, exclusiveGroup: e.target.value }))}
                        style={styles.input}
                      />
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <div style={styles.label}>{t('admin.bonusText')}</div>
                      <input
                        value={bonusDraft.bonusText}
                        onChange={(e) => setBonusDraft((prev) => ({ ...prev, bonusText: e.target.value }))}
                        style={styles.input}
                      />
                    </div>
                  </>
                ) : null}

                {bonusDraft.kind === 'combo' ? (
                  <>
                    <div style={{ marginTop: 12 }}>
                      <div style={styles.label}>{t('admin.comboContents')}</div>
                      <SlotEditor
                        slots={bonusDraft.slots}
                        onChange={(slots) => setBonusDraft((prev) => ({ ...prev, slots }))}
                        products={activeProductsForRules}
                        categories={categories}
                        qtyKey="qty"
                      />
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <div style={styles.label}>{t('admin.rewardType')}</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '0 4px 4px 0' }}>
                        {[['price', t('admin.rewardPrice')], ['gift', t('admin.rewardGift')]].map(([v, label]) => (
                          <button key={v} type="button" style={styles.chip(bonusDraft.rewardType === v)} onClick={() => setBonusDraft((prev) => ({ ...prev, rewardType: v }))}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {bonusDraft.rewardType === 'price' ? (
                      <div style={{ marginTop: 12 }}>
                        <div style={styles.label}>{t('admin.comboPrice')}</div>
                        <input
                          type="number"
                          min={0}
                          value={bonusDraft.comboPrice}
                          onChange={(e) => setBonusDraft((prev) => ({ ...prev, comboPrice: e.target.value }))}
                          style={styles.input}
                        />
                        {comboNotCheaper ? (
                          <div style={{ marginTop: 8, padding: '8px 10px', border: border.solidSm, borderRadius: 10, background: ui.apricot, fontWeight: 700, fontSize: 12 }}>
                            {t('admin.comboNotCheaper')}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div style={{ marginTop: 12 }}>
                        <div style={styles.label}>{t('admin.bonusText')}</div>
                        <input
                          value={bonusDraft.bonusText}
                          onChange={(e) => setBonusDraft((prev) => ({ ...prev, bonusText: e.target.value }))}
                          style={styles.input}
                        />
                      </div>
                    )}
                    <div style={{ marginTop: 12 }}>
                      <div style={styles.label}>{t('admin.exclusiveGroup')}</div>
                      <input
                        value={bonusDraft.exclusiveGroup}
                        onChange={(e) => setBonusDraft((prev) => ({ ...prev, exclusiveGroup: e.target.value }))}
                        style={styles.input}
                      />
                    </div>
                  </>
                ) : null}

                {bonusDraft.kind === 'bundle' ? (
                  <>
                    <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                      <div style={{ flex: '1 1 140px' }}>
                        <div style={styles.label}>{t('admin.bundlePrice')}</div>
                        <input
                          type="number"
                          min={0}
                          value={bonusDraft.bundle.price}
                          onChange={(e) => setBonusDraft((prev) => ({ ...prev, bundle: { ...prev.bundle, price: e.target.value } }))}
                          style={styles.input}
                        />
                      </div>
                      <div style={{ flex: '1 1 140px' }}>
                        <div style={styles.label}>{t('admin.bundleStock')}</div>
                        <input
                          type="number"
                          min={0}
                          value={bonusDraft.bundle.stock === null ? '' : bonusDraft.bundle.stock}
                          onChange={(e) => setBonusDraft((prev) => ({ ...prev, bundle: { ...prev.bundle, stock: e.target.value === '' ? null : parseInt(e.target.value, 10) } }))}
                          style={styles.input}
                        />
                      </div>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <div style={styles.label}>{t('admin.bundleCategory')}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 4px 4px 0' }}>
                        {categories.map((c) => {
                          const on = (bonusDraft.bundle.categoryIds ?? []).includes(c.id);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              style={styles.chip(on)}
                              onClick={() => setBonusDraft((prev) => {
                                const cur = prev.bundle.categoryIds ?? [];
                                const next = on ? cur.filter((id) => id !== c.id) : [...cur, c.id];
                                return { ...prev, bundle: { ...prev.bundle, categoryIds: next } };
                              })}
                            >
                              {c.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <div style={styles.label}>{t('admin.bundleColor')}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '2px 4px 4px 2px' }}>
                        {COLOR_PRESETS.map((c) => (
                          <div key={c} style={styles.swatch(bonusDraft.bundle.color === c, c)} onClick={() => setBonusDraft((prev) => ({ ...prev, bundle: { ...prev.bundle, color: c } }))} />
                        ))}
                      </div>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <div style={styles.label}>{t('admin.bundleContents')}</div>
                      <SlotEditor
                        slots={bonusDraft.bundle.bundleSlots}
                        onChange={(bundleSlots) => setBonusDraft((prev) => ({ ...prev, bundle: { ...prev.bundle, bundleSlots } }))}
                        products={activeProductsForRules}
                        categories={categories}
                        qtyKey="pickQty"
                      />
                    </div>
                  </>
                ) : null}

                <div style={{ display: 'flex', gap: 12, marginTop: 16, padding: '0 6px 6px 0' }}>
                  <button type="button" onClick={() => setBonusDraft(null)} style={{ ...styles.btnSecondary, flex: 1 }}>
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => saveBonusRule().catch((e) => { console.error(e); toast.show(t('admin.err.saveFailed'), 'error'); })}
                    style={{ ...styles.btnPrimary, flex: 1 }}
                  >
                    {t('admin.saveActivity')}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Payment methods + System */}
      {adminTab === 'system' && !draft ? (
        <div style={{ padding: 14 }}>
          <div style={{ ...styles.formCard, marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
              <div>
                <div style={styles.h2}>付款方式維護</div>
            <div style={styles.h2Bar} />
                <div style={{ color: ui.muted, fontWeight: 600, fontSize: 12, marginTop: 6 }}>
                  預購與販售頁共用此設定。
                </div>
              </div>
              <button
                type="button"
                onClick={startNewPaymentMethod}
                style={styles.btnPrimary}
              >
                ＋ 新增付款方式
              </button>
            </div>

            <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
              {paymentMethods.map((pm) => (
                <div key={pm.id} style={styles.rowCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{pm.name}</div>
                      <div style={{ color: ui.muted, fontWeight: 600, fontSize: 12 }}>
                        {pm.enabled ? '啟用中' : '停用'} · {pm.isCash ? '收現' : '非收現'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" style={styles.btnSmall} onClick={() => startEditPaymentMethod(pm)}>
                        編輯
                      </button>
                      <button type="button" style={styles.btnSmallDanger} onClick={() => deletePaymentMethod(pm.id).catch((e) => console.error(e))}>
                        刪除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {paymentDraft ? (
              <div style={{ marginTop: 20, paddingTop: 16 }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>編輯付款方式</div>
                <input
                  value={paymentDraft.name}
                  onChange={(e) => setPaymentDraft((prev) => ({ ...prev, name: e.target.value }))}
                  style={styles.input}
                  placeholder="付款方式名稱（例如 LINE Pay）"
                />
                <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800 }}>
                    <input
                      type="checkbox"
                      checked={!!paymentDraft.enabled}
                      onChange={(e) => setPaymentDraft((prev) => ({ ...prev, enabled: e.target.checked }))}
                    />
                    啟用
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800 }}>
                    <input
                      type="checkbox"
                      checked={!!paymentDraft.isCash}
                      onChange={(e) => setPaymentDraft((prev) => ({ ...prev, isCash: e.target.checked }))}
                    />
                    收現
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                  <button type="button" onClick={() => setPaymentDraft(null)} style={styles.btnSecondary}>
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={() => savePaymentMethod().catch((e) => console.error(e))}
                    style={styles.btnPrimary}
                  >
                    儲存付款方式
                  </button>
                </div>
              </div>
            ) : null}
          </div>

        {/* 備份/還原 */}
        <div style={{ ...styles.formCard, marginTop: 12 }}>
          <div style={styles.h2}>雲端備份</div>
            <div style={styles.h2Bar} />
          <BackupRestore />
        </div>

        <div style={{ ...styles.formCard, marginTop: 12 }}>
          <div style={styles.h2}>危險操作</div>
            <div style={styles.h2Bar} />
          <div style={{ color: ui.muted, fontWeight: 600, fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>
            此操作將會清空「這個裝置上」所有的暫存資料，按下就會全部消失喔！
            <br />
            操作前請務必確認資料都有備份好喔！
          </div>
          <button
            type="button"
            onClick={() => clearAllDataAndToast().catch((e) => console.error(e))}
            style={styles.btnDangerFilled}
          >
            ⚠ {getString('R5')}
          </button>
        </div>
        </div>
      ) : null}

      <Toast message={toast.message} visible={toast.visible} variant={toast.variant} />
    </div>
  );
}

function AddCategoryBox({ categories, onCreated, onDeleted }) {
  const [name, setName] = useState('');
  return (
    <div style={{ marginTop: 12 }}>
      <div style={styles.label}>新增類別</div>
      <div style={{ display: 'flex', gap: 16 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="輸入類別名稱"
          style={{
            ...styles.input,
            flex: 1,
          }}
        />
        <button
          type="button"
          onClick={async () => {
            const v = name.trim();
            if (!v) return;
            await onCreated(v);
            setName('');
          }}
          style={{ ...styles.btnPrimary, minWidth: 44, padding: '10px 16px', fontSize: 18 }}
        >
          ＋
        </button>
      </div>

      {categories.length > 0 ? (
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 4px 4px 0' }}>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onDeleted?.(c.id)}
              style={{ ...styles.chip(false), border: border.dashed, minHeight: 36 }}
              title={`刪除類別：${c.name}`}
            >
              {c.name} ×
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

