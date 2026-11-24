// SOLMARA — missions.js (round 6): 15 chained missions (base 1-9, r4 10-12,
// r5 13-15). Round 6 adds a `district` field per mission; every payout earns
// +4 district standing and is multiplied by the district payout bonus.

import { CONFIG } from './config.js';

const GARAGE_POS = { x: -27, z: 42 };
const PORT_POS = { x: 150, z: 60 };
const OFFICE_POS = { x: 150, z: 95 };
const COMPOUND_POS = { x: 172, z: 105 };
const BANK_POS = { x: -10, z: -60 };
const EXCHANGE_POS = { x: 20, z: -20 };
const HILLS_POS = { x: -30, z: -160 };
const RACE_POINTS = [
  { x: 10, z: 10 },
  { x: 70, z: -40 },
  { x: -50, z: -70 },
];

function helpers(G) { return (G && G.helpers) || {}; }
function call(G, name, ...args) {
  try { const fn = helpers(G)[name]; if (typeof fn === 'function') return fn(...args); } catch (e) {}
  return undefined;
}
function playerPos(G) {
  try { const p = G.player && (G.player.pos || (G.player.group && G.player.group.position));
    if (p && typeof p.x === 'number') return { x: p.x, z: p.z }; } catch (e) {}
  return null;
}
function dist2d(a, b) { const dx = a.x - b.x, dz = a.z - b.z; return Math.sqrt(dx * dx + dz * dz); }
function garagePos(G) {
  try { const sp = G.city && G.city.spawnPoints && G.city.spawnPoints.garage;
    if (sp && typeof sp.x === 'number') return { x: sp.x, z: sp.z }; } catch (e) {}
  return GARAGE_POS;
}
function officePos(G) {
  try { const sp = G.city && G.city.spawnPoints && G.city.spawnPoints.office;
    if (sp && typeof sp.x === 'number') return { x: sp.x, z: sp.z }; } catch (e) {}
  return OFFICE_POS;
}
function arrived(G, target, radius) { const p = playerPos(G); return !!(p && target && dist2d(p, target) <= (radius || 8)); }
function spawnEnemyAt(G, x, z, opts) {
  try {
    if (typeof helpers(G).spawnEnemy === 'function') return helpers(G).spawnEnemy(x, z, opts);
    if (G.combat && typeof G.combat.spawnEnemy === 'function') return G.combat.spawnEnemy(G, x, z, opts);
  } catch (e) {}
  return null;
}
function makeCarAt(G, color, kind, opts) {
  try {
    if (typeof helpers(G).makeCar === 'function') return helpers(G).makeCar(color, kind, opts);
    if (G.vehicles && typeof G.vehicles.makeCar === 'function') return G.vehicles.makeCar(G, color, kind, opts);
  } catch (e) {}
  return null;
}
function districtAt(G, x, z) {
  try {
    if (typeof helpers(G).districtAt === 'function') return helpers(G).districtAt(x, z) || 'downtown';
  } catch (e) {}
  return 'downtown';
}

// Shared payout path: +4 standing in the mission district, reward x
// districtPayoutBonus, +respect (reward/10), banner, save. Every onDone ends here.
function payMission(G, m) {
  const h = helpers(G);
  let bonus = 1;
  try { if (typeof h.districtPayoutBonus === 'function') bonus = h.districtPayoutBonus(m.district) || 1; } catch (e) {}
  const payout = Math.round(m.reward * bonus);
  try { if (typeof h.addDistrictStanding === 'function') h.addDistrictStanding(m.district, 4); } catch (e) {}
  try { if (typeof h.addMoney === 'function') h.addMoney(payout); } catch (e) {}
  try { if (typeof h.addRespect === 'function') h.addRespect(Math.round(m.reward / 10)); } catch (e) {}
  try { if (typeof h.showBanner === 'function') h.showBanner('MISSION COMPLETE', m.title + '  +$' + payout); } catch (e) {}
  try { if (typeof h.saveGame === 'function') h.saveGame(); } catch (e) {}
  return payout;
}

