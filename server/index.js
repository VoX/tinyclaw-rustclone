import { createWorld, addEntity, addComponent, removeEntity, hasComponent } from 'bitecs';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, URL } from 'url';

import { query } from 'bitecs';
import { Position, Velocity, Rotation, Player, Health, Hunger, Thirst, Temperature,
         Inventory, Hotbar, Collider, Sprite, NetworkSync, ActiveTool, Damageable,
         initInventory, StorageBox, Armor } from '../shared/components.js';
import { SERVER_TPS, SERVER_TICK_MS, PLAYER_MAX_HP, PLAYER_MAX_HUNGER,
         PLAYER_MAX_THIRST, PLAYER_COLLIDER_RADIUS, ITEM, WORLD_SIZE, TILE_SIZE } from '../shared/constants.js';
import { MSG, KEY, MOUSE_ACTION, INV_ACTION, ENTITY_TYPE } from '../shared/protocol.js';

import { SpatialHash } from '../shared/spatial.js';
import { generateWorld, serializeBiomeMap } from './world.js';
import { saveWorld, loadWorld, restorePlayer, resolveAuthForPlayer } from './persistence.js';
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
import { createInteractSystem } from './systems/InteractSystem.js';
import { createDecaySystem } from './systems/DecaySystem.js';
import { createWeatherSystem } from './systems/WeatherSystem.js';
import { createHelicopterSystem } from './systems/HelicopterSystem.js';
import { createTeamSystem } from './systems/TeamSystem.js';

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
  containerInv: new Map(),     // eid -> [{id, n}, ...] for storage boxes
  animalSpawns: [],            // {x, y, animalType, respawnAt} for respawning
  playerNames: new Map(),      // eid -> name string
  playerStats: new Map(),      // eid -> { kills, resources, name }
  playersByUuid: new Map(),    // uuid -> saved player data
  eidToUuid: new Map(),        // eid -> uuid (for connected players)
  uuidToEid: new Map(),        // uuid -> eid (for connected players)
  pendingTcAuth: new Map(),    // tc eid -> [uuids] awaiting resolution
  pendingDoorAuth: new Map(),  // door eid -> [uuids] awaiting resolution
  bagOwnerUuids: new Map(),    // bag eid -> owner uuid (for sleeping bag resolution)
  biomeMap: null,
  getBiomeAt: null,
  nextConnId: 1,
  spatialHash: new SpatialHash(8),
};

// ── World Generation ──
console.log('Generating world...');
generateWorld(world, gameState, 12345);

