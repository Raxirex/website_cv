/* The Sphere: links pack. Thick, organic, electric and silly web styles (ribbon, lightning, tentacle, chain, dna, ...). */
(function (SP) {
  'use strict';
  const { TAU, clamp } = SP.util;
  const PI = Math.PI;

  /* ---------------- helpers ---------------- */
  // Per-link geometry, reused (no allocation). u = unit along the link, p = unit perpendicular.
  const G = { ax: 0, ay: 0, dx: 0, dy: 0, len: 0, ux: 0, uy: 0, px: 0, py: 0 };
  function geo(L) {
    const dx = L.bx - L.ax, dy = L.by - L.ay, len = Math.hypot(dx, dy);
    if (len < 1.5) return null;
    G.ax = L.ax; G.ay = L.ay; G.dx = dx; G.dy = dy; G.len = len;
    G.ux = dx / len; G.uy = dy / len; G.px = -G.uy; G.py = G.ux;
    return G;
  }
  const segs = (len, per, max) => Math.max(2, Math.min(max, Math.ceil(len / per)));
  const hash = (s, i) => { const x = Math.sin(s * 12989.8 + i * 78.233 + 0.5) * 43758.5453; return x - Math.floor(x); };
  const white = (a) => `rgba(255,255,255,${a})`;
  const hsla = (h, s, l, a) => `hsla(${h},${s}%,${l}%,${a})`;
  const X = (g, t, o) => g.ax + g.dx * t + g.px * o;
  const Y = (g, t, o) => g.ay + g.dy * t + g.py * o;
  // Seeded LCG for per-frame re-rolled shapes (lightning).
  let rs = 1;
  const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
  const reseed = (a, b) => { rs = ((Math.floor(a) * 31 + Math.floor(b) * 7919) % 2147483646 + 2147483646) % 2147483646 + 1; rnd(); };

  // Offset buffers: BC = centre-line offset, BW = half-width, per sample.
  const BC = new Float32Array(96), BW = new Float32Array(96);
  function band(ctx, g, n) { // closed polygon of a variable-width band around a wobbly centre line
    ctx.beginPath();
    for (let i = 0; i <= n; i++) { const t = i / n, o = BC[i] + BW[i]; i ? ctx.lineTo(X(g, t, o), Y(g, t, o)) : ctx.moveTo(X(g, t, o), Y(g, t, o)); }
    for (let i = n; i >= 0; i--) { const t = i / n, o = BC[i] - BW[i]; ctx.lineTo(X(g, t, o), Y(g, t, o)); }
    ctx.closePath();
  }
  function strand(ctx, g, n, sign) { // open path along the centre line offset by BC (+/- BW*sign)
    for (let i = 0; i <= n; i++) { const t = i / n, o = BC[i] + BW[i] * (sign || 0); i ? ctx.lineTo(X(g, t, o), Y(g, t, o)) : ctx.moveTo(X(g, t, o), Y(g, t, o)); }
  }
  const dot = (ctx, x, y, r) => { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); };
  const add = SP.addLink;
  // Crowding factor: with many links on screen, thick additive fills would wash out to white, so they thin out a bit.
  let densT = -1, densV = 1;
  const dens = (L, S) => { if (densT !== L.now) { densT = L.now; densV = clamp(Math.sqrt(45 / Math.max(1, S.links.length)), 0.3, 1); } return densV; };

  /* ---------------- ribbon: filled, tapered, twisting band ---------------- */
  add('ribbon', (ctx, L, S) => {
    const g = geo(L); if (!g) return;
    const n = segs(g.len, 5, 20), W = 3 + L.width * 3, ph = L.now * 0.004 + L.seed * TAU, tw = 0.8 + L.seed;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      BC[i] = Math.sin(t * TAU + ph * 0.7) * g.len * 0.07;
      BW[i] = W * (0.15 + 0.85 * Math.sin(PI * t)) * Math.cos(t * tw * TAU - ph);
    }
    band(ctx, g, n);
    const d = dens(L, S);
    ctx.fillStyle = L.color(L.alpha * 0.5 * d); ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = L.colorA(L.alpha * (0.4 + 0.5 * d)); ctx.stroke();
  });

  /* ---------------- lightning: midpoint-displacement bolt, re-rolled every 60 ms ---------------- */
  const BP = new Float32Array(2 * 56); // main bolt uses points 0..32, a branch 40..48
  function boltPts(x0, y0, x1, y1, depth, rough, off) { // fills BP from index off; returns point count
    const N = 1 << depth, dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, px = -dy / len, py = dx / len;
    BP[off * 2] = x0; BP[off * 2 + 1] = y0; BP[(off + N) * 2] = x1; BP[(off + N) * 2 + 1] = y1;
    let amp = len * rough;
    for (let step = N; step > 1; step >>= 1) {
      const h = step >> 1;
      for (let i = h; i < N; i += step) {
        const a = (off + i - h) * 2, b = (off + i + h) * 2, d = (rnd() - 0.5) * amp;
        BP[(off + i) * 2] = (BP[a] + BP[b]) / 2 + px * d; BP[(off + i) * 2 + 1] = (BP[a + 1] + BP[b + 1]) / 2 + py * d;
      }
      amp *= 0.55;
    }
    return N + 1;
  }
  add('lightning', (ctx, L) => {
    const g = geo(L); if (!g) return;
    const tick = Math.floor(L.now / 60);
    reseed(L.seed * 1e6, tick);
    const depth = g.len > 90 ? 5 : g.len > 40 ? 4 : 3;
    const n = boltPts(L.ax, L.ay, L.bx, L.by, depth, 0.3, 0);
    ctx.beginPath(); ctx.moveTo(BP[0], BP[1]);
    for (let i = 1; i < n; i++) ctx.lineTo(BP[i * 2], BP[i * 2 + 1]);
    if (rnd() < 0.45 && g.len > 25) { // a forked branch
      const k = Math.floor(n * (0.25 + rnd() * 0.5)), sx = BP[k * 2], sy = BP[k * 2 + 1];
      const ang = Math.atan2(g.dy, g.dx) + (rnd() < 0.5 ? -1 : 1) * (0.4 + rnd() * 0.6), bl = g.len * (0.25 + rnd() * 0.25);
      const m = boltPts(sx, sy, sx + Math.cos(ang) * bl, sy + Math.sin(ang) * bl, 3, 0.3, 40);
      ctx.moveTo(sx, sy); for (let i = 1; i < m; i++) ctx.lineTo(BP[(40 + i) * 2], BP[(40 + i) * 2 + 1]);
    }
    const flick = 0.6 + 0.4 * rnd();
    ctx.lineWidth = 5 + L.width * 4; ctx.strokeStyle = L.color(L.alpha * 0.2 * flick); ctx.stroke();
    ctx.lineWidth = 1.5 + L.width * 1.2; ctx.strokeStyle = L.color(L.alpha * 0.75); ctx.stroke();
    ctx.lineWidth = Math.max(0.8, L.width * 0.6); ctx.strokeStyle = white(L.alpha * flick); ctx.stroke();
  });

  /* ---------------- tentacle: thick tapering sinuous limb with suckers ---------------- */
  add('tentacle', (ctx, L, S) => {
    const g = geo(L); if (!g) return;
    const n = segs(g.len, 5, 20), W0 = 3 + L.width * 3, ph = L.now * 0.005 + L.seed * TAU;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      BC[i] = Math.sin(t * 5 - ph) * g.len * 0.13 * t;
      BW[i] = W0 * (1 - t * 0.88);
    }
    band(ctx, g, n);
    const d = dens(L, S);
    ctx.fillStyle = L.color(L.alpha * 0.75 * d); ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = L.colorA(L.alpha * 0.6); ctx.stroke();
    ctx.beginPath();
    for (let i = 1; i < n; i += 2) { const t = i / n, o = BC[i] - BW[i] * 0.45; dot(ctx, X(g, t, o), Y(g, t, o), Math.max(0.8, BW[i] * 0.32)); }
    ctx.fillStyle = `rgba(255,225,235,${L.alpha * 0.45 * d})`; ctx.fill();
  });

  /* ---------------- chain: interlocking oval links ---------------- */
  add('chain', (ctx, L) => {
    const g = geo(L); if (!g) return;
    const n = clamp(Math.floor(g.len / 8), 1, 16), step = g.len / n, rot = Math.atan2(g.dy, g.dx), rx = step * 0.66, ry = 2.5 + L.width * 1.3;
    const sag = Math.sin(L.now * 0.003 + L.seed * TAU) * g.len * 0.04;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, o = Math.sin(PI * t) * sag, x = X(g, t, o), y = Y(g, t, o), r2 = i % 2 ? 0.9 : ry;
      ctx.moveTo(x + Math.cos(rot) * rx, y + Math.sin(rot) * rx); ctx.ellipse(x, y, rx, r2, rot, 0, TAU);
    }
    ctx.lineWidth = 1.4 + L.width * 0.9; ctx.stroke();
    ctx.lineWidth = 0.7; ctx.strokeStyle = white(L.alpha * 0.45); ctx.stroke();
  });

  /* ---------------- dna: double helix with rungs ---------------- */
  add('dna', (ctx, L) => {
    const g = geo(L); if (!g) return;
    const n = segs(g.len, 4, 28), turns = Math.max(0.6, g.len / 30), ph = L.now * 0.004 + L.seed * TAU, amp = 4 + L.width * 2;
    for (let i = 0; i <= n; i++) { const t = i / n; BC[i] = 0; BW[i] = amp * Math.sin(PI * t) * Math.sin(t * turns * TAU + ph); }
    ctx.lineWidth = 1 + L.width;
    ctx.beginPath(); strand(ctx, g, n, 1); ctx.stroke();
    ctx.beginPath(); strand(ctx, g, n, -1); ctx.strokeStyle = L.colorA(L.alpha); ctx.stroke();
    ctx.beginPath();
    for (let i = 1; i < n; i++) { const t = i / n; ctx.moveTo(X(g, t, BW[i]), Y(g, t, BW[i])); ctx.lineTo(X(g, t, -BW[i]), Y(g, t, -BW[i])); }
    ctx.lineWidth = 0.8; ctx.strokeStyle = white(L.alpha * 0.4); ctx.stroke();
  });

  /* ---------------- laser: hot core, wide glow, sparks where it hits ---------------- */
  add('laser', (ctx, L, S) => {
    const g = geo(L); if (!g) return;
    const fl = 0.85 + 0.15 * Math.sin(L.now * 0.05 + L.seed * 40);
    ctx.beginPath(); ctx.moveTo(L.ax, L.ay); ctx.lineTo(L.bx, L.by);
    ctx.lineWidth = (7 + L.width * 4) * fl; ctx.strokeStyle = L.color(L.alpha * 0.16); ctx.stroke();
    ctx.lineWidth = (2.5 + L.width * 1.5) * fl; ctx.strokeStyle = L.color(L.alpha * 0.65); ctx.stroke();
    ctx.lineWidth = 1 + L.width * 0.4; ctx.strokeStyle = white(L.alpha); ctx.stroke();
    ctx.beginPath(); dot(ctx, L.bx, L.by, (3 + L.width * 2) * fl);
    ctx.fillStyle = white(L.alpha * 0.55); ctx.fill();
    if (S.reduceMotion) return;
    ctx.beginPath();
    const back = Math.atan2(-g.dy, -g.dx);
    for (let k = 0; k < 4; k++) {
      const a = back + (Math.random() - 0.5) * 2.6, r0 = 2 + Math.random() * 3, r1 = r0 + 3 + Math.random() * 8;
      ctx.moveTo(L.bx + Math.cos(a) * r0, L.by + Math.sin(a) * r0); ctx.lineTo(L.bx + Math.cos(a) * r1, L.by + Math.sin(a) * r1);
    }
    ctx.lineWidth = 1; ctx.strokeStyle = hsla(50, 100, 80, L.alpha * 0.9); ctx.stroke();
  });

  /* ---------------- fire: flickering flame tongues and embers ---------------- */
  add('fire', (ctx, L, S) => {
    const g = geo(L); if (!g) return;
    const d = dens(L, S), n = clamp(Math.round(g.len / 7), 2, 14), bw = g.len / n * 0.75, H = 9 + L.width * 5, now = L.now;
    ctx.lineWidth = 1.5 + L.width; ctx.strokeStyle = hsla(25, 100, 55, L.alpha * 0.6);
    ctx.beginPath(); ctx.moveTo(L.ax, L.ay); ctx.lineTo(L.bx, L.by); ctx.stroke();
    for (let pass = 0; pass < 2; pass++) {
      const sc = pass ? 0.5 : 1;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, x = X(g, t, 0), y = Y(g, t, 0);
        const h = H * sc * (0.55 + 0.45 * Math.sin(now * 0.021 + i * 1.7 + L.seed * 20)) * (0.45 + 0.55 * Math.sin(PI * t));
        const sw = Math.sin(now * 0.011 + i * 2.3) * h * 0.35, w = bw * sc;
        ctx.moveTo(x - g.ux * w, y - g.uy * w);
        ctx.quadraticCurveTo(x - g.ux * w * 0.2, y - h * 0.6, x + sw, y - h);
        ctx.quadraticCurveTo(x + g.ux * w * 0.2, y - h * 0.6, x + g.ux * w, y + g.uy * w);
        ctx.closePath();
      }
      ctx.fillStyle = pass ? hsla(48, 100, 72, L.alpha * 0.8 * d) : hsla(14, 100, 52, L.alpha * 0.6 * d); ctx.fill();
    }
    ctx.fillStyle = hsla(35, 100, 65, L.alpha);
    for (let k = 0; k < 3; k++) {
      const life = (now * 0.0012 + hash(L.seed, k)) % 1, t = hash(L.seed, k + 7);
      ctx.globalAlpha = 1 - life;
      ctx.fillRect(X(g, t, 0) + Math.sin(now * 0.01 + k) * 3, Y(g, t, 0) - H - life * 22, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;
  });

  /* ---------------- plasma: braided phase-shifted sine strands ---------------- */
  add('plasma', (ctx, L) => {
    const g = geo(L); if (!g) return;
    const n = segs(g.len, 5, 24), amp = 4 + L.width * 2, f = Math.max(1, g.len / 40);
    ctx.beginPath(); ctx.moveTo(L.ax, L.ay); ctx.lineTo(L.bx, L.by);
    ctx.lineWidth = amp * 2.4; ctx.strokeStyle = L.color(L.alpha * 0.12); ctx.stroke();
    ctx.lineWidth = 1 + L.width * 0.5;
    for (let k = 0; k < 3; k++) {
      const ph = L.now * 0.006 * (1 + k * 0.35) + k * TAU / 3 + L.seed * 9;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const t = i / n, o = amp * Math.sin(PI * t) * Math.sin(t * f * TAU + ph);
        i ? ctx.lineTo(X(g, t, o), Y(g, t, o)) : ctx.moveTo(X(g, t, o), Y(g, t, o));
      }
      ctx.strokeStyle = k === 0 ? L.color(L.alpha * 0.9) : k === 1 ? L.colorA(L.alpha * 0.9) : white(L.alpha * 0.75); ctx.stroke();
    }
  });

  /* ---------------- barbed: twisted wire with barbs ---------------- */
  add('barbed', (ctx, L) => {
    const g = geo(L); if (!g) return;
    const n = segs(g.len, 4, 30), tw = g.len / 5;
    for (let i = 0; i <= n; i++) { const t = i / n; BC[i] = 0; BW[i] = 1.6 * Math.sin(t * tw); }
    ctx.lineWidth = 1 + L.width * 0.5;
    ctx.beginPath(); strand(ctx, g, n, 1); strand(ctx, g, n, -1); ctx.stroke();
    const m = clamp(Math.floor(g.len / 14), 1, 8), s = 3 + L.width;
    ctx.beginPath();
    for (let k = 0; k < m; k++) {
      const t = (k + 0.5) / m, x = X(g, t, 0), y = Y(g, t, 0);
      const ax = g.ux * 0.5 + g.px * 0.87, ay = g.uy * 0.5 + g.py * 0.87, bx = -g.ux * 0.5 + g.px * 0.87, by = -g.uy * 0.5 + g.py * 0.87;
      ctx.moveTo(x - ax * s, y - ay * s); ctx.lineTo(x + ax * s, y + ay * s);
      ctx.moveTo(x - bx * s, y - by * s); ctx.lineTo(x + bx * s, y + by * s);
    }
    ctx.lineWidth = 1.2; ctx.strokeStyle = white(L.alpha * 0.8); ctx.stroke();
  });

  /* ---------------- rainbow: hue gradient along the link ---------------- */
  add('rainbow', (ctx, L) => {
    const g = geo(L); if (!g) return;
    const gr = ctx.createLinearGradient(L.ax, L.ay, L.bx, L.by), h0 = (L.seed * 360 + L.now * 0.15) % 360;
    for (let k = 0; k <= 4; k++) gr.addColorStop(k / 4, hsla(((h0 + k * 70) % 360).toFixed(0), 100, 62, L.alpha));
    ctx.beginPath(); ctx.moveTo(L.ax, L.ay); ctx.lineTo(L.bx, L.by);
    ctx.strokeStyle = gr;
    ctx.globalAlpha = 0.22; ctx.lineWidth = 8 + L.width * 5; ctx.stroke(); ctx.globalAlpha = 1;
    ctx.lineWidth = 3 + L.width * 2; ctx.stroke();
    ctx.lineWidth = 0.8; ctx.strokeStyle = white(L.alpha * 0.55); ctx.stroke();
  });

  /* ---------------- beads: glowing beads travelling along ---------------- */
  add('beads', (ctx, L) => {
    const g = geo(L); if (!g) return;
    ctx.lineWidth = 1; ctx.strokeStyle = L.color(L.alpha * 0.4);
    ctx.beginPath(); ctx.moveTo(L.ax, L.ay); ctx.lineTo(L.bx, L.by); ctx.stroke();
    const k = clamp(Math.round(g.len / 20), 1, 5), r = 1.6 + L.width;
    const pos = (i) => (L.age * 0.0007 + i / k + L.seed) % 1;
    ctx.beginPath(); for (let i = 0; i < k; i++) { const t = pos(i); dot(ctx, X(g, t, 0), Y(g, t, 0), r * 2.6); }
    ctx.fillStyle = L.color(L.alpha * 0.3); ctx.fill();
    ctx.beginPath(); for (let i = 0; i < k; i++) { const t = pos(i); dot(ctx, X(g, t, 0), Y(g, t, 0), r); }
    ctx.fillStyle = white(L.alpha * 0.95); ctx.fill();
  });

  /* ---------------- roots: wobbly main vein with branching offshoots ---------------- */
  add('roots', (ctx, L) => {
    const g = geo(L); if (!g) return;
    const s = L.seed, ang0 = Math.atan2(g.dy, g.dx);
    ctx.beginPath(); ctx.moveTo(L.ax, L.ay);
    for (let i = 1; i < 4; i++) { const t = i / 4, o = (hash(s, i) - 0.5) * g.len * 0.18; ctx.lineTo(X(g, t, o), Y(g, t, o)); }
    ctx.lineTo(L.bx, L.by);
    ctx.lineWidth = 1.5 + L.width * 1.8; ctx.stroke();
    const m = clamp(Math.round(g.len / 16), 1, 6);
    ctx.beginPath();
    for (let j = 0; j < m; j++) {
      const t = 0.12 + 0.76 * hash(s, j + 10), side = hash(s, j + 20) < 0.5 ? -1 : 1;
      const a1 = ang0 + side * (0.45 + 0.6 * hash(s, j + 30)) + Math.sin(L.now * 0.002 + j) * 0.08, l1 = g.len * (0.12 + 0.16 * hash(s, j + 40));
      const x0 = X(g, t, 0), y0 = Y(g, t, 0), x1 = x0 + Math.cos(a1) * l1, y1 = y0 + Math.sin(a1) * l1;
      const a2 = a1 + side * 0.5, x2 = x1 + Math.cos(a2) * l1 * 0.7, y2 = y1 + Math.sin(a2) * l1 * 0.7;
      const a3 = a1 - side * 0.6;
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.moveTo(x1, y1); ctx.lineTo(x1 + Math.cos(a3) * l1 * 0.5, y1 + Math.sin(a3) * l1 * 0.5);
    }
    ctx.lineWidth = 0.6 + L.width * 0.6; ctx.strokeStyle = L.colorA(L.alpha * 0.8); ctx.stroke();
  });

  /* ---------------- synapse: curved axon, bulb terminals, firing spark ---------------- */
  add('synapse', (ctx, L) => {
    const g = geo(L); if (!g) return;
    const b = (L.seed - 0.5) * 0.7 * g.len, cx = X(g, 0.5, b), cy = Y(g, 0.5, b);
    ctx.beginPath(); ctx.moveTo(L.ax, L.ay); ctx.quadraticCurveTo(cx, cy, L.bx, L.by);
    ctx.lineWidth = 4 + L.width * 2.5; ctx.strokeStyle = L.color(L.alpha * 0.14); ctx.stroke();
    ctx.lineWidth = 1 + L.width * 0.8; ctx.strokeStyle = L.color(L.alpha * 0.85); ctx.stroke();
    const rb = 2.2 + L.width;
    ctx.beginPath(); dot(ctx, L.ax, L.ay, rb); dot(ctx, L.bx, L.by, rb * 1.3); ctx.fillStyle = L.color(L.alpha * 0.9); ctx.fill();
    const per = 550 + L.seed * 600, p = (L.age / per) % 1, q = 1 - p;
    const sx = q * q * L.ax + 2 * q * p * cx + p * p * L.bx, sy = q * q * L.ay + 2 * q * p * cy + p * p * L.by;
    ctx.beginPath(); dot(ctx, sx, sy, 4 + L.width * 1.5); ctx.fillStyle = white(L.alpha * 0.22); ctx.fill();
    ctx.beginPath(); dot(ctx, sx, sy, 1.4 + L.width * 0.5); ctx.fillStyle = white(L.alpha); ctx.fill();
    if (p > 0.82) {
      const f = (p - 0.82) / 0.18;
      ctx.beginPath(); ctx.arc(L.bx, L.by, rb * (1.3 + f * 3), 0, TAU);
      ctx.lineWidth = 1.2; ctx.strokeStyle = white(L.alpha * (1 - f)); ctx.stroke();
    }
  });

  /* ---------------- arc: three jittering thin bolts ---------------- */
  add('arc', (ctx, L) => {
    const g = geo(L); if (!g) return;
    const n = clamp(Math.round(g.len / 9), 3, 9), J = g.len * 0.2;
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      ctx.moveTo(L.ax, L.ay);
      for (let i = 1; i < n; i++) { const t = i / n, o = (Math.random() - 0.5) * J * Math.sin(PI * t); ctx.lineTo(X(g, t, o), Y(g, t, o)); }
      ctx.lineTo(L.bx, L.by);
    }
    ctx.lineWidth = 3 + L.width * 2; ctx.strokeStyle = L.color(L.alpha * 0.2); ctx.stroke();
    ctx.lineWidth = 0.8; ctx.strokeStyle = white(L.alpha * 0.9); ctx.stroke();
  });

  /* ---------------- wave: sine wave whose amplitude pulses ---------------- */
  add('wave', (ctx, L) => {
    const g = geo(L); if (!g) return;
    const cyc = Math.max(1, Math.round(g.len / 18)), n = clamp(cyc * 8, 8, 40);
    const A = (3 + L.width * 3) * (0.2 + 0.8 * Math.abs(Math.sin(L.now * 0.005 + L.seed * TAU)));
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const t = i / n, o = A * Math.min(1, t * 6, (1 - t) * 6) * Math.sin(t * cyc * TAU - L.now * 0.01);
      i ? ctx.lineTo(X(g, t, o), Y(g, t, o)) : ctx.moveTo(X(g, t, o), Y(g, t, o));
    }
    ctx.lineWidth = 4 + L.width * 2; ctx.strokeStyle = L.color(L.alpha * 0.18); ctx.stroke();
    ctx.lineWidth = 1 + L.width; ctx.strokeStyle = L.color(L.alpha); ctx.stroke();
  });

  /* ---------------- rope: two thick twisted strands ---------------- */
  add('rope', (ctx, L) => {
    const g = geo(L); if (!g) return;
    const n = segs(g.len, 3, 36), r = 1.6 + L.width * 0.9;
    for (let i = 0; i <= n; i++) { const t = i / n; BC[i] = 0; BW[i] = r * Math.sin(t * g.len / 4 + L.seed * 6); }
    ctx.lineWidth = 2 + L.width * 1.2;
    ctx.beginPath(); strand(ctx, g, n, 1); ctx.strokeStyle = L.color(L.alpha * 0.9); ctx.stroke();
    ctx.beginPath(); strand(ctx, g, n, -1); ctx.strokeStyle = L.colorA(L.alpha * 0.75); ctx.stroke();
  });

  /* ---------------- membrane: translucent web skin between A, B and a sibling (or the centre) ---------------- */
  add('membrane', (ctx, L, S) => {
    const g = geo(L); if (!g) return;
    const l = L.link;
    if (l._sib === undefined || (l._sib === null && L.now - (l._sibT || 0) > 400)) { // find another child of A, once
      l._sib = null; l._sibT = L.now;
      for (const o of S.links) if (o !== l && o.A === l.A && !o.dying) { l._sib = o; break; }
    }
    const sib = l._sib, mx = (L.ax + L.bx) / 2, my = (L.ay + L.by) / 2;
    let cx, cy;
    if (sib && !sib.dying && sib.B.alpha > 0.05) { cx = sib.B.sx; cy = sib.B.sy; }
    else {
      const vx = S.cx - mx, vy = S.cy - my, d = Math.hypot(vx, vy);
      if (d < 2) return S.line(L.ax, L.ay, L.bx, L.by);
      const k = Math.min(d, g.len * 1.1) / d * (0.85 + 0.15 * Math.sin(L.now * 0.003 + L.seed * TAU));
      cx = mx + vx * k; cy = my + vy * k;
    }
    const ox = (L.ax + L.bx + cx) / 3, oy = (L.ay + L.by + cy) / 3; // edges sag toward the centroid
    ctx.beginPath(); ctx.moveTo(L.ax, L.ay);
    ctx.quadraticCurveTo((mx + ox) / 2, (my + oy) / 2, L.bx, L.by);
    ctx.quadraticCurveTo(((L.bx + cx) / 2 + ox) / 2, ((L.by + cy) / 2 + oy) / 2, cx, cy);
    ctx.quadraticCurveTo(((L.ax + cx) / 2 + ox) / 2, ((L.ay + cy) / 2 + oy) / 2, L.ax, L.ay);
    ctx.fillStyle = L.color(L.alpha * 0.1 * dens(L, S)); ctx.fill();
    ctx.lineWidth = 0.7; ctx.strokeStyle = L.color(L.alpha * 0.45); ctx.stroke();
    ctx.lineWidth = L.width; ctx.strokeStyle = L.color(L.alpha); S.line(L.ax, L.ay, L.bx, L.by);
  });

  /* ---------------- constellation: thin line with twinkling stars ---------------- */
  add('constellation', (ctx, L) => {
    const g = geo(L); if (!g) return;
    ctx.lineWidth = 0.7; ctx.strokeStyle = L.color(L.alpha * 0.5);
    ctx.beginPath(); ctx.moveTo(L.ax, L.ay); ctx.lineTo(L.bx, L.by); ctx.stroke();
    const k = clamp(Math.round(g.len / 25), 1, 3);
    ctx.beginPath();
    for (let i = 0; i <= k; i++) {
      const t = i === k ? 1 : 0.15 + 0.7 * hash(L.seed, i), x = X(g, t, 0), y = Y(g, t, 0);
      const s = (2 + L.width * 2) * (0.3 + 0.7 * Math.abs(Math.sin(L.now * 0.005 + hash(L.seed, i + 9) * 20))), d = s * 0.4;
      ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.moveTo(x, y - s); ctx.lineTo(x, y + s);
      ctx.moveTo(x - d, y - d); ctx.lineTo(x + d, y + d); ctx.moveTo(x - d, y + d); ctx.lineTo(x + d, y - d);
    }
    ctx.lineWidth = 1; ctx.strokeStyle = white(L.alpha * 0.9); ctx.stroke();
  });

  /* ---------------- arrow: thick shaft, arrowhead, fletching; it twangs on impact ---------------- */
  add('arrow', (ctx, L) => {
    const g = geo(L); if (!g) return;
    const hs = 4 + L.width * 3, sl = Math.max(0, g.len - hs * 0.9) / g.len;
    const twang = L.grow >= 1 ? Math.sin(L.age * 0.06) * Math.exp(-(L.age - 220) / 180) * g.len * 0.12 : 0;
    ctx.beginPath(); ctx.moveTo(L.ax, L.ay); ctx.quadraticCurveTo(X(g, sl / 2, twang * 2), Y(g, sl / 2, twang * 2), X(g, sl, 0), Y(g, sl, 0));
    ctx.lineWidth = 1.5 + L.width * 1.5; ctx.stroke();
    const tx = L.bx, ty = L.by, bx = tx - g.ux * hs * 1.3, by = ty - g.uy * hs * 1.3;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(bx + g.px * hs * 0.7, by + g.py * hs * 0.7); ctx.lineTo(bx - g.px * hs * 0.7, by - g.py * hs * 0.7); ctx.closePath();
    ctx.fill();
    if (g.len > 16) {
      ctx.beginPath();
      for (let k = 0; k < 2; k++) {
        const fx = L.ax + g.ux * (3 + k * 3), fy = L.ay + g.uy * (3 + k * 3), f = hs * 0.6;
        ctx.moveTo(fx, fy); ctx.lineTo(fx - g.ux * f + g.px * f, fy - g.uy * f + g.py * f);
        ctx.moveTo(fx, fy); ctx.lineTo(fx - g.ux * f - g.px * f, fy - g.uy * f - g.py * f);
      }
      ctx.lineWidth = 1; ctx.strokeStyle = L.colorA(L.alpha * 0.8); ctx.stroke();
    }
  });

  /* ---------------- glyphs: a trail of tiny letters marching along ---------------- */
  let fontFrame = -1;
  add('glyphs', (ctx, L, S) => {
    const g = geo(L); if (!g) return;
    const l = L.link;
    if (!l._g) { l._g = []; for (let i = 0; i < 6; i++) l._g.push(S.glyph()); }
    if (fontFrame !== L.now) { fontFrame = L.now; ctx.font = `${Math.round(8 + L.width * 2)}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; }
    ctx.lineWidth = 0.6; ctx.strokeStyle = L.color(L.alpha * 0.25);
    ctx.beginPath(); ctx.moveTo(L.ax, L.ay); ctx.lineTo(L.bx, L.by); ctx.stroke();
    const k = clamp(Math.floor(g.len / 12), 1, 6);
    for (let i = 0; i < k; i++) {
      const t = (i / k + L.age * 0.0005) % 1, o = Math.sin(t * TAU * 2 + L.now * 0.008) * 2.5;
      ctx.fillStyle = i === 0 ? white(L.alpha) : L.color(L.alpha * (0.4 + 0.6 * t));
      ctx.fillText(l._g[i], X(g, t, o), Y(g, t, o));
    }
  });

  /* ---------------- brush: ink brush stroke of varying width ---------------- */
  add('brush', (ctx, L, S) => {
    const g = geo(L); if (!g) return;
    const n = segs(g.len, 5, 16), W = 2 + L.width * 2.5, bend = (L.seed - 0.5) * 0.25 * g.len;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      BC[i] = Math.sin(PI * t) * bend;
      BW[i] = W * (0.3 + 1.1 * Math.sin(PI * Math.pow(t, 0.6))) * (0.75 + 0.5 * hash(L.seed, i)) * (1 - 0.6 * t);
    }
    band(ctx, g, n);
    ctx.fillStyle = L.color(L.alpha * 0.85 * dens(L, S)); ctx.fill();
    ctx.beginPath(); // dry-brush streaks near the tail
    const i0 = Math.floor(n * 0.5);
    for (let s = -1; s <= 1; s += 2) for (let i = i0; i <= n; i++) { const t = i / n, o = BC[i] + BW[i] * 0.55 * s; i === i0 ? ctx.moveTo(X(g, t, o), Y(g, t, o)) : ctx.lineTo(X(g, t, o), Y(g, t, o)); }
    ctx.lineWidth = 0.7; ctx.strokeStyle = white(L.alpha * 0.25); ctx.stroke();
    ctx.beginPath(); dot(ctx, X(g, 0.1, W * 2.5 * (hash(L.seed, 50) - 0.5) * 2), Y(g, 0.1, W * 2.5 * (hash(L.seed, 50) - 0.5) * 2), 0.6 + W * 0.3);
    ctx.fillStyle = L.color(L.alpha * 0.7); ctx.fill();
  });

  /* ---------------- vine: curly stem with leaves and tendrils ---------------- */
  add('vine', (ctx, L) => {
    const g = geo(L); if (!g) return;
    const n = segs(g.len, 4, 28), ph = L.seed * TAU, amp = 2 + L.width;
    for (let i = 0; i <= n; i++) { const t = i / n; BC[i] = amp * Math.sin(t * g.len / 9 + ph); BW[i] = 0; }
    ctx.beginPath(); strand(ctx, g, n, 0);
    const tc = 0.3 + 0.4 * L.seed, tx = X(g, tc, BC[Math.round(tc * n)]), ty = Y(g, tc, BC[Math.round(tc * n)]);
    const ta = Math.atan2(g.py, g.px) * (L.seed < 0.5 ? 1 : -1), tr = 2.5 + L.width;
    ctx.moveTo(tx, ty); ctx.arc(tx + Math.cos(ta) * tr, ty + Math.sin(ta) * tr, tr, ta + PI, ta + PI + 4.5); // a tendril curl
    ctx.lineWidth = 1 + L.width * 0.7; ctx.stroke();
    const step = Math.max(1, Math.round(n / clamp(Math.round(g.len / 12), 1, 8))), ll = 4 + L.width * 2.5, a0 = Math.atan2(g.dy, g.dx);
    ctx.beginPath();
    for (let i = 1, s = 1; i < n; i += step, s = -s) {
      const t = i / n, x = X(g, t, BC[i]), y = Y(g, t, BC[i]);
      const a = a0 + s * 0.9 + Math.sin(L.now * 0.003 + i) * 0.2, dx = Math.cos(a) * ll, dy = Math.sin(a) * ll;
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + dx * 0.5 - dy * 0.4, y + dy * 0.5 + dx * 0.4, x + dx, y + dy);
      ctx.quadraticCurveTo(x + dx * 0.5 + dy * 0.4, y + dy * 0.5 - dx * 0.4, x, y);
    }
    ctx.fillStyle = L.colorA(L.alpha * 0.75); ctx.fill();
  });

  /* ---------------- comet: bright head, long fading tail; it keeps flying the link ---------------- */
  add('comet', (ctx, L) => {
    const g = geo(L); if (!g) return;
    ctx.lineWidth = 0.6; ctx.strokeStyle = L.color(L.alpha * 0.2);
    ctx.beginPath(); ctx.moveTo(L.ax, L.ay); ctx.lineTo(L.bx, L.by); ctx.stroke();
    const ht = L.grow < 1 ? 1 : ((L.age - 220) / (900 + L.seed * 600)) % 1;
    const hx = X(g, ht, 0), hy = Y(g, ht, 0), W = 2 + L.width * 1.5;
    for (let k = 0; k < 3; k++) {
      const tl = Math.max(0, ht - [0.9, 0.55, 0.28][k] * Math.max(ht, 0.3)), w = W * [1.4, 1, 0.6][k];
      ctx.beginPath(); ctx.moveTo(X(g, tl, 0), Y(g, tl, 0));
      ctx.lineTo(hx + g.px * w, hy + g.py * w); ctx.lineTo(hx - g.px * w, hy - g.py * w); ctx.closePath();
      ctx.fillStyle = k === 2 ? white(L.alpha * 0.45) : L.color(L.alpha * [0.3, 0.45][k]); ctx.fill();
    }
    ctx.beginPath(); dot(ctx, hx, hy, W * 2.6); ctx.fillStyle = L.color(L.alpha * 0.3); ctx.fill();
    ctx.beginPath(); dot(ctx, hx, hy, W * 0.9); ctx.fillStyle = white(L.alpha); ctx.fill();
  });

  /* ---------------- gravity: bent toward the screen centre, like a geodesic ---------------- */
  add('gravity', (ctx, L, S) => {
    const x0 = L.ax, y0 = L.ay, x2 = L.fx, y2 = L.fy, mx = (x0 + x2) / 2, my = (y0 + y2) / 2;
    const k = 0.45 + 0.05 * Math.sin(L.now * 0.003 + L.seed * TAU);
    const x1 = mx + (S.cx - mx) * k, y1 = my + (S.cy - my) * k, t = L.grow;
    // de Casteljau: the part of the curve from 0 to grow
    const qx = x0 + (x1 - x0) * t, qy = y0 + (y1 - y0) * t, rx = x1 + (x2 - x1) * t, ry = y1 + (y2 - y1) * t;
    const ex = qx + (rx - qx) * t, ey = qy + (ry - qy) * t;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(qx, qy, ex, ey);
    ctx.lineWidth = 4 + L.width * 3; ctx.strokeStyle = L.color(L.alpha * 0.16); ctx.stroke();
    ctx.lineWidth = 1 + L.width * 0.7; ctx.strokeStyle = L.color(L.alpha); ctx.stroke();
    const p = (L.age * 0.0009 + L.seed) % 1 * t, q = 1 - p; // a falling mote
    ctx.beginPath(); dot(ctx, q * q * x0 + 2 * q * p * x1 + p * p * x2, q * q * y0 + 2 * q * p * y1 + p * p * y2, 1.2 + L.width * 0.6);
    ctx.fillStyle = white(L.alpha * 0.9); ctx.fill();
  });

  /* ---------------- morse: scrolling dash-dot pattern ---------------- */
  add('morse', (ctx, L) => {
    const l = L.link;
    if (!l._m) { l._m = []; for (let i = 0; i < 7; i++) l._m.push(hash(l.seed, i) < 0.5 ? 0.1 : 7, 5); l._m.push(0.1, 12); }
    ctx.lineWidth = 0.6; ctx.strokeStyle = L.color(L.alpha * 0.2);
    ctx.beginPath(); ctx.moveTo(L.ax, L.ay); ctx.lineTo(L.bx, L.by); ctx.stroke();
    ctx.setLineDash(l._m); ctx.lineDashOffset = -L.now * 0.04;
    ctx.lineWidth = 2.2 + L.width * 1.3; ctx.strokeStyle = L.color(L.alpha); ctx.stroke();
    ctx.setLineDash([]); ctx.lineDashOffset = 0;
  });

  /* ---------------- zipper: rails, interleaved teeth, a slider with a swinging pull tab ---------------- */
  add('zipper', (ctx, L) => {
    const g = geo(L); if (!g) return;
    const r = 2 + L.width, n = clamp(Math.floor(g.len / 3.5), 2, 40);
    ctx.beginPath();
    ctx.moveTo(X(g, 0, r), Y(g, 0, r)); ctx.lineTo(X(g, 1, r), Y(g, 1, r));
    ctx.moveTo(X(g, 0, -r), Y(g, 0, -r)); ctx.lineTo(X(g, 1, -r), Y(g, 1, -r));
    ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, s = i % 2 ? 1 : -1; ctx.moveTo(X(g, t, r * s), Y(g, t, r * s)); ctx.lineTo(X(g, t, -r * 0.35 * s), Y(g, t, -r * 0.35 * s)); }
    ctx.lineWidth = 1.6; ctx.strokeStyle = L.colorA(L.alpha * 0.9); ctx.stroke();
    const hl = 4, hw = r + 2, x = L.bx - g.ux * hl, y = L.by - g.uy * hl;
    ctx.beginPath();
    ctx.moveTo(x - g.ux * hl + g.px * hw, y - g.uy * hl + g.py * hw); ctx.lineTo(x + g.ux * hl + g.px * hw * 0.6, y + g.uy * hl + g.py * hw * 0.6);
    ctx.lineTo(x + g.ux * hl - g.px * hw * 0.6, y + g.uy * hl - g.py * hw * 0.6); ctx.lineTo(x - g.ux * hl - g.px * hw, y - g.uy * hl - g.py * hw); ctx.closePath();
    ctx.fillStyle = white(L.alpha * 0.85); ctx.fill();
    const sw = Math.sin(L.now * 0.008 + L.seed * TAU) * 0.6, tl = 5 + L.width * 2;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(x + (g.px * Math.cos(sw) - g.ux * Math.sin(sw)) * (hw + tl), y + (g.py * Math.cos(sw) - g.uy * Math.sin(sw)) * (hw + tl));
    ctx.lineWidth = 2; ctx.strokeStyle = white(L.alpha * 0.85); ctx.stroke();
  });

  /* ---------------- spiral: helix coil along the link ---------------- */
  add('spiral', (ctx, L) => {
    const g = geo(L); if (!g) return;
    const turns = clamp(g.len / 7, 1, 14), n = clamp(Math.ceil(turns * 6), 8, 72), r = 3 + L.width * 1.5, ph = L.now * 0.008 + L.seed * TAU;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const t = i / n, a = t * turns * TAU + ph, env = Math.min(1, t * 5, (1 - t) * 5), along = t + Math.cos(a) * r * 0.6 * env / g.len, o = Math.sin(a) * r * env;
      i ? ctx.lineTo(X(g, along, o), Y(g, along, o)) : ctx.moveTo(X(g, along, o), Y(g, along, o));
    }
    ctx.lineWidth = 1 + L.width * 0.6; ctx.stroke();
  });

  /* ---------------- blood: thick pulsing vessel with a travelling bolus ---------------- */
  add('blood', (ctx, L) => {
    const g = geo(L); if (!g) return;
    const per = 850, ph = (L.now + L.seed * per) % per, beat = Math.exp(-ph / 90) + 0.6 * Math.exp(-Math.abs(ph - 230) / 70);
    const W = (3 + L.width * 2.5) * (1 + 0.3 * beat);
    ctx.beginPath(); ctx.moveTo(L.ax, L.ay); ctx.lineTo(L.bx, L.by);
    ctx.lineWidth = W; ctx.strokeStyle = hsla(352, 85, 36, L.alpha * 0.9); ctx.stroke();
    ctx.lineWidth = W * 0.3; ctx.strokeStyle = hsla(355, 90, 55, L.alpha * 0.6); ctx.stroke();
    const p = (L.age / per + L.seed) % 1;
    ctx.beginPath(); dot(ctx, X(g, p, 0), Y(g, p, 0), W * 0.75); ctx.fillStyle = hsla(356, 95, 52, L.alpha); ctx.fill();
    ctx.beginPath(); ctx.moveTo(X(g, 0, W * 0.25), Y(g, 0, W * 0.25)); ctx.lineTo(X(g, 1, W * 0.25), Y(g, 1, W * 0.25));
    ctx.lineWidth = 0.7; ctx.strokeStyle = hsla(0, 100, 85, L.alpha * 0.35); ctx.stroke();
  });

  /* ---------------- neon: double hairpin neon tube with a hot core (and the odd flicker) ---------------- */
  add('neon', (ctx, L) => {
    const g = geo(L); if (!g) return;
    const o = 2 + L.width, fl = hash(L.seed, Math.floor(L.now / 70)) < 0.04 ? 0.25 : 1, a = L.alpha * fl, ap = Math.atan2(g.py, g.px);
    ctx.beginPath(); ctx.moveTo(X(g, 0, o), Y(g, 0, o)); ctx.lineTo(L.bx + g.px * o, L.by + g.py * o);
    ctx.arc(L.bx, L.by, o, ap, ap - PI, true); ctx.lineTo(X(g, 0, -o), Y(g, 0, -o));
    ctx.lineWidth = 6 + L.width * 3; ctx.strokeStyle = L.color(a * 0.18); ctx.stroke();
    ctx.lineWidth = 2 + L.width; ctx.strokeStyle = L.color(a * 0.6); ctx.stroke();
    ctx.lineWidth = 0.9; ctx.strokeStyle = white(a * 0.9); ctx.stroke();
  });

  /* ---------------- hexchain: chain of small spinning hexagons ---------------- */
  add('hexchain', (ctx, L) => {
    const g = geo(L); if (!g) return;
    const r = 3 + L.width * 1.2, n = clamp(Math.floor(g.len / (r * 1.9)), 1, 14);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = X(g, t, 0), y = Y(g, t, 0), rot = L.now * 0.002 * (i % 2 ? 1 : -1) + i * 0.3;
      for (let k = 0; k <= 6; k++) { const a = rot + k * PI / 3, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    }
    ctx.fillStyle = L.color(L.alpha * 0.15); ctx.fill();
    ctx.lineWidth = 1.1; ctx.stroke();
  });

  /* ---------------- extras ---------------- */
  // noodle: a fat wet spaghetti strand that sags and swings
  add('noodle', (ctx, L) => {
    const g = geo(L); if (!g) return;
    const sw = Math.sin(L.now * 0.004 + L.seed * TAU), mx = (L.ax + L.bx) / 2 + sw * g.len * 0.15, my = (L.ay + L.by) / 2 + g.len * 0.35;
    ctx.beginPath(); ctx.moveTo(L.ax, L.ay); ctx.quadraticCurveTo(mx, my, L.bx, L.by);
    ctx.lineWidth = 3 + L.width * 2; ctx.strokeStyle = hsla(45, 85, 62, L.alpha * 0.9); ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = white(L.alpha * 0.5); ctx.stroke();
  });
  // ecg: a heartbeat trace scrolling along the link
  add('ecg', (ctx, L) => {
    const g = geo(L); if (!g) return;
    const n = segs(g.len, 2.5, 48), A = 5 + L.width * 2.5;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = (((t * g.len - L.now * 0.06 + L.seed * 40) / 40) % 1 + 1) % 1;
      const o = x < 0.35 ? 0 : x < 0.43 ? -(x - 0.35) / 0.08 : x < 0.51 ? -1 + (x - 0.43) / 0.08 * 1.5 : x < 0.58 ? 0.5 - (x - 0.51) / 0.07 * 0.5 : x > 0.68 && x < 0.84 ? -0.25 * Math.sin((x - 0.68) / 0.16 * PI) : 0;
      i ? ctx.lineTo(X(g, t, o * A), Y(g, t, o * A)) : ctx.moveTo(X(g, t, o * A), Y(g, t, o * A));
    }
    ctx.lineWidth = 4 + L.width * 2; ctx.strokeStyle = L.color(L.alpha * 0.18); ctx.stroke();
    ctx.lineWidth = 1 + L.width * 0.5; ctx.strokeStyle = L.color(L.alpha); ctx.stroke();
  });
})(window.SPHERE);
