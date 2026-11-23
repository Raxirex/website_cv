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

  SP.addMode({
    id: 'cyber', name: 'CYBERPUNK', glyphs: 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホ0123456789ABCDEF#$%&@',
    base: [300, 100, 78], palette: [[300, 100, 60], [180, 100, 55], [56, 100, 55]], link: 'circuit', fade: 0.55, glitchy: true,
    shapes: ['sphere', 'tesseract', 'torus', 'lissajous', 'snub_cube', 'truncated_octahedron', 'cuboctahedron', 'rhombic_dodecahedron', 'hilbert', 'menger'],
    init(S) { S.data.rain = Array.from({ length: 34 }, () => ({ x: Math.round(rand(0, S.W) / 18) * 18, y: rand(-S.H, S.H), v: rand(1.5, 4.5) })); },
    ambient(S, ctx, now, dt) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.font = '14px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      S.data.rain.forEach((r) => {
        ctx.fillStyle = S.hsl(S.mode.palette[(r.x / 18) % 2 ? 0 : 1], S.hueShift, 0.35);
        ctx.fillText(S.glyph(), r.x, r.y);
        r.y += r.v * dt / 16;
        if (r.y > S.H + 20) { r.y = rand(-200, 0); r.x = Math.round(rand(0, S.W) / 18) * 18; }
      });
    },
    drawNode(S, ctx, n, g, size, a) { // chromatic split on infected letters
      if (!(n.inf || S.now < n.scr)) return false;
      ctx.font = `${size.toFixed(1)}px monospace`; ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,0,255,${0.7 * a})`; ctx.fillText(g, n.sx - 2, n.sy);
      ctx.fillStyle = `rgba(0,255,255,${0.7 * a})`; ctx.fillText(g, n.sx + 2, n.sy);
      return false; // and still draw the normal letter on top
    },
    onClimax(S) { S.glitch(300); },
    onRelease(S, held, power) { S.glitch(200 + 250 * power); }
  });

  SP.addMode({
    id: 'math', name: 'MATHEMATICS', glyphs: '∑∫∂∇∞√πφλΩ∮≈≡∀∃∈ℵℝℂℤℕ⊕⊗ΔΨ',
    base: [40, 90, 82], palette: [[40, 100, 65], [210, 100, 75], [0, 0, 100]], link: 'curve', mesh: true, fade: 0.55,
    shapes: ['harmonic', 'trefoil', 'mobius', 'klein', 'lorenz', 'lissajous', 'costa', 'kuen', 'breather', 'dini', 'bour', 'roman_surface', 'cross_cap', 'boy', 'enneper', 'gyroid', 'mandelbulb', 'torus_knot', 'cinquefoil', 'spherical_spiral', 'icosidodecahedron', 'rhombicosidodecahedron', 'truncated_icosidodecahedron', 'truncated_dodecahedron', 'pentakis_dodecahedron', 'triakis_icosahedron'],
    pageBg: ['#14100a', '#05070d']
  });

  SP.addMode({
    id: 'arcane', name: 'ARCANE', glyphs: 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ',
    base: [15, 100, 66], palette: [[5, 100, 52], [28, 100, 56], [45, 100, 62]], link: 'sigil', fade: 0.45,
    shapes: ['sphere', 'trefoil', 'torus', 'klein', 'small_stellated_dodecahedron', 'great_dodecahedron', 'great_stellated_dodecahedron', 'compound_five_tetrahedra', 'compound_five_octahedra', 'stella_octangula'],
    init(S) { S.data.c = { x: S.cx, y: S.cy, power: 0 }; },
    onPress(S, x, y) { S.data.c.x = x; S.data.c.y = y; },
    update(S) {
      const c = S.data.c, want = S.holding && S.held > 500 ? clamp((S.held - 500) / 3000, 0, 1) : 0;
      c.x += (S.ptr.x - c.x) * 0.12; c.y += (S.ptr.y - c.y) * 0.12; c.power += (want - c.power) * 0.05;
    },
    ambient(S) { if (Math.random() < 0.35) S.spawn(rand(0, S.W), S.H + 4, rand(-0.2, 0.2), rand(-1, -0.35), S.colorOf(1, 1), rand(2500, 4500), rand(1, 2)); },
    under(S, ctx, now) {
      const c = S.data.c, p = c.power;
      if (p < 0.02) return;
      const r = 30 + 100 * p, rot = now * 0.0006;
      ctx.save(); ctx.translate(c.x, c.y); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.3);
      g.addColorStop(0, S.colorOf(0, 0.22 * p)); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.3, 0, TAU); ctx.fill();
      ctx.strokeStyle = S.colorOf(0, 0.85 * p); ctx.lineWidth = 1.5;
      [1, 0.82, 0.45].forEach((f) => { ctx.beginPath(); ctx.arc(0, 0, r * f, 0, TAU); ctx.stroke(); });
      ctx.save(); ctx.rotate(-rot * 1.5); ctx.beginPath(); // pentagram
      for (let k = 0; k <= 5; k++) { const a = -Math.PI / 2 + k * 2 * TAU / 5, x = Math.cos(a) * r * 0.82, y = Math.sin(a) * r * 0.82; if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.strokeStyle = S.colorOf(1, 0.9 * p); ctx.stroke(); ctx.restore();
      ctx.save(); ctx.rotate(rot); // runes around the ring
      ctx.fillStyle = S.colorOf(2, p); ctx.font = `${10 + 6 * p}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let k = 0; k < 16; k++) { ctx.save(); ctx.rotate(k * TAU / 16); ctx.fillText(S.mode.glyphList[(k * 5) % S.mode.glyphList.length], 0, -r * 0.91); ctx.restore(); }
      ctx.restore();
      ctx.restore();
      if (Math.random() < p) { const a = rand(0, TAU); S.spawn(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, rand(-0.3, 0.3), rand(-1.6, -0.5), S.colorOf(1, 1), rand(800, 1600), rand(1, 2.2)); }
      if (p > 0.4) { // the edges of the screen burn
        const v = ctx.createRadialGradient(S.cx, S.cy, Math.min(S.W, S.H) * 0.3, S.cx, S.cy, Math.max(S.W, S.H) * 0.75);
        v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(140,0,0,${0.25 * p * (0.7 + 0.3 * Math.sin(now * 0.006))})`);
        ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = v; ctx.fillRect(0, 0, S.W, S.H);
      }
    },
    onRelease(S) {
      const c = S.data.c;
      if (c.power > 0.2) for (let k = 0; k < 90; k++) { const a = rand(0, TAU), v = rand(1, 6); S.spawn(c.x, c.y, Math.cos(a) * v, Math.sin(a) * v - 1, S.colorOf(k % 3, 1), rand(600, 1600), rand(1, 3)); }
      c.power = 0;
    }
  });

  SP.addMode({
    id: 'holo', name: 'HOLOGRAM', glyphs: '01◇◆◈▣□■△▽○●⊡⊞',
    base: [170, 100, 72], palette: [[170, 100, 55], [190, 100, 70], [0, 0, 100]], link: 'pulse', mesh: true, fade: 0.5,
    shapes: ['tesseract', 'helix', 'sphere', 'lissajous', 'cell24', 'cell600', 'duoprism', 'rectified_tesseract', 'runcinated_tesseract', 'glome', 'clifford_torus', 'hopf'],
    update(S) { S.a4Speed = S.holding && S.stage >= 2 ? 0.0028 : 0.0006; },
    ambient(S, ctx, now) { // scan beam
      const y = S.cy + S.R * 1.25 * Math.sin(now * 0.0013), w = S.R * 1.6;
      const g = ctx.createLinearGradient(0, y - 24, 0, y + 24);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, S.colorOf(0, 0.16)); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(S.cx - w, y - 24, w * 2, 48);
    },
    onRelease(S, held) { if (held > S.STAGES[2]) { S.active.forEach((n) => (n.p = n.p.map((v) => v * 0.03))); S.flash(0.5); } } // implode, unfold again
  });
})(window.SPHERE);
