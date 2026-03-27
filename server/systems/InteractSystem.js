import { query, hasComponent } from 'bitecs';
import { Player, Position, Inventory, Dead, ToolCupboard, Campfire, Furnace,
         Workbench, Hotbar } from '../../shared/components.js';
import { StorageBox } from '../../shared/components.js';
import { MSG, ENTITY_TYPE } from '../../shared/protocol.js';
import { ITEM, ITEM_DEFS, INVENTORY_SLOTS, SERVER_TPS } from '../../shared/constants.js';
import { addToInventory } from '../../shared/inventory.js';

const CONTAINER_SLOTS = 12;

export function createInteractSystem(gameState) {
  // Track which player has which container open
  // playerEid -> { type, eid }
  const openContainers = new Map();

  return function InteractSystem(world) {
    // Process interact requests for non-door, non-world-item entities
    for (const [connId, client] of gameState.clients) {
      if (!client.interactRequest) continue;
      const { targetEid } = client.interactRequest;
      const eid = client.playerEid;
      if (!eid || hasComponent(world, eid, Dead)) continue;

      // Distance check
      if (!hasComponent(world, targetEid, Position)) continue;
      const dx = Position.x[targetEid] - Position.x[eid];
      const dy = Position.y[targetEid] - Position.y[eid];
      if (dx * dx + dy * dy > 4 * 4) continue;

      // Tool Cupboard interaction
      if (hasComponent(world, targetEid, ToolCupboard)) {
        client.interactRequest = null;
        const authSet = gameState.tcAuth.get(targetEid) || new Set();
        gameState.tcAuth.set(targetEid, authSet);

        // Build player name list from auth set
        const authList = [];
        for (const peid of authSet) {
          authList.push({ eid: peid, name: `Player ${Player.connectionId[peid] || peid}` });
        }

        const isAuthed = authSet.has(eid);
        try {
          client.ws.send(JSON.stringify({
            type: MSG.TC_AUTH_OPEN,
            tcEid: targetEid,
            authorized: isAuthed,
            authList,
          }));
        } catch (e) {}
        continue;
      }

      // Campfire interaction - open campfire container UI
      if (hasComponent(world, targetEid, Campfire)) {
        client.interactRequest = null;
        openContainers.set(eid, { type: 'campfire', eid: targetEid });
        sendCampfireState(client, targetEid);
        continue;
      }

      // Furnace interaction
      if (hasComponent(world, targetEid, Furnace)) {
        client.interactRequest = null;
        openContainers.set(eid, { type: 'furnace', eid: targetEid });
        sendFurnaceState(client, targetEid);
        continue;
      }

      // Workbench interaction - send workbench tier info
      if (hasComponent(world, targetEid, Workbench)) {
        client.interactRequest = null;
        const tier = Workbench.tier[targetEid];
        try {
          client.ws.send(JSON.stringify({
            type: MSG.CONTAINER_OPEN,
            containerType: 'workbench',
            containerEid: targetEid,
            tier,
          }));
        } catch (e) {}
        continue;
      }

      // Storage Box interaction
      if (hasComponent(world, targetEid, StorageBox)) {
        client.interactRequest = null;
        openContainers.set(eid, { type: 'storage', eid: targetEid });

        // Initialize storage if needed
        if (!gameState.containerInv) gameState.containerInv = new Map();
        if (!gameState.containerInv.has(targetEid)) {
          const slots = [];
          for (let i = 0; i < CONTAINER_SLOTS; i++) slots.push({ id: 0, n: 0 });
          gameState.containerInv.set(targetEid, slots);
        }

        sendStorageState(client, targetEid);
        continue;
      }
    }

    // Process container actions (transfer items between player inv and container)
    for (const [connId, client] of gameState.clients) {
      if (!client.containerAction) continue;
      const action = client.containerAction;
      client.containerAction = null;

      const eid = client.playerEid;
      if (!eid || hasComponent(world, eid, Dead)) continue;

      const open = openContainers.get(eid);
      if (!open) continue;

      if (open.type === 'campfire') {
        handleCampfireAction(eid, open.eid, action, client);
      } else if (open.type === 'furnace') {
        handleFurnaceAction(eid, open.eid, action, client);
      } else if (open.type === 'storage') {
        handleStorageAction(eid, open.eid, action, client);
      }
    }

    // Process TC auth actions
    for (const [connId, client] of gameState.clients) {
      if (!client.tcAuthAction) continue;
      const action = client.tcAuthAction;
      client.tcAuthAction = null;

      const eid = client.playerEid;
      if (!eid || hasComponent(world, eid, Dead)) continue;

      const tcEid = action.tcEid;
      if (!hasComponent(world, tcEid, ToolCupboard)) continue;

      // Distance check
      const dx = Position.x[tcEid] - Position.x[eid];
      const dy = Position.y[tcEid] - Position.y[eid];
      if (dx * dx + dy * dy > 4 * 4) continue;

      const authSet = gameState.tcAuth.get(tcEid) || new Set();

      if (action.action === 'authorize') {
        // Only allow self-auth if TC has no one authorized yet (first claim)
        // or if the player is already authorized (re-auth is a no-op)
        if (authSet.size === 0 || authSet.has(eid)) {
          authSet.add(eid);
          gameState.tcAuth.set(tcEid, authSet);
        }
      } else if (action.action === 'deauthorize') {
        if (authSet.has(eid)) {
          authSet.delete(eid);
        }
      } else if (action.action === 'clearall') {
        // Only authorized players can clear
        if (authSet.has(eid)) {
          authSet.clear();
        }
      }

      // Send updated auth list
      const authList = [];
      for (const peid of authSet) {
        authList.push({ eid: peid, name: `Player ${Player.connectionId[peid] || peid}` });
      }
      try {
        client.ws.send(JSON.stringify({
          type: MSG.TC_AUTH_UPDATE,
          tcEid,
          authorized: authSet.has(eid),
          authList,
        }));
      } catch (e) {}
    }

    return world;
  };

  function sendCampfireState(client, campfireEid) {
    try {
      client.ws.send(JSON.stringify({
        type: MSG.CONTAINER_OPEN,
        containerType: 'campfire',
        containerEid: campfireEid,
        fuel: Campfire.fuelRemaining[campfireEid],
        slots: [
          { id: Campfire.cookSlot0[campfireEid], progress: Campfire.cookProgress0[campfireEid] },
          { id: Campfire.cookSlot1[campfireEid], progress: Campfire.cookProgress1[campfireEid] },
        ],
      }));
    } catch (e) {}
  }

  function sendFurnaceState(client, furnaceEid) {
    try {
      client.ws.send(JSON.stringify({
        type: MSG.CONTAINER_OPEN,
        containerType: 'furnace',
        containerEid: furnaceEid,
        fuel: Furnace.fuelRemaining[furnaceEid],
        input: { id: Furnace.inputItem[furnaceEid], n: Furnace.inputCount[furnaceEid] },
        output: { id: Furnace.outputItem[furnaceEid], n: Furnace.outputCount[furnaceEid] },
        progress: Furnace.smeltProgress[furnaceEid],
      }));
    } catch (e) {}
  }

  function sendStorageState(client, storageEid) {
    if (!gameState.containerInv) return;
    const slots = gameState.containerInv.get(storageEid);
    if (!slots) return;
    try {
      client.ws.send(JSON.stringify({
        type: MSG.CONTAINER_OPEN,
        containerType: 'storage',
        containerEid: storageEid,
        slots,
      }));
    } catch (e) {}
  }

  function handleCampfireAction(playerEid, campfireEid, action, client) {
    if (action.action === 'add_fuel') {
      // Transfer wood from player to campfire fuel
      const woodSlot = findItem(playerEid, ITEM.WOOD);
      if (woodSlot >= 0) {
        const transfer = Math.min(Inventory.counts[playerEid][woodSlot], 10);
        Inventory.counts[playerEid][woodSlot] -= transfer;
        if (Inventory.counts[playerEid][woodSlot] === 0) Inventory.items[playerEid][woodSlot] = 0;
        Campfire.fuelRemaining[campfireEid] += transfer * 10 * SERVER_TPS; // 10s per wood
        gameState.dirtyInventories.add(playerEid);
      }
    } else if (action.action === 'add_food') {
      // Add raw meat to cook slot
      const meatSlot = findItem(playerEid, ITEM.RAW_MEAT);
      if (meatSlot >= 0) {
        if (Campfire.cookSlot0[campfireEid] === 0 || Campfire.cookSlot0[campfireEid] === ITEM.COOKED_MEAT) {
          if (Campfire.cookSlot0[campfireEid] === ITEM.COOKED_MEAT) {
            // Take cooked meat first
            addItemToInventory(playerEid, ITEM.COOKED_MEAT, 1);
          }
          Inventory.counts[playerEid][meatSlot]--;
          if (Inventory.counts[playerEid][meatSlot] === 0) Inventory.items[playerEid][meatSlot] = 0;
          Campfire.cookSlot0[campfireEid] = ITEM.RAW_MEAT;
          Campfire.cookProgress0[campfireEid] = 0;
          gameState.dirtyInventories.add(playerEid);
        } else if (Campfire.cookSlot1[campfireEid] === 0 || Campfire.cookSlot1[campfireEid] === ITEM.COOKED_MEAT) {
          if (Campfire.cookSlot1[campfireEid] === ITEM.COOKED_MEAT) {
            addItemToInventory(playerEid, ITEM.COOKED_MEAT, 1);
          }
          Inventory.counts[playerEid][meatSlot]--;
          if (Inventory.counts[playerEid][meatSlot] === 0) Inventory.items[playerEid][meatSlot] = 0;
          Campfire.cookSlot1[campfireEid] = ITEM.RAW_MEAT;
          Campfire.cookProgress1[campfireEid] = 0;
          gameState.dirtyInventories.add(playerEid);
        }
      }
    } else if (action.action === 'take') {
      // Take cooked food from campfire
      if (Campfire.cookSlot0[campfireEid] === ITEM.COOKED_MEAT) {
        addItemToInventory(playerEid, ITEM.COOKED_MEAT, 1);
        Campfire.cookSlot0[campfireEid] = 0;
        Campfire.cookProgress0[campfireEid] = 0;
        gameState.dirtyInventories.add(playerEid);
      }
      if (Campfire.cookSlot1[campfireEid] === ITEM.COOKED_MEAT) {
        addItemToInventory(playerEid, ITEM.COOKED_MEAT, 1);
        Campfire.cookSlot1[campfireEid] = 0;
        Campfire.cookProgress1[campfireEid] = 0;
        gameState.dirtyInventories.add(playerEid);
      }
    }
    sendCampfireState(client, campfireEid);
  }

  function handleFurnaceAction(playerEid, furnaceEid, action, client) {
    if (action.action === 'add_fuel') {
      const woodSlot = findItem(playerEid, ITEM.WOOD);
      if (woodSlot >= 0) {
        const transfer = Math.min(Inventory.counts[playerEid][woodSlot], 10);
        Inventory.counts[playerEid][woodSlot] -= transfer;
        if (Inventory.counts[playerEid][woodSlot] === 0) Inventory.items[playerEid][woodSlot] = 0;
        Furnace.fuelRemaining[furnaceEid] += transfer * 10 * SERVER_TPS;
        gameState.dirtyInventories.add(playerEid);
      }
    } else if (action.action === 'add_ore') {
      // Add ore to furnace input
      const oreId = action.itemId || 0;
      if (oreId !== ITEM.METAL_ORE && oreId !== ITEM.SULFUR_ORE) { sendFurnaceState(client, furnaceEid); return; }
      const oreSlot = findItem(playerEid, oreId);
      if (oreSlot >= 0) {
        const currentInput = Furnace.inputItem[furnaceEid];
        if (currentInput !== 0 && currentInput !== oreId) { sendFurnaceState(client, furnaceEid); return; }
        const transfer = Math.min(Inventory.counts[playerEid][oreSlot], 20);
        Inventory.counts[playerEid][oreSlot] -= transfer;
        if (Inventory.counts[playerEid][oreSlot] === 0) Inventory.items[playerEid][oreSlot] = 0;
        Furnace.inputItem[furnaceEid] = oreId;
        Furnace.inputCount[furnaceEid] += transfer;
        gameState.dirtyInventories.add(playerEid);
      }
    } else if (action.action === 'take_output') {
      const outItem = Furnace.outputItem[furnaceEid];
      const outCount = Furnace.outputCount[furnaceEid];
      if (outItem && outCount > 0) {
        addItemToInventory(playerEid, outItem, outCount);
        Furnace.outputItem[furnaceEid] = 0;
        Furnace.outputCount[furnaceEid] = 0;
        gameState.dirtyInventories.add(playerEid);
      }
    }
    sendFurnaceState(client, furnaceEid);
  }

  function handleStorageAction(playerEid, storageEid, action, client) {
    if (!gameState.containerInv) return;
    const slots = gameState.containerInv.get(storageEid);
    if (!slots) return;

    if (action.action === 'deposit') {
      const fromSlot = action.fromSlot;
      if (fromSlot < 0 || fromSlot >= INVENTORY_SLOTS) return;
      const itemId = Inventory.items[playerEid][fromSlot];
      const count = Inventory.counts[playerEid][fromSlot];
      if (!itemId || count <= 0) return;

      const maxStack = ITEM_DEFS[itemId]?.maxStack || 1;
      let remaining = count;

      // Stack with existing
      for (let s = 0; s < CONTAINER_SLOTS && remaining > 0; s++) {
        if (slots[s].id === itemId) {
          const canAdd = maxStack - slots[s].n;
          const add = Math.min(canAdd, remaining);
          slots[s].n += add;
          remaining -= add;
        }
      }
      // Empty slot
      for (let s = 0; s < CONTAINER_SLOTS && remaining > 0; s++) {
        if (slots[s].id === 0) {
          slots[s].id = itemId;
          const add = Math.min(remaining, maxStack);
          slots[s].n = add;
          remaining -= add;
        }
      }

      const deposited = count - remaining;
      Inventory.counts[playerEid][fromSlot] -= deposited;
      if (Inventory.counts[playerEid][fromSlot] === 0) Inventory.items[playerEid][fromSlot] = 0;
      gameState.dirtyInventories.add(playerEid);
    } else if (action.action === 'withdraw') {
      const fromSlot = action.fromSlot;
      if (fromSlot < 0 || fromSlot >= CONTAINER_SLOTS) return;
      const itemId = slots[fromSlot].id;
      const count = slots[fromSlot].n;
      if (!itemId || count <= 0) return;

      const added = addItemToInventory(playerEid, itemId, count);
      slots[fromSlot].n -= added;
      if (slots[fromSlot].n <= 0) { slots[fromSlot].id = 0; slots[fromSlot].n = 0; }
      gameState.dirtyInventories.add(playerEid);
    }

    sendStorageState(client, storageEid);
  }

  function findItem(playerEid, itemId) {
    for (let s = 0; s < INVENTORY_SLOTS; s++) {
      if (Inventory.items[playerEid][s] === itemId && Inventory.counts[playerEid][s] > 0) return s;
    }
    return -1;
  }

  function addItemToInventory(playerEid, itemId, count) {
    return addToInventory(playerEid, itemId, count);
  }
}
