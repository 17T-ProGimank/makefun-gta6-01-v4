// SOLMARA round 6 — audio (session D, fresh rewrite).
// WebAudio only, NO audio files. 4 procedural radio stations + DJ idents,
// synthesised SFX, engine hum that follows speed.
// New in round 6: a 'district' chime (two-note, distinct from 'cash').

const STATIONS = [
  { name: 'SOL FM', wave: 'sine', bpm: 100, root: 220.0,
    scale: [0, 2, 4, 7, 9, 12, 14, 16],
    dj: 'Sunny', lines: [
      ['Sunny on SOL FM', 'Golden hour on SOL FM — "Sunset Boulevard"'],
      ['Sunny on SOL FM', 'Cruisin\' Solmara — "Palm Tree Nights"'],
    ] },
  { name: 'EMBER ROCK', wave: 'square', bpm: 140, root: 164.81,
    scale: [0, 3, 5, 7, 10, 12, 15, 17],
    dj: 'Rex', lines: [
      ['Rex on EMBER ROCK', 'Turn it up — "Gasoline Heart"'],
      ['Rex on EMBER ROCK', 'Loud and loose — "Vulture Bait"'],
    ] },
  { name: 'BAY BASS', wave: 'sawtooth', bpm: 120, root: 110.0,
    scale: [0, 3, 5, 6, 7, 10, 12, 15],
    dj: 'Marina', lines: [
      ['Marina on BAY BASS', 'Low tide, deep bass — "Harbor Lights"'],
      ['Marina on BAY BASS', 'Feel the swell — "Port Authority"'],
    ] },
  { name: 'SOLMARA NIGHTS', wave: 'triangle', bpm: 90, root: 196.0,
    scale: [0, 2, 3, 5, 7, 8, 10, 12],
    dj: 'Nocturne', lines: [
      ['Nocturne on SOLMARA NIGHTS', 'Slow lights, slow miles — "Afterglow"'],
      ['Nocturne on SOLMARA NIGHTS', 'City asleep, radio awake — "Midnight Ferry"'],
    ] },
];

function $(id) {
  return (typeof document !== 'undefined') ? document.getElementById(id) : null;
}

function semitone(root, steps) {
  return root * Math.pow(2, steps / 12);
}

export function initAudio(G) {
  G.audio = G.audio || {};
  const A = G.audio;
  A.ctx = A.ctx || null;
  A.master = A.master || null;
  A.engineOsc = A.engineOsc || null;
  A.engineGain = A.engineGain || null;
  A.noiseBuf = A.noiseBuf || null;
  A.nextNoteTime = 0;
  A.noteStep = 0;
  A.djTimer = 45;
  A.djLine = 0;
  A.sirenUntil = 0;

  // Persisted radio state (save.js v3/v4 payload), defensive defaults OFF / 0.
  const saved = G.saveData || null;
  if (saved) {
    A.radioOn = saved.radioOn === true || saved.radio === true;
    const st = (saved.radioStation != null) ? saved.radioStation
      : (saved.station != null ? saved.station : 0);
    A.station = Math.max(0, Math.min(3, Number(st) || 0));
  } else {
    A.radioOn = A.radioOn === true;
    A.station = Math.max(0, Math.min(3, Number(A.station) || 0));
  }

  if (G.helpers) {
    G.helpers.playSound = (name) => playSound(G, name);
    G.helpers.resumeAudio = () => ensureCtx(G, true);
    G.helpers.cycleStation = () => cycleStation(G);
    G.helpers.setStation = (i) => {
      A.station = Math.max(0, Math.min(3, Number(i) || 0));
      A.noteStep = 0;
      updateRadioBox(G);
    };
  }
  updateRadioBox(G);
}

function ensureCtx(G, fromGesture) {
  const A = G.audio || {};
  if (typeof window === 'undefined' || !window.AudioContext) return null;
  if (!A.ctx) {
    try {
      A.ctx = new window.AudioContext();
      A.master = A.ctx.createGain();
      A.master.gain.value = 0.5;
      A.master.connect(A.ctx.destination);
      // Shared white-noise buffer for burst sounds.
      const len = A.ctx.sampleRate;
      A.noiseBuf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
      const data = A.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      startEngineHum(G);
    } catch (e) { A.ctx = null; return null; }
  }
  if (A.ctx && A.ctx.state === 'suspended' && fromGesture) {
    A.ctx.resume().catch(() => { /* ignore */ });
  }
  return A.ctx;
}

