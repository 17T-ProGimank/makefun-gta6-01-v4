// SOLMARA round 6 — combat (session D, carried rewrite of the round-5 contract).
// 3 weapons (pistol / SMG / shotgun), hitscan shooting, enemy AI,
// weapon pickup crates, damagePlayer with red flash + game over.

export const WEAPONS = {
  pistol: { dmg: 34, rate: 0.35, name: 'PISTOL' },
  smg: { dmg: 16, rate: 0.09, name: 'SMG' },
  shotgun: { dmg: 90, rate: 0.9, name: 'SHOTGUN' },
};

const WEAPON_KEYS = { pistol: 'Digit1', smg: 'Digit2', shotgun: 'Digit3' };
const CRATE_COLORS = { smg: 0x39d0ff, shotgun: 0xffb020 };

function playSound(G, name) {
  if (G.helpers && typeof G.helpers.playSound === 'function') {
    try { G.helpers.playSound(name); } catch (e) { /* audio not ready */ }
  }
}

function banner(G, title, sub) {
  if (G.helpers && typeof G.helpers.showBanner === 'function') {
    try { G.helpers.showBanner(title, sub); } catch (e) { /* ignore */ }
  }
}

function playerPos(G) {
  const p = G.player && G.player.pos;
  if (p && typeof p.x === 'number') return p;
  return null;
}

function makeEnemyMesh(G) {
  const T = (typeof window !== 'undefined' && window.THREE) ? window.THREE : null;
  if (!T || !G.scene) return null;
  try {
    const group = new T.Group();
    const bodyMat = new T.MeshLambertMaterial({ color: 0x8a1f1f });
    const body = new T.Mesh(new T.BoxGeometry(0.9, 1.3, 0.5), bodyMat);
    body.position.y = 1.0;
    const head = new T.Mesh(
      new T.BoxGeometry(0.45, 0.45, 0.45),
      new T.MeshLambertMaterial({ color: 0xd9a986 })
    );
    head.position.y = 1.9;
    group.add(body);
    group.add(head);
    return group;
  } catch (e) { return null; }
}

function makeCrateMesh(G, kind) {
  const T = (typeof window !== 'undefined' && window.THREE) ? window.THREE : null;
  if (!T || !G.scene) return null;
  try {
    const mesh = new T.Mesh(
      new T.BoxGeometry(1.1, 1.1, 1.1),
      new T.MeshLambertMaterial({
        color: CRATE_COLORS[kind] || 0xffb020,
        emissive: CRATE_COLORS[kind] || 0xffb020,
        emissiveIntensity: 0.55,
      })
    );
    mesh.position.y = 0.6;
    return mesh;
  } catch (e) { return null; }
}

export function spawnEnemy(G, x, z, opts) {
  const o = opts || {};
  const hp = (typeof o.hp === 'number' && o.hp > 0) ? o.hp : 100;
  const T = (typeof window !== 'undefined' && window.THREE) ? window.THREE : null;
  let pos;
  if (T && T.Vector3) pos = new T.Vector3(x, 0, z);
  else pos = { x, y: 0, z };
  const mesh = makeEnemyMesh(G);
  if (mesh) {
    mesh.position.set(x, 0, z);
    if (G.scene) G.scene.add(mesh);
  }
  const enemy = { pos, hp, maxHp: hp, mesh, speed: 4, lastHit: 0, kind: o.kind || 'vulture' };
  if (!G.combat) G.combat = { enemies: [], crates: [], cooldown: 0 };
  if (!Array.isArray(G.combat.enemies)) G.combat.enemies = [];
  G.combat.enemies.push(enemy);
  return enemy;
}

export function damagePlayer(n) {
  // Attached to G.helpers.damagePlayer by initCombat; also callable directly
  // with a G bound via the module-level fallback below.
  const G = damagePlayer._G;
  if (!G) return;
  damagePlayerOn(G, n);
}

