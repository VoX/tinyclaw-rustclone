import { ITEM, ITEM_DEFS, RECIPES, CRAFT_TIER, HOTBAR_SLOTS, INVENTORY_SLOTS, STRUCT_TYPE, TILE_SIZE } from '../../shared/constants.js';
import { MSG, INV_ACTION, ENTITY_TYPE } from '../../shared/protocol.js';

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
        held === ITEM.STORAGE_BOX) {

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
      // Show death stats
      const deathStats = document.getElementById('death-stats');
      if (deathStats && state.isDead && state.deathInfo) {
        const info = state.deathInfo;
        const mins = Math.floor(info.survived / 60);
        const secs = info.survived % 60;
        const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        deathStats.innerHTML = `Killed by <span style="color:#e44">${info.killerName}</span><br>Survived: ${timeStr}`;
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
            btn.textContent = `Sleeping Bag (${bag.x}, ${bag.y})`;
            btn.style.cssText = 'padding:10px 24px;font-size:13px;background:rgba(40,40,40,0.9);color:#ddd;border:2px solid #555;border-radius:6px;cursor:pointer;z-index:1;text-transform:uppercase;letter-spacing:1px;margin:4px;';
            btn.addEventListener('click', () => {
              send({ type: MSG.RESPAWN, bagEid: bag.eid });
              state.spawnBags = [];
            });
            btn.addEventListener('mouseenter', () => { btn.style.borderColor = '#999'; btn.style.color = '#fff'; });
            btn.addEventListener('mouseleave', () => { btn.style.borderColor = '#555'; btn.style.color = '#ddd'; });
            bagContainer.appendChild(btn);
          }
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
  }

  // Close container/TC on Escape
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      state.containerOpen = null;
      state.tcAuthOpen = null;
    }
  });

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

      // Cook slots
      for (let i = 0; i < 2; i++) {
        const slot = container.slots?.[i];
        const slotDiv = document.createElement('div');
        slotDiv.className = 'container-slot';
        if (slot?.id) {
          const def = ITEM_DEFS[slot.id];
          slotDiv.textContent = def?.name || '?';
          slotDiv.style.color = slot.id === ITEM.COOKED_MEAT ? '#c4913a' : '#cc4444';
        } else {
          slotDiv.textContent = 'Empty';
        }
        containerPanel.appendChild(slotDiv);
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

      if (container.input?.id) {
        const inputInfo = document.createElement('div');
        inputInfo.className = 'container-info';
        inputInfo.textContent = `Input: ${ITEM_DEFS[container.input.id]?.name || '?'} x${container.input.n}`;
        containerPanel.appendChild(inputInfo);
      }

      if (container.output?.id && container.output.n > 0) {
        const outputInfo = document.createElement('div');
        outputInfo.className = 'container-info';
        outputInfo.textContent = `Output: ${ITEM_DEFS[container.output.id]?.name || '?'} x${container.output.n}`;
        containerPanel.appendChild(outputInfo);
      }

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
      slotsDiv.style.display = 'flex';
      slotsDiv.style.flexWrap = 'wrap';
      slotsDiv.style.gap = '3px';

      for (let i = 0; i < (container.slots?.length || 12); i++) {
        const slot = container.slots?.[i] || { id: 0, n: 0 };
        const slotDiv = document.createElement('div');
        slotDiv.className = 'container-slot';
        if (slot.id && slot.n > 0) {
          const def = ITEM_DEFS[slot.id];
          slotDiv.textContent = `${def?.name?.substring(0, 6) || '?'}\n${slot.n}`;
          slotDiv.style.lineHeight = '14px';
          slotDiv.style.paddingTop = '10px';
          slotDiv.style.fontSize = '8px';
          slotDiv.addEventListener('click', () => {
            send({ type: MSG.CONTAINER_ACTION, action: 'withdraw', fromSlot: i });
          });
        } else {
          slotDiv.textContent = '';
        }
        slotsDiv.appendChild(slotDiv);
      }
      containerPanel.appendChild(slotsDiv);

      const depositInfo = document.createElement('div');
      depositInfo.className = 'container-info';
      depositInfo.textContent = 'Click your inventory slot # to deposit (1-24):';
      containerPanel.appendChild(depositInfo);

      // Quick deposit buttons for first 6 inventory slots
      const depRow = document.createElement('div');
      depRow.style.marginTop = '6px';
      for (let i = 0; i < INVENTORY_SLOTS; i++) {
        const item = state.inventory[i];
        if (!item?.id || item.id === 0) continue;
        const btn = document.createElement('button');
        btn.className = 'container-btn';
        btn.textContent = `${ITEM_DEFS[item.id]?.name?.substring(0, 8) || '?'} x${item.n}`;
        btn.style.fontSize = '9px';
        const slotIdx = i;
        btn.addEventListener('click', () => {
          send({ type: MSG.CONTAINER_ACTION, action: 'deposit', fromSlot: slotIdx });
        });
        depRow.appendChild(btn);
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
