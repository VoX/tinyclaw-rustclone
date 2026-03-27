import { hasComponent, addEntity, addComponent, removeEntity } from 'bitecs';
import { Player, Inventory, Hotbar, Position, WorldItem, Collider, Sprite, NetworkSync, Dead } from '../../shared/components.js';
import { ITEM_DEFS, INVENTORY_SLOTS, ITEM_DESPAWN_TICKS, ITEM } from '../../shared/constants.js';
import { INV_ACTION, ENTITY_TYPE } from '../../shared/protocol.js';

export function createInventorySystem(gameState) {
  return function InventorySystem(world) {
    for (const [connId, client] of gameState.clients) {
      if (!client.invRequest) continue;
      const req = client.invRequest;
      client.invRequest = null;

      const eid = client.playerEid;
      if (!eid || hasComponent(world, Dead, eid)) continue;

      const inv = { items: Inventory.items[eid], counts: Inventory.counts[eid] };

      if (req.action === INV_ACTION.MOVE) {
        const { fromSlot, toSlot } = req;
        if (fromSlot < 0 || fromSlot >= INVENTORY_SLOTS || toSlot < 0 || toSlot >= INVENTORY_SLOTS) continue;

        const fromItem = inv.items[fromSlot];
        const fromCount = inv.counts[fromSlot];
        const toItem = inv.items[toSlot];
        const toCount = inv.counts[toSlot];

        if (fromItem === toItem && fromItem !== 0) {
          // Stack
          const maxStack = ITEM_DEFS[fromItem]?.maxStack || 1;
          const canMove = Math.min(fromCount, maxStack - toCount);
          inv.counts[toSlot] += canMove;
          inv.counts[fromSlot] -= canMove;
          if (inv.counts[fromSlot] === 0) inv.items[fromSlot] = 0;
        } else {
          // Swap
          inv.items[fromSlot] = toItem;
          inv.counts[fromSlot] = toCount;
          inv.items[toSlot] = fromItem;
          inv.counts[toSlot] = fromCount;
        }
        gameState.dirtyInventories.add(eid);

      } else if (req.action === INV_ACTION.DROP) {
        const { fromSlot } = req;
        if (fromSlot < 0 || fromSlot >= INVENTORY_SLOTS) continue;
        const itemId = inv.items[fromSlot];
        const count = inv.counts[fromSlot];
        if (itemId === 0 || count === 0) continue;

        // Create world item
        const dropEid = addEntity(world);
        addComponent(world, Position, dropEid);
        addComponent(world, WorldItem, dropEid);
        addComponent(world, Collider, dropEid);
        addComponent(world, Sprite, dropEid);
        addComponent(world, NetworkSync, dropEid);

        const angle = Math.random() * Math.PI * 2;
        Position.x[dropEid] = Position.x[eid] + Math.cos(angle) * 1.5;
        Position.y[dropEid] = Position.y[eid] + Math.sin(angle) * 1.5;
        WorldItem.itemId[dropEid] = itemId;
        WorldItem.quantity[dropEid] = count;
        WorldItem.despawnTimer[dropEid] = ITEM_DESPAWN_TICKS;
        Collider.radius[dropEid] = 0.3;
        Sprite.spriteId[dropEid] = itemId;
        NetworkSync.lastTick[dropEid] = gameState.tick;

        gameState.entityTypes.set(dropEid, ENTITY_TYPE.WORLD_ITEM);
        gameState.newEntities.add(dropEid);

        inv.items[fromSlot] = 0;
        inv.counts[fromSlot] = 0;
        gameState.dirtyInventories.add(eid);

      } else if (req.action === INV_ACTION.SPLIT) {
        const { fromSlot } = req;
        if (fromSlot < 0 || fromSlot >= INVENTORY_SLOTS) continue;
        const itemId = inv.items[fromSlot];
        const count = inv.counts[fromSlot];
        if (itemId === 0 || count <= 1) continue;

        // Split half into empty slot
        const half = Math.floor(count / 2);
        for (let s = 0; s < INVENTORY_SLOTS; s++) {
          if (inv.items[s] === 0) {
            inv.items[s] = itemId;
            inv.counts[s] = half;
            inv.counts[fromSlot] -= half;
            break;
          }
        }
        gameState.dirtyInventories.add(eid);

      } else if (req.action === INV_ACTION.EQUIP) {
        const { fromSlot } = req;
        if (fromSlot < 0 || fromSlot >= INVENTORY_SLOTS) continue;
        Hotbar.selectedSlot[eid] = Math.min(fromSlot, 5);
        gameState.dirtyInventories.add(eid);
      }
    }

    // Pickup nearby world items (and consume any remaining interact requests)
    for (const [connId, client] of gameState.clients) {
      const eid = client.playerEid;
      if (!eid || hasComponent(world, Dead, eid)) continue;
      if (!client.interactRequest) continue;
      const targetEid = client.interactRequest.targetEid;
      client.interactRequest = null; // Always consume to prevent stale requests

      if (!hasComponent(world, WorldItem, targetEid)) continue;

      const dx = Position.x[targetEid] - Position.x[eid];
      const dy = Position.y[targetEid] - Position.y[eid];
      if (dx * dx + dy * dy > 3 * 3) continue;

      const itemId = WorldItem.itemId[targetEid];
      const qty = WorldItem.quantity[targetEid];
      const maxStack = ITEM_DEFS[itemId]?.maxStack || 1;

      let remaining = qty;
      // Try stacking
      for (let s = 0; s < INVENTORY_SLOTS && remaining > 0; s++) {
        if (Inventory.items[eid][s] === itemId) {
          const canAdd = maxStack - Inventory.counts[eid][s];
          const add = Math.min(canAdd, remaining);
          Inventory.counts[eid][s] += add;
          remaining -= add;
        }
      }
      // Try empty slots
      for (let s = 0; s < INVENTORY_SLOTS && remaining > 0; s++) {
        if (Inventory.items[eid][s] === 0) {
          Inventory.items[eid][s] = itemId;
          const add = Math.min(remaining, maxStack);
          Inventory.counts[eid][s] = add;
          remaining -= add;
        }
      }

      if (remaining < qty) {
        if (remaining === 0) {
          // Fully picked up - remove world item
          gameState.removedEntities.add(targetEid);
          gameState.entityTypes.delete(targetEid);
          removeEntity(world, targetEid);
        } else {
          WorldItem.quantity[targetEid] = remaining;
        }
        gameState.dirtyInventories.add(eid);
      }

      client.interactRequest = null; // Consumed
    }

    return world;
  };
}
