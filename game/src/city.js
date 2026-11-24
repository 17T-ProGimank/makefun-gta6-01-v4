// SOLMARA city — gta6-01 round 6 (session A).
// 420-unit coastal island city: downtown towers centre, port east, beach +
// bay south, hills north, westside residential west. Golden hour: warm low
// sun from the WEST, long shadows, streetlights on. No Rockstar/GTA material:
// every name, sign and landmark here is original to Solmara.
/* global THREE */
import { CONFIG, DISTRICTS } from './config.js';

const SIZE = 420;
const HALF = SIZE / 2;
const BLOCK = 42;

// Deterministic pseudo-random so every build renders the same city.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function box(w, h, d, color, x, y, z, opts) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: opts && opts.emissive ? opts.emissive : 0x000000,
    emissiveIntensity: opts && opts.emissiveIntensity ? opts.emissiveIntensity : 1,
    roughness: 0.9,
    metalness: 0.05,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  if (opts && opts.castShadow !== false) mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function textSign(text, w, h, bg, fg) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = fg; ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(canvas);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex })
  );
  return mesh;
}

function checkerTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#111111' : '#f5f5f5';
      ctx.fillRect(c * 16, r * 16, 16, 16);
    }
  }
  return new THREE.CanvasTexture(canvas);
}

// Soft cloud sprite: a few overlapping radial blobs on a transparent
// canvas, shared by every cloud billboard below.
function cloudTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  // Dense overlapping blobs: the first version's sparse puffs (mean alpha
  // ~25%) washed out against the orange sky — the plane read as a faint
  // glow, not a cloud. Full coverage with near-opaque cores.
  const blobs = [[40, 80, 58], [90, 55, 66], [140, 85, 62], [190, 60, 66], [222, 90, 52], [115, 98, 56], [160, 48, 46], [65, 102, 42], [205, 105, 44]];
  for (const [x, y, r] of blobs) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,246,232,0.5)');
    g.addColorStop(0.55, 'rgba(255,246,232,0.75)');
    g.addColorStop(1, 'rgba(255,246,232,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  return new THREE.CanvasTexture(canvas);
}

// District lookup: Pillar-1 rectangles, precedence BEACH -> HILLS -> PORT
// -> WESTSIDE -> DOWNTOWN (the order of DISTRICTS in config.js). Defensive
// default is 'downtown'.
export function districtAt(G, x, z) {
  const list = (G && G.config && G.config.districts) || DISTRICTS || [];
  for (const d of list) {
    const b = d.bounds || {};
    if (b.xMin !== undefined && x < b.xMin) continue;
    if (b.xMax !== undefined && x > b.xMax) continue;
    if (b.zMin !== undefined && z < b.zMin) continue;
    if (b.zMax !== undefined && z > b.zMax) continue;
    return d.id;
  }
  // Fallback if the config list is ever absent: the same rectangles, hardcoded.
  if (z >= 140) return 'beach';
  if (z <= -140) return 'hills';
  if (x >= 85) return 'port';
  if (x <= -85) return 'westside';
  return 'downtown';
}

export function seagullSpots(G) {
  const cfg = (G && G.config) || CONFIG;
  const spots = cfg.collectibles && cfg.collectibles.spots;
  return Array.isArray(spots) ? spots.slice() : [];
}

export function inSafehouse(G) {
  if (!G || !G.city || !G.city.safehouse || !G.player || !G.player.pos) return false;
  const s = G.city.safehouse;
  const dx = G.player.pos.x - s.x;
  const dz = G.player.pos.z - s.z;
  return dx * dx + dz * dz < 36; // within 6 units: heal zone
}

export function randomRoadPos(G) {
  const lines = [];
  for (let v = -168; v <= 168; v += BLOCK) lines.push(v);
  const along = lines[Math.floor(Math.random() * lines.length)];
  const across = (Math.random() * 2 - 1) * (HALF - 10);
  if (Math.random() < 0.5) return { x: along, z: across };
  return { x: across, z: along };
}

export function clampToCity(G, x, z) {
  const lim = HALF - 4;
  return {
    x: Math.max(-lim, Math.min(lim, x)),
    z: Math.max(-lim, Math.min(lim, z)),
  };
}

