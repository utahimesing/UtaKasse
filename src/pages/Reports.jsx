import { useEffect, useMemo, useState } from 'react';
import db from '../db.js';
import { getTaipeiDateKey } from '../lib/dateTaipei.js';
import { useToast } from '../lib/useToast.js';
import { t } from '../i18n/t.js';
import Toast from '../components/Toast.jsx';
import Button from '../components/Button.jsx';
import TxDetailList from '../components/TxDetailList.jsx';
import {
  buildRevenueCsvForEventDate,
  downloadCsvFiles,
  calcTodayRevenueSummaryForEventDate,
  calcTxKind,
} from '../lib/reporting.js';
import { exportSalesXlsx } from '../lib/exportXlsx.js';
import { ui, border, shadow, surface } from '../lib/uiPalette.js';
import { Download } from 'lucide-react';

const styles = {
  h1: { fontWeight: 800, fontSize: 28, color: ui.ink, letterSpacing: '-0.01em', lineHeight: 1.1 },
  h1Bar: { width: 48, height: 6, background: ui.orange, border: border.solidSm, marginTop: 8 },
  caption: { color: ui.muted, fontWeight: 600, fontSize: 12 },
  label: { fontWeight: 800, fontSize: 14, color: ui.ink },
  select: {
    width: '100%',
    marginTop: 10,
    borderRadius: 10,
    padding: '12px 14px',
    minHeight: 44,
    backgroundColor: ui.white,
    border: border.solidSm,
    fontWeight: 700,
    fontSize: 15,
    color: ui.ink,
    boxSizing: 'border-box',
  },
  // 總營收：橘色色塊卡片＋ Display 字級
  heroCard: {
    ...surface.card,
    background: ui.orange,
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  // 報表頁頂部裝飾 sticker（青綠星爆，偏右上）
  heroSticker: {
    position: 'absolute', top: -10, right: -6,
    width: 64, height: 64,
    background: ui.teal,
    clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
    pointerEvents: 'none',
  },
  display: { fontSize: 40, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1, color: ui.ink, marginTop: 6, wordBreak: 'break-all' },
  metricCard: { ...surface.card, boxShadow: shadow.sm, padding: 16 },
  metricValue: { fontSize: 22, fontWeight: 800, color: ui.ink, letterSpacing: '-0.01em', marginTop: 4 },
  dateBtn: (active) => ({
    width: '100%',
    textAlign: 'left',
    borderRadius: 10,
    padding: '12px 14px',
    minHeight: 44,
    border: border.solidSm,
    background: active ? ui.apricot : ui.white,
    color: ui.ink,
    cursor: 'pointer',
    boxShadow: active ? shadow.sm : 'none',
  }),
  csvLink: {
    display: 'block', width: '100%', marginTop: 10, minHeight: 44,
    background: 'transparent', border: 'none', color: ui.muted,
    fontWeight: 600, fontSize: 12, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit',
  },
};

export default function Reports() {
  const [transactions, setTransactions] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [pickedDateKey, setPickedDateKey] = useState(null); // null = 自動（今天或最新一天）
  const [exporting, setExporting] = useState(false);

  const toast = useToast();

  async function loadData() {
    const [txs, evts, prods, cats] = await Promise.all([
      db.transactions.toArray(),
      db.events.toArray(),
      db.products.toArray(),
      db.categories.orderBy('sortOrder').toArray(),
    ]);
    setTransactions(txs);
    setEvents(evts);
    setProducts(prods);
    setCategories(cats);
    const active = evts.find((e) => e.status === 'active');
    setSelectedEventId((prev) => prev ?? (active?.id ?? evts[0]?.id ?? null));
  }

  useEffect(() => {
    // 初次載入（非同步，不在 effect 內同步 setState）
    Promise.resolve().then(() => loadData()).catch((e) => console.error(e));
  }, []);

  const selectedEvent = useMemo(() => events.find((e) => e.id === selectedEventId) ?? null, [events, selectedEventId]);
  const selectedEventIsArchived = !!selectedEvent?.archived;

  const txsForEvent = useMemo(() => {
    if (!selectedEventId) return transactions;
    return transactions.filter((t) => t.eventId === selectedEventId);
  }, [transactions, selectedEventId]);

  const dateKeys = useMemo(() => {
    const keys = Array.from(new Set(txsForEvent.map((t) => t.date).filter(Boolean)));
    keys.sort((a, b) => (a < b ? 1 : -1));
    return keys;
  }, [txsForEvent]);

  // 選定日期：使用者點過就用那一天（若還存在）；否則今天；今天沒交易就用最新一天。
  // 在 render 時算出來，不用 effect 裡 setState，不會有收斂問題。
  const selectedDateKey = useMemo(() => {
    const today = getTaipeiDateKey(new Date());
    if (pickedDateKey && dateKeys.includes(pickedDateKey)) return pickedDateKey;
    if (dateKeys.length === 0 || dateKeys.includes(today)) return today;
    return dateKeys[0];
  }, [pickedDateKey, dateKeys]);

  const txsForSelected = useMemo(() => {
    return txsForEvent.filter((t) => t.date === selectedDateKey);
  }, [txsForEvent, selectedDateKey]);

  const {
    saleTotal,
    preorderBTotal,
    todayRealTotal,
    preorderARefTotal,
    preorderARefCount,
    onlineStoreTotal,
    onlineStoreCount,
    allTotal,
  } = useMemo(
    () => calcTodayRevenueSummaryForEventDate({ dateKey: selectedDateKey, transactions: txsForEvent }),
    [selectedDateKey, txsForEvent],
  );

  const canExport = txsForSelected.length > 0 && !exporting;

  async function onExportXlsx() {
    if (!canExport) return;
    setExporting(true);
    try {
      const filename = await exportSalesXlsx({
        eventName: selectedEvent?.name,
        dateKey: selectedDateKey,
        transactions: txsForEvent,
        products,
        categories,
      });
      toast.show(filename, 'success');
    } catch (e) {
      console.error(e);
      toast.show(`${t('reports.exportFailed')}：${e instanceof Error ? e.message : '未知錯誤'}`, 'error');
    } finally {
      setExporting(false);
    }
  }

  function onExportCsv() {
    const { files } = buildRevenueCsvForEventDate({
      eventName: selectedEvent?.name,
      dateKey: selectedDateKey,
      transactions: txsForEvent,
    });
    downloadCsvFiles(files).catch((e) => console.error(e));
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'transparent', paddingBottom: 40, fontFamily: 'inherit', color: ui.ink }}>
      <div style={{ padding: '0 2px 20px' }}>
        <div style={styles.h1}>{t('reports.title')}</div>
        <div style={styles.h1Bar} />
        <div style={{ ...styles.caption, marginTop: 8 }}>
          {t('reports.subtitle')}
        </div>

        <div style={{ marginTop: 22 }}>
          <div style={styles.label}>{t('reports.eventLabel')}</div>
          <select
            value={selectedEventId ?? ''}
            onChange={(e) => setSelectedEventId(e.target.value)}
            style={styles.select}
          >
            {events.length === 0 ? <option value="">{t('reports.noEvent')}</option> : null}
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.archived ? t('reports.archivedPrefix') : ''}{e.name}（{e.date}）
              </option>
            ))}
          </select>
          {selectedEventIsArchived ? (
            <div
              style={{
                marginTop: 10,
                display: 'inline-flex',
                alignItems: 'center',
                borderRadius: 999,
                padding: '6px 10px',
                border: border.solidSm,
                backgroundColor: ui.mint,
                color: ui.ink,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {t('reports.archivedNote')}
            </div>
          ) : null}
        </div>

        {/* 本日營收：主指標放橘色色塊 */}
        <div style={{ marginTop: 22, ...styles.heroCard }}>
          <div style={styles.heroSticker} aria-hidden="true" />
          <div style={{ fontWeight: 800, fontSize: 20, color: ui.ink }}>{t('reports.todayTitle')}</div>
          <div style={{ ...styles.caption, color: ui.ink, marginTop: 10 }}>✦ 今日現場實收合計・{selectedDateKey}</div>
          <div style={styles.display}>NT${todayRealTotal}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
            <div style={{ ...styles.metricCard, padding: 12 }}>
              <div style={styles.caption}>商品銷售</div>
              <div style={styles.metricValue}>NT${saleTotal}</div>
            </div>
            <div style={{ ...styles.metricCard, padding: 12, background: ui.teal }}>
              <div style={{ ...styles.caption, color: ui.ink }}>預購B尾款</div>
              <div style={styles.metricValue}>NT${preorderBTotal}</div>
            </div>
          </div>
        </div>

        {/* 本日交易明細（可收合） */}
        <div style={{ marginTop: 20 }}>
          <TxDetailList transactions={txsForEvent} dateKey={selectedDateKey} />
        </div>

        {/* 參考數字：白色次要指標卡 */}
        <div style={{ marginTop: 20, ...styles.metricCard }}>
          <div style={styles.caption}>── 以下為參考數字，不計入現場實收 ──</div>
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, borderBottom: `1px solid ${ui.lineSoft}`, paddingBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>預購A 場外已付</div>
              <div style={styles.caption}>場次前已收，{preorderARefCount} 筆</div>
            </div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>NT${preorderARefTotal}</div>
          </div>
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, borderBottom: `1px solid ${ui.lineSoft}`, paddingBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>通販</div>
              <div style={styles.caption}>賣貨便等平台，{onlineStoreCount} 筆</div>
            </div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>NT${onlineStoreTotal}</div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>所有管道總計</div>
            <div style={{ fontWeight: 800, fontSize: 28, letterSpacing: '-0.02em' }}>NT${allTotal}</div>
          </div>
        </div>

        <div style={{ marginTop: 22 }}>
          <div style={styles.label}>{t('reports.history')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
            {dateKeys.length === 0 ? (
              <div style={{ color: ui.muted, fontWeight: 700 }}>{t('reports.noTx')}</div>
            ) : (
              dateKeys.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setPickedDateKey(k)}
                  style={styles.dateBtn(selectedDateKey === k)}
                >
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{k}</div>
                  <div style={{ ...styles.caption, marginTop: 4 }}>
                    {txsCountText(txsForEvent, k)}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div style={{ marginTop: 22 }}>
          <Button
            variant="primary"
            size="lg"
            disabled={!canExport}
            loading={exporting}
            onClick={onExportXlsx}
            style={{ width: '100%', boxShadow: canExport ? shadow.md : 'none' }}
            leftIcon={<Download size={16} />}
          >
            {exporting ? t('reports.exporting') : `${t('reports.export')}（${selectedDateKey}）`}
          </Button>
          <button type="button" style={styles.csvLink} disabled={txsForSelected.length === 0} onClick={onExportCsv}>
            {t('reports.exportCsv')}
          </button>
        </div>
      </div>

      <Toast message={toast.message} visible={toast.visible} variant={toast.variant} />
    </div>
  );
}

function txsCountText(transactions, dateKey) {
  const txs = transactions.filter((t) => t.date === dateKey);
  const saleCount = txs.filter((t) => calcTxKind(t) === '現場').length;
  const preorderBCount = txs.filter((t) => calcTxKind(t) === '預購B').length;
  const aCount = txs.filter((t) => calcTxKind(t) === '預購A').length;
  const onlineStoreCount = txs.filter((t) => calcTxKind(t) === '通販').length;
  return `現場 ${saleCount} 筆 / 預購B ${preorderBCount} 筆 / 預購A ${aCount} 筆 / 通販 ${onlineStoreCount} 筆`;
}
