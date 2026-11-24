// SOLMARA round 6 — menus (session D, fresh rewrite).
// Start / pause / game-over / garage / crew menus + banner + hint toasts.
// New in round 6: pause-screen district panel (5 rows with tier + bar),
// rendered from G.helpers.districtStanding.

const DISTRICT_ORDER = [
  { id: 'downtown', name: 'DOWNTOWN' },
  { id: 'port', name: 'PORT' },
  { id: 'beach', name: 'BEACH & BAY' },
  { id: 'westside', name: 'WESTSIDE' },
  { id: 'hills', name: 'NORTH HILLS' },
];

const CREW_DEFS = [
  { id: 'mara', name: 'Mara Voss', role: 'Fixer', bonus: '+10% mission payout', mission: 0 },
  { id: 'jax', name: 'Jax Calloway', role: 'Wheelman', bonus: '+15% getaway speed', mission: 10 },
  { id: 'lena', name: 'Lena Marlowe', role: 'Ghost Driver', bonus: '-1 wanted star on mission start', mission: 11 },
];

function $(id) {
  return (typeof document !== 'undefined') ? document.getElementById(id) : null;
}

// Menus are hidden two ways: the `hidden` class (initial state in
// index.html, `.menu.hidden { display: none }`) and inline display:none.
// show()/hide() must manage BOTH, or a menu shown with display:'' stays
// invisible under the class rule — which is also what made the Esc check
// below misread closed menus as open.
function show(el) {
  if (!el) return;
  if (el.classList) el.classList.remove('hidden');
  el.style.display = '';
}
function hide(el) {
  if (!el) return;
  if (el.classList) el.classList.add('hidden');
  el.style.display = 'none';
}

// A sub-menu counts as open only if it is actually visible: no `hidden`
// class and no inline display:none. Reading inline style.display alone
// misreads a class-hidden menu (style.display === '') as open, so the
// first Esc press "closed" an already-closed menu instead of pausing.
function isMenuOpen(el) {
  if (!el) return false;
  if (el.classList && el.classList.contains('hidden')) return false;
  return el.style.display !== 'none';
}

