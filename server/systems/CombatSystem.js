import { query, hasComponent, addEntity, addComponent } from 'bitecs';
import { Player, Position, Rotation, Health, ActiveTool, Inventory, Hotbar, Dead,
         Projectile, Velocity, Collider, NetworkSync, Sprite, Damageable, ResourceNode, Armor, Animal } from '../../shared/components.js';
import { MOUSE_ACTION, MSG } from '../../shared/protocol.js';
import { ITEM_DEFS, SERVER_TPS, getArmorReduction } from '../../shared/constants.js';
import { reduceDurability } from '../../shared/inventory.js';
import { ENTITY_TYPE } from '../../shared/protocol.js';
import { areTeammates } from './TeamSystem.js';

export function createCombatSystem(gameState) {
  const attackCooldowns = new Map(); // eid -> ticks remaining
  // Clip state: eid -> { itemId, ammo }  (tracks loaded rounds per player)
  if (!gameState.clipState) gameState.clipState = new Map();

  return function CombatSystem(world) {
    const players = query(world, [Player, Position, Health]);
    const now = gameState.tick;

    // Process reload requests
    for (const [connId, client] of gameState.clients) {
      if (!client.reloadRequest) continue;
      client.reloadRequest = false;

      const eid = client.playerEid;
      if (!eid || hasComponent(world, eid, Dead)) continue;

      const slot = Hotbar.selectedSlot[eid];
      const itemId = Inventory.items[eid]?.[slot] || 0;
      const def = ITEM_DEFS[itemId];
      if (!def || def.cat !== 'ranged') continue;

      const clipSize = def.clipSize || 1;
      let clip = gameState.clipState.get(eid);
      if (clip && clip.itemId !== itemId) clip = null;
      if (!clip) clip = { itemId, ammo: 0 };

      const needed = clipSize - clip.ammo;
      if (needed <= 0) continue; // already full

      // Find ammo in inventory
      let totalLoaded = 0;
      for (let s = 0; s < 24 && totalLoaded < needed; s++) {
        if (Inventory.items[eid][s] === def.ammoType && Inventory.counts[eid][s] > 0) {
          const take = Math.min(Inventory.counts[eid][s], needed - totalLoaded);
          Inventory.counts[eid][s] -= take;
          if (Inventory.counts[eid][s] === 0) Inventory.items[eid][s] = 0;
          totalLoaded += take;
        }
      }

      if (totalLoaded > 0) {
        clip.ammo += totalLoaded;
        clip.itemId = itemId;
        gameState.clipState.set(eid, clip);
        gameState.dirtyInventories.add(eid);

        // Send clip update
        if (client.ws) {
          try { client.ws.send(JSON.stringify({ type: MSG.CLIP_UPDATE, ammo: clip.ammo, max: clipSize })); } catch (e) {}
        }
      }
    }

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
        // Clip-based ammo system
        const clipSize = def.clipSize || 1;
        let clip = gameState.clipState.get(eid);
        // Reset clip if weapon changed
        if (clip && clip.itemId !== itemId) clip = null;
        if (!clip) clip = { itemId, ammo: 0 };

        // Check clip has ammo
        if (clip.ammo <= 0) continue; // need to reload

        // Consume one round from clip
        clip.ammo--;
        gameState.clipState.set(eid, clip);

        // Send clip update to client
        const clipConnId = Player.connectionId[eid];
        const clipClient = gameState.clients.get(clipConnId);
        if (clipClient && clipClient.ws) {
          try { clipClient.ws.send(JSON.stringify({ type: MSG.CLIP_UPDATE, ammo: clip.ammo, max: clipSize })); } catch (e) {}
        }

        // Spawn projectile
        const projEid = addEntity(world);
        addComponent(world, projEid, Position);
        addComponent(world, projEid, Velocity);
        addComponent(world, projEid, Projectile);
        addComponent(world, projEid, Collider);
        addComponent(world, projEid, NetworkSync);
        addComponent(world, projEid, Sprite);

        // Apply spread (reduced when ADS)
        const isAds = client && client.ads;
        const spreadAngle = isAds ? (def.adsSpread || 0.02) : (def.spread || 0.08);
        const finalAngle = angle + (Math.random() - 0.5) * 2 * spreadAngle;

        const isArrow = def.ammoType === 40; // ITEM.WOODEN_ARROW = 40
        const projSpeed = isArrow ? 14 : 30; // arrows slower, bullets faster
        Position.x[projEid] = px + Math.cos(finalAngle) * 0.8;
        Position.y[projEid] = py + Math.sin(finalAngle) * 0.8;
        Velocity.vx[projEid] = Math.cos(finalAngle) * projSpeed;
        Velocity.vy[projEid] = Math.sin(finalAngle) * projSpeed;
        Projectile.damage[projEid] = def.damage;
        Projectile.speed[projEid] = projSpeed;
        Projectile.sourceEid[projEid] = eid;
        Projectile.lifetime[projEid] = def.range / projSpeed * SERVER_TPS;
        Collider.radius[projEid] = 0.15;
        Sprite.spriteId[projEid] = isArrow ? 101 : 100; // 100=bullet, 101=arrow
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

        // Find targets in range+arc using spatial hash
        const meleeTargets = gameState.spatialHash ? gameState.spatialHash.query(px, py, range) : [];
        for (let k = 0; k < meleeTargets.length; k++) {
          const targetEid = meleeTargets[k];
          if (!hasComponent(world, targetEid, Health)) continue;
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

          // Skip damage if target has spawn protection (player-vs-player only)
          if (hasComponent(world, targetEid, Player)) {
            const targetConnId = Player.connectionId[targetEid];
            const targetClient = gameState.clients.get(targetConnId);
            if (targetClient && gameState.tick < targetClient.spawnProtectionUntil) continue;
            // No friendly fire
            if (areTeammates(gameState, eid, targetEid)) continue;
          }

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

          // Knockback: push target away from attacker
          if (dist > 0 && hasComponent(world, targetEid, Velocity)) {
            const knockStr = 3.0; // tiles/sec impulse
            Velocity.vx[targetEid] += (dx / dist) * knockStr;
            Velocity.vy[targetEid] += (dy / dist) * knockStr;
          }

          // Send hit event
          gameState.events.push({
            type: 'hit',
            x: Position.x[targetEid],
            y: Position.y[targetEid],
            damage: def.damage,
          });

          // Reduce weapon durability
          reduceDurability(eid, slot);
          gameState.dirtyInventories.add(eid);

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
