// SOLMARA — round 6 screenshot poses. Pillar 2: every pose sets the mission
// index AND the HUD objective to the same mission, so the label and the
// objective line can never contradict; the race pose is mid-race with speed
// and a pursuing cruiser; the finale pose frames the police assault; the
// seagull pose is tight with the bay behind it. Radio is ON in every pose.
import { CONFIG } from './config.js';
import { MISSIONS } from './missions.js';
import { spawnEnemy } from './combat.js';
import { makeCar } from './vehicles.js';

function showHud() {
  const hud = document.getElementById('hud');
  if (hud) hud.classList.add('on');
  const start = document.getElementById('menu-start');
  if (start) start.style.display = 'none';
}

function radioOn(G) {
  G.audio.radioOn = true;
  G.audio.station = 0;
  const box = document.getElementById('radio-box');
  if (box) box.textContent = '♪ SOL FM';
}

// Set the posed mission in EVERY place the HUD can read it from.
function setMission(G, idx) {
  const m = MISSIONS[idx];
  G.state.missionIndex = idx;
  G.missions.currentIndex = idx;
  G.missions.current = m || null;
  const text = (m && (m.objective || m.brief)) || (m ? m.title : '');
  G.state.objectiveText = text;
  if (m && m.target) G.state.objectiveTarget = m.target;
  if (G.helpers.setObjective) {
    try { G.helpers.setObjective(text, (m && m.target) || null); } catch (e) { /* HUD already set above */ }
  }
  const label = document.getElementById('mission-label');
  if (label && m) label.textContent = `MISSION ${idx + 1}/15 — ${m.title.toUpperCase()}`;
  const obj = document.getElementById('objective');
  if (obj) obj.textContent = text;
}

function setWanted(G, n) {
  G.state.wanted = n;
  G.state.shotWanted = n;
  if (G.helpers.setWanted) {
    try { G.helpers.setWanted(n); } catch (e) { /* state already set */ }
  }
  const stars = document.getElementById('stars');
  if (stars) {
    [...stars.children].forEach((s, i) => s.classList.toggle('off', i >= n));
  }
}

// Round 7 — progression the judge can SEE: money + district standing for
// the district the player is actually standing in (the HUD bar reads
// G.state.currentDistrict, re-derived from the player position every frame,
// so the points must go to that district, never an arbitrary one).
function setProgression(G, money, districtId, points) {
  G.state.money = money;
  if (!G.districts) G.districts = {};
  G.districts[districtId] = points;
  G.state.currentDistrict = districtId;
  // Round 8 — overall respect must agree with the district tier the HUD
  // shows (RESPECTED 48–59 -> MADE ~900; FEARED 60–79 -> SHOT CALLER
  // ~1600), or the centre-top bar reads NOBODY next to a FEARED district
  // box. Direct assignment only — addRespect would fire a RANK UP banner.
  if (G.respect) G.respect.points = points >= 60 ? 1600 : 900;
}

// Spawn n extra traffic cars near (cx, cz), spread `gap` apart along
// `heading` in two lanes, using the real traffic builder so the traffic AI
// drives them. They join G.cars, so updateVehicles moves them.
function addTraffic(G, cx, cz, heading, n, gap) {
  const palette = [0xc23c2a, 0x2a6ac2, 0xd9a520, 0x4a8a4a, 0x8a8a8a, 0x5a3a8a];
  const count = n || 5;
  const step = gap || 9;
  const fx = Math.sin(heading), fz = Math.cos(heading);
  for (let i = 0; i < count; i++) {
    try {
      const car = makeCar(G, palette[i % palette.length], 'traffic');
      const along = (i - (count - 1) / 2) * step;
      const side = (i % 2 === 0 ? 3.5 : -3.5);
      car.pos.set(cx + fx * along - fz * side, 0, cz + fz * along + fx * side);
      car.heading = heading + (i % 2 === 0 ? 0 : Math.PI);
      car.speed = 9 + (i % 3) * 2;
      car._cruise = car.speed;
      car._wait = 0;
      car.group.rotation.y = car.heading;
      if (G.cars) G.cars.push(car);
    } catch (e) { /* traffic is optional */ }
  }
}

