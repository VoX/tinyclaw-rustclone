import { createNoise2D } from 'simplex-noise';
import { addEntity, addComponent } from 'bitecs';
import { Position, Collider, Sprite, NetworkSync, ResourceNode, Health, Damageable,
         Animal, Velocity, Rotation, Workbench, Structure, NPC, StorageBox, Recycler, ResearchTable } from '../shared/components.js';
import { WORLD_SIZE, TILE_SIZE, BIOME, RESOURCE_TYPE, RESOURCE_NODE_DEFS,
         ANIMAL_TYPE, ANIMAL_DEFS, AI_STATE, ITEM, STRUCT_TYPE, STRUCT_TIER } from '../shared/constants.js';
import { ENTITY_TYPE } from '../shared/protocol.js';

export function generateWorld(world, gameState, seed = 42) {
  const seedRng = mulberry32(seed);
  const elevNoise = createNoise2D(seedRng);
  const moistNoise = createNoise2D(seedRng);
  const detailNoise = createNoise2D(seedRng);
  const riverNoise = createNoise2D(seedRng);

  // Generate biome map
  const biomeMap = new Uint8Array(WORLD_SIZE * WORLD_SIZE);

  // Pre-compute elevation map for beach blending
  const elevMap = new Float32Array(WORLD_SIZE * WORLD_SIZE);

  for (let y = 0; y < WORLD_SIZE; y++) {
    for (let x = 0; x < WORLD_SIZE; x++) {
      const nx = x / WORLD_SIZE;
      const ny = y / WORLD_SIZE;
      let elev = elevNoise(nx * 4, ny * 4) * 0.5
               + elevNoise(nx * 8, ny * 8) * 0.3
               + detailNoise(nx * 16, ny * 16) * 0.2;
      elev = (elev + 1) / 2;

      // Edge falloff: smooth distance-to-edge factor that pushes elevation down near edges
      const edgeDist = Math.min(x, y, WORLD_SIZE - 1 - x, WORLD_SIZE - 1 - y);
      const edgePct = edgeDist / WORLD_SIZE;
      // Smooth falloff: at edge=0 -> factor=0, at edge=0.1 -> factor~1
      const edgeFactor = Math.min(1, edgePct / 0.1);
      // Apply edge falloff with noise variation for natural coastline
      const coastNoise = detailNoise(nx * 12, ny * 12) * 0.03;
      elev = elev * edgeFactor + coastNoise;
      elev = Math.max(0, Math.min(1, elev));

      elevMap[y * WORLD_SIZE + x] = elev;

      let moist = moistNoise(nx * 3, ny * 3) * 0.6
                + moistNoise(nx * 6, ny * 6) * 0.4;
      moist = (moist + 1) / 2;

      // Beach: low elevation (noise-based, not rectangular)
      let biome;
      if (elev < 0.15) {
        biome = BIOME.BEACH;
      } else if (elev < 0.2) {
        // Transition zone: beach or grassland based on noise
        const beachNoise = detailNoise(nx * 20, ny * 20);
        biome = beachNoise > 0 ? BIOME.BEACH : BIOME.GRASSLAND;
      } else if (elev > 0.7) {
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
      const elev = elevMap[y * WORLD_SIZE + x];
      if (elev < 0.12) continue; // Very low elev is beach, not water inland

      const nx = x / WORLD_SIZE;
      const ny = y / WORLD_SIZE;

      // River: thin winding bands using abs of noise
      const rv = Math.abs(riverNoise(nx * 6, ny * 6));
      if (rv < 0.02 && elev > 0.2) {
        biomeMap[y * WORLD_SIZE + x] = BIOME.WATER;
        continue;
      }

      // Small lakes: low elevation + high moisture pockets
      let moist = moistNoise(nx * 3, ny * 3) * 0.6
                + moistNoise(nx * 6, ny * 6) * 0.4;
      moist = (moist + 1) / 2;

      if (elev < 0.22 && elev > 0.15 && moist > 0.6) {
        biomeMap[y * WORLD_SIZE + x] = BIOME.WATER;
      }
    }
  }

  // ── Generate Roads ──
  // Create 2-3 roads across the map using random waypoints
  const roadCount = 2 + (seedRng() < 0.5 ? 1 : 0);
  const roadTiles = new Set(); // Set of "x,y" strings for road tiles
  const roadWaypoints = []; // Store waypoints for monument placement

  for (let r = 0; r < roadCount; r++) {
    // Generate waypoints across the map
    const wpCount = 3 + Math.floor(seedRng() * 3); // 3-5 waypoints
    const waypoints = [];
    for (let w = 0; w < wpCount; w++) {
      const margin = Math.floor(WORLD_SIZE * 0.1);
      const wpx = margin + Math.floor(seedRng() * (WORLD_SIZE - 2 * margin));
      const wpy = margin + Math.floor(seedRng() * (WORLD_SIZE - 2 * margin));
      waypoints.push([wpx, wpy]);
    }
    roadWaypoints.push(waypoints);

    // Draw road segments between consecutive waypoints
    for (let w = 0; w < waypoints.length - 1; w++) {
      const [x0, y0] = waypoints[w];
      const [x1, y1] = waypoints[w + 1];
      drawRoadLine(biomeMap, roadTiles, x0, y0, x1, y1, seedRng);
    }
  }

  gameState.biomeMap = biomeMap;
  gameState.getBiomeAt = (wx, wy) => {
    const tx = Math.floor(wx / TILE_SIZE);
    const ty = Math.floor(wy / TILE_SIZE);
    if (tx < 0 || tx >= WORLD_SIZE || ty < 0 || ty >= WORLD_SIZE) return BIOME.BEACH;
    return biomeMap[ty * WORLD_SIZE + tx];
  };

  // Scatter resource nodes (skip road tiles)
  const nodeSpacing = 12;
  for (let y = 0; y < WORLD_SIZE; y += nodeSpacing) {
    for (let x = 0; x < WORLD_SIZE; x += nodeSpacing) {
      const biome = biomeMap[y * WORLD_SIZE + x];
      if (biome === BIOME.WATER || biome === BIOME.ROAD) {
        seedRng(); seedRng(); seedRng(); seedRng(); seedRng();
        continue;
      }
      const r = seedRng();

      if (biome === BIOME.FOREST && r < 0.4) {
        spawnResourceNode(world, gameState, x, y, RESOURCE_TYPE.TREE, seedRng);
      } else if (biome === BIOME.GRASSLAND && r < 0.15) {
        spawnResourceNode(world, gameState, x, y, RESOURCE_TYPE.TREE, seedRng);
      } else if (biome === BIOME.SNOW && r < 0.05) {
        spawnResourceNode(world, gameState, x, y, RESOURCE_TYPE.TREE, seedRng);
      }

      const r2 = seedRng();
      if (biome === BIOME.MOUNTAIN && r2 < 0.25) {
        spawnResourceNode(world, gameState, x, y, RESOURCE_TYPE.STONE_NODE, seedRng);
      } else if (biome !== BIOME.BEACH && r2 < 0.08) {
        spawnResourceNode(world, gameState, x, y, RESOURCE_TYPE.STONE_NODE, seedRng);
      }

      const r3 = seedRng();
      if ((biome === BIOME.MOUNTAIN || biome === BIOME.SNOW) && r3 < 0.12) {
        spawnResourceNode(world, gameState, x, y, RESOURCE_TYPE.METAL_NODE, seedRng);
      }

      const r4 = seedRng();
      if ((biome === BIOME.DESERT || biome === BIOME.MOUNTAIN) && r4 < 0.10) {
        spawnResourceNode(world, gameState, x, y, RESOURCE_TYPE.SULFUR_NODE, seedRng);
      }

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

  // ── Spawn barrels along roads ──
  const barrelSpacing = 12;
  let barrelCount = 0;
  for (const key of roadTiles) {
    if (seedRng() > 0.03) continue; // ~3% of road tiles get a barrel
    const [tx, ty] = key.split(',').map(Number);
    // Offset slightly from road center
    const ox = (seedRng() - 0.5) * 4;
    const oy = (seedRng() - 0.5) * 4;
    spawnBarrel(world, gameState, tx + ox, ty + oy, seedRng);
    barrelCount++;
  }

  // ── Spawn monument areas at road waypoint intersections ──
  const monumentPositions = [];
  for (const waypoints of roadWaypoints) {
    // Place monument at middle waypoint(s)
    const midIdx = Math.floor(waypoints.length / 2);
    const [mx, my] = waypoints[midIdx];
    // Check not too close to existing monuments
    let tooClose = false;
    for (const [px, py] of monumentPositions) {
      const dx = mx - px;
      const dy = my - py;
      if (dx * dx + dy * dy < 30 * 30) { tooClose = true; break; }
    }
    if (tooClose) continue;
    monumentPositions.push([mx, my]);
    spawnMonument(world, gameState, biomeMap, mx, my, seedRng);
  }

  // ── Spawn larger monuments (gas station, mining outpost, lighthouse) ──
  const largeMonumentTypes = ['gas_station', 'mining_outpost', 'lighthouse'];
  const largeMonumentPositions = [];
  let lmAttempts = 0;
  while (largeMonumentPositions.length < 3 && lmAttempts < 50) {
    lmAttempts++;
    const margin = Math.floor(WORLD_SIZE * 0.15);
    const mx = margin + Math.floor(seedRng() * (WORLD_SIZE - 2 * margin));
    const my = margin + Math.floor(seedRng() * (WORLD_SIZE - 2 * margin));
    const biome = biomeMap[my * WORLD_SIZE + mx];
    if (biome === BIOME.WATER || biome === BIOME.BEACH) continue;
    // Check not too close to existing monuments or large monuments
    let tooClose = false;
    for (const [px, py] of monumentPositions) {
      if ((mx - px) ** 2 + (my - py) ** 2 < 40 * 40) { tooClose = true; break; }
    }
    for (const pos of largeMonumentPositions) {
      if ((mx - pos.x) ** 2 + (my - pos.y) ** 2 < 50 * 50) { tooClose = true; break; }
    }
    if (tooClose) continue;
    const mType = largeMonumentTypes[largeMonumentPositions.length];
    largeMonumentPositions.push({ x: mx, y: my, type: mType });
    spawnLargeMonument(world, gameState, biomeMap, mx, my, mType, seedRng);
  }

  // ── Connect monuments with roads ──
  // Connect large monuments to nearest road waypoint
  const allMonumentPos = [...monumentPositions.map(([x, y]) => ({ x, y })), ...largeMonumentPositions];
  for (let i = 0; i < allMonumentPos.length; i++) {
    const m = allMonumentPos[i];
    // Find nearest existing road tile
    let nearestRoadDist = Infinity;
    let nearestRoadX = m.x;
    let nearestRoadY = m.y;
    for (const key of roadTiles) {
      const [rx, ry] = key.split(',').map(Number);
      const d = (m.x - rx) ** 2 + (m.y - ry) ** 2;
      if (d < nearestRoadDist) {
        nearestRoadDist = d;
        nearestRoadX = rx;
        nearestRoadY = ry;
      }
    }
    // Draw road from monument to nearest road if not too far
    if (nearestRoadDist < 80 * 80) {
      drawRoadLine(biomeMap, roadTiles, m.x, m.y, nearestRoadX, nearestRoadY, seedRng);
    }
    // Also connect adjacent monuments
    for (let j = i + 1; j < allMonumentPos.length; j++) {
      const m2 = allMonumentPos[j];
      const d = (m.x - m2.x) ** 2 + (m.y - m2.y) ** 2;
      if (d < 100 * 100) { // connect if within 100 tiles
        drawRoadLine(biomeMap, roadTiles, m.x, m.y, m2.x, m2.y, seedRng);
      }
    }
  }

  // ── Forest clearings: open grassy areas within forests ──
  const clearingCount = 5 + Math.floor(seedRng() * 5); // 5-9 clearings
  for (let c = 0; c < clearingCount; c++) {
    const margin = Math.floor(WORLD_SIZE * 0.1);
    const cx = margin + Math.floor(seedRng() * (WORLD_SIZE - 2 * margin));
    const cy = margin + Math.floor(seedRng() * (WORLD_SIZE - 2 * margin));
    const biome = biomeMap[cy * WORLD_SIZE + cx];
    if (biome !== BIOME.FOREST) continue;
    const radius = 3 + Math.floor(seedRng() * 5); // 3-7 tile radius
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const tx = cx + dx;
        const ty = cy + dy;
        if (tx < 0 || tx >= WORLD_SIZE || ty < 0 || ty >= WORLD_SIZE) continue;
        if (biomeMap[ty * WORLD_SIZE + tx] === BIOME.FOREST) {
          biomeMap[ty * WORLD_SIZE + tx] = BIOME.GRASSLAND;
        }
      }
    }
  }

  // ── Spawn radiation zones (1-2) ──
  gameState.radiationZones = [];
  let radAttempts = 0;
  while (gameState.radiationZones.length < 2 && radAttempts < 30) {
    radAttempts++;
    const margin = Math.floor(WORLD_SIZE * 0.2);
    const rx = margin + Math.floor(seedRng() * (WORLD_SIZE - 2 * margin));
    const ry = margin + Math.floor(seedRng() * (WORLD_SIZE - 2 * margin));
    const biome = biomeMap[ry * WORLD_SIZE + rx];
    if (biome === BIOME.WATER || biome === BIOME.BEACH) continue;
    // Not too close to other rad zones or monuments
    let ok = true;
    for (const z of gameState.radiationZones) {
      if ((rx - z.x) ** 2 + (ry - z.y) ** 2 < 60 * 60) { ok = false; break; }
    }
    if (!ok) continue;
    const radRadius = 8 + Math.floor(seedRng() * 5); // 8-12 tile radius
    gameState.radiationZones.push({
      x: rx * TILE_SIZE,
      y: ry * TILE_SIZE,
      radius: radRadius * TILE_SIZE,
    });
    // Spawn high-value loot crates inside radiation zone
    for (let c = 0; c < 3; c++) {
      const angle = seedRng() * Math.PI * 2;
      const dist = seedRng() * radRadius * 0.6;
      const cx = rx + Math.cos(angle) * dist;
      const cy = ry + Math.sin(angle) * dist;
      spawnLootCrate(world, gameState, cx, cy, seedRng);
    }
  }

  console.log(`World generated: ${WORLD_SIZE}x${WORLD_SIZE} tiles, ${gameState.entityTypes.size} entities, ${gameState.radiationZones.length} rad zones, ${largeMonumentPositions.length} monuments`);
}

// Draw a road line between two points, 2-3 tiles wide, with slight wandering
function drawRoadLine(biomeMap, roadTiles, x0, y0, x1, y1, rng) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.ceil(dist);
  const width = 2; // road half-width in tiles

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Add slight perpendicular wander for natural look
    const wander = Math.sin(t * Math.PI * 3 + rng() * 0.5) * 1.5;
    const px = Math.round(x0 + dx * t + (-dy / dist) * wander);
    const py = Math.round(y0 + dy * t + (dx / dist) * wander);

    // Paint road tiles in a width around the center
    for (let ry = -width; ry <= width; ry++) {
      for (let rx = -width; rx <= width; rx++) {
        const tx = px + rx;
        const ty = py + ry;
        if (tx < 1 || tx >= WORLD_SIZE - 1 || ty < 1 || ty >= WORLD_SIZE - 1) continue;
        const current = biomeMap[ty * WORLD_SIZE + tx];
        // Don't overwrite water or beach
        if (current === BIOME.WATER || current === BIOME.BEACH) continue;
        biomeMap[ty * WORLD_SIZE + tx] = BIOME.ROAD;
        roadTiles.add(tx + ',' + ty);
      }
    }
  }
}

