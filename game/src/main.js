// SOLMARA — round 6 entrypoint. Open-world crime game: 15 missions, crew,
// garage, respect ranks, district standing, 3-slot save, radio, street races,
// Golden Seagulls, spike strips, bribes, 3 weapons. Golden-hour coastal city.
import { CONFIG } from './config.js';
import { buildCity, randomRoadPos, clampToCity } from './city.js';
import { initDistrictStanding, updateDistrictStanding } from './districtStanding.js';
import { initPresence, updatePresence } from './presence.js';
import { initInput, updateInput } from './input.js';
import { initPlayer, updatePlayer } from './player.js';
import { makeCar, initVehicles, updateVehicles } from './vehicles.js';
import { initPedestrians, updatePedestrians } from './pedestrians.js';
import { initPolice, updatePolice } from './police.js';
import { MISSIONS, initMissions, updateMissions } from './missions.js';
import { initCrew, updateCrew } from './crew.js';
import { initGarage, updateGarage } from './garage.js';
import { initRespect, updateRespect } from './respect.js';
import { initCollectibles, updateCollectibles } from './collectibles.js';
import { initCombat, updateCombat } from './combat.js';
import { initEffects, updateEffects } from './effects.js';
import { initHUD, updateHUD } from './hud.js';
import { initAudio, updateAudio } from './audio.js';
import { initMenus, updateMenus } from './menus.js';
import { applyShot } from './shots.js';
import { initSave } from './save.js';

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.colors.skyTop);
scene.fog = new THREE.Fog(CONFIG.colors.skyHorizon, 140, 460);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(0, 8, 18);

const clock = new THREE.Clock();

// The shared game context every module receives.
const G = {
  scene, camera, renderer, clock,
  config: CONFIG,
  state: {
    money: CONFIG.money.start, wanted: 0, health: CONFIG.player.health,
    missionIndex: 0, objectiveText: '', objectiveTarget: null,
    started: false, paused: false, gameOver: false,
    time: 0, speed: 0, inVehicle: null, kills: 0, carsStolen: 0,
    spikeSlowUntil: 0, bribeAvailable: false, spikeAhead: false,
    lockpickProgress: 0, nearGarage: false, currentDistrict: 'downtown',
    shakeAmt: 0, shotCam: null, shotWanted: null, shotSpeed: null, shotName: null,
  },
  player: { group: null, pos: new THREE.Vector3(-27, 0, 42), heading: 0, speed: 0, onFoot: true, vy: 0, grounded: true },
  cars: [],
  peds: [],
  police: { cars: [], heli: null, roadblocks: [], spikeStrips: [], bribed: false },
  missions: { list: MISSIONS, currentIndex: 0, current: MISSIONS[0] || null },
  race: { active: false },
  collectibles: { found: [] },
  weapons: { owned: ['pistol'], current: 'pistol' },
  crew: { members: ['mara'], active: null },
  garage: { owned: [], active: 0 },
  respect: { points: 0 },
  districts: { downtown: 0, port: 0, beach: 0, westside: 0, hills: 0 },
  save: { slot: 1 },
  audio: { ctx: null, master: null, radioOn: false, station: 0 },
  hud: { el: {} },
  city: { bounds: 210, roads: [], spawnPoints: { garage: { x: -27, z: 42 }, beach: { x: 0, z: 168 }, downtown: { x: 0, z: 0 } } },
  input: { keys: new Set(), mouseDX: 0 },
  helpers: {},
  effects: { pool: [], shakeAmt: 0 },
};
window.__SOLMARA_G__ = G;

// Build the city first so every module can read spawn points and roads.
buildCity(G);

initInput(G);
initPlayer(G);
initVehicles(G);
initPedestrians(G);
initPolice(G);
initMissions(G);
initCrew(G);
initGarage(G);
initRespect(G);
initDistrictStanding(G);
initPresence(G);
initCollectibles(G);
initCombat(G);
initEffects(G);
initHUD(G);
initAudio(G);
initMenus(G);
initSave(G);

