import { defineQuery, hasComponent } from 'bitecs';
import { Position, Velocity, Collider, Structure } from '../../shared/components.js';
import { WORLD_SIZE, TILE_SIZE, SERVER_TPS } from '../../shared/constants.js';

const movableQuery = defineQuery([Position, Velocity]);
const staticColliderQuery = defineQuery([Position, Collider]);

export function createMovementSystem(gameState) {
  const dt = 1 / SERVER_TPS;

  return function MovementSystem(world) {
    const movers = movableQuery(world);
    for (let i = 0; i < movers.length; i++) {
      const eid = movers[i];
      const vx = Velocity.vx[eid];
      const vy = Velocity.vy[eid];
      if (vx === 0 && vy === 0) continue;

      let newX = Position.x[eid] + vx * dt;
      let newY = Position.y[eid] + vy * dt;

      // Clamp to world bounds
      const maxCoord = WORLD_SIZE * TILE_SIZE;
      newX = Math.max(0, Math.min(maxCoord, newX));
      newY = Math.max(0, Math.min(maxCoord, newY));

      // Check collision with static colliders (structures)
      if (hasComponent(world, Collider, eid)) {
        const myRadius = Collider.radius[eid];
        const statics = staticColliderQuery(world);
        let blocked = false;
        for (let j = 0; j < statics.length; j++) {
          const other = statics[j];
          if (other === eid) continue;
          if (!Collider.isStatic[other]) continue;

          const dx = newX - Position.x[other];
          const dy = newY - Position.y[other];
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = myRadius + Collider.radius[other];

          if (dist < minDist && dist > 0) {
            // Push out
            const overlap = minDist - dist;
            const nx = dx / dist;
            const ny = dy / dist;
            newX += nx * overlap;
            newY += ny * overlap;
          }
        }
      }

      Position.x[eid] = newX;
      Position.y[eid] = newY;
    }
    return world;
  };
}