function mission(def) {
  const m = Object.assign({}, def);
  m.onDone = (G) => {
    if (def.extra) { try { def.extra(G); } catch (e) {} }
    payMission(G, m);
  };
  return m;
}

function raceCheckpoints(G) {
  try { const rc = (G.config && G.config.race && G.config.race.checkpoints) || (CONFIG && CONFIG.race && CONFIG.race.checkpoints);
    if (Array.isArray(rc) && rc.length >= 3) return rc.map((c) => ({ x: c.x, z: c.z })); } catch (e) {}
  return RACE_POINTS.map((c) => ({ x: c.x, z: c.z }));
}
function raceParTime(G) {
  try { const p = (G.config && G.config.race && G.config.race.parTime) || (CONFIG && CONFIG.race && CONFIG.race.parTime);
    if (typeof p === 'number') return p; } catch (e) {}
  return 90;
}
function racePayouts(G) {
  try { const p = (G.config && G.config.race && G.config.race.payouts) || (CONFIG && CONFIG.race && CONFIG.race.payouts);
    if (p) return p; } catch (e) {}
  return { gold: 800, silver: 500, bronze: 300 };
}

// Shared race mechanic (mission 13 + repeatable street races): checkpoint
// rings + timer. G.race = {active, checkpoints, current, startTime, parTime,
// missionId, rival}.
export function startRace(G, checkpoints, parTime) {
  if (!G) return;
  G.race = {
    active: true,
    checkpoints: (checkpoints || []).map((c) => ({ x: c.x, z: c.z })),
    current: 0,
    startTime: (G.state && typeof G.state.time === 'number') ? G.state.time : 0,
    parTime: parTime || 90,
    missionId: null,
    rival: null,
    rivalWp: 0,
  };
  // Show the first ring if the city module offers one (defensive).
  try {
    const mk = (G.city && G.city.makeCheckpointRing) || helpers(G).makeCheckpointRing;
    if (typeof mk === 'function' && G.race.checkpoints[0]) {
      mk(G, G.race.checkpoints[0].x, G.race.checkpoints[0].z, 0);
    }
  } catch (e) {}
}

function finishRace(G, elapsed) {
  const race = G.race;
  if (!race) return;
  race.active = false;
  const payouts = racePayouts(G);
  let tier = null, payout = 0;
  if (elapsed < 60) { tier = 'GOLD'; payout = payouts.gold; }
  else if (elapsed <= 75) { tier = 'SILVER'; payout = payouts.silver; }
  else if (elapsed <= race.parTime) { tier = 'BRONZE'; payout = payouts.bronze; }
  const last = race.checkpoints[race.checkpoints.length - 1] || { x: 0, z: 0 };
  if (tier) {
    call(G, 'addMoney', payout);
    if (tier === 'GOLD') {
      call(G, 'addRespect', 25);
      call(G, 'addDistrictStanding', districtAt(G, last.x, last.z), 2);
    }
    call(G, 'showBanner', tier + ' — ' + elapsed.toFixed(1) + 's', 'Race payout +$' + payout);
    try {
      if (typeof helpers(G).saveRaceBest === 'function') helpers(G).saveRaceBest(elapsed);
    } catch (e) {}
  } else {
    call(G, 'showBanner', 'TIME UP', 'Beat ' + race.parTime + 's to earn a payout');
  }
  try { if (typeof helpers(G).saveGame === 'function') helpers(G).saveGame(); } catch (e) {}
  return tier;
}

