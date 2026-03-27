// ── Message Types: Client → Server ──
export const MSG = {
  // Client → Server
  INPUT: 1,
  CRAFT: 2,
  BUILD: 3,
  INTERACT: 4,
  INVENTORY: 5,
  RESPAWN: 6,
  PING: 7,

  // Server → Client
  SNAPSHOT: 50,
  DELTA: 51,
  EVENT: 52,
  INVENTORY_UPDATE: 53,
  PONG: 54,
  PLAYER_ID: 55,
  WORLD_INFO: 56,
  DEATH: 57,
  DESPAWN: 58,
  CONTAINER_OPEN: 59,
  CONTAINER_UPDATE: 60,
  CONTAINER_ACTION: 8,
  TC_AUTH_OPEN: 61,
  TC_AUTH_UPDATE: 62,
  TC_AUTH_ACTION: 9,
  SPAWN_BAGS: 63,
  CHAT: 64,

  // Client → Server
  CHAT_SEND: 10,
  HAMMER_UPGRADE: 11,
  DRINK_WATER: 12,
  RELOAD: 13,
  HAMMER_REPAIR: 14,
  CRAFT_CANCEL: 15,
  LEADERBOARD_REQ: 16,
  CLIP_UPDATE: 65,
  CRAFT_PROGRESS: 66,
  LEADERBOARD: 67,
};

// Input key bitmask
export const KEY = {
  W: 1,
  A: 2,
  S: 4,
  D: 8,
  SHIFT: 16,
  SPACE: 32,
};

// Mouse action
export const MOUSE_ACTION = {
  NONE: 0,
  PRIMARY: 1,
  SECONDARY: 2,
};

// Inventory actions
export const INV_ACTION = {
  MOVE: 1,
  DROP: 2,
  SPLIT: 3,
  EQUIP: 4,
  EQUIP_ARMOR: 5,
  UNEQUIP_ARMOR: 6,
};

// Event types
export const EVENT_TYPE = {
  SOUND: 1,
  HIT_MARKER: 2,
  DEATH_NOTICE: 3,
  CHAT: 4,
};

// Entity type tags for network serialization
export const ENTITY_TYPE = {
  PLAYER: 1,
  RESOURCE_NODE: 2,
  WORLD_ITEM: 3,
  PROJECTILE: 4,
  STRUCTURE: 5,
  ANIMAL: 6,
  CAMPFIRE: 7,
  FURNACE: 8,
  WORKBENCH: 9,
  TOOL_CUPBOARD: 10,
  SLEEPING_BAG: 11,
  DOOR: 12,
  STORAGE_BOX: 13,
  LOOT_BAG: 14,
  BARREL: 15,
  BED: 16,
};
