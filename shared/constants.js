// ── Tick / Timing ──
export const SERVER_TPS = 20;
export const SERVER_TICK_MS = 1000 / SERVER_TPS;
export const CLIENT_FPS = 60;
export const WORLD_SIZE = 500; // tiles
export const TILE_SIZE = 2; // meters per tile
export const WORLD_METERS = WORLD_SIZE * TILE_SIZE;

// ── Day/Night ──
export const DAY_NIGHT_CYCLE_TICKS = 30 * 60 * SERVER_TPS; // 30 min real = full cycle
export const DAY_PORTION = 2 / 3; // 20 min day
export const NIGHT_PORTION = 1 / 3; // 10 min night

// ── Player ──
export const PLAYER_SPEED = 10.0; // tiles/sec
export const PLAYER_SPRINT_MULT = 2.0;
export const PLAYER_MAX_HP = 100;
export const PLAYER_MAX_HUNGER = 100;
export const PLAYER_MAX_THIRST = 100;
export const PLAYER_COLLIDER_RADIUS = 0.4;
export const RESPAWN_WAIT_TICKS = 10 * SERVER_TPS;

// ── Interest management ──
export const VIEW_RADIUS = 40; // tiles
export const INTEREST_RADIUS = 60; // tiles (VIEW_RADIUS * 1.5)

// ── Items ──
export const ITEM = {
  NONE: 0,
  ROCK: 1,
  TORCH: 2,
  WOOD: 3,
  STONE: 4,
  METAL_ORE: 5,
  SULFUR_ORE: 6,
  METAL_FRAGS: 7,
  SULFUR: 8,
  CLOTH: 9,
  LEATHER: 10,
  ANIMAL_FAT: 11,
  RAW_MEAT: 12,
  COOKED_MEAT: 13,
  CHARCOAL: 14,
  GUNPOWDER: 15,
  LOW_GRADE_FUEL: 16,
  BONE_FRAGMENTS: 17,
  // Tools
  STONE_HATCHET: 20,
  STONE_PICKAXE: 21,
  WOODEN_SPEAR: 22,
  METAL_HATCHET: 23,
  METAL_PICKAXE: 24,
  SALVAGED_SWORD: 25,
  BONE_KNIFE: 26,
  HAMMER: 27,
  BUILDING_PLAN: 28,
  // Ranged
  HUNTING_BOW: 30,
  CROSSBOW: 31,
  REVOLVER: 32,
  SEMI_AUTO_PISTOL: 33,
  SHOTGUN: 34,
  ASSAULT_RIFLE: 35,
  // Ammo
  WOODEN_ARROW: 40,
  BONE_ARROW: 41,
  PISTOL_AMMO: 42,
  SHOTGUN_AMMO: 43,
  RIFLE_AMMO: 44,
  // Medical
  BANDAGE: 50,
  // Deployables
  SLEEPING_BAG: 60,
  CAMPFIRE_ITEM: 61,
  FURNACE_ITEM: 62,
  TOOL_CUPBOARD_ITEM: 63,
  WORKBENCH_T1_ITEM: 64,
  WORKBENCH_T2_ITEM: 65,
  WORKBENCH_T3_ITEM: 66,
  BED: 67,
  // Building
  KEY_LOCK: 70,
  CODE_LOCK: 71,
  PAPER_MAP: 72,
  ROPE: 73,
  METAL_PIPE: 74,
  SPRING: 75,
  SMALL_STASH: 76,
  SCRAP: 77,
  // Armor
  LEATHER_HEAD: 90,
  LEATHER_CHEST: 91,
  LEATHER_LEGS: 92,
  HAZMAT_SUIT: 93,
  // Explosives
  SATCHEL_CHARGE: 80,
  C4: 81,
  // Doors
  WOOD_DOOR: 82,
  METAL_DOOR: 83,
  // Storage
  STORAGE_BOX: 84,
};

