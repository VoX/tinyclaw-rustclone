import { query, hasComponent } from 'bitecs';
import { Position, Velocity, Rotation, Health, Player, Sprite, ResourceNode,
         WorldItem, Projectile, Structure, Animal, Campfire, Furnace, Workbench,
         ToolCupboard, SleepingBag, Door, Dead, Inventory, Hotbar,
         Hunger, Thirst, Temperature, NetworkSync } from '../../shared/components.js';
import { MSG, ENTITY_TYPE } from '../../shared/protocol.js';
import { INTEREST_RADIUS, TILE_SIZE, ITEM } from '../../shared/constants.js';

export function createNetworkSyncSystem(gameState) {
  // Previous state for delta detection — per client to avoid one client's
  // update masking changes for another client in the same tick
  const clientPrevState = new Map(); // connId -> Map(eid -> state)

  return function NetworkSyncSystem(world) {
    const tick = gameState.tick;
    const entities = query(world, [Position, NetworkSync]);

    // Build per-client delta updates
    for (const [connId, client] of gameState.clients) {
      if (!client.ws || !client.playerEid) continue;

      const playerEid = client.playerEid;
      if (!hasComponent(world, playerEid, Position)) continue;

      // Get or create per-client prev state
      if (!clientPrevState.has(connId)) {
        clientPrevState.set(connId, new Map());
      }
      const prevState = clientPrevState.get(connId);

      const px = Position.x[playerEid];
      const py = Position.y[playerEid];
      const interestDist = INTEREST_RADIUS * TILE_SIZE;

      const delta = [];
      const removals = [];

      for (let i = 0; i < entities.length; i++) {
        const eid = entities[i];

        // Interest check
        const dx = Position.x[eid] - px;
        const dy = Position.y[eid] - py;
        if (dx * dx + dy * dy > interestDist * interestDist) continue;

        const entityType = gameState.entityTypes.get(eid) || 0;
        const isNew = gameState.newEntities.has(eid);

        // Build entity state
        const state = {
          eid,
          t: entityType,
          x: Math.round(Position.x[eid] * 100) / 100,
          y: Math.round(Position.y[eid] * 100) / 100,
        };

        // Add velocity for moving entities
        if (hasComponent(world, eid, Velocity)) {
          const vx = Velocity.vx[eid];
          const vy = Velocity.vy[eid];
          if (vx !== 0 || vy !== 0) {
            state.vx = Math.round(vx * 100) / 100;
            state.vy = Math.round(vy * 100) / 100;
          }
        }

        if (hasComponent(world, eid, Rotation)) {
          state.a = Math.round(Rotation.angle[eid] * 100) / 100;
        }

        if (hasComponent(world, eid, Health)) {
          state.hp = Math.round(Health.current[eid]);
          state.mhp = Math.round(Health.max[eid]);
        }

        if (hasComponent(world, eid, Dead)) {
          state.dead = 1;
        }

        // Type-specific data
        if (entityType === ENTITY_TYPE.RESOURCE_NODE) {
          state.rt = ResourceNode.resourceType[eid];
          state.rem = Math.round(ResourceNode.remaining[eid]);
        } else if (entityType === ENTITY_TYPE.WORLD_ITEM) {
          state.itemId = WorldItem.itemId[eid];
          state.qty = WorldItem.quantity[eid];
        } else if (entityType === ENTITY_TYPE.STRUCTURE) {
          state.st = Structure.structureType[eid];
          state.tier = Structure.tier[eid];
        } else if (entityType === ENTITY_TYPE.ANIMAL) {
          state.at = Animal.animalType[eid];
        } else if (entityType === ENTITY_TYPE.PLAYER) {
          state.sprite = Sprite.spriteId[eid];
          if (hasComponent(world, eid, Hotbar)) {
            const slot = Hotbar.selectedSlot[eid];
            state.held = Inventory.items[eid]?.[slot] || 0;
          }
        }

        // Check if changed from prev state
        const prev = prevState.get(eid);
        if (!isNew && prev) {
          let changed = false;
          for (const key of Object.keys(state)) {
            if (key === 'eid' || key === 't') continue;
            if (state[key] !== prev[key]) { changed = true; break; }
          }
          if (!changed) continue;
        }

        prevState.set(eid, { ...state });
        delta.push(state);
      }

      // Add removals
      for (const eid of gameState.removedEntities) {
        removals.push(eid);
        prevState.delete(eid);
      }

      if (delta.length > 0 || removals.length > 0) {
        try {
          client.ws.send(JSON.stringify({
            type: MSG.DELTA,
            tick,
            entities: delta,
            removed: removals,
            time: gameState.worldTime,
            light: Math.round(gameState.lightLevel * 100) / 100,
          }));
        } catch (e) {
          // Client disconnected
        }
      }

      // Send inventory updates
      if (gameState.dirtyInventories.has(playerEid)) {
        const items = [];
        for (let s = 0; s < 24; s++) {
          items.push({
            id: Inventory.items[playerEid]?.[s] || 0,
            n: Inventory.counts[playerEid]?.[s] || 0,
          });
        }
        try {
          client.ws.send(JSON.stringify({
            type: MSG.INVENTORY_UPDATE,
            items,
            selected: Hotbar.selectedSlot[playerEid],
            hp: Math.round(Health.current[playerEid]),
            maxHp: Math.round(Health.max[playerEid]),
            hunger: Math.round(Hunger.current[playerEid]),
            thirst: Math.round(Thirst.current[playerEid]),
            temp: Math.round(Temperature.current[playerEid]),
          }));
        } catch (e) {}
      }
    }

    // Broadcast events
    if (gameState.events.length > 0) {
      const eventMsg = JSON.stringify({
        type: MSG.EVENT,
        events: gameState.events,
      });
      for (const [connId, client] of gameState.clients) {
        if (!client.ws) continue;
        try { client.ws.send(eventMsg); } catch (e) {}
      }
    }

    // Clean up prevState for disconnected clients
    for (const connId of clientPrevState.keys()) {
      if (!gameState.clients.has(connId)) {
        clientPrevState.delete(connId);
      }
    }

    // Clear per-tick state
    gameState.newEntities.clear();
    gameState.removedEntities.clear();
    gameState.dirtyInventories.clear();
    gameState.events = [];

    return world;
  };
}
