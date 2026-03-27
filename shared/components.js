// ── Core ──
export const Position = { x: [], y: [] };
export const Velocity = { vx: [], vy: [] };
export const Rotation = { angle: [] };
export const Sprite = { spriteId: [], width: [], height: [], layer: [] };
export const Collider = { radius: [], isStatic: [] };
export const NetworkSync = { lastTick: [], ownerPlayerId: [] };

// ── Player / Living ──
export const Player = { connectionId: [] };
export const Health = { current: [], max: [] };
export const Hunger = { current: [], max: [], decayRate: [] };
export const Thirst = { current: [], max: [], decayRate: [] };
export const Temperature = { current: [], comfort: [] };
export const Armor = { headSlot: [], chestSlot: [], legsSlot: [] };
export const Dead = { timer: [] };

// ── Inventory / Items ──
// Inventory: 24 slots, each slot has itemId and count (stored as arrays of typed arrays per entity)
export const Inventory = { items: [], counts: [] };
export const Hotbar = { selectedSlot: [] };
export const WorldItem = { itemId: [], quantity: [], despawnTimer: [] };
export const ActiveTool = { itemId: [], swingTimer: [], lastUseTime: [] };

// ── Combat ──
export const Projectile = { damage: [], speed: [], sourceEid: [], lifetime: [] };
export const MeleeHitbox = { damage: [], range: [], arc: [], sourceEid: [] };
export const Damageable = { lastHitTime: [], lastHitBy: [] };

// ── Building ──
export const Structure = { structureType: [], tier: [], hp: [], maxHp: [], placedBy: [] };
export const Door = { isOpen: [], lockCode: [], lockType: [] };
export const ToolCupboard = { radius: [] };
export const SleepingBag = { ownerPlayerId: [], cooldown: [] };

// ── World / Resources ──
export const ResourceNode = { resourceType: [], remaining: [], maxAmount: [], respawnTimer: [] };
export const Animal = { animalType: [], aiState: [], aggroRange: [], wanderTargetX: [], wanderTargetY: [], targetEid: [] };
export const Campfire = { fuelRemaining: [], cookSlot0: [], cookSlot1: [], cookProgress0: [], cookProgress1: [] };
export const Workbench = { tier: [] };
export const Furnace = { fuelRemaining: [], inputItem: [], inputCount: [], outputItem: [], outputCount: [], smeltProgress: [] };

export const StorageBox = { slots: [] }; // slots stored as array of {itemId, count} on server via Map

// For TC auth and door auth, we store per-entity data in Maps on the server (not in ECS)
// This is because bitECS doesn't support dynamic-length arrays well

// Helper to initialize Inventory sub-arrays for an entity
export function initInventory(eid) {
  Inventory.items[eid] = new Uint16Array(24);
  Inventory.counts[eid] = new Uint16Array(24);
}

// All components list for easy registration
export const allComponents = [
  Position, Velocity, Rotation, Sprite, Collider, NetworkSync,
  Player, Health, Hunger, Thirst, Temperature, Armor, Dead,
  Inventory, Hotbar, WorldItem, ActiveTool,
  Projectile, MeleeHitbox, Damageable,
  Structure, Door, ToolCupboard, SleepingBag, StorageBox,
  ResourceNode, Animal, Campfire, Workbench, Furnace,
];