function damagePlayerOn(G, n) {
  if (!G.state) return;
  G.state.health = Math.max(0, (G.state.health == null ? 100 : G.state.health) - (Number(n) || 0));
  // Red flash overlay (index.html may provide #damage-flash).
  if (typeof document !== 'undefined') {
    const flash = document.getElementById('damage-flash');
    if (flash) {
      flash.style.opacity = '0.45';
      setTimeout(() => { flash.style.opacity = '0'; }, 150);
    }
  }
  if (G.combat) G.combat.flashUntil = (G.state.time || 0) + 0.15;
  if (G.state.health <= 0 && !G.state.gameOver) {
    G.state.gameOver = true;
    banner(G, 'GAME OVER', 'Dante is down — the Vultures win this round');
  }
}

export function initCombat(G) {
  // Weapons state (loaded from save if present, defensive defaults).
  const saved = G.saveData && G.saveData.weapons;
  const owned = (saved && Array.isArray(saved.owned) && saved.owned.length) ? saved.owned.slice() : ['pistol'];
  const current = (saved && typeof saved.current === 'string' && owned.includes(saved.current))
    ? saved.current : 'pistol';
  G.weapons = { owned, current };
  G.combat = { enemies: [], crates: [], cooldown: 0, prevF: false, prevClick: false, flashUntil: 0 };

  // damagePlayer bound to this G (also attached to helpers per the contract).
  damagePlayer._G = G;
  if (G.helpers) {
    G.helpers.damagePlayer = (n) => damagePlayerOn(G, n);
  }

  // Weapon pickup crates at CONFIG.weapons.spots (port warehouse + beach hut).
  const spots = (G.config && G.config.weapons && G.config.weapons.spots) || null;
  if (spots) {
    for (const kind of ['smg', 'shotgun']) {
      const s = spots[kind];
      if (!s || typeof s.x !== 'number') continue;
      const mesh = makeCrateMesh(G, kind);
      if (mesh) {
        mesh.position.x = s.x;
        mesh.position.z = s.z;
        if (G.scene) G.scene.add(mesh);
      }
      G.combat.crates.push({ kind, x: s.x, z: s.z, mesh, taken: false });
    }
  }
}

function switchWeapon(G, kind) {
  const w = G.weapons;
  if (!w || !Array.isArray(w.owned) || !w.owned.includes(kind)) return;
  if (w.current === kind) return;
  w.current = kind;
  playSound(G, 'weapon');
  banner(G, WEAPONS[kind].name, 'Weapon switched — press 1/2/3 to change');
}

