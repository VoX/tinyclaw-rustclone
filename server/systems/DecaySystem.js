import { query, hasComponent, removeEntity } from 'bitecs';
import { Structure, Position, Health, ToolCupboard } from '../../shared/components.js';
import { SERVER_TPS } from '../../shared/constants.js';

const DECAY_INTERVAL_TICKS = 60 * SERVER_TPS; // once per minute
const DECAY_DAMAGE = 1; // HP per tick

export function createDecaySystem(gameState) {
  let lastDecayTick = 0;

  return function DecaySystem(world) {
    if (gameState.tick - lastDecayTick < DECAY_INTERVAL_TICKS) return world;
    lastDecayTick = gameState.tick;

    const structures = query(world, [Structure, Position, Health]);
    const tcs = query(world, [ToolCupboard, Position]);

    for (let i = 0; i < structures.length; i++) {
      const eid = structures[i];

      // Check if any TC covers this structure
      let protected_ = false;
      for (let j = 0; j < tcs.length; j++) {
        const tc = tcs[j];
        const dx = Position.x[eid] - Position.x[tc];
        const dy = Position.y[eid] - Position.y[tc];
        const radius = ToolCupboard.radius[tc] || 32;
        if (dx * dx + dy * dy < radius * radius) {
          protected_ = true;
          break;
        }
      }

      if (protected_) continue;

      // Apply decay damage (Health.current is authoritative; sync Structure.hp)
      Health.current[eid] -= DECAY_DAMAGE;
      Structure.hp[eid] = Health.current[eid];

      // Destroy if dead
      if (Health.current[eid] <= 0) {
        gameState.removedEntities.add(eid);
        gameState.entityTypes.delete(eid);
        removeEntity(world, eid);
      }
    }

    return world;
  };
}