// ── Load saved world state ──
loadWorld(world, gameState);

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
  createInteractSystem(gameState),
  createDoorSystem(gameState),
  createInventorySystem(gameState),
  createRespawnSystem(gameState),
  createDecaySystem(gameState),
  createDayNightSystem(gameState),
  createWeatherSystem(gameState),
  createHelicopterSystem(gameState),
  createTeamSystem(gameState),
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
  } else if (url === '/stats') {
    const allEnts = query(world, [Position]);
    const stats = {
      players: gameState.clients.size,
      entities: allEnts.length,
      tick: gameState.tick,
      tickDurationMs: Math.round(lastTickDuration * 100) / 100,
      avgTickDurationMs: Math.round(avgTickDuration * 100) / 100,
      uptimeSeconds: Math.floor((Date.now() - serverStartTime) / 1000),
      worldTime: Math.round(gameState.worldTime * 100) / 100,
      dayNightPhase: gameState.dayNightPhase,
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(stats));
    return;
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

// ── Random player name generation ──
const NAME_ADJ = ['Rusty','Salty','Sneaky','Lucky','Dusty','Rocky','Smoky','Stormy','Frosty','Sandy',
  'Shady','Grumpy','Sleepy','Brave','Swift','Wild','Calm','Bold','Lone','Grim'];
const NAME_NOUN = ['Survivor','Wanderer','Builder','Hunter','Bandit','Nomad','Raider','Scout','Drifter','Hermit',
  'Trapper','Forager','Outcast','Pioneer','Ranger','Crafter','Scavenger','Settler','Exile','Vagrant'];
function randomPlayerName() {
  return NAME_ADJ[Math.floor(Math.random() * NAME_ADJ.length)] + ' ' +
         NAME_NOUN[Math.floor(Math.random() * NAME_NOUN.length)];
}

// ── WebSocket Server ──
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws, req) => {
  const connId = gameState.nextConnId++;

  // Parse player UUID from query string
  let playerUuid = null;
  try {
    const params = new URL(req.url, 'http://localhost').searchParams;
    playerUuid = params.get('playerId') || null;
  } catch (e) {}

  // Validate UUID format (basic check)
  if (playerUuid && !/^[0-9a-f-]{36}$/i.test(playerUuid)) {
    playerUuid = null;
  }

  console.log(`Player connected: ${connId}${playerUuid ? ` (uuid: ${playerUuid.substring(0, 8)}...)` : ''}`);

  // Create player entity
  const eid = addEntity(world);
  addComponent(world, eid, Position);
  addComponent(world, eid, Velocity);
  addComponent(world, eid, Rotation);
  addComponent(world, eid, Player);
  addComponent(world, eid, Health);
  addComponent(world, eid, Hunger);
  addComponent(world, eid, Thirst);
  addComponent(world, eid, Temperature);
  addComponent(world, eid, Inventory);
  initInventory(eid);
  addComponent(world, eid, Hotbar);
  addComponent(world, eid, Collider);
  addComponent(world, eid, Sprite);
  addComponent(world, eid, NetworkSync);
  addComponent(world, eid, ActiveTool);
  addComponent(world, eid, Damageable);
  addComponent(world, eid, Armor);

  // Check if we have saved data for this player
  let restored = false;
  let playerName;
  const savedData = playerUuid ? gameState.playersByUuid.get(playerUuid) : null;

  if (savedData && savedData.alive) {
    // Restore from saved state
    playerName = restorePlayer(eid, savedData, gameState) || randomPlayerName();
    restored = true;
    console.log(`Restored player ${playerName} from save`);
  } else {
    // Fresh spawn on beach
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
    Health.current[eid] = PLAYER_MAX_HP;
    Health.max[eid] = PLAYER_MAX_HP;
    Hunger.current[eid] = PLAYER_MAX_HUNGER;
    Hunger.max[eid] = PLAYER_MAX_HUNGER;
    Thirst.current[eid] = PLAYER_MAX_THIRST;
    Thirst.max[eid] = PLAYER_MAX_THIRST;

    // Starting items
    Inventory.items[eid][0] = ITEM.ROCK;
    Inventory.counts[eid][0] = 1;
    Inventory.durability[eid][0] = 50;
    Inventory.items[eid][1] = ITEM.TORCH;
    Inventory.counts[eid][1] = 1;
    Inventory.durability[eid][1] = 50;
    Hotbar.selectedSlot[eid] = 0;

    playerName = (savedData && savedData.name) ? savedData.name : randomPlayerName();
  }

  Velocity.vx[eid] = 0;
  Velocity.vy[eid] = 0;
  Player.connectionId[eid] = connId;
  Hunger.max[eid] = PLAYER_MAX_HUNGER;
  Hunger.decayRate[eid] = 1;
  Thirst.max[eid] = PLAYER_MAX_THIRST;
  Thirst.decayRate[eid] = 1;
  Temperature.current[eid] = 20;
  Temperature.comfort[eid] = 1;
  Collider.radius[eid] = PLAYER_COLLIDER_RADIUS;
  Sprite.spriteId[eid] = 1; // player sprite
  NetworkSync.lastTick[eid] = gameState.tick;

  gameState.entityTypes.set(eid, ENTITY_TYPE.PLAYER);
  gameState.playerNames.set(eid, playerName);
  gameState.playerStats.set(eid, { kills: 0, resources: 0, name: playerName });
  gameState.newEntities.add(eid);

  // Track UUID <-> EID mapping
  if (playerUuid) {
    gameState.eidToUuid.set(eid, playerUuid);
    gameState.uuidToEid.set(playerUuid, eid);
    // Resolve any pending auth entries for this UUID
    resolveAuthForPlayer(playerUuid, eid, gameState);
  }

  const client = {
    ws,
    playerEid: eid,
    connId,
    playerName,
    uuid: playerUuid,
    input: { keys: 0, mouseAngle: 0, mouseAction: MOUSE_ACTION.NONE },
    mouseAction: MOUSE_ACTION.NONE,
    sprinting: false,
    craftRequest: null,
    buildRequest: null,
    interactRequest: null,
    invRequest: null,
    respawnRequest: null,
    containerAction: null,
    tcAuthAction: null,
    chatMessage: null,
    hammerUpgradeRequest: null,
    drinkWaterRequest: null,
    reloadRequest: false,
    spawnTick: gameState.tick,
    spawnProtectionUntil: restored ? gameState.tick : gameState.tick + 10 * SERVER_TPS,
    isFirstSpawn: !restored,
    // Rate limiting
    actionTimestamps: [], // recent action timestamps for rate limiting
  };
  gameState.clients.set(connId, client);

  // Send player ID and world info
  ws.send(JSON.stringify({
    type: MSG.PLAYER_ID,
    eid,
    connId,
    name: playerName,
  }));

  ws.send(JSON.stringify({
    type: MSG.WORLD_INFO,
    worldSize: WORLD_SIZE,
    tileSize: TILE_SIZE,
    biomes: serializeBiomeMap(gameState.biomeMap),
    seed: 12345,
    radiationZones: gameState.radiationZones || [],
  }));

  // Send current weather
  if (gameState.weather !== undefined) {
    ws.send(JSON.stringify({ type: MSG.WEATHER, weather: gameState.weather }));
  }

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

    // Save player state before removing entity
    if (playerUuid && hasComponent(world, eid, Position)) {
      const invItems = [];
      const invCounts = [];
      const invDurability = [];
      if (Inventory.items[eid]) {
        for (let i = 0; i < 24; i++) {
          invItems.push(Inventory.items[eid][i] || 0);
          invCounts.push(Inventory.counts[eid][i] || 0);
          invDurability.push(Inventory.durability[eid]?.[i] || 0);
        }
      }
      gameState.playersByUuid.set(playerUuid, {
        x: Position.x[eid],
        y: Position.y[eid],
        hp: Health.current[eid],
        maxHp: Health.max[eid],
        hunger: Hunger.current[eid],
        thirst: Thirst.current[eid],
        invItems,
        invCounts,
        invDurability,
        selectedSlot: Hotbar.selectedSlot[eid],
        armor: {
          head: Armor.headSlot[eid] || 0,
          chest: Armor.chestSlot[eid] || 0,
          legs: Armor.legsSlot[eid] || 0,
        },
        name: playerName,
        alive: Health.current[eid] > 0,
      });
    }

    gameState.clients.delete(connId);
    gameState.removedEntities.add(eid);
    gameState.entityTypes.delete(eid);
    gameState.playerNames.delete(eid);
    gameState.playerStats.delete(eid);
    if (playerUuid) {
      gameState.eidToUuid.delete(eid);
      gameState.uuidToEid.delete(playerUuid);
    }
    if (gameState.clipState) gameState.clipState.delete(eid);
    if (gameState.craftQueue) gameState.craftQueue.delete(connId);
    removeEntity(world, eid);
  });

  ws.on('error', () => {});
});

