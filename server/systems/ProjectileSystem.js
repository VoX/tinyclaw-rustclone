import { query, removeEntity, hasComponent } from 'bitecs';
import { Projectile, Position, Velocity, Collider, Health, Dead, Damageable, Player, ResourceNode, Armor } from '../../shared/components.js';
import { getArmorReduction } from '../../shared/constants.js';
import { ENTITY_TYPE } from '../../shared/protocol.js';

export function createProjectileSystem(gameState) {
  return function ProjectileSystem(world) {
    const projectiles = query(world, [Projectile, Position]);
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

      const targets = gameState.spatialHash ? gameState.spatialHash.query(px, py, 3) : [];
      for (let j = 0; j < targets.length; j++) {
        const target = targets[j];
        if (!hasComponent(world, target, Health) || !hasComponent(world, target, Collider)) continue;
        if (target === sourceEid) continue;
        if (target === eid) continue;
        if (hasComponent(world, target, Dead)) continue;
        // Don't hit resource nodes — they aren't combat targets
        if (hasComponent(world, target, ResourceNode)) continue;

        const dx = px - Position.x[target];
        const dy = py - Position.y[target];
        const dist = Math.sqrt(dx * dx + dy * dy);
        const hitDist = projRadius + (Collider.radius[target] || 0.4);

        if (dist < hitDist) {
          // Skip if target player has spawn protection (from player projectiles only)
          if (hasComponent(world, target, Player) && gameState.entityTypes.get(sourceEid) === ENTITY_TYPE.PLAYER) {
            const targetConnId = Player.connectionId[target];
            const targetClient = gameState.clients.get(targetConnId);
            if (targetClient && gameState.tick < targetClient.spawnProtectionUntil) continue;
          }

          // Hit! Apply armor reduction
          let dmg = Projectile.damage[eid];
          if (hasComponent(world, target, Armor)) {
            const reduction = getArmorReduction(Armor.headSlot[target], Armor.chestSlot[target], Armor.legsSlot[target]);
            dmg = Math.round(dmg * (1 - reduction));
          }
          Health.current[target] -= dmg;
          if (hasComponent(world, target, Damageable)) {
            Damageable.lastHitTime[target] = gameState.tick;
            Damageable.lastHitBy[target] = sourceEid;
          }

          // Knockback from projectile
          if (hasComponent(world, target, Velocity) && dist > 0) {
            const knockStr = 4.0;
            Velocity.vx[target] += (-dx / dist) * knockStr;
            Velocity.vy[target] += (-dy / dist) * knockStr;
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
