// SOLMARA vehicles — gta6-01 round 6 (session A).
// Arcade player-car physics + road-grid traffic AI. Honours garage upgrades:
// opts {paint, upgrade} on makeCar set car.paint and car._upgradeTop (extra
// top speed). Spike strips slow the player car while G.state.spikeSlowUntil
// is in the future (read defensively — police.js may never set it).
/* global THREE */
import { CONFIG } from './config.js';
import { isDown } from './input.js';

// Top-speed bonus per garage upgrade level (matches GARAGE.upgrades top).
const UPGRADE_TOP = [0, 6, 12, 20];
const CAR_NAMES = ['Ember GT', 'Bay Runner', 'Port Hauler', 'Sunset Coupe'];

function keyDown(G, code) {
  try {
    if (typeof isDown === 'function') return isDown(G, code);
  } catch (e) { /* fall through to the raw key set */ }
  return !!(G && G.input && G.input.keys && G.input.keys.has(code));
}

export function makeCar(G, color, kind, opts) {
  const o = opts || {};
  // Garage paint wins over the passed colour; upgrade level adds top speed.
  const paint = o.paint !== undefined ? o.paint : color;
  const upgrade = o.upgrade ? Math.max(0, Math.min(3, o.upgrade | 0)) : 0;
  const bodyMat = new THREE.MeshStandardMaterial({
    color: paint, roughness: 0.35, metalness: 0.55,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x14181d, roughness: 0.6, metalness: 0.3 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x9ac8e8, roughness: 0.15, metalness: 0.4,
  });
  const group = new THREE.Group();
  group.name = 'car-' + (kind || 'traffic');

  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 4.4), bodyMat);
  body.position.y = 0.55; body.castShadow = true; body.receiveShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 2.2), glassMat);
  cabin.position.set(0, 1.2, -0.2); cabin.castShadow = true;
  group.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 2.2), bodyMat);
  roof.position.set(0, 1.55, -0.2); roof.castShadow = true;
  group.add(roof);
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, darkMat);
    wheel.position.set(wx, 0.38, wz); wheel.castShadow = true;
    group.add(wheel);
  }
  // Headlights (front, +z is forward) and taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const hx of [-0.6, 0.6]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.08), headMat);
    head.position.set(hx, 0.62, 2.21);
    group.add(head);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xd92020 });
  for (const tx of [-0.6, 0.6]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.08), tailMat);
    tail.position.set(tx, 0.62, -2.21);
    group.add(tail);
  }

  const car = {
    group,
    mesh: group,
    pos: group.position,
    heading: 0,
    speed: 0,
    color: paint,
    kind: kind || 'traffic',
    paint,
    upgrade,
    _upgradeTop: UPGRADE_TOP[upgrade] || 0,
    name: CAR_NAMES[Math.abs((paint | 0) + (kind || '').length) % CAR_NAMES.length],
    _turn: 0,
  };
  if (G && G.scene) G.scene.add(group);
  return car;
}

function roadLines() {
  const lines = [];
  for (let v = -168; v <= 168; v += 42) lines.push(v);
  return lines;
}

export function initVehicles(G) {
  const cfg = (G && G.config) || CONFIG;
  const count = (cfg.traffic && cfg.traffic.count) || 18;
  const lines = roadLines();
  const palette = [0xc23c2a, 0x2a6ac2, 0xd9a520, 0x4a8a4a, 0x8a8a8a, 0x5a3a8a, 0xd9d9d9];
  G.cars = G.cars || [];
  for (let i = 0; i < count; i++) {
    const along = lines[i % lines.length];
    const across = (Math.random() * 2 - 1) * 190;
    const color = palette[i % palette.length];
    const car = makeCar(G, color, 'traffic');
    const horizontal = i % 2 === 0;
    if (horizontal) {
      car.pos.set(across, 0, along);
      car.heading = Math.random() < 0.5 ? 0 : Math.PI;
    } else {
      car.pos.set(along, 0, across);
      car.heading = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    }
    car.speed = 8 + Math.random() * 6;
    car._cruise = car.speed;
    car._wait = 0;
    car.group.rotation.y = car.heading;
    G.cars.push(car);
  }
}

