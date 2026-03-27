// AI Bot Behaviors - behavior trees for bot decision-making
import { KEY, MOUSE_ACTION, ENTITY_TYPE } from '../shared/protocol.js';
import { ITEM, RECIPES, RESOURCE_TYPE, STRUCT_TYPE } from '../shared/constants.js';

// ─── Wanderer: Move randomly, explore the map ───

export class Wanderer {
  constructor(bot) {
    this.bot = bot;
    this.targetX = 0;
    this.targetY = 0;
    this.pickNewTarget();
  }

  pickNewTarget() {
    const range = 20;
    this.targetX = this.bot.position.x + (Math.random() - 0.5) * range * 2;
    this.targetY = this.bot.position.y + (Math.random() - 0.5) * range * 2;
    // Clamp to world bounds
    const max = (this.bot.worldSize || 2000) * (this.bot.tileSize || 2);
    this.targetX = Math.max(5, Math.min(max - 5, this.targetX));
    this.targetY = Math.max(5, Math.min(max - 5, this.targetY));
  }

  tick() {
    const dist = this.bot.distanceTo(this.targetX, this.targetY);
    if (dist < 2) {
      this.pickNewTarget();
    }
    this.bot.moveToward(this.targetX, this.targetY);
  }
}

// ─── Gatherer: Find and gather nearest resource ───

export class Gatherer {
  constructor(bot, resourceType) {
    this.bot = bot;
    this.resourceType = resourceType; // optional filter
    this.state = 'searching'; // searching | approaching | gathering
    this.targetEid = null;
    this.gatherTicks = 0;
  }

  tick() {
    switch (this.state) {
      case 'searching':
        this._search();
        break;
      case 'approaching':
        this._approach();
        break;
      case 'gathering':
        this._gather();
        break;
    }
  }

  _search() {
    // Make sure rock is selected (slot 0)
    this.bot.selectSlot(0);
    const node = this.bot.findNearestResource(this.resourceType);
    if (node) {
      this.targetEid = node.eid;
      this.state = 'approaching';
    } else {
      // Wander to find resources
      const keys = [KEY.W, KEY.A, KEY.S, KEY.D];
      this.bot.move(keys[Math.floor(Math.random() * 4)]);
    }
  }

  _approach() {
    const ent = this.bot.entities.get(this.targetEid);
    if (!ent || ent.rem <= 0) {
      this.state = 'searching';
      this.targetEid = null;
      return;
    }
    const dist = this.bot.distanceTo(ent.x, ent.y);
    if (dist < 1.8) {
      this.state = 'gathering';
      this.gatherTicks = 0;
      this.bot.stop();
    } else {
      this.bot.moveToward(ent.x, ent.y);
    }
  }

  _gather() {
    const ent = this.bot.entities.get(this.targetEid);
    if (!ent || ent.rem <= 0) {
      this.state = 'searching';
      this.targetEid = null;
      this.bot.stopAttack();
      return;
    }
    // Face the node and swing
    const angle = this.bot.angleTo(ent.x, ent.y);
    this.bot.sendInput(0, angle, MOUSE_ACTION.PRIMARY);
    this.gatherTicks++;
    // Don't gather forever
    if (this.gatherTicks > 200) {
      this.state = 'searching';
      this.targetEid = null;
      this.bot.stopAttack();
    }
  }
}

// ─── Builder: Gather resources, craft tools, build a base ───

export class Builder {
  constructor(bot) {
    this.bot = bot;
    this.state = 'gather_wood';
    this.gatherer = null;
    this.buildPhase = 0; // tracks which structure to place next
    this.baseX = 0;
    this.baseY = 0;
  }

  tick() {
    switch (this.state) {
      case 'gather_wood':
        this._gatherWood();
        break;
      case 'gather_stone':
        this._gatherStone();
        break;
      case 'craft':
        this._craft();
        break;
      case 'build':
        this._build();
        break;
      case 'done':
        break;
    }
  }

