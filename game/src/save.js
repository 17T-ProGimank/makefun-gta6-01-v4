// SOLMARA round 6 — save v4: 3 slots, persists money, mission, respect,
// crew, garage, radio, stats, position, health, weapons, seagulls, races
// and district standing (new in v4). Loads v3 payloads, migrating missing
// districts to all 0. Keys stay solmara-save-v1/v2/v3 for slots 1/2/3.
import { RANKS } from './respect.js';

export const SAVE_KEYS = { 1: 'solmara-save-v1', 2: 'solmara-save-v2', 3: 'solmara-save-v3' };
export const SAVE_VERSION = 4;

function clampSlot(n) {
  const s = Number(n) || 1;
  return Math.max(1, Math.min(3, Math.floor(s)));
}

function clampNum(v, lo, hi, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}

function blankDistricts() {
  return { downtown: 0, port: 0, beach: 0, westside: 0, hills: 0 };
}

function readDistricts(raw) {
  const out = blankDistricts();
  if (raw && typeof raw === 'object') {
    for (const id of Object.keys(out)) {
      if (typeof raw[id] === 'number') out[id] = clampNum(raw[id], 0, 100, 0);
    }
  }
  return out;
}

function rankTitle(points) {
  let title = 'NOBODY';
  for (const r of (RANKS || [])) {
    if (points >= r.at) title = r.title;
  }
  return title;
}

function collectPayload(G) {
  const st = G.state || {};
  const seagulls = (G.collectibles && Array.isArray(G.collectibles.found))
    ? G.collectibles.found.slice(0, 12) : [];
  while (seagulls.length < 12) seagulls.push(false);
  const pos = (G.player && G.player.pos) || {};
  return {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    money: Math.max(0, Number(st.money) || 0),
    missionIndex: clampNum(st.missionIndex, 0, 14, 0),
    respect: Math.max(0, Number((G.respect && G.respect.points) || 0)),
    crew: Array.isArray(G.crew && G.crew.members) ? G.crew.members.slice() : [],
    garage: {
      owned: Array.isArray(G.garage && G.garage.owned) ? G.garage.owned.slice() : [],
      active: clampNum(G.garage && G.garage.active, 0, 3, 0)
    },
    radio: {
      station: clampNum(G.audio && G.audio.station, 0, 3, 0),
      radioOn: !!(G.audio && G.audio.radioOn)
    },
    stats: {
      kills: Math.max(0, Number(st.kills) || 0),
      carsStolen: Math.max(0, Number(st.carsStolen) || 0),
      missionsDone: Math.max(0, Number(st.missionsDone != null ? st.missionsDone : st.missionIndex) || 0),
      time: Math.max(0, Number(st.time) || 0)
    },
    player: {
      x: Number(pos.x) || 0,
      y: Number(pos.y) || 0,
      z: Number(pos.z) || 0,
      heading: Number((G.player && G.player.heading) || 0)
    },
    health: clampNum(st.health, 0, 100, 100),
    weapons: {
      owned: Array.isArray(G.weapons && G.weapons.owned) ? G.weapons.owned.slice() : ['pistol'],
      current: (G.weapons && G.weapons.current) || 'pistol'
    },
    seagulls: seagulls.map(function (b) { return !!b; }),
    raceBest: (G.raceBest != null ? G.raceBest : (G.race && G.race.best != null ? G.race.best : null)),
    racesWon: Math.max(0, Number(G.racesWon != null ? G.racesWon : (G.race && G.race.won) || 0)),
    districts: readDistricts(G.districts)
  };
}