// Spawn a monument: 3x3 cleared zone with workbench, barrels, stone walls
function spawnMonument(world, gameState, biomeMap, tileX, tileY, rng) {
  const cx = tileX * TILE_SIZE;
  const cy = tileY * TILE_SIZE;

  // Clear a small area around the monument to ROAD
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const tx = tileX + dx;
      const ty = tileY + dy;
      if (tx >= 0 && tx < WORLD_SIZE && ty >= 0 && ty < WORLD_SIZE) {
        const current = biomeMap[ty * WORLD_SIZE + tx];
        if (current !== BIOME.WATER) {
          biomeMap[ty * WORLD_SIZE + tx] = BIOME.ROAD;
        }
      }
    }
  }

  // Place T1 workbench at center
  const wbEid = addEntity(world);
  addComponent(world, wbEid, Position);
  addComponent(world, wbEid, Collider);
  addComponent(world, wbEid, Sprite);
  addComponent(world, wbEid, NetworkSync);
  addComponent(world, wbEid, Workbench);
  Position.x[wbEid] = cx;
  Position.y[wbEid] = cy;
  Workbench.tier[wbEid] = 1;
  Collider.radius[wbEid] = 0.6;
  Sprite.spriteId[wbEid] = 221;
  NetworkSync.lastTick[wbEid] = 0;
  gameState.entityTypes.set(wbEid, ENTITY_TYPE.WORKBENCH);

  // Place recycler and research table near workbench
  spawnRecycler(world, gameState, tileX - 2, tileY);
  spawnResearchTable(world, gameState, tileX + 2, tileY);

  // Place a few barrels around the workbench
  const barrelOffsets = [[-2, -2], [2, -2], [-2, 2], [2, 2]];
  for (const [bx, by] of barrelOffsets) {
    if (rng() > 0.7) continue; // Skip some for variety
    spawnBarrel(world, gameState, tileX + bx, tileY + by, rng);
  }

  // Place stone wall segments as monument perimeter (north and south)
  const wallOffsets = [[-3, 0], [3, 0]];
  for (const [wx, wy] of wallOffsets) {
    const wallEid = addEntity(world);
    addComponent(world, wallEid, Position);
    addComponent(world, wallEid, Collider);
    addComponent(world, wallEid, Sprite);
    addComponent(world, wallEid, NetworkSync);
    addComponent(world, wallEid, Structure);
    addComponent(world, wallEid, Health);

    Position.x[wallEid] = cx + wx * TILE_SIZE;
    Position.y[wallEid] = cy + wy * TILE_SIZE;
    Structure.structureType[wallEid] = STRUCT_TYPE.WALL;
    Structure.tier[wallEid] = STRUCT_TIER.STONE;
    Structure.hp[wallEid] = 500;
    Structure.maxHp[wallEid] = 500;
    Structure.placedBy[wallEid] = 0;
    Health.current[wallEid] = 500;
    Health.max[wallEid] = 500;
    Collider.radius[wallEid] = 2.0;
    Collider.isStatic[wallEid] = 1;
    Sprite.spriteId[wallEid] = 202;
    NetworkSync.lastTick[wallEid] = 0;
    gameState.entityTypes.set(wallEid, ENTITY_TYPE.STRUCTURE);
  }
}

