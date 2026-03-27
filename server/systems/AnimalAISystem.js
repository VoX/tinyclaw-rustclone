import { query, hasComponent, addEntity, addComponent, removeEntity } from 'bitecs';
import { Animal, Position, Velocity, Health, Rotation, Player, Dead, Collider, Damageable,
         WorldItem, Sprite, NetworkSync, Sleeper } from '../../shared/components.js';
import { AI_STATE, ANIMAL_DEFS, ANIMAL_TYPE, SERVER_TPS, ITEM_DESPAWN_TICKS, TILE_SIZE, BIOME, WORLD_SIZE } from '../../shared/constants.js';
import { ENTITY_TYPE } from '../../shared/protocol.js';

const ANIMAL_RESPAWN_TICKS = 5 * 60 * SERVER_TPS; // 5 minutes
const DEER_FLEE_RANGE = 15;
const DEER_SAFE_RANGE = 25;
const WOLF_PACK_RANGE = 12; // wolves within this range join the chase
const BEAR_TERRITORY_RANGE = 15;
const BEAR_DEAGGRO_RANGE = 25;
const WATER_CHECK_AHEAD = 2; // tiles ahead to check for water

export function createAnimalAISystem(gameState) {
  const attackCooldowns = new Map(); // eid -> next attack tick

  return function AnimalAISystem(world) {
    const animals = query(world, [Animal, Position, Velocity, Health]);
    const players = query(world, [Player, Position]);

    for (let i = 0; i < animals.length; i++) {
      const eid = animals[i];
      if (Health.current[eid] <= 0) {
        // Animal died - drop loot and queue respawn
        const type = Animal.animalType[eid];
        const def = ANIMAL_DEFS[type];
        const deathX = Position.x[eid];
        const deathY = Position.y[eid];
        if (def) {
          for (const [itemId, count] of def.drops) {
            const dropEid = addEntity(world);
            addComponent(world, dropEid, Position);
            addComponent(world, dropEid, WorldItem);
            addComponent(world, dropEid, Collider);
            addComponent(world, dropEid, Sprite);
            addComponent(world, dropEid, NetworkSync);

            Position.x[dropEid] = deathX + (Math.random() - 0.5) * 2;
            Position.y[dropEid] = deathY + (Math.random() - 0.5) * 2;
            WorldItem.itemId[dropEid] = itemId;
            WorldItem.quantity[dropEid] = count;
            WorldItem.despawnTimer[dropEid] = ITEM_DESPAWN_TICKS;
            Collider.radius[dropEid] = 0.3;
            Sprite.spriteId[dropEid] = itemId;
            NetworkSync.lastTick[dropEid] = gameState.tick;
            gameState.entityTypes.set(dropEid, ENTITY_TYPE.WORLD_ITEM);
            gameState.newEntities.add(dropEid);
          }
        }

        // Queue animal respawn
        gameState.animalSpawns.push({
          x: deathX,
          y: deathY,
          animalType: type,
          respawnAt: gameState.tick + ANIMAL_RESPAWN_TICKS,
        });

        // Remove animal
        attackCooldowns.delete(eid);
        gameState.removedEntities.add(eid);
        gameState.entityTypes.delete(eid);
        removeEntity(world, eid);
        continue;
      }

      const ax = Position.x[eid];
      const ay = Position.y[eid];
      const type = Animal.animalType[eid];
      const def = ANIMAL_DEFS[type];
      if (!def) continue;

      // Find nearest alive, non-sleeping player
      let nearestPlayer = -1;
      let nearestDist = Infinity;
      for (let j = 0; j < players.length; j++) {
        const peid = players[j];
        if (hasComponent(world, peid, Dead)) continue;
        if (hasComponent(world, peid, Sleeper)) continue;
        const dx = Position.x[peid] - ax;
        const dy = Position.y[peid] - ay;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestPlayer = peid;
        }
      }

      const curState = Animal.aiState[eid];

      // ── State transitions ──

      if (def.behavior === 'flee') {
        // Deer: flee when player within 15 tiles, safe at 25
        if (nearestDist < DEER_FLEE_RANGE && nearestPlayer >= 0) {
          Animal.aiState[eid] = AI_STATE.FLEE;
          Animal.targetEid[eid] = nearestPlayer;
        } else if (curState === AI_STATE.FLEE && nearestDist > DEER_SAFE_RANGE) {
          Animal.aiState[eid] = AI_STATE.WANDER;
        } else if (curState === AI_STATE.IDLE && gameState.tick >= Animal.idleUntil[eid]) {
          Animal.aiState[eid] = AI_STATE.WANDER;
        }
      } else if (def.behavior === 'aggro') {
        if (type === ANIMAL_TYPE.WOLF) {
          // Wolf pack: aggro when any wolf nearby is already chasing
          let shouldAggro = nearestDist < def.aggroRange && nearestPlayer >= 0;
          if (!shouldAggro && curState !== AI_STATE.CHASE && nearestPlayer >= 0 && nearestDist < WOLF_PACK_RANGE * 1.5) {
            // Check if any nearby wolf is already chasing
            for (let k = 0; k < animals.length; k++) {
              const otherEid = animals[k];
              if (otherEid === eid) continue;
              if (Animal.animalType[otherEid] !== ANIMAL_TYPE.WOLF) continue;
              if (Animal.aiState[otherEid] !== AI_STATE.CHASE) continue;
              const ddx = Position.x[otherEid] - ax;
              const ddy = Position.y[otherEid] - ay;
              if (ddx * ddx + ddy * ddy < WOLF_PACK_RANGE * WOLF_PACK_RANGE) {
                shouldAggro = true;
                break;
              }
            }
          }
          if (shouldAggro) {
            Animal.aiState[eid] = AI_STATE.CHASE;
            Animal.targetEid[eid] = nearestPlayer;
          } else if (curState === AI_STATE.CHASE && nearestDist > def.aggroRange * 2) {
            Animal.aiState[eid] = AI_STATE.WANDER;
          } else if (curState === AI_STATE.IDLE && gameState.tick >= Animal.idleUntil[eid]) {
            Animal.aiState[eid] = AI_STATE.WANDER;
          }
        } else if (type === ANIMAL_TYPE.BEAR) {
          // Bear: territorial — aggro when player enters territory, deaggro when they leave
          const wasHit = hasComponent(world, eid, Damageable) && Damageable.lastHitTime[eid] > gameState.tick - SERVER_TPS * 5;
          if ((nearestDist < BEAR_TERRITORY_RANGE || wasHit) && nearestPlayer >= 0) {
            Animal.aiState[eid] = AI_STATE.CHASE;
            Animal.targetEid[eid] = nearestPlayer;
          } else if (curState === AI_STATE.CHASE && nearestDist > BEAR_DEAGGRO_RANGE && !wasHit) {
            // Return home
            Animal.aiState[eid] = AI_STATE.WANDER;
            Animal.wanderTargetX[eid] = Animal.homeX[eid] || ax;
            Animal.wanderTargetY[eid] = Animal.homeY[eid] || ay;
          } else if (curState === AI_STATE.IDLE && gameState.tick >= Animal.idleUntil[eid]) {
            Animal.aiState[eid] = AI_STATE.WANDER;
          }
        } else {
          // Generic aggro fallback
          if (nearestDist < def.aggroRange && nearestPlayer >= 0) {
            Animal.aiState[eid] = AI_STATE.CHASE;
            Animal.targetEid[eid] = nearestPlayer;
          } else if (curState === AI_STATE.CHASE && nearestDist > def.aggroRange * 2) {
            Animal.aiState[eid] = AI_STATE.WANDER;
          } else if (curState === AI_STATE.IDLE && gameState.tick >= Animal.idleUntil[eid]) {
            Animal.aiState[eid] = AI_STATE.WANDER;
          }
        }
      } else if (def.behavior === 'flee_fight') {
        // Boar: fight back if hit recently and close, otherwise flee
        const wasHitRecently = hasComponent(world, eid, Damageable) && Damageable.lastHitTime[eid] > gameState.tick - SERVER_TPS * 3;
        if (nearestDist < 3 && wasHitRecently) {
          Animal.aiState[eid] = AI_STATE.CHASE;
          Animal.targetEid[eid] = nearestPlayer;
        } else if (nearestDist < DEER_FLEE_RANGE && nearestPlayer >= 0) {
          Animal.aiState[eid] = AI_STATE.FLEE;
          Animal.targetEid[eid] = nearestPlayer;
        } else if (curState === AI_STATE.FLEE && nearestDist > DEER_SAFE_RANGE) {
          Animal.aiState[eid] = AI_STATE.WANDER;
        } else if (curState === AI_STATE.IDLE && gameState.tick >= Animal.idleUntil[eid]) {
          Animal.aiState[eid] = AI_STATE.WANDER;
        }
      }

      // ── Execute behavior ──
      const newState = Animal.aiState[eid];
      // speed is in tiles/sec — MovementSystem multiplies by dt
      const speed = def.speed;

      if (newState === AI_STATE.IDLE) {
        Velocity.vx[eid] = 0;
        Velocity.vy[eid] = 0;

      } else if (newState === AI_STATE.WANDER) {
        // Natural wandering: smooth direction changes with occasional idle pauses
        const wtx = Animal.wanderTargetX[eid];
        const wty = Animal.wanderTargetY[eid];
        const dxW = wtx - ax;
        const dyW = wty - ay;
        const distW = Math.sqrt(dxW * dxW + dyW * dyW);

        if (distW < 1.5 || (wtx === 0 && wty === 0)) {
          // Reached target or no target — pick new one or idle
          if (Math.random() < 0.3) {
            // Pause and idle for 2-5 seconds
            Animal.aiState[eid] = AI_STATE.IDLE;
            Animal.idleUntil[eid] = gameState.tick + Math.floor((2 + Math.random() * 3) * SERVER_TPS);
            Velocity.vx[eid] = 0;
            Velocity.vy[eid] = 0;
          } else {
            // Pick a new wander target: slight angle deviation from current heading
            const baseAngle = Animal.wanderAngle[eid] || (Math.random() * Math.PI * 2);
            const newAngle = baseAngle + (Math.random() - 0.5) * 1.2; // +-~34 degrees
            const wanderDist = 5 + Math.random() * 10;
            Animal.wanderAngle[eid] = newAngle;
            Animal.wanderTargetX[eid] = ax + Math.cos(newAngle) * wanderDist;
            Animal.wanderTargetY[eid] = ay + Math.sin(newAngle) * wanderDist;
            // Clamp to world bounds
            const maxCoord = WORLD_SIZE * TILE_SIZE;
            Animal.wanderTargetX[eid] = Math.max(2, Math.min(maxCoord - 2, Animal.wanderTargetX[eid]));
            Animal.wanderTargetY[eid] = Math.max(2, Math.min(maxCoord - 2, Animal.wanderTargetY[eid]));
          }
        } else {
          const wanderSpeed = speed * 0.3; // wander at 30% of max speed
          const rawVx = (dxW / distW) * wanderSpeed;
          const rawVy = (dyW / distW) * wanderSpeed;

          // Water avoidance: check if next position is water
          const adjusted = avoidWater(ax, ay, rawVx, rawVy, gameState);
          Velocity.vx[eid] = adjusted[0];
          Velocity.vy[eid] = adjusted[1];
          Rotation.angle[eid] = Math.atan2(adjusted[1], adjusted[0]);
        }

      } else if (newState === AI_STATE.FLEE && nearestPlayer >= 0) {
        let fdx = ax - Position.x[nearestPlayer];
        let fdy = ay - Position.y[nearestPlayer];
        const fdist = Math.sqrt(fdx * fdx + fdy * fdy);
        if (fdist > 0) {
          let vx = (fdx / fdist) * speed;
          let vy = (fdy / fdist) * speed;
          // Water avoidance during flee — deflect rather than stop
          const adjusted = avoidWater(ax, ay, vx, vy, gameState);
          Velocity.vx[eid] = adjusted[0];
          Velocity.vy[eid] = adjusted[1];
          Rotation.angle[eid] = Math.atan2(adjusted[1], adjusted[0]);
        }

      } else if (newState === AI_STATE.CHASE && Animal.targetEid[eid] >= 0) {
        const target = Animal.targetEid[eid];
        if (hasComponent(world, target, Position)) {
          const cdx = Position.x[target] - ax;
          const cdy = Position.y[target] - ay;
          const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
          if (cdist > 1.2) {
            Velocity.vx[eid] = (cdx / cdist) * speed;
            Velocity.vy[eid] = (cdy / cdist) * speed;
            Rotation.angle[eid] = Math.atan2(cdy, cdx);
          } else {
            // Attack
            Velocity.vx[eid] = 0;
            Velocity.vy[eid] = 0;
            Rotation.angle[eid] = Math.atan2(cdy, cdx);
            const nextAttack = attackCooldowns.get(eid) || 0;
            if (gameState.tick >= nextAttack) {
              if (hasComponent(world, target, Health) && !hasComponent(world, target, Dead)) {
                Health.current[target] -= def.damage;
                if (hasComponent(world, target, Damageable)) {
                  Damageable.lastHitTime[target] = gameState.tick;
                  Damageable.lastHitBy[target] = eid;
                }
                gameState.events.push({
                  type: 'hit',
                  x: Position.x[target],
                  y: Position.y[target],
                  damage: def.damage,
                });
                attackCooldowns.set(eid, gameState.tick + SERVER_TPS);
              }
            }
          }
        }
      } else {
        Velocity.vx[eid] = 0;
        Velocity.vy[eid] = 0;
      }
    }

    // Process animal respawns
    for (let i = gameState.animalSpawns.length - 1; i >= 0; i--) {
      const spawn = gameState.animalSpawns[i];
      if (gameState.tick >= spawn.respawnAt) {
        gameState.animalSpawns.splice(i, 1);
        const newEid = addEntity(world);
        addComponent(world, newEid, Position);
        addComponent(world, newEid, Velocity);
        addComponent(world, newEid, Rotation);
        addComponent(world, newEid, Animal);
        addComponent(world, newEid, Health);
        addComponent(world, newEid, Collider);
        addComponent(world, newEid, Sprite);
        addComponent(world, newEid, NetworkSync);
        addComponent(world, newEid, Damageable);

        const def = ANIMAL_DEFS[spawn.animalType];
        if (!def) continue;
        const offsetX = (Math.random() - 0.5) * 20;
        const offsetY = (Math.random() - 0.5) * 20;
        Position.x[newEid] = spawn.x + offsetX;
        Position.y[newEid] = spawn.y + offsetY;
        Velocity.vx[newEid] = 0;
        Velocity.vy[newEid] = 0;
        Animal.animalType[newEid] = spawn.animalType;
        Animal.aiState[newEid] = AI_STATE.WANDER;
        Animal.aggroRange[newEid] = def.aggroRange;
        Animal.homeX[newEid] = Position.x[newEid];
        Animal.homeY[newEid] = Position.y[newEid];
        Animal.wanderAngle[newEid] = Math.random() * Math.PI * 2;
        Health.current[newEid] = def.hp;
        Health.max[newEid] = def.hp;
        Collider.radius[newEid] = 0.5;
        Sprite.spriteId[newEid] = 60 + spawn.animalType;
        NetworkSync.lastTick[newEid] = gameState.tick;

        gameState.entityTypes.set(newEid, ENTITY_TYPE.ANIMAL);
        gameState.newEntities.add(newEid);
      }
    }

    return world;
  };
}

