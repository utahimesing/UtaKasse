import { forwardRef } from 'react';
import { buttonVariants, radius, fontSize, ui } from '../lib/uiPalette.js';

const sizes = {
  sm: { fontSize: fontSize.sm, padding: '8px 14px',  borderRadius: radius.md },
  md: { fontSize: fontSize.md, padding: '11px 20px', borderRadius: radius.md },
  lg: { fontSize: fontSize.lg, padding: '15px 28px', borderRadius: radius.lg },
};

const base = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  gap: 7, fontFamily: 'inherit', fontWeight: 700, minHeight: 44,
  cursor: 'pointer', outline: 'none', whiteSpace: 'nowrap', lineHeight: 1.2,
  transition: 'transform 0.08s ease, box-shadow 0.08s ease, background 0.15s ease',
};

function Spinner({ light }) {
  if (typeof document !== 'undefined' && !document.getElementById('_btn_kf')) {
    const s = document.createElement('style');
    s.id = '_btn_kf';
    s.textContent = '@keyframes _bspin{to{transform:rotate(360deg)}}';
    document.head.appendChild(s);
  }
  return (
    <span style={{
      width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
      border: `2px solid ${light ? ui.white : ui.ink}`,
      borderTopColor: 'transparent',
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
  const spinnerLight = resolvedVariant === 'destructiveFilled';

  return (
    <button
      ref={ref} type="button" disabled={isDisabled}
      style={{
        ...base, ...sizes[size],
        ...(isDisabled ? buttonVariants.disabled : buttonVariants[resolvedVariant]),
        ...extraStyle,
      }}
      {...props}
    >
      {loading && <Spinner light={spinnerLight} />}
      {!loading && leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
});

export default Button;
