import { forwardRef } from 'react';
import { buttonVariants, radius, fontSize } from '../lib/uiPalette.js';

const sizes = {
  sm: { fontSize: fontSize.sm, padding: '8px 14px',  borderRadius: radius.md },
  md: { fontSize: fontSize.md, padding: '13px 20px', borderRadius: 18 },
  lg: { fontSize: fontSize.lg, padding: '17px 28px', borderRadius: radius.xl - 4 },
};

const base = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  gap: 7, fontFamily: 'DM Sans, sans-serif', fontWeight: 800,
  border: 'none', cursor: 'pointer', outline: 'none', whiteSpace: 'nowrap',
  transition: 'transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease, opacity 0.15s ease',
};

function Spinner({ dark }) {
  if (typeof document !== 'undefined' && !document.getElementById('_btn_kf')) {
    const s = document.createElement('style');
    s.id = '_btn_kf';
    s.textContent = '@keyframes _bspin{to{transform:rotate(360deg)}}';
    document.head.appendChild(s);
  }
  return (
    <span style={{
      width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
      border: `2px solid ${dark ? 'rgba(61,48,96,0.20)' : 'rgba(255,255,255,0.35)'}`,
      borderTopColor: dark ? '#3D3060' : '#FFFFFF',
      animation: '_bspin 0.7s linear infinite',
      display: 'inline-block',
    }} />
  );
}

const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, success = false,
    disabled = false, leftIcon, rightIcon, children, style: extraStyle, ...props },
  ref
) {
  const resolvedVariant = success ? 'success' : variant;
  const isDisabled = disabled || loading;
  const spinnerDark =
    variant === 'secondary' || variant === 'ghost' || variant === 'destructive';

  return (
    <button
      ref={ref} type="button" disabled={isDisabled}
      style={{
        ...base, ...sizes[size], ...buttonVariants[resolvedVariant],
        ...(isDisabled ? { opacity: 0.42, cursor: 'not-allowed', pointerEvents: 'none' } : {}),
        ...extraStyle,
      }}
      {...props}
    >
      {loading && <Spinner dark={spinnerDark} />}
      {!loading && leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
});

export default Button;
