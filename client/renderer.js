import { ENTITY_TYPE } from '../shared/protocol.js';
import { BIOME, TILE_SIZE, ITEM, ITEM_DEFS, RESOURCE_TYPE, ANIMAL_TYPE } from '../shared/constants.js';

const BIOME_COLORS = {
  [BIOME.BEACH]: '#e8d68e',
  [BIOME.GRASSLAND]: '#5a8f3c',
  [BIOME.FOREST]: '#2d5a1e',
  [BIOME.DESERT]: '#c4a35a',
  [BIOME.SNOW]: '#dde8f0',
  [BIOME.MOUNTAIN]: '#7a7a7a',
};

const RESOURCE_COLORS = {
  [RESOURCE_TYPE.TREE]: '#1a4d0a',
  [RESOURCE_TYPE.STONE_NODE]: '#808080',
  [RESOURCE_TYPE.METAL_NODE]: '#b87333',
  [RESOURCE_TYPE.SULFUR_NODE]: '#d4c84a',
  [RESOURCE_TYPE.HEMP]: '#4a8a2a',
};

const ANIMAL_COLORS = {
  [ANIMAL_TYPE.DEER]: '#b08050',
  [ANIMAL_TYPE.BOAR]: '#6a4a3a',
  [ANIMAL_TYPE.WOLF]: '#606060',
  [ANIMAL_TYPE.BEAR]: '#4a3020',
};

