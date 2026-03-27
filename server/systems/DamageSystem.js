import { defineQuery, hasComponent, addComponent, addEntity, removeEntity } from 'bitecs';
import { Health, Dead, Player, Position, Inventory, WorldItem, Collider, Sprite, NetworkSync,
         Animal, ResourceNode } from '../../shared/components.js';
import { ITEM_DESPAWN_TICKS, SERVER_TPS, PLAYER_MAX_HP, RESPAWN_WAIT_TICKS } from '../../shared/constants.js';
import { ENTITY_TYPE, MSG } from '../../shared/protocol.js';

const healthQuery = defineQuery([Health, Position]);

export function createDamageSystem(gameState) {
  return function DamageSystem(world) {
    const entities = healthQuery(world);
    for (let i = 0; i < entities.length; i++) {
      const eid = entities[i];
      if (hasComponent(world, Dead, eid)) continue;
      if (Health.current[eid] > 0) continue;

      // Skip animals — AnimalAISystem handles their death and loot drops
      if (hasComponent(world, Animal, eid)) continue;
      // Skip resource nodes — they use ResourceNode.remaining, not Health
      if (hasComponent(world, ResourceNode, eid)) {
        Health.current[eid] = 1; // Prevent re-processing; nodes don't die via HP
        continue;
      }

      // Entity died
      Health.current[eid] = 0;

      if (hasComponent(world, Player, eid)) {
        // Player death: drop inventory, mark dead
        addComponent(world, Dead, eid);
        Dead.timer[eid] = RESPAWN_WAIT_TICKS;

        // Drop all inventory items
        const px = Position.x[eid];
        const py = Position.y[eid];
        for (let s = 0; s < 24; s++) {
          const itemId = Inventory.items[eid][s];
          const count = Inventory.counts[eid][s];
          if (itemId === 0 || count === 0) continue;

          const dropEid = addEntity(world);
          addComponent(world, Position, dropEid);
          addComponent(world, WorldItem, dropEid);
          addComponent(world, Collider, dropEid);
          addComponent(world, Sprite, dropEid);
          addComponent(world, NetworkSync, dropEid);

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

        // Notify client of death
        const connId = Player.connectionId[eid];
        const client = gameState.clients.get(connId);
        if (client && client.ws) {
          client.ws.send(JSON.stringify({ type: MSG.DEATH }));
        }

        // Broadcast death event
        gameState.events.push({
          type: 'death',
          eid,
          x: px,
          y: py,
        });
      } else {
        // Non-player entity died: remove it
        gameState.removedEntities.add(eid);
        gameState.entityTypes.delete(eid);
        removeEntity(world, eid);
      }
    }
    return world;
  };
}
