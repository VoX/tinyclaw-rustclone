import { createWorld, addEntity, addComponent, removeEntity } from 'bitecs';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { Position, Velocity, Rotation, Player, Health, Hunger, Thirst, Temperature,
         Inventory, Hotbar, Collider, Sprite, NetworkSync, ActiveTool, Damageable } from '../shared/components.js';
import { SERVER_TPS, SERVER_TICK_MS, PLAYER_MAX_HP, PLAYER_MAX_HUNGER,
         PLAYER_MAX_THIRST, PLAYER_COLLIDER_RADIUS, ITEM, WORLD_SIZE, TILE_SIZE } from '../shared/constants.js';
import { MSG, KEY, MOUSE_ACTION, INV_ACTION, ENTITY_TYPE } from '../shared/protocol.js';

import { generateWorld, serializeBiomeMap } from './world.js';
import { createInputSystem } from './systems/InputSystem.js';
import { createMovementSystem } from './systems/MovementSystem.js';
import { createAnimalAISystem } from './systems/AnimalAISystem.js';
import { createCombatSystem } from './systems/CombatSystem.js';
import { createProjectileSystem } from './systems/ProjectileSystem.js';
import { createDamageSystem } from './systems/DamageSystem.js';
import { createSurvivalSystem } from './systems/SurvivalSystem.js';
import { createResourceRespawnSystem } from './systems/ResourceRespawnSystem.js';
import { createItemDespawnSystem } from './systems/ItemDespawnSystem.js';
import { createCraftingSystem } from './systems/CraftingSystem.js';
import { createFurnaceSystem } from './systems/FurnaceSystem.js';
import { createCampfireSystem } from './systems/CampfireSystem.js';
import { createBuildSystem } from './systems/BuildSystem.js';
import { createDoorSystem } from './systems/DoorSystem.js';
import { createRespawnSystem } from './systems/RespawnSystem.js';
import { createDayNightSystem } from './systems/DayNightSystem.js';
import { createNetworkSyncSystem } from './systems/NetworkSyncSystem.js';
import { createGatherSystem } from './systems/GatherSystem.js';
import { createInventorySystem } from './systems/InventorySystem.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 8780;

// ── Game State ──
const world = createWorld();
const gameState = {
  tick: 0,
  worldTime: 0,
  lightLevel: 1.0,
  dayNightPhase: 'day',
  clients: new Map(),        // connId -> { ws, playerEid, input, ... }
  entityTypes: new Map(),    // eid -> ENTITY_TYPE
  newEntities: new Set(),    // eids created this tick
  removedEntities: new Set(),// eids removed this tick
  dirtyInventories: new Set(), // player eids with changed inventories
  events: [],                // one-shot events this tick
  tcAuth: new Map(),         // tc eid -> Set of authorized player eids
  doorAuth: new Map(),       // door eid -> Set of authorized player eids
  campfirePositions: new Map(),
  biomeMap: null,
  getBiomeAt: null,
  nextConnId: 1,
};

// ── World Generation ──
console.log('Generating world...');
generateWorld(world, gameState, 12345);

// ── Systems ──
const systems = [
  createInputSystem(gameState),
  createMovementSystem(gameState),
  createAnimalAISystem(gameState),
  createCombatSystem(gameState),
  createGatherSystem(gameState),
  createProjectileSystem(gameState),
  createDamageSystem(gameState),
  createSurvivalSystem(gameState),
  createResourceRespawnSystem(gameState),
  createItemDespawnSystem(gameState),
  createCraftingSystem(gameState),
  createFurnaceSystem(gameState),
  createCampfireSystem(gameState),
  createBuildSystem(gameState),
  createDoorSystem(gameState),
  createInventorySystem(gameState),
  createRespawnSystem(gameState),
  createDayNightSystem(gameState),
  createNetworkSyncSystem(gameState),
];

