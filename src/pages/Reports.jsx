import React, { useEffect, useMemo, useState } from 'react';
import db from '../db.js';
import { getTaipeiDateKey } from '../lib/dateTaipei.js';
import { useToast } from '../lib/useToast.js';
import { t } from '../i18n/t.js';
import { ensureSeedData } from '../lib/seed.js';
import { getString } from '../lib/strings.js';
import Toast from '../components/Toast.jsx';
import {
  buildRevenueCsvForEventDate,
  downloadCsvFiles,
  calcTodayRevenueSummaryForEventDate,
  calcTxKind,
} from '../lib/reporting.js';
import { ui } from '../lib/uiPalette.js';
import { Download } from 'lucide-react';

export default function Reports() {
  const [transactions, setTransactions] = useState([]);
  const [selectedDateKey, setSelectedDateKey] = useState(getTaipeiDateKey(new Date()));
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);

  const toast = useToast();

  async function loadData() {
    const [txs, evts] = await Promise.all([db.transactions.toArray(), db.events.toArray()]);
    setTransactions(txs);
    setEvents(evts);
    const active = evts.find((e) => e.status === 'active');
    setSelectedEventId((prev) => prev ?? (active?.id ?? evts[0]?.id ?? null));
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
    await loadData();
  }

  useEffect(() => {
    loadData().catch((e) => console.error(e));
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

  useEffect(() => {
    if (!dateKeys.length) return;
    if (dateKeys.includes(selectedDateKey)) return;
    setSelectedDateKey(dateKeys[0]);
  }, [dateKeys, selectedDateKey]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'transparent', paddingBottom: 132, fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ fontWeight: 900, fontSize: 16, color: ui.ink }}>{t('reports.title')}</div>
        <div style={{ color: '#9A8898', fontWeight: 800, fontSize: 12, marginTop: 6 }}>
          {t('reports.subtitle')}
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ fontWeight: 900, fontSize: 13, color: ui.ink }}>{t('reports.eventLabel')}</div>
          <select
            value={selectedEventId ?? ''}
            onChange={(e) => setSelectedEventId(e.target.value)}
            style={{
              width: '100%',
              marginTop: 12,
              borderRadius: 18,
              padding: '14px 16px',
              backgroundColor: 'rgba(255,255,255,0.58)',
              WebkitBackdropFilter: 'blur(16px)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.55)',
              fontWeight: 800,
              color: ui.ink,
              outline: 'none',
              boxShadow: '0 12px 36px rgba(180,140,220,0.18), 0 3px 10px rgba(180,140,220,0.10)',
            }}
          >
            {events.length === 0 ? <option value="">未設定活動</option> : null}
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.archived ? '【封存唯讀】' : ''}{e.name}（{e.date}）
              </option>
            ))}
          </select>
          {selectedEventIsArchived ? (
            <div
              style={{
                marginTop: 8,
                display: 'inline-flex',
                alignItems: 'center',
                borderRadius: 999,
                padding: '6px 10px',
                backgroundColor: 'rgba(154,136,152,0.14)',
                color: '#9A8898',
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              封存活動（唯讀）：僅供報表查詢，不會連動銷售/預購
            </div>
          ) : null}
        </div>

        <div style={{ marginTop: 18, ...stylesDateSummary }}>
          <div style={{ color: ui.ink, fontWeight: 900 }}>本日營收</div>
          <div style={{ marginTop: 6, fontWeight: 800, color: ui.ink, fontSize: 22 }}>商品銷售：NT${saleTotal}</div>
          <div style={{ marginTop: 4, fontWeight: 800, color: '#2A9E8A', fontSize: 22 }}>預購B尾款：NT${preorderBTotal}</div>
          <div style={{ marginTop: 8, fontWeight: 900, fontSize: 26, color: ui.ink }}>✦ 今日現場實收合計：NT${todayRealTotal}</div>
          <div style={{ marginTop: 10, fontWeight: 800, color: '#9A8898', fontSize: 12 }}>── 以下為參考數字，不計入現場實收 ──</div>
          <div style={{ marginTop: 6, fontWeight: 800, color: ui.ink, fontSize: 16 }}>
            預購A 場外已付：NT${preorderARefTotal}
            <span style={{ color: '#9A8898', fontSize: 12 }}>（活動前已收，{preorderARefCount} 筆）</span>
          </div>
          <div style={{ marginTop: 4, fontWeight: 800, color: ui.ink, fontSize: 16 }}>
            通販：NT${onlineStoreTotal}
            <span style={{ color: '#9A8898', fontSize: 12 }}>（賣貨便等平台，{onlineStoreCount} 筆）</span>
          </div>
          <div style={{ marginTop: 10, fontWeight: 900, fontSize: 30, color: ui.ink }}>所有管道總計：NT${allTotal}</div>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ fontWeight: 900, fontSize: 13, color: ui.ink }}>歷史紀錄（日期）</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 14 }}>
            {dateKeys.length === 0 ? (
              <div style={{ color: '#9A8898', fontWeight: 800 }}>目前沒有交易紀錄。</div>
            ) : (
              dateKeys.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSelectedDateKey(k)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    borderRadius: 20,
                    padding: '13px 16px',
                    border: selectedDateKey === k
                      ? '1.5px solid rgba(128,161,212,0.45)'
                      : '1.5px solid rgba(255,255,255,0.65)',
                    background: selectedDateKey === k
                      ? 'rgba(128,161,212,0.12)'
                      : 'rgba(255,255,255,0.52)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    cursor: 'pointer',
                    boxShadow: selectedDateKey === k
                      ? '0 6px 20px rgba(128,161,212,0.18)'
                      : '0 3px 12px rgba(192,185,221,0.12)',
                  }}
                >
                  <div style={{ fontWeight: 800, color: selectedDateKey === k ? ui.primary : ui.ink }}>{k}</div>
                  <div style={{ color: selectedDateKey === k ? 'rgba(128,161,212,0.85)' : ui.muted, fontWeight: 700, fontSize: 12, marginTop: 4 }}>
                    {txsCountText(txsForEvent, k)}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <button
            type="button"
            onClick={() => {
              const { files } = buildRevenueCsvForEventDate({
                eventName: selectedEvent?.name,
                dateKey: selectedDateKey,
                transactions: txsForEvent,
              });
              downloadCsvFiles(files);
            }}
            disabled={txsForSelected.length === 0}
            style={{
              width: '100%',
              borderRadius: 28,
              padding: '18px 14px',
              background: txsForSelected.length === 0
                ? 'rgba(192,185,221,0.28)'
                : 'linear-gradient(135deg, #9BBCE8 0%, #80A1D4 100%)',
              border: txsForSelected.length === 0
                ? '1.5px solid rgba(192,185,221,0.35)'
                : '1.5px solid rgba(255,255,255,0.35)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              color: txsForSelected.length === 0 ? '#8B85A0' : '#FFFFFF',
              fontWeight: 800,
              cursor: txsForSelected.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: 16,
              boxShadow: txsForSelected.length === 0
                ? 'none'
                : '0 8px 22px rgba(128,161,212,0.42)',
            }}
          >
            <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap: 8 }}>
              <Download size={16} />
              {t('reports.export')}（交易+摘要｜{selectedDateKey}）
            </span>
          </button>
        </div>

        {/* 數據管理（清空）=> Toast A6 */}
        <div style={{ marginTop: 34, marginBottom: 42 }}>
          <button
            type="button"
            onClick={() => clearAllDataAndToast().catch((e) => console.error(e))}
            style={{
              borderRadius: 20,
              padding: '12px 20px',
              border: '1.5px solid rgba(91,77,138,0.28)',
              background: 'rgba(220,215,240,0.55)',
              WebkitBackdropFilter: 'blur(10px)',
              backdropFilter: 'blur(10px)',
              color: '#5B4D8A',
              fontWeight: 800,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {getString('R5')}
          </button>
        </div>
      </div>

      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
}

const stylesDateSummary = {
  background: 'rgba(255,255,255,0.58)',
  WebkitBackdropFilter: 'blur(20px)',
  backdropFilter: 'blur(20px)',
  borderRadius: 20,
  border: '1px solid rgba(255,255,255,0.72)',
  boxShadow: '0 8px 32px rgba(128,161,212,0.18), 0 2px 8px rgba(192,185,221,0.12)',
  padding: 22,
};

function txsCountText(transactions, dateKey) {
  const txs = transactions.filter((t) => t.date === dateKey);
  const saleCount = txs.filter((t) => calcTxKind(t) === '現場').length;
  const preorderBCount = txs.filter((t) => calcTxKind(t) === '預購B').length;
  const aCount = txs.filter((t) => calcTxKind(t) === '預購A').length;
  const onlineStoreCount = txs.filter((t) => calcTxKind(t) === '通販').length;
  return `現場 ${saleCount} 筆 / 預購B ${preorderBCount} 筆 / 預購A ${aCount} 筆 / 通販 ${onlineStoreCount} 筆`;
}