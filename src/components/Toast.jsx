import { ui, border, shadow } from '../lib/uiPalette.js';

/**
 * Toast（Neo-Brutalism）
 * variant: 'info'（白底黑字，預設）| 'success'（青綠底黑字）| 'error'（--rose 底白字，唯一合法使用處）
 * 顯示時間由 useToast 控制（visible 會在 duration 後自動變 false），這裡只負責畫。
 */
const variants = {
  info:    { background: ui.white, color: ui.ink },
  success: { background: ui.teal,  color: ui.ink },
  error:   { background: ui.rose,  color: ui.white },
};

const base = {
  position: 'fixed',
  left: '50%',
  bottom: 24,
  transform: 'translateX(-50%)',
  padding: '12px 16px',
  border: border.solid,
  borderRadius: 10,
  boxShadow: shadow.sm,
  fontWeight: 700,
  fontSize: 13,
  zIndex: 9999,
  maxWidth: 320,
  textAlign: 'center',
};

export default function Toast({ message, visible, variant = 'info' }) {
  if (!message || !visible) return null;
  return (
    <div style={{ ...base, ...(variants[variant] ?? variants.info) }} role="status">
      {message}
    </div>
  );
}
