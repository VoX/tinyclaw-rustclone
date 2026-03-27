import { BIOME } from '../../shared/constants.js';

export const BIOME_COLORS = {
  [BIOME.BEACH]:     '#e8d68e',
  [BIOME.GRASSLAND]: '#5a8f3c',
  [BIOME.FOREST]:    '#2d5a1e',
  [BIOME.DESERT]:    '#c4a35a',
  [BIOME.SNOW]:      '#dde8f0',
  [BIOME.MOUNTAIN]:  '#7a7a7a',
  [BIOME.WATER]:     '#2850a0',
  [BIOME.ROAD]:      '#8a7a5a',
};

export function seededRand(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 1274126177) | 0;
  h = ((h ^ (h >> 13)) * 1103515245) | 0;
  return ((h & 0x7fffffff) / 0x7fffffff);
}

const CHUNK_SIZE = 64;

export function createTerrainRenderer(state) {
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

        // Biome edge blending: soften transitions to adjacent biomes
        {
          const bx = x * DETAIL;
          const by = y * DETAIL;
          if (tx > 0 && ty > 0 && tx < ws - 1 && ty < ws - 1) {
            const neighbors = [
              { dx: -1, dy: 0, edge: 'left' },
              { dx: 1, dy: 0, edge: 'right' },
              { dx: 0, dy: -1, edge: 'top' },
              { dx: 0, dy: 1, edge: 'bottom' },
            ];
            for (const n of neighbors) {
              const nb = state.biomeMap[(ty + n.dy) * ws + (tx + n.dx)];
              if (nb !== biome) {
                const nColor = BIOME_COLORS[nb] || '#333';
                cctx.fillStyle = nColor;
                cctx.globalAlpha = 0.25;
                if (n.edge === 'left') cctx.fillRect(bx, by, 1, DETAIL);
                else if (n.edge === 'right') cctx.fillRect(bx + DETAIL - 1, by, 1, DETAIL);
                else if (n.edge === 'top') cctx.fillRect(bx, by, DETAIL, 1);
                else if (n.edge === 'bottom') cctx.fillRect(bx, by + DETAIL - 1, DETAIL, 1);
                cctx.globalAlpha = 1;
              }
            }
          }
        }

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

  function drawTerrain(ctx, w, h, camX, camY, viewScale) {
    const tilesX = Math.ceil(w / viewScale) + 2;
    const tilesY = Math.ceil(h / viewScale) + 2;
    const startTileX = Math.floor(camX / 2 - tilesX / 2);
    const startTileY = Math.floor(camY / 2 - tilesY / 2);

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

          const screenX = (cx * CHUNK_SIZE * 2 - camX) * viewScale / 2 + w / 2;
          const screenY = (cy * CHUNK_SIZE * 2 - camY) * viewScale / 2 + h / 2;
          const size = CHUNK_SIZE * viewScale;

          ctx.drawImage(chunk, screenX, screenY, size, size);
        }
      }
      ctx.imageSmoothingEnabled = true;
    } else {
      ctx.fillStyle = '#333';
      ctx.fillRect(0, 0, w, h);
    }
  }

  // ── Environment decorations (client-only, seeded from biome) ──
  function drawDecorations(ctx, w, h, camX, camY, viewScale) {
    if (!state.biomeMap) return;
    const ws = state.worldSize;
    const ts = 2; // TILE_SIZE
    const tilesX = Math.ceil(w / viewScale) + 4;
    const tilesY = Math.ceil(h / viewScale) + 4;
    const startTX = Math.floor(camX / ts - tilesX / 2);
    const startTY = Math.floor(camY / ts - tilesY / 2);

    for (let dy = 0; dy < tilesY; dy += 2) {
      for (let dx = 0; dx < tilesX; dx += 2) {
        const tx = startTX + dx;
        const ty = startTY + dy;
        if (tx < 0 || ty < 0 || tx >= ws || ty >= ws) continue;

        const biome = state.biomeMap[ty * ws + tx];
        const r = seededRand(tx, ty, 777);
        if (r > 0.12) continue; // ~6% of tiles get a decoration

        const r2 = seededRand(tx, ty, 888);
        const r3 = seededRand(tx, ty, 999);
        const ox = (r2 - 0.5) * ts * 0.8;
        const oy = (r3 - 0.5) * ts * 0.8;
        const sx = ((tx * ts + ts / 2 + ox) - camX) * viewScale / ts + w / 2;
        const sy = ((ty * ts + ts / 2 + oy) - camY) * viewScale / ts + h / 2;

        if (sx < -20 || sx > w + 20 || sy < -20 || sy > h + 20) continue;

        const sc = viewScale / 24; // scale relative to default zoom

        if (biome === BIOME.GRASSLAND) {
          // Flowers
          const colors = ['#e44', '#e8e', '#ff0', '#f80', '#88f'];
          const col = colors[Math.floor(r2 * colors.length)];
          ctx.fillStyle = col;
          ctx.globalAlpha = 0.7;
          ctx.beginPath();
          ctx.arc(sx, sy, 2 * sc, 0, Math.PI * 2);
          ctx.fill();
          // Petal hint
          ctx.fillStyle = '#fff';
          ctx.globalAlpha = 0.3;
          ctx.beginPath();
          ctx.arc(sx - sc, sy - sc, 1 * sc, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        } else if (biome === BIOME.FOREST) {
          // Mushrooms
          ctx.fillStyle = '#a03020';
          ctx.globalAlpha = 0.6;
          ctx.beginPath();
          ctx.arc(sx, sy - 1.5 * sc, 2.5 * sc, Math.PI, 0);
          ctx.fill();
          // Stem
          ctx.fillStyle = '#ddc';
          ctx.fillRect(sx - 0.8 * sc, sy - 1.5 * sc, 1.6 * sc, 2.5 * sc);
          // White dots
          ctx.fillStyle = '#fff';
          ctx.globalAlpha = 0.4;
          ctx.beginPath();
          ctx.arc(sx - 0.5 * sc, sy - 2 * sc, 0.5 * sc, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(sx + 1 * sc, sy - 1.8 * sc, 0.4 * sc, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        } else if (biome === BIOME.DESERT) {
          // Cactus
          ctx.fillStyle = '#3a7a2a';
          ctx.globalAlpha = 0.65;
          ctx.fillRect(sx - 1 * sc, sy - 4 * sc, 2 * sc, 5 * sc);
          // Arms
          ctx.fillRect(sx - 3 * sc, sy - 3 * sc, 2 * sc, 1.2 * sc);
          ctx.fillRect(sx - 3 * sc, sy - 3 * sc, 1.2 * sc, 2 * sc);
          ctx.fillRect(sx + 1 * sc, sy - 2 * sc, 2 * sc, 1.2 * sc);
          ctx.fillRect(sx + 1.8 * sc, sy - 2 * sc, 1.2 * sc, 2 * sc);
          ctx.globalAlpha = 1;
        } else if (biome === BIOME.MOUNTAIN || biome === BIOME.BEACH || biome === BIOME.SNOW) {
          // Small rocks
          ctx.fillStyle = biome === BIOME.SNOW ? '#bbc' : (biome === BIOME.BEACH ? '#c8b888' : '#666');
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.ellipse(sx, sy, 2 * sc, 1.2 * sc, r2 * Math.PI, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  return { drawTerrain, drawDecorations };
}
