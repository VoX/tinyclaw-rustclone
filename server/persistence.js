import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { query, addEntity, addComponent, hasComponent } from 'bitecs';
import { Position, Structure, Door, ToolCupboard, SleepingBag,
         Campfire, Furnace, Workbench, Health, ResourceNode, Collider,
         Sprite, NetworkSync, StorageBox, Player, Inventory, Hotbar,
         Hunger, Thirst, Temperature, Velocity, Rotation, ActiveTool,
         Damageable, Armor, Sleeper, initInventory } from '../shared/components.js';
import { STRUCT_TYPE, STRUCT_HP, RESOURCE_NODE_DEFS, PLAYER_MAX_HP,
         PLAYER_MAX_HUNGER, PLAYER_MAX_THIRST, PLAYER_COLLIDER_RADIUS,
         ITEM, WORLD_SIZE, TILE_SIZE } from '../shared/constants.js';
import { ENTITY_TYPE } from '../shared/protocol.js';

// Save to /app/data/ in Docker, fallback to ./data/ for local dev
const DATA_DIR = existsSync('/app/data') ? '/app/data' : './data';
const SAVE_FILE = `${DATA_DIR}/world-state.json`;

// Ensure data directory exists
try { mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}

export function saveWorld(world, gameState) {
  const data = {
    tick: gameState.tick,
    worldTime: gameState.worldTime,
    structures: [],
    campfires: [],
    furnaces: [],
    workbenches: [],
    toolCupboards: [],
    sleepingBags: [],
    storageBoxes: [],
    lootBags: [],
    tcAuth: {},
    doorAuth: {},
    containerInv: {},
    resourceDepletion: [],
    players: {},  // UUID -> player data
    sleepers: [],  // offline player bodies in the world
    learnedRecipes: {},  // UUID -> [recipeId, ...]
  };

  // ── Save player data keyed by UUID ──
  if (gameState.playersByUuid) {
    // Save currently connected players' live state
    for (const [connId, client] of gameState.clients) {
      if (!client.uuid) continue;
      const eid = client.playerEid;
      if (!hasComponent(world, eid, Position)) continue;

      const invItems = [];
      const invCounts = [];
      const invDurability = [];
      if (Inventory.items[eid]) {
        for (let i = 0; i < 24; i++) {
          invItems.push(Inventory.items[eid][i] || 0);
          invCounts.push(Inventory.counts[eid][i] || 0);
          invDurability.push(Inventory.durability[eid]?.[i] || 0);
        }
      }

      gameState.playersByUuid.set(client.uuid, {
        x: Position.x[eid],
        y: Position.y[eid],
        hp: Health.current[eid],
        maxHp: Health.max[eid],
        hunger: Hunger.current[eid],
        thirst: Thirst.current[eid],
        invItems,
        invCounts,
        invDurability,
        selectedSlot: Hotbar.selectedSlot[eid],
        armor: {
          head: Armor.headSlot[eid] || 0,
          chest: Armor.chestSlot[eid] || 0,
          legs: Armor.legsSlot[eid] || 0,
        },
        name: client.playerName,
        alive: true,
      });
    }

    // Write all known players (connected and disconnected)
    for (const [uuid, pdata] of gameState.playersByUuid) {
      data.players[uuid] = pdata;
    }
  }

  // Save structures
  const structures = query(world, [Structure, Position]);
  for (let i = 0; i < structures.length; i++) {
    const eid = structures[i];
    const entry = {
      x: Position.x[eid],
      y: Position.y[eid],
      type: Structure.structureType[eid],
      tier: Structure.tier[eid],
      hp: Structure.hp[eid],
      maxHp: Structure.maxHp[eid],
      placedBy: Structure.placedBy[eid],
      rotation: Structure.rotation[eid] || 0,
      boxHalfW: Structure.boxHalfW[eid] || 0,
      boxHalfH: Structure.boxHalfH[eid] || 0,
    };
    // Check if it's a door
    if (hasComponent(world, eid, Door)) {
      entry.isDoor = true;
      entry.isOpen = Door.isOpen[eid];
      entry.lockType = Door.lockType[eid];
      entry.lockCode = Door.lockCode[eid];
    }
    data.structures.push(entry);
  }

  // Save campfires
  const campfires = query(world, [Campfire, Position]);
  for (let i = 0; i < campfires.length; i++) {
    const eid = campfires[i];
    data.campfires.push({
      x: Position.x[eid],
      y: Position.y[eid],
      fuel: Campfire.fuelRemaining[eid],
      slot0: Campfire.cookSlot0[eid],
      slot1: Campfire.cookSlot1[eid],
      prog0: Campfire.cookProgress0[eid],
      prog1: Campfire.cookProgress1[eid],
    });
  }

  // Save furnaces
  const furnaces = query(world, [Furnace, Position]);
  for (let i = 0; i < furnaces.length; i++) {
    const eid = furnaces[i];
    data.furnaces.push({
      x: Position.x[eid],
      y: Position.y[eid],
      fuel: Furnace.fuelRemaining[eid],
      inputItem: Furnace.inputItem[eid],
      inputCount: Furnace.inputCount[eid],
      outputItem: Furnace.outputItem[eid],
      outputCount: Furnace.outputCount[eid],
      progress: Furnace.smeltProgress[eid],
    });
  }

  // Save workbenches
  const workbenches = query(world, [Workbench, Position]);
  for (let i = 0; i < workbenches.length; i++) {
    const eid = workbenches[i];
    data.workbenches.push({
      x: Position.x[eid],
      y: Position.y[eid],
      tier: Workbench.tier[eid],
    });
  }

  // Save tool cupboards
  const tcs = query(world, [ToolCupboard, Position]);
  for (let i = 0; i < tcs.length; i++) {
    const eid = tcs[i];
    data.toolCupboards.push({
      x: Position.x[eid],
      y: Position.y[eid],
      radius: ToolCupboard.radius[eid],
      hp: Health.current[eid],
      maxHp: Health.max[eid],
    });
  }

  // Save sleeping bags and beds
  const bags = query(world, [SleepingBag, Position]);
  for (let i = 0; i < bags.length; i++) {
    const eid = bags[i];
    const entityType = gameState.entityTypes.get(eid);
    // Resolve owner UUID from eid
    let ownerUuid = null;
    const ownerEid = SleepingBag.ownerPlayerId[eid];
    if (gameState.eidToUuid) {
      ownerUuid = gameState.eidToUuid.get(ownerEid) || null;
    }
    data.sleepingBags.push({
      x: Position.x[eid],
      y: Position.y[eid],
      owner: SleepingBag.ownerPlayerId[eid],
      ownerUuid,
      cooldown: SleepingBag.cooldown[eid],
      placedTick: SleepingBag.placedTick[eid] || 0,
      isBed: entityType === ENTITY_TYPE.BED,
      spriteId: Sprite.spriteId[eid],
    });
  }

  // Save storage boxes (skip loot bags — saved separately)
  const boxes = query(world, [StorageBox, Position]);
  for (let i = 0; i < boxes.length; i++) {
    const eid = boxes[i];
    if (gameState.entityTypes.get(eid) === ENTITY_TYPE.LOOT_BAG) continue;
    const slots = gameState.containerInv?.get(eid) || [];
    data.storageBoxes.push({
      x: Position.x[eid],
      y: Position.y[eid],
      hp: Health.current[eid],
      maxHp: Health.max[eid],
      slots,
    });
  }

  // Save loot bags with despawn timers
  if (gameState.lootBagTimers) {
    for (const [eid, timer] of gameState.lootBagTimers) {
      if (!hasComponent(world, eid, Position)) continue;
      const slots = gameState.containerInv?.get(eid) || [];
      data.lootBags.push({
        x: Position.x[eid],
        y: Position.y[eid],
        timer,
        slots,
      });
    }
  }

  // Save TC auth and door auth using UUIDs where possible
  for (const [eid, authSet] of gameState.tcAuth) {
    if (!hasComponent(world, eid, Position)) continue;
    const key = `${Math.round(Position.x[eid])},${Math.round(Position.y[eid])}`;
    const uuids = [];
    for (const playerEid of authSet) {
      const uuid = gameState.eidToUuid?.get(playerEid);
      if (uuid) uuids.push(uuid);
    }
    data.tcAuth[key] = uuids;
  }

  for (const [eid, authSet] of gameState.doorAuth) {
    if (!hasComponent(world, eid, Position)) continue;
    const key = `${Math.round(Position.x[eid])},${Math.round(Position.y[eid])}`;
    const uuids = [];
    for (const playerEid of authSet) {
      const uuid = gameState.eidToUuid?.get(playerEid);
      if (uuid) uuids.push(uuid);
    }
    data.doorAuth[key] = uuids;
  }

  // Save learned recipes by UUID
  if (gameState.learnedRecipesByUuid) {
    for (const [uuid, recipes] of gameState.learnedRecipesByUuid) {
      data.learnedRecipes[uuid] = [...recipes];
    }
  }

  // Save depleted resource nodes
  const nodes = query(world, [ResourceNode, Position]);
  for (let i = 0; i < nodes.length; i++) {
    const eid = nodes[i];
    if (ResourceNode.remaining[eid] < ResourceNode.maxAmount[eid]) {
      data.resourceDepletion.push({
        x: Math.round(Position.x[eid] * 10) / 10,
        y: Math.round(Position.y[eid] * 10) / 10,
        remaining: ResourceNode.remaining[eid],
        timer: ResourceNode.respawnTimer[eid],
      });
    }
  }

  // Save sleeper (offline player) bodies
  const sleepers = query(world, [Sleeper, Player, Position]);
  for (let i = 0; i < sleepers.length; i++) {
    const eid = sleepers[i];
    const uuid = gameState.eidToUuid?.get(eid);
    if (!uuid) continue;

    const invItems = [];
    const invCounts = [];
    const invDurability = [];
    if (Inventory.items[eid]) {
      for (let s = 0; s < 24; s++) {
        invItems.push(Inventory.items[eid][s] || 0);
        invCounts.push(Inventory.counts[eid][s] || 0);
        invDurability.push(Inventory.durability[eid]?.[s] || 0);
      }
    }

    data.sleepers.push({
      uuid,
      x: Position.x[eid],
      y: Position.y[eid],
      hp: Health.current[eid],
      maxHp: Health.max[eid],
      hunger: Hunger.current[eid],
      thirst: Thirst.current[eid],
      invItems,
      invCounts,
      invDurability,
      selectedSlot: Hotbar.selectedSlot[eid],
      armor: {
        head: Armor.headSlot[eid] || 0,
        chest: Armor.chestSlot[eid] || 0,
        legs: Armor.legsSlot[eid] || 0,
      },
      name: gameState.playerNames.get(eid) || 'Sleeper',
    });
  }

  try {
    writeFileSync(SAVE_FILE, JSON.stringify(data));
    const total = data.structures.length + data.campfires.length + data.furnaces.length +
                  data.workbenches.length + data.toolCupboards.length + data.sleepingBags.length +
                  data.storageBoxes.length;
    const playerCount = Object.keys(data.players).length;
    console.log(`World saved: ${total} placed objects, ${data.resourceDepletion.length} depleted nodes, ${playerCount} players, ${data.sleepers.length} sleepers`);
  } catch (e) {
    console.error('Failed to save world:', e.message);
  }
}

