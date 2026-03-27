import { addEntity, addComponent, removeEntity, query, hasComponent } from 'bitecs';
import { Position, Velocity, Health, Collider, NetworkSync, Helicopter, HeliCrate, StorageBox } from '../../shared/components.js';
import { ENTITY_TYPE } from '../../shared/protocol.js';
import {
  WORLD_SIZE, TILE_SIZE, SERVER_TPS,
  HELI_MIN_INTERVAL, HELI_MAX_INTERVAL, HELI_SPEED,
  HELI_CRATE_UNLOCK_TICKS, HELI_CRATE_LOOT, ITEM
} from '../../shared/constants.js';
import { MSG } from '../../shared/protocol.js';

export function createHelicopterSystem(gameState) {
  const maxCoord = WORLD_SIZE * TILE_SIZE;
  let nextHeliTick = gameState.tick + Math.floor(HELI_MIN_INTERVAL + Math.random() * (HELI_MAX_INTERVAL - HELI_MIN_INTERVAL));

  return function HelicopterSystem(world) {
    const tick = gameState.tick;

    // Check if time to spawn helicopter
    if (tick >= nextHeliTick && !gameState.activeHeli) {
      spawnHelicopter(world);
      nextHeliTick = tick + Math.floor(HELI_MIN_INTERVAL + Math.random() * (HELI_MAX_INTERVAL - HELI_MIN_INTERVAL));
    }

    // Update active helicopter
    const helis = query(world, [Helicopter, Position]);
    for (let i = 0; i < helis.length; i++) {
      const eid = helis[i];
      const speed = HELI_SPEED * TILE_SIZE / SERVER_TPS; // meters per tick
      const sx = Helicopter.startX[eid];
      const sy = Helicopter.startY[eid];
      const ex = Helicopter.endX[eid];
      const ey = Helicopter.endY[eid];
      const dx = ex - sx;
      const dy = ey - sy;
      const totalDist = Math.sqrt(dx * dx + dy * dy);
      const progressInc = speed / totalDist;

      Helicopter.progress[eid] += progressInc;
      const p = Helicopter.progress[eid];

      // Update position
      Position.x[eid] = sx + dx * p;
      Position.y[eid] = sy + dy * p;

      // Drop crate at midpoint
      if (p >= 0.5 && !Helicopter.dropped[eid]) {
        Helicopter.dropped[eid] = 1;
        const dropX = Helicopter.dropX[eid];
        const dropY = Helicopter.dropY[eid];
        spawnHeliCrate(world, dropX, dropY);

        // Broadcast heli crate drop event
        gameState.events.push({
          type: 'heli_crate',
          x: dropX,
          y: dropY,
        });

        // Notify all clients
        const msg = JSON.stringify({
          type: MSG.HELI_EVENT,
          event: 'crate_drop',
          x: dropX,
          y: dropY,
        });
        for (const [, client] of gameState.clients) {
          if (client.ws) try { client.ws.send(msg); } catch (e) {}
        }
      }

      // Remove when reached end
      if (p >= 1.0) {
        gameState.removedEntities.add(eid);
        gameState.entityTypes.delete(eid);
        removeEntity(world, eid);
        gameState.activeHeli = null;
      }
    }

    // Update heli crates — check unlock timer
    const crates = query(world, [HeliCrate, Position]);
    for (let i = 0; i < crates.length; i++) {
      const eid = crates[i];
      if (HeliCrate.looted[eid]) continue;
      // Crate tracks unlock time; interaction handled in InteractSystem
    }

    return world;
  };

  function spawnHelicopter(world) {
    const eid = addEntity(world);
    addComponent(world, eid, Position);
    addComponent(world, eid, Velocity);
    addComponent(world, eid, NetworkSync);
    addComponent(world, eid, Helicopter);

    // Pick random start/end edges
    const side = Math.floor(Math.random() * 4);
    const dropX = maxCoord * 0.2 + Math.random() * maxCoord * 0.6;
    const dropY = maxCoord * 0.2 + Math.random() * maxCoord * 0.6;

    let sx, sy, ex, ey;
    const margin = maxCoord * 0.1;
    if (side === 0) { // left to right
      sx = -margin; sy = dropY; ex = maxCoord + margin; ey = dropY;
    } else if (side === 1) { // right to left
      sx = maxCoord + margin; sy = dropY; ex = -margin; ey = dropY;
    } else if (side === 2) { // top to bottom
      sx = dropX; sy = -margin; ex = dropX; ey = maxCoord + margin;
    } else { // bottom to top
      sx = dropX; sy = maxCoord + margin; ex = dropX; ey = -margin;
    }

    Helicopter.startX[eid] = sx;
    Helicopter.startY[eid] = sy;
    Helicopter.endX[eid] = ex;
    Helicopter.endY[eid] = ey;
    Helicopter.progress[eid] = 0;
    Helicopter.dropX[eid] = dropX;
    Helicopter.dropY[eid] = dropY;
    Helicopter.dropped[eid] = 0;

    Position.x[eid] = sx;
    Position.y[eid] = sy;
    Velocity.vx[eid] = 0;
    Velocity.vy[eid] = 0;
    NetworkSync.lastTick[eid] = gameState.tick;

    gameState.entityTypes.set(eid, ENTITY_TYPE.HELICOPTER);
    gameState.newEntities.add(eid);
    gameState.activeHeli = eid;

    // Broadcast heli spawn event
    const msg = JSON.stringify({
      type: MSG.HELI_EVENT,
      event: 'spawn',
      sx, sy, ex, ey, dropX, dropY,
    });
    for (const [, client] of gameState.clients) {
      if (client.ws) try { client.ws.send(msg); } catch (e) {}
    }

    // Server notification
    gameState.events.push({ type: 'heli_spawn' });
  }

  function spawnHeliCrate(world, x, y) {
    const eid = addEntity(world);
    addComponent(world, eid, Position);
    addComponent(world, eid, Health);
    addComponent(world, eid, Collider);
    addComponent(world, eid, NetworkSync);
    addComponent(world, eid, HeliCrate);

    Position.x[eid] = x;
    Position.y[eid] = y;
    Health.current[eid] = 500;
    Health.max[eid] = 500;
    Collider.radius[eid] = 1.0;
    Collider.isStatic[eid] = 1;
    NetworkSync.lastTick[eid] = gameState.tick;
    HeliCrate.unlockTick[eid] = gameState.tick + HELI_CRATE_UNLOCK_TICKS;
    HeliCrate.looted[eid] = 0;

    // Store loot in container inventory (random subset of 4-6 items from pool)
    const lootCount = 4 + Math.floor(Math.random() * 3);
    const shuffled = [...HELI_CRATE_LOOT].sort(() => Math.random() - 0.5);
    const slots = [];
    for (let i = 0; i < Math.min(lootCount, shuffled.length); i++) {
      slots.push({ id: shuffled[i][0], n: shuffled[i][1] });
    }
    gameState.containerInv.set(eid, slots);

    gameState.entityTypes.set(eid, ENTITY_TYPE.HELI_CRATE);
    gameState.newEntities.add(eid);
  }
}
