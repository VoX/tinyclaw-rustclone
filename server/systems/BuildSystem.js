import { query, addEntity, addComponent, hasComponent, removeEntity } from 'bitecs';
import { Player, Position, Inventory, Structure, Collider, Sprite, NetworkSync,
         ToolCupboard, Door, SleepingBag, Campfire, Furnace, Workbench, StorageBox,
         Health, Hotbar, Dead } from '../../shared/components.js';
import { ITEM, STRUCT_TYPE, STRUCT_TIER, STRUCT_HP, TILE_SIZE, INVENTORY_SLOTS,
         ITEM_DEFS, SERVER_TPS, UPGRADE_COSTS, MAX_SLEEPING_BAGS } from '../../shared/constants.js';
import { ENTITY_TYPE } from '../../shared/protocol.js';
import { snapFoundation, snapWall } from '../../shared/building.js';

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

      // Gather existing foundations for snap calculations
      const allStructures = query(world, [Structure, Position]);
      const foundations = [];
      for (let fi = 0; fi < allStructures.length; fi++) {
        const feid = allStructures[fi];
        const st = Structure.structureType[feid];
        if (st === STRUCT_TYPE.FOUNDATION || st === STRUCT_TYPE.FOUNDATION_TRI) {
          foundations.push({
            x: Position.x[feid], y: Position.y[feid],
            st, rot: Structure.rotation[feid] || 0,
          });
        }
      }

      let snapX, snapY, wallRotation = 0;
      const isFoundation = (pieceType === STRUCT_TYPE.FOUNDATION || pieceType === STRUCT_TYPE.FOUNDATION_TRI);
      const isWallType = (pieceType === STRUCT_TYPE.WALL || pieceType === STRUCT_TYPE.DOORWAY || pieceType === STRUCT_TYPE.WINDOW);

      if (isFoundation) {
        // Foundations: snap to existing foundation edges, or free-place if none nearby
        const snap = snapFoundation(x, y, pieceType, foundations);
        if (snap) {
          snapX = snap.x;
          snapY = snap.y;
          wallRotation = snap.rotation;
        } else {
          // Free placement (first foundation or nothing nearby)
          snapX = x;
          snapY = y;
        }
      } else if (isWallType) {
        // Walls/doorways/windows: snap to outer foundation edges only
        const snap = snapWall(x, y, foundations);
        if (snap) {
          snapX = snap.x;
          snapY = snap.y;
          wallRotation = snap.rotation;
        } else {
          continue; // Can't place wall without a foundation edge
        }
      } else {
        snapX = x;
        snapY = y;
      }

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

      if (heldItem === ITEM.BUILDING_PLAN && (pieceType === STRUCT_TYPE.FOUNDATION || pieceType === STRUCT_TYPE.FOUNDATION_TRI || pieceType === STRUCT_TYPE.WALL || pieceType === STRUCT_TYPE.DOORWAY || pieceType === STRUCT_TYPE.WINDOW)) {
        // Building structure - costs 50 wood for foundations, 30 for walls
        const isFoundationPiece = (pieceType === STRUCT_TYPE.FOUNDATION || pieceType === STRUCT_TYPE.FOUNDATION_TRI);
        cost = [[ITEM.WOOD, isFoundationPiece ? 50 : 30]];
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
      } else if (heldItem === ITEM.BED) {
        cost = null;
        entityType = ENTITY_TYPE.BED;
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
        Sprite.spriteId[newEid] = 200 + pieceType;

        if (pieceType === STRUCT_TYPE.FOUNDATION || pieceType === STRUCT_TYPE.FOUNDATION_TRI) {
          // Foundations are walkable — no static collider
          Structure.rotation[newEid] = wallRotation;
          Collider.radius[newEid] = 0;
          Collider.isStatic[newEid] = 0;
        } else if (pieceType === STRUCT_TYPE.WALL) {
          // Walls use OBB collision (thin and long)
          Structure.rotation[newEid] = wallRotation;
          Structure.boxHalfW[newEid] = 2.0; // half-length along wall
          Structure.boxHalfH[newEid] = 0.2; // half-thickness
          Collider.radius[newEid] = 2.0; // broad-phase radius for spatial hash queries
          Collider.isStatic[newEid] = 1;
        } else if (pieceType === STRUCT_TYPE.WINDOW) {
          // Windows block movement but not projectiles — same OBB as wall
          Structure.rotation[newEid] = wallRotation;
          Structure.boxHalfW[newEid] = 2.0;
          Structure.boxHalfH[newEid] = 0.2;
          Collider.radius[newEid] = 2.0;
          Collider.isStatic[newEid] = 1;
        } else if (pieceType === STRUCT_TYPE.DOORWAY) {
          // Doorways use OBB but are passable (door entity blocks when closed)
          Structure.rotation[newEid] = wallRotation;
          Structure.boxHalfW[newEid] = 2.0;
          Structure.boxHalfH[newEid] = 0.2;
          Collider.radius[newEid] = 0;
          Collider.isStatic[newEid] = 0;
        } else {
          Collider.radius[newEid] = 2.0;
          Collider.isStatic[newEid] = 1;
        }
      } else if (entityType === ENTITY_TYPE.SLEEPING_BAG) {
        addComponent(world, newEid, SleepingBag);
        SleepingBag.ownerPlayerId[newEid] = eid;
        SleepingBag.cooldown[newEid] = 0;
        Collider.radius[newEid] = 0.4;
        Sprite.spriteId[newEid] = 210;
        // Track UUID ownership for persistence
        const ownerUuid = gameState.eidToUuid?.get(eid);
        if (ownerUuid && gameState.bagOwnerUuids) gameState.bagOwnerUuids.set(newEid, ownerUuid);
        // Enforce sleeping bag limit: if player has more than MAX, destroy oldest
        const allBags = query(world, [SleepingBag, Position]);
        const playerBags = [];
        for (let b = 0; b < allBags.length; b++) {
          const bagEid = allBags[b];
          if (SleepingBag.ownerPlayerId[bagEid] === eid) {
            playerBags.push(bagEid);
          }
        }
        // Also count beds (entity type BED uses SleepingBag component)
        while (playerBags.length > MAX_SLEEPING_BAGS) {
          // Remove oldest (lowest eid = placed first)
          const oldest = playerBags.shift();
          if (oldest === newEid) continue; // don't remove the one we just placed
          gameState.removedEntities.add(oldest);
          gameState.entityTypes.delete(oldest);
          removeEntity(world, oldest);
        }
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
      } else if (entityType === ENTITY_TYPE.BED) {
        addComponent(world, newEid, SleepingBag);
        SleepingBag.ownerPlayerId[newEid] = eid;
        SleepingBag.cooldown[newEid] = 0;
        Collider.radius[newEid] = 0.5;
        Sprite.spriteId[newEid] = 216; // bed sprite (different from sleeping bag 210)
        // Track UUID ownership for persistence
        const bedOwnerUuid = gameState.eidToUuid?.get(eid);
        if (bedOwnerUuid && gameState.bagOwnerUuids) gameState.bagOwnerUuids.set(newEid, bedOwnerUuid);
      }

      gameState.entityTypes.set(newEid, entityType);
      gameState.newEntities.add(newEid);
    }

    // ── Hammer Upgrade ──
    for (const [connId, client] of gameState.clients) {
      if (!client.hammerUpgradeRequest) continue;
      const req = client.hammerUpgradeRequest;
      client.hammerUpgradeRequest = null;

      const eid = client.playerEid;
      if (!eid || hasComponent(world, eid, Dead)) continue;

      // Must be holding a hammer
      const slot = Hotbar.selectedSlot[eid];
      const heldItem = Inventory.items[eid]?.[slot] || 0;
      if (heldItem !== ITEM.HAMMER) continue;

      const targetEid = req.targetEid;
      if (!hasComponent(world, targetEid, Structure)) continue;

      // Distance check
      const dx = Position.x[targetEid] - Position.x[eid];
      const dy = Position.y[targetEid] - Position.y[eid];
      if (dx * dx + dy * dy > 6 * 6) continue;

      // Check TC authorization
      const tcs = query(world, [ToolCupboard, Position]);
      let authorized = true;
      for (let i = 0; i < tcs.length; i++) {
        const tc = tcs[i];
        const tdx = Position.x[targetEid] - Position.x[tc];
        const tdy = Position.y[targetEid] - Position.y[tc];
        if (tdx * tdx + tdy * tdy < 32 * 32) {
          const authList = gameState.tcAuth.get(tc);
          if (authList && !authList.has(eid)) {
            authorized = false;
            break;
          }
        }
      }
      if (!authorized) continue;

      const currentTier = Structure.tier[targetEid];
      const nextTier = currentTier + 1;
      if (nextTier > STRUCT_TIER.METAL) continue; // Already max tier

      const costDef = UPGRADE_COSTS[nextTier];
      if (!costDef) continue;
      const [costItem, costAmount] = costDef;

      // Check player has materials
      let total = 0;
      for (let s = 0; s < INVENTORY_SLOTS; s++) {
        if (Inventory.items[eid][s] === costItem) total += Inventory.counts[eid][s];
      }
      if (total < costAmount) continue;

      // Consume materials
      let remaining = costAmount;
      for (let s = 0; s < INVENTORY_SLOTS && remaining > 0; s++) {
        if (Inventory.items[eid][s] === costItem) {
          const take = Math.min(Inventory.counts[eid][s], remaining);
          Inventory.counts[eid][s] -= take;
          remaining -= take;
          if (Inventory.counts[eid][s] === 0) Inventory.items[eid][s] = 0;
        }
      }

      // Upgrade the structure
      const structType = Structure.structureType[targetEid];
      Structure.tier[targetEid] = nextTier;
      const newHp = STRUCT_HP[structType]?.[nextTier] || 250;
      Structure.hp[targetEid] = newHp;
      Structure.maxHp[targetEid] = newHp;
      Health.current[targetEid] = newHp;
      Health.max[targetEid] = newHp;

      gameState.dirtyInventories.add(eid);

      gameState.events.push({
        type: 'upgrade',
        x: Position.x[targetEid],
        y: Position.y[targetEid],
      });
    }

    // ── Hammer Repair ──
    for (const [connId, client] of gameState.clients) {
      if (!client.hammerRepairRequest) continue;
      const req = client.hammerRepairRequest;
      client.hammerRepairRequest = null;

      const eid = client.playerEid;
      if (!eid || hasComponent(world, eid, Dead)) continue;

      const slot = Hotbar.selectedSlot[eid];
      const heldItem = Inventory.items[eid]?.[slot] || 0;
      if (heldItem !== ITEM.HAMMER) continue;

      const targetEid = req.targetEid;
      if (!hasComponent(world, targetEid, Structure)) continue;

      // Already at full HP?
      if (Health.current[targetEid] >= Health.max[targetEid]) continue;

      // Distance check
      const dx = Position.x[targetEid] - Position.x[eid];
      const dy = Position.y[targetEid] - Position.y[eid];
      if (dx * dx + dy * dy > 6 * 6) continue;

      // TC auth check
      const tcs2 = query(world, [ToolCupboard, Position]);
      let auth2 = true;
      for (let i = 0; i < tcs2.length; i++) {
        const tc = tcs2[i];
        const tdx = Position.x[targetEid] - Position.x[tc];
        const tdy = Position.y[targetEid] - Position.y[tc];
        if (tdx * tdx + tdy * tdy < 32 * 32) {
          const authList = gameState.tcAuth.get(tc);
          if (authList && !authList.has(eid)) { auth2 = false; break; }
        }
      }
      if (!auth2) continue;

      // Repair cost: 50% of upgrade cost for current tier (min tier 1 = wood cost)
      const tier = Structure.tier[targetEid];
      const costDef = UPGRADE_COSTS[Math.max(tier, 1)];
      if (!costDef) continue;
      const [costItem, costAmount] = costDef;
      const repairCost = Math.ceil(costAmount * 0.5);

      // Check materials
      let totalMat = 0;
      for (let s = 0; s < INVENTORY_SLOTS; s++) {
        if (Inventory.items[eid][s] === costItem) totalMat += Inventory.counts[eid][s];
      }
      if (totalMat < repairCost) continue;

      // Consume materials
      let rem = repairCost;
      for (let s = 0; s < INVENTORY_SLOTS && rem > 0; s++) {
        if (Inventory.items[eid][s] === costItem) {
          const take = Math.min(Inventory.counts[eid][s], rem);
          Inventory.counts[eid][s] -= take;
          rem -= take;
          if (Inventory.counts[eid][s] === 0) Inventory.items[eid][s] = 0;
        }
      }

      // Repair to full
      const healed = Health.max[targetEid] - Health.current[targetEid];
      Health.current[targetEid] = Health.max[targetEid];
      Structure.hp[targetEid] = Structure.maxHp[targetEid];
      gameState.dirtyInventories.add(eid);

      gameState.events.push({
        type: 'repair',
        x: Position.x[targetEid],
        y: Position.y[targetEid],
        amount: healed,
      });
    }

    return world;
  };
}