// Item definitions: name, maxStack, category
export const ITEM_DEFS = {
  [ITEM.NONE]: { name: 'Empty', maxStack: 0, cat: 'none' },
  [ITEM.ROCK]: { name: 'Rock', maxStack: 1, cat: 'tool', damage: 10, swingRate: 1.0, gatherMult: 1, durability: 50 },
  [ITEM.TORCH]: { name: 'Torch', maxStack: 1, cat: 'tool', damage: 5, swingRate: 1.0, light: 8, durability: 50 },
  [ITEM.WOOD]: { name: 'Wood', maxStack: 1000, cat: 'resource' },
  [ITEM.STONE]: { name: 'Stone', maxStack: 1000, cat: 'resource' },
  [ITEM.METAL_ORE]: { name: 'Metal Ore', maxStack: 1000, cat: 'resource' },
  [ITEM.SULFUR_ORE]: { name: 'Sulfur Ore', maxStack: 1000, cat: 'resource' },
  [ITEM.METAL_FRAGS]: { name: 'Metal Fragments', maxStack: 1000, cat: 'resource' },
  [ITEM.SULFUR]: { name: 'Sulfur', maxStack: 1000, cat: 'resource' },
  [ITEM.CLOTH]: { name: 'Cloth', maxStack: 1000, cat: 'resource' },
  [ITEM.LEATHER]: { name: 'Leather', maxStack: 1000, cat: 'resource' },
  [ITEM.ANIMAL_FAT]: { name: 'Animal Fat', maxStack: 1000, cat: 'resource' },
  [ITEM.RAW_MEAT]: { name: 'Raw Meat', maxStack: 50, cat: 'food' },
  [ITEM.COOKED_MEAT]: { name: 'Cooked Meat', maxStack: 50, cat: 'food' },
  [ITEM.CHARCOAL]: { name: 'Charcoal', maxStack: 1000, cat: 'resource' },
  [ITEM.GUNPOWDER]: { name: 'Gunpowder', maxStack: 1000, cat: 'resource' },
  [ITEM.LOW_GRADE_FUEL]: { name: 'Low Grade Fuel', maxStack: 500, cat: 'resource' },
  [ITEM.BONE_FRAGMENTS]: { name: 'Bone Fragments', maxStack: 1000, cat: 'resource' },
  // Tools
  [ITEM.STONE_HATCHET]: { name: 'Stone Hatchet', maxStack: 1, cat: 'tool', damage: 15, swingRate: 1.2, gatherMult: 2.5, durability: 200 },
  [ITEM.STONE_PICKAXE]: { name: 'Stone Pickaxe', maxStack: 1, cat: 'tool', damage: 12, swingRate: 1.2, gatherMult: 2.5, durability: 200 },
  [ITEM.WOODEN_SPEAR]: { name: 'Wooden Spear', maxStack: 1, cat: 'melee', damage: 25, swingRate: 0.8, durability: 150 },
  [ITEM.METAL_HATCHET]: { name: 'Metal Hatchet', maxStack: 1, cat: 'tool', damage: 20, swingRate: 1.4, gatherMult: 5, durability: 500 },
  [ITEM.METAL_PICKAXE]: { name: 'Metal Pickaxe', maxStack: 1, cat: 'tool', damage: 18, swingRate: 1.4, gatherMult: 5, durability: 500 },
  [ITEM.SALVAGED_SWORD]: { name: 'Salvaged Sword', maxStack: 1, cat: 'melee', damage: 40, swingRate: 1.0, durability: 300 },
  [ITEM.BONE_KNIFE]: { name: 'Bone Knife', maxStack: 1, cat: 'melee', damage: 20, swingRate: 1.5, durability: 100 },
  [ITEM.HAMMER]: { name: 'Hammer', maxStack: 1, cat: 'tool', damage: 5, swingRate: 1.0, durability: 300 },
  [ITEM.BUILDING_PLAN]: { name: 'Building Plan', maxStack: 1, cat: 'tool' },
  // Ranged
  [ITEM.HUNTING_BOW]: { name: 'Hunting Bow', maxStack: 1, cat: 'ranged', damage: 30, fireRate: 0.8, range: 60, ammoType: ITEM.WOODEN_ARROW, clipSize: 1, spread: 0.08, adsSpread: 0.02 },
  [ITEM.CROSSBOW]: { name: 'Crossbow', maxStack: 1, cat: 'ranged', damage: 50, fireRate: 0.4, range: 80, ammoType: ITEM.WOODEN_ARROW, clipSize: 1, spread: 0.06, adsSpread: 0.01 },
  [ITEM.REVOLVER]: { name: 'Revolver', maxStack: 1, cat: 'ranged', damage: 35, fireRate: 1.5, range: 50, ammoType: ITEM.PISTOL_AMMO, clipSize: 6, spread: 0.1, adsSpread: 0.03 },
  [ITEM.SEMI_AUTO_PISTOL]: { name: 'Semi-Auto Pistol', maxStack: 1, cat: 'ranged', damage: 30, fireRate: 2.0, range: 60, ammoType: ITEM.PISTOL_AMMO, clipSize: 12, spread: 0.08, adsSpread: 0.025 },
  [ITEM.SHOTGUN]: { name: 'Shotgun', maxStack: 1, cat: 'ranged', damage: 70, fireRate: 0.5, range: 20, ammoType: ITEM.SHOTGUN_AMMO, clipSize: 2, spread: 0.15, adsSpread: 0.08 },
  [ITEM.ASSAULT_RIFLE]: { name: 'Assault Rifle', maxStack: 1, cat: 'ranged', damage: 28, fireRate: 4.0, range: 80, ammoType: ITEM.RIFLE_AMMO, clipSize: 30, spread: 0.07, adsSpread: 0.02 },
  // Ammo
  [ITEM.WOODEN_ARROW]: { name: 'Wooden Arrow', maxStack: 64, cat: 'ammo' },
  [ITEM.BONE_ARROW]: { name: 'Bone Arrow', maxStack: 64, cat: 'ammo' },
  [ITEM.PISTOL_AMMO]: { name: 'Pistol Ammo', maxStack: 128, cat: 'ammo' },
  [ITEM.SHOTGUN_AMMO]: { name: 'Shotgun Ammo', maxStack: 64, cat: 'ammo' },
  [ITEM.RIFLE_AMMO]: { name: 'Rifle Ammo', maxStack: 128, cat: 'ammo' },
  // Medical
  [ITEM.BANDAGE]: { name: 'Bandage', maxStack: 10, cat: 'medical', healAmount: 15 },
  // Deployables
  [ITEM.SLEEPING_BAG]: { name: 'Sleeping Bag', maxStack: 1, cat: 'deployable' },
  [ITEM.CAMPFIRE_ITEM]: { name: 'Campfire', maxStack: 1, cat: 'deployable' },
  [ITEM.FURNACE_ITEM]: { name: 'Furnace', maxStack: 1, cat: 'deployable' },
  [ITEM.TOOL_CUPBOARD_ITEM]: { name: 'Tool Cupboard', maxStack: 1, cat: 'deployable' },
  [ITEM.WORKBENCH_T1_ITEM]: { name: 'Workbench T1', maxStack: 1, cat: 'deployable' },
  [ITEM.WORKBENCH_T2_ITEM]: { name: 'Workbench T2', maxStack: 1, cat: 'deployable' },
  [ITEM.WORKBENCH_T3_ITEM]: { name: 'Workbench T3', maxStack: 1, cat: 'deployable' },
  [ITEM.BED]: { name: 'Bed', maxStack: 1, cat: 'deployable' },
  // Building
  [ITEM.KEY_LOCK]: { name: 'Key Lock', maxStack: 1, cat: 'building' },
  [ITEM.CODE_LOCK]: { name: 'Code Lock', maxStack: 1, cat: 'building' },
  [ITEM.PAPER_MAP]: { name: 'Paper Map', maxStack: 1, cat: 'tool' },
  [ITEM.ROPE]: { name: 'Rope', maxStack: 10, cat: 'resource' },
  [ITEM.METAL_PIPE]: { name: 'Metal Pipe', maxStack: 5, cat: 'resource' },
  [ITEM.SPRING]: { name: 'Spring', maxStack: 5, cat: 'resource' },
  [ITEM.SMALL_STASH]: { name: 'Small Stash', maxStack: 5, cat: 'resource' },
  [ITEM.SCRAP]: { name: 'Scrap', maxStack: 1000, cat: 'resource' },
  // Explosives
  [ITEM.SATCHEL_CHARGE]: { name: 'Satchel Charge', maxStack: 10, cat: 'explosive', structDamage: 200 },
  [ITEM.C4]: { name: 'C4', maxStack: 10, cat: 'explosive', structDamage: 500 },
  // Doors
  [ITEM.WOOD_DOOR]: { name: 'Wood Door', maxStack: 1, cat: 'building' },
  [ITEM.METAL_DOOR]: { name: 'Metal Door', maxStack: 1, cat: 'building' },
  [ITEM.STORAGE_BOX]: { name: 'Storage Box', maxStack: 1, cat: 'deployable' },
  // Armor
  [ITEM.LEATHER_HEAD]: { name: 'Leather Helmet', maxStack: 1, cat: 'armor', armorSlot: 'head', armorPct: 0.10 },
  [ITEM.LEATHER_CHEST]: { name: 'Leather Chest', maxStack: 1, cat: 'armor', armorSlot: 'chest', armorPct: 0.15 },
  [ITEM.LEATHER_LEGS]: { name: 'Leather Legs', maxStack: 1, cat: 'armor', armorSlot: 'legs', armorPct: 0.10 },
  [ITEM.HAZMAT_SUIT]: { name: 'Hazmat Suit', maxStack: 1, cat: 'armor', armorSlot: 'chest', armorPct: 0.05, radProtection: true },
};