export const MISSIONS = [
  mission({
    id: 1, title: 'First Gear', giver: 'Mara Voss', district: 'downtown',
    caller: { name: 'Mara Voss', role: 'Fixer', line: 'First job, first rule: the garage is home. Get here in one piece.' },
    brief: 'Drive to the Ember Garage and meet Mara. The debt clock is ticking.',
    objective: 'Drive to the Ember Garage', target: GARAGE_POS, reward: 200,
    onStart(G) { call(G, 'setObjective', 'Drive to the Ember Garage', GARAGE_POS); },
  }),
  mission({
    id: 2, title: 'The Pickup', giver: 'Mara Voss', district: 'port',
    caller: { name: 'Mara Voss', role: 'Fixer', line: 'Any car, any colour. Just don\'t bring the law with you.' },
    brief: 'Steal a car and deliver it to the port. Any car. Don\'t get cute.',
    objective: 'Steal a car, deliver it to the port', target: PORT_POS, reward: 400,
    onStart(G) { call(G, 'setObjective', 'Steal a car, then deliver it to the port', PORT_POS); },
  }),
  mission({
    id: 3, title: 'Hot Wheels', giver: 'Mara Voss', district: 'downtown',
    caller: { name: 'Mara Voss', role: 'Fixer', line: 'Two stars, then vanish. Make the cops look stupid.' },
    brief: 'Outrun the law: get to 2 stars, then lose the tail completely.',
    objective: 'Reach 2 stars, then lose the police', target: null, reward: 600,
    onStart(G) { call(G, 'setObjective', 'Reach 2 stars, then lose the police', null); call(G, 'setWanted', 2); },
  }),
  mission({
    id: 4, title: 'The Exchange', giver: 'Mara Voss', district: 'downtown',
    caller: { name: 'Mara Voss', role: 'Fixer', line: 'Package goes downtown. If it smells like a trap, it is.' },
    brief: 'Deliver the package downtown. It is an ambush — three Vultures wait.',
    objective: 'Deliver the package downtown', target: EXCHANGE_POS, reward: 900,
    onStart(G) { call(G, 'setObjective', 'Deliver the package downtown', EXCHANGE_POS); },
  }),
  mission({
    id: 5, title: 'Air Support', giver: 'Mara Voss', district: 'downtown',
    caller: { name: 'Mara Voss', role: 'Fixer', line: 'AIR-1 doesn\'t blink. Break line of sight and stay gone.' },
    brief: 'AIR-1 is overhead at 3 stars. Break line of sight and vanish.',
    objective: 'Escape AIR-1 at 3 stars', target: null, reward: 1200,
    onStart(G) { call(G, 'setObjective', 'Escape AIR-1 — lose all wanted stars', null); call(G, 'setWanted', 3); },
  }),
  mission({
    id: 6, title: 'Roadblock Run', giver: 'Mara Voss', district: 'downtown',
    caller: { name: 'Mara Voss', role: 'Fixer', line: 'Two roadblocks, one pedal. Don\'t lift.' },
    brief: 'Smash through 2 SMPD roadblocks. Keep your foot down.',
    objective: 'Smash through 2 roadblocks', target: null, reward: 1500,
    onStart(G) { call(G, 'setObjective', 'Smash through 2 roadblocks', null); call(G, 'setWanted', 3); },
  }),
  mission({
    id: 7, title: 'The Heist', giver: 'Mara Voss', district: 'downtown',
    caller: { name: 'Mara Voss', role: 'Fixer', line: 'Bank\'s got the money. Bring it home and we eat.' },
    brief: 'Rob the Solmara Bank, then get the money back to the Ember Garage.',
    objective: 'Rob the Solmara Bank', target: BANK_POS, reward: 2500,
    onStart(G) { call(G, 'setObjective', 'Rob the Solmara Bank', BANK_POS); },
  }),
  mission({
    id: 8, title: 'Payback', giver: 'Mara Voss', district: 'port',
    caller: { name: 'Mara Voss', role: 'Fixer', line: 'Five Vultures at the port. Rook\'s boys don\'t get second chances.' },
    brief: 'Take down Silas Rook\'s crew at the port. Five Vultures. No mercy.',
    objective: 'Take down 5 Vultures at the port', target: PORT_POS, reward: 4000,
    onStart(G) { call(G, 'setObjective', 'Take down 5 Vultures at the port', PORT_POS); },
  }),
  mission({
    id: 9, title: 'Clean Getaway', giver: 'Mara Voss', district: 'downtown',
    caller: { name: 'Mara Voss', role: 'Fixer', line: 'Five stars. Whole city hunting. Make them regret it.' },
    brief: 'Five stars. The whole city is hunting you. Escape it clean.',
    objective: 'Escape a 5-star wanted level', target: null, reward: 5000,
    onStart(G) { call(G, 'setObjective', 'Escape a 5-star wanted level', null); call(G, 'setWanted', 5); },
    extra(G) { call(G, 'showBanner', 'SOLMARA LEGEND', 'Clean getaway — the city knows your name'); },
  }),
  mission({
    id: 10, title: 'New Blood', giver: 'Mara Voss', district: 'hills',
    caller: { name: 'Jax Calloway', role: 'Crew — Driver', line: 'You the pickup? Drive like you mean it, I got your back.' },
    brief: 'Pick up Jax Calloway in the north hills during a 2-star chase, then lose the tail.',
    objective: 'Pick up Jax in the north hills', target: HILLS_POS, reward: 5500,
    onStart(G) { call(G, 'setObjective', 'Pick up Jax in the north hills', HILLS_POS); },
    extra(G) { call(G, 'recruitCrew', 'jax'); },
  }),
  mission({
    id: 11, title: 'Ghost Ride', giver: 'Mara Voss', district: 'port',
    caller: { name: 'Lena', role: 'Crew — Wheelwoman', line: 'That\'s my car. One scratch and you\'re walking home.' },
    brief: 'Midnight port run: deliver Lena\'s car to the Ember Garage without a scratch.',
    objective: 'Deliver Lena\'s car to the Ember Garage', target: PORT_POS, reward: 6500,
    onStart(G) { call(G, 'setObjective', 'Pick up Lena\'s car at the port', PORT_POS); },
    extra(G) { call(G, 'recruitCrew', 'lena'); },
  }),
  mission({
    id: 12, title: 'King of Solmara', giver: 'Mara Voss', district: 'port',
    caller: { name: 'Mara Voss', role: 'Fixer', line: 'Gold convoy at the port. This is the one that makes us kings.' },
    brief: 'Steal the Vultures\' gold convoy truck at the port, survive 5 stars, deliver the gold.',
    objective: 'Steal the gold convoy truck', target: PORT_POS, reward: 8000,
    onStart(G) { call(G, 'setObjective', 'Steal the gold convoy truck at the port', PORT_POS); },
    extra(G) {
      // Rank up to KING OF SOLMARA: top respect up to 2500 if a rank helper exists.
      try {
        const cur = (G.respect && typeof G.respect.points === 'number') ? G.respect.points : 0;
        if (cur < 2500 && typeof helpers(G).addRespect === 'function') helpers(G).addRespect(2500 - cur);
      } catch (e) {}
      call(G, 'showBanner', 'SOLMARA LEGEND', 'King of Solmara — the gold is yours');
    },
  }),
  mission({
    id: 13, title: 'Street Kings', giver: 'Mara Voss', district: 'downtown',
    caller: { name: 'Jax Calloway', role: 'Crew — Driver', line: 'Three rings, ninety seconds. Don\'t let that red car beat you.' },
    brief: 'Race 3 checkpoint rings downtown in 90s against a Vultures rival car. Win and the streets are yours.',
    objective: 'Win the downtown race (3 checkpoints, 90s)', target: RACE_POINTS[0], reward: 6000,
    onStart(G) {
      call(G, 'setObjective', 'Race: hit 3 checkpoints in 90s', RACE_POINTS[0]);
      startRace(G, raceCheckpoints(G), raceParTime(G));
      if (G.race) G.race.missionId = 13;
      // Rival car: a traffic car following the checkpoint route at fixed speed.
      const pts = raceCheckpoints(G);
      const rival = makeCarAt(G, 0x8a1a1a, 'traffic', {});
      if (rival && rival.pos) {
        rival.pos.x = pts[0].x - 6; rival.pos.z = pts[0].z + 4;
        if (G.cars) G.cars.push(rival);
        if (G.race) G.race.rival = rival;
      }
      call(G, 'playSound', 'race');
    },
  }),
  mission({
    id: 14, title: 'Silent Harbor', giver: 'Mara Voss', district: 'port',
    caller: { name: 'Lena', role: 'Crew — Wheelwoman', line: 'Quiet, yeah? One siren and the ledger\'s worthless.' },
    brief: 'Reach the port office, hold E for 3s to pick the lock, grab the ledger, return to the garage — never hit 2 stars.',
    objective: 'Pick the lock at the port office', target: OFFICE_POS, reward: 7500,
    onStart(G) {
      call(G, 'setObjective', 'Reach the port office — stay quiet', OFFICE_POS);
      if (G.missions) { G.missions.lockpick = 0; G.missions.lockStart = null; }
      if (G.state) G.state.lockpickProgress = 0;
    },
  }),
  mission({
    id: 15, title: 'End of the Vultures', giver: 'Mara Voss', district: 'port',
    caller: { name: 'Mara Voss', role: 'Fixer', line: 'Rook ends tonight. Finish it and Solmara is ours.' },
    brief: 'Finale: assault the Vultures\' compound, chase Rook\'s fleeing car, finish him on foot.',
    objective: 'Assault the Vultures\' compound', target: COMPOUND_POS, reward: 12000,
    onStart(G) { call(G, 'setObjective', 'Assault the Vultures\' compound', COMPOUND_POS); },
    extra(G) {
      call(G, 'storeCar', { color: 0x1a1a1a, paint: 'Crimson', upgrade: 3, name: 'Vulture GT' });
      call(G, 'addRespect', 1200);
      call(G, 'showBanner', 'SOLMARA LEGEND', 'Rook is finished — the Vulture GT is yours');
    },
  }),
];