function fmtTime(secs) {
  const s = Math.max(0, Math.floor(Number(secs) || 0));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

function fmtMoney(n) {
  return '$' + Math.max(0, Math.floor(Number(n) || 0)).toLocaleString('en-US');
}

function ownedMembers(G) {
  if (G.helpers && typeof G.helpers.crewList === 'function') {
    try { return G.helpers.crewList() || []; } catch (e) { return []; }
  }
  if (G.crew && Array.isArray(G.crew.members)) return G.crew.members;
  return [{ id: 'mara', name: 'Mara Voss' }];
}

function memberOwned(G, id) {
  const list = ownedMembers(G);
  return list.some((m) => (typeof m === 'string' ? m : m && m.id) === id);
}

function garageCars(G) {
  if (G.helpers && typeof G.helpers.garageCars === 'function') {
    try { return G.helpers.garageCars() || []; } catch (e) { return []; }
  }
  return (G.garage && Array.isArray(G.garage.owned)) ? G.garage.owned : [];
}

function districtStanding(G, id) {
  if (G.helpers && typeof G.helpers.districtStanding === 'function') {
    try {
      const s = G.helpers.districtStanding(id);
      if (s && typeof s.points === 'number') return s;
    } catch (e) { /* fall through */ }
  }
  const pts = (G.districts && typeof G.districts[id] === 'number') ? G.districts[id] : 0;
  return { points: pts, tier: 0, title: 'UNKNOWN', nextAt: 20 };
}

export function initMenus(G) {
  G.menus = G.menus || { bannerUntil: 0, hintUntil: 0, prevEsc: false, prevG: false };
  const M = G.menus;

  // --- Banner + hint helpers (attached for other modules) ---
  if (G.helpers) {
    G.helpers.showBanner = (title, sub) => {
      const b = $('banner'), t = $('banner-title'), s = $('banner-sub');
      if (t) t.textContent = title || '';
      if (s) s.textContent = sub || '';
      if (b) { b.style.display = 'block'; b.style.opacity = '1'; }
      M.bannerUntil = (G.state ? G.state.time : 0) + 3;
    };
    G.helpers.showHint = (text) => {
      const h = $('hint');
      if (h) { h.textContent = text || ''; h.style.display = 'block'; h.style.opacity = '1'; }
      M.hintUntil = (G.state ? G.state.time : 0) + 4;
    };
    G.helpers.openGarageMenu = () => openGarage(G);
    G.helpers.openCrewMenu = () => openCrew(G);
  }

  // --- District panel on the pause screen (created if index.html lacks it) ---
  let panel = $('district-panel');
  if (!panel) {
    const pause = $('menu-pause');
    if (pause) {
      panel = document.createElement('div');
      panel.id = 'district-panel';
      pause.appendChild(panel);
    }
  }
  if (panel) {
    panel.innerHTML = '<h3>DISTRICT STANDING</h3>' + DISTRICT_ORDER.map((d) => (
      '<div class="district-row" data-district="' + d.id + '">' +
      '<span class="district-name">' + d.name + '</span>' +
      '<span class="district-tier"></span>' +
      '<div class="district-track"><div class="district-fill"></div></div>' +
      '</div>'
    )).join('');
  }

  // --- Pause stats block (created if missing) ---
  let stats = $('pause-stats');
  if (!stats) {
    const pause = $('menu-pause');
    if (pause) {
      stats = document.createElement('div');
      stats.id = 'pause-stats';
      pause.appendChild(stats);
    }
  }

  wireButtons(G);
  refreshSlots(G);
}

function wireButtons(G) {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', fn);
  };

  // Start button: first button inside #menu-start, or #btn-start / #start-btn.
  let startBtn = $('btn-start') || $('start-btn');
  if (!startBtn) {
    const menu = $('menu-start');
    startBtn = menu ? menu.querySelector('button') : null;
  }
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      G.state.started = true;
      G.state.paused = false;
      hide($('menu-start'));
      if (G.helpers && typeof G.helpers.playSound === 'function') {
        try { G.helpers.playSound('click'); } catch (e) { /* audio not ready */ }
      }
      if (G.helpers && typeof G.helpers.resumeAudio === 'function') {
        try { G.helpers.resumeAudio(); } catch (e) { /* ignore */ }
      }
    });
  }

  // Slot buttons (start screen): continue from a save slot.
  [1, 2, 3].forEach((n) => {
    on('slot-' + n, () => {
      if (G.helpers && typeof G.helpers.setSlot === 'function') {
        try { G.helpers.setSlot(n); } catch (e) { /* ignore */ }
      }
      if (G.helpers && typeof G.helpers.loadGame === 'function') {
        try { G.helpers.loadGame(n); } catch (e) { /* ignore */ }
      }
      G.state.started = true;
      G.state.paused = false;
      hide($('menu-start'));
    });
  });

  // New game button.
  const newGame = $('btn-new-game') || $('new-game-btn');
  if (newGame) {
    newGame.addEventListener('click', () => {
      G.state.started = true;
      G.state.paused = false;
      hide($('menu-start'));
    });
  }

  // Pause menu: save to slot 1/2/3.
  [1, 2, 3].forEach((n) => {
    on('save-slot-' + n, () => {
      if (G.helpers && typeof G.helpers.saveGame === 'function') {
        try { G.helpers.saveGame(n); } catch (e) { /* ignore */ }
      }
      if (G.helpers && G.helpers.showHint) G.helpers.showHint('Saved to slot ' + n);
      refreshSlots(G);
    });
  });

  on('btn-garage', () => openGarage(G));
  on('btn-crew', () => openCrew(G));

  // Resume button on pause screen.
  const resume = $('btn-resume') || $('resume-btn');
  if (resume) {
    resume.addEventListener('click', () => {
      G.state.paused = false;
      hide($('menu-pause'));
    });
  }

  // Garage menu buttons.
  on('btn-garage-repair', () => {
    if (G.helpers && typeof G.helpers.repairCar === 'function') {
      try { G.helpers.repairCar(); } catch (e) { /* ignore */ }
    }
    openGarage(G);
  });
  on('btn-garage-paint', () => {
    if (G.helpers && typeof G.helpers.paintCar === 'function') {
      try { G.helpers.paintCar(G.garage ? G.garage.active || 0 : 0); } catch (e) { /* ignore */ }
    }
    openGarage(G);
  });
  on('btn-garage-upgrade', () => {
    if (G.helpers && typeof G.helpers.upgradeCar === 'function') {
      try { G.helpers.upgradeCar(); } catch (e) { /* ignore */ }
    }
    openGarage(G);
  });
  on('btn-garage-store', () => {
    if (G.helpers && typeof G.helpers.storeCar === 'function') {
      try { G.helpers.storeCar(G.state.inVehicle || null); } catch (e) { /* ignore */ }
    }
    openGarage(G);
  });
  on('btn-garage-close', () => hide($('menu-garage')));
  on('btn-crew-close', () => hide($('menu-crew')));
}