export function loadWorld(world, gameState) {
  if (!existsSync(SAVE_FILE)) return false;

  try {
    const data = JSON.parse(readFileSync(SAVE_FILE, 'utf-8'));
    gameState.worldTime = data.worldTime || 0;

    let loaded = 0;

    // Map from position key to eid for auth restoration
    const tcEidByPos = new Map();
    const doorEidByPos = new Map();

    // Load saved player data into playersByUuid
    if (!gameState.playersByUuid) gameState.playersByUuid = new Map();
    for (const [uuid, pdata] of Object.entries(data.players || {})) {
      gameState.playersByUuid.set(uuid, pdata);
    }
    const playerCount = gameState.playersByUuid.size;

    // Build a UUID->eid lookup for auth restoration (will be populated when players connect)
    // For now, store the auth UUIDs so they can be resolved when players reconnect
    if (!gameState.pendingTcAuth) gameState.pendingTcAuth = new Map(); // posKey -> [uuids]
    if (!gameState.pendingDoorAuth) gameState.pendingDoorAuth = new Map();

    // Recreate structures
    for (const s of (data.structures || [])) {
      const eid = addEntity(world);
      addComponent(world, eid, Position);
      addComponent(world, eid, Structure);
      addComponent(world, eid, Health);
      addComponent(world, eid, Collider);
      addComponent(world, eid, Sprite);
      addComponent(world, eid, NetworkSync);

      Position.x[eid] = s.x;
      Position.y[eid] = s.y;
      Structure.structureType[eid] = s.type;
      Structure.tier[eid] = s.tier;
      Structure.hp[eid] = s.hp;
      Structure.maxHp[eid] = s.maxHp;
      Structure.placedBy[eid] = s.placedBy;
      Structure.rotation[eid] = s.rotation || 0;
      Structure.boxHalfW[eid] = s.boxHalfW || 0;
      Structure.boxHalfH[eid] = s.boxHalfH || 0;
      Health.current[eid] = s.hp;
      Health.max[eid] = s.maxHp;

      // Foundations are walkable (no collider)
      // Walls have OBB collision. Doorways are passable.
      const isFoundationType = (s.type === 1 || s.type === 8); // FOUNDATION, FOUNDATION_TRI
      const isWallType = (s.type === 2 || s.type === 7); // WALL, WINDOW
      const isDoorway = (s.type === 3); // DOORWAY
      if (isFoundationType) {
        Collider.radius[eid] = 0;
        Collider.isStatic[eid] = 0;
      } else if (isWallType) {
        Collider.radius[eid] = 2.0;
        Collider.isStatic[eid] = 1;
        // Ensure OBB dimensions for old saves without them
        if (!Structure.boxHalfW[eid]) {
          Structure.boxHalfW[eid] = 2.0;
          Structure.boxHalfH[eid] = 0.2;
        }
      } else if (isDoorway) {
        Collider.radius[eid] = 0;
        Collider.isStatic[eid] = 0;
      } else {
        Collider.radius[eid] = 2.0;
        Collider.isStatic[eid] = 1;
      }
      Sprite.spriteId[eid] = 200 + s.type;
      NetworkSync.lastTick[eid] = 0;

      if (s.isDoor) {
        addComponent(world, eid, Door);
        Door.isOpen[eid] = s.isOpen || 0;
        Door.lockType[eid] = s.lockType || 0;
        Door.lockCode[eid] = s.lockCode || 0;
        // Doors use OBB collision when closed
        Collider.radius[eid] = 2.0;
        Collider.isStatic[eid] = s.isOpen ? 0 : 1;
        if (!Structure.boxHalfW[eid]) {
          Structure.boxHalfW[eid] = 2.0;
          Structure.boxHalfH[eid] = 0.15;
        }
        doorEidByPos.set(`${Math.round(s.x)},${Math.round(s.y)}`, eid);
        gameState.entityTypes.set(eid, ENTITY_TYPE.DOOR);
      } else {
        gameState.entityTypes.set(eid, ENTITY_TYPE.STRUCTURE);
      }
      loaded++;
    }

    // Recreate campfires
    for (const c of (data.campfires || [])) {
      const eid = addEntity(world);
      addComponent(world, eid, Position);
      addComponent(world, eid, Campfire);
      addComponent(world, eid, Collider);
      addComponent(world, eid, Sprite);
      addComponent(world, eid, NetworkSync);

      Position.x[eid] = c.x;
      Position.y[eid] = c.y;
      Campfire.fuelRemaining[eid] = c.fuel || 0;
      Campfire.cookSlot0[eid] = c.slot0 || 0;
      Campfire.cookSlot1[eid] = c.slot1 || 0;
      Campfire.cookProgress0[eid] = c.prog0 || 0;
      Campfire.cookProgress1[eid] = c.prog1 || 0;
      Collider.radius[eid] = 0.5;
      Sprite.spriteId[eid] = 211;
      NetworkSync.lastTick[eid] = 0;
      gameState.entityTypes.set(eid, ENTITY_TYPE.CAMPFIRE);
      loaded++;
    }

    // Recreate furnaces
    for (const f of (data.furnaces || [])) {
      const eid = addEntity(world);
      addComponent(world, eid, Position);
      addComponent(world, eid, Furnace);
      addComponent(world, eid, Collider);
      addComponent(world, eid, Sprite);
      addComponent(world, eid, NetworkSync);

      Position.x[eid] = f.x;
      Position.y[eid] = f.y;
      Furnace.fuelRemaining[eid] = f.fuel || 0;
      Furnace.inputItem[eid] = f.inputItem || 0;
      Furnace.inputCount[eid] = f.inputCount || 0;
      Furnace.outputItem[eid] = f.outputItem || 0;
      Furnace.outputCount[eid] = f.outputCount || 0;
      Furnace.smeltProgress[eid] = f.progress || 0;
      Collider.radius[eid] = 0.5;
      Sprite.spriteId[eid] = 212;
      NetworkSync.lastTick[eid] = 0;
      gameState.entityTypes.set(eid, ENTITY_TYPE.FURNACE);
      loaded++;
    }

    // Recreate workbenches
    for (const w of (data.workbenches || [])) {
      const eid = addEntity(world);
      addComponent(world, eid, Position);
      addComponent(world, eid, Workbench);
      addComponent(world, eid, Collider);
      addComponent(world, eid, Sprite);
      addComponent(world, eid, NetworkSync);

      Position.x[eid] = w.x;
      Position.y[eid] = w.y;
      Workbench.tier[eid] = w.tier;
      Collider.radius[eid] = 0.6;
      Sprite.spriteId[eid] = 220 + w.tier;
      NetworkSync.lastTick[eid] = 0;
      gameState.entityTypes.set(eid, ENTITY_TYPE.WORKBENCH);
      loaded++;
    }

    // Recreate tool cupboards
    for (const tc of (data.toolCupboards || [])) {
      const eid = addEntity(world);
      addComponent(world, eid, Position);
      addComponent(world, eid, ToolCupboard);
      addComponent(world, eid, Health);
      addComponent(world, eid, Collider);
      addComponent(world, eid, Sprite);
      addComponent(world, eid, NetworkSync);

      Position.x[eid] = tc.x;
      Position.y[eid] = tc.y;
      ToolCupboard.radius[eid] = tc.radius || 32;
      Health.current[eid] = tc.hp || 250;
      Health.max[eid] = tc.maxHp || 250;
      Collider.radius[eid] = 0.4;
      Sprite.spriteId[eid] = 213;
      NetworkSync.lastTick[eid] = 0;
      gameState.entityTypes.set(eid, ENTITY_TYPE.TOOL_CUPBOARD);
      tcEidByPos.set(`${Math.round(tc.x)},${Math.round(tc.y)}`, eid);
      loaded++;
    }

    // Recreate sleeping bags and beds
    for (const bag of (data.sleepingBags || [])) {
      const eid = addEntity(world);
      addComponent(world, eid, Position);
      addComponent(world, eid, SleepingBag);
      addComponent(world, eid, Collider);
      addComponent(world, eid, Sprite);
      addComponent(world, eid, NetworkSync);

      Position.x[eid] = bag.x;
      Position.y[eid] = bag.y;
      SleepingBag.ownerPlayerId[eid] = bag.owner;
      SleepingBag.cooldown[eid] = bag.cooldown || 0;
      SleepingBag.placedTick[eid] = bag.placedTick || 0;
      Collider.radius[eid] = bag.isBed ? 0.5 : 0.4;
      Sprite.spriteId[eid] = bag.spriteId || (bag.isBed ? 216 : 210);
      NetworkSync.lastTick[eid] = 0;

      const entityType = bag.isBed ? ENTITY_TYPE.BED : ENTITY_TYPE.SLEEPING_BAG;
      gameState.entityTypes.set(eid, entityType);

      // Store ownerUuid for later resolution when player connects
      if (bag.ownerUuid && gameState.bagOwnerUuids) {
        gameState.bagOwnerUuids.set(eid, bag.ownerUuid);
      }
      loaded++;
    }

    // Recreate storage boxes
    for (const box of (data.storageBoxes || [])) {
      const eid = addEntity(world);
      addComponent(world, eid, Position);
      addComponent(world, eid, StorageBox);
      addComponent(world, eid, Health);
      addComponent(world, eid, Collider);
      addComponent(world, eid, Sprite);
      addComponent(world, eid, NetworkSync);

      Position.x[eid] = box.x;
      Position.y[eid] = box.y;
      Health.current[eid] = box.hp || 200;
      Health.max[eid] = box.maxHp || 200;
      Collider.radius[eid] = 0.5;
      Sprite.spriteId[eid] = 215;
      NetworkSync.lastTick[eid] = 0;
      gameState.entityTypes.set(eid, ENTITY_TYPE.STORAGE_BOX);

      // Restore container inventory
      if (!gameState.containerInv) gameState.containerInv = new Map();
      const slots = (box.slots || []).map(s => ({ id: s.id || 0, n: s.n || 0 }));
      while (slots.length < 12) slots.push({ id: 0, n: 0 });
      gameState.containerInv.set(eid, slots);
      loaded++;
    }

    // Recreate loot bags
    if (!gameState.lootBagTimers) gameState.lootBagTimers = new Map();
    for (const bag of (data.lootBags || [])) {
      const eid = addEntity(world);
      addComponent(world, eid, Position);
      addComponent(world, eid, Collider);
      addComponent(world, eid, Sprite);
      addComponent(world, eid, NetworkSync);
      addComponent(world, eid, StorageBox);
      addComponent(world, eid, Health);

      Position.x[eid] = bag.x;
      Position.y[eid] = bag.y;
      Collider.radius[eid] = 0.4;
      Sprite.spriteId[eid] = 230;
      NetworkSync.lastTick[eid] = 0;
      Health.current[eid] = 1000;
      Health.max[eid] = 1000;
      gameState.entityTypes.set(eid, ENTITY_TYPE.LOOT_BAG);

      if (!gameState.containerInv) gameState.containerInv = new Map();
      const slots = (bag.slots || []).map(s => ({ id: s.id || 0, n: s.n || 0 }));
      gameState.containerInv.set(eid, slots);
      gameState.lootBagTimers.set(eid, bag.timer || 0);
      loaded++;
    }

    // Store pending auth UUIDs for resolution when players connect
    for (const [posKey, uuids] of Object.entries(data.tcAuth || {})) {
      const eid = tcEidByPos.get(posKey);
      if (eid !== undefined) {
        // If uuids are strings (UUID format), store as pending
        if (uuids.length > 0 && typeof uuids[0] === 'string') {
          gameState.pendingTcAuth.set(eid, uuids);
        } else {
          // Legacy format: numeric EIDs (won't resolve, but preserve for mid-session restarts)
          gameState.tcAuth.set(eid, new Set(uuids));
        }
      }
    }

    for (const [posKey, uuids] of Object.entries(data.doorAuth || {})) {
      const eid = doorEidByPos.get(posKey);
      if (eid !== undefined) {
        if (uuids.length > 0 && typeof uuids[0] === 'string') {
          gameState.pendingDoorAuth.set(eid, uuids);
        } else {
          gameState.doorAuth.set(eid, new Set(uuids));
        }
      }
    }

    // Restore learned recipes by UUID
    if (data.learnedRecipes) {
      if (!gameState.learnedRecipesByUuid) gameState.learnedRecipesByUuid = new Map();
      for (const [uuid, recipes] of Object.entries(data.learnedRecipes)) {
        gameState.learnedRecipesByUuid.set(uuid, new Set(recipes));
      }
    }

    // Restore resource depletion
    if (data.resourceDepletion?.length > 0) {
      const nodes = query(world, [ResourceNode, Position]);
      const nodeMap = new Map();
      for (let i = 0; i < nodes.length; i++) {
        const neid = nodes[i];
        const key = `${Math.round(Position.x[neid] * 10) / 10},${Math.round(Position.y[neid] * 10) / 10}`;
        nodeMap.set(key, neid);
      }
      let depletedCount = 0;
      for (const dep of data.resourceDepletion) {
        const key = `${dep.x},${dep.y}`;
        const neid = nodeMap.get(key);
        if (neid !== undefined) {
          ResourceNode.remaining[neid] = dep.remaining;
          ResourceNode.respawnTimer[neid] = dep.timer;
          depletedCount++;
        }
      }
      console.log(`Restored ${depletedCount} depleted resource nodes`);
    }

    // Recreate sleeper (offline player) bodies
    let sleeperCount = 0;
    for (const s of (data.sleepers || [])) {
      if (!s.uuid) continue;

      const eid = addEntity(world);
      addComponent(world, eid, Position);
      addComponent(world, eid, Velocity);
      addComponent(world, eid, Rotation);
      addComponent(world, eid, Player);
      addComponent(world, eid, Health);
      addComponent(world, eid, Hunger);
      addComponent(world, eid, Thirst);
      addComponent(world, eid, Temperature);
      addComponent(world, eid, Inventory);
      initInventory(eid);
      addComponent(world, eid, Hotbar);
      addComponent(world, eid, Collider);
      addComponent(world, eid, Sprite);
      addComponent(world, eid, NetworkSync);
      addComponent(world, eid, ActiveTool);
      addComponent(world, eid, Damageable);
      addComponent(world, eid, Armor);
      addComponent(world, eid, Sleeper);

      Position.x[eid] = s.x;
      Position.y[eid] = s.y;
      Velocity.vx[eid] = 0;
      Velocity.vy[eid] = 0;
      Player.connectionId[eid] = 0;
      Health.current[eid] = s.hp || PLAYER_MAX_HP;
      Health.max[eid] = s.maxHp || PLAYER_MAX_HP;
      Hunger.current[eid] = s.hunger ?? PLAYER_MAX_HUNGER;
      Hunger.max[eid] = PLAYER_MAX_HUNGER;
      Hunger.decayRate[eid] = 1;
      Thirst.current[eid] = s.thirst ?? PLAYER_MAX_THIRST;
      Thirst.max[eid] = PLAYER_MAX_THIRST;
      Thirst.decayRate[eid] = 1;
      Temperature.current[eid] = 20;
      Temperature.comfort[eid] = 1;
      Collider.radius[eid] = PLAYER_COLLIDER_RADIUS;
      Sprite.spriteId[eid] = 1;
      NetworkSync.lastTick[eid] = 0;
      Hotbar.selectedSlot[eid] = s.selectedSlot || 0;

      // Restore inventory
      if (s.invItems) {
        for (let i = 0; i < 24; i++) {
          Inventory.items[eid][i] = s.invItems[i] || 0;
          Inventory.counts[eid][i] = s.invCounts[i] || 0;
          Inventory.durability[eid][i] = s.invDurability?.[i] || 0;
        }
      }

      // Restore armor
      if (s.armor) {
        Armor.headSlot[eid] = s.armor.head || 0;
        Armor.chestSlot[eid] = s.armor.chest || 0;
        Armor.legsSlot[eid] = s.armor.legs || 0;
      }

      gameState.entityTypes.set(eid, ENTITY_TYPE.PLAYER);
      gameState.playerNames.set(eid, s.name || 'Sleeper');
      gameState.playerStats.set(eid, { kills: 0, resources: 0, name: s.name || 'Sleeper' });

      // Track UUID mappings
      if (!gameState.eidToUuid) gameState.eidToUuid = new Map();
      if (!gameState.uuidToEid) gameState.uuidToEid = new Map();
      if (!gameState.sleepersByUuid) gameState.sleepersByUuid = new Map();
      gameState.eidToUuid.set(eid, s.uuid);
      gameState.uuidToEid.set(s.uuid, eid);
      gameState.sleepersByUuid.set(s.uuid, eid);
      sleeperCount++;
    }

    console.log(`World loaded: ${loaded} placed objects, ${playerCount} saved players, ${sleeperCount} sleepers`);
    return true;
  } catch (e) {
    console.error('Failed to load world:', e.message);
    return false;
  }
}

