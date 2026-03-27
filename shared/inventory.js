import { Inventory } from './components.js';
import { ITEM_DEFS, INVENTORY_SLOTS } from './constants.js';

// Add items to a player's inventory, returns the number actually added
// For items with durability, sets durability to max on new slots
export function addToInventory(eid, itemId, count) {
  const def = ITEM_DEFS[itemId];
  const maxStack = def?.maxStack || 1;
  const hasDurability = def?.durability > 0;
  let remaining = count;

  // Stack with existing slots first (only for stackable, non-durability items)
  if (!hasDurability) {
    for (let s = 0; s < INVENTORY_SLOTS && remaining > 0; s++) {
      if (Inventory.items[eid][s] === itemId) {
        const canAdd = maxStack - Inventory.counts[eid][s];
        const add = Math.min(canAdd, remaining);
        Inventory.counts[eid][s] += add;
        remaining -= add;
      }
    }
  }

  // Fill empty slots
  for (let s = 0; s < INVENTORY_SLOTS && remaining > 0; s++) {
    if (Inventory.items[eid][s] === 0) {
      Inventory.items[eid][s] = itemId;
      const add = Math.min(remaining, maxStack);
      Inventory.counts[eid][s] = add;
      if (hasDurability && Inventory.durability[eid]) {
        Inventory.durability[eid][s] = def.durability;
      }
      remaining -= add;
    }
  }

  return count - remaining;
}

// Reduce durability for an item in a specific slot, remove if broken
// Returns true if the item was destroyed
export function reduceDurability(eid, slot) {
  const itemId = Inventory.items[eid][slot];
  const def = ITEM_DEFS[itemId];
  if (!def || !def.durability) return false;
  if (!Inventory.durability[eid]) return false;

  Inventory.durability[eid][slot]--;
  if (Inventory.durability[eid][slot] <= 0) {
    Inventory.items[eid][slot] = 0;
    Inventory.counts[eid][slot] = 0;
    Inventory.durability[eid][slot] = 0;
    return true;
  }
  return false;
}
