import { useEffect, useMemo, useState } from 'react';
import ProductCard from '../components/ProductCard.jsx';
import db, { createUUID, normalizeStockInput } from '../db.js';
import { fileToDataUrl, validateImageFile } from '../lib/image.js';
import { t } from '../i18n/t.js';
import Toast from '../components/Toast.jsx';
import { getString } from '../lib/strings.js';
import { useToast } from '../lib/useToast.js';
import { buildCsvParseError, hasRequiredFields, parseCleanCsv, pickField, readCsvFileWithEncoding, withBom } from '../lib/csvImport.js';
import { PRODUCT_COLOR_PRESETS as COLOR_PRESETS, cardShadowElevated, ui } from '../lib/uiPalette.js';
import BackupRestore from '../components/BackupRestore.jsx';
import Button from '../components/Button.jsx';
import SectionHeader from '../components/SectionHeader.jsx';
import EmptyState from '../components/EmptyState.jsx';

const styles = {
  shadow: '0 12px 36px rgba(180,140,220,0.18), 0 3px 10px rgba(180,140,220,0.10)',
  page: {
    minHeight: '100vh',
    backgroundColor: 'transparent',
    paddingBottom: 126,
    fontFamily: 'DM Sans, sans-serif',
    color: ui.ink,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 10,
  },
  formCard: {
    background: 'rgba(255,255,255,0.60)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.75)',
    borderRadius: 20,
    boxShadow: '0 8px 32px rgba(128,161,212,0.14)',
    padding: 20,
  },
  label: {
    fontWeight: 900, fontSize: 12, color: '#3D3060', marginBottom: 10,
  },
  input: {
    width: '100%', borderRadius: 14,
    border: '1.5px solid rgba(255,255,255,0.70)',
    padding: '13px 16px', fontWeight: 700, outline: 'none',
    background: 'rgba(255,255,255,0.52)',
    backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
    boxShadow: '0 4px 14px rgba(128,161,212,0.10)',
    color: '#3D3060', fontFamily: 'DM Sans, sans-serif',
    fontSize: 14,
  },
  swatch: (active, color) => ({
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: color,
    border: active ? '3px solid rgba(128,161,212,0.60)' : '2px solid rgba(255,255,255,0.70)',
    boxShadow: active
      ? '0 0 0 3px rgba(128,161,212,0.18)'
      : '0 2px 10px rgba(0,0,0,0.08)',
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

export default function AdminProducts({ products = [], refreshProducts }) {
  const [categories, setCategories] = useState([]);
  const [bonusRules, setBonusRules] = useState([]);
  const [ruleProducts, setRuleProducts] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [events, setEvents] = useState([]);
  const [showArchivedEvents, setShowArchivedEvents] = useState(false);
  const [adminTab, setAdminTab] = useState('products');
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
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

  const activeProductsForRules = useMemo(() => {
    const source = ruleProducts.length > 0 ? ruleProducts : products;
    return source
      .filter((p) => !isArchivedProduct(p))
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

    // 商品存檔成功（手動新增/編輯）
    toast.show('商品新增成功！✅');
  }

  async function onDelete(productId) {
    const ok = window.confirm('確定刪除該商品嗎？');
    if (!ok) return;
    await db.products.delete(productId);
    await refreshProducts?.();
    await loadAll();
  }

  function startNewBonusRule() {
    const nextSortOrder = (bonusRules.at(-1)?.sortOrder ?? 0) + 1;
    setBonusDraft({
      id: createUUID(),
      name: '',
      enabled: true,
      triggerType: 'amount',
      exclusiveGroup: '',
      sortOrder: nextSortOrder,
      categoryId: null,
      triggerAmount: 0,
      triggerProductIds: [],
      triggerProductQty: 1,
      bonusText: '',
    });
  }

  function startEditBonusRule(rule) {
    setBonusDraft({
      ...rule,
      exclusiveGroup: rule.exclusiveGroup ?? '',
      categoryId: rule.categoryId ?? null,
      triggerAmount: rule.triggerAmount ?? 0,
      triggerProductIds: Array.isArray(rule.triggerProductIds) ? rule.triggerProductIds : [],
      triggerProductQty: rule.triggerProductQty ?? 1,
      bonusText: rule.bonusText ?? '',
    });
  }

  async function saveBonusRule() {
    if (!bonusDraft) return;
    if (!String(bonusDraft.name ?? '').trim()) return;
    if (!String(bonusDraft.bonusText ?? '').trim()) return;
    if (bonusDraft.triggerType === 'amount' && (!Number.isFinite(Number(bonusDraft.triggerAmount)) || Number(bonusDraft.triggerAmount) <= 0)) {
      return;
    }
    if (bonusDraft.triggerType === 'product' && (!Array.isArray(bonusDraft.triggerProductIds) || bonusDraft.triggerProductIds.length === 0)) {
      return;
    }

    const payload = {
      ...bonusDraft,
      name: String(bonusDraft.name).trim(),
      enabled: !!bonusDraft.enabled,
      exclusiveGroup: String(bonusDraft.exclusiveGroup ?? '').trim() || null,
      sortOrder: Number.isFinite(Number(bonusDraft.sortOrder)) ? Number(bonusDraft.sortOrder) : 9999,
      categoryId: bonusDraft.triggerType === 'amount' ? (bonusDraft.categoryId || null) : null,
      triggerAmount: bonusDraft.triggerType === 'amount' ? Math.max(0, parseInt(bonusDraft.triggerAmount, 10) || 0) : undefined,
      triggerProductIds: bonusDraft.triggerType === 'product' ? bonusDraft.triggerProductIds : [],
      triggerProductQty: bonusDraft.triggerType === 'product' ? Math.max(1, parseInt(bonusDraft.triggerProductQty, 10) || 1) : undefined,
      bonusText: String(bonusDraft.bonusText).trim(),
    };

    await db.bonusRules.put(payload);
    setBonusDraft(null);
    await loadAll();
    toast.show('活動規則已儲存');
  }

  async function deleteBonusRule(ruleId) {
    const ok = window.confirm('確定刪除這條活動規則嗎？');
    if (!ok) return;
    await db.bonusRules.delete(ruleId);
    await loadAll();
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

  async function createEvent() {
    const displayName = formatEventDisplayName(eventName, eventDate);
    if (!displayName || !eventDate) return;
    await db.events.add({
      id: createUUID(),
      name: displayName,
      date: eventDate,
      status: 'inactive',
      archived: false,
      createdAt: Date.now(),
    });
    setEventName('');
    setEventDate('');
    await loadAll();
    toast.show('活動已新增');
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
    toast.show('已切換活動');
  }

  async function archiveEvent(eventId) {
    const target = events.find((e) => e.id === eventId);
    if (!target) return;
    const ok = window.confirm(`確定封存活動「${target.name}」？`);
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
    toast.show('活動已封存');
  }

  async function editEvent(eventId) {
    const target = events.find((e) => e.id === eventId);
    if (!target) return;
    const rawName = window.prompt('活動名稱（不含日期）', String(target.name ?? '').split('-').slice(0, -1).join('-') || target.name);
    if (rawName === null) return;
    const rawDate = window.prompt('活動日期（YYYY-MM-DD）', target.date ?? '');
    if (rawDate === null) return;
    const displayName = formatEventDisplayName(rawName, rawDate);
    if (!displayName) return;
    await db.events.update(eventId, { name: displayName, date: rawDate });
    await loadAll();
    toast.show('活動已更新');
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
          // eslint-disable-next-line no-await-in-loop
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

  const draftCategoryNames = useMemo(() => {
    if (!draft) return '';
    const ids = draft.categoryIds ?? [];
    return ids.map((id) => categories.find((c) => c.id === id)?.name).filter(Boolean).join(';');
  }, [draft, categories]);

  return (
    <div style={styles.page}>
      {/* ── Admin Tab Bar ── */}
      <div style={{ padding: '0 14px 0' }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: '#9A8898', letterSpacing: '0.08em', marginBottom: 10 }}>
          後台管理
        </div>
        <div
          style={{
            display: 'flex',
            gap: 4,
            padding: '0 4px 12px',
            borderBottom: '1px solid rgba(0,0,0,0.06)',
            marginBottom: 12,
          }}
        >
          {[
            { id: 'products', label: '商品' },
            { id: 'events',   label: '場次&特典' },
            { id: 'system',   label: '系統' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setAdminTab(tab.id)}
              style={{
                flex: 1,
                padding: '10px 8px',
                borderRadius: 20,
                fontWeight: 800,
                fontSize: 13,
                border: adminTab === tab.id
                  ? '1.5px solid rgba(255,255,255,0.30)'
                  : '1.5px solid rgba(255,255,255,0.58)',
                backgroundColor: adminTab === tab.id ? '#80A1D4' : 'rgba(255,255,255,0.38)',
                WebkitBackdropFilter: 'blur(10px)',
                backdropFilter: 'blur(10px)',
                color: adminTab === tab.id ? '#FFFFFF' : '#9A8898',
                cursor: 'pointer',
                boxShadow: adminTab === tab.id
                  ? '0 6px 18px rgba(128,161,212,0.36)'
                  : '0 1px 8px rgba(180,140,220,0.10)',
                transition: 'all 0.18s ease',
              }}
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
            <div style={{ display: 'flex', gap: 16 }}>
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                style={{
                  borderRadius: 24,
                  padding: '12px 14px',
                  fontWeight: 800,
                  border: 'none',
                  background: showArchived ? ui.primary : 'rgba(255, 255, 255, 0.45)',
                  color: showArchived ? '#FFFFFF' : ui.muted,
                  cursor: 'pointer',
                  boxShadow: showArchived ? '0 10px 22px rgba(128, 161, 212, 0.38)' : '0 2px 12px rgba(0, 0, 0, 0.06)',
                }}
              >
                {showArchived ? t('admin.showSellingToggle') : t('admin.showArchivedToggle')}
              </button>
              <Button variant="primary" size="md" onClick={startNew}>
                {t('admin.newProduct')}
              </Button>
            </div>
          )}
        />

        <div style={{ marginTop: 12, display: 'flex', gap: 16 }}>
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
            <div style={{ fontWeight: 900, fontSize: 16, color: ui.ink, borderLeft: '3px solid #80A1D4', paddingLeft: 10 }}>場次管理</div>
            <button
              type="button"
              onClick={() => setShowArchivedEvents((v) => !v)}
              style={{
                borderRadius: 24,
                padding: '8px 12px',
                fontWeight: 800,
                border: 'none',
                color: showArchivedEvents ? '#FFFFFF' : ui.muted,
                background: showArchivedEvents ? ui.primary : 'rgba(255, 255, 255, 0.45)',
                boxShadow: showArchivedEvents ? '0 10px 22px rgba(128, 161, 212, 0.38)' : styles.shadow,
                cursor: 'pointer',
              }}
            >
              {showArchivedEvents ? '隱藏封存活動' : '查看封存活動'}
            </button>
          </div>
          <div style={{ color: '#9A8898', fontWeight: 800, fontSize: 12, marginTop: 6 }}>
            新增場次時會自動命名為「場次名稱_YYMMDD」。
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
            <input
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="活動名稱（例如 CWT72 或 WCSxCWT_D1）"
              style={{ ...styles.input, flex: 1 }}
            />
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              style={{ ...styles.input, flex: 1 }}
            />
            <button
              type="button"
              onClick={() => createEvent().catch((e) => console.error(e))}
              style={{
                borderRadius: 28,
                padding: '12px 14px',
                border: 'none',
                background: ui.primary,
                color: '#FFFFFF',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: styles.shadow,
              }}
            >
              新增
            </button>
          </div>
          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            {events
              .filter((evt) => (showArchivedEvents ? !!evt.archived : !evt.archived))
              .map((evt) => (
              <div key={evt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, background: 'rgba(255,255,255,0.50)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderRadius: 10, padding: '10px 12px' }}>
                <div>
                  <div style={{ fontWeight: 800, color: ui.ink }}>{evt.name}</div>
                  <div style={{ fontWeight: 700, color: '#9A8898', fontSize: 12 }}>{evt.date}{evt.archived ? ' · 已封存' : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => editEvent(evt.id).catch((e) => console.error(e))}
                    style={{
                      color: '#9A8898',
                      border: '1px solid rgba(0,0,0,0.10)',
                      background: '#fff',
                      borderRadius: 8,
                      padding: '6px 10px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    修改
                  </button>
                  {!evt.archived ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setActiveEvent(evt.id).catch((e) => console.error(e))}
                        style={{
                          borderRadius: 24,
                          border: 'none',
                          padding: '8px 12px',
                          fontWeight: 800,
                          color: evt.status === 'active' ? '#FFFFFF' : '#9A8898',
                          background: evt.status === 'active' ? ui.primary : '#FFFFFF',
                          boxShadow: styles.shadow,
                          cursor: 'pointer',
                        }}
                      >
                        {evt.status === 'active' ? '目前活動' : '設為活動'}
                      </button>
                      <button
                        type="button"
                        onClick={() => archiveEvent(evt.id).catch((e) => console.error(e))}
                        style={{
                          color: '#80A1D4',
                          border: '1px solid rgba(128,161,212,0.3)',
                          background: '#fff9f9',
                          borderRadius: 8,
                          padding: '6px 10px',
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        封存
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
            {events.filter((evt) => (showArchivedEvents ? !!evt.archived : !evt.archived)).length === 0
              ? <EmptyState icon="📅" title={showArchivedEvents ? '沒有封存活動' : '尚未建立活動'} />
              : null}
          </div>
        </div>
      </div>
      )}

      {adminTab === 'products' && (
      <div style={{ padding: 14 }}>
        <div style={styles.grid}>
          {filteredProducts.map((p) => {
            const stock = typeof p.stock === 'number' ? p.stock : null;
            return (
              <div key={p.id} onClick={() => startEdit(p)} style={{ cursor: 'pointer' }}>
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
                  onClick={() => startEdit(p)}
                />
              </div>
            );
          })}
        </div>

        {filteredProducts.length === 0 ? (
          <div style={{ padding: 20, color: '#9A8898', fontWeight: 800 }}>{t('admin.noProducts')}</div>
        ) : null}
      </div>
      )}

      {/* Form */}
      {draft ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.35)',
            zIndex: 3000,
            display: 'flex',
            alignItems: 'flex-end',
          }}
        >
          <div
            style={{
              width: '100%',
              padding: 26,
              borderRadius: '28px 28px 0 0',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow:
                '0 -16px 44px rgba(0,0,0,0.1), 0 20px 40px rgba(0, 0, 0, 0.06), 0 4px 12px rgba(0, 0, 0, 0.03)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
              <div style={{ fontWeight: 900, fontSize: 16, borderLeft: '3px solid #80A1D4', paddingLeft: 10 }}>{activeProductId ? t('admin.editTitle') : t('admin.addTitle')}</div>
              <button type="button" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9A8898', fontWeight: 900 }} onClick={() => setDraft(null)}>
                {t('admin.form.cancel')}
              </button>
            </div>

            <div style={{ ...styles.formCard, marginTop: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 12, color: ui.ink, marginBottom: 8 }}>{t('admin.photoSection')}</div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div
                  style={{
                    width: 110,
                    height: 110,
                    borderRadius: 16,
                    border: 'none',
                    overflow: 'hidden',
                    backgroundColor: draft.color || '#F5F5F5',
                    boxShadow: styles.shadow,
                    position: 'relative',
                    flexShrink: 0,
                  }}
                >
                  {draft.imageUrl ? (
                    <img src={draft.imageUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#9A8898' }}>
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
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setDraft((prev) => ({ ...prev, imageUrl: null }))}
                      disabled={!draft.imageUrl}
                      style={{
                        border: 'none',
                        backgroundColor: 'rgba(255,255,255,0.48)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255,255,255,0.50)',
                        borderRadius: 24,
                        padding: '10px 14px',
                        fontWeight: 800,
                        cursor: draft.imageUrl ? 'pointer' : 'not-allowed',
                        color: draft.imageUrl ? ui.primary : ui.muted,
                        boxShadow: styles.shadow,
                      }}
                    >
                      {t('admin.deleteImage')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraft((prev) => ({ ...prev, color: COLOR_PRESETS[0] }))}
                      style={{
                        border: 'none',
                        backgroundColor: 'rgba(255,255,255,0.48)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255,255,255,0.50)',
                        borderRadius: 24,
                        padding: '10px 14px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        color: '#9A8898',
                        boxShadow: styles.shadow,
                      }}
                    >
                      {t('admin.deleteColor')}
                    </button>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <div style={styles.label}>背景顏色（9 種預設）</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
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
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCategory(c.id)}
                      style={{
                        borderRadius: 24,
                        padding: '10px 14px',
                        fontWeight: 800,
                        border: 'none',
                        background: draft.categoryIds.includes(c.id) ? ui.primary : 'rgba(255, 255, 255, 0.45)',
                        color: draft.categoryIds.includes(c.id) ? '#FFFFFF' : ui.muted,
                        cursor: 'pointer',
                        boxShadow: draft.categoryIds.includes(c.id)
                          ? '0 10px 22px rgba(128, 161, 212, 0.38)'
                          : '0 2px 12px rgba(0, 0, 0, 0.06)',
                      }}
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
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, fontWeight: 900 }}>
                  <input
                    type="checkbox"
                    checked={draft.isNew}
                    onChange={(e) => setDraft((prev) => ({ ...prev, isNew: e.target.checked }))}
                  />
                    {t('admin.newBadgeLabel')}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, fontWeight: 900 }}>
                  <input
                    type="checkbox"
                    checked={draft.archived}
                    onChange={(e) => setDraft((prev) => ({ ...prev, archived: e.target.checked }))}
                  />
                    {t('admin.archivedLabel')}
                </label>
              </div>

              <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  style={{
                    flex: 1,
                    borderRadius: 24,
                    padding: '14px 10px',
                    border: 'none',
                    backgroundColor: '#FFFFFF',
                    fontWeight: 800,
                    color: '#9A8898',
                    cursor: 'pointer',
                    boxShadow: styles.shadow,
                  }}
                >
                  {t('admin.form.cancel')}
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  style={{
                    flex: 1,
                    borderRadius: 28,
                    padding: '14px 10px',
                    border: 'none',
                    background: ui.primary,
                    color: '#FFFFFF',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 10px 22px rgba(128, 161, 212, 0.38)',
                  }}
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
                <div style={{ fontWeight: 900, fontSize: 16, borderLeft: '3px solid #80A1D4', paddingLeft: 10 }}>商品大量匯入</div>
                <div style={{ color: '#9A8898', fontWeight: 800, fontSize: 12, marginTop: 6 }}>
                  可匯出模板後填寫，再上傳 CSV。
                </div>
              </div>
              <button
                type="button"
                onClick={downloadTemplate}
                style={{
                  borderRadius: 24,
                  padding: '12px 14px',
                  fontWeight: 800,
                  border: 'none',
                  backgroundColor: 'rgba(255,255,255,0.48)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.52)',
                  cursor: 'pointer',
                  boxShadow: styles.shadow,
                }}
              >
                模板下載
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

      {/* Bonus rules */}
      {adminTab === 'events' && !draft ? (
        <div style={{ padding: 14 }}>
          <div style={{ ...styles.formCard, marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16, borderLeft: '3px solid #80A1D4', paddingLeft: 10 }}>特典設定</div>
                <div style={{ color: '#9A8898', fontWeight: 800, fontSize: 12, marginTop: 6 }}>
                  可設定滿額贈、合購活動（商品觸發）。
                </div>
              </div>
              <button
                type="button"
                onClick={startNewBonusRule}
                style={{
                  borderRadius: 28,
                  padding: '12px 14px',
                  fontWeight: 800,
                  border: 'none',
                  background: ui.primary,
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  boxShadow: '0 10px 22px rgba(128, 161, 212, 0.38)',
                }}
              >
                ＋ 新增活動
              </button>
            </div>

            <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
              {bonusRules.map((r) => (
                <div key={r.id} style={{ background: 'rgba(255,255,255,0.50)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 900 }}>{r.name}</div>
                      <div style={{ color: '#9A8898', fontWeight: 800, fontSize: 12 }}>
                        {r.triggerType === 'amount'
                          ? `滿額贈・門檻 NT$${r.triggerAmount ?? 0}`
                          : `合購活動・商品數量 ≥ ${r.triggerProductQty ?? 1}`}
                      </div>
                      <div style={{ color: ui.ink, fontWeight: 800, fontSize: 12, marginTop: 4 }}>
                        {r.bonusText}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        style={{
                          color: '#9A8898',
                          border: '1px solid rgba(0,0,0,0.10)',
                          background: '#fff',
                          borderRadius: 8,
                          padding: '6px 10px',
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                        onClick={() => startEditBonusRule(r)}
                      >
                        編輯
                      </button>
                      <button
                        type="button"
                        style={{
                          color: '#80A1D4',
                          border: '1px solid rgba(128,161,212,0.3)',
                          background: '#fff9f9',
                          borderRadius: 8,
                          padding: '6px 10px',
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                        onClick={() => deleteBonusRule(r.id)}
                      >
                        刪除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {bonusRules.length === 0
                ? <EmptyState icon="🎁" title="尚未設定活動規則" subtitle="新增特典觸發規則" />
                : null}
            </div>

            {bonusDraft ? (
              <div style={{ marginTop: 20, paddingTop: 16 }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>編輯活動</div>
                <input
                  value={bonusDraft.name}
                  onChange={(e) => setBonusDraft((prev) => ({ ...prev, name: e.target.value }))}
                  style={styles.input}
                  placeholder="活動名稱"
                />
                <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                  <select
                    value={bonusDraft.triggerType}
                    onChange={(e) => setBonusDraft((prev) => ({ ...prev, triggerType: e.target.value }))}
                    style={{ ...styles.input, flex: 1 }}
                  >
                    <option value="amount">滿額贈</option>
                    <option value="product">合購活動（商品觸發）</option>
                  </select>
                  <input
                    value={bonusDraft.exclusiveGroup}
                    onChange={(e) => setBonusDraft((prev) => ({ ...prev, exclusiveGroup: e.target.value }))}
                    style={{ ...styles.input, flex: 1 }}
                    placeholder="互斥群組（可留空）"
                  />
                </div>

                {bonusDraft.triggerType === 'amount' ? (
                  <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                    <select
                      value={bonusDraft.categoryId ?? ''}
                      onChange={(e) => setBonusDraft((prev) => ({ ...prev, categoryId: e.target.value || null }))}
                      style={{ ...styles.input, flex: 1 }}
                    >
                      <option value="">全部商品</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={bonusDraft.triggerAmount}
                      onChange={(e) => setBonusDraft((prev) => ({ ...prev, triggerAmount: e.target.value }))}
                      style={{ ...styles.input, flex: 1 }}
                      placeholder="門檻金額"
                    />
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                    <select
                      value={bonusDraft.triggerProductIds?.[0] ?? ''}
                      onChange={(e) => setBonusDraft((prev) => ({ ...prev, triggerProductIds: e.target.value ? [e.target.value] : [] }))}
                      style={{ ...styles.input, flex: 1 }}
                    >
                      <option value="">選擇觸發商品</option>
                      {activeProductsForRules.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={bonusDraft.triggerProductQty}
                      onChange={(e) => setBonusDraft((prev) => ({ ...prev, triggerProductQty: e.target.value }))}
                      style={{ ...styles.input, flex: 1 }}
                      placeholder="最少數量"
                    />
                  </div>
                )}

                <input
                  value={bonusDraft.bonusText}
                  onChange={(e) => setBonusDraft((prev) => ({ ...prev, bonusText: e.target.value }))}
                  style={{ ...styles.input, marginTop: 10 }}
                  placeholder="贈品顯示文案"
                />

                <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                  <button type="button" onClick={() => setBonusDraft(null)} style={{ ...styles.input, width: 'auto', padding: '10px 14px' }}>
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={() => saveBonusRule().catch((e) => console.error(e))}
                    style={{
                      borderRadius: 28,
                      padding: '10px 14px',
                      fontWeight: 800,
                      border: 'none',
                      background: ui.primary,
                      color: '#FFFFFF',
                      cursor: 'pointer',
                      boxShadow: '0 10px 22px rgba(128, 161, 212, 0.38)',
                    }}
                  >
                    儲存活動
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
                <div style={{ fontWeight: 900, fontSize: 16, borderLeft: '3px solid #80A1D4', paddingLeft: 10 }}>付款方式維護</div>
                <div style={{ color: '#9A8898', fontWeight: 800, fontSize: 12, marginTop: 6 }}>
                  預購與販售頁共用此設定。
                </div>
              </div>
              <button
                type="button"
                onClick={startNewPaymentMethod}
                style={{
                  borderRadius: 28,
                  padding: '12px 14px',
                  fontWeight: 800,
                  border: 'none',
                  background: ui.primary,
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  boxShadow: '0 10px 22px rgba(128, 161, 212, 0.38)',
                }}
              >
                ＋ 新增付款方式
              </button>
            </div>

            <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
              {paymentMethods.map((pm) => (
                <div key={pm.id} style={{ border: '1px solid rgba(255,255,255,0.52)', borderRadius: 18, padding: 12, backgroundColor: 'rgba(255,255,255,0.48)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', boxShadow: '0 4px 14px rgba(180,140,220,0.10)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 900 }}>{pm.name}</div>
                      <div style={{ color: '#9A8898', fontWeight: 800, fontSize: 12 }}>
                        {pm.enabled ? '啟用中' : '停用'} · {pm.isCash ? '收現' : '非收現'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" style={{ ...styles.input, width: 'auto', padding: '8px 10px' }} onClick={() => startEditPaymentMethod(pm)}>
                        編輯
                      </button>
                      <button type="button" style={{ ...styles.input, width: 'auto', padding: '8px 10px', color: ui.primary }} onClick={() => deletePaymentMethod(pm.id).catch((e) => console.error(e))}>
                        刪除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {paymentDraft ? (
              <div style={{ marginTop: 20, paddingTop: 16 }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>編輯付款方式</div>
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
                  <button type="button" onClick={() => setPaymentDraft(null)} style={{ ...styles.input, width: 'auto', padding: '10px 14px' }}>
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={() => savePaymentMethod().catch((e) => console.error(e))}
                    style={{
                      borderRadius: 28,
                      padding: '10px 14px',
                      fontWeight: 800,
                      border: 'none',
                      background: ui.primary,
                      color: '#FFFFFF',
                      cursor: 'pointer',
                      boxShadow: '0 10px 22px rgba(128, 161, 212, 0.38)',
                    }}
                  >
                    儲存付款方式
                  </button>
                </div>
              </div>
            ) : null}
          </div>

        {/* 備份/還原 */}
        <div style={{ ...styles.formCard, marginTop: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 16, borderLeft: '3px solid #80A1D4', paddingLeft: 10, marginBottom: 12 }}>
            雲端備份
          </div>
          <BackupRestore />
        </div>
        </div>
      ) : null}

      <Toast message={toast.message} visible={toast.visible} />
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
          style={{
            borderRadius: 28,
            padding: '12px 14px',
            border: 'none',
            background: ui.primary,
            color: '#FFFFFF',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: styles.shadow,
          }}
        >
          ＋
        </button>
      </div>

      {categories.length > 0 ? (
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onDeleted?.(c.id)}
              style={{
                borderRadius: 20,
                padding: '6px 10px',
                border: 'none',
                backgroundColor: '#FFFFFF',
                boxShadow: styles.shadow,
                color: '#9A8898',
                fontWeight: 800,
                cursor: 'pointer',
              }}
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