// Restore a returning player's entity state from saved data
export function restorePlayer(eid, playerData, gameState) {
  Position.x[eid] = playerData.x;
  Position.y[eid] = playerData.y;
  Health.current[eid] = playerData.hp || PLAYER_MAX_HP;
  Health.max[eid] = playerData.maxHp || PLAYER_MAX_HP;
  Hunger.current[eid] = playerData.hunger ?? PLAYER_MAX_HUNGER;
  Thirst.current[eid] = playerData.thirst ?? PLAYER_MAX_THIRST;
  Hotbar.selectedSlot[eid] = playerData.selectedSlot || 0;

  // Restore inventory
  if (playerData.invItems) {
    for (let i = 0; i < 24; i++) {
      Inventory.items[eid][i] = playerData.invItems[i] || 0;
      Inventory.counts[eid][i] = playerData.invCounts[i] || 0;
      Inventory.durability[eid][i] = playerData.invDurability?.[i] || 0;
    }
  }

  // Restore armor
  if (playerData.armor) {
    Armor.headSlot[eid] = playerData.armor.head || 0;
    Armor.chestSlot[eid] = playerData.armor.chest || 0;
    Armor.legsSlot[eid] = playerData.armor.legs || 0;
  }

  return playerData.name || null;
}

// Resolve pending auth entries when a player with a known UUID connects
export function resolveAuthForPlayer(uuid, eid, gameState) {
  // Resolve pending TC auth
  for (const [tcEid, uuids] of gameState.pendingTcAuth) {
    if (uuids.includes(uuid)) {
      if (!gameState.tcAuth.has(tcEid)) {
        gameState.tcAuth.set(tcEid, new Set());
      }
      gameState.tcAuth.get(tcEid).add(eid);
    }
  }

  // Resolve pending door auth
  for (const [doorEid, uuids] of gameState.pendingDoorAuth) {
    if (uuids.includes(uuid)) {
      if (!gameState.doorAuth.has(doorEid)) {
        gameState.doorAuth.set(doorEid, new Set());
      }
      gameState.doorAuth.get(doorEid).add(eid);
    }
  }

  // Resolve sleeping bag ownership
  if (gameState.bagOwnerUuids) {
    for (const [bagEid, ownerUuid] of gameState.bagOwnerUuids) {
      if (ownerUuid === uuid) {
        SleepingBag.ownerPlayerId[bagEid] = eid;
      }
    }
  }
}
