import { DAY_NIGHT_CYCLE_TICKS, DAY_PORTION } from '../../shared/constants.js';

export function createDayNightSystem(gameState) {
  let prevPhase = 'day';

  return function DayNightSystem(world) {
    gameState.worldTime = (gameState.worldTime + 1) % DAY_NIGHT_CYCLE_TICKS;
    const progress = gameState.worldTime / DAY_NIGHT_CYCLE_TICKS;
    gameState.dayNightPhase = progress < DAY_PORTION ? 'day' : 'night';
    // Light level: 1.0 = full day, 0.2 = night
    if (progress < DAY_PORTION) {
      gameState.lightLevel = 1.0;
    } else {
      const nightProgress = (progress - DAY_PORTION) / (1 - DAY_PORTION);
      // Smooth transition
      if (nightProgress < 0.1) {
        gameState.lightLevel = 1.0 - (nightProgress / 0.1) * 0.8;
      } else if (nightProgress > 0.9) {
        gameState.lightLevel = 0.2 + ((nightProgress - 0.9) / 0.1) * 0.8;
      } else {
        gameState.lightLevel = 0.2;
      }
    }

    // Broadcast day/night transition events
    if (gameState.dayNightPhase !== prevPhase) {
      gameState.events.push({
        type: 'day_night',
        phase: gameState.dayNightPhase,
      });
      prevPhase = gameState.dayNightPhase;
    }

    return world;
  };
}
