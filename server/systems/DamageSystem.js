import { query, hasComponent, addComponent, addEntity, removeEntity } from 'bitecs';
import { Health, Dead, Player, Position, Inventory, WorldItem, Collider, Sprite, NetworkSync,
         Animal, ResourceNode, SleepingBag, Damageable, initInventory } from '../../shared/components.js';
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

        // Drop all inventory items
        const px = Position.x[eid];
        const py = Position.y[eid];
        for (let s = 0; s < 24; s++) {
          const itemId = Inventory.items[eid][s];
          const count = Inventory.counts[eid][s];
          if (itemId === 0 || count === 0) continue;

          const dropEid = addEntity(world);
          addComponent(world, dropEid, Position);
          addComponent(world, dropEid, WorldItem);
          addComponent(world, dropEid, Collider);
          addComponent(world, dropEid, Sprite);
          addComponent(world, dropEid, NetworkSync);

          Position.x[dropEid] = px + (Math.random() - 0.5) * 2;
          Position.y[dropEid] = py + (Math.random() - 0.5) * 2;
          WorldItem.itemId[dropEid] = itemId;
          WorldItem.quantity[dropEid] = count;
          WorldItem.despawnTimer[dropEid] = ITEM_DESPAWN_TICKS;
          Collider.radius[dropEid] = 0.3;
          Sprite.spriteId[dropEid] = itemId;
          NetworkSync.lastTick[dropEid] = gameState.tick;

          gameState.entityTypes.set(dropEid, ENTITY_TYPE.WORLD_ITEM);
          gameState.newEntities.add(dropEid);

          Inventory.items[eid][s] = 0;
          Inventory.counts[eid][s] = 0;
        }

        gameState.dirtyInventories.add(eid);

        // Find available sleeping bags for this player
        const bags = [];
        const allBags = query(world, [SleepingBag, Position]);
        for (let b = 0; b < allBags.length; b++) {
          const bagEid = allBags[b];
          if (SleepingBag.ownerPlayerId[bagEid] === eid && SleepingBag.cooldown[bagEid] <= 0) {
            bags.push({
              eid: bagEid,
              x: Math.round(Position.x[bagEid]),
              y: Math.round(Position.y[bagEid]),
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
            killerName = `Player ${Player.connectionId[killerEid] || killerEid}`;
            killerType = 'player';
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
        if (client && client.ws) {
          client.ws.send(JSON.stringify({
            type: MSG.DEATH,
            bags,
            killerName,
            killerType,
            survived: survivedSeconds,
          }));
        }

        // Broadcast death event (for kill feed)
        const victimName = `Player ${connId}`;
        gameState.events.push({
          type: 'death',
          eid,
          x: px,
          y: py,
          victimName,
          killerName,
          killerType,
        });
      } else {
        // Non-player entity died: remove it
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
