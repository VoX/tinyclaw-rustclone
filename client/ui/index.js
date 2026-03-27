import { ITEM, ITEM_DEFS, RECIPES, CRAFT_TIER, HOTBAR_SLOTS, INVENTORY_SLOTS, STRUCT_TYPE, TILE_SIZE } from '../../shared/constants.js';
import { MSG, INV_ACTION, ENTITY_TYPE } from '../../shared/protocol.js';

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
  } else if (itemId === ITEM.WOOD) {
    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(cx - s * 0.2, cy - s * 0.7, s * 0.4, s * 1.4);
    ctx.fillStyle = '#6a4a2a';
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.7, s * 0.25, 0, Math.PI * 2);
    ctx.fill();
  } else if (itemId === ITEM.STONE) {
    ctx.fillStyle = '#999';
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  } else if (itemId === ITEM.METAL_ORE || itemId === ITEM.METAL_FRAGS) {
    ctx.fillStyle = itemId === ITEM.METAL_ORE ? '#b87333' : '#aaa';
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.6);
    ctx.lineTo(cx + s * 0.5, cy);
    ctx.lineTo(cx + s * 0.2, cy + s * 0.5);
    ctx.lineTo(cx - s * 0.4, cy + s * 0.3);
    ctx.lineTo(cx - s * 0.5, cy - s * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  } else if (itemId === ITEM.SULFUR_ORE || itemId === ITEM.SULFUR) {
    ctx.fillStyle = itemId === ITEM.SULFUR_ORE ? '#d4c84a' : '#e8d844';
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.7);
    ctx.lineTo(cx + s * 0.5, cy - s * 0.1);
    ctx.lineTo(cx + s * 0.2, cy + s * 0.5);
    ctx.lineTo(cx - s * 0.3, cy + s * 0.4);
    ctx.lineTo(cx - s * 0.5, cy - s * 0.2);
    ctx.closePath();
    ctx.fill();
  } else if (itemId === ITEM.CLOTH) {
    ctx.fillStyle = '#8a9a6a';
    ctx.fillRect(cx - s * 0.4, cy - s * 0.4, s * 0.8, s * 0.8);
    ctx.strokeStyle = '#6a7a4a';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.4, cy);
    ctx.lineTo(cx + s * 0.4, cy);
    ctx.stroke();
  } else if (itemId === ITEM.RAW_MEAT || itemId === ITEM.COOKED_MEAT) {
    ctx.fillStyle = itemId === ITEM.RAW_MEAT ? '#cc4444' : '#8a5533';
    ctx.beginPath();
    ctx.ellipse(cx, cy, s * 0.5, s * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    if (itemId === ITEM.COOKED_MEAT) {
      ctx.strokeStyle = '#5a3020';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.3, cy);
      ctx.lineTo(cx + s * 0.3, cy);
      ctx.stroke();
    }
  } else if (itemId === ITEM.BANDAGE) {
    ctx.fillStyle = '#eee';
    ctx.fillRect(cx - s * 0.15, cy - s * 0.5, s * 0.3, s);
    ctx.fillRect(cx - s * 0.5, cy - s * 0.15, s, s * 0.3);
    ctx.fillStyle = '#cc3333';
    ctx.fillRect(cx - s * 0.1, cy - s * 0.35, s * 0.2, s * 0.7);
    ctx.fillRect(cx - s * 0.35, cy - s * 0.1, s * 0.7, s * 0.2);
  } else if (def.cat === 'tool' || def.cat === 'melee') {
    // Generic tool shape
    ctx.strokeStyle = '#6a4a2a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.4, cy + s * 0.4);
    ctx.lineTo(cx + s * 0.2, cy - s * 0.2);
    ctx.stroke();
    const headColor = def.name.includes('Metal') ? '#888' : '#777';
    ctx.fillStyle = headColor;
    ctx.fillRect(cx + s * 0.1, cy - s * 0.5, s * 0.4, s * 0.35);
  } else if (def.cat === 'ranged') {
    // Generic gun/bow
    if (itemId === ITEM.HUNTING_BOW || itemId === ITEM.CROSSBOW) {
      ctx.strokeStyle = '#7a5a2a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.5, -1, 1);
      ctx.stroke();
      ctx.strokeStyle = '#aaa';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy - s * 0.45);
      ctx.lineTo(cx + s * 0.3, cy);
      ctx.lineTo(cx, cy + s * 0.45);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#555';
      ctx.fillRect(cx - s * 0.5, cy - s * 0.15, s, s * 0.3);
      ctx.fillStyle = '#444';
      ctx.fillRect(cx - s * 0.1, cy + s * 0.1, s * 0.25, s * 0.3);
    }
  } else if (def.cat === 'ammo') {
    ctx.fillStyle = '#aa8833';
    ctx.fillRect(cx - s * 0.08, cy - s * 0.4, s * 0.16, s * 0.6);
    ctx.fillStyle = '#cc6633';
    ctx.fillRect(cx - s * 0.12, cy + s * 0.1, s * 0.24, s * 0.2);
  } else if (def.cat === 'deployable') {
    ctx.fillStyle = '#6a5a3a';
    ctx.fillRect(cx - s * 0.4, cy - s * 0.4, s * 0.8, s * 0.8);
    ctx.strokeStyle = '#4a3a2a';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(cx - s * 0.4, cy - s * 0.4, s * 0.8, s * 0.8);
  } else if (def.cat === 'explosive') {
    ctx.fillStyle = '#664422';
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#aa8833';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.45);
    ctx.lineTo(cx + s * 0.1, cy - s * 0.7);
    ctx.stroke();
  } else if (itemId === ITEM.HAZMAT_SUIT) {
    // Hazmat suit: yellow circle body
    ctx.fillStyle = '#cc9900';
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#886600';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Visor
    ctx.fillStyle = '#334';
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.1, s * 0.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (itemId === ITEM.SCRAP) {
    // Scrap: jagged metal piece
    ctx.fillStyle = '#999';
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.4, cy - s * 0.2);
    ctx.lineTo(cx - s * 0.1, cy - s * 0.5);
    ctx.lineTo(cx + s * 0.3, cy - s * 0.3);
    ctx.lineTo(cx + s * 0.5, cy + s * 0.1);
    ctx.lineTo(cx + s * 0.1, cy + s * 0.5);
    ctx.lineTo(cx - s * 0.3, cy + s * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  } else {
    // Fallback: colored square
    ctx.fillStyle = '#888';
    ctx.fillRect(cx - s * 0.35, cy - s * 0.35, s * 0.7, s * 0.7);
  }

  ctx.restore();
}

