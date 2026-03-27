import { ENTITY_TYPE } from '../../shared/protocol.js';
import { TILE_SIZE, ITEM, ITEM_DEFS, RESOURCE_TYPE, ANIMAL_TYPE, STRUCT_TYPE, STRUCT_TIER } from '../../shared/constants.js';
import { seededRand } from './terrain.js';

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

export function createEntityRenderer(state) {
  // Track death animation state per entity
  const deathAnims = new Map();
  let animTime = 0;

  function getAnimTime() { return animTime; }
  function updateAnimTime(dt) { animTime += dt; }

  // ── Dispatch entity drawing ──
  function drawEntity(ctx, sx, sy, e, viewScale) {
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
      drawStructure(ctx, sx, sy, e, viewScale);
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
    } else if (type === ENTITY_TYPE.BED) {
      drawBed(ctx, sx, sy, e);
    } else if (type === ENTITY_TYPE.STORAGE_BOX) {
      drawStorageBox(ctx, sx, sy, e);
    } else if (type === ENTITY_TYPE.LOOT_BAG) {
      drawLootBag(ctx, sx, sy, e);
    } else if (type === ENTITY_TYPE.BARREL) {
      drawBarrel(ctx, sx, sy, e);
    } else if (type === ENTITY_TYPE.NPC) {
      drawNPC(ctx, sx, sy, e);
    } else if (type === ENTITY_TYPE.LOOT_CRATE) {
      drawLootCrate(ctx, sx, sy, e);
    } else if (type === ENTITY_TYPE.RECYCLER) {
      drawRecycler(ctx, sx, sy, e);
    } else if (type === ENTITY_TYPE.RESEARCH_TABLE) {
      drawResearchTable(ctx, sx, sy, e);
    } else if (type === ENTITY_TYPE.HELICOPTER) {
      drawHelicopter(ctx, sx, sy, e);
    } else if (type === ENTITY_TYPE.HELI_CRATE) {
      drawHeliCrate(ctx, sx, sy, e);
    }
  }

  // ── Player drawing ──
  function drawPlayer(ctx, sx, sy, e, isLocal) {
    const angle = e.a || 0;
    const dead = e.dead;
    const sleeping = e.sleeping;

    if (dead && !deathAnims.has(e.eid)) {
      deathAnims.set(e.eid, { startTime: animTime, tilt: (Math.random() - 0.5) * 0.4 });
    } else if (!dead && deathAnims.has(e.eid)) {
      deathAnims.delete(e.eid);
    }

    const deathAnim = deathAnims.get(e.eid);
    let deathProgress = 0;
    if (deathAnim) {
      deathProgress = Math.min(1, (animTime - deathAnim.startTime) / 600);
    }

    // Shadow — wider for sleeping/dead players
    const laidDown = dead || sleeping;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    const shadowW = laidDown ? 14 : 10 + deathProgress * 4;
    const shadowH = laidDown ? 10 : 4 + deathProgress * 6;
    ctx.ellipse(sx, sy + 5, shadowW, shadowH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    if (dead) {
      ctx.globalAlpha = 1 - deathProgress * 0.4;
    } else if (sleeping) {
      ctx.globalAlpha = 0.8;
    }
    ctx.translate(sx, sy);
    if (sleeping) {
      // Sleeping: fully lying on their side
      ctx.rotate(Math.PI / 2);
      ctx.scale(1, 0.7);
    } else {
      const deathTilt = deathAnim ? deathProgress * (Math.PI / 2 + deathAnim.tilt) : 0;
      ctx.rotate(angle + Math.PI / 2 + deathTilt);
      if (dead) {
        ctx.scale(1, 1 - deathProgress * 0.3);
      }
    }

    const inactive = dead || sleeping;
    const hasLegsArmor = !inactive && e.armorLegs;
    const hasChestArmor = !inactive && e.armorChest;
    const hasHeadArmor = !inactive && e.armorHead;

    const skinColor = inactive ? '#777' : '#d4a574';
    const shirtColor = inactive ? '#555' : hasChestArmor ? '#7a5a2a' : (isLocal ? '#3a8fd6' : '#d6553a');
    const pantsColor = inactive ? '#444' : hasLegsArmor ? '#6a4a1a' : (isLocal ? '#2a5f8f' : '#8f3a2a');
    const outlineColor = inactive ? '#333' : '#222';

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

    // Held weapon
    if (e.held && e.held !== ITEM.NONE && !dead) {
      drawHeldWeapon(ctx, sx, sy, angle, e.held);
    }
  }

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
      ctx.strokeStyle = '#6a4a2a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-2, 0);
      ctx.lineTo(8, 0);
      ctx.stroke();
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
      ctx.strokeStyle = '#6a4a2a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(8, 0);
      ctx.stroke();
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
      const len = itemId === ITEM.WOODEN_SPEAR ? 14 : (itemId === ITEM.SALVAGED_SWORD ? 12 : 8);
      ctx.strokeStyle = itemId === ITEM.WOODEN_SPEAR ? '#8a6a3a' : '#aaa';
      ctx.lineWidth = itemId === ITEM.WOODEN_SPEAR ? 2 : 2.5;
      ctx.beginPath();
      ctx.moveTo(-2, 0);
      ctx.lineTo(len, 0);
      ctx.stroke();
      ctx.fillStyle = itemId === ITEM.WOODEN_SPEAR ? '#6a4a2a' : '#ccc';
      ctx.beginPath();
      ctx.moveTo(len, 0);
      ctx.lineTo(len + 3, -1.5);
      ctx.lineTo(len + 3, 1.5);
      ctx.closePath();
      ctx.fill();
    } else if (cat === 'ranged') {
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
        ctx.fillStyle = '#555';
        ctx.fillRect(-3, -2, 14, 4);
        ctx.fillStyle = '#444';
        ctx.fillRect(0, 1, 4, 4);
        ctx.fillStyle = '#666';
        ctx.fillRect(10, -1, 4, 2);
      }
    }

    ctx.restore();

    // Draw "Zzz" above sleeping players
    if (sleeping && !dead) {
      ctx.save();
      ctx.font = 'bold 10px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(200,200,255,0.7)';
      // Animate the Zzz floating up
      const t = (animTime % 2000) / 2000;
      const zOffset = -20 - t * 12;
      const zAlpha = 1 - t * 0.6;
      ctx.globalAlpha = zAlpha;
      ctx.fillText('z', sx + 8, sy + zOffset);
      ctx.font = 'bold 12px Consolas, monospace';
      ctx.fillText('z', sx + 14, sy + zOffset - 8);
      ctx.font = 'bold 14px Consolas, monospace';
      ctx.fillText('Z', sx + 20, sy + zOffset - 18);
      ctx.restore();
    }
  }

  // ── Resource Nodes ──
  function drawResourceNode(ctx, sx, sy, e) {
    const rt = e.rt;
    const depleted = e.rem <= 0;
    const eid = e.eid || 0;
    const sizeVar = 0.8 + seededRand(eid, 0, 5) * 0.4;

    ctx.save();
    ctx.globalAlpha = depleted ? 0.25 : 1.0;

    // Scale resource nodes 2.5x: translate to position, scale, draw at origin
    ctx.translate(sx, sy);
    ctx.scale(2.5, 2.5);

    if (rt === RESOURCE_TYPE.TREE) {
      drawTree(ctx, 0, 0, eid, sizeVar);
    } else if (rt === RESOURCE_TYPE.HEMP) {
      drawHemp(ctx, 0, 0, eid);
    } else if (rt === RESOURCE_TYPE.STONE_NODE) {
      drawStoneNode(ctx, 0, 0, eid, sizeVar);
    } else if (rt === RESOURCE_TYPE.METAL_NODE) {
      drawMetalNode(ctx, 0, 0, eid, sizeVar);
    } else if (rt === RESOURCE_TYPE.SULFUR_NODE) {
      drawSulfurNode(ctx, 0, 0, eid, sizeVar);
    }

    ctx.restore();
  }

  function drawTree(ctx, sx, sy, eid, sizeVar) {
    const canopyRadius = 10 * sizeVar;
    const trunkW = 3 * sizeVar;
    const trunkH = 8 * sizeVar;

    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(sx + 3, sy + 4, canopyRadius * 0.8, canopyRadius * 0.3, 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(sx - trunkW / 2, sy - 2, trunkW, trunkH);
    ctx.strokeStyle = '#3a2a10';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(sx - trunkW / 2, sy - 2, trunkW, trunkH);

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

    ctx.fillStyle = 'rgba(80,180,40,0.2)';
    ctx.beginPath();
    ctx.arc(sx - 2, sy - 8, canopyRadius * 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(10,40,5,0.3)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(sx, sy - 5, canopyRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawHemp(ctx, sx, sy, eid) {
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
    ctx.fillStyle = '#5a9a3a';
    ctx.beginPath();
    ctx.arc(sx, sy - 1, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawStoneNode(ctx, sx, sy, eid, sizeVar) {
    const s = 8 * sizeVar;
    const pts = 7;

    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + s * 0.5, s * 0.8, s * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#808080';
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

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.arc(sx - s * 0.2, sy - s * 0.2, s * 0.4, 0, Math.PI * 2);
    ctx.fill();

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

    ctx.strokeStyle = 'rgba(60,60,60,0.4)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(sx - s * 0.3, sy - s * 0.1);
    ctx.lineTo(sx + s * 0.1, sy + s * 0.2);
    ctx.stroke();
  }

  function drawMetalNode(ctx, sx, sy, eid, sizeVar) {
    const s = 7 * sizeVar;

    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + s * 0.5, s * 0.7, s * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

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

    ctx.fillStyle = '#c49050';
    ctx.beginPath();
    ctx.moveTo(sx - s * 0.3, sy - s * 0.5);
    ctx.lineTo(sx + s * 0.2, sy - s * 0.8);
    ctx.lineTo(sx + s * 0.6, sy - s * 0.2);
    ctx.lineTo(sx, sy);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(220,180,120,0.35)';
    ctx.beginPath();
    ctx.moveTo(sx, sy - s * 0.6);
    ctx.lineTo(sx + s * 0.3, sy - s * 0.3);
    ctx.lineTo(sx + s * 0.1, sy);
    ctx.closePath();
    ctx.fill();

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

    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + s * 0.5, s * 0.7, s * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

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

    ctx.fillStyle = '#e0d050';
    ctx.beginPath();
    ctx.moveTo(sx - s * 0.1, sy - s * 0.8);
    ctx.lineTo(sx + s * 0.3, sy - s * 0.5);
    ctx.lineTo(sx + s * 0.1, sy - s * 0.1);
    ctx.lineTo(sx - s * 0.3, sy - s * 0.3);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255,240,100,0.2)';
    ctx.beginPath();
    ctx.arc(sx, sy - s * 0.4, s * 0.4, 0, Math.PI * 2);
    ctx.fill();

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
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    const shadowSize = at === ANIMAL_TYPE.BEAR ? 14 : at === ANIMAL_TYPE.WOLF ? 10 : 8;
    ctx.beginPath();
    ctx.ellipse(sx, sy + shadowSize * 0.4, shadowSize * 0.8, shadowSize * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(sx, sy);
    ctx.rotate(facing);

    if (at === ANIMAL_TYPE.DEER) drawDeer(ctx, color);
    else if (at === ANIMAL_TYPE.BOAR) drawBoar(ctx, color);
    else if (at === ANIMAL_TYPE.WOLF) drawWolf(ctx, color);
    else if (at === ANIMAL_TYPE.BEAR) drawBear(ctx, color);

    ctx.restore();
  }

  function drawDeer(ctx, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a5a30';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.fillStyle = '#c09060';
    ctx.beginPath();
    ctx.ellipse(7, 0, 3.5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#8a6a40';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(8, -2); ctx.lineTo(10, -5); ctx.lineTo(12, -4);
    ctx.moveTo(10, -5); ctx.lineTo(10, -7);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8, 2); ctx.lineTo(10, 5); ctx.lineTo(12, 4);
    ctx.moveTo(10, 5); ctx.lineTo(10, 7);
    ctx.stroke();

    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(9, -1, 0.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e8d8c0';
    ctx.beginPath();
    ctx.arc(-7, 0, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBoar(ctx, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4a3020';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.fillStyle = '#7a5a40';
    ctx.beginPath();
    ctx.ellipse(6, 0, 3.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#9a7a60';
    ctx.beginPath();
    ctx.ellipse(9, 0, 2, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(9, -1.5); ctx.lineTo(11, -3);
    ctx.moveTo(9, 1.5); ctx.lineTo(11, 3);
    ctx.stroke();

    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(7, -1.5, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawWolf(ctx, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#404040';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.fillStyle = '#707070';
    ctx.beginPath();
    ctx.moveTo(7, -3); ctx.lineTo(12, 0); ctx.lineTo(7, 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.moveTo(7, -3); ctx.lineTo(8, -6); ctx.lineTo(9, -3);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(7, 3); ctx.lineTo(8, 6); ctx.lineTo(9, 3);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.arc(9, -1, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(9, -1, 0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.quadraticCurveTo(-11, -3, -10, -5);
    ctx.stroke();
  }

  function drawBear(ctx, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2a1810';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#5a3828';
    ctx.beginPath();
    ctx.arc(11, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#3a2818';
    ctx.beginPath();
    ctx.arc(10, -5, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(10, 5, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#7a5a40';
    ctx.beginPath();
    ctx.ellipse(14, 0, 2.5, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(12, -2, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(12, 2, 1, 0, Math.PI * 2);
    ctx.fill();

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

    ctx.fillStyle = `rgba(255, 215, 0, ${0.1 * pulse})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 8, 0, Math.PI * 2);
    ctx.fill();

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

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(sx - 1, sy - 1, 1.5, 0, Math.PI * 2);
    ctx.fill();

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
    const isArrow = e.sprite === 101;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(angle);

    if (isArrow) {
      // Arrow: wooden shaft with pointed tip
      ctx.strokeStyle = '#8a6a3a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(4, 0);
      ctx.stroke();
      // Arrowhead
      ctx.fillStyle = '#999';
      ctx.beginPath();
      ctx.moveTo(4, 0);
      ctx.lineTo(7, -2);
      ctx.lineTo(8, 0);
      ctx.lineTo(7, 2);
      ctx.closePath();
      ctx.fill();
      // Fletching
      ctx.fillStyle = 'rgba(180,50,50,0.6)';
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(-7, -2);
      ctx.lineTo(-7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(-7, 2);
      ctx.lineTo(-7, 0);
      ctx.closePath();
      ctx.fill();
    } else {
      // Bullet: bright tracer line
      ctx.strokeStyle = 'rgba(255,220,100,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.lineTo(-2, 0);
      ctx.stroke();
      // Bright core tracer
      ctx.strokeStyle = 'rgba(255,255,200,0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(0, 0);
      ctx.stroke();
      // Bullet tip
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // ── Structures ──
  function drawStructure(ctx, sx, sy, e, viewScale) {
    const size = viewScale * 0.9;
    const tier = e.tier || 0;
    const st = e.st;

    const tierColors = {
      0: { fill: '#7a6845', stroke: '#5a4a30', detail: '#6a5835' },
      1: { fill: '#8b6914', stroke: '#6a5010', detail: '#7a5a12' },
      2: { fill: '#808080', stroke: '#555', detail: '#707070' },
      3: { fill: '#6a6a70', stroke: '#444', detail: '#5a5a60' },
    };
    const tc = tierColors[tier] || tierColors[0];

    ctx.save();

    if (st === STRUCT_TYPE.FOUNDATION) {
      ctx.fillStyle = tc.fill;
      ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
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
      ctx.fillStyle = tc.fill;
      const wallThick = size * 0.2;
      ctx.fillRect(sx - size / 2, sy - wallThick / 2, size, wallThick);
      if (tier === 1) {
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
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(sx - size * 0.15, sy - wallThick / 2);
        ctx.lineTo(sx - size * 0.15, sy + wallThick / 2);
        ctx.moveTo(sx + size * 0.15, sy - wallThick / 2);
        ctx.lineTo(sx + size * 0.15, sy + wallThick / 2);
        ctx.stroke();
      } else if (tier === 3) {
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
      const wallThick = size * 0.15;
      const doorColor = tier === 3 ? '#5a5a60' : '#7a5a14';
      ctx.fillStyle = doorColor;
      ctx.fillRect(sx - size * 0.15, sy - wallThick / 2, size * 0.3, wallThick);
      ctx.fillStyle = '#aa8800';
      ctx.beginPath();
      ctx.arc(sx + size * 0.1, sy, 1.5, 0, Math.PI * 2);
      ctx.fill();
      if (e.open) {
        ctx.strokeStyle = 'rgba(100,255,100,0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx - size * 0.15, sy - wallThick / 2, size * 0.3, wallThick);
      }
    } else if (st === STRUCT_TYPE.CEILING) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = tc.fill;
      ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
      ctx.strokeStyle = tc.stroke;
      ctx.lineWidth = 1;
      ctx.strokeRect(sx - size / 2, sy - size / 2, size, size);
      ctx.strokeStyle = tc.detail;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(sx - size / 2, sy - size / 2);
      ctx.lineTo(sx + size / 2, sy + size / 2);
      ctx.moveTo(sx + size / 2, sy - size / 2);
      ctx.lineTo(sx - size / 2, sy + size / 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (st === STRUCT_TYPE.STAIRS) {
      ctx.fillStyle = tc.fill;
      const steps = 4;
      for (let i = 0; i < steps; i++) {
        const stepW = size * 0.8;
        const stepH = size / steps;
        const alpha = 0.5 + (i / steps) * 0.5;
        ctx.globalAlpha = alpha;
        ctx.fillRect(sx - stepW / 2, sy - size / 2 + i * stepH, stepW, stepH - 1);
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = tc.stroke;
      ctx.lineWidth = 1;
      ctx.strokeRect(sx - size * 0.4, sy - size / 2, size * 0.8, size);
    } else {
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
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, 8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.arc(sx, sy, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#5a3a1a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx - 4, sy - 2);
    ctx.lineTo(sx + 4, sy + 2);
    ctx.moveTo(sx - 4, sy + 2);
    ctx.lineTo(sx + 4, sy - 2);
    ctx.stroke();

    const t = animTime * 0.01;
    const flicker1 = Math.sin(t) * 1.5;
    const flicker2 = Math.cos(t * 1.3) * 1;

    ctx.fillStyle = '#ff6600';
    ctx.beginPath();
    ctx.moveTo(sx - 3, sy + 1);
    ctx.quadraticCurveTo(sx + flicker1, sy - 6, sx + 1, sy + 1);
    ctx.fill();

    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.moveTo(sx - 1.5, sy);
    ctx.quadraticCurveTo(sx + flicker2, sy - 4, sx + 0.5, sy);
    ctx.fill();

    const glowAlpha = 0.06 + Math.sin(t * 0.8) * 0.02;
    const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, 50);
    gradient.addColorStop(0, `rgba(255, 150, 50, ${glowAlpha})`);
    gradient.addColorStop(1, 'rgba(255, 150, 50, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(sx - 50, sy - 50, 100, 100);
  }

  function drawFurnace(ctx, sx, sy, e) {
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

    ctx.fillStyle = '#2a0a0a';
    ctx.fillRect(sx - 3, sy - 2, 6, 5);
    ctx.fillStyle = 'rgba(255, 80, 20, 0.4)';
    ctx.fillRect(sx - 2, sy - 1, 4, 3);

    ctx.fillStyle = 'rgba(100,100,100,0.2)';
    const smokeY = sy - 10 - Math.sin(animTime * 0.003) * 2;
    ctx.beginPath();
    ctx.arc(sx, smokeY, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawWorkbench(ctx, sx, sy, e) {
    ctx.fillStyle = '#7a5a1a';
    ctx.fillRect(sx - 9, sy - 5, 18, 10);
    ctx.strokeStyle = '#5a4010';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx - 9, sy - 5, 18, 10);

    ctx.fillStyle = '#5a3a0a';
    ctx.fillRect(sx - 8, sy + 4, 2, 4);
    ctx.fillRect(sx + 6, sy + 4, 2, 4);

    ctx.fillStyle = '#888';
    ctx.fillRect(sx - 4, sy - 3, 3, 1.5);
    ctx.fillStyle = '#6a4a0a';
    ctx.fillRect(sx + 1, sy - 2, 4, 1);

    ctx.fillStyle = '#ddd';
    ctx.font = '6px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('WB', sx, sy + 2);
  }

  function drawToolCupboard(ctx, sx, sy, e) {
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(sx - 6, sy - 8, 12, 16);
    ctx.strokeStyle = '#3a2a0a';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx - 6, sy - 8, 12, 16);

    ctx.strokeStyle = '#4a2a0a';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(sx - 5, sy - 7, 4.5, 14);
    ctx.strokeRect(sx + 0.5, sy - 7, 4.5, 14);

    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.arc(sx - 1.5, sy, 0.8, 0, Math.PI * 2);
    ctx.arc(sx + 1.5, sy, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSleepingBag(ctx, sx, sy, e) {
    ctx.fillStyle = '#aa3333';
    ctx.beginPath();
    ctx.ellipse(sx, sy, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#882222';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#cc5555';
    ctx.beginPath();
    ctx.ellipse(sx + 5, sy, 3, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#666';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(sx - 7, sy);
    ctx.lineTo(sx + 3, sy);
    ctx.stroke();
  }

  function drawBed(ctx, sx, sy, e) {
    // Wooden frame
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(sx - 11, sy - 5, 22, 10);
    ctx.strokeStyle = '#4a3218';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx - 11, sy - 5, 22, 10);
    // Mattress (white/cream)
    ctx.fillStyle = '#d4c8a8';
    ctx.fillRect(sx - 9, sy - 4, 18, 8);
    // Pillow
    ctx.fillStyle = '#eee';
    ctx.beginPath();
    ctx.ellipse(sx + 6, sy, 3, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Blanket
    ctx.fillStyle = '#3a6a8a';
    ctx.fillRect(sx - 9, sy - 2, 12, 6);
  }

  function drawStorageBox(ctx, sx, sy, e) {
    ctx.fillStyle = '#7a5a2a';
    ctx.fillRect(sx - 10, sy - 7, 20, 14);
    ctx.strokeStyle = '#4a3a1a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sx - 10, sy - 7, 20, 14);

    ctx.strokeStyle = '#5a4a2a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx - 9, sy - 2);
    ctx.lineTo(sx + 9, sy - 2);
    ctx.stroke();

    ctx.fillStyle = '#888';
    ctx.fillRect(sx - 2, sy - 4, 4, 3);
  }

  function drawBarrel(ctx, sx, sy, e) {
    ctx.fillStyle = '#6a5030';
    ctx.beginPath();
    ctx.ellipse(sx, sy, 7, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4a3520';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(sx, sy - 4, 6.5, 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(sx, sy + 4, 6.5, 2, 0, 0, Math.PI * 2);
    ctx.stroke();
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
    ctx.strokeStyle = '#6a5a3a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx - 3, sy - 6);
    ctx.lineTo(sx, sy - 8);
    ctx.lineTo(sx + 3, sy - 6);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(60,50,30,0.3)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(sx - 4, sy - 2);
    ctx.lineTo(sx + 4, sy - 2);
    ctx.moveTo(sx - 5, sy + 2);
    ctx.lineTo(sx + 5, sy + 2);
    ctx.stroke();
  }

  // ── NPC Merchant ──
  function drawNPC(ctx, sx, sy, e) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 6, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(sx, sy);

    // Body (green robe)
    ctx.fillStyle = '#2a6a2a';
    ctx.fillRect(-7, -4, 14, 10);
    ctx.strokeStyle = '#1a4a1a';
    ctx.lineWidth = 1;
    ctx.strokeRect(-7, -4, 14, 10);

    // Arms
    ctx.fillStyle = '#2a6a2a';
    ctx.beginPath();
    ctx.arc(-8, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(8, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#d4a574';
    ctx.beginPath();
    ctx.arc(0, -9, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Hat/hood
    ctx.fillStyle = '#1a5a1a';
    ctx.beginPath();
    ctx.arc(0, -11, 6, Math.PI, 2 * Math.PI);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(-1.5, -10, 0.8, 0, Math.PI * 2);
    ctx.arc(1.5, -10, 0.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // "TRADE" label
    ctx.save();
    ctx.font = '8px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    const tw = ctx.measureText('TRADE').width;
    ctx.fillRect(sx - tw / 2 - 2, sy - 22, tw + 4, 10);
    ctx.fillStyle = '#4f4';
    ctx.fillText('TRADE', sx, sy - 14);
    ctx.restore();
  }

  // ── Loot Crate ──
  function drawLootCrate(ctx, sx, sy, e) {
    ctx.save();
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 5, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Crate body
    ctx.fillStyle = '#5a4a20';
    ctx.fillRect(sx - 8, sy - 6, 16, 12);
    ctx.strokeStyle = '#3a2a10';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx - 8, sy - 6, 16, 12);

    // Metal bands
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx - 8, sy - 1);
    ctx.lineTo(sx + 8, sy - 1);
    ctx.stroke();

    // Lock
    ctx.fillStyle = '#aa8';
    ctx.fillRect(sx - 2, sy - 3, 4, 3);

    // Glow effect for high-value
    const pulse = Math.sin(animTime * 0.005) * 0.15 + 0.15;
    ctx.fillStyle = `rgba(255, 220, 80, ${pulse})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ── Recycler ──
  function drawRecycler(ctx, sx, sy, e) {
    ctx.save();
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 6, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Machine body (grey metal box)
    ctx.fillStyle = '#556';
    ctx.fillRect(sx - 10, sy - 8, 20, 16);
    ctx.strokeStyle = '#334';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx - 10, sy - 8, 20, 16);

    // Conveyor belt (dark strip)
    ctx.fillStyle = '#333';
    ctx.fillRect(sx - 8, sy + 2, 16, 3);

    // Gear icon
    ctx.fillStyle = '#8a8';
    ctx.beginPath();
    ctx.arc(sx, sy - 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#6a6';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Label
    ctx.font = '7px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#afc';
    ctx.fillText('RECYCLE', sx, sy - 14);

    ctx.restore();
  }

  // ── Research Table ──
  function drawResearchTable(ctx, sx, sy, e) {
    ctx.save();
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 6, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Table surface (dark wood)
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(sx - 10, sy - 5, 20, 10);
    ctx.strokeStyle = '#3a2510';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx - 10, sy - 5, 20, 10);

    // Table legs
    ctx.fillStyle = '#4a3015';
    ctx.fillRect(sx - 8, sy + 5, 3, 3);
    ctx.fillRect(sx + 5, sy + 5, 3, 3);

    // Blueprint paper
    ctx.fillStyle = '#8ac';
    ctx.fillRect(sx - 5, sy - 3, 10, 6);
    ctx.strokeStyle = '#6a9';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(sx - 5, sy - 3, 10, 6);

    // Magnifying glass
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(sx + 2, sy - 1, 2.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx + 4, sy + 1);
    ctx.lineTo(sx + 6, sy + 3);
    ctx.stroke();

    // Label
    ctx.font = '7px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8cf';
    ctx.fillText('RESEARCH', sx, sy - 12);

    ctx.restore();
  }

  // ── Helicopter drawing ──
  function drawHelicopter(ctx, sx, sy, e) {
    ctx.save();
    const t = animTime * 0.001;

    // Shadow on ground
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(sx + 8, sy + 20, 18, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = '#3a3a3a';
    ctx.beginPath();
    ctx.ellipse(sx, sy, 20, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cockpit window
    ctx.fillStyle = '#6af';
    ctx.beginPath();
    ctx.ellipse(sx + 12, sy - 1, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tail
    ctx.fillStyle = '#333';
    ctx.fillRect(sx - 28, sy - 3, 12, 6);

    // Tail rotor
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1.5;
    const tailAngle = t * 40;
    ctx.beginPath();
    ctx.moveTo(sx - 28, sy - 5 + Math.sin(tailAngle) * 4);
    ctx.lineTo(sx - 28, sy + 5 + Math.sin(tailAngle + Math.PI) * 4);
    ctx.stroke();

    // Main rotor (spinning blades)
    ctx.strokeStyle = 'rgba(100,100,100,0.5)';
    ctx.lineWidth = 2;
    const rotorAngle = t * 25;
    for (let b = 0; b < 2; b++) {
      const a = rotorAngle + b * Math.PI;
      ctx.beginPath();
      ctx.moveTo(sx + Math.cos(a) * 25, sy - 8 + Math.sin(a) * 3);
      ctx.lineTo(sx + Math.cos(a + Math.PI) * 25, sy - 8 + Math.sin(a + Math.PI) * 3);
      ctx.stroke();
    }

    // Rotor hub
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.arc(sx, sy - 8, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ── Heli Crate drawing ──
  function drawHeliCrate(ctx, sx, sy, e) {
    ctx.save();
    const locked = e.locked;
    const t = animTime * 0.001;

    // Crate body
    ctx.fillStyle = locked ? '#8a5a20' : '#6a9a30';
    ctx.fillRect(sx - 12, sy - 10, 24, 20);

    // Metal bands
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sx - 12, sy - 10, 24, 20);
    ctx.beginPath();
    ctx.moveTo(sx, sy - 10);
    ctx.lineTo(sx, sy + 10);
    ctx.stroke();

    // Lock or open indicator
    if (locked) {
      // Lock icon
      ctx.fillStyle = '#c44';
      ctx.beginPath();
      ctx.arc(sx, sy - 2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(sx - 4, sy, 8, 6);

      // Pulsing lock glow
      const pulse = 0.3 + Math.sin(t * 3) * 0.2;
      ctx.strokeStyle = `rgba(255, 60, 60, ${pulse})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(sx - 14, sy - 12, 28, 24);
    } else {
      // Open indicator (green glow)
      ctx.fillStyle = '#4f4';
      ctx.font = '8px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('OPEN', sx, sy + 2);
    }

    // Label
    ctx.font = '7px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = locked ? '#f84' : '#4f4';
    ctx.fillText('HELI CRATE', sx, sy - 14);

    ctx.restore();
  }

  return { drawEntity, getAnimTime, updateAnimTime };
}