function applyPayload(G, d) {
  if (!G.state) G.state = {};
  G.state.money = Math.max(0, Number(d.money) || 0);
  G.state.missionIndex = clampNum(d.missionIndex, 0, 14, 0);
  G.state.health = clampNum(d.health, 0, 100, 100);
  if (d.stats) {
    G.state.kills = Math.max(0, Number(d.stats.kills) || 0);
    G.state.carsStolen = Math.max(0, Number(d.stats.carsStolen) || 0);
    G.state.missionsDone = Math.max(0, Number(d.stats.missionsDone) || 0);
    G.state.time = Math.max(0, Number(d.stats.time) || 0);
  }
  if (!G.respect) G.respect = { points: 0 };
  G.respect.points = Math.max(0, Number(d.respect) || 0);
  if (!G.crew) G.crew = { members: [], active: null };
  G.crew.members = Array.isArray(d.crew) ? d.crew.slice() : [];
  if (!G.garage) G.garage = { owned: [], active: 0 };
  G.garage.owned = Array.isArray(d.garage && d.garage.owned) ? d.garage.owned.slice() : [];
  G.garage.active = clampNum(d.garage && d.garage.active, 0, 3, 0);
  if (!G.audio) G.audio = {};
  if (d.radio) {
    G.audio.station = clampNum(d.radio.station, 0, 3, 0);
    G.audio.radioOn = !!d.radio.radioOn;
  }
  if (d.player && G.player && G.player.pos) {
    if (typeof d.player.x === 'number') G.player.pos.x = d.player.x;
    if (typeof d.player.y === 'number') G.player.pos.y = d.player.y;
    if (typeof d.player.z === 'number') G.player.pos.z = d.player.z;
    if (typeof d.player.heading === 'number') G.player.heading = d.player.heading;
  }
  if (!G.weapons) G.weapons = { owned: ['pistol'], current: 'pistol' };
  if (d.weapons) {
    G.weapons.owned = Array.isArray(d.weapons.owned) && d.weapons.owned.length ? d.weapons.owned.slice() : ['pistol'];
    G.weapons.current = d.weapons.current || 'pistol';
    if (!G.weapons.owned.includes(G.weapons.current)) G.weapons.current = G.weapons.owned[0];
  }
  if (!G.collectibles) G.collectibles = { found: [] };
  G.collectibles.found = Array.isArray(d.seagulls)
    ? d.seagulls.slice(0, 12).map(function (b) { return !!b; })
    : new Array(12).fill(false);
  while (G.collectibles.found.length < 12) G.collectibles.found.push(false);
  G.raceBest = (d.raceBest != null ? d.raceBest : null);
  if (!G.race) G.race = { active: false };
  G.race.best = G.raceBest;
  G.racesWon = Math.max(0, Number(d.racesWon) || 0);
  G.race.won = G.racesWon;
  G.districts = readDistricts(d.districts);
  if (G.missions) {
    G.missions.currentIndex = G.state.missionIndex;
  }
  G.saveData = d;
}

export function saveGame(G, slot) {
  if (!G || typeof localStorage === 'undefined') return false;
  try {
    const s = clampSlot(slot != null ? slot : (G.save && G.save.slot) || 1);
    const payload = collectPayload(G);
    localStorage.setItem(SAVE_KEYS[s], JSON.stringify(payload));
    G.saveData = payload;
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame(G, slot) {
  if (!G || typeof localStorage === 'undefined') return false;
  try {
    const s = clampSlot(slot != null ? slot : (G.save && G.save.slot) || 1);
    const raw = localStorage.getItem(SAVE_KEYS[s]);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!d || typeof d !== 'object') return false;
    // v3 payloads have no districts field — readDistricts defaults all to 0.
    applyPayload(G, d);
    return true;
  } catch (e) {
    return false;
  }
}

export function listSaves() {
  const out = [];
  if (typeof localStorage === 'undefined') return [null, null, null];
  for (let s = 1; s <= 3; s++) {
    try {
      const raw = localStorage.getItem(SAVE_KEYS[s]);
      if (!raw) { out.push(null); continue; }
      const d = JSON.parse(raw);
      const districts = readDistricts(d.districts);
      const standing = Object.values(districts).reduce(function (a, b) { return a + b; }, 0);
      out.push({
        slot: s,
        money: Math.max(0, Number(d.money) || 0),
        missionIndex: clampNum(d.missionIndex, 0, 14, 0),
        rank: rankTitle(Math.max(0, Number(d.respect) || 0)),
        savedAt: d.savedAt || 0,
        standing: standing
      });
    } catch (e) {
      out.push(null);
    }
  }
  return out;
}

export function initSave(G) {
  if (!G) return;
  if (!G.save) G.save = {};
  G.save.slot = clampSlot(G.save.slot || 1);
  if (!G.helpers) G.helpers = {};
  G.helpers.saveGame = function (slot) { return saveGame(G, slot); };
  G.helpers.loadGame = function (slot) { return loadGame(G, slot); };
  G.helpers.listSaves = function () { return listSaves(); };
  G.helpers.setSlot = function (n) {
    G.save.slot = clampSlot(n);
    loadGame(G, G.save.slot);
    return G.save.slot;
  };
  loadGame(G, G.save.slot);
  if (typeof setInterval === 'function' && !G.save._autosaveId) {
    G.save._autosaveId = setInterval(function () {
      try {
        if (G.state && G.state.started && !G.state.paused && !G.state.gameOver) saveGame(G);
      } catch (e) {}
    }, 30000);
  }
}
