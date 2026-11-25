/* The Sphere: punk pack. Seven "-punk" genres as lit three.js scenes (through SPHERE's 3D layer), each with a real
 * mechanism underneath that drives what you see:
 *   STEAMPUNK  an engine room: spur trains that really mesh (ω1·N1 = ω2·N2), a bevel-driven flyball governor
 *              (cos α = g/ω²L), a V-twin on true slider-crank kinematics, gas chambers, a boiler gauge, steam
 *   FROST CITY  a crater town around a heat generator: Stefan–Boltzmann radiation sets the warm radius, snow melts
 *              and refreezes there, the streets cool by Newton's law
 *   WHALEPUNK  sky-whales and oil-lamp airships over a cloud sea at dusk, a live whale-song spectrogram, SOFAR rays
 *   DIESELPUNK an art-deco night with searchlights and zeppelins, and a live Diesel-cycle P–V loop
 *   SOLARPUNK  a green city whose trackers follow the pointer-sun (P = P0·cos θ, Meinel air-mass irradiance)
 *   BIOPUNK    a lab bench: logistic growth in petri dishes, a B-DNA helix with point mutations and a Cas9 cut
 *   ATOMPUNK   1950s chrome rockets round a Bohr atom, the radon-222 chain solved live, Geiger meter, cloud-chamber tracks
 * Original work: the names are genre names, every model and texture is procedural. Own web styles use the pk_ prefix. */
