import { defineQuery, hasComponent } from 'bitecs';
import { Player, Velocity, Rotation, ActiveTool, Health, Dead } from '../../shared/components.js';
import { KEY, MOUSE_ACTION } from '../../shared/protocol.js';
import { PLAYER_SPEED, PLAYER_SPRINT_MULT } from '../../shared/constants.js';

const playerQuery = defineQuery([Player, Velocity, Rotation]);

export function createInputSystem(gameState) {
  return function InputSystem(world) {
    const players = playerQuery(world);
    for (let i = 0; i < players.length; i++) {
      const eid = players[i];
      if (hasComponent(world, Dead, eid)) continue;

      const connId = Player.connectionId[eid];
      const client = gameState.clients.get(connId);
      if (!client || !client.input) continue;

      const input = client.input;
      const keys = input.keys || 0;
      const sprinting = (keys & KEY.SHIFT) !== 0;
      const speed = PLAYER_SPEED * (sprinting ? PLAYER_SPRINT_MULT : 1.0);

      let dx = 0, dy = 0;
      if (keys & KEY.W) dy -= 1;
      if (keys & KEY.S) dy += 1;
      if (keys & KEY.A) dx -= 1;
      if (keys & KEY.D) dx += 1;

      // Normalize diagonal movement
      if (dx !== 0 && dy !== 0) {
        const inv = 1 / Math.SQRT2;
        dx *= inv;
        dy *= inv;
      }

      Velocity.vx[eid] = dx * speed;
      Velocity.vy[eid] = dy * speed;
      Rotation.angle[eid] = input.mouseAngle || 0;

      // Store mouse action for combat system to read
      client.mouseAction = input.mouseAction || MOUSE_ACTION.NONE;
      client.sprinting = sprinting;
    }
    return world;
  };
}
