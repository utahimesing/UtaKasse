import { describe, it, expect } from 'vitest';
import {
  makeLineId, addLine, setLineQty, maxQtyForLine, usageByProduct,
  makeBundleLine, makeSingleLine, remainingStock, lineToTxItem,
} from '../cart.js';

const posterA = { id: 'pa', name: '海報A', price: 220, stock: 3, categoryIds: ['c1'] };
const book = { id: 'bk', name: '寫真書', price: 600, stock: 5, categoryIds: ['c1'] };
const bigSet = { id: 'set', name: '大套組', price: 1200, stock: null, type: 'bundle', categoryIds: ['c2'] };
const stockOf = new Map([[posterA.id, 3], [book.id, 5], [bigSet.id, null]]);
const getStock = (id) => stockOf.get(id);

describe('lineId', () => {
  it('一般商品 lineId = productId', () => {
    expect(makeLineId('pa')).toBe('pa');
  });
  it('套組同款合併、不同款不同 id，順序無關', () => {
    const a = makeLineId('set', [{ productId: 'pa', qty: 1 }, { productId: 'bk', qty: 1 }]);
    const b = makeLineId('set', [{ productId: 'bk', qty: 1 }, { productId: 'pa', qty: 1 }]);
    const c = makeLineId('set', [{ productId: 'pa', qty: 2 }]);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('addLine / setLineQty 與庫存合併檢查', () => {
  it('同一商品合併成一行，不能超過庫存', () => {
    let cart = [];
    cart = addLine(cart, makeSingleLine(posterA), getStock);
    cart = addLine(cart, makeSingleLine(posterA), getStock);
    cart = addLine(cart, makeSingleLine(posterA), getStock);
    cart = addLine(cart, makeSingleLine(posterA), getStock); // 第 4 次加不進去
    expect(cart).toHaveLength(1);
    expect(cart[0].qty).toBe(3);
  });

  it('單賣行＋套組內容物合併計算庫存（驗收 C2）', () => {
    let cart = [];
    cart = addLine(cart, makeSingleLine(posterA), getStock);
    cart = setLineQty(cart, 'pa', 2, getStock); // 單賣 2 張
    const setLine = makeBundleLine(bigSet, [{ productId: 'pa', productName: '海報A', qty: 1 }]);
    cart = addLine(cart, setLine, getStock); // 套組用掉第 3 張
    expect(cart).toHaveLength(2);
    expect(usageByProduct(cart).get('pa')).toBe(3);
    // 海報A 已經沒了：再加一組套組進不去、單賣也加不了
    expect(addLine(cart, setLine, getStock)).toBe(cart);
    expect(addLine(cart, makeSingleLine(posterA), getStock)).toBe(cart);
    expect(remainingStock('pa', cart, getStock)).toBe(0);
    expect(maxQtyForLine(cart[0], cart, getStock)).toBe(2);
  });

  it('不限庫存的商品可以一直加', () => {
    let cart = [];
    const line = makeSingleLine({ id: 'u', name: 'U', price: 10, stock: null });
    for (let i = 0; i < 50; i++) cart = addLine(cart, line, () => null);
    expect(cart[0].qty).toBe(50);
  });

  it('lineToTxItem：一般商品不帶 kind，套組帶 components', () => {
    const single = lineToTxItem({ ...makeSingleLine(book), qty: 2 });
    expect(single).toEqual({ lineId: 'bk', productId: 'bk', productName: '寫真書', qty: 2, unitPrice: 600 });
    const bundle = lineToTxItem(makeBundleLine(bigSet, [{ productId: 'pa', productName: '海報A', qty: 1 }]));
    expect(bundle.kind).toBe('bundle');
    expect(bundle.components).toEqual([{ productId: 'pa', productName: '海報A', qty: 1 }]);
  });
});
