// SOLMARA — crew.js (round 6, carried rewrite)
// Dante's crew: Mara Voss (Fixer, unlocked from the start), Jax Calloway
// (Wheelman, recruited in mission 10 "New Blood"), Lena Marlowe (Ghost
// Driver, recruited in mission 11 "Ghost Ride"). Crew bonuses are read
// defensively by missions/combat; nothing here crashes if helpers are absent.

export const CREW = [
  { id: 'mara', name: 'Mara Voss', role: 'Fixer', bonus: '+10% mission payout', unlocked: true },
  { id: 'jax', name: 'Jax Calloway', role: 'Wheelman', bonus: '+15% getaway speed, police lose you faster', unlocked: false },
  { id: 'lena', name: 'Lena Marlowe', role: 'Ghost Driver', bonus: '-1 wanted star on mission start, +10% payout', unlocked: false },
];

function helpers(G) { return (G && G.helpers) || {}; }
function call(G, name, ...args) {
  try {
    const fn = helpers(G)[name];
    if (typeof fn === 'function') return fn(...args);
  } catch (e) { /* helper absent — keep playing */ }
  return undefined;
}
function memberById(id) {
  return CREW.find((c) => c.id === id) || null;
}

export function initCrew(G) {
  if (!G) return;
  // Restore recruited members from a loaded save if one is present.
  let members = ['mara'];
  try {
    if (G.saveData && Array.isArray(G.saveData.crew)) {
      members = G.saveData.crew.filter((id) => memberById(id));
      if (!members.includes('mara')) members.unshift('mara');
    }
  } catch (e) {}
  G.crew = { members, active: null, assistCar: null };

  G.helpers.recruitCrew = (id) => {
    const m = memberById(id);
    if (!m || !G.crew) return false;
    if (G.crew.members.includes(id)) return false;
    G.crew.members.push(id);
    call(G, 'showBanner', m.name.toUpperCase() + ' JOINS THE CREW', m.role + ' — ' + m.bonus);
    call(G, 'playSound', 'mission');
    try { if (typeof helpers(G).saveGame === 'function') helpers(G).saveGame(); } catch (e) {}
    return true;
  };

  G.helpers.crewBonus = (kind) => {
    if (!G.crew) return kind === 'payout' || kind === 'evade' ? 1 : 0;
    const has = (id) => G.crew.members.includes(id);
    if (kind === 'payout') {
      let mult = 1;
      if (has('mara')) mult += 0.10;
      if (has('lena')) mult += 0.10;
      return mult;
    }
    if (kind === 'evade') {
      return has('jax') ? 1.15 : 1;
    }
    if (kind === 'wanted') {
      return has('lena') ? -1 : 0;
    }
    return 0;
  };

  G.helpers.crewList = () => {
    if (!G.crew) return [];
    return G.crew.members.map((id) => memberById(id)).filter(Boolean);
  };
}

export function updateCrew(G, dt) {
  if (!G || !G.crew || !G.missions || !G.missions.current) return;
  if (!G.state || G.state.paused || !G.state.started) return;
  // Mission ended or has no crew assist: park the assist car (remove it so
  // it stops following the player between missions).
  if (!G.missions.current.crewAssist) {
    if (G.crew.assistCar) {
      const old = G.crew.assistCar;
      G.crew.assistCar = null;
      if (G.cars) { const i = G.cars.indexOf(old); if (i >= 0) G.cars.splice(i, 1); }
      try { if (old.group && G.scene) G.scene.remove(old.group); } catch (e) {}
    }
    return;
  }
  if (!G.missions.current.crewAssist) return;
  const p = (() => {
    try {
      const pos = G.player && (G.player.pos || (G.player.group && G.player.group.position));
      return pos && typeof pos.x === 'number' ? pos : null;
    } catch (e) { return null; }
  })();
  if (!p) return;
  if (!G.crew.assistCar) {
    let car = null;
    try {
      if (typeof helpers(G).makeCar === 'function') car = helpers(G).makeCar(0x2a6a8a, 'traffic', {});
    } catch (e) {}
    if (!car) return;
    if (car.pos) { car.pos.x = p.x - 10; car.pos.z = p.z - 10; }
    if (G.cars) G.cars.push(car);
    G.crew.assistCar = car;
  }
  const car = G.crew.assistCar;
  const cp = car && (car.pos || (car.group && car.group.position));
  if (!cp) return;
  const dx = p.x - cp.x, dz = p.z - cp.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d > 12) {
    const sp = Math.min(24, d) * dt;
    cp.x += (dx / d) * sp;
    cp.z += (dz / d) * sp;
    if (car.group) {
      car.group.position.set(cp.x, 0, cp.z);
      car.group.rotation.y = Math.atan2(dx, dz);
    }
  }
}
