import { useEffect, useMemo, useState } from 'react';
import ProductCard from '../components/ProductCard.jsx';
import CartItemRow from '../components/CartItemRow.jsx';
import NumpadDigits from '../components/NumpadDigits.jsx';
import Toast from '../components/Toast.jsx';
import db, { createUUID } from '../db.js';
import { getTaipeiDateKey, getTaipeiTimeHMS } from '../lib/dateTaipei.js';
import { useToast } from '../lib/useToast.js';
import { parsePreordersCsvText } from '../lib/csv.js';
import { t } from '../i18n/t.js';
import { getString } from '../lib/strings.js';
import { readCsvFileWithEncoding, withBom } from '../lib/csvImport.js';
import { checkoutCta, ui } from '../lib/uiPalette.js';

const styles = {
  shadow: '0 8px 32px rgba(128,161,212,0.18), 0 2px 8px rgba(192,185,221,0.12)',
  page: {
    minHeight: '100vh',
    backgroundColor: 'transparent',
    paddingBottom: 132,
    fontFamily: 'DM Sans, sans-serif',
    color: ui.ink,
  },
  card: {
    background: 'rgba(255,255,255,0.58)',
    WebkitBackdropFilter: 'blur(20px)',
    backdropFilter: 'blur(20px)',
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.72)',
    boxShadow: '0 8px 32px rgba(128,161,212,0.18), 0 2px 8px rgba(192,185,221,0.12)',
    padding: 22,
  },
  preorderCard: (isPending) => ({
    background: 'rgba(255,255,255,0.58)',
    WebkitBackdropFilter: 'blur(20px)',
    backdropFilter: 'blur(20px)',
    borderRadius: 20,
    border: isPending
      ? '1px solid rgba(128,161,212,0.35)'
      : '1px solid rgba(255,255,255,0.55)',
    boxShadow: isPending
      ? '0 12px 32px rgba(128,161,212,0.22), 0 4px 14px rgba(192,185,221,0.12)'
      : '0 6px 20px rgba(192,185,221,0.14)',
    padding: 22,
    opacity: isPending ? 1 : 0.72,
  }),
  paymentPill: (active) => ({
    flex: 1,
    borderRadius: 999,
    padding: '12px 0',
    fontWeight: 800,
    fontSize: 13,
    border: active
      ? '1.5px solid rgba(255,255,255,0.35)'
      : '1.5px solid rgba(255,255,255,0.65)',
    // 現金和非現金都用同一套藍紫系，不再用珊瑚紅
    background: active
      ? 'linear-gradient(135deg, #9BBCE8 0%, #80A1D4 100%)'
      : 'rgba(255,255,255,0.52)',
    WebkitBackdropFilter: active ? 'none' : 'blur(10px)',
    backdropFilter: active ? 'none' : 'blur(10px)',
    color: active ? '#FFFFFF' : ui.muted,
    cursor: 'pointer',
    boxShadow: active
      ? '0 8px 20px rgba(128,161,212,0.36)'
      : '0 2px 8px rgba(192,185,221,0.12)',
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

function calcCartTotal(cart) {
  return cart.reduce((s, it) => s + (it.unitPrice ?? 0) * (it.qty ?? 0), 0);
}

export default function Preorders() {
  const [activeTab, setActiveTab] = useState('all'); // all | pending | done

  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [products, setProducts] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [preOrders, setPreOrders] = useState([]);

  const [importErrors, setImportErrors] = useState([]);
  const [importWarnings, setImportWarnings] = useState([]);
  const [importing, setImporting] = useState(false);

  const [activePreorderId, setActivePreorderId] = useState(null);
  const [pickupPaymentId, setPickupPaymentId] = useState(null);
  const [pickupCashInput, setPickupCashInput] = useState('0');

  // Add-on cart for B-type pickup
  const [addOnOpen, setAddOnOpen] = useState(false);
  const [addOnCart, setAddOnCart] = useState([]);

  const toast = useToast();

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

  const addOnTotal = useMemo(() => calcCartTotal(addOnCart), [addOnCart]);

  const addOnCartItemsForUI = useMemo(() => {
    return addOnCart.map((it) => ({
      ...it,
      name: it.name ?? '',
      unitPrice: it.unitPrice ?? 0,
      categoryIds: it.categoryIds ?? [],
    }));
  }, [addOnCart]);

  async function getSelectedEventOrThrow() {
    const evts = await db.events.toArray();
    const evt = evts.find((e) => e?.id === selectedEventId && !e?.archived) ?? null;
    if (!evt || !isValidDexieKey(evt.id)) {
      throw new Error('請先選擇活動');
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

  function formatEventDisplayName(name, date) {
    const cleanName = String(name ?? '').trim();
    const d = String(date ?? '').trim();
    if (!cleanName || !d) return '';
    const compact = d.replace(/-/g, '');
    const yymmdd = compact.length === 8 ? compact.slice(2) : compact;
    return `${cleanName}_${yymmdd}`;
  }

  async function addNewEvent() {
    const name = newEventName.trim();
    if (!name) return;
    const dateKey = getTaipeiDateKey(new Date());
    const displayName = formatEventDisplayName(name, dateKey);
    if (!displayName) return;
    const evt = {
      id: createUUID(),
      name: displayName,
      date: dateKey,
      status: 'active',
      archived: false,
      createdAt: Date.now(),
    };

    const evts = await db.events.toArray();
    await Promise.all(evts.map((e) => db.events.update(e.id, { status: 'inactive' })));
    await db.events.add(evt);

    setShowAddEvent(false);
    setNewEventName('');
    closePickup();
    await loadAll();
  }

  useEffect(() => {
    loadAll().catch((e) => console.error(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedEventId) {
      setPreOrders([]);
      return;
    }
    db.preOrders.toArray()
      .then((rows) => setPreOrders(rows.filter((x) => x?.eventId === selectedEventId)))
      .catch((e) => console.error(e));
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

  function pressClear() {
    setPickupCashInput('0');
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
    setAddOnCart((prev) => {
      const ex = prev.find((x) => x.productId === product.id);
      const stock = product.stock;
      const canClick = stock === null || typeof stock === 'undefined' || stock > 0;
      if (!canClick) return prev;

      if (!ex) {
        return [
          ...prev,
          {
            productId: product.id,
            name: product.name,
            unitPrice: product.price,
            qty: 1,
            color: product.color,
            categoryIds: product.categoryIds ?? [],
            stock,
          },
        ];
      }

      const maxQty = stock === null || typeof stock === 'undefined' ? Number.MAX_SAFE_INTEGER : stock;
      const nextQty = Math.min(maxQty, ex.qty + 1);
      if (nextQty === ex.qty) return prev;
      return prev.map((x) => (x.productId === product.id ? { ...x, qty: nextQty, stock } : x));
    });
  }

  function incAddOnQty(productId) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setAddOnCart((prev) =>
      prev.map((x) => {
        if (x.productId !== productId) return x;
        const maxQty = typeof p.stock === 'number' ? p.stock : Number.MAX_SAFE_INTEGER;
        return { ...x, qty: clampQty(x.qty + 1, 1, maxQty), stock: p.stock };
      }),
    );
  }

  function decAddOnQty(productId) {
    setAddOnCart((prev) =>
      prev.map((x) => {
        if (x.productId !== productId) return x;
        const maxQty = typeof x.stock === 'number' ? x.stock : Number.MAX_SAFE_INTEGER;
        return { ...x, qty: clampQty(x.qty - 1, 1, maxQty) };
      }),
    );
  }

  function removeAddOn(productId) {
    setAddOnCart((prev) => prev.filter((x) => x.productId !== productId));
  }

  function cartAddOnRows() {
    return addOnCartItemsForUI.map((it) => {
      const stock = it.stock;
      const maxQty = typeof stock === 'number' ? stock : Number.MAX_SAFE_INTEGER;
      return (
        <CartItemRow
          key={it.productId}
          item={it}
          onInc={() => incAddOnQty(it.productId)}
          onDec={() => decAddOnQty(it.productId)}
          onRemove={() => removeAddOn(it.productId)}
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
        setImportErrors(['請先選擇活動後再匯入 CSV。']);
        toast.show('請先選擇活動後再匯入 CSV。');
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
      toast.show('請先選擇活動');
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
      toast.show('請先選擇活動');
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

    const addOnTxItems = (addOnCart ?? []).map((it) => ({
      productId: it.productId,
      productName: it.name,
      qty: it.qty,
      unitPrice: it.unitPrice,
    }));

    const preorderTotal = preOrder.balanceDue ?? 0;
    const addOnTotalLocal = addOnTotal;

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

      // Reduce stock for add-ons
      for (const it of addOnCart ?? []) {
        if (!it.productId) continue;
        const prod = await db.products.get(it.productId);
        if (!prod) continue;
        if (typeof prod.stock === 'number') {
          await db.products.update(it.productId, { stock: Math.max(0, prod.stock - it.qty) });
        }
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

      let saleTx = null;
      if (addOnTxItems.length > 0 && addOnTotalLocal > 0) {
        const salePayment = {
          methodId: paymentForPickup.id,
          methodName: paymentForPickup.name,
          amount: addOnTotalLocal,
          isCash: paymentForPickup.isCash,
        };

        saleTx = {
          id: createUUID(),
          eventId: evt.id,
          date: taipeiDate,
          createdAt,
          time,
          type: 'sale',
          preorderId: null,
          items: addOnTxItems,
          subtotal: addOnTotalLocal,
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
    const sampleEvent = String(selectedEvent?.name ?? '請填入場次名稱，例如CWT72-250601');
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
          gap: 4,
          padding: '0 4px 12px',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
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
            style={{
              flex: 1,
              padding: '10px 8px',
              borderRadius: 20,
              fontWeight: 800,
              fontSize: 13,
              border: activeTab === tab.key
                ? '1.5px solid rgba(255,255,255,0.30)'
                : '1.5px solid rgba(255,255,255,0.58)',
              backgroundColor: activeTab === tab.key ? '#80A1D4' : 'rgba(255,255,255,0.38)',
              WebkitBackdropFilter: 'blur(10px)',
              backdropFilter: 'blur(10px)',
              color: activeTab === tab.key ? '#FFFFFF' : '#9A8898',
              cursor: 'pointer',
              boxShadow: activeTab === tab.key
                ? '0 6px 18px rgba(128,161,212,0.36)'
                : '0 1px 8px rgba(180,140,220,0.10)',
              transition: 'all 0.18s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 活動管理：切換/新增活動 */}
      <div style={{ padding: '0 8px 18px' }}>
        <div style={{ fontWeight: 900, fontSize: 13, color: ui.ink, marginBottom: 8, borderLeft: '3px solid rgba(128,161,212,0.60)', paddingLeft: 10 }}>活動管理</div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <select
            value={selectedEventId ?? ''}
            onChange={(e) => switchActiveEvent(e.target.value).catch((err) => console.error(err))}
            style={{
              width: '100%',
              borderRadius: 14,
              border: '1.5px solid rgba(255,255,255,0.55)',
              padding: '13px 16px',
              fontWeight: 800,
              fontSize: 14,
              color: '#2D1F3D',
              backgroundColor: 'rgba(255,255,255,0.48)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              boxShadow: '0 4px 14px rgba(180,140,220,0.10)',
              outline: 'none',
              appearance: 'none',
              WebkitAppearance: 'none',
              fontFamily: 'DM Sans, sans-serif',
              flex: 1,
            }}
          >
            {events.length === 0 ? <option value="">未設定活動</option> : null}
            {events.length > 0 ? <option value="">請選擇活動</option> : null}
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}（{e.date}）
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setShowAddEvent(true);
              setNewEventName('');
            }}
            style={{
              border: 'none',
              borderRadius: 14,
              padding: '13px 16px',
              background: 'linear-gradient(135deg, #9BBCE8 0%, #80A1D4 100%)',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: 14,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 6px 18px rgba(128,161,212,0.35)',
              flexShrink: 0,
            }}
          >
            ＋ 新增
          </button>
        </div>
      </div>

      {showAddEvent ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.35)',
            zIndex: 3000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 14,
          }}
        >
          <div
            className="glass-sheet"
            style={{ width: '100%', maxWidth: 420, borderRadius: 24, padding: 26, boxShadow: styles.shadow }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>新增活動</div>
              <button
                type="button"
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9A8898', fontWeight: 900 }}
                onClick={() => setShowAddEvent(false)}
              >
                {t('common.cancel')}
              </button>
            </div>

            <div style={{ marginTop: 12 }}>
              <input
                value={newEventName}
                onChange={(e) => setNewEventName(e.target.value)}
                placeholder="活動名稱（例如 CWT72 或 WCSxCWT_D1）"
                style={{
                  width: '100%',
                  borderRadius: 14,
                  border: 'none',
                  padding: '12px 12px',
                  fontWeight: 800,
                  outline: 'none',
                  boxShadow: styles.shadow,
                }}
              />
            </div>

            <button
              type="button"
              onClick={() => addNewEvent().catch((err) => console.error(err))}
              style={{
                width: '100%',
                marginTop: 14,
                borderRadius: 28,
                border: 'none',
                padding: '16px 10px',
                background: checkoutCta.gradient,
                color: '#FFFFFF',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 10px 20px rgba(128,161,212,0.35)',
              }}
              disabled={!newEventName.trim()}
            >
              新增並切換
            </button>
          </div>
        </div>
      ) : null}

      <div style={{ padding: '0 8px 22px' }}>
        <div style={{ fontWeight: 900, fontSize: 14, borderLeft: '3px solid rgba(128,161,212,0.60)', paddingLeft: 10 }}>{t('preorders.listTitle')}</div>
        <div style={{ color: '#9A8898', fontWeight: 800, fontSize: 12, marginTop: 6 }}>
          總 {preOrders.length} 筆 / 待取 {preOrders.filter((p) => p.status === 'pending').length} 筆
        </div>
        <div style={{ marginTop: 10 }}>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={getString('P2')}
            style={{
              width: '100%',
              borderRadius: 18,
              border: '1.5px solid rgba(255,255,255,0.55)',
              padding: '14px 16px',
              fontWeight: 800,
              fontSize: 14,
              color: '#2D1F3D',
              backgroundColor: 'rgba(255,255,255,0.48)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              boxShadow: '0 4px 14px rgba(180,140,220,0.10)',
              outline: 'none',
              fontFamily: 'DM Sans, sans-serif',
            }}
          />
        </div>
      </div>

      <div style={{ padding: '0 4px' }}>
        {importErrors.length > 0 ? (
          <div style={{ ...styles.card, marginBottom: 12, backgroundColor: 'rgba(255, 251, 245, 0.95)', boxShadow: styles.shadow }}>
            <div style={{ fontWeight: 900, color: '#DC8C14' }}>{t('preorders.importErrors')}</div>
            <ul style={{ margin: 0, paddingLeft: 18, color: '#9A8898', fontWeight: 800, fontSize: 12 }}>
              {importErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {importWarnings.length > 0 ? (
          <div style={{ ...styles.card, marginBottom: 12, backgroundColor: 'rgba(255, 252, 240, 0.95)', boxShadow: styles.shadow }}>
            <div style={{ fontWeight: 900, color: '#DC8C14' }}>警告（部分項目可能未匯入）</div>
            <ul style={{ margin: 0, paddingLeft: 18, color: '#9A8898', fontWeight: 800, fontSize: 12 }}>
              {importWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}

          <div style={{ ...styles.card, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 8 }}>
            <div style={{ fontWeight: 900 }}>{t('preorders.importTitle')}</div>
            <button
              type="button"
              onClick={downloadPreorderTemplate}
              style={{
                borderRadius: 24,
                padding: '10px 14px',
                fontWeight: 900,
                backgroundColor: 'rgba(255,255,255,0.48)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.52)',
                cursor: 'pointer',
                boxShadow: styles.shadow,
              }}
            >
              下載預購範本
            </button>
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
          <div style={{ color: '#9A8898', fontWeight: 800, fontSize: 11, marginTop: 8 }}>
            💡 提示：event_name 請填入後台顯示的場次名稱（如 CWT72_250601）。item_name 須與後台商品名稱完全一致，否則無法關聯庫存。
          </div>
        </div>

        {filteredPreOrders.length === 0 ? (
          <div style={{ color: '#9A8898', fontWeight: 800, padding: 20 }}>{t('preorders.noData')}</div>
        ) : (
          filteredPreOrders.map((o) => {
            const isPending = o.status === 'pending';
            const balanceDue = o.balanceDue ?? 0;
            const isA = balanceDue === 0;
            return (
              <div
                key={o.id}
                style={{ ...styles.preorderCard(isPending), marginBottom: 12, cursor: 'pointer' }}
                onClick={() => openPickup(o)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 18 }}>{o.buyerName}</div>
                    <div style={{ color: '#9A8898', fontWeight: 800, fontSize: 12, marginTop: 4 }}>
                      {t('preorders.orderLast5Label')} {o.phoneLast5}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    {isPending ? (
                      <div style={{ fontWeight: 900, color: '#DC8C14' }}>{t('preorders.status.pending')}</div>
                    ) : (
                      <div style={{ fontWeight: 900, color: '#9A8898' }}>{t('preorders.status.done')}</div>
                    )}
                    <div
                      style={{
                        marginTop: 6,
                        fontWeight: 900,
                        color: isA ? '#2A9E8A' : ui.primary,
                        fontSize: 12,
                      }}
                    >
                      {isA ? t('preorders.paidA') : `${t('preorders.paidBPrefix')}${balanceDue}`}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 10, color: ui.ink, fontWeight: 800, fontSize: 13 }}>
                  {preorderItemsSummary(o)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pickup panel */}
      {activePreorder ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.35)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'flex-end',
          }}
        >
          <div
            style={{
              width: '100%',
              borderRadius: '28px 28px 0 0',
              padding: 26,
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow:
                '0 -16px 44px rgba(0,0,0,0.1), 0 20px 40px rgba(0, 0, 0, 0.06), 0 4px 12px rgba(0, 0, 0, 0.03)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>{t('preorders.pickupTitle')}</div>
              <button type="button" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9A8898', fontWeight: 900 }} onClick={closePickup}>
                {t('common.close')}
              </button>
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 20 }}>{activePreorder.buyerName}</div>
              <div style={{ color: '#9A8898', fontWeight: 800, fontSize: 12, marginTop: 4 }}>
                {t('preorders.panelLast5Label')} {activePreorder.phoneLast5}
              </div>
            </div>

            <div style={{ marginTop: 12, ...styles.card }}>
              {preorderIsA ? (
                <>
                  <div style={{ color: ui.primary, fontWeight: 900 }}>{t('preorders.fullPaidLabel')}</div>
                  <div style={{ marginTop: 10 }}>
                    {(activePreorder.items ?? []).map((it, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', marginBottom: 4 }}>
                        <div style={{ fontWeight: 900 }}>{it.productName}</div>
                        <div style={{ color: '#9A8898', fontWeight: 800 }}>
                          {it.qty} 件 · NT${it.unitPrice} / 件
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontWeight: 900, color: '#2A9E8A', marginTop: 10 }}>
                    {t('preorders.fullPaidDetailPrefix')}
                    {activePreorder.totalPrice}
                  </div>
                  <button
                    type="button"
                    onClick={() => pickupA(activePreorder)}
                    style={{
                      width: '100%',
                      marginTop: 14,
                      padding: '16px 10px',
                      borderRadius: 28,
                      border: 'none',
                      color: '#FFFFFF',
                      fontWeight: 800,
                      fontSize: 18,
                      background: checkoutCta.gradient,
                      boxShadow: checkoutCta.shadow,
                    }}
                  >
                    {t('preorders.confirmA')}
                  </button>
                  <div style={{ marginTop: 10, color: '#9A8898', fontWeight: 800, fontSize: 12 }}>
                    {t('preorders.hintA')}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 900, fontSize: 14, color: ui.primary }}>{t('preorders.balanceDueLabel')}</div>
                  <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 900, fontSize: 12, color: '#9A8898' }}>
                      {t('preorders.balanceDueLabel')} NT${activePreorder.balanceDue}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 36, color: ui.ink }}>{`NT$${activePreorder.balanceDue}`}</div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      onClick={() => setAddOnOpen((v) => !v)}
                      style={{
                        width: '100%',
                        borderRadius: 28,
                        border: 'none',
                        backgroundColor: 'rgba(128,161,212,0.08)',
                        padding: '14px 10px',
                        fontWeight: 800,
                        color: ui.primary,
                        cursor: 'pointer',
                        boxShadow: styles.shadow,
                      }}
                    >
                      {t('preorders.addonButton')}
                    </button>
                  </div>

                  {addOnOpen ? (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontWeight: 900, marginBottom: 10 }}>{t('preorders.addonTitle')}</div>
                      {addOnCartItemsForUI.length === 0 ? (
                        <div style={{ color: '#9A8898', fontWeight: 800, padding: 8 }}>{t('preorders.addonEmpty')}</div>
                      ) : (
                        <div style={{ marginBottom: 12 }}>
                          {cartAddOnRows()}
                          <div style={{ fontWeight: 900, fontSize: 18, color: ui.primary, textAlign: 'right', marginTop: 6 }}>
                            加購小計 NT${addOnTotal}
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
                        {products.slice(0, 12).map((p) => {
                          const cartQty = addOnCart.find((x) => x.productId === p.id)?.qty ?? 0;
                          return (
                            <ProductCard
                              key={p.id}
                              product={p}
                              cartQty={cartQty}
                              onClick={() => addOnToCart(p)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div style={{ marginTop: 12, ...styles.card, padding: 20, backgroundColor: 'rgba(255,255,255,0.48)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.52)' }}>
                    <div style={{ fontWeight: 900, fontSize: 12, color: '#9A8898' }}>應收總額（尾款＋加購）</div>
                    <div style={{ marginTop: 4, fontWeight: 800, fontSize: 32, color: ui.ink, textAlign: 'right' }}>
                      NT${expectedTotalCollect}
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontWeight: 900, color: ui.ink }}>{t('preorders.paymentTitle')}</div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                      {paymentMethods
                        .filter((m) => m.enabled)
                        .slice(0, 3)
                        .map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            style={styles.paymentPill(pickupPaymentId === m.id, m.isCash)}
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
                      <div style={{ fontWeight: 900, fontSize: 12, color: '#9A8898', marginBottom: 6 }}>實收金額</div>
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
                        style={{
                          width: '100%',
                          borderRadius: 14,
                          border: 'none',
                          padding: '12px 12px',
                          fontWeight: 800,
                          outline: 'none',
                          boxShadow: styles.shadow,
                        }}
                      />
                    </div>
                    <NumpadDigits
                      value={cashValue}
                      disabled={false}
                      onDigit={(n) => pressDigit(n)}
                      onClear={pressClear}
                      onBackspace={pressBackspace}
                    />
                    <div
                      style={{
                        textAlign: 'right',
                        marginTop: 10,
                        fontWeight: 800,
                        fontSize: 22,
                        color: cashInsufficient ? ui.primary : '#2A9E8A',
                      }}
                    >
                      {`${getString('S9')}${changeAmount}`}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (paymentForPickup?.isCash && !isCashSufficient) {
                        toast.show(getString('A3'));
                        return;
                      }
                      pickupB(activePreorder);
                    }}
                    disabled={checkoutDisabledB(activePreorder, paymentForPickup, expectedTotalCollect, pickupCashInput)}
                    style={{
                      width: '100%',
                      marginTop: 14,
                      padding: '16px 10px',
                      borderRadius: 28,
                      border: 'none',
                      color: '#FFFFFF',
                      fontWeight: 800,
                      fontSize: 18,
                      background: checkoutCta.gradient,
                      opacity: !isCashSufficient ? 0.6 : 1,
                      cursor: !isCashSufficient ? 'not-allowed' : 'pointer',
                      boxShadow: checkoutCta.shadow,
                    }}
                  >
                    {t('preorders.finishB')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
}

function clampQty(qty, min, max) {
  const n = Number.isFinite(qty) ? qty : min;
  return Math.max(min, Math.min(max, n));
}

function checkoutDisabledB(preorder, payment, expectedTotalCollect, pickupCashInput) {
  if (!preorder) return true;
  if (!payment) return true;
  if (expectedTotalCollect <= 0) return true;
  // Cash 不足的提示由 onClick 串接 strings.js（A5），避免按鈕完全不可用
  return false;
}

