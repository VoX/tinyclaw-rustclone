import { ITEM, ITEM_DEFS, RECIPES, CRAFT_TIER, HOTBAR_SLOTS, INVENTORY_SLOTS, STRUCT_TYPE } from '../../shared/constants.js';
import { MSG, INV_ACTION } from '../../shared/protocol.js';

// ── Canvas-drawn item icons ──
function drawItemIcon(ctx, x, y, size, itemId) {
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

  // HUD elements
  const hpBar = document.getElementById('hp-bar-fill');
  const hungerBar = document.getElementById('hunger-bar-fill');
  const thirstBar = document.getElementById('thirst-bar-fill');
  const hpText = document.getElementById('hp-text');
  const itemNameEl = document.getElementById('item-name');
  const pingEl = document.getElementById('ping-display');

  // Dragging state for inventory
  let dragSlot = -1;

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
        send({ type: MSG.INVENTORY, action: INV_ACTION.DROP, fromSlot: i });
      });

      invGrid.appendChild(slot);
    }
  }
  buildInvGrid();

  // Build craft panel with item icons
  function buildCraftPanel() {
    craftPanel.innerHTML = '<h3>Crafting</h3>';
    for (const recipe of RECIPES) {
      const btn = document.createElement('div');
      btn.className = 'craft-recipe';

      const resultDef = ITEM_DEFS[recipe.result];
      const tierLabel = recipe.tier === CRAFT_TIER.HAND ? '' : ` [WB${recipe.tier}]`;

      let ingText = recipe.ing.map(([id, n]) => `${ITEM_DEFS[id]?.name || '?'} x${n}`).join(', ');

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

      btn.addEventListener('click', () => {
        send({ type: MSG.CRAFT, recipeId: recipe.id });
      });

      craftPanel.appendChild(btn);
    }
  }
  buildCraftPanel();

  // Death screen
  document.getElementById('respawn-beach').addEventListener('click', () => {
    send({ type: MSG.RESPAWN, bagEid: null });
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
      buildMode = false;
      buildMenu.style.display = 'none';
    });
    buildMenu.appendChild(btn);
  }

  // Place building on click
  document.getElementById('game-canvas').addEventListener('click', (e) => {
    if (state.showInventory) return;
    const held = state.inventory[state.selectedSlot]?.id;
    if (held === ITEM.BUILDING_PLAN || held === ITEM.SLEEPING_BAG ||
        held === ITEM.CAMPFIRE_ITEM || held === ITEM.FURNACE_ITEM ||
        held === ITEM.TOOL_CUPBOARD_ITEM || held === ITEM.WORKBENCH_T1_ITEM) {

      const me = state.entities.get(state.myEid);
      if (!me) return;

      const canvas = e.target;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const viewScale = 24;
      const tileSize = state.tileSize;

      const worldX = me.x + (e.clientX - cx) * tileSize / viewScale;
      const worldY = me.y + (e.clientY - cy) * tileSize / viewScale;

      const pieceType = held === ITEM.BUILDING_PLAN ? buildPiece : 1;

      send({
        type: MSG.BUILD,
        pieceType,
        x: worldX,
        y: worldY,
      });
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

          // Update or create text elements
          let sn = nameSpan;
          if (!sn) {
            sn = document.createElement('span');
            sn.className = 'slot-name';
            slot.appendChild(sn);
          }
          sn.textContent = ITEM_DEFS[item.id]?.name?.substring(0, 4) || '?';

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
          if (nameEl) nameEl.textContent = def?.name || '?';
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
    }
  }

  return { update };
}