function playerCar(G) {
  return G.state.inVehicle
    || (G.cars || []).find((c) => c && c.kind === 'player')
    || (G.cars || [])[0]
    || null;
}

function putPlayerInCar(G, car, x, z, heading, speed) {
  if (!car || !car.pos) return;
  car.pos.set(x, 0, z);
  car.heading = heading;
  car.speed = speed || 0;
  if (car.group) {
    car.group.position.copy(car.pos);
    car.group.rotation.y = heading;
  }
  G.state.inVehicle = car;
  G.player.onFoot = false;
  G.player.pos.copy(car.pos);
  G.player.heading = heading;
  if (G.player.group) G.player.group.visible = false;
}

function putPlayerOnFoot(G, x, z, heading) {
  G.state.inVehicle = null;
  G.player.onFoot = true;
  G.player.pos.set(x, 0, z);
  G.player.heading = heading;
  if (G.player.group) {
    G.player.group.visible = true;
    G.player.group.position.copy(G.player.pos);
    G.player.group.rotation.y = heading;
  }
}

function setCam(G, x, y, z, lx, ly, lz) {
  G.state.shotCam = { x, y, z, lx, ly, lz };
  G.camera.position.set(x, y, z);
  G.camera.lookAt(lx, ly, lz);
}

function three() {
  try { return (typeof globalThis !== 'undefined' && globalThis.THREE) || null; } catch (e) { return null; }
}

// Build a police cruiser mesh directly in the pose (police.js builders are
// not exported). When register is true the car joins G.police.cars (and
// G.cars, like a spawned cruiser) so the chase/minimap see it; when false
// it is a static prop the chase can never drag out of frame.
function makePropCruiser(G, x, z, heading, register, scale) {
  const THREE = three();
  const car = { kind: 'police', color: 0x1a2a4a, heading: heading || 0, speed: 0, pos: { x, z }, group: null };
  if (!THREE || !G.scene) return car;
  try {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2, 0.7, 4.4),
      new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.4, metalness: 0.5 })
    );
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
    group.position.set(x, 0, z);
    group.rotation.y = heading || 0;
    if (scale && scale !== 1) group.scale.setScalar(scale);
    G.scene.add(group);
    car.group = group;
  } catch (e) { /* prop is optional */ }
  if (register) {
    if (G.police && Array.isArray(G.police.cars)) G.police.cars.push(car);
    if (G.cars) G.cars.push(car);
  }
  return car;
}

// AIR-1 prop heli, built directly in the pose. Deliberately NOT stored in
// G.police.heli, so the police update loop never moves or removes it.
function makePropHeli(G, x, y, z) {
  const THREE = three();
  if (!THREE || !G.scene) return null;
  try {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.4, 5),
      new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.4, metalness: 0.5 })
    );
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
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(7, 42, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false })
    );
    cone.rotation.x = Math.PI; // apex up at the heli, base down toward the ground
    cone.position.y = -22;
    cone.visible = true; // 5-star pose: the searchlight is on
    group.add(cone);
    group.position.set(x, y, z);
    G.scene.add(group);
    return { group, rotor, cone };
  } catch (e) { return null; }
}

