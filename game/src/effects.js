// SOLMARA — particles, explosions, smoke and camera shake. One THREE.Points
// pool, no external textures: a canvas-generated radial sprite.
const MAX_POINTS = 900;

function makeSprite() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,220,150,0.85)');
  g.addColorStop(1, 'rgba(255,180,80,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

export function initEffects(G) {
  const tex = makeSprite();
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(MAX_POINTS * 3);
  const colors = new Float32Array(MAX_POINTS * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 1.6, map: tex, vertexColors: true, transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.visible = false;
  G.scene.add(points);
  G.effects = G.effects || {};
  G.effects.points = points;
  G.effects.particles = [];
  for (let i = 0; i < MAX_POINTS; i++) {
    G.effects.particles.push({ alive: false, x: 0, y: -100, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, r: 1, g: 0.6, b: 0.2, size: 1 });
  }
  G.effects.pool = G.effects.particles;
  G.effects.shakeAmt = 0;
  G.effects.flash = null;
  G.helpers.spawnExplosion = (pos, big) => spawnExplosion(G, pos, big);
  G.helpers.spawnSmoke = (pos) => spawnSmoke(G, pos);
  G.helpers.shake = (amt) => shake(G, amt);
}

function emit(G, x, y, z, vx, vy, vz, life, r, g, b) {
  const pool = G.effects.particles;
  for (const p of pool) {
    if (p.alive) continue;
    p.alive = true;
    p.x = x; p.y = y; p.z = z;
    p.vx = vx; p.vy = vy; p.vz = vz;
    p.life = life; p.maxLife = life;
    p.r = r; p.g = g; p.b = b;
    return;
  }
}

export function spawnExplosion(G, pos, big) {
  if (!G.effects || !G.effects.particles || !pos) return;
  const n = big ? 90 : 45;
  const power = big ? 16 : 10;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const e = (Math.random() - 0.2) * Math.PI;
    const sp = (2 + Math.random() * power);
    const hot = Math.random() < 0.6;
    emit(G,
      pos.x, (pos.y || 0) + 0.6, pos.z,
      Math.cos(a) * Math.cos(e) * sp, Math.abs(Math.sin(e)) * sp + 3, Math.sin(a) * Math.cos(e) * sp,
      0.5 + Math.random() * 0.7,
      hot ? 1 : 0.35, hot ? 0.55 + Math.random() * 0.3 : 0.25, hot ? 0.15 : 0.1);
  }
  // Smoke tail on top of the fireball.
  for (let i = 0; i < (big ? 16 : 8); i++) {
    emit(G, pos.x + (Math.random() - 0.5) * 2, (pos.y || 0) + 1 + Math.random() * 2, pos.z + (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 1.5, 2 + Math.random() * 2, (Math.random() - 0.5) * 1.5,
      1.2 + Math.random(), 0.25, 0.22, 0.2);
  }
  // A few bright sparks fly further than the fireball.
  for (let i = 0; i < (big ? 14 : 7); i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 12 + Math.random() * 10;
    emit(G, pos.x, (pos.y || 0) + 0.8, pos.z,
      Math.cos(a) * sp, 4 + Math.random() * 6, Math.sin(a) * sp,
      0.7 + Math.random() * 0.5, 1, 0.85, 0.4);
  }
  G.state.lastExplosion = new THREE.Vector3(pos.x, pos.y || 0, pos.z);
  G.state.lastExplosionAt = G.state.time;
  if (!G.effects.flash) {
    const light = new THREE.PointLight(0xffa040, 60, 40, 1.8);
    G.effects.flash = light;
    G.scene.add(light);
  }
  G.effects.flash.position.set(pos.x, (pos.y || 0) + 2, pos.z);
  G.effects.flash.intensity = big ? 90 : 50;
  shake(G, big ? 1.4 : 0.8);
  if (G.helpers.playSound) { try { G.helpers.playSound('explosion'); } catch (e) { /* sound is optional */ } }
}

export function spawnSmoke(G, pos) {
  if (!G.effects || !G.effects.particles || !pos) return;
  for (let i = 0; i < 10; i++) {
    emit(G, pos.x + (Math.random() - 0.5) * 1.5, (pos.y || 0) + 0.5 + Math.random(), pos.z + (Math.random() - 0.5) * 1.5,
      (Math.random() - 0.5) * 1.2, 1.5 + Math.random() * 1.5, (Math.random() - 0.5) * 1.2,
      1.4 + Math.random() * 0.8, 0.3, 0.28, 0.26);
  }
}

export function shake(G, amt) {
  if (!G.effects) G.effects = {};
  G.effects.shakeAmt = Math.max(G.effects.shakeAmt || 0, amt);
  G.state.shakeAmt = Math.max(G.state.shakeAmt || 0, amt);
}

export function updateEffects(G, dt) {
  if (!G.effects || !G.effects.points) return;
  const geo = G.effects.points.geometry;
  const posAttr = geo.getAttribute('position');
  const colAttr = geo.getAttribute('color');
  let anyAlive = false;
  let i = 0;
  for (const p of G.effects.particles) {
    if (p.alive) {
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        p.y = -100;
      } else {
        p.vy -= 9 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        if (p.y < 0.05) { p.y = 0.05; p.vy *= -0.3; p.vx *= 0.7; p.vz *= 0.7; }
        anyAlive = true;
      }
    }
    const fade = p.alive ? Math.max(0, p.life / p.maxLife) : 0;
    posAttr.setXYZ(i, p.x, p.y, p.z);
    colAttr.setXYZ(i, p.r * fade, p.g * fade, p.b * fade);
    i++;
  }
  posAttr.needsUpdate = true;
  colAttr.needsUpdate = true;
  G.effects.points.visible = anyAlive;
  if (G.effects.flash && G.effects.flash.intensity > 0) {
    G.effects.flash.intensity = Math.max(0, G.effects.flash.intensity - dt * 160);
  }
  // Old explosion markers stop scattering pedestrians after 6 seconds.
  if (G.state.lastExplosionAt != null && G.state.time - G.state.lastExplosionAt > 6) {
    G.state.lastExplosion = null;
    G.state.lastExplosionAt = null;
  }
}
