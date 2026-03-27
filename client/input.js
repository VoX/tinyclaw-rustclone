import { KEY, MOUSE_ACTION, MSG, INV_ACTION } from '../shared/protocol.js';
import { BIOME, TILE_SIZE } from '../shared/constants.js';
import { playInventoryOpen, playInventoryClose } from './audio.js';

export function createInput(state, send) {
  let keys = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseAngle = 0;
  let mouseAction = MOUSE_ACTION.NONE;
  let sprinting = false;

  // Chat input element (created dynamically)
  const chatInputEl = document.getElementById('chat-input');

  // Keyboard
  document.addEventListener('keydown', (e) => {
    // Dismiss controls overlay on any key
    if (state.showControls) {
      state.showControls = false;
      state.tutorialExpiry = Date.now() + 15000; // show tutorial for 15s
      state.firstConnect = false;
      e.preventDefault();
      return;
    }

    // Chat input handling
    if (state.chatOpen) {
      if (e.code === 'Escape') {
        state.chatOpen = false;
        state.chatInput = '';
        if (chatInputEl) chatInputEl.style.display = 'none';
        e.preventDefault();
        return;
      }
      if (e.code === 'Enter') {
        if (state.chatInput.trim()) {
          send({ type: MSG.CHAT_SEND, text: state.chatInput.trim() });
        }
        state.chatOpen = false;
        state.chatInput = '';
        if (chatInputEl) {
          chatInputEl.value = '';
          chatInputEl.style.display = 'none';
        }
        e.preventDefault();
        return;
      }
      return; // Let chat input handle all other keys
    }

    if (e.repeat) return;
    switch (e.code) {
      case 'KeyW': keys |= KEY.W; break;
      case 'KeyA': keys |= KEY.A; break;
      case 'KeyS': keys |= KEY.S; break;
      case 'KeyD': keys |= KEY.D; break;
      case 'ShiftLeft': case 'ShiftRight': keys |= KEY.SHIFT; sprinting = true; break;
      case 'Space': keys |= KEY.SPACE; break;
      case 'Enter':
        // Open chat
        if (!state.isDead && !state.showInventory) {
          state.chatOpen = true;
          state.chatInput = '';
          if (chatInputEl) {
            chatInputEl.value = '';
            chatInputEl.style.display = 'block';
            chatInputEl.focus();
          }
          e.preventDefault();
        }
        break;
      case 'Tab':
        e.preventDefault();
        state.showInventory = !state.showInventory;
        if (state.showInventory) playInventoryOpen();
        else playInventoryClose();
        break;
      case 'KeyM':
        state.showMap = !state.showMap;
        break;
      case 'F3':
        e.preventDefault();
        state.showPerf = !state.showPerf;
        break;
      case 'KeyE':
        // Interact with nearest entity, or drink water if standing on water tile
        if (state.myEid && state.entities.has(state.myEid)) {
          const me = state.entities.get(state.myEid);
          let nearest = null;
          let nearestDist = 9;
          for (const [eid, e] of state.entities) {
            if (eid === state.myEid) continue;
            const dx = (e.renderX || e.x) - me.x;
            const dy = (e.renderY || e.y) - me.y;
            const dist = dx * dx + dy * dy;
            if (dist < nearestDist) {
              nearestDist = dist;
              nearest = eid;
            }
          }
          if (nearest !== null) {
            send({ type: MSG.INTERACT, targetEid: nearest });
          }
          // Also check for water tile drinking
          if (state.biomeMap) {
            const tx = Math.floor(me.x / TILE_SIZE);
            const ty = Math.floor(me.y / TILE_SIZE);
            if (tx >= 0 && tx < state.worldSize && ty >= 0 && ty < state.worldSize) {
              if (state.biomeMap[ty * state.worldSize + tx] === BIOME.WATER) {
                send({ type: MSG.DRINK_WATER });
              }
            }
          }
        }
        break;
      case 'KeyQ':
        // Quick drop
        send({ type: MSG.INVENTORY, action: INV_ACTION.DROP, fromSlot: state.selectedSlot });
        break;
      case 'KeyR':
        // Reload ranged weapon
        send({ type: MSG.RELOAD });
        break;
      case 'Digit1': state.selectedSlot = 0; break;
      case 'Digit2': state.selectedSlot = 1; break;
      case 'Digit3': state.selectedSlot = 2; break;
      case 'Digit4': state.selectedSlot = 3; break;
      case 'Digit5': state.selectedSlot = 4; break;
      case 'Digit6': state.selectedSlot = 5; break;
    }
  });

  // Chat input text tracking
  if (chatInputEl) {
    chatInputEl.addEventListener('input', (e) => {
      state.chatInput = e.target.value;
    });
  }

  document.addEventListener('keyup', (e) => {
    if (state.chatOpen) return;
    switch (e.code) {
      case 'KeyW': keys &= ~KEY.W; break;
      case 'KeyA': keys &= ~KEY.A; break;
      case 'KeyS': keys &= ~KEY.S; break;
      case 'KeyD': keys &= ~KEY.D; break;
      case 'ShiftLeft': case 'ShiftRight': keys &= ~KEY.SHIFT; sprinting = false; break;
      case 'Space': keys &= ~KEY.SPACE; break;
    }
  });

  // Mouse
  const canvas = document.getElementById('game-canvas');

  canvas.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    state.mouseScreenX = mouseX;
    state.mouseScreenY = mouseY;
    // Calculate angle from center of screen
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    mouseAngle = Math.atan2(mouseY - cy, mouseX - cx);
  });

  canvas.addEventListener('mousedown', (e) => {
    if (state.showInventory) return; // UI handles it
    if (e.button === 0) mouseAction = MOUSE_ACTION.PRIMARY;
    else if (e.button === 2) mouseAction = MOUSE_ACTION.SECONDARY;
  });

  canvas.addEventListener('mouseup', (e) => {
    if (e.button === 0 && mouseAction === MOUSE_ACTION.PRIMARY) mouseAction = MOUSE_ACTION.NONE;
    else if (e.button === 2 && mouseAction === MOUSE_ACTION.SECONDARY) mouseAction = MOUSE_ACTION.NONE;
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Mouse wheel for hotbar
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.deltaY > 0) {
      state.selectedSlot = (state.selectedSlot + 1) % 6;
    } else {
      state.selectedSlot = (state.selectedSlot + 5) % 6;
    }
  });

  return {
    getKeys: () => keys,
    getMouseAngle: () => mouseAngle,
    getMouseAction: () => mouseAction,
    getMouseX: () => mouseX,
    getMouseY: () => mouseY,
    isSprinting: () => sprinting,
  };
}
