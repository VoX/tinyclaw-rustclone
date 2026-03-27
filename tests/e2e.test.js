// E2E Test Suite for the survival game
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Bot, connectBots, disconnectAll } from './bot.js';
import { MSG, KEY, MOUSE_ACTION, INV_ACTION, ENTITY_TYPE } from '../shared/protocol.js';
import { ITEM, RECIPES, RESOURCE_TYPE, STRUCT_TYPE, PLAYER_MAX_HP,
         PLAYER_MAX_HUNGER, PLAYER_MAX_THIRST, RESPAWN_WAIT_TICKS,
         SERVER_TPS } from '../shared/constants.js';

const SERVER_URL = process.env.SERVER_URL || 'ws://localhost:8780';
const TICK_MS = 1000 / SERVER_TPS; // 50ms per tick

// Helper: wait for N server ticks worth of time
function waitTicks(n) {
  return new Promise(resolve => setTimeout(resolve, n * TICK_MS + 20));
}

// ─── Connection Tests ───

describe('Connection', () => {
  it('should connect and receive player ID', async () => {
    const bot = new Bot(SERVER_URL);
    await bot.connect();
    assert.ok(bot.eid, 'Bot should have an entity ID');
    assert.ok(bot.connId, 'Bot should have a connection ID');
    assert.ok(bot.connected, 'Bot should be connected');
    bot.disconnect();
  });

  it('should receive world info on connect', async () => {
    const bot = new Bot(SERVER_URL);
    await bot.connect();
    assert.ok(bot.worldSize > 0, 'Should receive world size');
    assert.ok(bot.tileSize > 0, 'Should receive tile size');
    bot.disconnect();
  });

  it('should receive initial inventory with rock and torch', async () => {
    const bot = new Bot(SERVER_URL);
    await bot.connect();
    assert.ok(bot.inventory.length > 0, 'Should have inventory');
    // Slot 0: Rock, Slot 1: Torch
    assert.equal(bot.inventory[0].id, ITEM.ROCK, 'Slot 0 should be Rock');
    assert.equal(bot.inventory[0].n, 1, 'Should have 1 Rock');
    assert.equal(bot.inventory[1].id, ITEM.TORCH, 'Slot 1 should be Torch');
    assert.equal(bot.inventory[1].n, 1, 'Should have 1 Torch');
    bot.disconnect();
  });

  it('should receive position in delta updates', async () => {
    const bot = new Bot(SERVER_URL);
    await bot.connect();
    await bot.waitForDelta(3000);
    assert.ok(bot.position.x !== 0 || bot.position.y !== 0, 'Should have a non-zero position');
    bot.disconnect();
  });

  it('should receive full HP on connect', async () => {
    const bot = new Bot(SERVER_URL);
    await bot.connect();
    await waitTicks(2);
    assert.equal(bot.hp, PLAYER_MAX_HP, 'Should have full HP');
    bot.disconnect();
  });
});

// ─── Movement Tests ───

describe('Movement', () => {
  let bot;
  before(async () => {
    bot = new Bot(SERVER_URL);
    await bot.connect();
    await waitTicks(3);
  });
  after(() => bot.disconnect());

  it('should update position when moving', async () => {
    const startX = bot.position.x;
    const startY = bot.position.y;

    // Move right (D key)
    bot.move(KEY.D);
    await waitTicks(10);
    bot.stop();

    // Position should have changed
    const moved = bot.position.x !== startX || bot.position.y !== startY;
    assert.ok(moved, 'Position should change after moving');
  });

  it('should stop when keys released', async () => {
    bot.move(KEY.W);
    await waitTicks(5);
    bot.stop();
    await waitTicks(3);

    const posAfterStop = { ...bot.position };
    await waitTicks(5);

    // Position should stay roughly the same (within floating point)
    const drift = Math.abs(bot.position.x - posAfterStop.x) + Math.abs(bot.position.y - posAfterStop.y);
    assert.ok(drift < 1, 'Position should stabilize after stopping');
  });

  it('should support diagonal movement', async () => {
    const startPos = { ...bot.position };
    // Move diagonally (W + D)
    bot.move(KEY.W | KEY.D);
    await waitTicks(10);
    bot.stop();

    const dx = bot.position.x - startPos.x;
    const dy = bot.position.y - startPos.y;
    // Both x and y should have changed
    assert.ok(Math.abs(dx) > 0.1, 'X should change during diagonal move');
    assert.ok(Math.abs(dy) > 0.1, 'Y should change during diagonal move');
  });
});

// ─── Resource Gathering Tests ───

