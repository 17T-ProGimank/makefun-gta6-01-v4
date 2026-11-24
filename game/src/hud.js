// SOLMARA round 6 — HUD (session D, fresh rewrite).
// initHUD caches DOM elements; updateHUD refreshes every HUD element
// defensively (missing elements are skipped, never crash).
// New in round 6: #district-box / #district-bar (district standing).

const STATION_NAMES = ['SOL FM', 'EMBER ROCK', 'BAY BASS', 'SOLMARA NIGHTS'];
const DISTRICT_NAMES = {
  downtown: 'DOWNTOWN', port: 'PORT', beach: 'BEACH & BAY',
  westside: 'WESTSIDE', hills: 'NORTH HILLS',
};

const IDS = [
  'hud', 'stars', 'money', 'objective', 'health-bar', 'health-fill',
  'speed', 'minimap', 'banner', 'banner-title', 'banner-sub',
  'wanted-label', 'mission-label', 'time', 'respect-bar', 'respect-label',
  'crew-box', 'garage-hint', 'weapon-box', 'seagull-box', 'race-timer',
  'bribe-hint', 'spike-warning', 'lockpick-bar', 'lockpick-fill', 'district-box',
  'district-bar', 'district-bar-fill', 'radio-box', 'respect-fill', 'weapon-slots',
];

function $(id) {
  return (typeof document !== 'undefined') ? document.getElementById(id) : null;
}

function setText(el, text) {
  if (el && el.textContent !== text) el.textContent = text;
}

function setVisible(el, show) {
  if (el) el.style.display = show ? 'block' : 'none';
}

function fmtMoney(n) {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  return '$' + v.toLocaleString('en-US');
}

function fmtTime(secs) {
  const s = Math.max(0, Math.floor(Number(secs) || 0));
  const m = Math.floor(s / 60);
  return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

export function initHUD(G) {
  G.hud = G.hud || {};
  G.hud.el = {};
  for (const id of IDS) {
    const el = $(id);
    if (el) G.hud.el[id] = el;
  }
  const mm = G.hud.el['minimap'];
  if (mm) {
    try { G.hud.mapCtx = mm.getContext('2d'); } catch (e) { G.hud.mapCtx = null; }
  }
  // Money helper lives here (base contract); only attach if absent.
  if (G.helpers && !G.helpers.addMoney) {
    G.helpers.addMoney = (n) => {
      G.state.money = Math.max(0, (G.state.money || 0) + (Number(n) || 0));
      setText(G.hud.el['money'], fmtMoney(G.state.money));
    };
  }
}

function drawMinimap(G) {
  const ctx = G.hud.mapCtx;
  const cv = G.hud.el['minimap'];
  if (!ctx || !cv) return;
  const S = cv.width || 180;
  const B = 210; // half city size
  const mx = (x) => ((x + B) / (2 * B)) * S;
  const mz = (z) => ((z + B) / (2 * B)) * S;

  // Ground + sea (south strip, z >= 140) + sand edge.
  ctx.fillStyle = '#3d5a3a';
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#1d5f7a';
  ctx.fillRect(0, mz(140), S, S - mz(140));
  ctx.fillStyle = '#d9c08a';
  ctx.fillRect(0, mz(140) - 3, S, 3);

  // Roads: grid every 42 units, plus any explicit road segments.
  ctx.strokeStyle = '#23272e';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let c = -B + 42; c < B; c += 42) {
    ctx.moveTo(mx(c), 0); ctx.lineTo(mx(c), S);
    ctx.moveTo(0, mz(c)); ctx.lineTo(S, mz(c));
  }
  ctx.stroke();
  const roads = G.city && Array.isArray(G.city.roads) ? G.city.roads : null;
  if (roads) {
    ctx.strokeStyle = '#3a3f47';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const r of roads) {
      if (r && typeof r.x1 === 'number') {
        ctx.moveTo(mx(r.x1), mz(r.z1)); ctx.lineTo(mx(r.x2), mz(r.z2));
      }
    }
    ctx.stroke();
  }

  // Mission target: yellow star.
  const t = G.state.objectiveTarget;
  if (t && typeof t.x === 'number') {
    const x = mx(t.x), y = mz(t.z);
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
      const px = x + Math.cos(a) * 6, py = y + Math.sin(a) * 6;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
  }

  // Police: blue/red dots.
  const cars = (G.police && Array.isArray(G.police.cars)) ? G.police.cars : [];
  for (const c of cars) {
    const p = c && c.pos ? c.pos : c;
    if (!p || typeof p.x !== 'number') continue;
    ctx.fillStyle = '#4aa3ff';
    ctx.beginPath(); ctx.arc(mx(p.x), mz(p.z), 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff4a4a';
    ctx.beginPath(); ctx.arc(mx(p.x), mz(p.z), 1.5, 0, Math.PI * 2); ctx.fill();
  }

  // Player: white dot + heading wedge (north up).
  const pp = G.player && G.player.pos ? G.player.pos : null;
  if (pp && typeof pp.x === 'number') {
    const x = mx(pp.x), y = mz(pp.z);
    const h = (G.player && typeof G.player.heading === 'number') ? G.player.heading : 0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x + Math.sin(h) * 8, y - Math.cos(h) * 8);
    ctx.lineTo(x + Math.sin(h + 2.6) * 6, y - Math.cos(h + 2.6) * 6);
    ctx.lineTo(x + Math.sin(h - 2.6) * 6, y - Math.cos(h - 2.6) * 6);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.stroke();
  }
}

