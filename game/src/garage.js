// SOLMARA — garage.js (round 6, carried rewrite)
// Ember Garage management: store up to 4 cars, repair ($150), repaint
// ($200, cycles the 6 paints), upgrade in 3 levels ($800 / $1,800 / $3,500,
// +top speed and +grip each). Upgrade level 3 requires rank MADE or higher.
// Owned car shape: {color, paint, upgrade: 0..3, name}. Names are picked by
// colour from a small list. Everything defensive: no crash if helpers,
// save, respect, or the city spawn points are absent.

export const GARAGE = {
  maxCars: 4,
  repairCost: 150,
  paintCost: 200,
  paints: ['Ember Orange', 'Midnight', 'Seafoam', 'Bone White', 'Crimson', 'Lime'],
  upgrades: [
    { level: 1, cost: 800, top: 6, grip: 0.2 },
    { level: 2, cost: 1800, top: 12, grip: 0.4 },
    { level: 3, cost: 3500, top: 20, grip: 0.6 },
  ],
};

const CAR_NAMES = ['Ember GT', 'Bay Runner', 'Port Hauler', 'Sunset Coupe', 'Night Falcon', 'Coast Cruiser'];

function helpers(G) { return (G && G.helpers) || {}; }
function call(G, name, ...args) {
  try {
    const fn = helpers(G)[name];
    if (typeof fn === 'function') return fn(...args);
  } catch (e) { /* helper absent — keep playing */ }
  return undefined;
}
function money(G) {
  return (G.state && typeof G.state.money === 'number') ? G.state.money : 0;
}
function nameForColor(color) {
  const names = CAR_NAMES;
  const n = (typeof color === 'number') ? color : 0;
  return names[Math.abs(n) % names.length];
}
function paintForColor(color) {
  // Map a car colour to the nearest paint name; default Ember Orange.
  const c = (typeof color === 'number') ? color : 0;
  if (c === 0x111111 || c === 0x1a1a1a) return 'Midnight';
  if (c === 0x2a6a8a || c === 0x1d5f7a) return 'Seafoam';
  if (c === 0xe8e8e8 || c === 0xffffff) return 'Bone White';
  if (c === 0x8a1a1a || c === 0xaa2222) return 'Crimson';
  if (c === 0x44aa22 || c === 0x66cc33) return 'Lime';
  return 'Ember Orange';
}
function rankIsMadeOrHigher(G) {
  try {
    if (typeof helpers(G).respectRank === 'function') {
      const r = helpers(G).respectRank();
      if (r && typeof r.title === 'string') {
        return ['MADE', 'SHOT CALLER', 'KING OF SOLMARA'].includes(r.title);
      }
      if (r && typeof r.points === 'number') return r.points >= 700;
    }
    if (G.respect && typeof G.respect.points === 'number') return G.respect.points >= 700;
  } catch (e) {}
  return false;
}
function saveQuietly(G) {
  try { if (typeof helpers(G).saveGame === 'function') helpers(G).saveGame(); } catch (e) {}
}

