/**
 * Input 元件
 * variant: 'default' | 'search' | 'number'
 */
const base = {
  width: '100%', fontFamily: 'DM Sans, sans-serif', fontWeight: 700,
  fontSize: 14, color: '#3D3060', outline: 'none',
  background: 'rgba(255,255,255,0.52)',
  backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
  border: '1.5px solid rgba(255,255,255,0.70)',
  borderRadius: 14,
  padding: '13px 16px',
  boxShadow: '0 4px 14px rgba(128,161,212,0.10)',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

export default function Input({ variant = 'default', style: extra, ...props }) {
  return (
    <input
      style={{ ...base, ...(variant === 'number' ? { textAlign: 'right' } : {}), ...extra }}
      onFocus={e => {
        e.target.style.borderColor = 'rgba(128,161,212,0.65)';
        e.target.style.boxShadow = '0 0 0 3px rgba(128,161,212,0.18), 0 4px 14px rgba(128,161,212,0.12)';
      }}
      onBlur={e => {
        e.target.style.borderColor = 'rgba(255,255,255,0.70)';
        e.target.style.boxShadow = '0 4px 14px rgba(128,161,212,0.10)';
      }}
      {...props}
    />
  );
}