// ── Resource Node Types ──
export const RESOURCE_TYPE = {
  TREE: 1,
  STONE_NODE: 2,
  METAL_NODE: 3,
  SULFUR_NODE: 4,
  HEMP: 5,
};

export const RESOURCE_NODE_DEFS = {
  [RESOURCE_TYPE.TREE]: { hp: 100, amount: 200, resource: ITEM.WOOD, respawnTime: 5 * 60 * SERVER_TPS },
  [RESOURCE_TYPE.STONE_NODE]: { hp: 150, amount: 150, resource: ITEM.STONE, respawnTime: 5 * 60 * SERVER_TPS },
  [RESOURCE_TYPE.METAL_NODE]: { hp: 200, amount: 100, resource: ITEM.METAL_ORE, respawnTime: 10 * 60 * SERVER_TPS },
  [RESOURCE_TYPE.SULFUR_NODE]: { hp: 200, amount: 75, resource: ITEM.SULFUR_ORE, respawnTime: 10 * 60 * SERVER_TPS },
  [RESOURCE_TYPE.HEMP]: { hp: 1, amount: 10, resource: ITEM.CLOTH, respawnTime: 3 * 60 * SERVER_TPS },
};

// Gather amounts per hit: [rock, stone tool, metal tool]
export const GATHER_AMOUNTS = {
  [RESOURCE_TYPE.TREE]: [10, 25, 50],
  [RESOURCE_TYPE.STONE_NODE]: [10, 25, 50],
  [RESOURCE_TYPE.METAL_NODE]: [0, 10, 30],
  [RESOURCE_TYPE.SULFUR_NODE]: [0, 10, 30],
  [RESOURCE_TYPE.HEMP]: [10, 10, 10],
};

