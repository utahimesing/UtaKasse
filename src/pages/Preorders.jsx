import { useCallback, useEffect, useMemo, useState } from 'react';
import ProductCard from '../components/ProductCard.jsx';
import CartItemRow from '../components/CartItemRow.jsx';
import NumpadDigits from '../components/NumpadDigits.jsx';
import BundlePickerModal from '../components/BundlePickerModal.jsx';
import Toast from '../components/Toast.jsx';
import db, { createUUID } from '../db.js';
import { getTaipeiDateKey, getTaipeiTimeHMS } from '../lib/dateTaipei.js';
import { useToast } from '../lib/useToast.js';
import { parsePreordersCsvText } from '../lib/csv.js';
import { t } from '../i18n/t.js';
import { getString } from '../lib/strings.js';
import { readCsvFileWithEncoding, withBom } from '../lib/csvImport.js';
import { calcCartTotals } from '../lib/promo.js';
import {
  addLine, setLineQty, removeLine, makeSingleLine, makeBundleLine,
  maxQtyForLine, qtyOfProductInCart, usageByProduct, lineToTxItem,
} from '../lib/cart.js';
import Button from '../components/Button.jsx';
import { checkoutCta, ui, border, shadow, surface } from '../lib/uiPalette.js';

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: 'transparent',
    paddingBottom: 40,
    fontFamily: 'inherit',
    color: ui.ink,
  },
  // H2 區塊標題：20px／800，下方偏左橘色粗色條
  h2: { fontWeight: 800, fontSize: 20, color: ui.ink, letterSpacing: '-0.01em', lineHeight: 1.2 },
  h2Bar: { width: 48, height: 6, background: ui.orange, border: border.solidSm, marginTop: 6 },
  caption: { color: ui.muted, fontWeight: 600, fontSize: 12 },
  card: {
    ...surface.card,
    padding: 16,
  },
  // 預購單卡：待取件白底、已取件薄荷底＋淡化
  preorderCard: (isPending) => ({
    ...surface.card,
    background: isPending ? ui.white : ui.mint,
    boxShadow: isPending ? shadow.md : shadow.sm,
    padding: 16,
    opacity: isPending ? 1 : 0.8,
  }),
  // 分頁籤 chip：pill、黑框、選中杏色
  tab: (active) => ({
    flex: 1,
    minHeight: 40,
    padding: '0 8px',
    borderRadius: 999,
    fontWeight: 700,
    fontSize: 13,
    border: border.solidSm,
    backgroundColor: active ? ui.apricot : ui.white,
    color: ui.ink,
    cursor: 'pointer',
    boxShadow: active ? shadow.sm : 'none',
    transition: 'background 0.15s ease',
  }),
  // 狀態 badge：待處理杏色、已完成青綠
  statusBadge: (isPending) => ({
    display: 'inline-block',
    fontSize: 12, fontWeight: 700, color: ui.ink,
    padding: '4px 10px', borderRadius: 999,
    border: border.solidSm,
    background: isPending ? ui.apricot : ui.teal,
  }),
  input: {
    width: '100%',
    boxSizing: 'border-box',
    minHeight: 44,
    borderRadius: 10,
    border: border.solidSm,
    padding: '10px 14px',
    fontWeight: 700,
    fontSize: 15,
    color: ui.ink,
    backgroundColor: ui.white,
    fontFamily: 'inherit',
  },
  paymentPill: (active) => ({
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    padding: '0 8px',
    fontWeight: 700,
    fontSize: 13,
    border: border.solidSm,
    background: active ? ui.apricot : ui.white,
    color: ui.ink,
    cursor: 'pointer',
    boxShadow: active ? shadow.sm : 'none',
  }),
  // 取件抽屜（底部 sheet）
  overlay: {
    position: 'fixed',
    inset: 0,
    ...surface.overlay,
    zIndex: 2000,
    display: 'flex',
    alignItems: 'flex-end',
  },
  sheet: {
    width: '100%',
    boxSizing: 'border-box',
    ...surface.sheet,
    boxShadow: 'none',
    padding: 20,
    maxHeight: '85vh',
    overflowY: 'auto',
  },
  // 結帳 CTA
  cta: (disabledLook) => ({
    width: '100%',
    marginTop: 14,
    minHeight: 52,
    padding: '14px 10px',
    borderRadius: 10,
    border: checkoutCta.border,
    color: checkoutCta.color,
    fontWeight: checkoutCta.fontWeight,
    fontSize: checkoutCta.fontSize,
    background: checkoutCta.background,
    boxShadow: disabledLook ? 'none' : checkoutCta.shadow,
    opacity: disabledLook ? 0.6 : 1,
    cursor: disabledLook ? 'not-allowed' : 'pointer',
  }),
};

