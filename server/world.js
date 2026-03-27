import { createNoise2D } from 'simplex-noise';
import { addEntity, addComponent } from 'bitecs';
import { Position, Collider, Sprite, NetworkSync, ResourceNode, Health, Damageable,
         Animal, Velocity, Rotation } from '../shared/components.js';
import { WORLD_SIZE, TILE_SIZE, BIOME, RESOURCE_TYPE, RESOURCE_NODE_DEFS,
         ANIMAL_TYPE, ANIMAL_DEFS, AI_STATE } from '../shared/constants.js';
import { ENTITY_TYPE } from '../shared/protocol.js';

export function generateWorld(world, gameState, seed = 42) {
  // Create seeded random
  const seedRng = mulberry32(seed);
  const elevNoise = createNoise2D(seedRng);
  const moistNoise = createNoise2D(seedRng);
  const detailNoise = createNoise2D(seedRng);
  const riverNoise = createNoise2D(seedRng);

  // Generate biome map
  const biomeMap = new Uint8Array(WORLD_SIZE * WORLD_SIZE);
  const maxCoord = WORLD_SIZE;

  for (let y = 0; y < WORLD_SIZE; y++) {
    for (let x = 0; x < WORLD_SIZE; x++) {
      // Beach ring: outer 5%
      const edgeDist = Math.min(x, y, WORLD_SIZE - 1 - x, WORLD_SIZE - 1 - y);
      const edgePct = edgeDist / WORLD_SIZE;

      if (edgePct < 0.05) {
        biomeMap[y * WORLD_SIZE + x] = BIOME.BEACH;
        continue;
      }

      // Multi-octave noise for elevation
      const nx = x / WORLD_SIZE;
      const ny = y / WORLD_SIZE;
      let elev = elevNoise(nx * 4, ny * 4) * 0.5
               + elevNoise(nx * 8, ny * 8) * 0.3
               + detailNoise(nx * 16, ny * 16) * 0.2;

      let moist = moistNoise(nx * 3, ny * 3) * 0.6
                + moistNoise(nx * 6, ny * 6) * 0.4;

      // Normalize to 0-1
      elev = (elev + 1) / 2;
      moist = (moist + 1) / 2;

      let biome;
      if (elev > 0.7) {
        biome = BIOME.MOUNTAIN;
      } else if (elev > 0.55) {
        biome = moist > 0.5 ? BIOME.SNOW : BIOME.MOUNTAIN;
      } else if (elev < 0.3) {
        biome = moist < 0.35 ? BIOME.DESERT : BIOME.GRASSLAND;
      } else {
        biome = moist > 0.55 ? BIOME.FOREST : BIOME.GRASSLAND;
      }

      biomeMap[y * WORLD_SIZE + x] = biome;
    }
  }

  // Add water: rivers and small lakes using river noise
  for (let y = 0; y < WORLD_SIZE; y++) {
    for (let x = 0; x < WORLD_SIZE; x++) {
      const edgeDist = Math.min(x, y, WORLD_SIZE - 1 - x, WORLD_SIZE - 1 - y);
      const edgePct = edgeDist / WORLD_SIZE;
      if (edgePct < 0.06) continue; // No water on beach ring

      const nx = x / WORLD_SIZE;
      const ny = y / WORLD_SIZE;

      // River: thin winding bands using abs of noise
      const rv = Math.abs(riverNoise(nx * 6, ny * 6));
      if (rv < 0.02) {
        biomeMap[y * WORLD_SIZE + x] = BIOME.WATER;
        continue;
      }

      // Small lakes: low elevation + high moisture pockets
      let elev = elevNoise(nx * 4, ny * 4) * 0.5
               + elevNoise(nx * 8, ny * 8) * 0.3
               + detailNoise(nx * 16, ny * 16) * 0.2;
      elev = (elev + 1) / 2;
      let moist = moistNoise(nx * 3, ny * 3) * 0.6
                + moistNoise(nx * 6, ny * 6) * 0.4;
      moist = (moist + 1) / 2;

      if (elev < 0.22 && moist > 0.6) {
        biomeMap[y * WORLD_SIZE + x] = BIOME.WATER;
      }
    }
  }

  gameState.biomeMap = biomeMap;
  gameState.getBiomeAt = (wx, wy) => {
    const tx = Math.floor(wx / TILE_SIZE);
    const ty = Math.floor(wy / TILE_SIZE);
    if (tx < 0 || tx >= WORLD_SIZE || ty < 0 || ty >= WORLD_SIZE) return BIOME.BEACH;
    return biomeMap[ty * WORLD_SIZE + tx];
  };

  // Scatter resource nodes
  const nodeSpacing = 8; // tiles between checks
  for (let y = 0; y < WORLD_SIZE; y += nodeSpacing) {
    for (let x = 0; x < WORLD_SIZE; x += nodeSpacing) {
      const biome = biomeMap[y * WORLD_SIZE + x];
      if (biome === BIOME.WATER) { seedRng(); seedRng(); seedRng(); seedRng(); seedRng(); continue; } // skip water, consume rngs to keep determinism
      const r = seedRng();

      // Tree placement
      if (biome === BIOME.FOREST && r < 0.4) {
        spawnResourceNode(world, gameState, x, y, RESOURCE_TYPE.TREE, seedRng);
      } else if (biome === BIOME.GRASSLAND && r < 0.15) {
        spawnResourceNode(world, gameState, x, y, RESOURCE_TYPE.TREE, seedRng);
      } else if (biome === BIOME.SNOW && r < 0.05) {
        spawnResourceNode(world, gameState, x, y, RESOURCE_TYPE.TREE, seedRng);
      }

      // Stone nodes
      const r2 = seedRng();
      if (biome === BIOME.MOUNTAIN && r2 < 0.25) {
        spawnResourceNode(world, gameState, x, y, RESOURCE_TYPE.STONE_NODE, seedRng);
      } else if (biome !== BIOME.BEACH && r2 < 0.08) {
        spawnResourceNode(world, gameState, x, y, RESOURCE_TYPE.STONE_NODE, seedRng);
      }

      // Metal nodes
      const r3 = seedRng();
      if ((biome === BIOME.MOUNTAIN || biome === BIOME.SNOW) && r3 < 0.12) {
        spawnResourceNode(world, gameState, x, y, RESOURCE_TYPE.METAL_NODE, seedRng);
      }

      // Sulfur nodes
      const r4 = seedRng();
      if ((biome === BIOME.DESERT || biome === BIOME.MOUNTAIN) && r4 < 0.10) {
        spawnResourceNode(world, gameState, x, y, RESOURCE_TYPE.SULFUR_NODE, seedRng);
      }

      // Hemp
      const r5 = seedRng();
      if ((biome === BIOME.GRASSLAND || biome === BIOME.FOREST) && r5 < 0.10) {
        spawnResourceNode(world, gameState, x, y, RESOURCE_TYPE.HEMP, seedRng);
      }
    }
  }

  // Spawn animals
  const animalSpacing = 30;
  for (let y = 0; y < WORLD_SIZE; y += animalSpacing) {
    for (let x = 0; x < WORLD_SIZE; x += animalSpacing) {
      const biome = biomeMap[y * WORLD_SIZE + x];
      if (biome === BIOME.WATER) { seedRng(); continue; }
      const r = seedRng();

      if (biome === BIOME.FOREST) {
        if (r < 0.3) spawnAnimal(world, gameState, x, y, ANIMAL_TYPE.DEER, seedRng);
        else if (r < 0.5) spawnAnimal(world, gameState, x, y, ANIMAL_TYPE.BOAR, seedRng);
      } else if (biome === BIOME.GRASSLAND) {
        if (r < 0.2) spawnAnimal(world, gameState, x, y, ANIMAL_TYPE.DEER, seedRng);
      } else if (biome === BIOME.SNOW) {
        if (r < 0.2) spawnAnimal(world, gameState, x, y, ANIMAL_TYPE.WOLF, seedRng);
        else if (r < 0.3) spawnAnimal(world, gameState, x, y, ANIMAL_TYPE.BEAR, seedRng);
      }
    }
  }

  console.log(`World generated: ${WORLD_SIZE}x${WORLD_SIZE} tiles, ${gameState.entityTypes.size} entities`);
}