  _gatherWood() {
    const woodCount = this.bot.countItem(ITEM.WOOD);
    if (woodCount >= 500) {
      this.state = 'gather_stone';
      this.gatherer = null;
      this.bot.stop();
      return;
    }
    if (!this.gatherer) {
      this.gatherer = new Gatherer(this.bot, RESOURCE_TYPE.TREE);
    }
    this.gatherer.tick();
  }

  _gatherStone() {
    const stoneCount = this.bot.countItem(ITEM.STONE);
    if (stoneCount >= 250) {
      this.state = 'craft';
      this.gatherer = null;
      this.bot.stop();
      return;
    }
    if (!this.gatherer) {
      this.gatherer = new Gatherer(this.bot, RESOURCE_TYPE.STONE_NODE);
    }
    this.gatherer.tick();
  }

  _craft() {
    // Craft building plan (recipe 8: 20 wood)
    if (this.bot.findSlot(ITEM.BUILDING_PLAN) < 0) {
      const planRecipe = RECIPES.find(r => r.result === ITEM.BUILDING_PLAN);
      if (planRecipe) this.bot.craft(planRecipe.id);
    }
    // Craft hammer (recipe 9: 100 wood + 50 stone)
    if (this.bot.findSlot(ITEM.HAMMER) < 0) {
      const hammerRecipe = RECIPES.find(r => r.result === ITEM.HAMMER);
      if (hammerRecipe) this.bot.craft(hammerRecipe.id);
    }
    this.state = 'build';
    this.baseX = this.bot.position.x;
    this.baseY = this.bot.position.y;
  }

  _build() {
    // Equip building plan
    const planSlot = this.bot.findSlot(ITEM.BUILDING_PLAN);
    if (planSlot >= 0 && planSlot < 6) {
      this.bot.selectSlot(planSlot);
    }

    const ts = this.bot.tileSize || 2;
    const structures = [
      { type: STRUCT_TYPE.FOUNDATION, dx: 0, dy: 0 },
      { type: STRUCT_TYPE.WALL, dx: ts, dy: 0 },
      { type: STRUCT_TYPE.WALL, dx: -ts, dy: 0 },
      { type: STRUCT_TYPE.WALL, dx: 0, dy: ts },
      { type: STRUCT_TYPE.DOORWAY, dx: 0, dy: -ts },
    ];

    if (this.buildPhase < structures.length) {
      const s = structures[this.buildPhase];
      this.bot.build(s.type, this.baseX + s.dx, this.baseY + s.dy);
      this.buildPhase++;
    } else {
      this.state = 'done';
    }
  }
}

// ─── Fighter: Craft weapons, seek and attack players ───

export class Fighter {
  constructor(bot) {
    this.bot = bot;
    this.state = 'seek';
    this.targetEid = null;
  }

  tick() {
    switch (this.state) {
      case 'seek':
        this._seek();
        break;
      case 'chase':
        this._chase();
        break;
      case 'attack':
        this._attack();
        break;
    }
  }

  _seek() {
    // Use rock (slot 0) or best weapon
    this.bot.selectSlot(0);

    // Craft a wooden spear if we have enough wood
    if (this.bot.findSlot(ITEM.WOODEN_SPEAR) < 0 && this.bot.countItem(ITEM.WOOD) >= 300) {
      const recipe = RECIPES.find(r => r.result === ITEM.WOODEN_SPEAR);
      if (recipe) this.bot.craft(recipe.id);
    }

    const target = this.bot.findNearestPlayer();
    if (target) {
      this.targetEid = target.eid;
      this.state = 'chase';
    } else {
      // Wander while seeking
      const keys = [KEY.W, KEY.A, KEY.S, KEY.D];
      this.bot.move(keys[Math.floor(Math.random() * 4)]);
    }
  }

  _chase() {
    const ent = this.bot.entities.get(this.targetEid);
    if (!ent || ent.dead) {
      this.state = 'seek';
      this.targetEid = null;
      return;
    }
    const dist = this.bot.distanceTo(ent.x, ent.y);
    if (dist < 1.5) {
      this.state = 'attack';
    } else {
      this.bot.moveToward(ent.x, ent.y);
    }
  }

