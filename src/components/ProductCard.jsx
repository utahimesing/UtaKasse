import React from 'react';
import { t } from '../i18n/t.js';
import Badge from './Badge.jsx';
import {
  PRODUCT_PLACEHOLDER_BACKGROUNDS,
  cardShadowElevated,
  productPlaceholderVariantIndex,
  ui,
} from '../lib/uiPalette.js';

const S = {
  card: {
    borderRadius: 20, color: ui.ink,
    background: 'rgba(255,255,255,0.55)',
    backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)',
    boxShadow: cardShadowElevated,
    border: '1px solid rgba(255,255,255,0.72)',
    position: 'relative', overflow: 'hidden', padding: 16,
  },
  media: {
    borderRadius: 14, width: '100%', aspectRatio: '1/1',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    position: 'relative', overflow: 'hidden', marginBottom: 10,
  },
  topRow: {
    position: 'absolute', top: 8, left: 8, right: 8,
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    pointerEvents: 'none',
  },
  name: {
    textAlign: 'center', fontWeight: 900, fontSize: 13,
    color: ui.ink, lineHeight: 1.3, minHeight: 20,
  },
  bottom: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: 4, minHeight: 26, marginTop: 6,
  },
};

export default function ProductCard({ product, cartQty, onClick, nameStyle }) {
  const stock = product?.stock;
  const isUnlimited = stock === null || stock === undefined;
  const isSoldOut = stock === 0;
  const isLowStock = typeof stock === 'number' && stock > 0 && stock <= 5;
  const hasImage = !!product?.imageUrl;
  const placeholderBg = PRODUCT_PLACEHOLDER_BACKGROUNDS[productPlaceholderVariantIndex(product?.id)];

  return (
    <div
      className="pressable" role="button" tabIndex={0} onClick={onClick}
      style={{ ...S.card, cursor: isSoldOut ? 'not-allowed' : 'pointer', opacity: isSoldOut ? 0.55 : 1, pointerEvents: isSoldOut ? 'none' : 'auto' }}
    >
      <div style={{ ...S.media, background: hasImage ? 'transparent' : placeholderBg }}>
        {hasImage
          ? <img src={product.imageUrl} alt={product?.name ?? 'product'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <span style={{ fontWeight: 700, color: ui.muted, fontSize: 11 }}>{t('product.newBadge')}</span>
        }
      </div>

      <div style={S.topRow}>
        {product?.isNew ? <Badge variant="new">{t('product.newBadge')}</Badge> : <span />}
        {typeof cartQty === 'number' && cartQty > 0
          ? <Badge variant="bonus">{cartQty}</Badge>
          : <span />}
      </div>

      <div style={{ ...S.name, ...nameStyle }}>{product?.name}</div>

      <div style={S.bottom}>
        <div style={{ flexShrink: 0 }}>
          {!isUnlimited && !isSoldOut && <Badge variant={isLowStock ? 'low' : 'stock'}>庫存 {stock}</Badge>}
          {isSoldOut && <Badge variant="sold">售完</Badge>}
        </div>
        <div style={{ color: ui.ink, fontWeight: 900, fontSize: 16, flexShrink: 0 }}>NT${product?.price ?? 0}</div>
      </div>
    </div>
  );
}
