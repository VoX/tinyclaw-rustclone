import { hasComponent, addEntity, addComponent, removeEntity } from 'bitecs';
import { Player, Inventory, Hotbar, Position, WorldItem, Collider, Sprite, NetworkSync, Dead, Armor } from '../../shared/components.js';
import { ITEM_DEFS, INVENTORY_SLOTS, ITEM_DESPAWN_TICKS, ITEM } from '../../shared/constants.js';
import { addToInventory } from '../../shared/inventory.js';
import { INV_ACTION, ENTITY_TYPE } from '../../shared/protocol.js';

export function createInventorySystem(gameState) {
  return function InventorySystem(world) {
    for (const [connId, client] of gameState.clients) {
      if (!client.invRequest) continue;
      const req = client.invRequest;
      client.invRequest = null;

      const eid = client.playerEid;
      if (!eid || hasComponent(world, eid, Dead)) continue;

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
          if (inv.counts[fromSlot] === 0) {
            inv.items[fromSlot] = 0;
            if (Inventory.durability[eid]) Inventory.durability[eid][fromSlot] = 0;
          }
        } else {
          // Swap
          inv.items[fromSlot] = toItem;
          inv.counts[fromSlot] = toCount;
          inv.items[toSlot] = fromItem;
          inv.counts[toSlot] = fromCount;
          // Swap durability too
          if (Inventory.durability[eid]) {
            const fromDur = Inventory.durability[eid][fromSlot];
            Inventory.durability[eid][fromSlot] = Inventory.durability[eid][toSlot];
            Inventory.durability[eid][toSlot] = fromDur;
          }
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
        addComponent(world, dropEid, Position);
        addComponent(world, dropEid, WorldItem);
        addComponent(world, dropEid, Collider);
        addComponent(world, dropEid, Sprite);
        addComponent(world, dropEid, NetworkSync);

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
        if (Inventory.durability[eid]) Inventory.durability[eid][fromSlot] = 0;
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

      } else if (req.action === INV_ACTION.EQUIP_ARMOR) {
        const { fromSlot } = req;
        if (fromSlot < 0 || fromSlot >= INVENTORY_SLOTS) continue;
        const itemId = inv.items[fromSlot];
        const def = ITEM_DEFS[itemId];
        if (!def || def.cat !== 'armor') continue;

        // Determine which armor slot
        const slot = def.armorSlot; // 'head', 'chest', 'legs'
        let currentEquipped = 0;
        if (slot === 'head') currentEquipped = Armor.headSlot[eid];
        else if (slot === 'chest') currentEquipped = Armor.chestSlot[eid];
        else if (slot === 'legs') currentEquipped = Armor.legsSlot[eid];

        // Equip new item
        if (slot === 'head') Armor.headSlot[eid] = itemId;
        else if (slot === 'chest') Armor.chestSlot[eid] = itemId;
        else if (slot === 'legs') Armor.legsSlot[eid] = itemId;

        // Remove from inventory
        inv.items[fromSlot] = currentEquipped || 0;
        inv.counts[fromSlot] = currentEquipped ? 1 : 0;
        gameState.dirtyInventories.add(eid);

      } else if (req.action === INV_ACTION.UNEQUIP_ARMOR) {
        const armorSlot = req.fromSlot; // 0=head, 1=chest, 2=legs (reuse fromSlot)
        let itemId = 0;
        if (armorSlot === 0) { itemId = Armor.headSlot[eid]; Armor.headSlot[eid] = 0; }
        else if (armorSlot === 1) { itemId = Armor.chestSlot[eid]; Armor.chestSlot[eid] = 0; }
        else if (armorSlot === 2) { itemId = Armor.legsSlot[eid]; Armor.legsSlot[eid] = 0; }
        if (itemId) {
          // Find empty slot
          for (let s = 0; s < INVENTORY_SLOTS; s++) {
            if (inv.items[s] === 0) {
              inv.items[s] = itemId;
              inv.counts[s] = 1;
              break;
            }
          }
          gameState.dirtyInventories.add(eid);
        }
      }
    }

    // Pickup nearby world items (and consume any remaining interact requests)
    for (const [connId, client] of gameState.clients) {
      const eid = client.playerEid;
      if (!eid || hasComponent(world, eid, Dead)) continue;
      if (!client.interactRequest) continue;
      const targetEid = client.interactRequest.targetEid;
      client.interactRequest = null; // Always consume to prevent stale requests

      if (!hasComponent(world, targetEid, WorldItem)) continue;

      const dx = Position.x[targetEid] - Position.x[eid];
      const dy = Position.y[targetEid] - Position.y[eid];
      if (dx * dx + dy * dy > 3 * 3) continue;

      const itemId = WorldItem.itemId[targetEid];
      const qty = WorldItem.quantity[targetEid];

      const added = addToInventory(eid, itemId, qty);
      const remaining = qty - added;

      if (added > 0) {
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

    }

    return world;
  };
}
