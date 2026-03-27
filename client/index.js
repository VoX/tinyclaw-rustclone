import { MSG, KEY, MOUSE_ACTION, INV_ACTION, ENTITY_TYPE } from '../shared/protocol.js';
import { ITEM, ITEM_DEFS, RECIPES, CRAFT_TIER, BIOME, TILE_SIZE, WORLD_SIZE,
         INVENTORY_SLOTS, HOTBAR_SLOTS, STRUCT_TYPE, WATER_SPEED_MULT, ROAD_SPEED_MULT } from '../shared/constants.js';
import { createRenderer } from './renderer/index.js';
import { createInput } from './input.js';
import { createUI } from './ui/index.js';
import { updateFootsteps, playHitGather, playHitAttack, playDeath,
         playPickup, playCraftComplete, playInventoryOpen, playInventoryClose,
         playGunshot, playBowShot, playDoorOpen, playPlaceStructure,
         startAmbient, updateListenerPosition,
         playHitGatherAt, playHitAttackAt, playGunshotAt } from './audio.js';

// ── Game State ──
const state = {
  connected: false,
  connecting: true,
  loadingWorld: false,
  worldReady: false,
  firstConnect: true,
  showControls: false,
  myEid: null,
  myConnId: null,
  entities: new Map(),  // eid -> entity data
  inventory: [],        // 24 slots: { id, n }
  selectedSlot: 0,
  hp: 100, maxHp: 100,
  prevHp: 100,
  hunger: 100, thirst: 100, temp: 20,
  isDead: false,
  deathInfo: null,       // { killerName, killerType, survived }
  deathTime: 0,
  respawnTime: 10000,    // ms countdown before respawn allowed
  damageFlashAlpha: 0,
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
  // Armor
  armor: { head: 0, chest: 0, legs: 0 },
  // Map
  showMap: false,
  exploredTiles: null,     // Uint8Array for fog of war
  // Chat
  chatMessages: [],        // { senderName, senderEid, text, time }
  chatInput: '',
  chatOpen: false,
  // Kill feed / notifications
  notifications: [],       // { text, time, color }
  // Performance
  showPerf: false,
  fps: 0,
  entityCount: 0,
  // Chat bubbles (above player heads)
  chatBubbles: new Map(),  // eid -> { text, expiry }
  // Tutorial hint
  tutorialExpiry: 0,       // timestamp when tutorial hint disappears
  // Clip/ammo HUD
  clipAmmo: 0,
  clipMax: 0,
  // Build preview
  buildPiece: 0,       // currently selected build piece type (set by UI)
  mouseScreenX: 0,
  mouseScreenY: 0,
  // Craft progress
  craftProgress: 0,
  craftRecipeId: 0,
  craftTotalTime: 0,
  // Connection screen
  myName: '',
  worldSeed: 0,
  loadingProgress: 0,
  // Leaderboard
  showLeaderboard: false,
  leaderboard: [],
  // Stamina
  stamina: 100,
  staminaLocked: false, // locked until 25 when depleted
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
  state.connecting = true;
  ws = new WebSocket(wsUrl);
  ws.onopen = () => {
    state.connected = true;
    state.connecting = false;
    state.loadingWorld = true;
    state.loadingProgress = 0.1;
    console.log('Connected to server');
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    handleServerMessage(msg);
  };

  ws.onclose = () => {
    state.connected = false;
    state.worldReady = false;
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
      state.myName = msg.name || '';
      break;

    case MSG.WORLD_INFO:
      state.worldSize = msg.worldSize;
      state.tileSize = msg.tileSize;
      state.worldSeed = msg.seed || 0;
      state.loadingProgress = 0.3; // got world info
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
          state.loadingProgress = 0.3 + 0.6 * (idx / total);
        }
      }
      state.loadingProgress = 1.0;
      state.loadingWorld = false;
      state.worldReady = true;
      // Initialize fog of war explored tiles
      if (!state.exploredTiles) {
        const fogSize = Math.ceil(msg.worldSize / 8); // 1 tile per 8 world tiles
        state.exploredTiles = new Uint8Array(fogSize * fogSize);
      }
      if (state.firstConnect) {
        state.showControls = true;
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
            // Client-authoritative: ignore server position for local player
            if (e.eid === state.myEid) {
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
          const wasDead = state.isDead;
          state.isDead = !!me.dead;
          if (wasDead && !state.isDead) {
            state.deathInfo = null; // Clear on respawn
          }
        }
      }
      break;

    case MSG.INVENTORY_UPDATE:
      for (let i = 0; i < 24; i++) {
        state.inventory[i] = msg.items[i] || { id: 0, n: 0, d: 0 };
      }
      state.selectedSlot = msg.selected;
      // Detect damage for red flash
      if (msg.hp < state.hp && state.hp > 0) {
        state.damageFlashAlpha = Math.min(0.6, (state.hp - msg.hp) / 30);
      }
      state.prevHp = state.hp;
      state.hp = msg.hp;
      state.maxHp = msg.maxHp;
      state.hunger = msg.hunger;
      state.thirst = msg.thirst;
      state.temp = msg.temp;
      if (msg.armor) state.armor = msg.armor;
      break;

    case MSG.DEATH:
      state.isDead = true;
      state.spawnBags = msg.bags || [];
      state.deathInfo = {
        killerName: msg.killerName || 'unknown',
        killerType: msg.killerType || 'environment',
        survived: msg.survived || 0,
      };
      state.deathTime = Date.now();
      state.respawnTime = (msg.respawnTime || 10) * 1000; // ms
      state.damageFlashAlpha = 0; // clear flash on death screen
      playDeath();
      break;

    case MSG.EVENT:
      if (msg.events) {
        state.events.push(...msg.events);
        // Trigger positional audio for events
        for (const evt of msg.events) {
          if (evt.type === 'hit') {
            if (evt.x !== undefined && evt.y !== undefined) {
              playHitGatherAt(evt.x, evt.y);
            } else {
              playHitGather();
            }
          } else if (evt.type === 'blood') {
            if (evt.x !== undefined && evt.y !== undefined) {
              playHitAttackAt(evt.x, evt.y);
            } else {
              playHitAttack();
            }
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

    case MSG.CHAT:
      // Add to chat log
      state.chatMessages.push({
        senderName: msg.senderName,
        senderEid: msg.senderEid,
        text: msg.text,
        time: Date.now(),
      });
      // Keep last 50 messages
      if (state.chatMessages.length > 50) state.chatMessages.shift();
      // Set chat bubble on sender entity
      state.chatBubbles.set(msg.senderEid, {
        text: msg.text,
        expiry: Date.now() + 5000,
      });
      break;

    case MSG.SPAWN_BAGS:
      state.spawnBags = msg.bags || [];
      break;

    case MSG.CLIP_UPDATE:
      state.clipAmmo = msg.ammo;
      state.clipMax = msg.max;
      break;

    case MSG.CRAFT_PROGRESS:
      state.craftProgress = msg.progress;
      state.craftRecipeId = msg.recipeId;
      state.craftTotalTime = msg.totalTime;
      break;

    case MSG.LEADERBOARD:
      state.leaderboard = msg.top || [];
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
let fpsFrames = 0;
let fpsLastTime = 0;

function clientLoop(timestamp) {
  const dt = timestamp - lastFrame;
  lastFrame = timestamp;

  // FPS counter
  fpsFrames++;
  if (timestamp - fpsLastTime >= 1000) {
    state.fps = fpsFrames;
    fpsFrames = 0;
    fpsLastTime = timestamp;
  }
  state.entityCount = state.entities.size;

  // Decay damage flash
  if (state.damageFlashAlpha > 0) {
    state.damageFlashAlpha = Math.max(0, state.damageFlashAlpha - dt * 0.003);
  }

  // Clean expired chat bubbles
  const now = Date.now();
  for (const [eid, bubble] of state.chatBubbles) {
    if (now > bubble.expiry) state.chatBubbles.delete(eid);
  }

  // Client-authoritative movement — client computes position, server validates
  if (state.myEid && state.entities.has(state.myEid) && !state.isDead) {
    const me = state.entities.get(state.myEid);
    const keys = input.getKeys();
    let sprinting = input.isSprinting();
    // Stamina system
    const isMoving = (input.getKeys() & (KEY.W | KEY.A | KEY.S | KEY.D)) !== 0;
    if (sprinting && isMoving) {
      if (state.staminaLocked || state.stamina <= 0) {
        sprinting = false; // can't sprint
      } else {
        state.stamina = Math.max(0, state.stamina - 15 * (dt / 1000));
        if (state.stamina <= 0) state.staminaLocked = true;
      }
    } else if (isMoving) {
      state.stamina = Math.min(100, state.stamina + 10 * (dt / 1000));
    } else {
      state.stamina = Math.min(100, state.stamina + 20 * (dt / 1000));
    }
    if (state.staminaLocked && state.stamina >= 25) state.staminaLocked = false;
    let speed = 10.0 * (sprinting ? 2.0 : 1.0);

    // Water slowdown
    if (state.biomeMap) {
      const tx = Math.floor(me.x / state.tileSize);
      const ty = Math.floor(me.y / state.tileSize);
      if (tx >= 0 && tx < state.worldSize && ty >= 0 && ty < state.worldSize) {
        const currentBiome = state.biomeMap[ty * state.worldSize + tx];
        if (currentBiome === BIOME.WATER) {
          speed *= WATER_SPEED_MULT;
        } else if (currentBiome === BIOME.ROAD) {
          speed *= ROAD_SPEED_MULT;
        }
      }
    }

    let dx = 0, dy = 0;
    if (keys & KEY.W) dy -= 1;
    if (keys & KEY.S) dy += 1;
    if (keys & KEY.A) dx -= 1;
    if (keys & KEY.D) dx += 1;

    if (dx !== 0 && dy !== 0) {
      dx *= 0.7071;
      dy *= 0.7071;
    }

    // Move locally — this IS the player's position, no prediction needed
    me.x += dx * speed * (dt / 1000);
    me.y += dy * speed * (dt / 1000);

    // Clamp to world bounds
    const maxCoord = state.worldSize * state.tileSize;
    me.x = Math.max(0, Math.min(maxCoord, me.x));
    me.y = Math.max(0, Math.min(maxCoord, me.y));

    // Set render position directly (no interpolation for local player)
    me.renderX = me.x;
    me.renderY = me.y;

    // Footstep sounds
    updateFootsteps(isMoving, sprinting);

    // Update fog of war
    if (state.exploredTiles) {
      const fogSize = Math.ceil(state.worldSize / 8);
      const fogX = Math.floor(me.x / (state.tileSize * 8));
      const fogY = Math.floor(me.y / (state.tileSize * 8));
      const fogRadius = 4;
      for (let fy = fogY - fogRadius; fy <= fogY + fogRadius; fy++) {
        for (let fx = fogX - fogRadius; fx <= fogX + fogRadius; fx++) {
          if (fx >= 0 && fx < fogSize && fy >= 0 && fy < fogSize) {
            state.exploredTiles[fy * fogSize + fx] = 1;
          }
        }
      }
    }
  }

  // Interpolate remote entities (local player sets renderX/Y directly above)
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

  // Update audio listener position and start ambient audio
  if (state.connected && state.myEid) {
    const me = state.entities.get(state.myEid);
    if (me) {
      updateListenerPosition(me.renderX || me.x, me.renderY || me.y);
    }
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

  const me = state.entities.get(state.myEid);
  send({
    type: MSG.INPUT,
    keys: input.getKeys(),
    mouseAngle: input.getMouseAngle(),
    mouseAction: input.getMouseAction(),
    selectedSlot: state.selectedSlot,
    x: me ? me.x : undefined,
    y: me ? me.y : undefined,
  });

  // Ping
  send({ type: MSG.PING, t: Date.now() });
}, 50); // 20 TPS

// ── Start ──
connect();
requestAnimationFrame(clientLoop);