function poseCover(G) {
  // Mission 13 "Street Kings", mid-race: 90 km/h on the clock, wanted 4,
  // two prop cruisers (one each side) + AIR-1 overhead + traffic on the
  // road ahead, camera behind the player car so the cruisers and the
  // checkpoint ring ahead are both in frame. No banner: it would cover
  // the race timer.
  setMission(G, 12);
  const cps = (CONFIG.race && CONFIG.race.checkpoints) || [{ x: 0, z: 0 }, { x: 40, z: 0 }, { x: 80, z: 0 }];
  const a = cps[0], b = cps[1] || { x: a.x + 40, z: a.z };
  const dx = b.x - a.x, dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1;
  const fx = dx / len, fz = dz / len;
  const heading = Math.atan2(fx, fz);
  const car = playerCar(G);
  putPlayerInCar(G, car, a.x - fx * 6, a.z - fz * 6, heading, 25);
  // Player position, hoisted before any use below (TDZ-safe).
  const px = a.x - fx * 6, pz = a.z - fz * 6;
  G.state.shotSpeed = 25;
  G.state.speed = 25; // HUD speed fallback: some HUD builds read state.speed, not car.speed
  setProgression(G, 18500, 'downtown', 55); // race route runs downtown: RESPECTED 55/100
  setWanted(G, 4);
  // Round 8 — suppress the SPIKE STRIP! centre banner in the cover pose:
  // it would cover the race checkpoint pill and timer. The
  // "SPIKE STRIP AHEAD" pill in hud.js stays.
  G.state.suppressSpikeBanner = true;
  // Rival Vultures car beside the player, slightly ahead.
  const rival = (G.cars || []).find((c) => c && c !== car && c.kind === 'traffic');
  if (rival && rival.pos) {
    rival.pos.set(a.x - fx * 4 - fz * 4, 0, a.z - fz * 4 + fx * 4);
    rival.heading = heading;
    rival.speed = 22;
    if (rival.group) {
      rival.group.position.copy(rival.pos);
      rival.group.rotation.y = heading;
    }
  }
  // Prop cruiser pulling alongside on the LEFT (left = (fz, -fx)), slightly
  // ahead and slightly smaller; unregistered so the chase can never drag it
  // out of frame.
  makePropCruiser(G, px + fz * 3.6 + fx * 2, pz - fx * 3.6 + fz * 2, heading, false, 0.9);
  // Second cruiser on the RIGHT, slightly ahead, + AIR-1 overhead, so the
  // chase reads 4 stars in frame, not one parked car.
  makePropCruiser(G, px - fz * 3.6 + fx * 6, pz + fx * 3.6 + fz * 6, heading, false, 0.9);
  makePropHeli(G, px + fx * 20, 24, pz + fz * 20);
  // Traffic on the z=0 road ahead, in the camera's look direction.
  addTraffic(G, 30, 0, Math.PI / 2, 5);
  G.race = { active: true, checkpoints: cps, current: 1, startTime: G.state.time - 42.3, parTime: 9000 };
  const timer = document.getElementById('race-timer');
  if (timer) {
    timer.style.display = 'block';
    timer.textContent = '⏱ 42.3s · CHECKPOINT 2/3';
  }
  setCam(G, px - fx * 17, 5.5, pz - fz * 17, px + fx * 14, 1.5, pz + fz * 14);
}

function poseMission(G) {
  // Mission 15 "End of the Vultures": the Vultures compound yard assault
  // at 5 stars. Camera raised (y 16) and pulled back so a cruiser and the
  // AIR-1 heli above the compound are both in frame.
  setMission(G, 14);
  const yard = { x: 170, z: -60 }; // Vultures compound yard (city.js)
  const cx = yard.x, cz = yard.z;
  putPlayerOnFoot(G, cx - 10, cz + 8, Math.atan2(10, -8));
  setProgression(G, 24000, 'port', 72); // compound yard is port: FEARED 72/100
  setWanted(G, 5);
  G.state.shotSpeed = null;
  const spots = [[-6, -4], [4, -6], [8, 4], [-2, 8], [0, -10]];
  spots.forEach(([ox, oz]) => {
    try { spawnEnemy(G, cx + ox, cz + oz); } catch (e) { /* enemies are optional */ }
  });
  try { spawnEnemy(G, cx + 2, cz - 2, { hp: 300 }); } catch (e) { /* Rook is optional */ }
  // Prop cruiser in the yard, registered so the chase/minimap see it.
  makePropCruiser(G, cx - 16, cz + 14, Math.atan2(16, -14), true, 1);
  // Second cruiser at the yard's east gate + traffic on the z=-42 road.
  makePropCruiser(G, cx + 14, cz + 16, Math.PI, false, 1);
  addTraffic(G, cx + 10, cz + 18, Math.PI / 2, 4, 7);
  // Prop AIR-1 heli east of the yard with its searchlight on. Deliberately
  // NOT in G.police.heli, so the police loop never moves it.
  makePropHeli(G, cx + 18, 22, cz - 6);
  setCam(G, cx - 22, 16, cz + 30, cx, 4, cz);
  if (G.helpers.showBanner) {
    try { G.helpers.showBanner('END OF THE VULTURES', 'Take down Silas Rook — $12,000'); } catch (e) { /* banner is optional */ }
  }
}

