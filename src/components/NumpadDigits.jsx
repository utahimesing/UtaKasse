import { ui, border, shadow } from '../lib/uiPalette.js';

const numBtn = {
  padding: '18px 0',
  minHeight: 44,
  fontSize: '1.7rem',
  fontWeight: 800,
  fontFamily: 'inherit',
  backgroundColor: ui.white,
  border: border.solid,
  borderRadius: 10,
  boxShadow: shadow.sm,
  color: ui.ink,
  cursor: 'pointer',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  lineHeight: 1,
};

const actionBtn = {
  ...numBtn,
  backgroundColor: ui.apricot,
};

export default function NumpadDigits({
  onDigit,
  onDoubleZero,
  onBackspace,
  disabled,
  compact = false,
}) {
  const btn = compact
    ? { ...numBtn, padding: '10px 0', fontSize: '1.3rem', borderRadius: 8 }
    : numBtn;
  const act = compact
    ? { ...actionBtn, padding: '10px 0', fontSize: '1.3rem', borderRadius: 8 }
    : actionBtn;
  const gap = compact ? 8 : 12;

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
