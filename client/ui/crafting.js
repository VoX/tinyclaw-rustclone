import { ITEM_DEFS, RECIPES, INVENTORY_SLOTS } from '../../shared/constants.js';
import { MSG } from '../../shared/protocol.js';

export function setupCrafting(state, send, shared) {
  const { drawItemIcon, sanitizeHTML, craftPanel } = shared;

  let lastCraftHash = '';
  let selectedCraftCategory = 'All';
  const CRAFT_CATEGORIES = ['All', 'Tools', 'Weapons', 'Building', 'Armor', 'Resources', 'Other'];
  const CRAFT_CAT_MAP = {
    'Tools': ['tool'],
    'Weapons': ['melee', 'ranged', 'ammo', 'explosive'],
    'Building': ['building', 'deployable'],
    'Armor': ['armor'],
    'Resources': ['resource', 'food', 'medical'],
  };

  function getRecipeCategory(recipe) {
    const def = ITEM_DEFS[recipe.result];
    if (!def) return 'Other';
    for (const [tab, cats] of Object.entries(CRAFT_CAT_MAP)) {
      if (cats.includes(def.cat)) return tab;
    }
    return 'Other';
  }

  function canCraftRecipe(recipe, invCounts, wbTier) {
    if (recipe.tier > wbTier) return false;
    return recipe.ing.every(([id, n]) => (invCounts[id] || 0) >= n);
  }

  function buildCraftPanel() {
    const invCounts = {};
    for (let i = 0; i < INVENTORY_SLOTS; i++) {
      const item = state.inventory[i];
      if (item?.id && item.id !== 0) {
        invCounts[item.id] = (invCounts[item.id] || 0) + item.n;
      }
    }

    const hash = JSON.stringify(invCounts) + ':' + state.workbenchTier + ':' + selectedCraftCategory;
    if (hash === lastCraftHash) return;
    lastCraftHash = hash;

    const wbTier = state.workbenchTier || 0;

    const sorted = [...RECIPES].sort((a, b) => {
      const aCraftable = canCraftRecipe(a, invCounts, wbTier) ? 0 : 1;
      const bCraftable = canCraftRecipe(b, invCounts, wbTier) ? 0 : 1;
      if (aCraftable !== bCraftable) return aCraftable - bCraftable;
      return a.tier - b.tier;
    });

    craftPanel.innerHTML = '<h3>Crafting</h3>';

    const tabBar = document.createElement('div');
    tabBar.style.cssText = 'display:flex;flex-wrap:wrap;gap:2px;margin-bottom:6px;';
    for (const cat of CRAFT_CATEGORIES) {
      const tab = document.createElement('button');
      tab.textContent = cat;
      tab.style.cssText = 'padding:3px 8px;border:1px solid #555;background:' +
        (cat === selectedCraftCategory ? '#555' : '#2a2a2a') +
        ';color:#ccc;cursor:pointer;font-size:11px;border-radius:3px;';
      tab.addEventListener('click', () => {
        selectedCraftCategory = cat;
        lastCraftHash = '';
        buildCraftPanel();
      });
      tabBar.appendChild(tab);
    }
    craftPanel.appendChild(tabBar);

    const filtered = selectedCraftCategory === 'All' ? sorted : sorted.filter(r => getRecipeCategory(r) === selectedCraftCategory);

    for (const recipe of filtered) {
      const btn = document.createElement('div');
      btn.className = 'craft-recipe';

      const resultDef = ITEM_DEFS[recipe.result];
      const tierNeeded = recipe.tier;
      const hasTier = wbTier >= tierNeeded;
      const hasResources = recipe.ing.every(([id, n]) => (invCounts[id] || 0) >= n);
      const craftable = hasTier && hasResources;

      const tierNames = { 0: '', 1: 'Workbench T1', 2: 'Workbench T2', 3: 'Workbench T3' };
      let tierLabel = '';
      if (tierNeeded > 0) {
        tierLabel = hasTier
          ? ` <span style="color:#8a8">[${tierNames[tierNeeded]}]</span>`
          : ` <span style="color:#a44">[Need ${tierNames[tierNeeded]}]</span>`;
      }

      let ingText = recipe.ing.map(([id, n]) => {
        const have = invCounts[id] || 0;
        const color = have >= n ? '#8a8' : '#a44';
        return `<span style="color:${color}">${sanitizeHTML(ITEM_DEFS[id]?.name || '?')} ${have}/${n}</span>`;
      }).join(', ');

      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '8px';

      const iconCanvas = document.createElement('canvas');
      iconCanvas.width = 28;
      iconCanvas.height = 28;
      iconCanvas.style.flexShrink = '0';
      drawItemIcon(iconCanvas.getContext('2d'), 0, 0, 28, recipe.result);
      row.appendChild(iconCanvas);

      const info = document.createElement('div');
      info.innerHTML = `
        <div class="craft-name">${sanitizeHTML(resultDef?.name || '?')} x${recipe.count}${tierLabel}</div>
        <div class="craft-cost">${ingText}</div>
      `;
      row.appendChild(info);

      btn.appendChild(row);

      if (!craftable) {
        btn.style.opacity = '0.5';
      }

      btn.addEventListener('click', () => {
        send({ type: MSG.CRAFT, recipeId: recipe.id });
      });

      craftPanel.appendChild(btn);
    }
  }

  buildCraftPanel();

  return { buildCraftPanel };
}
