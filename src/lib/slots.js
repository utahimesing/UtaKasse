import { createUUID } from '../db.js';

/** 空白「欄位」（合購 slots 用 qty；套組 bundleSlots 用 pickQty） */
export function makeEmptySlot(qtyKey = 'qty') {
  return { id: createUUID(), label: '', [qtyKey]: 1, poolProductIds: [], allowDuplicate: true };
}