export function makeCheckpointRing(G, x, z, i) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(5, 0.35, 10, 32),
    new THREE.MeshStandardMaterial({
      color: 0xffc233, emissive: 0xaa7700, emissiveIntensity: 0.7,
      roughness: 0.35, metalness: 0.6,
    })
  );
  ring.position.set(x, 3.2, z);
  ring.castShadow = true;
  ring.userData.checkpointIndex = i;
  if (G && G.scene) G.scene.add(ring);
  return ring;
}

function buildRoads(G, group) {
  const cfg = (G && G.config) || CONFIG;
  const roadMat = new THREE.MeshStandardMaterial({ color: cfg.colors.road, roughness: 1 });
  const walkMat = new THREE.MeshStandardMaterial({ color: cfg.colors.sidewalk, roughness: 1 });
  const roads = [];
  for (let v = -168; v <= 168; v += BLOCK) {
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(cfg.city.roadWidth, SIZE), roadMat);
    ns.rotation.x = -Math.PI / 2; ns.position.set(v, 0.02, 0); ns.receiveShadow = true;
    group.add(ns);
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, cfg.city.roadWidth), roadMat);
    ew.rotation.x = -Math.PI / 2; ew.position.set(0, 0.02, v); ew.receiveShadow = true;
    group.add(ew);
    // Sidewalk strips flanking each road.
    const sw1 = new THREE.Mesh(new THREE.PlaneGeometry(3, SIZE), walkMat);
    sw1.rotation.x = -Math.PI / 2; sw1.position.set(v + 7.5, 0.015, 0); sw1.receiveShadow = true;
    group.add(sw1);
    const sw2 = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, 3), walkMat);
    sw2.rotation.x = -Math.PI / 2; sw2.position.set(0, 0.015, v + 7.5); sw2.receiveShadow = true;
    group.add(sw2);
    roads.push({ axis: 'x', at: v }, { axis: 'z', at: v });
  }
  return roads;
}

function buildBuildings(G, group) {
  const cfg = (G && G.config) || CONFIG;
  const rnd = mulberry32(20261124);
  const palette = cfg.colors.buildingPalette;
  const lit = cfg.colors.windowLit;
  const dark = cfg.colors.windowDark;
  // Block centres sit halfway between road lines; skip the beach strip and
  // the port yard, which get their own landmarks.
  for (let bx = -168; bx <= 126; bx += BLOCK) {
    for (let bz = -168; bz <= 126; bz += BLOCK) {
      const cx = bx + BLOCK / 2;
      const cz = bz + BLOCK / 2;
      if (cz >= 130) continue; // beach strip
      if (cx >= 84) continue; // port warehouses, built separately
      const downtown = Math.abs(cx) < 85 && Math.abs(cz) < 140;
      const floors = downtown ? 6 + Math.floor(rnd() * 14) : 1 + Math.floor(rnd() * 3);
      const h = floors * 3.2;
      const w = 16 + rnd() * 10;
      const d = 16 + rnd() * 10;
      const color = palette[Math.floor(rnd() * palette.length)];
      const b = box(w, h, d, color, cx, h / 2, cz);
      group.add(b);
      // Lit windows: small emissive planes on the south face.
      const winRows = Math.min(floors, 8);
      for (let r = 0; r < winRows; r++) {
        for (let c = 0; c < 3; c++) {
          const win = new THREE.Mesh(
            new THREE.PlaneGeometry(1.6, 1.2),
            new THREE.MeshBasicMaterial({ color: rnd() < 0.55 ? lit : dark })
          );
          win.position.set(cx - w / 2 + 3 + c * (w - 6) / 2, 3 + r * 3, cz + d / 2 + 0.06);
          group.add(win);
        }
      }
    }
  }
}

function buildStreetlights(G, group) {
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.6, metalness: 0.7 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  for (let v = -168; v <= 168; v += BLOCK) {
    for (const s of [-84, 0, 84]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 8), lampMat);
      pole.position.set(v + 8, 3.5, s); pole.castShadow = true;
      group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), bulbMat);
      bulb.position.set(v + 8, 7.1, s);
      group.add(bulb);
      const light = new THREE.PointLight(0xffc27a, 12, 26, 1.8);
      light.position.set(v + 8, 7, s);
      group.add(light);
    }
  }
}