function spawnBarrel(world, gameState, tileX, tileY, rng) {
  const eid = addEntity(world);
  addComponent(world, eid, Position);
  addComponent(world, eid, Collider);
  addComponent(world, eid, Sprite);
  addComponent(world, eid, NetworkSync);
  addComponent(world, eid, Health);
  addComponent(world, eid, Damageable);

  Position.x[eid] = tileX * TILE_SIZE;
  Position.y[eid] = tileY * TILE_SIZE;
  Health.current[eid] = 20 + Math.floor(rng() * 10); // 20-30 HP
  Health.max[eid] = Health.current[eid];
  Collider.radius[eid] = 0.4;
  Collider.isStatic[eid] = 1;
  Sprite.spriteId[eid] = 240; // barrel sprite id
  NetworkSync.lastTick[eid] = 0;

  gameState.entityTypes.set(eid, ENTITY_TYPE.BARREL);

  // Store loot table on gameState for barrel drops
  if (!gameState.barrelLoot) gameState.barrelLoot = new Map();
  const loot = generateBarrelLoot(rng);
  gameState.barrelLoot.set(eid, loot);
}

function generateBarrelLoot(rng) {
  const loot = [];
  const r = rng();
  // Always drop some scrap
  loot.push([ITEM.SCRAP, 5 + Math.floor(rng() * 10)]);
  // Random additional drops
  if (r < 0.3) {
    loot.push([ITEM.WOOD, 20 + Math.floor(rng() * 30)]);
  } else if (r < 0.5) {
    loot.push([ITEM.STONE, 15 + Math.floor(rng() * 25)]);
  } else if (r < 0.7) {
    loot.push([ITEM.METAL_FRAGS, 5 + Math.floor(rng() * 15)]);
  } else if (r < 0.85) {
    loot.push([ITEM.CLOTH, 10 + Math.floor(rng() * 15)]);
  } else {
    // Rare: more scrap
    loot.push([ITEM.SCRAP, 10 + Math.floor(rng() * 15)]);
  }
  return loot;
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

  Collider.radius[eid] = resourceType === RESOURCE_TYPE.TREE ? 1.5 : (resourceType === RESOURCE_TYPE.HEMP ? 0.4 : 1.0);
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
  Animal.aiState[eid] = AI_STATE.WANDER;
  Animal.aggroRange[eid] = def.aggroRange;
  Animal.homeX[eid] = Position.x[eid];
  Animal.homeY[eid] = Position.y[eid];
  Animal.wanderAngle[eid] = rng() * Math.PI * 2;
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

// Spawn NPC merchant at a world position
function spawnNPCMerchant(world, gameState, tileX, tileY) {
  const eid = addEntity(world);
  addComponent(world, eid, Position);
  addComponent(world, eid, Collider);
  addComponent(world, eid, Sprite);
  addComponent(world, eid, NetworkSync);
  addComponent(world, eid, Health);
  addComponent(world, eid, NPC);

  Position.x[eid] = tileX * TILE_SIZE;
  Position.y[eid] = tileY * TILE_SIZE;
  NPC.npcType[eid] = 1; // merchant
  Health.current[eid] = 9999;
  Health.max[eid] = 9999;
  Collider.radius[eid] = 0.5;
  Collider.isStatic[eid] = 1;
  Sprite.spriteId[eid] = 250; // NPC merchant sprite
  NetworkSync.lastTick[eid] = 0;

  gameState.entityTypes.set(eid, ENTITY_TYPE.NPC);
}

// Spawn a loot crate with high-value items (for rad zones)
function spawnLootCrate(world, gameState, tileX, tileY, rng) {
  const eid = addEntity(world);
  addComponent(world, eid, Position);
  addComponent(world, eid, Collider);
  addComponent(world, eid, Sprite);
  addComponent(world, eid, NetworkSync);
  addComponent(world, eid, Health);
  addComponent(world, eid, Damageable);
  addComponent(world, eid, StorageBox);

  Position.x[eid] = tileX * TILE_SIZE;
  Position.y[eid] = tileY * TILE_SIZE;
  Health.current[eid] = 50;
  Health.max[eid] = 50;
  Collider.radius[eid] = 0.5;
  Collider.isStatic[eid] = 1;
  Sprite.spriteId[eid] = 245; // loot crate sprite
  NetworkSync.lastTick[eid] = 0;

  gameState.entityTypes.set(eid, ENTITY_TYPE.LOOT_CRATE);

  // Generate high-value loot
  if (!gameState.containerInv) gameState.containerInv = new Map();
  const loot = [];
  loot.push({ id: ITEM.SCRAP, n: 20 + Math.floor(rng() * 30) });
  const r = rng();
  if (r < 0.25) {
    loot.push({ id: ITEM.METAL_FRAGS, n: 30 + Math.floor(rng() * 40) });
  } else if (r < 0.45) {
    loot.push({ id: ITEM.METAL_PIPE, n: 1 });
  } else if (r < 0.60) {
    loot.push({ id: ITEM.SPRING, n: 1 });
  } else if (r < 0.75) {
    loot.push({ id: ITEM.GUNPOWDER, n: 15 + Math.floor(rng() * 20) });
  } else if (r < 0.90) {
    loot.push({ id: ITEM.RIFLE_AMMO, n: 10 + Math.floor(rng() * 20) });
  } else {
    loot.push({ id: ITEM.ROPE, n: 2 + Math.floor(rng() * 3) });
  }
  while (loot.length < 12) loot.push({ id: 0, n: 0 });
  gameState.containerInv.set(eid, loot.slice(0, 12));
}

// Spawn large monument types
function spawnLargeMonument(world, gameState, biomeMap, tileX, tileY, type, rng) {
  const cx = tileX * TILE_SIZE;
  const cy = tileY * TILE_SIZE;

  // Clear area to ROAD
  const clearRadius = type === 'lighthouse' ? 4 : 5;
  for (let dy = -clearRadius; dy <= clearRadius; dy++) {
    for (let dx = -clearRadius; dx <= clearRadius; dx++) {
      const tx = tileX + dx;
      const ty = tileY + dy;
      if (tx >= 0 && tx < WORLD_SIZE && ty >= 0 && ty < WORLD_SIZE) {
        if (biomeMap[ty * WORLD_SIZE + tx] !== BIOME.WATER) {
          biomeMap[ty * WORLD_SIZE + tx] = BIOME.ROAD;
        }
      }
    }
  }

  if (type === 'gas_station') {
    // Stone walls forming a small building
    const wallPositions = [[-3, -3], [3, -3], [-3, 3], [3, 3]];
    for (const [wx, wy] of wallPositions) {
      spawnMonumentWall(world, gameState, cx + wx * TILE_SIZE, cy + wy * TILE_SIZE);
    }
    // Barrels inside
    for (let i = 0; i < 4; i++) {
      const bx = tileX + (rng() - 0.5) * 4;
      const by = tileY + (rng() - 0.5) * 4;
      spawnBarrel(world, gameState, bx, by, rng);
    }
    // Storage box with random loot
    spawnLootCrate(world, gameState, tileX, tileY, rng);
    // NPC merchant
    spawnNPCMerchant(world, gameState, tileX + 2, tileY);
    // Recycler
    spawnRecycler(world, gameState, tileX - 2, tileY - 2);
  } else if (type === 'mining_outpost') {
    // Dense ore nodes around outpost
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const dist = 2 + rng() * 3;
      const nx = tileX + Math.cos(angle) * dist;
      const ny = tileY + Math.sin(angle) * dist;
      const oreType = rng() < 0.5 ? RESOURCE_TYPE.METAL_NODE : RESOURCE_TYPE.STONE_NODE;
      spawnResourceNode(world, gameState, nx, ny, oreType, rng);
    }
    // Some crates
    for (let i = 0; i < 2; i++) {
      const ox = tileX + (rng() - 0.5) * 3;
      const oy = tileY + (rng() - 0.5) * 3;
      spawnLootCrate(world, gameState, ox, oy, rng);
    }
    // T1 workbench
    const wbEid = addEntity(world);
    addComponent(world, wbEid, Position);
    addComponent(world, wbEid, Collider);
    addComponent(world, wbEid, Sprite);
    addComponent(world, wbEid, NetworkSync);
    addComponent(world, wbEid, Workbench);
    Position.x[wbEid] = cx;
    Position.y[wbEid] = cy;
    Workbench.tier[wbEid] = 1;
    Collider.radius[wbEid] = 0.6;
    Sprite.spriteId[wbEid] = 221;
    NetworkSync.lastTick[wbEid] = 0;
    gameState.entityTypes.set(wbEid, ENTITY_TYPE.WORKBENCH);
    // NPC merchant
    spawnNPCMerchant(world, gameState, tileX - 2, tileY);
    // Research table
    spawnResearchTable(world, gameState, tileX + 2, tileY);
  } else if (type === 'lighthouse') {
    // Tall structure walls (tighter)
    const wallPositions = [[-2, -2], [2, -2], [-2, 2], [2, 2], [0, -2], [0, 2]];
    for (const [wx, wy] of wallPositions) {
      spawnMonumentWall(world, gameState, cx + wx * TILE_SIZE, cy + wy * TILE_SIZE);
    }
    // Small loot inside
    spawnLootCrate(world, gameState, tileX, tileY, rng);
    // Some barrels
    spawnBarrel(world, gameState, tileX + 1, tileY + 1, rng);
    spawnBarrel(world, gameState, tileX - 1, tileY + 1, rng);
  }
}

