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
  let decoChunks = new Map();
  const CAM_MOVE_THRESHOLD = 0.5; // tiles of camera movement before redraw

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
          // Cliff edge visual: dark shadow line when mountain borders non-mountain
          if (tx > 0 && ty > 0 && tx < ws - 1 && ty < ws - 1) {
            const below = state.biomeMap[(ty + 1) * ws + tx];
            const right = state.biomeMap[ty * ws + (tx + 1)];
            if (below !== BIOME.MOUNTAIN && below !== BIOME.SNOW) {
              // Bottom cliff edge — dark shadow
              cctx.fillStyle = 'rgba(30,25,20,0.5)';
              cctx.fillRect(px, py + DETAIL - 1, DETAIL, 1);
              cctx.fillStyle = 'rgba(50,45,40,0.3)';
              cctx.fillRect(px, py + DETAIL - 2, DETAIL, 1);
            }
            if (right !== BIOME.MOUNTAIN && right !== BIOME.SNOW) {
              cctx.fillStyle = 'rgba(30,25,20,0.4)';
              cctx.fillRect(px + DETAIL - 1, py, 1, DETAIL);
            }
            const above = state.biomeMap[(ty - 1) * ws + tx];
            if (above !== BIOME.MOUNTAIN && above !== BIOME.SNOW) {
              // Top cliff edge — light highlight
              cctx.fillStyle = 'rgba(200,200,200,0.2)';
              cctx.fillRect(px, py, DETAIL, 1);
            }
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
    if (biomeChunks.size > 150) {
      const first = biomeChunks.keys().next().value;
      biomeChunks.delete(first);
    }
    return chunkCanvas;
  }

  function renderDecoChunk(chunkX, chunkY, viewScale) {
    const key = `${chunkX},${chunkY}`;
    if (decoChunks.has(key)) return decoChunks.get(key);
    if (!state.biomeMap) return null;

    const ws = state.worldSize;
    const ts = 2;
    const DECO_PX = CHUNK_SIZE * 4; // match biome chunk resolution
    const decoCanvas = document.createElement('canvas');
    decoCanvas.width = DECO_PX;
    decoCanvas.height = DECO_PX;
    const dctx = decoCanvas.getContext('2d');

    const startTX = chunkX * CHUNK_SIZE;
    const startTY = chunkY * CHUNK_SIZE;
    const sc = 4 / 24 * (viewScale || 24); // relative scale

    for (let dy = 0; dy < CHUNK_SIZE; dy += 2) {
      for (let dx = 0; dx < CHUNK_SIZE; dx += 2) {
        const tx = startTX + dx;
        const ty = startTY + dy;
        if (tx < 0 || ty < 0 || tx >= ws || ty >= ws) continue;

        const biome = state.biomeMap[ty * ws + tx];
        const r = seededRand(tx, ty, 777);
        if (r > 0.12) continue;

        const r2 = seededRand(tx, ty, 888);
        const r3 = seededRand(tx, ty, 999);
        const ox = (r2 - 0.5) * ts * 0.8;
        const oy = (r3 - 0.5) * ts * 0.8;
        // Position relative to chunk canvas
        const sx = (dx + 0.5 + ox / ts) * 4;
        const sy = (dy + 0.5 + oy / ts) * 4;

        const s = 4 / 24 * 24; // normalized scale

        if (biome === BIOME.GRASSLAND) {
          const colors = ['#e44', '#e8e', '#ff0', '#f80', '#88f'];
          const col = colors[Math.floor(r2 * colors.length)];
          dctx.fillStyle = col;
          dctx.globalAlpha = 0.7;
          dctx.beginPath();
          dctx.arc(sx, sy, 2 * s / 24, 0, Math.PI * 2);
          dctx.fill();
          dctx.fillStyle = '#fff';
          dctx.globalAlpha = 0.3;
          dctx.beginPath();
          dctx.arc(sx - s / 24, sy - s / 24, 1 * s / 24, 0, Math.PI * 2);
          dctx.fill();
          dctx.globalAlpha = 1;
        } else if (biome === BIOME.FOREST) {
          const s2 = s / 24;
          const logSeed = seededRand(tx, ty, 3456);
          if (logSeed < 0.3) {
            // Fallen log: horizontal trunk with bark detail
            const logAngle = r2 * Math.PI;
            dctx.save();
            dctx.translate(sx, sy);
            dctx.rotate(logAngle);
            dctx.globalAlpha = 0.65;
            // Trunk
            dctx.fillStyle = '#5a3a1a';
            dctx.fillRect(-5 * s2, -1 * s2, 10 * s2, 2 * s2);
            // Bark detail
            dctx.fillStyle = '#4a2a10';
            dctx.fillRect(-4 * s2, -1 * s2, 1 * s2, 2 * s2);
            dctx.fillRect(-1 * s2, -1 * s2, 1 * s2, 2 * s2);
            dctx.fillRect(2 * s2, -1 * s2, 1 * s2, 2 * s2);
            // Cross-section circle at one end
            dctx.fillStyle = '#8a6a3a';
            dctx.beginPath();
            dctx.arc(5 * s2, 0, 1.2 * s2, 0, Math.PI * 2);
            dctx.fill();
            // Moss patches
            dctx.fillStyle = '#3a6a2a';
            dctx.globalAlpha = 0.4;
            dctx.fillRect(-3 * s2, -1.2 * s2, 2 * s2, 0.8 * s2);
            dctx.restore();
            dctx.globalAlpha = 1;
          } else {
            // Regular mushroom decoration
            dctx.fillStyle = '#a03020';
            dctx.globalAlpha = 0.6;
            dctx.beginPath();
            dctx.arc(sx, sy - 1.5 * s2, 2.5 * s2, Math.PI, 0);
            dctx.fill();
            dctx.fillStyle = '#ddc';
            dctx.fillRect(sx - 0.8 * s2, sy - 1.5 * s2, 1.6 * s2, 2.5 * s2);
            dctx.fillStyle = '#fff';
            dctx.globalAlpha = 0.4;
            dctx.beginPath();
            dctx.arc(sx - 0.5 * s2, sy - 2 * s2, 0.5 * s2, 0, Math.PI * 2);
            dctx.fill();
            dctx.globalAlpha = 1;
          }
        } else if (biome === BIOME.DESERT) {
          const s2 = s / 24;
          dctx.fillStyle = '#3a7a2a';
          dctx.globalAlpha = 0.65;
          dctx.fillRect(sx - 1 * s2, sy - 4 * s2, 2 * s2, 5 * s2);
          dctx.fillRect(sx - 3 * s2, sy - 3 * s2, 2 * s2, 1.2 * s2);
          dctx.fillRect(sx - 3 * s2, sy - 3 * s2, 1.2 * s2, 2 * s2);
          dctx.fillRect(sx + 1 * s2, sy - 2 * s2, 2 * s2, 1.2 * s2);
          dctx.fillRect(sx + 1.8 * s2, sy - 2 * s2, 1.2 * s2, 2 * s2);
          dctx.globalAlpha = 1;
        } else if (biome === BIOME.MOUNTAIN) {
          const s2 = s / 24;
          // Ruins/rubble: broken wall segments and scattered stones
          const ruinSeed = seededRand(tx, ty, 1234);
          if (ruinSeed < 0.35) {
            // Rubble pile: scattered stone blocks
            dctx.fillStyle = '#555';
            dctx.globalAlpha = 0.6;
            dctx.fillRect(sx - 2.5 * s2, sy - 1 * s2, 2 * s2, 1.5 * s2);
            dctx.fillRect(sx + 0.5 * s2, sy - 0.5 * s2, 1.5 * s2, 1 * s2);
            dctx.fillStyle = '#6a6a6a';
            dctx.fillRect(sx - 1 * s2, sy - 2 * s2, 3 * s2, 2 * s2);
            // Broken wall segment
            dctx.fillStyle = '#777';
            dctx.fillRect(sx - 3 * s2, sy - 3 * s2, 1.5 * s2, 4 * s2);
            dctx.globalAlpha = 0.3;
            dctx.fillStyle = '#444';
            dctx.fillRect(sx - 3 * s2, sy + 0.5 * s2, 5 * s2, 0.5 * s2);
            dctx.globalAlpha = 1;
          } else {
            // Regular rock decoration
            dctx.fillStyle = '#666';
            dctx.globalAlpha = 0.5;
            dctx.beginPath();
            dctx.ellipse(sx, sy, 2 * s2, 1.2 * s2, r2 * Math.PI, 0, Math.PI * 2);
            dctx.fill();
            dctx.globalAlpha = 1;
          }
        } else if (biome === BIOME.BEACH) {
          const s2 = s / 24;
          // Occasional grass patches near shore for smoother transition
          const grassSeed = seededRand(tx, ty, 2345);
          if (grassSeed < 0.4) {
            dctx.fillStyle = '#7aaa4a';
            dctx.globalAlpha = 0.4;
            dctx.beginPath();
            dctx.ellipse(sx, sy, 2.5 * s2, 1.5 * s2, r2 * Math.PI, 0, Math.PI * 2);
            dctx.fill();
            // Small grass blades
            dctx.strokeStyle = '#6a9a3a';
            dctx.lineWidth = 0.4;
            for (let g = 0; g < 3; g++) {
              const gx = sx + (seededRand(tx, ty, 2400 + g) - 0.5) * 4 * s2;
              const gy = sy + (seededRand(tx, ty, 2500 + g) - 0.5) * 3 * s2;
              dctx.beginPath();
              dctx.moveTo(gx, gy);
              dctx.lineTo(gx + (seededRand(tx, ty, 2600 + g) - 0.5) * 2 * s2, gy - 2 * s2);
              dctx.stroke();
            }
            dctx.globalAlpha = 1;
          } else {
            dctx.fillStyle = '#c8b888';
            dctx.globalAlpha = 0.5;
            dctx.beginPath();
            dctx.ellipse(sx, sy, 2 * s2, 1.2 * s2, r2 * Math.PI, 0, Math.PI * 2);
            dctx.fill();
            dctx.globalAlpha = 1;
          }
        } else if (biome === BIOME.SNOW) {
          const s2 = s / 24;
          dctx.fillStyle = '#bbc';
          dctx.globalAlpha = 0.5;
          dctx.beginPath();
          dctx.ellipse(sx, sy, 2 * s2, 1.2 * s2, r2 * Math.PI, 0, Math.PI * 2);
          dctx.fill();
          dctx.globalAlpha = 1;
        }
      }
    }

    decoChunks.set(key, decoCanvas);
    if (decoChunks.size > 150) {
      const first = decoChunks.keys().next().value;
      decoChunks.delete(first);
    }
    return decoCanvas;
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

  // ── Environment decorations (client-only, seeded from biome) ── cached per chunk
  function drawDecorations(ctx, w, h, camX, camY, viewScale) {
    if (!state.biomeMap) return;

    const tilesX = Math.ceil(w / viewScale) + 2;
    const tilesY = Math.ceil(h / viewScale) + 2;
    const startTileX = Math.floor(camX / 2 - tilesX / 2);
    const startTileY = Math.floor(camY / 2 - tilesY / 2);

    const startChunkX = Math.floor(startTileX / CHUNK_SIZE);
    const startChunkY = Math.floor(startTileY / CHUNK_SIZE);
    const endChunkX = Math.ceil((startTileX + tilesX) / CHUNK_SIZE);
    const endChunkY = Math.ceil((startTileY + tilesY) / CHUNK_SIZE);

    for (let cy = startChunkY; cy <= endChunkY; cy++) {
      for (let cx = startChunkX; cx <= endChunkX; cx++) {
        const chunk = renderDecoChunk(cx, cy, viewScale);
        if (!chunk) continue;

        const screenX = (cx * CHUNK_SIZE * 2 - camX) * viewScale / 2 + w / 2;
        const screenY = (cy * CHUNK_SIZE * 2 - camY) * viewScale / 2 + h / 2;
        const size = CHUNK_SIZE * viewScale;

        ctx.drawImage(chunk, screenX, screenY, size, size);
      }
    }
  }

  return { drawTerrain, drawDecorations };
}
