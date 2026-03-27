import { query, hasComponent, addComponent, addEntity, removeEntity } from 'bitecs';
import { Health, Dead, Sleeper, Player, Position, Inventory, WorldItem, Collider, Sprite, NetworkSync,
         Animal, ResourceNode, SleepingBag, Damageable, initInventory, Armor, StorageBox, NPC, Recycler, ResearchTable, HeliCrate } from '../../shared/components.js';
import { ITEM_DESPAWN_TICKS, SERVER_TPS, PLAYER_MAX_HP, RESPAWN_WAIT_TICKS, ANIMAL_DEFS } from '../../shared/constants.js';
import { ENTITY_TYPE, MSG } from '../../shared/protocol.js';

export function createDamageSystem(gameState) {
  return function DamageSystem(world) {
    const entities = query(world, [Health, Position]);
    for (let i = 0; i < entities.length; i++) {
      const eid = entities[i];
      if (hasComponent(world, eid, Dead)) continue;
      if (Health.current[eid] > 0) continue;

      // Skip animals — AnimalAISystem handles their death and loot drops
      if (hasComponent(world, eid, Animal)) continue;
      // Skip NPCs, recyclers, research tables — they are invulnerable
      if (hasComponent(world, eid, NPC)) { Health.current[eid] = Health.max[eid]; continue; }
      if (hasComponent(world, eid, Recycler)) { Health.current[eid] = Health.max[eid]; continue; }
      if (hasComponent(world, eid, ResearchTable)) { Health.current[eid] = Health.max[eid]; continue; }
      if (hasComponent(world, eid, HeliCrate)) { Health.current[eid] = Health.max[eid]; continue; }
      // Skip resource nodes — they use ResourceNode.remaining, not Health
      if (hasComponent(world, eid, ResourceNode)) {
        Health.current[eid] = 1; // Prevent re-processing; nodes don't die via HP
        continue;
      }

      // Entity died
      Health.current[eid] = 0;

      if (hasComponent(world, eid, Player)) {
        // Player death: drop inventory, mark dead
        addComponent(world, eid, Dead);
        Dead.timer[eid] = RESPAWN_WAIT_TICKS;

        // Create a loot bag with all inventory items
        const px = Position.x[eid];
        const py = Position.y[eid];

        // Collect items for loot bag
        const lootItems = [];
        for (let s = 0; s < 24; s++) {
          const itemId = Inventory.items[eid][s];
          const count = Inventory.counts[eid][s];
          if (itemId !== 0 && count > 0) {
            lootItems.push({ id: itemId, n: count });
          }
          Inventory.items[eid][s] = 0;
          Inventory.counts[eid][s] = 0;
        }
        // Also drop equipped armor into the loot bag
        if (hasComponent(world, eid, Armor)) {
          if (Armor.headSlot[eid]) { lootItems.push({ id: Armor.headSlot[eid], n: 1 }); Armor.headSlot[eid] = 0; }
          if (Armor.chestSlot[eid]) { lootItems.push({ id: Armor.chestSlot[eid], n: 1 }); Armor.chestSlot[eid] = 0; }
          if (Armor.legsSlot[eid]) { lootItems.push({ id: Armor.legsSlot[eid], n: 1 }); Armor.legsSlot[eid] = 0; }
        }

        if (lootItems.length > 0) {
          const bagEid = addEntity(world);
          addComponent(world, bagEid, Position);
          addComponent(world, bagEid, Collider);
          addComponent(world, bagEid, Sprite);
          addComponent(world, bagEid, NetworkSync);
          addComponent(world, bagEid, StorageBox); // reuse storage box for interaction
          addComponent(world, bagEid, Health);

          Position.x[bagEid] = px;
          Position.y[bagEid] = py;
          Collider.radius[bagEid] = 0.4;
          Sprite.spriteId[bagEid] = 230; // loot bag sprite
          NetworkSync.lastTick[bagEid] = gameState.tick;
          Health.current[bagEid] = 1000;
          Health.max[bagEid] = 1000;

          // Store loot in container inventory
          if (!gameState.containerInv) gameState.containerInv = new Map();
          // Pad to 12 slots
          while (lootItems.length < 12) lootItems.push({ id: 0, n: 0 });
          gameState.containerInv.set(bagEid, lootItems.slice(0, 12));

          // Track for despawn (5 minutes)
          if (!gameState.lootBagTimers) gameState.lootBagTimers = new Map();
          gameState.lootBagTimers.set(bagEid, ITEM_DESPAWN_TICKS);

          gameState.entityTypes.set(bagEid, ENTITY_TYPE.LOOT_BAG);
          gameState.newEntities.add(bagEid);
        }

        gameState.dirtyInventories.add(eid);

        // Find available sleeping bags for this player
        const bags = [];
        const allBags = query(world, [SleepingBag, Position]);
        for (let b = 0; b < allBags.length; b++) {
          const bagEid = allBags[b];
          if (SleepingBag.ownerPlayerId[bagEid] === eid && SleepingBag.cooldown[bagEid] <= 0) {
            const isBed = gameState.entityTypes.get(bagEid) === 16; // ENTITY_TYPE.BED
            bags.push({
              eid: bagEid,
              x: Math.round(Position.x[bagEid]),
              y: Math.round(Position.y[bagEid]),
              isBed,
            });
          }
        }

        // Notify client of death with spawn options
        const connId = Player.connectionId[eid];
        const client = gameState.clients.get(connId);

        // Determine killer info
        let killerName = 'the environment';
        let killerType = 'environment';
        const killerEid = hasComponent(world, eid, Damageable) ? Damageable.lastHitBy[eid] : 0;
        if (killerEid && killerEid !== eid) {
          const killerEntityType = gameState.entityTypes.get(killerEid);
          if (killerEntityType === ENTITY_TYPE.PLAYER) {
            killerName = gameState.playerNames?.get(killerEid) || `Player ${Player.connectionId[killerEid] || killerEid}`;
            killerType = 'player';
            // Track kill stat
            const stats = gameState.playerStats?.get(killerEid);
            if (stats) stats.kills++;
          } else if (killerEntityType === ENTITY_TYPE.ANIMAL && hasComponent(world, killerEid, Animal)) {
            const at = Animal.animalType[killerEid];
            const animalNames = { 1: 'Deer', 2: 'Boar', 3: 'Wolf', 4: 'Bear' };
            killerName = animalNames[at] || 'Animal';
            killerType = 'animal';
          }
        }

        // Calculate survival time
        const spawnTick = client?.spawnTick || 0;
        const survivedTicks = gameState.tick - spawnTick;
        const survivedSeconds = Math.floor(survivedTicks / SERVER_TPS);
        // Get resources gathered this life
        const playerStats = gameState.playerStats?.get(eid);
        const resourcesGathered = playerStats?.resources || 0;

        if (client && client.ws) {
          client.ws.send(JSON.stringify({
            type: MSG.DEATH,
            bags,
            killerName,
            killerType,
            survived: survivedSeconds,
            resourcesGathered,
            respawnTime: Math.ceil(RESPAWN_WAIT_TICKS / SERVER_TPS),
          }));
        }

        // Reset resources for next life
        if (playerStats) playerStats.resources = 0;

        // Broadcast death event (for kill feed)
        const victimName = gameState.playerNames?.get(eid) || `Player ${connId}`;
        gameState.events.push({
          type: 'death',
          eid,
          x: px,
          y: py,
          victimName,
          killerName,
          killerType,
        });

        // If this was a sleeper (offline player), remove the entity entirely
        if (hasComponent(world, eid, Sleeper)) {
          // Clean up sleeper tracking
          const uuid = gameState.eidToUuid?.get(eid);
          if (uuid) {
            gameState.sleepersByUuid?.delete(uuid);
            gameState.eidToUuid?.delete(eid);
            gameState.uuidToEid?.delete(uuid);
            // Mark as dead so reconnect gets fresh spawn
            const pdata = gameState.playersByUuid?.get(uuid);
            if (pdata) pdata.alive = false;
          }
          gameState.removedEntities.add(eid);
          gameState.entityTypes.delete(eid);
          gameState.playerNames.delete(eid);
          gameState.playerStats.delete(eid);
          removeEntity(world, eid);
        }
      } else {
        // Non-player entity died: remove it
        const deathX = Position.x[eid];
        const deathY = Position.y[eid];

        // Barrel loot drops
        if (gameState.barrelLoot && gameState.barrelLoot.has(eid)) {
          const loot = gameState.barrelLoot.get(eid);
          for (const [itemId, count] of loot) {
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
          gameState.barrelLoot.delete(eid);

          // Visual break event
          gameState.events.push({ type: 'hit', x: deathX, y: deathY });
        }

        gameState.removedEntities.add(eid);
        gameState.entityTypes.delete(eid);
        // Clean up associated data (storage box inventory, TC auth, door auth)
        if (gameState.containerInv) gameState.containerInv.delete(eid);
        if (gameState.tcAuth) gameState.tcAuth.delete(eid);
        if (gameState.doorAuth) gameState.doorAuth.delete(eid);
        removeEntity(world, eid);
      }
    }
    return world;
  };
}
