import { WEATHER, WEATHER_MIN_DURATION, WEATHER_MAX_DURATION, SERVER_TPS } from '../../shared/constants.js';
import { MSG } from '../../shared/protocol.js';

export function createWeatherSystem(gameState) {
  // Initialize weather state
  gameState.weather = WEATHER.CLEAR;
  gameState.weatherTimer = 5 * 60 * SERVER_TPS; // first weather change after 5 min
  gameState.weatherDirty = true; // send to clients on first connect

  return function WeatherSystem(world) {
    gameState.weatherTimer--;

    if (gameState.weatherTimer <= 0) {
      // Pick new weather
      const roll = Math.random();
      if (roll < 0.6) {
        gameState.weather = WEATHER.RAIN;
        // Rain lasts 2-5 min
        gameState.weatherTimer = (2 * 60 + Math.floor(Math.random() * 3 * 60)) * SERVER_TPS;
      } else if (roll < 0.8) {
        gameState.weather = WEATHER.FOG;
        // Fog lasts 3-8 min
        gameState.weatherTimer = (3 * 60 + Math.floor(Math.random() * 5 * 60)) * SERVER_TPS;
      } else {
        gameState.weather = WEATHER.CLEAR;
        // Clear lasts 5-15 min
        gameState.weatherTimer = WEATHER_MIN_DURATION + Math.floor(Math.random() * (WEATHER_MAX_DURATION - WEATHER_MIN_DURATION));
      }

      gameState.weatherDirty = true;

      // Notification
      const weatherNames = { [WEATHER.CLEAR]: 'The skies are clearing', [WEATHER.RAIN]: 'It starts to rain', [WEATHER.FOG]: 'A thick fog rolls in' };
      gameState.events.push({
        type: 'weather',
        weather: gameState.weather,
        text: weatherNames[gameState.weather] || 'Weather changed',
      });
    }

    // Broadcast weather state periodically or when it changes
    if (gameState.weatherDirty) {
      gameState.weatherDirty = false;
      const msg = JSON.stringify({
        type: MSG.WEATHER,
        weather: gameState.weather,
      });
      for (const [connId, client] of gameState.clients) {
        if (!client.ws) continue;
        try { client.ws.send(msg); } catch (e) {}
      }
    }

    return world;
  };
}
