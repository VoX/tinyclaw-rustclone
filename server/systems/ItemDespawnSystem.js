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
    return world;
  };
}
