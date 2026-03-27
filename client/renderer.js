import { ENTITY_TYPE } from '../shared/protocol.js';
import { BIOME, TILE_SIZE, ITEM, ITEM_DEFS, RESOURCE_TYPE, ANIMAL_TYPE, STRUCT_TYPE, STRUCT_TIER } from '../shared/constants.js';

// ── Biome base colors ──
const BIOME_COLORS = {
  [BIOME.BEACH]:     '#e8d68e',
  [BIOME.GRASSLAND]: '#5a8f3c',
  [BIOME.FOREST]:    '#2d5a1e',
  [BIOME.DESERT]:    '#c4a35a',
  [BIOME.SNOW]:      '#dde8f0',
  [BIOME.MOUNTAIN]:  '#7a7a7a',
  [BIOME.WATER]:     '#2850a0',
  [BIOME.ROAD]:      '#8a7a5a',
};

const RESOURCE_COLORS = {
  [RESOURCE_TYPE.TREE]:        '#1a4d0a',
  [RESOURCE_TYPE.STONE_NODE]:  '#808080',
  [RESOURCE_TYPE.METAL_NODE]:  '#b87333',
  [RESOURCE_TYPE.SULFUR_NODE]: '#d4c84a',
  [RESOURCE_TYPE.HEMP]:        '#4a8a2a',
};

const ANIMAL_COLORS = {
  [ANIMAL_TYPE.DEER]: '#b08050',
  [ANIMAL_TYPE.BOAR]: '#6a4a3a',
  [ANIMAL_TYPE.WOLF]: '#606060',
  [ANIMAL_TYPE.BEAR]: '#4a3020',
};

// ── Seeded random for deterministic terrain detail ──
function seededRand(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 1274126177) | 0;
  h = ((h ^ (h >> 13)) * 1103515245) | 0;
  return ((h & 0x7fffffff) / 0x7fffffff);
}