// ── Animal Types ──
export const ANIMAL_TYPE = {
  DEER: 1,
  BOAR: 2,
  WOLF: 3,
  BEAR: 4,
};

export const ANIMAL_DEFS = {
  // Deer: passive prey, flee-only. Speed 12 lets new players chase with rock melee.
  [ANIMAL_TYPE.DEER]: { hp: 50, damage: 0, speed: 12.0, aggroRange: 0, behavior: 'flee', drops: [[ITEM.RAW_MEAT, 4], [ITEM.LEATHER, 15], [ITEM.ANIMAL_FAT, 5], [ITEM.BONE_FRAGMENTS, 10]] },
  // Boar: defensive, fights back if you get close. Aggro 8 makes proximity matter.
  [ANIMAL_TYPE.BOAR]: { hp: 75, damage: 10, speed: 9.0, aggroRange: 8, behavior: 'flee_fight', drops: [[ITEM.RAW_MEAT, 3], [ITEM.LEATHER, 10], [ITEM.ANIMAL_FAT, 10], [ITEM.BONE_FRAGMENTS, 8]] },
  // Wolf: aggressive pack hunter. Fast enough to be scary, outrunnable at sprint.
  [ANIMAL_TYPE.WOLF]: { hp: 100, damage: 20, speed: 12.0, aggroRange: 20, behavior: 'aggro', drops: [[ITEM.RAW_MEAT, 2], [ITEM.LEATHER, 15], [ITEM.ANIMAL_FAT, 5], [ITEM.BONE_FRAGMENTS, 15]] },
  // Bear: boss-tier. Speed 10 means you must sprint to escape — no casual kiting.
  [ANIMAL_TYPE.BEAR]: { hp: 250, damage: 40, speed: 10.0, aggroRange: 15, behavior: 'aggro', drops: [[ITEM.RAW_MEAT, 4], [ITEM.LEATHER, 25], [ITEM.ANIMAL_FAT, 15], [ITEM.BONE_FRAGMENTS, 20]] },
};

// ── AI States ──
export const AI_STATE = {
  IDLE: 0,
  WANDER: 1,
  FLEE: 2,
  CHASE: 3,
  ATTACK: 4,
};

// ── Biomes ──
export const BIOME = {
  BEACH: 0,
  GRASSLAND: 1,
  FOREST: 2,
  DESERT: 3,
  SNOW: 4,
  MOUNTAIN: 5,
  WATER: 6,
  ROAD: 7,
};

export const BIOME_TEMP_MOD = {
  [BIOME.BEACH]: 0,
  [BIOME.GRASSLAND]: 0,
  [BIOME.FOREST]: -5,
  [BIOME.DESERT]: 15,
  [BIOME.SNOW]: -20,
  [BIOME.MOUNTAIN]: -10,
  [BIOME.WATER]: 0,
  [BIOME.ROAD]: 0,
};