(function (SP) {
  'use strict';
  if (!SP) return;
  const { TAU, rand, pick, clamp } = SP.util;
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const ease = (dt, tau) => 1 - Math.exp(-dt / tau); // frame-rate independent exponential approach
  const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  const sci = (v) => { if (!(v > 0)) return '0'; const e = Math.floor(Math.log10(v)), m = v / Math.pow(10, e); return m.toFixed(1) + '×10' + String(e).split('').map((c) => SUP[c] || c).join(''); };
  const fmt = (v) => Math.round(v).toLocaleString('en-US');

  // Opt-in timing of this pack's own work: window.__pkPerf.on = true, then read window.__pkPerf.s (ms per frame).
  const PERF = (window.__pkPerf = window.__pkPerf || { on: false, cur: 0, s: [] });
  // A throw inside a hook would stop the animation loop, so every hook is guarded and logs once.
  const addMode = (def) => {
    Object.keys(def).forEach((k) => {
      const f = def[k];
      if (typeof f !== 'function') return;
      let warned = false;
      def[k] = function () {
        let t0 = 0;
        if (PERF.on) { if (k === 'update') { if (PERF.cur) PERF.s.push(PERF.cur); PERF.cur = 0; } t0 = performance.now(); }
        try { return f.apply(this, arguments); } catch (err) {
          if (!warned) { warned = true; console.error('[pack-punk] ' + def.id + '.' + k, err); }
          return k === 'drawNode' ? true : undefined;
        } finally { if (PERF.on) PERF.cur += performance.now() - t0; }
      };
    });
    if (def.three) { // the 3D hooks too (the layer catches errors, but we also want them timed)
      const t3 = def.three;
      ['init', 'update', 'exit'].forEach((k) => {
        const f = t3[k];
        if (!f) return;
        let warned = false;
        t3[k] = function () {
          const t0 = PERF.on ? performance.now() : 0;
          try { return f.apply(this, arguments); } catch (err) { if (!warned) { warned = true; console.error('[pack-punk] ' + def.id + '.three.' + k, err); } } finally { if (PERF.on) PERF.cur += performance.now() - t0; }
        };
      });
    }
    SP.addMode(def);
  };

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

  /* ---------- cached sprites and layers ---------- */
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  const glowCache = {};
  function glow(rgb, r) {
    r = Math.max(4, Math.round(r / 4) * 4);
    const k = rgb + '/' + r;
    let c = glowCache[k];
    if (!c) {
      c = mk(r * 2, r * 2);
      const x = c.getContext('2d'), g = x.createRadialGradient(r, r, 0, r, r, r);
      g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(0.3, `rgba(${rgb},0.38)`); g.addColorStop(1, `rgba(${rgb},0)`);
      x.fillStyle = g; x.fillRect(0, 0, r * 2, r * 2); glowCache[k] = c;
    }
    return c;
  }
  // A glow sprite drawn at any size (the sprite itself is at most 128 px, scaled up: soft light needs no resolution).
  function drawGlow(ctx, rgb, x, y, r, a) {
    if (a <= 0.004 || r <= 0.5) return;
    const c = glow(rgb, Math.min(64, r));
    ctx.globalAlpha = Math.min(1, a); ctx.drawImage(c, x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1;
  }
  // A canvas in CSS pixels (res < 1 renders it at lower resolution), rebuilt when the size or DPR changes. Lives in S.data.
  function layer(S, key, w, h, draw, res) {
    res = res || 1;
    const k = Math.round(w) + 'x' + Math.round(h) + '@' + S.DPR + '/' + res, old = S.data['_' + key];
    if (old && old._k === k) return old;
    const c = mk(w * S.DPR * res, h * S.DPR * res), x = c.getContext('2d');
    x.scale(S.DPR * res, S.DPR * res); draw(x, w, h); c._k = k; c._w = w; c._h = h; S.data['_' + key] = c;
    return c;
  }
  const blit = (ctx, c, x, y) => ctx.drawImage(c, x || 0, y || 0, c._w, c._h);
  const power = (S) => (S.holding ? clamp(S.held / S.STAGES[3], 0, 1) : 0);
  const pvel = (S) => S.ptrVel || { x: 0, y: 0 };
  const pspeed = (S) => { const v = pvel(S); return Math.hypot(v.x, v.y); };
  const hasPtr = (S) => S.ptrInside || S.holding;
  const baseR = (S) => Math.min(S.W * 0.42, S.H * 0.3) * (S.mode.scale || 1);
  function panel(x, X, Y, w, h, a, edge) { // a dark rounded instrument panel
    x.fillStyle = `rgba(4,6,10,${a})`; x.beginPath();
    if (x.roundRect) x.roundRect(X, Y, w, h, 6); else x.rect(X, Y, w, h);
    x.fill(); if (edge) { x.strokeStyle = edge; x.lineWidth = 1; x.stroke(); }
  }

  /* ---------------- Web styles of this pack ---------------- */
  // A riveted brass strap: a thick band with rivets every 14 px.
  SP.addLink('pk_strap', (ctx, L) => {
    const dx = L.bx - L.ax, dy = L.by - L.ay, len = Math.hypot(dx, dy);
    if (len < 2) return;
    ctx.lineWidth = 3 + L.stage; ctx.strokeStyle = `rgba(120,78,28,${L.alpha * 0.9})`; ctx.beginPath(); ctx.moveTo(L.ax, L.ay); ctx.lineTo(L.bx, L.by); ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = `rgba(255,214,140,${L.alpha * 0.7})`; ctx.stroke();
    ctx.fillStyle = `rgba(255,230,170,${L.alpha})`;
    for (let s = 7; s < len; s += 14) ctx.fillRect(L.ax + dx * s / len - 1, L.ay + dy * s / len - 1, 2, 2);
  });
  // A steam pipe with a flange at each end and a little vapour puff travelling along it.
  SP.addLink('pk_pipe', (ctx, L) => {
    const dx = L.bx - L.ax, dy = L.by - L.ay, len = Math.hypot(dx, dy);
    if (len < 2) return;
    ctx.lineWidth = 5 + L.stage; ctx.strokeStyle = `rgba(150,80,40,${L.alpha * 0.85})`; ctx.beginPath(); ctx.moveTo(L.ax, L.ay); ctx.lineTo(L.bx, L.by); ctx.stroke();
    ctx.lineWidth = 1.2; ctx.strokeStyle = `rgba(255,190,130,${L.alpha * 0.8})`; ctx.stroke();
    const t = (L.now * 0.0012 + L.seed) % 1;
    ctx.fillStyle = `rgba(255,255,255,${L.alpha * 0.55})`; ctx.beginPath(); ctx.arc(L.ax + dx * t, L.ay + dy * t, 2.5 + L.stage, 0, TAU); ctx.fill();
  });
  // A searchlight beam: a thin wedge widening toward the child.
  SP.addLink('pk_beam', (ctx, L) => {
    const dx = L.bx - L.ax, dy = L.by - L.ay, len = Math.hypot(dx, dy);
    if (len < 4) return;
    const nx = -dy / len, ny = dx / len, w = 2 + len * 0.08;
    ctx.fillStyle = L.color(L.alpha * 0.22); ctx.beginPath(); ctx.moveTo(L.ax, L.ay); ctx.lineTo(L.bx + nx * w, L.by + ny * w); ctx.lineTo(L.bx - nx * w, L.by - ny * w); ctx.closePath(); ctx.fill();
    ctx.lineWidth = 0.8; ctx.strokeStyle = `rgba(255,240,200,${L.alpha * 0.7})`; ctx.beginPath(); ctx.moveTo(L.ax, L.ay); ctx.lineTo(L.bx, L.by); ctx.stroke();
  });
  // Frost: a line with pairs of 60° side-branches, like ice dendrites.
  SP.addLink('pk_frost', (ctx, L, S) => {
    S.line(L.ax, L.ay, L.bx, L.by);
    const dx = L.bx - L.ax, dy = L.by - L.ay, len = Math.hypot(dx, dy);
    if (len < 10) return;
    const ux = dx / len, uy = dy / len, c = 0.5, sn = 0.866;
    ctx.beginPath();
    for (let k = 1; k <= 3; k++) {
      const t = k / 4, px = L.ax + dx * t, py = L.ay + dy * t, bl = len * 0.13 * (1.2 - t * 0.6) * (0.6 + L.seed * 0.7);
      ctx.moveTo(px, py); ctx.lineTo(px + (ux * c - uy * sn) * bl, py + (ux * sn + uy * c) * bl);
      ctx.moveTo(px, py); ctx.lineTo(px + (ux * c + uy * sn) * bl, py + (-ux * sn + uy * c) * bl);
    }
    ctx.lineWidth = Math.max(0.6, L.width * 0.6); ctx.stroke();
  });
  // A cloud-chamber track: alpha = short and fat, beta = long and curly (decided by the link's seed).
  SP.addLink('pk_track', (ctx, L) => {
    const dx = L.bx - L.ax, dy = L.by - L.ay, len = Math.hypot(dx, dy);
    if (len < 2) return;
    const nx = -dy / len, ny = dx / len, beta = L.seed > 0.45;
    ctx.beginPath(); ctx.moveTo(L.ax, L.ay);
    for (let i = 1; i <= 12; i++) { const t = i / 12, w = beta ? Math.sin(t * 9 + L.seed * 20) * 5 * t * t : 0; ctx.lineTo(L.ax + dx * t + nx * w, L.ay + dy * t + ny * w); }
    ctx.lineWidth = beta ? 1 : 3.2; ctx.strokeStyle = `rgba(225,245,255,${L.alpha * (beta ? 0.75 : 0.5)})`; ctx.stroke();
    ctx.lineWidth = beta ? 3 : 7; ctx.strokeStyle = L.color(L.alpha * 0.16); ctx.stroke();
  });

  /* ---------------- 3D kit (three.js r128 through SPHERE's 3D layer) ---------------- */
  // Every punk mode renders through the bloom composer, so everything (built-in and custom shaders) is linear
  // until the layer's output pass tone-maps and encodes it.
  function softTexture(X, hard) {
    return X.canvasTexture(64, 64, (x) => {
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(hard ? 0.2 : 0.35, `rgba(255,255,255,${hard ? 0.9 : 0.55})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    });
  }
  // A capped CPU particle pool drawn as ONE Points call with per-particle size (world units), alpha and colour.
  function particles(X, n, opt) {
    const THREE = X.THREE, geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3), size = new Float32Array(n), alpha = new Float32Array(n), col = new Float32Array(n * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: opt.map || softTexture(X) }, uScale: { value: 600 } },
      vertexShader: 'attribute float aSize; attribute float aAlpha; attribute vec3 aColor; varying float vA; varying vec3 vC; uniform float uScale;' +
        'void main(){ vA = aAlpha; vC = aColor; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform sampler2D map; varying float vA; varying vec3 vC; void main(){ float a = texture2D(map, gl_PointCoord).a * vA; if (a < 0.003) discard; gl_FragColor = vec4(vC, a); }',
      transparent: true, depthWrite: false, blending: opt.additive ? THREE.AdditiveBlending : THREE.NormalBlending
    });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = opt.order || 5;
    const P = {
      pts, list: [],
      emit(o) { if (P.list.length < n) P.list.push(Object.assign({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t: 0, life: 2, s0: 0.2, s1: 1, a: 0.5, c: [1, 1, 1], drag: 0.98, g: 0, wx: 0 }, o)); },
      step(dt, cam) {
        const k = dt / 16.7, s = dt / 1000, L = P.list;
        let j = 0;
        for (let i = 0; i < L.length; i++) {
          const p = L[i]; p.t += s;
          if (p.life > 0 && p.t >= p.life) continue;
          const dk = Math.pow(p.drag, k);
          p.vx = p.vx * dk + p.wx * s; p.vy = p.vy * dk + p.g * s; p.vz *= dk;
          p.x += p.vx * s; p.y += p.vy * s; p.z += p.vz * s;
          const u = p.life > 0 ? p.t / p.life : 0;
          pos[j * 3] = p.x; pos[j * 3 + 1] = p.y; pos[j * 3 + 2] = p.z;
          size[j] = lerp(p.s0, p.s1, 1 - (1 - u) * (1 - u));
          alpha[j] = p.life > 0 ? p.a * Math.min(1, u * 8) * (1 - u) : p.a; // life <= 0: a permanent particle (clouds)
          col[j * 3] = p.c[0]; col[j * 3 + 1] = p.c[1]; col[j * 3 + 2] = p.c[2];
          L[j++] = p;
        }
        L.length = j;
        geo.setDrawRange(0, j);
        geo.attributes.position.needsUpdate = geo.attributes.aSize.needsUpdate = geo.attributes.aAlpha.needsUpdate = geo.attributes.aColor.needsUpdate = true;
        if (cam) mat.uniforms.uScale.value = X.renderer.domElement.height / (2 * Math.tan(cam.fov * Math.PI / 360));
      }
    };
    return P;
  }
  // Pointer parallax plus a slow cinematic sway around a target; returns nothing, moves X.camera.
  function camRig(S, X, o, now, dt) {
    const d = S.data, c = d._cam || (d._cam = { px: 0, py: 0, sh: 0 });
    const tx = hasPtr(S) ? S.ptr.x / S.W - 0.5 : 0, ty = hasPtr(S) ? S.ptr.y / S.H - 0.5 : 0;
    c.px += (tx - c.px) * ease(dt, 900); c.py += (ty - c.py) * ease(dt, 900);
    const sway = S.reduceMotion ? 0 : o.sway || 0, a = (o.a0 || 0) + Math.sin(now * (o.speed || 0.00005)) * sway + c.px * (o.par || 0.15) + (o.spin || 0) * now;
    const e = (o.el || 0.1) + c.py * (o.parY || 0.06) + (S.reduceMotion ? 0 : Math.sin(now * (o.speed || 0.00005) * 0.7) * (o.bob || 0));
    const L = o.look, r = o.r;
    X.camera.position.set(L[0] + Math.sin(a) * Math.cos(e) * r, L[1] + Math.sin(e) * r, L[2] + Math.cos(a) * Math.cos(e) * r);
    if (c.sh > 0.001 && !S.reduceMotion) { X.camera.position.x += rand(-c.sh, c.sh); X.camera.position.y += rand(-c.sh, c.sh); }
    c.sh *= Math.pow(0.9, dt / 16.7);
    X.camera.lookAt(L[0], L[1], L[2]);
  }
  const kick = (S, a) => { const c = S.data._cam; if (c && !S.reduceMotion) c.sh = Math.max(c.sh, a); };
  // A procedural texture from a per-pixel function (small sizes only; built once per mode).
  function pixTexture(X, w, h, fn, srgb) {
    const t = X.canvasTexture(w, h, (x) => {
      const img = x.createImageData(w, h), D = img.data;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const c = fn(i, j), k = (j * w + i) * 4; D[k] = c[0]; D[k + 1] = c[1]; D[k + 2] = c[2]; D[k + 3] = c[3] === undefined ? 255 : c[3]; }
      x.putImageData(img, 0, 0);
    });
    if (!srgb) t.encoding = X.THREE.LinearEncoding;
    t.wrapS = t.wrapT = X.THREE.RepeatWrapping;
    return t;
  }
  const fbm = (X, x, y, z, oct) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < (oct || 4); i++) { s += a * X.noise.noise(x * f, y * f, z * f); a *= 0.5; f *= 2; } return s; };
  const C = (hex) => new window.THREE.Color(hex).convertSRGBToLinear(); // art-directed sRGB colours into the linear pipeline

  /* ======================= 1. STEAMPUNK ======================= */
  // The gear train is a tree rooted at the great wheel behind the sphere (world units, y up).
  // a: direction from the parent (degrees), z: the plane it turns in (meshing gears share a plane), comp: same shaft.
  const ST_GEARS = [
    { id: 'GREAT', n: 72, mat: 'bronze', z: 0 },
    { id: 'D', n: 18, p: 0, a: 145, mat: 'brass', z: 0 },
    { id: 'C', n: 28, p: 1, a: -160, mat: 'copper', z: 0 },
    { id: 'B2', n: 14, p: 2, a: -110, mat: 'brass', z: 0 },
    { id: 'B', n: 40, p: 3, comp: true, mat: 'brass', z: -0.55 },
    { id: 'A', n: 12, p: 4, a: -120, mat: 'brass', z: -0.55 },
    { id: 'F', n: 24, p: 0, a: 20, mat: 'copper', z: 0 },
    { id: 'G', n: 20, p: 6, a: -20, mat: 'brass', z: 0 },
    { id: 'H', n: 30, p: 7, a: -90, mat: 'bronze', z: 0 }
  ];
  // Tooth k of a gear sits at local angle 2πk/N. A child meshing its parent along direction α must satisfy
  // θc = −(Np/Nc)·θp + α + π − (π − α·Np)/Nc, which puts a tooth of one wheel in a gap of the other on the line of centres.
  function stLayout(RG) {
    const m = RG * 2 / 72, gs = [];
    ST_GEARS.forEach((g, i) => {
      const o = Object.assign({}, g, { r: m * g.n / 2 });
      if (i === 0) { o.x = 0; o.y = 0; o.s = 1; o.c = 0; } else {
        const P = gs[g.p];
        if (g.comp) { o.x = P.x; o.y = P.y; o.s = P.s; o.c = P.c; } else {
          const al = g.a * Math.PI / 180, dd = P.r + o.r, q = P.n / g.n;
          o.x = P.x + Math.cos(al) * dd; o.y = P.y + Math.sin(al) * dd;
          o.s = -q * P.s; o.c = -q * P.c + al + Math.PI - (Math.PI - al * P.n) / g.n;
        }
      }
      gs.push(o);
    });
    return { m, gs, A: gs[5], F: gs[6] };
  }
  const ST_RATIO = (72 / 18) * (18 / 28) * (28 / 14) * (40 / 12); // dθA/dθgreat: idlers cancel, only 40/12 and 72/14 count
  function gearGeometry(THREE, N, m, th) {
    const r = m * N / 2, ro = r + m, ri = r - 1.25 * m, phi = TAU / N, sh = new THREE.Shape();
    for (let k = 0; k < N; k++) {
      const a = k * phi, pts = [[ri, a - 0.5 * phi], [ri, a - 0.3 * phi], [ro, a - 0.13 * phi], [ro, a + 0.13 * phi], [ri, a + 0.3 * phi]];
      pts.forEach((p, j) => { const X = Math.cos(p[1]) * p[0], Y = Math.sin(p[1]) * p[0]; if (k || j) sh.lineTo(X, Y); else sh.moveTo(X, Y); });
    }
    const rin = Math.max(r * 0.34, m * 3.2), rout = ri - m * 1.6;
    if (rout - rin > m * 2.4) { // a spoked wheel: windows between the spokes
      const ns = N >= 48 ? 6 : N >= 28 ? 5 : 4, sw = Math.max(m * 1.1, r * 0.075);
      for (let k = 0; k < ns; k++) {
        const a0 = k * TAU / ns + 0.3, a1 = a0 + TAU / ns, h = new THREE.Path();
        h.absarc(0, 0, rout, a0 + sw / rout, a1 - sw / rout, false); h.absarc(0, 0, rin, a1 - sw / rin, a0 + sw / rin, true);
        sh.holes.push(h);
      }
    } else for (let k = 0; k < 4; k++) { const a = k * TAU / 4 + 0.4, h = new THREE.Path(); h.absarc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.13, 0, TAU, false); sh.holes.push(h); }
    const geo = new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: true, bevelThickness: th * 0.14, bevelSize: m * 0.16, bevelOffset: -m * 0.16, bevelSegments: 2, curveSegments: 10 });
    geo.translate(0, 0, -th / 2);
    return geo;
  }
  function stDialTexture(X) {
    return X.canvasTexture(512, 512, (x, w) => {
      const c = w / 2, R = w * 0.48;
      const fc = x.createRadialGradient(c * 0.8, c * 0.8, 0, c, c, R); fc.addColorStop(0, '#f3ead2'); fc.addColorStop(1, '#cbb68c');
      x.fillStyle = fc; x.beginPath(); x.arc(c, c, R, 0, TAU); x.fill();
      const ang = (b) => (135 + b / 12 * 270) * Math.PI / 180;
      x.strokeStyle = 'rgba(170,20,10,0.85)'; x.lineWidth = R * 0.07; x.beginPath(); x.arc(c, c, R * 0.82, ang(10), ang(12)); x.stroke();
      x.strokeStyle = '#2a1a0a'; x.fillStyle = '#2a1a0a'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `${Math.round(R * 0.15)}px Georgia, serif`;
      for (let b = 0; b <= 12; b += 0.25) {
        const a = ang(b), big = b % 2 === 0, mid = b % 1 === 0, r0 = R * (big ? 0.7 : mid ? 0.76 : 0.8);
        x.lineWidth = big ? 4 : mid ? 2.4 : 1.2; x.beginPath(); x.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0); x.lineTo(c + Math.cos(a) * R * 0.88, c + Math.sin(a) * R * 0.88); x.stroke();
        if (big) x.fillText(String(b), c + Math.cos(a) * R * 0.55, c + Math.sin(a) * R * 0.55);
      }
      x.font = `${Math.round(R * 0.1)}px Georgia, serif`; x.fillText('BAR', c, c + R * 0.4); x.fillText('BOILER PRESSURE', c, c - R * 0.3);
      x.font = `${Math.round(R * 0.06)}px Georgia, serif`; x.fillText('DIFFERENTIAL ENGINE WORKS · No. 1871', c, c + R * 0.58);
    });
  }
  // A toothed frustum: the look of a bevel gear (teeth pushed out where cos(Nφ) > 0).
  function bevelGeometry(THREE, N, rBack, rFront, h) {
    const g = new THREE.CylinderGeometry(rFront, rBack, h, N * 4, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z); if (r < 1e-4) continue; const k = Math.cos(Math.atan2(z, x) * N) > 0 ? 1 : 0.86; p.setX(i, x * k); p.setZ(i, z * k); }
    g.computeVertexNormals();
    return g;
  }
  // Glowing gas in a glass chamber: a swirling fbm volume (rotating with height, rising in time), brightest face-on,
  // with a fresnel rim. Additive, so it reads as emitted light; bloom does the rest.
  function gasMaterial(X) {
    const THREE = X.THREE;
    return new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uC1: { value: new THREE.Color(0.9, 0.22, 0.02) }, uC2: { value: new THREE.Color(1, 0.62, 0.16) }, uG: { value: 1 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec3 vP; varying vec3 vN; varying vec3 vV; void main(){ vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: [
        'uniform float uT; uniform vec3 uC1; uniform vec3 uC2; uniform float uG; varying vec3 vP; varying vec3 vN; varying vec3 vV;',
        'float h(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }',
        'float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
        '  return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y),',
        '             mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z); }',
        'float fbm(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * n3(p); p *= 2.03; a *= 0.5; } return s; }',
        'void main(){',
        '  float ang = uT * 0.8 + vP.y * 1.6; vec3 q = vec3(vP.x * cos(ang) - vP.z * sin(ang), vP.y - uT * 0.45, vP.x * sin(ang) + vP.z * cos(ang));',
        '  float n = fbm(q * 2.4 + fbm(q * 1.3 + uT * 0.25)); float face = pow(abs(dot(vN, vV)), 1.4);',
        '  vec3 col = mix(uC1, uC2, smoothstep(0.35, 0.8, n)) * (0.2 + 1.8 * n * n) * uG * face;',
        '  col += uC2 * pow(1.0 - abs(dot(vN, vV)), 3.0) * 0.35 * uG;',
        '  gl_FragColor = vec4(col, 1.0);',
        '}'
      ].join('\n')
    });
  }
  const ST_L = 0.3, ST_G = 9.81; // flyball governor: arm length (m) and gravity; steady state cos α = g/(ω²L)
  addMode({
    id: 'pk_steam', name: 'STEAMPUNK', glyphs: G('⚙Ω⊕⊗φΘ∅⌀☼♁☿†§¶', 'ΩΦΘ§0123456789'),
    base: [40, 60, 80], palette: [[36, 90, 60], [20, 85, 58], [170, 45, 55], [48, 100, 72]],
    links: ['pk_strap', 'pk_pipe', 'chain', 'lightning'], count: 90, noHueShift: true, pageBg: ['#24180c', '#070403'],
    shapes: ['sphere', 'torus', 'crown', 'torus_knot', 'helix', 'dodecahedron', 'gyroid', 'cube'],
    init(S) { Object.assign(S.data, { th: 0, wA: 3.4, p: 2.4, lastPa: null, blow: -1e9, blowP: 0, peakP: 0, alpha: 0 }); },
    update(S, now, dt) {
      const d = S.data, X = S.three;
      const pT = S.holding ? [3.6, 5.8, 8.4, 10.6][S.stage] + 0.25 * Math.sin(now * 0.004) : 2.4 + 0.3 * Math.sin(now * 0.0004);
      d.p += (pT - d.p) * ease(dt, S.holding ? 700 : now - d.blow < 2000 ? 380 : 1500);
      d.peakP = Math.max(d.peakP, d.p);
      // the input wheel: steam drives it (ω ∝ p); a pointer circling its hub cranks it by hand; a swipe shoves it
      let wT = 1.4 * d.p, cranked = false;
      if (X && d.lay && hasPtr(S)) {
        const A = d.lay.A, P = X.fromScreen(S.ptr.x, S.ptr.y, A.z), dx = P.x - A.x, dy = P.y - A.y, r = Math.hypot(dx, dy);
        if (r < A.r * 3 && r > 0.05) {
          const a = Math.atan2(dy, dx);
          if (d.lastPa !== null && dt > 0) { const w = wrapA(a - d.lastPa) / (dt / 1000); if (Math.abs(w) > 0.3) { wT = clamp(w, -40, 40); cranked = true; } }
          d.lastPa = a;
        } else d.lastPa = null;
        d.wA = clamp(d.wA + clamp(pvel(S).x, -25, 25) * 0.01 * dt / 16.7, -45, 45);
      }
      d.cranked = cranked;
      d.wA += (wT - d.wA) * ease(dt, cranked ? 80 : 650);
      d.th += d.wA / ST_RATIO * dt / 1000; // the great wheel turns 17.1× slower than the input
      // the governor spindle runs 3× wheel D (a 30:10 bevel pair); its balls settle where cos α = g/(ω²L)
      d.wGov = Math.abs(d.wA / ST_RATIO * 4 * 3);
      const c = ST_G / (d.wGov * d.wGov * ST_L), aT = c >= 1 ? 0 : Math.acos(c);
      d.alpha += (aT - d.alpha) * ease(dt, 400);
    },
    three: {
      init(S, X) {
        const THREE = X.THREE, sc = X.scene, d = S.data;
        X.setBloom(0.6, 0.55, 0.82); X.setExposure(1.05);
        X.studioEnvironment();
        sc.background = C(0x0a0704); sc.fog = new THREE.Fog(C(0x0a0704), 20, 44);
        const RG = 3.8, lay = (d.lay = stLayout(RG)), m = lay.m;
        // materials: brushed brass, copper, bronze (with grime in the roughness), steel, cast iron
        const brush = pixTexture(X, 256, 256, (i, j) => { const r = Math.hypot(i - 128, j - 128), g = fbm(X, i / 24, j / 24, 2, 3); const v = 120 + 22 * Math.sin(r * 2.1 + Math.sin(r * 0.37) * 3) + rand(-14, 14) + 70 * Math.max(0, g); return [v, v, v]; });
        const mk3 = (hex, rough) => { const t = brush.clone(); t.needsUpdate = true; return new THREE.MeshStandardMaterial({ color: C(hex), metalness: 1, roughness: rough, roughnessMap: t, envMapIntensity: 0.85 }); };
        const mats = { brass: mk3(0xd8b06a, 0.34), copper: mk3(0xc8805a, 0.4), bronze: mk3(0xb89058, 0.4) };
        const steel = new THREE.MeshStandardMaterial({ color: C(0xa8adb3), metalness: 1, roughness: 0.28, envMapIntensity: 1 });
        const castIron = new THREE.MeshStandardMaterial({ color: C(0x3a3632), metalness: 0.8, roughness: 0.55, envMapIntensity: 0.6 });
        const iron = pixTexture(X, 512, 256, (i, j) => { const n = fbm(X, i / 40, j / 40, 0.5, 4), v = 34 + 26 * n + rand(-6, 6); return [v * 1.15, v * 0.95, v * 0.8]; }, true);
        iron.repeat.set(3, 2);
        const plate = new THREE.Mesh(new THREE.PlaneGeometry(48, 30), new THREE.MeshStandardMaterial({ map: iron, color: C(0x8a7a6a), metalness: 0.65, roughness: 0.72, bumpMap: iron, bumpScale: 0.03 }));
        plate.position.z = -1.4; plate.receiveShadow = true; sc.add(plate);
        const seamMat = new THREE.MeshStandardMaterial({ color: C(0x2a2018), metalness: 0.6, roughness: 0.6 });
        const rivGeo = new THREE.SphereGeometry(0.07, 10, 6, 0, TAU, 0, Math.PI / 2); rivGeo.rotateX(Math.PI / 2);
        const rivets = [];
        for (let X0 = -22; X0 <= 22; X0 += 5.5) { const seam = new THREE.Mesh(new THREE.BoxGeometry(0.06, 30, 0.04), seamMat); seam.position.set(X0, 0, -1.38); sc.add(seam); for (let y = -14; y <= 14; y += 0.55) rivets.push([X0 + 0.22, y]); }
        for (let y = -12; y <= 12; y += 4.5) { const seam = new THREE.Mesh(new THREE.BoxGeometry(48, 0.06, 0.04), seamMat); seam.position.set(0, y, -1.38); sc.add(seam); for (let x = -23; x <= 23; x += 0.55) rivets.push([x, y + 0.22]); }
        const riv = new THREE.InstancedMesh(rivGeo, new THREE.MeshStandardMaterial({ color: C(0x6e5c48), metalness: 0.85, roughness: 0.55 }), rivets.length);
        const M = new THREE.Matrix4();
        rivets.forEach((p, i) => { M.makeTranslation(p[0], p[1], -1.39); riv.setMatrixAt(i, M); });
        riv.castShadow = true; sc.add(riv);
        // the spur gears, hubs, bolts and axles
        d.gm = []; const bolts = [];
        lay.gs.forEach((g, i) => {
          const th = g.id === 'GREAT' ? m * 2.4 : m * 3.4, geo = gearGeometry(THREE, g.n, m, th), mat = mats[g.mat].clone();
          mat.roughnessMap = mats[g.mat].roughnessMap.clone(); mat.roughnessMap.needsUpdate = true;
          const ro = g.r + m; mat.roughnessMap.repeat.set(1 / (2 * ro), 1 / (2 * ro)); mat.roughnessMap.offset.set(0.5, 0.5);
          const mesh = new THREE.Mesh(geo, mat); mesh.position.set(g.x, g.y, g.z); mesh.castShadow = mesh.receiveShadow = true;
          const hubR = Math.max(m * 2.4, g.r * 0.24), hub = new THREE.Mesh(new THREE.CylinderGeometry(hubR, hubR * 1.05, th * 1.7, 36), mat); hub.rotation.x = Math.PI / 2; mesh.add(hub);
          for (let k = 0; k < 6; k++) { const a = k * TAU / 6; bolts.push({ g: i, x: Math.cos(a) * hubR * 0.68, y: Math.sin(a) * hubR * 0.68, z: th * 0.85 + 0.02 }); }
          sc.add(mesh); d.gm.push(mesh);
          if (!g.comp) { const len = Math.abs(g.z + 1.4) + th * 2.2; const ax = new THREE.Mesh(new THREE.CylinderGeometry(m * 0.9, m * 0.9, len, 16), steel); ax.rotation.x = Math.PI / 2; ax.position.set(g.x, g.y, (g.z - 1.4) / 2 + th * 0.4); ax.castShadow = true; sc.add(ax); }
        });
        const boltGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.06, 6); boltGeo.rotateX(Math.PI / 2);
        d.bolts = new THREE.InstancedMesh(boltGeo, steel, bolts.length); d.boltList = bolts; d.bolts.castShadow = true; sc.add(d.bolts);
        // a cast-iron flywheel behind wheel F
        const F = lay.F;
        const fly = new THREE.Group(); fly.position.set(F.x, F.y, -0.85); sc.add(fly); d.fly = fly;
        const rim = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.2, 14, 64), castIron); rim.castShadow = true; fly.add(rim);
        for (let k = 0; k < 6; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.1, 0.12), castIron); sp.geometry.translate(0, 1.05, 0); sp.rotation.z = k * TAU / 6; sp.castShadow = true; fly.add(sp); }
        // a V-twin on wheel F: two cylinders at ±30° from vertical sharing one crank pin (true slider-crank each)
        const rc = F.r * 0.55, l = rc * 2.8, cw = F.r * 0.33;
        d.crank = { rc, l };
        d.pin = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.62, 16), steel); d.pin.rotation.x = Math.PI / 2; sc.add(d.pin);
        d.cyls = [60, 120].map((deg, i) => {
          const phi = deg * Math.PI / 180, ux = Math.cos(phi), uy = Math.sin(phi), s0 = l - rc + 0.25, s1 = l + rc + 0.9, mid = (s0 + s1) / 2;
          const g = new THREE.Group(); g.position.set(F.x, F.y, 0.12 + i * 0.22); g.rotation.z = phi - Math.PI / 2; sc.add(g);
          const body = new THREE.Mesh(new THREE.CylinderGeometry(cw, cw, s1 - s0, 40), steel); body.position.y = mid; body.castShadow = true; g.add(body);
          [s0, s1].forEach((s) => { const cap = new THREE.Mesh(new THREE.CylinderGeometry(cw * 1.22, cw * 1.22, 0.16, 40), mats.brass); cap.position.y = s; cap.castShadow = true; g.add(cap); });
          for (let k = 0; k < 4; k++) { const fin = new THREE.Mesh(new THREE.CylinderGeometry(cw * 1.08, cw * 1.08, 0.05, 40), steel); fin.position.y = s0 + 0.5 + k * 0.35; g.add(fin); }
          const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1, 12), steel); g.add(rod);
          const cross = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.24), steel); cross.castShadow = true; g.add(cross);
          const con = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1, 0.1), mats.brass); con.castShadow = true; sc.add(con);
          return { phi, ux, uy, s0, s1, g, rod, cross, con, z: 0.32 + i * 0.22, last: 0, head: new THREE.Vector3(F.x + ux * (s1 + 0.1), F.y + uy * (s1 + 0.1), 0.2) };
        });
        // the boiler gauge, the pipework, the safety valve
        const gx = 8.9, gy = -4.25, gR = 1.0, head = d.cyls[0].head;
        d.g = { x: gx, y: gy, R: gR };
        const gauge = new THREE.Group(); gauge.position.set(gx, gy, 0.4); sc.add(gauge);
        const body = new THREE.Mesh(new THREE.CylinderGeometry(gR * 1.05, gR * 1.05, 0.5, 48), mats.brass); body.rotation.x = Math.PI / 2; body.position.z = -0.2; body.castShadow = true; gauge.add(body);
        const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
        gauge.add(at(new THREE.Mesh(new THREE.TorusGeometry(gR * 1.02, 0.09, 16, 64), mats.brass), 0, 0, 0.06));
        const face = new THREE.Mesh(new THREE.CircleGeometry(gR, 64), new THREE.MeshStandardMaterial({ map: stDialTexture(X), roughness: 0.55, metalness: 0 })); face.position.z = 0.051; gauge.add(face);
        d.needle = new THREE.Group(); d.needle.position.z = 0.09; gauge.add(d.needle);
        const nd = new THREE.Mesh(new THREE.BoxGeometry(0.035, gR * 0.86, 0.02), new THREE.MeshStandardMaterial({ color: C(0x5a0a04), roughness: 0.4, metalness: 0.3 })); nd.position.y = gR * 0.34; d.needle.add(nd);
        d.needle.add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 8), mats.brass));
        const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.07, roughness: 0.03, metalness: 0, clearcoat: 1, envMapIntensity: 2.2, depthWrite: false });
        gauge.add(at(new THREE.Mesh(new THREE.CircleGeometry(gR, 48), glassMat), 0, 0, 0.14));
        const pv = (x, y, z) => new THREE.Vector3(x, y, z === undefined ? 0.2 : z);
        const tube = (pts, r, mat) => { const path = new THREE.CurvePath(); for (let i = 0; i < pts.length - 1; i++) path.add(new THREE.LineCurve3(pts[i], pts[i + 1])); const t = new THREE.Mesh(new THREE.TubeGeometry(path, 24 * pts.length, r, 14, false), mat); t.castShadow = true; sc.add(t); return t; };
        tube([pv(head.x, head.y), pv(head.x, head.y + 0.6), pv(gx, head.y + 0.6), pv(gx, gy + gR)], 0.16, mats.copper);
        tube([pv(gx, gy - gR), pv(gx, -6.3), pv(16, -6.3)], 0.16, mats.copper);
        d.flanges = [[(head.x + gx) / 2, head.y + 0.6, 0], [gx, 2.4, 1], [gx, -0.8, 1], [gx, -5.6, 1]];
        d.flanges.forEach((f) => { const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.14, 24), mats.brass); fl.position.set(f[0], f[1], 0.2); if (!f[2]) fl.rotation.z = Math.PI / 2; fl.castShadow = true; sc.add(fl); });
        const vy = head.y + 0.6;
        const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.6, 24), mats.brass); valve.position.set(gx, vy + 0.4, 0.2); valve.castShadow = true; sc.add(valve);
        const lever = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.06), steel); lever.position.set(gx - 0.55, vy + 0.72, 0.2); lever.rotation.z = 0.08; sc.add(lever);
        const wt = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 12), mats.bronze); wt.position.set(gx - 1.12, vy + 0.66, 0.2); wt.castShadow = true; sc.add(wt);
        d.valve = { x: gx, y: vy + 0.75 };
        const wheelV = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.04, 8, 24), new THREE.MeshStandardMaterial({ color: C(0x8a1a12), metalness: 0.4, roughness: 0.5 })); wheelV.position.set(gx, 0.6, 0.55); sc.add(wheelV); d.handwheel = wheelV;
        // glass pressure chambers with glowing gas, brass collars and tie-rods
        d.gas = [];
        const chamber = (x, y, z, len, r, horiz) => {
          const g = new THREE.Group(); g.position.set(x, y, z); if (horiz) g.rotation.z = Math.PI / 2; sc.add(g);
          const gm = gasMaterial(X), gas = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.86, r * 0.86, len * 0.96, 40, 8), gm); g.add(gas); d.gas.push(gm);
          const gl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 48, 1, true), glassMat); gl.renderOrder = 6; g.add(gl);
          [-1, 1].forEach((s) => { const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.2, r * 1.2, 0.24, 40), mats.brass); cap.position.y = s * len / 2; cap.castShadow = true; g.add(cap); const nut = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.35, r * 0.35, 0.2, 6), steel); nut.position.y = s * (len / 2 + 0.2); g.add(nut); });
          for (let k = 0; k < 4; k++) { const a = k * TAU / 4 + 0.6, rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, len + 0.2, 8), steel); rod.position.set(Math.cos(a) * r * 1.1, 0, Math.sin(a) * r * 1.1); g.add(rod); }
          const pl = new THREE.PointLight(C(0xffa040), 8, 0, 2); g.add(pl); d.gasL = (d.gasL || []).concat(pl);
        };
        chamber(-9.4, 2.0, 0.6, 3.0, 0.55, false);
        chamber(4.9, -4.75, 0.9, 2.1, 0.42, false);
        chamber(6.25, -4.75, 0.9, 2.1, 0.42, false);
        tube([pv(4.9, -6.05, 0.9), pv(4.9, -6.3, 0.9), pv(6.25, -6.3, 0.9), pv(6.25, -6.05, 0.9)], 0.11, mats.brass);
        tube([pv(6.25, -6.3, 0.9), pv(gx, -6.3, 0.9), pv(gx, -6.3, 0.3)], 0.11, mats.copper);
        tube([pv(-9.4, 3.7, 0.6), pv(-9.4, 4.6, 0.6), pv(-7.2, 4.6, 0.2), pv(-7.2, 6.8, 0.2)], 0.12, mats.copper);
        // bevel pair on wheel D's shaft driving a vertical spindle and a flyball governor
        const D = lay.gs[1];
        d.bevBig = new THREE.Mesh(bevelGeometry(THREE, 30, 0.78, 0.52, 0.24), mats.brass); d.bevBig.geometry.rotateX(Math.PI / 2); d.bevBig.position.set(D.x, D.y, 0.48); d.bevBig.castShadow = true; sc.add(d.bevBig);
        const zS = 0.98;
        d.bevSmall = new THREE.Mesh(bevelGeometry(THREE, 10, 0.17, 0.27, 0.2), mats.copper); d.bevSmall.position.set(D.x, D.y + 0.7, zS); sc.add(d.bevSmall);
        const gov = new THREE.Group(); gov.position.set(D.x, D.y + 0.7, zS); sc.add(gov); d.gov = gov;
        const spin = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.0, 12), steel); spin.position.y = 1.0; gov.add(spin);
        const capG = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 10), mats.brass); capG.position.y = 2.0; gov.add(capG);
        d.govParts = [-1, 1].map((side) => {
          const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 8), steel); gov.add(arm);
          const ball = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 16), mats.brass); ball.castShadow = true; gov.add(ball);
          const link = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 8), steel); gov.add(link);
          return { side, arm, ball, link };
        });
        d.sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.14, 16), mats.brass); gov.add(d.sleeve);
        // caged work lamps
        d.lamps = [];
        [[-1.6, 5.0, 2.0], [3.2, 5.4, 1.6]].forEach((p) => {
          const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.8, 0.8) })); bulb.position.set(p[0], p[1], p[2]); sc.add(bulb);
          for (let k = 0; k < 3; k++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.012, 6, 20), steel); ring.rotation.y = k * Math.PI / 3; ring.position.copy(bulb.position); sc.add(ring); }
          const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 3, 6), castIron); cord.position.set(p[0], p[1] + 1.7, p[2]); sc.add(cord);
          const pl = new THREE.PointLight(C(0xffb066), 26, 0, 2); pl.position.copy(bulb.position); sc.add(pl);
          d.lamps.push({ bulb, pl });
        });
        // light: a warm key with soft shadows, a cool rim, a dim fill, and the firebox glowing below the frame
        const key = new THREE.SpotLight(C(0xffd8a8), 1500, 0, 0.6, 0.65, 2); key.position.set(-9, 10, 14); key.target.position.set(0, 0, 0);
        key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.camera.near = 8; key.shadow.camera.far = 40; key.shadow.bias = -0.0004; key.shadow.radius = 3;
        sc.add(key); sc.add(key.target);
        const rimL = new THREE.DirectionalLight(C(0x8fb2ff), 0.9); rimL.position.set(10, 6, -3); sc.add(rimL);
        sc.add(new THREE.HemisphereLight(C(0x6a5a48), C(0x120c08), 0.5));
        d.fire = new THREE.PointLight(C(0xff7a30), 60, 0, 2); d.fire.position.set(0, -8.5, 3.5); sc.add(d.fire);
        d.steam = particles(X, 520, {}); sc.add(d.steam.pts);
      },
      update(S, X, now, dt) {
        const d = S.data, lay = d.lay;
        if (!lay) return;
        const THREE = X.THREE, T = now / 1000, M = new THREE.Matrix4();
        lay.gs.forEach((g, i) => (d.gm[i].rotation.z = g.s * d.th + g.c));
        d.boltList.forEach((b, i) => { const g = lay.gs[b.g], th = g.s * d.th + g.c, c = Math.cos(th), s = Math.sin(th); M.makeTranslation(g.x + b.x * c - b.y * s, g.y + b.x * s + b.y * c, g.z + b.z); d.bolts.setMatrixAt(i, M); });
        d.bolts.instanceMatrix.needsUpdate = true;
        const F = lay.F, thF = F.s * d.th + F.c, k = d.crank, px = F.x + Math.cos(thF) * k.rc, py = F.y + Math.sin(thF) * k.rc;
        d.fly.rotation.z = thF;
        d.pin.position.set(px, py, 0.45);
        d.cyls.forEach((c) => { // slider-crank along the cylinder axis u: s = r·cos(θ−φ) + √(l² − r²·sin²(θ−φ))
          const a = thF - c.phi, s = k.rc * Math.cos(a) + Math.sqrt(k.l * k.l - (k.rc * Math.sin(a)) ** 2);
          c.cross.position.y = s; c.rod.position.y = (s + c.s0 + 0.3) / 2; c.rod.scale.y = Math.max(0.01, c.s0 + 0.3 - s);
          const hx = F.x + c.ux * s, hy = F.y + c.uy * s;
          c.con.position.set((px + hx) / 2, (py + hy) / 2, c.z); c.con.scale.y = k.l; c.con.rotation.z = Math.atan2(hy - py, hx - px) - Math.PI / 2;
          const tdc = Math.floor(a / TAU);
          if (tdc !== c.last) { c.last = tdc; for (let q = 0; q < 5; q++) d.steam.emit({ x: c.head.x + rand(-0.15, 0.15), y: c.head.y, z: 0.25, vx: c.ux * rand(0.5, 1.2) + rand(-0.3, 0.3), vy: c.uy * rand(0.6, 1.4), vz: rand(-0.1, 0.4), life: rand(1.5, 2.5), s0: 0.3, s1: rand(1.4, 2.4), a: 0.3, wx: 0.15, c: [0.86, 0.84, 0.8] }); }
        });
        // governor: the spindle spins at 3× wheel D, the balls fly out to cos α = g/(ω²L)
        const thD = lay.gs[1].s * d.th + lay.gs[1].c;
        d.bevBig.rotation.z = thD; d.bevSmall.rotation.y = -3 * thD; d.gov.rotation.y = -3 * thD;
        const al = d.alpha, La = 0.8;
        d.govParts.forEach((q) => {
          const bx = q.side * Math.sin(al) * La, by = 2.0 - Math.cos(al) * La;
          q.ball.position.set(bx, by, 0);
          q.arm.position.set(bx / 2, (2.0 + by) / 2, 0); q.arm.scale.y = La; q.arm.rotation.z = q.side * al;
          const sy = 2.0 - 2 * Math.cos(al) * La * 0.9; q.link.position.set(bx / 2, (by + sy) / 2, 0); q.link.scale.y = Math.hypot(bx, by - sy); q.link.rotation.z = -Math.atan2(bx, by - sy);
          d.sleeve.position.y = sy;
        });
        // steam: leaks at the flanges, the valve feathering at the red line, the blow-off after release
        if (S.holding && S.stage >= 1 && Math.random() < 0.12 * S.stage) { const f = pick(d.flanges); d.steam.emit({ x: f[0], y: f[1], z: 0.35, vx: rand(-1, 1), vy: rand(-0.4, 1), vz: rand(0.2, 0.8), life: 1.2, s0: 0.1, s1: rand(0.8, 1.3), a: 0.35, c: [0.9, 0.9, 0.88] }); }
        if (S.holding && S.stage >= 3 && Math.random() < 0.4) d.steam.emit({ x: d.valve.x, y: d.valve.y, z: 0.2, vx: rand(-0.2, 0.2), vy: rand(2, 3.5), life: 1, s0: 0.15, s1: 1.2, a: 0.4, c: [0.92, 0.92, 0.9] });
        const bt = now - d.blow;
        if (bt < 1900) { const f = 1 - bt / 1900; for (let q = 0; q < Math.round(5 * f + 1); q++) d.steam.emit({ x: d.valve.x + rand(-0.06, 0.06), y: d.valve.y + 0.1, z: 0.2, vx: rand(-0.5, 0.5), vy: rand(6, 11) * (0.5 + f), vz: rand(-0.3, 0.6), life: rand(1.6, 2.6), s0: 0.25, s1: rand(2.5, 5) * (0.6 + d.blowP / 14), a: 0.42 * f + 0.08, drag: 0.95, wx: 0.3, c: [0.94, 0.94, 0.93] }); }
        d.steam.step(dt, X.camera);
        // gas glows with pressure (and with the infection); colour runs hotter toward the red line
        const inf = S.active.length ? S.infected / S.active.length : 0, hot = smooth(7, 11, d.p), flash = bt < 600 ? 1 - bt / 600 : 0;
        d.gas.forEach((g, i) => { g.uniforms.uT.value = T * (1 + d.p * 0.08) + i * 7; g.uniforms.uG.value = 1.1 + d.p / 12 * 1.6 + inf * 0.6 + flash * 2; g.uniforms.uC1.value.setRGB(0.9, lerp(0.22, 0.06, hot), lerp(0.02, 0.04, hot)); g.uniforms.uC2.value.setRGB(1, lerp(0.62, 0.42, hot), lerp(0.16, 0.3, hot)); });
        d.gasL.forEach((l) => (l.intensity = 10 + d.p * 3));
        d.lamps.forEach((l, i) => { const fl = 0.92 + 0.08 * Math.sin(T * 13 + i * 3) * Math.sin(T * 7.3); l.pl.intensity = 26 * fl; l.bulb.material.color.setRGB(3 * fl, 1.8 * fl, 0.8 * fl); });
        const jit = S.holding && S.stage >= 2 && !S.reduceMotion ? rand(-0.06, 0.06) * (S.stage - 1) : 0;
        d.needle.rotation.z = -((135 + clamp(d.p + jit, 0, 12.4) / 12 * 270) * Math.PI / 180) - Math.PI / 2;
        d.handwheel.rotation.z = Math.sin(T * 0.3) * 0.2;
        d.fire.intensity = 40 + d.p * d.p * 9 * (0.9 + 0.1 * Math.sin(now * 0.02));
        camRig(S, X, { look: [0, 0, 0], r: 16.4, el: 0.04, sway: 0.13, speed: 0.00009, par: 0.22, parY: 0.1, bob: 0.02 }, now, dt);
      }
    },
    drawNode(S, ctx, n, g, size, a) {
      if (n.inf) { ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, '255,170,70', n.sx, n.sy, size * 1.1, 0.16 * a); ctx.globalCompositeOperation = 'source-over'; }
      ctx.font = `${size.toFixed(1)}px monospace`; ctx.fillStyle = n.inf ? S.colorOf(n.gen, a) : `rgba(244,226,186,${a * 0.92})`; ctx.fillText(g, n.sx, n.sy);
      return true;
    },
    over(S, ctx) { // understated instrument tags: the input wheel and the governor
      const X = S.three, d = S.data;
      if (!X || !d.lay) return;
      const A = d.lay.A, p = X.toScreen(new X.THREE.Vector3(A.x + A.r + 0.4, A.y - A.r * 0.3, A.z)), D = d.lay.gs[1], q = X.toScreen(new X.THREE.Vector3(D.x + 0.9, D.y + 2.2, 1));
      ctx.font = '11px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(255,226,170,0.75)';
      ctx.fillText(`input N12 · ${(d.wA * 60 / TAU).toFixed(0)} rpm${d.cranked ? ' · hand-cranked' : ''}`, p.x, p.y);
      ctx.fillStyle = 'rgba(255,226,170,0.6)'; ctx.fillText(`governor ${(d.wGov * 60 / TAU).toFixed(0)} rpm · α ${(d.alpha * 180 / Math.PI).toFixed(0)}°`, q.x, q.y);
    },
    onRelease(S, held, pw) {
      const d = S.data;
      d.blow = S.now; d.blowP = d.p; d.wA += 6 * pw;
      kick(S, 0.05 * pw);
      return false;
    },
    hud(S) {
      const d = S.data, rpm = d.wA * 60 / TAU, p = d.p.toFixed(1), al = (d.alpha * 180 / Math.PI).toFixed(0);
      if (S.holding) return [`stoking · ${p} bar · ω₁N₁ = ω₂N₂ keeps the books balanced`,
        `${p} bar · input ${rpm.toFixed(0)} rpm → great wheel ${(rpm / ST_RATIO).toFixed(1)} rpm · torque ×${ST_RATIO.toFixed(1)}`,
        `${p} bar · governor balls out to ${al}°: cos α = g/(ω²L) · idlers change direction, never ratio`,
        `${p} bar · red line · the safety valve is set at 10 bar`][S.stage];
      if (S.now - d.blow < 3500) return `safety valve lifted at ${d.blowP.toFixed(1)} bar · peak ${d.peakP.toFixed(1)} bar`;
      return `ω₁N₁ = ω₂N₂ · (40/12)(72/14) = 1:${ST_RATIO.toFixed(2)} · ${rpm.toFixed(0)} → ${(rpm / ST_RATIO).toFixed(2)} rpm · governor ${al}°`;
    }
  });

  /* ======================= 2. FROST CITY (frost-punk genre) ======================= */
  // The generator radiates P = εσA(T⁴ − Tₐ⁴). A street stays at +10 °C where the radiated flux P/(4πr²) still covers
  // its loss h·(10 − Tₐ), so the warm radius is r = √(P / (4π·h·(10 − Tₐ))). Snow on the ground and the roofs melts
  // inside that radius and refreezes outside it, with a lag. The district relaxes by Newton's law of cooling.
  const SIGMA = 5.670374419e-8, FR_EPS = 0.9, FR_A = 40, FR_H = 10, FR_UA = 2e5, FR_CORE = 21;
  const bbColor = (T) => { const t = clamp((T - 800) / 900, 0, 1); return [1, lerp(0.22, 0.72, t), lerp(0.03, 0.4, t * t)]; }; // rough blackbody tint 800–1700 K
  function frPlan() { // houses and workshops on rings, leaving radial avenues and two ring roads clear
    const out = [];
    for (let r = 11; r < 50; r += rand(3.6, 4.6)) {
      if (Math.abs(r - 22) < 2.2 || Math.abs(r - 36) < 2.2) continue;
      for (let a = rand(0, 0.3); a < TAU;) {
        const w = rand(2.6, 4.2), step = (w + rand(0.6, 1.6)) / r, am = a + step / 2;
        const off = ((am % (TAU / 8)) + TAU / 8) % (TAU / 8), street = Math.min(off, TAU / 8 - off) * r;
        if (street > 2.4) {
          const big = Math.random() < 0.18 && r > 14;
          out.push({ r: r + rand(-0.5, 0.5), a: am, w: big ? w * 1.5 : w, d: rand(2.6, 3.8) * (big ? 1.4 : 1), h: big ? rand(5, 8.5) : rand(2.2, 4.2), big, warm: -1, chim: !big && Math.random() < 0.6 });
        }
        a += step;
      }
    }
    return out;
  }
  addMode({
    id: 'pk_frost', name: 'FROST CITY', glyphs: G('ᚠᚢᚦᚨᚱᚲᚷᚺᚾᛁᛃᛇᛉᛊᛏᛒᛗᛟ❄❅❆°', 'ABDEFHIKMNRSTXZ°*+'),
    base: [200, 50, 88], palette: [[28, 100, 60], [12, 100, 58], [45, 100, 68], [195, 90, 75]],
    links: ['pk_frost', 'pk_frost', 'fire', 'plasma'], count: 110, noHueShift: true, pageBg: ['#0e1a26', '#020508'],
    shapes: ['sphere', 'icosahedron', 'torus', 'crown', 'buckyball', 'snub_dodecahedron', 'helix', 'menger'],
    init(S) { Object.assign(S.data, { Tc: 900, Tcity: -42, risk: 0, pulse: -1e9, vent: false, rMelt: 12 }); },
    update(S, now, dt) {
      const d = S.data;
      d.Tout = clamp(-50 + 26 * Math.sin(now / 11000) + 7 * Math.sin(now / 2700 + 1), -80, -20); // the storm
      const TcT = S.holding ? [1040, 1200, 1360, 1540][S.stage] : 900 + 25 * Math.sin(now / 1700);
      d.Tc += (TcT - d.Tc) * ease(dt, S.holding ? 1100 : 2600);
      const Ta = d.Tout + 273.15;
      d.P = FR_EPS * SIGMA * FR_A * (Math.pow(d.Tc, 4) - Math.pow(Ta, 4)); // W
      d.rWarm = Math.sqrt(d.P / (4 * Math.PI * FR_H * (10 - d.Tout))); // m
      d.rMelt += (d.rWarm - d.rMelt) * ease(dt, d.rWarm > d.rMelt ? 1800 : 4500); // snow melts faster than it refreezes
      const Teq = d.Tout + d.P / FR_UA; // Newton: dT/dt = −k(T − Tₐ) + P/C  →  T relaxes to Tₐ + P/UA
      d.Tcity += (Teq - d.Tcity) * ease(dt, 3500);
      d.risk = clamp(d.risk + (S.holding ? Math.max(0, (d.Tc - 1220) / 300) * 0.28 : -0.12) * dt / 1000, 0, 1);
    },
    three: {
      init(S, X) {
        const THREE = X.THREE, sc = X.scene, d = S.data;
        X.setBloom(0.95, 0.6, 0.78); X.setExposure(1.15);
        sc.background = C(0x070b12); sc.fog = new THREE.FogExp2(C(0x0c1522), 0.0115);
        d.U = { warm: { value: 12 }, pulseR: { value: -1 }, pulseA: { value: 0 } };
        const U = d.U;
        // terrain: a flat crater floor, the crater wall, broken plateau and far ridges
        const tg = new THREE.PlaneGeometry(320, 320, 200, 200); tg.rotateX(-Math.PI / 2);
        const pa = tg.attributes.position;
        for (let i = 0; i < pa.count; i++) {
          const x = pa.getX(i), z = pa.getZ(i), r = Math.hypot(x, z);
          let y = 0.12 * fbm(X, x * 0.15, z * 0.15, 1, 2);
          y += smooth(52, 68, r) * 15 + smooth(60, 90, r) * 4 * fbm(X, x * 0.03, z * 0.03, 3, 4);
          y += smooth(100, 150, r) * (18 + 30 * Math.abs(fbm(X, x * 0.012, z * 0.012, 7, 4)));
          pa.setY(i, y);
        }
        tg.computeVertexNormals();
        const snowTex = pixTexture(X, 256, 256, (i, j) => { const n = fbm(X, i / 18, j / 18, 2, 3), v = 228 + 18 * n + (Math.random() < 0.01 ? 25 : 0); return [v - 6, v, Math.min(255, v + 8)]; }, true);
        snowTex.repeat.set(60, 60);
        const ground = new THREE.MeshStandardMaterial({ map: snowTex, color: C(0xe8eef6), roughness: 0.9, metalness: 0 });
        ground.onBeforeCompile = (sh) => {
          Object.assign(sh.uniforms, { uWarm: U.warm, uPulseR: U.pulseR, uPulseA: U.pulseA });
          sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
            .replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
          sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; uniform float uWarm; uniform float uPulseR; uniform float uPulseA;')
            .replace('#include <color_fragment>', [
              '#include <color_fragment>',
              'float rr = length(vWP.xz); float ang = atan(vWP.z, vWP.x);',
              'float sec = 6.2831853 / 8.0; float am = mod(ang, sec); float dl = min(am, sec - am) * rr;',
              'float street = (1.0 - smoothstep(1.1, 2.0, dl)) * step(7.0, rr) * (1.0 - smoothstep(48.0, 52.0, rr));',
              'street = max(street, (1.0 - smoothstep(1.0, 1.8, abs(rr - 22.0))) + (1.0 - smoothstep(1.0, 1.8, abs(rr - 36.0))));',
              'street = clamp(street, 0.0, 1.0) * (1.0 - smoothstep(50.0, 54.0, rr));',
              'diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.62, 0.64, 0.68), street * 0.8);',
              'float melt = 1.0 - smoothstep(uWarm * 0.82, uWarm * 1.06, rr);',
              'float slush = smoothstep(uWarm * 0.7, uWarm * 0.95, rr) * melt;',
              'vec3 wet = mix(vec3(0.030, 0.026, 0.022), vec3(0.06, 0.055, 0.05), street);',
              'diffuseColor.rgb = mix(diffuseColor.rgb, wet, melt * (1.0 - 0.55 * slush));'
            ].join('\n'))
            .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.28, melt * (1.0 - slush));')
            .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nfloat ring = uPulseA * exp(-pow((rr - uPulseR) / 2.5, 2.0));\ntotalEmissiveRadiance += vec3(1.0, 0.42, 0.12) * ring;');
        };
        const terr = new THREE.Mesh(tg, ground); terr.receiveShadow = true; sc.add(terr);
        // the town
        const plan = (d.plan = frPlan());
        const plank = X.canvasTexture(256, 256, (x, w, h) => {
          x.fillStyle = '#3b3029'; x.fillRect(0, 0, w, h);
          for (let i = 0; i < w; i += 16) { x.fillStyle = `rgb(${rand(40, 70) | 0},${rand(32, 52) | 0},${rand(26, 40) | 0})`; x.fillRect(i, 0, 15, h); x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(i + 15, 0, 1, h); }
          for (let k = 0; k < 300; k++) { x.fillStyle = `rgba(0,0,0,${rand(0.05, 0.2)})`; x.fillRect(rand(0, w), rand(0, h), rand(1, 3), rand(6, 30)); }
          x.fillStyle = 'rgba(230,240,255,0.55)'; x.fillRect(0, h - 26, w, 26); // drifted snow at the foot of the walls
        });
        const bodyGeo = new THREE.BoxGeometry(1, 1, 1); bodyGeo.translate(0, 0.5, 0);
        const bodies = new THREE.InstancedMesh(bodyGeo, new THREE.MeshStandardMaterial({ map: plank, roughness: 0.9 }), plan.length);
        const shape = new THREE.Shape(); shape.moveTo(-0.5, 0); shape.lineTo(0, 1); shape.lineTo(0.5, 0); shape.lineTo(-0.5, 0);
        const roofGeo = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false }); roofGeo.translate(0, 0, -0.5);
        const roofs = new THREE.InstancedMesh(roofGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75 }), plan.length);
        const chimGeo = new THREE.CylinderGeometry(0.22, 0.26, 1.6, 10); chimGeo.translate(0, 0.8, 0);
        const chims = new THREE.InstancedMesh(chimGeo, new THREE.MeshStandardMaterial({ color: C(0x3a2a24), roughness: 0.85 }), plan.length);
        const winTex = X.canvasTexture(128, 64, (x, w, h) => {
          x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
          for (let k = 0; k < 3; k++) { const X0 = 10 + k * 40; const g = x.createLinearGradient(0, 14, 0, 50); g.addColorStop(0, '#ffcf8a'); g.addColorStop(1, '#ff8a3a'); x.fillStyle = g; x.fillRect(X0, 14, 26, 34); x.fillStyle = '#000'; x.fillRect(X0 + 12, 14, 2, 34); x.fillRect(X0, 29, 26, 2); }
        });
        const wins = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: winTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }), plan.length * 2);
        const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), Sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
        let ci = 0; d.chimPos = [];
        plan.forEach((b, i) => {
          const x = Math.cos(b.a) * b.r, z = Math.sin(b.a) * b.r, rot = -b.a + Math.PI / 2; // front faces the generator
          b.x = x; b.z = z;
          Q.setFromAxisAngle(up, rot);
          M.compose(V.set(x, 0, z), Q, Sc.set(b.w, b.h, b.d)); bodies.setMatrixAt(i, M);
          bodies.setColorAt(i, C(b.big ? 0x9a8a80 : 0xffffff).multiplyScalar(rand(0.75, 1.1)));
          const rh = b.big ? 0.6 : b.w * 0.42;
          M.compose(V.set(x, b.h, z), Q, Sc.set(b.w * 1.14, rh, b.d * 1.1)); roofs.setMatrixAt(i, M);
          if (b.chim) { const cx = x + Math.cos(b.a) * b.d * 0.2 + Math.cos(rot) * b.w * 0.25, cz = z + Math.sin(b.a) * b.d * 0.2 - Math.sin(rot) * b.w * 0.25; M.compose(V.set(cx, b.h + rh * 0.3, cz), Q, Sc.set(1, 1, 1)); chims.setMatrixAt(ci++, M); d.chimPos.push([cx, b.h + rh * 0.3 + 1.6, cz, b]); }
          // two window strips: the side facing the generator and one flank
          const fx = x - Math.cos(b.a) * (b.d / 2 + 0.02), fz = z - Math.sin(b.a) * (b.d / 2 + 0.02);
          Q.setFromAxisAngle(up, rot + Math.PI); M.compose(V.set(fx, b.h * 0.5, fz), Q, Sc.set(b.w * 0.8, Math.min(1.4, b.h * 0.4), 1)); wins.setMatrixAt(i * 2, M);
          const sx = x + Math.cos(rot) * (b.w / 2 + 0.02), sz = z - Math.sin(rot) * (b.w / 2 + 0.02);
          Q.setFromAxisAngle(up, rot + Math.PI / 2); M.compose(V.set(sx, b.h * 0.5, sz), Q, Sc.set(b.d * 0.75, Math.min(1.4, b.h * 0.4), 1)); wins.setMatrixAt(i * 2 + 1, M);
          roofs.setColorAt(i, C(0xe4ecf4)); wins.setColorAt(i * 2, new THREE.Color(0, 0, 0)); wins.setColorAt(i * 2 + 1, new THREE.Color(0, 0, 0));
        });
        chims.count = ci;
        [bodies, roofs, chims].forEach((m) => { m.castShadow = true; m.receiveShadow = true; sc.add(m); });
        sc.add(wins);
        d.bodies = bodies; d.roofs = roofs; d.wins = wins;
        // street lamps along the avenues
        const lamps = [];
        for (let k = 0; k < 8; k++) { const a = k * TAU / 8; for (let r = 9; r < 50; r += 6) lamps.push([Math.cos(a) * r + Math.cos(a + 1.57) * 1.7, Math.sin(a) * r + Math.sin(a + 1.57) * 1.7, r]); }
        const poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 3.2, 6); poleGeo.translate(0, 1.6, 0);
        const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshStandardMaterial({ color: C(0x1c1c1e), roughness: 0.6, metalness: 0.7 }), lamps.length);
        const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), lamps.length);
        lamps.forEach((l, i) => { M.makeTranslation(l[0], 0, l[1]); poles.setMatrixAt(i, M); M.makeTranslation(l[0], 3.25, l[1]); bulbs.setMatrixAt(i, M); bulbs.setColorAt(i, new THREE.Color(0.02, 0.02, 0.03)); });
        poles.castShadow = true; sc.add(poles); sc.add(bulbs); d.lamps = lamps; d.bulbs = bulbs;
        // the generator: plinth, octagonal riveted shaft, four buttresses, the furnace cage, the core, the stack
        const ironTex = pixTexture(X, 256, 256, (i, j) => { const n = fbm(X, i / 22, j / 22, 4, 4), v = 46 + 30 * n + ((i % 32 < 2 || j % 48 < 2) ? -18 : 0) + ((i % 32 === 4 && j % 8 === 0) ? 40 : 0); return [v * 1.05, v, v * 0.95]; }, true);
        ironTex.repeat.set(3, 3);
        const iron = new THREE.MeshStandardMaterial({ map: ironTex, color: C(0x8c8680), metalness: 0.75, roughness: 0.55, bumpMap: ironTex, bumpScale: 0.05 });
        const gen = new THREE.Group(); sc.add(gen);
        const add = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; gen.add(o); return o; };
        add(new THREE.CylinderGeometry(9, 10.5, 2.2, 8), iron, 0, 1.1, 0);
        add(new THREE.CylinderGeometry(7, 8, 1.2, 8), iron, 0, 2.8, 0);
        add(new THREE.LatheGeometry([[0, 0], [4.6, 0], [4.4, 4], [3.6, 10], [3.2, 14.5], [3.9, 15.3], [3.9, 16.2], [0, 16.2]].map((p) => new THREE.Vector2(p[0], p[1])), 8), iron, 0, 3.4, 0);
        for (let k = 0; k < 4; k++) { const a = k * TAU / 4 + TAU / 16, b = add(new THREE.BoxGeometry(1.1, 15, 1.6), iron, Math.cos(a) * 5.8, 9.5, Math.sin(a) * 5.8); b.rotation.y = -a; b.rotation.z = 0; b.rotation.x = 0; b.lookAt(0, 9.5, 0); b.rotateX(0.18); }
        const cage = new THREE.Group(); cage.position.y = FR_CORE; gen.add(cage);
        for (let k = 0; k < 3; k++) { const t = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.22, 10, 40), iron); t.rotation.x = Math.PI / 2; t.position.y = (k - 1) * 2.3; t.castShadow = true; cage.add(t); }
        const barGeo = new THREE.CylinderGeometry(0.12, 0.12, 5.4, 6), bars = new THREE.InstancedMesh(barGeo, iron, 16);
        for (let k = 0; k < 16; k++) { const a = k * TAU / 16; M.makeTranslation(Math.cos(a) * 3.6, 0, Math.sin(a) * 3.6); bars.setMatrixAt(k, M); }
        bars.castShadow = true; cage.add(bars);
        d.coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const core = new THREE.Mesh(new THREE.IcosahedronGeometry(2.7, 3), d.coreMat); cage.add(core); d.core = core;
        d.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture(X), color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); d.halo.scale.setScalar(26); cage.add(d.halo);
        add(new THREE.CylinderGeometry(1.6, 2.2, 11, 16), iron, 0, FR_CORE + 8.5, 0);
        add(new THREE.CylinderGeometry(2.0, 1.7, 0.8, 16), iron, 0, FR_CORE + 14.2, 0);
        // lights: cold moon with shadows, a dim sky fill, and the core itself as a real point light
        const moon = new THREE.DirectionalLight(C(0x8eaaff), 1.7); moon.position.set(-70, 85, -50);
        moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048); Object.assign(moon.shadow.camera, { left: -62, right: 62, top: 62, bottom: -62, near: 40, far: 260 }); moon.shadow.bias = -0.0006;
        sc.add(moon);
        sc.add(new THREE.HemisphereLight(C(0x3a5078), C(0x0a0b14), 0.6));
        d.heat = new THREE.PointLight(C(0xff9440), 4000, 0, 2); d.heat.position.set(0, FR_CORE, 0); sc.add(d.heat);
        const disc = new THREE.Mesh(new THREE.CircleGeometry(3.2, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.3, 2.6), fog: false })); disc.position.set(-190, 150, -230); disc.lookAt(0, 0, 0); sc.add(disc);
        // falling snow, entirely on the GPU: y = mod(y0 − t·v, H), drifting with a gusting wind
        const N = 7000, sg = new THREE.BufferGeometry(), sp = new Float32Array(N * 3), sr = new Float32Array(N);
        for (let i = 0; i < N; i++) { sp[i * 3] = rand(-110, 110); sp[i * 3 + 1] = rand(0, 70); sp[i * 3 + 2] = rand(-110, 110); sr[i] = Math.random(); }
        sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('aR', new THREE.BufferAttribute(sr, 1));
        d.snowU = { uT: { value: 0 }, uWind: { value: 0 }, uScale: { value: 600 }, uDens: { value: 1 }, map: { value: softTexture(X, true) } };
        const snow = new THREE.Points(sg, new THREE.ShaderMaterial({
          uniforms: d.snowU, transparent: true, depthWrite: false,
          vertexShader: 'attribute float aR; uniform float uT; uniform float uWind; uniform float uScale; uniform float uDens; varying float vA;' +
            'void main(){ vec3 p = position; float v = 2.2 + 2.5 * aR; p.y = mod(p.y - uT * v, 70.0);' +
            'p.x += uWind * (70.0 - p.y) * 0.25 + sin(uT * 0.7 + aR * 40.0) * 1.2; p.z += cos(uT * 0.6 + aR * 30.0) * 1.2;' +
            'p.x = mod(p.x + 110.0, 220.0) - 110.0; vec4 mv = modelViewMatrix * vec4(p, 1.0);' +
            'gl_PointSize = (0.09 + 0.08 * aR) * uScale / max(0.5, -mv.z); vA = step(aR, uDens) * clamp(1.0 - (-mv.z) / 140.0, 0.0, 1.0); gl_Position = projectionMatrix * mv; }',
          fragmentShader: 'uniform sampler2D map; varying float vA; void main(){ float a = texture2D(map, gl_PointCoord).a * vA * 0.9; if (a < 0.01) discard; gl_FragColor = vec4(vec3(0.85, 0.9, 1.0), a); }'
        }));
        snow.frustumCulled = false; sc.add(snow);
        d.smoke = particles(X, 700, {}); sc.add(d.smoke.pts);
        d.sparks = particles(X, 300, { additive: true }); sc.add(d.sparks.pts);
      },
      update(S, X, now, dt) {
        const d = S.data;
        if (!d.U) return;
        const T = now / 1000;
        d.U.warm.value = d.rMelt;
        const pt = (now - d.pulse) / 1000; d.U.pulseR.value = pt < 3 ? d.rMelt + pt * 22 : -10; d.U.pulseA.value = pt < 3 ? 1.6 * (1 - pt / 3) : 0;
        // melt/refreeze roofs, light windows and lamps inside the warm radius (only buildings whose state flipped)
        let ch = false;
        d.plan.forEach((b, i) => {
          const w = b.r < d.rMelt ? 1 : 0;
          if (w === b.warm) return;
          b.warm = w; ch = true;
          d.roofs.setColorAt(i, w ? C(0x2b2522) : C(0xe4ecf4));
          const lit = w ? (Math.random() < 0.85 ? rand(2.2, 3.4) : 0.05) : (Math.random() < 0.15 ? 0.4 : 0.0);
          const col = new X.THREE.Color(lit, lit * 0.62, lit * 0.32);
          d.wins.setColorAt(i * 2, col); d.wins.setColorAt(i * 2 + 1, col);
        });
        if (ch) { d.roofs.instanceColor.needsUpdate = true; d.wins.instanceColor.needsUpdate = true; }
        if (!d.lampK || Math.abs(d.lampK - d.rMelt) > 0.5) { d.lampK = d.rMelt; d.lamps.forEach((l, i) => d.bulbs.setColorAt(i, l[2] < d.rMelt ? new X.THREE.Color(6, 3.2, 1) : new X.THREE.Color(0.02, 0.02, 0.03))); d.bulbs.instanceColor.needsUpdate = true; }
        // the core: blackbody colour, brightness ∝ T⁴, and a real light whose power follows P
        const bc = bbColor(d.Tc), gl = 2.2 + 6 * Math.pow(d.Tc / 1000, 4) * (0.94 + 0.06 * Math.sin(now * 0.013));
        d.coreMat.color.setRGB(bc[0] * gl, bc[1] * gl, bc[2] * gl);
        d.heat.color.setRGB(bc[0], bc[1] * 1.1, bc[2] * 1.4 + 0.05);
        const hg = 0.12 + 0.35 * Math.pow(d.Tc / 1000, 4); d.halo.material.color.setRGB(bc[0] * hg, bc[1] * hg, bc[2] * hg); d.halo.scale.setScalar(18 + 10 * (d.Tc - 900) / 600);
        d.heat.intensity = 1100 * d.P / 1.34e6;
        const j = S.holding && S.stage >= 3 && !S.reduceMotion ? 0.06 : 0;
        d.core.position.set(rand(-j, j), rand(-j, j), rand(-j, j)); d.core.rotation.y += dt * 0.0004;
        // smoke from the stack and from warm chimneys; sparks when overdriven; steam on the emergency vent
        const k = dt / 16.7, wind = 2.5 + 1.5 * Math.sin(now / 4000) + clamp(pvel(S).x, -30, 30) * 0.08;
        if (Math.random() < 0.5 * k) d.smoke.emit({ x: rand(-0.8, 0.8), y: FR_CORE + 14.8, z: rand(-0.8, 0.8), vx: rand(-0.4, 0.4), vy: rand(3, 4.5), vz: rand(-0.4, 0.4), life: rand(6, 9), s0: 2, s1: rand(10, 16), a: 0.55, c: [0.05, 0.05, 0.055], wx: wind * 0.35, drag: 0.99 });
        for (let q = 0; q < 2; q++) { const c = pick(d.chimPos); if (c && c[3].warm && Math.random() < 0.35 * k) d.smoke.emit({ x: c[0], y: c[1], z: c[2], vx: 0, vy: rand(0.8, 1.4), life: rand(4, 6), s0: 0.4, s1: rand(2.5, 4), a: 0.35, c: [0.16, 0.16, 0.17], wx: wind * 0.25 }); }
        if (S.holding && S.stage >= 2) for (let q = 0; q < S.stage; q++) { const a = rand(0, TAU); d.sparks.emit({ x: Math.cos(a) * 3.4, y: FR_CORE + rand(-2, 2), z: Math.sin(a) * 3.4, vx: Math.cos(a) * rand(2, 6), vy: rand(1, 6), vz: Math.sin(a) * rand(2, 6), g: -6, life: rand(0.8, 1.6), s0: 0.25, s1: 0.1, a: 1, c: [4, 1.6, 0.4], drag: 0.99 }); }
        if (d.vent && now - d.pulse < 1800) for (let q = 0; q < 4; q++) d.smoke.emit({ x: rand(-1, 1), y: FR_CORE + 15, z: rand(-1, 1), vx: rand(-2, 2), vy: rand(10, 16), vz: rand(-2, 2), life: rand(2.5, 4), s0: 2, s1: rand(14, 22), a: 0.5, c: [0.75, 0.78, 0.82], wx: wind * 0.4, drag: 0.97 });
        d.smoke.step(dt, X.camera); d.sparks.step(dt, X.camera);
        d.snowU.uT.value = T; d.snowU.uWind.value += ((wind * 0.08) - d.snowU.uWind.value) * ease(dt, 1500);
        d.snowU.uDens.value = 0.35 + 0.65 * smooth(-20, -70, d.Tout);
        d.snowU.uScale.value = X.renderer.domElement.height / (2 * Math.tan(X.camera.fov * Math.PI / 360));
        camRig(S, X, { look: [0, FR_CORE, 0], r: 82, el: 0.24, spin: 0.000018, sway: 0.03, speed: 0.00007, par: 0.35, parY: 0.12 }, now, dt);
      }
    },
    drawNode(S, ctx, n, g, size, a) {
      const d = S.data, dist = Math.hypot(n.sx - S.cx, n.sy - S.cy), wr = S.R * (d.rWarm || 13) / 22;
      const w = smooth(wr * 1.2, wr * 0.6, dist);
      if (w > 0.05) { ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, '255,140,40', n.sx, n.sy, size, w * 0.22 * a); ctx.globalCompositeOperation = 'source-over'; }
      ctx.font = `${size.toFixed(1)}px monospace`;
      ctx.fillStyle = n.inf ? S.colorOf(n.gen, a) : `hsla(${lerp(205, 32, w).toFixed(0)},${lerp(40, 100, w).toFixed(0)}%,${lerp(88, 66, w).toFixed(0)}%,${a * 0.9})`;
      ctx.fillText(g, n.sx, n.sy);
      return true;
    },
    over(S, ctx, now) {
      const d = S.data;
      if (d.Tcity === undefined) return;
      const x = S.W - 26, y0 = S.H * 0.26, hh = S.H * 0.3, r = d.risk; // a thin instrument strip: stack stress and temperatures
      ctx.fillStyle = 'rgba(5,8,12,0.55)'; ctx.fillRect(x - 3, y0, 6, hh);
      ctx.fillStyle = r > 0.8 ? 'rgba(255,70,40,0.9)' : `hsl(${lerp(40, 4, r)},90%,55%)`; ctx.fillRect(x - 2, y0 + hh * (1 - r), 4, hh * r);
      ctx.font = '10px monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(210,225,245,0.7)'; ctx.fillText(`${d.Tout.toFixed(0)} °C outside`, x - 10, y0 + 4);
      ctx.fillStyle = 'rgba(255,196,140,0.75)'; ctx.fillText(`core ${d.Tc.toFixed(0)} K`, x - 10, y0 + 18);
      ctx.fillStyle = 'rgba(210,225,245,0.55)'; ctx.fillText(`stack stress ${(r * 100).toFixed(0)}%`, x - 10, y0 + hh - 4);
    },
    onRelease(S, held, pw) {
      const d = S.data;
      d.pulse = S.now; d.vent = d.risk > 0.45; d.rMelt = Math.max(d.rMelt, d.rWarm * 1.15);
      d.risk *= 0.3; kick(S, 0.25 * pw);
      return false;
    },
    hud(S) {
      const d = S.data;
      if (d.P === undefined) return '';
      const MW = (d.P / 1e6).toFixed(1), r = d.rWarm.toFixed(0);
      if (S.holding) return [`overdrive · core ${d.Tc.toFixed(0)} K · P ∝ T⁴, so +10% temperature gives +46% heat`,
        `${MW} MW · warm radius ${r} m · streets ${d.Tcity.toFixed(0)} °C · dT/dt = −k(T − Tₐ) + P/C`,
        `core ${d.Tc.toFixed(0)} K · stack stress ${(d.risk * 100).toFixed(0)}% · the snow line retreats to ${d.rMelt.toFixed(0)} m`,
        `${MW} MW · stack stress ${(d.risk * 100).toFixed(0)}% · the city is warm, the boiler is not happy`][S.stage];
      if (S.now - d.pulse < 4000) return d.vent ? 'emergency vent · a heat front rolls across the rooftops' : `heat front · snow line at ${d.rMelt.toFixed(0)} m`;
      return `out ${d.Tout.toFixed(0)} °C · streets ${d.Tcity.toFixed(0)} °C · core ${d.Tc.toFixed(0)} K · εσA(T⁴−Tₐ⁴) = ${MW} MW · warm radius ${r} m`;
    }
  });

  /* ======================= 3. WHALEPUNK ======================= */
  // Spectrogram rows are log-spaced from 8 Hz to 4 kHz. Blue-whale-like calls are tonal 10–40 Hz downsweeps with harmonics,
  // humpback-like song is built from short units (upsweeps, downsweeps, moans) from ~100 Hz up to several kHz.
  const WH_FMIN = 8, WH_FMAX = 4000, WH_ROWS = 72, WH_COLS = 220, WH_DT = 0.25; // s of sea time per column
  const MAGMA = [[0, 0, 4], [40, 11, 84], [101, 21, 110], [159, 42, 99], [212, 72, 66], [245, 125, 21], [250, 193, 39], [252, 253, 191]];
  const WH_LUT = Array.from({ length: 64 }, (_, i) => { const t = i / 63 * 7, k = Math.min(6, Math.floor(t)), f = t - k, a = MAGMA[k], b = MAGMA[k + 1]; return `rgb(${Math.round(lerp(a[0], b[0], f))},${Math.round(lerp(a[1], b[1], f))},${Math.round(lerp(a[2], b[2], f))})`; });
  const whRow = (f) => WH_ROWS * Math.log(f / WH_FMIN) / Math.log(WH_FMAX / WH_FMIN);
  // Munk's canonical sound-speed profile: c(z) = c1·[1 + ε(η + e^−η − 1)], η = 2(z − z1)/B, with z1 = B = 1300 m, ε = 0.00737.
  const MUNK = { c1: 1500, z1: 1300, B: 1300, eps: 0.00737 };
  const munkC = (z) => { const e = 2 * (z - MUNK.z1) / MUNK.B; return MUNK.c1 * (1 + MUNK.eps * (e + Math.exp(-e) - 1)); };
  const munkDC = (z) => { const e = 2 * (z - MUNK.z1) / MUNK.B; return MUNK.c1 * MUNK.eps * (2 / MUNK.B) * (1 - Math.exp(-e)); };
  function sofarRays() { // ray equations: dr/ds = cosθ, dz/ds = sinθ, dθ/ds = −(1/c)(dc/dz)cosθ (z down)
    const rays = [];
    for (let deg = -12; deg <= 12; deg += 3) {
      let r = 0, z = MUNK.z1, th = deg * Math.PI / 180; const pts = [[0, z]];
      for (let i = 0; i < 1100 && r < 200000; i++) {
        const ds = 200; th += -(munkDC(z) / munkC(z)) * Math.cos(th) * ds; r += Math.cos(th) * ds; z += Math.sin(th) * ds;
        if (z < 0) { z = -z; th = -th; } if (z > 5000) { z = 10000 - z; th = -th; }
        if (i % 3 === 0) pts.push([r, z]);
      }
      rays.push({ deg, pts });
    }
    return rays;
  }
  function whColumn(S) {
    const d = S.data, x = d.sx, t = d.songK;
    d.songK += WH_DT;
    x.drawImage(d.spec, -1, 0);
    const col = new Float32Array(WH_ROWS);
    for (let j = 0; j < WH_ROWS; j++) col[j] = 0.06 + 0.12 * Math.random() * (1 - j / WH_ROWS) + 0.08 * Math.max(0, 1 - j / 10); // ocean noise, reddish
    d.calls = d.calls.filter((c) => t - c.t0 < c.dur);
    for (const c of d.calls) {
      const u = (t - c.t0) / c.dur, env = Math.sin(Math.PI * clamp(u, 0, 1));
      if (c.type === 'slap') { for (let j = 0; j < WH_ROWS; j++) col[j] += c.amp * Math.exp(-u * 4) * (0.7 + 0.3 * Math.random()); continue; }
      let f = c.f0 * Math.pow(c.f1 / c.f0, u);
      if (c.type === 'whoop') f = c.f0 * Math.pow(c.f1 / c.f0, Math.sin(u * Math.PI));
      const H = c.type === 'blue' ? [0.55, 0.45, 0.9, 0.35] : [1, 0.45, 0.2];
      H.forEach((a, h) => {
        const row = whRow(f * (h + 1));
        if (row < -2 || row > WH_ROWS + 2) return;
        for (let j = Math.max(0, Math.floor(row - 3)); j <= Math.min(WH_ROWS - 1, Math.ceil(row + 3)); j++) col[j] += c.amp * a * env * Math.exp(-((j - row) ** 2) / 1.6);
      });
    }
    for (let j = 0; j < WH_ROWS; j++) { x.fillStyle = WH_LUT[clamp(Math.floor(col[j] * 50), 0, 63)]; x.fillRect(WH_COLS - 1, WH_ROWS - 1 - j, 1, 1); }
  }
  function whPanels(S, ctx, now) {
    const d = S.data;
    // spectrogram strip, bottom right
    const pw = Math.min(440, S.W * 0.36), ph = Math.min(130, S.H * 0.17), px = S.W - pw - 16, py = S.H - ph - 48;
    panel(ctx, px - 30, py - 18, pw + 38, ph + 26, 0.72, 'rgba(180,170,220,0.25)');
    ctx.imageSmoothingEnabled = true; ctx.drawImage(d.spec, px, py, pw, ph);
    ctx.font = '9px monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(220,215,240,0.7)';
    [[10, '10'], [100, '100'], [1000, '1k'], [4000, '4k']].forEach(([f, l]) => ctx.fillText(l, px - 4, py + ph - whRow(f) / WH_ROWS * ph));
    const h20 = py + ph - whRow(20) / WH_ROWS * ph; ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.setLineDash([3, 3]); S.line(px, h20, px + pw, h20); ctx.setLineDash([]);
    ctx.textAlign = 'left'; ctx.fillText('WHALE SONG · Hz (log) · ×6 · dashed: 20 Hz, edge of human hearing', px - 26, py - 9);
    // SOFAR inset, top right: c(z) and rays from a source on the axis
    const sw = Math.min(220, S.W * 0.2), sh = Math.min(150, S.H * 0.2), sx = S.W - sw - 16, sy = 96;
    const rl = layer(S, 'sofar', sw, sh, (x, w, h) => {
      panel(x, 0, 0, w, h, 0.62, 'rgba(180,170,220,0.25)');
      const cw = 36, Z = (z) => 14 + (h - 20) * z / 5000, Rr = (r) => cw + 8 + (w - cw - 14) * r / 200000;
      x.strokeStyle = 'rgba(140,200,255,0.9)'; x.lineWidth = 1.2; x.beginPath();
      for (let z = 0; z <= 5000; z += 100) { const X = 6 + (munkC(z) - 1490) / 70 * (cw - 6); if (z) x.lineTo(X, Z(z)); else x.moveTo(X, Z(z)); }
      x.stroke();
      x.setLineDash([2, 3]); x.strokeStyle = 'rgba(255,220,150,0.5)'; x.beginPath(); x.moveTo(4, Z(1300)); x.lineTo(w - 4, Z(1300)); x.stroke(); x.setLineDash([]);
      d.rays.forEach((ray) => { x.strokeStyle = `rgba(255,${Math.round(150 + Math.abs(ray.deg) * 8)},120,0.35)`; x.lineWidth = 0.8; x.beginPath(); ray.pts.forEach((p, i) => (i ? x.lineTo(Rr(p[0]), Z(p[1])) : x.moveTo(Rr(p[0]), Z(p[1])))); x.stroke(); });
      x.font = '9px monospace'; x.fillStyle = 'rgba(220,215,240,0.75)'; x.textAlign = 'left'; x.textBaseline = 'top';
      x.fillText('SOFAR · c(z)', 4, 2); x.textAlign = 'right'; x.fillText('200 km →', w - 4, h - 11); x.fillText('axis 1300 m', w - 4, Z(1300) + 2);
    });
    blit(ctx, rl, sx, sy);
    const cw = 36, u = (now * 0.00006) % 1; ctx.fillStyle = 'rgba(255,240,200,0.9)'; // a pulse travelling along every ray
    d.rays.forEach((ray) => { const p = ray.pts[Math.floor(u * (ray.pts.length - 1))]; ctx.fillRect(sx + cw + 8 + (sw - cw - 14) * p[0] / 200000 - 1, sy + 14 + (sh - 20) * p[1] / 5000 - 1, 2, 2); });
  }
  // A procedural rorqual: a lathed body (radius profile along its length), flukes and pectoral fins as bevelled extrusions,
  // a painted skin with a pale pleated throat, brass harness rings and a hanging oil lantern. The body undulates up and down.
  function whaleSkin(X, hump) {
    return X.canvasTexture(512, 256, (x, w, h) => {
      x.fillStyle = hump ? '#1c212e' : '#33405a'; x.fillRect(0, 0, w, h);
      for (let k = 0; k < (hump ? 200 : 700); k++) { x.fillStyle = `rgba(${hump ? '200,205,215' : '160,175,205'},${rand(0.04, 0.16)})`; x.beginPath(); x.ellipse(rand(0, w), rand(0, h), rand(2, 9), rand(1, 5), rand(0, 3), 0, TAU); x.fill(); }
      const bx = w * 0.25, bw = w * 0.16; // the belly is around u = 0.25 after the body is turned on its side
      const g = x.createLinearGradient(bx - bw, 0, bx + bw, 0);
      g.addColorStop(0, 'rgba(200,208,225,0)'); g.addColorStop(0.3, 'rgba(200,208,225,0.85)'); g.addColorStop(0.7, 'rgba(200,208,225,0.85)'); g.addColorStop(1, 'rgba(200,208,225,0)');
      x.fillStyle = g; x.fillRect(bx - bw, 0, bw * 2, h * 0.55);
      x.strokeStyle = 'rgba(40,45,60,0.55)'; x.lineWidth = 1.2; // throat pleats run from the chin to the navel
      for (let k = -9; k <= 9; k++) { x.beginPath(); x.moveTo(bx + k * bw * 0.08, 2); x.lineTo(bx + k * bw * 0.075, h * 0.5); x.stroke(); }
    });
  }
  function whaleBuild(X, L, hump, sc) {
    const THREE = X.THREE, prof = [];
    const rad = (s) => 0.105 * Math.pow(Math.sin(Math.PI * Math.min(1, s * 0.93 + 0.07)), 0.7) * (1 - 0.82 * Math.pow(s, 1.35)) + 0.005;
    prof.push(new THREE.Vector2(0, -0.5 * L));
    for (let i = 40; i >= 0; i--) { const s = i / 40; prof.push(new THREE.Vector2(rad(s) * L, (0.5 - s) * L)); }
    prof.push(new THREE.Vector2(0, 0.5 * L + 0.012 * L));
    const geo = new THREE.LatheGeometry(prof, 28); geo.rotateZ(-Math.PI / 2); geo.scale(1, 1.05, 0.86);
    const base = geo.attributes.position.array.slice();
    const skin = new THREE.MeshStandardMaterial({ map: whaleSkin(X, hump), roughness: 0.55, metalness: 0.05 });
    const g = new THREE.Group(), body = new THREE.Mesh(geo, skin); body.castShadow = true; g.add(body);
    const dark = new THREE.MeshStandardMaterial({ color: C(hump ? 0x1c212e : 0x2e3a52), roughness: 0.6 });
    const pale = new THREE.MeshStandardMaterial({ color: C(hump ? 0xc9ced8 : 0x3a4762), roughness: 0.6 });
    const ext = (pts, th) => { const s = new THREE.Shape(); pts.forEach((p, i) => (i ? s.lineTo(p[0] * L, p[1] * L) : s.moveTo(p[0] * L, p[1] * L))); const e = new THREE.ExtrudeGeometry(s, { depth: th * L, bevelEnabled: true, bevelThickness: th * L * 0.4, bevelSize: th * L * 0.5, bevelSegments: 2, curveSegments: 6 }); e.translate(0, 0, -th * L / 2); return e; };
    const fl = ext([[0.03, 0], [-0.03, 0.06], [-0.08, 0.15], [-0.12, 0.2], [-0.1, 0.12], [-0.085, 0.04], [-0.095, 0], [-0.085, -0.04], [-0.1, -0.12], [-0.12, -0.2], [-0.08, -0.15], [-0.03, -0.06]], 0.008);
    fl.rotateX(Math.PI / 2);
    const fluke = new THREE.Mesh(fl, dark); fluke.castShadow = true; g.add(fluke);
    const finLen = hump ? 0.3 : 0.13, fin = ext([[0, 0.02], [-finLen * 0.35, 0.03], [-finLen, 0.006], [-finLen * 0.9, -0.01], [-finLen * 0.3, -0.018], [0, -0.02]], 0.01);
    const fins = [1, -1].map((side) => { const f = new THREE.Mesh(fin, hump ? pale : dark); f.position.set(0.22 * L, -0.06 * L, side * 0.075 * L); f.castShadow = true; g.add(f); return f; });
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.006 * L, 10, 8), new THREE.MeshStandardMaterial({ color: 0x050608, roughness: 0.2 }));
    [1, -1].forEach((s) => { const e = eye.clone(); e.position.set(0.41 * L, -0.01 * L, s * 0.06 * L); g.add(e); });
    const brass = new THREE.MeshStandardMaterial({ color: C(0xc9a060), metalness: 1, roughness: 0.35 });
    [0.38, 0.5].forEach((s) => { const r = rad(s) * L; const t = new THREE.Mesh(new THREE.TorusGeometry(r * 1.04, 0.006 * L, 8, 40), brass); t.scale.set(1, 1.05, 0.86); t.rotation.y = Math.PI / 2; t.position.x = (0.5 - s) * L; t.castShadow = true; g.add(t); });
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.008 * L, 0.01 * L, 0.025 * L, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 3.2, 1.1) }));
    lantern.position.set(0.06 * L, -0.15 * L, 0); g.add(lantern);
    const glowS = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture(X), color: new THREE.Color(2.4, 1.3, 0.5), blending: THREE.AdditiveBlending, depthWrite: false }));
    glowS.scale.setScalar(0.18 * L); glowS.position.copy(lantern.position); g.add(glowS);
    const lamp = new THREE.PointLight(C(0xffa860), 6 * L, 0, 2); lamp.position.copy(lantern.position); g.add(lamp);
    sc.add(g);
    return { g, geo, base, fluke, fins, L, hump, rad, lamp, glowS, ph: rand(0, TAU) };
  }
  function whaleFlex(w, t, amp) { // vertical undulation, strongest at the tail: y += A·s²·sin(ωt − k·s)
    const p = w.geo.attributes.position.array, b = w.base, L = w.L;
    for (let i = 0; i < p.length; i += 3) { const s = 0.5 - b[i] / L; p[i + 1] = b[i + 1] + amp * L * s * s * Math.sin(t - s * 3.4); }
    w.geo.attributes.position.needsUpdate = true;
    const tail = amp * L * Math.sin(t - 3.4), slope = amp * (2 * Math.sin(t - 3.4) - 3.4 * Math.cos(t - 3.4));
    w.fluke.position.set(-0.5 * L, tail, 0); w.fluke.rotation.z = -slope * 1.2;
    w.fins.forEach((f, i) => { f.rotation.z = -0.5 + 0.2 * Math.sin(t * 0.5 + i); f.rotation.x = (i ? -1 : 1) * (0.35 + 0.12 * Math.sin(t * 0.5)); });
  }
  function airshipBuild(X, s, sc) {
    const THREE = X.THREE, g = new THREE.Group(), prof = [];
    for (let i = 0; i <= 24; i++) { const a = -Math.PI / 2 + Math.PI * i / 24; prof.push(new THREE.Vector2(Math.cos(a) * 3.2 * s * (i > 12 ? 1 : 0.92), Math.sin(a) * 8.5 * s)); }
    const hullGeo = new THREE.LatheGeometry(prof, 24); hullGeo.rotateZ(-Math.PI / 2);
    const fab = X.canvasTexture(256, 64, (x, w, h) => { for (let i = 0; i < 24; i++) { x.fillStyle = i % 2 ? '#b89a76' : '#a88a66'; x.fillRect(0, i * h / 24, w, h / 24 + 1); } x.fillStyle = 'rgba(60,40,25,0.4)'; for (let i = 0; i < w; i += 16) x.fillRect(i, 0, 1, h); });
    const hull = new THREE.Mesh(hullGeo, new THREE.MeshStandardMaterial({ map: fab, roughness: 0.85 })); hull.castShadow = true; g.add(hull);
    const wood = new THREE.MeshStandardMaterial({ color: C(0x4a3020), roughness: 0.8 }), brass = new THREE.MeshStandardMaterial({ color: C(0xc9a060), metalness: 1, roughness: 0.35 });
    const gon = new THREE.Mesh(new THREE.BoxGeometry(4.4 * s, 1.2 * s, 1.5 * s), wood); gon.position.y = -4.6 * s; gon.castShadow = true; g.add(gon);
    [-1, 1].forEach((k) => { const r = new THREE.Mesh(new THREE.TorusGeometry(3.05 * s, 0.08 * s, 6, 32), brass); r.rotation.y = Math.PI / 2; r.position.x = k * 3 * s; g.add(r); });
    const rig = new THREE.BufferGeometry().setFromPoints([[-2, -1], [2, -1], [-1, 1], [1, 1]].flatMap((q) => [new THREE.Vector3(q[0] * s * 1.6, -2.6 * s, q[1] * 0.6 * s), new THREE.Vector3(q[0] * s * 1.0, -4.0 * s, q[1] * 0.6 * s)]));
    g.add(new THREE.LineSegments(rig, new THREE.LineBasicMaterial({ color: C(0x3a2a1a) })));
    const fin = new THREE.Mesh(new THREE.BoxGeometry(2 * s, 2.6 * s, 0.1 * s), wood); fin.position.x = -7.4 * s; g.add(fin);
    const prop = new THREE.Mesh(new THREE.BoxGeometry(0.1 * s, 2.4 * s, 0.25 * s), wood); prop.position.set(-2.6 * s, -4.6 * s, 0); g.add(prop);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22 * s, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(7, 3.6, 1.2) })); lamp.position.set(2.4 * s, -5.4 * s, 0); g.add(lamp);
    const glowS = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture(X), color: new THREE.Color(2.5, 1.3, 0.5), blending: THREE.AdditiveBlending, depthWrite: false })); glowS.scale.setScalar(3.2 * s); glowS.position.copy(lamp.position); g.add(glowS);
    const pl = new THREE.PointLight(C(0xffa860), 120 * s, 0, 2); pl.position.copy(lamp.position); g.add(pl);
    sc.add(g);
    return { g, prop, glowS };
  }
  function whCall(S, w) {
    const d = S.data;
    if (w.kind === 'blue') d.calls.push({ t0: d.songK, dur: 10, type: 'blue', f0: rand(16.5, 18), f1: rand(14.5, 15.5), amp: 1 });
    else {
      const unit = pick(['up', 'down', 'moan', 'whoop']), f0 = unit === 'moan' ? rand(120, 220) : rand(250, 900);
      d.calls.push({ t0: d.songK, dur: rand(1, 3), type: unit, f0, f1: unit === 'up' || unit === 'whoop' ? f0 * rand(1.8, 3.2) : unit === 'down' ? f0 * rand(0.35, 0.6) : f0 * 1.05, amp: 0.8 });
    }
    w.sing = S.now;
  }
  const WH_LOOK = [0, 17, -70];
  addMode({
    id: 'pk_whale', name: 'WHALEPUNK', glyphs: G('≈∿~◦°∘⊹✦◌ʘ⌇', '~°o*'),
    base: [210, 40, 90], palette: [[200, 80, 72], [38, 90, 66], [265, 60, 76], [175, 70, 64]],
    links: ['rope', 'beads', 'wave', 'arc'], count: 64, noHueShift: true, pageBg: ['#141433', '#04060f'],
    shapes: ['sphere', 'seashell', 'helicoid', 'torus', 'breather', 'galaxy', 'dini', 'catenoid'],
    init(S) {
      const d = S.data;
      Object.assign(d, { calls: [], colT: 0, breach: null, songK: 0 });
      d.pods = [{ kind: 'blue', next: 0, sing: -1e9 }, { kind: 'hump', next: 0, sing: -1e9 }, { kind: 'hump', next: 0, sing: -1e9 }];
      d.spec = mk(WH_COLS, WH_ROWS); d.sx = d.spec.getContext('2d'); d.sx.fillStyle = '#000004'; d.sx.fillRect(0, 0, WH_COLS, WH_ROWS);
      d.rays = sofarRays();
    },
    update(S, now, dt) {
      const d = S.data;
      d.pods.forEach((w) => {
        if (now > w.next) {
          w.next = now + (w.kind === 'blue' ? rand(9000, 14000) / (1 + S.stage) : rand(1500, 4000) / (1 + S.stage * 0.8));
          if (w.kind === 'blue' || Math.random() < (S.holding ? 0.35 + S.stage * 0.25 : 0.12) * 3) whCall(S, w);
        }
      });
      d.colT += dt; // spectrogram: one column per 40 ms of screen time = 0.25 s of sea time (×6.25)
      while (d.colT > 40) { d.colT -= 40; whColumn(S); }
    },
    three: {
      init(S, X) {
        const THREE = X.THREE, sc = X.scene, d = S.data;
        X.setBloom(0.7, 0.6, 0.85); X.setExposure(0.2);
        const sky = new THREE.Sky(); sky.scale.setScalar(9000); sc.add(sky);
        const su = sky.material.uniforms; su.turbidity.value = 3.5; su.rayleigh.value = 1.4; su.mieCoefficient.value = 0.004; su.mieDirectionalG.value = 0.86;
        const sun = new THREE.Vector3().setFromSphericalCoords(1, Math.PI / 2 - 0.03, Math.PI * 0.86); su.sunPosition.value.copy(sun); // the sun sits on the horizon
        d.sunDir = sun;
        sc.fog = new THREE.Fog(C(0x2a2238), 200, 1200);
        const key = new THREE.DirectionalLight(C(0xffb486), 7); key.position.copy(sun).multiplyScalar(300); sc.add(key);
        sc.add(new THREE.HemisphereLight(C(0x8c9ccc), C(0x6a5070), 2.6));
        const fill = new THREE.DirectionalLight(C(0x9ab4e8), 2.4); fill.position.set(-40, 60, 160); sc.add(fill); // cool skylight on the faces we see
        // the cloud sea: thousands of soft puffs, lit pink on top and violet underneath, drifting slowly
        d.cloud = particles(X, 2600, { order: 2 }); sc.add(d.cloud.pts);
        const tmp = [];
        for (let i = 0; i < 2600; i++) {
          const x = rand(-480, 480), z = rand(-700, 90), n = fbm(X, x * 0.008, z * 0.008, 0.3, 3), y = (n * 10 + rand(-1.5, 1.5) - (z > 40 ? 4 : 0)) * 1.6 - 4;
          const lit = clamp(0.5 + n * 1.4 + rand(-0.1, 0.1), 0, 1), far = smooth(-100, -650, z);
          const c = [lerp(0.30, 1.0, lit), lerp(0.24, 0.62, lit), lerp(0.42, 0.58, lit)].map((v, k) => lerp(v, [0.62, 0.5, 0.62][k], far * 0.6));
          tmp.push({ x, y, z, life: 0, s0: rand(10, 28) * (1 + far * 0.6), a: lerp(0.38, 0.64, lit), c, drag: 1 });
        }
        tmp.sort((a, b) => a.z - b.z).forEach((p) => d.cloud.emit(p));
        // three whales and two oil-lamp airships
        d.whales = [whaleBuild(X, 64, false, sc), whaleBuild(X, 24, true, sc), whaleBuild(X, 18, true, sc)];
        d.whales.forEach((w, i) => { w.pod = d.pods[i]; w.orb = [{ r: 150, y: 22, c: [-20, -260], sp: 0.012 }, { r: 52, y: 14, c: [10, -90], sp: -0.03 }, { r: 70, y: 26, c: [-30, -120], sp: 0.025 }][i]; w.a = i * 2; });
        d.ships = [airshipBuild(X, 1, sc), airshipBuild(X, 0.7, sc)];
        d.ships.forEach((a, i) => { a.x = i ? 60 : -40; a.y = i ? 34 : 40; a.z = i ? -150 : -60; a.v = i ? -1.2 : 1.6; });
        d.breachW = whaleBuild(X, 34, true, sc); d.breachW.g.visible = false;
        d.spray = particles(X, 500, { order: 6 }); sc.add(d.spray.pts);
      },
      update(S, X, now, dt) {
        const d = S.data;
        if (!d.whales) return;
        const T = now / 1000, s = dt / 1000;
        d.cloud.list.forEach((p) => { p.x += 1.6 * s; if (p.x > 480) p.x -= 960; });
        d.cloud.step(dt, X.camera);
        d.whales.forEach((w, i) => {
          const o = w.orb, hold = S.holding;
          w.a += o.sp * s * (hold ? 2.2 : 1);
          const r = hold ? 40 + i * 22 : o.r, cx = hold ? WH_LOOK[0] : o.c[0], cz = hold ? WH_LOOK[2] - 20 : o.c[1];
          const tx = cx + Math.cos(w.a) * r, tz = cz + Math.sin(w.a) * r, ty = (hold ? WH_LOOK[1] - 4 + i * 4 : o.y) + Math.sin(T * 0.3 + i) * 3;
          if (w.px === undefined) { w.px = tx; w.py = ty; w.pz = tz; }
          const k = ease(dt, hold ? 1400 : 3000);
          const nx = w.px + (tx - w.px) * k, ny = w.py + (ty - w.py) * k, nz = w.pz + (tz - w.pz) * k;
          const vx = nx - w.px, vz = nz - w.pz, vy = ny - w.py;
          if (Math.hypot(vx, vz) > 1e-4) { const yaw = Math.atan2(-vz, vx); w.yaw = w.yaw === undefined ? yaw : w.yaw + wrapA(yaw - w.yaw) * ease(dt, 600); }
          w.px = nx; w.py = ny; w.pz = nz;
          w.g.position.set(nx, ny, nz); w.g.rotation.set(0, w.yaw || 0, clamp(vy / Math.max(0.01, Math.hypot(vx, vz)), -0.3, 0.3) * 0.5);
          const sing = now - w.pod.sing < 2500 ? 1 - (now - w.pod.sing) / 2500 : 0; // lanterns swell while it sings
          w.lamp.intensity = w.L * (6 + 14 * sing); w.glowS.material.color.setRGB(2.4 + 3 * sing, 1.3 + 1.5 * sing, 0.5 + 0.5 * sing);
          whaleFlex(w, T * (i ? 1.1 : 0.6) + w.ph, i ? 0.06 : 0.04);
        });
        d.ships.forEach((a) => { a.x += a.v * s; if (a.x > 260) a.x = -260; if (a.x < -260) a.x = 260; a.g.position.set(a.x, a.y + Math.sin(T * 0.5 + a.z) * 0.8, a.z); a.g.rotation.y = a.v > 0 ? 0 : Math.PI; a.prop.rotation.x += 0.4; a.glowS.material.color.setRGB(2.5 + 0.3 * Math.sin(T * 9 + a.z), 1.3, 0.5); });
        const b = d.breach; // the breach: a ballistic arc out of the cloud deck and back in
        if (b) {
          const u = (now - b.t) / 3400, W = d.breachW;
          if (u > 1) { d.breach = null; W.g.visible = false; } else {
            W.g.visible = true;
            const x = b.x0 + 34 * u, y = -16 + 52 * 4 * u * (1 - u), vy = 52 * 4 * (1 - 2 * u), vx = 34;
            W.g.position.set(x, y, b.z); W.g.rotation.set(0, 0, Math.atan2(vy, vx * 3) * 0.9);
            whaleFlex(W, T * 2, 0.05);
            const spray = (sx) => { for (let k = 0; k < 90; k++) d.spray.emit({ x: sx + rand(-8, 8), y: rand(0, 4), z: b.z + rand(-6, 6), vx: rand(-6, 6), vy: rand(6, 22) * b.pw, vz: rand(-6, 6), g: -14, life: rand(1.6, 3), s0: rand(3, 6), s1: rand(10, 20), a: 0.7, c: [1, 0.78, 0.82], drag: 0.985 }); };
            if (!b.d0 && u > 0.12) { b.d0 = true; spray(x); }
            if (!b.d1 && u > 0.88) { b.d1 = true; spray(x); kick(S, 0.4 * b.pw); }
          }
        }
        d.spray.step(dt, X.camera);
        camRig(S, X, { look: WH_LOOK, r: 104, el: -0.02, sway: 0.08, speed: 0.00006, par: 0.3, parY: 0.1, bob: 0.02 }, now, dt);
      }
    },
    drawNode(S, ctx, n, g, size, a) {
      ctx.font = `${size.toFixed(1)}px monospace`; ctx.fillStyle = n.inf ? S.colorOf(n.gen, a) : `rgba(235,238,255,${a * 0.85})`; ctx.fillText(g, n.sx, n.sy);
      return true;
    },
    over(S, ctx, now) { if (S.data.spec) whPanels(S, ctx, now); },
    onRelease(S, held, pw) {
      const d = S.data;
      d.breach = { t: S.now, x0: -28, z: -64, pw: clamp(pw, 0.6, 1.4) };
      d.calls.push({ t0: d.songK, dur: 6, type: 'slap', amp: 1.6 });
      return false;
    },
    hud(S) {
      const d = S.data, n = d.calls.length;
      if (S.holding) return ['the pod turns toward you · watch the bottom strip',
        'blue-whale calls sit at 10–40 Hz, mostly below human hearing (~20 Hz)',
        'humpback song: units → phrases → themes, from ~100 Hz to several kHz',
        'chorus · low sound rides the SOFAR channel, a sound-speed minimum ~1 km down'][S.stage];
      if (d.breach) return 'breach · some thirty tonnes, briefly airborne';
      return `${n} call${n === 1 ? '' : 's'} on air · log-f spectrogram 8 Hz–4 kHz at ×6 · rays: Munk profile c(z), axis 1300 m`;
    }
  });

  /* ======================= 4. DIESELPUNK ======================= */
  // Air-standard Diesel cycle, compression ratio r = 18, γ = 1.4: 1→2 adiabatic compression, 2→3 constant-pressure
  // injection up to the cut-off ratio rc, 3→4 adiabatic expansion, 4→1 constant-volume blow-down.
  // η = 1 − (rc^γ − 1) / (γ·r^(γ−1)·(rc − 1)). The HUD also integrates ∮P dV over the plotted loop as a check.
  const DZ_G = 1.4, DZ_R = 18, DZ_LAM = 0.28, DZ_SLOW = 50, DZ_P2 = Math.pow(DZ_R, DZ_G);
  const dzEta = (rc) => 1 - (Math.pow(rc, DZ_G) - 1) / (DZ_G * Math.pow(DZ_R, DZ_G - 1) * (rc - 1));
  // slider-crank: piston travel x(ψ)/stroke with λ = crank/rod; V = Vc·(1 + (r − 1)·x)
  const dzX = (psi) => { const s = Math.sin(psi); return ((1 - Math.cos(psi)) + (1 - Math.sqrt(1 - DZ_LAM * DZ_LAM * s * s)) / DZ_LAM) / 2; };
  const dzVol = (psi) => 1 + (DZ_R - 1) * dzX(psi);
  function dzState(phi, rc) { // 4-stroke: intake, compression, power, exhaust (crank angle φ in 0..4π)
    const st = Math.floor(phi / Math.PI) % 4, V = dzVol(phi % TAU);
    let P = 1;
    if (st === 1) P = Math.pow(DZ_R / V, DZ_G); else if (st === 2) P = V <= rc ? DZ_P2 : DZ_P2 * Math.pow(rc / V, DZ_G);
    return { st, V, P };
  }
  function dzNumEta(rc) { // W = ∮P dV over the two working strokes, Q_in = cp·ΔT = γ/(γ−1)·P2·(V3 − V2)
    let W = 0, prev = dzState(Math.PI, rc);
    for (let i = 1; i <= 2000; i++) { const s = dzState(Math.PI + i / 2000 * TAU - 1e-9, rc); W += (s.P + prev.P) / 2 * (s.V - prev.V); prev = s; }
    return W / (DZ_G / (DZ_G - 1) * DZ_P2 * (rc - 1));
  }
  function dzEngine(S, L) { // the static frame of the engine panel
    return layer(S, 'eng', L.pw, L.ph, (x, w, h) => {
      x.fillStyle = 'rgba(8,10,12,0.86)'; x.fillRect(0, 0, w, h);
      x.strokeStyle = 'rgba(255,205,130,0.75)'; x.lineWidth = 1.2; x.strokeRect(3.5, 3.5, w - 7, h - 7); x.lineWidth = 0.6; x.strokeRect(7.5, 7.5, w - 15, h - 15);
      [[0, 0], [w, 0], [0, h], [w, h]].forEach(([X, Y]) => { const sx = X ? -1 : 1, sy = Y ? -1 : 1; x.fillStyle = 'rgba(255,205,130,0.75)'; for (let k = 0; k < 3; k++) x.fillRect(X + sx * (10 + k * 5) - (sx < 0 ? 3 : 0), Y + sy * 10 - (sy < 0 ? 3 : 0), 3, 3); });
      x.font = '9px monospace'; x.fillStyle = 'rgba(255,215,150,0.8)'; x.textAlign = 'left'; x.textBaseline = 'top';
      x.fillText('MODEL D-18 · COMPRESSION IGNITION · r = 18', 14, 10);
      const p = L.plot; x.strokeStyle = 'rgba(255,215,150,0.5)'; x.lineWidth = 1; x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(p.x, p.y + p.h); x.lineTo(p.x + p.w, p.y + p.h); x.stroke();
      x.fillText('P', p.x - 10, p.y - 2); x.textAlign = 'right'; x.fillText('V', p.x + p.w, p.y + p.h + 3);
      x.textAlign = 'left'; x.fillText('Vc', p.x + p.w / 19 - 4, p.y + p.h + 3); x.fillText('18·Vc', p.x + p.w * 18 / 19 - 16, p.y + p.h + 14 - 11);
      // cylinder walls
      const e = L.eng; x.fillStyle = '#20262c'; x.fillRect(e.cx - e.bore / 2 - 5, e.top - 6, 5, e.bot - e.top + 6); x.fillRect(e.cx + e.bore / 2, e.top - 6, 5, e.bot - e.top + 6); x.fillRect(e.cx - e.bore / 2 - 5, e.top - 10, e.bore + 10, 5);
      x.fillStyle = '#8a8f96'; x.fillRect(e.cx - 2, e.top - 18, 4, 9); // injector
      x.strokeStyle = 'rgba(255,215,150,0.35)'; x.beginPath(); x.arc(e.cx, e.cyc, e.rr + 3, 0, TAU); x.stroke();
    });
  }
  function dzPanel(S, ctx, now) {
    const d = S.data, L = d.L, X = L.px, Y = L.py;
    blit(ctx, dzEngine(S, L), X, Y);
    const p = L.plot, mx = (V) => X + p.x + p.w * V / 19, my = (P) => Y + p.y + p.h * (1 - P / 62);
    // the ideal loop for the current cut-off: compression, injection, expansion, blow-down
    ctx.beginPath(); ctx.moveTo(mx(DZ_R), my(1));
    for (let i = 1; i <= 40; i++) { const V = DZ_R + (1 - DZ_R) * i / 40; ctx.lineTo(mx(V), my(Math.pow(DZ_R / V, DZ_G))); }
    ctx.lineTo(mx(d.rc), my(DZ_P2));
    for (let i = 1; i <= 40; i++) { const V = d.rc + (DZ_R - d.rc) * i / 40; ctx.lineTo(mx(V), my(DZ_P2 * Math.pow(d.rc / V, DZ_G))); }
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,190,90,0.16)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,205,130,0.9)'; ctx.lineWidth = 1.3; ctx.stroke();
    ctx.setLineDash([2, 3]); ctx.strokeStyle = 'rgba(255,205,130,0.4)'; ctx.beginPath(); ctx.moveTo(mx(1), my(1)); ctx.lineTo(mx(DZ_R), my(1)); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(255,225,170,0.85)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('2', mx(1) - 6, my(DZ_P2)); ctx.fillText('3', mx(d.rc) + 6, my(DZ_P2) - 7);
    ctx.fillText('4', mx(DZ_R) + 7, my(DZ_P2 * Math.pow(d.rc / DZ_R, DZ_G))); ctx.fillText('1', mx(DZ_R) + 7, my(1) - 4);
    ctx.textAlign = 'right'; ctx.fillText(`W = ∮P dV · η ${(dzEta(d.rc) * 100).toFixed(1)}%`, X + p.x + p.w, Y + p.y + 4);
    // the live state point with a short trail
    const s = d.s, tx = mx(s.V), ty = my(s.P);
    d.trail.push([tx, ty]); if (d.trail.length > 24) d.trail.shift();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,120,40,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); d.trail.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke();
    drawGlow(ctx, '255,150,60', tx, ty, 12, 0.9);
    // the engine itself
    const e = L.eng, psi = d.phi % TAU, ex = X + e.cx, cy = Y + e.cyc;
    const pinX = ex + e.rr * Math.sin(psi), pinY = cy - e.rr * Math.cos(psi), pistY = cy - (e.rr * Math.cos(psi) + Math.sqrt(e.l * e.l - (e.rr * Math.sin(psi)) ** 2));
    const top = Y + e.top;
    if (s.st === 2 && s.V <= d.rc * 1.3) { drawGlow(ctx, '255,140,40', ex, (top + pistY - 14) / 2, e.bore * 0.8, 0.9); drawGlow(ctx, '255,230,160', ex, top + 4, e.bore * 0.3, 0.8); }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#b8bec6'; ctx.fillRect(ex - e.bore / 2 + 1, pistY - 14, e.bore - 2, 16);
    ctx.fillStyle = '#5a6068'; ctx.fillRect(ex - e.bore / 2 + 1, pistY - 10, e.bore - 2, 2); ctx.fillRect(ex - e.bore / 2 + 1, pistY - 6, e.bore - 2, 2);
    ctx.strokeStyle = '#d0d6dc'; ctx.lineWidth = 4; S.line(ex, pistY, pinX, pinY);
    ctx.strokeStyle = '#8a9098'; ctx.lineWidth = 6; S.line(ex, cy, pinX, pinY);
    ctx.fillStyle = '#e8c070'; ctx.beginPath(); ctx.arc(pinX, pinY, 3, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(ex, cy, 3.5, 0, TAU); ctx.fill();
    ctx.font = '9px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,215,150,0.8)';
    ctx.fillText(['INTAKE', 'COMPRESSION', 'POWER', 'EXHAUST'][s.st], ex, Y + L.ph - 9);
  }

  function dzFacade(X, lit) { // limestone piers and a window grid; the emissive version lights a random third of the rooms
    return X.canvasTexture(256, 512, (x, w, h) => {
      x.fillStyle = lit ? '#000' : '#4a4640'; x.fillRect(0, 0, w, h);
      if (!lit) for (let k = 0; k < 900; k++) { x.fillStyle = `rgba(${rand(20, 90) | 0},${rand(20, 80) | 0},${rand(20, 70) | 0},0.12)`; x.fillRect(rand(0, w), rand(0, h), rand(2, 8), rand(2, 8)); }
      const cols = 6, rows = 22, cw = w / cols, rh = h / rows;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const X0 = i * cw + cw * 0.22, Y0 = j * rh + rh * 0.2, ww = cw * 0.56, hh = rh * 0.6;
        if (lit) { if (Math.random() < 0.34) { x.fillStyle = `rgb(255,${rand(170, 215) | 0},${rand(90, 140) | 0})`; x.globalAlpha = rand(0.5, 1); x.fillRect(X0, Y0, ww, hh); x.globalAlpha = 1; } }
        else { x.fillStyle = '#121416'; x.fillRect(X0, Y0, ww, hh); }
      }
      if (!lit) { x.fillStyle = 'rgba(255,230,190,0.12)'; for (let i = 0; i < cols; i++) x.fillRect(i * cw, 0, 2, h); } // piers catch the light
    });
  }
  function dzBeam(X) { // a volumetric-looking searchlight cone: additive, fading along its length and toward its silhouette
    const THREE = X.THREE, geo = new THREE.CylinderGeometry(0.4, 9, 320, 32, 1, true); geo.translate(0, -160, 0); geo.rotateX(Math.PI); // apex at the origin, opening along +y
    const mat = new THREE.ShaderMaterial({
      uniforms: { uCol: { value: new THREE.Color(1, 0.95, 0.85) }, uI: { value: 0.22 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying float vL; varying float vF; void main(){ vL = position.y / 320.0; vec4 mv = modelViewMatrix * vec4(position, 1.0); vec3 n = normalize(normalMatrix * normal); vF = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uCol; uniform float uI; varying float vL; varying float vF; void main(){ float a = uI * pow(1.0 - clamp(vL, 0.0, 1.0), 1.4) * pow(vF, 2.5); gl_FragColor = vec4(uCol * a, 1.0); }'
    });
    const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 8;
    return m;
  }
  function dzZeppelin(X, sc) {
    const THREE = X.THREE, g = new THREE.Group(), prof = [];
    for (let i = 0; i <= 30; i++) { const t = i / 30, x = (t - 0.5) * 72, r = 9 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.02)), 0.62) * (t > 0.6 ? 1 - (t - 0.6) * 0.5 : 1); prof.push(new THREE.Vector2(Math.max(0.05, r), x)); }
    const hullGeo = new THREE.LatheGeometry(prof, 32); hullGeo.rotateZ(-Math.PI / 2);
    const skin = X.canvasTexture(512, 128, (x, w, h) => { x.fillStyle = '#8d9298'; x.fillRect(0, 0, w, h); for (let i = 0; i < w; i += 16) { x.fillStyle = 'rgba(30,34,38,0.35)'; x.fillRect(i, 0, 1.5, h); } for (let j = 0; j < h; j += 8) { x.fillStyle = 'rgba(30,34,38,0.25)'; x.fillRect(0, j, w, 1); } for (let k = 0; k < 400; k++) { x.fillStyle = `rgba(255,255,255,${rand(0, 0.06)})`; x.fillRect(rand(0, w), rand(0, h), rand(4, 20), rand(1, 4)); } });
    const hull = new THREE.Mesh(hullGeo, new THREE.MeshStandardMaterial({ map: skin, metalness: 0.55, roughness: 0.45 })); hull.castShadow = true; g.add(hull);
    const dark = new THREE.MeshStandardMaterial({ color: C(0x2a2e33), metalness: 0.5, roughness: 0.5 });
    const fs = new THREE.Shape(); fs.moveTo(0, 0); fs.lineTo(-11, 0); fs.lineTo(-13, 7); fs.lineTo(-4, 3); fs.lineTo(0, 0);
    const fg = new THREE.ExtrudeGeometry(fs, { depth: 0.4, bevelEnabled: true, bevelSize: 0.2, bevelThickness: 0.2, bevelSegments: 1 });
    for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(fg, dark); const piv = new THREE.Group(); piv.position.x = -26; piv.rotation.x = k * Math.PI / 2; f.position.y = 4.5; piv.add(f); g.add(piv); }
    const gon = new THREE.Mesh(new THREE.BoxGeometry(14, 2.6, 3), dark); gon.position.set(6, -9.6, 0); g.add(gon);
    const wins = new THREE.Mesh(new THREE.BoxGeometry(12, 0.7, 3.05), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.0, 0.9) })); wins.position.set(6, -9.4, 0); g.add(wins);
    const nav = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.3, 0.2) })); nav.position.set(-34, 0, 0); g.add(nav);
    sc.add(g);
    return { g, nav };
  }
  addMode({
    id: 'pk_diesel', name: 'DIESELPUNK', glyphs: G('◆◇▲▼◢◣◤◥║═╬▮▯', '◆◇▲▼#=|'),
    base: [42, 50, 84], palette: [[42, 100, 64], [190, 60, 72], [8, 85, 60], [48, 70, 86]],
    links: ['line', 'zipper', 'pk_beam', 'lightning'], count: 72, noHueShift: true, pageBg: ['#131a1e', '#050607'],
    shapes: ['sphere', 'crown', 'cuboctahedron', 'torus', 'rhombic_dodecahedron', 'sunflower', 'cube', 'trefoil'],
    init(S) { Object.assign(S.data, { phi: 0, rpm: 700, rc: 1.8, fan: -1e9, lastSt: 0, eta: dzNumEta(1.8), etaK: 0, trail: [] }); },
    update(S, now, dt) {
      const d = S.data;
      if (!d.L || d.L.key !== S.W + 'x' + S.H) {
        const pw = Math.min(430, S.W * 0.36), ph = Math.min(190, S.H * 0.24), px = S.W - pw - 16, py = S.H - ph - 46;
        const rr = Math.min(15, ph * 0.08), l = rr / DZ_LAM, cyc = ph - 18 - rr;
        d.L = { key: S.W + 'x' + S.H, pw, ph, px, py, plot: { x: 118, y: 26, w: pw - 134, h: ph - 50 }, eng: { cx: 58, bore: 40, rr, l, cyc, top: cyc - l - rr - 14, bot: cyc - l + rr + 12 } };
        delete d._eng;
      }
      const rcT = S.holding ? [2.0, 2.4, 2.8, 3.2][S.stage] : 1.8, rpmT = S.holding ? [1000, 1400, 1800, 2200][S.stage] : 700;
      d.rc += (rcT - d.rc) * ease(dt, 600); d.rpm += (rpmT - d.rpm) * ease(dt, 900);
      if (++d.etaK % 10 === 0) d.eta = dzNumEta(d.rc);
      d.phi = (d.phi + d.rpm / 60 * TAU / DZ_SLOW * dt / 1000) % (2 * TAU);
      d.s = dzState(d.phi, d.rc);
    },
    three: {
      init(S, X) {
        const THREE = X.THREE, sc = X.scene, d = S.data;
        X.setBloom(1.0, 0.55, 0.7); X.setExposure(1.0);
        sc.background = C(0x05080b); sc.fog = new THREE.FogExp2(C(0x0b1116), 0.0034);
        // wet asphalt, mirror-ish
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshStandardMaterial({ color: C(0x0c0d0f), roughness: 0.22, metalness: 0.1 }));
        ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; sc.add(ground);
        // the skyline: stepped towers as three instanced tiers, spires on some
        const towers = [];
        for (let gx = -11; gx <= 11; gx++) for (let gz = -12; gz <= 3; gz++) {
          const x = gx * 30 + rand(-6, 6), z = gz * 30 + rand(-6, 6), r = Math.hypot(x, z);
          if (r < 40 || (z > -20 && Math.abs(x) < 75) || Math.random() < 0.25) continue;
          const h = (40 + Math.random() * 110) * (1 - 0.45 * smooth(120, 380, r)) * (Math.abs(x) < 120 && z < 0 ? 1.15 : 0.8);
          towers.push({ x, z, w: rand(14, 24), d: rand(14, 24), h });
        }
        const facade = dzFacade(X, false), glowMap = dzFacade(X, true);
        [facade, glowMap].forEach((t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 4); });
        d.facade = new THREE.MeshStandardMaterial({ map: facade, emissiveMap: glowMap, emissive: C(0xffc070), emissiveIntensity: 1.1, roughness: 0.8, metalness: 0.05 });
        const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
        const tiers = new THREE.InstancedMesh(box, d.facade, towers.length * 3), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), Sc = new THREE.Vector3();
        const spires = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 4), new THREE.MeshStandardMaterial({ color: C(0xc8b080), metalness: 1, roughness: 0.3 }), towers.length);
        let ti = 0, si = 0;
        towers.forEach((t) => {
          let y = 0; [[1, 0.62], [0.76, 0.24], [0.52, 0.14]].forEach(([k, hh]) => { M.compose(V.set(t.x, y, t.z), Q, Sc.set(t.w * k, t.h * hh, t.d * k)); tiers.setMatrixAt(ti++, M); y += t.h * hh; });
          if (Math.random() < 0.45) { M.compose(V.set(t.x, y + t.h * 0.09, t.z), Q, Sc.set(t.w * 0.14, t.h * 0.18, t.d * 0.14)); spires.setMatrixAt(si++, M); }
        });
        spires.count = si; tiers.castShadow = tiers.receiveShadow = true; sc.add(tiers); sc.add(spires);
        // the central tower: setbacks, deco fins, a crown of stacked arches with lit chevrons, and a needle spire
        const chrome = new THREE.MeshStandardMaterial({ color: C(0xd8dce2), metalness: 1, roughness: 0.18 });
        const ct = new THREE.Group(); sc.add(ct);
        let y = 0;
        [[34, 52], [27, 20], [21, 12], [15, 6]].forEach(([w, h]) => { const m = new THREE.Mesh(box, d.facade); m.scale.set(w, h, w); m.position.y = y; m.castShadow = m.receiveShadow = true; ct.add(m); y += h; });
        for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.8, 44, 3), chrome); const a = k * Math.PI / 2; f.position.set(Math.cos(a) * 17.4, 30, Math.sin(a) * 17.4); f.scale.y = 1.4; f.rotation.y = -a; ct.add(f); }
        for (let k = 0; k < 5; k++) { const r = 9.5 - k * 1.7, arch = new THREE.Mesh(new THREE.TorusGeometry(r, 0.45, 8, 28, Math.PI), chrome); arch.position.y = y + k * 1.6; ct.add(arch); const arch2 = arch.clone(); arch2.rotation.y = Math.PI / 2; ct.add(arch2); }
        const chev = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1.4), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.6, 1.2), side: THREE.DoubleSide }), 40);
        for (let k = 0; k < 40; k++) { const tier = k % 5, a = Math.PI * ((Math.floor(k / 5) % 4) * 0.25 + 0.06 + 0.12 * ((k / 20) | 0)), r = 9.5 - tier * 1.7; M.compose(V.set(Math.cos(a) * r * 0.86, y + tier * 1.6 + Math.sin(a) * r * 0.86, k < 20 ? 0.5 : -0.5), Q, Sc.set(1, 1, 1)); chev.setMatrixAt(k, M); }
        ct.add(chev);
        const needle = new THREE.Mesh(new THREE.ConeGeometry(0.9, 26, 8), chrome); needle.position.y = y + 18; ct.add(needle);
        d.crownY = y + 8;
        // searchlights around the plaza, two of them carry a real spot light
        d.beams = [[-60, 40], [-34, 70], [34, 70], [60, 40], [0, 100], [-150, -60], [150, -60]].map((p, i) => {
          const b = dzBeam(X); b.position.set(p[0], 1, p[1]); sc.add(b);
          const lampG = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 2, 16), chrome); lampG.position.set(p[0], 1, p[1]); sc.add(lampG);
          let spot = null;
          if (i < 2) { spot = new THREE.SpotLight(C(0xfff2d8), 90000, 0, 0.06, 0.4, 2); spot.position.set(p[0], 2, p[1]); sc.add(spot); sc.add(spot.target); }
          return { m: b, spot, i, dir: new THREE.Vector3(0, 1, 0), aim: new THREE.Vector3(0, 1, 0) };
        });
        d.zeps = [dzZeppelin(X, sc), dzZeppelin(X, sc)];
        d.zeps[0].x = -120; d.zeps[0].y = 150; d.zeps[0].z = -120; d.zeps[0].v = 4;
        d.zeps[1].x = 160; d.zeps[1].y = 120; d.zeps[1].z = -220; d.zeps[1].v = -3; d.zeps[1].g.scale.setScalar(0.75);
        // light: moonlight, a sodium-lit street level, the city glow
        const moon = new THREE.DirectionalLight(C(0x8aa4c8), 0.5); moon.position.set(-200, 300, -150);
        moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048); Object.assign(moon.shadow.camera, { left: -200, right: 200, top: 200, bottom: -200, near: 50, far: 800 }); sc.add(moon);
        sc.add(new THREE.HemisphereLight(C(0x2a3a4a), C(0x2a1a0a), 0.6));
        [[-30, 50], [30, 50], [-30, -10], [30, -10]].forEach((p) => { const l = new THREE.PointLight(C(0xffa040), 3000, 0, 2); l.position.set(p[0], 8, p[1]); sc.add(l); });
        d.exh = particles(X, 300, {}); sc.add(d.exh.pts);
      },
      update(S, X, now, dt) {
        const d = S.data;
        if (!d.beams) return;
        const THREE = X.THREE, T = now / 1000, fan = now - d.fan < 2200, pw = power(S);
        const crown = new THREE.Vector3(0, d.crownY + 8, 0);
        let ptrAim = null;
        if (S.ptrInside && !S.holding) ptrAim = X.fromScreen(S.ptr.x, S.ptr.y, -60);
        d.beams.forEach((b) => {
          const src = b.m.position;
          let tgt;
          if (fan) tgt = new THREE.Vector3(src.x * 4, 400, src.z * 1.5 - 300);
          else if (S.holding) tgt = crown.clone().add(new THREE.Vector3(Math.cos(T * 1.3 + b.i) * 6, Math.sin(T + b.i) * 6, 0));
          else if (ptrAim && Math.abs(ptrAim.x - src.x) < 170) tgt = ptrAim;
          else tgt = new THREE.Vector3(src.x + Math.sin(T * 0.21 * (1 + b.i * 0.13) + b.i * 1.7) * 150, 260, src.z - 200 + Math.cos(T * 0.17 + b.i) * 120);
          b.aim.copy(tgt).sub(src).normalize();
          b.dir.lerp(b.aim, ease(dt, fan ? 260 : 650)).normalize();
          b.m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.dir);
          b.m.material.uniforms.uI.value = (fan ? 0.22 : 0.09) + 0.08 * pw;
          b.m.material.uniforms.uCol.value.setRGB(1, lerp(0.95, 0.72, S.stage >= 3 ? 1 : 0), lerp(0.85, 0.45, S.stage >= 3 ? 1 : 0));
          if (b.spot) { b.spot.target.position.copy(src).addScaledVector(b.dir, 300); }
        });
        d.facade.emissiveIntensity = 1.1 + 2.2 * pw + (fan ? 1.5 * (1 - (now - d.fan) / 2200) : 0);
        d.zeps.forEach((z) => { z.x += z.v * dt / 1000; if (z.x > 400) z.x = -400; if (z.x < -400) z.x = 400; z.g.position.set(z.x, z.y + Math.sin(T * 0.3 + z.z) * 2, z.z); z.g.rotation.y = z.v > 0 ? 0 : Math.PI; z.nav.visible = Math.floor(T * 1.4 + z.z) % 2 === 0; });
        if (d.s && d.s.st === 3 && d.lastSt !== 3) for (let k = 0; k < 8; k++) d.exh.emit({ x: 16 + rand(-1, 1), y: 46, z: 6, vx: rand(-1, 1), vy: rand(4, 7), life: rand(3, 5), s0: 2, s1: rand(10, 16), a: 0.35, c: [0.06, 0.06, 0.065], wx: 1.5 }); // exhaust stacks puff on every exhaust stroke
        d.lastSt = d.s ? d.s.st : 0;
        d.exh.step(dt, X.camera);
        camRig(S, X, { look: [0, d.crownY + 8, 0], r: 230, el: -0.08, sway: 0.1, speed: 0.00005, par: 0.25, parY: 0.06 }, now, dt);
      }
    },
    drawNode(S, ctx, n, g, size, a) {
      ctx.font = `${size.toFixed(1)}px monospace`; ctx.fillStyle = n.inf ? S.colorOf(n.gen, a) : `rgba(240,226,196,${a * 0.9})`; ctx.fillText(g, n.sx, n.sy);
      return true;
    },
    over(S, ctx, now) { if (S.data.L && S.data.s) dzPanel(S, ctx, now); },
    onRelease(S, held, pw) { S.data.fan = S.now; kick(S, 0.6 * pw); return false; },
    hud(S) {
      const d = S.data, eta = (dzEta(d.rc) * 100).toFixed(1), num = (d.eta * 100).toFixed(1), rpm = fmt(d.rpm);
      if (S.holding) return [`more fuel: cut-off rc = ${d.rc.toFixed(2)} · a fatter loop, more work W = ∮P dV`,
        `rc = ${d.rc.toFixed(2)} · η = ${eta}% · ${rpm} rpm · the searchlights found you`,
        `rc = ${d.rc.toFixed(2)} · η falls to ${eta}% while power rises · compression alone lights the fuel`,
        `rc = ${d.rc.toFixed(2)} · ${rpm} rpm · η ${eta}% · full throttle over the skyline`][S.stage];
      return `Diesel cycle r = 18, rc = ${d.rc.toFixed(2)} · η = 1 − (rc^γ−1)/(γr^(γ−1)(rc−1)) = ${eta}% · ∮P dV/Q = ${num}% · ${rpm} rpm (×1/${DZ_SLOW})`;
    }
  });

  /* ======================= 5. SOLARPUNK ======================= */
  // The pointer steers the sun: left-right is its azimuth, up-down its elevation. A panel delivers
  // P = P0·cos θ (θ: angle between its normal and the sun) times a clear-sky irradiance that fades with air mass
  // AM = 1/cos(zenith) (Meinel: I = 1.353·0.7^(AM^0.678) kW/m²). Trackers turn to face the sun, the others lie flat.
  // Leaves sprout around infected letters at the golden angle, 137.5°.
  const GOLD_A = Math.PI * (3 - Math.sqrt(5));
  function slPlan() {
    const out = [];
    for (let i = 0; i < 70; i++) {
      const a = rand(0, TAU), r = 34 + Math.pow(Math.random(), 0.8) * 150, x = Math.cos(a) * r, z = Math.sin(a) * r * 0.8 - 20;
      if (z > 40 && Math.abs(x) < 60) continue; // keep the foreground open
      if (out.some((q) => Math.hypot(q.x - x, q.z - z) < q.w * 0.7 + 12)) continue;
      out.push({ x, z, w: rand(14, 22), h: rand(18, 58) * (1 - 0.4 * smooth(60, 180, r)), tiers: 2 + Math.floor(rand(0, 3)), solar: Math.random() < 0.55 });
    }
    return out;
  }
  addMode({
    id: 'pk_solar', name: 'SOLARPUNK', glyphs: G('❦❧✿❀❁✾☘⚘♣✽', '*+oO&'),
    base: [55, 40, 92], palette: [[110, 70, 55], [80, 85, 55], [45, 100, 62], [330, 75, 72], [160, 65, 52]],
    links: ['line', 'vine', 'roots', 'vine'], count: 110, noHueShift: true, pageBg: ['#0d2a22', '#04100c'],
    shapes: ['sunflower', 'sphere', 'rose', 'torus', 'seashell', 'heart', 'helix', 'dodecahedron'],
    init(S) { Object.assign(S.data, { sx: S.W * 0.7, sy: S.H * 0.22, flare: -1e9, avgT: 0, avgF: 0, elev: 30, AM: 1.2, I: 0.9 }); },
    update(S, now, dt) {
      const d = S.data;
      let tx, ty;
      if (hasPtr(S)) { tx = S.ptr.x; ty = S.ptr.y; } else { const u = (now * 0.00003) % 1; tx = S.W * (0.06 + 0.88 * u); ty = S.H * (0.5 - 0.42 * Math.sin(Math.PI * u)); }
      d.sx += (tx - d.sx) * ease(dt, 300); d.sy += (ty - d.sy) * ease(dt, 300);
      for (const n of S.active) { // leaves grow on infected letters and linger; blooms open at stage III
        const q = n.data;
        if (q.a0 === undefined) { q.a0 = rand(0, TAU); q.vg = 0; q.bl = 0; }
        if (n.inf) q.vg = Math.min(1, q.vg + dt / 1700 * (1 + S.stage * 0.7)); else q.vg = Math.max(0, q.vg - dt / 9000);
        if (n.inf && S.stage >= 3) q.bl = Math.min(1, q.bl + dt / 700); else q.bl = Math.max(0, q.bl - dt / 6000);
      }
    },
    three: {
      exit(S, X) { if (X && X.pkPM) X.pkPM.dispose(); },
      init(S, X) {
        const THREE = X.THREE, sc = X.scene, d = S.data;
        X.setBloom(0.5, 0.5, 0.9); X.setExposure(0.32);
        const sky = new THREE.Sky(); sky.scale.setScalar(9000); sc.add(sky); d.sky = sky;
        const su = sky.material.uniforms; su.turbidity.value = 2.4; su.rayleigh.value = 1.2; su.mieCoefficient.value = 0.004; su.mieDirectionalG.value = 0.8;
        d.envSky = new THREE.Sky(); d.envSky.scale.setScalar(9000); d.envScene = new THREE.Scene(); d.envScene.add(d.envSky); d.pm = X.pkPM = new THREE.PMREMGenerator(X.renderer); d.envAt = -1e9;
        sc.fog = new THREE.Fog(C(0x9fb8c0), 320, 1500);
        d.sun = new THREE.DirectionalLight(C(0xfff0d8), 4); d.sun.castShadow = true; d.sun.shadow.mapSize.set(2048, 2048);
        Object.assign(d.sun.shadow.camera, { left: -150, right: 150, top: 150, bottom: -150, near: 50, far: 700 }); d.sun.shadow.bias = -0.0005; d.sun.shadow.normalBias = 0.6;
        sc.add(d.sun); sc.add(d.sun.target);
        d.hemi = new THREE.HemisphereLight(C(0xbfe0ff), C(0x3a5a2a), 1.2); sc.add(d.hemi);
        // meadow ground, a canal, distant hills
        const grass = pixTexture(X, 256, 256, (i, j) => { const n = fbm(X, i / 20, j / 20, 1, 4), v = n * 40; return [60 + v * 0.6, 110 + v, 50 + v * 0.4]; }, true); grass.repeat.set(40, 40);
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshStandardMaterial({ map: grass, roughness: 0.95 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; sc.add(ground);
        const canal = new THREE.Mesh(new THREE.PlaneGeometry(900, 14), new THREE.MeshStandardMaterial({ color: C(0x1a3a48), roughness: 0.04, metalness: 0.9 })); canal.rotation.x = -Math.PI / 2; canal.position.set(0, 0.15, 52); sc.add(canal);
        const hg = new THREE.PlaneGeometry(1800, 400, 120, 20); const hp = hg.attributes.position;
        for (let i = 0; i < hp.count; i++) { const x = hp.getX(i), y = hp.getY(i); hp.setZ(i, Math.max(0, (y + 200) / 400) * (30 + 50 * Math.abs(fbm(X, x * 0.004, 2, 0.5, 4)))); }
        hg.computeVertexNormals(); const hills = new THREE.Mesh(hg, new THREE.MeshStandardMaterial({ color: C(0x5a8a6a), roughness: 1 })); hills.rotation.x = -Math.PI / 2; hills.position.set(0, 0, -520); sc.add(hills);
        // terraced towers: white concrete and green glass, planted terraces, panels on half the roofs
        const plan = slPlan(), glass = X.canvasTexture(128, 256, (x, w, h) => { x.fillStyle = '#e8e6de'; x.fillRect(0, 0, w, h); for (let j = 6; j < h; j += 64) { const gg = x.createLinearGradient(0, j, 0, j + 40); gg.addColorStop(0, '#9cc8cc'); gg.addColorStop(1, '#3a6a72'); x.fillStyle = gg; x.fillRect(0, j, w, 40); x.fillStyle = 'rgba(240,240,230,0.5)'; for (let i = 0; i < w; i += 32) x.fillRect(i, j, 2, 40); x.fillStyle = '#4a7a3a'; for (let i = 0; i < w; i += 6) x.fillRect(i, j + 44 + Math.random() * 4, 5, 6); } });
        glass.wrapS = glass.wrapT = THREE.RepeatWrapping; glass.repeat.set(1, 0.5);
        const box = THREE.RoundedBoxGeometry ? new THREE.RoundedBoxGeometry(1, 1, 1, 2, 0.06) : new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
        const blocks = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ map: glass, roughness: 0.32, metalness: 0.15, envMapIntensity: 0.9 }), plan.length * 4 + 6);
        const leafGeo = new THREE.IcosahedronGeometry(1, 1), lp = leafGeo.attributes.position; for (let i = 0; i < lp.count; i++) { const k = 0.8 + 0.35 * Math.random(); lp.setXYZ(i, lp.getX(i) * k, lp.getY(i) * k * 0.85, lp.getZ(i) * k); } leafGeo.computeVertexNormals();
        const leaves = [], panels = [], M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), Sc = new THREE.Vector3();
        let bi = 0;
        const addBlock = (x, y, z, w, h, dd) => { M.compose(V.set(x, y, z), Q.identity(), Sc.set(w, h, dd)); blocks.setMatrixAt(bi++, M); };
        const plant = (x, y, z, w, dd, n) => { for (let k = 0; k < n; k++) { const e = k % 4, t = Math.random(); const px = e < 2 ? x + (t - 0.5) * w : x + (e === 2 ? -w / 2 : w / 2), pz = e >= 2 ? z + (t - 0.5) * dd : z + (e === 0 ? -dd / 2 : dd / 2); leaves.push([px, y + 0.6, pz, rand(0.9, 2.1)]); } };
        plan.forEach((b) => {
          let y = 0, w = b.w, dd = b.w * rand(0.8, 1.1);
          for (let t = 0; t < b.tiers; t++) {
            const h = b.h / b.tiers; addBlock(b.x, y, b.z, w, h, dd); y += h;
            plant(b.x, y, b.z, w, dd, Math.round(w * 0.9));
            w *= 0.74; dd *= 0.74;
          }
          if (b.solar) for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j += 2) panels.push({ x: b.x + i * w * 0.32, y: y + 1.6, z: b.z + j * dd * 0.22, track: (i + j + 2) % 2 === 0 });
          else for (let k = 0; k < 6; k++) leaves.push([b.x + rand(-w / 3, w / 3), y + 1.5, b.z + rand(-dd / 3, dd / 3), rand(1.5, 3)]);
        });
        // the central vertical forest: a slender tower wrapped in balconies of trees, its crown behind the letters
        for (let k = 0; k < 6; k++) { addBlock(0, k * 11, -10, 13 - k, 10.2, 13 - k); for (let j = 0; j < 22; j++) { const a = j / 22 * TAU; leaves.push([Math.cos(a) * (7.5 - k * 0.5), k * 11 + 10.5, -10 + Math.sin(a) * (7.5 - k * 0.5), rand(1.4, 2.4)]); } }
        for (let k = 0; k < 90; k++) { const a = rand(0, TAU), r = Math.sqrt(Math.random()) * 9; leaves.push([Math.cos(a) * r, 68 + rand(0, 7) - r * 0.4, -10 + Math.sin(a) * r, rand(2, 3.6)]); }
        for (let k = 0; k < 160; k++) { const x = rand(-200, 200), z = rand(-120, 100); if (Math.abs(z - 52) < 10) continue; leaves.push([x, rand(2, 5), z, rand(2, 4.5)]); } // park trees
        blocks.count = bi; blocks.castShadow = blocks.receiveShadow = true; sc.add(blocks);
        const foliage = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75 }), leaves.length);
        leaves.forEach((l, i) => { M.compose(V.set(l[0], l[1], l[2]), Q.setFromEuler(new THREE.Euler(rand(0, 3), rand(0, 3), 0)), Sc.setScalar(l[3])); foliage.setMatrixAt(i, M); foliage.setColorAt(i, new THREE.Color().setHSL(rand(0.22, 0.36), rand(0.45, 0.7), rand(0.16, 0.3)).convertSRGBToLinear()); });
        foliage.castShadow = foliage.receiveShadow = true; sc.add(foliage); d.leaves = leaves;
        const blossoms = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.55, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, emissive: C(0x301020) }), 500);
        for (let i = 0; i < 500; i++) { const l = pick(leaves); M.compose(V.set(l[0] + rand(-1, 1) * l[3], l[1] + l[3] * 0.7, l[2] + rand(-1, 1) * l[3]), Q.identity(), Sc.setScalar(1)); blossoms.setMatrixAt(i, M); blossoms.setColorAt(i, C(pick([0xff8ab8, 0xffd24a, 0xffffff, 0xd88aff]))); }
        blossoms.count = 0; sc.add(blossoms); d.blossoms = blossoms;
        const pv = X.canvasTexture(128, 128, (x, w, h) => { x.fillStyle = '#c8ccd0'; x.fillRect(0, 0, w, h); x.fillStyle = '#0e1e3a'; x.fillRect(4, 4, w - 8, h - 8); x.strokeStyle = 'rgba(170,190,220,0.6)'; x.lineWidth = 1; for (let i = 4; i < w; i += 15) { x.beginPath(); x.moveTo(i, 4); x.lineTo(i, h - 4); x.stroke(); x.beginPath(); x.moveTo(4, i); x.lineTo(w - 4, i); x.stroke(); } });
        const pg = new THREE.BoxGeometry(4.2, 0.12, 2.6);
        d.pan = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ map: pv, metalness: 0.55, roughness: 0.16, envMapIntensity: 1.4 }), panels.length);
        panels.forEach((p, i) => d.pan.setColorAt(i, new THREE.Color(1, 1, 1)));
        d.pan.castShadow = true; sc.add(d.pan); d.panels = panels;
        // wind turbines on the hills
        d.turb = [];
        const white = new THREE.MeshStandardMaterial({ color: C(0xf0f0ea), roughness: 0.4 });
        [[-190, -140], [-120, -200], [150, -170], [230, -110], [60, -260]].forEach((p) => {
          const g = new THREE.Group(); g.position.set(p[0], 0, p[1]); sc.add(g);
          const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.6, 60, 12), white); tw.position.y = 30; tw.castShadow = true; g.add(tw);
          const hub = new THREE.Group(); hub.position.set(0, 60, 2.5); g.add(hub);
          for (let k = 0; k < 3; k++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(1.4, 26, 0.4), white); bl.geometry.translate(0, 13, 0); bl.rotation.z = k * TAU / 3; bl.castShadow = true; hub.add(bl); }
          d.turb.push(hub);
        });
        d.seeds = particles(X, 400, {}); sc.add(d.seeds.pts);
        d.phot = particles(X, 400, { additive: true }); sc.add(d.phot.pts);
      },
      update(S, X, now, dt) {
        const d = S.data;
        if (!d.pan) return;
        const THREE = X.THREE;
        camRig(S, X, { look: [0, 58, -10], r: 190, el: 0.1, sway: 0.1, speed: 0.00005, par: 0.12, parY: 0.04 }, now, dt);
        X.camera.updateMatrixWorld();
        // pointer x → azimuth (±70° about the view direction), pointer y → elevation (75° at the top, −4° at the bottom)
        const camAz = Math.atan2(X.camera.position.x, X.camera.position.z) + Math.PI, az = camAz + lerp(-1.22, 1.22, d.sx / S.W), el = lerp(1.31, -0.07, d.sy / S.H);
        const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
        d.sunDir = dir; d.elev = Math.asin(clamp(dir.y, -1, 1)) * 180 / Math.PI;
        const zen = (90 - clamp(d.elev, 0.5, 90)) * Math.PI / 180; d.AM = 1 / Math.cos(zen);
        d.I = d.elev > 0 ? 1.353 * Math.pow(0.7, Math.pow(d.AM, 0.678)) : 0;
        d.sky.material.uniforms.sunPosition.value.copy(dir);
        const day = smooth(-3, 20, d.elev);
        d.sun.position.copy(dir).multiplyScalar(400); d.sun.target.position.set(0, 0, 0);
        d.sun.intensity = 7 * smooth(-1, 8, d.elev); d.sun.color.setRGB(1, lerp(0.55, 0.95, smooth(0, 30, d.elev)), lerp(0.3, 0.85, smooth(0, 35, d.elev)));
        d.hemi.intensity = 0.3 + 1.6 * day;
        X.setExposure(lerp(0.5, 0.3, day));
        if (now - d.envAt > 600 && (!d.envDir || d.envDir.angleTo(dir) > 0.03)) { // re-light the glass from the current sky
          d.envAt = now; d.envDir = dir.clone(); d.envSky.material.uniforms.sunPosition.value.copy(dir);
          ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG'].forEach((k) => (d.envSky.material.uniforms[k].value = d.sky.material.uniforms[k].value));
          const rt = d.pm.fromScene(d.envScene); if (d.envRT) d.envRT.dispose(); d.envRT = rt; X.scene.environment = rt.texture;
        }
        // panels: trackers point their normal at the sun (within ±75° of vertical), the rest lie flat
        const up = new THREE.Vector3(0, 1, 0), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), n = new THREE.Vector3();
        let sT = 0, sF = 0, nT = 0, nF = 0;
        const fl = now - d.flare < 1500 ? 1 - (now - d.flare) / 1500 : 0;
        d.panels.forEach((p, i) => {
          if (!p.n) p.n = up.clone();
          if (p.track) { n.copy(dir); if (n.y < 0.26) { n.y = 0.26; } n.normalize(); p.n.lerp(n, ease(dt, 500)).normalize(); }
          Q.setFromUnitVectors(up, p.n); M.compose(V.set(p.x, p.y, p.z), Q, one); d.pan.setMatrixAt(i, M);
          p.cos = d.elev > 0 ? Math.max(0, p.n.dot(dir)) : 0;
          const gl = Math.pow(p.cos, 40) * 4 * day + fl * 2; d.pan.setColorAt(i, new THREE.Color(1 + gl, 1 + gl, 1 + gl * 0.9));
          if (p.track) { sT += p.cos; nT++; } else { sF += p.cos; nF++; }
        });
        d.pan.instanceMatrix.needsUpdate = true; d.pan.instanceColor.needsUpdate = true;
        d.avgT = nT ? sT / nT : 0; d.avgF = nF ? sF / nF : 0;
        const k = dt / 1000, pw = power(S);
        d.turb.forEach((h, i) => (h.rotation.z -= k * (0.6 + 0.2 * i + pspeed(S) * 0.03 + pw * 1.5)));
        d.blossoms.count = Math.round(500 * Math.max(pw, d.bloomHold || 0)); d.bloomHold = Math.max(0, (d.bloomHold || 0) - k * 0.15); if (S.holding) d.bloomHold = Math.max(d.bloomHold, pw);
        if (S.holding && S.stage >= 1 && d.elev > 0) for (let q = 0; q < S.stage * 3; q++) { const p = pick(d.panels), src = new THREE.Vector3(p.x, p.y, p.z).addScaledVector(dir, 90); d.phot.emit({ x: src.x, y: src.y, z: src.z, vx: -dir.x * 150, vy: -dir.y * 150, vz: -dir.z * 150, life: 0.6, s0: 0.8, s1: 0.4, a: 0.9, c: [2.4, 2.0, 1.1], drag: 1 }); }
        d.seeds.step(dt, X.camera); d.phot.step(dt, X.camera);
      }
    },
    drawNode(S, ctx, n, g, size, a) {
      const q = n.data, v = q.vg || 0;
      if (v > 0.02) { // leaves at the golden angle: each new leaf turns 137.5° from the last
        const cnt = Math.ceil(v * 6);
        ctx.fillStyle = `hsla(${110 + (n.gen % 3) * 12},55%,${32 + 8 * v}%,${a * 0.85})`; ctx.beginPath();
        for (let k = 0; k < cnt; k++) {
          const ang = q.a0 + k * GOLD_A, rr = size * (0.5 + 0.07 * k), L = size * 0.3 * clamp(v * 6 - k, 0, 1), cx = n.sx + Math.cos(ang) * rr, cy = n.sy + Math.sin(ang) * rr;
          if (L < 0.5) continue;
          ctx.moveTo(cx + Math.cos(ang) * L, cy + Math.sin(ang) * L); ctx.ellipse(cx, cy, L, L * 0.42, ang, 0, TAU);
        }
        ctx.fill();
      }
      ctx.font = `${size.toFixed(1)}px monospace`; ctx.fillStyle = n.inf ? S.colorOf(n.gen, a) : `rgba(255,252,235,${a * 0.92})`; ctx.fillText(g, n.sx, n.sy);
      if (q.bl > 0.05) {
        const bx = n.sx + size * 0.45, by = n.sy - size * 0.45, r = size * 0.2 * q.bl;
        ctx.fillStyle = `hsla(${330 + (n.gen % 4) * 12},75%,78%,${a * q.bl})`; ctx.beginPath();
        for (let k = 0; k < 5; k++) { const an = k * TAU / 5 + q.a0; const px = bx + Math.cos(an) * r, py = by + Math.sin(an) * r; ctx.moveTo(px + r * 0.7, py); ctx.arc(px, py, r * 0.7, 0, TAU); }
        ctx.fill(); ctx.fillStyle = `rgba(255,220,90,${a * q.bl})`; ctx.beginPath(); ctx.arc(bx, by, r * 0.4, 0, TAU); ctx.fill();
      }
      return true;
    },
    over(S, ctx) { // a small instrument readout: tracking versus flat panels
      const d = S.data, mx = S.W - 200, my = 100;
      panel(ctx, mx - 10, my - 18, 196, 62, 0.45, 'rgba(220,255,235,0.25)');
      ctx.font = '10px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      [['tracking', d.avgT, '#8fe3a8'], ['flat', d.avgF, '#e3c88f']].forEach(([lab, v, c], i) => {
        ctx.fillStyle = 'rgba(235,250,240,0.85)'; ctx.fillText(lab, mx, my + i * 18 - 4);
        ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(mx + 62, my + i * 18 - 8, 110, 8);
        ctx.fillStyle = c; ctx.fillRect(mx + 62, my + i * 18 - 8, 110 * v * (d.I || 0), 8);
      });
      ctx.fillStyle = 'rgba(235,250,240,0.75)'; ctx.fillText(`cos θ · I(AM ${d.AM > 9 ? '>9' : d.AM.toFixed(1)}) = ${d.I.toFixed(2)} kW/m²`, mx - 2, my + 31);
    },
    onRelease(S, held, pw) {
      const d = S.data, X = S.three; d.flare = S.now;
      if (X && d.leaves) for (let k = 0; k < 260 * pw; k++) { const l = pick(d.leaves); d.seeds.emit({ x: l[0], y: l[1] + l[3], z: l[2], vx: rand(-2, 2) + 3, vy: rand(2, 6), vz: rand(-2, 2), life: rand(5, 9), s0: 0.7, s1: 0.9, a: 0.9, c: [1.6, 1.6, 1.5], drag: 0.995, g: -0.2, wx: 1.2 }); }
      return false;
    },
    hud(S) {
      const d = S.data;
      const gain = d.avgF > 0.01 ? ((d.avgT / d.avgF - 1) * 100).toFixed(0) + '%' : '∞';
      if (S.holding) return ['photons inbound · 6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂',
        'leaves turn 137.5° (the golden angle) each, so no leaf shades the one below',
        `trackers ${(d.avgT * 100).toFixed(0)}% vs flat ${(d.avgF * 100).toFixed(0)}% of peak · tracking gain ${gain}`,
        'full bloom · the city runs on sunlight, the letters on chlorophyll'][S.stage];
      if (S.now - d.flare < 6000) return 'seeds aloft · wind dispersal, zero emissions';
      return `sun ${d.elev.toFixed(0)}° up · P = P₀·cos θ · trackers ${(d.avgT * 100).toFixed(0)}% · flat ${(d.avgF * 100).toFixed(0)}% · air mass ${d.AM > 9 ? '>9' : d.AM.toFixed(2)} · move the sun`;
    }
  });

  /* ======================= 6. BIOPUNK ======================= */
  // Each dish grows by the logistic law dN/dt = rN(1 − N/K), stepped with its exact solution
  // N(t+Δt) = K / (1 + (K/N − 1)·e^(−rΔt)), so any frame rate gives the same curve. r = ln2 per hour: doubling time 1 h.
  // Colony area grows with N. The helix has 10.5 base pairs per turn (B-DNA). Point mutations are transitions
  // (A↔G, C↔T) twice as often as transversions. Cas9 finds a 5′-NGG-3′ PAM and cuts 3 bp upstream of it.
  const BIO_K = 1e9, BIO_R = Math.LN2, BIO_M = 900, BIO_BP = 42, BIO_TURN = 10.5;
  const BASES_ARR = ['A', 'C', 'G', 'T'], COMP = { A: 'T', T: 'A', C: 'G', G: 'C' }, TRANSITION = { A: 'G', G: 'A', C: 'T', T: 'C' };
  const BCOL3 = { A: [0.25, 0.65, 1.0], T: [1.0, 0.72, 0.2], C: [0.35, 1.0, 0.45], G: [1.0, 0.3, 0.75] };
  function bioDots(R) { // colony positions: six colonies that fill outward as N grows
    const dots = [], nc = 6, cs = [];
    for (let c = 0; c < nc; c++) { const a = rand(0, TAU), rr = Math.sqrt(Math.random()) * R * 0.6; cs.push([Math.cos(a) * rr, Math.sin(a) * rr, R * rand(0.16, 0.3)]); }
    for (let i = 0; i < BIO_M; i++) {
      const c = cs[i % nc], rank = Math.floor(i / nc) / (BIO_M / nc), a = rand(0, TAU), rr = c[2] * Math.sqrt(rank) * rand(0.85, 1.12);
      let X = c[0] + Math.cos(a) * rr, Y = c[1] + Math.sin(a) * rr; const m = Math.hypot(X, Y);
      if (m > R * 0.9) { X *= R * 0.9 / m; Y *= R * 0.9 / m; }
      dots.push([X, Y, Math.random()]);
    }
    return dots;
  }
  addMode({
    id: 'pk_bio', name: 'BIOPUNK', glyphs: G('ACGTUACGTΨ⌬', 'ACGTU'),
    base: [165, 35, 86], palette: [[130, 100, 60], [310, 90, 66], [185, 100, 60], [58, 100, 64]],
    links: ['dna', 'dna', 'membrane', 'tentacle'], count: 'random', pageBg: ['#04181c', '#0b0414'],
    shapes: ['helix', 'sphere', 'torus_knot', 'gyroid', 'catenoid', 'trefoil', 'buckyball', 'boy'],
    init(S) {
      const d = S.data;
      Object.assign(d, { seq: Array.from({ length: BIO_BP }, () => pick(BASES_ARR)), scroll: 0, mut: 0, ts: 0, tv: 0, lastMut: null, nextMut: 0, flash: {}, tH: 0, pam: -1, cut: -1, ins: null, speed: 0.25 });
      d.dishes = [[-24, 6, 9, 95, 'A'], [22, -2, 10, 300, 'B'], [6, 22, 8, 190, 'C']].map(([x, z, R, hue, name]) => ({ x, z, R, hue, name, N: 2e7, sat: 0, pass: -1e9, dots: bioDots(R), shown: -1, recolor: true }));
    },
    update(S, now, dt) {
      const d = S.data;
      const speed = 0.25 * (S.holding ? [2, 4, 8, 16][S.stage] : 1), dtH = speed * dt / 1000; // incubator time: 0.25 h per second
      d.tH += dtH; d.speed = speed;
      for (const p of d.dishes) {
        p.N = BIO_K / (1 + (BIO_K / p.N - 1) * Math.exp(-BIO_R * dtH));
        if (p.N > 0.985 * BIO_K) { p.sat += dt; if (p.sat > 3500 && !S.holding) { p.N /= 100; p.sat = 0; p.pass = now; } } else p.sat = 0; // serial passage, 1:100
      }
      d.scroll = (d.scroll + dt * 0.0016) % 1e6;
      if (now > d.nextMut) {
        d.nextMut = now + rand(900, 2200) / (1 + (S.holding ? S.stage : 0));
        const i = Math.floor(rand(0, BIO_BP)), b = d.seq[i];
        if (i < d.pam - 3 || i > d.pam + 2 || d.pam < 0) {
          const ts = Math.random() < 2 / 3, nb = ts ? TRANSITION[b] : pick(b === 'A' || b === 'G' ? ['C', 'T'] : ['A', 'G']);
          d.seq[i] = nb; d.flash[i] = now; d.mut++; if (ts) d.ts++; else d.tv++;
          d.lastMut = `${b}→${nb} ${ts ? 'transition' : 'transversion'} at bp ${1200 + i}`;
        }
      }
      if (S.holding && S.stage >= 2 && d.pam < 0) { // Cas9 needs a PAM: find (or plant) 5′-NGG-3′ near the middle
        let best = -1; for (let i = 8; i < BIO_BP - 3; i++) if (d.seq[i + 1] === 'G' && d.seq[i + 2] === 'G' && (best < 0 || Math.abs(i - BIO_BP / 2) < Math.abs(best - BIO_BP / 2))) best = i;
        if (best < 0) { best = Math.floor(BIO_BP / 2); d.seq[best + 1] = 'G'; d.seq[best + 2] = 'G'; }
        d.pam = best;
      }
      if (S.holding && S.stage >= 3 && d.cut < 0) d.cut = d.pam - 3;
    },
    three: {
      init(S, X) {
        const THREE = X.THREE, sc = X.scene, d = S.data;
        X.setBloom(0.8, 0.5, 0.8); X.setExposure(1.0);
        X.studioEnvironment();
        sc.background = C(0x040a0c); sc.fog = new THREE.Fog(C(0x040a0c), 80, 190);
        const epoxy = pixTexture(X, 256, 256, (i, j) => { const v = 18 + 8 * fbm(X, i / 30, j / 30, 3, 3); return [v * 0.8, v, v]; }, true); epoxy.repeat.set(6, 6);
        const bench = new THREE.Mesh(new THREE.PlaneGeometry(260, 160), new THREE.MeshStandardMaterial({ map: epoxy, roughness: 0.28, metalness: 0.1, envMapIntensity: 0.25 }));
        bench.rotation.x = -Math.PI / 2; bench.receiveShadow = true; sc.add(bench);
        const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.16, clearcoat: 1, envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false });
        const agarM = new THREE.MeshPhysicalMaterial({ color: C(0xc99a3c), roughness: 0.3, transparent: true, opacity: 0.88, clearcoat: 0.8, emissive: C(0x2a1a04), emissiveIntensity: 0.4, envMapIntensity: 0.4 });
        const padM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.22, 0.25, 0.3) });
        const hemi = new THREE.SphereGeometry(1, 10, 5, 0, TAU, 0, Math.PI / 2);
        d.dishes.forEach((p, k) => { // a light pad, the glass dish and lid, the agar, and the colonies as instanced domes
          const g = new THREE.Group(); g.position.set(p.x, 0, p.z); sc.add(g); p.g = g;
          const pad = new THREE.Mesh(new THREE.CylinderGeometry(p.R * 1.18, p.R * 1.22, 0.4, 48), padM); pad.position.y = 0.2; g.add(pad);
          const prof = [[0, 0], [p.R, 0], [p.R + 0.12, 0.15], [p.R + 0.12, 1.6], [p.R, 1.6], [p.R - 0.02, 0.2], [0, 0.2]].map((q) => new THREE.Vector2(q[0], q[1]));
          const dish = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), glass); dish.position.y = 0.42; dish.renderOrder = 9; g.add(dish);
          const lid = new THREE.Mesh(new THREE.LatheGeometry([[0, 1.9], [p.R + 0.35, 1.9], [p.R + 0.45, 1.75], [p.R + 0.45, 0.9], [p.R + 0.33, 0.9], [p.R + 0.33, 1.78], [0, 1.78]].map((q) => new THREE.Vector2(q[0], q[1])), 64), glass);
          lid.renderOrder = 10; if (k === 1) { lid.position.set(p.R * 1.9, 0.1, -p.R * 0.4); lid.rotation.z = 0.12; } else lid.position.y = 0.42; g.add(lid);
          const agar = new THREE.Mesh(new THREE.CylinderGeometry(p.R - 0.05, p.R - 0.05, 0.7, 64), agarM); agar.position.y = 0.42 + 0.55; agar.receiveShadow = true; g.add(agar);
          p.col = new THREE.InstancedMesh(hemi, new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.25, clearcoat: 0.9, emissive: C(0x000000) }), BIO_M);
          const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), Sc = new THREE.Vector3();
          p.dots.forEach((q, i) => { const s = 0.16 + 0.22 * q[2]; M.compose(V.set(q[0], 1.33, q[1]), Q, Sc.set(s, s * 0.55, s)); p.col.setMatrixAt(i, M); });
          p.col.count = 0; p.col.castShadow = true; g.add(p.col);
          const pl = new THREE.PointLight(C(0xbfd8ff), 10, 0, 2); pl.position.set(0, -0.5, 0); g.add(pl);
        });
        // a tube rack with coloured cultures
        const rack = new THREE.Mesh(new THREE.BoxGeometry(18, 2.2, 4), new THREE.MeshStandardMaterial({ color: C(0x2a6a8a), roughness: 0.5 })); rack.position.set(-34, 1.1, -18); rack.castShadow = true; sc.add(rack);
        for (let k = 0; k < 7; k++) {
          const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 12, 20, 1, true), glass); tube.position.set(-42 + k * 2.6, 6, -18); tube.renderOrder = 9; sc.add(tube);
          const liq = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, rand(4, 8), 20), new THREE.MeshPhysicalMaterial({ color: C(pick([0xff3a8a, 0x3aff8a, 0x3ac8ff, 0xffd23a])), roughness: 0.1, transparent: true, opacity: 0.75, emissive: C(0x101010) })); liq.position.set(-42 + k * 2.6, 0.4 + liq.geometry.parameters.height / 2, -18); sc.add(liq);
        }
        // the helix: instanced backbone beads and base-pair rods, coloured per base
        d.hx = { cx: 2, cy: 20, cz: -14, span: 64, R: 2.4 };
        d.bead = new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 14, 10), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.25, clearcoat: 1, emissive: C(0x0a1a1a) }), BIO_BP * 2);
        d.rod = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.22, 1, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, emissive: C(0x101010) }), BIO_BP * 2);
        for (let i = 0; i < BIO_BP * 2; i++) d.bead.setColorAt(i, i % 2 ? C(0xff7ad0) : C(0x6ad8ff));
        d.rod.setColorAt(0, new THREE.Color(1, 1, 1)); d.bead.castShadow = d.rod.castShadow = true; sc.add(d.bead); sc.add(d.rod);
        d.cas = new THREE.Mesh(new THREE.IcosahedronGeometry(3.4, 3), new THREE.MeshPhysicalMaterial({ color: C(0x9a5aff), roughness: 0.2, transparent: true, opacity: 0.32, clearcoat: 1, emissive: C(0x2a0a4a), depthWrite: false }));
        const cp = d.cas.geometry.attributes.position; for (let i = 0; i < cp.count; i++) { const v = new THREE.Vector3(cp.getX(i), cp.getY(i), cp.getZ(i)); v.multiplyScalar(1 + 0.18 * X.noise.noise(v.x * 0.6, v.y * 0.6, v.z * 0.6)); cp.setXYZ(i, v.x, v.y * 0.8, v.z); } d.cas.geometry.computeVertexNormals();
        d.cas.visible = false; d.cas.renderOrder = 11; sc.add(d.cas);
        const key = new THREE.SpotLight(C(0xf2f6ff), 6000, 0, 0.7, 0.8, 2); key.position.set(-30, 60, 30); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.camera.near = 30; key.shadow.camera.far = 140; key.shadow.radius = 4; sc.add(key);
        sc.add(new THREE.HemisphereLight(C(0x5ac8c0), C(0x1a0a20), 0.5));
        const rim = new THREE.PointLight(C(0xc05aff), 1500, 0, 2); rim.position.set(30, 25, -40); sc.add(rim);
        d.spores = particles(X, 500, { additive: true }); sc.add(d.spores.pts);
      },
      update(S, X, now, dt) {
        const d = S.data;
        if (!d.bead) return;
        const THREE = X.THREE, M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), Sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
        const glow = S.holding && S.stage >= 3 ? 1 : 0, ins = d.ins && now - d.ins.t < 60000;
        d.dishes.forEach((p) => {
          const target = Math.floor(BIO_M * p.N / BIO_K);
          if (p.recolor) { p.recolor = false; p.dots.forEach((q, i) => p.col.setColorAt(i, new THREE.Color().setHSL((p.hue + q[2] * 20) / 360, 0.65, 0.45 + q[2] * 0.2).convertSRGBToLinear())); p.col.instanceColor.needsUpdate = true; }
          p.col.count = target;
          p.col.material.emissive.setHSL(p.hue / 360, 1, 0.5).multiplyScalar(0.05 + 0.5 * glow + (ins ? 0.35 : 0));
          if (glow && Math.random() < 0.1) d.spores.emit({ x: p.x + rand(-p.R, p.R) * 0.6, y: 2, z: p.z + rand(-p.R, p.R) * 0.6, vy: rand(1, 3), vx: rand(-0.5, 0.5), life: 2.5, s0: 0.4, s1: 0.2, a: 0.8, c: new THREE.Color().setHSL(p.hue / 360, 1, 0.6).toArray().map((v) => v * 2) });
        });
        // the helix
        const H = d.hx, sp = H.span / BIO_BP, k = TAU / (BIO_TURN * sp), rot = now * 0.0005;
        let ptrX = null;
        if (hasPtr(S)) { const P = X.fromScreen(S.ptr.x, S.ptr.y, H.cz), sc0 = X.toScreen(new THREE.Vector3(P.x, H.cy, H.cz)); if (Math.abs(sc0.y - S.ptr.y) < 70) ptrX = P.x; }
        const cutX = d.cut >= 0 ? H.cx - H.span / 2 + ((d.cut * sp + d.scroll) % H.span) : 1e9;
        for (let i = 0; i < BIO_BP; i++) {
          const u = (i * sp + d.scroll) % H.span, x = H.cx - H.span / 2 + u, ph = k * (u - d.scroll) + rot;
          const edge = smooth(0, sp * 2, u) * smooth(0, sp * 2, H.span - u), sep = ptrX === null ? 0 : Math.exp(-(((x - ptrX) / 5) ** 2)), gap = Math.abs(x - cutX) < sp * 0.6 ? 1 : 0;
          const R = H.R * (1 + sep * 0.9), cy = Math.cos(ph) * R, cz = Math.sin(ph) * R;
          const a = new THREE.Vector3(x, H.cy + cy, H.cz + cz), b = new THREE.Vector3(x, H.cy - cy, H.cz - cz);
          M.compose(a, Q.identity(), Sc.setScalar(edge)); d.bead.setMatrixAt(i * 2, M); M.compose(b, Q, Sc); d.bead.setMatrixAt(i * 2 + 1, M);
          const mid = a.clone().add(b).multiplyScalar(0.5), dirv = b.clone().sub(a), len = dirv.length() / 2, broken = sep > 0.45 || gap ? 0.4 : 1;
          dirv.normalize(); Q.setFromUnitVectors(up, dirv);
          const base = d.seq[i], fl = d.flash[i] && now - d.flash[i] < 700 ? 1 - (now - d.flash[i]) / 700 : 0, isIns = ins && i >= d.ins.i && i < d.ins.i + 8;
          [[a, base], [b, COMP[base]]].forEach(([end, bb], h) => {
            const c = end.clone().lerp(mid, 0.5 * broken); M.compose(c, Q, Sc.set(edge, len * broken * edge, edge)); d.rod.setMatrixAt(i * 2 + h, M);
            const col = isIns ? [0.3, 3, 0.6] : BCOL3[bb].map((v) => v + fl * 4); d.rod.setColorAt(i * 2 + h, new THREE.Color(col[0], col[1], col[2]));
          });
        }
        d.bead.instanceMatrix.needsUpdate = d.rod.instanceMatrix.needsUpdate = d.rod.instanceColor.needsUpdate = true;
        if (d.pam >= 0 && S.holding) { const x = H.cx - H.span / 2 + ((d.pam * sp + d.scroll) % H.span) - 4 * sp; d.cas.visible = true; d.cas.position.set(x, H.cy, H.cz); d.cas.rotation.x += dt * 0.0008; }
        else d.cas.visible = false;
        if (d.cut >= 0 && S.holding) for (let q = 0; q < 2; q++) d.spores.emit({ x: cutX, y: H.cy + rand(-1, 1), z: H.cz + rand(-1, 1), vx: rand(-4, 4), vy: rand(-4, 4), vz: rand(-4, 4), life: 0.6, s0: 0.5, s1: 0.1, a: 1, c: [3, 2.6, 3.4] });
        d.spores.step(dt, X.camera);
        camRig(S, X, { look: [0, 12, 0], r: 74, el: 0.5, sway: 0.18, speed: 0.00006, par: 0.3, parY: 0.1 }, now, dt);
      }
    },
    over(S, ctx) {
      const d = S.data, X = S.three;
      if (!X || !d.dishes[0].g) return;
      ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const p of d.dishes) { const s = X.toScreen(new X.THREE.Vector3(p.x, 0, p.z + p.R + 2.5)); ctx.fillStyle = 'rgba(220,255,240,0.75)'; ctx.fillText(`dish ${p.name} · N ${sci(p.N)}${S.now - p.pass < 1500 ? ' · passaged 1:100' : ''}`, s.x, s.y); }
      if (hasPtr(S)) { // a microscope reticle at the pointer
        const x = S.ptr.x, y = S.ptr.y;
        ctx.strokeStyle = 'rgba(180,255,230,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 40, 0, TAU);
        ctx.moveTo(x - 48, y); ctx.lineTo(x - 30, y); ctx.moveTo(x + 30, y); ctx.lineTo(x + 48, y); ctx.moveTo(x, y - 48); ctx.lineTo(x, y - 30); ctx.moveTo(x, y + 30); ctx.lineTo(x, y + 48); ctx.stroke();
        ctx.fillStyle = 'rgba(180,255,230,0.75)'; ctx.fillRect(x + 14, y + 26, 20, 2); ctx.textAlign = 'left'; ctx.fillText('10 µm', x + 14, y + 36);
      }
    },
    onRelease(S, held, pw) {
      const d = S.data;
      if (d.cut >= 0) { // splice: insert a fluorescent reporter at the cut, plate the new strain
        d.ins = { i: d.cut, t: S.now };
        d.dishes.forEach((p) => { p.hue = 115 + rand(-10, 10); p.N = 1e7; p.pass = S.now; p.recolor = true; });
      }
      if (d.spores) d.dishes.forEach((p) => { for (let k = 0; k < 40 * pw; k++) d.spores.emit({ x: p.x, y: 1.5, z: p.z, vx: rand(-4, 4), vy: rand(2, 7), vz: rand(-4, 4), g: -3, life: rand(1.2, 2.4), s0: 0.5, s1: 0.25, a: 0.9, c: [0.6, 2.4, 1.0] }); });
      d.pam = -1; d.cut = -1;
      return false;
    },
    hud(S) {
      const d = S.data, A = d.dishes[0];
      if (S.holding) return [`incubator ×${(d.speed / 0.25).toFixed(0)} · dish A at ${sci(A.N)} cells · growth slows as N → K`,
        `${d.mut} mutations so far · ${d.ts} transitions : ${d.tv} transversions (expect ≈ 2:1)`,
        'Cas9 locked on 5′-NGG-3′ · its 20-nt guide RNA base-pairs with the target',
        `double-strand break 3 bp upstream of the PAM (bp ${1200 + d.cut}) · let go to splice`][S.stage];
      if (d.ins && S.now - d.ins.t < 5000) return 'spliced: a reporter gene inserted · new strain plated · watch it glow';
      return `dN/dt = rN(1 − N/K) · r = ln2 h⁻¹ (t_d = 60 min) · A ${sci(A.N)} / K 10⁹ · t = ${d.tH.toFixed(1)} h · ${d.lastMut || 'no mutations yet'}`;
    }
  });

  /* ======================= 7. ATOMPUNK ======================= */
  // The radon-222 chain, solved live (Bateman, stepped with exact exponential decay per nuclide):
  // ²²²Rn (3.82 d, α) → ²¹⁸Po (3.10 min, α) → ²¹⁴Pb (26.8 min, β⁻) → ²¹⁴Bi (19.9 min, β⁻) → ²¹⁴Po (164 µs, α) → ²¹⁰Pb (22.2 y).
  // Alpha track lengths follow Geiger's rule for air, R ≈ 0.318·E^1.5 cm (E in MeV).
  const RNC = [
    { s: '²²²Rn', t: '3.82 d', T: 3.8235 * 86400, m: 'α', E: 5.49 },
    { s: '²¹⁸Po', t: '3.10 min', T: 3.098 * 60, m: 'α', E: 6.0 },
    { s: '²¹⁴Pb', t: '26.8 min', T: 26.8 * 60, m: 'β⁻' },
    { s: '²¹⁴Bi', t: '19.9 min', T: 19.9 * 60, m: 'β⁻' },
    { s: '²¹⁴Po', t: '164 µs', T: 164.3e-6, m: 'α', E: 7.69 },
    { s: '²¹⁰Pb', t: '22.2 y', T: 22.2 * 365.25 * 86400, m: 'β⁻' }
  ];
  RNC.forEach((n) => (n.lam = Math.LN2 / n.T));
  function rnStep(N, dts) {
    while (dts > 0) {
      const h = Math.min(dts, 15); dts -= h;
      const dec = [0, 1, 2, 3].map((i) => N[i] * (1 - Math.exp(-RNC[i].lam * h)));
      N[0] -= dec[0]; N[1] += dec[0] - dec[1]; N[2] += dec[1] - dec[2]; N[3] += dec[2] - dec[3]; N[5] += dec[3];
      N[4] = N[3] * RNC[3].lam / RNC[4].lam; // 164 µs: Po-214 is always in equilibrium with its parent
    }
  }
  function atRocket3(X, s) { // a lathed chrome rocket: ogive nose, cylindrical body, boat-tail, three swept fins, a porthole
    const THREE = X.THREE, g = new THREE.Group(), prof = [];
    const pts = [[0, 0], [0.9, 0.15], [1.15, 0.6], [1.2, 3.2], [1.15, 5.2], [1.0, 6.6], [0.78, 7.6], [0.5, 8.4], [0.22, 8.9], [0.02, 9.2]];
    pts.forEach((p) => prof.push(new THREE.Vector2(p[0] * s, (p[1] - 4.6) * s)));
    const chrome = new THREE.MeshStandardMaterial({ color: C(0xe8edf2), metalness: 1, roughness: 0.08, envMapIntensity: 1.3 });
    const red = new THREE.MeshPhysicalMaterial({ color: C(0xc42a22), metalness: 0.1, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 });
    const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), chrome); g.add(body);
    const nose = new THREE.Mesh(new THREE.LatheGeometry(pts.slice(6).map((p) => new THREE.Vector2(p[0] * s * 1.01, (p[1] - 4.6) * s)), 40), red); g.add(nose);
    const fs = new THREE.Shape(); fs.moveTo(0, 0); fs.lineTo(1.9 * s, -1.2 * s); fs.lineTo(2.1 * s, -2.4 * s); fs.lineTo(0, -1.6 * s); fs.lineTo(0, 0);
    const fg = new THREE.ExtrudeGeometry(fs, { depth: 0.12 * s, bevelEnabled: true, bevelThickness: 0.05 * s, bevelSize: 0.05 * s, bevelSegments: 2 }); fg.translate(1.05 * s, -1.6 * s, -0.06 * s);
    for (let k = 0; k < 3; k++) { const f = new THREE.Mesh(fg, red); f.rotation.y = k * TAU / 3; g.add(f); }
    const port = new THREE.Mesh(new THREE.TorusGeometry(0.42 * s, 0.09 * s, 10, 28), chrome); port.position.set(0, 1.6 * s, 1.17 * s); g.add(port);
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.38 * s, 20, 12), new THREE.MeshPhysicalMaterial({ color: C(0x2a5a8a), roughness: 0.05, clearcoat: 1, emissive: C(0x0a2a4a), emissiveIntensity: 0.8 })); glass.scale.z = 0.35; glass.position.copy(port.position); g.add(glass);
    const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.55 * s, 0.75 * s, 0.6 * s, 24, 1, true), new THREE.MeshStandardMaterial({ color: C(0x2a2c30), metalness: 0.8, roughness: 0.4, side: THREE.DoubleSide })); noz.position.y = -4.75 * s; g.add(noz);
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture(X), color: new THREE.Color(5, 2.2, 0.7), blending: THREE.AdditiveBlending, depthWrite: false })); flame.position.y = -5.8 * s; flame.scale.set(1.8 * s, 3.4 * s, 1); g.add(flame);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return { g, flame, s };
  }
  function atStarTex(X) {
    return X.canvasTexture(128, 128, (x) => {
      x.fillStyle = '#fff'; x.translate(64, 64);
      [[60, 5], [26, 3]].forEach(([r, w], i) => { x.rotate(i * Math.PI / 4); x.beginPath(); x.moveTo(0, -r); x.lineTo(w, -w); x.lineTo(r, 0); x.lineTo(w, w); x.lineTo(0, r); x.lineTo(-w, w); x.lineTo(-r, 0); x.lineTo(-w, -w); x.closePath(); x.fill(); });
    });
  }
  addMode({
    id: 'pk_atom', name: 'ATOMPUNK', glyphs: G('⚛☢αβγνπψ⁺⁻∞', 'αβγνπψ+-'),
    base: [45, 60, 90], palette: [[175, 75, 58], [22, 95, 62], [340, 80, 72], [210, 100, 68]],
    links: ['constellation', 'pk_track', 'arc', 'plasma'], count: 96, noHueShift: true, pageBg: ['#08262c', '#05070f'],
    shapes: ['atom', 'sphere', 'torus', 'cell24', 'lissajous', 'icosahedron', 'buckyball', 'tesseract'],
    init(S) {
      const N = [2000 / RNC[0].lam, 0, 0, 0, 0, 0];
      rnStep(N, 3 * 3600); // the room has been sealed for three hours
      Object.assign(S.data, { N, warp: 120, tracks: [], clickAcc: 0, trackAcc: 0, lamp: -1e9, needle: 0, launch: null });
    },
    update(S, now, dt) {
      const d = S.data, N = d.N;
      // radon: the source emanates more while held; ventilation brings it back to 2 kBq afterwards
      const Atar = S.holding ? [5000, 10000, 18000, 30000][S.stage] : 2000;
      N[0] += (Atar / RNC[0].lam - N[0]) * ease(dt, S.holding ? 1500 : 9000);
      d.warp += ((S.holding ? [300, 800, 2000, 4000][S.stage] : 120) - d.warp) * ease(dt, 500);
      rnStep(N, d.warp * dt / 1000);
      d.A = N.map((n, i) => n * RNC[i].lam);
      d.cpm = 0.03 * 60 * (d.A[2] + d.A[3]); // a GM tube that sees 3% of the betas
      d.needle += (clamp((Math.log10(Math.max(10, d.cpm)) - 1) / 4, 0, 1) - d.needle) * ease(dt, 350);
      d.clickAcc += Math.min(40, d.cpm / 60 / 20) * dt / 1000; // the lamp: one flash per 20 counts
      if (d.clickAcc > 1 || Math.random() < d.clickAcc) { d.clickAcc = Math.max(0, d.clickAcc - 1); d.lamp = now; }
      const Atot = d.A[0] + d.A[1] + d.A[2] + d.A[3] + d.A[4];
      d.trackAcc += Math.min(30, Atot / 900) * dt / 1000;
      while (d.trackAcc > 1) { d.trackAcc -= 1; atTrack(S); }
      d.tracks = d.tracks.filter((t) => now - t.t < 1600);
    },
    three: {
      init(S, X) {
        const THREE = X.THREE, sc = X.scene, d = S.data;
        X.setBloom(0.85, 0.5, 0.8); X.setExposure(1.05);
        X.studioEnvironment();
        const bg = X.canvasTexture(16, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#04070e'); g.addColorStop(0.5, '#0a2a33'); g.addColorStop(1, '#06151c'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
        sc.background = bg;
        d.stars = particles(X, 1800, { additive: true, order: 1 }); sc.add(d.stars.pts);
        for (let i = 0; i < 1800; i++) { const v = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(400, 700)); const w = Math.pow(Math.random(), 4); d.stars.emit({ x: v.x, y: v.y, z: v.z, life: 0, s0: 1.2 + 3 * w, a: 0.5 + 0.5 * w, c: pick([[1, 0.9, 0.75], [0.8, 0.9, 1], [1, 1, 1]]) }); }
        // a banded, ringed planet, very 1950s
        const band = X.canvasTexture(512, 256, (x, w, h) => { for (let j = 0; j < h; j++) { const t = j / h, v = Math.sin(t * 40 + Math.sin(t * 9) * 3); x.fillStyle = `rgb(${210 + 40 * v | 0},${130 + 50 * v | 0},${80 + 30 * v | 0})`; x.fillRect(0, j, w, 1); } });
        const planet = new THREE.Mesh(new THREE.SphereGeometry(48, 64, 32), new THREE.MeshStandardMaterial({ map: band, roughness: 0.8 })); planet.position.set(-260, 120, -520); planet.rotation.z = 0.35; sc.add(planet);
        const ringT = X.canvasTexture(256, 4, (x, w) => { for (let i = 0; i < w; i++) { const t = i / w, a = (0.35 + 0.5 * Math.abs(Math.sin(t * 31))) * (t > 0.08 && t < 0.95 ? 1 : 0) * (Math.abs(t - 0.55) < 0.03 ? 0.1 : 1); x.fillStyle = `rgba(255,${200 + 40 * Math.sin(t * 13) | 0},160,${a})`; x.fillRect(i, 0, 1, 4); } });
        const rg = new THREE.RingGeometry(64, 110, 128, 1), uv = rg.attributes.uv, pp = rg.attributes.position;
        for (let i = 0; i < uv.count; i++) { const r = Math.hypot(pp.getX(i), pp.getY(i)); uv.setXY(i, (r - 64) / 46, 0.5); }
        const ring = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ map: ringT, transparent: true, side: THREE.DoubleSide, roughness: 0.9, depthWrite: false }));
        ring.position.copy(planet.position); ring.rotation.set(-1.25, 0.25, 0.4); sc.add(ring);
        const sun = new THREE.DirectionalLight(C(0xfff0dc), 3.2); sun.position.set(120, 80, 120); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 20, far: 400 }); sc.add(sun);
        sc.add(new THREE.HemisphereLight(C(0x6ac8c8), C(0x2a1830), 0.7));
        // the Bohr atom around the letters: a glossy nucleus, three orbits, racing electrons
        const prot = new THREE.MeshPhysicalMaterial({ color: C(0xd8452e), roughness: 0.25, clearcoat: 1 }), neut = new THREE.MeshPhysicalMaterial({ color: C(0xe9dfc4), roughness: 0.3, clearcoat: 1 });
        d.nucleus = new THREE.Group(); sc.add(d.nucleus);
        for (let i = 0; i < 22; i++) { const v = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(Math.cbrt(i / 22) * 3.2); const b = new THREE.Mesh(new THREE.SphereGeometry(1.45, 24, 16), i % 2 ? prot : neut); b.position.copy(v); b.castShadow = true; d.nucleus.add(b); }
        d.orbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.82, 0.62) });
        d.orbits = [0, 1, 2].map((k) => {
          const g = new THREE.Group(); g.rotation.set(Math.PI / 2 + 0.25, k * Math.PI / 3, 0); sc.add(g);
          const t = new THREE.Mesh(new THREE.TorusGeometry(26, 0.14, 8, 160), d.orbMat); t.scale.y = 0.38; g.add(t);
          const e = new THREE.Mesh(new THREE.SphereGeometry(0.9, 20, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 3.2, 4.5) })); g.add(e);
          const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture(X), color: new THREE.Color(0.5, 1.6, 2.4), blending: THREE.AdditiveBlending, depthWrite: false })); gl.scale.setScalar(6); e.add(gl);
          return { g, e, ph: k * 2.1 };
        });
        d.cher = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture(X), color: new THREE.Color(0, 0, 0), blending: THREE.AdditiveBlending, depthWrite: false })); d.cher.scale.setScalar(70); sc.add(d.cher);
        // retro sparkles, chrome rockets circling, exhaust
        const st = atStarTex(X); d.spark = [];
        for (let k = 0; k < 12; k++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: st, color: new THREE.Color(1.4, 1.3, 1.0), blending: THREE.AdditiveBlending, depthWrite: false })); sp.position.set(rand(-160, 160), rand(-90, 90), rand(-260, -120)); sp.userData.ph = rand(0, TAU); sp.userData.s = rand(5, 12); sc.add(sp); d.spark.push(sp); }
        d.rockets = [atRocket3(X, 1.6), atRocket3(X, 1.1)];
        d.rockets.forEach((r, i) => { r.orb = { R: i ? 46 : 60, tilt: i ? -0.5 : 0.35, sp: i ? -0.16 : 0.11, a: i * 2.5 }; sc.add(r.g); });
        d.big = atRocket3(X, 3.2); d.big.g.visible = false; sc.add(d.big.g);
        d.exh = particles(X, 900, { additive: true }); sc.add(d.exh.pts);
      },
      update(S, X, now, dt) {
        const d = S.data;
        if (!d.orbits) return;
        const THREE = X.THREE, T = now / 1000, s = dt / 1000, p = power(S), cher = S.holding && S.stage >= 3 ? 1 : 0;
        d.nucleus.rotation.y += s * 0.3; d.nucleus.rotation.x += s * 0.11;
        d.orbits.forEach((o, k) => { o.ph += s * (1.4 + k * 0.3) * (1 + p * 2.5); o.e.position.set(Math.cos(o.ph) * 26, Math.sin(o.ph) * 26 * 0.38, 0); o.g.rotation.z += s * 0.05; });
        d.orbMat.color.setRGB(lerp(0.9, 0.4, cher), lerp(0.82, 1.0, cher), lerp(0.62, 2.6, cher));
        d.cher.material.color.setRGB(0.05 * cher, 0.18 * cher, 0.6 * cher * (0.85 + 0.15 * Math.sin(T * 6)));
        d.spark.forEach((sp) => { const k = 0.6 + 0.4 * Math.sin(T * 1.7 + sp.userData.ph); sp.scale.setScalar(sp.userData.s * k); });
        const tmp = new THREE.Vector3(), fwd = new THREE.Vector3(0, 1, 0);
        d.rockets.forEach((r) => {
          const o = r.orb; o.a += o.sp * s * (1 + p);
          const P = (a) => new THREE.Vector3(Math.cos(a) * o.R, Math.sin(a) * o.R * Math.sin(o.tilt), Math.sin(a) * o.R * Math.cos(o.tilt) - 10);
          const pos = P(o.a), nxt = P(o.a + Math.sign(o.sp) * 0.05);
          r.g.position.copy(pos); r.g.quaternion.setFromUnitVectors(fwd, tmp.copy(nxt).sub(pos).normalize());
          r.flame.scale.set(1.8 * r.s * (0.9 + rand(0, 0.2)), 3.4 * r.s * (0.85 + rand(0, 0.3)), 1);
          if (Math.random() < 0.7) { const back = tmp.copy(pos).sub(nxt).normalize(); const q = pos.clone().addScaledVector(back, 6 * r.s); d.exh.emit({ x: q.x, y: q.y, z: q.z, vx: back.x * 8, vy: back.y * 8, vz: back.z * 8, life: rand(0.5, 0.9), s0: 1.2 * r.s, s1: 3 * r.s, a: 0.5, c: [1.6, 0.8, 0.35] }); }
        });
        const L = d.launch; // liftoff: a big rocket climbs past the atom on a pillar of fire
        if (L) {
          const t = (now - L.t) / 1000, B = d.big;
          if (t > 4) { d.launch = null; B.g.visible = false; } else {
            B.g.visible = true; B.g.position.set(-18 + Math.sin(t * 2) * 0.6, -70 + 9 * t * t, 12); B.g.rotation.set(0, t * 0.6, 0);
            B.flame.scale.set(6 * (0.9 + rand(0, 0.2)), 14 * (0.9 + rand(0, 0.3)), 1);
            for (let k = 0; k < 6; k++) d.exh.emit({ x: B.g.position.x + rand(-1.5, 1.5), y: B.g.position.y - 18, z: 12 + rand(-1.5, 1.5), vx: rand(-4, 4), vy: rand(-26, -12), vz: rand(-4, 4), life: rand(0.8, 1.6), s0: 3, s1: rand(10, 18), a: 0.45, c: pick([[1.8, 1, 0.45], [1.4, 1.2, 1], [1.8, 0.6, 0.25]]), drag: 0.97 });
          }
        }
        d.exh.step(dt, X.camera); d.stars.step(dt, X.camera);
        camRig(S, X, { look: [0, 0, 0], r: 74, el: 0.12, sway: 0.18, speed: 0.00006, par: 0.4, parY: 0.15, bob: 0.03 }, now, dt);
      }
    },
    drawNode(S, ctx, n, g, size, a) {
      ctx.font = `${size.toFixed(1)}px monospace`; ctx.fillStyle = n.inf ? S.colorOf(n.gen, a) : `rgba(250,240,215,${a * 0.9})`; ctx.fillText(g, n.sx, n.sy);
      return true;
    },
    under(S, ctx, now) { // cloud-chamber tracks: alphas short, straight and fat; betas long, thin and wandering
      const d = S.data;
      ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (const t of d.tracks) {
        const u = (now - t.t) / 1600, a = (1 - u) * (u < 0.05 ? u / 0.05 : 1);
        ctx.beginPath(); t.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        if (t.alpha) { ctx.lineWidth = 4 + u * 4; ctx.strokeStyle = `rgba(200,230,255,${0.14 * a})`; ctx.stroke(); ctx.lineWidth = 1.5; ctx.strokeStyle = `rgba(255,255,255,${0.6 * a})`; ctx.stroke(); }
        else { ctx.lineWidth = 0.9; ctx.strokeStyle = `rgba(220,240,255,${0.5 * a})`; ctx.stroke(); }
        if (t.label && u < 0.6) { ctx.font = '9px monospace'; ctx.textAlign = 'left'; ctx.fillStyle = `rgba(255,240,200,${0.6 * a})`; ctx.fillText(t.label, t.pts[0][0] + 5, t.pts[0][1] - 5); }
      }
      ctx.globalCompositeOperation = 'source-over';
    },
    over(S, ctx, now) { if (S.data.A) atPanels(S, ctx, now); },
    onRelease(S, held, pw) { S.data.launch = { t: S.now }; kick(S, 0.35 * pw); return false; },
    hud(S) {
      const d = S.data;
      if (!d.A) return '';
      const cpm = fmt(d.cpm), w = fmt(d.warp);
      if (S.holding) return [`radon rising · A(²²²Rn) = ${fmt(d.A[0])} Bq · A = λN, λ = ln2 / t½`,
        `daughters catching up: ²¹⁴Pb ${fmt(d.A[2])} Bq · ²¹⁴Bi ${fmt(d.A[3])} Bq · ${cpm} cpm · time ×${w}`,
        'ingrowth → secular equilibrium: every daughter\'s activity → A(²²²Rn)',
        `${cpm} cpm · Cherenkov blue: charged particles outrunning light in water (v > c/n)`][S.stage];
      if (d.launch) return 'liftoff · 1950s optimism, ballistically speaking';
      return `²²²Rn →α ²¹⁸Po →α ²¹⁴Pb →β⁻ ²¹⁴Bi →β⁻ ²¹⁴Po →α ²¹⁰Pb · ${cpm} cpm · time ×${w}`;
    }
  });
  function atTrack(S) {
    const d = S.data, A = d.A, w = [A[0], A[1], A[2], A[3], A[4]], tot = w.reduce((a, b) => a + b, 0);
    if (!(tot > 0) || d.tracks.length > 110) return;
    let u = Math.random() * tot, i = 0; while (i < 4 && u > w[i]) { u -= w[i]; i++; }
    const pool = S.holding ? S.active.filter((n) => n.inf) : S.active, n = pool.length ? pick(pool) : null;
    const x = n ? n.sx : rand(0, S.W), y = n ? n.sy : rand(0, S.H), nuc = RNC[i], pts = [[x, y]];
    let a = rand(0, TAU);
    if (nuc.m === 'α') { const len = 0.318 * Math.pow(nuc.E, 1.5) * 9; for (let k = 1; k <= 6; k++) { a += k > 4 ? rand(-0.15, 0.15) : 0; pts.push([pts[k - 1][0] + Math.cos(a) * len / 6, pts[k - 1][1] + Math.sin(a) * len / 6]); } }
    else { for (let k = 1; k <= 16; k++) { a += rand(-0.6, 0.6); const s = rand(7, 13); pts.push([pts[k - 1][0] + Math.cos(a) * s, pts[k - 1][1] + Math.sin(a) * s]); } }
    d.tracks.push({ pts, t: S.now, alpha: nuc.m === 'α', label: Math.random() < 0.2 ? `${nuc.m} ${nuc.s}${nuc.E ? ' ' + nuc.E + ' MeV' : ''}` : '' });
  }
  function atPanels(S, ctx, now) {
    const d = S.data;
    // survey meter, top right
    const gw = 236, gh = 128, gx = S.W - gw - 16, gy = 92;
    blit(ctx, layer(S, 'meter', gw, gh, (x, w, h) => {
      x.fillStyle = '#e9dfc4'; x.beginPath(); if (x.roundRect) x.roundRect(0, 0, w, h, 14); else x.rect(0, 0, w, h); x.fill();
      x.fillStyle = '#2b8a86'; x.fillRect(0, h - 26, w, 12);
      x.fillStyle = '#f8f3e2'; x.beginPath(); x.ellipse(w * 0.42, h * 0.62, w * 0.36, h * 0.48, 0, Math.PI, TAU); x.fill(); x.strokeStyle = '#3a3a3a'; x.lineWidth = 1.5; x.stroke();
      x.strokeStyle = '#222'; x.fillStyle = '#222'; x.font = '9px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
      ['10', '100', '1k', '10k', '100k'].forEach((l, i) => { const a = Math.PI + (i / 4) * Math.PI, r0 = w * 0.3, X = w * 0.42, Y = h * 0.62; x.beginPath(); x.moveTo(X + Math.cos(a) * r0, Y + Math.sin(a) * r0 * (h * 0.48) / (w * 0.36)); x.lineTo(X + Math.cos(a) * r0 * 1.12, Y + Math.sin(a) * r0 * 1.12 * (h * 0.48) / (w * 0.36)); x.stroke(); x.fillText(l, X + Math.cos(a) * r0 * 0.8, Y + Math.sin(a) * r0 * 0.8 * (h * 0.48) / (w * 0.36)); });
      x.fillText('CPM', w * 0.42, h * 0.5);
      x.fillStyle = '#f8f3e2'; x.font = '8px monospace'; x.fillText('RADIATION SURVEY METER · MODEL 57', w / 2, h - 20);
      x.fillStyle = '#555'; x.beginPath(); x.arc(w * 0.88, h * 0.32, 9, 0, TAU); x.fill(); x.fillStyle = '#888'; x.beginPath(); x.arc(w * 0.88, h * 0.32, 4, 0, TAU); x.fill();
      x.fillStyle = '#333'; x.beginPath(); x.arc(w * 0.88, h * 0.62, 6, 0, TAU); x.fill();
    }), gx, gy);
    const X = gx + gw * 0.42, Y = gy + gh * 0.62, na = Math.PI + clamp(d.needle, 0, 1) * Math.PI;
    ctx.strokeStyle = '#b02010'; ctx.lineWidth = 1.5; S.line(X, Y, X + Math.cos(na) * gw * 0.32, Y + Math.sin(na) * gh * 0.44);
    const lit = now - d.lamp < 60 ? 1 : 0.15;
    ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, '255,90,40', gx + gw * 0.88, gy + gh * 0.62, 14, lit); ctx.globalCompositeOperation = 'source-over';
    ctx.font = '9px monospace'; ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,240,210,0.6)'; ctx.fillText(`lamp: 1 flash per 20 counts · ${fmt(d.cpm)} cpm`, gx + gw, gy + gh + 10);
    // decay chain: activity bars, log scale 10 Bq .. 100 kBq, with the parent's level dashed (secular equilibrium)
    const cw = Math.min(360, S.W * 0.3), ch = 132, cx = S.W - cw - 16, cy = S.H - ch - 48, tw = cw / 6;
    blit(ctx, layer(S, 'chain', cw, ch, (x, w, h) => {
      panel(x, 0, 0, w, h, 0.7, 'rgba(255,230,180,0.3)');
      x.font = '10px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
      RNC.forEach((n, i) => {
        x.fillStyle = 'rgba(255,240,210,0.9)'; x.fillText(n.s, tw * (i + 0.5), 14); x.fillStyle = 'rgba(160,230,220,0.8)'; x.font = '9px monospace'; x.fillText(n.t, tw * (i + 0.5), 27);
        if (i < 5) { x.fillStyle = 'rgba(255,170,110,0.9)'; x.fillText(`${n.m}→`, tw * (i + 1), 40); }
        x.font = '10px monospace'; x.strokeStyle = 'rgba(255,240,210,0.15)'; x.strokeRect(tw * i + 6.5, 50.5, tw - 13, h - 64);
      });
      x.font = '8px monospace'; x.fillStyle = 'rgba(255,240,210,0.5)'; x.fillText('activity A = λN (log) · dashed: A(²²²Rn)', w / 2, h - 7);
    }), cx, cy);
    const by = cy + 51, bh = ch - 66, lg = (v) => clamp((Math.log10(Math.max(1, v)) - 1) / 4, 0, 1);
    RNC.forEach((n, i) => {
      const v = lg(d.A[i]);
      ctx.fillStyle = i === 0 ? 'rgba(255,150,80,0.85)' : n.m === 'α' ? 'rgba(120,235,215,0.85)' : 'rgba(255,120,160,0.85)';
      ctx.fillRect(cx + tw * i + 9, by + bh * (1 - v), tw - 18, bh * v);
    });
    const ey = by + bh * (1 - lg(d.A[0]));
    ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(255,200,140,0.7)'; ctx.lineWidth = 1; S.line(cx + 6, ey, cx + tw * 5 - 6, ey); ctx.setLineDash([]);
  }


})(window.SPHERE);