function refreshSlots(G) {
  let saves = null;
  if (G.helpers && typeof G.helpers.listSaves === 'function') {
    try { saves = G.helpers.listSaves(); } catch (e) { saves = null; }
  }
  [1, 2, 3].forEach((n) => {
    const btn = $('slot-' + n);
    if (!btn) return;
    const s = saves && saves[n - 1];
    if (s) {
      btn.textContent = 'SLOT ' + n + ' — ' + fmtMoney(s.money) + ' · MISSION ' + ((s.missionIndex || 0) + 1) + ' · ' + (s.rank || 'NOBODY');
    } else {
      btn.textContent = 'SLOT ' + n + ' — EMPTY';
    }
  });
}

function openGarage(G) {
  const menu = $('menu-garage');
  const list = $('garage-list');
  const cars = garageCars(G);
  if (list) {
    if (!cars.length) {
      list.innerHTML = '<p>No cars stored yet — steal a car and press G near the Ember Garage.</p>';
    } else {
      list.innerHTML = cars.map((c, i) => {
        const name = (c && c.name) || 'Car ' + (i + 1);
        const paint = (c && c.paint) || (c && c.color) || '—';
        const upg = (c && typeof c.upgrade === 'number') ? c.upgrade : 0;
        const active = G.garage && G.garage.active === i ? ' (ACTIVE)' : '';
        return '<div class="garage-car">' + name + active + ' — ' + paint + ' — UPGRADE Lv' + upg + '</div>';
      }).join('');
    }
  }
  // Upgrade button label reflects the next level's price.
  const upgBtn = $('btn-garage-upgrade');
  if (upgBtn) {
    const active = (G.garage && Array.isArray(G.garage.owned)) ? G.garage.owned[G.garage.active || 0] : null;
    const lvl = active && typeof active.upgrade === 'number' ? active.upgrade : 0;
    const costs = [800, 1800, 3500];
    upgBtn.textContent = lvl >= 3 ? 'UPGRADE — MAX' : 'UPGRADE $' + costs[lvl].toLocaleString('en-US');
  }
  show(menu);
  G.state.paused = true;
}

function openCrew(G) {
  const menu = $('menu-crew');
  const list = $('crew-list');
  if (list) {
    list.innerHTML = CREW_DEFS.map((c) => {
      const owned = memberOwned(G, c.id);
      const locked = !owned && c.mission > 0;
      return '<div class="crew-member' + (locked ? ' locked' : '') + '">' +
        '<b>' + c.name + '</b> — ' + c.role + ' — ' + c.bonus +
        (locked ? ' <i>(Recruit in mission ' + c.mission + ')</i>' : '') +
        '</div>';
    }).join('');
  }
  show(menu);
  G.state.paused = true;
}

function renderDistrictPanel(G) {
  const panel = $('district-panel');
  if (!panel) return;
  for (const d of DISTRICT_ORDER) {
    const row = panel.querySelector('[data-district="' + d.id + '"]');
    if (!row) continue;
    const s = districtStanding(G, d.id);
    const tierEl = row.querySelector('.district-tier');
    if (tierEl) tierEl.textContent = s.title + ' ' + s.points + '/100';
    const fill = row.querySelector('.district-fill');
    if (fill) fill.style.width = Math.min(100, Math.max(0, s.points)) + '%';
  }
}

