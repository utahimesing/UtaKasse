/**
 * Card 元件
 * variant: 'glass' | 'solid' | 'form'
 */
import { glass } from '../lib/uiPalette.js';

const variants = {
  glass: { ...glass.card, borderRadius: 20, padding: '16px 18px' },
  solid: { background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 16, padding: '18px 20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' },
  form:  { background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 16, padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' },
};

export default function Card({ variant = 'glass', children, style: extra, ...props }) {
  return (
    <div style={{ ...variants[variant], ...extra }} {...props}>
      {children}
    </div>
  );
}
