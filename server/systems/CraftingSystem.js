import { query, hasComponent } from 'bitecs';
import { Player, Inventory, Position, Workbench, Dead } from '../../shared/components.js';
import { RECIPES, ITEM_DEFS, INVENTORY_SLOTS, CRAFT_TIER } from '../../shared/constants.js';
import { addToInventory } from '../../shared/inventory.js';

export function createCraftingSystem(gameState) {
  return function CraftingSystem(world) {
    // Process craft requests from clients
    for (const [connId, client] of gameState.clients) {
      if (!client.craftRequest) continue;
      const recipeId = client.craftRequest;
      client.craftRequest = null;

      const eid = client.playerEid;
      if (!eid || hasComponent(world, eid, Dead)) continue;

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

      // Check if there's space for the result
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

      // Consume ingredients
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

      // Add result (addToInventory handles durability for tools)
      addToInventory(eid, recipe.result, recipe.count);

      gameState.dirtyInventories.add(eid);
    }
    return world;
  };
}