export function initMissions(G) {
  if (!G) return;
  const idx = Math.max(0, Math.min(14, (G.state && typeof G.state.missionIndex === 'number') ? G.state.missionIndex : 0));
  G.missions = {
    list: MISSIONS,
    currentIndex: idx,
    current: MISSIONS[idx],
    stage: 0,
    killsAtStart: 0,
    driveTime: 0,
    passedBlocks: [],
    lockpick: 0,
    lockStart: null,
    chaseTime: 0,
    data: {},
  };
  if (G.state) G.state.missionIndex = idx;
  try {
    if (typeof helpers(G).setObjective === 'function') {
      const cur = MISSIONS[idx];
      if (cur && typeof cur.onStart === 'function') cur.onStart(G);
    }
  } catch (e) {}
  G.helpers.setObjective = (text, target) => {
    if (!G.state) return;
    G.state.objectiveText = text || '';
    G.state.objectiveTarget = target || null;
  };
  G.helpers.startRace = (checkpoints, parTime) => startRace(G, checkpoints, parTime);
  G.helpers.missionById = (id) => MISSIONS.find((m) => m.id === id) || null;
}

function completeMission(G, m) {
  if (!G || !G.missions) return;
  try { if (m && typeof m.onDone === 'function') m.onDone(G); } catch (e) {}
  const next = Math.min(G.missions.currentIndex + 1, 14);
  G.missions.currentIndex = next;
  G.missions.stage = 0; G.missions.killsAtStart = 0; G.missions.driveTime = 0;
  G.missions.passedBlocks = []; G.missions.lockpick = 0; G.missions.lockStart = null; G.missions.chaseTime = 0;
  if (G.state) G.state.missionIndex = next;
  if (next >= 14 && m && m.id === 15) {
    G.missions.current = MISSIONS[14];
    call(G, 'setObjective', 'All missions complete — Solmara is yours', null);
    return;
  }
  const cur = MISSIONS[next];
  G.missions.current = cur;
  try { if (cur && typeof cur.onStart === 'function') cur.onStart(G); } catch (e) {}
}

