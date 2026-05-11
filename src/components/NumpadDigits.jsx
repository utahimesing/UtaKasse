import { ui, cardShadowElevated } from '../lib/uiPalette.js';

const numBtn = {
  padding: '22px 0',
  fontSize: '1.8rem',
  fontWeight: 800,
  fontFamily: 'inherit',
  backgroundColor: '#FFFFFF',
  border: 'none',
  borderRadius: '14px',
  boxShadow: cardShadowElevated,
  color: '#444444',
  cursor: 'pointer',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  lineHeight: 1,
};

const actionBtn = {
  ...numBtn,
  backgroundColor: '#F2F2F2',
  color: ui.primary,
};

export default function NumpadDigits({
  onDigit,
  onDoubleZero,
  onBackspace,
  disabled,
  compact = false,
}) {
  const btn = compact
    ? { ...numBtn, padding: '11px 0', fontSize: '1.3rem', borderRadius: '10px' }
    : numBtn;
  const act = compact
    ? { ...actionBtn, padding: '11px 0', fontSize: '1.3rem', borderRadius: '10px' }
    : actionBtn;
  const gap = compact ? 6 : 12;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap }}>
      {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((n) => (
        <button key={n} type="button" onClick={() => onDigit?.(n)} style={btn} disabled={disabled}>
          {n}
        </button>
      ))}
      <button type="button" onClick={() => onDigit?.(0)} style={btn} disabled={disabled}>0</button>
      <button type="button" onClick={() => onDoubleZero?.()} style={btn} disabled={disabled}>00</button>
      <button type="button" onClick={onBackspace} style={act} disabled={disabled}>⌫</button>
    </div>
  );
}
