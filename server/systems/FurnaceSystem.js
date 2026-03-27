import { defineQuery } from 'bitecs';
import { Furnace, Position } from '../../shared/components.js';
import { ITEM, SERVER_TPS } from '../../shared/constants.js';

const furnaceQuery = defineQuery([Furnace]);

// Smelting recipes: input -> output
const SMELT_MAP = {
  [ITEM.METAL_ORE]: ITEM.METAL_FRAGS,
  [ITEM.SULFUR_ORE]: ITEM.SULFUR,
};

const SMELT_TIME = 3 * SERVER_TPS; // 3 seconds per item

export function createFurnaceSystem(gameState) {
  return function FurnaceSystem(world) {
    const furnaces = furnaceQuery(world);
    for (let i = 0; i < furnaces.length; i++) {
      const eid = furnaces[i];
      if (Furnace.fuelRemaining[eid] <= 0) continue;
      if (Furnace.inputCount[eid] <= 0) continue;

      const inputItem = Furnace.inputItem[eid];
      const outputItem = SMELT_MAP[inputItem];
      if (!outputItem) continue;

      Furnace.fuelRemaining[eid]--;
      Furnace.smeltProgress[eid]++;

      if (Furnace.smeltProgress[eid] >= SMELT_TIME) {
        Furnace.smeltProgress[eid] = 0;
        Furnace.inputCount[eid]--;
        if (Furnace.inputCount[eid] === 0) Furnace.inputItem[eid] = 0;
        Furnace.outputItem[eid] = outputItem;
        Furnace.outputCount[eid]++;
      }
    }
    return world;
  };
}