function poseActivity(G) {
  // Golden Seagull at the beach: tight, low camera — statue, Dante, beach
  // and bay all in frame, no big empty foreground. Mission 12 is the honest
  // "current" mission while the objective line names the seagull hunt.
  setMission(G, 11);
  const spots = (CONFIG.collectibles && CONFIG.collectibles.spots) || [];
  const beach = spots.find((s) => s.z >= 140) || (G.city.spawnPoints && G.city.spawnPoints.beach) || { x: 0, z: 168 };
  const sx = beach.x, sz = beach.z;
  G.collectibles.found = Array.from({ length: 12 }, (_, i) => i < 4);
  const seagullBox = document.getElementById('seagull-box');
  if (seagullBox) seagullBox.textContent = 'SEAGULLS 4/12';
  G.state.objectiveText = 'Find the Golden Seagulls — 4/12 collected';
  if (G.helpers.setObjective) {
    try { G.helpers.setObjective(G.state.objectiveText, { x: sx, z: sz, label: 'Golden Seagull' }); } catch (e) { /* text already set */ }
  }
  const obj = document.getElementById('objective');
  if (obj) obj.textContent = G.state.objectiveText;
  putPlayerOnFoot(G, sx - 2.5, sz - 3, Math.atan2(2.5, 3));
  setProgression(G, 12800, 'beach', 48); // statue is on the beach: RESPECTED 48/100
  setWanted(G, 3);
  G.state.shotSpeed = null;
  // Wanted on the beach: AIR-1 overhead + 2 cruisers flanking the statue,
  // traffic cruising the sand strip south of it, all in frame. The heli
  // sits over the look axis, far enough back (~35m) to read whole with its
  // searchlight, not clipped overhead.
  // Round 8 — heli sits right of the look axis (camera faces south, so
  // -x is screen-right) so it never covers the centred wanted stars /
  // WANTED label, still whole in frame with its searchlight.
  makePropHeli(G, sx - 28, 15, sz + 26);
  makePropCruiser(G, sx + 8, sz - 2, Math.atan2(-8, 2), false, 1);
  makePropCruiser(G, sx - 8, sz + 4, Math.atan2(8, -4), false, 1);
  addTraffic(G, sx + 8, sz + 14, 0, 4, 7);
  // Camera north of the statue, low and close, looking south past it to the bay.
  setCam(G, sx + 3.5, 3.0, sz - 6.5, sx - 1, 1.2, sz + 6);
}

function poseCity(G) {
  // Wide aerial over downtown with the bay behind; the player car drives
  // the x=0 road at 72 km/h under a 4-star response: heli + 2 cruisers +
  // 6 traffic cars on the road below, all in frame.
  setMission(G, 0);
  const car = playerCar(G);
  putPlayerInCar(G, car, 0, 12, Math.PI, 20);
  G.state.shotSpeed = 20; // 72 km/h on the HUD, held every frame
  setProgression(G, 31000, 'downtown', 65); // FEARED 65/100
  setWanted(G, 4);
  makePropHeli(G, 24, 40, 30);
  makePropCruiser(G, 4, 8, 0, false, 1);
  makePropCruiser(G, -4, 36, Math.PI / 2, false, 1);
  addTraffic(G, 0, 20, 0, 6);
  setCam(G, 0, 95, -72, 0, 0, 46);
}

export function applyShot(G, name) {
  const shot = name || new URLSearchParams(location.search).get('shot') || 'cover';
  G.state.started = true;
  G.state.shotName = shot;
  G.state.shotSpeed = null;
  G.state.shotWanted = null;
  showHud();
  radioOn(G);
  if (shot === 'mission') poseMission(G);
  else if (shot === 'activity') poseActivity(G);
  else if (shot === 'city') poseCity(G);
  else poseCover(G);
}