// ── HTTP Server (serves client files) ──
const httpServer = createServer((req, res) => {
  // Strip /rustclone prefix for reverse proxy support
  const url = req.url.replace(/^\/rustclone/, '') || '/';
  let filePath;
  if (url === '/' || url === '/index.html') {
    filePath = join(__dirname, '..', 'client', 'dist', 'index.html');
  } else if (url === '/bundle.js') {
    filePath = join(__dirname, '..', 'client', 'dist', 'bundle.js');
  } else {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = filePath.endsWith('.js') ? 'application/javascript' : 'text/html';
  res.writeHead(200, { 'Content-Type': ext });
  res.end(readFileSync(filePath));
});

// ── WebSocket Server ──
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws) => {
  const connId = gameState.nextConnId++;
  console.log(`Player connected: ${connId}`);

  // Create player entity
  const eid = addEntity(world);
  addComponent(world, Position, eid);
  addComponent(world, Velocity, eid);
  addComponent(world, Rotation, eid);
  addComponent(world, Player, eid);
  addComponent(world, Health, eid);
  addComponent(world, Hunger, eid);
  addComponent(world, Thirst, eid);
  addComponent(world, Temperature, eid);
  addComponent(world, Inventory, eid);
  addComponent(world, Hotbar, eid);
  addComponent(world, Collider, eid);
  addComponent(world, Sprite, eid);
  addComponent(world, NetworkSync, eid);
  addComponent(world, ActiveTool, eid);
  addComponent(world, Damageable, eid);

  // Random beach spawn
  const maxCoord = WORLD_SIZE * TILE_SIZE;
  const margin = maxCoord * 0.05;
  const side = Math.floor(Math.random() * 4);
  let sx, sy;
  switch (side) {
    case 0: sx = margin + Math.random() * (maxCoord - 2 * margin); sy = Math.random() * margin; break;
    case 1: sx = margin + Math.random() * (maxCoord - 2 * margin); sy = maxCoord - Math.random() * margin; break;
    case 2: sx = Math.random() * margin; sy = margin + Math.random() * (maxCoord - 2 * margin); break;
    default: sx = maxCoord - Math.random() * margin; sy = margin + Math.random() * (maxCoord - 2 * margin); break;
  }

  Position.x[eid] = sx;
  Position.y[eid] = sy;
  Velocity.vx[eid] = 0;
  Velocity.vy[eid] = 0;
  Player.connectionId[eid] = connId;
  Health.current[eid] = PLAYER_MAX_HP;
  Health.max[eid] = PLAYER_MAX_HP;
  Hunger.current[eid] = PLAYER_MAX_HUNGER;
  Hunger.max[eid] = PLAYER_MAX_HUNGER;
  Hunger.decayRate[eid] = 1;
  Thirst.current[eid] = PLAYER_MAX_THIRST;
  Thirst.max[eid] = PLAYER_MAX_THIRST;
  Thirst.decayRate[eid] = 1;
  Temperature.current[eid] = 20;
  Temperature.comfort[eid] = 1;
  Collider.radius[eid] = PLAYER_COLLIDER_RADIUS;
  Sprite.spriteId[eid] = 1; // player sprite
  NetworkSync.lastTick[eid] = gameState.tick;

  // Starting items
  Inventory.items[eid][0] = ITEM.ROCK;
  Inventory.counts[eid][0] = 1;
  Inventory.items[eid][1] = ITEM.TORCH;
  Inventory.counts[eid][1] = 1;
  Hotbar.selectedSlot[eid] = 0;

  gameState.entityTypes.set(eid, ENTITY_TYPE.PLAYER);
  gameState.newEntities.add(eid);

  const client = {
    ws,
    playerEid: eid,
    connId,
    input: { keys: 0, mouseAngle: 0, mouseAction: MOUSE_ACTION.NONE },
    mouseAction: MOUSE_ACTION.NONE,
    sprinting: false,
    craftRequest: null,
    buildRequest: null,
    interactRequest: null,
    invRequest: null,
    respawnRequest: null,
  };
  gameState.clients.set(connId, client);

  // Send player ID and world info
  ws.send(JSON.stringify({
    type: MSG.PLAYER_ID,
    eid,
    connId,
  }));

  ws.send(JSON.stringify({
    type: MSG.WORLD_INFO,
    worldSize: WORLD_SIZE,
    tileSize: TILE_SIZE,
    biomes: serializeBiomeMap(gameState.biomeMap),
  }));

  // Send initial inventory
  gameState.dirtyInventories.add(eid);

  // Handle messages
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      handleClientMessage(connId, msg);
    } catch (e) {
      // Ignore malformed messages
    }
  });

  ws.on('close', () => {
    console.log(`Player disconnected: ${connId}`);
    gameState.clients.delete(connId);
    gameState.removedEntities.add(eid);
    gameState.entityTypes.delete(eid);
    removeEntity(world, eid);
  });

  ws.on('error', () => {});
});

function handleClientMessage(connId, msg) {
  const client = gameState.clients.get(connId);
  if (!client) return;

  switch (msg.type) {
    case MSG.INPUT:
      client.input = {
        keys: msg.keys || 0,
        mouseAngle: msg.mouseAngle || 0,
        mouseAction: msg.mouseAction || MOUSE_ACTION.NONE,
      };
      // Handle hotbar selection
      if (msg.selectedSlot !== undefined && msg.selectedSlot >= 0 && msg.selectedSlot < 6) {
        Hotbar.selectedSlot[client.playerEid] = msg.selectedSlot;
      }
      break;

    case MSG.CRAFT:
      client.craftRequest = msg.recipeId;
      break;

    case MSG.BUILD:
      client.buildRequest = {
        pieceType: msg.pieceType,
        x: msg.x,
        y: msg.y,
      };
      break;

    case MSG.INTERACT:
      client.interactRequest = { targetEid: msg.targetEid };
      break;

    case MSG.INVENTORY:
      client.invRequest = {
        action: msg.action,
        fromSlot: msg.fromSlot,
        toSlot: msg.toSlot,
      };
      break;

    case MSG.RESPAWN:
      client.respawnRequest = { bagEid: msg.bagEid || null };
      break;

    case MSG.PING:
      try {
        client.ws.send(JSON.stringify({ type: MSG.PONG, t: msg.t }));
      } catch (e) {}
      break;
  }
}

// ── Game Loop ──
let lastTick = performance.now();

function gameLoop() {
  const now = performance.now();
  const elapsed = now - lastTick;

  if (elapsed >= SERVER_TICK_MS) {
    lastTick = now - (elapsed % SERVER_TICK_MS);
    gameState.tick++;

    // Run all systems
    for (const system of systems) {
      system(world);
    }
  }
}

// Run at high frequency to stay close to 20 TPS
setInterval(gameLoop, 1);

httpServer.listen(PORT, () => {
  console.log(`Rust Clone server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} to play`);
});