export function buildCity(G) {
  const cfg = (G && G.config) || CONFIG;
  const group = new THREE.Group();
  group.name = 'solmara-city';
  G.scene.add(group);

  // Sky: warm golden-hour gradient via background colour + fog, low sun.
  G.scene.background = new THREE.Color(cfg.colors.skyHorizon);
  G.scene.fog = new THREE.Fog(cfg.colors.skyHorizon, 180, 420);
  const hemi = new THREE.HemisphereLight(cfg.colors.skyTop, cfg.colors.ground, 0.75);
  G.scene.add(hemi);
  // Sun low in the WEST (-x): long shadows stretch east across the city.
  const sun = new THREE.DirectionalLight(cfg.colors.sun, 2.4);
  sun.position.set(-180, 55, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -220; sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220; sun.shadow.camera.bottom = -220;
  sun.shadow.camera.far = 600;
  G.scene.add(sun);
  G.scene.add(sun.target);

  // Sky props (round 7, fix G): the sun disc + clouds must sit INSIDE the
  // framed shots' frustums (FOV 62). Cameras: cover looks NW from (58,5,16),
  // mission looks ESE from (148,16,-30), activity looks S from (-56,3,164),
  // city aerial looks S-down from (0,95,-72). No single western sun is
  // visible in all four (mission/activity/city all face away from the west),
  // so the low-west sun disc sits on the cover camera's NW axis, and the
  // clouds are spread one pair per view axis: NW for cover, ESE for the
  // mission compound, S over the bay for activity + the aerial.
  // fog:false — the fog range (180-420) would wash them out at this distance.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(16, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false })
  );
  sunDisc.position.set(-200, 70, -40);
  sunDisc.lookAt(0, 20, 0);
  G.scene.add(sunDisc);
  const sunGlow = new THREE.Mesh(
    new THREE.CircleGeometry(28, 32),
    new THREE.MeshBasicMaterial({ color: 0xffc27a, transparent: true, opacity: 0.35, fog: false })
  );
  sunGlow.position.set(-201, 70, -40);
  sunGlow.lookAt(0, 20, 0);
  G.scene.add(sunGlow);
  const cloudTex = cloudTexture();
  const cloudMat = new THREE.MeshBasicMaterial({
    map: cloudTex, transparent: true, opacity: 0.3,
    depthWrite: false, fog: false, side: THREE.DoubleSide,
  });
  // Each cloud is two crossed planes: the vertical one reads from ground
  // cameras, the horizontal one from the aerial shot.
  const clouds = [
    { x: -70, y: 55, z: -100, w: 58 }, // cover: NW axis, near
    { x: -140, y: 70, z: -160, w: 68 }, // cover: NW axis, far
    { x: 215, y: 48, z: -100, w: 62 }, // mission: ESE of the compound, raised clear of the top HUD band
    { x: 285, y: 52, z: -130, w: 72 }, // mission: ESE, far, raised clear of the top HUD band
    { x: -95, y: 48, z: 250, w: 62 }, // activity: S over the bay, shifted left + raised clear of the top HUD band
    { x: 30, y: 40, z: 220, w: 72 }, // city aerial: S over the bay
  ];
  G.city = G.city || {};
  G.city.clouds = [];
  for (const c of clouds) {
    const v = new THREE.Mesh(new THREE.PlaneGeometry(c.w, c.w / 2), cloudMat);
    v.position.set(c.x, c.y, c.z);
    v.rotation.y = Math.atan2(-c.x, -c.z); // face the city centre
    group.add(v);
    const h = new THREE.Mesh(new THREE.PlaneGeometry(c.w, c.w / 2), cloudMat);
    h.rotation.x = -Math.PI / 2;
    h.position.set(c.x, c.y - 3, c.z);
    group.add(h);
    G.city.clouds.push(v, h);
  }

  // Ground, sand strip and sea.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(SIZE, SIZE),
    new THREE.MeshStandardMaterial({ color: cfg.colors.ground, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  group.add(ground);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(SIZE, 50),
    new THREE.MeshStandardMaterial({ color: cfg.colors.sand, roughness: 1 })
  );
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.01, 165); sand.receiveShadow = true;
  group.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(SIZE + 120, 120),
    new THREE.MeshStandardMaterial({ color: cfg.colors.sea, roughness: 0.25, metalness: 0.15 })
  );
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.005, 245);
  group.add(sea);

  const roads = buildRoads(G, group);
  buildBuildings(G, group);
  buildStreetlights(G, group);

  // --- Ember Garage + forecourt (4 marked parking bays) ---
  const garagePos = { x: -27, z: 42 };
  const garage = box(24, 9, 16, 0x7a4a2a, garagePos.x, 4.5, garagePos.z);
  group.add(garage);
  const garageSign = textSign('EMBER GARAGE', 18, 4, '#2a1a10', '#ffb347');
  garageSign.position.set(garagePos.x, 10.2, garagePos.z + 8.1);
  group.add(garageSign);
  const bayMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f5 });
  for (let i = 0; i < 4; i++) {
    const bx = garagePos.x - 18 + i * 12;
    const bay = new THREE.Mesh(new THREE.PlaneGeometry(9, 0.4), bayMat);
    bay.rotation.x = -Math.PI / 2; bay.position.set(bx, 0.03, garagePos.z + 16);
    group.add(bay);
    const bayEnd = new THREE.Mesh(new THREE.PlaneGeometry(9, 0.4), bayMat);
    bayEnd.rotation.x = -Math.PI / 2; bayEnd.position.set(bx, 0.03, garagePos.z + 26);
    group.add(bayEnd);
  }

  // --- Safehouse near the beach spawn (heal zone, see inSafehouse) ---
  const safehouse = { x: -20, z: 165 };
  const house = box(10, 5, 8, 0xe8dcc0, safehouse.x, 2.5, safehouse.z);
  group.add(house);
  const roof = box(11, 1, 9, 0x8a4a3c, safehouse.x, 5.5, safehouse.z);
  group.add(roof);
  const safeSign = textSign('SAFEHOUSE', 9, 2.2, '#1d3a2a', '#d9f2c0');
  safeSign.position.set(safehouse.x, 4.2, safehouse.z + 4.1);
  group.add(safeSign);

  // --- 4 shop fronts downtown (visual only) ---
  const shops = [
    { name: 'TIRE KING', x: -63, z: -21, bg: '#1a1a1a', fg: '#ffd27a' },
    { name: 'BURGER BAY', x: -21, z: 21, bg: '#7a2a1a', fg: '#ffe9a8' },
    { name: 'SOL SUN TAN', x: 21, z: -21, bg: '#0a4a6a', fg: '#ffe9a8' },
    { name: '24H MART', x: 63, z: 21, bg: '#1a4a2a', fg: '#e8ffd9' },
  ];
  for (const s of shops) {
    const front = box(18, 6, 10, 0x9a8a7a, s.x, 3, s.z);
    group.add(front);
    const sign = textSign(s.name, 16, 3.2, s.bg, s.fg);
    sign.position.set(s.x, 6.8, s.z + 5.1);
    group.add(sign);
  }

  // --- Port: warehouses, office (mission 14), Vultures compound yard ---
  const warehouseMat = new THREE.MeshStandardMaterial({ color: 0x6f7d8a, roughness: 0.85, metalness: 0.2 });
  for (const [wx, wz, ww, wd] of [[120, -60, 30, 20], [120, 20, 26, 18], [170, 80, 28, 20], [110, 130, 24, 16]]) {
    const wh = new THREE.Mesh(new THREE.BoxGeometry(ww, 10, wd), warehouseMat);
    wh.position.set(wx, 5, wz); wh.castShadow = true; wh.receiveShadow = true;
    group.add(wh);
  }
  // Port office building; its door is the mission-14 lockpick target.
  const office = box(18, 12, 14, 0x8a7a5c, 160, 6, 60);
  group.add(office);
  const officeSign = textSign('PORT OFFICE', 14, 2.8, '#24344a', '#d9e8ff');
  officeSign.position.set(160, 12.8, 60 + 7.1);
  group.add(officeSign);
  // Vultures' compound yard: fenced yard with extra crates (visual only).
  const yard = { x: 170, z: -60 };
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.8, metalness: 0.5 });
  for (let i = 0; i <= 8; i++) {
    for (const [fx, fz] of [[yard.x - 20 + i * 5, yard.z - 15], [yard.x - 20 + i * 5, yard.z + 15]]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 0.3), fenceMat);
      post.position.set(fx, 1.5, fz); post.castShadow = true;
      group.add(post);
    }
  }
  const railN = new THREE.Mesh(new THREE.BoxGeometry(40, 0.4, 0.2), fenceMat);
  railN.position.set(yard.x, 2.8, yard.z - 15); group.add(railN);
  const railS = railN.clone(); railS.position.set(yard.x, 2.8, yard.z + 15); group.add(railS);
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x8a6f3c, roughness: 0.9 });
  for (const [cx, cz] of [[yard.x - 10, yard.z - 6], [yard.x + 4, yard.z + 4], [yard.x + 12, yard.z - 8]]) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), crateMat);
    crate.position.set(cx, 1.5, cz); crate.castShadow = true;
    group.add(crate);
  }

  // --- Beach lifeguard hut (shotgun pickup spot) ---
  const hut = box(5, 4, 5, 0xf5f5f5, 40, 2, 175);
  group.add(hut);
  const hutRoof = box(6, 0.8, 6, 0xc23c2a, 40, 4.4, 175);
  group.add(hutRoof);

  // --- Race start pad at the port: checkered decal + arch ---
  const raceStart = (cfg.race && cfg.race.start) || { x: 130, z: 60 };
  const pad = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 8),
    new THREE.MeshBasicMaterial({ map: checkerTexture() })
  );
  pad.rotation.x = -Math.PI / 2; pad.position.set(raceStart.x, 0.04, raceStart.z);
  group.add(pad);
  const archMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.6 });
  for (const dx of [-7, 7]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 6, 10), archMat);
    post.position.set(raceStart.x + dx, 3, raceStart.z); post.castShadow = true;
    group.add(post);
  }
  const archTop = new THREE.Mesh(new THREE.BoxGeometry(15, 1, 0.8), archMat);
  archTop.position.set(raceStart.x, 6.2, raceStart.z); archTop.castShadow = true;
  group.add(archTop);
  const raceSign = textSign('STREET KINGS', 13, 2.6, '#111111', '#ffc233');
  raceSign.position.set(raceStart.x, 5.2, raceStart.z + 0.5);
  group.add(raceSign);

  // --- Checkpoint rings (gold torus) at the race checkpoints ---
  const rings = [];
  const checkpoints = (cfg.race && cfg.race.checkpoints) || [];
  checkpoints.forEach((cp, i) => rings.push(makeCheckpointRing(G, cp.x, cp.z, i)));

  // --- 12 Golden Seagull statues (gold bird on a plinth) ---
  const seagullMeshes = [];
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xffc233, emissive: 0x664400, emissiveIntensity: 0.5,
    roughness: 0.25, metalness: 0.85,
  });
  const plinthMat = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.9 });
  for (const spot of seagullSpots(G)) {
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1, 1.2, 10), plinthMat);
    plinth.position.set(spot.x, 0.6, spot.z); plinth.castShadow = true;
    group.add(plinth);
    const bird = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), goldMat);
    body.scale.set(1.6, 0.7, 0.7); body.castShadow = true;
    bird.add(body);
    const wingGeo = new THREE.BoxGeometry(0.9, 0.08, 1.6);
    const wingL = new THREE.Mesh(wingGeo, goldMat);
    wingL.position.set(0, 0.35, 0); wingL.rotation.z = 0.5; wingL.castShadow = true;
    bird.add(wingL);
    const wingR = new THREE.Mesh(wingGeo, goldMat);
    wingR.position.set(0, 0.35, 0); wingR.rotation.z = -0.5; wingR.rotation.y = Math.PI;
    wingR.castShadow = true;
    bird.add(wingR);
    // Vary each statue's facing so the row does not look stamped out.
    bird.rotation.y = (spot.x * 0.37 + spot.z * 0.11) % (Math.PI * 2);
    bird.position.set(spot.x, 1.7, spot.z);
    group.add(bird);
    seagullMeshes.push(bird);
  }

  // --- Weapon pickup crates (glowing) at the CONFIG spots ---
  const weaponCrates = {};
  const crateGlow = new THREE.MeshStandardMaterial({
    color: 0x2a4a6a, emissive: 0x2a9ad9, emissiveIntensity: 0.9, roughness: 0.4,
  });
  const spots = (cfg.weapons && cfg.weapons.spots) || {};
  for (const key of Object.keys(spots)) {
    const s = spots[key];
    const crate = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 2.2), crateGlow);
    crate.position.set(s.x, 0.7, s.z); crate.castShadow = true;
    group.add(crate);
    weaponCrates[key] = crate;
  }

  G.city = G.city || {};
  G.city.bounds = HALF;
  G.city.roads = roads;
  G.city.spawnPoints = {
    garage: { x: garagePos.x, z: garagePos.z },
    beach: { x: 0, z: 165 },
    downtown: { x: 10, z: -10 },
    office: { x: 160, z: 78 },
    raceStart: { x: raceStart.x, z: raceStart.z },
  };
  G.city.safehouse = safehouse;
  G.city.checkpointRings = rings;
  G.city.seagullMeshes = seagullMeshes;
  G.city.weaponCrates = weaponCrates;
  G.city.group = group;
  return group;
}
