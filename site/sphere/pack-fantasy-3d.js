/* The Sphere: high fantasy & tabletop pack. Six short scenes: a volcanic ring forge, a tabletop d20, a dragon's hoard,
 * a starlit forest, a spellbook and a graveyard. All names, scripts and symbols are invented here; everything is procedural.
 * Each scene hides a real idea: blackbody colour of hot metal, the central limit theorem, the angle of repose and compound
 * interest, phyllotaxis and the golden angle, star polygons and the Taylor–Sedov blast wave, and radioactive half-life.
 * Every scene is a lit three.js scene (via sphere-3d.js) built from procedural models and textures; the letters and their
 * webs are drawn in 3D. Own web style: fa_3d. */
(function (SP) {
  'use strict';
  if (!SP) return;
  const { TAU, GOLDEN, rand, pick, clamp } = SP.util;
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  const fmt = (v, d) => Number(v).toLocaleString('en-US', { maximumFractionDigits: d || 0, minimumFractionDigits: d || 0 });
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  const sci = (v) => { if (v < 1e6) return fmt(v); const e = Math.floor(Math.log10(v)), m = v / Math.pow(10, e); return m.toFixed(1) + '×10' + String(e).split('').map((d) => SUP[+d]).join(''); };
  const PV0 = { x: 0, y: 0 };
  const pvel = (S) => S.ptrVel || PV0;
  const pspeed = (S) => { const v = pvel(S); return Math.hypot(v.x, v.y); };
  const power = (S) => (S.holding ? clamp(S.held / S.STAGES[3], 0, 1) : 0);

  // Every hook is guarded (a throw inside one would otherwise spam the console or break input handlers) and timed:
  // SPHERE.faPerf.acc holds the milliseconds this pack spent since the last reset.
  const PERF = SP.faPerf = { acc: 0 };
  const guard = (obj, id) => Object.keys(obj).forEach((k) => {
    const f = obj[k];
    if (typeof f !== 'function') return;
    let warned = false;
    obj[k] = function () {
      const t0 = performance.now();
      try { return f.apply(this, arguments); } catch (err) { if (!warned) { warned = true; console.error('[pack-fantasy] ' + id + '.' + k, err); } return k === 'drawNode' ? true : undefined; } finally { PERF.acc += performance.now() - t0; }
    };
  });
  const addMode = (def) => { guard(def, def.id); if (def.three) guard(def.three, def.id + '.three'); SP.addMode(def); };

  /* ---------- glyph availability: keep only symbols the local fonts can actually draw ---------- */
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
        gc = mk(40, 40); gx = gc.getContext('2d', { willReadFrequently: true });
        gx.font = '26px monospace'; gx.textAlign = 'center'; gx.textBaseline = 'middle'; gx.fillStyle = '#fff';
        ['￿', '͸', '\u{10FFFD}', '\u{E0FFF}', '\u{2FFFF}'].forEach((r) => refSigs.push(sig(r)));
      }
      const s = sig(ch);
      return !!s && refSigs.indexOf(s) < 0;
    } catch (e) { return true; }
  }
  const G = (str, fallback) => { const ok = Array.from(str).filter(renders); return ok.length >= 4 ? ok.join('') : fallback; };



  /* ---------- deterministic randomness and invented scripts ---------- */
  function prng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
  // Stroke vocabulary for invented alphabets. Points live in a unit box.
  const STROKES = {
    stem: (r) => { const x = 0.25 + r() * 0.5, sl = (r() - 0.5) * 0.3; return { pts: [[x - sl, 0.06], [x + sl, 0.94]] }; },
    bar: (r) => { const y = 0.18 + r() * 0.64; return { pts: [[0.1, y], [0.9, y + (r() - 0.5) * 0.24]] }; },
    chev: (r) => { const y = 0.15 + r() * 0.5, d = (r() < 0.5 ? 1 : -1) * 0.28; return { pts: [[0.12, y], [0.5, y + d], [0.88, y]] }; },
    jag: (r) => { const x = 0.15 + r() * 0.25; return { pts: [[x, 0.08], [x + 0.35, 0.34], [x + 0.08, 0.58], [x + 0.45, 0.92]] }; },
    hook: (r) => { const x = 0.3 + r() * 0.35, s = r() < 0.5 ? 1 : -1; return { pts: [[x, 0.06], [x + 0.3 * s, 0.38], [x - 0.05 * s, 0.72], [x - 0.3 * s, 0.9]], smooth: true }; },
    arc: (r) => { const cx = 0.35 + r() * 0.3, cy = 0.35 + r() * 0.3, rr = 0.2 + r() * 0.16, a0 = r() * TAU, sp = Math.PI * (0.8 + r() * 0.9), pts = []; for (let i = 0; i <= 8; i++) { const a = a0 + sp * i / 8; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } return { pts, smooth: true }; },
    loop: (r) => { const cx = 0.3 + r() * 0.4, cy = 0.22 + r() * 0.56, rr = 0.1 + r() * 0.07, pts = []; for (let i = 0; i <= 10; i++) { const a = i / 10 * TAU; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } return { pts, smooth: true }; },
    tail: (r) => { const y = 0.55 + r() * 0.3; return { pts: [[0.06, y], [0.38, y + 0.14], [0.68, y - 0.06], [0.96, y - 0.3]], smooth: true }; },
    dot: (r) => ({ dot: [0.2 + r() * 0.6, r() < 0.5 ? 0.04 + r() * 0.08 : 0.9] })
  };
  const STYLES = { forge: ['stem', 'stem', 'bar', 'chev', 'jag', 'dot'], leaf: ['arc', 'hook', 'loop', 'tail', 'arc', 'dot'], bone: ['stem', 'jag', 'chev', 'bar', 'loop', 'dot'] };
  function makeScript(seed, n, style) {
    const r = prng(seed), kinds = STYLES[style], out = [];
    for (let i = 0; i < n; i++) {
      const k = 2 + Math.floor(r() * 2.4), g = [];
      for (let j = 0; j < k; j++) { let kind = kinds[Math.floor(r() * kinds.length)]; if (j === 0 && kind === 'dot') kind = kinds[0]; g.push(STROKES[kind](r)); }
      out.push(g);
    }
    return out;
  }
  function tracePath(x, g, o, s) {
    x.beginPath();
    for (const st of g) {
      if (st.dot) continue;
      const p = st.pts;
      x.moveTo(o + p[0][0] * s, o + p[0][1] * s);
      if (st.smooth && p.length > 2) {
        for (let i = 1; i < p.length - 1; i++) x.quadraticCurveTo(o + p[i][0] * s, o + p[i][1] * s, o + (p[i][0] + p[i + 1][0]) / 2 * s, o + (p[i][1] + p[i + 1][1]) / 2 * s);
        x.lineTo(o + p[p.length - 1][0] * s, o + p[p.length - 1][1] * s);
      } else for (let i = 1; i < p.length; i++) x.lineTo(o + p[i][0] * s, o + p[i][1] * s);
    }
  }
  // A glowing glyph sprite: wide faint halo, coloured body, bright core. No shadowBlur.
  function glyphSprite(g, rgb, core, size, halo) {
    const c = mk(size, size), x = c.getContext('2d'), o = size * 0.18, s = size - 2 * o;
    x.lineCap = 'round'; x.lineJoin = 'round';
    const passes = [[0.17, 0.1 * halo, rgb], [0.1, 0.35 * halo, rgb], [0.06, 1, rgb], [0.028, 1, core]];
    for (const [w, a, col] of passes) { if (a <= 0) continue; x.lineWidth = size * w; x.strokeStyle = `rgba(${col},${a})`; tracePath(x, g, o, s); x.stroke(); }
    for (const st of g) if (st.dot) for (const [w, a, col] of passes) { if (a <= 0) continue; x.fillStyle = `rgba(${col},${a})`; x.beginPath(); x.arc(o + st.dot[0] * s, o + st.dot[1] * s, size * w * 0.75, 0, TAU); x.fill(); }
    return c;
  }
  const spriteCache = {};
  function scriptSprite(key, script, i, rgb, core, halo, size) {
    const k = key + '|' + i + '|' + rgb + '|' + core + '|' + halo;
    return spriteCache[k] || (spriteCache[k] = glyphSprite(script[i % script.length], rgb, core, size || 72, halo === undefined ? 1 : halo));
  }
  const glyphIndex = (g) => Math.max(0, (g.charCodeAt(0) || 65) - 65);
  const SCRIPT_GLYPHS = 'ABCDEFGHIJKLMNOP'; // stand-ins: drawNode swaps each letter for an invented glyph sprite
  function drawSprite(ctx, spr, x, y, size, a) { ctx.globalAlpha = clamp(a, 0, 1); ctx.drawImage(spr, x - size / 2, y - size / 2, size, size); ctx.globalAlpha = 1; }

  /* ---------- blackbody colour of hot metal ---------- */
  // Planck's law sampled at three wavelengths (610, 550, 465 nm) and normalised to red at 1000 °C. Brightness is
  // compressed like perception (Stevens' power law, ~L^0.38) and very bright light saturates toward white, like an eye
  // or a camera does. The result: invisible below the Draper point (~525 °C), then dull red, cherry, orange, yellow, white.
  const C2 = 14388; // second radiation constant hc/k, in µm·K
  const planck = (lum, T) => Math.pow(lum, -5) / (Math.exp(C2 / (lum * T)) - 1);
  const P0 = planck(0.61, 1273.15);
  function hotRGB(Tc) {
    const T = Math.max(300, Tc + 273.15), R = planck(0.61, T) / P0, Gc = planck(0.55, T) / P0, B = planck(0.465, T) / P0;
    const k = 1.6 * Math.pow(R, -0.62), w = clamp((Math.log10(R) - 0.9) / 1.4, 0, 1);
    const f = (v) => Math.round(255 * lerp(1 - Math.exp(-k * v), 1, w));
    return [f(R), f(Gc), f(B)];
  }
  const HEAT_NAMES = [[525, 'black heat'], [620, 'faint red: the Draper point'], [720, 'dull red'], [820, 'cherry red'], [920, 'bright cherry'], [1020, 'orange'], [1120, 'yellow-orange'], [1220, 'yellow'], [1320, 'light yellow'], [1420, 'white heat'], [1e9, 'welding white']];
  const heatName = (T) => { for (const h of HEAT_NAMES) if (T < h[0]) return h[1]; return ''; };

  function hsl2rgb(h, s, l) {
    s /= 100; l /= 100; h = ((h % 360) + 360) % 360;
    const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
  }
  const rgbS = (c) => c[0] + ',' + c[1] + ',' + c[2];
  const L8 = (v) => Math.pow(v / 255, 2.2); // sRGB byte → linear
  const linRGB = (c, k) => [L8(c[0]) * (k || 1), L8(c[1]) * (k || 1), L8(c[2]) * (k || 1)];
  const palLin = (S, gen, k) => { const p = S.mode.palette[gen % S.mode.palette.length]; return linRGB(hsl2rgb(p[0], p[1], p[2]), k); };
  // Visible brightness of a blackbody relative to 1000 °C (Planck at 610 nm), log-compressed to 0..1 from the Draper point up.
  const glowOf = (Tc) => clamp(Math.log10(Math.max(1e-9, planck(0.61, Tc + 273.15) / P0)) / 3 + 0.85, 0, 1.6);

  /* ---------- the 3D toolkit (three.js r128 via SPHERE's 3D layer) ---------- */
  const PT_VS = [
    'attribute float aSize; attribute vec3 aColor; attribute float aGlyph; uniform float uScale;',
    'varying vec3 vColor; varying float vGlyph;',
    'void main(){ vColor = aColor; vGlyph = aGlyph; vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  gl_PointSize = min(512.0, aSize * uScale / max(0.05, -mv.z)); gl_Position = projectionMatrix * mv; }'
  ].join('\n');
  const PT_FS_GLYPH = [
    'uniform sampler2D map; uniform float cols; varying vec3 vColor; varying float vGlyph;',
    'void main(){ float c = mod(vGlyph, cols), r = floor(vGlyph / cols + 0.001);',
    '  vec2 uv = vec2((c + gl_PointCoord.x) / cols, 1.0 - (r + gl_PointCoord.y) / cols);',
    '  vec4 t = texture2D(map, uv); if (t.a < 0.01) discard; gl_FragColor = vec4(vColor * t.rgb * t.a, 1.0); }'
  ].join('\n');
  const PT_FS_ADD = 'varying vec3 vColor; void main(){ vec2 d = gl_PointCoord - 0.5; float a = exp(-dot(d, d) * 16.0); gl_FragColor = vec4(vColor * a, 1.0); }';
  const PT_FS_SMOKE = 'uniform float uOp; varying vec3 vColor; void main(){ vec2 d = gl_PointCoord - 0.5; float r2 = dot(d, d); float a = exp(-r2 * 14.0) * (0.75 + 0.25 * sin(gl_PointCoord.x * 11.0 + vColor.r * 40.0) * sin(gl_PointCoord.y * 9.0 - vColor.g * 30.0)) * uOp; gl_FragColor = vec4(vColor, a * vGlyph); }\n'.replace('varying vec3 vColor;', 'varying vec3 vColor; varying float vGlyph;');
  const ptScale = (X) => X.renderer.domElement.height / (2 * Math.tan(X.camera.fov * Math.PI / 360));
  // A batch of billboard points: glyphs from an atlas, additive glows or soft smoke. One draw call.
  function pointBatch(X, max, kind, atlas, cols) {
    const T = X.THREE, g = new T.BufferGeometry();
    const pos = new Float32Array(max * 3), col = new Float32Array(max * 3), size = new Float32Array(max), gl = new Float32Array(max);
    g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aColor', new T.BufferAttribute(col, 3));
    g.setAttribute('aSize', new T.BufferAttribute(size, 1)); g.setAttribute('aGlyph', new T.BufferAttribute(gl, 1));
    const smoke = kind === 'smoke';
    const m = new T.ShaderMaterial({
      uniforms: { map: { value: atlas || null }, cols: { value: cols || 4 }, uScale: { value: 500 }, uOp: { value: 1 } },
      vertexShader: PT_VS, fragmentShader: kind === 'glyph' ? PT_FS_GLYPH : smoke ? PT_FS_SMOKE : PT_FS_ADD,
      transparent: true, depthWrite: false, blending: smoke ? T.NormalBlending : T.AdditiveBlending
    });
    const pts = new T.Points(g, m); pts.frustumCulled = false; pts.renderOrder = smoke ? 2 : 3; X.scene.add(pts);
    return {
      pts, pos, col, size, gl, max, n: 0, mat: m,
      set(i, x, y, z, r, gg, b, s, glyph) { const k = i * 3; pos[k] = x; pos[k + 1] = y; pos[k + 2] = z; col[k] = r; col[k + 1] = gg; col[k + 2] = b; size[i] = s; gl[i] = glyph || 0; },
      sync() {
        const a = g.attributes; a.position.needsUpdate = a.aColor.needsUpdate = a.aSize.needsUpdate = a.aGlyph.needsUpdate = true;
        g.setDrawRange(0, this.n); m.uniforms.uScale.value = ptScale(X);
      }
    };
  }
  // Simple particle physics on top of a point batch. Each particle: {x,y,z,vx,vy,vz,t,life,s,c:[r,g,b] linear, drag, g, T?}
  function particles(X, max, kind) {
    const B = pointBatch(X, max, kind), list = [];
    return {
      B, list,
      add(o) { if (list.length < max) list.push(o); return o; },
      step(now, dt, hook) {
        const k = dt / 1000; let j = 0;
        for (let i = 0; i < list.length; i++) {
          const p = list[i]; if (now - p.t > p.life) continue;
          const dr = Math.pow(p.drag || 0.5, k); p.vx *= dr; p.vy *= dr; p.vz *= dr; p.vy -= (p.g || 0) * k;
          p.x += p.vx * k; p.y += p.vy * k; p.z += p.vz * k;
          if (hook) hook(p, k);
          list[j++] = p;
        }
        list.length = j;
        let n = 0;
        for (const p of list) {
          const age = (now - p.t) / p.life, a = kind === 'smoke' ? Math.sin(Math.PI * Math.min(1, age)) : 1 - age;
          let c = p.c;
          if (p.T !== undefined) { const h = hotRGB(p.T), gl = glowOf(p.T); c = linRGB(h, (p.k || 3) * gl * gl); }
          B.set(n++, p.x, p.y, p.z, c[0] * (kind === 'smoke' ? 1 : a), c[1] * (kind === 'smoke' ? 1 : a), c[2] * (kind === 'smoke' ? 1 : a), p.s * (p.grow ? 1 + age * p.grow : 1), kind === 'smoke' ? a * (p.a || 1) : 0);
        }
        B.n = n; B.sync();
      }
    };
  }
  // Glyph atlases: invented scripts (white, with a soft halo) or plain characters.
  function scriptAtlas(X, script) {
    return X.canvasTexture(512, 512, (x) => { for (let i = 0; i < 16; i++) x.drawImage(glyphSprite(script[i % script.length], '255,255,255', '255,255,255', 128, 0.9), (i % 4) * 128, Math.floor(i / 4) * 128); });
  }
  function charAtlas(X, chars, font, cols) {
    const cs = 128;
    return X.canvasTexture(cs * cols, cs * cols, (x) => {
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = font;
      Array.from(chars).forEach((ch, i) => {
        const cx = (i % cols) * cs + cs / 2, cy = Math.floor(i / cols) * cs + cs / 2;
        x.fillStyle = 'rgba(255,255,255,0.12)'; x.beginPath(); x.arc(cx, cy, cs * 0.42, 0, TAU); x.fill();
        x.fillStyle = '#fff'; x.fillText(ch, cx, cy + 4);
      });
    });
  }
  // The letters, drawn in 3D at their rotated unit positions. colorOf(n) → linear [r,g,b]; place(n, v) may move v.
  const V3 = { x: 0, y: 0, z: 0 };
  function drawLetters(S, B, c, scale, colorOf, sizeOf, glyphOf, place) {
    let i = 0;
    for (const n of S.active) {
      if (i >= B.max) break;
      V3.x = c[0] + n.rx * scale; V3.y = c[1] - n.ry * scale; V3.z = c[2] + n.rz * scale;
      if (place) place(n, V3);
      const p = n.data.p3 || (n.data.p3 = [0, 0, 0]); p[0] = V3.x; p[1] = V3.y; p[2] = V3.z;
      const col = colorOf(n), a = clamp(n.alpha, 0, 1);
      B.set(i++, V3.x, V3.y, V3.z, col[0] * a, col[1] * a, col[2] * a, sizeOf(n), glyphOf(n));
    }
    B.n = i; B.sync();
  }
  // The infection webs as additive 3D lines between the letters.
  function linkLines(X, max) {
    const T = X.THREE, g = new T.BufferGeometry(), pos = new Float32Array(max * 6), col = new Float32Array(max * 6);
    g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3));
    const m = new T.LineBasicMaterial({ vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false });
    const L = new T.LineSegments(g, m); L.frustumCulled = false; L.renderOrder = 3; X.scene.add(L);
    return {
      L, update(S, colorOf, bend) {
        let i = 0;
        for (const l of S.links) {
          if (i >= max) break;
          const a = l.A.data.p3, b = l.B.data.p3; if (!a || !b) continue;
          const al = (l.dying ? 1 - (S.now - l.dying) / 700 : 1) * Math.min(l.A.alpha, l.B.alpha); if (al <= 0.01) continue;
          const gr = clamp((S.now - l.born) / 220, 0, 1), c = colorOf(l.gen), k = i * 6;
          pos[k] = a[0]; pos[k + 1] = a[1]; pos[k + 2] = a[2];
          pos[k + 3] = lerp(a[0], b[0], gr); pos[k + 4] = lerp(a[1], b[1], gr) + (bend || 0) * gr * (1 - gr); pos[k + 5] = lerp(a[2], b[2], gr);
          col[k] = c[0] * al * 0.6; col[k + 1] = c[1] * al * 0.6; col[k + 2] = c[2] * al * 0.6; col[k + 3] = c[0] * al; col[k + 4] = c[1] * al; col[k + 5] = c[2] * al;
          i++;
        }
        g.attributes.position.needsUpdate = g.attributes.color.needsUpdate = true; g.setDrawRange(0, i * 2);
      }
    };
  }
  // A slow cinematic orbit with pointer parallax. o: {t:[x,y,z], r, el, az, speed, px, py}
  function camOrbit(S, X, D, o) {
    const tx = S.ptrInside ? S.ptr.x / S.W - 0.5 : 0, ty = S.ptrInside ? S.ptr.y / S.H - 0.5 : 0, k = S.reduceMotion ? 0.3 : 1;
    D.cpx = lerp(D.cpx || 0, tx, 0.03); D.cpy = lerp(D.cpy || 0, ty, 0.03);
    const az = (o.az || 0) + Math.sin(S.now * (o.speed || 0.00004)) * (o.sweep || 0.35) * k + D.cpx * (o.px || 0.5), el = o.el - D.cpy * (o.py || 0.2);
    const r = o.r * (1 - (o.dolly || 0) * power(S));
    X.camera.position.set(o.t[0] + Math.sin(az) * Math.cos(el) * r, o.t[1] + Math.sin(el) * r, o.t[2] + Math.cos(az) * Math.cos(el) * r);
    X.camera.lookAt(o.t[0], o.t[1], o.t[2]);
  }

  /* ---------- shaders shared by the scenes: noise, molten metal, heat haze, cinematic exposure flashes ---------- */
  const NOISE3 = [
    'float hh3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }',
    'float vn3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(mix(hh3(i), hh3(i + vec3(1,0,0)), f.x), mix(hh3(i + vec3(0,1,0)), hh3(i + vec3(1,1,0)), f.x), f.y), mix(mix(hh3(i + vec3(0,0,1)), hh3(i + vec3(1,0,1)), f.x), mix(hh3(i + vec3(0,1,1)), hh3(i + vec3(1,1,1)), f.x), f.y), f.z); }'
  ].join('\n');
  // Liquid metal: two octaves of noise flowing along the stream, mapped from a cooler crust colour to the hot core.
  function moltenMat(X, hot, cool, flow) {
    const T = X.THREE;
    return new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uHot: { value: new T.Vector3(...hot) }, uCool: { value: new T.Vector3(...cool) }, uFlow: { value: flow || 5 } },
      vertexShader: 'varying vec2 vUv; varying vec3 vP; void main(){ vUv = uv; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: ['uniform float uTime, uFlow; uniform vec3 uHot, uCool; varying vec2 vUv; varying vec3 vP;', NOISE3,
        'void main(){ float n = vn3(vec3(vP.x * 18.0, vUv.y * 9.0 - uTime * uFlow, vP.z * 18.0)) * 0.6 + vn3(vec3(vP.x * 40.0, vUv.y * 22.0 - uTime * uFlow * 1.8, vP.z * 40.0)) * 0.4;',
        '  gl_FragColor = vec4(mix(uCool, uHot, smoothstep(0.25, 0.85, n)), 1.0); }'].join('\n')
    });
  }
  // Heat haze: a post pass that refracts the image around a hot point, rising like convection.
  const HAZE_FS = [
    'uniform sampler2D tDiffuse; uniform float uTime, uAmt, uR, uAspect; uniform vec2 uC; varying vec2 vUv;',
    'void main(){ vec2 d = (vUv - uC) * vec2(uAspect, 1.0); float m = uAmt * smoothstep(uR, 0.0, length(d)) * (0.6 + 0.4 * smoothstep(-0.1, 0.25, d.y));',
    '  vec2 off = vec2(sin(vUv.y * 90.0 - uTime * 7.0 + sin(vUv.x * 37.0 + uTime)), cos(vUv.x * 75.0 + uTime * 5.0 + vUv.y * 20.0)) * 0.0032 * m;',
    '  gl_FragColor = texture2D(tDiffuse, vUv + off); }'
  ].join('\n');
  function addHaze(X) {
    const T = X.THREE; if (!X.composer || !T.ShaderPass) return null;
    const p = new T.ShaderPass({ uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAmt: { value: 0 }, uC: { value: new T.Vector2(0.5, 0.5) }, uR: { value: 0.3 }, uAspect: { value: 1 } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: HAZE_FS });
    p.uniforms.uC.value = new T.Vector2(0.5, 0.5);
    X.composer.insertPass(p, 1); p.enabled = false; return p;
  }
  function setHaze(S, X, pass, world, amt, r) {
    if (!pass) return;
    const s = X.toScreen(world), u = pass.uniforms, a = S.reduceMotion ? amt * 0.3 : amt;
    u.uTime.value = S.now / 1000; u.uAmt.value = a; u.uC.value.set(s.x / S.W, 1 - s.y / S.H); u.uR.value = r; u.uAspect.value = S.W / Math.max(1, S.H);
    pass.enabled = a > 0.02 && !s.behind;
  }
  // A volumetric light shaft: an open cone, brightest along its axis and toward the lamp, with dust drifting through it.
  function beamMat(X, col, k) {
    const T = X.THREE;
    return new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uInt: { value: k || 1 }, uCol: { value: new T.Vector3(...col) } },
      vertexShader: 'varying vec3 vN, vV, vP; void main(){ vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalMatrix * normal; gl_Position = projectionMatrix * mv; }',
      fragmentShader: ['uniform float uTime, uInt; uniform vec3 uCol; varying vec3 vN, vV, vP;', NOISE3,
        'void main(){ float e = pow(abs(dot(normalize(vN), normalize(vV))), 2.0); float h = clamp(vP.y + 0.5, 0.0, 1.0);',
        '  float dust = 0.7 + 0.3 * vn3(vP * 6.0 + vec3(0.0, uTime * 0.15, uTime * 0.05)) + 0.5 * smoothstep(0.93, 1.0, vn3(vP * 40.0 + uTime * 0.2));',
        '  gl_FragColor = vec4(uCol * e * (0.25 + 0.75 * h) * dust * 0.05 * uInt, 1.0); }'].join('\n'),
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide
    });
  }
  // A candle flame: a teardrop that sways, white-yellow at the core, orange at the rim, blue at the root.
  const FLAME_VS = 'uniform float uTime, uPh; varying vec3 vN, vV; varying float vY; void main(){ vec3 p = position; vY = p.y / 0.15; p.x += sin(uTime * 9.0 + uPh + vY * 4.0) * 0.006 * vY; p.z += cos(uTime * 7.0 + uPh) * 0.004 * vY; vec4 mv = modelViewMatrix * vec4(p, 1.0); vV = -mv.xyz; vN = normalMatrix * normal; gl_Position = projectionMatrix * mv; }';
  const FLAME_FS = 'varying vec3 vN, vV; varying float vY; void main(){ float e = abs(dot(normalize(vN), normalize(vV))); vec3 c = mix(vec3(2.6, 0.7, 0.12), vec3(7.0, 4.8, 2.2), pow(e, 1.5)); c = mix(vec3(0.3, 0.5, 2.0), c, smoothstep(0.05, 0.3, vY)); gl_FragColor = vec4(c * smoothstep(0.0, 0.25, e), 1.0); }';
  // A cinematic exposure flash: a fast rise and an exponential fall, the way a bright event blows out a film camera.
  function cineFlash(S, D, amt) { if (!S.reduceMotion) D.cf = { t: S.now, a: amt }; }
  function setExpo(X, e) { X.baseExpo = e; X.setExposure(e); }
  function applyFlash(S, X, D) {
    const f = D.cf, base = X.baseExpo || 1; let e = base;
    if (f) { const t = (S.now - f.t) / 1000; e = base * (1 + f.a * Math.exp(-t * 4.5) * Math.min(1, t / 0.05)); if (t > 2) D.cf = null; }
    X.setExposure(e);
  }
  // Pointer pixels → the world point on the horizontal plane y = h.
  function rayToY(S, X, px, py, h) {
    const T = X.THREE, v = new T.Vector3(px / S.W * 2 - 1, -(py / S.H) * 2 + 1, 0.5).unproject(X.camera), d = v.sub(X.camera.position).normalize();
    const t = (h - X.camera.position.y) / (d.y || -1e-6);
    return X.camera.position.clone().add(d.multiplyScalar(t > 0 ? t : 10));
  }
  /* procedural textures */
  function noiseFill(x, w, h, base, amt, n, seed, sz) {
    x.fillStyle = base; x.fillRect(0, 0, w, h); const r = prng(seed || 1);
    for (let i = 0; i < n; i++) { const v = r(); x.fillStyle = v < 0.5 ? `rgba(0,0,0,${amt * r()})` : `rgba(255,255,255,${amt * 0.6 * r()})`; const s = (sz || 3) * (0.3 + r() * 1.7); x.fillRect(r() * w, r() * h, s, s); }
  }
  function woodTex(X, base, dark, seed, w, h) {
    return X.canvasTexture(w || 512, h || 512, (x, W, H) => {
      x.fillStyle = base; x.fillRect(0, 0, W, H); const r = prng(seed || 3);
      for (let i = 0; i < 160; i++) { const y0 = r() * H, a = 0.05 + r() * 0.12; x.strokeStyle = `rgba(${dark},${a})`; x.lineWidth = 0.5 + r() * 2.5; x.beginPath(); for (let px = 0; px <= W; px += 16) x.lineTo(px, y0 + Math.sin(px * 0.01 + i) * 6 + Math.sin(px * 0.043 + i * 3) * 2); x.stroke(); }
      for (let i = 0; i < 6; i++) { const cx = r() * W, cy = r() * H; for (let k = 1; k < 7; k++) { x.strokeStyle = `rgba(${dark},0.12)`; x.lineWidth = 1; x.beginPath(); x.ellipse(cx, cy, k * 5, k * 2, 0, 0, TAU); x.stroke(); } }
    });
  }
  const repeatTex = (t, T, rx, ry) => { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx, ry); return t; };
  const std = (T, o) => new T.MeshStandardMaterial(Object.assign({ envMapIntensity: 0.18 }, o)); // dim the studio IBL on everything but metals


  // Shared bits of every mode: the 2D layer stays quiet (the webs and letters live in 3D), with a plain fallback if WebGL is missing.
  SP.addLink('fa_3d', (ctx, L, S) => { if (!S.three) S.line(L.ax, L.ay, L.bx, L.by); });
  const LINKS3D = ['fa_3d', 'fa_3d', 'fa_3d', 'fa_3d'];
  function fallbackNode(S, ctx, n, g, size, a) {
    if (S.three) return true;
    ctx.font = `${size.toFixed(1)}px Georgia, serif`; ctx.fillStyle = n.inf ? S.colorOf(n.gen, a) : S.baseColor(a); ctx.fillText(g, n.sx, n.sy);
    return true;
  }
  // Keep each letter's 2D screen position on its 3D twin (one frame behind), so pointer picking, the 2D wireframe and rings line up.
  function follow3D(S, n) {
    const X = S.three, p = n.data.p3; if (!X || !p) return;
    const v = X._fv || (X._fv = new X.THREE.Vector3()); v.set(p[0], p[1], p[2]).project(X.camera);
    if (v.z < 1) { n.sx = (v.x + 1) / 2 * S.W; n.sy = (1 - v.y) / 2 * S.H; }
  }
  const quiet = { drawNode: fallbackNode, warp: follow3D, onClimax(S) { cineFlash(S, S.data, 0.3); return false; } };

  /* ======================= 1. RING FORGE ======================= */
  const FORGE_SCRIPT = makeScript(0xF04CE, 16, 'forge');
  const FIRE_SCRIPT = makeScript(0x1A7E5, 14, 'leaf'); // the flowing fire-letters that surface on the ring
  const FORGE_KEYS = [[0, 330], [1200, 700], [2500, 1064], [4500, 1290], [7000, 1380]]; // held ms → target °C
  function forgeTarget(held, idle) {
    if (held <= 0) return idle;
    for (let i = 1; i < FORGE_KEYS.length; i++) { const a = FORGE_KEYS[i - 1], b = FORGE_KEYS[i]; if (held < b[0]) return Math.max(idle, lerp(a[1], b[1], (held - a[0]) / (b[0] - a[0]))); }
    return FORGE_KEYS[FORGE_KEYS.length - 1][1];
  }
  const RING_C = [0, 2.45, 0];
  function anvilGeometry(T) {
    const s = new T.Shape();
    s.moveTo(-0.42, 0); s.lineTo(0.6, 0); s.lineTo(0.55, 0.12); s.lineTo(0.34, 0.28); s.lineTo(0.4, 0.6);
    s.lineTo(0.72, 0.66); s.lineTo(0.72, 0.88); s.lineTo(-0.42, 0.88);
    s.quadraticCurveTo(-0.85, 0.88, -1.22, 0.82); s.quadraticCurveTo(-0.8, 0.7, -0.42, 0.64);
    s.lineTo(-0.26, 0.58); s.lineTo(-0.2, 0.28); s.lineTo(-0.38, 0.12); s.closePath();
    const g = new T.ExtrudeGeometry(s, { depth: 0.34, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.025, bevelSegments: 3, curveSegments: 24 });
    g.translate(0, 0, -0.17); return g;
  }
  function inscriptionTexture(X, shown, order) {
    const tex = X.canvasTexture(2048, 256, (x) => {
      const N = 30;
      for (let i = 0; i < N; i++) {
        if (order[i] >= shown) continue;
        const spr = scriptSprite('insc', FIRE_SCRIPT, (i * 7) % FIRE_SCRIPT.length, '255,150,60', '255,245,210', 1.1, 96), px = (i + 0.5) * 2048 / N - 48;
        x.drawImage(spr, px, -48); x.drawImage(spr, px, 256 - 48); // the tube's outer face sits on the texture's top and bottom edges
      }
    });
    tex.wrapS = X.THREE.RepeatWrapping; return tex;
  }
  addMode(Object.assign({}, quiet, {
    id: 'fa_forge', name: 'RING FORGE', glyphs: SCRIPT_GLYPHS,
    base: [25, 20, 55], palette: [[20, 100, 55], [35, 100, 58], [48, 100, 64], [55, 100, 80]],
    links: LINKS3D, count: 90, noHueShift: true, pageBg: ['#0d0604', '#1c0803'],
    shapes: ['torus', 'torus_knot', 'sphere', 'crown', 'trefoil', 'cinquefoil', 'helix', 'clifford_torus'],
    init(S) { Object.assign(S.data, { T: 330, bellows: 0, pour: 0, reveal: 0, shown: 0, order: Array.from({ length: 30 }, (_, i) => i).sort(() => Math.random() - 0.5), quench: null, emberAcc: 0, stamp: 0 }); },
    update(S, now, dt) {
      const D = S.data, k = dt / 1000;
      D.bellows = Math.max(0, D.bellows * Math.pow(0.6, k) + Math.min(30, pspeed(S)) * k * 14); // swiping works the bellows
      const idle = 330 + Math.min(330, D.bellows * 3);
      if (D.quench) { // Newton's law of cooling, slowed by a vapour film above the Leidenfrost point
        const kq = D.T > 260 ? 0.55 : 2.4;
        D.T = 22 + (D.T - 22) * Math.exp(-kq * k);
        if (D.T < idle + 5 || S.holding) D.quench = null;
      } else D.T += (forgeTarget(S.held, idle) - D.T) * (1 - Math.exp(-k * (S.holding ? 3.2 : 1.2)));
      D.pour = clamp(D.pour + (S.holding && D.T > 1064 ? 1 : -1.6) * k * 1.4, 0, 1);
      if (S.holding && D.T > 1064 && !D.melted) { D.melted = true; cineFlash(S, D, 0.35); } else if (D.T < 1000) D.melted = false; // the moment the gold goes liquid
      const rv = D.T > 1180 ? 1 : D.T < 950 ? -1 : 0; // the script surfaces only in fire
      D.reveal = clamp(D.reveal + rv * k * (rv > 0 ? 0.55 : 0.8), 0, 1);
    },
    three: {
      init(S, X) {
        const T = X.THREE, sc = X.scene, D = S.data;
        X.maxPixelRatio = 1.25; X.setBloom(0.7, 0.5, 0.86); setExpo(X, 0.9); X.studioEnvironment();
        sc.background = new T.Color(0x070403); sc.fog = new T.FogExp2(0x070403, 0.055);
        const floorT = repeatTex(X.canvasTexture(1024, 1024, (x, w, h) => { // flagstones
          x.fillStyle = '#1c1814'; x.fillRect(0, 0, w, h); const r = prng(8);
          for (let j = 0; j < 6; j++) for (let i = -1; i < 6; i++) { const sx = i * w / 6 + (j % 2) * w / 12, sy = j * h / 6, c = 34 + r() * 16; x.fillStyle = `rgb(${c},${c * 0.88},${c * 0.78})`; x.fillRect(sx + 3, sy + 3, w / 6 - 6 - r() * 6, h / 6 - 6 - r() * 6); }
          for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,240,220'},${r() * 0.12})`; x.fillRect(r() * w, r() * h, 2, 2); }
        }), T, 9, 9);
        const floor = new T.Mesh(new T.PlaneGeometry(40, 40), std(T, { map: floorT, roughness: 0.92 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; sc.add(floor);
        const steel = std(T, { color: 0x3a3c40, metalness: 0.85, roughness: 0.42, envMapIntensity: 0.35, map: X.canvasTexture(256, 256, (x, w, h) => noiseFill(x, w, h, '#8a8d92', 0.25, 4000, 5, 2)) });
        const anvil = new T.Mesh(anvilGeometry(T), steel); anvil.position.set(0.1, 0.62, 0); anvil.castShadow = anvil.receiveShadow = true; sc.add(anvil);
        const stump = new T.Mesh(new T.CylinderGeometry(0.5, 0.6, 0.62, 40), std(T, { map: woodTex(X, '#3b2414', '20,10,4', 4), roughness: 0.85 })); stump.position.y = 0.31; stump.castShadow = stump.receiveShadow = true; sc.add(stump);
        // the hearth: brick, a hood, and a bed of glowing coals
        const brickT = X.canvasTexture(512, 512, (x, w, h) => { x.fillStyle = '#1a0f0b'; x.fillRect(0, 0, w, h); const r = prng(6); for (let j = 0; j < 16; j++) for (let i = -1; i < 8; i++) { const c = 70 + r() * 40; x.fillStyle = `rgb(${c},${c * 0.45},${c * 0.32})`; x.fillRect(i * 64 + (j % 2) * 32 + 2, j * 32 + 2, 60, 28); } });
        const hearth = new T.Mesh(new T.BoxGeometry(3.4, 1.1, 1.7), std(T, { map: repeatTex(brickT, T, 2, 1), roughness: 0.95 })); hearth.position.set(0, 0.55, -3.2); hearth.castShadow = hearth.receiveShadow = true; sc.add(hearth);
        const hood = new T.Mesh(new T.CylinderGeometry(0.55, 1.7, 2.2, 4, 1, true), std(T, { color: 0x0c0907, metalness: 0.5, roughness: 0.85, envMapIntensity: 0.05, side: T.DoubleSide, map: X.canvasTexture(256, 256, (x, w, h) => noiseFill(x, w, h, '#2a2420', 0.6, 6000, 14, 4)) })); hood.rotation.y = Math.PI / 4; hood.position.set(0, 3.0, -3.2); sc.add(hood);
        const chim = new T.Mesh(new T.BoxGeometry(0.8, 4, 0.8), std(T, { map: brickT, roughness: 0.95 })); chim.position.set(0, 6, -3.2); sc.add(chim);
        const coalM = std(T, { color: 0x060504, roughness: 0.95, emissive: new T.Color(1, 0.3, 0.05), emissiveIntensity: 0.7, emissiveMap: X.canvasTexture(128, 128, (x, w, h) => { x.fillStyle = '#000'; x.fillRect(0, 0, w, h); const r = prng(9); for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(255,${120 + r() * 80},40,${0.3 + r() * 0.7})`; x.beginPath(); x.arc(r() * w, r() * h, 2 + r() * 9, 0, TAU); x.fill(); } }) });
        const coals = new T.InstancedMesh(new T.DodecahedronGeometry(0.1, 0), coalM, 180), o = new T.Object3D(), r = prng(12);
        for (let i = 0; i < 180; i++) { o.position.set((r() - 0.5) * 2.6, 1.12 + r() * 0.12, -3.2 + (r() - 0.5) * 1.3); o.rotation.set(r() * 6, r() * 6, r() * 6); o.scale.setScalar(0.6 + r() * 0.9); o.updateMatrix(); coals.setMatrixAt(i, o.matrix); }
        sc.add(coals);
        const coalL = new T.PointLight(0xff7a30, 60, 16, 2); coalL.position.set(0, 1.7, -2.9); coalL.castShadow = true; coalL.shadow.mapSize.set(1024, 1024); coalL.shadow.bias = -0.002; sc.add(coalL);
        const rim = new T.SpotLight(0x8aa6ff, 40, 30, 0.5, 0.8, 2); rim.position.set(-5, 6, -4); rim.target.position.set(0, 2, 0); sc.add(rim); sc.add(rim.target);
        sc.add(new T.HemisphereLight(0x30384a, 0x1a0c06, 0.12));
        // the ring: polished gold, glowing with its own blackbody colour when hot
        const ringM = new T.MeshPhysicalMaterial({ color: new T.Color(1.0, 0.72, 0.32), metalness: 1, roughness: 0.18, envMapIntensity: 0.9, clearcoat: 0.3, emissive: new T.Color(0, 0, 0) });
        // past ~900 °C the surface starts to swim: convection cells in the glow (gold itself melts at 1,064 °C)
        const ringU = { uTime: { value: 0 }, uMolten: { value: 0 } };
        ringM.onBeforeCompile = (sh) => {
          sh.uniforms.uTime = ringU.uTime; sh.uniforms.uMolten = ringU.uMolten;
          sh.vertexShader = 'varying vec3 vObj;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vObj = position;');
          sh.fragmentShader = 'uniform float uTime, uMolten; varying vec3 vObj;\n' + NOISE3 + '\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n { float n = vn3(vObj * 9.0 + vec3(0.0, uTime * 0.8, 0.0)) * 0.65 + vn3(vObj * 23.0 - uTime * 1.3) * 0.35; totalEmissiveRadiance *= mix(1.0, 0.35 + 1.3 * n, uMolten); }');
        };
        const ring = new T.Mesh(new T.TorusGeometry(1.0, 0.1, 48, 220), ringM); ring.castShadow = true; sc.add(ring);
        const inscM = new T.MeshBasicMaterial({ map: inscriptionTexture(X, 0, D.order), transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0 });
        const insc = new T.Mesh(new T.TorusGeometry(1.0, 0.1012, 48, 220), inscM); ring.add(insc);
        const ringL = new T.PointLight(0xff8040, 0, 9, 2); sc.add(ringL);
        // the crucible on chains, and its stream of molten gold
        const cru = new T.Group(); cru.position.set(1.45, 4.25, 0.15); sc.add(cru);
        const prof = [[0, 0], [0.16, 0], [0.23, 0.06], [0.26, 0.42], [0.29, 0.47], [0.26, 0.48], [0.22, 0.1], [0, 0.1]].map((p) => new T.Vector2(p[0], p[1]));
        const pot = new T.Mesh(new T.LatheGeometry(prof, 40), std(T, { color: 0x1c120d, roughness: 0.9, emissive: new T.Color(0.25, 0.05, 0), emissiveIntensity: 0.12 })); pot.position.y = -0.48; pot.castShadow = true; cru.add(pot);
        const meltM = moltenMat(X, [5, 3, 0.8], [1.4, 0.4, 0.05], 0.6), melt = new T.Mesh(new T.CircleGeometry(0.235, 32), meltM); melt.rotation.x = -Math.PI / 2; melt.position.y = -0.08; cru.add(melt);
        const chainM = std(T, { color: 0x222222, metalness: 0.8, roughness: 0.5 });
        for (const sx of [-0.26, 0.26]) { const ch = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 4, 6), chainM); ch.position.set(sx, 2, 0); cru.add(ch); }
        const streamM = moltenMat(X, [7, 4.2, 1.2], [2.2, 0.7, 0.08], 6), stream = new T.Mesh(new T.CylinderGeometry(0.03, 0.022, 1, 16, 12, true), streamM); stream.visible = false; sc.add(stream);
        const haze = addHaze(X);
        const B = pointBatch(X, 260, 'glyph', scriptAtlas(X, FORGE_SCRIPT), 4), Lk = linkLines(X, 260);
        const sparks = particles(X, 900, 'add'), steam = particles(X, 260, 'smoke');
        Object.assign(D, { g: { ring, ringM, ringU, meltM, streamM, haze, insc, inscM, ringL, coalL, coalM, cru, melt, stream, B, Lk, sparks, steam, tmpA: new T.Vector3(), tmpB: new T.Vector3() } });
      },
      update(S, X, now, dt) {
        const D = S.data, G3 = D.g; if (!G3) return; applyFlash(S, X, D);
        const T = X.THREE, k = dt / 1000, Tc = D.T, hc = hotRGB(Tc), gl = glowOf(Tc), hl = linRGB(hc, 1);
        camOrbit(S, X, D, { t: [0, 1.95, 0], r: 6.3, el: 0.2, speed: 0.00005, sweep: 0.55, dolly: 0.2 });
        const ring = G3.ring; ring.position.set(RING_C[0], RING_C[1] + 0.05 * Math.sin(now * 0.0011), RING_C[2]);
        ring.rotation.set(1.25 + 0.12 * Math.sin(now * 0.0004) + (D.cpy || 0) * 0.4, now * 0.00022, 0.1 * Math.sin(now * 0.0003));
        G3.ringU.uTime.value = now / 1000; G3.ringU.uMolten.value = smooth(850, 1250, Tc); G3.meltM.uniforms.uTime.value = G3.streamM.uniforms.uTime.value = now / 1000;
        setHaze(S, X, G3.haze, ring.position, smooth(550, 1300, Tc) * 1.2 + (D.quench ? 0.4 : 0), 0.32);
        const e = gl * gl * 0.55; G3.ringM.emissive.setRGB(hl[0] * e, hl[1] * e, hl[2] * e);
        G3.ringL.position.copy(ring.position); G3.ringL.color.setRGB(hc[0] / 255, hc[1] / 255, Math.max(0.05, hc[2] / 255)); G3.ringL.intensity = 45 * gl * gl;
        const shown = Math.round(D.reveal * 30);
        if (shown !== D.shown) { D.shown = shown; const old = G3.inscM.map; G3.inscM.map = inscriptionTexture(X, shown, D.order); old.dispose(); }
        G3.inscM.opacity = clamp(D.reveal * 1.4, 0, 1); G3.inscM.color.setRGB(3 + 2 * gl, 1.2 + 0.8 * gl, 0.4);
        const fl = 0.8 + 0.2 * Math.sin(now * 0.011) * Math.sin(now * 0.0047) + Math.min(0.6, D.bellows * 0.01);
        G3.coalL.intensity = 55 * fl; G3.coalM.emissiveIntensity = 0.6 * fl;
        // pouring: the crucible tips and molten gold falls onto the ring
        G3.cru.rotation.z = D.pour * 1.05 + 0.04 * Math.sin(now * 0.002);
        if (D.pour > 0.03) {
          const lip = G3.tmpA.set(-0.27, 0, 0); G3.cru.localToWorld(lip);
          const top = G3.tmpB.set(0.35, 1.05, 0).applyEuler(ring.rotation).add(ring.position);
          const dir = top.clone().sub(lip), len = dir.length();
          G3.stream.visible = true; G3.stream.position.copy(lip).addScaledVector(dir, 0.5); G3.stream.scale.set(0.3 + 0.7 * D.pour + 0.1 * Math.sin(now * 0.03), len, 0.3 + 0.7 * D.pour);
          G3.stream.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize());
          if (Math.random() < 0.7) G3.sparks.add({ x: top.x, y: top.y, z: top.z, vx: rand(-1.2, 1.2), vy: rand(0.5, 2.2), vz: rand(-1.2, 1.2), g: 9.8, drag: 0.6, t: now, life: rand(400, 800), s: 0.05, T: 1150, k: 2 });
        } else G3.stream.visible = false;
        // embers off the coals, sparks off the ring when it is hot
        D.emberAcc += k * (6 + D.bellows * 0.4 + (S.holding ? 12 * S.stage : 0));
        while (D.emberAcc > 1) { D.emberAcc--; G3.sparks.add({ x: rand(-1.3, 1.3), y: 1.25, z: -3.2 + rand(-0.6, 0.6), vx: rand(-0.2, 0.2), vy: rand(0.6, 1.8), vz: rand(-0.1, 0.4), g: -0.2, drag: 0.7, t: now, life: rand(1800, 3600), s: 0.04, T: rand(950, 1200), k: 2.5 }); }
        if (S.holding && S.stage >= 2 && !S.reduceMotion && Math.random() < 0.35 * S.stage) { const a = rand(0, TAU), p = new T.Vector3(Math.cos(a), Math.sin(a), 0).applyEuler(ring.rotation).add(ring.position); G3.sparks.add({ x: p.x, y: p.y, z: p.z, vx: rand(-3, 3), vy: rand(0, 4), vz: rand(-3, 3), g: 9.8, drag: 0.5, t: now, life: rand(300, 700), s: 0.035, T: Tc, k: 3 }); }
        if (D.quench && D.T > 100 && Math.random() < clamp((D.T - 100) / 400, 0.1, 1)) { const a = rand(0, TAU), p = new T.Vector3(Math.cos(a), Math.sin(a), 0).applyEuler(ring.rotation).add(ring.position); G3.steam.add({ x: p.x, y: p.y, z: p.z, vx: rand(-0.2, 0.2), vy: rand(0.5, 1.1), vz: rand(-0.2, 0.2), g: -0.1, drag: 0.6, t: now, life: rand(1600, 2800), s: rand(0.2, 0.4), grow: 2.5, c: [0.5, 0.48, 0.46], a: 0.18 }); }
        G3.sparks.step(now, dt, (p, kk) => { if (p.T !== undefined) p.T -= 260 * kk; if (p.y < 0.02) { p.y = 0.02; p.vy = -p.vy * 0.3; } });
        G3.steam.step(now, dt);
        // the letters: invented runes, glowing with the metal's temperature when infected
        const cold = [0.16, 0.11, 0.06], hot = linRGB(hc, 0.6 + 3.2 * gl * gl);
        drawLetters(S, G3.B, [ring.position.x, ring.position.y, ring.position.z], 0.78,
          (n) => (n.inf ? hot : cold), (n) => 0.17 * (0.85 + 0.15 * n.rz), (n) => glyphIndex(n.g) % 16,
          S.holding && S.stage >= 3 && !S.reduceMotion ? (n, v) => { v.y += 0.012 * Math.sin(now * 0.02 + n.rx * 9); } : null);
        G3.Lk.update(S, () => hot);
      }
    },
    onRelease(S, held) {
      const D = S.data;
      if (held < S.STAGES[1] || D.T < 500) return false;
      D.quench = { t: S.now, T0: D.T }; D.stamp++; cineFlash(S, D, 0.45);
      const G3 = D.g;
      if (G3) for (let q = 0; q < (S.reduceMotion ? 14 : 50); q++) { const a = rand(0, TAU), p = G3.ring.position; G3.steam.add({ x: p.x + Math.cos(a) * 1.0, y: p.y + rand(-0.2, 0.2), z: p.z + Math.sin(a) * 1.0, vx: Math.cos(a) * rand(0.5, 2), vy: rand(0.8, 2.4), vz: Math.sin(a) * rand(0.5, 2), g: -0.3, drag: 0.4, t: S.now, life: rand(1800, 3200), s: rand(0.22, 0.45), grow: 3, c: [0.6, 0.58, 0.56], a: 0.22 }); }
      return false;
    },
    hud(S) {
      const D = S.data, T = D.T, K = T + 273.15;
      if (D.quench) return `QUENCH · ${fmt(T)} °C · ${T > 260 ? 'film boiling: a steam jacket insulates it (Leidenfrost)' : T > 100 ? 'nucleate boiling: now it really cools' : 'done'} · T(t) = Tₐ + ΔT·e^(−kt)`;
      if (S.holding) {
        const tag = T >= 1064 ? (D.reveal > 0.5 ? ' · the letters only show while it burns' : ' · gold liquidus 1,064 °C: pour') : '';
        return `${fmt(T)} °C (${fmt(K)} K) · ${heatName(T)} · the colour is Planck's law, not paint${tag}`;
      }
      return `ring at ${fmt(T)} °C: ${heatName(T)} (hot metal starts to glow at the Draper point, ~525 °C) · swipe to work the bellows, hold to heat`;
    }
  }));

  /* ======================= 2. CRITICAL ROLL ======================= */
  const PHI = (1 + Math.sqrt(5)) / 2;
  // A real d20: the 20 faces of an icosahedron, numbered so that opposite faces always sum to 21.
  function d20Geometry(T) {
    const g = new T.IcosahedronGeometry(0.42, 0), P = g.attributes.position, n = P.count / 3, faces = [];
    for (let f = 0; f < n; f++) { const c = new T.Vector3(); for (let v = 0; v < 3; v++) c.add(new T.Vector3().fromBufferAttribute(P, f * 3 + v)); faces.push({ n: c.normalize(), num: 0, opp: -1 }); }
    const r = prng(20), nums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    for (let i = nums.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = nums[i]; nums[i] = nums[j]; nums[j] = t; }
    let pi = 0;
    faces.forEach((f, a) => { if (f.opp >= 0) return; const b = faces.findIndex((h) => h.n.dot(f.n) < -0.999); f.opp = b; faces[b].opp = a; f.num = nums[pi]; faces[b].num = 21 - nums[pi]; pi++; });
    const uv = new Float32Array(P.count * 2), C = [[0.5, 0.94], [0.06, 0.18], [0.94, 0.18]];
    faces.forEach((f, i) => { const cell = f.num - 1, col = cell % 5, row = Math.floor(cell / 5); for (let v = 0; v < 3; v++) { uv[(i * 3 + v) * 2] = (col + C[v][0]) / 5; uv[(i * 3 + v) * 2 + 1] = 1 - (row + 1) / 4 + C[v][1] / 4; } });
    g.setAttribute('uv', new T.BufferAttribute(uv, 2));
    return { g, faces };
  }
  function d20Atlas(X) {
    return X.canvasTexture(1280, 1024, (x) => {
      for (let i = 0; i < 20; i++) {
        const cx = (i % 5) * 256, cy = Math.floor(i / 5) * 256, gr = x.createLinearGradient(cx, cy, cx + 256, cy + 256);
        gr.addColorStop(0, '#7a0f1e'); gr.addColorStop(1, '#4a0612'); x.fillStyle = gr; x.fillRect(cx, cy, 256, 256);
        x.fillStyle = 'rgba(255,255,255,0.05)'; for (let k = 0; k < 40; k++) x.fillRect(cx + Math.random() * 256, cy + Math.random() * 256, 3, 3);
        x.font = 'bold 86px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillStyle = '#e9c77a'; x.fillText(String(i + 1), cx + 128, cy + 150);
        if (i === 5 || i === 8) x.fillRect(cx + 104, cy + 196, 48, 6); // 6 and 9 get an underline, as on real dice
      }
    });
  }
  const PIP_FACE = { 1: [0, 1, 0], 6: [0, -1, 0], 3: [1, 0, 0], 4: [-1, 0, 0], 2: [0, 0, 1], 5: [0, 0, -1] };
  function pipTex(X, f) {
    return X.canvasTexture(128, 128, (x) => {
      x.fillStyle = '#f1ead8'; x.fillRect(0, 0, 128, 128);
      const P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[f];
      x.fillStyle = '#1b1b1b'; for (const p of P) { x.beginPath(); x.arc(64 + p[0] * 34, 64 + p[1] * 34, 12, 0, TAU); x.fill(); }
    });
  }
  const POOL_N = [1, 2, 3, 8];
  function poolExact(n) { // exact distribution of the sum of n d6 by convolution
    let p = [1];
    for (let k = 0; k < n; k++) { const q = new Array(p.length + 6).fill(0); p.forEach((v, i) => { for (let f = 1; f <= 6; f++) q[i + f] += v / 6; }); p = q; }
    return p;
  }
  const D20_IN = 0.42 * 0.7947; // inradius: how high the die rests on a face
  function throwDie(S, X, D, tx, tz, delay) {
    const T = X.THREE, sx = clamp(tx + rand(-1.5, 1.5), -4, 4), d = {
      p: new T.Vector3(sx, 1.4, 2.9), v: new T.Vector3((tx - sx) * 1.1, 2.2, (tz - 2.9) * 1.1), q: new T.Quaternion().setFromEuler(new T.Euler(rand(0, 6), rand(0, 6), rand(0, 6))),
      w: new T.Vector3(rand(-14, 14), rand(-14, 14), rand(-14, 14)), t0: S.now + (delay || 0), res: 1 + Math.floor(Math.random() * 20), done: false, batch: D.batch
    };
    const mesh = new T.Mesh(D.g.d20.g, D.g.d20M); mesh.castShadow = true; mesh.visible = false; X.scene.add(mesh); d.mesh = mesh;
    D.dice.push(d); return d;
  }
  function stepDie(S, D, d, dt) {
    if (S.now < d.t0 || d.done) return;
    const k = Math.min(0.033, dt / 1000), up = D.g.up, p = d.p, v = d.v;
    d.mesh.visible = true;
    v.y -= 9.8 * k; p.addScaledVector(v, k);
    const ground = p.y <= D20_IN + 0.001;
    if (ground) { p.y = D20_IN; if (v.y < -0.7) { v.y = -v.y * 0.32; d.w.multiplyScalar(0.7); } else v.y = 0; const f = Math.exp(-3.6 * k); v.x *= f; v.z *= f; }
    if (Math.abs(p.x) > 4.3 && p.x * v.x > 0) v.x *= -0.5; if (p.z < -2.6 && v.z < 0) v.z *= -0.5; if (p.z > 2.7 && v.z > 0 && S.now - d.t0 > 400) v.z *= -0.5;
    const sp = Math.hypot(v.x, v.z);
    if (ground) d.w.set(v.z / D20_IN, 0, -v.x / D20_IN); // rolling without slipping: ω = ŷ × v / r
    const wl = d.w.length(); if (wl > 1e-4) d.q.premultiply(D.g.tq.setFromAxisAngle(D.g.ta.copy(d.w).divideScalar(wl), wl * k));
    if (ground && sp < 0.45) { // settle on the face that was rolled
      const f = D.g.d20.faces.find((q) => q.num === d.res), m = D.g.tb.copy(f.n).applyQuaternion(d.q), ang = Math.acos(clamp(m.y, -1, 1));
      if (ang > 0.002) { const ax = D.g.ta.crossVectors(m, up); if (ax.lengthSq() < 1e-9) ax.set(1, 0, 0); ax.normalize(); d.q.premultiply(D.g.tq.setFromAxisAngle(ax, ang * Math.min(1, 9 * k))); }
      d.w.multiplyScalar(0.5);
      if (ang < 0.012 && sp < 0.06) { d.done = true; v.set(0, 0, 0); d.doneAt = S.now; dieResult(S, D, d); }
    }
    d.mesh.position.copy(p); d.mesh.quaternion.copy(d.q);
  }
  function dieResult(S, D, d) {
    const live = D.dice.filter((q) => q.batch === d.batch);
    if (live.some((q) => !q.done)) return;
    const vals = live.map((q) => q.res), best = Math.max(...vals);
    D.last = { t: S.now, vals, best, adv: vals.length > 1 };
    D.log.push(best); if (D.log.length > 12) D.log.shift();
    if (best === 20) { D.crit = S.now; D.crits++; cineFlash(S, D, 0.6); const w = live.find((q) => q.res === 20); for (let i = 0; i < (S.reduceMotion ? 20 : 70); i++) { const a = rand(0, TAU), u = rand(0.6, 1); D.g.sparks.add({ x: w.p.x, y: w.p.y + 0.3, z: w.p.z, vx: Math.cos(a) * u * 2, vy: rand(2, 5), vz: Math.sin(a) * u * 2, g: 6, drag: 0.6, t: S.now, life: rand(800, 1600), s: 0.05, c: [3, 2.2, 0.9] }); } }
    else if (best === 1) { D.slump = S.now; D.fumbles++; }
  }
  addMode(Object.assign({}, quiet, {
    id: 'fa_dice', name: 'CRITICAL ROLL', glyphs: () => String(1 + Math.floor(Math.random() * 20)),
    base: [42, 45, 86], palette: [[350, 85, 62], [275, 80, 70], [195, 90, 62], [46, 100, 62]],
    links: LINKS3D, count: 60, pageBg: ['#0b0806', '#020201'],
    shapes: ['sphere', 'icosahedron', 'dodecahedron', 'octahedron', 'cube', 'stella_octangula', 'rhombic_triacontahedron', 'pentakis_dodecahedron'],
    init(S) { Object.assign(S.data, { dice: [], log: [], crits: 0, fumbles: 0, batch: 0, pool: null, last: null }); },
    update(S, now, dt) {
      const D = S.data;
      if (S.holding && S.held > 300) { // the pool: n d6 rolled again and again, summed into a histogram
        const n = POOL_N[S.stage];
        if (!D.pool || D.pool.n !== n) D.pool = { n, hist: new Array(6 * n + 1).fill(0), rolls: 0, s1: 0, s2: 0, acc: 0, exact: poolExact(n), faces: [], dirty: true };
        const P = D.pool; P.acc += dt * 0.32;
        while (P.acc >= 1) { P.acc--; let sum = 0; const faces = []; for (let k = 0; k < n; k++) { const f = 1 + Math.floor(Math.random() * 6); sum += f; faces.push(f); } P.hist[sum]++; P.rolls++; P.s1 += sum; P.s2 += sum * sum; P.faces = faces; }
        P.shown = now;
      }
    },
    three: {
      init(S, X) {
        const T = X.THREE, sc = X.scene, D = S.data;
        X.maxPixelRatio = 1.5; X.setBloom(0.5, 0.45, 0.9); setExpo(X, 1.0); X.studioEnvironment();
        sc.background = new T.Color(0x050403); sc.fog = new T.FogExp2(0x050403, 0.04);
        const felt = repeatTex(X.canvasTexture(512, 512, (x, w, h) => { x.fillStyle = '#0a2a1c'; x.fillRect(0, 0, w, h); const r = prng(2); for (let i = 0; i < 26000; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '120,200,160'},${r() * 0.09})`; x.fillRect(r() * w, r() * h, 1 + r() * 2, 1); } }), T, 6, 4);
        const table = new T.Mesh(new T.PlaneGeometry(10, 6.4), std(T, { map: felt, roughness: 1 })); table.rotation.x = -Math.PI / 2; table.receiveShadow = true; sc.add(table);
        const wood = std(T, { map: woodTex(X, '#4a2a16', '25,10,2', 7), roughness: 0.35, metalness: 0 });
        [[0, -3.35, 10.6, 0.3], [0, 3.35, 10.6, 0.3], [-5.15, 0, 0.3, 6.4], [5.15, 0, 0.3, 6.4]].forEach(([x0, z0, w, d]) => { const b = new T.Mesh(new T.BoxGeometry(w, 0.32, d), wood); b.position.set(x0, 0.12, z0); b.castShadow = b.receiveShadow = true; sc.add(b); });
        const below = new T.Mesh(new T.PlaneGeometry(60, 60), std(T, { color: 0x0a0807, roughness: 1 })); below.rotation.x = -Math.PI / 2; below.position.y = -0.8; sc.add(below);
        // a banker's lamp overhead
        const lamp = new T.SpotLight(0xffd2a0, 800, 20, 0.62, 0.75, 2); lamp.position.set(0, 5.2, 0.3); lamp.target.position.set(0, 0, 0.2); lamp.castShadow = true; lamp.shadow.mapSize.set(2048, 2048); lamp.shadow.camera.near = 2; lamp.shadow.camera.far = 8; lamp.shadow.bias = -0.0004; lamp.shadow.radius = 4; sc.add(lamp); sc.add(lamp.target);
        const shade = new T.Mesh(new T.LatheGeometry([[0.05, 0.5], [0.4, 0.35], [0.9, 0], [0.92, -0.04]].map((p) => new T.Vector2(p[0], p[1])), 48), new T.MeshStandardMaterial({ color: 0x0d3b22, metalness: 0.3, roughness: 0.35, side: T.DoubleSide })); shade.position.set(0, 5.4, 0.3); sc.add(shade);
        const bulb = new T.Mesh(new T.SphereGeometry(0.16, 16, 12), new T.MeshBasicMaterial({ color: new T.Color(6, 4.5, 3) })); bulb.position.set(0, 5.35, 0.3); sc.add(bulb);
        const beamM = beamMat(X, [1.0, 0.8, 0.55], 1), beam = new T.Mesh(new T.CylinderGeometry(0.25, 3.2, 1, 48, 1, true), beamM); beam.scale.set(1, 5.2, 1); beam.position.set(0, 2.7, 0.3); sc.add(beam); // dust in the lamp's cone
        sc.add(new T.HemisphereLight(0x223040, 0x080503, 0.06));
        const d20 = d20Geometry(T), d20M = new T.MeshPhysicalMaterial({ map: d20Atlas(X), roughness: 0.16, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.8, emissive: new T.Color(0, 0, 0) });
        // pool dice and the histogram of poker chips
        const rb = T.RoundedBoxGeometry ? new T.RoundedBoxGeometry(0.26, 0.26, 0.26, 3, 0.04) : new T.BoxGeometry(0.26, 0.26, 0.26);
        const pipM = [3, 4, 1, 6, 2, 5].map((f) => std(T, { map: pipTex(X, f), roughness: 0.3 }));
        const pool = []; for (let i = 0; i < 8; i++) { const m = new T.Mesh(rb, pipM); m.castShadow = true; m.visible = false; sc.add(m); pool.push({ m, ph: rand(0, TAU), face: 1, yaw: rand(0, 6) }); }
        const chips = new T.InstancedMesh(new T.CylinderGeometry(0.1, 0.1, 0.034, 28), std(T, { roughness: 0.45, color: 0xffffff }), 900);
        chips.castShadow = chips.receiveShadow = true; { const c0 = new T.Color(1, 1, 1); for (let i = 0; i < 900; i++) chips.setColorAt(i, c0); } chips.count = 0; sc.add(chips);
        const curveG = new T.BufferGeometry(); curveG.setAttribute('position', new T.BufferAttribute(new Float32Array(90 * 3), 3));
        const curve = new T.Line(curveG, new T.LineBasicMaterial({ color: new T.Color(2.4, 1.8, 0.7), transparent: true, opacity: 0 })); curve.frustumCulled = false; sc.add(curve);
        const B = pointBatch(X, 240, 'glyph', null, 5);
        B.mat.uniforms.map.value = X.canvasTexture(640, 640, (x) => { x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 66px Georgia, serif'; for (let i = 0; i < 20; i++) { const cx = (i % 5) * 128 + 64, cy = Math.floor(i / 5) * 128 + 64; x.fillStyle = '#fff'; x.fillText(String(i + 1), cx, cy + 4); } });
        const sparks = particles(X, 400, 'add'), Lk = linkLines(X, 240);
        Object.assign(D, { g: { lamp, bulb, beamM, d20, d20M, pool, chips, curve, curveG, B, Lk, sparks, up: new T.Vector3(0, 1, 0), tq: new T.Quaternion(), ta: new T.Vector3(), tb: new T.Vector3(), o: new T.Object3D(), col: new T.Color() } });
      },
      update(S, X, now, dt) {
        const D = S.data, G3 = D.g; if (!G3) return; applyFlash(S, X, D);
        camOrbit(S, X, D, { t: [0, 0.5, -0.2], r: 6.0, el: 0.55, speed: 0.00004, sweep: 0.35, dolly: 0.12 });
        for (const d of D.dice) stepDie(S, D, d, dt);
        D.dice = D.dice.filter((d) => { if (d.done && S.now - d.doneAt > 9000) { X.scene.remove(d.mesh); return false; } return true; });
        // the lamp: steady, warmer on a crit, a guttering flicker on a fumble
        const ct = (now - (D.crit || -1e9)) / 1000, ft = (now - (D.slump || -1e9)) / 1000;
        let li = 800 * (1 + 0.6 * Math.max(0, 1 - ct / 1.5));
        if (ft < 1.6 && !S.reduceMotion) li *= 0.55 + 0.45 * Math.abs(Math.sin(ft * 23) * Math.sin(ft * 7));
        G3.lamp.intensity = li; G3.beamM.uniforms.uTime.value = now / 1000; G3.beamM.uniforms.uInt.value = li / 800;
        const glowD = D.dice.find((d) => d.done && d.res === 20 && now - d.doneAt < 4000);
        const em = glowD ? 0.35 * (1 - (now - glowD.doneAt) / 4000) * (0.7 + 0.3 * Math.sin(now * 0.008)) : 0; G3.d20M.emissive.setRGB(em * 1.0, em * 0.65, em * 0.2);
        // the pool tumbles at the pointer's spot on the felt
        const P = D.pool, holding = S.holding && S.held > 300 && P;
        const at = holding ? rayToY(S, X, S.ptr.x, S.ptr.y, 0) : null;
        G3.pool.forEach((pd, i) => {
          const vis = holding && i < P.n; pd.m.visible = vis; if (!vis) return;
          const prev = pd.ph; pd.ph += dt * 0.012 * (1 + 0.2 * (i % 3));
          if (Math.floor(prev / Math.PI) !== Math.floor(pd.ph / Math.PI)) { pd.face = P.faces[i] || 1; pd.yaw = rand(0, TAU); }
          const a = i / P.n * TAU + now * 0.0008, rr = 0.35 + 0.08 * P.n, hop = Math.abs(Math.sin(pd.ph)) * 0.35;
          pd.m.position.set(clamp(at.x, -4, 4) + Math.cos(a) * rr, 0.13 + hop, clamp(at.z, -2.4, 2.4) + Math.sin(a) * rr);
          const f = PIP_FACE[pd.face]; G3.tb.set(f[0], f[1], f[2]);
          pd.m.quaternion.setFromUnitVectors(G3.tb, G3.up).premultiply(G3.tq.setFromAxisAngle(G3.up, pd.yaw + hop * 4));
        });
        // histogram: a column of chips per sum, and the normal curve the central limit theorem promises
        if (P && now - (P.shown || 0) < 9000) {
          const n = P.n, lo = n, hi = 6 * n, bins = hi - lo + 1, sp = Math.min(0.24, 8.4 / bins), x0 = -sp * (bins - 1) / 2, z0 = -2.35, maxP = Math.max(...P.exact), per = 18;
          let c = 0;
          for (let s = lo; s <= hi; s++) {
            const f = P.rolls ? P.hist[s] / P.rolls : 0, m = Math.min(per + 4, Math.round(f / maxP * per));
            for (let j = 0; j < m && c < 900; j++) { G3.o.position.set(x0 + (s - lo) * sp, 0.017 + j * 0.035, z0); G3.o.rotation.set(0, j * 1.3, 0); G3.o.scale.setScalar(Math.min(1, sp / 0.21)); G3.o.updateMatrix(); G3.chips.setMatrixAt(c, G3.o.matrix); G3.chips.setColorAt(c, G3.col.setHex(j % 2 ? 0xe9e4d8 : 0xa3121f)); c++; }
          }
          G3.chips.count = c; G3.chips.instanceMatrix.needsUpdate = true; if (G3.chips.instanceColor) G3.chips.instanceColor.needsUpdate = true;
          const mu = 3.5 * n, sd = Math.sqrt(35 / 12 * n), arr = G3.curveG.attributes.position.array;
          for (let i = 0; i < 90; i++) { const s = lo - 0.5 + (bins) * i / 89, pdf = Math.exp(-((s - mu) ** 2) / (2 * sd * sd)) / (sd * Math.sqrt(TAU)); arr[i * 3] = x0 + (s - lo) * sp; arr[i * 3 + 1] = 0.017 + pdf / maxP * per * 0.035 + 0.02; arr[i * 3 + 2] = z0; }
          G3.curveG.attributes.position.needsUpdate = true; G3.curve.material.opacity = S.holding ? 1 : clamp(1 - (now - P.shown - 6000) / 3000, 0, 1);
        } else { G3.chips.count = 0; G3.curve.material.opacity = 0; }
        G3.sparks.step(now, dt, (p) => { if (p.y < 0.01) { p.y = 0.01; p.vy *= -0.3; } });
        const ivory = [1.3, 1.05, 0.7], slumpK = ft < 3.4 ? (ft < 2.4 ? smooth(0, 0.6, ft) : 1 - smooth(2.4, 3.4, ft)) : 0;
        const hopK = ct < 2 ? ct : -1;
        drawLetters(S, G3.B, [0, 2.15, 0.2], 0.95, (n) => (n.inf ? palLin(S, n.gen, 2.6) : ivory), () => 0.27, (n) => (parseInt(n.g, 10) - 1) || 0,
          (n, v) => {
            if (slumpK > 0) v.y = lerp(v.y, 0.12 + (v.y - 2.15 + 0.95) * 0.12, slumpK * (0.8 + 0.2 * Math.sin(n.rz * 9)));
            if (hopK >= 0) { const t = hopK - (n.rx + 1) * 0.15; if (t > 0) v.y += Math.abs(Math.sin(t * 8)) * 0.3 * Math.exp(-t * 2); }
          });
        G3.Lk.update(S, (g) => palLin(S, g, 1.6));
      }
    },
    onTap(S, x, y) { const D = S.data, X = S.three; if (!X || !D.g) return; D.batch++; const p = rayToY(S, X, x, y, 0); throwDie(S, X, D, clamp(p.x, -3.5, 3.5), clamp(p.z, -1.8, 1.8)); },
    onRelease(S, held) {
      const D = S.data, X = S.three;
      if (held < S.STAGES[1] || !X || !D.g) return false;
      D.batch++; // roll with advantage: two d20, keep the higher
      throwDie(S, X, D, -0.9, 0.4); throwDie(S, X, D, 0.9, 0.2, 120);
      return false;
    },
    hud(S) {
      const D = S.data, P = D.pool, l = D.last;
      if (S.holding && P) {
        const tag = ['one die is flat: every face 1/6', '2d6 is a triangle: 7 is the likeliest sum (1/6)', '3d6, the old ability-score roll: already bell-shaped', '8d6: the central limit theorem in your hand'][S.stage];
        const mean = P.rolls ? P.s1 / P.rolls : 0, sd = P.rolls > 1 ? Math.sqrt(Math.max(0, P.s2 / P.rolls - mean * mean)) : 0;
        return `${P.n}d6 · ${fmt(P.rolls)} rolls · mean ${mean.toFixed(2)} (μ ${(3.5 * P.n).toFixed(1)}) · σ ${sd.toFixed(2)} (${Math.sqrt(35 / 12 * P.n).toFixed(2)}) · ${tag}`;
      }
      if (D.dice.some((d) => !d.done && S.now >= d.t0)) return 'rolling… a fair d20: each face 1/20, opposite faces sum to 21';
      if (l && S.now - l.t < 7000) {
        const v = l.best, plain = (21 - v) / 20, adv = 1 - Math.pow((v - 1) / 20, 2), dis = Math.pow((21 - v) / 20, 2);
        const head = l.adv ? `advantage: ${l.vals.join(' & ')} → keep ${v}` : `rolled ${v}`;
        const tail = v === 20 ? 'natural 20 · P = 5% every time; the die has no memory' : v === 1 ? 'natural 1 · P = 5%; it was not personal' : `P(≥${v}) = ${(plain * 100).toFixed(0)}% · with advantage ${(adv * 100).toFixed(1)}% · disadvantage ${(dis * 100).toFixed(1)}%`;
        return `${head} · ${tail}`;
      }
      return `tap: roll the d20 · hold: roll a pool and stack the sums · advantage turns 30% into 51% for DC 15${D.log.length ? ' · log ' + D.log.join(' ') : ''}`;
    }
  }));


  /* ======================= 3. DRAGON HOARD ======================= */
  const REPOSE = 32; // the pile model's angle of repose, in degrees (for loose grains, tan θ ≈ the internal friction μ)
  const HG = 72, HS = 12, HDX = HS / (HG - 1); // hoard heightfield: 72×72 cells over 12 m
  const GP_PER_M3 = 9000; // coins per cubic metre of hoard (a loose pile of coins, give or take)
  const DRAGON_CHARS = '$¤◎●✦♛⊙◉';
  const EYE_FS = [
    'uniform float uPupil, uGlow, uTime; uniform vec2 uLook; varying vec3 vN;',
    'float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'void main(){',
    '  vec3 n = normalize(vN); vec3 c = normalize(vec3(uLook, 1.0));',
    '  float d = acos(clamp(dot(n, c), -1.0, 1.0));',
    '  vec3 t1 = normalize(cross(vec3(0.0, 1.0, 0.0), c)), t2 = cross(c, t1); vec2 q = vec2(dot(n, t1), dot(n, t2));',
    '  float ang = atan(q.y, q.x), r = d / 0.62;',
    '  float stri = 0.55 + 0.45 * h(vec2(floor(ang * 40.0), 1.0)) * (0.6 + 0.4 * sin(r * 30.0 + uTime));',
    '  vec3 iris = mix(vec3(3.2, 2.1, 0.5), vec3(1.6, 0.35, 0.05), smoothstep(0.1, 0.95, r)) * stri;',
    '  iris *= 1.0 - smoothstep(0.86, 1.0, r) * 0.85;',
    '  float slit = abs(q.x) / (uPupil * sqrt(max(0.0, 1.0 - pow(q.y / 0.5, 2.0))) + 1e-3);',
    '  iris *= smoothstep(0.85, 1.25, slit);',
    '  vec3 scl = vec3(0.22, 0.04, 0.01) * (0.6 + 0.4 * h(floor(q * 60.0)));',
    '  vec3 col = mix(iris, scl, smoothstep(0.98, 1.04, r));',
    '  gl_FragColor = vec4(col * (0.7 + uGlow), 1.0); }'
  ].join('\n');
  const EYE_VS = 'varying vec3 vN; void main(){ vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  function scaleTex(X, tint) {
    return X.canvasTexture(512, 512, (x, w, h) => {
      x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
      for (let j = -1; j < 18; j++) for (let i = -1; i < 17; i++) {
        const cx = i * 32 + (j % 2) * 16, cy = j * 30, g = x.createRadialGradient(cx, cy - 6, 2, cx, cy, 22);
        g.addColorStop(0, tint ? 'rgba(90,70,40,1)' : '#fff'); g.addColorStop(0.8, tint ? 'rgba(30,24,16,1)' : '#555'); g.addColorStop(1, '#000');
        x.fillStyle = g; x.beginPath(); x.arc(cx, cy, 20, 0, Math.PI); x.closePath(); x.fill();
      }
    });
  }
  const hIdx = (i, j) => j * HG + i;
  function hoardAt(D, x, z) { const i = clamp(Math.round((x + HS / 2) / HDX), 0, HG - 1), j = clamp(Math.round((z + HS / 2) / HDX), 0, HG - 1); return D.h[hIdx(i, j)]; }
  addMode(Object.assign({}, quiet, {
    id: 'fa_dragon', name: 'DRAGON HOARD', glyphs: G(DRAGON_CHARS, '$◎●✦'),
    base: [44, 90, 62], palette: [[40, 100, 58], [25, 100, 55], [10, 100, 52], [52, 100, 72]],
    links: LINKS3D, count: 120, noHueShift: true, pageBg: ['#0c0503', '#030101'],
    shapes: ['sphere', 'galaxy', 'heart', 'crown', 'seashell', 'great_stellated_dodecahedron', 'torus', 'spherical_spiral'],
    init(S) {
      const D = S.data, h = new Float32Array(HG * HG), tn = Math.tan(REPOSE * Math.PI / 180), r = prng(41);
      for (let j = 0; j < HG; j++) for (let i = 0; i < HG; i++) {
        const x = -HS / 2 + i * HDX, z = -HS / 2 + j * HDX;
        h[hIdx(i, j)] = Math.max(0, 1.7 - Math.hypot(x + 1.6, z - 0.3) * tn * 0.92, 1.15 - Math.hypot(x - 2.3, z + 0.9) * tn * 0.92) + (r() - 0.5) * 0.03;
      }
      Object.assign(D, { h, t0: S.now, added: 0, aval: 0, blink: S.now + 2500, breath: null, heat: 0, pupil: 0.16, dirty: true, lastBuild: 0, falling: [] });
    },
    update(S, now, dt) {
      const D = S.data, H = D.h, tn = Math.tan(REPOSE * Math.PI / 180) * HDX;
      // the sandpile: wherever a slope beats the angle of repose, the excess slides downhill (an avalanche)
      let moved = 0;
      for (let pass = 0; pass < 2; pass++) for (let j = 1; j < HG - 1; j++) for (let i = 1; i < HG - 1; i++) {
        const a = hIdx(i, j);
        for (const b of [a + 1, a + HG]) { const d = H[a] - H[b]; if (d > tn) { const m = (d - tn) * 0.45; H[a] -= m; H[b] += m; moved += m; } else if (-d > tn) { const m = (-d - tn) * 0.45; H[a] += m; H[b] -= m; moved += m; } }
      }
      if (moved > 0.002) { D.dirty = true; D.aval += moved; }
      if (now > D.blink + 300) D.blink = now + rand(3500, 7500);
    },
    three: {
      init(S, X) {
        const T = X.THREE, sc = X.scene, D = S.data;
        X.maxPixelRatio = 1.25; X.setBloom(0.75, 0.5, 0.85); setExpo(X, 1.1); X.studioEnvironment();
        sc.background = new T.Color(0x060302); sc.fog = new T.FogExp2(0x060302, 0.045);
        const rock = repeatTex(X.canvasTexture(512, 512, (x, w, h) => noiseFill(x, w, h, '#17120f', 0.22, 14000, 17, 4)), T, 8, 8);
        const floor = new T.Mesh(new T.PlaneGeometry(60, 60), std(T, { map: rock, roughness: 0.95 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; sc.add(floor);
        const coinBump = repeatTex(X.canvasTexture(256, 256, (x, w, h) => { x.fillStyle = '#333'; x.fillRect(0, 0, w, h); const r = prng(5); for (let i = 0; i < 90; i++) { const cx = r() * w, cy = r() * h, rr = 10 + r() * 8, g = x.createRadialGradient(cx, cy, 0, cx, cy, rr); g.addColorStop(0, '#ddd'); g.addColorStop(0.85, '#aaa'); g.addColorStop(1, '#222'); x.fillStyle = g; x.beginPath(); x.ellipse(cx, cy, rr, rr * (0.5 + r() * 0.5), r() * 3, 0, TAU); x.fill(); } }), T, 14, 14);
        const goldM = std(T, { color: 0xffc35a, metalness: 1, roughness: 0.34, bumpMap: coinBump, bumpScale: 0.04, envMapIntensity: 0.55, emissive: new T.Color(0, 0, 0) });
        const pileG = new T.PlaneGeometry(HS, HS, HG - 1, HG - 1); pileG.rotateX(-Math.PI / 2);
        const pile = new T.Mesh(pileG, goldM); pile.receiveShadow = pile.castShadow = true; sc.add(pile);
        const coinG = new T.CylinderGeometry(0.1, 0.1, 0.016, 22), coinM = std(T, { color: 0xffcf6a, metalness: 1, roughness: 0.22, envMapIntensity: 0.7 });
        const coins = new T.InstancedMesh(coinG, coinM, 2200); coins.castShadow = true; coins.receiveShadow = true; sc.add(coins);
        const fall = new T.InstancedMesh(coinG, coinM, 200); fall.count = 0; fall.castShadow = true; sc.add(fall);
        const r = prng(77), seeds = []; for (let i = 0; i < 2200; i++) seeds.push([(r() - 0.5) * HS * 0.96, (r() - 0.5) * HS * 0.96, r() * TAU, (r() - 0.5) * 0.9, (r() - 0.5) * 0.9]);
        // the dragon: a scaled head, a brow, and one enormous eye
        const scB = repeatTex(scaleTex(X, false), T, 12, 7), scC = repeatTex(scaleTex(X, true), T, 12, 7);
        const skin = std(T, { map: scC, bumpMap: scB, bumpScale: 0.1, roughness: 0.5, metalness: 0.35, envMapIntensity: 0.3, color: 0x3c4a34 });
        const lumpy = (g, a, f) => { const P = g.attributes.position, N3 = X.noise; if (N3) for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), k = 1 + a * N3.noise(x * f, y * f, z * f) + a * 0.35 * N3.noise(x * f * 3, y * f * 3 + 7, z * f * 3); P.setXYZ(i, x * k, y * k, z * k); } g.computeVertexNormals(); return g; };
        const head = new T.Mesh(lumpy(new T.SphereGeometry(1, 96, 64), 0.16, 1.8), skin); head.scale.set(13, 6.8, 4.0); head.position.set(0, 4.4, -10.0); head.receiveShadow = true; sc.add(head);
        const brow = new T.Mesh(lumpy(new T.SphereGeometry(1, 64, 32), 0.2, 2.5), skin); brow.scale.set(3.6, 0.8, 1.4); brow.position.set(0, 6.05, -6.4); brow.rotation.z = -0.06; sc.add(brow);
        const hornM = std(T, { color: 0x1d1712, roughness: 0.6, metalness: 0.1 });
        for (const s of [-1, 1]) { const hn = new T.Mesh(new T.ConeGeometry(0.42, 3.2, 24, 1), hornM); hn.position.set(s * 2.4, 7.2, -7.2); hn.rotation.set(-0.7, 0, -s * 0.5); sc.add(hn); }
        const eyeM = new T.ShaderMaterial({ uniforms: { uPupil: { value: 0.16 }, uGlow: { value: 0.3 }, uTime: { value: 0 }, uLook: { value: new T.Vector2() } }, vertexShader: EYE_VS, fragmentShader: EYE_FS });
        const eye = new T.Mesh(new T.SphereGeometry(1.65, 64, 48), eyeM); eye.position.set(0, 4.65, -6.4); sc.add(eye);
        const lidM = std(T, { map: scC, bumpMap: scB, bumpScale: 0.06, roughness: 0.5, metalness: 0.35, envMapIntensity: 0.3, color: 0x34402c, side: T.DoubleSide });
        const lidU = new T.Mesh(new T.SphereGeometry(1.74, 48, 24, 0, TAU, 0, Math.PI / 2), lidM), lidL = new T.Mesh(new T.SphereGeometry(1.74, 48, 24, 0, TAU, Math.PI / 2, Math.PI / 2), lidM);
        lidU.position.copy(eye.position); lidL.position.copy(eye.position); sc.add(lidU); sc.add(lidL);
        const eyeL = new T.PointLight(0xff8a2a, 20, 14, 2); eyeL.position.set(0, 4.6, -4.4); sc.add(eyeL);
        const torch = new T.PointLight(0xffa25a, 90, 26, 2); torch.position.set(-5, 3.6, 3.2); torch.castShadow = true; torch.shadow.mapSize.set(1024, 1024); torch.shadow.bias = -0.003; sc.add(torch);
        const rim = new T.SpotLight(0x7f9cff, 160, 40, 0.7, 0.7, 2); rim.position.set(6, 9, -10); rim.target.position.set(0, 4.2, -6); sc.add(rim); sc.add(rim.target);
        sc.add(new T.HemisphereLight(0x332820, 0x0a0604, 0.5));
        const fireL = new T.PointLight(0xff7020, 0, 18, 2); sc.add(fireL);
        const haze = addHaze(X);
        const B = pointBatch(X, 240, 'glyph', charAtlas(X, DRAGON_CHARS, 'bold 84px Georgia, serif', 3), 3), Lk = linkLines(X, 240), fire = particles(X, 1200, 'add'), glints = particles(X, 160, 'add'), smoke = particles(X, 200, 'smoke');
        Object.assign(D, { g: { haze, pile, pileG, goldM, coins, fall, seeds, eye, eyeM, lidU, lidL, eyeL, torch, fireL, B, Lk, fire, glints, smoke, o: new T.Object3D(), up: new T.Vector3(0, 1, 0), nv: new T.Vector3(), q: new T.Quaternion() } });
      },
      update(S, X, now, dt) {
        const D = S.data, G3 = D.g; if (!G3) return; applyFlash(S, X, D);
        const k = dt / 1000, H = D.h;
        camOrbit(S, X, D, { t: [0, 2.3, -1.5], r: 10.5, el: 0.24, speed: 0.00004, sweep: 0.4, dolly: 0.15 });
        // coins rain from the infected letters while held
        if (S.holding) { const rate = [2, 8, 18, 34][S.stage]; for (let q = 0; q < rate * k * 3; q++) { const n = pick(S.active); if (n && n.inf && n.data.p3 && D.falling.length < 200) D.falling.push({ x: n.data.p3[0], y: n.data.p3[1], z: n.data.p3[2], vx: rand(-0.6, 0.6), vy: rand(-0.5, 1), vz: rand(-0.6, 0.6), rx: rand(0, 6), rz: rand(0, 6), w: rand(8, 20) }); } }
        let c = 0;
        D.falling = D.falling.filter((f) => {
          f.vy -= 9.8 * k; f.x += f.vx * k; f.y += f.vy * k; f.z += f.vz * k; f.rx += f.w * k;
          const hh = hoardAt(D, f.x, f.z);
          if (f.y <= hh + 0.01) { // a coin lands: the pile grows here (each coin ~ 1/9000 m³ of hoard)
            const i = clamp(Math.round((f.x + HS / 2) / HDX), 0, HG - 1), j = clamp(Math.round((f.z + HS / 2) / HDX), 0, HG - 1);
            H[hIdx(i, j)] += 40 / GP_PER_M3 / (HDX * HDX); D.added += 40; D.dirty = true;
            if (Math.random() < 0.3) G3.glints.add({ x: f.x, y: hh + 0.05, z: f.z, vx: 0, vy: 0.2, vz: 0, t: now, life: 300, s: 0.12, c: [3, 2.4, 1.2] });
            return false;
          }
          if (c < 200) { G3.o.position.set(f.x, f.y, f.z); G3.o.rotation.set(f.rx, 0, f.rz); G3.o.scale.setScalar(1); G3.o.updateMatrix(); G3.fall.setMatrixAt(c++, G3.o.matrix); }
          return true;
        });
        G3.fall.count = c; G3.fall.instanceMatrix.needsUpdate = true;
        // a swipe across the hoard knocks coins loose
        if (S.ptrInside && pspeed(S) > 3) { const p = rayToY(S, X, S.ptr.x, S.ptr.y, 0.4), hh = hoardAt(D, p.x, p.z); if (hh > 0.3) { for (let q = 0; q < 2; q++) D.falling.push({ x: p.x, y: hh + 0.1, z: p.z, vx: pvel(S).x * 0.08 + rand(-0.5, 0.5), vy: rand(2, 3.5), vz: rand(-0.5, 0.5), rx: 0, rz: 0, w: 15 }); } }
        // rebuild the pile surface and its top layer of coins when it changed
        if (D.dirty && now - D.lastBuild > 120) {
          D.dirty = false; D.lastBuild = now;
          const P = G3.pileG.attributes.position;
          for (let j = 0; j < HG; j++) for (let i = 0; i < HG; i++) { const hh = H[hIdx(i, j)]; P.setY(hIdx(i, j), hh > 0.02 ? hh : -0.08); }
          P.needsUpdate = true; G3.pileG.computeVertexNormals();
          let n = 0;
          for (const s of G3.seeds) {
            const hh = hoardAt(D, s[0], s[1]); if (hh < 0.04) continue;
            const hx = hoardAt(D, s[0] + HDX, s[1]) - hoardAt(D, s[0] - HDX, s[1]), hz = hoardAt(D, s[0], s[1] + HDX) - hoardAt(D, s[0], s[1] - HDX);
            G3.nv.set(-hx / (2 * HDX), 1, -hz / (2 * HDX)).normalize();
            G3.o.position.set(s[0], hh + 0.012, s[1]); G3.o.quaternion.setFromUnitVectors(G3.up, G3.nv); G3.o.rotateY(s[2]); G3.o.rotateX(s[3] * 0.5); G3.o.rotateZ(s[4] * 0.5);
            G3.o.scale.setScalar(1); G3.o.updateMatrix(); G3.coins.setMatrixAt(n++, G3.o.matrix);
          }
          G3.coins.count = n; G3.coins.instanceMatrix.needsUpdate = true;
        }
        // the eye: blinks, tracks the pointer, opens wider as the hoard is disturbed
        const tx = S.ptrInside ? clamp((S.ptr.x / S.W - 0.5) * 0.9, -0.45, 0.45) : 0, ty = S.ptrInside ? clamp(-(S.ptr.y / S.H - 0.5) * 0.6, -0.3, 0.3) : 0;
        D.lx = lerp(D.lx || 0, tx, 0.06); D.ly = lerp(D.ly || 0, ty, 0.06);
        const near = S.ptrInside ? clamp(1 - Math.hypot(S.ptr.x - S.cx, S.ptr.y - S.H * 0.35) / (S.W * 0.3), 0, 1) : 0;
        D.pupil = lerp(D.pupil, S.holding ? 0.05 + 0.02 * S.stage : 0.2 - 0.12 * near, 0.06); // light close by narrows the slit
        const bt = (now - D.blink) / 300, blink = bt > 0 && bt < 1 ? Math.sin(bt * Math.PI) : 0;
        const open = clamp((0.68 + 0.32 * power(S) + 0.3 * D.heat) * (1 - blink), 0, 1);
        G3.eyeM.uniforms.uPupil.value = D.pupil; G3.eyeM.uniforms.uLook.value.set(D.lx, D.ly); G3.eyeM.uniforms.uTime.value = now * 0.001; G3.eyeM.uniforms.uGlow.value = 0.25 + 1.2 * power(S) + D.heat;
        G3.lidU.rotation.x = -0.72 * open; G3.lidL.rotation.x = 0.55 * open;
        G3.eyeL.intensity = 12 + 50 * power(S) + 40 * D.heat;
        G3.torch.intensity = 85 * (0.85 + 0.15 * Math.sin(now * 0.013) * Math.sin(now * 0.0071));
        // dragonfire: a cone of hot gas from the jaw, cooling as it flies
        const b = D.breath;
        if (b) {
          const t = (now - b.t) / 1000;
          if (t > 2.6) D.breath = null;
          else if (t < 1.5) {
            const m = new X.THREE.Vector3(-2.8, 3.0, -4.6), dir = b.to.clone().sub(m).normalize(), per = S.reduceMotion ? 10 : 26;
            for (let q = 0; q < per; q++) { const sp = rand(9, 13), jx = rand(-0.12, 0.12), jy = rand(-0.1, 0.1), jz = rand(-0.12, 0.12); G3.fire.add({ x: m.x, y: m.y, z: m.z, vx: (dir.x + jx) * sp, vy: (dir.y + jy) * sp, vz: (dir.z + jz) * sp, drag: 0.45, g: -1.5, t: now, life: rand(600, 950), s: rand(0.35, 0.6), grow: 2.5, T: rand(1250, 1450), k: 2.2 }); }
            D.heat = Math.min(1, D.heat + 1.2 * k);
            G3.fireL.position.copy(m).lerp(b.to, 0.55); G3.fireL.intensity = 400 * Math.min(1, t * 4);
          }
        }
        if (!D.breath) G3.fireL.intensity *= 0.9;
        setHaze(S, X, G3.haze, G3.fireL.position, Math.min(1.4, G3.fireL.intensity / 300), 0.45);
        D.heat *= Math.pow(0.6, k);
        const hc = hotRGB(500 + 600 * D.heat), hl = linRGB(hc, D.heat * 1.2); G3.goldM.emissive.setRGB(hl[0], hl[1], hl[2]);
        G3.fire.step(now, dt, (p, kk) => { p.T -= 420 * kk; if (p.y < hoardAt(D, p.x, p.z) + 0.1) { p.vy = Math.abs(p.vy) * 0.3; p.vx *= 0.6; p.vz *= 0.6; } if (p.T < 760 && Math.random() < 0.02 && G3.smoke.list.length < 200) G3.smoke.add({ x: p.x, y: p.y, z: p.z, vx: p.vx * 0.2, vy: 0.8, vz: p.vz * 0.2, drag: 0.5, g: -0.2, t: now, life: 2200, s: 0.4, grow: 2.5, c: [0.05, 0.04, 0.035], a: 0.35 }); });
        G3.smoke.step(now, dt);
        if (Math.random() < 0.35) { const s = pick(G3.seeds), hh = hoardAt(D, s[0], s[1]); if (hh > 0.1) G3.glints.add({ x: s[0], y: hh + 0.03, z: s[1], vx: 0, vy: 0, vz: 0, t: now, life: rand(300, 700), s: rand(0.08, 0.16), c: [2.2, 1.9, 1.3] }); }
        G3.glints.step(now, dt);
        const gold = [1.4, 0.9, 0.3];
        drawLetters(S, G3.B, [0, 1.95, 0.6], 0.95, (n) => (n.inf ? palLin(S, n.gen, 2.4) : gold), () => 0.2, (n) => Math.max(0, DRAGON_CHARS.indexOf(n.g)));
        G3.Lk.update(S, (g) => palLin(S, g, 1.8));
      }
    },
    onRelease(S, held) {
      const D = S.data, X = S.three;
      if (held < S.STAGES[1] || !X) return false;
      D.breath = { t: S.now, to: rayToY(S, X, S.ptr.x, S.ptr.y, 0.6) }; cineFlash(S, D, held > S.STAGES[3] ? 0.8 : 0.45);
      return false;
    },
    hud(S) {
      const D = S.data, H = D.h, A = HDX * HDX; let vol = 0; for (let i = 0; i < H.length; i++) vol += Math.max(0, H[i]) * A;
      const gp = vol * GP_PER_M3, yrs = (S.now - D.t0) / 1000 * 25, val = gp * Math.pow(1.02, yrs);
      let slope = 0; for (let j = 1; j < HG - 1; j++) for (let i = 1; i < HG - 1; i++) { const a = hIdx(i, j); if (H[a] < 0.12) continue; const gx = (H[a + 1] - H[a - 1]) / (2 * HDX), gz = (H[a + HG] - H[a - HG]) / (2 * HDX), s = Math.hypot(gx, gz); if (s > slope) slope = s; }
      const ang = Math.atan(slope) * 180 / Math.PI;
      if (D.breath) return 'dragonfire · ~1,300 °C at the jaw, cooling as it spreads · gold melts at 1,064 °C, so the hoard glows but survives';
      if (S.holding) return `hoard +${fmt(D.added)} gp · steepest flank ${ang.toFixed(1)}° vs repose ${REPOSE}° (tan θ ≈ μ) · avalanches move ${fmt(D.aval * A * GP_PER_M3)} gp`;
      return `hoard ${fmt(gp)} gp · slept ${fmt(yrs)} yrs at 2% → ${sci(val)} gp · rule of 72: doubles every 36 yrs · flanks ${ang.toFixed(1)}° (repose ${REPOSE}°)`;
    }
  }));

  /* ======================= 4. ELVEN STARLIGHT ======================= */
  const LEAF_SCRIPT = makeScript(0x5EAF, 16, 'leaf');
  const GOLD_DEG = GOLDEN * 180 / Math.PI; // 137.5077…°, i.e. 360°/φ²
  const FLOWER_C = [0, 2.5, 0], FLOWER_R = 2.7, NMAX = 720;
  function convergents(x, maxQ) { // continued-fraction convergents p/q of x
    const out = []; let h0 = 1, h1 = 0, k0 = 0, k1 = 1, y = x;
    for (let i = 0; i < 14; i++) { const a = Math.floor(y); const h = a * h0 + h1, kk = a * k0 + k1; if (kk > maxQ) break; out.push([h, kk]); h1 = h0; h0 = h; k1 = k0; k0 = kk; const f = y - a; if (f < 1e-9) break; y = 1 / f; }
    return out;
  }
  addMode(Object.assign({}, quiet, {
    id: 'fa_elven', name: 'ELVEN STARLIGHT', glyphs: SCRIPT_GLYPHS,
    base: [215, 45, 86], palette: [[200, 90, 78], [175, 80, 74], [48, 90, 78], [260, 70, 82]],
    links: LINKS3D, count: 'random', pageBg: ['#081026', '#02040a'],
    shapes: ['sunflower', 'spherical_spiral', 'rose', 'galaxy', 'seashell', 'hopf', 'helix', 'cinquefoil'],
    init(S) { Object.assign(S.data, { N: 0, alpha: GOLD_DEG, fade: null, star: null, glyphA: 0, fam: [1, 1], pLo: 0 }); },
    update(S, now, dt) {
      const D = S.data, k = dt / 16.7;
      const target = S.holding ? 280 + (NMAX - 280) * power(S) : 320;
      if (!D.fade) D.N = lerp(D.N, target, 1 - Math.pow(0.985, k));
      const off = S.holding ? 0 : S.ptrInside ? clamp((S.ptr.x - S.cx) / (S.W * 0.5), -1, 1) * 4 : 0;
      D.alpha = lerp(D.alpha, GOLD_DEG + off, 1 - Math.pow(S.holding ? 0.9 : 0.95, k));
      D.glyphA = clamp(D.glyphA + (S.holding && S.stage >= 2 ? 1 : -0.6) * dt / 900, 0, 1);
      if (D.fade && now - D.fade.t > 4600) { D.fade = null; D.N = 0; }
      // the visible spiral families (parastichies): convergent denominators of α/360° nearest q* ≈ √(4πN/√5)
      const conv = convergents(D.alpha / 360, 4000), qStar = Math.sqrt(4 * Math.PI * Math.max(D.N, 2) / Math.sqrt(5));
      let lo = 1, hi = 0, pLo = 0; for (const [p, q] of conv) { if (q <= qStar) { lo = q; pLo = p; } else if (!hi) hi = q; }
      D.fam = [lo, hi || lo]; D.pLo = pLo;
    },
    three: {
      init(S, X) {
        const T = X.THREE, sc = X.scene, D = S.data, N3 = X.noise;
        X.maxPixelRatio = 1.25; X.setBloom(0.75, 0.55, 0.78); setExpo(X, 1.0);
        sc.background = new T.Color(0x050b1c); sc.fog = new T.FogExp2(0x07102a, 0.04);
        // ground: soft hills, flattened into a clearing
        const gg = new T.PlaneGeometry(80, 80, 120, 120); gg.rotateX(-Math.PI / 2);
        const P = gg.attributes.position;
        for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i), r = Math.hypot(x, z), f = smooth(4, 14, r); P.setY(i, (N3 ? N3.noise(x * 0.07, 0, z * 0.07) * 2.2 + N3.noise(x * 0.3, 1, z * 0.3) * 0.3 : 0) * f - 0.05); }
        gg.computeVertexNormals();
        const moss = repeatTex(X.canvasTexture(512, 512, (x, w, h) => noiseFill(x, w, h, '#16241f', 0.4, 16000, 31, 3)), T, 16, 16);
        const ground = new T.Mesh(gg, std(T, { map: moss, roughness: 1, color: 0x8899aa })); ground.receiveShadow = true; sc.add(ground);
        // pale-barked trees around the clearing
        const bark = X.canvasTexture(256, 512, (x, w, h) => { const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#6c7584'); g.addColorStop(0.5, '#c8d0dc'); g.addColorStop(1, '#6c7584'); x.fillStyle = g; x.fillRect(0, 0, w, h); const r = prng(4); for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(30,35,45,${0.2 + r() * 0.4})`; x.fillRect(r() * w, r() * h, 6 + r() * 22, 1 + r() * 2); } });
        const trunkM = std(T, { map: bark, roughness: 0.75 }), trunks = new T.InstancedMesh(new T.CylinderGeometry(0.14, 0.34, 18, 14, 6), trunkM, 26), branches = new T.InstancedMesh(new T.CylinderGeometry(0.03, 0.07, 3, 6), trunkM, 160);
        trunks.castShadow = branches.castShadow = true; trunks.receiveShadow = true;
        const leafM = new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide, transparent: true, opacity: 0.85, depthWrite: false, blending: T.AdditiveBlending });
        const canopy = new T.InstancedMesh(new T.PlaneGeometry(0.22, 0.1), leafM, 1800);
        const o = new T.Object3D(), r = prng(19), col = new T.Color(); let bi = 0, li = 0;
        for (let t = 0; t < 26; t++) {
          let a, rr; do { a = r() * TAU; rr = 6.5 + r() * 14; } while (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.55 && rr < 13);
          const x = Math.sin(a) * rr, z = Math.cos(a) * rr;
          o.position.set(x, 8.5, z); o.rotation.set((r() - 0.5) * 0.06, r() * 6, (r() - 0.5) * 0.06); o.scale.set(1, 1, 1); o.updateMatrix(); trunks.setMatrixAt(t, o.matrix);
          for (let b = 0; b < 6 && bi < 160; b++) {
            const y = 6 + b * 1.6 + r(), ba = r() * TAU; o.position.set(x + Math.cos(ba) * 1.2, y + 0.8, z + Math.sin(ba) * 1.2); o.rotation.set(0, -ba, 0); o.rotateZ(-0.95); o.updateMatrix(); branches.setMatrixAt(bi++, o.matrix);
            for (let l = 0; l < 11 && li < 1800; l++) { o.position.set(x + Math.cos(ba) * (2 + r() * 1.2) + (r() - 0.5), y + 1.6 + (r() - 0.5) * 1.2, z + Math.sin(ba) * (2 + r() * 1.2) + (r() - 0.5)); o.rotation.set(r() * 6, r() * 6, r() * 6); o.updateMatrix(); canopy.setMatrixAt(li, o.matrix); const g = r() < 0.2; canopy.setColorAt(li, col.setRGB(g ? 0.9 : 0.35, g ? 0.75 : 0.5, g ? 0.4 : 0.8)); li++; }
          }
        }
        sc.add(trunks); sc.add(branches); sc.add(canopy);
        const moon = new T.DirectionalLight(0xbcd2ff, 1.6); moon.position.set(-9, 22, -6); moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048);
        Object.assign(moon.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 }); moon.shadow.bias = -0.0005; sc.add(moon);
        sc.add(new T.HemisphereLight(0x3a5088, 0x060a10, 0.7));
        const beamM = beamMat(X, [0.55, 0.7, 1.0], 1.3), beams = [];
        for (const [bx, bz, tilt] of [[-3.5, -4, 0.25], [2.5, -6, 0.3], [5, -2, 0.22]]) { const b = new T.Mesh(new T.CylinderGeometry(0.6, 1.6, 1, 32, 1, true), beamM); b.scale.set(1, 16, 1); b.position.set(bx, 7, bz); b.rotation.z = tilt; b.rotation.x = -0.15; sc.add(b); beams.push(b); }
        const flowerL = new T.PointLight(0xaccaff, 12, 10, 2); flowerL.position.set(FLOWER_C[0], FLOWER_C[1], 1); sc.add(flowerL);
        // the phyllotaxis rosette: one instanced leaf per primordium
        const sh = new T.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(0.17, 0.08, 0.36, 0); sh.quadraticCurveTo(0.17, -0.08, 0, 0);
        const florets = new T.InstancedMesh(new T.ShapeGeometry(sh, 8), new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide }), NMAX);
        florets.instanceMatrix.setUsage(T.DynamicDrawUsage); { const c0 = new T.Color(1, 1, 1); for (let i = 0; i < NMAX; i++) florets.setColorAt(i, c0); } sc.add(florets);
        const flower = new T.Group(); flower.position.set(...FLOWER_C); sc.add(flower);
        const stars = pointBatch(X, 1500, 'add'), rs = prng(91);
        for (let i = 0; i < 1500; i++) { const a = rs() * TAU, e = Math.asin(0.05 + rs() * 0.95), R = 90, b = 0.3 + Math.pow(rs(), 8) * 3; stars.set(i, Math.cos(a) * Math.cos(e) * R, Math.sin(e) * R, Math.sin(a) * Math.cos(e) * R, b * 0.8, b * 0.85, b, 0.25 + rs() * 0.5, 0); }
        stars.n = 1500; stars.sync();
        const B = pointBatch(X, 260, 'glyph', scriptAtlas(X, LEAF_SCRIPT), 4), ringB = pointBatch(X, 24, 'glyph', B.mat.uniforms.map.value, 4), Lk = linkLines(X, 260);
        const flies = particles(X, 80, 'add'), motes = particles(X, 500, 'add');
        for (let i = 0; i < 36; i++) flies.add({ x: rand(-6, 6), y: rand(0.4, 3), z: rand(-5, 4), vx: 0, vy: 0, vz: 0, t: S.now, life: 1e9, s: 0.06, c: [1.4, 2.2, 1.2], drag: 0.6, ph: rand(0, TAU) });
        const eve = new T.PointLight(0xdfe8ff, 0, 30, 2); sc.add(eve);
        Object.assign(D, { g: { beamM, florets, flower, flowerL, stars, B, ringB, Lk, flies, motes, eve, o, col, q: new T.Quaternion(), qy: new T.Quaternion(), zax: new T.Vector3(0, 0, 1), yax: new T.Vector3(0, 1, 0), v: new T.Vector3() } });
      },
      update(S, X, now, dt) {
        const D = S.data, G3 = D.g; if (!G3) return; applyFlash(S, X, D);
        camOrbit(S, X, D, { t: [0, 2.2, 0], r: 7.6, el: 0.1, speed: 0.00003, sweep: 0.3, dolly: 0.12 });
        const fl = G3.flower; fl.lookAt(X.camera.position.x * 0.3, FLOWER_C[1] + 0.6, X.camera.position.z); fl.updateMatrixWorld();
        const N = Math.floor(D.N), al = D.alpha * Math.PI / 180, c = FLOWER_R / Math.sqrt(NMAX), arms = D.fam[0] > 1 ? D.fam[0] : 0, arm = arms ? Math.floor(now / 650) % arms : -1;
        const fade = D.fade ? (now - D.fade.t) / 1000 : 0, o = G3.o, ptr = S.ptrInside ? X.fromScreen(S.ptr.x, S.ptr.y, 0) : null;
        let m = 0;
        // Vogel's model of a flower head: primordium n at angle n·α, radius c·√n
        for (let i = 1; i <= N && m < NMAX; i++) {
          const th = i * al, r = c * Math.sqrt(i), tilt = 0.25 + 0.7 * (r / FLOWER_R);
          let sz = 0.55 + 0.75 * Math.sqrt(i / NMAX), lift = 0;
          if (fade) { const t = Math.max(0, fade - (i % 97) / 97 * 1.3); lift = t * t * 0.6 * (1 + (i % 7) * 0.2); sz *= clamp(1 - t / 2.6, 0, 1); if (sz <= 0.01) continue; }
          o.position.set(Math.cos(th) * r, Math.sin(th) * r + lift, -0.35 * (r / FLOWER_R) ** 2 + lift * 0.3);
          o.quaternion.setFromAxisAngle(G3.zax, th).multiply(G3.qy.setFromAxisAngle(G3.yax, tilt));
          o.scale.setScalar(sz); o.updateMatrix(); o.matrix.premultiply(fl.matrixWorld); G3.florets.setMatrixAt(m, o.matrix);
          const onArm = arms && (i - arm + arms) % arms < Math.max(1, Math.round(arms / 13)), b = (0.9 + 0.5 * (i / NMAX)) * (fade ? 1.5 : 1);
          let k2 = 1; if (ptr) { G3.v.setFromMatrixPosition(o.matrix); const d = G3.v.distanceTo(ptr); if (d < 0.6) k2 = 1 + (1 - d / 0.6) * 1.5; }
          G3.florets.setColorAt(m, onArm ? G3.col.setRGB(1.5 * k2, 1.05 * k2, 0.4 * k2) : i % 5 === 0 ? G3.col.setRGB(0.16 * b * k2, 0.32 * b * k2, 0.95 * b * k2) : G3.col.setRGB(0.32 * b * k2, 0.42 * b * k2, 0.7 * b * k2));
          if (fade && Math.random() < 0.01) { G3.v.setFromMatrixPosition(o.matrix); G3.motes.add({ x: G3.v.x, y: G3.v.y, z: G3.v.z, vx: rand(-0.1, 0.1), vy: rand(0.3, 0.9), vz: rand(-0.1, 0.1), drag: 0.9, t: now, life: rand(1800, 3600), s: 0.05, c: [1.2, 1.5, 2.4] }); }
          m++;
        }
        G3.florets.count = m; G3.florets.instanceMatrix.needsUpdate = true; if (G3.florets.instanceColor) G3.florets.instanceColor.needsUpdate = true;
        G3.beamM.uniforms.uTime.value = now / 1000; G3.beamM.uniforms.uInt.value = 1.3 * (D.fade ? 1 - 0.7 * Math.sin(Math.min(1, fade / 4.6) * Math.PI) : 1);
        G3.flowerL.intensity = 6 + 16 * power(S) + (fade ? 10 * Math.max(0, 1 - fade / 3) : 0);
        // the leaf-script ring, glowing only at full song
        let gi = 0;
        if (D.glyphA > 0.01) for (let i = 0; i < 21; i++) { const a = i / 21 * TAU - now * 0.00008; G3.v.set(Math.cos(a) * FLOWER_R * 1.13, Math.sin(a) * FLOWER_R * 1.13, -0.3).applyMatrix4(fl.matrixWorld); const s = D.glyphA * (0.8 + 0.2 * Math.sin(now * 0.003 + i)); G3.ringB.set(gi++, G3.v.x, G3.v.y, G3.v.z, 1.1 * s, 1.5 * s, 2.6 * s, 0.24, (i * 5) % 16); }
        G3.ringB.n = gi; G3.ringB.sync();
        // fireflies drift toward a resting pointer
        const pt = S.ptrInside ? X.fromScreen(S.ptr.x, S.ptr.y, 1.5) : null;
        G3.flies.step(now, dt, (p, k) => { p.ph += k * 2; p.vx += Math.cos(p.ph * 1.3) * 0.6 * k; p.vy += Math.sin(p.ph) * 0.4 * k; p.vz += Math.sin(p.ph * 0.7) * 0.6 * k; if (pt) { const dx = pt.x - p.x, dy = pt.y - p.y, dz = pt.z - p.z, d = Math.hypot(dx, dy, dz) + 0.1; if (d < 4) { p.vx += dx / d * 1.2 * k; p.vy += dy / d * 1.2 * k; p.vz += dz / d * 1.2 * k; } } p.y = clamp(p.y, 0.2, 5); });
        for (const p of G3.flies.list) { const tw = 0.5 + 0.5 * Math.sin(now * 0.004 + p.ph * 3); p.c = [1.4 * tw, 2.4 * tw, 1.1 * tw]; }
        G3.motes.step(now, dt);
        const st = D.star;
        if (st) { const t = (now - st.t) / 1000; if (t > 8) { D.star = null; G3.eve.intensity = 0; } else { G3.eve.position.set(0, lerp(FLOWER_C[1], 9, smooth(0, 3.5, t)), -3); G3.eve.intensity = 40 * (t < 3.5 ? 1 : clamp(1 - (t - 3.5) / 4, 0, 1)); G3.motes.add({ x: G3.eve.position.x, y: G3.eve.position.y, z: G3.eve.position.z, vx: 0, vy: 0, vz: 0, t: now, life: 60, s: 0.9, c: [2.5 * G3.eve.intensity / 40, 2.8 * G3.eve.intensity / 40, 3.5 * G3.eve.intensity / 40] }); } }
        const silver = [0.7, 0.85, 1.3];
        drawLetters(S, G3.B, [0, 2.4, 1.3], 0.9, (n) => (n.inf ? palLin(S, n.gen, 2) : silver), () => 0.24, (n) => glyphIndex(n.g) % 16);
        G3.Lk.update(S, (g) => palLin(S, g, 1.4), 0.15);
      }
    },
    onRelease(S, held) {
      const D = S.data;
      if (held < S.STAGES[1]) return false;
      D.fade = { t: S.now }; D.star = { t: S.now }; cineFlash(S, D, 0.35);
      return false;
    },
    hud(S) {
      const D = S.data, fam = D.fam, a = D.alpha, off = a - GOLD_DEG;
      if (D.fade) return 'the leaves let go · light fades from the world, one primordium at a time';
      if (Math.abs(off) < 0.02) return `divergence ${a.toFixed(3)}° = 360°/φ² · ${Math.floor(D.N)} leaves · spirals ${fam[0]} & ${fam[1]} (Fibonacci, always) · the most irrational angle leaves no gaps`;
      return `divergence ${a.toFixed(3)}° (${off > 0 ? '+' : ''}${off.toFixed(2)}°) ≈ ${D.pLo}/${fam[0]} turn → ${fam[0]} straight spokes with gaps between · rational angles waste sunlight · centre the pointer to heal it`;
    }
  }));


  /* ======================= 5. SPELLBOOK ======================= */
  const RUNE_SCRIPT = makeScript(0xB00C, 16, 'forge');
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  // {n/k}: join every k-th of n points. If gcd(n, k) = g > 1 it is not one stroke but a compound of g copies of {n/g / k/g}.
  function starSegments(n, k, r) {
    const g = gcd(n, k), m = n / g, out = [], P = (i) => { const a = i * TAU / n + Math.PI / 2; return [Math.cos(a) * r, Math.sin(a) * r]; };
    for (let c = 0; c < g; c++) { let v = c; for (let e = 0; e < m; e++) { const w = (v + k) % n, a = P(v), b = P(w); out.push(a[0], a[1], 0, b[0], b[1], 0); v = w; } }
    return out;
  }
  function starPoly2D(x, cx, cy, r, n, k) { const s = starSegments(n, k, r); x.beginPath(); for (let i = 0; i < s.length; i += 6) { x.moveTo(cx + s[i], cy - s[i + 1]); x.lineTo(cx + s[i + 3], cy - s[i + 4]); } x.stroke(); }
  const SPELL_POLYS = [[5, 2, 0.98, 0, 280], [7, 3, 0.8, 1, 190], [6, 2, 0.58, 2, 50], [9, 4, 0.98, 2, 160], [12, 5, 0.88, 3, 300], [16, 6, 0.7, 3, 20]];
  const SLOT_MAX = [0, 4, 3, 2];
  const FB_VS = [
    'uniform float uTime, uAge; varying vec3 vN, vP; varying float vD;',
    'float hh(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }',
    'float vn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(mix(hh(i), hh(i + vec3(1,0,0)), f.x), mix(hh(i + vec3(0,1,0)), hh(i + vec3(1,1,0)), f.x), f.y), mix(mix(hh(i + vec3(0,0,1)), hh(i + vec3(1,0,1)), f.x), mix(hh(i + vec3(0,1,1)), hh(i + vec3(1,1,1)), f.x), f.y), f.z); }',
    'void main(){ float d = vn(normal * 3.0 + uTime * 1.5) * 0.6 + vn(normal * 7.0 - uTime * 2.0) * 0.4; vD = d;',
    '  vec3 p = position * (1.0 + (d - 0.5) * (0.25 + uAge * 0.3)); vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(p, 1.0); vP = -mv.xyz;',
    '  gl_Position = projectionMatrix * mv; }'
  ].join('\n');
  const FB_FS = [
    'uniform float uAge; varying vec3 vN, vP; varying float vD;',
    'void main(){ float mu = clamp(dot(normalize(vN), normalize(vP)), 0.0, 1.0);',
    '  float heat = clamp(mu * 1.05 * (1.0 - uAge * 0.85) + (vD - 0.5) * 1.1, 0.0, 1.0);',
    '  vec3 c = mix(vec3(0.12, 0.015, 0.0), vec3(1.5, 0.38, 0.04), smoothstep(0.15, 0.55, heat));',
    '  c = mix(c, vec3(2.6, 1.7, 0.6), smoothstep(0.6, 0.98, heat));',
    '  float a = smoothstep(0.0, 0.25, mu) * (1.0 - smoothstep(0.75, 1.0, uAge));',
    '  gl_FragColor = vec4(c * a, 1.0); }'
  ].join('\n');
  function fbRadius(L, t) { const E = Math.pow(2, L); return 1.4 * Math.pow(E / 8, 0.2) * Math.pow(Math.max(0, t), 0.4); } // Taylor–Sedov, scaled to the desk
  function pageTexture(X, side) {
    return X.canvasTexture(512, 700, (x, w, h) => {
      const g = x.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, w * 0.8); g.addColorStop(0, '#efe2c2'); g.addColorStop(1, '#c9b48a'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      const r = prng(side ? 31 : 32);
      for (let i = 0; i < 30; i++) { x.fillStyle = `rgba(120,80,30,${r() * 0.05})`; x.beginPath(); x.arc(r() * w, r() * h, 10 + r() * 50, 0, TAU); x.fill(); }
      for (let row = 0; row < 22; row++) {
        const py = 50 + row * 28; if (!side && row > 4 && row < 15) continue;
        let px = 40; while (px < w - 50) { const gi = Math.floor(r() * 16), s = 20; x.drawImage(scriptSprite('book', RUNE_SCRIPT, gi, '60,30,18', '45,22,12', 0, 48), px, py - s / 2, s, s); px += s * (0.75 + r() * 0.4); if (r() < 0.15) px += 12; }
      }
      if (!side) { x.strokeStyle = 'rgba(130,20,25,0.85)'; x.lineWidth = 2; x.beginPath(); x.arc(w / 2, 330, 120, 0, TAU); x.stroke(); starPoly2D(x, w / 2, 330, 120, 7, 3); x.beginPath(); x.arc(w / 2, 330, 50, 0, TAU); x.stroke(); }
    });
  }
  function bentPage(T, w, d, curl) { const g = new T.PlaneGeometry(w, d, 24, 1); g.rotateX(-Math.PI / 2); g.translate(w / 2, 0, 0); const P = g.attributes.position; for (let i = 0; i < P.count; i++) { const u = clamp(P.getX(i) / w, 0, 1); P.setY(i, curl * Math.sin(Math.PI * Math.pow(u, 0.6)) * (1 - 0.3 * u)); } g.computeVertexNormals(); return g; }
  function candle(T, sc, x, z, hgt, shadow) {
    const grp = new T.Group(); grp.position.set(x, 0, z); sc.add(grp);
    const brass = std(T, { color: 0xb8893a, metalness: 1, roughness: 0.3, envMapIntensity: 0.6 });
    const holder = new T.Mesh(new T.LatheGeometry([[0, 0], [0.22, 0], [0.24, 0.02], [0.2, 0.04], [0.06, 0.06], [0.05, 0.14], [0.09, 0.16], [0.09, 0.19], [0, 0.19]].map((p) => new T.Vector2(p[0], p[1])), 40), brass); holder.castShadow = holder.receiveShadow = true; grp.add(holder);
    const wax = new T.Mesh(new T.LatheGeometry([[0, 0], [0.075, 0], [0.075, hgt - 0.03], [0.068, hgt], [0.03, hgt - 0.01], [0, hgt - 0.015]].map((p) => new T.Vector2(p[0], p[1])), 32), std(T, { color: 0xf1e6cb, roughness: 0.55, emissive: new T.Color(0.25, 0.1, 0.02), emissiveIntensity: 0.4 }));
    wax.position.y = 0.19; wax.castShadow = true; grp.add(wax);
    const fm = new T.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uPh: { value: Math.random() * 10 } }, vertexShader: FLAME_VS, fragmentShader: FLAME_FS, transparent: true, blending: T.AdditiveBlending, depthWrite: false });
    const flame = new T.Mesh(new T.LatheGeometry([[0, 0], [0.022, 0.03], [0.026, 0.06], [0.015, 0.11], [0, 0.15]].map((p) => new T.Vector2(p[0], p[1])), 24, 0, TAU).scale(1, 1, 1), fm);
    flame.position.y = 0.19 + hgt - 0.005; grp.add(flame);
    const L = new T.PointLight(0xffa451, 7, 9, 2); L.position.y = 0.19 + hgt + 0.08; grp.add(L);
    if (shadow) { L.castShadow = true; L.shadow.mapSize.set(512, 512); L.shadow.bias = -0.004; }
    return { flame, L, ph: Math.random() * 10 };
  }
  addMode(Object.assign({}, quiet, {
    id: 'fa_spell', name: 'SPELLBOOK', glyphs: SCRIPT_GLYPHS,
    base: [265, 40, 82], palette: [[275, 90, 70], [190, 100, 64], [45, 100, 64], [320, 95, 68]],
    links: LINKS3D, count: 72, pageBg: ['#0c0814', '#030205'],
    shapes: ['sphere', 'dodecahedron', 'compound_five_tetrahedra', 'great_dodecahedron', 'small_stellated_dodecahedron', 'stella_octangula', 'rhombicosidodecahedron', 'cell24'],
    init(S) { Object.assign(S.data, { slots: [0, 4, 3, 2], lastRegen: S.now, flip: null, nextFlip: S.now + 4000, prog: SPELL_POLYS.map(() => 0), tilt: 0, fb: null, bolt: null, casts: 0, fizzle: 0 }); },
    update(S, now, dt) {
      const D = S.data, k = dt / 16.7;
      if (now - D.lastRegen > 10000) { D.lastRegen = now; for (let l = 1; l <= 3; l++) if (D.slots[l] < SLOT_MAX[l]) { D.slots[l]++; break; } } // a short rest
      D.tilt = lerp(D.tilt, S.holding ? 1 : 0, 1 - Math.pow(0.95, k));
      SPELL_POLYS.forEach((p, i) => { const on = (S.holding ? S.stage : -1) >= p[3] || (!S.holding && p[3] === 0); D.prog[i] = clamp(D.prog[i] + (on ? 1 : -1.5) * dt / 800, 0, 1); });
      if (now > D.nextFlip && !D.flip) { D.flip = { t: now, dur: S.holding ? 520 - 100 * S.stage : 900 }; D.nextFlip = now + (S.holding ? 600 - 120 * S.stage : rand(5000, 8000)); }
      if (D.flip && now - D.flip.t > D.flip.dur) D.flip = null;
      const b = D.bolt;
      if (b && now - b.t > b.dur) { D.bolt = null; D.fb = { t: now, p: b.to.clone(), L: b.L }; cineFlash(S, D, 0.2 + 0.1 * b.L); }
      if (D.fb && now - D.fb.t > 2600) D.fb = null;
    },
    three: {
      init(S, X) {
        const T = X.THREE, sc = X.scene, D = S.data;
        X.maxPixelRatio = 1.25; X.setBloom(0.95, 0.55, 0.8); setExpo(X, 1.1); X.studioEnvironment();
        sc.background = new T.Color(0x040306); sc.fog = new T.FogExp2(0x040306, 0.05);
        const desk = new T.Mesh(new T.BoxGeometry(9, 0.25, 5.5), std(T, { map: repeatTex(woodTex(X, '#3a2111', '18,8,2', 13, 1024, 512), T, 2, 1), roughness: 0.42, envMapIntensity: 0.3 })); desk.position.y = -0.125; desk.receiveShadow = true; sc.add(desk);
        const wall = new T.Mesh(new T.PlaneGeometry(24, 12), std(T, { map: repeatTex(X.canvasTexture(512, 512, (x, w, h) => noiseFill(x, w, h, '#16121a', 0.1, 9000, 23, 5)), T, 4, 2), roughness: 1 })); wall.position.set(0, 3, -4.2); wall.receiveShadow = true; sc.add(wall);
        const books = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), std(T, { roughness: 0.7 }), 150), o = new T.Object3D(), col = new T.Color(), r = prng(5);
        let bi = 0; const shelfM = std(T, { map: woodTex(X, '#2a170c', '10,4,0', 21), roughness: 0.6 });
        for (let s = 0; s < 3; s++) {
          const y = 1.0 + s * 1.25, sh = new T.Mesh(new T.BoxGeometry(8.4, 0.08, 0.7), shelfM); sh.position.set(0, y, -3.85); sh.receiveShadow = true; sc.add(sh);
          let x = -4.1; while (x < 4.1 && bi < 150) { const w = 0.08 + r() * 0.12, hgt = 0.6 + r() * 0.42; o.position.set(x + w / 2, y + 0.04 + hgt / 2, -3.85); o.rotation.set(0, 0, r() < 0.06 ? 0.2 : 0); o.scale.set(w - 0.01, hgt, 0.5 + r() * 0.12); o.updateMatrix(); books.setMatrixAt(bi, o.matrix); books.setColorAt(bi, col.setHSL([0.0, 0.08, 0.6, 0.33, 0.75][Math.floor(r() * 5)], 0.4, 0.05 + r() * 0.08)); bi++; x += w; }
        }
        books.count = bi; books.receiveShadow = true; sc.add(books);
        // the open book
        const leather = std(T, { map: X.canvasTexture(256, 256, (x, w, h) => noiseFill(x, w, h, '#4a1410', 0.3, 5000, 3, 2)), roughness: 0.6 });
        const cover = new T.Mesh(new T.BoxGeometry(2.8, 0.05, 1.9), leather); cover.position.set(0, 0.025, 0.2); cover.castShadow = cover.receiveShadow = true; sc.add(cover);
        const paperM = std(T, { color: 0xe8dcc0, roughness: 0.95 });
        for (const s of [-1, 1]) { const blk = new T.Mesh(new T.BoxGeometry(1.3, 0.1, 1.78), paperM); blk.position.set(s * 0.67, 0.1, 0.2); blk.castShadow = blk.receiveShadow = true; sc.add(blk); }
        const pgL = new T.Mesh(bentPage(T, 1.32, 1.78, 0.07), std(T, { map: pageTexture(X, 0), roughness: 0.9, side: T.DoubleSide })); pgL.scale.x = -1; pgL.position.set(0, 0.15, 0.2); pgL.receiveShadow = true; sc.add(pgL);
        const pgR = new T.Mesh(bentPage(T, 1.32, 1.78, 0.07), std(T, { map: pageTexture(X, 1), roughness: 0.9, side: T.DoubleSide })); pgR.position.set(0, 0.15, 0.2); pgR.receiveShadow = true; sc.add(pgR);
        const flipG = new T.PlaneGeometry(1.32, 1.78, 24, 1); flipG.rotateX(-Math.PI / 2);
        const flipP = new T.Mesh(flipG, std(T, { map: pgR.material.map, roughness: 0.9, side: T.DoubleSide })); flipP.position.set(0, 0.16, 0.2); flipP.visible = false; flipP.castShadow = true; sc.add(flipP);
        // candles, an ink bottle
        const cands = [candle(T, sc, -2.1, -0.5, 0.75, true), candle(T, sc, 2.2, -0.9, 0.55, false), candle(T, sc, 2.75, 0.5, 0.35, false)];
        const glass = new T.MeshPhysicalMaterial({ color: 0xbfd6e6, metalness: 0, roughness: 0.05, transmission: 0.92, transparent: true, opacity: 1, envMapIntensity: 1, clearcoat: 1 });
        const bottle = new T.Mesh(new T.LatheGeometry([[0, 0], [0.22, 0], [0.24, 0.03], [0.24, 0.26], [0.1, 0.36], [0.08, 0.46], [0.1, 0.48], [0, 0.48]].map((p) => new T.Vector2(p[0], p[1])), 40), glass); bottle.position.set(-1.9, 0, 1.05); sc.add(bottle);
        const ink = new T.Mesh(new T.LatheGeometry([[0, 0.01], [0.2, 0.01], [0.21, 0.18], [0, 0.18]].map((p) => new T.Vector2(p[0], p[1])), 32), std(T, { color: 0x0a0c22, roughness: 0.1 })); ink.position.copy(bottle.position); sc.add(ink);
        sc.add(new T.HemisphereLight(0x2a2240, 0x0a0604, 0.35));
        const key = new T.SpotLight(0x8e9cff, 9, 25, 0.5, 0.8, 2); key.position.set(4, 6, 4); key.target.position.set(0, 0, 0); sc.add(key); sc.add(key.target);
        // the magic circle: rings, ticks, a band of runes, and star polygons {n/k}
        const circ = new T.Group(); sc.add(circ); const spin = new T.Group(); circ.add(spin);
        const ringLine = (rad, c) => { const pts = []; for (let i = 0; i <= 128; i++) { const a = i / 128 * TAU; pts.push(new T.Vector3(Math.cos(a) * rad, Math.sin(a) * rad, 0)); } const L = new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: c, transparent: true, blending: T.AdditiveBlending, depthWrite: false })); return L; };
        const ringMats = [];
        [1.34, 1.5, 0.42].forEach((rad) => { const L = ringLine(rad, new T.Color(1.4, 1.0, 2.6)); ringMats.push(L.material); spin.add(L); });
        const tick = []; for (let i = 0; i < 72; i++) { const a = i / 72 * TAU, l = i % 6 ? 0.04 : 0.09; tick.push(Math.cos(a) * 1.5, Math.sin(a) * 1.5, 0, Math.cos(a) * (1.5 - l), Math.sin(a) * (1.5 - l), 0); }
        const tg = new T.BufferGeometry(); tg.setAttribute('position', new T.Float32BufferAttribute(tick, 3)); const ticks = new T.LineSegments(tg, new T.LineBasicMaterial({ color: new T.Color(1.2, 0.9, 2.2), transparent: true, blending: T.AdditiveBlending, depthWrite: false })); ringMats.push(ticks.material); spin.add(ticks);
        const runeT = X.canvasTexture(1024, 1024, (x) => { for (let i = 0; i < 36; i++) { const a = i / 36 * TAU, rr = 1.42 / 1.5 * 512; x.save(); x.translate(512 + Math.cos(a) * rr, 512 - Math.sin(a) * rr); x.rotate(-a + Math.PI / 2); x.drawImage(glyphSprite(RUNE_SCRIPT[i % 16], '255,255,255', '255,255,255', 64, 0.8), -26, -26, 52, 52); x.restore(); } });
        // the rune band: a pulse of light runs around it, faster as the spell builds
        const bandM = new T.ShaderMaterial({ uniforms: { map: { value: runeT }, uTime: { value: 0 }, uSpeed: { value: 1 }, uCol: { value: new T.Vector3(1.6, 1.1, 2.8) }, uOp: { value: 1 } },
          vertexShader: 'varying vec2 vUv; varying vec3 vP; void main(){ vUv = uv; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
          fragmentShader: 'uniform sampler2D map; uniform float uTime, uSpeed, uOp; uniform vec3 uCol; varying vec2 vUv; varying vec3 vP; void main(){ vec4 t = texture2D(map, vUv); float a = atan(vP.y, vP.x); float w = 0.45 + 2.2 * pow(0.5 + 0.5 * sin(a * 3.0 - uTime * uSpeed), 8.0); gl_FragColor = vec4(uCol * t.rgb * t.a * w * uOp, 1.0); }',
          transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
        const band = new T.Mesh(new T.RingGeometry(1.35, 1.5, 128, 1), bandM);
        band.geometry.attributes.uv.array.forEach((v, i, a) => { const P = band.geometry.attributes.position; if (i % 2 === 0) { a[i] = P.getX(i / 2) / 3 + 0.5; a[i + 1] = P.getY(i / 2) / 3 + 0.5; } });
        spin.add(band);
        const polys = SPELL_POLYS.map(([n, k, rf, , hue]) => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(starSegments(n, k, 1.34 * rf), 3)); const c = new T.Color().setHSL(hue / 360, 1, 0.6).multiplyScalar(2.2); const L = new T.LineSegments(g, new T.LineBasicMaterial({ color: c, transparent: true, blending: T.AdditiveBlending, depthWrite: false })); L.userData.n = n; spin.add(L); return L; });
        const circL = new T.PointLight(0xa58cff, 0, 8, 2); circ.add(circL);
        const fbM = new T.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uAge: { value: 0 } }, vertexShader: FB_VS, fragmentShader: FB_FS, transparent: true, blending: T.AdditiveBlending, depthWrite: false });
        const fb = new T.Mesh(new T.SphereGeometry(1, 64, 48), fbM); fb.visible = false; sc.add(fb);
        const shock = new T.Mesh(new T.RingGeometry(0.96, 1.0, 96), new T.MeshBasicMaterial({ color: new T.Color(2.5, 1.6, 0.9), transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); shock.visible = false; sc.add(shock);
        const haze = addHaze(X);
        const fireL = new T.PointLight(0xff8a3a, 0, 30, 2); fireL.castShadow = true; fireL.shadow.mapSize.set(512, 512); fireL.shadow.bias = -0.004; sc.add(fireL);
        const B = pointBatch(X, 240, 'glyph', scriptAtlas(X, RUNE_SCRIPT), 4), Lk = linkLines(X, 240), embers = particles(X, 600, 'add'), smoke = particles(X, 160, 'smoke');
        Object.assign(D, { g: { haze, bandM, cands, circ, spin, ringMats, polys, circL, fb, fbM, shock, fireL, flipP, flipG, pgR, B, Lk, embers, smoke, bead: new T.Vector3() } });
      },
      update(S, X, now, dt) {
        const D = S.data, G3 = D.g; if (!G3) return; applyFlash(S, X, D);
        camOrbit(S, X, D, { t: [0, 0.75, 0.1], r: 6.4, el: 0.5, speed: 0.00004, sweep: 0.35, dolly: 0.12 });
        for (const c of G3.cands) { c.flame.material.uniforms.uTime.value = now / 1000; const f = 0.85 + 0.15 * Math.sin(now * 0.017 + c.ph) * Math.sin(now * 0.0063 + c.ph * 2); c.flame.scale.set(1, f * (1 + 0.1 * Math.sin(now * 0.03 + c.ph)), 1); c.flame.rotation.z = 0.08 * Math.sin(now * 0.004 + c.ph) + (D.cpx || 0) * 0.3; c.L.intensity = 6.5 * f; }
        // the circle rises from the page and turns to face you while you channel
        const t = D.tilt, p = power(S), pulse = 0.8 + 0.2 * Math.sin(now * 0.004 * (1 + S.stage));
        G3.circ.position.set(0, lerp(0.42, 1.75, t), lerp(0.2, 0.5, t)); G3.circ.rotation.set(lerp(-Math.PI / 2, -0.32, t), 0, 0);
        G3.circ.scale.setScalar(lerp(0.62, 1, t));
        G3.spin.rotation.z = now * 0.00012 * (1 + S.stage);
        G3.ringMats.forEach((m) => { m.opacity = (0.45 + 0.55 * p) * pulse; });
        G3.polys.forEach((L, i) => { const n = L.userData.n, pr = D.prog[i]; L.geometry.setDrawRange(0, Math.floor(pr * n) * 2); L.rotation.z = (i % 2 ? -1 : 1) * now * 0.0002 * (1 + i * 0.3); L.material.opacity = (0.5 + 0.5 * p) * pulse; });
        G3.circL.intensity = 4 + 30 * p; G3.bandM.uniforms.uTime.value = now / 1000; G3.bandM.uniforms.uSpeed.value = 1.5 + 3 * S.stage; G3.bandM.uniforms.uOp.value = (0.55 + 0.6 * p) * pulse;
        // a page turning about the spine, curling as it goes
        if (D.flip) {
          const f = (now - D.flip.t) / D.flip.dur, phi = smooth(0, 1, f) * Math.PI, P = G3.flipG.attributes.position, W = 1.32, cols = 25;
          let x = 0, y = 0;
          for (let i = 0; i < cols; i++) {
            const s = i / (cols - 1), a = phi - 0.9 * Math.sin(phi) * s;
            if (i) { x += Math.cos(a) * W / (cols - 1); y += Math.sin(a) * W / (cols - 1); }
            P.setXYZ(i, x, y, -0.89); P.setXYZ(i + cols, x, y, 0.89);
          }
          P.needsUpdate = true; G3.flipG.computeVertexNormals(); G3.flipP.visible = true;
        } else G3.flipP.visible = false;
        // the bolt, then the fireball: R = ξ (E t² / ρ)^(1/5)
        const b = D.bolt;
        if (b) { const f = (now - b.t) / b.dur; G3.bead.copy(b.from).lerp(b.to, f); G3.bead.y += Math.sin(f * Math.PI) * 0.5; G3.fireL.position.copy(G3.bead); G3.fireL.intensity = 30; G3.embers.add({ x: G3.bead.x, y: G3.bead.y, z: G3.bead.z, vx: rand(-0.2, 0.2), vy: rand(-0.2, 0.2), vz: rand(-0.2, 0.2), drag: 0.3, t: now, life: 300, s: 0.18, T: 1400, k: 3 }); }
        const fb = D.fb;
        if (fb) {
          const tt = (now - fb.t) / 1000, R = fbRadius(fb.L, tt), age = clamp(tt / 2.4, 0, 1);
          G3.fb.visible = true; G3.fb.position.copy(fb.p); G3.fb.scale.setScalar(Math.max(0.01, R)); G3.fbM.uniforms.uTime.value = tt; G3.fbM.uniforms.uAge.value = age;
          G3.shock.visible = tt < 1.6; G3.shock.position.copy(fb.p); G3.shock.lookAt(X.camera.position); G3.shock.scale.setScalar(R * 1.12); G3.shock.material.opacity = clamp(1 - tt / 1.6, 0, 1);
          G3.fireL.position.copy(fb.p); G3.fireL.intensity = 260 * Math.pow(1 - age, 2) * (S.reduceMotion ? 0.5 : 1);
          if (tt < 0.5) for (let q = 0; q < 6; q++) { const a = rand(0, TAU), e = rand(-1, 1), v = R / Math.max(0.05, tt) * 0.4 * rand(0.8, 1.6), c = Math.sqrt(1 - e * e); G3.embers.add({ x: fb.p.x, y: fb.p.y, z: fb.p.z, vx: Math.cos(a) * c * v, vy: e * v, vz: Math.sin(a) * c * v, g: 4, drag: 0.35, t: now, life: rand(700, 1400), s: 0.05, T: 1300, k: 3 }); }
          if (tt > 0.6 && Math.random() < 0.5) G3.smoke.add({ x: fb.p.x + rand(-R, R) * 0.5, y: fb.p.y + R * 0.3, z: fb.p.z + rand(-R, R) * 0.5, vx: 0, vy: 0.6, vz: 0, drag: 0.8, g: -0.2, t: now, life: 2400, s: R * 0.35, grow: 2, c: [0.03, 0.025, 0.03], a: 0.4 });
          setHaze(S, X, G3.haze, fb.p, 1.3 * (1 - age), 0.25 + R * 0.12);
        } else { G3.fb.visible = false; G3.shock.visible = false; if (!b) G3.fireL.intensity = 0; setHaze(S, X, G3.haze, G3.circ.position, S.holding ? 0.25 * S.stage : 0, 0.3); }
        G3.embers.step(now, dt, (pp, kk) => { pp.T -= 300 * kk; if (pp.y < 0.01) { pp.y = 0.01; pp.vy *= -0.3; } });
        G3.smoke.step(now, dt);
        const pale = [0.55, 0.45, 0.9];
        G3.circ.updateMatrixWorld();
        const cc = new X.THREE.Vector3(0, 0, 0.75).applyMatrix4(G3.circ.matrixWorld);
        drawLetters(S, G3.B, [cc.x, cc.y, cc.z], 0.75, (n) => (n.inf ? palLin(S, n.gen, 2.2) : pale), () => 0.17, (n) => glyphIndex(n.g) % 16,
          fb ? (n, v) => { const tt = (now - fb.t) / 1000, R = fbRadius(fb.L, tt), dx = v.x - fb.p.x, dy = v.y - fb.p.y, dz = v.z - fb.p.z, r = Math.hypot(dx, dy, dz) + 1e-3, f = clamp(1 - tt / 2.4, 0, 1); if (r < R) { const push = (R - r) * 0.7 * f / r; v.x += dx * push; v.y += dy * push; v.z += dz * push; } } : null);
        G3.Lk.update(S, (g) => palLin(S, g, 1.6));
      }
    },
    onTap(S) { const D = S.data; if (!D.flip) { D.flip = { t: S.now, dur: 900 }; D.nextFlip = S.now + rand(5000, 8000); } },
    onRelease(S, held) {
      const D = S.data, X = S.three;
      if (held < S.STAGES[1] || !X || !D.g) return false;
      const L = clamp(S.stage || Math.floor(held / 1500), 1, 3);
      let lv = L; while (lv > 0 && !D.slots[lv]) lv--;
      if (!lv) { D.fizzle = S.now; return false; }
      D.slots[lv]--; D.casts++;
      const to = rayToY(S, X, S.ptr.x, S.ptr.y, 0.9); to.x = clamp(to.x, -3.6, 3.6); to.z = clamp(to.z, -2.2, 2.2);
      D.bolt = { t: S.now, dur: 320, from: D.g.circ.position.clone(), to, L: lv };
      return false;
    },
    hud(S) {
      const D = S.data, sl = [1, 2, 3].map((l) => `${l}:` + '●'.repeat(D.slots[l]) + '○'.repeat(SLOT_MAX[l] - D.slots[l])).join(' ');
      if (D.fb) { const t = (S.now - D.fb.t) / 1000, R = fbRadius(D.fb.L, t); return `fireball, level ${D.fb.L} · t ${t.toFixed(2)} s · R ${R.toFixed(2)} m · R = ξ(E·t²/ρ)^⅕, so R ∝ t^0.4 and E ∝ R⁵: how G. I. Taylor read a blast's energy off photographs`; }
      if (S.now - D.fizzle < 3000) return `the spell fizzles: no slots left · one comes back every 10 s · slots ${sl}`;
      if (S.holding) {
        const i = [0, 1, 3, 4][S.stage], [n, k] = SPELL_POLYS[i], g = gcd(n, k);
        return `channeling level ${clamp(S.stage, 1, 3)} · drawing {${n}/${k}}: ${g === 1 ? `gcd(${n},${k}) = 1, one unbroken stroke` : `gcd = ${g}, ${g} separate {${n / g}/${k / g}}`} · slots ${sl}`;
      }
      return `spell slots ${sl} · hold to channel ({5/2} → {7/3} → {9/4}, {6/2} = 2×{3} → {12/5}, {16/6} = 2×{8/3}) · release to cast at the pointer`;
    }
  }));

  /* ======================= 6. NECROMANCY ======================= */
  const BONE_SCRIPT = makeScript(0xDEAD, 16, 'bone');
  const HALF = 3; // half-life of a soul, in seconds
  const LAMBDA = Math.LN2 / HALF;
  function tombShape(T, kind) {
    const s = new T.Shape();
    if (kind === 0) { s.moveTo(-0.35, 0); s.lineTo(-0.35, 0.8); s.absarc(0, 0.8, 0.35, Math.PI, 0, true); s.lineTo(0.35, 0); }
    else if (kind === 1) { const t = 0.1; s.moveTo(-t, 0); s.lineTo(-t, 0.85); s.lineTo(-0.38, 0.85); s.lineTo(-0.38, 1.05); s.lineTo(-t, 1.05); s.lineTo(-t, 1.35); s.lineTo(t, 1.35); s.lineTo(t, 1.05); s.lineTo(0.38, 1.05); s.lineTo(0.38, 0.85); s.lineTo(t, 0.85); s.lineTo(t, 0); }
    else if (kind === 2) { s.moveTo(-0.26, 0); s.lineTo(-0.18, 1.45); s.lineTo(0, 1.7); s.lineTo(0.18, 1.45); s.lineTo(0.26, 0); }
    else { s.moveTo(-0.4, 0); s.lineTo(-0.4, 0.7); s.lineTo(-0.15, 0.78); s.lineTo(0.02, 0.62); s.lineTo(0.2, 0.74); s.lineTo(0.4, 0.55); s.lineTo(0.4, 0); }
    s.closePath(); return s;
  }
  addMode(Object.assign({}, quiet, {
    id: 'fa_necro', name: 'NECROMANCY', glyphs: SCRIPT_GLYPHS,
    base: [60, 15, 82], palette: [[130, 100, 58], [150, 100, 62], [95, 100, 60], [170, 90, 66]],
    links: LINKS3D, count: 'random', pageBg: ['#050c08', '#010302'],
    shapes: ['sphere', 'mandelbulb', 'urchin', 'great_icosahedron', 'menger', 'thomas', 'catenoid', 'dini'],
    init(S) {
      const D = S.data, graves = [], q = prng(13);
      for (let row = 0; row < 3; row++) for (let i = 0; i < 6; i++) graves.push({ x: -5.2 + i * 2.1 + (q() - 0.5) * 0.7 + (row % 2) * 0.9, z: -1.2 - row * 2.2 + (q() - 0.5) * 0.5, kind: Math.floor(q() * 4), yaw: (q() - 0.5) * 0.4, tilt: (q() - 0.5) * 0.2, sc: 0.85 + q() * 0.35 });
      Object.assign(D, { graves, souls: [], decayed: 0, rel: null, series: [], lastSample: 0, births: 0, simT: 0 });
      for (let i = 0; i < 30; i++) D.souls.push(newSoul(D, true));
    },
    update(S, now, dt) {
      const D = S.data, sdt = dt / 1000;
      D.simT += sdt; // the clock the souls decay by
      // births: graves leak souls at β = 30·λ per second, so the crowd settles at N = β/λ = 30; a necromancer pulls many more
      const beta = S.holding ? 30 * LAMBDA * (1 + 4 * S.stage) : D.rel ? 0 : 30 * LAMBDA;
      D.births += beta * sdt;
      while (D.births >= 1) { D.births--; if (D.souls.length < 260) D.souls.push(newSoul(D, false)); }
      const pDecay = 1 - Math.exp(-LAMBDA * sdt), bound = S.holding;
      D.souls = D.souls.filter((s) => {
        if (!bound && Math.random() < pDecay) { D.decayed++; (D.gone || (D.gone = [])).push({ x: s.x, y: s.y, z: s.z, t: now }); return false; } // memoryless: the same chance every instant
        return true;
      });
      if (D.gone && D.gone.length > 60) D.gone.splice(0, D.gone.length - 60);
      if (now - D.lastSample > 100) { D.lastSample = now; D.series.push(D.souls.length); if (D.series.length > 150) D.series.shift(); if (D.rel) D.rel.pts.push([D.simT - D.rel.s0, D.souls.length]); }
      if (D.rel && D.simT - D.rel.s0 > 15) D.rel = null;
    },
    three: {
      init(S, X) {
        const T = X.THREE, sc = X.scene, D = S.data, N3 = X.noise;
        X.maxPixelRatio = 1.25; X.setBloom(0.85, 0.6, 0.75); setExpo(X, 1.1);
        sc.background = new T.Color(0x030805); sc.fog = new T.FogExp2(0x040b07, 0.05);
        const gg = new T.PlaneGeometry(60, 60, 110, 110); gg.rotateX(-Math.PI / 2); const P = gg.attributes.position;
        for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i); P.setY(i, N3 ? N3.noise(x * 0.12, 3, z * 0.12) * 0.5 + N3.noise(x * 0.6, 5, z * 0.6) * 0.06 : 0); }
        gg.computeVertexNormals();
        const dirt = repeatTex(X.canvasTexture(512, 512, (x, w, h) => { noiseFill(x, w, h, '#12160f', 0.4, 15000, 9, 3); const r = prng(3); for (let i = 0; i < 1400; i++) { x.strokeStyle = `rgba(${60 + r() * 40},${80 + r() * 50},${40 + r() * 20},0.5)`; x.lineWidth = 1; const gx = r() * w, gy = r() * h; x.beginPath(); x.moveTo(gx, gy); x.lineTo(gx + (r() - 0.5) * 4, gy - 4 - r() * 8); x.stroke(); } }), T, 14, 14);
        const ground = new T.Mesh(gg, std(T, { map: dirt, roughness: 1 })); ground.receiveShadow = true; sc.add(ground);
        const stoneT = X.canvasTexture(512, 512, (x, w, h) => { noiseFill(x, w, h, '#5b5e58', 0.4, 16000, 7, 3); const r = prng(8); for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(${90 + r() * 40},${120 + r() * 40},${70},${0.25 + r() * 0.3})`; x.beginPath(); x.arc(r() * w, r() * h, 3 + r() * 14, 0, TAU); x.fill(); } });
        const stoneM = std(T, { map: repeatTex(stoneT, T, 1.5, 1.5), roughness: 0.92, bumpMap: stoneT, bumpScale: 0.02 });
        const epitaph = X.canvasTexture(256, 256, (x) => { const r = prng(4); x.clearRect(0, 0, 256, 256); for (let row = 0; row < 5; row++) { let px = 34; while (px < 210) { x.drawImage(scriptSprite('ep', BONE_SCRIPT, Math.floor(r() * 16), '25,25,22', '15,15,12', 0, 48), px, 40 + row * 38, 30, 30); px += 28 + r() * 8; } } });
        const epM = std(T, { map: epitaph, transparent: true, roughness: 1, depthWrite: false });
        for (const gv of D.graves) {
          const depth = gv.kind === 2 ? 0.26 : 0.17, geo = new T.ExtrudeGeometry(tombShape(T, gv.kind), { depth, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 16 });
          geo.translate(0, 0, -depth / 2);
          const m = new T.Mesh(geo, stoneM); m.position.set(gv.x, -0.06, gv.z); m.rotation.set(gv.tilt, gv.yaw, gv.tilt * 0.5); m.scale.setScalar(gv.sc); m.castShadow = m.receiveShadow = true; sc.add(m);
          if (gv.kind !== 2) { const ep = new T.Mesh(new T.PlaneGeometry(0.46, 0.46), epM); ep.position.set(0, gv.kind === 1 ? 0.5 : 0.48, depth / 2 + 0.022); m.add(ep); }
        }
        // iron fence
        const iron = std(T, { color: 0x141414, metalness: 0.7, roughness: 0.55 });
        const posts = new T.InstancedMesh(new T.CylinderGeometry(0.022, 0.022, 1.5, 6), iron, 46), tips = new T.InstancedMesh(new T.ConeGeometry(0.05, 0.16, 6), iron, 46), o = new T.Object3D();
        for (let i = 0; i < 46; i++) { const x = -10 + i * 0.45; o.position.set(x, 0.75, -8.2); o.rotation.set(0, 0, 0); o.updateMatrix(); posts.setMatrixAt(i, o.matrix); o.position.y = 1.55; o.updateMatrix(); tips.setMatrixAt(i, o.matrix); }
        posts.castShadow = tips.castShadow = true; sc.add(posts); sc.add(tips);
        for (const y of [0.35, 1.25]) { const rail = new T.Mesh(new T.BoxGeometry(20.6, 0.04, 0.04), iron); rail.position.set(0.1, y, -8.2); sc.add(rail); }
        // two dead trees, grown by recursion
        const barkM = std(T, { color: 0x1a1612, roughness: 0.95 }), br = new T.InstancedMesh(new T.CylinderGeometry(0.6, 1, 1, 7), barkM, 400); let bc = 0; const rq = prng(51);
        const grow = (x, y, z, dir, len, rad, depth) => {
          if (depth === 0 || bc >= 400) return;
          const end = new T.Vector3(x, y, z).addScaledVector(dir, len);
          o.position.set((x + end.x) / 2, (y + end.y) / 2, (z + end.z) / 2); o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir); o.scale.set(rad, len, rad); o.updateMatrix(); br.setMatrixAt(bc++, o.matrix);
          const n = 2;
          for (let i = 0; i < n; i++) { const d = dir.clone().add(new T.Vector3((rq() - 0.5) * 1.3, (rq() - 0.2) * 0.6, (rq() - 0.5) * 1.3)).normalize(); grow(end.x, end.y, end.z, d, len * (0.62 + rq() * 0.15), rad * 0.62, depth - 1); }
        };
        grow(-5.6, 0, -6.2, new T.Vector3(0.1, 1, 0).normalize(), 2.6, 0.22, 7); grow(6.0, 0, -7.2, new T.Vector3(-0.15, 1, 0.05).normalize(), 2.3, 0.18, 7);
        br.count = bc; br.castShadow = true; sc.add(br);
        // the moon and its light
        const moonT = X.canvasTexture(512, 512, (x, w, h) => { x.fillStyle = '#e8efe2'; x.fillRect(0, 0, w, h); const r = prng(66); for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(110,130,110,${0.1 + r() * 0.25})`; x.beginPath(); x.arc(r() * w, r() * h, 8 + r() * 50, 0, TAU); x.fill(); } });
        const moon = new T.Mesh(new T.SphereGeometry(5, 48, 32), new T.MeshBasicMaterial({ map: moonT, color: new T.Color(1.5, 1.65, 1.45), fog: false })); moon.position.set(-16, 17, -70); sc.add(moon);
        const ml = new T.DirectionalLight(0xc8e8d0, 1.0); ml.position.set(-9, 10, -30); ml.target.position.set(0, 0, -3); ml.castShadow = true; ml.shadow.mapSize.set(2048, 2048);
        Object.assign(ml.shadow.camera, { left: -12, right: 12, top: 10, bottom: -8, near: 5, far: 70 }); ml.shadow.bias = -0.0006; sc.add(ml); sc.add(ml.target);
        sc.add(new T.HemisphereLight(0x2a4434, 0x050805, 0.18));
        const soulL = new T.PointLight(0x55ff88, 0, 12, 2); soulL.position.set(0, 2.2, -1.6); sc.add(soulL);
        // ground mist: drifting translucent layers
        const mistT = X.canvasTexture(512, 512, (x, w, h) => { x.clearRect(0, 0, w, h); const r = prng(12); for (let i = 0; i < 70; i++) { const cx = r() * w, cy = r() * h, rr = 30 + r() * 90, g = x.createRadialGradient(cx, cy, 0, cx, cy, rr); g.addColorStop(0, 'rgba(200,230,210,0.22)'); g.addColorStop(1, 'rgba(200,230,210,0)'); x.fillStyle = g; for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) x.fillRect(cx - rr + dx, cy - rr + dy, rr * 2, rr * 2); } });
        mistT.wrapS = mistT.wrapT = T.RepeatWrapping;
        const mists = [0.12, 0.35, 0.6, 0.95].map((y, i) => { const t = mistT.clone(); t.needsUpdate = true; t.repeat.set(2.5, 2.5); const m = new T.Mesh(new T.PlaneGeometry(40, 40), new T.MeshBasicMaterial({ map: t, color: new T.Color(0.42, 0.56, 0.46), transparent: true, opacity: 0.16 - i * 0.025, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(0, y, -2); sc.add(m); return m; });
        const haze = addHaze(X);
        const B = pointBatch(X, 260, 'glyph', scriptAtlas(X, BONE_SCRIPT), 4), rise = pointBatch(X, 60, 'glyph', B.mat.uniforms.map.value, 4), Lk = linkLines(X, 260), wisps = pointBatch(X, 1100, 'add');
        Object.assign(D, { g: { haze, soulL, mists, B, rise, Lk, wisps } });
      },
      update(S, X, now, dt) {
        const D = S.data, G3 = D.g; if (!G3) return; applyFlash(S, X, D);
        const k = dt / 1000;
        camOrbit(S, X, D, { t: [0, 1.3, -1.8], r: 8.6, el: 0.17, speed: 0.00003, sweep: 0.35, dolly: 0.15 });
        G3.mists.forEach((m, i) => { m.material.map.offset.x = now * 0.000012 * (i % 2 ? 1 : -1.3) + (D.cpx || 0) * 0.05 * (i + 1); m.material.map.offset.y = now * 0.000006 * (i + 1); });
        // souls: wisps drifting over the graves, flinching from the pointer, orbiting the letters when bound
        const ptr = S.ptrInside ? X.fromScreen(S.ptr.x, S.ptr.y, -1.5) : null, act = S.active;
        let n = 0; const W = G3.wisps;
        for (const s of D.souls) {
          s.ph += k * 3;
          let tx = s.hx, ty = s.hy, tz = s.hz;
          if (S.holding && act.length) { const nd = act[s.id % act.length]; if (nd.inf && nd.data.p3) { tx = nd.data.p3[0] + Math.cos(s.ph) * 0.25; ty = nd.data.p3[1] + Math.sin(s.ph * 1.3) * 0.25; tz = nd.data.p3[2] + Math.sin(s.ph) * 0.25; } }
          s.vx += ((tx - s.x) * 0.8 + Math.cos(s.ph * 1.3) * 0.6) * k; s.vy += ((ty - s.y) * 0.8 + Math.sin(s.ph) * 0.5) * k; s.vz += ((tz - s.z) * 0.8 + Math.sin(s.ph * 0.7) * 0.6) * k;
          if (ptr) { const dx = s.x - ptr.x, dy = s.y - ptr.y, dz = s.z - ptr.z, d = Math.hypot(dx, dy, dz) + 0.05; if (d < 1.6) { const f = (1.6 - d) * 6 * k / d; s.vx += dx * f; s.vy += dy * f; s.vz += dz * f; } }
          const dr = Math.pow(0.3, k); s.vx *= dr; s.vy *= dr; s.vz *= dr; s.x += s.vx * k; s.y += s.vy * k; s.z += s.vz * k;
          s.tr.unshift(s.x, s.y, s.z); if (s.tr.length > 15) s.tr.length = 15;
          for (let j = 0; j < s.tr.length && n < W.max; j += 3) { const f = 1 - j / 15; W.set(n++, s.tr[j], s.tr[j + 1], s.tr[j + 2], 0.5 * f * f, 2.4 * f * f, 0.9 * f * f, (j ? 0.12 : 0.2) * (0.6 + 0.4 * f), 0); }
        }
        // a soul that decays leaves a brief flash and a pale glyph rising
        let ri = 0;
        if (D.gone) for (const g of D.gone) { const t = (now - g.t) / 1000; if (t > 2) continue; if (t < 0.3 && n < W.max) { const f = 1 - t / 0.3; W.set(n++, g.x, g.y, g.z, 2 * f, 4 * f, 2.4 * f, 0.5 * f + 0.1, 0); } if (ri < 60) { const f = 1 - t / 2; G3.rise.set(ri++, g.x, g.y + t * 0.6, g.z, 0.5 * f, 0.7 * f, 0.55 * f, 0.18, (Math.floor(g.t) % 16)); } }
        W.n = n; W.sync(); G3.rise.n = ri; G3.rise.sync();
        const inf = S.active.length ? S.infected / S.active.length : 0;
        setHaze(S, X, G3.haze, G3.soulL.position, S.holding ? 0.35 * S.stage : 0, 0.35); // the air bends around bound souls
        G3.soulL.intensity = (S.holding ? 20 + 60 * inf : 4) * (0.85 + 0.15 * Math.sin(now * 0.01));
        const bone = [0.42, 0.4, 0.32];
        drawLetters(S, G3.B, [0, 2.2, -1.6], 1.0, (nd) => (nd.inf ? palLin(S, nd.gen, 2.4) : bone), () => 0.2, (nd) => glyphIndex(nd.g) % 16,
          (nd, v) => { v.y += 0.04 * Math.sin(now * 0.0015 + nd.rx * 4); });
        G3.Lk.update(S, (g) => palLin(S, g, 1.6));
      }
    },
    over(S, ctx) { // the decay chart: an understated instrument readout
      const D = S.data, w = 220, h = 96, x0 = S.W - w - 26, y0 = 64, top = Math.max(40, ...D.series, D.rel ? D.rel.N0 : 0) * 1.1;
      ctx.fillStyle = 'rgba(2,8,5,0.55)'; ctx.fillRect(x0 - 10, y0 - 22, w + 20, h + 36);
      ctx.strokeStyle = 'rgba(150,220,170,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(x0 - 10.5, y0 - 22.5, w + 20, h + 36);
      ctx.font = '10px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      const Y = (v) => y0 + h - v / top * h;
      if (D.rel) {
        const T2 = 12, X2 = (t) => x0 + t / T2 * w, N0 = D.rel.N0;
        ctx.fillStyle = 'rgba(150,220,170,0.1)'; ctx.beginPath();
        for (let i = 0; i <= 40; i++) { const t = i / 40 * T2, e = N0 * Math.exp(-LAMBDA * t); ctx.lineTo(X2(t), Y(e + Math.sqrt(e))); }
        for (let i = 40; i >= 0; i--) { const t = i / 40 * T2, e = N0 * Math.exp(-LAMBDA * t); ctx.lineTo(X2(t), Y(Math.max(0, e - Math.sqrt(e)))); }
        ctx.fill();
        ctx.strokeStyle = 'rgba(235,225,180,0.75)'; ctx.beginPath(); for (let i = 0; i <= 40; i++) { const t = i / 40 * T2; if (i) ctx.lineTo(X2(t), Y(N0 * Math.exp(-LAMBDA * t))); else ctx.moveTo(X2(t), Y(N0)); } ctx.stroke();
        ctx.strokeStyle = 'rgba(150,220,170,0.2)'; ctx.setLineDash([2, 3]); ctx.beginPath(); for (let k2 = 1; k2 <= 3; k2++) { ctx.moveTo(X2(k2 * HALF), y0); ctx.lineTo(X2(k2 * HALF), y0 + h); } ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(160,240,180,0.9)'; for (const p of D.rel.pts) if (p[0] <= T2) ctx.fillRect(X2(p[0]) - 1, Y(p[1]) - 1, 2, 2);
        ctx.fillStyle = 'rgba(200,230,210,0.75)'; ctx.fillText(`N(t) vs N₀·2^(−t/${HALF} s)`, x0, y0 - 8);
      } else {
        ctx.strokeStyle = 'rgba(160,240,180,0.8)'; ctx.beginPath(); D.series.forEach((v, i) => { const X2 = x0 + i / 149 * w; if (i) ctx.lineTo(X2, Y(v)); else ctx.moveTo(X2, Y(v)); }); ctx.stroke();
        ctx.strokeStyle = 'rgba(235,225,180,0.45)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x0, Y(30)); ctx.lineTo(x0 + w, Y(30)); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(200,230,210,0.75)'; ctx.fillText(S.holding ? 'N rising: decay suspended' : 'N, last 15 s · dashed: β/λ = 30', x0, y0 - 8);
      }
    },
    onRelease(S, held) {
      const D = S.data;
      if (held < S.STAGES[1]) return false;
      D.rel = { t: S.now, s0: D.simT, N0: D.souls.length, pts: [] }; cineFlash(S, D, 0.4);
      for (const s of D.souls) { s.hx = rand(-6, 6); s.hy = rand(0.6, 3.5); s.hz = rand(-6, 1.5); s.vx += rand(-3, 3); s.vy += rand(0, 3); s.vz += rand(-3, 3); }
      return false;
    },
    hud(S) {
      const D = S.data, N = D.souls.length;
      if (S.holding) return `binding souls · N = ${N} · decay suspended · the graves give up ${fmt(30 * LAMBDA * (1 + 4 * S.stage), 1)} souls/s`;
      if (D.rel) { const t = D.simT - D.rel.s0, e = D.rel.N0 * Math.exp(-LAMBDA * t); return `N = ${N} · expected ${e.toFixed(1)} ± ${Math.sqrt(e).toFixed(1)} · ${(t / HALF).toFixed(1)} half-lives · no soul knows when; together they keep perfect time`; }
      return `N = ${N} souls · T½ = ${HALF} s · λ = ln2/T½ = ${LAMBDA.toFixed(3)} s⁻¹ · births balance decay at N = β/λ = 30 (secular equilibrium) · ${fmt(D.decayed)} passed on`;
    }
  }));
  function newSoul(D, anywhere) {
    const g = pick(D.graves), x = anywhere ? rand(-6, 6) : g.x + rand(-0.2, 0.2), y = anywhere ? rand(0.5, 3) : 0.3, z = anywhere ? rand(-6, 0.5) : g.z + 0.2;
    return { id: Math.floor(Math.random() * 1e6), x, y, z, vx: 0, vy: anywhere ? 0 : rand(1, 2), vz: 0, ph: rand(0, TAU), hx: rand(-6, 6), hy: rand(0.6, 3.2), hz: rand(-6, 1), tr: [] };
  }

})(window.SPHERE);
