// AI Bot Framework - headless WebSocket client for the game server
import WebSocket from 'ws';
import { MSG, KEY, MOUSE_ACTION, INV_ACTION, ENTITY_TYPE } from '../shared/protocol.js';
import { ITEM, ITEM_DEFS, RECIPES, INVENTORY_SLOTS, STRUCT_TYPE,
         RESOURCE_TYPE, PLAYER_MAX_HP } from '../shared/constants.js';

export class Bot {
  constructor(serverUrl = 'ws://localhost:8780') {
    this.serverUrl = serverUrl;
    this.ws = null;
    this.connected = false;
    this.eid = null;
    this.connId = null;

    // Game state tracking
    this.position = { x: 0, y: 0 };
    this.entities = new Map(); // eid -> entity data
    this.inventory = []; // [{id, n}, ...]
    this.selectedSlot = 0;
    this.hp = PLAYER_MAX_HP;
    this.maxHp = PLAYER_MAX_HP;
    this.hunger = 100;
    this.thirst = 100;
    this.temp = 20;
    this.isDead = false;
    this.worldTime = 0;
    this.lightLevel = 1.0;
    this.worldSize = 0;
    this.tileSize = 0;

    // Input state
    this.keys = 0;
    this.mouseAngle = 0;
    this.mouseAction = MOUSE_ACTION.NONE;

    // Event log
    this.events = [];
    this.deathCount = 0;
    this.lastDeltaTick = 0;

    // Callbacks
    this._onSnapshot = null;
    this._onDelta = null;
    this._onDeath = null;
    this._onInventoryUpdate = null;
    this._messageLog = [];
  }

  connect(timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, timeout);

      this.ws = new WebSocket(this.serverUrl);

      this.ws.on('open', () => {
        this.connected = true;
      });

      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          this._handleMessage(msg);

          // Resolve on first PLAYER_ID message
          if (msg.type === MSG.PLAYER_ID && !this.eid) {
            this.eid = msg.eid;
            this.connId = msg.connId;
          }

