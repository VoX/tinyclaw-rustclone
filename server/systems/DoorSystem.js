import { defineQuery, hasComponent } from 'bitecs';
import { Door, Position, Collider, Player, Dead } from '../../shared/components.js';

const doorQuery = defineQuery([Door, Position, Collider]);

export function createDoorSystem(gameState) {
  return function DoorSystem(world) {
    // Process interact requests for doors
    for (const [connId, client] of gameState.clients) {
      if (!client.interactRequest) continue;
      const { targetEid } = client.interactRequest;

      const eid = client.playerEid;
      if (!eid || hasComponent(world, Dead, eid)) continue;
      if (!hasComponent(world, Door, targetEid)) continue;

      // Only consume the interact request if it's actually a door
      client.interactRequest = null;

      // Check distance
      const dx = Position.x[targetEid] - Position.x[eid];
      const dy = Position.y[targetEid] - Position.y[eid];
      if (dx * dx + dy * dy > 3 * 3) continue;

      // Check lock
      const lockType = Door.lockType[targetEid];
      if (lockType > 0) {
        const authList = gameState.doorAuth.get(targetEid);
        if (authList && !authList.has(eid)) continue;
      }

      // Toggle door
      Door.isOpen[targetEid] = Door.isOpen[targetEid] ? 0 : 1;
      Collider.isStatic[targetEid] = Door.isOpen[targetEid] ? 0 : 1;
    }
    return world;
  };
}
