import { defineComponent, Types } from 'bitecs';

const { f32, ui32, ui16, ui8, i32, i8, eid } = Types;

// ── Core ──
export const Position = defineComponent({ x: f32, y: f32 });
export const Velocity = defineComponent({ vx: f32, vy: f32 });
export const Rotation = defineComponent({ angle: f32 });
export const Sprite = defineComponent({ spriteId: ui16, width: ui8, height: ui8, layer: ui8 });
export const Collider = defineComponent({ radius: f32, isStatic: ui8 });
export const NetworkSync = defineComponent({ lastTick: ui32, ownerPlayerId: ui32 });

// ── Player / Living ──
export const Player = defineComponent({ connectionId: ui32, respawnTimer: f32 });
export const Health = defineComponent({ current: f32, max: f32 });
export const Hunger = defineComponent({ current: f32, max: f32, decayRate: f32 });
export const Thirst = defineComponent({ current: f32, max: f32, decayRate: f32 });
export const Temperature = defineComponent({ current: f32, comfort: f32 });
export const Armor = defineComponent({ headSlot: ui16, chestSlot: ui16, legsSlot: ui16 });
export const Dead = defineComponent({ timer: f32 });

// ── Inventory / Items ──
// Inventory: 24 slots, each slot has itemId and count (stored as flat arrays)
export const Inventory = defineComponent({
  items: [ui16, 24],   // item IDs for each slot
  counts: [ui16, 24],  // stack counts for each slot
});
export const Hotbar = defineComponent({ selectedSlot: ui8 });
export const WorldItem = defineComponent({ itemId: ui16, quantity: ui16, despawnTimer: f32 });
export const ActiveTool = defineComponent({ itemId: ui16, swingTimer: f32, lastUseTime: f32 });

// ── Combat ──
export const Projectile = defineComponent({ damage: f32, speed: f32, sourceEid: eid, lifetime: f32 });
export const MeleeHitbox = defineComponent({ damage: f32, range: f32, arc: f32, sourceEid: eid });
export const Damageable = defineComponent({ lastHitTime: f32, lastHitBy: eid });

// ── Building ──
export const Structure = defineComponent({ structureType: ui8, tier: ui8, hp: f32, maxHp: f32, placedBy: ui32 });
export const Door = defineComponent({ isOpen: ui8, lockCode: ui16, lockType: ui8 });
export const ToolCupboard = defineComponent({ radius: f32 });
export const SleepingBag = defineComponent({ ownerPlayerId: ui32, cooldown: f32 });

// ── World / Resources ──
export const ResourceNode = defineComponent({ resourceType: ui8, remaining: f32, maxAmount: f32, respawnTimer: f32 });
export const Animal = defineComponent({ animalType: ui8, aiState: ui8, aggroRange: f32, wanderTargetX: f32, wanderTargetY: f32, targetEid: eid });
export const Campfire = defineComponent({ fuelRemaining: f32, cookSlot0: ui16, cookSlot1: ui16, cookProgress0: f32, cookProgress1: f32 });
export const Workbench = defineComponent({ tier: ui8 });
export const Furnace = defineComponent({ fuelRemaining: f32, inputItem: ui16, inputCount: ui16, outputItem: ui16, outputCount: ui16, smeltProgress: f32 });

// For TC auth and door auth, we store per-entity data in Maps on the server (not in ECS)
// This is because bitECS doesn't support dynamic-length arrays well

// All components list for easy registration
export const allComponents = [
  Position, Velocity, Rotation, Sprite, Collider, NetworkSync,
  Player, Health, Hunger, Thirst, Temperature, Armor, Dead,
  Inventory, Hotbar, WorldItem, ActiveTool,
  Projectile, MeleeHitbox, Damageable,
  Structure, Door, ToolCupboard, SleepingBag,
  ResourceNode, Animal, Campfire, Workbench, Furnace,
];
