import { ENTITY_TYPE } from '../../shared/protocol.js';
import { TILE_SIZE } from '../../shared/constants.js';
import { ParticleSystem } from './particles.js';
import { createTerrainRenderer } from './terrain.js';
import { createEntityRenderer } from './entities.js';
import { createUIOverlays } from './ui-overlays.js';

export function createRenderer(canvas, state) {
  const ctx = canvas.getContext('2d');
  let viewScale = 24;

  // Camera smoothing
  let camX = 0, camY = 0;
  const CAM_SMOOTH = 0.08;

  // Particle system
  const particles = new ParticleSystem();

  // Track processed events for effects
  let lastEventIdx = 0;

  // Sub-renderers
  const terrain = createTerrainRenderer(state);
  const entities = createEntityRenderer(state);
  const ui = createUIOverlays(state);

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  // ── Process events for particle effects and notifications ──
  function processEvents() {
    while (lastEventIdx < state.events.length) {
      const evt = state.events[lastEventIdx++];
      if (!evt) continue;

      if (evt.type === 'hit') {
        const colors = {
          wood: '#c4913a',
          stone: '#aaa',
          metal: '#d4a050',
          sulfur: '#e8d44a',
          flesh: '#c03030',
        };
        const color = colors[evt.material] || '#aaa';
        particles.emit(evt.x, evt.y, color, 6, 30, 400);
      } else if (evt.type === 'muzzle') {
        particles.emitDirectional(evt.x, evt.y, evt.angle, '#ffdd44', 4, 60, 0.5, 200);
        particles.emitDirectional(evt.x, evt.y, evt.angle, '#ff8800', 2, 40, 0.3, 150);
      } else if (evt.type === 'blood') {
        particles.emit(evt.x, evt.y, '#a02020', 5, 25, 500);
        particles.emit(evt.x, evt.y, '#cc3030', 3, 15, 350);
      } else if (evt.type === 'death' && evt.victimName) {
        const text = evt.killerType === 'player'
          ? `${evt.victimName} was killed by ${evt.killerName}`
          : evt.killerType === 'animal'
            ? `${evt.victimName} was killed by a ${evt.killerName}`
            : `${evt.victimName} died`;
        state.notifications.push({ text, time: Date.now(), color: '#e44' });
      } else if (evt.type === 'sleeping_bag') {
        state.notifications.push({
          text: `${evt.playerName} placed a sleeping bag`,
          time: Date.now(),
          color: '#aad',
        });
      } else if (evt.type === 'day_night') {
        const text = evt.phase === 'night' ? 'Night is falling...' : 'A new day begins';
        const color = evt.phase === 'night' ? '#88a' : '#ee8';
        state.notifications.push({ text, time: Date.now(), color });
      }
    }
  }

  // ── Main render ──
  function render(dt) {
    const w = canvas.width;
    const h = canvas.height;
    entities.updateAnimTime(dt);
    const animTime = entities.getAnimTime();

    // Camera target
    let targetX = 0, targetY = 0;
    const me = state.myEid ? state.entities.get(state.myEid) : null;
    if (me) {
      targetX = me.renderX !== undefined ? me.renderX : me.x;
      targetY = me.renderY !== undefined ? me.renderY : me.y;
    }

    // Smooth camera
    camX += (targetX - camX) * CAM_SMOOTH;
    camY += (targetY - camY) * CAM_SMOOTH;

    ctx.clearRect(0, 0, w, h);

    // Process events for effects
    processEvents();
    particles.update(dt);

    const light = state.lightLevel;

    // ── Draw terrain ──
    terrain.drawTerrain(ctx, w, h, camX, camY, viewScale);

    // ── Draw entities ──
    const sortedEntities = [...state.entities.values()].sort((a, b) => (a.y || 0) - (b.y || 0));

    for (const e of sortedEntities) {
      const ex = e.eid === state.myEid ? e.x : (e.renderX || e.x);
      const ey = e.eid === state.myEid ? e.y : (e.renderY || e.y);
      const sx = (ex - camX) * viewScale / TILE_SIZE + w / 2;
      const sy = (ey - camY) * viewScale / TILE_SIZE + h / 2;

      if (sx < -60 || sx > w + 60 || sy < -60 || sy > h + 60) continue;

      entities.drawEntity(ctx, sx, sy, e, viewScale);
    }

    // Health bars
    ui.drawHealthBars(ctx, sortedEntities, camX, camY, w, h, viewScale);

    // Hammer upgrade preview
    ui.drawHammerPreview(ctx, me, sortedEntities, camX, camY, w, h, viewScale, animTime);

    // ── Draw particles ──
    particles.draw(ctx, camX, camY, w, h, viewScale);

    // ── Night overlay + lighting ──
    ui.drawNightOverlay(ctx, w, h, light, sortedEntities, me, camX, camY, viewScale, animTime);

    // ── Golden hour ──
    ui.drawGoldenHour(ctx, w, h, light);

    // ── Fog of war: darken edges ──
    ui.drawEdgeVignette(ctx, w, h);

    // ── Damage red flash ──
    ui.drawDamageFlash(ctx, w, h);

    // ── Chat bubbles above players ──
    ui.drawChatBubbles(ctx, sortedEntities, camX, camY, w, h, viewScale);

    // ── Minimap ──
    if (!state.showMap) {
      ui.drawMinimap(ctx, w, h, camX, camY, sortedEntities);
    }

    // ── Full Map Screen ──
    if (state.showMap) {
      ui.drawFullMap(ctx, w, h, sortedEntities, animTime);
    }

    // ── Kill feed / notifications ──
    ui.drawNotifications(ctx, w, h);

    // ── Chat log ──
    ui.drawChatLog(ctx, w, h);

    // ── Performance display ──
    ui.drawPerfDisplay(ctx, w, h);

    // ── Connection / loading screen ──
    ui.drawConnectionScreen(ctx, w, h);

    // ── Controls overlay ──
    ui.drawControlsOverlay(ctx, w, h);
  }

  return {
    render,
    resetEventIndex() { lastEventIdx = 0; },
  };
}