function failMission(G, msg) {
  const cur = G.missions && G.missions.current;
  if (!cur) return;
  G.missions.stage = 0; G.missions.killsAtStart = 0; G.missions.lockpick = 0;
  G.missions.lockStart = null; G.missions.chaseTime = 0;
  if (G.state) G.state.lockpickProgress = 0;
  call(G, 'showBanner', msg || 'MISSION FAILED', 'Try again from the start');
  try { if (typeof cur.onStart === 'function') cur.onStart(G); } catch (e) {}
}

function updateRace(G, dt) {
  const race = G.race;
  if (!race || !race.active) return;
  const p = playerPos(G);
  // Rival car follows the checkpoint route at a fixed speed.
  if (race.rival && race.rival.pos && race.checkpoints.length) {
    const wp = race.checkpoints[Math.min(race.rivalWp || 0, race.checkpoints.length - 1)];
    const dx = wp.x - race.rival.pos.x, dz = wp.z - race.rival.pos.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < 4) { race.rivalWp = Math.min((race.rivalWp || 0) + 1, race.checkpoints.length - 1); }
    else {
      const sp = 22 * dt;
      race.rival.pos.x += (dx / d) * sp;
      race.rival.pos.z += (dz / d) * sp;
      race.rival.heading = Math.atan2(dx, dz);
    }
  }
  if (!p) return;
  // Race clock: running past par time ends the race with no payout.
  const elapsed = ((G.state && typeof G.state.time === 'number') ? G.state.time : 0) - race.startTime;
  if (elapsed > race.parTime) {
    finishRace(G, elapsed);
    if (race.missionId === 13) {
      // Mission 13 failed the clock: restart the race from its start.
      const m13 = MISSIONS[12];
      try { if (typeof m13.onStart === 'function') m13.onStart(G); } catch (e) {}
    }
    return;
  }
  const cp = race.checkpoints[race.current];
  if (cp && dist2d(p, cp) <= 6) {
    race.current += 1;
    call(G, 'playSound', 'pickup');
    try {
      const mk = (G.city && G.city.makeCheckpointRing) || helpers(G).makeCheckpointRing;
      const nextCp = race.checkpoints[race.current];
      if (typeof mk === 'function' && nextCp) mk(G, nextCp.x, nextCp.z, race.current);
    } catch (e) {}
    if (race.current >= race.checkpoints.length) {
      const elapsed = ((G.state && typeof G.state.time === 'number') ? G.state.time : 0) - race.startTime;
      const tier = finishRace(G, elapsed);
      if (race.missionId === 13 && tier) {
        const m = MISSIONS[12];
        completeMission(G, m);
      }
    }
  }
}