// Check if a world position is water
function isWater(wx, wy, gameState) {
  if (!gameState.getBiomeAt) return false;
  return gameState.getBiomeAt(wx, wy) === BIOME.WATER;
}

// Deflect velocity away from water tiles ahead
function avoidWater(ax, ay, vx, vy, gameState) {
  if (!gameState.getBiomeAt) return [vx, vy];
  const checkDist = WATER_CHECK_AHEAD * TILE_SIZE;
  const nextX = ax + (vx > 0 ? checkDist : vx < 0 ? -checkDist : 0);
  const nextY = ay + (vy > 0 ? checkDist : vy < 0 ? -checkDist : 0);

  if (!isWater(nextX, nextY, gameState)) return [vx, vy];

  // Try rotating 90 degrees both ways, pick the one that's not water
  const rotations = [Math.PI / 2, -Math.PI / 2, Math.PI];
  for (const rot of rotations) {
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const rvx = vx * cos - vy * sin;
    const rvy = vx * sin + vy * cos;
    const rnx = ax + (rvx > 0 ? checkDist : rvx < 0 ? -checkDist : 0);
    const rny = ay + (rvy > 0 ? checkDist : rvy < 0 ? -checkDist : 0);
    if (!isWater(rnx, rny, gameState)) {
      return [rvx, rvy];
    }
  }
  // All directions water — stop
  return [0, 0];
}