function updateTrafficCar(G, car, dt) {
  const cfg = (G && G.config) || CONFIG;
  // Random brief stops (traffic-light feel).
  if (car._wait > 0) {
    car._wait -= dt;
    car.speed = 0;
    return;
  }
  if (Math.random() < dt * 0.02) car._wait = 1 + Math.random() * 2;
  // Loose avoidance: slow down if the player car is close ahead.
  const playerCar = G.state && G.state.inVehicle;
  let target = car._cruise || 10;
  if (playerCar && playerCar.pos) {
    const dx = playerCar.pos.x - car.pos.x;
    const dz = playerCar.pos.z - car.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 10) {
      const fx = Math.sin(car.heading);
      const fz = Math.cos(car.heading);
      if (dx * fx + dz * fz > 0) target = 0;
    }
  }
  car.speed += (target - car.speed) * Math.min(1, dt * 2);
  const step = car.speed * dt;
  car.pos.x += Math.sin(car.heading) * step;
  car.pos.z += Math.cos(car.heading) * step;
  // At an intersection (near a crossing road line) sometimes turn.
  const nearX = Math.abs(((car.pos.x % 42) + 42) % 42) < 1.2 ||
    Math.abs(((car.pos.x % 42) + 42) % 42 - 42) < 1.2;
  const nearZ = Math.abs(((car.pos.z % 42) + 42) % 42) < 1.2 ||
    Math.abs(((car.pos.z % 42) + 42) % 42 - 42) < 1.2;
  if (nearX && nearZ && Math.random() < dt * 0.5) {
    const r = Math.random();
    if (r < 0.3) car.heading += Math.PI / 2;
    else if (r < 0.6) car.heading -= Math.PI / 2;
    // Snap back onto the road grid after a turn so cars never drift
    // diagonally off the roads over a long session.
    car.pos.x = Math.round(car.pos.x / 42) * 42;
    car.pos.z = Math.round(car.pos.z / 42) * 42;
  }
  // Wrap around the city edge instead of driving into the sea.
  if (car.pos.x > 205) car.pos.x = -205;
  if (car.pos.x < -205) car.pos.x = 205;
  if (car.pos.z > 205) car.pos.z = -205;
  if (car.pos.z < -205) car.pos.z = 205;
  car.group.rotation.y = car.heading;
}

function updatePlayerCar(G, car, dt) {
  const cfg = (G && G.config) || CONFIG;
  const carCfg = cfg.car || {};
  const accel = carCfg.accel || 20;
  const brake = carCfg.brake || 32;
  const baseTop = carCfg.maxSpeed || 40;
  const reverseMax = carCfg.reverseMax || 12;
  const turn = carCfg.turn || 2.4;
  let top = baseTop + (car._upgradeTop || 0);
  // Spike strip: speed x0.5 while the slow timer runs.
  const spikes = cfg.spikes || { slowFactor: 0.5 };
  if (G.state && G.state.spikeSlowUntil && G.state.time < G.state.spikeSlowUntil) {
    top *= spikes.slowFactor;
  }
  const forward = keyDown(G, 'KeyW') || keyDown(G, 'ArrowUp');
  const back = keyDown(G, 'KeyS') || keyDown(G, 'ArrowDown');
  const left = keyDown(G, 'KeyA') || keyDown(G, 'ArrowLeft');
  const right = keyDown(G, 'KeyD') || keyDown(G, 'ArrowRight');
  if (forward) car.speed += accel * dt;
  if (back) {
    if (car.speed > 0.5) car.speed -= brake * dt;
    else car.speed -= accel * 0.6 * dt;
  }
  if (!forward && !back) {
    // Engine drag + rolling resistance.
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  }
  car.speed = Math.max(-reverseMax, Math.min(top, car.speed));
  // Steering scales with speed; no steering while parked.
  const steer = (left ? 1 : 0) - (right ? 1 : 0);
  const steerAmt = steer * turn * dt * Math.min(1, Math.abs(car.speed) / 8);
  car.heading += steerAmt * Math.sign(car.speed || 1);
  const step = car.speed * dt;
  car.pos.x += Math.sin(car.heading) * step;
  car.pos.z += Math.cos(car.heading) * step;
  // Stay inside the city (beach edge is a soft wall, not the sea).
  const lim = 206;
  car.pos.x = Math.max(-lim, Math.min(lim, car.pos.x));
  car.pos.z = Math.max(-lim, Math.min(lim, car.pos.z));
  car.group.rotation.y = car.heading;
  if (G.state) G.state.speed = car.speed;
}

export function updateVehicles(G, dt) {
  if (!G || !G.cars) return;
  const playerCar = G.state && G.state.inVehicle;
  for (const car of G.cars) {
    if (!car || !car.pos) continue;
    if (playerCar && car === playerCar) updatePlayerCar(G, car, dt);
    else if (car.kind === 'traffic') updateTrafficCar(G, car, dt);
    // Police cars are driven by police.js; player cars not in use sit still.
  }
  // Keep the HUD speed honest when on foot.
  if (G.state && !playerCar) G.state.speed = 0;
}
