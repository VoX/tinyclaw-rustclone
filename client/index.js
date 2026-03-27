import { MSG, KEY, MOUSE_ACTION, INV_ACTION, ENTITY_TYPE } from '../shared/protocol.js';
import { ITEM, ITEM_DEFS, RECIPES, CRAFT_TIER, BIOME, TILE_SIZE, WORLD_SIZE,
         INVENTORY_SLOTS, HOTBAR_SLOTS, STRUCT_TYPE } from '../shared/constants.js';
import { createRenderer } from './renderer.js';
import { createInput } from './input.js';
import { createUI } from './ui/index.js';
import { updateFootsteps, playHitGather, playHitAttack, playDeath,
         playPickup, playCraftComplete, playInventoryOpen, playInventoryClose,
         playGunshot, playBowShot, playDoorOpen, playPlaceStructure,
         startAmbient } from './audio.js';

// ── Game State ──
const state = {
  connected: false,
  myEid: null,
  myConnId: null,
  entities: new Map(),  // eid -> entity data
  inventory: [],        // 24 slots: { id, n }
  selectedSlot: 0,
  hp: 100, maxHp: 100,
  hunger: 100, thirst: 100, temp: 20,
  isDead: false,
  worldSize: 2000,
  tileSize: 2,
  biomeMap: null,
  worldTime: 0,
  lightLevel: 1.0,
  events: [],
  ping: 0,
  serverTick: 0,
  containerOpen: null,     // { type, eid, data }
  tcAuthOpen: null,        // { tcEid, authorized, authList }
  workbenchTier: 0,        // highest tier workbench nearby (from interact)
};

// Initialize inventory slots
for (let i = 0; i < 24; i++) {
  state.inventory.push({ id: 0, n: 0 });
}

// ── WebSocket Connection ──
const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = window.location.port === '8780' || window.location.port === ''
  ? `${wsProto}//${window.location.host}/rustclone`
  : `ws://${window.location.hostname}:8780`;
let ws;

function connect() {
  ws = new WebSocket(wsUrl);
  ws.onopen = () => {
    state.connected = true;
    console.log('Connected to server');
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    handleServerMessage(msg);
  };

  ws.onclose = () => {
    state.connected = false;
    console.log('Disconnected. Reconnecting in 2s...');
    setTimeout(connect, 2000);
  };

  ws.onerror = () => {};
}

function handleServerMessage(msg) {
  switch (msg.type) {
    case MSG.PLAYER_ID:
      state.myEid = msg.eid;
      state.myConnId = msg.connId;
      break;

    case MSG.WORLD_INFO:
      state.worldSize = msg.worldSize;
      state.tileSize = msg.tileSize;
      // Decode RLE biome map
      if (msg.biomes) {
        const total = msg.worldSize * msg.worldSize;
        state.biomeMap = new Uint8Array(total);
        let idx = 0;
        for (let i = 0; i < msg.biomes.length; i += 2) {
          const biome = msg.biomes[i];
          const count = msg.biomes[i + 1];
          for (let j = 0; j < count && idx < total; j++) {
            state.biomeMap[idx++] = biome;
          }
        }
      }
      break;

    case MSG.DELTA:
      state.serverTick = msg.tick;
      state.worldTime = msg.time;
      state.lightLevel = msg.light;
      // Update entities
      if (msg.entities) {
        for (const e of msg.entities) {
          const existing = state.entities.get(e.eid);
          if (existing) {
            existing.prevX = existing.x;
            existing.prevY = existing.y;
            if (e.eid === state.myEid && e.x !== undefined && e.y !== undefined) {
              // Store server position separately for correction
              existing._serverX = e.x;
              existing._serverY = e.y;
              // Only snap if server disagrees significantly (collision, teleport, respawn)
              const dx = e.x - existing.x;
              const dy = e.y - existing.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist > 5) {
                // Big desync — trust server (collision or respawn)
                existing.x = e.x;
                existing.y = e.y;
              }
              // Otherwise ignore server position — trust client prediction
              delete e.x;
              delete e.y;
            }
            Object.assign(existing, e);
          } else {
            e.prevX = e.x;
            e.prevY = e.y;
            state.entities.set(e.eid, e);
          }
        }
      }
      // Remove entities
      if (msg.removed) {
        for (const eid of msg.removed) {
          state.entities.delete(eid);
        }
      }
      // Sync death state from own entity data
      if (state.myEid) {
        const me = state.entities.get(state.myEid);
        if (me) {
          state.isDead = !!me.dead;
        }
      }
      break;

    case MSG.INVENTORY_UPDATE:
      for (let i = 0; i < 24; i++) {
        state.inventory[i] = msg.items[i] || { id: 0, n: 0 };
      }
      state.selectedSlot = msg.selected;
      state.hp = msg.hp;
      state.maxHp = msg.maxHp;
      state.hunger = msg.hunger;
      state.thirst = msg.thirst;
      state.temp = msg.temp;
      break;

    case MSG.DEATH:
      state.isDead = true;
      state.spawnBags = msg.bags || [];
      playDeath();
      break;

    case MSG.EVENT:
      if (msg.events) {
        state.events.push(...msg.events);
        // Trigger audio for events
        for (const evt of msg.events) {
          if (evt.type === 'hit') {
            playHitGather();
          } else if (evt.type === 'blood') {
            playHitAttack();
          }
        }
      }
      break;

    case MSG.PONG:
      state.ping = Date.now() - msg.t;
      break;

    case MSG.CONTAINER_OPEN:
      if (msg.containerType === 'workbench') {
        state.workbenchTier = Math.max(state.workbenchTier, msg.tier || 1);
        // Show a brief notification
        state.events.push({ type: 'workbench', tier: msg.tier });
      } else {
        state.containerOpen = {
          type: msg.containerType,
          eid: msg.containerEid,
          fuel: msg.fuel,
          slots: msg.slots,
          input: msg.input,
          output: msg.output,
          progress: msg.progress,
          tier: msg.tier,
        };
      }
      break;

    case MSG.CONTAINER_UPDATE:
      if (state.containerOpen && state.containerOpen.eid === msg.containerEid) {
        state.containerOpen.slots = msg.slots;
        state.containerOpen.fuel = msg.fuel;
        state.containerOpen.input = msg.input;
        state.containerOpen.output = msg.output;
        state.containerOpen.progress = msg.progress;
      }
      break;

    case MSG.TC_AUTH_OPEN:
    case MSG.TC_AUTH_UPDATE:
      state.tcAuthOpen = {
        tcEid: msg.tcEid,
        authorized: msg.authorized,
        authList: msg.authList || [],
      };
      break;

    case MSG.SPAWN_BAGS:
      state.spawnBags = msg.bags || [];
      break;
  }
}

