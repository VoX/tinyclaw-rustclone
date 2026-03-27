import { query, hasComponent } from 'bitecs';
import { Player, Velocity, Rotation, Position, ActiveTool, Health, Dead, Collider } from '../../shared/components.js';
import { KEY, MOUSE_ACTION } from '../../shared/protocol.js';
import { PLAYER_SPEED, PLAYER_SPRINT_MULT, WATER_SPEED_MULT, BIOME, WORLD_SIZE, TILE_SIZE, SERVER_TPS } from '../../shared/constants.js';

export function createInputSystem(gameState) {
  // Max distance a player can move per tick (sprint speed + tolerance)
  const maxSpeedPerTick = (PLAYER_SPEED * PLAYER_SPRINT_MULT) / SERVER_TPS;
  const maxDistPerTick = maxSpeedPerTick * 1.5; // 50% tolerance for timing

  return function InputSystem(world) {
    const players = query(world, [Player, Velocity, Rotation, Position]);
    for (let i = 0; i < players.length; i++) {
      const eid = players[i];
      if (hasComponent(world, eid, Dead)) continue;

      const connId = Player.connectionId[eid];
      const client = gameState.clients.get(connId);
      if (!client || !client.input) continue;

      const input = client.input;
      const keys = input.keys || 0;
      const sprinting = (keys & KEY.SHIFT) !== 0;

      Rotation.angle[eid] = input.mouseAngle || 0;
      client.mouseAction = input.mouseAction || MOUSE_ACTION.NONE;
      client.sprinting = sprinting;

      // Client-authoritative movement: accept client position if reasonable
      if (input.x !== undefined && input.y !== undefined) {
        const prevX = Position.x[eid];
        const prevY = Position.y[eid];
        let newX = input.x;
        let newY = input.y;

        // Clamp to world bounds
        const maxCoord = WORLD_SIZE * TILE_SIZE;
        newX = Math.max(0, Math.min(maxCoord, newX));
        newY = Math.max(0, Math.min(maxCoord, newY));

        // Validate distance (anti-cheat: can't move faster than sprint + tolerance)
        const dx = newX - prevX;
        const dy = newY - prevY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= maxDistPerTick) {
          // Accept position
          Position.x[eid] = newX;
          Position.y[eid] = newY;
        } else if (dist > 0) {
          // Too fast — clamp to max allowed distance in the requested direction
          const scale = maxDistPerTick / dist;
          Position.x[eid] = prevX + dx * scale;
          Position.y[eid] = prevY + dy * scale;
        }

        // Zero velocity since client handles movement
        Velocity.vx[eid] = 0;
        Velocity.vy[eid] = 0;
      } else {
        // Fallback: server-computed movement from keys (for bots)
        let speed = PLAYER_SPEED * (sprinting ? PLAYER_SPRINT_MULT : 1.0);

        if (gameState.getBiomeAt) {
          const biome = gameState.getBiomeAt(Position.x[eid], Position.y[eid]);
          if (biome === BIOME.WATER) speed *= WATER_SPEED_MULT;
        }

        let dx = 0, dy = 0;
        if (keys & KEY.W) dy -= 1;
        if (keys & KEY.S) dy += 1;
        if (keys & KEY.A) dx -= 1;
        if (keys & KEY.D) dx += 1;

        if (dx !== 0 && dy !== 0) {
          const inv = 1 / Math.SQRT2;
          dx *= inv;
          dy *= inv;
        }

        Velocity.vx[eid] = dx * speed;
        Velocity.vy[eid] = dy * speed;
      }
    }
    return world;
  };
}
