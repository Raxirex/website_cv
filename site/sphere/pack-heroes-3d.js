/* The Sphere: heroes pack. Cosmic heroics and the void, as lit 3D scenes on the three.js layer (sphere-3d.js):
 * a Tesla coil firing in a dark lab, six cut gems that flip a coin for every letter, portals into a
 * branching multiverse, a light-eating void that lenses the sky, a glossy black ooze, a titan over a night city and the
 * heat death of everything. Every model, texture and shader is procedural; nothing is fetched.
 *
 * The 3D camera is matched to the engine's 2D projection (sphere radius = 1 world unit, camera at z = 2, field of view
 * from S.R), so 3D objects sit exactly under the 2D letters and webs. All hooks are guarded: a bug logs once. */
(function (SP) {
  'use strict';
  if (!SP) return;
  const { TAU, rand, pick, clamp } = SP.util;
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const gauss = () => (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 1.73;
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  const sup = (n) => String(n).split('').map((c) => (c === '-' ? '⁻' : SUP[+c] || c)).join('');
  const sci = (v) => { if (!isFinite(v) || v <= 0) return '0'; const e = Math.floor(Math.log10(v)), m = v / Math.pow(10, e); return m.toFixed(1) + '×10' + sup(e); };
  const P3 = () => ({ x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } });

  /* ---------- guards and profiling (SPHERE.hxProf.on = true accumulates this pack's ms into .acc) ---------- */
  const PROF = SP.hxProf = { on: false, acc: 0 };
  function guard(id, k, f, fallback) {
    let warned = false;
    return function () {
      const t0 = PROF.on ? performance.now() : 0;
      try { return f.apply(this, arguments); } catch (err) {
        if (!warned) { warned = true; console.error('[pack-heroes] ' + id + '.' + k, err); }
        return fallback;
      } finally { if (PROF.on) PROF.acc += performance.now() - t0; }
    };
  }
  // Cinematic flash moments: a bloom surge that decays (gentler with reduced motion).
  function flash3(S, amp, life) { const d = S.data; d._fT = S.now; d._fA = amp; d._fL = life || 600; }
  function cine(S, X) {
    if (!X.bloomPass || !X.bloom) return;
    const d = S.data, t = (S.now - (d._fT || -1e9)) / (d._fL || 600), k = t >= 0 && t < 1 ? Math.pow(1 - t, 2) : 0;
    X.bloomPass.strength = X.bloom.strength * (1 + (d._fA || 0) * k * (S.reduceMotion ? 0.25 : 1));
  }
  const addMode = (def) => {
    if (def.three && def.three.update) { const u = def.three.update; def.three.update = function (S, X, now, dt) { u.call(this, S, X, now, dt); cine(S, X); }; }
    Object.keys(def).forEach((k) => { if (typeof def[k] === 'function') def[k] = guard(def.id, k, def[k], k === 'drawNode' ? true : undefined); });
    if (def.three) Object.keys(def.three).forEach((k) => { def.three[k] = guard(def.id, 'three.' + k, def.three[k]); });
    SP.addMode(def);
  };
  const addLink = (key, draw) => SP.addLink(key, guard('link', key, draw));

  /* ---------- glyph availability: keep only symbols the local fonts can draw ---------- */
  let gc = null, gx = null; const refSigs = [];
  function sig(ch) {
    gx.clearRect(0, 0, 40, 40); gx.fillText(ch, 20, 20);
    const d = gx.getImageData(0, 0, 40, 40).data; let s = 0, c = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 60) { c++; s = (s * 31 + i) % 1000000007; }
    return c ? c + ':' + s : '';
  }
  function renders(ch) {
    try {
      if (!gc) {
        gc = document.createElement('canvas'); gc.width = gc.height = 40;
        gx = gc.getContext('2d', { willReadFrequently: true });
        gx.font = '26px monospace'; gx.textAlign = 'center'; gx.textBaseline = 'middle'; gx.fillStyle = '#fff';
        ['￿', '͸', '\u{10FFFD}', '\u{E0FFF}', '\u{2FFFF}'].forEach((r) => refSigs.push(sig(r)));
      }
      const s = sig(ch);
      return !!s && refSigs.indexOf(s) < 0;
    } catch (e) { return true; }
  }
  const G = (str, fallback) => { const ok = Array.from(str).filter(renders); return ok.length >= 4 ? ok.join('') : fallback; };

  /* ---------- 2D helpers (overlays only) ---------- */
  const power = (S) => (S.holding ? clamp(S.held / S.STAGES[3], 0, 1) : 0);
  const pspeed = (S) => Math.hypot(S.ptrVel.x, S.ptrVel.y);
  // An understated instrument panel: smoked glass, hairline border, small monospace label.
  function panel(ctx, x, y, w, h, label) {
    ctx.fillStyle = 'rgba(6,8,14,0.62)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(200,215,240,0.22)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    if (label) { ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(210,222,245,0.7)'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(label, x + 8, y + 6); }
  }
  function letter(S, ctx, n, g, size, a, col) { // the glow comes from the blooming 3D bead underneath
    ctx.font = `${size.toFixed(1)}px monospace`; ctx.fillStyle = col; ctx.fillText(g, n.sx, n.sy);
    return true;
  }
  // The 2D web is kept as a faint hairline; the real, glowing web is drawn in 3D (see web3d).
  addLink('hx_faint', (ctx, L) => { ctx.globalAlpha = 0.22; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(L.ax, L.ay); ctx.lineTo(L.bx, L.by); ctx.stroke(); ctx.globalAlpha = 1; });
  const FAINT = ['hx_faint', 'hx_faint', 'hx_faint', 'hx_faint'];

  /* ---------- maths ---------- */
  function hsl2rgb(h, s, l) {
    s /= 100; l /= 100; h = ((h % 360) + 360) % 360;
    const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
  }
  const LF = [0];
  function lnFact(n) { n = Math.max(0, Math.round(n)); for (let i = LF.length; i <= n; i++) LF[i] = LF[i - 1] + Math.log(i); return LF[n]; }
  const lnC = (n, k) => lnFact(n) - lnFact(k) - lnFact(n - k);
  const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0); };
  let rs = 1; const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
  const reseed = (s) => { rs = (Math.floor(Math.abs(s)) % 2147483646) + 1; rnd(); };

  /* ======================= shared 3D toolkit ======================= */
  let T = null, _v = null, _a = null, _b = null, _m4 = null, _c = null, _q = null, _s = null;
  function tk(X) { if (T) return; T = X.THREE; _v = new T.Vector3(); _a = new T.Vector3(); _b = new T.Vector3(); _m4 = new T.Matrix4(); _c = new T.Color(); _q = new T.Quaternion(); _s = new T.Vector3(); }
  // Match the 3D camera to the engine's projection: a point (x, y, z) in sphere units lands where the letter would.
  function align(S, X, ox, oy) {
    const c = X.camera; c.position.set(ox || 0, oy || 0, 2); c.up.set(0, 1, 0); c.lookAt(ox || 0, oy || 0, 0);
    c.fov = 2 * Math.atan(S.H / (4 * Math.max(10, S.R))) * 180 / Math.PI; c.near = 0.05; c.far = 500; c.aspect = S.W / Math.max(1, S.H); c.updateProjectionMatrix();
  }
  function toWorld(S, x, y, z, out) { const k = (2 - z) / (2 * S.R); out.set((x - S.cx) * k, -(y - S.cy) * k, z); return out; }
  const nodeW = (S, n, out) => toWorld(S, n.sx, n.sy, clamp(n.rz || 0, -1.5, 1.5), out);
  const ptrW = (S, z, out) => toWorld(S, S.ptr.x, S.ptr.y, z, out);
  // Glowing beads at the letters (MeshBasic, HDR instance colours, so they bloom).
  function beads(X, max, r, mat) {
    const m = new T.InstancedMesh(new T.SphereGeometry(r, 14, 10), mat || new T.MeshBasicMaterial({ color: 0xffffff }), max);
    m.instanceMatrix.setUsage(T.DynamicDrawUsage); m.frustumCulled = false;
    _c.setRGB(0, 0, 0); for (let i = 0; i < max; i++) m.setColorAt(i, _c);
    m.count = 0; X.scene.add(m); return m;
  }
  function beadsUpdate(S, m, fn) { // fn(n, colour) returns the scale (0 hides)
    let i = 0; const max = m.instanceMatrix.count;
    for (const n of S.active) {
      if (i >= max) break;
      const s = fn(n, _c); if (!(s > 0)) continue;
      nodeW(S, n, _v); _m4.makeScale(s, s, s); _m4.setPosition(_v); m.setMatrixAt(i, _m4); m.setColorAt(i, _c); i++;
    }
    m.count = i; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }
  // The infection web in 3D: additive line segments, optionally jittered into filaments.
  function web3d(X, maxL, segs) {
    const g = new T.BufferGeometry(), n = maxL * segs * 2;
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(n * 3), 3).setUsage(T.DynamicDrawUsage));
    g.setAttribute('color', new T.BufferAttribute(new Float32Array(n * 3), 3).setUsage(T.DynamicDrawUsage));
    const l = new T.LineSegments(g, new T.LineBasicMaterial({ vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
    l.frustumCulled = false; l.userData = { maxL, segs }; X.scene.add(l); return l;
  }
  function webUpdate(S, w, jit, colorFn, rate) {
    const P = w.geometry.attributes.position.array, C = w.geometry.attributes.color.array, segs = w.userData.segs, cap = w.userData.maxL * segs * 2;
    let v = 0;
    for (const l of S.links) {
      if (v + segs * 2 > cap) break;
      const grow = clamp((S.now - l.born) / 220, 0, 1), a = (l.dying ? 1 - (S.now - l.dying) / 700 : 1) * Math.min(l.A.alpha, l.B.alpha);
      if (a <= 0.01) continue;
      nodeW(S, l.A, _a); nodeW(S, l.B, _b); _b.sub(_a).multiplyScalar(grow);
      colorFn(l, _c); const r = _c.r * a, g = _c.g * a, b = _c.b * a, len = _b.length();
      reseed(l.seed * 1e6 + Math.floor(S.now / (rate || 70)) * 7919);
      let px = _a.x, py = _a.y, pz = _a.z;
      for (let k = 1; k <= segs; k++) {
        const t = k / segs, j = k === segs ? 0 : jit * len;
        const x = _a.x + _b.x * t + (rnd() - 0.5) * j, y = _a.y + _b.y * t + (rnd() - 0.5) * j, z = _a.z + _b.z * t + (rnd() - 0.5) * j;
        P[v * 3] = px; P[v * 3 + 1] = py; P[v * 3 + 2] = pz; C[v * 3] = r; C[v * 3 + 1] = g; C[v * 3 + 2] = b; v++;
        P[v * 3] = x; P[v * 3 + 1] = y; P[v * 3 + 2] = z; C[v * 3] = r; C[v * 3 + 1] = g; C[v * 3 + 2] = b; v++;
        px = x; py = y; pz = z;
      }
    }
    w.geometry.setDrawRange(0, v); w.geometry.attributes.position.needsUpdate = true; w.geometry.attributes.color.needsUpdate = true;
  }
  const RIBBON_VS = 'attribute float side; varying float vS; void main(){ vS = side; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const RIBBON_FS = 'uniform vec3 uColor; uniform float uOpacity; varying float vS; void main(){ float h = exp(-vS * vS * 3.5), c = exp(-vS * vS * 38.0); gl_FragColor = vec4((uColor * h * 0.7 + vec3(1.0) * c * 1.4 * length(uColor) * 0.35) * uOpacity, 1.0); }';
  // Ribbons: camera-facing strips through polylines, for lightning and beams (additive, HDR colour, blooms).
  function ribbon(X, maxPts, color) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(maxPts * 2 * 3), 3).setUsage(T.DynamicDrawUsage));
    g.setIndex(new T.BufferAttribute(new Uint16Array((maxPts - 1) * 6), 1).setUsage(T.DynamicDrawUsage));
    const side = new Float32Array(maxPts * 2); for (let i = 0; i < maxPts * 2; i++) side[i] = i % 2 ? -1 : 1;
    g.setAttribute('side', new T.BufferAttribute(side, 1));
    // energy cross-section: a Gaussian halo around a white-hot core, so a strip reads as a glowing filament
    const m = new T.Mesh(g, new T.ShaderMaterial({ uniforms: { uColor: { value: color }, uOpacity: { value: 1 } }, vertexShader: RIBBON_VS, fragmentShader: RIBBON_FS, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    m.frustumCulled = false; m.userData.max = maxPts; X.scene.add(m); return m;
  }
  function ribbonSet(rb, lines, width) { // lines: flat [x,y,z,...] arrays; width in world units (tapers to the ends)
    const P = rb.geometry.attributes.position.array, I = rb.geometry.index.array, max = rb.userData.max;
    let p = 0, ix = 0;
    for (const L of lines) {
      const n = L.length / 3; if (n < 2 || p + n > max) continue;
      for (let i = 0; i < n; i++) {
        const j = Math.min(n - 1, i + 1), h = Math.max(0, i - 1), dx = L[j * 3] - L[h * 3], dy = L[j * 3 + 1] - L[h * 3 + 1], ln = Math.hypot(dx, dy) || 1;
        const w = width * (0.35 + 0.65 * Math.sin(Math.PI * (i + 0.5) / n)), nx = -dy / ln * w, ny = dx / ln * w, o = (p + i) * 6;
        P[o] = L[i * 3] + nx; P[o + 1] = L[i * 3 + 1] + ny; P[o + 2] = L[i * 3 + 2];
        P[o + 3] = L[i * 3] - nx; P[o + 4] = L[i * 3 + 1] - ny; P[o + 5] = L[i * 3 + 2];
        if (i) { const a = (p + i - 1) * 2; I[ix++] = a; I[ix++] = a + 1; I[ix++] = a + 2; I[ix++] = a + 1; I[ix++] = a + 3; I[ix++] = a + 2; }
      }
      p += n;
    }
    rb.geometry.setDrawRange(0, ix); rb.geometry.attributes.position.needsUpdate = true; rb.geometry.index.needsUpdate = true;
  }
  // Jagged lightning path through world points (flat array out), re-rolled with the seed.
  function jag3(pts, amp, seed, out) {
    reseed(seed); out.length = 0; out.push(pts[0], pts[1], pts[2]);
    for (let i = 3; i < pts.length; i += 3) {
      const x0 = pts[i - 3], y0 = pts[i - 2], z0 = pts[i - 1], dx = pts[i] - x0, dy = pts[i + 1] - y0, dz = pts[i + 2] - z0, l = Math.hypot(dx, dy) || 1e-4;
      const m = Math.max(1, Math.min(6, Math.ceil(l / 0.06)));
      for (let k = 1; k <= m; k++) { const t = k / m, o = k === m && i === pts.length - 3 ? 0 : (rnd() - 0.5) * amp; out.push(x0 + dx * t - dy / l * o, y0 + dy * t + dx / l * o, z0 + dz * t); }
    }
    return out;
  }
  // Procedural textures and backdrops.
  function fbm(X, x, y, z, oct) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * X.noise.noise(x * f, y * f, z * f); a *= 0.5; f *= 2.03; } return s; }
  function skyDome(X, w, h, paint, radius) {
    const tex = X.canvasTexture(w, h, (ctx, W, H) => { const img = ctx.createImageData(W, H); paint(img.data, W, H); ctx.putImageData(img, 0, 0); });
    const m = new T.Mesh(new T.SphereGeometry(radius || 120, 48, 24), new T.MeshBasicMaterial({ map: tex, side: T.BackSide, depthWrite: false, fog: false }));
    m.renderOrder = -10; X.scene.add(m); return m;
  }
  function starPoints(X, n, r0, r1, size) {
    const g = new T.BufferGeometry(), P = new Float32Array(n * 3), C = new Float32Array(n * 3);
    const BB = [[1, 0.62, 0.35], [1, 0.8, 0.6], [1, 0.93, 0.85], [0.95, 0.96, 1], [0.78, 0.85, 1], [0.65, 0.75, 1]];
    for (let i = 0; i < n; i++) {
      const u = rand(-1, 1), th = rand(0, TAU), r = rand(r0, r1), s = Math.sqrt(1 - u * u);
      P[i * 3] = Math.cos(th) * s * r; P[i * 3 + 1] = u * r; P[i * 3 + 2] = Math.sin(th) * s * r;
      const c = pick(BB), b = Math.pow(Math.random(), 3) * 2.2 + 0.25; C[i * 3] = c[0] * b; C[i * 3 + 1] = c[1] * b; C[i * 3 + 2] = c[2] * b;
    }
    g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('color', new T.BufferAttribute(C, 3));
    const pts = new T.Points(g, new T.PointsMaterial({ size: size || 0.35, vertexColors: true, sizeAttenuation: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
    X.scene.add(pts); return pts;
  }
  function glowSprite(X, color, scale) {
    if (!X._glowTex) X._glowTex = X.canvasTexture(128, 128, (x) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,255,255,0.45)'); g.addColorStop(0.5, 'rgba(255,255,255,0.1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); });
    const s = new T.Sprite(new T.SpriteMaterial({ map: X._glowTex, color, blending: T.AdditiveBlending, transparent: true, depthWrite: false }));
    s.scale.setScalar(scale || 1); X.scene.add(s); return s;
  }
  // An expanding shock ring that faces the camera.
  function shockRing(X, color) { const m = new T.Mesh(new T.RingGeometry(0.96, 1, 128), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); m.visible = false; X.scene.add(m); return m; }
  function shockStep(S, m, t0, life, r0, r1) {
    const t = (S.now - t0) / life;
    if (t < 0 || t > 1) { m.visible = false; return; }
    m.visible = true; const e = 1 - Math.pow(1 - t, 3); m.scale.setScalar(lerp(r0, r1, e)); m.material.opacity = (1 - t) * (S.reduceMotion ? 0.5 : 1);
  }

  /* ======================= 1. TESLA COIL: a resonant transformer in a dark lab ======================= */
  // Lab units: 1 unit ≈ 0.27 m. Secondary 42 mH with ≈ 27 pF (toroid + self-capacitance); primary 47 µH × 24 nF, tuned to
  // match (≈ 150 kHz); a 25 kV tank. Streamer length follows the empirical L ≈ 0.043·√P m.
  const TC = { Ls: 0.042, Lp: 46.7e-6, Cp: 24.3e-9, C0: 27e-12, Vp: 25e3, k: 0.13, Rm: 0.62, rm: 0.18, FLOOR: -3.9, U: 0.27, Pidle: 90, Pmax: 3000 };
  const tcF = (C) => 1 / (TAU * Math.sqrt(TC.Ls * C));
  const ARC_VS = 'attribute float side; attribute float br; varying float vS; varying float vB; void main(){ vS = side; vB = br; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const ARC_FS = 'uniform vec3 uColor; varying float vS; varying float vB; void main(){ float h = exp(-vS * vS * 3.5), c = exp(-vS * vS * 38.0); gl_FragColor = vec4((uColor * h * 0.7 + vec3(1.0) * c * 1.4 * length(uColor) * 0.35) * vB, 1.0); }';
  // Arc ribbons: like ribbon() but with a per-vertex brightness, so every channel flickers on its own.
  function arcRibbon(X, maxPts, color) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(maxPts * 6), 3).setUsage(T.DynamicDrawUsage));
    g.setAttribute('br', new T.BufferAttribute(new Float32Array(maxPts * 2), 1).setUsage(T.DynamicDrawUsage));
    g.setIndex(new T.BufferAttribute(new Uint16Array((maxPts - 1) * 6), 1).setUsage(T.DynamicDrawUsage));
    const side = new Float32Array(maxPts * 2); for (let i = 0; i < maxPts * 2; i++) side[i] = i % 2 ? -1 : 1;
    g.setAttribute('side', new T.BufferAttribute(side, 1));
    const m = new T.Mesh(g, new T.ShaderMaterial({ uniforms: { uColor: { value: color } }, vertexShader: ARC_VS, fragmentShader: ARC_FS, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    m.frustumCulled = false; m.userData.max = maxPts; X.scene.add(m); return m;
  }
  function arcSet(rb, items, wk) { // items: { pts, w, br, free }; free channels taper from root to tip
    const P = rb.geometry.attributes.position.array, B = rb.geometry.attributes.br.array, I = rb.geometry.index.array, max = rb.userData.max;
    let p = 0, ix = 0;
    for (const it of items) {
      const L = it.pts, n = L.length / 3; if (n < 2 || p + n > max) continue;
      for (let i = 0; i < n; i++) {
        const j = Math.min(n - 1, i + 1), h = Math.max(0, i - 1), dx = L[j * 3] - L[h * 3], dy = L[j * 3 + 1] - L[h * 3 + 1], ln = Math.hypot(dx, dy) || 1, t = i / (n - 1);
        const w = it.w * wk * (it.free ? 1 - 0.82 * t : 0.8 + 0.2 * (1 - t)), nx = -dy / ln * w, ny = dx / ln * w, o = (p + i) * 6;
        P[o] = L[i * 3] + nx; P[o + 1] = L[i * 3 + 1] + ny; P[o + 2] = L[i * 3 + 2];
        P[o + 3] = L[i * 3] - nx; P[o + 4] = L[i * 3 + 1] - ny; P[o + 5] = L[i * 3 + 2];
        B[(p + i) * 2] = B[(p + i) * 2 + 1] = it.br;
        if (i) { const a = (p + i - 1) * 2; I[ix++] = a; I[ix++] = a + 1; I[ix++] = a + 2; I[ix++] = a + 1; I[ix++] = a + 3; I[ix++] = a + 2; }
      }
      p += n;
    }
    const g = rb.geometry; g.setDrawRange(0, ix); g.attributes.position.needsUpdate = true; g.attributes.br.needsUpdate = true; g.index.needsUpdate = true;
  }
  // A 3D lightning channel by midpoint displacement (seeded through rnd), and its forks (denser toward the tip).
  function mdPath(ax, ay, az, bx, by, bz, levels, rough) {
    let a = [ax, ay, az, bx, by, bz];
    for (let lv = 0; lv < levels; lv++) {
      const b = [], n = a.length / 3;
      for (let i = 0; i < n - 1; i++) {
        const x0 = a[i * 3], y0 = a[i * 3 + 1], z0 = a[i * 3 + 2], x1 = a[i * 3 + 3], y1 = a[i * 3 + 4], z1 = a[i * 3 + 5], l = Math.hypot(x1 - x0, y1 - y0, z1 - z0) * rough;
        b.push(x0, y0, z0, (x0 + x1) / 2 + (rnd() - 0.5) * l, (y0 + y1) / 2 + (rnd() - 0.5) * l, (z0 + z1) / 2 + (rnd() - 0.5) * l);
      }
      b.push(a[a.length - 3], a[a.length - 2], a[a.length - 1]); a = b;
    }
    return a;
  }
  function arcForks(main, w, br, depth, prob, out) {
    const n = main.length / 3; let tot = 0;
    for (let i = 1; i < n; i++) tot += Math.hypot(main[i * 3] - main[i * 3 - 3], main[i * 3 + 1] - main[i * 3 - 2], main[i * 3 + 2] - main[i * 3 - 1]);
    for (let i = 1; i < n - 1; i++) {
      if (rnd() > prob * (0.3 + 1.4 * i / n)) continue;
      let dx = main[i * 3 + 3] - main[i * 3 - 3], dy = main[i * 3 + 4] - main[i * 3 - 2], dz = main[i * 3 + 5] - main[i * 3 - 1];
      const l = Math.hypot(dx, dy, dz) || 1; dx = dx / l + (rnd() - 0.5) * 1.7; dy = dy / l + (rnd() - 0.5) * 1.7; dz = dz / l + (rnd() - 0.5) * 1.7;
      const q = Math.hypot(dx, dy, dz) || 1, len = tot * (0.07 + rnd() * 0.2) * (1 - 0.45 * i / n), x = main[i * 3], y = main[i * 3 + 1], z = main[i * 3 + 2];
      const pts = mdPath(x, y, z, x + dx / q * len, y + dy / q * len, z + dz / q * len, 3, 0.75);
      out.push({ pts, w: w * 0.42, br: br * 0.72, free: true });
      if (depth > 0) arcForks(pts, w * 0.42, br * 0.72, depth - 1, prob * 0.7, out);
    }
  }
  // The arc root: the point on the toroid's surface that faces the target (the field is strongest there).
  function arcRoot(d, tw, out) {
    const l = d.lab.worldToLocal(d.v3.copy(tw));
    const th = Math.atan2(l.z, l.x), ps = Math.atan2(l.y, Math.hypot(l.x, l.z) - TC.Rm), q = TC.Rm + TC.rm * Math.cos(ps);
    return d.lab.localToWorld(out.set(Math.cos(th) * q, TC.rm * Math.sin(ps), Math.sin(th) * q));
  }
  function arcSpawn(S, d, now, opt) {
    const RM = S.reduceMotion, reach = d.reach, F = TC.FLOOR;
    const s = Object.assign({ t0: now, seed: Math.floor(Math.random() * 1e6), w: 0.03, e: 0.4, free: true, kind: 'fixed', life: rand(60, 150) * (RM ? 2.5 : 1) }, opt || {});
    if (opt) { d.strikes.push(s); return s; }
    const inf = S.stage >= 2 ? S.active.filter((n) => n.inf && n.alpha > 0.3) : null, r = Math.random();
    const hit = { free: false, w: 0.045, e: 1, life: rand(110, 230) * (RM ? 2 : 1) };
    if (inf && inf.length && r < (S.stage === 3 ? 0.55 : 0.35)) { // the infected letters draw the strikes
      const n = pick(inf); nodeW(S, n, d.vt);
      if (d.vt.distanceTo(d.lab.position) - TC.Rm < reach) Object.assign(s, hit, { kind: 'node', n });
      else Object.assign(s, { kind: 'seek', n, len: reach * rand(0.6, 1) });
    } else if ((S.ptrInside || S.holding) && Math.random() < (S.holding ? 0.7 : 0.45)) { // and the pointer, like a grounded hand
      ptrW(S, 0.25, d.vt);
      if (d.vt.distanceTo(d.lab.position) - TC.Rm < reach * rand(0.85, 1.05)) Object.assign(s, hit, { kind: 'ptr', w: 0.05 });
      else Object.assign(s, { kind: 'seek', len: reach * rand(0.55, 1) });
    } else if (reach > 4 && Math.random() < 0.3) { // a grounded target: the strike rail or the ball on its pole
      if (Math.random() < 0.5) { const a = rand(0.2, Math.PI - 0.2); s.le = [Math.cos(a) * 1.42, F + 0.78, Math.sin(a) * 1.42]; }
      else s.le = [2.52, F + 2.04, -0.84];
      Object.assign(s, hit, { w: 0.04 });
    } else { // a free streamer into the air, forking at its tip
      const th = rand(0, TAU), ph = rand(-0.3, 0.9), L = Math.min(reach, 5) * rand(0.3, 0.95), q = TC.Rm + TC.rm + L * Math.cos(ph);
      s.le = [Math.cos(th) * q, Math.max(F + 0.05, L * Math.sin(ph)), Math.sin(th) * q]; s.e = 0.35 + 0.25 * L / Math.max(0.1, reach);
    }
    d.strikes.push(s); return s;
  }
  addMode({
    id: 'hx_speed', name: 'TESLA COIL', glyphs: G('ϟ↯⌁∿≈ΩμLCfkVπ', 'LCfkVΩμπ'),
    base: [225, 18, 82], palette: [[265, 90, 74], [230, 95, 72], [285, 85, 76], [200, 95, 74]],
    links: FAINT, count: 54, noHueShift: true, pageBg: ['#0a0a0e', '#020203'], glyphScale: 0.9,
    shapes: ['sphere', 'torus_knot', 'helix', 'lissajous', 'lorenz', 'cinquefoil', 'torus', 'spherical_spiral'],
    init(S) {
      const E = 0.5 * TC.Cp * TC.Vp * TC.Vp;
      Object.assign(S.data, { P: TC.Pidle, pw: 0, len: 0.043 * Math.sqrt(TC.Pidle), reach: 0.043 * Math.sqrt(TC.Pidle) / TC.U, Cs: TC.C0, f: tcF(TC.C0), E, bps: TC.Pidle / E, strikes: [], items: [], acc: 0, lt: 0, rel: -1e9, relPend: 0, relE: E, relBps: 0 });
    },
    update(S, now, dt) {
      const d = S.data, pw = power(S); d.pw = pw;
      const tgt = S.holding ? TC.Pidle + (TC.Pmax - TC.Pidle) * Math.pow(pw, 1.4) : TC.Pidle;
      d.P += (tgt - d.P) * (1 - Math.exp(-dt / (S.holding ? 150 : 500)));
      d.len = 0.043 * Math.sqrt(d.P); d.reach = d.len / TC.U;
      d.Cs = TC.C0 + 3.3e-12 * d.len; // streamers add roughly 1 pF per foot to the top load, detuning it downward
      d.f = tcF(d.Cs); d.bps = d.P / d.E;
    },
    three: {
      init(S, X) {
        tk(X); const d = S.data, sc = X.scene, F = TC.FLOOR, PT = F + 0.42; align(S, X);
        X.setBloom(0.9, 0.45, 0.8); X.studioEnvironment();
        sc.fog = new T.FogExp2(0x040407, 0.085);
        const lab = d.lab = new T.Group(); lab.position.set(0, 0.45, -2.2); lab.rotation.x = 0.27; sc.add(lab);
        d.v3 = new T.Vector3(); d.vt = new T.Vector3(); d.vA = new T.Vector3(); d.vB = new T.Vector3(); d.bA = new T.Vector3(); d.bB = new T.Vector3();
        const mets = d.mets = [];
        const std = (o) => new T.MeshStandardMaterial(o), phys = (o) => new T.MeshPhysicalMaterial(o);
        const metal = (m) => { m.userData.env0 = 1; mets.push(m); return m; };
        const add = (geo, mat, x, y, z, parent, cast, recv) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast !== false; m.receiveShadow = recv !== false; (parent || lab).add(m); return m; };
        const V = (a) => new T.Vector3(a[0], a[1], a[2]);
        const lathe = (pr, seg) => new T.LatheGeometry(pr.map((p) => new T.Vector2(p[0], p[1])), seg || 32);
        const rbox = (w, h, dd, r) => (T.RoundedBoxGeometry ? new T.RoundedBoxGeometry(w, h, dd, 3, r) : new T.BoxGeometry(w, h, dd));
        const insulator = (h, r) => { const pr = [[0, 0], [r * 1.2, 0]]; const n = Math.max(3, Math.round(h / 0.07)); for (let i = 0; i < n; i++) { const y = (i + 0.5) / n * h; pr.push([r, y - 0.025], [r * 1.65, y], [r, y + 0.02]); } pr.push([r * 0.9, h], [0, h]); return lathe(pr, 24); };
        const lin = (t) => { t.encoding = T.LinearEncoding; return t; };

        // --- room: a saw-cut concrete floor and a block wall far back ---
        const conc = X.canvasTexture(512, 512, (c, w, h) => {
          const s = document.createElement('canvas'); s.width = s.height = 128; const sx = s.getContext('2d'), img = sx.createImageData(128, 128);
          for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { const v = fbm(X, x / 22, y / 22, 5.3, 4), o = (y * 128 + x) * 4, g = clamp(96 + v * 130, 30, 170); img.data[o] = g; img.data[o + 1] = g * 0.98; img.data[o + 2] = g * 0.95; img.data[o + 3] = 255; }
          sx.putImageData(img, 0, 0); c.drawImage(s, 0, 0, w, h);
          const im = c.getImageData(0, 0, w, h), D = im.data; for (let i = 0; i < D.length; i += 4) { const n = (Math.random() - 0.5) * 30; D[i] += n; D[i + 1] += n; D[i + 2] += n; } c.putImageData(im, 0, 0);
          c.strokeStyle = 'rgba(16,16,18,0.8)'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 1); c.lineTo(w, 1); c.moveTo(1, 0); c.lineTo(1, h); c.stroke();
        });
        conc.wrapS = conc.wrapT = T.RepeatWrapping; conc.repeat.set(6, 6);
        const floor = add(new T.PlaneGeometry(40, 40), std({ color: 0x6a6864, map: conc, roughness: 0.88, metalness: 0 }), 0, F, 0, lab, false, true); floor.rotation.x = -Math.PI / 2;
        const blocks = X.canvasTexture(512, 512, (c, w, h) => {
          c.fillStyle = '#3a3936'; c.fillRect(0, 0, w, h);
          for (let r = 0; r < 8; r++) for (let k = -1; k < 4; k++) { const x = k * 128 + (r % 2 ? 64 : 0), v = Math.round(rand(80, 112)); c.fillStyle = `rgb(${v},${v - 2},${v - 5})`; c.fillRect(x + 3, r * 64 + 3, 122, 58); }
          const im = c.getImageData(0, 0, w, h), D = im.data; for (let i = 0; i < D.length; i += 4) { const n = (Math.random() - 0.5) * 34; D[i] += n; D[i + 1] += n; D[i + 2] += n; } c.putImageData(im, 0, 0);
        });
        blocks.wrapS = blocks.wrapT = T.RepeatWrapping; blocks.repeat.set(40 / 6, 16 / 6);
        add(new T.PlaneGeometry(40, 16), std({ color: 0x55534f, map: blocks, roughness: 0.95 }), 0, F + 8, -7.5, lab, false, true);

        // --- the coil's wooden base and the primary: a flat copper spiral on HDPE combs, inside an open strike rail ---
        const wood = X.canvasTexture(512, 512, (c, w, h) => { c.fillStyle = '#5b3b22'; c.fillRect(0, 0, w, h); for (let i = 0; i < 260; i++) { const y0 = Math.random() * h, a = Math.random() * 0.28; c.strokeStyle = Math.random() < 0.5 ? `rgba(160,112,70,${a})` : `rgba(28,14,6,${a})`; c.lineWidth = rand(0.6, 3); c.beginPath(); for (let x = 0; x <= w; x += 16) c.lineTo(x, y0 + Math.sin(x * 0.012 + i) * 4 + X.noise.noise(x * 0.01, i * 0.37, 0.5) * 12); c.stroke(); } });
        add(rbox(2.9, 0.34, 2.9, 0.03), std({ map: wood, color: 0xb89a80, roughness: 0.6 }), 0, F + 0.25, 0);
        [[-1.25, -1.25], [1.25, -1.25], [-1.25, 1.25], [1.25, 1.25]].forEach(([x, z]) => add(new T.CylinderGeometry(0.06, 0.07, 0.08, 16), std({ color: 0x111111, roughness: 0.8 }), x, F + 0.04, z));
        const copper = metal(std({ color: 0xd08a5c, metalness: 1, roughness: 0.22 }));
        const spts = []; for (let i = 0; i <= 300; i++) { const t = i / 300, a = Math.PI + t * 8 * TAU, r = 0.44 + 0.72 * t; spts.push(new T.Vector3(Math.cos(a) * r, PT + 0.13 + t * 0.06, Math.sin(a) * r)); }
        add(new T.TubeGeometry(new T.CatmullRomCurve3(spts), 1400, 0.021, 10, false), copper, 0, 0, 0);
        const hdpe = std({ color: 0x1b1b1d, roughness: 0.45 });
        for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.3, m = add(new T.BoxGeometry(0.92, 0.09, 0.06), hdpe, Math.cos(a) * 0.82, PT + 0.06, Math.sin(a) * 0.82); m.rotation.y = -a; }
        const rail = add(new T.TorusGeometry(1.42, 0.018, 8, 160, TAU * 0.96), copper, 0, PT + 0.36, 0); rail.rotation.x = Math.PI / 2;
        const pvc = std({ color: 0xd8d4cb, roughness: 0.42 });
        for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.5; add(new T.CylinderGeometry(0.022, 0.022, 0.36, 12), pvc, Math.cos(a) * 1.42, PT + 0.18, Math.sin(a) * 1.42); }

        // --- the secondary: a PVC former close-wound with enamelled wire under a clear coat ---
        const TURNS = 256, wind = (bump) => (c, w, h) => {
          const pr = [0.32, 0.9, 1, 0.5], p = h / TURNS;
          for (let i = 0; i < TURNS; i++) {
            const v = 0.86 + 0.14 * Math.sin(i * 0.31) * Math.sin(i * 0.071) + rand(-0.04, 0.04);
            for (let k = 0; k < p; k++) {
              const s = pr[k % 4];
              c.fillStyle = bump ? `rgb(${Math.round(255 * s)},${Math.round(255 * s)},${Math.round(255 * s)})` : `rgb(${Math.round(212 * s * v)},${Math.round(128 * s * v)},${Math.round(80 * s * v)})`;
              c.fillRect(0, i * p + k, w, 1);
            }
          }
        };
        const wMap = X.canvasTexture(32, 1024, wind(false)), wBump = lin(X.canvasTexture(32, 1024, wind(true)));
        wMap.wrapT = wBump.wrapT = T.RepeatWrapping; wMap.repeat.y = wBump.repeat.y = 3;
        const winding = metal(phys({ map: wMap, bumpMap: wBump, bumpScale: 0.6, metalness: 1, roughness: 0.34, clearcoat: 0.8, clearcoatRoughness: 0.1 }));
        const top = -0.1, wb = PT + 0.3, wt = -0.38;
        add(new T.CylinderGeometry(0.255, 0.255, top - PT, 48), pvc, 0, (top + PT) / 2, 0);
        add(new T.CylinderGeometry(0.262, 0.262, wt - wb, 128, 1, true), winding, 0, (wt + wb) / 2, 0);
        add(lathe([[0, 0], [0.27, 0], [0.275, 0.02], [0.27, 0.07], [0.2, 0.09], [0, 0.09]], 48), pvc, 0, top - 0.06, 0);

        // --- the top load: a polished aluminium toroid on a spun plate (it does not cast: arcs start on its skin) ---
        const spun = lin(X.canvasTexture(4, 512, (c, w, h) => { for (let y = 0; y < h; y++) { const v = Math.round(40 + Math.random() * 26 + 10 * Math.sin(y * 0.9)); c.fillStyle = `rgb(${v},${v},${v})`; c.fillRect(0, y, w, 1); } }));
        const alu = metal(phys({ color: 0xd4d7dc, metalness: 1, roughness: 1, roughnessMap: spun, clearcoat: 0.25, clearcoatRoughness: 0.2 }));
        const tor = add(new T.TorusGeometry(TC.Rm, TC.rm, 64, 180), alu, 0, 0, 0, lab, false, true); tor.rotation.x = Math.PI / 2;
        add(new T.CylinderGeometry(TC.Rm, TC.Rm, 0.035, 96), alu, 0, 0, 0, lab, false, true);
        add(new T.CylinderGeometry(0.03, 0.03, 0.2, 12), alu, 0, -0.08, 0, lab, false);
        d.corona = add(new T.TorusGeometry(TC.Rm, TC.rm * 1.18, 24, 96), new T.MeshBasicMaterial({ color: new T.Color(0.45, 0.35, 1.3), transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }), 0, 0, 0, lab, false, false);
        d.corona.rotation.x = Math.PI / 2;

        // --- the tank circuit: an MMC capacitor bank, a static spark gap and the high-voltage transformer ---
        const bank = new T.Group(); bank.position.set(-2.3, F, 0.95); bank.rotation.y = 0.35; lab.add(bank);
        add(rbox(1.0, 0.05, 0.78, 0.01), std({ color: 0x23301f, roughness: 0.55 }), 0, 0.42, 0, bank);
        [[-0.44, -0.33], [0.44, -0.33], [-0.44, 0.33], [0.44, 0.33]].forEach(([x, z]) => add(new T.CylinderGeometry(0.022, 0.022, 0.4, 10), pvc, x, 0.2, z, bank));
        const capB = new T.InstancedMesh(new T.CylinderGeometry(0.05, 0.05, 0.22, 24), std({ color: 0x1e2c4c, roughness: 0.38 }), 20);
        const capT = new T.InstancedMesh(new T.CylinderGeometry(0.016, 0.016, 0.05, 10), metal(std({ color: 0xb8bcc2, metalness: 1, roughness: 0.3 })), 40);
        for (let i = 0; i < 20; i++) { const x = -0.34 + (i % 5) * 0.17, z = -0.26 + Math.floor(i / 5) * 0.17; _m4.makeTranslation(x, 0.555, z); capB.setMatrixAt(i, _m4); _m4.makeTranslation(x - 0.025, 0.685, z); capT.setMatrixAt(i * 2, _m4); _m4.makeTranslation(x + 0.025, 0.685, z); capT.setMatrixAt(i * 2 + 1, _m4); }
        capB.castShadow = capT.castShadow = capB.receiveShadow = true; bank.add(capB, capT);
        for (let r = 0; r < 4; r++) add(new T.BoxGeometry(0.78, 0.008, 0.03), copper, 0, 0.712, -0.26 + r * 0.17, bank);
        const gap = new T.Group(); gap.position.set(-2.45, F, -0.45); gap.rotation.y = -0.25; lab.add(gap);
        add(rbox(0.8, 0.1, 0.34, 0.015), std({ color: 0x2a1a10, map: wood, roughness: 0.5 }), 0, 0.05, 0, gap);
        const ceramic = phys({ color: 0x6a3520, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05 });
        const brass = metal(std({ color: 0xc09a5a, metalness: 1, roughness: 0.28 })), tung = metal(std({ color: 0x8c8c92, metalness: 1, roughness: 0.4 }));
        [-1, 1].forEach((sgn) => {
          add(insulator(0.42, 0.045), ceramic, sgn * 0.27, 0.1, 0, gap);
          const rod = add(new T.CylinderGeometry(0.014, 0.014, 0.2, 12), brass, sgn * 0.17, 0.56, 0, gap); rod.rotation.z = Math.PI / 2;
          add(new T.CylinderGeometry(0.035, 0.035, 0.06, 16), brass, sgn * 0.27, 0.55, 0, gap);
          add(new T.SphereGeometry(0.058, 24, 16), tung, sgn * 0.085, 0.56, 0, gap);
        });
        d.gapS = glowSprite(X, new T.Color(1.4, 1.5, 3.2), 0.22); gap.add(d.gapS); d.gapS.position.set(0, 0.56, 0); d.gapS.material.opacity = 0;
        d.gapL = new T.PointLight(0xc4ccff, 0, 0, 2); d.gapL.position.set(0, 0.6, 0.05); gap.add(d.gapL);
        const nst = new T.Group(); nst.position.set(-3.3, F, -1.45); nst.rotation.y = 0.4; lab.add(nst);
        add(rbox(0.72, 0.52, 0.46, 0.03), metal(std({ color: 0x2e3a36, metalness: 0.55, roughness: 0.5 })), 0, 0.26, 0, nst);
        [-0.18, 0.18].forEach((x) => add(insulator(0.24, 0.035), ceramic, x, 0.52, 0, nst));
        const rubber = std({ color: 0x101012, roughness: 0.55 });
        const cable = (pts, r, mat) => add(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(V)), 64, r, 8, false), mat || rubber, 0, 0, 0);
        cable([[-3.4, F + 0.78, -1.38], [-3.3, F + 0.9, -1.0], [-3.0, F + 0.03, -0.8], [-2.75, F + 0.03, -0.6], [-2.72, F + 0.56, -0.38]], 0.016);
        cable([[-2.2, F + 0.56, -0.5], [-2.0, F + 0.03, -0.35], [-1.6, F + 0.03, -0.18], [-1.48, PT + 0.02, -0.1], [-0.9, PT + 0.02, -0.04], [-0.44, PT + 0.13, 0]], 0.012, copper);
        cable([[-2.4, F + 0.56, -0.25], [-2.45, F + 0.03, 0.2], [-2.45, F + 0.4, 0.62]], 0.016);
        cable([[-2.05, F + 0.7, 0.95], [-1.8, F + 0.03, 0.6], [-1.5, PT + 0.02, 0.2], [-1.2, PT + 0.17, 0.03], [-1.16, PT + 0.19, 0]], 0.012, copper);
        cable([[0.15, PT + 0.02, 0.27], [0.3, PT + 0.02, 1.45], [0.4, F + 0.02, 1.62], [1.0, F + 0.02, 2.3], [1.4, F + 0.02, 2.6]], 0.01, copper);

        // --- a grounded strike target, and a fluorescent tube that lights in the field with no wires ---
        const steel = metal(std({ color: 0xc8ccd2, metalness: 1, roughness: 0.15 }));
        add(new T.CylinderGeometry(0.2, 0.22, 0.04, 32), steel, 2.6, F + 0.02, -0.9);
        add(new T.CylinderGeometry(0.018, 0.022, 1.95, 12), steel, 2.6, F + 1.0, -0.9);
        add(new T.SphereGeometry(0.12, 32, 20), steel, 2.6, F + 2.0, -0.9);
        add(new T.CylinderGeometry(0.16, 0.18, 0.035, 32), std({ color: 0x151515, roughness: 0.6 }), 2.15, F + 0.02, 1.1);
        add(new T.CylinderGeometry(0.012, 0.012, 1.4, 10), steel, 2.15, F + 0.72, 1.1);
        add(new T.BoxGeometry(0.1, 0.04, 0.05), std({ color: 0x151515, roughness: 0.6 }), 2.19, F + 1.38, 1.1);
        d.tubeM = std({ color: 0xe8e6f0, emissive: 0xdcd4ff, emissiveIntensity: 0, roughness: 0.25 });
        add(new T.CylinderGeometry(0.026, 0.026, 1.05, 20), d.tubeM, 2.24, F + 1.5, 1.1);
        [-0.54, 0.54].forEach((o) => add(new T.CylinderGeometry(0.028, 0.028, 0.04, 16), steel, 2.24, F + 1.5 + o, 1.1));

        // --- light: a faint cool spill from a high window; everything else comes from the arcs ---
        sc.add(new T.HemisphereLight(0x283040, 0x0a0806, 0.012));
        const win = new T.SpotLight(0x6a84ff, 40, 0, 0.4, 0.9, 2); win.position.set(-6, 7, 3); win.target.position.set(0, F + 1, 0); lab.add(win, win.target);
        d.top = new T.PointLight(0xc8b8ff, 0, 0, 2); d.top.position.set(0, 0.3, 0); lab.add(d.top);
        d.spot = new T.SpotLight(0xc8b8ff, 0, 0, 1.2, 0.65, 2); d.spot.castShadow = true; d.spot.shadow.mapSize.set(1024, 1024); d.spot.shadow.bias = -0.0006; d.spot.shadow.camera.near = 0.2; d.spot.shadow.camera.far = 14;
        sc.add(d.spot, d.spot.target);
        d.tip = new T.PointLight(0xc8b8ff, 0, 0, 2); sc.add(d.tip);
        d.imp = new T.PointLight(0xffc89a, 0, 0, 2); sc.add(d.imp);
        d.roots = Array.from({ length: 6 }, () => { const s = glowSprite(X, new T.Color(1.1, 0.9, 2.6), 0.32); s.material.opacity = 0; return s; });
        d.scorch = Array.from({ length: 3 }, () => { const s = glowSprite(X, new T.Color(2.6, 1.5, 0.8), 0.5); s.material.opacity = 0; s.userData.t = -1e9; return s; });

        // the studio IBL is only a faint ambient in this dark room; the flashes raise it (see update)
        lab.traverse((o) => { const m = o.material; if (m && m.isMeshStandardMaterial && !m.userData.env0) { m.userData.env0 = 0.35; mets.push(m); } });
        d.beads = beads(X, 240, 0.018);
        d.web = web3d(X, 240, 5);
        d.glow = arcRibbon(X, 7000, new T.Color(0.72, 0.52, 2.2)); d.core = arcRibbon(X, 7000, new T.Color(2.6, 2.6, 3.8));
      },
      update(S, X, now, dt) {
        const d = S.data, RM = S.reduceMotion, F = TC.FLOOR, lab = d.lab;
        align(S, X);
        // a slow turntable drift plus pointer parallax (the letters stay registered to the 2D layer)
        lab.rotation.set(0.27 + 0.05 * (S.ptr.y - S.cy) / Math.max(1, S.H), Math.sin(now * 0.00007) * 0.3 + 0.22 * (S.ptr.x - S.cx) / Math.max(1, S.W), 0);
        lab.updateMatrixWorld(true);
        if (d.relPend) { // release: one huge multi-channel discharge, with ground strikes
          const pw = d.relPend, big = { free: false, e: 1.5, w: 0.065, big: true }, life = RM ? 900 : 430; d.relPend = 0;
          for (let i = 0; i < 3; i++) {
            const a = rand(0.25, Math.PI - 0.25), r = rand(1.8, 2.7), le = [Math.cos(a) * r, F + 0.01, Math.sin(a) * r];
            arcSpawn(S, d, now, Object.assign({}, big, { le, t0: now + i * rand(30, 90), life }));
            const sp = d.scorch[i]; sp.userData.t = now + i * 60; lab.localToWorld(sp.position.set(le[0], le[1] + 0.03, le[2]));
          }
          if (S.ptrInside) arcSpawn(S, d, now, Object.assign({}, big, { kind: 'ptr', w: 0.055, life }));
          S.active.filter((n) => n.inf).sort(() => Math.random() - 0.5).slice(0, 8).forEach((n, i) => arcSpawn(S, d, now, Object.assign({}, big, { kind: 'node', n, w: 0.04, e: 1.1, t0: now + i * 25, life: life * 0.8 })));
          for (let i = 0; i < 7; i++) { const th = rand(0, TAU), ph = rand(-0.2, 1), L = Math.min(d.reach, 5) * rand(0.5, 1), q = TC.Rm + TC.rm + L * Math.cos(ph); arcSpawn(S, d, now, { le: [Math.cos(th) * q, Math.max(F + 0.05, L * Math.sin(ph)), Math.sin(th) * q], w: 0.04, e: 0.9, big: true, t0: now + rand(0, 120), life: life * 0.8 }); }
          d.rel = now; d.relE = d.E; d.relBps = d.bps;
          flash3(S, RM ? 0.5 : 1.2, 900);
          if (!RM) { S.shake(4 * pw); S.flash(0.05, '205,195,255'); }
        }
        // the coil fires in bursts: one channel per break of the spark gap, at a visible fraction of the break rate
        const rate = RM ? 3 + 6 * d.pw : 8 + 26 * d.pw;
        d.acc += dt / 1000 * rate;
        while (d.acc >= 1) { d.acc -= 1; if (d.strikes.length < 18) arcSpawn(S, d, now); }

        const items = d.items; items.length = 0; let tot = 0, best = 0, bestFree = true, k = 0;
        const tick = Math.floor(now / (RM ? 140 : 33));
        d.strikes = d.strikes.filter((s) => now - s.t0 < s.life && !(s.n && s.n.alpha < 0.05));
        for (const s of d.strikes) {
          const age = now - s.t0; if (age < 0) continue;
          const A = d.vA, B = d.vB;
          if (s.kind === 'fixed') lab.localToWorld(d.vt.set(s.le[0], s.le[1], s.le[2]));
          else if (s.n) nodeW(S, s.n, d.vt); else ptrW(S, 0.25, d.vt);
          arcRoot(d, d.vt, A); B.copy(d.vt);
          if (s.kind === 'seek') { B.sub(A); B.multiplyScalar(Math.min(1, s.len / Math.max(1e-3, B.length()))).add(A); }
          const grow = Math.min(1, age / (s.life * 0.18)); B.sub(A).multiplyScalar(grow).add(A); // the leader propagates out, then the channel holds
          const u = age / s.life, fl = RM ? 1 : 0.5 + 0.5 * Math.random(), br = Math.pow(1 - u, 0.7) * fl * s.e;
          const lv = clamp(Math.ceil(Math.log2(Math.max(0.1, A.distanceTo(B)) / 0.05)), 4, 7); // ~5 cm segments
          reseed(s.seed); const main = mdPath(A.x, A.y, A.z, B.x, B.y, B.z, lv, 0.6), n0 = items.length;
          items.push({ pts: main, w: s.w, br, free: s.free && s.kind !== 'ptr' });
          arcForks(main, s.w, br, s.big ? 2 : 1, s.big ? 0.24 : 0.13, items);
          reseed(s.seed + tick * 977); // fine crackle: the channel re-strikes a little differently every few ms
          const jit = 0.012 + 0.01 * s.w / 0.05;
          for (let i = n0; i < items.length; i++) { const P = items[i].pts; for (let j = 3; j < P.length - 3; j++) P[j] += (rnd() - 0.5) * jit; }
          const en = br * (s.free ? 0.3 : 1) * s.w / 0.05; tot += en;
          if (en > best) { best = en; bestFree = s.free; d.bA.copy(A); d.bB.copy(B); }
          if (s.n && !s.free && grow >= 1) s.n.data.zap = now;
          if (k < d.roots.length) { const sp = d.roots[k++]; sp.position.copy(A); sp.material.opacity = Math.min(1, br); sp.scale.setScalar(0.22 + 0.25 * s.w / 0.05); }
        }
        for (; k < d.roots.length; k++) d.roots[k].material.opacity = 0;
        arcSet(d.glow, items, 1); arcSet(d.core, items, 0.22);

        // the arcs are the room's light: the top load, the strongest channel (with shadows) and its strike point
        const relK = Math.exp(-Math.max(0, now - d.rel) / 260), tgt = 3 + 8 * d.pw + Math.min(120, tot * 60) + relK * (RM ? 150 : 450);
        d.lt = RM ? d.lt + (tgt - d.lt) * (1 - Math.exp(-dt / 180)) : tgt;
        d.top.intensity = d.lt * 0.35;
        if (best > 0) { d.spot.position.copy(d.bA).lerp(d.bB, 0.15); lab.localToWorld(d.spot.target.position.set(0, F, 0.3)); d.spot.target.updateMatrixWorld(); }
        d.spot.intensity = d.lt * 0.8;
        if (best > 0 && !bestFree) d.tip.position.copy(d.bB);
        d.tip.intensity = best > 0 && !bestFree ? Math.min(400, d.lt * 0.4) : d.tip.intensity * 0.7;
        const env = 0.06 + Math.min(0.5, d.lt / 500); d.mets.forEach((m) => (m.envMapIntensity = m.userData.env0 * env));
        // the spark gap fires every break; the tube glows in the field; corona on the toroid's skin
        const gapA = clamp(d.bps / 80, 0.2, 1) * (RM ? 0.6 : Math.random() < 0.7 ? Math.random() : 0.1);
        d.gapS.material.opacity = gapA; d.gapL.intensity = gapA * 18;
        d.tubeM.emissiveIntensity = (0.08 + 1.6 * d.pw) * (RM ? 1 : 0.8 + 0.2 * Math.random()) + relK * 2;
        d.corona.material.opacity = 0.03 + 0.12 * d.pw + 0.2 * relK;
        let imp = 0;
        d.scorch.forEach((sp) => { const t = now - sp.userData.t, a = t < 0 ? 0 : Math.exp(-t / 500); sp.material.opacity = a; sp.scale.setScalar(0.35 + 0.4 * a); if (a > imp) { imp = a; d.imp.position.copy(sp.position); d.imp.position.y += 0.2; } });
        d.imp.intensity = imp * (RM ? 60 : 260);

        beadsUpdate(S, d.beads, (n, c) => {
          const z = n.data.zap ? Math.exp(-(S.now - n.data.zap) / 200) : 0;
          if (n.inf) { c.setRGB(0.9 + 3 * z, 0.7 + 3 * z, 2.2 + 2 * z); return 1 + 0.7 * z; }
          c.setRGB(0.35 + 3 * z, 0.38 + 3 * z, 0.52 + 3 * z); return 0.6 + z;
        });
        webUpdate(S, d.web, 0.14 + 0.05 * S.stage, (l, c) => c.setRGB(0.7, 0.5, 1.8), 40);
      }
    },
    drawNode(S, ctx, n, g, size, a) {
      const z = n.data.zap ? Math.exp(-(S.now - n.data.zap) / 220) : 0;
      const col = n.inf ? `rgba(${Math.round(226 + 29 * z)},${Math.round(214 + 41 * z)},255,${a})` : `rgba(${Math.round(196 + 59 * z)},${Math.round(204 + 51 * z)},226,${a * 0.78})`;
      return letter(S, ctx, n, g, size, a, col);
    },
    onRelease(S, held, pw) { S.data.relPend = Math.max(0.3, pw); return false; },
    hud(S) {
      const d = S.data, f = (d.f / 1000).toFixed(1), pf = (d.Cs * 1e12).toFixed(1), g = Math.sqrt(TC.Ls / TC.Lp);
      if (S.holding) return S.stage < 2
        ? `${Math.round(d.P)} W · Vs/Vp ≈ √(Ls/Lp) ≈ ${g.toFixed(0)}, an energy ratio, not a turns ratio · k = ${TC.k}: the energy crosses in ~1/(2k) ≈ ${(1 / (2 * TC.k)).toFixed(0)} cycles`
        : `${(d.P / 1000).toFixed(2)} kW · streamer length grows as √P: ≈ ${d.len.toFixed(1)} m · they load the top to ${pf} pF and pull f₀ down to ${f} kHz`;
      if (S.now - d.rel < 5000) return `½·Cp·Vp² = ${d.relE.toFixed(1)} J per break × ${Math.round(d.relBps)} breaks/s · lossless bound ≈ ${g.toFixed(0)} × ${TC.Vp / 1000} kV = ${(g * TC.Vp / 1e6).toFixed(2)} MV`;
      return `f₀ = 1/(2π√(LC)): 42 mH with ${pf} pF → ${f} kHz · primary 47 µH × 24 nF, tuned to match`;
    }
  });

  /* ======================= 2. SIX GEMS: coin flips and the binomial distribution ======================= */
  const GEMS = [{ n: 'AXIOM', h: 352 }, { n: 'PRIME', h: 26 }, { n: 'LIMIT', h: 50 }, { n: 'VECTOR', h: 140 }, { n: 'SIGMA', h: 205 }, { n: 'NULL', h: 278 }];
  function gemPos(S, i, out) {
    const d = S.data, al = d.align, ang = d.orb + i * TAU / 6, kick = 1 + 0.6 * Math.exp(-(S.now - d.kick) / 500), r = (1.6 - 0.3 * power(S)) * kick;
    let x = Math.cos(ang) * r, y = Math.sin(ang) * r * 0.18 + 0.05, z = Math.sin(ang) * r * 0.75;
    const ax = (i - 2.5) * 0.3, ay = 1.38;
    x = lerp(x, ax, al); y = lerp(y, ay + Math.sin(S.now * 0.003 + i) * 0.01 * al, al); z = lerp(z, 0.35, al);
    if (S.ptrInside && !S.holding) { ptrW(S, z, _s); const dx = _s.x - x, dy = _s.y - y, q = Math.hypot(dx, dy); if (q < 0.5) { const f = 0.35 * (1 - q / 0.5); x += dx * f; y += dy * f; } }
    return out.set(x, y, z);
  }
  function gemGeometry() { // a round brilliant: pavilion to the culet, girdle, crown, table (flat-shaded facets)
    const pr = [[0, -0.86], [0.12, -0.74], [0.68, -0.04], [0.7, 0.02], [0.66, 0.06], [0.42, 0.3], [0.3, 0.33], [0, 0.33]].map((p) => new T.Vector2(p[0], p[1]));
    const g = new T.LatheGeometry(pr, 16); g.computeVertexNormals(); return g;
  }
  addMode({
    id: 'hx_gems', name: 'SIX GEMS', glyphs: G('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'),
    base: [40, 50, 88], palette: [[352, 100, 66], [26, 100, 62], [50, 100, 60], [140, 90, 58], [205, 100, 66], [278, 100, 72]],
    links: FAINT, count: 90, noHueShift: true, pageBg: ['#0c0718', '#030209'], glyphScale: 0.85,
    shapes: ['sphere', 'icosidodecahedron', 'crown', 'torus', 'compound_five_cubes', 'galaxy', 'snub_dodecahedron', 'rose'],
    init(S) { Object.assign(S.data, { orb: 0, align: 0, kick: -1e9, snap: null, last: null, rel: -1e9 }); },
    onPress(S) { S.data.snap = null; },
    update(S, now, dt) {
      const d = S.data;
      d.orb += dt * (0.00035 + 0.0011 * S.stage) * (1 - d.align);
      const tgt = S.holding ? smooth(2400, 4300, S.held) : 0;
      d.align = S.holding ? Math.max(tgt, d.align * Math.pow(0.5, dt / 200)) : d.align * Math.pow(0.5, dt / 200);
      if (S.holding && !d.snap && S.held > S.STAGES[3] + 150 && d.align > 0.9) { // one independent fair coin per letter
        const act = S.active; let k = 0;
        act.forEach((n) => { const live = Math.random() < 0.5; n.data.gone = !live; n.data.dl = rand(0, 1100); n.data.dust = n.data.dust || 0; if (live) k++; });
        d.snap = d.last = { n: act.length, k, t: now }; flash3(S, 1.8, 800);
      }
      for (const n of S.active) {
        const nd = n.data;
        if (S.holding && d.snap && nd.gone) {
          nd.dust = clamp((now - d.snap.t - nd.dl) / 1200, 0, 1);
          if (nd.dust > 0 && nd.dust < 1 && Math.random() < 0.4) S.spawn(n.sx + rand(-6, 6), n.sy + rand(-6, 6), rand(0.4, 1.6), rand(-1, 0.1), `hsla(${rand(18, 36)},40%,${rand(40, 62)}%,1)`, rand(900, 1700), rand(0.8, 1.8), { drag: 0.985, g: -0.004 });
        } else if (nd.dust > 0) { nd.dust = Math.max(0, nd.dust - dt / 900); if (nd.dust === 0) nd.gone = false; }
      }
    },
    three: {
      init(S, X) {
        tk(X); const d = S.data, sc = X.scene; align(S, X);
        X.setBloom(0.95, 0.6, 0.7); X.studioEnvironment();
        skyDome(X, 512, 256, (P, w, h) => { // a faint nebula
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const u = x / w * TAU, v = y / h * Math.PI, nx = Math.cos(u) * Math.sin(v) * 2, ny = Math.cos(v) * 2, nz = Math.sin(u) * Math.sin(v) * 2;
            const a = Math.max(0, fbm(X, nx, ny, nz, 5) + 0.1), b2 = Math.max(0, fbm(X, nx + 5, ny, nz, 4)), o = (y * w + x) * 4;
            P[o] = Math.min(255, 4 + a * 110 + b2 * 30); P[o + 1] = Math.min(255, 2 + a * 30 + b2 * 40); P[o + 2] = Math.min(255, 10 + a * 120 + b2 * 90); P[o + 3] = 255;
          }
        });
        starPoints(X, 2600, 60, 100, 0.32);
        const key = new T.DirectionalLight(0xfff2e0, 2.2); key.position.set(-2, 3, 4); sc.add(key);
        const rim = new T.DirectionalLight(0x8090ff, 1.4); rim.position.set(3, -1, -3); sc.add(rim);
        const geo = gemGeometry();
        d.gems = GEMS.map((gm) => {
          const col = new T.Color().setHSL(gm.h / 360, 0.95, 0.5);
          const m = new T.Mesh(geo, new T.MeshPhysicalMaterial({ color: col, emissive: col, emissiveIntensity: 0.28, roughness: 0.03, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, transmission: 0.35, transparent: true, opacity: 0.95, envMapIntensity: 3.2, flatShading: true, reflectivity: 1 }));
          m.scale.setScalar(0.11); sc.add(m);
          return { m, halo: glowSprite(X, col.clone().multiplyScalar(1.6), 0.5), col, spin: rand(0.6, 1.2) };
        });
        d.beam = ribbon(X, 64, new T.Color(2.2, 2.0, 2.4));
        d.beads = beads(X, 240, 0.017);
        d.web = web3d(X, 240, 1);
        d.ring = shockRing(X, new T.Color(2, 1.8, 2.4));
        d.pos = GEMS.map(() => new T.Vector3()); d.bl = [];
      },
      update(S, X, now) {
        const d = S.data; align(S, X);
        d.gems.forEach((g, i) => {
          gemPos(S, i, d.pos[i]); g.m.position.copy(d.pos[i]);
          g.m.rotation.set(0.35 + 0.2 * Math.sin(now * 0.0007 + i), now * 0.0009 * g.spin + i, 0.15 * Math.sin(now * 0.0005 + i * 2));
          g.halo.position.copy(d.pos[i]); g.halo.scale.setScalar(0.32 + 0.35 * d.align + 0.25 * power(S));
          g.halo.material.opacity = 0.45 + 0.5 * d.align;
        });
        if (d.align > 0.3) { const L = d.bl; L.length = 0; d.pos.forEach((p) => L.push(p.x, p.y, p.z)); ribbonSet(d.beam, [L], 0.004 + 0.012 * (d.align - 0.3)); d.beam.material.uniforms.uOpacity.value = (d.align - 0.3) * 1.4; }
        else ribbonSet(d.beam, [], 0);
        beadsUpdate(S, d.beads, (n, c) => {
          const dust = n.data.dust || 0; if (dust >= 1) return 0;
          if (dust > 0) c.setRGB(0.6, 0.35, 0.18);
          else if (n.inf) { const r = hsl2rgb(GEMS[n.gen % 6].h, 100, 60); c.setRGB(r[0] / 130, r[1] / 130, r[2] / 130); } else c.setRGB(0.55, 0.48, 0.38);
          return (n.inf ? 1 : 0.7) * (1 - dust);
        });
        webUpdate(S, d.web, 0, (l, c) => { const r = hsl2rgb(GEMS[l.gen % 6].h, 100, 60); c.setRGB(r[0] / 160, r[1] / 160, r[2] / 160); });
        shockStep(S, d.ring, d.rel, 900, 0.2, 2.6);
      }
    },
    drawNode(S, ctx, n, g, size, a) {
      const dust = n.data.dust || 0; if (dust >= 1) return true;
      const al = a * (1 - dust), c = n.inf ? hsl2rgb(GEMS[n.gen % 6].h, 100, 78) : [250, 240, 220];
      ctx.font = `${size.toFixed(1)}px monospace`; ctx.fillStyle = dust > 0 ? `hsla(26,35%,${62 - 20 * dust}%,${al})` : `rgba(${c[0]},${c[1]},${c[2]},${al * 0.9})`;
      ctx.fillText(g, n.sx + dust * 24, n.sy - dust * 10);
      return true;
    },
    over(S, ctx, now) {
      const d = S.data, st = d.last, show = st && (S.holding ? !!d.snap : now - d.rel < 7000);
      if (!show) return; // instrument: the binomial distribution of survivors, this outcome marked
      const n = st.n, mu = n / 2, sg = Math.sqrt(n) / 2, k0 = Math.max(0, Math.floor(mu - 3.5 * sg)), k1 = Math.min(n, Math.ceil(mu + 3.5 * sg));
      const w = 240, h = 100, x0 = S.W - w - 30, y0 = Math.max(110, S.H * 0.26), bw = w / (k1 - k0 + 1), pmax = Math.exp(lnC(n, Math.floor(mu)) - n * Math.LN2);
      ctx.globalAlpha = S.holding ? 1 : 1 - smooth(5500, 7000, now - d.rel);
      panel(ctx, x0 - 12, y0 - 30, w + 24, h + 58, `SURVIVORS ~ BINOMIAL(n=${n}, p=½)`);
      for (let k = k0; k <= k1; k++) { const p = Math.exp(lnC(n, k) - n * Math.LN2), bh = p / pmax * h; ctx.fillStyle = k === st.k ? 'rgba(255,220,140,0.95)' : 'rgba(170,180,230,0.45)'; ctx.fillRect(x0 + (k - k0) * bw + 0.5, y0 + h - bh, Math.max(1, bw - 1), bh); }
      ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 0; i <= 60; i++) { const k = k0 - 0.5 + (k1 - k0 + 1) * i / 60, z = (k - mu) / sg, y = y0 + h - Math.exp(-z * z / 2) / (sg * Math.sqrt(TAU)) / pmax * h; if (i) ctx.lineTo(x0 + (k - k0 + 0.5) * bw, y); else ctx.moveTo(x0 + (k - k0 + 0.5) * bw, y); }
      ctx.stroke();
      ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(225,230,250,0.8)'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(`k = ${st.k}   μ = ${mu}   σ = √n/2 = ${sg.toFixed(2)}`, x0, y0 + h + 18);
      ctx.globalAlpha = 1;
    },
    onRelease(S, held, pw) {
      const d = S.data; d.kick = S.now; d.rel = S.now; flash3(S, 1.5, 700);
      for (let k = 0; k < 70; k++) { const a = rand(0, TAU), v = rand(2, 7) * pw, c = hsl2rgb(GEMS[k % 6].h, 100, 70); S.spawn(S.cx, S.cy, Math.cos(a) * v, Math.sin(a) * v, `rgba(${c.join(',')},1)`, rand(600, 1200), rand(0.8, 1.8)); }
      d.snap = null;
      return false;
    },
    hud(S) {
      const d = S.data, st = d.last;
      if (S.holding && d.snap) { const n = st.n, sg = Math.sqrt(n) / 2, p = Math.exp(lnC(n, st.k) - n * Math.LN2); return `${n} fair coin flips · ${st.k} survive · expected ${n / 2} ± ${sg.toFixed(2)} · z = ${((st.k - n / 2) / sg).toFixed(2)} · P(exactly ${st.k}) = ${(p * 100).toFixed(1)}%`; }
      if (S.holding) return `gems aligning ${Math.round(d.align * 100)}% · at full alignment every letter flips its own coin`;
      if (st && S.now - d.rel < 7000) return `all ${st.n} restored · an exact half survives only ${(Math.exp(lnC(st.n, Math.floor(st.n / 2)) - st.n * Math.LN2) * 100).toFixed(1)}% of the time (≈ √(2/πn))`;
      return 'six cut gems: AXIOM · PRIME · LIMIT · VECTOR · SIGMA · NULL · hold until they align';
    }
  });

  /* ======================= 3. MULTIVERSE: portals into branching timelines ======================= */
  const VERT_UV = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const PORTAL_FS = [
    'uniform sampler2D tex; uniform float t, open; uniform vec3 tint; varying vec2 vUv;',
    'void main(){ vec2 c = vUv - 0.5; float r = length(c) * 2.0; if (r > 1.0) discard;',
    '  vec2 dir = c / max(r, 1e-4); float wob = sin(r * 26.0 - t * 3.0) * 0.005 * (1.0 - r);',
    '  vec2 uv = 0.5 + c * (0.82 + 0.18 * r * r) + dir * wob;', // a lens: magnified centre, compressed rim
    '  float ca = 0.006 * r * r; vec3 col = vec3(texture2D(tex, uv + dir * ca).r, texture2D(tex, uv).g, texture2D(tex, uv - dir * ca).b);',
    '  float edge = smoothstep(0.8, 1.0, r); col = col * (1.0 - 0.5 * edge) + tint * edge * edge * 1.2;',
    '  gl_FragColor = vec4(col * open, 1.0); }'
  ].join('\n');
  const MV_VARIANTS = [
    { bg: 0x1a0c08, col: [1.0, 0.72, 0.3], metal: 1, rough: 0.25, tint: [1.4, 0.8, 0.3] },
    { bg: 0x041018, col: [0.55, 0.85, 1.0], metal: 0, rough: 0.05, tint: [0.4, 1.0, 1.6] },
    { bg: 0x14040e, col: [1.0, 0.25, 0.4], metal: 0.4, rough: 0.4, tint: [1.6, 0.3, 0.6] },
    { bg: 0x050d05, col: [0.5, 1.0, 0.45], metal: 0.2, rough: 0.6, tint: [0.6, 1.5, 0.5], mirror: true },
    { bg: 0x0a0a0a, col: [0.9, 0.9, 0.95], metal: 1, rough: 0.12, tint: [1.2, 1.2, 1.4], wire: true },
    { bg: 0x0e0618, col: [0.7, 0.45, 1.0], metal: 0.6, rough: 0.3, tint: [1.0, 0.5, 1.8], mirror: true },
    { bg: 0x161004, col: [1.0, 0.9, 0.5], metal: 0.9, rough: 0.5, tint: [1.6, 1.3, 0.4], big: true },
    { bg: 0x02060f, col: [0.4, 0.55, 1.0], metal: 0, rough: 0.9, tint: [0.4, 0.6, 1.8] }
  ];
  const MV_MAX = 16;
  const mvSize = (N) => Math.min(0.62, 2.3 / N + 0.12);
  function mvSlot(S, i, N, out) { // portals on an ellipse around the root timeline
    const asp = S.W / Math.max(1, S.H), a = -Math.PI / 2 + (i + 0.5) / N * TAU;
    return out.set(Math.cos(a) * Math.min(2.35, 1.25 * asp), Math.sin(a) * 1.28, -0.45);
  }
  addMode({
    id: 'hx_multi', name: 'MULTIVERSE', glyphs: G('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'),
    base: [210, 40, 90], palette: [[195, 100, 70], [280, 90, 72], [40, 100, 64], [150, 80, 60]],
    links: FAINT, count: 64, noHueShift: true, pageBg: ['#070a16', '#020308'], glyphScale: 0.85, scale: 0.8,
    shapes: ['sphere', 'trefoil', 'cube', 'heart', 'klein', 'stella_octangula', 'torus', 'boy'],
    init(S) { Object.assign(S.data, { lvl: 1, from: 1, tl: -1e9, col: -1e9, colN: 2, maxLvl: 1, rr: 0 }); },
    update(S, now) {
      const d = S.data, tgt = S.holding ? S.stage + 1 : 1;
      if (now - d.col < 700) return;
      if (tgt !== d.lvl) { if (tgt > d.lvl) flash3(S, 1.0, 450); d.from = d.lvl; d.lvl = tgt; d.tl = now; d.maxLvl = Math.max(d.maxLvl, tgt); }
    },
    three: {
      init(S, X) {
        tk(X); const d = S.data, sc = X.scene; align(S, X);
        X.setBloom(0.9, 0.55, 0.75); X.studioEnvironment();
        sc.fog = new T.FogExp2(0x050812, 0.06);
        skyDome(X, 256, 128, (P, w, h) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = Math.max(0, fbm(X, x / 30, y / 30, 7.7, 4) + 0.15), o = (y * w + x) * 4; P[o] = 3 + v * 20; P[o + 1] = 6 + v * 26; P[o + 2] = 14 + v * 60; P[o + 3] = 255; } });
        starPoints(X, 1500, 60, 100, 0.3);
        const floor = new T.Mesh(new T.PlaneGeometry(40, 40), new T.MeshStandardMaterial({ color: 0x07090f, roughness: 0.22, metalness: 0.8 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -1.75; sc.add(floor);
        sc.add(new T.HemisphereLight(0x6080ff, 0x080810, 0.4));
        d.beads = beads(X, 240, 0.02); d.web = web3d(X, 240, 1);
        // the variant world each portal shows (one scene, re-dressed per branch)
        const vs = d.vs = new T.Scene(); vs.background = new T.Color(0x000000); vs.environment = sc.environment;
        const vk = new T.DirectionalLight(0xffffff, 1.3); vk.position.set(2, 3, 4); vs.add(vk); const vr = new T.DirectionalLight(0x88aaff, 0.8); vr.position.set(-3, -1, -2); vs.add(vr); vs.add(new T.HemisphereLight(0xffffff, 0x101010, 0.15));
        d.vMat = new T.MeshStandardMaterial({ color: 0xffffff, metalness: 0.5, roughness: 0.3 });
        d.vB = new T.InstancedMesh(new T.SphereGeometry(0.06, 14, 10), d.vMat, 240); d.vB.instanceMatrix.setUsage(T.DynamicDrawUsage); d.vB.frustumCulled = false;
        d.vG = new T.Group(); d.vG.add(d.vB); vs.add(d.vG);
        d.vCore = new T.Mesh(new T.SphereGeometry(0.22, 32, 16), new T.MeshBasicMaterial({ color: 0xffffff })); vs.add(d.vCore);
        d.vCam = new T.PerspectiveCamera(40, 1, 0.1, 50); d.vCam.position.set(0, 0.3, 3.4); d.vCam.lookAt(0, 0, 0);
        d.rts = []; d.portals = [];
        const disc = new T.CircleGeometry(1, 64), rimG = new T.TorusGeometry(1, 0.018, 8, 128);
        for (let i = 0; i < MV_MAX; i++) {
          const rt = new T.WebGLRenderTarget(256, 256); d.rts.push(rt);
          const g = new T.Group(), mat = new T.ShaderMaterial({ uniforms: { tex: { value: rt.texture }, t: { value: 0 }, open: { value: 1 }, tint: { value: new T.Vector3(1, 1, 1) } }, vertexShader: VERT_UV, fragmentShader: PORTAL_FS });
          g.add(new T.Mesh(disc, mat));
          const rim = new T.Mesh(rimG, new T.MeshBasicMaterial({ color: new T.Color(2, 2, 2) })); g.add(rim);
          const halo = glowSprite(X, new T.Color(1, 1, 1), 1.7); sc.remove(halo); g.add(halo);
          g.visible = false; sc.add(g);
          d.portals.push({ g, mat, rim, halo, v: null, addr: '' });
        }
        d.ring = shockRing(X, new T.Color(1.6, 1.8, 2.6));
        d.p0 = new T.Vector3(); d.p1 = new T.Vector3();
      },
      update(S, X, now) {
        const d = S.data; align(S, X);
        beadsUpdate(S, d.beads, (n, c) => { if (n.inf) c.setRGB(0.8, 1.6, 2.6); else c.setRGB(1.2, 1.25, 1.4); return n.inf ? 1.2 : 0.85; });
        webUpdate(S, d.web, 0, (l, c) => c.setRGB(0.5, 0.9, 1.6));
        const N = Math.pow(2, d.lvl), Np = Math.pow(2, d.from), t = smooth(0, 450, now - d.tl), ct = (now - d.col) / 700, collapsing = ct < 1;
        const shown = collapsing ? d.colN : N;
        for (let i = 0; i < MV_MAX; i++) {
          const P = d.portals[i];
          if (i >= shown) { P.g.visible = false; continue; }
          P.g.visible = true;
          const lv = collapsing ? Math.round(Math.log2(d.colN)) : d.lvl, addr = i.toString(2).padStart(lv, '0');
          P.addr = addr; P.v = MV_VARIANTS[hash(addr + lv) % MV_VARIANTS.length];
          let s;
          if (collapsing) { mvSlot(S, i, d.colN, d.p1); d.p1.multiplyScalar(1 - ct * ct); s = mvSize(d.colN) * (1 - ct * ct); }
          else {
            mvSlot(S, i, N, d.p1); s = mvSize(N);
            if (t < 1 && d.from < d.lvl) { mvSlot(S, i >> (d.lvl - d.from), Np, d.p0); d.p1.lerpVectors(d.p0, d.p1, t); s = lerp(mvSize(Np), s, t); }
            s *= smooth(700, 1300, now - d.col);
          }
          P.g.position.copy(d.p1); P.g.scale.setScalar(Math.max(0.001, s));
          P.g.lookAt(0, 0, 2.5);
          P.mat.uniforms.t.value = now * 0.001 + i; P.mat.uniforms.tint.value.set(P.v.tint[0], P.v.tint[1], P.v.tint[2]);
          P.rim.material.color.setRGB(P.v.tint[0] * 1.5, P.v.tint[1] * 1.5, P.v.tint[2] * 1.5);
          P.halo.material.color.setRGB(P.v.tint[0] * 0.18, P.v.tint[1] * 0.18, P.v.tint[2] * 0.18);
        }
        // render a few branch worlds per frame into their portals (round robin)
        const r = X.renderer, per = Math.min(shown, 4), act = S.active;
        for (let q = 0; q < per; q++) {
          const i = d.rr++ % shown, P = d.portals[i], v = P.v; if (!v) continue;
          const h = hash(P.addr);
          d.vs.background.setHex(v.bg); d.vMat.color.setRGB(v.col[0], v.col[1], v.col[2]); d.vCore.material.color.setRGB(v.tint[0] * 1.2, v.tint[1] * 1.2, v.tint[2] * 1.2); d.vMat.metalness = v.metal; d.vMat.roughness = v.rough; d.vMat.wireframe = !!v.wire;
          d.vG.scale.set(v.mirror ? -1 : 1, 1, 1); d.vG.rotation.set(S.rotX * 0.3 + ((h >> 3) % 10) * 0.08, S.rotY * (1 + (h % 4) * 0.2) + (h % 628) / 100, 0);
          let j = 0; const bs = v.big ? 1.8 : 1;
          for (const n of act) { if (j >= 240) break; const s = (n.inf ? 1.4 : 1) * bs; _m4.makeScale(s, s, s); _m4.setPosition(n.p[0], n.p[1], n.p[2]); d.vB.setMatrixAt(j++, _m4); }
          d.vB.count = j; d.vB.instanceMatrix.needsUpdate = true;
          r.setRenderTarget(d.rts[i]); r.render(d.vs, d.vCam);
        }
        r.setRenderTarget(null);
        shockStep(S, d.ring, d.col, 900, 0.2, 3.2);
      },
      exit(S) { const d = S.data; if (d.rts) d.rts.forEach((rt) => rt.dispose()); if (d.vs) d.vs.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
    },
    drawNode(S, ctx, n, g, size, a) { return letter(S, ctx, n, g, size, a, n.inf ? `rgba(170,225,255,${a})` : `rgba(225,232,250,${a * 0.85})`, '120,190,255'); },
    onRelease(S) {
      const d = S.data; d.colN = Math.pow(2, d.lvl); d.col = S.now; d.from = 1; d.lvl = 1; d.tl = S.now + 700; flash3(S, 2, 700);
      for (let k = 0; k < 60; k++) { const a = rand(0, TAU), v = rand(2, 8); S.spawn(S.cx, S.cy, Math.cos(a) * v, Math.sin(a) * v, k % 2 ? 'rgba(170,220,255,1)' : 'rgba(255,255,255,1)', rand(500, 1100), rand(0.8, 1.8)); }
      return false;
    },
    hud(S) {
      const d = S.data, n = d.lvl, B = Math.pow(2, n);
      if (S.holding) return `n = ${n} binary measurements · the root timeline (centre) now has 2${sup(n)} = ${B} branches · Born weight (½)${sup(n)} = 1/${B} each${n >= 4 ? ' · 266 splits outnumber the atoms in the universe' : ''}`;
      if (S.now - d.col < 4000) return `the branches closed from view · peak 2${sup(d.maxLvl)} = ${Math.pow(2, d.maxLvl)} · in many-worlds none of them collapsed; decoherence just stopped them interfering with yours`;
      return 'every binary measurement splits the timeline in two · hold to watch 2ⁿ portals open';
    }
  });

  /* ======================= 4. THE VOID: light-eating darkness, gravitational lensing, virtual pairs ======================= */
  const LENS_FS = [
    'uniform sampler2D tDiffuse; uniform vec2 uC; uniform float uRs, uRe, uAsp, uGlow; varying vec2 vUv;',
    'void main(){ vec4 base = texture2D(tDiffuse, vUv); if (uRe <= 1e-5) { gl_FragColor = base; return; }',
    '  vec2 d = (vUv - uC) * vec2(uAsp, 1.0); float r = length(d);',
    '  vec2 src = d - d / max(r, 1e-5) * (uRe * uRe / max(r, 1e-5));', // point-mass lens: β = θ − θE²/θ
    '  vec4 c = texture2D(tDiffuse, uC + src / vec2(uAsp, 1.0));',
    '  float k = smoothstep(uRs * 0.985, uRs * 1.04, r);',
    '  float ring = exp(-pow((r - uRs * 1.05) / (uRs * 0.025 + 0.0015), 2.0)) + 0.35 * exp(-pow((r - uRs * 1.12) / (uRs * 0.06 + 0.002), 2.0));', // photon ring
    '  gl_FragColor = vec4(c.rgb * k + vec3(1.5, 1.3, 2.0) * ring * uGlow, mix(1.0, c.a, k)); }'
  ].join('\n');
  const PAIRS = 260;
  function voidPair(S, edge) {
    const d = S.data; if (d.pairs.length >= PAIRS) return;
    let x, y;
    if (edge && d.r > 20) { const a = rand(0, TAU), q = d.r * rand(1.05, 1.3); x = d.vx + Math.cos(a) * q; y = d.vy + Math.sin(a) * q; }
    else if (S.ptrInside && Math.random() < 0.35) { const a = rand(0, TAU), q = rand(10, 120); x = S.ptr.x + Math.cos(a) * q; y = S.ptr.y + Math.sin(a) * q; }
    else { x = rand(0, S.W); y = rand(0, S.H); }
    d.pairs.push({ x, y, z: rand(-0.6, 0.6), a: rand(0, TAU), t: S.now, life: rand(500, 1300), sep: rand(5, 15), edge: !!edge, split: false });
  }
  addMode({
    id: 'hx_void', name: 'THE VOID', glyphs: G('○◌◯∅⊘·∘⦰⌀ø', 'o0O.'), count: 120, glyphScale: 0.8,
    base: [250, 15, 80], palette: [[270, 60, 74], [220, 40, 82], [0, 0, 92]],
    links: FAINT, noHueShift: true, pageBg: ['#000000', '#040308'],
    shapes: ['sphere', 'glome', 'hopf', 'clifford_torus', 'catenoid', 'rossler', 'enneper', 'cell600'],
    init(S) { Object.assign(S.data, { pairs: [], esc: [], r: 0, vx: S.cx, vy: S.cy, coll: -1e9, collR: 0, eaten: 0, hawk: 0, acc: 0, dark: 0, burstP: P3() }); },
    onPress(S, x, y) { const d = S.data; if (d.r < 10) { d.vx = x; d.vy = y; } d.hawk = 0; },
    update(S, now, dt) {
      const d = S.data, p = power(S);
      if (S.holding) {
        const tgt = 16 + Math.pow(p, 1.4) * Math.min(S.W, S.H) * 0.3 + Math.max(0, S.held - S.STAGES[3]) * 0.03;
        d.r += (tgt - d.r) * (1 - Math.pow(0.92, dt / 16.7));
        const k = 1 - Math.pow(0.94, dt / 16.7); d.vx += (S.ptr.x - d.vx) * k; d.vy += (S.ptr.y - d.vy) * k;
      } else { const t = now - d.coll; d.r = t < 420 ? d.collR * Math.pow(1 - t / 420, 2) : d.r * Math.pow(0.5, dt / 90); if (d.r < 0.5) d.r = 0; }
      d.dark = clamp(d.dark + (S.holding && S.stage >= 3 ? 1 : -1) * dt / 900, 0, 1);
      d.acc += dt / 1000 * (30 + 160 * p);
      while (d.acc > 1) { d.acc--; voidPair(S, S.holding && Math.random() < 0.5 * p + 0.1); }
      d.pairs = d.pairs.filter((q) => now - q.t < q.life);
      for (const q of d.pairs) if (q.edge && S.holding && S.stage >= 2 && !q.split && now - q.t > q.life * 0.45) { // Hawking: one partner falls in, one escapes
        q.split = true; d.hawk++; const ox = q.x - d.vx, oy = q.y - d.vy, l = Math.hypot(ox, oy) || 1;
        if (d.esc.length < 120) d.esc.push({ x: q.x, y: q.y, z: q.z, vx: ox / l * 0.25, vy: oy / l * 0.25, t: now });
        q.life = now - q.t + 1;
      }
      d.esc = d.esc.filter((e) => now - e.t < 1400); for (const e of d.esc) { e.x += e.vx * dt; e.y += e.vy * dt; }
      d.eaten = 0; for (const n of S.active) if (d.r > 0 && Math.hypot(n.sx - d.vx, n.sy - d.vy) < d.r) d.eaten++;
    },
    three: {
      init(S, X) {
        tk(X); const d = S.data, sc = X.scene; align(S, X);
        X.setBloom(0.95, 0.5, 0.55);
        skyDome(X, 1024, 512, (P, w, h) => { // a galactic band of stars and dust lanes
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const u = x / w, v = y / h, band = Math.exp(-Math.pow((v - 0.5 - 0.12 * Math.sin(u * TAU)) / 0.09, 2)), o = (y * w + x) * 4;
            if (band < 0.02) { P[o] = 3; P[o + 1] = 3; P[o + 2] = 6; P[o + 3] = 255; continue; }
            const nn = fbm(X, u * 12, v * 12, 1.3, 4), dust = smooth(0.0, 0.35, fbm(X, u * 20, v * 20, 9.1, 3) + 0.1), L = band * (0.55 + 0.9 * nn) * (1 - 0.8 * dust);
            P[o] = Math.min(255, 3 + L * 120); P[o + 1] = Math.min(255, 3 + L * 100); P[o + 2] = Math.min(255, 6 + L * 115); P[o + 3] = 255;
          }
        }, 150);
        starPoints(X, 5000, 80, 140, 0.32);
        const NM = PAIRS * 2 + 120;
        d.mat = new T.InstancedMesh(new T.SphereGeometry(0.006, 8, 6), new T.MeshBasicMaterial({ color: 0xffffff }), NM);
        d.mat.instanceMatrix.setUsage(T.DynamicDrawUsage); d.mat.frustumCulled = false; _c.setRGB(0, 0, 0); for (let i = 0; i < NM; i++) d.mat.setColorAt(i, _c); sc.add(d.mat);
        d.beads = beads(X, 240, 0.012);
        d.web = web3d(X, 240, 1);
        d.hole = new T.Mesh(new T.SphereGeometry(1, 48, 24), new T.MeshBasicMaterial({ color: 0x000000 })); d.hole.visible = false; sc.add(d.hole);
        d.ring = new T.Mesh(new T.RingGeometry(1.0, 1.035, 160), new T.MeshBasicMaterial({ color: new T.Color(2.2, 1.9, 2.8), transparent: true, blending: T.AdditiveBlending, depthWrite: false })); d.ring.visible = false; sc.add(d.ring);
        d.burst = shockRing(X, new T.Color(1.8, 1.5, 2.8));
        if (X.composer && T.ShaderPass) {
          d.lens = new T.ShaderPass({ uniforms: { tDiffuse: { value: null }, uC: { value: new T.Vector2(0.5, 0.5) }, uRs: { value: 0 }, uRe: { value: 0 }, uAsp: { value: 1 }, uGlow: { value: 0 } }, vertexShader: VERT_UV, fragmentShader: LENS_FS });
          X.composer.insertPass(d.lens, 1);
        }
      },
      update(S, X, now) {
        const d = S.data; align(S, X);
        let i = 0; const M = d.mat;
        for (const q of d.pairs) { // matter and antimatter: separate, then annihilate
          const t = (now - q.t) / q.life, s = q.sep * Math.sin(Math.PI * t), c = Math.cos(q.a) * s, sn = Math.sin(q.a) * s, fl = t > 0.9 ? 1 + (t - 0.9) * 30 : 1;
          toWorld(S, q.x + c, q.y + sn, q.z, _v); _m4.makeScale(fl, fl, fl); _m4.setPosition(_v); M.setMatrixAt(i, _m4); _c.setRGB(2.2, 2.2, 2.6); M.setColorAt(i++, _c);
          toWorld(S, q.x - c, q.y - sn, q.z, _v); _m4.setPosition(_v); M.setMatrixAt(i, _m4); _c.setRGB(1.4, 0.8, 3.2); M.setColorAt(i++, _c);
        }
        for (const e of d.esc) { toWorld(S, e.x, e.y, e.z, _v); _m4.makeScale(1.3, 1.3, 1.3); _m4.setPosition(_v); M.setMatrixAt(i, _m4); _c.setRGB(2.6, 2.4, 3); M.setColorAt(i++, _c); }
        M.count = i; M.instanceMatrix.needsUpdate = true; M.instanceColor.needsUpdate = true;
        beadsUpdate(S, d.beads, (n, c) => { const q = d.r > 0 ? Math.hypot(n.sx - d.vx, n.sy - d.vy) : 1e9; if (q < d.r) return 0; if (n.inf) c.setRGB(1.6, 1.1, 2.6); else c.setRGB(0.8, 0.78, 1); return 1; });
        webUpdate(S, d.web, 0, (l, c) => c.setRGB(0.6, 0.45, 1.2));
        const rw = d.r / S.R; // the void sits at z = 0, where world radius = screen radius / R
        toWorld(S, d.vx, d.vy, 0, _v);
        d.hole.visible = d.ring.visible = rw > 0.004;
        d.hole.position.copy(_v); d.hole.scale.setScalar(Math.max(0.001, rw));
        d.ring.position.copy(_v); d.ring.scale.setScalar(Math.max(0.001, rw * 1.04)); d.ring.material.opacity = clamp(rw * 8, 0, 1) * (0.8 + 0.2 * Math.sin(now * 0.006));
        if (d.lens) { // the Einstein ring sits outside the shadow; we draw it at 1.6 × the shadow radius
          const u = d.lens.uniforms; u.uC.value.set(d.vx / S.W, 1 - d.vy / S.H); u.uAsp.value = S.W / S.H;
          u.uRs.value = d.r / S.H; u.uRe.value = d.r > 1 ? d.r / S.H * 1.6 : 0; u.uGlow.value = clamp(d.r / 30, 0, 1) * (0.85 + 0.15 * Math.sin(now * 0.006));
          d.hole.visible = d.ring.visible = false; // the lens pass draws the shadow and the photon ring
        }
        X.setExposure(1 - 0.6 * d.dark);
        shockStep(S, d.burst, d.coll + 420, 1100, 0.2, 4); d.burst.position.copy(d.burstP);
      },
      exit(S) { S.data.lens = null; }
    },
    warp(S, n) {
      const d = S.data; if (!S.holding || d.r < 5) return;
      const dx = d.vx - n.sx, dy = d.vy - n.sy, q = Math.hypot(dx, dy), reach = d.r * 2.4;
      if (q > reach || q < 1) return;
      const f = 0.22 * power(S) * (1 - q / reach); n.sx += dx * f; n.sy += dy * f; n.shrink = 1 - 0.4 * f / 0.22;
    },
    drawNode(S, ctx, n, g, size, a) {
      const d = S.data, q = d.r > 0 ? Math.hypot(n.sx - d.vx, n.sy - d.vy) : 1e9;
      if (q < d.r * 1.04) return true; // nothing comes back out of it
      const near = d.r > 0 ? clamp((q - d.r) / 90, 0, 1) : 1;
      return letter(S, ctx, n, g, size, a, n.inf ? `rgba(205,180,255,${a * (0.3 + 0.7 * near)})` : `rgba(215,212,235,${a * (0.3 + 0.6 * near)})`, '160,120,255');
    },
    onRelease(S, held, pw) {
      const d = S.data; d.coll = S.now; d.collR = d.r; d.last = { r: d.r, hawk: d.hawk, eaten: d.eaten };
      toWorld(S, d.vx, d.vy, 0, d.burstP);
      const x = d.vx, y = d.vy;
      setTimeout(() => {
        if (S.data !== d) return;
        for (let k = 0; k < 120; k++) { const a = rand(0, TAU), v = rand(1, 8) * pw; S.spawn(x, y, Math.cos(a) * v, Math.sin(a) * v, k % 2 ? 'rgba(240,240,255,1)' : 'rgba(170,140,255,1)', rand(700, 1500), rand(0.8, 1.8)); }
        for (let k = 0; k < 60; k++) voidPair(S, false);
        flash3(S, 2.5, 900);
      }, 420);
      return false;
    },
    hud(S) {
      const d = S.data;
      if (S.holding) { const rKm = Math.max(1, d.r), M = rKm * 1000 * 8.988e16 / (2 * 6.674e-11) / 1.989e30, Th = 6.17e-8 / M; return `void r = ${rKm.toFixed(0)} px · if 1 px = 1 km of horizon: M = ${M.toFixed(1)} M☉, Hawking T = ${sci(Th)} K (∝ 1/M) · letters swallowed ${d.eaten} · pairs split ${d.hawk}`; }
      if (d.last && S.now - d.coll < 6000) return `the void evaporated · ${d.last.hawk} Hawking partners escaped · ${d.last.eaten} letters returned from nowhere`;
      return `${d.pairs.length} virtual pairs in view · the vacuum is never empty: ⟨E⟩ = ½ħω per mode · an e⁺e⁻ pair borrows 1.022 MeV for Δt ≈ ħ/2ΔE ≈ 3×10⁻²² s`;
    }
  });

  /* ======================= 5. SYMBIOTE: glossy black ooze (metaballs), surface tension, Plateau-Rayleigh ======================= */
  const OOZE_N = 64;
  const OOZE_VS = 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const OOZE_FS = [
    'uniform vec4 uB[' + OOZE_N + ']; uniform int uN; uniform float uPR, uH;',
    'void main(){',
    '  vec2 p = vec2(gl_FragCoord.x, uH - gl_FragCoord.y) / uPR;', // CSS px, y down
    '  float f = 0.0; vec2 g = vec2(0.0);',
    '  for (int i = 0; i < ' + OOZE_N + '; i++) { if (i >= uN) break; vec2 d = p - uB[i].xy; float R = uB[i].z * 2.2; float R2 = R * R; float q = dot(d, d) / R2;',
    '    if (q < 1.0) { float k = 1.0 - q; f += k * k; g += -4.0 * k * d / R2; } }',
    '  const float th = 0.6295; if (f < th * 0.9) discard;',
    '  float a = smoothstep(th * 0.92, th * 1.02, f);',
    '  vec3 N = normalize(vec3(-g.x * 26.0, -g.y * 26.0, 1.0 + 3.0 * max(f - th, 0.0)));', // height-field normal from the field gradient
    '  vec3 V = vec3(0.0, 0.0, 1.0), R = reflect(-V, N);',
    '  float fr = 0.04 + 0.96 * pow(1.0 - max(N.z, 0.0), 5.0);', // Schlick Fresnel
    '  float sky = smoothstep(-0.1, 0.9, -R.y), box = smoothstep(0.55, 0.75, -R.y) * smoothstep(0.6, 0.2, abs(R.x + 0.25));',
    '  vec3 env = vec3(0.012) + vec3(0.16, 0.19, 0.26) * sky + vec3(2.4) * box;',
    '  vec3 L1 = normalize(vec3(-0.45, -0.75, 0.55)), L2 = normalize(vec3(0.8, 0.35, 0.45));',
    '  float s1 = pow(max(dot(N, normalize(L1 + V)), 0.0), 140.0) * 5.0, s2 = pow(max(dot(N, normalize(L2 + V)), 0.0), 60.0) * 1.1;',
    '  vec3 irid = 0.5 + 0.5 * cos(6.2831 * (fr * 1.4 + vec3(0.0, 0.33, 0.67)));',
    '  vec3 col = vec3(0.004, 0.004, 0.007) + env * fr + vec3(s1) + vec3(0.45, 0.6, 1.0) * s2 + irid * fr * 0.05;',
    '  gl_FragColor = vec4(col, a); }'
  ].join('\n');
  addMode({
    id: 'hx_symbiote', name: 'SYMBIOTE', glyphs: G('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'),
    base: [220, 25, 92], palette: [[0, 0, 98], [215, 60, 84], [0, 0, 82], [195, 90, 74]],
    links: FAINT, count: 70, noHueShift: true, pageBg: ['#151820', '#040406'],
    shapes: ['sphere', 'gyroid', 'kuen', 'dini', 'urchin', 'seashell', 'aizawa', 'breather'],
    init(S) { Object.assign(S.data, { cr: [], ten: [], drops: [], relT: -1e9, info: null, blobs: [] }); },
    update(S, now, dt) {
      const d = S.data, act = S.active, k = dt / 16.7, p = power(S);
      if (!act.length) return;
      const want = Math.min(40, S.holding ? 26 + Math.round(S.infected * 0.3) : 26);
      while (d.cr.length < want) { const n = pick(act); d.cr.push({ x: n.sx + rand(-40, 40), y: n.sy + rand(-40, 40), vx: 0, vy: 0, r: rand(12, 22), tgt: n, ph: rand(0, TAU) }); }
      if (d.cr.length > want) d.cr.length = want;
      for (const c of d.cr) { // crawl from letter to neighbouring letter
        if (!c.tgt || c.tgt.dying || Math.random() < 0.012 * k) {
          const pool = S.holding && S.infected > 3 ? act.filter((n) => n.inf) : act, from = c.tgt && !c.tgt.dying ? c.tgt : pick(pool);
          let b1 = null, b2 = null, d1 = Infinity, d2 = Infinity;
          for (const n of pool) { if (n === from) continue; const q = (n.sx - from.sx) ** 2 + (n.sy - from.sy) ** 2; if (q < d1) { d2 = d1; b2 = b1; d1 = q; b1 = n; } else if (q < d2) { d2 = q; b2 = n; } }
          c.tgt = (Math.random() < 0.5 ? b1 : b2) || from;
        }
        c.vx += (c.tgt.sx - c.x) * 0.01 * k; c.vy += (c.tgt.sy - c.y) * 0.01 * k; c.vx *= Math.pow(0.86, k); c.vy *= Math.pow(0.86, k);
        c.rr = c.r * (1 + 0.7 * p + 0.12 * Math.sin(now * 0.003 + c.ph));
      }
      for (let i = 0; i < d.cr.length; i++) { const a = d.cr[i]; for (let j = i + 1; j < d.cr.length; j++) { const b = d.cr[j], dx = b.x - a.x, dy = b.y - a.y, q = dx * dx + dy * dy; if (q < 4000 && q > 1) { const f = 0.004 * k; a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f; } } }
      for (const c of d.cr) { c.x += c.vx * k; c.y += c.vy * k; }
      const nT = S.holding ? 1 + S.stage : (S.ptrInside && Math.hypot(S.ptr.x - S.cx, S.ptr.y - S.cy) < S.R * 2.6 ? 1 : 0);
      while (d.ten.length < nT) d.ten.push({ reach: 0, ph: rand(0, TAU) });
      d.ten.forEach((t, i) => {
        t.reach = clamp(t.reach + (i < nT ? 1 : -2) * dt / (S.holding ? 700 : 1100), 0, 1);
        let tx = S.ptr.x, ty = S.ptr.y;
        if (i > 0) { const a = t.ph + i * 1.9 + now * 0.0004; tx = S.cx + Math.cos(a) * S.R * 2.5; ty = S.cy + Math.sin(a) * S.R * 1.9; }
        let best = act[0], bd = Infinity; for (const n of act) { const q = (n.sx - tx) ** 2 + (n.sy - ty) ** 2; if (q < bd) { bd = q; best = n; } }
        t.ax = best.sx; t.ay = best.sy; t.tx = tx; t.ty = ty;
      });
      d.ten = d.ten.filter((t, i) => i < nT || t.reach > 0);
      d.drops = d.drops.filter((q) => now - q.t < 2600 && q.y < S.H + 40);
      for (const q of d.drops) { if (now < q.t0) continue; q.vy += 0.18 * k; q.x += q.vx * k; q.y += q.vy * k; if (q.y > S.H - 40 && !q.sp) { q.sp = 1; q.vy *= -0.15; q.vx *= 0.4; q.r *= 1.3; } }
      const B = d.blobs; B.length = 0; // gather the blobs for the shader: drops and tendrils first, then the crawlers
      for (const q of d.drops) if (now >= q.t0) B.push(q.x, q.y, q.r);
      for (const t of d.ten) {
        if (t.reach <= 0) continue;
        const ex = t.ax + (t.tx - t.ax) * t.reach, ey = t.ay + (t.ty - t.ay) * t.reach, L = Math.hypot(ex - t.ax, ey - t.ay), nx = -(ey - t.ay) / (L || 1), ny = (ex - t.ax) / (L || 1), m = Math.max(2, Math.min(7, Math.ceil(L / 16)));
        for (let i = 0; i <= m; i++) { const s = i / m, w = Math.sin(s * 6 - now * 0.008 + t.ph) * 9 * s; B.push(t.ax + (ex - t.ax) * s + nx * w, t.ay + (ey - t.ay) * s + ny * w, lerp(10 + 3 * S.stage, 5, s)); }
        t.L = L;
      }
      for (const c of d.cr) B.push(c.x, c.y, c.rr || c.r);
      if (B.length > OOZE_N * 3) B.length = OOZE_N * 3;
    },
    three: {
      init(S, X) {
        tk(X); const d = S.data, sc = X.scene; align(S, X);
        X.setBloom(0.55, 0.35, 0.9);
        // a dark cyclorama with a cold overhead key, so the black reads as glossy black
        skyDome(X, 64, 256, (P, w, h) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = y / h, L = 6 + 46 * Math.pow(1 - smooth(0.2, 0.75, v), 1.5), o = (y * w + x) * 4; P[o] = L * 0.85; P[o + 1] = L * 0.92; P[o + 2] = L * 1.15; P[o + 3] = 255; } }, 60);
        const cone = new T.Mesh(new T.ConeGeometry(3.2, 9, 64, 1, true), new T.MeshBasicMaterial({ color: new T.Color(0.12, 0.14, 0.2), transparent: true, opacity: 0.22, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide,
          alphaMap: X.canvasTexture(4, 128, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#000'); g.addColorStop(0.5, '#666'); g.addColorStop(1, '#fff'); c.fillStyle = g; c.fillRect(0, 0, w, h); }) }));
        cone.position.set(0, 3.2, -7); sc.add(cone); d.cone = cone;
        d.u = { uB: { value: Array.from({ length: OOZE_N }, () => new T.Vector4()) }, uN: { value: 0 }, uPR: { value: 1 }, uH: { value: 1 } };
        d.quad = new T.Mesh(new T.PlaneGeometry(2, 2), new T.ShaderMaterial({ uniforms: d.u, vertexShader: OOZE_VS, fragmentShader: OOZE_FS, transparent: true, depthTest: false, depthWrite: false }));
        d.quad.frustumCulled = false; d.quad.renderOrder = 50; sc.add(d.quad);
      },
      update(S, X) {
        const d = S.data, u = d.u, B = d.blobs, n = B.length / 3; align(S, X);
        for (let i = 0; i < n; i++) u.uB.value[i].set(B[i * 3], B[i * 3 + 1], B[i * 3 + 2], 0);
        u.uN.value = n; u.uPR.value = X.renderer.getPixelRatio(); u.uH.value = S.H * u.uPR.value;
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; // shade only the rectangle that holds blobs
        for (let i = 0; i < n; i++) { const r = B[i * 3 + 2] * 2.3; x0 = Math.min(x0, B[i * 3] - r); y0 = Math.min(y0, B[i * 3 + 1] - r); x1 = Math.max(x1, B[i * 3] + r); y1 = Math.max(y1, B[i * 3 + 1] + r); }
        d.quad.visible = n > 0;
        if (n) { const P = d.quad.geometry.attributes.position, X0 = x0 / S.W * 2 - 1, X1 = x1 / S.W * 2 - 1, Y0 = 1 - y1 / S.H * 2, Y1 = 1 - y0 / S.H * 2; P.setXYZ(0, X0, Y1, 0); P.setXYZ(1, X1, Y1, 0); P.setXYZ(2, X0, Y0, 0); P.setXYZ(3, X1, Y0, 0); P.needsUpdate = true; }
      }
    },
    drawNode(S, ctx, n, g, size, a) { ctx.font = `${size.toFixed(1)}px monospace`; ctx.fillStyle = n.inf ? `rgba(255,255,255,${a})` : `rgba(225,230,242,${a * 0.85})`; ctx.fillText(g, n.sx, n.sy); return true; },
    onRelease(S, held, pw) {
      const d = S.data; d.relT = S.now; flash3(S, 1.2, 500);
      // Plateau-Rayleigh: a liquid thread of radius r is unstable to wavelengths λ > 2πr; the fastest mode is λ ≈ 9.02 r,
      // so a tendril of length L breaks into about L / 9.02r drops, each holding one wavelength's volume.
      let N = 0, Lsum = 0, rr = 0;
      for (const t of d.ten) {
        if (t.reach <= 0.05 || !t.L) continue;
        const r = 7 + 1.5 * S.stage, lam = 9.02 * r, n = Math.max(1, Math.floor(t.L / lam)), rd = Math.cbrt(0.75 * r * r * lam);
        const ex = t.ax + (t.tx - t.ax) * t.reach, ey = t.ay + (t.ty - t.ay) * t.reach;
        for (let i = 0; i < n && d.drops.length < 14; i++) { const s = (i + 0.5) / n; d.drops.push({ x: t.ax + (ex - t.ax) * s, y: t.ay + (ey - t.ay) * s, vx: rand(-0.6, 0.6), vy: rand(-1.5, 0), r: Math.min(rd * 0.8, 20), t: S.now, t0: S.now + i * 25 }); }
        N += n; Lsum += t.L; rr = r; t.reach = 0;
      }
      d.info = { N, L: Lsum, r: rr };
      d.cr.forEach((c) => { c.vx += (c.x - S.cx) * 0.05 * pw; c.vy += (c.y - S.cy) * 0.05 * pw; });
      return false;
    },
    hud(S) {
      const d = S.data, t = d.ten.find((q) => q.reach > 0 && q.L);
      if (t) { const r = S.holding ? 7 + 1.5 * S.stage : 7, L = t.L; return `tendril L = ${L.toFixed(0)} px, r ≈ ${r.toFixed(1)} · unstable once L > 2πr (×${(L / (2 * Math.PI * r)).toFixed(1)}) · fastest mode λ ≈ 9.02 r = ${(9.02 * r).toFixed(0)} px → ≈ ${Math.max(1, Math.floor(L / (9.02 * r)))} drop(s) on release`; }
      if (d.info && S.now - d.relT < 6000) return `${d.info.N} droplets pinched off · surface tension minimises area: a thread longer than its circumference is cheaper as spheres`;
      return `${d.cr.length} lumps of ooze, the iso-surface of a summed field · move close and it reaches for you`;
    }
  });

  /* ======================= 6. TITAN: a colossus over a night city, Richter magnitudes ======================= */
  const BLD = 260;
  function titanStep(S, M) {
    const d = S.data; d.lastM = M; d.amp = Math.pow(10, M - 2); d.stepN++; flash3(S, M > 5 ? 0.6 : 0.15, 300);
    d.cam = S.reduceMotion ? 0 : Math.min(0.05, 0.004 * Math.pow(10, (M - 3) / 2));
    S.shake(Math.min(10, 0.5 * Math.pow(10, (M - 3) / 2)));
    const gx = rand(S.W * 0.1, S.W * 0.9);
    for (let k = 0; k < 5 + M * 2; k++) S.spawn(gx + rand(-80, 80), S.H - rand(0, 30), rand(-1.2, 1.2), rand(-2, -0.4), 'rgba(140,132,124,1)', rand(700, 1500), rand(1.2, 2.4), { g: 0.03, drag: 0.97 });
    if (d.off) for (let i = 0; i < BLD; i++) if (Math.random() < 0.05 * (M - 1)) d.off[i] = Math.max(d.off[i], S.now + rand(80, 400));
  }
  addMode({
    id: 'hx_titan', name: 'TITAN', glyphs: G('▣◈◆⬢⬡⌬⏣▲▼■', '#=+*[]'), glyphScale: 1,
    base: [30, 80, 72], palette: [[24, 100, 60], [45, 100, 62], [190, 100, 66], [0, 100, 62]],
    links: FAINT, count: 46, noHueShift: true, scale: 0.75, pageBg: ['#0b0d18', '#030306'],
    shapes: ['sphere', 'buckyball', 'truncated_icosidodecahedron', 'rhombicosidodecahedron', 'weaire_phelan', 'atom', 'menger', 'tesseract'],
    init(S) { Object.assign(S.data, { next: S.now + 1500, seis: new Float32Array(240), si: 0, amp: 0, lastM: 0, stepN: 0, blast: -1e9, waveR: -1, cam: 0, eye: { x: 0, y: 0 } }); },
    update(S, now, dt) {
      const d = S.data, st = S.stage;
      if (now > d.next) { titanStep(S, S.holding ? [3.6, 4.6, 5.6, 6.7][st] + rand(0, 0.5) : rand(2.0, 3.0)); d.next = now + (S.holding ? [2000, 1500, 1050, 700][st] : rand(3200, 4600)); }
      d.amp *= Math.pow(0.5, dt / 260); d.cam *= Math.pow(0.5, dt / 120);
      d.seis[d.si] = d.amp * (gauss() * 0.7 + Math.sin(now * 0.05) * 0.3) + gauss() * 0.4; d.si = (d.si + 1) % d.seis.length;
      const on = S.ptrInside || S.holding, ex = on ? clamp((S.ptr.x - S.cx) / S.W, -0.3, 0.3) : 0, ey = on ? clamp((S.ptr.y - S.cy) / S.H, -0.3, 0.3) : 0;
      d.eye.x += (ex - d.eye.x) * 0.06; d.eye.y += (ey - d.eye.y) * 0.06;
      if (d.waveR >= 0) { d.waveR += dt * 0.006; if (d.bx) for (let i = 0; i < BLD; i++) if (!d.hit[i] && Math.abs(d.bx[i]) < d.waveR) { d.hit[i] = 1; d.off[i] = now + rand(900, 4200); } if (d.waveR > 12) d.waveR = -1; }
    },
    three: {
      init(S, X) {
        tk(X); const d = S.data, sc = X.scene; align(S, X);
        X.setBloom(0.85, 0.5, 0.75); X.studioEnvironment();
        sc.fog = new T.FogExp2(0x0b0d16, 0.045);
        skyDome(X, 64, 256, (P, w, h) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = y / h, haze = Math.exp(-Math.pow((v - 0.5) / 0.08, 2)), o = (y * w + x) * 4; P[o] = 6 + 40 * haze; P[o + 1] = 8 + 26 * haze; P[o + 2] = 18 + 30 * haze; P[o + 3] = 255; } }, 200);
        glowSprite(X, new T.Color(1.6, 1.7, 2), 14).position.set(-40, 30, -90); // the moon
        const key = new T.DirectionalLight(0x9fb4ff, 0.9); key.position.set(-4, 6, 3); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
        Object.assign(key.shadow.camera, { left: -8, right: 8, top: 7, bottom: -4, near: 0.5, far: 30 }); key.shadow.camera.updateProjectionMatrix(); key.shadow.bias = -0.0005; sc.add(key);
        const rim = new T.DirectionalLight(0xff8a50, 0.8); rim.position.set(3, 2, -6); sc.add(rim);
        sc.add(new T.HemisphereLight(0x30405a, 0x0a0806, 0.35));
        // the titan: armour plates built in apparent units, scaled so it stands behind the core at z = -3
        const zT = -3, kT = (2 - zT) / 2, ti = new T.Group(); ti.position.set(0, -0.15 * kT, zT); ti.scale.setScalar(kT); sc.add(ti); d.ti = ti;
        const panelTex = X.canvasTexture(512, 512, (c, w, h) => { c.fillStyle = '#808080'; c.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++) { c.fillStyle = `rgba(${Math.random() < 0.5 ? 255 : 0},${Math.random() < 0.5 ? 255 : 0},${Math.random() < 0.5 ? 255 : 0},0.03)`; c.fillRect(rand(0, w), rand(0, h), rand(2, 30), rand(2, 30)); } c.strokeStyle = '#2a2a2a'; c.lineWidth = 3; for (let k = 0; k < 7; k++) { c.beginPath(); c.moveTo(0, k * 80 + rand(-10, 10)); c.lineTo(w, k * 80 + rand(-10, 10)); c.stroke(); c.beginPath(); c.moveTo(k * 90 + rand(-10, 10), 0); c.lineTo(k * 90 + rand(-10, 10), h); c.stroke(); } c.fillStyle = '#3a3a3a'; for (let k = 0; k < 300; k++) { c.beginPath(); c.arc(rand(0, w), rand(0, h), 2, 0, TAU); c.fill(); } });
        panelTex.encoding = T.LinearEncoding; panelTex.wrapS = panelTex.wrapT = T.RepeatWrapping;
        const armour = new T.MeshStandardMaterial({ color: 0x23272e, metalness: 0.85, roughness: 0.5, bumpMap: panelTex, bumpScale: 0.012, roughnessMap: panelTex, envMapIntensity: 0.3 });
        const RB = T.RoundedBoxGeometry, box = (w, h, dd, x, y, z, rz) => { const m = new T.Mesh(RB ? new RB(w, h, dd, 4, 0.06) : new T.BoxGeometry(w, h, dd), armour); m.position.set(x, y, z); if (rz) m.rotation.z = rz; m.castShadow = m.receiveShadow = true; ti.add(m); return m; };
        box(3.4, 1.4, 1.2, 0, 1.15, -0.6); box(2.6, 1.6, 1.0, 0, -0.3, -0.65); box(1.8, 1.6, 0.9, 0, -1.75, -0.6); // chest, abdomen, pelvis
        box(1.6, 1.0, 1.4, -2.35, 1.55, -0.6, 0.22); box(1.6, 1.0, 1.4, 2.35, 1.55, -0.6, -0.22); // pauldrons
        box(0.9, 2.4, 0.95, -2.6, -0.3, -0.7, 0.06); box(0.9, 2.4, 0.95, 2.6, -0.3, -0.7, -0.06); // arms
        box(0.55, 0.5, 0.6, 0, 2.05, -0.7); d.head = box(0.95, 0.72, 0.85, 0, 2.55, -0.6); // neck, head
        d.visor = new T.Mesh(new T.BoxGeometry(0.66, 0.07, 0.02), new T.MeshBasicMaterial({ color: new T.Color(3, 0.4, 0.2) })); d.visor.position.set(0, 0.02, 0.44); d.head.add(d.visor);
        d.ventMat = new T.MeshBasicMaterial({ color: new T.Color(2, 0.7, 0.2) });
        for (let k = 0; k < 6; k++) { const v = new T.Mesh(new T.BoxGeometry(0.5, 0.035, 0.02), d.ventMat); v.position.set(k < 3 ? -1.05 : 1.05, -0.05 - (k % 3) * 0.12, -0.14); ti.add(v); }
        // the core socket around the sphere and its spinning reactor rings
        const socket = new T.Mesh(new T.TorusGeometry(1.42, 0.09, 24, 128), new T.MeshStandardMaterial({ color: 0x2b3038, metalness: 1, roughness: 0.3 })); socket.position.z = -0.4; sc.add(socket);
        d.rings = [[1.14, 1, 14], [1.25, -1.4, 22], [1.34, 0.7, 9]].map(([r, sp, segs]) => {
          const g = new T.Group(), mat = new T.MeshBasicMaterial({ color: new T.Color(2, 0.8, 0.25) }), arc = new T.TorusGeometry(r, 0.008, 6, 24, TAU / segs * 0.62);
          for (let k = 0; k < segs; k++) { const a = new T.Mesh(arc, mat); a.rotation.z = k / segs * TAU; g.add(a); }
          sc.add(g); return { g, sp, mat };
        });
        d.coreL = new T.PointLight(0xff9040, 30, 8, 2); d.coreL.position.set(0, 0, 0.6); sc.add(d.coreL);
        // the city: instanced towers with emissive window grids, blacked out per building through the instance colour
        const winTex = X.canvasTexture(128, 256, (c, w, h) => { c.fillStyle = '#000'; c.fillRect(0, 0, w, h); for (let y = 6; y < h - 4; y += 10) for (let x = 5; x < w - 4; x += 9) if (Math.random() < 0.3) { c.fillStyle = Math.random() < 0.75 ? `rgba(255,${190 + rand(0, 40) | 0},${110 + rand(0, 50) | 0},1)` : 'rgba(170,215,255,1)'; c.fillRect(x, y, 5, 6); } });
        const bMat = new T.MeshStandardMaterial({ color: 0x161a22, roughness: 0.75, metalness: 0.3, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 1.1 });
        bMat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_INSTANCING_COLOR\n totalEmissiveRadiance *= vColor;\n#endif'); };
        const city = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), bMat, BLD); d.city = city;
        d.bx = new Float32Array(BLD); d.off = new Float64Array(BLD); d.hit = new Uint8Array(BLD);
        for (let i = 0; i < BLD; i++) {
          const back = i < BLD * 0.35, z = back ? rand(-16, -7) : rand(-2.9, -0.7), x = back ? rand(-16, 16) : rand(-6.5, 6.5);
          const w = rand(0.16, 0.42), dpt = rand(0.16, 0.42), h = back ? rand(1.2, 4.5) : rand(0.15, 0.75) * (1 + Math.abs(x) * 0.12);
          _m4.compose(_v.set(x, -1.95, z), _q.identity(), _s.set(w, h, dpt)); city.setMatrixAt(i, _m4); d.bx[i] = x; city.setColorAt(i, _c.setRGB(1, 1, 1));
        }
        city.castShadow = city.receiveShadow = true; sc.add(city);
        const ground = new T.Mesh(new T.PlaneGeometry(60, 60), new T.MeshStandardMaterial({ color: 0x0b0c10, roughness: 0.9, metalness: 0.1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -1.95; ground.receiveShadow = true; sc.add(ground);
        // searchlights with volumetric cones
        const beamAlpha = X.canvasTexture(4, 128, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#000'); g.addColorStop(1, '#fff'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
        d.spots = [-3.2, -1.4, 1.6, 3.4].map((x, i) => {
          const base = new T.Vector3(x, -1.85, -1.2 - (i % 2) * 1.5), L = new T.SpotLight(0xdde8ff, 45, 16, 0.08, 0.5, 2); L.position.copy(base); sc.add(L); sc.add(L.target);
          const cone = new T.Mesh(new T.CylinderGeometry(0.02, 0.6, 9, 24, 1, true).translate(0, -4.5, 0).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: new T.Color(0.07, 0.08, 0.1), alphaMap: beamAlpha, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }));
          cone.position.copy(base); sc.add(cone); return { L, cone, base, ph: i * 1.7 };
        });
        d.beads = beads(X, 240, 0.024); d.web = web3d(X, 240, 1);
        d.pillar = new T.Mesh(new T.CylinderGeometry(0.18, 0.26, 12, 32, 1, true).translate(0, 6, 0), new T.MeshBasicMaterial({ color: new T.Color(1.6, 2.6, 3.2), transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); sc.add(d.pillar);
        d.shock = new T.Mesh(new T.RingGeometry(0.97, 1, 128), new T.MeshBasicMaterial({ color: new T.Color(2.4, 1.6, 0.9), transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); d.shock.rotation.x = -Math.PI / 2; d.shock.position.y = -1.93; sc.add(d.shock);
        d.tgt = new T.Vector3(); d.core = new T.Color();
      },
      update(S, X, now) {
        const d = S.data, p = power(S);
        align(S, X, d.cam * gauss(), d.cam * gauss());
        d.ti.rotation.y = d.eye.x * 0.08; d.head.rotation.set(d.eye.y * 0.4, d.eye.x * 0.9, 0);
        d.visor.material.color.setRGB(1.5 + 3 * p, 0.25 + 0.6 * p, 0.12);
        d.ventMat.color.setRGB(1 + 2.5 * p, 0.35 + 0.6 * p, 0.1 + 0.3 * p);
        const core = d.core.setHSL(lerp(24, 190, p) / 360, 1, 0.5);
        d.rings.forEach((r) => { r.g.rotation.z = now * 0.0004 * r.sp * (1 + 3 * p); r.mat.color.copy(core).multiplyScalar(1.4 + 2.2 * p); });
        d.coreL.color.copy(core); d.coreL.intensity = 12 + 40 * p;
        beadsUpdate(S, d.beads, (n, c) => { c.copy(core).multiplyScalar(n.inf ? 3 : 1.2); return n.inf ? 1.25 : 0.9; });
        webUpdate(S, d.web, 0, (l, c) => c.copy(core).multiplyScalar(1.4));
        d.spots.forEach((s) => {
          let tx = s.base.x * 0.6 + Math.sin(now * 0.00035 + s.ph) * 3, ty = 3 + Math.cos(now * 0.0003 + s.ph) * 1.5, tz = -4;
          if (S.ptrInside && !S.holding) { ptrW(S, -2, d.tgt); tx = d.tgt.x; ty = d.tgt.y; tz = -2; }
          if (S.holding) { const k = smooth(0, 1500, S.held); tx = lerp(tx, 0, k); ty = lerp(ty, 0, k); tz = lerp(tz, -0.4, k); }
          s.L.target.position.set(tx, ty, tz); s.cone.lookAt(tx, ty, tz);
        });
        for (let i = 0; i < BLD; i++) { const o = now < d.off[i] ? 0.04 : 1; d.city.setColorAt(i, _c.setRGB(o, o, o)); } // blackouts and flicker
        d.city.instanceColor.needsUpdate = true;
        const bt = (now - d.blast) / 1100;
        d.pillar.material.opacity = bt >= 0 && bt < 1 ? (1 - bt) * (S.reduceMotion ? 0.5 : 1) : 0; d.pillar.scale.set(Math.max(0.05, 1 - bt * 0.6), 1, Math.max(0.05, 1 - bt * 0.6));
        if (d.waveR >= 0) { d.shock.material.opacity = 0.9 * (1 - d.waveR / 12); d.shock.scale.setScalar(Math.max(0.01, d.waveR)); } else d.shock.material.opacity = 0;
      }
    },
    drawNode(S, ctx, n, g, size, a) { const c = hsl2rgb(lerp(28, 190, power(S)), 100, n.inf ? 82 : 72); return letter(S, ctx, n, g, size, a, `rgba(${c.join(',')},${a * 0.9})`, c.join(',')); },
    over(S, ctx) { // instrument: a seismograph drum, log amplitude
      const d = S.data, sw = Math.min(250, S.W * 0.3), sh = 66, sx = S.W - sw - 24, sy = Math.max(80, S.H * 0.12);
      panel(ctx, sx, sy, sw, sh, `SEISMOGRAPH · log₁₀ A · M ${d.lastM.toFixed(1)}`);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.moveTo(sx + 6, sy + sh / 2 + 6); ctx.lineTo(sx + sw - 6, sy + sh / 2 + 6); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,150,110,0.9)'; ctx.lineWidth = 1; ctx.beginPath();
      const N = d.seis.length;
      for (let i = 0; i < N; i++) { const v = d.seis[(d.si + i) % N], y = sy + sh / 2 + 6 - Math.sign(v) * Math.log10(1 + Math.abs(v)) * (sh / 2 - 12) / 5.5, x = sx + 6 + i / (N - 1) * (sw - 12); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke();
    },
    onRelease(S, held, pw) {
      const d = S.data, M = 6.2 + 1.6 * Math.min(1, pw);
      d.blast = S.now; d.waveR = 0; d.next = S.now + 3800; if (d.hit) d.hit.fill(0);
      titanStep(S, M); flash3(S, 2.5, 900);
      for (let k = 0; k < 60; k++) { const a = rand(-Math.PI, 0), v = rand(2, 8) * pw; S.spawn(S.cx, S.cy, Math.cos(a) * v, Math.sin(a) * v, 'rgba(190,230,255,1)', rand(600, 1300), rand(0.8, 2), { g: 0.06 }); }
      S.shake(12);
      return false;
    },
    hud(S) {
      const d = S.data, M = d.lastM, E = Math.pow(10, 1.5 * M + 4.8), t = E / 4.184e9; // 1 t TNT = 4.184 GJ
      const tnt = t >= 1e6 ? (t / 1e6).toFixed(1) + ' Mt' : t >= 1e3 ? (t / 1e3).toFixed(1) + ' kt' : t >= 1 ? t.toFixed(1) + ' t' : (t * 1000).toFixed(0) + ' kg';
      const head = `step ${d.stepN} · M ${M.toFixed(1)} · E = 10^(1.5M + 4.8) J = ${sci(E)} J ≈ ${tnt} TNT`;
      return S.holding ? `${head} · +1 magnitude = ×10 amplitude, ×31.6 energy (a log scale)` : `${head} · magnitude is log₁₀ of amplitude: M 7 shakes 10 000× harder than M 3`;
    }
  });

  /* ======================= 7. ENTROPY: heat death, S = k ln W ======================= */
  const ERAS = [[0, 'PRIMORDIAL'], [6, 'STELLIFEROUS'], [14, 'DEGENERATE'], [40, 'BLACK HOLE'], [100, 'DARK']];
  const eraOf = (lg) => { let e = ERAS[0][1]; for (const x of ERAS) if (lg >= x[0]) e = x[1]; return e; };
  function entropyW(S) { // coarse-grain the screen into 8 × 6 cells: W = N!/Π nᵢ!, the ways to deal N letters into them
    const cols = 8, rows = 6, cnt = new Array(cols * rows).fill(0), act = S.active, N = act.length;
    for (const n of act) { const i = clamp(Math.floor(n.sx / S.W * cols), 0, cols - 1), j = clamp(Math.floor(n.sy / S.H * rows), 0, rows - 1); cnt[j * cols + i]++; }
    let lnW = lnFact(N); for (const c of cnt) lnW -= lnFact(c);
    const M = cols * rows, q = Math.floor(N / M), rem = N - q * M; let lnMax = lnFact(N); for (let i = 0; i < M; i++) lnMax -= lnFact(q + (i < rem ? 1 : 0));
    return { lnW, lnMax, N };
  }
  const STARS = 2400;
  addMode({
    id: 'hx_entropy', name: 'ENTROPY', glyphs: G('SkWlnΩQ∂ΔT·∘•*⊙', 'SkWlnQT*'),
    base: [205, 70, 88], palette: [[40, 100, 72], [20, 90, 60], [0, 60, 48], [0, 10, 38]],
    links: FAINT, count: 110, noHueShift: true, pageBg: ['#070812', '#010102'], glyphScale: 0.85,
    shapes: ['sphere', 'cube', 'sierpinski', 'hilbert', 'dodecahedron', 'galaxy', 'thomas', 'halvorsen'],
    init(S) { Object.assign(S.data, { heat: 0, rel: -1e9, sw: { lnW: 0, lnMax: 1, N: 1 }, deltaS: 0, lg: 6 }); },
    onPress(S) { S.data.s0 = entropyW(S).lnW; },
    update(S, now, dt) {
      const d = S.data, p = power(S);
      d.lg = S.holding ? 6 + 100 * Math.pow(Math.min(1.08, S.held / 5200), 1.6) : lerp(d.lg, 6, 1 - Math.pow(0.5, dt / 250));
      d.heat = S.holding ? p : d.heat * Math.pow(0.5, dt / 300);
      for (const n of S.active) { // a random walk: ⟨x²⟩ = 2Dt per axis
        const nd = n.data; if (nd.ox === undefined) { nd.ox = 0; nd.oy = 0; }
        let D = S.holding ? 0.03 + 22 * p * p * p : 0;
        if (!S.holding && S.ptrInside) { const q = Math.hypot(n.sx - S.ptr.x, n.sy - S.ptr.y); if (q < 120) D = 0.4 * (1 - q / 120); }
        const sd = Math.sqrt(2 * D * dt); nd.ox += gauss() * sd; nd.oy += gauss() * sd;
        if (!S.holding) { const k = Math.pow(0.5, dt / (now - d.rel < 1500 ? 140 : 400)); nd.ox *= k; nd.oy *= k; }
      }
      if (now - (d.wT || 0) > 120) { d.wT = now; d.sw = entropyW(S); }
    },
    three: {
      init(S, X) {
        tk(X); const d = S.data, sc = X.scene; align(S, X);
        X.setBloom(1.0, 0.55, 0.5);
        const g = new T.BufferGeometry(), P = new Float32Array(STARS * 3); d.sc0 = new Float32Array(STARS * 3); d.sC = new Float32Array(STARS * 3); d.die = new Float32Array(STARS);
        for (let i = 0; i < STARS; i++) {
          const u = rand(-1, 1), th = rand(0, TAU), r = rand(30, 90), s = Math.sqrt(1 - u * u); P[i * 3] = Math.cos(th) * s * r; P[i * 3 + 1] = u * r; P[i * 3 + 2] = -Math.abs(Math.sin(th) * s * r) - 10;
          const hot = Math.random(), b = Math.pow(Math.random(), 2.5) * 2.4 + 0.3; d.sc0[i * 3] = b; d.sc0[i * 3 + 1] = b * (0.75 + 0.25 * hot); d.sc0[i * 3 + 2] = b * (0.55 + 0.5 * hot);
          d.die[i] = 6 + Math.pow(Math.random(), 0.6) * 9; // nearly every star is gone by 10^15 yr
        }
        g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('color', new T.BufferAttribute(d.sC, 3).setUsage(T.DynamicDrawUsage));
        d.stars = new T.Points(g, new T.PointsMaterial({ size: 0.45, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending })); sc.add(d.stars);
        d.bh = Array.from({ length: 6 }, () => {
          const grp = new T.Group(); grp.position.set(rand(-14, 14), rand(-7, 7), rand(-30, -20));
          grp.add(new T.Mesh(new T.SphereGeometry(0.5, 24, 16), new T.MeshBasicMaterial({ color: 0x000000 })));
          const disk = new T.Mesh(new T.RingGeometry(0.75, 1.6, 64), new T.MeshBasicMaterial({ color: new T.Color(2.4, 1.1, 0.4), transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); disk.rotation.x = rand(1.1, 1.4); grp.add(disk);
          grp.visible = false; sc.add(grp); return { grp, disk, born: rand(14, 30), die: rand(67, 100) };
        });
        d.beads = beads(X, 240, 0.016); d.web = web3d(X, 240, 1);
      },
      update(S, X) {
        const d = S.data, lg = d.lg, C = d.sC; align(S, X);
        if (S.now - (d.cT || 0) > 90) { // stars burn out one by one as the cosmic clock passes their lifetimes
          d.cT = S.now;
          for (let i = 0; i < STARS; i++) { const life = clamp((d.die[i] - lg) / 3, 0, 1), red = 1 - life; C[i * 3] = d.sc0[i * 3] * life; C[i * 3 + 1] = d.sc0[i * 3 + 1] * life * (1 - 0.6 * red); C[i * 3 + 2] = d.sc0[i * 3 + 2] * life * (1 - 0.85 * red); }
          d.stars.geometry.attributes.color.needsUpdate = true;
        }
        d.bh.forEach((b) => { const a = smooth(b.born, b.born + 4, lg) * (1 - smooth(b.die - 6, b.die, lg)); b.grp.visible = a > 0.01; b.grp.scale.setScalar(0.4 + a); b.disk.material.opacity = a * 0.7; b.grp.rotation.z += 0.002; });
        const h = d.heat;
        beadsUpdate(S, d.beads, (n, c) => { const k = n.inf ? 1.6 : 1; c.setRGB(lerp(1.0, 0.9, h) * k, lerp(1.15, 0.32, h) * k, lerp(1.5, 0.22, h) * k).multiplyScalar(1 - 0.5 * h); return 1; });
        webUpdate(S, d.web, 0, (l, c) => c.setRGB(lerp(0.8, 0.5, h), lerp(0.9, 0.15, h), lerp(1.3, 0.1, h)));
      }
    },
    warp(S, n) { const nd = n.data; if (nd.ox !== undefined) { n.sx += nd.ox; n.sy += nd.oy; } },
    drawNode(S, ctx, n, g, size, a) {
      const h = S.data.heat, c = n.inf ? S.mode.palette[Math.min(3, n.gen % 4)] : S.mode.base;
      const hh = lerp(c[0], 10, h), ss = lerp(c[1], 18, h), ll = lerp(c[2], 34, h * 0.85);
      ctx.font = `${size.toFixed(1)}px monospace`; ctx.fillStyle = `hsla(${hh.toFixed(0)},${ss.toFixed(0)}%,${ll.toFixed(0)}%,${a * (1 - 0.35 * h)})`; ctx.fillText(g, n.sx, n.sy);
      return true;
    },
    over(S, ctx) { // instrument: entropy gauge and the cosmic clock
      const d = S.data, sw = d.sw, fr = clamp(sw.lnW / (sw.lnMax || 1), 0, 1), x = 24, y = Math.max(110, S.H * 0.2), w = 8, h = Math.min(200, S.H * 0.32);
      panel(ctx, x - 10, y - 26, 150, h + 40, 'S / k = ln W');
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x, y, w, h);
      const g = ctx.createLinearGradient(0, y + h, 0, y); g.addColorStop(0, '#6cc8ff'); g.addColorStop(0.6, '#ffa060'); g.addColorStop(1, '#7a4a44');
      ctx.fillStyle = g; ctx.fillRect(x, y + h * (1 - fr), w, h * fr);
      ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(225,230,250,0.8)'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(`${sw.lnW.toFixed(1)}`, x + w + 8, y + h * (1 - fr)); ctx.fillText(`max ${sw.lnMax.toFixed(1)}`, x + w + 8, y + 4);
      ctx.fillText(`t ≈ 10${sup(Math.floor(d.lg))} yr`, x + w + 8, y + h - 18); ctx.fillText(eraOf(d.lg).toLowerCase() + ' era', x + w + 8, y + h - 4);
    },
    onRelease(S, held, pw) {
      const d = S.data, sw = entropyW(S); d.rel = S.now; d.deltaS = Math.max(0, sw.lnW - (d.s0 || 0)); flash3(S, 2, 800);
      for (let k = 0; k < 50; k++) { const a = rand(0, TAU), v = rand(1, 5) * pw; S.spawn(S.cx, S.cy, Math.cos(a) * v, Math.sin(a) * v, 'rgba(255,230,190,1)', rand(500, 1200), rand(0.8, 1.8)); }
      return false;
    },
    hud(S) {
      const d = S.data, sw = d.sw;
      if (S.holding) return `S = k ln W · W = N!/Πnᵢ! over 48 cells: ln W = ${sw.lnW.toFixed(1)} of ${sw.lnMax.toFixed(1)} · ${eraOf(d.lg).toLowerCase()} era, 10${sup(Math.floor(d.lg))} yr · the second law: ΔS ≥ 0`;
      if (S.now - d.rel < 5000) return `order restored by a Boltzmann fluctuation · ΔS/k was ${d.deltaS.toFixed(1)} → odds e^(−${d.deltaS.toFixed(0)}) · do not wait for one`;
      return `S/k = ln W = ${sw.lnW.toFixed(1)} (max ${sw.lnMax.toFixed(1)}) for ${sw.N} letters in 48 cells · hold to fast-forward to the heat death`;
    }
  });
})(window.SPHERE);
