import { query, hasComponent } from 'bitecs';
import { Position, Velocity, Collider, Structure } from '../../shared/components.js';
import { WORLD_SIZE, TILE_SIZE, SERVER_TPS } from '../../shared/constants.js';
import { circleVsOBB } from '../../shared/collision.js';

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

      // Check collision with static colliders using spatial hash
      if (hasComponent(world, eid, Collider) && gameState.spatialHash) {
        const myRadius = Collider.radius[eid];
        const nearby = gameState.spatialHash.query(newX, newY, myRadius + 3);
        for (let j = 0; j < nearby.length; j++) {
          const other = nearby[j];
          if (other === eid) continue;
          if (!hasComponent(world, other, Collider)) continue;
          if (!Collider.isStatic[other]) continue;

          // OBB collision for walls
          if (hasComponent(world, other, Structure) && Structure.boxHalfW[other] > 0) {
            const hit = circleVsOBB(
              newX, newY, myRadius,
              Position.x[other], Position.y[other],
              Structure.boxHalfW[other], Structure.boxHalfH[other],
              Structure.rotation[other]
            );
            if (hit) {
              newX += hit.nx * hit.overlap;
              newY += hit.ny * hit.overlap;
            }
          } else {
            const dx = newX - Position.x[other];
            const dy = newY - Position.y[other];
            const distSq = dx * dx + dy * dy;
            const minDist = myRadius + Collider.radius[other];

            if (distSq < minDist * minDist && distSq > 0) {
              const dist = Math.sqrt(distSq);
              const overlap = minDist - dist;
              const nx = dx / dist;
              const ny = dy / dist;
              newX += nx * overlap;
              newY += ny * overlap;
            }
          }
        }
      }

      Position.x[eid] = newX;
      Position.y[eid] = newY;
    }
    return world;
  };
}