// Rate limit check: max 5 actions per second for craft/build/interact
function checkRateLimit(client) {
  const now = Date.now();
  client.actionTimestamps = client.actionTimestamps.filter(t => now - t < 1000);
  if (client.actionTimestamps.length >= 5) return false;
  client.actionTimestamps.push(now);
  return true;
}

function handleClientMessage(connId, msg) {
  const client = gameState.clients.get(connId);
  if (!client) return;

  try {
  switch (msg.type) {
    case MSG.INPUT: {
      const keys = typeof msg.keys === 'number' ? (msg.keys & 0x3F) : 0; // mask to valid bits
      const mouseAngle = typeof msg.mouseAngle === 'number' && isFinite(msg.mouseAngle) ? msg.mouseAngle : 0;
      const mouseAction = [MOUSE_ACTION.NONE, MOUSE_ACTION.PRIMARY, MOUSE_ACTION.SECONDARY].includes(msg.mouseAction) ? msg.mouseAction : MOUSE_ACTION.NONE;
      // Validate x/y bounds
      const maxCoord = WORLD_SIZE * TILE_SIZE;
      const x = typeof msg.x === 'number' && isFinite(msg.x) ? Math.max(0, Math.min(maxCoord, msg.x)) : undefined;
      const y = typeof msg.y === 'number' && isFinite(msg.y) ? Math.max(0, Math.min(maxCoord, msg.y)) : undefined;
      client.input = { keys, mouseAngle, mouseAction, x, y };
      if (msg.selectedSlot !== undefined && typeof msg.selectedSlot === 'number' && msg.selectedSlot >= 0 && msg.selectedSlot < 6) {
        Hotbar.selectedSlot[client.playerEid] = msg.selectedSlot;
      }
      break;
    }

    case MSG.CRAFT:
      if (!checkRateLimit(client)) break;
      client.craftRequest = msg.recipeId;
      break;

    case MSG.BUILD:
      if (!checkRateLimit(client)) break;
      client.buildRequest = {
        pieceType: msg.pieceType,
        x: msg.x,
        y: msg.y,
      };
      break;

    case MSG.INTERACT:
      if (!checkRateLimit(client)) break;
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

    case MSG.CONTAINER_ACTION:
      client.containerAction = {
        action: msg.action,
        fromSlot: msg.fromSlot,
        itemId: msg.itemId,
      };
      break;

    case MSG.TC_AUTH_ACTION:
      client.tcAuthAction = {
        tcEid: msg.tcEid,
        action: msg.action,
      };
      break;

    case MSG.CHAT_SEND:
      if (msg.text && typeof msg.text === 'string') {
        client.chatMessage = msg.text.substring(0, 100); // limit length
      }
      break;

    case MSG.HAMMER_UPGRADE:
      client.hammerUpgradeRequest = { targetEid: msg.targetEid };
      break;

    case MSG.DRINK_WATER:
      client.drinkWaterRequest = true;
      break;

    case MSG.RELOAD:
      client.reloadRequest = true;
      break;

    case MSG.HAMMER_REPAIR:
      client.hammerRepairRequest = { targetEid: msg.targetEid };
      break;

    case MSG.CRAFT_CANCEL:
      client.craftCancel = true;
      break;

    case MSG.NPC_TRADE_BUY:
      if (!checkRateLimit(client)) break;
      client.npcTradeBuy = { npcEid: msg.npcEid, tradeIdx: msg.tradeIdx };
      break;

    case MSG.RECYCLE:
      if (!checkRateLimit(client)) break;
      client.recycleRequest = { recyclerEid: msg.recyclerEid, slot: msg.slot };
      break;

    case MSG.RESEARCH:
      if (!checkRateLimit(client)) break;
      client.researchRequest = { tableEid: msg.tableEid, slot: msg.slot, recipeId: msg.recipeId };
      break;

    case MSG.LEADERBOARD_REQ: {
      // Gather top 5 by kills, top 5 by resources
      const all = [...gameState.playerStats.values()];
      const byKills = all.sort((a, b) => b.kills - a.kills).slice(0, 5)
        .map(s => ({ name: s.name, kills: s.kills, resources: s.resources }));
      ws.send(JSON.stringify({ type: MSG.LEADERBOARD, top: byKills }));
      break;
    }

    case MSG.PING:
      try {
        client.ws.send(JSON.stringify({ type: MSG.PONG, t: msg.t }));
      } catch (e) {}
      break;
  }
  } catch (err) {
    console.error(`Message handler error (connId=${connId}):`, err.message);
  }
}