function districtInfo(G) {
  let id = (G.state && G.state.currentDistrict) || 'downtown';
  if ((!G.state || !G.state.currentDistrict) && G.helpers && G.helpers.districtAt) {
    try {
      const p = G.player && G.player.pos;
      if (p) id = G.helpers.districtAt(p.x, p.z) || 'downtown';
    } catch (e) { /* keep default */ }
  }
  let standing = { points: 0, tier: 0, title: 'UNKNOWN', nextAt: 20 };
  if (G.helpers && typeof G.helpers.districtStanding === 'function') {
    try {
      const s = G.helpers.districtStanding(id);
      if (s && typeof s.points === 'number') standing = s;
    } catch (e) { /* keep default */ }
  } else if (G.districts && typeof G.districts[id] === 'number') {
    standing = { points: G.districts[id], tier: 0, title: 'UNKNOWN', nextAt: 20 };
  }
  return { id, name: DISTRICT_NAMES[id] || String(id).toUpperCase(), standing };
}

// Round 7 — weapon slots panel (Pillar 3): 3 slots, owned vs LOCKED,
// current highlighted. Ammo is infinite in combat.js — display ∞, never
// a fake count. Data from G.weapons.owned/current.
const WEAPON_SLOTS = [
  { key: 'pistol', num: '1', name: 'PISTOL' },
  { key: 'smg', num: '2', name: 'SMG' },
  { key: 'shotgun', num: '3', name: 'SHOTGUN' },
];

function renderWeaponSlots(G) {
  let el = (G.hud && G.hud.el && G.hud.el['weapon-slots']) || $('weapon-slots');
  if (!el && typeof document !== 'undefined') {
    // Defensive: another session owns the container div in index.html;
    // if it is missing, create it and hang it on the HUD (right side,
    // above #weapon-box which sits at bottom:58px, #speed at bottom:16px).
    el = document.createElement('div');
    el.id = 'weapon-slots';
    el.style.cssText = 'position:absolute;right:16px;bottom:92px;width:168px;'
      + 'font-size:12px;font-weight:800;color:#fff;pointer-events:none;';
    const hud = $('hud') || document.body;
    if (hud) hud.appendChild(el);
    if (G.hud && G.hud.el) G.hud.el['weapon-slots'] = el;
  }
  if (!el) return;
  const w = G.weapons || { owned: ['pistol'], current: 'pistol' };
  const owned = Array.isArray(w.owned) ? w.owned : ['pistol'];
  const cur = w.current || 'pistol';
  const sig = owned.join(',') + '|' + cur;
  if (G.hud && G.hud.weaponSlotsSig === sig) return;
  if (G.hud) G.hud.weaponSlotsSig = sig;
  let html = '<div style="opacity:.75;letter-spacing:2px;font-size:10px;">WEAPONS</div>';
  for (const s of WEAPON_SLOTS) {
    const has = owned.includes(s.key);
    const isCur = cur === s.key;
    const style = isCur
      ? 'background:rgba(255,210,62,.92);color:#111;'
      : has ? 'background:rgba(0,0,0,.45);color:#fff;'
      : 'background:rgba(0,0,0,.30);color:#888;';
    const right = has ? '∞' : 'LOCKED';
    html += '<div style="display:flex;justify-content:space-between;padding:2px 8px;margin-top:2px;' + style + '">'
      + '<span>[' + s.num + '] ' + s.name + '</span><span>' + right + '</span></div>';
  }
  el.innerHTML = html;
}