// Guarantee a player car exists near the Ember Garage for the opening pose.
if (!G.cars.some((c) => c && c.kind === 'player')) {
  const car = makeCar(G, 0xff6a00, 'player');
  if (car) {
    const gp = (G.city.spawnPoints && G.city.spawnPoints.garage) || { x: -27, z: 42 };
    car.pos.set(gp.x + 4, 0, gp.z + 3);
    car.heading = -Math.PI / 2;
    if (car.group) car.group.position.copy(car.pos);
    G.cars.push(car);
  }
}

const followTarget = new THREE.Vector3();
const desiredCam = new THREE.Vector3();
const lookPoint = new THREE.Vector3();

function updateCamera(dt) {
  // A screenshot pose pins the camera; the pose is re-asserted every frame
  // so the world updates underneath it cannot drift it away.
  if (G.state.shotCam) {
    const sc = G.state.shotCam;
    camera.position.set(sc.x, sc.y, sc.z);
    camera.lookAt(sc.lx, sc.ly, sc.lz);
    return;
  }
  const car = G.state.inVehicle;
  if (car && car.pos) followTarget.copy(car.pos);
  else if (G.player.pos) followTarget.copy(G.player.pos);
  else followTarget.set(0, 0, 0);
  const heading = car ? car.heading : G.player.heading;
  const dist = CONFIG.camera.dist;
  const height = CONFIG.camera.height;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  desiredCam.set(
    followTarget.x - fx * dist,
    followTarget.y + height,
    followTarget.z - fz * dist,
  );
  const k = 1 - Math.exp(-6 * dt);
  camera.position.lerp(desiredCam, k);
  lookPoint.set(followTarget.x, followTarget.y + CONFIG.camera.lookHeight, followTarget.z);
  camera.lookAt(lookPoint);
}

function applyShotState() {
  // Keep a screenshot pose honest for the whole capture window: the race
  // car keeps its speed and the wanted level cannot decay mid-shot.
  if (G.state.shotSpeed != null) {
    const car = G.state.inVehicle || G.cars.find((c) => c && c.kind === 'player');
    if (car) car.speed = G.state.shotSpeed;
  }
  if (G.state.shotWanted != null) G.state.wanted = G.state.shotWanted;
  // The race pose must keep its timer on the HUD for the whole capture:
  // a finished race hides the timer, so hold the race open while posing.
  if (G.state.shotName === 'cover' && G.race) G.race.active = true;
}

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!G.state.paused && G.state.started && !G.state.gameOver) {
    G.state.time += dt;
    updateInput(G, dt);
    updatePlayer(G, dt);
    updateVehicles(G, dt);
    updatePedestrians(G, dt);
    updatePolice(G, dt);
    updateMissions(G, dt);
    updateCrew(G, dt);
    updateGarage(G, dt);
    updateRespect(G, dt);
    updateDistrictStanding(G, dt);
    updatePresence(G, dt);
    updateCollectibles(G, dt);
    updateCombat(G, dt);
    updateEffects(G, dt);
    updateHUD(G, dt);
    updateAudio(G, dt);
    updateMenus(G, dt);
    applyShotState();
  } else {
    updateMenus(G, dt);
    updateHUD(G, dt);
    updateAudio(G, dt);
  }
  updateCamera(G.state.started ? dt : 0.016);
  const shake = G.effects.shakeAmt || G.state.shakeAmt || 0;
  if (shake > 0.01) {
    camera.position.x += (Math.random() - 0.5) * shake * 0.35;
    camera.position.y += (Math.random() - 0.5) * shake * 0.35;
    if (G.effects.shakeAmt > 0) G.effects.shakeAmt = Math.max(0, G.effects.shakeAmt - dt * 3);
    if (G.state.shakeAmt > 0) G.state.shakeAmt = Math.max(0, G.state.shakeAmt - dt * 3);
  }
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.state.started && !G.state.gameOver) G.state.paused = true;
});

// Screenshot hook: ?shot=cover|mission|activity|city poses the game 1.2s in.
setTimeout(() => {
  const shot = new URLSearchParams(location.search).get('shot');
  if (!shot) return;
  G.state.started = true;
  const startMenu = document.getElementById('menu-start');
  if (startMenu) startMenu.style.display = 'none';
  try { applyShot(G, shot); } catch (err) { console.error('applyShot failed', err); }
}, 1200);

frame();