// ── Structure Types ──
export const STRUCT_TYPE = {
  FOUNDATION: 1,
  WALL: 2,
  DOORWAY: 3,
  DOOR: 4,
  WINDOW: 7,
  FOUNDATION_TRI: 8,
};

export const STRUCT_TIER = { TWIG: 0, WOOD: 1, STONE: 2, METAL: 3 };

// Upgrade costs per tier: tier index -> [itemId, count]
export const UPGRADE_COSTS = {
  [1]: [ITEM.WOOD, 200],       // twig -> wood
  [2]: [ITEM.STONE, 200],      // wood -> stone
  [3]: [ITEM.METAL_FRAGS, 200], // stone -> metal
};

export const STRUCT_HP = {
  [STRUCT_TYPE.FOUNDATION]: [10, 250, 500, 1000],
  [STRUCT_TYPE.FOUNDATION_TRI]: [10, 250, 500, 1000],
  [STRUCT_TYPE.WALL]: [10, 250, 500, 1000],
  [STRUCT_TYPE.DOORWAY]: [10, 250, 500, 1000],
  [STRUCT_TYPE.WINDOW]: [10, 250, 500, 1000],
  [STRUCT_TYPE.DOOR]: [0, 200, 0, 800], // wood door or metal door only
};

// ── Crafting Recipes ──
export const CRAFT_TIER = { HAND: 0, WORKBENCH_T1: 1, WORKBENCH_T2: 2, WORKBENCH_T3: 3 };