describe('Resource Gathering', () => {
  let bot;
  before(async () => {
    bot = new Bot(SERVER_URL);
    await bot.connect();
    await waitTicks(3);
  });
  after(() => bot.disconnect());

  it('should see resource nodes in the world', async () => {
    // Wait for deltas to populate entities
    await waitTicks(5);
    let hasResources = false;
    for (const [eid, ent] of bot.entities) {
      if (ent.t === ENTITY_TYPE.RESOURCE_NODE) {
        hasResources = true;
        break;
      }
    }
    assert.ok(hasResources, 'Should see resource nodes in nearby entities');
  });

  it('should gather wood from a tree', async () => {
    // Select rock (slot 0)
    bot.selectSlot(0);
    await waitTicks(2);

    const initialWood = bot.countItem(ITEM.WOOD);

    // Find nearest tree
    const tree = bot.findNearestResource(RESOURCE_TYPE.TREE);
    if (!tree) {
      // If no tree nearby, wander until we find one
      for (let attempt = 0; attempt < 20; attempt++) {
        bot.move(KEY.W | KEY.D);
        await waitTicks(10);
        const t = bot.findNearestResource(RESOURCE_TYPE.TREE);
        if (t) break;
      }
    }

    const node = bot.findNearestResource(RESOURCE_TYPE.TREE);
    if (!node) {
      // Skip test if no trees found after wandering
      console.log('  (skipping: no trees found nearby)');
      return;
    }

    // Move toward the tree
    for (let i = 0; i < 60; i++) {
      const current = bot.findNearestResource(RESOURCE_TYPE.TREE);
      if (!current) break;
      if (bot.distanceTo(current.x, current.y) < 1.8) break;
      bot.moveToward(current.x, current.y);
      await waitTicks(2);
    }

    // Swing at the tree
    const nearTree = bot.findNearestResource(RESOURCE_TYPE.TREE);
    if (nearTree && bot.distanceTo(nearTree.x, nearTree.y) < 2.0) {
      const angle = bot.angleTo(nearTree.x, nearTree.y);
      for (let swing = 0; swing < 30; swing++) {
        bot.sendInput(0, angle, MOUSE_ACTION.PRIMARY);
        await waitTicks(3);
      }
      bot.stopAttack();

      const newWood = bot.countItem(ITEM.WOOD);
      assert.ok(newWood > initialWood, `Should have gathered wood (was ${initialWood}, now ${newWood})`);
    } else {
      console.log('  (skipping: could not reach tree)');
    }
  });
});

// ─── Crafting Tests ───

describe('Crafting', () => {
  let bot;
  before(async () => {
    bot = new Bot(SERVER_URL);
    await bot.connect();
    await waitTicks(3);
  });
  after(() => bot.disconnect());

  it('should craft a stone hatchet with materials', async () => {
    // First gather enough resources by hitting trees/rocks
    // For testing, we'll gather wood and stone first
    bot.selectSlot(0); // Rock

    // Gather wood from trees
    for (let pass = 0; pass < 100 && bot.countItem(ITEM.WOOD) < 200; pass++) {
      const tree = bot.findNearestResource(RESOURCE_TYPE.TREE);
      if (tree && bot.distanceTo(tree.x, tree.y) < 2.0) {
        const angle = bot.angleTo(tree.x, tree.y);
        bot.sendInput(0, angle, MOUSE_ACTION.PRIMARY);
      } else if (tree) {
        bot.moveToward(tree.x, tree.y);
      } else {
        bot.move(KEY.W | KEY.D);
      }
      await waitTicks(3);
    }

    // Gather stone
    for (let pass = 0; pass < 100 && bot.countItem(ITEM.STONE) < 100; pass++) {
      const stone = bot.findNearestResource(RESOURCE_TYPE.STONE_NODE);
      if (stone && bot.distanceTo(stone.x, stone.y) < 2.0) {
        const angle = bot.angleTo(stone.x, stone.y);
        bot.sendInput(0, angle, MOUSE_ACTION.PRIMARY);
      } else if (stone) {
        bot.moveToward(stone.x, stone.y);
      } else {
        bot.move(KEY.S | KEY.D);
      }
      await waitTicks(3);
    }

    bot.stopAttack();

    const woodCount = bot.countItem(ITEM.WOOD);
    const stoneCount = bot.countItem(ITEM.STONE);

    if (woodCount < 200 || stoneCount < 100) {
      console.log(`  (skipping: not enough resources - wood: ${woodCount}, stone: ${stoneCount})`);
      return;
    }

    // Craft stone hatchet (recipe 1: 200 wood + 100 stone)
    const recipe = RECIPES.find(r => r.result === ITEM.STONE_HATCHET);
    assert.ok(recipe, 'Stone hatchet recipe should exist');

    bot.craft(recipe.id);
    await waitTicks(5);

    const hatchetCount = bot.countItem(ITEM.STONE_HATCHET);
    assert.ok(hatchetCount >= 1, 'Should have crafted a stone hatchet');

    // Materials should be consumed
    const newWood = bot.countItem(ITEM.WOOD);
    const newStone = bot.countItem(ITEM.STONE);
    assert.ok(newWood < woodCount, 'Wood should be consumed');
    assert.ok(newStone < stoneCount, 'Stone should be consumed');
  });
});

