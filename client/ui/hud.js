import { ITEM, ITEM_DEFS, HOTBAR_SLOTS, STRUCT_TYPE } from '../../shared/constants.js';
import { MSG, ENTITY_TYPE } from '../../shared/protocol.js';

export function setupHUD(state, send, shared) {
  const { drawItemIcon, sanitizeHTML } = shared;

  const hud = document.getElementById('hud');
  const inventoryScreen = document.getElementById('inventory-screen');
  const deathScreen = document.getElementById('death-screen');
  const hotbarEl = document.getElementById('hotbar');
  const containerScreen = document.getElementById('container-screen');
  const tcAuthScreen = document.getElementById('tc-auth-screen');

  const hpBar = document.getElementById('hp-bar-fill');
  const hungerBar = document.getElementById('hunger-bar-fill');
  const thirstBar = document.getElementById('thirst-bar-fill');
  const hpText = document.getElementById('hp-text');
  const itemNameEl = document.getElementById('item-name');
  const pingEl = document.getElementById('ping-display');

  let smoothHp = 100;
  let smoothHunger = 100;
  let smoothThirst = 100;

  // Death screen respawn
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
    { type: STRUCT_TYPE.FOUNDATION_TRI, label: 'Triangle' },
    { type: STRUCT_TYPE.WALL, label: 'Wall' },
    { type: STRUCT_TYPE.DOORWAY, label: 'Doorway' },
    { type: STRUCT_TYPE.WINDOW, label: 'Window' },
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
    const viewScale = 24 * (state.adsZoom || 1.0) * (state.deathZoom || 1.0);
    const tileSize = state.tileSize;

    const worldX = me.x + (e.clientX - cx) * tileSize / viewScale;
    const worldY = me.y + (e.clientY - cy) * tileSize / viewScale;

    if (held === ITEM.BANDAGE) {
      send({ type: MSG.USE_BANDAGE });
      return;
    }

    if (held === ITEM.HAMMER) {
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
    const viewScale = 24 * (state.adsZoom || 1.0) * (state.deathZoom || 1.0);
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

  // Close overlays on Escape
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      state.containerOpen = null;
      state.tcAuthOpen = null;
      state.npcTradeOpen = null;
      state.recyclerOpen = null;
      state.researchOpen = null;
    }
  });

  function updateHUD(deps) {
    const { buildCraftPanel, playerInvGrid, updateArmorPanel, updateContainers, renderNPCTrade, renderRecycler, renderResearchTable, renderTcAuth } = deps;

    const lerp = 0.12;
    const targetHp = (state.hp / state.maxHp) * 100;
    const targetHunger = state.hunger;
    const targetThirst = state.thirst;
    smoothHp += (targetHp - smoothHp) * lerp;
    smoothHunger += (targetHunger - smoothHunger) * lerp;
    smoothThirst += (targetThirst - smoothThirst) * lerp;

    if (hpBar) hpBar.style.width = `${smoothHp}%`;
    if (hungerBar) hungerBar.style.width = `${smoothHunger}%`;
    if (thirstBar) thirstBar.style.width = `${smoothThirst}%`;
    if (hpText) hpText.textContent = `${state.hp} HP`;

    const heldItem = state.inventory[state.selectedSlot];
    if (itemNameEl) {
      itemNameEl.textContent = heldItem?.id ? (ITEM_DEFS[heldItem.id]?.name || '') : '';
    }

    if (pingEl) pingEl.textContent = `${state.ping}ms`;

    // Hotbar
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
          if (iconCanvas) {
            const ictx = iconCanvas.getContext('2d');
            ictx.clearRect(0, 0, 32, 32);
            drawItemIcon(ictx, 0, 0, 32, item.id);
            iconCanvas.style.display = 'block';
          }

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
      inventoryScreen.style.display = (state.showInventory && !state.containerOpen) ? 'flex' : 'none';
    }

    if (state.showInventory && !state.containerOpen) {
      buildCraftPanel();
    }

    if (state.showInventory && !state.containerOpen) {
      updateArmorPanel();
    }

    if (state.showInventory || state.containerOpen) {
      playerInvGrid.updateSlots();
    }

    // Death screen
    if (deathScreen) {
      deathScreen.style.display = state.isDead ? 'flex' : 'none';
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
        deathStats.innerHTML = `Killed by <span style="color:#e44">${sanitizeHTML(info.killerName)}</span><br>Survived: ${timeStr}${resText}${timerText}`;
      }
      const canRespawn = Date.now() - (state.deathTime || 0) >= state.respawnTime;
      const respawnBeachBtn = document.getElementById('respawn-beach');
      if (respawnBeachBtn) {
        respawnBeachBtn.disabled = !canRespawn;
        respawnBeachBtn.style.opacity = canRespawn ? '1' : '0.4';
        respawnBeachBtn.style.pointerEvents = canRespawn ? '' : 'none';
      }
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
        for (const btn of bagContainer.querySelectorAll('.bag-spawn-btn')) {
          btn.style.opacity = canRespawn ? '1' : '0.4';
          btn.style.pointerEvents = canRespawn ? '' : 'none';
        }
      }
    }

    // Container screen
    if (containerScreen) {
      updateContainers(containerScreen);
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

    // Other overlays
    renderNPCTrade();
    renderRecycler();
    renderResearchTable();
  }

  return { updateHUD };
}
