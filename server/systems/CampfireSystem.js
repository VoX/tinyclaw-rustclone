import { query } from 'bitecs';
import { Campfire, Position } from '../../shared/components.js';
import { ITEM, SERVER_TPS } from '../../shared/constants.js';

const COOK_TIME = 5 * SERVER_TPS; // 5 seconds

export function createCampfireSystem(gameState) {
  return function CampfireSystem(world) {
    // Update campfire positions for warmth calculations
    gameState.campfirePositions = new Map();

    const campfires = query(world, [Campfire, Position]);
    for (let i = 0; i < campfires.length; i++) {
      const eid = campfires[i];
      if (Campfire.fuelRemaining[eid] <= 0) continue;

      Campfire.fuelRemaining[eid]--;
      gameState.campfirePositions.set(eid, {
        x: Position.x[eid],
        y: Position.y[eid],
      });

      // Cook slot 0
      if (Campfire.cookSlot0[eid] === ITEM.RAW_MEAT) {
        Campfire.cookProgress0[eid]++;
        if (Campfire.cookProgress0[eid] >= COOK_TIME) {
          Campfire.cookSlot0[eid] = ITEM.COOKED_MEAT;
          Campfire.cookProgress0[eid] = 0;
        }
      }

      // Cook slot 1
      if (Campfire.cookSlot1[eid] === ITEM.RAW_MEAT) {
        Campfire.cookProgress1[eid]++;
        if (Campfire.cookProgress1[eid] >= COOK_TIME) {
          Campfire.cookSlot1[eid] = ITEM.COOKED_MEAT;
          Campfire.cookProgress1[eid] = 0;
        }
      }
    }
    return world;
  };
}
