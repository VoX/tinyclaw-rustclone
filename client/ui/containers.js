import { ITEM, ITEM_DEFS, INVENTORY_SLOTS } from '../../shared/constants.js';
import { MSG } from '../../shared/protocol.js';

export function setupContainers(state, send, shared) {
  const { drawItemIcon, showItemTooltip, tooltip, sanitizeHTML,
          createItemSlot, createInventoryGrid, playerInvGrid,
          containerPanel, invGrid } = shared;

  let lastContainerRender = '';
  let containerGrid = null;
  let lastContainerPlayerInvRender = '';

  function renderContainerPlayerInv(el) {
    const invHash = JSON.stringify(state.inventory);
    if (invHash === lastContainerPlayerInvRender && el.children.length > 0) {
      playerInvGrid.updateSlots();
      return;
    }
    lastContainerPlayerInvRender = invHash;

    el.innerHTML = '';
    const h = document.createElement('h3');
    h.textContent = 'Inventory';
    el.appendChild(h);
    el.appendChild(playerInvGrid);
    playerInvGrid.updateSlots();
  }

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

      containerGrid = null;

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

      containerGrid = null;

    } else if (container.type === 'storage') {
      header.textContent = 'Storage Box';
      containerPanel.appendChild(header);
      containerPanel.appendChild(closeBtn);

      const slotCount = container.slots?.length || 12;

      containerGrid = createInventoryGrid('container', slotCount, {
        columns: Math.min(6, slotCount),
        slotSize: 60,
        getSlotData: (i) => {
          return state.containerOpen?.slots?.[i] || { id: 0, n: 0 };
        },
        onSlotClick: (i) => {
          const slot = state.containerOpen?.slots?.[i];
          if (slot?.id && slot.id !== 0) {
            send({ type: MSG.CONTAINER_ACTION, action: 'withdraw', fromSlot: i });
          }
        },
        onDragDrop: (fromGridId, fromSlot, toSlot) => {
          if (fromGridId === 'player') {
            send({ type: MSG.CONTAINER_ACTION, action: 'deposit', fromSlot });
          } else if (fromGridId === 'container' && fromSlot !== toSlot) {
            send({ type: MSG.CONTAINER_ACTION, action: 'withdraw', fromSlot });
          }
        },
      });

      containerPanel.appendChild(containerGrid);
      containerGrid.updateSlots();

      const hint = document.createElement('div');
      hint.className = 'container-info';
      hint.textContent = 'Click or drag items to transfer';
      hint.style.marginTop = '8px';
      containerPanel.appendChild(hint);
    }
  }

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

      const iconCanvas = document.createElement('canvas');
      iconCanvas.width = 32;
      iconCanvas.height = 32;
      iconCanvas.style.flexShrink = '0';
      drawItemIcon(iconCanvas.getContext('2d'), 0, 0, 32, item.itemId || 0);
      row.appendChild(iconCanvas);

      const left = document.createElement('div');
      left.style.cssText = 'font-size:11px;color:#ccc;flex:1;';
      left.innerHTML = `<b>${sanitizeHTML(item.itemName)}</b> x${item.count}<br><span style="font-size:9px;color:#8a8">→ ${item.yields.map(y => `${y.count}x ${sanitizeHTML(y.itemName)}`).join(', ')}</span>`;
      row.appendChild(left);

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

  // TC Auth UI
  let lastTcRender = '';
  const tcAuthPanel = document.getElementById('tc-auth-panel');

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

  function updateContainers(containerScreen) {
    const containerPlayerInv = document.getElementById('container-player-inv');
    if (state.containerOpen) {
      containerScreen.style.display = 'flex';
      if (containerPlayerInv) {
        if (state.containerOpen.type === 'storage') {
          containerPlayerInv.style.display = '';
          renderContainerPlayerInv(containerPlayerInv);
        } else {
          containerPlayerInv.style.display = 'none';
        }
      }
      renderContainer(state.containerOpen);
      if (containerGrid) containerGrid.updateSlots();
    } else {
      containerScreen.style.display = 'none';
      if (containerPlayerInv) containerPlayerInv.style.display = 'none';
      if (playerInvGrid.parentElement !== invGrid && invGrid) {
        invGrid.innerHTML = '';
        invGrid.appendChild(playerInvGrid);
      }
      lastContainerRender = '';
      lastContainerPlayerInvRender = '';
      containerGrid = null;
    }
  }

  return { renderContainer, renderContainerPlayerInv, renderNPCTrade, renderRecycler, renderResearchTable, renderTcAuth, updateContainers };
}
