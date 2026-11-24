// SOLMARA round 6 — respect / ranks (carried from round 4, unchanged
// contract). Points come from events: missions, seagulls, races, combat.
// Six ranks from NOBODY to KING OF SOLMARA at 2500 points.
export const RANKS = [
  { at: 0, title: 'NOBODY' },
  { at: 100, title: 'STREET HUSTLER' },
  { at: 300, title: 'WHEELMAN' },
  { at: 700, title: 'MADE' },
  { at: 1400, title: 'SHOT CALLER' },
  { at: 2500, title: 'KING OF SOLMARA' }
];

function rankFor(points) {
  const p = Math.max(0, Number(points) || 0);
  let index = 0;
  for (let i = 0; i < RANKS.length; i++) {
    if (p >= RANKS[i].at) index = i;
  }
  const next = RANKS[index + 1] || null;
  return { title: RANKS[index].title, points: p, nextAt: next ? next.at : null };
}

export function initRespect(G) {
  if (!G) return;
  G.respect = { points: 0 };
  if (!G.helpers) G.helpers = {};
  const h = G.helpers;

  h.addRespect = function (n) {
    if (!G.respect) G.respect = { points: 0 };
    const before = rankFor(G.respect.points);
    G.respect.points = Math.max(0, G.respect.points + (Number(n) || 0));
    const after = rankFor(G.respect.points);
    if (after.title !== before.title) {
      const sub = after.nextAt != null
        ? 'Respect ' + after.points + ' — next rank at ' + after.nextAt
        : 'Respect ' + after.points + ' — top rank reached';
      if (typeof h.showBanner === 'function') {
        try { h.showBanner('RANK UP — ' + after.title, sub); } catch (e) {}
      }
      if (typeof h.playSound === 'function') {
        try { h.playSound('cash'); } catch (e) {}
      }
    }
    if (typeof h.saveGame === 'function') {
      try { h.saveGame(); } catch (e) {}
    }
  };

  h.respectRank = function () {
    return rankFor(G.respect ? G.respect.points : 0);
  };
}

export function updateRespect(G, dt) {
  // No-op: respect points only change via events (missions, seagulls,
  // races, combat) calling G.helpers.addRespect.
}