export function updateMissions(G, dt) {
  if (!G || !G.state || G.state.paused) return;
  updateRace(G, dt);
  const M = G.missions;
  if (!M || !M.current || !G.state.started) return;
  const cur = M.current;
  const wanted = G.state.wanted || 0;
  const kills = G.state.kills || 0;

  switch (cur.id) {
    case 1:
      if (arrived(G, garagePos(G), 8)) completeMission(G, cur);
      break;
    case 2:
      if (M.stage === 0) {
        if (G.state.inVehicle) {
          M.stage = 1;
          call(G, 'setObjective', 'Deliver the car to the port', PORT_POS);
        }
      } else if (arrived(G, PORT_POS, 8)) completeMission(G, cur);
      break;
    case 3:
      if (M.stage === 0) {
        if (wanted >= 2) M.stage = 1;
      } else if (wanted <= 0) completeMission(G, cur);
      break;
    case 4:
      if (M.stage === 0) {
        if (arrived(G, EXCHANGE_POS, 8)) {
          M.stage = 1;
          M.killsAtStart = kills;
          spawnEnemyAt(G, EXCHANGE_POS.x + 6, EXCHANGE_POS.z + 4);
          spawnEnemyAt(G, EXCHANGE_POS.x - 6, EXCHANGE_POS.z + 2); spawnEnemyAt(G, EXCHANGE_POS.x + 2, EXCHANGE_POS.z - 8);
          call(G, 'setObjective', 'Ambush! Take down 3 Vultures', EXCHANGE_POS);
        }
      } else if (kills - M.killsAtStart >= 3) completeMission(G, cur);
      break;
    case 5:
      if (wanted <= 0) completeMission(G, cur);
      break;
    case 6: {
      const blocks = (G.police && Array.isArray(G.police.roadblocks)) ? G.police.roadblocks : [];
      let smashed = 0;
      const p = playerPos(G);
      if (p) {
        for (const rb of blocks) {
          const rp = (rb && rb.pos) || (rb && rb.group && rb.group.position) || rb;
          if (rp && typeof rp.x === 'number' && dist2d(p, rp) <= 4 && !M.passedBlocks.includes(rb)) {
            M.passedBlocks.push(rb);
          }
        }
        smashed = M.passedBlocks.length;
      }
      if (blocks.length === 0) {
        // No roadblocks spawned yet (defensive): driving time counts instead.
        if (G.state.inVehicle) M.driveTime += dt;
        if (M.driveTime >= 20) completeMission(G, cur);
      } else if (smashed >= 2) completeMission(G, cur);
      break;
    }
    case 7:
      if (M.stage === 0) {
        if (arrived(G, BANK_POS, 8)) {
          M.stage = 1;
          M.killsAtStart = kills;
          spawnEnemyAt(G, BANK_POS.x + 5, BANK_POS.z + 5);
          spawnEnemyAt(G, BANK_POS.x - 5, BANK_POS.z - 3);
          call(G, 'setObjective', 'Take the money — clear the guards', BANK_POS);
        }
      } else if (M.stage === 1) {
        if (kills - M.killsAtStart >= 2) {
          M.stage = 2;
          call(G, 'setObjective', 'Get the money to the Ember Garage', garagePos(G));
        }
      } else if (arrived(G, garagePos(G), 8)) completeMission(G, cur);
      break;
    case 8:
      if (M.stage === 0) {
        if (arrived(G, PORT_POS, 10)) {
          M.stage = 1;
          M.killsAtStart = kills;
          for (let i = 0; i < 5; i++) spawnEnemyAt(G, PORT_POS.x + (i - 2) * 6, PORT_POS.z + (i % 2) * 8 - 4);
          call(G, 'setObjective', 'Take down 5 Vultures', PORT_POS);
        }
      } else if (kills - M.killsAtStart >= 5) completeMission(G, cur);
      break;
    case 9:
      if (wanted <= 0) completeMission(G, cur);
      break;
    case 10:
      if (M.stage === 0) {
        if (arrived(G, HILLS_POS, 8)) {
          M.stage = 1;
          call(G, 'setWanted', 2);
          call(G, 'setObjective', 'Jax is in — lose the tail', null);
          call(G, 'showBanner', 'JAX IS IN', 'Lose the 2-star tail');
        }
      } else if (wanted <= 0) completeMission(G, cur);
      break;
    case 11:
      if (M.stage === 0) {
        if (arrived(G, PORT_POS, 8)) {
          M.stage = 1;
          call(G, 'setObjective', 'Deliver Lena\'s car to the Ember Garage — stay clean', garagePos(G));
        }
      } else if (arrived(G, garagePos(G), 8)) {
        if (wanted > 0) {
          M.stage = 0;
          call(G, 'showBanner', 'SPOTTED', 'The police saw you — start the run over');
          call(G, 'setObjective', 'Pick up Lena\'s car at the port', PORT_POS);
        } else completeMission(G, cur);
      }
      break;
    case 12:
      if (M.stage === 0) {
        if (arrived(G, PORT_POS, 10)) {
          M.stage = 1;
          call(G, 'setWanted', 5);
          call(G, 'setObjective', 'Survive 5 stars — then deliver the gold', null);
        }
      } else if (M.stage === 1) {
        if (wanted <= 2) {
          M.stage = 2;
          call(G, 'setObjective', 'Deliver the gold to the Ember Garage', garagePos(G));
        }
      } else if (arrived(G, garagePos(G), 8)) completeMission(G, cur);
      break;
    case 13:
      // Race progress is handled by updateRace; mission completes there.
      if (!(G.race && G.race.active)) {
        // Race ended without a finish (e.g. reloaded mid-race): restart it.
        if (M.stage === 0) { M.stage = 1; try { if (typeof cur.onStart === 'function') cur.onStart(G); } catch (e) {} }
      }
      break;
    case 14: {
      const office = officePos(G);
      if (wanted >= 2) { failMission(G, 'BLOWN — the Vultures know'); break; }
      if (M.stage === 0) {
        if (arrived(G, office, 3)) {
          M.stage = 1;
          M.lockpick = 0;
          M.lockStart = playerPos(G);
          call(G, 'setObjective', 'Hold E to pick the lock (3s)', office);
        }
      } else if (M.stage === 1) {
        const p = playerPos(G);
        const holdingE = !!(G.input && G.input.keys && G.input.keys.has('KeyE'));
        if (p && M.lockStart && dist2d(p, M.lockStart) > 1) {
          M.lockpick = 0;
          M.lockStart = p;
        }
        if (holdingE && p && dist2d(p, office) <= 3) {
          M.lockpick = Math.min(1, M.lockpick + dt / 3);
          if (G.state) G.state.lockpickProgress = M.lockpick;
          if (M.lockpick >= 1) {
            M.stage = 2;
            call(G, 'showBanner', 'LEDGER GRABBED', 'Get back to the Ember Garage');
            call(G, 'setObjective', 'Return the ledger to the Ember Garage', garagePos(G));
          }
        } else if (G.state) G.state.lockpickProgress = M.lockpick;
      } else if (arrived(G, garagePos(G), 8)) completeMission(G, cur);
      break;
    }
    case 15: {
      const compound = COMPOUND_POS;
      if (M.stage === 0) {
        if (arrived(G, compound, 12)) {
          M.stage = 1;
          M.killsAtStart = kills;
          for (let i = 0; i < 6; i++) spawnEnemyAt(G, compound.x + (i - 2.5) * 7, compound.z + (i % 2) * 9 - 4);
          spawnEnemyAt(G, compound.x, compound.z - 12, { hp: 300 });
          call(G, 'setObjective', 'Clear the compound — Rook is here', compound);
        }
      } else if (M.stage === 1) {
        if (kills - M.killsAtStart >= 7) {
          M.stage = 2;
          M.chaseTime = 0;
          call(G, 'setWanted', 4);
          call(G, 'setObjective', 'Chase Rook\'s fleeing car', compound);
          const rookCar = makeCarAt(G, 0x1a1a1a, 'traffic', {});
          if (rookCar && rookCar.pos) {
            rookCar.pos.x = compound.x + 20; rookCar.pos.z = compound.z + 10;
            if (G.cars) G.cars.push(rookCar);
            M.data.rookCar = rookCar;
          }
        }
      } else if (M.stage === 2) {
        const rc = M.data.rookCar;
        const p = playerPos(G);
        if (rc && rc.pos && p && dist2d(p, rc.pos) <= 10) {
          M.chaseTime += dt;
          if (M.chaseTime >= 2) {
            M.stage = 3;
            M.killsAtStart = kills;
            spawnEnemyAt(G, compound.x, compound.z, { hp: 300 });
            spawnEnemyAt(G, compound.x + 6, compound.z + 4);
            spawnEnemyAt(G, compound.x - 6, compound.z + 4);
            call(G, 'setObjective', 'Final showdown — finish Rook', compound);
          }
        } else M.chaseTime = 0;
      } else if (kills - M.killsAtStart >= 3) completeMission(G, cur);
      break;
    }
    default:
      break;
  }
}