// { id, result, resultCount, tier, ingredients: [[itemId, count], ...] }
export const RECIPES = [
  { id: 1, result: ITEM.STONE_HATCHET, count: 1, tier: CRAFT_TIER.HAND, ing: [[ITEM.WOOD, 100], [ITEM.STONE, 50]] },
  { id: 2, result: ITEM.STONE_PICKAXE, count: 1, tier: CRAFT_TIER.HAND, ing: [[ITEM.WOOD, 100], [ITEM.STONE, 50]] },
  { id: 3, result: ITEM.WOODEN_SPEAR, count: 1, tier: CRAFT_TIER.HAND, ing: [[ITEM.WOOD, 150]] },
  { id: 4, result: ITEM.HUNTING_BOW, count: 1, tier: CRAFT_TIER.HAND, ing: [[ITEM.WOOD, 100], [ITEM.CLOTH, 25]] },
  { id: 5, result: ITEM.WOODEN_ARROW, count: 5, tier: CRAFT_TIER.HAND, ing: [[ITEM.WOOD, 13], [ITEM.STONE, 5]] },
  { id: 6, result: ITEM.BANDAGE, count: 1, tier: CRAFT_TIER.HAND, ing: [[ITEM.CLOTH, 8]] },
  { id: 7, result: ITEM.SLEEPING_BAG, count: 1, tier: CRAFT_TIER.HAND, ing: [[ITEM.CLOTH, 15]] },
  { id: 8, result: ITEM.BUILDING_PLAN, count: 1, tier: CRAFT_TIER.HAND, ing: [[ITEM.WOOD, 10]] },
  { id: 9, result: ITEM.HAMMER, count: 1, tier: CRAFT_TIER.HAND, ing: [[ITEM.WOOD, 50], [ITEM.STONE, 25]] },
  { id: 10, result: ITEM.CAMPFIRE_ITEM, count: 1, tier: CRAFT_TIER.HAND, ing: [[ITEM.WOOD, 50], [ITEM.STONE, 25]] },
  { id: 11, result: ITEM.LOW_GRADE_FUEL, count: 4, tier: CRAFT_TIER.HAND, ing: [[ITEM.ANIMAL_FAT, 2], [ITEM.CLOTH, 1]] },
  { id: 12, result: ITEM.BONE_KNIFE, count: 1, tier: CRAFT_TIER.HAND, ing: [[ITEM.BONE_FRAGMENTS, 15]] },
  { id: 13, result: ITEM.BONE_ARROW, count: 5, tier: CRAFT_TIER.HAND, ing: [[ITEM.WOOD, 8], [ITEM.BONE_FRAGMENTS, 5]] },
  { id: 14, result: ITEM.PAPER_MAP, count: 1, tier: CRAFT_TIER.HAND, ing: [[ITEM.WOOD, 5]] },
  { id: 15, result: ITEM.TORCH, count: 1, tier: CRAFT_TIER.HAND, ing: [[ITEM.WOOD, 15], [ITEM.CLOTH, 1]] },
  { id: 37, result: ITEM.WORKBENCH_T1_ITEM, count: 1, tier: CRAFT_TIER.HAND, ing: [[ITEM.WOOD, 250], [ITEM.STONE, 100]] },
  { id: 38, result: ITEM.WORKBENCH_T2_ITEM, count: 1, tier: CRAFT_TIER.WORKBENCH_T1, ing: [[ITEM.WOOD, 250], [ITEM.METAL_FRAGS, 125], [ITEM.STONE, 50]] },
  { id: 39, result: ITEM.WORKBENCH_T3_ITEM, count: 1, tier: CRAFT_TIER.WORKBENCH_T2, ing: [[ITEM.WOOD, 500], [ITEM.METAL_FRAGS, 250], [ITEM.STONE, 100]] },
  // Workbench T1
  { id: 16, result: ITEM.METAL_HATCHET, count: 1, tier: CRAFT_TIER.WORKBENCH_T1, ing: [[ITEM.WOOD, 50], [ITEM.METAL_FRAGS, 38]] },
  { id: 17, result: ITEM.METAL_PICKAXE, count: 1, tier: CRAFT_TIER.WORKBENCH_T1, ing: [[ITEM.WOOD, 50], [ITEM.METAL_FRAGS, 38]] },
  { id: 18, result: ITEM.SALVAGED_SWORD, count: 1, tier: CRAFT_TIER.WORKBENCH_T1, ing: [[ITEM.WOOD, 38], [ITEM.METAL_FRAGS, 8]] },
  { id: 19, result: ITEM.CROSSBOW, count: 1, tier: CRAFT_TIER.WORKBENCH_T1, ing: [[ITEM.WOOD, 100], [ITEM.METAL_FRAGS, 38], [ITEM.ROPE, 1]] },
  { id: 20, result: ITEM.REVOLVER, count: 1, tier: CRAFT_TIER.WORKBENCH_T1, ing: [[ITEM.METAL_FRAGS, 63], [ITEM.CLOTH, 13]] },
  { id: 21, result: ITEM.PISTOL_AMMO, count: 20, tier: CRAFT_TIER.WORKBENCH_T1, ing: [[ITEM.METAL_FRAGS, 3], [ITEM.GUNPOWDER, 2]] },
  { id: 22, result: ITEM.KEY_LOCK, count: 1, tier: CRAFT_TIER.WORKBENCH_T1, ing: [[ITEM.METAL_FRAGS, 13]] },
  { id: 23, result: ITEM.CODE_LOCK, count: 1, tier: CRAFT_TIER.WORKBENCH_T1, ing: [[ITEM.METAL_FRAGS, 50]] },
  { id: 24, result: ITEM.TOOL_CUPBOARD_ITEM, count: 1, tier: CRAFT_TIER.HAND, ing: [[ITEM.WOOD, 500]] },
  { id: 25, result: ITEM.FURNACE_ITEM, count: 1, tier: CRAFT_TIER.WORKBENCH_T1, ing: [[ITEM.STONE, 100], [ITEM.WOOD, 50], [ITEM.LOW_GRADE_FUEL, 25]] },
  { id: 26, result: ITEM.ROPE, count: 1, tier: CRAFT_TIER.WORKBENCH_T1, ing: [[ITEM.CLOTH, 15]] },
  { id: 27, result: ITEM.GUNPOWDER, count: 10, tier: CRAFT_TIER.WORKBENCH_T1, ing: [[ITEM.SULFUR, 5], [ITEM.CHARCOAL, 3]] },
  // Workbench T2
  { id: 28, result: ITEM.SEMI_AUTO_PISTOL, count: 1, tier: CRAFT_TIER.WORKBENCH_T2, ing: [[ITEM.METAL_FRAGS, 100], [ITEM.METAL_PIPE, 1], [ITEM.SPRING, 1]] },
  { id: 29, result: ITEM.SHOTGUN, count: 1, tier: CRAFT_TIER.WORKBENCH_T2, ing: [[ITEM.METAL_FRAGS, 100], [ITEM.METAL_PIPE, 1], [ITEM.WOOD, 25]] },
  { id: 30, result: ITEM.RIFLE_AMMO, count: 20, tier: CRAFT_TIER.WORKBENCH_T2, ing: [[ITEM.METAL_FRAGS, 2], [ITEM.GUNPOWDER, 3]] },
  { id: 36, result: ITEM.SHOTGUN_AMMO, count: 12, tier: CRAFT_TIER.WORKBENCH_T2, ing: [[ITEM.METAL_FRAGS, 3], [ITEM.GUNPOWDER, 2]] },
  { id: 31, result: ITEM.SATCHEL_CHARGE, count: 1, tier: CRAFT_TIER.WORKBENCH_T2, ing: [[ITEM.ROPE, 2], [ITEM.GUNPOWDER, 10], [ITEM.SMALL_STASH, 1]] },
  { id: 32, result: ITEM.METAL_PIPE, count: 1, tier: CRAFT_TIER.WORKBENCH_T2, ing: [[ITEM.METAL_FRAGS, 50]] },
  { id: 33, result: ITEM.SPRING, count: 1, tier: CRAFT_TIER.WORKBENCH_T2, ing: [[ITEM.METAL_FRAGS, 25]] },
  // Workbench T3
  { id: 34, result: ITEM.ASSAULT_RIFLE, count: 1, tier: CRAFT_TIER.WORKBENCH_T3, ing: [[ITEM.METAL_FRAGS, 125], [ITEM.METAL_PIPE, 1], [ITEM.SPRING, 1], [ITEM.WOOD, 25]] },
  { id: 35, result: ITEM.C4, count: 1, tier: CRAFT_TIER.WORKBENCH_T3, ing: [[ITEM.GUNPOWDER, 15], [ITEM.CLOTH, 3], [ITEM.ROPE, 1], [ITEM.METAL_FRAGS, 50]] },
  // Storage
  { id: 40, result: ITEM.STORAGE_BOX, count: 1, tier: CRAFT_TIER.HAND, ing: [[ITEM.WOOD, 125], [ITEM.STONE, 25]] },
  // Armor
  { id: 41, result: ITEM.LEATHER_HEAD, count: 1, tier: CRAFT_TIER.HAND, ing: [[ITEM.LEATHER, 8], [ITEM.CLOTH, 3]] },
  { id: 42, result: ITEM.LEATHER_CHEST, count: 1, tier: CRAFT_TIER.HAND, ing: [[ITEM.LEATHER, 13], [ITEM.CLOTH, 5]] },
  { id: 43, result: ITEM.LEATHER_LEGS, count: 1, tier: CRAFT_TIER.HAND, ing: [[ITEM.LEATHER, 10], [ITEM.CLOTH, 3]] },
  // Scrap recipes
  { id: 44, result: ITEM.METAL_FRAGS, count: 25, tier: CRAFT_TIER.HAND, ing: [[ITEM.SCRAP, 10]] },
  { id: 45, result: ITEM.METAL_PIPE, count: 1, tier: CRAFT_TIER.WORKBENCH_T1, ing: [[ITEM.SCRAP, 20]] },
  { id: 46, result: ITEM.SPRING, count: 1, tier: CRAFT_TIER.WORKBENCH_T1, ing: [[ITEM.SCRAP, 25]] },
  { id: 47, result: ITEM.ROPE, count: 1, tier: CRAFT_TIER.HAND, ing: [[ITEM.SCRAP, 15], [ITEM.CLOTH, 5]] },
  // Bed
  { id: 48, result: ITEM.BED, count: 1, tier: CRAFT_TIER.WORKBENCH_T1, ing: [[ITEM.WOOD, 100], [ITEM.CLOTH, 15], [ITEM.METAL_FRAGS, 20]] },
  // Hazmat Suit
  { id: 49, result: ITEM.HAZMAT_SUIT, count: 1, tier: CRAFT_TIER.WORKBENCH_T1, ing: [[ITEM.CLOTH, 20], [ITEM.LOW_GRADE_FUEL, 10], [ITEM.METAL_FRAGS, 10]] },
];

