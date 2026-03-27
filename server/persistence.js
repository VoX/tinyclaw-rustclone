import { writeFileSync, readFileSync, existsSync } from 'fs';
import { defineQuery, hasComponent } from 'bitecs';
import { Position, Structure, Door, ToolCupboard, SleepingBag,
         Campfire, Furnace, Workbench, Health, ResourceNode } from '../shared/components.js';

const SAVE_FILE = 'world-state.json';

const structureQuery = defineQuery([Structure, Position]);
const doorQuery = defineQuery([Door, Position]);
const campfireQuery = defineQuery([Campfire, Position]);
const furnaceQuery = defineQuery([Furnace, Position]);
const workbenchQuery = defineQuery([Workbench, Position]);
const tcQuery = defineQuery([ToolCupboard, Position]);
const bagQuery = defineQuery([SleepingBag, Position]);

export function saveWorld(world, gameState) {
  const data = {
    tick: gameState.tick,
    worldTime: gameState.worldTime,
    structures: [],
    deployables: [],
    tcAuth: {},
    doorAuth: {},
  };

  // Save structures
  const structures = structureQuery(world);
  for (let i = 0; i < structures.length; i++) {
    const eid = structures[i];
    data.structures.push({
      x: Position.x[eid],
      y: Position.y[eid],
      type: Structure.structureType[eid],
      tier: Structure.tier[eid],
      hp: Structure.hp[eid],
      maxHp: Structure.maxHp[eid],
      placedBy: Structure.placedBy[eid],
    });
  }

  // Save TC auth
  for (const [eid, authSet] of gameState.tcAuth) {
    data.tcAuth[eid] = [...authSet];
  }

  // Save door auth
  for (const [eid, authSet] of gameState.doorAuth) {
    data.doorAuth[eid] = [...authSet];
  }

  try {
    writeFileSync(SAVE_FILE, JSON.stringify(data));
    console.log(`World saved: ${data.structures.length} structures`);
  } catch (e) {
    console.error('Failed to save world:', e.message);
  }
}

export function loadWorld(world, gameState) {
  if (!existsSync(SAVE_FILE)) return false;

  try {
    const data = JSON.parse(readFileSync(SAVE_FILE, 'utf-8'));
    console.log(`World loaded: ${data.structures?.length || 0} structures`);
    gameState.worldTime = data.worldTime || 0;
    // TODO: recreate entities from saved data
    return true;
  } catch (e) {
    console.error('Failed to load world:', e.message);
    return false;
  }
}
