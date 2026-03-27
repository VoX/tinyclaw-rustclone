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
        // Floating damage number
        if (evt.damage) {
          state.damageNumbers.push({
            x: evt.x, y: evt.y,
            text: `-${evt.damage}`,
            time: Date.now(),
            color: evt.material === 'flesh' ? '#ff4444' : '#ffcc00',
          });
        }
        // Screen shake for melee hits from local player
        if (evt.sourceEid === state.myEid) {
          state.screenShakeAmount = Math.max(state.screenShakeAmount, 3);
          state.meleeSwingTime = Date.now();
        }
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
      } else if (evt.type === 'repair') {
        particles.emit(evt.x, evt.y, '#4a4', 4, 20, 300);
        state.notifications.push({
          text: `Repaired +${evt.amount} HP`,
          time: Date.now(),
          color: '#4a4',
        });
      } else if (evt.type === 'day_night') {
        const text = evt.phase === 'night' ? 'Night is falling...' : 'A new day begins';
        const color = evt.phase === 'night' ? '#88a' : '#ee8';
        state.notifications.push({ text, time: Date.now(), color });
      } else if (evt.type === 'weather') {
        if (evt.text) {
          const color = evt.weather === 1 ? '#8af' : evt.weather === 2 ? '#ccc' : '#ee8';
          state.notifications.push({ text: evt.text, time: Date.now(), color });
        }
      } else if (evt.type === 'heli_spawn') {
        state.notifications.push({ text: 'A helicopter approaches...', time: Date.now(), color: '#f84' });
      } else if (evt.type === 'heli_crate') {
        state.notifications.push({ text: 'A locked crate has dropped!', time: Date.now(), color: '#ff4' });
      }
    }
  }

  // ── Rain particles ──
  const rainDrops = [];
  for (let i = 0; i < 200; i++) {
    rainDrops.push({ x: Math.random(), y: Math.random(), speed: 0.3 + Math.random() * 0.4, len: 8 + Math.random() * 12 });
  }

  function drawWeatherEffects(ctx, w, h, dt) {
    if (state.weather === 1) { // RAIN
      // Blue tint
      ctx.fillStyle = 'rgba(40, 60, 120, 0.08)';
      ctx.fillRect(0, 0, w, h);

      // Rain drops
      ctx.strokeStyle = 'rgba(180, 200, 255, 0.3)';
      ctx.lineWidth = 1;
      for (const drop of rainDrops) {
        drop.y += drop.speed * dt * 0.001;
        if (drop.y > 1) { drop.y = 0; drop.x = Math.random(); }
        const dx = drop.x * w;
        const dy = drop.y * h;
        ctx.beginPath();
        ctx.moveTo(dx, dy);
        ctx.lineTo(dx - 1, dy + drop.len);
        ctx.stroke();
      }
    } else if (state.weather === 2) { // FOG
      // White fog overlay at edges, thicker
      const fogGrad = ctx.createRadialGradient(w / 2, h / 2, w * 0.15, w / 2, h / 2, w * 0.45);
      fogGrad.addColorStop(0, 'rgba(200, 210, 220, 0)');
      fogGrad.addColorStop(0.6, 'rgba(200, 210, 220, 0.15)');
      fogGrad.addColorStop(1, 'rgba(200, 210, 220, 0.45)');
      ctx.fillStyle = fogGrad;
      ctx.fillRect(0, 0, w, h);
    }
  }

  function drawRadiationZones(ctx, w, h, camX, camY, viewScale) {
    if (!state.radiationZones || state.radiationZones.length === 0) return;

    for (const zone of state.radiationZones) {
      const sx = (zone.x - camX) * viewScale / TILE_SIZE + w / 2;
      const sy = (zone.y - camY) * viewScale / TILE_SIZE + h / 2;
      const sr = zone.radius * viewScale / TILE_SIZE;

      // Only draw if on screen
      if (sx + sr < 0 || sx - sr > w || sy + sr < 0 || sy - sr > h) continue;

      // Red tinted circle
      const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
      grad.addColorStop(0, 'rgba(200, 50, 30, 0.12)');
      grad.addColorStop(0.7, 'rgba(200, 50, 30, 0.08)');
      grad.addColorStop(1, 'rgba(200, 50, 30, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();

      // Dashed border
      ctx.save();
      ctx.strokeStyle = 'rgba(200, 50, 30, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Radiation symbol at center
      ctx.save();
      ctx.font = '14px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(200, 50, 30, 0.5)';
      ctx.fillText('☢', sx, sy + 5);
      ctx.restore();
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

    // Screen shake
    if (state.screenShakeAmount > 0) {
      camX += (Math.random() - 0.5) * state.screenShakeAmount * 0.15;
      camY += (Math.random() - 0.5) * state.screenShakeAmount * 0.15;
      state.screenShakeAmount *= 0.85;
      if (state.screenShakeAmount < 0.1) state.screenShakeAmount = 0;
    }

    ctx.clearRect(0, 0, w, h);

    // Apply ADS zoom and death zoom
    const effectiveScale = viewScale * (state.adsZoom || 1.0) * (state.deathZoom || 1.0);

    // Process events for effects
    processEvents();
    particles.update(dt);

    const light = state.lightLevel;

    // ── Draw terrain ──
    terrain.drawTerrain(ctx, w, h, camX, camY, effectiveScale);

    // ── Draw decorations ──
    terrain.drawDecorations(ctx, w, h, camX, camY, effectiveScale);

    // ── Draw entities ──
    const sortedEntities = [...state.entities.values()].sort((a, b) => (a.y || 0) - (b.y || 0));

    for (const e of sortedEntities) {
      const ex = e.eid === state.myEid ? e.x : (e.renderX || e.x);
      const ey = e.eid === state.myEid ? e.y : (e.renderY || e.y);
      const sx = (ex - camX) * effectiveScale / TILE_SIZE + w / 2;
      const sy = (ey - camY) * effectiveScale / TILE_SIZE + h / 2;

      if (sx < -60 || sx > w + 60 || sy < -60 || sy > h + 60) continue;

      // Slight perspective scale: entities near screen edges render slightly smaller
      const dxEdge = (sx - w / 2) / (w / 2);
      const dyEdge = (sy - h / 2) / (h / 2);
      const edgeDist = Math.sqrt(dxEdge * dxEdge + dyEdge * dyEdge);
      const perspScale = 1.0 - Math.min(edgeDist, 1.0) * 0.05; // 0.95x at edges

      entities.drawEntity(ctx, sx, sy, e, effectiveScale * perspScale);
    }

    // Health bars
    ui.drawHealthBars(ctx, sortedEntities, camX, camY, w, h, effectiveScale);

    // Player names
    ui.drawPlayerNames(ctx, sortedEntities, camX, camY, w, h, effectiveScale);

    // Hammer upgrade preview
    ui.drawHammerPreview(ctx, me, sortedEntities, camX, camY, w, h, effectiveScale, animTime);

    // Building placement preview
    ui.drawBuildPreview(ctx, w, h, camX, camY, effectiveScale, sortedEntities);

    // ── Draw particles ──
    particles.draw(ctx, camX, camY, w, h, effectiveScale);

    // ── Floating damage numbers ──
    {
      const nowMs = Date.now();
      for (let i = state.damageNumbers.length - 1; i >= 0; i--) {
        const dn = state.damageNumbers[i];
        const elapsed = nowMs - dn.time;
        if (elapsed > 1000) {
          state.damageNumbers.splice(i, 1);
          continue;
        }
        const t = elapsed / 1000;
        const alpha = 1 - t;
        const floatY = t * 30; // float upward 30px
        const sx = (dn.x - camX) * effectiveScale / TILE_SIZE + w / 2;
        const sy = (dn.y - camY) * effectiveScale / TILE_SIZE + h / 2 - floatY;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = 'bold 14px Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#000';
        ctx.fillText(dn.text, sx + 1, sy + 1);
        ctx.fillStyle = dn.color;
        ctx.fillText(dn.text, sx, sy);
        ctx.restore();
      }
    }

    // ── Night overlay + lighting ──
    ui.drawNightOverlay(ctx, w, h, light, sortedEntities, me, camX, camY, effectiveScale, animTime);

    // ── Golden hour ──
    ui.drawGoldenHour(ctx, w, h, light);

    // ── Fog of war: darken edges ──
    ui.drawEdgeVignette(ctx, w, h);

    // ── ADS effects ──
    ui.drawAdsVignette(ctx, w, h);
    ui.drawAdsCrosshair(ctx, w, h);

    // ── Weather effects ──
    drawWeatherEffects(ctx, w, h, dt);

    // ── Radiation zone overlay ──
    drawRadiationZones(ctx, w, h, camX, camY, effectiveScale);

    // ── Damage red flash ──
    ui.drawDamageFlash(ctx, w, h);

    // ── Death desaturation + YOU DIED overlay ──
    if (state.deathDesaturation > 0.01) {
      // Grey overlay for desaturation effect
      ctx.fillStyle = `rgba(30, 30, 30, ${state.deathDesaturation * 0.5})`;
      ctx.fillRect(0, 0, w, h);
    }
    if (state.isDead) {
      const deathElapsed = Date.now() - (state.deathTime || 0);
      const fadeIn = Math.min(1, deathElapsed / 800);
      // "YOU DIED" text with slight shake
      ctx.save();
      ctx.globalAlpha = fadeIn;
      const shakeX = deathElapsed < 500 ? (Math.random() - 0.5) * 4 * (1 - deathElapsed / 500) : 0;
      const shakeY = deathElapsed < 500 ? (Math.random() - 0.5) * 4 * (1 - deathElapsed / 500) : 0;
      ctx.font = 'bold 48px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.fillText('YOU DIED', w / 2 + shakeX + 2, h / 2 - 40 + shakeY + 2);
      ctx.fillStyle = '#cc2222';
      ctx.fillText('YOU DIED', w / 2 + shakeX, h / 2 - 40 + shakeY);
      ctx.textAlign = 'left';
      ctx.restore();
    }

    // ── Craft progress bar ──
    ui.drawCraftProgress(ctx, w, h);

    // ── Temperature visual effects ──
    ui.drawTemperatureEffects(ctx, w, h, sortedEntities, camX, camY, effectiveScale);

    // ── Stamina bar ──
    ui.drawStaminaBar(ctx, w, h);

    // ── Ammo HUD for ranged weapons ──
    ui.drawAmmoHUD(ctx, w, h);

    // ── Sleeping bag count ──
    ui.drawBagCount(ctx, w, h);

    // ── Auto-save indicator ──
    ui.drawSaveIndicator(ctx, w, h);

    // ── Tutorial hint for new players ──
    ui.drawTutorialHint(ctx, w, h);

    // ── Chat bubbles above players ──
    ui.drawChatBubbles(ctx, sortedEntities, camX, camY, w, h, effectiveScale);

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

    // ── Leaderboard ──
    ui.drawLeaderboard(ctx, w, h);

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
