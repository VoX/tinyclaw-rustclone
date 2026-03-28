import { ITEM_DEFS, INVENTORY_SLOTS } from '../../shared/constants.js';
import { MSG, INV_ACTION } from '../../shared/protocol.js';

export function setupInventory(state, send, shared) {
  const { drawItemIcon, showItemTooltip, tooltip, invGrid } = shared;

  // ── Drag-and-drop state ──
  const dragGhost = document.getElementById('drag-ghost');
  let dragState = null; // { gridId, slotIndex, itemId, count }

  function startDrag(gridId, slotIndex, itemId, count, e) {
    dragState = { gridId, slotIndex, itemId, count };
    if (dragGhost) {
      dragGhost.innerHTML = '';
      const c = document.createElement('canvas');
      c.width = 40; c.height = 40;
      drawItemIcon(c.getContext('2d'), 0, 0, 40, itemId);
      dragGhost.appendChild(c);
      dragGhost.style.display = 'block';
      dragGhost.style.left = (e.clientX - 20) + 'px';
      dragGhost.style.top = (e.clientY - 20) + 'px';
    }
  }

  function moveDrag(e) {
    if (!dragState || !dragGhost) return;
    dragGhost.style.left = (e.clientX - 20) + 'px';
    dragGhost.style.top = (e.clientY - 20) + 'px';
  }

  function endDrag() {
    dragState = null;
    if (dragGhost) dragGhost.style.display = 'none';
  }

  document.addEventListener('mousemove', moveDrag);
  document.addEventListener('mouseup', () => {
    if (dragState) endDrag();
  });

  // ── Reusable inventory grid component ──
  function createInventoryGrid(gridId, slotCount, options = {}) {
    const columns = options.columns || 6;
    const slotSize = options.slotSize || 60;
    const iconSize = Math.floor(slotSize * 0.67);

    const container = document.createElement('div');
    container.className = 'inv-grid-shared';
    container.style.gridTemplateColumns = `repeat(${columns}, ${slotSize}px)`;
    container.dataset.gridId = gridId;

    for (let i = 0; i < slotCount; i++) {
      const slot = document.createElement('div');
      slot.className = 'grid-slot';
      slot.dataset.slot = i;
      slot.style.width = slotSize + 'px';
      slot.style.height = slotSize + 'px';

      const iconCanvas = document.createElement('canvas');
      iconCanvas.width = iconSize;
      iconCanvas.height = iconSize;
      iconCanvas.className = 'grid-icon';
      slot.appendChild(iconCanvas);

      const qtyEl = document.createElement('div');
      qtyEl.className = 'grid-qty';
      qtyEl.style.display = 'none';
      slot.appendChild(qtyEl);

      const durBar = document.createElement('div');
      durBar.className = 'grid-dur';
      durBar.style.display = 'none';
      const durFill = document.createElement('div');
      durFill.className = 'grid-dur-fill';
      durBar.appendChild(durFill);
      slot.appendChild(durBar);

      slot.addEventListener('mousedown', (e) => {
        if (e.button === 2) {
          e.preventDefault();
          if (options.onSlotRightClick) options.onSlotRightClick(i);
          return;
        }
        const data = options.getSlotData ? options.getSlotData(i) : null;
        if (data?.id && data.id !== 0) {
          startDrag(gridId, i, data.id, data.n, e);
        }
      });

      slot.addEventListener('mouseup', (e) => {
        if (!dragState) return;
        if (dragState.gridId === gridId && dragState.slotIndex === i) {
          endDrag();
          return;
        }
        if (options.onDragDrop) {
          options.onDragDrop(dragState.gridId, dragState.slotIndex, i);
        }
        endDrag();
      });

      slot.addEventListener('click', (e) => {
        if (options.onSlotClick) options.onSlotClick(i);
      });

      slot.addEventListener('dblclick', (e) => {
        if (options.onSlotDblClick) options.onSlotDblClick(i);
      });

      if (options.showTooltip !== false) {
        slot.addEventListener('mouseenter', (e) => {
          const data = options.getSlotData ? options.getSlotData(i) : null;
          if (data?.id) showItemTooltip(data.id, data.n, e.clientX, e.clientY);
        });
        slot.addEventListener('mousemove', (e) => {
          const data = options.getSlotData ? options.getSlotData(i) : null;
          if (data?.id) showItemTooltip(data.id, data.n, e.clientX, e.clientY);
          else tooltip.style.display = 'none';
        });
        slot.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
      }

      container.appendChild(slot);
    }

    container.updateSlots = function() {
      const slots = container.children;
      for (let i = 0; i < slotCount; i++) {
        const slot = slots[i];
        if (!slot) continue;
        const data = options.getSlotData ? options.getSlotData(i) : null;
        const iconCanvas = slot.querySelector('.grid-icon');
        const qtyEl = slot.querySelector('.grid-qty');
        const durBar = slot.querySelector('.grid-dur');

        if (data?.id && data.id !== 0) {
          if (iconCanvas) {
            const ictx = iconCanvas.getContext('2d');
            ictx.clearRect(0, 0, iconSize, iconSize);
            drawItemIcon(ictx, 0, 0, iconSize, data.id);
            iconCanvas.style.display = 'block';
          }
          if (qtyEl) {
            qtyEl.textContent = data.n > 1 ? data.n : '';
            qtyEl.style.display = data.n > 1 ? '' : 'none';
          }
          const def = ITEM_DEFS[data.id];
          if (durBar && def?.durability && data.d > 0) {
            const pct = data.d / def.durability;
            durBar.style.display = '';
            const fill = durBar.querySelector('.grid-dur-fill');
            fill.style.width = (pct * 100) + '%';
            fill.style.background = pct > 0.5 ? '#4a4' : pct > 0.2 ? '#aa4' : '#a44';
          } else if (durBar) {
            durBar.style.display = 'none';
          }
          slot.classList.add('has-item');
          slot.title = def?.name || '';
        } else {
          if (iconCanvas) {
            const ictx = iconCanvas.getContext('2d');
            ictx.clearRect(0, 0, iconSize, iconSize);
            iconCanvas.style.display = 'none';
          }
          if (qtyEl) { qtyEl.textContent = ''; qtyEl.style.display = 'none'; }
          if (durBar) durBar.style.display = 'none';
          slot.classList.remove('has-item');
          slot.title = '';
        }
      }
    };

    return container;
  }

  // ── Player inventory grid ──
  const playerInvGrid = createInventoryGrid('player', INVENTORY_SLOTS, {
    columns: 6,
    slotSize: 60,
    getSlotData: (i) => state.inventory[i],
    onSlotRightClick: (i) => {
      send({ type: MSG.INVENTORY, action: INV_ACTION.SPLIT, fromSlot: i });
    },
    onSlotDblClick: (i) => {
      const item = state.inventory[i];
      if (item?.id && ITEM_DEFS[item.id]?.cat === 'armor') {
        send({ type: MSG.INVENTORY, action: INV_ACTION.EQUIP_ARMOR, fromSlot: i });
      } else {
        send({ type: MSG.INVENTORY, action: INV_ACTION.DROP, fromSlot: i });
      }
    },
    onSlotClick: (i) => {
      if (state.containerOpen && (state.containerOpen.type === 'storage')) {
        const item = state.inventory[i];
        if (item?.id && item.id !== 0) {
          send({ type: MSG.CONTAINER_ACTION, action: 'deposit', fromSlot: i });
        }
      }
    },
    onDragDrop: (fromGridId, fromSlot, toSlot) => {
      if (fromGridId === 'player') {
        send({ type: MSG.INVENTORY, action: INV_ACTION.MOVE, fromSlot, toSlot });
      } else if (fromGridId === 'container') {
        send({ type: MSG.CONTAINER_ACTION, action: 'withdraw', fromSlot });
      }
    },
  });
  invGrid.innerHTML = '';
  invGrid.appendChild(playerInvGrid);

  // ── Armor panel update ──
  function updateArmorPanel() {
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
        slotDiv.addEventListener('click', () => {
          send({ type: MSG.INVENTORY, action: INV_ACTION.UNEQUIP_ARMOR, fromSlot: i });
        });
        armorPanel.appendChild(slotDiv);
      }
      invGrid.parentElement.insertBefore(armorPanel, invGrid);
    }
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

  return { createInventoryGrid, playerInvGrid, updateArmorPanel };
}
