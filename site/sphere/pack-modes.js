/* The Sphere: modes pack. Seventeen moods for the sphere, from neural nets and market crashes to eldritch eyes and synthwave.
 * Each mode brings its own glyphs, palette, per-stage webs, ambient layer, hold effect, release finale and HUD joke.
 * Own web styles are prefixed pm_ so they never collide with other packs. */
(function (SP) {
  'use strict';
  const { TAU, rand, pick, clamp } = SP.util;
  const lerp = (a, b, t) => a + (b - a) * t;
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.15;
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  function hsl2rgb(h, s, l) {
    s /= 100; l /= 100; h = ((h % 360) + 360) % 360;
    const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
  }

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

  /* ---------- cached sprites and offscreen layers ---------- */
  const glowCache = {};
  function glow(rgb, r) {
    r = Math.max(4, Math.round(r / 4) * 4);
    const k = rgb + '/' + r;
    let c = glowCache[k];
    if (!c) {
      c = document.createElement('canvas'); c.width = c.height = r * 2;
      const x = c.getContext('2d'), g = x.createRadialGradient(r, r, 0, r, r, r);
      g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(0.3, `rgba(${rgb},0.38)`); g.addColorStop(1, `rgba(${rgb},0)`);
      x.fillStyle = g; x.fillRect(0, 0, r * 2, r * 2); glowCache[k] = c;
    }
    return c;
  }
  function drawGlow(ctx, rgb, x, y, r, a) { if (a <= 0.005) return; const c = glow(rgb, r), h = c.width / 2; ctx.globalAlpha = Math.min(1, a); ctx.drawImage(c, x - h, y - h); ctx.globalAlpha = 1; }
  // A canvas in CSS pixels, rebuilt when the size (or the DPR) changes. Lives in S.data, so it is dropped on mode change.
  function layer(S, key, w, h, draw) {
    const k = Math.round(w) + 'x' + Math.round(h) + '@' + S.DPR, old = S.data['_' + key];
    if (old && old._k === k) return old;
    const c = S.offscreen(w * S.DPR, h * S.DPR), x = c.getContext('2d');
    x.scale(S.DPR, S.DPR); draw(x, w, h); c._k = k; c._w = w; c._h = h; S.data['_' + key] = c;
    return c;
  }
  const blit = (ctx, c, x, y) => ctx.drawImage(c, x || 0, y || 0, c._w, c._h);
  const power = (S) => (S.holding ? clamp(S.held / S.STAGES[3], 0, 1) : 0);
  const PV0 = { x: 0, y: 0 };
  const pvel = (S) => S.ptrVel || PV0;
  const pspeed = (S) => { const v = pvel(S); return Math.hypot(v.x, v.y); };
  // Push an object {x, y, vx, vy} away from the pointer; a moving pointer pushes harder. Returns the closeness 0..1.
  function repel(S, o, r, k) {
    const dx = o.x - S.ptr.x, dy = o.y - S.ptr.y, d2 = dx * dx + dy * dy;
    if (d2 > r * r || d2 < 1) return 0;
    const d = Math.sqrt(d2), f = (1 - d / r) * k * (1 + Math.min(4, pspeed(S) * 0.25));
    o.vx += dx / d * f; o.vy += dy / d * f;
    return 1 - d / r;
  }

  /* ---------- FX: anime sparkle stars, hextech crystal shards with shimmer trails, speed lines / impact frames ---------- */
  function fxAdd(S, o) {
    const d = S.data, list = d.fx || (d.fx = []);
    if (list.length < 420) list.push(Object.assign({ t: S.now, vx: 0, vy: 0, life: 800, s: 6, rot: rand(0, TAU), vr: rand(-0.12, 0.12), g: 0, drag: 0.965, hue: 50, kind: 'star' }, o));
  }
  function starBurst(S, x, y, n, hue, speed) {
    for (let k = 0; k < n; k++) { const a = rand(0, TAU), v = rand(0.5, 1) * (speed || 4); fxAdd(S, { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: rand(3, 9), life: rand(500, 1100), hue: hue === undefined ? rand(0, 360) : hue + rand(-20, 20), kind: 'star' }); }
  }
  function shardBurst(S, x, y, n, speed) {
    for (let k = 0; k < n; k++) { const a = rand(0, TAU), v = rand(0.6, 1) * (speed || 5); fxAdd(S, { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: rand(7, 15), life: rand(800, 1500), g: 0.04, kind: 'shard', px: x, py: y }); }
  }
  function speedLines(S, x, y, hue) { fxAdd(S, { x, y, life: 480, kind: 'speed', hue: hue || 0, seed: Math.random() * 1000 }); if (!S.reduceMotion) fxAdd(S, { x, y, life: 90, kind: 'impact' }); }
  function fxDraw(S, ctx, dt) {
    const d = S.data, list = d.fx;
    if (!list || !list.length) return;
    const now = S.now, k = dt / 16;
    d.fx = list.filter((p) => now - p.t < p.life);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of d.fx) {
      const age = (now - p.t) / p.life, a = 1 - age;
      if (p.kind === 'speed') {
        const M = Math.max(S.W, S.H); let sd = p.seed;
        ctx.strokeStyle = p.hue ? `hsla(${p.hue},100%,82%,${0.85 * a})` : `rgba(255,255,255,${0.85 * a})`; ctx.lineWidth = 2; ctx.beginPath();
        for (let i = 0; i < 46; i++) { sd = (sd * 9301 + 49297) % 233280; const an = sd / 233280 * TAU, r0 = 60 + 140 * age + (i % 5) * 18, r1 = r0 + M * (0.25 + (i % 3) * 0.1); ctx.moveTo(p.x + Math.cos(an) * r0, p.y + Math.sin(an) * r0); ctx.lineTo(p.x + Math.cos(an) * r1, p.y + Math.sin(an) * r1); }
        ctx.stroke(); continue;
      }
      if (p.kind === 'impact') { ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = `rgba(255,255,255,${0.9 * a})`; ctx.fillRect(0, 0, S.W, S.H); ctx.globalCompositeOperation = 'lighter'; continue; }
      p.vy += p.g * k; p.vx *= p.drag; p.vy *= p.drag;
      repel(S, p, 70, 0.35);
      p.px = p.x; p.py = p.y; p.x += p.vx * k; p.y += p.vy * k; p.rot += p.vr * k;
      if (p.kind === 'star') {
        const tw = 0.6 + 0.4 * Math.sin(now * 0.02 + p.s * 7), r = p.s * (age < 0.15 ? age / 0.15 : 1) * tw, c = Math.cos(p.rot), sn = Math.sin(p.rot);
        ctx.fillStyle = `hsla(${p.hue},100%,80%,${a})`; ctx.beginPath();
        for (let j = 0; j < 8; j++) { const rr = j % 2 ? r * 0.22 : r, an = j * Math.PI / 4; const x = Math.cos(an) * rr, y = Math.sin(an) * rr; ctx.lineTo(p.x + x * c - y * sn, p.y + x * sn + y * c); }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
      } else { // hextech shard: blue crystal, gold rim, pink-purple shimmer trail
        const c = Math.cos(p.rot), sn = Math.sin(p.rot), L = p.s, w = p.s * 0.32;
        ctx.strokeStyle = `rgba(230,120,255,${0.45 * a})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 6, p.y - p.vy * 6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(p.x + c * L, p.y + sn * L); ctx.lineTo(p.x - sn * w, p.y + c * w); ctx.lineTo(p.x - c * L, p.y - sn * L); ctx.lineTo(p.x + sn * w, p.y - c * w); ctx.closePath();
        ctx.fillStyle = `rgba(80,200,255,${0.75 * a})`; ctx.fill(); ctx.strokeStyle = `rgba(255,205,110,${a})`; ctx.lineWidth = 1; ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ---------------- Web styles (this pack's own) ---------------- */
  SP.addLink('pm_tentacle', (ctx, L) => {
    const dx = L.bx - L.ax, dy = L.by - L.ay, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    const amp = Math.min(16, len * 0.18) * (0.6 + 0.15 * L.stage), ph = L.now * 0.004 + L.seed * TAU;
    ctx.beginPath(); ctx.moveTo(L.ax, L.ay);
    for (let i = 1; i <= 10; i++) { const t = i / 10, w = Math.sin(t * Math.PI) * amp * Math.sin(ph + t * 6); ctx.lineTo(L.ax + dx * t + nx * w, L.ay + dy * t + ny * w); }
    ctx.lineWidth = L.width * 3; ctx.strokeStyle = L.color(L.alpha * 0.25); ctx.stroke();
    ctx.lineWidth = L.width * 0.9; ctx.strokeStyle = L.color(L.alpha); ctx.stroke();
    ctx.beginPath(); ctx.arc(L.bx, L.by, 1.6 + L.stage * 0.5, 0, TAU); ctx.fill();
  });
  SP.addLink('pm_vesica', (ctx, L) => {
    const mx = (L.ax + L.bx) / 2, my = (L.ay + L.by) / 2, dx = L.bx - L.ax, dy = L.by - L.ay, k = 0.29;
    ctx.beginPath(); ctx.moveTo(L.ax, L.ay);
    ctx.quadraticCurveTo(mx - dy * k, my + dx * k, L.bx, L.by);
    ctx.quadraticCurveTo(mx + dy * k, my - dx * k, L.ax, L.ay); ctx.stroke();
    ctx.beginPath(); ctx.arc(mx, my, 1.4, 0, TAU); ctx.fill();
  });
  SP.addLink('pm_bolt', (ctx, L) => {
    const dx = L.bx - L.ax, dy = L.by - L.ay, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    let s = (Math.floor(L.seed * 233280) + Math.floor(L.now / 70) * 49297) % 233280;
    const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 - 0.5; };
    ctx.beginPath(); ctx.moveTo(L.ax, L.ay);
    for (let i = 1; i < 7; i++) { const t = i / 7, o = r() * Math.min(40, len * 0.3); ctx.lineTo(L.ax + dx * t + nx * o, L.ay + dy * t + ny * o); }
    ctx.lineTo(L.bx, L.by);
    ctx.lineWidth = L.width * 3.5; ctx.strokeStyle = L.color(L.alpha * 0.22); ctx.stroke();
    ctx.lineWidth = Math.max(0.8, L.width * 0.7); ctx.strokeStyle = `rgba(255,255,255,${L.alpha})`; ctx.stroke();
  });
  const wave = (fn, dens) => (ctx, L) => {
    const dx = L.bx - L.ax, dy = L.by - L.ay, len = Math.hypot(dx, dy);
    if (len < 3) return;
    const nx = -dy / len, ny = dx / len, amp = 2.5 + L.stage * 2.2, cyc = Math.max(1, Math.round(len / (20 - (L.gen % 3) * 4)));
    const n = Math.min(64, cyc * dens), ph = L.now * 0.006 + L.seed * 3;
    ctx.beginPath(); ctx.moveTo(L.ax, L.ay);
    for (let i = 1; i <= n; i++) { const t = i / n, w = fn(t * cyc - ph) * amp * Math.sin(t * Math.PI); ctx.lineTo(L.ax + dx * t + nx * w, L.ay + dy * t + ny * w); }
    ctx.stroke();
  };
  const fr = (x) => x - Math.floor(x);
  SP.addLink('pm_sine', wave((x) => Math.sin(x * TAU), 10));
  SP.addLink('pm_tri', wave((x) => 4 * Math.abs(fr(x) - 0.5) - 1, 8));
  SP.addLink('pm_saw', wave((x) => 2 * fr(x) - 1, 16));
  SP.addLink('pm_square', wave((x) => (fr(x) < 0.5 ? 1 : -1), 20));
  function arrowHead(ctx, x, y, ux, uy, s) { ctx.moveTo(x, y); ctx.lineTo(x - ux * s - uy * s * 0.32, y - uy * s + ux * s * 0.32); ctx.lineTo(x - ux * s + uy * s * 0.32, y - uy * s - ux * s * 0.32); ctx.closePath(); }
  SP.addLink('pm_dim', (ctx, L, S) => {
    const dx = L.fx - L.ax, dy = L.fy - L.ay, len = Math.hypot(dx, dy);
    ctx.strokeStyle = `rgba(225,238,255,${L.alpha * 0.8})`; ctx.fillStyle = `rgba(225,238,255,${L.alpha * 0.9})`; ctx.lineWidth = 0.8;
    if (len < 16) { S.line(L.ax, L.ay, L.bx, L.by); return; }
    const ux = dx / len, uy = dy / len, nx = -uy, ny = ux, off = 9 + L.seed * 12, g = L.grow;
    const ax = L.ax + nx * off, ay = L.ay + ny * off, bx = ax + dx * g, by = ay + dy * g;
    ctx.beginPath();
    ctx.moveTo(L.ax + nx * 3, L.ay + ny * 3); ctx.lineTo(L.ax + nx * (off + 4), L.ay + ny * (off + 4));
    if (g >= 1) { ctx.moveTo(L.fx + nx * 3, L.fy + ny * 3); ctx.lineTo(L.fx + nx * (off + 4), L.fy + ny * (off + 4)); }
    ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    ctx.beginPath(); arrowHead(ctx, ax, ay, -ux, -uy, 6); if (g >= 1) arrowHead(ctx, bx, by, ux, uy, 6); ctx.fill();
    if (g >= 1 && L.stage >= 2 && L.seed < 0.42 && len > 34) {
      const mm = len * 0.254, sd = L.seed;
      const label = sd < 0.12 ? `Ø${mm.toFixed(2)} ±0.01` : sd < 0.2 ? `R${(mm / 2).toFixed(1)}` : sd < 0.28 ? `${mm.toFixed(1)} H7/g6` : sd < 0.34 ? `${(Math.atan2(-dy, dx) * 180 / Math.PI).toFixed(1)}°` : `${mm.toFixed(2)} ±0.05`;
      let ang = Math.atan2(uy, ux); if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;
      ctx.save(); ctx.translate((ax + bx) / 2 + nx * 6, (ay + by) / 2 + ny * 6); ctx.rotate(ang);
      ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, 0); ctx.restore();
    }
  });
  SP.addLink('pm_center', (ctx, L, S) => {
    ctx.strokeStyle = `rgba(225,238,255,${L.alpha * 0.55})`; ctx.lineWidth = 0.8;
    ctx.setLineDash([12, 3, 2, 3]); S.line(L.ax, L.ay, L.bx, L.by); ctx.setLineDash([]);
  });
  SP.addLink('pm_frost', (ctx, L, S) => {
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

  /* ======================= 1. NEURAL NET ======================= */
  const NN_LAYERS = [4, 7, 9, 7, 3];
  function nnPos(S) {
    const out = [];
    NN_LAYERS.forEach((n, k) => { const x = S.W * (0.07 + 0.86 * k / (NN_LAYERS.length - 1)), sp = Math.min(62, (S.H * 0.7) / n); out.push(Array.from({ length: n }, (_, i) => [x, S.H * 0.46 + (i - (n - 1) / 2) * sp])); });
    return out;
  }
  SP.addMode({
    id: 'neural', name: 'NEURAL NET', glyphs: G('σΣƒ∂∇θλŷwbx01∫⊙◉', 'σΣ∂∇θλwbx01'),
    base: [205, 45, 72], palette: [[190, 100, 62], [275, 100, 72], [48, 100, 62], [330, 100, 66]],
    links: ['synapse', 'synapse', 'pulse', 'lightning'], fade: 0.5, count: 96, pageBg: ['#050b1a', '#0b0420'],
    shapes: ['sphere', 'cell600', 'buckyball', 'icosahedron', 'gyroid', 'hopf', 'torus', 'helix'],
    init(S) { Object.assign(S.data, { spikes: [], epoch: 0, fp: 0, back: 0, msg: null }); },
    update(S, now, dt) {
      const d = S.data;
      if (S.holding) { d.epoch = Math.pow(S.held / 1000, 2) * 9; d.fp += dt * 0.0011 * (1 + S.stage); }
      else if (d.back > 0) d.back = Math.max(0, d.back - dt * 0.004);
    },
    background(S, ctx, now) {
      const d = S.data, pos = nnPos(S);
      const net = layer(S, 'net', S.W, S.H, (x) => {
        x.strokeStyle = 'rgba(120,180,255,0.085)'; x.lineWidth = 1; x.beginPath();
        for (let k = 0; k < pos.length - 1; k++) for (const a of pos[k]) for (const b of pos[k + 1]) { x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); }
        x.stroke();
        x.strokeStyle = 'rgba(140,200,255,0.4)'; x.fillStyle = 'rgba(0,10,30,0.6)';
        pos.forEach((l) => l.forEach((p) => { x.beginPath(); x.arc(p[0], p[1], 7, 0, TAU); x.fill(); x.stroke(); }));
        x.fillStyle = 'rgba(140,200,255,0.22)';
        x.font = '10px monospace'; x.fillStyle = 'rgba(140,200,255,0.22)'; x.textAlign = 'center';
        ['input', 'hidden₁', 'hidden₂', 'hidden₃', 'output'].forEach((t, k) => x.fillText(t, pos[k][0][0], S.H * 0.46 + S.H * 0.38));
      });
      ctx.globalAlpha = 0.85; blit(ctx, net); ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'lighter'; // neurons fire when the pointer passes
      pos.forEach((l) => l.forEach((p) => { const q = Math.hypot(p[0] - S.ptr.x, p[1] - S.ptr.y); if (q < 150) drawGlow(ctx, '120,200,255', p[0], p[1], 28, (1 - q / 150) * (0.5 + Math.min(0.5, pspeed(S) * 0.05))); }));
      ctx.globalCompositeOperation = 'source-over';
      // forward pass while holding, backprop after release
      const going = S.holding ? d.fp : d.back > 0 ? (pos.length - 1) * d.back : -1;
      if (going < 0) return;
      const k = S.holding ? Math.floor(going) % (pos.length - 1) : Math.min(pos.length - 2, Math.floor(going)), f = going - Math.floor(going);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = S.holding ? S.colorOf(1, 0.32 * (1 - f * 0.6)) : 'rgba(255,120,80,0.35)'; ctx.lineWidth = 1;
      ctx.beginPath();
      pos[k].forEach((a, i) => pos[k + 1].forEach((b, j) => { if ((i * 7 + j * 3 + Math.floor(now / 120)) % 3) { ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0] + (b[0] - a[0]) * Math.min(1, f * 1.4), a[1] + (b[1] - a[1]) * Math.min(1, f * 1.4)); } }));
      ctx.stroke();
      pos[k + 1].forEach((p, j) => drawGlow(ctx, S.holding ? '160,120,255' : '255,120,80', p[0], p[1], 20, f * (0.4 + 0.6 * ((j * 37) % 10) / 10)));
    },
    onInfect(S, n, parent) {
      n.data.f = S.now;
      if (Math.random() < 0.2) starBurst(S, n.sx, n.sy, 2, 195, 1.6);
      if (parent && S.data.spikes.length < 160) S.data.spikes.push({ a: parent, b: n, t: S.now });
    },
    over(S, ctx, now) {
      const d = S.data;
      fxDraw(S, ctx, S.dt);
      ctx.globalCompositeOperation = 'lighter';
      d.spikes = d.spikes.filter((s) => now - s.t < 420);
      for (const s of d.spikes) { const t = (now - s.t) / 420; drawGlow(ctx, '255,240,200', lerp(s.a.sx, s.b.sx, t), lerp(s.a.sy, s.b.sy, t), 12, 1 - t * 0.5); }
      ctx.lineWidth = 1.2;
      for (const n of S.active) {
        const age = now - (n.data.f || -1e9);
        if (age < 500) { ctx.strokeStyle = S.colorOf(n.gen, 0.8 * (1 - age / 500)); ctx.beginPath(); ctx.arc(n.sx, n.sy, 6 + age * 0.05, 0, TAU); ctx.stroke(); }
      }
    },
    onRelease(S, held) {
      const d = S.data, s = S.seed;
      d.back = 1;
      if (s) { speedLines(S, s.sx, s.sy, 200); starBurst(S, s.sx, s.sy, 18, 200, 5); }
      if (s) S.active.forEach((n) => { if (n.inf && n !== s) S.spawn(n.sx, n.sy, (s.sx - n.sx) / 52, (s.sy - n.sy) / 52, 'rgba(255,140,90,1)', 820, 2.2, { drag: 1 }); });
      d.msg = { t: S.now, text: held > S.STAGES[3] ? 'loss.backward() · overfitting detected · deploying to prod anyway' : 'loss.backward() · early stopping (got bored)' };
    },
    hud(S) {
      const d = S.data;
      if (S.holding) {
        const e = Math.floor(d.epoch), loss = 2.302 * Math.exp(-d.epoch / 38) + 0.0031 + 0.01 * Math.random() * Math.exp(-d.epoch / 60);
        const acc = Math.min(99.7, 100 - 90 * Math.exp(-d.epoch / 30));
        return `epoch ${e} · loss ${loss.toFixed(4)} · ` + (acc >= 99.7 ? 'accuracy 99.7% (on the training set, obviously)' : `accuracy ${acc.toFixed(1)}%`);
      }
      if (d.msg && S.now - d.msg.t < 5000) return d.msg.text;
      return 'model.eval() · 1.3B parameters, 0 opinions · hold to train';
    }
  });

  /* ======================= 2. MARKET ======================= */
  const TICKERS = ['SPHR', 'TORUS', 'KLEIN', 'MÖBI', 'LRNZ', 'HOPF', 'φGOLD', 'πPIE', 'COPE', 'HODL', 'ENTRP', 'DARKM'];
  SP.addMode({
    id: 'market', name: 'MARKET', glyphs: G('$€¥₿£₹₽¢₩%↑↓', '$€¥£%↑↓'),
    base: [140, 30, 82], palette: [[130, 100, 55], [95, 100, 58], [52, 100, 60]],
    links: ['line', 'arrow', 'laser', 'lightning'], fade: 0.55, count: 72, noHueShift: true, pageBg: ['#03140b', '#0a0a0a'],
    shapes: ['sphere', 'cube', 'galaxy', 'sunflower', 'helix', 'torus', 'crown', 'dodecahedron'],
    init(S) {
      const d = S.data; d.c = []; let p = 100;
      for (let i = 0; i < 120; i++) { const o = p; p *= Math.exp(0.0005 + 0.012 * gauss()); d.c.push({ o, c: p, h: Math.max(o, p) * (1 + 0.006 * Math.random()), l: Math.min(o, p) * (1 - 0.006 * Math.random()) }); }
      d.last = 0; d.crash = -1e9; d.tick = TICKERS.map((t) => ({ t, p: rand(10, 900), ch: 0 })); d.tx = 0; d.pct = 0;
    },
    update(S, now) {
      const d = S.data;
      if (now - d.last < 90) return;
      d.last = now;
      const since = now - d.crash, crashing = since < 1800;
      const mu = S.holding ? 0.006 + 0.007 * S.stage : crashing ? -0.06 : since < 5000 ? 0.004 : 0.0004;
      const o = d.c[d.c.length - 1].c, c = o * Math.exp(mu + (crashing ? 0.03 : 0.012) * gauss());
      d.c.push({ o, c, h: Math.max(o, c) * (1 + 0.008 * Math.random()), l: Math.min(o, c) * (1 - 0.008 * Math.random()) });
      if (d.c.length > 120) d.c.shift();
      d.tick.forEach((k) => { const m = Math.exp(mu * 0.7 + 0.006 * gauss()); k.ch = (m - 1) * 100; k.p *= m; });
      if (S.holding) d.pct = Math.min(420, Math.round((Math.pow(1.95, S.held / 1000) - 1) * 100));
    },
    ambient(S, ctx, now, dt) {
      const d = S.data, top = 78, hb = Math.min(140, S.H * 0.18), cw = S.W / 120;
      let lo = Infinity, hi = -Infinity;
      for (const k of d.c) { if (k.l < lo) lo = k.l; if (k.h > hi) hi = k.h; }
      const Y = (v) => top + hb - (v - lo) / (hi - lo || 1) * hb;
      const crash = now - d.crash < 4000;
      ['up', 'down'].forEach((dir) => {
        ctx.fillStyle = dir === 'up' ? 'rgba(40,255,120,0.4)' : 'rgba(255,50,70,0.45)';
        ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1;
        ctx.beginPath();
        d.c.forEach((k, i) => { if ((k.c >= k.o) !== (dir === 'up')) return; const x = i * cw + cw / 2; ctx.moveTo(x, Y(k.h)); ctx.lineTo(x, Y(k.l)); });
        ctx.stroke(); ctx.beginPath();
        d.c.forEach((k, i) => { if ((k.c >= k.o) !== (dir === 'up')) return; const y1 = Y(Math.max(k.o, k.c)), y2 = Y(Math.min(k.o, k.c)); ctx.rect(i * cw + cw * 0.2, y1, cw * 0.6, Math.max(1, y2 - y1)); });
        ctx.fill();
      });
      ctx.strokeStyle = 'rgba(255,220,90,0.45)'; ctx.beginPath(); // moving average
      let acc = 0;
      d.c.forEach((k, i) => { acc += k.c; if (i >= 10) acc -= d.c[i - 10].c; if (i >= 9) { const y = Y(acc / 10); if (i === 9) ctx.moveTo(i * cw, y); else ctx.lineTo(i * cw, y); } });
      ctx.stroke();
      const last = d.c[d.c.length - 1];
      if (S.ptr.y > top - 10 && S.ptr.y < top + hb + 10) { // crosshair readout on the chart under the pointer
        const i = clamp(Math.floor(S.ptr.x / cw), 0, d.c.length - 1), kk = d.c[i];
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(S.ptr.x, top); ctx.lineTo(S.ptr.x, top + hb); ctx.moveTo(0, S.ptr.y); ctx.lineTo(S.W, S.ptr.y); ctx.stroke(); ctx.setLineDash([]);
        ctx.font = '10px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillText(`O ${kk.o.toFixed(2)} C ${kk.c.toFixed(2)} · ${(lo + (top + hb - S.ptr.y) / hb * (hi - lo)).toFixed(2)}`, Math.min(S.ptr.x + 6, S.W - 190), top + hb + 4);
      }
      ctx.font = '11px monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillStyle = crash ? 'rgba(255,80,90,0.9)' : 'rgba(80,255,150,0.9)';
      ctx.fillText(`SPHR ${last.c.toFixed(2)}`, S.W - 8, Y(last.c) - 10);
      // ticker tape
      ctx.textAlign = 'left'; ctx.font = '12px monospace';
      d.tx -= dt * (0.05 + 0.04 * S.stage);
      let x = d.tx;
      const ty = 60;
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, ty - 9, S.W, 18);
      for (let r = 0; x < S.W; r++) {
        const k = d.tick[r % d.tick.length], s = `${k.t} ${k.p.toFixed(2)} ${k.ch >= 0 ? '▲' : '▼'}${Math.abs(k.ch).toFixed(2)}%   `;
        const w = s.length * 7.3;
        if (x + w > 0) { ctx.fillStyle = k.ch >= 0 ? 'rgba(80,255,150,0.75)' : 'rgba(255,80,90,0.75)'; ctx.fillText(s, x, ty); }
        x += w;
        if (r === d.tick.length - 1 && x < 0) { d.tx = x; }
      }
      if (S.holding && S.stage >= 1 && Math.random() < 0.25 * S.stage) {
        const n = pick(S.active); if (n && n.inf) S.spawn(n.sx, n.sy, rand(-0.3, 0.3), rand(-2.2, -1), 'rgba(80,255,140,1)', 900, 14, { glyph: pick(['↑', '$', '▲', '₿']), drag: 0.99 });
      }
      if (pspeed(S) > 3 && Math.random() < 0.5) { const v = pvel(S); S.spawn(S.ptr.x, S.ptr.y, -v.x * 0.15 + rand(-0.5, 0.5), -v.y * 0.15 - 0.5, v.y < 0 ? 'rgba(80,255,140,1)' : 'rgba(255,70,80,1)', 700, 12, { glyph: v.y < 0 ? '▲' : '▼' }); } // the pointer trades: up = buy, down = sell
    },
    warp(S, n) {
      const d = S.data, t = (S.now - d.crash) / 1000;
      if (S.holding && S.stage) n.sy -= S.stage * 6 * (0.5 + 0.5 * Math.sin(n.p[0] * 5 + S.now * 0.004));
      if (t < 0 || t > 3.4) return;
      if (n.data.dl === undefined) { n.data.dl = Math.random() * 0.35; n.data.fl = S.H - 140 - Math.random() * 50; }
      const tt = Math.max(0, t - n.data.dl), floor = n.data.fl, fall = Math.min(floor, n.sy + 0.5 * 2600 * tt * tt);
      const back = clamp((t - 2.3) / 1.1, 0, 1), e = back * back * (3 - 2 * back);
      n.sy = lerp(fall, n.sy, e);
    },
    drawNode(S, ctx, n, g, size, a) {
      const t = S.now - S.data.crash;
      if (t > 3600 && !(S.holding && n.inf)) return false;
      ctx.font = `bold ${size.toFixed(1)}px monospace`;
      ctx.fillStyle = t < 3600 ? `rgba(255,${60 + 40 * Math.sin(n.p[1] * 9)},70,${a})` : S.colorOf(n.gen, a);
      if (t > 3600) drawGlow(ctx, '60,255,120', n.sx, n.sy, size * 1.2, 0.35 * a);
      ctx.fillText(g, n.sx, n.sy);
      return true;
    },
    onRelease(S, held, pw) {
      const d = S.data; d.crash = S.now; d.peak = d.pct;
      S.active.forEach((n) => { n.data.dl = Math.random() * 0.35; n.data.fl = S.H - 140 - Math.random() * 50; if (n.inf) S.spawn(n.sx, n.sy, rand(-1.5, 1.5), rand(-3, 0), 'rgba(255,60,80,1)', rand(1200, 1800), 16, { glyph: pick(['$', '€', '¥', '↓']), g: 0.22, drag: 0.995 }); });
      S.ring(S.ptr.x, S.ptr.y, 300 * pw, [355, 100, 55], 900);
      S.flash(0.18, '255,30,40'); S.shake(10 * pw);
      return false;
    },
    hud(S) {
      const d = S.data, t = S.now - d.crash;
      if (S.holding) return d.pct >= 420 ? 'SPHERE/USD +420% · circuit breaker engaged · still holding' : `SPHERE/USD +${d.pct}% · bull run · to the moon`;
      if (t < 2600) return `SPHERE/USD −${(69 + (d.peak || 0) / 100).toFixed(1)}% · this is fine`;
      if (t < 6000) return 'dead cat bounce · buy the dip? (not financial advice, it is a sphere)';
      return 'SPHERE/USD flat · hold to pump · past performance ≠ future letters';
    }
  });

  /* ======================= 3. GAME OF LIFE ======================= */
  const GLIDER = [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]];
  const RPENT = [[1, 0], [2, 0], [0, 1], [1, 1], [1, 2]];
  const LWSS = [[1, 0], [4, 0], [0, 1], [0, 2], [4, 2], [0, 3], [1, 3], [2, 3], [3, 3]];
  const GOSPER = [[24, 0], [22, 1], [24, 1], [12, 2], [13, 2], [20, 2], [21, 2], [34, 2], [35, 2], [11, 3], [15, 3], [20, 3], [21, 3], [34, 3], [35, 3], [0, 4], [1, 4], [10, 4], [16, 4], [20, 4], [21, 4], [0, 5], [1, 5], [10, 5], [14, 5], [16, 5], [17, 5], [22, 5], [24, 5], [10, 6], [16, 6], [24, 6], [11, 7], [15, 7], [12, 8], [13, 8]];
  function lifeSetup(S) {
    const d = S.data, cs = 6, gw = Math.max(8, Math.ceil(S.W / cs)), gh = Math.max(8, Math.ceil(S.H / cs));
    Object.assign(d, { cs, gw, gh, a: new Uint8Array(gw * gh), b: new Uint8Array(gw * gh), heat: new Uint8Array(gw * gh), gen: d.gen || 0, pop: 0, lastStep: 0, lastSeed: 0 });
    d.cv = S.offscreen(gw, gh); d.cvx = d.cv.getContext('2d'); d.img = d.cvx.createImageData(gw, gh);
    for (let p = 0; p < 9; p++) { const x0 = Math.floor(rand(0, gw - 14)), y0 = Math.floor(rand(0, gh - 14)); for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) if (Math.random() < 0.38) d.a[(y0 + y) * gw + x0 + x] = 1; }
  }
  function lifeStamp(d, pat, cx, cy, fx, fy) {
    let w = 0, h = 0; pat.forEach((p) => { w = Math.max(w, p[0]); h = Math.max(h, p[1]); });
    pat.forEach((p) => { const x = ((cx + (fx < 0 ? w - p[0] : p[0])) % d.gw + d.gw) % d.gw, y = ((cy + (fy < 0 ? h - p[1] : p[1])) % d.gh + d.gh) % d.gh; d.a[y * d.gw + x] = 1; });
  }
  function lifeStep(d) {
    const { gw, gh, a, b, heat } = d, px = d.img.data; let pop = 0;
    for (let y = 0; y < gh; y++) {
      const ym = ((y - 1 + gh) % gh) * gw, y0 = y * gw, yp = ((y + 1) % gh) * gw;
      for (let x = 0; x < gw; x++) {
        const xm = x === 0 ? gw - 1 : x - 1, xp = x === gw - 1 ? 0 : x + 1;
        const n = a[ym + xm] + a[ym + x] + a[ym + xp] + a[y0 + xm] + a[y0 + xp] + a[yp + xm] + a[yp + x] + a[yp + xp];
        const i = y0 + x, alive = n === 3 || (n === 2 && a[i] === 1);
        b[i] = alive ? 1 : 0;
        const o = i * 4;
        if (alive) { pop++; heat[i] = 255; px[o] = 110; px[o + 1] = 255; px[o + 2] = 150; px[o + 3] = 150; }
        else { const h = heat[i] = (heat[i] * 0.8) | 0; px[o] = 0; px[o + 1] = 140; px[o + 2] = 110; px[o + 3] = h * 0.3; }
      }
    }
    d.a = b; d.b = a; d.pop = pop; d.gen++;
    d.cvx.putImageData(d.img, 0, 0);
  }
  SP.addMode({
    id: 'life', name: 'GAME OF LIFE', glyphs: G('■□▪▫▣▤▥▦▧▨▩█▓▒░', '■□▪▫█▓▒░'),
    base: [120, 25, 78], palette: [[120, 100, 62], [80, 100, 62], [165, 100, 60]],
    links: ['circuit', 'hexchain', 'beads', 'zipper'], opaque: true, count: 64, noHueShift: true, pageBg: ['#020d06', '#000403'],
    shapes: ['sphere', 'menger', 'hilbert', 'sierpinski', 'torus', 'cube', 'cell16', 'helix'],
    init(S) { lifeSetup(S); },
    resize(S) { lifeSetup(S); },
    update(S, now) {
      const d = S.data;
      if (now - d.lastStep > (S.holding ? 70 : 110)) { d.lastStep = now; lifeStep(d); }
      const sp = pspeed(S);
      if (sp > 0.6 && S.ptr.x >= 0 && S.ptr.y >= 0) { // dragging the pointer sows live cells
        const cx = Math.floor(S.ptr.x / d.cs), cy = Math.floor(S.ptr.y / d.cs), n = Math.min(8, 1 + Math.floor(sp / 3));
        for (let k = 0; k < n; k++) { const x = (cx + Math.floor(rand(-2, 3)) + d.gw) % d.gw, y = (cy + Math.floor(rand(-2, 3)) + d.gh) % d.gh; d.a[y * d.gw + x] = 1; }
      }
      if (now - d.lastSeed > 4500 || d.pop < 120) { d.lastSeed = now; lifeStamp(d, Math.random() < 0.5 ? RPENT : GLIDER, Math.floor(rand(0, d.gw)), Math.floor(rand(0, d.gh)), pick([1, -1]), pick([1, -1])); }
    },
    background(S, ctx) {
      const d = S.data;
      ctx.fillStyle = 'rgba(0,8,4,0.55)'; ctx.fillRect(0, 0, S.W, S.H);
      ctx.imageSmoothingEnabled = false; ctx.drawImage(d.cv, 0, 0, d.gw * d.cs, d.gh * d.cs); ctx.imageSmoothingEnabled = true;
      blit(ctx, layer(S, 'grid', S.W, S.H, (x, w, h) => {
        x.strokeStyle = 'rgba(80,255,140,0.045)'; x.lineWidth = 1; x.beginPath();
        for (let i = 0; i <= w; i += d.cs) { x.moveTo(i + 0.5, 0); x.lineTo(i + 0.5, h); }
        for (let j = 0; j <= h; j += d.cs) { x.moveTo(0, j + 0.5); x.lineTo(w, j + 0.5); }
        x.stroke();
      }));
    },
    onInfect(S, n, parent) {
      const d = S.data, s = S.seed || n;
      lifeStamp(d, GLIDER, Math.floor(n.sx / d.cs), Math.floor(n.sy / d.cs), n.sx >= s.sx ? 1 : -1, n.sy >= s.sy ? 1 : -1);
    },
    drawNode(S, ctx, n, g, size, a) {
      if (!n.inf) return false;
      const cs = S.data.cs, x = Math.floor(n.sx / cs) * cs, y = Math.floor(n.sy / cs) * cs, k = Math.ceil(size / cs / 2) * cs;
      ctx.fillStyle = S.colorOf(n.gen, 0.22 * a); ctx.fillRect(x - k, y - k, k * 2 + cs, k * 2 + cs);
      ctx.strokeStyle = S.colorOf(n.gen, 0.6 * a); ctx.lineWidth = 1; ctx.strokeRect(x - k + 0.5, y - k + 0.5, k * 2 + cs - 1, k * 2 + cs - 1);
      return false;
    },
    onRelease(S, held) {
      const d = S.data;
      if (held > S.STAGES[3] && S.seed) { lifeStamp(d, GOSPER, Math.floor(S.seed.sx / d.cs) - 18, Math.floor(S.seed.sy / d.cs) - 4, 1, 1); d.gun = S.now; }
      S.active.forEach((n) => { if (n.inf && Math.random() < 0.5) lifeStamp(d, LWSS, Math.floor(n.sx / d.cs), Math.floor(n.sy / d.cs), n.sx > S.cx ? 1 : -1, 1); });
    },
    hud(S) {
      const d = S.data;
      if (d.gun && S.now - d.gun < 6000) return `Gosper glider gun deployed · gen ${d.gen} · pop ${d.pop} · this is how the singularity starts`;
      return `gen ${d.gen} · pop ${d.pop} · B3/S23 · Turing-complete, emotionally incomplete`;
    }
  });

  /* ======================= 4. VIRUS ======================= */
  function newCell(S, x, y, r) { return { x, y, r: r || rand(28, 46), rmax: rand(34, 52), vx: rand(-0.2, 0.2), vy: rand(-0.2, 0.2), ph: rand(0, 0.7), dir: rand(0, TAU), born: S.now, die: 0, inf: 0, w: rand(0, 10) }; }
  function cellPath(ctx, x, y, r, w, now) {
    ctx.moveTo(x + r, y);
    for (let k = 1; k <= 18; k++) { const a = k / 18 * TAU, rr = r * (1 + 0.05 * Math.sin(a * 3 + now * 0.002 + w)); ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  }
  SP.addMode({
    id: 'virus', name: 'VIRUS', glyphs: G('ACGU☣✺✹❋⁂✷', 'ACGU*#'),
    base: [90, 45, 72], palette: [[95, 100, 52], [320, 95, 62], [60, 100, 55]],
    links: ['membrane', 'pm_tentacle', 'barbed', 'plasma'], fade: 0.5, count: 80, pageBg: ['#071205', '#120410'],
    shapes: ['urchin', 'icosahedron', 'buckyball', 'rhombic_triacontahedron', 'sphere', 'dodecahedron', 'cell600'],
    init(S) { S.data.cells = Array.from({ length: 7 }, () => newCell(S, rand(0, S.W), rand(0, S.H))); S.data.abs = []; S.data.immune = -1e9; },
    update(S, now, dt) {
      const d = S.data, list = [];
      for (const c of d.cells) {
        repel(S, c, 150 + c.r, 0.06); const sp = Math.hypot(c.vx, c.vy); if (sp > 0.25) { c.vx *= 0.985; c.vy *= 0.985; } // cells shy away from the pointer
        c.x += c.vx * dt / 16; c.y += c.vy * dt / 16;
        if (c.x < -60) c.x = S.W + 60; if (c.x > S.W + 60) c.x = -60; if (c.y < -60) c.y = S.H + 60; if (c.y > S.H + 60) c.y = -60;
        c.r = Math.min(c.rmax, c.r + dt * 0.002);
        const near = S.holding && (S.stage >= 2 || Math.hypot(c.x - S.ptr.x, c.y - S.ptr.y) < 160 + 80 * S.stage);
        c.inf = clamp(c.inf + (near ? dt / 600 : -dt / 2500), 0, 1);
        c.ph += dt / (S.holding ? 4500 : 11000) * (1 + c.inf * 2);
        if (c.die) { if (now - c.die > 1200) continue; }
        if (c.ph >= 1 && !c.die) {
          const ox = Math.cos(c.dir) * c.r * 0.9, oy = Math.sin(c.dir) * c.r * 0.9;
          [1, -1].forEach((s) => { const k = newCell(S, c.x + ox * s, c.y + oy * s, c.r * 0.72); k.ph = 0; k.inf = c.inf; k.vx = c.vx + s * Math.cos(c.dir) * 0.25; k.vy = c.vy + s * Math.sin(c.dir) * 0.25; list.push(k); });
          continue;
        }
        list.push(c);
      }
      const alive = list.filter((c) => !c.die);
      if (alive.length > 12) alive.sort((a, b) => a.born - b.born).slice(0, alive.length - 12).forEach((c) => (c.die = now));
      d.cells = list;
    },
    ambient(S, ctx, now) {
      const d = S.data;
      for (const c of d.cells) {
        const fade = c.die ? clamp(1 - (now - c.die) / 1200, 0, 1) : 1;
        const rgb = c.inf > 0.5 ? '255,70,200' : '120,255,140', a = fade * (0.55 + 0.25 * c.inf);
        ctx.beginPath();
        if (c.ph > 0.72) {
          const s = (c.ph - 0.72) / 0.28, ox = Math.cos(c.dir) * c.r * 0.9 * s, oy = Math.sin(c.dir) * c.r * 0.9 * s, rr = c.r * (1 - 0.25 * s);
          cellPath(ctx, c.x + ox, c.y + oy, rr, c.w, now); cellPath(ctx, c.x - ox, c.y - oy, rr, c.w + 2, now);
        } else cellPath(ctx, c.x, c.y, c.r, c.w, now);
        ctx.fillStyle = `rgba(${rgb},${0.06 * a})`; ctx.fill();
        ctx.strokeStyle = `rgba(${rgb},${0.4 * a})`; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(c.x + Math.sin(now * 0.001 + c.w) * 3, c.y, c.r * 0.32 * (c.ph > 0.6 ? 0.6 : 1), 0, TAU);
        ctx.fillStyle = `rgba(${rgb},${0.16 * a})`; ctx.fill();
        if (c.inf > 0.6 && Math.random() < 0.04) S.spawn(c.x, c.y, rand(-1, 1), rand(-1, 1), 'rgba(255,90,210,1)', 900, 2);
      }
    },
    drawNode(S, ctx, n, g, size, a) {
      if (!n.inf) return false;
      const r = size * 0.55, rot = S.now * 0.001 + n.p[0] * 4, col = S.colorOf(n.gen, a);
      ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.beginPath();
      ctx.arc(n.sx, n.sy, r, 0, TAU);
      for (let k = 0; k < 10; k++) { const an = rot + k * TAU / 10, c = Math.cos(an), s = Math.sin(an); ctx.moveTo(n.sx + c * r, n.sy + s * r); ctx.lineTo(n.sx + c * r * 1.55, n.sy + s * r * 1.55); }
      ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath();
      for (let k = 0; k < 10; k++) { const an = rot + k * TAU / 10; ctx.moveTo(n.sx + Math.cos(an) * r * 1.6 + 1.8, n.sy + Math.sin(an) * r * 1.6); ctx.arc(n.sx + Math.cos(an) * r * 1.6, n.sy + Math.sin(an) * r * 1.6, 1.8, 0, TAU); }
      ctx.fill();
      ctx.font = `${(size * 0.6).toFixed(1)}px monospace`; ctx.fillText(g, n.sx, n.sy);
      return true;
    },
    over(S, ctx, now, dt) {
      const d = S.data;
      if (!d.abs.length) return;
      ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,240,160,0.9)';
      ctx.beginPath();
      d.abs = d.abs.filter((b) => !b.hit || now - b.hit < 300);
      for (const b of d.abs) {
        if (now < b.t) continue;
        if (!b.hit) {
          const dx = b.tx - b.x, dy = b.ty - b.y, dist = Math.hypot(dx, dy);
          const sp = Math.min(dist, (5 + b.sp) * dt / 16);
          b.ang = Math.atan2(dy, dx) + Math.sin(now * 0.02 + b.w) * 0.25;
          b.x += Math.cos(b.ang) * sp; b.y += Math.sin(b.ang) * sp;
          if (dist < 6) { b.hit = now; for (let k = 0; k < 5; k++) S.spawn(b.x, b.y, rand(-2, 2), rand(-2, 2), 'rgba(255,240,170,1)', 500, 1.8); }
        }
        const c = Math.cos(b.ang), s = Math.sin(b.ang), z = 1.6;
        ctx.moveTo(b.x - c * 9 * z, b.y - s * 9 * z); ctx.lineTo(b.x, b.y);
        ctx.lineTo(b.x + (c * 5 - s * 4) * z, b.y + (s * 5 + c * 4) * z);
        ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + (c * 5 + s * 4) * z, b.y + (s * 5 - c * 4) * z);
      }
      ctx.stroke();
    },
    onRelease(S) {
      const d = S.data, inf = S.active.filter((n) => n.inf), total = Math.min(70, Math.max(36, inf.length));
      for (let i = 0; i < total && inf.length; i++) {
        const n = inf[Math.floor(i * inf.length / total)], e = Math.floor(rand(0, 4));
        const x = e === 0 ? -20 : e === 1 ? S.W + 20 : rand(0, S.W), y = e === 2 ? -20 : e === 3 ? S.H + 20 : rand(0, S.H);
        d.abs.push({ x, y, tx: n.sx, ty: n.sy, t: S.now + rand(0, 500), sp: rand(0, 4), w: rand(0, 10), ang: 0, hit: 0 });
      }
      d.cells.forEach((c) => (c.inf = 0));
      d.immune = S.now;
      S.ring(S.ptr.x, S.ptr.y, 320, [55, 100, 70], 1000);
      return false;
    },
    hud(S) {
      const d = S.data;
      if (S.holding) return `R₀ = ${(1.2 + S.stage * 1.4).toFixed(1)} · cases ${S.infected} · flattening the curve: no`;
      if (S.now - d.immune < 5000) return `antibodies deployed: ${d.abs.length} · herd immunity achieved · please still wash your hands`;
      return `cells: ${d.cells.length} dividing · incubating… · wash your hands (20 s)`;
    }
  });

  /* ======================= 5. QUANTUM ======================= */
  SP.addMode({
    id: 'quantum', name: 'QUANTUM', glyphs: G('ψΨφℏ⊗†01αβ⟩⟨∣χ', 'ψΨφ01αβ'),
    base: [250, 60, 82], palette: [[200, 100, 72], [280, 100, 74], [330, 100, 72]],
    links: ['wave', 'spiral', 'pm_sine', 'constellation'], fade: 0.42, count: 90, noHueShift: true, glyphScale: 1.1, pageBg: ['#0b0620', '#02020c'],
    shapes: ['atom', 'sphere', 'hopf', 'clifford_torus', 'harmonic', 'cell24', 'tesseract', 'lissajous'],
    init(S) { const d = S.data; d.tun = -1e9; d.hits = 0; d.collapsed = 0; },
    update(S, now, dt) {
      const d = S.data, act = S.active, N = act.length;
      const rObs = S.holding ? 30 + S.held * 0.09 : 0;
      let col = 0;
      act.forEach((n, i) => {
        n.data.ix = i; n.data.pair = act[N - 1 - i];
        if (n.data.alt === undefined) { n.data.alt = S.glyph(); n.data.ph = rand(0, TAU); }
        const near = rObs && Math.hypot(n.sx - S.ptr.x, n.sy - S.ptr.y) < rObs;
        const want = n.inf || near ? 1 : 0;
        n.data.obs = clamp((n.data.obs || 0) + (want ? dt / 160 : -dt / 900), 0, 1);
      });
      act.forEach((n) => { const p = n.data.pair; if (p && p.data.obs > n.data.obs) n.data.obs = p.data.obs; if (n.data.obs > 0.9) col++; });
      d.collapsed = col;
    },
    ambient(S, ctx, now) {
      // the detector screen from a double-slit experiment, collecting photons while observed
      const d = S.data, x0 = S.W - 64, y0 = 90, h = Math.max(100, S.H - 260);
      const fr = layer(S, 'fringe', 40, h, (x, w, hh) => {
        for (let y = 0; y < hh; y++) { const u = (y / hh - 0.5) * 9, env = u === 0 ? 1 : Math.pow(Math.sin(u * 0.9) / (u * 0.9), 2), I = env * Math.pow(Math.cos(u * 2.4), 2); x.fillStyle = `rgba(160,140,255,${0.04 + 0.4 * I})`; x.fillRect(0, y, w, 1); }
      });
      const det = d.det || (d.det = S.offscreen(40, h));
      ctx.globalAlpha = 0.5; ctx.drawImage(fr, x0, y0, 40, h); ctx.globalAlpha = 1;
      const dx = det.getContext('2d');
      if (S.holding) {
        dx.fillStyle = 'rgba(220,230,255,0.9)';
        for (let k = 0; k < 2 + S.stage * 3; k++) {
          for (let tries = 0; tries < 8; tries++) { const y = Math.random(), u = (y - 0.5) * 9, env = u === 0 ? 1 : Math.pow(Math.sin(u * 0.9) / (u * 0.9), 2), I = env * Math.pow(Math.cos(u * 2.4), 2); if (Math.random() < I) { dx.fillRect(Math.random() * 38, y * h, 2, 2); d.hits++; break; } }
        }
      } else { dx.globalCompositeOperation = 'destination-out'; dx.fillStyle = 'rgba(0,0,0,0.02)'; dx.fillRect(0, 0, 40, h); dx.globalCompositeOperation = 'source-over'; }
      ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(det, x0, y0, 40, h);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(180,170,255,0.3)'; ctx.lineWidth = 1; ctx.strokeRect(x0 - 0.5, y0 - 0.5, 41, h + 1);
      ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(180,170,255,0.55)';
      ctx.fillText('DETECTOR', x0 + 20, y0 - 10); ctx.fillText(`${d.hits} γ`, x0 + 20, y0 + h + 12);
    },
    under(S, ctx, now) {
      // entanglement threads between collapsed pairs
      ctx.globalCompositeOperation = 'lighter'; ctx.setLineDash([2, 5]); ctx.lineDashOffset = -now * 0.03; ctx.lineWidth = 1;
      let drawn = 0;
      for (const n of S.active) {
        const p = n.data.pair;
        if (!p || n.data.ix > p.data.ix || n.data.obs < 0.5 || drawn > 60) continue;
        drawn++;
        const h = (190 + (n.data.ix * 47) % 170);
        ctx.strokeStyle = `hsla(${h},100%,72%,${0.35 * n.data.obs})`; S.line(n.sx, n.sy, p.sx, p.sy);
      }
      ctx.setLineDash([]);
      if (S.holding) { const r = 30 + S.held * 0.09; ctx.strokeStyle = 'rgba(200,190,255,0.25)'; ctx.beginPath(); ctx.arc(S.ptr.x, S.ptr.y, r, 0, TAU); ctx.stroke(); }
    },
    warp(S, n) {
      const t = (S.now - S.data.tun) / 700;
      if (t < 0 || t > 1 || n.data.tx === undefined) return;
      const e = 1 - t * t; n.sx += n.data.tx * e; n.sy += n.data.ty * e;
    },
    drawNode(S, ctx, n, g, size, a) {
      const ix = n.data.ix || 0, pi = Math.min(ix, S.active.length - 1 - ix), h = 190 + (pi * 47) % 170, o = n.data.obs || 0;
      ctx.font = `${size.toFixed(1)}px monospace`;
      if (o < 1) {
        const near = Math.max(0, 1 - Math.hypot(n.sx - S.ptr.x, n.sy - S.ptr.y) / 170), ph = S.now * 0.004 * (1 + near * 2) + (n.data.ph || 0), dd = size * 0.45 * (1 - o) * (1 + near * 1.8), alt = n.data.alt || g;
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, hsl2rgb(h, 90, 60).join(','), n.sx, n.sy, size * 1.2, 0.18 * a * (1 - o));
        for (let k = 0; k < 3; k++) {
          const an = ph * (k % 2 ? -1 : 1) + k * 2.094, fl = 0.55 + 0.45 * Math.sin(S.now * 0.011 + k * 2 + ix);
          ctx.fillStyle = `hsla(${h},95%,72%,${a * 0.62 * fl * (1 - o)})`;
          ctx.fillText(k % 2 ? alt : g, n.sx + Math.cos(an) * dd, n.sy + Math.sin(an) * dd);
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      if (o > 0) {
        drawGlow(ctx, hsl2rgb(h, 100, 65).join(','), n.sx, n.sy, size * 1.3, 0.5 * o * a);
        ctx.fillStyle = `hsla(${h},100%,${88 - 10 * o}%,${a * o})`; ctx.fillText(g, n.sx, n.sy);
      }
      return true;
    },
    over(S, ctx, now, dt) { fxDraw(S, ctx, dt); },
    onRelease(S) {
      S.data.tun = S.now;
      S.active.forEach((n) => { if (n.inf && Math.random() < 0.25) starBurst(S, n.sx, n.sy, 1, rand(280, 320), 2.5); });
      S.active.forEach((n) => { const an = rand(0, TAU), r = rand(10, 60); n.data.tx = Math.cos(an) * r; n.data.ty = Math.sin(an) * r; n.data.obs = 0; });
    },
    hud(S) {
      const d = S.data;
      if (S.holding) return `observing… ${d.collapsed}/${S.active.length} collapsed · entangled pairs collapse together · ΔxΔp ≥ ℏ/2`;
      if (S.now - d.tun < 4000) return 'decoherence complete · letters tunnelled · the cat is fine (probably)';
      return "Schrödinger's letter: both infected and not";
    }
  });

  /* ======================= 6. FIREWORKS ======================= */
  const FW_TYPES = ['peony', 'ring', 'willow', 'crossette', 'crackle', 'glyph', 'peony', 'palm'];
  function fwLaunch(S, x, y, h, delay, type) {
    S.data.rk.push({ x, y, vx: rand(-0.5, 0.5), vy: -Math.sqrt(2 * 0.11 * h), t: S.now + (delay || 0), hue: pick(S.mode.palette)[0] + rand(-15, 15), type: type || (S.shape && S.shape.key === 'heart' && Math.random() < 0.5 ? 'heart' : pick(FW_TYPES)) });
  }
  function fwBurst(S, r) {
    const d = S.data, x = r.x, y = r.y, col = (l) => `hsla(${r.hue},100%,${l}%,1)`;
    d.fl.push({ x, y, t: S.now, rgb: hsl2rgb(r.hue, 100, 70).join(',') });
    if (r.type !== 'split') starBurst(S, x, y, 5, r.hue, 3.2);
    const T = r.type;
    if (T === 'peony' || T === 'crackle') {
      for (let k = 0; k < 64; k++) { const a = rand(0, TAU), v = 3.6 * (0.75 + 0.25 * Math.random()); S.spawn(x, y, Math.cos(a) * v, Math.sin(a) * v, T === 'crackle' ? 'rgba(255,215,120,1)' : col(65), rand(900, 1400), 2, { g: 0.05, drag: 0.972 }); }
      if (T === 'crackle') for (let k = 0; k < 26; k++) d.pops.push({ x: x + rand(-90, 90), y: y + rand(-70, 100), t: S.now + rand(550, 1150) });
    } else if (T === 'ring') {
      const tilt = rand(0, Math.PI);
      for (let k = 0; k < 48; k++) { const a = k / 48 * TAU, vx = Math.cos(a) * 3.6, vy = Math.sin(a) * 1.4; S.spawn(x, y, vx * Math.cos(tilt) - vy * Math.sin(tilt), vx * Math.sin(tilt) + vy * Math.cos(tilt), col(70), 1200, 2.2, { g: 0.03, drag: 0.975 }); }
      for (let k = 0; k < 16; k++) { const a = rand(0, TAU); S.spawn(x, y, Math.cos(a), Math.sin(a), 'rgba(255,255,255,1)', 700, 1.5, { g: 0.02 }); }
    } else if (T === 'willow' || T === 'palm') {
      const n = T === 'palm' ? 9 : 56;
      for (let k = 0; k < n; k++) { const a = T === 'palm' ? -Math.PI / 2 + (k - 4) * 0.32 : rand(0, TAU), v = T === 'palm' ? 4.2 : rand(2, 3.4); S.spawn(x, y, Math.cos(a) * v, Math.sin(a) * v, 'rgba(255,190,90,1)', T === 'palm' ? 1700 : 2600, T === 'palm' ? 3.2 : 1.6, { g: 0.03, drag: 0.958 }); }
      if (T === 'palm') for (let k = 0; k < 9; k++) d.rk.push({ x, y, vx: Math.cos(-Math.PI / 2 + (k - 4) * 0.32) * 3.4, vy: Math.sin(-Math.PI / 2 + (k - 4) * 0.32) * 3.4, t: S.now, hue: 40, type: 'trail', fuse: S.now + 900 });
    } else if (T === 'crossette') {
      for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; d.rk.push({ x, y, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, t: S.now, hue: r.hue, type: 'split', fuse: S.now + 520 }); }
    } else if (T === 'glyph') {
      for (let k = 0; k < 26; k++) { const a = rand(0, TAU), v = rand(1.5, 3.4); S.spawn(x, y, Math.cos(a) * v, Math.sin(a) * v, col(70), rand(1000, 1500), 13, { g: 0.04, drag: 0.97, glyph: S.glyph() }); }
    } else if (T === 'heart') {
      for (let k = 0; k < 60; k++) { const t = k / 60 * TAU, hx = 16 * Math.pow(Math.sin(t), 3), hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)); S.spawn(x, y, hx * 0.22, hy * 0.22, 'rgba(255,80,140,1)', 1300, 2.2, { g: 0.02, drag: 0.965 }); }
    } else if (T === 'split') {
      for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + 0.78; S.spawn(x, y, Math.cos(a) * 2 + r.vx * 0.3, Math.sin(a) * 2 + r.vy * 0.3, col(70), 700, 1.8, { g: 0.05, drag: 0.96 }); }
    }
  }
  SP.addMode({
    id: 'fireworks', name: 'FIREWORKS', glyphs: G('✦✧★☆✶✷✸✹✺*+·火花', '*+·★☆'),
    base: [40, 70, 86], palette: [[0, 100, 62], [45, 100, 60], [200, 100, 66], [300, 100, 68], [130, 100, 60]],
    links: ['line', 'comet', 'rainbow', 'fire'], fade: 0.3, count: 70, pageBg: ['#07041a', '#120614'],
    shapes: ['sphere', 'rose', 'sunflower', 'heart', 'galaxy', 'crown', 'lissajous', 'great_stellated_dodecahedron'],
    init(S) { Object.assign(S.data, { rk: [], pops: [], fl: [], next: S.now + 1200, shells: 0 }); },
    update(S, now, dt) {
      const d = S.data;
      if (!S.holding && now > d.next) { d.next = now + rand(1800, 3600); fwLaunch(S, rand(S.W * 0.1, S.W * 0.9), S.H + 5, rand(0.45, 0.75) * S.H); }
      if (S.holding && S.stage === 3 && now > d.next) { d.next = now + 280; fwLaunch(S, rand(S.W * 0.05, S.W * 0.95), S.H + 5, rand(0.5, 0.85) * S.H); }
      const out = [];
      for (const r of d.rk) {
        if (now < r.t) { out.push(r); continue; }
        if (!r.go) { r.go = 1; }
        r.vy += (r.fuse ? 0.05 : 0.11) * dt / 16; r.x += r.vx * dt / 16; r.y += r.vy * dt / 16;
        if (r.fuse) { r.vx *= 0.97; r.vy *= 0.97; }
        if (Math.random() < 0.8) S.spawn(r.x, r.y, rand(-0.25, 0.25), rand(0, 0.6), r.fuse ? `hsla(${r.hue},100%,70%,1)` : 'rgba(255,200,130,1)', r.fuse ? 260 : 420, r.fuse ? 1.4 : 1.8, { drag: 0.94 });
        if (!r.fuse) repel(S, r, 90, 0.3); // rockets dodge the pointer
        if ((r.fuse && now > r.fuse) || (!r.fuse && r.vy > -0.7)) { if (r.type !== 'trail') fwBurst(S, r); continue; }
        out.push(r);
      }
      d.rk = out;
      if (d.pops.length) d.pops = d.pops.filter((p) => { if (now < p.t) return true; for (let k = 0; k < 3; k++) S.spawn(p.x, p.y, rand(-1.2, 1.2), rand(-1.2, 1.2), 'rgba(255,255,240,1)', 180, 1.6); return false; });
      if (S.holding && S.stage >= 1) for (let k = 0; k < S.stage * 2; k++) { const n = pick(S.active); if (n && n.inf) { const a = rand(0, TAU), v = rand(0.6, 2.4); S.spawn(n.sx, n.sy, Math.cos(a) * v, Math.sin(a) * v, 'rgba(255,240,190,1)', 320, 1.3, { g: 0.04 }); } }
    },
    over(S, ctx, now, dt) {
      const d = S.data;
      if (pspeed(S) > 2 && Math.random() < 0.6) fxAdd(S, { x: S.ptr.x + rand(-6, 6), y: S.ptr.y + rand(-6, 6), vx: rand(-0.4, 0.4), vy: rand(-0.4, 0.4), s: rand(3, 7), life: 600, hue: rand(30, 60) }); // a sparkler on the pointer
      fxDraw(S, ctx, dt);
      ctx.globalCompositeOperation = 'lighter';
      d.fl = d.fl.filter((f) => now - f.t < 200);
      for (const f of d.fl) drawGlow(ctx, f.rgb, f.x, f.y, 64, 0.3 * (1 - (now - f.t) / 200));
    },
    onRelease(S) {
      const d = S.data, inf = S.active.filter((n) => n.inf), step = Math.max(1, inf.length / 30);
      let k = 0;
      for (let i = 0; i < inf.length; i += step, k++) { const n = inf[Math.floor(i)]; fwLaunch(S, n.sx, n.sy, rand(110, 260), k * 35 + rand(0, 200)); }
      speedLines(S, S.ptr.x, S.ptr.y, 45);
      d.shells = k; d.rel = S.now;
      S.ring(S.ptr.x, S.ptr.y, 140, [45, 100, 70], 600);
      return false;
    },
    hud(S) {
      const d = S.data, fly = d.rk.length;
      if (S.holding) return S.stage === 3 ? 'grand finale armed · release to light every fuse' : `sparklers lit: ${S.infected} · keep holding for the finale`;
      if (d.rel && S.now - d.rel < 4000) return `${d.shells} shells launched · ooh · aah · fire marshal: notified`;
      return `${fly} in flight · ooh · aah · hold, then let go`;
    }
  });

  /* ======================= 7. ABYSS ======================= */
  function jellyDraw(ctx, j, now, glowA) {
    const p = Math.sin(j.ph), bw = j.s * (1 + 0.14 * p), bh = j.s * (0.78 - 0.18 * p);
    ctx.save(); ctx.translate(j.x, j.y); ctx.rotate(j.tilt);
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const x0 = (k / 7 - 0.5) * bw * 1.6; ctx.moveTo(x0, 0);
      for (let s = 1; s <= 9; s++) ctx.lineTo(x0 + Math.sin(now * 0.0022 + s * 0.55 + k * 1.3 + j.w) * j.s * 0.1 * s / 3, s * j.s * 0.36 * (1 - 0.1 * p));
    }
    ctx.strokeStyle = `rgba(${j.rgb},${0.32 * glowA})`; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-bw, 0);
    ctx.bezierCurveTo(-bw, -bh * 1.45, bw, -bh * 1.45, bw, 0);
    for (let k = 4; k > 0; k--) { const xa = -bw + (k - 0.5) * bw / 2, xb = -bw + (k - 1) * bw / 2; ctx.quadraticCurveTo(xa, bh * 0.22, xb, 0); }
    ctx.fillStyle = `rgba(${j.rgb},${0.14 * glowA})`; ctx.fill();
    ctx.strokeStyle = `rgba(${j.rgb},${0.7 * glowA})`; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
    drawGlow(ctx, j.rgb, j.x, j.y - bh * 0.4, j.s * 1.6, 0.35 * glowA);
  }
  SP.addMode({
    id: 'abyss', name: 'ABYSS', glyphs: G('∘°˚○◦⊙~≈ʘ◌∿', '°o~≈'),
    base: [190, 55, 72], palette: [[180, 100, 62], [160, 100, 55], [270, 90, 72]],
    links: ['pm_tentacle', 'pm_tentacle', 'pm_tentacle', 'constellation'], opaque: true, count: 60, noHueShift: true, pageBg: ['#002338', '#000208'],
    shapes: ['seashell', 'helicoid', 'catenoid', 'dupin', 'sphere', 'enneper', 'galaxy', 'torus'],
    init(S) {
      const d = S.data;
      d.pl = Array.from({ length: 150 }, () => ({ x: rand(0, S.W), y: rand(0, S.H), vx: 0, vy: 0, tw: rand(0, TAU), b: 0 }));
      d.bub = Array.from({ length: 18 }, () => ({ x: rand(0, S.W), y: rand(0, S.H), r: rand(1.5, 5), v: rand(0.4, 1.2), w: rand(0, 10) }));
      d.jel = Array.from({ length: 3 }, (_, i) => ({ x: S.W * (0.18 + 0.32 * i), y: rand(S.H * 0.3, S.H), s: rand(22, 42), ph: rand(0, TAU), tilt: 0, w: rand(0, 10), rgb: pick(['120,220,255', '190,140,255', '90,255,210']) }));
      d.bloom = -1e9;
    },
    background(S, ctx, now) {
      blit(ctx, layer(S, 'sea', S.W, S.H, (x, w, h) => {
        const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(0,32,58,0.82)'); g.addColorStop(0.5, 'rgba(0,12,30,0.9)'); g.addColorStop(1, 'rgba(0,0,6,0.96)');
        x.fillStyle = g; x.fillRect(0, 0, w, h);
      }));
      const rays = layer(S, 'rays', S.W + 200, S.H * 0.8, (x, w, h) => {
        for (let k = 0; k < 6; k++) {
          const x0 = w * (0.1 + 0.15 * k) + rand(-30, 30), bw = rand(30, 80), g = x.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, 'rgba(120,200,255,0.09)'); g.addColorStop(1, 'rgba(120,200,255,0)'); x.fillStyle = g;
          x.beginPath(); x.moveTo(x0, 0); x.lineTo(x0 + bw, 0); x.lineTo(x0 + bw * 2.6 + 120, h); x.lineTo(x0 + 120, h); x.closePath(); x.fill();
        }
      });
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.7 + 0.3 * Math.sin(now * 0.0005);
      blit(ctx, rays, -100 + Math.sin(now * 0.00025) * 60, 0); ctx.globalAlpha = 1;
    },
    ambient(S, ctx, now, dt) {
      const d = S.data, k = dt / 16, hold = S.holding, bl = (now - d.bloom) / 2500;
      ctx.globalCompositeOperation = 'lighter';
      const dim = new Path2D(), bright = new Path2D();
      for (const p of d.pl) {
        p.vx += gauss() * 0.03; p.vy += gauss() * 0.03 - 0.002; p.vx *= 0.97; p.vy *= 0.97;
        let lit = 0;
        if (hold) { const dx = S.ptr.x - p.x, dy = S.ptr.y - p.y, r = Math.hypot(dx, dy); if (r < 260) { lit = 1 - r / 260; p.vx += dx / r * 0.04 * lit; p.vy += dy / r * 0.04 * lit; } }
        if (bl < 1 && bl > 0) lit = Math.max(lit, 1 - bl);
        if (!hold) lit = Math.max(lit, repel(S, p, 130, 0.09) * 0.8); // plankton scatter and flash when brushed
        p.b = Math.max(p.b * 0.96, lit);
        p.x += p.vx * k; p.y += p.vy * k;
        if (p.x < 0) p.x += S.W; if (p.x > S.W) p.x -= S.W; if (p.y < 0) p.y += S.H; if (p.y > S.H) p.y -= S.H;
        const s = 1.2 + p.b * 1.6;
        (p.b > 0.25 || Math.sin(now * 0.002 + p.tw) > 0.92 ? bright : dim).rect(p.x - s / 2, p.y - s / 2, s, s);
      }
      ctx.fillStyle = 'rgba(120,230,255,0.35)'; ctx.fill(dim);
      ctx.fillStyle = 'rgba(160,255,240,0.95)'; ctx.fill(bright);
      ctx.strokeStyle = 'rgba(170,225,255,0.35)'; ctx.lineWidth = 1; ctx.beginPath();
      for (const b of d.bub) { b.y -= b.v * k * (1 + 0.5 * S.stage); b.x += Math.sin(now * 0.002 + b.w) * 0.3; const bd = b.x - S.ptr.x, bq = Math.abs(b.y - S.ptr.y); if (Math.abs(bd) < 60 && bq < 60) b.x += Math.sign(bd || 1) * (60 - Math.abs(bd)) * 0.12 * k; if (b.y < -10) { b.y = S.H + 10; b.x = rand(0, S.W); } ctx.moveTo(b.x + b.r, b.y); ctx.arc(b.x, b.y, b.r, 0, TAU); }
      ctx.stroke();
      for (const j of d.jel) {
        j.ph += dt * 0.0028 * (hold ? 1.6 : 1);
        const thrust = Math.max(0, Math.sin(j.ph)) * 0.9 + 0.12;
        let tx = Math.sin(j.tilt), ty = -Math.cos(j.tilt);
        j.x += tx * thrust * k; j.y += ty * thrust * k;
        const scared = !hold && Math.hypot(S.ptr.x - j.x, S.ptr.y - j.y) < 140;
        if (scared && Math.sin(j.ph) < 0) j.ph += 0.3; // startled: pulse now
        const want = hold ? Math.atan2(S.ptr.x - j.x, -(S.ptr.y - j.y)) : scared ? Math.atan2(j.x - S.ptr.x, -(j.y - S.ptr.y)) : Math.sin(now * 0.0003 + j.w) * 0.4;
        let da = want - j.tilt; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; j.tilt += da * 0.01;
        if (j.y < -j.s * 4) { j.y = S.H + j.s * 2; j.x = rand(0, S.W); }
        if (j.y > S.H + j.s * 5) j.y = -j.s * 3;
        if (j.x < -j.s * 3) j.x = S.W + j.s * 2; if (j.x > S.W + j.s * 3) j.x = -j.s * 2;
        jellyDraw(ctx, j, now, hold ? 0.8 + 0.2 * S.stage : 0.6);
      }
      if (hold && S.stage >= 2 && Math.random() < 0.06 * S.stage) { const n = pick(S.active); if (n && n.inf) S.ring(n.sx, n.sy, 60, [175, 100, 70], 1200); }
    },
    drawNode(S, ctx, n, g, size, a) {
      if (n.inf) drawGlow(ctx, '100,255,230', n.sx, n.sy, size * 1.6, 0.45 * a * (0.7 + 0.3 * Math.sin(S.now * 0.004 + n.gen)));
      ctx.font = `${size.toFixed(1)}px monospace`;
      ctx.fillStyle = n.inf ? S.colorOf(n.gen, a) : S.baseColor(a * 0.75); ctx.fillText(g, n.sx, n.sy);
      return true;
    },
    onRelease(S) {
      const d = S.data, s = S.seed || { sx: S.ptr.x, sy: S.ptr.y };
      d.bloom = S.now;
      d.pl.forEach((p) => { const dx = p.x - s.sx, dy = p.y - s.sy, r = Math.hypot(dx, dy) || 1, f = Math.max(0, 1 - r / 600) * 4; p.vx += dx / r * f; p.vy += dy / r * f; });
      d.jel.forEach((j) => { j.ph = Math.PI / 2; });
      S.ring(s.sx, s.sy, 420, [175, 100, 70], 1600); S.ring(s.sx, s.sy, 260, [270, 90, 75], 1200);
      return false;
    },
    hud(S) {
      if (S.holding) return `bioluminescence ${(25 + S.stage * 25)}% · the plankton noticed you · depth ${3800 + Math.round(S.held / 4)} m`;
      if (S.now - S.data.bloom < 4000) return 'bloom! · everything down here glows when startled · same';
      return 'depth 3 800 m · 380 atm · light: only what we make';
    }
  });

  /* ======================= 8. ELDRITCH ======================= */
  const ZB = Array.from(G('ΨΩЖѪѬҨᚦᛟ☿ΔΣΘ⸸ʘ', 'ΨΩЖΔΣΘ'));
  const zalgo = (k) => { let s = pick(ZB); for (let i = 0; i < k; i++) s += String.fromCharCode(0x300 + Math.floor(Math.random() * 0x6F)); return s; };
  function eyeSprites(S) {
    const sc = layer(S, 'sclera', 200, 120, (x, w, h) => {
      const g = x.createRadialGradient(w / 2, h / 2, 5, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgb(255,242,222)'); g.addColorStop(0.6, 'rgb(236,200,180)'); g.addColorStop(1, 'rgb(150,40,40)');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.strokeStyle = 'rgba(170,0,0,0.55)'; x.lineWidth = 0.8;
      for (let k = 0; k < 22; k++) {
        const a = rand(0, TAU); let px = w / 2 + Math.cos(a) * w * 0.55, py = h / 2 + Math.sin(a) * h * 0.55;
        x.beginPath(); x.moveTo(px, py);
        for (let s = 0; s < 6; s++) { px += (w / 2 - px) * 0.14 + rand(-5, 5); py += (h / 2 - py) * 0.14 + rand(-4, 4); x.lineTo(px, py); }
        x.stroke();
      }
    });
    const ir = layer(S, 'iris', 100, 100, (x, w) => {
      const r = w / 2, g = x.createRadialGradient(r, r, 2, r, r, r);
      g.addColorStop(0, 'rgb(40,0,0)'); g.addColorStop(0.3, 'rgb(200,30,0)'); g.addColorStop(0.7, 'rgb(255,170,40)'); g.addColorStop(0.92, 'rgb(120,10,0)'); g.addColorStop(1, 'rgba(40,0,0,0)');
      x.fillStyle = g; x.beginPath(); x.arc(r, r, r, 0, TAU); x.fill();
      x.strokeStyle = 'rgba(60,0,0,0.5)'; x.lineWidth = 1; x.beginPath();
      for (let k = 0; k < 48; k++) { const a = k / 48 * TAU + rand(-0.05, 0.05); x.moveTo(r + Math.cos(a) * r * 0.28, r + Math.sin(a) * r * 0.28); x.lineTo(r + Math.cos(a) * r * rand(0.6, 0.9), r + Math.sin(a) * r * rand(0.6, 0.9)); }
      x.stroke();
    });
    return [sc, ir];
  }
  SP.addMode({
    id: 'eldritch', name: 'ELDRITCH', glyphs: () => zalgo(2 + Math.floor(Math.random() * 6)),
    base: [30, 12, 66], palette: [[0, 90, 45], [350, 100, 32], [15, 100, 55]],
    links: ['pm_tentacle', 'pm_tentacle', 'barbed', 'blood'], fade: 0.42, count: 66, noHueShift: true, pageBg: ['#1a0204', '#000000'],
    shapes: ['sphere', 'klein', 'seashell', 'boy', 'great_stellated_dodecahedron', 'urchin', 'trefoil', 'hopf'],
    init(S) {
      const d = S.data;
      d.eye = { x: S.cx, y: S.cy, open: 0.1, size: S.R * 0.5, blink: S.now + 4000 };
      d.ext = 0.5; d.rel = -1e9;
      const bases = [[0.1, 1.04, -1.2], [0.3, 1.04, -1.45], [0.72, 1.04, -1.7], [0.92, 1.04, -1.95], [-0.02, 0.62, -0.25], [1.02, 0.5, Math.PI + 0.25]];
      d.ten = bases.map((b, i) => ({ fx: b[0], fy: b[1], a: b[2], len: rand(0.38, 0.55), ph: rand(0, 10), w: rand(16, 26), i }));
    },
    update(S, now, dt) {
      const d = S.data, e = d.eye, k = 1 - Math.pow(0.94, dt / 16);
      const wantOpen = S.holding ? 1 : now - d.rel < 900 ? 0 : 0.12, wantSize = S.holding ? S.R * (0.32 + 0.07 * S.stage) : S.R * 0.5;
      e.open += (wantOpen - e.open) * (S.holding ? k * 0.6 : now - d.rel < 900 ? 0.35 : k * 0.15);
      e.size += (wantSize - e.size) * k * 0.4;
      const tx = S.holding ? S.ptr.x : S.cx, ty = S.holding ? S.ptr.y : S.cy;
      e.x += (tx - e.x) * k * (S.holding ? 0.5 : 0.08); e.y += (ty - e.y) * k * (S.holding ? 0.5 : 0.08);
      if (now > e.blink + 220) e.blink = now + rand(3500, 7500);
      d.ext += ((S.holding ? 0.65 + 0.12 * S.stage : now - d.rel < 1500 ? 0.15 : 0.5) - d.ext) * k * 0.3;
      if (S.holding && Math.random() < 0.18 + 0.25 * S.stage) {
        const a = rand(0, TAU), r = Math.max(S.W, S.H) * 0.55, x = S.ptr.x + Math.cos(a) * r, y = S.ptr.y + Math.sin(a) * r, v = rand(2.5, 4.5);
        S.spawn(x, y, -Math.cos(a) * v, -Math.sin(a) * v, pick(['rgba(200,10,30,1)', 'rgba(140,0,0,1)', 'rgba(230,200,190,1)']), r / v * 16 * 0.9, rand(13, 22), { glyph: zalgo(3 + Math.floor(Math.random() * 5)), drag: 1 });
      } else if (!S.holding && Math.random() < 0.03) {
        S.spawn(rand(0, S.W), rand(0, S.H), rand(-0.3, 0.3), rand(-0.3, 0.3), 'rgba(150,0,10,1)', 2200, rand(12, 18), { glyph: zalgo(4), drag: 1 });
      }
    },
    background(S, ctx) {
      const p = power(S);
      blit(ctx, layer(S, 'vig', S.W, S.H, (x, w, h) => {
        const g = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.72);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.7, 'rgba(40,0,0,0.25)'); g.addColorStop(1, 'rgba(70,0,0,0.6)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      }));
      if (p > 0) { ctx.globalAlpha = p * 0.6; ctx.fillStyle = 'rgba(30,0,0,0.25)'; ctx.fillRect(0, 0, S.W, S.H); ctx.globalAlpha = 1; }
    },
    ambient(S, ctx, now) {
      const d = S.data, e = d.eye, M = Math.min(S.W, S.H);
      // tentacles
      for (const t of d.ten) {
        const bx = t.fx * S.W, by = t.fy * S.H, n = 18, L = M * t.len * d.ext * 1.25, seg = L / n;
        let x = bx, y = by, a = t.a;
        const left = [], right = [];
        for (let i = 0; i <= n; i++) {
          const w = t.w * Math.pow(1 - i / n, 0.85) + 1;
          left.push([x + Math.cos(a + Math.PI / 2) * w, y + Math.sin(a + Math.PI / 2) * w]); right.push([x - Math.cos(a + Math.PI / 2) * w, y - Math.sin(a + Math.PI / 2) * w]);
          let curl = 0.16 * Math.sin(now * 0.0012 + i * 0.42 + t.ph) * (0.5 + i / n);
          { let da = Math.atan2(S.ptr.y - y, S.ptr.x - x) - a; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; curl += da * (S.holding ? 0.05 * (0.3 + S.stage * 0.25) : 0.008); } // they always reach for the pointer
          a += curl; x += Math.cos(a) * seg; y += Math.sin(a) * seg;
        }
        ctx.beginPath(); ctx.moveTo(left[0][0], left[0][1]);
        for (const p of left) ctx.lineTo(p[0], p[1]);
        for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
        ctx.closePath();
        ctx.fillStyle = 'rgba(22,0,4,0.94)'; ctx.fill();
        ctx.strokeStyle = 'rgba(150,0,20,0.75)'; ctx.lineWidth = 1.4; ctx.stroke();
        ctx.fillStyle = 'rgba(220,120,120,0.35)'; ctx.beginPath();
        for (let i = 2; i < n - 2; i += 2) { const p = right[i], q = left[i], r = (t.w * Math.pow(1 - i / n, 0.85)) * 0.22 + 0.8; const sx = lerp(p[0], q[0], 0.25), sy = lerp(p[1], q[1], 0.25); ctx.moveTo(sx + r, sy); ctx.arc(sx, sy, r, 0, TAU); }
        ctx.fill();
      }
      // the eye
      const blinkF = now > e.blink && now < e.blink + 220 ? Math.abs(Math.cos((now - e.blink) / 220 * Math.PI)) : 1;
      const open = e.open * blinkF, E = e.size;
      ctx.save(); ctx.translate(e.x, e.y);
      if (open > 0.03) {
        const [sc, ir] = eyeSprites(S), H2 = E * 0.62 * open;
        drawGlow(ctx, '200,0,20', 0, 0, E * 1.6, 0.35 * open);
        ctx.beginPath(); ctx.moveTo(-E, 0); ctx.quadraticCurveTo(0, -H2 * 2, E, 0); ctx.quadraticCurveTo(0, H2 * 2, -E, 0); ctx.closePath();
        ctx.save(); ctx.clip();
        ctx.drawImage(sc, -E, -E * 0.62, E * 2, E * 1.24);
        const vx = S.ptr.x - e.x, vy = S.ptr.y - e.y, dist = Math.hypot(vx, vy) || 1, off = Math.min(1, dist / (E * 2.5)) * E * 0.42;
        const ix = vx / dist * off, iy = vy / dist * off * 0.7, IR = E * 0.42;
        ctx.drawImage(ir, ix - IR, iy - IR, IR * 2, IR * 2);
        const pw = 0.14 + 0.1 * S.stage + (S.holding ? 0.04 * Math.sin(now * 0.006) : 0);
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(ix, iy, IR * pw, IR * 0.86, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(ix - IR * 0.3, iy - IR * 0.35, IR * 0.08, 0, TAU); ctx.fill();
        const sh = ctx.createLinearGradient(0, -H2, 0, -H2 * 0.2); sh.addColorStop(0, 'rgba(40,0,0,0.85)'); sh.addColorStop(1, 'rgba(40,0,0,0)');
        ctx.fillStyle = sh; ctx.fillRect(-E, -H2 * 1.2, E * 2, H2);
        ctx.restore();
        ctx.strokeStyle = 'rgba(90,0,10,0.95)'; ctx.lineWidth = 3; ctx.stroke();
        ctx.strokeStyle = 'rgba(30,0,0,0.9)'; ctx.lineWidth = 1.5; ctx.beginPath();
        for (let k = 1; k < 12; k++) { const t = k / 12, px = lerp(-E, E, t), py = -H2 * 4 * t * (1 - t); ctx.moveTo(px, py); ctx.lineTo(px * 1.08, py - 6 - E * 0.06); }
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(120,0,15,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-E, 0); ctx.quadraticCurveTo(0, E * 0.12, E, 0); ctx.stroke();
      }
      ctx.restore();
    },
    drawNode(S, ctx, n, g, size, a) {
      ctx.font = `${size.toFixed(1)}px serif`;
      if (n.inf) {
        ctx.fillStyle = `rgba(255,0,0,${0.35 * a})`; ctx.fillText(g, n.sx + rand(-1.5, 1.5), n.sy + rand(-1.5, 1.5));
        ctx.fillStyle = S.colorOf(n.gen, a);
      } else ctx.fillStyle = S.baseColor(a * 0.85);
      ctx.fillText(g, n.sx, n.sy);
      return true;
    },
    onRelease(S, held, pw) {
      const d = S.data; d.rel = S.now;
      S.active.forEach((n) => { if (n.inf && Math.random() < 0.5) { const a = rand(0, TAU), v = rand(1, 4) * pw; S.spawn(n.sx, n.sy, Math.cos(a) * v, Math.sin(a) * v, 'rgba(220,0,20,1)', rand(900, 1600), rand(14, 24), { glyph: zalgo(6) }); } });
      S.flash(0.35, '160,0,0'); S.shake(9 * pw);
      S.ring(d.eye.x, d.eye.y, 300 * pw, [0, 100, 40], 900);
      return false;
    },
    hud(S) {
      const d = S.data;
      if (S.holding) return ['it stirs', 'it sees you', `sanity ${Math.max(0, 100 - Math.round(S.held / 50))}% and falling`, "ph'nglui mglw'nafh Sphere R'lyeh wgah'nagl fhtagn"][S.stage];
      if (S.now - d.rel < 5000) return 'it blinked. it will remember this.';
      return 'it is sleeping. do not hold. (hold.)';
    }
  });

  /* ======================= 9. SACRED GEOMETRY ======================= */
  const PHI = (1 + Math.sqrt(5)) / 2;
  SP.addMode({
    id: 'sacred', name: 'SACRED GEOMETRY', glyphs: G('△▽○◇☉φΦ∞⊙✡◬⬡☥', '△▽○◇φΦ∞'),
    base: [45, 55, 78], palette: [[45, 100, 60], [36, 90, 52], [52, 100, 84]],
    links: ['line', 'pm_vesica', 'pm_vesica', 'beam'], opaque: true, mesh: true, count: 84, noHueShift: true, pageBg: ['#140c02', '#000000'],
    shapes: ['sunflower', 'icosahedron', 'dodecahedron', 'stella_octangula', 'cell600', 'octahedron', 'rhombic_triacontahedron', 'cube', 'sphere'],
    init(S) { S.data.sp = null; },
    background(S, ctx, now) {
      blit(ctx, layer(S, 'bg', S.W, S.H, (x, w, h) => {
        const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
        g.addColorStop(0, 'rgba(18,11,0,0.86)'); g.addColorStop(1, 'rgba(0,0,0,0.96)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      }));
      const Ro = Math.min(S.W, S.H) * 0.47, p = power(S);
      const flower = layer(S, 'flower', Ro * 2, Ro * 2, (x) => {
        const r = Ro / 3.05; x.translate(Ro, Ro); x.strokeStyle = 'rgba(255,200,90,0.8)'; x.lineWidth = 1;
        const cs = [[0, 0]];
        for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; cs.push([Math.cos(a) * r, Math.sin(a) * r], [Math.cos(a) * 2 * r, Math.sin(a) * 2 * r], [Math.cos(a + Math.PI / 6) * r * Math.sqrt(3), Math.sin(a + Math.PI / 6) * r * Math.sqrt(3)]); }
        cs.forEach((c) => { x.beginPath(); x.arc(c[0], c[1], r, 0, TAU); x.stroke(); });
        [3, 3.03].forEach((f) => { x.beginPath(); x.arc(0, 0, r * f, 0, TAU); x.stroke(); });
      });
      const meta = layer(S, 'meta', Ro * 2, Ro * 2, (x) => {
        const r = Ro / 5; x.translate(Ro, Ro); x.strokeStyle = 'rgba(255,215,120,0.75)'; x.lineWidth = 1;
        const cs = [[0, 0]];
        for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + Math.PI / 6; cs.push([Math.cos(a) * 2 * r, Math.sin(a) * 2 * r], [Math.cos(a) * 4 * r, Math.sin(a) * 4 * r]); }
        x.beginPath(); for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) { x.moveTo(cs[i][0], cs[i][1]); x.lineTo(cs[j][0], cs[j][1]); } x.stroke();
        cs.forEach((c) => { x.beginPath(); x.arc(c[0], c[1], r, 0, TAU); x.stroke(); });
      });
      const px = (S.ptr.x - S.cx) * 0.05, py = (S.ptr.y - S.cy) * 0.05; // parallax: the layers lean toward the pointer
      ctx.save(); ctx.translate(S.cx + px, S.cy + py); ctx.globalCompositeOperation = 'lighter';
      ctx.rotate(now * 0.00004); ctx.globalAlpha = 0.3 + 0.2 * p; ctx.drawImage(flower, -Ro, -Ro, Ro * 2, Ro * 2);
      const sc = 0.9 + 0.08 * Math.sin(now * 0.0007) + 0.25 * p;
      ctx.translate(-px * 2, -py * 2); ctx.rotate(-now * 0.0001); ctx.scale(sc, sc); ctx.globalAlpha = 0.16 + 0.3 * p; ctx.drawImage(meta, -Ro, -Ro, Ro * 2, Ro * 2);
      ctx.restore();
      if (p > 0.05) { // Sri Yantra-ish interlocking triangles
        const rr = Ro * 0.62 * (0.6 + 0.4 * p);
        ctx.save(); ctx.translate(S.cx, S.cy); ctx.rotate(-now * 0.00012); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255,190,80,${0.5 * p})`; ctx.lineWidth = 1.2; ctx.beginPath();
        for (let k = 0; k < 9; k++) {
          const up = k < 4, s = rr * (1 - k * 0.075), oy = (up ? 1 : -1) * rr * (0.06 + 0.05 * k) * (up ? 1 : 0.8), dir = up ? -1 : 1;
          ctx.moveTo(0, oy + dir * s); ctx.lineTo(s * 0.92, oy - dir * s * 0.5); ctx.lineTo(-s * 0.92, oy - dir * s * 0.5); ctx.closePath();
        }
        ctx.stroke(); ctx.restore();
      }
    },
    over(S, ctx, now) {
      fxDraw(S, ctx, S.dt);
      const sp = S.data.sp;
      if (!sp) return;
      const t = (now - sp.t) / 2600;
      if (t > 1) { S.data.sp = null; return; }
      const b = Math.log(PHI) / (Math.PI / 2), th = Math.min(1, t * 1.6) * 5.2 * Math.PI, a = 3.2;
      ctx.save(); ctx.translate(sp.x, sp.y); ctx.rotate(sp.r); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,215,120,${1 - t})`; ctx.lineWidth = 2.6; ctx.beginPath();
      for (let k = 0; k <= 160; k++) { const q = th * k / 160, r = a * Math.exp(b * q); if (k) ctx.lineTo(Math.cos(q) * r, Math.sin(q) * r); else ctx.moveTo(r, 0); }
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,210,110,${0.35 * (1 - t)})`; ctx.lineWidth = 1; ctx.beginPath(); // the Fibonacci squares the spiral sits in
      for (let k = 0, q = 0; q < th - Math.PI / 2; k++, q += Math.PI / 2) { const r0 = a * Math.exp(b * q), r1 = a * Math.exp(b * (q + Math.PI / 2)); ctx.moveTo(Math.cos(q) * r0, Math.sin(q) * r0); ctx.lineTo(Math.cos(q + Math.PI / 2) * r1 + Math.cos(q) * r1, Math.sin(q + Math.PI / 2) * r1 + Math.sin(q) * r1); ctx.lineTo(Math.cos(q + Math.PI / 2) * r1, Math.sin(q + Math.PI / 2) * r1); }
      ctx.stroke();
      ctx.restore();
    },
    onRelease(S, held, pw) {
      const s = S.seed || { sx: S.ptr.x, sy: S.ptr.y };
      S.data.sp = { x: s.sx, y: s.sy, t: S.now, r: rand(0, TAU) };
      starBurst(S, s.sx, s.sy, 21, 45, 4);
      S.active.forEach((n) => { if (n.inf) S.spawn(n.sx, n.sy, (n.sx - s.sx) * 0.012, (n.sy - s.sy) * 0.012, 'rgba(255,205,110,1)', 1400, 1.6, { drag: 0.99 }); });
      S.ring(s.sx, s.sy, 200 * PHI * pw, [45, 100, 65], 1400); S.ring(s.sx, s.sy, 200 * pw, [45, 100, 75], 1000);
      return false;
    },
    hud(S) {
      if (S.holding) return ['the seed of life', 'the flower of life', "Metatron's cube aligns", 'φ everywhere · as above, so below'][S.stage];
      return 'φ = 1.6180339887… · tolerances: divine · rotation: slow, on purpose';
    }
  });

  /* ======================= 10. SYNTHWAVE ======================= */
  SP.addMode({
    id: 'synthwave', name: 'SYNTHWAVE', glyphs: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ▲◆★',
    base: [305, 90, 86], palette: [[320, 100, 62], [185, 100, 58], [45, 100, 62], [275, 100, 68]],
    links: ['neon', 'laser', 'rainbow', 'laser'], opaque: true, count: 76, scale: 0.92, pageBg: ['#12002a', '#05000c'],
    shapes: ['torus', 'sphere', 'lissajous', 'heart', 'dodecahedron', 'cube', 'crown', 'trefoil'],
    init(S) { S.data.off = 0; S.data.flare = -1e9; },
    background(S, ctx, now, dt) {
      const d = S.data, hy = Math.round(S.H * 0.64), p = power(S);
      blit(ctx, layer(S, 'sky', S.W, S.H, (x, w, h) => {
        let g = x.createLinearGradient(0, 0, 0, hy);
        g.addColorStop(0, 'rgba(6,0,22,0.93)'); g.addColorStop(0.6, 'rgba(46,0,72,0.92)'); g.addColorStop(1, 'rgba(160,20,110,0.9)');
        x.fillStyle = g; x.fillRect(0, 0, w, hy);
        g = x.createLinearGradient(0, hy, 0, h); g.addColorStop(0, 'rgba(30,0,50,0.96)'); g.addColorStop(1, 'rgba(6,0,14,0.97)');
        x.fillStyle = g; x.fillRect(0, hy, w, h - hy);
        x.fillStyle = 'rgba(255,255,255,0.7)';
        for (let k = 0; k < 140; k++) { const s = Math.random() < 0.1 ? 2 : 1; x.fillRect(Math.random() * w, Math.random() * hy * 0.75, s, s); }
        const Rs = Math.min(w, h) * 0.22, sy = hy - Rs * 0.45;
        const gl = x.createRadialGradient(w / 2, sy, Rs * 0.8, w / 2, sy, Rs * 2.2); gl.addColorStop(0, 'rgba(255,60,160,0.35)'); gl.addColorStop(1, 'rgba(255,60,160,0)');
        x.fillStyle = gl; x.fillRect(0, 0, w, hy);
        const sun = document.createElement('canvas'); sun.width = sun.height = Math.ceil(Rs * 2 * S.DPR);
        const sx = sun.getContext('2d'); sx.scale(S.DPR, S.DPR);
        const sg = sx.createLinearGradient(0, 0, 0, Rs * 2); sg.addColorStop(0, '#ffe45a'); sg.addColorStop(0.55, '#ff7a3c'); sg.addColorStop(1, '#ff2a8a');
        sx.fillStyle = sg; sx.beginPath(); sx.arc(Rs, Rs, Rs, 0, TAU); sx.fill();
        sx.globalCompositeOperation = 'destination-out';
        for (let k = 0; k < 8; k++) { const yy = Rs * (1.0 + k * 0.13), th = 1.5 + k * 1.6; sx.fillRect(0, yy, Rs * 2, th); }
        x.save(); x.beginPath(); x.rect(0, 0, w, hy); x.clip(); x.drawImage(sun, w / 2 - Rs, sy - Rs, Rs * 2, Rs * 2); x.restore();
        [[-1, 0.22], [1, 0.3]].forEach(([side, hgt]) => { // mountains
          x.beginPath(); x.moveTo(side < 0 ? 0 : w, hy);
          const n = 9;
          for (let k = 0; k <= n; k++) { const t = k / n, px = side < 0 ? t * w * 0.42 : w - t * w * 0.42, py = hy - (k % 2 ? hgt : hgt * 0.4) * h * 0.4 * (1 - t * 0.85) * rand(0.6, 1.1); x.lineTo(px, py); }
          x.lineTo(side < 0 ? w * 0.42 : w * 0.58, hy); x.closePath();
          x.fillStyle = 'rgba(18,0,36,0.97)'; x.fill(); x.strokeStyle = 'rgba(0,240,255,0.6)'; x.lineWidth = 1.2; x.stroke();
        });
      }));
      // scrolling perspective floor
      const f = (S.H - hy) * 1.2, z0 = f / (S.H - hy), gs = 0.25, speed = 0.0006 + 0.0012 * S.stage + (S.holding ? 0.0005 : 0);
      d.off = (d.off + dt * speed) % gs;
      const grad = d.gg && d.gg.k === S.H + ':' + hy ? d.gg : (d.gg = Object.assign(ctx.createLinearGradient(0, hy, 0, S.H), { k: S.H + ':' + hy }));
      if (!grad.done) { grad.addColorStop(0, 'rgba(255,40,200,0)'); grad.addColorStop(0.25, 'rgba(255,40,200,0.45)'); grad.addColorStop(1, 'rgba(255,90,230,0.95)'); grad.done = 1; }
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = grad; ctx.lineWidth = 1.3; ctx.beginPath();
      for (let z = z0 + gs - d.off; z < 16; z += gs) { const y = hy + f / z; ctx.moveTo(0, y); ctx.lineTo(S.W, y); }
      const N = Math.ceil(S.W / (gs * f / z0)) + 2;
      const vx = S.cx + (S.ptr.x - S.cx) * 0.25; // the road steers toward the pointer
      for (let i = -N; i <= N; i++) { ctx.moveTo(vx + i * gs * f / 40, hy); ctx.lineTo(S.cx + i * gs * f / z0, S.H); }
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,120,220,0.9)'; ctx.fillRect(0, hy - 1, S.W, 2);
      if (p > 0) drawGlow(ctx, '255,80,170', S.cx, hy - Math.min(S.W, S.H) * 0.1, Math.min(S.W, S.H) * 0.35, 0.35 * p * (0.8 + 0.2 * Math.sin(now * 0.008)));
      const ft = (now - d.flare) / 1200;
      if (ft >= 0 && ft < 1) { ctx.fillStyle = `rgba(255,200,240,${0.7 * (1 - ft)})`; const hw = S.W * (0.2 + 0.8 * ft); ctx.fillRect(S.cx - hw, hy - 2 - 6 * (1 - ft), hw * 2, 4 + 12 * (1 - ft)); }
      if (S.stage === 3 && !S.reduceMotion) { ctx.fillStyle = 'rgba(255,255,255,0.05)'; const y = (now * 0.25) % (S.H + 60) - 30; ctx.fillRect(0, y, S.W, 18); ctx.fillRect(0, (y * 1.7) % S.H, S.W, 5); }
    },
    over(S, ctx, now, dt) {
      if (pspeed(S) > 2.5 && Math.random() < 0.5) fxAdd(S, { x: S.ptr.x, y: S.ptr.y, vx: -pvel(S).x * 0.1, vy: -pvel(S).y * 0.1, s: rand(3, 6), life: 500, hue: pick([320, 185]) });
      fxDraw(S, ctx, dt);
    },
    drawNode(S, ctx, n, g, size, a) {
      ctx.font = `bold ${size.toFixed(1)}px monospace`;
      ctx.lineWidth = 3.2; ctx.strokeStyle = n.inf ? S.colorOf(n.gen, 0.6 * a) : `rgba(255,40,190,${0.5 * a})`;
      ctx.strokeText(g, n.sx, n.sy);
      ctx.fillStyle = n.inf ? `rgba(255,255,255,${a})` : `rgba(255,225,250,${0.92 * a})`; ctx.fillText(g, n.sx, n.sy);
      return true;
    },
    onRelease(S, held, pw) {
      S.data.flare = S.now; S.glitch(160);
      const s = S.seed || { sx: S.ptr.x, sy: S.ptr.y };
      shardBurst(S, s.sx, s.sy, 26, 6); speedLines(S, s.sx, s.sy, 320);
      for (let k = 0; k < 36; k++) { const a = k / 36 * TAU; S.spawn(s.sx, s.sy, Math.cos(a) * 6 * pw, Math.sin(a) * 6 * pw, k % 2 ? 'rgba(0,240,255,1)' : 'rgba(255,60,200,1)', 900, 3, { drag: 0.96 }); }
      S.ring(s.sx, s.sy, 300 * pw, [320, 100, 65], 900); S.ring(s.sx, s.sy, 220 * pw, [185, 100, 60], 700);
      return false;
    },
    hud(S) {
      if (S.holding) return ['▶ PLAY', '▶▶ FAST FORWARD', '▶▶▶ OUTRUN MODE', '░▒▓ MAXIMUM 1986 ▓▒░'][S.stage];
      return 'NOW PLAYING ░▒▓ SPHERE_OUTRUN.WAV ▓▒░ · 118 BPM · chrome, neon, no seatbelts';
    }
  });

  /* ======================= 11. STORM ======================= */
  function boltPath(x0, y0, x1, y1, disp, depth) {
    let pts = [[x0, y0], [x1, y1]];
    for (let d = 0; d < depth; d++) {
      const np = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; np.push([(a[0] + b[0]) / 2 + rand(-1, 1) * disp, (a[1] + b[1]) / 2 + rand(-0.4, 0.4) * disp], b); }
      pts = np; disp *= 0.55;
    }
    return pts;
  }
  function makeBolt(S, x0, y0, x1, y1, big) {
    const main = boltPath(x0, y0, x1, y1, Math.hypot(x1 - x0, y1 - y0) * 0.22, 6), br = [];
    for (let k = 0; k < (big ? 4 : 2); k++) { const i = Math.floor(rand(8, main.length * 0.7)), p = main[i], len = rand(50, 160); br.push(boltPath(p[0], p[1], p[0] + rand(-len, len), p[1] + len, len * 0.3, 4)); }
    S.data.bolts.push({ main, br, t: S.now, life: big ? 420 : 260, w: big ? 2.2 : 1.3 });
  }
  SP.addMode({
    id: 'storm', name: 'STORM', glyphs: G('ϟ↯☈☁☂≋∿≈⌁⌇∴', 'ϟ≈∿∴'),
    base: [210, 30, 82], palette: [[205, 70, 82], [195, 100, 72], [260, 80, 80]],
    links: ['line', 'pm_bolt', 'lightning', 'pm_bolt'], fade: 0.5, count: 80, noHueShift: true, pageBg: ['#0b1220', '#020306'],
    shapes: ['sphere', 'lorenz', 'galaxy', 'torus', 'helix', 'aizawa', 'thomas', 'halvorsen'],
    init(S) {
      const d = S.data;
      d.rain = Array.from({ length: 260 }, () => ({ x: rand(-100, S.W + 100), y: rand(-S.H, S.H), v: rand(10, 16), l: rand(8, 18) }));
      d.bolts = []; d.wind = 1.5; d.next = S.now + 2500; d.strikes = 0; d.lastStrike = 0;
    },
    background(S, ctx, now) {
      const d = S.data;
      const clouds = layer(S, 'clouds', S.W, S.H * 0.45, (x, w, h) => {
        const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(8,12,22,0.85)'); g.addColorStop(1, 'rgba(8,12,22,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
        for (let k = 0; k < 26; k++) { const cx = rand(0, w), cy = rand(0, h * 0.5), r = rand(50, 150), cg = x.createRadialGradient(cx, cy, 0, cx, cy, r); cg.addColorStop(0, 'rgba(60,70,95,0.35)'); cg.addColorStop(1, 'rgba(60,70,95,0)'); x.fillStyle = cg; x.fillRect(cx - r, cy - r, r * 2, r * 2); }
      });
      ctx.fillStyle = `rgba(4,7,14,${0.3 + 0.25 * power(S)})`; ctx.fillRect(0, 0, S.W, S.H);
      blit(ctx, clouds);
      const lit = d.bolts.reduce((m, b) => Math.max(m, 1 - (now - b.t) / b.life), 0);
      if (lit > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = lit * (S.reduceMotion ? 0.25 : 0.8); blit(ctx, clouds); blit(ctx, clouds); ctx.globalAlpha = 1; }
    },
    update(S, now) {
      const d = S.data;
      d.wind += ((S.holding ? (S.ptr.x - S.cx) / S.W * 8 : 1.5) + clamp(pvel(S).x * 0.4, -6, 6) - d.wind) * 0.03;
      if (now > d.next) { d.next = now + rand(3500, 8000) * (S.holding ? 0.5 : 1); const x = rand(0, S.W); makeBolt(S, x, 0, x + rand(-150, 150), rand(S.H * 0.35, S.H * 0.7), false); }
      if (S.holding && S.stage >= 2 && now - d.lastStrike > 700 - S.stage * 120) {
        const n = pick(S.active.filter((q) => q.inf));
        if (n) { d.lastStrike = now; makeBolt(S, n.sx + rand(-200, 200), 0, n.sx, n.sy, false); d.strikes++; S.ring(n.sx, n.sy, 50, [200, 100, 80], 400); }
      }
      d.bolts = d.bolts.filter((b) => now - b.t < b.life);
    },
    ambient(S, ctx, now, dt) {
      const d = S.data, k = dt / 16, many = 120 + (S.holding ? 45 * S.stage + 20 : 0), wx = d.wind;
      ctx.strokeStyle = 'rgba(175,200,240,0.5)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 0; i < many && i < d.rain.length; i++) {
        const r = d.rain[i];
        r.y += r.v * k; r.x += wx * k;
        const rdx = r.x - S.ptr.x; if (rdx > -80 && rdx < 80 && Math.abs(r.y - S.ptr.y) < 110) r.x += (rdx < 0 ? -1 : 1) * (80 - Math.abs(rdx)) * 0.2 * k; // rain bends around the pointer
        if (r.y > S.H) { if (Math.random() < 0.15) S.spawn(r.x, S.H - 2, rand(-1, 1), rand(-2, -0.5), 'rgba(170,200,240,1)', 300, 1.2, { g: 0.15 }); r.y = rand(-60, -10); r.x = rand(-100, S.W + 100); }
        ctx.moveTo(r.x, r.y); ctx.lineTo(r.x - wx * r.l / r.v, r.y - r.l);
      }
      ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      for (const b of d.bolts) {
        const age = now - b.t, a = (1 - age / b.life) * (S.reduceMotion ? 0.7 : (Math.floor(age / 45) % 3 === 1 ? 0.45 : 1));
        const path = (pts) => { ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); };
        ctx.beginPath(); path(b.main); b.br.forEach(path);
        ctx.strokeStyle = `rgba(150,180,255,${0.18 * a})`; ctx.lineWidth = b.w * 6; ctx.stroke();
        ctx.strokeStyle = `rgba(235,240,255,${a})`; ctx.lineWidth = b.w; ctx.stroke();
        const end = b.main[b.main.length - 1]; drawGlow(ctx, '190,210,255', end[0], end[1], 50, 0.6 * a);
      }
    },
    onClimax(S) {
      const s = S.seed; if (!s) return;
      makeBolt(S, s.sx + rand(-80, 80), 0, s.sx, s.sy, true); S.data.strikes++;
      S.flash(0.55, '200,215,255'); S.shake(10);
    },
    onRelease(S, held, pw) {
      const d = S.data, inf = S.active.filter((n) => n.inf);
      for (let k = 0; k < Math.min(6, inf.length); k++) { const n = inf[Math.floor(k * inf.length / Math.min(6, inf.length))]; makeBolt(S, n.sx + rand(-120, 120), 0, n.sx, n.sy, k === 0); d.strikes++; }
      S.flash(0.3 * pw, '200,215,255'); S.shake(7 * pw);
      const s = S.seed || { sx: S.ptr.x, sy: S.ptr.y }; S.ring(s.sx, s.sy, 260 * pw, [205, 80, 85], 800);
      return false;
    },
    hud(S) {
      const d = S.data, rm = S.reduceMotion ? ' · no strobe (reduced motion)' : '';
      if (S.holding) return `pressure ${980 - S.stage * 12} hPa ↓ · strikes ${d.strikes} · do not hold metal spheres${rm}`;
      return `pressure 980 hPa · strikes ${d.strikes} · flash-to-bang 3 s ≈ 1 km${rm}`;
    }
  });

  /* ======================= 12. ALCHEMY ======================= */
  const ALC = G('🜁🜂🜃🜄🜍🜔🜚🜛🜞🜠☉☽☿♀♂♃♄♁⊕△▽', '☉☽☿♀♂♃♄△▽⊕');
  function alchemyCircle(x, R, col) {
    x.translate(R, R);
    const r = R * 0.94, bg = x.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 1.02);
    bg.addColorStop(0, 'rgba(0,0,0,0.45)'); bg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = bg; x.beginPath(); x.arc(0, 0, r * 1.02, 0, TAU); x.fill();
    x.strokeStyle = col; x.fillStyle = col; x.lineWidth = 1.2;
    [1, 0.96, 0.78].forEach((f) => { x.beginPath(); x.arc(0, 0, r * f, 0, TAU); x.stroke(); });
    const text = 'SOLVE ET COAGVLA · VISITA INTERIORA TERRAE RECTIFICANDO INVENIES OCCVLTVM LAPIDEM · ';
    x.font = `${Math.max(9, R * 0.055)}px serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    Array.from(text).forEach((ch, i, arr) => { x.save(); x.rotate(i / arr.length * TAU); x.fillText(ch, 0, -r * 0.87); x.restore(); });
    const tri = (rr, rot) => { x.beginPath(); for (let k = 0; k <= 3; k++) { const a = rot + k * TAU / 3; if (k) x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else x.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } x.stroke(); };
    tri(r * 0.78, -Math.PI / 2);
    const sq = r * 0.39; x.strokeRect(-sq, -sq * 0.95 + r * 0.0, sq * 2, sq * 1.9);
    x.beginPath(); x.arc(0, 0, r * 0.39, 0, TAU); x.stroke();
    x.beginPath(); x.arc(0, r * 0.06, r * 0.2, 0, TAU); x.stroke();
    const pl = Array.from(G('☉☽☿♀♂♃♄', '☉☽☿♀♂♃♄'));
    x.font = `${Math.max(12, R * 0.09)}px serif`;
    pl.forEach((ch, k) => { const a = -Math.PI / 2 + k * TAU / pl.length; x.fillText(ch, Math.cos(a) * r * 0.68, Math.sin(a) * r * 0.68); });
  }
  SP.addMode({
    id: 'alchemy', name: 'ALCHEMY', glyphs: ALC,
    base: [220, 8, 62], palette: [[45, 100, 56], [38, 100, 62], [52, 100, 80]],
    links: ['chain', 'beads', 'sigil', 'beam'], fade: 0.5, count: 72, noHueShift: true, pageBg: ['#140e04', '#04050a'],
    shapes: ['sphere', 'stella_octangula', 'torus', 'icosahedron', 'dodecahedron', 'cube', 'cell5', 'octahedron'],
    init(S) { S.data.opus = -1e9; S.data.gold = 0; },
    ambient(S, ctx, now, dt) {
      const R = Math.round(Math.min(S.W, S.H) * 0.44), p = power(S), d = S.data;
      d.gold += ((S.holding ? 1 : 0) - d.gold) * (S.holding ? 0.02 : 0.008);
      const grey = layer(S, 'cg', R * 2, R * 2, (x) => alchemyCircle(x, R, 'rgba(170,180,195,0.9)'));
      const gold = layer(S, 'cy', R * 2, R * 2, (x) => alchemyCircle(x, R, 'rgba(255,200,80,1)'));
      d.rot = (d.rot || 0) + dt * (0.00006 * (1 + 3 * p)) + clamp(pvel(S).x, -20, 20) * 0.0015; // stir it with the pointer
      ctx.save(); ctx.translate(S.cx, S.cy); ctx.rotate(d.rot);
      ctx.globalAlpha = 0.18 * (1 - d.gold); ctx.drawImage(grey, -R, -R, R * 2, R * 2);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45 * d.gold; ctx.drawImage(gold, -R, -R, R * 2, R * 2);
      ctx.restore();
      if (Math.random() < 0.15) S.spawn(S.cx + rand(-S.R, S.R), S.cy + S.R * 0.9, rand(-0.2, 0.2), rand(-0.9, -0.3), 'rgba(140,150,165,1)', 2500, rand(2, 3.5), { drag: 0.995 });
      if (S.holding && Math.random() < 0.3 * S.stage) { const n = pick(S.active); if (n && n.inf) S.spawn(n.sx, n.sy, rand(-0.6, 0.6), rand(-1.4, -0.4), 'rgba(255,215,90,1)', 900, 1.6); }
      if (pspeed(S) > 2 && Math.random() < 0.4) S.spawn(S.ptr.x, S.ptr.y, -pvel(S).x * 0.1, rand(-1, -0.3), 'rgba(150,160,175,1)', 1400, rand(2, 3.5), { drag: 0.99 }); // fumes off the pointer
    },
    over(S, ctx, now, dt) { fxDraw(S, ctx, dt); },
    drawNode(S, ctx, n, g, size, a) {
      const dt = S.dt, t = n.data.au || 0, nt = clamp(t + (n.inf ? dt / 900 : -dt / 2600), 0, 1);
      n.data.au = nt;
      if (nt >= 1 && t < 1 && Math.random() < 0.5) shardBurst(S, n.sx, n.sy, 2, 2.5); // transmuted: a hextech glint
      const r = Math.round(lerp(128, 255, nt)), gg = Math.round(lerp(134, 200, nt)), b = Math.round(lerp(148, 55, nt));
      ctx.font = `${size.toFixed(1)}px serif`;
      if (nt > 0.05) drawGlow(ctx, '255,190,60', n.sx, n.sy, size * 1.3, 0.4 * nt * a);
      ctx.fillStyle = `rgba(${r},${gg},${b},${a})`; ctx.fillText(g, n.sx, n.sy);
      if (n.inf && nt > 0.35 && nt < 0.7) { ctx.fillStyle = `rgba(255,255,255,${a * (1 - Math.abs(nt - 0.52) * 5.5)})`; ctx.fillText(g, n.sx, n.sy); }
      return true;
    },
    onRelease(S, held, pw) {
      S.data.opus = S.now;
      const so = S.seed || { sx: S.ptr.x, sy: S.ptr.y }; shardBurst(S, so.sx, so.sy, 22, 5.5);
      S.active.forEach((n) => { if (n.inf) for (let k = 0; k < 4; k++) S.spawn(n.sx, n.sy, rand(-1.4, 1.4), rand(-2.5, 0), k % 2 ? 'rgba(255,210,80,1)' : 'rgba(255,240,170,1)', rand(1200, 2200), rand(1.2, 2.4), { g: 0.07, drag: 0.985 }); });
      const s = S.seed || { sx: S.ptr.x, sy: S.ptr.y }; S.ring(s.sx, s.sy, 260 * pw, [45, 100, 60], 1200);
      return false;
    },
    hud(S) {
      if (S.holding) { const pct = Math.round(100 * S.active.reduce((m, n) => m + (n.data.au || 0), 0) / Math.max(1, S.active.length)); return `transmutation ${pct}% · Pb → Au · nuclear physicists hate this one trick`; }
      if (S.now - S.data.opus < 5000) return 'magnum opus complete · yield 0.0003 g Au · cost: one soul (refundable)';
      return "lead → gold: 0% · philosopher's stone: pending peer review";
    }
  });

  /* ======================= 13. SYNTH (music) ======================= */
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
  SP.addMode({
    id: 'music', name: 'SYNTH', glyphs: G('♪♫♩♬♭♮♯', '♪♫♩♬♭♮♯'), // (𝄞 and 𝄢 render, but from a slow fallback font)
    base: [200, 40, 82], palette: [[180, 100, 60], [300, 100, 66], [55, 100, 60], [120, 100, 56]],
    links: ['pm_sine', 'pm_tri', 'pm_saw', 'pm_square'], fade: 0.45, count: 64, pageBg: ['#0b0420', '#020b14'],
    shapes: ['sphere', 'harmonic', 'torus', 'lissajous', 'rose', 'helix', 'cinquefoil', 'torus_knot'],
    init(S) {
      const d = S.data; d.eq = new Float32Array(48); d.notes = [];
      AUDIO.key = (e) => { if (e.target && /input|textarea|select/i.test(e.target.tagName)) return; if (e.key === 's' || e.key === 'S') { AUDIO.muted = !AUDIO.muted; if (AUDIO.master) AUDIO.master.gain.value = AUDIO.muted ? 0 : 0.07; } };
      document.addEventListener('keydown', AUDIO.key);
    },
    exit() { if (AUDIO.key) document.removeEventListener('keydown', AUDIO.key); AUDIO.key = null; },
    onPress() { audioInit(); },
    onInfect(S, n) {
      const d = S.data, top = S.cy - S.R, i = clamp(Math.floor((1 - (n.sy - top) / (2 * S.R)) * 15), 0, 14), f = noteFreq(i);
      const band = Math.floor(i / 15 * 48 + rand(0, 3)) % 48;
      for (let k = -2; k <= 2; k++) d.eq[(band + k + 48) % 48] = Math.min(1, d.eq[(band + k + 48) % 48] + 0.6 / (1 + Math.abs(k)));
      if (S.now - AUDIO.last > 60) { AUDIO.last = S.now; playNote(f, S.stage, 0.7 - S.stage * 0.1); d.notes.push({ f, t: S.now }); }
      if (d.notes.length > 6) d.notes.shift();
    },
    ambient(S, ctx, now, dt) {
      const d = S.data, decay = Math.pow(0.93, dt / 16);
      for (let i = 0; i < 48; i++) d.eq[i] = d.eq[i] * decay + (Math.random() < 0.03 ? 0.08 + (S.holding ? 0.1 : 0) : 0);
      ctx.globalCompositeOperation = 'lighter';
      const R0 = S.R * 1.18, pa = Math.atan2(S.ptr.y - S.cy, S.ptr.x - S.cx), pr = Math.abs(Math.hypot(S.ptr.x - S.cx, S.ptr.y - S.cy) - R0) < S.R * 0.6;
      ctx.lineWidth = Math.max(2, R0 * TAU / 48 * 0.45);
      ctx.lineCap = 'butt';
      for (let i = 0; i < 48; i++) {
        const a = i / 48 * TAU - Math.PI / 2 + now * 0.00005, c = Math.cos(a), s = Math.sin(a);
        if (pr) { let da = a - pa; da -= Math.round(da / TAU) * TAU; if (Math.abs(da) < 0.25) d.eq[i] = Math.min(1, d.eq[i] + 0.05 * (1 - Math.abs(da) / 0.25) * (1 + pspeed(S) * 0.2)); } // the pointer strums the ring
        const len = 4 + d.eq[i] * S.R * 0.55;
        ctx.strokeStyle = `hsla(${(i * 7.5 + 180 + S.hueShift) % 360},100%,62%,${0.25 + 0.55 * d.eq[i]})`;
        ctx.beginPath(); ctx.moveTo(S.cx + c * R0, S.cy + s * R0); ctx.lineTo(S.cx + c * (R0 + len), S.cy + s * (R0 + len)); ctx.stroke();
      }
      ctx.lineCap = 'round';
      // oscilloscope: the recent notes summed across the screen
      ctx.strokeStyle = 'rgba(140,255,230,0.22)'; ctx.lineWidth = 1.2; ctx.beginPath();
      const live = d.notes.filter((q) => now - q.t < 1600);
      for (let k = 0; k <= 160; k++) {
        const x = k / 160 * S.W; let y = Math.sin(x * 0.02 + now * 0.002) * 3;
        for (const q of live) y += Math.sin(x * q.f / 9000 * TAU - now * 0.01) * 26 * (1 - (now - q.t) / 1600);
        if (k) ctx.lineTo(x, S.cy + y); else ctx.moveTo(x, S.cy + y);
      }
      ctx.stroke();
    },
    under(S, ctx, now) {
      for (const n of S.active) { const age = now - n.last; if (n.inf && age < 300) { ctx.strokeStyle = S.colorOf(n.gen, 0.7 * (1 - age / 300)); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(n.sx, n.sy, 8 + age * 0.08, 0, TAU); ctx.stroke(); } }
    },
    onClimax(S) { [0, 2, 4, 7, 9].forEach((i, k) => playNote(noteFreq(i + 5), 1, 1.2, k * 0.07)); },
    onRelease(S, held, pw) {
      [12, 9, 7, 4, 2, 0].forEach((i, k) => playNote(noteFreq(i), Math.min(3, S.stage), 0.9, k * 0.09));
      const d = S.data; for (let i = 0; i < 48; i++) d.eq[i] = Math.min(1, d.eq[i] + 0.5 + 0.5 * Math.random() * pw);
      const s = S.seed || { sx: S.ptr.x, sy: S.ptr.y }; starBurst(S, s.sx, s.sy, 16, undefined, 4.5);
    },
    over(S, ctx, now, dt) { fxDraw(S, ctx, dt);
    },
    hud(S) {
      const A = AUDIO;
      if (!A.ac) return '♪ hold to play: higher letters, higher notes · S mutes · silent until you press';
      if (A.muted) return 'muted · press S to unmute · the letters are still singing, just quietly';
      return `♪ A minor pentatonic · ${WAVES[S.stage]} wave · voices ${A.voices.length} · S to mute`;
    }
  });

  /* ======================= 14. BLUEPRINT ======================= */
  SP.addMode({
    id: 'blueprint', name: 'BLUEPRINT', glyphs: G('ABCDEFGHJKLMNPRSTUVXYZ0123456789Ø±°⌀⊥∥∠⌖◎⌒', 'ABCDEFGHJKLMNPRSTUVXYZ0123456789Ø±°'),
    base: [210, 40, 94], palette: [[0, 100, 60], [30, 100, 56], [56, 100, 55], [120, 80, 55], [190, 100, 62]],
    links: ['pm_center', 'pm_dim', 'pm_dim', 'pm_dim'], opaque: true, count: 56, noHueShift: true, pageBg: ['#0a2a5c', '#06142e'],
    shapes: ['torus', 'helix', 'cell24', 'gyroid', 'mobius', 'dodecahedron', 'sphere', 'cube', 'octahedron'],
    init(S) { S.data.def = -1e9; S.data.fos = 1.5; },
    background(S, ctx) {
      blit(ctx, layer(S, 'paper', S.W, S.H, (x, w, h) => {
        x.fillStyle = 'rgba(10,52,122,0.93)'; x.fillRect(0, 0, w, h);
        x.lineWidth = 1; x.strokeStyle = 'rgba(255,255,255,0.045)'; x.beginPath();
        for (let i = 0; i < w; i += 10) { x.moveTo(i + 0.5, 0); x.lineTo(i + 0.5, h); } for (let j = 0; j < h; j += 10) { x.moveTo(0, j + 0.5); x.lineTo(w, j + 0.5); } x.stroke();
        x.strokeStyle = 'rgba(255,255,255,0.09)'; x.beginPath();
        for (let i = 0; i < w; i += 50) { x.moveTo(i + 0.5, 0); x.lineTo(i + 0.5, h); } for (let j = 0; j < h; j += 50) { x.moveTo(0, j + 0.5); x.lineTo(w, j + 0.5); } x.stroke();
        x.strokeStyle = 'rgba(230,240,255,0.7)'; x.lineWidth = 2; x.strokeRect(14, 50, w - 28, h - 64); x.lineWidth = 0.8; x.strokeRect(20, 56, w - 40, h - 76);
        x.font = '10px monospace'; x.fillStyle = 'rgba(230,240,255,0.6)'; x.textAlign = 'center'; x.textBaseline = 'middle';
        for (let k = 0; k < 8; k++) { x.fillText(String(k + 1), 20 + (w - 40) * (k + 0.5) / 8, 53); }
        for (let k = 0; k < 6; k++) { x.fillText('ABCDEF'[k], 17, 56 + (h - 76) * (k + 0.5) / 6); }
        const bw = 250, bx = w - 20 - bw, by = 56, rows = ['PROJECT: THE SPHERE', 'DRAWN: ME · CHECKED: NOBODY', 'MATERIAL: Al 6061-T6 (imaginary)', 'SCALE 1:1 · UNITS mm · ⌖ ISO 2768-m', 'SHEET 1 OF 1 · REV C'];
        x.fillStyle = 'rgba(10,52,122,0.95)'; x.fillRect(bx, by, bw, rows.length * 16 + 8);
        x.strokeStyle = 'rgba(230,240,255,0.75)'; x.lineWidth = 1; x.strokeRect(bx + 0.5, by + 0.5, bw, rows.length * 16 + 8);
        x.textAlign = 'left'; x.fillStyle = 'rgba(230,240,255,0.85)';
        rows.forEach((r, i) => { x.fillText(r, bx + 8, by + 12 + i * 16); if (i) { x.beginPath(); x.moveTo(bx, by + 4 + i * 16); x.lineTo(bx + bw, by + 4 + i * 16); x.stroke(); } });
        // third-angle projection symbol
        const px = bx - 60, py = by + 26; x.beginPath(); x.moveTo(px, py - 8); x.lineTo(px + 22, py - 12); x.lineTo(px + 22, py + 12); x.lineTo(px, py + 8); x.closePath();
        x.moveTo(px + 52, py); x.arc(px + 40, py, 12, 0, TAU); x.moveTo(px + 46, py); x.arc(px + 40, py, 6, 0, TAU); x.stroke();
      }));
    },
    ambient(S, ctx) {
      const act = S.active, mesh = S.shape.mesh, p = power(S);
      // stress contour blobs (von Mises, totally made up)
      if (S.holding) for (const n of act) if (n.inf) { const c = S.mode.palette[Math.min(4, n.gen)]; drawGlow(ctx, hsl2rgb(c[0], c[1], c[2]).join(','), n.sx, n.sy, 34, 0.32); }
      ctx.strokeStyle = 'rgba(225,238,255,0.22)'; ctx.lineWidth = 0.8; ctx.beginPath(); // FEM mesh
      for (const e of mesh) { const a = act[e[0]], b = act[e[1]]; if (a && b) { ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); } }
      ctx.stroke();
      ctx.fillStyle = 'rgba(225,238,255,0.5)';
      for (const n of act) ctx.fillRect(n.sx - 1.5, n.sy - 1.5, 3, 3);
      // centre lines and the overall diameter
      ctx.setLineDash([16, 4, 3, 4]); ctx.strokeStyle = 'rgba(225,238,255,0.35)'; ctx.beginPath();
      ctx.moveTo(S.cx - S.R * 1.3, S.cy); ctx.lineTo(S.cx + S.R * 1.3, S.cy); ctx.moveTo(S.cx, S.cy - S.R * 1.3); ctx.lineTo(S.cx, S.cy + S.R * 1.3); ctx.stroke(); ctx.setLineDash([]);
      const y = S.cy + S.R * 1.22, x0 = S.cx - S.R, x1 = S.cx + S.R;
      ctx.strokeStyle = 'rgba(225,238,255,0.6)'; ctx.fillStyle = 'rgba(225,238,255,0.75)'; ctx.beginPath();
      ctx.moveTo(x0, S.cy + 6); ctx.lineTo(x0, y + 6); ctx.moveTo(x1, S.cy + 6); ctx.lineTo(x1, y + 6); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      ctx.beginPath(); arrowHead(ctx, x0, y, -1, 0, 8); arrowHead(ctx, x1, y, 1, 0, 8); ctx.fill();
      ctx.font = '11px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(`Ø${(S.R * 2 * 0.254).toFixed(2)} ±0.01`, S.cx, y - 3);
      if (p > 0) { // legend
        const lx = S.W - 46, ly = 180, lh = Math.max(60, Math.min(220, S.H - 340));
        const lg = layer(S, 'legend', 14, lh, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); [[0, 0], [0.25, 30], [0.5, 56], [0.75, 120], [1, 220]].forEach(([t, hh]) => g.addColorStop(t, `hsl(${hh},100%,55%)`)); x.fillStyle = g; x.fillRect(0, 0, w, h); });
        ctx.globalAlpha = Math.min(1, p * 3); blit(ctx, lg, lx, ly);
        ctx.font = '10px monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ['420', '315', '210', '105', '0'].forEach((t, i) => ctx.fillText(t, lx - 4, ly + i * lh / 4));
        ctx.fillText('σvM [MPa]', lx + 14, ly - 12); ctx.globalAlpha = 1;
      }
    },
    warp(S, n) {
      const t = (S.now - S.data.def) / 1000;
      if (t < 0 || t > 3.2) return;
      const amp = S.R * 0.14 * Math.exp(-t * 1.3) * Math.sin(t * TAU * 1.6), ang = Math.atan2(n.sy - S.cy, n.sx - S.cx), m = Math.cos(2 * ang + S.data.mph);
      n.sx += Math.cos(ang) * amp * m; n.sy += Math.sin(ang) * amp * m;
    },
    drawNode(S, ctx, n, g, size, a) {
      ctx.font = `${size.toFixed(1)}px monospace`;
      ctx.fillStyle = n.inf ? S.colorOf(Math.min(4, n.gen), a) : `rgba(235,244,255,${a})`;
      ctx.fillText(g, n.sx, n.sy);
      return true;
    },
    over(S, ctx, now) {
      if (S.ptr.x > 0 || S.ptr.y > 0) { // drafting crosshair with live coordinates (mm from the sphere's centre)
        const x = S.ptr.x, y = S.ptr.y;
        ctx.strokeStyle = 'rgba(225,238,255,0.35)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x - 18, y); ctx.lineTo(x + 18, y); ctx.moveTo(x, y - 18); ctx.lineTo(x, y + 18); ctx.stroke();
        ctx.strokeRect(x - 4, y - 4, 8, 8);
        ctx.font = '10px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = 'rgba(225,238,255,0.75)';
        ctx.fillText(`X ${((x - S.cx) * 0.254).toFixed(2)}  Y ${((S.cy - y) * 0.254).toFixed(2)}`, x + 10, y + 8);
      }
      const t = (now - S.data.def) / 2800;
      if (t < 0 || t > 1 || !S.data.failed) return;
      ctx.save(); ctx.translate(S.cx + S.R * 0.6, S.cy - S.R * 0.7); ctx.rotate(-0.22);
      ctx.globalAlpha = Math.min(1, (1 - t) * 2.5); ctx.strokeStyle = 'rgba(255,70,70,0.95)'; ctx.fillStyle = 'rgba(255,70,70,0.95)'; ctx.lineWidth = 3;
      ctx.strokeRect(-120, -26, 240, 52); ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('FoS < 1', 0, -8);
      ctx.font = '11px monospace'; ctx.fillText('FAILED · LOOKS COOL THOUGH', 0, 13); ctx.restore();
    },
    onRelease(S, held, pw) {
      const d = S.data; d.def = S.now; d.mph = rand(0, TAU); d.failed = held > S.STAGES[3]; d.fos = d.failed ? 0.7 : held > S.STAGES[2] ? 1.0 : 2.0;
      S.ring(S.ptr.x, S.ptr.y, 180 * pw, [200, 60, 90], 700);
      return false;
    },
    hud(S) {
      if (S.holding) return ['solving K·u = F …', `FoS = 2.0 · fine · mesh: ${S.active.length} nodes`, 'FoS = 1.0 · technically fine', 'FoS = 0.7 · call it a "learning experience"'][S.stage];
      if (S.now - S.data.def < 4000) return `mode 2 @ ${(118 + S.active.length * 0.4).toFixed(1)} Hz · ζ = 0.02 · converged after 3 coffees`;
      return 'FoS = 1.5 (the 0.5 is for the boss) · tolerance stack: optimistic';
    }
  });

  /* ======================= 15. CRYSTAL ======================= */
  function frostLayer(S) {
    const d = S.data, w = Math.ceil(S.W / 2), h = Math.ceil(S.H / 2);
    if (!d.fc || d.fc.width !== w || d.fc.height !== h) { d.fc = S.offscreen(w, h); d.fx = d.fc.getContext('2d'); d.fx.scale(0.5, 0.5); d.fx.lineCap = 'round'; }
    return d.fx;
  }
  function snowflake(S, x, y, size, depth) {
    const d = S.data, rot = rand(0, Math.PI / 3);
    for (let k = 0; k < 6; k++) d.br.push({ x, y, a: rot + k * Math.PI / 3, len: 0, max: size, depth: depth, next: size * 0.3 });
  }
  SP.addMode({
    id: 'crystal', name: 'CRYSTAL', glyphs: G('❄❅❆✻✼❉✲✳⁂◇⬡', '*+×◇'),
    base: [200, 45, 90], palette: [[195, 85, 82], [185, 95, 72], [215, 70, 94]],
    links: ['line', 'pm_frost', 'pm_frost', 'constellation'], fade: 0.5, mesh: true, count: 90, noHueShift: true, pageBg: ['#04121f', '#010308'],
    shapes: ['rhombic_hexecontahedron', 'small_stellated_dodecahedron', 'sphere', 'icosahedron', 'great_stellated_dodecahedron', 'cell600', 'octahedron', 'stella_octangula'],
    init(S) {
      const d = S.data; d.br = []; d.lastEdge = 0; d.shatter = -1e9; d.count = 0;
      d.flakes = Array.from({ length: 50 }, () => ({ x: rand(0, S.W), y: rand(0, S.H), s: rand(2, 5), v: rand(0.3, 1), r: rand(0, TAU), w: rand(0, 10) }));
      frostLayer(S);
    },
    resize(S) { frostLayer(S); },
    update(S, now, dt) {
      const d = S.data, fx = frostLayer(S), k = dt / 16;
      if (S.holding && S.stage >= 1 && now - d.lastEdge > 160 - S.stage * 35 && d.br.length < 500) {
        d.lastEdge = now;
        const e = Math.floor(rand(0, 4)), x = e === 0 ? 0 : e === 1 ? S.W : rand(0, S.W), y = e === 2 ? 0 : e === 3 ? S.H : rand(0, S.H);
        const a = e === 0 ? 0 : e === 1 ? Math.PI : e === 2 ? Math.PI / 2 : -Math.PI / 2;
        d.br.push({ x, y, a: a + rand(-0.5, 0.5), len: 0, max: rand(60, 150), depth: 3, next: rand(14, 26) });
      }
      fx.strokeStyle = 'rgba(215,245,255,0.6)'; fx.lineWidth = 1.5; fx.beginPath();
      const out = [], sp = (S.holding ? 2.2 : 1.2) * k;
      for (const b of d.br) {
        const nx = b.x + Math.cos(b.a) * sp, ny = b.y + Math.sin(b.a) * sp;
        fx.moveTo(b.x, b.y); fx.lineTo(nx, ny); b.x = nx; b.y = ny; b.len += sp;
        if (b.depth > 0 && b.len >= b.next && d.br.length + out.length < 700) {
          b.next += b.max * 0.28;
          const cm = (b.max - b.len) * 0.5;
          if (cm > 3) [1, -1].forEach((s) => out.push({ x: b.x, y: b.y, a: b.a + s * Math.PI / 3, len: 0, max: cm, depth: b.depth - 1, next: cm * 0.35 }));
        }
        if (b.len < b.max) out.push(b);
      }
      fx.stroke();
      d.br = out;
      const melt = now - d.shatter < 700 ? 0.12 : S.holding ? 0 : 0.012;
      if (melt) { fx.globalCompositeOperation = 'destination-out'; fx.fillStyle = `rgba(0,0,0,${melt * k})`; fx.fillRect(0, 0, S.W, S.H); fx.globalCompositeOperation = 'source-over'; }
      if (!S.holding && pspeed(S) > 0.5) { fx.globalCompositeOperation = 'destination-out'; fx.fillStyle = 'rgba(0,0,0,0.5)'; fx.beginPath(); fx.arc(S.ptr.x, S.ptr.y, 24, 0, TAU); fx.fill(); fx.globalCompositeOperation = 'source-over'; } // a warm finger melts the frost
    },
    ambient(S, ctx, now, dt) {
      const d = S.data, k = dt / 16;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(d.fc, 0, 0, d.fc.width * 2, d.fc.height * 2);
      const fl = d.fall, ft = fl ? (now - fl.t) / 1000 : 9;
      if (ft < 1.3) { // the frost sheet shatters into panes that fall away
        const c = fl.c, sw = c.width / 4, sh = c.height / 3;
        fl.tiles.forEach((p, i) => {
          const tx = i % 4, ty = Math.floor(i / 4);
          ctx.save(); ctx.translate((tx + 0.5) * sw * 2 + p.vx * ft * 60, (ty + 0.5) * sh * 2 + 0.5 * 1100 * ft * ft); ctx.rotate(p.vr * ft);
          ctx.globalAlpha = Math.max(0, 1 - ft / 1.3); ctx.drawImage(c, tx * sw, ty * sh, sw, sh, -sw, -sh, sw * 2, sh * 2); ctx.restore();
        });
        ctx.globalAlpha = 1;
      } else if (fl) d.fall = null;
      ctx.strokeStyle = 'rgba(220,240,255,0.55)'; ctx.lineWidth = 1; ctx.beginPath();
      for (const f of d.flakes) {
        f.vx = (f.vx || 0) * 0.95; f.vy = 0; repel(S, f, 90, 0.4); f.y += f.v * k; f.x += (Math.sin(now * 0.001 + f.w) * 0.3 + f.vx) * k; f.r += (0.01 + Math.abs(f.vx) * 0.05) * k;
        if (f.y > S.H + 6) { f.y = -6; f.x = rand(0, S.W); }
        for (let j = 0; j < 3; j++) { const a = f.r + j * Math.PI / 3, c = Math.cos(a) * f.s, s = Math.sin(a) * f.s; ctx.moveTo(f.x - c, f.y - s); ctx.lineTo(f.x + c, f.y + s); }
      }
      ctx.stroke();
    },
    onInfect(S, n) { if (S.data.br.length < 600) { snowflake(S, n.sx, n.sy, rand(14, 30) + S.stage * 8, n.gen % 3 === 0 ? 2 : 1); S.data.count++; } },
    drawNode(S, ctx, n, g, size, a) {
      if (!n.inf) return false;
      const r = size * 0.72, rot = S.now * 0.0006 + n.gen;
      ctx.strokeStyle = `rgba(210,245,255,${0.65 * a})`; ctx.lineWidth = 1; ctx.beginPath();
      for (let k = 0; k <= 6; k++) { const an = rot + k * Math.PI / 3, x = n.sx + Math.cos(an) * r, y = n.sy + Math.sin(an) * r; if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke();
      return false;
    },
    over(S, ctx, now, dt) { fxDraw(S, ctx, dt); },
    onRelease(S, held, pw) {
      const d = S.data; d.shatter = S.now; d.br = [];
      { const s = S.seed || { sx: S.ptr.x, sy: S.ptr.y }; shardBurst(S, s.sx, s.sy, 24, 6); }
      const c = S.offscreen(d.fc.width, d.fc.height); c.getContext('2d').drawImage(d.fc, 0, 0);
      d.fall = { c, t: S.now, tiles: Array.from({ length: 12 }, () => ({ vx: rand(-1.5, 1.5), vr: rand(-1.2, 1.2) })) };
      d.fx.save(); d.fx.setTransform(1, 0, 0, 1, 0, 0); d.fx.clearRect(0, 0, d.fc.width, d.fc.height); d.fx.restore();
      S.active.forEach((n) => { if (n.inf) for (let k = 0; k < 5; k++) { const a = rand(0, TAU), v = rand(1, 4) * pw; S.spawn(n.sx, n.sy, Math.cos(a) * v, Math.sin(a) * v - 1, 'rgba(210,245,255,1)', rand(700, 1300), rand(1.5, 3.5), { g: 0.12, drag: 0.98 }); } });
      S.flash(0.15, '200,240,255');
      const s = S.seed || { sx: S.ptr.x, sy: S.ptr.y }; S.ring(s.sx, s.sy, 280 * pw, [195, 90, 85], 700);
      return false;
    },
    hud(S) {
      const d = S.data;
      if (S.holding) return `nucleating… supercooled −${15 + S.stage * 8} K · dendrites ${d.br.length} · snowflakes ${d.count}`;
      if (S.now - d.shatter < 3000) return 'shattered · thermal shock is a material property, not a personality';
      return 'T = −40 °C = −40 °F (the only honest temperature) · ice Ih, hexagonal';
    }
  });

  /* ======================= 16. TERMINAL ======================= */
  const LOG = [
    '[ OK ] mounted /dev/sphere on /mnt/universe', 'bypassing mainframe… just kidding, it\'s a CV', 'decrypting resume.pdf with ROT26 (twice as secure)',
    'ssh root@sphere -p 1337 … connected', 'compiling feelings.c … 3 warnings, 0 errors', 'sudo make me a sandwich', 'scanning ports 1-65535 … all closed, hobbies open',
    'loading thermodynamics.so … entropy increasing as expected', 'git push --force   # sorry', 'traceroute andromeda.galaxy … 2.5 Mly, 14 hops',
    "INSERT INTO students VALUES ('Robert'); DROP TABLE students;--", 'downloading more RAM … 99%', 'calculating FoS … 1.5 (the .5 is vibes)', 'hacking the Gibson …',
    'ping universe … 42 ms', 'kernel: sphere: letter overflow, infecting neighbours', 'chmod 777 /heart', 'awaiting coffee … [##########] 100%',
    'npm install common-sense … 404 not found', 'rm -rf /doubts … permission denied', 'echo $PURPOSE … 42', 'solving Navier-Stokes … give me a minute (or a millennium prize)'
  ];
  const hex = () => '0x' + Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
  SP.addMode({
    id: 'terminal', name: 'TERMINAL', glyphs: '01{}[]<>/\\$#_;:=+*&|~ABCDEF',
    base: [120, 70, 55], palette: [[120, 100, 60], [90, 100, 66], [140, 100, 80]],
    links: ['line', 'circuit', 'pulse', 'circuit'], opaque: true, count: 100, noHueShift: true, glitchy: true, pageBg: ['#001a08', '#000000'],
    shapes: ['sphere', 'hilbert', 'tesseract', 'menger', 'torus', 'lorenz', 'cell16', 'cube'],
    init(S) { const d = S.data; d.log = ['BIOS v1.0 · 640K ought to be enough for anybody', '[ OK ] reached target: curiosity', `${hex()}  mov eax, ${hex()} ; trust me`, '[ OK ] started sphere.service', 'root@sphere:~$ ./boot --cv']; d.typed = 0; d.last = 0; d.li = Math.floor(rand(0, LOG.length)); d.rm = -1e9; },
    update(S, now, dt) {
      const d = S.data, iv = S.holding ? 260 - S.stage * 60 : 900;
      d.typed += dt * (S.holding ? 0.12 : 0.05);
      const cur = d.log[d.log.length - 1];
      if (d.typed >= cur.length && now - d.last > iv) {
        d.last = now; d.typed = 0;
        const r = Math.random();
        d.log.push(r < 0.35 ? `${hex()}  mov eax, ${hex()} ; ${pick(['totally', 'legit', 'trust me', 'do not touch'])}` : r < 0.45 ? `[${(now / 1000).toFixed(3)}] sphere: ${S.infected}/${S.active.length} nodes compromised` : LOG[d.li++ % LOG.length]);
        if (d.log.length > 60) d.log.shift();
      }
    },
    background(S, ctx, now) {
      blit(ctx, layer(S, 'crt', S.W, S.H, (x, w, h) => {
        x.fillStyle = 'rgba(0,12,5,0.94)'; x.fillRect(0, 0, w, h);
        x.fillStyle = 'rgba(0,0,0,0.28)'; for (let y = 0; y < h; y += 3) x.fillRect(0, y, w, 1);
        const g = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      }));
      const by = (now * 0.06) % (S.H + 200) - 100;
      const band = layer(S, 'band', 10, 120, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(80,255,120,0)'); g.addColorStop(0.5, 'rgba(80,255,120,0.05)'); g.addColorStop(1, 'rgba(80,255,120,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
      ctx.drawImage(band, 0, by, S.W, 120);
      const d = S.data, lh = 15, top = 66, rows = Math.max(3, Math.floor((S.H - top - 150) / lh)), lines = d.log.slice(-rows);
      ctx.font = '12px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      lines.forEach((l, i) => {
        const last = i === lines.length - 1, s = last ? l.slice(0, Math.floor(d.typed)) : l;
        ctx.fillStyle = `rgba(90,255,130,${(0.18 + 0.4 * (i + 1) / lines.length).toFixed(3)})`;
        ctx.fillText(s, 18, top + i * lh);
        if (last && (S.reduceMotion || Math.floor(now / 500) % 2)) ctx.fillRect(18 + s.length * 7.22 + 2, top + i * lh - 6, 7, 12);
      });
      if (S.holding && S.stage >= 2) {
        const y = 90, w = 260, x0 = S.cx - w / 2;
        ctx.fillStyle = 'rgba(0,20,8,0.85)'; ctx.fillRect(x0, y - 22, w, 44);
        ctx.strokeStyle = 'rgba(90,255,130,0.9)'; ctx.lineWidth = 1.5; ctx.strokeRect(x0 + 0.5, y - 21.5, w - 1, 43);
        ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(140,255,170,1)';
        if (S.stage === 2) { const f = clamp((S.held - S.STAGES[2]) / (S.STAGES[3] - S.STAGES[2]), 0, 1), n = Math.round(f * 16); ctx.font = '13px monospace'; ctx.fillText(`DECRYPTING [${'#'.repeat(n)}${'-'.repeat(16 - n)}]`, S.cx, y); }
        else { ctx.font = 'bold 20px monospace'; ctx.fillText('ACCESS GRANTED', S.cx, y); }
      }
    },
    drawNode(S, ctx, n, g, size, a) {
      const near = Math.max(0, 1 - Math.hypot(n.sx - S.ptr.x, n.sy - S.ptr.y) / 120); // phosphor burns brighter under the pointer
      const col = n.inf ? S.colorOf(n.gen, 1) : near > 0.05 ? `rgba(${60 + 140 * near},255,${90 + 120 * near},1)` : 'rgba(60,200,90,1)';
      ctx.fillStyle = col; ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.16 * a; ctx.font = `bold ${(size * 1.3).toFixed(1)}px monospace`; ctx.fillText(g, n.sx, n.sy);
      ctx.globalAlpha = Math.min(1, a * (n.inf ? 1 : 0.75 + near * 0.5)); ctx.font = `${size.toFixed(1)}px monospace`; ctx.fillText(g, n.sx, n.sy);
      ctx.globalAlpha = 1;
      return true;
    },
    onRelease(S, held, pw) {
      const d = S.data; d.rm = S.now;
      d.log.push('root@sphere:~$ rm -rf /sphere', "rm: cannot remove '/sphere': it's load-bearing", "just kidding, it's a CV"); d.typed = 0;
      S.active.forEach((n) => { if (n.inf && Math.random() < 0.6) S.spawn(n.sx, n.sy, rand(-0.5, 0.5), rand(0, 1), 'rgba(90,255,130,1)', rand(1200, 2000), 14, { glyph: pick(['0', '1']), g: 0.12 }); });
      S.glitch(250);
      return false;
    },
    hud(S) {
      const d = S.data;
      if (S.holding) return `root@sphere:~# ./hack --mainframe --stage=${S.stage}  [PID 1337]`;
      return '> ' + d.log[d.log.length - 1];
    }
  });

  /* ======================= 17. CHAOS ======================= */
  const AMBS = ['static', 'polys', 'rings', 'bars', 'spiral', 'none', 'glyphs'];
  const QUIPS = ['entropy: ↑ (as the second law intended)', 'nothing here is deterministic except taxes', 'butterfly flapped in Brazil · sphere changed', 'Lyapunov exponent: yes', 'random seed: 4 (chosen by fair dice roll)', 'Maxwell\'s demon has left the chat', 'σ = 10, ρ = 28, β = 8/3, vibes = ∞'];
  function chaosRoll(m, S) {
    const n = 2 + Math.floor(rand(0, 4)), h0 = rand(0, 360);
    m.palette = Array.from({ length: n }, (_, i) => [(h0 + i * rand(40, 160)) % 360, Math.round(rand(70, 100)), Math.round(rand(50, 75))]);
    m.base = [rand(0, 360), Math.round(rand(0, 80)), Math.round(rand(70, 95))];
    m.fade = rand(0.15, 0.9); m.glyphScale = rand(0.7, 1.5); m.mesh = Math.random() < 0.35;
    S.spinScale = rand(0.3, 3.5); const h1 = Math.floor(rand(0, 360)), hex6 = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join(''); m.pageBg = [hex6(hsl2rgb(h1, 45, 8)), hex6(hsl2rgb(h1 + 60, 40, 3))]; S.data.warp = pick(['none', 'wave', 'jitter', 'swirl', 'none']);
    S.data.amb = pick(AMBS); S.data.quip = pick(QUIPS); S.data.hex = Math.floor(rand(0, 0xffffff)).toString(16).padStart(6, '0');
  }
  SP.addMode({
    id: 'chaos', name: 'CHAOS', glyphs: 'random', count: 'random',
    base: [0, 0, 90], palette: [[0, 100, 60], [120, 100, 60], [240, 100, 60]],
    links: ['line', 'line', 'line', 'line'], fade: 0.5, pageBg: ['#0d0d12', '#000000'],
    shapes: shuffle(Object.keys(SP.shapes).concat(['rhombic_hexecontahedron', 'small_stellated_dodecahedron', 'great_stellated_dodecahedron', 'stella_octangula', 'icosahedron', 'dodecahedron', 'octahedron', 'cube', 'buckyball', 'urchin', 'cell24', 'cell600', 'torus_knot', 'cinquefoil', 'hopf', 'clifford_torus', 'seashell', 'enneper', 'boy', 'gyroid', 'mandelbulb', 'heart', 'rose', 'sunflower', 'atom', 'crown', 'menger', 'sierpinski', 'rossler', 'aizawa', 'thomas', 'halvorsen', 'chen', 'dadras']).filter((k, i, a) => a.indexOf(k) === i)),
    init(S) { chaosRoll(this, S); S.data.shape = S.shape; S.data.rot = 0; this.links = Array.from({ length: 4 }, () => pick(Object.keys(SP.links))); },
    exit() { this.shapes = shuffle(this.shapes.slice()); },
    update(S) { // re-rolled whenever you tap to a new shape, and again at every infection stage
      const d = S.data;
      if (S.shape !== d.shape) { d.shape = S.shape; chaosRoll(this, S); }
      if (S.holding && S.stage !== d.stage && S.stage > 0) chaosRoll(this, S);
      d.stage = S.holding ? S.stage : -1;
    },
    onPress() { this.links = Array.from({ length: 4 }, () => pick(Object.keys(SP.links))); },
    warp(S, n) {
      const w = S.data.warp, t = S.now * 0.002;
      if (w === 'wave') n.sy += Math.sin(n.sx * 0.03 + t * 2) * 10;
      else if (w === 'jitter' && S.holding) { n.sx += rand(-2, 2) * S.stage; n.sy += rand(-2, 2) * S.stage; }
      else if (w === 'swirl') { const dx = n.sx - S.cx, dy = n.sy - S.cy, r = Math.hypot(dx, dy), a = Math.sin(t) * 0.6 * Math.exp(-r / (S.R * 1.2)); n.sx = S.cx + dx * Math.cos(a) - dy * Math.sin(a); n.sy = S.cy + dx * Math.sin(a) + dy * Math.cos(a); }
    },
    ambient(S, ctx, now) {
      const d = S.data, c0 = S.colorOf(0, 0.25), c1 = S.colorOf(1, 0.3);
      ctx.globalCompositeOperation = 'lighter';
      if (d.amb === 'static') {
        const t = layer(S, 'noise', 96, 96, (x) => { for (let y = 0; y < 96; y += 2) for (let xx = 0; xx < 96; xx += 2) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.5})`; x.fillRect(xx, y, 2, 2); } });
        ctx.globalAlpha = 0.07; const ox = Math.floor(rand(0, 96)), oy = Math.floor(rand(0, 96));
        for (let y = -oy; y < S.H; y += 96) for (let x = -ox; x < S.W; x += 96) ctx.drawImage(t, x, y, 96, 96);
        ctx.globalAlpha = 1;
      } else if (d.amb === 'polys') {
        ctx.strokeStyle = c1; ctx.lineWidth = 1.5;
        for (let k = 0; k < 7; k++) { const x = S.W * ((k * 0.37 + 0.1) % 1), y = S.H * ((k * 0.61 + 0.2) % 1), r = 30 + k * 12, sides = 3 + k % 5, rot = now * 0.0004 * (k % 2 ? 1 : -1) + k; ctx.beginPath(); for (let j = 0; j <= sides; j++) { const a = rot + j / sides * TAU; if (j) ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.stroke(); }
      } else if (d.amb === 'rings') {
        ctx.strokeStyle = c0; ctx.lineWidth = 2; const M = Math.max(S.W, S.H);
        for (let k = 0; k < 6; k++) { const r = ((now * 0.08 + k * M / 6) % M); ctx.beginPath(); ctx.arc(S.ptr.x, S.ptr.y, r, 0, TAU); ctx.stroke(); }
      } else if (d.amb === 'bars') {
        for (let k = 0; k < 9; k++) { ctx.fillStyle = S.colorOf(k, 0.05); const x = (k * 0.13 * S.W + now * 0.03 * (1 + k % 3)) % (S.W + 80) - 80; ctx.fillRect(x, 0, 40 + k * 6, S.H); }
      } else if (d.amb === 'spiral') {
        ctx.strokeStyle = c1; ctx.lineWidth = 1.2; ctx.beginPath();
        for (let k = 0; k < 300; k++) { const a = k * 0.12 + now * 0.0008, r = k * Math.max(S.W, S.H) / 500; const x = S.ptr.x + Math.cos(a) * r, y = S.ptr.y + Math.sin(a) * r; if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        ctx.stroke();
      } else if (d.amb === 'glyphs') {
        ctx.font = '18px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = c1;
        for (let k = 0; k < 12; k++) ctx.fillText(SP.util.randomGlyph(), rand(0, S.W), rand(0, S.H));
      }
    },
    onRelease(S, held, pw) {
      const f = pick(['default', 'glyphs', 'gravity', 'implode', 'spiral', 'flash']), s = S.seed || { sx: S.ptr.x, sy: S.ptr.y };
      S.data.fin = f; S.data.fint = S.now;
      if (f === 'default') return;
      if (f === 'glyphs') S.active.forEach((n) => { if (n.inf) S.spawn(n.sx, n.sy, rand(-4, 4), rand(-4, 4), S.colorOf(n.gen, 1), 1400, 16, { glyph: SP.util.randomGlyph() }); });
      if (f === 'gravity') S.active.forEach((n) => { if (n.inf) for (let k = 0; k < 3; k++) S.spawn(n.sx, n.sy, rand(-2, 2), rand(-5, -1), S.colorOf(n.gen + k, 1), 1800, 2.5, { g: 0.2 }); });
      if (f === 'implode') { S.active.forEach((n) => (n.p = n.p.map((v) => v * 0.05))); S.ring(s.sx, s.sy, 400, S.mode.palette[0], 900); }
      if (f === 'spiral') for (let k = 0; k < 120; k++) { const a = k * 0.35, v = 1 + k * 0.05; S.spawn(s.sx, s.sy, Math.cos(a) * v, Math.sin(a) * v, S.colorOf(k, 1), 1500, 2.2, { drag: 0.99 }); }
      if (f === 'flash') { S.flash(0.4, `${Math.floor(rand(0, 255))},${Math.floor(rand(0, 255))},${Math.floor(rand(0, 255))}`); S.ring(s.sx, s.sy, 500, S.mode.palette[1 % S.mode.palette.length], 700); }
      return false;
    },
    hud(S) {
      const d = S.data;
      if (S.holding) return `webs: ${this.links.join(' → ')} · seed 0x${d.hex}`;
      if (d.fin && S.now - d.fint < 3000) return `finale: ${d.fin} (rolled a d6) · ${d.quip}`;
      return `${d.quip} · ambient: ${d.amb} · warp: ${d.warp} · palette 0x${d.hex}`;
    }
  });
})(window.SPHERE);
