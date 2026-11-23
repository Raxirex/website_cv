/* Dynamic Interactive Labs — Strength of Materials ('som', Festigkeitslehre).
   Cross-section properties with the Steiner table, principal axes and the circle of inertia; oblique bending with the neutral
   axis and the stress body; shear: Jourawski for solid sections, shear flow with arrows in open and closed thin-walled
   sections, the shear centre; torsion: circular, Saint-Venant rectangle, Bredt cells and open walls (the slit tube);
   tension and compression (stepped, clamped, compound bars, temperature); the elastic line by four integrations
   (Euler–Bernoulli and Timoshenko); Castigliano and Menabrea; Euler buckling. Every number is computed in som-core.js and the
   hand calculation is written out in the panel. Axes: y right, z down (Gross–Hauger–Schröder–Wall), Iyz = −∫yz dA. */
(function (G) {
  'use strict';
  const MB = G.MB, F = MB.F, h = F.h, K = MB.LabKit, R = MB.R, SO = G.SomCore, DV = MB.Derive, D = DV.D, CK = MB.ChaosKit;
  const { sqrt, abs, min, max, PI, sin, cos, atan2, hypot, round, sign } = Math;
  const TAU = 2 * PI, phone = () => window.innerWidth < 820;
  const SM = (MB.Som = {}), st = { L: null, panes: {}, t: 0, o: null, cache: {} };
  SM.st = st;
  const tk = (k) => R.tok[k] || '#888';
  const fitP = (cv) => { const c = K.fit2d(cv, 2); if (!c) return null; c.fillStyle = tk('paper'); c.fillRect(0, 0, cv._W, cv._H); c.lineCap = 'round'; c.lineJoin = 'round'; return c; };
  const fmt = (v, d = 2) => { if (v == null || !isFinite(v)) return '—'; const a = abs(v) < 0.5 * 10 ** -d ? 0 : v; return a.toFixed(d).replace('-', '−'); };
  const fg = (v, p = 4) => { if (!isFinite(v)) return '—'; if (v === 0) return '0'; const a = abs(v); if (a >= 1e-3 && a < 1e6) return fmt(v, max(0, p - 1 - Math.floor(Math.log10(a)))); const e = Math.floor(Math.log10(a)); return `${fmt(v / 10 ** e, p - 1)}·10${String(e).replace('-', '⁻').replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d])}`; };
  const txt = (c, s, x, y, col, al, size, base) => { c.save(); c.font = `${size || 11}px "B612 Mono", ui-monospace, monospace`; c.textAlign = al || 'center'; c.textBaseline = base || 'middle'; c.lineJoin = 'round';
    const Wc = c.canvas._W, Hc = c.canvas._H; if (Wc) { const w = c.measureText(s).width, a = al || 'center', l = a === 'left' ? x : a === 'right' ? x - w : x - w / 2; if (l < 3) x += 3 - l; else if (l + w > Wc - 3) x -= l + w - Wc + 3; const hh = (size || 11) * 0.6; if (y < hh + 1 && (base || 'middle') === 'middle') y = hh + 1; if (Hc && y > Hc - hh - 1 && (base || 'middle') === 'middle') y = Hc - hh - 1; } c.lineWidth = 3.4; c.strokeStyle = tk('paper'); c.strokeText(s, x, y); c.fillStyle = col || tk('ink'); c.fillText(s, x, y); c.restore(); };
  const arrow = (c, x0, y0, x1, y1, col, lw, hd) => { c.save(); c.strokeStyle = c.fillStyle = col; c.lineWidth = lw || 2; R.arrow(c, x0, y0, x1, y1, hd || 8); c.restore(); };
  const rgb = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim()); if (!m) return [128, 128, 128]; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, t) => a.map((v, i) => round(v + (b[i] - v) * t));
  const MATS = { steel: { name: 'Steel S235', E: 210000, G: 81000, fy: 235, alpha: 1.2e-5 }, s355: { name: 'Steel S355', E: 210000, G: 81000, fy: 355, alpha: 1.2e-5 }, alu: { name: 'Aluminium 6082-T6', E: 70000, G: 26300, fy: 260, alpha: 2.3e-5 }, ti: { name: 'Titanium Ti-6Al-4V', E: 114000, G: 44000, fy: 880, alpha: 8.6e-6 }, cu: { name: 'Copper', E: 117000, G: 44000, fy: 70, alpha: 1.7e-5 }, wood: { name: 'Timber C24', E: 11000, G: 690, fy: 24, alpha: 5e-6 } };
  const SHAPE_ICONS = [['rect', 'i-sec-rect'], ['circle', 'i-sec-circle'], ['tube', 'i-sec-tube'], ['I', 'i-sec-I'], ['T', 'i-sec-T'], ['C', 'i-sec-C'], ['L', 'i-sec-L'], ['Z', 'i-sec-Z'], ['box', 'i-sec-box'], ['box2', 'i-sec-box2'], ['slit', 'i-sec-slit'], ['custom', 'i-sec-custom']];

  /* ---------------- options ---------------- */
  const DEF = () => ({
    sec: { key: 'I', dims: {}, phi: 0, custom: [{ y: 0, z: -80, b: 160, h: 20, hole: false }, { y: 0, z: 0, b: 12, h: 140, hole: false }, { y: 40, z: 80, b: 80, h: 20, hole: false }] },
    mat: 'steel', bend: { N: 0, My: 20, Mz: 6 }, shear: { Qy: 0, Qz: 50, dyQ: 0 }, tors: { T: 1, L: 2000 },
    bars: { mode: 'step', A1: 600, A2: 300, L1: 1200, L2: 800, F1: 40, F2: 30, dT: 0, mat2: 'alu' },
    elastic: { L: 4, left: 'fixed', right: 'free', q1: 5, q2: 5, F: 10, a: 4, M: 0, b: 2, timo: true },
    energy: { mode: 'arc', R: 1, F: 10, N: true, Q: true }, buck: { cs: 'pp', L: 3, f: 0.5, imp: 300, anim: false, mode: 1, view: 'curve' }, derive: { which: 'steiner' }, beam: { x: 1.5, anim: false },
  });
  const o = () => st.o;
  const save = () => st.L && st.L.save({ o: st.o, scene: st.L.sceneId });
  const mat = () => MATS[o().mat] || MATS.steel;
  function getSec() {
    const s = o().sec; if (s.key === 'custom') return { key: 'custom', name: 'Composite', parts: s.custom.map((r, i) => ({ kind: 'rect', y: r.y, z: r.z, b: r.b, h: r.h, sign: r.hole ? -1 : 1, label: `${r.hole ? 'hole' : 'part'} ${i + 1}` })), dims: {} };
    return SO.build(s.key, s.dims[s.key]);
  }
  const secInfo = () => { const sec = getSec(), P = SO.props(sec); return { sec, P }; };

  /* ---------------- section drawing ---------------- */
  function secView(W, H, P, pad, offx) { const ex = P.ext, w = ex.ymax - ex.ymin, hh = ex.zmax - ex.zmin, s = min((W - 2 * pad - (offx || 0)) / w, (H - 2 * pad) / hh), cx = W / 2 - (offx || 0) / 2, cy = H / 2; return { s, X: (y) => cx + (y - P.yS - (ex.ymin + ex.ymax) / 2) * s, Y: (z) => cy + (z - P.zS - (ex.zmin + ex.zmax) / 2) * s, yw: (X) => (X - cx) / s + P.yS + (ex.ymin + ex.ymax) / 2, zw: (Y) => (Y - cy) / s + P.zS + (ex.zmin + ex.zmax) / 2 }; }
  function partPath(c, p, V) { c.beginPath(); if (p.kind === 'rect') c.rect(V.X(p.y - p.b / 2), V.Y(p.z - p.h / 2), p.b * V.s, p.h * V.s); else if (p.kind === 'circle') c.arc(V.X(p.y), V.Y(p.z), p.r * V.s, 0, TAU); else p.pts.forEach(([y, z], i) => (i ? c.lineTo(V.X(y), V.Y(z)) : c.moveTo(V.X(y), V.Y(z)))); c.closePath(); }
  function drawParts(c, sec, V, o2) {
    o2 = o2 || {}; c.save();
    for (const p of sec.parts) if ((p.sign || 1) > 0) { partPath(c, p, V); c.fillStyle = o2.fill || tk('body'); if (!o2.noFill) c.fill(); }
    for (const p of sec.parts) if ((p.sign || 1) < 0) { partPath(c, p, V); c.fillStyle = tk('paper'); c.fill(); }
    c.strokeStyle = tk('ink'); c.lineWidth = 1.4; for (const p of sec.parts) { partPath(c, p, V); c.stroke(); }
    if (sec.key === 'slit' && sec.dims) { const d = sec.dims, R0 = d.D / 2, w = max(1.5, d.D * 0.014); c.fillStyle = tk('paper'); c.fillRect(V.X(-w / 2), V.Y(R0 - d.t - 0.5), w * V.s, (d.t + 1) * V.s); c.lineWidth = 1.4; R.line(c, V.X(-w / 2), V.Y(R0 - d.t), V.X(-w / 2), V.Y(R0)); R.line(c, V.X(w / 2), V.Y(R0 - d.t), V.X(w / 2), V.Y(R0)); txt(c, 'slit', V.X(0), V.Y(R0) + 14, tk('ink-2'), 'center', 10.5); }
    if (o2.labels) sec.parts.forEach((p, i) => { const q = SO.partProps(p); txt(c, `${i + 1}`, V.X(q.y), V.Y(q.z), tk('ink-2'), 'center', 10); });
    c.restore();
  }
  const inSec = (sec, y, z) => { let n = 0; for (const p of sec.parts) { let i = false; if (p.kind === 'rect') i = abs(y - p.y) <= p.b / 2 && abs(z - p.z) <= p.h / 2; else if (p.kind === 'circle') i = hypot(y - p.y, z - p.z) <= p.r; else { const Q = p.pts; for (let a = 0, b = Q.length - 1; a < Q.length; b = a++) if ((Q[a][1] > z) !== (Q[b][1] > z) && y < ((Q[b][0] - Q[a][0]) * (z - Q[a][1])) / (Q[b][1] - Q[a][1]) + Q[a][0]) i = !i; } if (i) n += p.sign || 1; } return n > 0; };
  function centroidMark(c, x, y, lab) { c.save(); c.strokeStyle = tk('ink'); c.fillStyle = tk('paper'); c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, 6, 0, TAU); c.fill(); c.stroke(); c.fillStyle = tk('ink'); c.beginPath(); c.moveTo(x, y); c.arc(x, y, 6, -PI / 2, 0); c.lineTo(x, y); c.fill(); c.beginPath(); c.moveTo(x, y); c.arc(x, y, 6, PI / 2, PI); c.lineTo(x, y); c.fill(); c.restore(); if (lab) txt(c, lab, x - 10, y - 12, tk('ink'), 'right', 12); }
  function axesAt(c, x, y, L, ang, labs, col, dash) { c.save(); c.strokeStyle = c.fillStyle = col; c.lineWidth = 1.3; if (dash) c.setLineDash(dash); const ux = cos(ang), uy = sin(ang); R.line(c, x - ux * L * 0.55, y - uy * L * 0.55, x + ux * L, y + uy * L); R.line(c, x + uy * L * 0.55, y - ux * L * 0.55, x - uy * L, y + ux * L); c.setLineDash([]); R.arrow(c, x + ux * (L - 12), y + uy * (L - 12), x + ux * (L + 2), y + uy * (L + 2), 8); R.arrow(c, x - uy * (L - 12), y + ux * (L - 12), x - uy * (L + 2), y + ux * (L + 2), 8); c.restore(); txt(c, labs[0], x + ux * (L + 12), y + uy * (L + 12), col, 'center', 12); txt(c, labs[1], x - uy * (L + 12), y + ux * (L + 12), col, 'center', 12); }

  /* ---------------- scene: cross-section properties ---------------- */
  function paintSection(P) {
    const { sec, P: Pr } = secInfo(), c = fitP(P.main.cv); if (!c) return; const W = P.main.cv._W, H = P.main.cv._H, V = secView(W, H, Pr, phone() ? 46 : 70); P.V = V; P.sec = sec; P.Pr = Pr;
    drawParts(c, sec, V, { labels: true });
    const cx = V.X(Pr.yS), cy = V.Y(Pr.zS), Lax = min(W, H) * 0.3;
    // inertia ellipse: semi-axis i2 along axis 1, i1 along axis 2
    const i1 = sqrt(Pr.I1 / Pr.A), i2 = sqrt(Pr.I2 / Pr.A); c.save(); c.strokeStyle = tk('plot6'); c.lineWidth = 1.5; c.beginPath(); c.ellipse(cx, cy, i2 * V.s, i1 * V.s, Pr.phi, 0, TAU); c.stroke(); c.restore();
    axesAt(c, cx, cy, Lax, 0, ['y', 'z'], tk('ink'));
    if (abs(Pr.Iyz) > 1e-6 * Pr.I1 || abs(Pr.Iy - Pr.Iz) < 1e-9 * Pr.I1) axesAt(c, cx, cy, Lax * 0.85, Pr.phi, ['1', '2'], tk('accent'), [6, 4]);
    const ph = o().sec.phi; if (abs(ph) > 1e-6) axesAt(c, cx, cy, Lax * 0.72, ph, ['η', 'ζ'], tk('warn'), [2, 3]);
    centroidMark(c, cx, cy, 'S');
    if (abs(Pr.phi) > 1e-4) { c.save(); c.strokeStyle = tk('accent'); c.lineWidth = 1.2; c.beginPath(); c.arc(cx, cy, Lax * 0.42, min(0, Pr.phi), max(0, Pr.phi)); c.stroke(); c.restore(); txt(c, `φ* = ${fmt((Pr.phi * 180) / PI, 1)}°`, cx + Lax * 0.5 * cos(Pr.phi / 2), cy + Lax * 0.5 * sin(Pr.phi / 2) + 12, tk('accent'), 'left', 11); }
    txt(c, `S (${fmt(Pr.yS, 1)}, ${fmt(Pr.zS, 1)}) mm`, 14, H - 16, tk('ink-2'), 'left', 11);
    // the circle of inertia
    mohrI(P, Pr);
  }
  function mohrI(P, Pr) {
    const c = fitP(P.side.cv); if (!c) return; const W = P.side.cv._W, H = P.side.cv._H, Rr = (Pr.I1 - Pr.I2) / 2, m = (Pr.I1 + Pr.I2) / 2;
    const span = max(Pr.I1 * 1.08, 1e-9), pad = 34, s = min((W - 2 * pad) / span, (H - 2 * pad) / max(2 * Rr * 1.15, span * 0.3)), X = (I) => pad + I * s, Y = (t) => H / 2 + t * s;
    c.strokeStyle = tk('ink-3'); c.lineWidth = 1; R.line(c, pad - 6, H / 2, W - 10, H / 2); R.line(c, pad, 18, pad, H - 18); txt(c, 'I', W - 14, H / 2 - 12, tk('ink-2'), 'center', 12); txt(c, 'I_yz', pad + 22, 20, tk('ink-2'), 'center', 11);
    c.strokeStyle = tk('accent'); c.lineWidth = 2; c.beginPath(); c.arc(X(m), Y(0), Rr * s, 0, TAU); c.stroke();
    const pt = (I, t, col, lab, dx) => { c.fillStyle = col; c.beginPath(); c.arc(X(I), Y(t), 4.5, 0, TAU); c.fill(); txt(c, lab, X(I) + (dx || 0), Y(t) - 12, col, 'center', 11); };
    c.strokeStyle = tk('ink-2'); c.lineWidth = 1.2; R.line(c, X(Pr.Iy), Y(Pr.Iyz), X(Pr.Iz), Y(-Pr.Iyz));
    pt(Pr.Iy, Pr.Iyz, tk('ink'), 'Y'); pt(Pr.Iz, -Pr.Iyz, tk('ink'), 'Z'); pt(Pr.I1, 0, tk('accent'), 'I₁', 8); pt(Pr.I2, 0, tk('accent'), 'I₂', -8);
    const ph = o().sec.phi; if (abs(ph) > 1e-6) { const tr = SO.turn(Pr, ph); c.strokeStyle = tk('warn'); R.line(c, X(tr.Ieta), Y(tr.Ietazeta), X(tr.Izeta), Y(-tr.Ietazeta)); pt(tr.Ieta, tr.Ietazeta, tk('warn'), 'η'); pt(tr.Izeta, -tr.Ietazeta, tk('warn'), 'ζ'); }
    txt(c, `I₁ = ${fg(Pr.I1 / 1e4)} cm⁴   I₂ = ${fg(Pr.I2 / 1e4)} cm⁴`, W / 2, H - 14, tk('accent'), 'center', 11);
  }

  /* ---------------- scene: bending ---------------- */
  function heat(c, key, sec, V, W, H, val, vmax) { // σ colour map of the section, cached as an offscreen bitmap
    const dpr = c.canvas._dpr || 1, k = key + `|${W}|${H}|${dpr}|${R.tok.paper}`; let img = st.cache[k];
    if (!img) { const cv = document.createElement('canvas'); cv.width = round(W * dpr); cv.height = round(H * dpr); const cx = cv.getContext('2d'), id = cx.createImageData(cv.width, cv.height), pos = rgb(tk('plot2')), neg = rgb(tk('plot1')), pa = rgb(tk('paper'));
      for (let j = 0; j < cv.height; j += 1) { const Yp = j / dpr, z = V.zw(Yp); for (let i = 0; i < cv.width; i += 1) { const Xp = i / dpr, y = V.yw(Xp); if (!inSec(sec, y, z)) continue; const v = val(y, z) / (vmax || 1), col = mix(pa, v >= 0 ? pos : neg, min(1, abs(v)) * 0.9), o2 = 4 * (j * cv.width + i); id.data[o2] = col[0]; id.data[o2 + 1] = col[1]; id.data[o2 + 2] = col[2]; id.data[o2 + 3] = 255; } }
      cx.putImageData(id, 0, 0); img = cv; st.cache = {}; st.cache[k] = img; }
    c.drawImage(img, 0, 0, W, H);
  }
  function samplePts(sec) { const pts = []; for (const p of sec.parts) { if ((p.sign || 1) < 0) continue; if (p.kind === 'rect') for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pts.push([p.y + (u * p.b) / 2, p.z + (v * p.h) / 2]); else if (p.kind === 'circle') for (let k = 0; k < 96; k++) pts.push([p.y + p.r * cos((k * TAU) / 96), p.z + p.r * sin((k * TAU) / 96)]); else pts.push(...p.pts); } return pts; }
  function paintBending(P) {
    const { sec, P: Pr } = secInfo(), b = o().bend, c = fitP(P.main.cv); if (!c) return; const W = P.main.cv._W, H = P.main.cv._H, V = secView(W, H, Pr, phone() ? 50 : 76); P.V = V; P.Pr = Pr;
    const sf = SO.sigmaFn(Pr, b.N, b.My, b.Mz), pts = samplePts(sec), sv = pts.map(([y, z]) => sf.at(y - Pr.yS, z - Pr.zS)), vmax = max(1e-9, ...sv.map(abs));
    heat(c, `bend|${JSON.stringify(o().sec)}|${b.N}|${b.My}|${b.Mz}`, sec, V, W, H, (y, z) => sf.at(y - Pr.yS, z - Pr.zS), vmax);
    drawParts(c, sec, V, { noFill: true });
    const cx = V.X(Pr.yS), cy = V.Y(Pr.zS);
    // neutral axis a + cy·y + cz·z = 0 (centroid coordinates), clipped to the canvas
    if (abs(sf.cy) + abs(sf.cz) > 1e-15) { const L2 = hypot(W, H), n = [sf.cy, sf.cz], nn = hypot(...n), d = -sf.a / nn, p0 = [(n[0] / nn) * d, (n[1] / nn) * d], t = [-n[1] / nn, n[0] / nn]; c.save(); c.strokeStyle = tk('ink'); c.lineWidth = 1.6; c.setLineDash([10, 5]); R.line(c, cx + (p0[0] - t[0] * L2) * V.s, cy + (p0[1] - t[1] * L2) * V.s, cx + (p0[0] + t[0] * L2) * V.s, cy + (p0[1] + t[1] * L2) * V.s); c.restore(); const lx = cx + p0[0] * V.s + t[0] * 0.32 * min(W, H), ly = cy + p0[1] * V.s + t[1] * 0.32 * min(W, H); if (lx > 10 && lx < W - 10 && ly > 10 && ly < H - 10) txt(c, 'n.a.', lx, ly - 12, tk('ink'), 'center', 11); }
    axesAt(c, cx, cy, min(W, H) * 0.22, 0, ['y', 'z'], tk('ink-2'));
    centroidMark(c, cx, cy, 'S');
    // moment vector (double arrow) and the extreme fibres
    const Mm = hypot(b.My, b.Mz); if (Mm > 1e-9) { const ux = b.My / Mm, uy = b.Mz / Mm, Lm = min(W, H) * 0.3; c.save(); c.strokeStyle = c.fillStyle = tk('warn'); c.lineWidth = 2.4; R.arrow(c, cx, cy, cx + ux * Lm, cy + uy * Lm, 11); R.arrow(c, cx, cy, cx + ux * (Lm - 12), cy + uy * (Lm - 12), 11); c.restore(); txt(c, `M = ${fmt(Mm, 1)} kN·m`, cx + ux * (Lm + 14) - uy * 14, cy + uy * (Lm + 14) + ux * 14, tk('warn'), 'center', 11); }
    let imax = 0, imin = 0; sv.forEach((v, i) => { if (v > sv[imax]) imax = i; if (v < sv[imin]) imin = i; });
    for (const [i, col] of [[imax, tk('plot2')], [imin, tk('plot1')]]) { const [y, z] = pts[i], x0 = V.X(y), y0 = V.Y(z); c.fillStyle = col; c.beginPath(); c.arc(x0, y0, 4.5, 0, TAU); c.fill(); txt(c, `${fmt(sv[i], 1)} MPa`, x0 + (x0 > cx ? 10 : -10), y0 + (y0 > cy ? 14 : -12), col, x0 > cx ? 'left' : 'right', 11.5); }
    P.extreme = { max: [pts[imax], sv[imax]], min: [pts[imin], sv[imin]] }; P.sf = sf;
    stressBody(P, sec, Pr, sf, vmax);
  }
  /* the stress body (Spannungskörper): the cut face seen obliquely, σ(y, z) erected along the beam axis x — tension towards
     the viewer, compression behind the face. σ is linear, so the stress surface is a plane: an affine image of the section,
     drawn with a canvas transform. */
  function stressBody(P, sec, Pr, sf, vmax) {
    const c = fitP(P.side.cv); if (!c) return; const W = P.side.cv._W, H = P.side.cv._H, ex = Pr.ext, span = max(ex.ymax - ex.ymin, ex.zmax - ex.zmin), g = (0.45 * span) / vmax;
    const th = 0.62, ph = 0.36, ct = cos(th), stt = sin(th), cp = cos(ph), sp = sin(ph), yS = Pr.yS, zS = Pr.zS;
    const pj = (y, z, x) => [y * ct + x * stt, z * cp + y * stt * sp - x * ct * sp]; // y, z from the centroid, x along the beam
    const sig = (y, z) => sf.at(y - yS, z - zS), rings = [];
    for (const p of sec.parts) { let ring = []; if (p.kind === 'rect') { for (const [u0, v0, u1, v1] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) { const n = max(1, round((abs(u1 - u0) * p.b + abs(v1 - v0) * p.h) / 2 / (span / 9))); for (let k = 0; k < n; k++) { const t = k / n; ring.push([p.y + ((u0 + (u1 - u0) * t) * p.b) / 2, p.z + ((v0 + (v1 - v0) * t) * p.h) / 2]); } } } else if (p.kind === 'circle') for (let q = 0; q < 24; q++) ring.push([p.y + p.r * cos((q * TAU) / 24), p.z + p.r * sin((q * TAU) / 24)]); else ring = p.pts.slice(); rings.push({ ring, hole: (p.sign || 1) < 0 }); }
    // fit everything into the pane
    let x0 = 1e18, x1 = -1e18, y0 = 1e18, y1 = -1e18; for (const { ring } of rings) for (const [y, z] of ring) for (const x of [0, sig(y, z) * g]) { const q = pj(y - yS, z - zS, x); x0 = min(x0, q[0]); x1 = max(x1, q[0]); y0 = min(y0, q[1]); y1 = max(y1, q[1]); }
    const pad = 34, k = min((W - 2 * pad) / max(1e-9, x1 - x0), (H - 2 * pad - 20) / max(1e-9, y1 - y0)), ox = (W - k * (x1 + x0)) / 2, oy = (H - 20 - k * (y1 + y0)) / 2;
    const S = (y, z, x) => { const q = pj(y - yS, z - zS, x); return [ox + k * q[0], oy + k * q[1]]; };
    const face = [k * ct, k * stt * sp, 0, k * cp], surf = [k * (ct + g * stt * sf.cy), k * (stt * sp - g * ct * sp * sf.cy), k * g * stt * sf.cz, k * (cp - g * ct * sp * sf.cz)];
    const tracePath = (M, half) => { c.save(); const e = M === face ? [ox, oy] : [ox + k * g * stt * sf.a, oy - k * g * ct * sp * sf.a]; c.transform(M[0], M[1], M[2], M[3], e[0], e[1]); c.translate(-yS, -zS); c.beginPath();
      for (const p of sec.parts) { if (p.kind === 'rect') c.rect(p.y - p.b / 2, p.z - p.h / 2, p.b, p.h); else if (p.kind === 'circle') { c.moveTo(p.y + p.r, p.z); c.arc(p.y, p.z, p.r, 0, TAU); } else { p.pts.forEach(([y, z], q) => (q ? c.lineTo(y, z) : c.moveTo(y, z))); c.closePath(); } }
      if (half) { // clip to σ ≷ 0: a big half-plane in section coordinates
        const B = span * 20, sq = [[-B, -B], [B, -B], [B, B], [-B, B]].map(([u, v]) => [u + yS, v + zS]), f = (pt) => half * sig(pt[0], pt[1]), poly = []; for (let q = 0; q < 4; q++) { const A = sq[q], C = sq[(q + 1) % 4], fa = f(A), fc = f(C); if (fa >= 0) poly.push(A); if ((fa >= 0) !== (fc >= 0)) { const t = fa / (fa - fc); poly.push([A[0] + (C[0] - A[0]) * t, A[1] + (C[1] - A[1]) * t]); } }
        c.restore(); return poly.length > 2 ? poly : null; }
      c.restore(); return true; };
    const halfClip = (sgn) => { c.save(); const e = [ox + k * g * stt * sf.a, oy - k * g * ct * sp * sf.a]; c.transform(surf[0], surf[1], surf[2], surf[3], e[0], e[1]); c.translate(-yS, -zS); const B = span * 20, sq = [[-B, -B], [B, -B], [B, B], [-B, B]].map(([u, v]) => [u + yS, v + zS]), f = (pt) => sgn * sig(pt[0], pt[1]), poly = []; for (let q = 0; q < 4; q++) { const A = sq[q], C = sq[(q + 1) % 4], fa = f(A), fc = f(C); if (fa >= 0) poly.push(A); if ((fa >= 0) !== (fc >= 0)) { const t = fa / (fa - fc); poly.push([A[0] + (C[0] - A[0]) * t, A[1] + (C[1] - A[1]) * t]); } } c.beginPath(); poly.forEach(([y, z], q) => (q ? c.lineTo(y, z) : c.moveTo(y, z))); c.closePath(); c.restore(); if (poly.length > 2) c.clip(); return poly.length > 2; };
    const pos = tk('plot2'), neg = tk('plot1'), arrowsFor = (sgn) => { for (const { ring } of rings) ring.forEach(([y, z]) => { const v = sig(y, z); if (sgn * v <= 0.03 * vmax) return; const a = S(y, z, 0), b = S(y, z, v * g); c.save(); c.globalAlpha = 0.75; c.strokeStyle = c.fillStyle = v > 0 ? pos : neg; c.lineWidth = 1.1; R.arrow(c, a[0], a[1], b[0], b[1], 5); c.restore(); }); };
    const surface = (sgn) => { c.save(); if (!halfClip(sgn)) { c.restore(); return; } tracePath(surf); c.globalAlpha = 0.5; c.fillStyle = sgn > 0 ? pos : neg; c.fill('evenodd'); c.globalAlpha = 1; c.strokeStyle = sgn > 0 ? pos : neg; c.lineWidth = 1.4; c.stroke(); c.restore(); };
    // back to front: compression behind the face, the face, tension in front
    surface(-1); arrowsFor(-1);
    tracePath(face); c.save(); c.globalAlpha = 0.6; c.fillStyle = tk('body'); c.fill('evenodd'); c.globalAlpha = 1; c.strokeStyle = tk('ink'); c.lineWidth = 1.4; c.stroke(); c.restore();
    if (abs(sf.cy) + abs(sf.cz) > 1e-15) { const n = [sf.cy, sf.cz], nn = hypot(...n), d = -sf.a / nn, p0 = [(n[0] / nn) * d, (n[1] / nn) * d], t = [-n[1] / nn, n[0] / nn], L2 = span * 0.75, A = S(yS + p0[0] - t[0] * L2, zS + p0[1] - t[1] * L2, 0), B = S(yS + p0[0] + t[0] * L2, zS + p0[1] + t[1] * L2, 0); c.save(); c.strokeStyle = tk('ink'); c.lineWidth = 1.3; c.setLineDash([7, 4]); R.line(c, A[0], A[1], B[0], B[1]); c.restore(); txt(c, 'n.a.', B[0] + 6, B[1], tk('ink'), 'left', 10.5); }
    const o0 = S(yS, zS, 0), oy2 = S(yS + span * 0.3, zS, 0), oz2 = S(yS, zS + span * 0.3, 0), ox2 = S(yS, zS, span * 0.35); c.save(); c.strokeStyle = c.fillStyle = tk('ink-2'); c.lineWidth = 1.1; R.arrow(c, o0[0], o0[1], oy2[0], oy2[1], 6); R.arrow(c, o0[0], o0[1], oz2[0], oz2[1], 6); c.setLineDash([3, 3]); R.line(c, o0[0], o0[1], ox2[0], ox2[1]); c.restore(); txt(c, 'y', oy2[0] + 8, oy2[1], tk('ink-2'), 'left', 11); txt(c, 'z', oz2[0], oz2[1] + 10, tk('ink-2'), 'center', 11); txt(c, 'x', ox2[0] + 8, ox2[1], tk('ink-2'), 'left', 11);
    arrowsFor(1); surface(1);
    if (P.extreme) for (const [[y, z], v] of [P.extreme.max, P.extreme.min]) { if (abs(v) < 1e-9) continue; const q = S(y, z, v * g); txt(c, `${fmt(v, 1)}`, q[0] + (v > 0 ? 8 : -8), q[1] - 8, v > 0 ? pos : neg, v > 0 ? 'left' : 'right', 11); }
    txt(c, 'σ along the beam axis: tension in front of the cut, compression behind', W / 2, H - 12, tk('ink-3'), 'center', 10);
  }

  /* ---------------- scene: shear ---------------- */
  function wallGeom(V, Pr, s) { const ax = V.X(s.ya), ay = V.Y(s.za), bx = V.X(s.yb), by = V.Y(s.zb); return { ax, ay, bx, by, ux: (bx - ax) / (s.l * V.s), uy: (by - ay) / (s.l * V.s) }; }
  function drawWalls(c, th, V, col) { c.save(); c.strokeStyle = col || tk('body-2'); c.lineCap = 'butt'; for (const s of th.segs) { const a = th.nodes[s.a], b = th.nodes[s.b]; c.lineWidth = max(2, s.t * V.s); R.line(c, V.X(a[0]), V.Y(a[1]), V.X(b[0]), V.Y(b[1])); } c.restore(); }
  function paintShear(P) {
    const { sec, P: Pr } = secInfo(), q = o().shear, c = fitP(P.main.cv); if (!c) return; const W = P.main.cv._W, H = P.main.cv._H, V = secView(W, H, Pr, phone() ? 54 : 84); P.V = V; P.Pr = Pr;
    if (sec.thin) {
      const th = sec.thin, sh = SO.shearFlow(th, q.Qy, q.Qz), scn = SO.shearCentre(th), TP = sh.TP; P.sh = sh; P.scn = scn;
      drawParts(c, sec, V, { fill: tk('panel-2') }); drawWalls(c, th, V);
      // q(s) as a diagram on each wall and arrows along it
      let qm = 1e-12; sh.segs.forEach((s, e) => { for (let k = 0; k <= 10; k++) qm = max(qm, abs(sh.flow(e, (k / 10) * s.l))); }); const hq = (min(W, H) * 0.065) / qm, cq = tk('plot1');
      const placed = [];
      sh.segs.forEach((s, e) => { const g = wallGeom(V, Pr, s), N2 = 24; let nx = -g.uy, ny = g.ux; const mxp = (g.ax + g.bx) / 2 - V.X(TP.yS), myp = (g.ay + g.by) / 2 - V.Y(TP.zS), dd = nx * mxp + ny * myp; if (dd < -2 || (abs(dd) <= 2 && (nx > 1e-9 || (abs(nx) <= 1e-9 && ny > 0)))) { nx = -nx; ny = -ny; }
        const at = (x) => [g.ax + g.ux * x * V.s, g.ay + g.uy * x * V.s], tip = (x) => { const v = abs(sh.flow(e, x)) * hq, p = at(x); return [p[0] + nx * v, p[1] + ny * v]; };
        c.save(); c.fillStyle = cq; c.globalAlpha = 0.16; c.beginPath(); c.moveTo(g.ax, g.ay); for (let k = 0; k <= N2; k++) c.lineTo(...tip((k / N2) * s.l)); c.lineTo(g.bx, g.by); c.closePath(); c.fill(); c.globalAlpha = 1; c.strokeStyle = cq; c.lineWidth = 1.3; c.beginPath(); for (let k = 0; k <= N2; k++) { const p = tip((k / N2) * s.l); k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); } c.stroke(); c.restore();
        const Lp = s.l * V.s, na = max(1, round(Lp / 26)); for (let k = 0; k < na; k++) { const x = ((k + 0.5) / na) * s.l, v = sh.flow(e, x), r = abs(v) / qm; if (r < 0.04) continue; const L2 = 6 + 13 * r, [px, py] = at(x), d = sign(v); arrow(c, px - g.ux * d * L2 / 2, py - g.uy * d * L2 / 2, px + g.ux * d * L2 / 2, py + g.uy * d * L2 / 2, tk('ink'), 1.6, 6); }
        if (P.vals !== false) { const lab = (x, inset) => { const v = abs(sh.flow(e, x)); if (v < 0.02 * qm) return; const xx = min(s.l, max(0, x + inset / V.s)), p = at(xx), o2 = abs(sh.flow(e, xx)) * hq + 11, X2 = p[0] + nx * o2, Y2 = p[1] + ny * o2, t2 = fmt(v, 1); if (placed.some((q2) => q2[2] === t2 && hypot(q2[0] - X2, q2[1] - Y2) < 60)) return; placed.push([X2, Y2, t2]); txt(c, t2, X2, Y2, cq, 'center', 10); };
          lab(0, min(14, Lp * 0.2)); lab(s.l, -min(14, Lp * 0.2)); let xm = 0, vm = 0; for (let k = 1; k < 40; k++) { const x = (k / 40) * s.l, v = abs(sh.flow(e, x)); if (v > vm) { vm = v; xm = x; } } if (vm > 1.03 * max(abs(sh.flow(e, 0)), abs(sh.flow(e, s.l)))) lab(xm, 0); } });
      // centroid, shear centre, load line
      centroidMark(c, V.X(TP.yS), V.Y(TP.zS), 'S');
      const mx = V.X(TP.yS + scn.yM), my = V.Y(TP.zS + scn.zM); c.save(); c.strokeStyle = tk('react'); c.lineWidth = 2; c.beginPath(); c.arc(mx, my, 7, 0, TAU); c.stroke(); R.line(c, mx - 11, my, mx + 11, my); R.line(c, mx, my - 11, mx, my + 11); c.restore(); txt(c, 'M', mx + 12, my - 12, tk('react'), 'left', 12);
      const yQ = TP.yS + scn.yM + q.dyQ, qx = V.X(yQ); if (abs(q.Qz) > 1e-9) { const d = sign(q.Qz); arrow(c, qx, my - d * 64, qx, my - d * 8, tk('warn'), 2.6, 11); txt(c, `Q_z = ${fmt(q.Qz, 1)} kN`, qx + 8, my - d * 70, tk('warn'), 'left', 11.5); }
      if (abs(q.Qy) > 1e-9) { const d = sign(q.Qy); arrow(c, mx - d * 70, my, mx - d * 10, my, tk('warn'), 2.6, 11); txt(c, `Q_y = ${fmt(q.Qy, 1)} kN`, mx - d * 76, my - 12, tk('warn'), 'center', 11.5); }
      if (abs(q.dyQ) > 0.5 && abs(q.Qz) > 1e-9) { const T = (-q.Qz * q.dyQ) / 1000; c.save(); c.strokeStyle = c.fillStyle = tk('load'); c.lineWidth = 2; R.moment(c, mx, my, 26, sign(-T) || 1); c.restore(); txt(c, `T = Q·e = ${fmt(abs(T), 3)} kN·m: the section twists`, mx, my + 44, tk('load'), 'center', 11); }
      txt(c, 'shear flow q [N/mm]', 14, H - 14, cq, 'left', 11);
    } else {
      drawParts(c, sec, V); const J = SO.jourawski(sec, Pr, q.Qz), tm = abs(J.max[1]) || 1; P.J = J;
      for (let k = 2; k < J.z.length - 2; k += 16) { const z = J.z[k] + Pr.zS, b = J.b[k], t = J.tau[k]; if (b <= 0 || abs(t) < 0.02 * tm) continue; const n2 = max(2, round((b * V.s) / 22)); let y0 = null; for (let i = 0; i < 400; i++) { const y = Pr.ext.ymin + Pr.yS + ((Pr.ext.ymax - Pr.ext.ymin) * i) / 400; if (inSec(sec, y, z)) { if (y0 == null) y0 = y; } } if (y0 == null) continue; for (let i = 0; i < n2; i++) { const y = y0 + (b * (i + 0.5)) / n2; if (!inSec(sec, y, z)) continue; const L2 = 3 + 14 * (abs(t) / tm), d = sign(t * q.Qz) || 1; arrow(c, V.X(y), V.Y(z) - (d * L2) / 2, V.X(y), V.Y(z) + (d * L2) / 2, tk('plot1'), 1.4, 5); } }
      centroidMark(c, V.X(Pr.yS), V.Y(Pr.zS), 'S'); txt(c, 'τ_xz(z) = Q S(z) / (I b(z))', 14, H - 14, tk('plot1'), 'left', 11);
    }
    jourPlot(P, sec, Pr, q.Qz);
  }
  function jourPlot(P, sec, Pr, Qz) {
    const c = fitP(P.side.cv); if (!c) return; const W = P.side.cv._W, H = P.side.cv._H, J = SO.jourawski(sec, Pr, Qz), ex = Pr.ext, padT = 30, sH = (H - 2 * padT) / (ex.zmax - ex.zmin), Y = (z) => padT + (z - ex.zmin) * sH, x0 = W * 0.3, tm = max(1e-9, ...J.tau.map(abs)), sx = (W * 0.55) / tm;
    c.strokeStyle = tk('ink-3'); c.lineWidth = 1; R.line(c, x0, padT - 10, x0, H - padT + 10); txt(c, 'z', x0 - 12, H - padT + 8, tk('ink-2'), 'center', 12);
    // the chord width b(z) as a silhouette on the left
    const bm = max(...J.b), sb = (W * 0.22) / bm; c.save(); c.fillStyle = tk('body'); c.beginPath(); c.moveTo(x0 - 6, Y(J.z[0])); J.z.forEach((z, i) => c.lineTo(x0 - 6 - J.b[i] * sb, Y(z))); c.lineTo(x0 - 6, Y(J.z[J.z.length - 1])); c.closePath(); c.fill(); c.restore(); txt(c, 'b(z)', x0 - 6 - bm * sb / 2, padT - 14, tk('ink-2'), 'center', 10.5);
    c.save(); c.fillStyle = tk('plot1'); c.globalAlpha = 0.18; c.beginPath(); c.moveTo(x0, Y(J.z[0])); J.z.forEach((z, i) => c.lineTo(x0 + J.tau[i] * sx, Y(z))); c.lineTo(x0, Y(J.z[J.z.length - 1])); c.closePath(); c.fill(); c.globalAlpha = 1; c.strokeStyle = tk('plot1'); c.lineWidth = 1.8; c.beginPath(); J.z.forEach((z, i) => (i ? c.lineTo(x0 + J.tau[i] * sx, Y(z)) : c.moveTo(x0 + J.tau[i] * sx, Y(z)))); c.stroke(); c.restore();
    txt(c, `τ_max = ${fmt(J.max[1], 2)} MPa`, x0 + J.max[1] * sx + 6, Y(J.max[0]), tk('plot1'), 'left', 11);
    txt(c, 'Jourawski: τ(z) = Q S(z)/(I b)', W / 2, H - 10, tk('ink-3'), 'center', 10.5);
  }

  /* ---------------- scene: torsion ---------------- */
  function paintTorsion(P) {
    const { sec, P: Pr } = secInfo(), q = o().tors, m = mat(), c = fitP(P.main.cv); if (!c) return; const W = P.main.cv._W, H = P.main.cv._H, V = secView(W, H, Pr, phone() ? 50 : 80); P.V = V; P.Pr = Pr;
    const res = torsionResult(sec, Pr); P.tres = res; const cT = tk('plot2');
    if (res.kind === 'thin') {
      drawParts(c, sec, V, { fill: tk('panel-2') }); drawWalls(c, sec.thin, V);
      const to = res.to, qm = max(1e-12, ...to.flowE.map(abs)), tOpen = max(...to.segs.map((s) => to.Gth * s.t));
      to.segs.forEach((s, e) => { const g = wallGeom(V, Pr, s), Lp = s.l * V.s, na = max(1, round(Lp / 24)), nx = -g.uy, ny = g.ux, qv = to.flowE[e];
        for (let k = 0; k < na; k++) { const x = ((k + 0.5) / na) * s.l, px = g.ax + g.ux * x * V.s, py = g.ay + g.uy * x * V.s;
          if (abs(qv) > 1e-6 * qm) { const L2 = 8 + 10 * (abs(qv) / qm), d = sign(qv); arrow(c, px - g.ux * d * L2 / 2, py - g.uy * d * L2 / 2, px + g.ux * d * L2 / 2, py + g.uy * d * L2 / 2, cT, 1.8, 6); }
          if (to.nC === 0 || abs(qv) < 1e-6 * qm) { const off = (s.t * V.s) / 2 + 5, L2 = 4 + 9 * ((to.Gth * s.t) / tOpen); for (const sd of [1, -1]) { const cx = px + nx * off * sd, cy = py + ny * off * sd; arrow(c, cx - g.ux * sd * L2 / 2, cy - g.uy * sd * L2 / 2, cx + g.ux * sd * L2 / 2, cy + g.uy * sd * L2 / 2, tk('accent'), 1.3, 5); } } } });
      txt(c, to.nC ? `closed: q = T/(2A_m) circulates (red)${to.ITo > 0.05 * to.IT ? ', open walls: τ across t (blue)' : ''}` : 'open: τ runs up one face and down the other (blue)', 14, H - 14, tk('ink-2'), 'left', 11);
    } else if (res.kind === 'circ') {
      const cx = V.X(Pr.yS), cy = V.Y(Pr.zS), Ro = res.Ro, Ri = res.Ri; heat(c, `tors-circ|${Ro}|${Ri}`, sec, V, W, H, (y, z) => hypot(y - Pr.yS, z - Pr.zS), Ro); drawParts(c, sec, V, { noFill: true });
      for (let rr = Ri > 0 ? Ri + (Ro - Ri) * 0.25 : Ro * 0.25; rr <= Ro * 1.001; rr += (Ro - (Ri || 0)) / (Ri > 0 ? 2.5 : 3.5)) { const n2 = max(6, round((TAU * rr * V.s) / 30)), L2 = 4 + 14 * (rr / Ro); for (let k = 0; k < n2; k++) { const a = (k / n2) * TAU, px = cx + rr * V.s * cos(a), py = cy + rr * V.s * sin(a), tx = -sin(a), ty = cos(a); arrow(c, px - tx * L2 / 2, py - ty * L2 / 2, px + tx * L2 / 2, py + ty * L2 / 2, tk('ink'), 1.5, 5); } }
      centroidMark(c, cx, cy, ''); txt(c, 'τ(r) = T r / I_p, tangential', 14, H - 14, tk('ink-2'), 'left', 11);
    } else if (res.kind === 'rect') {
      const p = sec.parts[0], b = min(p.b, p.h), hh = max(p.b, p.h), rot = p.b > p.h, Gt = res.Gth, tmax = res.tmax, n2 = 12, cellPx = (min(p.b, p.h) * V.s) / n2;
      heat(c, `tors-rect|${p.b}|${p.h}`, sec, V, W, H, (y, z) => { const yy = y - p.y, zz = z - p.z, [tu, tw] = rectTau(b, hh, 1, rot ? zz : yy, rot ? yy : zz); return hypot(tu, tw); }, res.tmax / Gt); drawParts(c, sec, V, { noFill: true });
      for (let i = 0; i < n2; i++) for (let j = 0; j < n2; j++) { const u = -b / 2 + (b * (i + 0.5)) / n2, w = -hh / 2 + (hh * (j + 0.5)) / n2, [tu, tw] = rectTau(b, hh, Gt, u, w), L2 = 0.9 * cellPx * (hypot(tu, tw) / tmax); if (L2 < 2) continue; const y = rot ? w : u, z = rot ? u : w, ty = rot ? tw : tu, tz = rot ? tu : tw, nn = hypot(ty, tz), px = V.X(p.y + y), py = V.Y(p.z + z); arrow(c, px - (ty / nn) * L2 / 2, py - (tz / nn) * L2 / 2, px + (ty / nn) * L2 / 2, py + (tz / nn) * L2 / 2, tk('ink'), 1.4, 5); }
      txt(c, phone() ? '|τ| shaded (Prandtl series)' : 'Saint-Venant (Prandtl series): |τ| shaded, τ_max at the middle of the long sides', 14, H - 14, tk('ink-2'), 'left', 11);
    } else { drawParts(c, sec, V); txt(c, 'Pick a shape with walls or a solid circle or rectangle', W / 2, H / 2, tk('ink-2'), 'center', 12); }
    twisted(P, sec, Pr, res, q);
    void m;
  }
  /* Prandtl series for the rectangle −b/2 < u < b/2, −h/2 < w < h/2 (b ≤ h): τ_u = ∂Φ/∂w, τ_w = −∂Φ/∂u */
  function rectTau(b, hh, Gt, u, w) { let tu = 0, tw = 0; for (let n = 1; n < 40; n += 2) { const k = (n * PI) / b, sg = (n - 1) / 2 % 2 ? -1 : 1, cc = (8 * Gt * b * b) / (PI ** 3 * n ** 3) * sg, ch = Math.cosh((k * hh) / 2); tu += cc * (-(k * Math.sinh(k * w)) / ch) * cos(k * u); tw += -cc * (1 - Math.cosh(k * w) / ch) * (-k * sin(k * u)); } return [tu, tw]; }
  function torsionResult(sec, Pr) {
    const q = o().tors, m = mat(), T = q.T;
    if (sec.key === 'circle' || sec.key === 'tube') { const Ro = sec.key === 'circle' ? sec.dims.d / 2 : sec.dims.D / 2, Ri = sec.key === 'tube' ? Ro - sec.dims.t : 0, Ip = (PI / 2) * (Ro ** 4 - Ri ** 4), tmax = (T * 1e6 * Ro) / Ip, th = (T * 1e6) / (m.G * Ip); return { kind: 'circ', Ro, Ri, IT: Ip, Ip, tmax, theta: th, phi: th * q.L }; }
    if (sec.key === 'rect') { const r = SO.rectTorsion(sec.dims.b, sec.dims.h), tmax = (T * 1e6) / r.Wt, th = (T * 1e6) / (m.G * r.IT); return { kind: 'rect', IT: r.IT, r, tmax, theta: th, phi: th * q.L, Gth: m.G * th }; }
    if (sec.thin) { const to = SO.torsion(sec.thin, T, m.G); return { kind: 'thin', to, IT: to.IT, tmax: to.tmax, theta: to.theta, phi: to.theta * q.L }; }
    return { kind: 'none' };
  }
  /* the shaft twisted: outlines of sections along the length turn by φ(x) = θ′x, in an oblique (cabinet) view with x to the
     right, z down and y going back at 30°. A small twist is enlarged to about 25°, never more, and the factor is printed. */
  function twisted(P, sec, Pr, res, q) {
    const c = fitP(P.side.cv); if (!c) return; const W = P.side.cv._W, H = P.side.cv._H; if (res.kind === 'none') return;
    const ex = Pr.ext, D0 = max(ex.ymax - ex.ymin, ex.zmax - ex.zmin), phiD = (res.phi * 180) / PI, shown = abs(phiD) < 1e-9 ? 0 : abs(phiD) >= 25 ? abs(phiD) : 25, mag = abs(phiD) > 1e-9 ? shown / abs(phiD) : 1, phiS = res.phi * mag;
    /* the free end faces the viewer (lower right), the shaft recedes up to the clamp at α = 24° */
    const k = min((H * 0.3) / D0, (W * 0.28) / D0), ca = cos(0.42), sa = sin(0.42), Ls = min(W * 0.62 - D0 * k * 0.5, (H * 0.55) / sa), xr = W * 0.5 + Ls * ca * 0.5, yr = H * 0.5 + Ls * sa * 0.5;
    const pr = (x, y, z, ang) => { const yy = y * cos(ang) - z * sin(ang), zz = y * sin(ang) + z * cos(ang); return [xr - (1 - x) * Ls * ca + yy * k, yr - (1 - x) * Ls * sa + zz * k]; };
    const rings = sec.parts.filter((p) => (p.sign || 1) > 0).map((p) => { if (p.kind === 'rect') { const r2 = []; for (const [u0, v0, u1, v1] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) for (let t = 0; t < 4; t++) r2.push([p.y + ((u0 + ((u1 - u0) * t) / 4) * p.b) / 2 - Pr.yS, p.z + ((v0 + ((v1 - v0) * t) / 4) * p.h) / 2 - Pr.zS]); return r2; } if (p.kind === 'circle') { const r = []; for (let i = 0; i < 40; i++) r.push([p.y + p.r * cos((i * TAU) / 40) - Pr.yS, p.z + p.r * sin((i * TAU) / 40) - Pr.zS]); return r; } return p.pts.map(([y, z]) => [y - Pr.yS, z - Pr.zS]); });
    const nS = 8; c.save();
    // generators: corner lines of the surface become helices
    for (const ring of rings) { const step = max(1, Math.floor(ring.length / 12)); for (let i = 0; i < ring.length; i += step) { c.strokeStyle = tk('ink-3'); c.lineWidth = 0.9; c.beginPath(); for (let j = 0; j <= 40; j++) { const x = j / 40, p = pr(x, ring[i][0], ring[i][1], phiS * x); j ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); } c.stroke(); } }
    for (let sI = 0; sI <= nS; sI++) { const x = sI / nS; for (const ring of rings) { const end = sI === 0 || sI === nS; c.strokeStyle = end ? tk('ink') : tk('ink-3'); c.lineWidth = end ? 1.6 : 0.8; if (sI === nS) { c.fillStyle = tk('body'); c.globalAlpha = 0.85; } c.beginPath(); ring.forEach(([y, z], i) => { const p = pr(x, y, z, phiS * x); i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); }); c.closePath(); if (sI === nS) { c.fill(); c.globalAlpha = 1; } c.stroke(); } }
    // a straight line drawn on the surface before twisting, to see the shear angle γ
    const r0 = rings[0], top = r0.reduce((a, p) => (p[1] < a[1] ? p : a), r0[0]); c.strokeStyle = tk('accent'); c.lineWidth = 2; c.beginPath(); for (let j = 0; j <= 40; j++) { const x = j / 40, p = pr(x, top[0], top[1], phiS * x); j ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); } c.stroke(); const a0 = pr(0, top[0], top[1], 0), a1 = pr(1, top[0], top[1], 0); c.setLineDash([4, 4]); c.lineWidth = 1; R.line(c, a0[0], a0[1], a1[0], a1[1]); c.setLineDash([]);
    c.restore();
    const e1 = pr(1, 0, 0, 0); c.save(); c.strokeStyle = c.fillStyle = tk('warn'); c.lineWidth = 2.2; R.moment(c, e1[0], e1[1], D0 * k * 0.4 + 8, -1); c.restore(); txt(c, `T = ${fmt(q.T, 2)} kN·m`, e1[0] + D0 * k * 0.4 + 14, e1[1] + D0 * k * 0.4 + 10, tk('warn'), 'left', 11);
    const b0 = pr(0, 0, 0, 0); c.save(); c.strokeStyle = tk('ink'); R.hatch(c, b0[0] - D0 * k * 0.6, b0[1] - D0 * k * 0.62, b0[0] - D0 * k * 0.6, b0[1] + D0 * k * 0.62, 1, { len: 7, gap: 6, lw: 2.4 }); c.restore();
    txt(c, `φ = θ′L = ${fg(phiD, 4)}°${abs(mag - 1) > 0.01 ? `  (drawn ${fmt(shown, 0)}°, ×${fg(mag, 3)})` : ''}`, W / 2, H - 30, tk('ink-2'), 'center', 11); txt(c, 'blue: a line that was straight along the shaft', W / 2, H - 14, tk('accent'), 'center', 10.5);
  }

  /* ---------------- scene: tension and compression ---------------- */
  function barsResult() {
    const b = o().bars, m1 = mat(), m2 = MATS[b.mat2] || MATS.alu, E1 = m1.E, a1 = m1.alpha, dT = b.dT;
    if (b.mode === 'step') { const N2 = b.F2 * 1e3, N1 = (b.F1 + b.F2) * 1e3, u1 = (N1 * b.L1) / (E1 * b.A1) + a1 * dT * b.L1, u2 = u1 + (N2 * b.L2) / (E1 * b.A2) + a1 * dT * b.L2; return { segs: [{ L: b.L1, A: b.A1, N: N1 }, { L: b.L2, A: b.A2, N: N2 }], u: [0, u1, u2], R: [-N1, 0] }; }
    if (b.mode === 'clamp') { const f1 = b.L1 / (E1 * b.A1), f2 = b.L2 / (E1 * b.A2), N1 = (b.F1 * 1e3 * f2 - a1 * dT * (b.L1 + b.L2)) / (f1 + f2), N2 = N1 - b.F1 * 1e3, u1 = N1 * f1 + a1 * dT * b.L1; return { segs: [{ L: b.L1, A: b.A1, N: N1 }, { L: b.L2, A: b.A2, N: N2 }], u: [0, u1, 0], R: [-N1, N2], f1, f2 }; }
    const k1 = 1 / (E1 * b.A1), k2 = 1 / (m2.E * b.A2), Ft = b.F1 * 1e3, N1 = (Ft * k2 + (m2.alpha - a1) * dT) / (k1 + k2), N2 = Ft - N1, u = (N1 * k1 + a1 * dT) * b.L1; return { par: true, segs: [{ L: b.L1, A: b.A1, N: N1, m: m1 }, { L: b.L1, A: b.A2, N: N2, m: m2 }], u: [0, u], k1, k2 };
  }
  function paintBars(P) {
    const b = o().bars, r = barsResult(), c = fitP(P.main.cv); if (!c) return; const W = P.main.cv._W, H = P.main.cv._H; P.br = r;
    const Ltot = r.par ? b.L1 : b.L1 + b.L2, x0 = W * 0.12, sx = (W * 0.72) / Ltot, Amax = max(b.A1, b.A2), sa = (H * (r.par ? 0.14 : 0.22)) / sqrt(Amax), cy = H * 0.48, ink = tk('ink');
    const wall = (x, sd) => { c.save(); c.strokeStyle = ink; R.hatch(c, x, cy + H * 0.25, x, cy - H * 0.25, sd, { len: 9, gap: 7, lw: 2.6 }); c.restore(); };
    if (!r.par) {
      let x = x0; r.segs.forEach((s, i) => { const hgt = sqrt(s.A) * sa, w = s.L * sx; c.fillStyle = s.N > 1e-9 ? 'rgba(200,50,43,0.18)' : s.N < -1e-9 ? 'rgba(20,88,196,0.18)' : tk('body'); c.strokeStyle = ink; c.lineWidth = 1.5; c.fillRect(x, cy - hgt / 2, w, hgt); c.strokeRect(x, cy - hgt / 2, w, hgt); txt(c, `N = ${fmt(s.N / 1e3, 1)} kN`, x + w / 2, cy - 8, ink, 'center', 11); txt(c, `A${SUBN(i + 1)} = ${b['A' + (i + 1)]} mm²`, x + w / 2, cy + 9, tk('ink-2'), 'center', 10.5); x += w; });
      wall(x0, 1); if (b.mode === 'clamp') wall(x0 + Ltot * sx, -1);
      const xj = x0 + b.L1 * sx; if (abs(b.F1) > 1e-9) { const h1 = sqrt(b.A1) * sa, h2 = sqrt(b.A2) * sa, ys = abs(h1 - h2) > 16 ? (h1 + h2) / 4 : max(h1, h2) / 2 + 12, d = sign(b.F1); for (const sd of [-1, 1]) arrow(c, xj, cy + sd * ys, xj + d * 46, cy + sd * ys, tk('warn'), 2.4, 10); txt(c, `F₁ = ${fmt(b.F1, 0)} kN (2 × F₁/2 on the shoulder)`, xj + d * 8, cy + ys + 18, tk('warn'), d > 0 ? 'left' : 'right', 11); }
      if (b.mode === 'step' && abs(b.F2) > 1e-9) { const xe = x0 + Ltot * sx; arrow(c, xe, cy, xe + sign(b.F2) * 56, cy, tk('warn'), 2.6, 11); txt(c, `F₂ = ${fmt(b.F2, 0)} kN`, xe + sign(b.F2) * 30, cy + 16, tk('warn'), 'center', 11); }
      // displaced junction and end (exaggerated)
      const um = max(1e-12, ...r.u.map(abs)), mg = (W * 0.06) / um, xs = [x0, x0 + b.L1 * sx, x0 + Ltot * sx]; r.u.forEach((u, i) => { if (!i && b.mode !== 'clamp') return; const xp = xs[i] + u * mg; c.save(); c.strokeStyle = tk('plot5'); c.lineWidth = 1.8; c.setLineDash([4, 3]); R.line(c, xp, cy - H * 0.17, xp, cy + H * 0.17); c.restore(); if (abs(u) > 1e-9) txt(c, `${fmt(u, 3)} mm`, xp, cy - H * 0.2, tk('plot5'), 'center', 10.5); });
    } else {
      const w = b.L1 * sx; r.segs.forEach((s, i) => { const hgt = sqrt(s.A) * sa, yc = cy + (i ? 1 : -1) * H * 0.12; c.fillStyle = i ? 'rgba(31,122,77,0.18)' : 'rgba(200,50,43,0.15)'; c.strokeStyle = ink; c.lineWidth = 1.5; c.fillRect(x0, yc - hgt / 2, w, hgt); c.strokeRect(x0, yc - hgt / 2, w, hgt); txt(c, `${s.m.name}: N = ${fmt(s.N / 1e3, 2)} kN, σ = ${fmt(s.N / s.A, 1)} MPa`, x0 + w / 2, yc, ink, 'center', 10.5); });
      wall(x0, 1); c.save(); c.fillStyle = tk('ink'); c.fillRect(x0 + w, cy - H * 0.22, 7, H * 0.44); c.restore(); if (abs(b.F1) > 1e-9) { arrow(c, x0 + w + 7, cy, x0 + w + 7 + sign(b.F1) * 56, cy, tk('warn'), 2.6, 11); txt(c, `F = ${fmt(b.F1, 0)} kN`, x0 + w + 40, cy - 16, tk('warn'), 'left', 11); }
    }
    if (b.dT) txt(c, `ΔT = ${fmt(b.dT, 0)} K`, W / 2, H - 16, tk('load'), 'center', 11.5);
    barDiagrams(P, r, b);
  }
  function barDiagrams(P, r, b) {
    const c = fitP(P.side.cv); if (!c) return; const W = P.side.cv._W, H = P.side.cv._H; if (r.par) { // the compatibility picture: two springs in parallel
      const N1 = r.segs[0].N, N2 = r.segs[1].N, m = max(abs(N1), abs(N2), 1e-9), bw = W * 0.18; [[N1, tk('plot2'), r.segs[0].m.name], [N2, tk('react'), r.segs[1].m.name]].forEach(([N, col, nm], i) => { const x = W * 0.3 + i * W * 0.3, hh = (abs(N) / m) * H * 0.55; c.fillStyle = col; c.globalAlpha = 0.6; c.fillRect(x - bw / 2, H * 0.75 - (N > 0 ? hh : 0), bw, hh); c.globalAlpha = 1; txt(c, `${fmt(N / 1e3, 2)} kN`, x, N > 0 ? H * 0.75 - hh - 12 : H * 0.75 - 12, col, 'center', 11); txt(c, nm, x, H * 0.75 + (N < 0 ? hh : 0) + 16, tk('ink-2'), 'center', 10.5); });
      txt(c, 'N₁ + N₂ = F, and both stretch alike', W / 2, 18, tk('ink-2'), 'center', 11); return; }
    const Ltot = b.L1 + b.L2, x0 = 50, sx = (W - 80) / Ltot, rows = [['N [kN]', r.segs.map((s) => s.N / 1e3), tk('plot3')], ['σ [MPa]', r.segs.map((s) => s.N / s.A), tk('plot2')], ['u [mm]', null, tk('plot5')]], hh = (H - 30) / 3;
    rows.forEach(([lab, vals, col], k) => { const y0 = 16 + k * hh + hh / 2; c.strokeStyle = tk('ink-3'); c.lineWidth = 1; R.line(c, x0, y0, x0 + Ltot * sx, y0); txt(c, lab, 8, y0 - hh * 0.36, col, 'left', 10.5);
      if (vals) { const m = max(1e-9, ...vals.map(abs)), sc = (hh * 0.36) / m; let x = x0; vals.forEach((v, i) => { const w = r.segs[i].L * sx; c.fillStyle = col; c.globalAlpha = 0.2; c.fillRect(x, y0 - (v > 0 ? v * sc : 0), w, abs(v) * sc); c.globalAlpha = 1; c.strokeStyle = col; c.lineWidth = 1.6; R.line(c, x, y0 - v * sc, x + w, y0 - v * sc); txt(c, fmt(v, 1), x + w / 2, y0 - v * sc - sign(v || 1) * 10, col, 'center', 10); x += w; }); }
      else { const m = max(1e-12, ...r.u.map(abs)), sc = (hh * 0.36) / m, xs = [x0, x0 + b.L1 * sx, x0 + Ltot * sx]; c.strokeStyle = col; c.lineWidth = 1.8; c.beginPath(); xs.forEach((x, i) => (i ? c.lineTo(x, y0 - r.u[i] * sc) : c.moveTo(x, y0 - r.u[i] * sc))); c.stroke(); r.u.forEach((u, i) => { if (abs(u) > 1e-12) txt(c, fmt(u, 3), xs[i], y0 - u * sc - sign(u) * 10, col, 'center', 10); }); } });
  }

  /* ---------------- scene: elastic line ---------------- */
  /* deflections in m drawn at true scale when visible; otherwise enlarged only up to ~6 % of the span (and 11 % of the height) */
  function defScale(wm, sx, spanPx, H) { const tru = wm * sx, target = min(0.06 * spanPx, 0.11 * H, 70); if (tru >= target) return target / wm; return tru > 0.25 * target ? sx : target / wm; }
  const scaleNote = (mg, sx) => { const f = mg / sx; return abs(f - 1) < 0.01 ? 'deflection to scale' : f > 1 ? `deflection drawn ×${fg(f, 3)}` : `deflection drawn ×${fg(f, 3)} (reduced)`; };
  function elasticResult() {
    const e = o().elastic, { sec, P: Pr } = secInfo(), m = mat(), EI = (m.E * Pr.Iy) * 1e-9, As = shearArea(sec, Pr), kGA = m.G * As * 1e-3, base = { L: e.L, EI, left: e.left, right: e.right, q1: e.q1, q2: e.q2, F: e.F ? [{ a: e.a, F: e.F }] : [], Mc: e.M ? [{ a: e.b, M: e.M }] : [] };
    const eb = SO.elastic(base), tm = e.timo ? SO.elastic(Object.assign({}, base, { kGA })) : null; return { eb, tm, EI, kGA, As, Pr };
  }
  function shearArea(sec, Pr) { const d = sec.dims || {}; if (sec.key === 'rect') return (5 / 6) * Pr.A; if (sec.key === 'circle') return 0.9 * Pr.A; if (sec.key === 'tube' || sec.key === 'slit') return 0.5 * Pr.A; if (sec.key === 'I' || sec.key === 'C') return (d.h - 2 * d.tf) * d.tw; if (sec.key === 'T') return (d.h - d.tf) * d.tw; if (sec.key === 'Z') return (d.h - 2 * d.t) * d.t; if (sec.key === 'box') return 2 * (d.h - 2 * d.tf) * d.tw; if (sec.key === 'box2') return 3 * (d.h - 2 * d.t) * d.t; return 0.5 * Pr.A; }
  function supportGlyph(c, x, y, type, left) { const z = 12; c.save(); c.strokeStyle = tk('ink'); c.fillStyle = tk('paper'); c.lineWidth = 1.6;
    if (type === 'fixed') { R.hatch(c, x, y + 1.7 * z, x, y - 1.7 * z, left ? 1 : -1, { len: 7, gap: 6, lw: 2.6 }); }
    else if (type === 'pin') { c.beginPath(); c.moveTo(x, y); c.lineTo(x - z, y + 1.6 * z); c.lineTo(x + z, y + 1.6 * z); c.closePath(); c.fill(); c.stroke(); R.hatch(c, x - 1.5 * z, y + 1.6 * z, x + 1.5 * z, y + 1.6 * z, 1, { len: 6, gap: 5.5, lw: 1.8 }); R.ring(c, x, y, 3.5, tk('paper')); }
    else if (type === 'guided') { const sd = left ? 1 : -1; c.lineWidth = 2.6; R.line(c, x, y - 1.3 * z, x, y + 1.3 * z); c.lineWidth = 1.4; R.ring(c, x - sd * 5, y - 0.7 * z, 3, tk('paper')); R.ring(c, x - sd * 5, y + 0.7 * z, 3, tk('paper')); R.hatch(c, x - sd * 9, y + 1.6 * z, x - sd * 9, y - 1.6 * z, sd, { len: 6, gap: 5.5, lw: 1.8 }); }
    c.restore(); }
  function paintElastic(P) {
    const e = o().elastic, res = elasticResult(), c = fitP(P.main.cv); if (!c) return; const W = P.main.cv._W, H = P.main.cv._H; P.er = res;
    const x0 = W * 0.12, x1 = W * 0.88, sx = (x1 - x0) / e.L, yb = H * 0.42, X = (x) => x0 + x * sx;
    if (res.eb.err) { txt(c, res.eb.err, W / 2, H / 2, tk('load'), 'center', 12); return; }
    // loads
    const qm = max(abs(e.q1), abs(e.q2)); if (qm > 1e-9) { const n = 16, top = []; c.save(); c.strokeStyle = c.fillStyle = tk('ink'); c.lineWidth = 1.2; for (let k = 0; k <= n; k++) { const x = (k / n) * e.L, q = e.q1 + ((e.q2 - e.q1) * x) / e.L, hq = (q / qm) * 30; top.push([X(x), yb - 4 - hq]); if (abs(hq) > 4) R.arrow(c, X(x), yb - 4 - hq, X(x), yb - 4, 6); } c.beginPath(); top.forEach((p, k) => (k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke(); c.restore(); txt(c, `q = ${fmt(e.q1, 1)}${e.q2 !== e.q1 ? '…' + fmt(e.q2, 1) : ''} kN/m`, X(e.L / 2), yb - 48, tk('ink'), 'center', 11); }
    if (e.F) { const xa = X(e.a); arrow(c, xa, yb - 80, xa, yb - 6, tk('ink'), 2.4, 10); txt(c, `F = ${fmt(e.F, 1)} kN`, xa + 8, yb - 82, tk('ink'), 'left', 11); }
    if (e.M) { c.save(); c.strokeStyle = c.fillStyle = tk('ink'); c.lineWidth = 2; R.moment(c, X(e.b), yb, 18, -e.M); c.restore(); txt(c, `M = ${fmt(e.M, 1)} kN·m`, X(e.b) + 22, yb + 26, tk('ink'), 'left', 11); }
    // the undeformed axis (dashed), supports, and the bent beam itself (w downwards) at a moderate, labelled scale
    const wm = max(1e-12, ...res.eb.w.map(abs), ...(res.tm ? res.tm.w.map(abs) : [])), mg = defScale(wm, sx, x1 - x0, H);
    c.save(); c.strokeStyle = tk('ink-3'); c.lineWidth = 1.2; c.setLineDash([6, 4]); R.line(c, X(0), yb, X(e.L), yb); c.restore();
    supportGlyph(c, X(0), yb, e.left, true); supportGlyph(c, X(e.L), yb, e.right, false);
    /* by default the beam is drawn straight and its deflection as the curve w(x) on an axis of its own below it; the switch on the picture bends the beam itself */
    const bent = !!o().bent, yw = bent ? yb : yb + min(H * 0.24, 110), line = (r2, col, lw, dash) => { c.save(); c.strokeStyle = col; c.lineWidth = lw; if (dash) c.setLineDash(dash); c.beginPath(); r2.x.forEach((x, i) => (i % 4 && i !== r2.x.length - 1 ? 0 : i ? c.lineTo(X(x), yw + r2.w[i] * mg) : c.moveTo(X(x), yw + r2.w[i] * mg))); c.stroke(); c.restore(); };
    if (!bent) { c.save(); c.strokeStyle = tk('ink'); c.lineWidth = 4.5; R.line(c, X(0), yb, X(e.L), yb); c.strokeStyle = tk('ink-3'); c.lineWidth = 1; c.setLineDash([3, 4]); R.line(c, X(0), yw, X(e.L), yw); R.line(c, X(0), yb, X(0), yw); R.line(c, X(e.L), yb, X(e.L), yw); c.restore(); txt(c, 'w(x)', X(0) - 8, yw, tk('plot5'), 'right', 13); }
    line(res.eb, bent ? tk('ink') : tk('plot5'), bent ? 4.5 : 2.4); if (res.tm) line(res.tm, tk('plot4'), 2, [7, 4]);
    const wmx = res.eb.wmax; txt(c, `w_max = ${fmt(wmx[1] * 1000, 3)} mm at x = ${fmt(wmx[0], 2)} m`, X(wmx[0]), yw + wmx[1] * mg + (wmx[1] >= 0 ? 22 : -22), tk('plot5'), 'center', 11);
    if (res.tm) txt(c, `Timoshenko ${fmt(res.tm.wmax[1] * 1000, 3)} mm (+${fmt(100 * (res.tm.wmax[1] / wmx[1] - 1), 2)} % shear, dashed)`, X(res.tm.wmax[0]), yw + res.tm.wmax[1] * mg + (wmx[1] >= 0 ? 38 : -38), tk('plot4'), 'center', 11);
    txt(c, (bent ? '' : 'the curve w(x): ') + scaleNote(mg, sx), W - 14, H - 14, tk('ink-3'), 'right', 10.5);
    elasticDiagrams(P, res, e);
  }
  function elasticDiagrams(P, res, e) {
    const c = fitP(P.side.cv); if (!c) return; const W = P.side.cv._W, H = P.side.cv._H, r = res.eb, x0 = 52, sx = (W - 70) / e.L, rows = [['q', null, tk('ink')], ['Q', r.Q, tk('plot1')], ['M', r.M, tk('plot2')], ['φ', r.phi, tk('plot3')], ['w', r.w, tk('plot5')]], hh = (H - 36) / rows.length;
    rows.forEach(([lab, arr, col], k) => { const y0 = 10 + k * hh + hh / 2; c.strokeStyle = tk('ink-3'); c.lineWidth = 1; R.line(c, x0, y0, x0 + e.L * sx, y0); txt(c, lab, 16, y0, col, 'center', 13);
      const vals = arr || r.x.map((x) => e.q1 + ((e.q2 - e.q1) * x) / e.L), m = max(1e-12, ...vals.map(abs)), sc = (hh * 0.38) / m, down = lab === 'w' || lab === 'q' || lab === 'M';
      c.save(); c.fillStyle = col; c.globalAlpha = 0.15; c.beginPath(); c.moveTo(x0, y0); r.x.forEach((x, i) => { if (i % 3 && i !== r.x.length - 1) return; c.lineTo(x0 + x * sx, y0 + (down ? 1 : -1) * vals[i] * sc); }); c.lineTo(x0 + e.L * sx, y0); c.closePath(); c.fill(); c.globalAlpha = 1; c.strokeStyle = col; c.lineWidth = 1.6; c.beginPath(); r.x.forEach((x, i) => { if (i % 3 && i !== r.x.length - 1) return; const y = y0 + (down ? 1 : -1) * vals[i] * sc; i ? c.lineTo(x0 + x * sx, y) : c.moveTo(x0 + x * sx, y); }); c.stroke(); c.restore();
      let im = 0; vals.forEach((v, i) => { if (abs(v) > abs(vals[im])) im = i; }); if (abs(vals[im]) > 1e-12) { const f = lab === 'w' ? 1000 : lab === 'φ' ? 1000 : 1; txt(c, fmt(vals[im] * f, lab === 'w' || lab === 'φ' ? 3 : 2), x0 + r.x[im] * sx, y0 + (down ? 1 : -1) * vals[im] * sc + (down ? 1 : -1) * sign(vals[im]) * 11, col, 'center', 10); } });
    txt(c, 'q → Q → M → φ → w: four integrations', W / 2, H - 6, tk('ink-3'), 'center', 10, 'bottom');
  }

  /* ---------------- scene: the beam with a moving cut (side view and the cross-section at x) ---------------- */
  const interp = (xs, arr, x) => { let lo = 0, hi = xs.length - 1; if (x <= xs[0]) return arr[0]; if (x >= xs[hi]) return arr[hi]; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; } const t = (x - xs[lo]) / (xs[hi] - xs[lo] || 1); return arr[lo] + (arr[hi] - arr[lo]) * t; };
  function beamCut() { const e = o().elastic, B = o().beam, res = elasticResult(); B.x = min(e.L, max(0, B.x)); if (res.eb.err) return { err: res.eb.err, res };
    const r = res.eb, x = B.x, Q = interp(r.x, r.Q, x), M = interp(r.x, r.M, x), w = interp(r.x, r.w, x), phi = interp(r.x, r.phi, x), Pr = res.Pr, sec = getSec();
    const key = JSON.stringify(o().sec), J1 = st.j1 && st.j1.key === key ? st.j1.J : (st.j1 = { key, J: SO.jourawski(sec, Pr, 1) }).J, sf = SO.sigmaFn(Pr, 0, M, 0);
    const zt = Pr.ext.zmin, zb = Pr.ext.zmax, sTop = sf.at(0, zt), sBot = sf.at(0, zb), tmax = J1.max[1] * Q;
    return { res, r, x, Q, M, w, phi, Pr, sec, J1, sf, zt, zb, sTop, sBot, tmax }; }
  function paintBeam(P) {
    const e = o().elastic, B = o().beam, c = fitP(P.main.cv); if (!c) return; const W = P.main.cv._W, H = P.main.cv._H;
    if (B.anim) { st.bmT = (st.bmT || 0) + st.dtF; B.x = e.L * (0.5 - 0.5 * cos(st.bmT * 0.55)); if (performance.now() - (st.bmUp || 0) > 220) { st.bmUp = performance.now(); refreshCut(); } }
    const K0 = beamCut(); if (K0.err) { txt(c, K0.err, W / 2, H / 2, tk('load'), 'center', 12); return; } const { r, Pr } = K0;
    const x0 = W * 0.09, x1 = W * 0.91, sx = (x1 - x0) / e.L, X = (x) => x0 + x * sx, yb = H * 0.24; P.bx = { x0, sx, L: e.L };
    const hs = Pr.ext.zmax - Pr.ext.zmin, hpx = max(8, min(26, (hs / 1000) * sx));
    // loads
    const qm = max(abs(e.q1), abs(e.q2)); if (qm > 1e-9) { const n = 16, top = []; c.save(); c.strokeStyle = c.fillStyle = tk('ink-2'); c.lineWidth = 1.1; for (let k = 0; k <= n; k++) { const x = (k / n) * e.L, q = e.q1 + ((e.q2 - e.q1) * x) / e.L, hq = (q / qm) * 26; top.push([X(x), yb - hpx / 2 - 3 - hq]); if (abs(hq) > 4) R.arrow(c, X(x), yb - hpx / 2 - 3 - hq, X(x), yb - hpx / 2 - 3, 6); } c.beginPath(); top.forEach((p, k) => (k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke(); c.restore(); txt(c, `q = ${fmt(e.q1, 1)}${e.q2 !== e.q1 ? '…' + fmt(e.q2, 1) : ''} kN/m`, X(e.L * 0.3), yb - hpx / 2 - 42, tk('ink-2'), 'center', 11); }
    if (e.F) { const xa = X(e.a), d = sign(e.F); arrow(c, xa, yb - d * (hpx / 2 + 62), xa, yb - d * (hpx / 2 + 4), tk('ink'), 2.4, 10); txt(c, `F = ${fmt(e.F, 1)} kN`, xa + 8, yb - d * (hpx / 2 + 64), tk('ink'), 'left', 11); }
    if (e.M) { c.save(); c.strokeStyle = c.fillStyle = tk('ink'); c.lineWidth = 2; R.moment(c, X(e.b), yb, 18, -e.M); c.restore(); txt(c, `M = ${fmt(e.M, 1)} kN·m`, X(e.b) + 22, yb + 30, tk('ink'), 'left', 11); }
    // the beam as a band that bends (moderate, labelled scale), split at the cut to show the internal forces on both faces
    const wm = max(1e-12, ...r.w.map(abs)), bent = !!o().bent, mg = bent ? defScale(wm, sx, x1 - x0, H * 0.7) : 0, xc = K0.x, gap = 7;
    c.save(); c.strokeStyle = tk('ink-3'); c.lineWidth = 1; c.setLineDash([5, 4]); c.strokeRect(X(0), yb - hpx / 2, e.L * sx, hpx); c.restore();
    const band = (xa, xb) => { const pts = []; for (let i = 0; i < r.x.length; i += 3) if (r.x[i] >= xa && r.x[i] <= xb) pts.push(r.x[i]); pts.unshift(xa); pts.push(xb); c.beginPath(); pts.forEach((x, k) => { const Y = yb + interp(r.x, r.w, x) * mg - hpx / 2; k ? c.lineTo(X(x), Y) : c.moveTo(X(x), Y); }); for (let k = pts.length - 1; k >= 0; k--) c.lineTo(X(pts[k]), yb + interp(r.x, r.w, pts[k]) * mg + hpx / 2); c.closePath(); c.fillStyle = tk('body'); c.fill(); c.strokeStyle = tk('ink'); c.lineWidth = 1.5; c.stroke(); };
    const g2 = gap / 2 / sx; if (xc > g2 * 2) band(0, xc - g2); if (xc < e.L - g2 * 2) band(xc + g2, e.L);
    supportGlyph(c, X(0), yb + hpx / 2 * 0, e.left, true); supportGlyph(c, X(e.L), yb, e.right, false);
    // internal forces on the two faces: positive face (left part) Q down, M counter-clockwise when positive; the other face opposite
    const yc = yb + K0.w * mg, Xc = X(xc), Qs = abs(K0.Q) > 1e-9, Ms = abs(K0.M) > 1e-9;
    if (Qs) { const d = sign(K0.Q); arrow(c, Xc - gap / 2 - 3, yc - d * 26, Xc - gap / 2 - 3, yc + d * 26, tk('plot1'), 2, 8); arrow(c, Xc + gap / 2 + 3, yc + d * 26, Xc + gap / 2 + 3, yc - d * 26, tk('plot1'), 2, 8); }
    if (Ms) { c.save(); c.strokeStyle = c.fillStyle = tk('plot2'); c.lineWidth = 1.8; R.moment(c, Xc - gap / 2 - 2, yc, 15, sign(K0.M)); R.moment(c, Xc + gap / 2 + 2, yc, 15, -sign(K0.M)); c.restore(); }
    // diagrams Q(x) and M(x) under the beam, aligned with it
    const strip = (arr, y0, hh, col, lab, unit, down) => { const m = max(1e-12, ...arr.map(abs)), sc = hh / m; c.strokeStyle = tk('ink-3'); c.lineWidth = 1; R.line(c, X(0), y0, X(e.L), y0); txt(c, lab, X(0) - 8, y0, col, 'right', 13);
      c.save(); c.fillStyle = col; c.globalAlpha = 0.15; c.beginPath(); c.moveTo(X(0), y0); r.x.forEach((x, i) => { if (i % 3 && i !== r.x.length - 1) return; c.lineTo(X(x), y0 + (down ? 1 : -1) * arr[i] * sc); }); c.lineTo(X(e.L), y0); c.closePath(); c.fill(); c.globalAlpha = 1; c.strokeStyle = col; c.lineWidth = 1.7; c.beginPath(); r.x.forEach((x, i) => { if (i % 3 && i !== r.x.length - 1) return; const y = y0 + (down ? 1 : -1) * arr[i] * sc; i ? c.lineTo(X(x), y) : c.moveTo(X(x), y); }); c.stroke(); c.restore();
      let im = 0; arr.forEach((v, i) => { if (abs(v) > abs(arr[im])) im = i; }); if (abs(arr[im]) > 1e-9 && abs(X(r.x[im]) - X(K0.x)) > 70) txt(c, `${fmt(arr[im], 2)} ${unit}`, X(r.x[im]), y0 + (down ? 1 : -1) * arr[im] * sc + (down ? 1 : -1) * sign(arr[im]) * 11, col, 'center', 10);
      const v = interp(r.x, arr, xc); c.fillStyle = col; c.beginPath(); c.arc(Xc, y0 + (down ? 1 : -1) * v * sc, 4.5, 0, TAU); c.fill(); return [y0, v]; };
    const hh = H * (bent ? 0.1 : 0.07), [yQ] = strip(r.Q, H * (bent ? 0.52 : 0.5), hh, tk('plot1'), 'Q', 'kN', false), [yM] = strip(r.M, H * (bent ? 0.8 : 0.66), hh, tk('plot2'), 'M', 'kN·m', true); if (!bent) strip(r.w.map((v) => v * 1000), H * 0.84, hh, tk('plot5'), 'w', 'mm', true);
    // the cut line and its handle
    const yh = max(22, yb - hpx / 2 - 84); c.save(); c.strokeStyle = tk('accent'); c.lineWidth = 1.4; c.setLineDash([6, 4]); R.line(c, Xc, yh, Xc, H - 20); c.restore();
    c.fillStyle = tk('accent'); c.beginPath(); c.arc(Xc, yh, 7, 0, TAU); c.fill(); txt(c, `cut x = ${fmt(xc, 2)} m`, Xc, yh - 15, tk('accent'), 'center', 11.5);
    txt(c, `Q = ${fmt(K0.Q, 2)} kN`, Xc + 10, yQ - hh - 6, tk('plot1'), 'left', 11); txt(c, `M = ${fmt(K0.M, 2)} kN·m`, Xc + 10, yM + hh + 10, tk('plot2'), 'left', 11);
    const narrow = W < 600; txt(c, `${bent ? scaleNote(mg, sx) + ' · ' : ''}w(x) = ${fmt(K0.w * 1000, 3)} mm`, narrow ? 12 : W - 12, H - 10, tk('ink-3'), narrow ? 'left' : 'right', 10.5); txt(c, 'drag along the beam to move the cut', 12, narrow ? H - 25 : H - 10, tk('ink-3'), 'left', 10.5);
    beamSection(P, K0);
  }
  /* the cross-section at the cut, seen along the beam axis: σ coloured, σ(z) on the right, τ(z) (Jourawski) on the left;
     thin walls also get their shear-flow arrows */
  function beamSection(P, K0) {
    const c = fitP(P.side.cv); if (!c) return; const W = P.side.cv._W, H = P.side.cv._H, { Pr, sec, sf, J1, Q, M } = K0, ex = Pr.ext, w = ex.ymax - ex.ymin, hh0 = ex.zmax - ex.zmin;
    const top = 58, hs = H - top - 64, ws = W * 0.36, s = min(ws / w, hs / hh0), cx = W * 0.5, cy = top + hs / 2, V = { s, X: (y) => cx + (y - Pr.yS - (ex.ymin + ex.ymax) / 2) * s, Y: (z) => cy + (z - Pr.zS - (ex.zmin + ex.zmax) / 2) * s, yw: (Xp) => (Xp - cx) / s + Pr.yS + (ex.ymin + ex.ymax) / 2, zw: (Yp) => (Yp - cy) / s + Pr.zS + (ex.zmin + ex.zmax) / 2 };
    const unit = SO.sigmaFn(Pr, 0, 1, 0), pts = samplePts(sec), um = max(1e-12, ...pts.map(([y, z]) => abs(unit.at(y - Pr.yS, z - Pr.zS)))), sg = abs(M) < 1e-9 ? 0 : sign(M);
    if (sg) heat(c, `beam|${JSON.stringify(o().sec)}|${sg}|${round(W)}x${round(H)}`, sec, V, W, H, (y, z) => sg * unit.at(y - Pr.yS, z - Pr.zS), um);
    drawParts(c, sec, V, { noFill: !!sg });
    const yS = V.Y(Pr.zS), X0 = V.X(Pr.yS); c.save(); c.strokeStyle = tk('ink'); c.lineWidth = 1.3; c.setLineDash([8, 4]); R.line(c, V.X(Pr.yS + ex.ymin) - 16, yS, V.X(Pr.yS + ex.ymax) + 16, yS); c.restore(); txt(c, 'n.a.', V.X(Pr.yS + ex.ymax) + 20, yS, tk('ink'), 'left', 10.5); centroidMark(c, X0, yS, '');
    if (sec.thin && abs(Q) > 1e-9) { const sh = SO.shearFlow(sec.thin, 0, Q); let qm = 1e-12; sh.segs.forEach((s2, e) => { for (let k = 0; k <= 10; k++) qm = max(qm, abs(sh.flow(e, (k / 10) * s2.l))); }); sh.segs.forEach((s2, e) => { const g = wallGeom(V, Pr, s2), Lp = s2.l * V.s, na = max(1, round(Lp / 24)); for (let k = 0; k < na; k++) { const x = ((k + 0.5) / na) * s2.l, v = sh.flow(e, x), rr = abs(v) / qm; if (rr < 0.05) continue; const L2 = 5 + 11 * rr, px = g.ax + g.ux * x * V.s, py = g.ay + g.uy * x * V.s, d = sign(v); arrow(c, px - g.ux * d * L2 / 2, py - g.uy * d * L2 / 2, px + g.ux * d * L2 / 2, py + g.uy * d * L2 / 2, tk('ink'), 1.4, 5); } }); }
    // σ(z) on the right: linear, arrows to the right for tension
    const zs = [], N2 = 9; for (let k = 0; k <= N2; k++) zs.push(ex.zmin + ((ex.zmax - ex.zmin) * k) / N2);
    const xs = V.X(Pr.yS + ex.ymax) + W * 0.1, smax = max(1e-9, abs(K0.sTop), abs(K0.sBot)), ks = (W * 0.13) / smax, cP = tk('plot2'), cN = tk('plot1');
    c.strokeStyle = tk('ink-3'); c.lineWidth = 1; R.line(c, xs, V.Y(Pr.zS + ex.zmin) - 8, xs, V.Y(Pr.zS + ex.zmax) + 8);
    c.save(); c.globalAlpha = 0.18; c.fillStyle = cP; c.beginPath(); c.moveTo(xs, V.Y(Pr.zS + ex.zmin)); c.lineTo(xs + K0.sTop * ks, V.Y(Pr.zS + ex.zmin)); c.lineTo(xs + K0.sBot * ks, V.Y(Pr.zS + ex.zmax)); c.lineTo(xs, V.Y(Pr.zS + ex.zmax)); c.closePath(); c.fill(); c.restore();
    for (const z of zs) { const v = sf.at(0, z); if (abs(v) < 0.04 * smax) continue; arrow(c, xs, V.Y(Pr.zS + z), xs + v * ks, V.Y(Pr.zS + z), v > 0 ? cP : cN, 1.5, 6); }
    c.strokeStyle = tk('ink-2'); c.lineWidth = 1.4; R.line(c, xs + K0.sTop * ks, V.Y(Pr.zS + ex.zmin), xs + K0.sBot * ks, V.Y(Pr.zS + ex.zmax));
    txt(c, `${fmt(K0.sTop, 1)} MPa`, xs + K0.sTop * ks + (K0.sTop >= 0 ? 6 : -6), V.Y(Pr.zS + ex.zmin) - 10, K0.sTop >= 0 ? cP : cN, K0.sTop >= 0 ? 'left' : 'right', 11); txt(c, `${fmt(K0.sBot, 1)} MPa`, xs + K0.sBot * ks + (K0.sBot >= 0 ? 6 : -6), V.Y(Pr.zS + ex.zmax) + 12, K0.sBot >= 0 ? cP : cN, K0.sBot >= 0 ? 'left' : 'right', 11); txt(c, 'σ(z)', xs, V.Y(Pr.zS + ex.zmin) - 26, tk('ink-2'), 'center', 11.5);
    // τ(z) on the left (Jourawski), scaled with Q
    const xt = V.X(Pr.yS + ex.ymin) - W * 0.1, tm = max(1e-9, ...J1.tau.map(abs)) * abs(Q), kt = tm > 1e-9 ? (W * 0.12) / tm : 0, cT = tk('plot4');
    c.strokeStyle = tk('ink-3'); c.lineWidth = 1; R.line(c, xt, V.Y(Pr.zS + ex.zmin) - 8, xt, V.Y(Pr.zS + ex.zmax) + 8);
    if (tm > 1e-9) { c.save(); c.globalAlpha = 0.18; c.fillStyle = cT; c.beginPath(); c.moveTo(xt, V.Y(Pr.zS + J1.z[0])); J1.z.forEach((z, i) => c.lineTo(xt - abs(J1.tau[i] * Q) * kt, V.Y(Pr.zS + z))); c.lineTo(xt, V.Y(Pr.zS + J1.z[J1.z.length - 1])); c.closePath(); c.fill(); c.globalAlpha = 1; c.strokeStyle = cT; c.lineWidth = 1.6; c.beginPath(); J1.z.forEach((z, i) => { const p = [xt - abs(J1.tau[i] * Q) * kt, V.Y(Pr.zS + z)]; i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); }); c.stroke(); c.restore();
      for (let k = 1; k < 10; k++) { const i = round((k / 10) * (J1.z.length - 1)), t = J1.tau[i] * Q; if (abs(t) < 0.05 * tm) continue; const yy = V.Y(Pr.zS + J1.z[i]), d = sign(t); arrow(c, xt - abs(t) * kt * 0.5, yy - d * 6, xt - abs(t) * kt * 0.5, yy + d * 6, cT, 1.4, 5); }
      txt(c, `τ_max = ${fmt(abs(K0.tmax), 2)} MPa`, xt - abs(J1.max[1] * Q) * kt - 6, V.Y(Pr.zS + J1.max[0]) - 14, cT, 'right', 11); }
    txt(c, 'τ(z)', xt, V.Y(Pr.zS + ex.zmin) - 26, tk('ink-2'), 'center', 11.5);
    txt(c, `section at x = ${fmt(K0.x, 2)} m`, W / 2, 16, tk('ink'), 'center', 12.5); txt(c, `M = ${fmt(M, 2)} kN·m · Q = ${fmt(Q, 2)} kN`, W / 2, 34, tk('ink-2'), 'center', 11.5);
    // probe under the pointer
    if (P.probe) { const [px, py] = P.probe, y = V.yw(px), z = V.zw(py); if (inSec(sec, y, z)) { const sv = sf.at(y - Pr.yS, z - Pr.zS), tv = interp(J1.z, J1.tau, z - Pr.zS) * Q; c.save(); c.strokeStyle = tk('ink'); c.lineWidth = 1; R.line(c, px - 6, py, px + 6, py); R.line(c, px, py - 6, px, py + 6); c.restore(); txt(c, `y ${fmt(y - Pr.yS, 1)}, z ${fmt(z - Pr.zS, 1)} mm: σ = ${fmt(sv, 2)} MPa, τ ≈ ${fmt(tv, 2)} MPa`, px, py - 16, tk('ink'), 'center', 11); } }
    txt(c, 'σ = M z / I_y (colour), τ = Q S / (I_y b)', W / 2, H - 12, tk('ink-3'), 'center', 10.5);
  }
  function cutKids() { const K0 = beamCut(); if (K0.err) return [h('p', { class: 'note', style: 'color:var(--load)' }, K0.err)]; const { Pr } = K0, I = Pr.Iy, z1 = K0.zt, z2 = K0.zb, i0 = K0.J1.z.findIndex((z) => z >= 0);
    return [tex([`Q(${fT(K0.x, 2)}) &= ${fT(K0.Q, 3)}${U('kN')}, \\qquad M(${fT(K0.x, 2)}) = ${fT(K0.M, 3)}${U('kN\\,m')}`, `w &= ${fT(K0.w * 1000, 3)}${U('mm')}, \\qquad \\varphi = ${fT(K0.phi * 1000, 3)}${U('mrad')}`]),
      tex([`\\sigma(z) &= \\frac{M}{I_y}\\,z = \\frac{${fT(K0.M, 3)}\\cdot 10^6}{${nT(I)}}\\,z = ${nT((K0.M * 1e6) / I)}\\,z${U('MPa')}`, `\\sigma_{\\text{top}} &= ${nT((K0.M * 1e6) / I)}\\cdot(${fT(z1, 1)}) = \\mathbf{${fT(K0.sTop, 2)}}${U('MPa')}`, `\\sigma_{\\text{bottom}} &= ${nT((K0.M * 1e6) / I)}\\cdot ${fT(z2, 1)} = \\mathbf{${fT(K0.sBot, 2)}}${U('MPa')}`], true),
      tex([`\\tau(0) &= \\frac{Q\\,S(0)}{I_y\\,b(0)} = \\frac{${fT(K0.Q, 3)}\\cdot 10^3\\cdot ${nT(K0.J1.S[i0])}}{${nT(I)}\\cdot ${fT(K0.J1.b[i0], 1)}} = ${fT(K0.J1.tau[i0] * K0.Q, 3)}${U('MPa')}`, `\\tau_{\\max} = \\mathbf{${fT(abs(K0.tmax), 3)}}${U('MPa')}`], true),
      Pr.Iyz && abs(Pr.Iyz) > 1e-6 * Pr.I1 ? txl('$I_{yz} \\ne 0$: this section also bends sideways (the colour map uses the full oblique formula).') : null]; }
  function refreshCut() { const el = document.getElementById('som-cut'); if (!el) return; el.replaceChildren(...cutKids().filter(Boolean)); }
  function beamCard() { const B = o().beam, e = o().elastic;
    return card('Cut', 'beam-ode', slider({ k: 'bx', l: 'cut at x [m]', min: 0, max: e.L, step: 0.01 }, () => B.x, (v) => { B.x = v; B.anim = false; }),
      h('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' }, F.btn(B.anim ? 'Stop the sweep' : 'Sweep the cut along the beam', () => { B.anim = !B.anim; st.bmT = Math.acos(max(-1, min(1, 1 - (2 * B.x) / (e.L || 1)))) / 0.55; save(); rebuild(); }, B.anim ? '' : 'primary', B.anim ? 'i-pause' : 'i-play')),
      h('p', { class: 'note' }, 'Drag on the side view to move the cut; hover the section to read σ and τ at a point.')); }

  /* ---------------- scene: energy methods ---------------- */
  function energyResult() { const e = o().energy, { P: Pr } = secInfo(), m = mat(), EI = m.E * Pr.Iy * 1e-9, EA = m.E * Pr.A * 1e-3, kGA = m.G * shearArea(secInfo().sec, Pr) * 1e-3; if (e.mode === 'arc') return { mode: 'arc', EI, EA, kGA, r: SO.quarterArc({ R: e.R, EI, EA: e.N ? EA : 0, kGA: e.Q ? kGA : 0, F: e.F, H: 0 }), rb: SO.quarterArc({ R: e.R, EI, EA: 0, kGA: 0, F: e.F, H: 0 }) }; return { mode: 'ring', EI, r: SO.ring({ R: e.R, EI, F: e.F }) }; }
  function paintEnergy(P) {
    const e = o().energy, res = energyResult(), c = fitP(P.main.cv); if (!c) return; const W = P.main.cv._W, H = P.main.cv._H; P.enr = res; const s = e.mode === 'arc' ? min((W - 70) / 1.62, H * 0.6) : min(W, H) * 0.3, cM = tk('plot2');
    if (e.mode === 'arc') { const cx = max(150, W - 24 - s * 1.27), cy = H * 0.5 + s * 0.42, P2 = (ph) => [cx + s * sin(ph), cy - s * cos(ph)];
      // bar, clamp at φ = π/2 (right end), force at the free end (top)
      const Mf = (ph) => e.F * e.R * sin(ph), mmax = e.F * e.R, sc = (s * 0.22) / (mmax || 1);
      c.save(); c.fillStyle = cM; c.globalAlpha = 0.16; c.beginPath(); for (let k = 0; k <= 60; k++) { const ph = (k / 60) * (PI / 2), p = P2(ph), n = [sin(ph), -cos(ph)], v = Mf(ph) * sc; k ? c.lineTo(p[0] + n[0] * v, p[1] + n[1] * v) : c.moveTo(p[0] + n[0] * v, p[1] + n[1] * v); } for (let k = 60; k >= 0; k--) { const p = P2((k / 60) * (PI / 2)); c.lineTo(p[0], p[1]); } c.closePath(); c.fill(); c.restore();
      c.strokeStyle = tk('ink'); c.lineWidth = 4.5; c.beginPath(); for (let k = 0; k <= 60; k++) { const p = P2((k / 60) * (PI / 2)); k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); } c.stroke();
      const pe = P2(PI / 2); R.hatch(c, pe[0] - 16, pe[1] + 1, pe[0] + 16, pe[1] + 1, 1, { len: 7, gap: 6, lw: 2.6 }); const p0 = P2(0); arrow(c, p0[0], p0[1] - 60, p0[0], p0[1] - 6, tk('ink'), 2.4, 10); txt(c, `F = ${fmt(e.F, 1)} kN`, p0[0] + 8, p0[1] - 62, tk('ink'), 'left', 11);
      c.save(); c.strokeStyle = tk('ink-3'); c.setLineDash([4, 4]); c.lineWidth = 1; R.line(c, cx, cy, p0[0], p0[1]); R.line(c, cx, cy, pe[0], pe[1]); c.restore(); txt(c, `R = ${fmt(e.R, 2)} m`, cx + s * 0.3, cy - s * 0.42, tk('ink-2'), 'left', 11);
      const r = res.r; arrow(c, p0[0], p0[1], p0[0], p0[1] + 46, tk('plot5'), 2.4, 9); arrow(c, p0[0], p0[1], p0[0] - 36, p0[1], tk('plot5'), 2.4, 9); txt(c, `δ_v = ${fmt(r.dv * 1000, 3)} mm`, p0[0] + 8, p0[1] + 52, tk('plot5'), 'left', 11); txt(c, `δ_h = ${fmt(abs(r.dh) * 1000, 3)} mm`, p0[0] - 42, p0[1] - 12, tk('plot5'), 'right', 11);
      txt(c, 'M(φ) = F R sin φ', 14, H - 14, cM, 'left', 11);
    } else { const cx = W / 2, cy = H / 2, r = res.r, Mf = (ph) => r.X - ((e.F * e.R) / 2) * (1 - cos(ph)), mmax = max(abs(r.X), abs(r.Mload)), sc = (s * 0.32) / (mmax || 1); // ph from the horizontal diameter towards the load
      c.save(); for (let k = 0; k < 240; k++) { const a0 = (k / 240) * TAU, a1 = ((k + 1) / 240) * TAU, ph = (a) => { const y = abs(sin(a)); return Math.asin(min(1, y)); }, m0 = Mf(ph(a0)), m1 = Mf(ph(a1)); c.fillStyle = m0 >= 0 ? cM : tk('plot1'); c.globalAlpha = 0.25; c.beginPath(); c.moveTo(cx + s * cos(a0), cy - s * sin(a0)); c.lineTo(cx + (s - m0 * sc) * cos(a0), cy - (s - m0 * sc) * sin(a0)); c.lineTo(cx + (s - m1 * sc) * cos(a1), cy - (s - m1 * sc) * sin(a1)); c.lineTo(cx + s * cos(a1), cy - s * sin(a1)); c.closePath(); c.fill(); } c.restore();
      c.strokeStyle = tk('ink'); c.lineWidth = 4.5; c.beginPath(); c.arc(cx, cy, s, 0, TAU); c.stroke();
      arrow(c, cx, cy - s - 64, cx, cy - s - 4, tk('ink'), 2.4, 10); arrow(c, cx, cy + s + 64, cx, cy + s + 4, tk('ink'), 2.4, 10); txt(c, `F = ${fmt(e.F, 1)} kN`, cx + 8, cy - s - 66, tk('ink'), 'left', 11);
      txt(c, `M = X = ${fmt(r.X, 3)} kN·m`, cx + s + 10, cy, cM, 'left', 11); txt(c, `M = −FR/π = ${fmt(r.Mload, 3)}`, cx + 12, cy - s + 26, tk('plot1'), 'left', 11);
      c.save(); c.strokeStyle = tk('warn'); c.lineWidth = 1.3; c.setLineDash([6, 4]); R.line(c, cx - s - 20, cy, cx + s + 20, cy); c.restore(); txt(c, 'cut: unknown X', cx - s - 20, cy + 14, tk('warn'), 'left', 10.5);
    }
    energySide(P, res, e);
  }
  function energySide(P, res, e) {
    const c = fitP(P.side.cv); if (!c) return; const W = P.side.cv._W, H = P.side.cv._H;
    if (res.mode === 'arc') { const r = res.r, parts = [['bending', r.UM, tk('plot2')], ['normal force', r.UN, tk('plot3')], ['shear', r.UQ, tk('plot1')]], tot = r.U || 1; let y = 40; txt(c, `U = ½F δ_v = ½·${fmt(e.F, 1)} kN·${fmt(r.dv * 1000, 3)} mm = ${fg(r.U * 1000)} J`, W / 2, 18, tk('ink'), 'center', 11);
      parts.forEach(([n, v, col]) => { const w = (W - 140) * (v / tot); c.fillStyle = col; c.globalAlpha = 0.65; c.fillRect(110, y, max(1, w), 22); c.globalAlpha = 1; txt(c, n, 100, y + 11, tk('ink-2'), 'right', 11); txt(c, `${fmt((100 * v) / tot, 3)} %`, 116 + w, y + 11, col, 'left', 11); y += 36; });
      txt(c, 'δ = ∂U/∂F (Castigliano)', W / 2, H - 16, tk('ink-3'), 'center', 11); return; }
    const r = res.r, X0 = r.X, span = abs(e.F * e.R) * 0.6 || 1, xs = [], us = []; for (let k = 0; k <= 80; k++) { const X = X0 - span + (2 * span * k) / 80; xs.push(X); us.push(r.U(X)); } const umin = min(...us), umax = max(...us), pad = 36, sxp = (W - 2 * pad) / (2 * span), sy = (H - 2 * pad) / (umax - umin || 1), XP = (X) => pad + (X - (X0 - span)) * sxp, YP = (u) => H - pad - (u - umin) * sy;
    c.strokeStyle = tk('ink-3'); c.lineWidth = 1; R.line(c, pad, H - pad, W - pad, H - pad); txt(c, 'X', W - pad + 10, H - pad, tk('ink-2'), 'left', 12); txt(c, 'U(X)', pad, pad - 14, tk('ink-2'), 'left', 12);
    c.strokeStyle = tk('accent'); c.lineWidth = 2; c.beginPath(); xs.forEach((X, k) => (k ? c.lineTo(XP(X), YP(us[k])) : c.moveTo(XP(X), YP(us[k])))); c.stroke();
    c.fillStyle = tk('warn'); c.beginPath(); c.arc(XP(X0), YP(r.U(X0)), 5, 0, TAU); c.fill(); txt(c, `∂U/∂X = 0 at X = ${fmt(X0, 3)} kN·m`, XP(X0), YP(r.U(X0)) - 46, tk('warn'), 'center', 11.5); c.save(); c.strokeStyle = tk('warn'); c.setLineDash([3, 3]); R.line(c, XP(X0), YP(r.U(X0)) - 36, XP(X0), YP(r.U(X0)) - 6); c.restore();
    txt(c, 'Menabrea: the redundant makes U a minimum', W / 2, H - 12, tk('ink-3'), 'center', 10.5);
  }

  /* ---------------- scene: buckling ---------------- */
  function buckResult() { const b = o().buck, { sec, P: Pr } = secInfo(), m = mat(), cs = SO.EULER.find((q) => q.id === b.cs) || SO.EULER[1], Imin = Pr.I2, i = sqrt(Imin / Pr.A), Lk = cs.beta * b.L * 1000, lam = Lk / i, Fk = (PI * PI * m.E * Imin) / (Lk * Lk) / 1e3, sk = (PI * PI * m.E) / (lam * lam), steel = m.E > 150000 && m.fy < 300, lamP = steel ? 104 : PI * sqrt(m.E / (0.8 * m.fy)), lam1 = PI * sqrt(m.E / m.fy), chi = (l) => { const lb = l / lam1, ph = 0.5 * (1 + 0.34 * (lb - 0.2) + lb * lb); return lb <= 0.2 ? 1 : min(1, 1 / (ph + sqrt(ph * ph - lb * lb))); };
    const lamY = steel ? (310 - m.fy) / 1.14 : lam1, sNow = lam >= lamP ? sk : steel ? (lam > lamY ? SO.tetmajer(lam) : m.fy) : min(m.fy, sk); return { cs, Imin, i, Lk, lam, Fk, sk, lamP, lamY, lam1, chi, steel, sNow, A: Pr.A, m, sec }; }
  /* eigenvalues kL = μ_n and mode shapes (x from the bottom support, 0…1) for the four Euler cases; F_n = (μ_n/μ_1)² F_k */
  const MU = { pp: [PI, 2 * PI, 3 * PI], cant: [PI / 2, 1.5 * PI, 2.5 * PI], fp: [4.493409457909064, 7.725251836937707, 10.904121659428899], ff: [2 * PI, 8.986818916, 4 * PI] };
  function modeFn(cs, n) {
    const mu = MU[cs][n - 1];
    if (cs === 'pp') return (x) => sin(mu * x);
    if (cs === 'cant') return (x) => 1 - cos(mu * x);
    if (cs === 'fp') return (x) => (1 - cos(mu * x)) - (cos(mu) / sin(mu)) * (mu * x - sin(mu * x));
    if (n === 2) { const B = (1 - cos(mu)) / (mu - sin(mu)); return (x) => (1 - cos(mu * x)) - B * (mu * x - sin(mu * x)); }
    return (x) => 1 - cos(mu * x);
  }
  const normMode = (f) => { let m = 0; for (let k = 0; k <= 80; k++) m = max(m, abs(f(k / 80))); return (x) => f(x) / (m || 1); };
  /* the load ramp of the animation: 0 → 0.97 F_k in 6 s, hold, start again */
  const rampF = (t) => { const T = t % 8.5; return T < 6 ? 0.97 * (1 - (1 - T / 6) ** 2) : 0.97; };
  function columnGlyphs(c, cx, y0, y1, cs, scale) { const z = scale || 1; const bot = cs === 'pp' ? 'pin' : 'fixed', top = cs === 'cant' ? 'free' : cs === 'ff' ? 'fixed' : 'pin';
    c.save(); c.strokeStyle = tk('ink'); c.fillStyle = tk('paper'); c.lineWidth = 1.6; if (bot === 'fixed') R.hatch(c, cx - 22 * z, y0, cx + 22 * z, y0, 1, { len: 7 * z, gap: 6 * z, lw: 2.6 }); else { c.beginPath(); c.moveTo(cx, y0); c.lineTo(cx - 12 * z, y0 + 20 * z); c.lineTo(cx + 12 * z, y0 + 20 * z); c.closePath(); c.fill(); c.stroke(); R.hatch(c, cx - 18 * z, y0 + 20 * z, cx + 18 * z, y0 + 20 * z, 1, { len: 6 * z, gap: 5.5 * z }); }
    if (top === 'fixed') { R.hatch(c, cx + 22 * z, y1 - 2, cx - 22 * z, y1 - 2, 1, { len: 7 * z, gap: 6 * z, lw: 2.6 }); c.lineWidth = 1.4; R.line(c, cx - 26 * z, y1 - 12 * z, cx - 26 * z, y1 + 30 * z); R.line(c, cx + 26 * z, y1 - 12 * z, cx + 26 * z, y1 + 30 * z); }
    else if (top === 'pin') { c.lineWidth = 1.4; R.line(c, cx - 14 * z, y1 - 14 * z, cx - 14 * z, y1 + 26 * z); R.line(c, cx + 14 * z, y1 - 14 * z, cx + 14 * z, y1 + 26 * z); R.ring(c, cx, y1, 4, tk('paper')); }
    c.restore(); return { bot, top }; }
  function paintBuckling(P) {
    const b = o().buck, r = buckResult(), c = fitP(P.main.cv); if (!c) return; const W = P.main.cv._W, H = P.main.cv._H; P.bk = r;
    const n = b.mode || 1, anim = !!b.anim; if (anim) { st.bkT = (st.bkT || 0) + st.dtF; } const f = anim && n === 1 ? rampF(st.bkT || 0) : b.f; P.fNow = f;
    const y0 = H * 0.84, y1 = H * 0.16, cx = W * 0.4, Lp = y0 - y1, w0 = (b.L * 1000) / b.imp, md = normMode(modeFn(r.cs.id, n));
    /* drawn deflection: the imperfection w₀ is shown at ~1.5 % of the column length, the growth 1/(1 − F/F_k) on top of it; capped */
    const amp = 1 / (1 - min(0.995, f)), base = Lp * 0.015, wpx = (x) => (n === 1 ? md(x) * min(base * amp, W * 0.3) : md(x) * W * 0.12 * sin(st.t * 2.2));
    columnGlyphs(c, cx, y0, y1, r.cs.id);
    c.save(); c.strokeStyle = tk('ink-3'); c.lineWidth = 1; c.setLineDash([4, 4]); R.line(c, cx, y0, cx, y1); c.restore();
    // the column, coloured by the bending stress at its extreme fibre when F is on (second order: M = F·w)
    const topShift = r.cs.id === 'cant' ? wpx(1) : 0;
    c.save(); c.lineWidth = 6; c.lineCap = 'round'; for (let k = 0; k < 60; k++) { const xa = k / 60, xb = (k + 1) / 60, wm = abs(md((xa + xb) / 2)); c.strokeStyle = n === 1 && f > 0.02 ? `rgba(${round(60 + 160 * wm * min(1, f * amp / 8))},${round(70 - 30 * wm * min(1, f * amp / 8))},${round(80 - 40 * wm * min(1, f * amp / 8))},1)` : tk('ink'); c.beginPath(); c.moveTo(cx + wpx(xa), y0 - xa * Lp); c.lineTo(cx + wpx(xb), y0 - xb * Lp); c.stroke(); } c.restore();
    if (n === 1) { arrow(c, cx + topShift, y1 - 70, cx + topShift, y1 - 8, tk('warn'), 2 + 2.5 * f, 12); txt(c, `F = ${fmt(f, 2)} F_k = ${fmt(f * r.Fk, 1)} kN`, cx + topShift + 12, y1 - 66, tk('warn'), 'left', 11.5); }
    else txt(c, `mode ${n}: F_${n} = (μ${SUBN(n)}/μ₁)² F_k = ${fmt((MU[r.cs.id][n - 1] / MU[r.cs.id][0]) ** 2, 3)} F_k = ${fmt((MU[r.cs.id][n - 1] / MU[r.cs.id][0]) ** 2 * r.Fk, 0)} kN`, W / 2, y1 - 60, tk('accent'), 'center', 11.5);
    // gauge F/F_k on the right
    if (n === 1) { const gx = W * 0.8, gh = Lp * 0.8, gy = y0 - (Lp - gh) / 2; c.save(); c.strokeStyle = tk('ink-3'); c.lineWidth = 1; c.strokeRect(gx, gy - gh, 14, gh); c.fillStyle = f > 0.9 ? tk('load') : tk('warn'); c.globalAlpha = 0.75; c.fillRect(gx, gy - gh * f, 14, gh * f); c.restore(); txt(c, 'F/F_k', gx + 7, gy - gh - 14, tk('ink-2'), 'center', 10.5); for (const v of [0, 0.5, 1]) txt(c, fmt(v, 1), gx - 6, gy - gh * v, tk('ink-3'), 'right', 10); txt(c, `w = ${fmt(w0 * amp, 1)} mm`, gx + 7, gy + 16, tk('plot5'), 'center', 11); txt(c, `×${fmt(amp, 2)}`, gx + 7, gy + 30, tk('plot5'), 'center', 11); }
    if (n === 1) txt(c, `w_max = w₀/(1 − F/F_k) = ${fmt(w0, 1)}/(1 − ${fmt(f, 2)}) = ${fmt(w0 * amp, 2)} mm  (w₀ drawn at 1.5 % of L)`, W / 2, H - 12, tk('plot5'), 'center', 11);
    else txt(c, 'eigenmode (shape only, amplitude arbitrary): needs a brace at each node to be reached', W / 2, H - 12, tk('ink-2'), 'center', 11);
    txt(c, `L_k = ${fmt(r.cs.beta, 3)} L`, cx - W * 0.2, H * 0.5, tk('ink-2'), 'center', 11);
    const Fnow = f * r.Fk, Fin = (r.sNow * r.A) / 1e3, Nb = r.steel ? (r.chi(r.lam) * r.A * r.m.fy) / 1e3 : null; if (n === 1) { if (Fnow > Fin * 1.0001) txt(c, `F > σ_k A = ${fmt(Fin, 1)} kN: the column fails before it reaches this load`, W / 2, max(14, y1 - 92), tk('load'), 'center', 11); else if (Nb && Fnow > Nb) txt(c, `F > χ A f_y = ${fmt(Nb, 1)} kN (design resistance, curve b)`, W / 2, max(14, y1 - 92), tk('load'), 'center', 11); }
    const view = b.view || 'curve'; if (view === 'path') buckPath(P, r, f, w0); else if (view === 'cases') buckCases(P, r); else buckChart(P, r);
  }
  /* load–deflection: the perfect column stays straight up to F_k and then bifurcates; the imperfect one bends from the start */
  function buckPath(P, r, f, w0) {
    const c = fitP(P.side.cv); if (!c) return; const W = P.side.cv._W, H = P.side.cv._H, pad = 44, xm = 24, X = (v) => pad + (v / xm) * (W - pad - 18), Y = (v) => H - pad - (v / 1.1) * (H - 2 * pad);
    c.strokeStyle = tk('ink-3'); c.lineWidth = 1; R.line(c, pad, H - pad, W - 10, H - pad); R.line(c, pad, H - pad, pad, 16); txt(c, 'w_max / w₀', W - 14, H - pad + 16, tk('ink-2'), 'right', 11); txt(c, 'F / F_k', pad + 4, 12, tk('ink-2'), 'left', 11);
    for (const v of [0, 5, 10, 15, 20]) txt(c, `${v}`, X(v), H - pad + 12, tk('ink-3'), 'center', 10); for (const v of [0.5, 1]) txt(c, fmt(v, 1), pad - 6, Y(v), tk('ink-3'), 'right', 10);
    c.save(); c.strokeStyle = tk('ink-3'); c.setLineDash([4, 4]); R.line(c, pad, Y(1), W - 10, Y(1)); c.restore();
    c.save(); c.strokeStyle = tk('accent'); c.lineWidth = 2.4; R.line(c, X(0), Y(0), X(0), Y(1)); R.line(c, X(0), Y(1), X(xm), Y(1)); c.restore(); txt(c, 'perfect column: bifurcation at F_k', X(xm * 0.55), Y(1) - 12, tk('accent'), 'center', 10.5);
    c.save(); c.strokeStyle = tk('plot5'); c.lineWidth = 2.4; c.beginPath(); let first = true; for (let k = 0; k <= 200; k++) { const ff = (k / 200) * 0.985, x = 1 / (1 - ff); if (x > xm) break; first ? c.moveTo(X(x), Y(ff)) : c.lineTo(X(x), Y(ff)); first = false; } c.stroke(); c.restore(); txt(c, 'with imperfection: w = w₀/(1 − F/F_k)', X(6), Y(0.62), tk('plot5'), 'left', 10.5);
    const x = min(xm, 1 / (1 - min(0.995, f))); c.fillStyle = tk('ink'); c.beginPath(); c.arc(X(x), Y(f), 5.5, 0, TAU); c.fill(); txt(c, `F = ${fmt(f, 2)} F_k → w = ${fmt(1 / (1 - f), 2)} w₀ = ${fmt(w0 / (1 - f), 1)} mm`, X(x) + 10, Y(f) + 16, tk('ink'), 'left', 11);
    txt(c, 'press ▶ in Controls to ramp the load', W / 2, H - 10, tk('ink-3'), 'center', 10);
  }
  /* the four Euler cases next to each other, each with its buckling length L_k = βL (the half sine wave) */
  function buckCases(P, r) {
    const c = fitP(P.side.cv); if (!c) return; const W = P.side.cv._W, H = P.side.cv._H, b = o().buck, m = r.m, cw = W / 4, y0 = H * 0.8, y1 = H * 0.2, Lp = y0 - y1;
    SO.EULER.forEach((cs, k) => { const cx = cw * (k + 0.5), md = normMode(modeFn(cs.id, 1)), amp = cw * 0.22 * (0.75 + 0.25 * sin(st.t * 1.6));
      columnGlyphs(c, cx, y0, y1, cs.id, 0.6); c.save(); c.strokeStyle = cs.id === r.cs.id ? tk('accent') : tk('ink'); c.lineWidth = cs.id === r.cs.id ? 4 : 3; c.beginPath(); for (let i = 0; i <= 50; i++) { const x = i / 50, X = cx + md(x) * amp, Yy = y0 - x * Lp; i ? c.lineTo(X, Yy) : c.moveTo(X, Yy); } c.stroke(); c.restore();
      const Fk = (PI * PI * m.E * r.Imin) / (cs.beta * b.L * 1000) ** 2 / 1e3; txt(c, `β = ${fmt(cs.beta, cs.id === 'fp' ? 3 : 1)}`, cx, y0 + 30, tk('ink'), 'center', 11); txt(c, `F_k = ${fmt(Fk, 0)} kN`, cx, y0 + 46, cs.id === r.cs.id ? tk('accent') : tk('ink-2'), 'center', 11); txt(c, cs.name.replace(' – ', '–'), cx, y1 - 34, tk('ink-2'), 'center', 10); });
    txt(c, 'F_k = π²EI/(βL)²: the same column, four ways of holding its ends', W / 2, H - 10, tk('ink-3'), 'center', 10.5);
  }
  function buckChart(P, r) {
    const c = fitP(P.side.cv); if (!c) return; const W = P.side.cv._W, H = P.side.cv._H, pad = 40, lmax = 250, smax = max(r.m.fy * 1.4, 400), X = (l) => pad + (l / lmax) * (W - pad - 14), Y = (s) => H - pad - (s / smax) * (H - 2 * pad);
    c.strokeStyle = tk('ink-3'); c.lineWidth = 1; R.line(c, pad, H - pad, W - 10, H - pad); R.line(c, pad, H - pad, pad, 16); txt(c, 'λ', W - 14, H - pad - 12, tk('ink-2'), 'center', 12); txt(c, 'σ_k [MPa]', pad + 4, 12, tk('ink-2'), 'left', 11);
    for (const l of [50, 100, 150, 200, 250]) txt(c, `${l}`, X(l), H - pad + 12, tk('ink-3'), 'center', 10);
    c.save(); c.strokeStyle = tk('ink-3'); c.setLineDash([4, 4]); R.line(c, X(0), Y(r.m.fy), X(lmax), Y(r.m.fy)); c.restore(); txt(c, `f_y = ${r.m.fy}`, X(lmax) - 4, Y(r.m.fy) - 10, tk('ink-3'), 'right', 10);
    const lamY = r.steel ? (310 - r.m.fy) / 1.14 : PI * sqrt(r.m.E / r.m.fy), lp = r.lamP, eul = (l) => (PI * PI * r.m.E) / (l * l);
    const curve = (f, l0, l1, col, lw, dash) => { c.save(); c.strokeStyle = col; c.lineWidth = lw; if (dash) c.setLineDash(dash); c.beginPath(); let first = true; for (let l = max(1, l0); l <= l1 + 1e-9; l += 1) { const s2 = f(l); if (s2 > smax) { first = true; continue; } first ? c.moveTo(X(l), Y(s2)) : c.lineTo(X(l), Y(s2)); first = false; } c.stroke(); c.restore(); };
    curve(eul, 10, lp, tk('accent'), 1.4, [5, 4]); curve(eul, lp, lmax, tk('accent'), 2.4); txt(c, 'Euler π²E/λ²', X(185), Y(eul(185)) - 14, tk('accent'), 'center', 10.5);
    c.save(); c.strokeStyle = tk('load'); c.lineWidth = 2.4; R.line(c, X(0), Y(r.m.fy), X(max(0, r.steel ? lamY : 0)), Y(r.m.fy)); c.restore();
    if (r.steel) { curve((l) => SO.tetmajer(l), lamY, lp, tk('warn'), 2.4); txt(c, 'Tetmajer 310 − 1.14λ', X((lamY + lp) / 2) + 6, Y(SO.tetmajer((lamY + lp) / 2)) - 16, tk('warn'), 'left', 10.5);
      curve((l) => r.chi(l) * r.m.fy, 0, lmax, tk('plot3'), 1.8, [2, 3]); txt(c, 'χ f_y, curve b', X(40), Y(r.chi(40) * r.m.fy) + 14, tk('plot3'), 'left', 10); }
    for (const [l, lab] of [[lp, 'λ_p'], r.steel ? [lamY, 'λ_y'] : null].filter(Boolean)) { c.save(); c.strokeStyle = tk('ink-3'); c.setLineDash([2, 3]); R.line(c, X(l), H - pad, X(l), Y(eul(max(l, 1)) > smax ? smax : eul(l))); c.restore(); txt(c, lab, X(l), H - pad - 10, tk('ink-2'), 'center', 10); }
    const sNow = r.sNow; c.fillStyle = tk('ink'); c.beginPath(); c.arc(X(min(lmax, r.lam)), Y(min(smax, sNow)), 5.5, 0, TAU); c.fill(); txt(c, `λ = ${fmt(r.lam, 1)}: σ_k = ${fmt(sNow, 1)} MPa`, X(min(lmax, r.lam)) + 9, Y(min(smax, sNow)) - 13, tk('ink'), 'left', 11);
  }

  /* ---------------- derivations ---------------- */
  const DERIV = {
    steiner: { name: 'Steiner’s theorem', steps: [
      { t: 'An axis shifted by a', f: ['I_ȳ', '=', '∫', '(z + a)^2', 'dA'], say: 'The axis ȳ is parallel to the axis y through the centroid S, a distance a away. Every area element sits at z̄ = z + a from it.' },
      { t: 'Expand the square', f: ['I_ȳ', '=', '∫', 'z^2', 'dA', '+', '2a', '∫', 'z', 'dA', '+', 'a^2', '∫', 'dA'], say: 'Three integrals: the moment of inertia about y, the first moment of area, and the area.' },
      { t: 'The middle term vanishes', f: ['∫', 'z', 'dA', '=', 'z_S', 'A', '=', '0'], say: 'About an axis through the centroid the first moment of area is zero: that is what “centroid” means.' },
      { t: 'Steiner', f: [D.b(['I_ȳ', '=', 'I_y', '+', 'a^2', 'A'])], say: 'The moment of inertia about any parallel axis is the centroidal one plus the area times the distance squared; it is smallest about the centroid.' },
      { t: 'The product moment', f: ['I_{ȳz̄}', '=', 'I_{yz}', '−', 'a_y', 'a_z', 'A'], say: 'With I_yz = −∫yz dA the product moment picks up −a_y a_z A. That sign makes the inertia tensor turn like a stress tensor.' },
      { t: 'Composite sections', f: ['I_y', '=', 'Σ', '(', 'I_{y,i}', '+', 'z̄_i^2', 'A_i', ')'], say: 'Each part brings its own moment of inertia about its own centroid plus its Steiner term; holes count with negative area. The table in the section scene is exactly this sum.' }] },
    navier: { name: 'Bending stress (Navier)', steps: [
      { t: 'Plane sections stay plane', f: ['ε(z)', '=', 'κ', 'z'], say: 'Bernoulli: a cross-section turns but stays plane, so the strain varies linearly over the height, κ being the curvature.' },
      { t: 'Hooke', f: ['σ(z)', '=', 'E', 'κ', 'z'], say: 'Linear elastic material: the stress follows the strain.' },
      { t: 'No normal force', f: ['N', '=', '∫', 'σ', 'dA', '=', 'Eκ', '∫', 'z', 'dA', '=', '0'], say: 'In pure bending the resultant is zero, so ∫z dA = 0: the neutral axis passes through the centroid.' },
      { t: 'The moment', f: ['M_y', '=', '∫', 'σ', 'z', 'dA', '=', 'Eκ', '∫', 'z^2', 'dA', '=', 'E', 'I_y', 'κ'], say: 'The stresses times their lever arms add up to the bending moment: the bending stiffness EI appears.' },
      { t: 'Navier’s formula', f: [D.b(['σ', '=', D.fr('M_y', 'I_y'), 'z']), ',', 'σ_max', '=', D.fr('M', 'W')], say: 'Eliminate Eκ. The largest stress is at the extreme fibre; W = I/z_max is the section modulus.' },
      { t: 'Oblique bending', f: ['σ', '=', D.fr('N', 'A'), '+', D.fr('I_z M_y − I_yz M_z', 'Δ'), 'z', '−', D.fr('I_y M_z − I_yz M_y', 'Δ'), 'y'], say: 'With moments about both axes, or with I_yz ≠ 0, the same three equilibrium conditions give this, Δ = I_y I_z − I_yz². σ = 0 is the neutral axis; it is no longer perpendicular to the moment vector.' }] },
    jour: { name: 'Shear stress and shear flow', steps: [
      { t: 'Cut a piece off the beam', f: ['dσ', '=', D.fr('dM', 'I'), 'z', '=', D.fr('Q dx', 'I'), 'z'], say: 'Between x and x + dx the bending stress grows because M grows by Q dx.' },
      { t: 'Balance the piece below the cut', f: ['τ', 'b', 'dx', '=', '∫', 'dσ', 'dA', '=', D.fr('Q dx', 'I'), 'S(z)'], say: 'The extra normal force on the cut-off part must be carried by shear stress on the cut, width b. S(z) is the first moment of the cut-off area.' },
      { t: 'Jourawski', f: [D.b(['τ(z)', '=', D.fr('Q S(z)', 'I b(z)')])], say: 'A parabola for a rectangle with τ_max = 1.5 Q/A, 4/3 Q/A for a circle; in an I-beam almost all of Q runs through the web.' },
      { t: 'Thin walls: the shear flow', f: ['q', '=', 'τ', 't', ',', D.fr('dq', 'ds'), '=', '−', 't', D.fr('∂σ', '∂x')], say: 'Along a thin wall the same balance gives the change of the shear flow q along the arc length s. Starting from q = 0 at a free edge:' },
      { t: 'Open sections', f: ['q(s)', '=', '−', D.fr('Q_z', 'I_y'), 'S_y(s)', '−', D.fr('Q_y', 'I_z'), 'S_z(s)'], say: 'For principal axes. Linear in flanges where z is constant, parabolic in webs. The resultant of q is Q; its line of action defines the shear centre.' },
      { t: 'Closed cells', f: ['q', '=', 'q_open', '+', 'q_0', ',', '∮', D.fr('q', 't'), 'ds', '=', '0'], say: 'A closed cell has no free edge: cut it, add an unknown constant flow q₀ and require that the cell does not twist.' }] },
    bredt: { name: 'Torsion: Bredt and open walls', steps: [
      { t: 'Constant shear flow', f: ['q', '=', 'τ', 't', '=', 'const'], say: 'In a closed thin wall under pure torsion the shear flow is the same all around the cell (balance of a wall element along x).' },
      { t: 'The torque', f: ['T', '=', '∮', 'q', 'r_⊥', 'ds', '=', 'q', '∮', 'r_⊥', 'ds', '=', '2', 'A_m', 'q'], say: 'r⊥ ds is twice the area of a thin triangle; around the cell they add up to twice the area A_m enclosed by the centre line.' },
      { t: 'First Bredt formula', f: [D.b(['τ', '=', D.fr('T', '2 A_m t')])], say: 'The thinnest wall has the largest shear stress.' },
      { t: 'The twist', f: ['θ′', '=', D.fr('1', '2 A_m G'), '∮', 'τ', 'ds', '=', D.fr('T', '4 A_m^2 G'), '∮', D.fr('ds', 't')], say: 'Compatibility around the cell: the warping must close up again.' },
      { t: 'Second Bredt formula', f: [D.b(['I_T', '=', D.fr('4 A_m^2', '∮ ds/t')])], say: 'The torsion constant of a closed cell grows with the square of the enclosed area.' },
      { t: 'Open walls', f: ['I_T', '=', D.fr('1', '3'), 'Σ', 'l', 't^3', ',', 'τ_max', '=', D.fr('T', 'I_T'), 't'], say: 'Without a closed path the stress can only circulate inside the thickness. A slit tube is about 3(R/t)² times softer than the closed one.' }] },
    euler: { name: 'Euler buckling', steps: [
      { t: 'The bent column', f: ['M', '=', 'F', 'w'], say: 'A pin-ended column held slightly bent: the compressive force F has the lever arm w.' },
      { t: 'The elastic line', f: ['E', 'I', 'w″', '=', '−', 'M', '=', '−', 'F', 'w'], say: 'Equilibrium in the deformed position (second-order theory).' },
      { t: 'An eigenvalue problem', f: ['w″', '+', 'k^2', 'w', '=', '0', ',', 'k^2', '=', D.fr('F', 'EI')], say: 'A linear ODE with constant coefficients.' },
      { t: 'Boundary conditions', f: ['w', '=', 'A', 'sin', 'kx', ',', 'sin', 'kL', '=', '0'], say: 'w(0) = 0 removes the cosine; w(L) = 0 allows a non-zero A only if kL = nπ.' },
      { t: 'The critical load', f: [D.b(['F_k', '=', D.fr('π^2 E I', 'L_k^2')])], say: 'The smallest, n = 1. Other supports change the buckling length L_k = βL: β = 2 (cantilever), 1, 0.699, 0.5 (both clamped). I is the smallest principal moment of inertia.' },
      { t: 'Slenderness', f: ['σ_k', '=', D.fr('π^2 E', 'λ^2'), ',', 'λ', '=', D.fr('L_k', 'i'), ',', 'i', '=', D.sq(['I/A'])], say: 'Euler holds while σ_k stays below the proportional limit; stockier columns fail inelastically (Tetmajer, Johnson, buckling curves).' }] },
    castigliano: { name: 'Castigliano and Menabrea', steps: [
      { t: 'Strain energy', f: ['U', '=', '∫', D.fr('M^2', '2EI'), 'ds', '+', '∫', D.fr('N^2', '2EA'), 'ds', '+', '∫', D.fr('κ Q^2', '2GA'), 'ds'], say: 'Stored in a linear elastic bar by its internal forces.' },
      { t: 'Castigliano', f: [D.b(['δ_i', '=', D.fr('∂U', '∂F_i')])], say: 'The displacement at a load in its own direction is the derivative of the energy with respect to that load. A dummy load gives the displacement anywhere.' },
      { t: 'Under the integral', f: ['δ', '=', '∫', D.fr('M', 'EI'), D.fr('∂M', '∂F'), 'ds'], say: '∂M/∂F is the moment of a unit load: the unit-load method again.' },
      { t: 'A quarter circle', f: ['M', '=', 'F R', 'sin φ', '⇒', 'δ', '=', D.fr('F R^3', 'EI'), '∫', 'sin^2 φ', 'dφ', '=', D.b([D.fr('π F R^3', '4 EI')])], say: 'Clamped at one end, loaded at the other.' },
      { t: 'Menabrea', f: [D.fr('∂U', '∂X'), '=', '0'], say: 'For a redundant X of a statically indeterminate structure the displacement at the cut is zero: the energy is stationary — a minimum — with respect to X.' },
      { t: 'A ring', f: ['X', '=', 'F R', '(', D.fr('1', '2'), '−', D.fr('1', 'π'), ')', ',', 'M_F', '=', '−', D.fr('F R', 'π')], say: 'A ring pressed by two opposite forces: by symmetry one unknown moment at the cut.' }] },
  };
  function paintDerive(c, W, H, k, p, which) {
    const ink = tk('ink'), acc = tk('accent'), cx = W / 2, cy = H * 0.45;
    if (which === 'steiner') { const w = min(W, H) * 0.28, hh = w * 0.6; c.fillStyle = tk('body'); c.fillRect(cx - w / 2, cy - hh / 2, w, hh); c.strokeStyle = ink; c.lineWidth = 1.5; c.strokeRect(cx - w / 2, cy - hh / 2, w, hh); c.setLineDash([6, 4]); R.line(c, cx - w, cy, cx + w, cy); c.strokeStyle = acc; R.line(c, cx - w, cy + hh * 1.3, cx + w, cy + hh * 1.3); c.setLineDash([]); txt(c, 'y (through S)', cx + w + 6, cy, ink, 'left', 11); txt(c, 'ȳ', cx + w + 6, cy + hh * 1.3, acc, 'left', 13); arrow(c, cx - w * 0.8, cy, cx - w * 0.8, cy + hh * 1.3, acc, 1.5, 7); txt(c, 'a', cx - w * 0.8 - 10, cy + hh * 0.65, acc, 'right', 13); centroidMark(c, cx, cy, 'S'); return; }
    if (which === 'navier' || which === 'jour') { const w = min(W, H) * 0.5, hh = w * 0.4; c.fillStyle = tk('body'); c.fillRect(cx - w / 2, cy - hh / 2, w, hh); c.strokeStyle = ink; c.lineWidth = 1.5; c.strokeRect(cx - w / 2, cy - hh / 2, w, hh); const sc = which === 'jour' && k >= 1 ? 1 : 0.8; c.strokeStyle = tk('plot2'); for (const [x, f] of [[cx - w / 2, 0.8], [cx + w / 2, sc]]) { for (let i = 0; i <= 8; i++) { const z = -hh / 2 + (hh * i) / 8, s = (z / (hh / 2)) * 40 * f; arrow(c, x, cy + z, x + (x > cx ? 1 : -1) * s, cy + z, tk('plot2'), 1.4, 6); } }
      if (which === 'jour' && k >= 1) { c.save(); c.fillStyle = tk('plot1'); c.globalAlpha = 0.25; c.fillRect(cx - w / 2, cy + hh * 0.1, w, hh * 0.4); c.restore(); for (let i = 0; i < 6; i++) arrow(c, cx - w / 2 + (w * (i + 0.5)) / 6 - 10, cy + hh * 0.1, cx - w / 2 + (w * (i + 0.5)) / 6 + 10, cy + hh * 0.1, tk('plot1'), 1.6, 6); txt(c, 'τ on the cut', cx, cy + hh * 0.1 - 12, tk('plot1'), 'center', 11); }
      txt(c, which === 'navier' ? 'σ(z) = M z / I' : 'σ grows from x to x + dx', cx, cy + hh / 2 + 24, ink, 'center', 11); return; }
    if (which === 'bredt') { const w = min(W, H) * 0.42, hh = w * 0.6; c.strokeStyle = tk('body-2'); c.lineWidth = 10; c.strokeRect(cx - w / 2, cy - hh / 2, w, hh); const per = [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]; for (const [a, b2, cc, d] of per) for (let i = 1; i < 5; i++) { const t = i / 5, x = cx + (w / 2) * (a + (cc - a) * t), y = cy + (hh / 2) * (b2 + (d - b2) * t), ux = (cc - a), uy = (d - b2), n = hypot(ux, uy); arrow(c, x - (ux / n) * 8, y - (uy / n) * 8, x + (ux / n) * 8, y + (uy / n) * 8, tk('plot2'), 1.8, 6); } txt(c, 'q = T / (2 A_m)', cx, cy, ink, 'center', 12); return; }
    if (which === 'euler') { const y0 = H * 0.85, y1 = H * 0.12, amp = k >= 1 ? 26 : 8; c.strokeStyle = ink; c.lineWidth = 4; c.beginPath(); for (let i = 0; i <= 40; i++) { const x = i / 40; const X = cx + amp * sin(PI * x), Y = y0 - x * (y0 - y1); i ? c.lineTo(X, Y) : c.moveTo(X, Y); } c.stroke(); arrow(c, cx, y1 - 50, cx, y1 - 6, tk('warn'), 2.6, 11); txt(c, 'F', cx + 10, y1 - 46, tk('warn'), 'left', 13); R.ring(c, cx, y0, 4, tk('paper')); R.ring(c, cx, y1, 4, tk('paper')); return; }
    if (which === 'castigliano') { const s = min(W, H) * 0.5, x0 = W * 0.3, y0 = H * 0.78; c.strokeStyle = ink; c.lineWidth = 4; c.beginPath(); for (let i = 0; i <= 40; i++) { const ph = (i / 40) * (PI / 2); i ? c.lineTo(x0 + s * sin(ph), y0 - s * cos(ph)) : c.moveTo(x0 + s * sin(ph), y0 - s * cos(ph)); } c.stroke(); R.hatch(c, x0 + s - 16, y0 + 1, x0 + s + 16, y0 + 1, 1, { len: 7, gap: 6, lw: 2.4 }); arrow(c, x0, y0 - s - 50, x0, y0 - s - 6, tk('warn'), 2.6, 11); txt(c, 'F', x0 + 10, y0 - s - 44, tk('warn'), 'left', 13); }
  }

  /* ---------------- scenes and panels ---------------- */
  const SCENES = [
    { id: 'section', group: 'Cross sections', name: 'Section properties', blurb: 'Centroid, Iy, Iz, Iyz by Steiner, principal axes, circle of inertia.' },
    { id: 'beam', group: 'Bending and shear', name: 'Beam: side view and cross-sections', blurb: 'Slide a cut along the beam: Q, M and the deflection, σ(z) and τ(z) in the section at x.' },
    { id: 'bending', group: 'Bending and shear', name: 'Bending stress and the neutral axis', blurb: 'σ = N/A ± … for oblique bending; the stress body.' },
    { id: 'shear', group: 'Bending and shear', name: 'Shear flow and the shear centre', blurb: 'Jourawski, q(s) with arrows, open and closed sections.' },
    { id: 'elastic', group: 'Bending and shear', name: 'The elastic line', blurb: 'Four integrations, Euler–Bernoulli and Timoshenko.' },
    { id: 'torsion', group: 'Torsion', name: 'Torsion', blurb: 'Circular, rectangle, Bredt cells and open walls.' },
    { id: 'bars', group: 'Tension and compression', name: 'Bars: Zug und Druck', blurb: 'Stepped, clamped and compound bars, temperature.' },
    { id: 'energy', group: 'Energy methods', name: 'Castigliano and Menabrea', blurb: 'A quarter circle and a ring.' },
    { id: 'buckling', group: 'Stability', name: 'Euler buckling', blurb: 'Ramp the load to F_k, eigenmodes, four cases, slenderness and the design curve.' },
    { id: 'derive', group: 'Derivations', name: 'Derivations, step by step', blurb: 'Steiner, Navier, Jourawski, Bredt, Euler, Castigliano.' },
  ];
  const sceneOf = (id) => SCENES.find((s) => s.id === id) || SCENES[0];
  const card = (title, ...kids) => { let topic = null; if (kids.length && typeof kids[0] === 'string') topic = kids.shift(); return h('div', { class: 'stcard' }, h('h5', {}, title, h('span', { class: 'sp' }), topic ? mlink(topic) : null), ...kids.filter(Boolean)); };
  const eqn = (html) => h('div', { class: 'eqn', html });
  /* typeset calculations (KaTeX): tex([...lines]) is one aligned block, res marks a result; txl is a sentence with $inline$ math */
  const TX = MB.Tex, nT = (v, p = 4) => TX.num(v, p), fT = (v, d = 2) => TX.fix(v, d);
  const tex = (lines, res) => TX.calc(lines, res ? 'res' : '');
  const txl = (str) => { const d = TX.mixed(str, 'div'); d.className = 'txl'; return d; };
  const U = (u) => `\\;\\mathrm{${u}}`;
  /* a jump to the Math page that derives the formula, and back */
  const mlink = (topic, label) => h('button', { class: 'mlink', type: 'button', title: 'Where this formula comes from (Math)', onclick: (e) => { e.stopPropagation(); MB.Eng.openNote(topic, { lab: 'som', scene: st.L && st.L.sceneId, label: 'Strength of Materials' }); } }, h('b', {}, '∑'), label || 'Math');
  const icoBtn = (icon, tip, on, f) => h('button', { class: 'tb' + (on ? ' on' : ''), type: 'button', 'data-tip': tip, 'aria-label': tip, onclick: f }, F.icon(icon));
  const slider = (q, get, set) => CK.sliderRow(q, get, (v) => { set(v); }, () => { save(); rebuild(); });
  const rebuild = () => buildPanels(st.L);
  function shapeCard(withDims) {
    const s = o().sec, S = SO.SHAPES[s.key], kids = [h('div', { class: 'icorow' }, ...SHAPE_ICONS.map(([k, ic]) => icoBtn(ic, k === 'custom' ? 'Composite of rectangles' : SO.SHAPES[k].name, s.key === k, () => { s.key = k; s.phi = 0; save(); rebuild(); })))];
    if (withDims && S) { const d = (s.dims[s.key] = s.dims[s.key] || {}); for (const [k, l, lo, hi, def] of S.dims) kids.push(slider({ k, l: `${l} [mm]`, min: lo, max: hi, step: hi > 200 ? 1 : 0.5 }, () => (d[k] == null ? def : d[k]), (v) => { d[k] = v; })); }
    if (withDims && s.key === 'custom') { s.custom.forEach((r, i) => kids.push(h('div', { class: 'stfields n3', style: 'grid-template-columns:repeat(5,minmax(0,1fr));align-items:end' }, ...['y', 'z', 'b', 'h'].map((k) => fld(`${k}${SUBN(i + 1)}`, () => r[k], (v) => (r[k] = k === 'b' || k === 'h' ? max(1, v) : v))), h('button', { class: 'relbtn' + (r.hole ? ' on' : ''), type: 'button', onclick: () => { r.hole = !r.hole; save(); rebuild(); } }, 'hole')))); kids.push(h('div', { class: 'row', style: 'gap:6px' }, F.btn('Add a rectangle', () => { s.custom.push({ y: 0, z: 0, b: 40, h: 20, hole: false }); save(); rebuild(); }, 'ghost', 'i-plus'), s.custom.length > 1 ? F.btn('Remove the last', () => { s.custom.pop(); save(); rebuild(); }, 'ghost', 'i-minus') : null), h('p', { class: 'note' }, 'Drag the rectangles on the drawing; y to the right, z downwards, in mm.')); }
    kids.push(h('div', { class: 'row', style: 'gap:6px;margin-top:6px' }, h('select', { class: 'select sm', onchange: (e) => { o().mat = e.target.value; save(); rebuild(); } }, ...Object.entries(MATS).map(([k, m]) => h('option', { value: k, selected: o().mat === k ? true : null }, m.name)))));
    return card(S ? S.name : 'Composite section', ...kids);
  }
  const SUBN = (n) => String(n).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[d]);
  const fld = (label, get, set) => { const inp = h('input', { class: 'field', value: fmt(get(), 1).replace('−', '-'), inputmode: 'decimal' }); inp.onchange = () => { const v = MB.evalExpr ? MB.evalExpr(inp.value, {}) : +inp.value; if (!isFinite(v)) return; set(v); save(); rebuild(); }; return h('label', { class: 'stfield' }, h('span', { html: label }), inp); };
  const cm4 = (v) => fg(v / 1e4), cm3 = (v) => fg(v / 1e3), cm2 = (v) => fg(v / 100);
  function sectionCalc(sec, Pr) {
    const rows = Pr.rows, A = Pr.A, j = (a) => a.join(' + ').replace(/\+ -/g, '- ');
    const sy = j(rows.map((r) => `${nT(r.A / 100)}\\cdot ${fT(r.y, 1)}`)), sz = j(rows.map((r) => `${nT(r.A / 100)}\\cdot ${fT(r.z, 1)}`));
    const t1 = rows.map((r, i) => `<tr><td>${i + 1} ${r.label}${r.sign < 0 && !/hole/.test(r.label) ? ' (hole)' : ''}</td><td class="c">${fg(r.A / 100)}</td><td class="c">${fmt(r.yb, 1)}</td><td class="c">${fmt(r.zb, 1)}</td></tr>`).join('');
    const t2 = rows.map((r, i) => `<tr><td>${i + 1}</td><td class="c">${fg(r.Iy0 / 1e4)}</td><td class="c">${fg(r.stY / 1e4)}</td><td class="c">${fg(r.Iz0 / 1e4)}</td><td class="c">${fg(r.stZ / 1e4)}</td><td class="c">${fg((r.Iyz0 + r.stYZ) / 1e4)}</td></tr>`).join('');
    const tbl = h('div', { style: 'overflow-x:auto', html: `<table class="sttab"><tr><th>part</th><th class="c"><span data-tex="A_i"></span> cm²</th><th class="c"><span data-tex="\\bar y_i"></span> mm</th><th class="c"><span data-tex="\\bar z_i"></span> mm</th></tr>${t1}<tr><td><b>Σ</b></td><td class="c"><b>${cm2(A)}</b></td><td></td><td></td></tr></table><table class="sttab sm"><tr><th>#</th><th class="c"><span data-tex="I_{y,i}"></span></th><th class="c"><span data-tex="\\bar z_i^2 A_i"></span></th><th class="c"><span data-tex="I_{z,i}"></span></th><th class="c"><span data-tex="\\bar y_i^2 A_i"></span></th><th class="c"><span data-tex="I_{yz,i}"></span></th></tr>${t2}<tr><td><b>Σ</b></td><td colspan="2" class="c"><b>I_y = ${cm4(Pr.Iy)}</b></td><td colspan="2" class="c"><b>I_z = ${cm4(Pr.Iz)}</b></td><td class="c"><b>${cm4(Pr.Iyz)}</b></td></tr></table>` });
    TX.typeset(tbl);
    const m = (Pr.Iy + Pr.Iz) / 2, Rr = (Pr.I1 - Pr.I2) / 2, d = Pr.Iy - Pr.Iz;
    return h('div', {}, card('Centroid and Steiner', 'area-moments',
      tex([`y_S &= \\frac{\\sum A_i\\,y_i}{\\sum A_i} = \\frac{${sy}}{${nT(A / 100)}}`, `&= \\mathbf{${fT(Pr.yS, 2)}}${U('mm')}`, `z_S &= \\frac{\\sum A_i\\,z_i}{\\sum A_i} = \\frac{${sz}}{${nT(A / 100)}}`, `&= \\mathbf{${fT(Pr.zS, 2)}}${U('mm')}`]),
      tbl, txl('$\\bar y_i, \\bar z_i$ from the centroid $S$; inertias in cm⁴. Each part adds its own value plus the Steiner term:'),
      tex([`I_y &= \\textstyle\\sum\\left(I_{y,i} + \\bar z_i^{2}A_i\\right) = \\mathbf{${nT(Pr.Iy / 1e4)}}${U('cm^4')}`, `I_z &= \\textstyle\\sum\\left(I_{z,i} + \\bar y_i^{2}A_i\\right) = \\mathbf{${nT(Pr.Iz / 1e4)}}${U('cm^4')}`, `I_{yz} &= \\textstyle\\sum\\left(I_{yz,i} - \\bar y_i\\bar z_i A_i\\right) = \\mathbf{${nT(Pr.Iyz / 1e4)}}${U('cm^4')}`])),
      card('Principal axes', 'axis-rotation',
        tex([...(abs(d) > 1e-9 * Pr.I1 ? [`\\tan 2\\varphi^* &= \\frac{2 I_{yz}}{I_y - I_z} = \\frac{2\\cdot(${nT(Pr.Iyz / 1e4)})}{${nT(Pr.Iy / 1e4)} - ${nT(Pr.Iz / 1e4)}} = ${nT((2 * Pr.Iyz) / d)}`, `\\varphi^* &= \\mathbf{${fT((Pr.phi * 180) / PI, 2)}^\\circ}`] : [`I_y &= I_z \\;\\Rightarrow\\; \\text{every axis through } S \\text{ is principal}`]),
          `I_{1,2} &= \\frac{I_y + I_z}{2} \\pm \\sqrt{\\left(\\frac{I_y - I_z}{2}\\right)^2 + I_{yz}^2}`, `&= ${nT(m / 1e4)} \\pm \\sqrt{${nT(d / 2e4)}^2 + (${nT(Pr.Iyz / 1e4)})^2} = ${nT(m / 1e4)} \\pm ${nT(Rr / 1e4)}`,
          `I_1 &= \\mathbf{${nT(Pr.I1 / 1e4)}}${U('cm^4')}, \\qquad I_2 = \\mathbf{${nT(Pr.I2 / 1e4)}}${U('cm^4')}`], true)),
      card('Moduli and radii',
        tex([`W_y &= \\frac{I_y}{|z|_{\\max}} = ${nT(min(...Pr.Wy) / 1e3)}${U('cm^3')}`, `W_z &= \\frac{I_z}{|y|_{\\max}} = ${nT(min(...Pr.Wz) / 1e3)}${U('cm^3')}`, `i_y &= \\sqrt{I_y/A} = ${fT(Pr.iy, 1)}${U('mm')}, \\quad i_z = \\sqrt{I_z/A} = ${fT(Pr.iz, 1)}${U('mm')}`, `I_p &= I_y + I_z = ${nT(Pr.Ip / 1e4)}${U('cm^4')}`])));
  }
  function buildPanels(L) {
    const id = L.sceneId, cb = L.body('ctl'); cb.innerHTML = ''; K.sceneList(L, L.body('list'), SCENES, (s) => SM.open(L, s));
    const tb = L.body('th'); tb.innerHTML = ''; tb.append(theoryEl(id));
    const { sec, P: Pr } = secInfo(), m = mat();
    if (id === 'section') { const s = o().sec; cb.append(shapeCard(true), card('Turn the axes', 'axis-rotation', slider({ k: 'phi', l: 'angle φ [°]', min: -90, max: 90, step: 0.5 }, () => (s.phi * 180) / PI, (v) => { s.phi = (v * PI) / 180; }), (() => { const tr = SO.turn(Pr, s.phi), c2 = cos(2 * s.phi), s2 = sin(2 * s.phi); return tex([`I_\\eta &= \\tfrac{I_y + I_z}{2} + \\tfrac{I_y - I_z}{2}\\cos 2\\varphi + I_{yz}\\sin 2\\varphi`, `&= ${nT((Pr.Iy + Pr.Iz) / 2e4)} + ${nT((Pr.Iy - Pr.Iz) / 2e4)}\\cdot ${fT(c2, 4)} + ${nT(Pr.Iyz / 1e4)}\\cdot ${fT(s2, 4)} = \\mathbf{${nT(tr.Ieta / 1e4)}}`, `I_{\\eta\\zeta} &= -\\tfrac{I_y - I_z}{2}\\sin 2\\varphi + I_{yz}\\cos 2\\varphi = \\mathbf{${nT(tr.Ietazeta / 1e4)}}`, `I_\\zeta &= \\mathbf{${nT(tr.Izeta / 1e4)}}${U('cm^4')}`, `I_\\eta + I_\\zeta &= I_y + I_z = ${nT(Pr.Ip / 1e4)}${U('cm^4')} \\;(\\text{invariant})`]); })(), h('p', { class: 'note' }, 'Drag on the drawing to turn the η-axis.')), sectionCalc(sec, Pr)); }
    else if (id === 'bending') { const b = o().bend; cb.append(card('Loads', slider({ k: 'N', l: 'N [kN]', min: -500, max: 500, step: 1 }, () => b.N, (v) => (b.N = v)), slider({ k: 'My', l: 'M_y [kN·m]', min: -100, max: 100, step: 0.5 }, () => b.My, (v) => (b.My = v)), slider({ k: 'Mz', l: 'M_z [kN·m]', min: -100, max: 100, step: 0.5 }, () => b.Mz, (v) => (b.Mz = v)), h('p', { class: 'note' }, 'Drag on the drawing to turn the moment vector.')), bendCalc(Pr), shapeCard(true)); }
    else if (id === 'shear') { const q = o().shear; cb.append(card('Shear force', slider({ k: 'Qz', l: 'Q_z [kN]', min: -200, max: 200, step: 1 }, () => q.Qz, (v) => (q.Qz = v)), slider({ k: 'Qy', l: 'Q_y [kN]', min: -200, max: 200, step: 1 }, () => q.Qy, (v) => (q.Qy = v)), sec.thin ? slider({ k: 'dy', l: 'line of Q_z from M [mm]', min: -150, max: 150, step: 1 }, () => q.dyQ, (v) => (q.dyQ = v)) : null), shearCalc(sec, Pr), shapeCard(true)); }
    else if (id === 'torsion') { const q = o().tors; cb.append(card('Torque', slider({ k: 'T', l: 'T [kN·m]', min: 0, max: 50, step: 0.05 }, () => q.T, (v) => (q.T = v)), slider({ k: 'L', l: 'length L [mm]', min: 100, max: 10000, step: 10 }, () => q.L, (v) => (q.L = v)), (sec.key === 'tube' || sec.key === 'slit') ? h('div', { class: 'row' }, F.btn(sec.key === 'tube' ? 'Cut the tube open' : 'Close the tube again', () => { const s = o().sec; s.dims.slit = Object.assign({}, s.dims[s.key]); s.dims.tube = Object.assign({}, s.dims[s.key]); s.key = s.key === 'tube' ? 'slit' : 'tube'; save(); rebuild(); }, 'ghost', 'i-sec-slit')) : null), torsionCalc(sec, Pr), shapeCard(true)); }
    else if (id === 'bars') cb.append(barsCard(), barsCalc());
    else if (id === 'elastic') cb.append(elasticCard(), elasticCalc(), shapeCard(true));
    else if (id === 'beam') cb.append(beamCard(), card('At the cut', 'linear-stress', h('div', { id: 'som-cut' }, ...cutKids().filter(Boolean))), elasticCard(), shapeCard(true));
    else if (id === 'energy') cb.append(energyCard(), energyCalc(), shapeCard(true));
    else if (id === 'buckling') cb.append(buckCard(), buckCalc(), shapeCard(true));
    else if (id === 'derive') cb.append(card('Derivation', h('div', { class: 'explist' }, ...Object.entries(DERIV).map(([k, d]) => h('button', { class: 'expitem' + (o().derive.which === k ? ' on' : ''), type: 'button', onclick: () => { o().derive.which = k; save(); rebuild(); } }, h('div', { class: 'en' }, d.name), h('div', { class: 'eb' }, `${d.steps.length} steps`))))));
    void m;
  }
  function bendCalc(Pr) {
    const b = o().bend, sf = SO.sigmaFn(Pr, b.N, b.My, b.Mz), D2 = Pr.Iy * Pr.Iz - Pr.Iyz * Pr.Iyz, pts = samplePts(getSec()), sv = pts.map(([y, z]) => sf.at(y - Pr.yS, z - Pr.zS)); let imax = 0, imin = 0; sv.forEach((v, i) => { if (v > sv[imax]) imax = i; if (v < sv[imin]) imin = i; }); const ex = pts.length ? { max: [pts[imax], sv[imax]], min: [pts[imin], sv[imin]] } : null;
    const I = (v) => nT(v / 1e4), sgn = (v) => (v < 0 ? '-' : '+'), pr = abs(Pr.Iyz) <= 1e-9 * Pr.I1;
    const lines = [`\\Delta &= I_y I_z - I_{yz}^2 = ${I(Pr.Iy)}\\cdot ${I(Pr.Iz)} - (${I(Pr.Iyz)})^2 = ${nT(D2 / 1e8)}${U('cm^8')}`,
      `\\frac{N}{A} &= \\frac{${fT(b.N, 1)}\\cdot 10^3${U('N')}}{${nT(Pr.A)}${U('mm^2')}} = ${fT(sf.a, 3)}${U('MPa')}`,
      `c_z &= \\frac{I_z M_y - I_{yz} M_z}{\\Delta}`, `&= \\frac{${I(Pr.Iz)}\\cdot ${fT(b.My, 2)} - (${I(Pr.Iyz)})\\cdot ${fT(b.Mz, 2)}}{${nT(D2 / 1e8)}}\\,\\frac{\\mathrm{cm^4\\,kN\\,m}}{\\mathrm{cm^8}} = ${nT(sf.cz)}${U('N/mm^3')}`,
      `c_y &= \\frac{I_{yz} M_y - I_y M_z}{\\Delta}`, `&= \\frac{${I(Pr.Iyz)}\\cdot ${fT(b.My, 2)} - ${I(Pr.Iy)}\\cdot ${fT(b.Mz, 2)}}{${nT(D2 / 1e8)}}\\,\\frac{\\mathrm{cm^4\\,kN\\,m}}{\\mathrm{cm^8}} = ${nT(sf.cy)}${U('N/mm^3')}`];
    return card('σ(y, z), written out', 'linear-stress',
      tex([`\\sigma &= \\frac{N}{A} + \\frac{I_z M_y - I_{yz} M_z}{\\Delta}\\,z + \\frac{I_{yz} M_y - I_y M_z}{\\Delta}\\,y`]),
      pr ? txl('Principal axes ($I_{yz} = 0$): this is $\\sigma = \\dfrac{N}{A} + \\dfrac{M_y}{I_y}z - \\dfrac{M_z}{I_z}y$.') : txl('$I_{yz} \\ne 0$: a moment about $y$ alone also bends about $z$.'),
      tex(lines),
      tex([`\\sigma(y, z) &= ${fT(sf.a, 3)} ${sgn(sf.cz)} ${nT(abs(sf.cz))}\\,z ${sgn(sf.cy)} ${nT(abs(sf.cy))}\\,y \\quad [\\mathrm{MPa};\\ y, z \\text{ in mm}]`], true),
      abs(sf.cz) > 1e-15 ? tex([`\\sigma = 0:\\; z &= ${fT(-sf.a / sf.cz, 2)} ${sgn(-sf.cy / sf.cz)} ${nT(abs(sf.cy / sf.cz))}\\,y`, `&\\text{(neutral axis at } ${fT((atan2(-sf.cy, sf.cz) * 180) / PI, 2)}^\\circ \\text{ to } y)`]) : txl('neutral axis: vertical'),
      ex ? tex([`\\sigma_{\\max} &= \\mathbf{${fT(ex.max[1], 2)}}${U('MPa')} \\text{ at } (${fT(ex.max[0][0] - Pr.yS, 1)},\\ ${fT(ex.max[0][1] - Pr.zS, 1)})`, `\\sigma_{\\min} &= \\mathbf{${fT(ex.min[1], 2)}}${U('MPa')} \\text{ at } (${fT(ex.min[0][0] - Pr.yS, 1)},\\ ${fT(ex.min[0][1] - Pr.zS, 1)}), \\quad f_y = ${mat().fy}${U('MPa')}`], true) : null);
  }
  function shearCalc(sec, Pr) {
    const q = o().shear;
    if (!sec.thin) { const J = SO.jourawski(sec, Pr, q.Qz), i0 = J.z.findIndex((z) => z >= 0), S0 = J.S[i0], b0 = J.b[i0], t0 = (q.Qz * 1e3 * S0) / (Pr.Iy * b0);
      return card('Jourawski', 'shear-flow', tex([`\\tau(z) &= \\frac{Q_z\\,S_y(z)}{I_y\\,b(z)}`]), txl('At the centroid, with the first moment $S$ of the area below and the width $b$ there:'),
        tex([`\\tau(0) &= \\frac{${fT(q.Qz, 1)}\\cdot 10^3${U('N')}\\cdot ${nT(S0)}${U('mm^3')}}{${nT(Pr.Iy)}${U('mm^4')}\\cdot ${fT(b0, 1)}${U('mm')}} = ${fT(t0, 3)}${U('MPa')}`, `\\tau_{\\max} &= \\mathbf{${fT(J.max[1], 3)}}${U('MPa')}, \\qquad \\frac{\\tau_{\\max}}{Q/A} = ${fT(J.max[1] / ((q.Qz * 1e3) / Pr.A), 3)}${sec.key === 'rect' ? '\\;(\\text{rectangle: } 3/2)' : sec.key === 'circle' ? '\\;(\\text{circle: } 4/3)' : ''}`], true)); }
    const sh = SO.shearFlow(sec.thin, q.Qy, q.Qz), scn = SO.shearCentre(sec.thin), TP = sh.TP, kids = ['shear-flow'];
    kids.push(txl(`Thin-walled, centre lines: $A = ${nT(TP.A / 100)}$ cm², $I_y = ${nT(TP.Iy / 1e4)}$, $I_z = ${nT(TP.Iz / 1e4)}$, $I_{yz} = ${nT(TP.Iyz / 1e4)}$ cm⁴.`),
      tex([`\\frac{\\partial q}{\\partial s} &= -t\\,\\frac{\\partial\\sigma}{\\partial x}`, `q(s) &= q(0) - \\frac{Q_z}{I_y}\\int_0^s z\\,t\\,\\mathrm ds - \\frac{Q_y}{I_z}\\int_0^s y\\,t\\,\\mathrm ds`]),
      sh.nC ? tex([`q &= q_{\\text{open}} + q_0, \\qquad \\oint \\frac{q}{t}\\,\\mathrm ds = 0 \\;\\Rightarrow\\; q_0 = ${Array.from(sh.qc).map((v) => fT(v, 2)).join(',\\ ')}${U('N/mm')}`]) : txl('Open section: $q = 0$ at the free edges.'));
    let qmax = [0, 0, 0]; sh.segs.forEach((s2, e) => { for (let k = 0; k <= 40; k++) { const x = (k / 40) * s2.l, v = sh.flow(e, x); if (abs(v) > abs(qmax[0])) qmax = [v, e, x]; } });
    const sMax = sh.segs[qmax[1]];
    kids.push(tex([`q_{\\max} &= \\mathbf{${fT(qmax[0], 2)}}${U('N/mm')}`, `\\tau &= \\frac{q}{t} = \\frac{${fT(qmax[0], 2)}}{${fT(sMax.t, 1)}} = \\mathbf{${fT(qmax[0] / sMax.t, 2)}}${U('MPa')}`], true),
      tex([`\\textstyle\\int q\\,\\mathrm ds &= (${fT(sh.Fy / 1e3, 3)},\\ ${fT(sh.Fz / 1e3, 3)})${U('kN')} = (Q_y, Q_z)\\;\\checkmark`, `y_M &= ${fT(scn.yM, 2)}${U('mm')}, \\quad z_M = ${fT(scn.zM, 2)}${U('mm')} \\;\\text{from } S`]));
    if (sec.key === 'C') { const d = sec.dims, bp = d.b - d.tw / 2, hp = d.h - d.tf, e = (bp * bp * hp * hp * d.tf) / (4 * TP.Iy); kids.push(tex([`e &= \\frac{b'^2 h'^2 t_f}{4 I_y} = \\frac{${fT(bp, 1)}^2\\cdot ${fT(hp, 1)}^2\\cdot ${fT(d.tf, 1)}}{4\\cdot ${nT(TP.Iy)}} = \\mathbf{${fT(e, 2)}}${U('mm')} \\text{ outside the web}`])); }
    if (abs(q.dyQ) > 0.5) kids.push(tex([`T &= Q_z\\,e = ${fT(q.Qz, 1)}${U('kN')}\\cdot ${fT(q.dyQ, 0)}${U('mm')} = ${fT((q.Qz * q.dyQ) / 1e3, 3)}${U('kN\\,m')} \\;\\text{(twists the section)}`]));
    return card('Shear flow, written out', ...kids);
  }
  function torsionCalc(sec, Pr) {
    const q = o().tors, m = mat(), r = torsionResult(sec, Pr), T = q.T, deg = (v) => fT((v * 180) / PI, 4);
    if (r.kind === 'circ') return card('Circular shaft', 'torsion-pde', tex([`I_p &= \\frac{\\pi}{2}\\left(R^4 - r^4\\right) = \\frac{\\pi}{2}\\left(${fT(r.Ro, 1)}^4 - ${fT(r.Ri, 1)}^4\\right) = ${nT(r.Ip)}${U('mm^4')}`, `\\tau_{\\max} &= \\frac{T R}{I_p} = \\frac{${fT(T, 3)}\\cdot 10^6\\cdot ${fT(r.Ro, 1)}}{${nT(r.Ip)}} = \\mathbf{${fT(r.tmax, 2)}}${U('MPa')}`, `\\vartheta' &= \\frac{T}{G I_p} = \\frac{${fT(T, 3)}\\cdot 10^6}{${nT(m.G)}\\cdot ${nT(r.Ip)}} = ${nT(r.theta)}${U('rad/mm')}`, `\\varphi &= \\vartheta' L = ${nT(r.theta)}\\cdot ${nT(q.L)} = ${nT(r.phi)}${U('rad')} = \\mathbf{${deg(r.phi)}^\\circ}`], true));
    if (r.kind === 'rect') { const d = sec.dims, hb = max(d.b, d.h) / min(d.b, d.h); return card('Saint-Venant rectangle', 'torsion-pde', txl(`$h/b = ${fT(hb, 2)}$: the coefficients from the Fourier series of Prandtl’s stress function: $c_1 = ${fT(r.r.c1, 4)}$, $c_2 = ${fT(r.r.c2, 4)}$.`), tex([`I_T &= c_1\\,h\\,b^3 = ${nT(r.IT)}${U('mm^4')}, \\qquad W_T = c_2\\,h\\,b^2 = ${nT(r.r.Wt)}${U('mm^3')}`, `\\tau_{\\max} &= \\frac{T}{W_T} = \\frac{${fT(T, 3)}\\cdot 10^6}{${nT(r.r.Wt)}} = \\mathbf{${fT(r.tmax, 2)}}${U('MPa')} \\;\\text{(middle of the long sides)}`, `\\varphi &= \\frac{T L}{G I_T} = \\frac{${fT(T, 3)}\\cdot 10^6\\cdot ${nT(q.L)}}{${nT(m.G)}\\cdot ${nT(r.IT)}} = \\mathbf{${deg(r.phi)}^\\circ}`], true)); }
    if (r.kind === 'thin') { const to = r.to, kids = ['torsion-pde'];
      if (to.nC) { const ds = to.segs.reduce((a, s2, e) => a + (to.topo.cells[0].some(([ee]) => ee === e) ? s2.l / s2.t : 0), 0);
        kids.push(txl(`Cells: $A_m = ${to.Am.map((a) => nT(abs(a) / 100)).join(',\\ ')}$ cm² (area inside the centre line).`), to.nC === 1 ? tex([`\\oint \\frac{\\mathrm ds}{t} &= ${fT(ds, 2)}, \\qquad I_{T} = \\frac{4 A_m^2}{\\oint \\mathrm ds/t} = \\frac{4\\cdot ${nT(abs(to.Am[0]))}^2}{${fT(ds, 2)}} = \\mathbf{${nT(to.ITc / 1e4)}}${U('cm^4')}`]) : tex([`\\textstyle\\sum_i \\left(\\oint_{ij}\\frac{\\mathrm ds}{t}\\right) q_i &= 2A_j\\,G\\vartheta' \\;\\Rightarrow\\; I_{T,\\text{cells}} = \\mathbf{${nT(to.ITc / 1e4)}}${U('cm^4')}`]),
          tex([`q &= \\frac{T}{2A_m} \\;\\to\\; ${to.q.map((v) => fT(abs(v), 2)).join(',\\ ')}${U('N/mm')}, \\qquad \\tau_{\\max} = \\frac{q}{t_{\\min}} = \\mathbf{${fT(max(...to.tauWall.map((w) => abs(w.closed))), 2)}}${U('MPa')}`], true)); }
      kids.push(tex([`I_{T,\\text{open}} &= \\tfrac13\\textstyle\\sum l\\,t^3 = ${nT(to.ITo / 1e4)}${U('cm^4')}${to.nC ? '\\;(\\text{small next to the cells})' : ''}`, `I_T &= \\mathbf{${nT(to.IT / 1e4)}}${U('cm^4')}, \\quad \\vartheta' = \\frac{T}{G I_T} = ${nT(to.theta)}${U('rad/mm')}, \\quad \\varphi = \\mathbf{${deg(r.phi)}^\\circ}`], true));
      if (!to.nC) kids.push(tex([`\\tau_{\\max} &= \\frac{T\\,t_{\\max}}{I_T} = \\mathbf{${fT(to.tmax, 2)}}${U('MPa')}`], true));
      if (sec.key === 'slit' || sec.key === 'tube') { const d = sec.dims, Rm = (d.D - d.t) / 2; kids.push(tex([`\\frac{I_{T,\\text{closed}}}{I_{T,\\text{slit}}} &= \\frac{2\\pi R_m^3 t}{\\tfrac13\\,2\\pi R_m t^3} = 3\\left(\\frac{R_m}{t}\\right)^2 = 3\\left(\\frac{${fT(Rm, 1)}}{${fT(d.t, 1)}}\\right)^2 = \\mathbf{${fT(3 * (Rm / d.t) ** 2, 0)}}`])); }
      return card(to.nC ? 'Bredt' : 'Open thin-walled section', ...kids); }
    return card('Torsion', h('p', { class: 'note' }, 'Pick a shape with walls, a circle, a tube or a rectangle.'));
  }
  function barsCard() {
    const b = o().bars, mode = (k, ic, tip) => icoBtn(ic, tip, b.mode === k, () => { b.mode = k; save(); rebuild(); });
    return card('Bar', h('div', { class: 'icorow' }, mode('step', 'i-bar-step', 'Stepped bar, one end fixed'), mode('clamp', 'i-bar-clamp', 'Clamped at both ends (indeterminate)'), mode('comp', 'i-bar-comp', 'Two materials in parallel (compound bar)')),
      slider({ k: 'A1', l: 'A₁ [mm²]', min: 20, max: 4000, step: 10 }, () => b.A1, (v) => (b.A1 = v)), slider({ k: 'A2', l: 'A₂ [mm²]', min: 20, max: 4000, step: 10 }, () => b.A2, (v) => (b.A2 = v)),
      slider({ k: 'L1', l: b.mode === 'comp' ? 'L [mm]' : 'L₁ [mm]', min: 100, max: 5000, step: 10 }, () => b.L1, (v) => (b.L1 = v)), b.mode !== 'comp' ? slider({ k: 'L2', l: 'L₂ [mm]', min: 100, max: 5000, step: 10 }, () => b.L2, (v) => (b.L2 = v)) : null,
      slider({ k: 'F1', l: b.mode === 'comp' ? 'F [kN]' : 'F₁ at the step [kN]', min: -300, max: 300, step: 1 }, () => b.F1, (v) => (b.F1 = v)), b.mode === 'step' ? slider({ k: 'F2', l: 'F₂ at the end [kN]', min: -300, max: 300, step: 1 }, () => b.F2, (v) => (b.F2 = v)) : null,
      slider({ k: 'dT', l: 'ΔT [K]', min: -100, max: 100, step: 1 }, () => b.dT, (v) => (b.dT = v)),
      h('div', { class: 'row', style: 'gap:6px' }, h('select', { class: 'select sm', onchange: (e) => { o().mat = e.target.value; save(); rebuild(); } }, ...Object.entries(MATS).map(([k, m]) => h('option', { value: k, selected: o().mat === k ? true : null }, m.name))), b.mode === 'comp' ? h('select', { class: 'select sm', onchange: (e) => { b.mat2 = e.target.value; save(); rebuild(); } }, ...Object.entries(MATS).map(([k, m]) => h('option', { value: k, selected: b.mat2 === k ? true : null }, m.name))) : null));
  }
  function barsCalc() {
    const b = o().bars, r = barsResult(), m = mat(), E = m.E, kN = (v) => fT(v / 1e3, 3);
    if (b.mode === 'step') return card('Stepped bar', 'bars', tex([`N_2 &= F_2 = ${fT(b.F2, 2)}${U('kN')}, \\qquad N_1 = F_1 + F_2 = ${fT(b.F1 + b.F2, 2)}${U('kN')}`, `\\sigma_1 &= \\frac{N_1}{A_1} = \\frac{${fT(b.F1 + b.F2, 2)}\\cdot 10^3}{${nT(b.A1)}} = ${fT(r.segs[0].N / b.A1, 2)}${U('MPa')}, \\qquad \\sigma_2 = \\frac{N_2}{A_2} = ${fT(r.segs[1].N / b.A2, 2)}${U('MPa')}`]),
      tex([`\\Delta l &= \\frac{N_1 L_1}{E A_1} + \\frac{N_2 L_2}{E A_2} + \\alpha\\,\\Delta T\\,L`, `&= \\frac{${nT(r.segs[0].N)}\\cdot ${nT(b.L1)}}{${nT(E)}\\cdot ${nT(b.A1)}} + \\frac{${nT(r.segs[1].N)}\\cdot ${nT(b.L2)}}{${nT(E)}\\cdot ${nT(b.A2)}} + ${nT(m.alpha)}\\cdot ${fT(b.dT, 0)}\\cdot ${nT(b.L1 + b.L2)}`, `&= ${fT((r.segs[0].N * b.L1) / (E * b.A1), 4)} + ${fT((r.segs[1].N * b.L2) / (E * b.A2), 4)} + ${fT(m.alpha * b.dT * (b.L1 + b.L2), 4)} = \\mathbf{${fT(r.u[2], 4)}}${U('mm')}`], true));
    if (b.mode === 'clamp') { const den = b.L1 / (E * b.A1) + b.L2 / (E * b.A2); return card('Clamped at both ends', 'bars', txl('One redundant: $N_1 = N$, $N_2 = N - F_1$. The walls do not move:'),
      tex([`\\frac{N L_1}{E A_1} + \\frac{(N - F_1) L_2}{E A_2} + \\alpha\\,\\Delta T\\,(L_1 + L_2) &= 0`, `N = \\frac{F_1\\,L_2/(E A_2) - \\alpha\\,\\Delta T\\,L}{L_1/(E A_1) + L_2/(E A_2)} &= \\frac{${nT(b.F1 * 1e3)}\\cdot ${nT(b.L2 / (E * b.A2))} - ${nT(m.alpha * b.dT * (b.L1 + b.L2))}}{${nT(den)}}${U('N')}`, `N_1 &= \\mathbf{${kN(r.segs[0].N)}}${U('kN')}, \\qquad N_2 = N_1 - F_1 = \\mathbf{${kN(r.segs[1].N)}}${U('kN')}`, `\\sigma_1 &= ${fT(r.segs[0].N / b.A1, 2)}${U('MPa')}, \\quad \\sigma_2 = ${fT(r.segs[1].N / b.A2, 2)}${U('MPa')}, \\quad u_{\\text{step}} = ${fT(r.u[1], 4)}${U('mm')}`], true), b.dT ? txl('Heated between two walls the bar cannot expand: $\\sigma = -E\\alpha\\Delta T$ without any load.') : null); }
    const m2 = MATS[b.mat2]; return card('Compound bar', 'bars', tex([`N_1 + N_2 &= F, \\qquad \\frac{N_1}{E_1 A_1} + \\alpha_1\\Delta T = \\frac{N_2}{E_2 A_2} + \\alpha_2\\Delta T`, `N_1 &= \\frac{F/(E_2A_2) + (\\alpha_2 - \\alpha_1)\\Delta T}{1/(E_1A_1) + 1/(E_2A_2)} = \\mathbf{${kN(r.segs[0].N)}}${U('kN')}, \\qquad N_2 = \\mathbf{${kN(r.segs[1].N)}}${U('kN')}`, `\\sigma_1 &= ${fT(r.segs[0].N / b.A1, 2)}${U('MPa')}\\;(\\text{${m.name}}), \\quad \\sigma_2 = ${fT(r.segs[1].N / b.A2, 2)}${U('MPa')}\\;(\\text{${m2.name}}), \\quad \\Delta l = ${fT(r.u[1], 4)}${U('mm')}`], true), txl('Without $\\Delta T$ the load splits like springs in parallel, $N_i/F = E_iA_i/\\sum EA$; a temperature change alone stresses both bars when $\\alpha_1 \\ne \\alpha_2$.'));
  }
  function elasticCard() {
    const e = o().elastic, sup = (side) => h('div', { class: 'icorow' }, ...[['fixed', 'i-st-fixed', 'Clamped'], ['pin', 'i-st-pin', 'Pinned'], ['guided', 'i-st-slide', 'Guided'], ['free', 'i-el-free', 'Free']].map(([k, ic, tip]) => icoBtn(ic, `${side === 'left' ? 'Left' : 'Right'}: ${tip}`, e[side] === k, () => { e[side] = k; save(); rebuild(); })));
    return card('Beam', h('div', { class: 'stkv' }, h('span', { class: 'k' }, 'left'), sup('left'), h('span', { class: 'k' }, 'right'), sup('right')),
      slider({ k: 'L', l: 'L [m]', min: 0.5, max: 12, step: 0.1 }, () => e.L, (v) => { e.L = v; e.a = min(e.a, v); e.b = min(e.b, v); }),
      slider({ k: 'q1', l: 'q at the left [kN/m]', min: -50, max: 50, step: 0.5 }, () => e.q1, (v) => (e.q1 = v)), slider({ k: 'q2', l: 'q at the right [kN/m]', min: -50, max: 50, step: 0.5 }, () => e.q2, (v) => (e.q2 = v)),
      slider({ k: 'F', l: 'F [kN] (down +)', min: -100, max: 100, step: 0.5 }, () => e.F, (v) => (e.F = v)), slider({ k: 'a', l: 'F at x [m]', min: 0, max: e.L, step: 0.05 }, () => e.a, (v) => (e.a = v)),
      slider({ k: 'M', l: 'couple M [kN·m]', min: -100, max: 100, step: 0.5 }, () => e.M, (v) => (e.M = v)), slider({ k: 'b', l: 'M at x [m]', min: 0, max: e.L, step: 0.05 }, () => e.b, (v) => (e.b = v)),
      h('label', { class: 'switch' }, (() => { const c = h('input', { type: 'checkbox' }); c.checked = e.timo; c.onchange = () => { e.timo = c.checked; save(); rebuild(); }; return c; })(), h('span', {}, 'Timoshenko (shear deformation)')));
  }
  function elasticCalc() {
    const e = o().elastic, r = elasticResult(); if (r.eb.err) return card('Integration', h('p', { class: 'note', style: 'color:var(--load)' }, r.eb.err));
    const C = r.eb.C, bc = { fixed: 'w = 0,\\ \\varphi = 0', pin: 'w = 0,\\ M = 0', guided: '\\varphi = 0,\\ Q = 0', free: 'M = 0,\\ Q = 0' };
    return card('Four integrations', 'beam-ode', tex([`EI &= E\\,I_y = ${nT(mat().E)}${U('N/mm^2')}\\cdot ${nT(r.Pr.Iy)}${U('mm^4')} = \\mathbf{${nT(r.EI)}}${U('kN\\,m^2')}`]),
      tex([`Q(x) &= C_1 - \\textstyle\\int_0^x q\\,\\mathrm d\\xi - \\sum F_i\\langle x - a_i\\rangle^0`, `M(x) &= C_2 + \\textstyle\\int_0^x Q\\,\\mathrm d\\xi + \\sum \\hat M_j\\langle x - b_j\\rangle^0`, `EI\\,\\varphi(x) &= EI\\,C_3 + \\textstyle\\int_0^x M\\,\\mathrm d\\xi`, `w(x) &= C_4 - \\textstyle\\int_0^x \\varphi\\,\\mathrm d\\xi${e.timo ? ' + \\int_0^x \\frac{Q}{\\kappa G A}\\,\\mathrm d\\xi' : ''}`]),
      tex([`x = 0:&\\quad ${bc[e.left]}`, `x = L:&\\quad ${bc[e.right]}`]), txl('Four linear equations for $C_1 \\dots C_4$:'),
      tex([`C_1 &= Q(0) = \\mathbf{${fT(C[0], 3)}}${U('kN')}, \\qquad C_2 = M(0) = \\mathbf{${fT(C[1], 3)}}${U('kN\\,m')}`, `C_3 &= \\varphi(0) = \\mathbf{${fT(C[2] * 1000, 4)}}${U('mrad')}, \\qquad C_4 = w(0) = \\mathbf{${fT(C[3] * 1000, 4)}}${U('mm')}`]),
      tex([`w_{\\max} &= \\mathbf{${fT(r.eb.wmax[1] * 1000, 4)}}${U('mm')} \\text{ at } x = ${fT(r.eb.wmax[0], 3)}${U('m')}`].concat(r.tm ? [`\\kappa G A &= G\\,A_s = ${nT(mat().G)}\\cdot ${nT(r.As)} = ${nT(r.kGA)}${U('kN')} \\;\\Rightarrow\\; w_{\\max} = \\mathbf{${fT(r.tm.wmax[1] * 1000, 4)}}${U('mm')}\\;(+${fT(100 * (r.tm.wmax[1] / r.eb.wmax[1] - 1), 2)}\\,\\%)`] : []), true),
      txl('Shear deformation matters for short, deep beams: its share grows like $(E/G)(h/L)^2$.'));
  }
  function energyCard() { const e = o().energy, mode = (k, ic, tip) => icoBtn(ic, tip, e.mode === k, () => { e.mode = k; save(); rebuild(); }); return card('Structure', h('div', { class: 'icorow' }, mode('arc', 'i-en-arc', 'Quarter circle (Castigliano)'), mode('ring', 'i-en-ring', 'Ring pressed by two forces (Menabrea)')), slider({ k: 'R', l: 'radius R [m]', min: 0.1, max: 5, step: 0.05 }, () => e.R, (v) => (e.R = v)), slider({ k: 'F', l: 'F [kN]', min: 0.1, max: 200, step: 0.1 }, () => e.F, (v) => (e.F = v)), e.mode === 'arc' ? h('div', { class: 'row', style: 'gap:10px' }, ...[['N', 'normal-force energy'], ['Q', 'shear energy']].map(([k, l]) => h('label', { class: 'switch' }, (() => { const c = h('input', { type: 'checkbox' }); c.checked = e[k]; c.onchange = () => { e[k] = c.checked; save(); rebuild(); }; return c; })(), h('span', {}, l)))) : null); }
  function energyCalc() {
    const e = o().energy, r = energyResult();
    if (r.mode === 'arc') { const x = r.r, b = r.rb; return card('Castigliano', 'energy', tex([`M(\\varphi) &= F R\\sin\\varphi, \\quad \\frac{\\partial M}{\\partial F} = R\\sin\\varphi, \\quad \\mathrm ds = R\\,\\mathrm d\\varphi`]),
      tex([`\\delta_v &= \\frac{\\partial U}{\\partial F} = \\frac{1}{EI}\\int_0^{\\pi/2} F R^2\\sin^2\\varphi\\; R\\,\\mathrm d\\varphi = \\frac{\\pi F R^3}{4 EI}`, `&= \\frac{\\pi\\cdot ${fT(e.F, 2)}\\cdot ${fT(e.R, 2)}^3}{4\\cdot ${nT(r.EI)}}${U('m')} = \\mathbf{${fT(b.dv * 1000, 4)}}${U('mm')}`], true),
      txl('A dummy force $H$ at the tip, $\\partial M/\\partial H = -R(1 - \\cos\\varphi)$:'), tex([`\\delta_h &= -\\frac{F R^3}{EI}\\int_0^{\\pi/2}(\\sin\\varphi - \\sin\\varphi\\cos\\varphi)\\,\\mathrm d\\varphi = -\\frac{F R^3}{2 EI} \\;\\Rightarrow\\; |\\delta_h| = \\mathbf{${fT(abs(b.dh) * 1000, 4)}}${U('mm')}`]),
      (e.N || e.Q) ? tex([`&${e.N ? `N = -F\\sin\\varphi\\;(EA = ${nT(r.EA)}${U('kN')})` : ''}${e.N && e.Q ? ',\\quad ' : ''}${e.Q ? `Q = F\\cos\\varphi\\;(\\kappa G A = ${nT(r.kGA)}${U('kN')})` : ''}`, `\\delta_v &= \\mathbf{${fT(x.dv * 1000, 4)}}${U('mm')}\\;(+${fT(100 * (x.dv / b.dv - 1), 3)}\\,\\%), \\qquad |\\delta_h| = \\mathbf{${fT(abs(x.dh) * 1000, 4)}}${U('mm')}`]) : null); }
    const x = r.r; return card('Menabrea', 'energy', txl('Cut at the horizontal diameter: normal force $F/2$ and an unknown moment $X$.'), tex([`M(\\varphi) &= X - \\frac{F R}{2}(1 - \\cos\\varphi), \\qquad \\frac{\\partial M}{\\partial X} = 1`, `\\frac{\\partial U}{\\partial X} &= \\frac{4R}{EI}\\int_0^{\\pi/2} M\\,\\mathrm d\\varphi = 0 \\;\\Rightarrow\\; X\\frac{\\pi}{2} = \\frac{F R}{2}\\left(\\frac{\\pi}{2} - 1\\right)`, `X &= F R\\left(\\frac12 - \\frac1\\pi\\right) = ${fT(e.F, 2)}\\cdot ${fT(e.R, 2)}\\cdot ${fT(0.5 - 1 / PI, 5)} = \\mathbf{${fT(x.X, 4)}}${U('kN\\,m')}`, `M_F &= X - \\frac{F R}{2} = -\\frac{F R}{\\pi} = \\mathbf{${fT(x.Mload, 4)}}${U('kN\\,m')}`, `\\delta &= \\frac{\\partial U}{\\partial F} = \\left(\\frac{\\pi}{4} - \\frac{2}{\\pi}\\right)\\frac{F R^3}{EI} = \\mathbf{${fT(x.delta * 1000, 4)}}${U('mm')} \\text{ (diameter shortens)}`], true));
  }
  function buckCard() { const b = o().buck, view = (k, l) => h('button', { class: 'chip' + ((b.view || 'curve') === k ? ' on' : ''), type: 'button', onclick: () => { b.view = k; save(); rebuild(); } }, l);
    return card('Column', h('div', { class: 'icorow' }, ...[['cant', 'i-eu-cant', 'Fixed – free (β = 2)'], ['pp', 'i-eu-pp', 'Pinned – pinned (β = 1)'], ['fp', 'i-eu-fp', 'Fixed – pinned (β = 0.699)'], ['ff', 'i-eu-ff', 'Fixed – fixed (β = 0.5)']].map(([k, ic, tip]) => icoBtn(ic, tip, b.cs === k, () => { b.cs = k; save(); rebuild(); }))),
      slider({ k: 'L', l: 'L [m]', min: 0.3, max: 15, step: 0.05 }, () => b.L, (v) => (b.L = v)), slider({ k: 'f', l: 'F / F_k', min: 0, max: 0.98, step: 0.01 }, () => b.f, (v) => { b.f = v; b.anim = false; }), slider({ k: 'imp', l: 'imperfection w₀ = L / …', min: 100, max: 1000, step: 10 }, () => b.imp, (v) => (b.imp = v)),
      h('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap;margin-top:4px' }, F.btn(b.anim ? 'Stop the load ramp' : 'Ramp the load to F_k', () => { b.anim = !b.anim; b.mode = 1; st.bkT = 0; if (!b.anim) b.f = st.panes.buckling && st.panes.buckling.fNow != null ? +st.panes.buckling.fNow.toFixed(2) : b.f; save(); rebuild(); }, b.anim ? '' : 'primary', b.anim ? 'i-pause' : 'i-play')),
      h('div', { class: 'note', style: 'margin-top:8px' }, 'Shape'), h('div', { class: 'chips wrap' }, ...[1, 2, 3].map((n) => h('button', { class: 'chip' + ((b.mode || 1) === n ? ' on' : ''), type: 'button', onclick: () => { b.mode = n; if (n > 1) b.anim = false; save(); rebuild(); } }, n === 1 ? 'mode 1 with imperfection' : `eigenmode ${n}`))),
      h('div', { class: 'note', style: 'margin-top:8px' }, 'Side view'), h('div', { class: 'chips wrap' }, view('curve', 'σ_k over λ'), view('path', 'load–deflection'), view('cases', 'four Euler cases'))); }
  function buckCalc() { const r = buckResult(), b = o().buck, kids = ['buckling-eigen'];
    kids.push(tex([`I_{\\min} &= I_2 = ${nT(r.Imin / 1e4)}${U('cm^4')}\\;(\\text{weak axis})`, `A &= ${nT(r.A / 100)}${U('cm^2')}, \\quad i = \\sqrt{I/A} = ${fT(r.i, 2)}${U('mm')}`, `L_k &= \\beta L = ${fT(r.cs.beta, 3)}\\cdot ${fT(b.L, 2)}${U('m')} = ${fT(r.Lk / 1000, 3)}${U('m')}`, `\\lambda &= \\frac{L_k}{i} = \\frac{${nT(r.Lk)}}{${fT(r.i, 2)}} = \\mathbf{${fT(r.lam, 1)}}`]),
      tex([`F_k &= \\frac{\\pi^2 E I}{L_k^2} = \\frac{\\pi^2\\cdot ${nT(r.m.E)}\\cdot ${nT(r.Imin)}}{${nT(r.Lk)}^2}${U('N')} = \\mathbf{${fT(r.Fk, 2)}}${U('kN')}`, `\\sigma_k &= \\frac{\\pi^2 E}{\\lambda^2} = \\frac{\\pi^2\\cdot ${nT(r.m.E)}}{${fT(r.lam, 1)}^2} = ${fT(r.sk, 1)}${U('MPa')}`], true));
    if (r.steel) kids.push(txl(`$\\lambda_p = 104$ (S235, $\\sigma_p \\approx 190$ MPa), $\\lambda_y = (310 - f_y)/1.14 = ${fT(r.lamY, 1)}$: ${r.lam >= r.lamP ? '<b>Euler range</b>.' : r.lam > r.lamY ? '<b>Tetmajer range</b>:' : '<b>yield range</b>:'}`), r.lam < r.lamP ? tex([r.lam > r.lamY ? `\\sigma_k &= 310 - 1.14\\,\\lambda = 310 - 1.14\\cdot ${fT(r.lam, 1)} = \\mathbf{${fT(r.sNow, 1)}}${U('MPa')}, \\quad F_k = \\sigma_k A = \\mathbf{${fT((r.sNow * r.A) / 1e3, 2)}}${U('kN')}\\;(\\text{Euler: } ${fT(r.Fk, 1)})` : `\\sigma_k &= f_y, \\quad F = f_y A = ${fT((r.m.fy * r.A) / 1e3, 1)}${U('kN')}`]) : null);
    else kids.push(txl(`$\\lambda_p = \\pi\\sqrt{E/\\sigma_p} \\approx ${fT(r.lamP, 1)}$ ($\\sigma_p \\approx 0.8 f_y$): ${r.lam > r.lamP ? '<b>Euler range</b>' : '<b>inelastic range</b>: Euler overestimates'}.`));
    if (r.steel) { const lb = r.lam / r.lam1, ph = 0.5 * (1 + 0.34 * (lb - 0.2) + lb * lb), x = r.chi(r.lam); kids.push(txl('Design curve b ($\\alpha = 0.34$), from the imperfect column (Ayrton–Perry):'), tex([`\\lambda_1 &= \\pi\\sqrt{E/f_y} = ${fT(r.lam1, 1)}, \\qquad \\bar\\lambda = \\lambda/\\lambda_1 = ${fT(lb, 3)}`, `\\Phi &= \\tfrac12\\left[1 + \\alpha(\\bar\\lambda - 0.2) + \\bar\\lambda^2\\right] = ${fT(ph, 3)}`, `\\chi &= \\frac{1}{\\Phi + \\sqrt{\\Phi^2 - \\bar\\lambda^2}} = \\mathbf{${fT(x, 3)}}`, `N_b & = \\chi A f_y = \\mathbf{${fT((x * r.A * r.m.fy) / 1e3, 1)}}${U('kN')}\\;(\\text{no } \\gamma_{M1})`], true)); }
    kids.push(tex([`w_{\\max} &= \\frac{w_0}{1 - F/F_k} = \\frac{${fT((b.L * 1000) / b.imp, 1)}}{1 - ${fT(b.f, 2)}} = ${fT((b.L * 1000) / b.imp / (1 - b.f), 2)}${U('mm')}\\quad(\\times ${fT(1 / (1 - b.f), 2)})`]));
    const mu = MU[r.cs.id]; kids.push(tex([`k L &= ${mu.map((v) => fT(v, 4)).join(',\\ ')} \\;\\Rightarrow\\; F_n = \\frac{(kL)_n^2\\,EI}{L^2} = ${mu.map((v) => fT(((v * v * r.m.E * r.Imin) / (b.L * 1000) ** 2) / 1e3, 0)).join(',\\ ')}${U('kN')}`]));
    return card('Critical load', ...kids); }
  const REFS = 'D. Gross, W. Hauger, J. Schröder, W. A. Wall, <i>Technische Mechanik 2: Elastostatik</i> (Springer) · R. C. Hibbeler, <i>Mechanics of Materials</i> (Pearson) · S. P. Timoshenko, J. M. Gere, <i>Mechanics of Materials</i> and <i>Theory of Elastic Stability</i> · T. H. G. Megson, <i>Aircraft Structures for Engineering Students</i> (thin-walled sections) · W. C. Young, R. G. Budynas, <i>Roark’s Formulas for Stress and Strain</i>';
  const MATHFOR = { section: ['area-moments', 'axis-rotation'], bending: ['linear-stress'], shear: ['shear-flow'], elastic: ['beam-ode'], beam: ['beam-ode', 'linear-stress', 'shear-flow'], torsion: ['torsion-pde'], bars: ['bars'], energy: ['energy'], buckling: ['buckling-eigen'], derive: ['area-moments', 'linear-stress', 'shear-flow', 'torsion-pde', 'buckling-eigen', 'energy'] };
  function theory(id) {
    const r = `<h4>Further reading</h4><p class="refs">${REFS}</p>`;
    const T = {
      section: '<h3>Section properties</h3><p>The centroid is where the first moments of area vanish; about axes through it the second moments $I_y = \\int z^2\\,\\mathrm dA$, $I_z = \\int y^2\\,\\mathrm dA$ and the product moment $I_{yz} = -\\int yz\\,\\mathrm dA$ describe how the area is spread. They add up part by part with Steiner’s theorem, $I_{\\bar y} = I_y + a^2 A$ (holes count negative).</p><p>Turning the axes by $\\varphi$ changes them like a stress tensor:</p>$$I_\\eta = \\frac{I_y + I_z}{2} + \\frac{I_y - I_z}{2}\\cos 2\\varphi + I_{yz}\\sin 2\\varphi$$<p>The principal axes, $\\tan 2\\varphi^* = 2I_{yz}/(I_y - I_z)$, carry the extreme values $I_1$, $I_2$ and no product moment; the circle of inertia draws all of this. Symmetry axes are always principal. The inertia ellipse has semi-axes $i_2$ along axis 1 and $i_1$ along axis 2.</p>',
      bending: '<h3>Bending</h3><p>Plane sections stay plane, so $\\sigma$ is linear over the section:</p>$$\\sigma = \\frac{N}{A} + \\frac{I_z M_y - I_{yz} M_z}{\\Delta}\\,z + \\frac{I_{yz} M_y - I_y M_z}{\\Delta}\\,y, \\qquad \\Delta = I_y I_z - I_{yz}^2$$<p>$\\sigma = 0$ is the neutral axis; without $N$ it passes through the centroid. In principal axes this reduces to $\\sigma = N/A + M_y z/I_y - M_z y/I_z$. Unsymmetric sections (L, Z) loaded about $y$ alone bend sideways too: oblique bending. The stress body on the right erects $\\sigma$ along the beam axis: a plane.</p>',
      shear: '<h3>Shear</h3><p>A shear force means a changing bending moment, and the changing bending stress must be balanced by shear on longitudinal cuts. In solid sections this gives Jourawski’s $\\tau = Q S/(I b)$. In thin walls the shear flow $q = \\tau t$ obeys $\\partial q/\\partial s = -t\\,\\partial\\sigma/\\partial x$: zero at free edges, linear along flanges, parabolic in webs; closed cells need one compatibility condition each. The shear centre is the point through which the load must pass so that the section bends without twisting; for a channel it lies outside the web.</p>',
      elastic: '<h3>The elastic line</h3><p>$q$, $Q$, $M$, the rotation $\\varphi$ and the deflection $w$ are linked by four first-order equations,</p>$$Q\' = -q, \\qquad M\' = Q, \\qquad EI\\,\\varphi\' = M, \\qquad w\' = -\\varphi$$<p>so four integrations with four constants solve any single-span beam, statically determinate or not. Each end supplies two boundary conditions. Timoshenko adds the shear strain: $w\' = -\\varphi + Q/(\\kappa G A)$. The bent beam is drawn to scale when the deflection is visible, otherwise enlarged moderately; the factor is printed.</p>',
      beam: '<h3>A beam, cut anywhere</h3><p>Cut the beam at $x$: the left part pulls on the right part with the internal forces $Q(x)$ and $M(x)$ (positive face: $Q$ down, $M$ sagging). Equilibrium of a slice gives $Q\' = -q$ and $M\' = Q$; the four integrations of the elastic line give the constants from the supports.</p><p>In the cross-section at $x$ the bending moment produces the linear $\\sigma(z) = M z/I_y$ (zero on the neutral axis through the centroid), and the shear force the Jourawski distribution $\\tau(z) = Q S(z)/(I_y b(z))$: largest at the neutral axis, zero at the free top and bottom faces. Slide the cut: where $M$ is extreme, $Q$ passes through zero.</p>',
      torsion: '<h3>Torsion</h3><p>Circular shafts: $\\tau = T r/I_p$ and $\\vartheta\' = T/(G I_p)$. Non-circular sections warp: a rectangle has $\\tau_{\\max}$ at the middle of its long sides (Saint-Venant, Prandtl’s stress function). Thin-walled closed cells carry a constant shear flow $q = T/(2A_m)$ (Bredt) and are very stiff, $I_T = 4A_m^2/\\oint \\mathrm ds/t$; open walls carry the torque only by stress that reverses across the thickness, $I_T = \\tfrac13\\sum l t^3$, and are soft. A slit tube is about $3(R/t)^2$ times softer than a closed one.</p>',
      bars: '<h3>Tension and compression</h3><p>$\\sigma = N/A$, $\\varepsilon = \\sigma/E + \\alpha\\Delta T$, $\\Delta l = \\int N/(EA)\\,\\mathrm dx + \\int \\alpha\\Delta T\\,\\mathrm dx$. Statically indeterminate bars need one compatibility condition per redundant: a bar between two walls cannot change its length, so heating it builds up $\\sigma = -E\\alpha\\Delta T$; bars in parallel stretch together and share the load in proportion to $EA$.</p>',
      energy: '<h3>Energy methods</h3><p>The strain energy</p>$$U = \\int \\frac{M^2}{2EI} + \\frac{N^2}{2EA} + \\frac{\\kappa Q^2}{2GA}\\,\\mathrm ds$$<p>Castigliano: the displacement at a load in its direction is $\\partial U/\\partial F$ (add a dummy force where no load acts). Menabrea: a redundant force or moment makes $U$ stationary, a minimum: $\\partial U/\\partial X = 0$.</p>',
      buckling: '<h3>Buckling</h3><p>Equilibrium in the deformed position turns $EI\\,w\'\' = -F w$ into an eigenvalue problem; the smallest eigenvalue is Euler’s load $F_k = \\pi^2 EI/L_k^2$ with $L_k = \\beta L$. The weak principal axis ($I_2$) governs. $\\sigma_k = \\pi^2E/\\lambda^2$ holds for slender columns ($\\lambda$ above $\\lambda_p$); stockier ones yield first. A column with an initial bow $w_0$ deflects $w_0/(1 - F/F_k)$: ramp the load and watch the deflection run away near $F_k$. The higher eigenmodes need braces at their nodes.</p>',
      derive: '<h3>Derivations</h3><p>Steiner, Navier, Jourawski and the shear flow, Bredt, Euler and Castigliano, each built from equilibrium, compatibility and Hooke. The Math notes behind them go one level deeper.</p>',
    };
    return (T[id] || T.section) + r;
  }
  function theoryEl(id) { const el = TX.mixed(theory(id)); el.className = 'theory'; const links = (MATHFOR[id] || []).map((t) => { const n = MB.MathNotes && MB.MathNotes.byId(t); return n ? mlink(t, n.title) : null; }).filter(Boolean); if (links.length) el.prepend(h('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px' }, ...links)); return el; }

  /* ---------------- pointer input ---------------- */
  function bind(P, id) {
    const cv = P.main.cv; cv.style.touchAction = 'none'; let drag = null;
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId); const sx = e.offsetX, sy = e.offsetY, V = P.V; if (id === 'beam') { drag = { k: 'beam' }; move(e); return; } if (!V) return;
      if (id === 'section' && o().sec.key === 'custom') { const y = V.yw(sx), z = V.zw(sy), k = o().sec.custom.findIndex((r) => abs(y - r.y) <= r.b / 2 && abs(z - r.z) <= r.h / 2); if (k >= 0) { drag = { k: 'rect', i: k, y, z, y0: o().sec.custom[k].y, z0: o().sec.custom[k].z }; return; } }
      drag = { k: id }; move(e);
    });
    const move = (e) => { if (drag && drag.k === 'beam' && P.bx) { const B = o().beam; B.anim = false; B.x = max(0, min(P.bx.L, round(((e.offsetX - P.bx.x0) / P.bx.sx) * 100) / 100)); if (performance.now() - (st.bmUp || 0) > 120) { st.bmUp = performance.now(); refreshCut(); } return; }
      if (!drag || !P.V || !P.Pr) return; const V = P.V, Pr = P.Pr, sx = e.offsetX, sy = e.offsetY;
      if (drag.k === 'rect') { const r = o().sec.custom[drag.i]; r.y = round((drag.y0 + V.yw(sx) - drag.y) / 2) * 2; r.z = round((drag.z0 + V.zw(sy) - drag.z) / 2) * 2; return; }
      const cx = V.X(Pr.yS), cy = V.Y(Pr.zS), ang = atan2(sy - cy, sx - cx);
      if (drag.k === 'section') o().sec.phi = Math.atan(Math.tan(ang));
      else if (drag.k === 'bending') { const b = o().bend, Mm = hypot(b.My, b.Mz) || 10; b.My = round(Mm * cos(ang) * 10) / 10; b.Mz = round(Mm * sin(ang) * 10) / 10; }
      else if (drag.k === 'shear' && P.scn && P.sh) { const TP = P.sh.TP; o().shear.dyQ = round(V.yw(sx) - TP.yS - P.scn.yM); } };
    cv.addEventListener('pointermove', move);
    const end = () => { if (drag) { drag = null; save(); rebuild(); } };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  }

  /* ---------------- lifecycle ---------------- */
  const PAINT = { beam: paintBeam, section: paintSection, bending: paintBending, shear: paintShear, torsion: paintTorsion, bars: paintBars, elastic: paintElastic, energy: paintEnergy, buckling: paintBuckling };
  function panesFor(id) {
    if (st.panes[id]) return st.panes[id];
    const P = { main: K.pane('main') };
    if (id === 'derive') { P.dom = h('div', { class: 'cpane dom' }); P.layout = 'lay-derive'; P.els = [P.main.el, P.dom]; }
    else { P.side = K.pane('side'); P.layout = 'lay-two som'; P.els = [P.main.el, P.side.el]; bind(P, id); if (id === 'beam') { const sc = P.side.cv; sc.addEventListener('pointermove', (e) => { P.probe = [e.offsetX, e.offsetY]; }); sc.addEventListener('pointerleave', () => { P.probe = null; }); } }
    st.panes[id] = P; return P;
  }
  SM.open = function (L, id) { const sc = sceneOf(id); L.sceneId = sc.id; L.setTitle(sc.name); const P = panesFor(sc.id); L.setLayout(P.layout); L.clearStage(); L.stageEl.append(...P.els); save(); buildPanels(L); L.phoneTabs(); };
  MB.Lab({
    id: 'som', first: 'beam', paper: true, noSpeed: true, noPlay: true,
    init(L) { st.L = L; const d = DEF(), s = (L.store && L.store.o) || {}; st.o = d; for (const k in s) { if (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k])) Object.assign(d[k], s[k]); else d[k] = s[k]; } },
    open: (L, id) => SM.open(L, id),
    frame(L, dt) { st.t += dt; st.dtF = dt; const id = L.sceneId, P = st.panes[id]; if (!P) return; if (!st.bentBtn) { st.bentBtn = h('button', { class: 'benttog left', type: 'button', onclick: () => { o().bent = !o().bent; save(); } }); L.stageEl.parentNode.append(st.bentBtn); } { const on = !!o().bent, show = id === 'beam' || id === 'elastic'; if (st.bentBtn.hidden === show) st.bentBtn.hidden = !show; const lab = on ? 'Beam drawn bent — tap for straight' : 'Beam drawn straight — tap to bend it'; if (st.bentBtn.textContent !== lab) { st.bentBtn.textContent = lab; st.bentBtn.classList.toggle('on', on); } } try {
      if (id === 'derive') { const w = o().derive.which, d = DERIV[w]; if (!P.player || P.which !== w) { P.which = w; P.dom.innerHTML = ''; P.player = DV.player({ steps: d.steps }); P.dom.append(P.player.el); } P.player.tick(); const c = fitP(P.main.cv); if (c) paintDerive(c, P.main.cv._W, P.main.cv._H, P.player.k, P.player.progress(), w); return; }
      PAINT[id](P); } catch (e) { console.error(e); } },
  });
  Object.assign(SM, { getSec, secInfo, torsionResult, barsResult, elasticResult, buckResult, energyResult, DERIV, SCENES });
})(typeof window !== 'undefined' ? window : globalThis);