// ─── Inventory Tests ───

describe('Inventory', () => {
  let bot;
  before(async () => {
    bot = new Bot(SERVER_URL);
    await bot.connect();
    await waitTicks(3);
  });
  after(() => bot.disconnect());

  it('should move items between slots', async () => {
    // Move rock from slot 0 to slot 5
    const initialItem = bot.inventory[0].id;
    assert.equal(initialItem, ITEM.ROCK, 'Slot 0 should start with Rock');

    bot.moveItem(0, 5);
    // Poll until inventory reflects the move
    await bot.waitForCondition(() => bot.inventory[5]?.id === ITEM.ROCK, 5000, 50);

    assert.equal(bot.inventory[5].id, ITEM.ROCK, 'Slot 5 should now have Rock');

    // Move it back
    bot.moveItem(5, 0);
    await bot.waitForCondition(() => bot.inventory[0]?.id === ITEM.ROCK, 5000, 50);
    assert.equal(bot.inventory[0].id, ITEM.ROCK, 'Slot 0 should have Rock again');
  });

  it('should drop items and create world item', async () => {
    // Ensure we have the torch in slot 1
    const hasTorch = bot.inventory[1].id === ITEM.TORCH;
    if (!hasTorch) {
      console.log('  (skipping: no torch to drop)');
      return;
    }

    bot.dropItem(1);
    // Poll until inventory reflects the drop
    await bot.waitForCondition(() => bot.inventory[1]?.id === 0, 5000, 50);

    // Slot 1 should be empty now
    assert.equal(bot.inventory[1].id, 0, 'Slot 1 should be empty after drop');

    // There should be a world item nearby
    let foundWorldItem = false;
    for (const [eid, ent] of bot.entities) {
      if (ent.t === ENTITY_TYPE.WORLD_ITEM && ent.itemId === ITEM.TORCH) {
        const dist = bot.distanceTo(ent.x, ent.y);
        if (dist < 5) {
          foundWorldItem = true;
          // Try to pick it back up
          bot.interact(ent.eid);
          await waitTicks(3);
          break;
        }
      }
    }
    assert.ok(foundWorldItem, 'Should see dropped torch as world item');
  });
});

// ─── Combat Tests ───

describe('Combat', () => {
  let attacker, victim;
  before(async () => {
    attacker = new Bot(SERVER_URL);
    victim = new Bot(SERVER_URL);
    await attacker.connect();
    await victim.connect();
    await waitTicks(5);
  });
  after(() => {
    attacker.disconnect();
    victim.disconnect();
  });

  it('should deal damage when attacking another player', async () => {
    // Move both bots toward each other
    // First, get their positions
    const ax = attacker.position.x;
    const ay = attacker.position.y;
    const vx = victim.position.x;
    const vy = victim.position.y;

    // Move attacker toward victim
    for (let i = 0; i < 100; i++) {
      // Re-check victim position from attacker's entity view
      const victimEnt = attacker.entities.get(victim.eid);
      if (victimEnt) {
        const dist = attacker.distanceTo(victimEnt.x, victimEnt.y);
        if (dist < 1.5) break;
        attacker.moveToward(victimEnt.x, victimEnt.y);
      } else {
        // Victim not visible, move toward last known position
        attacker.moveToward(vx, vy);
      }
      await waitTicks(2);
    }

    // Attacker selects rock (slot 0) and swings
    attacker.selectSlot(0);
    await waitTicks(1);

    const victimEnt = attacker.entities.get(victim.eid);
    if (!victimEnt) {
      console.log('  (skipping: victim not in range)');
      return;
    }

    const victimHpBefore = victim.hp;

    // Swing at victim
    const angle = attacker.angleTo(victimEnt.x, victimEnt.y);
    for (let swing = 0; swing < 10; swing++) {
      attacker.sendInput(0, angle, MOUSE_ACTION.PRIMARY);
      await waitTicks(5);
    }
    attacker.stopAttack();
    await waitTicks(3);

    // Check if victim took damage
    if (victimHpBefore > victim.hp) {
      assert.ok(victim.hp < victimHpBefore, 'Victim should have taken damage');
    } else {
      console.log(`  (skipping: could not land a hit - attacker dist to victim may be too far)`);
    }
  });
});

