import { query, hasComponent } from 'bitecs';
import { Player, Health, Hunger, Thirst, Temperature, Dead, Position } from '../../shared/components.js';
import { SERVER_TPS, BIOME_TEMP_MOD } from '../../shared/constants.js';

export function createSurvivalSystem(gameState) {
  // Rates per tick
  const hungerIdleRate = 0.5 / 60 / SERVER_TPS;   // 0.5/min
  const hungerRunRate = 1.5 / 60 / SERVER_TPS;
  const hungerSprintRate = 3.0 / 60 / SERVER_TPS;
  const thirstIdleRate = 0.5 / 60 / SERVER_TPS;
  const thirstRunRate = 1.0 / 60 / SERVER_TPS;
  const hpRegenRate = 0.5 / SERVER_TPS;
  const starveRate = 2.0 / SERVER_TPS;
  const dehydrateRate = 3.0 / SERVER_TPS;
  const coldDamageRate = 1.0 / SERVER_TPS;

  return function SurvivalSystem(world) {
    const players = query(world, [Player, Health, Hunger, Thirst, Temperature]);
    for (let i = 0; i < players.length; i++) {
      const eid = players[i];
      if (hasComponent(world, eid, Dead)) continue;

      const connId = Player.connectionId[eid];
      const client = gameState.clients.get(connId);
      const sprinting = client?.sprinting || false;
      const moving = client?.input?.keys > 0;

      // Hunger drain
      let hungerDrain = hungerIdleRate;
      if (sprinting) hungerDrain = hungerSprintRate;
      else if (moving) hungerDrain = hungerRunRate;
      Hunger.current[eid] = Math.max(0, Hunger.current[eid] - hungerDrain);

      // Thirst drain
      let thirstDrain = thirstIdleRate;
      if (moving) thirstDrain = thirstRunRate;
      // Desert biome doubles thirst drain
      const biome = gameState.getBiomeAt?.(Position.x[eid], Position.y[eid]) ?? 0;
      if (biome === 3) thirstDrain *= 2; // BIOME.DESERT
      Thirst.current[eid] = Math.max(0, Thirst.current[eid] - thirstDrain);

      // Temperature calculation
      const baseTempMod = BIOME_TEMP_MOD[biome] || 0;
      const isNight = gameState.dayNightPhase === 'night';
      const nightMod = isNight ? -15 : 0;
      Temperature.current[eid] = 20 + baseTempMod + nightMod; // base 20C

      // Check campfire warmth
      if (gameState.campfirePositions) {
        for (const [cfEid, pos] of gameState.campfirePositions) {
          const dx = Position.x[eid] - pos.x;
          const dy = Position.y[eid] - pos.y;
          if (dx * dx + dy * dy < 5 * 5) {
            Temperature.current[eid] += 20;
            break;
          }
        }
      }

      const temp = Temperature.current[eid];
      Temperature.comfort[eid] = temp >= 15 && temp <= 35 ? 1 : 0;

      // HP effects
      if (Hunger.current[eid] <= 0) {
        Health.current[eid] = Math.max(0, Health.current[eid] - starveRate);
      }
      if (Thirst.current[eid] <= 0) {
        Health.current[eid] = Math.max(0, Health.current[eid] - dehydrateRate);
      }
      if (temp < 5) {
        Health.current[eid] = Math.max(0, Health.current[eid] - coldDamageRate);
      }
      if (temp > 45) {
        Health.current[eid] = Math.max(0, Health.current[eid] - coldDamageRate);
      }

      // HP regen when well-fed and hydrated
      if (Hunger.current[eid] > 50 && Thirst.current[eid] > 50 && Health.current[eid] < Health.max[eid]) {
        Health.current[eid] = Math.min(Health.max[eid], Health.current[eid] + hpRegenRate);
      }

      // Mark inventory dirty periodically so clients get survival stat updates
      // (hunger/thirst/temp are sent via INVENTORY_UPDATE)
      if (gameState.tick % (SERVER_TPS * 2) === 0) {
        gameState.dirtyInventories.add(eid);
      }
    }
    return world;
  };
}