export function updateHUD(G, dt) {
  const el = (G.hud && G.hud.el) || {};
  const st = G.state || {};

  // Wanted stars.
  if (el['stars']) {
    const wanted = Math.max(0, Math.min(5, st.wanted || 0));
    const spans = el['stars'].querySelectorAll ? el['stars'].querySelectorAll('span') : [];
    if (spans.length) {
      spans.forEach((sp, i) => {
        sp.textContent = i < wanted ? '★' : '☆';
        sp.style.color = i < wanted ? '#ffd23e' : '#666';
      });
    } else {
      setText(el['stars'], '★'.repeat(wanted) + '☆'.repeat(5 - wanted));
    }
  }
  setText(el['wanted-label'], (st.wanted || 0) === 0 ? 'CLEAR' : 'WANTED ' + (st.wanted || 0) + '★');

  setText(el['money'], fmtMoney(st.money));
  setText(el['objective'], st.objectiveText || 'Meet Mara at the Ember Garage');
  setText(el['time'], fmtTime(st.time));
  setText(el['speed'], Math.round(Math.abs(st.speed || 0) * 3.6) + ' km/h');

  // Health bar.
  const hp = Math.max(0, Math.min(100, st.health == null ? 100 : st.health));
  if (el['health-fill']) el['health-fill'].style.width = hp + '%';
  if (el['health-bar']) {
    el['health-bar'].style.background = hp > 50 ? '#2fae4e' : hp > 25 ? '#e8a020' : '#d23c2e';
  }

  // Mission label: "MISSION 3/15 — Hot Wheels".
  if (el['mission-label']) {
    const list = (G.missions && Array.isArray(G.missions.list)) ? G.missions.list : [];
    const idx = Math.max(0, Math.min(list.length ? list.length - 1 : 0, st.missionIndex || 0));
    const total = list.length || 15;
    const title = list[idx] && list[idx].title ? list[idx].title : 'First Gear';
    setText(el['mission-label'], 'MISSION ' + (idx + 1) + '/' + total + ' — ' + title.toUpperCase());
  }

  // Respect bar + label ("WHEELMAN · 320/700").
  if (el['respect-label'] || el['respect-bar']) {
    let rank = { title: 'NOBODY', points: 0, nextAt: 100 };
    if (G.helpers && typeof G.helpers.respectRank === 'function') {
      try { const r = G.helpers.respectRank(); if (r) rank = r; } catch (e) { /* default */ }
    } else if (G.respect) {
      rank = { title: 'NOBODY', points: G.respect.points || 0, nextAt: 100 };
    }
    setText(el['respect-label'], rank.title + ' · ' + (rank.points || 0) + '/' + (rank.nextAt || 100));
    if (el['respect-fill']) {
      const pct = rank.nextAt ? Math.min(100, Math.max(0, (rank.points / rank.nextAt) * 100)) : 0;
      el['respect-fill'].style.width = pct + '%';
    }
  }

  // Crew box ("CREW: Mara +2").
  if (el['crew-box']) {
    let members = [];
    if (G.helpers && typeof G.helpers.crewList === 'function') {
      try { members = G.helpers.crewList() || []; } catch (e) { members = []; }
    } else if (G.crew && Array.isArray(G.crew.members)) {
      members = G.crew.members;
    }
    const names = members.map((m) => (typeof m === 'string' ? m : (m && m.name ? m.name.split(' ')[0] : ''))).filter(Boolean);
    // "CREW: Mara +2" — first member by name, rest as a count.
    setText(el['crew-box'], names.length ? 'CREW: ' + names[0] + (names.length > 1 ? ' +' + (names.length - 1) : '') : 'CREW: —');
  }

  // Garage hint.
  setVisible(el['garage-hint'], !!st.nearGarage);

  // Weapon box ("PISTOL · 1/2/3").
  if (el['weapon-box']) {
    const w = G.weapons || { owned: ['pistol'], current: 'pistol' };
    const owned = Array.isArray(w.owned) ? w.owned : ['pistol'];
    const keys = owned.map((o) => ({ pistol: '1', smg: '2', shotgun: '3' })[o] || '?').join('/');
    setText(el['weapon-box'], String(w.current || 'pistol').toUpperCase() + ' · ' + keys);
  }

  // Weapon slots panel (round 7): 3 slots, owned vs LOCKED, current highlighted.
  renderWeaponSlots(G);

  // Seagull counter ("SEAGULLS 3/12").
  if (el['seagull-box']) {
    let found = 0, total = 12;
    if (G.helpers && typeof G.helpers.seagullCount === 'function') {
      try { const c = G.helpers.seagullCount(); if (c) { found = c.found || 0; total = c.total || 12; } } catch (e) { /* default */ }
    } else if (G.collectibles && Array.isArray(G.collectibles.found)) {
      found = G.collectibles.found.filter(Boolean).length;
      total = G.collectibles.found.length || 12;
    }
    setText(el['seagull-box'], 'SEAGULLS ' + found + '/' + total);
  }

  // Race timer ("⏱ 42.3s · CHECKPOINT 2/3").
  if (el['race-timer']) {
    const race = G.race;
    if (race && race.active) {
      const elapsed = Math.max(0, (st.time || 0) - (race.startTime || 0));
      const total = (race.checkpoints && race.checkpoints.length) || 3;
      const cur = Math.min(total, (race.current || 0) + 1);
      setText(el['race-timer'], '⏱ ' + elapsed.toFixed(1) + 's · CHECKPOINT ' + cur + '/' + total);
      setVisible(el['race-timer'], true);
    } else {
      setVisible(el['race-timer'], false);
    }
  }

  // Bribe hint + spike warning.
  setVisible(el['bribe-hint'], !!st.bribeAvailable);
  setVisible(el['spike-warning'], !!st.spikeAhead);

  // Lockpick progress bar (mission 14).
  if (el['lockpick-bar']) {
    const p = st.lockpickProgress != null ? st.lockpickProgress
      : (G.missions && typeof G.missions.lockpick === 'number' ? G.missions.lockpick : 0);
    const active = p > 0 && p < 1;
    setVisible(el['lockpick-bar'], active);
    if (active && el['lockpick-fill']) el['lockpick-fill'].style.width = Math.round(p * 100) + '%';
  }

  // Radio box (audio.js also updates this; keep in sync here too).
  if (el['radio-box']) {
    const a = G.audio || {};
    setText(el['radio-box'], a.radioOn ? (STATION_NAMES[a.station || 0] || 'SOL FM') : 'RADIO OFF');
  }

  // District box + bar (round 6): "DOWNTOWN · RESPECTED 45/100".
  const d = districtInfo(G);
  if (el['district-box']) {
    setText(el['district-box'], d.name + ' · ' + d.standing.title + ' ' + (d.standing.points || 0) + '/100');
  }
  if (el['district-bar-fill']) {
    el['district-bar-fill'].style.width = Math.min(100, Math.max(0, d.standing.points || 0)) + '%';
  }

  drawMinimap(G);
}