// ── Particle System ──
class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  emit(x, y, color, count, speed, life) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (0.5 + Math.random() * 0.5);
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life,
        maxLife: life,
        color,
        size: 1.5 + Math.random() * 2,
      });
    }
  }

  // Directional burst (for hits, muzzle flash)
  emitDirectional(x, y, angle, color, count, speed, spread, life) {
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const spd = speed * (0.5 + Math.random() * 0.5);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life,
        maxLife: life,
        color,
        size: 1.5 + Math.random() * 2,
      });
    }
  }

  update(dt) {
    const dtSec = dt / 1000;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
      }
    }
  }

  draw(ctx, camX, camY, w, h, viewScale) {
    for (const p of this.particles) {
      const sx = (p.x - camX) * viewScale / TILE_SIZE + w / 2;
      const sy = (p.y - camY) * viewScale / TILE_SIZE + h / 2;
      if (sx < -10 || sx > w + 10 || sy < -10 || sy > h + 10) continue;
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(sx, sy, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

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

  // Time accumulator for animations
  let animTime = 0;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  // ── Pre-render biome chunks with texture detail ──
  const CHUNK_SIZE = 64;
  let biomeChunks = new Map();

  function renderBiomeChunk(chunkX, chunkY) {
    const key = `${chunkX},${chunkY}`;
    if (biomeChunks.has(key)) return biomeChunks.get(key);
    if (!state.biomeMap) return null;

    // Render at 4x resolution for detail
    const DETAIL = 4;
    const chunkCanvas = document.createElement('canvas');
    chunkCanvas.width = CHUNK_SIZE * DETAIL;
    chunkCanvas.height = CHUNK_SIZE * DETAIL;
    const cctx = chunkCanvas.getContext('2d');

    const startX = chunkX * CHUNK_SIZE;
    const startY = chunkY * CHUNK_SIZE;
    const ws = state.worldSize;

    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const tx = startX + x;
        const ty = startY + y;
        if (tx >= ws || ty >= ws) continue;
        const biome = state.biomeMap[ty * ws + tx];
        const baseColor = BIOME_COLORS[biome] || '#333';

        // Base tile
        cctx.fillStyle = baseColor;
        cctx.fillRect(x * DETAIL, y * DETAIL, DETAIL, DETAIL);

        // Tile variation: slight brightness shift per tile
        const variation = seededRand(tx, ty, 42);
        const darken = (variation - 0.5) * 0.08;
        if (darken > 0) {
          cctx.fillStyle = `rgba(255,255,255,${darken})`;
        } else {
          cctx.fillStyle = `rgba(0,0,0,${-darken})`;
        }
        cctx.fillRect(x * DETAIL, y * DETAIL, DETAIL, DETAIL);

        // Biome-specific texture details
        const r1 = seededRand(tx, ty, 7);
        const r2 = seededRand(tx, ty, 13);
        const r3 = seededRand(tx, ty, 19);
        const px = x * DETAIL;
        const py = y * DETAIL;

        if (biome === BIOME.GRASSLAND) {
          // Grass blades
          cctx.strokeStyle = `rgba(80,160,50,${0.3 + r1 * 0.3})`;
          cctx.lineWidth = 0.5;
          const bladeCount = 2 + Math.floor(r2 * 3);
          for (let b = 0; b < bladeCount; b++) {
            const bx = px + seededRand(tx, ty, 30 + b) * DETAIL;
            const by = py + seededRand(tx, ty, 60 + b) * DETAIL;
            cctx.beginPath();
            cctx.moveTo(bx, by);
            cctx.lineTo(bx + (seededRand(tx, ty, 90 + b) - 0.5) * 2, by - 1.5 - r3);
            cctx.stroke();
          }
        } else if (biome === BIOME.DESERT) {
          // Sand dots/speckles
          if (r1 > 0.6) {
            cctx.fillStyle = `rgba(180,150,80,${0.3 + r2 * 0.2})`;
            cctx.beginPath();
            cctx.arc(px + r2 * DETAIL, py + r3 * DETAIL, 0.4 + r1 * 0.4, 0, Math.PI * 2);
            cctx.fill();
          }
          if (r2 > 0.7) {
            cctx.fillStyle = `rgba(210,180,110,0.3)`;
            cctx.beginPath();
            cctx.arc(px + r3 * DETAIL, py + r1 * DETAIL, 0.3, 0, Math.PI * 2);
            cctx.fill();
          }
        } else if (biome === BIOME.SNOW) {
          // Snow crystals / sparkle
          if (r1 > 0.7) {
            cctx.fillStyle = `rgba(255,255,255,${0.4 + r2 * 0.3})`;
            const sx2 = px + r2 * DETAIL;
            const sy2 = py + r3 * DETAIL;
            cctx.beginPath();
            cctx.arc(sx2, sy2, 0.5, 0, Math.PI * 2);
            cctx.fill();
            // Small cross sparkle
            cctx.strokeStyle = `rgba(200,220,255,0.2)`;
            cctx.lineWidth = 0.3;
            cctx.beginPath();
            cctx.moveTo(sx2 - 1, sy2);
            cctx.lineTo(sx2 + 1, sy2);
            cctx.moveTo(sx2, sy2 - 1);
            cctx.lineTo(sx2, sy2 + 1);
            cctx.stroke();
          }
        } else if (biome === BIOME.FOREST) {
          // Dense undergrowth / leaf litter
          if (r1 > 0.4) {
            cctx.fillStyle = `rgba(30,70,20,${0.2 + r2 * 0.2})`;
            cctx.beginPath();
            cctx.arc(px + r2 * DETAIL, py + r3 * DETAIL, 0.6 + r1 * 0.5, 0, Math.PI * 2);
            cctx.fill();
          }
          if (r3 > 0.6) {
            cctx.fillStyle = `rgba(50,100,30,0.15)`;
            cctx.beginPath();
            cctx.arc(px + r1 * DETAIL, py + r2 * DETAIL, 0.4, 0, Math.PI * 2);
            cctx.fill();
          }
        } else if (biome === BIOME.MOUNTAIN) {
          // Rocky cracks
          if (r1 > 0.7) {
            cctx.strokeStyle = `rgba(60,60,60,0.3)`;
            cctx.lineWidth = 0.3;
            cctx.beginPath();
            cctx.moveTo(px + r2 * DETAIL, py);
            cctx.lineTo(px + r3 * DETAIL, py + DETAIL);
            cctx.stroke();
          }
        } else if (biome === BIOME.WATER) {
          // Water ripples / wave patterns
          if (r1 > 0.5) {
            cctx.strokeStyle = `rgba(60,120,200,${0.2 + r2 * 0.2})`;
            cctx.lineWidth = 0.4;
            cctx.beginPath();
            cctx.moveTo(px, py + r3 * DETAIL);
            cctx.quadraticCurveTo(px + DETAIL * 0.5, py + r3 * DETAIL - 0.8, px + DETAIL, py + r3 * DETAIL);
            cctx.stroke();
          }
          if (r2 > 0.7) {
            cctx.fillStyle = `rgba(100,160,220,${0.15 + r1 * 0.1})`;
            cctx.beginPath();
            cctx.arc(px + r1 * DETAIL, py + r3 * DETAIL, 0.4, 0, Math.PI * 2);
            cctx.fill();
          }
        } else if (biome === BIOME.ROAD) {
          // Gravel/dirt speckles
          if (r1 > 0.3) {
            cctx.fillStyle = `rgba(100,85,55,${0.2 + r2 * 0.2})`;
            cctx.beginPath();
            cctx.arc(px + r2 * DETAIL, py + r3 * DETAIL, 0.3 + r1 * 0.3, 0, Math.PI * 2);
            cctx.fill();
          }
          if (r2 > 0.6) {
            cctx.fillStyle = `rgba(150,135,100,0.25)`;
            cctx.beginPath();
            cctx.arc(px + r3 * DETAIL, py + r1 * DETAIL, 0.2 + r2 * 0.2, 0, Math.PI * 2);
            cctx.fill();
          }
          // Tire track ruts (two parallel darker lines)
          const trackSeed = seededRand(tx, ty, 25);
          if (trackSeed > 0.15) {
            cctx.strokeStyle = `rgba(70,60,40,${0.12 + r1 * 0.08})`;
            cctx.lineWidth = 0.4;
            // Left track
            cctx.beginPath();
            cctx.moveTo(px + DETAIL * 0.25, py);
            cctx.lineTo(px + DETAIL * 0.25, py + DETAIL);
            cctx.stroke();
            // Right track
            cctx.beginPath();
            cctx.moveTo(px + DETAIL * 0.75, py);
            cctx.lineTo(px + DETAIL * 0.75, py + DETAIL);
            cctx.stroke();
          }
          // Loose stones
          if (r3 > 0.75) {
            cctx.fillStyle = `rgba(120,110,85,0.35)`;
            cctx.beginPath();
            cctx.arc(px + r1 * DETAIL, py + r2 * DETAIL, 0.5 + r3 * 0.3, 0, Math.PI * 2);
            cctx.fill();
          }
        } else if (biome === BIOME.BEACH) {
          // Sand ripple
          if (r1 > 0.6) {
            cctx.strokeStyle = `rgba(200,190,130,0.2)`;
            cctx.lineWidth = 0.3;
            cctx.beginPath();
            cctx.moveTo(px, py + r2 * DETAIL);
            cctx.lineTo(px + DETAIL, py + r2 * DETAIL + (r3 - 0.5));
            cctx.stroke();
          }
        }
      }
    }

    biomeChunks.set(key, chunkCanvas);
    if (biomeChunks.size > 100) {
      const first = biomeChunks.keys().next().value;
      biomeChunks.delete(first);
    }
    return chunkCanvas;
  }

  // ── Process events for particle effects and notifications ──
  function processEvents(camX, camY, w, h) {
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
        // Kill feed notification
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
    animTime += dt;

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
    processEvents(camX, camY, w, h);
    particles.update(dt);

    const light = state.lightLevel;

    // ── Draw terrain ──
    const tilesX = Math.ceil(w / viewScale) + 2;
    const tilesY = Math.ceil(h / viewScale) + 2;
    const startTileX = Math.floor(camX / TILE_SIZE - tilesX / 2);
    const startTileY = Math.floor(camY / TILE_SIZE - tilesY / 2);

    if (state.biomeMap) {
      const startChunkX = Math.floor(startTileX / CHUNK_SIZE);
      const startChunkY = Math.floor(startTileY / CHUNK_SIZE);
      const endChunkX = Math.ceil((startTileX + tilesX) / CHUNK_SIZE);
      const endChunkY = Math.ceil((startTileY + tilesY) / CHUNK_SIZE);

      ctx.imageSmoothingEnabled = false;
      for (let cy = startChunkY; cy <= endChunkY; cy++) {
        for (let cx = startChunkX; cx <= endChunkX; cx++) {
          const chunk = renderBiomeChunk(cx, cy);
          if (!chunk) continue;

          const screenX = (cx * CHUNK_SIZE * TILE_SIZE - camX) * viewScale / TILE_SIZE + w / 2;
          const screenY = (cy * CHUNK_SIZE * TILE_SIZE - camY) * viewScale / TILE_SIZE + h / 2;
          const size = CHUNK_SIZE * viewScale;

          ctx.drawImage(chunk, screenX, screenY, size, size);
        }
      }
      ctx.imageSmoothingEnabled = true;
    } else {
      ctx.fillStyle = '#333';
      ctx.fillRect(0, 0, w, h);
    }

    // ── Draw entities ──
    const sortedEntities = [...state.entities.values()].sort((a, b) => (a.y || 0) - (b.y || 0));

    for (const e of sortedEntities) {
      const ex = e.eid === state.myEid ? e.x : (e.renderX || e.x);
      const ey = e.eid === state.myEid ? e.y : (e.renderY || e.y);
      const sx = (ex - camX) * viewScale / TILE_SIZE + w / 2;
      const sy = (ey - camY) * viewScale / TILE_SIZE + h / 2;

      if (sx < -60 || sx > w + 60 || sy < -60 || sy > h + 60) continue;

      const type = e.t;

      if (type === ENTITY_TYPE.PLAYER) {
        drawPlayer(ctx, sx, sy, e, e.eid === state.myEid);
      } else if (type === ENTITY_TYPE.RESOURCE_NODE) {
        drawResourceNode(ctx, sx, sy, e);
      } else if (type === ENTITY_TYPE.WORLD_ITEM) {
        drawWorldItem(ctx, sx, sy, e);
      } else if (type === ENTITY_TYPE.PROJECTILE) {
        drawProjectile(ctx, sx, sy, e);
      } else if (type === ENTITY_TYPE.STRUCTURE) {
        drawStructure(ctx, sx, sy, e);
      } else if (type === ENTITY_TYPE.ANIMAL) {
        drawAnimal(ctx, sx, sy, e);
      } else if (type === ENTITY_TYPE.CAMPFIRE) {
        drawCampfire(ctx, sx, sy, e);
      } else if (type === ENTITY_TYPE.FURNACE) {
        drawFurnace(ctx, sx, sy, e);
      } else if (type === ENTITY_TYPE.WORKBENCH) {
        drawWorkbench(ctx, sx, sy, e);
      } else if (type === ENTITY_TYPE.TOOL_CUPBOARD) {
        drawToolCupboard(ctx, sx, sy, e);
      } else if (type === ENTITY_TYPE.SLEEPING_BAG) {
        drawSleepingBag(ctx, sx, sy, e);
      } else if (type === ENTITY_TYPE.STORAGE_BOX) {
        drawStorageBox(ctx, sx, sy, e);
      } else if (type === ENTITY_TYPE.LOOT_BAG) {
        drawLootBag(ctx, sx, sy, e);
      } else if (type === ENTITY_TYPE.BARREL) {
        drawBarrel(ctx, sx, sy, e);
      }

      // Health bar for damaged entities (not local player)
      if (e.hp !== undefined && e.mhp && e.eid !== state.myEid && e.hp < e.mhp) {
        const barW = 30;
        const barH = 4;
        const pct = e.hp / e.mhp;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(sx - barW / 2 - 1, sy - 23, barW + 2, barH + 2);
        const barColor = pct > 0.5 ? '#2d8c2d' : pct > 0.25 ? '#c8a820' : '#c83030';
        ctx.fillStyle = barColor;
        ctx.fillRect(sx - barW / 2, sy - 22, barW * pct, barH);
      }
    }

    // ── Hammer upgrade preview ──
    if (me && !state.isDead) {
      const heldItem = state.inventory[state.selectedSlot]?.id;
      if (heldItem === ITEM.HAMMER) {
        const tierNames = ['Twig', 'Wood', 'Stone', 'Metal'];
        const nextTierColors = {
          0: 'rgba(139,105,20,0.3)',  // -> wood
          1: 'rgba(128,128,128,0.3)', // -> stone
          2: 'rgba(106,106,112,0.3)', // -> metal
        };
        for (const ent of sortedEntities) {
          if (ent.t !== ENTITY_TYPE.STRUCTURE) continue;
          const tier = ent.tier || 0;
          if (tier >= STRUCT_TIER.METAL) continue;
          const ex = ent.renderX || ent.x;
          const ey = ent.renderY || ent.y;
          const dx = ex - me.x;
          const dy = ey - me.y;
          if (dx * dx + dy * dy > 6 * 6) continue;
          const esx = (ex - camX) * viewScale / TILE_SIZE + w / 2;
          const esy = (ey - camY) * viewScale / TILE_SIZE + h / 2;
          const size = viewScale * 0.9;
          // Pulsing upgrade ghost
          const alpha = 0.3 + Math.sin(animTime * 0.005) * 0.15;
          ctx.fillStyle = nextTierColors[tier] || 'rgba(100,100,100,0.3)';
          ctx.globalAlpha = alpha;
          ctx.fillRect(esx - size / 2 - 2, esy - size / 2 - 2, size + 4, size + 4);
          ctx.globalAlpha = 1;
          // Label
          ctx.font = '9px Consolas, monospace';
          ctx.fillStyle = '#fff';
          ctx.textAlign = 'center';
          ctx.fillText(`→ ${tierNames[tier + 1]}`, esx, esy - size / 2 - 5);
          ctx.textAlign = 'left';
        }
      }
    }

    // ── Draw particles ──
    particles.draw(ctx, camX, camY, w, h, viewScale);

    // ── Night overlay + lighting ──
    if (light < 1.0) {
      // Determine color tint based on time of day
      const darkness = 1 - light;
      // Night = blue tint, sunset/sunrise = orange tint
      let r = 0, g = 0, b = 20;
      if (light > 0.5 && light < 0.8) {
        // Sunset/sunrise: orange tint
        r = 40;
        g = 15;
        b = 0;
      }

      // Create darkness layer
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${darkness * 0.85})`;
      ctx.fillRect(0, 0, w, h);

      // Light sources punch through darkness
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';

      // Player torch light
      if (me) {
        const heldItem = state.inventory[state.selectedSlot]?.id;
        if (heldItem === ITEM.TORCH) {
          const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, 160);
          gradient.addColorStop(0, `rgba(0,0,0,${darkness * 0.7})`);
          gradient.addColorStop(0.6, `rgba(0,0,0,${darkness * 0.3})`);
          gradient.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, w, h);
        }
      }

      // Campfire lights (only when lit)
      for (const e of sortedEntities) {
        if (e.t === ENTITY_TYPE.CAMPFIRE && e.lit) {
          const ex2 = e.renderX || e.x;
          const ey2 = e.renderY || e.y;
          const sx2 = (ex2 - camX) * viewScale / TILE_SIZE + w / 2;
          const sy2 = (ey2 - camY) * viewScale / TILE_SIZE + h / 2;
          const flicker = 120 + Math.sin(animTime * 0.008) * 15;
          const gradient = ctx.createRadialGradient(sx2, sy2, 0, sx2, sy2, flicker);
          gradient.addColorStop(0, `rgba(0,0,0,${darkness * 0.6})`);
          gradient.addColorStop(0.5, `rgba(0,0,0,${darkness * 0.2})`);
          gradient.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gradient;
          ctx.fillRect(sx2 - flicker, sy2 - flicker, flicker * 2, flicker * 2);
        }
      }

      ctx.restore();

      // Warm light overlay for torch
      if (me) {
        const heldItem = state.inventory[state.selectedSlot]?.id;
        if (heldItem === ITEM.TORCH) {
          const flicker = 0.12 + Math.sin(animTime * 0.01) * 0.03;
          const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, 160);
          gradient.addColorStop(0, `rgba(255, 200, 100, ${flicker})`);
          gradient.addColorStop(1, 'rgba(255, 200, 100, 0)');
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, w, h);
        }
      }

      // Campfire warm glow overlay (only when lit)
      for (const e of sortedEntities) {
        if (e.t === ENTITY_TYPE.CAMPFIRE && e.lit) {
          const ex2 = e.renderX || e.x;
          const ey2 = e.renderY || e.y;
          const sx2 = (ex2 - camX) * viewScale / TILE_SIZE + w / 2;
          const sy2 = (ey2 - camY) * viewScale / TILE_SIZE + h / 2;
          const flicker = 0.08 + Math.sin(animTime * 0.007 + ex2) * 0.03;
          const rad = 110 + Math.sin(animTime * 0.008) * 10;
          const gradient = ctx.createRadialGradient(sx2, sy2, 0, sx2, sy2, rad);
          gradient.addColorStop(0, `rgba(255, 160, 60, ${flicker})`);
          gradient.addColorStop(1, 'rgba(255, 160, 60, 0)');
          ctx.fillStyle = gradient;
          ctx.fillRect(sx2 - rad, sy2 - rad, rad * 2, rad * 2);
        }
      }
    }

    // ── Day/night color tint (daytime warmth) ──
    if (light >= 0.8 && light < 1.0) {
      // Golden hour warm tint
      const intensity = (1.0 - light) * 0.15;
      ctx.fillStyle = `rgba(255, 180, 60, ${intensity})`;
      ctx.fillRect(0, 0, w, h);
    }

    // ── Fog of war: darken edges ──
    const edgeSize = 80;
    const edgeGradientL = ctx.createLinearGradient(0, 0, edgeSize, 0);
    edgeGradientL.addColorStop(0, 'rgba(0,0,0,0.4)');
    edgeGradientL.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = edgeGradientL;
    ctx.fillRect(0, 0, edgeSize, h);

    const edgeGradientR = ctx.createLinearGradient(w - edgeSize, 0, w, 0);
    edgeGradientR.addColorStop(0, 'rgba(0,0,0,0)');
    edgeGradientR.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = edgeGradientR;
    ctx.fillRect(w - edgeSize, 0, edgeSize, h);

    const edgeGradientT = ctx.createLinearGradient(0, 0, 0, edgeSize);
    edgeGradientT.addColorStop(0, 'rgba(0,0,0,0.4)');
    edgeGradientT.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = edgeGradientT;
    ctx.fillRect(0, 0, w, edgeSize);

    const edgeGradientB = ctx.createLinearGradient(0, h - edgeSize, 0, h);
    edgeGradientB.addColorStop(0, 'rgba(0,0,0,0)');
    edgeGradientB.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = edgeGradientB;
    ctx.fillRect(0, h - edgeSize, w, edgeSize);

    // ── Damage red flash ──
    if (state.damageFlashAlpha > 0) {
      ctx.fillStyle = `rgba(200, 0, 0, ${state.damageFlashAlpha})`;
      ctx.fillRect(0, 0, w, h);
      // Red vignette
      const vigGrad = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.7);
      vigGrad.addColorStop(0, 'rgba(200, 0, 0, 0)');
      vigGrad.addColorStop(1, `rgba(150, 0, 0, ${state.damageFlashAlpha * 0.8})`);
      ctx.fillStyle = vigGrad;
      ctx.fillRect(0, 0, w, h);
    }

    // ── Chat bubbles above players ──
    const nowMs = Date.now();
    for (const e of sortedEntities) {
      if (e.t !== ENTITY_TYPE.PLAYER) continue;
      const bubble = state.chatBubbles.get(e.eid);
      if (!bubble) continue;
      const remaining = bubble.expiry - nowMs;
      if (remaining <= 0) continue;
      const ex = e.eid === state.myEid ? e.x : (e.renderX || e.x);
      const ey = e.eid === state.myEid ? e.y : (e.renderY || e.y);
      const bsx = (ex - camX) * viewScale / TILE_SIZE + w / 2;
      const bsy = (ey - camY) * viewScale / TILE_SIZE + h / 2;
      const fadeAlpha = remaining < 1000 ? remaining / 1000 : 1;
      ctx.save();
      ctx.globalAlpha = fadeAlpha;
      ctx.font = '11px Consolas, monospace';
      const textW = ctx.measureText(bubble.text).width;
      const bx = bsx - textW / 2 - 6;
      const by = bsy - 35;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.beginPath();
      ctx.roundRect(bx, by - 10, textW + 12, 18, 4);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(bubble.text, bx + 6, by + 3);
      ctx.restore();
    }

    // ── Minimap ──
    if (!state.showMap) {
      drawMinimap(ctx, w, h, camX, camY, sortedEntities);
    }

    // ── Full Map Screen ──
    if (state.showMap) {
      drawFullMap(ctx, w, h, sortedEntities);
    }

    // ── Kill feed / notifications ──
    drawNotifications(ctx, w, h);

    // ── Chat log ──
    drawChatLog(ctx, w, h);

    // ── Performance display ──
    if (state.showPerf) {
      ctx.save();
      ctx.font = '12px Consolas, monospace';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(8, 8, 160, 52);
      ctx.fillStyle = '#0f0';
      ctx.fillText(`FPS: ${state.fps}`, 14, 24);
      ctx.fillStyle = '#ff0';
      ctx.fillText(`Ping: ${state.ping}ms`, 14, 38);
      ctx.fillStyle = '#0ff';
      ctx.fillText(`Entities: ${state.entityCount}`, 14, 52);
      ctx.restore();
    }

    // ── Connection / loading screen ──
    if (!state.worldReady) {
      ctx.fillStyle = 'rgba(0,0,0,0.9)';
      ctx.fillRect(0, 0, w, h);
      ctx.font = '24px Consolas, monospace';
      ctx.fillStyle = '#aaa';
      ctx.textAlign = 'center';
      if (state.connecting) {
        ctx.fillText('Connecting...', w / 2, h / 2);
      } else if (state.loadingWorld) {
        ctx.fillText('Loading world...', w / 2, h / 2);
      } else {
        ctx.fillText('Reconnecting...', w / 2, h / 2);
      }
      ctx.textAlign = 'left';
    }

    // ── Controls overlay ──
    if (state.showControls) {
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = 'center';
      ctx.font = 'bold 28px Consolas, monospace';
      ctx.fillStyle = '#e8c030';
      ctx.fillText('RUST CLONE', w / 2, h / 2 - 130);

      ctx.font = '14px Consolas, monospace';
      ctx.fillStyle = '#ccc';
      const controls = [
        'WASD — Move',
        'Shift — Sprint',
        'Mouse — Aim / LMB Attack / RMB Alt',
        'TAB — Inventory & Crafting',
        'E — Interact',
        'B — Build Menu (hold Building Plan)',
        'Q — Drop Item',
        '1-6 — Hotbar Slots',
        'Enter — Chat',
        'F3 — Performance Stats',
        'M — Map',
      ];
      for (let i = 0; i < controls.length; i++) {
        ctx.fillText(controls[i], w / 2, h / 2 - 70 + i * 22);
      }
      ctx.font = '12px Consolas, monospace';
      ctx.fillStyle = '#888';
      ctx.fillText('Press any key to start', w / 2, h / 2 + controls.length * 22 - 50);
      ctx.textAlign = 'left';
    }
  }

  // ── Minimap drawing ──
  let minimapCanvas = null;
  let minimapDirty = true;
  let minimapLastUpdate = 0;

  function drawMinimap(ctx, w, h, camX, camY, entities) {
    const me = state.myEid ? state.entities.get(state.myEid) : null;
    if (!me || !state.biomeMap) return;

    const mapSize = 180;
    const mapX = w - mapSize - 12;
    const mapY = 12;
    const tileRadius = 200;
    const px = me.x / TILE_SIZE;
    const py = me.y / TILE_SIZE;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.roundRect(mapX - 4, mapY - 4, mapSize + 8, mapSize + 8, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(100,100,100,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Render terrain to offscreen canvas (throttled)
    const now = Date.now();
    if (!minimapCanvas || now - minimapLastUpdate > 500) {
      minimapLastUpdate = now;
      if (!minimapCanvas) {
        minimapCanvas = document.createElement('canvas');
        minimapCanvas.width = mapSize;
        minimapCanvas.height = mapSize;
      }
      const mctx = minimapCanvas.getContext('2d');
      const imgData = mctx.createImageData(mapSize, mapSize);
      const data = imgData.data;
      const ws = state.worldSize;

      const BIOME_RGB = {
        0: [232, 214, 142], // beach
        1: [90, 143, 60],   // grassland
        2: [45, 90, 30],    // forest
        3: [196, 163, 90],  // desert
        4: [221, 232, 240], // snow
        5: [122, 122, 122], // mountain
      };

      for (let my = 0; my < mapSize; my++) {
        for (let mx = 0; mx < mapSize; mx++) {
          const tx = Math.floor(px + (mx - mapSize / 2) * (tileRadius * 2 / mapSize));
          const ty = Math.floor(py + (my - mapSize / 2) * (tileRadius * 2 / mapSize));
          const idx = (my * mapSize + mx) * 4;
          if (tx < 0 || tx >= ws || ty < 0 || ty >= ws) {
            data[idx] = 20; data[idx + 1] = 30; data[idx + 2] = 50; data[idx + 3] = 255;
          } else {
            const biome = state.biomeMap[ty * ws + tx];
            const rgb = BIOME_RGB[biome] || [50, 50, 50];
            data[idx] = rgb[0]; data[idx + 1] = rgb[1]; data[idx + 2] = rgb[2]; data[idx + 3] = 255;
          }
        }
      }
      mctx.putImageData(imgData, 0, 0);
    }

    ctx.drawImage(minimapCanvas, mapX, mapY);

    // Entity dots
    const scale = mapSize / (tileRadius * 2);
    for (const e of entities) {
      const ex = (e.eid === state.myEid ? e.x : (e.renderX || e.x)) / TILE_SIZE;
      const ey = (e.eid === state.myEid ? e.y : (e.renderY || e.y)) / TILE_SIZE;
      const dx = ex - px;
      const dy = ey - py;
      if (Math.abs(dx) > tileRadius || Math.abs(dy) > tileRadius) continue;

      const dotX = mapX + mapSize / 2 + dx * scale;
      const dotY = mapY + mapSize / 2 + dy * scale;

      let color = null;
      let radius = 1.5;

      if (e.t === ENTITY_TYPE.PLAYER) {
        if (e.eid === state.myEid) {
          color = '#0f0';
          radius = 3;
        } else {
          color = '#fff';
          radius = 2;
        }
      } else if (e.t === ENTITY_TYPE.ANIMAL) {
        color = '#f44';
        radius = 1.5;
      } else if (e.t === ENTITY_TYPE.RESOURCE_NODE) {
        const rtColors = { 1: '#1a5a0a', 2: '#888', 3: '#b87333', 4: '#d4c84a', 5: '#4a8a2a' };
        color = rtColors[e.rt] || '#555';
        radius = 1;
      } else if (e.t === ENTITY_TYPE.STRUCTURE || e.t === ENTITY_TYPE.DOOR) {
        color = 'rgba(180,180,150,0.6)';
        radius = 1.5;
      }

      if (color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(dotX, dotY, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Compass label
    ctx.font = '9px Consolas, monospace';
    ctx.fillStyle = '#888';
    ctx.textAlign = 'center';
    ctx.fillText('N', mapX + mapSize / 2, mapY + 10);
    ctx.textAlign = 'left';
  }

  // ── Full Map Screen ──
  let fullMapCanvas = null;
  let fullMapLastRender = 0;

  function drawFullMap(ctx, w, h, entities) {
    const me = state.myEid ? state.entities.get(state.myEid) : null;
    if (!state.biomeMap) return;

    // Dark overlay
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, w, h);

    // Map dimensions
    const margin = 40;
    const mapW = Math.min(w - margin * 2, h - margin * 2);
    const mapH = mapW;
    const mapX = (w - mapW) / 2;
    const mapY = (h - mapH) / 2;

    // Render full map to offscreen canvas (cached)
    const now = Date.now();
    if (!fullMapCanvas || now - fullMapLastRender > 1000) {
      fullMapLastRender = now;
      const mSize = 512;
      if (!fullMapCanvas) {
        fullMapCanvas = document.createElement('canvas');
        fullMapCanvas.width = mSize;
        fullMapCanvas.height = mSize;
      }
      const mctx = fullMapCanvas.getContext('2d');
      const imgData = mctx.createImageData(mSize, mSize);
      const data = imgData.data;
      const ws = state.worldSize;

      const BIOME_RGB = {
        0: [232, 214, 142], // beach
        1: [90, 143, 60],   // grassland
        2: [45, 90, 30],    // forest
        3: [196, 163, 90],  // desert
        4: [221, 232, 240], // snow
        5: [122, 122, 122], // mountain
        6: [40, 80, 160],   // water
      };

      const fogSize = state.exploredTiles ? Math.ceil(ws / 8) : 0;

      for (let my = 0; my < mSize; my++) {
        for (let mx = 0; mx < mSize; mx++) {
          const tx = Math.floor(mx * ws / mSize);
          const ty = Math.floor(my * ws / mSize);
          const idx = (my * mSize + mx) * 4;

          // Check fog of war
          if (state.exploredTiles) {
            const fogX = Math.floor(tx / 8);
            const fogY = Math.floor(ty / 8);
            if (fogX >= 0 && fogX < fogSize && fogY >= 0 && fogY < fogSize) {
              if (!state.exploredTiles[fogY * fogSize + fogX]) {
                data[idx] = 15; data[idx + 1] = 15; data[idx + 2] = 20; data[idx + 3] = 255;
                continue;
              }
            }
          }

          const biome = state.biomeMap[ty * ws + tx];
          const rgb = BIOME_RGB[biome] || [50, 50, 50];
          data[idx] = rgb[0]; data[idx + 1] = rgb[1]; data[idx + 2] = rgb[2]; data[idx + 3] = 255;
        }
      }
      mctx.putImageData(imgData, 0, 0);
    }

    // Draw border
    ctx.fillStyle = 'rgba(30,30,30,0.9)';
    ctx.fillRect(mapX - 4, mapY - 4, mapW + 8, mapH + 8);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.strokeRect(mapX - 4, mapY - 4, mapW + 8, mapH + 8);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(fullMapCanvas, mapX, mapY, mapW, mapH);
    ctx.imageSmoothingEnabled = true;

    const ws = state.worldSize;
    const scale = mapW / ws;
    const ts = TILE_SIZE;

    // Draw markers for sleeping bags
    for (const [eid, ent] of state.entities) {
      if (ent.t === ENTITY_TYPE.SLEEPING_BAG) {
        const mx = mapX + (ent.x / ts) * scale;
        const my = mapY + (ent.y / ts) * scale;
        ctx.fillStyle = '#ff6';
        ctx.beginPath();
        ctx.arc(mx, my, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#aa4';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      if (ent.t === ENTITY_TYPE.TOOL_CUPBOARD) {
        const mx = mapX + (ent.x / ts) * scale;
        const my = mapY + (ent.y / ts) * scale;
        ctx.fillStyle = '#4af';
        ctx.fillRect(mx - 3, my - 3, 6, 6);
        ctx.strokeStyle = '#28a';
        ctx.lineWidth = 1;
        ctx.strokeRect(mx - 3, my - 3, 6, 6);
      }
    }

    // Draw player position
    if (me) {
      const px = mapX + (me.x / ts) * scale;
      const py = mapY + (me.y / ts) * scale;
      // Pulsing indicator
      const pulse = 1 + Math.sin(animTime * 0.005) * 0.3;
      ctx.fillStyle = '#0f0';
      ctx.beginPath();
      ctx.arc(px, py, 5 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Title
    ctx.font = 'bold 18px Consolas, monospace';
    ctx.fillStyle = '#ccc';
    ctx.textAlign = 'center';
    ctx.fillText('MAP (M to close)', w / 2, mapY - 12);
    ctx.textAlign = 'left';

    // Legend
    ctx.font = '11px Consolas, monospace';
    const legendX = mapX + mapW + 12;
    const legendY = mapY + 20;
    const legendItems = [
      ['#0f0', 'You'],
      ['#ff6', 'Sleeping Bag'],
      ['#4af', 'Tool Cupboard'],
      ['rgba(15,15,20,1)', 'Unexplored'],
    ];
    for (let i = 0; i < legendItems.length; i++) {
      ctx.fillStyle = legendItems[i][0];
      ctx.fillRect(legendX, legendY + i * 18 - 8, 10, 10);
      ctx.fillStyle = '#aaa';
      ctx.fillText(legendItems[i][1], legendX + 16, legendY + i * 18);
    }
  }

  // ── Notifications / Kill Feed ──
  function drawNotifications(ctx, w, h) {
    const now = Date.now();

    // Clean expired notifications
    state.notifications = state.notifications.filter(n => now - n.time < 5000);

    const notifX = w - 300;
    const notifY = 210;

    for (let i = 0; i < Math.min(state.notifications.length, 8); i++) {
      const n = state.notifications[state.notifications.length - 1 - i];
      const age = now - n.time;
      const alpha = age > 4000 ? 1 - (age - 4000) / 1000 : 1;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '11px Consolas, monospace';
      const tw = ctx.measureText(n.text).width;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(w - tw - 24, notifY + i * 20 - 2, tw + 16, 18);
      ctx.fillStyle = n.color || '#ddd';
      ctx.textAlign = 'right';
      ctx.fillText(n.text, w - 16, notifY + i * 20 + 11);
      ctx.textAlign = 'left';
      ctx.restore();
    }
  }

  // ── Chat Log ──
  function drawChatLog(ctx, w, h) {
    const messages = state.chatMessages;
    if (messages.length === 0 && !state.chatOpen) return;

    const logX = 14;
    const logY = h - 140;
    const now = Date.now();

    // Show last 10 messages
    const recent = messages.slice(-10);
    for (let i = 0; i < recent.length; i++) {
      const msg = recent[i];
      const age = now - msg.time;
      // Always show if chat is open, otherwise fade after 10s
      let alpha = 1;
      if (!state.chatOpen) {
        if (age > 10000) continue;
        if (age > 8000) alpha = 1 - (age - 8000) / 2000;
      }
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '11px Consolas, monospace';
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      const text = `${msg.senderName}: ${msg.text}`;
      const tw = ctx.measureText(text).width;
      ctx.fillRect(logX - 4, logY + i * 16 - 2, tw + 8, 16);
      ctx.fillStyle = '#ddd';
      ctx.fillText(text, logX, logY + i * 16 + 10);
      ctx.restore();
    }

    // Chat input indicator
    if (state.chatOpen) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(logX - 4, logY + recent.length * 16 + 4, 300, 20);
      ctx.font = '11px Consolas, monospace';
      ctx.fillStyle = '#fff';
      ctx.fillText(`> ${state.chatInput}_`, logX, logY + recent.length * 16 + 18);
    }
  }

  // ── Player drawing ──
  // Track death animation state per entity
  const deathAnims = new Map(); // eid -> { startTime, tilt }

  function drawPlayer(ctx, sx, sy, e, isLocal) {
    const angle = e.a || 0;
    const dead = e.dead;

    // Death animation tracking
    if (dead && !deathAnims.has(e.eid)) {
      deathAnims.set(e.eid, { startTime: animTime, tilt: (Math.random() - 0.5) * 0.4 });
    } else if (!dead && deathAnims.has(e.eid)) {
      deathAnims.delete(e.eid);
    }

    const deathAnim = deathAnims.get(e.eid);
    let deathProgress = 0; // 0 = alive, 1 = fully dead
    if (deathAnim) {
      deathProgress = Math.min(1, (animTime - deathAnim.startTime) / 600);
    }

    // Shadow (drawn without rotation)
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 5, 10 + deathProgress * 4, 4 + deathProgress * 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Draw rotated body
    ctx.save();
    if (dead) {
      ctx.globalAlpha = 1 - deathProgress * 0.4; // Fade to 60% opacity
    }
    ctx.translate(sx, sy);
    // Death: player falls over (tilts 90 degrees + slight random offset)
    const deathTilt = deathAnim ? deathProgress * (Math.PI / 2 + deathAnim.tilt) : 0;
    ctx.rotate(angle + Math.PI / 2 + deathTilt); // +90deg so "up" in local space points toward mouse
    // Scale down slightly when dead (foreshortening)
    if (dead) {
      ctx.scale(1, 1 - deathProgress * 0.3);
    }

    const hasLegsArmor = !dead && e.armorLegs;
    const hasChestArmor = !dead && e.armorChest;
    const hasHeadArmor = !dead && e.armorHead;

    const skinColor = dead ? '#777' : '#d4a574';
    const shirtColor = dead ? '#555' : hasChestArmor ? '#7a5a2a' : (isLocal ? '#3a8fd6' : '#d6553a');
    const pantsColor = dead ? '#444' : hasLegsArmor ? '#6a4a1a' : (isLocal ? '#2a5f8f' : '#8f3a2a');
    const outlineColor = dead ? '#333' : '#222';

    // Legs
    ctx.fillStyle = pantsColor;
    ctx.fillRect(-3, 0, 3, 6);
    ctx.fillRect(1, 0, 3, 6);
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 0.5;
    ctx.strokeRect(-3, 0, 3, 6);
    ctx.strokeRect(1, 0, 3, 6);
    if (hasLegsArmor) {
      ctx.fillStyle = 'rgba(100,70,30,0.4)';
      ctx.fillRect(-3, 0, 3, 6);
      ctx.fillRect(1, 0, 3, 6);
    }

    // Torso
    ctx.fillStyle = shirtColor;
    ctx.fillRect(-6, -5, 12, 8);
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(-6, -5, 12, 8);
    if (hasChestArmor) {
      // Leather strap detail
      ctx.strokeStyle = '#5a3a10';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-2, -5);
      ctx.lineTo(-2, 3);
      ctx.moveTo(2, -5);
      ctx.lineTo(2, 3);
      ctx.stroke();
    }

    // Arms
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.arc(-7, -1, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(7, -1, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Head
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.arc(0, -9, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 1;
    ctx.stroke();
    // Leather helmet
    if (hasHeadArmor) {
      ctx.fillStyle = '#7a5a2a';
      ctx.beginPath();
      ctx.arc(0, -10, 5.5, Math.PI, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#5a3a10';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // Eyes
    if (!dead) {
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(-1.5, -10.5, 0.8, 0, Math.PI * 2);
      ctx.arc(1.5, -10.5, 0.8, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-2.5, -10.5); ctx.lineTo(-0.5, -9);
      ctx.moveTo(-0.5, -10.5); ctx.lineTo(-2.5, -9);
      ctx.moveTo(0.5, -10.5); ctx.lineTo(2.5, -9);
      ctx.moveTo(2.5, -10.5); ctx.lineTo(0.5, -9);
      ctx.stroke();
    }

    ctx.restore();

    // Held weapon (world space)
    if (e.held && e.held !== ITEM.NONE && !dead) {
      drawHeldWeapon(ctx, sx, sy, angle, e.held);
    }
  }

  // ── Draw held weapon extending from player ──
  function drawHeldWeapon(ctx, sx, sy, angle, itemId) {
    const def = ITEM_DEFS[itemId];
    if (!def) return;
    const cat = def.cat;
    const dist = 13;
    const tipX = sx + Math.cos(angle) * dist;
    const tipY = sy + Math.sin(angle) * dist;

    ctx.save();
    ctx.translate(tipX, tipY);
    ctx.rotate(angle);

    if (itemId === ITEM.ROCK) {
      ctx.fillStyle = '#888';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    } else if (itemId === ITEM.TORCH) {
      // Stick
      ctx.strokeStyle = '#6a4a2a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-2, 0);
      ctx.lineTo(8, 0);
      ctx.stroke();
      // Flame
      const flicker = Math.sin(animTime * 0.015) * 1.5;
      ctx.fillStyle = '#ff8800';
      ctx.beginPath();
      ctx.arc(9, -1 + flicker, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.arc(9, -1 + flicker, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (cat === 'tool') {
      // Hatchet / Pickaxe / Hammer
      ctx.strokeStyle = '#6a4a2a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(8, 0);
      ctx.stroke();
      // Head
      const headColor = (itemId === ITEM.METAL_HATCHET || itemId === ITEM.METAL_PICKAXE) ? '#888' : '#777';
      ctx.fillStyle = headColor;
      if (itemId === ITEM.STONE_HATCHET || itemId === ITEM.METAL_HATCHET) {
        ctx.fillRect(6, -4, 4, 8);
      } else if (itemId === ITEM.STONE_PICKAXE || itemId === ITEM.METAL_PICKAXE) {
        ctx.beginPath();
        ctx.moveTo(6, -1);
        ctx.lineTo(12, -3);
        ctx.lineTo(12, 3);
        ctx.lineTo(6, 1);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(6, -3, 5, 6);
      }
    } else if (cat === 'melee') {
      // Spear / Sword / Knife
      const len = itemId === ITEM.WOODEN_SPEAR ? 14 : (itemId === ITEM.SALVAGED_SWORD ? 12 : 8);
      ctx.strokeStyle = itemId === ITEM.WOODEN_SPEAR ? '#8a6a3a' : '#aaa';
      ctx.lineWidth = itemId === ITEM.WOODEN_SPEAR ? 2 : 2.5;
      ctx.beginPath();
      ctx.moveTo(-2, 0);
      ctx.lineTo(len, 0);
      ctx.stroke();
      // Tip
      ctx.fillStyle = itemId === ITEM.WOODEN_SPEAR ? '#6a4a2a' : '#ccc';
      ctx.beginPath();
      ctx.moveTo(len, 0);
      ctx.lineTo(len + 3, -1.5);
      ctx.lineTo(len + 3, 1.5);
      ctx.closePath();
      ctx.fill();
    } else if (cat === 'ranged') {
      // Bow / Crossbow / Guns
      if (itemId === ITEM.HUNTING_BOW) {
        ctx.strokeStyle = '#7a5a2a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 8, -0.8, 0.8);
        ctx.stroke();
        ctx.strokeStyle = '#aaa';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(3, 0);
        ctx.lineTo(0, 6);
        ctx.stroke();
      } else if (itemId === ITEM.CROSSBOW) {
        ctx.fillStyle = '#6a4a2a';
        ctx.fillRect(-3, -1.5, 12, 3);
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(2, -6);
        ctx.lineTo(2, 6);
        ctx.stroke();
      } else {
        // Generic gun shape
        ctx.fillStyle = '#555';
        ctx.fillRect(-3, -2, 14, 4);
        ctx.fillStyle = '#444';
        ctx.fillRect(0, 1, 4, 4); // grip
        // Barrel
        ctx.fillStyle = '#666';
        ctx.fillRect(10, -1, 4, 2);
      }
    }

    ctx.restore();
  }

  // ── Resource Nodes ──
  function drawResourceNode(ctx, sx, sy, e) {
    const rt = e.rt;
    const depleted = e.rem <= 0;
    // Use entity eid for deterministic variation
    const eid = e.eid || 0;
    const sizeVar = 0.8 + seededRand(eid, 0, 5) * 0.4;

    ctx.save();
    ctx.globalAlpha = depleted ? 0.25 : 1.0;

    if (rt === RESOURCE_TYPE.TREE) {
      drawTree(ctx, sx, sy, eid, sizeVar);
    } else if (rt === RESOURCE_TYPE.HEMP) {
      drawHemp(ctx, sx, sy, eid);
    } else if (rt === RESOURCE_TYPE.STONE_NODE) {
      drawStoneNode(ctx, sx, sy, eid, sizeVar);
    } else if (rt === RESOURCE_TYPE.METAL_NODE) {
      drawMetalNode(ctx, sx, sy, eid, sizeVar);
    } else if (rt === RESOURCE_TYPE.SULFUR_NODE) {
      drawSulfurNode(ctx, sx, sy, eid, sizeVar);
    }

    ctx.restore();
  }

  function drawTree(ctx, sx, sy, eid, sizeVar) {
    const canopyRadius = 10 * sizeVar;
    const trunkW = 3 * sizeVar;
    const trunkH = 8 * sizeVar;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(sx + 3, sy + 4, canopyRadius * 0.8, canopyRadius * 0.3, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Trunk
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(sx - trunkW / 2, sy - 2, trunkW, trunkH);
    ctx.strokeStyle = '#3a2a10';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(sx - trunkW / 2, sy - 2, trunkW, trunkH);

    // Canopy (layered circles for depth)
    const r1 = seededRand(eid, 0, 3);
    const r2 = seededRand(eid, 0, 7);

    ctx.fillStyle = '#1a5a0a';
    ctx.beginPath();
    ctx.arc(sx + 2, sy - 4, canopyRadius * 0.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#227712';
    ctx.beginPath();
    ctx.arc(sx - 1, sy - 6, canopyRadius * 0.9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2a8a1a';
    ctx.beginPath();
    ctx.arc(sx + r1 * 2 - 1, sy - 5 - r2 * 2, canopyRadius * 0.7, 0, Math.PI * 2);
    ctx.fill();

    // Canopy highlight
    ctx.fillStyle = 'rgba(80,180,40,0.2)';
    ctx.beginPath();
    ctx.arc(sx - 2, sy - 8, canopyRadius * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Canopy outline
    ctx.strokeStyle = 'rgba(10,40,5,0.3)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(sx, sy - 5, canopyRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawHemp(ctx, sx, sy, eid) {
    // Small green plant
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 2, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    const leaves = 3 + Math.floor(seededRand(eid, 0, 1) * 3);
    for (let i = 0; i < leaves; i++) {
      const angle = (i / leaves) * Math.PI * 2 + seededRand(eid, i, 2) * 0.5;
      const len = 3 + seededRand(eid, i, 3) * 3;
      ctx.strokeStyle = `rgb(${60 + Math.floor(seededRand(eid, i, 4) * 30)}, ${130 + Math.floor(seededRand(eid, i, 5) * 40)}, 40)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(angle) * len, sy + Math.sin(angle) * len - 2);
      ctx.stroke();
    }
    // Center
    ctx.fillStyle = '#5a9a3a';
    ctx.beginPath();
    ctx.arc(sx, sy - 1, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawStoneNode(ctx, sx, sy, eid, sizeVar) {
    const s = 8 * sizeVar;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + s * 0.5, s * 0.8, s * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    // Irregular rock shape
    ctx.fillStyle = '#808080';
    ctx.beginPath();
    const pts = 7;
    for (let i = 0; i < pts; i++) {
      const angle = (i / pts) * Math.PI * 2;
      const r = s * (0.7 + seededRand(eid, i, 10) * 0.3);
      const px = sx + Math.cos(angle) * r;
      const py = sy + Math.sin(angle) * r * 0.7;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Shading: dark bottom
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    for (let i = 0; i < pts; i++) {
      const angle = (i / pts) * Math.PI * 2;
      const r = s * (0.7 + seededRand(eid, i, 10) * 0.3);
      const px = sx + Math.cos(angle) * r;
      const py = sy + Math.sin(angle) * r * 0.7;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.arc(sx - s * 0.2, sy - s * 0.2, s * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Outline
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < pts; i++) {
      const angle = (i / pts) * Math.PI * 2;
      const r = s * (0.7 + seededRand(eid, i, 10) * 0.3);
      const px = sx + Math.cos(angle) * r;
      const py = sy + Math.sin(angle) * r * 0.7;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();

    // Crack detail
    ctx.strokeStyle = 'rgba(60,60,60,0.4)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(sx - s * 0.3, sy - s * 0.1);
    ctx.lineTo(sx + s * 0.1, sy + s * 0.2);
    ctx.stroke();
  }

  function drawMetalNode(ctx, sx, sy, eid, sizeVar) {
    const s = 7 * sizeVar;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + s * 0.5, s * 0.7, s * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Crystalline shape
    ctx.fillStyle = '#8a6840';
    ctx.beginPath();
    ctx.moveTo(sx - s, sy + s * 0.4);
    ctx.lineTo(sx - s * 0.5, sy - s * 0.8);
    ctx.lineTo(sx + s * 0.3, sy - s);
    ctx.lineTo(sx + s, sy - s * 0.3);
    ctx.lineTo(sx + s * 0.7, sy + s * 0.5);
    ctx.lineTo(sx - s * 0.3, sy + s * 0.6);
    ctx.closePath();
    ctx.fill();

    // Metallic shine facets
    ctx.fillStyle = '#c49050';
    ctx.beginPath();
    ctx.moveTo(sx - s * 0.3, sy - s * 0.5);
    ctx.lineTo(sx + s * 0.2, sy - s * 0.8);
    ctx.lineTo(sx + s * 0.6, sy - s * 0.2);
    ctx.lineTo(sx, sy);
    ctx.closePath();
    ctx.fill();

    // Bright highlight
    ctx.fillStyle = 'rgba(220,180,120,0.35)';
    ctx.beginPath();
    ctx.moveTo(sx, sy - s * 0.6);
    ctx.lineTo(sx + s * 0.3, sy - s * 0.3);
    ctx.lineTo(sx + s * 0.1, sy);
    ctx.closePath();
    ctx.fill();

    // Outline
    ctx.strokeStyle = '#5a4020';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx - s, sy + s * 0.4);
    ctx.lineTo(sx - s * 0.5, sy - s * 0.8);
    ctx.lineTo(sx + s * 0.3, sy - s);
    ctx.lineTo(sx + s, sy - s * 0.3);
    ctx.lineTo(sx + s * 0.7, sy + s * 0.5);
    ctx.lineTo(sx - s * 0.3, sy + s * 0.6);
    ctx.closePath();
    ctx.stroke();
  }

  function drawSulfurNode(ctx, sx, sy, eid, sizeVar) {
    const s = 7 * sizeVar;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + s * 0.5, s * 0.7, s * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Crystalline spiky shape
    ctx.fillStyle = '#b8a830';
    ctx.beginPath();
    ctx.moveTo(sx - s * 0.8, sy + s * 0.3);
    ctx.lineTo(sx - s * 0.6, sy - s * 0.5);
    ctx.lineTo(sx - s * 0.1, sy - s * 1.1);
    ctx.lineTo(sx + s * 0.4, sy - s * 0.6);
    ctx.lineTo(sx + s * 0.9, sy - s * 0.2);
    ctx.lineTo(sx + s * 0.6, sy + s * 0.4);
    ctx.closePath();
    ctx.fill();

    // Bright crystal facet
    ctx.fillStyle = '#e0d050';
    ctx.beginPath();
    ctx.moveTo(sx - s * 0.1, sy - s * 0.8);
    ctx.lineTo(sx + s * 0.3, sy - s * 0.5);
    ctx.lineTo(sx + s * 0.1, sy - s * 0.1);
    ctx.lineTo(sx - s * 0.3, sy - s * 0.3);
    ctx.closePath();
    ctx.fill();

    // Glow highlight
    ctx.fillStyle = 'rgba(255,240,100,0.2)';
    ctx.beginPath();
    ctx.arc(sx, sy - s * 0.4, s * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Outline
    ctx.strokeStyle = '#8a7a20';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx - s * 0.8, sy + s * 0.3);
    ctx.lineTo(sx - s * 0.6, sy - s * 0.5);
    ctx.lineTo(sx - s * 0.1, sy - s * 1.1);
    ctx.lineTo(sx + s * 0.4, sy - s * 0.6);
    ctx.lineTo(sx + s * 0.9, sy - s * 0.2);
    ctx.lineTo(sx + s * 0.6, sy + s * 0.4);
    ctx.closePath();
    ctx.stroke();
  }

  // ── Animals ──
  function drawAnimal(ctx, sx, sy, e) {
    const at = e.at;
    const color = ANIMAL_COLORS[at] || '#888';
    const facing = e.a || 0;

    ctx.save();

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    const shadowSize = at === ANIMAL_TYPE.BEAR ? 14 : at === ANIMAL_TYPE.WOLF ? 10 : 8;
    ctx.beginPath();
    ctx.ellipse(sx, sy + shadowSize * 0.4, shadowSize * 0.8, shadowSize * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(sx, sy);
    ctx.rotate(facing);

    if (at === ANIMAL_TYPE.DEER) {
      drawDeer(ctx, color);
    } else if (at === ANIMAL_TYPE.BOAR) {
      drawBoar(ctx, color);
    } else if (at === ANIMAL_TYPE.WOLF) {
      drawWolf(ctx, color);
    } else if (at === ANIMAL_TYPE.BEAR) {
      drawBear(ctx, color);
    }

    ctx.restore();
  }

  function drawDeer(ctx, color) {
    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a5a30';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Head
    ctx.fillStyle = '#c09060';
    ctx.beginPath();
    ctx.ellipse(7, 0, 3.5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Antlers
    ctx.strokeStyle = '#8a6a40';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(8, -2);
    ctx.lineTo(10, -5);
    ctx.lineTo(12, -4);
    ctx.moveTo(10, -5);
    ctx.lineTo(10, -7);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8, 2);
    ctx.lineTo(10, 5);
    ctx.lineTo(12, 4);
    ctx.moveTo(10, 5);
    ctx.lineTo(10, 7);
    ctx.stroke();

    // Eye
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(9, -1, 0.8, 0, Math.PI * 2);
    ctx.fill();

    // White tail spot
    ctx.fillStyle = '#e8d8c0';
    ctx.beginPath();
    ctx.arc(-7, 0, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBoar(ctx, color) {
    // Body (rounder, stockier)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4a3020';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Head
    ctx.fillStyle = '#7a5a40';
    ctx.beginPath();
    ctx.ellipse(6, 0, 3.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Snout
    ctx.fillStyle = '#9a7a60';
    ctx.beginPath();
    ctx.ellipse(9, 0, 2, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tusks
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(9, -1.5);
    ctx.lineTo(11, -3);
    ctx.moveTo(9, 1.5);
    ctx.lineTo(11, 3);
    ctx.stroke();

    // Eye
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(7, -1.5, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawWolf(ctx, color) {
    // Body (sleek)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#404040';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Head (pointed)
    ctx.fillStyle = '#707070';
    ctx.beginPath();
    ctx.moveTo(7, -3);
    ctx.lineTo(12, 0);
    ctx.lineTo(7, 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Ears
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.moveTo(7, -3);
    ctx.lineTo(8, -6);
    ctx.lineTo(9, -3);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(7, 3);
    ctx.lineTo(8, 6);
    ctx.lineTo(9, 3);
    ctx.closePath();
    ctx.fill();

    // Eye (menacing)
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.arc(9, -1, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(9, -1, 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Tail
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.quadraticCurveTo(-11, -3, -10, -5);
    ctx.stroke();
  }

  function drawBear(ctx, color) {
    // Body (large, round)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2a1810';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Head
    ctx.fillStyle = '#5a3828';
    ctx.beginPath();
    ctx.arc(11, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Ears
    ctx.fillStyle = '#3a2818';
    ctx.beginPath();
    ctx.arc(10, -5, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(10, 5, 2, 0, Math.PI * 2);
    ctx.fill();

    // Snout
    ctx.fillStyle = '#7a5a40';
    ctx.beginPath();
    ctx.ellipse(14, 0, 2.5, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(12, -2, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(12, 2, 1, 0, Math.PI * 2);
    ctx.fill();

    // Claws at front (subtle)
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 0.5;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(16, i * 2);
      ctx.lineTo(17.5, i * 2);
      ctx.stroke();
    }
  }

  // ── World Items ──
  function drawWorldItem(ctx, sx, sy, e) {
    const pulse = 0.7 + Math.sin(animTime * 0.005 + (e.eid || 0)) * 0.3;

    // Subtle glow
    ctx.fillStyle = `rgba(255, 215, 0, ${0.1 * pulse})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 8, 0, Math.PI * 2);
    ctx.fill();

    // Item dot with color based on category
    const def = ITEM_DEFS[e.itemId];
    let color = '#ffd700';
    if (def) {
      if (def.cat === 'resource') color = '#88cc44';
      else if (def.cat === 'tool') color = '#aaa';
      else if (def.cat === 'melee') color = '#cc8844';
      else if (def.cat === 'ranged') color = '#8888cc';
      else if (def.cat === 'ammo') color = '#ccaa44';
      else if (def.cat === 'food') color = '#cc6644';
      else if (def.cat === 'medical') color = '#44cc66';
    }

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(sx, sy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Inner highlight
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(sx - 1, sy - 1, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Label
    if (def) {
      ctx.fillStyle = '#fff';
      ctx.font = '7px monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 2;
      ctx.fillText(`${def.name} x${e.qty}`, sx, sy + 11);
      ctx.shadowBlur = 0;
    }
  }

  // ── Projectiles ──
  function drawProjectile(ctx, sx, sy, e) {
    const angle = e.a || 0;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(angle);

    // Trail
    ctx.fillStyle = 'rgba(255,255,100,0.3)';
    ctx.beginPath();
    ctx.moveTo(-8, -1);
    ctx.lineTo(0, 0);
    ctx.lineTo(-8, 1);
    ctx.closePath();
    ctx.fill();

    // Projectile body
    ctx.fillStyle = '#ffee44';
    ctx.beginPath();
    ctx.ellipse(0, 0, 3, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ── Structures ──
  function drawStructure(ctx, sx, sy, e) {
    const size = viewScale * 0.9;
    const tier = e.tier || 0;
    const st = e.st;

    const tierColors = {
      0: { fill: '#7a6845', stroke: '#5a4a30', detail: '#6a5835' },  // twig
      1: { fill: '#8b6914', stroke: '#6a5010', detail: '#7a5a12' },  // wood
      2: { fill: '#808080', stroke: '#555', detail: '#707070' },       // stone
      3: { fill: '#6a6a70', stroke: '#444', detail: '#5a5a60' },       // metal
    };
    const tc = tierColors[tier] || tierColors[0];

    ctx.save();

    if (st === STRUCT_TYPE.FOUNDATION) {
      // Filled rectangle with cross-hatch
      ctx.fillStyle = tc.fill;
      ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
      // Cross pattern
      ctx.strokeStyle = tc.detail;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(sx - size / 2, sy);
      ctx.lineTo(sx + size / 2, sy);
      ctx.moveTo(sx, sy - size / 2);
      ctx.lineTo(sx, sy + size / 2);
      ctx.stroke();
      ctx.strokeStyle = tc.stroke;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(sx - size / 2, sy - size / 2, size, size);
    } else if (st === STRUCT_TYPE.WALL) {
      // Thick wall line
      ctx.fillStyle = tc.fill;
      const wallThick = size * 0.2;
      ctx.fillRect(sx - size / 2, sy - wallThick / 2, size, wallThick);
      // Texture
      if (tier === 1) {
        // Wood grain
        ctx.strokeStyle = '#5a3a0a';
        ctx.lineWidth = 0.3;
        for (let i = 0; i < 3; i++) {
          const yOff = -wallThick / 2 + wallThick * (i + 0.5) / 3;
          ctx.beginPath();
          ctx.moveTo(sx - size / 2 + 2, sy + yOff);
          ctx.lineTo(sx + size / 2 - 2, sy + yOff);
          ctx.stroke();
        }
      } else if (tier === 2) {
        // Stone block lines
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(sx - size * 0.15, sy - wallThick / 2);
        ctx.lineTo(sx - size * 0.15, sy + wallThick / 2);
        ctx.moveTo(sx + size * 0.15, sy - wallThick / 2);
        ctx.lineTo(sx + size * 0.15, sy + wallThick / 2);
        ctx.stroke();
      } else if (tier === 3) {
        // Metal rivets
        ctx.fillStyle = '#888';
        const rivetY = sy;
        for (let rx = -2; rx <= 2; rx++) {
          ctx.beginPath();
          ctx.arc(sx + rx * size * 0.18, rivetY, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.strokeStyle = tc.stroke;
      ctx.lineWidth = 1;
      ctx.strokeRect(sx - size / 2, sy - wallThick / 2, size, wallThick);
    } else if (st === STRUCT_TYPE.DOORWAY) {
      // Wall with gap
      const wallThick = size * 0.2;
      const gapSize = size * 0.35;
      ctx.fillStyle = tc.fill;
      ctx.fillRect(sx - size / 2, sy - wallThick / 2, (size - gapSize) / 2, wallThick);
      ctx.fillRect(sx + gapSize / 2, sy - wallThick / 2, (size - gapSize) / 2, wallThick);
      ctx.strokeStyle = tc.stroke;
      ctx.lineWidth = 1;
      ctx.strokeRect(sx - size / 2, sy - wallThick / 2, (size - gapSize) / 2, wallThick);
      ctx.strokeRect(sx + gapSize / 2, sy - wallThick / 2, (size - gapSize) / 2, wallThick);
    } else if (st === STRUCT_TYPE.DOOR) {
      // Door (looks openable)
      const wallThick = size * 0.15;
      const doorColor = tier === 3 ? '#5a5a60' : '#7a5a14';
      ctx.fillStyle = doorColor;
      ctx.fillRect(sx - size * 0.15, sy - wallThick / 2, size * 0.3, wallThick);
      // Handle
      ctx.fillStyle = '#aa8800';
      ctx.beginPath();
      ctx.arc(sx + size * 0.1, sy, 1.5, 0, Math.PI * 2);
      ctx.fill();
      // Open state indicator
      if (e.open) {
        ctx.strokeStyle = 'rgba(100,255,100,0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx - size * 0.15, sy - wallThick / 2, size * 0.3, wallThick);
      }
    } else {
      // Fallback
      ctx.fillStyle = tc.fill;
      ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
      ctx.strokeStyle = tc.stroke;
      ctx.lineWidth = 1;
      ctx.strokeRect(sx - size / 2, sy - size / 2, size, size);
    }

    ctx.restore();
  }

  // ── Deployables ──
  function drawCampfire(ctx, sx, sy, e) {
    // Stone ring
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, 8, 0, Math.PI * 2);
    ctx.stroke();

    // Inner dark area
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.arc(sx, sy, 6, 0, Math.PI * 2);
    ctx.fill();

    // Logs
    ctx.strokeStyle = '#5a3a1a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx - 4, sy - 2);
    ctx.lineTo(sx + 4, sy + 2);
    ctx.moveTo(sx - 4, sy + 2);
    ctx.lineTo(sx + 4, sy - 2);
    ctx.stroke();

    // Flame (animated)
    const t = animTime * 0.01;
    const flicker1 = Math.sin(t) * 1.5;
    const flicker2 = Math.cos(t * 1.3) * 1;

    // Outer flame
    ctx.fillStyle = '#ff6600';
    ctx.beginPath();
    ctx.moveTo(sx - 3, sy + 1);
    ctx.quadraticCurveTo(sx + flicker1, sy - 6, sx + 1, sy + 1);
    ctx.fill();

    // Inner flame
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.moveTo(sx - 1.5, sy);
    ctx.quadraticCurveTo(sx + flicker2, sy - 4, sx + 0.5, sy);
    ctx.fill();

    // Glow
    const glowAlpha = 0.06 + Math.sin(t * 0.8) * 0.02;
    const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, 50);
    gradient.addColorStop(0, `rgba(255, 150, 50, ${glowAlpha})`);
    gradient.addColorStop(1, 'rgba(255, 150, 50, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(sx - 50, sy - 50, 100, 100);
  }

  function drawFurnace(ctx, sx, sy, e) {
    // Body
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.moveTo(sx - 8, sy + 6);
    ctx.lineTo(sx - 6, sy - 8);
    ctx.lineTo(sx + 6, sy - 8);
    ctx.lineTo(sx + 8, sy + 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Opening
    ctx.fillStyle = '#2a0a0a';
    ctx.fillRect(sx - 3, sy - 2, 6, 5);

    // Glow from opening
    ctx.fillStyle = 'rgba(255, 80, 20, 0.4)';
    ctx.fillRect(sx - 2, sy - 1, 4, 3);

    // Top smoke hint
    ctx.fillStyle = 'rgba(100,100,100,0.2)';
    const smokeY = sy - 10 - Math.sin(animTime * 0.003) * 2;
    ctx.beginPath();
    ctx.arc(sx, smokeY, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawWorkbench(ctx, sx, sy, e) {
    // Table top
    ctx.fillStyle = '#7a5a1a';
    ctx.fillRect(sx - 9, sy - 5, 18, 10);
    ctx.strokeStyle = '#5a4010';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx - 9, sy - 5, 18, 10);

    // Legs
    ctx.fillStyle = '#5a3a0a';
    ctx.fillRect(sx - 8, sy + 4, 2, 4);
    ctx.fillRect(sx + 6, sy + 4, 2, 4);

    // Surface detail (tools)
    ctx.fillStyle = '#888';
    ctx.fillRect(sx - 4, sy - 3, 3, 1.5);
    ctx.fillStyle = '#6a4a0a';
    ctx.fillRect(sx + 1, sy - 2, 4, 1);

    // Label
    ctx.fillStyle = '#ddd';
    ctx.font = '6px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('WB', sx, sy + 2);
  }

  function drawToolCupboard(ctx, sx, sy, e) {
    // Cabinet shape
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(sx - 6, sy - 8, 12, 16);
    ctx.strokeStyle = '#3a2a0a';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx - 6, sy - 8, 12, 16);

    // Door panels
    ctx.strokeStyle = '#4a2a0a';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(sx - 5, sy - 7, 4.5, 14);
    ctx.strokeRect(sx + 0.5, sy - 7, 4.5, 14);

    // Handles
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.arc(sx - 1.5, sy, 0.8, 0, Math.PI * 2);
    ctx.arc(sx + 1.5, sy, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSleepingBag(ctx, sx, sy, e) {
    // Bag shape
    ctx.fillStyle = '#aa3333';
    ctx.beginPath();
    ctx.ellipse(sx, sy, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#882222';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Pillow area
    ctx.fillStyle = '#cc5555';
    ctx.beginPath();
    ctx.ellipse(sx + 5, sy, 3, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Zipper line
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(sx - 7, sy);
    ctx.lineTo(sx + 3, sy);
    ctx.stroke();
  }

  function drawStorageBox(ctx, sx, sy, e) {
    // Wooden box
    ctx.fillStyle = '#7a5a2a';
    ctx.fillRect(sx - 10, sy - 7, 20, 14);
    ctx.strokeStyle = '#4a3a1a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sx - 10, sy - 7, 20, 14);

    // Lid line
    ctx.strokeStyle = '#5a4a2a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx - 9, sy - 2);
    ctx.lineTo(sx + 9, sy - 2);
    ctx.stroke();

    // Metal latch
    ctx.fillStyle = '#888';
    ctx.fillRect(sx - 2, sy - 4, 4, 3);
  }

  function drawBarrel(ctx, sx, sy, e) {
    // Wooden barrel shape
    ctx.fillStyle = '#6a5030';
    ctx.beginPath();
    ctx.ellipse(sx, sy, 7, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4a3520';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Metal bands
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(sx, sy - 4, 6.5, 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(sx, sy + 4, 6.5, 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Wood grain
    ctx.strokeStyle = 'rgba(40,25,10,0.3)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(sx - 3, sy - 8);
    ctx.lineTo(sx - 3, sy + 8);
    ctx.moveTo(sx + 3, sy - 8);
    ctx.lineTo(sx + 3, sy + 8);
    ctx.stroke();
  }

  function drawLootBag(ctx, sx, sy, e) {
    // Burlap sack shape
    ctx.fillStyle = '#8a7a5a';
    ctx.beginPath();
    ctx.moveTo(sx - 7, sy + 5);
    ctx.quadraticCurveTo(sx - 9, sy - 2, sx - 4, sy - 7);
    ctx.quadraticCurveTo(sx, sy - 9, sx + 4, sy - 7);
    ctx.quadraticCurveTo(sx + 9, sy - 2, sx + 7, sy + 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#5a4a3a';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Tie at top
    ctx.strokeStyle = '#6a5a3a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx - 3, sy - 6);
    ctx.lineTo(sx, sy - 8);
    ctx.lineTo(sx + 3, sy - 6);
    ctx.stroke();
    // Texture lines
    ctx.strokeStyle = 'rgba(60,50,30,0.3)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(sx - 4, sy - 2);
    ctx.lineTo(sx + 4, sy - 2);
    ctx.moveTo(sx - 5, sy + 2);
    ctx.lineTo(sx + 5, sy + 2);
    ctx.stroke();
  }

  return {
    render,
    resetEventIndex() { lastEventIdx = 0; },
  };
}