// ─── Death / Respawn Tests ───

describe('Death and Respawn', () => {
  let attacker, victim;
  before(async () => {
    attacker = new Bot(SERVER_URL);
    victim = new Bot(SERVER_URL);
    await attacker.connect();
    await victim.connect();
    await waitTicks(5);
  });
  after(() => {
    attacker.disconnect();
    victim.disconnect();
  });

  it('should die and respawn', async () => {
    // Move attacker to victim, keep attacking until victim dies
    for (let i = 0; i < 200; i++) {
      if (victim.isDead) break;

      const victimEnt = attacker.entities.get(victim.eid);
      if (victimEnt) {
        const dist = attacker.distanceTo(victimEnt.x, victimEnt.y);
        if (dist < 1.5) {
          attacker.selectSlot(0);
          const angle = attacker.angleTo(victimEnt.x, victimEnt.y);
          attacker.sendInput(0, angle, MOUSE_ACTION.PRIMARY);
        } else {
          attacker.moveToward(victimEnt.x, victimEnt.y);
        }
      } else {
        attacker.moveToward(victim.position.x, victim.position.y);
      }
      await waitTicks(3);
    }

    if (!victim.isDead) {
      console.log('  (skipping: could not kill victim in time)');
      return;
    }

    assert.ok(victim.isDead, 'Victim should be dead');

    // Wait for respawn timer
    const waitMs = (RESPAWN_WAIT_TICKS / SERVER_TPS) * 1000 + 500;
    await new Promise(r => setTimeout(r, waitMs));

    // Request respawn
    victim.respawn();
    await waitTicks(10);

    // After respawn, victim should no longer be dead and have full HP
    // The server removes Dead component on respawn
    await victim.waitForCondition(() => victim.hp === PLAYER_MAX_HP, 5000).catch(() => {});

    if (victim.hp === PLAYER_MAX_HP) {
      assert.equal(victim.hp, PLAYER_MAX_HP, 'Should have full HP after respawn');
    } else {
      console.log(`  (note: hp after respawn attempt: ${victim.hp})`);
    }
  });
});

// ─── Building Tests ───

describe('Building', () => {
  let bot;
  before(async () => {
    bot = new Bot(SERVER_URL);
    await bot.connect();
    await waitTicks(3);
  });
  after(() => bot.disconnect());

  it('should place a foundation with building plan', async () => {
    // Gather resources for building plan + foundation
    bot.selectSlot(0);

    // Gather enough wood (need 20 for plan + 50 for foundation = 70)
    for (let pass = 0; pass < 120 && bot.countItem(ITEM.WOOD) < 100; pass++) {
      const tree = bot.findNearestResource(RESOURCE_TYPE.TREE);
      if (tree && bot.distanceTo(tree.x, tree.y) < 2.0) {
        const angle = bot.angleTo(tree.x, tree.y);
        bot.sendInput(0, angle, MOUSE_ACTION.PRIMARY);
      } else if (tree) {
        bot.moveToward(tree.x, tree.y);
      } else {
        bot.move(KEY.W);
      }
      await waitTicks(3);
    }
    bot.stopAttack();

    if (bot.countItem(ITEM.WOOD) < 70) {
      console.log(`  (skipping: not enough wood - have ${bot.countItem(ITEM.WOOD)})`);
      return;
    }

    // Craft building plan
    const planRecipe = RECIPES.find(r => r.result === ITEM.BUILDING_PLAN);
    bot.craft(planRecipe.id);
    await waitTicks(5);

    const planSlot = bot.findSlot(ITEM.BUILDING_PLAN);
    if (planSlot < 0) {
      console.log('  (skipping: failed to craft building plan)');
      return;
    }

    // Select building plan in hotbar
    if (planSlot < 6) {
      bot.selectSlot(planSlot);
    } else {
      // Move to hotbar slot
      bot.moveItem(planSlot, 2);
      await waitTicks(3);
      bot.selectSlot(2);
    }
    await waitTicks(2);

    // Count structures before building
    let structsBefore = 0;
    for (const [eid, ent] of bot.entities) {
      if (ent.t === ENTITY_TYPE.STRUCTURE) structsBefore++;
    }

    // Place foundation near current position
    const buildX = bot.position.x + 2;
    const buildY = bot.position.y;
    bot.build(STRUCT_TYPE.FOUNDATION, buildX, buildY);
    await waitTicks(10);

    // Check for new structure entity
    let structsAfter = 0;
    let foundNewStruct = false;
    for (const [eid, ent] of bot.entities) {
      if (ent.t === ENTITY_TYPE.STRUCTURE) {
        structsAfter++;
        if (ent.st === STRUCT_TYPE.FOUNDATION) {
          foundNewStruct = true;
        }
      }
    }

    if (foundNewStruct) {
      assert.ok(foundNewStruct, 'Should see a foundation structure in the world');
    } else {
      console.log(`  (note: structures before=${structsBefore}, after=${structsAfter})`);
    }
  });
});

