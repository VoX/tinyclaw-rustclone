import { ITEM, ITEM_DEFS, RECIPES, CRAFT_TIER, HOTBAR_SLOTS, INVENTORY_SLOTS, STRUCT_TYPE, TILE_SIZE } from '../../shared/constants.js';
import { MSG, INV_ACTION, ENTITY_TYPE } from '../../shared/protocol.js';
import { setupInventory } from './inventory.js';
import { setupCrafting } from './crafting.js';
import { setupContainers } from './containers.js';
import { setupHUD } from './hud.js';

// Sanitize user-provided strings before inserting into DOM via innerHTML
function sanitizeHTML(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Image-based item icons ──
const itemIconImages = new Map(); // itemId -> Image (loaded)
const itemIconLoading = new Set(); // itemIds currently loading

function loadItemIcon(itemId) {
  if (itemIconImages.has(itemId) || itemIconLoading.has(itemId)) return;
  itemIconLoading.add(itemId);
  const img = new Image();
  img.onload = () => {
    itemIconImages.set(itemId, img);
    itemIconLoading.delete(itemId);
    iconCache.clear(); // invalidate cached canvases so they re-render with the image
  };
  img.onerror = () => {
    itemIconLoading.delete(itemId);
  };
  const basePath = window.location.pathname.replace(/\/+$/, '');
  img.src = `${basePath}/icons/icon_${itemId}.png`;
}

// Preload all item icons
for (const key of Object.keys(ITEM_DEFS)) {
  const id = Number(key);
  if (id > 0) loadItemIcon(id);
}

// ── Canvas-drawn item icons (fallback) ──
function drawItemIcon(ctx, x, y, size, itemId) {
  // Try image icon first
  const img = itemIconImages.get(itemId);
  if (img) {
    ctx.drawImage(img, x, y, size, size);
    return;
  }

  const def = ITEM_DEFS[itemId];
  if (!def) return;

  const cx = x + size / 2;
  const cy = y + size / 2;
  const s = size * 0.35;

  ctx.save();

  if (itemId === ITEM.ROCK) {
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.moveTo(cx - s, cy + s * 0.4);
    ctx.lineTo(cx - s * 0.5, cy - s * 0.6);
    ctx.lineTo(cx + s * 0.4, cy - s * 0.5);
    ctx.lineTo(cx + s, cy + s * 0.2);
    ctx.lineTo(cx + s * 0.3, cy + s * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  } else if (itemId === ITEM.TORCH) {
    ctx.strokeStyle = '#6a4a2a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy + s);
    ctx.lineTo(cx, cy - s * 0.3);
    ctx.stroke();
    ctx.fillStyle = '#ff8800';
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.5, s * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.55, s * 0.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Generic colored circle with first letter
    const colors = {
      tool: '#8899aa', melee: '#cc6644', ranged: '#aa8844',
      ammo: '#999966', building: '#886644', food: '#88aa44',
      resource: '#6688aa', medical: '#44aa66', armor: '#7788aa',
      deployable: '#887766', explosive: '#cc6644',
    };
    ctx.fillStyle = colors[def.cat] || '#888';
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.floor(s * 0.9)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((def.name || '?')[0], cx, cy);
  }

  ctx.restore();
}

// ── Icon caching ──
const iconCache = new Map();
function getItemIcon(itemId, size) {
  const key = `${itemId}_${size}`;
  if (iconCache.has(key)) return iconCache.get(key);
  const offscreen = document.createElement('canvas');
  offscreen.width = size;
  offscreen.height = size;
  const octx = offscreen.getContext('2d');
  drawItemIcon(octx, 0, 0, size, itemId);
  iconCache.set(key, offscreen);
  return offscreen;
}

export function createUI(state, send) {
  const invGrid = document.getElementById('inv-grid');
  const craftPanel = document.getElementById('craft-panel');
  const containerPanel = document.getElementById('container-panel');

  // Tooltip element (shared across all UI modules)
  const tooltip = document.createElement('div');
  tooltip.style.cssText = 'position:fixed;display:none;background:#111;border:1px solid #555;color:#ccc;padding:6px 10px;font:11px Consolas,monospace;pointer-events:none;z-index:9999;max-width:240px;white-space:pre-line;';
  document.body.appendChild(tooltip);

  function showItemTooltip(itemId, count, mx, my) {
    if (!itemId || itemId === 0) { tooltip.style.display = 'none'; return; }
    const def = ITEM_DEFS[itemId];
    if (!def) { tooltip.style.display = 'none'; return; }
    let text = `<b style="color:#e8c030">${sanitizeHTML(def.name)}</b>`;
    if (def.damage) text += `\nDamage: ${def.damage}`;
    if (def.fireRate) text += `\nFire Rate: ${def.fireRate}/s`;
    if (def.range) text += `\nRange: ${def.range}`;
    if (def.gatherMult) text += `\nGather: ${def.gatherMult}x`;
    if (def.maxStack > 1) text += `\nStack: ${count}/${def.maxStack}`;
    if (def.cat) text += `\nType: ${sanitizeHTML(def.cat)}`;
    const recipe = RECIPES.find(r => r.result === itemId);
    if (recipe) {
      text += '\n\n<span style="color:#888">Recipe:</span>';
      for (const [ingId, ingN] of recipe.ing) {
        const ingDef = ITEM_DEFS[ingId];
        text += `\n  ${sanitizeHTML(ingDef?.name || '?')} x${ingN}`;
      }
    }
    tooltip.innerHTML = text;
    tooltip.style.display = 'block';
    tooltip.style.left = (mx + 14) + 'px';
    tooltip.style.top = (my + 14) + 'px';
  }

  function createItemSlot(itemId, count, onClick) {
    const slotDiv = document.createElement('div');
    slotDiv.className = 'container-slot';
    slotDiv.style.cssText = 'width:48px;height:48px;position:relative;display:flex;align-items:center;justify-content:center;cursor:pointer;';
    if (itemId && count > 0) {
      const iconCanvas = document.createElement('canvas');
      iconCanvas.width = 36;
      iconCanvas.height = 36;
      iconCanvas.style.cssText = 'position:absolute;top:2px;left:6px;';
      drawItemIcon(iconCanvas.getContext('2d'), 0, 0, 36, itemId);
      slotDiv.appendChild(iconCanvas);
      const qtyEl = document.createElement('div');
      qtyEl.style.cssText = 'position:absolute;bottom:1px;right:3px;font-size:9px;color:#ddd;text-shadow:0 0 2px #000;';
      qtyEl.textContent = count > 1 ? count : '';
      slotDiv.appendChild(qtyEl);
      slotDiv.addEventListener('mouseenter', (e) => showItemTooltip(itemId, count, e.clientX, e.clientY));
      slotDiv.addEventListener('mousemove', (e) => showItemTooltip(itemId, count, e.clientX, e.clientY));
      slotDiv.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
      if (onClick) slotDiv.addEventListener('click', onClick);
    }
    return slotDiv;
  }

  // Shared context passed to sub-modules
  const shared = { drawItemIcon, showItemTooltip, tooltip, sanitizeHTML, createItemSlot, invGrid, craftPanel, containerPanel };

  // Initialize sub-modules
  const inv = setupInventory(state, send, shared);
  shared.createInventoryGrid = inv.createInventoryGrid;
  shared.playerInvGrid = inv.playerInvGrid;

  const crafting = setupCrafting(state, send, shared);
  const containers = setupContainers(state, send, shared);
  const hud = setupHUD(state, send, shared);

  function update() {
    hud.updateHUD({
      buildCraftPanel: crafting.buildCraftPanel,
      playerInvGrid: inv.playerInvGrid,
      updateArmorPanel: inv.updateArmorPanel,
      updateContainers: containers.updateContainers,
      renderNPCTrade: containers.renderNPCTrade,
      renderRecycler: containers.renderRecycler,
      renderResearchTable: containers.renderResearchTable,
      renderTcAuth: containers.renderTcAuth,
    });
  }

  return { update };
}
