// SOLMARA round 6 — input (carried from the base spec, unchanged
// contract). Tracks held keys on G.input.keys by KeyboardEvent.code
// ('KeyW', 'ShiftLeft', ...) plus accumulated mouse movement in
// G.input.mouseDX. Consumers read keys via isDown(G, code).
export function initInput(G) {
  if (!G) return;
  if (!G.input) G.input = { keys: new Set(), mouseDX: 0 };
  if (!G.input.keys) G.input.keys = new Set();
  if (typeof G.input.mouseDX !== 'number') G.input.mouseDX = 0;
  if (typeof window === 'undefined') return;
  if (G.input._bound) return;
  G.input._bound = true;
  window.addEventListener('keydown', function (e) {
    G.input.keys.add(e.code);
  });
  window.addEventListener('keyup', function (e) {
    G.input.keys.delete(e.code);
  });
  // A stuck key after alt-tab / focus loss must never linger.
  window.addEventListener('blur', function () {
    G.input.keys.clear();
  });
  window.addEventListener('mousemove', function (e) {
    G.input.mouseDX += (typeof e.movementX === 'number' ? e.movementX : 0);
  });
}

export function updateInput(G, dt) {
  // No-op after init: keys live on G.input.keys and are read directly by
  // player / vehicles / police / combat via isDown. mouseDX is consumed
  // (and reset) by whichever module steers the camera.
}

export function isDown(G, code) {
  if (!G || !G.input || !G.input.keys || !code) return false;
  if (typeof G.input.keys.has === 'function') return G.input.keys.has(code);
  if (Array.isArray(G.input.keys)) return G.input.keys.indexOf(code) !== -1;
  return false;
}