function spawnResourceNode(world, gameState, tileX, tileY, resourceType, rng) {
  const eid = addEntity(world);
  addComponent(world, eid, Position);
  addComponent(world, eid, ResourceNode);
  addComponent(world, eid, Collider);
  addComponent(world, eid, Sprite);
  addComponent(world, eid, NetworkSync);
  addComponent(world, eid, Health);
  addComponent(world, eid, Damageable);

  const def = RESOURCE_NODE_DEFS[resourceType];
  const offsetX = (rng() - 0.5) * 6;
  const offsetY = (rng() - 0.5) * 6;

  Position.x[eid] = (tileX + offsetX) * TILE_SIZE;
  Position.y[eid] = (tileY + offsetY) * TILE_SIZE;
  ResourceNode.resourceType[eid] = resourceType;
  ResourceNode.remaining[eid] = def.amount;
  ResourceNode.maxAmount[eid] = def.amount;
  ResourceNode.respawnTimer[eid] = 0;
  Health.current[eid] = def.hp;
  Health.max[eid] = def.hp;

  Collider.radius[eid] = resourceType === RESOURCE_TYPE.TREE ? 0.6 : 0.4;
  Collider.isStatic[eid] = 1;
  Sprite.spriteId[eid] = 50 + resourceType;
  NetworkSync.lastTick[eid] = 0;

  gameState.entityTypes.set(eid, ENTITY_TYPE.RESOURCE_NODE);
}

