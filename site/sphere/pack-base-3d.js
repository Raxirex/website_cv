/* The Sphere: base pack. The first shapes, web styles and modes (Origin, Cyberpunk, Mathematics, Arcane, Hologram). */
(function (SP) {
  'use strict';
  const { TAU, GOLDEN, rand, pick, clamp } = SP.util;
  const grid = (n, f) => Array.from({ length: n }, (_, i) => f(i, n));
  const fib = (i, n) => { const y = 1 - 2 * i / Math.max(1, n - 1), r = Math.sqrt(Math.max(0, 1 - y * y)), t = GOLDEN * i; return [Math.cos(t) * r, y, Math.sin(t) * r]; };

  /* ---------------- Shapes ---------------- */
  SP.addShape('sphere', { name: 'Fibonacci sphere', make: (n) => grid(n, fib) });
  SP.addShape('torus', { name: 'Torus', make: (n) => { const rings = Math.max(3, Math.round(Math.sqrt(n / 3))), per = Math.ceil(n / rings); return grid(n, (i) => { const u = TAU * (i % per) / per, v = TAU * Math.floor(i / per) / rings, r = 1 + 0.45 * Math.cos(v); return [r * Math.cos(u), 0.45 * Math.sin(v), r * Math.sin(u)]; }); } });
  SP.addShape('trefoil', { name: 'Trefoil knot', make: (n) => grid(n, (i) => { const t = TAU * i / n; return [Math.sin(t) + 2 * Math.sin(2 * t), Math.cos(t) - 2 * Math.cos(2 * t), -Math.sin(3 * t)]; }) });
  SP.addShape('mobius', { name: 'Möbius strip', make: (n) => { const per = Math.ceil(n / 4); return grid(n, (i) => { const u = TAU * (i % per) / per, v = -0.5 + Math.floor(i / per) / 3, r = 1 + v / 2 * Math.cos(u / 2); return [r * Math.cos(u), v / 2 * Math.sin(u / 2), r * Math.sin(u)]; }); } });
  SP.addShape('klein', { name: 'Klein bottle', make: (n) => { const rows = Math.max(3, Math.round(Math.sqrt(n / 3))), per = Math.ceil(n / rows); return grid(n, (i) => { const u = TAU * (i % per) / per, v = TAU * Math.floor(i / per) / rows, a = 2 + Math.cos(u / 2) * Math.sin(v) - Math.sin(u / 2) * Math.sin(2 * v); return [a * Math.cos(u), Math.sin(u / 2) * Math.sin(v) + Math.cos(u / 2) * Math.sin(2 * v), a * Math.sin(u)]; }); } });
  SP.addShape('harmonic', { name: 'Spherical harmonic |Y₃²|', make: (n) => grid(n, (i) => { const [x, y, z] = fib(i, n), th = Math.acos(clamp(y, -1, 1)), ph = Math.atan2(z, x), r = 0.35 + Math.abs(Math.sin(th) * Math.sin(th) * Math.cos(th) * Math.cos(2 * ph)) * 2.6; return [x * r, y * r, z * r]; }) });
  SP.addShape('lorenz', { name: 'Lorenz attractor', make: (n) => {
    let x = 0.1, y = 0, z = 0; const out = [], dt = 0.005, step = Math.max(1, Math.floor(14000 / n));
    for (let s = 0; out.length < n && s < 2000 + step * n + 1; s++) {
      const dx = 10 * (y - x), dy = x * (28 - z) - y, dz = x * y - (8 / 3) * z;
      x += dx * dt; y += dy * dt; z += dz * dt;
      if (s >= 2000 && (s - 2000) % step === 0) out.push([x, z - 25, y]);
    }
    return out;
  } });
  SP.addShape('helix', { name: 'Double helix', make: (n) => grid(n, (i) => { const s = i % 2, k = Math.floor(i / 2), half = Math.max(2, Math.ceil(n / 2)), t = k * (16.8 / half) + s * Math.PI; return [0.45 * Math.cos(t), -1 + 2 * k / (half - 1), 0.45 * Math.sin(t)]; }) });
  SP.addShape('galaxy', { name: 'Spiral galaxy', make: (n) => { const per = Math.max(2, Math.ceil(n / 4)); return grid(n, (i) => { const arm = i % 4, k = Math.floor(i / 4), r = 0.12 + 0.88 * k / (per - 1), a = arm * TAU / 4 + r * 3.4 + 0.15 * Math.sin(i * 12.9898); return [r * Math.cos(a), 0.05 * Math.sin(i * 78.233), r * Math.sin(a)]; }); } });
  SP.addShape('lissajous', { name: 'Lissajous knot', make: (n) => grid(n, (i) => { const t = TAU * i / n; return [Math.sin(3 * t), Math.sin(2 * t + 0.7), Math.sin(5 * t + 1.3)]; }) });
  SP.addShape('tesseract', { name: 'Tesseract (4D)', four: true, fixed: true, make: () => {
    const v = [];
    for (let i = 0; i < 16; i++) v.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]);
    const pts = v.map((p) => p.slice());
    for (let a = 0; a < 16; a++) for (let b = a + 1; b < 16; b++) {
      const d = a ^ b;
      if ((d & (d - 1)) === 0) [1 / 3, 2 / 3].forEach((f) => pts.push(v[a].map((c, k) => c + (v[b][k] - c) * f)));
    }
    return pts; // 16 vertices + 2 points on each of the 32 edges
  } });

  /* ---------------- Web styles ---------------- */
  SP.addLink('line', (ctx, L, S) => S.line(L.ax, L.ay, L.bx, L.by));
  SP.addLink('circuit', (ctx, L, S) => {
    ctx.beginPath(); ctx.moveTo(L.ax, L.ay); ctx.lineTo(L.bx, L.ay); ctx.lineTo(L.bx, L.by); ctx.stroke();
    ctx.fillRect(L.bx - 2, L.ay - 2, 4, 4);
  });
  SP.addLink('curve', (ctx, L) => {
    const mx = (L.ax + L.bx) / 2, my = (L.ay + L.by) / 2;
    ctx.beginPath(); ctx.moveTo(L.ax, L.ay); ctx.quadraticCurveTo(mx - (L.by - L.ay) * 0.3, my + (L.bx - L.ax) * 0.3, L.bx, L.by); ctx.stroke();
  });
  SP.addLink('beam', (ctx, L, S) => {
    ctx.lineWidth = 4 + L.stage * 2; ctx.strokeStyle = L.color(L.alpha * 0.2); S.line(L.ax, L.ay, L.bx, L.by);
    ctx.lineWidth = 1; ctx.strokeStyle = `rgba(255,255,255,${L.alpha})`; S.line(L.ax, L.ay, L.bx, L.by);
  });
  SP.addLink('sigil', (ctx, L, S) => {
    S.line(L.ax, L.ay, L.bx, L.by);
    ctx.beginPath(); ctx.arc(L.bx, L.by, 3 + L.stage, 0, TAU); ctx.stroke();
  });
  SP.addLink('pulse', (ctx, L, S) => {
    ctx.setLineDash([3, 5]); ctx.lineDashOffset = -L.now * 0.04; S.line(L.ax, L.ay, L.bx, L.by); ctx.setLineDash([]);
    const f = (L.age / 500) % 1;
    ctx.fillStyle = `rgba(255,255,255,${L.alpha})`; ctx.beginPath(); ctx.arc(L.ax + (L.bx - L.ax) * f, L.ay + (L.by - L.ay) * f, 1.8, 0, TAU); ctx.fill();
  });

  /* ---------------- Modes ---------------- */
  SP.addMode({
    id: 'origin', name: 'ORIGIN', glyphs: '0123456789αβγδεζηθικλμνξοπρστυφχψω力智火ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    base: [0, 0, 100], palette: [[0, 0, 100], [190, 70, 80], [300, 70, 80]], link: 'line', fade: 0.8,
    shapes: ['sphere', 'torus', 'trefoil', 'lissajous', 'rhombic_hexecontahedron', 'great_icosahedron', 'snub_dodecahedron', 'compound_five_cubes', 'buckyball', 'weaire_phelan', 'disdyakis_triacontahedron', 'deltoidal_hexecontahedron']
  });

  /* ================= Realistic 3D modes (Cyberpunk, Mathematics, Arcane, Hologram) =================
   * Each mode renders a lit three.js scene through the engine's 3D layer (sphere-3d.js) and draws the
   * letters, webs and finales in 3D. Without WebGL, the original 2D look is kept as the fallback.
   */
  const THREE = window.THREE;
  const once = {};
  const safe = (tag, fn, fb) => function () {
    try { return fn.apply(this, arguments); } catch (err) { if (!once[tag]) { once[tag] = 1; console.error('[sphere ' + tag + ']', err); } return fb; }
  };
  function guarded(def) { // a bug in a hook logs once instead of throwing every frame
    Object.keys(def).forEach((k) => { if (typeof def[k] === 'function') def[k] = safe(def.id + '.' + k, def[k], k === 'drawNode' ? false : undefined); });
    if (def.three) Object.keys(def.three).forEach((k) => { def.three[k] = safe(def.id + '.3d.' + k, def.three[k]); });
    return def;
  }
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const ease = (cur, want, dt, rate) => cur + (want - cur) * (1 - Math.exp(-dt * rate / 1000));
  const mulberry = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const _col = THREE ? new THREE.Color() : null;
  // [h, s, l] (+ hue shift) -> linear RGB, scaled by k
  function linRGB(c, shift, k, out) {
    _col.setHSL(((((c[0] + (shift || 0)) % 360) + 360) % 360) / 360, c[1] / 100, c[2] / 100).convertSRGBToLinear();
    out = out || [0, 0, 0]; k = k === undefined ? 1 : k;
    out[0] = _col.r * k; out[1] = _col.g * k; out[2] = _col.b * k; return out;
  }
  function palettes(S, k) { // linear palette (with the live hue shift) for 3D colours
    const m = S.mode, sh = m.noHueShift ? 0 : S.hueShift;
    return { base: linRGB(m.base, sh, k), pal: m.palette.map((c) => linRGB(c, sh, k)) };
  }

  const GL_NOISE = [
    'float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }',
    'float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y); }',
    'float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }',
    'float hash13(vec3 p){ return hash12(p.xy + p.z * 17.17); }',
    'float vnoise3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
    '  float a = mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y);',
    '  float b = mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y);',
    '  return mix(a, b, f.z); }'
  ].join('\n') + '\n';

  // The 3D layer renders into the bloom composer, and three r128 already tone-maps into render targets,
  // so the composer's own ACES output pass would tone-map twice. Render linear HDR instead while a mode runs.
  function linearPipeline(X, C) {
    C.prevTone = X.renderer.toneMapping;
    X.renderer.toneMapping = THREE.NoToneMapping;
    C.restore.push(() => { X.renderer.toneMapping = C.prevTone; });
  }
  // Image-based lighting from a studio room, freeing the room and the generator (the layer's helper keeps them).
  function studioEnv(X, C) {
    if (!THREE.RoomEnvironment) return;
    const pm = new THREE.PMREMGenerator(X.renderer), room = new THREE.RoomEnvironment(), rt = pm.fromScene(room, 0.04);
    pm.dispose();
    room.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    X.scene.environment = rt.texture; C.bin.push(rt);
  }
  function freeAll(C) {
    if (C.X && C.X.scene) C.X.scene.traverse((o) => { if (o.shadow && o.shadow.map) { o.shadow.map.dispose(); o.shadow.map = null; } }); // shadow maps are not freed with the scene
    (C.restore || []).forEach((f) => { try { f(); } catch (err) { /* already gone */ } });
    (C.bin || []).forEach((o) => { try { o.dispose(); } catch (err) { /* already gone */ } });
  }

  /* ---- letters as glyph billboards (one instanced draw call) ---- */
  function glyphAtlas(chars, font) {
    const list = Array.from(new Set(Array.from(chars))), cell = 64, cols = Math.ceil(Math.sqrt(list.length)), rows = Math.ceil(list.length / cols);
    const c = document.createElement('canvas'); c.width = cols * cell; c.height = rows * cell;
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font || `${Math.round(cell * 0.56)}px monospace`;
    g.globalCompositeOperation = 'lighter';
    const draw = (style, blur) => { g.filter = blur ? `blur(${blur}px)` : 'none'; g.fillStyle = style; list.forEach((ch, i) => g.fillText(ch, (i % cols + 0.5) * cell, (Math.floor(i / cols) + 0.54) * cell)); };
    draw('#00a000', 7); draw('#006000', 2.5); draw('#ff0000', 0); // R: sharp glyph, G: its glow
    g.filter = 'none';
    const tex = new THREE.CanvasTexture(c);
    const index = {}; list.forEach((ch, i) => (index[ch] = i));
    return { tex, cols, rows, index, list };
  }
  const GLYPH_VS = [
    'attribute vec3 iPos; attribute vec3 iCol; attribute vec4 iDat;',
    'uniform vec2 uGrid;',
    'varying vec2 vUv; varying vec4 vBox; varying vec3 vCol; varying float vA; varying float vFx; varying float vDepth; varying float vY;',
    'void main(){',
    '  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);',
    '  mv.xy += position.xy * iDat.y;',
    '  float gi = iDat.x, cx = mod(gi, uGrid.x), cy = floor(gi / uGrid.x);',
    '  vBox = vec4(cx / uGrid.x, 1.0 - (cy + 1.0) / uGrid.y, (cx + 1.0) / uGrid.x, 1.0 - cy / uGrid.y);',
    '  vUv = mix(vBox.xy, vBox.zw, uv);',
    '  vCol = iCol; vA = iDat.z; vFx = iDat.w; vDepth = -mv.z; vY = (modelMatrix * vec4(iPos, 1.0)).y + position.y * iDat.y;',
    '  gl_Position = projectionMatrix * mv;',
    '}'].join('\n');
  const GLYPH_FS = [
    'uniform sampler2D uAtlas; uniform float uCore, uGlow, uWhite, uSplit, uFog, uScan, uTime, uBlend, uWipe;',
    'varying vec2 vUv; varying vec4 vBox; varying vec3 vCol; varying float vA; varying float vFx; varying float vDepth; varying float vY;',
    'void main(){',
    '  vec4 t = texture2D(uAtlas, vUv);',
    '  vec3 hot = mix(vCol, vec3(dot(vCol, vec3(0.33))), uWhite) ;',
    '  vec3 c = vCol * t.g * uGlow;',
    '  if (uSplit > 0.0 && vFx > 0.01) {',
    '    vec2 o = vec2(uSplit * vFx * (vBox.z - vBox.x), 0.0);',
    '    float r = texture2D(uAtlas, clamp(vUv + o, vBox.xy, vBox.zw)).r, b = texture2D(uAtlas, clamp(vUv - o, vBox.xy, vBox.zw)).r;',
    '    c += vec3(r * 1.3, t.r, b * 1.3) * hot * uCore + vec3(r, 0.0, b) * 0.6 * uCore;',
    '  } else c += hot * t.r * uCore;',
    '  if (uScan > 0.0) c *= 1.0 - uScan * (0.5 + 0.5 * sin(vY * 38.0 - uTime * 5.0));',
    '  if (vY > uWipe) discard;',
    '  c += vCol * exp(-abs(vY - uWipe) * 25.0) * 2.0 * (t.r + t.g);',
    '  float fog = exp(-uFog * uFog * vDepth * vDepth);',
    '  if (uBlend > 0.5) gl_FragColor = vec4(c * fog, clamp(t.r * 1.2 + t.g * 0.25, 0.0, 1.0) * vA);',
    '  else gl_FragColor = vec4(c * vA * fog, 1.0);',
    '}'].join('\n');
  function instancedQuad(attrs, max) {
    const plane = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry();
    g.index = plane.index; g.setAttribute('position', plane.getAttribute('position')); g.setAttribute('uv', plane.getAttribute('uv'));
    const out = { g };
    Object.keys(attrs).forEach((k) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(max * attrs[k]), attrs[k]); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(k, a); out[k] = a; });
    g.instanceCount = 0;
    return out;
  }
  function glyphCloud(atlas, max, o) {
    const q = instancedQuad({ iPos: 3, iCol: 3, iDat: 4 }, max), P = q.iPos.array, Cc = q.iCol.array, D = q.iDat.array;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uAtlas: { value: atlas.tex }, uGrid: { value: new THREE.Vector2(atlas.cols, atlas.rows) }, uCore: { value: o.core || 2 }, uGlow: { value: o.glow || 1 },
        uWhite: { value: o.white || 0.3 }, uSplit: { value: 0 }, uWipe: { value: 1e5 }, uFog: { value: o.fog || 0 }, uScan: { value: 0 }, uTime: { value: 0 }, uBlend: { value: o.normal ? 1 : 0 } },
      vertexShader: GLYPH_VS, fragmentShader: GLYPH_FS, transparent: true, depthWrite: false, depthTest: o.depthTest !== false,
      blending: o.normal ? THREE.NormalBlending : THREE.AdditiveBlending
    });
    const mesh = new THREE.Mesh(q.g, mat); mesh.frustumCulled = false; mesh.renderOrder = o.order || 10;
    let n = 0;
    return {
      mesh, mat, atlas,
      begin() { n = 0; },
      add(x, y, z, r, g, b, gi, size, alpha, fx) {
        if (n >= max) return;
        P[n * 3] = x; P[n * 3 + 1] = y; P[n * 3 + 2] = z; Cc[n * 3] = r; Cc[n * 3 + 1] = g; Cc[n * 3 + 2] = b;
        D[n * 4] = gi; D[n * 4 + 1] = size; D[n * 4 + 2] = alpha; D[n * 4 + 3] = fx || 0; n++;
      },
      end() { q.g.instanceCount = n; q.iPos.needsUpdate = q.iCol.needsUpdate = q.iDat.needsUpdate = true; }
    };
  }

  /* ---- glowing ribbons between two points (webs, edges, sparks): one instanced draw call ---- */
  const BEAM_VS = [
    'attribute vec3 iA; attribute vec3 iB; attribute vec3 iC; attribute vec4 iP;',
    'varying vec2 vUv; varying vec3 vCol; varying float vA; varying float vSeed; varying float vLen; varying float vDepth; varying float vY;',
    'void main(){',
    '  vec4 a = modelViewMatrix * vec4(iA, 1.0), b = modelViewMatrix * vec4(iB, 1.0);',
    '  float t = position.x + 0.5;',
    '  vec3 d = b.xyz - a.xyz; float L = length(d); vec3 dir = L > 1e-5 ? d / L : vec3(1.0, 0.0, 0.0);',
    '  vec3 p = mix(a.xyz, b.xyz, t) + dir * (t - 0.5) * iP.x;',
    '  vec3 side = cross(dir, normalize(p)); float sl = length(side); side = sl > 1e-5 ? side / sl : vec3(0.0, 1.0, 0.0);',
    '  p += side * position.y * iP.x;',
    '  vUv = vec2(t, position.y * 2.0); vCol = iC; vA = iP.y; vSeed = iP.z; vLen = L + iP.x; vDepth = -p.z;',
    '  vY = (modelMatrix * vec4(mix(iA, iB, t), 1.0)).y;',
    '  gl_Position = projectionMatrix * vec4(p, 1.0);',
    '}'].join('\n');
  const BEAM_FS = [
    'uniform float uTime, uFog, uHot, uScan, uWipe; uniform int uStyle;',
    'varying vec2 vUv; varying vec3 vCol; varying float vA; varying float vSeed; varying float vLen; varying float vDepth; varying float vY;',
    'void main(){',
    '  float y = vUv.y, core = exp(-y * y * 5.0), hot = exp(-y * y * 40.0);',
    '  vec3 c = vCol * (core * 0.5 + hot * uHot);',
    '  float s = vUv.x * vLen;',
    '  if (uStyle == 1) { float k = fract(s * 0.3 - uTime * 1.3 + vSeed * 7.0); c += vCol * pow(k, 16.0) * 6.0 * hot; }',
    '  else if (uStyle == 2) { float n = 0.55 + 0.45 * sin(s * 5.0 - uTime * 11.0 + vSeed * 40.0) * sin(s * 2.3 + uTime * 7.0 + vSeed); c *= 0.45 + n; }',
    '  else if (uStyle == 3) { c *= 0.2 + 0.8 * step(0.45, fract(s * 1.6 - uTime * 1.2 + vSeed)); }',
    '  if (uScan > 0.0) c *= 1.0 - uScan * (0.5 + 0.5 * sin(vY * 38.0 - uTime * 5.0));',
    '  if (vY > uWipe) discard;',
    '  c += vCol * exp(-abs(vY - uWipe) * 25.0) * 2.0 * core;',
    '  float fog = exp(-uFog * uFog * vDepth * vDepth);',
    '  float ends = smoothstep(0.0, 0.04, vUv.x) * smoothstep(1.0, 0.96, vUv.x);',
    '  gl_FragColor = vec4(c * vA * fog * ends, 1.0);',
    '}'].join('\n');
  function beams(max, o) {
    const q = instancedQuad({ iA: 3, iB: 3, iC: 3, iP: 4 }, max), A = q.iA.array, B = q.iB.array, Cc = q.iC.array, P = q.iP.array;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uFog: { value: o.fog || 0 }, uHot: { value: o.hot || 1.2 }, uStyle: { value: o.style || 0 }, uScan: { value: 0 }, uWipe: { value: 1e5 } },
      vertexShader: BEAM_VS, fragmentShader: BEAM_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    const mesh = new THREE.Mesh(q.g, mat); mesh.frustumCulled = false; mesh.renderOrder = o.order || 9;
    let n = 0;
    return {
      mesh, mat, get count() { return n; },
      begin() { n = 0; },
      add(ax, ay, az, bx, by, bz, r, g, b, w, alpha, seed) {
        if (n >= max) return;
        const i3 = n * 3, i4 = n * 4;
        A[i3] = ax; A[i3 + 1] = ay; A[i3 + 2] = az; B[i3] = bx; B[i3 + 1] = by; B[i3 + 2] = bz;
        Cc[i3] = r; Cc[i3 + 1] = g; Cc[i3 + 2] = b; P[i4] = w; P[i4 + 1] = alpha; P[i4 + 2] = seed || 0; n++;
      },
      end() { q.g.instanceCount = n; q.iA.needsUpdate = q.iB.needsUpdate = q.iC.needsUpdate = q.iP.needsUpdate = true; }
    };
  }

  /* ---- soft round points (sparks, embers, dust, distant lights), plus a tiny particle simulator ---- */
  const PTS_VS = [
    'attribute vec3 aCol; attribute vec2 aSA; uniform float uScale;',
    'varying vec3 vCol; varying float vA; varying float vDepth;',
    'void main(){',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  gl_Position = projectionMatrix * mv;',
    '  float px = aSA.x * uScale / max(0.01, -mv.z);',
    '  vA = aSA.y * clamp(px / 1.5, 0.0, 1.0); gl_PointSize = max(px, 1.5);',
    '  vCol = aCol; vDepth = -mv.z;',
    '}'].join('\n');
  const PTS_FS = [
    'uniform float uFog, uNormal, uHard;',
    'varying vec3 vCol; varying float vA; varying float vDepth;',
    'void main(){',
    '  float d = length(gl_PointCoord - 0.5) * 2.0;',
    '  float a = 1.0 - smoothstep(uHard, 1.0, d); a *= a;',
    '  float fog = exp(-uFog * uFog * vDepth * vDepth);',
    '  if (uNormal > 0.5) gl_FragColor = vec4(vCol, a * vA * fog);',
    '  else gl_FragColor = vec4(vCol * a * vA * fog, 1.0);',
    '}'].join('\n');
  function points(max, o) {
    const g = new THREE.BufferGeometry();
    const P = new Float32Array(max * 3), Cc = new Float32Array(max * 3), SA = new Float32Array(max * 2);
    const aP = new THREE.BufferAttribute(P, 3), aC = new THREE.BufferAttribute(Cc, 3), aS = new THREE.BufferAttribute(SA, 2);
    [aP, aC, aS].forEach((a) => a.setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('position', aP); g.setAttribute('aCol', aC); g.setAttribute('aSA', aS); g.setDrawRange(0, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 500 }, uFog: { value: o.fog || 0 }, uNormal: { value: o.normal ? 1 : 0 }, uHard: { value: o.hard || 0 } },
      vertexShader: PTS_VS, fragmentShader: PTS_FS, transparent: true, depthWrite: false,
      blending: o.normal ? THREE.NormalBlending : THREE.AdditiveBlending
    });
    const mesh = new THREE.Points(g, mat); mesh.frustumCulled = false; mesh.renderOrder = o.order || 11;
    let n = 0;
    return {
      mesh, mat, max,
      begin() { n = 0; },
      add(x, y, z, r, gg, b, size, alpha) {
        if (n >= max) return;
        P[n * 3] = x; P[n * 3 + 1] = y; P[n * 3 + 2] = z; Cc[n * 3] = r; Cc[n * 3 + 1] = gg; Cc[n * 3 + 2] = b; SA[n * 2] = size; SA[n * 2 + 1] = alpha; n++;
      },
      end(X) {
        g.setDrawRange(0, n); aP.needsUpdate = aC.needsUpdate = aS.needsUpdate = true;
        if (X) mat.uniforms.uScale.value = X.renderer.getDrawingBufferSize(_v2).y / (2 * Math.tan(X.camera.fov * Math.PI / 360));
      }
    };
  }
  const _v2 = THREE ? new THREE.Vector2() : null;
  // Particles with velocity, gravity, drag and an optional bouncing floor (units: metres and seconds).
  function sim(max) {
    const F = 16, d = new Float32Array(max * F); let n = 0;
    // layout: x y z vx vy vz age life size r g b drag grav floor bounce
    return {
      get count() { return n; },
      clear() { n = 0; },
      spawn(x, y, z, vx, vy, vz, life, size, c, o) {
        if (n >= max) return;
        const i = n++ * F; o = o || {};
        d[i] = x; d[i + 1] = y; d[i + 2] = z; d[i + 3] = vx; d[i + 4] = vy; d[i + 5] = vz; d[i + 6] = 0; d[i + 7] = life; d[i + 8] = size;
        d[i + 9] = c[0]; d[i + 10] = c[1]; d[i + 11] = c[2]; d[i + 12] = o.drag === undefined ? 0.6 : o.drag; d[i + 13] = o.g || 0;
        d[i + 14] = o.floor === undefined ? -1e9 : o.floor; d[i + 15] = o.bounce || 0;
      },
      step(dt, pts, fade, field) {
        const s = dt / 1000;
        for (let k = 0; k < n; k++) {
          const i = k * F;
          d[i + 6] += dt;
          if (d[i + 6] >= d[i + 7]) { const j = (n - 1) * F; for (let m = 0; m < F; m++) d[i + m] = d[j + m]; n--; k--; continue; }
          if (field) field(d, i, s);
          const dr = Math.exp(-d[i + 12] * s);
          d[i + 3] *= dr; d[i + 4] = d[i + 4] * dr - d[i + 13] * s; d[i + 5] *= dr;
          d[i] += d[i + 3] * s; d[i + 1] += d[i + 4] * s; d[i + 2] += d[i + 5] * s;
          if (d[i + 1] < d[i + 14]) { d[i + 1] = d[i + 14]; d[i + 4] = -d[i + 4] * d[i + 15]; d[i + 3] *= 0.7; d[i + 5] *= 0.7; }
          const t = d[i + 6] / d[i + 7], a = fade ? fade(t) : 1 - t;
          pts.add(d[i], d[i + 1], d[i + 2], d[i + 9], d[i + 10], d[i + 11], d[i + 8], a);
        }
      }
    };
  }

  /* ---- planar mirror (wet asphalt, polished floors): the scene seen from below, projected onto the plane ---- */
  function mirrorMesh(X, geometry, material, res) {
    const renderer = X.renderer;
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat });
    rt.texture.generateMipmaps = false;
    const vcam = new THREE.PerspectiveCamera(), tm = new THREE.Matrix4(), plane = new THREE.Plane(), clip = new THREE.Vector4(), q = new THREE.Vector4();
    const rp = new THREE.Vector3(), cp = new THREE.Vector3(), rot = new THREE.Matrix4(), N = new THREE.Vector3(), view = new THREE.Vector3(), look = new THREE.Vector3(), target = new THREE.Vector3(), sz = new THREE.Vector2();
    material.uniforms.tReflect.value = rt.texture; material.uniforms.textureMatrix.value = tm;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.onBeforeRender = (r, scene, camera) => {
      if (camera === vcam) return;
      r.getDrawingBufferSize(sz);
      const w = Math.max(4, Math.round(sz.x * res)), h = Math.max(4, Math.round(sz.y * res));
      if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
      rp.setFromMatrixPosition(mesh.matrixWorld); cp.setFromMatrixPosition(camera.matrixWorld);
      rot.extractRotation(mesh.matrixWorld); N.set(0, 0, 1).applyMatrix4(rot);
      view.subVectors(rp, cp); if (view.dot(N) > 0) return;
      view.reflect(N).negate().add(rp);
      rot.extractRotation(camera.matrixWorld); look.set(0, 0, -1).applyMatrix4(rot).add(cp);
      target.subVectors(rp, look).reflect(N).negate().add(rp);
      vcam.position.copy(view); vcam.up.set(0, 1, 0).applyMatrix4(rot).reflect(N); vcam.lookAt(target);
      vcam.far = camera.far; vcam.updateMatrixWorld(); vcam.projectionMatrix.copy(camera.projectionMatrix);
      tm.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(vcam.projectionMatrix).multiply(vcam.matrixWorldInverse).multiply(mesh.matrixWorld);
      plane.setFromNormalAndCoplanarPoint(N, rp).applyMatrix4(vcam.matrixWorldInverse);
      clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
      const pm = vcam.projectionMatrix.elements;
      q.x = (Math.sign(clip.x) + pm[8]) / pm[0]; q.y = (Math.sign(clip.y) + pm[9]) / pm[5]; q.z = -1; q.w = (1 + pm[10]) / pm[14];
      clip.multiplyScalar(2 / clip.dot(q));
      pm[2] = clip.x; pm[6] = clip.y; pm[10] = clip.z + 1 - 0.003; pm[14] = clip.w;
      const prevRT = r.getRenderTarget(), prevAuto = r.shadowMap.autoUpdate;
      mesh.visible = false; r.shadowMap.autoUpdate = false;
      r.setRenderTarget(rt); r.state.buffers.depth.setMask(true); if (r.autoClear === false) r.clear();
      r.render(scene, vcam);
      r.shadowMap.autoUpdate = prevAuto; r.setRenderTarget(prevRT); mesh.visible = true;
    };
    mesh.userData.free = { dispose: () => rt.dispose() };
    return mesh;
  }
  const MIRROR_VS = [
    'uniform mat4 textureMatrix; varying vec4 vR; varying vec3 vW; varying float vDepth;',
    'void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vR = textureMatrix * vec4(position, 1.0);',
    '  vec4 mv = viewMatrix * w; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }'].join('\n');

  /* ---- post: vignette, film grain, chromatic aberration and (cyber) slice glitch, before the output pass ---- */
  function gradePass(X, C, o) {
    if (!X.composer || !X.outputPass) return null;
    const pass = new THREE.ShaderPass({
      uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: o.vig || 0.35 }, uGrain: { value: o.grain || 0.03 }, uCA: { value: 0 }, uGlitch: { value: 0 }, uLift: { value: new THREE.Vector3(0, 0, 0) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: [
        'uniform sampler2D tDiffuse; uniform float uTime, uVig, uGrain, uCA, uGlitch; uniform vec3 uLift; varying vec2 vUv;',
        'float h(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }',
        'void main(){',
        '  vec2 uv = vUv;',
        '  if (uGlitch > 0.0) { float band = floor(uv.y * 36.0); float r = h(vec2(band, floor(uTime * 18.0))); if (r < uGlitch * 0.3) uv.x += (h(vec2(band, floor(uTime * 18.0) + 3.1)) - 0.5) * 0.06 * uGlitch; }',
        '  vec2 d = uv - 0.5; vec3 c;',
        '  if (uCA > 0.0) { c.r = texture2D(tDiffuse, uv - d * uCA).r; c.g = texture2D(tDiffuse, uv).g; c.b = texture2D(tDiffuse, uv + d * uCA).b; }',
        '  else c = texture2D(tDiffuse, uv).rgb;',
        '  c *= 1.0 - uVig * dot(d, d) * 2.0;',
        '  c += uLift;',
        '  c *= 1.0 + (h(uv * 1371.0 + fract(uTime * 7.31) * 91.0) - 0.5) * uGrain * 2.0;',
        '  gl_FragColor = vec4(max(c, 0.0), 1.0);',
        '}'].join('\n')
    });
    X.composer.insertPass(pass, X.composer.passes.indexOf(X.outputPass));
    C.bin.push(pass.material);
    return pass;
  }

  // Keep the frame rate on slow GPUs: render fewer pixels when frames run long (bloom and FXAA hide the upscale), more when there is headroom.
  function autoRes(S, X, C, dt) {
    const a = C.ar || (C.ar = { avg: 16, t: 0, pr: X.maxPixelRatio, top: X.maxPixelRatio });
    a.avg += (dt - a.avg) * 0.05; a.t += dt;
    if (a.t < 1500 || !SP.layer3d) return;
    let pr = a.pr;
    if (a.avg > 21 && pr > 0.6) pr = Math.max(0.6, pr - 0.15);
    else if (a.avg < 14.5 && pr < a.top) pr = Math.min(a.top, pr + 0.1);
    if (pr !== a.pr) { a.pr = pr; X.maxPixelRatio = pr; SP.layer3d.resize(S); }
    a.t = 0;
  }

  /* ---- letters: world positions from the engine's rotated unit coordinates, and true screen positions ---- */
  const _w = THREE ? new THREE.Vector3() : null;
  function placeLetter(S, n, rig, cam) {
    _w.set(n.rx, -n.ry, n.rz).applyMatrix4(rig.matrixWorld);
    const w = n.data.w || (n.data.w = [0, 0, 0]);
    w[0] = _w.x; w[1] = _w.y; w[2] = _w.z;
    _w.project(cam);
    if (_w.z < 1) { n.sx = (_w.x + 1) / 2 * S.W; n.sy = (1 - _w.y) / 2 * S.H; } // the engine picks the seed letter by screen position
  }
  function fillLetters(S, cloud, now, o) {
    const list = S.mode.glyphList, ix = cloud.atlas.index;
    cloud.begin();
    for (const n of S.nodes) {
      const w = n.data.w;
      if (!w || n.alpha <= 0.01) continue;
      const g = now < n.scr ? list[(Math.random() * list.length) | 0] : n.g;
      const c = n.inf ? o.pal[n.gen % o.pal.length] : o.base, k = n.inf ? o.hot : 1;
      cloud.add(w[0], w[1], w[2], c[0] * k, c[1] * k, c[2] * k, ix[g] || 0, o.size * (n.inf ? o.infScale || 1.1 : 1), clamp(n.alpha, 0, 1), n.inf ? 1 : 0);
    }
    cloud.end();
  }
  // Each infection link as a growing glowing ribbon (draw(beams, a, b, colour, alpha, link) may replace the straight one).
  function fillLinks(S, bm, now, o) {
    bm.begin();
    for (const l of S.links) {
      const a = l.A.data.w, b = l.B.data.w;
      if (!a || !b) continue;
      const grow = clamp((now - l.born) / 220, 0, 1), al = (l.dying ? 1 - (now - l.dying) / 700 : 1) * Math.min(l.A.alpha, l.B.alpha);
      if (al <= 0.01) continue;
      const e = [a[0] + (b[0] - a[0]) * grow, a[1] + (b[1] - a[1]) * grow, a[2] + (b[2] - a[2]) * grow], c = o.pal[l.gen % o.pal.length];
      if (o.draw) o.draw(bm, a, e, c, al, l);
      else bm.add(a[0], a[1], a[2], e[0], e[1], e[2], c[0], c[1], c[2], o.width, al, l.seed);
    }
    if (o.extra) o.extra(bm);
    bm.end();
  }
  // Hide the engine's 2D wireframe and webs while the 3D layer draws them (an empty clip from ambient to under).
  const hide2D = (S, ctx) => { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 0, 0); ctx.clip(); };
  const show2D = (S, ctx) => { ctx.restore(); };
  // A web style that draws nothing in 3D and falls back to a classic 2D style without WebGL.
  const ghostLink = (fallback) => (ctx, L, S) => { if (!S.three) (SP.links[fallback] || SP.links.line)(ctx, L, S); };
  SP.addLink('b3_circuit', ghostLink('circuit'));
  SP.addLink('b3_curve', ghostLink('curve'));
  SP.addLink('b3_sigil', ghostLink('sigil'));
  SP.addLink('b3_pulse', ghostLink('pulse'));
  // A camera-facing frame for the letter cluster: centre c, radius r, turned to face the camera's yaw.
  function aimRig(rig, cam, c, r) {
    rig.position.set(c[0], c[1], c[2]);
    rig.rotation.set(0, Math.atan2(cam.position.x - c[0], cam.position.z - c[2]), 0);
    rig.scale.setScalar(r); rig.updateMatrixWorld(true);
  }

  /* ---------------- CYBERPUNK: a rain-soaked neon avenue at night, the letters a public hologram ---------------- */
  let CY = null;
  const CY_SIGNS = [['ラーメン', '#ff3b5c'], ['ホテル', '#2ef2ff'], ['カラオケ', '#ff2bd6'], ['バー', '#ffb020'], ['ネオン', '#9a5bff'], ['クスリ', '#3dff8a'], ['データ', '#2ef2ff'], ['ヨル', '#ff2bd6']];
  const CY_WIDE = [['ホテル', 'HOTEL · 24H', '#2ef2ff'], ['ラーメン', 'NOODLES', '#ffb020'], ['カプセル', 'CAPSULES', '#ff2bd6'], ['メモリ', 'MEMORY · REPAIR', '#3dff8a']];
  function cyberSignAtlas() {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 1024);
    const neon = (col, draw) => { // glow, tube and white-hot core, like a real gas tube
      g.save(); g.strokeStyle = col; g.fillStyle = col; g.lineJoin = 'round'; g.lineCap = 'round';
      g.filter = 'blur(9px)'; g.globalAlpha = 0.9; g.lineWidth = 12; draw(); g.filter = 'none';
      g.globalAlpha = 1; g.lineWidth = 5; draw();
      g.strokeStyle = '#fff'; g.globalAlpha = 0.75; g.lineWidth = 1.6; draw(); g.restore();
    };
    g.textAlign = 'center'; g.textBaseline = 'middle';
    CY_SIGNS.forEach(([txt, col], i) => {
      const x0 = i * 128, chars = Array.from(txt);
      g.fillStyle = '#0b0910'; g.fillRect(x0 + 6, 6, 116, 500);
      g.fillStyle = '#141018'; for (let y = 10; y < 500; y += 9) g.fillRect(x0 + 8, y, 112, 1);
      if (i % 3 === 1) { // a lightbox: lit panel with dark letters
        g.fillStyle = col; g.globalAlpha = 0.85; g.fillRect(x0 + 14, 14, 100, 484); g.globalAlpha = 1;
        g.fillStyle = '#100810'; g.font = 'bold 78px sans-serif';
        chars.forEach((ch, k) => g.fillText(ch, x0 + 64, 70 + k * (440 / Math.max(3, chars.length))));
      } else {
        neon(col, () => { g.strokeRect(x0 + 16, 16, 96, 480); });
        g.font = 'bold 80px sans-serif';
        neon(col, () => chars.forEach((ch, k) => g.strokeText(ch, x0 + 64, 80 + k * (420 / Math.max(3, chars.length)))));
      }
    });
    CY_WIDE.forEach(([jp, en, col], i) => {
      const x0 = (i % 2) * 512, y0 = 512 + Math.floor(i / 2) * 256;
      g.fillStyle = '#0b0910'; g.fillRect(x0 + 6, y0 + 6, 500, 244);
      g.font = 'bold 104px sans-serif'; neon(col, () => g.strokeText(jp, x0 + 256, y0 + 100));
      g.font = 'bold 44px sans-serif'; neon(i % 2 ? '#ffffff' : col, () => g.strokeText(en, x0 + 256, y0 + 196));
    });
    const tex = new THREE.CanvasTexture(c); tex.anisotropy = 8;
    return tex;
  }
  const CY_BLD_GLSL = [
    'vec3 wn = normalize(vWN);',
    'float wall = 1.0 - step(0.5, abs(wn.y));',
    'vec2 fuv = abs(wn.x) > 0.5 ? vec2(vWP.z, vWP.y) : vec2(vWP.x, vWP.y);',
    'vec2 cs = vec2(1.5 + vB.z * 1.6, 3.2);',
    'vec2 gq = fuv / cs; vec2 wid = floor(gq); vec2 wf = fract(gq);',
    'float upper = step(4.2, vWP.y);',
    'float winM = wall * upper * step(0.1, wf.x) * step(wf.x, 0.9) * step(0.2, wf.y) * step(wf.y, 0.86);',
    'float rid = hash12(wid + vB.x * 91.7 + floor(wn.x * 2.0 + wn.z * 3.0) * 13.1);',
    'float lit = step(1.0 - clamp(vB.y + uInf * 0.35, 0.0, 0.97), rid);',
    'vec3 wcol = mix(vec3(1.0, 0.66, 0.4), vec3(0.62, 0.82, 1.0), step(0.6, hash12(wid * 1.31 + vB.x)));',
    'wcol = mix(wcol, vec3(1.0, 0.3, 0.8), step(0.95, hash12(wid * 2.7 + vB.x)));',
    'wcol *= 0.55 + 0.6 * hash12(wid * 3.9 + vB.x * 5.0);',
    'float blindH = hash12(wid * 5.3 + vB.x) * 0.75;',
    'float blind = step(1.0 - blindH, (wf.y - 0.2) / 0.66) * (0.35 + 0.25 * step(0.5, fract(wf.y * 26.0)));',
    'float mull = step(abs(wf.x - 0.5), 0.018) * step(0.5, vB.z);',
    'float lamp = exp(-pow((wf.x - 0.5) * 3.0, 2.0)) * smoothstep(0.55, 0.86, wf.y);',
    'float fig = step(0.9, hash12(wid * 7.1 + vB.x)) * step(abs(wf.x - 0.3 - 0.4 * hash12(wid)), 0.06) * step(wf.y, 0.62);',
    'float inner = (0.18 + 0.5 * smoothstep(0.2, 0.86, wf.y) + 0.7 * lamp) * (1.0 - blind) * (1.0 - mull) * (1.0 - fig * 0.85);',
    'float sx = fract(fuv.x / 6.0), sid = hash12(vec2(floor(fuv.x / 6.0), vB.x * 31.0));',
    'float shop = wall * (1.0 - upper) * step(0.5, vWP.y) * step(vWP.y, 3.4) * step(0.1, sx) * step(sx, 0.94) * step(0.3, sid);',
    'float shelves = 0.55 + 0.45 * step(0.12, fract(vWP.y * 1.6)) * (0.6 + 0.4 * vnoise(fuv * vec2(6.0, 2.0)));',
    'float shutter = step(0.82, sid);',
    'shop *= mix(shelves * (0.35 + 0.65 * smoothstep(0.5, 3.2, vWP.y)) * (1.0 - step(abs(sx - 0.52), 0.012)), 0.0, shutter);',
    'diffuseColor.rgb += wall * (1.0 - upper) * shutter * step(vWP.y, 3.4) * 0.06 * step(0.5, fract(vWP.y * 9.0));',
    'float slab = wall * upper * smoothstep(0.93, 0.97, fract(vWP.y / 3.2));',
    'diffuseColor.rgb *= (0.7 + 0.5 * hash12(vec2(floor(fuv.x / 9.0), vB.x * 17.0))) * (0.75 + 0.5 * vnoise(fuv * vec2(0.8, 0.25))) * (0.9 + 0.1 * step(0.03, fract(fuv.x / 1.5)));',
    'diffuseColor.rgb += slab * 0.03;',
    'diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.015, 0.018, 0.026), winM);',
    'float dOut = length(vWP.xz - uOut.xy), tReach = dOut / 70.0, tBack = tReach + 0.8 + hash12(vec2(vB.x * 13.0, 7.0)) * 3.2;',
    'float power = (uOut.z < 0.0 || uOut.z < tReach || uOut.z > tBack) ? 1.0 : 0.0;',
    'float surge = uOut.z >= 0.0 ? smoothstep(tReach - 0.3, tReach, uOut.z) * (1.0 - step(tReach, uOut.z)) : 0.0;',
    'float flick = uFlick > 0.0 ? step(uFlick * 0.25, hash12(wid + floor(uT * 9.0) + vB.x)) : 1.0;',
    'vec3 winLight = (winM * lit * inner * flick * wcol + shop * mix(vec3(1.0, 0.8, 0.6), vec3(0.7, 0.95, 1.0), step(0.6, sid)) * 0.3) * power * (1.0 + surge * 5.0 + uSurge * 2.0);'
  ].join('\n');

  SP.addMode(guarded({
    id: 'cyber', name: 'CYBERPUNK', glyphs: 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホ0123456789ABCDEF#$%&@',
    base: [300, 100, 78], palette: [[300, 100, 60], [180, 100, 55], [56, 100, 55]], links: ['b3_circuit', 'b3_circuit', 'b3_circuit', 'b3_circuit'], fade: 0.55, glitchy: true,
    pageBg: ['#16081f', '#030207'],
    shapes: ['sphere', 'tesseract', 'torus', 'lissajous', 'snub_cube', 'truncated_octahedron', 'cuboctahedron', 'rhombic_dodecahedron', 'hilbert', 'menger'],
    init(S) { S.data.rain = Array.from({ length: 34 }, () => ({ x: Math.round(rand(0, S.W) / 18) * 18, y: rand(-S.H, S.H), v: rand(1.5, 4.5) })); },
    ambient(S, ctx, now, dt) {
      if (S.three && CY) { hide2D(S, ctx); S.data.hid = 1; return; }
      ctx.globalCompositeOperation = 'lighter';
      ctx.font = '14px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      S.data.rain.forEach((r) => {
        ctx.fillStyle = S.hsl(S.mode.palette[(r.x / 18) % 2 ? 0 : 1], S.hueShift, 0.35);
        ctx.fillText(S.glyph(), r.x, r.y);
        r.y += r.v * dt / 16;
        if (r.y > S.H + 20) { r.y = rand(-200, 0); r.x = Math.round(rand(0, S.W) / 18) * 18; }
      });
    },
    under(S, ctx) { if (S.data.hid) { S.data.hid = 0; show2D(S, ctx); } },
    warp(S, n) { if (CY && S.three) placeLetter(S, n, CY.rig, S.three.camera); },
    drawNode(S, ctx, n, g, size, a) { // chromatic split on infected letters (2D fallback)
      if (CY && S.three) return true;
      if (!(n.inf || S.now < n.scr)) return false;
      ctx.font = `${size.toFixed(1)}px monospace`; ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,0,255,${0.7 * a})`; ctx.fillText(g, n.sx - 2, n.sy);
      ctx.fillStyle = `rgba(0,255,255,${0.7 * a})`; ctx.fillText(g, n.sx + 2, n.sy);
      return false;
    },
    onClimax(S) {
      if (!(CY && S.three)) { S.glitch(300); return; }
      CY.surge = 1; if (!S.reduceMotion) CY.glitch = 0.8;
      return false;
    },
    onRelease(S, held, power) {
      const C = CY;
      if (!(C && S.three)) { S.glitch(200 + 250 * power); return; }
      // the hologram shorts out: sparks fall and bounce on the wet street, and the grid trips block by block
      const hot = [[3.2, 1.7, 0.6], [2.4, 2.2, 1.6], [3.5, 1.0, 0.3]];
      S.active.forEach((n) => {
        const w = n.data.w; if (!w || !n.inf) return;
        for (let k = 0; k < 2 + 5 * power; k++) {
          const a = rand(0, TAU), v = rand(1, 5);
          C.sparks.spawn(w[0], w[1], w[2], Math.cos(a) * v, rand(0, 5), Math.sin(a) * v, rand(1400, 2800), rand(0.05, 0.11), pick(hot), { drag: 0.25, g: 9.81, floor: 0.03, bounce: 0.38 });
        }
      });
      if (held > S.STAGES[1]) C.out = 0;
      if (!S.reduceMotion) C.glitch = Math.max(C.glitch, 0.5 * power);
      return false;
    },
    hud(S) {
      const C = CY;
      if (!(C && S.three)) return 'rain falls at about 9 m/s: the terminal velocity of a 2 mm drop';
      const v = (9 * C.rainK).toFixed(1), hz = (50 - 0.2 * C.pow - (C.out >= 0 && C.out < 3 ? 0.6 : 0)).toFixed(2);
      if (C.out >= 0) return `N−1 contingency breached · cascading blackout · substations restoring block by block · grid ${hz} Hz`;
      if (!S.holding) return `rain ${v} m/s, terminal velocity of a 2 mm drop · grid ${hz} Hz · ${Math.round(100 * (0.42 + 0.3 * C.pow))}% of windows lit`;
      let g = 0; S.active.forEach((n) => { if (n.inf && n.gen > g) g = n.gen; });
      if (S.stage >= 2) return `local clock ×${Math.max(1, Math.round(1 / C.rainK))} slow · rain ${v} m/s · packets ${S.infected}/${S.active.length} · TTL ${Math.max(0, 64 - g)}`;
      return `routing ${S.infected}/${S.active.length} packets · TTL ${Math.max(0, 64 - g)} hops left · load sags the grid to ${hz} Hz`;
    },
    three: {
      init(S, X) {
        const C = CY = { X, bin: [], restore: [], t: 0, rainY: 0, rainK: 1, pow: 0, sync: 0, push: 0, out: -1, surge: 0, glitch: 0, px: 0, py: 0 };
        linearPipeline(X, C);
        X.maxPixelRatio = 1;
        const { scene, camera } = X, R = mulberry(20491);
        camera.fov = 50; camera.near = 0.3; camera.far = 1400; camera.updateProjectionMatrix();
        const fogC = new THREE.Color(0x0b0611);
        scene.background = fogC.clone();
        scene.fog = new THREE.FogExp2(fogC, 0.007);
        X.setBloom(0.8, 0.5, 0.75); X.setExposure(0.85);
        C.grade = gradePass(X, C, { vig: 0.55, grain: 0.04 });
        C.u = { uT: { value: 0 }, uOut: { value: new THREE.Vector3(0, -14, -1) }, uInf: { value: 0 }, uFlick: { value: 0 }, uSurge: { value: 0 } };

        // sky: city glow under low cloud
        const sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 32, 16), new THREE.ShaderMaterial({
          side: THREE.BackSide, depthWrite: false, fog: false,
          uniforms: { uT: C.u.uT, uHor: { value: new THREE.Vector3(fogC.r, fogC.g, fogC.b) } },
          vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
          fragmentShader: 'uniform float uT; uniform vec3 uHor; varying vec3 vD;\n' + GL_NOISE + [
            'void main(){ float h = vD.y; vec3 top = vec3(0.004, 0.003, 0.009);',
            '  vec3 c = mix(uHor * 1.15, top, smoothstep(0.0, 0.5, h));',
            '  vec2 p = vD.xz / max(h, 0.06) * 0.9 + vec2(uT * 0.004, uT * 0.002);',
            '  float cl = 0.55 * vnoise(p) + 0.3 * vnoise(p * 2.1 + 7.0) + 0.15 * vnoise(p * 4.3 + 3.0);',
            '  c += uHor * 1.3 * smoothstep(0.42, 0.85, cl) * smoothstep(0.02, 0.12, h) * (1.0 - smoothstep(0.25, 0.7, h));',
            '  gl_FragColor = vec4(c, 1.0); }'].join('\n')
        }));
        sky.renderOrder = -10; sky.layers.set(1); scene.add(sky); C.sky = sky;
        camera.layers.enable(1); // layer 1: seen by the camera, skipped by the street's reflection

        // buildings: two rows down each side of the avenue and a skyline at its end
        const B = [];
        const add = (x, z, sx, h, sz, y0, lit) => B.push({ x, z, sx, h, sz, y0: y0 || 0, seed: R(), lit, cell: R() });
        for (const side of [-1, 1]) {
          let z = 45;
          while (z > -300) {
            const fz = 7 + R() * 13, fx = 10 + R() * 12, h = 10 + Math.pow(R(), 1.5) * 70 + (z < -40 ? R() * 35 : 0);
            const cx = side * (9 + fx / 2), cz = z - fz / 2;
            add(cx, cz, fx, h, fz, 0, 0.12 + R() * 0.3);
            if (R() < 0.5 && h > 22) { const f = 0.55 + R() * 0.3; add(cx + side * fx * (1 - f) / 2, cz, fx * f, 8 + R() * 45, fz * f, h, 0.25 + R() * 0.4); }
            z -= fz + (R() < 0.22 ? 3 + R() * 5 : 0.3);
          }
          let z2 = 30;
          while (z2 > -330) { const fz = 14 + R() * 18, fx = 14 + R() * 16, h = 45 + Math.pow(R(), 1.3) * 160; add(side * (36 + fx / 2 + R() * 10), z2 - fz / 2, fx, h, fz, 0, 0.18 + R() * 0.35); z2 -= fz + 4 + R() * 10; }
        }
        for (let i = 0; i < 46; i++) add(-260 + R() * 520, -340 - R() * 220, 15 + R() * 25, 60 + Math.pow(R(), 1.2) * 230, 15 + R() * 25, 0, 0.15 + R() * 0.35);
        const bGeo = new THREE.BoxGeometry(1, 1, 1), aB = new Float32Array(B.length * 4);
        B.forEach((b, i) => { aB[i * 4] = b.seed; aB[i * 4 + 1] = b.lit; aB[i * 4 + 2] = b.cell; });
        bGeo.setAttribute('aB', new THREE.InstancedBufferAttribute(aB, 4));
        const bMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1f, roughness: 0.78, metalness: 0.15 });
        bMat.onBeforeCompile = (sh) => {
          Object.assign(sh.uniforms, C.u);
          const vs = sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vec4 wq = modelMatrix * instanceMatrix * vec4(transformed, 1.0); vWP = wq.xyz; vWN = normalize(mat3(modelMatrix * instanceMatrix) * objectNormal); vB = aB;');
          const fs = sh.fragmentShader
            .replace('#include <map_fragment>', '#include <map_fragment>\n' + CY_BLD_GLSL)
            .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 0.1, winM);')
            .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += winLight * 0.75;');
          if (vs === sh.vertexShader || fs.indexOf('winLight * 0.75') < 0 || fs.indexOf('roughnessFactor = mix') < 0) console.warn('[sphere cyber] shader hook did not apply');
          sh.vertexShader = 'attribute vec4 aB;\nvarying vec3 vWP; varying vec3 vWN; varying vec4 vB;\n' + vs;
          sh.fragmentShader = 'uniform float uT, uInf, uFlick, uSurge; uniform vec3 uOut;\nvarying vec3 vWP; varying vec3 vWN; varying vec4 vB;\n' + GL_NOISE + fs;
        };
        const bld = new THREE.InstancedMesh(bGeo, bMat, B.length), m4 = new THREE.Matrix4(), qI = new THREE.Quaternion();
        B.forEach((b, i) => bld.setMatrixAt(i, m4.compose(new THREE.Vector3(b.x, b.y0 + b.h / 2, b.z), qI, new THREE.Vector3(b.sx, b.h, b.sz))));
        scene.add(bld);

        // neon: blade signs sticking out over the street, facade banners and rooftop billboards (one draw call)
        const sTex = cyberSignAtlas(); C.bin.push(sTex);
        const sp = [], su = [], ss = [], si = [], signs = [];
        const quad = (c, rx, ry, w, h, uv, seed, flick, col) => {
          const b = sp.length / 3;
          [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, e], k) => {
            sp.push(c[0] + rx[0] * a * w / 2 + ry[0] * e * h / 2, c[1] + rx[1] * a * w / 2 + ry[1] * e * h / 2, c[2] + rx[2] * a * w / 2 + ry[2] * e * h / 2);
            su.push(k === 0 || k === 3 ? uv[0] : uv[2], k < 2 ? uv[1] : uv[3]); ss.push(seed, flick);
          });
          si.push(b, b + 1, b + 2, b, b + 2, b + 3);
          signs.push({ c, w, h, col, nrm: [rx[1] * ry[2] - rx[2] * ry[1], rx[2] * ry[0] - rx[0] * ry[2], rx[0] * ry[1] - rx[1] * ry[0]] });
        };
        const vCell = (i) => [i * 0.125 + 0.006, 0.5 + 0.006, (i + 1) * 0.125 - 0.006, 1 - 0.006];
        const hCell = (i) => [(i % 2) * 0.5 + 0.006, 0.5 - (Math.floor(i / 2) + 1) * 0.25 + 0.006, (i % 2 + 1) * 0.5 - 0.006, 0.5 - Math.floor(i / 2) * 0.25 - 0.006];
        let si0 = 0;
        B.forEach((b) => {
          if (b.y0 > 0 || Math.abs(b.x) > 30 || b.z < -230) return;
          const side = Math.sign(b.x), face = side * 9;
          if (R() < 0.8) { // blade sign
            const k = si0++ % 8, w = 1.3 + R() * 1.1, h = w * 4 * (0.9 + R() * 0.25), y = 4.5 + R() * Math.max(1, Math.min(b.h - h - 2, 20));
            quad([face - side * (w / 2 + 0.35), y + h / 2, b.z + (R() - 0.5) * b.sz * 0.5], [-side, 0, 0], [0, 1, 0], w, h, vCell(k), R(), R() < 0.18 ? 1 : 0, CY_SIGNS[k][1]);
          }
          if (R() < 0.45) { // banner flat on the facade
            const k = Math.floor(R() * 4), w = 5 + R() * 5, y = 5 + R() * Math.max(1, Math.min(b.h - 6, 16));
            quad([face - side * 0.06, y, b.z], [0, 0, side], [0, 1, 0], w, w / 2, hCell(k), R(), R() < 0.12 ? 1 : 0, CY_WIDE[k][2]);
          }
          if (b.z < -30 && b.h > 25 && R() < 0.35) { // rooftop billboard facing up the avenue
            const k = Math.floor(R() * 4), w = 12 + R() * 8;
            quad([b.x, b.h + w / 4 + 1.5, b.z], [1, 0, 0], [0, 1, 0], w, w / 2, hCell(k), R(), 0, CY_WIDE[k][2]);
          }
        });
        const sGeo = new THREE.BufferGeometry();
        sGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sGeo.setAttribute('uv', new THREE.Float32BufferAttribute(su, 2));
        sGeo.setAttribute('aS', new THREE.Float32BufferAttribute(ss, 2)); sGeo.setIndex(si);
        C.signU = { uTex: { value: sTex }, uT: C.u.uT, uOut: C.u.uOut, uRM: { value: S.reduceMotion ? 1 : 0 }, uSync: { value: new THREE.Vector3(1, 0, 1) }, uSyncK: { value: 0 }, uI: { value: 5.5 },
          uFogC: { value: new THREE.Vector3(fogC.r, fogC.g, fogC.b) }, uFogD: { value: scene.fog.density } };
        scene.add(new THREE.Mesh(sGeo, new THREE.ShaderMaterial({
          side: THREE.DoubleSide, uniforms: C.signU,
          vertexShader: 'attribute vec2 aS; varying vec2 vUv; varying vec2 vS; varying vec3 vW; varying float vDepth;\nvoid main(){ vUv = uv; vS = aS; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }',
          fragmentShader: 'uniform sampler2D uTex; uniform float uT, uRM, uSyncK, uI, uFogD; uniform vec3 uOut, uSync, uFogC; varying vec2 vUv; varying vec2 vS; varying vec3 vW; varying float vDepth;\n' + GL_NOISE + [
            'void main(){',
            '  vec3 c = pow(texture2D(uTex, vUv).rgb, vec3(2.2));',
            '  float lum = max(c.r, max(c.g, c.b));',
            '  float fl = 1.0;',
            '  if (uRM < 0.5) { if (vS.y > 0.5) fl = hash12(vec2(floor(uT * 11.0), vS.x * 10.0)) > 0.22 ? 1.0 : 0.12; else fl = 0.96 + 0.04 * sin(uT * 31.0 + vS.x * 50.0); }',
            '  c = mix(c, uSync * lum, uSyncK);',
            '  float d = length(vW.xz - uOut.xy), tr = d / 70.0, tb = tr + 0.8 + hash12(vec2(vS.x * 31.0, 3.0)) * 3.2;',
            '  float power = (uOut.z < 0.0 || uOut.z < tr || uOut.z > tb) ? 1.0 : 0.04;',
            '  c *= uI * fl * power;',
            '  float f = exp(-uFogD * uFogD * vDepth * vDepth);',
            '  gl_FragColor = vec4(c * f + uFogC * (1.0 - f), 1.0);',
            '}'].join('\n')
        })));

        // lights: the brightest nearby signs light the street, plus the hologram emitter
        C.lights = [];
        signs.filter((s) => s.c[2] < 12 && s.c[2] > -90 && s.h >= 4).sort((a, b) => b.w * b.h - a.w * a.h).slice(0, 4).forEach((s) => {
          const col = new THREE.Color(s.col).convertSRGBToLinear(), l = new THREE.PointLight(col, 0, 45, 2);
          l.position.set(s.c[0] * 0.8, s.c[1] - s.h * 0.2, s.c[2] + 1.2); scene.add(l);
          C.lights.push({ l, base: 160 + s.w * s.h * 9, col, seed: R() });
        });
        const emit = new THREE.PointLight(0xff40e0, 0, 40, 2); emit.position.set(0, 2.2, -14); scene.add(emit);
        C.emit = emit;
        scene.add(new THREE.HemisphereLight(0x303a66, 0x120610, 0.18));

        // street lamps (modern LED heads)
        const lamps = [];
        for (let z = 30; z > -220; z -= 26) for (const side of [-1, 1]) lamps.push([side * 7.2, z + (side > 0 ? 13 : 0)]);
        const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.12, 7.5, 8), new THREE.MeshStandardMaterial({ color: 0x1a1b20, roughness: 0.5, metalness: 0.8 }), lamps.length);
        const arm = new THREE.InstancedMesh(new THREE.BoxGeometry(1.8, 0.1, 0.3), new THREE.MeshStandardMaterial({ color: 0x1a1b20, roughness: 0.5, metalness: 0.8, emissive: 0xffe6c8, emissiveIntensity: 0 }), lamps.length);
        const head = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.05, 0.25), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 4.6, 4) }), lamps.length);
        lamps.forEach(([x, z], i) => {
          pole.setMatrixAt(i, m4.makeTranslation(x, 3.75, z));
          arm.setMatrixAt(i, m4.makeTranslation(x - Math.sign(x) * 0.8, 7.45, z));
          head.setMatrixAt(i, m4.makeTranslation(x - Math.sign(x) * 1.2, 7.38, z));
        });
        scene.add(pole, arm, head);
        const curb = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.16, 340), new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.4 }), 2);
        curb.setMatrixAt(0, m4.makeTranslation(-6, 0.08, -130)); curb.setMatrixAt(1, m4.makeTranslation(6, 0.08, -130)); scene.add(curb);

        // wet street: mirror reflection, puddles, rain ripples, lane paint and light pools
        const NL = 6 + Math.min(lamps.length, 8);
        C.floorU = { tReflect: { value: null }, textureMatrix: { value: null }, uRain: { value: 0 }, uLP: { value: [] }, uLC: { value: [] }, uFogC: { value: new THREE.Vector3(fogC.r, fogC.g, fogC.b) }, uFogD: { value: scene.fog.density }, uOut: C.u.uOut };
        for (let i = 0; i < NL; i++) { C.floorU.uLP.value.push(new THREE.Vector3(0, -100, 0)); C.floorU.uLC.value.push(new THREE.Vector3()); }
        C.lampPos = lamps.slice(0, NL - 6);
        const floorMat = new THREE.ShaderMaterial({
          uniforms: C.floorU, vertexShader: MIRROR_VS,
          fragmentShader: 'uniform sampler2D tReflect; uniform float uRain, uFogD; uniform vec3 uFogC, uOut; uniform vec3 uLP[' + NL + ']; uniform vec3 uLC[' + NL + '];\nvarying vec4 vR; varying vec3 vW; varying float vDepth;\n' + GL_NOISE + [
            'vec2 ripples(vec2 p, float t){',
            '  vec2 acc = vec2(0.0);',
            '  for (int k = 0; k < 2; k++) {',
            '    vec2 q = p * (2.0 + float(k) * 1.4) + float(k) * 3.7; vec2 id = floor(q), f = fract(q) - 0.5;',
            '    float h = hash12(id + float(k) * 7.0), ph = fract(t * (0.9 + h * 0.5) + h * 9.0);',
            '    vec2 d = f - (vec2(hash12(id + 1.3), hash12(id + 2.9)) - 0.5) * 0.5; float r = length(d), ring = ph * 0.42;',
            '    acc += d / max(r, 1e-3) * sin((r - ring) * 70.0) * smoothstep(0.07, 0.0, abs(r - ring)) * (1.0 - ph);',
            '  }',
            '  return acc;',
            '}',
            'void main(){',
            '  vec2 p = vW.xz; float ax = abs(p.x);',
            '  float n1 = fbm(p * 0.22), n2 = vnoise(p * 5.0), n3 = vnoise(p * 0.9);',
            '  float walk = step(6.15, ax);',
            '  vec3 base = mix(vec3(0.03, 0.03, 0.034), vec3(0.06, 0.06, 0.065), n2 * 0.7 + n3 * 0.3);',
            '  vec2 tile = fract(p / vec2(1.2, 1.2)); float joint = 1.0 - step(0.04, tile.x) * step(0.04, tile.y);',
            '  base = mix(base, vec3(0.08, 0.08, 0.085) * (0.85 + 0.3 * hash12(floor(p / 1.2))) * (1.0 - joint * 0.6), walk);',
            '  float paint = (1.0 - walk) * (step(ax, 0.1) * step(0.45, fract(p.y / 9.0)) + step(abs(ax - 5.6), 0.08)) * (0.6 + 0.4 * n2);',
            '  float zebra = (1.0 - walk) * step(abs(p.y + 40.0), 2.2) * step(0.5, fract(p.x / 1.1));',
            '  base = mix(base, vec3(0.42, 0.42, 0.4), clamp(paint + zebra * 0.85, 0.0, 1.0));',
            '  float wet = clamp(smoothstep(0.46, 0.6, n1 + 0.08 * n2) + 0.32, 0.0, 1.0) * (1.0 - paint * 0.6);',
            '  vec2 nrm = ripples(p, uRain) * 0.05 * wet + (vec2(vnoise(p * 3.1), vnoise(p * 3.1 + 5.0)) - 0.5) * 0.07 * (1.0 - wet);',
            '  vec4 uvr = vR; uvr.xy += nrm * uvr.w;',
            '  float blur = mix(0.03, 0.0035, wet);',
            '  vec3 refl = vec3(0.0);',
            '  for (int i = -3; i <= 3; i++) { vec4 q = uvr; q.y += float(i) * blur * q.w; refl += texture2DProj(tReflect, q).rgb; }',
            '  refl /= 7.0;',
            '  vec3 V = normalize(cameraPosition - vW); float fres = 0.02 + 0.98 * pow(1.0 - clamp(V.y, 0.0, 1.0), 5.0);',
            '  vec3 diff = vec3(0.004, 0.005, 0.009);',
            '  for (int i = 0; i < ' + NL + '; i++) { vec3 L = uLP[i] - vW; float d2 = dot(L, L) + 1.0; diff += uLC[i] * max(L.y, 0.0) * inversesqrt(d2) / d2; }',
            '  vec3 col = base * diff * (1.0 - 0.45 * wet) + refl * mix(0.25, 1.0, wet) * mix(fres, 1.0, 0.18);',
            '  float f = exp(-uFogD * uFogD * vDepth * vDepth);',
            '  gl_FragColor = vec4(col * f + uFogC * (1.0 - f), 1.0);',
            '}'].join('\n')
        });
        const floor = mirrorMesh(X, new THREE.PlaneGeometry(160, 520), floorMat, 0.42);
        floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -200); scene.add(floor); C.bin.push(floor.userData.free);

        // the hologram projector in the middle of the avenue
        const lathe = [[0, 0], [1.7, 0], [1.75, 0.12], [1.55, 0.3], [1.35, 0.34], [1.15, 0.8], [0.95, 0.92], [0.8, 0.95], [0.6, 0.9], [0, 0.9]].map((p) => new THREE.Vector2(p[0], p[1]));
        const base = new THREE.Mesh(new THREE.LatheGeometry(lathe, 48), new THREE.MeshStandardMaterial({ color: 0x23252c, roughness: 0.28, metalness: 0.9 }));
        base.position.set(0, 0, -14); scene.add(base);
        C.ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.6, 3.6) });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.035, 8, 64), C.ringMat); ring.rotation.x = Math.PI / 2; ring.position.set(0, 0.93, -14); scene.add(ring);
        C.coneU = { uT: C.u.uT, uCol: { value: new THREE.Vector3(1, 0.2, 0.9) }, uK: { value: 1 } };
        const cone = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 0.75, 7.4, 48, 1, true), new THREE.ShaderMaterial({
          uniforms: C.coneU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
          vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vH; void main(){ vH = uv.y; vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
          fragmentShader: 'uniform float uT, uK; uniform vec3 uCol; varying vec3 vN; varying vec3 vV; varying float vH;\n' + [
            'void main(){ float f = 1.0 - abs(dot(normalize(vN), vV)); float edge = pow(f, 2.5);',
            '  float scan = 0.75 + 0.25 * sin(vH * 120.0 - uT * 8.0);',
            '  float a = (0.05 + edge * 0.5) * scan * smoothstep(1.0, 0.25, vH) * smoothstep(0.0, 0.05, vH) * uK;',
            '  gl_FragColor = vec4(uCol * a, 1.0); }'].join('\n')
        }));
        cone.position.set(0, 0.95 + 3.7, -14); scene.add(cone);

        // rain: GPU-animated streaks around the camera
        const NR = 2600, rp = new Float32Array(NR * 6), re = new Float32Array(NR * 2);
        for (let i = 0; i < NR; i++) {
          const x = rand(-28, 28), y = rand(0, 40), z = rand(-75, 8);
          rp.set([x, y, z, x, y, z], i * 6); re[i * 2] = 0; re[i * 2 + 1] = 1;
        }
        const rGeo = new THREE.BufferGeometry(); rGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3)); rGeo.setAttribute('aEnd', new THREE.BufferAttribute(re, 1));
        C.rainU = { uY: { value: 0 }, uLen: { value: 0.5 }, uCam: { value: new THREE.Vector3() }, uFogD: { value: 0.03 } };
        const rain = new THREE.LineSegments(rGeo, new THREE.ShaderMaterial({
          uniforms: C.rainU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
          vertexShader: 'attribute float aEnd; uniform float uY, uLen; uniform vec3 uCam; varying float vA; varying float vDepth;\nvoid main(){ vec3 p = position; p.y = mod(p.y - uY, 40.0); vec3 w = vec3(uCam.x + p.x - aEnd * uLen * 0.08, p.y + aEnd * uLen, uCam.z + p.z); vec4 mv = viewMatrix * vec4(w, 1.0); vA = 1.0 - aEnd * 0.85; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }',
          fragmentShader: 'uniform float uFogD; varying float vA; varying float vDepth; void main(){ float f = exp(-uFogD * uFogD * vDepth * vDepth); gl_FragColor = vec4(vec3(0.16, 0.17, 0.22) * vA * f, 1.0); }'
        }));
        rain.frustumCulled = false; rain.layers.set(1); scene.add(rain);

        // traffic above the street, obstruction lights on the tallest towers, sparks
        C.cars = Array.from({ length: 9 }, (_, i) => ({ x: (i % 3 - 1) * 4 + rand(-1, 1), y: 24 + (i % 4) * 6 + rand(0, 3), z: rand(-300, 40), v: (i % 2 ? -1 : 1) * rand(14, 26) }));
        C.carMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.9, 0.75, 4.4), new THREE.MeshStandardMaterial({ color: 0x0b0c10, roughness: 0.3, metalness: 0.9 }), C.cars.length);
        C.carMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(C.carMesh);
        C.beacons = B.filter((b) => b.y0 + b.h > 80).slice(0, 40).map((b) => [b.x, b.y0 + b.h + 0.5, b.z, R()]);
        C.glow = points(200, { fog: 0.006 }); scene.add(C.glow.mesh);
        C.sparkPts = points(1200, { hard: 0.35 }); scene.add(C.sparkPts.mesh);
        C.sparks = sim(1200);

        // the letters: a public hologram over the projector
        C.atlas = glyphAtlas(S.mode.glyphList.join(''), `bold 36px monospace`); C.bin.push(C.atlas.tex);
        C.cloud = glyphCloud(C.atlas, 260, { core: 2.4, glow: 1.6, white: 0.35 });
        C.links = beams(700, { hot: 1.4 });
        C.rig = new THREE.Object3D(); scene.add(C.rig);
        scene.add(C.cloud.mesh, C.links.mesh);
        C.cloud.mat.uniforms.uScan.value = 0.28;
        C.links.mat.uniforms.uScan.value = 0.2;
      },
      update(S, X, now, dt) {
        const C = CY; if (!C) return;
        autoRes(S, X, C, dt);
        const s = dt / 1000, cam = X.camera, st = S.holding ? S.stage : 0, rm = S.reduceMotion;
        const inf = S.active.length ? S.infected / S.active.length : 0;
        C.t += s; C.u.uT.value = C.t;
        C.rainK = ease(C.rainK, st >= 2 ? 0.04 : 1, dt, 2.2);
        C.rainY += 9 * C.rainK * s;
        C.pow = ease(C.pow, S.holding ? 0.25 + 0.75 * inf : 0, dt, 3);
        C.sync = ease(C.sync, st >= 3 ? 1 : 0, dt, 1.6);
        C.push = ease(C.push, st / 3, dt, 0.9);
        C.surge = Math.max(0, C.surge - s * 1.5);
        C.glitch = Math.max(0, C.glitch - s * 1.2);
        if (C.out >= 0) { C.out += s; if (C.out > 7) C.out = -1; }
        // camera: a slow handheld-free dolly up the avenue, parallax from the pointer, pushing in while held
        C.px = ease(C.px, S.W ? S.ptr.x / S.W - 0.5 : 0, dt, 2); C.py = ease(C.py, S.H ? S.ptr.y / S.H - 0.5 : 0, dt, 2);
        const t = C.t;
        cam.position.set(1.6 * Math.sin(t * 0.05) + C.px * 3.5, 2.4 + 0.35 * Math.sin(t * 0.07) - C.py * 1.3, 18 - 2.5 * Math.sin(t * 0.031) - C.push * 6.5);
        cam.lookAt(C.px * 1.5, 8.4 - C.py * 1.2, -14);
        cam.updateMatrixWorld();
        C.sky.position.copy(cam.position);
        aimRig(C.rig, cam, [0, 8.6, -14], 5.3);

        const P = palettes(S, 2.6), sync = linRGB(S.mode.palette[0], 0, 1), env = S.mode.palette.map((c) => linRGB(c, 0, 2.6)); // the city keeps its own neon
        C.u.uInf.value = C.pow; C.u.uFlick.value = rm ? 0 : st * 0.35; C.u.uSurge.value = C.surge;
        C.u.uOut.value.z = C.out;
        C.signU.uSyncK.value = C.sync * 0.85; C.signU.uSync.value.set(sync[0], sync[1], sync[2]); C.signU.uI.value = 5.5 * (1 + 0.6 * C.pow + C.surge);
        // the blackout wave in the CPU too, for the real lights
        const powerAt = (x, z, seed) => { if (C.out < 0) return 1; const tr = Math.hypot(x, z + 14) / 70, tb = tr + 0.8 + seed * 3.2; return C.out < tr || C.out > tb ? 1 : 0.04; };
        const fu = C.floorU;
        C.lights.forEach((L, i) => {
          const fl = rm ? 1 : 0.92 + 0.08 * Math.sin(t * 31 + L.seed * 50);
          const col = L.col.clone().lerp(new THREE.Color(sync[0], sync[1], sync[2]), C.sync * 0.85);
          L.l.color.copy(col); L.l.intensity = L.base * fl * (1 + 0.5 * C.pow + C.surge) * powerAt(L.l.position.x, L.l.position.z, L.seed);
          fu.uLP.value[i].copy(L.l.position); fu.uLC.value[i].set(col.r, col.g, col.b).multiplyScalar(L.l.intensity * 0.9);
        });
        const ec = env[S.holding ? Math.min(1, st) : 0];
        C.emit.color.setRGB(ec[0], ec[1], ec[2]); C.emit.intensity = (60 + 140 * C.pow) * powerAt(0, -14, 0.1);
        fu.uLP.value[5].copy(C.emit.position); fu.uLC.value[5].set(ec[0], ec[1], ec[2]).multiplyScalar(C.emit.intensity * 0.4);
        C.lampPos.forEach(([x, z], i) => { fu.uLP.value[6 + i].set(x - Math.sign(x) * 1.2, 7.3, z); const k = 260 * powerAt(x, z, 0.5); fu.uLC.value[6 + i].set(k, k * 0.92, k * 0.8); });
        fu.uRain.value = C.rainY / 9;
        C.ringMat.color.setRGB(ec[0] * 1.6, ec[1] * 1.6, ec[2] * 1.6);
        C.coneU.uCol.value.set(ec[0], ec[1], ec[2]).multiplyScalar(0.5); C.coneU.uK.value = 0.6 + 1.2 * C.pow;
        C.rainU.uY.value = C.rainY; C.rainU.uLen.value = 0.08 + 0.55 * C.rainK; C.rainU.uCam.value.copy(cam.position);

        // letters and webs (circuit traces: along, then up, like a PCB route)
        const lp = C.out >= 0 ? 0.12 + 0.88 * smooth(1.2, 3.6, C.out) * (rm || C.out > 3.6 || Math.random() > 0.3 ? 1 : 0.3) : 1; // the projector browns out with the grid
        C.cloud.mat.uniforms.uCore.value = 2.4 * lp; C.cloud.mat.uniforms.uGlow.value = 1.6 * lp;
        fillLetters(S, C.cloud, now, { base: P.base, pal: P.pal, hot: 1.5, size: 0.95 });
        C.cloud.mat.uniforms.uTime.value = t; C.cloud.mat.uniforms.uSplit.value = rm ? 0 : 0.03 + 0.05 * st;
        C.links.mat.uniforms.uTime.value = t; C.links.mat.uniforms.uStyle.value = st >= 1 ? 1 : 0;
        fillLinks(S, C.links, now, {
          pal: P.pal, width: 0.12, draw(bm, a, e, c, al, l) {
            const w = 0.08 + 0.05 * st;
            if (st === 0) { bm.add(a[0], a[1], a[2], e[0], e[1], e[2], c[0], c[1], c[2], w, al, l.seed); return; }
            bm.add(a[0], a[1], a[2], e[0], a[1], e[2], c[0], c[1], c[2], w, al, l.seed);
            bm.add(e[0], a[1], e[2], e[0], e[1], e[2], c[0], c[1], c[2], w, al, l.seed + 0.5);
          }
        });

        // traffic and beacons
        const m4 = C.m4 || (C.m4 = new THREE.Matrix4()), g = C.glow;
        g.begin();
        C.cars.forEach((c, i) => {
          c.z += c.v * s; if (c.z < -320) c.z = 50; if (c.z > 50) c.z = -320;
          m4.makeTranslation(c.x, c.y, c.z); C.carMesh.setMatrixAt(i, m4);
          const f = -Math.sign(c.v), front = c.z + 2.2 * f, back = c.z - 2.2 * f;
          g.add(c.x - 0.6, c.y, front, 6, 5.6, 5, 0.6, 1); g.add(c.x + 0.6, c.y, front, 6, 5.6, 5, 0.6, 1);
          g.add(c.x - 0.7, c.y, back, 4, 0.2, 0.15, 0.45, 1); g.add(c.x + 0.7, c.y, back, 4, 0.2, 0.15, 0.45, 1);
        });
        C.carMesh.instanceMatrix.needsUpdate = true;
        const blink = rm ? 0.8 : (Math.sin(t * TAU * 0.5) > 0.3 ? 1 : 0.05); // obstruction lights, synchronised (~30 flashes a minute)
        C.beacons.forEach((b) => g.add(b[0], b[1], b[2], 6, 0.25, 0.15, 1.6, blink * powerAt(b[0], b[2], b[3])));
        g.end(X);
        C.sparkPts.begin(); C.sparks.step(dt, C.sparkPts, (k) => (1 - k) * (1 - k)); C.sparkPts.end(X);

        if (C.grade) {
          const gu = C.grade.uniforms;
          gu.uTime.value = t; gu.uGlitch.value = rm ? 0 : Math.max(C.glitch, st >= 3 ? 0.12 : 0);
          gu.uCA.value = rm ? 0 : 0.0015 + 0.0012 * st + 0.006 * C.glitch;
        }
      },
      exit() { if (CY) freeAll(CY); CY = null; }
    }
  }));


  /* ---------------- MATHEMATICS: the current surface as a museum piece, curvature and geodesics on hold ---------------- */
  let MA = null;
  // Parametrisations (a, b in [0, 1], endpoints included) matching the shapes pack point for point.
  const MA_SURF = {
    harmonic: [128, 64, (a, b) => { const th = Math.PI * b, ph = TAU * a, x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph), r = 0.35 + Math.abs(Math.sin(th) * Math.sin(th) * Math.cos(th) * Math.cos(2 * ph)) * 2.6; return [x * r, y * r, z * r]; }],
    mobius: [160, 16, (a, b) => { const u = TAU * a, v = -0.5 + b, r = 1 + v / 2 * Math.cos(u / 2); return [r * Math.cos(u), v / 2 * Math.sin(u / 2), r * Math.sin(u)]; }],
    klein: [160, 64, (a, b) => { const u = TAU * a, v = TAU * b, A = 2 + Math.cos(u / 2) * Math.sin(v) - Math.sin(u / 2) * Math.sin(2 * v); return [A * Math.cos(u), Math.sin(u / 2) * Math.sin(v) + Math.cos(u / 2) * Math.sin(2 * v), A * Math.sin(u)]; }],
    enneper: [128, 48, (a, b) => { const r = 0.15 + 1.05 * b, th = TAU * a, u = r * Math.cos(th), v = r * Math.sin(th); return [u - u * u * u / 3 + u * v * v, u * u - v * v, v - v * v * v / 3 + v * u * u]; }],
    boy: [128, 96, (a, b) => { const u = Math.PI * a, v = Math.PI * (b + 0.031), s2 = Math.SQRT2, cv = Math.cos(v), d = 2 - s2 * Math.sin(3 * u) * Math.sin(2 * v); return [(s2 * cv * cv * Math.cos(2 * u) + Math.cos(u) * Math.sin(2 * v)) / d, -(3 * cv * cv) / d, (s2 * cv * cv * Math.sin(2 * u) - Math.sin(u) * Math.sin(2 * v)) / d]; }],
    dini: [192, 40, (a, b) => { const u = 4 * Math.PI * a, v = 0.3 + 1.6 * b; return [Math.cos(u) * Math.sin(v), -(Math.cos(v) + Math.log(Math.tan(v / 2)) + 0.14 * u), Math.sin(u) * Math.sin(v)]; }],
    kuen: [128, 128, (a, b) => { const s = -4.4 + 8.8 * a, v = -3 + 6 * b, ch = Math.cosh(v), D = ch * ch + s * s; return [2 * ch * (Math.cos(s) + s * Math.sin(s)) / D, -(v - 2 * Math.sinh(v) * ch / D), 2 * ch * (-s * Math.cos(s) + Math.sin(s)) / D]; }],
    breather: [256, 96, (a, b) => { const A = 0.4, w = Math.sqrt(1 - A * A), u = -7.5 + 15 * b, v = -37.4 * (1 - 2 * a), ca = Math.cosh(A * u), D = A * ((w * ca) ** 2 + (A * Math.sin(w * v)) ** 2); return [-u + 2 * w * w * ca * Math.sinh(A * u) / D, 2 * w * ca * (-(w * Math.cos(v) * Math.cos(w * v)) - Math.sin(v) * Math.sin(w * v)) / D, 2 * w * ca * (-(w * Math.sin(v) * Math.cos(w * v)) + Math.cos(v) * Math.sin(w * v)) / D]; }],
    bour: [192, 48, (a, b) => { const t = 4 * Math.PI * (a + 0.013), r = 0.15 + 0.85 * b; return [r * Math.cos(t) - r * r * Math.cos(2 * t) / 2, (4 / 3) * Math.pow(r, 1.5) * Math.cos(1.5 * t), -r * Math.sin(t) - r * r * Math.sin(2 * t) / 2]; }],
    roman_surface: [128, 48, (a, b) => { const th = Math.PI / 2 * b, ph = TAU * a, x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph); return [y * z, x * z, x * y]; }],
    cross_cap: [128, 48, (a, b) => { const th = Math.PI / 2 * b, ph = TAU * a, x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph); return [z * y, x * x - z * z, 2 * x * z]; }]
  };
  const MA_CURVE = { trefoil: 1, lissajous: 1, torus_knot: 1, cinquefoil: 1, lorenz: 0, spherical_spiral: 0 };
  const MA_TOPO = { // one-sided closed surfaces: their meshes need cuts, so state the topology itself
    klein: 'Klein bottle: one-sided, χ = 0; in three dimensions it has to pass through itself',
    boy: "Boy's surface: the projective plane immersed in ℝ³ without pinch points, χ = 1",
    roman_surface: "Steiner's Roman surface: the projective plane mapped into ℝ³ with six pinch points, χ = 1",
    cross_cap: 'cross-cap: a Möbius band sewn to a disc, the projective plane again, χ = 1'
  };
  const MA_FACES = { icosidodecahedron: 32, rhombicosidodecahedron: 62, truncated_icosidodecahedron: 62, truncated_dodecahedron: 32, pentakis_dodecahedron: 60, triakis_icosahedron: 60 };
  // buildShape's normalisation for the live letter count: centre on the centroid, divide by the largest 4D norm
  function maNorm(key, n) {
    let pts = SP.shapes[key].make(n);
    const base = pts.length; pts = pts.slice(0, n);
    const c = [0, 0, 0, 0]; pts.forEach((p) => { for (let j = 0; j < 4; j++) c[j] += (p[j] || 0) / pts.length; });
    let m = 0; pts.forEach((p) => { m = Math.max(m, Math.hypot((p[0] || 0) - c[0], (p[1] || 0) - c[1], (p[2] || 0) - c[2], (p[3] || 0) - c[3])); });
    return { c, m: m || 1, base };
  }
  // Weld the mesh, then the discrete Gauss–Bonnet bookkeeping: angle defects, curvature, Euler characteristic, and a graph for geodesics.
  function maAnalyse(pos, nrm, idx) {
    const nv = pos.length / 3, map = new Int32Array(nv), keys = {}, wp = [], wn = [];
    for (let i = 0; i < nv; i++) {
      const k = Math.round(pos[i * 3] * 2e4) + ',' + Math.round(pos[i * 3 + 1] * 2e4) + ',' + Math.round(pos[i * 3 + 2] * 2e4);
      if (keys[k] === undefined) { keys[k] = wp.length / 3; wp.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); wn.push(0, 0, 0); }
      map[i] = keys[k]; const w = map[i]; wn[w * 3] += nrm[i * 3]; wn[w * 3 + 1] += nrm[i * 3 + 1]; wn[w * 3 + 2] += nrm[i * 3 + 2];
    }
    const W = wp.length / 3, ang = new Float64Array(W), area = new Float64Array(W), used = new Uint8Array(W), edges = new Map(), adj = Array.from({ length: W }, () => []);
    let F = 0;
    const P = (i) => [wp[i * 3], wp[i * 3 + 1], wp[i * 3 + 2]];
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const angle = (a, b) => Math.acos(clamp(dot(a, b) / Math.sqrt(dot(a, a) * dot(b, b)), -1, 1));
    for (let t = 0; t < idx.length; t += 3) {
      const i = map[idx[t]], j = map[idx[t + 1]], k = map[idx[t + 2]];
      if (i === j || j === k || i === k) continue;
      const a = P(i), b = P(j), c = P(k), ab = sub(b, a), ac = sub(c, a), bc = sub(c, b);
      const cr = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]], A = Math.sqrt(dot(cr, cr)) / 2;
      if (A < 1e-12) continue;
      F++;
      ang[i] += angle(ab, ac); ang[j] += angle(sub(a, b), bc); ang[k] += angle(sub(a, c), sub(b, c));
      area[i] += A / 3; area[j] += A / 3; area[k] += A / 3; used[i] = used[j] = used[k] = 1;
      [[i, j], [j, k], [k, i]].forEach(([p, q]) => {
        const e = p < q ? p * W + q : q * W + p, n = edges.get(e);
        if (n === undefined) { edges.set(e, 1); const d = Math.sqrt(dot(sub(P(p), P(q)), sub(P(p), P(q)))); adj[p].push(q, d); adj[q].push(p, d); } else edges.set(e, n + 1);
      });
    }
    const bnd = new Uint8Array(W);
    edges.forEach((n, e) => { if (n === 1) { bnd[Math.floor(e / W)] = 1; bnd[e % W] = 1; } });
    let V = 0, total = 0; const K = new Float32Array(W), absK = [];
    for (let i = 0; i < W; i++) {
      if (!used[i]) continue;
      V++;
      if (bnd[i]) { total += Math.PI - ang[i]; continue; }
      total += TAU - ang[i]; K[i] = (TAU - ang[i]) / Math.max(area[i], 1e-9); absK.push(Math.abs(K[i]));
    }
    absK.sort((a, b) => a - b);
    const s = absK.length ? absK[Math.floor(absK.length * 0.85)] || 1 : 1, aK = new Float32Array(nv);
    let kmin = Infinity, kmax = -Infinity;
    const ks = []; for (let i = 0; i < W; i++) if (used[i] && !bnd[i]) ks.push(K[i]);
    ks.sort((a, b) => a - b); if (ks.length) { kmin = ks[Math.floor(ks.length * 0.05)]; kmax = ks[Math.floor(ks.length * 0.95)]; } // robust range: creases and poles are singular
    for (let i = 0; i < nv; i++) aK[i] = Math.tanh(K[map[i]] / s * 1.2);
    for (let i = 0; i < W; i++) { const l = Math.hypot(wn[i * 3], wn[i * 3 + 1], wn[i * 3 + 2]) || 1; wn[i * 3] /= l; wn[i * 3 + 1] /= l; wn[i * 3 + 2] /= l; }
    return { aK, wp, wn, adj, W, V, E: edges.size, F, chi: V - edges.size + F, total, kmin, kmax };
  }
  // A* over the mesh's edge graph: the shortest edge path, a good stand-in for the geodesic between two letters.
  function maPath(G, s, t, maxExp) {
    if (s === t) return [s];
    const wp = G.wp, h = (i) => Math.hypot(wp[i * 3] - wp[t * 3], wp[i * 3 + 1] - wp[t * 3 + 1], wp[i * 3 + 2] - wp[t * 3 + 2]);
    const g = new Map([[s, 0]]), from = new Map(), heap = [[h(s), s]];
    const push = (x) => { heap.push(x); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    let exp = 0;
    while (heap.length && exp++ < maxExp) {
      const [, u] = pop();
      if (u === t) { const out = [t]; let c = t; while (from.has(c)) { c = from.get(c); out.push(c); } return out.reverse(); }
      const gu = g.get(u), a = G.adj[u];
      for (let k = 0; k < a.length; k += 2) { const v = a[k], ng = gu + a[k + 1]; if (ng < (g.has(v) ? g.get(v) : Infinity)) { g.set(v, ng); from.set(v, u); push([ng + h(v), v]); } }
    }
    return null;
  }
  // Nearest welded vertex to a point (a uniform grid hash)
  function maGrid(G) {
    const cell = 0.08, grid = new Map(), key = (x, y, z) => x * 73856093 ^ y * 19349663 ^ z * 83492791;
    for (let i = 0; i < G.W; i++) { const k = key(Math.floor(G.wp[i * 3] / cell), Math.floor(G.wp[i * 3 + 1] / cell), Math.floor(G.wp[i * 3 + 2] / cell)); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); }
    return (x, y, z) => {
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
      let best = -1, bd = Infinity;
      for (let r = 1; r <= 4 && best < 0; r++) for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) {
        const l = grid.get(key(cx + i, cy + j, cz + k)); if (!l) continue;
        for (const v of l) { const d = (G.wp[v * 3] - x) ** 2 + (G.wp[v * 3 + 1] - y) ** 2 + (G.wp[v * 3 + 2] - z) ** 2; if (d < bd) { bd = d; best = v; } }
      }
      return best;
    };
  }
  const MA_VS_HEAD = 'attribute float aK; varying float vK; varying vec3 vLP; varying float vRip; uniform vec4 uRip; uniform float uRipA;\n';
  const MA_VS_BODY = '#include <begin_vertex>\n  vLP = position; vK = aK; vRip = 0.0;\n' +
    '  if (uRipA > 0.0) { float d = distance(position, uRip.xyz), t = uRip.w; float env = exp(-t * 1.1) * smoothstep(-0.15, 0.05, t * 0.62 - d) * exp(-d * 0.7); vRip = sin(d * 15.0 - t * 9.3) * env; transformed += objectNormal * uRipA * vRip; }';
  const MA_FS_HEAD = 'uniform float uDis, uRevK, uRing, uT, uGlow; uniform vec4 uRev; varying float vK; varying vec3 vLP; varying float vRip;\n';
  const MA_FS_COLOR = [
    '#include <color_fragment>',
    '  float nz = vnoise3(vLP * 6.0 + 3.0);',
    '  if (nz > uDis * 1.1) discard;',
    '  float burn = uDis < 0.999 ? smoothstep(0.07, 0.0, uDis * 1.1 - nz) : 0.0;',
    '  float dS = distance(vLP, uRev.xyz);',
    '  float rev = uRevK * smoothstep(uRev.w, uRev.w - 0.3, dS);',
    '  vec3 ivory = diffuseColor.rgb;',
    '  vec3 kc = vK > 0.0 ? mix(ivory, vec3(0.9, 0.25, 0.04), sqrt(vK)) : mix(ivory, vec3(0.03, 0.2, 0.8), sqrt(-vK));',
    '  diffuseColor.rgb = mix(ivory, kc, rev);',
    '  float fr = fract(dS * 9.0 - uT * 0.25); float ring = uRing * rev * smoothstep(0.07, 0.0, min(fr, 1.0 - fr));',
    '  float front = uRevK * smoothstep(0.05, 0.0, abs(dS - uRev.w + 0.05));'
  ].join('\n');
  const MA_FS_EMIT = '#include <emissivemap_fragment>\n  totalEmissiveRadiance += vec3(1.0, 0.55, 0.2) * (burn * 4.0 + ring * 1.6 + front * 0.8 + max(vRip, 0.0) * 2.0) + kc * uGlow * rev * 0.25;';
  function maMaterial(C, opts) {
    const u = { uDis: { value: 0 }, uRevK: { value: 0 }, uRing: { value: 0 }, uGlow: { value: 0 }, uT: C.uT, uRev: { value: new THREE.Vector4(0, 0, 0, 0) }, uRip: { value: new THREE.Vector4(0, 0, 0, 0) }, uRipA: { value: 0 } };
    const m = new THREE.MeshPhysicalMaterial(Object.assign({ color: 0xe9e2d4, roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, side: THREE.DoubleSide, envMapIntensity: 0.45 }, opts || {}));
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      const vs = sh.vertexShader.replace('#include <begin_vertex>', MA_VS_BODY);
      const fs = sh.fragmentShader.replace('#include <color_fragment>', MA_FS_COLOR).replace('#include <emissivemap_fragment>', MA_FS_EMIT);
      if (vs === sh.vertexShader || fs.indexOf('uGlow * rev') < 0 || fs.indexOf('discard') < 0) console.warn('[sphere math] shader hook did not apply');
      sh.vertexShader = MA_VS_HEAD + vs;
      sh.fragmentShader = MA_FS_HEAD + GL_NOISE + fs;
    };
    m.userData.u = u;
    return m;
  }
  function maBuild(S, C) {
    const key = S.shape.key, n = S.active.length, out = { key, meshes: [], graph: null, nodeV: null, info: {} };
    const toLocal = (p) => [p[0], -p[1], p[2]];
    let geo = null;
    if (MA_SURF[key] || key === 'costa') {
      const nm = maNorm(key, n);
      const pos = [], idx = [];
      if (key === 'costa') { // the shapes pack evaluates Weierstrass functions on a lattice grid; reuse it at mesh resolution
        const k = 44, raw = SP.shapes.costa.make(k * k);
        raw.forEach((p) => { const q = toLocal([(p[0] - nm.c[0]) / nm.m, (p[1] - nm.c[1]) / nm.m, (p[2] - nm.c[2]) / nm.m]); pos.push(q[0], q[1], q[2]); });
        const lim = 0.12;
        for (let r = 0; r < k; r++) for (let c = 0; c < k; c++) {
          const a = r * k + c, b = r * k + (c + 1) % k, d = ((r + 1) % k) * k + c, e = ((r + 1) % k) * k + (c + 1) % k;
          const far = (i, j) => Math.hypot(pos[i * 3] - pos[j * 3], pos[i * 3 + 1] - pos[j * 3 + 1], pos[i * 3 + 2] - pos[j * 3 + 2]) > lim;
          if (!far(a, b) && !far(a, d) && !far(b, d)) idx.push(a, d, b);
          if (!far(b, d) && !far(d, e) && !far(b, e)) idx.push(b, d, e);
        }
      } else {
        const [cu, cv, f] = MA_SURF[key];
        for (let j = 0; j <= cv; j++) for (let i = 0; i <= cu; i++) {
          const p = f(i / cu, j / cv), q = toLocal([(p[0] - nm.c[0]) / nm.m, (p[1] - nm.c[1]) / nm.m, (p[2] - nm.c[2]) / nm.m]);
          pos.push(q[0], q[1], q[2]);
        }
        for (let j = 0; j < cv; j++) for (let i = 0; i < cu; i++) { const a = j * (cu + 1) + i, b = a + 1, c = a + cu + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
      }
      geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
      out.kind = 'surface';
    } else if (MA_CURVE[key] !== undefined) {
      const nm = maNorm(key, n), raw = SP.shapes[key].make(Math.max(n, 600)).map((p) => new THREE.Vector3(...toLocal([(p[0] - nm.c[0]) / nm.m, (p[1] - nm.c[1]) / nm.m, (p[2] - nm.c[2]) / nm.m])));
      const closed = !!MA_CURVE[key], curve = new THREE.CatmullRomCurve3(raw, closed, 'centripetal');
      geo = new THREE.TubeGeometry(curve, Math.min(640, raw.length * 2), 0.035, 12, closed);
      let tot = 0; // total curvature of the polygon: the sum of its turning angles
      for (let i = 1; i < raw.length - (closed ? 0 : 1); i++) { const a = raw[i - 1], b = raw[i], c = raw[(i + 1) % raw.length]; tot += b.clone().sub(a).angleTo(c.clone().sub(b)); }
      if (closed) tot += raw[0].clone().sub(raw[raw.length - 1]).angleTo(raw[1].clone().sub(raw[0]));
      out.info.turn = tot; out.kind = 'curve';
    }
    if (geo) {
      const pa = geo.getAttribute('position').array, na = geo.getAttribute('normal').array, ia = geo.getIndex().array;
      const G = maAnalyse(pa, na, ia);
      geo.setAttribute('aK', new THREE.BufferAttribute(G.aK, 1));
      const mesh = new THREE.Mesh(geo, maMaterial(C, out.kind === 'curve' ? { color: 0xd8b06a, metalness: 1, roughness: 0.22, clearcoat: 0.4 } : null));
      mesh.castShadow = true; mesh.receiveShadow = true;
      out.meshes.push(mesh); out.graph = G; out.info.G = G;
      const near = maGrid(G);
      out.nodeV = S.shape.pts.map((p) => near(p[0], -p[1], p[2]));
    } else if (S.shape.wire || S.shape.mesh.length && SP.shapes[key] && SP.shapes[key].fixed) { // polyhedra: brass struts and joints
      const pts = S.shape.pts.map(toLocal), E = S.shape.mesh, brass = new THREE.MeshPhysicalMaterial({ color: 0xc9a25a, metalness: 1, roughness: 0.24, clearcoat: 0.5, clearcoatRoughness: 0.15 });
      const rods = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 14), brass, E.length), joints = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 20, 14), brass, pts.length);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), d = new THREE.Vector3(), s = new THREE.Vector3();
      E.forEach(([i, j], k) => { const a = new THREE.Vector3(...pts[i]), b = new THREE.Vector3(...pts[j]); d.subVectors(b, a); const L = d.length(); q.setFromUnitVectors(up, d.normalize()); m4.compose(a.add(b).multiplyScalar(0.5), q, s.set(0.016, L, 0.016)); rods.setMatrixAt(k, m4); });
      pts.forEach((p, k) => joints.setMatrixAt(k, m4.compose(new THREE.Vector3(...p), q.identity(), s.setScalar(0.032))));
      [rods, joints].forEach((m) => { m.castShadow = true; m.receiveShadow = true; m.material.userData.u = { uDis: { value: 1 } }; out.meshes.push(m); });
      const adj = pts.map(() => []); E.forEach(([i, j]) => { const L = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1], pts[i][2] - pts[j][2]); adj[i].push(j, L); adj[j].push(i, L); });
      out.graph = { wp: pts.flat(), adj, W: pts.length, wn: pts.flat().map((v) => v * 0) };
      out.nodeV = pts.map((p, i) => i); out.kind = 'poly'; out.info.V = pts.length; out.info.E = E.length; out.info.F = MA_FACES[key];
    } else { // implicit or fractal point sets: polished beads
      const pts = S.shape.pts.map(toLocal), beads = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshPhysicalMaterial({ color: 0xe9e2d4, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 }), pts.length);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3().setScalar(0.03);
      pts.forEach((p, k) => beads.setMatrixAt(k, m4.compose(new THREE.Vector3(...p), q, s)));
      beads.castShadow = true; beads.material.userData.u = { uDis: { value: 1 } };
      out.meshes.push(beads); out.kind = 'beads';
    }
    out.paths = new Map();
    return out;
  }
  function maFree(M) { if (!M) return; M.meshes.forEach((m) => { m.parent && m.parent.remove(m); m.geometry.dispose(); m.material.dispose(); }); }

  SP.addMode(guarded({
    id: 'math', name: 'MATHEMATICS', glyphs: '∑∫∂∇∞√πφλΩ∮≈≡∀∃∈ℵℝℂℤℕ⊕⊗ΔΨ', noHueShift: true,
    base: [40, 90, 82], palette: [[40, 100, 65], [210, 100, 75], [0, 0, 100]], links: ['b3_curve', 'b3_curve', 'b3_curve', 'b3_curve'], mesh: true, fade: 0.55, count: 120,
    shapes: ['harmonic', 'trefoil', 'mobius', 'klein', 'lorenz', 'lissajous', 'costa', 'kuen', 'breather', 'dini', 'bour', 'roman_surface', 'cross_cap', 'boy', 'enneper', 'gyroid', 'mandelbulb', 'torus_knot', 'cinquefoil', 'spherical_spiral', 'icosidodecahedron', 'rhombicosidodecahedron', 'truncated_icosidodecahedron', 'truncated_dodecahedron', 'pentakis_dodecahedron', 'triakis_icosahedron'],
    pageBg: ['#14100a', '#05070d'],
    ambient(S, ctx) { if (S.three && MA) { hide2D(S, ctx); S.data.hid = 1; } },
    under(S, ctx) { if (S.data.hid) { S.data.hid = 0; show2D(S, ctx); } },
    warp(S, n) { if (MA && S.three) placeLetter(S, n, MA.rig, S.three.camera); },
    drawNode(S) { return !!(MA && S.three); },
    onPress(S) {
      const C = MA; if (!C || !C.cur || !S.seed) return;
      const i = S.active.indexOf(S.seed), p = S.shape.pts[i];
      if (p) C.seedP = [p[0], -p[1], p[2]];
    },
    onClimax(S) { if (MA && S.three) { MA.flare = 1; return false; } },
    onRelease(S, held, power) {
      const C = MA; if (!(C && S.three)) return;
      if (C.cur && C.seedP) { C.rip = { p: C.seedP.slice(), t: 0, a: 0.035 + 0.04 * Math.min(power, 1.2) }; }
      return false;
    },
    hud(S) {
      const C = MA, k = S.shape.key;
      if (!(C && S.three && C.cur && C.cur.key === k)) return 'a surface is known by its curvature: K = κ₁κ₂';
      const M = C.cur, G = M.graph;
      if (C.rip && C.rip.t < 4) return `struck at the seed: a damped wave runs over the surface, amplitude ∝ e^(−t/τ), τ ≈ 0.9 s`;
      if (S.holding && M.kind === 'surface') {
        const fr = `geodesic front r = ${C.rev.toFixed(2)}`;
        if (S.stage >= 2) return `Theorema Egregium: K is intrinsic, bend the sheet and it stays · K from ${G.kmin.toFixed(1)} to ${G.kmax.toFixed(1)} (5–95%) · ${S.infected}/${S.active.length} geodesics`;
        return `${fr} · orange K > 0 (domes), blue K < 0 (saddles) · ${S.infected}/${S.active.length} letters`;
      }
      if (S.holding) return `shortest paths along the ${M.kind === 'poly' ? 'edges' : 'tube'} · ${S.infected}/${S.active.length} letters reached`;
      if (MA_TOPO[k]) return MA_TOPO[k];
      if (M.kind === 'surface' && Math.abs(G.total / TAU - G.chi) > 0.01) return S.shape.name;
      if (M.kind === 'surface') return `Gauss–Bonnet over ${G.F} triangles: ∫K dA + ∮k_g ds = ${(G.total / TAU).toFixed(3)} × 2π  ⇒  χ = ${G.chi}`;
      if (M.kind === 'curve') return /knot|trefoil|cinquefoil/.test(k) ? `Fáry–Milnor: ∮κ ds = ${(M.info.turn / Math.PI).toFixed(2)}π > 4π, so this curve has to be knotted` : `total curvature ∮κ ds = ${(M.info.turn / Math.PI).toFixed(2)}π along the tube`;
      if (M.kind === 'poly' && M.info.F) return `Euler (1758): V − E + F = ${M.info.V} − ${M.info.E} + ${M.info.F} = ${M.info.V - M.info.E + M.info.F}`;
      if (k === 'gyroid') return 'gyroid: sin x cos y + sin y cos z + sin z cos x = 0, a triply periodic minimal surface (H = 0)';
      if (k === 'mandelbulb') return 'Mandelbulb: z ↦ z⁸ + c in spherical coordinates, bailout |z| > 2';
      return S.shape.name;
    },
    three: {
      init(S, X) {
        const C = MA = { X, bin: [], restore: [], t: 0, uT: { value: 0 }, cur: null, old: null, shapeRef: null, dis: 0, rev: 0, revK: 0, ring: 0, glow: 0, push: 0, px: 0, py: 0, flare: 0, rip: null, seedP: null };
        linearPipeline(X, C);
        X.maxPixelRatio = 1.25;
        const { scene, camera, renderer } = X;
        camera.fov = 30; camera.near = 0.1; camera.far = 100; camera.updateProjectionMatrix();
        scene.background = new THREE.Color(0x07070a);
        scene.fog = new THREE.Fog(0x07070a, 14, 34);
        studioEnv(X, C);
        X.setBloom(0.35, 0.4, 0.92); X.setExposure(0.8);
        C.grade = gradePass(X, C, { vig: 0.7, grain: 0.025 });
        // the seamless backdrop: a floor that sweeps up into a wall
        const prof = [];
        for (let i = 0; i <= 10; i++) prof.push([0, 9 - 11 * i / 10]);
        for (let i = 1; i <= 24; i++) { const a = (i / 24) * Math.PI / 2; prof.push([3.2 - 3.2 * Math.cos(a), -2 - 3.2 * Math.sin(a)]); }
        for (let i = 1; i <= 10; i++) prof.push([3.2 + 12 * i / 10, -5.2]);
        const cols = 2, bp = [], bi = [];
        prof.forEach(([y, z]) => { for (let c = 0; c <= cols; c++) bp.push(-20 + 40 * c / cols, y, z); });
        for (let r = 0; r < prof.length - 1; r++) for (let c = 0; c < cols; c++) { const a = r * (cols + 1) + c, b = a + 1, d = a + cols + 1, e = d + 1; bi.push(a, b, d, b, e, d); }
        const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3)); bg.setIndex(bi); bg.computeVertexNormals();
        const backdrop = new THREE.Mesh(bg, new THREE.MeshStandardMaterial({ color: 0x24252a, roughness: 0.95, metalness: 0, envMapIntensity: 0.12 }));
        backdrop.receiveShadow = true; scene.add(backdrop);
        // studio lights: a warm key that casts the shadow (the pointer moves it), a cool rim, a soft fill and a pool on the backdrop
        const key = new THREE.DirectionalLight(0xfff1dc, 2.6);
        key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
        Object.assign(key.shadow.camera, { left: -2.4, right: 2.4, top: 2.4, bottom: -2.4, near: 1, far: 16 });
        key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 3;
        scene.add(key, key.target); C.key = key;
        const rim = new THREE.SpotLight(0x9fc4ff, 60, 20, 0.5, 0.9, 2); rim.position.set(-3.5, 5, -4.5); rim.target.position.set(0, 1.6, 0); scene.add(rim, rim.target);
        const pool = new THREE.SpotLight(0xffe2c0, 160, 30, 0.38, 1, 2); pool.position.set(0, 9, 3); pool.target.position.set(0, 0, -3.5); scene.add(pool, pool.target); C.pool = pool;
        scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x1a1714, 0.12));
        C.rig = new THREE.Object3D(); C.spin = new THREE.Object3D(); C.rig.add(C.spin); scene.add(C.rig);
        // letters, geodesic paths, dust in the key light
        C.atlas = glyphAtlas(S.mode.glyphList.join(''), '36px serif'); C.bin.push(C.atlas.tex);
        C.cloud = glyphCloud(C.atlas, 260, { core: 1.5, glow: 0.5, white: 0.1, normal: true, order: 12 });
        C.paths = beams(4000, { hot: 1.6, style: 0 }); C.spin.add(C.paths.mesh);
        C.dust = points(260, { normal: false }); scene.add(C.dust.mesh, C.cloud.mesh);
        C.motes = Array.from({ length: 220 }, () => [rand(-3, 3), rand(0, 4), rand(-2.5, 2.5), rand(0, TAU)]);
      },
      update(S, X, now, dt) {
        const C = MA; if (!C) return;
        autoRes(S, X, C, dt);
        const s = dt / 1000, cam = X.camera, st = S.holding ? S.stage : 0, rm = S.reduceMotion;
        C.t += s; C.uT.value = C.t;
        // shape changed (tap or letter count): dissolve the old piece out and the new one in
        if (S.shape !== C.shapeRef) {
          C.shapeRef = S.shape;
          if (C.old) maFree(C.old);
          C.old = C.cur; C.cur = maBuild(S, C); C.dis = 0;
          C.cur.meshes.forEach((m) => C.spin.add(m));
        }
        C.dis = Math.min(1, C.dis + s / (rm ? 0.4 : 1.3));
        if (C.cur) C.cur.meshes.forEach((m) => { const u = m.material.userData.u; if (u) u.uDis.value = smooth(0, 1, C.dis); if (!m.isInstancedMesh || !u.uRevK) m.visible = C.cur.kind === 'surface' || C.cur.kind === 'curve' || C.dis > 0.3; });
        if (C.old) { C.old.meshes.forEach((m) => { const u = m.material.userData.u; if (u) u.uDis.value = 1 - smooth(0, 1, C.dis); if (m.isInstancedMesh) m.visible = C.dis < 0.5; }); if (C.dis >= 1) { maFree(C.old); C.old = null; } }
        // camera: a slow orbit; the pointer swings the key light (and its shadow) around the piece
        C.px = ease(C.px, S.W ? S.ptr.x / S.W - 0.5 : 0, dt, 2); C.py = ease(C.py, S.H ? S.ptr.y / S.H - 0.5 : 0, dt, 2);
        C.push = ease(C.push, st / 3, dt, 0.8);
        const az = 0.32 * Math.sin(C.t * 0.045) + C.px * 0.35, el = 0.16 + 0.05 * Math.sin(C.t * 0.07) - C.py * 0.12, R = 8.2 - 2.0 * C.push;
        cam.position.set(Math.sin(az) * Math.cos(el) * R, 1.6 + Math.sin(el) * R, Math.cos(az) * Math.cos(el) * R);
        cam.lookAt(0, 1.6, 0); cam.updateMatrixWorld();
        const kaz = -0.75 + C.px * 1.8, kel = 0.85 - C.py * 0.5;
        C.key.position.set(Math.sin(kaz) * Math.cos(kel) * 7, 1.6 + Math.sin(kel) * 7, Math.cos(kaz) * Math.cos(kel) * 7); C.key.target.position.set(0, 1.6, 0);
        C.key.intensity = 2.6 * (1 - 0.45 * smooth(2, 3, st));
        aimRig(C.rig, cam, [0, 1.62, 0], 1.25);
        C.spin.rotation.set(-S.rotX, S.rotY, 0, 'YXZ');
        // hold: curvature map spreading from the seed letter, then geodesic circles, then self-illumination
        const want = S.holding ? Math.min(2.4, S.held / 2200) : 0;
        C.rev = S.holding ? want : C.rev; C.revK = ease(C.revK, S.holding ? 1 : 0, dt, S.holding ? 4 : 1.2);
        C.ring = ease(C.ring, st >= 1 ? 1 : 0, dt, 3); C.glow = ease(C.glow, st >= 3 ? 1 : 0, dt, 1.5);
        C.flare = Math.max(0, C.flare - s);
        if (C.rip) { C.rip.t += s; if (C.rip.t > 5) C.rip = null; }
        const seed = C.seedP || [0, 0, 0];
        if (C.cur) C.cur.meshes.forEach((m) => {
          const u = m.material.userData.u; if (!u || !u.uRev) return;
          u.uRev.value.set(seed[0], seed[1], seed[2], C.rev + 0.3); u.uRevK.value = C.revK; u.uRing.value = C.ring; u.uGlow.value = C.glow + C.flare;
          u.uRipA.value = C.rip && !rm ? C.rip.a : 0; if (C.rip) u.uRip.value.set(C.rip.p[0], C.rip.p[1], C.rip.p[2], C.rip.t);
        });
        // letters: ink-gold glyphs resting on the surface, lit up when infected
        const P = palettes(S, 1), Ph = palettes(S, 3.2), toCam = new THREE.Vector3();
        fillLetters(S, C.cloud, now, { base: [P.base[0] * 0.16, P.base[1] * 0.1, P.base[2] * 0.05], pal: Ph.pal, hot: 1, size: 0.17, infScale: 1.2 });
        // nudge each glyph toward the camera so it sits on the surface instead of inside it
        const arr = C.cloud.mesh.geometry.getAttribute('iPos'), A = arr.array;
        for (let i = 0; i < C.cloud.mesh.geometry.instanceCount; i++) { toCam.set(cam.position.x - A[i * 3], cam.position.y - A[i * 3 + 1], cam.position.z - A[i * 3 + 2]).normalize().multiplyScalar(0.07); A[i * 3] += toCam.x; A[i * 3 + 1] += toCam.y; A[i * 3 + 2] += toCam.z; }
        // geodesics: each infection link as the shortest path over the mesh, computed once per link
        const M = C.cur, bm = C.paths;
        bm.begin();
        if (M && M.graph && M.nodeV) {
          let budget = 14;
          for (const l of S.links) {
            const ia = S.active.indexOf(l.A), ib = S.active.indexOf(l.B);
            if (ia < 0 || ib < 0) continue;
            let path = M.paths.get(l);
            if (path === undefined && budget-- > 0) {
              const ids = maPath(M.graph, M.nodeV[ia], M.nodeV[ib], 6000);
              path = ids ? ids.map((v) => [M.graph.wp[v * 3] + M.graph.wn[v * 3] * 0.012, M.graph.wp[v * 3 + 1] + M.graph.wn[v * 3 + 1] * 0.012, M.graph.wp[v * 3 + 2] + M.graph.wn[v * 3 + 2] * 0.012]) : null;
              if (path) for (let it = 0; it < 2; it++) for (let k = 1; k < path.length - 1; k++) for (let j = 0; j < 3; j++) path[k][j] = (path[k - 1][j] + 2 * path[k][j] + path[k + 1][j]) / 4;
              M.paths.set(l, path);
            }
            if (!path) continue;
            const grow = clamp((now - l.born) / 500, 0, 1), al = (l.dying ? 1 - (now - l.dying) / 700 : 1) * Math.min(l.A.alpha, l.B.alpha);
            if (al <= 0.01) continue;
            const c = Ph.pal[l.gen % Ph.pal.length], last = Math.max(1, Math.round((path.length - 1) * grow));
            for (let k = 0; k < last; k++) { const a = path[k], b = path[k + 1]; bm.add(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], 0.014 + 0.004 * st, al, l.seed); }
          }
        }
        bm.end(); bm.mat.uniforms.uTime.value = C.t;
        // dust drifting through the key light
        C.dust.begin();
        C.motes.forEach((m) => {
          m[3] += s * 0.2; m[1] += s * 0.03 * Math.sin(m[3] * 1.3); m[0] += s * 0.04 * Math.cos(m[3]);
          if (m[0] > 3) m[0] = -3; if (m[0] < -3) m[0] = 3;
          C.dust.add(m[0], m[1], m[2], 0.9, 0.82, 0.7, 0.012, 0.35 + 0.3 * Math.sin(m[3] * 3));
        });
        C.dust.end(X);
        if (C.grade) { C.grade.uniforms.uTime.value = C.t; }
      },
      exit() { if (MA) { maFree(MA.cur); maFree(MA.old); freeAll(MA); } MA = null; }
    }
  }));

  /* ---------------- ARCANE: a candlelit stone chamber, a summoning circle carved into the floor ---------------- */
  let AR = null;
  const AR_RUNES = { 'ᚠ': ['fehu', 'wealth'], 'ᚢ': ['ūruz', 'aurochs'], 'ᚦ': ['þurisaz', 'giant'], 'ᚨ': ['ansuz', 'a god'], 'ᚱ': ['raidō', 'ride'], 'ᚲ': ['kaunan', 'torch'], 'ᚷ': ['gebō', 'gift'], 'ᚹ': ['wunjō', 'joy'],
    'ᚺ': ['hagalaz', 'hail'], 'ᚾ': ['naudiz', 'need'], 'ᛁ': ['īsaz', 'ice'], 'ᛃ': ['jēra', 'year'], 'ᛇ': ['eihwaz', 'yew'], 'ᛈ': ['perþ', 'meaning lost'], 'ᛉ': ['algiz', 'elk'], 'ᛊ': ['sōwilō', 'sun'],
    'ᛏ': ['tīwaz', 'the god Týr'], 'ᛒ': ['berkanan', 'birch'], 'ᛖ': ['ehwaz', 'horse'], 'ᛗ': ['mannaz', 'man'], 'ᛚ': ['laguz', 'water'], 'ᛜ': ['ingwaz', 'the god Ing'], 'ᛞ': ['dagaz', 'day'], 'ᛟ': ['ōþala', 'inheritance'] };
  // Height (white = high) to a tangent-space normal map, once at init.
  function heightToNormal(src, strength) {
    const w = src.width, h = src.height, d = src.getContext('2d').getImageData(0, 0, w, h).data;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'), out = g.createImageData(w, h), o = out.data, H = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) H[i] = d[i * 4] / 255;
    for (let y = 0; y < h; y++) {
      const yu = ((y + 1) % h) * w, yd = ((y - 1 + h) % h) * w, yr = y * w;
      for (let x = 0; x < w; x++) {
        const dx = (H[yr + (x + 1) % w] - H[yr + (x - 1 + w) % w]) * strength, dy = (H[yu + x] - H[yd + x]) * strength, l = 1 / Math.sqrt(dx * dx + dy * dy + 1), i = (yr + x) * 4;
        o[i] = (-dx * l * 0.5 + 0.5) * 255; o[i + 1] = (dy * l * 0.5 + 0.5) * 255; o[i + 2] = (l * 0.5 + 0.5) * 255; o[i + 3] = 255;
      }
    }
    g.putImageData(out, 0, 0);
    return c;
  }
  function arCircle(g, cx, cy, k, runes, lw) { // the summoning circle (k = pixels per metre)
    g.save(); g.translate(cx, cy); g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
    [3.42, 3.08, 2.55, 1.02, 0.62].forEach((r) => { g.beginPath(); g.arc(0, 0, r * k, 0, TAU); g.stroke(); });
    g.beginPath(); // heptagram {7/3}
    for (let i = 0; i <= 7; i++) { const a = -Math.PI / 2 + i * 3 * TAU / 7, x = Math.cos(a) * 2.55 * k, y = Math.sin(a) * 2.55 * k; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
    g.stroke();
    g.beginPath(); // inner triangle
    for (let i = 0; i <= 3; i++) { const a = Math.PI / 2 + i * TAU / 3, x = Math.cos(a) * 1.02 * k, y = Math.sin(a) * 1.02 * k; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
    g.stroke();
    for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + i * TAU / 7; g.beginPath(); g.arc(Math.cos(a) * 2.55 * k, Math.sin(a) * 2.55 * k, 0.2 * k, 0, TAU); g.stroke(); }
    g.font = `${Math.round(0.24 * k)}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < 36; i++) { g.save(); g.rotate(i * TAU / 36); g.fillText(runes[i % runes.length], 0, -3.25 * k); g.restore(); }
    g.restore();
  }
  const FLAME_VS = [
    'attribute vec3 iPos; attribute vec4 iDat;',
    'uniform vec3 uLean; varying vec2 vUv; varying float vSeed; varying float vOn;',
    'void main(){',
    '  vUv = uv; vSeed = iDat.y; vOn = iDat.z;',
    '  vec3 lean = normalize(vec3(-iPos.x, 0.0, -iPos.z) + 1e-4) * uLean.x * uv.y * uv.y * iDat.x + vec3(uLean.y, 0.0, uLean.z) * uv.y * uv.y * iDat.x;',
    '  vec4 mv = modelViewMatrix * vec4(iPos + lean, 1.0);',
    '  mv.xy += vec2(position.x * 0.5, position.y + 0.5) * iDat.x * vec2(1.0, 2.2);',
    '  gl_Position = projectionMatrix * mv;',
    '}'].join('\n');
  const FLAME_FS = 'uniform float uT;\nvarying vec2 vUv; varying float vSeed; varying float vOn;\n' + GL_NOISE + [
    'void main(){',
    '  if (vOn < 0.01) discard;',
    '  float y = vUv.y / (0.85 + 0.15 * vnoise(vec2(uT * 9.0, vSeed * 30.0)));',
    '  float x = (vUv.x - 0.5) * 2.0 + (vnoise(vec2(y * 3.0 - uT * 6.0, vSeed * 17.0)) - 0.5) * 0.5 * y;',
    '  float w = 0.95 * pow(clamp(y, 0.0, 1.0), 0.45) * pow(clamp(1.0 - y, 0.0, 1.0), 0.9);',
    '  float d = abs(x) / max(w, 1e-3);',
    '  float body = smoothstep(1.0, 0.45, d) * step(y, 1.0);',
    '  float core = smoothstep(0.55, 0.0, d) * smoothstep(0.8, 0.25, y);',
    '  vec3 c = mix(vec3(1.0, 0.28, 0.04), vec3(1.0, 0.62, 0.22), smoothstep(0.7, 0.2, d)) * body * 2.2 + vec3(1.0, 0.85, 0.6) * core * 2.6;',
    '  c += vec3(0.1, 0.25, 1.0) * smoothstep(0.25, 0.0, y) * smoothstep(1.0, 0.3, d) * 2.0;',
    '  c += vec3(1.0, 0.45, 0.12) * exp(-length(vec2(x * 1.4, (y - 0.35) * 1.2)) * 4.0) * 0.5;',
    '  gl_FragColor = vec4(c * vOn, 1.0);',
    '}'].join('\n');

  SP.addMode(guarded({
    id: 'arcane', name: 'ARCANE', glyphs: 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ', noHueShift: true,
    base: [15, 100, 66], palette: [[5, 100, 52], [28, 100, 56], [45, 100, 62]], links: ['b3_sigil', 'b3_sigil', 'b3_sigil', 'b3_sigil'], fade: 0.45, count: 60,
    pageBg: ['#1a0805', '#050202'],
    shapes: ['sphere', 'trefoil', 'torus', 'klein', 'small_stellated_dodecahedron', 'great_dodecahedron', 'great_stellated_dodecahedron', 'compound_five_tetrahedra', 'compound_five_octahedra', 'stella_octangula'],
    init(S) { S.data.c = { x: S.cx, y: S.cy, power: 0 }; },
    onPress(S, x, y) { S.data.c.x = x; S.data.c.y = y; },
    update(S) {
      const c = S.data.c, want = S.holding && S.held > 500 ? clamp((S.held - 500) / 3000, 0, 1) : 0;
      c.x += (S.ptr.x - c.x) * 0.12; c.y += (S.ptr.y - c.y) * 0.12; c.power += (want - c.power) * 0.05;
    },
    ambient(S, ctx) {
      if (AR && S.three) { hide2D(S, ctx); S.data.hid = 1; return; }
      if (Math.random() < 0.35) S.spawn(rand(0, S.W), S.H + 4, rand(-0.2, 0.2), rand(-1, -0.35), S.colorOf(1, 1), rand(2500, 4500), rand(1, 2));
    },
    warp(S, n) { if (AR && S.three) placeLetter(S, n, AR.rig, S.three.camera); },
    drawNode(S) { return !!(AR && S.three); },
    under(S, ctx, now) {
      if (S.data.hid) { S.data.hid = 0; show2D(S, ctx); return; }
      const c = S.data.c, p = c.power;
      if (p < 0.02) return;
      const r = 30 + 100 * p, rot = now * 0.0006;
      ctx.save(); ctx.translate(c.x, c.y); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.3);
      g.addColorStop(0, S.colorOf(0, 0.22 * p)); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.3, 0, TAU); ctx.fill();
      ctx.strokeStyle = S.colorOf(0, 0.85 * p); ctx.lineWidth = 1.5;
      [1, 0.82, 0.45].forEach((f) => { ctx.beginPath(); ctx.arc(0, 0, r * f, 0, TAU); ctx.stroke(); });
      ctx.save(); ctx.rotate(-rot * 1.5); ctx.beginPath();
      for (let k = 0; k <= 5; k++) { const a = -Math.PI / 2 + k * 2 * TAU / 5, x = Math.cos(a) * r * 0.82, y = Math.sin(a) * r * 0.82; if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.strokeStyle = S.colorOf(1, 0.9 * p); ctx.stroke(); ctx.restore();
      ctx.save(); ctx.rotate(rot);
      ctx.fillStyle = S.colorOf(2, p); ctx.font = `${10 + 6 * p}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let k = 0; k < 16; k++) { ctx.save(); ctx.rotate(k * TAU / 16); ctx.fillText(S.mode.glyphList[(k * 5) % S.mode.glyphList.length], 0, -r * 0.91); ctx.restore(); }
      ctx.restore();
      ctx.restore();
      if (Math.random() < p) { const a = rand(0, TAU); S.spawn(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, rand(-0.3, 0.3), rand(-1.6, -0.5), S.colorOf(1, 1), rand(800, 1600), rand(1, 2.2)); }
    },
    onClimax(S) { if (AR && S.three) { AR.flare = 1; return false; } },
    onRelease(S, held, power) {
      const C = AR, c = S.data.c;
      if (!(C && S.three)) {
        if (c.power > 0.2) for (let k = 0; k < 90; k++) { const a = rand(0, TAU), v = rand(1, 6); S.spawn(c.x, c.y, Math.cos(a) * v, Math.sin(a) * v - 1, S.colorOf(k % 3, 1), rand(600, 1600), rand(1, 3)); }
        c.power = 0; return;
      }
      c.power = 0;
      if (held < S.STAGES[1]) { C.wave = 0.01; C.waveK = 0.4; return false; }
      // the bound power escapes as a pressure wave across the floor: it snuffs every candle, and they relight one by one
      C.wave = 0.01; C.waveK = Math.min(1.4, power);
      C.candles.forEach((k) => { k.out = 0.25 + Math.hypot(k.x, k.z) / 9; k.back = k.out + 1.6 + rand(0, 2.6); });
      const hot = [[3, 1.1, 0.25], [3.5, 1.6, 0.4], [2.5, 0.6, 0.1]];
      for (let k = 0; k < 160 * Math.min(1, power); k++) { const a = rand(0, TAU), v = rand(2, 7); C.embers.spawn(Math.cos(a) * 0.5, rand(0.1, 2.5), Math.sin(a) * 0.5, Math.cos(a) * v, rand(0.5, 3), Math.sin(a) * v, rand(1200, 2600), rand(0.025, 0.05), pick(hot), { drag: 1.2, g: -0.4 }); }
      return false;
    },
    hud(S) {
      const C = AR;
      if (!(C && S.three)) return 'candle flame: soot at about 1400 K glows like a blackbody';
      const out = C.candles.filter((k) => k.state < 0.5).length;
      if (out) return `${out} of ${C.candles.length} candles snuffed · the white smoke is wax vapour: touch a flame to it and the wick relights`;
      if (!S.holding) return 'candlelight: soot glowing at about 1400 K, the blue base is CH and C₂ emission · the circle is carved in the Elder Futhark';
      let last = null; S.active.forEach((n) => { if (n.inf && (!last || n.gen > last.gen)) last = n; });
      const r = last && AR_RUNES[last.g] ? `${last.g} ${AR_RUNES[last.g][0]}, “${AR_RUNES[last.g][1]}”` : '';
      if (S.stage >= 3) return `the flames lean inward: the circle's heat drives a convection draught · ${S.infected}/${S.active.length} runes bound · ${r}`;
      return `circle ${Math.round(100 * C.lit)}% kindled · ${S.infected}/${S.active.length} runes bound · ${r}`;
    },
    three: {
      init(S, X) {
        const C = AR = { X, bin: [], restore: [], t: 0, lit: 0, energy: 0, rune: 0, lean: 0, push: 0, pillar: 0, flare: 0, wave: -1, waveK: 0, px: 0, py: 0, uT: { value: 0 } };
        linearPipeline(X, C);
        X.maxPixelRatio = 1;
        const { scene, camera } = X, R = mulberry(777), runes = S.mode.glyphList;
        camera.fov = 42; camera.near = 0.1; camera.far = 80; camera.updateProjectionMatrix();
        scene.background = new THREE.Color(0x030202);
        scene.fog = new THREE.FogExp2(0x060403, 0.075);
        X.setBloom(1.0, 0.6, 0.7); X.setExposure(1.0);
        C.grade = gradePass(X, C, { vig: 0.85, grain: 0.045 });
        // flagstone floor with the circle carved into it (colour, height -> normal, roughness), 16 m across
        const FS = 1024, k = FS / 22;
        const col = document.createElement('canvas'), hgt = document.createElement('canvas'); col.width = col.height = hgt.width = hgt.height = FS;
        const gc = col.getContext('2d'), gh = hgt.getContext('2d');
        gc.fillStyle = '#1b1916'; gc.fillRect(0, 0, FS, FS); gh.fillStyle = '#000'; gh.fillRect(0, 0, FS, FS);
        let y = 0;
        while (y < FS) {
          const rh = (0.6 + R() * 0.5) * k; let x = -R() * k;
          while (x < FS) {
            const rw = (0.7 + R() * 0.9) * k, v = 40 + R() * 30, wv = R();
            gc.fillStyle = `rgb(${v + 6 * wv},${v + 3 * wv},${v - 4})`; gc.fillRect(x + 3, y + 3, rw - 6, rh - 6);
            const hv = 150 + R() * 70; gh.fillStyle = `rgb(${hv},${hv},${hv})`; gh.fillRect(x + 3, y + 3, rw - 6, rh - 6);
            x += rw;
          }
          y += rh;
        }
        for (let i = 0; i < 24000; i++) { const x = R() * FS, yy = R() * FS, v = R(); gc.fillStyle = `rgba(${v > 0.5 ? 255 : 0},${v > 0.5 ? 240 : 0},${v > 0.5 ? 220 : 0},${0.05 + 0.06 * R()})`; gc.fillRect(x, yy, 1 + R() * 2, 1 + R() * 2); gh.fillStyle = `rgba(${v > 0.5 ? 255 : 0},${v > 0.5 ? 255 : 0},${v > 0.5 ? 255 : 0},0.12)`; gh.fillRect(x, yy, 2, 2); }
        for (let i = 0; i < 40; i++) { gc.strokeStyle = 'rgba(0,0,0,0.35)'; gc.lineWidth = 1; gc.beginPath(); let cx = R() * FS, cy = R() * FS; gc.moveTo(cx, cy); for (let j = 0; j < 6; j++) { cx += (R() - 0.5) * 30; cy += (R() - 0.5) * 30; gc.lineTo(cx, cy); } gc.stroke(); }
        gc.strokeStyle = '#0a0706'; gc.fillStyle = '#0a0706'; arCircle(gc, FS / 2, FS / 2, k, runes, 0.045 * k);
        gh.strokeStyle = '#000'; gh.fillStyle = '#000'; arCircle(gh, FS / 2, FS / 2, k, runes, 0.05 * k);
        const nrm = heightToNormal(hgt, 3.5);
        const tCol = new THREE.CanvasTexture(col), tNrm = new THREE.CanvasTexture(nrm), tR = new THREE.CanvasTexture(hgt);
        tCol.encoding = THREE.sRGBEncoding; [tCol, tNrm, tR].forEach((t) => { t.anisotropy = 8; C.bin.push(t); });
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), new THREE.MeshStandardMaterial({ map: tCol, normalMap: tNrm, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 0.82, metalness: 0 }));
        floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
        // the glowing circle: a decal that only lights in the carved grooves
        const mk = document.createElement('canvas'); mk.width = mk.height = 1024;
        const gm = mk.getContext('2d'); gm.fillStyle = '#000'; gm.fillRect(0, 0, 1024, 1024); gm.strokeStyle = '#fff'; gm.fillStyle = '#fff';
        arCircle(gm, 512, 512, 1024 / 7.2, runes, 0.035 * 1024 / 7.2);
        const tMask = new THREE.CanvasTexture(mk); C.bin.push(tMask);
        C.circU = { uMask: { value: tMask }, uT: C.uT, uIgn: { value: 5 }, uE: { value: 0 }, uRune: { value: 0 }, uWave: { value: -1 }, uWaveK: { value: 0 }, uCol: { value: new THREE.Vector3(1, 0.3, 0.05) } };
        const circ = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 7.2), new THREE.ShaderMaterial({
          uniforms: C.circU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
          vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
          fragmentShader: 'uniform sampler2D uMask; uniform float uT, uIgn, uE, uRune, uWave, uWaveK; uniform vec3 uCol; varying vec2 vUv;\n' + GL_NOISE + [
            'void main(){',
            '  vec2 p = (vUv - 0.5) * 7.2; float r = length(p), a = atan(p.y, p.x);',
            '  float m = texture2D(uMask, vUv).r;',
            '  float lit = smoothstep(uIgn - 0.25, uIgn + 0.05, r);',
            '  float flow = 0.55 + 0.45 * sin(a * 7.0 - uT * 2.2 + r * 4.0);',
            '  float flick = 0.75 + 0.25 * vnoise(vec2(a * 9.0 + r * 3.0, uT * 5.0));',
            '  float band = step(3.08, r) * step(r, 3.42);',
            '  float runeLit = band * step(fract(a / 6.2832 + 0.25), uRune);',
            '  float ember = 0.03 * (0.5 + 0.5 * vnoise(vec2(a * 20.0, uT * 0.7)));',
            '  float wave = uWaveK * exp(-pow((r - uWave) * 3.0, 2.0)) * (0.6 + 0.4 * vnoise(vec2(a * 12.0, uT * 3.0)));',
            '  vec3 c = uCol * m * (ember + lit * uE * flow * flick * 3.0 + runeLit * 3.5);',
            '  c += uCol * wave * (0.6 + 2.0 * m) * smoothstep(7.2, 2.0, r);',
            '  c += uCol * uE * 0.06 * smoothstep(3.6, 0.0, r);',
            '  gl_FragColor = vec4(c, 1.0);',
            '}'].join('\n')
        }));
        circ.rotation.x = -Math.PI / 2; circ.position.y = 0.006; scene.add(circ);
        // walls of cut stone and a ring of columns
        const wc = document.createElement('canvas'); wc.width = 512; wc.height = 256; const gw = wc.getContext('2d');
        const wh = document.createElement('canvas'); wh.width = 512; wh.height = 256; const gwh = wh.getContext('2d');
        gw.fillStyle = '#100e0c'; gw.fillRect(0, 0, 512, 256); gwh.fillStyle = '#000'; gwh.fillRect(0, 0, 512, 256);
        for (let r = 0; r < 8; r++) for (let c = -1; c < 5; c++) {
          const x = c * 128 + (r % 2) * 64 + (R() - 0.5) * 10, yy = r * 32, v = 30 + R() * 22;
          gw.fillStyle = `rgb(${v + 4},${v + 2},${v - 2})`; gw.fillRect(x + 2, yy + 2, 124, 28);
          const hv = 140 + R() * 90; gwh.fillStyle = `rgb(${hv},${hv},${hv})`; gwh.fillRect(x + 2, yy + 2, 124, 28);
        }
        for (let i = 0; i < 9000; i++) { const x = R() * 512, yy = R() * 256; gw.fillStyle = `rgba(0,0,0,${0.15 * R()})`; gw.fillRect(x, yy, 2, 2); gwh.fillStyle = `rgba(0,0,0,0.2)`; gwh.fillRect(x, yy, 2, 2); }
        const tW = new THREE.CanvasTexture(wc), tWN = new THREE.CanvasTexture(heightToNormal(wh, 3));
        tW.encoding = THREE.sRGBEncoding; [tW, tWN].forEach((t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; C.bin.push(t); });
        tW.repeat.set(10, 4); tWN.repeat.set(10, 4);
        const wall = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 10, 64, 1, true), new THREE.MeshStandardMaterial({ map: tW, normalMap: tWN, roughness: 0.9, side: THREE.BackSide }));
        wall.position.y = 5; wall.receiveShadow = true; scene.add(wall);
        const tP = tW.clone(), tPN = tWN.clone(); tP.repeat.set(2, 3); tPN.repeat.set(2, 3); tP.needsUpdate = tPN.needsUpdate = true; C.bin.push(tP, tPN);
        const prof = [[0, 0], [0.66, 0], [0.66, 0.28], [0.56, 0.34], [0.56, 0.42], [0.46, 0.5], [0.42, 0.62], [0.4, 3], [0.37, 5.2], [0.42, 5.32], [0.5, 5.5], [0.62, 5.62], [0.66, 5.62], [0.66, 5.86], [0, 5.86]].map((p) => new THREE.Vector2(p[0], p[1]));
        const cols = new THREE.InstancedMesh(new THREE.LatheGeometry(prof, 28), new THREE.MeshStandardMaterial({ map: tP, normalMap: tPN, roughness: 0.85 }), 8);
        const m4 = new THREE.Matrix4();
        for (let i = 0; i < 8; i++) { const a = (i + 0.5) * TAU / 8; cols.setMatrixAt(i, m4.makeTranslation(Math.cos(a) * 8.6, 0, Math.sin(a) * 8.6)); }
        cols.castShadow = true; cols.receiveShadow = true; scene.add(cols);
        // candles: turned wax bodies with drips, wicks and flames, clustered around the circle
        C.candles = [];
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI / 2 + i * TAU / 7 + Math.PI / 7, r = 4.15;
          for (let j = 0; j < 2 + (i % 2); j++) { const h = 0.25 + R() * 0.45, rr = 0.045 + R() * 0.03, aa = a + (R() - 0.5) * 0.25, d = r + (R() - 0.5) * 0.5; C.candles.push({ x: Math.cos(aa) * d, z: Math.sin(aa) * d, h, r: rr, seed: R(), state: 1, out: -1, back: -1, snuffed: 0 }); }
        }
        const wprof = []; for (let i = 0; i <= 12; i++) { const t = i / 12; wprof.push(new THREE.Vector2(t < 0.92 ? 1 + 0.06 * Math.sin(t * 40) * t : 1 - (t - 0.92) * 3, t)); }
        wprof.unshift(new THREE.Vector2(0, 0)); wprof.push(new THREE.Vector2(0.55, 1.0), new THREE.Vector2(0.55, 0.96), new THREE.Vector2(0, 0.96));
        const waxMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.55 });
        waxMat.onBeforeCompile = (sh) => { // light scattering through the wax near the flame
          sh.uniforms.uWax = C.waxU;
          sh.vertexShader = 'varying float vH;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vH = position.y;');
          sh.fragmentShader = 'uniform float uWax; varying float vH;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vec3(1.0, 0.45, 0.12) * smoothstep(0.55, 1.0, vH) * 0.5 * uWax;');
        };
        C.waxU = { value: 1 };
        const wax = new THREE.InstancedMesh(new THREE.LatheGeometry(wprof, 18), waxMat, C.candles.length);
        C.candles.forEach((c, i) => wax.setMatrixAt(i, m4.compose(new THREE.Vector3(c.x, 0, c.z), new THREE.Quaternion(), new THREE.Vector3(c.r, c.h, c.r))));
        wax.castShadow = true; wax.receiveShadow = true; scene.add(wax); C.wax = wax;
        const fq = instancedQuad({ iPos: 3, iDat: 4 }, C.candles.length);
        C.flameU = { uT: C.uT, uLean: { value: new THREE.Vector3(0, 0, 0) } };
        const flames = new THREE.Mesh(fq.g, new THREE.ShaderMaterial({ uniforms: C.flameU, vertexShader: FLAME_VS, fragmentShader: FLAME_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        flames.frustumCulled = false; flames.renderOrder = 8; scene.add(flames); C.fq = fq;
        C.candles.forEach((c, i) => { fq.iPos.array.set([c.x, c.h + 0.01, c.z], i * 3); fq.iDat.array.set([0.07, c.seed, 1, 0], i * 4); });
        fq.g.instanceCount = C.candles.length; fq.iPos.needsUpdate = true;
        // lights: three candle groups, the circle's own light, and moonlight through an oculus (the shadow caster)
        C.cl = [0, 1, 2].map((i) => { const a = -Math.PI / 2 + i * TAU / 3 + 0.4, l = new THREE.PointLight(0xff9a4a, 12, 14, 2); l.position.set(Math.cos(a) * 4.1, 0.75, Math.sin(a) * 4.1); scene.add(l); return { l, seed: R() }; });
        C.magic = new THREE.PointLight(0xff4010, 0, 16, 2); C.magic.position.set(0, 0.5, 0); scene.add(C.magic);
        const moon = new THREE.SpotLight(0x8fb0ff, 260, 30, 0.3, 0.55, 2); moon.position.set(1.8, 15, -2.5); moon.target.position.set(-0.4, 0, 0.6);
        moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024); moon.shadow.camera.near = 6; moon.shadow.camera.far = 20; moon.shadow.bias = -0.0005; moon.shadow.radius = 4;
        scene.add(moon, moon.target);
        scene.add(new THREE.HemisphereLight(0x302a40, 0x120804, 0.06));
        // the moonbeam and drifting haze (layered noise cards)
        C.shaftU = { uT: C.uT, uK: { value: 1 } };
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.5, 15, 32, 1, true), new THREE.ShaderMaterial({
          uniforms: C.shaftU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
          vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vW; varying float vH; void main(){ vH = uv.y; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
          fragmentShader: 'uniform float uT, uK; varying vec3 vN; varying vec3 vV; varying vec3 vW; varying float vH;\n' + GL_NOISE + 'void main(){ float f = abs(dot(normalize(vN), vV)); float n = 0.6 + 0.4 * vnoise3(vW * 1.3 + vec3(0.0, -uT * 0.15, uT * 0.05)); float a = pow(f, 1.6) * n * smoothstep(0.0, 0.25, vH) * 0.06 * uK; gl_FragColor = vec4(vec3(0.55, 0.7, 1.0) * a, 1.0); }'
        }));
        shaft.position.set(0.7, 7.5, -0.95); shaft.rotation.z = 0.145; shaft.rotation.x = 0.21; scene.add(shaft);
        C.hazeU = { uT: C.uT, uCol: { value: new THREE.Vector3(1, 0.4, 0.15) }, uK: { value: 0.3 } };
        const hazeMat = new THREE.ShaderMaterial({
          uniforms: C.hazeU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
          vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
          fragmentShader: 'uniform float uT, uK; uniform vec3 uCol; varying vec2 vUv; varying vec3 vW;\n' + GL_NOISE + 'void main(){ float n = fbm(vW.xz * 0.35 + vec2(uT * 0.03, vW.y * 0.4 - uT * 0.02)); float e = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x) * smoothstep(1.0, 0.0, vUv.y) * smoothstep(0.0, 0.05, vUv.y); float near = exp(-length(vW.xz) * 0.25); gl_FragColor = vec4(uCol * n * n * e * uK * (0.3 + near), 1.0); }'
        });
        C.haze = [];
        for (let i = 0; i < 4; i++) { const h = new THREE.Mesh(new THREE.PlaneGeometry(13, 2.6), hazeMat); h.position.set(0, 1.3, 2.5 - i * 1.9); h.renderOrder = 7; scene.add(h); C.haze.push(h); }
        // stage III: a column of light rises from the centre of the circle
        C.pillarU = { uT: C.uT, uK: { value: 0 }, uCol: { value: new THREE.Vector3(1, 0.4, 0.1) } };
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.9, 14, 40, 1, true), new THREE.ShaderMaterial({
          uniforms: C.pillarU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
          vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vW; varying float vH; void main(){ vH = uv.y; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
          fragmentShader: 'uniform float uT, uK; uniform vec3 uCol; varying vec3 vN; varying vec3 vV; varying vec3 vW; varying float vH;\n' + GL_NOISE + 'void main(){ float f = abs(dot(normalize(vN), vV)); float n = 0.5 + 0.5 * vnoise3(vec3(atan(vW.z, vW.x) * 2.0, vW.y * 1.5 - uT * 4.0, uT)); float a = pow(f, 2.0) * n * smoothstep(1.0, 0.0, vH) * uK; gl_FragColor = vec4(uCol * a * 2.5, 1.0); }'
        }));
        pillar.position.y = 7; pillar.renderOrder = 6; scene.add(pillar);
        // embers, smoke, the runes and their bindings
        C.emberPts = points(900, { hard: 0.2 }); C.embers = sim(900); scene.add(C.emberPts.mesh);
        C.smokePts = points(500, { normal: true }); C.smoke = sim(500); scene.add(C.smokePts.mesh);
        C.atlas = glyphAtlas(runes.join(''), '40px serif'); C.bin.push(C.atlas.tex);
        C.cloud = glyphCloud(C.atlas, 260, { core: 2.2, glow: 1.6, white: 0.3 });
        C.links = beams(400, { hot: 1.3, style: 2 });
        C.rig = new THREE.Object3D(); scene.add(C.rig, C.cloud.mesh, C.links.mesh);
      },
      update(S, X, now, dt) {
        const C = AR; if (!C) return;
        autoRes(S, X, C, dt);
        const s = dt / 1000, cam = X.camera, st = S.holding ? S.stage : 0, rm = S.reduceMotion;
        C.t += s; C.uT.value = C.t;
        const held = S.holding ? S.held : 0;
        C.lit = ease(C.lit, S.holding ? clamp(held / 2600, 0, 1) : 0, dt, S.holding ? 6 : 1.5);
        C.energy = ease(C.energy, S.holding ? 0.4 + 0.6 * (S.infected / Math.max(1, S.active.length)) : 0, dt, 3);
        C.rune = S.holding ? clamp((held - 1200) / 2400, 0, 1) : Math.max(0, C.rune - s * 0.6);
        C.lean = ease(C.lean, st >= 1 ? 0.25 + 0.25 * st : 0, dt, 1.5);
        C.push = ease(C.push, st / 3, dt, 0.8);
        C.flare = Math.max(0, C.flare - s * 0.8);
        if (C.wave >= 0) { C.wave += s * 7.5; if (C.wave > 10) C.wave = -1; }
        // camera: a slow orbit around the circle; the pointer sways it
        C.px = ease(C.px, S.W ? S.ptr.x / S.W - 0.5 : 0, dt, 2); C.py = ease(C.py, S.H ? S.ptr.y / S.H - 0.5 : 0, dt, 2);
        const az = 0.35 * Math.sin(C.t * 0.04) + C.px * 0.5, R = 7.6 - 1.8 * C.push, ht = 3.0 - C.py * 1.0 - C.push * 0.5;
        cam.position.set(Math.sin(az) * R, ht, Math.cos(az) * R); cam.lookAt(0, 1.55, 0); cam.updateMatrixWorld();
        aimRig(C.rig, cam, [0, 2.15, 0], 1.55 + 0.1 * C.push);
        // the circle kindles from the outer ring inward, then the rune band
        const P = palettes(S, 1), Ph = palettes(S, 3), c0 = linRGB(S.mode.palette[0], 0, 1);
        const cu = C.circU;
        C.pillar = ease(C.pillar, st >= 3 ? 1 : 0, dt, st >= 3 ? 1.4 : 5);
        C.pillarU.uK.value = C.pillar * (rm ? 0.8 : 0.85 + 0.15 * Math.sin(C.t * 13)); C.pillarU.uCol.value.set(c0[0], c0[1] * 1.3, c0[2] + 0.05);
        cu.uIgn.value = 3.6 - 3.8 * C.lit; cu.uE.value = C.energy + C.flare; cu.uRune.value = C.rune;
        cu.uWave.value = C.wave; cu.uWaveK.value = C.wave >= 0 ? C.waveK * Math.max(0, 1 - C.wave / 10) * 2 : 0;
        cu.uCol.value.set(c0[0], c0[1], c0[2]);
        C.magic.color.setRGB(c0[0], c0[1], c0[2]); C.magic.intensity = 90 * (C.energy * C.lit + C.flare * 0.6) + (C.wave >= 0 ? 260 * C.waveK * Math.max(0, 1 - C.wave / 4) : 0);
        C.hazeU.uK.value = 0.07 + 0.3 * C.energy * C.lit; C.hazeU.uCol.value.set(c0[0] * 0.6 + 0.4, c0[1] * 0.6 + 0.15, c0[2] * 0.6 + 0.05);
        C.haze.forEach((h) => { h.rotation.y = Math.atan2(cam.position.x, cam.position.z); });
        // candles: flicker, lean into the draught, snuff and relight
        let litN = 0;
        C.candles.forEach((k, i) => {
          if (k.back >= 0) {
            k.out -= s; k.back -= s;
            if (k.out <= 0 && k.state > 0.5 && !k.snuffed) { k.snuffed = 1; k.state = 0; for (let j = 0; j < 6; j++) C.smoke.spawn(k.x, k.h + 0.05, k.z, rand(-0.05, 0.05), rand(0.2, 0.5), rand(-0.05, 0.05), rand(2500, 4500), rand(0.08, 0.2), [0.55, 0.55, 0.58], { drag: 0.4, g: -0.15 }); }
            if (k.back <= 0) { k.state = 1; k.out = -1; k.back = -1; k.snuffed = 0; k.flare = 1; }
          }
          if (k.state < 0.5 && Math.random() < s * 6) C.smoke.spawn(k.x, k.h + 0.03, k.z, rand(-0.03, 0.03), rand(0.25, 0.45), rand(-0.03, 0.03), rand(2000, 3500), rand(0.06, 0.14), [0.6, 0.6, 0.62], { drag: 0.3, g: -0.1 });
          k.flare = Math.max(0, (k.flare || 0) - s * 2);
          const on = k.state * (1 + 0.6 * k.flare + 0.35 * C.lean);
          C.fq.iDat.array[i * 4] = 0.085 + 0.02 * C.lean + 0.03 * (k.flare || 0); C.fq.iDat.array[i * 4 + 2] = on;
          litN += k.state;
          if (k.state > 0.5 && Math.random() < s * (0.6 + 4 * C.lean)) C.embers.spawn(k.x, k.h + 0.12, k.z, rand(-0.05, 0.05), rand(0.3, 0.8), rand(-0.05, 0.05), rand(1500, 3200), rand(0.012, 0.022), [3, 1.1, 0.25], { drag: 0.8, g: -0.25 });
        });
        C.fq.iDat.needsUpdate = true;
        C.flameU.uLean.value.set(C.lean * 1.4, rm ? 0 : 0.08 * Math.sin(C.t * 0.7) * (1 - C.lean), 0);
        const frac = litN / C.candles.length; C.waxU.value = frac;
        C.cl.forEach((L) => { L.l.intensity = (rm ? 12 : 12 * (0.82 + 0.18 * X.noise.noise(C.t * 7, L.seed * 10, 0) + 0.1 * Math.sin(C.t * 23 + L.seed * 9))) * frac * (1 + 0.6 * C.lean); });
        // embers rise on the heat; on stage II they are drawn into a vortex over the circle
        if (Math.random() < s * (8 + 50 * C.energy * C.lit)) { const a = rand(0, TAU), r = rand(0.5, 3.4); C.embers.spawn(Math.cos(a) * r, 0.05, Math.sin(a) * r, 0, rand(0.4, 1.2), 0, rand(2000, 4000), rand(0.012, 0.03), linRGB(S.mode.palette[1], 0, 3), { drag: 0.6, g: -0.35 }); }
        const swirl = st >= 2 ? 1.6 : 0.15;
        C.emberPts.begin();
        C.embers.step(dt, C.emberPts, (k) => (1 - k) * Math.min(1, k * 8), (d, i, sec) => { const x = d[i], z = d[i + 2], r = Math.hypot(x, z) + 0.2; d[i + 3] += (-z / r * swirl - x / r * swirl * 0.3) * sec + (Math.random() - 0.5) * sec; d[i + 5] += (x / r * swirl - z / r * swirl * 0.3) * sec + (Math.random() - 0.5) * sec; });
        C.emberPts.end(X);
        C.smokePts.begin(); C.smoke.step(dt, C.smokePts, (k) => 0.22 * (1 - k) * Math.min(1, k * 6)); C.smokePts.end(X);
        // the runes float over the circle; bindings burn between them
        fillLetters(S, C.cloud, now, { base: [P.base[0] * 1.6, P.base[1] * 1.2, P.base[2] * 1], pal: Ph.pal, hot: 1.4, size: 0.24 });
        C.cloud.mat.uniforms.uTime.value = C.t;
        C.links.mat.uniforms.uTime.value = C.t;
        fillLinks(S, C.links, now, { pal: Ph.pal, width: 0.016 + 0.008 * st });
        if (C.grade) C.grade.uniforms.uTime.value = C.t;
      },
      exit() { if (AR) freeAll(AR); AR = null; }
    }
  }));

  /* ---------------- HOLOGRAM: a lab, a projector, and a 4D polytope rotating in the light ---------------- */
  let HO = null;
  const HO_CELLS = { tesseract: [16, 32, 24, 8, 'tesseract'], cell24: [24, 96, 96, 24, '24-cell'], cell600: [120, 720, 1200, 600, '600-cell'], duoprism: [36, 72, 48, 12, '6-6 duoprism'],
    rectified_tesseract: [32, 96, 88, 24, 'rectified tesseract'], runcinated_tesseract: [64, 192, 208, 80, 'runcinated tesseract'] };
  const HO_FACTS = { glome: '3-sphere x² + y² + z² + w² = 1, seen through a stereographic projection', clifford_torus: 'Clifford torus: flat, zero curvature, yet it lies on the 3-sphere, |z₁| = |z₂| = 1/√2',
    hopf: 'Hopf fibration: the 3-sphere as circles, and any two of them are linked exactly once', helix: 'helix: constant curvature and torsion, so κ/τ is constant (Lancret)',
    sphere: 'Fibonacci lattice: each point turned by the golden angle, 137.5°', lissajous: 'Lissajous knot: x, y, z oscillate at frequencies 3, 2 and 5' };
  function hoScreen(C) { // the console readouts: live traces of the projector, redrawn a few times a second
    const g = C.scrG, w = 512, h = 320, t = C.t;
    g.fillStyle = '#020a0c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(80,220,255,0.15)'; g.lineWidth = 1;
    for (let x = 0; x <= w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    const trace = (col, f, y0, amp) => { g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); for (let x = 0; x <= w; x += 4) { const y = y0 + amp * f(x / w * TAU * 2 + t); if (x) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke(); };
    trace('#5fe8ff', (a) => Math.sin(a) * Math.cos(a * 0.7 * (1 + C.load)), 90, 40);
    trace('#ffb347', (a) => Math.sin(a * 1.6 + 1) * (0.6 + 0.4 * C.load), 180, 30);
    g.fillStyle = '#5fe8ff'; g.font = '18px monospace';
    g.fillText(`xw ${(C.a4 % TAU).toFixed(3)} rad`, 16, 250); g.fillText(`zw ${((C.a4 * 0.7) % TAU).toFixed(3)} rad`, 16, 274);
    g.fillText(`load ${Math.round(40 + 60 * C.load)} %`, 300, 250); g.fillText(`coh ${(1 - 0.6 * C.load).toFixed(2)}`, 300, 274);
    g.fillStyle = 'rgba(95,232,255,0.8)'; for (let i = 0; i < 16; i++) { const v = 0.3 + 0.7 * Math.abs(Math.sin(t * 2 + i * 0.7)) * (0.4 + 0.6 * C.load); g.fillRect(16 + i * 30, 312 - v * 24, 20, v * 24); }
    C.scrTex.needsUpdate = true;
  }

  SP.addMode(guarded({
    id: 'holo', name: 'HOLOGRAM', glyphs: '01◇◆◈▣□■△▽○●⊡⊞', noHueShift: true,
    base: [170, 100, 72], palette: [[170, 100, 55], [190, 100, 70], [0, 0, 100]], links: ['b3_pulse', 'b3_pulse', 'b3_pulse', 'b3_pulse'], mesh: true, fade: 0.5, count: 'random',
    pageBg: ['#03161a', '#010507'],
    shapes: ['tesseract', 'helix', 'sphere', 'lissajous', 'cell24', 'cell600', 'duoprism', 'rectified_tesseract', 'runcinated_tesseract', 'glome', 'clifford_torus', 'hopf'],
    update(S) { S.a4Speed = S.holding && S.stage >= 2 ? 0.0028 : 0.0006; },
    ambient(S, ctx, now) {
      if (HO && S.three) { hide2D(S, ctx); S.data.hid = 1; return; }
      const y = S.cy + S.R * 1.25 * Math.sin(now * 0.0013), w = S.R * 1.6;
      const g = ctx.createLinearGradient(0, y - 24, 0, y + 24);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, S.colorOf(0, 0.16)); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(S.cx - w, y - 24, w * 2, 48);
    },
    under(S, ctx) { if (S.data.hid) { S.data.hid = 0; show2D(S, ctx); } },
    warp(S, n) { if (HO && S.three) placeLetter(S, n, HO.rig, S.three.camera); },
    drawNode(S) { return !!(HO && S.three); },
    onClimax(S) { if (HO && S.three) { HO.flare = 1; return false; } },
    onRelease(S, held) {
      const C = HO;
      if (held > S.STAGES[2]) S.active.forEach((n) => (n.p = n.p.map((v) => v * 0.03))); // implode, unfold again
      if (!(C && S.three)) { if (held > S.STAGES[2]) S.flash(0.5); return; }
      C.ring = 0.001; C.ringK = held > S.STAGES[2] ? 1 : 0.4;
      if (held > S.STAGES[1]) C.wipe = 0;
      for (let k = 0; k < 60; k++) { const a = rand(0, TAU), v = rand(1, 4); C.sparks.spawn(Math.cos(a) * 0.3, 1.15, Math.sin(a) * 0.3, Math.cos(a) * v, rand(1, 4), Math.sin(a) * v, rand(600, 1400), rand(0.015, 0.03), [1.5, 3, 3.5], { drag: 0.6, g: 9.81, floor: 0.01, bounce: 0.3 }); }
      return false;
    },
    hud(S) {
      const C = HO, k = S.shape.key;
      if (!(C && S.three)) return 'a 4D shape seen as its 3D shadow';
      if (C.wipe >= 0) return `projector discharge · rebooting the hologram, scan line ${Math.round(100 * Math.min(1, C.wipe))}%`;
      if (S.holding && S.stage >= 3) return `overload: coherence falls, fringes spaced λ / (2 sin(θ/2)) crawl across the field · ${S.infected}/${S.active.length} nodes locked`;
      if (S.holding) return `4D rotation in the xw and zw planes at ${(S.a4Speed * 1000).toFixed(1)} rad/s · projected by k = 1.6 / (1.6 − w) · ${S.infected}/${S.active.length} nodes locked`;
      const c = HO_CELLS[k];
      if (c) return `${c[4]}: V ${c[0]} · E ${c[1]} · F ${c[2]} · C ${c[3]}, and V − E + F − C = ${c[0] - c[1] + c[2] - c[3]} (Euler, one dimension up)`;
      return HO_FACTS[k] || S.shape.name;
    },
    three: {
      init(S, X) {
        const C = HO = { X, bin: [], restore: [], t: 0, uT: { value: 0 }, load: 0, a4: 0, flare: 0, ring: -1, ringK: 0, wipe: -1, px: 0, py: 0, push: 0, lastScr: 0 };
        linearPipeline(X, C);
        X.maxPixelRatio = 1;
        const { scene, camera } = X, R = mulberry(4242), m4 = new THREE.Matrix4();
        camera.fov = 40; camera.near = 0.1; camera.far = 120; camera.updateProjectionMatrix();
        scene.background = new THREE.Color(0x010304);
        scene.fog = new THREE.FogExp2(0x010608, 0.045);
        studioEnv(X, C);
        X.setBloom(1.1, 0.5, 0.7); X.setExposure(0.95);
        C.grade = gradePass(X, C, { vig: 0.6, grain: 0.03 });
        const metal = new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.32, metalness: 0.9, envMapIntensity: 0.6 });
        const dark = new THREE.MeshStandardMaterial({ color: 0x0c1014, roughness: 0.5, metalness: 0.6, envMapIntensity: 0.3 });
        // wall panels on a ring behind the projector, with light strips between them
        const NP = 26, panels = new THREE.InstancedMesh(new THREE.RoundedBoxGeometry(1.7, 2.6, 0.18, 3, 0.05), dark, NP * 2), strips = new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 5.6, 0.04), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.2, 2.6) }), NP);
        for (let i = 0; i < NP; i++) {
          const a = Math.PI + (i - NP / 2 + 0.5) * 0.115, x = Math.sin(a) * 9, z = Math.cos(a) * 9, q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a + Math.PI);
          panels.setMatrixAt(i, m4.compose(new THREE.Vector3(x, 1.45, z), q, new THREE.Vector3(1, 1, 1)));
          panels.setMatrixAt(i + NP, m4.compose(new THREE.Vector3(x, 4.15, z), q, new THREE.Vector3(1, 1, 1)));
          const b = a + 0.0575; strips.setMatrixAt(i, m4.makeTranslation(Math.sin(b) * 8.95, 2.8, Math.cos(b) * 8.95));
        }
        panels.receiveShadow = true; scene.add(panels, strips); C.strips = strips;
        const ceil = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.05, 8, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.1, 1.3, 1.4) })); ceil.rotation.x = Math.PI / 2; ceil.position.y = 6.2; scene.add(ceil);
        const ceil2 = new THREE.Mesh(new THREE.TorusGeometry(5.6, 0.04, 8, 128), ceil.material); ceil2.rotation.x = Math.PI / 2; ceil2.position.y = 6.4; scene.add(ceil2);
        // consoles with live readouts
        const sc = document.createElement('canvas'); sc.width = 512; sc.height = 320; C.scrG = sc.getContext('2d');
        C.scrTex = new THREE.CanvasTexture(sc); C.bin.push(C.scrTex);
        const scrMat = new THREE.MeshBasicMaterial({ map: C.scrTex, color: new THREE.Color(1.6, 1.6, 1.6) });
        [-1, 1].forEach((side) => {
          const desk = new THREE.Mesh(new THREE.RoundedBoxGeometry(2.2, 0.9, 0.9, 3, 0.06), metal); desk.position.set(side * 4.3, 0.45, -1.2); desk.rotation.y = -side * 0.5; desk.castShadow = desk.receiveShadow = true; scene.add(desk);
          const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), scrMat); scr.position.set(side * 4.15, 1.45, -1.45); scr.rotation.set(-0.15, -side * 0.5, 0); scene.add(scr);
          const bez = new THREE.Mesh(new THREE.RoundedBoxGeometry(1.75, 1.12, 0.06, 2, 0.02), dark); bez.position.copy(scr.position).add(new THREE.Vector3(side * 0.02, 0, -0.04).applyEuler(scr.rotation)); bez.rotation.copy(scr.rotation); scene.add(bez);
        });
        // cables on the floor
        for (let i = 0; i < 5; i++) {
          const side = i % 2 ? 1 : -1, pts = [new THREE.Vector3(0, 0.05, 0), new THREE.Vector3(side * (1 + R()), 0.04, 0.5 - R()), new THREE.Vector3(side * (2.5 + R()), 0.04, -0.5 - R()), new THREE.Vector3(side * (4 + R() * 0.3), 0.04, -1.3 + R() * 0.2)];
          const cab = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.03 + R() * 0.02, 8, false), dark); cab.castShadow = true; scene.add(cab);
        }
        // the projector: a turned pedestal, an emitter lens and its ring
        const prof = [[0, 0], [1.3, 0], [1.3, 0.08], [1.12, 0.14], [0.92, 0.6], [0.98, 0.66], [0.98, 0.78], [0.86, 0.84], [0.74, 0.96], [0.76, 1.02], [0.52, 1.08], [0.3, 1.1], [0, 1.1]].map((p) => new THREE.Vector2(p[0], p[1]));
        const ped = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), metal); ped.castShadow = ped.receiveShadow = true; scene.add(ped);
        C.lensMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 3, 3.4) });
        const lens = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 16, 0, TAU, 0, Math.PI / 2), C.lensMat); lens.position.y = 1.08; scene.add(lens);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.025, 8, 64), C.lensMat); ring.rotation.x = Math.PI / 2; ring.position.y = 1.04; scene.add(ring);
        // reflective lab floor: dark glossy tiles with fine seams
        C.floorU = { tReflect: { value: null }, textureMatrix: { value: null }, uLP: { value: [0, 1, 2, 3].map(() => new THREE.Vector3(0, -50, 0)) }, uLC: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) }, uFogD: { value: scene.fog.density }, uSeam: { value: new THREE.Vector3(0.2, 0.9, 1) }, uRing: { value: new THREE.Vector2(-1, 0) } };
        const floor = mirrorMesh(X, new THREE.PlaneGeometry(40, 40), new THREE.ShaderMaterial({
          uniforms: C.floorU, vertexShader: MIRROR_VS,
          fragmentShader: 'uniform sampler2D tReflect; uniform float uFogD; uniform vec3 uLP[4]; uniform vec3 uLC[4]; uniform vec3 uSeam; uniform vec2 uRing; varying vec4 vR; varying vec3 vW; varying float vDepth;\n' + GL_NOISE + [
            'void main(){',
            '  vec2 p = vW.xz, f = fract(p / 1.2), id = floor(p / 1.2);',
            '  float seam = 1.0 - smoothstep(0.0, 0.012, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));',
            '  float rough = 0.3 + 0.7 * hash12(id) * 0.4 + 0.2 * vnoise(p * 3.0);',
            '  vec2 nrm = (vec2(vnoise(p * 6.0), vnoise(p * 6.0 + 9.0)) - 0.5) * 0.01;',
            '  vec4 uvr = vR; uvr.xy += nrm * uvr.w;',
            '  float blur = 0.0025 + 0.006 * rough;',
            '  vec3 refl = vec3(0.0);',
            '  for (int i = -2; i <= 2; i++) for (int j = -1; j <= 1; j++) { vec4 q = uvr; q.x += float(j) * blur * q.w; q.y += float(i) * blur * q.w; refl += texture2DProj(tReflect, q).rgb; }',
            '  refl /= 15.0;',
            '  vec3 V = normalize(cameraPosition - vW); float fres = 0.04 + 0.96 * pow(1.0 - clamp(V.y, 0.0, 1.0), 5.0);',
            '  vec3 base = vec3(0.012, 0.016, 0.02) * (0.8 + 0.4 * hash12(id));',
            '  vec3 diff = vec3(0.002, 0.003, 0.004);',
            '  for (int i = 0; i < 4; i++) { vec3 L = uLP[i] - vW; float d2 = dot(L, L) + 0.5; diff += uLC[i] * max(L.y, 0.0) * inversesqrt(d2) / d2; }',
            '  float r = length(p);',
            '  vec3 col = base * diff * 3.0 + refl * mix(0.55, 0.9, fres) * (1.0 - seam * 0.7) + uSeam * seam * 0.04 * exp(-r * 0.25);',
            '  if (uRing.x >= 0.0) col += vec3(0.5, 2.2, 2.6) * uRing.y * exp(-pow((r - uRing.x) * 2.5, 2.0));',
            '  float fo = exp(-uFogD * uFogD * vDepth * vDepth);',
            '  gl_FragColor = vec4(col * fo, 1.0);',
            '}'].join('\n')
        }), 0.5);
        floor.rotation.x = -Math.PI / 2; scene.add(floor); C.bin.push(floor.userData.free);
        // lights: the hologram's own glow, two ceiling fixtures, and a shadow-casting key over the projector
        C.holoL = new THREE.PointLight(0x40e8ff, 40, 12, 2); C.holoL.position.set(0, 3, 0); scene.add(C.holoL);
        C.ceilL = [-1, 1].map((sd) => { const l = new THREE.PointLight(0xcfe8ff, 90, 20, 2); l.position.set(sd * 3, 5.9, 0.5); scene.add(l); return l; });
        const key = new THREE.SpotLight(0xd8ecff, 120, 20, 0.6, 0.7, 2); key.position.set(2.5, 6.2, 3); key.target.position.set(0, 0.5, 0);
        key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.camera.near = 2; key.shadow.camera.far = 14; key.shadow.bias = -0.0004; scene.add(key, key.target);
        scene.add(new THREE.HemisphereLight(0x2a4a5a, 0x050807, 0.15));
        // the projection cone and the containment field
        C.coneU = { uT: C.uT, uK: { value: 1 }, uCol: { value: new THREE.Vector3(0.3, 1.4, 1.6) } };
        const cone = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 0.18, 2.4, 48, 1, true), new THREE.ShaderMaterial({
          uniforms: C.coneU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
          vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vW; varying float vH; void main(){ vH = uv.y; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
          fragmentShader: 'uniform float uT, uK; uniform vec3 uCol; varying vec3 vN; varying vec3 vV; varying vec3 vW; varying float vH;\n' + GL_NOISE + 'void main(){ float f = abs(dot(normalize(vN), vV)); float rays = 0.6 + 0.4 * vnoise(vec2(atan(vW.z, vW.x) * 9.0, uT * 2.0)); float scan = 0.8 + 0.2 * sin(vW.y * 60.0 - uT * 10.0); float a = (pow(f, 2.5) * 0.25 + pow(1.0 - f, 3.0) * 0.12) * rays * scan * smoothstep(1.0, 0.4, vH) * uK; gl_FragColor = vec4(uCol * a, 1.0); }'
        }));
        cone.position.y = 1.1 + 1.2; scene.add(cone);
        C.shellU = { uT: C.uT, uK: { value: 0.5 }, uFr: { value: 0 }, uCol: { value: new THREE.Vector3(0.3, 1.4, 1.6) } };
        C.rig = new THREE.Object3D(); scene.add(C.rig);
        const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.18, 5), new THREE.ShaderMaterial({
          uniforms: C.shellU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
          vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vP; varying vec3 vW; void main(){ vP = position; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
          fragmentShader: 'uniform float uT, uK, uFr; uniform vec3 uCol; varying vec3 vN; varying vec3 vV; varying vec3 vP; varying vec3 vW;\n' + [
            'void main(){ vec3 n = normalize(vP); float f = 1.0 - abs(dot(normalize(vN), vV)); float rim = pow(f, 3.0);',
            '  float lat = asin(n.y), lon = atan(n.z, n.x);',
            '  float grid = smoothstep(0.96, 1.0, abs(cos(lat * 9.0))) + smoothstep(0.96, 1.0, abs(cos(lon * 12.0)));',
            '  float scan = 0.7 + 0.3 * sin(vW.y * 50.0 - uT * 6.0);',
            '  float fr = uFr * (0.5 + 0.5 * sin(dot(n, vec3(0.6, 0.8, 0.0)) * 60.0 - uT * 3.0)) * pow(f, 1.2);',
            '  float a = (rim * 0.8 + grid * 0.05 * rim + fr * 0.35) * scan * uK;',
            '  gl_FragColor = vec4(uCol * a, 1.0); }'].join('\n')
        }));
        C.rig.add(shell);
        // letters, polytope edges and the infection links
        C.atlas = glyphAtlas(S.mode.glyphList.join(''), 'bold 38px monospace'); C.bin.push(C.atlas.tex);
        C.cloud = glyphCloud(C.atlas, 260, { core: 2.2, glow: 1.4, white: 0.45 });
        C.edges = beams(1500, { hot: 1.1, style: 0 });
        C.links = beams(400, { hot: 1.5, style: 3 });
        scene.add(C.cloud.mesh, C.edges.mesh, C.links.mesh);
        C.cloud.mat.uniforms.uScan.value = 0.35; C.edges.mat.uniforms.uScan.value = 0.4; C.links.mat.uniforms.uScan.value = 0.2;
        C.ringMesh = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 6, 128), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 3, 3.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        C.ringMesh.rotation.x = Math.PI / 2; C.ringMesh.position.y = 0.03; C.ringMesh.visible = false; scene.add(C.ringMesh);
        C.sparkPts = points(400, { hard: 0.3 }); C.sparks = sim(400); scene.add(C.sparkPts.mesh);
        C.dust = points(200, {}); scene.add(C.dust.mesh);
        C.motes = Array.from({ length: 160 }, () => [rand(-1.2, 1.2), rand(1.1, 4.6), rand(-1.2, 1.2), rand(0, TAU)]);
      },
      update(S, X, now, dt) {
        const C = HO; if (!C) return;
        autoRes(S, X, C, dt);
        const s = dt / 1000, cam = X.camera, st = S.holding ? S.stage : 0, rm = S.reduceMotion;
        C.t += s; C.uT.value = C.t; C.a4 += dt * S.a4Speed;
        C.load = ease(C.load, S.holding ? 0.25 + 0.25 * st : 0, dt, 2);
        C.push = ease(C.push, st / 3, dt, 0.8);
        C.flare = Math.max(0, C.flare - s);
        if (C.ring >= 0) { C.ring += s * 6; if (C.ring > 14) C.ring = -1; }
        if (C.wipe >= 0) { C.wipe += s / 1.6; if (C.wipe > 1.15) C.wipe = -1; }
        // camera: a slow arc around the projector, with pointer parallax
        C.px = ease(C.px, S.W ? S.ptr.x / S.W - 0.5 : 0, dt, 2); C.py = ease(C.py, S.H ? S.ptr.y / S.H - 0.5 : 0, dt, 2);
        const az = 0.4 * Math.sin(C.t * 0.05) + C.px * 0.45, Rr = 8.4 - 2.0 * C.push;
        cam.position.set(Math.sin(az) * Rr, 2.5 - C.py * 1.1, Math.cos(az) * Rr); cam.lookAt(0, 2.75, 0); cam.updateMatrixWorld();
        aimRig(C.rig, cam, [0, 3.15, 0], 1.45);
        C.rig.rotation.x = C.py * 0.25; C.rig.rotation.y += C.px * 0.35; C.rig.updateMatrixWorld(true); // the hologram turns toward the pointer
        // flicker, overload and reboot
        const flick = rm ? 1 : 1 - (Math.random() < 0.04 + 0.12 * (st >= 3 ? 1 : 0) ? rand(0.2, 0.6) : 0);
        const P = palettes(S, 2.4), c0 = P.pal[0];
        const k = flick * (1 + C.flare);
        C.cloud.mat.uniforms.uCore.value = 2.2 * k; C.cloud.mat.uniforms.uGlow.value = 1.4 * k;
        const wipeY = C.wipe >= 0 ? 3.15 - 1.6 + 3.4 * C.wipe : 1e5;
        [C.cloud, C.edges, C.links].forEach((o) => { o.mat.uniforms.uTime.value = C.t; o.mat.uniforms.uWipe.value = wipeY; });
        C.coneU.uK.value = (0.8 + 1.2 * C.load) * flick; C.coneU.uCol.value.set(c0[0] * 0.5, c0[1] * 0.5, c0[2] * 0.5);
        C.shellU.uK.value = (0.16 + 0.6 * C.load) * flick * (C.wipe >= 0 ? 0.3 : 1); C.shellU.uFr.value = st >= 2 ? 1 : 0; C.shellU.uCol.value.set(c0[0] * 0.5, c0[1] * 0.5, c0[2] * 0.5);
        C.lensMat.color.setRGB(c0[0] * (1 + C.load), c0[1] * (1 + C.load), c0[2] * (1 + C.load));
        C.holoL.color.setRGB(c0[0], c0[1], c0[2]); C.holoL.intensity = (30 + 60 * C.load) * flick;
        fillLetters(S, C.cloud, now, { base: P.base, pal: P.pal, hot: 1.4, size: 0.2 });
        // polytope edges from the engine's wireframe, at the letters' 3D positions
        const act = S.active, E = S.shape.mesh, ew = 0.02 + 0.008 * st, ea = 0.55 + 0.45 * C.load;
        C.edges.begin();
        for (const e of E) { const a = act[e[0]], b = act[e[1]]; if (!a || !b || !a.data.w || !b.data.w) continue; const A = a.data.w, B = b.data.w, inf = a.inf && b.inf, c = inf ? P.pal[a.gen % 3] : c0; C.edges.add(A[0], A[1], A[2], B[0], B[1], B[2], c[0] * 1.1, c[1] * 1.1, c[2] * 1.1, ew, ea * Math.min(a.alpha, b.alpha) * flick, 0); }
        C.edges.end();
        fillLinks(S, C.links, now, { pal: P.pal, width: 0.03 + 0.01 * st });
        // floor: light pools, the discharge ring
        const fu = C.floorU;
        fu.uLP.value[0].copy(C.holoL.position); fu.uLC.value[0].set(c0[0], c0[1], c0[2]).multiplyScalar(C.holoL.intensity * 0.5);
        C.ceilL.forEach((l, i) => { fu.uLP.value[i + 1].copy(l.position); fu.uLC.value[i + 1].set(0.8, 0.9, 1).multiplyScalar(l.intensity); });
        fu.uSeam.value.set(c0[0], c0[1], c0[2]);
        fu.uRing.value.set(C.ring, C.ring >= 0 ? C.ringK * Math.max(0, 1 - C.ring / 14) : 0);
        C.ringMesh.visible = C.ring >= 0; if (C.ring >= 0) { C.ringMesh.scale.setScalar(Math.max(0.01, C.ring)); C.ringMesh.material.opacity = Math.max(0, 1 - C.ring / 14) * C.ringK; }
        // dust in the beam, sparks from the emitter
        C.dust.begin();
        C.motes.forEach((m) => { m[3] += s * 0.3; m[1] += s * 0.08; if (m[1] > 4.6) m[1] = 1.1; const r = 0.15 + (m[1] - 1.1) * 0.45; const x = m[0] * r / 1.2, z = m[2] * r / 1.2; C.dust.add(x + 0.05 * Math.sin(m[3]), m[1], z, c0[0] * 0.5, c0[1] * 0.5, c0[2] * 0.5, 0.012, 0.6); });
        C.dust.end(X);
        if (st >= 3 && !rm && Math.random() < s * 12) { const a = rand(0, TAU); C.sparks.spawn(Math.cos(a) * 0.62, 1.05, Math.sin(a) * 0.62, Math.cos(a) * rand(0.5, 2), rand(0.5, 2.5), Math.sin(a) * rand(0.5, 2), rand(400, 900), rand(0.012, 0.022), [1.5, 3, 3.5], { drag: 0.5, g: 9.81, floor: 0.01, bounce: 0.3 }); }
        C.sparkPts.begin(); C.sparks.step(dt, C.sparkPts); C.sparkPts.end(X);
        if (now - C.lastScr > 250) { C.lastScr = now; hoScreen(C); }
        if (C.grade) { const gu = C.grade.uniforms; gu.uTime.value = C.t; gu.uCA.value = rm ? 0 : 0.0008 + 0.0025 * Math.max(0, st - 1); gu.uGlitch.value = rm ? 0 : (st >= 3 ? 0.15 : 0) + (C.wipe >= 0 && C.wipe < 0.3 ? 0.3 : 0); }
      },
      exit() { if (HO) freeAll(HO); HO = null; }
    }
  }));
})(window.SPHERE);
