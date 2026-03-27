import { defineQuery, removeEntity, hasComponent } from 'bitecs';
import { Projectile, Position, Collider, Health, Dead, Damageable, Player, ResourceNode } from '../../shared/components.js';

const projectileQuery = defineQuery([Projectile, Position]);
const collidableQuery = defineQuery([Position, Health, Collider]);

export function createProjectileSystem(gameState) {
  return function ProjectileSystem(world) {
    const projectiles = projectileQuery(world);
    for (let i = 0; i < projectiles.length; i++) {
      const eid = projectiles[i];

      // Decrease lifetime
      Projectile.lifetime[eid]--;
      if (Projectile.lifetime[eid] <= 0) {
        gameState.removedEntities.add(eid);
        gameState.entityTypes.delete(eid);
        removeEntity(world, eid);
        continue;
      }

      // Check collisions with collidable entities
      const px = Position.x[eid];
      const py = Position.y[eid];
      const sourceEid = Projectile.sourceEid[eid];
      const projRadius = Collider.radius[eid] || 0.15;

      const targets = collidableQuery(world);
      for (let j = 0; j < targets.length; j++) {
        const target = targets[j];
        if (target === sourceEid) continue;
        if (target === eid) continue;
        if (hasComponent(world, Dead, target)) continue;
        // Don't hit resource nodes — they aren't combat targets
        if (hasComponent(world, ResourceNode, target)) continue;

        const dx = px - Position.x[target];
        const dy = py - Position.y[target];
        const dist = Math.sqrt(dx * dx + dy * dy);
        const hitDist = projRadius + (Collider.radius[target] || 0.4);

        if (dist < hitDist) {
          // Hit!
          Health.current[target] -= Projectile.damage[eid];
          if (hasComponent(world, Damageable, target)) {
            Damageable.lastHitTime[target] = gameState.tick;
            Damageable.lastHitBy[target] = sourceEid;
          }

          gameState.events.push({
            type: 'hit',
            x: Position.x[target],
            y: Position.y[target],
            damage: Projectile.damage[eid],
          });

          // Remove projectile
          gameState.removedEntities.add(eid);
          gameState.entityTypes.delete(eid);
          removeEntity(world, eid);
          break;
        }
      }
    }
    return world;
  };
}
