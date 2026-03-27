// Demo script: connect N AI bots that run the full behavior loop
// Usage: node tests/demo-bots.js [count] [serverUrl]
import { Bot } from './bot.js';
import { FullLoop, Wanderer, Gatherer, Builder, Fighter, Survivor } from './behaviors.js';

const count = parseInt(process.argv[2]) || 5;
const serverUrl = process.argv[3] || 'ws://localhost:8780';

const BEHAVIORS = ['full', 'wanderer', 'gatherer', 'builder', 'fighter', 'survivor'];

async function main() {
  console.log(`Connecting ${count} AI bots to ${serverUrl}...`);

  const bots = [];
  const behaviors = [];

  for (let i = 0; i < count; i++) {
    try {
      const bot = new Bot(serverUrl);
      await bot.connect();
      bots.push(bot);

      // Assign behavior: first bot gets full loop, rest cycle through behaviors
      const behaviorName = BEHAVIORS[i % BEHAVIORS.length];
      let behavior;
      switch (behaviorName) {
        case 'wanderer':
          behavior = new Wanderer(bot);
          break;
        case 'gatherer':
          behavior = new Gatherer(bot);
          break;
        case 'builder':
          behavior = new Builder(bot);
          break;
        case 'fighter':
          behavior = new Fighter(bot);
          break;
        case 'survivor':
          behavior = new Survivor(bot);
          break;
        default:
          behavior = new FullLoop(bot);
          break;
      }
      behaviors.push({ name: behaviorName, behavior });

      console.log(`  Bot ${i + 1} connected (eid: ${bot.eid}, behavior: ${behaviorName})`);
    } catch (e) {
      console.error(`  Bot ${i + 1} failed to connect: ${e.message}`);
    }
  }

  console.log(`\n${bots.length}/${count} bots connected. Running behaviors...`);
  console.log('Press Ctrl+C to stop.\n');

  // Status report interval
  let tickCount = 0;
  const statusInterval = setInterval(() => {
    console.log(`--- Tick ${tickCount} ---`);
    for (let i = 0; i < bots.length; i++) {
      const bot = bots[i];
      const { name } = behaviors[i];
      const status = bot.isDead ? 'DEAD' : 'alive';
      console.log(
        `  Bot ${i + 1} [${name}]: pos(${bot.position.x.toFixed(1)}, ${bot.position.y.toFixed(1)}) ` +
        `hp:${bot.hp} hunger:${bot.hunger} thirst:${bot.thirst} ${status} ` +
        `wood:${bot.countItem(3)} stone:${bot.countItem(4)}`
      );
    }
    console.log('');
  }, 10000);

  // Main tick loop - runs at ~10 Hz (every 100ms)
  const tickInterval = setInterval(() => {
    tickCount++;
    for (let i = 0; i < bots.length; i++) {
      if (!bots[i].connected) continue;
      try {
        behaviors[i].behavior.tick();
      } catch (e) {
        // Behavior error, skip this tick
      }
    }
  }, 100);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down bots...');
    clearInterval(tickInterval);
    clearInterval(statusInterval);
    for (const bot of bots) {
      bot.disconnect();
    }
    console.log('All bots disconnected.');
    process.exit(0);
  });
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
