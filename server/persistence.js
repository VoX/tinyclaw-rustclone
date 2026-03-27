import { writeFileSync, readFileSync, existsSync } from 'fs';
import { query, addEntity, addComponent } from 'bitecs';
import { Position, Structure, Door, ToolCupboard, SleepingBag,
         Campfire, Furnace, Workbench, Health, ResourceNode, Collider,
         Sprite, NetworkSync, StorageBox } from '../shared/components.js';
import { STRUCT_TYPE, STRUCT_HP, RESOURCE_NODE_DEFS } from '../shared/constants.js';
import { ENTITY_TYPE } from '../shared/protocol.js';

const SAVE_FILE = 'world-state.json';

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
    tcAuth: {},
    doorAuth: {},
    containerInv: {},
    resourceDepletion: [],
  };

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
    };
    // Check if it's a door
    if (Door.isOpen[eid] !== undefined) {
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

  // Save sleeping bags
  const bags = query(world, [SleepingBag, Position]);
  for (let i = 0; i < bags.length; i++) {
    const eid = bags[i];
    data.sleepingBags.push({
      x: Position.x[eid],
      y: Position.y[eid],
      owner: SleepingBag.ownerPlayerId[eid],
      cooldown: SleepingBag.cooldown[eid],
    });
  }

  // Save storage boxes
  const boxes = query(world, [StorageBox, Position]);
  for (let i = 0; i < boxes.length; i++) {
    const eid = boxes[i];
    const slots = gameState.containerInv?.get(eid) || [];
    data.storageBoxes.push({
      x: Position.x[eid],
      y: Position.y[eid],
      hp: Health.current[eid],
      maxHp: Health.max[eid],
      slots,
    });
  }

  // Save TC auth (keyed by position since eids change across restarts)
  for (const [eid, authSet] of gameState.tcAuth) {
    const key = `${Math.round(Position.x[eid])},${Math.round(Position.y[eid])}`;
    data.tcAuth[key] = [...authSet];
  }

  // Save door auth
  for (const [eid, authSet] of gameState.doorAuth) {
    const key = `${Math.round(Position.x[eid])},${Math.round(Position.y[eid])}`;
    data.doorAuth[key] = [...authSet];
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

  try {
    writeFileSync(SAVE_FILE, JSON.stringify(data));
    const total = data.structures.length + data.campfires.length + data.furnaces.length +
                  data.workbenches.length + data.toolCupboards.length + data.sleepingBags.length +
                  data.storageBoxes.length;
    console.log(`World saved: ${total} placed objects, ${data.resourceDepletion.length} depleted nodes`);
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
      Health.current[eid] = s.hp;
      Health.max[eid] = s.maxHp;
      Collider.radius[eid] = 0.9;
      Collider.isStatic[eid] = s.type === 3 ? 0 : 1; // Doorways passable
      Sprite.spriteId[eid] = 200 + s.type;
      NetworkSync.lastTick[eid] = 0;

      if (s.isDoor) {
        addComponent(world, eid, Door);
        Door.isOpen[eid] = s.isOpen || 0;
        Door.lockType[eid] = s.lockType || 0;
        Door.lockCode[eid] = s.lockCode || 0;
        Collider.isStatic[eid] = s.isOpen ? 0 : 1;
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

    // Recreate sleeping bags
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
      Collider.radius[eid] = 0.4;
      Sprite.spriteId[eid] = 210;
      NetworkSync.lastTick[eid] = 0;
      gameState.entityTypes.set(eid, ENTITY_TYPE.SLEEPING_BAG);
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

    // Restore TC auth (position-based)
    for (const [posKey, playerEids] of Object.entries(data.tcAuth || {})) {
      const eid = tcEidByPos.get(posKey);
      if (eid !== undefined) {
        gameState.tcAuth.set(eid, new Set(playerEids));
      }
    }

    // Restore door auth
    for (const [posKey, playerEids] of Object.entries(data.doorAuth || {})) {
      const eid = doorEidByPos.get(posKey);
      if (eid !== undefined) {
        gameState.doorAuth.set(eid, new Set(playerEids));
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

    console.log(`World loaded: ${loaded} placed objects`);
    return true;
  } catch (e) {
    console.error('Failed to load world:', e.message);
    return false;
  }
}