// Craft time in seconds based on tier (default if recipe has no `time` field)
export function getCraftTime(recipe) {
  if (recipe.time !== undefined) return recipe.time;
  if (recipe.tier >= CRAFT_TIER.WORKBENCH_T2) return 3;
  if (recipe.tier >= CRAFT_TIER.WORKBENCH_T1) return 2;
  return 1;
}

// Inventory size
export const INVENTORY_SLOTS = 24;
export const HOTBAR_SLOTS = 6;

// Item despawn
export const ITEM_DESPAWN_TICKS = 5 * 60 * SERVER_TPS;

// Gather tool classification for gather amounts index
export function getGatherTier(itemId) {
  if (itemId === ITEM.METAL_HATCHET || itemId === ITEM.METAL_PICKAXE) return 2;
  if (itemId === ITEM.STONE_HATCHET || itemId === ITEM.STONE_PICKAXE) return 1;
  return 0; // rock or anything else
}

// Is item a hatchet-type (for trees)?
export function isHatchet(itemId) {
  return itemId === ITEM.ROCK || itemId === ITEM.STONE_HATCHET || itemId === ITEM.METAL_HATCHET;
}

// Is item a pickaxe-type (for ore/stone nodes)?
export function isPickaxe(itemId) {
  return itemId === ITEM.ROCK || itemId === ITEM.STONE_PICKAXE || itemId === ITEM.METAL_PICKAXE;
}