// ── Game Loop ──
let lastTick = performance.now();
const serverStartTime = Date.now();
let lastTickDuration = 0;
let avgTickDuration = 0;

function gameLoop() {
  const now = performance.now();
  const elapsed = now - lastTick;

  if (elapsed >= SERVER_TICK_MS) {
    lastTick = now - (elapsed % SERVER_TICK_MS);
    gameState.tick++;
    const tickStart = performance.now();

    // Rebuild spatial hash
    const sh = gameState.spatialHash;
    sh.clear();
    const allPositioned = query(world, [Position]);
    for (let i = 0; i < allPositioned.length; i++) {
      const eid = allPositioned[i];
      sh.insert(eid, Position.x[eid], Position.y[eid]);
    }

    // Run all systems
    for (const system of systems) {
      try {
        system(world);
      } catch (err) {
        console.error(`System error in ${system.name || 'unknown'}:`, err.message);
      }
    }

    lastTickDuration = performance.now() - tickStart;
    avgTickDuration = avgTickDuration * 0.95 + lastTickDuration * 0.05;
  }
}

// Run frequently enough to stay close to 20 TPS (50ms per tick)
setInterval(gameLoop, 5);

// ── Auto-save every 60 seconds ──
setInterval(() => {
  saveWorld(world, gameState);
  // Notify clients of save
  for (const [connId, client] of gameState.clients) {
    if (client.ws) {
      try {
        client.ws.send(JSON.stringify({ type: MSG.SAVE_NOTIFY }));
      } catch (e) {}
    }
  }
}, 60 * 1000);

// ── Save on shutdown ──
process.on('SIGINT', () => {
  console.log('Saving world before shutdown...');
  saveWorld(world, gameState);
  process.exit(0);
});
process.on('SIGTERM', () => {
  console.log('Saving world before shutdown...');
  saveWorld(world, gameState);
  process.exit(0);
});

httpServer.listen(PORT, () => {
  console.log(`Rust Clone server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} to play`);
});
