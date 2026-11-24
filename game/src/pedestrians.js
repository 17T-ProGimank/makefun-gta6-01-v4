// SOLMARA — pedestrians. 28 walkers (CONFIG.peds.count) strolling the
// sidewalks, wandering between blocks, fleeing explosions and police.
import { clampToCity } from './city.js';

const SHIRT_COLORS = [0xd95f4b, 0x4b8fd9, 0x7ac74f, 0xe8c84a, 0x9a6fd9, 0xe8e8e8, 0x3a3f4a, 0xd97aa8];

function buildPed(G, color) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98a5e, roughness: 0.8 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.3), shirt);
  torso.position.y = 1.0;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 10), skin);
  head.position.y = 1.58;
  head.castShadow = true;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.22), pants);
  legL.position.set(-0.14, 0.31, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.14;
  group.add(legR);
  group.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return { group, legL, legR };
}

function randomSidewalkPos(G) {
  const b = (G.city && G.city.bounds) || 210;
  // Sidewalks run along the road grid: snap near a block edge, not mid-road.
  const block = 42;
  const gx = (Math.floor(Math.random() * 9) - 4) * block;
  const gz = (Math.floor(Math.random() * 9) - 4) * block;
  const x = gx + (Math.random() < 0.5 ? -1 : 1) * (block / 2 - 4) + (Math.random() - 0.5) * 6;
  const z = gz + (Math.random() - 0.5) * (block - 12);
  const c = clampToCity(G, x, z);
  return { x: Math.max(-b + 4, Math.min(b - 4, c.x)), z: Math.max(-b + 4, Math.min(b - 4, c.z)) };
}

export function initPedestrians(G) {
  const count = (G.config.peds && G.config.peds.count) || 28;
  G.peds = [];
  for (let i = 0; i < count; i++) {
    const p = randomSidewalkPos(G);
    const color = SHIRT_COLORS[i % SHIRT_COLORS.length];
    const { group, legL, legR } = buildPed(G, color);
    group.position.set(p.x, 0, p.z);
    G.scene.add(group);
    G.peds.push({
      group, legL, legR,
      pos: new THREE.Vector3(p.x, 0, p.z),
      heading: Math.random() * Math.PI * 2,
      speed: 0.9 + Math.random() * 0.9,
      wanderT: 2 + Math.random() * 6,
      phase: Math.random() * Math.PI * 2,
      fleeing: false,
    });
  }
}

function nearestThreat(G, ped) {
  // Explosions and police cars both scatter the crowd.
  let threat = null;
  let bestD = 22;
  if (G.state.lastExplosion) {
    const d = ped.pos.distanceTo(G.state.lastExplosion);
    if (d < bestD) { bestD = d; threat = G.state.lastExplosion; }
  }
  for (const car of (G.police && G.police.cars) || []) {
    if (!car || !car.pos) continue;
    const d = ped.pos.distanceTo(car.pos);
    if (d < bestD) { bestD = d; threat = car.pos; }
  }
  return threat;
}

export function updatePedestrians(G, dt) {
  for (const ped of G.peds || []) {
    const threat = nearestThreat(G, ped);
    if (threat) {
      // Flee: run directly away from the threat.
      const away = Math.atan2(ped.pos.x - threat.x, ped.pos.z - threat.z);
      ped.heading = away;
      ped.fleeing = true;
    } else if (ped.fleeing) {
      ped.fleeing = false;
      ped.wanderT = 0;
    }
    ped.wanderT -= dt;
    if (ped.wanderT <= 0 && !ped.fleeing) {
      // Wander: pick a new heading, mostly along the street grid.
      const grid = Math.random() < 0.7;
      ped.heading = grid
        ? Math.floor(Math.random() * 4) * (Math.PI / 2) + (Math.random() - 0.5) * 0.3
        : Math.random() * Math.PI * 2;
      ped.wanderT = 3 + Math.random() * 7;
    }
    const speed = ped.fleeing ? ped.speed * 3.2 : ped.speed;
    ped.pos.x += Math.sin(ped.heading) * speed * dt;
    ped.pos.z += Math.cos(ped.heading) * speed * dt;
    const b = ((G.city && G.city.bounds) || 210) - 3;
    if (Math.abs(ped.pos.x) > b || Math.abs(ped.pos.z) > b) {
      ped.heading += Math.PI;
      ped.pos.x = Math.max(-b, Math.min(b, ped.pos.x));
      ped.pos.z = Math.max(-b, Math.min(b, ped.pos.z));
    }
    ped.phase += dt * speed * 5;
    const swing = Math.sin(ped.phase) * (ped.fleeing ? 0.7 : 0.5);
    ped.legL.rotation.x = swing;
    ped.legR.rotation.x = -swing;
    // Fleeing peds lean forward into the run.
    ped.group.rotation.x = ped.fleeing ? 0.12 : 0;
    ped.group.position.copy(ped.pos);
    ped.group.rotation.y = ped.heading;
  }
}
