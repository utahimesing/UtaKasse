/**
 * Badge / Pill 元件
 * variant: 'new' | 'stock' | 'low' | 'sold' | 'bonus' | 'category' | 'active' | 'inactive'
 * size: 'sm' | 'md'
 */
const variants = {
  new:      { background: 'rgba(128,161,212,0.88)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.40)' },
  stock:    { background: 'rgba(128,161,212,0.80)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.35)' },
  low:      { background: 'rgba(220,140,20,0.88)',  color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.35)' },
  sold:     { background: 'rgba(139,133,160,0.80)', color: '#FFFFFF', border: 'none' },
  bonus:    { background: 'rgba(117,201,200,0.85)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.40)' },
  category: { background: 'rgba(255,255,255,0.58)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', color: '#3D3060', border: '1.5px solid rgba(255,255,255,0.70)' },
  'category-active': { background: 'linear-gradient(135deg,#9BBCE8 0%,#80A1D4 100%)', color: '#FFFFFF', border: '1.5px solid rgba(255,255,255,0.30)', boxShadow: '0 6px 18px rgba(128,161,212,0.36)' },
  active:   { background: 'rgba(117,201,200,0.18)', color: '#4A9A99', border: '1px solid rgba(117,201,200,0.40)' },
  inactive: { background: 'rgba(139,133,160,0.12)', color: '#8B85A0', border: '1px solid rgba(139,133,160,0.25)' },
};

const sizes = {
  sm: { fontSize: 10, padding: '3px 8px',  borderRadius: 8 },
  md: { fontSize: 12, padding: '5px 10px', borderRadius: 10 },
};

export default function Badge({ variant = 'stock', size = 'sm', children, style: extra }) {
  return (
    <span style={{
      display: 'inline-block', fontWeight: 800, lineHeight: 1, whiteSpace: 'nowrap',
      ...sizes[size], ...variants[variant], ...extra,
    }}>
      {children}
    </span>
  );
}