export function initGarage(G) {
  if (!G) return;
  let owned = [];
  let active = 0;
  try {
    if (G.saveData && Array.isArray(G.saveData.garage)) {
      owned = G.saveData.garage.filter((c) => c && typeof c.name === 'string');
      if (typeof G.saveData.garageActive === 'number') active = G.saveData.garageActive;
    }
  } catch (e) {}
  G.garage = { owned, active: Math.max(0, Math.min(owned.length - 1, active || 0)), prevG: false };

  G.helpers.storeCar = (car) => {
    if (!G.garage) return false;
    if (G.garage.owned.length >= GARAGE.maxCars) {
      call(G, 'showBanner', 'GARAGE FULL', 'Max ' + GARAGE.maxCars + ' cars — sell or swap one first');
      return false;
    }
    const entry = {
      color: (car && typeof car.color === 'number') ? car.color : 0xff6a1a,
      paint: (car && car.paint) || paintForColor(car && car.color),
      upgrade: (car && typeof car.upgrade === 'number') ? Math.max(0, Math.min(3, car.upgrade)) : 0,
      name: (car && car.name) || nameForColor(car && car.color),
    };
    G.garage.owned.push(entry);
    call(G, 'showBanner', 'STORED IN GARAGE', entry.name + ' — ' + entry.paint);
    call(G, 'playSound', 'cash');
    saveQuietly(G);
    return true;
  };

  G.helpers.repairCar = () => {
    if (!G.garage || !G.garage.owned.length) return false;
    if (money(G) < GARAGE.repairCost) {
      call(G, 'showBanner', 'NOT ENOUGH CASH', 'Repair costs $' + GARAGE.repairCost);
      return false;
    }
    call(G, 'addMoney', -GARAGE.repairCost);
    if (G.state) G.state.health = 100;
    const car = G.garage.owned[G.garage.active] || G.garage.owned[0];
    call(G, 'showBanner', 'REPAIRED', (car ? car.name : 'Car') + ' — good as new');
    call(G, 'playSound', 'cash');
    saveQuietly(G);
    return true;
  };

  G.helpers.paintCar = (i) => {
    if (!G.garage || !G.garage.owned.length) return false;
    const idx = (typeof i === 'number') ? i : G.garage.active;
    const car = G.garage.owned[idx];
    if (!car) return false;
    if (money(G) < GARAGE.paintCost) {
      call(G, 'showBanner', 'NOT ENOUGH CASH', 'Paint costs $' + GARAGE.paintCost);
      return false;
    }
    call(G, 'addMoney', -GARAGE.paintCost);
    const cur = GARAGE.paints.indexOf(car.paint);
    car.paint = GARAGE.paints[(cur + 1) % GARAGE.paints.length];
    call(G, 'showBanner', 'REPAINTED', car.name + ' — now ' + car.paint);
    call(G, 'playSound', 'cash');
    saveQuietly(G);
    return true;
  };

  G.helpers.upgradeCar = () => {
    if (!G.garage || !G.garage.owned.length) return false;
    const car = G.garage.owned[G.garage.active] || G.garage.owned[0];
    if (!car) return false;
    const nextLevel = (car.upgrade || 0) + 1;
    if (nextLevel > 3) {
      call(G, 'showBanner', 'MAX UPGRADE', car.name + ' is already level 3');
      return false;
    }
    const up = GARAGE.upgrades[nextLevel - 1];
    if (nextLevel === 3 && !rankIsMadeOrHigher(G)) {
      call(G, 'showBanner', 'RANK LOCKED', 'Level 3 needs rank MADE or higher');
      return false;
    }
    if (money(G) < up.cost) {
      call(G, 'showBanner', 'NOT ENOUGH CASH', 'Level ' + nextLevel + ' costs $' + up.cost);
      return false;
    }
    call(G, 'addMoney', -up.cost);
    car.upgrade = nextLevel;
    // Apply the top-speed bonus to the live player car if it is this one.
    try {
      const pc = G.state && G.state.inVehicle;
      if (pc) pc._upgradeTop = up.top;
    } catch (e) {}
    call(G, 'showBanner', 'UPGRADED', car.name + ' — level ' + nextLevel + ' (+' + up.top + ' top speed)');
    call(G, 'playSound', 'cash');
    saveQuietly(G);
    return true;
  };

  G.helpers.garageCars = () => {
    if (!G.garage) return [];
    return G.garage.owned.slice();
  };
}

export function updateGarage(G, dt) {
  if (!G || !G.garage || !G.state) return;
  if (G.state.paused || !G.state.started) return;
  let gp = null;
  try {
    const sp = G.city && G.city.spawnPoints && G.city.spawnPoints.garage;
    if (sp && typeof sp.x === 'number') gp = { x: sp.x, z: sp.z };
  } catch (e) {}
  if (!gp) { G.state.nearGarage = false; return; }
  let p = null;
  try {
    const pos = G.player && (G.player.pos || (G.player.group && G.player.group.position));
    if (pos && typeof pos.x === 'number') p = pos;
  } catch (e) {}
  if (!p) { G.state.nearGarage = false; return; }
  const dx = p.x - gp.x, dz = p.z - gp.z;
  const near = (dx * dx + dz * dz) <= 144; // within 12 units
  G.state.nearGarage = near;
  // Only re-show the hint on entering the zone, not every frame.
  if (near && !G.garage.prevNear) call(G, 'showHint', 'GARAGE — press G');
  G.garage.prevNear = near;
  // Edge-triggered G key: open the garage menu (attached by menus.js).
  const gDown = !!(G.input && G.input.keys && G.input.keys.has('KeyG'));
  if (near && gDown && !G.garage.prevG) {
    call(G, 'openGarageMenu');
  }
  G.garage.prevG = gDown;
}
