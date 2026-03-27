import { query, hasComponent, addEntity, addComponent } from 'bitecs';
import { Player, Position, Rotation, Health, ActiveTool, Inventory, Hotbar, Dead,
         Projectile, Velocity, Collider, NetworkSync, Sprite, Damageable, ResourceNode, Armor } from '../../shared/components.js';
import { MOUSE_ACTION } from '../../shared/protocol.js';
import { ITEM_DEFS, SERVER_TPS, getArmorReduction } from '../../shared/constants.js';
import { ENTITY_TYPE } from '../../shared/protocol.js';

export function createCombatSystem(gameState) {
  const attackCooldowns = new Map(); // eid -> ticks remaining

  return function CombatSystem(world) {
    const players = query(world, [Player, Position, Health]);
    const now = gameState.tick;

    for (let i = 0; i < players.length; i++) {
      const eid = players[i];
      if (hasComponent(world, eid, Dead)) continue;

      const connId = Player.connectionId[eid];
      const client = gameState.clients.get(connId);
      if (!client || client.mouseAction !== MOUSE_ACTION.PRIMARY) continue;

      // Check cooldown
      const lastAttack = attackCooldowns.get(eid) || 0;
      if (now < lastAttack) continue;

      // Get held item
      const slot = Hotbar.selectedSlot[eid];
      const itemId = Inventory.items[eid]?.[slot] || 0;
      const def = ITEM_DEFS[itemId];
      if (!def) continue;

      const angle = Rotation.angle[eid];
      const px = Position.x[eid];
      const py = Position.y[eid];

      if (def.cat === 'ranged') {
        // Check ammo
        const ammoType = def.ammoType;
        if (ammoType) {
          let ammoSlot = -1;
          for (let s = 0; s < 24; s++) {
            if (Inventory.items[eid][s] === ammoType && Inventory.counts[eid][s] > 0) {
              ammoSlot = s;
              break;
            }
          }
          if (ammoSlot === -1) continue; // no ammo
          Inventory.counts[eid][ammoSlot]--;
          if (Inventory.counts[eid][ammoSlot] === 0) Inventory.items[eid][ammoSlot] = 0;
          gameState.dirtyInventories.add(eid);
        }

        // Spawn projectile
        const projEid = addEntity(world);
        addComponent(world, projEid, Position);
        addComponent(world, projEid, Velocity);
        addComponent(world, projEid, Projectile);
        addComponent(world, projEid, Collider);
        addComponent(world, projEid, NetworkSync);
        addComponent(world, projEid, Sprite);

        const projSpeed = 20; // tiles/sec
        Position.x[projEid] = px + Math.cos(angle) * 0.8;
        Position.y[projEid] = py + Math.sin(angle) * 0.8;
        Velocity.vx[projEid] = Math.cos(angle) * projSpeed;
        Velocity.vy[projEid] = Math.sin(angle) * projSpeed;
        Projectile.damage[projEid] = def.damage;
        Projectile.speed[projEid] = projSpeed;
        Projectile.sourceEid[projEid] = eid;
        Projectile.lifetime[projEid] = def.range / projSpeed * SERVER_TPS;
        Collider.radius[projEid] = 0.15;
        Sprite.spriteId[projEid] = 100; // projectile sprite
        NetworkSync.lastTick[projEid] = now;

        gameState.entityTypes.set(projEid, ENTITY_TYPE.PROJECTILE);
        gameState.newEntities.add(projEid);

        // Set cooldown
        const cooldownTicks = Math.ceil(SERVER_TPS / def.fireRate);
        attackCooldowns.set(eid, now + cooldownTicks);

      } else if (def.damage > 0) {
        // Melee attack
        const range = 1.5; // tiles
        const arc = Math.PI / 3; // 60 degree arc

        // Find targets in range+arc — query entities with Position+Health
        const meleeTargets = query(world, [Position, Health]);
        for (let k = 0; k < meleeTargets.length; k++) {
          const targetEid = meleeTargets[k];
          if (targetEid === eid) continue;
          if (hasComponent(world, targetEid, Dead)) continue;
          // Don't melee resource nodes — gathering is handled by GatherSystem
          if (hasComponent(world, targetEid, ResourceNode)) continue;

          const dx = Position.x[targetEid] - px;
          const dy = Position.y[targetEid] - py;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > range) continue;

          // Check arc
          const targetAngle = Math.atan2(dy, dx);
          let angleDiff = targetAngle - angle;
          while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
          while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
          if (Math.abs(angleDiff) > arc / 2) continue;

          // Apply damage (reduced by target armor)
          let dmg = def.damage;
          if (hasComponent(world, targetEid, Armor)) {
            const reduction = getArmorReduction(Armor.headSlot[targetEid], Armor.chestSlot[targetEid], Armor.legsSlot[targetEid]);
            dmg = Math.round(dmg * (1 - reduction));
          }
          Health.current[targetEid] -= dmg;
          if (hasComponent(world, targetEid, Damageable)) {
            Damageable.lastHitTime[targetEid] = now;
            Damageable.lastHitBy[targetEid] = eid;
          }

          // Send hit event
          gameState.events.push({
            type: 'hit',
            x: Position.x[targetEid],
            y: Position.y[targetEid],
            damage: def.damage,
          });

          break; // Only hit one target per swing
        }

        // Set cooldown
        const cooldownTicks = Math.ceil(SERVER_TPS / (def.swingRate || 1));
        attackCooldowns.set(eid, now + cooldownTicks);
      }
    }
    return world;
  };
}
