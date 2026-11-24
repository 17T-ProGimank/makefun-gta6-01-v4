// SOLMARA — presence.js (round 7, Pillar 1 + 2 render).
// Dispatch board (#dispatch-board) + dialogue box (#dialogue), both fed by
// state that already exists. Defensive throughout: police units may lack
// callsign/role/tactic (naming layer lands separately) and missions may
// lack a caller — fall back, never crash.
const FALLBACK_SIGNS = ['CRUISER-11', 'CRUISER-23', 'INTERCEPTOR-07', 'RAMMER-03', 'CRUISER-31', 'INTERCEPTOR-19'];
const MAX_ROWS = 6;
const DIALOGUE_SECS = 6;

let boardEl = null, boardHead = null, boardRows = null;
let dlgEl = null, dlgAvatar = null, dlgName = null, dlgLine = null;
let dlgTimer = 0, lastKey = null;

function $(id) {
  try { return (typeof document !== 'undefined') ? document.getElementById(id) : null; } catch (e) { return null; }
}
function playerPos(G) {
  try {
    const p = G.player && (G.player.pos || (G.player.group && G.player.group.position));
    if (p && typeof p.x === 'number') return { x: p.x, z: p.z };
  } catch (e) {}
  return null;
}
function unitPos(u) {
  try {
    if (u.pos && typeof u.pos.x === 'number') return u.pos;
    if (u.group && u.group.position) return u.group.position;
    if (typeof u.x === 'number') return u;
  } catch (e) {}
  return null;
}
function distTo(p, u) {
  const q = unitPos(u);
  if (!p || !q) return null;
  return Math.round(Math.sqrt((p.x - q.x) * (p.x - q.x) + (p.z - q.z) * (p.z - q.z)));
}
function tacticFor(G, u, d) {
  if (u && typeof u.tactic === 'string' && u.tactic) return u.tactic.toUpperCase();
  if (u && u.kind === 'heli') return 'SPOTLIGHT';
  try {
    if (G.police && G.police.roadblocks && G.police.roadblocks.length) return 'ROADBLOCK';
  } catch (e) {}
  if (d != null && d < 25) return 'RAMMING';
  return 'PURSUIT';
}

export function initPresence(G) {
  boardEl = $('dispatch-board');
  boardHead = $('dispatch-board-head');
  boardRows = $('dispatch-board-rows');
  dlgEl = $('dialogue');
  dlgAvatar = $('dialogue-avatar');
  dlgName = $('dialogue-name');
  dlgLine = $('dialogue-line');
  dlgTimer = 0;
  lastKey = null;
  if (G && G.hud) {
    G.hud.el = G.hud.el || {};
    if (boardEl) G.hud.el['dispatch-board'] = boardEl;
    if (dlgEl) G.hud.el['dialogue'] = dlgEl;
  }
  if (boardEl) boardEl.style.display = 'none';
  if (dlgEl) dlgEl.style.display = 'none';
}

function updateBoard(G) {
  if (!boardEl) return;
  let units = [];
  try {
    const P = G.police || {};
    const cars = Array.isArray(P.cars) ? P.cars : [];
    // Callsigns must be DISTINCT per row: pose-spawned cruisers carry no
    // callsign, and the index fallback (FALLBACK_SIGNS[0] = CRUISER-11) can
    // collide with a real spawned unit's callsign — that is how the board
    // showed two CRUISER-11 rows. Dedupe: on collision pick the next
    // unused sign, else suffix by list position.
    const used = new Set();
    units = cars.map((c, i) => {
      let name = (c && c.callsign) || FALLBACK_SIGNS[i % FALLBACK_SIGNS.length];
      if (used.has(name)) {
        name = FALLBACK_SIGNS.find((s) => !used.has(s)) || (name + '-' + (i + 1));
      }
      used.add(name);
      return {
        name,
        role: (c && c.role) || 'PURSUIT',
        car: c,
      };
    });
    if (P.heli) {
      const air = used.has('AIR-1') ? 'AIR-2' : 'AIR-1';
      units.push({ name: air, role: 'AIR SUPPORT', car: Object.assign({ kind: 'heli' }, P.heli) });
    }
  } catch (e) { units = []; }
  const wanted = (G.state && typeof G.state.wanted === 'number') ? G.state.wanted : 0;
  if (!units.length) { boardEl.style.display = 'none'; return; }
  boardEl.style.display = 'block';
  const p = playerPos(G);
  if (boardHead) {
    const head = 'SOLMARA PD RESPONSE · ' + units.length + ' UNIT' + (units.length === 1 ? '' : 'S') + ' · CODE ' + wanted;
    if (boardHead.textContent !== head) boardHead.textContent = head;
  }
  if (boardRows) {
    const rows = units.slice(0, MAX_ROWS).map((u) => {
      const d = distTo(p, u.car);
      const dist = (d == null) ? '—' : d + 'm';
      return u.name + '  ' + dist + '  ' + tacticFor(G, u.car, d);
    });
    const text = rows.join('\n');
    if (boardRows.textContent !== text) boardRows.textContent = text;
  }
}

function currentCaller(G) {
  try {
    const m = (G.missions && G.missions.current) || null;
    if (m && m.caller && typeof m.caller.line === 'string') return m.caller;
  } catch (e) {}
  return null;
}

function updateDialogue(G, dt) {
  if (!dlgEl) return;
  let key = null;
  try {
    const m = (G.missions && G.missions.current) || null;
    key = m ? (m.id + '|' + ((G.state && G.state.objectiveText) || '')) : null;
  } catch (e) { key = null; }
  if (key !== null && key !== lastKey) {
    lastKey = key;
    const caller = currentCaller(G);
    if (caller) {
      if (dlgAvatar) dlgAvatar.textContent = (caller.name || '?').charAt(0).toUpperCase();
      if (dlgName) dlgName.textContent = (caller.name || 'UNKNOWN') + ' · ' + (caller.role || 'CONTACT');
      if (dlgLine) dlgLine.textContent = caller.line;
      dlgEl.style.display = 'flex';
      dlgEl.style.opacity = '1';
      dlgTimer = DIALOGUE_SECS;
      return;
    }
  }
  if (dlgTimer > 0) {
    dlgTimer -= dt;
    if (dlgTimer <= 2) dlgEl.style.opacity = String(Math.max(0, dlgTimer / 2));
    if (dlgTimer <= 0) dlgEl.style.display = 'none';
  }
}

export function updatePresence(G, dt) {
  if (!G) return;
  try { updateBoard(G); } catch (e) {}
  try { updateDialogue(G, dt || 0.016); } catch (e) {}
}
