import { useCallback, useEffect, useState } from 'react';
import Sales from './pages/Sales.jsx';
import Preorders from './pages/Preorders.jsx';
import AdminProducts from './pages/AdminProducts.jsx';
import Reports from './pages/Reports.jsx';
import db from './db.js';
import { ensureSeedData } from './lib/seed.js';
import { t } from './i18n/t.js';
import { getTaipeiDateKey, getTaipeiNextMidnightMs } from './lib/dateTaipei.js';
import { ShoppingCart, Package, BarChart2, Settings } from 'lucide-react';

const styles = {
  app: {
    fontFamily: 'DM Sans, sans-serif',
    backgroundColor: 'transparent',
    minHeight: '100vh',
  },

  // ── Header：壓扁 + 圓底角 ──
  header: {
    padding: '10px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'rgba(255,255,255,0.48)',
    WebkitBackdropFilter: 'blur(24px)',
    backdropFilter: 'blur(24px)',
    borderBottom: '1px solid rgba(255,255,255,0.62)',
    borderRadius: '0 0 20px 20px',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    boxShadow: '0 6px 24px rgba(128,161,212,0.14)',
  },
  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 900,
    color: '#3D3060',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    lineHeight: 1,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  headerStatus: {
    fontSize: 11,
    fontWeight: 700,
    color: '#8B85A0',
  },
  headerLinkBase: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none',
    fontWeight: 800,
    fontSize: 11,
    padding: '6px 11px',
    borderRadius: 999,
    WebkitBackdropFilter: 'blur(10px)',
    backdropFilter: 'blur(10px)',
  },
  contactLink: {
    border: '1.5px solid rgba(255,255,255,0.70)',
    background: 'rgba(255,255,255,0.52)',
    color: '#8B85A0',
  },
  donateLink: {
    border: '1.5px solid rgba(255,255,255,0.35)',
    background: 'linear-gradient(135deg, #9BBCE8 0%, #80A1D4 100%)',
    color: '#FFFFFF',
    boxShadow: '0 4px 12px rgba(128,161,212,0.35)',
  },

  // ── Content：bottom padding 配合新 nav 高度 ──
  contentPad: {
    padding: '20px 18px 94px', // top 20px 統一控制，全部頁面都從這裡算
  },

  // ── Nav：浮島風格 ──
  navWrap: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '0 12px calc(10px + env(safe-area-inset-bottom, 0px))',
    zIndex: 999,
    pointerEvents: 'none',       // wrap 本身不攔截點擊
  },
  nav: {
    height: 62,
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    background: 'rgba(255,255,255,0.52)',
    WebkitBackdropFilter: 'blur(24px)',
    backdropFilter: 'blur(24px)',
    border: '1px solid rgba(255,255,255,0.72)',
    borderRadius: 20,
    boxShadow: '0 8px 28px rgba(128,161,212,0.18), inset 0 1px 0 rgba(255,255,255,0.80)',
    padding: '0 8px',
    pointerEvents: 'auto',       // 裡面的按鈕正常接收點擊
  },
  navBtn: (active) => ({
    flex: 1,
    border: 'none',
    background: active
      ? 'linear-gradient(135deg, #9BBCE8 0%, #80A1D4 100%)'
      : 'transparent',
    WebkitBackdropFilter: 'none',
    backdropFilter: 'none',
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: 11,
    color: active ? '#FFFFFF' : '#8B85A0',
    padding: '8px 6px',
    borderRadius: 14,
    boxShadow: active ? '0 4px 14px rgba(128,161,212,0.38)' : 'none',
    transition: 'all 0.18s ease',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
  }),
};

export default function App() {
  const [activeTab, setActiveTab] = useState('sales');
  const [seedReady, setSeedReady] = useState(false);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [taipeiDayKey, setTaipeiDayKey] = useState(getTaipeiDateKey(new Date()));

  const refreshProducts = useCallback(async () => {
    const p = await db.products.toArray();
    setProducts(p);
    const categoryRows = await db.categories.orderBy('sortOrder').toArray();
    const uniqueCategories = [
      { id: '全部', name: '全部' },
      ...categoryRows.map((c) => ({ id: c.id, name: c.name })),
    ];
    setCategories(uniqueCategories);
  }, []);

  useEffect(() => {
    ensureSeedData()
      .then(() => refreshProducts())
      .catch((e) => console.error(e))
      .finally(() => setSeedReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let timer = null;
    function scheduleNextCheck() {
      const waitMs = getTaipeiNextMidnightMs(new Date());
      timer = setTimeout(async () => {
        const nextKey = getTaipeiDateKey(new Date());
        setTaipeiDayKey((prev) => (prev === nextKey ? prev : nextKey));
        await refreshProducts();
        scheduleNextCheck();
      }, waitMs);
    }
    scheduleNextCheck();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [refreshProducts]);

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <h1 style={styles.title}>
          <img
            src="/utakasse-logo.png"
            alt="UtaKasse Logo"
            style={{ height: '36px', width: 'auto', marginRight: '10px', verticalAlign: 'middle', borderRadius: 8 }}
          />
          {t('app.title')}
        </h1>
        <div style={styles.headerActions}>
          <div style={styles.headerStatus}>{t('app.offline')}</div>
          <a
            href="https://line.me/R/ti/p/@848nhrpd"
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...styles.headerLinkBase, ...styles.contactLink }}
          >
            聯絡開發者
          </a>
          <a
            href="https://ko-fi.com/utakasse"
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...styles.headerLinkBase, ...styles.donateLink }}
          >
            斗內開發者
          </a>
        </div>
      </header>

      <div style={styles.contentPad}>
        {!seedReady ? (
          <div style={{ padding: 22, color: '#9A8898', fontWeight: 800 }}>載入資料中…</div>
        ) : (
          <>
            {activeTab === 'sales' ? <Sales key={`sales-${taipeiDayKey}`} products={products} categories={categories} refreshProducts={refreshProducts} /> : null}
            {activeTab === 'preorders' ? <Preorders /> : null}
            {activeTab === 'reports' ? <Reports key={`reports-${taipeiDayKey}`} /> : null}
            {activeTab === 'admin' ? <AdminProducts products={products} refreshProducts={refreshProducts} /> : null}
          </>
        )}
      </div>

      <div style={styles.navWrap}>
        <nav style={styles.nav}>
          <button type="button" style={styles.navBtn(activeTab === 'sales')} onClick={() => setActiveTab('sales')}>
            <ShoppingCart size={15} />
            {t('nav.sales')}
          </button>
          <button type="button" style={styles.navBtn(activeTab === 'preorders')} onClick={() => setActiveTab('preorders')}>
            <Package size={15} />
            {t('nav.preorders')}
          </button>
          <button type="button" style={styles.navBtn(activeTab === 'reports')} onClick={() => setActiveTab('reports')}>
            <BarChart2 size={15} />
            {t('nav.reports')}
          </button>
          <button type="button" style={styles.navBtn(activeTab === 'admin')} onClick={() => setActiveTab('admin')}>
            <Settings size={15} />
            {t('nav.admin')}
          </button>
        </nav>
      </div>
    </div>
  );
}