          // Resolve once we have both player ID and first delta/inventory
          if (this.eid && this.inventory.length > 0) {
            clearTimeout(timer);
            resolve(this);
          }
        } catch (e) {
          // ignore parse errors
        }
      });

      this.ws.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });

      this.ws.on('close', () => {
        this.connected = false;
      });
    });
  }

  _handleMessage(msg) {
    this._messageLog.push(msg);

    switch (msg.type) {
      case MSG.PLAYER_ID:
        this.eid = msg.eid;
        this.connId = msg.connId;
        break;

      case MSG.WORLD_INFO:
        this.worldSize = msg.worldSize;
        this.tileSize = msg.tileSize;
        break;

      case MSG.DELTA:
        this.lastDeltaTick = msg.tick;
        this.worldTime = msg.time;
        this.lightLevel = msg.light;
        if (msg.entities) {
          for (const ent of msg.entities) {
            const existing = this.entities.get(ent.eid);
            if (existing) {
              Object.assign(existing, ent);
            } else {
              this.entities.set(ent.eid, ent);
            }
            if (ent.eid === this.eid) {
              if (ent.x !== undefined) this.position.x = ent.x;
              if (ent.y !== undefined) this.position.y = ent.y;
              if (ent.hp !== undefined) this.hp = ent.hp;
              if (ent.mhp !== undefined) this.maxHp = ent.mhp;
              if (ent.dead) this.isDead = true;
              else if (ent.hp > 0) this.isDead = false;
            }
          }
        }
        if (msg.removed) {
          for (const eid of msg.removed) {
            this.entities.delete(eid);
          }
        }
        if (this._onDelta) this._onDelta(msg);
        break;

      case MSG.INVENTORY_UPDATE:
        this.inventory = msg.items || [];
        this.selectedSlot = msg.selected || 0;
        if (msg.hp !== undefined) this.hp = msg.hp;
        if (msg.maxHp !== undefined) this.maxHp = msg.maxHp;
        if (msg.hunger !== undefined) this.hunger = msg.hunger;
        if (msg.thirst !== undefined) this.thirst = msg.thirst;
        if (msg.temp !== undefined) this.temp = msg.temp;
        if (this._onInventoryUpdate) this._onInventoryUpdate(msg);
        break;

      case MSG.DEATH:
        this.isDead = true;
        this.deathCount++;
        if (this._onDeath) this._onDeath();
        break;

      case MSG.EVENT:
        if (msg.events) {
          this.events.push(...msg.events);
        }
        break;

      case MSG.DESPAWN:
        if (msg.eid) this.entities.delete(msg.eid);
        break;
    }
  }

  // Send raw message
  send(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  // Movement input
  sendInput(keys = 0, mouseAngle = 0, mouseAction = MOUSE_ACTION.NONE, selectedSlot) {
    const msg = {
      type: MSG.INPUT,
      keys,
      mouseAngle,
      mouseAction,
    };
    if (selectedSlot !== undefined) msg.selectedSlot = selectedSlot;
    this.keys = keys;
    this.mouseAngle = mouseAngle;
    this.mouseAction = mouseAction;
    this.send(msg);
  }

  // Move in a direction using WASD bitmask
  move(keys) {
    this.sendInput(keys, this.mouseAngle, MOUSE_ACTION.NONE);
  }

  // Stop moving
  stop() {
    this.sendInput(0, this.mouseAngle, MOUSE_ACTION.NONE);
  }

  // Look/aim at angle (radians)
  lookAt(angle) {
    this.mouseAngle = angle;
    this.sendInput(this.keys, angle, this.mouseAction);
  }

  // Primary attack (melee swing / shoot)
  attack(angle) {
    if (angle !== undefined) this.mouseAngle = angle;
    this.sendInput(this.keys, this.mouseAngle, MOUSE_ACTION.PRIMARY);
  }

  // Stop attacking
  stopAttack() {
    this.sendInput(this.keys, this.mouseAngle, MOUSE_ACTION.NONE);
  }

  // Select hotbar slot
  selectSlot(slot) {
    this.selectedSlot = slot;
    this.sendInput(this.keys, this.mouseAngle, this.mouseAction, slot);
  }

  // Craft by recipe ID
  craft(recipeId) {
    this.send({ type: MSG.CRAFT, recipeId });
  }

  // Build a structure piece
  build(pieceType, x, y) {
    this.send({ type: MSG.BUILD, pieceType, x, y });
  }

  // Interact with entity (pickup world item, etc)
  interact(targetEid) {
    this.send({ type: MSG.INTERACT, targetEid });
  }

  // Inventory management
  moveItem(fromSlot, toSlot) {
    this.send({ type: MSG.INVENTORY, action: INV_ACTION.MOVE, fromSlot, toSlot });
  }

  dropItem(fromSlot) {
    this.send({ type: MSG.INVENTORY, action: INV_ACTION.DROP, fromSlot });
  }

  splitItem(fromSlot) {
    this.send({ type: MSG.INVENTORY, action: INV_ACTION.SPLIT, fromSlot });
  }

  equipSlot(slot) {
    this.send({ type: MSG.INVENTORY, action: INV_ACTION.EQUIP, fromSlot: slot });
  }

  // Respawn
  respawn(bagEid = null) {
    this.send({ type: MSG.RESPAWN, bagEid });
  }

  // Ping for latency measurement
  ping() {
    this.send({ type: MSG.PING, t: Date.now() });
  }

  // Disconnect
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.connected = false;
    }
  }

  // ─── Query helpers ───

  // Get items of a specific type from inventory
  countItem(itemId) {
    let total = 0;
    for (const slot of this.inventory) {
      if (slot.id === itemId) total += slot.n;
    }
    return total;
  }

  // Find slot index containing an item
  findSlot(itemId) {
    for (let i = 0; i < this.inventory.length; i++) {
      if (this.inventory[i].id === itemId && this.inventory[i].n > 0) return i;
    }
    return -1;
  }

  // Find first empty slot
  findEmptySlot() {
    for (let i = 0; i < this.inventory.length; i++) {
      if (this.inventory[i].id === 0 || this.inventory[i].n === 0) return i;
    }
    return -1;
  }

  // Find nearest entity of a given type
  findNearest(entityType) {
    let best = null;
    let bestDist = Infinity;
    for (const [eid, ent] of this.entities) {
      if (eid === this.eid) continue;
      if (ent.t !== entityType) continue;
      const dx = ent.x - this.position.x;
      const dy = ent.y - this.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        best = { ...ent, dist };
      }
    }
    return best;
  }

  // Find nearest resource node of a specific type
  findNearestResource(resourceType) {
    let best = null;
    let bestDist = Infinity;
    for (const [eid, ent] of this.entities) {
      if (ent.t !== ENTITY_TYPE.RESOURCE_NODE) continue;
      if (resourceType !== undefined && ent.rt !== resourceType) continue;
      if (ent.rem <= 0) continue;
      const dx = ent.x - this.position.x;
      const dy = ent.y - this.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        best = { ...ent, dist };
      }
    }
    return best;
  }

  // Find nearest player (other than self)
  findNearestPlayer() {
    return this.findNearest(ENTITY_TYPE.PLAYER);
  }

  // Find nearest world item
  findNearestWorldItem(itemId) {
    let best = null;
    let bestDist = Infinity;
    for (const [eid, ent] of this.entities) {
      if (ent.t !== ENTITY_TYPE.WORLD_ITEM) continue;
      if (itemId !== undefined && ent.itemId !== itemId) continue;
      const dx = ent.x - this.position.x;
      const dy = ent.y - this.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        best = { ...ent, dist };
      }
    }
    return best;
  }

  // Angle from bot to a point
  angleTo(x, y) {
    return Math.atan2(y - this.position.y, x - this.position.x);
  }

  // Distance from bot to a point
  distanceTo(x, y) {
    const dx = x - this.position.x;
    const dy = y - this.position.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Move toward a position
  moveToward(x, y, sprint = false) {
    const dx = x - this.position.x;
    const dy = y - this.position.y;
    let keys = 0;
    // Map world direction to WASD (note: W is -Y in game)
    if (dy < -0.1) keys |= KEY.W;
    if (dy > 0.1) keys |= KEY.S;
    if (dx < -0.1) keys |= KEY.A;
    if (dx > 0.1) keys |= KEY.D;
    if (sprint) keys |= KEY.SHIFT;
    const angle = Math.atan2(dy, dx);
    this.sendInput(keys, angle, MOUSE_ACTION.NONE);
  }

  // Wait for N milliseconds
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Wait for an inventory update
  waitForInventoryUpdate(timeout = 3000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._onInventoryUpdate = null;
        reject(new Error('Inventory update timeout'));
      }, timeout);
      this._onInventoryUpdate = (msg) => {
        clearTimeout(timer);
        this._onInventoryUpdate = null;
        resolve(msg);
      };
    });
  }

  // Wait for a delta update
  waitForDelta(timeout = 3000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._onDelta = null;
        reject(new Error('Delta update timeout'));
      }, timeout);
      this._onDelta = (msg) => {
        clearTimeout(timer);
        this._onDelta = null;
        resolve(msg);
      };
    });
  }

  // Wait for death
  waitForDeath(timeout = 30000) {
    if (this.isDead) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._onDeath = null;
        reject(new Error('Death timeout'));
      }, timeout);
      this._onDeath = () => {
        clearTimeout(timer);
        this._onDeath = null;
        resolve();
      };
    });
  }

  // Wait for condition (polls)
  async waitForCondition(fn, timeout = 5000, interval = 50) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (fn()) return true;
      await this.wait(interval);
    }
    throw new Error('Condition timeout');
  }
}

// Helper: connect multiple bots
export async function connectBots(count, serverUrl = 'ws://localhost:8780') {
  const bots = [];
  for (let i = 0; i < count; i++) {
    const bot = new Bot(serverUrl);
    await bot.connect();
    bots.push(bot);
  }
  return bots;
}

// Helper: disconnect all bots
export function disconnectAll(bots) {
  for (const bot of bots) {
    bot.disconnect();
  }
}
