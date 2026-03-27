import { defineQuery } from 'bitecs';
import { ResourceNode, Position, Collider, Sprite } from '../../shared/components.js';
import { RESOURCE_NODE_DEFS } from '../../shared/constants.js';

const nodeQuery = defineQuery([ResourceNode, Position]);

export function createResourceRespawnSystem(gameState) {
  return function ResourceRespawnSystem(world) {
    const nodes = nodeQuery(world);
    for (let i = 0; i < nodes.length; i++) {
      const eid = nodes[i];
      if (ResourceNode.remaining[eid] > 0) continue;

      // Node is depleted, count down respawn timer
      ResourceNode.respawnTimer[eid]--;
      if (ResourceNode.respawnTimer[eid] <= 0) {
        const type = ResourceNode.resourceType[eid];
        const def = RESOURCE_NODE_DEFS[type];
        if (def) {
          ResourceNode.remaining[eid] = def.amount;
          ResourceNode.respawnTimer[eid] = 0;
          gameState.newEntities.add(eid); // Re-broadcast to clients
        }
      }
    }
    return world;
  };
}