function spawnAnimal(world, gameState, tileX, tileY, animalType, rng) {
  const eid = addEntity(world);
  addComponent(world, eid, Position);
  addComponent(world, eid, Velocity);
  addComponent(world, eid, Rotation);
  addComponent(world, eid, Animal);
  addComponent(world, eid, Health);
  addComponent(world, eid, Collider);
  addComponent(world, eid, Sprite);
  addComponent(world, eid, NetworkSync);
  addComponent(world, eid, Damageable);

  const def = ANIMAL_DEFS[animalType];
  Position.x[eid] = (tileX + rng() * 10) * TILE_SIZE;
  Position.y[eid] = (tileY + rng() * 10) * TILE_SIZE;
  Velocity.vx[eid] = 0;
  Velocity.vy[eid] = 0;
  Animal.animalType[eid] = animalType;
  Animal.aiState[eid] = AI_STATE.IDLE;
  Animal.aggroRange[eid] = def.aggroRange;
  Health.current[eid] = def.hp;
  Health.max[eid] = def.hp;
  Collider.radius[eid] = 0.5;
  Sprite.spriteId[eid] = 60 + animalType;
  NetworkSync.lastTick[eid] = 0;

  gameState.entityTypes.set(eid, ENTITY_TYPE.ANIMAL);
}

// Mulberry32 PRNG
function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Export biome map as compressed data for client
export function serializeBiomeMap(biomeMap) {
  // RLE encode the biome map for transmission
  const runs = [];
  let currentBiome = biomeMap[0];
  let count = 1;
  for (let i = 1; i < biomeMap.length; i++) {
    if (biomeMap[i] === currentBiome && count < 65535) {
      count++;
    } else {
      runs.push(currentBiome, count);
      currentBiome = biomeMap[i];
      count = 1;
    }
  }
  runs.push(currentBiome, count);
  return runs;
}
