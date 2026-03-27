import { query, hasComponent, removeComponent, addComponent, removeEntity } from 'bitecs';
import { Player, Dead, Position, Health, Hunger, Thirst, Temperature, Inventory,
         Hotbar, Velocity, SleepingBag, ActiveTool, initInventory } from '../../shared/components.js';
import { PLAYER_MAX_HP, PLAYER_MAX_HUNGER, PLAYER_MAX_THIRST, ITEM, WORLD_SIZE, TILE_SIZE, SERVER_TPS } from '../../shared/constants.js';

export function createRespawnSystem(gameState) {
  return function RespawnSystem(world) {
    // Tick down dead timers
    const deadPlayers = query(world, [Player, Dead]);
    for (let i = 0; i < deadPlayers.length; i++) {
      const eid = deadPlayers[i];
      Dead.timer[eid]--;
    }

    // Tick down bed/sleeping bag cooldowns
    const allBags = query(world, [SleepingBag]);
    for (let i = 0; i < allBags.length; i++) {
      const eid = allBags[i];
      if (SleepingBag.cooldown[eid] > 0) SleepingBag.cooldown[eid]--;
    }

    // Process respawn requests
    for (const [connId, client] of gameState.clients) {
      if (!client.respawnRequest) continue;
      const req = client.respawnRequest;
      client.respawnRequest = null;

      const eid = client.playerEid;
      if (!eid || !hasComponent(world, eid, Dead)) continue;
      if (Dead.timer[eid] > 0) continue; // Still waiting

      let spawnX, spawnY;

      if (req.bagEid) {
        // Try to spawn at sleeping bag or bed
        const bagEid = req.bagEid;
        if (hasComponent(world, bagEid, SleepingBag) && SleepingBag.ownerPlayerId[bagEid] === eid) {
          spawnX = Position.x[bagEid];
          spawnY = Position.y[bagEid];
          const isBed = gameState.entityTypes.get(bagEid) === 16; // ENTITY_TYPE.BED
          if (isBed) {
            // Bed: reusable with 5 min cooldown
            SleepingBag.cooldown[bagEid] = 5 * 60 * SERVER_TPS;
          } else {
            // Sleeping bag: one-time use — destroy it
            gameState.removedEntities.add(bagEid);
            gameState.entityTypes.delete(bagEid);
            removeEntity(world, bagEid);
          }
        } else {
          continue; // Invalid bag
        }
      } else {
        // Random beach spawn
        const spawn = getRandomBeachSpawn(gameState);
        spawnX = spawn.x;
        spawnY = spawn.y;
      }

      // Respawn the player
      removeComponent(world, eid, Dead);
      Position.x[eid] = spawnX;
      Position.y[eid] = spawnY;
      Velocity.vx[eid] = 0;
      Velocity.vy[eid] = 0;
      Health.current[eid] = PLAYER_MAX_HP;
      Health.max[eid] = PLAYER_MAX_HP;
      Hunger.current[eid] = PLAYER_MAX_HUNGER;
      Hunger.max[eid] = PLAYER_MAX_HUNGER;
      Thirst.current[eid] = PLAYER_MAX_THIRST;
      Thirst.max[eid] = PLAYER_MAX_THIRST;
      Temperature.current[eid] = 20;
      Temperature.comfort[eid] = 1;

      // Give starting items - reinitialize inventory arrays
      initInventory(eid);
      Inventory.items[eid][0] = ITEM.ROCK;
      Inventory.counts[eid][0] = 1;
      Inventory.durability[eid][0] = 50;
      Inventory.items[eid][1] = ITEM.TORCH;
      Inventory.counts[eid][1] = 1;
      Inventory.durability[eid][1] = 50;
      Hotbar.selectedSlot[eid] = 0;
      gameState.dirtyInventories.add(eid);

      // Reset spawn tick for survival timer and spawn protection
      if (client) {
        client.spawnTick = gameState.tick;
        client.spawnProtectionUntil = gameState.tick + 10 * SERVER_TPS;
      }
    }
    return world;
  };
}

function getRandomBeachSpawn(gameState) {
  // Beach is the outer ring of the map
  const maxCoord = WORLD_SIZE * TILE_SIZE;
  const margin = maxCoord * 0.05;
  const side = Math.floor(Math.random() * 4);
  let x, y;
  switch (side) {
    case 0: x = margin + Math.random() * (maxCoord - 2 * margin); y = Math.random() * margin; break;
    case 1: x = margin + Math.random() * (maxCoord - 2 * margin); y = maxCoord - Math.random() * margin; break;
    case 2: x = Math.random() * margin; y = margin + Math.random() * (maxCoord - 2 * margin); break;
    default: x = maxCoord - Math.random() * margin; y = margin + Math.random() * (maxCoord - 2 * margin); break;
  }
  return { x, y };
}
