/* The Sphere: punk pack. Seven "-punk" genres as cinematic scenes, each with a real mechanism underneath:
 *   STEAMPUNK  a brass gear train that really meshes (ω1·N1 = ω2·N2), a slider-crank and a boiler gauge
 *   FROSTPUNK  a heat generator in a frozen waste (Stefan–Boltzmann radiation, Newton's law of cooling)
 *   WHALEPUNK  sky-whales over a cloud sea, a live whale-song spectrogram and SOFAR rays in a Munk profile
 *   DIESELPUNK an art-deco night with searchlights and a live Diesel-cycle P–V loop
 *   SOLARPUNK  a green city whose solar panels track the pointer-sun (P = P0·cos θ) while vines take the letters
 *   BIOPUNK    a gene-splicing lab: logistic growth in petri dishes, a helix with point mutations and a Cas9 cut
 *   ATOMPUNK   1950s chrome optimism: the radon-222 decay chain solved live, a Geiger counter and cloud-chamber tracks
 * Original work: the names are genre names, everything drawn is procedural. Own web styles use the pk_ prefix. */
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
  // A soft puff (steam, cloud, smoke): flatter falloff than a glow.
  let PUFF = null;
  function puffSprite() {
    if (PUFF) return PUFF;
    PUFF = mk(64, 64); const x = PUFF.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.45, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return PUFF;
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
  function repel(S, o, r, k) {
    if (!hasPtr(S)) return 0;
    const dx = o.x - S.ptr.x, dy = o.y - S.ptr.y, d2 = dx * dx + dy * dy;
    if (d2 > r * r || d2 < 1) return 0;
    const d = Math.sqrt(d2), f = (1 - d / r) * k * (1 + Math.min(4, pspeed(S) * 0.25));
    o.vx += dx / d * f; o.vy += dy / d * f;
    return 1 - d / r;
  }
  // Puffs: soft sprites that grow and fade (steam, smoke, cloud spray, spores). A capped pool in S.data.
  function puff(S, o) {
    const l = S.data.puffs || (S.data.puffs = []);
    if (l.length < 340) l.push(Object.assign({ t: S.now, life: 2000, r0: 6, r1: 40, vx: 0, vy: 0, a: 0.4, rgb: null, drag: 0.985, g: 0, wind: 0 }, o));
  }
  function drawPuffs(S, ctx, dt, comp) {
    const l = S.data.puffs;
    if (!l || !l.length) return;
    const now = S.now, k = dt / 16.7, spr = puffSprite();
    S.data.puffs = l.filter((p) => now - p.t < p.life);
    ctx.globalCompositeOperation = comp || 'source-over';
    for (const p of S.data.puffs) {
      const u = (now - p.t) / p.life, dk = Math.pow(p.drag, k);
      p.vx = p.vx * dk + p.wind * k; p.vy = p.vy * dk + p.g * k;
      repel(S, p, 110, 0.5);
      p.x += p.vx * k; p.y += p.vy * k;
      const r = lerp(p.r0, p.r1, 1 - Math.pow(1 - u, 2)), a = p.a * (u < 0.1 ? u / 0.1 : 1) * (1 - u);
      if (a < 0.01) continue;
      ctx.globalAlpha = a;
      if (p.rgb) ctx.drawImage(glow(p.rgb, 32), p.x - r, p.y - r, r * 2, r * 2);
      else ctx.drawImage(spr, p.x - r, p.y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  function hsl2rgb(h, s, l) {
    s /= 100; l /= 100; h = ((h % 360) + 360) % 360;
    const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
  }
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

  /* ======================= 1. STEAMPUNK ======================= */
  // The gear train is a tree rooted at the great wheel behind the sphere. a: direction from the parent (deg), comp: same shaft.
  const ST_GEARS = [
    { id: 'GREAT', n: 72, hue: 30, l: 0.55 },
    { id: 'D', n: 18, p: 0, a: 215, hue: 40 },
    { id: 'C', n: 28, p: 1, a: 160, hue: 22 },
    { id: 'B2', n: 14, p: 2, a: 110, hue: 44 },
    { id: 'B', n: 40, p: 3, comp: true, hue: 34, l: 0.8 },
    { id: 'A', n: 12, p: 4, a: 120, hue: 46 },
    { id: 'F', n: 24, p: 0, a: -20, hue: 24 }
  ];
  const ST_DRAW = [0, 4, 2, 1, 6, 3, 5]; // back to front: compound wheel B sits behind C, its pinion B2 in front
  // Tooth k of a gear sits at local angle 2πk/N. Gear child meshes parent along direction α when
  // θc = -(Np/Nc)·θp + α + π − (π − α·Np)/Nc  (a tooth faces a gap on the line of centres; derived from u_p + u_c ≡ ½).
  function stLayout(S) {
    const Rb = baseR(S), m = Rb * 2.2 / 72, gs = [];
    ST_GEARS.forEach((g, i) => {
      const o = Object.assign({}, g, { r: m * g.n / 2 });
      if (i === 0) { o.x = S.cx; o.y = S.cy; o.s = 1; o.c = 0; } else {
        const P = gs[g.p];
        if (g.comp) { o.x = P.x; o.y = P.y; o.s = P.s; o.c = P.c; } else {
          const al = g.a * Math.PI / 180, d = P.r + o.r, q = P.n / g.n;
          o.x = P.x + Math.cos(al) * d; o.y = P.y + Math.sin(al) * d;
          o.s = -q * P.s; o.c = -q * P.c + al + Math.PI - (Math.PI - al * P.n) / g.n;
        }
      }
      gs.push(o);
    });
    return { m, gs, A: gs[5], F: gs[6], key: S.W + 'x' + S.H + '@' + S.DPR };
  }
  function gearSprite(S, g, m) {
    const N = g.n, r = g.r, ro = r + m, ri = r - 1.25 * m, h = Math.ceil(ro + 3);
    const c = mk(h * 2 * S.DPR, h * 2 * S.DPR), x = c.getContext('2d');
    x.scale(S.DPR, S.DPR); x.translate(h, h);
    const phi = TAU / N; x.beginPath();
    for (let k = 0; k < N; k++) {
      const a = k * phi, pts = [[ri, a - 0.5 * phi], [ri, a - 0.3 * phi], [ro, a - 0.15 * phi], [ro, a + 0.15 * phi], [ri, a + 0.3 * phi]];
      pts.forEach((p, j) => { const X = Math.cos(p[1]) * p[0], Y = Math.sin(p[1]) * p[0]; if (k || j) x.lineTo(X, Y); else x.moveTo(X, Y); });
    }
    x.closePath();
    const L = g.l || 1, gr = x.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.05, 0, 0, ro);
    gr.addColorStop(0, `hsl(${g.hue},70%,${74 * L}%)`); gr.addColorStop(0.5, `hsl(${g.hue},62%,${46 * L}%)`); gr.addColorStop(1, `hsl(${g.hue},60%,${22 * L}%)`);
    x.fillStyle = gr; x.fill(); x.strokeStyle = 'rgba(30,16,4,0.9)'; x.lineWidth = 1; x.stroke();
    const rin = Math.max(r * 0.3, m * 2.6), rout = ri - m * 1.3;
    x.globalCompositeOperation = 'destination-out';
    if (rout - rin > m * 2.2) { // spoked wheel: cut the windows between spokes
      const ns = N >= 48 ? 6 : N >= 28 ? 5 : 4, sw = Math.max(m * 0.9, r * 0.07);
      for (let k = 0; k < ns; k++) {
        const a0 = k * TAU / ns, a1 = a0 + TAU / ns, e1 = sw / rout, e0 = sw / rin;
        x.beginPath(); x.arc(0, 0, rout, a0 + e1, a1 - e1); x.arc(0, 0, rin, a1 - e0, a0 + e0, true); x.closePath(); x.fill();
      }
    } else { for (let k = 0; k < 4; k++) { const a = k * TAU / 4 + 0.4; x.beginPath(); x.arc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.14, 0, TAU); x.fill(); } }
    x.beginPath(); x.arc(0, 0, Math.max(2, m * 0.8), 0, TAU); x.fill(); // axle bore
    x.globalCompositeOperation = 'source-over';
    x.lineWidth = 1; x.strokeStyle = `hsla(${g.hue},80%,80%,0.35)`; x.beginPath(); x.arc(0, 0, rout, 0, TAU); x.stroke(); // rim bevel
    x.strokeStyle = 'rgba(30,16,4,0.6)'; x.beginPath(); x.arc(0, 0, r, 0, TAU); x.setLineDash([2, 5]); x.stroke(); x.setLineDash([]); // pitch circle, etched
    const hub = Math.max(m * 2.2, r * 0.24); // hub with six bolts
    x.strokeStyle = 'rgba(20,10,2,0.8)'; x.beginPath(); x.arc(0, 0, hub, 0, TAU); x.stroke();
    for (let k = 0; k < 6; k++) { const a = k * TAU / 6; x.fillStyle = 'rgba(255,230,170,0.75)'; x.beginPath(); x.arc(Math.cos(a) * hub * 0.68, Math.sin(a) * hub * 0.68, Math.max(1, m * 0.22), 0, TAU); x.fill(); }
    c._h = h;
    return c;
  }
  function stPlate(S, lay) {
    return layer(S, 'plate', S.W, S.H, (x, w, h) => {
      const bg = x.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h / 2, Math.hypot(w, h) * 0.6);
      bg.addColorStop(0, '#2a1c0e'); bg.addColorStop(0.6, '#140d06'); bg.addColorStop(1, '#060302');
      x.fillStyle = bg; x.fillRect(0, 0, w, h);
      const pw = Math.max(160, w / 6), ph = Math.max(140, h / 4); // riveted plates
      x.lineWidth = 1;
      for (let X = 0; X <= w; X += pw) { x.strokeStyle = 'rgba(0,0,0,0.55)'; x.beginPath(); x.moveTo(X + 0.5, 0); x.lineTo(X + 0.5, h); x.stroke(); x.strokeStyle = 'rgba(255,200,120,0.05)'; x.beginPath(); x.moveTo(X + 1.5, 0); x.lineTo(X + 1.5, h); x.stroke(); }
      for (let Y = 0; Y <= h; Y += ph) { x.strokeStyle = 'rgba(0,0,0,0.55)'; x.beginPath(); x.moveTo(0, Y + 0.5); x.lineTo(w, Y + 0.5); x.stroke(); x.strokeStyle = 'rgba(255,200,120,0.05)'; x.beginPath(); x.moveTo(0, Y + 1.5); x.lineTo(w, Y + 1.5); x.stroke(); }
      for (let X = 0; X <= w; X += pw) for (let Y = 8; Y < h; Y += 22) { x.fillStyle = 'rgba(255,205,130,0.13)'; x.beginPath(); x.arc(X + 7, Y, 2.2, 0, TAU); x.fill(); x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(X + 7, Y + 1, 2, 1.5); }
      for (let Y = 0; Y <= h; Y += ph) for (let X = 8; X < w; X += 22) { x.fillStyle = 'rgba(255,205,130,0.13)'; x.beginPath(); x.arc(X, Y + 7, 2.2, 0, TAU); x.fill(); }
      x.font = '10px monospace'; x.fillStyle = 'rgba(255,200,120,0.16)'; x.textAlign = 'right';
      x.fillText('DIFFERENTIAL ENGINE WORKS · No. 1871 · WORKING PRESSURE 10 BAR', w - 16, h - 52);
      // pipes: cylinder → elbow (safety valve) → gauge → main
      const st = S.data, p = st.pipe;
      const pipe = (pts, wd) => {
        x.lineCap = 'round'; x.lineJoin = 'round';
        x.beginPath(); pts.forEach((q, i) => (i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1])));
        x.strokeStyle = '#3a1d0c'; x.lineWidth = wd + 2; x.stroke(); x.strokeStyle = '#9a5a2c'; x.lineWidth = wd; x.stroke();
        x.strokeStyle = 'rgba(255,200,150,0.45)'; x.lineWidth = wd * 0.25; x.stroke();
      };
      pipe([[p.cx, p.cy], [p.gx, p.cy], [p.gx, p.gy]], p.w);
      pipe([[p.gx, p.gy], [p.gx, p.gy + p.gr + 40], [w + 20, p.gy + p.gr + 40]], p.w);
      p.flanges.forEach((f) => { x.fillStyle = '#6b3b18'; x.fillRect(f[0] - p.w * 0.9, f[1] - p.w * 0.9, p.w * 1.8, p.w * 1.8); x.fillStyle = 'rgba(255,220,170,0.6)'; [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach((s) => x.fillRect(f[0] + s[0] * p.w * 0.6 - 1, f[1] + s[1] * p.w * 0.6 - 1, 2, 2)); });
      // the safety valve on the elbow: a brass bonnet with a lever and weight
      x.fillStyle = '#b98a3a'; x.fillRect(p.gx - 7, p.cy - 24, 14, 20); x.fillStyle = '#e8c070'; x.fillRect(p.gx - 4, p.cy - 30, 8, 8);
      x.strokeStyle = '#d0a050'; x.lineWidth = 2; x.beginPath(); x.moveTo(p.gx, p.cy - 26); x.lineTo(p.gx - 34, p.cy - 20); x.stroke();
      x.fillStyle = '#7a5220'; x.beginPath(); x.arc(p.gx - 34, p.cy - 20, 5, 0, TAU); x.fill();
      // the cylinder (vertical, above the crank wheel)
      const c = st.cyl;
      const cg = x.createLinearGradient(c.x - c.w / 2, 0, c.x + c.w / 2, 0);
      cg.addColorStop(0, '#3b2610'); cg.addColorStop(0.35, '#c9974a'); cg.addColorStop(0.6, '#8a5f25'); cg.addColorStop(1, '#2a1a08');
      x.fillStyle = cg; x.fillRect(c.x - c.w / 2, c.top, c.w, c.bot - c.top);
      x.fillStyle = '#e0b060'; x.fillRect(c.x - c.w / 2 - 4, c.top - 6, c.w + 8, 6); x.fillRect(c.x - c.w / 2 - 4, c.bot, c.w + 8, 6);
      x.fillStyle = 'rgba(255,230,170,0.7)'; for (let k = 0; k < 5; k++) { x.fillRect(c.x - c.w / 2 + 3 + k * (c.w - 6) / 4 - 1, c.top - 4, 2, 2); x.fillRect(c.x - c.w / 2 + 3 + k * (c.w - 6) / 4 - 1, c.bot + 2, 2, 2); }
      // the gauge face
      const gxx = p.gx, gyy = p.gy, R = p.gr;
      const bz = x.createLinearGradient(gxx - R, gyy - R, gxx + R, gyy + R); bz.addColorStop(0, '#f0cf80'); bz.addColorStop(0.5, '#8a5a20'); bz.addColorStop(1, '#3a2408');
      x.fillStyle = bz; x.beginPath(); x.arc(gxx, gyy, R + 8, 0, TAU); x.fill();
      const fc = x.createRadialGradient(gxx - R * 0.3, gyy - R * 0.3, 0, gxx, gyy, R); fc.addColorStop(0, '#f6ecd2'); fc.addColorStop(1, '#c9b48a');
      x.fillStyle = fc; x.beginPath(); x.arc(gxx, gyy, R, 0, TAU); x.fill();
      const ang = (b) => (135 + b / 12 * 270) * Math.PI / 180;
      x.strokeStyle = 'rgba(190,20,10,0.85)'; x.lineWidth = R * 0.08; x.beginPath(); x.arc(gxx, gyy, R * 0.84, ang(10), ang(12)); x.stroke();
      x.strokeStyle = '#2a1a0a'; x.fillStyle = '#2a1a0a'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `${Math.round(R * 0.17)}px monospace`;
      for (let b = 0; b <= 12; b += 0.5) {
        const a = ang(b), big = b % 2 === 0, r0 = R * (big ? 0.72 : 0.79);
        x.lineWidth = big ? 1.6 : 0.8; x.beginPath(); x.moveTo(gxx + Math.cos(a) * r0, gyy + Math.sin(a) * r0); x.lineTo(gxx + Math.cos(a) * R * 0.9, gyy + Math.sin(a) * R * 0.9); x.stroke();
        if (big) x.fillText(String(b), gxx + Math.cos(a) * R * 0.56, gyy + Math.sin(a) * R * 0.56);
      }
      x.font = `${Math.round(R * 0.13)}px monospace`; x.fillText('BAR', gxx, gyy + R * 0.42); x.fillText('BOILER', gxx, gyy - R * 0.3);
      for (let k = 0; k < 8; k++) { const a = k * TAU / 8 + 0.2; x.fillStyle = 'rgba(255,235,180,0.8)'; x.beginPath(); x.arc(gxx + Math.cos(a) * (R + 4), gyy + Math.sin(a) * (R + 4), 1.6, 0, TAU); x.fill(); }
      // tooth-count labels, stamped next to each wheel
      x.font = '10px monospace'; x.fillStyle = 'rgba(255,214,150,0.4)';
      lay.gs.forEach((g, i) => { if (i === 0 || g.id === 'B2') return; const a = Math.atan2(g.y - S.cy, g.x - S.cx); x.fillText(`N ${g.n}${g.id === 'B' ? ' / 14' : ''}`, g.x + Math.cos(a) * (g.r + 16), g.y + Math.sin(a) * (g.r + 16) + (Math.abs(Math.cos(a)) > 0.9 ? 0 : 0)); });
    });
  }
  const ST_RATIO = (72 / 18) * (18 / 28) * (28 / 14) * (40 / 12); // dθA/dθgreat: only the compound pair (40 & 14) changes it, idlers cancel
  addMode({
    id: 'pk_steam', name: 'STEAMPUNK', glyphs: G('⚙Ω⊕⊗φΘ∅⌀☼♁☿†§¶', 'ΩΦΘ§0123456789'),
    base: [40, 70, 78], palette: [[36, 90, 58], [20, 85, 55], [170, 45, 52], [48, 100, 72]],
    links: ['pk_strap', 'pk_pipe', 'chain', 'lightning'], opaque: true, count: 90, noHueShift: true, pageBg: ['#24180c', '#070403'],
    shapes: ['sphere', 'torus', 'crown', 'torus_knot', 'helix', 'dodecahedron', 'gyroid', 'cube'],
    init(S) { Object.assign(S.data, { th: 0, wA: 3.4, p: 2.4, puffs: [], lastPa: null, blow: -1e9, blowP: 0, lastCrank: 0, peakP: 0 }); },
    update(S, now, dt) {
      const d = S.data;
      if (!d.lay || d.lay.key !== S.W + 'x' + S.H + '@' + S.DPR) {
        const lay = (d.lay = stLayout(S)), F = lay.F, rc = F.r * 0.55;
        d.spr = lay.gs.map((g) => gearSprite(S, g, lay.m));
        const cw = Math.max(30, F.r * 0.5), l = rc * 2.8;
        d.cyl = { x: F.x, w: cw, rc, l, top: F.y - l - rc - cw * 1.1, bot: F.y - l + rc * 0.6 };
        const gr = clamp(baseR(S) * 0.28, 44, 92), gxx = Math.min(S.W - gr - 30, Math.max(F.x + cw + gr + 20, S.W * 0.86));
        const cyM = (d.cyl.top + d.cyl.bot) / 2;
        d.pipe = { cx: F.x + cw / 2, cy: cyM, gx: gxx, gy: Math.max(cyM + gr + 60, S.H * 0.6), gr, w: Math.max(7, gr * 0.14), flanges: [] };
        d.pipe.flanges = [[(F.x + cw / 2 + gxx) / 2, cyM], [gxx, (cyM + d.pipe.gy - gr) / 2], [gxx, d.pipe.gy + gr + 40]];
        delete S.data._plate;
      }
      const lay = d.lay, A = lay.A;
      // boiler pressure (bar): idles near 2.4, climbs while held, dumps through the safety valve on release
      const pT = S.holding ? [3.6, 5.8, 8.4, 10.6][S.stage] + 0.25 * Math.sin(now * 0.004) : 2.4 + 0.3 * Math.sin(now * 0.0004);
      d.p += (pT - d.p) * ease(dt, S.holding ? 700 : now - d.blow < 2000 ? 380 : 1500);
      d.peakP = Math.max(d.peakP, d.p);
      // the input wheel: steam drives it (ω ∝ p); a pointer circling its hub cranks it by hand; a swipe gives it a shove
      let wT = 1.4 * d.p, cranked = false;
      if (hasPtr(S)) {
        const dx = S.ptr.x - A.x, dy = S.ptr.y - A.y, r = Math.hypot(dx, dy);
        if (r < A.r * 3 && r > 4) {
          const a = Math.atan2(dy, dx);
          if (d.lastPa !== null && dt > 0) { const w = wrapA(a - d.lastPa) / (dt / 1000); if (Math.abs(w) > 0.3) { wT = clamp(w, -40, 40); cranked = true; } }
          d.lastPa = a;
        } else d.lastPa = null;
        d.wA = clamp(d.wA + clamp(pvel(S).x, -25, 25) * 0.01 * dt / 16.7, -45, 45);
      }
      d.cranked = cranked;
      d.wA += (wT - d.wA) * ease(dt, cranked ? 80 : 650);
      d.th += d.wA / ST_RATIO * dt / 1000; // the great wheel turns 17.1× slower than the input
      const F = lay.F, thF = F.s * d.th + F.c;
      // exhaust beat: puff out of the cylinder top every time the crank passes top dead centre
      const crank = Math.floor((thF + Math.PI / 2) / TAU);
      if (crank !== d.lastCrank) { d.lastCrank = crank; for (let k = 0; k < 4; k++) puff(S, { x: d.cyl.x + rand(-6, 6), y: d.cyl.top - 8, vx: rand(-0.6, 0.6), vy: rand(-2.2, -1), r0: 6, r1: rand(30, 60), life: rand(1300, 2200), a: 0.35, wind: 0.01 }); }
      // leaks at the flanges from stage I; the valve feathers at stage III; the blow-off after release
      if (S.holding && S.stage >= 1 && Math.random() < 0.1 * S.stage) { const f = pick(d.pipe.flanges); puff(S, { x: f[0], y: f[1], vx: rand(-2, 2), vy: rand(-2, 0.5), r0: 3, r1: rand(14, 30), life: 900, a: 0.4 }); }
      if (S.holding && S.stage >= 3 && Math.random() < 0.35) puff(S, { x: d.pipe.gx, y: d.pipe.cy - 32, vx: rand(-0.5, 0.5), vy: rand(-4, -2.5), r0: 4, r1: 26, life: 800, a: 0.45 });
      const bt = now - d.blow;
      if (bt < 1800) {
        const f = 1 - bt / 1800, n = Math.round(4 * f + 1);
        for (let k = 0; k < n; k++) puff(S, { x: d.pipe.gx + rand(-4, 4), y: d.pipe.cy - 34, vx: rand(-1.2, 1.2) * (1 + d.blowP * 0.1), vy: -rand(7, 14) * (0.5 + f), r0: 6, r1: rand(50, 120) * (0.6 + d.blowP / 12), life: rand(1400, 2600), a: 0.5 * f + 0.1, drag: 0.965, wind: 0.02 });
      }
    },
    background(S, ctx, now) {
      const d = S.data, lay = d.lay;
      if (!lay) return;
      blit(ctx, stPlate(S, lay));
      const fast = Math.abs(d.wA) / ST_RATIO;
      for (const i of ST_DRAW) {
        const g = lay.gs[i], spr = d.spr[i], h = spr._h, th = g.s * d.th + g.c;
        const w = Math.abs(d.wA * g.s / ST_RATIO), blur = Math.min(0.6, w * 0.03); // motion blur at speed
        const base = i === 0 ? 0.42 : g.id === 'B' ? 0.78 : 0.95;
        const reps = blur > 0.06 && !S.reduceMotion ? 3 : 1;
        for (let k = 0; k < reps; k++) {
          ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(th - (k ? Math.sign(g.s * d.wA) * blur * k / 2 : 0));
          ctx.globalAlpha = base * (k ? 0.35 : 1); ctx.drawImage(spr, -h, -h, h * 2, h * 2); ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
      // slider-crank on wheel F: x = r·cosθ + √(l² − r²·sin²θ) (vertical here)
      const F = lay.F, c = d.cyl, thF = F.s * d.th + F.c, px = F.x + Math.cos(thF) * c.rc, py = F.y + Math.sin(thF) * c.rc;
      const sy = py - Math.sqrt(Math.max(0, c.l * c.l - (px - F.x) * (px - F.x))); // the crosshead stays on the cylinder axis
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#2a1a0a'; ctx.lineWidth = 9; S.line(F.x, sy, px, py); ctx.strokeStyle = '#d8b878'; ctx.lineWidth = 6; S.line(F.x, sy, px, py);
      ctx.strokeStyle = 'rgba(255,245,220,0.6)'; ctx.lineWidth = 1.5; S.line(F.x - 1, sy, px - 1, py);
      ctx.fillStyle = '#f0d090'; ctx.beginPath(); ctx.arc(px, py, 5, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(F.x, sy, 4, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#c0c0c0'; ctx.lineWidth = 4; S.line(F.x, sy, F.x, sy - c.l * 0.55); // piston rod into the cylinder
      // pressure needle (it trembles near the red line)
      const p = d.pipe, jit = S.holding && S.stage >= 2 && !S.reduceMotion ? rand(-0.08, 0.08) * (S.stage - 1) : 0;
      const na = (135 + clamp(d.p + jit, 0, 12.4) / 12 * 270) * Math.PI / 180;
      ctx.strokeStyle = '#1a0a04'; ctx.lineWidth = 3; S.line(p.gx - Math.cos(na) * p.gr * 0.15, p.gy - Math.sin(na) * p.gr * 0.15, p.gx + Math.cos(na) * p.gr * 0.8, p.gy + Math.sin(na) * p.gr * 0.8);
      ctx.strokeStyle = '#b01808'; ctx.lineWidth = 1.5; S.line(p.gx, p.gy, p.gx + Math.cos(na) * p.gr * 0.8, p.gy + Math.sin(na) * p.gr * 0.8);
      ctx.fillStyle = '#d8a850'; ctx.beginPath(); ctx.arc(p.gx, p.gy, p.gr * 0.08, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter'; // glass glint, and a red warning glow past 9 bar
      drawGlow(ctx, '255,255,255', p.gx - p.gr * 0.35, p.gy - p.gr * 0.4, p.gr * 0.35, 0.18);
      if (d.p > 8.5) drawGlow(ctx, '255,60,20', p.gx, p.gy, p.gr * 2.2, (d.p - 8.5) * 0.18 * (0.75 + 0.25 * Math.sin(now * 0.02)));
      // live readouts beside the input wheel and the great wheel
      ctx.globalCompositeOperation = 'source-over';
      ctx.font = '11px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(255,214,150,0.8)';
      const A = lay.A, rpmA = d.wA * 60 / TAU;
      ctx.fillText(`INPUT N12 · ${rpmA.toFixed(0)} rpm${d.cranked ? ' (by hand)' : ''}`, A.x + A.r + 12, A.y + A.r * 0.4);
      ctx.fillStyle = 'rgba(255,214,150,0.55)';
      ctx.fillText(`N72 · ${(rpmA / ST_RATIO).toFixed(1)} rpm · ×${ST_RATIO.toFixed(1)} torque`, S.cx + lay.gs[0].r * 0.72, S.cy + lay.gs[0].r * 0.78);
      if (fast > 0.5 && !S.reduceMotion) drawGlow(ctx, '255,140,40', A.x, A.y, A.r * 1.5, 0.1);
    },
    drawNode(S, ctx, n, g, size, a) {
      if (!n.inf) return false;
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, '255,170,60', n.sx, n.sy, size * 1.2, 0.22 * a);
      ctx.globalCompositeOperation = 'source-over';
      ctx.font = `${size.toFixed(1)}px monospace`; ctx.fillStyle = S.colorOf(n.gen, a); ctx.fillText(g, n.sx, n.sy);
      return true;
    },
    over(S, ctx, now, dt) {
      const d = S.data;
      drawPuffs(S, ctx, dt);
      if (S.holding && S.stage >= 3 && !S.reduceMotion) { // red-line heat shimmer around the boiler gauge
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, '255,90,30', S.cx, S.cy, S.R * 1.5, 0.08 + 0.04 * Math.sin(now * 0.03));
      }
      const bt = now - d.blow;
      if (bt < 2600) { // a brass plate stamped with the lift pressure
        const a = Math.min(1, (2600 - bt) / 600) * Math.min(1, bt / 150);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a;
        const x = d.pipe.gx, y = d.pipe.cy - 70 - Math.min(40, bt * 0.03), w = 210;
        ctx.fillStyle = 'rgba(40,24,8,0.85)'; ctx.fillRect(x - w, y - 16, w, 32); ctx.strokeStyle = '#e0b060'; ctx.lineWidth = 1.5; ctx.strokeRect(x - w + 0.5, y - 15.5, w - 1, 31);
        ctx.font = '11px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd890';
        ctx.fillText(`SAFETY VALVE LIFTED · ${d.blowP.toFixed(1)} bar`, x - w / 2, y - 4);
        ctx.fillStyle = 'rgba(255,216,144,0.7)'; ctx.fillText('PSSSHHHHHHHHHHH', x - w / 2, y + 9); ctx.globalAlpha = 1;
      }
    },
    onRelease(S, held, pw) {
      const d = S.data;
      d.blow = S.now; d.blowP = d.p;
      if (d.pipe) { S.ring(d.pipe.gx, d.pipe.cy - 30, 120 + 160 * pw, [40, 80, 80], 900); S.ring(d.pipe.gx, d.pipe.cy - 30, 60 + 90 * pw, [0, 0, 100], 600); }
      S.active.forEach((n) => { if (n.inf && Math.random() < 0.5) puff(S, { x: n.sx, y: n.sy, vx: rand(-1, 1), vy: rand(-2, -0.5), r0: 3, r1: rand(16, 34), life: 1200, a: 0.3 }); });
      S.shake(4 * pw);
      d.wA += 6 * pw; // the engine surges as the valve lifts
      return false;
    },
    hud(S) {
      const d = S.data, rpm = d.wA * 60 / TAU, p = d.p.toFixed(1);
      if (S.holding) return [`stoking · ${p} bar · ω₁N₁ = ω₂N₂ keeps the books balanced`,
        `${p} bar · input ${rpm.toFixed(0)} rpm → great wheel ${(rpm / ST_RATIO).toFixed(1)} rpm · torque ×${ST_RATIO.toFixed(1)}`,
        `${p} bar · rivets reconsidering their career · idlers N28 & N18 change nothing but direction`,
        `${p} bar · RED LINE · valve set at 10 bar · let go to lift it`][S.stage];
      if (S.now - d.blow < 3500) return `blow-off at ${d.blowP.toFixed(1)} bar · boiler lives to whistle another day · peak ${d.peakP.toFixed(1)} bar`;
      return `ω₁N₁ = ω₂N₂ · (40/12)·(72/14) = 1:${ST_RATIO.toFixed(2)} · in ${rpm.toFixed(0)} rpm → out ${(rpm / ST_RATIO).toFixed(2)} rpm · circle the N12 wheel to crank it`;
    }
  });

  /* ======================= 2. FROSTPUNK ======================= */
  // The generator radiates P = εσA(T⁴ − Tₐ⁴). A street stays at +10 °C where the radiated flux P/(4πr²) still covers
  // its loss h·(10 − Tₐ), so the warm radius is r = √(P / (4π·h·(10 − Tₐ))). The district relaxes by Newton's law of cooling.
  const SIGMA = 5.670374419e-8, FR_EPS = 0.9, FR_A = 40, FR_H = 10, FR_UA = 2e5, FR_CITY = 48;
  const bbRGB = (T) => { // a rough blackbody tint from 800 K to 1600 K
    const t = clamp((T - 800) / 800, 0, 1);
    return [255, Math.round(lerp(50, 190, t)), Math.round(lerp(10, 110, t * t))];
  };
  function frLayout(S) {
    const Rb = baseR(S), hz = S.H * 0.55, gy = S.H * 0.74, kx = Math.min(S.W * 0.47, S.H * 0.9) / FR_CITY, flat = 0.22;
    const huts = [];
    [9, 14, 19.5, 25.5, 32, 39, 46].forEach((r, ri) => {
      const n = Math.round(r * 0.95);
      for (let k = 0; k < n; k++) {
        const a = (k + (ri % 2) * 0.5) / n * TAU + rand(-0.06, 0.06), sn = Math.sin(a);
        if (r > 38 && sn < -0.5 && Math.random() < 0.5) continue;
        huts.push({ r, a, x: S.cx + Math.cos(a) * r * kx, y: gy + sn * r * kx * flat, s: 0.65 + 0.45 * (sn + 1) / 2, w: rand(0.9, 1.35), win: Math.random() < 0.85 });
      }
    });
    huts.sort((p, q) => p.y - q.y);
    return { Rb, hz, gy, kx, flat, huts, key: S.W + 'x' + S.H + '@' + S.DPR };
  }
  function frGround(S, L) {
    return layer(S, 'ground', S.W, S.H, (x, w, h) => {
      const sky = x.createLinearGradient(0, 0, 0, L.hz);
      sky.addColorStop(0, '#05080d'); sky.addColorStop(0.6, '#121b26'); sky.addColorStop(1, '#2c3946');
      x.fillStyle = sky; x.fillRect(0, 0, w, L.hz + 2);
      // ice cliffs on the horizon, two ranges
      [[0.75, '#1a232e', 0.09], [0.9, '#222d39', 0.05]].forEach(([k, c, hh]) => {
        x.fillStyle = c; x.beginPath(); x.moveTo(0, L.hz);
        for (let X = 0; X <= w; X += 14) x.lineTo(X, L.hz - (Math.abs(Math.sin(X * 0.004 * k + k * 9)) * 0.7 + Math.random() * 0.3) * h * hh);
        x.lineTo(w, L.hz); x.closePath(); x.fill();
      });
      const g = x.createLinearGradient(0, L.hz, 0, h);
      g.addColorStop(0, '#3a4855'); g.addColorStop(0.4, '#25313c'); g.addColorStop(1, '#0d1218');
      x.fillStyle = g; x.fillRect(0, L.hz, w, h - L.hz);
      // the crater rim the city sits in, and wind-ploughed drifts
      x.strokeStyle = 'rgba(200,220,240,0.10)'; x.lineWidth = 2;
      for (let k = 0; k < 3; k++) { x.beginPath(); x.ellipse(S.cx, L.gy, (FR_CITY + 6 + k * 7) * L.kx, (FR_CITY + 6 + k * 7) * L.kx * L.flat, 0, 0, TAU); x.stroke(); }
      x.strokeStyle = 'rgba(200,220,240,0.05)'; x.lineWidth = 1;
      for (let k = 0; k < 40; k++) { const yy = rand(L.hz + 6, h), xx = rand(0, w), ww = rand(40, 160); x.beginPath(); x.moveTo(xx, yy); x.quadraticCurveTo(xx + ww / 2, yy - 4, xx + ww, yy); x.stroke(); }
      // radial streets
      x.strokeStyle = 'rgba(10,14,20,0.35)'; x.lineWidth = 1.5;
      for (let k = 0; k < 8; k++) { const a = k * TAU / 8 + 0.2; x.beginPath(); x.moveTo(S.cx + Math.cos(a) * 6 * L.kx, L.gy + Math.sin(a) * 6 * L.kx * L.flat); x.lineTo(S.cx + Math.cos(a) * 47 * L.kx, L.gy + Math.sin(a) * 47 * L.kx * L.flat); x.stroke(); }
      // the generator tower: a riveted lattice from the plaza up to the sphere, which is its furnace
      const top = S.cy + L.Rb * 0.15, bw = L.Rb * 0.22, tw = L.Rb * 0.08;
      x.fillStyle = '#10151b'; x.beginPath(); x.moveTo(S.cx - bw, L.gy); x.lineTo(S.cx - tw, top); x.lineTo(S.cx + tw, top); x.lineTo(S.cx + bw, L.gy); x.closePath(); x.fill();
      x.strokeStyle = 'rgba(140,160,180,0.35)'; x.lineWidth = 1; x.beginPath();
      const n = 9;
      for (let k = 0; k < n; k++) {
        const y0 = L.gy - (L.gy - top) * k / n, y1 = L.gy - (L.gy - top) * (k + 1) / n, w0 = lerp(bw, tw, k / n), w1 = lerp(bw, tw, (k + 1) / n);
        x.moveTo(S.cx - w0, y0); x.lineTo(S.cx + w1, y1); x.moveTo(S.cx + w0, y0); x.lineTo(S.cx - w1, y1); x.moveTo(S.cx - w1, y1); x.lineTo(S.cx + w1, y1);
      }
      x.stroke();
      x.strokeStyle = 'rgba(200,215,230,0.5)'; x.beginPath(); x.moveTo(S.cx - bw, L.gy); x.lineTo(S.cx - tw, top); x.moveTo(S.cx + bw, L.gy); x.lineTo(S.cx + tw, top); x.stroke();
    });
  }
  function frHuts(S, L, warm, y0) {
    return layer(S, warm ? 'hutsW' : 'hutsC', S.W, S.H - y0, (x) => {
      x.translate(0, -y0);
      for (const h of L.huts) {
        const sz = h.s * L.kx * 1.05, bw = sz * h.w, bh = sz * 0.62;
        if (warm && h.win) { const g = x.createRadialGradient(h.x, h.y - bh * 0.5, 0, h.x, h.y - bh * 0.5, sz * 1.1); g.addColorStop(0, 'rgba(255,150,60,0.28)'); g.addColorStop(1, 'rgba(255,150,60,0)'); x.fillStyle = g; x.fillRect(h.x - sz * 1.1, h.y - bh * 0.5 - sz * 1.1, sz * 2.2, sz * 2.2); }
        x.fillStyle = warm ? '#2a2018' : '#1a2129'; x.fillRect(h.x - bw / 2, h.y - bh, bw, bh);
        x.beginPath(); x.moveTo(h.x - bw * 0.62, h.y - bh); x.lineTo(h.x, h.y - bh - sz * 0.45); x.lineTo(h.x + bw * 0.62, h.y - bh); x.closePath();
        x.fillStyle = warm ? '#3a2c20' : '#c9d8e6'; x.fill(); // roofs keep their snow outside the warm radius
        if (h.win) { x.fillStyle = warm ? 'rgba(255,185,80,1)' : 'rgba(40,60,80,0.9)'; x.fillRect(h.x - sz * 0.12, h.y - bh * 0.7, sz * 0.24, bh * 0.36); }
      }
    });
  }
  function frFrost(S) { // frost crystals creeping in from the screen edges (half resolution)
    return layer(S, 'frost', S.W, S.H, (x, w, h) => {
      const v = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.hypot(w, h) * 0.55);
      v.addColorStop(0, 'rgba(200,230,255,0)'); v.addColorStop(1, 'rgba(210,235,255,0.42)');
      x.fillStyle = v; x.fillRect(0, 0, w, h);
      x.lineCap = 'round';
      const branch = (X, Y, a, len, depth) => {
        const X2 = X + Math.cos(a) * len, Y2 = Y + Math.sin(a) * len;
        x.strokeStyle = `rgba(225,242,255,${0.12 + depth * 0.08})`; x.lineWidth = 0.4 + depth * 0.45;
        x.beginPath(); x.moveTo(X, Y); x.lineTo(X2, Y2); x.stroke();
        if (depth <= 0) return;
        const k = 2 + (depth > 1 ? 1 : 0);
        for (let i = 1; i <= k; i++) { const t = i / (k + 1), px = X + (X2 - X) * t, py = Y + (Y2 - Y) * t; branch(px, py, a + (i % 2 ? 1 : -1) * Math.PI / 3, len * 0.42 * (1 - t * 0.5), depth - 1); }
        branch(X2, Y2, a + rand(-0.3, 0.3), len * 0.6, depth - 1);
      };
      const per = Math.round((w + h) / 26);
      for (let k = 0; k < per; k++) {
        const side = k % 4, t = Math.random();
        const X = side === 0 ? t * w : side === 1 ? w : side === 2 ? t * w : 0, Y = side === 0 ? 0 : side === 1 ? t * h : side === 2 ? h : t * h;
        const a = Math.atan2(h / 2 - Y, w / 2 - X) + rand(-0.7, 0.7);
        branch(X, Y, a, rand(30, 110) * Math.min(1.4, Math.max(w, h) / 1200), 3);
      }
    }, 0.5);
  }
  addMode({
    id: 'pk_frost', name: 'FROST CITY', glyphs: G('ᚠᚢᚦᚨᚱᚲᚷᚺᚾᛁᛃᛇᛉᛊᛏᛒᛗᛟ❄❅❆°', 'ABDEFHIKMNRSTXZ°*+'),
    base: [200, 50, 88], palette: [[28, 100, 60], [12, 100, 58], [45, 100, 68], [195, 90, 75]],
    links: ['pm_frost', 'pm_frost', 'fire', 'plasma'], opaque: true, count: 110, noHueShift: true, pageBg: ['#0e1a26', '#020508'],
    shapes: ['sphere', 'icosahedron', 'torus', 'crown', 'buckyball', 'snub_dodecahedron', 'helix', 'menger'],
    init(S) {
      Object.assign(S.data, { Tc: 900, Tcity: -42, risk: 0, pulse: -1e9, vent: false, puffs: [], flakes: [] });
      for (let k = 0; k < 260; k++) S.data.flakes.push({ x: rand(0, S.W), y: rand(0, S.H), z: rand(0.25, 1), vx: 0, vy: 0 });
    },
    update(S, now, dt) {
      const d = S.data;
      if (!d.L || d.L.key !== S.W + 'x' + S.H + '@' + S.DPR) { d.L = frLayout(S); ['_ground', '_frost', '_hutsW', '_hutsC'].forEach((k) => delete d[k]); }
      // the storm: outside temperature drifts between −20 and −80 °C
      d.Tout = clamp(-50 + 26 * Math.sin(now / 11000) + 7 * Math.sin(now / 2700 + 1), -80, -20);
      const TcT = S.holding ? [1040, 1200, 1360, 1540][S.stage] : 900 + 25 * Math.sin(now / 1700);
      d.Tc += (TcT - d.Tc) * ease(dt, S.holding ? 1100 : 2600);
      const Ta = d.Tout + 273.15;
      d.P = FR_EPS * SIGMA * FR_A * (Math.pow(d.Tc, 4) - Math.pow(Ta, 4)); // W
      d.rWarm = Math.sqrt(d.P / (4 * Math.PI * FR_H * (10 - d.Tout))); // m
      const Teq = d.Tout + d.P / FR_UA; // Newton: dT/dt = −k(T − Tₐ) + P/C  →  T relaxes to Tₐ + P/UA
      d.Tcity += (Teq - d.Tcity) * ease(dt, 3500);
      d.risk = clamp(d.risk + (S.holding ? Math.max(0, (d.Tc - 1220) / 300) * 0.28 : -0.12) * dt / 1000, 0, 1);
      // smoke and sparks from the tower top
      const top = S.cy + d.L.Rb * 0.15;
      if (Math.random() < 0.25 + d.Tc / 4000) puff(S, { x: S.cx + rand(-10, 10), y: S.cy - S.R * 0.2, vx: rand(-0.3, 0.3), vy: rand(-1.4, -0.7), r0: 8, r1: rand(50, 90), life: rand(2500, 4000), a: 0.5, rgb: '28,30,36', wind: 0.012 });
      if (S.holding && S.stage >= 2 && Math.random() < 0.3 * S.stage) { const a = rand(0, TAU); S.spawn(S.cx + Math.cos(a) * S.R * 0.3, top, Math.cos(a) * rand(0.5, 2), -rand(1, 3), `rgba(255,${Math.round(rand(120, 200))},60,1)`, rand(700, 1300), rand(1.2, 2.4), { g: -0.01 }); }
      // snow: a blizzard that thickens as it gets colder, blown by the pointer, sublimating near the furnace
      const k = dt / 16.7, wind = 1.2 * Math.sin(now / 4000) + 0.8 + clamp(pvel(S).x, -30, 30) * 0.04, heavy = smooth(-25, -75, d.Tout);
      const hot = S.R * (0.4 + d.rWarm / 40), hot2 = hot * hot, pr = d.pulse > now - 1600 ? (now - d.pulse) * 1.2 : -1;
      d.nFlakes = Math.round(80 + 180 * heavy);
      for (let i = 0; i < d.nFlakes; i++) {
        const f = d.flakes[i];
        f.vx += (wind * f.z * 1.6 - f.vx) * 0.05 * k; f.vy += ((0.5 + 1.3 * f.z) - f.vy) * 0.05 * k;
        repel(S, f, 120, 0.6);
        if (pr > 0) { const dx = f.x - S.cx, dy = f.y - S.cy, dd = Math.hypot(dx, dy) + 1; if (Math.abs(dd - pr) < 60) { f.vx += dx / dd * 6; f.vy += dy / dd * 6; } }
        f.x += f.vx * k; f.y += f.vy * k;
        const dx = f.x - S.cx, dy = f.y - S.cy;
        if (f.y > S.H + 4 || f.x > S.W + 20 || f.x < -20 || dx * dx + dy * dy < hot2 * 0.3 || f.y < -30) { f.x = rand(-20, S.W); f.y = rand(-20, -4); f.vx = wind; f.vy = 1; }
      }
    },
    background(S, ctx, now, dt) {
      const d = S.data, L = d.L;
      if (!L) return;
      blit(ctx, frGround(S, L));
      const warmPx = d.rWarm * L.kx, c = bbRGB(d.Tc).join(',');
      // the warm zone on the snow, squashed into the ground plane
      ctx.save(); ctx.translate(S.cx, L.gy); ctx.scale(1, L.flat);
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, '255,130,40', 0, 0, warmPx * 1.25, 0.45); drawGlow(ctx, c, 0, 0, warmPx * 0.5, 0.35);
      const pt = now - d.pulse;
      if (pt < 2200) { ctx.strokeStyle = `rgba(255,170,80,${0.8 * (1 - pt / 2200)})`; ctx.lineWidth = 6 / L.flat; ctx.beginPath(); ctx.arc(0, 0, warmPx + pt * 0.6, 0, TAU); ctx.stroke(); }
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
      // the huts: two cached versions of the whole town (frozen and lived-in); the lived-in one is clipped to the warm radius
      const y0 = L.hz - 30, cold = frHuts(S, L, false, y0), warmL = frHuts(S, L, true, y0), rx = d.rWarm * L.kx;
      blit(ctx, cold, 0, y0);
      ctx.save(); ctx.beginPath(); ctx.ellipse(S.cx, L.gy - L.kx * 0.5, rx, rx * L.flat + L.kx * 0.9, 0, 0, TAU); ctx.clip();
      blit(ctx, warmL, 0, y0); ctx.restore();
      drawPuffs(S, ctx, dt); // smoke stack
      // the furnace: blackbody colour from the core temperature, shaking when overdriven
      const j = S.holding && S.stage >= 3 && !S.reduceMotion ? 2 : 0;
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, c, S.cx + rand(-j, j), S.cy + rand(-j, j), S.R * (0.55 + (d.Tc - 900) / 900), 0.55 + 0.1 * Math.sin(now * 0.01));
      drawGlow(ctx, '255,240,200', S.cx, S.cy, S.R * 0.18 * (d.Tc / 900), smooth(1100, 1500, d.Tc) * 0.8);
      ctx.globalCompositeOperation = 'source-over';
    },
    drawNode(S, ctx, n, g, size, a) {
      const d = S.data, dist = Math.hypot(n.sx - S.cx, n.sy - S.cy), wr = S.R * (d.rWarm || 13) / 22;
      const w = smooth(wr * 1.2, wr * 0.6, dist);
      if (w > 0.05) { ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, '255,140,40', n.sx, n.sy, size * 1.1, w * 0.28 * a); ctx.globalCompositeOperation = 'source-over'; }
      ctx.font = `${size.toFixed(1)}px monospace`;
      ctx.fillStyle = n.inf ? S.colorOf(n.gen, a) : `hsla(${lerp(200, 30, w).toFixed(0)},${lerp(45, 100, w).toFixed(0)}%,${lerp(88, 64, w).toFixed(0)}%,${a})`;
      ctx.fillText(g, n.sx, n.sy);
      return true;
    },
    over(S, ctx, now) {
      const d = S.data;
      if (!d.L) return;
      ctx.fillStyle = 'rgba(235,242,255,0.8)'; // snow
      for (let i = 0; i < d.nFlakes; i++) { const f = d.flakes[i], s = f.z * 2.4; ctx.globalAlpha = 0.35 + 0.6 * f.z; ctx.fillRect(f.x, f.y, s, s); }
      ctx.globalAlpha = 1;
      // frost on the lens: it keeps out of an ellipse that grows as the streets warm up
      const pt = now - d.pulse, boost = pt < 4000 ? 0.7 * (1 - pt / 4000) : 0;
      const rho = lerp(0.62, 1.5, smooth(-45, 2, d.Tcity)) + boost;
      if (rho < 1.45) {
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, S.W, S.H); ctx.ellipse(S.cx, S.cy, rho * S.W / 2, rho * S.H / 2, 0, 0, TAU); ctx.clip('evenodd');
        ctx.globalAlpha = smooth(1.45, 1.0, rho) * 0.9 + 0.1; blit(ctx, frFrost(S)); ctx.restore(); ctx.globalAlpha = 1;
      }
      // the stress gauge on the right edge
      const x = S.W - 30, y0 = S.H * 0.24, hh = S.H * 0.34, r = d.risk;
      ctx.fillStyle = 'rgba(5,8,12,0.7)'; ctx.fillRect(x - 6, y0 - 4, 12, hh + 8);
      ctx.fillStyle = r > 0.8 ? `rgba(255,60,30,${S.reduceMotion ? 0.9 : 0.6 + 0.4 * Math.sin(now * 0.03)})` : `hsl(${lerp(40, 0, r)},100%,55%)`;
      ctx.fillRect(x - 3, y0 + hh * (1 - r), 6, hh * r);
      ctx.save(); ctx.translate(x - 12, y0 + hh / 2); ctx.rotate(-Math.PI / 2); ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(220,230,240,0.6)';
      ctx.fillText(`STACK STRESS ${(r * 100).toFixed(0)}%`, 0, 0); ctx.restore();
      ctx.font = '11px monospace'; ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(220,235,250,0.75)';
      ctx.fillText(`${d.Tout.toFixed(0)} °C`, S.W - 46, y0 + 6); ctx.fillStyle = 'rgba(255,190,120,0.8)'; ctx.fillText(`core ${d.Tc.toFixed(0)} K`, S.W - 46, y0 + 22);
    },
    onRelease(S, held, pw) {
      const d = S.data;
      d.pulse = S.now; d.vent = d.risk > 0.5;
      S.ring(S.cx, S.cy, 260 + 260 * pw, [28, 100, 60], 1400);
      for (let k = 0; k < 70 * pw; k++) { const a = rand(0, TAU), v = rand(2, 8) * pw; S.spawn(S.cx, S.cy, Math.cos(a) * v, Math.sin(a) * v - 1, `rgba(255,${Math.round(rand(110, 210))},60,1)`, rand(800, 1700), rand(1.2, 3), { g: 0.04 }); }
      if (d.vent) for (let k = 0; k < 30; k++) puff(S, { x: S.cx + rand(-20, 20), y: S.cy - S.R * 0.3, vx: rand(-2, 2), vy: -rand(3, 8), r0: 10, r1: rand(60, 130), life: rand(1600, 2600), a: 0.55, rgb: '230,235,240', drag: 0.96 });
      d.risk *= 0.3;
      S.shake(5 * pw);
      return false;
    },
    hud(S) {
      const d = S.data;
      if (d.P === undefined) return '';
      const MW = (d.P / 1e6).toFixed(1), r = d.rWarm.toFixed(0);
      if (S.holding) return [`overdrive · core ${d.Tc.toFixed(0)} K · P ∝ T⁴, so +10% temperature = +46% heat`,
        `${MW} MW · warm radius ${r} m · streets ${d.Tcity.toFixed(0)} °C · dT/dt = −k(T − Tₐ) + P/C`,
        `core ${d.Tc.toFixed(0)} K and climbing · stack stress ${(d.risk * 100).toFixed(0)}% · the frost is backing off`,
        `${MW} MW · stack stress ${(d.risk * 100).toFixed(0)}% · the city loves you, the boiler does not`][S.stage];
      if (S.now - d.pulse < 4000) return d.vent ? 'emergency vent · heat pulse rolls over the rooftops · frost in retreat' : `heat pulse · frost in retreat · streets ${d.Tcity.toFixed(0)} °C`;
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
  function whaleDraw(ctx, w, now, alpha) {
    const L = w.L, t = now * 0.0021 * w.f + w.ph, n = 14, top = [], bot = [];
    for (let i = 0; i <= n; i++) {
      const s = i / n, osc = Math.sin(t - s * 3.2) * L * 0.045 * s * s;
      const th = L * 0.115 * Math.pow(Math.sin(Math.PI * Math.min(1, s * 0.92 + 0.08)), 0.75) * (1 - 0.72 * s) + L * 0.012;
      const X = L * (0.5 - s);
      top.push([X, osc - th * 0.88]); bot.push([X, osc + th * 1.05]);
    }
    const tail = Math.sin(t - 3.2) * L * 0.045, tx = -L * 0.5, fl = Math.cos(t - 3.4) * 0.5;
    ctx.save(); ctx.translate(w.x, w.y); ctx.scale(w.dir, 1); ctx.rotate(w.tilt || 0); ctx.globalAlpha = alpha;
    // flukes
    ctx.fillStyle = w.dark; ctx.beginPath(); ctx.moveTo(tx + L * 0.04, tail);
    ctx.quadraticCurveTo(tx - L * 0.06, tail - L * 0.05 + fl * L * 0.04, tx - L * 0.12, tail - L * 0.12 + fl * L * 0.05);
    ctx.quadraticCurveTo(tx - L * 0.05, tail - L * 0.02, tx - L * 0.02, tail);
    ctx.quadraticCurveTo(tx - L * 0.05, tail + L * 0.02, tx - L * 0.12, tail + L * 0.12 + fl * L * 0.05);
    ctx.quadraticCurveTo(tx - L * 0.06, tail + L * 0.05 + fl * L * 0.04, tx + L * 0.04, tail); ctx.fill();
    // body
    ctx.beginPath(); ctx.moveTo(top[0][0] + L * 0.03, (top[0][1] + bot[0][1]) / 2);
    top.forEach((p) => ctx.lineTo(p[0], p[1])); for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -L * 0.12, 0, L * 0.13); g.addColorStop(0, w.dark); g.addColorStop(0.55, w.mid); g.addColorStop(1, w.belly);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(190,210,255,0.25)'; ctx.lineWidth = 1; ctx.stroke(); // moonlit rim
    // throat grooves (rorqual pleats)
    ctx.strokeStyle = 'rgba(20,24,50,0.45)'; ctx.lineWidth = 0.8; ctx.beginPath();
    for (let k = 0; k < 5; k++) { const yy = bot[1][1] - k * L * 0.012; ctx.moveTo(L * 0.44, yy - L * 0.01); ctx.quadraticCurveTo(L * 0.25, yy + L * 0.008, L * 0.08, yy - L * 0.004); }
    ctx.stroke();
    // a long pectoral fin, slowly rowing
    const fa = 0.5 + 0.25 * Math.sin(t * 0.7), fx = L * 0.22, fy = bot[4][1] - L * 0.02, fL = L * (w.hump ? 0.32 : 0.14);
    ctx.fillStyle = w.mid; ctx.beginPath(); ctx.moveTo(fx, fy);
    ctx.quadraticCurveTo(fx - fL * 0.3, fy + fL * Math.sin(fa) * 0.9, fx - fL * Math.cos(fa), fy + fL * Math.sin(fa));
    ctx.quadraticCurveTo(fx - fL * 0.5, fy + fL * Math.sin(fa) * 0.3, fx - L * 0.08, fy); ctx.fill();
    // harness straps and lanterns: someone lives up here
    ctx.strokeStyle = 'rgba(200,150,80,0.7)'; ctx.lineWidth = Math.max(1, L * 0.008);
    [7, 9].forEach((i) => { ctx.beginPath(); ctx.moveTo(top[i][0], top[i][1]); ctx.lineTo(bot[i][0], bot[i][1]); ctx.stroke(); });
    ctx.fillStyle = '#0a0c18'; ctx.beginPath(); ctx.arc(L * 0.38, bot[2][1] - L * 0.045, Math.max(1.2, L * 0.008), 0, TAU); ctx.fill(); // eye
    ctx.restore();
    ctx.globalCompositeOperation = 'lighter';
    [7, 9].forEach((i) => { const lx = w.x + w.dir * bot[i][0], ly = w.y + bot[i][1] + L * 0.03; drawGlow(ctx, '255,180,90', lx, ly, L * 0.06, 0.55 * alpha * (0.8 + 0.2 * Math.sin(now * 0.013 + i))); });
    ctx.globalCompositeOperation = 'source-over';
    w.lamp = [w.x + w.dir * bot[8][0], w.y + bot[8][1]];
  }
  function airshipDraw(ctx, a, now) {
    const s = a.s;
    ctx.save(); ctx.translate(a.x, a.y); ctx.scale(a.dir, 1);
    ctx.strokeStyle = 'rgba(60,40,30,0.8)'; ctx.lineWidth = 0.8; ctx.beginPath();
    ctx.moveTo(-s * 14, s * 10); ctx.lineTo(-s * 8, s * 22); ctx.moveTo(s * 14, s * 10); ctx.lineTo(s * 8, s * 22); ctx.stroke();
    const g = ctx.createLinearGradient(0, -s * 14, 0, s * 14); g.addColorStop(0, '#c9a27a'); g.addColorStop(0.5, '#7a5540'); g.addColorStop(1, '#2e1f1c');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, s * 34, s * 13, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(40,24,16,0.6)'; ctx.beginPath(); for (let k = -2; k <= 2; k++) { ctx.moveTo(-s * 34 * Math.sqrt(1 - (k / 3) ** 2), k * s * 4); ctx.lineTo(s * 34 * Math.sqrt(1 - (k / 3) ** 2), k * s * 4); } ctx.stroke();
    ctx.fillStyle = '#3a2618'; ctx.beginPath(); ctx.moveTo(-s * 30, -s * 2); ctx.lineTo(-s * 42, -s * 10); ctx.lineTo(-s * 40, s * 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4a3020'; ctx.fillRect(-s * 10, s * 21, s * 20, s * 6);
    const pr = Math.abs(Math.sin(now * 0.03 + a.ph)) * s * 5; ctx.fillStyle = 'rgba(200,190,170,0.6)'; ctx.fillRect(-s * 13, s * 24 - pr, 1.5, pr * 2);
    ctx.restore();
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, '255,170,70', a.x + a.dir * s * 6, a.y + s * 28, s * 14, 0.75 + 0.2 * Math.sin(now * 0.02 + a.ph) * Math.sin(now * 0.031));
    ctx.globalCompositeOperation = 'source-over';
    a.gx = a.x; a.gy = a.y + s * 27;
  }
  function whClouds(S, key, top, light, dark, seed) {
    const w = Math.ceil(S.W * 1.5), h = Math.ceil(S.H - top + 10);
    return layer(S, key, w, h, (x) => {
      x.fillStyle = dark; x.fillRect(0, h * 0.35, w, h);
      let s = seed; const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
      for (let pass = 0; pass < 2; pass++) for (let k = 0; k < 90; k++) {
        const X = r() * w, Y = h * (0.08 + r() * 0.32) + (pass ? -4 : 6), R = (24 + r() * 70) * (S.H / 900) * (pass ? 0.8 : 1);
        for (const ox of [X - w, X, X + w]) {
          const g = x.createRadialGradient(ox, Y - R * 0.3, 0, ox, Y, R);
          g.addColorStop(0, pass ? light : dark); g.addColorStop(0.7, pass ? light.replace(/[\d.]+\)$/, '0.25)') : dark); g.addColorStop(1, 'rgba(0,0,0,0)');
          x.fillStyle = g; x.beginPath(); x.arc(ox, Y, R, 0, TAU); x.fill();
        }
      }
    }, 0.5);
  }
  addMode({
    id: 'pk_whale', name: 'WHALEPUNK', glyphs: G('≈∿~◦°∘⊹✦◌ʘ⌇', '~°o*'),
    base: [210, 50, 86], palette: [[200, 80, 70], [38, 90, 64], [265, 60, 74], [175, 70, 62]],
    links: ['rope', 'beads', 'wave', 'arc'], opaque: true, count: 64, noHueShift: true, pageBg: ['#141433', '#04060f'],
    shapes: ['sphere', 'seashell', 'helicoid', 'torus', 'breather', 'galaxy', 'dini', 'catenoid'],
    init(S) {
      const d = S.data;
      Object.assign(d, { puffs: [], calls: [], sring: [], colT: 0, breach: null, songK: 0, nextSong: 0 });
      d.whales = [
        { x: S.W * 0.25, y: S.H * 0.63, L: 1, dir: 1, sp: 0.012, f: 0.6, ph: 0, depth: 0, hump: false, dark: '#202848', mid: '#3a4672', belly: '#7d88b0', kind: 'blue', next: 0 },
        { x: S.W * 0.78, y: S.H * 0.40, L: 1, dir: -1, sp: 0.02, f: 1, ph: 2, depth: 1, hump: true, dark: '#1b1f38', mid: '#333a62', belly: '#9aa3c4', kind: 'hump', next: 0 },
        { x: S.W * 0.1, y: S.H * 0.28, L: 1, dir: 1, sp: 0.016, f: 0.9, ph: 4, depth: 0.6, hump: true, dark: '#1d2240', mid: '#38406a', belly: '#8f98bc', kind: 'hump', next: 0 }
      ];
      d.ships = [{ x: S.W * 0.62, y: S.H * 0.2, s: 0.9, dir: -1, sp: 0.01, ph: 1 }, { x: S.W * 0.3, y: S.H * 0.47, s: 0.6, dir: 1, sp: 0.008, ph: 3 }];
      d.spec = mk(WH_COLS, WH_ROWS); d.sx = d.spec.getContext('2d'); d.sx.fillStyle = '#000004'; d.sx.fillRect(0, 0, WH_COLS, WH_ROWS);
      d.rays = sofarRays();
    },
    update(S, now, dt) {
      const d = S.data, k = dt / 16.7, Rb = baseR(S);
      d.whales.forEach((w, i) => {
        w.L = Rb * [1.25, 0.85, 0.55][i];
        if (S.holding) { // gather around the sphere and circle it
          const a = now * 0.00025 * (i % 2 ? -1 : 1) + i * 2.1, tx = S.cx + Math.cos(a) * S.R * (1.25 + i * 0.25), ty = S.cy + Math.sin(a) * S.R * 0.55;
          const vx = (tx - w.x) * ease(dt, 1400), vy = (ty - w.y) * ease(dt, 1400);
          w.x += vx; w.y += vy; if (Math.abs(vx) > 0.15) w.dir = vx > 0 ? 1 : -1;
        } else {
          w.x += w.dir * w.sp * dt * (S.W / 1000);
          w.y += Math.sin(now * 0.0004 + w.ph) * 0.12 * k;
          if (hasPtr(S)) { const dy = w.y - S.ptr.y, dx = w.x - S.ptr.x; if (Math.abs(dx) < w.L * 0.7 && Math.abs(dy) < w.L * 0.35) w.y += Math.sign(dy || 1) * 1.2 * k; }
          w.y += ((i === 0 ? S.H * 0.63 : i === 1 ? S.H * 0.4 : S.H * 0.27) - w.y) * ease(dt, 6000);
          if (w.x > S.W + w.L * 0.8) { w.x = -w.L * 0.8; } if (w.x < -w.L * 0.8) { w.x = S.W + w.L * 0.8; }
        }
        w.tilt = Math.sin(now * 0.0005 + w.ph) * 0.05;
        // songs: the big one calls low and long, the others sing units in phrases
        const rate = S.holding ? 0.35 + S.stage * 0.25 : 0.12;
        if (now > w.next) {
          w.next = now + (w.kind === 'blue' ? rand(9000, 14000) / (1 + S.stage) : rand(1500, 4000) / (1 + S.stage * 0.8));
          if (w.kind === 'blue' || Math.random() < rate * 3) whCall(S, w);
        }
      });
      d.ships.forEach((a) => { a.x += a.dir * a.sp * dt * (S.W / 1000); a.y += Math.sin(now * 0.0006 + a.ph) * 0.08 * k; if (a.x > S.W + 60) a.x = -60; if (a.x < -60) a.x = S.W + 60; });
      // spectrogram: one column per 40 ms of screen time = 0.25 s of sea time (×6.25)
      d.colT += dt;
      while (d.colT > 40) { d.colT -= 40; whColumn(S); }
      if (d.breach && now - d.breach.t > 3200) d.breach = null;
    },
    background(S, ctx, now, dt) {
      const d = S.data;
      blit(ctx, layer(S, 'sky', S.W, S.H, (x, w, h) => {
        const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#070920'); g.addColorStop(0.35, '#1a1840'); g.addColorStop(0.58, '#3e3260'); g.addColorStop(0.7, '#8a5c6e'); g.addColorStop(1, '#2a2040');
        x.fillStyle = g; x.fillRect(0, 0, w, h);
        for (let k = 0; k < 220; k++) { const yy = Math.pow(Math.random(), 1.6) * h * 0.55; x.fillStyle = `rgba(255,255,255,${rand(0.15, 0.8) * (1 - yy / (h * 0.6))})`; const s = Math.random() < 0.1 ? 1.6 : 0.9; x.fillRect(rand(0, w), yy, s, s); }
        const mx = w * 0.8, my = h * 0.16, mr = Math.min(w, h) * 0.05;
        const hg = x.createRadialGradient(mx, my, mr, mx, my, mr * 6); hg.addColorStop(0, 'rgba(255,240,220,0.28)'); hg.addColorStop(1, 'rgba(255,240,220,0)');
        x.fillStyle = hg; x.fillRect(mx - mr * 6, my - mr * 6, mr * 12, mr * 12);
        x.fillStyle = '#f4ead8'; x.beginPath(); x.arc(mx, my, mr, 0, TAU); x.fill();
        x.fillStyle = 'rgba(150,140,130,0.25)'; [[0.3, -0.2, 0.25], [-0.35, 0.25, 0.18], [0.1, 0.4, 0.12]].forEach((c) => { x.beginPath(); x.arc(mx + c[0] * mr, my + c[1] * mr, c[2] * mr, 0, TAU); x.fill(); });
      }, 0.5));
      if (S.holding && S.stage >= 2) { // moonlight shafts through the cloud tops
        ctx.globalCompositeOperation = 'lighter';
        const mx = S.W * 0.8, my = S.H * 0.16;
        for (let k = 0; k < 5; k++) {
          const a = Math.PI * 0.62 + k * 0.09 + Math.sin(now * 0.0003 + k) * 0.02, len = S.H;
          ctx.fillStyle = `rgba(230,220,255,${0.035 * (S.stage - 1)})`; ctx.beginPath(); ctx.moveTo(mx, my);
          ctx.lineTo(mx + Math.cos(a - 0.025) * len, my + Math.sin(a - 0.025) * len); ctx.lineTo(mx + Math.cos(a + 0.025) * len, my + Math.sin(a + 0.025) * len); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      const band = (key, top, light, dark, seed, sp) => {
        const c = whClouds(S, key, top, light, dark, seed), off = (now * sp) % c._w;
        ctx.drawImage(c, -off, top, c._w, c._h); ctx.drawImage(c, c._w - off, top, c._w, c._h);
      };
      band('c0', S.H * 0.6, 'rgba(150,130,175,0.9)', 'rgba(52,44,82,1)', 7, 0.006);
      whaleDraw(ctx, d.whales[0], now, 0.75);
      band('c1', S.H * 0.7, 'rgba(190,165,200,0.9)', 'rgba(70,56,96,1)', 19, 0.012);
      d.ships.forEach((a) => airshipDraw(ctx, a, now));
      const tether = d.ships[0], w1 = d.whales[1]; // a harpoon line from an airship to a harnessed whale
      if (w1.lamp && tether.gx) { ctx.strokeStyle = 'rgba(210,180,140,0.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(tether.gx, tether.gy); ctx.quadraticCurveTo((tether.gx + w1.lamp[0]) / 2, Math.max(tether.gy, w1.lamp[1]) + 40, w1.lamp[0], w1.lamp[1]); ctx.stroke(); }
      whaleDraw(ctx, d.whales[2], now, 0.85); whaleDraw(ctx, d.whales[1], now, 1);
      // song rings: sound leaving a singer
      d.sring = d.sring.filter((r) => now - r.t < 2200);
      for (const r of d.sring) { const u = (now - r.t) / 2200; ctx.strokeStyle = `rgba(${r.rgb},${0.5 * (1 - u)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(r.x, r.y, 20 + u * r.R, (20 + u * r.R) * 0.45, 0, 0, TAU); ctx.stroke(); }
      band('c2', S.H * 0.82, 'rgba(225,200,220,0.95)', 'rgba(96,74,118,1)', 31, 0.02);
      if (d.breach) whBreach(S, ctx, now);
      drawPuffs(S, ctx, dt);
      whPanels(S, ctx, now);
    },
    onRelease(S, held, pw) {
      const d = S.data, x = clamp(S.ptr.x || S.cx, S.W * 0.15, S.W * 0.85);
      d.breach = { t: S.now, x0: x - S.W * 0.12, L: baseR(S) * (1.6 + 0.6 * pw), dir: 1, done0: false, done1: false, pw };
      S.ring(x, S.H * 0.86, 260 * pw + 120, [200, 60, 85], 1100);
      d.calls.push({ t0: d.songK, dur: 6, type: 'slap', amp: 1.6 });
      return false;
    },
    hud(S) {
      const d = S.data, n = d.calls.length;
      if (S.holding) return ['the pod turns toward you · listen to the bottom strip',
        'blue-whale calls sit at 10–40 Hz, mostly below human hearing (~20 Hz)',
        'humpback song: units → phrases → themes, from ~100 Hz to several kHz',
        'chorus · low sound rides the SOFAR channel, a sound-speed minimum ~1 km down'][S.stage];
      if (d.breach) return 'breach · 30-odd tonnes of airborne optimism';
      return `${n} call${n === 1 ? '' : 's'} on air · log-f spectrogram 8 Hz–4 kHz at ×6 · rays: Munk profile c(z), axis 1300 m`;
    }
  });
  function whCall(S, w) {
    const d = S.data;
    if (w.kind === 'blue') d.calls.push({ t0: d.songK, dur: 10, type: 'blue', f0: rand(16.5, 18), f1: rand(14.5, 15.5), amp: 1 });
    else {
      const unit = pick(['up', 'down', 'moan', 'whoop']), f0 = unit === 'moan' ? rand(120, 220) : rand(250, 900);
      d.calls.push({ t0: d.songK, dur: rand(1, 3), type: unit, f0, f1: unit === 'up' || unit === 'whoop' ? f0 * rand(1.8, 3.2) : unit === 'down' ? f0 * rand(0.35, 0.6) : f0 * 1.05, amp: 0.8 });
    }
    d.sring.push({ x: w.x + w.dir * w.L * 0.35, y: w.y, t: S.now, R: w.L * (w.kind === 'blue' ? 1.6 : 0.9), rgb: w.kind === 'blue' ? '140,170,255' : '255,200,150' });
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
  function whBreach(S, ctx, now) {
    const b = S.data.breach, u = (now - b.t) / 2800;
    if (u > 1) return;
    const x = b.x0 + S.W * 0.28 * u, y0 = S.H * 0.92, apex = S.H * 0.22, y = y0 - (y0 - apex) * 4 * u * (1 - u);
    const vy = -(y0 - apex) * 4 * (1 - 2 * u), vx = S.W * 0.28;
    const w = { x, y, L: b.L, dir: 1, f: 2.2, ph: 0, hump: true, dark: '#161a33', mid: '#2e3660', belly: '#a9b2d4', tilt: Math.atan2(vy, vx) * 0.85 };
    whaleDraw(ctx, w, now, 1);
    const spray = (sx) => { for (let k = 0; k < 26; k++) puff(S, { x: sx + rand(-b.L * 0.2, b.L * 0.2), y: S.H * 0.86, vx: rand(-3, 3), vy: -rand(2, 9) * b.pw, r0: 10, r1: rand(40, 90), life: rand(1400, 2400), a: 0.6, rgb: '235,225,240', g: 0.08, drag: 0.97 }); };
    if (!b.done0 && u > 0.02) { b.done0 = true; spray(x); }
    if (!b.done1 && u > 0.93) { b.done1 = true; spray(x); S.ring(x, S.H * 0.86, 300, [210, 40, 90], 1200); S.shake(5 * b.pw); }
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
  function dzTower(x, X, base, w, h, style, win, rec) {
    const tiers = [[1, 0.58], [0.74, 0.26], [0.5, 0.12]];
    let y = base;
    x.fillStyle = '#0b0f12';
    tiers.forEach(([ww, hh], ti) => {
      const tw = w * ww, th = h * hh, x0 = X - tw / 2;
      x.fillStyle = '#0b0f12'; x.fillRect(x0, y - th, tw, th);
      x.fillStyle = 'rgba(255,205,130,0.16)'; x.fillRect(x0, y - th, 1, th); // lit edge
      x.strokeStyle = 'rgba(160,170,180,0.07)'; x.lineWidth = 1; x.beginPath();
      for (let k = 1; k < 4; k++) { x.moveTo(x0 + tw * k / 4, y - th + 2); x.lineTo(x0 + tw * k / 4, y); } x.stroke();
      for (let wy = y - th + 6; wy < y - 4; wy += 7) for (let wx = x0 + 4; wx < x0 + tw - 4; wx += 6) {
        if (Math.random() < win) { x.fillStyle = `rgba(255,${Math.round(rand(170, 210))},110,${rand(0.4, 0.9)})`; x.fillRect(wx, wy, 2, 3); }
        else if (rec.length < 700 && Math.random() < 0.25) rec.push([wx, wy]);
      }
      y -= th;
      if (ti === 2) {
        x.fillStyle = '#0b0f12';
        if (style === 0) { x.beginPath(); x.moveTo(X - tw * 0.12, y); x.lineTo(X, y - h * 0.22); x.lineTo(X + tw * 0.12, y); x.fill(); }
        else if (style === 1) { for (let k = 1; k <= 4; k++) x.fillRect(X - tw * (0.5 - k * 0.1), y - k * 6, tw * (1 - k * 0.2), 6); }
        else { x.beginPath(); x.arc(X, y, tw * 0.5, Math.PI, TAU); x.fill(); x.strokeStyle = 'rgba(255,205,130,0.3)'; x.beginPath(); for (let k = 1; k < 8; k++) { const a = Math.PI + k * Math.PI / 8; x.moveTo(X, y); x.lineTo(X + Math.cos(a) * tw * 0.48, y + Math.sin(a) * tw * 0.48); } x.stroke(); }
      }
    });
  }
  function dzCity(S) {
    return layer(S, 'city', S.W, S.H, (x, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#060b10'); g.addColorStop(0.55, '#101a20'); g.addColorStop(0.85, '#3a2a18'); g.addColorStop(1, '#1a120a');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      for (let k = 0; k < 90; k++) { x.fillStyle = `rgba(255,255,240,${rand(0.1, 0.5)})`; x.fillRect(rand(0, w), rand(0, h * 0.45), 1, 1); }
      const rec = (S.data.win = []);
      x.fillStyle = '#141b20'; // far blocks
      for (let X = 0; X < w; X += rand(20, 50)) { const bh = h * rand(0.12, 0.3); x.fillRect(X, h - bh, rand(18, 46), bh); }
      for (let X = -20; X < w + 40; X += rand(55, 120)) { // near towers
        if (Math.abs(X - w / 2) < baseR(S) * 0.45) continue;
        dzTower(x, X, h, rand(40, 90), h * rand(0.25, 0.55) * (1 - 0.4 * Math.abs(X / w - 0.5)), Math.floor(rand(0, 3)), 0.22, rec);
      }
      dzTower(x, w / 2, h, baseR(S) * 0.62, h - S.cy - baseR(S) * 0.25, 2, 0.3, rec); // the tower the sphere crowns
      const fog = x.createLinearGradient(0, h * 0.78, 0, h); fog.addColorStop(0, 'rgba(120,90,60,0)'); fog.addColorStop(1, 'rgba(120,90,60,0.35)');
      x.fillStyle = fog; x.fillRect(0, h * 0.78, w, h * 0.22);
    });
  }
  let DZ_BEAM = null, DZ_ZEP = null;
  function dzSprites() {
    if (DZ_BEAM) return;
    DZ_BEAM = [0, 1].map((amber) => {
      const c = mk(512, 96), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 512, 0);
      const col = amber ? '255,190,110' : '235,240,255';
      g.addColorStop(0, `rgba(${col},0.55)`); g.addColorStop(0.4, `rgba(${col},0.16)`); g.addColorStop(1, `rgba(${col},0)`);
      x.fillStyle = g; x.beginPath(); x.moveTo(0, 46); x.lineTo(512, 0); x.lineTo(512, 96); x.lineTo(0, 50); x.closePath(); x.fill();
      return c;
    });
    DZ_ZEP = mk(240, 80); const x = DZ_ZEP.getContext('2d');
    const g = x.createLinearGradient(0, 8, 0, 60); g.addColorStop(0, '#9aa2a8'); g.addColorStop(0.45, '#5a6268'); g.addColorStop(1, '#1e2226');
    x.fillStyle = '#1e2226'; x.beginPath(); x.moveTo(30, 34); x.lineTo(8, 14); x.lineTo(20, 34); x.lineTo(8, 54); x.closePath(); x.fill(); // fins
    x.fillStyle = g; x.beginPath(); x.ellipse(122, 34, 108, 25, 0, 0, TAU); x.fill();
    x.strokeStyle = 'rgba(20,24,28,0.55)'; x.lineWidth = 1; x.beginPath(); for (let k = 1; k < 12; k++) { const X = 14 + k * 18, hh = 25 * Math.sqrt(Math.max(0, 1 - ((X - 122) / 108) ** 2)); x.moveTo(X, 34 - hh); x.lineTo(X, 34 + hh); } x.stroke();
    x.fillStyle = '#2a2e33'; x.fillRect(100, 56, 44, 10);
    x.fillStyle = 'rgba(255,200,120,0.95)'; for (let k = 0; k < 6; k++) x.fillRect(104 + k * 7, 59, 4, 4);
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
  addMode({
    id: 'pk_diesel', name: 'DIESELPUNK', glyphs: G('◆◇▲▼◢◣◤◥║═╬▮▯', '◆◇▲▼#=|'),
    base: [42, 60, 80], palette: [[42, 100, 62], [190, 60, 70], [8, 85, 58], [48, 70, 86]],
    links: ['line', 'zipper', 'pk_beam', 'lightning'], opaque: true, count: 72, noHueShift: true, pageBg: ['#131a1e', '#050607'],
    shapes: ['sphere', 'crown', 'cuboctahedron', 'torus', 'rhombic_dodecahedron', 'sunflower', 'cube', 'trefoil'],
    init(S) {
      dzSprites();
      Object.assign(S.data, { phi: 0, rpm: 700, rc: 1.8, beams: [0.05, 0.22, 0.5, 0.78, 0.95].map((f, i) => ({ f, a: -Math.PI / 2, i })), zep: [{ x: S.W * 0.2, y: S.H * 0.17, s: 0.8, dir: 1, sp: 0.01 }, { x: S.W * 0.85, y: S.H * 0.33, s: 0.5, dir: -1, sp: 0.007 }], fan: -1e9, puffs: [], lastSt: 0, eta: dzNumEta(1.8), etaK: 0, trail: [] });
    },
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
      const s = dzState(d.phi, d.rc);
      if (s.st === 3 && d.lastSt !== 3) for (let k = 0; k < 5; k++) puff(S, { x: d.L.px + 30, y: d.L.py - 4, vx: rand(-0.4, 0.4), vy: -rand(0.8, 1.8), r0: 4, r1: rand(18, 34), life: 1800, a: 0.45, rgb: '70,66,60', wind: -0.01 });
      d.lastSt = s.st; d.s = s;
      // searchlights: sweep, follow the pointer, converge on the sphere while held, fan out on release
      const fan = now - d.fan < 1800;
      d.beams.forEach((b) => {
        const sx = S.W * b.f, sy = S.H + 10;
        let t = -Math.PI / 2 + 0.45 * Math.sin(now * 0.00045 * (1 + b.i * 0.17) + b.i * 1.3);
        if (fan) t = -Math.PI / 2 + (b.i - 2) * 0.38;
        else if (S.holding) t = Math.atan2(S.cy + Math.sin(now * 0.002 + b.i) * S.R * 0.2 - sy, S.cx + Math.cos(now * 0.002 + b.i) * S.R * 0.2 - sx);
        else if (S.ptrInside && Math.abs(S.ptr.x - sx) < S.W * 0.32) t = Math.atan2(S.ptr.y - sy, S.ptr.x - sx);
        b.a += wrapA(t - b.a) * ease(dt, fan ? 250 : 520);
      });
      d.zep.forEach((z) => { z.x += z.dir * z.sp * dt * (S.W / 1000); if (z.x > S.W + 140) z.x = -140; if (z.x < -140) z.x = S.W + 140; });
    },
    background(S, ctx, now, dt) {
      const d = S.data, L = d.L;
      if (!L) return;
      blit(ctx, dzCity(S));
      const p = power(S);
      if (p > 0 && d.win) { // the city wakes up window by window
        const n = Math.floor(d.win.length * p);
        ctx.fillStyle = 'rgba(255,200,110,0.85)';
        for (let i = 0; i < n; i++) ctx.fillRect(d.win[i][0], d.win[i][1], 2, 3);
      }
      d.zep.forEach((z) => { // zeppelins, lit up when a beam crosses them
        const w = 240 * z.s, h = 80 * z.s;
        ctx.save(); ctx.translate(z.x, z.y); ctx.scale(z.dir, 1); ctx.drawImage(DZ_ZEP, -w / 2, -h / 2, w, h); ctx.restore();
        let lit = 0; d.beams.forEach((b) => { const a = Math.atan2(z.y - S.H - 10, z.x - S.W * b.f); lit = Math.max(lit, 1 - Math.abs(wrapA(a - b.a)) / 0.08); });
        ctx.globalCompositeOperation = 'lighter';
        if (lit > 0) drawGlow(ctx, '255,240,210', z.x, z.y, w * 0.45, lit * 0.35);
        if (Math.floor(now / 700 + z.s * 10) % 2 === 0) drawGlow(ctx, '255,40,30', z.x - z.dir * w * 0.45, z.y, 6, 0.9);
        ctx.globalCompositeOperation = 'source-over';
      });
      ctx.globalCompositeOperation = 'lighter';
      const amber = S.holding && S.stage >= 3 ? 1 : 0, len = S.H * 1.3;
      d.beams.forEach((b) => { ctx.save(); ctx.translate(S.W * b.f, S.H + 10); ctx.rotate(b.a); ctx.globalAlpha = 0.75; ctx.drawImage(DZ_BEAM[amber], 0, -len * 0.095, len, len * 0.19); ctx.restore(); });
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      drawPuffs(S, ctx, dt);
      dzPanel(S, ctx, now);
    },
    under(S, ctx, now) {
      const u = (now - S.data.fan) / 1800;
      if (u < 0 || u > 1) return;
      ctx.globalCompositeOperation = 'lighter'; // an art-deco sunburst from the sphere
      const R = S.R * 0.6 + Math.max(S.W, S.H) * Math.sqrt(u), rot = u * 0.4;
      ctx.fillStyle = `rgba(255,200,110,${0.22 * (1 - u)})`; ctx.beginPath();
      for (let k = 0; k < 28; k += 2) { const a0 = rot + k * TAU / 28, a1 = a0 + TAU / 28; ctx.moveTo(S.cx, S.cy); ctx.arc(S.cx, S.cy, R, a0, a1); ctx.closePath(); }
      ctx.fill(); ctx.globalCompositeOperation = 'source-over';
    },
    onRelease(S, held, pw) {
      S.data.fan = S.now;
      S.ring(S.cx, S.cy, 300 + 200 * pw, [42, 100, 70], 1200);
      S.active.forEach((n) => { if (n.inf) S.spawn(n.sx, n.sy, (n.sx - S.cx) * 0.03 * pw, (n.sy - S.cy) * 0.03 * pw, 'rgba(255,210,130,1)', rand(600, 1200), rand(1.5, 2.5), { drag: 0.96 }); });
      S.flash(0.12 * pw, '255,210,140');
      return false;
    },
    hud(S) {
      const d = S.data, eta = (dzEta(d.rc) * 100).toFixed(1), num = (d.eta * 100).toFixed(1), rpm = fmt(d.rpm);
      if (S.holding) return [`more fuel: cut-off rc = ${d.rc.toFixed(2)} · a fatter loop, more work W = ∮P dV`,
        `rc = ${d.rc.toFixed(2)} · η = ${eta}% · ${rpm} rpm · the searchlights found you`,
        `rc = ${d.rc.toFixed(2)} · η falls to ${eta}% (power rises anyway) · compression alone lights the fuel`,
        `rc = ${d.rc.toFixed(2)} · ${rpm} rpm · η ${eta}% · full throttle over the skyline`][S.stage];
      return `Diesel cycle r = 18, rc = ${d.rc.toFixed(2)} · η = 1 − (rc^γ−1)/(γr^(γ−1)(rc−1)) = ${eta}% · ∮P dV/Q = ${num}% · ${rpm} rpm (×1/${DZ_SLOW})`;
    }
  });
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

  /* ======================= 5. SOLARPUNK ======================= */
  // The sun is the pointer. A panel delivers P = P0·cos θ (θ: angle between its normal and the sun), times a clear-sky
  // irradiance that fades with air mass AM = 1/cos(zenith) (Meinel: I = 1.353·0.7^(AM^0.678) kW/m²). Trackers turn to
  // face the sun; the fixed panels lie flat. Leaves sprout around infected letters at the golden angle, 137.5°.
  const GOLD_A = Math.PI * (3 - Math.sqrt(5));
  function slLayout(S) {
    const hy = S.H * 0.74, b = [], panels = [], turb = [];
    for (let X = -10; X < S.W + 20;) {
      const w = rand(55, 125), mid = Math.abs(X + w / 2 - S.cx) < baseR(S) * 0.5, h = S.H * (mid ? rand(0.1, 0.16) : rand(0.16, 0.42)) * (1 - 0.3 * Math.abs((X + w / 2) / S.W - 0.5));
      b.push({ x: X, w, h, top: hy + S.H * 0.06 - h, roof: Math.random() });
      X += w + rand(6, 22);
    }
    b.forEach((q, i) => {
      if (q.roof < 0.55) { const n = Math.max(1, Math.floor((q.w - 10) / 24)); for (let k = 0; k < n; k++) panels.push({ x: q.x + 12 + k * (q.w - 20) / Math.max(1, n - 1 || 1) * (n > 1 ? 1 : 0) + (n === 1 ? q.w / 2 - 12 : 0), y: q.top - 8, track: i % 2 === 0, a: -Math.PI / 2, out: 0 }); }
      else if (q.roof > 0.85) turb.push({ x: q.x + q.w / 2, y: q.top - S.H * 0.08, r: S.H * 0.04, a: rand(0, TAU) });
    });
    return { hy, b, panels, turb, key: S.W + 'x' + S.H + '@' + S.DPR };
  }
  function slCity(S, L) {
    return layer(S, 'city', S.W, S.H, (x, w, h) => {
      x.fillStyle = 'rgba(40,90,90,0.55)'; x.beginPath(); x.moveTo(0, L.hy); // distant hills
      for (let X = 0; X <= w; X += 20) x.lineTo(X, L.hy - h * (0.05 + 0.04 * Math.sin(X * 0.006) + 0.02 * Math.sin(X * 0.017 + 2)));
      x.lineTo(w, h); x.lineTo(0, h); x.fill();
      const gr = x.createLinearGradient(0, L.hy, 0, h); gr.addColorStop(0, '#1c4a32'); gr.addColorStop(1, '#0a1a12');
      x.fillStyle = gr; x.fillRect(0, L.hy + h * 0.05, w, h);
      for (const q of L.b) {
        const g = x.createLinearGradient(q.x, 0, q.x + q.w, 0); g.addColorStop(0, '#1d4a44'); g.addColorStop(0.5, '#153a36'); g.addColorStop(1, '#0e2a27');
        x.fillStyle = g; x.beginPath();
        if (x.roundRect) x.roundRect(q.x, q.top, q.w, q.h + h, [14, 14, 0, 0]); else x.rect(q.x, q.top, q.w, q.h + h);
        x.fill();
        x.fillStyle = 'rgba(140,220,200,0.12)'; for (let yy = q.top + 10; yy < h; yy += 12) x.fillRect(q.x + 6, yy, q.w - 12, 4); // glass bands
        for (let yy = q.top + 26; yy < h - 10; yy += 38) { // terraces with planters and hanging vines
          x.fillStyle = '#0c2420'; x.fillRect(q.x - 4, yy, q.w + 8, 3);
          for (let xx = q.x; xx < q.x + q.w; xx += 7) { x.fillStyle = `hsl(${rand(95, 140)},${rand(40, 65)}%,${rand(22, 38)}%)`; x.beginPath(); x.arc(xx + rand(0, 4), yy - 2, rand(3, 6), 0, TAU); x.fill(); }
          x.strokeStyle = 'rgba(70,150,80,0.55)'; x.lineWidth = 1; x.beginPath(); for (let k = 0; k < 4; k++) { const xx = q.x + rand(0, q.w); x.moveTo(xx, yy + 2); x.quadraticCurveTo(xx + rand(-4, 4), yy + 12, xx + rand(-3, 3), yy + rand(10, 28)); } x.stroke();
        }
        if (q.roof >= 0.55 && q.roof <= 0.85) for (let k = 0; k < 4; k++) { x.fillStyle = `hsl(${rand(90, 130)},55%,${rand(26, 40)}%)`; x.beginPath(); x.arc(q.x + q.w * (0.2 + k * 0.2), q.top - rand(4, 14), rand(8, 15), 0, TAU); x.fill(); }
      }
      x.strokeStyle = 'rgba(220,230,220,0.6)'; x.lineWidth = 2; L.turb.forEach((t) => { x.beginPath(); x.moveTo(t.x, t.y); x.lineTo(t.x, t.y + S.H * 0.08); x.stroke(); });
    });
  }
  addMode({
    id: 'pk_solar', name: 'SOLARPUNK', glyphs: G('❦❧✿❀❁✾☘⚘♣✽', '*+oO&'),
    base: [55, 45, 88], palette: [[110, 70, 55], [80, 85, 55], [45, 100, 62], [330, 75, 72], [160, 65, 52]],
    links: ['line', 'vine', 'roots', 'vine'], opaque: true, count: 110, noHueShift: true, pageBg: ['#0d2a22', '#04100c'],
    shapes: ['sunflower', 'sphere', 'rose', 'torus', 'seashell', 'heart', 'helix', 'dodecahedron'],
    init(S) { Object.assign(S.data, { sun: { x: S.W * 0.7, y: S.H * 0.25 }, phot: [], seeds: [], flare: -1e9, avgT: 0, avgF: 0 }); },
    update(S, now, dt) {
      const d = S.data;
      if (!d.L || d.L.key !== S.W + 'x' + S.H + '@' + S.DPR) { d.L = slLayout(S); delete d._city; }
      const L = d.L;
      // the sun: the pointer when there is one, otherwise a slow day arc
      let tx, ty;
      if (hasPtr(S)) { tx = S.ptr.x; ty = S.ptr.y; } else { const u = (now * 0.00003) % 1; tx = S.W * (0.06 + 0.88 * u); ty = L.hy - S.H * 0.62 * Math.sin(Math.PI * u) + 20; }
      d.sun.x += (tx - d.sun.x) * ease(dt, 260); d.sun.y += (ty - d.sun.y) * ease(dt, 260);
      d.elev = Math.atan2(L.hy - d.sun.y, S.W * 0.35) * 180 / Math.PI;
      const zen = (90 - clamp(d.elev, 0.5, 90)) * Math.PI / 180, AM = 1 / Math.cos(zen);
      d.AM = AM; d.I = d.elev > 0 ? 1.353 * Math.pow(0.7, Math.pow(AM, 0.678)) : 0; // kW/m², Meinel clear-sky model
      let sT = 0, sF = 0, nT = 0, nF = 0;
      for (const p of L.panels) {
        const aT = Math.atan2(d.sun.y - p.y, d.sun.x - p.x);
        if (p.track) p.a += wrapA(clamp(aT, -Math.PI / 2 - 1.3, -Math.PI / 2 + 1.3) - p.a) * ease(dt, 700);
        p.cos = d.elev > 0 ? Math.max(0, Math.cos(p.a - aT)) : 0;
        if (p.track) { sT += p.cos; nT++; } else { sF += p.cos; nF++; }
      }
      d.avgT = nT ? sT / nT : 0; d.avgF = nF ? sF / nF : 0;
      // leaves grow on infected letters and linger; blooms open at stage III
      for (const n of S.active) {
        const q = n.data;
        if (q.a0 === undefined) { q.a0 = rand(0, TAU); q.vg = 0; q.bl = 0; }
        if (n.inf) q.vg = Math.min(1, q.vg + dt / 1700 * (1 + S.stage * 0.7)); else q.vg = Math.max(0, q.vg - dt / 9000);
        if (n.inf && S.stage >= 3) q.bl = Math.min(1, q.bl + dt / 700); else q.bl = Math.max(0, q.bl - dt / 6000);
      }
      if (S.holding && S.stage >= 1) for (let k = 0; k < S.stage * 2; k++) { // photons from the sun to leaves and panels
        const toPanel = Math.random() < 0.4 && L.panels.length, t = toPanel ? pick(L.panels) : pick(S.active);
        if (t && d.phot.length < 160) d.phot.push({ x0: d.sun.x, y0: d.sun.y, n: toPanel ? null : t, x1: t.x, y1: t.y, t: now, life: rand(350, 700) });
      }
      d.phot = d.phot.filter((p) => now - p.t < p.life);
      const k = dt / 16.7, wind = 0.5 + 0.4 * Math.sin(now * 0.0005) + clamp(pvel(S).x, -20, 20) * 0.03;
      d.seeds = d.seeds.filter((s) => now - s.t < s.life);
      for (const s of d.seeds) { s.vx += (wind - s.vx) * 0.02 * k; s.vy += (-0.35 + 0.25 * Math.sin(now * 0.003 + s.ph) - s.vy) * 0.03 * k; repel(S, s, 90, 0.4); s.x += s.vx * k; s.y += s.vy * k; s.rot = Math.sin(now * 0.004 + s.ph) * 0.4; }
      L.turb.forEach((t) => (t.a += (0.002 + Math.abs(wind) * 0.004 + (S.holding ? 0.004 * S.stage : 0)) * dt));
    },
    background(S, ctx, now) {
      const d = S.data, L = d.L;
      if (!L) return;
      const day = smooth(-4, 35, d.elev), gold = smooth(-3, 6, d.elev) * (1 - smooth(18, 45, d.elev));
      const top = [lerp(6, 24, day), lerp(16, 78, day), lerp(28, 96, day)], hor = [lerp(16, 120, day) + 150 * gold, lerp(40, 170, day) + 40 * gold, lerp(48, 150, day) - 40 * gold];
      const g = ctx.createLinearGradient(0, 0, 0, L.hy);
      g.addColorStop(0, `rgb(${top.map(Math.round)})`); g.addColorStop(1, `rgb(${hor.map((v) => Math.round(clamp(v, 0, 255)))})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, S.W, S.H);
      ctx.globalCompositeOperation = 'lighter';
      const s = d.sun, f = now - d.flare < 1500 ? 1 - (now - d.flare) / 1500 : 0;
      drawGlow(ctx, '255,200,120', s.x, s.y, 240 + 80 * f, 0.45 + 0.3 * f); drawGlow(ctx, '255,240,200', s.x, s.y, 60, 0.9);
      ctx.fillStyle = 'rgba(255,250,230,0.95)'; ctx.beginPath(); ctx.arc(s.x, s.y, 14, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      blit(ctx, slCity(S, L));
      // wind turbines
      ctx.strokeStyle = 'rgba(235,240,235,0.85)'; ctx.lineWidth = 2; ctx.beginPath();
      L.turb.forEach((t) => { for (let k = 0; k < 3; k++) { const a = t.a + k * TAU / 3; ctx.moveTo(t.x, t.y); ctx.lineTo(t.x + Math.cos(a) * t.r, t.y + Math.sin(a) * t.r); } }); ctx.stroke();
      // solar panels: posts, faces turned along their normal, glints when they look straight at the sun
      for (const p of L.panels) {
        const tx = -Math.sin(p.a) * 11, ty = Math.cos(p.a) * 11;
        ctx.strokeStyle = '#2b3a3a'; ctx.lineWidth = 2; S.line(p.x, p.y + 8, p.x, p.y);
        ctx.strokeStyle = p.track ? '#203c66' : '#2a3550'; ctx.lineWidth = 4; S.line(p.x - tx, p.y - ty, p.x + tx, p.y + ty);
        const gl = Math.pow(p.cos, 10) + f * 0.6;
        if (gl > 0.05) { ctx.strokeStyle = `rgba(190,230,255,${Math.min(1, gl) * 0.85})`; ctx.lineWidth = 2; S.line(p.x - tx, p.y - ty, p.x + tx, p.y + ty); }
      }
      ctx.globalCompositeOperation = 'lighter';
      for (const p of L.panels) if (p.cos > 0.985) drawGlow(ctx, '220,240,255', p.x, p.y, 16, (p.cos - 0.985) * 40);
      ctx.globalCompositeOperation = 'source-over';
      // output meter: trackers versus flat panels
      const mx = S.W - 190, my = 100;
      panel(ctx, mx - 10, my - 18, 186, 58, 0.55, 'rgba(160,230,190,0.25)');
      ctx.font = '10px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      [['tracking', d.avgT, '#8fe3a8'], ['flat', d.avgF, '#e3c88f']].forEach(([lab, v, c], i) => {
        ctx.fillStyle = 'rgba(220,240,230,0.75)'; ctx.fillText(lab, mx, my + i * 18 - 4);
        ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(mx + 62, my + i * 18 - 8, 100, 8);
        ctx.fillStyle = c; ctx.fillRect(mx + 62, my + i * 18 - 8, 100 * v * (d.I / 1.0), 8);
      });
      ctx.fillStyle = 'rgba(220,240,230,0.6)'; ctx.fillText(`cos θ · I(AM ${d.AM > 9 ? '>9' : d.AM.toFixed(1)}) = ${d.I.toFixed(2)} kW/m²`, mx - 2, my - 9 - 2 + 36 + 6);
    },
    drawNode(S, ctx, n, g, size, a) {
      const q = n.data, v = q.vg || 0;
      if (v > 0.02) { // leaves at the golden angle: each new leaf turns 137.5° from the last
        const cnt = Math.ceil(v * 6);
        ctx.fillStyle = `hsla(${110 + (n.gen % 3) * 12},62%,${36 + 8 * v}%,${a * 0.9})`; ctx.beginPath();
        for (let k = 0; k < cnt; k++) {
          const ang = q.a0 + k * GOLD_A, rr = size * (0.5 + 0.07 * k), L = size * 0.32 * clamp(v * 6 - k, 0, 1), cx = n.sx + Math.cos(ang) * rr, cy = n.sy + Math.sin(ang) * rr;
          if (L < 0.5) continue;
          ctx.moveTo(cx + Math.cos(ang) * L, cy + Math.sin(ang) * L); ctx.ellipse(cx, cy, L, L * 0.42, ang, 0, TAU);
        }
        ctx.fill();
      }
      ctx.font = `${size.toFixed(1)}px monospace`; ctx.fillStyle = n.inf ? S.colorOf(n.gen, a) : `rgba(245,240,215,${a})`; ctx.fillText(g, n.sx, n.sy);
      if (q.bl > 0.05) { // a five-petal bloom
        const bx = n.sx + size * 0.45, by = n.sy - size * 0.45, r = size * 0.22 * q.bl;
        ctx.fillStyle = `hsla(${330 + (n.gen % 4) * 12},80%,75%,${a * q.bl})`; ctx.beginPath();
        for (let k = 0; k < 5; k++) { const an = k * TAU / 5 + q.a0; const px = bx + Math.cos(an) * r, py = by + Math.sin(an) * r; ctx.moveTo(px + r * 0.7, py); ctx.arc(px, py, r * 0.7, 0, TAU); }
        ctx.fill(); ctx.fillStyle = `rgba(255,220,90,${a * q.bl})`; ctx.fillRect(bx - r * 0.4, by - r * 0.4, r * 0.8, r * 0.8);
      }
      return true;
    },
    over(S, ctx, now) {
      const d = S.data;
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,230,140,0.9)';
      for (const p of d.phot) { const u = (now - p.t) / p.life, x1 = p.n ? p.n.sx : p.x1, y1 = p.n ? p.n.sy : p.y1; ctx.fillRect(lerp(p.x0, x1, u) - 1, lerp(p.y0, y1, u) - 1, 2.2, 2.2); }
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(240,240,230,0.8)'; ctx.fillStyle = 'rgba(255,255,245,0.85)'; ctx.lineWidth = 0.7; // dandelion seeds
      for (const s of d.seeds) {
        const a = 1 - (now - s.t) / s.life; ctx.globalAlpha = Math.min(1, a * 2);
        const c = Math.cos(s.rot), sn = Math.sin(s.rot), bx = s.x + sn * 9, by = s.y + c * 9;
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(bx, by);
        for (let k = 0; k < 7; k++) { const an = -Math.PI / 2 + s.rot + (k - 3) * 0.42; ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + Math.cos(an) * 6, s.y + Math.sin(an) * 6); }
        ctx.stroke(); ctx.fillRect(bx - 1, by - 1, 2, 2);
      }
      ctx.globalAlpha = 1;
    },
    onRelease(S, held, pw) {
      const d = S.data; d.flare = S.now;
      S.active.forEach((n) => { if (n.inf || (n.data.vg || 0) > 0.3) for (let k = 0; k < (S.stage >= 2 || pw > 0.8 ? 2 : 1); k++) if (d.seeds.length < 150) d.seeds.push({ x: n.sx, y: n.sy, vx: rand(-1.5, 1.5), vy: rand(-2.5, -0.5), t: S.now, life: rand(4000, 7000), ph: rand(0, TAU), rot: 0 }); });
      S.ring(d.sun.x, d.sun.y, 200 + 200 * pw, [50, 100, 70], 1200);
      S.ring(S.cx, S.cy, 220 + 200 * pw, [110, 70, 55], 1000);
      return false;
    },
    hud(S) {
      const d = S.data;
      if (d.elev === undefined) return '';
      const gain = d.avgF > 0.01 ? ((d.avgT / d.avgF - 1) * 100).toFixed(0) + '%' : '∞';
      if (S.holding) return ['photons inbound · 6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂',
        `leaves turn 137.5° (the golden angle) each, so no leaf shades the one below`,
        `trackers ${(d.avgT * 100).toFixed(0)}% vs flat ${(d.avgF * 100).toFixed(0)}% of peak · tracking gain ${gain}`,
        'full bloom · the city runs on sunlight, the letters run on chlorophyll'][S.stage];
      if (d.seeds.length) return `${d.seeds.length} seeds aloft · wind dispersal, zero emissions`;
      return `sun ${d.elev.toFixed(0)}° up · P = P₀·cos θ · trackers ${(d.avgT * 100).toFixed(0)}% · flat ${(d.avgF * 100).toFixed(0)}% · air mass ${d.AM > 9 ? '>9' : d.AM.toFixed(2)} · move the sun`;
    }
  });

  /* ======================= 6. BIOPUNK ======================= */
  // Each dish grows by the logistic law dN/dt = rN(1 − N/K), stepped with its exact solution
  // N(t+Δt) = K / (1 + (K/N − 1)·e^(−rΔt)), so any frame rate gives the same curve. r = ln2 per hour: doubling time 1 h.
  // The helix has 10.5 base pairs per turn (B-DNA). Point mutations are transitions (A↔G, C↔T) twice as often as transversions.
  // Cas9 finds a 5′-NGG-3′ PAM and cuts 3 bp upstream of it.
  const BIO_K = 1e9, BIO_R = Math.LN2, BIO_M = 720, BIO_BP = 42, BIO_TURN = 10.5;
  const COMP = { A: 'T', T: 'A', C: 'G', G: 'C' }, BCOL = { A: '90,209,255', T: '255,209,102', C: '125,255,138', G: '255,111,216' };
  const TRANSITION = { A: 'G', G: 'A', C: 'T', T: 'C' };
  function bioDish(S, x, y, r, hue, name) {
    const dots = [], nc = 6, cs = [];
    for (let c = 0; c < nc; c++) { const a = rand(0, TAU), rr = Math.sqrt(Math.random()) * r * 0.62; cs.push([Math.cos(a) * rr, Math.sin(a) * rr, r * rand(0.16, 0.3)]); }
    for (let i = 0; i < BIO_M; i++) {
      const c = cs[i % nc], rank = Math.floor(i / nc) / (BIO_M / nc), a = rand(0, TAU), rr = c[2] * Math.sqrt(rank) * rand(0.85, 1.12);
      let X = c[0] + Math.cos(a) * rr, Y = c[1] + Math.sin(a) * rr; const m = Math.hypot(X, Y);
      if (m > r * 0.9) { X *= r * 0.9 / m; Y *= r * 0.9 / m; }
      dots.push([X, Y, Math.random()]);
    }
    const cv = mk(r * 2 * S.DPR, r * 2 * S.DPR), cx = cv.getContext('2d'); cx.scale(S.DPR, S.DPR); cx.translate(r, r);
    return { x, y, r, hue, name, N: 2e7, dots, cv, cx, drawn: 0, sat: 0, pass: -1e9 };
  }
  function bioDots(dish, target) {
    if (target < dish.drawn) { dish.cx.clearRect(-dish.r, -dish.r, dish.r * 2, dish.r * 2); dish.drawn = 0; }
    for (let i = dish.drawn; i < target; i++) {
      const p = dish.dots[i];
      dish.cx.fillStyle = `hsla(${dish.hue + p[2] * 20},${70 + p[2] * 20}%,${55 + p[2] * 20}%,0.9)`;
      const s = p[2] > 0.85 ? 3 : 2; dish.cx.fillRect(p[0] - s / 2, p[1] - s / 2, s, s);
    }
    dish.drawn = Math.max(dish.drawn, target);
  }
  addMode({
    id: 'pk_bio', name: 'BIOPUNK', glyphs: G('ACGTUACGTΨ⌬', 'ACGTU'),
    base: [165, 40, 82], palette: [[130, 100, 58], [310, 90, 64], [185, 100, 58], [58, 100, 62]],
    links: ['dna', 'dna', 'membrane', 'tentacle'], opaque: true, count: 'random', pageBg: ['#04181c', '#0b0414'],
    shapes: ['helix', 'sphere', 'torus_knot', 'gyroid', 'catenoid', 'trefoil', 'buckyball', 'boy'],
    init(S) {
      const seq = Array.from({ length: BIO_BP }, () => pick(BASES_ARR));
      Object.assign(S.data, { seq, scroll: 0, mut: 0, ts: 0, tv: 0, lastMut: null, nextMut: 0, flash: {}, tH: 0, pam: -1, cut: -1, ins: null, puffs: [] });
    },
    update(S, now, dt) {
      const d = S.data;
      if (!d.dishes || d.key !== S.W + 'x' + S.H + '@' + S.DPR) {
        const m = Math.min(S.W, S.H * 1.4);
        d.key = S.W + 'x' + S.H + '@' + S.DPR;
        d.dishes = [bioDish(S, S.W * 0.12, S.H * 0.36, m * 0.08, 95, 'A'), bioDish(S, S.W * 0.875, S.H * 0.36, m * 0.095, 300, 'B'), bioDish(S, S.W * 0.86, S.H * 0.68, m * 0.065, 190, 'C')];
      }
      // incubator: sea... er, lab time runs at 0.25 h per second, faster while held
      const speed = 0.25 * (S.holding ? [2, 4, 8, 16][S.stage] : 1), dtH = speed * dt / 1000;
      d.tH += dtH; d.speed = speed;
      for (const p of d.dishes) {
        p.N = BIO_K / (1 + (BIO_K / p.N - 1) * Math.exp(-BIO_R * dtH));
        if (p.N > 0.985 * BIO_K) { p.sat += dt; if (p.sat > 3500 && !S.holding) { p.N /= 100; p.sat = 0; p.pass = now; } } else p.sat = 0; // serial passage, 1:100
        bioDots(p, Math.floor(BIO_M * p.N / BIO_K));
      }
      // the helix scrolls; point mutations land now and then (more under stress)
      d.scroll = (d.scroll + dt * 0.02) % 1e6;
      if (now > d.nextMut) {
        d.nextMut = now + rand(900, 2200) / (1 + (S.holding ? S.stage : 0));
        const i = Math.floor(rand(0, BIO_BP)), b = d.seq[i];
        if (i !== d.pam && i !== d.pam + 1 && i !== d.pam + 2) {
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
      for (const p of d.dishes) if (S.holding && S.stage >= 3 && Math.random() < 0.15) puff(S, { x: p.x + rand(-p.r, p.r) * 0.6, y: p.y + rand(-p.r, p.r) * 0.6, vx: rand(-0.5, 0.5), vy: -rand(0.3, 1), r0: 2, r1: rand(10, 22), life: 1400, a: 0.5, rgb: hsl2rgb(p.hue, 90, 60).join(','), drag: 0.99 });
    },
    background(S, ctx, now, dt) {
      const d = S.data;
      if (!d.dishes) return;
      blit(ctx, layer(S, 'lab', S.W, S.H, (x, w, h) => {
        const g = x.createRadialGradient(w / 2, h * 0.5, 0, w / 2, h / 2, Math.hypot(w, h) * 0.6); g.addColorStop(0, '#0a2a2e'); g.addColorStop(1, '#05070e');
        x.fillStyle = g; x.fillRect(0, 0, w, h);
        x.strokeStyle = 'rgba(80,255,200,0.05)'; x.lineWidth = 1; x.beginPath(); // hex grid
        const s = 26, hh = s * Math.sqrt(3) / 2;
        for (let r = 0, Y = 0; Y < h + s; r++, Y += hh) for (let X = (r % 2) * s * 1.5; X < w + s; X += s * 3) { for (let k = 0; k <= 6; k++) { const a = k * Math.PI / 3, px = X + Math.cos(a) * s / 2 * 1.15, py = Y + Math.sin(a) * s / 2 * 1.15; if (k) x.lineTo(px, py); else x.moveTo(px, py); } }
        x.stroke();
        d.dishes.forEach((p) => { // agar plates
          const ag = x.createRadialGradient(p.x - p.r * 0.3, p.y - p.r * 0.3, 0, p.x, p.y, p.r); ag.addColorStop(0, 'rgba(210,180,110,0.28)'); ag.addColorStop(1, 'rgba(140,110,60,0.18)');
          x.fillStyle = ag; x.beginPath(); x.arc(p.x, p.y, p.r, 0, TAU); x.fill();
          x.strokeStyle = 'rgba(220,240,255,0.5)'; x.lineWidth = 2; x.stroke();
          x.strokeStyle = 'rgba(220,240,255,0.18)'; x.lineWidth = 1; x.beginPath(); x.arc(p.x, p.y, p.r + 5, 0, TAU); x.stroke();
          x.save(); x.translate(p.x, p.y + p.r + 12); x.fillStyle = 'rgba(240,235,200,0.75)'; x.fillRect(-34, -6, 68, 12);
          x.fillStyle = '#1a1a1a'; x.font = '9px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(`pk-0${p.name === 'A' ? 7 : p.name === 'B' ? 3 : 9} · LB agar`, 0, 0); x.restore();
        });
      }));
      ctx.globalCompositeOperation = 'lighter';
      for (const p of d.dishes) {
        ctx.drawImage(p.cv, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
        if (S.holding && S.stage >= 3) drawGlow(ctx, hsl2rgb(p.hue, 100, 55).join(','), p.x, p.y, p.r * 1.6, 0.25 + 0.1 * Math.sin(now * 0.006));
        const pt = now - p.pass;
        if (pt < 1200) { ctx.strokeStyle = `rgba(200,255,240,${0.7 * (1 - pt / 1200)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.2 + pt / 1200 * 0.8), 0, TAU); ctx.stroke(); }
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(220,255,240,0.7)';
      for (const p of d.dishes) ctx.fillText(`N ${sci(p.N)}${now - p.pass < 1500 ? ' · passaged 1:100' : ''}`, p.x, p.y - p.r - 10);
      bioHelix(S, ctx, now);
      drawPuffs(S, ctx, dt, 'lighter');
    },
    over(S, ctx) { // microscope reticle at the pointer
      if (!hasPtr(S)) return;
      const x = S.ptr.x, y = S.ptr.y, d = S.data;
      ctx.strokeStyle = 'rgba(180,255,230,0.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 40, 0, TAU);
      ctx.moveTo(x - 48, y); ctx.lineTo(x - 30, y); ctx.moveTo(x + 30, y); ctx.lineTo(x + 48, y); ctx.moveTo(x, y - 48); ctx.lineTo(x, y - 30); ctx.moveTo(x, y + 30); ctx.lineTo(x, y + 48); ctx.stroke();
      ctx.fillStyle = 'rgba(180,255,230,0.8)'; ctx.fillRect(x + 14, y + 26, 20, 2); ctx.font = '9px monospace'; ctx.textAlign = 'left'; ctx.fillText('10 µm', x + 14, y + 36);
      for (const p of d.dishes || []) if (Math.hypot(x - p.x, y - p.y) < p.r) { ctx.fillText(`dish ${p.name} · N/K = ${(p.N / BIO_K * 100).toFixed(1)}%`, x + 46, y - 6); }
    },
    onRelease(S, held, pw) {
      const d = S.data;
      if (d.cut >= 0) { // splice: insert a fluorescent reporter at the cut, plate the new strain
        d.ins = { i: d.cut, t: S.now };
        d.dishes.forEach((p) => { p.hue = 115 + rand(-10, 10); p.N = 1e7; p.drawn = BIO_M + 1; p.pass = S.now; });
        S.ring(S.cx, S.H * 0.11, 300 * pw, [130, 100, 60], 900);
      }
      d.dishes.forEach((p) => { for (let k = 0; k < 14 * pw; k++) puff(S, { x: p.x, y: p.y, vx: rand(-3, 3), vy: rand(-3, 3), r0: 2, r1: rand(8, 20), life: rand(900, 1600), a: 0.6, rgb: hsl2rgb(p.hue, 90, 60).join(','), drag: 0.96 }); });
      S.active.forEach((n) => { if (n.inf && Math.random() < 0.6) puff(S, { x: n.sx, y: n.sy, vx: rand(-2, 2), vy: rand(-2, 2), r0: 2, r1: 14, life: 900, a: 0.5, rgb: '120,255,170', drag: 0.95 }); });
      d.pam = -1; d.cut = -1;
      return false;
    },
    hud(S) {
      const d = S.data;
      if (!d.dishes) return '';
      const A = d.dishes[0];
      if (S.holding) return [`incubator ×${(d.speed / 0.25).toFixed(0)} · dish A at ${sci(A.N)} cells · growth slows as N → K`,
        `${d.mut} mutations so far · ${d.ts} transitions : ${d.tv} transversions (expect ≈ 2:1)`,
        'Cas9 locked on 5′-NGG-3′ · 20-nt guide RNA base-pairs with the target',
        `double-strand break 3 bp upstream of the PAM (bp ${1200 + d.cut}) · let go to splice`][S.stage];
      if (d.ins && S.now - d.ins.t < 5000) return 'spliced: reporter gene inserted · new strain plated · watch it glow';
      return `dN/dt = rN(1 − N/K) · r = ln2 h⁻¹ (t_d = 60 min) · A ${sci(A.N)} / K 10⁹ · t = ${d.tH.toFixed(1)} h · ${d.lastMut || 'no mutations yet'}`;
    }
  });
  const BASES_ARR = ['A', 'C', 'G', 'T'];
  function bioHelix(S, ctx, now) {
    const d = S.data, x0 = S.W * 0.2, span = S.W * 0.6, sp = span / BIO_BP, yc = S.H * 0.115, A = Math.min(26, S.H * 0.035), k = TAU / (BIO_TURN * sp);
    const near = hasPtr(S) && Math.abs(S.ptr.y - yc) < 90;
    const sep = (x) => (near ? Math.exp(-(((x - S.ptr.x) / 55) ** 2)) : 0);
    const cutX = d.cut >= 0 ? x0 + ((d.cut * sp + d.scroll) % span) : -1e9;
    const yAt = (x, s) => { const ph = k * (x - x0 - d.scroll) + (s ? Math.PI : 0); return yc + A * Math.sin(ph) + (s ? 1 : -1) * sep(x) * A * 1.3; };
    // rungs
    for (let i = 0; i < BIO_BP; i++) {
      const x = x0 + ((i * sp + d.scroll) % span), ph = k * (x - x0 - d.scroll), depth = 0.55 + 0.45 * Math.cos(ph);
      const edge = smooth(0, sp * 2, x - x0) * smooth(0, sp * 2, x0 + span - x), y1 = yAt(x, 0), y2 = yAt(x, 1), sv = sep(x);
      const b = d.seq[i], c = COMP[b], fl = d.flash[i] && now - d.flash[i] < 700 ? 1 - (now - d.flash[i]) / 700 : 0;
      const ins = d.ins && i >= d.ins.i && i < d.ins.i + 8 ? 1 : 0, a = edge * depth;
      const mid = (y1 + y2) / 2, gap = sv > 0.35 ? A * 0.5 * sv : 0;
      ctx.lineWidth = 3; ctx.strokeStyle = ins ? `rgba(110,255,140,${a})` : `rgba(${BCOL[b]},${a * 0.85})`; S.line(x, y1, x, mid - gap);
      ctx.strokeStyle = ins ? `rgba(110,255,140,${a})` : `rgba(${BCOL[c]},${a * 0.85})`; S.line(x, mid + gap, x, y2);
      if (fl > 0) { ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, '255,255,255', x, mid, 16, fl * edge); ctx.globalCompositeOperation = 'source-over'; }
      if (ins) { ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, '90,255,120', x, mid, 14, 0.5 * edge); ctx.globalCompositeOperation = 'source-over'; }
      if (depth > 0.75 && edge > 0.5) { ctx.font = '9px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = `rgba(230,255,245,${a * 0.8})`; ctx.fillText(b, x, y1 - 8); ctx.fillText(c, x, y2 + 9); }
    }
    // backbones (sugar-phosphate), front and back
    for (let s = 0; s < 2; s++) {
      ctx.strokeStyle = s ? 'rgba(255,140,220,0.8)' : 'rgba(120,230,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath();
      let pen = false;
      for (let x = x0; x <= x0 + span; x += 4) { const y = yAt(x, s); if (Math.abs(x - cutX) < 5) { pen = false; continue; } if (pen) ctx.lineTo(x, y); else { ctx.moveTo(x, y); pen = true; } }
      ctx.stroke();
    }
    if (d.pam >= 0 && S.holding) { // Cas9 riding the helix, guide RNA alongside
      const px = x0 + ((d.pam * sp + d.scroll) % span), gx0 = px - 20 * sp;
      ctx.strokeStyle = 'rgba(255,170,70,0.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); for (let x = Math.max(x0, gx0); x <= px; x += 4) { const y = yAt(x, 0) - 6; if (x === Math.max(x0, gx0)) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke();
      ctx.fillStyle = 'rgba(170,90,255,0.28)'; ctx.strokeStyle = 'rgba(200,150,255,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(px - 4 * sp, yc, 7 * sp, A * 1.9, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(230,210,255,0.9)'; ctx.fillText('Cas9', px - 4 * sp, yc + A * 1.9 + 11);
      ctx.fillStyle = 'rgba(255,230,150,0.9)'; ctx.fillText('PAM NGG', px + sp, yc - A * 1.9 - 4);
    }
    if (d.cut >= 0 && !S.reduceMotion) { ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, '255,240,255', cutX, yc, 22 + rand(0, 10), 0.8); ctx.globalCompositeOperation = 'source-over'; }
    ctx.font = '9px monospace'; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(200,240,230,0.55)'; ctx.fillText(`B-DNA · ${BIO_TURN} bp per turn · 3.4 nm pitch`, x0, yc + A * 2.6 + 6);
  }

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
  let AT_ROCKET = null;
  function atRocket() {
    if (AT_ROCKET) return AT_ROCKET;
    const c = mk(60, 160), x = c.getContext('2d'), cx = 30;
    x.fillStyle = '#c8322a'; // fins
    x.beginPath(); x.moveTo(cx - 10, 100); x.lineTo(cx - 28, 140); x.lineTo(cx - 10, 128); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(cx + 10, 100); x.lineTo(cx + 28, 140); x.lineTo(cx + 10, 128); x.closePath(); x.fill();
    const g = x.createLinearGradient(cx - 13, 0, cx + 13, 0); // chrome: banded reflections
    [[0, '#5a6470'], [0.18, '#f4f7fa'], [0.32, '#9aa6b2'], [0.5, '#e6ecf2'], [0.7, '#6a7682'], [0.85, '#d8e0e8'], [1, '#3a424c']].forEach((s) => g.addColorStop(s[0], s[1]));
    x.fillStyle = g; x.beginPath(); x.moveTo(cx, 6); x.bezierCurveTo(cx + 16, 34, cx + 14, 110, cx + 9, 134); x.lineTo(cx - 9, 134); x.bezierCurveTo(cx - 14, 110, cx - 16, 34, cx, 6); x.fill();
    x.fillStyle = '#c8322a'; x.beginPath(); x.moveTo(cx, 6); x.bezierCurveTo(cx + 7, 14, cx + 9, 22, cx + 10, 28); x.lineTo(cx - 10, 28); x.bezierCurveTo(cx - 9, 22, cx - 7, 14, cx, 6); x.fill();
    x.fillStyle = '#20304a'; x.beginPath(); x.arc(cx, 58, 6, 0, TAU); x.fill(); x.strokeStyle = '#e6ecf2'; x.lineWidth = 2; x.stroke();
    x.fillStyle = 'rgba(160,220,255,0.7)'; x.beginPath(); x.arc(cx - 2, 56, 2, 0, TAU); x.fill();
    x.fillStyle = '#2a2f36'; x.fillRect(cx - 7, 134, 14, 6);
    AT_ROCKET = c; return c;
  }
  function atStar(ctx, x, y, r, a) { // a four-point "atomic age" sparkle
    ctx.globalAlpha = a; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.14, y - r * 0.14); ctx.lineTo(x + r, y); ctx.lineTo(x + r * 0.14, y + r * 0.14);
    ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.14, y + r * 0.14); ctx.lineTo(x - r, y); ctx.lineTo(x - r * 0.14, y - r * 0.14); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
  }
  addMode({
    id: 'pk_atom', name: 'ATOMPUNK', glyphs: G('⚛☢αβγνπψ⁺⁻∞', 'αβγνπψ+-'),
    base: [45, 70, 88], palette: [[175, 75, 55], [22, 95, 60], [340, 80, 70], [210, 100, 66]],
    links: ['constellation', 'pk_track', 'arc', 'plasma'], opaque: true, count: 96, noHueShift: true, pageBg: ['#08262c', '#05070f'],
    shapes: ['atom', 'sphere', 'torus', 'cell24', 'lissajous', 'icosahedron', 'buckyball', 'tesseract'],
    init(S) {
      const N = [2000 / RNC[0].lam, 0, 0, 0, 0, 0];
      rnStep(N, 3 * 3600); // the room has been sealed for three hours
      Object.assign(S.data, { N, warp: 120, tracks: [], clickAcc: 0, trackAcc: 0, lamp: -1e9, needle: 0, launch: null, puffs: [],
        rockets: [{ x: S.W * 0.2, y: S.H * 0.7, vx: 0.35, vy: -0.22, s: 0.8 }, { x: S.W * 0.75, y: S.H * 0.25, vx: -0.25, vy: 0.12, s: 0.55 }] });
      S.data.stars = Array.from({ length: 14 }, () => ({ x: rand(0, 1), y: rand(0, 0.7), r: rand(5, 14), ph: rand(0, TAU) }));
    },
    update(S, now, dt) {
      const d = S.data, N = d.N;
      // radon: the "rod" emanates more while held; ventilation brings it back to 2 kBq afterwards
      const Atar = S.holding ? [5000, 10000, 18000, 30000][S.stage] : 2000;
      N[0] += (Atar / RNC[0].lam - N[0]) * ease(dt, S.holding ? 1500 : 9000);
      d.warp += ((S.holding ? [300, 800, 2000, 4000][S.stage] : 120) - d.warp) * ease(dt, 500);
      rnStep(N, d.warp * dt / 1000);
      d.A = N.map((n, i) => n * RNC[i].lam);
      d.cpm = 0.03 * 60 * (d.A[2] + d.A[3]); // a GM tube that sees 3% of the betas
      d.needle += (clamp((Math.log10(Math.max(10, d.cpm)) - 1) / 4, 0, 1) - d.needle) * ease(dt, 350);
      // lamp flashes (1 per 20 counts) and cloud-chamber tracks, both Poisson-ish
      d.clickAcc += Math.min(40, d.cpm / 60 / 20) * dt / 1000;
      if (d.clickAcc > 1 || Math.random() < d.clickAcc) { d.clickAcc = Math.max(0, d.clickAcc - 1); d.lamp = now; d.needle += S.reduceMotion ? 0 : 0.01; }
      const Atot = d.A[0] + d.A[1] + d.A[2] + d.A[3] + d.A[4];
      d.trackAcc += Math.min(30, Atot / 900) * dt / 1000;
      while (d.trackAcc > 1) { d.trackAcc -= 1; atTrack(S); }
      d.tracks = d.tracks.filter((t) => now - t.t < 1600);
      const k = dt / 16.7;
      d.rockets.forEach((r) => { r.x += r.vx * k; r.y += r.vy * k + Math.sin(now * 0.001 + r.s * 9) * 0.1 * k; repel(S, r, 120, 0.05); r.vx = clamp(r.vx, -0.6, 0.6); r.vy = clamp(r.vy, -0.6, 0.6);
        if (r.x < -80) r.x = S.W + 80; if (r.x > S.W + 80) r.x = -80; if (r.y < -100) r.y = S.H + 100; if (r.y > S.H + 100) r.y = -100;
        if (Math.random() < 0.3) puff(S, { x: r.x - r.vx * 70 * r.s, y: r.y - r.vy * 70 * r.s, vx: -r.vx * 2, vy: -r.vy * 2, r0: 2, r1: 10 * r.s + 6, life: 700, a: 0.35, rgb: '255,170,90' }); });
      const L = d.launch;
      if (L) {
        const t = (now - L.t) / 1000; L.y = S.H + 80 - 0.5 * L.acc * t * t; L.x = L.x0 + Math.sin(t * 3) * 6;
        for (let j = 0; j < 3; j++) puff(S, { x: L.x + rand(-8, 8), y: L.y + 120, vx: rand(-1.5, 1.5), vy: rand(2, 5), r0: 6, r1: rand(30, 70), life: rand(900, 1600), a: 0.5, rgb: pick(['255,200,120', '255,240,220', '255,150,80']) });
        if (L.y < -260) d.launch = null;
      }
    },
    background(S, ctx, now, dt) {
      const d = S.data;
      blit(ctx, layer(S, 'bg', S.W, S.H, (x, w, h) => {
        const g = x.createLinearGradient(0, 0, w * 0.3, h); g.addColorStop(0, '#0c3a40'); g.addColorStop(0.6, '#0a2230'); g.addColorStop(1, '#060a14');
        x.fillStyle = g; x.fillRect(0, 0, w, h);
        ['rgba(120,230,210,0.05)', 'rgba(255,150,120,0.05)', 'rgba(255,230,170,0.04)'].forEach((c, i) => { // boomerangs
          for (let k = 0; k < 4; k++) { const X = rand(0, w), Y = rand(0, h), s = rand(60, 140), a = rand(0, TAU); x.save(); x.translate(X, Y); x.rotate(a); x.fillStyle = c; x.beginPath(); x.moveTo(-s, 0); x.quadraticCurveTo(0, -s * 0.9, s, 0); x.quadraticCurveTo(0, -s * 0.35, -s, 0); x.fill(); x.restore(); }
        });
        x.fillStyle = 'rgba(255,240,210,0.5)'; for (let k = 0; k < 120; k++) x.fillRect(rand(0, w), rand(0, h), 1, 1);
        const px = w * 0.08, py = h * 0.2, pr = Math.min(w, h) * 0.045; // a ringed planet
        x.strokeStyle = 'rgba(255,200,140,0.45)'; x.lineWidth = 3; x.beginPath(); x.ellipse(px, py, pr * 2, pr * 0.5, -0.35, Math.PI, TAU); x.stroke();
        const pg = x.createRadialGradient(px - pr * 0.4, py - pr * 0.4, 0, px, py, pr); pg.addColorStop(0, '#ffcf8a'); pg.addColorStop(1, '#c85a2a');
        x.fillStyle = pg; x.beginPath(); x.arc(px, py, pr, 0, TAU); x.fill();
        x.beginPath(); x.ellipse(px, py, pr * 2, pr * 0.5, -0.35, 0, Math.PI); x.stroke();
      }, 0.75));
      ctx.fillStyle = 'rgba(255,240,200,1)';
      for (const s of d.stars) atStar(ctx, s.x * S.W, s.y * S.H, s.r * (0.7 + 0.3 * Math.sin(now * 0.002 + s.ph)), 0.25 + 0.2 * Math.sin(now * 0.0015 + s.ph));
      // a big retro atom: three orbits, electrons racing
      const ax = S.W * 0.1, ay = S.H * 0.5, ar = Math.min(S.W, S.H) * 0.085;
      ctx.strokeStyle = 'rgba(255,235,190,0.35)'; ctx.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) {
        const rot = k * Math.PI / 3 + now * 0.00008; ctx.beginPath(); ctx.ellipse(ax, ay, ar, ar * 0.32, rot, 0, TAU); ctx.stroke();
        const e = now * 0.002 * (1 + k * 0.3) + k * 2, ex = Math.cos(e) * ar, ey = Math.sin(e) * ar * 0.32;
        ctx.fillStyle = 'rgba(140,240,255,0.95)'; ctx.beginPath(); ctx.arc(ax + ex * Math.cos(rot) - ey * Math.sin(rot), ay + ex * Math.sin(rot) + ey * Math.cos(rot), 3, 0, TAU); ctx.fill();
      }
      [[0, 0, '#e8552e'], [4, 2, '#3aa0c8'], [-3, 3, '#e8552e'], [1, -4, '#3aa0c8'], [-2, -2, '#e8552e']].forEach((q) => { ctx.fillStyle = q[2]; ctx.beginPath(); ctx.arc(ax + q[0], ay + q[1], 4, 0, TAU); ctx.fill(); });
      // chrome rockets
      const rk = atRocket();
      d.rockets.forEach((r) => {
        ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(Math.atan2(r.vy, r.vx) + Math.PI / 2); ctx.scale(r.s, r.s);
        ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, '255,160,70', 0, 82, 16 + rand(0, 4), 0.8); ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(rk, -30, -80); ctx.restore();
      });
      drawPuffs(S, ctx, dt, 'lighter');
      if (d.launch) { const L = d.launch; ctx.save(); ctx.translate(L.x, L.y); ctx.scale(1.8, 1.8); ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, '255,190,90', 0, 75, 34, 1); ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(rk, -30, -80); ctx.restore(); }
      if (S.holding && S.stage >= 3) { // Cherenkov blue
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, '60,120,255', S.cx, S.cy, S.R * 1.7, 0.4 + 0.08 * Math.sin(now * 0.008));
        ctx.strokeStyle = 'rgba(120,170,255,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(S.cx, S.cy, S.R * 1.08, 0, TAU); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
      atPanels(S, ctx, now);
    },
    under(S, ctx, now) {
      const d = S.data;
      // cloud-chamber tracks: alphas short, straight and fat; betas long, thin and wandering
      ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (const t of d.tracks) {
        const u = (now - t.t) / 1600, a = (1 - u) * (u < 0.05 ? u / 0.05 : 1);
        ctx.beginPath(); t.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        if (t.alpha) { ctx.lineWidth = 5 + u * 4; ctx.strokeStyle = `rgba(200,230,255,${0.18 * a})`; ctx.stroke(); ctx.lineWidth = 1.8; ctx.strokeStyle = `rgba(255,255,255,${0.75 * a})`; ctx.stroke(); }
        else { ctx.lineWidth = 1; ctx.strokeStyle = `rgba(220,240,255,${0.6 * a})`; ctx.stroke(); }
        if (t.label && u < 0.6) { ctx.font = '9px monospace'; ctx.textAlign = 'left'; ctx.fillStyle = `rgba(255,240,200,${0.7 * a})`; ctx.fillText(t.label, t.pts[0][0] + 5, t.pts[0][1] - 5); }
      }
      ctx.globalCompositeOperation = 'source-over';
      const L = d.launch;
      if (L) { const u = (now - L.t) / 1400; if (u < 1) { ctx.strokeStyle = `rgba(255,230,180,${0.6 * (1 - u)})`; ctx.lineWidth = 2; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(S.cx, S.cy, S.R * (1 + 1.6 * u), S.R * (1 + 1.6 * u) * 0.32, k * Math.PI / 3, 0, TAU); ctx.stroke(); } } }
    },
    onRelease(S, held, pw) {
      const d = S.data;
      d.launch = { t: S.now, x0: S.cx, x: S.cx, y: S.H + 80, acc: 2 * (S.H + 400) / (2.4 * 2.4) };
      const cols = ['120,235,215', '255,150,80', '255,120,160', '255,240,200'];
      for (let k = 0; k < 90 * pw; k++) { const a = rand(0, TAU), v = rand(2, 9) * pw; S.spawn(S.cx, S.cy, Math.cos(a) * v, Math.sin(a) * v, `rgba(${pick(cols)},1)`, rand(900, 1800), rand(1.5, 3.5), { drag: 0.96 }); }
      S.ring(S.cx, S.cy, 300 + 200 * pw, [175, 75, 60], 1100);
      return false;
    },
    hud(S) {
      const d = S.data;
      if (!d.A) return '';
      const cpm = fmt(d.cpm), w = fmt(d.warp);
      if (S.holding) return [`radon rising · A(²²²Rn) = ${fmt(d.A[0])} Bq · A = λN, λ = ln2 / t½`,
        `daughters catching up: ²¹⁴Pb ${fmt(d.A[2])} Bq · ²¹⁴Bi ${fmt(d.A[3])} Bq · ${cpm} cpm · time ×${w}`,
        'ingrowth → secular equilibrium: every daughter\'s activity → A(²²²Rn)',
        `${cpm} cpm · Cherenkov blue (v > c/n) · no mushrooms were grown in this mode`][S.stage];
      if (d.launch) return 'liftoff · powered by 1950s optimism and 9.8 m/s² of stubbornness';
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
