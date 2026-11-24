// SOLMARA — police.js (round 6)
// SMPD wanted system: patrol cruisers chase the player by wanted level;
// at >=3 stars AIR-1 circles overhead + roadblocks spawn ahead; wanted
// decays when the player hides/outruns; arrest when a cruiser touches the
// player on foot for 2s. Round 5: spike strips at >=4 stars (up to 2, ahead
// of travel direction, 12s timer; driving over one slows the car 10s) and
// bribe (on foot, wanted 1–2, within 8 units of a cruiser, press B: -$500,
// -1 star, once per wanted episode). Round 6 adds a translucent searchlight
// cone under the heli, visible at >=3 stars. Everything defensive: no crash
// if helpers, THREE, or the player are absent.

function helpers(G) { return (G && G.helpers) || {}; }
function call(G, name, ...args) {
  try {
    const fn = helpers(G)[name];
    if (typeof fn === 'function') return fn(...args);
  } catch (e) { /* helper absent — keep playing */ }
  return undefined;
}
function playerPos(G) {
  try {
    const p = G.player && (G.player.pos || (G.player.group && G.player.group.position));
    if (p && typeof p.x === 'number') return { x: p.x, z: p.z };
  } catch (e) {}
  return null;
}
function carPos(car) {
  if (!car) return null;
  try {
    if (car.pos && typeof car.pos.x === 'number') return car.pos;
    if (car.group && car.group.position) return car.group.position;
  } catch (e) {}
  return null;
}
function three() {
  try { return (typeof globalThis !== 'undefined' && globalThis.THREE) || null; } catch (e) { return null; }
}

function makePoliceCarMesh(G, color) {
  const THREE = three();
  if (!THREE || !G.scene) return null;
  try {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.4, metalness: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 4.4), bodyMat);
    body.position.y = 0.6;
    group.add(body);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.6, 2.2),
      new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.3, metalness: 0.4 })
    );
    cabin.position.set(0, 1.2, -0.2);
    group.add(cabin);
    const lightBar = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.18, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 0.9 })
    );
    lightBar.position.set(0, 1.6, -0.2);
    group.add(lightBar);
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, 0.42, wz);
      group.add(w);
    }
    G.scene.add(group);
    return group;
  } catch (e) { return null; }
}

function makeHeli(G) {
  const THREE = three();
  if (!THREE || !G.scene) return null;
  try {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.4, 5),
      new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.4, metalness: 0.5 })
    );
    body.position.y = 0;
    group.add(body);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.6, 4),
      new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.4, metalness: 0.5 })
    );
    tail.position.set(0, 0.3, -4);
    group.add(tail);
    const rotor = new THREE.Mesh(
      new THREE.BoxGeometry(9, 0.08, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 })
    );
    rotor.position.y = 1;
    group.add(rotor);
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: 0xff3333, emissiveIntensity: 1 })
    );
    beacon.position.y = -0.9;
    group.add(beacon);
    // Round 6 — searchlight cone: translucent, points down, follows the heli.
    const coneGeo = new THREE.ConeGeometry(7, 42, 24, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xfff2b0, transparent: true, opacity: 0.10,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.rotation.x = Math.PI; // apex up at the heli, base down toward the ground
    cone.position.y = -22;
    cone.visible = false;
    group.add(cone);
    group.position.set(0, 42, 0);
    G.scene.add(group);
    return { group, rotor, cone };
  } catch (e) { return null; }
}

function makeRoadblock(G, x, z) {
  const THREE = three();
  const rb = { x, z, pos: { x, z }, group: null, ttl: 14 };
  if (THREE && G.scene) {
    try {
      const group = new THREE.Group();
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(8, 1, 0.6),
        new THREE.MeshStandardMaterial({ color: 0xff5533, emissive: 0x662200, emissiveIntensity: 0.4 })
      );
      bar.position.y = 0.8;
      group.add(bar);
      for (const sx of [-3.5, 3.5]) {
        const leg = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 1.6, 0.5),
          new THREE.MeshStandardMaterial({ color: 0x333333 })
        );
        leg.position.set(sx, 0.8, 0);
        group.add(leg);
      }
      group.position.set(x, 0, z);
      G.scene.add(group);
      rb.group = group;
    } catch (e) {}
  }
  return rb;
}

function makeSpikeStrip(G, x, z, heading) {
  const THREE = three();
  const strip = { x, z, pos: { x, z }, group: null, ttl: 12 };
  if (THREE && G.scene) {
    try {
      const group = new THREE.Group();
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, 0.12, 0.8),
        new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.9 })
      );
      base.position.y = 0.08;
      group.add(base);
      const spikeGeo = new THREE.ConeGeometry(0.09, 0.4, 6);
      const spikeMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.8, roughness: 0.3 });
      for (let i = 0; i < 7; i++) {
        const s = new THREE.Mesh(spikeGeo, spikeMat);
        s.position.set(-1.5 + i * 0.5, 0.3, 0);
        group.add(s);
      }
      group.position.set(x, 0, z);
      group.rotation.y = heading || 0;
      G.scene.add(group);
      strip.group = group;
    } catch (e) {}
  }
  return strip;
}

