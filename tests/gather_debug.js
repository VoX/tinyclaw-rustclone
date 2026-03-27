import { Bot } from './bot.js';
import { MOUSE_ACTION, ENTITY_TYPE } from '../shared/protocol.js';
import { RESOURCE_TYPE, ITEM } from '../shared/constants.js';

async function main() {
  console.log('Connecting bot...');
  const bot = new Bot('ws://localhost:8780');
  await bot.connect();
  console.log(`Connected! eid=${bot.eid} pos=(${bot.position.x.toFixed(1)}, ${bot.position.y.toFixed(1)})`);
  console.log(`Inventory:`, bot.inventory.filter(s => s.id > 0));
  console.log(`Selected slot: ${bot.selectedSlot}`);

  // Wait for delta updates
  await bot.wait(500);
  console.log(`\nEntities visible: ${bot.entities.size}`);

  // Find nearest resource
  const tree = bot.findNearestResource(RESOURCE_TYPE.TREE);
  const anyRes = bot.findNearestResource();
  console.log(`Nearest tree:`, tree ? `dist=${tree.dist.toFixed(1)} pos=(${tree.x.toFixed(1)}, ${tree.y.toFixed(1)})` : 'NONE');
  console.log(`Nearest any resource:`, anyRes ? `dist=${anyRes.dist.toFixed(1)} type=${anyRes.rt} pos=(${anyRes.x.toFixed(1)}, ${anyRes.y.toFixed(1)}) rem=${anyRes.rem}` : 'NONE');

  if (!anyRes) {
    console.log('No resources found! Listing all entity types...');
    const types = {};
    for (const [eid, e] of bot.entities) {
      types[e.t] = (types[e.t] || 0) + 1;
    }
    console.log('Entity types:', types);
    bot.disconnect();
    process.exit(1);
  }

  // Move toward nearest resource
  const target = tree || anyRes;
  console.log(`\nMoving toward resource at (${target.x.toFixed(1)}, ${target.y.toFixed(1)}), dist=${target.dist.toFixed(1)}`);

  // Make sure slot 0 is selected (Rock)
  bot.selectSlot(0);
  await bot.wait(100);

  // Move toward it
  for (let i = 0; i < 60; i++) {
    bot.moveToward(target.x, target.y, true);
    await bot.wait(50);
  }

  const distNow = bot.distanceTo(target.x, target.y);
  console.log(`After moving: pos=(${bot.position.x.toFixed(1)}, ${bot.position.y.toFixed(1)}), dist=${distNow.toFixed(1)}`);

  // Now try to gather - face the resource and attack
  const angle = bot.angleTo(target.x, target.y);
  console.log(`Facing angle: ${angle.toFixed(2)}`);

  // Send several PRIMARY clicks
  console.log(`\nAttempting to gather (sending PRIMARY mouse action)...`);
  const invBefore = bot.inventory.map(s => ({...s}));

  for (let i = 0; i < 40; i++) {
    const ang = bot.angleTo(target.x, target.y);
    bot.attack(ang);
    await bot.wait(50);
  }

  // Stop attacking
  bot.stopAttack();
  await bot.wait(500);

  console.log(`\nInventory before:`, invBefore.filter(s => s.id > 0));
  console.log(`Inventory after:`, bot.inventory.filter(s => s.id > 0));

  const woodBefore = invBefore.filter(s => s.id === ITEM.WOOD).reduce((t, s) => t + s.n, 0);
  const woodAfter = bot.inventory.filter(s => s.id === ITEM.WOOD).reduce((t, s) => t + s.n, 0);
  console.log(`Wood: ${woodBefore} -> ${woodAfter} (gained ${woodAfter - woodBefore})`);

  if (woodAfter > woodBefore) {
    console.log('\n=== GATHERING WORKS! ===');
  } else {
    console.log('\n=== GATHERING BROKEN - NO RESOURCES GAINED ===');
  }

  bot.disconnect();
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
