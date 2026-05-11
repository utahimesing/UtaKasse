import React, { useEffect, useState } from 'react';
import { ui } from '../lib/uiPalette.js';

const base = {
  position: 'fixed',
  left: '50%',
  bottom: 24,
  transform: 'translateX(-50%)',
  backgroundColor: ui.ink,
  color: '#FFFFFF',
  padding: '12px 16px',
  borderRadius: 24,
  fontWeight: 800,
  fontSize: 12,
  boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
  zIndex: 9999,
  maxWidth: 320,
  textAlign: 'center',
};

export default function Toast({ message, visible, durationMs = 2000 }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), durationMs);
    return () => clearTimeout(t);
  }, [visible, durationMs]);

  if (!message || !show) return null;
  return (
    <div style={base}>
      {message}
    </div>
  );
}