function renderPauseStats(G) {
  const stats = $('pause-stats');
  if (!stats) return;
  const st = G.state || {};
  let rank = 'NOBODY';
  if (G.helpers && typeof G.helpers.respectRank === 'function') {
    try { const r = G.helpers.respectRank(); if (r) rank = r.title; } catch (e) { /* default */ }
  }
  let gulls = { found: 0, total: 12 };
  if (G.helpers && typeof G.helpers.seagullCount === 'function') {
    try { const c = G.helpers.seagullCount(); if (c) gulls = c; } catch (e) { /* default */ }
  }
  const weapons = (G.weapons && Array.isArray(G.weapons.owned)) ? G.weapons.owned : ['pistol'];
  const best = (G.saveData && G.saveData.raceBest != null) ? G.saveData.raceBest
    : (G.race && G.race.best != null ? G.race.best : null);
  const racesWon = (G.saveData && G.saveData.racesWon) || (G.race && G.race.won) || 0;
  stats.innerHTML =
    '<p>Missions done: ' + (st.missionsDone || st.missionIndex || 0) +
    ' · Kills: ' + (st.kills || 0) +
    ' · Cars stolen: ' + (st.carsStolen || 0) +
    ' · Playtime: ' + fmtTime(st.time) + '</p>' +
    '<p>Respect rank: ' + rank +
    ' · Seagulls: ' + gulls.found + '/' + gulls.total +
    ' · Races won: ' + racesWon +
    ' · Best race: ' + (best != null ? best.toFixed(1) + 's' : '—') + '</p>' +
    '<p>Weapons: ' + weapons.map((w) => String(w).toUpperCase()).join(', ') + '</p>';
}

export function updateMenus(G, dt) {
  const M = G.menus || {};
  const st = G.state || {};
  const keys = (G.input && G.input.keys) || new Set();

  // Esc toggles pause (edge-triggered). If a sub-menu (garage/crew) is open,
  // Esc closes that menu first instead of unpausing.
  const esc = keys.has('Escape');
  if (esc && !M.prevEsc && st.started && !st.gameOver) {
    const garageOpen = isMenuOpen($('menu-garage'));
    const crewOpen = isMenuOpen($('menu-crew'));
    if (garageOpen || crewOpen) {
      hide($('menu-garage'));
      hide($('menu-crew'));
    } else {
      st.paused = !st.paused;
      if (st.paused) {
        show($('menu-pause'));
        renderDistrictPanel(G);
        renderPauseStats(G);
      } else {
        hide($('menu-pause'));
        hide($('menu-garage'));
        hide($('menu-crew'));
      }
    }
  }
  M.prevEsc = esc;

  // G opens the garage menu near the garage (edge-triggered).
  const g = keys.has('KeyG');
  if (g && !M.prevG && st.started && !st.paused && st.nearGarage) openGarage(G);
  M.prevG = g;

  // C opens the crew menu.
  if (keys.has('KeyC') && !M.prevC && st.started && !st.paused) openCrew(G);
  M.prevC = keys.has('KeyC');

  // Start screen visibility.
  if (!st.started) {
    show($('menu-start'));
    hide($('menu-pause'));
  } else if (!st.paused) {
    hide($('menu-start'));
  }

  // Game over.
  if (st.gameOver) {
    show($('menu-gameover'));
    hide($('menu-pause'));
  } else {
    hide($('menu-gameover'));
  }

  // Refresh pause stats + district panel while paused.
  if (st.paused) {
    renderDistrictPanel(G);
    renderPauseStats(G);
  }

  // Banner fade (3s).
  const banner = $('banner');
  if (banner && M.bannerUntil && (st.time || 0) > M.bannerUntil) {
    banner.style.opacity = '0';
    M.bannerUntil = 0;
  }

  // Hint fade (4s).
  const hint = $('hint');
  if (hint && M.hintUntil && (st.time || 0) > M.hintUntil) {
    hint.style.opacity = '0';
    M.hintUntil = 0;
  }
}