function isValidDexieKey(v) {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return true;
  if (typeof v === 'number') return Number.isFinite(v);
  if (v instanceof Date) return !Number.isNaN(v.getTime());
  if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) return true;
  if (Array.isArray(v)) return v.every((item) => isValidDexieKey(item));
  return false;
}

export default function Preorders() {
  const [activeTab, setActiveTab] = useState('all'); // all | pending | done

  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [products, setProducts] = useState([]);
  const [bonusRules, setBonusRules] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [preOrders, setPreOrders] = useState([]);

  const [importErrors, setImportErrors] = useState([]);
  const [importWarnings, setImportWarnings] = useState([]);
  const [importing, setImporting] = useState(false);

  const [activePreorderId, setActivePreorderId] = useState(null);
  const [pickupPaymentId, setPickupPaymentId] = useState(null);
  const [pickupCashInput, setPickupCashInput] = useState('0');

  // Add-on cart for B-type pickup（以 lineId 為鍵，見 src/lib/cart.js）
  const [addOnOpen, setAddOnOpen] = useState(false);
  const [addOnCart, setAddOnCart] = useState([]);
  const [bundlePicking, setBundlePicking] = useState(null);

  const toast = useToast();

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const getStock = useCallback((productId) => {
    const p = productsById.get(productId);
    return p ? p.stock : null;
  }, [productsById]);

  const activePreorder = useMemo(
    () => preOrders.find((p) => p.id === activePreorderId) ?? null,
    [preOrders, activePreorderId],
  );
  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const paymentForPickup = useMemo(
    () => paymentMethods.find((m) => m.id === pickupPaymentId) ?? null,
    [paymentMethods, pickupPaymentId],
  );

  // 加購清單也套用合購折扣（只算加購的品項）
  const addOnTotals = useMemo(() => calcCartTotals(addOnCart, bonusRules), [addOnCart, bonusRules]);
  const addOnTotal = addOnTotals.subtotal;

  async function getSelectedEventOrThrow() {
    const evts = await db.events.toArray();
    const evt = evts.find((e) => e?.id === selectedEventId && !e?.archived) ?? null;
    if (!evt || !isValidDexieKey(evt.id)) {
      throw new Error(t('preorders.selectEventShort'));
    }
    return evt;
  }

  async function loadAll() {
    const evts = (await db.events.orderBy('createdAt').toArray()).filter((e) => !e.archived);
    setEvents(evts);
    setSelectedEventId((prev) => {
      if (prev && evts.some((e) => e.id === prev)) return prev;
      const activeEvt = evts.find((e) => e.status === 'active');
      return activeEvt?.id ?? null;
    });

    const p = (await db.products.toArray()).filter((x) => !x?.archived);
    setProducts(p);

    const rules = await db.bonusRules.orderBy('sortOrder').toArray();
    setBonusRules(rules);

    const pms = (await db.paymentMethods.toArray())
      .filter((x) => !!x?.enabled)
      .sort((a, b) => (a?.sortOrder ?? 0) - (b?.sortOrder ?? 0));
    setPaymentMethods(pms);
    if (!pickupPaymentId && pms.length > 0) setPickupPaymentId(pms[0].id);

    const eventId = selectedEventId && evts.some((e) => e.id === selectedEventId) ? selectedEventId : null;
    const prs = eventId ? (await db.preOrders.toArray()).filter((x) => x?.eventId === eventId) : [];
    setPreOrders(prs);
  }

  async function switchActiveEvent(eventId) {
    if (!eventId) return;
    closePickup();
    const evts = await db.events.toArray();
    await Promise.all(
      evts.map((e) =>
        db.events.update(e.id, {
          status: !e.archived && e.id === eventId ? 'active' : 'inactive',
        }),
      ),
    );
    setSelectedEventId(eventId);
    await loadAll();
  }

  useEffect(() => {
    // 初次載入（非同步，不在 effect 內同步 setState）
    Promise.resolve().then(() => loadAll()).catch((e) => console.error(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // 切換場次後重新讀該場次的預購單；沒選場次就清空
    let alive = true;
    db.preOrders.toArray()
      .then((rows) => {
        if (!alive) return;
        setPreOrders(selectedEventId ? rows.filter((x) => x?.eventId === selectedEventId) : []);
      })
      .catch((e) => console.error(e));
    return () => { alive = false; };
  }, [selectedEventId]);

  const filteredPreOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const base =
      activeTab === 'pending'
        ? preOrders.filter((o) => o.status === 'pending')
        : activeTab === 'done'
          ? preOrders.filter((o) => o.status === 'collected')
          : preOrders;

    if (!q) return base;
    return base.filter((o) => {
      const name = String(o.buyerName ?? '').toLowerCase();
      const last5 = String(o.phoneLast5 ?? '');
      return name.includes(q) || last5.includes(q);
    });
  }, [activeTab, preOrders, searchQuery]);

  function openPickup(preOrder) {
    setActivePreorderId(preOrder.id);
    setPickupCashInput('0');
    setAddOnOpen(false);
    setAddOnCart([]);
    if (pickupPaymentId) return;
    const first = paymentMethods[0];
    if (first) setPickupPaymentId(first.id);
  }

  function closePickup() {
    setActivePreorderId(null);
    setAddOnOpen(false);
    setAddOnCart([]);
    setPickupCashInput('0');
  }

  function pressDigit(n) {
    setPickupCashInput((prev) => (prev === '0' ? String(n) : `${prev}${n}`));
  }

  function pressDoubleZero() {
    setPickupCashInput((prev) => (prev === '0' ? '0' : `${prev}00`));
  }

  function pressBackspace() {
    setPickupCashInput((prev) => (prev.length > 1 ? prev.slice(0, -1) : '0'));
  }

  const pickupBalanceDue = activePreorder?.balanceDue ?? 0;
  const cashValue = useMemo(() => {
    const n = parseInt(pickupCashInput, 10);
    return Number.isFinite(n) ? n : 0;
  }, [pickupCashInput]);

  const expectedTotalCollect = pickupBalanceDue + addOnTotal;
  const changeAmount = cashValue - expectedTotalCollect;
  const isCashSufficient = !paymentForPickup?.isCash || changeAmount >= 0;
  const cashInsufficient = !!paymentForPickup?.isCash && changeAmount < 0;

  function addOnToCart(product) {
    if ((product.type ?? 'single') === 'bundle') {
      setBundlePicking(product);
      return;
    }
    setAddOnCart((prev) => addLine(prev, makeSingleLine(product), getStock));
  }

  function confirmAddOnBundle(components) {
    const product = bundlePicking;
    setBundlePicking(null);
    if (!product) return;
    setAddOnCart((prev) => addLine(prev, makeBundleLine(product, components), getStock));
  }

  function incAddOnQty(lineId) {
    setAddOnCart((prev) => {
      const line = prev.find((x) => x.lineId === lineId);
      return line ? setLineQty(prev, lineId, line.qty + 1, getStock) : prev;
    });
  }

  function decAddOnQty(lineId) {
    setAddOnCart((prev) => {
      const line = prev.find((x) => x.lineId === lineId);
      return line ? setLineQty(prev, lineId, line.qty - 1, getStock) : prev;
    });
  }

  function removeAddOn(lineId) {
    setAddOnCart((prev) => removeLine(prev, lineId));
  }

  function cartAddOnRows() {
    return addOnCart.map((it) => {
      const maxQty = maxQtyForLine(it, addOnCart, getStock);
      return (
        <CartItemRow
          key={it.lineId}
          item={it}
          onInc={() => incAddOnQty(it.lineId)}
          onDec={() => decAddOnQty(it.lineId)}
          onRemove={() => removeAddOn(it.lineId)}
          canDec={it.qty > 1}
          canInc={it.qty < maxQty}
        />
      );
    });
  }

  async function importPreordersFromFile(file) {
    setImporting(true);
    setImportErrors([]);
    setImportWarnings([]);
    try {
      const { text, encoding } = await readCsvFileWithEncoding(file);
      // lookup: item_name => productId (needed only for stock deduction)
      const prodList = (await db.products.toArray()).filter((x) => !x?.archived);
      const normalizeName = (s) => String(s ?? '').replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim();
      const productByName = new Map();
      prodList.forEach((p) => {
        const key = normalizeName(p.name);
        if (key) productByName.set(key, p);
      });

      if (!selectedEventId) {
        setImportErrors([t('preorders.selectEventFirst')]);
        toast.show(t('preorders.selectEventFirst'), 'error');
        return;
      }
      const evt = await getSelectedEventOrThrow();

      const { preOrders, headerErrors, rowErrors, warnings } = parsePreordersCsvText(text, {
        productByName,
        eventId: evt.id,
        expectedEventId: evt.id,
        expectedEventName: evt.name,
      });

      if (headerErrors.length > 0) {
        setImportErrors(headerErrors);
        setImportWarnings(warnings);
        toast.show(headerErrors[0] ?? getString('A4'));
        return;
      }

      if (rowErrors.length > 0) setImportErrors(rowErrors.slice(0, 50));
      if (warnings?.length) setImportWarnings(warnings.slice(0, 50));

      const list = (Array.isArray(preOrders) ? preOrders : []).map((order) => ({
        ...order,
        eventId: evt.id,
        totalPrice: parseInt(order.totalPrice, 10) || 0,
        depositPaid: parseInt(order.depositPaid, 10) || 0,
        balanceDue: parseInt(order.balanceDue, 10) || 0,
        items: (order.items ?? []).map((item) => ({
          ...item,
          unitPrice: parseInt(item.unitPrice, 10) || 0,
          qty: parseInt(item.qty, 10) || 0,
        })),
      }));
      await Promise.all(list.map((g) => db.preOrders.add(g)));
      await loadAll();

      if (list.length > 0) {
        toast.show(getString('A3', { encoding }));
      }
    } catch (e) {
      console.error(e);
      const reason = e instanceof Error ? e.message : '未知錯誤';
      setImportErrors([`CSV 解析失敗：${reason}`]);
      toast.show(`CSV 解析失敗：${reason}`);
    } finally {
      setImporting(false);
    }
  }

  async function pickupA(preOrder) {
    if (!selectedEventId) {
      toast.show(t('preorders.selectEventShort'), 'error');
      return;
    }
    const evt = await getSelectedEventOrThrow();
    const createdAt = Date.now();
    const taipeiDate = getTaipeiDateKey(new Date(createdAt));
    const time = getTaipeiTimeHMS(new Date(createdAt));

    await db.transaction('rw', db.products, db.preOrders, db.transactions, async () => {
      // Reduce stock
      for (const it of preOrder.items ?? []) {
        if (!it.productId) continue;
        const prod = await db.products.get(it.productId);
        if (!prod) continue;
        if (typeof prod.stock === 'number') {
          await db.products.update(it.productId, { stock: Math.max(0, prod.stock - it.qty) });
        }
      }

      const tx = {
        id: createUUID(),
        eventId: evt.id,
        date: taipeiDate,
        createdAt,
        time,
        type: 'preorder_pickup',
        preorderId: preOrder.id,
        items: (preOrder.items ?? []).map((it) => ({
          productId: it.productId,
          productName: it.productName,
          qty: it.qty,
          unitPrice: it.unitPrice,
        })),
        subtotal: 0,
        payments: [{ methodId: null, methodName: '（已付清）', amount: 0, isCash: false }],
        depositAlreadyPaid: preOrder.depositPaid ?? 0,
        bonusesTriggered: [],
        note: `${preOrder.buyerName}・${preOrder.orderId ?? preOrder.phoneLast5}`,
      };

      await db.transactions.add(tx);

      await db.preOrders.update(preOrder.id, {
        status: 'collected',
        collectedAt: Date.now(),
        transactionId: tx.id,
      });
    });

    toast.show(`${getString('A2')}${preOrder.orderId ?? preOrder.phoneLast5}`);
    closePickup();
    await loadAll();
  }

  async function pickupB(preOrder) {
    if (!paymentForPickup) return;

    // If cash, validate cash covers balance due + add-on
    if (paymentForPickup.isCash) {
      const n = parseInt(pickupCashInput, 10) || 0;
      if (n < expectedTotalCollect) return;
    }

    if (!selectedEventId) {
      toast.show(t('preorders.selectEventShort'), 'error');
      return;
    }
    const evt = await getSelectedEventOrThrow();
    const createdAt = Date.now();
    const taipeiDate = getTaipeiDateKey(new Date(createdAt));
    const time = getTaipeiTimeHMS(new Date(createdAt));

    const preorderItems = preOrder.items ?? [];
    const preorderTxItems = preorderItems.map((it) => ({
      productId: it.productId,
      productName: it.productName,
      qty: it.qty,
      unitPrice: it.unitPrice,
    }));

    const addOnTxItems = (addOnCart ?? []).map(lineToTxItem);
    const addOnUsage = usageByProduct(addOnCart ?? []); // 單賣 ＋ 套組本身 ＋ 套組內容物

    const preorderTotal = preOrder.balanceDue ?? 0;
    const addOnTotalLocal = addOnTotal;
    const addOnTotalsLocal = addOnTotals;

    await db.transaction('rw', db.products, db.preOrders, db.transactions, async () => {
      // Reduce stock for preorder items
      for (const it of preorderItems) {
        if (!it.productId) continue;
        const prod = await db.products.get(it.productId);
        if (!prod) continue;
        if (typeof prod.stock === 'number') {
          await db.products.update(it.productId, { stock: Math.max(0, prod.stock - it.qty) });
        }
      }

      // Reduce stock for add-ons（含套組內容物）
      for (const [productId, used] of addOnUsage) {
        const prod = await db.products.get(productId);
        if (!prod || typeof prod.stock !== 'number') continue;
        await db.products.update(productId, { stock: Math.max(0, prod.stock - used) });
      }

      const preorderPayment = {
        methodId: paymentForPickup.id,
        methodName: paymentForPickup.name,
        amount: preorderTotal,
        isCash: paymentForPickup.isCash,
      };

      const preorderTx = {
        id: createUUID(),
        eventId: evt.id,
        date: taipeiDate,
        createdAt,
        time,
        type: 'preorder_pickup',
        preorderId: preOrder.id,
        items: preorderTxItems,
        subtotal: preorderTotal,
        payments: [preorderPayment],
        depositAlreadyPaid: preOrder.depositPaid ?? 0,
        bonusesTriggered: [],
        note: `${preOrder.buyerName}・${preOrder.orderId ?? preOrder.phoneLast5}（訂金NT$${preOrder.depositPaid ?? 0}已付）`,
      };

      await db.transactions.add(preorderTx);

      if (addOnTxItems.length > 0 && addOnTotalLocal > 0) {
        const salePayment = {
          methodId: paymentForPickup.id,
          methodName: paymentForPickup.name,
          amount: addOnTotalLocal,
          isCash: paymentForPickup.isCash,
        };

        const saleTx = {
          id: createUUID(),
          eventId: evt.id,
          date: taipeiDate,
          createdAt,
          time,
          type: 'sale',
          preorderId: null,
          items: addOnTxItems,
          subtotal: addOnTotalLocal,
          grossAmount: addOnTotalsLocal.grossAmount,
          discounts: addOnTotalsLocal.discounts,
          discountApproximate: !!addOnTotalsLocal.approximate,
          payments: [salePayment],
          depositAlreadyPaid: 0,
          bonusesTriggered: [],
          note: `（與${preOrder.orderId ?? preOrder.phoneLast5}同批結帳）`,
        };

        await db.transactions.add(saleTx);
      }

      await db.preOrders.update(preOrder.id, {
        status: 'collected',
        collectedAt: Date.now(),
        transactionId: preorderTx.id,
      });
    });

    toast.show(`${getString('A2')}${preOrder.orderId ?? preOrder.phoneLast5}`);
    closePickup();
    await loadAll();
  }

  function preorderItemsSummary(preOrder) {
    const items = preOrder.items ?? [];
    const parts = items.map((it) => `${it.productName}×${it.qty}`);
    return parts.join(' + ');
  }

  const preorderIsA = activePreorder && (activePreorder.balanceDue ?? 0) === 0;

  function downloadPreorderTemplate() {
    const header = ['event_name', 'order_id', 'buyer_name', 'phone_last5', 'item_name', 'item_qty', 'unit_price', 'total_price', 'paid_amount'];
    const sampleEvent = String(selectedEvent?.name ?? '請填入場次名稱，例如CWT72_250601');
    const sample = [
      `${sampleEvent},A0001,範例買家1,00001,範例商品1,1,100,100,100`,
      `${sampleEvent},A0002,範例買家2,00002,範例商品2,2,300,600,300`,
    ];
    const csv = [header.join(','), ...sample].join('\n');
    const blob = new Blob([withBom(csv)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'preorder_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={styles.page}>
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '0 6px 12px 0',
          marginBottom: 12,
        }}
      >
        {[
          { key: 'all', label: t('preorders.filters.all') },
          { key: 'pending', label: t('preorders.filters.pending') },
          { key: 'done', label: t('preorders.filters.done') },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={styles.tab(activeTab === tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 場次管理：切換場次（新增請到後台） */}
      <div style={{ padding: '0 6px 20px 0' }}>
        <div style={styles.h2}>{t('preorders.eventSection')}</div>
        <div style={styles.h2Bar} />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
          <select
            value={selectedEventId ?? ''}
            onChange={(e) => switchActiveEvent(e.target.value).catch((err) => console.error(err))}
            style={{ ...styles.input, flex: 1 }}
          >
            {events.length === 0 ? <option value="">{t('preorders.noEvent')}</option> : null}
            {events.length > 0 ? <option value="">{t('preorders.selectEvent')}</option> : null}
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}（{e.date}）
              </option>
            ))}
          </select>
          <div
            style={{
              ...styles.caption,
              fontSize: 11,
              whiteSpace: 'nowrap',
              flexShrink: 0,
              padding: '0 4px',
              lineHeight: 1.4,
              textAlign: 'right',
            }}
          >
            請至<br />後台新增
          </div>
        </div>
      </div>

      <div style={{ padding: '0 6px 22px 0' }}>
        <div style={styles.h2}>{t('preorders.listTitle')}</div>
        <div style={styles.h2Bar} />
        <div style={{ ...styles.caption, marginTop: 8 }}>
          總 {preOrders.length} 筆 / 待取 {preOrders.filter((p) => p.status === 'pending').length} 筆
        </div>
        <div style={{ marginTop: 10 }}>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={getString('P2')}
            style={styles.input}
          />
        </div>
      </div>

      <div style={{ padding: '0 6px 0 0' }}>
        {importErrors.length > 0 ? (
          <div style={{ ...styles.card, marginBottom: 16, backgroundColor: ui.apricot }}>
            <div style={{ fontWeight: 800, color: ui.ink }}>⚠ {t('preorders.importErrors')}</div>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: ui.ink, fontWeight: 600, fontSize: 12 }}>
              {importErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {importWarnings.length > 0 ? (
          <div style={{ ...styles.card, marginBottom: 16, backgroundColor: ui.apricot }}>
            <div style={{ fontWeight: 800, color: ui.ink }}>⚠ 警告（部分項目可能未匯入）</div>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: ui.ink, fontWeight: 600, fontSize: 12 }}>
              {importWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}

          <div style={{ ...styles.card, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{t('preorders.importTitle')}</div>
            <Button variant="secondary" size="sm" onClick={downloadPreorderTemplate}>
              下載預購範本
            </Button>
          </div>
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={importing || !selectedEventId}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              importPreordersFromFile(f).catch((err) => console.error(err));
            }}
          />
          <div style={{ ...styles.caption, fontSize: 11, marginTop: 8, lineHeight: 1.5 }}>
            💡 提示：event_name 請填入後台顯示的場次名稱（如 CWT72_250601）。item_name 須與後台商品名稱完全一致，否則無法關聯庫存。
          </div>
        </div>

        {filteredPreOrders.length === 0 ? (
          <div style={{ color: ui.muted, fontWeight: 700, padding: 20 }}>{t('preorders.noData')}</div>
        ) : (
          filteredPreOrders.map((o) => {
            const isPending = o.status === 'pending';
            const balanceDue = o.balanceDue ?? 0;
            const isA = balanceDue === 0;
            return (
              <div
                key={o.id}
                className="pressable"
                style={{ ...styles.preorderCard(isPending), marginBottom: 16, cursor: 'pointer' }}
                onClick={() => openPickup(o)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.01em' }}>{o.buyerName}</div>
                    <div style={{ ...styles.caption, marginTop: 4 }}>
                      {t('preorders.orderLast5Label')} {o.phoneLast5}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={styles.statusBadge(isPending)}>
                      {isPending ? t('preorders.status.pending') : t('preorders.status.done')}
                    </span>
                    <div
                      style={{
                        marginTop: 6,
                        fontWeight: 800,
                        color: ui.ink,
                        fontSize: 13,
                      }}
                    >
                      {isA ? t('preorders.paidA') : `${t('preorders.paidBPrefix')}${balanceDue}`}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 10, color: ui.ink, fontWeight: 600, fontSize: 14 }}>
                  {preorderItemsSummary(o)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pickup panel */}
      {activePreorder ? (
        <div style={styles.overlay} onClick={closePickup}>
          <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
            {/* 復古視窗標題列：杏色色帶＋黑色底線＋右側關閉鈕 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, margin: '-20px -20px 0', padding: '10px 14px 10px 20px', ...surface.titleBar }}>
              <div style={{ fontWeight: 800, fontSize: 17 }}>{t('preorders.pickupTitle')}</div>
              <Button variant="secondary" size="sm" onClick={closePickup} aria-label={t('common.close')}>
                ✕
              </Button>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: '-0.01em' }}>{activePreorder.buyerName}</div>
              <div style={{ ...styles.caption, marginTop: 4 }}>
                {t('preorders.panelLast5Label')} {activePreorder.phoneLast5}
              </div>
            </div>

            <div style={{ marginTop: 14, ...styles.card, boxShadow: shadow.sm }}>
              {preorderIsA ? (
                <>
                  <span style={styles.statusBadge(false)}>{t('preorders.fullPaidLabel')}</span>
                  <div style={{ marginTop: 10 }}>
                    {(activePreorder.items ?? []).map((it, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '10px 0', borderBottom: `1px solid ${ui.lineSoft}` }}>
                        <div style={{ fontWeight: 800 }}>{it.productName}</div>
                        <div style={{ color: ui.muted, fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
                          {it.qty} 件 · NT${it.unitPrice} / 件
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontWeight: 800, color: ui.ink, marginTop: 12 }}>
                    {t('preorders.fullPaidDetailPrefix')}
                    {activePreorder.totalPrice}
                  </div>
                  <button
                    type="button"
                    onClick={() => pickupA(activePreorder)}
                    style={{ ...styles.cta(false), background: ui.teal }}
                  >
                    {t('preorders.confirmA')}
                  </button>
                  <div style={{ ...styles.caption, marginTop: 10 }}>
                    {t('preorders.hintA')}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 800, fontSize: 14, color: ui.ink }}>{t('preorders.balanceDueLabel')}</div>
                  <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <div style={styles.caption}>
                      {t('preorders.balanceDueLabel')} NT${activePreorder.balanceDue}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em', lineHeight: 1, color: ui.ink }}>{`NT$${activePreorder.balanceDue}`}</div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <Button
                      variant={addOnOpen ? 'success' : 'secondary'}
                      onClick={() => setAddOnOpen((v) => !v)}
                      style={{ width: '100%' }}
                    >
                      {t('preorders.addonButton')}
                    </Button>
                  </div>

                  {addOnOpen ? (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontWeight: 800, marginBottom: 10 }}>{t('preorders.addonTitle')}</div>
                      {addOnCart.length === 0 ? (
                        <div style={{ color: ui.muted, fontWeight: 600, padding: 8 }}>{t('preorders.addonEmpty')}</div>
                      ) : (
                        <div style={{ marginBottom: 12 }}>
                          {cartAddOnRows()}
                          {addOnTotals.discounts.map((d) => (
                            <div key={d.ruleId} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, fontWeight: 700, padding: '4px 0' }}>
                              <span>🏷️ {d.ruleName} ×{d.times}</span>
                              <span>−NT${d.amount}</span>
                            </div>
                          ))}
                          {addOnTotals.approximate ? (
                            <div style={{ ...styles.caption, marginTop: 4 }}>{t('sales.discountApprox')}</div>
                          ) : null}
                          <div style={{ fontWeight: 800, fontSize: 18, color: ui.ink, textAlign: 'right', marginTop: 8 }}>
                            {t('preorders.addonSubtotal')} NT${addOnTotal}
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, padding: '2px 6px 6px 2px' }}>
                        {products.slice(0, 12).map((p) => (
                          <ProductCard
                            key={p.id}
                            product={p}
                            cartQty={qtyOfProductInCart(addOnCart, p.id)}
                            onClick={() => addOnToCart(p)}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* 應收總額：橘色色塊＋Display 字級 */}
                  <div style={{ marginTop: 12, ...styles.card, boxShadow: shadow.sm, background: ui.orange }}>
                    <div style={{ ...styles.caption, color: ui.ink }}>應收總額（尾款＋加購）</div>
                    <div style={{ marginTop: 4, fontWeight: 800, fontSize: 40, letterSpacing: '-0.02em', lineHeight: 1, color: ui.ink, textAlign: 'right', wordBreak: 'break-all' }}>
                      NT${expectedTotalCollect}
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontWeight: 800, color: ui.ink }}>{t('preorders.paymentTitle')}</div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 8, padding: '0 4px 4px 0' }}>
                      {paymentMethods
                        .filter((m) => m.enabled)
                        .slice(0, 3)
                        .map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            style={styles.paymentPill(pickupPaymentId === m.id)}
                            onClick={() => {
                              setPickupPaymentId(m.id);
                              if (m.isCash) setPickupCashInput('0');
                            }}
                          >
                            {m.name}
                          </button>
                        ))}
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ ...styles.caption, marginBottom: 6 }}>實收金額</div>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={pickupCashInput}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '') {
                            setPickupCashInput('0');
                            return;
                          }
                          const digitsOnly = v.replace(/[^\d]/g, '');
                          setPickupCashInput(digitsOnly === '' ? '0' : digitsOnly);
                        }}
                        style={{ ...styles.input, fontSize: 20, fontWeight: 800, textAlign: 'right' }}
                      />
                    </div>
                    <div style={{ padding: '0 4px 4px 0' }}>
                      <NumpadDigits
                        disabled={false}
                        onDigit={(n) => pressDigit(n)}
                        onDoubleZero={pressDoubleZero}
                        onBackspace={pressBackspace}
                      />
                    </div>
                    <div
                      style={{
                        textAlign: 'right',
                        marginTop: 10,
                        fontWeight: 800,
                        fontSize: 24,
                        letterSpacing: '-0.01em',
                        color: ui.ink,
                      }}
                    >
                      {cashInsufficient ? '⚠ ' : ''}{`${getString('S9')}${changeAmount}`}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (paymentForPickup?.isCash && !isCashSufficient) {
                        toast.show(getString('S11'), 'error');
                        return;
                      }
                      pickupB(activePreorder);
                    }}
                    disabled={checkoutDisabledB(activePreorder, paymentForPickup, expectedTotalCollect)}
                    style={styles.cta(!isCashSufficient)}
                  >
                    {t('preorders.finishB')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {bundlePicking ? (
        <BundlePickerModal
          product={bundlePicking}
          products={products}
          cart={addOnCart}
          getStock={getStock}
          onConfirm={confirmAddOnBundle}
          onClose={() => setBundlePicking(null)}
        />
      ) : null}
      <Toast message={toast.message} visible={toast.visible} variant={toast.variant} />
    </div>
  );
}

function checkoutDisabledB(preorder, payment, expectedTotalCollect) {
  if (!preorder) return true;
  if (!payment) return true;
  if (expectedTotalCollect <= 0) return true;
  // Cash 不足的提示由 onClick 串接 strings.js（A5），避免按鈕完全不可用
  return false;
}

