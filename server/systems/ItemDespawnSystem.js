import { query, removeEntity } from 'bitecs';
import { WorldItem } from '../../shared/components.js';

export function createItemDespawnSystem(gameState) {
  return function ItemDespawnSystem(world) {
    const items = query(world, [WorldItem]);
    for (let i = 0; i < items.length; i++) {
      const eid = items[i];
      WorldItem.despawnTimer[eid]--;
      if (WorldItem.despawnTimer[eid] <= 0) {
        gameState.removedEntities.add(eid);
        gameState.entityTypes.delete(eid);
        removeEntity(world, eid);
      }
    }

    // Despawn loot bags
    if (gameState.lootBagTimers) {
      for (const [eid, timer] of gameState.lootBagTimers) {
        const newTimer = timer - 1;
        if (newTimer <= 0) {
          gameState.lootBagTimers.delete(eid);
          if (gameState.containerInv) gameState.containerInv.delete(eid);
          gameState.removedEntities.add(eid);
          gameState.entityTypes.delete(eid);
          removeEntity(world, eid);
        } else {
          gameState.lootBagTimers.set(eid, newTimer);
        }
      }
    }

    return world;
  };
}
