import { ITEM, ITEM_DEFS, RECIPES, CRAFT_TIER, HOTBAR_SLOTS, INVENTORY_SLOTS, STRUCT_TYPE } from '../../shared/constants.js';
import { MSG, INV_ACTION } from '../../shared/protocol.js';

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

  // Build inventory grid
  function buildInvGrid() {
    invGrid.innerHTML = '';
    for (let i = 0; i < INVENTORY_SLOTS; i++) {
      const slot = document.createElement('div');
      slot.className = 'inv-slot';
      slot.dataset.slot = i;

      slot.addEventListener('mousedown', (e) => {
        if (e.button === 2) {
          // Right click: split
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
        // Double click: drop
        send({ type: MSG.INVENTORY, action: INV_ACTION.DROP, fromSlot: i });
      });

      invGrid.appendChild(slot);
    }
  }
  buildInvGrid();

  // Build craft panel
  function buildCraftPanel() {
    craftPanel.innerHTML = '<h3>Crafting</h3>';
    for (const recipe of RECIPES) {
      const btn = document.createElement('div');
      btn.className = 'craft-recipe';

      const resultDef = ITEM_DEFS[recipe.result];
      const tierLabel = recipe.tier === CRAFT_TIER.HAND ? '' : ` [WB${recipe.tier}]`;

      let ingText = recipe.ing.map(([id, n]) => `${ITEM_DEFS[id]?.name || '?'} x${n}`).join(', ');

      btn.innerHTML = `
        <div class="craft-name">${resultDef?.name || '?'} x${recipe.count}${tierLabel}</div>
        <div class="craft-cost">${ingText}</div>
      `;

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
    // isDead will be cleared by the server's next delta update when respawn succeeds
  });

  // Build menu placeholder
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

  // Build menu buttons
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

  // Place building on click when holding building plan
  document.getElementById('game-canvas').addEventListener('click', (e) => {
    if (state.showInventory) return;
    const held = state.inventory[state.selectedSlot]?.id;
    if (held === ITEM.BUILDING_PLAN || held === ITEM.SLEEPING_BAG ||
        held === ITEM.CAMPFIRE_ITEM || held === ITEM.FURNACE_ITEM ||
        held === ITEM.TOOL_CUPBOARD_ITEM || held === ITEM.WORKBENCH_T1_ITEM) {

      const me = state.entities.get(state.myEid);
      if (!me) return;

      // Convert screen click to world coords
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

  function update() {
    // HUD
    if (hpBar) {
      hpBar.style.width = `${(state.hp / state.maxHp) * 100}%`;
      hpBar.style.backgroundColor = state.hp > 50 ? '#4a4' : state.hp > 25 ? '#aa4' : '#a44';
    }
    if (hungerBar) hungerBar.style.width = `${state.hunger}%`;
    if (thirstBar) thirstBar.style.width = `${state.thirst}%`;
    if (hpText) hpText.textContent = `${state.hp} HP`;

    // Active item name
    const heldItem = state.inventory[state.selectedSlot];
    if (itemNameEl) {
      itemNameEl.textContent = heldItem?.id ? (ITEM_DEFS[heldItem.id]?.name || '') : '';
    }

    // Ping
    if (pingEl) pingEl.textContent = `${state.ping}ms`;

    // Update hotbar
    if (hotbarEl) {
      const slots = hotbarEl.children;
      for (let i = 0; i < HOTBAR_SLOTS; i++) {
        const slot = slots[i];
        if (!slot) continue;
        const item = state.inventory[i];
        const isSelected = i === state.selectedSlot;
        slot.className = `hotbar-slot${isSelected ? ' selected' : ''}`;
        if (item?.id && item.id !== 0) {
          const def = ITEM_DEFS[item.id];
          slot.innerHTML = `<span class="slot-name">${def?.name?.substring(0, 4) || '?'}</span>` +
            (item.n > 1 ? `<span class="slot-count">${item.n}</span>` : '');
        } else {
          slot.innerHTML = `<span class="slot-key">${i + 1}</span>`;
        }
      }
    }

    // Inventory screen
    if (inventoryScreen) {
      inventoryScreen.style.display = state.showInventory ? 'flex' : 'none';
    }

    // Update inventory grid
    if (state.showInventory && invGrid) {
      const slots = invGrid.children;
      for (let i = 0; i < INVENTORY_SLOTS; i++) {
        const slot = slots[i];
        if (!slot) continue;
        const item = state.inventory[i];
        if (item?.id && item.id !== 0) {
          const def = ITEM_DEFS[item.id];
          slot.innerHTML = `<div class="slot-item">${def?.name || '?'}</div>` +
            (item.n > 1 ? `<div class="slot-qty">${item.n}</div>` : '');
          slot.classList.add('has-item');
        } else {
          slot.innerHTML = '';
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