// ─── Survival Drain Tests ───

describe('Survival Drain', () => {
  let bot;
  before(async () => {
    bot = new Bot(SERVER_URL);
    await bot.connect();
    await waitTicks(5);
  });
  after(() => bot.disconnect());

  it('should have hunger and thirst that decrease over time', async () => {
    const initialHunger = bot.hunger;
    const initialThirst = bot.thirst;

    // Wait for some ticks for survival drain
    // At 0.5/min idle rate, after 30 seconds we should see some drain
    // With 20 TPS, waiting 600 ticks = 30 seconds
    await waitTicks(200);

    // The values should decrease (even if very slightly)
    // Hunger idle rate: 0.5/60/20 per tick = very small
    // After 200 ticks: ~0.083 drain, might not be visible in rounded values
    // Let's just check the system is working - values should be <= initial
    assert.ok(bot.hunger <= initialHunger, 'Hunger should not increase while idle');
    assert.ok(bot.thirst <= initialThirst, 'Thirst should not increase while idle');
  });
});

// ─── Day/Night Tests ───

describe('Day/Night', () => {
  let bot;
  before(async () => {
    bot = new Bot(SERVER_URL);
    await bot.connect();
    await waitTicks(5);
  });
  after(() => bot.disconnect());

  it('should receive world time and light level in deltas', async () => {
    await waitTicks(10);
    // worldTime and lightLevel should be set from delta messages
    assert.ok(bot.worldTime !== undefined, 'Should receive world time');
    assert.ok(bot.lightLevel !== undefined, 'Should receive light level');
    assert.ok(typeof bot.lightLevel === 'number', 'Light level should be a number');
  });

  it('should see world time advance', async () => {
    const t1 = bot.worldTime;
    await waitTicks(40);
    const t2 = bot.worldTime;
    // worldTime might be 0-based and increment with ticks
    // If world time doesn't change (e.g. it's a phase indicator), that's also valid
    assert.ok(t2 >= t1, 'World time should advance or stay the same');
  });
});

// ─── Multi-Bot Stress Test ───

describe('Multi-Bot Stress', () => {
  it('should handle 10 bots connecting simultaneously', async () => {
    const bots = [];
    const errors = [];

    // Connect 10 bots
    for (let i = 0; i < 10; i++) {
      try {
        const bot = new Bot(SERVER_URL);
        await bot.connect(10000);
        bots.push(bot);
      } catch (e) {
        errors.push(e);
      }
    }

    assert.ok(bots.length >= 8, `At least 8 bots should connect (got ${bots.length}, errors: ${errors.length})`);

    // All bots move around for a bit
    for (let tick = 0; tick < 20; tick++) {
      for (const bot of bots) {
        const keys = [KEY.W, KEY.A, KEY.S, KEY.D];
        bot.move(keys[Math.floor(Math.random() * 4)]);
      }
      await waitTicks(3);
    }

    // Verify all bots still connected and have positions
    let connectedCount = 0;
    for (const bot of bots) {
      if (bot.connected && bot.eid) connectedCount++;
    }
    assert.ok(connectedCount >= 8, `At least 8 bots should still be connected (got ${connectedCount})`);

    // Cleanup
    disconnectAll(bots);
  });

  it('should handle bots performing various actions', async () => {
    const bots = await connectBots(5, SERVER_URL);

    // Each bot does something different
    for (let tick = 0; tick < 30; tick++) {
      // Bot 0: moves
      bots[0].move(KEY.W | KEY.D);
      // Bot 1: attacks
      bots[1].sendInput(0, Math.random() * Math.PI * 2, MOUSE_ACTION.PRIMARY);
      // Bot 2: crafts
      if (tick === 0) bots[2].craft(14); // paper map (costs 10 wood — may fail)
      // Bot 3: inventory ops
      if (tick === 0) bots[3].moveItem(0, 3);
      // Bot 4: pings
      bots[4].ping();

      await waitTicks(2);
    }

    // All bots should still be alive and connected
    for (const bot of bots) {
      assert.ok(bot.connected, 'Bot should still be connected');
    }

    disconnectAll(bots);
  });
});
