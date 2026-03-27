import { query, addEntity, addComponent, hasComponent } from 'bitecs';
import { Player, Position, Inventory, Structure, Collider, Sprite, NetworkSync,
         ToolCupboard, Door, SleepingBag, Campfire, Furnace, Workbench, StorageBox,
         Health, Hotbar, Dead } from '../../shared/components.js';
import { ITEM, STRUCT_TYPE, STRUCT_TIER, STRUCT_HP, TILE_SIZE, INVENTORY_SLOTS,
         ITEM_DEFS, SERVER_TPS } from '../../shared/constants.js';
import { ENTITY_TYPE } from '../../shared/protocol.js';

export function createBuildSystem(gameState) {
  return function BuildSystem(world) {
    for (const [connId, client] of gameState.clients) {
      if (!client.buildRequest) continue;
      const req = client.buildRequest;
      client.buildRequest = null;

      const eid = client.playerEid;
      if (!eid || hasComponent(world, eid, Dead)) continue;

      // Check player is holding building plan
      const slot = Hotbar.selectedSlot[eid];
      const heldItem = Inventory.items[eid]?.[slot] || 0;

      const { pieceType, x, y } = req;

      // Snap to grid
      const snapX = Math.round(x / TILE_SIZE) * TILE_SIZE;
      const snapY = Math.round(y / TILE_SIZE) * TILE_SIZE;

      // Check distance from player
      const dx = snapX - Position.x[eid];
      const dy = snapY - Position.y[eid];
      if (dx * dx + dy * dy > 10 * 10) continue;

      // Check tool cupboard authorization
      const tcs = query(world, [ToolCupboard, Position]);
      let authorized = true;
      for (let i = 0; i < tcs.length; i++) {
        const tc = tcs[i];
        const tdx = snapX - Position.x[tc];
        const tdy = snapY - Position.y[tc];
        if (tdx * tdx + tdy * tdy < 32 * 32) {
          const authList = gameState.tcAuth.get(tc);
          if (authList && !authList.has(eid)) {
            authorized = false;
            break;
          }
        }
      }
      if (!authorized) continue;

      // Determine cost and create entity based on what's being placed
      let cost = null;
      let entityType = ENTITY_TYPE.STRUCTURE;

      if (heldItem === ITEM.BUILDING_PLAN && pieceType >= 1 && pieceType <= 7) {
        // Building structure - costs 30-50 wood for twig tier
        cost = [[ITEM.WOOD, pieceType === STRUCT_TYPE.FOUNDATION ? 50 : 30]];
      } else if (heldItem === ITEM.SLEEPING_BAG) {
        cost = null; // Already consumed the item
        entityType = ENTITY_TYPE.SLEEPING_BAG;
      } else if (heldItem === ITEM.CAMPFIRE_ITEM) {
        cost = null;
        entityType = ENTITY_TYPE.CAMPFIRE;
      } else if (heldItem === ITEM.FURNACE_ITEM) {
        cost = null;
        entityType = ENTITY_TYPE.FURNACE;
      } else if (heldItem === ITEM.TOOL_CUPBOARD_ITEM) {
        cost = null;
        entityType = ENTITY_TYPE.TOOL_CUPBOARD;
      } else if (heldItem === ITEM.WORKBENCH_T1_ITEM || heldItem === ITEM.WORKBENCH_T2_ITEM || heldItem === ITEM.WORKBENCH_T3_ITEM) {
        cost = null;
        entityType = ENTITY_TYPE.WORKBENCH;
      } else if (heldItem === ITEM.STORAGE_BOX) {
        cost = null;
        entityType = ENTITY_TYPE.STORAGE_BOX;
      } else {
        continue; // Not a valid build action
      }

      // Check and consume cost (for building plan pieces)
      if (cost) {
        let hasAll = true;
        for (const [itemId, count] of cost) {
          let total = 0;
          for (let s = 0; s < INVENTORY_SLOTS; s++) {
            if (Inventory.items[eid][s] === itemId) total += Inventory.counts[eid][s];
          }
          if (total < count) { hasAll = false; break; }
        }
        if (!hasAll) continue;

        for (const [itemId, count] of cost) {
          let remaining = count;
          for (let s = 0; s < INVENTORY_SLOTS && remaining > 0; s++) {
            if (Inventory.items[eid][s] === itemId) {
              const take = Math.min(Inventory.counts[eid][s], remaining);
              Inventory.counts[eid][s] -= take;
              remaining -= take;
              if (Inventory.counts[eid][s] === 0) Inventory.items[eid][s] = 0;
            }
          }
        }
        gameState.dirtyInventories.add(eid);
      } else {
        // Consume the deployable item from hand
        Inventory.counts[eid][slot]--;
        if (Inventory.counts[eid][slot] === 0) Inventory.items[eid][slot] = 0;
        gameState.dirtyInventories.add(eid);
      }

      // Create the entity
      const newEid = addEntity(world);
      addComponent(world, newEid, Position);
      addComponent(world, newEid, Collider);
      addComponent(world, newEid, Sprite);
      addComponent(world, newEid, NetworkSync);

      Position.x[newEid] = snapX;
      Position.y[newEid] = snapY;
      NetworkSync.lastTick[newEid] = gameState.tick;

      if (entityType === ENTITY_TYPE.STRUCTURE) {
        addComponent(world, newEid, Structure);
        addComponent(world, newEid, Health);
        Structure.structureType[newEid] = pieceType;
        Structure.tier[newEid] = STRUCT_TIER.TWIG;
        const hp = STRUCT_HP[pieceType]?.[STRUCT_TIER.TWIG] || 10;
        Structure.hp[newEid] = hp;
        Structure.maxHp[newEid] = hp;
        Structure.placedBy[newEid] = eid;
        Health.current[newEid] = hp;
        Health.max[newEid] = hp;
        Collider.radius[newEid] = 0.9;
        Collider.isStatic[newEid] = 1;
        Sprite.spriteId[newEid] = 200 + pieceType;

        // Doorway special case
        if (pieceType === STRUCT_TYPE.DOORWAY) {
          Collider.isStatic[newEid] = 0; // doorways are passable
        }
      } else if (entityType === ENTITY_TYPE.SLEEPING_BAG) {
        addComponent(world, newEid, SleepingBag);
        SleepingBag.ownerPlayerId[newEid] = eid;
        SleepingBag.cooldown[newEid] = 0;
        Collider.radius[newEid] = 0.4;
        Sprite.spriteId[newEid] = 210;
        // Broadcast event
        gameState.events.push({
          type: 'sleeping_bag',
          playerName: `Player ${Player.connectionId[eid] || eid}`,
        });
      } else if (entityType === ENTITY_TYPE.CAMPFIRE) {
        addComponent(world, newEid, Campfire);
        Campfire.fuelRemaining[newEid] = 0;
        Collider.radius[newEid] = 0.5;
        Sprite.spriteId[newEid] = 211;
      } else if (entityType === ENTITY_TYPE.FURNACE) {
        addComponent(world, newEid, Furnace);
        Furnace.fuelRemaining[newEid] = 0;
        Collider.radius[newEid] = 0.5;
        Sprite.spriteId[newEid] = 212;
      } else if (entityType === ENTITY_TYPE.TOOL_CUPBOARD) {
        addComponent(world, newEid, ToolCupboard);
        addComponent(world, newEid, Health);
        ToolCupboard.radius[newEid] = 32;
        Health.current[newEid] = 250;
        Health.max[newEid] = 250;
        Collider.radius[newEid] = 0.4;
        Sprite.spriteId[newEid] = 213;
        // Auto-authorize placer
        gameState.tcAuth.set(newEid, new Set([eid]));
      } else if (entityType === ENTITY_TYPE.WORKBENCH) {
        addComponent(world, newEid, Workbench);
        const tier = heldItem === ITEM.WORKBENCH_T3_ITEM ? 3 : heldItem === ITEM.WORKBENCH_T2_ITEM ? 2 : 1;
        Workbench.tier[newEid] = tier;
        Collider.radius[newEid] = 0.6;
        Sprite.spriteId[newEid] = 220 + tier;
      } else if (entityType === ENTITY_TYPE.STORAGE_BOX) {
        addComponent(world, newEid, StorageBox);
        addComponent(world, newEid, Health);
        Health.current[newEid] = 200;
        Health.max[newEid] = 200;
        Collider.radius[newEid] = 0.5;
        Sprite.spriteId[newEid] = 215;
        // Initialize container inventory
        if (!gameState.containerInv) gameState.containerInv = new Map();
        const slots = [];
        for (let i = 0; i < 12; i++) slots.push({ id: 0, n: 0 });
        gameState.containerInv.set(newEid, slots);
      }

      gameState.entityTypes.set(newEid, entityType);
      gameState.newEntities.add(newEid);
    }
    return world;
  };
}