  _attack() {
    const ent = this.bot.entities.get(this.targetEid);
    if (!ent || ent.dead) {
      this.state = 'seek';
      this.targetEid = null;
      this.bot.stopAttack();
      return;
    }
    const dist = this.bot.distanceTo(ent.x, ent.y);
    if (dist > 2.0) {
      this.state = 'chase';
      this.bot.stopAttack();
      return;
    }
    // Equip best weapon
    const spearSlot = this.bot.findSlot(ITEM.WOODEN_SPEAR);
    if (spearSlot >= 0 && spearSlot < 6) {
      this.bot.selectSlot(spearSlot);
    }
    const angle = this.bot.angleTo(ent.x, ent.y);
    this.bot.attack(angle);
  }
}

// ─── Survivor: Manage hunger/thirst, hunt animals ───

export class Survivor {
  constructor(bot) {
    this.bot = bot;
    this.state = 'idle';
    this.targetEid = null;
  }

  tick() {
    // Priority: eat cooked meat if hungry
    if (this.bot.hunger < 50) {
      const meatSlot = this.bot.findSlot(ITEM.COOKED_MEAT);
      if (meatSlot >= 0) {
        // Eating is handled via interact or equip — for now just track
      }
    }

    // Hunt if we need food
    if (this.bot.hunger < 70 || this.bot.countItem(ITEM.RAW_MEAT) < 2) {
      this._hunt();
    } else {
      this.state = 'idle';
      this.bot.stop();
    }
  }

  _hunt() {
    // Find nearest animal
    const animal = this.bot.findNearest(ENTITY_TYPE.ANIMAL);
    if (!animal) {
      // Wander
      const keys = [KEY.W, KEY.A, KEY.S, KEY.D];
      this.bot.move(keys[Math.floor(Math.random() * 4)]);
      return;
    }

    const dist = this.bot.distanceTo(animal.x, animal.y);
    if (dist < 1.5) {
      // Attack
      this.bot.selectSlot(0); // rock
      const angle = this.bot.angleTo(animal.x, animal.y);
      this.bot.attack(angle);
    } else {
      this.bot.moveToward(animal.x, animal.y);
    }
  }
}

// ─── Full Loop: Combines all behaviors in priority order ───

export class FullLoop {
  constructor(bot) {
    this.bot = bot;
    this.wanderer = new Wanderer(bot);
    this.gatherer = new Gatherer(bot);
    this.builder = null;
    this.fighter = null;
    this.survivor = new Survivor(bot);
    this.tickCount = 0;
  }

  tick() {
    this.tickCount++;

    // If dead, respawn
    if (this.bot.isDead) {
      this.bot.respawn();
      return;
    }

    // Priority 1: Survive (if hungry/thirsty)
    if (this.bot.hunger < 30 || this.bot.thirst < 30) {
      this.survivor.tick();
      return;
    }

    // Priority 2: Fight if there's a nearby player and we have a weapon
    const nearPlayer = this.bot.findNearestPlayer();
    if (nearPlayer && nearPlayer.dist < 10) {
      if (!this.fighter) this.fighter = new Fighter(this.bot);
      this.fighter.targetEid = nearPlayer.eid;
      this.fighter.state = 'chase';
      this.fighter.tick();
      return;
    }

    // Priority 3: Gather resources
    const woodCount = this.bot.countItem(ITEM.WOOD);
    const stoneCount = this.bot.countItem(ITEM.STONE);
    if (woodCount < 200 || stoneCount < 100) {
      this.gatherer.tick();
      return;
    }

    // Priority 4: Build if we have enough resources
    if (!this.builder) this.builder = new Builder(this.bot);
    if (this.builder.state !== 'done') {
      this.builder.tick();
      return;
    }

    // Default: wander
    this.wanderer.tick();
  }
}
