import { query, removeEntity, hasComponent } from 'bitecs';
import { Projectile, Position, Velocity, Collider, Health, Dead, Damageable, Player, ResourceNode, Armor, Sprite } from '../../shared/components.js';
import { getArmorReduction, SERVER_TPS } from '../../shared/constants.js';
import { ENTITY_TYPE } from '../../shared/protocol.js';
import { areTeammates } from './TeamSystem.js';

export function createProjectileSystem(gameState) {
  const ARROW_GRAVITY = 3.0; // tiles/sec^2 downward (Y increases)

  return function ProjectileSystem(world) {
    const projectiles = query(world, [Projectile, Position]);
    for (let i = 0; i < projectiles.length; i++) {
      const eid = projectiles[i];

      // Arrow gravity arc
      if (Sprite.spriteId[eid] === 101) {
        Velocity.vy[eid] += ARROW_GRAVITY / SERVER_TPS;
      }

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
      let destroyed = false;
      for (let j = 0; j < targets.length; j++) {
        const target = targets[j];
        if (target === sourceEid) continue;
        if (target === eid) continue;
        if (!hasComponent(world, target, Collider)) continue;

        // Resource nodes block projectiles without taking damage
        if (hasComponent(world, target, ResourceNode)) {
          const dx = px - Position.x[target];
          const dy = py - Position.y[target];
          const dist = Math.sqrt(dx * dx + dy * dy);
          const hitDist = projRadius + (Collider.radius[target] || 0.4);
          if (dist < hitDist) {
            gameState.removedEntities.add(eid);
            gameState.entityTypes.delete(eid);
            removeEntity(world, eid);
            destroyed = true;
            break;
          }
          continue;
        }

        if (!hasComponent(world, target, Health)) continue;
        if (hasComponent(world, target, Dead)) continue;

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
            // No friendly fire
            if (areTeammates(gameState, sourceEid, target)) continue;
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
          destroyed = true;
          break;
        }
      }
      if (destroyed) continue;
    }
    return world;
  };
}
