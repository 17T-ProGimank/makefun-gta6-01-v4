// SOLMARA round 6 — district standing: per-district reputation (0-100).
// Tiers: UNKNOWN 0, KNOWN 20, RESPECTED 40, FEARED 60, LEGEND 80.
// Earned by missions (+4), seagulls (+2) and gold races (+2); each tier
// adds +5% to mission payouts in that district. Imported data only —
// DISTRICTS, DISTRICT_TIERS and DISTRICT_STANDING live in config.js.
import { DISTRICTS, DISTRICT_TIERS, DISTRICT_STANDING } from './config.js';
import { districtAt as cityDistrictAt } from './city.js';

export const DISTRICT_IDS = ['downtown', 'port', 'beach', 'westside', 'hills'];

export function districtTier(points) {
  const p = Math.max(0, Math.min(100, Number(points) || 0));
  const tiers = Array.isArray(DISTRICT_TIERS) ? DISTRICT_TIERS : [];
  let index = 0;
  for (let i = 0; i < tiers.length; i++) {
    const at = tiers[i] && typeof tiers[i].at === 'number' ? tiers[i].at : 0;
    if (p >= at) index = i;
  }
  const tier = tiers[index] || { at: 0, title: 'UNKNOWN' };
  const next = tiers[index + 1] || null;
  const span = next ? Math.max(1, next.at - tier.at) : 1;
  const progress = next ? Math.max(0, Math.min(1, (p - tier.at) / span)) : 1;
  return { index, title: tier.title || 'UNKNOWN', nextAt: next ? next.at : null, progress };
}

export function districtName(id) {
  const def = (DISTRICTS || []).find(function (d) { return d && d.id === id; });
  return (def && def.name) || String(id || 'downtown').toUpperCase();
}

export function initDistrictStanding(G) {
  if (!G) return;
  const blank = { downtown: 0, port: 0, beach: 0, westside: 0, hills: 0 };
  const saved = (G.saveData && G.saveData.districts) || null;
  G.districts = { downtown: 0, port: 0, beach: 0, westside: 0, hills: 0 };
  if (saved) {
    for (const id of Object.keys(blank)) {
      if (typeof saved[id] === 'number') {
        G.districts[id] = Math.max(0, Math.min(100, saved[id]));
      }
    }
  }
  if (!G.state) G.state = {};
  if (!G.state.currentDistrict) G.state.currentDistrict = 'downtown';
  if (!G.helpers) G.helpers = {};
  const h = G.helpers;

  h.addDistrictStanding = function (id, n) {
    if (!G.districts || !id || typeof G.districts[id] !== 'number') return;
    const before = districtTier(G.districts[id]);
    G.districts[id] = Math.max(0, Math.min(100, G.districts[id] + (Number(n) || 0)));
    const after = districtTier(G.districts[id]);
    if (after.index > before.index) {
      if (typeof h.showBanner === 'function') {
        try { h.showBanner(districtName(id) + ' — ' + after.title, 'District standing up'); } catch (e) {}
      }
      if (typeof h.playSound === 'function') {
        try { h.playSound('cash'); } catch (e) {}
      }
    }
    if (typeof h.saveGame === 'function') {
      try { h.saveGame(); } catch (e) {}
    }
  };

  h.districtStanding = function (id) {
    const points = (G.districts && typeof G.districts[id] === 'number') ? G.districts[id] : 0;
    const t = districtTier(points);
    return { points, tier: t.index, title: t.title, nextAt: t.nextAt, progress: t.progress };
  };

  h.districtPayoutBonus = function (id) {
    const perTier = (DISTRICT_STANDING && typeof DISTRICT_STANDING.payoutPerTier === 'number')
      ? DISTRICT_STANDING.payoutPerTier : 0.05;
    const points = (G.districts && typeof G.districts[id] === 'number') ? G.districts[id] : 0;
    return 1 + perTier * districtTier(points).index;
  };

  h.districtAt = function (x, z) {
    try {
      const id = cityDistrictAt(G, x, z);
      if (typeof id === 'string' && id) return id;
    } catch (e) {}
    return 'downtown';
  };
}

export function updateDistrictStanding(G, dt) {
  if (!G || !G.state) return;
  const pos = G.player && G.player.pos;
  if (!pos || typeof pos.x !== 'number' || typeof pos.z !== 'number') return;
  let id = 'downtown';
  if (G.helpers && typeof G.helpers.districtAt === 'function') {
    try { id = G.helpers.districtAt(pos.x, pos.z) || 'downtown'; } catch (e) {}
  }
  G.state.currentDistrict = id;
}