function removeMesh(G, obj) {
  try {
    if (obj && obj.group && G.scene) G.scene.remove(obj.group);
  } catch (e) {}
}

export function initPolice(G) {
  if (!G) return;
  G.police = {
    cars: [], heli: null, roadblocks: [], spikeStrips: [],
    bribed: false, arrestTimer: 0, spawnTimer: 0, blockTimer: 0,
    spikeTimer: 0, decayTimer: 0, prevB: false, prevSiren: 0,
  };
  if (G.state) {
    G.state.spikeAhead = false;
    G.state.bribeAvailable = false;
    if (typeof G.state.spikeSlowUntil !== 'number') G.state.spikeSlowUntil = 0;
  }
  G.helpers.setWanted = (n) => {
    if (!G.state) return;
    const v = Math.max(0, Math.min(5, Math.round(n || 0)));
    G.state.wanted = v;
    if (v === 0) G.police.bribed = false;
  };
}

function spawnPoliceCar(G, p) {
  const THREE = three();
  const car = {
    kind: 'police', color: 0x1a2a4a, heading: 0, speed: 0,
    pos: null, group: null, mesh: null,
  };
  // Spawn behind / beside the player on a nearby road, not on top of them.
  const angle = Math.random() * Math.PI * 2;
  const sx = p.x + Math.cos(angle) * 45, sz = p.z + Math.sin(angle) * 45;
  try {
    if (G.city && typeof G.city.clampToCity === 'function') {
      const c = G.city.clampToCity(G, sx, sz);
      car.pos = { x: c.x, z: c.z };
    } else car.pos = { x: sx, z: sz };
  } catch (e) { car.pos = { x: sx, z: sz }; }
  car.group = makePoliceCarMesh(G, car.color);
  if (car.group && car.pos) car.group.position.set(car.pos.x, 0, car.pos.z);
  if (G.cars) G.cars.push(car);
  G.police.cars.push(car);
  return car;
}

function updateHeli(G, dt, p, wanted) {
  if (wanted < 3) {
    if (G.police.heli && G.police.heli.group) {
      try { G.scene.remove(G.police.heli.group); } catch (e) {}
      G.police.heli = null;
    }
    return;
  }
  if (!G.police.heli) G.police.heli = makeHeli(G);
  const heli = G.police.heli;
  if (!heli || !heli.group || !p) return;
  const t = (G.state && typeof G.state.time === 'number') ? G.state.time : 0;
  const ang = t * 0.35;
  const hx = p.x + Math.cos(ang) * 30;
  const hz = p.z + Math.sin(ang) * 30;
  heli.group.position.set(hx, 42, hz);
  heli.group.rotation.y = -ang;
  if (heli.rotor) heli.rotor.rotation.y = t * 18;
  // Searchlight cone follows the heli and is only visible at >=3 stars.
  if (heli.cone) heli.cone.visible = wanted >= 3;
}