function startEngineHum(G) {
  const A = G.audio;
  if (!A.ctx || A.engineOsc) return;
  try {
    A.engineOsc = A.ctx.createOscillator();
    A.engineOsc.type = 'sawtooth';
    A.engineOsc.frequency.value = 55;
    A.engineGain = A.ctx.createGain();
    A.engineGain.gain.value = 0.0;
    const filt = A.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 320;
    A.engineOsc.connect(filt);
    filt.connect(A.engineGain);
    A.engineGain.connect(A.master);
    A.engineOsc.start();
  } catch (e) { A.engineOsc = null; }
}

function tone(G, freq, dur, type, vol, when, slideTo) {
  const A = G.audio;
  if (!A.ctx || !A.master) return;
  try {
    const t0 = (when != null) ? when : A.ctx.currentTime;
    const osc = A.ctx.createOscillator();
    const g = A.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol || 0.25, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(A.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  } catch (e) { /* ignore */ }
}

function noiseBurst(G, dur, vol, filterFreq, type) {
  const A = G.audio;
  if (!A.ctx || !A.master || !A.noiseBuf) return;
  try {
    const t0 = A.ctx.currentTime;
    const src = A.ctx.createBufferSource();
    src.buffer = A.noiseBuf;
    src.loop = true;
    const filt = A.ctx.createBiquadFilter();
    filt.type = type || 'lowpass';
    filt.frequency.value = filterFreq || 1200;
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.4, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(A.master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  } catch (e) { /* ignore */ }
}

function playSound(G, name) {
  const ctx = ensureCtx(G, true);
  if (!ctx) return;
  const A = G.audio;
  switch (name) {
    case 'shot':
    case 'gunshot':
      noiseBurst(G, 0.12, 0.5, 3000, 'highpass');
      tone(G, 180, 0.08, 'square', 0.2, null, 60);
      break;
    case 'explosion':
      noiseBurst(G, 0.9, 0.7, 300);
      tone(G, 90, 0.7, 'sine', 0.5, null, 30);
      break;
    case 'siren': {
      // Two-tone wail, ~1.2s.
      const t0 = A.ctx.currentTime;
      tone(G, 750, 0.3, 'sine', 0.12, t0);
      tone(G, 950, 0.3, 'sine', 0.12, t0 + 0.3);
      tone(G, 750, 0.3, 'sine', 0.12, t0 + 0.6);
      tone(G, 950, 0.3, 'sine', 0.12, t0 + 0.9);
      break;
    }
    case 'pickup':
      tone(G, 660, 0.12, 'sine', 0.25);
      tone(G, 990, 0.2, 'sine', 0.25, A.ctx.currentTime + 0.1);
      break;
    case 'cash':
      // Two-note chime, bright major third.
      tone(G, 1318.5, 0.14, 'sine', 0.28);
      tone(G, 1568, 0.22, 'sine', 0.28, A.ctx.currentTime + 0.12);
      break;
    case 'district':
      // Round-6 tier-up chime: low fifth, distinct from 'cash'.
      tone(G, 523.25, 0.16, 'triangle', 0.3);
      tone(G, 783.99, 0.3, 'triangle', 0.3, A.ctx.currentTime + 0.14);
      break;
    case 'gull':
      // Chime arpeggio.
      [1046.5, 1318.5, 1568].forEach((f, i) => {
        tone(G, f, 0.18, 'sine', 0.22, A.ctx.currentTime + i * 0.09);
      });
      break;
    case 'race':
      // Countdown beeps: three short, one long high.
      [0, 0.35, 0.7].forEach((off) => tone(G, 880, 0.12, 'square', 0.2, A.ctx.currentTime + off));
      tone(G, 1320, 0.4, 'square', 0.25, A.ctx.currentTime + 1.05);
      break;
    case 'spike':
      noiseBurst(G, 0.08, 0.5, 4000, 'highpass');
      noiseBurst(G, 0.5, 0.18, 6000, 'highpass');
      break;
    case 'weapon':
      // Click-clack switch.
      noiseBurst(G, 0.05, 0.35, 2500, 'bandpass');
      tone(G, 220, 0.05, 'square', 0.15, A.ctx.currentTime + 0.08);
      noiseBurst(G, 0.05, 0.3, 1800, 'bandpass');
      break;
    case 'click':
      tone(G, 1200, 0.05, 'square', 0.12);
      break;
    case 'mission':
      [523.25, 659.25, 783.99].forEach((f, i) => {
        tone(G, f, 0.2, 'triangle', 0.25, A.ctx.currentTime + i * 0.11);
      });
      break;
    case 'engine':
      tone(G, 70, 0.3, 'sawtooth', 0.15, null, 140);
      break;
    default:
      tone(G, 440, 0.1, 'sine', 0.15);
      break;
  }
}

function cycleStation(G) {
  const A = G.audio || {};
  A.station = ((A.station || 0) + 1) % STATIONS.length;
  A.noteStep = 0;
  A.djTimer = 45;
  updateRadioBox(G);
  if (G.helpers && G.helpers.showBanner) {
    const s = STATIONS[A.station];
    G.helpers.showBanner(s.name, 'DJ ' + s.dj + ' — now playing');
  }
}

function updateRadioBox(G) {
  const box = $('radio-box') || $('radio') || $('radio-name');
  const A = G.audio || {};
  if (box) {
    box.textContent = A.radioOn ? STATIONS[A.station || 0].name : 'RADIO OFF';
  }
  if (G.hud && G.hud.el && G.hud.el['radio-box']) {
    G.hud.el['radio-box'].textContent = A.radioOn ? STATIONS[A.station || 0].name : 'RADIO OFF';
  }
}

function updateRadio(G, dt) {
  const A = G.audio || {};
  if (!A.radioOn || !A.ctx || A.ctx.state !== 'running') return;
  const st = STATIONS[A.station || 0];
  const beat = 60 / st.bpm;
  if (!A.nextNoteTime || A.nextNoteTime < A.ctx.currentTime) {
    A.nextNoteTime = A.ctx.currentTime + 0.05;
  }
  // Schedule notes a little ahead of the playhead.
  while (A.nextNoteTime < A.ctx.currentTime + 0.15) {
    const step = A.noteStep || 0;
    const degree = st.scale[step % st.scale.length];
    const freq = semitone(st.root, degree + 12 * Math.floor(step / st.scale.length) % 2);
    // Melody note + soft bass on the downbeat.
    tone(G, freq, beat * 0.9, st.wave, 0.10, A.nextNoteTime);
    if (step % 4 === 0) tone(G, st.root / 2, beat * 0.9, 'sine', 0.14, A.nextNoteTime);
    A.nextNoteTime += beat;
    A.noteStep = step + 1;
  }
}

export function updateAudio(G, dt) {
  const A = G.audio || {};
  const keys = (G.input && G.input.keys) || new Set();

  // R cycles stations (edge-triggered).
  if (keys.has('KeyR') && !A.prevR && G.state && G.state.started) {
    if (!A.radioOn) {
      A.radioOn = true;
      A.noteStep = 0;
      A.djTimer = 45; // fresh ident countdown when the radio is switched on
      A.nextNoteTime = 0;
      ensureCtx(G, true);
    } else {
      cycleStation(G);
    }
    updateRadioBox(G);
  }
  A.prevR = keys.has('KeyR');

  // Radio sequencer + DJ idents while the radio is on.
  updateRadio(G, dt);
  if (A.radioOn && G.state && G.state.started) {
    A.djTimer = (A.djTimer == null ? 45 : A.djTimer) - (dt || 0);
    if (A.djTimer <= 0) {
      A.djTimer = 45;
      const st = STATIONS[A.station || 0];
      const line = st.lines[A.djLine % st.lines.length];
      A.djLine = (A.djLine || 0) + 1;
      if (G.helpers && typeof G.helpers.showBanner === 'function') {
        try { G.helpers.showBanner(line[0], line[1]); } catch (e) { /* ignore */ }
      }
    }
  }

  // Engine hum follows speed; silent on foot / before the first gesture.
  if (A.ctx && A.engineOsc && A.engineGain && A.ctx.state === 'running') {
    const speed = Math.abs((G.state && G.state.speed) || 0);
    const driving = G.state && G.state.inVehicle;
    const target = (G.state && G.state.started && driving) ? 0.05 + Math.min(0.12, speed * 0.003) : 0.0;
    try {
      A.engineGain.gain.setTargetAtTime(target, A.ctx.currentTime, 0.1);
      A.engineOsc.frequency.setTargetAtTime(55 + speed * 2.2, A.ctx.currentTime, 0.1);
    } catch (e) { /* ignore */ }
  }
}
