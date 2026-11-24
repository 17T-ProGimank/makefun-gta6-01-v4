// SOLMARA — collectibles.js (round 6)
// 12 Golden Seagull statues across the districts. Walk/drive within 3 units
// to collect one: +$250, +10 respect, chime. All 12: +$2,000 bonus and the
// "GOLDEN GULL" banner. Round 6 adds district standing: +2 in the district
// where the statue stands (via G.helpers.districtAt / addDistrictStanding).

import { CONFIG } from './config.js';

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
function spotList(G) {
  try {
    if (G.city && typeof G.city.seagullSpots === 'function') {
      const spots = G.city.seagullSpots();
      if (Array.isArray(spots) && spots.length) return spots;
    }
  } catch (e) {}
  try {
    const spots = (G.config && G.config.collectibles && G.config.collectibles.spots)
      || (CONFIG && CONFIG.collectibles && CONFIG.collectibles.spots);
    if (Array.isArray(spots)) return spots;
  } catch (e) {}
  return [];
}
function loadSavedSeagulls(G) {
  try {
    if (G.saveData && Array.isArray(G.saveData.seagulls)) return G.saveData.seagulls.slice(0, 12);
  } catch (e) {}
  // Fall back to the save slots in localStorage (v1/v2/v3 keys, defensive).
  try {
    if (typeof localStorage !== 'undefined') {
      for (const key of ['solmara-save-v1', 'solmara-save-v2', 'solmara-save-v3']) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.seagulls)) return data.seagulls.slice(0, 12);
      }
    }
  } catch (e) {}
  return null;
}

export function initCollectibles(G) {
  if (!G) return;
  const saved = loadSavedSeagulls(G);
  const found = new Array(12).fill(false);
  if (saved) for (let i = 0; i < 12; i++) found[i] = !!saved[i];
  G.collectibles = { found };

  G.helpers.collectSeagull = (i) => {
    if (!G.collectibles || i < 0 || i >= 12) return;
    if (G.collectibles.found[i]) return;
    G.collectibles.found[i] = true;
    const spots = spotList(G);
    const spot = spots[i] || null;
    // District standing: +2 in the district where this statue stands.
    try {
      const d = (spot && typeof helpers(G).districtAt === 'function')
        ? helpers(G).districtAt(spot.x, spot.z)
        : null;
      if (d && typeof helpers(G).addDistrictStanding === 'function') helpers(G).addDistrictStanding(d, 2);
    } catch (e) {}
    call(G, 'addMoney', 250);
    call(G, 'addRespect', 10);
    call(G, 'playSound', 'gull');
    const count = G.collectibles.found.filter(Boolean).length;
    if (count >= 12) {
      call(G, 'addMoney', 2000);
      call(G, 'showBanner', 'GOLDEN GULL', 'All 12 seagulls found — bonus +$2,000');
    } else {
      call(G, 'showBanner', 'GOLDEN SEAGULL ' + count + '/12', '+$250');
    }
    try { if (typeof helpers(G).saveGame === 'function') helpers(G).saveGame(); } catch (e) {}
  };

  G.helpers.seagullCount = () => {
    const f = (G.collectibles && Array.isArray(G.collectibles.found)) ? G.collectibles.found : [];
    return { found: f.filter(Boolean).length, total: 12 };
  };
}

function hideStatueMesh(G, i) {
  // Hide the collected statue mesh (scale to 0) — try every known handle.
  try {
    const meshes = G.city && G.city.seagullMeshes;
    if (Array.isArray(meshes) && meshes[i]) {
      if (meshes[i].scale) meshes[i].scale.set(0, 0, 0);
      else meshes[i].visible = false;
      return;
    }
  } catch (e) {}
  try {
    const spots = spotList(G);
    const spot = spots[i];
    if (spot && spot.mesh) {
      if (spot.mesh.scale) spot.mesh.scale.set(0, 0, 0);
      else spot.mesh.visible = false;
    }
  } catch (e) {}
}

export function updateCollectibles(G, dt) {
  if (!G || !G.collectibles || !Array.isArray(G.collectibles.found)) return;
  if (!G.state || G.state.paused || !G.state.started) return;
  // Early-out once all 12 are found: no proximity scan needed anymore.
  if (G.collectibles.found.filter(Boolean).length >= 12) return;
  const p = playerPos(G);
  if (!p) return;
  const spots = spotList(G);
  for (let i = 0; i < 12; i++) {
    if (G.collectibles.found[i]) continue;
    const spot = spots[i];
    if (!spot || typeof spot.x !== 'number') continue;
    const dx = p.x - spot.x, dz = p.z - spot.z;
    if (dx * dx + dz * dz <= 9) {
      G.helpers.collectSeagull(i);
      hideStatueMesh(G, i);
    }
  }
}
