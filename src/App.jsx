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
import { ui, border, shadow } from './lib/uiPalette.js';

const styles = {
  app: {
    fontFamily: 'inherit',
    backgroundColor: 'transparent',
    minHeight: '100vh',
  },

  // ── Header：白底＋黑框＋硬陰影，底部兩角圓 18px ──
  header: {
    padding: '10px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    background: ui.white,
    border: border.solid,
    borderTop: 'none',
    borderRadius: '0 0 18px 18px',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    boxShadow: shadow.md,
  },
  title: {
    margin: 0,
    fontSize: 17,
    fontWeight: 800,
    letterSpacing: '-0.01em',
    color: ui.ink,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    lineHeight: 1,
    minWidth: 0,
  },
  // Logo 旁的橘色 sticker（裝飾，只放 Header）
  logoSticker: {
    width: 14, height: 14, flexShrink: 0,
    background: ui.orange,
    border: border.solidSm,
    borderRadius: 999,
    transform: 'translateY(-8px)',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  // 小型 outline 按鈕：白底＋黑框＋shadow-sm
  headerLink: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none',
    fontWeight: 700,
    fontSize: 11,
    padding: '6px 10px',
    borderRadius: 999,
    border: border.solidSm,
    background: ui.white,
    color: ui.ink,
    boxShadow: shadow.sm,
    whiteSpace: 'nowrap',
  },
  donateLink: {
    background: ui.apricot,
  },

  // ── Content：bottom padding 配合 nav 高度 ──
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
    background: ui.white,
    border: border.solid,
    borderRadius: 18,
    boxShadow: shadow.md,
    padding: '0 8px',
    gap: 4,
    pointerEvents: 'auto',       // 裡面的按鈕正常接收點擊
  },
  navBtn: (active) => ({
    flex: 1,
    minHeight: 44,
    border: active ? border.solidSm : '2px solid transparent',
    background: active ? ui.orange : 'transparent',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 11,
    color: ui.ink,
    padding: '6px 4px',
    borderRadius: 10,
    boxShadow: 'none',
    transition: 'background 0.15s ease',
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
            style={{ height: 36, width: 'auto', verticalAlign: 'middle', borderRadius: 8, border: border.solidSm }}
          />
          <span style={styles.logoSticker} aria-hidden="true" />
          {t('app.title')}
        </h1>
        <div style={styles.headerActions}>
          <a
            href="https://utakasse-playbook.netlify.app/"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.headerLink}
          >
            操作說明
          </a>
          <a
            href="https://line.me/R/ti/p/@848nhrpd"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.headerLink}
          >
            聯絡開發者
          </a>
          <a
            href="https://ko-fi.com/utakasse"
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...styles.headerLink, ...styles.donateLink }}
          >
            斗內開發者
          </a>
        </div>
      </header>

      <div style={styles.contentPad}>
        {!seedReady ? (
          <div style={{ padding: 22, color: ui.muted, fontWeight: 700 }}>載入資料中…</div>
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
            <ShoppingCart size={16} color={ui.ink} />
            {t('nav.sales')}
          </button>
          <button type="button" style={styles.navBtn(activeTab === 'preorders')} onClick={() => setActiveTab('preorders')}>
            <Package size={16} color={ui.ink} />
            {t('nav.preorders')}
          </button>
          <button type="button" style={styles.navBtn(activeTab === 'reports')} onClick={() => setActiveTab('reports')}>
            <BarChart2 size={16} color={ui.ink} />
            {t('nav.reports')}
          </button>
          <button type="button" style={styles.navBtn(activeTab === 'admin')} onClick={() => setActiveTab('admin')}>
            <Settings size={16} color={ui.ink} />
            {t('nav.admin')}
          </button>
        </nav>
      </div>
    </div>
  );
}