export function updatePolice(G, dt) {
  if (!G || !G.state || G.state.paused || !G.state.started) return;
  const P = G.police;
  if (!P) return;
  const wanted = G.state.wanted || 0;
  const p = playerPos(G);
  if (!p) return;
  const now = (typeof G.state.time === 'number') ? G.state.time : 0;

  // --- Cruiser spawn / despawn by wanted level ---
  const maxCars = Math.min(wanted, (G.config && G.config.police && G.config.police.maxCars) || 6);
  P.spawnTimer -= dt;
  if (P.cars.length < maxCars && P.spawnTimer <= 0) {
    spawnPoliceCar(G, p);
    P.spawnTimer = 2.5;
    call(G, 'playSound', 'siren');
  }
  // Wanted dropped (e.g. bribe or decay): trim excess cruisers at once
  // instead of leaving a 5-star fleet chasing a 1-star player.
  while (P.cars.length > maxCars) {
    const extra = P.cars.pop();
    removeMesh(G, extra);
    if (G.cars) { const i = G.cars.indexOf(extra); if (i >= 0) G.cars.splice(i, 1); }
  }
  if (wanted === 0 && P.cars.length) {
    for (const car of P.cars) {
      removeMesh(G, car);
      if (G.cars) { const i = G.cars.indexOf(car); if (i >= 0) G.cars.splice(i, 1); }
    }
    P.cars = [];
  }

  // --- Chase: cruisers drive at the player; touch on foot for 2s = arrest ---
  let nearest = Infinity;
  let nearestCar = null;
  for (const car of P.cars) {
    const cp = carPos(car);
    if (!cp) continue;
    const dx = p.x - cp.x, dz = p.z - cp.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < nearest) { nearest = d; nearestCar = car; }
    const speed = 16 + wanted * 2.5;
    if (d > 3) {
      cp.x += (dx / d) * speed * dt;
      cp.z += (dz / d) * speed * dt;
      car.heading = Math.atan2(dx, dz);
      if (car.group) {
        car.group.position.set(cp.x, 0, cp.z);
        car.group.rotation.y = car.heading;
      }
    }
  }
  const onFoot = !(G.state.inVehicle);
  if (onFoot && nearestCar && nearest < 2.5) {
    P.arrestTimer += dt;
    if (P.arrestTimer >= 2) {
      P.arrestTimer = 0;
      call(G, 'showBanner', 'BUSTED', 'The SMPD got you — $200 fine');
      call(G, 'addMoney', -200);
      call(G, 'setWanted', 0);
      const gp = garagePos(G);
      try {
        if (G.player && G.player.pos) { G.player.pos.x = gp.x; G.player.pos.z = gp.z; }
        if (G.player && G.player.group) G.player.group.position.set(gp.x, 0, gp.z);
      } catch (e) {}
    }
  } else P.arrestTimer = 0;

  // --- Wanted decay: outrun / hide (no cruiser within 25u for 6s) ---
  if (wanted > 0) {
    if (nearest > 25) {
      P.decayTimer += dt;
      if (P.decayTimer >= 6) {
        P.decayTimer = 0;
        call(G, 'setWanted', wanted - 1);
      }
    } else P.decayTimer = 0;
  }

  // --- AIR-1 + searchlight ---
  updateHeli(G, dt, p, wanted);

  // --- Roadblocks at >=3 stars, ahead of the player ---
  P.blockTimer -= dt;
  if (wanted >= 3 && P.blockTimer <= 0 && P.roadblocks.length < 3) {
    const heading = (G.player && typeof G.player.heading === 'number') ? G.player.heading : 0;
    const bx = p.x + Math.sin(heading) * 40;
    const bz = p.z + Math.cos(heading) * 40;
    P.roadblocks.push(makeRoadblock(G, bx, bz));
    P.blockTimer = 9;
  }
  for (let i = P.roadblocks.length - 1; i >= 0; i--) {
    const rb = P.roadblocks[i];
    rb.ttl -= dt;
    if (rb.ttl <= 0) { removeMesh(G, rb); P.roadblocks.splice(i, 1); }
  }

  // --- Spike strips at >=4 stars, ahead of travel direction, 12s timer ---
  P.spikeTimer -= dt;
  if (wanted >= 4 && P.spikeTimer <= 0 && P.spikeStrips.length < 2) {
    const heading = (G.player && typeof G.player.heading === 'number') ? G.player.heading : 0;
    const sx = p.x + Math.sin(heading) * 30;
    const sz = p.z + Math.cos(heading) * 30;
    P.spikeStrips.push(makeSpikeStrip(G, sx, sz, heading));
    P.spikeTimer = 8;
  }
  let spikeNear = false;
  for (let i = P.spikeStrips.length - 1; i >= 0; i--) {
    const st = P.spikeStrips[i];
    st.ttl -= dt;
    const sp = st.pos || st;
    const d = Math.sqrt((p.x - sp.x) * (p.x - sp.x) + (p.z - sp.z) * (p.z - sp.z));
    if (d < 40) spikeNear = true;
    if (d < 3 && G.state.inVehicle) {
      G.state.spikeSlowUntil = now + 10;
      call(G, 'playSound', 'spike');
      try { if (typeof helpers(G).shake === 'function') helpers(G).shake(0.6); } catch (e) {}
      call(G, 'showBanner', 'SPIKE STRIP!', 'Tires blown — speed halved for 10s');
      removeMesh(G, st);
      P.spikeStrips.splice(i, 1);
      continue;
    }
    if (st.ttl <= 0) { removeMesh(G, st); P.spikeStrips.splice(i, 1); }
  }
  G.state.spikeAhead = spikeNear;

  // --- Bribe: on foot, wanted 1–2, within 8u of a cruiser, press B ---
  const bDown = !!(G.input && G.input.keys && G.input.keys.has('KeyB'));
  G.state.bribeAvailable = false;
  if (onFoot && wanted >= 1 && wanted <= 2 && nearestCar && nearest < 8 && !P.bribed) {
    G.state.bribeAvailable = true;
    if (bDown && !P.prevB) {
      const money = (typeof G.state.money === 'number') ? G.state.money : 0;
      if (money >= 500) {
        call(G, 'addMoney', -500);
        call(G, 'setWanted', wanted - 1);
        P.bribed = true;
        call(G, 'showBanner', 'BRIBE PAID', '-$500 — one star gone');
        call(G, 'playSound', 'cash');
      } else {
        call(G, 'showBanner', 'NOT ENOUGH CASH', 'A bribe costs $500');
      }
    }
  }
  P.prevB = bDown;
}

function garagePos(G) {
  try {
    const sp = G.city && G.city.spawnPoints && G.city.spawnPoints.garage;
    if (sp && typeof sp.x === 'number') return { x: sp.x, z: sp.z };
  } catch (e) {}
  return { x: -27, z: 42 };
}