// Create offscreen icon cache
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
  const hud = document.getElementById('hud');
  const inventoryScreen = document.getElementById('inventory-screen');
  const deathScreen = document.getElementById('death-screen');
  const craftPanel = document.getElementById('craft-panel');
  const invGrid = document.getElementById('inv-grid');
  const hotbarEl = document.getElementById('hotbar');
  const containerScreen = document.getElementById('container-screen');
  const containerPanel = document.getElementById('container-panel');
  const tcAuthScreen = document.getElementById('tc-auth-screen');
  const tcAuthPanel = document.getElementById('tc-auth-panel');

  // HUD elements
  const hpBar = document.getElementById('hp-bar-fill');
  const hungerBar = document.getElementById('hunger-bar-fill');
  const thirstBar = document.getElementById('thirst-bar-fill');
  const hpText = document.getElementById('hp-text');
  const itemNameEl = document.getElementById('item-name');
  const pingEl = document.getElementById('ping-display');

  // Dragging state for inventory
  let dragSlot = -1;

  // Tooltip element
  const tooltip = document.createElement('div');
  tooltip.style.cssText = 'position:fixed;display:none;background:#111;border:1px solid #555;color:#ccc;padding:6px 10px;font:11px Consolas,monospace;pointer-events:none;z-index:9999;max-width:240px;white-space:pre-line;';
  document.body.appendChild(tooltip);

  function showItemTooltip(itemId, count, mx, my) {
    if (!itemId || itemId === 0) { tooltip.style.display = 'none'; return; }
    const def = ITEM_DEFS[itemId];
    if (!def) { tooltip.style.display = 'none'; return; }
    let text = `<b style="color:#e8c030">${def.name}</b>`;
    if (def.damage) text += `\nDamage: ${def.damage}`;
    if (def.fireRate) text += `\nFire Rate: ${def.fireRate}/s`;
    if (def.range) text += `\nRange: ${def.range}`;
    if (def.gatherMult) text += `\nGather: ${def.gatherMult}x`;
    if (def.maxStack > 1) text += `\nStack: ${count}/${def.maxStack}`;
    if (def.cat) text += `\nType: ${def.cat}`;
    const recipe = RECIPES.find(r => r.result === itemId);
    if (recipe) {
      text += '\n\n<span style="color:#888">Recipe:</span>';
      for (const [ingId, ingN] of recipe.ing) {
        const ingDef = ITEM_DEFS[ingId];
        text += `\n  ${ingDef?.name || '?'} x${ingN}`;
      }
    }
    tooltip.innerHTML = text;
    tooltip.style.display = 'block';
    tooltip.style.left = (mx + 14) + 'px';
    tooltip.style.top = (my + 14) + 'px';
  }

  function showTooltip(slotIdx, mx, my) {
    const item = state.inventory[slotIdx];
    if (!item?.id) { tooltip.style.display = 'none'; return; }
    showItemTooltip(item.id, item.n, mx, my);
  }

  // Reusable icon slot for container UIs
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

  // Smoothed bar values for animation
  let smoothHp = 100;
  let smoothHunger = 100;
  let smoothThirst = 100;

  // Build inventory grid with canvas icons
  function buildInvGrid() {
    invGrid.innerHTML = '';
    for (let i = 0; i < INVENTORY_SLOTS; i++) {
      const slot = document.createElement('div');
      slot.className = 'inv-slot';
      slot.dataset.slot = i;

      // Icon canvas
      const iconCanvas = document.createElement('canvas');
      iconCanvas.width = 40;
      iconCanvas.height = 40;
      iconCanvas.className = 'inv-icon-canvas';
      slot.appendChild(iconCanvas);

      const nameEl = document.createElement('div');
      nameEl.className = 'slot-item';
      slot.appendChild(nameEl);

      const qtyEl = document.createElement('div');
      qtyEl.className = 'slot-qty';
      slot.appendChild(qtyEl);

      slot.addEventListener('mousedown', (e) => {
        if (e.button === 2) {
          e.preventDefault();
          send({ type: MSG.INVENTORY, action: INV_ACTION.SPLIT, fromSlot: i });
        } else {
          dragSlot = i;
        }
      });

      slot.addEventListener('mouseup', (e) => {
        if (dragSlot >= 0 && dragSlot !== i) {
          send({ type: MSG.INVENTORY, action: INV_ACTION.MOVE, fromSlot: dragSlot, toSlot: i });
          dragSlot = -1;
        }
      });

      slot.addEventListener('dblclick', () => {
        // Double-click: equip if armor, else drop
        const item = state.inventory[i];
        if (item?.id && ITEM_DEFS[item.id]?.cat === 'armor') {
          send({ type: MSG.INVENTORY, action: INV_ACTION.EQUIP_ARMOR, fromSlot: i });
        } else {
          send({ type: MSG.INVENTORY, action: INV_ACTION.DROP, fromSlot: i });
        }
      });

      slot.addEventListener('mouseenter', (e) => showTooltip(i, e.clientX, e.clientY));
      slot.addEventListener('mousemove', (e) => showTooltip(i, e.clientX, e.clientY));
      slot.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });

      invGrid.appendChild(slot);
    }
  }
  buildInvGrid();

  // Build craft panel with item icons — dynamic, updates on inventory changes
  let lastCraftHash = '';
  let selectedCraftCategory = 'All';
  const CRAFT_CATEGORIES = ['All', 'Tools', 'Weapons', 'Building', 'Armor', 'Resources', 'Other'];
  const CRAFT_CAT_MAP = {
    'Tools': ['tool'],
    'Weapons': ['melee', 'ranged', 'ammo', 'explosive'],
    'Building': ['building', 'deployable'],
    'Armor': ['armor'],
    'Resources': ['resource', 'food', 'medical'],
  };
  function getRecipeCategory(recipe) {
    const def = ITEM_DEFS[recipe.result];
    if (!def) return 'Other';
    for (const [tab, cats] of Object.entries(CRAFT_CAT_MAP)) {
      if (cats.includes(def.cat)) return tab;
    }
    return 'Other';
  }
  function buildCraftPanel() {
    // Compute inventory resource counts
    const invCounts = {};
    for (let i = 0; i < INVENTORY_SLOTS; i++) {
      const item = state.inventory[i];
      if (item?.id && item.id !== 0) {
        invCounts[item.id] = (invCounts[item.id] || 0) + item.n;
      }
    }

    // Simple hash to avoid rebuilding every frame
    const hash = JSON.stringify(invCounts) + ':' + state.workbenchTier + ':' + selectedCraftCategory;
    if (hash === lastCraftHash) return;
    lastCraftHash = hash;

    const wbTier = state.workbenchTier || 0;

    // Sort recipes: craftable first, then by tier
    const sorted = [...RECIPES].sort((a, b) => {
      const aCraftable = canCraftRecipe(a, invCounts, wbTier) ? 0 : 1;
      const bCraftable = canCraftRecipe(b, invCounts, wbTier) ? 0 : 1;
      if (aCraftable !== bCraftable) return aCraftable - bCraftable;
      return a.tier - b.tier;
    });

    craftPanel.innerHTML = '<h3>Crafting</h3>';

    // Category tabs
    const tabBar = document.createElement('div');
    tabBar.style.cssText = 'display:flex;flex-wrap:wrap;gap:2px;margin-bottom:6px;';
    for (const cat of CRAFT_CATEGORIES) {
      const tab = document.createElement('button');
      tab.textContent = cat;
      tab.style.cssText = 'padding:3px 8px;border:1px solid #555;background:' +
        (cat === selectedCraftCategory ? '#555' : '#2a2a2a') +
        ';color:#ccc;cursor:pointer;font-size:11px;border-radius:3px;';
      tab.addEventListener('click', () => {
        selectedCraftCategory = cat;
        lastCraftHash = '';
        buildCraftPanel();
      });
      tabBar.appendChild(tab);
    }
    craftPanel.appendChild(tabBar);

    // Filter recipes by selected category
    const filtered = selectedCraftCategory === 'All' ? sorted : sorted.filter(r => getRecipeCategory(r) === selectedCraftCategory);

    for (const recipe of filtered) {
      const btn = document.createElement('div');
      btn.className = 'craft-recipe';

      const resultDef = ITEM_DEFS[recipe.result];
      const tierNeeded = recipe.tier;
      const hasTier = wbTier >= tierNeeded;
      const hasResources = recipe.ing.every(([id, n]) => (invCounts[id] || 0) >= n);
      const craftable = hasTier && hasResources;

      // Tier label
      const tierNames = { 0: '', 1: 'Workbench T1', 2: 'Workbench T2', 3: 'Workbench T3' };
      let tierLabel = '';
      if (tierNeeded > 0) {
        tierLabel = hasTier
          ? ` <span style="color:#8a8">[${tierNames[tierNeeded]}]</span>`
          : ` <span style="color:#a44">[Need ${tierNames[tierNeeded]}]</span>`;
      }

      // Ingredient text with have/need coloring
      let ingText = recipe.ing.map(([id, n]) => {
        const have = invCounts[id] || 0;
        const color = have >= n ? '#8a8' : '#a44';
        return `<span style="color:${color}">${ITEM_DEFS[id]?.name || '?'} ${have}/${n}</span>`;
      }).join(', ');

      // Icon + info container
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '8px';

      const iconCanvas = document.createElement('canvas');
      iconCanvas.width = 28;
      iconCanvas.height = 28;
      iconCanvas.style.flexShrink = '0';
      drawItemIcon(iconCanvas.getContext('2d'), 0, 0, 28, recipe.result);
      row.appendChild(iconCanvas);

      const info = document.createElement('div');
      info.innerHTML = `
        <div class="craft-name">${resultDef?.name || '?'} x${recipe.count}${tierLabel}</div>
        <div class="craft-cost">${ingText}</div>
      `;
      row.appendChild(info);

      btn.appendChild(row);

      if (!craftable) {
        btn.style.opacity = '0.5';
      }

      btn.addEventListener('click', () => {
        send({ type: MSG.CRAFT, recipeId: recipe.id });
      });

      craftPanel.appendChild(btn);
    }
  }

  function canCraftRecipe(recipe, invCounts, wbTier) {
    if (recipe.tier > wbTier) return false;
    return recipe.ing.every(([id, n]) => (invCounts[id] || 0) >= n);
  }

  buildCraftPanel();

  // Death screen
  document.getElementById('respawn-beach').addEventListener('click', () => {
    send({ type: MSG.RESPAWN, bagEid: null });
    state.spawnBags = [];
  });

  // Build menu
  let buildMode = false;
  let buildPiece = STRUCT_TYPE.FOUNDATION;

  document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyB') {
      const held = state.inventory[state.selectedSlot]?.id;
      if (held === ITEM.BUILDING_PLAN) {
        buildMode = !buildMode;
        document.getElementById('build-menu').style.display = buildMode ? 'flex' : 'none';
      }
    }
  });

  const buildOptions = [
    { type: STRUCT_TYPE.FOUNDATION, label: 'Foundation' },
    { type: STRUCT_TYPE.WALL, label: 'Wall' },
    { type: STRUCT_TYPE.DOORWAY, label: 'Doorway' },
    { type: STRUCT_TYPE.CEILING, label: 'Ceiling' },
    { type: STRUCT_TYPE.STAIRS, label: 'Stairs' },
  ];

  const buildMenu = document.getElementById('build-menu');
  for (const opt of buildOptions) {
    const btn = document.createElement('button');
    btn.className = 'build-btn';
    btn.textContent = opt.label;
    btn.addEventListener('click', () => {
      buildPiece = opt.type;
      state.buildPiece = opt.type;
      buildMode = false;
      buildMenu.style.display = 'none';
    });
    buildMenu.appendChild(btn);
  }

  // Place building or hammer upgrade on click
  document.getElementById('game-canvas').addEventListener('click', (e) => {
    if (state.showInventory) return;
    const held = state.inventory[state.selectedSlot]?.id;

    const me = state.entities.get(state.myEid);
    if (!me) return;

    const canvas = e.target;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const viewScale = 24;
    const tileSize = state.tileSize;

    const worldX = me.x + (e.clientX - cx) * tileSize / viewScale;
    const worldY = me.y + (e.clientY - cy) * tileSize / viewScale;

    // Hammer upgrade: find nearest structure to click point
    if (held === ITEM.HAMMER) {
      let nearestEid = null;
      let nearestDist = 4; // max click distance in world units
      for (const [eid, ent] of state.entities) {
        if (ent.t !== ENTITY_TYPE.STRUCTURE) continue;
        const ex = ent.renderX || ent.x;
        const ey = ent.renderY || ent.y;
        const dx = ex - worldX;
        const dy = ey - worldY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestEid = eid;
        }
      }
      if (nearestEid !== null) {
        send({ type: MSG.HAMMER_UPGRADE, targetEid: nearestEid });
      }
      return;
    }

    if (held === ITEM.BUILDING_PLAN || held === ITEM.SLEEPING_BAG ||
        held === ITEM.CAMPFIRE_ITEM || held === ITEM.FURNACE_ITEM ||
        held === ITEM.TOOL_CUPBOARD_ITEM || held === ITEM.WORKBENCH_T1_ITEM ||
        held === ITEM.WORKBENCH_T2_ITEM || held === ITEM.WORKBENCH_T3_ITEM ||
        held === ITEM.STORAGE_BOX || held === ITEM.BED) {

      const pieceType = held === ITEM.BUILDING_PLAN ? buildPiece : 1;

      send({
        type: MSG.BUILD,
        pieceType,
        x: worldX,
        y: worldY,
      });
    }
  });

  // Right-click with hammer to repair
  document.getElementById('game-canvas').addEventListener('contextmenu', (e) => {
    const held = state.inventory[state.selectedSlot]?.id;
    if (held !== ITEM.HAMMER) return;
    const me = state.entities.get(state.myEid);
    if (!me) return;
    const canvas = e.target;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const viewScale = 24;
    const tileSize = state.tileSize;
    const worldX = me.x + (e.clientX - cx) * tileSize / viewScale;
    const worldY = me.y + (e.clientY - cy) * tileSize / viewScale;
    let nearestEid = null;
    let nearestDist = 4;
    for (const [eid, ent] of state.entities) {
      if (ent.t !== ENTITY_TYPE.STRUCTURE) continue;
      const ex = ent.renderX || ent.x;
      const ey = ent.renderY || ent.y;
      const dx = ex - worldX;
      const dy = ey - worldY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestEid = eid;
      }
    }
    if (nearestEid !== null) {
      send({ type: MSG.HAMMER_REPAIR, targetEid: nearestEid });
    }
  });

  // Hotbar icon canvases
  function initHotbarIcons() {
    const slots = hotbarEl.children;
    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      const slot = slots[i];
      if (!slot) continue;
      if (!slot.querySelector('.hotbar-icon-canvas')) {
        const iconCanvas = document.createElement('canvas');
        iconCanvas.width = 32;
        iconCanvas.height = 32;
        iconCanvas.className = 'hotbar-icon-canvas';
        slot.insertBefore(iconCanvas, slot.firstChild);
      }
    }
  }
  initHotbarIcons();

  function update() {
    // Smooth bar animations
    const lerp = 0.12;
    const targetHp = (state.hp / state.maxHp) * 100;
    const targetHunger = state.hunger;
    const targetThirst = state.thirst;
    smoothHp += (targetHp - smoothHp) * lerp;
    smoothHunger += (targetHunger - smoothHunger) * lerp;
    smoothThirst += (targetThirst - smoothThirst) * lerp;

    // HUD bars
    if (hpBar) {
      hpBar.style.width = `${smoothHp}%`;
    }
    if (hungerBar) hungerBar.style.width = `${smoothHunger}%`;
    if (thirstBar) thirstBar.style.width = `${smoothThirst}%`;
    if (hpText) hpText.textContent = `${state.hp} HP`;

    // Active item name
    const heldItem = state.inventory[state.selectedSlot];
    if (itemNameEl) {
      itemNameEl.textContent = heldItem?.id ? (ITEM_DEFS[heldItem.id]?.name || '') : '';
    }

    // Ping
    if (pingEl) pingEl.textContent = `${state.ping}ms`;

    // Update hotbar with icons
    if (hotbarEl) {
      const slots = hotbarEl.children;
      for (let i = 0; i < HOTBAR_SLOTS; i++) {
        const slot = slots[i];
        if (!slot) continue;
        const item = state.inventory[i];
        const isSelected = i === state.selectedSlot;
        slot.className = `hotbar-slot${isSelected ? ' selected' : ''}`;

        const iconCanvas = slot.querySelector('.hotbar-icon-canvas');
        const nameSpan = slot.querySelector('.slot-name');
        const countSpan = slot.querySelector('.slot-count');
        const keySpan = slot.querySelector('.slot-key');

        if (item?.id && item.id !== 0) {
          // Draw item icon on canvas
          if (iconCanvas) {
            const ictx = iconCanvas.getContext('2d');
            ictx.clearRect(0, 0, 32, 32);
            drawItemIcon(ictx, 0, 0, 32, item.id);
            iconCanvas.style.display = 'block';
          }

          // Draw durability bar if applicable
          const itemDef = ITEM_DEFS[item.id];
          if (iconCanvas && itemDef && itemDef.durability && item.d > 0) {
            const ictx2 = iconCanvas.getContext('2d');
            const maxDur = itemDef.durability;
            const pct = item.d / maxDur;
            const barW = 28;
            const barH = 3;
            const barX = 2;
            const barY = 27;
            ictx2.fillStyle = '#333';
            ictx2.fillRect(barX, barY, barW, barH);
            ictx2.fillStyle = pct > 0.5 ? '#4a4' : pct > 0.2 ? '#aa4' : '#a44';
            ictx2.fillRect(barX, barY, barW * pct, barH);
          }

          // Update or create text elements
          let sn = nameSpan;
          if (!sn) {
            sn = document.createElement('span');
            sn.className = 'slot-name';
            slot.appendChild(sn);
          }
          sn.textContent = '';
          slot.title = ITEM_DEFS[item.id]?.name || '';

          if (item.n > 1) {
            let sc = countSpan;
            if (!sc) {
              sc = document.createElement('span');
              sc.className = 'slot-count';
              slot.appendChild(sc);
            }
            sc.textContent = item.n;
            sc.style.display = '';
          } else if (countSpan) {
            countSpan.style.display = 'none';
          }

          if (keySpan) keySpan.style.display = 'none';
        } else {
          if (iconCanvas) {
            const ictx = iconCanvas.getContext('2d');
            ictx.clearRect(0, 0, 32, 32);
            iconCanvas.style.display = 'none';
          }
          if (nameSpan) nameSpan.textContent = '';
          if (countSpan) countSpan.style.display = 'none';
          slot.title = '';

          let ks = keySpan;
          if (!ks) {
            ks = document.createElement('span');
            ks.className = 'slot-key';
            slot.appendChild(ks);
          }
          ks.textContent = i + 1;
          ks.style.display = '';
        }
      }
    }

    // Inventory screen
    if (inventoryScreen) {
      inventoryScreen.style.display = state.showInventory ? 'flex' : 'none';
    }

    // Update craft panel when inventory is open
    if (state.showInventory) {
      buildCraftPanel();
    }

    // Update armor equipment slots (shown in inventory screen)
    if (state.showInventory) {
      let armorPanel = document.getElementById('armor-panel');
      if (!armorPanel) {
        armorPanel = document.createElement('div');
        armorPanel.id = 'armor-panel';
        armorPanel.style.cssText = 'display:flex;gap:4px;margin-bottom:8px;justify-content:center;';
        const armorSlots = ['Head', 'Chest', 'Legs'];
        for (let i = 0; i < 3; i++) {
          const slotDiv = document.createElement('div');
          slotDiv.className = 'inv-slot armor-slot';
          slotDiv.dataset.armorSlot = i;
          slotDiv.style.cssText = 'position:relative;border:2px solid #666;';
          const label = document.createElement('div');
          label.className = 'armor-label';
          label.textContent = armorSlots[i];
          label.style.cssText = 'font-size:8px;color:#888;position:absolute;top:1px;left:2px;';
          slotDiv.appendChild(label);
          const iconCanvas = document.createElement('canvas');
          iconCanvas.width = 40;
          iconCanvas.height = 40;
          iconCanvas.className = 'armor-icon-canvas';
          slotDiv.appendChild(iconCanvas);
          const nameEl = document.createElement('div');
          nameEl.className = 'armor-item-name';
          nameEl.style.cssText = 'font-size:8px;color:#ccc;text-align:center;';
          slotDiv.appendChild(nameEl);
          // Click to unequip
          slotDiv.addEventListener('click', () => {
            send({ type: MSG.INVENTORY, action: INV_ACTION.UNEQUIP_ARMOR, fromSlot: i });
          });
          armorPanel.appendChild(slotDiv);
        }
        invGrid.parentElement.insertBefore(armorPanel, invGrid);
      }
      // Update armor slot visuals
      const armorItems = [state.armor.head, state.armor.chest, state.armor.legs];
      const armorSlotDivs = armorPanel.children;
      for (let i = 0; i < 3; i++) {
        const slotDiv = armorSlotDivs[i];
        const iconCanvas = slotDiv.querySelector('.armor-icon-canvas');
        const nameEl = slotDiv.querySelector('.armor-item-name');
        const itemId = armorItems[i];
        if (itemId && itemId !== 0) {
          const ictx = iconCanvas.getContext('2d');
          ictx.clearRect(0, 0, 40, 40);
          drawItemIcon(ictx, 0, 0, 40, itemId);
          iconCanvas.style.display = 'block';
          nameEl.textContent = ITEM_DEFS[itemId]?.name || '';
          slotDiv.style.borderColor = '#8a6a3a';
        } else {
          const ictx = iconCanvas.getContext('2d');
          ictx.clearRect(0, 0, 40, 40);
          iconCanvas.style.display = 'none';
          nameEl.textContent = '';
          slotDiv.style.borderColor = '#666';
        }
      }
    }

    // Update inventory grid with canvas icons
    if (state.showInventory && invGrid) {
      const slots = invGrid.children;
      for (let i = 0; i < INVENTORY_SLOTS; i++) {
        const slot = slots[i];
        if (!slot) continue;
        const item = state.inventory[i];
        const iconCanvas = slot.querySelector('.inv-icon-canvas');
        const nameEl = slot.querySelector('.slot-item');
        const qtyEl = slot.querySelector('.slot-qty');

        if (item?.id && item.id !== 0) {
          const def = ITEM_DEFS[item.id];
          if (iconCanvas) {
            const ictx = iconCanvas.getContext('2d');
            ictx.clearRect(0, 0, 40, 40);
            drawItemIcon(ictx, 0, 0, 40, item.id);
            iconCanvas.style.display = 'block';
          }
          if (nameEl) nameEl.textContent = '';
          slot.title = def?.name || '';
          if (qtyEl) {
            qtyEl.textContent = item.n > 1 ? item.n : '';
            qtyEl.style.display = item.n > 1 ? '' : 'none';
          }
          slot.classList.add('has-item');
        } else {
          if (iconCanvas) {
            const ictx = iconCanvas.getContext('2d');
            ictx.clearRect(0, 0, 40, 40);
            iconCanvas.style.display = 'none';
          }
          if (nameEl) nameEl.textContent = '';
          slot.title = '';
          if (qtyEl) {
            qtyEl.textContent = '';
            qtyEl.style.display = 'none';
          }
          slot.classList.remove('has-item');
        }
      }
    }

    // Death screen
    if (deathScreen) {
      deathScreen.style.display = state.isDead ? 'flex' : 'none';
      // Show death stats + respawn timer
      const deathStats = document.getElementById('death-stats');
      if (deathStats && state.isDead && state.deathInfo) {
        const info = state.deathInfo;
        const mins = Math.floor(info.survived / 60);
        const secs = info.survived % 60;
        const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        const elapsed = Date.now() - (state.deathTime || 0);
        const remaining = Math.max(0, Math.ceil((state.respawnTime - elapsed) / 1000));
        const timerText = remaining > 0 ? `<br><span style="color:#ff8;font-size:18px;">Respawn in ${remaining}s</span>` : '';
        const resText = info.resourcesGathered > 0 ? `<br>Resources gathered: <span style="color:#8d8">${info.resourcesGathered}</span>` : '';
        deathStats.innerHTML = `Killed by <span style="color:#e44">${info.killerName}</span><br>Survived: ${timeStr}${resText}${timerText}`;
      }
      // Respawn button enable/disable
      const canRespawn = Date.now() - (state.deathTime || 0) >= state.respawnTime;
      const respawnBeachBtn = document.getElementById('respawn-beach');
      if (respawnBeachBtn) {
        respawnBeachBtn.disabled = !canRespawn;
        respawnBeachBtn.style.opacity = canRespawn ? '1' : '0.4';
        respawnBeachBtn.style.pointerEvents = canRespawn ? '' : 'none';
      }
      // Update spawn bag buttons
      const bagContainer = document.getElementById('spawn-bags');
      if (bagContainer && state.isDead) {
        const bags = state.spawnBags || [];
        const currentBtns = bagContainer.querySelectorAll('.bag-spawn-btn');
        if (currentBtns.length !== bags.length) {
          bagContainer.innerHTML = '';
          for (const bag of bags) {
            const btn = document.createElement('button');
            btn.className = 'bag-spawn-btn';
            btn.textContent = `${bag.isBed ? 'Bed' : 'Sleeping Bag'} (${bag.x}, ${bag.y})`;
            btn.style.cssText = 'padding:10px 24px;font-size:13px;background:rgba(40,40,40,0.9);color:#ddd;border:2px solid #555;border-radius:6px;cursor:pointer;z-index:1;text-transform:uppercase;letter-spacing:1px;margin:4px;';
            btn.addEventListener('click', () => {
              if (Date.now() - (state.deathTime || 0) < state.respawnTime) return;
              send({ type: MSG.RESPAWN, bagEid: bag.eid });
              state.spawnBags = [];
            });
            btn.addEventListener('mouseenter', () => { btn.style.borderColor = '#999'; btn.style.color = '#fff'; });
            btn.addEventListener('mouseleave', () => { btn.style.borderColor = '#555'; btn.style.color = '#ddd'; });
            bagContainer.appendChild(btn);
          }
        }
        // Disable bag buttons during countdown too
        for (const btn of bagContainer.querySelectorAll('.bag-spawn-btn')) {
          btn.style.opacity = canRespawn ? '1' : '0.4';
          btn.style.pointerEvents = canRespawn ? '' : 'none';
        }
      }
    }

    // Container screen
    if (containerScreen) {
      if (state.containerOpen) {
        containerScreen.style.display = 'flex';
        renderContainer(state.containerOpen);
      } else {
        containerScreen.style.display = 'none';
      }
    }

    // TC Auth screen
    if (tcAuthScreen) {
      if (state.tcAuthOpen) {
        tcAuthScreen.style.display = 'flex';
        renderTcAuth(state.tcAuthOpen);
      } else {
        tcAuthScreen.style.display = 'none';
      }
    }

    // NPC Trade screen
    renderNPCTrade();
    // Recycler screen
    renderRecycler();
    // Research table screen
    renderResearchTable();
  }

  // Close container/TC/NPC/recycler/research on Escape
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      state.containerOpen = null;
      state.tcAuthOpen = null;
      state.npcTradeOpen = null;
      state.recyclerOpen = null;
      state.researchOpen = null;
    }
  });

  // NPC Trade UI
  let npcTradeEl = null;
  let lastNpcTradeKey = '';
  function renderNPCTrade() {
    if (!state.npcTradeOpen) {
      if (npcTradeEl) npcTradeEl.style.display = 'none';
      lastNpcTradeKey = '';
      return;
    }
    const key = JSON.stringify(state.npcTradeOpen);
    if (key === lastNpcTradeKey) {
      if (npcTradeEl) npcTradeEl.style.display = 'flex';
      return;
    }
    lastNpcTradeKey = key;

    if (!npcTradeEl) {
      npcTradeEl = document.createElement('div');
      npcTradeEl.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:100;display:flex;justify-content:center;align-items:center;backdrop-filter:blur(2px);';
      document.body.appendChild(npcTradeEl);
    }
    npcTradeEl.style.display = 'flex';
    npcTradeEl.innerHTML = '';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:rgba(25,25,25,0.97);border:1px solid rgba(100,100,100,0.4);border-radius:6px;padding:16px;min-width:280px;max-width:400px;';

    const h = document.createElement('h3');
    h.textContent = 'Merchant';
    h.style.cssText = 'font-size:14px;margin-bottom:12px;color:#ddd;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #333;padding-bottom:6px;';
    panel.appendChild(h);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'container-btn container-close';
    closeBtn.textContent = 'X';
    closeBtn.style.cssText = 'float:right;margin-top:-30px;padding:4px 10px;background:rgba(60,60,60,0.8);color:#eee;border:1px solid #555;border-radius:4px;cursor:pointer;font-size:11px;';
    closeBtn.addEventListener('click', () => { state.npcTradeOpen = null; });
    panel.appendChild(closeBtn);

    // Count player scrap
    let scrapCount = 0;
    for (let i = 0; i < INVENTORY_SLOTS; i++) {
      if (state.inventory[i]?.id === ITEM.SCRAP) scrapCount += state.inventory[i].n;
    }

    const scrapInfo = document.createElement('div');
    scrapInfo.style.cssText = 'font-size:11px;color:#e8c030;margin-bottom:10px;';
    scrapInfo.textContent = `Your Scrap: ${scrapCount}`;
    panel.appendChild(scrapInfo);

    for (const trade of state.npcTradeOpen.trades) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 8px;margin-bottom:4px;background:rgba(40,40,40,0.8);border:1px solid rgba(80,80,80,0.4);border-radius:4px;';

      // Item icon
      const iconCanvas = document.createElement('canvas');
      iconCanvas.width = 32;
      iconCanvas.height = 32;
      iconCanvas.style.flexShrink = '0';
      drawItemIcon(iconCanvas.getContext('2d'), 0, 0, 32, trade.itemId || 0);
      row.appendChild(iconCanvas);

      const info = document.createElement('span');
      info.style.cssText = 'font-size:11px;color:#ccc;flex:1;';
      info.textContent = `${trade.itemName} x${trade.count}`;
      row.appendChild(info);

      // Tooltip on row
      if (trade.itemId) {
        row.addEventListener('mouseenter', (e) => showItemTooltip(trade.itemId, trade.count, e.clientX, e.clientY));
        row.addEventListener('mousemove', (e) => showItemTooltip(trade.itemId, trade.count, e.clientX, e.clientY));
        row.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
      }

      const btn = document.createElement('button');
      btn.style.cssText = 'padding:4px 12px;font-size:10px;background:rgba(60,60,60,0.8);color:#eee;border:1px solid #555;border-radius:4px;cursor:pointer;';
      btn.textContent = `${trade.cost} Scrap`;
      const canAfford = scrapCount >= trade.cost;
      if (!canAfford) {
        btn.style.opacity = '0.4';
        btn.style.pointerEvents = 'none';
      }
      btn.addEventListener('click', () => {
        send({ type: MSG.NPC_TRADE_BUY, npcEid: state.npcTradeOpen.npcEid, tradeIdx: trade.idx });
        state.npcTradeOpen = null;
      });
      row.appendChild(btn);
      panel.appendChild(row);
    }

    npcTradeEl.appendChild(panel);
  }

  // Recycler UI
  let recyclerEl = null;
  let lastRecyclerKey = '';
  function renderRecycler() {
    if (!state.recyclerOpen) {
      if (recyclerEl) recyclerEl.style.display = 'none';
      lastRecyclerKey = '';
      return;
    }
    const key = JSON.stringify(state.recyclerOpen);
    if (key === lastRecyclerKey) {
      if (recyclerEl) recyclerEl.style.display = 'flex';
      return;
    }
    lastRecyclerKey = key;

    if (!recyclerEl) {
      recyclerEl = document.createElement('div');
      recyclerEl.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:100;display:flex;justify-content:center;align-items:center;backdrop-filter:blur(2px);';
      document.body.appendChild(recyclerEl);
    }
    recyclerEl.style.display = 'flex';
    recyclerEl.innerHTML = '';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:rgba(25,25,25,0.97);border:1px solid rgba(100,100,100,0.4);border-radius:6px;padding:16px;min-width:280px;max-width:400px;max-height:70vh;overflow-y:auto;';

    const h = document.createElement('h3');
    h.textContent = 'Recycler';
    h.style.cssText = 'font-size:14px;margin-bottom:8px;color:#afc;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #333;padding-bottom:6px;';
    panel.appendChild(h);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'X';
    closeBtn.style.cssText = 'float:right;margin-top:-30px;padding:4px 10px;background:rgba(60,60,60,0.8);color:#eee;border:1px solid #555;border-radius:4px;cursor:pointer;font-size:11px;';
    closeBtn.addEventListener('click', () => { state.recyclerOpen = null; });
    panel.appendChild(closeBtn);

    const desc = document.createElement('div');
    desc.style.cssText = 'font-size:10px;color:#888;margin-bottom:10px;';
    desc.textContent = 'Break down items for 50% materials back.';
    panel.appendChild(desc);

    if (state.recyclerOpen.items.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size:11px;color:#666;padding:12px;text-align:center;';
      empty.textContent = 'No recyclable items in inventory.';
      panel.appendChild(empty);
    }

    for (const item of state.recyclerOpen.items) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 8px;margin-bottom:4px;background:rgba(40,40,40,0.8);border:1px solid rgba(80,80,80,0.4);border-radius:4px;';

      // Item icon
      const iconCanvas = document.createElement('canvas');
      iconCanvas.width = 32;
      iconCanvas.height = 32;
      iconCanvas.style.flexShrink = '0';
      drawItemIcon(iconCanvas.getContext('2d'), 0, 0, 32, item.itemId || 0);
      row.appendChild(iconCanvas);

      const left = document.createElement('div');
      left.style.cssText = 'font-size:11px;color:#ccc;flex:1;';
      left.innerHTML = `<b>${item.itemName}</b> x${item.count}<br><span style="font-size:9px;color:#8a8">→ ${item.yields.map(y => `${y.count}x ${y.itemName}`).join(', ')}</span>`;
      row.appendChild(left);

      // Tooltip on row
      if (item.itemId) {
        row.addEventListener('mouseenter', (e) => showItemTooltip(item.itemId, item.count, e.clientX, e.clientY));
        row.addEventListener('mousemove', (e) => showItemTooltip(item.itemId, item.count, e.clientX, e.clientY));
        row.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
      }

      const btn = document.createElement('button');
      btn.style.cssText = 'padding:4px 12px;font-size:10px;background:rgba(60,80,60,0.8);color:#eee;border:1px solid #585;border-radius:4px;cursor:pointer;';
      btn.textContent = 'Recycle';
      btn.addEventListener('click', () => {
        send({ type: MSG.RECYCLE, recyclerEid: state.recyclerOpen.recyclerEid, slot: item.slot });
      });
      row.appendChild(btn);
      panel.appendChild(row);
    }

    recyclerEl.appendChild(panel);
  }

  // Research Table UI
  let researchEl = null;
  let lastResearchKey = '';
  function renderResearchTable() {
    if (!state.researchOpen) {
      if (researchEl) researchEl.style.display = 'none';
      lastResearchKey = '';
      return;
    }
    const key = JSON.stringify(state.researchOpen);
    if (key === lastResearchKey) {
      if (researchEl) researchEl.style.display = 'flex';
      return;
    }
    lastResearchKey = key;

    if (!researchEl) {
      researchEl = document.createElement('div');
      researchEl.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:100;display:flex;justify-content:center;align-items:center;backdrop-filter:blur(2px);';
      document.body.appendChild(researchEl);
    }
    researchEl.style.display = 'flex';
    researchEl.innerHTML = '';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:rgba(25,25,25,0.97);border:1px solid rgba(100,100,100,0.4);border-radius:6px;padding:16px;min-width:280px;max-width:400px;max-height:70vh;overflow-y:auto;';

    const h = document.createElement('h3');
    h.textContent = 'Research Table';
    h.style.cssText = 'font-size:14px;margin-bottom:8px;color:#8cf;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #333;padding-bottom:6px;';
    panel.appendChild(h);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'X';
    closeBtn.style.cssText = 'float:right;margin-top:-30px;padding:4px 10px;background:rgba(60,60,60,0.8);color:#eee;border:1px solid #555;border-radius:4px;cursor:pointer;font-size:11px;';
    closeBtn.addEventListener('click', () => { state.researchOpen = null; });
    panel.appendChild(closeBtn);

    // Count player scrap
    let scrapCount = 0;
    for (let i = 0; i < INVENTORY_SLOTS; i++) {
      if (state.inventory[i]?.id === ITEM.SCRAP) scrapCount += state.inventory[i].n;
    }

    const info = document.createElement('div');
    info.style.cssText = 'font-size:10px;color:#888;margin-bottom:6px;';
    info.textContent = `Put an item + ${state.researchOpen.scrapCost} Scrap to learn its recipe permanently.`;
    panel.appendChild(info);

    const scrapInfo = document.createElement('div');
    scrapInfo.style.cssText = 'font-size:11px;color:#e8c030;margin-bottom:10px;';
    scrapInfo.textContent = `Your Scrap: ${scrapCount}`;
    panel.appendChild(scrapInfo);

    if (state.researchOpen.items.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size:11px;color:#666;padding:12px;text-align:center;';
      empty.textContent = 'No researchable items in inventory.';
      panel.appendChild(empty);
    }

    for (const item of state.researchOpen.items) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 8px;margin-bottom:4px;background:rgba(40,40,40,0.8);border:1px solid rgba(80,80,80,0.4);border-radius:4px;';

      // Item icon
      const iconCanvas = document.createElement('canvas');
      iconCanvas.width = 32;
      iconCanvas.height = 32;
      iconCanvas.style.flexShrink = '0';
      drawItemIcon(iconCanvas.getContext('2d'), 0, 0, 32, item.itemId || 0);
      row.appendChild(iconCanvas);

      const left = document.createElement('span');
      left.style.cssText = 'font-size:11px;color:#ccc;flex:1;';
      left.textContent = item.itemName;
      row.appendChild(left);

      // Tooltip on row
      if (item.itemId) {
        row.addEventListener('mouseenter', (e) => showItemTooltip(item.itemId, 1, e.clientX, e.clientY));
        row.addEventListener('mousemove', (e) => showItemTooltip(item.itemId, 1, e.clientX, e.clientY));
        row.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
      }

      const btn = document.createElement('button');
      btn.style.cssText = 'padding:4px 12px;font-size:10px;background:rgba(60,60,80,0.8);color:#eee;border:1px solid #558;border-radius:4px;cursor:pointer;';
      btn.textContent = `Research (${state.researchOpen.scrapCost} Scrap)`;
      const canAfford = scrapCount >= state.researchOpen.scrapCost;
      if (!canAfford) {
        btn.style.opacity = '0.4';
        btn.style.pointerEvents = 'none';
      }
      btn.addEventListener('click', () => {
        send({ type: MSG.RESEARCH, tableEid: state.researchOpen.tableEid, slot: item.slot, recipeId: item.recipeId });
      });
      row.appendChild(btn);
      panel.appendChild(row);
    }

    researchEl.appendChild(panel);
  }

  let lastContainerRender = '';

  function renderContainer(container) {
    const key = JSON.stringify(container);
    if (key === lastContainerRender) return;
    lastContainerRender = key;

    containerPanel.innerHTML = '';
    const header = document.createElement('h3');
    const closeBtn = document.createElement('button');
    closeBtn.className = 'container-btn container-close';
    closeBtn.textContent = 'X';
    closeBtn.addEventListener('click', () => { state.containerOpen = null; });

    if (container.type === 'campfire') {
      header.textContent = 'Campfire';
      containerPanel.appendChild(header);
      containerPanel.appendChild(closeBtn);

      const fuelInfo = document.createElement('div');
      fuelInfo.className = 'container-info';
      fuelInfo.textContent = `Fuel: ${container.fuel > 0 ? 'Burning' : 'No fuel'}`;
      containerPanel.appendChild(fuelInfo);

      // Cook slots as icon grid
      const cookGrid = document.createElement('div');
      cookGrid.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;margin:6px 0;';
      for (let i = 0; i < 2; i++) {
        const slot = container.slots?.[i];
        cookGrid.appendChild(createItemSlot(slot?.id || 0, slot?.n || 0));
      }
      containerPanel.appendChild(cookGrid);

      const btnRow = document.createElement('div');
      btnRow.style.marginTop = '10px';

      const addFuelBtn = document.createElement('button');
      addFuelBtn.className = 'container-btn';
      addFuelBtn.textContent = 'Add Wood (Fuel)';
      addFuelBtn.addEventListener('click', () => {
        send({ type: MSG.CONTAINER_ACTION, action: 'add_fuel' });
      });
      btnRow.appendChild(addFuelBtn);

      const addFoodBtn = document.createElement('button');
      addFoodBtn.className = 'container-btn';
      addFoodBtn.textContent = 'Add Raw Meat';
      addFoodBtn.addEventListener('click', () => {
        send({ type: MSG.CONTAINER_ACTION, action: 'add_food' });
      });
      btnRow.appendChild(addFoodBtn);

      const takeBtn = document.createElement('button');
      takeBtn.className = 'container-btn';
      takeBtn.textContent = 'Take Cooked';
      takeBtn.addEventListener('click', () => {
        send({ type: MSG.CONTAINER_ACTION, action: 'take' });
      });
      btnRow.appendChild(takeBtn);
      containerPanel.appendChild(btnRow);

    } else if (container.type === 'furnace') {
      header.textContent = 'Furnace';
      containerPanel.appendChild(header);
      containerPanel.appendChild(closeBtn);

      const fuelInfo = document.createElement('div');
      fuelInfo.className = 'container-info';
      fuelInfo.textContent = `Fuel: ${container.fuel > 0 ? 'Burning' : 'No fuel'}`;
      containerPanel.appendChild(fuelInfo);

      const furnaceGrid = document.createElement('div');
      furnaceGrid.style.cssText = 'display:flex;gap:8px;align-items:center;margin:6px 0;';
      const inputLabel = document.createElement('div');
      inputLabel.style.cssText = 'font-size:9px;color:#888;text-align:center;';
      inputLabel.innerHTML = 'Input';
      const inputSlotWrap = document.createElement('div');
      inputSlotWrap.style.textAlign = 'center';
      inputSlotWrap.appendChild(createItemSlot(container.input?.id || 0, container.input?.n || 0));
      inputSlotWrap.appendChild(inputLabel);
      furnaceGrid.appendChild(inputSlotWrap);

      const arrow = document.createElement('div');
      arrow.style.cssText = 'font-size:16px;color:#666;';
      arrow.textContent = '→';
      furnaceGrid.appendChild(arrow);

      const outputLabel = document.createElement('div');
      outputLabel.style.cssText = 'font-size:9px;color:#888;text-align:center;';
      outputLabel.innerHTML = 'Output';
      const outputSlotWrap = document.createElement('div');
      outputSlotWrap.style.textAlign = 'center';
      outputSlotWrap.appendChild(createItemSlot(container.output?.id || 0, container.output?.n || 0));
      outputSlotWrap.appendChild(outputLabel);
      furnaceGrid.appendChild(outputSlotWrap);
      containerPanel.appendChild(furnaceGrid);

      if (container.progress > 0) {
        const progressBar = document.createElement('div');
        progressBar.className = 'container-progress';
        const fill = document.createElement('div');
        fill.className = 'container-progress-fill';
        fill.style.width = `${Math.min(100, (container.progress / 60) * 100)}%`;
        progressBar.appendChild(fill);
        containerPanel.appendChild(progressBar);
      }

      const btnRow = document.createElement('div');
      btnRow.style.marginTop = '10px';

      const addFuelBtn = document.createElement('button');
      addFuelBtn.className = 'container-btn';
      addFuelBtn.textContent = 'Add Wood (Fuel)';
      addFuelBtn.addEventListener('click', () => {
        send({ type: MSG.CONTAINER_ACTION, action: 'add_fuel' });
      });
      btnRow.appendChild(addFuelBtn);

      const addMetalBtn = document.createElement('button');
      addMetalBtn.className = 'container-btn';
      addMetalBtn.textContent = 'Add Metal Ore';
      addMetalBtn.addEventListener('click', () => {
        send({ type: MSG.CONTAINER_ACTION, action: 'add_ore', itemId: ITEM.METAL_ORE });
      });
      btnRow.appendChild(addMetalBtn);

      const addSulfurBtn = document.createElement('button');
      addSulfurBtn.className = 'container-btn';
      addSulfurBtn.textContent = 'Add Sulfur Ore';
      addSulfurBtn.addEventListener('click', () => {
        send({ type: MSG.CONTAINER_ACTION, action: 'add_ore', itemId: ITEM.SULFUR_ORE });
      });
      btnRow.appendChild(addSulfurBtn);

      const takeBtn = document.createElement('button');
      takeBtn.className = 'container-btn';
      takeBtn.textContent = 'Take Output';
      takeBtn.addEventListener('click', () => {
        send({ type: MSG.CONTAINER_ACTION, action: 'take_output' });
      });
      btnRow.appendChild(takeBtn);
      containerPanel.appendChild(btnRow);

    } else if (container.type === 'storage') {
      header.textContent = 'Storage Box';
      containerPanel.appendChild(header);
      containerPanel.appendChild(closeBtn);

      const slotsDiv = document.createElement('div');
      slotsDiv.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;margin:6px 0;';

      for (let i = 0; i < (container.slots?.length || 12); i++) {
        const slot = container.slots?.[i] || { id: 0, n: 0 };
        const slotIdx = i;
        slotsDiv.appendChild(createItemSlot(slot.id, slot.n, (slot.id && slot.n > 0) ? () => {
          send({ type: MSG.CONTAINER_ACTION, action: 'withdraw', fromSlot: slotIdx });
        } : null));
      }
      containerPanel.appendChild(slotsDiv);

      const depositInfo = document.createElement('div');
      depositInfo.className = 'container-info';
      depositInfo.textContent = 'Click inventory items below to deposit:';
      containerPanel.appendChild(depositInfo);

      // Deposit buttons as icon slots
      const depRow = document.createElement('div');
      depRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;margin-top:6px;';
      for (let i = 0; i < INVENTORY_SLOTS; i++) {
        const item = state.inventory[i];
        if (!item?.id || item.id === 0) continue;
        const slotIdx = i;
        depRow.appendChild(createItemSlot(item.id, item.n, () => {
          send({ type: MSG.CONTAINER_ACTION, action: 'deposit', fromSlot: slotIdx });
        }));
      }
      containerPanel.appendChild(depRow);
    }
  }

  let lastTcRender = '';

  function renderTcAuth(tcAuth) {
    const key = JSON.stringify(tcAuth);
    if (key === lastTcRender) return;
    lastTcRender = key;

    tcAuthPanel.innerHTML = '';
    const header = document.createElement('h3');
    header.textContent = 'Tool Cupboard';
    tcAuthPanel.appendChild(header);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'container-btn container-close';
    closeBtn.textContent = 'X';
    closeBtn.addEventListener('click', () => { state.tcAuthOpen = null; });
    tcAuthPanel.appendChild(closeBtn);

    const status = document.createElement('div');
    status.className = 'tc-auth-status';
    status.textContent = tcAuth.authorized ? 'You are AUTHORIZED' : 'You are NOT authorized';
    status.style.color = tcAuth.authorized ? '#5cb85c' : '#cc4444';
    tcAuthPanel.appendChild(status);

    if (tcAuth.authList.length > 0) {
      const listLabel = document.createElement('div');
      listLabel.className = 'container-info';
      listLabel.textContent = 'Authorized players:';
      tcAuthPanel.appendChild(listLabel);

      for (const entry of tcAuth.authList) {
        const div = document.createElement('div');
        div.className = 'tc-auth-entry';
        div.textContent = entry.name;
        tcAuthPanel.appendChild(div);
      }
    }

    const btnRow = document.createElement('div');
    btnRow.style.marginTop = '12px';

    if (!tcAuth.authorized) {
      const authBtn = document.createElement('button');
      authBtn.className = 'container-btn';
      authBtn.textContent = 'Authorize Self';
      authBtn.addEventListener('click', () => {
        send({ type: MSG.TC_AUTH_ACTION, tcEid: tcAuth.tcEid, action: 'authorize' });
      });
      btnRow.appendChild(authBtn);
    } else {
      const deauthBtn = document.createElement('button');
      deauthBtn.className = 'container-btn';
      deauthBtn.textContent = 'Deauthorize Self';
      deauthBtn.addEventListener('click', () => {
        send({ type: MSG.TC_AUTH_ACTION, tcEid: tcAuth.tcEid, action: 'deauthorize' });
      });
      btnRow.appendChild(deauthBtn);

      const clearBtn = document.createElement('button');
      clearBtn.className = 'container-btn';
      clearBtn.textContent = 'Clear All';
      clearBtn.addEventListener('click', () => {
        send({ type: MSG.TC_AUTH_ACTION, tcEid: tcAuth.tcEid, action: 'clearall' });
      });
      btnRow.appendChild(clearBtn);
    }

    tcAuthPanel.appendChild(btnRow);
  }

  return { update };
}
