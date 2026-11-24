// SOLMARA — Dante Reyes on foot. Simple box-built figure (boxes + sphere
// head), no external model. WASD moves, Shift runs, Space jumps, E enters or
// exits the nearest car. Heals inside the safehouse.
import { isDown } from './input.js';
import { inSafehouse } from './city.js';

const WALK = 6;
const RUN = 10;

function buildFigure(G) {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98a5e, roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0x2e6f8e, roughness: 0.7 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.8 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x1c1410, roughness: 0.9 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.34), shirt);
  torso.position.y = 1.05;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), skin);
  head.position.y = 1.68;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5), hair);
  cap.position.y = 1.88;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), pants);
  legL.position.set(-0.16, 0.36, 0);
  legL.castShadow = true;
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.16;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.66, 0.2), shirt);
  armL.position.set(-0.42, 1.05, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.42;
  group.add(armR);
  group.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  G.player.legs = [legL, legR];
  G.player.arms = [armL, armR];
  return group;
}

export function initPlayer(G) {
  const spawn = (G.city.spawnPoints && G.city.spawnPoints.garage) || { x: -27, z: 42 };
  G.player.pos.set(spawn.x, 0, spawn.z);
  G.player.heading = Math.PI;
  G.player.speed = 0;
  G.player.onFoot = true;
  G.player.vy = 0;
  G.player.grounded = true;
  G.player.group = buildFigure(G);
  G.player.group.position.copy(G.player.pos);
  G.scene.add(G.player.group);
  G.player._eWasDown = false;
  G.player._walkPhase = 0;
}

function nearestCar(G, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of G.cars || []) {
    if (!car || !car.pos) continue;
    const d = car.pos.distanceTo(G.player.pos);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function tryEnterExit(G) {
  const eDown = isDown(G, 'KeyE');
  if (eDown && !G.player._eWasDown) {
    if (G.player.onFoot) {
      const car = nearestCar(G, 4.5);
      if (car) {
        G.state.inVehicle = car;
        G.player.onFoot = false;
        G.player.pos.copy(car.pos);
        G.player.group.visible = false;
        G.state.carsStolen = (G.state.carsStolen || 0) + 1;
        if (G.helpers.addRespect) { try { G.helpers.addRespect(2); } catch (e) { /* respect is optional */ } }
        if (G.helpers.playSound) { try { G.helpers.playSound('engine'); } catch (e) { /* sound is optional */ } }
      }
    } else {
      const car = G.state.inVehicle;
      G.state.inVehicle = null;
      G.player.onFoot = true;
      if (car && car.pos) {
        const side = 2.2;
        G.player.pos.set(car.pos.x + Math.cos(car.heading) * side, 0, car.pos.z - Math.sin(car.heading) * side);
      }
      G.player.group.visible = true;
      G.player.group.position.copy(G.player.pos);
    }
  }
  G.player._eWasDown = eDown;
}

export function updatePlayer(G, dt) {
  // While driving, Dante rides with the car; vehicles.js owns the physics.
  if (!G.player.onFoot) {
    const car = G.state.inVehicle;
    if (car && car.pos) {
      G.player.pos.copy(car.pos);
      G.player.heading = car.heading;
    }
    return;
  }
  tryEnterExit(G);
  if (!G.player.onFoot) return;

  const run = isDown(G, 'ShiftLeft') || isDown(G, 'ShiftRight');
  const speed = run ? RUN : WALK;
  let fx = 0, fz = 0;
  if (isDown(G, 'KeyW') || isDown(G, 'ArrowUp')) { fx += Math.sin(G.player.heading); fz += Math.cos(G.player.heading); }
  if (isDown(G, 'KeyS') || isDown(G, 'ArrowDown')) { fx -= Math.sin(G.player.heading); fz -= Math.cos(G.player.heading); }
  if (isDown(G, 'KeyA') || isDown(G, 'ArrowLeft')) G.player.heading += 2.6 * dt;
  if (isDown(G, 'KeyD') || isDown(G, 'ArrowRight')) G.player.heading -= 2.6 * dt;
  const len = Math.hypot(fx, fz);
  if (len > 0) {
    fx /= len; fz /= len;
    G.player.pos.x += fx * speed * dt;
    G.player.pos.z += fz * speed * dt;
    G.player.speed = speed;
    G.player._walkPhase += dt * speed * 1.6;
    const swing = Math.sin(G.player._walkPhase) * 0.45;
    if (G.player.legs) {
      G.player.legs[0].rotation.x = swing;
      G.player.legs[1].rotation.x = -swing;
    }
    if (G.player.arms) {
      G.player.arms[0].rotation.x = -swing * 0.7;
      G.player.arms[1].rotation.x = swing * 0.7;
    }
  } else {
    G.player.speed = 0;
    if (G.player.legs) { G.player.legs[0].rotation.x = 0; G.player.legs[1].rotation.x = 0; }
  }

  // Small hop: Space jumps only from the ground. A held Space must not
  // re-trigger on landing, so require the key to be freshly pressed.
  const spaceDown = isDown(G, 'Space');
  if (spaceDown && !G.player._spaceWasDown && G.player.grounded) {
    G.player.vy = 5.5;
    G.player.grounded = false;
  }
  G.player._spaceWasDown = spaceDown;
  if (!G.player.grounded) {
    G.player.vy -= 16 * dt;
    G.player.pos.y += G.player.vy * dt;
    if (G.player.pos.y <= 0) {
      G.player.pos.y = 0;
      G.player.vy = 0;
      G.player.grounded = true;
    }
  }

  // Safehouse heal: +10/s while inside the safehouse zone.
  try {
    if (inSafehouse(G)) {
      G.state.health = Math.min(100, (G.state.health || 100) + 10 * dt);
    }
  } catch (e) { /* safehouse check is defensive */ }

  if (G.city && G.city.bounds) {
    const b = G.city.bounds - 2;
    G.player.pos.x = Math.max(-b, Math.min(b, G.player.pos.x));
    G.player.pos.z = Math.max(-b, Math.min(b, G.player.pos.z));
  }
  G.player.group.position.copy(G.player.pos);
  G.player.group.rotation.y = G.player.heading;
}