// Which tool type works on which resource
export function canGather(itemId, resourceType) {
  if (resourceType === RESOURCE_TYPE.TREE) return isHatchet(itemId);
  if (resourceType === RESOURCE_TYPE.HEMP) return true;
  return isPickaxe(itemId);
}

// Calculate total armor damage reduction (0-1) from equipped armor slots
export function getArmorReduction(headSlot, chestSlot, legsSlot) {
  let reduction = 0;
  if (headSlot) { const d = ITEM_DEFS[headSlot]; if (d && d.armorPct) reduction += d.armorPct; }
  if (chestSlot) { const d = ITEM_DEFS[chestSlot]; if (d && d.armorPct) reduction += d.armorPct; }
  if (legsSlot) { const d = ITEM_DEFS[legsSlot]; if (d && d.armorPct) reduction += d.armorPct; }
  return Math.min(reduction, 0.65); // cap at 65%
}

// ── Weather ──
export const WEATHER = {
  CLEAR: 0,
  RAIN: 1,
  FOG: 2,
};

export const WEATHER_MIN_DURATION = 5 * 60 * SERVER_TPS;  // 5 min
export const WEATHER_MAX_DURATION = 15 * 60 * SERVER_TPS; // 15 min

// ── NPC Trade ──
export const NPC_TRADES = [
  { itemId: ITEM.BANDAGE, count: 3, cost: 10 },         // 3 bandages for 10 scrap
  { itemId: ITEM.WOODEN_ARROW, count: 10, cost: 5 },    // 10 arrows for 5 scrap
  { itemId: ITEM.LOW_GRADE_FUEL, count: 10, cost: 8 },  // 10 fuel for 8 scrap
  { itemId: ITEM.BONE_ARROW, count: 10, cost: 8 },      // 10 bone arrows for 8 scrap
  { itemId: ITEM.CLOTH, count: 20, cost: 5 },            // 20 cloth for 5 scrap
  { itemId: ITEM.STONE, count: 50, cost: 5 },            // 50 stone for 5 scrap
];

// ── Radiation ──
export const RADIATION_DAMAGE_RATE = 5.0 / SERVER_TPS; // 5 HP/sec without hazmat

// ── Recycler ──
// Maps item ID to what you get back at 50% (floor)
export const RECYCLE_YIELDS = {};
// Build yields from recipes: each recipe's ingredients at 50%
for (const recipe of RECIPES) {
  if (RECYCLE_YIELDS[recipe.result]) continue; // first recipe wins
  const yields = [];
  for (const [itemId, count] of recipe.ing) {
    const half = Math.floor(count * 0.5);
    if (half > 0) yields.push([itemId, half]);
  }
  if (yields.length > 0) RECYCLE_YIELDS[recipe.result] = yields;
}

// ── Research ──
export const RESEARCH_SCRAP_COST = 50; // scrap cost to research an item
// Recipes that require research before they can be crafted (tier >= T1)
export const RESEARCHABLE_RECIPES = RECIPES
  .filter(r => r.tier >= CRAFT_TIER.WORKBENCH_T1)
  .map(r => r.id);

// ── Sleeping bag limit ──
export const MAX_SLEEPING_BAGS = 3;

// ── Helicopter Event ──
export const HELI_MIN_INTERVAL = 15 * 60 * SERVER_TPS; // 15 min
export const HELI_MAX_INTERVAL = 20 * 60 * SERVER_TPS; // 20 min
export const HELI_SPEED = 30; // tiles/sec — crosses map in ~17s
export const HELI_CRATE_UNLOCK_TICKS = 15 * 60 * SERVER_TPS; // 15 min to unlock
export const HELI_CRATE_LOOT = [
  [ITEM.ASSAULT_RIFLE, 1],
  [ITEM.RIFLE_AMMO, 60],
  [ITEM.METAL_FRAGS, 200],
  [ITEM.SCRAP, 100],
  [ITEM.C4, 1],
  [ITEM.SEMI_AUTO_PISTOL, 1],
  [ITEM.PISTOL_AMMO, 40],
];

// Water speed multiplier
export const WATER_SPEED_MULT = 0.5;

// Road speed multiplier (20% faster)
export const ROAD_SPEED_MULT = 1.2;
