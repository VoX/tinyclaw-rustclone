import { query, hasComponent, addEntity, addComponent, removeEntity } from 'bitecs';
import { Animal, Position, Velocity, Health, Player, Dead, Collider, Damageable,
         WorldItem, Sprite, NetworkSync } from '../../shared/components.js';
import { AI_STATE, ANIMAL_DEFS, ANIMAL_TYPE, SERVER_TPS, ITEM_DESPAWN_TICKS } from '../../shared/constants.js';
import { ENTITY_TYPE } from '../../shared/protocol.js';

export function createAnimalAISystem(gameState) {
  const wanderChangeInterval = 5 * SERVER_TPS; // Change wander direction every 5s
  let wanderTick = 0;
  const attackCooldowns = new Map(); // eid -> next attack tick

  return function AnimalAISystem(world) {
    wanderTick++;
    const animals = query(world, [Animal, Position, Velocity, Health]);
    const players = query(world, [Player, Position]);

    for (let i = 0; i < animals.length; i++) {
      const eid = animals[i];
      if (Health.current[eid] <= 0) {
        // Animal died - drop loot
        const type = Animal.animalType[eid];
        const def = ANIMAL_DEFS[type];
        if (def) {
          for (const [itemId, count] of def.drops) {
            const dropEid = addEntity(world);
            addComponent(world, dropEid, Position);
            addComponent(world, dropEid, WorldItem);
            addComponent(world, dropEid, Collider);
            addComponent(world, dropEid, Sprite);
            addComponent(world, dropEid, NetworkSync);

            Position.x[dropEid] = Position.x[eid] + (Math.random() - 0.5) * 2;
            Position.y[dropEid] = Position.y[eid] + (Math.random() - 0.5) * 2;
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
        // Remove animal
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

      // Find nearest player
      let nearestPlayer = -1;
      let nearestDist = Infinity;
      for (let j = 0; j < players.length; j++) {
        const peid = players[j];
        if (hasComponent(world, peid, Dead)) continue;
        const dx = Position.x[peid] - ax;
        const dy = Position.y[peid] - ay;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestPlayer = peid;
        }
      }

      const state = Animal.aiState[eid];

      // State transitions
      if (def.behavior === 'flee') {
        if (nearestDist < 8) {
          Animal.aiState[eid] = AI_STATE.FLEE;
          Animal.targetEid[eid] = nearestPlayer;
        } else if (state === AI_STATE.FLEE && nearestDist > 15) {
          Animal.aiState[eid] = AI_STATE.WANDER;
        } else if (state === AI_STATE.IDLE) {
          Animal.aiState[eid] = AI_STATE.WANDER;
        }
      } else if (def.behavior === 'aggro') {
        if (nearestDist < def.aggroRange && nearestPlayer >= 0) {
          Animal.aiState[eid] = AI_STATE.CHASE;
          Animal.targetEid[eid] = nearestPlayer;
        } else if (state === AI_STATE.CHASE && nearestDist > def.aggroRange * 2) {
          Animal.aiState[eid] = AI_STATE.WANDER;
        } else if (state === AI_STATE.IDLE) {
          Animal.aiState[eid] = AI_STATE.WANDER;
        }
      } else if (def.behavior === 'flee_fight') {
        if (nearestDist < 3 && hasComponent(world, eid, Damageable) && Damageable.lastHitTime[eid] > gameState.tick - SERVER_TPS * 3) {
          Animal.aiState[eid] = AI_STATE.CHASE;
          Animal.targetEid[eid] = nearestPlayer;
        } else if (nearestDist < 8) {
          Animal.aiState[eid] = AI_STATE.FLEE;
          Animal.targetEid[eid] = nearestPlayer;
        } else if (state === AI_STATE.FLEE && nearestDist > 15) {
          Animal.aiState[eid] = AI_STATE.WANDER;
        } else if (state === AI_STATE.IDLE) {
          Animal.aiState[eid] = AI_STATE.WANDER;
        }
      }

      // Execute behavior based on state
      const newState = Animal.aiState[eid];
      const speed = def.speed / SERVER_TPS;

      if (newState === AI_STATE.WANDER) {
        if (wanderTick % wanderChangeInterval === 0 || (Animal.wanderTargetX[eid] === 0 && Animal.wanderTargetY[eid] === 0)) {
          Animal.wanderTargetX[eid] = ax + (Math.random() - 0.5) * 20;
          Animal.wanderTargetY[eid] = ay + (Math.random() - 0.5) * 20;
        }
        const dx = Animal.wanderTargetX[eid] - ax;
        const dy = Animal.wanderTargetY[eid] - ay;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 1) {
          Velocity.vx[eid] = (dx / dist) * speed * 0.5;
          Velocity.vy[eid] = (dy / dist) * speed * 0.5;
        } else {
          Velocity.vx[eid] = 0;
          Velocity.vy[eid] = 0;
        }
      } else if (newState === AI_STATE.FLEE && nearestPlayer >= 0) {
        const dx = ax - Position.x[nearestPlayer];
        const dy = ay - Position.y[nearestPlayer];
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          Velocity.vx[eid] = (dx / dist) * speed;
          Velocity.vy[eid] = (dy / dist) * speed;
        }
      } else if (newState === AI_STATE.CHASE && Animal.targetEid[eid] >= 0) {
        const target = Animal.targetEid[eid];
        if (hasComponent(world, target, Position)) {
          const dx = Position.x[target] - ax;
          const dy = Position.y[target] - ay;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 1.2) {
            Velocity.vx[eid] = (dx / dist) * speed;
            Velocity.vy[eid] = (dy / dist) * speed;
          } else {
            // Attack
            Velocity.vx[eid] = 0;
            Velocity.vy[eid] = 0;
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
                attackCooldowns.set(eid, gameState.tick + SERVER_TPS); // 1 second cooldown
              }
            }
          }
        }
      } else {
        Velocity.vx[eid] = 0;
        Velocity.vy[eid] = 0;
      }
    }
    return world;
  };
}
