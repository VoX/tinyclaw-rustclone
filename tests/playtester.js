#!/usr/bin/env node
// Continuous Playtester Harness
// Plays the game like a real player, cycling through activities and logging anomalies.
// Reuses the Bot framework from the test suite.
// Usage: node tests/playtester.js [server_url] [duration_minutes]

import { Bot } from './bot.js';
import { Wanderer, Gatherer, Builder, Fighter, Survivor } from './behaviors.js';
import { ITEM, ITEM_DEFS, RECIPES, RESOURCE_TYPE } from '../shared/constants.js';
import { ENTITY_TYPE } from '../shared/protocol.js';

const SERVER_URL = process.argv[2] || 'ws://localhost:8780';
const DURATION_MIN = parseInt(process.argv[3] || '10', 10);
const TICK_MS = 200; // How often the bot "thinks"

// ── Logging ──
const startTime = Date.now();
const issues = [];
let actionCount = 0;

function log(msg) {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[${elapsed}s] ${msg}`);
}

function logIssue(severity, description, context = '') {
  const issue = { severity, description, context, time: Date.now() - startTime };
  issues.push(issue);
  const tag = severity === 'crash' ? '🔴 CRASH' : severity === 'major' ? '🟠 MAJOR' : severity === 'minor' ? '🟡 MINOR' : '⚪ NOTE';
  log(`${tag}: ${description}${context ? ` (${context})` : ''}`);
}

// ── Playtester State Machine ──
const PHASES = ['explore', 'gather_wood', 'gather_stone', 'craft_tools', 'gather_more', 'craft_building', 'build_base', 'hunt', 'cook', 'craft_weapons', 'combat_seek', 'explore_far'];

class Playtester {
  constructor(bot) {
    this.bot = bot;
    this.phase = 'explore';
    this.phaseIndex = 0;
    this.phaseTicks = 0;
    this.phaseMaxTicks = 300; // ~60 seconds per phase
    this.behavior = null;
    this.lastHp = 100;
    this.lastHunger = 100;
    this.lastThirst = 100;
    this.lastInventory = [];
    this.stuckCounter = 0;
    this.lastPosition = { x: 0, y: 0 };
    this.ticksSinceSpawn = 0;
    this.totalResourcesGathered = 0;
    this.totalItemsCrafted = 0;
    this.totalStructuresPlaced = 0;
    this.deaths = 0;
  }

  nextPhase() {
    this.phaseIndex = (this.phaseIndex + 1) % PHASES.length;
    this.phase = PHASES[this.phaseIndex];
    this.phaseTicks = 0;
    this.behavior = null;
    log(`Phase: ${this.phase}`);
  }

  tick() {
    this.phaseTicks++;
    this.ticksSinceSpawn++;
    actionCount++;

    // Check for anomalies every tick
    this.checkAnomalies();

    // Phase timeout — move on
    if (this.phaseTicks > this.phaseMaxTicks) {
      this.nextPhase();
    }

    // Handle death (with cooldown to prevent spam)
    if (this.bot.isDead) {
      if (!this._lastRespawnTime || Date.now() - this._lastRespawnTime > 12000) {
        log('Died! Attempting respawn...');
        this.deaths++;
        this.bot.respawn();
        this._lastRespawnTime = Date.now();
        this.ticksSinceSpawn = 0;
        this.phase = 'explore';
        this.phaseTicks = 0;
        this.behavior = null;
      }
      return;
    }

    // Execute current phase
    switch (this.phase) {
      case 'explore':
        // Sprint toward map center to find resources (spawn is on beach edges)
        {
          const center = (this.bot.worldSize || 2000) * (this.bot.tileSize || 2) / 2;
          const targetX = center + (Math.random() - 0.5) * 100;
          const targetY = center + (Math.random() - 0.5) * 100;
          this.bot.moveToward(targetX, targetY, true); // sprint
          // Once we see resources nearby, move on
          const nearbyResources = [...this.bot.entities.values()].filter(e => e.t === ENTITY_TYPE.RESOURCE_NODE);
          if (nearbyResources.length > 3) {
            log(`Found ${nearbyResources.length} resources nearby, moving to gather phase`);
            this.nextPhase();
          }
        }
        break;
      case 'explore_far':
        if (!this.behavior) this.behavior = new Wanderer(this.bot);
        this.behavior.tick();
        break;

      case 'gather_wood':
        if (!this.behavior) this.behavior = new Gatherer(this.bot, RESOURCE_TYPE.TREE);
        this.behavior.tick();
        this.checkGatherProgress(ITEM.WOOD, 'wood');
        this.checkGatherProgress(ITEM.STONE, 'stone');
        break;

      case 'gather_stone':
        if (!this.behavior) this.behavior = new Gatherer(this.bot, RESOURCE_TYPE.STONE_NODE);
        this.behavior.tick();
        this.checkGatherProgress(ITEM.STONE, 'stone');
        this.checkGatherProgress(ITEM.WOOD, 'wood');
        break;

      case 'craft_tools':
        this.tryCraft('Stone Hatchet');
        this.tryCraft('Stone Pickaxe');
        this.nextPhase();
        break;

      case 'gather_more':
        if (!this.behavior) this.behavior = new Gatherer(this.bot);
        this.behavior.tick();
        break;

      case 'craft_building':
        this.tryCraft('Building Plan');
        this.tryCraft('Hammer');
        if (this.bot.countItem(ITEM.BUILDING_PLAN) > 0) {
          this.nextPhase();
        }
        break;

      case 'build_base':
        if (!this.behavior) this.behavior = new Builder(this.bot);
        this.behavior.tick();
        break;

      case 'hunt':
        if (!this.behavior) this.behavior = new Survivor(this.bot);
        this.behavior.tick();
        break;

      case 'cook':
        this.tryCraft('Campfire');
        this.nextPhase();
        break;

      case 'craft_weapons':
        this.tryCraft('Hunting Bow');
        this.tryCraft('Wooden Arrow');
        this.nextPhase();
        break;

      case 'combat_seek':
        if (!this.behavior) this.behavior = new Fighter(this.bot);
        this.behavior.tick();
        break;
    }

    // Track position for stuck detection
    if (this.phaseTicks % 10 === 0) {
      const dx = this.bot.position.x - this.lastPosition.x;
      const dy = this.bot.position.y - this.lastPosition.y;
      if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01 && this.phase !== 'craft_tools' && this.phase !== 'craft_building' && this.phase !== 'cook' && this.phase !== 'craft_weapons') {
        this.stuckCounter++;
        if (this.stuckCounter > 5) {
          logIssue('minor', 'Bot appears stuck — no position change for extended period', `phase=${this.phase}, pos=(${this.bot.position.x.toFixed(1)}, ${this.bot.position.y.toFixed(1)})`);
          this.stuckCounter = 0;
          this.nextPhase(); // Unstick by changing phase
        }
      } else {
        this.stuckCounter = 0;
      }
      this.lastPosition = { ...this.bot.position };
    }
  }

  tryCraft(recipeName) {
    const recipe = RECIPES.find(r => {
      const def = ITEM_DEFS[r.result];
      return def && def.name === recipeName;
    });
    if (recipe) {
      // Check if we have materials
      let canCraft = true;
      for (const [itemId, count] of recipe.ing) {
        if (this.bot.countItem(itemId) < count) {
          canCraft = false;
          break;
        }
      }
      if (canCraft) {
        const beforeCount = this.bot.countItem(recipe.result);
        this.bot.craft(recipe.id);
        this.totalItemsCrafted++;
        log(`Crafted: ${recipeName}`);
        // We could verify after a delay that the item appeared, but async is complex here
      }
    }
  }

  checkGatherProgress(itemId, name) {
    const count = this.bot.countItem(itemId);
    if (!this._lastResourceCounts) this._lastResourceCounts = {};
    const prev = this._lastResourceCounts[itemId] || 0;
    if (count > prev) {
      this.totalResourcesGathered += count - prev;
    }
    this._lastResourceCounts[itemId] = count;
  }

  checkAnomalies() {
    // HP went up without explanation (not near campfire, no bandage used)
    if (this.bot.hp > this.lastHp + 20 && !this.bot.isDead) {
      logIssue('minor', `HP jumped from ${this.lastHp} to ${this.bot.hp} unexpectedly`);
    }

    // HP went to impossible values
    if (this.bot.hp < 0) {
      logIssue('major', `HP is negative: ${this.bot.hp}`);
    }
    if (this.bot.hp > this.bot.maxHp + 1) {
      logIssue('major', `HP exceeds max: ${this.bot.hp} > ${this.bot.maxHp}`);
    }

    // Hunger/thirst went negative
    if (this.bot.hunger < 0) {
      logIssue('major', `Hunger is negative: ${this.bot.hunger}`);
    }
    if (this.bot.thirst < 0) {
      logIssue('major', `Thirst is negative: ${this.bot.thirst}`);
    }

    // Inventory has invalid items
    for (let i = 0; i < this.bot.inventory.length; i++) {
      const slot = this.bot.inventory[i];
      if (slot && slot.id > 0 && !ITEM_DEFS[slot.id]) {
        logIssue('major', `Unknown item ID ${slot.id} in inventory slot ${i}`);
      }
      if (slot && slot.n < 0) {
        logIssue('major', `Negative stack count ${slot.n} in slot ${i}`);
      }
    }

    // Position is outside world bounds
    const maxCoord = (this.bot.worldSize || 2000) * (this.bot.tileSize || 2);
    if (maxCoord > 0 && (this.bot.position.x < -1 || this.bot.position.y < -1 || this.bot.position.x > maxCoord + 1 || this.bot.position.y > maxCoord + 1)) {
      logIssue('major', `Player outside world bounds: (${this.bot.position.x.toFixed(1)}, ${this.bot.position.y.toFixed(1)}), max=${maxCoord}`);
    }

    // Track for next tick
    this.lastHp = this.bot.hp;
    this.lastHunger = this.bot.hunger;
    this.lastThirst = this.bot.thirst;
    this.lastInventory = this.bot.inventory.map(s => s ? { ...s } : null);
  }

  summary() {
    return {
      playTime: ((Date.now() - startTime) / 1000).toFixed(0) + 's',
      actions: actionCount,
      deaths: this.deaths,
      resourcesGathered: this.totalResourcesGathered,
      itemsCrafted: this.totalItemsCrafted,
      issuesFound: issues.length,
      issues: issues,
    };
  }
}

// ── Main ──
async function main() {
  log(`Playtester starting — server: ${SERVER_URL}, duration: ${DURATION_MIN}min`);

  const bot = new Bot(SERVER_URL);

  try {
    await bot.connect(10000);
    log(`Connected as entity ${bot.eid} at (${bot.position.x.toFixed(1)}, ${bot.position.y.toFixed(1)})`);
  } catch (err) {
    logIssue('crash', `Failed to connect: ${err.message}`);
    console.log(JSON.stringify({ issues }, null, 2));
    process.exit(1);
  }

  const playtester = new Playtester(bot);

  // Wait for world info
  await new Promise(r => setTimeout(r, 1000));
  log(`World: ${bot.worldSize}x${bot.worldSize} tiles, ${bot.entities.size} entities in view`);

  // Main play loop
  const endTime = Date.now() + DURATION_MIN * 60 * 1000;
  const interval = setInterval(() => {
    if (Date.now() > endTime || !bot.connected) {
      clearInterval(interval);

      // Final report
      const summary = playtester.summary();
      log('');
      log('═══ PLAYTEST REPORT ═══');
      log(`Play time: ${summary.playTime}`);
      log(`Actions: ${summary.actions}`);
      log(`Deaths: ${summary.deaths}`);
      log(`Resources gathered: ${summary.resourcesGathered}`);
      log(`Items crafted: ${summary.itemsCrafted}`);
      log(`Issues found: ${summary.issuesFound}`);
      if (issues.length > 0) {
        log('');
        log('Issues:');
        for (const issue of issues) {
          log(`  [${issue.severity}] ${issue.description}${issue.context ? ` — ${issue.context}` : ''}`);
        }
      }
      log('═════════════════════');
      console.log(JSON.stringify(summary, null, 2));

      bot.disconnect();
      process.exit(issues.some(i => i.severity === 'crash') ? 1 : 0);
    }

    try {
      playtester.tick();
    } catch (err) {
      logIssue('crash', `Tick error: ${err.message}`, err.stack?.split('\n')[1]?.trim());
    }
  }, TICK_MS);

  // Handle disconnection
  bot.ws.on('close', () => {
    if (Date.now() < endTime) {
      logIssue('major', 'Server disconnected unexpectedly');
    }
  });

  bot.ws.on('error', (err) => {
    logIssue('crash', `WebSocket error: ${err.message}`);
  });
}

main().catch(err => {
  logIssue('crash', `Fatal: ${err.message}`);
  process.exit(1);
});
