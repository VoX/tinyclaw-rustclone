import { ENTITY_TYPE } from '../../shared/protocol.js';
import { TILE_SIZE, ITEM, ITEM_DEFS, STRUCT_TIER } from '../../shared/constants.js';

export function createUIOverlays(state) {
  let minimapCanvas = null;
  let minimapDirty = true;
  let minimapLastUpdate = 0;
  let fullMapCanvas = null;
  let fullMapLastRender = 0;

  function drawHealthBars(ctx, sortedEntities, camX, camY, w, h, viewScale) {
    for (const e of sortedEntities) {
      if (e.hp !== undefined && e.mhp && e.eid !== state.myEid && e.hp < e.mhp) {
        const ex = e.eid === state.myEid ? e.x : (e.renderX || e.x);
        const ey = e.eid === state.myEid ? e.y : (e.renderY || e.y);
        const sx = (ex - camX) * viewScale / TILE_SIZE + w / 2;
        const sy = (ey - camY) * viewScale / TILE_SIZE + h / 2;
        if (sx < -60 || sx > w + 60 || sy < -60 || sy > h + 60) continue;
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
  }

  function drawPlayerNames(ctx, sortedEntities, camX, camY, w, h, viewScale) {
    ctx.save();
    ctx.font = '10px Consolas, monospace';
    ctx.textAlign = 'center';
    for (const e of sortedEntities) {
      if (e.t !== 1) continue; // ENTITY_TYPE.PLAYER
      if (!e.name) continue;
      if (e.eid === state.myEid) continue;
      const ex = e.renderX || e.x;
      const ey = e.renderY || e.y;
      const sx = (ex - camX) * viewScale / TILE_SIZE + w / 2;
      const sy = (ey - camY) * viewScale / TILE_SIZE + h / 2;
      if (sx < -60 || sx > w + 60 || sy < -60 || sy > h + 60) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      const tw = ctx.measureText(e.name).width;
      ctx.fillRect(sx - tw / 2 - 2, sy - 34, tw + 4, 12);
      ctx.fillStyle = '#fff';
      ctx.fillText(e.name, sx, sy - 24);
    }
    ctx.restore();
  }

  function drawHammerPreview(ctx, me, sortedEntities, camX, camY, w, h, viewScale, animTime) {
    if (!me || state.isDead) return;
    const heldItem = state.inventory[state.selectedSlot]?.id;
    if (heldItem !== ITEM.HAMMER) return;

    const tierNames = ['Twig', 'Wood', 'Stone', 'Metal'];
    const nextTierColors = {
      0: 'rgba(139,105,20,0.3)',
      1: 'rgba(128,128,128,0.3)',
      2: 'rgba(106,106,112,0.3)',
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
      const alpha = 0.3 + Math.sin(animTime * 0.005) * 0.15;
      ctx.fillStyle = nextTierColors[tier] || 'rgba(100,100,100,0.3)';
      ctx.globalAlpha = alpha;
      ctx.fillRect(esx - size / 2 - 2, esy - size / 2 - 2, size + 4, size + 4);
      ctx.globalAlpha = 1;
      ctx.font = '9px Consolas, monospace';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(`→ ${tierNames[tier + 1]}`, esx, esy - size / 2 - 5);
      ctx.textAlign = 'left';
    }
  }

  function drawNightOverlay(ctx, w, h, light, sortedEntities, me, camX, camY, viewScale, animTime) {
    if (light >= 1.0) return;

    const darkness = 1 - light;
    let r = 0, g = 0, b = 20;
    if (light > 0.5 && light < 0.8) {
      r = 40; g = 15; b = 0;
    }

    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${darkness * 0.85})`;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';

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

    // Warm glow overlays
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

  function drawGoldenHour(ctx, w, h, light) {
    if (light >= 0.8 && light < 1.0) {
      const intensity = (1.0 - light) * 0.15;
      ctx.fillStyle = `rgba(255, 180, 60, ${intensity})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  function drawEdgeVignette(ctx, w, h) {
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
  }

  function drawDamageFlash(ctx, w, h) {
    if (state.damageFlashAlpha <= 0) return;
    ctx.fillStyle = `rgba(200, 0, 0, ${state.damageFlashAlpha})`;
    ctx.fillRect(0, 0, w, h);
    const vigGrad = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.7);
    vigGrad.addColorStop(0, 'rgba(200, 0, 0, 0)');
    vigGrad.addColorStop(1, `rgba(150, 0, 0, ${state.damageFlashAlpha * 0.8})`);
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, w, h);
  }

  function drawTemperatureEffects(ctx, w, h, sortedEntities, camX, camY, viewScale) {
    const temp = state.temp;
    if (temp === undefined) return;

    // Screen tint for extreme temperatures
    if (temp < 10) {
      const intensity = Math.min(0.15, (10 - temp) * 0.015);
      ctx.fillStyle = `rgba(100, 150, 255, ${intensity})`;
      ctx.fillRect(0, 0, w, h);
    } else if (temp > 35) {
      const intensity = Math.min(0.12, (temp - 35) * 0.012);
      ctx.fillStyle = `rgba(255, 150, 50, ${intensity})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Temperature indicator icon (near bottom-left, above hotbar area)
    const iconX = 90;
    const iconY = h - 56;
    ctx.font = '12px Consolas, monospace';
    ctx.textAlign = 'left';

    if (temp < 15) {
      // Cold: snowflake
      ctx.fillStyle = temp < 5 ? '#88bbff' : '#aaccee';
      ctx.font = '14px Consolas, monospace';
      ctx.fillText('*', iconX, iconY);
      ctx.font = '10px Consolas, monospace';
      ctx.fillText(`${Math.round(temp)}°`, iconX + 14, iconY);
    } else if (temp > 35) {
      // Hot: sun
      ctx.fillStyle = temp > 45 ? '#ff8844' : '#eebb44';
      ctx.font = '14px Consolas, monospace';
      ctx.fillText('☀', iconX, iconY);
      ctx.font = '10px Consolas, monospace';
      ctx.fillText(`${Math.round(temp)}°`, iconX + 14, iconY);
    }

    // Campfire warmth radius (visible subtle glow)
    for (const e of sortedEntities) {
      if (e.t !== 7) continue; // ENTITY_TYPE.CAMPFIRE
      if (!e.lit) continue;
      const ex = e.renderX || e.x;
      const ey = e.renderY || e.y;
      const sx = (ex - camX) * viewScale / 2 + w / 2;
      const sy = (ey - camY) * viewScale / 2 + h / 2;
      const warmRadius = 5 * viewScale; // 5 tile warmth radius
      ctx.save();
      ctx.globalAlpha = 0.06;
      ctx.strokeStyle = '#ff9944';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(sx, sy, warmRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  function drawChatBubbles(ctx, sortedEntities, camX, camY, w, h, viewScale) {
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
  }

  function drawMinimap(ctx, w, h, camX, camY, entities) {
    const me = state.myEid ? state.entities.get(state.myEid) : null;
    if (!me || !state.biomeMap) return;

    const mapSize = 180;
    const mapX = w - mapSize - 12;
    const mapY = 12;
    const tileRadius = 200;
    const px = me.x / TILE_SIZE;
    const py = me.y / TILE_SIZE;

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.roundRect(mapX - 4, mapY - 4, mapSize + 8, mapSize + 8, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(100,100,100,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

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
        0: [232, 214, 142],
        1: [90, 143, 60],
        2: [45, 90, 30],
        3: [196, 163, 90],
        4: [221, 232, 240],
        5: [122, 122, 122],
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
        if (e.eid === state.myEid) { color = '#0f0'; radius = 3; }
        else { color = '#fff'; radius = 2; }
      } else if (e.t === ENTITY_TYPE.ANIMAL) {
        color = '#f44'; radius = 1.5;
      } else if (e.t === ENTITY_TYPE.RESOURCE_NODE) {
        const rtColors = { 1: '#1a5a0a', 2: '#888', 3: '#b87333', 4: '#d4c84a', 5: '#4a8a2a' };
        color = rtColors[e.rt] || '#555'; radius = 1;
      } else if (e.t === ENTITY_TYPE.STRUCTURE || e.t === ENTITY_TYPE.DOOR) {
        color = 'rgba(180,180,150,0.6)'; radius = 1.5;
      } else if (e.t === ENTITY_TYPE.NPC) {
        color = '#4f4'; radius = 2.5;
      }

      if (color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(dotX, dotY, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.font = '9px Consolas, monospace';
    ctx.fillStyle = '#888';
    ctx.textAlign = 'center';
    ctx.fillText('N', mapX + mapSize / 2, mapY + 10);
    ctx.textAlign = 'left';
  }

  function drawFullMap(ctx, w, h, entities, animTime) {
    const me = state.myEid ? state.entities.get(state.myEid) : null;
    if (!state.biomeMap) return;

    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, w, h);

    const margin = 40;
    const mapW = Math.min(w - margin * 2, h - margin * 2);
    const mapH = mapW;
    const mapX = (w - mapW) / 2;
    const mapY = (h - mapH) / 2;

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
        0: [232, 214, 142],
        1: [90, 143, 60],
        2: [45, 90, 30],
        3: [196, 163, 90],
        4: [221, 232, 240],
        5: [122, 122, 122],
        6: [40, 80, 160],
        7: [138, 122, 90], // road
      };

      const fogSize = state.exploredTiles ? Math.ceil(ws / 8) : 0;

      for (let my = 0; my < mSize; my++) {
        for (let mx = 0; mx < mSize; mx++) {
          const tx = Math.floor(mx * ws / mSize);
          const ty = Math.floor(my * ws / mSize);
          const idx = (my * mSize + mx) * 4;

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

    // Draw radiation zones on full map
    if (state.radiationZones) {
      for (const zone of state.radiationZones) {
        const zx = mapX + (zone.x / ts) * scale;
        const zy = mapY + (zone.y / ts) * scale;
        const zr = (zone.radius / ts) * scale;
        ctx.fillStyle = 'rgba(200, 50, 30, 0.2)';
        ctx.beginPath();
        ctx.arc(zx, zy, zr, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(200, 50, 30, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.font = '10px Consolas, monospace';
        ctx.fillStyle = 'rgba(200, 50, 30, 0.7)';
        ctx.textAlign = 'center';
        ctx.fillText('RAD', zx, zy + 4);
        ctx.textAlign = 'left';
      }
    }

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

    if (me) {
      const px = mapX + (me.x / ts) * scale;
      const py = mapY + (me.y / ts) * scale;
      const pulse = 1 + Math.sin(animTime * 0.005) * 0.3;
      ctx.fillStyle = '#0f0';
      ctx.beginPath();
      ctx.arc(px, py, 5 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.font = 'bold 18px Consolas, monospace';
    ctx.fillStyle = '#ccc';
    ctx.textAlign = 'center';
    ctx.fillText('MAP (M to close)', w / 2, mapY - 12);
    ctx.textAlign = 'left';

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

  function drawNotifications(ctx, w, h) {
    const now = Date.now();
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

  function drawChatLog(ctx, w, h) {
    const messages = state.chatMessages;
    if (messages.length === 0 && !state.chatOpen) return;

    const logX = 14;
    const logY = h - 140;
    const now = Date.now();

    const recent = messages.slice(-10);
    for (let i = 0; i < recent.length; i++) {
      const msg = recent[i];
      const age = now - msg.time;
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

    if (state.chatOpen) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(logX - 4, logY + recent.length * 16 + 4, 300, 20);
      ctx.font = '11px Consolas, monospace';
      ctx.fillStyle = '#fff';
      ctx.fillText(`> ${state.chatInput}_`, logX, logY + recent.length * 16 + 18);
    }
  }

  function drawPerfDisplay(ctx, w, h) {
    if (!state.showPerf) return;
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

  function drawConnectionScreen(ctx, w, h) {
    if (state.worldReady) return;
    // Full black background
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, w, h);

    // Subtle noise texture
    ctx.save();
    ctx.globalAlpha = 0.03;
    for (let i = 0; i < 80; i++) {
      const nx = Math.random() * w;
      const ny = Math.random() * h;
      ctx.fillStyle = '#fff';
      ctx.fillRect(nx, ny, 1, 1);
    }
    ctx.restore();

    const cx = w / 2;
    const cy = h / 2;
    ctx.textAlign = 'center';

    // Player silhouette with rock
    ctx.save();
    ctx.fillStyle = '#222';
    // Body
    ctx.beginPath();
    ctx.ellipse(cx, cy - 80, 14, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    // Head
    ctx.beginPath();
    ctx.arc(cx, cy - 110, 10, 0, Math.PI * 2);
    ctx.fill();
    // Left arm (holding rock)
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy - 90);
    ctx.lineTo(cx - 26, cy - 70);
    ctx.lineTo(cx - 22, cy - 66);
    ctx.lineTo(cx - 8, cy - 86);
    ctx.closePath();
    ctx.fill();
    // Rock in hand
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.moveTo(cx - 30, cy - 72);
    ctx.lineTo(cx - 22, cy - 78);
    ctx.lineTo(cx - 18, cy - 68);
    ctx.lineTo(cx - 26, cy - 64);
    ctx.closePath();
    ctx.fill();
    // Right arm
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.moveTo(cx + 12, cy - 90);
    ctx.lineTo(cx + 20, cy - 72);
    ctx.lineTo(cx + 16, cy - 68);
    ctx.lineTo(cx + 8, cy - 86);
    ctx.closePath();
    ctx.fill();
    // Legs
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - 60);
    ctx.lineTo(cx - 12, cy - 38);
    ctx.lineTo(cx - 4, cy - 38);
    ctx.lineTo(cx, cy - 58);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 8, cy - 60);
    ctx.lineTo(cx + 12, cy - 38);
    ctx.lineTo(cx + 4, cy - 38);
    ctx.lineTo(cx, cy - 58);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Title
    ctx.font = 'bold 32px Consolas, monospace';
    ctx.fillStyle = '#e8c030';
    ctx.fillText('RUST CLONE', cx, cy + 10);

    // Status text
    ctx.font = '14px Consolas, monospace';
    ctx.fillStyle = '#888';
    let statusText = 'Reconnecting...';
    if (state.connecting) statusText = 'Connecting to server...';
    else if (state.loadingWorld) statusText = 'Loading world data...';
    ctx.fillText(statusText, cx, cy + 36);

    // World seed
    if (state.worldSeed) {
      ctx.font = '11px Consolas, monospace';
      ctx.fillStyle = '#555';
      ctx.fillText(`seed: ${state.worldSeed}`, cx, cy + 54);
    }

    // Loading bar
    const barW = 240;
    const barH = 6;
    const barX = cx - barW / 2;
    const barY = cy + 68;
    const progress = state.loadingProgress || 0;

    // Bar background
    ctx.fillStyle = '#222';
    ctx.fillRect(barX, barY, barW, barH);
    // Bar border
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
    // Bar fill
    if (progress > 0) {
      const grad = ctx.createLinearGradient(barX, barY, barX + barW * progress, barY);
      grad.addColorStop(0, '#c08020');
      grad.addColorStop(1, '#e8c030');
      ctx.fillStyle = grad;
      ctx.fillRect(barX + 1, barY + 1, (barW - 2) * progress, barH - 2);
    }

    // Progress percentage
    ctx.font = '10px Consolas, monospace';
    ctx.fillStyle = '#666';
    ctx.fillText(`${Math.floor(progress * 100)}%`, cx, barY + 20);

    ctx.textAlign = 'left';
  }

  function drawControlsOverlay(ctx, w, h) {
    if (!state.showControls) return;
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.font = 'bold 28px Consolas, monospace';
    ctx.fillStyle = '#e8c030';
    ctx.fillText('RUST CLONE', w / 2, h / 2 - 150);

    // Show player name
    if (state.myName) {
      ctx.font = '16px Consolas, monospace';
      ctx.fillStyle = '#aaa';
      ctx.fillText(`You are: ${state.myName}`, w / 2, h / 2 - 120);
    }

    ctx.font = '14px Consolas, monospace';
    ctx.fillStyle = '#ccc';
    const controls = [
      'WASD — Move',
      'Shift — Sprint',
      'Mouse — Aim / LMB Attack / RMB Alt',
      'TAB — Inventory & Crafting',
      'E — Interact',
      'R — Reload',
      'B — Build Menu (hold Building Plan)',
      'Q — Drop Item',
      '1-6 — Hotbar Slots',
      'Enter — Chat',
      'F3 — Performance Stats',
      'M — Map',
      'L — Leaderboard',
    ];
    for (let i = 0; i < controls.length; i++) {
      ctx.fillText(controls[i], w / 2, h / 2 - 80 + i * 22);
    }
    ctx.font = '12px Consolas, monospace';
    ctx.fillStyle = '#888';
    ctx.fillText('Press any key to start', w / 2, h / 2 + controls.length * 22 - 50);
    ctx.textAlign = 'left';
  }

  function drawBuildPreview(ctx, w, h, camX, camY, viewScale, sortedEntities) {
    const heldItem = state.inventory?.[state.selectedSlot];
    if (!heldItem?.id) return;
    const itemId = heldItem.id;

    // Only show for building plan and deployables
    const isBuildPlan = itemId === ITEM.BUILDING_PLAN;
    const isDeployable = [ITEM.SLEEPING_BAG, ITEM.CAMPFIRE_ITEM, ITEM.FURNACE_ITEM,
      ITEM.TOOL_CUPBOARD_ITEM, ITEM.WORKBENCH_T1_ITEM, ITEM.WORKBENCH_T2_ITEM,
      ITEM.WORKBENCH_T3_ITEM, ITEM.STORAGE_BOX, ITEM.BED].includes(itemId);
    if (!isBuildPlan && !isDeployable) return;

    const me = state.myEid ? state.entities.get(state.myEid) : null;
    if (!me) return;

    // Convert mouse screen coords to world coords
    const worldX = me.x + (state.mouseScreenX - w / 2) * TILE_SIZE / viewScale;
    const worldY = me.y + (state.mouseScreenY - h / 2) * TILE_SIZE / viewScale;

    // Snap to 2x2 tile grid
    const gridSize = TILE_SIZE * 2;
    const snappedX = Math.round(worldX / gridSize) * gridSize;
    const snappedY = Math.round(worldY / gridSize) * gridSize;

    // Check placement validity
    const dx = snappedX - me.x;
    const dy = snappedY - me.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = 8; // max build distance in world units
    let valid = dist <= maxDist;

    // Check for overlap with existing entities
    if (valid) {
      for (const e of sortedEntities) {
        if (e.t === 5 || e.t === 12) { // STRUCTURE or DOOR
          const ex = e.renderX || e.x;
          const ey = e.renderY || e.y;
          const odx = ex - snappedX;
          const ody = ey - snappedY;
          if (Math.abs(odx) < 1.5 && Math.abs(ody) < 1.5) {
            valid = false;
            break;
          }
        }
      }
    }

    // Draw ghost
    const sx = (snappedX - camX) * viewScale / TILE_SIZE + w / 2;
    const sy = (snappedY - camY) * viewScale / TILE_SIZE + h / 2;
    const ghostSize = viewScale * 2; // 2 tiles wide

    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = valid ? 'rgba(0,200,0,0.4)' : 'rgba(200,0,0,0.4)';
    ctx.strokeStyle = valid ? '#0f0' : '#f00';
    ctx.lineWidth = 2;

    if (isBuildPlan) {
      const piece = state.buildPiece || 1;
      if (piece === 1) { // Foundation
        ctx.fillRect(sx - ghostSize / 2, sy - ghostSize / 2, ghostSize, ghostSize);
        ctx.strokeRect(sx - ghostSize / 2, sy - ghostSize / 2, ghostSize, ghostSize);
      } else if (piece === 2 || piece === 3 || piece === 7) { // Wall/Doorway/Window
        ctx.fillRect(sx - ghostSize / 2, sy - 4, ghostSize, 8);
        ctx.strokeRect(sx - ghostSize / 2, sy - 4, ghostSize, 8);
      } else { // Ceiling/Stairs
        ctx.fillRect(sx - ghostSize / 2, sy - ghostSize / 2, ghostSize, ghostSize);
        ctx.strokeRect(sx - ghostSize / 2, sy - ghostSize / 2, ghostSize, ghostSize);
      }
    } else {
      // Deployable — circle
      const r = viewScale * 0.5;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawCraftProgress(ctx, w, h) {
    if (!state.craftRecipeId || state.craftProgress < 0) return;
    const progress = Math.max(0, Math.min(1, state.craftProgress));
    const barW = 200;
    const barH = 14;
    const x = w / 2 - barW / 2;
    const y = h - 140;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(x - 4, y - 4, barW + 8, barH + 18);

    // Bar background
    ctx.fillStyle = '#333';
    ctx.fillRect(x, y, barW, barH);
    // Bar fill
    ctx.fillStyle = '#e8c030';
    ctx.fillRect(x, y, barW * progress, barH);
    // Border
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, barW, barH);

    // Label
    ctx.font = '10px Consolas, monospace';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    ctx.fillText('Crafting... [ESC] cancel', w / 2, y + barH + 12);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  function drawStaminaBar(ctx, w, h) {
    if (state.stamina >= 100) return; // Don't show when full
    const barW = 120;
    const barH = 5;
    const x = w / 2 - barW / 2;
    const y = h - 100;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - 1, y - 1, barW + 2, barH + 2);
    const pct = state.stamina / 100;
    const color = state.staminaLocked ? '#c44' : (pct < 0.3 ? '#e80' : '#ee0');
    ctx.fillStyle = color;
    ctx.fillRect(x, y, barW * pct, barH);
  }

  function drawAmmoHUD(ctx, w, h) {
    // Only show if holding a ranged weapon
    const heldItem = state.inventory?.[state.selectedSlot];
    if (!heldItem?.id) return;
    const def = ITEM_DEFS[heldItem.id];
    if (!def || def.cat !== 'ranged') return;

    const ammo = state.clipAmmo || 0;
    const max = state.clipMax || def.clipSize || 1;

    ctx.save();
    ctx.font = 'bold 16px Consolas, monospace';
    ctx.textAlign = 'right';

    const x = w / 2 + 160;
    const y = h - 70;

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - 70, y - 16, 74, 24);

    ctx.fillStyle = ammo === 0 ? '#e44' : '#fff';
    ctx.fillText(`${ammo} / ${max}`, x, y);

    if (ammo === 0) {
      ctx.font = '10px Consolas, monospace';
      ctx.fillStyle = '#aaa';
      ctx.fillText('[R] Reload', x, y + 14);
    }
    ctx.restore();
  }

  function drawBagCount(ctx, w, h) {
    if (!state.bagCount && state.bagCount !== 0) return;
    ctx.save();
    ctx.font = '10px Consolas, monospace';
    ctx.textAlign = 'right';
    const x = w - 12;
    const y = h - 40;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - 80, y - 10, 84, 16);
    const color = state.bagCount >= state.maxBags ? '#e88' : '#aaa';
    ctx.fillStyle = color;
    ctx.fillText(`Bags: ${state.bagCount}/${state.maxBags}`, x, y + 2);
    ctx.restore();
  }

  function drawSaveIndicator(ctx, w, h) {
    if (!state.saveNotify) return;
    const elapsed = Date.now() - state.saveNotify;
    if (elapsed > 3000) { state.saveNotify = 0; return; }
    const alpha = elapsed < 2000 ? 0.8 : 0.8 * (1 - (elapsed - 2000) / 1000);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '11px Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#aaa';
    ctx.fillText('💾 Saving...', 12, h - 12);
    ctx.restore();
  }

  function drawTutorialHint(ctx, w, h) {
    if (!state.tutorialExpiry || Date.now() > state.tutorialExpiry) return;
    const remaining = state.tutorialExpiry - Date.now();
    const alpha = remaining < 2000 ? remaining / 2000 : 1;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '14px Consolas, monospace';
    ctx.textAlign = 'center';

    const hints = [
      'Left-click trees/rocks with your rock to gather materials',
      'Press TAB to open inventory & crafting',
      'Press B with a Building Plan to start building',
    ];

    const boxW = 420;
    const boxH = hints.length * 22 + 20;
    const boxX = w / 2 - boxW / 2;
    const boxY = h - 120;

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = 'rgba(255,200,60,0.5)';
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.fillStyle = '#e8c030';
    for (let i = 0; i < hints.length; i++) {
      ctx.fillText(hints[i], w / 2, boxY + 20 + i * 22);
    }

    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.restore();
  }

  function drawLeaderboard(ctx, w, h) {
    if (!state.showLeaderboard) return;
    const lb = state.leaderboard;
    const panelW = 260;
    const rowH = 20;
    const headerH = 28;
    const panelH = headerH + Math.max(lb.length, 1) * rowH + 10;
    const px = w / 2 - panelW / 2;
    const py = h / 2 - panelH / 2;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(px, py, panelW, panelH);
    ctx.strokeStyle = '#e8c030';
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, panelW, panelH);

    // Header
    ctx.font = 'bold 14px Consolas, monospace';
    ctx.fillStyle = '#e8c030';
    ctx.textAlign = 'center';
    ctx.fillText('LEADERBOARD', w / 2, py + 18);

    // Column headers
    ctx.font = '10px Consolas, monospace';
    ctx.fillStyle = '#888';
    ctx.textAlign = 'left';
    ctx.fillText('Player', px + 10, py + headerH + 12);
    ctx.textAlign = 'right';
    ctx.fillText('Kills', px + panelW - 70, py + headerH + 12);
    ctx.fillText('Res', px + panelW - 10, py + headerH + 12);

    // Rows
    ctx.font = '11px Consolas, monospace';
    if (lb.length === 0) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#666';
      ctx.fillText('No data yet', w / 2, py + headerH + 30);
    } else {
      for (let i = 0; i < lb.length; i++) {
        const row = lb[i];
        const ry = py + headerH + 14 + (i + 1) * rowH;
        ctx.textAlign = 'left';
        ctx.fillStyle = i === 0 ? '#e8c030' : '#ccc';
        ctx.fillText(`${i + 1}. ${row.name}`, px + 10, ry);
        ctx.textAlign = 'right';
        ctx.fillText(`${row.kills}`, px + panelW - 70, ry);
        ctx.fillStyle = i === 0 ? '#c8a020' : '#aaa';
        ctx.fillText(`${row.resources}`, px + panelW - 10, ry);
      }
    }

    ctx.font = '9px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#555';
    ctx.fillText('[L] close', w / 2, py + panelH - 4);

    ctx.textAlign = 'left';
    ctx.restore();
  }

  return {
    drawHealthBars,
    drawPlayerNames,
    drawHammerPreview,
    drawNightOverlay,
    drawGoldenHour,
    drawEdgeVignette,
    drawDamageFlash,
    drawTemperatureEffects,
    drawBuildPreview,
    drawCraftProgress,
    drawStaminaBar,
    drawAmmoHUD,
    drawTutorialHint,
    drawChatBubbles,
    drawMinimap,
    drawFullMap,
    drawNotifications,
    drawChatLog,
    drawPerfDisplay,
    drawConnectionScreen,
    drawControlsOverlay,
    drawLeaderboard,
    drawBagCount,
    drawSaveIndicator,
  };
}