function muzzleFlash(G) {
  const h = G.helpers || {};
  const p = playerPos(G);
  if (!p) return;
  try {
    if (typeof h.spawnMuzzle === 'function') h.spawnMuzzle(p);
    else if (typeof h.muzzleFlash === 'function') h.muzzleFlash(p);
  } catch (e) { /* effects optional */ }
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function nearestEnemyInCone(G, origin, heading, spread, range) {
  const enemies = (G.combat && Array.isArray(G.combat.enemies)) ? G.combat.enemies : [];
  let best = null;
  let bestDist = Infinity;
  for (const e of enemies) {
    if (!e || !e.pos || e.hp <= 0) continue;
    const dx = e.pos.x - origin.x;
    const dz = e.pos.z - origin.z;
    const dist = Math.hypot(dx, dz);
    if (dist > range || dist < 0.5) continue;
    const aim = Math.atan2(dx, -dz);
    if (Math.abs(angleDiff(aim, heading)) > spread) continue;
    if (dist < bestDist) { best = e; bestDist = dist; }
  }
  return best;
}

function shoot(G) {
  const w = G.weapons || { owned: ['pistol'], current: 'pistol' };
  const def = WEAPONS[w.current] || WEAPONS.pistol;
  const p = playerPos(G);
  if (!p) return;
  const heading = (G.player && typeof G.player.heading === 'number') ? G.player.heading : 0;
  playSound(G, 'shot');
  muzzleFlash(G);
  if (w.current === 'shotgun') {
    // 5 pellets with spread; each carries a fifth of the listed damage.
    const offsets = [-0.16, -0.08, 0, 0.08, 0.16];
    for (const off of offsets) {
      const hit = nearestEnemyInCone(G, p, heading + off, 0.10, 40);
      if (hit) hit.hp -= def.dmg / 5;
    }
  } else {
    const hit = nearestEnemyInCone(G, p, heading, 0.12, 60);
    if (hit) hit.hp -= def.dmg;
  }
}

function removeEnemy(G, enemy) {
  if (enemy.mesh && G.scene) {
    try { G.scene.remove(enemy.mesh); } catch (e) { /* ignore */ }
  }
  const list = G.combat.enemies;
  const i = list.indexOf(enemy);
  if (i >= 0) list.splice(i, 1);
}

function updateEnemies(G, dt) {
  const p = playerPos(G);
  if (!p || !G.combat || !Array.isArray(G.combat.enemies)) return;
  const now = G.state.time || 0;
  for (const e of G.combat.enemies.slice()) {
    if (!e || !e.pos || e.hp <= 0) {
      if (e && e.hp <= 0) {
        removeEnemy(G, e);
        G.state.kills = (G.state.kills || 0) + 1;
        if (G.helpers && typeof G.helpers.addRespect === 'function') {
          try { G.helpers.addRespect(5); } catch (err) { /* ignore */ }
        }
      }
      continue;
    }
    const dx = p.x - e.pos.x;
    const dz = p.z - e.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 40 && dist > 0.01) {
      const step = Math.min(dist, e.speed * dt);
      e.pos.x += (dx / dist) * step;
      e.pos.z += (dz / dist) * step;
      if (e.mesh) { e.mesh.position.x = e.pos.x; e.mesh.position.z = e.pos.z; }
    }
    // Attack in melee range, at most once per second per enemy — only when
    // the player is on foot (a moving car cannot be punched).
    const onFoot = !G.state.inVehicle;
    if (onFoot && dist < 2.5 && now - (e.lastHit || 0) >= 1) {
      e.lastHit = now;
      damagePlayerOn(G, 8);
    }
  }
}

function updateCrates(G) {
  const p = playerPos(G);
  if (!p || !G.combat || !Array.isArray(G.combat.crates)) return;
  for (const c of G.combat.crates) {
    if (!c || c.taken) continue;
    if (Math.hypot(p.x - c.x, p.z - c.z) < 3) {
      c.taken = true;
      if (c.mesh) {
        if (G.scene) { try { G.scene.remove(c.mesh); } catch (e) { /* ignore */ } }
        else c.mesh.visible = false;
      }
      const w = G.weapons || { owned: ['pistol'], current: 'pistol' };
      if (!w.owned.includes(c.kind)) w.owned.push(c.kind);
      w.current = c.kind;
      playSound(G, 'pickup');
      banner(G, WEAPONS[c.kind].name + ' ACQUIRED', 'Press ' + (c.kind === 'smg' ? '2' : '3') + ' to switch — ammo infinite');
    }
  }
}

export function updateCombat(G, dt) {
  if (!G.combat) initCombat(G);
  const C = G.combat;
  const keys = (G.input && G.input.keys) || new Set();
  const st = G.state || {};

  // Weapon switching: 1/2/3, owned weapons only (edge-triggered).
  for (const kind of Object.keys(WEAPON_KEYS)) {
    const code = WEAPON_KEYS[kind];
    const down = keys.has(code);
    if (down && !C['prev' + code]) switchWeapon(G, kind);
    C['prev' + code] = down;
  }

  // Shooting: mouse click or F (edge-triggered), rate-limited per weapon.
  const fDown = keys.has('KeyF');
  const clickDown = !!(G.input && (G.input.mouseDown || G.input.clicked));
  const wantShot = (fDown && !C.prevF) || (clickDown && !C.prevClick);
  C.prevF = fDown;
  C.prevClick = clickDown;
  C.cooldown = Math.max(0, (C.cooldown || 0) - (dt || 0));
  if (wantShot && st.started && !st.paused && !st.gameOver && C.cooldown <= 0) {
    const def = WEAPONS[(G.weapons && G.weapons.current) || 'pistol'] || WEAPONS.pistol;
    C.cooldown = def.rate;
    shoot(G);
  }

  updateEnemies(G, dt || 0);
  updateCrates(G);
}