function spawnMonumentWall(world, gameState, wx, wy) {
  const wallEid = addEntity(world);
  addComponent(world, wallEid, Position);
  addComponent(world, wallEid, Collider);
  addComponent(world, wallEid, Sprite);
  addComponent(world, wallEid, NetworkSync);
  addComponent(world, wallEid, Structure);
  addComponent(world, wallEid, Health);

  Position.x[wallEid] = wx;
  Position.y[wallEid] = wy;
  Structure.structureType[wallEid] = STRUCT_TYPE.WALL;
  Structure.tier[wallEid] = STRUCT_TIER.STONE;
  Structure.hp[wallEid] = 500;
  Structure.maxHp[wallEid] = 500;
  Structure.placedBy[wallEid] = 0;
  Health.current[wallEid] = 500;
  Health.max[wallEid] = 500;
  Collider.radius[wallEid] = 2.0;
  Collider.isStatic[wallEid] = 1;
  Sprite.spriteId[wallEid] = 202;
  NetworkSync.lastTick[wallEid] = 0;
  gameState.entityTypes.set(wallEid, ENTITY_TYPE.STRUCTURE);
}

// Spawn recycler at a world position (tile coords)
function spawnRecycler(world, gameState, tileX, tileY) {
  const eid = addEntity(world);
  addComponent(world, eid, Position);
  addComponent(world, eid, Collider);
  addComponent(world, eid, Sprite);
  addComponent(world, eid, NetworkSync);
  addComponent(world, eid, Health);
  addComponent(world, eid, Recycler);

  Position.x[eid] = tileX * TILE_SIZE;
  Position.y[eid] = tileY * TILE_SIZE;
  Health.current[eid] = 9999;
  Health.max[eid] = 9999;
  Collider.radius[eid] = 0.6;
  Collider.isStatic[eid] = 1;
  Sprite.spriteId[eid] = 255; // recycler sprite
  NetworkSync.lastTick[eid] = 0;

  gameState.entityTypes.set(eid, ENTITY_TYPE.RECYCLER);
}

// Spawn research table at a world position (tile coords)
function spawnResearchTable(world, gameState, tileX, tileY) {
  const eid = addEntity(world);
  addComponent(world, eid, Position);
  addComponent(world, eid, Collider);
  addComponent(world, eid, Sprite);
  addComponent(world, eid, NetworkSync);
  addComponent(world, eid, Health);
  addComponent(world, eid, ResearchTable);

  Position.x[eid] = tileX * TILE_SIZE;
  Position.y[eid] = tileY * TILE_SIZE;
  Health.current[eid] = 9999;
  Health.max[eid] = 9999;
  Collider.radius[eid] = 0.6;
  Collider.isStatic[eid] = 1;
  Sprite.spriteId[eid] = 256; // research table sprite
  NetworkSync.lastTick[eid] = 0;

  gameState.entityTypes.set(eid, ENTITY_TYPE.RESEARCH_TABLE);
}

// Export biome map as compressed data for client
export function serializeBiomeMap(biomeMap) {
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
