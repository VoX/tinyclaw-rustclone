import { query, hasComponent } from 'bitecs';
import { Position, Velocity, Collider, Structure } from '../../shared/components.js';
import { WORLD_SIZE, TILE_SIZE, SERVER_TPS } from '../../shared/constants.js';

export function createMovementSystem(gameState) {
  const dt = 1 / SERVER_TPS;

  return function MovementSystem(world) {
    const movers = query(world, [Position, Velocity]);
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

      // Check collision with static colliders (structures, nodes)
      if (hasComponent(world, eid, Collider)) {
        const myRadius = Collider.radius[eid];
        const maxCheckDist = myRadius + 2; // max collider radius ~1 + margin
        const statics = query(world, [Position, Collider]);
        for (let j = 0; j < statics.length; j++) {
          const other = statics[j];
          if (other === eid) continue;
          if (!Collider.isStatic[other]) continue;

          // Quick rejection — skip if clearly out of range
          const dx = newX - Position.x[other];
          const dy = newY - Position.y[other];
          if (dx > maxCheckDist || dx < -maxCheckDist || dy > maxCheckDist || dy < -maxCheckDist) continue;

          const distSq = dx * dx + dy * dy;
          const minDist = myRadius + Collider.radius[other];

          if (distSq < minDist * minDist && distSq > 0) {
            const dist = Math.sqrt(distSq);
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
