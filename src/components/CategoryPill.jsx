export default function CategoryPill({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: '0 0 auto', borderRadius: 999,
        padding: '8px 16px', fontWeight: 700, fontSize: 12, lineHeight: 1.2,
        border: active ? '1.5px solid rgba(255,255,255,0.35)' : '1.5px solid rgba(255,255,255,0.65)',
        background: active
          ? 'linear-gradient(135deg, #9BBCE8 0%, #80A1D4 100%)'
          : 'rgba(255,255,255,0.52)',
        backdropFilter: active ? 'none' : 'blur(10px)',
        WebkitBackdropFilter: active ? 'none' : 'blur(10px)',
        color: active ? '#FFFFFF' : '#8B85A0',
        whiteSpace: 'nowrap', cursor: 'pointer',
        boxShadow: active
          ? '0 6px 18px rgba(128,161,212,0.36)'
          : '0 2px 8px rgba(192,185,221,0.15)',
        transition: 'all 0.15s ease',
      }}
    >
      {label}
    </button>
  );
}
