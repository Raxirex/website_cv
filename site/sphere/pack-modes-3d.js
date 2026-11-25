/* The Sphere: modes pack (realism edition). Seventeen lit 3D scenes rendered by the three.js layer (sphere-3d.js):
 * a connectome, a candlestick trading floor, Conway's Life in glass, a coronavirus, a dilution refrigerator, fireworks
 * over a harbour city, the deep sea, an eldritch eye, gold sacred geometry, an outrun landscape, a sea storm, an
 * alchemist's bench, a spectrogram, a CAD gearbox, growing ice, a CRT terminal and a chaos mode that borrows them all.
 * Every model, texture and shader is procedural. The letters are drawn in 3D (glyph sprites from an atlas) and the
 * infection (n.inf, n.gen, S.links, S.stage) drives each scene. Shapes change only on tap. */
(function (SP) {
  'use strict';
  const { TAU, rand, pick, clamp } = SP.util;
  const lerp = (a, b, t) => a + (b - a) * t;
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.15;
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const power = (S) => (S.holding ? clamp(S.held / S.STAGES[3], 0, 1) : 0);
  const PV0 = { x: 0, y: 0 };
  const pvel = (S) => S.ptrVel || PV0;
  const pspeed = (S) => { const v = pvel(S); return Math.hypot(v.x, v.y); };
  const HIDE = () => true; // the letters are drawn in 3D; hide the 2D ones
  SP.addLink('pm_none', () => {}); // the webs are drawn in 3D too
  const NOWEB = ['pm_none', 'pm_none', 'pm_none', 'pm_none'];

  /* ---------- keep only symbols the local fonts can draw (missing ones all look like the same box) ---------- */
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
        ['￿', '͸', '\u{10FFFD}', '\u{2FFFF}'].forEach((r) => refSigs.push(sig(r)));
      }
      const s = sig(ch); return !!s && refSigs.indexOf(s) < 0;
    } catch (e) { return true; }
  }
  const G = (str, fallback) => { const ok = Array.from(str).filter(renders); return ok.length >= 4 ? ok.join('') : fallback; };

  /* =====================================================================================================
   * 3D toolkit
   * ===================================================================================================== */
  const SOFT_VS = `
    attribute vec3 col; attribute float sz; attribute float alp;
    uniform float uScale; varying vec3 vCol; varying float vA;
    void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv;
      gl_PointSize = clamp(sz * uScale / max(0.05, -mv.z), 0.0, 220.0); vCol = col; vA = alp; }`;
  const SOFT_FS = `
    varying vec3 vCol; varying float vA; uniform float uHard;
    void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; if (r > 1.0) discard;
      float a = pow(1.0 - r, uHard) * vA; gl_FragColor = vec4(vCol, a); }`;
  const GLYPH_VS = `
    attribute vec3 col; attribute float gi; attribute float sz; attribute float ph; attribute float jit; attribute float alp;
    uniform float uScale; uniform float uTime; varying vec3 vCol; varying float vGi; varying float vA;
    void main(){
      vec3 p = position + jit * vec3(sin(uTime*7.0+ph), cos(uTime*5.3+ph*1.7), sin(uTime*6.1+ph*2.3));
      vec4 mv = modelViewMatrix * vec4(p,1.0); gl_Position = projectionMatrix * mv;
      gl_PointSize = clamp(sz * uScale / max(0.05, -mv.z), 0.0, 200.0); vCol = col; vGi = gi; vA = alp; }`;
  const GLYPH_FS = `
    uniform sampler2D map; uniform float cells; varying vec3 vCol; varying float vGi; varying float vA;
    void main(){ vec2 pc = gl_PointCoord; float c = mod(vGi, cells), r = floor(vGi / cells);
      float a = texture2D(map, vec2((c + pc.x) / cells, 1.0 - (r + pc.y) / cells)).a * vA;
      if (a < 0.02) discard; gl_FragColor = vec4(vCol, a); }`;

  // Pixels per world unit at distance 1 (for perspective-correct point sizes).
  function pxScale(X) { return X.renderer.domElement.height / (2 * Math.tan(X.camera.fov * Math.PI / 360)); }
  function palColors(THREE, pal, k) { return pal.map((c) => new THREE.Color().setHSL(c[0] / 360, c[1] / 100, c[2] / 100).multiplyScalar(k || 1)); }

  /* Soft additive particles (sparks, spikes, embers, dust). One draw call. */
  function particles(X, max, o) {
    const THREE = X.THREE; o = o || {};
    const geo = new THREE.BufferGeometry();
    const P = new Float32Array(max * 3), C = new Float32Array(max * 3), Z = new Float32Array(max), A = new Float32Array(max);
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('col', new THREE.BufferAttribute(C, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('sz', new THREE.BufferAttribute(Z, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alp', new THREE.BufferAttribute(A, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 500 }, uHard: { value: o.hard || 1.6 } }, vertexShader: SOFT_VS, fragmentShader: SOFT_FS,
      transparent: true, depthWrite: false, blending: o.normal ? THREE.NormalBlending : THREE.AdditiveBlending });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = o.order || 5;
    X.scene.add(pts);
    const list = [];
    return {
      pts, list,
      add(x, y, z, vx, vy, vz, r, g, b, size, life, grav, drag, extra) {
        if (list.length >= max) return null;
        const p = { x, y, z, vx, vy, vz, r, g, b, size, life, t: 0, grav: grav || 0, drag: drag === undefined ? 0.985 : drag };
        if (extra) Object.assign(p, extra);
        list.push(p); return p;
      },
      update(X, dt, each) {
        const k = dt / 16.7; let n = 0;
        for (let i = 0; i < list.length; i++) {
          const p = list[i]; p.t += dt;
          if (p.t >= p.life) continue;
          p.vy -= p.grav * k; const dr = Math.pow(p.drag, k); p.vx *= dr; p.vy *= dr; p.vz *= dr;
          p.x += p.vx * k; p.y += p.vy * k; p.z += p.vz * k;
          if (each && each(p) === false) continue;
          const f = 1 - p.t / p.life, fade = p.fadeIn ? Math.min(1, p.t / p.fadeIn) : 1;
          P[n * 3] = p.x; P[n * 3 + 1] = p.y; P[n * 3 + 2] = p.z;
          C[n * 3] = p.r; C[n * 3 + 1] = p.g; C[n * 3 + 2] = p.b;
          Z[n] = p.size * (p.shrink ? 0.3 + 0.7 * f : 1); A[n] = (p.flat ? 1 : f) * fade;
          list[n] = p; n++;
        }
        list.length = n;
        geo.setDrawRange(0, n);
        ['position', 'col', 'sz', 'alp'].forEach((a) => (geo.attributes[a].needsUpdate = true));
        mat.uniforms.uScale.value = pxScale(X);
      }
    };
  }

  /* The letters as glyph sprites in 3D, from a glyph atlas. Positions come from the engine's rotated unit coordinates. */
  function glyphLayer(X, S, o) {
    const THREE = X.THREE, N = 260; o = o || {};
    let list = S.mode.glyphList && S.mode.glyphList.length ? S.mode.glyphList.slice(0, 64) : [];
    if (!list.length) { const seen = {}; for (let i = 0; i < 200 && list.length < 64; i++) { const g = S.glyph(); if (!seen[g]) { seen[g] = 1; list.push(g); } } }
    const cells = Math.ceil(Math.sqrt(list.length)), cs = o.cell || 64;
    const tex = X.canvasTexture(cells * cs, cells * cs, (c) => {
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `${o.weight || ''} ${Math.round(cs * (o.fontScale || 0.6))}px ${o.family || 'monospace'}`;
      c.shadowColor = 'rgba(255,255,255,0.9)'; c.shadowBlur = cs * (o.blur === undefined ? 0.1 : o.blur);
      list.forEach((g, i) => c.fillText(g, (i % cells + 0.5) * cs, (Math.floor(i / cells) + 0.5) * cs));
    });
    tex.encoding = THREE.LinearEncoding; tex.generateMipmaps = true;
    const index = new Map(list.map((g, i) => [g, i]));
    const geo = new THREE.BufferGeometry();
    const arr = { position: new Float32Array(N * 3), col: new Float32Array(N * 3), gi: new Float32Array(N), sz: new Float32Array(N), ph: new Float32Array(N), jit: new Float32Array(N), alp: new Float32Array(N) };
    Object.keys(arr).forEach((k) => geo.setAttribute(k, new THREE.BufferAttribute(arr[k], k === 'position' || k === 'col' ? 3 : 1).setUsage(THREE.DynamicDrawUsage)));
    for (let i = 0; i < N; i++) arr.ph[i] = Math.random() * 100;
    const mat = new THREE.ShaderMaterial({ uniforms: { map: { value: tex }, cells: { value: cells }, uScale: { value: 500 }, uTime: { value: 0 } },
      vertexShader: GLYPH_VS, fragmentShader: GLYPH_FS, transparent: true, depthWrite: false, blending: o.normal ? THREE.NormalBlending : THREE.AdditiveBlending });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 20;
    (o.parent || X.scene).add(pts);
    const pal = palColors(THREE, S.mode.palette), base = palColors(THREE, [S.mode.base || [0, 0, 100]])[0];
    const tmp = new THREE.Color();
    const L = {
      pts, mat, R: o.R || 3, center: o.center || new THREE.Vector3(), size: o.size || 0.32, glow: o.glow || 2.2, dim: o.dim === undefined ? 0.7 : o.dim,
      count: 0,
      pos(n, out) { return out.set(L.center.x + n.rx * L.R, L.center.y - n.ry * L.R, L.center.z + n.rz * L.R); },
      update(S, colorFn) {
        const act = S.active, m = Math.min(N, act.length);
        for (let i = 0; i < m; i++) {
          const n = act[i];
          if (!n.data.wp) n.data.wp = new THREE.Vector3();
          const p = L.pos(n, n.data.wp);
          arr.position[i * 3] = p.x; arr.position[i * 3 + 1] = p.y; arr.position[i * 3 + 2] = p.z;
          if (n.data.gk !== n.g) { n.data.gk = n.g; const k = index.get(n.g); n.data.gi = k === undefined ? (n.g.charCodeAt(0) * 7) % list.length : k; }
          arr.gi[i] = n.data.gi;
          let size = L.size, jit = 0, a = clamp(n.alpha, 0, 1);
          if (n.inf) tmp.copy(pal[n.gen % pal.length]).multiplyScalar(L.glow * (1 + 0.25 * S.stage)); else tmp.copy(base).multiplyScalar(L.dim);
          if (n.inf) size *= 1.2;
          if (colorFn) { const r = colorFn(n, tmp, i); if (r) { if (r.size !== undefined) size = r.size; if (r.jit !== undefined) jit = r.jit; if (r.a !== undefined) a *= r.a; } }
          arr.col[i * 3] = tmp.r; arr.col[i * 3 + 1] = tmp.g; arr.col[i * 3 + 2] = tmp.b;
          arr.sz[i] = size; arr.jit[i] = jit; arr.alp[i] = a;
        }
        L.count = m;
        geo.setDrawRange(0, m);
        Object.keys(arr).forEach((k) => { if (k !== 'ph') geo.attributes[k].needsUpdate = true; });
        mat.uniforms.uScale.value = pxScale(X); mat.uniforms.uTime.value = S.now / 1000;
      }
    };
    return L;
  }

  /* The infection webs in 3D: glowing line segments, optional lightning-style zigzag and travelling pulses.
   * styles[stage] = { k: brightness, zig: zigzag amplitude (world units), pulse: travelling beads }. */
  function webLayer(X, S, styles, sparks) {
    const THREE = X.THREE, MAXL = 260, SEG = 4;
    const geo = new THREE.BufferGeometry();
    const P = new Float32Array(MAXL * SEG * 2 * 3), C = new Float32Array(MAXL * SEG * 2 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(C, 3).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const lines = new THREE.LineSegments(geo, mat); lines.frustumCulled = false; lines.renderOrder = 15;
    X.scene.add(lines);
    const pal = palColors(THREE, S.mode.palette), col = new THREE.Color();
    let seedT = 0;
    return {
      lines,
      update(S) {
        const st = styles[Math.min(S.stage, styles.length - 1)] || {}, now = S.now;
        let v = 0;
        if (now - seedT > 70) seedT = now;
        for (const l of S.links) {
          if (v >= MAXL * SEG * 2) break;
          const A = l.A.data.wp, B = l.B.data.wp; if (!A || !B) continue;
          const grow = clamp((now - l.born) / 260, 0, 1), fade = l.dying ? 1 - (now - l.dying) / 700 : 1;
          if (fade <= 0) continue;
          col.copy(pal[l.gen % pal.length]).multiplyScalar((st.k || 1.2) * fade);
          const segs = st.zig ? SEG : 1;
          let px = A.x, py = A.y, pz = A.z;
          let rs = Math.floor(l.seed * 9999) + Math.floor(seedT / 70) * 131;
          for (let s = 1; s <= segs; s++) {
            const t = s / segs * grow;
            let x = A.x + (B.x - A.x) * t, y = A.y + (B.y - A.y) * t, z = A.z + (B.z - A.z) * t;
            if (st.zig && s < segs) { rs = (rs * 9301 + 49297) % 233280; const j = (rs / 233280 - 0.5) * st.zig; rs = (rs * 9301 + 49297) % 233280; x += j; y += (rs / 233280 - 0.5) * st.zig; z += j * 0.5; }
            P[v * 3] = px; P[v * 3 + 1] = py; P[v * 3 + 2] = pz; C[v * 3] = col.r; C[v * 3 + 1] = col.g; C[v * 3 + 2] = col.b; v++;
            P[v * 3] = x; P[v * 3 + 1] = y; P[v * 3 + 2] = z; C[v * 3] = col.r; C[v * 3 + 1] = col.g; C[v * 3 + 2] = col.b; v++;
            px = x; py = y; pz = z;
          }
          if (st.pulse && sparks && grow >= 1 && Math.random() < 0.05 * st.pulse) {
            sparks.add(A.x, A.y, A.z, (B.x - A.x) / 30, (B.y - A.y) / 30, (B.z - A.z) / 30, col.r * 2, col.g * 2, col.b * 2, 0.12, 480, 0, 1);
          }
        }
        geo.setDrawRange(0, v);
        geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
      }
    };
  }

  /* Cinematographer: slow orbit around a target, parallax from the pointer, a dolly-in while holding. */
  function rig(X, S, st, o) {
    const p = power(S);
    if (st.az === undefined) { st.az = o.az || 0; st.px = 0; st.py = 0; st.d = o.dist; }
    st.az += S.dt * (o.spin === undefined ? 0.00004 : o.spin) * (S.reduceMotion ? 0.3 : 1);
    const inside = S.ptrInside !== false;
    const tx = inside ? S.ptr.x / Math.max(1, S.W) - 0.5 : 0, ty = inside ? S.ptr.y / Math.max(1, S.H) - 0.5 : 0;
    st.px += (tx - st.px) * 0.035; st.py += (ty - st.py) * 0.035;
    st.d += (o.dist * (1 - (o.dolly === undefined ? 0.2 : o.dolly) * p) - st.d) * 0.03;
    const az = st.az + st.px * (o.pa === undefined ? 0.6 : o.pa), el = (o.el === undefined ? 0.2 : o.el) - st.py * (o.pe === undefined ? 0.3 : o.pe);
    const t = o.target;
    X.camera.position.set(t.x + Math.sin(az) * Math.cos(el) * st.d, t.y + Math.sin(el) * st.d, t.z + Math.cos(az) * Math.cos(el) * st.d);
    X.camera.lookAt(t);
  }

  /* Merge (non-indexed) geometries into one: position, normal and uv. */
  function merge(THREE, geos) {
    const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
    let n = 0; parts.forEach((g) => (n += g.attributes.position.count));
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    let o = 0;
    parts.forEach((g) => {
      const c = g.attributes.position.count;
      pos.set(g.attributes.position.array, o * 3);
      if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
      o += c;
    });
    const r = new THREE.BufferGeometry();
    r.setAttribute('position', new THREE.BufferAttribute(pos, 3)); r.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); r.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return r;
  }

  /* Many tubes in one geometry, with a radius profile along each (myelin sheaths, tentacles, cables). */
  function tubes(THREE, curves, segs, radial, rFn) {
    const nv = curves.length * (segs + 1) * radial;
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = [];
    let v = 0;
    const P = new THREE.Vector3(), N = new THREE.Vector3();
    curves.forEach((curve, ci) => {
      const fr = curve.computeFrenetFrames(segs, false), base = v;
      for (let i = 0; i <= segs; i++) {
        const t = i / segs; curve.getPointAt(t, P);
        const r = rFn(t, ci);
        for (let j = 0; j < radial; j++) {
          const a = j / radial * TAU, c = Math.cos(a), s = Math.sin(a);
          N.set(0, 0, 0).addScaledVector(fr.normals[i], c).addScaledVector(fr.binormals[i], s);
          pos[v * 3] = P.x + N.x * r; pos[v * 3 + 1] = P.y + N.y * r; pos[v * 3 + 2] = P.z + N.z * r;
          nor[v * 3] = N.x; nor[v * 3 + 1] = N.y; nor[v * 3 + 2] = N.z; uv[v * 2] = j / radial; uv[v * 2 + 1] = t; v++;
        }
      }
      for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
        const a = base + i * radial + j, b = base + i * radial + (j + 1) % radial, c = a + radial, d = b + radial;
        idx.push(a, c, b, b, c, d);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(nv > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
    return g;
  }

  /* Instance colours also tint the emissive light (so instanced windows, candles and cells can glow individually). */
  function glowInstances(mat, k, emissiveOnly) {
    mat.onBeforeCompile = (sh) => {
      if (emissiveOnly) sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '');
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= vColor * ${(k || 1).toFixed(2)};\n#endif`);
    };
    mat.customProgramCacheKey = () => 'glow' + (k || 1) + (emissiveOnly ? 'e' : '');
    return mat;
  }

  // A tiling normal map from Perlin noise (water ripples, sand, skin pores, brushed metal).
  function noiseNormal(X, size, freq, amp, stretch) {
    const THREE = X.THREE, nz = X.noise, h = new Float32Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size; let s = 0, f = freq, a = 1;
      for (let o = 0; o < 4; o++) { // periodic sampling on a torus so the map tiles
        s += a * nz.noise(Math.cos(u * TAU) * f / (stretch || 1), Math.sin(u * TAU) * f / (stretch || 1), Math.cos(v * TAU) * f + Math.sin(v * TAU) * f * 0.7);
        f *= 2; a *= 0.5;
      }
      h[y * size + x] = s;
    }
    const tex = X.canvasTexture(size, size, (c) => {
      const img = c.createImageData(size, size);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const l = h[y * size + (x + size - 1) % size], r = h[y * size + (x + 1) % size], u = h[((y + size - 1) % size) * size + x], d = h[((y + 1) % size) * size + x];
        let nx = (l - r) * amp, ny = (u - d) * amp, nz2 = 1; const m = Math.hypot(nx, ny, nz2); nx /= m; ny /= m; nz2 /= m;
        const o = (y * size + x) * 4; img.data[o] = (nx * 0.5 + 0.5) * 255; img.data[o + 1] = (ny * 0.5 + 0.5) * 255; img.data[o + 2] = (nz2 * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
      }
      c.putImageData(img, 0, 0);
    });
    tex.encoding = THREE.LinearEncoding; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }
  // A soft cloud / smoke puff texture.
  function puffTexture(X, size, seed) {
    const nz = X.noise;
    const t = X.canvasTexture(size, size, (c) => {
      const img = c.createImageData(size, size);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const u = x / size - 0.5, v = y / size - 0.5, r = Math.hypot(u, v) * 2;
        let n = 0, f = 3, a = 0.5; for (let o = 0; o < 5; o++) { n += a * nz.noise(u * f + seed, v * f - seed, seed * 0.3); f *= 2; a *= 0.5; }
        const al = clamp((1 - r) * 1.4 + n * 1.3 - 0.15, 0, 1) * clamp(1 - r, 0, 1);
        const o = (y * size + x) * 4, l = 200 + n * 120; img.data[o] = img.data[o + 1] = img.data[o + 2] = clamp(l, 0, 255); img.data[o + 3] = al * 255;
      }
      c.putImageData(img, 0, 0);
    });
    return t;
  }
  function hash(n) { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }
  function fib(i, n) { const y = 1 - 2 * (i + 0.5) / n, r = Math.sqrt(1 - y * y), t = i * 2.399963; return [Math.cos(t) * r, y, Math.sin(t) * r]; }
  const v3 = (THREE, a) => new THREE.Vector3(a[0], a[1], a[2]);
  // Common 2D side of a 3D mode: no 2D letters, no 2D webs, no 2D shockwave.
  const base3d = (def) => Object.assign({ links: NOWEB, drawNode: HIDE, fade: 1, count: 80 }, def);

  /* ======================= 1. NEURAL NET: a connectome with myelinated axons ======================= */
  SP.addMode(base3d({
    id: 'neural', name: 'NEURAL NET', glyphs: G('σΣƒ∂∇θλwbx01∫', 'σΣ∂∇θλwbx01'),
    base: [205, 45, 72], palette: [[190, 100, 62], [275, 100, 72], [48, 100, 62], [330, 100, 66]],
    count: 96, pageBg: ['#04081a', '#02030a'],
    shapes: ['sphere', 'cell600', 'buckyball', 'icosahedron', 'gyroid', 'hopf', 'torus', 'helix'],
    init(S) { Object.assign(S.data, { epoch: 0, msg: null }); },
    update(S) { if (S.holding) S.data.epoch = Math.pow(S.held / 1000, 2) * 9; },
    three: {
      init(S, X) {
        const THREE = X.THREE, d = S.data, sc = X.scene, nz = X.noise;
        X.maxPixelRatio = 1.25;
        sc.fog = new THREE.FogExp2(0x03060f, 0.05);
        X.setBloom(0.9, 0.5, 0.55); X.setExposure(0.9);
        const NN = 230, soma = [];
        while (soma.length < NN) { const p = [rand(-1, 1), rand(-1, 1), rand(-1, 1)]; const r = p[0] * p[0] + p[1] * p[1] + p[2] * p[2]; if (r < 1 && r > 0.08) soma.push(new THREE.Vector3(p[0] * 7, p[1] * 4.2, p[2] * 5)); }
        const sg = new THREE.IcosahedronGeometry(1, 2), sp = sg.attributes.position;
        for (let i = 0; i < sp.count; i++) { const x = sp.getX(i), y = sp.getY(i), z = sp.getZ(i), k = 1 + 0.3 * nz.noise(x * 2, y * 2, z * 2); sp.setXYZ(i, x * k, y * k * 1.25, z * k); }
        sg.computeVertexNormals();
        const smat = glowInstances(new THREE.MeshStandardMaterial({ color: 0x5a7598, roughness: 0.32, metalness: 0.05, emissive: 0x4a8ad0, emissiveIntensity: 1 }), 1);
        const som = new THREE.InstancedMesh(sg, smat, NN), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
        soma.forEach((p, i) => { const s = rand(0.035, 0.075); e.set(rand(0, 6), rand(0, 6), rand(0, 6)); q.setFromEuler(e); m4.compose(p, q, new THREE.Vector3(s, s, s)); som.setMatrixAt(i, m4); som.setColorAt(i, new THREE.Color(0.1, 0.1, 0.12)); });
        sc.add(som);
        // axons to the two nearest neighbours (myelin sheaths with nodes of Ranvier), dendrites as short tapering branches
        const ax = [], seen = {};
        soma.forEach((p, i) => {
          soma.map((q2, j) => [j, p.distanceToSquared(q2)]).filter((a) => a[0] !== i).sort((a, b) => a[1] - b[1]).slice(0, 2).forEach(([j]) => {
            const k = Math.min(i, j) + ':' + Math.max(i, j); if (seen[k]) return; seen[k] = 1;
            const b = soma[j], m1 = p.clone().lerp(b, 0.33).add(new THREE.Vector3(rand(-0.6, 0.6), rand(-0.6, 0.6), rand(-0.6, 0.6))), m2 = p.clone().lerp(b, 0.66).add(new THREE.Vector3(rand(-0.6, 0.6), rand(-0.6, 0.6), rand(-0.6, 0.6)));
            ax.push({ c: new THREE.CatmullRomCurve3([p, m1, m2, b]), a: i, b: j });
          });
        });
        const den = [];
        soma.forEach((p) => { for (let k = 0; k < 3; k++) { const dir = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(); den.push(new THREE.CatmullRomCurve3([p, p.clone().addScaledVector(dir, 0.25).add(new THREE.Vector3(rand(-0.1, 0.1), rand(-0.1, 0.1), rand(-0.1, 0.1))), p.clone().addScaledVector(dir, rand(0.45, 0.8))])); } });
        const amat = new THREE.MeshStandardMaterial({ color: 0x8197bd, roughness: 0.42, metalness: 0.1, emissive: 0x060c1c, emissiveIntensity: 1 });
        sc.add(new THREE.Mesh(tubes(THREE, ax.map((a) => a.c), 42, 5, (t) => 0.016 * (0.5 + 0.5 * Math.pow(Math.abs(Math.sin(t * Math.PI * 8)), 0.3))), amat));
        sc.add(new THREE.Mesh(tubes(THREE, den, 8, 4, (t) => 0.02 * (1 - t) + 0.002), amat));
        ax.forEach((a) => { a.pts = []; for (let k = 0; k <= 24; k++) a.pts.push(a.c.getPointAt(k / 24)); });
        sc.add(new THREE.HemisphereLight(0x5070a0, 0x070310, 0.25));
        const l1 = new THREE.PointLight(0x66ccff, 60, 40, 2); l1.position.set(5, 4, 6); sc.add(l1);
        const l2 = new THREE.PointLight(0xb060ff, 45, 40, 2); l2.position.set(-6, -3, -3); sc.add(l2);
        const rim = new THREE.DirectionalLight(0xdfe8ff, 0.6); rim.position.set(-2, 3, -8); sc.add(rim);
        const sparks = particles(X, 1400, { hard: 2.2 });
        d.t3 = { som, soma, ax, act: new Float32Array(NN), sparks, gl: glyphLayer(X, S, { R: 3.1, size: 0.42, glow: 2.6, dim: 0.9 }), cam: {}, l1, l2,
          web: webLayer(X, S, [{ k: 0.9 }, { k: 1.5 }, { k: 2, pulse: 1 }, { k: 2.6, zig: 0.22, pulse: 2 }], sparks), casc: 0, col: new THREE.Color() };
      },
      update(S, X, now, dt) {
        const d = S.data, t = d.t3; if (!t) return;
        rig(X, S, t.cam, { target: new X.THREE.Vector3(0, 0, 0), dist: 13, el: 0.18, spin: 0.00005, dolly: 0.22 });
        t.gl.update(S); t.web.update(S);
        const fire = (a, speed) => { const p0 = a.pts[0]; t.sparks.add(p0.x, p0.y, p0.z, 0, 0, 0, 0.6, 1.4, 2.6, 0.16, 4000, 0, 1, { path: a, k: 0, sp: speed, flat: 1 }); };
        const rate = (S.holding ? 0.6 + S.stage * 1.6 : 0.25) * dt / 16.7;
        for (let r = rate; r > 0; r--) if (Math.random() < r) fire(pick(t.ax), rand(0.6, 1.4));
        if (t.casc > 0) { t.casc -= dt; for (let k = 0; k < 12; k++) fire(pick(t.ax), 2); }
        // the pointer stimulates the neurons it passes
        if (pspeed(S) > 1) { const w = X.fromScreen(S.ptr.x, S.ptr.y, 0); t.soma.forEach((p, i) => { if (p.distanceToSquared(w) < 2.2) t.act[i] = Math.min(4, t.act[i] + 0.25); }); }
        t.sparks.update(X, dt, (p) => {
          if (!p.path) return true;
          p.k += dt * 0.0011 * p.sp; if (p.k >= 1) { t.act[p.path.b] = Math.min(4, t.act[p.path.b] + 1.2); return false; }
          const f = p.k * 24, i = Math.floor(f), a = p.path.pts[i], b = p.path.pts[Math.min(24, i + 1)], u = f - i;
          p.x = a.x + (b.x - a.x) * u; p.y = a.y + (b.y - a.y) * u; p.z = a.z + (b.z - a.z) * u; return true;
        });
        const k = Math.pow(0.95, dt / 16.7);
        for (let i = 0; i < t.act.length; i++) { t.act[i] *= k; const v = 0.1 + t.act[i] * 0.8; t.col.setRGB(v * 0.8, v, v * 1.3); t.som.setColorAt(i, t.col); }
        t.som.instanceColor.needsUpdate = true;
        t.l1.position.set(Math.sin(now * 0.0002) * 7, 4, Math.cos(now * 0.0002) * 7);
      }
    },
    onInfect(S, n) { const t = S.data.t3, p = n.data.wp; if (t && p) for (let k = 0; k < 6; k++) t.sparks.add(p.x, p.y, p.z, rand(-0.03, 0.03), rand(-0.03, 0.03), rand(-0.03, 0.03), 1.5, 1.6, 2.4, 0.1, 500, 0, 0.95); },
    onRelease(S, held) {
      const d = S.data; if (d.t3) d.t3.casc = 900;
      d.msg = { t: S.now, text: held > S.STAGES[3] ? 'loss.backward() · the whole connectome fires · overfitting detected, deploying anyway' : 'loss.backward() · early stopping' };
      return false;
    },
    hud(S) {
      const d = S.data;
      if (S.holding) {
        const e = Math.floor(d.epoch), loss = 2.302 * Math.exp(-d.epoch / 38) + 0.0031 + 0.01 * Math.random() * Math.exp(-d.epoch / 60), acc = Math.min(99.7, 100 - 90 * Math.exp(-d.epoch / 30));
        return `epoch ${e} · loss ${loss.toFixed(4)} · ` + (acc >= 99.7 ? 'accuracy 99.7% (on the training set, obviously)' : `accuracy ${acc.toFixed(1)}%`);
      }
      if (d.msg && S.now - d.msg.t < 5000) return d.msg.text;
      return '86 billion neurons in yours, 230 in this one · hold to train';
    }
  }));

  // Where the pointer ray meets the horizontal plane y = h.
  function groundPoint(X, S, h) {
    const THREE = X.THREE;
    const rc = X._rc || (X._rc = new THREE.Raycaster()), v = X._ndc || (X._ndc = new THREE.Vector2());
    v.set(S.ptr.x / Math.max(1, S.W) * 2 - 1, -(S.ptr.y / Math.max(1, S.H)) * 2 + 1);
    rc.setFromCamera(v, X.camera);
    const out = new THREE.Vector3();
    return rc.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -(h || 0)), out) ? out : null;
  }
  const RBox = (THREE, w, h, d, seg, r) => (THREE.RoundedBoxGeometry ? new THREE.RoundedBoxGeometry(w, h, d, seg, r) : new THREE.BoxGeometry(w, h, d));
  function writeTRS(arr, i, x, y, z, sx, sy, sz) { const o = i * 16; arr[o] = sx; arr[o + 1] = 0; arr[o + 2] = 0; arr[o + 3] = 0; arr[o + 4] = 0; arr[o + 5] = sy; arr[o + 6] = 0; arr[o + 7] = 0; arr[o + 8] = 0; arr[o + 9] = 0; arr[o + 10] = sz; arr[o + 11] = 0; arr[o + 12] = x; arr[o + 13] = y; arr[o + 14] = z; arr[o + 15] = 1; }

  /* ======================= 2. MARKET: a glass candlestick landscape on a mirror floor ======================= */
  const TICKERS = ['SPHR', 'TORUS', 'KLEIN', 'MOBI', 'LRNZ', 'HOPF', 'PHI'];
  SP.addMode(base3d({
    id: 'market', name: 'MARKET', glyphs: G('$€¥₿£₹₽¢₩', '$€¥£'),
    base: [140, 30, 82], palette: [[130, 100, 55], [95, 100, 58], [52, 100, 60]], noHueShift: true,
    count: 64, pageBg: ['#03100a', '#010303'],
    shapes: ['sphere', 'galaxy', 'sunflower', 'helix', 'torus', 'crown', 'cube', 'dodecahedron'],
    init(S) {
      const d = S.data, R = TICKERS.length, C = 48;
      d.rows = TICKERS.map(() => { let p = 100; return Array.from({ length: C }, () => { const o = p; p *= Math.exp(0.0006 + 0.014 * gauss()); return { o, c: p }; }); });
      d.last = 0; d.off = 0; d.crash = -1e9; d.pct = 0; d.rc = R; d.cc = C; d.hover = null;
    },
    update(S, now, dt) {
      const d = S.data;
      d.off += dt / 160;
      if (d.off < 1) return;
      d.off -= 1;
      const since = now - d.crash, crashing = since < 1800;
      const mu = S.holding ? 0.007 + 0.008 * S.stage : crashing ? -0.07 : since < 5000 ? 0.005 : 0.0004;
      d.rows.forEach((row) => { const o = row[row.length - 1].c, c = o * Math.exp(mu + (crashing ? 0.03 : 0.013) * gauss()); row.push({ o, c }); row.shift(); });
      if (S.holding) d.pct = Math.min(420, Math.round((Math.pow(1.95, S.held / 1000) - 1) * 100));
    },
    three: {
      init(S, X) {
        const THREE = X.THREE, d = S.data, sc = X.scene, R = d.rc, C = d.cc;
        X.maxPixelRatio = 1.25;
        X.studioEnvironment(); X.setBloom(0.75, 0.5, 0.7); X.setExposure(0.95);
        sc.fog = new THREE.Fog(0x020604, 18, 60);
        const grid = X.canvasTexture(512, 512, (c, w, h) => { c.fillStyle = '#000'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(60,255,150,0.35)'; c.lineWidth = 2; for (let i = 0; i <= 8; i++) { c.beginPath(); c.moveTo(i * w / 8, 0); c.lineTo(i * w / 8, h); c.stroke(); c.beginPath(); c.moveTo(0, i * h / 8); c.lineTo(w, i * h / 8); c.stroke(); } });
        grid.wrapS = grid.wrapT = THREE.RepeatWrapping; grid.repeat.set(12, 12);
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ color: 0x050807, roughness: 0.08, metalness: 0.9, envMapIntensity: 0.35, transparent: true, opacity: 0.8, emissive: 0xffffff, emissiveMap: grid, emissiveIntensity: 0.12 }));
        floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; sc.add(floor);
        const body = RBox(THREE, 0.55, 1, 0.55, 1, 0.07), wick = new THREE.CylinderGeometry(0.035, 0.035, 1, 6);
        const mat = glowInstances(new THREE.MeshStandardMaterial({ color: 0x101418, roughness: 0.22, metalness: 0.1, transparent: true, opacity: 0.92, emissive: 0xffffff, emissiveIntensity: 0.55, envMapIntensity: 0.25 }), 1);
        const wmat = glowInstances(new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.3, emissive: 0xffffff, emissiveIntensity: 0.7 }), 1);
        const n = R * C;
        const B = new THREE.InstancedMesh(body, mat, n), W = new THREE.InstancedMesh(wick, wmat, n);
        B.castShadow = true; B.instanceMatrix.setUsage(THREE.DynamicDrawUsage); W.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        for (let i = 0; i < n; i++) { B.setColorAt(i, new THREE.Color(0.2, 1, 0.4)); W.setColorAt(i, new THREE.Color(0.2, 1, 0.4)); }
        const pmat = glowInstances(new THREE.MeshStandardMaterial({ color: 0x0c1014, roughness: 0.08, metalness: 0.3, emissive: 0xffffff, emissiveIntensity: 0.05, envMapIntensity: 0.5 }), 1);
        const Pi = new THREE.InstancedMesh(RBox(THREE, 0.5, 1, 0.5, 1, 0.03), pmat, n); Pi.instanceMatrix.setUsage(THREE.DynamicDrawUsage); Pi.instanceColor = B.instanceColor;
        sc.add(B, W, Pi);
        // the reflection: the same instances mirrored under the semi-transparent floor
        const mirror = new THREE.Group(); mirror.scale.y = -1; sc.add(mirror);
        const mm = mat.clone(); mm.opacity = 0.22; glowInstances(mm, 1);
        const B2 = new THREE.InstancedMesh(body, mm, n); B2.instanceMatrix = B.instanceMatrix; B2.instanceColor = B.instanceColor; mirror.add(B2);
        // LED ticker wall
        const led = document.createElement('canvas'); led.width = 2048; led.height = 64;
        const lt = new THREE.CanvasTexture(led); lt.encoding = THREE.sRGBEncoding;
        const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 1.25), new THREE.MeshBasicMaterial({ map: lt, color: new THREE.Color(2.2, 2.2, 2.2), transparent: true }));
        wall.position.set(0, 9, -40); sc.add(wall);
        const frame = new THREE.Mesh(new THREE.BoxGeometry(40.6, 1.7, 0.4), new THREE.MeshStandardMaterial({ color: 0x111316, roughness: 0.4, metalness: 0.8 })); frame.position.set(0, 9, -40.25); sc.add(frame);
        const key = new THREE.DirectionalLight(0xdff6ff, 1.1); key.position.set(-8, 18, 10); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
        Object.assign(key.shadow.camera, { left: -14, right: 14, top: 14, bottom: -30, near: 1, far: 60 }); key.target.position.set(0, 0, -14); sc.add(key, key.target);
        sc.add(new THREE.HemisphereLight(0x5a8a70, 0x020302, 0.35));
        d.t3 = { B, W, Pi, n, led, lt, ltx: 0, ltT: 0, cam: {}, gl: glyphLayer(X, S, { R: 2.4, center: new THREE.Vector3(0, 7.5, -12), size: 0.5, glow: 2.4 }), sp: particles(X, 800), up: new THREE.Color(0.15, 1.1, 0.45), dn: new THREE.Color(1.3, 0.12, 0.15), tc: new THREE.Color(), fall: [] };
        d.t3.web = webLayer(X, S, [{ k: 0.8 }, { k: 1.4 }, { k: 1.8, pulse: 1 }, { k: 2.4, zig: 0.3, pulse: 1.5 }], d.t3.sp);
      },
      update(S, X, now, dt) {
        const d = S.data, t = d.t3; if (!t) return;
        rig(X, S, t.cam, { target: new X.THREE.Vector3(0, 3.5, -13), dist: 28, el: 0.42, spin: 0, pa: 0.9, pe: 0.25, dolly: 0.2 });
        t.gl.update(S); t.web.update(S);
        const R = d.rc, C = d.cc, M = t.B.instanceMatrix.array, WM = t.W.instanceMatrix.array, PM = t.Pi.instanceMatrix.array, ct = (now - d.crash) / 1000;
        const hp = groundPoint(X, S, 0);
        let hov = null;
        for (let r = 0; r < R; r++) {
          const row = d.rows[r], x = (r - (R - 1) / 2) * 1.5;
          for (let c = 0; c < C; c++) {
            const k = row[c], i = r * C + c, z = -(C - 1 - c + d.off) * 0.95 + 2;
            const y0 = 1 + 9 * Math.log(Math.max(1e-3, k.o) / 100) + 4, y1 = 1 + 9 * Math.log(Math.max(1e-3, k.c) / 100) + 4;
            const lo = Math.max(0.1, Math.min(y0, y1)), hi = Math.max(lo + 0.08, Math.max(y0, y1));
            let yy = (lo + hi) / 2, hh = hi - lo;
            if (ct > 0 && ct < 3.2) { // the crash: everything drops to the floor, then rebuilds
              const dl = hash(i) * 0.4, tt = Math.max(0, ct - dl), fallen = Math.max(hh / 2, yy - 0.5 * 30 * tt * tt), back = smooth((ct - 2.2) / 1);
              yy = lerp(fallen, yy, back);
            }
            writeTRS(M, i, x, yy, z, 1, hh, 1);
            writeTRS(WM, i, x, yy, z, 1, hh + 0.6 + hash(i * 3) * 0.8, 1);
            const pb = Math.max(0.01, yy - hh / 2 - 0.35); writeTRS(PM, i, x, pb / 2, z, 1, pb, 1);
            const up = k.c >= k.o;
            t.tc.copy(up ? t.up : t.dn);
            if (ct > 0 && ct < 3.6) t.tc.copy(t.dn);
            if (hp && Math.abs(hp.x - x) < 0.75 && Math.abs(hp.z - z) < 0.48) { t.tc.multiplyScalar(2.5); hov = { r, k }; }
            t.B.setColorAt(i, t.tc); t.W.setColorAt(i, t.tc);
          }
        }
        d.hover = hov;
        t.B.instanceMatrix.needsUpdate = true; t.W.instanceMatrix.needsUpdate = true; t.Pi.instanceMatrix.needsUpdate = true; t.B.instanceColor.needsUpdate = true; t.W.instanceColor.needsUpdate = true;
        // LED ticker
        if (now - t.ltT > 50) {
          t.ltT = now; const c = t.led.getContext('2d'); c.fillStyle = '#020403'; c.fillRect(0, 0, 2048, 64);
          c.font = 'bold 40px monospace'; c.textBaseline = 'middle';
          t.ltx -= 6; let x = t.ltx;
          for (let r = 0; x < 2048; r++) {
            const row = d.rows[r % R], k = row[C - 1], ch = (k.c / row[C - 2].c - 1) * 100, s = `${TICKERS[r % R]} ${k.c.toFixed(2)} ${ch >= 0 ? '▲' : '▼'}${Math.abs(ch).toFixed(2)}%    `;
            const w = c.measureText(s).width;
            if (x + w > 0) { c.fillStyle = ch >= 0 ? '#3dff8a' : '#ff4458'; c.fillText(s, x, 34); }
            x += w; if (r === R - 1 && x < 0) t.ltx = x;
          }
          c.fillStyle = 'rgba(0,0,0,0.45)'; for (let y = 0; y < 64; y += 4) c.fillRect(0, y, 2048, 1); // LED rows
          t.lt.needsUpdate = true;
        }
        if (S.holding && Math.random() < 0.3 * S.stage) { const r = Math.floor(rand(0, R)); t.sp.add((r - (R - 1) / 2) * 1.5, 6, 2, rand(-0.01, 0.01), 0.05, 0, 0.3, 2, 0.8, 0.14, 1200, 0, 0.99); }
        t.sp.update(X, dt);
      }
    },
    onRelease(S, held, pw) {
      const d = S.data; d.crash = S.now; d.peak = d.pct;
      const t = d.t3; if (t) for (let k = 0; k < 160; k++) t.sp.add(rand(-5, 5), rand(4, 9), rand(-20, 2), rand(-0.03, 0.03), 0, rand(-0.03, 0.03), 2, 0.2, 0.25, 0.12, 1600, 0.004, 0.99);
      return false;
    },
    hud(S) {
      const d = S.data, t = S.now - d.crash;
      if (d.hover && !S.holding) { const k = d.hover.k; return `${TICKERS[d.hover.r]} · O ${k.o.toFixed(2)} C ${k.c.toFixed(2)} · ${((k.c / k.o - 1) * 100).toFixed(2)}%`; }
      if (S.holding) return d.pct >= 420 ? 'SPHERE/USD +420% · circuit breaker engaged · still holding' : `SPHERE/USD +${d.pct}% · bull run`;
      if (t < 2600) return `SPHERE/USD −${(69 + (d.peak || 0) / 100).toFixed(1)}% · liquidity is a social construct`;
      if (t < 6000) return 'dead cat bounce · past performance ≠ future letters';
      return 'SPHERE/USD flat · hover a candle for its quote · hold to pump';
    }
  }));

  /* ======================= 3. GAME OF LIFE: glass cells on a lit board ======================= */
  const GLIDER = [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]], RPENT = [[1, 0], [2, 0], [0, 1], [1, 1], [1, 2]], LWSS = [[1, 0], [4, 0], [0, 1], [0, 2], [4, 2], [0, 3], [1, 3], [2, 3], [3, 3]];
  const GOSPER = [[24, 0], [22, 1], [24, 1], [12, 2], [13, 2], [20, 2], [21, 2], [34, 2], [35, 2], [11, 3], [15, 3], [20, 3], [21, 3], [34, 3], [35, 3], [0, 4], [1, 4], [10, 4], [16, 4], [20, 4], [21, 4], [0, 5], [1, 5], [10, 5], [14, 5], [16, 5], [17, 5], [22, 5], [24, 5], [10, 6], [16, 6], [24, 6], [11, 7], [15, 7], [12, 8], [13, 8]];
  const LGW = 96, LGH = 64, LCS = 0.2;
  function lifeStamp(d, pat, cx, cy, fx, fy) {
    let w = 0, h = 0; pat.forEach((p) => { w = Math.max(w, p[0]); h = Math.max(h, p[1]); });
    pat.forEach((p) => { const x = ((cx + (fx < 0 ? w - p[0] : p[0])) % LGW + LGW) % LGW, y = ((cy + (fy < 0 ? h - p[1] : p[1])) % LGH + LGH) % LGH; d.a[y * LGW + x] = 1; });
  }
  function lifeStep(d) {
    const a = d.a, b = d.b; let pop = 0;
    for (let y = 0; y < LGH; y++) {
      const ym = ((y - 1 + LGH) % LGH) * LGW, y0 = y * LGW, yp = ((y + 1) % LGH) * LGW;
      for (let x = 0; x < LGW; x++) {
        const xm = x === 0 ? LGW - 1 : x - 1, xp = x === LGW - 1 ? 0 : x + 1;
        const n = a[ym + xm] + a[ym + x] + a[ym + xp] + a[y0 + xm] + a[y0 + xp] + a[yp + xm] + a[yp + x] + a[yp + xp];
        const i = y0 + x, alive = n === 3 || (n === 2 && a[i] === 1);
        b[i] = alive ? 1 : 0; if (alive) { pop++; d.age[i] = Math.min(255, d.age[i] + 1); d.heat[i] = 1; } else { d.age[i] = 0; d.heat[i] *= 0.72; }
      }
    }
    d.a = b; d.b = a; d.pop = pop; d.gen++;
  }
  const cellOf = (p) => [Math.floor(p.x / LCS + LGW / 2), Math.floor(p.z / LCS + LGH / 2)];
  SP.addMode(base3d({
    id: 'life', name: 'GAME OF LIFE', glyphs: G('■□▪▫▣▤▥▦▧▨▩', '■□▪▫'),
    base: [120, 25, 78], palette: [[120, 100, 62], [80, 100, 62], [165, 100, 60]], noHueShift: true,
    count: 64, pageBg: ['#031208', '#000302'],
    shapes: ['sphere', 'menger', 'hilbert', 'sierpinski', 'torus', 'cube', 'cell16', 'helix'],
    init(S) {
      const d = S.data, N = LGW * LGH;
      Object.assign(d, { a: new Uint8Array(N), b: new Uint8Array(N), age: new Uint8Array(N), heat: new Float32Array(N), gen: 0, pop: 0, lastStep: 0, lastSeed: 0, dirty: true });
      for (let p = 0; p < 10; p++) { const x0 = Math.floor(rand(0, LGW - 14)), y0 = Math.floor(rand(0, LGH - 14)); for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) if (Math.random() < 0.38) d.a[(y0 + y) * LGW + x0 + x] = 1; }
    },
    update(S, now) {
      const d = S.data;
      if (now - d.lastStep > (S.holding ? 75 : 120)) { d.lastStep = now; lifeStep(d); d.dirty = true; }
      if (now - d.lastSeed > 4500 || d.pop < 150) { d.lastSeed = now; lifeStamp(d, Math.random() < 0.5 ? RPENT : GLIDER, Math.floor(rand(0, LGW)), Math.floor(rand(0, LGH)), pick([1, -1]), pick([1, -1])); }
    },
    three: {
      init(S, X) {
        const THREE = X.THREE, d = S.data, sc = X.scene, N = LGW * LGH;
        X.maxPixelRatio = 1.25; X.studioEnvironment(); X.setBloom(0.6, 0.4, 0.8); X.setExposure(0.95);
        sc.fog = new THREE.Fog(0x010402, 16, 40);
        const board = X.canvasTexture(1024, 683, (c, w, h) => {
          c.fillStyle = '#0b120e'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(120,255,170,0.22)'; c.lineWidth = 1;
          for (let x = 0; x <= LGW; x++) { c.beginPath(); c.moveTo(x / LGW * w, 0); c.lineTo(x / LGW * w, h); c.stroke(); }
          for (let y = 0; y <= LGH; y++) { c.beginPath(); c.moveTo(0, y / LGH * h); c.lineTo(w, y / LGH * h); c.stroke(); }
        });
        const plate = new THREE.Mesh(RBox(THREE, LGW * LCS + 0.6, 0.3, LGH * LCS + 0.6, 2, 0.1), [
          new THREE.MeshStandardMaterial({ color: 0x0b0f0d, roughness: 0.35, metalness: 0.7 })]);
        plate.position.y = -0.16; plate.receiveShadow = true; sc.add(plate);
        const top = new THREE.Mesh(new THREE.PlaneGeometry(LGW * LCS, LGH * LCS), new THREE.MeshStandardMaterial({ map: board, roughness: 0.25, metalness: 0.5, envMapIntensity: 0.4 }));
        top.rotation.x = -Math.PI / 2; top.position.y = 0.002; top.receiveShadow = true; sc.add(top);
        const mat = glowInstances(new THREE.MeshStandardMaterial({ roughness: 0.18, metalness: 0.2, color: 0x223028, emissive: 0xffffff, emissiveIntensity: 0.32, envMapIntensity: 0.7 }), 1);
        const cells = new THREE.InstancedMesh(RBox(THREE, LCS * 0.86, 1, LCS * 0.86, 1, 0.03), mat, N);
        cells.castShadow = true; cells.receiveShadow = true; cells.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        for (let i = 0; i < N; i++) cells.setColorAt(i, new THREE.Color(0, 0, 0));
        sc.add(cells);
        const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(6, 14, 8); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
        Object.assign(key.shadow.camera, { left: -11, right: 11, top: 8, bottom: -8, near: 2, far: 40 }); key.shadow.bias = -0.0005; sc.add(key);
        sc.add(new THREE.HemisphereLight(0x8fffc0, 0x020403, 0.3));
        const sp = particles(X, 600);
        d.t3 = { cells, cam: {}, gl: glyphLayer(X, S, { R: 2.3, center: new THREE.Vector3(0, 3.4, 0), size: 0.42 }), sp, c: new THREE.Color(), h: new Float32Array(N) };
        d.t3.web = webLayer(X, S, [{ k: 0.9 }, { k: 1.4 }, { k: 1.8, pulse: 1 }, { k: 2.3, pulse: 2 }], sp);
      },
      update(S, X, now, dt) {
        const d = S.data, t = d.t3; if (!t) return;
        rig(X, S, t.cam, { target: new X.THREE.Vector3(0, 0.6, 0), dist: 17, el: 0.72, spin: 0.00003, pa: 0.7, pe: 0.3 });
        t.gl.update(S); t.web.update(S); t.sp.update(X, dt);
        if (pspeed(S) > 0.6) { const g = groundPoint(X, S, 0); if (g) { const [cx, cy] = cellOf(g); for (let k = 0; k < 3; k++) { const x = cx + Math.floor(rand(-2, 3)), y = cy + Math.floor(rand(-2, 3)); if (x >= 0 && x < LGW && y >= 0 && y < LGH) d.a[y * LGW + x] = 1; } d.dirty = true; } }
        // ease every cell's height towards alive (1) or a low ember; writes straight into the instance arrays
        const M = t.cells.instanceMatrix.array, CA = t.cells.instanceColor.array, k = 1 - Math.pow(0.8, dt / 16.7);
        let m = 0; // only live and still-cooling cells are drawn (packed to the front of the instance arrays)
        for (let y = 0; y < LGH; y++) for (let x = 0; x < LGW; x++) {
          const i = y * LGW + x, want = d.a[i] ? 0.25 + Math.min(0.5, d.age[i] * 0.02) : d.heat[i] * 0.05;
          t.h[i] += (want - t.h[i]) * k;
          const h = t.h[i];
          if (h < 0.004) continue;
          writeTRS(M, m, (x - LGW / 2 + 0.5) * LCS, h / 2, (y - LGH / 2 + 0.5) * LCS, 1, h, 1);
          const ag = Math.min(1, d.age[i] / 30), al = d.a[i];
          CA[m * 3] = al ? 0.15 + 0.6 * ag : 1.2 * d.heat[i]; CA[m * 3 + 1] = al ? 1.3 - 0.4 * ag : 0.45 * d.heat[i]; CA[m * 3 + 2] = al ? 0.6 + 0.3 * ag : 0.1 * d.heat[i];
          m++;
        }
        t.cells.count = m; t.cells.instanceMatrix.needsUpdate = true; t.cells.instanceColor.needsUpdate = true;
      }
    },
    onInfect(S, n) {
      const d = S.data, s = S.seed || n, p = n.data.wp; if (!p) return;
      const [cx, cy] = cellOf(p);
      lifeStamp(d, GLIDER, cx, cy, n.sx >= s.sx ? 1 : -1, n.sy >= s.sy ? 1 : -1);
      if (d.t3) d.t3.sp.add(p.x, p.y, p.z, 0, -0.05, 0, 0.5, 2, 1, 0.12, 900, 0, 1);
    },
    onRelease(S, held) {
      const d = S.data;
      if (held > S.STAGES[3] && S.seed && S.seed.data.wp) { const [cx, cy] = cellOf(S.seed.data.wp); lifeStamp(d, GOSPER, cx - 18, cy - 4, 1, 1); d.gun = S.now; }
      S.active.forEach((n) => { if (n.inf && n.data.wp && Math.random() < 0.5) { const [cx, cy] = cellOf(n.data.wp); lifeStamp(d, LWSS, cx, cy, n.sx > S.cx ? 1 : -1, 1); } });
      return false;
    },
    hud(S) {
      const d = S.data;
      if (d.gun && S.now - d.gun < 6000) return `Gosper glider gun deployed · gen ${d.gen} · pop ${d.pop} · unbounded growth from 36 cells`;
      return `gen ${d.gen} · pop ${d.pop} · B3/S23 · drag to sow cells · Turing-complete, emotionally incomplete`;
    }
  }));

  // Orient instance i on a sphere: position c + n*r, local +Y along n, uniform scale s.
  function placeOnSphere(THREE, mesh, i, c, n, r, s, twist) {
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    if (twist) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), twist));
    mesh.setMatrixAt(i, new THREE.Matrix4().compose(c.clone().addScaledVector(n, r), q, new THREE.Vector3(s, s, s)));
  }

  /* ======================= 4. VIRUS: a coronavirus virion in fluid ======================= */
  SP.addMode(base3d({
    id: 'virus', name: 'VIRUS', glyphs: 'ACGU',
    base: [90, 45, 72], palette: [[95, 100, 52], [320, 95, 62], [60, 100, 55]],
    count: 80, pageBg: ['#0a1d1f', '#020708'],
    shapes: ['urchin', 'icosahedron', 'buckyball', 'rhombic_triacontahedron', 'sphere', 'dodecahedron', 'cell600'],
    init(S) { S.data.immune = -1e9; },
    three: {
      init(S, X) {
        const THREE = X.THREE, d = S.data, sc = X.scene, nz = X.noise;
        X.maxPixelRatio = 1.25; X.studioEnvironment(); X.setBloom(0.55, 0.6, 0.8); X.setExposure(1.0);
        sc.fog = new THREE.FogExp2(0x0a1d1f, 0.055);
        sc.add(new THREE.Mesh(new THREE.SphereGeometry(150, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
          vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
          fragmentShader: 'varying vec3 vP; void main(){ vec3 c = mix(vec3(0.01,0.04,0.045), vec3(0.05,0.15,0.16), smoothstep(-0.6, 0.8, vP.y)); gl_FragColor = vec4(c, 1.0); }' })));
        const core = new THREE.IcosahedronGeometry(1, 5), cp = core.attributes.position;
        for (let i = 0; i < cp.count; i++) { const x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i), k = 1 + 0.03 * nz.noise(x * 4, y * 4, z * 4) + 0.012 * nz.noise(x * 14, y * 14, z * 14); cp.setXYZ(i, x * k, y * k, z * k); }
        core.computeVertexNormals();
        const coreMat = new THREE.MeshPhysicalMaterial({ color: 0x9aa4aa, roughness: 0.62, clearcoat: 0.35, clearcoatRoughness: 0.4, sheen: new THREE.Color(0x2a4850), envMapIntensity: 0.5 });
        const prof = [[0.03, 0], [0.024, 0.1], [0.028, 0.16], [0.07, 0.2], [0.09, 0.235], [0.075, 0.27], [0.03, 0.295], [0, 0.3]].map((p) => new THREE.Vector2(p[0], p[1]));
        const spikeG = new THREE.LatheGeometry(prof, 12);
        const spikeMat = glowInstances(new THREE.MeshStandardMaterial({ color: 0xc23a2c, roughness: 0.45, metalness: 0.05, emissive: 0xffffff, emissiveIntensity: 1, envMapIntensity: 0.6 }), 1, true);
        const bumpG = new THREE.SphereGeometry(0.035, 10, 8), bumpMat = new THREE.MeshStandardMaterial({ color: 0xe39a33, roughness: 0.5 });
        const virions = [[0, 0, 0, 1.6], [-5.5, 1.6, -7, 1.25], [4.8, -2.2, -9, 1.05], [-3.4, -2.8, -3.5, 0.8], [6.5, 3.2, -14, 1.45], [-8, -4, -16, 1.2]].map((v, vi) => {
          const g = new THREE.Group(); g.position.set(v[0], v[1], v[2]); sc.add(g);
          const r = v[3], m = new THREE.Mesh(core, coreMat); m.scale.setScalar(r); m.castShadow = vi === 0; m.receiveShadow = vi === 0; g.add(m);
          const NS = 74, sp = new THREE.InstancedMesh(spikeG, spikeMat, NS), C0 = new THREE.Vector3();
          for (let i = 0; i < NS; i++) { const f = fib(i, NS); const n = new THREE.Vector3(f[0] + rand(-0.05, 0.05), f[1], f[2]).normalize(); placeOnSphere(THREE, sp, i, C0, n, r * 0.97, r * rand(1.6, 1.9), rand(0, 6)); sp.setColorAt(i, new THREE.Color(0, 0, 0)); }
          sp.castShadow = vi === 0; g.add(sp);
          const NB = 46, bm = new THREE.InstancedMesh(bumpG, bumpMat, NB);
          for (let i = 0; i < NB; i++) { const n = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(); placeOnSphere(THREE, bm, i, C0, n, r, r * rand(0.8, 1.3)); }
          g.add(bm);
          g.rotation.set(rand(0, 6), rand(0, 6), 0);
          return { g, sp, r, spin: rand(0.00004, 0.0001) };
        });
        const key = new THREE.DirectionalLight(0xfff1e0, 2.4); key.position.set(4, 6, 6); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
        Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 2, far: 20 }); key.shadow.bias = -0.001; sc.add(key);
        const rim = new THREE.DirectionalLight(0x6fd8ff, 1.6); rim.position.set(-6, 2, -6); sc.add(rim);
        sc.add(new THREE.HemisphereLight(0x5fa0a0, 0x0a0806, 0.35));
        // antibodies (IgG: a Y of three lobes), parked inside the hero until released
        const lobe = (len, ang) => { const c = new THREE.CylinderGeometry(0.04, 0.035, len, 8); c.translate(0, len / 2, 0); c.rotateZ(ang); return c; };
        const yg = merge(THREE, [lobe(0.18, Math.PI), lobe(0.2, 0.6), lobe(0.2, -0.6)]); yg.computeVertexNormals();
        const ab = new THREE.InstancedMesh(yg, new THREE.MeshStandardMaterial({ color: 0xe9e2cf, roughness: 0.5, emissive: 0x403828, emissiveIntensity: 0.4 }), 90);
        ab.instanceMatrix.setUsage(THREE.DynamicDrawUsage); ab.count = 0; virions[0].g.add(ab);
        const motes = particles(X, 900, { normal: true, hard: 1.2, order: 2 });
        for (let i = 0; i < 900; i++) motes.add(rand(-14, 14), rand(-9, 9), rand(-22, 6), rand(-0.004, 0.004), rand(-0.004, 0.004), 0, 0.45, 0.62, 0.6, rand(0.03, 0.09), 1e12, 0, 1, { flat: 1 });
        const bokeh = particles(X, 40, { hard: 2.5, order: 30 });
        for (let i = 0; i < 40; i++) bokeh.add(rand(-6, 6), rand(-4, 4), rand(5, 8), rand(-0.002, 0.002), rand(-0.002, 0.002), 0, 0.05, 0.09, 0.09, rand(0.6, 1.4), 1e12, 0, 1, { flat: 1 });
        const sp = particles(X, 500);
        d.t3 = { virions, ab, abs: [], motes, bokeh, sp, cam: {}, gl: glyphLayer(X, S, { R: 3.4, size: 0.34, family: 'monospace', weight: 'bold' }), c: new THREE.Color(), m4: new THREE.Matrix4(), q: new THREE.Quaternion(), v: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) };
        d.t3.web = webLayer(X, S, [{ k: 0.8 }, { k: 1.3 }, { k: 1.7, pulse: 1 }, { k: 2.2, zig: 0.18, pulse: 1.5 }], sp);
      },
      update(S, X, now, dt) {
        const d = S.data, t = d.t3; if (!t) return;
        rig(X, S, t.cam, { target: new X.THREE.Vector3(0, 0, 0), dist: 9, el: 0.12, spin: 0.00003, dolly: 0.25 });
        const pv = pvel(S);
        t.virions.forEach((v, i) => { v.g.rotation.y += dt * v.spin + (i === 0 && S.holding ? pv.x * 0.002 : 0); v.g.rotation.x += dt * v.spin * 0.5 + (i === 0 && S.holding ? pv.y * 0.002 : 0); v.g.position.y += Math.sin(now * 0.0004 + i) * 0.002; });
        t.gl.update(S); t.web.update(S); t.sp.update(X, dt);
        // the hero's spikes light up as the infection spreads
        const frac = S.active.length ? S.infected / S.active.length : 0, hero = t.virions[0].sp;
        for (let i = 0; i < hero.count; i++) { const on = S.holding && i / hero.count < frac; t.c.setRGB(on ? 0.8 : 0, on ? 0.06 : 0, on ? 0.3 : 0); hero.setColorAt(i, t.c); }
        hero.instanceColor.needsUpdate = true;
        const w = X.fromScreen(S.ptr.x, S.ptr.y, 0), sp = pspeed(S);
        t.motes.update(X, dt, (p) => { if (sp > 1) { const dx = p.x - w.x, dy = p.y - w.y, r2 = dx * dx + dy * dy; if (r2 < 4 && Math.abs(p.z) < 3) { p.vx += dx * 0.002; p.vy += dy * 0.002; } } p.vx *= 0.99; p.vy *= 0.99; return true; });
        t.bokeh.update(X, dt);
        // antibodies: fly in, dock on the membrane, stay docked
        if (t.abs.length) {
          const M = t.ab.instanceMatrix, r = t.virions[0].r;
          t.abs.forEach((a, i) => {
            const k = smooth((now - a.t) / 1400);
            t.v.copy(a.from).lerp(a.to, k);
            t.q.setFromUnitVectors(t.up, a.n.clone().negate()); t.m4.compose(t.v, t.q, new X.THREE.Vector3(r * 0.9, r * 0.9, r * 0.9)); t.ab.setMatrixAt(i, t.m4);
          });
          t.ab.count = t.abs.length; M.needsUpdate = true;
          if (now - d.immune > 9000) { t.abs = []; t.ab.count = 0; }
        }
      }
    },
    onInfect(S, n) { const t = S.data.t3, p = n.data.wp; if (t && p) for (let k = 0; k < 4; k++) t.sp.add(p.x, p.y, p.z, rand(-0.02, 0.02), rand(-0.02, 0.02), rand(-0.02, 0.02), 1.6, 0.3, 1.2, 0.12, 600, 0, 0.96); },
    onRelease(S) {
      const d = S.data, t = d.t3; d.immune = S.now;
      if (t) {
        const THREE = window.THREE, r = t.virions[0].r; t.abs = [];
        for (let i = 0; i < 60; i++) { const f = fib(i, 60), n = new THREE.Vector3(f[0], f[1], f[2]); t.abs.push({ n, from: n.clone().multiplyScalar(r * rand(5, 9)).add(new THREE.Vector3(rand(-2, 2), rand(-2, 2), rand(-2, 2))), to: n.clone().multiplyScalar(r * 1.42), t: S.now + rand(0, 700) }); }
      }
      return false;
    },
    hud(S) {
      if (S.holding) return `R₀ = ${(1.2 + S.stage * 1.4).toFixed(1)} · cases ${S.infected} · spike proteins binding ACE2`;
      if (S.now - S.data.immune < 6000) return 'IgG antibodies docking on the spike proteins · neutralised';
      return '≈ 120 nm across · 30 kb of RNA · nothing personal, it is just copying';
    }
  }));

  /* ======================= 5. QUANTUM: a dilution refrigerator with superposed qubits ======================= */
  SP.addMode(base3d({
    id: 'quantum', name: 'QUANTUM', glyphs: G('ψΨφℏ⊗†01αβ⟩⟨χ', 'ψΨφ01αβ'),
    base: [250, 60, 82], palette: [[200, 100, 72], [280, 100, 74], [330, 100, 72]], noHueShift: true,
    count: 64, pageBg: ['#0c0a14', '#020205'],
    shapes: ['atom', 'sphere', 'hopf', 'clifford_torus', 'harmonic', 'cell24', 'tesseract', 'lissajous'],
    init(S) { const d = S.data; d.tun = -1e9; d.collapsed = 0; },
    update(S, now, dt) {
      const d = S.data, act = S.active, N = act.length, t = d.t3;
      let col = 0;
      const r0 = S.holding ? 40 + S.held * 0.08 : 0;
      act.forEach((n, i) => {
        n.data.ix = i; n.data.pair = act[N - 1 - i];
        let near = false;
        if (r0 && t && n.data.wp) { const s = t.X.toScreen(n.data.wp); near = Math.hypot(s.x - S.ptr.x, s.y - S.ptr.y) < r0; }
        n.data.obs = clamp((n.data.obs || 0) + ((n.inf || near) ? dt / 160 : -dt / 900), 0, 1);
      });
      act.forEach((n) => { const p = n.data.pair; if (p && p.data.obs > n.data.obs) n.data.obs = p.data.obs; if (n.data.obs > 0.9) col++; });
      d.collapsed = col;
    },
    three: {
      init(S, X) {
        const THREE = X.THREE, d = S.data, sc = X.scene;
        X.maxPixelRatio = 1.25; X.studioEnvironment(); X.setBloom(0.5, 0.5, 0.95); X.setExposure(0.95);
        const gold = new THREE.MeshStandardMaterial({ color: 0xffc56b, metalness: 1, roughness: 0.24, envMapIntensity: 0.8 });
        const copper = new THREE.MeshStandardMaterial({ color: 0xe08a5c, metalness: 1, roughness: 0.28 });
        const steel = new THREE.MeshStandardMaterial({ color: 0xb5bcc4, metalness: 1, roughness: 0.32 });
        const plates = [[4.4, 2.35, steel], [3.2, 2.0, gold], [2.0, 1.72, gold], [0.9, 1.45, gold], [-0.15, 1.2, gold], [-1.1, 0.95, gold]];
        const rodsG = new THREE.CylinderGeometry(0.03, 0.03, 1, 10);
        const rods = new THREE.InstancedMesh(rodsG, gold, 30); let ri = 0;
        plates.forEach(([y, r, m], i) => {
          const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r, i ? 0.08 : 0.18, 96), m); p.position.y = y; p.castShadow = p.receiveShadow = true; sc.add(p);
          const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.025, 8, 96), copper); rim.rotation.x = Math.PI / 2; rim.position.y = y; sc.add(rim);
          if (i < plates.length - 1) { const y2 = plates[i + 1][0], rr = plates[i + 1][1] * 0.82; for (let k = 0; k < 6 && ri < 30; k++, ri++) { const a = k * TAU / 6 + i * 0.3; rods.setMatrixAt(ri, new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * rr, (y + y2) / 2, Math.sin(a) * rr), new THREE.Quaternion(), new THREE.Vector3(1, y - y2, 1))); } }
        });
        rods.count = ri; rods.castShadow = true; sc.add(rods);
        // coaxial lines spiralling down, and a heat-exchanger coil
        const cables = [];
        for (let k = 0; k < 14; k++) { const a0 = k * TAU / 14, pts = []; for (let j = 0; j <= 10; j++) { const y = lerp(4.3, -1.6, j / 10), r = lerp(1.8, 0.35, Math.pow(j / 10, 0.8)), a = a0 + j * 0.18; pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)); } cables.push(new THREE.CatmullRomCurve3(pts)); }
        sc.add(new THREE.Mesh(tubes(THREE, cables, 60, 6, () => 0.022), new THREE.MeshStandardMaterial({ color: 0x8fa3b8, metalness: 0.9, roughness: 0.3 })));
        const coil = []; for (let j = 0; j <= 120; j++) { const a = j * 0.42, y = lerp(1.9, 1.0, j / 120); coil.push(new THREE.Vector3(Math.cos(a) * 0.55, y, Math.sin(a) * 0.55)); }
        sc.add(new THREE.Mesh(tubes(THREE, [new THREE.CatmullRomCurve3(coil)], 400, 6, () => 0.03), copper));
        const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.2, 48), gold); finger.position.y = -1.75; sc.add(finger);
        const chipTex = X.canvasTexture(256, 256, (c, w, h) => {
          c.fillStyle = '#1b1d24'; c.fillRect(0, 0, w, h); c.strokeStyle = '#d6b36a'; c.lineWidth = 3;
          for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo(16 + i * 30, 0); c.lineTo(16 + i * 30, 60); c.lineTo(128, 128); c.stroke(); c.beginPath(); c.moveTo(16 + i * 30, h); c.lineTo(16 + i * 30, h - 60); c.lineTo(128, 128); c.stroke(); }
          c.fillStyle = '#9ad6ff'; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(68 + i * 30, 128, 7, 0, TAU); c.fill(); }
        });
        const chip = new THREE.Mesh(RBox(THREE, 0.7, 0.06, 0.7, 2, 0.02), new THREE.MeshStandardMaterial({ map: chipTex, roughness: 0.35, metalness: 0.4, emissive: 0x4fb8ff, emissiveMap: chipTex, emissiveIntensity: 0.25 }));
        chip.position.y = -2.4; sc.add(chip);
        const key = new THREE.SpotLight(0xfff0dc, 900, 30, 0.5, 0.6, 2); key.position.set(6, 9, 7); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); sc.add(key);
        const rim = new THREE.DirectionalLight(0x9fc6ff, 1.4); rim.position.set(-5, 3, -6); sc.add(rim);
        sc.add(new THREE.HemisphereLight(0x8090b0, 0x101010, 0.25));
        const qb = new THREE.PointLight(0x8fd0ff, 12, 6, 2); qb.position.set(0, -2.1, 0); sc.add(qb);
        const sp = particles(X, 500);
        const opts = { R: 1.9, center: new THREE.Vector3(0, -1.2, 0), size: 0.3, glow: 2.4 };
        // superposition: two ghost layers with independent jitter; they merge into one when observed
        d.t3 = { X, cam: {}, sp, qb, glA: glyphLayer(X, S, opts), glB: glyphLayer(X, S, opts), col: new THREE.Color(), target: new THREE.Vector3() };
        const g = new THREE.BufferGeometry(), P = new Float32Array(260 * 6), C = new Float32Array(260 * 6);
        g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3));
        const ent = new THREE.LineSegments(g, new THREE.LineDashedMaterial({ vertexColors: true, dashSize: 0.06, gapSize: 0.06, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        ent.frustumCulled = false; sc.add(ent); d.t3.ent = ent;
      },
      update(S, X, now, dt) {
        const d = S.data, t = d.t3; if (!t) return;
        const p = power(S);
        t.target.set(0, lerp(1.0, -1.6, p), 0);
        rig(X, S, t.cam, { target: t.target, dist: 13.5, el: 0.14, spin: 0.00005, dolly: 0.4 });
        const hueOf = (n) => { const ix = n.data.ix || 0, pi = Math.min(ix, S.active.length - 1 - ix); return (190 + (pi * 47) % 170) / 360; };
        t.glA.update(S, (n, c) => { const o = n.data.obs || 0; c.setHSL(hueOf(n), 0.9, 0.65).multiplyScalar(1 + 1.6 * o); return { jit: 0.22 * (1 - o), a: 0.55 + 0.45 * o }; });
        t.glB.update(S, (n, c) => { const o = n.data.obs || 0; c.setHSL(hueOf(n), 0.9, 0.65); return { jit: 0.22 * (1 - o), a: 0.5 * (1 - o) }; });
        // entanglement threads between collapsed pairs
        const P = t.ent.geometry.attributes.position.array, C = t.ent.geometry.attributes.color.array; let v = 0;
        for (const n of S.active) { const q = n.data.pair; if (!q || !n.data.wp || !q.data.wp || n.data.ix > q.data.ix || n.data.obs < 0.5) continue; t.col.setHSL(hueOf(n), 1, 0.6).multiplyScalar(n.data.obs); [n.data.wp, q.data.wp].forEach((w) => { P[v * 3] = w.x; P[v * 3 + 1] = w.y; P[v * 3 + 2] = w.z; C[v * 3] = t.col.r; C[v * 3 + 1] = t.col.g; C[v * 3 + 2] = t.col.b; v++; }); }
        t.ent.geometry.setDrawRange(0, v); t.ent.geometry.attributes.position.needsUpdate = true; t.ent.geometry.attributes.color.needsUpdate = true; t.ent.computeLineDistances();
        t.qb.intensity = 8 + 40 * p + (S.reduceMotion ? 0 : 3 * Math.sin(now * 0.01));
        t.sp.update(X, dt);
      }
    },
    onRelease(S) {
      const d = S.data, t = d.t3; d.tun = S.now;
      S.active.forEach((n) => { n.data.obs = 0; const p = n.data.wp; if (t && p && n.inf) t.sp.add(p.x, p.y, p.z, rand(-0.04, 0.04), rand(-0.04, 0.04), rand(-0.04, 0.04), 1.4, 0.7, 2, 0.12, 700, 0, 0.95); });
      return false;
    },
    hud(S) {
      const d = S.data;
      if (S.holding) return `measuring… ${d.collapsed}/${S.active.length} collapsed · entangled pairs collapse together · 10 mK at the mixing chamber`;
      if (S.now - d.tun < 4000) return 'decoherence · the qubits forgot what you saw';
      return "Schrödinger's letter: both infected and not · hold to observe";
    }
  }));

  /* ======================= 6. FIREWORKS: shells over a harbour city at night ======================= */
  const FW = ['peony', 'willow', 'ring', 'crackle', 'palm', 'chrys', 'peony', 'strobe'];
  SP.addMode(base3d({
    id: 'fireworks', name: 'FIREWORKS', glyphs: G('✦✧★✶✷✸✹', '*+'),
    base: [40, 70, 86], palette: [[0, 100, 62], [45, 100, 60], [200, 100, 66], [300, 100, 68], [130, 100, 60]],
    count: 60, pageBg: ['#060a1e', '#010206'],
    shapes: ['sphere', 'rose', 'sunflower', 'heart', 'galaxy', 'crown', 'lissajous'],
    init(S) { S.data.shells = 0; S.data.next = 0; },
    three: {
      init(S, X) {
        const THREE = X.THREE, d = S.data, sc = X.scene;
        X.maxPixelRatio = 1.2; X.setBloom(1.25, 0.55, 0.35); X.setExposure(0.95);
        sc.fog = new THREE.Fog(0x04060f, 90, 300);
        const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
          vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
          fragmentShader: 'varying vec3 vP; void main(){ float h = max(vP.y, 0.0); vec3 c = mix(vec3(0.022,0.026,0.06), vec3(0.002,0.003,0.01), pow(h, 0.45)); c += vec3(0.06,0.03,0.02) * exp(-h * 22.0); gl_FragColor = vec4(c, 1.0); }' }));
        sc.add(sky);
        const stars = particles(X, 1200, { hard: 3, order: 1 });
        for (let i = 0; i < 1200; i++) { const a = rand(0, TAU), e = rand(0.05, 1.2), r = 380; stars.add(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r, 0, 0, 0, 0.9, 0.9, 1, rand(0.4, 1.4), 1e12, 0, 1, { flat: 1 }); }
        // the city: instanced towers whose windows are a world-space shader pattern (lit at random)
        const bg = new THREE.BoxGeometry(1, 1, 1); bg.translate(0, 0.5, 0);
        const bm = new THREE.MeshStandardMaterial({ color: 0x0d1018, roughness: 0.75, metalness: 0.2 });
        bm.onBeforeCompile = (sh) => {
          sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vON;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvON = normal; vec4 wp4 = modelMatrix * instanceMatrix * vec4(position,1.0); vWP = wp4.xyz;');
          sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vON; float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }')
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
              if (abs(vON.y) < 0.5) { float u = abs(vON.x) > 0.5 ? vWP.z : vWP.x; vec2 g = vec2(u * 0.7, vWP.y * 0.6); vec2 f = fract(g); vec2 id = floor(g);
                float win = step(0.22, f.x) * step(f.x, 0.78) * step(0.25, f.y) * step(f.y, 0.75); float lit = step(0.72, hsh(id + floor(vWP.xz * 0.05) * 7.0));
                vec3 wc = mix(vec3(1.0,0.72,0.42), vec3(0.65,0.8,1.0), hsh(id * 1.7)); totalEmissiveRadiance += win * lit * wc * 0.9; }`);
        };
        const NB = 320, city = new THREE.InstancedMesh(bg, bm, NB), m4 = new THREE.Matrix4();
        for (let i = 0; i < NB; i++) {
          const row = i % 4, x = rand(-170, 170), z = -120 - row * 16 - rand(0, 10), tall = Math.random() < 0.1, h = tall ? rand(28, 60) : rand(6, 22) * (1 - Math.abs(x) / 260);
          m4.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(rand(4, 9), h, rand(4, 9))); city.setMatrixAt(i, m4);
        }
        sc.add(city);
        let water = null;
        if (THREE.Water) {
          water = new THREE.Water(new THREE.PlaneGeometry(600, 600), { textureWidth: 512, textureHeight: 512, waterNormals: noiseNormal(X, 256, 3, 7), sunDirection: new THREE.Vector3(0, 1, -0.3).normalize(), sunColor: 0x30344a, waterColor: 0x000208, distortionScale: 1.1, fog: true });
          water.rotation.x = -Math.PI / 2; water.material.uniforms.size.value = 1.4; sc.add(water);
        }
        sc.add(new THREE.HemisphereLight(0x1a2244, 0x020204, 0.4));
        const flashL = new THREE.PointLight(0xffffff, 0, 300, 2); flashL.position.set(0, 40, -40); sc.add(flashL);
        const ps = particles(X, 7000, { hard: 1.8 });
        d.t3 = { water, ps, rk: [], pops: [], flashL, cam: {}, gl: glyphLayer(X, S, { R: 9, center: new THREE.Vector3(0, 30, -60), size: 1.8, glow: 2.2 }), nextIdle: 0, ptrW: new THREE.Vector3() };
        d.t3.web = webLayer(X, S, [{ k: 0.8 }, { k: 1.3 }, { k: 1.6, pulse: 1 }, { k: 2.2, pulse: 2 }], ps);
      },
      update(S, X, now, dt) {
        const d = S.data, t = d.t3; if (!t) return;
        rig(X, S, t.cam, { target: new X.THREE.Vector3(0, 24, -70), dist: 82, el: 0.02, spin: 0, pa: 0.35, pe: 0.08, dolly: 0.12 });
        if (t.water) t.water.material.uniforms.time.value += dt / 2500;
        t.gl.update(S); t.web.update(S);
        const k = dt / 16.7, pal = S.mode.palette;
        const launch = (x, y, z, h, delay, type) => t.rk.push({ x, y, z, vx: rand(-0.04, 0.04), vy: Math.sqrt(2 * 0.012 * h), vz: rand(-0.04, 0.04), t: now + (delay || 0), hue: pick(pal)[0] + rand(-12, 12), type: type || pick(FW) });
        t.launch = launch;
        if (now > t.nextIdle && !S.holding) { t.nextIdle = now + rand(1600, 3200); launch(rand(-90, 90), 0, rand(-100, -60), rand(35, 65)); }
        if (S.holding && S.stage === 3 && now > t.nextIdle) { t.nextIdle = now + 260; launch(rand(-100, 100), 0, rand(-105, -55), rand(40, 75)); }
        const col = (h, l) => { const c = new X.THREE.Color().setHSL(h / 360, 1, l || 0.6); return c; };
        const burst = (r) => {
          const c = col(r.hue), n = r.type === 'palm' ? 14 : r.type === 'ring' ? 70 : 140, sp = r.type === 'willow' ? 0.75 : 1.0;
          const tilt = new X.THREE.Euler(rand(0, 3), rand(0, 3), 0), v = new X.THREE.Vector3();
          for (let i = 0; i < n; i++) {
            if (r.type === 'ring') { const a = i / n * TAU; v.set(Math.cos(a), Math.sin(a), 0).applyEuler(tilt).multiplyScalar(sp); }
            else { const f = fib(i, n); v.set(f[0], f[1], f[2]).multiplyScalar(sp * (0.85 + 0.15 * Math.random())); }
            const gold = r.type === 'willow' || r.type === 'crackle' || r.type === 'palm';
            t.ps.add(r.x, r.y, r.z, v.x, v.y, v.z, gold ? 2.2 : c.r * 2.4, gold ? 1.4 : c.g * 2.4, gold ? 0.5 : c.b * 2.4, r.type === 'palm' ? 0.7 : 0.45, r.type === 'willow' ? 3200 : rand(1300, 1900), r.type === 'willow' ? 0.0035 : 0.006, r.type === 'willow' ? 0.965 : 0.972, { trail: r.type === 'chrys' || r.type === 'palm' || r.type === 'willow', strobe: r.type === 'strobe', shrink: 1 });
          }
          if (r.type === 'crackle') for (let i = 0; i < 40; i++) t.pops.push({ x: r.x + rand(-9, 9), y: r.y + rand(-8, 6), z: r.z + rand(-9, 9), t: now + rand(700, 1300) });
          t.flashL.position.set(r.x, r.y, r.z); t.flashL.color.copy(c); t.flashL.intensity = S.reduceMotion ? 3000 : 9000;
        };
        // a moving pointer leaves sparkler sparks in the sky
        if (pspeed(S) > 2) { const w = X.fromScreen(S.ptr.x, S.ptr.y, -30); for (let i = 0; i < 3; i++) t.ps.add(w.x, w.y, w.z, rand(-0.08, 0.08), rand(-0.08, 0.08), rand(-0.08, 0.08), 2.4, 1.8, 1.1, 0.22, 500, 0.004, 0.95); t.ptrW.copy(w); }
        const out = [];
        for (const r of t.rk) {
          if (now < r.t) { out.push(r); continue; }
          r.vy -= 0.012 * k; r.x += r.vx * k; r.y += r.vy * k; r.z += r.vz * k;
          const dx = r.x - t.ptrW.x, dy = r.y - t.ptrW.y; if (dx * dx + dy * dy < 36 && pspeed(S) > 1) { r.vx += dx * 0.003; } // they dodge the pointer
          t.ps.add(r.x, r.y, r.z, rand(-0.02, 0.02), -0.02, rand(-0.02, 0.02), 2, 1.3, 0.6, 0.3, 450, 0.002, 0.95);
          if (r.vy <= 0.05) { burst(r); continue; }
          out.push(r);
        }
        t.rk = out;
        if (t.pops.length) t.pops = t.pops.filter((p) => { if (now < p.t) return true; for (let i = 0; i < 4; i++) t.ps.add(p.x, p.y, p.z, rand(-0.15, 0.15), rand(-0.15, 0.15), rand(-0.15, 0.15), 3, 3, 2.6, 0.25, 160, 0, 0.9); return false; });
        t.flashL.intensity *= Math.pow(0.86, k);
        const strobeOn = Math.floor(now / 70) % 2 === 0 || S.reduceMotion;
        t.ps.update(X, dt, (p) => { if (p.trail && Math.random() < 0.12) t.ps.add(p.x, p.y, p.z, 0, 0, 0, p.r * 0.5, p.g * 0.4, p.b * 0.3, p.size * 0.6, 500, 0.002, 0.9); if (p.strobe && p.t > 500) { const on = strobeOn; p.r = on ? 3 : 0.05; p.g = on ? 3 : 0.05; p.b = on ? 3 : 0.05; } return true; });
        if (S.holding && S.stage >= 1) for (let i = 0; i < S.stage * 3; i++) { const n = pick(S.active); if (n && n.inf && n.data.wp) { const w = n.data.wp; t.ps.add(w.x, w.y, w.z, rand(-0.12, 0.12), rand(-0.12, 0.12), rand(-0.12, 0.12), 2.6, 2.2, 1.6, 0.2, 350, 0.004, 0.94); } }
      }
    },
    onRelease(S) {
      const d = S.data, t = d.t3; if (!t || !t.launch) return false;
      const inf = S.active.filter((n) => n.inf && n.data.wp), step = Math.max(1, inf.length / 28); let k = 0;
      for (let i = 0; i < inf.length; i += step, k++) { const w = inf[Math.floor(i)].data.wp; t.launch(w.x, w.y, w.z, rand(10, 26), k * 40 + rand(0, 250)); }
      d.shells = k; d.rel = S.now;
      return false;
    },
    hud(S) {
      const d = S.data;
      if (S.holding) return S.stage === 3 ? 'finale armed · release to light every fuse' : `${S.infected} fuses lit · strontium red, barium green, copper blue`;
      if (d.rel && S.now - d.rel < 4000) return `${d.shells} shells away · light arrives first, the sound ≈ 3 s per km later`;
      return 'harbour, 23:59 · hold to arm, then let go';
    }
  }));

  /* ======================= 7. ABYSS: caustics, god rays and translucent jellyfish ======================= */
  const JELLY_VS = `uniform float uT; uniform float uPh; varying vec3 vN; varying vec3 vV; varying float vY;
    void main(){ vec3 p = position; float pulse = sin(uT * 2.2 + uPh); p.xz *= 1.0 + 0.13 * pulse * (1.0 - p.y); p.y *= 1.0 - 0.08 * pulse;
      vY = p.y; vec4 mv = modelViewMatrix * vec4(p,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
  const JELLY_FS = `uniform vec3 uRim; uniform vec3 uIn; uniform float uGlow; varying vec3 vN; varying vec3 vV; varying float vY;
    void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2); float band = 0.5 + 0.5 * sin(vY * 40.0);
      vec3 c = uIn * (0.25 + 0.2 * band) + uRim * f * uGlow; gl_FragColor = vec4(c, 0.18 + 0.7 * f); }`;
  SP.addMode(base3d({
    id: 'abyss', name: 'ABYSS', glyphs: G('∘°˚○◦⊙~≈∿', '°o~≈'),
    base: [190, 55, 72], palette: [[180, 100, 62], [160, 100, 55], [270, 90, 72]], noHueShift: true,
    count: 60, pageBg: ['#04364c', '#000a12'],
    shapes: ['seashell', 'helicoid', 'catenoid', 'dupin', 'sphere', 'enneper', 'galaxy', 'torus'],
    init(S) { S.data.bloom = -1e9; },
    three: {
      init(S, X) {
        const THREE = X.THREE, d = S.data, sc = X.scene, nz = X.noise;
        X.maxPixelRatio = 1.2; X.setBloom(1.0, 0.6, 0.45); X.setExposure(0.85);
        sc.fog = new THREE.FogExp2(0x02121c, 0.06);
        const sky = new THREE.Mesh(new THREE.SphereGeometry(200, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
          vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
          fragmentShader: 'varying vec3 vP; void main(){ float h = vP.y; vec3 c = mix(vec3(0.004,0.05,0.08), vec3(0.03,0.2,0.27), smoothstep(0.0, 0.9, h)); c = mix(vec3(0.0,0.03,0.05), c, smoothstep(-0.5, 0.05, h)); gl_FragColor = vec4(c, 1.0); }' }));
        sc.add(sky);
        const bed = new THREE.PlaneGeometry(140, 140, 180, 180); bed.rotateX(-Math.PI / 2);
        const bp = bed.attributes.position;
        for (let i = 0; i < bp.count; i++) { const x = bp.getX(i), z = bp.getZ(i); bp.setY(i, -6 + 1.4 * nz.noise(x * 0.05, 0, z * 0.05) + 0.3 * nz.noise(x * 0.25, 1, z * 0.25) + 0.06 * Math.sin(x * 2.2 + nz.noise(x * 0.3, 2, z * 0.3) * 4)); }
        bed.computeVertexNormals();
        const caustU = { uT: { value: 0 } };
        const sand = new THREE.MeshStandardMaterial({ color: 0x8a7c62, roughness: 0.95 });
        sand.onBeforeCompile = (sh) => {
          sh.uniforms.uT = caustU.uT;
          sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(position,1.0)).xyz;');
          sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vWP; uniform float uT;
            float caust(vec2 p){ float v = 0.0; vec2 q = p; for (int i = 0; i < 3; i++) { q = q * 1.3 + vec2(sin(q.y * 1.3 + uT * 0.7), cos(q.x * 1.1 - uT * 0.6)); v += abs(sin(q.x) * sin(q.y)); } return pow(1.0 - clamp(v / 3.0, 0.0, 1.0), 6.0); }`)
            .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n reflectedLight.directDiffuse += diffuseColor.rgb * vec3(0.55,0.9,1.0) * caust(vWP.xz * 0.5) * 1.6;');
        };
        const seabed = new THREE.Mesh(bed, sand); seabed.receiveShadow = true; sc.add(seabed);
        const rockMat = new THREE.MeshStandardMaterial({ color: 0x2c3a3a, roughness: 0.9 });
        for (let i = 0; i < 7; i++) { const g = new THREE.IcosahedronGeometry(1, 3), p = g.attributes.position; for (let j = 0; j < p.count; j++) { const x = p.getX(j), y = p.getY(j), z = p.getZ(j), s = 1 + 0.35 * nz.noise(x * 1.6 + i, y * 1.6, z * 1.6); p.setXYZ(j, x * s, y * s * 0.7, z * s); } g.computeVertexNormals(); const r = new THREE.Mesh(g, rockMat); r.position.set(rand(-25, 25), -6, rand(-30, -6)); r.scale.setScalar(rand(0.8, 2.6)); sc.add(r); }
        // god rays: soft additive shafts from the surface
        const rayMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uT: caustU.uT },
          vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
          fragmentShader: 'varying vec2 vU; uniform float uT; void main(){ float e = sin(vU.x * 3.14159); float f = pow(vU.y, 1.6) * e * e * (0.7 + 0.3 * sin(uT * 0.8 + vU.x * 6.0)); gl_FragColor = vec4(vec3(0.35,0.75,0.85) * f * 0.22, 1.0); }' });
        const rays = [];
        for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(rand(2, 5), 40), rayMat); m.position.set(rand(-18, 18), 10, rand(-20, 2)); m.rotation.z = rand(-0.25, -0.1); sc.add(m); rays.push(m); }
        // jellyfish: lathe bells with a fresnel translucency shader, plus CPU-animated tentacles
        const prof = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * 1.5; prof.push(new THREE.Vector2(Math.sin(a) * (1 + 0.12 * Math.max(0, a - 1.2) * 4), Math.cos(a) * 0.85 - (a > 1.3 ? (a - 1.3) * 0.6 : 0))); }
        const bellG = new THREE.LatheGeometry(prof, 48);
        const jel = [], cols = [[0.45, 0.85, 1], [0.8, 0.5, 1], [0.4, 1, 0.8]];
        for (let i = 0; i < 5; i++) {
          const c = cols[i % 3], mat = new THREE.ShaderMaterial({ vertexShader: JELLY_VS, fragmentShader: JELLY_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
            uniforms: { uT: caustU.uT, uPh: { value: rand(0, 6) }, uRim: { value: new THREE.Vector3(c[0], c[1], c[2]) }, uIn: { value: new THREE.Vector3(c[0] * 0.4, c[1] * 0.3, c[2] * 0.5) }, uGlow: { value: 1.2 } } });
          const m = new THREE.Mesh(bellG, mat), s = rand(0.6, 1.3); m.scale.setScalar(s); m.position.set(rand(-9, 9), rand(-3, 5), rand(-12, 2)); sc.add(m);
          jel.push({ m, s, mat, c, tilt: 0, vx: 0, vz: 0, ph: mat.uniforms.uPh.value });
        }
        const TN = 14, TS = 18, tg = new THREE.BufferGeometry(), TP = new Float32Array(jel.length * TN * TS * 2 * 3), TC = new Float32Array(TP.length);
        tg.setAttribute('position', new THREE.BufferAttribute(TP, 3).setUsage(THREE.DynamicDrawUsage)); tg.setAttribute('color', new THREE.BufferAttribute(TC, 3).setUsage(THREE.DynamicDrawUsage));
        const tent = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); tent.frustumCulled = false; sc.add(tent);
        const snow = particles(X, 1800, { normal: true, hard: 1.3, order: 3 });
        for (let i = 0; i < 1800; i++) snow.add(rand(-25, 25), rand(-6, 12), rand(-30, 8), 0, -0.002, 0, 0.75, 0.85, 0.85, rand(0.03, 0.08), 1e12, 0, 1, { flat: 1, b0: 0 });
        const sun = new THREE.DirectionalLight(0x9fdcff, 0.9); sun.position.set(-4, 20, 6); sc.add(sun);
        sc.add(new THREE.HemisphereLight(0x2a7090, 0x020a0e, 0.3));
        const sp = particles(X, 600);
        d.t3 = { caustU, rays, jel, tent, TN, TS, snow, sp, cam: {}, gl: glyphLayer(X, S, { R: 3, size: 0.36, glow: 2 }) };
        d.t3.web = webLayer(X, S, [{ k: 0.6 }, { k: 1.1 }, { k: 1.5, pulse: 1 }, { k: 2, pulse: 2 }], sp);
      },
      update(S, X, now, dt) {
        const d = S.data, t = d.t3; if (!t) return;
        t.caustU.uT.value = now / 1000;
        rig(X, S, t.cam, { target: new X.THREE.Vector3(0, -0.5, 0), dist: 13, el: 0.05, spin: 0.00003, dolly: 0.25 });
        t.gl.update(S); t.web.update(S); t.sp.update(X, dt);
        t.rays.forEach((r) => { r.rotation.y = Math.atan2(X.camera.position.x - r.position.x, X.camera.position.z - r.position.z); });
        const k = dt / 16.7, w = X.fromScreen(S.ptr.x, S.ptr.y, 0), sp = pspeed(S), p = power(S), bl = (now - d.bloom) / 2500;
        // jellyfish swim by pulsing; scared by a moving pointer, drawn to a held one
        const P = t.tent.geometry.attributes.position.array, C = t.tent.geometry.attributes.color.array; let v = 0;
        t.jel.forEach((j, ji) => {
          const ph = now / 1000 * 2.2 + j.ph, thrust = Math.max(0, -Math.cos(ph)) * 0.012 * j.s;
          const dx = j.m.position.x - w.x, dy = j.m.position.y - w.y;
          if (S.holding) { j.vx += -dx * 0.00004 * k; j.vz += -j.m.position.z * 0.00003 * k; } else if (sp > 1 && dx * dx + dy * dy < 9) { j.vx += dx * 0.002; }
          j.vx *= 0.985; j.vz *= 0.985;
          j.m.position.x += j.vx * k; j.m.position.z += j.vz * k; j.m.position.y += thrust * k - 0.002 * k;
          if (j.m.position.y > 9) j.m.position.y = -5; if (j.m.position.y < -6) j.m.position.y = 8;
          j.mat.uniforms.uGlow.value = 1.1 + 1.6 * p + (bl > 0 && bl < 1 ? 2 * (1 - bl) : 0);
          for (let i = 0; i < t.TN; i++) {
            const a = i / t.TN * TAU, r0 = 0.95 * j.s;
            let x = j.m.position.x + Math.cos(a) * r0, y = j.m.position.y - 0.05 * j.s, z = j.m.position.z + Math.sin(a) * r0;
            for (let s = 0; s < t.TS; s++) {
              const nx = x + Math.sin(now * 0.0016 + s * 0.5 + i + ji) * 0.05 * s / 4 - Math.cos(a) * 0.02, ny = y - 0.22 * j.s, nz2 = z + Math.cos(now * 0.0013 + s * 0.4 + i) * 0.05 * s / 4 - Math.sin(a) * 0.02;
              const f = (1 - s / t.TS) * 0.5;
              P[v * 3] = x; P[v * 3 + 1] = y; P[v * 3 + 2] = z; C[v * 3] = j.c[0] * f; C[v * 3 + 1] = j.c[1] * f; C[v * 3 + 2] = j.c[2] * f; v++;
              P[v * 3] = nx; P[v * 3 + 1] = ny; P[v * 3 + 2] = nz2; C[v * 3] = j.c[0] * f; C[v * 3 + 1] = j.c[1] * f; C[v * 3 + 2] = j.c[2] * f; v++;
              x = nx; y = ny; z = nz2;
            }
          }
        });
        t.tent.geometry.setDrawRange(0, v); t.tent.geometry.attributes.position.needsUpdate = true; t.tent.geometry.attributes.color.needsUpdate = true;
        const seed = S.seed && S.seed.data.wp;
        t.snow.update(X, dt, (q) => {
          if (sp > 1) { const ex = q.x - w.x, ey = q.y - w.y; if (ex * ex + ey * ey < 4 && Math.abs(q.z) < 3) { q.vx += ex * 0.004; q.vy += ey * 0.004; q.b0 = 1; } }
          if (bl > 0 && bl < 1 && d.bloomAt) { const r = Math.hypot(q.x - d.bloomAt.x, q.y - d.bloomAt.y, q.z - d.bloomAt.z); if (Math.abs(r - bl * 25) < 1.5) q.b0 = 1; }
          q.b0 *= 0.96; q.vx *= 0.98; q.vy = q.vy * 0.98 - 0.00005; if (q.y < -6) q.y = 12;
          const g = q.b0; q.r = 0.75 * (1 - g) + 0.4 * g * 3; q.g = 0.85 * (1 - g) + 1 * g * 3; q.b = 0.85 * (1 - g) + 1 * g * 3; return true;
        });
        if (seed && S.stage >= 2 && Math.random() < 0.1) t.sp.add(seed.x, seed.y, seed.z, rand(-0.02, 0.02), 0.03, rand(-0.02, 0.02), 0.9, 1.6, 1.8, 0.1, 1200, -0.0004, 0.995);
      }
    },
    onRelease(S) { const d = S.data; d.bloom = S.now; d.bloomAt = S.seed && S.seed.data.wp ? S.seed.data.wp.clone() : new window.THREE.Vector3(); return false; },
    hud(S) {
      if (S.holding) return `bioluminescence rising · the plankton noticed you · depth ${3800 + Math.round(S.held / 4)} m`;
      if (S.now - S.data.bloom < 4000) return 'a bloom: down here, light is how you say startled';
      return 'depth 3 800 m · 380 atm · the only light is what we make';
    }
  }));

  const GRAD_VS = 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
  function skyDome(THREE, sc, frag, uniforms, r) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r || 300, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: uniforms || {}, vertexShader: GRAD_VS, fragmentShader: frag }));
    m.renderOrder = -10; sc.add(m); return m;
  }
  function displace(geo, nz, amp, freq, seed) {
    const p = geo.attributes.position;
    for (let j = 0; j < p.count; j++) { const x = p.getX(j), y = p.getY(j), z = p.getZ(j), s = 1 + amp * nz.noise(x * freq + seed, y * freq, z * freq); p.setXYZ(j, x * s, y * s, z * s); }
    geo.computeVertexNormals(); return geo;
  }

  /* ======================= 8. ELDRITCH: a wet, veined eye with a refractive cornea ======================= */
  const ZB = Array.from(G('ΨΩЖѪѬҨᚦᛟ☿ΔΣΘ⸸ʘ', 'ΨΩЖΔΣΘ'));
  const zalgo = (k) => { let s = pick(ZB); for (let i = 0; i < k; i++) s += String.fromCharCode(0x300 + Math.floor(Math.random() * 0x6F)); return s; };
  const EYE_FRAG = `
    vec3 ed = normalize(vOP); float ang = acos(clamp(ed.z, -1.0, 1.0)); float phi = atan(ed.y, ed.x);
    vec3 scl = vec3(0.92, 0.86, 0.8);
    float vv = abs(sin(phi * 21.0 + sin(ang * 8.0 + phi * 3.0) * 2.4 + sin(ang * 23.0) * 0.6));
    float vein = smoothstep(0.55, 1.7, ang) * pow(1.0 - vv, 22.0);
    float vv2 = abs(sin(phi * 47.0 + sin(ang * 13.0 - phi * 5.0) * 3.0)); vein += smoothstep(0.8, 1.9, ang) * pow(1.0 - vv2, 40.0) * 0.7;
    scl = mix(scl, vec3(0.62, 0.06, 0.05), clamp(vein, 0.0, 1.0) * 0.9);
    scl = mix(scl, vec3(0.78, 0.42, 0.38), smoothstep(1.1, 2.2, ang) * 0.55);
    float IR = 0.43; float r = ang / IR;
    float f1 = 0.5 + 0.5 * sin(phi * 64.0 + sin(phi * 7.0) * 3.0 + r * 5.0), f2 = 0.5 + 0.5 * sin(phi * 23.0 + r * 13.0 + uT * 0.3);
    vec3 ir = mix(vec3(0.5, 0.08, 0.02), vec3(1.0, 0.6, 0.12), f1 * 0.65 + f2 * 0.35) * mix(1.25, 0.45, r);
    ir += vec3(0.55, 0.32, 0.05) * exp(-pow((r - 0.42) * 11.0, 2.0));
    ir = mix(ir, vec3(0.06, 0.015, 0.01), smoothstep(0.84, 1.0, r));
    vec3 ecol = mix(ir, scl, smoothstep(0.98, 1.05, r));
    vec2 q = vec2(ang * cos(phi), ang * sin(phi));
    float sl = length(vec2(q.x / (uPupil * 0.32), q.y / uPupil));
    ecol = mix(vec3(0.0), ecol, smoothstep(0.92, 1.08, sl));
    diffuseColor.rgb = ecol;
    float irisMask = (1.0 - smoothstep(0.98, 1.05, r)) * smoothstep(0.92, 1.08, sl);`;
  SP.addMode(base3d({
    id: 'eldritch', name: 'ELDRITCH', glyphs: () => zalgo(2 + Math.floor(Math.random() * 5)),
    base: [30, 12, 66], palette: [[0, 90, 45], [350, 100, 32], [15, 100, 55]], noHueShift: true,
    count: 60, pageBg: ['#1a0204', '#000000'],
    shapes: ['sphere', 'klein', 'seashell', 'boy', 'great_stellated_dodecahedron', 'urchin', 'trefoil', 'hopf'],
    init(S) { S.data.rel = -1e9; },
    three: {
      init(S, X) {
        const THREE = X.THREE, d = S.data, sc = X.scene, nz = X.noise;
        X.maxPixelRatio = 1.3; X.studioEnvironment(); X.setBloom(0.6, 0.5, 0.82); X.setExposure(0.9);
        sc.fog = new THREE.FogExp2(0x060001, 0.05);
        skyDome(THREE, sc, 'varying vec3 vP; void main(){ float h = vP.y; vec3 c = mix(vec3(0.004,0.0,0.001), vec3(0.03,0.002,0.004), smoothstep(-0.4, 0.6, 1.0 - abs(h))); gl_FragColor = vec4(c, 1.0); }', null, 100);
        const eye = new THREE.Group(); sc.add(eye);
        const U = { uPupil: { value: 0.22 }, uT: { value: 0 }, uGlow: { value: 0.3 } };
        const em = new THREE.MeshPhysicalMaterial({ roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 0.5, emissive: 0xffffff });
        em.onBeforeCompile = (sh) => {
          Object.assign(sh.uniforms, U);
          sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position;');
          sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP; uniform float uPupil; uniform float uT; uniform float uGlow;')
            .replace('#include <color_fragment>', '#include <color_fragment>\n' + EYE_FRAG)
            .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance = ecol * irisMask * uGlow;');
        };
        const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), em); ball.castShadow = true; eye.add(ball);
        const corneaG = new THREE.SphereGeometry(1, 64, 24, 0, TAU, 0, 0.62); corneaG.rotateX(Math.PI / 2); corneaG.scale(1.02, 1.02, 1.1);
        const cornea = new THREE.Mesh(corneaG, new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, roughness: 0, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 2.5, depthWrite: false }));
        eye.add(cornea);
        eye.scale.setScalar(2);
        // eyelids and a wet, swollen socket
        const skinN = noiseNormal(X, 256, 6, 5); skinN.repeat.set(3, 3);
        const skin = new THREE.MeshPhysicalMaterial({ color: 0x3a1410, roughness: 0.45, clearcoat: 0.8, clearcoatRoughness: 0.25, normalMap: skinN, normalScale: new THREE.Vector2(0.6, 0.6), sheen: new THREE.Color(0x401010) });
        const lidU = new THREE.Mesh(new THREE.SphereGeometry(2.12, 64, 32, 0, TAU, 0, Math.PI / 2), skin), lidL = new THREE.Mesh(new THREE.SphereGeometry(2.12, 64, 32, 0, TAU, Math.PI / 2, Math.PI / 2), skin);
        const lidPivot = new THREE.Group(); lidPivot.add(lidU, lidL); sc.add(lidPivot);
        const sock = displace(new THREE.TorusGeometry(2.55, 0.75, 48, 160), nz, 0.12, 1.4, 3); const socket = new THREE.Mesh(sock, skin); socket.position.z = -0.6; socket.receiveShadow = true; sc.add(socket);
        // tentacles: tapered cylinders bent in the vertex shader
        const tens = [];
        for (let i = 0; i < 8; i++) {
          const g = new THREE.CylinderGeometry(0.03, 0.34, 9, 12, 60); g.translate(0, 4.5, 0);
          const tu = { uT: U.uT, uPh: { value: rand(0, 6) }, uBend: { value: new THREE.Vector2() } };
          const m = new THREE.MeshPhysicalMaterial({ color: 0x1e0807, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15, normalMap: skinN, normalScale: new THREE.Vector2(0.8, 0.8), sheen: new THREE.Color(0x501818) });
          m.onBeforeCompile = (sh) => {
            Object.assign(sh.uniforms, tu);
            sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT; uniform float uPh; uniform vec2 uBend;')
              .replace('#include <begin_vertex>', `#include <begin_vertex>
                float tt = clamp(position.y / 9.0, 0.0, 1.0);
                transformed.x += sin(tt * 3.2 + uT * 1.1 + uPh) * tt * tt * 1.8 + uBend.x * tt * tt;
                transformed.z += cos(tt * 2.4 + uT * 0.8 + uPh) * tt * tt * 1.4 + uBend.y * tt * tt;`);
          };
          const mesh = new THREE.Mesh(g, m), a = i / 8 * TAU + 0.2;
          mesh.position.set(Math.cos(a) * 3, Math.sin(a) * 3, -1.4); mesh.rotation.z = a - Math.PI / 2; mesh.rotation.x = -0.35;
          mesh.castShadow = true; sc.add(mesh); tens.push({ mesh, tu, a });
        }
        const key = new THREE.SpotLight(0xff5a3c, 260, 40, 0.6, 0.7, 2); key.position.set(-5, -6, 9); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); sc.add(key);
        const rim = new THREE.DirectionalLight(0xa0c0ff, 0.8); rim.position.set(3, 6, -8); sc.add(rim);
        const catchL = new THREE.PointLight(0xffffff, 40, 20, 2); catchL.position.set(2.5, 3, 7); sc.add(catchL);
        sc.add(new THREE.HemisphereLight(0x401010, 0x000000, 0.25));
        const sp = particles(X, 700);
        d.t3 = { eye, U, lidU, lidL, lidPivot, tens, key, sp, cam: {}, open: 0.25, blink: S.now + 4000, look: new THREE.Quaternion(), tmpO: new THREE.Object3D(),
          gl: glyphLayer(X, S, { R: 4.6, size: 0.55, cell: 96, fontScale: 0.42, family: 'serif', glow: 2.2, dim: 0.45 }) };
        d.t3.web = webLayer(X, S, [{ k: 0.6 }, { k: 1.1 }, { k: 1.5, zig: 0.15 }, { k: 2, zig: 0.3, pulse: 1 }], sp);
      },
      update(S, X, now, dt) {
        const d = S.data, t = d.t3; if (!t) return;
        t.U.uT.value = now / 1000;
        rig(X, S, t.cam, { target: new X.THREE.Vector3(0, 0, 0), dist: 13, el: 0.05, spin: 0, pa: 0.5, pe: 0.3, dolly: 0.3 });
        t.gl.update(S); t.web.update(S); t.sp.update(X, dt);
        const k = 1 - Math.pow(0.9, dt / 16.7), p = power(S);
        const want = now - d.rel < 900 ? 0 : S.holding ? 1 : 0.28;
        t.open += (want - t.open) * (now - d.rel < 900 ? 0.4 : k * 0.4);
        if (now > t.blink + 260) t.blink = now + rand(3500, 7500);
        const bl = now > t.blink && now < t.blink + 260 && !S.reduceMotion ? Math.sin((now - t.blink) / 260 * Math.PI) : 0;
        const o = t.open * (1 - bl);
        t.lidU.rotation.x = -o * 1.15; t.lidL.rotation.x = o * 0.75;
        // the eye turns to follow the pointer
        const target = X.fromScreen(S.ptr.x, S.ptr.y, 6);
        t.tmpO.position.set(0, 0, 0); t.tmpO.lookAt(target); t.look.copy(t.tmpO.quaternion);
        t.eye.quaternion.slerp(t.look, k * 0.8);
        t.U.uPupil.value += ((S.holding ? 0.2 - 0.035 * S.stage : 0.26) - t.U.uPupil.value) * k;
        t.U.uGlow.value = 0.2 + 0.9 * p;
        t.tens.forEach((tn) => { const bx = S.holding ? (target.x - Math.cos(tn.a) * 3) * 0.25 : 0, by = S.holding ? 2.5 * p : 0; tn.tu.uBend.value.x += (bx - tn.tu.uBend.value.x) * k * 0.3; tn.tu.uBend.value.y += (by - tn.tu.uBend.value.y) * k * 0.3; });
        t.key.intensity = 240 + 500 * p + (now - d.rel < 600 && !S.reduceMotion ? 3000 * (1 - (now - d.rel) / 600) : 0);
        if (S.holding && Math.random() < 0.2 + 0.2 * S.stage) { const a = rand(0, TAU), r = 12; t.sp.add(Math.cos(a) * r, Math.sin(a) * r * 0.6, rand(-4, 4), -Math.cos(a) * 0.08, -Math.sin(a) * 0.05, 0, 1.4, 0.05, 0.05, 0.12, 2200, 0, 1); }
      }
    },
    onRelease(S) {
      const d = S.data; d.rel = S.now;
      const t = d.t3; if (t) S.active.forEach((n) => { const p = n.data.wp; if (p && n.inf) t.sp.add(p.x, p.y, p.z, rand(-0.06, 0.06), rand(-0.06, 0.06), rand(-0.06, 0.06), 1.6, 0.05, 0.04, 0.16, 1200, 0, 0.97); });
      return false;
    },
    hud(S) {
      if (S.holding) return ['it stirs', 'it sees you', `sanity ${Math.max(0, 100 - Math.round(S.held / 50))}% and falling`, "ph'nglui mglw'nafh Sphere R'lyeh wgah'nagl fhtagn"][S.stage];
      if (S.now - S.data.rel < 5000) return 'it blinked. it will remember this.';
      return 'it follows your cursor. it always has.';
    }
  }));

  /* ======================= 9. SACRED GEOMETRY: nested gold solids over an engraved flower of life ======================= */
  const PHI = (1 + Math.sqrt(5)) / 2;
  SP.addMode(base3d({
    id: 'sacred', name: 'SACRED GEOMETRY', glyphs: G('△▽○◇☉φΦ∞⊙✡◬', '△▽○◇φΦ∞'),
    base: [45, 55, 78], palette: [[45, 100, 60], [36, 90, 52], [52, 100, 84]], noHueShift: true,
    count: 72, pageBg: ['#140c02', '#000000'],
    shapes: ['sunflower', 'icosahedron', 'dodecahedron', 'stella_octangula', 'cell600', 'octahedron', 'rhombic_triacontahedron', 'cube', 'sphere'],
    init(S) { S.data.spT = -1e9; },
    three: {
      init(S, X) {
        const THREE = X.THREE, d = S.data, sc = X.scene;
        X.maxPixelRatio = 1.35; X.studioEnvironment(); X.setBloom(0.55, 0.5, 0.85); X.setExposure(0.95);
        const gold = new THREE.MeshStandardMaterial({ color: 0xffc66a, metalness: 1, roughness: 0.16, envMapIntensity: 1.1 });
        const defs = [[new THREE.IcosahedronGeometry(2.3, 0), 0.00018], [new THREE.DodecahedronGeometry(1.85, 0), -0.00025], [new THREE.OctahedronGeometry(1.4, 0), 0.0003], [new THREE.BoxGeometry(1.4, 1.4, 1.4), -0.00035], [new THREE.TetrahedronGeometry(0.95, 0), 0.0005]];
        const solids = [], edgeList = [], vertList = [];
        defs.forEach(([g, spd], si) => {
          const e = new THREE.EdgesGeometry(g), p = e.attributes.position, seen = {};
          for (let i = 0; i < p.count; i += 2) { const a = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)), b = new THREE.Vector3(p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)); edgeList.push({ si, a, b }); [a, b].forEach((v) => { const k = v.toArray().map((x) => x.toFixed(3)).join(); if (!seen[k]) { seen[k] = 1; vertList.push({ si, v }); } }); }
          solids.push({ rot: new THREE.Euler(rand(0, 6), rand(0, 6), 0), spd, q: new THREE.Quaternion() });
        });
        const rods = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 10), gold, edgeList.length), balls = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 20, 14), gold, vertList.length);
        rods.castShadow = balls.castShadow = true; rods.instanceMatrix.setUsage(THREE.DynamicDrawUsage); balls.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        sc.add(rods, balls);
        const engr = X.canvasTexture(1024, 1024, (c, w, h) => {
          c.fillStyle = '#808080'; c.fillRect(0, 0, w, h); c.strokeStyle = '#202020'; c.lineWidth = 4; const cx = w / 2, cy = h / 2, r = w / 9;
          const cs = [[0, 0]]; for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; cs.push([Math.cos(a) * r, Math.sin(a) * r], [Math.cos(a) * 2 * r, Math.sin(a) * 2 * r], [Math.cos(a + Math.PI / 6) * r * Math.sqrt(3), Math.sin(a + Math.PI / 6) * r * Math.sqrt(3)]); }
          cs.forEach((p) => { c.beginPath(); c.arc(cx + p[0], cy + p[1], r, 0, TAU); c.stroke(); });
          [3, 3.08, 4.1, 4.2].forEach((f) => { c.beginPath(); c.arc(cx, cy, r * f, 0, TAU); c.stroke(); });
          c.font = `${Math.round(r * 0.32)}px serif`; c.fillStyle = '#202020'; c.textAlign = 'center'; c.textBaseline = 'middle';
          const txt = 'ΑΓΕΩΜΕΤΡΗΤΟΣ ΜΗΔΕΙΣ ΕΙΣΙΤΩ · '; for (let i = 0; i < 60; i++) { c.save(); c.translate(cx, cy); c.rotate(i / 60 * TAU); c.fillText(txt[i % txt.length], 0, -r * 3.6); c.restore(); }
        });
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.3, 160), new THREE.MeshStandardMaterial({ color: 0x8a6a2a, metalness: 1, roughness: 0.38, bumpMap: engr, bumpScale: 0.03, roughnessMap: engr, envMapIntensity: 0.7 }));
        disc.rotation.x = Math.PI / 2; disc.position.z = -3.2; disc.receiveShadow = true; sc.add(disc);
        const key = new THREE.SpotLight(0xfff0d0, 1400, 60, 0.45, 0.5, 2); key.position.set(4, 6, 14); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; sc.add(key);
        const fill = new THREE.PointLight(0xffb060, 60, 30, 2); fill.position.set(-6, -3, 6); sc.add(fill);
        sc.add(new THREE.HemisphereLight(0x302010, 0x000000, 0.2));
        const spiral = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), gold, 220); spiral.count = 0; spiral.instanceMatrix.setUsage(THREE.DynamicDrawUsage); sc.add(spiral);
        const sp = particles(X, 500);
        d.t3 = { solids, edgeList, vertList, rods, balls, key, spiral, sp, cam: {}, m4: new THREE.Matrix4(), q: new THREE.Quaternion(), v: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), sc3: new THREE.Vector3(),
          gl: glyphLayer(X, S, { R: 3.6, size: 0.4, glow: 2.2, family: 'serif' }) };
        d.t3.web = webLayer(X, S, [{ k: 0.7 }, { k: 1.2 }, { k: 1.6, pulse: 1 }, { k: 2.2, pulse: 1.5 }], sp);
      },
      update(S, X, now, dt) {
        const d = S.data, t = d.t3; if (!t) return;
        const THREE = X.THREE, p = power(S);
        rig(X, S, t.cam, { target: new THREE.Vector3(0, 0, 0), dist: 14, el: 0.08, spin: 0, pa: 0.35, pe: 0.25, dolly: 0.2 });
        t.gl.update(S); t.web.update(S); t.sp.update(X, dt);
        // the key light follows the pointer, so the shadows of the solids sweep across the engraving
        const lp = X.fromScreen(S.ptr.x, S.ptr.y, 14); t.key.position.lerp(new THREE.Vector3(lp.x * 0.8, lp.y * 0.8 + 2, 14), 0.05);
        t.key.intensity = 1200 + 1500 * p;
        t.solids.forEach((s, i) => { s.rot.x += dt * s.spd * (1 + 6 * p); s.rot.y += dt * s.spd * 0.7 * (1 + 6 * p); s.q.setFromEuler(s.rot); s.scale = 1 + 0.25 * p * (i / 4); });
        const M = t.rods, A = new THREE.Vector3(), B = new THREE.Vector3();
        t.edgeList.forEach((e, i) => {
          const s = t.solids[e.si]; A.copy(e.a).multiplyScalar(s.scale).applyQuaternion(s.q); B.copy(e.b).multiplyScalar(s.scale).applyQuaternion(s.q);
          t.v.copy(A).add(B).multiplyScalar(0.5); t.sc3.subVectors(B, A); const len = t.sc3.length(); t.q.setFromUnitVectors(t.up, t.sc3.normalize());
          t.m4.compose(t.v, t.q, new THREE.Vector3(0.04, len, 0.04)); M.setMatrixAt(i, t.m4);
        });
        t.vertList.forEach((e, i) => { const s = t.solids[e.si]; A.copy(e.v).multiplyScalar(s.scale).applyQuaternion(s.q); t.m4.compose(A, t.q.identity(), new THREE.Vector3(0.085, 0.085, 0.085)); t.balls.setMatrixAt(i, t.m4); });
        M.instanceMatrix.needsUpdate = true; t.balls.instanceMatrix.needsUpdate = true;
        // release: a golden spiral of beads, r = a·φ^(2θ/π)
        const st = (now - d.spT) / 3500;
        if (st >= 0 && st < 1) {
          const n = Math.floor(Math.min(1, st * 2) * 220), b = Math.log(PHI) / (Math.PI / 2);
          for (let i = 0; i < n; i++) { const th = i * 0.075, r = 0.05 * Math.exp(b * th), sz = 0.02 + r * 0.035; t.m4.compose(new THREE.Vector3(d.spO.x + Math.cos(th + d.spR) * r, d.spO.y + Math.sin(th + d.spR) * r, d.spO.z + 0.5), t.q.identity(), new THREE.Vector3(sz, sz, sz).multiplyScalar(1 - Math.max(0, st - 0.6) * 2.4)); t.spiral.setMatrixAt(i, t.m4); }
          t.spiral.count = n; t.spiral.instanceMatrix.needsUpdate = true;
        } else t.spiral.count = 0;
      }
    },
    onRelease(S) { const d = S.data; d.spT = S.now; d.spO = S.seed && S.seed.data.wp ? S.seed.data.wp.clone() : new window.THREE.Vector3(); d.spR = rand(0, TAU); return false; },
    hud(S) {
      if (S.holding) return ['the seed of life', 'the flower of life', "Metatron's cube aligns", 'φ everywhere · as above, so below'][S.stage];
      return 'φ = 1.6180339887… · let no one ignorant of geometry enter · the light follows you';
    }
  }));

  /* ======================= 10. SYNTHWAVE: an outrun landscape with a striped sun ======================= */
  const NOISE_GLSL = `float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f); return mix(mix(hsh(i), hsh(i + vec2(1,0)), u.x), mix(hsh(i + vec2(0,1)), hsh(i + vec2(1,1)), u.x), u.y); }
    float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }`;
  SP.addMode(base3d({
    id: 'synthwave', name: 'SYNTHWAVE', glyphs: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    base: [305, 90, 86], palette: [[320, 100, 62], [185, 100, 58], [45, 100, 62], [275, 100, 68]],
    count: 64, pageBg: ['#14002e', '#05000c'],
    shapes: ['torus', 'sphere', 'lissajous', 'heart', 'dodecahedron', 'cube', 'crown', 'trefoil'],
    init(S) { S.data.flare = -1e9; },
    three: {
      init(S, X) {
        const THREE = X.THREE, d = S.data, sc = X.scene;
        X.maxPixelRatio = 1.25; X.setBloom(0.85, 0.55, 0.75); X.setExposure(0.85);
        const U = { uT: { value: 0 }, uOff: { value: 0 }, uSteer: { value: 0 }, uFlare: { value: 0 } };
        skyDome(THREE, sc, `varying vec3 vP; uniform float uT; ${NOISE_GLSL}
          void main(){ float h = vP.y; vec3 c = mix(vec3(0.42,0.05,0.22), vec3(0.07,0.01,0.15), smoothstep(0.0, 0.3, h)); c = mix(c, vec3(0.006,0.0,0.02), smoothstep(0.25, 0.8, h));
            float st = step(0.997, hsh(floor(vP.xy * 400.0 + vP.z * 300.0))) * smoothstep(0.15, 0.5, h); c += st * vec3(0.9);
            c = mix(vec3(0.05,0.0,0.08), c, step(-0.02, h)); gl_FragColor = vec4(c, 1.0); }`, U, 400);
        const sun = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: U, fog: false,
          vertexShader: 'varying vec2 vU; void main(){ vU = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
          fragmentShader: `varying vec2 vU; uniform float uT; uniform float uFlare;
            void main(){ float r = length(vU) / 0.62; vec3 c = mix(vec3(1.0,0.15,0.55), vec3(1.0,0.88,0.3), smoothstep(-0.6, 0.6, vU.y));
              float y = vU.y; float lower = clamp(-y / 0.6, 0.0, 1.0);
              float gap = step(1.0 - (0.08 + 0.5 * lower), fract((y - uT * 0.05) * 11.0)) * step(0.0, -y);
              float disc = (1.0 - smoothstep(0.985, 1.0, r)) * (1.0 - gap);
              float halo = exp(-max(r - 1.0, 0.0) * 3.0) * 0.45 * (1.0 + uFlare * 3.0);
              gl_FragColor = vec4(c * (disc * 1.15 + halo * 0.6 * (1.0 - disc)), max(disc, halo * 0.7)); }` }));
        sun.scale.set(150, 150, 1); sun.position.set(0, 30, -260); sc.add(sun);
        const ter = new THREE.PlaneGeometry(220, 300, 200, 240); ter.rotateX(-Math.PI / 2); ter.translate(0, 0, -130);
        const tm = new THREE.ShaderMaterial({ uniforms: U, extensions: { derivatives: true },
          vertexShader: `uniform float uOff; uniform float uSteer; varying vec3 vW; varying float vH; ${NOISE_GLSL}
            float height(vec2 p){ float side = smoothstep(9.0, 40.0, abs(p.x - uSteer * (p.y * p.y) * 0.0004)); return side * (fbm(p * 0.04) * 26.0 + fbm(p * 0.15) * 4.0) - 0.0; }
            varying float vZ;
            void main(){ vec3 p = position; vZ = p.z; vec2 q = vec2(p.x, p.z - uOff); p.y = height(q); vH = p.y; vW = vec3(p.x, p.y, p.z - uOff); vec4 mv = modelViewMatrix * vec4(p,1.0); gl_Position = projectionMatrix * mv; }`,
          fragmentShader: `varying vec3 vW; varying float vH; varying float vZ; uniform float uT;
            void main(){ vec2 g = vW.xz / 4.0; vec2 a = abs(fract(g - 0.5) - 0.5) / fwidth(g); float line = 1.0 - min(min(a.x, a.y), 1.0);
              float dist = length(vW.xz - vec2(0.0, vW.z)); vec3 base = mix(vec3(0.025,0.0,0.05), vec3(0.09,0.0,0.12), clamp(vH / 25.0, 0.0, 1.0));
              vec3 lc = mix(vec3(1.0,0.12,0.75), vec3(0.1,0.85,1.0), clamp(vH / 22.0, 0.0, 1.0));
              float sunRef = exp(-abs(vW.x) * 0.12) * 0.35 * step(vH, 0.5);
              float fade = smoothstep(-280.0, -30.0, vZ); vec3 haze = vec3(0.42,0.05,0.22);
              vec3 col = base + lc * line * 1.3 * fade + vec3(1.0,0.35,0.55) * sunRef; col = mix(haze * 0.6, col, 0.25 + 0.75 * fade); gl_FragColor = vec4(col, 1.0); }` });
        const terrain = new THREE.Mesh(ter, tm); terrain.frustumCulled = false; sc.add(terrain);
        // palm silhouettes
        const palmMat = new THREE.MeshBasicMaterial({ color: 0x07010c });
        for (let i = 0; i < 6; i++) {
          const side = i % 2 ? 1 : -1, x = side * rand(14, 30), z = -rand(20, 120), h = rand(12, 18), lean = side * rand(0.5, 2);
          const trunk = new THREE.CatmullRomCurve3([new THREE.Vector3(x, 0, z), new THREE.Vector3(x + lean * 0.4, h * 0.5, z), new THREE.Vector3(x + lean, h, z)]);
          const fronds = []; for (let k = 0; k < 9; k++) { const a = k / 9 * TAU, L = rand(4, 6); fronds.push(new THREE.CatmullRomCurve3([new THREE.Vector3(x + lean, h, z), new THREE.Vector3(x + lean + Math.cos(a) * L * 0.5, h + 1.2, z + Math.sin(a) * L * 0.5), new THREE.Vector3(x + lean + Math.cos(a) * L, h - 1.8, z + Math.sin(a) * L)])); }
          sc.add(new THREE.Mesh(tubes(THREE, [trunk], 20, 6, (t) => 0.5 - t * 0.25), palmMat), new THREE.Mesh(tubes(THREE, fronds, 16, 4, (t) => 0.22 * (1 - t) + 0.02), palmMat));
        }
        const sp = particles(X, 900);
        d.t3 = { U, sp, cam: {}, gl: glyphLayer(X, S, { R: 3.4, center: new THREE.Vector3(0, 6.5, -10), size: 0.62, weight: 'bold', glow: 2.6 }) };
        d.t3.web = webLayer(X, S, [{ k: 1 }, { k: 1.6 }, { k: 2, pulse: 1 }, { k: 2.6, zig: 0.35, pulse: 2 }], sp);
      },
      update(S, X, now, dt) {
        const d = S.data, t = d.t3; if (!t) return;
        const THREE = X.THREE, p = power(S), inside = S.ptrInside !== false;
        t.U.uT.value = now / 1000; t.U.uOff.value += dt * (0.012 + 0.03 * S.stage + (S.holding ? 0.01 : 0)) * (S.reduceMotion ? 0.4 : 1);
        const steer = inside ? (S.ptr.x / S.W - 0.5) : 0; t.U.uSteer.value += (steer * 30 - t.U.uSteer.value) * 0.03;
        const ft = (now - d.flare) / 1500; t.U.uFlare.value = ft >= 0 && ft < 1 ? 1 - ft : 0;
        X.camera.position.set(steer * 6, 5.5 + (inside ? (0.5 - S.ptr.y / S.H) * 3 : 0), 14); X.camera.lookAt(steer * 10, 7, -60);
        X.camera.rotation.z = -steer * 0.05;
        t.gl.update(S); t.web.update(S); t.sp.update(X, dt);
        if (S.holding && S.stage >= 2) for (let i = 0; i < S.stage; i++) t.sp.add(rand(-12, 12), rand(0.2, 1), -rand(30, 90), 0, 0, 0.6 + 0.3 * S.stage, 2.5, 0.4, 1.6, 0.3, 900, 0, 1);
      }
    },
    onRelease(S) { const d = S.data; d.flare = S.now; const t = d.t3; if (t) for (let i = 0; i < 120; i++) { const a = rand(0, TAU), v = rand(0.1, 0.4); t.sp.add(0, 6.5, -10, Math.cos(a) * v, Math.sin(a) * v, rand(-0.1, 0.1), i % 2 ? 0.3 : 2.6, i % 2 ? 2.2 : 0.4, 2.4, 0.4, 1400, 0, 0.97); } return false; },
    hud(S) {
      if (S.holding) return ['cruising', 'overtaking', 'redline', '1986 forever'][S.stage];
      return 'NOW PLAYING · SPHERE_OUTRUN.WAV · 118 BPM · steer with the pointer';
    }
  }));

  /* ======================= 11. STORM: volumetric clouds, lightning and a lighthouse at sea ======================= */
  function bolt3(THREE, a, b, disp, depth) {
    let pts = [a.clone(), b.clone()];
    for (let d = 0; d < depth; d++) {
      const np = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) { const m = pts[i].clone().lerp(pts[i + 1], 0.5).add(new THREE.Vector3(rand(-1, 1) * disp, rand(-0.3, 0.3) * disp, rand(-1, 1) * disp)); np.push(m, pts[i + 1]); }
      pts = np; disp *= 0.55;
    }
    return pts;
  }
  SP.addMode(base3d({
    id: 'storm', name: 'STORM', glyphs: G('ϟ↯≋∿≈⌁∴', 'ϟ≈∿∴'),
    base: [210, 30, 82], palette: [[205, 70, 82], [195, 100, 72], [260, 80, 80]], noHueShift: true,
    count: 70, pageBg: ['#0b1220', '#020306'],
    shapes: ['sphere', 'lorenz', 'galaxy', 'torus', 'helix', 'aizawa', 'thomas', 'halvorsen'],
    init(S) { Object.assign(S.data, { strikes: 0, lastStrike: 0, next: 0 }); },
    three: {
      init(S, X) {
        const THREE = X.THREE, d = S.data, sc = X.scene, nz = X.noise;
        X.maxPixelRatio = 1.15; X.setBloom(1.0, 0.5, 0.6); X.setExposure(1.0);
        sc.fog = new THREE.Fog(0x070a12, 40, 260);
        const U = { uFlashP: { value: new THREE.Vector3(0, 40, -80) }, uFlash: { value: 0 }, uT: { value: 0 } };
        skyDome(THREE, sc, 'varying vec3 vP; uniform float uFlash; void main(){ float h = max(vP.y, 0.0); vec3 c = mix(vec3(0.05,0.06,0.08), vec3(0.01,0.012,0.02), pow(h, 0.5)) + vec3(0.25,0.28,0.4) * uFlash * 0.5; gl_FragColor = vec4(c, 1.0); }', U, 400);
        let water = null;
        if (THREE.Water) { water = new THREE.Water(new THREE.PlaneGeometry(800, 800), { textureWidth: 512, textureHeight: 512, waterNormals: noiseNormal(X, 256, 3, 9), sunDirection: new THREE.Vector3(0.2, 1, -0.4).normalize(), sunColor: 0x0b0d12, waterColor: 0x010305, distortionScale: 4.5, fog: true }); water.rotation.x = -Math.PI / 2; water.material.uniforms.size.value = 2.5; sc.add(water); }
        // clouds: billboards with procedural puff textures, lit from inside by the lightning
        const puffs = [puffTexture(X, 128, 1.3), puffTexture(X, 128, 7.1), puffTexture(X, 128, 3.7)];
        const clouds = [];
        for (let i = 0; i < 46; i++) {
          const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, uniforms: { map: { value: pick(puffs) }, uFlashP: U.uFlashP, uFlash: U.uFlash },
            vertexShader: 'varying vec2 vU; varying vec3 vW; void main(){ vU = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
            fragmentShader: 'uniform sampler2D map; uniform vec3 uFlashP; uniform float uFlash; varying vec2 vU; varying vec3 vW; void main(){ vec4 t = texture2D(map, vU); float l = uFlash * exp(-distance(vW, uFlashP) / 45.0); vec3 c = mix(vec3(0.07,0.08,0.1), vec3(0.85,0.9,1.0), clamp(l, 0.0, 1.0)) * (0.55 + 0.45 * t.r) + vec3(0.6,0.7,1.0) * l * 0.6; gl_FragColor = vec4(c, t.a * 0.9); }' });
          const c = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m), s = rand(40, 90);
          c.scale.set(s, s * 0.6, 1); c.position.set(rand(-160, 160), rand(45, 75), rand(-220, -40)); c.renderOrder = -5; sc.add(c); clouds.push(c);
        }
        // a lighthouse on a rock, with a sweeping beam
        const rock = new THREE.Mesh(displace(new THREE.IcosahedronGeometry(9, 4), nz, 0.35, 0.25, 2), new THREE.MeshStandardMaterial({ color: 0x1d2024, roughness: 0.9 }));
        rock.scale.y = 0.45; rock.position.set(-38, -1, -70); sc.add(rock);
        const bands = X.canvasTexture(64, 256, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#e8e4dc' : '#a8201c'; c.fillRect(0, i * h / 8, w, h / 8); } });
        const tower = new THREE.Mesh(new THREE.LatheGeometry([[1.9, 0], [1.4, 14], [1.45, 14.3], [1.1, 14.3]].map((p) => new THREE.Vector2(p[0], p[1])), 32), new THREE.MeshStandardMaterial({ map: bands, roughness: 0.7 }));
        tower.position.set(-38, 2.5, -70); sc.add(tower);
        const lamp = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 1.6, 24), new THREE.MeshStandardMaterial({ color: 0x222, emissive: 0xfff1c8, emissiveIntensity: 3 }));
        lamp.position.set(-38, 17.6, -70); sc.add(lamp);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(1.4, 1.6, 24), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.6 })); cap.position.set(-38, 19.2, -70); sc.add(cap);
        const beamG = new THREE.ConeGeometry(9, 90, 32, 1, true); beamG.translate(0, -45, 0); beamG.rotateZ(Math.PI / 2);
        const beam = new THREE.Mesh(beamG, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
          vertexShader: 'varying float vX; void main(){ vX = position.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
          fragmentShader: 'varying float vX; void main(){ float f = exp(-vX / 35.0); gl_FragColor = vec4(vec3(1.0,0.95,0.8) * f * 0.12, 1.0); }' }));
        beam.position.copy(lamp.position); sc.add(beam);
        const beamL = new THREE.SpotLight(0xfff1c8, 4000, 200, 0.12, 0.5, 2); beamL.position.copy(lamp.position); sc.add(beamL, beamL.target);
        // rain: streaks animated on the GPU, bending away from the pointer
        const RN = 3800, rg = new THREE.BufferGeometry(), RP = new Float32Array(RN * 6), RS = new Float32Array(RN * 2);
        for (let i = 0; i < RN; i++) { const x = rand(-60, 60), y = rand(0, 60), z = rand(-80, 10), s = rand(0.8, 1.2); RP.set([x, y, z, x, y + 1.6, z], i * 6); RS[i * 2] = s; RS[i * 2 + 1] = s; }
        rg.setAttribute('position', new THREE.BufferAttribute(RP, 3)); rg.setAttribute('spd', new THREE.BufferAttribute(RS, 1));
        const RU = { uT: U.uT, uWind: { value: 0.3 }, uPtr: { value: new THREE.Vector3(0, -99, 0) }, uFlash: U.uFlash };
        const rain = new THREE.LineSegments(rg, new THREE.ShaderMaterial({ uniforms: RU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
          vertexShader: `attribute float spd; uniform float uT; uniform float uWind; uniform vec3 uPtr; varying float vA;
            void main(){ vec3 p = position; float y = mod(p.y - uT * 38.0 * spd, 60.0); p.x += uWind * (60.0 - y) * 0.15; p.y = y + (p.y - position.y);
              vec2 dd = p.xz - uPtr.xz; float r = length(vec2(p.x - uPtr.x, p.y - uPtr.y)); if (r < 6.0 && abs(p.z - uPtr.z) < 8.0) p.x += sign(p.x - uPtr.x) * (6.0 - r) * 0.8;
              vA = 0.13; gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0); }`,
          fragmentShader: 'varying float vA; uniform float uFlash; void main(){ gl_FragColor = vec4(vec3(0.55,0.62,0.75) * (vA + uFlash * 0.4), 1.0); }' }));
        rain.frustumCulled = false; sc.add(rain);
        const flashL = new THREE.PointLight(0xc8d6ff, 0, 400, 2); sc.add(flashL);
        sc.add(new THREE.HemisphereLight(0x2a3346, 0x020304, 0.35));
        const sp = particles(X, 600);
        d.t3 = { U, RU, water, clouds, beam, beamL, lampP: lamp.position.clone(), flashL, bolts: [], sp, cam: {}, ptrW: new THREE.Vector3(),
          gl: glyphLayer(X, S, { R: 6, center: new THREE.Vector3(0, 14, -40), size: 0.9, glow: 2.2 }) };
        d.t3.web = webLayer(X, S, [{ k: 0.8 }, { k: 1.4, zig: 0.4 }, { k: 1.8, zig: 0.6, pulse: 1 }, { k: 2.4, zig: 0.9, pulse: 2 }], sp);
        d.t3.strike = (a, b, big) => {
          const pts = bolt3(THREE, a, b, a.distanceTo(b) * 0.18, 6), curves = [new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0)];
          for (let k = 0; k < (big ? 4 : 2); k++) { const i = Math.floor(rand(10, pts.length * 0.7)), s = pts[i], e = s.clone().add(new THREE.Vector3(rand(-14, 14), -rand(8, 20), rand(-8, 8))); curves.push(new THREE.CatmullRomCurve3(bolt3(THREE, s, e, 4, 4), false, 'catmullrom', 0)); }
          const mesh = new THREE.Mesh(tubes(THREE, curves, 90, 4, (t, ci) => (ci ? 0.08 : big ? 0.22 : 0.14) * (1 - t * 0.5)), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 6, 9), transparent: true }));
          sc.add(mesh); d.t3.bolts.push({ mesh, t: S.now, life: big ? 420 : 260 });
          U.uFlashP.value.copy(a.clone().lerp(b, 0.3)); flashL.position.copy(b).add(new THREE.Vector3(0, 6, 0));
          d.t3.flashMax = big ? 1 : 0.7; d.t3.flashT = S.now;
        };
      },
      update(S, X, now, dt) {
        const d = S.data, t = d.t3; if (!t) return;
        const THREE = X.THREE;
        t.U.uT.value = now / 1000;
        if (t.water) t.water.material.uniforms.time.value += dt / 1200;
        rig(X, S, t.cam, { target: new THREE.Vector3(0, 12, -60), dist: 64, el: 0.04, spin: 0, pa: 0.4, pe: 0.1, dolly: 0.12 });
        t.clouds.forEach((c) => { c.quaternion.copy(X.camera.quaternion); c.position.x += dt * 0.002; if (c.position.x > 170) c.position.x = -170; });
        t.gl.update(S); t.web.update(S); t.sp.update(X, dt);
        const pw = X.fromScreen(S.ptr.x, S.ptr.y, -10); t.RU.uPtr.value.copy(pw);
        t.RU.uWind.value += ((S.holding ? (S.ptr.x / S.W - 0.5) * 2 : 0.3) + clamp(pvel(S).x * 0.05, -1, 1) - t.RU.uWind.value) * 0.03;
        const ang = now * 0.0006; t.beam.rotation.y = ang; t.beamL.target.position.set(t.lampP.x + Math.cos(-ang) * 50, 0, t.lampP.z + Math.sin(-ang) * 50);
        if (now > d.next) { d.next = now + rand(3500, 8000) * (S.holding ? 0.5 : 1); const x = rand(-120, 120), z = rand(-200, -90); t.strike(new THREE.Vector3(x, 60, z), new THREE.Vector3(x + rand(-30, 30), 0, z + rand(-10, 10)), false); }
        if (S.holding && S.stage >= 2 && now - d.lastStrike > 650 - S.stage * 120) { const n = pick(S.active.filter((q) => q.inf && q.data.wp)); if (n) { d.lastStrike = now; t.strike(new THREE.Vector3(n.data.wp.x + rand(-15, 15), 60, n.data.wp.z), n.data.wp, false); d.strikes++; } }
        // flash and flicker (steady fade under reduced motion)
        const ft = now - (t.flashT || -1e9), fl = ft < 500 ? (t.flashMax || 0) * (1 - ft / 500) * (S.reduceMotion ? 0.35 : (Math.floor(ft / 50) % 3 === 1 ? 0.3 : 1)) : 0;
        t.U.uFlash.value = fl; t.flashL.intensity = fl * 1.6e5;
        t.bolts = t.bolts.filter((b) => { const a = 1 - (now - b.t) / b.life; if (a <= 0) { X.scene.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh.material.dispose(); return false; } b.mesh.material.opacity = S.reduceMotion ? a : a * (Math.floor((now - b.t) / 45) % 3 === 1 ? 0.4 : 1); return true; });
      }
    },
    onClimax(S) { const t = S.data.t3, s = S.seed; if (t && s && s.data.wp) { t.strike(new window.THREE.Vector3(s.data.wp.x, 70, s.data.wp.z), s.data.wp, true); S.data.strikes++; } return false; },
    onRelease(S) {
      const d = S.data, t = d.t3; if (!t) return false;
      const inf = S.active.filter((n) => n.inf && n.data.wp);
      for (let k = 0; k < Math.min(6, inf.length); k++) { const w = inf[Math.floor(k * inf.length / Math.min(6, inf.length))].data.wp; t.strike(new window.THREE.Vector3(w.x + rand(-20, 20), 70, w.z), w, k === 0); d.strikes++; }
      return false;
    },
    hud(S) {
      const d = S.data, rm = S.reduceMotion ? ' · no strobe (reduced motion)' : '';
      if (S.holding) return `pressure ${980 - S.stage * 12} hPa ↓ · strikes ${d.strikes} · a bolt is ~30 000 K, five times the Sun's surface${rm}`;
      return `force 9 · strikes ${d.strikes} · flash-to-bang 3 s ≈ 1 km · the keeper is awake${rm}`;
    }
  }));

  const AUDIO = { ac: null, bus: null, master: null, muted: false, last: 0, voices: [], key: null };
  function audioInit() {
    if (AUDIO.ac) { if (AUDIO.ac.state === 'suspended') AUDIO.ac.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const ac = AUDIO.ac = new AC();
      const master = AUDIO.master = ac.createGain(); master.gain.value = AUDIO.muted ? 0 : 0.07; master.connect(ac.destination);
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; lp.connect(master);
      const dl = ac.createDelay(1), fb = ac.createGain(), wet = ac.createGain(); dl.delayTime.value = 0.27; fb.gain.value = 0.32; wet.gain.value = 0.35;
      lp.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(master);
      AUDIO.bus = lp;
    } catch (e) { AUDIO.ac = null; }
  }
  const PENTA = [0, 3, 5, 7, 10];
  const noteFreq = (i) => 220 * Math.pow(2, (12 * Math.floor(i / 5) + PENTA[((i % 5) + 5) % 5]) / 12);
  const WAVES = ['sine', 'triangle', 'sawtooth', 'square'], WVOL = [0.55, 0.5, 0.2, 0.15];
  function playNote(freq, stage, dur, delay) {
    const A = AUDIO; if (!A.ac || !A.bus || A.muted || A.ac.state !== 'running') return false;
    const t = A.ac.currentTime + (delay || 0);
    A.voices = A.voices.filter((v) => v > A.ac.currentTime);
    if (A.voices.length > 14) return false;
    try {
      const o = A.ac.createOscillator(), g = A.ac.createGain();
      o.type = WAVES[stage]; o.frequency.value = freq;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(WVOL[stage], t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(A.bus); o.start(t); o.stop(t + dur + 0.05);
      A.voices.push(t + dur);
      return true;
    } catch (e) { return false; }
  }
  const LOG = [
    '[ OK ] mounted /dev/sphere on /mnt/universe', 'bypassing mainframe… just kidding, it\'s a CV', 'decrypting resume.pdf with ROT26 (twice as secure)',
    'ssh root@sphere -p 1337 … connected', 'compiling feelings.c … 3 warnings, 0 errors', 'sudo make me a sandwich', 'scanning ports 1-65535 … all closed, hobbies open',
    'loading thermodynamics.so … entropy increasing as expected', 'git push --force   # sorry', 'traceroute andromeda.galaxy … 2.5 Mly, 14 hops',
    "INSERT INTO students VALUES ('Robert'); DROP TABLE students;--", 'downloading more RAM … 99%', 'calculating FoS … 1.5 (the .5 is vibes)', 'hacking the Gibson …',
    'ping universe … 42 ms', 'kernel: sphere: letter overflow, infecting neighbours', 'chmod 777 /heart', 'awaiting coffee … [##########] 100%',
    'npm install common-sense … 404 not found', 'rm -rf /doubts … permission denied', 'echo $PURPOSE … 42', 'solving Navier-Stokes … give me a minute (or a millennium prize)'
  ];
  const hex = () => '0x' + Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');

  /* ======================= 12. ALCHEMY: an alchemist's bench by candlelight ======================= */
  const ALC = G('🜁🜂🜃🜄🜍🜔🜚🜛☉☽☿♀♂♃♄♁△▽', '☉☽☿♀♂♃♄△▽');
  function woodTexture(X, w, h, base) {
    const nz = X.noise;
    return X.canvasTexture(w, h, (c) => {
      const img = c.createImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const n = nz.noise(x * 0.004, y * 0.06, 0.5) * 6 + nz.noise(x * 0.03, y * 0.3, 2) * 0.8;
        const ring = 0.5 + 0.5 * Math.sin(y * 0.09 + n * 3), k = 0.55 + 0.45 * Math.pow(ring, 3) - 0.12 * nz.noise(x * 0.1, y * 0.1, 7);
        const o = (y * w + x) * 4; img.data[o] = base[0] * k; img.data[o + 1] = base[1] * k; img.data[o + 2] = base[2] * k; img.data[o + 3] = 255;
      }
      c.putImageData(img, 0, 0);
    });
  }
  function circleArt(c, w, col, lw) {
    c.save(); c.translate(w / 2, w / 2); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = lw;
    const r = w * 0.46;
    [1, 0.96, 0.8, 0.42, 0.22].forEach((f) => { c.beginPath(); c.arc(0, 0, r * f, 0, TAU); c.stroke(); });
    c.beginPath(); for (let k = 0; k <= 3; k++) { const a = -Math.PI / 2 + k * TAU / 3; c[k ? 'lineTo' : 'moveTo'](Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8); } c.stroke();
    c.beginPath(); for (let k = 0; k <= 3; k++) { const a = Math.PI / 2 + k * TAU / 3; c[k ? 'lineTo' : 'moveTo'](Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8); } c.stroke();
    c.strokeRect(-r * 0.42 / Math.SQRT2 * 1.4, -r * 0.42 / Math.SQRT2 * 1.4, r * 0.42 * Math.SQRT2 * 1.4 / 1.4 * 1.4, r * 0.42 * Math.SQRT2);
    c.font = `${Math.round(w * 0.028)}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const txt = 'VISITA INTERIORA TERRAE RECTIFICANDO INVENIES OCCULTUM LAPIDEM · SOLVE ET COAGULA · ';
    for (let i = 0; i < txt.length; i++) { c.save(); c.rotate(i / txt.length * TAU); c.fillText(txt[i], 0, -r * 0.88); c.restore(); }
    c.font = `${Math.round(w * 0.06)}px serif`;
    Array.from('☉☽☿♀♂♃♄').forEach((ch, k) => { const a = -Math.PI / 2 + k * TAU / 7; c.fillText(ch, Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62); });
    c.restore();
  }
  SP.addMode(base3d({
    id: 'alchemy', name: 'ALCHEMY', glyphs: ALC,
    base: [220, 8, 62], palette: [[45, 100, 56], [38, 100, 62], [52, 100, 80]], noHueShift: true,
    count: 60, pageBg: ['#140e04', '#030204'],
    shapes: ['sphere', 'stella_octangula', 'torus', 'icosahedron', 'dodecahedron', 'cube', 'cell5', 'octahedron'],
    init(S) { S.data.opus = -1e9; S.data.gold = 0; },
    three: {
      init(S, X) {
        const THREE = X.THREE, d = S.data, sc = X.scene;
        X.maxPixelRatio = 1.3; const env = X.studioEnvironment(); X.setBloom(0.75, 0.55, 0.78); X.setExposure(0.95);
        sc.fog = new THREE.FogExp2(0x0a0603, 0.045);
        skyDome(THREE, sc, 'varying vec3 vP; void main(){ vec3 c = mix(vec3(0.004,0.002,0.001), vec3(0.03,0.016,0.006), smoothstep(-0.3, 0.4, vP.y) * (1.0 - smoothstep(0.4, 1.0, vP.y))); gl_FragColor = vec4(c, 1.0); }', null, 80);
        const wood = woodTexture(X, 1024, 512, [120, 74, 40]); wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
        const table = new THREE.Mesh(RBox(THREE, 16, 0.7, 9, 3, 0.12), new THREE.MeshStandardMaterial({ map: wood, bumpMap: wood, bumpScale: 0.02, roughness: 0.62, envMapIntensity: 0.25 }));
        table.position.y = -0.35; table.receiveShadow = true; sc.add(table);
        // the transmutation circle, burned into the wood; its gold inlay lights up as you hold
        const circ = X.canvasTexture(1024, 1024, (c, w) => circleArt(c, w, '#fff', 5));
        const inlay = new THREE.Mesh(new THREE.CircleGeometry(3.2, 96), new THREE.MeshStandardMaterial({ color: 0x2a1408, alphaMap: circ, transparent: true, roughness: 0.4, metalness: 0.8, emissive: 0xffb040, emissiveMap: circ, emissiveIntensity: 0.05, depthWrite: false }));
        inlay.rotation.x = -Math.PI / 2; inlay.position.y = 0.006; inlay.receiveShadow = true; sc.add(inlay);
        // candles with flames and flickering lights
        const wax = new THREE.MeshPhysicalMaterial({ color: 0xf1e6cf, roughness: 0.55, sheen: new THREE.Color(0x553311), emissive: 0xff9a40, emissiveIntensity: 0.05 });
        const flames = particles(X, 60, { hard: 1.3 }), candles = [];
        [[-5.5, -2.2, 1.6], [5.8, -1.6, 1.1], [-4.6, 2.6, 0.8]].forEach(([x, z, h], i) => {
          const g = new THREE.LatheGeometry([[0, 0], [0.32, 0], [0.32, h], [0.28, h + 0.05], [0.05, h + 0.02], [0, h + 0.02]].map((p) => new THREE.Vector2(p[0], p[1])), 32);
          const m = new THREE.Mesh(g, wax); m.position.set(x, 0, z); m.castShadow = true; sc.add(m);
          const L = new THREE.PointLight(0xffa24a, 16, 16, 2); L.position.set(x, h + 0.5, z); sc.add(L);
          if (i === 0) { const sl = new THREE.SpotLight(0xffa24a, 30, 20, 1.2, 0.9, 2); sl.position.set(x, h + 0.55, z); sl.target.position.set(x + 4, 0, z + 2); sl.castShadow = true; sl.shadow.mapSize.set(1024, 1024); sl.shadow.bias = -0.002; sc.add(sl, sl.target); candles.sl = sl; }
          candles.push({ L, x, y: h + 0.32, z, ph: rand(0, 9) });
        });
        // glassware: a round-bottomed flask with a glowing tincture, a retort and vials
        const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0, transparent: true, opacity: 0.18, envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false });
        const flaskP = []; for (let i = 0; i <= 24; i++) { const a = -Math.PI / 2 + i / 24 * (Math.PI * 0.86); flaskP.push(new THREE.Vector2(Math.cos(a) * 1.1, 1.1 + Math.sin(a) * 1.1)); }
        flaskP.push(new THREE.Vector2(0.28, 2.3), new THREE.Vector2(0.26, 3.4), new THREE.Vector2(0.32, 3.45));
        const flask = new THREE.Mesh(new THREE.LatheGeometry(flaskP, 48), glass); flask.position.set(2.6, 0, -1.2); sc.add(flask);
        const liqU = { uT: { value: 0 }, uGlow: { value: 0.4 } };
        const liq = new THREE.Mesh(new THREE.SphereGeometry(1.02, 48, 24, 0, TAU, Math.PI * 0.42, Math.PI * 0.58), new THREE.MeshPhysicalMaterial({ color: 0x1a6a30, roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.85, emissive: 0x30ff70, emissiveIntensity: 0.4 }));
        liq.position.set(2.6, 1.1, -1.2); sc.add(liq);
        const retortC = new THREE.CatmullRomCurve3([new THREE.Vector3(-1.6, 1.6, -2.2), new THREE.Vector3(-2.1, 2.8, -2.4), new THREE.Vector3(-3.4, 2.4, -2.0), new THREE.Vector3(-4.4, 1.0, -1.6)]);
        sc.add(new THREE.Mesh(tubes(THREE, [retortC], 40, 16, (t) => 0.26 - t * 0.18), glass));
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.95, 40, 24), glass); bulb.position.set(-1.4, 0.95, -2.2); sc.add(bulb);
        const bliq = new THREE.Mesh(new THREE.SphereGeometry(0.9, 40, 16, 0, TAU, Math.PI * 0.55, Math.PI * 0.45), new THREE.MeshPhysicalMaterial({ color: 0x5a0a20, roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.9, emissive: 0xff2050, emissiveIntensity: 0.25 }));
        bliq.position.copy(bulb.position); sc.add(bliq);
        [[0x3070ff, 4.8], [0xffc040, 5.3], [0xa030ff, 5.8]].forEach(([c, x]) => {
          const v = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.4, 24, 1, true), glass); v.position.set(x, 0.7, 2.4); sc.add(v);
          const l = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.8, 24), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6, roughness: 0.2, transparent: true, opacity: 0.85 })); l.position.set(x, 0.42, 2.4); sc.add(l);
        });
        // the lead ingot that becomes gold
        const tr = new THREE.Shape([[-1.0, 0], [1.0, 0], [0.8, 0.55], [-0.8, 0.55]].map((p) => new THREE.Vector2(p[0], p[1])));
        const ig = new THREE.ExtrudeGeometry(tr, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3 }); ig.translate(0, 0, -0.45);
        const ingotMat = new THREE.MeshStandardMaterial({ color: 0x6f747c, metalness: 0.6, roughness: 0.5, envMapIntensity: 1 });
        const ingot = new THREE.Mesh(ig, ingotMat); ingot.position.set(0, 0.05, 0.5); ingot.castShadow = true; sc.add(ingot);
        sc.add(new THREE.HemisphereLight(0x402818, 0x050302, 0.25));
        const rim = new THREE.DirectionalLight(0x8fa8ff, 0.5); rim.position.set(-6, 6, -8); sc.add(rim);
        const smoke = particles(X, 500, { normal: true, hard: 0.9 }), sp = particles(X, 900);
        d.t3 = { candles, flames, smoke, sp, liqU, liq, inlay, ingotMat, cam: {}, lead: new THREE.Color(0x6f747c), au: new THREE.Color(0xffc35a),
          gl: glyphLayer(X, S, { R: 2.4, center: new THREE.Vector3(0, 3.6, 0.3), size: 0.5, family: 'serif', glow: 2.4, dim: 0.6 }) };
        d.t3.web = webLayer(X, S, [{ k: 0.7 }, { k: 1.2 }, { k: 1.6, pulse: 1 }, { k: 2.2, pulse: 2 }], sp);
      },
      update(S, X, now, dt) {
        const d = S.data, t = d.t3; if (!t) return;
        const p = power(S), k = dt / 16.7;
        rig(X, S, t.cam, { target: new X.THREE.Vector3(0, 1.6, 0), dist: 12, el: 0.32, spin: 0.00003, pa: 0.6, pe: 0.25, dolly: 0.22 });
        t.gl.update(S, (n, c) => { const g = n.data.au || 0; n.data.au = clamp(g + (n.inf ? dt / 900 : -dt / 2600), 0, 1); c.setRGB(lerp(0.45, 2.6, n.data.au), lerp(0.47, 1.8, n.data.au), lerp(0.52, 0.45, n.data.au)); });
        t.web.update(S);
        const frac = S.active.length ? S.active.reduce((m, n) => m + (n.data.au || 0), 0) / S.active.length : 0;
        d.gold = frac;
        t.ingotMat.color.copy(t.lead).lerp(t.au, frac); t.ingotMat.metalness = lerp(0.6, 1, frac); t.ingotMat.roughness = lerp(0.5, 0.18, frac);
        t.inlay.material.emissiveIntensity = 0.05 + 2.2 * p;
        t.liqU.uT.value = now / 1000; t.liq.material.emissiveIntensity = 0.35 + 0.5 * p + 0.1 * Math.sin(now * 0.004);
        // candle flames: a stacked soft flame plus a flickering light
        t.candles.forEach((c) => {
          const f = S.reduceMotion ? 1 : 0.85 + 0.15 * Math.sin(now * 0.013 + c.ph) * Math.sin(now * 0.031 + c.ph * 2);
          c.L.intensity = 14 * f + 6 * p;
          t.flames.add(c.x + rand(-0.01, 0.01), c.y + 0.05, c.z, 0, 0.012, 0, 2.4, 1.2, 0.35, 0.28 * f, 160, 0, 1, { shrink: 1 });
          t.flames.add(c.x, c.y + 0.12, c.z, 0, 0.004, 0, 3, 2.4, 1.6, 0.12, 120, 0, 1);
        });
        t.flames.update(X, dt);
        if (Math.random() < 0.4) t.smoke.add(2.6 + rand(-0.1, 0.1), 3.5, -1.2, rand(-0.003, 0.003), 0.012, rand(-0.003, 0.003), 0.35, 0.38, 0.34, rand(0.25, 0.45), 4200, -0.00002, 0.995, { fadeIn: 600 });
        if (pspeed(S) > 2) { const w = X.fromScreen(S.ptr.x, S.ptr.y, 0); t.smoke.add(w.x, w.y, 0, pvel(S).x * 0.002, 0.01, 0, 0.4, 0.4, 0.42, 0.4, 2400, -0.00002, 0.99, { fadeIn: 300 }); }
        t.smoke.update(X, dt, (q) => { q.size += 0.004 * k; return true; });
        if (S.holding && Math.random() < 0.3 * S.stage) t.sp.add(rand(-0.9, 0.9), 0.65, 0.5 + rand(-0.4, 0.4), rand(-0.005, 0.005), 0.025, 0, 2.6, 1.8, 0.5, 0.08, 1200, 0, 0.99);
        t.sp.update(X, dt);
      }
    },
    onRelease(S) {
      const d = S.data, t = d.t3; d.opus = S.now;
      if (t) for (let i = 0; i < 260; i++) { const a = rand(0, TAU), v = rand(0.02, 0.09); t.sp.add(0, 0.6, 0.5, Math.cos(a) * v, rand(0.04, 0.14), Math.sin(a) * v, 2.8, 2, 0.6, rand(0.05, 0.12), rand(1400, 2400), 0.0025, 0.985); }
      return false;
    },
    hud(S) {
      const d = S.data;
      if (S.holding) return `transmutation ${Math.round(d.gold * 100)}% · Pb (82) → Au (79): three protons short, as usual`;
      if (S.now - d.opus < 5000) return 'magnum opus · yield 0.0003 g Au · cost: one soul (refundable)';
      return "lead → gold · philosopher's stone: pending peer review";
    }
  }));

  /* ======================= 13. SYNTH: a 3D spectrogram waterfall that you play ======================= */
  SP.addMode(base3d({
    id: 'music', name: 'SYNTH', glyphs: G('♪♫♩♬♭♮♯', '♪♫♩♬♭♮♯'),
    base: [200, 40, 82], palette: [[180, 100, 60], [300, 100, 66], [55, 100, 60], [120, 100, 56]],
    count: 56, pageBg: ['#0b0420', '#020a12'],
    shapes: ['sphere', 'harmonic', 'torus', 'lissajous', 'rose', 'helix', 'cinquefoil', 'torus_knot'],
    init(S) {
      const d = S.data; d.eq = new Float32Array(64); d.notes = [];
      AUDIO.key = (e) => { if (e.target && /input|textarea|select/i.test(e.target.tagName)) return; if (e.key === 's' || e.key === 'S') { AUDIO.muted = !AUDIO.muted; if (AUDIO.master) AUDIO.master.gain.value = AUDIO.muted ? 0 : 0.07; } };
      document.addEventListener('keydown', AUDIO.key);
    },
    exit() { if (AUDIO.key) document.removeEventListener('keydown', AUDIO.key); AUDIO.key = null; },
    onPress() { audioInit(); },
    onInfect(S, n) {
      const d = S.data, ry = n.ry === undefined ? 0 : n.ry, i = clamp(Math.floor((0.5 - ry * 0.5) * 15), 0, 14), f = noteFreq(i), band = Math.floor(i / 15 * 64);
      for (let k = -3; k <= 3; k++) { const b = band + k; if (b >= 0 && b < 64) d.eq[b] = Math.min(1, d.eq[b] + 0.45 / (1 + Math.abs(k))); }
      if (S.now - AUDIO.last > 60) { AUDIO.last = S.now; playNote(f, S.stage, 0.7 - S.stage * 0.1); }
      const t = d.t3, p = n.data.wp; if (t && p) for (let k = 0; k < 5; k++) t.sp.add(p.x, p.y, p.z, rand(-0.03, 0.03), rand(0, 0.05), rand(-0.03, 0.03), 0.6, 2, 2.2, 0.08, 600, 0, 0.97);
    },
    three: {
      init(S, X) {
        const THREE = X.THREE, d = S.data, sc = X.scene, COLS = 64, ROWS = 96;
        X.maxPixelRatio = 1.25; X.studioEnvironment(); X.setBloom(0.7, 0.5, 0.85); X.setExposure(0.85);
        sc.fog = new THREE.Fog(0x05030c, 18, 46);
        const geo = new THREE.PlaneGeometry(18, 26, COLS - 1, ROWS - 1); geo.rotateX(-Math.PI / 2);
        const col = new Float32Array(COLS * ROWS * 3); geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
        geo.attributes.position.setUsage(THREE.DynamicDrawUsage);
        const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.3, metalness: 0.35, envMapIntensity: 0.6, emissive: 0xffffff, emissiveIntensity: 0.45 });
        mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= vColor * vColor;'); };
        const surf = new THREE.Mesh(geo, mat); sc.add(surf);
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x06060a, roughness: 0.12, metalness: 0.9, envMapIntensity: 0.25 }));
        floor.rotation.x = -Math.PI / 2; floor.position.y = -0.02; sc.add(floor);
        const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(-6, 10, 6); key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -12, right: 12, top: 16, bottom: -16, near: 1, far: 40 }); sc.add(key);
        sc.add(new THREE.HemisphereLight(0x4050a0, 0x050208, 0.35));
        const sp = particles(X, 700);
        d.t3 = { surf, geo, col, hist: new Float32Array(COLS * ROWS), COLS, ROWS, last: 0, sp, cam: {}, c: new THREE.Color(),
          gl: glyphLayer(X, S, { R: 2.6, center: new THREE.Vector3(0, 4.4, 4), size: 0.55, glow: 2.4 }) };
        d.t3.web = webLayer(X, S, [{ k: 0.8 }, { k: 1.3, zig: 0.12 }, { k: 1.7, zig: 0.2, pulse: 1 }, { k: 2.2, zig: 0.3, pulse: 2 }], sp);
      },
      update(S, X, now, dt) {
        const d = S.data, t = d.t3; if (!t) return;
        rig(X, S, t.cam, { target: new X.THREE.Vector3(0, 1.2, 1), dist: 21, el: 0.5, spin: 0.00002, pa: 0.8, pe: 0.3, dolly: 0.2 });
        t.gl.update(S); t.web.update(S); t.sp.update(X, dt);
        const decay = Math.pow(0.93, dt / 16.7), C = t.COLS, R = t.ROWS;
        for (let i = 0; i < C; i++) d.eq[i] = d.eq[i] * decay + (Math.random() < 0.04 ? 0.06 + (S.holding ? 0.1 : 0) : 0);
        // the pointer strums the band under it
        if (S.ptrInside !== false && pspeed(S) > 0.5) { const b = Math.floor(clamp(S.ptr.x / S.W, 0, 0.999) * C); for (let k = -2; k <= 2; k++) { const q = b + k; if (q >= 0 && q < C) d.eq[q] = Math.min(1, d.eq[q] + 0.08 * (1 + pspeed(S) * 0.1) / (1 + Math.abs(k))); } }
        if (now - t.last < 33) return;
        t.last = now;
        const H = t.hist; H.copyWithin(C, 0, C * (R - 1));
        for (let i = 0; i < C; i++) H[i] = Math.min(1, d.eq[i] + 0.04 * Math.sin(i * 0.4 + now * 0.002) + 0.03);
        const P = t.geo.attributes.position.array, col = t.col;
        for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
          const i = r * C + c, h = H[(R - 1 - r) * C + c], v = h * 2.2;
          P[i * 3 + 1] = v;
          // "magma"-like colormap
          const x = clamp(h, 0, 1), fade = 1 - (R - 1 - r) / R * 0.6;
          t.c.setRGB(Math.min(1, x * 2.2) * fade, Math.max(0, x * 1.6 - 0.45) * fade, (0.35 + 0.65 * Math.sin(x * 3.2)) * (0.5 + 0.5 * x) * fade);
          col[i * 3] = t.c.r; col[i * 3 + 1] = t.c.g; col[i * 3 + 2] = t.c.b;
        }
        t.geo.attributes.position.needsUpdate = true; t.geo.attributes.color.needsUpdate = true;
      }
    },
    onClimax() { [0, 2, 4, 7, 9].forEach((i, k) => playNote(noteFreq(i + 5), 1, 1.2, k * 0.07)); return false; },
    onRelease(S, held, pw) {
      [12, 9, 7, 4, 2, 0].forEach((i, k) => playNote(noteFreq(i), Math.min(3, S.stage), 0.9, k * 0.09));
      const d = S.data; for (let i = 0; i < 64; i++) d.eq[i] = Math.min(1, d.eq[i] + 0.3 + 0.5 * Math.random() * pw);
      return false;
    },
    hud(S) {
      const A = AUDIO;
      if (!A.ac) return '♪ hold to play: higher letters, higher notes · move the pointer to strum · S mutes · silent until you press';
      if (A.muted) return 'muted · S to unmute · the spectrogram still listens';
      return `♪ A minor pentatonic · ${WAVES[S.stage]} oscillator · ${A.voices.length} voices · time flows away from you`;
    }
  }));

  /* ======================= 14. BLUEPRINT: a CAD gear pair with a section cut and an FEA stress plot ======================= */
  function gearShape(THREE, teeth, m, bore, holes) {
    const rp = teeth * m / 2, ra = rp + m, rf = rp - 1.25 * m, s = new THREE.Shape();
    for (let i = 0; i < teeth; i++) {
      const a0 = i / teeth * TAU, w = TAU / teeth;
      const pts = [[rf, a0], [rf, a0 + w * 0.12], [rp, a0 + w * 0.22], [ra, a0 + w * 0.32], [ra, a0 + w * 0.5], [rp, a0 + w * 0.6], [rf, a0 + w * 0.7]];
      pts.forEach(([r, a], j) => { const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i === 0 && j === 0) s.moveTo(x, y); else s.lineTo(x, y); });
    }
    s.closePath();
    const b = new THREE.Path(); b.moveTo(bore, 0); b.absarc(0, 0, bore, 0, TAU * 0.96, false); b.lineTo(bore * 1.2, -bore * 0.25); b.lineTo(bore * 1.2, bore * 0.0); s.holes.push(b);
    for (let k = 0; k < holes; k++) { const a = k / holes * TAU, h = new THREE.Path(), r = (rf + bore) / 2; h.absarc(Math.cos(a) * r, Math.sin(a) * r, (rf - bore) * 0.26, 0, TAU, true); s.holes.push(h); }
    return { shape: s, rp };
  }
  const FEA_GLSL = `vec3 jet(float x){ x = clamp(x, 0.0, 1.0); return clamp(vec3(1.5 - abs(4.0 * x - 3.0), 1.5 - abs(4.0 * x - 2.0), 1.5 - abs(4.0 * x - 1.0)), 0.0, 1.0); }`;
  SP.addMode(base3d({
    id: 'blueprint', name: 'BLUEPRINT', glyphs: G('ABCDEFGHJKLMNPRSTUVXYZ0123456789Ø±°⌀⊥∥∠⌖', 'ABCDEFGHJKLMNPRSTUVXYZ0123456789'),
    base: [210, 40, 94], palette: [[0, 100, 60], [30, 100, 56], [56, 100, 55], [120, 80, 55], [190, 100, 62]], noHueShift: true,
    count: 48, pageBg: ['#0a2a5c', '#061630'],
    shapes: ['torus', 'helix', 'cell24', 'gyroid', 'mobius', 'dodecahedron', 'sphere', 'cube', 'octahedron'],
    init(S) { S.data.def = -1e9; },
    three: {
      init(S, X) {
        const THREE = X.THREE, d = S.data, sc = X.scene;
        X.maxPixelRatio = 1.4; X.studioEnvironment(); X.setBloom(0.25, 0.4, 0.95); X.setExposure(1.0);
        X.renderer.localClippingEnabled = true;
        const paper = X.canvasTexture(2048, 1280, (c, w, h) => {
          c.fillStyle = '#0d3a7e'; c.fillRect(0, 0, w, h);
          c.strokeStyle = 'rgba(255,255,255,0.07)'; c.lineWidth = 1; for (let x = 0; x < w; x += 16) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y < h; y += 16) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
          c.strokeStyle = 'rgba(255,255,255,0.14)'; for (let x = 0; x < w; x += 80) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y < h; y += 80) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
          c.strokeStyle = 'rgba(230,240,255,0.85)'; c.lineWidth = 4; c.strokeRect(40, 40, w - 80, h - 80); c.lineWidth = 1.5; c.strokeRect(54, 54, w - 108, h - 108);
          const bx = w - 640, by = h - 250; c.fillStyle = 'rgba(13,58,126,0.95)'; c.fillRect(bx, by, 586, 196); c.strokeRect(bx, by, 586, 196);
          c.fillStyle = 'rgba(230,240,255,0.9)'; c.font = '26px monospace';
          ['THE SPHERE · SPUR GEAR PAIR ASSY', 'm = 0.25 · z1 = 24 · z2 = 14 · α = 20°', 'MATERIAL 42CrMo4 · CASE HARDENED', 'DRAWN: ME · CHECKED: NOBODY · REV C', 'SCALE 1:1 · ISO 2768-m · SHEET 1/1'].forEach((t, i) => { c.fillText(t, bx + 18, by + 40 + i * 36); if (i) { c.beginPath(); c.moveTo(bx, by + 14 + i * 36); c.lineTo(bx + 586, by + 14 + i * 36); c.stroke(); } });
          c.font = '22px monospace'; for (let k = 0; k < 8; k++) c.fillText(String(k + 1), 54 + (w - 108) * (k + 0.5) / 8, 34);
        });
        const back = new THREE.Mesh(new THREE.PlaneGeometry(32, 20), new THREE.MeshBasicMaterial({ map: paper })); back.position.z = -4; sc.add(back);
        const U = { uAmp: { value: 0 }, uLoad: { value: new THREE.Vector3() }, uDef: { value: 0 }, uT: { value: 0 } };
        const clip = new THREE.Plane(new THREE.Vector3(0, 0, -1), 5);
        const steel = new THREE.MeshStandardMaterial({ color: 0x8e98a4, metalness: 0.8, roughness: 0.36, envMapIntensity: 0.55, clippingPlanes: [clip], clipShadows: true });
        steel.onBeforeCompile = (sh) => {
          Object.assign(sh.uniforms, U);
          sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uDef; uniform float uT; varying vec3 vWP2;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normal * uDef * sin(position.x * 3.0 + uT * 18.0) * 0.06;')
            .replace('#include <project_vertex>', '#include <project_vertex>\n vWP2 = (modelMatrix * vec4(transformed, 1.0)).xyz;');
          sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uAmp; uniform vec3 uLoad; varying vec3 vWP2;\n' + FEA_GLSL)
            .replace('#include <color_fragment>', '#include <color_fragment>\n float sv = exp(-distance(vWP2, uLoad) * 0.55) * (0.7 + 0.3 * sin(distance(vWP2, uLoad) * 9.0)); diffuseColor.rgb = mix(diffuseColor.rgb, jet(sv * 1.15), uAmp);');
        };
        steel.customProgramCacheKey = () => 'pm-fea';
        const cap = new THREE.MeshBasicMaterial({ color: 0x9c2a22, side: THREE.BackSide, clippingPlanes: [clip] });
        const edgeM = new THREE.LineBasicMaterial({ color: 0x050b18, transparent: true, opacity: 0.9, clippingPlanes: [clip] });
        const parts = new THREE.Group(); sc.add(parts);
        const addPart = (geo, x, y, z) => {
          const m = new THREE.Mesh(geo, steel); m.castShadow = m.receiveShadow = true;
          const c = new THREE.Mesh(geo, cap), e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), edgeM);
          const g = new THREE.Group(); g.add(m, c, e); g.position.set(x, y, z); parts.add(g); return g;
        };
        const ex = { depth: 0.9, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2, curveSegments: 24 };
        const g1 = gearShape(THREE, 24, 0.25, 0.55, 6), g2 = gearShape(THREE, 14, 0.25, 0.4, 0);
        const G1 = new THREE.ExtrudeGeometry(g1.shape, ex); G1.translate(0, 0, -0.45);
        const G2 = new THREE.ExtrudeGeometry(g2.shape, ex); G2.translate(0, 0, -0.45);
        const cdist = g1.rp + g2.rp, x1 = -cdist * 0.42, x2 = x1 + cdist;
        const gear1 = addPart(G1, x1, 0, 0), gear2 = addPart(G2, x2, 0, 0);
        const shaft = new THREE.CylinderGeometry(0.5, 0.5, 4.2, 48); shaft.rotateX(Math.PI / 2);
        const shaft2 = new THREE.CylinderGeometry(0.36, 0.36, 4.2, 48); shaft2.rotateX(Math.PI / 2);
        addPart(shaft, x1, 0, -0.6); addPart(shaft2, x2, 0, -0.6);
        const plate = new THREE.Shape(); const pw = cdist + 4.4, ph = 6.4; plate.moveTo(-pw / 2 + 0.5, -ph / 2); plate.lineTo(pw / 2 - 0.5, -ph / 2); plate.quadraticCurveTo(pw / 2, -ph / 2, pw / 2, -ph / 2 + 0.5); plate.lineTo(pw / 2, ph / 2 - 0.5); plate.quadraticCurveTo(pw / 2, ph / 2, pw / 2 - 0.5, ph / 2); plate.lineTo(-pw / 2 + 0.5, ph / 2); plate.quadraticCurveTo(-pw / 2, ph / 2, -pw / 2, ph / 2 - 0.5); plate.lineTo(-pw / 2, -ph / 2 + 0.5); plate.quadraticCurveTo(-pw / 2, -ph / 2, -pw / 2 + 0.5, -ph / 2);
        const cx0 = (x1 + x2) / 2;
        [[x1 - cx0, 0, 0.62], [x2 - cx0, 0, 0.48], [-pw / 2 + 0.6, -ph / 2 + 0.6, 0.22], [pw / 2 - 0.6, -ph / 2 + 0.6, 0.22], [-pw / 2 + 0.6, ph / 2 - 0.6, 0.22], [pw / 2 - 0.6, ph / 2 - 0.6, 0.22]].forEach(([x, y, r]) => { const h = new THREE.Path(); h.absarc(x, y, r, 0, TAU, true); plate.holes.push(h); });
        const PL = new THREE.ExtrudeGeometry(plate, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 32 });
        addPart(PL, cx0, 0, -2.2);
        const bolt = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 6); bolt.rotateX(Math.PI / 2);
        [[-pw / 2 + 0.6, -ph / 2 + 0.6], [pw / 2 - 0.6, -ph / 2 + 0.6], [-pw / 2 + 0.6, ph / 2 - 0.6], [pw / 2 - 0.6, ph / 2 - 0.6]].forEach(([x, y]) => addPart(bolt, cx0 + x, y, -1.55));
        // dimension annotations (instrument-style labels)
        const label = (txt, x, y, z, w) => { const tex = X.canvasTexture(512, 64, (c) => { c.fillStyle = 'rgba(230,240,255,0.95)'; c.font = '34px monospace'; c.textBaseline = 'middle'; c.fillText(txt, 6, 32); }); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); s.scale.set(w || 4, (w || 4) / 8, 1); s.position.set(x, y, z); sc.add(s); return s; };
        label(`Ø${(g1.rp * 2 * 10).toFixed(2)} (pitch) · z = 24`, x1 + 1.2, g1.rp + 1.6, 0.6, 4.6);
        label(`a = ${(cdist * 10).toFixed(2)} ±0.02`, cx0 + 0.8, -ph / 2 - 0.9, 0.6, 3.8);
        const dimG = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x1, -ph / 2 - 0.5, 0.5), new THREE.Vector3(x2, -ph / 2 - 0.5, 0.5), new THREE.Vector3(x1, -ph / 2 - 0.2, 0.5), new THREE.Vector3(x1, -ph / 2 - 0.8, 0.5), new THREE.Vector3(x2, -ph / 2 - 0.2, 0.5), new THREE.Vector3(x2, -ph / 2 - 0.8, 0.5)]);
        sc.add(new THREE.LineSegments(dimG, new THREE.LineBasicMaterial({ color: 0xe6f0ff })));
        const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(5, 7, 9); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 }); sc.add(key);
        sc.add(new THREE.HemisphereLight(0xb0c8ff, 0x101828, 0.5));
        const sp = particles(X, 400);
        U.uLoad.value.set(x1 + g1.rp, 0, 0);
        d.t3 = { U, clip, gear1, gear2, ratio: 24 / 14, sp, cam: {}, gl: glyphLayer(X, S, { R: 2.2, center: new THREE.Vector3(cx0, 5.4, 1.5), size: 0.38, glow: 1.6, dim: 0.9 }) };
        d.t3.web = webLayer(X, S, [{ k: 0.8 }, { k: 1.2 }, { k: 1.4, pulse: 1 }, { k: 1.8, pulse: 1 }], sp);
      },
      update(S, X, now, dt) {
        const d = S.data, t = d.t3; if (!t) return;
        const p = power(S), k = 1 - Math.pow(0.95, dt / 16.7);
        rig(X, S, t.cam, { target: new X.THREE.Vector3(0, 0, 0), dist: 15, el: 0.28, spin: 0, az: 0.45, pa: 0.9, pe: 0.3, dolly: 0.18 });
        t.gl.update(S); t.web.update(S); t.sp.update(X, dt);
        const sp = S.reduceMotion ? 0.3 : 1, w = dt * 0.0004 * (1 + 4 * p) * sp;
        t.gear1.rotation.z += w; t.gear2.rotation.z -= w * t.ratio;
        // hold: the section cut slides in and the stress contour fades up; release: a decaying mode-shape wobble
        const cut = S.holding ? lerp(5, 0, smooth(p * 1.5)) : 5;
        t.clip.constant += (cut - t.clip.constant) * k;
        t.U.uAmp.value += ((S.holding ? clamp(S.infected / Math.max(1, S.active.length), 0, 1) : 0) - t.U.uAmp.value) * k;
        const dt2 = (now - d.def) / 1000; t.U.uDef.value = dt2 > 0 && dt2 < 2.5 ? Math.exp(-dt2 * 2) * Math.sin(dt2 * 20) : 0; t.U.uT.value = now / 1000;
      }
    },
    onRelease(S, held) { const d = S.data; d.def = S.now; d.fos = held > S.STAGES[3] ? 0.7 : held > S.STAGES[2] ? 1.0 : 2.0; return false; },
    hud(S) {
      if (S.holding) return ['meshing… 48 312 tetrahedra', 'solving K·u = F · section A–A', 'σ_vM peaks at the tooth root, as Lewis predicted in 1892', 'FoS = 0.7 · call it a "learning experience"'][S.stage];
      if (S.now - S.data.def < 4000) return `first mode @ ${(118 + S.active.length * 0.4).toFixed(1)} Hz · ζ = 0.02 · FoS = ${S.data.fos.toFixed(1)}`;
      return 'FoS = 1.5 (the 0.5 is for the boss) · hold for section A–A and the stress plot';
    }
  }));

  /* ======================= 15. CRYSTAL: refractive ice growing from the letters ======================= */
  SP.addMode(base3d({
    id: 'crystal', name: 'CRYSTAL', glyphs: G('❄❅❆✻✼❉✲✳⁂', '*+×'),
    base: [200, 45, 90], palette: [[195, 85, 82], [185, 95, 72], [215, 70, 94]], noHueShift: true,
    count: 72, pageBg: ['#06162a', '#010308'],
    shapes: ['rhombic_hexecontahedron', 'small_stellated_dodecahedron', 'sphere', 'icosahedron', 'great_stellated_dodecahedron', 'cell600', 'octahedron', 'stella_octangula'],
    init(S) { S.data.shatter = -1e9; },
    three: {
      init(S, X) {
        const THREE = X.THREE, d = S.data, sc = X.scene, nz = X.noise;
        X.maxPixelRatio = 1.3; X.studioEnvironment(); X.setBloom(0.6, 0.5, 0.8); X.setExposure(0.8);
        sc.fog = new THREE.FogExp2(0x0a1828, 0.035);
        skyDome(THREE, sc, 'varying vec3 vP; void main(){ float h = vP.y; vec3 c = mix(vec3(0.03,0.07,0.13), vec3(0.004,0.01,0.03), smoothstep(0.0, 0.7, h)); gl_FragColor = vec4(c, 1.0); }', null, 150);
        const sg = new THREE.PlaneGeometry(90, 90, 140, 140); sg.rotateX(-Math.PI / 2);
        const pp = sg.attributes.position; for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), z = pp.getZ(i); pp.setY(i, 0.9 * nz.noise(x * 0.06, 0, z * 0.06) + 0.15 * nz.noise(x * 0.4, 3, z * 0.4)); }
        sg.computeVertexNormals();
        const snN = noiseNormal(X, 256, 8, 3); snN.repeat.set(20, 20);
        const snow = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: 0xaab8d0, roughness: 0.82, normalMap: snN, normalScale: new THREE.Vector2(0.4, 0.4), envMapIntensity: 0.4 }));
        snow.receiveShadow = true; sc.add(snow);
        // a hexagonal bipyramid prism, the habit of ice crystals
        const prof = [[0, -1], [0.34, -0.72], [0.34, 0.72], [0, 1]].map((p) => new THREE.Vector2(p[0], p[1]));
        const cg = new THREE.LatheGeometry(prof, 6); cg.computeVertexNormals();
        const ice = glowInstances(new THREE.MeshPhysicalMaterial({ color: 0xd4f2ff, roughness: 0.03, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0, transparent: true, opacity: 0.3, envMapIntensity: 1.6, emissive: 0x6fd8ff, emissiveIntensity: 1, flatShading: true }), 1, true);
        const N = 260, cr = new THREE.InstancedMesh(cg, ice, N); cr.castShadow = true; cr.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        for (let i = 0; i < N; i++) cr.setColorAt(i, new THREE.Color(0, 0, 0));
        sc.add(cr);
        // a frozen cluster on the ground
        const cl = new THREE.InstancedMesh(cg, ice.clone(), 46); const m4 = new THREE.Matrix4();
        for (let i = 0; i < 46; i++) { const a = rand(0, TAU), r = rand(0, 2.2), dir = new THREE.Vector3(Math.cos(a) * rand(0.1, 0.8), 1, Math.sin(a) * rand(0.1, 0.8)).normalize(), s = rand(0.3, 1.2); m4.compose(new THREE.Vector3(Math.cos(a) * r, s * 0.6, Math.sin(a) * r - 1), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir), new THREE.Vector3(s, s * rand(1.2, 2.2), s)); cl.setMatrixAt(i, m4); cl.setColorAt(i, new THREE.Color(0.05, 0.12, 0.2)); }
        cl.castShadow = true; sc.add(cl);
        const moon = new THREE.DirectionalLight(0xcfe2ff, 1.2); moon.position.set(-6, 12, 5); moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024); Object.assign(moon.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 }); moon.shadow.bias = -0.0005; sc.add(moon);
        const warm = new THREE.PointLight(0xffb07a, 50, 30, 2); warm.position.set(6, 3, -4); sc.add(warm);
        sc.add(new THREE.HemisphereLight(0x6f9fd8, 0x0a1220, 0.22));
        const flakes = particles(X, 1600, { hard: 1.4, normal: true });
        for (let i = 0; i < 1600; i++) flakes.add(rand(-20, 20), rand(0, 16), rand(-20, 8), rand(-0.003, 0.003), -rand(0.008, 0.02), 0, 0.95, 0.97, 1, rand(0.04, 0.1), 1e12, 0, 1, { flat: 1, w: rand(0, 9) });
        const sp = particles(X, 900);
        d.t3 = { cr, N, flakes, sp, cam: {}, m4, q: new THREE.Quaternion(), v: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), c: new THREE.Color(), ctr: new THREE.Vector3(0, 3.2, 0),
          gl: glyphLayer(X, S, { R: 3, center: new THREE.Vector3(0, 3.2, 0), size: 0.32, glow: 2, dim: 0.8 }) };
        d.t3.web = webLayer(X, S, [{ k: 0.7 }, { k: 1.1 }, { k: 1.5, pulse: 1 }, { k: 2, pulse: 1.5 }], sp);
      },
      update(S, X, now, dt) {
        const d = S.data, t = d.t3; if (!t) return;
        const THREE = X.THREE, k = dt / 16.7;
        rig(X, S, t.cam, { target: new THREE.Vector3(0, 2.6, 0), dist: 12, el: 0.16, spin: 0.00004, dolly: 0.22 });
        t.gl.update(S); t.web.update(S); t.sp.update(X, dt);
        // a crystal grows out of every infected letter, pointing away from the centre
        const act = S.active, n = Math.min(t.N, act.length), shat = now - d.shatter < 500;
        for (let i = 0; i < n; i++) {
          const nd = act[i], w = nd.data.wp; if (!w) continue;
          const want = shat ? 0 : nd.inf ? 1 : 0.12;
          nd.data.cg = (nd.data.cg || 0) + (want - (nd.data.cg || 0)) * (want > (nd.data.cg || 0) ? 0.03 * k : 0.25 * k);
          const g = nd.data.cg, s = 0.04 + 0.4 * g * (0.7 + 0.3 * hash(i));
          t.v.subVectors(w, t.ctr).normalize(); t.q.setFromUnitVectors(t.up, t.v);
          t.m4.compose(w.clone().addScaledVector(t.v, s * 0.8), t.q, new THREE.Vector3(s, s * (1.4 + hash(i * 7)), s)); t.cr.setMatrixAt(i, t.m4);
          t.c.setRGB(0.04 + 0.25 * g * (S.holding ? 1 : 0.5), 0.12 + 0.5 * g * (S.holding ? 1 : 0.5), 0.2 + 0.8 * g * (S.holding ? 1 : 0.5)); t.cr.setColorAt(i, t.c);
        }
        t.cr.count = n; t.cr.instanceMatrix.needsUpdate = true; t.cr.instanceColor.needsUpdate = true;
        const wpt = X.fromScreen(S.ptr.x, S.ptr.y, 0), spd = pspeed(S);
        t.flakes.update(X, dt, (q) => { q.vx += Math.sin(now * 0.0007 + q.w) * 0.00004; if (spd > 0.8) { const ex = q.x - wpt.x, ey = q.y - wpt.y; if (ex * ex + ey * ey < 3 && Math.abs(q.z) < 3) { q.vx += ex * 0.004; q.vy += ey * 0.002; } } q.vx *= 0.99; q.vy = q.vy * 0.99 - 0.0002; if (q.y < 0) { q.y = 16; q.x = rand(-20, 20); q.vy = -0.01; } return true; });
      }
    },
    onRelease(S) {
      const d = S.data, t = d.t3; d.shatter = S.now;
      if (t) S.active.forEach((n) => { const w = n.data.wp; if (w && n.inf) for (let k = 0; k < 5; k++) t.sp.add(w.x, w.y, w.z, rand(-0.08, 0.08), rand(0, 0.1), rand(-0.08, 0.08), 1.6, 2.2, 2.8, rand(0.05, 0.1), rand(900, 1500), 0.004, 0.98); });
      return false;
    },
    hud(S) {
      if (S.holding) return `nucleating · supercooled −${15 + S.stage * 8} K · ice Ih grows in hexagonal prisms`;
      if (S.now - S.data.shatter < 3000) return 'shattered · thermal shock is a material property, not a personality';
      return 'T = −40 °C = −40 °F, the only honest temperature · hold to freeze';
    }
  }));

  /* ======================= 16. TERMINAL: a CRT monitor on a desk ======================= */
  const CRT_FS = `uniform sampler2D map; uniform float uT; uniform float uOff; varying vec2 vU;
    void main(){ vec2 uv = vU * 2.0 - 1.0; uv *= 1.0 + 0.06 * dot(uv, uv); vec2 q = uv * 0.5 + 0.5;
      float sq = 1.0 - uOff; float coll = smoothstep(0.0, 0.5, uOff);
      q.y = (q.y - 0.5) / max(0.004, 1.0 - coll * 0.995) + 0.5; q.x = (q.x - 0.5) / max(0.02, 1.0 - smoothstep(0.5, 1.0, uOff) * 0.98) + 0.5;
      if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) { gl_FragColor = vec4(0.012, 0.016, 0.014, 1.0); return; }
      vec3 c; c.r = texture2D(map, q + vec2(0.0012, 0.0)).r; c.g = texture2D(map, q).g; c.b = texture2D(map, q - vec2(0.0012, 0.0)).b;
      float scan = 0.72 + 0.28 * sin(q.y * 480.0 * 3.14159); float grille = 0.85 + 0.15 * sin(gl_FragCoord.x * 2.094);
      float vig = smoothstep(1.25, 0.35, length(uv)); float roll = 0.94 + 0.06 * sin(q.y * 6.0 - uT * 1.5);
      c = c * scan * grille * vig * roll * 2.4 + vec3(0.01, 0.03, 0.015) * vig;
      c += vec3(0.6, 1.0, 0.7) * exp(-abs(uv.y) * 60.0) * smoothstep(0.3, 0.6, uOff) * (1.0 - smoothstep(0.85, 1.0, uOff)) * 3.0;
      gl_FragColor = vec4(c, 1.0); }`;
  SP.addMode(base3d({
    id: 'terminal', name: 'TERMINAL', glyphs: '01{}[]<>/\\$#_;:=+*&|~ABCDEF',
    base: [120, 70, 55], palette: [[120, 100, 60], [90, 100, 66], [140, 100, 80]], noHueShift: true,
    count: 90, pageBg: ['#04140a', '#000000'],
    shapes: ['sphere', 'hilbert', 'tesseract', 'menger', 'torus', 'lorenz', 'cell16', 'cube'],
    init(S) { const d = S.data; d.log = ['BIOS v1.0 · 640K ought to be enough for anybody', '[ OK ] reached target: curiosity', `${hex()}  mov eax, ${hex()} ; trust me`, '[ OK ] started sphere.service', 'root@sphere:~$ ./boot --cv']; d.typed = 0; d.last = 0; d.li = Math.floor(rand(0, LOG.length)); d.rm = -1e9; },
    update(S, now, dt) {
      const d = S.data, iv = S.holding ? 260 - S.stage * 60 : 900;
      d.typed += dt * (S.holding ? 0.12 : 0.05);
      const cur = d.log[d.log.length - 1];
      if (d.typed >= cur.length && now - d.last > iv) {
        d.last = now; d.typed = 0; const r = Math.random();
        d.log.push(r < 0.35 ? `${hex()}  mov eax, ${hex()} ; ${pick(['totally', 'legit', 'trust me', 'do not touch'])}` : r < 0.45 ? `[${(now / 1000).toFixed(3)}] sphere: ${S.infected}/${S.active.length} nodes compromised` : LOG[d.li++ % LOG.length]);
        if (d.log.length > 60) d.log.shift();
        if (d.t3) d.t3.press = now;
      }
    },
    three: {
      init(S, X) {
        const THREE = X.THREE, d = S.data, sc = X.scene;
        X.maxPixelRatio = 1.35; X.studioEnvironment(); X.setBloom(0.9, 0.55, 0.7); X.setExposure(0.9);
        sc.fog = new THREE.FogExp2(0x020403, 0.05);
        skyDome(THREE, sc, 'varying vec3 vP; void main(){ gl_FragColor = vec4(vec3(0.006,0.009,0.008), 1.0); }', null, 80);
        const wood = woodTexture(X, 1024, 512, [70, 44, 28]); wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(2, 1);
        const desk = new THREE.Mesh(RBox(THREE, 18, 0.5, 9, 2, 0.08), new THREE.MeshStandardMaterial({ map: wood, bumpMap: wood, bumpScale: 0.015, roughness: 0.5, envMapIntensity: 0.2 }));
        desk.position.y = -0.25; desk.receiveShadow = true; sc.add(desk);
        const plasticN = noiseNormal(X, 128, 12, 1.2); plasticN.repeat.set(4, 4);
        const beige = new THREE.MeshPhysicalMaterial({ color: 0xb3a88c, roughness: 0.6, clearcoat: 0.12, normalMap: plasticN, normalScale: new THREE.Vector2(0.3, 0.3), envMapIntensity: 0.35 });
        const mon = new THREE.Group(); mon.position.set(0, 0.35, -0.6); sc.add(mon);
        const front = new THREE.Mesh(RBox(THREE, 5.2, 4.2, 0.9, 4, 0.22), beige); front.position.set(0, 2.6, 0.9); front.castShadow = true; mon.add(front);
        const backG = new THREE.CylinderGeometry(1.5, 2.9, 3, 4, 1); backG.rotateY(Math.PI / 4); backG.rotateX(Math.PI / 2); backG.scale(1.1, 0.95, 1);
        const backM = new THREE.Mesh(backG, beige); backM.position.set(0, 2.5, -1.0); backM.castShadow = true; mon.add(backM);
        const stand = new THREE.Mesh(RBox(THREE, 2.6, 0.35, 2.4, 2, 0.1), beige); stand.position.set(0, 0.17, 0); stand.castShadow = true; mon.add(stand);
        const bezel = new THREE.Mesh(RBox(THREE, 4.3, 3.35, 0.2, 3, 0.12), new THREE.MeshStandardMaterial({ color: 0x1a1a18, roughness: 0.7 })); bezel.position.set(0, 2.72, 1.32); mon.add(bezel);
        const scrG = new THREE.PlaneGeometry(3.9, 2.95, 32, 24), sp = scrG.attributes.position;
        for (let i = 0; i < sp.count; i++) { const x = sp.getX(i) / 1.95, y = sp.getY(i) / 1.475; sp.setZ(i, 0.16 * (1 - 0.5 * x * x - 0.5 * y * y)); }
        scrG.computeVertexNormals();
        const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 576;
        const tex = new THREE.CanvasTexture(canvas); tex.encoding = THREE.LinearEncoding;
        const U = { map: { value: tex }, uT: { value: 0 }, uOff: { value: 0 } };
        const screen = new THREE.Mesh(scrG, new THREE.ShaderMaterial({ uniforms: U, vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }', fragmentShader: CRT_FS }));
        screen.position.set(0, 2.72, 1.38); mon.add(screen);
        const glassM = new THREE.Mesh(scrG, new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.07, envMapIntensity: 1.6, depthWrite: false }));
        glassM.position.set(0, 2.72, 1.4); mon.add(glassM);
        const led = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 3, 0.6) })); led.position.set(2.0, 0.78, 1.36); mon.add(led);
        // keyboard
        const kb = new THREE.Mesh(RBox(THREE, 6.4, 0.3, 2.3, 2, 0.08), beige); kb.position.set(0, 0.15, 3.4); kb.rotation.x = 0.06; kb.castShadow = kb.receiveShadow = true; sc.add(kb);
        const keyM = new THREE.MeshPhysicalMaterial({ color: 0xe2d9c2, roughness: 0.5, clearcoat: 0.2 });
        const KN = 4 * 14, keys = new THREE.InstancedMesh(RBox(THREE, 0.36, 0.18, 0.36, 2, 0.05), keyM, KN); keys.castShadow = true; keys.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        const kpos = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 14; c++) kpos.push(new THREE.Vector3(-2.9 + c * 0.44 + r * 0.1, 0.38 + r * 0.025, 2.75 + r * 0.44));
        kpos.forEach((p, i) => keys.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z))); sc.add(keys);
        const glowL = new THREE.PointLight(0x5cff8a, 30, 14, 2); glowL.position.set(0, 2.7, 3.2); sc.add(glowL);
        const lamp = new THREE.SpotLight(0xffd6a0, 120, 30, 0.6, 0.7, 2); lamp.position.set(-7, 9, 6); lamp.target.position.set(0, 1, 0); lamp.castShadow = true; lamp.shadow.mapSize.set(1024, 1024); sc.add(lamp, lamp.target);
        sc.add(new THREE.HemisphereLight(0x203028, 0x000000, 0.3));
        d.t3 = { canvas, tex, U, keys, kpos, glowL, cam: {}, press: 0, pk: -1, m4: new THREE.Matrix4() };
      },
      update(S, X, now, dt) {
        const d = S.data, t = d.t3; if (!t) return;
        const p = power(S);
        rig(X, S, t.cam, { target: new X.THREE.Vector3(0, 2.4, 0.5), dist: 13.5, el: 0.2, spin: 0, pa: 0.7, pe: 0.25, dolly: 0.32 });
        t.U.uT.value = now / 1000;
        const ot = (now - d.rm) / 1000; t.U.uOff.value = ot > 0 && ot < 0.6 ? ot / 0.6 : ot >= 0.6 && ot < 1.4 ? 1 : ot >= 1.4 && ot < 2 ? 1 - (ot - 1.4) / 0.6 : 0;
        t.glowL.intensity = (24 + 14 * p) * (1 - t.U.uOff.value * 0.9) * (S.reduceMotion ? 1 : 0.97 + 0.03 * Math.sin(now * 0.05));
        // the screen (redrawn every other frame): the log, plus the letters themselves rotating inside the tube
        t.fr = (t.fr || 0) + 1;
        if (t.fr % 2 === 0) {
        const c = t.canvas.getContext('2d'), W = 768, H = 576;
        c.fillStyle = '#010401'; c.fillRect(0, 0, W, H);
        c.font = '17px monospace'; c.textAlign = 'left'; c.textBaseline = 'middle';
        const rows = 14, lines = d.log.slice(-rows);
        lines.forEach((l, i) => { const last = i === lines.length - 1, s = last ? l.slice(0, Math.floor(d.typed)) : l; c.fillStyle = `rgba(80,255,120,${(0.35 + 0.55 * (i + 1) / lines.length).toFixed(3)})`; c.fillText(s.slice(0, 40), 22, 30 + i * 22); if (last && (S.reduceMotion || Math.floor(now / 500) % 2)) c.fillRect(22 + Math.min(40, s.length) * 10.2 + 2, 22 + i * 22, 10, 16); });
        const cx = 580, cy = 200, R = 150;
        c.strokeStyle = 'rgba(80,255,120,0.12)'; c.beginPath(); c.arc(cx, cy, R * 1.05, 0, TAU); c.stroke();
        c.lineWidth = 1; c.beginPath();
        for (const l of S.links) { if (l.A.rx === undefined) continue; c.moveTo(cx + l.A.rx * R, cy + l.A.ry * R); c.lineTo(cx + l.B.rx * R, cy + l.B.ry * R); }
        c.strokeStyle = 'rgba(150,255,170,0.55)'; c.stroke();
        c.textAlign = 'center';
        for (const n of S.active) { if (n.rx === undefined) continue; const z = (n.rz + 1) / 2; c.font = `${Math.round(12 + 10 * z)}px monospace`; c.fillStyle = n.inf ? `rgba(200,255,210,${0.6 + 0.4 * z})` : `rgba(60,220,100,${0.25 + 0.5 * z})`; c.fillText(n.g, cx + n.rx * R, cy + n.ry * R); }
        c.textAlign = 'left';
        if (S.holding && S.stage >= 2) {
          c.strokeStyle = 'rgba(120,255,150,0.9)'; c.lineWidth = 2; c.strokeRect(150, 420, 468, 70); c.fillStyle = 'rgba(140,255,170,1)'; c.textAlign = 'center';
          if (S.stage === 2) { const f = clamp((S.held - S.STAGES[2]) / (S.STAGES[3] - S.STAGES[2]), 0, 1), n = Math.round(f * 24); c.font = '20px monospace'; c.fillText(`DECRYPTING [${'#'.repeat(n)}${'.'.repeat(24 - n)}]`, 384, 455); }
          else { c.font = 'bold 28px monospace'; c.fillText('ACCESS GRANTED', 384, 455); }
          c.textAlign = 'left';
        }
        t.tex.needsUpdate = true;
        }
        // a key goes down whenever a line is typed
        if (now - t.press < 90) { if (t.pk < 0) t.pk = Math.floor(rand(0, t.kpos.length)); } else t.pk = -1;
        t.kpos.forEach((q, i) => { t.m4.makeTranslation(q.x, q.y - (i === t.pk ? 0.08 : 0), q.z); t.keys.setMatrixAt(i, t.m4); });
        t.keys.instanceMatrix.needsUpdate = true;
        if (Math.random() < (S.holding ? 0.2 : 0.03)) t.press = now;
      }
    },
    onRelease(S) {
      const d = S.data; d.rm = S.now;
      d.log.push('root@sphere:~$ rm -rf /sphere', "rm: cannot remove '/sphere': it's load-bearing", "just kidding, it's a CV"); d.typed = 0;
      return false;
    },
    hud(S) { const d = S.data; if (S.holding) return `root@sphere:~# ./hack --mainframe --stage=${S.stage}  [PID 1337]`; return '> ' + d.log[d.log.length - 1]; }
  }));

  /* ======================= 17. CHAOS: every tap hands the stage to a different scene ======================= */
  const CHAOS_POOL = ['neural', 'market', 'life', 'virus', 'quantum', 'fireworks', 'abyss', 'eldritch', 'sacred', 'synthwave', 'storm', 'alchemy', 'music', 'blueprint', 'crystal', 'terminal'];
  const QUIPS = ['entropy: ↑ (as the second law intended)', 'nothing here is deterministic except taxes', 'butterfly flapped in Brazil · scene changed', 'Lyapunov exponent: yes', 'random seed: 4 (chosen by fair dice roll)', "Maxwell's demon has left the chat"];
  function chaosRoll(m, S) {
    const n = 2 + Math.floor(rand(0, 3)), h0 = rand(0, 360);
    m.palette = Array.from({ length: n }, (_, i) => [(h0 + i * rand(40, 160)) % 360, Math.round(rand(70, 100)), Math.round(rand(50, 72))]);
    m.base = [rand(0, 360), Math.round(rand(0, 60)), Math.round(rand(70, 92))];
    S.spinScale = rand(0.3, 3);
    S.data.quip = pick(QUIPS);
  }
  const chaosMode = base3d({
    id: 'chaos', name: 'CHAOS', glyphs: 'random', count: 'random',
    base: [0, 0, 90], palette: [[0, 100, 60], [120, 100, 60], [240, 100, 60]],
    pageBg: ['#0d0d12', '#000000'],
    shapes: shuffle(Object.keys(SP.shapes).concat(['rhombic_hexecontahedron', 'stella_octangula', 'icosahedron', 'dodecahedron', 'buckyball', 'urchin', 'cell600', 'torus_knot', 'hopf', 'seashell', 'boy', 'gyroid', 'heart', 'rose', 'sunflower', 'atom', 'menger', 'aizawa', 'thomas']).filter((k, i, a) => a.indexOf(k) === i)),
    pick(S) {
      const ids = CHAOS_POOL.filter((id) => id !== (this.del && this.del.id));
      const id = pick(ids);
      return SP.modes3d[id] && SP.modes3d[id].three ? SP.modes3d[id] : null;
    },
    swap(S, X) {
      const keep = { shape: S.data.shape, quip: S.data.quip, stage: S.data.stage };
      if (this.del) { try { if (this.del.three.exit) this.del.three.exit(S, X); if (this.del.exit) this.del.exit(S); } catch (e) { /* ignore */ } }
      const sc = X.scene;
      for (let i = sc.children.length - 1; i >= 0; i--) { const o = sc.children[i]; sc.remove(o); o.traverse((q) => { if (q.geometry) q.geometry.dispose(); const ms = Array.isArray(q.material) ? q.material : q.material ? [q.material] : []; ms.forEach((mm) => { Object.keys(mm).forEach((k) => { if (mm[k] && mm[k].isTexture) mm[k].dispose(); }); mm.dispose(); }); }); }
      sc.fog = null; sc.background = null; sc.environment = null;
      X.renderer.localClippingEnabled = false;
      Object.keys(S.data).forEach((k) => delete S.data[k]); Object.assign(S.data, keep);
      this.del = this.pick(S);
      this.glyphList = []; // random glyphs, borrowed scenery
      if (this.del.init) this.del.init.call(this.del, S);
      this.del.three.init(S, X);
      chaosRoll(this, S);
    },
    init(S) { chaosRoll(this, S); S.data.shape = S.shape; },
    exit(S) { if (this.del && this.del.exit) this.del.exit(S); this.shapes = shuffle(this.shapes.slice()); },
    update(S, now, dt) {
      const d = S.data, X = S.three;
      if (X && S.shape !== d.shape) { d.shape = S.shape; this.swap(S, X); }
      if (S.holding && S.stage !== d.stage && S.stage > 0) chaosRoll(this, S);
      d.stage = S.holding ? S.stage : -1;
      if (this.del && this.del.update) this.del.update.call(this.del, S, now, dt);
    },
    three: {
      init(S, X) { const m = S.mode; m.del = null; m.swap(S, X); },
      update(S, X, now, dt) { const m = S.mode; if (m.del) m.del.three.update(S, X, now, dt); },
      exit(S, X) { const m = S.mode; if (m.del && m.del.three.exit) m.del.three.exit(S, X); }
    },
    onPress(S, x, y) { if (this.del && this.del.onPress) this.del.onPress.call(this.del, S, x, y); },
    onInfect(S, n, p) { if (this.del && this.del.onInfect) this.del.onInfect.call(this.del, S, n, p); },
    onClimax(S) { if (this.del && this.del.onClimax) this.del.onClimax.call(this.del, S); return false; },
    onRelease(S, held, pw) { if (this.del && this.del.onRelease) this.del.onRelease.call(this.del, S, held, pw); return false; },
    hud(S) { const h = this.del && this.del.hud ? this.del.hud.call(this.del, S) : ''; return `${this.del ? this.del.name : '…'} (borrowed) · ${S.data.quip || ''}${h ? ' · ' + h : ''}`; }
  });
  SP.addMode(chaosMode);
})(window.SPHERE);
