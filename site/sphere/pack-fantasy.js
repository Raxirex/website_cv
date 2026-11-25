/* The Sphere: high fantasy & tabletop pack. Six short scenes: a volcanic ring forge, a tabletop d20, a dragon's hoard,
 * a starlit forest, a spellbook and a graveyard. All names, scripts and symbols are invented here; everything is procedural.
 * Each scene hides a real idea: blackbody colour of hot metal, the central limit theorem, the angle of repose and compound
 * interest, phyllotaxis and the golden angle, star polygons and the Taylor–Sedov blast wave, and radioactive half-life.
 * Own web styles (if any) are prefixed fa_. */
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
  const addMode = (def) => {
    Object.keys(def).forEach((k) => {
      const f = def[k];
      if (typeof f !== 'function') return;
      let warned = false;
      def[k] = function () {
        const t0 = performance.now();
        try { return f.apply(this, arguments); } catch (err) { if (!warned) { warned = true; console.error('[pack-fantasy] ' + def.id + '.' + k, err); } return k === 'drawNode' ? true : undefined; } finally { PERF.acc += performance.now() - t0; }
      };
    });
    SP.addMode(def);
  };

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
  function drawGlow(ctx, rgb, x, y, r, a) { if (a <= 0.005 || r < 1) return; const c = glow(rgb, r), h = c.width / 2; ctx.globalAlpha = Math.min(1, a); ctx.drawImage(c, x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1; void h; }
  // A canvas in CSS pixels, rebuilt when the size (or the DPR) changes. Lives in S.data, so it is dropped on mode change.
  function layer(S, key, w, h, draw) {
    const k = Math.round(w) + 'x' + Math.round(h) + '@' + S.DPR, old = S.data['_' + key];
    if (old && old._k === k) return old;
    const c = S.offscreen(w * S.DPR, h * S.DPR), x = c.getContext('2d');
    x.scale(S.DPR, S.DPR); draw(x, w, h); c._k = k; c._w = w; c._h = h; S.data['_' + key] = c;
    return c;
  }
  const blit = (ctx, c, x, y) => ctx.drawImage(c, x || 0, y || 0, c._w, c._h);
  function softSprite(rgb, a0) { const c = mk(128, 128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, `rgba(${rgb},${a0})`); g.addColorStop(0.5, `rgba(${rgb},${a0 * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return c; }
  const SOFT = {};
  const soft = (rgb, a0) => SOFT[rgb + a0] || (SOFT[rgb + a0] = softSprite(rgb, a0));
  // 4-point twinkle sprite (anime sparkle) per colour
  const SPARK = {};
  function sparkle(rgb) {
    if (SPARK[rgb]) return SPARK[rgb];
    const c = mk(64, 64), x = c.getContext('2d');
    x.translate(32, 32); x.fillStyle = `rgba(${rgb},1)`; x.beginPath();
    for (let k = 0; k < 8; k++) { const r = k % 2 ? 4 : 31, a = k * Math.PI / 4; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    x.closePath(); x.fill();
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 14); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(-14, -14, 28, 28);
    return (SPARK[rgb] = c);
  }

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
  // Metal at temperature T: its own glow on top of dull iron lit by the forge.
  function metalRGB(Tc, base) {
    const h = hotRGB(Tc), b = base || [74, 64, 60], m = Math.max(h[0], h[1], h[2]) / 255, k = 1 - Math.min(1, m * 1.4);
    return [Math.min(255, h[0] + b[0] * k), Math.min(255, h[1] + b[1] * k), Math.min(255, h[2] + b[2] * k)].map(Math.round);
  }
  const rgbS = (c) => c[0] + ',' + c[1] + ',' + c[2];
  const HOTS = {};
  const hotS = (T) => { const b = Math.round(clamp(T, 400, 1600) / 25) * 25; return HOTS[b] || (HOTS[b] = rgbS(hotRGB(b))); };
  const coreOf = (c) => rgbS(c.map((v) => Math.round(lerp(v, 255, 0.55))));

  /* ---------- a small particle system (embers, steam, coins, wisps, sparkles) ---------- */
  function fxAdd(D, o) { const L = D.fx || (D.fx = []); if (L.length < 700) L.push(o); return o; }
  function fxStep(S, D, dt, hook) {
    const L = D.fx; if (!L || !L.length) return;
    const k = dt / 16.7, now = S.now, v = pvel(S), sp = Math.hypot(v.x, v.y);
    let j = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      if (now - p.t > p.life) continue;
      p.vy += (p.g || 0) * k; const dr = Math.pow(p.drag || 0.98, k); p.vx *= dr; p.vy *= dr;
      if (S.ptrInside && !p.noPtr) { // a swiping pointer stirs the air
        const dx = p.x - S.ptr.x, dy = p.y - S.ptr.y, d2 = dx * dx + dy * dy;
        if (d2 < 14400) { const f = (1 - Math.sqrt(d2) / 120) * (0.04 + sp * 0.02) * k; p.vx += v.x * f * 0.6 + dx * f * 0.02; p.vy += v.y * f * 0.6 + dy * f * 0.02; }
      }
      p.x += p.vx * k; p.y += p.vy * k;
      if (hook) hook(p);
      L[j++] = p;
    }
    L.length = j;
  }
  function fxDraw(S, ctx, D, kinds) {
    const L = D.fx; if (!L || !L.length) return;
    const now = S.now;
    for (const p of L) {
      if (kinds && kinds.indexOf(p.kind) < 0) continue;
      const age = (now - p.t) / p.life, a = 1 - age;
      if (p.kind === 'steam') { const s = p.s * (0.5 + age * 1.6); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = p.a * Math.sin(Math.PI * Math.min(1, age * 1.4 + 0.05)); ctx.drawImage(soft(p.rgb || '230,230,235', 1), p.x - s, p.y - s, s * 2, s * 2); continue; }
      ctx.globalCompositeOperation = 'lighter';
      if (p.kind === 'sparkle') { const s = p.s * (age < 0.2 ? age / 0.2 : 1) * (0.7 + 0.3 * Math.sin(now * 0.03 + p.s)); ctx.globalAlpha = a; ctx.drawImage(sparkle(p.rgb), p.x - s, p.y - s, s * 2, s * 2); continue; }
      if (p.kind === 'streak') { ctx.globalAlpha = 1; ctx.strokeStyle = `rgba(${p.rgb},${a})`; ctx.lineWidth = p.s; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3); ctx.stroke(); continue; }
      drawGlow(ctx, p.T !== undefined ? hotS(p.T) : p.rgb, p.x, p.y, p.s, p.a * a); // 'glow', 'ember' (coloured by its temperature) and anything else
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  function banner(S, ctx, D, now) { // a big centred title card that scales in and fades
    const b = D.banner; if (!b) return;
    const t = (now - b.t) / b.life; if (t > 1) { D.banner = null; return; }
    const sc = S.reduceMotion ? 1 : 1 + 0.25 * Math.exp(-t * 14), a = Math.min(1, (1 - t) * 3) * Math.min(1, t * 12);
    ctx.save(); ctx.translate(b.x || S.cx, b.y || S.cy - S.R * 1.25); ctx.scale(sc, sc); ctx.rotate(b.rot || 0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `bold ${b.size || 44}px Georgia, serif`;
    ctx.globalAlpha = a; ctx.lineWidth = 6; ctx.strokeStyle = b.stroke || 'rgba(0,0,0,0.75)'; ctx.strokeText(b.text, 0, 0);
    ctx.fillStyle = b.fill; ctx.fillText(b.text, 0, 0);
    if (b.sub) { ctx.font = '13px monospace'; ctx.fillStyle = b.subFill || 'rgba(255,255,255,0.85)'; ctx.fillText(b.sub, 0, (b.size || 44) * 0.75); }
    ctx.restore(); ctx.globalAlpha = 1;
  }

  /* ======================= 1. RING FORGE ======================= */
  const FORGE_SCRIPT = makeScript(0xF04CE, 16, 'forge');
  const FIRE_SCRIPT = makeScript(0x1A7E5, 14, 'leaf'); // the flowing fire-letters that surface on the ring
  const FORGE_KEYS = [[0, 330], [1200, 700], [2500, 1064], [4500, 1290], [7000, 1380]]; // held ms → target °C
  function forgeTarget(held, idle) {
    if (held <= 0) return idle;
    for (let i = 1; i < FORGE_KEYS.length; i++) { const a = FORGE_KEYS[i - 1], b = FORGE_KEYS[i]; if (held < b[0]) return Math.max(idle, lerp(a[1], b[1], (held - a[0]) / (b[0] - a[0]))); }
    return FORGE_KEYS[FORGE_KEYS.length - 1][1];
  }
  function forgeCave(S) {
    return layer(S, 'cave', S.W, S.H, (x, w, h) => {
      let g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#060208'); g.addColorStop(0.5, '#170605'); g.addColorStop(1, '#3a0e04');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      g = x.createRadialGradient(w / 2, h * 1.15, 0, w / 2, h * 1.15, h * 1.0);
      g.addColorStop(0, 'rgba(255,120,30,0.5)'); g.addColorStop(0.45, 'rgba(190,45,10,0.16)'); g.addColorStop(1, 'rgba(120,20,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      const r = prng(11);
      // stalactites
      x.fillStyle = '#040103'; x.beginPath(); x.moveTo(0, 0);
      for (let i = 0; i <= 60; i++) { const px = i / 60 * w, sp = r() < 0.22; x.lineTo(px - 6, h * (0.03 + 0.05 * r())); if (sp) x.lineTo(px, h * (0.08 + 0.12 * r())); }
      x.lineTo(w, 0); x.closePath(); x.fill();
      // side walls with an ember rim light
      for (const side of [0, 1]) {
        const pts = [];
        for (let j = 0; j <= 30; j++) { const py = j / 30 * h, px = w * (0.025 + 0.06 * r() + 0.05 * Math.sin(j * 0.6 + side * 2) + 0.06 * Math.pow(j / 30, 3)); pts.push([side ? w - px : px, py]); }
        x.beginPath(); x.moveTo(side ? w : 0, 0); pts.forEach((p) => x.lineTo(p[0], p[1])); x.lineTo(side ? w : 0, h); x.closePath(); x.fillStyle = '#050203'; x.fill();
        x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])));
        g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,90,20,0)'); g.addColorStop(1, 'rgba(255,110,30,0.55)');
        x.strokeStyle = g; x.lineWidth = 1.5; x.stroke();
      }
      // lava river with a crust
      const ly = h * 0.9;
      g = x.createLinearGradient(0, ly - 6, 0, h);
      g.addColorStop(0, 'rgba(255,215,110,1)'); g.addColorStop(0.25, 'rgba(255,110,20,1)'); g.addColorStop(1, 'rgba(110,18,0,1)');
      x.fillStyle = g; x.beginPath(); x.moveTo(0, h);
      for (let i = 0; i <= 80; i++) x.lineTo(i / 80 * w, ly + Math.sin(i * 0.8) * 4 + r() * 4);
      x.lineTo(w, h); x.closePath(); x.fill();
      x.fillStyle = 'rgba(28,7,3,0.9)';
      for (let k = 0; k < 70; k++) {
        const cx = r() * w, cy = ly + 8 + Math.pow(r(), 0.7) * (h - ly - 6), s = 4 + r() * 16;
        x.beginPath(); for (let j = 0; j < 6; j++) { const a = j / 6 * TAU + r() * 0.5, rr = s * (0.6 + r() * 0.5); x.lineTo(cx + Math.cos(a) * rr * 1.6, cy + Math.sin(a) * rr * 0.45); } x.closePath(); x.fill();
      }
      // anvil on a rock, lit from the lava
      const ax = w * 0.83, ay = h * 0.86, s = Math.min(w, h) * 0.12;
      x.fillStyle = '#0b0506'; x.beginPath();
      x.moveTo(ax - s * 1.3, ay - s * 0.62); x.quadraticCurveTo(ax - s * 0.9, ay - s * 0.6, ax - s * 0.6, ay - s * 0.5); x.lineTo(ax - s * 0.6, ay - s * 0.75);
      x.lineTo(ax + s * 0.9, ay - s * 0.75); x.lineTo(ax + s * 0.9, ay - s * 0.48); x.lineTo(ax + s * 0.35, ay - s * 0.36); x.lineTo(ax + s * 0.4, ay - s * 0.1);
      x.lineTo(ax + s * 0.7, ay + s * 0.05); x.lineTo(ax - s * 0.55, ay + s * 0.05); x.lineTo(ax - s * 0.25, ay - s * 0.1); x.lineTo(ax - s * 0.2, ay - s * 0.36); x.lineTo(ax - s * 0.6, ay - s * 0.44);
      x.quadraticCurveTo(ax - s * 1.0, ay - s * 0.5, ax - s * 1.3, ay - s * 0.62); x.closePath(); x.fill();
      x.strokeStyle = 'rgba(255,150,60,0.5)'; x.lineWidth = 1; x.beginPath(); x.moveTo(ax - s * 0.6, ay - s * 0.75); x.lineTo(ax + s * 0.9, ay - s * 0.75); x.stroke();
      x.fillStyle = '#070304'; x.beginPath(); x.ellipse(ax, ay + s * 0.25, s * 1.4, s * 0.3, 0, 0, TAU); x.fill();
      // hammer leaning on the anvil
      x.strokeStyle = '#0b0506'; x.lineWidth = s * 0.09; x.beginPath(); x.moveTo(ax + s * 1.05, ay + s * 0.1); x.lineTo(ax + s * 1.5, ay - s * 0.9); x.stroke();
      x.fillStyle = '#0b0506'; x.save(); x.translate(ax + s * 1.5, ay - s * 0.9); x.rotate(0.42); x.fillRect(-s * 0.28, -s * 0.12, s * 0.56, s * 0.24); x.restore();
    });
  }
  const GOLD = [205, 160, 64];
  function ringGeo(S, now) {
    const D = S.data, rot = -0.1 + 0.04 * Math.sin(now * 0.0004) + (S.ptrInside ? (S.ptr.x - S.cx) / S.W * 0.18 : 0);
    D.rot = lerp(D.rot === undefined ? rot : D.rot, rot, 0.06);
    return { cx: S.cx, cy: S.cy + S.R * 0.05, rx: S.R * 1.36, ry: S.R * 0.36, c: Math.cos(D.rot), s: Math.sin(D.rot), w: Math.max(6, S.R * 0.085) };
  }
  const ringPt = (g, th) => { const ex = g.rx * Math.cos(th), ey = g.ry * Math.sin(th); return [g.cx + ex * g.c - ey * g.s, g.cy + ex * g.s + ey * g.c]; };
  function ringHalf(ctx, g, front, col, T, now) {
    const a0 = front ? 0 : Math.PI, a1 = a0 + Math.PI;
    const path = (dy) => { ctx.beginPath(); ctx.ellipse(g.cx, g.cy + dy, g.rx, g.ry, Math.atan2(g.s, g.c), a0, a1); };
    const hc = hotRGB(T), hm = Math.max(hc[0], hc[1], hc[2]) / 255;
    ctx.lineCap = 'butt';
    if (hm > 0.03) { ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(${rgbS(hc)},${0.22 * hm})`; ctx.lineWidth = g.w * 3.2; path(0); ctx.stroke(); }
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = `rgb(${rgbS(col.map((v) => Math.round(v * 0.55)))})`; ctx.lineWidth = g.w; path(g.w * 0.18); ctx.stroke(); // lower bevel
    ctx.strokeStyle = `rgb(${rgbS(col)})`; ctx.lineWidth = g.w * 0.7; path(0); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,${Math.round(lerp(200, 255, hm))},${Math.round(lerp(150, 235, hm))},${0.25 + 0.5 * hm})`; ctx.lineWidth = Math.max(1, g.w * 0.14); path(-g.w * 0.26); ctx.stroke(); // highlight
    ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'round';
    void now;
  }
  function crucible(S, now) {
    const D = S.data, x = S.cx + S.R * 1.05, y = Math.max(S.R * 0.3 + 40, S.cy - S.R * 1.2), tilt = D.pour * 1.05 + 0.05 * Math.sin(now * 0.002);
    return { x, y, tilt, lip: [x + Math.cos(Math.PI + tilt + 0.55) * S.R * 0.2, y + Math.sin(Math.PI + tilt + 0.55) * S.R * 0.2] };
  }
  addMode({
    id: 'fa_forge', name: 'RING FORGE', glyphs: SCRIPT_GLYPHS,
    base: [25, 20, 55], palette: [[20, 100, 55], [35, 100, 58], [48, 100, 64], [55, 100, 80]],
    links: ['chain', 'fire', 'fire', 'beam'], opaque: true, count: 90, noHueShift: true, glyphScale: 1.05,
    pageBg: ['#12060a', '#2a0b04'],
    shapes: ['torus', 'torus_knot', 'sphere', 'crown', 'trefoil', 'cinquefoil', 'helix', 'clifford_torus'],
    init(S) {
      Object.assign(S.data, { T: 330, bellows: 0, pour: 0, reveal: 0, order: Array.from({ length: 30 }, (_, i) => i).sort(() => Math.random() - 0.5), quench: null, fx: [], emberAcc: 0, stamp: 0 });
    },
    update(S, now, dt) {
      const D = S.data, k = dt / 1000;
      D.bellows = Math.max(0, D.bellows * Math.pow(0.6, k) + Math.min(30, pspeed(S)) * k * 14); // swiping works the bellows
      const idle = 330 + Math.min(330, D.bellows * 3);
      if (D.quench) { // Newton's law of cooling, slowed by a vapour film above the Leidenfrost point
        const q = D.quench, kq = D.T > 260 ? 0.55 : 2.4;
        D.T = 22 + (D.T - 22) * Math.exp(-kq * k);
        if (D.T < idle + 5 || S.holding) D.quench = null;
        if (D.T > 100 && Math.random() < clamp((D.T - 100) / 500, 0.05, 1) * (S.reduceMotion ? 0.3 : 1)) {
          const g = ringGeo(S, now), th = rand(0, TAU), p = ringPt(g, th);
          fxAdd(D, { kind: 'steam', x: p[0], y: p[1], vx: rand(-0.4, 0.4), vy: rand(-1.6, -0.6), g: -0.01, drag: 0.985, t: now, life: rand(1400, 2600), s: rand(18, 40) * (S.R / 200), a: 0.22 });
        }
        void q;
      } else D.T += (forgeTarget(S.held, idle) - D.T) * (1 - Math.exp(-k * (S.holding ? 3.2 : 1.2)));
      D.pour = clamp(D.pour + (S.holding && D.T > 1064 ? 1 : -1.6) * k * 1.4, 0, 1);
      const rv = D.T > 1180 ? 1 : D.T < 950 ? -1 : 0; // the script surfaces only in fire
      D.reveal = clamp(D.reveal + rv * k * (rv > 0 ? 0.55 : 0.8), 0, 1);
      // embers boil off the lava (more when it is hotter) and cool as they rise
      D.emberAcc += k * (5 + D.T / 60 + D.bellows * 0.3);
      while (D.emberAcc > 1) { D.emberAcc--; fxAdd(D, { kind: 'ember', x: rand(0, S.W), y: S.H * rand(0.88, 0.98), vx: rand(-0.3, 0.3), vy: rand(-2.2, -0.8), g: -0.004, drag: 0.996, t: now, life: rand(2500, 5200), s: rand(5, 11), T: rand(900, 1250), a: 0.9 }); }
      if (S.holding && S.stage >= 1) for (let j = 0; j < S.stage; j++) { const n = pick(S.active); if (n && n.inf && Math.random() < 0.5) fxAdd(D, { kind: 'ember', x: n.sx, y: n.sy, vx: rand(-1.5, 1.5), vy: rand(-2.5, 0.3), g: 0.03, drag: 0.98, t: now, life: rand(500, 1100), s: rand(4, 8), T: D.T, a: 1 }); }
      if (D.pour > 0.3) { // molten droplets splash where the stream lands
        const g = ringGeo(S, now), p = ringPt(g, -Math.PI / 2 + 0.55);
        if (Math.random() < 0.6) fxAdd(D, { kind: 'ember', x: p[0], y: p[1], vx: rand(-2.6, 2.6), vy: rand(-3.2, -0.8), g: 0.14, drag: 0.99, t: now, life: rand(400, 900), s: rand(4, 8), T: 1150, a: 1 });
      }
      fxStep(S, D, dt, (p) => { if (p.T) p.T -= dt * 0.12; });
    },
    background(S, ctx, now) {
      const D = S.data;
      blit(ctx, forgeCave(S));
      ctx.globalCompositeOperation = 'lighter'; // the lava breathes, and the whole cave warms with the ring
      const fl = 0.75 + 0.25 * Math.sin(now * 0.0021) * Math.sin(now * 0.0013 + 1);
      for (let k = 0; k < 5; k++) drawGlow(ctx, '255,110,25', S.W * (0.1 + k * 0.2), S.H * 0.95, S.H * 0.28, 0.16 * fl);
      const hc = hotRGB(D.T), hm = Math.max(hc[0], hc[1], hc[2]) / 255;
      if (hm > 0.02) drawGlow(ctx, rgbS(hc), S.cx, S.cy, S.R * 2.6, 0.35 * hm);
      ctx.globalCompositeOperation = 'source-over';
    },
    ambient(S, ctx, now) {
      const D = S.data, g = ringGeo(S, now), col = metalRGB(D.T, GOLD);
      fxDraw(S, ctx, D, ['ember']);
      // the crucible hangs from chains and tips when the gold is liquid
      const c = crucible(S, now), s = S.R * 0.2;
      ctx.strokeStyle = 'rgba(30,18,16,0.95)'; ctx.lineWidth = 2; ctx.setLineDash([5, 3]);
      ctx.beginPath(); ctx.moveTo(c.x - s * 0.7, 0); ctx.lineTo(c.x - s * 0.7, c.y - s * 0.3); ctx.moveTo(c.x + s * 0.7, 0); ctx.lineTo(c.x + s * 0.7, c.y - s * 0.3); ctx.stroke(); ctx.setLineDash([]);
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(-c.tilt);
      ctx.fillStyle = '#1a0d0a'; ctx.beginPath(); ctx.moveTo(-s, -s * 0.5); ctx.lineTo(s, -s * 0.5); ctx.lineTo(s * 0.7, s * 0.7); ctx.quadraticCurveTo(0, s * 0.95, -s * 0.7, s * 0.7); ctx.closePath(); ctx.fill();
      const gold = hotRGB(1150);
      ctx.fillStyle = `rgba(${rgbS(gold)},${0.5 + 0.5 * Math.min(1, (D.T - 700) / 400)})`; ctx.beginPath(); ctx.ellipse(0, -s * 0.5, s * 0.95, s * 0.18, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,140,60,0.5)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.restore();
      if (D.T > 800) { ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, rgbS(gold), c.x, c.y - s * 0.4, s * 2, 0.4 * Math.min(1, (D.T - 800) / 400)); ctx.globalCompositeOperation = 'source-over'; }
      if (D.pour > 0.02) { // the stream of molten gold falls onto the back of the ring
        const end = ringPt(g, -Math.PI / 2 + 0.55), lx = c.lip[0], ly = c.lip[1], w = (3 + 4 * D.pour) * (S.R / 220);
        ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 2; k++) {
          ctx.strokeStyle = k ? 'rgba(255,250,215,0.95)' : `rgba(${rgbS(gold)},0.6)`; ctx.lineWidth = k ? w * 0.4 : w * 2.4; ctx.beginPath(); ctx.moveTo(lx, ly);
          for (let i = 1; i <= 12; i++) { const t = i / 12, wob = Math.sin(now * 0.02 + t * 9) * 2.5 * t * D.pour; ctx.lineTo(lerp(lx, end[0], t * t * 0.6 + t * 0.4) + wob, lerp(ly, end[1], t)); }
          ctx.stroke();
        }
        for (let i = 0; i < 6; i++) { const t = ((now * 0.0016 + i / 6) % 1); drawGlow(ctx, rgbS(gold), lerp(lx, end[0], t * t * 0.6 + t * 0.4), lerp(ly, end[1], t), w * 4, 0.35 * D.pour); }
        drawGlow(ctx, '255,220,140', end[0], end[1], S.R * 0.3, 0.7 * D.pour);
        ctx.globalCompositeOperation = 'source-over';
      }
      ringHalf(ctx, g, false, col, D.T, now);
    },
    drawNode(S, ctx, n, gl, size, a) {
      const D = S.data, T = n.inf ? D.T : Math.max(300, D.T - 420), bin = Math.round(clamp(T, 300, 1500) / 75) * 75;
      const col = metalRGB(bin, [160, 122, 100]), m = Math.max(...hotRGB(bin)) / 255;
      const spr = scriptSprite('forge', FORGE_SCRIPT, glyphIndex(gl), rgbS(col), coreOf(col), m * 1.2);
      drawSprite(ctx, spr, n.sx, n.sy, size * 1.7, a);
      return true;
    },
    over(S, ctx, now) {
      const D = S.data, g = ringGeo(S, now), col = metalRGB(D.T, GOLD);
      ringHalf(ctx, g, true, col, D.T, now);
      if (D.reveal > 0.001) { // the invented inscription, letter by letter, only while the metal is hot enough
        const N = 30, spin = now * 0.00012, sz = g.w * 2.4, fire = hotRGB(1000);
        for (let i = 0; i < N; i++) {
          const th = (i / N) * TAU + spin, sn = Math.sin(((th % TAU) + TAU) % TAU);
          if (sn < 0.12) continue;
          const vis = clamp(D.reveal * N * 1.2 - D.order[i], 0, 1) * sn;
          if (vis < 0.02) continue;
          const p = ringPt(g, th), tx = -g.rx * Math.sin(th), ty = g.ry * Math.cos(th), ang = Math.atan2(tx * g.s + ty * g.c, tx * g.c - ty * g.s);
          ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(ang); ctx.scale(1, 0.72);
          ctx.globalAlpha = clamp(vis * (0.75 + 0.25 * Math.sin(now * 0.008 + i)), 0, 1);
          ctx.drawImage(scriptSprite('fire', FIRE_SCRIPT, i * 7, rgbS(fire), '255,150,40', 0.8), -sz / 2, -sz / 2, sz, sz);
          ctx.restore();
        }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
      fxDraw(S, ctx, D, ['steam', 'spark', 'streak']);
      if (S.holding && S.stage >= 3 && !S.reduceMotion && Math.random() < 0.3) fxAdd(D, { kind: 'streak', x: S.ptr.x, y: S.ptr.y, vx: rand(-9, 9), vy: rand(-9, 3), g: 0.25, drag: 0.98, t: now, life: rand(250, 500), s: 1.4, rgb: '255,220,150' });
      banner(S, ctx, D, now);
    },
    onInfect(S, n) { if (Math.random() < 0.25) fxAdd(S.data, { kind: 'streak', x: n.sx, y: n.sy, vx: rand(-4, 4), vy: rand(-5, 0), g: 0.2, drag: 0.97, t: S.now, life: 300, s: 1.2, rgb: '255,190,110' }); },
    onRelease(S, held) {
      const D = S.data, g = ringGeo(S, S.now);
      if (held < S.STAGES[1]) { for (let k = 0; k < 14; k++) fxAdd(D, { kind: 'streak', x: S.ptr.x, y: S.ptr.y, vx: rand(-6, 6), vy: rand(-7, 1), g: 0.22, drag: 0.98, t: S.now, life: rand(300, 600), s: 1.3, rgb: '255,200,120' }); return false; }
      D.quench = { t: S.now, T0: D.T }; D.stamp++;
      const n = S.reduceMotion ? 12 : 40;
      for (let k = 0; k < n; k++) { const th = rand(0, TAU), p = ringPt(g, th); fxAdd(D, { kind: 'steam', x: p[0], y: p[1], vx: rand(-2.5, 2.5), vy: rand(-3.5, -0.5), g: -0.01, drag: 0.97, t: S.now, life: rand(1600, 3000), s: rand(30, 70) * (S.R / 200), a: 0.3 }); }
      for (let k = 0; k < 30; k++) { const a = rand(0, TAU), v = rand(3, 10); fxAdd(D, { kind: 'streak', x: g.cx + Math.cos(a) * g.rx * 0.9, y: g.cy + Math.sin(a) * g.ry, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, g: 0.2, drag: 0.98, t: S.now, life: rand(400, 900), s: 1.5, rgb: '255,210,140' }); }
      S.ring(g.cx, g.cy, S.R * 2.2, [30, 30, 90], 1100); S.shake(5);
      if (D.T > 1180) D.banner = { t: S.now, life: 2600, text: 'TEMPERED', fill: 'rgba(255,220,150,1)', sub: `quenched from ${fmt(D.T)} °C`, size: 40 };
      return false;
    },
    hud(S) {
      const D = S.data, T = D.T, K = T + 273.15;
      if (D.quench) return `QUENCH · ${fmt(T)} °C · ${T > 260 ? 'film boiling: a steam jacket insulates it (Leidenfrost)' : T > 100 ? 'nucleate boiling: now it really cools' : 'done'} · T(t) = Tₐ + ΔT·e^(−kt) · hsssss`;
      if (S.holding) {
        const tag = T >= 1064 ? (D.reveal > 0.5 ? ' · the letters only show while it burns' : ' · gold liquidus 1,064 °C: pour!') : '';
        return `${fmt(T)} °C (${fmt(K)} K) · ${heatName(T)}${tag}`;
      }
      return `forge idle · ring at ${fmt(T)} °C: ${heatName(T)} (hot iron starts to glow at the Draper point, ~525 °C) · swipe to work the bellows, hold to heat`;
    }
  });

  function hsl2rgb(h, s, l) {
    s /= 100; l /= 100; h = ((h % 360) + 360) % 360;
    const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
  }
  const palRGB = (S, gen) => { const p = S.mode.palette[gen % S.mode.palette.length]; return hsl2rgb(p[0], p[1], p[2]); };

  /* ======================= 2. CRITICAL ROLL ======================= */
  const PHI = (1 + Math.sqrt(5)) / 2;
  const M3 = {
    rot(ax, ay, az, a) { const c = Math.cos(a), s = Math.sin(a), t = 1 - c; return [t * ax * ax + c, t * ax * ay - s * az, t * ax * az + s * ay, t * ax * ay + s * az, t * ay * ay + c, t * ay * az - s * ax, t * ax * az - s * ay, t * ay * az + s * ax, t * az * az + c]; },
    mul(A, B) { const R = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) R[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]; return R; },
    ap(M, v) { return [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]]; }
  };
  // A real d20: the 20 faces of an icosahedron, numbered so that opposite faces always sum to 21.
  const D20 = (() => {
    const v = [];
    for (const a of [-1, 1]) for (const b of [-1, 1]) v.push([0, a, b * PHI], [a, b * PHI, 0], [b * PHI, 0, a]);
    const nn = Math.hypot(1, PHI); v.forEach((p) => { p[0] /= nn; p[1] /= nn; p[2] /= nn; });
    const E = 2 / nn, near = (i, j) => Math.abs(Math.hypot(v[i][0] - v[j][0], v[i][1] - v[j][1], v[i][2] - v[j][2]) - E) < 1e-6;
    const faces = [];
    for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) for (let k = j + 1; k < 12; k++) if (near(i, j) && near(j, k) && near(i, k)) {
      const c = [0, 1, 2].map((q) => (v[i][q] + v[j][q] + v[k][q]) / 3), l = Math.hypot(c[0], c[1], c[2]);
      faces.push({ i: [i, j, k], n: c.map((q) => q / l), num: 0 });
    }
    const r = prng(20), pairs = [];
    faces.forEach((f, a) => { if (f.opp !== undefined) return; const b = faces.findIndex((g) => Math.abs(g.n[0] + f.n[0]) + Math.abs(g.n[1] + f.n[1]) + Math.abs(g.n[2] + f.n[2]) < 1e-6); f.opp = b; faces[b].opp = a; pairs.push([a, b]); });
    const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    for (let i = nums.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = nums[i]; nums[i] = nums[j]; nums[j] = t; }
    pairs.forEach((p, i) => { faces[p[0]].num = nums[i]; faces[p[1]].num = 21 - nums[i]; });
    return { v, faces };
  })();
  const LIGHT = (() => { const l = [-0.45, -0.6, 0.66], n = Math.hypot(...l); return l.map((x) => x / n); })();
  function throwDie(S, D, toX, toY, delay, fromSide) {
    const fx = fromSide === undefined ? toX + rand(-0.25, 0.25) * S.W : fromSide, fy = S.H + 70;
    const dx = toX - fx, dy = toY - fy, L = Math.hypot(dx, dy) || 1, sp = L * 0.045;
    const a = [rand(-1, 1), rand(-1, 1), rand(-1, 1)], al = Math.hypot(...a) || 1;
    const d = { x: fx, y: fy, vx: dx / L * sp, vy: dy / L * sp, h: 40, vh: 7, M: M3.rot(a[0] / al, a[1] / al, a[2] / al, rand(0, TAU)), t0: S.now + (delay || 0), res: 1 + Math.floor(Math.random() * 20), done: false, size: clamp(S.R * 0.26, 30, 64), wob: [rand(-1, 1), rand(-1, 1), rand(-1, 1)] };
    D.dice.push(d); return d;
  }
  function stepDie(S, D, d, dt) {
    if (S.now < d.t0 || d.done) return;
    const k = dt / 16.7, sp = Math.hypot(d.vx, d.vy), r = d.size * 0.8;
    // rolling: angular velocity ω = (−v_y, v_x, 0)/r, plus a little wobble while airborne
    let wx = -d.vy / r, wy = d.vx / r, wz = 0;
    if (d.h > 0) { wx += d.wob[0] * 0.08; wy += d.wob[1] * 0.08; wz += d.wob[2] * 0.12; }
    const w = Math.hypot(wx, wy, wz) * k;
    if (w > 1e-5) d.M = M3.mul(M3.rot(wx / (w / k), wy / (w / k), wz / (w / k), w), d.M);
    d.x += d.vx * k; d.y += d.vy * k;
    d.vh -= 0.9 * k; d.h += d.vh * k;
    if (d.h < 0) { d.h = 0; if (d.vh < -2.5) { d.vh = -d.vh * 0.42; for (let q = 0; q < 4; q++) fxAdd(D, { kind: 'steam', x: d.x + rand(-10, 10), y: d.y + d.size * 0.5, vx: rand(-1, 1), vy: rand(-0.6, 0), drag: 0.95, t: S.now, life: 500, s: 12, a: 0.25, rgb: '200,190,170' }); } else d.vh = 0; }
    const fr = Math.pow(d.h > 0 ? 0.995 : 0.955, k); d.vx *= fr; d.vy *= fr;
    const m = d.size; // bounce off the table edges
    if (d.x < m && d.vx < 0) d.vx = -d.vx * 0.6; if (d.x > S.W - m && d.vx > 0) d.vx = -d.vx * 0.6;
    if (d.y < m && d.vy < 0) d.vy = -d.vy * 0.6; if (d.y > S.H - m && d.vy > 0 && S.now - d.t0 > 600) d.vy = -d.vy * 0.6;
    if (sp < 1.4 && d.h === 0) { // settle: rotate so the chosen face looks straight up at us
      const f = D20.faces.find((q) => q.num === d.res), mm = M3.ap(d.M, f.n), ang = Math.acos(clamp(mm[2], -1, 1));
      if (ang > 0.002) { let ax = mm[1], ay = -mm[0]; const al = Math.hypot(ax, ay) || 1; ax /= al; ay /= al; d.M = M3.mul(M3.rot(ax, ay, 0, ang * Math.min(1, 0.012 * dt)), d.M); }
      if (ang < 0.015 && sp < 0.35) { d.done = true; d.vx = d.vy = 0; dieResult(S, D, d); }
    }
  }
  function drawDie(S, ctx, d, now) {
    if (now < d.t0) return;
    const s = d.size * (1 + d.h * 0.004), x = d.x, y = d.y - d.h * 0.6;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(d.x + 6, d.y + s * 0.55, s * 0.95, s * 0.42, 0, 0, TAU); ctx.fill();
    const P = D20.v.map((p) => { const q = M3.ap(d.M, p); return [x + q[0] * s, y + q[1] * s, q[2]]; });
    const res = d.done ? d.res : 0, crit = d.done && d.res === 20, fum = d.done && d.res === 1;
    for (const f of D20.faces) {
      const nm = M3.ap(d.M, f.n);
      if (nm[2] <= 0.02) continue;
      const sh = 0.3 + 0.7 * Math.max(0, nm[0] * LIGHT[0] + nm[1] * LIGHT[1] + nm[2] * LIGHT[2]), top = f.num === res;
      const a = P[f.i[0]], b = P[f.i[1]], c = P[f.i[2]];
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.closePath();
      ctx.fillStyle = `hsl(${crit ? 44 : fum ? 220 : 348},${fum ? 10 : 78}%,${(12 + 34 * sh + (top ? 8 : 0)).toFixed(1)}%)`; ctx.fill();
      ctx.strokeStyle = crit ? 'rgba(255,245,200,0.95)' : 'rgba(240,200,110,0.85)'; ctx.lineWidth = 1.2; ctx.stroke();
      if (nm[2] > 0.3) {
        const cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3, up = Math.atan2(a[1] - cy, a[0] - cx) + Math.PI / 2;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(up); ctx.scale(1, 0.55 + 0.45 * nm[2]);
        ctx.font = `bold ${Math.round(s * 0.36)}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.globalAlpha = clamp((nm[2] - 0.3) * 2.5, 0, 1); ctx.fillStyle = top ? '#fff7d6' : 'rgba(255,225,150,1)';
        ctx.fillText(f.num === 6 || f.num === 9 ? f.num + '.' : String(f.num), 0, s * 0.04); ctx.restore(); ctx.globalAlpha = 1;
      }
    }
    if (fum && now - d.doneAt < 3000) { // a hairline crack of shame
      ctx.strokeStyle = 'rgba(20,20,30,0.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - s * 0.5, y - s * 0.2); ctx.lineTo(x - s * 0.1, y); ctx.lineTo(x - s * 0.2, y + s * 0.15); ctx.lineTo(x + s * 0.3, y + s * 0.35); ctx.stroke();
    }
    if (crit) { ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, '255,210,110', x, y, s * 2.6, 0.5 + 0.2 * Math.sin(now * 0.01)); ctx.globalCompositeOperation = 'source-over'; }
  }
  function dieResult(S, D, d) {
    d.doneAt = S.now;
    const live = D.dice.filter((q) => q.batch === d.batch);
    if (live.some((q) => !q.done)) return;
    const vals = live.map((q) => q.res), best = Math.max(...vals);
    D.last = { t: S.now, vals, best, adv: vals.length > 1 };
    D.log.push(best); if (D.log.length > 12) D.log.shift();
    if (best === 20) {
      D.hop = S.now; D.crits++;
      D.banner = { t: S.now, life: 2600, text: 'NATURAL 20!', fill: '#ffe08a', stroke: 'rgba(90,30,0,0.85)', sub: 'critical hit · roll the damage twice', size: 50 };
      const n = S.reduceMotion ? 20 : 70;
      for (let q = 0; q < n; q++) { const a = rand(0, TAU), v = rand(2, 9); fxAdd(D, { kind: 'sparkle', x: d.x, y: d.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, g: 0.12, drag: 0.97, t: S.now, life: rand(700, 1500), s: rand(5, 12), rgb: pick(['255,215,110', '255,160,90', '255,240,200', '180,220,255']) }); }
      if (!S.reduceMotion) for (let q = 0; q < 4; q++) D.rockets.push({ x: rand(S.W * 0.2, S.W * 0.8), y: S.H, vy: -rand(9, 12), t: S.now + q * 220, hue: pick([45, 20, 200, 300]) });
      S.ring(d.x, d.y, S.R * 1.4, [45, 100, 65], 900);
    } else if (best === 1) {
      D.slump = S.now; D.fumbles++;
      D.banner = { t: S.now, life: 2600, text: 'NAT 1', fill: '#b9c3d6', stroke: 'rgba(20,20,40,0.9)', sub: 'you trip over your own cloak', size: 46, rot: -0.12 };
      for (let q = 0; q < 14; q++) fxAdd(D, { kind: 'steam', x: d.x + rand(-20, 20), y: d.y + rand(-5, 15), vx: rand(-1.5, 1.5), vy: rand(-1, 0), drag: 0.96, t: S.now, life: rand(700, 1300), s: rand(14, 26), a: 0.3, rgb: '170,160,150' });
    }
  }
  const POOL_N = [1, 2, 3, 8];
  function poolExact(n) { // exact distribution of the sum of n d6 by convolution
    let p = [1];
    for (let k = 0; k < n; k++) { const q = new Array(p.length + 6).fill(0); p.forEach((v, i) => { for (let f = 1; f <= 6; f++) q[i + f] += v / 6; }); p = q; }
    return p;
  }
  function hexPath(ctx, x, y, s) { ctx.moveTo(x + s * 0.866, y - s * 0.5); ctx.lineTo(x + s * 0.866, y + s * 0.5); ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.866, y + s * 0.5); ctx.lineTo(x - s * 0.866, y - s * 0.5); ctx.lineTo(x, y - s); ctx.closePath(); }
  const HEX = 24;
  const hexCenter = (q, r) => [HEX * Math.sqrt(3) * (q + r / 2), HEX * 1.5 * r];
  function hexAt(x, y) {
    const q = (Math.sqrt(3) / 3 * x - y / 3) / HEX, r = (2 / 3 * y) / HEX, s = -q - r;
    let rq = Math.round(q), rr = Math.round(r); const rs = Math.round(s);
    const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
    if (dq > dr && dq > ds) rq = -rr - rs; else if (dr > ds) rr = -rq - rs;
    return [rq, rr];
  }
  function pip(ctx, x, y, s, face) {
    const P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[face];
    for (const p of P) { ctx.moveTo(x + p[0] * s * 0.27 + s * 0.08, y + p[1] * s * 0.27); ctx.arc(x + p[0] * s * 0.27, y + p[1] * s * 0.27, s * 0.08, 0, TAU); }
  }
  addMode({
    id: 'fa_dice', name: 'CRITICAL ROLL', glyphs: () => String(1 + Math.floor(Math.random() * 20)),
    base: [42, 45, 86], palette: [[350, 85, 62], [275, 80, 70], [195, 90, 62], [46, 100, 62]],
    links: ['line', 'beads', 'arrow', 'comet'], opaque: true, count: 60, pageBg: ['#1a0a12', '#0b0710'],
    shapes: ['sphere', 'icosahedron', 'dodecahedron', 'octahedron', 'cube', 'stella_octangula', 'rhombic_triacontahedron', 'pentakis_dodecahedron'],
    init(S) { Object.assign(S.data, { dice: [], fx: [], rockets: [], log: [], crits: 0, fumbles: 0, batch: 0, pool: null, poolDice: [], last: null }); },
    update(S, now, dt) {
      const D = S.data;
      for (const d of D.dice) stepDie(S, D, d, dt);
      D.dice = D.dice.filter((d) => !d.done || now - d.doneAt < 7000);
      if (S.holding && S.held > 300) { // the pool: n d6 rolled again and again, summed into a histogram
        const n = POOL_N[S.stage];
        if (!D.pool || D.pool.n !== n) D.pool = { n, hist: new Array(6 * n + 1).fill(0), rolls: 0, s1: 0, s2: 0, acc: 0, exact: poolExact(n), faces: [] };
        const P = D.pool; P.acc += dt * 0.32;
        while (P.acc >= 1) {
          P.acc--; let sum = 0; const faces = [];
          for (let k = 0; k < n; k++) { const f = 1 + Math.floor(Math.random() * 6); sum += f; faces.push(f); }
          P.hist[sum]++; P.rolls++; P.s1 += sum; P.s2 += sum * sum; P.faces = faces;
        }
        P.shown = now;
      }
      D.rockets = D.rockets.filter((r) => {
        if (now < r.t) return true;
        r.y += r.vy * dt / 16.7; r.vy += 0.18 * dt / 16.7;
        fxAdd(D, { kind: 'glow', x: r.x, y: r.y, vx: rand(-0.2, 0.2), vy: 0.5, drag: 0.9, t: now, life: 300, s: 6, a: 0.8, rgb: '255,210,150' });
        if (r.vy > -1) { const rgb = rgbS(hsl2rgb(r.hue, 100, 65)); for (let q = 0; q < 40; q++) { const a = rand(0, TAU), v = rand(1, 5); fxAdd(D, { kind: 'sparkle', x: r.x, y: r.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.06, drag: 0.97, t: now, life: rand(700, 1300), s: rand(4, 8), rgb }); } return false; }
        return true;
      });
      fxStep(S, D, dt);
    },
    background(S, ctx, now) {
      blit(ctx, layer(S, 'table', S.W, S.H, (x, w, h) => {
        let g = x.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, Math.max(w, h) * 0.75);
        g.addColorStop(0, '#3a1420'); g.addColorStop(0.6, '#200a12'); g.addColorStop(1, '#0a0306');
        x.fillStyle = g; x.fillRect(0, 0, w, h);
        x.strokeStyle = 'rgba(240,200,120,0.07)'; x.lineWidth = 1; x.beginPath();
        const q0 = Math.ceil(w / (HEX * 1.7)) + 4, r0 = Math.ceil(h / (HEX * 1.5)) + 2;
        for (let r = -1; r < r0; r++) for (let q = -Math.ceil(r / 2) - 1; q < q0 - Math.ceil(r / 2); q++) { const c = hexCenter(q, r); hexPath(x, c[0], c[1], HEX); }
        x.stroke();
        const r = prng(3); // a hand-drawn battle map: a river, a few trees, walls
        x.strokeStyle = 'rgba(110,170,220,0.12)'; x.lineWidth = 16; x.beginPath(); x.moveTo(-20, h * 0.75);
        for (let i = 1; i <= 8; i++) x.quadraticCurveTo(w * (i - 0.5) / 8, h * (0.7 + 0.12 * Math.sin(i * 1.7)), w * i / 8, h * (0.76 + 0.06 * Math.cos(i)));
        x.stroke();
        x.fillStyle = 'rgba(120,180,110,0.08)';
        for (let i = 0; i < 26; i++) { const tx = r() * w, ty = r() * h * 0.6; x.beginPath(); x.arc(tx, ty, 6 + r() * 8, 0, TAU); x.fill(); }
        x.strokeStyle = 'rgba(220,200,160,0.1)'; x.lineWidth = 4; x.strokeRect(w * 0.06, h * 0.1, w * 0.18, h * 0.22);
        x.strokeStyle = 'rgba(240,200,120,0.28)'; x.lineWidth = 2; x.strokeRect(10, 10, w - 20, h - 20); x.lineWidth = 0.8; x.strokeRect(16, 16, w - 32, h - 32);
        // compass rose
        const cx = w - 70, cy = 86; x.strokeStyle = 'rgba(240,200,120,0.35)'; x.fillStyle = 'rgba(240,200,120,0.25)'; x.lineWidth = 1;
        x.beginPath(); x.arc(cx, cy, 30, 0, TAU); x.stroke();
        for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; x.beginPath(); x.moveTo(cx + Math.cos(a) * 40, cy + Math.sin(a) * 40); x.lineTo(cx + Math.cos(a + 0.4) * 8, cy + Math.sin(a + 0.4) * 8); x.lineTo(cx + Math.cos(a - 0.4) * 8, cy + Math.sin(a - 0.4) * 8); x.closePath(); x.fill(); }
        x.font = 'bold 11px Georgia, serif'; x.textAlign = 'center'; x.fillStyle = 'rgba(240,200,120,0.5)'; x.fillText('N', cx, cy - 46);
      }));
      // candlelight flicker
      ctx.globalCompositeOperation = 'lighter';
      const fl = 0.8 + 0.2 * Math.sin(now * 0.013) * Math.sin(now * 0.0071);
      drawGlow(ctx, '255,170,80', S.W * 0.08, S.H * 0.12, Math.min(S.W, S.H) * 0.5, 0.18 * fl);
      ctx.globalCompositeOperation = 'source-over';
      if (S.ptrInside) { // movement range on the battle map: 6 hexes = 30 ft
        const h = hexAt(S.ptr.x, S.ptr.y), c = hexCenter(h[0], h[1]);
        ctx.fillStyle = 'rgba(255,215,120,0.14)'; ctx.beginPath(); hexPath(ctx, c[0], c[1], HEX); ctx.fill();
        ctx.strokeStyle = 'rgba(255,215,120,0.22)'; ctx.lineWidth = 1.2; ctx.beginPath();
        const R = 6; let q = h[0] - R, r = h[1] + R; // walk the ring of hexes at distance 6
        const dirs = [[1, -1], [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1]];
        for (let side = 0; side < 6; side++) for (let k = 0; k < R; k++) { const p = hexCenter(q, r); hexPath(ctx, p[0], p[1], HEX - 2); q += dirs[side][0]; r += dirs[side][1]; }
        ctx.stroke();
        ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(255,215,120,0.55)'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText('30 ft', c[0] + HEX * 6 * 1.75, c[1]);
      }
    },
    drawNode(S, ctx, n, g, size, a) {
      ctx.font = `bold ${(size * 0.9).toFixed(1)}px Georgia, serif`;
      ctx.fillStyle = n.inf ? S.colorOf(n.gen, a) : S.baseColor(a);
      if (n.inf) { ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, rgbS(palRGB(S, n.gen)), n.sx, n.sy, size * 1.3, 0.35 * a); ctx.globalCompositeOperation = 'source-over'; }
      ctx.fillText(g, n.sx, n.sy);
      return true;
    },
    warp(S, n) {
      const D = S.data;
      if (D.hop) { const t = (S.now - D.hop) / 1000 - (n.p[0] + 1) * 0.15; if (t > 0 && t < 2) n.sy -= Math.abs(Math.sin(t * 8)) * S.R * 0.14 * Math.exp(-t * 2); }
      if (D.slump) { // everybody falls over, then sheepishly gets back up
        const t = (S.now - D.slump) / 1000;
        if (t < 3.4) { const k = t < 2.4 ? smooth(0, 0.6, t) : 1 - smooth(2.4, 3.4, t), floor = S.cy + S.R * 1.1 - Math.abs(n.p[0]) * S.R * 0.25; n.sy = lerp(n.sy, Math.max(n.sy, floor + n.p[1] * 6), k * (0.75 + 0.25 * Math.sin(n.p[2] * 9))); n.sx += Math.sin(S.now * 0.003 + n.p[1] * 5) * 2 * k; }
      }
    },
    over(S, ctx, now) {
      const D = S.data;
      for (const d of D.dice) drawDie(S, ctx, d, now);
      const P = D.pool;
      if (P && S.holding && S.held > 300) { // the pool tumbles around the finger
        const n = P.n, sz = n > 4 ? 22 : 28;
        for (let k = 0; k < n; k++) {
          const a = k / n * TAU + now * 0.003, rr = 70 + (n > 4 ? 26 : 0), x = S.ptr.x + Math.cos(a) * rr, y = S.ptr.y + Math.sin(a) * rr * 0.8;
          ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(now * 0.02 + k * 2) * 0.5);
          ctx.fillStyle = '#f2ead6'; ctx.strokeStyle = 'rgba(80,40,20,0.8)'; ctx.lineWidth = 1.5;
          ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-sz / 2, -sz / 2, sz, sz, 5); else ctx.rect(-sz / 2, -sz / 2, sz, sz); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#7a1020'; ctx.beginPath(); pip(ctx, 0, 0, sz, P.faces[k] || 1); ctx.fill(); ctx.restore();
        }
      }
      if (P && now - (P.shown || 0) < 6000) { // histogram of sums vs the exact distribution vs the bell curve
        const fade = S.holding ? 1 : clamp(1 - (now - P.shown - 3500) / 2500, 0, 1);
        const w = Math.min(380, S.W - 40), h = 120, x0 = S.W - w - 22, y0 = S.H - h - 70, n = P.n, lo = n, hi = 6 * n, bw = w / (hi - lo + 1);
        const mu = 3.5 * n, sd = Math.sqrt(35 / 12 * n), maxP = Math.max(...P.exact);
        ctx.globalAlpha = fade;
        ctx.fillStyle = 'rgba(15,5,10,0.72)'; ctx.fillRect(x0 - 10, y0 - 28, w + 20, h + 50);
        ctx.strokeStyle = 'rgba(240,200,120,0.4)'; ctx.lineWidth = 1; ctx.strokeRect(x0 - 10, y0 - 28, w + 20, h + 50);
        const yOf = (p) => y0 + h - p / maxP * h * 0.92;
        ctx.fillStyle = 'rgba(230,80,100,0.85)';
        for (let s = lo; s <= hi; s++) { const p = P.rolls ? P.hist[s] / P.rolls : 0, y = yOf(p); ctx.fillRect(x0 + (s - lo) * bw + 0.5, y, Math.max(1, bw - 1), y0 + h - y); }
        ctx.strokeStyle = 'rgba(255,225,140,0.95)'; ctx.lineWidth = 1.6; ctx.beginPath(); // normal approximation (CLT)
        for (let i = 0; i <= 80; i++) { const s = lo - 0.5 + (hi - lo + 1) * i / 80, p = Math.exp(-((s - mu) ** 2) / (2 * sd * sd)) / (sd * Math.sqrt(TAU)), X = x0 + (s - lo + 0.5) * bw - bw / 2 + bw / 2; if (i) ctx.lineTo(X, yOf(p)); else ctx.moveTo(X, yOf(p)); }
        ctx.stroke();
        ctx.fillStyle = 'rgba(180,220,255,0.95)'; // exact distribution (convolution of uniform d6s)
        for (let s = lo; s <= hi; s++) { ctx.beginPath(); ctx.arc(x0 + (s - lo + 0.5) * bw, yOf(P.exact[s]), 1.8, 0, TAU); ctx.fill(); }
        const mean = P.rolls ? P.s1 / P.rolls : 0, sdev = P.rolls > 1 ? Math.sqrt(Math.max(0, P.s2 / P.rolls - mean * mean)) : 0;
        ctx.font = '11px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = 'rgba(255,235,200,0.95)';
        ctx.fillText(`${n}d6 · ${fmt(P.rolls)} rolls · mean ${mean.toFixed(2)} (μ ${mu.toFixed(1)}) · σ ${sdev.toFixed(2)} (${sd.toFixed(2)})`, x0, y0 - 12);
        ctx.fillStyle = 'rgba(255,225,140,0.85)'; ctx.fillText('— normal (CLT)', x0, y0 + h + 16);
        ctx.fillStyle = 'rgba(180,220,255,0.9)'; ctx.fillText('• exact', x0 + 120, y0 + h + 16);
        ctx.fillStyle = 'rgba(230,80,100,0.95)'; ctx.fillText('▮ rolled', x0 + 190, y0 + h + 16);
        ctx.globalAlpha = 1;
      }
      fxDraw(S, ctx, D);
      banner(S, ctx, D, now);
    },
    onTap(S, x, y) { const D = S.data; D.batch++; const d = throwDie(S, D, x, y); d.batch = D.batch; },
    onRelease(S, held) {
      const D = S.data;
      if (held < S.STAGES[1]) return undefined;
      D.batch++; // roll with advantage: two d20, keep the higher
      const a = throwDie(S, D, S.cx - S.R * 0.6, S.cy + S.R * 0.6, 0, S.W * 0.15), b = throwDie(S, D, S.cx + S.R * 0.6, S.cy + S.R * 0.6, 120, S.W * 0.85);
      a.batch = b.batch = D.batch;
      if (D.pool) for (let k = 0; k < D.pool.n; k++) { const an = rand(0, TAU), v = rand(3, 7); fxAdd(D, { kind: 'sparkle', x: S.ptr.x, y: S.ptr.y, vx: Math.cos(an) * v, vy: Math.sin(an) * v, g: 0.1, drag: 0.97, t: S.now, life: 900, s: 7, rgb: '255,230,200' }); }
      S.ring(S.ptr.x, S.ptr.y, S.R * 1.2, [348, 80, 62], 800);
      return false;
    },
    hud(S) {
      const D = S.data, P = D.pool, l = D.last;
      if (S.holding && P) {
        const tag = ['one die is flat: every face 1/6', '2d6 is a triangle: 7 is the most likely sum (1/6)', '3d6: the old ability-score roll, already bell-shaped', '8d6: a fireball\'s damage. The central limit theorem in your hand'][S.stage];
        return `${P.n}d6 · ${fmt(P.rolls)} rolls · ${tag}`;
      }
      if (D.dice.some((d) => !d.done)) return 'rolling… (a fair d20: each face 1/20, opposite faces sum to 21)';
      if (l && S.now - l.t < 7000) {
        const v = l.best, plain = (21 - v) / 20, adv = 1 - Math.pow((v - 1) / 20, 2), dis = Math.pow((21 - v) / 20, 2);
        const head = l.adv ? `advantage: ${l.vals.join(' & ')} → keep ${v}` : `rolled ${v}`;
        const tail = v === 20 ? 'P = 5% each time · the die has no memory, the table does' : v === 1 ? 'P = 5% · it was not personal' : `P(≥${v}) = ${(plain * 100).toFixed(0)}% · advantage ${(adv * 100).toFixed(1)}% · disadvantage ${(dis * 100).toFixed(1)}%`;
        return `${head} · ${tail}`;
      }
      return `tap: roll the d20 · hold: roll a pool and watch a bell curve grow · advantage turns 30% into 51% for DC 15${D.log.length ? ' · log ' + D.log.join(' ') : ''}`;
    }
  });

  /* ======================= 3. DRAGON HOARD ======================= */
  const REPOSE = 32; // the pile model's angle of repose, in degrees (tan θ ≈ the grains' internal friction μ)
  const COIN_GP = 7; // coins per pixel of pile height per column
  function dragonEye(S) {
    const EW = Math.min(S.W * 0.47, S.R * 3.1), EH = EW * 0.4, IR = EH * 1.02;
    return { x: S.cx, y: S.cy, EW, EH, IR };
  }
  function irisSprite(S, IR) {
    return layer(S, 'iris', IR * 2, IR * 2, (x, w) => {
      const r = w / 2, g = x.createRadialGradient(r, r, 0, r, r, r);
      g.addColorStop(0, '#fff2a8'); g.addColorStop(0.3, '#ffbf3a'); g.addColorStop(0.62, '#e2620e'); g.addColorStop(0.88, '#6a1404'); g.addColorStop(1, '#1a0300');
      x.fillStyle = g; x.beginPath(); x.arc(r, r, r, 0, TAU); x.fill();
      const q = prng(5); x.lineWidth = 1;
      for (let k = 0; k < 240; k++) { const a = q() * TAU, r0 = r * (0.15 + q() * 0.3), r1 = r * (0.55 + q() * 0.42); x.strokeStyle = q() < 0.5 ? `rgba(255,240,170,${0.12 + q() * 0.18})` : `rgba(80,10,0,${0.15 + q() * 0.2})`; x.beginPath(); x.moveTo(r + Math.cos(a) * r0, r + Math.sin(a) * r0); x.lineTo(r + Math.cos(a + 0.05) * r1, r + Math.sin(a + 0.05) * r1); x.stroke(); }
      x.strokeStyle = 'rgba(20,0,0,0.8)'; x.lineWidth = r * 0.06; x.beginPath(); x.arc(r, r, r * 0.97, 0, TAU); x.stroke();
    });
  }
  function wingSprite(S) {
    return layer(S, 'wing', S.W * 0.5, S.H, (x, w, h) => { // the left wing; the right one is this, mirrored
      const sh = [-w * 0.1, h * 0.2], tips = [[w * 0.25, -h * 0.05], [w * 0.5, h * 0.06], [w * 0.62, h * 0.24], [w * 0.55, h * 0.48], [w * 0.36, h * 0.66], [w * 0.12, h * 0.8]];
      x.fillStyle = '#0a0405'; x.beginPath(); x.moveTo(sh[0], sh[1]);
      tips.forEach((t, i) => { if (i === 0) x.lineTo(t[0], t[1]); else { const p = tips[i - 1], mx = (p[0] + t[0]) / 2, my = (p[1] + t[1]) / 2, dx = mx - sh[0], dy = my - sh[1]; x.quadraticCurveTo(mx - dx * 0.25, my - dy * 0.25, t[0], t[1]); } });
      x.lineTo(-w * 0.1, h * 0.95); x.closePath(); x.fill();
      x.strokeStyle = 'rgba(255,90,40,0.18)'; x.lineWidth = 1.5; x.stroke();
      x.strokeStyle = '#1a0a08'; x.lineWidth = 7; x.lineCap = 'round';
      tips.forEach((t) => { x.beginPath(); x.moveTo(sh[0], sh[1]); x.quadraticCurveTo((sh[0] + t[0]) / 2 + 10, (sh[1] + t[1]) / 2 - 10, t[0], t[1]); x.stroke(); });
      x.fillStyle = '#1a0a08'; tips.forEach((t) => { x.beginPath(); x.moveTo(t[0] - 4, t[1]); x.lineTo(t[0] + 10, t[1] - 16); x.lineTo(t[0] + 5, t[1] + 3); x.fill(); });
    });
  }
  function scaleSkin(S) {
    return layer(S, 'lair', S.W, S.H, (x, w, h) => {
      let g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0d0604'); g.addColorStop(0.6, '#1a0a05'); g.addColorStop(1, '#2b1404');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      const E = dragonEye(S), q = prng(9);
      // the head: overlapping scales around the eye, densest close to it
      for (let k = 0; k < 1400; k++) {
        const a = q() * TAU, rr = Math.sqrt(q()), px = E.x + Math.cos(a) * rr * E.EW * 1.7, py = E.y + Math.sin(a) * rr * E.EH * 3.0, s = 7 + 14 * rr;
        const lum = 0.5 + 0.5 * q();
        x.fillStyle = `rgba(${Math.round(40 * lum)},${Math.round(22 * lum)},${Math.round(16 * lum)},0.9)`; x.strokeStyle = `rgba(160,70,30,${0.18 * (1 - rr)})`; x.lineWidth = 1;
        x.beginPath(); x.arc(px, py, s, 0.15 * Math.PI, 0.85 * Math.PI); x.closePath(); x.fill(); x.stroke();
      }
      g = x.createRadialGradient(E.x, E.y, E.EH, E.x, E.y, E.EW * 1.8); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(8,3,2,0.95)');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      // a brow ridge with horns
      x.fillStyle = '#060203'; x.beginPath(); x.moveTo(E.x - E.EW * 1.2, E.y - E.EH * 0.7); x.quadraticCurveTo(E.x, E.y - E.EH * 2.1, E.x + E.EW * 1.2, E.y - E.EH * 0.9);
      x.lineTo(E.x + E.EW * 1.5, E.y - E.EH * 2.6); x.lineTo(E.x + E.EW * 0.9, E.y - E.EH * 1.5); x.quadraticCurveTo(E.x, E.y - E.EH * 1.7, E.x - E.EW * 1.1, E.y - E.EH * 1.05); x.closePath(); x.fill();
    });
  }
  function eyePath(ctx, E, open) {
    ctx.beginPath(); ctx.moveTo(E.x - E.EW, E.y);
    ctx.quadraticCurveTo(E.x - E.EW * 0.1, E.y - E.EH * 2 * open, E.x + E.EW, E.y - E.EH * 0.1);
    ctx.quadraticCurveTo(E.x + E.EW * 0.05, E.y + E.EH * 1.6 * open, E.x - E.EW, E.y); ctx.closePath();
  }
  addMode({
    id: 'fa_dragon', name: 'DRAGON HOARD', glyphs: G('$¤◎⊙●◉✦♛', '$◎⊙●✦'),
    base: [44, 90, 62], palette: [[40, 100, 58], [25, 100, 55], [10, 100, 52], [52, 100, 72]],
    links: ['line', 'barbed', 'fire', 'fire'], opaque: true, count: 120, glyphScale: 1, noHueShift: true, pageBg: ['#1c0904', '#080202'],
    shapes: ['sphere', 'galaxy', 'heart', 'crown', 'seashell', 'great_stellated_dodecahedron', 'torus', 'spherical_spiral'],
    init(S) {
      const D = S.data, cw = 4, n = Math.ceil(S.W / cw) + 1, tn = Math.tan(REPOSE * Math.PI / 180) * cw;
      D.cw = cw; D.h = new Float32Array(n);
      for (let i = 0; i < n; i++) { const x = i * cw; D.h[i] = Math.max(0, S.H * 0.13 - Math.abs(x - S.W * 0.32) / cw * tn * 0.9, S.H * 0.09 - Math.abs(x - S.W * 0.72) / cw * tn * 0.9); }
      Object.assign(D, { coins: [], fx: [], t0: S.now, added: 0, aval: 0, blink: S.now + 2500, breath: null, heat: 0, pupil: 0.1 });
    },
    resize(S) { if (S.data.h && Math.ceil(S.W / S.data.cw) + 1 !== S.data.h.length) this.init(S); },
    update(S, now, dt) {
      const D = S.data, k = dt / 16.7, H = D.h, cw = D.cw, n = H.length, tn = Math.tan(REPOSE * Math.PI / 180) * cw;
      if (S.holding && S.stage >= 0) { // coins rain from the infected letters
        const rate = [0.15, 0.6, 1.4, 3][S.stage];
        for (let q = 0; q < rate * k * 3; q++) { const nd = pick(S.active); if (nd && nd.inf && D.coins.length < 400) D.coins.push({ x: nd.sx, y: nd.sy, vx: rand(-1.2, 1.2), vy: rand(-2, 0), r: rand(0, TAU) }); }
      }
      D.coins = D.coins.filter((c) => {
        c.vy += 0.35 * k; c.x += c.vx * k; c.y += c.vy * k; c.r += 0.3 * k;
        const i = clamp(Math.round(c.x / cw), 0, n - 1);
        if (c.y >= S.H - H[i]) { H[i] += 10 / COIN_GP; D.added += 10; if (Math.random() < 0.15) fxAdd(D, { kind: 'sparkle', x: c.x, y: S.H - H[i], vx: 0, vy: -0.3, t: now, life: 400, s: 5, rgb: '255,230,150' }); return false; }
        return c.y < S.H + 20;
      });
      // the sandpile: wherever the slope beats the angle of repose, the excess slides downhill (an avalanche)
      let moved = 0;
      for (let pass = 0; pass < 3; pass++) {
        const dir = (pass + Math.floor(now / 100)) % 2, st = dir ? 0 : n - 2, en = dir ? n - 1 : -1, sg = dir ? 1 : -1;
        for (let i = st; i !== en; i += sg) { const d = H[i] - H[i + 1]; if (d > tn) { const m = (d - tn) * 0.5; H[i] -= m; H[i + 1] += m; moved += m; } else if (-d > tn) { const m = (-d - tn) * 0.5; H[i] += m; H[i + 1] -= m; moved += m; } }
      }
      if (moved > 2) D.aval += moved * 0.01;
      if (S.ptrInside && pspeed(S) > 3) { // a swipe across the pile knocks coins loose
        const i = clamp(Math.round(S.ptr.x / cw), 1, n - 2);
        if (Math.abs(S.ptr.y - (S.H - H[i])) < 30 && H[i] > 4) { H[i] -= 2; for (let q = 0; q < 3; q++) D.coins.push({ x: S.ptr.x, y: S.H - H[i] - 4, vx: pvel(S).x * 0.3 + rand(-1, 1), vy: -rand(3, 7), r: 0 }); }
      }
      if (Math.random() < 0.3 * k) { const i = Math.floor(rand(0, n)); if (H[i] > 3) fxAdd(D, { kind: 'sparkle', x: i * cw, y: S.H - H[i] + rand(0, 10), vx: 0, vy: 0, t: now, life: rand(500, 900), s: rand(3, 7), rgb: '255,240,190', noPtr: true }); }
      // the eye: blinks, tracks the pointer, opens wider as the hoard is disturbed
      if (now > D.blink + 260) D.blink = now + rand(3500, 7000);
      const E = dragonEye(S), tx = S.ptrInside ? clamp((S.ptr.x - E.x) / S.W, -0.5, 0.5) : 0, ty = S.ptrInside ? clamp((S.ptr.y - E.y) / S.H, -0.5, 0.5) : 0;
      D.lx = lerp(D.lx || 0, tx, 0.08); D.ly = lerp(D.ly || 0, ty, 0.08);
      const near = S.ptrInside ? clamp(1 - Math.hypot(S.ptr.x - E.x, S.ptr.y - E.y) / (E.EW * 1.2), 0, 1) : 0;
      D.pupil = lerp(D.pupil, S.holding ? 0.06 + 0.04 * S.stage : 0.16 - 0.1 * near, 0.08); // a pointer close by is a bright light: the slit narrows
      const b = D.breath;
      if (b) {
        const t = (now - b.t) / 1000;
        if (t > 2.2) D.breath = null;
        else if (t < 1.5) { // dragon fire: a cone of hot gas, cooling as it flies
          const mx = -20, my = S.H * 0.3, tx2 = b.x + Math.sin(t * 3) * 60, ty2 = b.y, dx = tx2 - mx, dy = ty2 - my, L = Math.hypot(dx, dy);
          const per = S.reduceMotion ? 8 : 22;
          for (let q = 0; q < per * k; q++) { const sp = rand(16, 24), a = Math.atan2(dy, dx) + rand(-0.16, 0.16); fxAdd(D, { kind: 'glow', x: mx, y: my + rand(-10, 10), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 0.97, t: now, life: rand(700, 1000) * Math.max(0.6, L / 900), s: rand(18, 34), a: 0.5, T: rand(1250, 1400), cool: 0.55 }); }
          D.heat = Math.min(1, D.heat + 0.03 * k);
        }
      }
      D.heat *= Math.pow(0.992, k);
      fxStep(S, D, dt, (p) => { if (p.cool) { p.T -= p.cool * dt; p.s *= 1 + 0.012 * k; } });
    },
    background(S, ctx, now) {
      const D = S.data, E = dragonEye(S);
      blit(ctx, scaleSkin(S));
      const wing = wingSprite(S), fl = 1 + (S.holding ? 0.05 * S.stage : 0) * Math.sin(now * 0.004) + 0.02 * Math.sin(now * 0.0011);
      ctx.save(); ctx.translate(0, S.H * 0.2); ctx.scale(1, fl); ctx.translate(0, -S.H * 0.2); blit(ctx, wing); ctx.restore();
      ctx.save(); ctx.translate(S.W, S.H * 0.2); ctx.scale(-1, fl); ctx.translate(0, -S.H * 0.2); blit(ctx, wing); ctx.restore();
      // the eye
      const bt = (now - D.blink) / 260, blink = bt > 0 && bt < 1 ? Math.sin(bt * Math.PI) : 0;
      const open = (0.55 + 0.45 * power(S) + 0.2 * D.heat) * (1 - blink * 0.97);
      if (open > 0.03) {
        ctx.save(); eyePath(ctx, E, open); ctx.clip();
        ctx.fillStyle = '#2a0802'; ctx.fillRect(E.x - E.EW, E.y - E.EH * 2.2, E.EW * 2, E.EH * 4.4);
        const ix = E.x + D.lx * E.EW * 0.5, iy = E.y - E.EH * 0.15 + D.ly * E.EH * 0.6;
        blit(ctx, irisSprite(S, E.IR), ix - E.IR, iy - E.IR);
        ctx.fillStyle = '#040000'; ctx.beginPath(); ctx.ellipse(ix, iy, E.IR * D.pupil, E.IR * 0.9, 0, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, '255,150,40', ix, iy, E.IR * 1.3, 0.12 + 0.3 * power(S));
        ctx.fillStyle = 'rgba(255,250,230,0.5)'; ctx.beginPath(); ctx.ellipse(ix - E.IR * 0.35, iy - E.IR * 0.4, E.IR * 0.1, E.IR * 0.05, -0.5, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        const g = ctx.createLinearGradient(0, E.y - E.EH * 1.4 * open, 0, E.y); g.addColorStop(0, 'rgba(0,0,0,0.75)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(E.x - E.EW, E.y - E.EH * 2.2, E.EW * 2, E.EH * 2.2);
        ctx.restore();
      }
      eyePath(ctx, E, Math.max(0.02, open)); ctx.strokeStyle = '#080203'; ctx.lineWidth = 9; ctx.stroke(); ctx.strokeStyle = 'rgba(255,120,40,0.25)'; ctx.lineWidth = 1.5; ctx.stroke();
    },
    ambient(S, ctx, now) {
      const D = S.data, H = D.h, cw = D.cw, n = H.length;
      // the hoard
      const g = layer(S, 'gold', 4, S.H * 0.5, (x, w, h) => { const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffe08a'); gr.addColorStop(0.08, '#e0a12c'); gr.addColorStop(0.4, '#8a5410'); gr.addColorStop(1, '#2a1504'); x.fillStyle = gr; x.fillRect(0, 0, w, h); });
      ctx.beginPath(); ctx.moveTo(0, S.H);
      for (let i = 0; i < n; i++) ctx.lineTo(i * cw, S.H - H[i]);
      ctx.lineTo(S.W, S.H); ctx.closePath();
      ctx.save(); ctx.clip(); ctx.drawImage(g, 0, S.H - Math.max(40, Math.max(...H)) - 2, S.W, S.H * 0.5); ctx.restore();
      ctx.fillStyle = 'rgba(255,235,170,0.45)'; // coin rims on the surface
      for (let i = 0; i < n; i += 2) if (H[i] > 2) { const y = S.H - H[i] + ((i * 7) % 5); ctx.fillRect(i * cw - 2, y, 4 + (i % 3), 1.5); }
      if (D.heat > 0.02) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,80,20,${0.35 * D.heat})`; ctx.beginPath(); ctx.moveTo(0, S.H); for (let i = 0; i < n; i++) ctx.lineTo(i * cw, S.H - H[i]); ctx.lineTo(S.W, S.H); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
      // falling coins: spinning discs
      ctx.fillStyle = '#ffd25a'; ctx.strokeStyle = '#8a5a10'; ctx.lineWidth = 1;
      for (const c of D.coins) { ctx.beginPath(); ctx.ellipse(c.x, c.y, 5, Math.max(0.8, 5 * Math.abs(Math.cos(c.r))), 0, 0, TAU); ctx.fill(); ctx.stroke(); }
      if (S.holding && S.stage >= 2) { ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 2; k++) { const E = dragonEye(S); drawGlow(ctx, '255,110,30', E.x + (k ? 1 : -1) * E.EW * 1.05, E.y + rand(-4, 4), 40 + rand(0, 20), 0.4); } ctx.globalCompositeOperation = 'source-over'; }
    },
    over(S, ctx, now) { fxDraw(S, ctx, S.data); banner(S, ctx, S.data, now); },
    onRelease(S, held) {
      const D = S.data;
      if (held < S.STAGES[1]) return undefined;
      D.breath = { t: S.now, x: S.ptr.x, y: S.ptr.y };
      S.shake(8); S.ring(S.ptr.x, S.ptr.y, S.R * 1.6, [20, 100, 55], 900);
      if (held > S.STAGES[3]) D.banner = { t: S.now, life: 2400, text: 'WHO DISTURBS MY HOARD', fill: '#ffb347', stroke: 'rgba(60,10,0,0.9)', size: 34, y: S.H * 0.16 };
      return false;
    },
    hud(S) {
      const D = S.data, H = D.h; let sum = 0; for (let i = 0; i < H.length; i++) sum += H[i];
      const gp = sum * COIN_GP, yrs = (S.now - D.t0) / 1000 * 25, val = gp * Math.pow(1.02, yrs);
      let slope = 0; for (let i = 0; i + 8 < H.length; i++) { const s = Math.abs(H[i + 8] - H[i]) / (8 * D.cw); if (s > slope && Math.min(H[i], H[i + 8]) > 3) slope = s; }
      const ang = Math.atan(slope) * 180 / Math.PI;
      if (D.breath) return `DRAGONFIRE · ~1,200 °C at the jaw · gold melts at 1,064 °C · the hoard is fine, the hoard is always fine`;
      if (S.holding) return `hoard +${fmt(D.added)} gp · steepest flank ${ang.toFixed(1)}° vs repose ${REPOSE}° (tan θ ≈ μ) · avalanches ${fmt(D.aval)}`;
      return `hoard ${fmt(gp)} gp · slept ${fmt(yrs)} yrs at 2% → ${sci(val)} gp · rule of 72: doubles every 36 yrs · pile ${ang.toFixed(1)}° (repose ${REPOSE}°)`;
    }
  });

  /* ======================= 4. ELVEN STARLIGHT ======================= */
  const LEAF_SCRIPT = makeScript(0x5EAF, 16, 'leaf');
  const GOLD_DEG = GOLDEN * 180 / Math.PI; // 137.5077…°, i.e. 360°/φ²
  function convergents(x, maxQ) { // continued-fraction convergents p/q of x
    const out = []; let h0 = 1, h1 = 0, k0 = 0, k1 = 1, y = x;
    for (let i = 0; i < 12; i++) { const a = Math.floor(y); const h = a * h0 + h1, k = a * k0 + k1; if (k > maxQ) break; out.push([h, k]); h1 = h0; h0 = h; k1 = k0; k0 = k; const f = y - a; if (f < 1e-9) break; y = 1 / f; }
    return out;
  }
  function leafSprite(rgb) {
    const c = mk(48, 24), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 48, 0); g.addColorStop(0, `rgba(${rgb},0.15)`); g.addColorStop(0.5, `rgba(${rgb},0.9)`); g.addColorStop(1, 'rgba(255,255,255,1)');
    x.fillStyle = g; x.beginPath(); x.moveTo(2, 12); x.quadraticCurveTo(24, -2, 46, 12); x.quadraticCurveTo(24, 26, 2, 12); x.fill();
    x.strokeStyle = 'rgba(255,255,255,0.7)'; x.lineWidth = 1; x.beginPath(); x.moveTo(4, 12); x.lineTo(44, 12); x.stroke();
    return c;
  }
  const LEAVES = {};
  const leaf = (rgb) => LEAVES[rgb] || (LEAVES[rgb] = leafSprite(rgb));
  addMode({
    id: 'fa_elven', name: 'ELVEN STARLIGHT', glyphs: SCRIPT_GLYPHS,
    base: [215, 45, 86], palette: [[200, 90, 78], [175, 80, 74], [48, 90, 78], [260, 70, 82]],
    links: ['vine', 'curve', 'constellation', 'ribbon'], opaque: true, count: 'random', glyphScale: 1.05, pageBg: ['#0b1634', '#03060f'],
    shapes: ['sunflower', 'spherical_spiral', 'rose', 'galaxy', 'seashell', 'hopf', 'helix', 'cinquefoil'],
    init(S) {
      const flies = []; for (let i = 0; i < 26; i++) flies.push({ x: rand(0, S.W), y: rand(S.H * 0.3, S.H), vx: 0, vy: 0, ph: rand(0, TAU) });
      Object.assign(S.data, { N: 0, alpha: GOLD_DEG, flies, fx: [], fade: null, star: null, glyphA: 0, hl: 0 });
    },
    update(S, now, dt) {
      const D = S.data, k = dt / 16.7;
      const target = S.holding ? 260 + 440 * power(S) : 300;
      if (!D.fade) D.N = lerp(D.N, target, 1 - Math.pow(0.985, k));
      const off = S.holding ? 0 : S.ptrInside ? clamp((S.ptr.x - S.cx) / (S.W * 0.5), -1, 1) * 4 : 0;
      D.alpha = lerp(D.alpha, GOLD_DEG + off, 1 - Math.pow(S.holding ? 0.9 : 0.95, k));
      D.glyphA = clamp(D.glyphA + (S.holding && S.stage >= 2 ? 1 : -0.6) * dt / 900, 0, 1);
      for (const f of D.flies) { // fireflies drift toward a resting pointer
        f.ph += 0.02 * k; f.vx += Math.cos(f.ph * 1.3) * 0.03 * k; f.vy += Math.sin(f.ph) * 0.03 * k;
        if (S.ptrInside) { const dx = S.ptr.x - f.x, dy = S.ptr.y - f.y, d = Math.hypot(dx, dy) + 1; if (d < 260) { f.vx += dx / d * 0.04 * k; f.vy += dy / d * 0.04 * k; } }
        f.vx *= 0.97; f.vy *= 0.97; f.x += f.vx * k; f.y += f.vy * k;
        if (f.x < -20) f.x = S.W + 20; if (f.x > S.W + 20) f.x = -20; if (f.y < -20) f.y = S.H + 20; if (f.y > S.H + 20) f.y = -20;
      }
      if (D.fade && now - D.fade.t > 4200) { D.fade = null; D.N = 0; }
      fxStep(S, D, dt);
    },
    background(S, ctx, now) {
      const D = S.data;
      blit(ctx, layer(S, 'sky', S.W, S.H, (x, w, h) => {
        let g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0a1838'); g.addColorStop(0.65, '#060c22'); g.addColorStop(1, '#030612');
        x.fillStyle = g; x.fillRect(0, 0, w, h);
        const q = prng(77);
        for (let i = 0; i < 18; i++) { const t = i / 18; x.globalAlpha = 0.05; x.drawImage(soft('150,170,255', 1), w * (0.1 + 0.8 * t) - 160, h * (0.15 + 0.25 * Math.sin(t * 3)) - 160, 320, 320); } // a pale river of stars
        x.globalAlpha = 1;
        for (let i = 0; i < 700; i++) { const s = Math.pow(q(), 6) * 2.2 + 0.4; x.fillStyle = `rgba(${q() < 0.2 ? '255,240,220' : '210,225,255'},${0.3 + q() * 0.6})`; x.fillRect(q() * w, q() * h * 0.85, s, s); }
        // slender silver trees at the edges, and a soft mist at their feet
        const tree = (tx, th, tw) => {
          const gr = x.createLinearGradient(tx - tw, 0, tx + tw, 0); gr.addColorStop(0, '#0c1428'); gr.addColorStop(0.35, '#5d6f94'); gr.addColorStop(0.5, '#a9b8d8'); gr.addColorStop(1, '#0c1428');
          x.fillStyle = gr; x.beginPath(); x.moveTo(tx - tw * 1.6, h); x.quadraticCurveTo(tx - tw, h * 0.8, tx - tw * 0.5, h - th); x.lineTo(tx + tw * 0.5, h - th); x.quadraticCurveTo(tx + tw, h * 0.8, tx + tw * 1.6, h); x.fill();
          x.strokeStyle = 'rgba(170,190,230,0.5)'; x.lineWidth = tw * 0.25; x.lineCap = 'round';
          for (let b = 0; b < 5; b++) { const by = h - th * (0.45 + b * 0.12), s = b % 2 ? 1 : -1; x.beginPath(); x.moveTo(tx, by); x.quadraticCurveTo(tx + s * tw * 3, by - th * 0.06, tx + s * tw * (5 + b), by - th * 0.15); x.stroke(); }
          for (let l = 0; l < 60; l++) { const a = q() * TAU, rr = q() * tw * 9; x.fillStyle = `rgba(${q() < 0.3 ? '255,230,160' : '190,215,255'},${0.15 + q() * 0.3})`; x.beginPath(); x.arc(tx + Math.cos(a) * rr, h - th - tw * 2 + Math.sin(a) * rr * 0.5, 1.5 + q() * 2, 0, TAU); x.fill(); }
        };
        tree(w * 0.07, h * 0.82, 16); tree(w * 0.17, h * 0.6, 9); tree(w * 0.9, h * 0.88, 18); tree(w * 0.8, h * 0.55, 8);
        g = x.createLinearGradient(0, h * 0.75, 0, h); g.addColorStop(0, 'rgba(120,150,210,0)'); g.addColorStop(1, 'rgba(120,150,210,0.25)'); x.fillStyle = g; x.fillRect(0, h * 0.75, w, h * 0.25);
      }));
      // twinkling stars, dimmed while the light leaves
      const dim = D.fade ? Math.sin(Math.min(1, (now - D.fade.t) / 4200) * Math.PI) : 0;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 40; i++) { const x = (i * 337.1) % S.W, y = (i * 191.7) % (S.H * 0.7), tw = 0.5 + 0.5 * Math.sin(now * 0.002 + i * 1.7); ctx.globalAlpha = 0.6 * tw * (1 - dim * 0.7); ctx.drawImage(sparkle('200,220,255'), x - 6, y - 6, 12, 12); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      if (dim > 0) { ctx.fillStyle = `rgba(2,4,12,${0.45 * dim})`; ctx.fillRect(0, 0, S.W, S.H); }
    },
    ambient(S, ctx, now) {
      const D = S.data, N = Math.floor(D.N), Rmax = Math.min(S.R * 1.6, S.H * 0.47), c = Rmax / Math.sqrt(700), al = D.alpha * Math.PI / 180;
      // Vogel's model of a sunflower head: leaf n at angle n·α, radius c·√n
      // Visible spiral families (parastichies): the convergent denominators q of α/360° nearest q* ≈ √(4πN/√5),
      // where leaves n and n+q are closest neighbours. For the golden angle those are consecutive Fibonacci numbers.
      const conv = convergents(D.alpha / 360, 2000), qStar = Math.sqrt(4 * Math.PI * Math.max(N, 2) / Math.sqrt(5));
      let lo = 1, hi = 0, pLo = 0;
      for (const [p, q] of conv) { if (q <= qStar) { lo = q; pLo = p; } else if (!hi) hi = q; }
      D.fam = [lo, hi || lo]; D.pLo = pLo;
      const arms = lo > 1 ? lo : 0, arm = arms ? Math.floor(now / 700) % arms : -1;
      const m0 = ctx.getTransform(), dpr = m0.a, fade = D.fade ? (now - D.fade.t) / 1000 : 0;
      ctx.globalCompositeOperation = 'lighter';
      const silver = leaf('170,200,255'), gold = leaf('255,215,140'), blue = leaf('120,170,255');
      for (let i = 1; i <= N; i++) {
        const th = i * al + now * 0.00004, r = c * Math.sqrt(i), sz = 0.45 + 0.75 * Math.sqrt(i / 700);
        let px = S.cx + Math.cos(th) * r, py = S.cy + Math.sin(th) * r, a = 0.75;
        if (fade) { const t = Math.max(0, fade - (i % 97) / 97 * 1.2); py -= t * t * 60 * (1 + (i % 7) * 0.2); px += Math.sin(t * 2 + i) * t * 20; a *= clamp(1 - t / 2.4, 0, 1); if (a <= 0.01) continue; }
        const onArm = arms && i % arms === arm;
        if (S.ptrInside) { const d = Math.abs(px - S.ptr.x) + Math.abs(py - S.ptr.y); if (d < 90) a = Math.min(1, a + (1 - d / 90) * 0.6); }
        const co = Math.cos(th) * sz * 0.5, si = Math.sin(th) * sz * 0.5;
        ctx.setTransform(co * dpr, si * dpr, -si * dpr, co * dpr, px * dpr + m0.e, py * dpr + m0.f);
        ctx.globalAlpha = a;
        ctx.drawImage(onArm ? gold : i % 5 === 0 ? blue : silver, -2, -12);
      }
      ctx.setTransform(m0); ctx.globalAlpha = 1;
      if (D.glyphA > 0.01) { // the leaf-script ring, glowing only at full song
        const G2 = 21, rr = Rmax * 1.1;
        for (let i = 0; i < G2; i++) { const a = i / G2 * TAU - now * 0.00008, spr = scriptSprite('elf', LEAF_SCRIPT, i * 5, '180,210,255', '245,250,255', 1.2); ctx.save(); ctx.translate(S.cx + Math.cos(a) * rr, S.cy + Math.sin(a) * rr); ctx.rotate(a + Math.PI / 2); ctx.globalAlpha = D.glyphA * (0.7 + 0.3 * Math.sin(now * 0.003 + i)); ctx.drawImage(spr, -16, -16, 32, 32); ctx.restore(); }
        ctx.globalAlpha = 1;
      }
      for (const f of D.flies) drawGlow(ctx, '190,255,200', f.x, f.y, 10, 0.5 + 0.4 * Math.sin(f.ph * 3));
      ctx.globalCompositeOperation = 'source-over';
    },
    drawNode(S, ctx, n, g, size, a) {
      const rgb = n.inf ? rgbS(palRGB(S, n.gen)) : '200,220,255';
      drawSprite(ctx, scriptSprite('elfN', LEAF_SCRIPT, glyphIndex(g), rgb, '250,252,255', n.inf ? 1.3 : 0.6), n.sx, n.sy, size * 1.7, a);
      return true;
    },
    over(S, ctx, now) {
      const D = S.data, st = D.star;
      fxDraw(S, ctx, D);
      if (st) { // the last light rises and lingers as an evening star
        const t = (now - st.t) / 1000, y = lerp(st.y, S.H * 0.12, smooth(0, 3, t)), a = t < 3 ? 1 : clamp(1 - (t - 3) / 4, 0, 1);
        if (a <= 0) D.star = null;
        else { ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, '220,235,255', st.x, y, 60, 0.7 * a); ctx.globalAlpha = a; ctx.drawImage(sparkle('230,240,255'), st.x - 22, y - 22, 44, 44); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
      }
      banner(S, ctx, D, now);
    },
    onRelease(S, held) {
      const D = S.data;
      if (held < S.STAGES[1]) return undefined;
      D.fade = { t: S.now }; D.star = { t: S.now, x: S.cx, y: S.cy };
      for (let k = 0; k < (S.reduceMotion ? 20 : 60); k++) { const a = rand(0, TAU), r = rand(0, S.R * 1.6); fxAdd(D, { kind: 'sparkle', x: S.cx + Math.cos(a) * r, y: S.cy + Math.sin(a) * r, vx: rand(-0.4, 0.4), vy: -rand(0.5, 2), drag: 0.99, t: S.now, life: rand(1500, 3200), s: rand(3, 7), rgb: pick(['200,220,255', '255,230,170']) }); }
      if (held > S.STAGES[3]) D.banner = { t: S.now, life: 3400, text: 'and the starlight fades', fill: 'rgba(220,232,255,1)', stroke: 'rgba(5,10,30,0.8)', size: 30, y: S.H * 0.2 };
      return false;
    },
    hud(S) {
      const D = S.data, fam = D.fam || [1, 1], a = D.alpha, off = a - GOLD_DEG;
      if (D.fade) return 'the leaves let go · light fades from the world and the forest keeps the count';
      if (Math.abs(off) < 0.02) return `divergence ${a.toFixed(3)}° = 360°/φ² · ${Math.floor(D.N)} leaves · spirals ${fam[0]} & ${fam[1]} (Fibonacci, always) · the most irrational angle shades no leaf`;
      return `divergence ${a.toFixed(3)}° (${off > 0 ? '+' : ''}${off.toFixed(2)}°) ≈ ${D.pLo}/${fam[0]} turn → ${fam[0]} straight spokes and gaps · rational angles waste sunlight · centre the pointer to heal it`;
    }
  });

  /* ======================= 5. SPELLBOOK ======================= */
  const RUNE_SCRIPT = makeScript(0xB00C, 16, 'forge');
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  // {n/k}: join every k-th of n points. If gcd(n, k) = g > 1 it is not one stroke but a compound of g copies of {n/g / k/g}.
  function starPoly(ctx, cx, cy, r, n, k, rot, prog) {
    const g = gcd(n, k), m = n / g; let left = prog * n;
    const P = (i) => { const a = rot + i * TAU / n - Math.PI / 2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
    ctx.beginPath();
    for (let c = 0; c < g && left > 0; c++) {
      let v = c, p = P(v); ctx.moveTo(p[0], p[1]);
      for (let e = 0; e < m && left > 0; e++) { const w = (v + k) % n, q = P(w), f = Math.min(1, left); ctx.lineTo(lerp(p[0], q[0], f), lerp(p[1], q[1], f)); left -= 1; v = w; p = q; }
    }
    ctx.stroke();
  }
  const SPELL_POLYS = [[5, 2, 0.98, 0, 280], [7, 3, 0.78, 1, 190], [6, 2, 0.56, 2, 50], [9, 4, 0.98, 2, 160], [12, 5, 0.88, 3, 300], [16, 6, 0.68, 3, 20]];
  const SLOT_MAX = [0, 4, 3, 2];
  function fireballSprite() {
    if (fireballSprite.c) return fireballSprite.c;
    const c = mk(256, 256), x = c.getContext('2d'), g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(0.25, 'rgba(255,235,150,1)'); g.addColorStop(0.55, 'rgba(255,140,40,0.9)'); g.addColorStop(0.85, 'rgba(200,40,10,0.55)'); g.addColorStop(1, 'rgba(120,10,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    return (fireballSprite.c = c);
  }
  function bookLayer(S) {
    const bw = Math.min(S.W * 0.46, 560), bh = bw * 0.26, bx = S.cx - bw / 2, by = S.H - bh - 14;
    const c = layer(S, 'book', S.W, S.H, (x) => {
      x.fillStyle = '#2a1208'; x.beginPath(); x.moveTo(bx - 14, by + bh + 10); x.lineTo(bx + bw + 14, by + bh + 10); x.lineTo(bx + bw + 6, by - 4); x.lineTo(bx - 6, by - 4); x.closePath(); x.fill(); // cover
      for (const side of [0, 1]) {
        const x0 = side ? S.cx : bx, gr = x.createLinearGradient(x0, 0, x0 + bw / 2, 0);
        gr.addColorStop(side ? 0 : 1, 'rgba(120,90,60,1)'); gr.addColorStop(side ? 0.12 : 0.88, 'rgba(225,205,165,1)'); gr.addColorStop(side ? 1 : 0, 'rgba(240,225,190,1)');
        x.fillStyle = gr; x.beginPath(); x.moveTo(S.cx, by + 6); x.quadraticCurveTo(S.cx + (side ? 1 : -1) * bw * 0.25, by - 8, side ? bx + bw : bx, by); x.lineTo(side ? bx + bw : bx, by + bh); x.quadraticCurveTo(S.cx + (side ? 1 : -1) * bw * 0.25, by + bh - 10, S.cx, by + bh + 4); x.closePath(); x.fill();
      }
      const q = prng(31); // invented script lines and a diagram
      for (let row = 0; row < 7; row++) for (const side of [0, 1]) {
        if (side === 0 && row > 1 && row < 6) continue;
        let px = (side ? S.cx + 16 : bx + 18); const end = side ? bx + bw - 16 : S.cx - 16, py = by + 12 + row * (bh - 22) / 6;
        while (px < end - 10) { const gi = Math.floor(q() * 16), s = 9; x.drawImage(scriptSprite('book', RUNE_SCRIPT, gi, '60,30,20', '40,20,10', 0, 32), px, py - s / 2, s, s); px += s * (0.8 + q() * 0.4); if (q() < 0.18) px += 6; }
      }
      x.strokeStyle = 'rgba(120,20,30,0.75)'; x.lineWidth = 1; const dx = bx + bw * 0.25, dy = by + bh * 0.52, dr = bh * 0.3;
      x.beginPath(); x.arc(dx, dy, dr, 0, TAU); x.stroke(); starPoly(x, dx, dy, dr, 7, 3, 0, 1);
      x.strokeStyle = 'rgba(60,20,10,0.6)'; x.beginPath(); x.moveTo(S.cx, by + 6); x.lineTo(S.cx, by + bh + 4); x.stroke();
      x.fillStyle = '#7a1018'; x.fillRect(S.cx - 3, by + bh, 6, 26); // ribbon bookmark
    });
    return { c, bx, by, bw, bh };
  }
  addMode({
    id: 'fa_spell', name: 'SPELLBOOK', glyphs: SCRIPT_GLYPHS,
    base: [265, 40, 82], palette: [[275, 90, 70], [190, 100, 64], [45, 100, 64], [320, 95, 68]],
    links: ['sigil', 'glyphs', 'beam', 'lightning'], opaque: true, count: 72, pageBg: ['#140a2e', '#05030f'],
    shapes: ['sphere', 'dodecahedron', 'compound_five_tetrahedra', 'great_dodecahedron', 'small_stellated_dodecahedron', 'stella_octangula', 'rhombicosidodecahedron', 'cell24'],
    init(S) { Object.assign(S.data, { fx: [], slots: [0, 4, 3, 2], lastRegen: S.now, flip: null, nextFlip: S.now + 4000, prog: SPELL_POLYS.map(() => 0), tilt: 0.4, fb: null, bolt: null, casts: 0, fizzle: 0 }); },
    update(S, now, dt) {
      const D = S.data, k = dt / 16.7;
      if (now - D.lastRegen > 10000) { D.lastRegen = now; for (let l = 1; l <= 3; l++) if (D.slots[l] < SLOT_MAX[l]) { D.slots[l]++; break; } } // a short rest
      const want = S.holding ? 1 : 0.38 + (S.ptrInside ? 0.12 * (1 - Math.abs(S.ptr.y - S.cy) / S.H) : 0);
      D.tilt = lerp(D.tilt, want, 1 - Math.pow(0.93, k));
      SPELL_POLYS.forEach((p, i) => { const on = (S.holding ? S.stage : -1) >= p[3] || (!S.holding && p[3] === 0); D.prog[i] = clamp(D.prog[i] + (on ? 1 : -1.5) * dt / 800, 0, 1); });
      if (now > D.nextFlip && !D.flip) { D.flip = { t: now, dur: S.holding ? 420 - 90 * S.stage : 700 }; D.nextFlip = now + (S.holding ? 450 - 100 * S.stage : rand(5000, 8000)); }
      if (D.flip && now - D.flip.t > D.flip.dur) D.flip = null;
      if (S.ptrInside && pspeed(S) > 2 && Math.random() < 0.5) fxAdd(D, { kind: 'sparkle', x: S.ptr.x, y: S.ptr.y, vx: rand(-0.5, 0.5), vy: rand(-0.8, 0), drag: 0.97, t: now, life: 700, s: rand(3, 6), rgb: pick(['200,160,255', '140,230,255']) });
      const b = D.bolt;
      if (b && now - b.t > b.dur) { D.bolt = null; D.fb = { t: now, x: b.x1, y: b.y1, L: b.L }; S.shake(6 + 3 * b.L); for (let q = 0; q < (S.reduceMotion ? 20 : 60); q++) { const a = rand(0, TAU), v = rand(4, 12); fxAdd(D, { kind: 'glow', x: b.x1, y: b.y1, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.05, drag: 0.95, t: now, life: rand(600, 1300), s: rand(6, 14), a: 0.8, T: 1200, cool: 0.5 }); } }
      if (D.fb && now - D.fb.t > 2600) D.fb = null;
      if (D.fb) { const t = (now - D.fb.t) / 1000; if (t > 0.6 && Math.random() < 0.5 * k) { const a = rand(0, TAU), R = fbRadius(S, D.fb.L, t); fxAdd(D, { kind: 'steam', x: D.fb.x + Math.cos(a) * R * 0.6, y: D.fb.y + Math.sin(a) * R * 0.6, vx: 0, vy: -0.8, g: -0.01, drag: 0.99, t: now, life: 1800, s: R * 0.35, a: 0.18, rgb: '60,50,60' }); } }
      fxStep(S, D, dt, (p) => { if (p.cool) p.T -= p.cool * dt; });
    },
    background(S, ctx, now) {
      const D = S.data;
      blit(ctx, layer(S, 'study', S.W, S.H, (x, w, h) => {
        let g = x.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, Math.max(w, h) * 0.7); g.addColorStop(0, '#22124a'); g.addColorStop(0.6, '#0f0824'); g.addColorStop(1, '#040210');
        x.fillStyle = g; x.fillRect(0, 0, w, h);
        const q = prng(4); // bookshelves in the dark
        for (const side of [0, 1]) for (let row = 0; row < 6; row++) {
          const y = h * 0.08 + row * h * 0.15; let px = side ? w * 0.82 : 12; const end = side ? w - 12 : w * 0.18;
          x.fillStyle = 'rgba(30,16,40,0.9)'; x.fillRect(side ? w * 0.82 : 8, y + h * 0.13, w * 0.18, 4);
          while (px < end) { const bw2 = 6 + q() * 10, bh2 = h * 0.08 + q() * h * 0.045; x.fillStyle = `hsla(${[270, 330, 210, 30][Math.floor(q() * 4)]},35%,${10 + q() * 10}%,0.9)`; x.fillRect(px, y + h * 0.13 - bh2, bw2 - 1, bh2); px += bw2; }
        }
      }));
      const B = bookLayer(S); blit(ctx, B.c);
      ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, '190,140,255', S.cx, B.by + B.bh * 0.4, B.bw * 0.55, 0.18 + 0.25 * power(S)); ctx.globalCompositeOperation = 'source-over';
      if (D.flip) { // a page turning about the spine
        const t = (now - D.flip.t) / D.flip.dur, ang = t * Math.PI, sx = Math.cos(ang), w2 = B.bw / 2;
        ctx.save(); ctx.translate(S.cx, 0); ctx.scale(sx, 1);
        const sh = 0.75 + 0.25 * Math.abs(sx);
        ctx.fillStyle = `rgb(${Math.round(235 * sh)},${Math.round(220 * sh)},${Math.round(185 * sh)})`;
        ctx.beginPath(); ctx.moveTo(0, B.by + 6); ctx.quadraticCurveTo(w2 * 0.5, B.by - 16 - 20 * Math.sin(ang), w2, B.by - 4 - 18 * Math.sin(ang)); ctx.lineTo(w2, B.by + B.bh - 6 - 18 * Math.sin(ang)); ctx.quadraticCurveTo(w2 * 0.5, B.by + B.bh - 14, 0, B.by + B.bh + 4); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(90,60,40,0.5)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
      }
    },
    ambient(S, ctx, now) {
      const D = S.data, k = D.tilt, Rc = S.R * 1.5, rot = (S.ptrInside ? (S.ptr.x - S.cx) / S.W * 0.4 : 0);
      ctx.save(); ctx.translate(S.cx, S.cy); ctx.rotate(rot); ctx.scale(1, k);
      ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      const p = power(S), pulse = 0.75 + 0.25 * Math.sin(now * 0.004 * (1 + S.stage));
      ctx.strokeStyle = `rgba(190,150,255,${0.35 + 0.4 * p})`; ctx.lineWidth = 1.5 / Math.max(0.4, k);
      ctx.beginPath(); ctx.arc(0, 0, Rc, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, Rc * 1.1, 0, TAU); ctx.stroke();
      ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i < 72; i++) { const a = i / 72 * TAU + now * 0.0001, l = i % 6 ? 0.03 : 0.07; ctx.moveTo(Math.cos(a) * Rc * 1.1, Math.sin(a) * Rc * 1.1); ctx.lineTo(Math.cos(a) * Rc * (1.1 - l), Math.sin(a) * Rc * (1.1 - l)); } ctx.stroke();
      for (let i = 0; i < 24; i++) { const a = i / 24 * TAU - now * 0.00015, spr = scriptSprite('rune', RUNE_SCRIPT, i, '190,160,255', '245,235,255', 1); ctx.save(); ctx.translate(Math.cos(a) * Rc * 1.05, Math.sin(a) * Rc * 1.05); ctx.rotate(a + Math.PI / 2); ctx.globalAlpha = 0.55 + 0.4 * p; ctx.drawImage(spr, -10, -10, 20, 20); ctx.restore(); }
      ctx.globalAlpha = 1;
      SPELL_POLYS.forEach(([n, kk, rf, , hue], i) => {
        const pr = D.prog[i]; if (pr <= 0.001) return;
        const r = Rc * rf, sp = (i % 2 ? -1 : 1) * 0.00012 * (1 + i * 0.3) * (1 + S.stage);
        ctx.strokeStyle = `hsla(${hue},100%,72%,${(0.45 + 0.45 * p) * pulse})`; ctx.lineWidth = (1.4 + S.stage * 0.4) / Math.max(0.4, k);
        starPoly(ctx, 0, 0, r, n, kk, now * sp, pr);
        if (pr > 0.99 && i > 0) { ctx.beginPath(); ctx.arc(0, 0, r * Math.cos(Math.PI * kk / n), 0, TAU); ctx.globalAlpha = 0.35; ctx.stroke(); ctx.globalAlpha = 1; }
      });
      ctx.restore();
      ctx.font = '11px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; // Schläfli labels
      SPELL_POLYS.forEach(([n, kk, rf, , hue], i) => { if (D.prog[i] < 0.5) return; const g = gcd(n, kk); ctx.fillStyle = `hsla(${hue},100%,78%,${D.prog[i] * 0.85})`; ctx.fillText(`{${n}/${kk}}${g > 1 ? ' = ' + g + '×{' + n / g + '/' + kk / g + '}' : ''}`, S.cx + Rc * 1.18 + 8, S.cy - Rc * k * 0.9 + i * 15); });
      ctx.globalCompositeOperation = 'source-over';
    },
    drawNode(S, ctx, n, g, size, a) {
      const rgb = n.inf ? rgbS(palRGB(S, n.gen)) : '215,200,255';
      drawSprite(ctx, scriptSprite('runeN', RUNE_SCRIPT, glyphIndex(g), rgb, '255,250,255', n.inf ? 1.2 : 0.5), n.sx, n.sy, size * 1.6, a);
      return true;
    },
    warp(S, n) { // letters ride the blast front
      const fb = S.data.fb; if (!fb) return;
      const t = (S.now - fb.t) / 1000, R = fbRadius(S, fb.L, t), dx = n.sx - fb.x, dy = n.sy - fb.y, r = Math.hypot(dx, dy) + 1e-3, f = clamp(1 - t / 2.4, 0, 1);
      if (r < R) { const push = (R - r) * 0.6 * f; n.sx += dx / r * push; n.sy += dy / r * push; }
    },
    over(S, ctx, now) {
      const D = S.data, b = D.bolt;
      if (b) { const t = (now - b.t) / b.dur, x = lerp(b.x0, b.x1, t), y = lerp(b.y0, b.y1, t) - Math.sin(t * Math.PI) * 60; ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, '255,180,80', x, y, 26, 1); drawGlow(ctx, '255,250,220', x, y, 8, 1); ctx.globalCompositeOperation = 'source-over'; }
      const fb = D.fb;
      if (fb) { // Taylor–von Neumann–Sedov: R = ξ (E t² / ρ)^(1/5)
        const t = (now - fb.t) / 1000, R = fbRadius(S, fb.L, t), a = clamp(1 - t / 2.2, 0, 1);
        ctx.globalCompositeOperation = 'lighter';
        const spr = fireballSprite(), core = Math.exp(-t * 2.2) * (S.reduceMotion ? 0.5 : 1);
        ctx.globalAlpha = Math.min(1, a * 1.5) * (S.reduceMotion ? 0.6 : 1); ctx.drawImage(spr, fb.x - R, fb.y - R, R * 2, R * 2);
        if (core > 0.02) { const r2 = R * 0.62; ctx.globalAlpha = core; ctx.drawImage(spr, fb.x - r2, fb.y - r2, r2 * 2, r2 * 2); }
        for (let q = 0; q < 7; q++) { const an = q * 0.9 + t * 1.5, rr = R * (0.3 + 0.12 * Math.sin(q * 3 + t * 4)); drawGlow(ctx, q % 2 ? '255,90,20' : '255,160,40', fb.x + Math.cos(an) * rr, fb.y + Math.sin(an) * rr, R * 0.45, 0.5 * a); }
        ctx.globalAlpha = 1; ctx.strokeStyle = `rgba(255,190,120,${0.85 * a})`; ctx.lineWidth = 2 + 3 * a; ctx.beginPath(); ctx.arc(fb.x, fb.y, R * 1.04, 0, TAU); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
      fxDraw(S, ctx, D);
      banner(S, ctx, D, now);
    },
    onTap(S) { const D = S.data; if (!D.flip) { D.flip = { t: S.now, dur: 650 }; D.nextFlip = S.now + rand(5000, 8000); } },
    onRelease(S, held) {
      const D = S.data;
      if (held < S.STAGES[1]) return undefined;
      const L = clamp(S.stage || Math.floor(held / 1500), 1, 3);
      let lv = L; while (lv > 0 && !D.slots[lv]) lv--;
      if (!lv) { D.fizzle = S.now; D.banner = { t: S.now, life: 2200, text: 'FIZZLE', fill: '#b8a6d8', sub: 'no spell slots left · take a short rest', size: 40 }; for (let q = 0; q < 12; q++) fxAdd(D, { kind: 'steam', x: S.ptr.x, y: S.ptr.y, vx: rand(-1, 1), vy: rand(-1.5, 0), drag: 0.97, t: S.now, life: 1200, s: 22, a: 0.3, rgb: '120,100,140' }); return false; }
      D.slots[lv]--; D.casts++;
      D.bolt = { t: S.now, dur: 260, x0: S.cx, y0: S.cy, x1: S.ptr.x, y1: S.ptr.y, L: lv };
      if (lv === 3) D.banner = { t: S.now, life: 1800, text: 'FIREBALL', fill: '#ffcf7a', stroke: 'rgba(80,10,0,0.9)', size: 44 };
      return false;
    },
    hud(S) {
      const D = S.data, sl = [1, 2, 3].map((l) => `${l}:` + '●'.repeat(D.slots[l]) + '○'.repeat(SLOT_MAX[l] - D.slots[l])).join(' ');
      if (D.fb) { const t = (S.now - D.fb.t) / 1000, R = fbRadius(S, D.fb.L, t); return `FIREBALL lvl ${D.fb.L} · t ${t.toFixed(2)} s · R ${R.toFixed(0)} px · R = ξ(E·t²/ρ)^⅕, so R ∝ t^0.4 and E ∝ R⁵ (how G. I. Taylor read a blast's yield off photographs)`; }
      if (S.holding) {
        const i = [0, 1, 3, 4][S.stage], [n, k] = SPELL_POLYS[i], g = gcd(n, k);
        return `channeling lvl ${clamp(S.stage, 1, 3)} · drawing {${n}/${k}}: ${g === 1 ? `gcd(${n},${k}) = 1, one unbroken stroke` : `gcd = ${g}, ${g} separate {${n / g}/${k / g}}`} · slots ${sl}`;
      }
      return `spell slots ${sl} · hold to channel ({5/2} → {7/3} → {9/4}, {6/2} → {12/5}, {16/6}) · release to cast · one slot back every 10 s`;
    }
  });
  function fbRadius(S, L, t) { const E = Math.pow(2, L), A = Math.min(S.W, S.H) * 0.42 / Math.pow(8, 0.2); return A * Math.pow(E, 0.2) * Math.pow(Math.max(0, t), 0.4); }

  /* ======================= 6. NECROMANCY ======================= */
  const BONE_SCRIPT = makeScript(0xDEAD, 16, 'bone');
  const HALF = 3; // half-life of a soul, in seconds
  const LAMBDA = Math.LN2 / HALF;
  addMode({
    id: 'fa_necro', name: 'NECROMANCY', glyphs: SCRIPT_GLYPHS,
    base: [60, 15, 82], palette: [[130, 100, 58], [150, 100, 62], [95, 100, 60], [170, 90, 66]],
    links: ['roots', 'pm_tentacle', 'chain', 'lightning'], opaque: true, count: 'random', pageBg: ['#07140c', '#020503'],
    shapes: ['sphere', 'mandelbulb', 'urchin', 'great_icosahedron', 'menger', 'thomas', 'catenoid', 'dini'],
    init(S) {
      const D = S.data, fog = [];
      for (let i = 0; i < 26; i++) fog.push({ x: rand(-0.1, 1.1) * S.W, y: S.H * rand(0.62, 1.02), s: rand(120, 280), v: rand(0.1, 0.35) * (Math.random() < 0.5 ? 1 : -1), ox: 0, oy: 0 });
      const graves = []; const q = prng(13); for (let i = 0; i < 11; i++) graves.push({ x: S.W * (0.04 + 0.92 * (i + q() * 0.6) / 11), h: (40 + q() * 46) * clamp(S.H / 800, 0.6, 1.3), kind: Math.floor(q() * 3) });
      Object.assign(D, { fog, graves, souls: [], fx: [], decayed: 0, bound: false, rel: null, series: [], lastSample: 0, births: 0 });
      for (let i = 0; i < 30; i++) D.souls.push(newSoul(S, D, true));
    },
    update(S, now, dt) {
      const D = S.data, k = dt / 16.7, sdt = dt / 1000;
      D.simT = (D.simT || 0) + sdt; // the clock the souls actually decay by (frames can be throttled)
      // births: idle graves leak souls at β = 30·λ per second (so the crowd settles at N = β/λ = 30); a necromancer pulls many more
      const beta = S.holding ? 30 * LAMBDA * (1 + 4 * S.stage) : D.rel ? 0 : 30 * LAMBDA;
      D.births += beta * sdt;
      while (D.births >= 1) { D.births--; if (D.souls.length < 260) D.souls.push(newSoul(S, D, false)); }
      const pDecay = 1 - Math.exp(-LAMBDA * sdt), bound = S.holding;
      D.souls = D.souls.filter((s) => {
        s.ph += 0.05 * k;
        let tx = s.hx, ty = s.hy;
        if (bound && S.active.length) { const nd = S.active[s.id % S.active.length]; if (nd.inf) { tx = nd.sx + Math.cos(s.ph) * 18; ty = nd.sy + Math.sin(s.ph) * 18; } }
        s.vx += (tx - s.x) * 0.0016 * k + Math.cos(s.ph * 1.3) * 0.04 * k; s.vy += (ty - s.y) * 0.0016 * k + Math.sin(s.ph) * 0.04 * k;
        if (S.ptrInside) { const dx = s.x - S.ptr.x, dy = s.y - S.ptr.y, d = Math.hypot(dx, dy) + 1; if (d < 110) { s.vx += dx / d * 0.25 * k; s.vy += dy / d * 0.25 * k; } } // they flinch from the living
        s.vx *= 0.96; s.vy *= 0.96; s.x += s.vx * k; s.y += s.vy * k;
        s.trail.unshift(s.x, s.y); if (s.trail.length > 12) s.trail.length = 12;
        if (!bound && Math.random() < pDecay) { // memoryless: every soul has the same chance each instant
          D.decayed++;
          fxAdd(D, { kind: 'sparkle', x: s.x, y: s.y, vx: 0, vy: -0.6, t: now, life: 600, s: 9, rgb: '150,255,170' });
          if (Math.random() < 0.5) S.spawn(s.x, s.y, rand(-0.3, 0.3), -rand(0.6, 1.2), 'rgba(190,255,200,1)', 1400, 16, { glyph: pick(NECRO_RISE), drag: 0.99 });
          return false;
        }
        return true;
      });
      if (now - D.lastSample > 100) { D.lastSample = now; D.series.push(D.souls.length); if (D.series.length > 150) D.series.shift(); if (D.rel) D.rel.pts.push([D.simT - D.rel.s0, D.souls.length]); }
      if (D.rel && D.simT - D.rel.s0 > 15) D.rel = null;
      for (const f of D.fog) { // mist drifts; the pointer parts it
        f.x += f.v * k; if (f.x > S.W + f.s) f.x = -f.s; if (f.x < -f.s) f.x = S.W + f.s;
        let px = 0, py = 0;
        if (S.ptrInside) { const dx = f.x - S.ptr.x, dy = f.y - S.ptr.y, d = Math.hypot(dx, dy) + 1; if (d < f.s * 1.3) { const m = (1 - d / (f.s * 1.3)) * f.s * 0.6; px = dx / d * m; py = dy / d * m; } }
        f.ox = lerp(f.ox, px, 0.06); f.oy = lerp(f.oy, py, 0.06);
      }
      if (S.holding && S.stage >= 1 && Math.random() < 0.08 * S.stage * k) { const g = pick(D.graves); S.spawn(g.x + rand(-10, 10), S.H - 30, rand(-0.2, 0.2), -rand(0.8, 1.6), 'rgba(220,230,210,1)', 2200, 20, { glyph: pick(NECRO_RISE), drag: 0.995 }); }
      fxStep(S, D, dt);
    },
    background(S, ctx, now) {
      const D = S.data;
      blit(ctx, layer(S, 'yard', S.W, S.H, (x, w, h) => {
        let g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#04100a'); g.addColorStop(0.6, '#0b1f14'); g.addColorStop(1, '#030805');
        x.fillStyle = g; x.fillRect(0, 0, w, h);
        const mx = w * 0.22, my = h * 0.2, mr = Math.min(w, h) * 0.09; // the moon, with a green halo
        g = x.createRadialGradient(mx, my, mr, mx, my, mr * 5); g.addColorStop(0, 'rgba(170,230,190,0.25)'); g.addColorStop(1, 'rgba(170,230,190,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
        g = x.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, 0, mx, my, mr); g.addColorStop(0, '#f2f8e8'); g.addColorStop(1, '#a8c0a4'); x.fillStyle = g; x.beginPath(); x.arc(mx, my, mr, 0, TAU); x.fill();
        const q = prng(66); x.fillStyle = 'rgba(110,140,110,0.35)'; for (let i = 0; i < 7; i++) { const a = q() * TAU, rr = q() * mr * 0.7; x.beginPath(); x.arc(mx + Math.cos(a) * rr, my + Math.sin(a) * rr, mr * (0.08 + q() * 0.12), 0, TAU); x.fill(); }
        const branch = (bx, by, len, ang, depth) => { if (depth === 0 || len < 4) return; const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len; x.lineWidth = depth * 1.3; x.beginPath(); x.moveTo(bx, by); x.lineTo(ex, ey); x.stroke(); branch(ex, ey, len * 0.72, ang - 0.35 - q() * 0.3, depth - 1); branch(ex, ey, len * 0.68, ang + 0.3 + q() * 0.35, depth - 1); };
        x.strokeStyle = '#020604'; x.lineCap = 'round'; branch(w * 0.1, h, h * 0.2, -Math.PI / 2 + 0.1, 8); branch(w * 0.93, h, h * 0.16, -Math.PI / 2 - 0.15, 7);
        x.fillStyle = '#030a06'; x.beginPath(); x.moveTo(0, h); for (let i = 0; i <= 40; i++) x.lineTo(i / 40 * w, h * 0.9 - Math.sin(i * 0.5) * 8 - q() * 6); x.lineTo(w, h); x.fill(); // the hill
        x.strokeStyle = 'rgba(10,20,14,1)'; x.lineWidth = 2; x.beginPath(); for (let px = 0; px < w; px += 16) { x.moveTo(px, h * 0.88); x.lineTo(px, h * 0.8); } x.moveTo(0, h * 0.82); x.lineTo(w, h * 0.82); x.stroke(); // iron fence
        for (const gv of D.graves) { // headstones with a moonlit edge
          const gx2 = gv.x, gy = h * 0.92, hh = gv.h, ww = hh * 0.55;
          x.fillStyle = '#0d1a12'; x.strokeStyle = 'rgba(160,220,170,0.35)'; x.lineWidth = 1.2; x.beginPath();
          if (gv.kind === 0) { x.moveTo(gx2 - ww / 2, gy); x.lineTo(gx2 - ww / 2, gy - hh + ww / 2); x.arc(gx2, gy - hh + ww / 2, ww / 2, Math.PI, 0); x.lineTo(gx2 + ww / 2, gy); }
          else if (gv.kind === 1) { const t = ww * 0.28; x.moveTo(gx2 - t, gy); x.lineTo(gx2 - t, gy - hh * 0.62); x.lineTo(gx2 - ww * 0.6, gy - hh * 0.62); x.lineTo(gx2 - ww * 0.6, gy - hh * 0.8); x.lineTo(gx2 - t, gy - hh * 0.8); x.lineTo(gx2 - t, gy - hh); x.lineTo(gx2 + t, gy - hh); x.lineTo(gx2 + t, gy - hh * 0.8); x.lineTo(gx2 + ww * 0.6, gy - hh * 0.8); x.lineTo(gx2 + ww * 0.6, gy - hh * 0.62); x.lineTo(gx2 + t, gy - hh * 0.62); x.lineTo(gx2 + t, gy); }
          else { x.moveTo(gx2 - ww * 0.4, gy); x.lineTo(gx2 - ww * 0.25, gy - hh * 1.2); x.lineTo(gx2, gy - hh * 1.4); x.lineTo(gx2 + ww * 0.25, gy - hh * 1.2); x.lineTo(gx2 + ww * 0.4, gy); }
          x.closePath(); x.fill(); x.stroke();
          x.drawImage(scriptSprite('stone', BONE_SCRIPT, Math.floor(gx2) % 16, '90,130,100', '120,160,130', 0, 32), gx2 - 7, gy - hh * 0.5 - 7, 14, 14);
        }
      }));
      // the mist (behind the souls)
      ctx.globalCompositeOperation = 'source-over';
      const fogS = soft('150,200,165', 1);
      for (let i = 0; i < D.fog.length; i += 2) { const f = D.fog[i]; ctx.globalAlpha = 0.16; ctx.drawImage(fogS, f.x + f.ox - f.s, f.y + f.oy - f.s * 0.5, f.s * 2, f.s); }
      ctx.globalAlpha = 1;
      if (S.holding && S.stage >= 2) { ctx.globalCompositeOperation = 'lighter'; for (const gv of D.graves) drawGlow(ctx, '90,255,140', gv.x, S.H * 0.92, 50, 0.15 * S.stage * (0.7 + 0.3 * Math.sin(now * 0.01 + gv.x))); ctx.globalCompositeOperation = 'source-over'; }
    },
    ambient(S, ctx) {
      const D = S.data;
      ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (const s of D.souls) { // a wisp: a glow with a fading tail
        const tr = s.trail;
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(110,255,150,0.18)'; ctx.beginPath(); ctx.moveTo(tr[0], tr[1]); for (let i = 2; i < tr.length; i += 2) ctx.lineTo(tr[i], tr[i + 1]); ctx.stroke();
        drawGlow(ctx, '120,255,160', s.x, s.y, 14, 0.75); drawGlow(ctx, '230,255,235', s.x, s.y, 4, 0.9);
      }
      ctx.globalCompositeOperation = 'source-over';
    },
    under(S, ctx) { if (!S.holding) return; ctx.globalCompositeOperation = 'lighter'; for (const n of S.active) if (n.inf) drawGlow(ctx, '80,255,130', n.sx, n.sy - 6, 26, 0.35); ctx.globalCompositeOperation = 'source-over'; },
    drawNode(S, ctx, n, g, size, a) {
      const rgb = n.inf ? rgbS(palRGB(S, n.gen)) : '225,220,195';
      drawSprite(ctx, scriptSprite('bone', BONE_SCRIPT, glyphIndex(g), rgb, n.inf ? '235,255,240' : '250,248,235', n.inf ? 1.3 : 0.3), n.sx, n.sy, size * 1.6, a);
      return true;
    },
    over(S, ctx, now) {
      const D = S.data;
      const fogS = soft('170,215,180', 1); // the near mist, in front of everything
      for (let i = 1; i < D.fog.length; i += 2) { const f = D.fog[i]; ctx.globalAlpha = 0.13; ctx.drawImage(fogS, f.x + f.ox - f.s, f.y + f.oy - f.s * 0.5, f.s * 2, f.s); }
      ctx.globalAlpha = 1;
      fxDraw(S, ctx, D);
      // the decay chart: live count against the law
      const w = 230, h = 110, x0 = S.W - w - 24, y0 = 70, top = Math.max(40, ...D.series, D.rel ? D.rel.N0 : 0) * 1.1;
      ctx.fillStyle = 'rgba(2,10,5,0.7)'; ctx.fillRect(x0 - 8, y0 - 22, w + 16, h + 40);
      ctx.strokeStyle = 'rgba(140,255,170,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(x0 - 8, y0 - 22, w + 16, h + 40);
      ctx.font = '10px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      const Y = (v) => y0 + h - v / top * h;
      if (D.rel) {
        const T = 12, X = (t) => x0 + t / T * w, N0 = D.rel.N0;
        ctx.fillStyle = 'rgba(140,255,170,0.12)'; ctx.beginPath(); // ±√N band (Poisson-ish spread)
        for (let i = 0; i <= 40; i++) { const t = i / 40 * T, e = N0 * Math.exp(-LAMBDA * t); ctx.lineTo(X(t), Y(e + Math.sqrt(e))); }
        for (let i = 40; i >= 0; i--) { const t = i / 40 * T, e = N0 * Math.exp(-LAMBDA * t); ctx.lineTo(X(t), Y(Math.max(0, e - Math.sqrt(e)))); }
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,240,170,0.9)'; ctx.beginPath(); for (let i = 0; i <= 40; i++) { const t = i / 40 * T; if (i) ctx.lineTo(X(t), Y(N0 * Math.exp(-LAMBDA * t))); else ctx.moveTo(X(t), Y(N0)); } ctx.stroke();
        ctx.strokeStyle = 'rgba(140,255,170,0.25)'; ctx.setLineDash([3, 3]); ctx.beginPath(); for (let k = 1; k <= 3; k++) { ctx.moveTo(X(k * HALF), y0); ctx.lineTo(X(k * HALF), y0 + h); } ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(140,255,170,0.95)'; for (const p of D.rel.pts) if (p[0] <= T) ctx.fillRect(X(p[0]) - 1, Y(p[1]) - 1, 2.5, 2.5);
        ctx.fillStyle = 'rgba(200,255,210,0.9)'; ctx.fillText(`N(t) vs N₀·2^(−t/${HALF}s) · dashes: half-lives`, x0, y0 - 8);
      } else {
        ctx.strokeStyle = 'rgba(140,255,170,0.9)'; ctx.beginPath(); D.series.forEach((v, i) => { const X = x0 + i / 149 * w; if (i) ctx.lineTo(X, Y(v)); else ctx.moveTo(X, Y(v)); }); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,240,170,0.6)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(x0, Y(30)); ctx.lineTo(x0 + w, Y(30)); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(200,255,210,0.9)'; ctx.fillText(S.holding ? 'N rising: decay suspended' : 'N over 15 s · dashed: N = β/λ = 30', x0, y0 - 8);
      }
      banner(S, ctx, D, now);
    },
    onRelease(S, held) {
      const D = S.data;
      if (held < S.STAGES[1]) return undefined;
      D.rel = { t: S.now, s0: D.simT || 0, N0: D.souls.length, pts: [] };
      for (const s of D.souls) { const dx = s.x - S.cx, dy = s.y - S.cy, d = Math.hypot(dx, dy) + 1; s.vx += dx / d * 6; s.vy += dy / d * 6; s.hx = rand(0.05, 0.95) * S.W; s.hy = rand(0.2, 0.8) * S.H; }
      S.ring(S.cx, S.cy, S.R * 2, [130, 100, 60], 1200);
      if (held > S.STAGES[3]) D.banner = { t: S.now, life: 2400, text: 'THE CONTRACT ENDS', fill: '#a8ffbf', stroke: 'rgba(0,20,8,0.9)', size: 34, y: S.H * 0.2 };
      return false;
    },
    hud(S) {
      const D = S.data, N = D.souls.length;
      if (S.holding) return `binding souls · N = ${N} · decay suspended by contract · graves give up ${fmt(30 * LAMBDA * (1 + 4 * S.stage), 1)} souls/s`;
      if (D.rel) { const t = D.simT - D.rel.s0, e = D.rel.N0 * Math.exp(-LAMBDA * t); return `N = ${N} · expected ${e.toFixed(1)} ± ${Math.sqrt(e).toFixed(1)} · ${(t / HALF).toFixed(1)} half-lives · no soul knows when; together they keep perfect time`; }
      return `N = ${N} souls · T½ = ${HALF} s · λ = ln2/T½ = ${LAMBDA.toFixed(3)} s⁻¹ · equilibrium N = β/λ = 30 · ${fmt(D.decayed)} passed on · hold to bind, release to let go`;
    }
  });
  const NECRO_RISE = G('†‡✝☠☽∴', '†‡+∴');
  function newSoul(S, D, anywhere) {
    const g = pick(D.graves), x = anywhere ? rand(0, S.W) : g.x + rand(-8, 8), y = anywhere ? rand(S.H * 0.3, S.H * 0.85) : S.H * 0.9;
    return { id: Math.floor(Math.random() * 1e6), x, y, vx: rand(-0.5, 0.5), vy: anywhere ? 0 : -rand(1, 2.5), ph: rand(0, TAU), hx: rand(0.05, 0.95) * S.W, hy: rand(0.25, 0.8) * S.H, trail: [x, y] };
  }

})(window.SPHERE);
