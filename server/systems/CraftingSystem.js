import { query, hasComponent } from 'bitecs';
import { Player, Inventory, Position, Workbench, Dead } from '../../shared/components.js';
import { RECIPES, ITEM_DEFS, INVENTORY_SLOTS, CRAFT_TIER, SERVER_TPS, getCraftTime } from '../../shared/constants.js';
import { addToInventory } from '../../shared/inventory.js';
import { MSG } from '../../shared/protocol.js';

export function createCraftingSystem(gameState) {
  // Per-player craft queue: connId -> { recipeId, ticksLeft, totalTicks }
  if (!gameState.craftQueue) gameState.craftQueue = new Map();

  return function CraftingSystem(world) {
    // Process new craft requests — queue them
    for (const [connId, client] of gameState.clients) {
      if (!client.craftRequest) continue;
      const recipeId = client.craftRequest;
      client.craftRequest = null;

      const eid = client.playerEid;
      if (!eid || hasComponent(world, eid, Dead)) continue;

      // Don't allow queueing if already crafting
      if (gameState.craftQueue.has(connId)) continue;

      const recipe = RECIPES.find(r => r.id === recipeId);
      if (!recipe) continue;

      // Check workbench tier requirement
      if (recipe.tier > CRAFT_TIER.HAND) {
        const requiredTier = recipe.tier;
        const px = Position.x[eid];
        const py = Position.y[eid];
        const benches = query(world, [Workbench, Position]);
        let hasWorkbench = false;
        for (let i = 0; i < benches.length; i++) {
          const bench = benches[i];
          const dx = Position.x[bench] - px;
          const dy = Position.y[bench] - py;
          if (dx * dx + dy * dy < 5 * 5 && Workbench.tier[bench] >= requiredTier) {
            hasWorkbench = true;
            break;
          }
        }
        if (!hasWorkbench) continue;
      }

      // Check if player has all ingredients
      const inv = { items: Inventory.items[eid], counts: Inventory.counts[eid] };
      let hasAll = true;
      for (const [itemId, count] of recipe.ing) {
        let total = 0;
        for (let s = 0; s < INVENTORY_SLOTS; s++) {
          if (inv.items[s] === itemId) total += inv.counts[s];
        }
        if (total < count) { hasAll = false; break; }
      }
      if (!hasAll) continue;

      // Check space for result
      const resultDef = ITEM_DEFS[recipe.result];
      const maxStack = resultDef?.maxStack || 1;
      let spaceAvailable = false;
      for (let s = 0; s < INVENTORY_SLOTS; s++) {
        if (inv.items[s] === 0) { spaceAvailable = true; break; }
        if (inv.items[s] === recipe.result && inv.counts[s] + recipe.count <= maxStack) {
          spaceAvailable = true; break;
        }
      }
      if (!spaceAvailable) continue;

      // Consume ingredients immediately
      for (const [itemId, count] of recipe.ing) {
        let remaining = count;
        for (let s = 0; s < INVENTORY_SLOTS && remaining > 0; s++) {
          if (inv.items[s] === itemId) {
            const take = Math.min(inv.counts[s], remaining);
            inv.counts[s] -= take;
            remaining -= take;
            if (inv.counts[s] === 0) inv.items[s] = 0;
          }
        }
      }
      gameState.dirtyInventories.add(eid);

      // Queue the craft
      const craftTicks = Math.ceil(getCraftTime(recipe) * SERVER_TPS);
      gameState.craftQueue.set(connId, {
        recipeId,
        ticksLeft: craftTicks,
        totalTicks: craftTicks,
      });

      // Send progress start
      if (client.ws) {
        try {
          client.ws.send(JSON.stringify({
            type: MSG.CRAFT_PROGRESS,
            recipeId,
            progress: 0,
            totalTime: getCraftTime(recipe),
          }));
        } catch (e) {}
      }
    }

    // Process cancel requests
    for (const [connId, client] of gameState.clients) {
      if (!client.craftCancel) continue;
      client.craftCancel = false;

      const craft = gameState.craftQueue.get(connId);
      if (!craft) continue;

      // Refund ingredients
      const recipe = RECIPES.find(r => r.id === craft.recipeId);
      if (recipe) {
        const eid = client.playerEid;
        for (const [itemId, count] of recipe.ing) {
          addToInventory(eid, itemId, count);
        }
        gameState.dirtyInventories.add(eid);
      }

      gameState.craftQueue.delete(connId);

      // Notify cancel
      if (client.ws) {
        try { client.ws.send(JSON.stringify({ type: MSG.CRAFT_PROGRESS, recipeId: 0, progress: -1, totalTime: 0 })); } catch (e) {}
      }
    }

    // Tick active crafts
    for (const [connId, craft] of gameState.craftQueue) {
      const client = gameState.clients.get(connId);
      if (!client) { gameState.craftQueue.delete(connId); continue; }

      craft.ticksLeft--;

      if (craft.ticksLeft <= 0) {
        // Craft complete — give result
        const recipe = RECIPES.find(r => r.id === craft.recipeId);
        if (recipe) {
          addToInventory(client.playerEid, recipe.result, recipe.count);
          gameState.dirtyInventories.add(client.playerEid);
        }
        gameState.craftQueue.delete(connId);

        // Send completion
        if (client.ws) {
          try { client.ws.send(JSON.stringify({ type: MSG.CRAFT_PROGRESS, recipeId: 0, progress: 1, totalTime: 0 })); } catch (e) {}
        }
      } else if (craft.ticksLeft % 5 === 0) {
        // Send progress update every 5 ticks
        const progress = 1 - craft.ticksLeft / craft.totalTicks;
        if (client.ws) {
          try {
            client.ws.send(JSON.stringify({
              type: MSG.CRAFT_PROGRESS,
              recipeId: craft.recipeId,
              progress,
              totalTime: craft.totalTicks / SERVER_TPS,
            }));
          } catch (e) {}
        }
      }
    }

    return world;
  };
}
