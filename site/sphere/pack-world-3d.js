/* The Sphere: world pack. Ink wash, northern lights, a cathedral rose window, a chessboard, a volcano,
 * a desert dynasty and an origami studio. Everything is procedural and client-side only.
 * Own web styles are prefixed wd_ so they never collide with other packs. */
(function (SP) {
  'use strict';
  if (!SP) return;
  const { TAU, rand, pick, clamp } = SP.util;
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  // A throw inside a hook must not spam the console every frame: every hook is guarded and logs once.
  const addMode = (def) => {
    Object.keys(def).forEach((k) => {
      const f = def[k];
      if (typeof f !== 'function') return;
      let warned = false;
      def[k] = function () { try { return f.apply(this, arguments); } catch (err) { if (!warned) { warned = true; console.error('[pack-world] ' + def.id + '.' + k, err); } return k === 'drawNode' ? true : undefined; } };
    });
    SP.addMode(def);
  };
  const addLink = (key, fn) => { let warned = false; SP.addLink(key, (ctx, L, S) => { try { fn(ctx, L, S); } catch (err) { if (!warned) { warned = true; console.error('[pack-world] link ' + key, err); } } }); };

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
  function drawGlow(ctx, rgb, x, y, r, a) { if (a <= 0.005) return; const c = glow(rgb, r), h = c.width / 2; ctx.globalAlpha = Math.min(1, a); ctx.drawImage(c, x - h, y - h); ctx.globalAlpha = 1; }
  // A canvas in CSS pixels, rebuilt when the size (or the DPR) changes. Lives in S.data, so it is dropped on mode change.
  function layer(S, key, w, h, draw, res) {
    const sc = (res || 1) * S.DPR, k = Math.round(w) + 'x' + Math.round(h) + '@' + sc, old = S.data['_' + key];
    if (old && old._k === k) return old;
    const c = mk(w * sc, h * sc), x = c.getContext('2d');
    x.scale(sc, sc); draw(x, w, h); c._k = k; c._w = w; c._h = h; S.data['_' + key] = c;
    return c;
  }
  const blit = (ctx, c, x, y) => ctx.drawImage(c, x || 0, y || 0, c._w, c._h);
  const power = (S) => (S.holding ? clamp(S.held / S.STAGES[3], 0, 1) : 0);
  const PV0 = { x: 0, y: 0 };
  const pvel = (S) => S.ptrVel || PV0;
  const pspeed = (S) => { const v = pvel(S); return Math.hypot(v.x, v.y); };
  const RM = (S) => !!S.reduceMotion;
  function repel(S, o, r, k) {
    if (!S.ptrInside) return 0;
    const dx = o.x - S.ptr.x, dy = o.y - S.ptr.y, d2 = dx * dx + dy * dy;
    if (d2 > r * r || d2 < 1) return 0;
    const d = Math.sqrt(d2), f = (1 - d / r) * k * (1 + Math.min(4, pspeed(S) * 0.25));
    o.vx += dx / d * f; o.vy += dy / d * f;
    return 1 - d / r;
  }
  function hsl2rgb(h, s, l) {
    s /= 100; l /= 100; h = ((h % 360) + 360) % 360;
    const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
  }
  // A 1D ridge profile: a sum of sines with seeded phases, sampled every `step` px.
  function ridge(r, w, step, base, amp, oct) {
    const ph = Array.from({ length: oct }, () => [r() * TAU, 0.5 + r()]), out = [];
    for (let x = 0; x <= w + step; x += step) {
      let y = 0, a = amp, f = 0.0035;
      for (let o = 0; o < oct; o++) { y += Math.sin(x * f * ph[o][1] + ph[o][0]) * a; a *= 0.5; f *= 2.1; }
      out.push([x, base - Math.abs(y)]);
    }
    return out;
  }

  /* ---------- a small chess rules engine: resolves SAN into moves and checks each one is legal ---------- */
  // A historical game, replayed move for move (Ruy Lopez, C93). Black resigned after 45.Ra6; left unnamed on purpose.
  const DB97 = ('e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 h6 d4 Re8 Nbd2 Bf8 Nf1 Bd7 Ng3 Na5 Bc2 c5 b3 Nc6 d5 Ne7 ' +
    'Be3 Ng6 Qd2 Nh7 a4 Nh4 Nxh4 Qxh4 Qe2 Qd8 b4 Qc7 Rec1 c4 Ra3 Rec8 Rca1 Qd8 f4 Nf6 fxe5 dxe5 Qf1 Ne8 Qf2 Nd6 Bb6 Qe8 R3a2 Be7 ' +
    'Bc5 Bf8 Nf5 Bxf5 exf5 f6 Bxd6 Bxd6 axb5 axb5 Be4 Rxa2 Qxa2 Qd7 Qa7 Rc7 Qb6 Rb7 Ra8+ Kf7 Qa6 Qc7 Qc6 Qb6+ Kf1 Rb8 Ra6').split(' ');
  const CH = {
    start() { const b = new Array(64).fill(''); 'RNBQKBNR'.split('').forEach((p, f) => { b[f] = p; b[56 + f] = p.toLowerCase(); b[8 + f] = 'P'; b[48 + f] = 'p'; }); return b; },
    white: (p) => p && p === p.toUpperCase(),
    ray(b, a, z, df, dr) { let f = a % 8 + df, r = (a >> 3) + dr; while (f >= 0 && f < 8 && r >= 0 && r < 8) { const s = r * 8 + f; if (s === z) return true; if (b[s]) return false; f += df; r += dr; } return false; },
    reach(b, a, z, t) { // can a piece of type t on a reach z (ignoring whose turn), pawns excluded
      const df = z % 8 - a % 8, dr = (z >> 3) - (a >> 3), ad = Math.abs(df), ar = Math.abs(dr);
      if (t === 'N') return ad * ar === 2;
      if (t === 'K') return Math.max(ad, ar) === 1;
      const st = (ad === ar && ad) || (!df !== !dr);
      if (!st) return false;
      if (t === 'B' && ad !== ar) return false;
      if (t === 'R' && df && dr) return false;
      return CH.ray(b, a, z, Math.sign(df), Math.sign(dr));
    },
    attacked(b, s, byWhite) {
      for (let a = 0; a < 64; a++) {
        const p = b[a]; if (!p || CH.white(p) !== byWhite) continue;
        const t = p.toUpperCase();
        if (t === 'P') { const dir = byWhite ? 1 : -1; if ((s >> 3) - (a >> 3) === dir && Math.abs(s % 8 - a % 8) === 1) return true; }
        else if (CH.reach(b, a, s, t)) return true;
      }
      return false;
    },
    inCheck(b, white) { const k = b.indexOf(white ? 'K' : 'k'); return CH.attacked(b, k, !white); },
    // Resolve one SAN move; throws unless exactly one legal move matches, the capture mark is right, and '+' matches.
    play(b, san, white, ep) {
      const raw = san, chk = /[+#]/.test(san); san = san.replace(/[+#!?]/g, '');
      let mv;
      if (/^(O-O(-O)?|0-0(-0)?)$/.test(san)) {
        const long = san.length > 3, r = white ? 0 : 56, k = r + 4, rf = r + (long ? 0 : 7), kt = r + (long ? 2 : 6), rt = r + (long ? 3 : 5);
        if (b[k] !== (white ? 'K' : 'k') || b[rf] !== (white ? 'R' : 'r')) throw new Error('castle ' + raw);
        if (!CH.ray(b, k, rf, long ? -1 : 1, 0)) throw new Error('castle blocked ' + raw);
        if ([k, (k + kt) / 2, kt].some((s) => CH.attacked(b, s, !white))) throw new Error('castle through check ' + raw);
        mv = { from: k, to: kt, rook: [rf, rt], cap: -1 };
      } else {
        const m = san.match(/^([NBRQK])?([a-h])?([1-8])?(x)?([a-h][1-8])(=[NBRQ])?$/);
        if (!m) throw new Error('bad SAN ' + raw);
        const t = m[1] || 'P', to = (+m[5][1] - 1) * 8 + (m[5].charCodeAt(0) - 97), x = !!m[4], cands = [];
        for (let a = 0; a < 64; a++) {
          const p = b[a]; if (!p || CH.white(p) !== white || p.toUpperCase() !== t) continue;
          if (m[2] && a % 8 !== m[2].charCodeAt(0) - 97) continue;
          if (m[3] && (a >> 3) !== +m[3] - 1) continue;
          let ok, cap = -1;
          if (t === 'P') {
            const dir = white ? 1 : -1, dr = (to >> 3) - (a >> 3), df = to % 8 - a % 8;
            if (x) { ok = dr === dir && Math.abs(df) === 1 && ((b[to] && CH.white(b[to]) !== white) || to === ep); cap = to === ep && !b[to] ? to - dir * 8 : to; }
            else ok = !df && !b[to] && (dr === dir || (dr === 2 * dir && (a >> 3) === (white ? 1 : 6) && !b[a + dir * 8]));
          } else { ok = CH.reach(b, a, to, t) && (!b[to] || CH.white(b[to]) !== white); cap = b[to] ? to : -1; }
          if (!ok) continue;
          const c = b.slice(); if (cap >= 0) c[cap] = ''; c[to] = c[a]; c[a] = '';
          if (CH.inCheck(c, white)) continue;
          cands.push({ from: a, to, cap });
        }
        if (cands.length !== 1) throw new Error((cands.length ? 'ambiguous ' : 'illegal ') + raw);
        mv = cands[0];
        if (x !== (mv.cap >= 0)) throw new Error('capture mark wrong ' + raw);
        if (m[6]) mv.promo = white ? m[6][1] : m[6][1].toLowerCase();
      }
      const nb = b.slice();
      if (mv.cap >= 0) nb[mv.cap] = '';
      nb[mv.to] = mv.promo || nb[mv.from]; nb[mv.from] = '';
      if (mv.rook) { nb[mv.rook[1]] = nb[mv.rook[0]]; nb[mv.rook[0]] = ''; }
      if (CH.inCheck(nb, !white) !== chk) throw new Error('check mark wrong ' + raw);
      const p = b[mv.from].toUpperCase();
      mv.ep = p === 'P' && Math.abs(mv.to - mv.from) === 16 ? (mv.to + mv.from) / 2 : -1;
      mv.san = raw; mv.board = nb;
      return mv;
    },
    game(list) { let b = CH.start(), ep = -1; return list.map((san, i) => { const mv = CH.play(b, san, i % 2 === 0, ep); b = mv.board; ep = mv.ep; return mv; }); }
  };

  /* ---------- shared 3D helpers (three.js r128 via the engine's 3D layer) ---------- */
  const lin = (THREE, h, s, l, k) => { const c = new THREE.Color().setHSL(((h % 360) + 360) % 360 / 360, s / 100, l / 100); c.convertSRGBToLinear(); if (k) c.multiplyScalar(k); return c; };
  addLink('wd_none', () => {}); // webs are drawn in 3D by these modes
  const hide2D = function () { return true; }; // drawNode: the letters live in the 3D scene
  // A texture atlas of glyphs (8 x 8 cells), white on transparent. Entries may be strings or draw(ctx, cell) functions.
  function glyphAtlas(X, glyphs, font) {
    const cell = 128, c = mk(cell * 8, cell * 8), x = c.getContext('2d');
    x.fillStyle = '#fff'; x.strokeStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = font || `${cell * 0.66}px serif`;
    glyphs.slice(0, 64).forEach((g, i) => {
      const cx = (i % 8) * cell, cy = Math.floor(i / 8) * cell;
      if (typeof g === 'function') { x.save(); x.translate(cx, cy); g(x, cell); x.restore(); } else x.fillText(g, cx + cell / 2, cy + cell / 2 + cell * 0.04);
    });
    const t = new X.THREE.CanvasTexture(c); t.generateMipmaps = true; t.minFilter = X.THREE.LinearMipmapLinearFilter; t.anisotropy = 4;
    return t;
  }
  // The letters as world-space glyph sprites at the engine's rotated unit coordinates (n.rx, n.ry, n.rz), in camera space.
  // Each node's screen position is written back to n.sx / n.sy, so 2D overlays and webs line up with the 3D letters.
  function makeLetters(X, S, opt) {
    const THREE = X.THREE, MAX = 280, glyphs = opt.glyphs, tex = glyphAtlas(X, glyphs, opt.font);
    const geo = new THREE.BufferGeometry(), pos = new Float32Array(MAX * 3), col = new Float32Array(MAX * 3), sz = new Float32Array(MAX), gi = new Float32Array(MAX);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('acol', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('asize', new THREE.BufferAttribute(sz, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('agi', new THREE.BufferAttribute(gi, 1).setUsage(THREE.DynamicDrawUsage));
    const add = opt.blend !== 'normal';
    const mat = new THREE.ShaderMaterial({
      uniforms: { atlas: { value: tex }, scale: { value: 800 } },
      vertexShader: 'attribute vec3 acol; attribute float asize; attribute float agi; uniform float scale; varying vec3 vC; varying float vG;' +
        'void main(){ vC = acol; vG = agi; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = asize * scale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform sampler2D atlas; varying vec3 vC; varying float vG;' +
        'void main(){ float c = mod(vG, 8.0), r = floor(vG / 8.0); vec2 uv = vec2((c + gl_PointCoord.x) / 8.0, 1.0 - (r + gl_PointCoord.y) / 8.0);' +
        ' float a = texture2D(atlas, uv).a; if (a < 0.04) discard; ' + (add ? 'gl_FragColor = vec4(vC * a, a); }' : 'gl_FragColor = vec4(vC, a); }'),
      transparent: true, depthWrite: false, depthTest: opt.depthTest !== false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending
    });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 5; X.scene.add(pts);
    const v = new THREE.Vector3(), R = new THREE.Vector3(), U = new THREE.Vector3(), B = new THREE.Vector3(), tmp = new THREE.Color();
    const L = { pts, mat, center: opt.center ? opt.center.clone() : new THREE.Vector3(), radius: opt.radius || 2, size: opt.size || 0.3 };
    // web lines between letters, in 3D, glowing (additive) or inked (normal)
    const lg = new THREE.BufferGeometry(), lp = new Float32Array(MAX * 6), lc = new Float32Array(MAX * 6);
    lg.setAttribute('position', new THREE.BufferAttribute(lp, 3).setUsage(THREE.DynamicDrawUsage));
    lg.setAttribute('color', new THREE.BufferAttribute(lc, 3).setUsage(THREE.DynamicDrawUsage));
    const lm = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, opacity: opt.webOpacity || 1, blending: opt.webBlend === 'normal' ? THREE.NormalBlending : THREE.AdditiveBlending });
    const lines = new THREE.LineSegments(lg, lm); lines.frustumCulled = false; lines.renderOrder = 4; X.scene.add(lines);
    L.lines = lines;
    L.update = function (S, colorOf) {
      const cam = X.camera, e = cam.matrixWorld.elements;
      R.set(e[0], e[1], e[2]); U.set(e[4], e[5], e[6]); B.set(e[8], e[9], e[10]);
      const h = X.renderer.getDrawingBufferSize(new THREE.Vector2()).y; mat.uniforms.scale.value = h / (2 * Math.tan(cam.fov * Math.PI / 360));
      const act = S.active, n = Math.min(MAX, act.length), list = S.mode.glyphList || [];
      for (let i = 0; i < n; i++) {
        const nd = act[i], r = L.radius;
        v.copy(L.center).addScaledVector(R, (nd.rx || 0) * r).addScaledVector(U, -(nd.ry || 0) * r).addScaledVector(B, (nd.rz || 0) * r);
        if (opt.warp) opt.warp(nd, v, S);
        pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
        const w = nd.data.w3 || (nd.data.w3 = [0, 0, 0]); w[0] = v.x; w[1] = v.y; w[2] = v.z;
        const p = v.clone().project(cam); nd.sx = (p.x + 1) / 2 * S.W; nd.sy = (1 - p.y) / 2 * S.H;
        colorOf(nd, tmp); const a = clamp(nd.alpha, 0, 1);
        col[i * 3] = tmp.r * a; col[i * 3 + 1] = tmp.g * a; col[i * 3 + 2] = tmp.b * a;
        sz[i] = L.size * (nd.inf ? 1.25 : 1) * (0.6 + 0.4 * a);
        const k = list.indexOf(nd.g); gi[i] = k < 0 ? (i % Math.max(1, glyphs.length)) : k;
      }
      geo.setDrawRange(0, n);
      ['position', 'acol', 'asize', 'agi'].forEach((k) => { geo.attributes[k].needsUpdate = true; });
      let m = 0; const now = S.now;
      for (const l of S.links) {
        if (m >= MAX) break;
        const A = l.A.data.w3, Bw = l.B.data.w3; if (!A || !Bw) continue;
        const g = clamp((now - l.born) / 220, 0, 1), f = l.dying ? 1 - (now - l.dying) / 700 : 1;
        if (f <= 0) continue;
        lp.set([A[0], A[1], A[2], A[0] + (Bw[0] - A[0]) * g, A[1] + (Bw[1] - A[1]) * g, A[2] + (Bw[2] - A[2]) * g], m * 6);
        const c = colorOf({ inf: true, gen: l.gen, alpha: 1, data: {} }, tmp), k = f * (opt.webGain || 1) * (0.6 + 0.25 * S.stage);
        lc.set([c.r * k, c.g * k, c.b * k, c.r * k, c.g * k, c.b * k], m * 6); m++;
      }
      lg.setDrawRange(0, m * 2); lg.attributes.position.needsUpdate = true; lg.attributes.color.needsUpdate = true;
    };
    return L;
  }
  // Soft round sprite particles (sparks, ash, sand, snow, dust). Simulated on the CPU, drawn as one Points object.
  let SOFT = null;
  function softSprite(X) {
    if (SOFT) return SOFT;
    const c = mk(64, 64), x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    SOFT = c; return c;
  }
  function makeParticles(X, max, opt) {
    const THREE = X.THREE, geo = new THREE.BufferGeometry(), pos = new Float32Array(max * 3), col = new Float32Array(max * 3), sz = new Float32Array(max);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('acol', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('asize', new THREE.BufferAttribute(sz, 1).setUsage(THREE.DynamicDrawUsage));
    const tex = new THREE.CanvasTexture(opt.sprite || softSprite(X)), add = opt.blend !== 'normal';
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, scale: { value: 800 } },
      vertexShader: 'attribute vec3 acol; attribute float asize; uniform float scale; varying vec3 vC; void main(){ vC = acol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = asize * scale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform sampler2D map; varying vec3 vC; void main(){ float a = texture2D(map, gl_PointCoord).a; if (a < 0.01) discard; ' + (add ? 'gl_FragColor = vec4(vC * a, a); }' : 'gl_FragColor = vec4(vC, a * ' + (opt.opacity || 0.8).toFixed(2) + '); }'),
      transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending
    });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = opt.order || 6; X.scene.add(pts);
    const P = { pts, list: [], max, mat };
    P.add = (o) => { if (P.list.length < max) P.list.push(Object.assign({ vx: 0, vy: 0, vz: 0, g: 0, drag: 1, size: 0.1, grow: 0, life: 1000, t: 0, r: 1, gc: 1, b: 1 }, o)); };
    P.update = (S, dt, extra) => {
      const k = dt / 16, now = S.now, h = X.renderer.getDrawingBufferSize(new THREE.Vector2()).y;
      mat.uniforms.scale.value = h / (2 * Math.tan(X.camera.fov * Math.PI / 360));
      P.list = P.list.filter((p) => now - p.t < p.life);
      let i = 0;
      for (const p of P.list) {
        if (now < p.t) continue;
        p.vy -= p.g * k; p.vx *= Math.pow(p.drag, k); p.vy *= Math.pow(p.drag, k); p.vz *= Math.pow(p.drag, k);
        if (extra) extra(p, k);
        p.x += p.vx * k; p.y += p.vy * k; p.z += p.vz * k; p.size += p.grow * k;
        const u = (now - p.t) / p.life, a = p.fade ? p.fade(u) : (1 - u);
        pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
        col[i * 3] = p.r * a; col[i * 3 + 1] = p.gc * a; col[i * 3 + 2] = p.b * a; sz[i] = p.size; i++;
      }
      geo.setDrawRange(0, i); geo.attributes.position.needsUpdate = true; geo.attributes.acol.needsUpdate = true; geo.attributes.asize.needsUpdate = true;
    };
    return P;
  }
  // Merge several (indexed or not) geometries into one non-indexed geometry with positions and normals.
  function mergeGeo(THREE, list) {
    let n = 0; const parts = list.map((g) => { const ng = g.index ? g.toNonIndexed() : g; if (!ng.attributes.normal) ng.computeVertexNormals(); n += ng.attributes.position.count; return ng; });
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
    parts.forEach((g) => { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; });
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    return out;
  }
  // Wood grain on a canvas: growth rings sliced at a slight angle, with pores and colour variation.
  function woodGrain(x, w, h, c0, c1, seed, horiz) {
    const r = rng(seed); x.fillStyle = c0; x.fillRect(0, 0, w, h);
    x.save(); if (!horiz) { x.translate(w, 0); x.rotate(Math.PI / 2); [w, h] = [h, w]; }
    for (let y = 0; y < h; y += 1.5) {
      const ph = Math.sin(y * 0.05 + r() * 0.2) * 0.5 + Math.sin(y * 0.013) * 0.5;
      x.strokeStyle = c1; x.globalAlpha = 0.08 + 0.22 * Math.max(0, Math.sin(y * 0.21 + ph * 3)) ** 3; x.lineWidth = 1.2; x.beginPath(); x.moveTo(0, y);
      for (let px = 0; px <= w; px += w / 12) x.lineTo(px, y + Math.sin(px * 0.004 + y * 0.01) * 6 * ph);
      x.stroke();
    }
    x.globalAlpha = 0.18; x.fillStyle = c1; for (let k = 0; k < w * h / 260; k++) x.fillRect(r() * w, r() * h, 1 + r() * 3, 1);
    x.globalAlpha = 1; x.restore();
  }

  // A cinematic flare on big moments: bloom swells and decays (never a strobe; skipped for reduced motion).
  function bloomPulse(S, X, base, amt, since, tau) {
    if (!X.bloomPass) return;
    X.bloomPass.strength = base + (RM(S) || since < 0 ? 0 : amt * Math.exp(-since / (tau || 450)));
  }
  // An invented hieroglyph-like script: each sign is composed from 1-3 seeded primitives (eye, water, reed, sun, steps...).
  const PRIMS = [
    (x, b) => { x.moveTo(b.x, b.y + b.h / 2); x.quadraticCurveTo(b.x + b.w / 2, b.y, b.x + b.w, b.y + b.h / 2); x.quadraticCurveTo(b.x + b.w / 2, b.y + b.h, b.x, b.y + b.h / 2); x.moveTo(b.x + b.w * 0.62, b.y + b.h / 2); x.arc(b.x + b.w / 2, b.y + b.h / 2, b.w * 0.12, 0, TAU); },
    (x, b) => { const n = 5; x.moveTo(b.x, b.y + b.h * 0.6); for (let i = 1; i <= n * 2; i++) x.lineTo(b.x + b.w * i / (n * 2), b.y + (i % 2 ? b.h * 0.35 : b.h * 0.6)); },
    (x, b) => { x.moveTo(b.x + b.w / 2 + b.w * 0.25, b.y + b.h * 0.22); x.arc(b.x + b.w / 2, b.y + b.h * 0.22, b.w * 0.25, 0, TAU); x.moveTo(b.x + b.w / 2, b.y + b.h * 0.47); x.lineTo(b.x + b.w / 2, b.y + b.h); },
    (x, b) => { x.moveTo(b.x + b.w * 0.45, b.y + b.h); x.lineTo(b.x + b.w * 0.45, b.y + b.h * 0.2); x.quadraticCurveTo(b.x + b.w * 0.9, b.y + b.h * 0.1, b.x + b.w * 0.8, b.y + b.h * 0.45); },
    (x, b) => { const r = Math.min(b.w, b.h) * 0.4; x.moveTo(b.x + b.w / 2 + r, b.y + b.h / 2); x.arc(b.x + b.w / 2, b.y + b.h / 2, r, 0, TAU); x.moveTo(b.x + b.w / 2 + 1.5, b.y + b.h / 2); x.arc(b.x + b.w / 2, b.y + b.h / 2, 1.5, 0, TAU); },
    (x, b) => { x.moveTo(b.x, b.y + b.h); for (let i = 0; i < 3; i++) { x.lineTo(b.x + b.w * i / 3, b.y + b.h * (1 - (i + 1) / 3)); x.lineTo(b.x + b.w * (i + 1) / 3, b.y + b.h * (1 - (i + 1) / 3)); } },
    (x, b) => { x.moveTo(b.x, b.y + b.h * 0.8); x.lineTo(b.x + b.w, b.y + b.h * 0.8); x.moveTo(b.x + b.w * 0.1, b.y + b.h * 0.8); x.arc(b.x + b.w / 2, b.y + b.h * 0.8, b.w * 0.4, Math.PI, 0); },
    (x, b) => { x.moveTo(b.x + b.w / 2, b.y + b.h); x.lineTo(b.x + b.w / 2, b.y + b.h * 0.25); x.arc(b.x + b.w * 0.35, b.y + b.h * 0.25, b.w * 0.15, 0, Math.PI, true); },
    (x, b) => { x.moveTo(b.x + b.w / 2, b.y); x.quadraticCurveTo(b.x + b.w * 0.95, b.y + b.h / 2, b.x + b.w / 2, b.y + b.h); x.quadraticCurveTo(b.x + b.w * 0.05, b.y + b.h / 2, b.x + b.w / 2, b.y); x.lineTo(b.x + b.w / 2, b.y + b.h); },
    (x, b) => { x.moveTo(b.x, b.y + b.h / 2); x.bezierCurveTo(b.x + b.w * 0.3, b.y, b.x + b.w * 0.5, b.y + b.h, b.x + b.w * 0.75, b.y + b.h * 0.4); x.lineTo(b.x + b.w, b.y + b.h * 0.35); },
    (x, b) => { x.moveTo(b.x + b.w / 2, b.y + b.h * 0.1); x.lineTo(b.x + b.w * 0.95, b.y + b.h * 0.9); x.lineTo(b.x + b.w * 0.05, b.y + b.h * 0.9); x.closePath(); },
    (x, b) => { x.moveTo(b.x + b.w * 0.05, b.y + b.h * 0.3); x.quadraticCurveTo(b.x + b.w / 2, b.y + b.h * 1.2, b.x + b.w * 0.95, b.y + b.h * 0.3); }
  ];
  const signCache = {};
  function signSprite(id, rgb) {
    const k = id + '|' + rgb; let c = signCache[k];
    if (c) return c;
    c = mk(48, 64); const x = c.getContext('2d'), r = rng(id * 97 + 5), lay = Math.floor(r() * 3);
    x.lineWidth = 4; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = `rgb(${rgb})`; x.beginPath();
    const P = () => PRIMS[Math.floor(r() * PRIMS.length)];
    if (lay === 0) P()(x, { x: 8, y: 6, w: 32, h: 52 });
    else if (lay === 1) { P()(x, { x: 8, y: 6, w: 32, h: 24 }); P()(x, { x: 8, y: 34, w: 32, h: 24 }); }
    else { P()(x, { x: 4, y: 10, w: 19, h: 44 }); P()(x, { x: 25, y: 10, w: 19, h: 44 }); }
    x.stroke();
    signCache[k] = c; return c;
  }
  const SEKED = 14 / 11; // rise over run: 7 palms (one cubit) of rise per 5.5 palms of run
  let INKDOT = null;
  function inkDots() {
    if (INKDOT) return INKDOT;
    INKDOT = [0, 1, 2].map((v) => {
      const c = mk(96, 96), x = c.getContext('2d'), r = rng(31 + v * 7);
      for (let k = 0; k < 6; k++) { // a few soft lobes make an irregular bleed, with a slightly darker rim (coffee-ring effect)
        const ox = 48 + (r() - 0.5) * 16, oy = 48 + (r() - 0.5) * 16, rr = 26 + r() * 18, g = x.createRadialGradient(ox, oy, 0, ox, oy, rr);
        g.addColorStop(0, `rgba(${INK},0.5)`); g.addColorStop(0.7, `rgba(${INK},0.32)`); g.addColorStop(0.86, `rgba(${INK},0.4)`); g.addColorStop(1, `rgba(${INK},0)`);
        x.fillStyle = g; x.beginPath(); x.arc(ox, oy, rr, 0, TAU); x.fill();
      }
      return c;
    });
    return INKDOT;
  }
  /* ======================= 7. ORIGAMI: a Sonobe kusudama, paper cranes, and the two flat-folding theorems ======================= */
  let CRANES = 0; // cranes folded this visit (a thousand grant a wish, says the legend)
  const PAPER = [[214, 58, 60], [236, 178, 60], [40, 160, 150], [235, 120, 160], [70, 120, 210], [245, 240, 228]];
  function kusudama() {
    const p = (1 + Math.sqrt(5)) / 2, V = [];
    for (const a of [-1, 1]) for (const b of [-1, 1]) { V.push([0, a, b * p]); V.push([a, b * p, 0]); V.push([b * p, 0, a]); }
    const F = [], E = {}, d2 = (u, v) => (u[0] - v[0]) ** 2 + (u[1] - v[1]) ** 2 + (u[2] - v[2]) ** 2;
    for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) for (let k = j + 1; k < 12; k++) if (Math.abs(d2(V[i], V[j]) - 4) < 1e-6 && Math.abs(d2(V[j], V[k]) - 4) < 1e-6 && Math.abs(d2(V[i], V[k]) - 4) < 1e-6) F.push([i, j, k]);
    const tris = [];
    F.forEach((f, fi) => {
      const c = [0, 1, 2].map((q) => (V[f[0]][q] + V[f[1]][q] + V[f[2]][q]) / 3), cl = Math.hypot(c[0], c[1], c[2]), n = c.map((v) => v / cl), apex = n.map((v) => v * cl * 1.5);
      for (let e = 0; e < 3; e++) {
        const a = f[e], b = f[(e + 1) % 3], key = Math.min(a, b) + '-' + Math.max(a, b);
        if (E[key] === undefined) E[key] = Object.keys(E).length; // 30 edges: one Sonobe unit each
        tris.push({ a: V[a], b: V[b], c: apex, n, unit: E[key] });
      }
    });
    return tris;
  }
  let KUS = null;
  addLink('wd_crease', (ctx, L, S) => { // valley folds dashed, mountain folds dash-dot: the standard crease notation
    ctx.setLineDash(L.seed < 0.5 ? [6, 4] : [9, 3, 2, 3]); ctx.lineDashOffset = -L.now * 0.01;
    S.line(L.ax, L.ay, L.bx, L.by); ctx.setLineDash([]); ctx.lineDashOffset = 0;
  });
  function flatVertex() { // a random flat-foldable degree-6 vertex
    const tri = () => { const a = [rand(0.35, 1), rand(0.35, 1), rand(0.35, 1)], s = a[0] + a[1] + a[2]; return a.map((v) => v / s * 180); };
    const o = tri(), e = tri(), sec = [o[0], e[0], o[1], e[1], o[2], e[2]]; // Kawasaki: alternate sectors sum to 180°
    let mi = 0; sec.forEach((v, i) => { if (v < sec[mi]) mi = i; });
    const maj = Math.random() < 0.5 ? 'M' : 'V', mino = maj === 'M' ? 'V' : 'M', mv = new Array(6).fill(null);
    mv[mi] = mino; mv[(mi + 1) % 6] = maj; // big-little-big: the smallest sector's two creases disagree
    const rest = [0, 1, 2, 3, 4, 5].filter((i) => mv[i] === null); mv[pick(rest)] = mino; rest.forEach((i) => { if (mv[i] === null) mv[i] = maj; }); // Maekawa: |M − V| = 2
    return { sec, mv, rot: rand(0, TAU), t: performance.now() };
  }

  /* ======================= DYNASTY: a physical sky over the Giza plateau; the Great Pyramid at its true slope ======================= */
  const NONE4 = ['wd_none', 'wd_none', 'wd_none', 'wd_none'];
  const PYR = { hb: 23, z: -150 }; // half-base 23 units (~5 m each); height = hb * 14/11
  function sandstone(x, w, h, rows, seed, light) {
    const r = rng(seed); x.fillStyle = light ? '#cfa871' : '#b48a58'; x.fillRect(0, 0, w, h);
    const rh = h / rows;
    for (let j = 0; j < rows; j++) {
      const y = j * rh; let xx = -r() * 60;
      while (xx < w) { const bw = 30 + r() * 70, k = 0.82 + r() * 0.3; x.fillStyle = `rgb(${Math.round(200 * k)},${Math.round(160 * k)},${Math.round(108 * k)})`; x.fillRect(xx + 1, y + 1, bw - 2, rh - 2); xx += bw; x.fillStyle = 'rgba(60,40,20,0.55)'; x.fillRect(xx - 1, y, 2, rh); }
      x.fillStyle = 'rgba(70,45,22,0.6)'; x.fillRect(0, y, w, Math.max(1, rh * 0.08));
    }
    for (let k = 0; k < w * h / 60; k++) { x.fillStyle = r() < 0.5 ? 'rgba(90,60,30,0.18)' : 'rgba(255,235,200,0.14)'; x.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
    for (let k = 0; k < 40; k++) { const sx = r() * w, g = x.createLinearGradient(sx, 0, sx, h); g.addColorStop(0, 'rgba(80,50,25,0)'); g.addColorStop(0.5, 'rgba(80,50,25,0.12)'); g.addColorStop(1, 'rgba(80,50,25,0)'); x.fillStyle = g; x.fillRect(sx, r() * h * 0.5, 2 + r() * 6, h * (0.2 + r() * 0.5)); }
  }
  addMode({
    id: 'wd_pharaoh', name: 'DYNASTY', glyphs: 'ABCDEFGHIJKLMNOPQRSTUVWX',
    base: [40, 70, 72], palette: [[45, 100, 58], [190, 80, 55], [12, 85, 58], [160, 60, 50]],
    links: NONE4, noHueShift: true, count: 70, pageBg: ['#2a1a2e', '#0d0806'],
    shapes: ['sphere', 'octahedron', 'helix', 'sunflower', 'cube', 'seashell', 'stella_octangula', 'crown'],
    init(S) { Object.assign(S.data, { storm: null, el: 0.16, az: 1.7, glow: 0, geoA: 0, cx: 0 }); },
    drawNode: hide2D,
    three: {
      init(S, X) {
        const THREE = X.THREE, d = S.data, sc = X.scene, hb = PYR.hb, hgt = hb * SEKED;
        X.setBloom(0.45, 0.6, 0.88); X.setExposure(0.5); X.maxPixelRatio = 1.25;
        X.camera.fov = 40; X.camera.far = 8000; X.camera.updateProjectionMatrix();
        if (THREE.Sky) { const sky = new THREE.Sky(); sky.scale.setScalar(6000); const u = sky.material.uniforms; u.turbidity.value = 9; u.rayleigh.value = 2.4; u.mieCoefficient.value = 0.006; u.mieDirectionalG.value = 0.86; sc.add(sky); d.sky = sky; }
        else sc.background = new THREE.Color(0x6a7fa8);
        sc.fog = new THREE.FogExp2(0xd9b88c, 0.0005);
        const sun = new THREE.DirectionalLight(0xffe0b0, 3); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
        Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 10, far: 900 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.4;
        sun.target.position.set(0, 0, PYR.z - 30); sc.add(sun, sun.target); d.sun = sun;
        d.hemi = new THREE.HemisphereLight(0xa8c0e8, 0x9a6c3a, 0.8); sc.add(d.hemi);
        // sand: displaced dunes, a colour-noise map and fine wind ripples as a bump map
        const ripple = X.canvasTexture(512, 512, (x, w, h) => { x.fillStyle = '#7a7a7a'; x.fillRect(0, 0, w, h); const r = rng(4); for (let y = 0; y < h; y += 6) { x.strokeStyle = 'rgba(255,255,255,0.5)'; x.lineWidth = 2; x.beginPath(); for (let px = 0; px <= w; px += 8) x.lineTo(px, y + Math.sin(px * 0.05 + y * 0.3) * 2 + r() * 1.2); x.stroke(); } });
        ripple.wrapS = ripple.wrapT = THREE.RepeatWrapping; ripple.repeat.set(90, 90);
        const sandCol = X.canvasTexture(512, 512, (x, w, h) => { const r = rng(5); x.fillStyle = '#d4a86e'; x.fillRect(0, 0, w, h); for (let k = 0; k < 9000; k++) { x.fillStyle = r() < 0.5 ? 'rgba(150,100,55,0.18)' : 'rgba(255,230,190,0.18)'; x.fillRect(r() * w, r() * h, 2, 2); } });
        sandCol.wrapS = sandCol.wrapT = THREE.RepeatWrapping; sandCol.repeat.set(40, 40);
        const g = new THREE.PlaneGeometry(2400, 2400, 240, 240); g.rotateX(-Math.PI / 2);
        const P = g.attributes.position, nz = X.noise;
        for (let i = 0; i < P.count; i++) {
          const x = P.getX(i), z = P.getZ(i), dp = Math.hypot(x, z - PYR.z), near = smooth(60, 220, dp) * smooth(10, 120, Math.hypot(x, z - 10));
          let hh = 0; if (nz) { hh = (nz.noise(x * 0.004, 0.3, z * 0.004) * 22 + Math.abs(nz.noise(x * 0.011, 1.7, z * 0.007)) * -14 + nz.noise(x * 0.03, 2, z * 0.03) * 2); }
          P.setY(i, hh * near - 1);
        }
        g.computeVertexNormals();
        const ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xffffff, map: sandCol, bumpMap: ripple, bumpScale: 0.5, roughness: 0.96 }));
        ground.receiveShadow = true; sc.add(ground);
        // the pyramids: square cones with flat faces, coursed limestone, a gilded capstone
        const stone = X.canvasTexture(1024, 1024, (x, w, h) => sandstone(x, w, h, 70, 21, true));
        const pm = new THREE.MeshStandardMaterial({ map: stone, bumpMap: stone, bumpScale: 0.4, roughness: 0.93, flatShading: true });
        const pyramid = (half, px, pz) => { const pg = new THREE.ConeGeometry(half * Math.SQRT2, half * SEKED, 4, 1); pg.rotateY(Math.PI / 4); pg.translate(0, half * SEKED / 2, 0); const m = new THREE.Mesh(pg, pm); m.position.set(px, -0.5, pz); m.castShadow = m.receiveShadow = true; sc.add(m); return m; };
        pyramid(hb, 0, PYR.z); pyramid(14, -78, PYR.z - 110); pyramid(9.5, 62, PYR.z - 170);
        const cap = new THREE.ConeGeometry(hb * Math.SQRT2 * 0.065, hgt * 0.065, 4, 1); cap.rotateY(Math.PI / 4);
        d.cap = new THREE.Mesh(cap, new THREE.MeshStandardMaterial({ color: 0xffcf6a, metalness: 1, roughness: 0.22, flatShading: true, emissive: 0x3a2400 }));
        d.cap.position.set(0, hgt - hgt * 0.065 / 2 - 0.35, PYR.z); d.cap.scale.setScalar(1.03); d.cap.castShadow = true; sc.add(d.cap);
        d.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 1.4, 600, 20, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.2, 1.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
        d.beam.position.set(0, hgt + 300, PYR.z); sc.add(d.beam);
        // two papyrus-bundle columns in the foreground, carved with the invented script; the carvings can glow
        const carve = (glow) => (x, w, h) => {
          if (!glow) sandstone(x, w, h, 20, 33, false); else { x.fillStyle = '#000'; x.fillRect(0, 0, w, h); }
          const sw = 46, sh = 62;
          for (let c = 0; c < 6; c++) for (let k = 0; k < 13; k++) {
            const id = c * 13 + k, gx = c * (w / 6) + (w / 6 - sw) / 2, gy = 40 + k * (sh + 8);
            if (glow) x.drawImage(signSprite(id, '255,190,90'), gx, gy, sw, sh);
            else { x.globalAlpha = 0.85; x.drawImage(signSprite(id, '60,36,16'), gx + 1.5, gy + 1.5, sw, sh); x.globalAlpha = 0.5; x.drawImage(signSprite(id, '245,215,170'), gx - 1, gy - 1, sw, sh); x.globalAlpha = 1; }
          }
        };
        const colTex = X.canvasTexture(1024, 1024, carve(false)), glowTex = X.canvasTexture(1024, 1024, carve(true));
        const prof = [[0, 0], [4.2, 0], [4.2, 1.2], [3.6, 1.5], [3.2, 2.4], [3.1, 6], [2.8, 24], [2.6, 25], [3.0, 25.6], [2.7, 26.2], [3.6, 28], [4.6, 30.5], [4.8, 31.4], [4.9, 32.2], [0, 32.2]];
        const colG = new THREE.LatheGeometry(prof.map((p) => new THREE.Vector2(p[0], p[1])), 40);
        d.colMat = new THREE.MeshStandardMaterial({ map: colTex, bumpMap: colTex, bumpScale: 1.2, roughness: 0.9, emissiveMap: glowTex, emissive: 0xffb347, emissiveIntensity: 0 });
        for (const sx of [-1, 1]) { const c = new THREE.Mesh(colG, d.colMat); c.position.set(sx * 30, -1, -22); c.rotation.y = sx * 0.6; c.castShadow = c.receiveShadow = true; sc.add(c); }
        const lint = new THREE.Mesh(new THREE.BoxGeometry(72, 3.2, 9), new THREE.MeshStandardMaterial({ map: colTex, bumpMap: colTex, bumpScale: 0.8, roughness: 0.9 })); lint.position.set(0, 32.6, -22); lint.castShadow = true; sc.add(lint);
        d.letters = makeLetters(X, S, { glyphs: Array.from({ length: 24 }, (_, i) => (x, cell) => x.drawImage(signSprite(i, '255,255,255'), cell * 0.16, cell * 0.04, cell * 0.68, cell * 0.92)), center: new THREE.Vector3(0, 17, -46), radius: 11, size: 2.6 });
        d.sand = makeParticles(X, 2200, { blend: 'normal', opacity: 0.5 });
        d.X = X; d.hgt = hgt; d.ready = true;
      },
      update(S, X, now, dt) {
        bloomPulse(S, X, 0.45 + 0.35 * power(S), 0.9, S.data.rel ? now - S.data.rel : -1, 600);
        const d = S.data, THREE = X.THREE, pw = power(S), k = dt / 16;
        // the pointer is the sun: height from the pointer's height, bearing from its x
        const te = S.holding && S.stage === 3 ? 0.75 : S.ptrInside ? lerp(0.5, 0.015, clamp(S.ptr.y / (S.H * 0.85), 0, 1)) : 0.16;
        const ta = S.ptrInside ? (S.ptr.x / S.W - 0.5) * 4.4 : 1.7;
        d.el += (te - d.el) * 0.03 * k; d.az += (ta - d.az) * 0.03 * k;
        const sv = new THREE.Vector3().setFromSphericalCoords(1, Math.PI / 2 - d.el, Math.PI - d.az);
        if (d.sky) d.sky.material.uniforms.sunPosition.value.copy(sv);
        const day = smooth(-0.03, 0.25, Math.sin(d.el));
        d.sun.position.copy(d.sun.target.position).addScaledVector(sv, 400);
        d.sun.intensity = 3.4 * day; d.sun.color.setHSL(0.09 - 0.03 * (1 - day), 0.8, 0.62 + 0.2 * day);
        d.hemi.intensity = 0.15 + 0.75 * day; X.setExposure(0.34 + 0.3 * (1 - day));
        const cam = X.camera, drift = RM(S) ? 0 : Math.sin(now * 0.00004);
        d.cx += ((S.ptrInside ? (S.ptr.x / S.W - 0.5) * -8 : 0) - d.cx) * 0.03 * k;
        cam.position.set(d.cx + drift * 6, 7 + (S.holding ? 4 * pw : 0), 36 + drift * 5 - (S.holding ? 10 * pw : 0)); cam.lookAt(0, 19, PYR.z);
        d.glow += ((S.holding ? smooth(0, S.STAGES[2], S.held) : 0) - d.glow) * 0.05 * k;
        d.colMat.emissiveIntensity = d.glow * 1.6;
        d.beam.material.opacity += ((S.holding && S.stage >= 2 ? 0.55 : 0) - d.beam.material.opacity) * 0.06 * k;
        d.cap.material.emissiveIntensity = 1 + 3 * pw;
        // the sandstorm: fog thickens and turns tan, grains stream past on the wind
        const st = d.storm, fogT = st ? smooth(0, 600, now - st.t) * (1 - smooth(2600, 5200, now - st.t)) : 0;
        X.scene.fog.density = 0.0005 + fogT * (RM(S) ? 0.006 : 0.016);
        if (st && now - st.t < 3600) for (let i = 0; i < (RM(S) ? 6 : 26); i++) d.sand.add({ x: -st.dir * rand(40, 70), y: rand(0, 26), z: rand(-70, 30), vx: st.dir * rand(0.8, 2.2), vy: rand(-0.02, 0.05), vz: rand(-0.1, 0.1), size: rand(0.08, 0.35), life: 3200, t: now, r: 0.62, gc: 0.48, b: 0.32, fade: (u) => Math.sin(u * Math.PI) });
        if (st && now - st.t > 5400) d.storm = null;
        if (Math.random() < 0.3) d.sand.add({ x: rand(-40, 40), y: 0.2, z: rand(-60, 20), vx: rand(0.05, 0.25), vy: rand(0.01, 0.05), size: rand(0.06, 0.16), life: 2500, t: now, r: 0.6, gc: 0.47, b: 0.32, fade: (u) => Math.sin(u * Math.PI) * 0.6 });
        d.sand.update(S, dt);
        const pal = S.mode.palette;
        d.letters.update(S, (n, out) => n.inf ? out.copy(lin(THREE, pal[n.gen % pal.length][0], 90, 60, 2.2 + S.stage * 0.5)) : out.copy(lin(THREE, 40, 70, 75, 1.1)));
        // is the pointer on the pyramid? (then the measurement overlay fades in)
        const ap = X.toScreen(new THREE.Vector3(0, d.hgt, PYR.z)), bl = X.toScreen(new THREE.Vector3(-PYR.hb, 0, PYR.z + PYR.hb)), br = X.toScreen(new THREE.Vector3(PYR.hb, 0, PYR.z + PYR.hb));
        const on = S.ptrInside && S.ptr.y > ap.y && S.ptr.y < bl.y && S.ptr.x > bl.x && S.ptr.x < br.x;
        d.geoA += ((on || (S.holding && S.stage >= 2) ? 1 : 0) - d.geoA) * 0.06 * k;
      }
    },
    warp(S, n) { const st = S.data.storm; if (!st) return; const t = S.now - st.t, e = smooth(0, 500, t) * (1 - smooth(2200, 4200, t)); n.rx += st.dir * e * (0.2 + ((n.p[0] * 7.7 + 9) % 1) * 0.5) * (RM(S) ? 0.3 : 1); },
    over(S, ctx) { // an understated survey overlay: the pyramid's cross-section triangle, measured
      const d = S.data; if (!d.ready || d.geoA < 0.02) return;
      const THREE = d.X.THREE, ts = (x, y, z) => d.X.toScreen(new THREE.Vector3(x, y, z)), hb = PYR.hb, z = PYR.z;
      const A = ts(0, d.hgt, z), C = ts(0, 0, z), M = ts(0, 0, z + hb);
      ctx.globalAlpha = d.geoA * 0.85; ctx.strokeStyle = 'rgba(255,236,200,0.9)'; ctx.fillStyle = 'rgba(255,236,200,0.9)'; ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(C.x, C.y); ctx.lineTo(M.x, M.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(M.x, M.y); ctx.lineTo(A.x, A.y); ctx.stroke();
      ctx.font = '11px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const th = Math.atan(SEKED) * 180 / Math.PI;
      ctx.fillText(`θ = atan(14/11) = ${th.toFixed(2)}°`, M.x + 10, M.y - 8);
      ctx.fillText(`s / b = ${Math.sqrt(1 + SEKED * SEKED).toFixed(4)}  (φ = 1.6180)`, (A.x + M.x) / 2 + 12, (A.y + M.y) / 2);
      ctx.fillText(`perimeter / h = ${(8 / SEKED).toFixed(4)}  (2π = 6.2832)`, A.x + 12, A.y - 14);
      ctx.globalAlpha = 1;
    },
    onRelease(S, held, pw) { const d = S.data; d.storm = { t: S.now, dir: S.ptr.x < S.cx ? 1 : -1 }; d.rel = S.now; return false; },
    hud(S) {
      const d = S.data, th = Math.atan(SEKED) * 180 / Math.PI, ratio = Math.sqrt(1 + SEKED * SEKED), alt = Math.round((d.el || 0) * 180 / Math.PI);
      if (S.holding) return [`sun altitude ${alt}°`, 'the carved columns remember their words', `Kepler triangle 1 : √φ : φ → here 1 : ${SEKED.toFixed(4)} : ${ratio.toFixed(4)}`, 'the sun at its height · let go and the desert answers'][S.stage];
      if (d.storm) return 'sandstorm · visibility falling · the pyramid has outlasted ~4,500 years of these';
      return `seked 5½ palms per cubit → slope ${th.toFixed(2)}° · perimeter ÷ height = ${(8 / SEKED).toFixed(4)} ≈ 2π · slant ÷ half-base = ${ratio.toFixed(4)} ≈ φ · sun altitude ${alt}°`;
    }
  });

  /* ======================= AURORA: oxygen's green and red lines over a frozen lake ======================= */
  const AUR_V = 'uniform float time, len, z0, hgt, amp, ph, ripX, ripT, ripA; varying vec2 vUv; varying float vX;' +
    'void main(){ vUv = uv; float x = position.x * len; float z = z0 + amp * sin(x * 0.004 + time * 0.12 + ph) + amp * 0.45 * sin(x * 0.013 - time * 0.23 + ph * 2.0);' +
    ' float dd = abs(x - ripX) - ripT * 160.0; z += ripA * exp(-ripT * 0.6) * exp(-dd * dd / 6000.0) * sin(dd * 0.04);' +
    ' float H = hgt * (0.72 + 0.28 * sin(x * 0.011 + time * 0.4 + ph)); vec3 p = vec3(x, 210.0 + 18.0 * sin(x * 0.006 + time * 0.15 + ph) + uv.y * H, z);' +
    ' vX = x; gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }';
  const AUR_F = 'uniform float time, kp, red, surgeX, surgeA; varying vec2 vUv; varying float vX;' +
    'float h1(float n){ return fract(sin(n) * 43758.5453); } float n1(float x){ float i = floor(x), f = fract(x); return mix(h1(i), h1(i + 1.0), f * f * (3.0 - 2.0 * f)); }' +
    'void main(){ float v = vUv.y; float rays = (0.35 + 0.65 * n1(vX * 0.32 + time * 1.3)) * (0.5 + 0.5 * n1(vX * 0.045 - time * 0.35)) * (0.7 + 0.3 * n1(vX * 1.7 + time * 3.0));' +
    ' float bottom = smoothstep(0.0, 0.05, v) * (1.0 - 0.6 * smoothstep(0.02, 0.0, v)); float top = 1.0 - smoothstep(0.25, 1.0, v);' +
    ' vec3 c = mix(vec3(0.9, 0.15, 0.75), vec3(0.12, 1.0, 0.42), smoothstep(0.0, 0.07, v)); c = mix(c, vec3(1.0, 0.1, 0.22), smoothstep(0.3, 0.85, v) * (0.3 + 0.7 * red));' +
    ' float pch = 0.15 + 0.85 * smoothstep(0.25, 0.85, n1(vX * 0.0035 - time * 0.08) * 0.6 + n1(vX * 0.011 + time * 0.13) * 0.4); float a = bottom * (top + red * 0.6 * (1.0 - smoothstep(0.6, 1.0, v))) * rays * pch; float s = surgeA * exp(-pow((vX - surgeX) / 160.0, 2.0));' +
    ' gl_FragColor = vec4(c * a * kp * (1.0 + 3.0 * s), 1.0); }';
  addMode({
    id: 'wd_aurora', name: 'AURORA', glyphs: G('ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ', 'FUTHARKGWN'),
    base: [195, 45, 88], palette: [[140, 100, 62], [350, 95, 64], [280, 85, 72], [170, 90, 60]],
    links: NONE4, noHueShift: true, count: 96, pageBg: ['#03101e', '#010307'],
    shapes: ['sphere', 'torus', 'hopf', 'clifford_torus', 'helicoid', 'breather', 'dupin', 'galaxy'],
    init(S) { Object.assign(S.data, { kp: 2, brk: -1e9, brkX: 0, brkDir: 1, yaw: 0, pitch: 0, ripT: 99, ripX: 0, ripA: 0 }); },
    drawNode: hide2D,
    three: {
      init(S, X) {
        const THREE = X.THREE, d = S.data, sc = X.scene;
        X.setBloom(0.95, 0.75, 0.15); X.setExposure(1.0); X.maxPixelRatio = 1.25;
        X.camera.fov = 55; X.camera.far = 6000; X.camera.updateProjectionMatrix();
        sc.background = new THREE.Color(0x010409); sc.fog = new THREE.FogExp2(0x02070f, 0.0006);
        // stars
        const N = 3500, sp = new Float32Array(N * 3), sc3 = new Float32Array(N * 3), r = rng(7);
        for (let i = 0; i < N; i++) { const th = r() * TAU, ph = Math.acos(r() * 0.95), R = 3000; sp.set([Math.sin(ph) * Math.cos(th) * R, Math.cos(ph) * R, Math.sin(ph) * Math.sin(th) * R], i * 3); const b = 0.3 + r() * r() * 1.6, w = r(); sc3.set([b * (0.8 + 0.2 * w), b * 0.9, b * (1.1 - 0.2 * w)], i * 3); }
        const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.BufferAttribute(sc3, 3));
        sc.add(new THREE.Points(sg, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, map: new THREE.CanvasTexture(softSprite(X)), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
        // snowy mountains around a frozen lake
        const g = new THREE.PlaneGeometry(4000, 2400, 260, 160); g.rotateX(-Math.PI / 2);
        const P = g.attributes.position, nz = X.noise;
        for (let i = 0; i < P.count; i++) {
          const x = P.getX(i), z = P.getZ(i), far = smooth(-420, -900, z), side = smooth(420, 900, Math.abs(x)), m = Math.max(far, side * smooth(250, -100, z));
          let hh = 0; if (nz) { let a = 1, f = 0.0022; for (let o = 0; o < 5; o++) { hh += Math.abs(nz.noise(x * f, o * 3.1, z * f)) * a; a *= 0.5; f *= 2.1; } }
          P.setY(i, m * (hh * 300 - 30) - 6);
        }
        g.computeVertexNormals();
        const col = new Float32Array(P.count * 3), Nn = g.attributes.normal;
        for (let i = 0; i < P.count; i++) { const s = smooth(0.62, 0.82, Nn.getY(i)), y = P.getY(i); const c = y < -2 ? [0.6, 0.7, 0.8] : [lerp(0.05, 0.82, s), lerp(0.055, 0.88, s), lerp(0.07, 0.98, s)]; col.set(c, i * 3); }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        const land = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 })); sc.add(land);
        sc.add(new THREE.HemisphereLight(0x3a6a8a, 0x05080c, 0.5));
        d.glowLight = new THREE.DirectionalLight(0x5dff9a, 0.6); d.glowLight.position.set(0, 300, -600); sc.add(d.glowLight); // the aurora lights the snow
        const moon = new THREE.DirectionalLight(0x9ab4ff, 0.25); moon.position.set(-400, 300, 200); sc.add(moon);
        // the ice: a mirror-like Water surface, so the aurora is really reflected
        if (THREE.Water && nz) {
          const nt = X.canvasTexture(256, 256, (x, w, h) => {
            const img = x.createImageData(w, h), hgt = (i, j) => nz.noise(i * 0.05, j * 0.05, 0.5) + 0.5 * nz.noise(i * 0.13, j * 0.13, 2.5);
            for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const dx = hgt(i + 1, j) - hgt(i - 1, j), dy = hgt(i, j + 1) - hgt(i, j - 1), o = (j * w + i) * 4; img.data[o] = 128 + dx * 160; img.data[o + 1] = 128 + dy * 160; img.data[o + 2] = 255; img.data[o + 3] = 255; }
            x.putImageData(img, 0, 0);
          });
          nt.encoding = THREE.LinearEncoding; nt.wrapS = nt.wrapT = THREE.RepeatWrapping;
          d.water = new THREE.Water(new THREE.PlaneGeometry(2600, 1300), { textureWidth: 384, textureHeight: 384, waterNormals: nt, sunDirection: new THREE.Vector3(0, 1, 0), sunColor: 0x000000, waterColor: 0x020810, distortionScale: 0.12, fog: true });
          d.water.rotation.x = -Math.PI / 2; d.water.position.set(0, -1.5, -260); sc.add(d.water);
        }
        // the curtains: ribbons of vertical rays, oxygen green low down, oxygen red high up, an N2 pink fringe at the hem
        d.cur = [[-900, 2400, 200, 90, 0.3], [-1150, 2800, 260, 120, 2.2], [-760, 1900, 150, 60, 4.1]].map(([z0, len, hgt, amp, ph]) => {
          const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 360, 1).translate(0, 0.5, 0), new THREE.ShaderMaterial({
            uniforms: { time: { value: 0 }, len: { value: len }, z0: { value: z0 }, hgt: { value: hgt }, amp: { value: amp }, ph: { value: ph }, ripX: { value: 0 }, ripT: { value: 99 }, ripA: { value: 0 }, kp: { value: 1 }, red: { value: 0 }, surgeX: { value: 0 }, surgeA: { value: 0 } },
            vertexShader: AUR_V, fragmentShader: AUR_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false
          }));
          m.frustumCulled = false; sc.add(m); return m;
        });
        d.snow = makeParticles(X, 900, { blend: 'add' });
        d.letters = makeLetters(X, S, { glyphs: Array.from(S.mode.glyphList.length ? S.mode.glyphList : ['ᚠ']), font: '84px "Segoe UI Historic","Segoe UI Symbol",serif', center: new THREE.Vector3(0, 82, -40), radius: 52, size: 9 });
        try { X.renderer.compile(X.scene, X.camera); } catch (e) { /* warm-up only */ } d.X = X; d.ready = true;
      },
      update(S, X, now, dt) {
        bloomPulse(S, X, 0.95 + 0.4 * power(S), 1.4, now - S.data.brk, 900);
        const d = S.data, THREE = X.THREE, pw = power(S), k = dt / 16, t = now / 1000;
        d.kp += ((S.holding ? 2 + 7 * pw : 2.3 + Math.sin(now * 0.0002)) - d.kp) * 0.03 * k;
        const e = Math.exp(-Math.max(0, now - d.brk) / 1800), st = now - d.brk;
        if (S.ptrInside && pspeed(S) > 4 && d.ripT > 0.4) { d.ripT = 0; d.ripX = (S.ptr.x / S.W - 0.5) * 1600; d.ripA = Math.min(90, pspeed(S) * 6); }
        d.ripT += dt / 1000;
        const speed = 1 + pw * 1.5 + e * 4; d.time = (d.time || 0) + dt / 1000 * speed;
        d.cur.forEach((m, i) => {
          const u = m.material.uniforms; u.time.value = d.time + i * 7; u.kp.value = (0.8 + 0.25 * Math.sin(t * 0.3 + i)) * (1 + 0.55 * pw + 1.2 * e) * [1, 0.7, 0.55][i];
          u.red.value = S.holding ? smooth(S.STAGES[1], S.STAGES[3], S.held) : e * 0.8; u.hgt.value = [200, 260, 150][i] * (1 + 0.6 * pw + 0.8 * e);
          u.ripX.value = d.ripX; u.ripT.value = d.ripT; u.ripA.value = d.ripA;
          u.surgeX.value = d.brkX + d.brkDir * st * 0.6; u.surgeA.value = st < 3800 ? smooth(0, 200, st) * (1 - smooth(2400, 3800, st)) : 0;
        });
        if (d.water) d.water.material.uniforms.time.value += dt / 1000 * 0.04;
        d.glowLight.intensity = 0.12 + 0.22 * pw + 0.5 * e;
        // camera: on the shore; the pointer turns the head, holding looks up toward the corona
        d.yaw += ((S.ptrInside ? (S.ptr.x / S.W - 0.5) * -0.35 : Math.sin(now * 0.00005) * 0.12) - d.yaw) * 0.03 * k;
        d.pitch += ((S.holding ? 0.16 + 0.16 * pw : 0.16) + (S.ptrInside ? (0.5 - S.ptr.y / S.H) * 0.12 : 0) - d.pitch) * 0.03 * k;
        const cam = X.camera; cam.position.set(0, 14, 260); cam.rotation.set(d.pitch, d.yaw, 0, 'YXZ');
        if (Math.random() < 0.5) d.snow.add({ x: rand(-260, 260), y: rand(60, 160), z: rand(-40, 230), vx: rand(-0.05, 0.05), vy: -rand(0.12, 0.3), size: rand(0.3, 0.8), life: 9000, t: now, r: 0.5, gc: 0.55, b: 0.65, fade: (u) => Math.min(1, u * 8) * (1 - u) });
        d.snow.update(S, dt, (p, kk) => { p.vx += Math.sin(now * 0.001 + p.z) * 0.002 * kk; });
        const pal = S.mode.palette;
        d.letters.update(S, (n, out) => n.inf ? out.copy(lin(THREE, pal[n.gen % pal.length][0], 95, 62, 1.6 + S.stage * 0.5)) : out.copy(lin(THREE, 195, 50, 85, 0.7)));
      }
    },
    onRelease(S, held, pw) {
      const d = S.data; d.brk = S.now; d.rel = S.now; d.relKp = d.kp; d.brkX = (S.ptr.x / S.W - 0.5) * 1600; d.brkDir = S.ptr.x > S.cx ? -1 : 1;
      if (d.ready) for (const n of S.active) if (n.inf && n.data.w3) for (let k = 0; k < 3; k++) d.snow.add({ x: n.data.w3[0], y: n.data.w3[1], z: n.data.w3[2], vx: rand(-0.3, 0.3), vy: rand(0.5, 1.6), vz: rand(-0.3, 0.3), size: rand(1, 2.2), life: rand(1500, 2600), t: S.now, r: 0.3, gc: 2.4, b: 0.9, drag: 0.99 });
      return false;
    },
    hud(S) {
      const d = S.data, kp = Math.min(9, d.kp), pw = power(S), v = Math.round(380 + 420 * pw), bz = (-1 - 19 * pw).toFixed(1);
      if (S.holding) return S.stage === 3 ? `Kp ${kp.toFixed(1)} · G5 storm · red 630 nm aurora seen far from the poles · release for the breakup` : `Kp ${kp.toFixed(1)} · solar wind ${v} km/s · Bz ${bz} nT (southward: field lines reconnect)`;
      if (d.rel && S.now - d.rel < 4000) return `substorm breakup · the magnetotail dumps ~10¹⁵ J · Kp peaked at ${Math.min(9, d.relKp).toFixed(1)}`;
      return `O I 557.7 nm green: lifetime ≈ 0.7 s · O I 630.0 nm red: ≈ 110 s, so it survives only above ~200 km where collisions are rare · Kp ${kp.toFixed(1)}`;
    }
  });

  /* ======================= MAGMA: a stratovolcano at night, a Plinian plume, and a causeway of basalt columns ======================= */
  function heatRGB(T) { const t = clamp((T - 500) / 700, 0, 1); return [Math.round(lerp(70, 255, Math.min(1, t * 1.6))), Math.round(lerp(8, 235, Math.pow(t, 1.6))), Math.round(lerp(0, 150, Math.pow(t, 4)))]; }
  const VC = { x: 0, z: -460, h: 250 }; // the crater
  const coneH = (r) => r < 34 ? VC.h - (34 - r) * 1.1 : VC.h * Math.exp(-(r - 34) / 165);
  addMode({
    id: 'wd_volcano', name: 'MAGMA', glyphs: G('▲△◭◮✹✺∴※⁂', '^*#A'),
    base: [25, 40, 72], palette: [[30, 100, 58], [12, 100, 55], [48, 100, 62], [0, 85, 48]],
    links: NONE4, noHueShift: true, count: 110, pageBg: ['#240803', '#070101'],
    shapes: ['sphere', 'mandelbulb', 'urchin', 'rossler', 'great_stellated_dodecahedron', 'trefoil', 'seashell', 'torus'],
    init(S) { Object.assign(S.data, { rel: -1e9, cool: 0, bolts: 0, nextBolt: 0, cx: 0, boltT: -1e9 }); },
    drawNode: hide2D,
    three: {
      init(S, X) {
        const THREE = X.THREE, d = S.data, sc = X.scene;
        X.setBloom(0.85, 0.6, 0.6); X.setExposure(1.1); X.maxPixelRatio = 1.25;
        X.camera.fov = 42; X.camera.far = 6000; X.camera.updateProjectionMatrix();
        sc.background = X.canvasTexture(4, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#030102'); g.addColorStop(0.55, '#140504'); g.addColorStop(0.75, '#3a0f06'); g.addColorStop(1, '#1a0603'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
        sc.fog = new THREE.FogExp2(0x1c0805, 0.0011);
        // the volcano: a concave cone with radial gullies, a crater, and lava rivers in an emissive map
        const SZ = 1800, g = new THREE.PlaneGeometry(SZ, SZ, 260, 260); g.rotateX(-Math.PI / 2);
        const P = g.attributes.position, nz = X.noise, cols = new Float32Array(P.count * 3);
        for (let i = 0; i < P.count; i++) {
          const x = P.getX(i), z = P.getZ(i), r = Math.hypot(x - VC.x, z - VC.z), a = Math.atan2(z - VC.z, x - VC.x);
          let h = coneH(r); if (nz) h += (nz.noise(x * 0.01, 0.5, z * 0.01) * 18 + Math.sin(a * 17 + nz.noise(x * 0.004, 2, z * 0.004) * 6) * 5) * smooth(30, 220, r) + nz.noise(x * 0.04, 1, z * 0.04) * 3;
          h = lerp(h, -1 + (nz ? nz.noise(x * 0.02, 5, z * 0.02) * 2 : 0), smooth(-150, -60, z)); // the causeway shore is flat
          P.setY(i, h);
          const k = 0.045 + 0.035 * (nz ? nz.noise(x * 0.05, 3, z * 0.05) : 0); cols.set([k * 1.05, k, k], i * 3);
        }
        g.computeVertexNormals(); g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
        const lava = X.canvasTexture(1024, 1024, (x, w, h) => {
          x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
          const cu = (VC.x / SZ + 0.5) * w, cv = (VC.z / SZ + 0.5) * h, r = rng(41);
          x.lineCap = 'round';
          for (let k = 0; k < 9; k++) {
            const a0 = Math.PI * 0.5 + (r() - 0.5) * 2.2, len = 60 + r() * 120; let px = cu + Math.cos(a0) * 12, py = cv + Math.sin(a0) * 12, a = a0;
            const pts = [[px, py]]; for (let s = 0; s < 30; s++) { a += (r() - 0.5) * 0.35; px += Math.cos(a) * len / 30; py += Math.sin(a) * len / 30; pts.push([px, py]); }
            for (const [wd, col] of [[9, 'rgba(255,60,10,0.25)'], [4, 'rgba(255,120,30,0.7)'], [1.6, 'rgba(255,220,120,1)']]) { x.strokeStyle = col; x.lineWidth = wd; x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.stroke(); }
          }
          const cg = x.createRadialGradient(cu, cv, 0, cu, cv, 18); cg.addColorStop(0, 'rgba(255,230,140,1)'); cg.addColorStop(1, 'rgba(255,80,10,0)'); x.fillStyle = cg; x.fillRect(cu - 20, cv - 20, 40, 40);
        });
        d.volMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, emissive: 0xffffff, emissiveMap: lava, emissiveIntensity: 1.4 });
        const vol = new THREE.Mesh(g, d.volMat); vol.receiveShadow = true; sc.add(vol);
        d.vent = new THREE.PointLight(0xff6a20, 9000, 0, 1.6); d.vent.position.set(VC.x, VC.h + 30, VC.z); sc.add(d.vent);
        d.flash = new THREE.PointLight(0xb8a8ff, 0, 0, 1.4); d.flash.position.set(VC.x, VC.h + 250, VC.z); sc.add(d.flash);
        sc.add(new THREE.HemisphereLight(0x4a2418, 0x080404, 0.5));
        const moon = new THREE.DirectionalLight(0xa0a8c8, 0.9); moon.position.set(-300, 400, 300); moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024);
        Object.assign(moon.shadow.camera, { left: -110, right: 110, top: 80, bottom: -80, near: 10, far: 1200 }); moon.target.position.set(0, 0, 15); sc.add(moon, moon.target);
        // foreground: a causeway of hexagonal basalt columns (columnar jointing)
        const hexG = new THREE.CylinderGeometry(1, 1, 1, 6, 1); hexG.rotateY(Math.PI / 6);
        const bas = X.canvasTexture(256, 256, (x, w, h) => { const r = rng(9); x.fillStyle = '#3a3634'; x.fillRect(0, 0, w, h); for (let k = 0; k < 4000; k++) { x.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.25)' : 'rgba(255,240,230,0.08)'; x.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); } for (let y = 0; y < h; y += 18 + r() * 20) { x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, y, w, 1.5); } });
        const list = [], cr = 2.6;
        for (let q = -30; q <= 30; q++) for (let rr = -12; rr <= 12; rr++) {
          const x = cr * 1.5 * q * 1.02, z = 20 + cr * Math.sqrt(3) * (rr + q / 2) * 1.02;
          if (z < -45 || z > 75 || Math.abs(x) > 95 - (75 - z) * 0.2) continue;
          const nn = nz ? nz.noise(x * 0.05, 7, z * 0.05) : 0, hh = Math.max(1.2, 5 + nn * 9 + (Math.abs(x) > 40 ? 4 : 0) + rand(-0.8, 0.8));
          list.push({ x, z, h: Math.round(hh * 2) / 2 });
        }
        const im = new THREE.InstancedMesh(hexG, new THREE.MeshStandardMaterial({ map: bas, roughness: 0.78, flatShading: true }), list.length);
        const caps = new THREE.InstancedMesh(new THREE.CircleGeometry(0.96, 6).rotateX(-Math.PI / 2).rotateY(Math.PI / 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), list.length);
        const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), c = new THREE.Color();
        list.forEach((o, i) => {
          m4.compose(new THREE.Vector3(o.x, o.h / 2 - 1, o.z), q4, new THREE.Vector3(cr * 0.985, o.h, cr * 0.985)); im.setMatrixAt(i, m4);
          m4.compose(new THREE.Vector3(o.x, o.h - 0.98, o.z), q4, new THREE.Vector3(cr * 0.9, 1, cr * 0.9)); caps.setMatrixAt(i, m4); caps.setColorAt(i, c.setRGB(0, 0, 0));
          o.dist = Math.hypot(o.x, o.z - 20);
        });
        im.castShadow = im.receiveShadow = true; sc.add(im, caps); caps.instanceColor.needsUpdate = true;
        d.cols = { list, caps, t: -1e9, cracked: 0, T: 300 };
        d.ash = makeParticles(X, 800, { blend: 'normal', opacity: 0.85, order: 6 });
        d.spark = makeParticles(X, 1200, { order: 7 });
        const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(16 * 3), 3));
        d.bolt = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: new THREE.Color(4, 3.6, 6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); d.bolt.frustumCulled = false; d.bolt.visible = false; sc.add(d.bolt);
        d.letters = makeLetters(X, S, { glyphs: Array.from(S.mode.glyphList.length ? S.mode.glyphList : ['▲']), font: '80px "Segoe UI Symbol",serif', center: new THREE.Vector3(0, 95, -60), radius: 42, size: 8 });
        try { X.renderer.compile(X.scene, X.camera); } catch (e) { /* warm-up only */ } d.X = X; d.ready = true;
      },
      update(S, X, now, dt) {
        bloomPulse(S, X, 0.85 + 0.4 * power(S), 1.8, now - S.data.rel, 700);
        const d = S.data, THREE = X.THREE, pw = power(S), k = dt / 16, st = S.holding ? S.stage : 0, since = now - d.rel;
        const erupt = since < 4000 ? 1 - smooth(1500, 4000, since) : 0;
        // camera: a slow dolly; the pointer pans; the ground trembles during the eruption
        d.cx += ((S.ptrInside ? (S.ptr.x / S.W - 0.5) * 60 : 0) - d.cx) * 0.03 * k;
        const dr = RM(S) ? 0 : Math.sin(now * 0.00005), sh = RM(S) ? 0 : (erupt * 1.5 + (st === 3 ? 0.5 : 0));
        X.camera.position.set(d.cx + dr * 25 + rand(-sh, sh), 34 + rand(-sh, sh), 215 - dr * 10); X.camera.lookAt(d.cx * 0.3, 105 + (S.ptrInside ? (0.5 - S.ptr.y / S.H) * 80 : 0), VC.z);
        const fl = 0.8 + 0.2 * Math.sin(now * 0.013) * Math.sin(now * 0.0071);
        d.vent.intensity = 7000 * fl * (1 + 0.7 * pw + 1.5 * erupt);
        d.volMat.emissiveIntensity = (1.2 + 1.8 * pw + 1.5 * erupt) * (0.85 + 0.15 * fl);
        const top = new THREE.Vector3(VC.x, VC.h - 4, VC.z);
        // the plume: dark ash puffs rising, spreading into an umbrella; sparks and bombs from the vent
        const rate = [0.25, 1.2, 2.5, 4][st] + erupt * 6;
        for (let i = 0; i < rate * k; i++) if (Math.random() < rate - i) d.ash.add({ x: top.x + rand(-14, 14), y: top.y, z: top.z + rand(-14, 14), vx: rand(-0.2, 0.2), vy: rand(1.4, 2.4) + st * 0.6 + erupt * 2, vz: rand(-0.2, 0.2), size: rand(14, 24), grow: 0.22 + st * 0.05, life: rand(5000, 8000), t: now, r: 0.075, gc: 0.064, b: 0.06, drag: 0.996, fade: (u) => Math.min(1, u * 6) * (1 - u) });
        const umb = VC.h + 160 + st * 110 + erupt * 220;
        d.ash.update(S, dt, (p, kk) => { if (!p.pf) { const hh = clamp((p.y - VC.h) / 260, 0, 1); p.r = lerp(0.55, 0.085, hh); p.gc = lerp(0.18, 0.075, hh); p.b = lerp(0.05, 0.07, hh); } if (p.y > umb) { p.vy *= 0.95; const a = Math.atan2(p.z - VC.z, p.x - VC.x + 0.01); p.vx += Math.cos(a) * 0.03 * kk; p.vz += Math.sin(a) * 0.03 * kk; } if (p.pf) { p.rad += p.sp * kk; p.sp *= 0.996; p.x = VC.x + Math.cos(p.a) * p.rad; p.z = VC.z + Math.sin(p.a) * p.rad; p.y = coneH(p.rad) + p.size * 0.22; p.vx = p.vy = p.vz = 0; } });
        if (st >= 1 || erupt > 0.2) for (let i = 0; i < (st * 3 + erupt * 10) * k; i++) d.spark.add({ x: top.x + rand(-6, 6), y: top.y, z: top.z + rand(-6, 6), vx: rand(-1.4, 1.4), vy: rand(2.5, 5.5) * (1 + erupt * 0.6), vz: rand(-1.4, 1.4), g: 0.07, size: rand(1.2, st === 3 || erupt > 0.3 ? 4 : 2.4), life: rand(1600, 2800), t: now, r: 3, gc: 1.1, b: 0.25 });
        d.spark.update(S, dt);
        // volcanic lightning in the plume
        d.bolt.visible = now - d.boltT < (RM(S) ? 300 : 140);
        if ((st >= 2 || erupt > 0.3) && now > d.nextBolt && d.ash.list.length > 40) {
          d.nextBolt = now + rand(300, 1100); d.boltT = now;
          const a = pick(d.ash.list), b = pick(d.ash.list), arr = d.bolt.geometry.attributes.position.array;
          for (let i = 0; i < 16; i++) { const u = i / 15; arr[i * 3] = lerp(a.x, b.x, u) + (i % 15 ? rand(-14, 14) : 0); arr[i * 3 + 1] = lerp(a.y, b.y, u) + (i % 15 ? rand(-14, 14) : 0); arr[i * 3 + 2] = lerp(a.z, b.z, u); }
          d.bolt.geometry.attributes.position.needsUpdate = true; d.flash.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
        }
        d.flash.intensity = d.bolt.visible ? (RM(S) ? 8000 : 40000) : 0;
        // the causeway: after an eruption the column tops glow and cool, from the edge of the field inward
        const C = d.cols, ct = now - C.t; let cracked = 0, Ts = 0;
        if (ct < 9000) {
          const col = new THREE.Color();
          C.list.forEach((o, i) => {
            const u = clamp((ct - (90 - o.dist) * 18) / 3200, 0, 1), T = 1170 - 870 * u; Ts += T; if (T < 890) cracked++; // joints open at ~890-840 °C
            const rgb = heatRGB(T), g = 2.2 * smooth(480, 700, T); col.setRGB(rgb[0] / 255 * g, rgb[1] / 255 * g, rgb[2] / 255 * g); C.caps.setColorAt(i, col);
          });
          C.caps.instanceColor.needsUpdate = true; C.cracked = cracked; C.T = Ts / C.list.length;
        }
        const pal = S.mode.palette;
        d.letters.update(S, (n, out) => n.inf ? out.copy(lin(THREE, pal[n.gen % pal.length][0], 100, 58, 2 + S.stage * 0.6)) : out.copy(lin(THREE, 25, 60, 70, 0.6)));
      }
    },
    onRelease(S, held, pw) {
      const d = S.data; d.rel = S.now; if (!d.ready) return false;
      d.cols.t = S.now + 900;
      for (let k = 0; k < 90; k++) { const a = Math.PI * rand(0.15, 0.85), sp = rand(1.6, 3.2) * clamp(pw, 0.6, 1.3); d.ash.add({ x: VC.x, y: VC.h, z: VC.z, pf: 1, a, rad: 30, sp, size: rand(18, 30), grow: 0.25, life: rand(4500, 6500), t: S.now + k * 10, r: 0.13, gc: 0.1, b: 0.085, fade: (u) => Math.min(1, u * 5) * (1 - u) }); }
      for (let k = 0; k < 260; k++) d.spark.add({ x: VC.x + rand(-8, 8), y: VC.h, z: VC.z + rand(-8, 8), vx: rand(-3, 3), vy: rand(4, 9), vz: rand(-3, 3), g: 0.08, size: rand(2, 5), life: rand(2200, 3600), t: S.now, r: 3, gc: 1.2, b: 0.3 });
      return false;
    },
    hud(S) {
      const d = S.data, st = S.holding ? S.stage : 0, vei = [0, 2, 4, 5][st], plume = ['—', '1–5', '10–25', '>25'][st];
      if (S.holding) return st ? `VEI ${vei} · plume ${plume} km · colliding ash separates charge → volcanic lightning` : 'magma rising · chamber overpressure building';
      const C = d.cols;
      if (C && S.now - C.t < 9000 && S.now > C.t) return `columnar jointing: ${C.cracked}/${C.list.length} columns · mean ${Math.round(C.T)} °C · joints open at ≈ 840–890 °C (Lamur 2018) · 3 cracks per junction ⇒ ⟨sides⟩ → 6`;
      if (S.now - d.rel < 1500) return 'eruption · pyroclastic density current racing downslope';
      return 'basalt erupts at ≈ 1100–1200 °C · cooling lava contracts and cracks at 120° triple junctions → hexagonal columns';
    }
  });

  /* ======================= CATHEDRAL: a Voronoi rose window; the pointer is the sun outside ======================= */
  function clipHalf(poly, nx, ny, c, label) {
    const out = [], n = poly.length;
    for (let i = 0; i < n; i++) {
      const P = poly[i], Q = poly[(i + 1) % n], dp = nx * P[0] + ny * P[1] - c, dq = nx * Q[0] + ny * Q[1] - c;
      if (dp <= 0) { out.push(P); if (dq > 0) { const t = dp / (dp - dq); out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t, label]); } }
      else if (dq <= 0) { const t = dp / (dp - dq); out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t, P[2]]); }
    }
    return out;
  }
  function voronoi(seeds, bound) { // each cell = the bound clipped by the perpendicular bisectors with every other seed
    return seeds.map((s, i) => {
      let poly = bound.map((p) => [p[0], p[1], -1]);
      for (let j = 0; j < seeds.length && poly.length; j++) { if (j === i) continue; const q = seeds[j], nx = q[0] - s[0], ny = q[1] - s[1]; poly = clipHalf(poly, nx, ny, nx * (s[0] + q[0]) / 2 + ny * (s[1] + q[1]) / 2, j); }
      let cx = 0, cy = 0; poly.forEach((p) => { cx += p[0]; cy += p[1]; }); cx /= poly.length || 1; cy /= poly.length || 1;
      return { seed: s, poly, cx, cy, nb: Array.from(new Set(poly.map((p) => p[2]).filter((l) => l >= 0))), col: s[2] };
    }).filter((c) => c.poly.length >= 3);
  }
  const JEWEL = { cob: [28, 60, 190], rub: [185, 18, 40], eme: [16, 135, 70], gol: [240, 170, 40], vio: [100, 40, 165], amb: [225, 110, 20], sky: [60, 140, 225] };
  const ROSE = { y: 11.5, R: 6.2 };
  function roseCells() {
    const Rw = ROSE.R, seeds = [[0, 0, JEWEL.gol]];
    const ring = (n, r, off, col) => { for (let k = 0; k < n; k++) { const a = (k + off) / n * TAU; seeds.push([Math.cos(a) * r * Rw, Math.sin(a) * r * Rw, col(k)]); } };
    ring(12, 0.2, 0, (k) => (k % 2 ? JEWEL.rub : JEWEL.amb)); ring(12, 0.4, 0.5, () => JEWEL.cob);
    ring(24, 0.58, 0, (k) => [JEWEL.eme, JEWEL.rub, JEWEL.gol, JEWEL.rub][k % 4]); ring(24, 0.74, 0.5, (k) => (k % 2 ? JEWEL.cob : JEWEL.vio)); ring(24, 0.88, 0, (k) => (k % 2 ? JEWEL.sky : JEWEL.cob));
    const circ = Array.from({ length: 96 }, (_, k) => [Math.cos(k / 96 * TAU) * Rw * 0.97, Math.sin(k / 96 * TAU) * Rw * 0.97]);
    return voronoi(seeds, circ);
  }
  addMode({
    id: 'wd_glass', name: 'CATHEDRAL', glyphs: G('✠✚✙✛✜☩†‡⚜❖◈✦', '+†‡*'),
    base: [40, 55, 90], palette: [[45, 100, 60], [350, 90, 60], [220, 95, 66], [140, 80, 52], [275, 75, 70]],
    links: NONE4, noHueShift: true, count: 90, pageBg: ['#16101c', '#060408'],
    shapes: ['sphere', 'rose', 'dodecahedron', 'compound_five_cubes', 'snub_dodecahedron', 'icosidodecahedron', 'crown', 'rhombicosidodecahedron'],
    init(S) { Object.assign(S.data, { rot: 0, az: 0.2, el: 0.75, shat: null, glow: 0 }); },
    drawNode: hide2D,
    three: {
      init(S, X) {
        const THREE = X.THREE, d = S.data, sc = X.scene, Rw = ROSE.R;
        X.setBloom(0.75, 0.55, 0.7); X.setExposure(1.0); X.maxPixelRatio = 1.25; X.studioEnvironment();
        X.camera.fov = 50; X.camera.updateProjectionMatrix();
        sc.background = new THREE.Color(0x040306); sc.fog = new THREE.FogExp2(0x070509, 0.018);
        const ash = X.canvasTexture(1024, 1024, (x, w, h) => { const r = rng(3); x.fillStyle = '#6d655c'; x.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 64) { let xx = (y / 64) % 2 ? -60 : 0; while (xx < w) { const bw = 100 + r() * 60, k = 0.85 + r() * 0.25; x.fillStyle = `rgb(${Math.round(110 * k)},${Math.round(102 * k)},${Math.round(92 * k)})`; x.fillRect(xx + 2, y + 2, bw - 4, 60); for (let q = 0; q < 60; q++) { x.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.06)'; x.fillRect(xx + r() * bw, y + r() * 64, 2, 2); } xx += bw; } } });
        ash.wrapS = ash.wrapT = THREE.RepeatWrapping; ash.repeat.set(1 / 6, 1 / 6);
        const stone = new THREE.MeshStandardMaterial({ map: ash, bumpMap: ash, bumpScale: 0.04, roughness: 0.88, envMapIntensity: 0.25 });
        // the west wall, pierced by the rose and two lancets (equilateral arches: radius = span)
        const wall = new THREE.Shape(); wall.moveTo(-22, 0); wall.lineTo(22, 0); wall.lineTo(22, 26); wall.lineTo(-22, 26); wall.lineTo(-22, 0);
        const hole = new THREE.Path(); hole.absarc(0, ROSE.y, Rw, 0, TAU, true); wall.holes.push(hole);
        const lw = 3.0, ys = 7.5, yb = 1.2, lancets = [];
        for (const cx of [-11, 11]) {
          const x0 = cx - lw / 2, pts = [[x0, yb]];
          for (let k = 0; k <= 10; k++) { const a = Math.PI - k / 10 * Math.PI / 3; pts.push([x0 + lw + Math.cos(a) * lw, ys + Math.sin(a) * lw]); }
          for (let k = 1; k <= 10; k++) { const a = Math.PI / 3 - k / 10 * Math.PI / 3; pts.push([x0 + Math.cos(a) * lw, ys + Math.sin(a) * lw]); }
          pts.push([x0 + lw, yb]);
          const p = new THREE.Path(); pts.slice().reverse().forEach((q, i) => (i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1]))); wall.holes.push(p); lancets.push(pts);
        }
        const wg = new THREE.ExtrudeGeometry(wall, { depth: 1.4, bevelEnabled: false, curveSegments: 48 }); wg.translate(0, 0, -1.4);
        const wm = new THREE.Mesh(wg, stone); wm.castShadow = wm.receiveShadow = true; sc.add(wm);
        const ringM = new THREE.Mesh(new THREE.TorusGeometry(Rw + 0.15, 0.32, 16, 120), stone); ringM.position.set(0, ROSE.y, 0.1); ringM.castShadow = true; sc.add(ringM);
        const ring2 = new THREE.Mesh(new THREE.TorusGeometry(Rw * 0.2 * 0.95, 0.12, 10, 48), stone); ring2.position.set(0, ROSE.y, -0.6); sc.add(ring2);
        // glass: each Voronoi pane is inset from its neighbours, leaving dark "lead" between
        const cells = roseCells(); d.cells = cells;
        const paneGeo = (cellList, gain) => {
          const pos = [], col = [], pid = [];
          cellList.forEach((c, i) => { const P = c.poly, n = P.length; for (let j = 0; j < n; j++) { const a = P[j], b = P[(j + 1) % n], s = 0.9; pos.push(c.cx, c.cy, 0, c.cx + (a[0] - c.cx) * s, c.cy + (a[1] - c.cy) * s, 0, c.cx + (b[0] - c.cx) * s, c.cy + (b[1] - c.cy) * s, 0); const cc = c.col.map((v) => Math.pow(v / 255, 2.2) * gain); for (let q = 0; q < 3; q++) { const e = q ? 0.8 : 1.25; col.push(cc[0] * e, cc[1] * e, cc[2] * e); pid.push(i); } } });
          const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
          g.userData.pid = pid; g.userData.base = new Float32Array(pos); return g;
        };
        d.glassMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, color: 0xffffff });
        d.glass = new THREE.Mesh(paneGeo(cells, 1), d.glassMat); d.glass.position.set(0, ROSE.y, -0.7); sc.add(d.glass);
        lancets.forEach((b, i) => {
          const r = rng(50 + i), sd = [];
          for (let y = yb + 0.5; y < ys + lw * 0.85; y += 1.0) for (let x = b[0][0] + 0.5; x < b[0][0] + lw; x += 1.0) { const t = (y - yb) / (ys + lw - yb); sd.push([x + (r() - 0.5) * 0.7, y + (r() - 0.5) * 0.7, t > 0.7 ? pick([JEWEL.rub, JEWEL.gol]) : t > 0.3 ? pick([JEWEL.cob, JEWEL.cob, JEWEL.sky, JEWEL.vio]) : pick([JEWEL.eme, JEWEL.cob, JEWEL.amb])]); }
          const lm = new THREE.Mesh(paneGeo(voronoi(sd, b), 1), d.glassMat); lm.position.z = -0.7; sc.add(lm);
        });
        // the nave: a polished marble floor and clustered piers
        const marble = X.canvasTexture(1024, 1024, (x, w, h) => { const r = rng(8); for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { const lt = (i + j) % 2 === 0; x.fillStyle = lt ? '#8f8a82' : '#141316'; x.fillRect(i * 128, j * 128, 128, 128); x.strokeStyle = lt ? 'rgba(90,85,80,0.35)' : 'rgba(200,200,210,0.12)'; x.lineWidth = 1; for (let v = 0; v < 3; v++) { x.beginPath(); let px = i * 128 + r() * 128, py = j * 128; x.moveTo(px, py); for (let s = 0; s < 10; s++) { px += (r() - 0.5) * 30; py += 12.8; x.lineTo(px, py); } x.stroke(); } } x.strokeStyle = 'rgba(0,0,0,0.4)'; for (let k = 0; k <= 8; k++) { x.beginPath(); x.moveTo(k * 128, 0); x.lineTo(k * 128, 1024); x.moveTo(0, k * 128); x.lineTo(1024, k * 128); x.stroke(); } });
        marble.wrapS = marble.wrapT = THREE.RepeatWrapping; marble.repeat.set(5, 5);
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), new THREE.MeshStandardMaterial({ map: marble, roughness: 0.22, metalness: 0, envMapIntensity: 0.35 }));
        floor.rotation.x = -Math.PI / 2; floor.position.z = 21; floor.receiveShadow = true; sc.add(floor);
        const shafts = []; for (let k = 0; k < 4; k++) { const c = new THREE.CylinderGeometry(0.32, 0.32, 21, 16); c.translate(Math.cos(k * Math.PI / 2) * 0.55, 10.5 + 0.9, Math.sin(k * Math.PI / 2) * 0.55); shafts.push(c); }
        const core = new THREE.CylinderGeometry(0.6, 0.6, 21, 20); core.translate(0, 11.4, 0);
        const base = new THREE.LatheGeometry([[0, 0], [1.3, 0], [1.3, 0.5], [1.1, 0.6], [1.0, 0.9], [0.9, 1.0], [0, 1.0]].map((p) => new THREE.Vector2(p[0], p[1])), 24);
        const capi = new THREE.LatheGeometry([[0, 21.9], [0.95, 21.9], [1.3, 22.7], [1.5, 23.0], [1.5, 23.4], [0, 23.4]].map((p) => new THREE.Vector2(p[0], p[1])), 24);
        const pierG = mergeGeo(THREE, [...shafts, core, base, capi]);
        for (const z of [5, 15]) for (const x of [-14.5, 14.5]) { const m = new THREE.Mesh(pierG, stone); m.position.set(x, 0, z); m.castShadow = m.receiveShadow = true; sc.add(m); }
        // the sun outside, low, its light falling through the openings (the wall casts real shadows)
        d.sun = new THREE.DirectionalLight(0xffe2b0, 6); d.sun.castShadow = true; d.sun.shadow.mapSize.set(2048, 2048);
        Object.assign(d.sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 120 }); d.sun.shadow.bias = -0.0006; d.sun.shadow.normalBias = 0.05;
        sc.add(d.sun, d.sun.target);
        sc.add(new THREE.HemisphereLight(0x50566a, 0x120e0a, 0.22));
        // a coloured pool of light where the beam meets the floor, and the beam itself as a soft volume
        const poolTex = X.canvasTexture(512, 512, (x, w, h) => { x.translate(w / 2, h / 2); const s = w / 2 / Rw; cells.forEach((c) => { x.beginPath(); c.poly.forEach((p, i) => (i ? x.lineTo(p[0] * s, -p[1] * s) : x.moveTo(p[0] * s, -p[1] * s))); x.closePath(); x.fillStyle = `rgb(${c.col.join(',')})`; x.fill(); x.strokeStyle = '#000'; x.lineWidth = 4; x.stroke(); }); });
        d.pool = new THREE.Mesh(new THREE.PlaneGeometry(2 * Rw, 2 * Rw), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })); d.pool.rotation.x = -Math.PI / 2; sc.add(d.pool);
        d.beam = new THREE.Mesh(new THREE.CylinderGeometry(Rw * 0.95, Rw * 0.95, 1, 48, 1, true).translate(0, 0.5, 0), new THREE.ShaderMaterial({
          uniforms: { k: { value: 0.12 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
          vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = position.y; vec4 w = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-w.xyz); gl_Position = projectionMatrix * w; }',
          fragmentShader: 'uniform float k; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float f = abs(dot(vN, vV)); float a = k * pow(f, 1.6) * smoothstep(0.0, 0.12, vY) * (1.0 - 0.6 * vY); gl_FragColor = vec4(vec3(1.0, 0.86, 0.62) * a, 1.0); }'
        })); sc.add(d.beam);
        d.day = new THREE.Mesh(new THREE.CircleGeometry(Rw * 1.02, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 4.2, 3), transparent: true, opacity: 0 })); d.day.position.set(0, ROSE.y, -1.6); sc.add(d.day); // daylight, seen only when the glass is gone
        d.dust = makeParticles(X, 500, { order: 7 });
        d.letters = makeLetters(X, S, { glyphs: Array.from(S.mode.glyphList.length ? S.mode.glyphList : ['✦']), font: '84px "Segoe UI Symbol",serif', center: new THREE.Vector3(0, ROSE.y - 0.5, 4), radius: 3.6, size: 0.75 });
        try { X.renderer.compile(X.scene, X.camera); } catch (e) { /* warm-up only */ } d.X = X; d.ready = true;
      },
      update(S, X, now, dt) {
        bloomPulse(S, X, 0.75 + 0.3 * power(S), 1.5, S.data.rel ? now - S.data.rel : -1, 500);
        const d = S.data, THREE = X.THREE, pw = power(S), k = dt / 16, Rw = ROSE.R;
        d.az += ((S.ptrInside ? (S.ptr.x / S.W - 0.5) * -1.1 : Math.sin(now * 0.00008) * 0.4) - d.az) * 0.04 * k;
        d.el += ((S.ptrInside ? lerp(0.95, 0.45, clamp(S.ptr.y / S.H, 0, 1)) : 0.75) - d.el) * 0.04 * k;
        const dir = new THREE.Vector3(Math.sin(d.az) * Math.cos(d.el), -Math.sin(d.el), Math.cos(d.az) * Math.cos(d.el)).normalize(); // light travels along dir (into the nave)
        const c0 = new THREE.Vector3(0, ROSE.y, 0);
        d.sun.position.copy(c0).addScaledVector(dir, -60); d.sun.target.position.copy(c0).addScaledVector(dir, 20);
        d.glow += ((S.holding ? 0.5 + 1.2 * pw : 0) - d.glow) * 0.05 * k;
        d.sun.intensity = 6 * (1 + 0.6 * d.glow);
        const t = -ROSE.y / dir.y, hit = c0.clone().addScaledVector(dir, t);
        d.pool.position.set(hit.x, 0.02, hit.z); d.pool.rotation.z = 0;
        const hz = Math.hypot(dir.x, dir.z), stretch = 1 / Math.max(0.3, Math.sin(d.el));
        d.pool.rotation.set(-Math.PI / 2, 0, -Math.atan2(dir.x, dir.z)); d.pool.scale.set(1, stretch, 1);
        d.pool.material.opacity = (0.35 + 0.5 * d.glow) * (d.shat ? 0.2 : 1);
        const len = c0.distanceTo(hit); d.beam.position.copy(c0); d.beam.scale.set(1, len, 1); d.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        d.beam.material.uniforms.k.value = (0.1 + 0.18 * d.glow) * (d.shat ? 2 : 1);
        if (S.holding && S.stage >= 1 && !RM(S)) d.rot += dt * 0.00004 * S.stage * S.stage;
        d.glass.rotation.z = d.rot; d.glassMat.color.setScalar(0.9 + 1.4 * d.glow + 0.5 * (1 - Math.min(1, Math.abs(d.az))));
        // the shatter: every pane flies out and falls, then flies home
        d.day.material.opacity = d.shat ? (1 - smooth(1800, 2900, now - d.shat.t)) : 0; d.day.visible = d.day.material.opacity > 0.01;
        const sh = d.shat, g = d.glass.geometry, pa = g.attributes.position.array, base = g.userData.base, pid = g.userData.pid;
        if (sh) {
          const tt = now - sh.t;
          for (const p of sh.p) {
            if (tt < 1500) { p.vy -= 0.012 * k; p.x += p.vx * k; p.y += p.vy * k; p.z += p.vz * k; p.r += p.vr * k; if (p.y < -ROSE.y + 0.05) { p.y = -ROSE.y + 0.05; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; p.vr *= 0.5; } p.fx = p.x; p.fy = p.y; p.fz = p.z; p.fr = p.r; }
            else { const u = smooth(1500, 2900, tt); p.x = lerp(p.fx, 0, u); p.y = lerp(p.fy, 0, u); p.z = lerp(p.fz, 0, u); p.r = lerp(p.fr, 0, u); }
          }
          for (let i = 0; i < pid.length; i++) {
            const p = sh.p[pid[i]], c = d.cells[pid[i]], lx = base[i * 3] - c.cx, ly = base[i * 3 + 1] - c.cy, cr = Math.cos(p.r), sr = Math.sin(p.r);
            pa[i * 3] = c.cx + p.x + lx * cr; pa[i * 3 + 1] = c.cy + p.y + ly; pa[i * 3 + 2] = p.z + lx * sr;
          }
          g.attributes.position.needsUpdate = true;
          if (tt > 2950) { pa.set(base); g.attributes.position.needsUpdate = true; d.shat = null; }
        }
        if (Math.random() < 0.7) { const u = Math.random(), r = Math.sqrt(Math.random()) * Rw * 0.8, a = rand(0, TAU), p = c0.clone().addScaledVector(dir, u * len); d.dust.add({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r * 0.6, z: p.z + Math.sin(a) * r * 0.6, vx: rand(-0.004, 0.004), vy: rand(-0.004, 0.002), vz: rand(-0.004, 0.004), size: rand(0.03, 0.07), life: rand(4000, 7000), t: now, r: 1.4, gc: 1.25, b: 1, fade: (q) => Math.sin(q * Math.PI) * (0.6 + 0.4 * Math.sin(now * 0.002 + q * 9)) }); }
        d.dust.update(S, dt);
        const cam = X.camera, sw = RM(S) ? 0 : Math.sin(now * 0.00006);
        cam.position.set(sw * 2.5 + (S.ptrInside ? (S.ptr.x / S.W - 0.5) * 3 : 0), 3.2 + (S.holding ? 1.5 * pw : 0), 31 - (S.holding ? 5 * pw : 0)); cam.lookAt(0, ROSE.y - 3.5, 0);
        const pal = S.mode.palette;
        d.letters.update(S, (n, out) => n.inf ? out.copy(lin(THREE, pal[n.gen % pal.length][0], 95, 62, 1.8 + S.stage * 0.5)) : out.copy(lin(THREE, 42, 70, 82, 0.8)));
      }
    },
    onRelease(S, held, pw) {
      const d = S.data; d.rel = S.now; if (!d.ready) return false;
      if (RM(S)) return false;
      d.shat = { t: S.now, p: d.cells.map((c) => { const a = Math.atan2(c.cy, c.cx), v = rand(0.05, 0.16) * clamp(pw, 0.6, 1.4); return { x: 0, y: 0, z: 0, vx: Math.cos(a) * v * 0.6, vy: Math.sin(a) * v * 0.6 + 0.05, vz: rand(0.12, 0.3) * clamp(pw, 0.6, 1.4), r: 0, vr: rand(-0.06, 0.06) }; }) };
      return false;
    },
    hud(S) {
      const d = S.data, n = d.cells ? d.cells.length : 97, alt = Math.round((d.el || 0) * 180 / Math.PI);
      if (S.holding) return ['the sun finds the glass', '12-fold rotational symmetry: turn it by 30° and nothing changes', `the rose turns · ${n} panes alight`, 'full choir of light · let go to shatter it (it mends)'][S.stage];
      if (d.shat) return `${n} panes in flight · the glazier sighs · reassembling`;
      return `rose window: ${n} Voronoi panes (each holds every point nearer its seed than any other) · lancets: equilateral arches, radius = span · sun altitude ${alt}°`;
    }
  });

  /* ======================= SUMI-E: a calligrapher's desk; ink bleeding by Fick's law; one katana cut ======================= */
  const INK = '18,15,13', PAPERW = 8.6, PAPERH = 6.08, PW = 1024, PH = 724;
  function brushStroke(x, ax, ay, bx, by, w, col, a, dry, seed) { // a tapered brush stroke with a dry-brush tail
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy); if (len < 2) return;
    const nx = -dy / len, ny = dx / len, bend = (seed - 0.5) * len * 0.22, N = 8, P = [];
    for (let i = 0; i <= N; i++) { const t = i / N, b = Math.sin(t * Math.PI) * bend, hw = w * Math.min(1, t / 0.12 + 0.2) * (1 - 0.8 * t) + 0.3, px = ax + dx * t + nx * b, py = ay + dy * t + ny * b; P.push([px + nx * hw, py + ny * hw, px - nx * hw, py - ny * hw, px, py]); }
    x.beginPath(); x.moveTo(P[0][0], P[0][1]); for (let i = 1; i <= N; i++) x.lineTo(P[i][0], P[i][1]); for (let i = N; i >= 0; i--) x.lineTo(P[i][2], P[i][3]); x.closePath();
    x.fillStyle = `rgba(${col},${0.82 * a})`; x.fill();
    if (dry && len > 20) { x.setLineDash([len * 0.3, 3 + seed * 5, len * 0.12, 6]); x.lineWidth = 0.8; x.strokeStyle = `rgba(${col},${0.5 * a})`; x.beginPath(); for (const o of [-1.5, 1.4]) { P.forEach((p, i) => { const qx = p[4] + nx * o * w, qy = p[5] + ny * o * w; if (i) x.lineTo(qx, qy); else x.moveTo(qx, qy); }); } x.stroke(); x.setLineDash([]); }
  }
  function paperBase(x, w, h) {
    const r = rng(7); x.fillStyle = '#ece2cc'; x.fillRect(0, 0, w, h);
    for (let k = 0; k < 20; k++) { const px = r() * w, py = r() * h, rr = 60 + r() * 200, g = x.createRadialGradient(px, py, 0, px, py, rr); g.addColorStop(0, `rgba(${r() < 0.5 ? '160,130,90' : '255,250,235'},0.06)`); g.addColorStop(1, 'rgba(160,130,90,0)'); x.fillStyle = g; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); }
    x.lineWidth = 0.6;
    for (const col of ['120,96,62', '255,252,240']) { x.strokeStyle = `rgba(${col},0.16)`; x.beginPath(); for (let i = 0; i < w * h / 900; i++) { const px = r() * w, py = r() * h, a = r() * TAU, l = 4 + r() * 14; x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a + 0.6) * l * 0.5, py + Math.sin(a + 0.6) * l * 0.5, px + Math.cos(a) * l, py + Math.sin(a) * l); } x.stroke(); }
    const hs = 46, hx = w - hs - 34, hy = h - hs - 34; // the seal, in an invented script
    x.fillStyle = 'rgba(178,32,28,0.88)'; x.fillRect(hx, hy, hs, hs); x.strokeStyle = '#ece2cc'; x.lineWidth = 2; x.strokeRect(hx + 4, hy + 4, hs - 8, hs - 8); x.lineWidth = 2.4; x.beginPath();
    for (let q = 0; q < 4; q++) { const ox = hx + 7 + (q % 2) * 17, oy = hy + 7 + Math.floor(q / 2) * 17; for (let s = 0; s < 3; s++) { const a = 2 + r() * 12; if (r() < 0.5) { x.moveTo(ox + a, oy + 1); x.lineTo(ox + a, oy + 2 + r() * 12); } else { x.moveTo(ox + 1, oy + a); x.lineTo(ox + 2 + r() * 12, oy + a); } } }
    x.stroke();
  }
  function paperPoly(THREE, poly) { // a flat piece of the sheet (x, z polygon) with UVs matching the full sheet
    const sh = new THREE.Shape(); poly.forEach((p, i) => (i ? sh.lineTo(p[0], -p[1]) : sh.moveTo(p[0], -p[1])));
    const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2);
    const P = g.attributes.position, uv = new Float32Array(P.count * 2);
    for (let i = 0; i < P.count; i++) { uv[i * 2] = P.getX(i) / PAPERW + 0.5; uv[i * 2 + 1] = 0.5 - P.getZ(i) / PAPERH; }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g;
  }
  addMode({
    id: 'wd_ink', name: 'SUMI-E', glyphs: G('山水風雲月花雨雪木火石空海森竹鳥川光夢心', 'MNWVAZXK'),
    base: [30, 12, 9], palette: [[4, 76, 42], [20, 10, 8], [28, 48, 26], [352, 72, 36]],
    links: NONE4, noHueShift: true, count: 64, pageBg: ['#2a241b', '#0e0c09'],
    shapes: ['sphere', 'seashell', 'torus', 'trefoil', 'sunflower', 'helicoid', 'rose', 'mobius'],
    init(S) { Object.assign(S.data, { drops: [], enso: 0, ensoA: 1, cut: null, lastFade: 0, lastDrip: 0, frame: 0, cx: 0 }); },
    drawNode: hide2D,
    onInfect(S, n) { const d = S.data; if (d.drops.length < 150 && n.data.pp) d.drops.push({ x: n.data.pp[0], y: n.data.pp[1], t0: S.now, s0: 3, D: rand(0.12, 0.3), m: 16, v: Math.floor(rand(0, 3)) }); },
    three: {
      init(S, X) {
        const THREE = X.THREE, d = S.data, sc = X.scene;
        X.setBloom(0.12, 0.4, 0.97); X.setExposure(1.0); X.studioEnvironment(); X.maxPixelRatio = 1.5;
        X.camera.fov = 36; X.camera.updateProjectionMatrix();
        sc.background = new THREE.Color(0x0c0907);
        const deskT = X.canvasTexture(1024, 1024, (x, w, h) => woodGrain(x, w, h, '#3a2213', '#170b05', 61, true)); deskT.wrapS = deskT.wrapT = THREE.RepeatWrapping; deskT.repeat.set(2, 2);
        const desk = new THREE.Mesh(new THREE.PlaneGeometry(40, 26), new THREE.MeshPhysicalMaterial({ map: deskT, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.3, envMapIntensity: 0.3 })); desk.rotation.x = -Math.PI / 2; desk.receiveShadow = true; sc.add(desk);
        const felt = new THREE.Mesh(new THREE.PlaneGeometry(PAPERW + 1.4, PAPERH + 1.2), new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 1 })); felt.rotation.x = -Math.PI / 2; felt.position.y = 0.006; felt.receiveShadow = true; sc.add(felt);
        // the sheet: its texture is redrawn as the ink spreads
        d.pc = mk(PW, PH); d.px = d.pc.getContext('2d'); d.base = mk(PW, PH); paperBase(d.base.getContext('2d'), PW, PH);
        d.stain = mk(PW / 2, PH / 2); d.sx = d.stain.getContext('2d');
        d.ptex = new THREE.CanvasTexture(d.pc); d.ptex.encoding = THREE.sRGBEncoding; d.ptex.anisotropy = 8;
        d.pmat = new THREE.MeshStandardMaterial({ map: d.ptex, roughness: 0.92, envMapIntensity: 0.15 });
        d.paper = new THREE.Mesh(paperPoly(THREE, [[-PAPERW / 2, -PAPERH / 2], [PAPERW / 2, -PAPERH / 2], [PAPERW / 2, PAPERH / 2], [-PAPERW / 2, PAPERH / 2]]), d.pmat); d.paper.position.y = 0.014; d.paper.receiveShadow = true; sc.add(d.paper);
        // paperweights, an inkstone with a pool of ink, a brush on its rest
        const bronze = new THREE.MeshStandardMaterial({ color: 0x5a4630, metalness: 1, roughness: 0.38 });
        if (THREE.RoundedBoxGeometry) for (const z of [-PAPERH / 2 + 0.25, PAPERH / 2 - 0.25]) { const b = new THREE.Mesh(new THREE.RoundedBoxGeometry(6.4, 0.32, 0.42, 3, 0.08), bronze); b.position.set(0, 0.18, z); b.castShadow = b.receiveShadow = true; sc.add(b); }
        const slate = new THREE.MeshStandardMaterial({ color: 0x2b2d30, roughness: 0.55, envMapIntensity: 0.4 });
        if (THREE.RoundedBoxGeometry) { const st = new THREE.Mesh(new THREE.RoundedBoxGeometry(2.2, 0.45, 3.4, 4, 0.12), slate); st.position.set(6.7, 0.225, -0.4); st.castShadow = st.receiveShadow = true; sc.add(st); }
        const pool = new THREE.Mesh(new THREE.CircleGeometry(0.75, 40), new THREE.MeshPhysicalMaterial({ color: 0x020202, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.2 })); pool.rotation.x = -Math.PI / 2; pool.scale.set(1, 1.5, 1); pool.position.set(6.7, 0.455, -1.0); sc.add(pool);
        const bam = X.canvasTexture(256, 64, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#6b5a30'); g.addColorStop(0.5, '#b39a5c'); g.addColorStop(1, '#5a4a28'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(60,40,15,0.6)'; for (const u of [0.2, 0.55, 0.9]) x.fillRect(u * w, 0, 4, h); });
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 3.4, 20), new THREE.MeshStandardMaterial({ map: bam, roughness: 0.45 }));
        const tip = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.05, 0.08], [0.11, 0.35], [0.1, 0.6], [0.085, 0.75]].map((p) => new THREE.Vector2(p[0], p[1])), 20), new THREE.MeshStandardMaterial({ color: 0x121010, roughness: 0.7 }));
        tip.position.y = -2.45; handle.add(tip); handle.rotation.set(0, 0.25, Math.PI / 2); handle.position.set(-6.6, 0.28, 0.8); handle.castShadow = true; tip.castShadow = true; sc.add(handle);
        const rest = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.6, 16), slate); rest.rotation.x = Math.PI / 2; rest.position.set(-5.4, 0.15, 0.7); rest.castShadow = true; sc.add(rest);
        // a katana, for the last stage
        const bs = new THREE.Shape(); bs.moveTo(0, 0); bs.quadraticCurveTo(3.4, 0.05, 6.6, 0.42); bs.lineTo(7.0, 0.56); bs.quadraticCurveTo(6.6, 0.68, 6.3, 0.68); bs.quadraticCurveTo(3.4, 0.33, 0, 0.3); bs.lineTo(0, 0);
        const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(bs, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 2, curveSegments: 24 }), new THREE.MeshStandardMaterial({ color: 0xdfe4ea, metalness: 1, roughness: 0.08, envMapIntensity: 1.4 }));
        const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 28), new THREE.MeshStandardMaterial({ color: 0x1c1a18, metalness: 0.8, roughness: 0.5 })); tsuba.rotation.z = Math.PI / 2; tsuba.position.set(-0.04, 0.15, 0.02);
        const wrapT = X.canvasTexture(256, 64, (x, w, h) => { x.fillStyle = '#121012'; x.fillRect(0, 0, w, h); x.fillStyle = '#e8e2d4'; for (let i = 0; i < w; i += 32) { x.beginPath(); x.moveTo(i, h / 2); x.lineTo(i + 16, 8); x.lineTo(i + 32, h / 2); x.lineTo(i + 16, h - 8); x.fill(); } });
        const tsuka = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 2.1, 16), new THREE.MeshStandardMaterial({ map: wrapT, roughness: 0.7 })); tsuka.rotation.z = Math.PI / 2; tsuka.position.set(-1.12, 0.15, 0.02);
        d.katana = new THREE.Group(); [blade, tsuba, tsuka].forEach((m) => { m.castShadow = true; d.katana.add(m); }); d.katana.visible = false; sc.add(d.katana);
        // light: a cool window from the left, a warm lamp that follows the pointer
        const win = new THREE.DirectionalLight(0xdfe8ff, 1.8); win.position.set(-8, 12, -5); win.castShadow = true; win.shadow.mapSize.set(2048, 2048);
        Object.assign(win.shadow.camera, { left: -10, right: 10, top: 8, bottom: -8, near: 1, far: 40 }); win.shadow.bias = -0.0004; win.shadow.normalBias = 0.02; sc.add(win);
        d.lamp = new THREE.PointLight(0xffc890, 60, 0, 2); d.lamp.position.set(4, 5, 4); sc.add(d.lamp);
        sc.add(new THREE.HemisphereLight(0xb0b8c8, 0x3a2414, 0.35));
        // the flash of the cut: a white-hot streak along the line
        const sl = X.canvasTexture(256, 32, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); const g2 = x.createLinearGradient(0, 0, w, 0); g2.addColorStop(0, 'rgba(0,0,0,1)'); g2.addColorStop(0.1, 'rgba(0,0,0,0)'); g2.addColorStop(0.9, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,1)'); x.globalCompositeOperation = 'destination-out'; x.fillStyle = g2; x.fillRect(0, 0, w, h); });
        d.slash = new THREE.Mesh(new THREE.PlaneGeometry(16, 0.18), new THREE.MeshBasicMaterial({ map: sl, color: new THREE.Color(6, 5.4, 4.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); d.slash.rotation.x = -Math.PI / 2; sc.add(d.slash);
        d.katana.visible = true; try { X.renderer.compile(sc, X.camera); } catch (e) { /* optional */ } d.katana.visible = false;
        d.X = X; d.ready = true;
      },
      update(S, X, now, dt) {
        const d = S.data, THREE = X.THREE, pw = power(S), k = dt / 16, cam = X.camera;
        bloomPulse(S, X, 0.12 + 0.25 * pw, 1.6, d.cut ? now - d.cut.t - 120 : -1, 350);
        if (d.cut && !RM(S)) { const t = now - d.cut.t, u = smooth(60, 200, t); d.slash.position.set(d.cut.wx, 0.06, d.cut.wz); d.slash.rotation.z = -d.cut.ang; d.slash.scale.set(Math.max(0.01, u), 1 + 2 * (1 - smooth(200, 600, t)), 1); d.slash.material.opacity = smooth(60, 120, t) * (1 - smooth(250, 800, t)); } else d.slash.material.opacity = 0;
        d.cx += ((S.ptrInside ? (S.ptr.x / S.W - 0.5) * 2.5 : 0) - d.cx) * 0.03 * k;
        const sw = RM(S) ? 0 : Math.sin(now * 0.00006);
        cam.position.set(d.cx + sw * 1.2, 11.5 - (S.holding ? 1.5 * pw : 0), 8.2 - (S.holding ? 1 * pw : 0)); cam.lookAt(d.cx * 0.3, 0, 0.3);
        // where is the pointer on the paper?
        let hit = null;
        if (S.ptrInside) { const p = X.fromScreen(S.ptr.x, S.ptr.y, 0), dir = p.clone().sub(cam.position).normalize(), t = -cam.position.y / dir.y; hit = cam.position.clone().addScaledVector(dir, t); }
        if (hit) d.lamp.position.lerp(new THREE.Vector3(hit.x, 4.5, hit.z + 2), 0.08 * k);
        if (hit && pspeed(S) > 3 && now - d.lastDrip > 70 && d.drops.length < 150 && Math.abs(hit.x) < PAPERW / 2 && Math.abs(hit.z) < PAPERH / 2) { d.lastDrip = now; d.drops.push({ x: (hit.x / PAPERW + 0.5) * PW, y: (hit.z / PAPERH + 0.5) * PH, t0: now, s0: 2, D: 0.08, m: S.holding ? 8 : 4, v: Math.floor(rand(0, 3)) }); }
        if (S.holding) { d.enso = Math.max(d.enso, pw); d.ensoA = 1; } else if (d.enso > 0) { d.ensoA -= dt / 3000; if (d.ensoA <= 0) { d.enso = 0; d.ensoA = 1; } }
        // node positions on the sheet (the letters are painted, not floating)
        for (const n of S.active) { const pp = n.data.pp || (n.data.pp = [0, 0]); pp[0] = PW * (0.5 + (n.rx || 0) * 0.34); pp[1] = PH * (0.5 + (n.ry || 0) * 0.4); }
        // redraw the sheet every other frame
        d.frame++;
        if (d.frame % 2 === 0) drawSheet(S, d, now);
        // the katana: drawn at stage III, swept across on release
        const kt = d.katana, c = d.cut;
        if (c && !RM(S) && now - c.t < 700) {
          const u = smooth(0, 240, now - c.t), ux = Math.cos(c.ang), uz = Math.sin(c.ang);
          kt.visible = true; kt.position.set(c.wx + ux * lerp(-9, 9, u) - 3.5 * ux, 0.35 + Math.sin(u * Math.PI) * 0.3 + smooth(260, 700, now - c.t) * 4, c.wz + uz * lerp(-9, 9, u) - 3.5 * uz); kt.rotation.set(Math.PI / 2, 0, -c.ang);
        } else if (S.holding && S.stage === 3) {
          kt.visible = true; const tt = now * 0.0006; kt.position.set(-3.2 + Math.sin(tt) * 0.3, 2.6 + Math.sin(tt * 1.7) * 0.15, -0.4); kt.rotation.set(0.25 + Math.sin(tt) * 0.08, 0.3 + Math.sin(tt * 0.8) * 0.2, -0.12);
        } else kt.visible = false;
        // the cut: two halves of the sheet slide apart along the line, then lie back together
        if (c && d.halves) {
          const t = now - c.t, open = smooth(150, 320, t) * (1 - smooth(1200, 2000, t)), ux = Math.cos(c.ang), uz = Math.sin(c.ang);
          d.halves.forEach((h, i) => { const s = i ? 1 : -1; h.position.set(ux * 0.5 * open * s + -uz * 0.12 * open * s, 0.014 + (i ? 0.003 : 0), uz * 0.5 * open * s + ux * 0.12 * open * s); });
          if (t > 2050) { d.halves.forEach((h) => { X.scene.remove(h); h.geometry.dispose(); }); d.halves = null; d.paper.visible = true; }
        }
      }
    },
    onRelease(S, held, pw) {
      const d = S.data; d.rel = S.now; d.cuts = (d.cuts || 0) + 1; if (!d.ready) return false;
      const X = d.X, THREE = X.THREE, cam = X.camera, p = X.fromScreen(S.ptr.x, S.ptr.y, 0), dir = p.clone().sub(cam.position).normalize(), hit = cam.position.clone().addScaledVector(dir, -cam.position.y / dir.y);
      const ang = -0.45 + rand(-0.15, 0.15); d.cut = { t: S.now, wx: clamp(hit.x, -3, 3), wz: clamp(hit.z, -2, 2), ang };
      for (let k = 0; k < 10; k++) { const s = rand(-0.5, 0.5) * PW; d.drops.push({ x: (d.cut.wx / PAPERW + 0.5) * PW + Math.cos(ang) * s, y: (d.cut.wz / PAPERH + 0.5) * PH + Math.sin(ang) * s, t0: S.now, s0: 2.5, D: rand(0.1, 0.25), m: 9, v: Math.floor(rand(0, 3)) }); }
      if (RM(S)) return false;
      const rect = [[-PAPERW / 2, -PAPERH / 2, -1], [PAPERW / 2, -PAPERH / 2, -1], [PAPERW / 2, PAPERH / 2, -1], [-PAPERW / 2, PAPERH / 2, -1]];
      const nx = -Math.sin(ang), nz = Math.cos(ang), c0 = nx * d.cut.wx + nz * d.cut.wz;
      if (d.halves) d.halves.forEach((h) => { X.scene.remove(h); h.geometry.dispose(); });
      d.halves = [clipHalf(rect, nx, nz, c0, 0), clipHalf(rect, -nx, -nz, -c0, 0)].map((poly) => { const m = new THREE.Mesh(paperPoly(THREE, poly), d.pmat); m.receiveShadow = true; m.position.y = 0.014; X.scene.add(m); return m; });
      d.paper.visible = false;
      return false;
    },
    hud(S) {
      const d = S.data, last = d.drops[d.drops.length - 1];
      let sg = 0, t = 0; if (last) { t = (S.now - last.t0) / 1000; sg = Math.sqrt(last.s0 * last.s0 + 2 * last.D * (S.now - last.t0)) * 0.21; } // px on the sheet → mm (the sheet is ~215 mm wide)
      if (S.holding) return ['ink loaded · ' + d.drops.length + ' drops bleeding', 'ensō: one breath, one stroke', 'the circle stays open on purpose', 'the blade is drawn · let go'][S.stage];
      if (d.rel && S.now - d.rel < 3500) return `一 one cut (${d.cuts}) · paper: forgiving · ink: not`;
      return last ? `Fick: σ = √(σ₀² + 2Dt) = ${sg.toFixed(1)} mm at t = ${t.toFixed(1)} s · peak ∝ 1/σ² · the ink is conserved` : 'move over the sheet to drip ink · a drop spreads as √t (Fick; Lucas–Washburn wicking also goes as √t)';
    }
  });
  function drawSheet(S, d, now) {
    const x = d.px, dots = inkDots();
    x.drawImage(d.base, 0, 0);
    const keep = [];
    for (const p of d.drops) { // Fick: a point of ink spreads as a Gaussian with sigma = sqrt(sigma0^2 + 2 D t); its peak falls as 1/sigma^2
      const t = now - p.t0, sg = Math.sqrt(p.s0 * p.s0 + 2 * p.D * t), a = Math.min(0.9, p.m * p.s0 * p.s0 / (sg * sg));
      if (t > 4000) { d.sx.globalAlpha = a; d.sx.drawImage(dots[p.v], (p.x - sg * 1.6) / 2, (p.y - sg * 1.6) / 2, sg * 1.6, sg * 1.6); d.sx.globalAlpha = 1; continue; }
      keep.push(p); x.globalAlpha = a; x.drawImage(dots[p.v], p.x - sg * 1.6, p.y - sg * 1.6, sg * 3.2, sg * 3.2);
    }
    x.globalAlpha = 1; d.drops = keep;
    if (now - d.lastFade > 600) { d.lastFade = now; d.sx.globalCompositeOperation = 'destination-out'; d.sx.fillStyle = 'rgba(0,0,0,0.05)'; d.sx.fillRect(0, 0, d.stain.width, d.stain.height); d.sx.globalCompositeOperation = 'source-over'; }
    x.drawImage(d.stain, 0, 0, PW, PH);
    if (d.enso > 0.01) { // the ensō: one breath, one stroke, left open
      const R = PH * 0.42, cx = PW / 2, cy = PH / 2, N = Math.max(2, Math.floor(110 * d.enso)), sweep = TAU * 0.93 * d.enso, pts = [];
      for (let i = 0; i <= N; i++) { const t = i / N, a = -2.1 + sweep * t, u = t * d.enso, rr = R * (1 + 0.018 * Math.sin(a * 3 + 1)), w = 15 * Math.min(1, u * 9 + 0.3) * (1 - 0.75 * u) + 1.5; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, Math.cos(a), Math.sin(a), w]); }
      x.fillStyle = `rgba(${INK},${0.85 * d.ensoA})`; x.beginPath(); pts.forEach((p, i) => { const qx = p[0] + p[2] * p[4], qy = p[1] + p[3] * p[4]; if (i) x.lineTo(qx, qy); else x.moveTo(qx, qy); }); for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; x.lineTo(p[0] - p[2] * p[4], p[1] - p[3] * p[4]); } x.closePath(); x.fill();
    }
    const st = S.holding ? S.stage : 0;
    for (const l of S.links) { // webs: brush strokes
      const A = l.A.data.pp, B = l.B.data.pp; if (!A || !B) continue;
      const g = clamp((now - l.born) / 220, 0, 1), f = l.dying ? 1 - (now - l.dying) / 700 : 1; if (f <= 0) continue;
      brushStroke(x, A[0], A[1], A[0] + (B[0] - A[0]) * g, A[1] + (B[1] - A[1]) * g, (1.6 + st * 1.1) * (0.7 + l.seed * 0.6), st === 3 && l.seed < 0.2 ? '176,36,30' : INK, f, st >= 2, l.seed);
    }
    x.textAlign = 'center'; x.textBaseline = 'middle';
    const order = S.active.slice().sort((a, b) => (a.rz || 0) - (b.rz || 0)), list = S.mode.glyphList;
    for (const n of order) { // the letters, brushed: nearer ones darker and larger
      const pp = n.data.pp; if (!pp) continue;
      const depth = clamp(0.5 + (n.rz || 0) * 0.5, 0, 1), a = clamp(n.alpha, 0, 1) * (0.35 + 0.65 * depth), sz = 30 + 16 * depth, g = list.length ? (now < n.scr ? pick(list) : n.g) : n.g;
      x.font = `${sz.toFixed(0)}px serif`;
      x.fillStyle = n.inf ? S.colorOf(n.gen, a * 0.25) : `rgba(${INK},${a * 0.2})`; x.fillText(g, pp[0] + 1.5, pp[1] + 1.2);
      x.fillStyle = n.inf ? S.colorOf(n.gen, a) : `rgba(${INK},${a * 0.92})`; x.fillText(g, pp[0], pp[1]);
    }
    d.ptex.needsUpdate = true;
  }

  /* ======================= ORIGAMI: a Sonobe kusudama under a desk lamp, paper cranes, and the flat-folding theorems ======================= */
  const toLin = (THREE, rgb, k) => new THREE.Color(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255).convertSRGBToLinear().multiplyScalar(k || 1);
  function craneParts(THREE) { // a folded crane, nose along +x: one body (neck, head, tail) and two hinged wings
    const tri = (pts) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts.flat()), 3)); g.computeVertexNormals(); return g; };
    const F = [0.45, 0, 0], B = [-0.45, 0, 0], T = [0, 0.16, 0], L = [0, -0.06, 0.13], R = [0, -0.06, -0.13];
    const body = tri([F, T, L, F, R, T, B, L, T, B, T, R, F, L, R, B, R, L,
      [0.3, 0.02, 0.03], [0.86, 0.56, 0], [0.3, 0.02, -0.03], [0.86, 0.56, 0], [1.0, 0.44, 0], [0.84, 0.5, 0.02],
      [-0.3, 0.02, 0.03], [-0.3, 0.02, -0.03], [-0.86, 0.5, 0]]);
    const wing = tri([[-0.2, 0, 0], [0.22, 0, 0], [0.02, 0, 0.95], [-0.2, 0, 0], [0.02, 0, 0.95], [-0.05, 0.03, 0.5]]);
    return { body, wing };
  }
  addMode({
    id: 'wd_origami', name: 'ORIGAMI', glyphs: '◆▲▼◆▲▼◇',
    base: [40, 30, 94], palette: [[355, 78, 60], [42, 92, 60], [175, 62, 46], [330, 72, 70], [215, 70, 60]],
    links: NONE4, noHueShift: true, count: 84, pageBg: ['#1b2244', '#080b18'],
    shapes: ['sphere', 'icosahedron', 'stella_octangula', 'octahedron', 'compound_five_tetrahedra', 'great_stellated_dodecahedron', 'cuboctahedron', 'rhombic_dodecahedron'],
    init(S) { if (!KUS) KUS = kusudama(); Object.assign(S.data, { ra: 0, rb: 0.4, ex: 0, vtx: flatVertex(), bloom: -1e9, lx: 3, ly: 6 }); },
    drawNode: hide2D,
    three: {
      init(S, X) {
        const THREE = X.THREE, d = S.data, sc = X.scene; d.X = X;
        X.setBloom(0.18, 0.4, 0.95); X.setExposure(0.8); X.studioEnvironment(); X.maxPixelRatio = 1.5;
        X.camera.fov = 38; X.camera.updateProjectionMatrix(); X.camera.position.set(0, 1.2, 17); X.camera.lookAt(0, 0.3, 0);
        sc.background = new THREE.Color(0x0e1226);
        const fiber = (base, seed) => (x, w, h) => { const r = rng(seed); x.fillStyle = base; x.fillRect(0, 0, w, h); x.lineWidth = 0.8; for (const c of ['rgba(255,255,255,0.12)', 'rgba(0,0,0,0.1)']) { x.strokeStyle = c; x.beginPath(); for (let i = 0; i < w * h / 300; i++) { const px = r() * w, py = r() * h, a = r() * TAU, l = 4 + r() * 18; x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a + 0.7) * l / 2, py + Math.sin(a + 0.7) * l / 2, px + Math.cos(a) * l, py + Math.sin(a) * l); } x.stroke(); } };
        const washi = X.canvasTexture(1024, 1024, fiber('#161c3c', 3)); washi.wrapS = washi.wrapT = THREE.RepeatWrapping; washi.repeat.set(3, 3);
        const back = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.MeshStandardMaterial({ map: washi, roughness: 0.95 })); back.position.set(0, 6, -7); back.receiveShadow = true; sc.add(back);
        const table = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.MeshStandardMaterial({ map: washi, roughness: 0.95, color: 0x8a8ea8 })); table.rotation.x = -Math.PI / 2; table.position.set(0, -4.2, 3); table.receiveShadow = true; sc.add(table);
        d.lamp = new THREE.SpotLight(0xffe6c4, 340, 0, 0.5, 0.85, 2); d.lamp.position.set(4, 7, 11); d.lamp.castShadow = true; d.lamp.shadow.mapSize.set(2048, 2048);
        d.lamp.shadow.camera.near = 4; d.lamp.shadow.camera.far = 40; d.lamp.shadow.bias = -0.0004; d.lamp.shadow.normalBias = 0.03; sc.add(d.lamp, d.lamp.target);
        sc.add(new THREE.HemisphereLight(0x8090c0, 0x202030, 0.18));
        const rim = new THREE.DirectionalLight(0x9ab0ff, 0.8); rim.position.set(-6, 5, -8); sc.add(rim);
        // the kusudama: every Sonobe facet carries a shallow valley crease down its middle
        const paperTex = X.canvasTexture(256, 256, fiber('#ffffff', 8));
        const pos = [], col = [], uv = [], nrm = [];
        KUS.forEach((t) => {
          const m = [(t.a[0] + t.b[0]) / 2 * 0.95, (t.a[1] + t.b[1]) / 2 * 0.95, (t.a[2] + t.b[2]) / 2 * 0.95], c = toLin(THREE, PAPER[t.unit % 5]);
          for (const tr of [[t.a, m, t.c], [m, t.b, t.c]]) { tr.forEach((v) => { pos.push(...v); col.push(c.r, c.g, c.b); nrm.push(...t.n); }); uv.push(0, 0, 1, 0, 0.5, 1); }
        });
        const kg = new THREE.BufferGeometry(); kg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3)); kg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3)); kg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
        kg.computeVertexNormals(); kg.userData.base = new Float32Array(pos); kg.userData.n = new Float32Array(nrm);
        d.kus = new THREE.Mesh(kg, new THREE.MeshStandardMaterial({ vertexColors: true, map: paperTex, roughness: 0.86, flatShading: true, side: THREE.DoubleSide })); d.kus.scale.setScalar(1.25);
        d.kus.castShadow = d.kus.receiveShadow = true; sc.add(d.kus);
        // the letters: scraps of folded paper (a diamond creased along its spine), instanced and lit
        const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 1, 0, -0.7, 0, 0.22, 0, -1, 0, 0, 1, 0, 0, -1, 0, 0.7, 0, 0.22]), 3)); sg.computeVertexNormals();
        d.scraps = new THREE.InstancedMesh(sg, new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide, flatShading: true, map: paperTex, emissive: 0x1a1a1a }), 280);
        d.scraps.castShadow = true; d.scraps.count = 0; sc.add(d.scraps); d.scraps.setColorAt(0, new THREE.Color(1, 1, 1));
        d.letters = makeLetters(X, S, { glyphs: [' '], center: new THREE.Vector3(0, 0.3, 0), radius: 4.6, size: 0.0001, webBlend: 'normal', webGain: 0.5 });
        const cp = craneParts(THREE); d.cp = cp; d.cmat = PAPER.map((c) => new THREE.MeshStandardMaterial({ color: toLin(THREE, c), roughness: 0.85, side: THREE.DoubleSide, flatShading: true, map: paperTex }));
        d.cranes = [];
        for (let i = 0; i < 6; i++) addCrane(S, THREE, { x: rand(-9, 9), y: rand(-1, 4), z: rand(-4, 3), vx: rand(0.02, 0.04) * (i % 2 ? 1 : -1), vy: 0, vz: 0, s: rand(0.7, 1), amb: 1, col: i % 5 });
        try { X.renderer.compile(X.scene, X.camera); } catch (e) { /* warm-up only */ } d.X = X; d.ready = true;
      },
      update(S, X, now, dt) {
        bloomPulse(S, X, 0.18 + 0.2 * power(S), 0.7, S.data.rel ? now - S.data.rel : -1, 600);
        const d = S.data, THREE = X.THREE, pw = power(S), k = dt / 16;
        d.ra += dt * (0.00022 + pw * 0.001) * (RM(S) ? 0.4 : 1); d.rb += dt * 0.0001;
        const bl = now - d.bloom, bloomE = bl < 2600 ? Math.sin(Math.PI * smooth(0, 2600, bl)) : 0;
        d.ex += ((S.holding ? pw * 0.55 : 0) + bloomE * 1.1 - d.ex) * 0.08 * k;
        if (now - d.vtx.t > 4500) d.vtx = flatVertex();
        d.kus.rotation.set(d.rb * 0.7, d.ra, 0);
        const g = d.kus.geometry, pa = g.attributes.position.array, base = g.userData.base, nn = g.userData.n;
        for (let i = 0; i < pa.length; i += 3) { const f = Math.floor(i / 9), wob = S.holding && S.stage === 3 && !RM(S) ? 0.08 * Math.sin(now * 0.01 + f) : 0, e = (d.ex + wob) * 1.6; pa[i] = base[i] + nn[i] * e; pa[i + 1] = base[i + 1] + nn[i + 1] * e; pa[i + 2] = base[i + 2] + nn[i + 2] * e; }
        g.attributes.position.needsUpdate = true;
        // the lamp follows the pointer
        const lp = S.ptrInside ? X.fromScreen(S.ptr.x, S.ptr.y, 6) : new THREE.Vector3(4, 5, 6);
        d.lamp.position.lerp(new THREE.Vector3(lp.x * 1.4, lp.y * 1.2 + 4, 11), 0.06 * k); d.lamp.intensity = 340 * (1 + 0.5 * pw);
        const cam = X.camera, sw = RM(S) ? 0 : Math.sin(now * 0.00007);
        cam.position.set(sw * 2.2, 1.2 + (S.holding ? 1 * pw : 0), 17 - (S.holding ? 3 * pw : 0)); cam.lookAt(0, 0.3, 0);
        // scraps at the letters' positions
        const pal = S.mode.palette;
        d.letters.update(S, (n, out) => n.inf ? out.copy(lin(THREE, pal[n.gen % pal.length][0], 70, 40, 1)) : out.setRGB(0.4, 0.42, 0.5));
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new THREE.Vector3(), c = new THREE.Color();
        const act = S.active, n = Math.min(280, act.length);
        for (let i = 0; i < n; i++) {
          const nd = act[i], w = nd.data.w3 || [0, 0, 0];
          e.set(nd.p[0] * 2 + now * 0.0003, nd.p[1] * 3, nd.p[2] * 2); q.setFromEuler(e); sv.setScalar(0.22 * (nd.inf ? 1.25 : 1) * clamp(nd.alpha, 0.05, 1));
          m4.compose(new THREE.Vector3(w[0], w[1], w[2]), q, sv); d.scraps.setMatrixAt(i, m4);
          if (nd.inf) c.copy(lin(THREE, pal[nd.gen % pal.length][0], 75, 55)); else c.copy(toLin(THREE, PAPER[5])); d.scraps.setColorAt(i, c);
        }
        d.scraps.count = n; d.scraps.instanceMatrix.needsUpdate = true; if (d.scraps.instanceColor) d.scraps.instanceColor.needsUpdate = true;
        // cranes
        d.cranes = d.cranes.filter((cr) => {
          const o = cr.o;
          if (o.amb) {
            if (S.holding && S.stage >= 1) { const ang = now * 0.0005 * (o.col % 2 ? 1 : -1) + o.col * 1.3, tx = Math.cos(ang) * 6.5, tz = Math.sin(ang) * 3, ty = Math.sin(ang * 2) * 1.5 + 0.5; o.vx += (tx - o.x) * 0.0012 * k; o.vy += (ty - o.y) * 0.0012 * k; o.vz += (tz - o.z) * 0.0012 * k; o.vx *= 0.97; o.vy *= 0.97; o.vz *= 0.97; }
            else { o.vy += (Math.sin(now * 0.0008 + o.col) * 0.004 - o.vy) * 0.03 * k; o.vz += (-o.z * 0.0004) * k; if (Math.abs(o.vx) < 0.015) o.vx += (o.vx >= 0 ? 0.002 : -0.002) * k; if (o.x > 11) o.vx -= 0.002 * k; if (o.x < -11) o.vx += 0.002 * k; o.y = clamp(o.y, -2.5, 5); }
          } else { o.vy += 0.0012 * k; o.vx *= 0.995; o.vz *= 0.995; }
          o.x += o.vx * k; o.y += o.vy * k; o.z += o.vz * k; o.ph += (0.16 + Math.abs(o.vy) * 2) * k;
          const g2 = cr.g; g2.position.set(o.x, o.y, o.z); g2.rotation.set(0, Math.atan2(-o.vz, o.vx), clamp(o.vy * 6, -0.5, 0.5));
          const f = Math.sin(o.ph) * 0.9; cr.wl.rotation.x = -f; cr.wr.rotation.x = f;
          const life = o.amb ? 1 : 1 - smooth(o.life - 900, o.life, now - o.t0);
          g2.scale.setScalar(o.s * life);
          if (life <= 0.01) { X.scene.remove(g2); return false; }
          return true;
        });
      }
    },
    over(S, ctx) { // a flat-foldable vertex under the pointer: Kawasaki and Maekawa, drawn in crease-pattern notation
      const d = S.data; if (!S.ptrInside || S.holding || !d.vtx) return;
      const v = d.vtx, X = S.ptr.x, Y = S.ptr.y, L = 110, age = clamp((performance.now() - v.t) / 500, 0, 1);
      let ang = v.rot; ctx.lineWidth = 1.2;
      for (let i = 0; i < 6; i++) {
        const e = ang + (v.sec[i] * Math.PI / 180), mid = (ang + e) / 2;
        ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(235,240,255,0.6)'; ctx.fillText(v.sec[i].toFixed(0) + '°', X + Math.cos(mid) * 44, Y + Math.sin(mid) * 44);
        ctx.strokeStyle = v.mv[i] === 'M' ? 'rgba(255,130,120,0.75)' : 'rgba(130,180,255,0.75)'; ctx.setLineDash(v.mv[i] === 'M' ? [9, 3, 2, 3] : [6, 4]);
        S.line(X, Y, X + Math.cos(ang) * L * age, Y + Math.sin(ang) * L * age); ctx.setLineDash([]);
        ang = e;
      }
    },
    onTap(S) { S.data.vtx = flatVertex(); },
    onRelease(S, held, pw) {
      const d = S.data; d.rel = S.now; d.bloom = S.now; if (!d.ready) return false;
      const inf = S.active.filter((n) => n.inf && n.data.w3), step = Math.max(1, inf.length / 36); let k = 0;
      for (let i = 0; i < inf.length; i += step, k++) { const w = inf[Math.floor(i)].data.w3, a = Math.atan2(w[1], w[0]); addCrane(S, d.X.THREE, { x: w[0], y: w[1], z: w[2], vx: Math.cos(a) * rand(0.04, 0.09) * pw, vy: rand(0.01, 0.05), vz: rand(-0.02, 0.06), s: rand(0.45, 0.75), amb: 0, col: k % 5, t0: S.now, life: rand(3400, 4800) }); }
      CRANES += k; d.folded = k;
      return false;
    },
    hud(S) {
      const d = S.data, v = d.vtx, odd = v.sec[0] + v.sec[2] + v.sec[4], even = v.sec[1] + v.sec[3] + v.sec[5], M = v.mv.filter((x) => x === 'M').length, V = 6 - M;
      if (S.holding) return ['30 Sonobe units, one per edge of an icosahedron', 'exploded view: every facet slides out along its own normal', 'the cranes gather', 'let go: every glowing scrap becomes a crane'][S.stage];
      if (d.rel && S.now - d.rel < 4000) return CRANES >= 1000 ? `${CRANES} cranes folded · senbazuru complete · make a wish` : `+${d.folded} cranes · ${CRANES}/1000 folded this visit · senbazuru: a thousand grant a wish`;
      return `vertex under the pointer · Kawasaki: α₁+α₃+α₅ = ${odd.toFixed(1)}° = α₂+α₄+α₆ = ${even.toFixed(1)}° · Maekawa: M − V = ${M - V} (${M} mountain, ${V} valley)`;
    }
  });
  function addCrane(S, THREE, o) {
    const d = S.data, g = new THREE.Group(), mat = d.cmat[o.col % 5];
    const body = new THREE.Mesh(d.cp.body, mat), wl = new THREE.Mesh(d.cp.wing, mat), wr = new THREE.Mesh(d.cp.wing, mat);
    wl.position.y = 0.1; wr.position.y = 0.1; wr.scale.z = -1;
    [body, wl, wr].forEach((m) => { m.castShadow = true; g.add(m); });
    o.ph = rand(0, TAU); d.X.scene.add(g); d.cranes.push({ g, wl, wr, o });
  }

  /* ======================= GRANDMASTER: Staunton pieces on a lamp-lit board; a knight's tour, then a famous game ======================= */
  const KN = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  const knightMoves = (s) => { const x = s % 8, y = s >> 3, out = []; for (const [dx, dy] of KN) { const a = x + dx, b = y + dy; if (a >= 0 && a < 8 && b >= 0 && b < 8) out.push(b * 8 + a); } return out; };
  function knightsTour(start) {
    let best = [start];
    for (let attempt = 0; attempt < 40; attempt++) {
      const seen = new Array(64).fill(false), path = [start]; seen[start] = true; let cur = start;
      while (path.length < 64) { // Warnsdorff (1823): jump to the square with the fewest onward moves; ties broken at random
        let nxt = -1, bd = 99;
        for (const s of knightMoves(cur)) { if (seen[s]) continue; let deg = 0; for (const t of knightMoves(s)) if (!seen[t]) deg++; const sc = deg + Math.random() * 0.5; if (sc < bd) { bd = sc; nxt = s; } }
        if (nxt < 0) break;
        seen[nxt] = true; path.push(nxt); cur = nxt;
      }
      if (path.length === 64 && new Set(path).size === 64) { if (knightMoves(path[63]).indexOf(start) >= 0) return path; if (best.length < 64) best = path; }
      else if (path.length > best.length) best = path;
    }
    return best;
  }
  const sqName = (s) => 'abcdefgh'[s % 8] + ((s >> 3) + 1); // square index: file + 8 * rank, rank 0 = rank 1
  const sqPos = (THREE, s, y) => new THREE.Vector3((s % 8) - 3.5, y || 0, 3.5 - (s >> 3));
  // Staunton-style profiles (radius, height) in board squares, turned on a lathe.
  const arc = (cx, cy, r, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
  const FOOT = (R) => [[0, 0], [R, 0], [R * 1.035, 0.035], [R, 0.08], [R * 0.87, 0.1], [R * 0.9, 0.13], [R * 0.74, 0.16]];
  function pieceGeometries(THREE) {
    const L = (pts) => new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(Math.max(0, p[0]), p[1])), 48);
    const G = {};
    G.P = L([...FOOT(0.29), [0.16, 0.2], [0.12, 0.33], [0.18, 0.37], [0.18, 0.4], [0.11, 0.43], ...arc(0, 0.55, 0.14, -1.0, Math.PI / 2, 14)]);
    const rookBody = L([...FOOT(0.31), [0.2, 0.24], [0.18, 0.55], [0.22, 0.6], [0.23, 0.63], [0.21, 0.65], [0.245, 0.68], [0.245, 0.82], [0.17, 0.82], [0.17, 0.76], [0, 0.76]]);
    const merl = []; for (let k = 0; k < 6; k++) { const b = new THREE.BoxGeometry(0.1, 0.08, 0.075); b.translate(0, 0.86, 0.207); b.rotateY(k / 6 * Math.PI * 2); merl.push(b); }
    G.R = mergeGeo(THREE, [rookBody, ...merl]);
    G.B = L([...FOOT(0.3), [0.15, 0.26], [0.1, 0.5], [0.17, 0.55], [0.17, 0.58], [0.1, 0.61], [0.13, 0.66], [0.155, 0.72], [0.16, 0.78], [0.14, 0.85], [0.1, 0.91], [0.05, 0.95], [0.03, 0.965], [0.045, 0.99], [0.05, 1.01], [0.035, 1.045], [0, 1.055]]);
    const qBody = L([...FOOT(0.34), [0.17, 0.3], [0.11, 0.68], [0.19, 0.73], [0.19, 0.76], [0.12, 0.8], [0.15, 0.85], [0.12, 0.88], [0.14, 0.9], [0.2, 1.08], [0.17, 1.1], [0.1, 1.12], [0.08, 1.15], ...arc(0, 1.21, 0.065, -1.2, Math.PI / 2, 10)]);
    const balls = []; for (let k = 0; k < 9; k++) { const s = new THREE.SphereGeometry(0.036, 12, 8); const a = k / 9 * Math.PI * 2; s.translate(Math.cos(a) * 0.19, 1.105, Math.sin(a) * 0.19); balls.push(s); }
    G.Q = mergeGeo(THREE, [qBody, ...balls]);
    const kBody = L([...FOOT(0.35), [0.18, 0.32], [0.12, 0.76], [0.2, 0.81], [0.2, 0.84], [0.13, 0.88], [0.16, 0.93], [0.13, 0.96], [0.15, 0.98], [0.21, 1.13], [0.15, 1.16], [0.08, 1.2], [0, 1.2]]);
    const c1 = new THREE.BoxGeometry(0.065, 0.24, 0.065); c1.translate(0, 1.32, 0);
    const c2 = new THREE.BoxGeometry(0.18, 0.065, 0.065); c2.translate(0, 1.35, 0);
    G.K = mergeGeo(THREE, [kBody, c1, c2]);
    // the knight: a turned foot plus an extruded, bevelled horse-head silhouette
    const sh = new THREE.Shape();
    sh.moveTo(-0.2, 0); sh.lineTo(0.2, 0); sh.quadraticCurveTo(0.2, 0.1, 0.12, 0.2); sh.quadraticCurveTo(0.07, 0.27, 0.16, 0.34);
    sh.quadraticCurveTo(0.27, 0.4, 0.31, 0.47); sh.quadraticCurveTo(0.32, 0.53, 0.26, 0.56); sh.quadraticCurveTo(0.16, 0.62, 0.11, 0.68);
    sh.lineTo(0.07, 0.8); sh.lineTo(0.02, 0.7); sh.quadraticCurveTo(-0.06, 0.73, -0.13, 0.66); sh.quadraticCurveTo(-0.24, 0.52, -0.23, 0.3); sh.quadraticCurveTo(-0.22, 0.12, -0.2, 0);
    const head = new THREE.ExtrudeGeometry(sh, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.045, bevelSize: 0.035, bevelSegments: 4, curveSegments: 10 });
    head.translate(0, 0.16, -0.08);
    const eye = new THREE.SphereGeometry(0.022, 8, 6); eye.translate(0.14, 0.71, 0.115);
    const eye2 = eye.clone(); eye2.translate(0, 0, -0.23);
    G.N = mergeGeo(THREE, [L([...FOOT(0.31), [0.21, 0.2], [0, 0.2]]), head, eye, eye2]);
    return G;
  }
  addMode({
    id: 'wd_chess', name: 'GRANDMASTER', glyphs: G('♚♛♜♝♞♟', 'KQRBNP'),
    base: [40, 40, 92], palette: [[45, 95, 60], [355, 85, 62], [205, 90, 66], [140, 70, 58]],
    links: ['wd_none', 'wd_none', 'wd_none', 'wd_none'], noHueShift: true, count: 48, pageBg: ['#1c130c', '#070403'],
    shapes: ['sphere', 'cube', 'tesseract', 'octahedron', 'cuboctahedron', 'hilbert', 'menger', 'truncated_octahedron'],
    init(S) {
      let game = null; try { game = CH.game(DB97); } catch (err) { console.error('[pack-world] game', err); }
      Object.assign(S.data, { game, ply: 0, nextAt: S.now + 2500, anims: [], tour: null, tourFade: 0, phase: 'play', az: 0, el: 0 });
    },
    drawNode: hide2D,
    three: {
      init(S, X) {
        const THREE = X.THREE, d = S.data, sc = X.scene;
        X.setBloom(0.35, 0.5, 0.92); X.setExposure(0.9); X.studioEnvironment(); X.maxPixelRatio = 1.25;
        sc.background = new THREE.Color(0x090605); sc.fog = new THREE.Fog(0x090605, 16, 34);
        // board: inlaid maple and walnut squares, lacquered
        const board = X.canvasTexture(1024, 1024, (x) => {
          const sq = mk(128, 128), q = sq.getContext('2d');
          for (let s = 0; s < 64; s++) {
            const f = s % 8, r = s >> 3, light = (f + r) % 2 === 1;
            woodGrain(q, 128, 128, light ? '#d9bb8e' : '#55331d', light ? '#a8794a' : '#2a160b', 100 + s, (f + r) % 4 < 2);
            x.drawImage(sq, f * 128, (7 - r) * 128);
          }
          x.strokeStyle = 'rgba(20,10,4,0.55)'; x.lineWidth = 2; for (let k = 0; k <= 8; k++) { x.beginPath(); x.moveTo(k * 128, 0); x.lineTo(k * 128, 1024); x.moveTo(0, k * 128); x.lineTo(1024, k * 128); x.stroke(); }
        });
        const frameTex = X.canvasTexture(512, 128, (x, w, h) => woodGrain(x, w, h, '#3a2112', '#160a04', 9, true));
        const wood = new THREE.MeshStandardMaterial({ map: frameTex, roughness: 0.35, envMapIntensity: 0.4 });
        const top = new THREE.MeshPhysicalMaterial({ map: board, roughness: 0.38, clearcoat: 0.75, clearcoatRoughness: 0.18, envMapIntensity: 0.45 });
        const slab = new THREE.Mesh(new THREE.BoxGeometry(8, 0.25, 8), [wood, wood, top, wood, wood, wood]); slab.position.y = -0.125; slab.receiveShadow = true; sc.add(slab);
        if (THREE.RoundedBoxGeometry) for (const [w, x, z, ry] of [[9.1, 0, 4.28, 0], [9.1, 0, -4.28, 0], [8, 4.28, 0, Math.PI / 2], [8, -4.28, 0, Math.PI / 2]]) {
          const m = new THREE.Mesh(new THREE.RoundedBoxGeometry(w, 0.42, 0.56, 3, 0.09), wood); m.position.set(x, -0.08, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; sc.add(m);
        }
        const tableTex = X.canvasTexture(1024, 1024, (x, w, h) => woodGrain(x, w, h, '#24150c', '#0e0704', 33, true)); tableTex.wrapS = tableTex.wrapT = THREE.RepeatWrapping; tableTex.repeat.set(3, 3);
        const table = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ map: tableTex, roughness: 0.55, envMapIntensity: 0.2 }));
        table.rotation.x = -Math.PI / 2; table.position.y = -0.3; table.receiveShadow = true; sc.add(table);
        // light: a warm lamp overhead (soft shadows), a cool rim from behind, a faint fill
        const lamp = new THREE.SpotLight(0xffd6a0, 340, 0, 0.62, 0.8, 2); lamp.position.set(1.5, 9.5, 3); lamp.target.position.set(0, 0, 0);
        lamp.castShadow = true; lamp.shadow.mapSize.set(2048, 2048); lamp.shadow.camera.near = 4; lamp.shadow.camera.far = 18; lamp.shadow.bias = -0.0003; lamp.shadow.normalBias = 0.02;
        sc.add(lamp, lamp.target); d.lamp = lamp;
        const rim = new THREE.DirectionalLight(0x9fb6ff, 0.9); rim.position.set(-6, 5, -7); sc.add(rim);
        sc.add(new THREE.HemisphereLight(0x8a96a8, 0x1a1009, 0.35));
        // pieces
        const geo = pieceGeometries(THREE);
        const ivory = new THREE.MeshStandardMaterial({ color: 0xd8c6a2, roughness: 0.3, envMapIntensity: 0.6 });
        const ebony = new THREE.MeshStandardMaterial({ color: 0x110a08, roughness: 0.22, envMapIntensity: 0.7 });
        d.pieces = []; d.sq = new Array(64).fill(null);
        CH.start().forEach((p, s) => {
          if (!p) return;
          const t = p.toUpperCase(), white = p === t, m = new THREE.Mesh(geo[t], white ? ivory : ebony);
          m.castShadow = true; m.receiveShadow = true; m.position.copy(sqPos(THREE, s)); if (t === 'N') m.rotation.y = white ? 0 : Math.PI;
          m.userData = { home: s, ry: m.rotation.y, white, t }; sc.add(m); d.pieces.push(m); d.sq[s] = m;
        });
        d.grave = { w: 0, b: 0 };
        // the knight's tour: a gilded knight, glowing square markers and its trail
        const gold = new THREE.MeshStandardMaterial({ color: 0xffc670, metalness: 1, roughness: 0.22, emissive: 0x6a3a08, emissiveIntensity: 0.6 });
        d.tk = new THREE.Mesh(geo.N, gold); d.tk.castShadow = true; d.tk.visible = false; sc.add(d.tk);
        d.mark = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }), 64);
        const mm = new THREE.Matrix4(); for (let s = 0; s < 64; s++) { mm.makeTranslation((s % 8) - 3.5, 0.006, 3.5 - (s >> 3)); d.mark.setMatrixAt(s, mm); d.mark.setColorAt(s, new THREE.Color(0, 0, 0)); }
        d.mark.instanceColor.needsUpdate = true; sc.add(d.mark);
        const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(65 * 3), 3).setUsage(THREE.DynamicDrawUsage));
        d.trail = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: new THREE.Color(3, 1.9, 0.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); d.trail.frustumCulled = false; sc.add(d.trail);
        d.letters = makeLetters(X, S, { glyphs: Array.from(S.mode.glyphList.length ? S.mode.glyphList : ['♟']), font: '84px "Segoe UI Symbol","DejaVu Sans",serif', center: new THREE.Vector3(0, 2.7, -6.2), radius: 1.35, size: 0.38 });
        try { X.renderer.compile(X.scene, X.camera); } catch (e) { /* warm-up only */ } d.X = X; d.ready = true;
      },
      update(S, X, now, dt) {
        bloomPulse(S, X, 0.35 + 0.15 * power(S), 0.9, S.data.rel ? now - S.data.rel : -1, 500);
        const d = S.data, THREE = X.THREE, cam = X.camera;
        // camera: a slow orbit that leans toward the pointer; the lamp follows the pointer too
        const px = S.ptrInside ? S.ptr.x / S.W - 0.5 : 0, py = S.ptrInside ? S.ptr.y / S.H - 0.5 : 0;
        d.az += ((RM(S) ? 0 : Math.sin(now * 0.00006) * 0.25) + px * 0.7 - d.az) * 0.03; d.el += (py * 0.25 - d.el) * 0.03;
        const el = 0.78 + d.el + (S.holding ? 0.1 * power(S) : 0), rad = 15.5 - (S.holding ? 1.5 * power(S) : 0);
        cam.position.set(Math.sin(d.az) * Math.cos(el) * rad, Math.sin(el) * rad, Math.cos(d.az) * Math.cos(el) * rad + 0.6); cam.lookAt(0, 0.6, -0.2);
        const lamp = d.lamp;
        if (lamp) { lamp.position.x += (1.5 + px * 7 - lamp.position.x) * 0.05; lamp.position.z += (3 + py * 6 - lamp.position.z) * 0.05; lamp.intensity = 340 * (1 + 0.5 * power(S)); }
        // the game: one move every 1.8 s unless the knight is touring
        if (d.game && !S.holding && now > d.tourFade && now > d.nextAt) {
          if (d.phase === 'play' && d.ply < d.game.length) { playMove(S, THREE, d.game[d.ply], now); d.ply++; d.nextAt = now + (d.ply === d.game.length ? 9000 : 1800); if (d.ply === d.game.length) d.resignT = now + 1500; }
          else if (d.phase === 'play') { d.phase = 'reset'; resetBoard(S, THREE, now); d.nextAt = now + 2600; }
          else { d.phase = 'play'; d.ply = 0; d.nextAt = now + 1200; }
        }
        const bk = d.sq && d.game && d.ply === d.game.length ? d.pieces.find((m) => m.userData.t === 'K' && !m.userData.white) : null;
        if (bk && d.resignT && now > d.resignT) { const u = smooth(0, 1200, now - d.resignT); bk.rotation.z = u * 1.45; bk.position.y = u * 0.33; } // the black king is tipped over: resignation
        d.anims = d.anims.filter((a) => {
          const u = clamp((now - a.t0) / a.dur, 0, 1); if (u <= 0) return true;
          const e = u * u * (3 - 2 * u); a.m.position.lerpVectors(a.from, a.to, e); a.m.position.y += Math.sin(u * Math.PI) * a.hop;
          if (a.rz !== undefined) a.m.rotation.z = lerp(a.rz0, a.rz, e);
          return u < 1;
        });
        // the knight's tour
        const T = d.tour;
        if (T) {
          if (S.holding && T.idx < 63) { T.acc += dt; const iv = [150, 100, 60, 38][S.stage]; while (T.acc > iv && T.idx < 63) { T.acc -= iv; T.idx++; } if (T.idx === 63) T.doneT = now; }
          const iv = [150, 100, 60, 38][S.stage], fr = S.holding && T.idx < 63 ? clamp(T.acc / iv, 0, 1) : 0;
          const a = sqPos(THREE, T.path[T.idx]), b = sqPos(THREE, T.path[Math.min(63, T.idx + 1)]);
          d.tk.position.lerpVectors(a, b, fr); d.tk.position.y = Math.sin(fr * Math.PI) * 0.7;
          const fade = S.holding ? 1 : clamp((d.tourFade - now) / 1500, 0, 1);
          d.tk.visible = fade > 0.02; d.tk.scale.setScalar(Math.max(0.01, fade)); d.tk.rotation.y = 0;
          const c = new THREE.Color(), arr = d.trail.geometry.attributes.position.array;
          c.setRGB(0, 0, 0); for (let s = 0; s < 64; s++) d.mark.setColorAt(s, c);
          for (let k = 0; k <= T.idx; k++) {
            const age = (T.idx - k) / 64, glow = (T.doneT ? 0.6 + 0.4 * Math.sin(now * 0.008 - k * 0.3) : 1) * fade;
            c.setRGB((0.5 + 0.5 * (1 - age)) * 0.4 * glow, (0.32 + 0.2 * (1 - age)) * 0.4 * glow, 0.05 * glow); d.mark.setColorAt(T.path[k], c);
            const p = sqPos(THREE, T.path[k], 0.03); arr[k * 3] = p.x; arr[k * 3 + 1] = p.y; arr[k * 3 + 2] = p.z;
          }
          let n = T.idx + 1;
          if (T.doneT && T.closed) { const p = sqPos(THREE, T.path[0], 0.03); arr[n * 3] = p.x; arr[n * 3 + 1] = p.y; arr[n * 3 + 2] = p.z; n++; }
          d.trail.geometry.setDrawRange(0, n); d.trail.geometry.attributes.position.needsUpdate = true; d.trail.material.opacity = fade;
          d.mark.instanceColor.needsUpdate = true;
          if (!S.holding && now > d.tourFade) { d.tour = null; d.tk.visible = false; d.trail.geometry.setDrawRange(0, 0); for (let s = 0; s < 64; s++) d.mark.setColorAt(s, c.setRGB(0, 0, 0)); d.mark.instanceColor.needsUpdate = true; }
        }
        const pal = S.mode.palette;
        d.letters.update(S, (n, out) => n.inf ? out.copy(lin(THREE, pal[n.gen % pal.length][0], 90, 62, 1.6 + S.stage * 0.4)) : out.copy(lin(THREE, 40, 50, 80, 0.55)));
      }
    },
    onPress(S, x, y) {
      const d = S.data, X = d.X; if (!d.ready) return;
      // the square under the pointer (ray onto the board plane)
      const p = X.fromScreen(x, y, 0), cam = X.camera, dir = p.clone().sub(cam.position).normalize(), t = -cam.position.y / dir.y, hit = cam.position.clone().addScaledVector(dir, t);
      const f = clamp(Math.round(hit.x + 3.5), 0, 7), r = clamp(Math.round(3.5 - hit.z), 0, 7), path = knightsTour(r * 8 + f);
      d.tour = { path, idx: 0, acc: 0, doneT: 0, closed: path.length === 64 && knightMoves(path[63]).indexOf(path[0]) >= 0 };
      d.tk.visible = true;
    },
    onRelease(S) { const d = S.data; d.rel = S.now; d.tourFade = S.now + 1500; d.last = d.tour; d.nextAt = Math.max(d.nextAt, S.now + 1700); return false; },
    over(S, ctx) { // a quiet scoresheet, top right
      const d = S.data; if (!d.game) return;
      const x0 = S.W - 210, y0 = 70, cur = d.ply - 1, row = Math.floor(Math.max(0, cur) / 2), first = clamp(row - 6, 0, Math.max(0, 45 - 12));
      ctx.font = '11px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(232,220,196,0.62)'; ctx.fillText('White – Black', x0, y0); ctx.fillStyle = 'rgba(232,220,196,0.3)'; ctx.fillText('· 1997 · game 2 ·', x0, y0 + 15);
      for (let i = 0; i < 12; i++) {
        const mv = first + i; if (mv >= 45) break;
        const w = DB97[mv * 2], b = DB97[mv * 2 + 1] || '', y = y0 + 38 + i * 15;
        ctx.fillStyle = 'rgba(232,220,196,0.3)'; ctx.fillText(String(mv + 1).padStart(2, ' ') + '.', x0, y);
        ctx.fillStyle = cur === mv * 2 ? 'rgba(255,214,140,0.95)' : mv * 2 < d.ply ? 'rgba(232,220,196,0.55)' : 'rgba(232,220,196,0.2)'; ctx.fillText(w, x0 + 32, y);
        ctx.fillStyle = cur === mv * 2 + 1 ? 'rgba(255,214,140,0.95)' : mv * 2 + 1 < d.ply ? 'rgba(232,220,196,0.55)' : 'rgba(232,220,196,0.2)'; ctx.fillText(b, x0 + 96, y);
      }
      if (d.ply === d.game.length) { ctx.fillStyle = 'rgba(255,214,140,0.8)'; ctx.fillText('1–0', x0, y0 + 38 + 12 * 15 + 6); }
    },
    hud(S) {
      const d = S.data, T = d.tour;
      if (S.holding && T) return T.doneT ? `knight's tour complete · ${T.closed ? 'closed: the last square is a knight\'s move from the first' : 'open'} · 8×8 has 13,267,364,410,532 closed tours` : `Warnsdorff's rule: jump to the square with the fewest onward moves · move ${T.idx + 1}/64 · ${sqName(T.path[T.idx])}`;
      if (d.rel && S.now - d.rel < 3000 && d.last) return d.last.doneT ? 'the knight visited all 64 squares exactly once · the game resumes' : 'tour abandoned · hold about 5 s for all 64 squares';
      if (!d.game) return 'Shannon number ≈ 10¹²⁰ possible games';
      if (d.ply === d.game.length) return '45.Ra6 · 1–0 · later analysis found a perpetual check: the resigned position was a draw';
      const mv = d.ply ? `${Math.ceil(d.ply / 2)}.${d.ply % 2 ? '' : '..'}${DB97[d.ply - 1]}` : 'Ruy Lopez';
      return `${mv} · a machine searching ~200 million positions/s · Shannon number ≈ 10¹²⁰ games · hold a square: knight's tour`;
    }
  });
  function playMove(S, THREE, mv, now) {
    const d = S.data, m = d.sq[mv.from];
    if (!m) return;
    if (mv.cap >= 0 && d.sq[mv.cap]) { // the captured piece is lifted off and set beside the board
      const c = d.sq[mv.cap], w = c.userData.white, k = w ? d.grave.w++ : d.grave.b++;
      const to = new THREE.Vector3(w ? -5.2 - Math.floor(k / 8) * 0.7 : 5.2 + Math.floor(k / 8) * 0.7, -0.3, (w ? -3.5 : 3.5) + (w ? 1 : -1) * (k % 8) * 0.9 * 1);
      d.anims.push({ m: c, from: c.position.clone(), to, t0: now + 380, dur: 800, hop: 0.9 });
      d.sq[mv.cap] = null;
    }
    d.anims.push({ m, from: m.position.clone(), to: sqPos(THREE, mv.to), t0: now, dur: m.userData.t === 'N' ? 620 : 520, hop: m.userData.t === 'N' ? 0.75 : 0.12 });
    d.sq[mv.to] = m; d.sq[mv.from] = null;
    if (mv.rook) { const r = d.sq[mv.rook[0]]; if (r) { d.anims.push({ m: r, from: r.position.clone(), to: sqPos(THREE, mv.rook[1]), t0: now + 300, dur: 520, hop: 0.25 }); d.sq[mv.rook[1]] = r; d.sq[mv.rook[0]] = null; } }
  }
  function resetBoard(S, THREE, now) {
    const d = S.data; d.sq = new Array(64).fill(null); d.grave = { w: 0, b: 0 }; d.resignT = 0;
    d.pieces.forEach((m, i) => { d.anims.push({ m, from: m.position.clone(), to: sqPos(THREE, m.userData.home), t0: now + i * 25, dur: 1100, hop: 0.6, rz0: m.rotation.z, rz: 0 }); d.sq[m.userData.home] = m; });
  }

  /* @@END@@ */
})(window.SPHERE);