function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// ── Input ──
const input = createInput(state, send);

// ── Renderer ──
const canvas = document.getElementById('game-canvas');
const renderer = createRenderer(canvas, state);

// ── UI ──
const ui = createUI(state, send);

// ── Game Loop (Client) ──
let lastFrame = 0;
const INTERP_FACTOR = 0.15;

function clientLoop(timestamp) {
  const dt = timestamp - lastFrame;
  lastFrame = timestamp;

  // Client-side movement prediction
  if (state.myEid && state.entities.has(state.myEid) && !state.isDead) {
    const me = state.entities.get(state.myEid);
    const keys = input.getKeys();
    const sprinting = input.isSprinting();
    const speed = 10.0 * (sprinting ? 2.0 : 1.0);

    let dx = 0, dy = 0;
    if (keys & KEY.W) dy -= 1;
    if (keys & KEY.S) dy += 1;
    if (keys & KEY.A) dx -= 1;
    if (keys & KEY.D) dx += 1;

    if (dx !== 0 && dy !== 0) {
      dx *= 0.7071;
      dy *= 0.7071;
    }

    // Predict movement — apply directly for responsive feel
    me.x += dx * speed * (dt / 1000);
    me.y += dy * speed * (dt / 1000);

    // Footstep sounds
    const isMoving = dx !== 0 || dy !== 0;
    updateFootsteps(isMoving, sprinting);

    // When idle, gently drift toward server position to correct accumulated error
    if (dx === 0 && dy === 0 && me._serverX !== undefined) {
      const corrX = me._serverX - me.x;
      const corrY = me._serverY - me.y;
      me.x += corrX * 0.1;
      me.y += corrY * 0.1;
    }

    // Clamp
    const maxCoord = state.worldSize * state.tileSize;
    me.x = Math.max(0, Math.min(maxCoord, me.x));
    me.y = Math.max(0, Math.min(maxCoord, me.y));
  }

  // Interpolate other entities
  for (const [eid, e] of state.entities) {
    if (eid === state.myEid) continue;
    if (e.prevX !== undefined) {
      e.renderX = (e.renderX || e.prevX) + (e.x - (e.renderX || e.prevX)) * INTERP_FACTOR;
      e.renderY = (e.renderY || e.prevY) + (e.y - (e.renderY || e.prevY)) * INTERP_FACTOR;
    } else {
      e.renderX = e.x;
      e.renderY = e.y;
    }
  }

  // Prevent unbounded event accumulation — renderer processes via incrementing index
  // so we let it grow and just cap if it gets very large (renderer will catch up)
  if (state.events.length > 500) {
    state.events.length = 0;
    renderer.resetEventIndex();
  }

  // Start ambient audio once connected
  if (state.connected && state.myEid) {
    startAmbient(state.lightLevel);
  }

  // Render
  renderer.render(dt);
  ui.update();

  requestAnimationFrame(clientLoop);
}

// ── Send input at tick rate ──
setInterval(() => {
  if (!state.connected || !state.myEid) return;

  send({
    type: MSG.INPUT,
    keys: input.getKeys(),
    mouseAngle: input.getMouseAngle(),
    mouseAction: input.getMouseAction(),
    selectedSlot: state.selectedSlot,
  });

  // Ping
  send({ type: MSG.PING, t: Date.now() });
}, 50); // 20 TPS

// ── Start ──
connect();
requestAnimationFrame(clientLoop);