export function createRenderer(canvas, state) {
  const ctx = canvas.getContext('2d');
  let viewScale = 24; // pixels per tile

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  // Pre-render biome chunks for performance
  let biomeCanvas = null;
  let biomeCtx = null;
  const CHUNK_SIZE = 64; // tiles per chunk
  let biomeChunks = new Map();

  function renderBiomeChunk(chunkX, chunkY) {
    const key = `${chunkX},${chunkY}`;
    if (biomeChunks.has(key)) return biomeChunks.get(key);
    if (!state.biomeMap) return null;

    const chunkCanvas = document.createElement('canvas');
    chunkCanvas.width = CHUNK_SIZE;
    chunkCanvas.height = CHUNK_SIZE;
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
        cctx.fillStyle = BIOME_COLORS[biome] || '#333';
        cctx.fillRect(x, y, 1, 1);
      }
    }

    biomeChunks.set(key, chunkCanvas);
    // Limit cache size
    if (biomeChunks.size > 100) {
      const first = biomeChunks.keys().next().value;
      biomeChunks.delete(first);
    }
    return chunkCanvas;
  }

  function render(dt) {
    const w = canvas.width;
    const h = canvas.height;

    // Get camera position (centered on player)
    let camX = 0, camY = 0;
    const me = state.myEid ? state.entities.get(state.myEid) : null;
    if (me) {
      camX = me.x;
      camY = me.y;
    }

    ctx.clearRect(0, 0, w, h);

    // Apply day/night lighting
    const light = state.lightLevel;

    // ── Draw terrain ──
    const tilesX = Math.ceil(w / viewScale) + 2;
    const tilesY = Math.ceil(h / viewScale) + 2;
    const startTileX = Math.floor(camX / TILE_SIZE - tilesX / 2);
    const startTileY = Math.floor(camY / TILE_SIZE - tilesY / 2);

    // Draw biome chunks
    if (state.biomeMap) {
      const startChunkX = Math.floor(startTileX / CHUNK_SIZE);
      const startChunkY = Math.floor(startTileY / CHUNK_SIZE);
      const endChunkX = Math.ceil((startTileX + tilesX) / CHUNK_SIZE);
      const endChunkY = Math.ceil((startTileY + tilesY) / CHUNK_SIZE);

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
    } else {
      ctx.fillStyle = '#333';
      ctx.fillRect(0, 0, w, h);
    }

    // ── Draw entities ──
    // Sort by y for depth
    const sortedEntities = [...state.entities.values()].sort((a, b) => (a.y || 0) - (b.y || 0));

    for (const e of sortedEntities) {
      const ex = e.eid === state.myEid ? e.x : (e.renderX || e.x);
      const ey = e.eid === state.myEid ? e.y : (e.renderY || e.y);
      const sx = (ex - camX) * viewScale / TILE_SIZE + w / 2;
      const sy = (ey - camY) * viewScale / TILE_SIZE + h / 2;

      // Skip if off screen
      if (sx < -50 || sx > w + 50 || sy < -50 || sy > h + 50) continue;

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
        drawDeployable(ctx, sx, sy, '#e85a1c', 'CF');
      } else if (type === ENTITY_TYPE.FURNACE) {
        drawDeployable(ctx, sx, sy, '#666', 'FN');
      } else if (type === ENTITY_TYPE.WORKBENCH) {
        drawDeployable(ctx, sx, sy, '#8b6914', 'WB');
      } else if (type === ENTITY_TYPE.TOOL_CUPBOARD) {
        drawDeployable(ctx, sx, sy, '#5a3a1a', 'TC');
      } else if (type === ENTITY_TYPE.SLEEPING_BAG) {
        drawDeployable(ctx, sx, sy, '#c44', 'SB');
      }

      // Health bar for entities with HP (not the local player - that's in UI)
      if (e.hp !== undefined && e.mhp && e.eid !== state.myEid && e.hp < e.mhp) {
        const barW = 30;
        const barH = 4;
        const pct = e.hp / e.mhp;
        ctx.fillStyle = '#300';
        ctx.fillRect(sx - barW / 2, sy - 22, barW, barH);
        ctx.fillStyle = pct > 0.5 ? '#0a0' : pct > 0.25 ? '#aa0' : '#a00';
        ctx.fillRect(sx - barW / 2, sy - 22, barW * pct, barH);
      }
    }

    // ── Night overlay ──
    if (light < 1.0) {
      ctx.fillStyle = `rgba(0, 0, 20, ${1 - light})`;
      ctx.fillRect(0, 0, w, h);

      // Torch/campfire light circles
      if (me) {
        const heldItem = state.inventory[state.selectedSlot]?.id;
        if (heldItem === ITEM.TORCH) {
          const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, 150);
          gradient.addColorStop(0, 'rgba(255, 200, 100, 0.3)');
          gradient.addColorStop(1, 'rgba(255, 200, 100, 0)');
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, w, h);
        }
      }
    }
  }

  function drawPlayer(ctx, sx, sy, e, isLocal) {
    const radius = 10;
    ctx.save();

    // Body
    ctx.fillStyle = isLocal ? '#3a8fd6' : '#d6553a';
    if (e.dead) ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Direction indicator
    if (e.a !== undefined) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(e.a) * radius * 1.5, sy + Math.sin(e.a) * radius * 1.5);
      ctx.stroke();
    }

    // Held item indicator
    if (e.held && e.held !== ITEM.NONE) {
      const def = ITEM_DEFS[e.held];
      if (def) {
        ctx.fillStyle = '#fff';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(def.name.substring(0, 6), sx, sy + radius + 12);
      }
    }

    ctx.restore();
  }

  function drawResourceNode(ctx, sx, sy, e) {
    const rt = e.rt;
    const color = RESOURCE_COLORS[rt] || '#888';
    const depleted = e.rem <= 0;

    ctx.save();
    ctx.globalAlpha = depleted ? 0.3 : 1.0;

    if (rt === RESOURCE_TYPE.TREE) {
      // Tree: circle canopy
      ctx.fillStyle = '#3a2010';
      ctx.fillRect(sx - 2, sy - 2, 4, 10);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(sx, sy - 6, 8, 0, Math.PI * 2);
      ctx.fill();
    } else if (rt === RESOURCE_TYPE.HEMP) {
      // Hemp: small green
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Rock/ore: polygon
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(sx - 7, sy + 4);
      ctx.lineTo(sx - 4, sy - 6);
      ctx.lineTo(sx + 5, sy - 5);
      ctx.lineTo(sx + 7, sy + 3);
      ctx.lineTo(sx + 2, sy + 6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawWorldItem(ctx, sx, sy, e) {
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(sx, sy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#aa8800';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Item name
    const def = ITEM_DEFS[e.itemId];
    if (def) {
      ctx.fillStyle = '#fff';
      ctx.font = '7px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${def.name} x${e.qty}`, sx, sy + 10);
    }
  }

  function drawProjectile(ctx, sx, sy, e) {
    ctx.fillStyle = '#ff0';
    ctx.beginPath();
    ctx.arc(sx, sy, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawStructure(ctx, sx, sy, e) {
    const size = viewScale * 0.9;
    const tier = e.tier || 0;
    const colors = ['#8b7355', '#9e8c6c', '#888', '#aaa'];
    ctx.fillStyle = colors[tier] || '#8b7355';
    ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx - size / 2, sy - size / 2, size, size);

    // Type label
    const labels = { 1: 'F', 2: 'W', 3: 'D', 4: 'Dr', 5: 'C', 6: 'St', 7: 'Wn' };
    ctx.fillStyle = '#222';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(labels[e.st] || '?', sx, sy + 3);
  }

  function drawAnimal(ctx, sx, sy, e) {
    const at = e.at;
    const color = ANIMAL_COLORS[at] || '#888';
    const size = at === ANIMAL_TYPE.BEAR ? 12 : at === ANIMAL_TYPE.WOLF ? 8 : 7;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(sx, sy, size, size * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(sx - 2, sy - 2, 1.5, 0, Math.PI * 2);
    ctx.arc(sx + 2, sy - 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawDeployable(ctx, sx, sy, color, label) {
    ctx.fillStyle = color;
    ctx.fillRect(sx - 8, sy - 8, 16, 16);
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx - 8, sy - 8, 16, 16);
    ctx.fillStyle = '#fff';
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, sx, sy + 3);
  }

  return { render };
}
