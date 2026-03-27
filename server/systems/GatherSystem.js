import { query, hasComponent } from 'bitecs';
import { Player, Position, Inventory, Hotbar, ResourceNode, Health, Dead } from '../../shared/components.js';
import { MOUSE_ACTION } from '../../shared/protocol.js';
import { ITEM_DEFS, RESOURCE_NODE_DEFS, GATHER_AMOUNTS, RESOURCE_TYPE,
         getGatherTier, canGather, SERVER_TPS } from '../../shared/constants.js';
import { addToInventory, reduceDurability } from '../../shared/inventory.js';

export function createGatherSystem(gameState) {
  const gatherCooldowns = new Map(); // eid -> tick

  return function GatherSystem(world) {
    const players = query(world, [Player, Position]);

    for (let i = 0; i < players.length; i++) {
      const eid = players[i];
      if (hasComponent(world, eid, Dead)) continue;

      const connId = Player.connectionId[eid];
      const client = gameState.clients.get(connId);
      if (!client || client.mouseAction !== MOUSE_ACTION.PRIMARY) continue;

      // Check cooldown
      const lastGather = gatherCooldowns.get(eid) || 0;
      if (gameState.tick < lastGather) continue;

      const slot = Hotbar.selectedSlot[eid];
      const itemId = Inventory.items[eid]?.[slot] || 0;
      const def = ITEM_DEFS[itemId];
      if (!def) continue;

      // Only tools and rock can gather
      if (def.cat !== 'tool') continue;

      const px = Position.x[eid];
      const py = Position.y[eid];

      // Find nearest resource node in range using spatial hash
      let bestNode = -1;
      let bestDist = Infinity;
      const nearby = gameState.spatialHash ? gameState.spatialHash.query(px, py, 3.5) : [];
      for (let j = 0; j < nearby.length; j++) {
        const nodeEid = nearby[j];
        if (!hasComponent(world, nodeEid, ResourceNode)) continue;
        if (ResourceNode.remaining[nodeEid] <= 0) continue;

        const resType = ResourceNode.resourceType[nodeEid];
        if (!canGather(itemId, resType)) continue;

        const dx = Position.x[nodeEid] - px;
        const dy = Position.y[nodeEid] - py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 3.5) continue;

        if (dist < bestDist) {
          bestDist = dist;
          bestNode = nodeEid;
        }
      }

      if (bestNode < 0) continue;

      const resType = ResourceNode.resourceType[bestNode];
      const gatherTier = getGatherTier(itemId);
      const amounts = GATHER_AMOUNTS[resType];
      const amount = amounts ? amounts[gatherTier] : 0;
      if (amount <= 0) continue;

      const resDef = RESOURCE_NODE_DEFS[resType];
      const actual = Math.min(amount, ResourceNode.remaining[bestNode]);
      ResourceNode.remaining[bestNode] -= actual;

      // If depleted, set respawn timer
      if (ResourceNode.remaining[bestNode] <= 0) {
        ResourceNode.respawnTimer[bestNode] = resDef.respawnTime;
      }

      // Add resource to inventory
      const resourceItemId = resDef.resource;
      addToInventory(eid, resourceItemId, actual);

      // Reduce tool durability
      reduceDurability(eid, slot);

      gameState.dirtyInventories.add(eid);

      // Set cooldown based on swing rate
      const swingRate = def.swingRate || 1.0;
      gatherCooldowns.set(eid, gameState.tick + Math.ceil(SERVER_TPS / swingRate));

      // Hit event
      gameState.events.push({
        type: 'hit',
        x: Position.x[bestNode],
        y: Position.y[bestNode],
        damage: actual,
      });
    }
    return world;
  };
}
