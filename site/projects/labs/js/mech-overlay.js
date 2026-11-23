/* Dynamic Interactive Labs — Mechanics Lab overlays, drawn on top of the scene:
   · free-body diagram of the selected part: gravity, springs, loads, drives and every constraint force recovered from the
     Lagrange multipliers (Gᵀλ, with sliding contacts along n − μ s t), placed at their points, plus m·a and J·α;
   · kinematics: v, a split into a_t (along v) and a_n (towards the centre of curvature), the osculating circle ρ = v²/a_n, the path;
   · an observer frame turning with another part: centrifugal mΩ²r, Coriolis −2mΩ×v_rel, Euler −mΩ̇×r and −m a_O, and the
     path as that observer sees it;
   · momentum and impulse: p = Σmv, L_O = Σ(r×mv + Jω), F_ext, and Δp against ∫F_ext dt plus the impulses of impacts. */
(function (G) {
  'use strict';
  const MB = G.MB, R = MB.R;
  const { cos, sin, hypot, PI, max, min, abs } = Math;
  const D2R = PI / 180;
  const O = (MB.Overlay = {}), st = { sim: null, lastT: -1, Fprev: null, I: [0, 0, 0], p0: null, imp0: null, vmax: 1e-6, amax: 1e-6 };
  const f3 = (v) => (MB.fmt ? MB.fmt(v) : (+v).toPrecision(4));
  const tok = (k) => R.tok[k] || R.tok.ink;
  const nm = (b) => (b ? MB.plainName(b.name) : 'ground');

  function selBody(S) {
    const m = S.model; if (!m.bodies.length) return -1; let b = S.sel ? m.bodies.find((x) => x.id === S.sel) : null;
    if (!b && S.sel) { const f = MB.find(m, S.sel); if (f && f.el.b && f.el.b.body) b = MB.bodyById(m, f.el.b.body); }
    if (!b && m.settings.ovSel) b = MB.bodyById(m, m.settings.ovSel);
    if (!b && m.settings.followId) b = MB.bodyById(m, m.settings.followId);
    return m.bodies.indexOf(b || m.bodies[0]);
  }

  /* every force on part i at the current state (after a snapshot): [{ label, F: [fx, fy], P: [x, y], M, col, body }] */
  function bodyForces(sim, i) {
    const M = sim.model, s0 = M.settings, ga = s0.gAngle * D2R, q = sim.q, X = [q[3 * i], q[3 * i + 1]], m = sim.mass[3 * i], out = [], item = [0, 0, 0];
    const add = (label, fx, fy, P, Mc, col, body) => { const sx = P[0] - X[0], sy = P[1] - X[1]; item[0] += fx; item[1] += fy; item[2] += sx * fy - sy * fx + (Mc || 0); out.push({ label, F: [fx, fy], P, M: Mc || 0, col, body: !!body }); };
    add('m·g', m * s0.g * cos(ga), m * s0.g * sin(ga), X, 0, 'load', true);
    const tA = new Float64Array(4), tB = new Float64Array(4);
    for (const f of sim.fl) { const el = f.el, name = MB.plainName(el.name) || MB.typeName(el);
      if (el.type === 'sd' && (f.ia === i || f.ib === i)) { const A = Array.from(sim.pt(f.ia, el.a.p, q, tA)), B = Array.from(sim.pt(f.ib, el.b.p, q, tB)), dx = B[0] - A[0], dy = B[1] - A[1], L = hypot(dx, dy) || 1e-12, F = f.F || 0, sg = f.ib === i ? -1 : 1, P = f.ib === i ? B : A; add(name, (sg * F * dx) / L, (sg * F * dy) / L, [P[0], P[1]], 0, 'plot3'); }
      else if (el.type === 'load' && f.ib === i) { const B = Array.from(sim.pt(f.ib, el.b.p, q, tB)), al = el.angle * D2R + (el.follower ? q[3 * i + 2] : 0), F = f.F || 0; add(name, F * cos(al), F * sin(al), [B[0], B[1]], 0, 'ink'); }
      else if (el.type === 'torque' && f.ib === i) add(name, 0, 0, X, f.F || 0, 'ink');
      else if (el.type === 'torsion' && (f.ia === i || f.ib === i)) add(name, 0, 0, X, (f.ib === i ? -1 : 1) * (f.F || 0), 'plot3'); }
    const rx = sim.Q[3 * i] - item[0], ry = sim.Q[3 * i + 1] - item[1], rm = sim.Q[3 * i + 2] - item[2];
    if (hypot(rx, ry) > 1e-9 || abs(rm) > 1e-9) add('drives, joint friction, drag', rx, ry, X, rm, 'ink-3', true);
    const Gm = sim.forceDirs(), n = sim.n, lam = sim.lam;
    for (const c of sim.cons) { let gx = 0, gy = 0, gt = 0; for (let r = c.row; r < c.row + c.rows; r++) { const l = lam[r]; if (!l) continue; const o = r * n + 3 * i; gx += Gm[o] * l; gy += Gm[o + 1] * l; gt += Gm[o + 2] * l; } if (hypot(gx, gy) < 1e-9 && abs(gt) < 1e-9) continue;
      let P = X; if (c.kind === 'joint' || c.kind === 'stop') { const pp = c.ib === i ? c.B : c.ia === i ? c.A : null; if (pp) P = [pp[0], pp[1]]; if (c.type === 'path' && c.P && c.ib === i) P = c.P.slice(); if (c.type === 'gear') P = X; }
      else if (c.kind === 'contact') { let sx = 0, sy = 0, k = 0; for (let f = 0; f < c.feats.length; f++) if (lam[c.row + 2 * f] > 1e-9) { sx += c.px[f]; sy += c.py[f]; k++; } if (k) P = [sx / k, sy / k]; }
      else if (c.kind === 'rope') { for (let j = 0; j < c.nodes.length; j++) if (c.nodes[j].i === i) { P = [c.g.cx[j], c.g.cy[j]]; break; } }
      const Mres = gt - ((P[0] - X[0]) * gy - (P[1] - X[1]) * gx), lab = MB.plainName(c.el.name) || MB.typeName(c.el) || c.kind;
      out.push({ label: lab, F: [gx, gy], P, M: abs(Mres) > 1e-9 * max(1, hypot(gx, gy)) ? Mres : 0, col: 'react', cons: true }); }
    return out;
  }
  O.bodyForces = bodyForces;

  /* ---------- steady drawing: smoothed values, hysteresis, fading, labels that do not pile up ---------- */
  const SM = new Map(); let placed = [], lastNow = 0, alphaK = 1, frameNo = 0;
  /* exponential smoothing of a vector per key (time constant ≈ 0.1 s of wall time); returns the smoothed copy */
  function smooth(key, vec) { let e = SM.get(key); if (!e || e.v.length !== vec.length) { e = { v: vec.slice(), a: 0, seen: frameNo }; SM.set(key, e); } else for (let k = 0; k < vec.length; k++) e.v[k] += alphaK * (vec[k] - e.v[k]); e.seen = frameNo; return e; }
  /* visibility with hysteresis and a short fade: on above `on`, off below `off` */
  function vis(e, mag, on, off) { if (e.on == null) e.on = mag > on; else if (e.on && mag < off) e.on = false; else if (!e.on && mag > on) e.on = true; e.a = max(0, min(1, (e.a || 0) + (e.on ? 0.2 : -0.2))); return e.a; }
  function freeSpot(ctx, t, x, y) { const w = ctx.measureText(t).width + 4, hh = 13, tries = [[0, 0], [0, -14], [0, 14], [0, -28], [0, 28], [-w - 14, 0], [-w - 14, -14], [0, -42], [0, 42]];
    for (const [dx, dy] of tries) { const r = [x + dx, y + dy - 10, w, hh]; if (!placed.some((p) => r[0] < p[0] + p[2] && p[0] < r[0] + r[2] && r[1] < p[1] + p[3] && p[1] < r[1] + r[3])) { placed.push(r); return [x + dx, y + dy]; } }
    placed.push([x, y - 10, w, hh]); return [x, y]; }
  function box(ctx, v, y, lines, col) { ctx.save(); ctx.font = '11px "B612 Mono", ui-monospace, monospace'; const w = max(...lines.map((l) => ctx.measureText(l[0] || l).width)) + 18, hh = 16 * lines.length + 10, x = v.W - w - 12; ctx.globalAlpha = 0.92; ctx.fillStyle = tok('paper'); ctx.fillRect(x, y, w, hh); ctx.globalAlpha = 1; ctx.strokeStyle = col || tok('line') || tok('ink-3'); ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, hh - 1);
    lines.forEach((l, k) => { const [t, c, b] = Array.isArray(l) ? l : [l]; ctx.font = `${b ? '600 ' : ''}11px "B612 Mono", ui-monospace, monospace`; ctx.fillStyle = tok(c || 'ink'); ctx.textBaseline = 'middle'; ctx.fillText(t, x + 9, y + 13 + 16 * k); }); ctx.restore(); placed.push([x, y, w, hh]); return y + hh + 8; }
  const label = (ctx, t, x, y, col, al) => { ctx.save(); ctx.font = '11px "B612 Mono", ui-monospace, monospace'; const [px, py] = freeSpot(ctx, t, x, y); ctx.globalAlpha = al == null ? 1 : al; ctx.lineWidth = 3; ctx.strokeStyle = tok('paper'); ctx.strokeText(t, px, py); ctx.fillStyle = tok(col); ctx.fillText(t, px, py); ctx.restore(); };
  function arrowW(ctx, v, P, F, Lpx, col, tailAtPoint, dash, txt, al) { const Fm = hypot(F[0], F[1]); if (Fm < 1e-12 || al === 0) return; const ux = F[0] / Fm, uy = -F[1] / Fm, X = v.X(P[0]), Y = v.Y(P[1]); ctx.save(); ctx.globalAlpha = al == null ? 1 : al; ctx.strokeStyle = ctx.fillStyle = tok(col); ctx.lineWidth = 2.2; if (dash) ctx.setLineDash(dash); let x0, y0, x1, y1; if (tailAtPoint) { x0 = X; y0 = Y; x1 = X + ux * Lpx; y1 = Y + uy * Lpx; } else { x0 = X - ux * Lpx; y0 = Y - uy * Lpx; x1 = X - ux * 3; y1 = Y - uy * 3; } R.arrow(ctx, x0, y0, x1, y1, 9); ctx.restore(); if (txt) label(ctx, txt, (tailAtPoint ? x1 : x0) + 6, (tailAtPoint ? y1 : y0) - 6, col, al); }
  function couple(ctx, v, P, Mz, col, txt, r, al) { if (abs(Mz) < 1e-12 || al === 0) return; ctx.save(); ctx.globalAlpha = al == null ? 1 : al; ctx.strokeStyle = ctx.fillStyle = tok(col); ctx.lineWidth = 1.8; R.moment(ctx, v.X(P[0]), v.Y(P[1]), r || 16, Mz > 0 ? 1 : -1); ctx.restore(); if (txt) label(ctx, txt, v.X(P[0]) + (r || 16) + 4, v.Y(P[1]) + (r || 16), col, al); }
  function outline(ctx, v, b, q, i) { const x = q[3 * i], y = q[3 * i + 1], th = q[3 * i + 2]; ctx.save(); ctx.strokeStyle = tok('accent'); ctx.lineWidth = 1.6; ctx.setLineDash([6, 4]); ctx.beginPath(); if (b.shape === 'disk') ctx.arc(v.X(x), v.Y(y), b.r * v.s + 7, 0, 2 * PI); else { const c = cos(th), s = sin(th), hw = b.w / 2 + 7 / v.s, hh = b.h / 2 + 7 / v.s; [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].forEach(([u, w], k) => { const px = v.X(x + c * u - s * w), py = v.Y(y + s * u + c * w); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.closePath(); } ctx.stroke(); ctx.restore(); }
  const sizeOf = (b) => (b.shape === 'disk' ? b.r : 0.5 * max(b.w || 0.1, b.h || 0.1));

  O.draw = function (ctx, v, S) {
    const s0 = S.model.settings, sim = S.sim; if (!sim || !sim.nb || (!s0.ovFBD && !s0.ovKin && !s0.ovMom && !s0.ovObs)) return; if (MB.app && MB.app.modeAnim) return;
    const now = performance.now(), running = !!(MB.app && MB.app.running); alphaK = running ? 1 - Math.exp(-max(1, min(200, now - lastNow)) / 110) : 1; lastNow = now; frameNo++; placed = [];
    const snap = sim.snapshot(), q = sim.q, qd = sim.qd, acc = snap.a, i = selBody(S), b = S.model.bodies[i]; let y = 12;
    if (st.sim !== sim || sim.t < st.lastT - 1e-12 || st.bi !== i) { st.sim = sim; st.bi = i; st.lastT = sim.t; st.Fprev = null; st.I = [0, 0, 0]; st.p0 = null; st.imp0 = sim.impP ? Array.from(sim.impP) : [0, 0, 0]; st.vmax = 1e-6; st.amax = 1e-6; st.fmax = 1e-9; SM.clear(); }
    if (i < 0) return; const m = sim.mass[3 * i], J = sim.mass[3 * i + 2], X = [q[3 * i], q[3 * i + 1]], Lb = sizeOf(b);
    if (s0.ovFBD) {
      const list = bodyForces(sim, i); outline(ctx, v, b, q, i);
      const ma = [m * acc[3 * i], m * acc[3 * i + 1]], Ja = J * acc[3 * i + 2];
      st.fmax = max(st.fmax * (running ? 0.996 : 1), hypot(...ma), ...list.map((f) => hypot(f.F[0], f.F[1])), 1e-9);
      const Fm = st.fmax, seen = new Map(); let sx = 0, sy = 0, sm = 0, nCons = 0;
      for (const f of list) { sx += f.F[0]; sy += f.F[1]; sm += (f.P[0] - X[0]) * f.F[1] - (f.P[1] - X[1]) * f.F[0] + f.M; if (f.cons && hypot(...f.F) > 1e-6 * Fm) nCons++;
        let key = 'F:' + f.label; const n0 = seen.get(key) || 0; seen.set(key, n0 + 1); if (n0) key += '#' + n0;
        const e = smooth(key, [f.F[0], f.F[1], f.P[0], f.P[1], f.M]), F = [e.v[0], e.v[1]], P = [e.v[2], e.v[3]], Fa = hypot(...F), al = vis(e, Fa / Fm, 0.03, 0.012);
        if (al > 0) { const L = 22 + 64 * min(1, Fa / Fm), atC = f.body || hypot(P[0] - X[0], P[1] - X[1]) * v.s < 4; arrowW(ctx, v, P, F, L, f.col, atC, null, `${f.label} ${f3(Fa)} N`, al); }
        const ec = smooth(key + ':M', [e.v[4]]), ac = vis(ec, abs(ec.v[0]) / (Fm * max(Lb, 0.05)), 0.04, 0.02); if (ac > 0) couple(ctx, v, P, ec.v[0], f.col, `${f3(ec.v[0])} N·m`, 14, ac); }
      const ea = smooth('ma', [ma[0], ma[1], Ja]), mas = [ea.v[0], ea.v[1]], ala = vis(ea, hypot(...mas) / Fm, 0.03, 0.012);
      if (ala > 0) arrowW(ctx, v, X, mas, 22 + 64 * min(1, hypot(...mas) / Fm), 'accent', true, [6, 4], `m·a ${f3(hypot(...mas))} N`, ala);
      const ej = smooth('Ja', [ea.v[2]]), alj = vis(ej, abs(ej.v[0]) / (Fm * max(Lb, 0.05)), 0.04, 0.02); if (alj > 0) couple(ctx, v, X, ej.v[0], 'accent', `J·α ${f3(ej.v[0])} N·m`, 24, alj);
      y = box(ctx, v, y, [[`Free body: ${nm(b)}`, 'ink', true], [`ΣF  = (${f3(sx)}, ${f3(sy)}) N`, 'react'], [`m·a = (${f3(ma[0])}, ${f3(ma[1])}) N`, 'accent'], [`ΣM_S = ${f3(sm)} N·m · J·α = ${f3(Ja)} N·m`, 'ink-2'], [`${nCons} constraint force${nCons === 1 ? '' : 's'} from λ (red), applied forces, m·g`, 'ink-3']]);
    }
    if (s0.ovKin) {
      const ek = smooth('kin', [qd[3 * i], qd[3 * i + 1], acc[3 * i], acc[3 * i + 1]]), vv = [ek.v[0], ek.v[1]], aa = [ek.v[2], ek.v[3]], vm = hypot(...vv), am = hypot(...aa);
      st.vmax = max(st.vmax * (running ? 0.997 : 1), vm); st.amax = max(st.amax * (running ? 0.997 : 1), am);
      const hist = MB.app && MB.app.history; if (hist && hist.length > 1) { ctx.save(); ctx.strokeStyle = tok('plot1'); ctx.globalAlpha = 0.45; ctx.lineWidth = 1.2; ctx.beginPath(); const k0 = max(0, hist.length - 900); let first = true; for (let k = k0; k < hist.length; k++) { const qq = hist[k].q; if (qq.length <= 3 * i + 1) continue; const px = v.X(qq[3 * i]), py = v.Y(qq[3 * i + 1]); first ? ctx.moveTo(px, py) : ctx.lineTo(px, py); first = false; } ctx.stroke(); ctx.restore(); }
      let at = [0, 0], an = [0, 0], rho = Infinity; if (vm > 1e-9) { const t = [vv[0] / vm, vv[1] / vm], a_t = aa[0] * t[0] + aa[1] * t[1]; at = [a_t * t[0], a_t * t[1]]; an = [aa[0] - at[0], aa[1] - at[1]]; const anm = hypot(...an); if (anm > 1e-9) rho = (vm * vm) / anm; }
      /* the osculating circle only where it means something: the part moves (v not near 0) and turns (a_n not near 0), and the
         circle fits the screen; drawn as an arc around the point so a nearly straight path does not paint a huge circle */
      const anm = hypot(...an), Rpx = rho * v.s, okC = isFinite(rho) && vm > 0.06 * st.vmax && anm > 0.06 * st.amax && Rpx > 6 && Rpx < 1.4 * max(v.W, v.H);
      const eo = SM.get('osc') || smooth('osc', [0]); eo.seen = frameNo; const ao = vis(eo, okC ? 1 : 0, 0.5, 0.5);
      if (okC) eo.c = [X[0] + (rho * an[0]) / anm, X[1] + (rho * an[1]) / anm, rho];
      if (ao > 0 && eo.c) { const [cx, cy, r] = eo.c, CX = v.X(cx), CY = v.Y(cy), R0 = r * v.s, a0 = Math.atan2(v.Y(X[1]) - CY, v.X(X[0]) - CX), half = min(1.25, 230 / max(R0, 1));
        ctx.save(); ctx.globalAlpha = ao; ctx.strokeStyle = tok('plot5'); ctx.lineWidth = 1.4; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.arc(CX, CY, R0, a0 - half, a0 + half); ctx.stroke();
        if (R0 < 1.2 * max(v.W, v.H)) { ctx.setLineDash([2, 3]); R.line(ctx, v.X(X[0]), v.Y(X[1]), CX, CY); ctx.setLineDash([]); ctx.fillStyle = tok('plot5'); ctx.beginPath(); ctx.arc(CX, CY, 3, 0, 2 * PI); ctx.fill(); } ctx.restore(); }
      const ev = vis(smooth('kv', [0]), vm / st.vmax, 0.03, 0.012), ea2 = vis(smooth('ka', [0]), am / st.amax, 0.03, 0.012);
      if (ev > 0) arrowW(ctx, v, X, vv, 70 * (vm / st.vmax), 'plot1', true, null, `v ${f3(vm)} m/s`, ev);
      if (ea2 > 0) { arrowW(ctx, v, X, aa, 70 * (am / st.amax), 'plot2', true, null, `a ${f3(am)} m/s²`, ea2); arrowW(ctx, v, X, at, 70 * (hypot(...at) / st.amax), 'plot2', true, [3, 3], null, ea2 * 0.8); arrowW(ctx, v, X, an, 70 * (anm / st.amax), 'plot2', true, [3, 3], null, ea2 * 0.8); }
      y = box(ctx, v, y, [[`Kinematics: ${nm(b)}`, 'ink', true], [`v = ${f3(vm)} m/s · ω = ${f3(qd[3 * i + 2])} rad/s`, 'plot1'], [`a_t = dv/dt = ${f3(vm > 1e-9 ? (aa[0] * vv[0] + aa[1] * vv[1]) / vm : am)} m/s²`, 'plot2'], [`a_n = v²/ρ = ${f3(anm)} m/s²`, 'plot2'], [`ρ = ${okC ? f3(rho) + ' m' : vm < 0.06 * st.vmax ? '– (v ≈ 0)' : '∞ (straight)'} · α = ${f3(acc[3 * i + 2])} rad/s²`, 'plot5']]);
    }
    const oi = s0.ovObs ? S.model.bodies.findIndex((x) => x.id === s0.ovObs) : -1;
    if (oi >= 0) {
      const Oo = [q[3 * oi], q[3 * oi + 1]], th = q[3 * oi + 2], W = qd[3 * oi + 2], Wd = acc[3 * oi + 2], vO = [qd[3 * oi], qd[3 * oi + 1]], aO = [acc[3 * oi], acc[3 * oi + 1]];
      ctx.save(); ctx.strokeStyle = ctx.fillStyle = tok('plot4'); ctx.lineWidth = 1.6; ctx.setLineDash([5, 3]); const Lf = 60; R.arrow(ctx, v.X(Oo[0]), v.Y(Oo[1]), v.X(Oo[0]) + Lf * cos(th), v.Y(Oo[1]) - Lf * sin(th), 8); R.arrow(ctx, v.X(Oo[0]), v.Y(Oo[1]), v.X(Oo[0]) - Lf * sin(th), v.Y(Oo[1]) - Lf * cos(th), 8); ctx.restore(); label(ctx, "x′", v.X(Oo[0]) + (Lf + 6) * cos(th), v.Y(Oo[1]) - (Lf + 6) * sin(th), 'plot4'); label(ctx, "y′", v.X(Oo[0]) - (Lf + 6) * sin(th), v.Y(Oo[1]) - (Lf + 6) * cos(th), 'plot4');
      if (oi !== i) {
        const r = [X[0] - Oo[0], X[1] - Oo[1]], vv = [qd[3 * i], qd[3 * i + 1]], vrel = [vv[0] - vO[0] + W * r[1], vv[1] - vO[1] - W * r[0]];
        const Fcf = [m * W * W * r[0], m * W * W * r[1]], Fco = [2 * m * W * vrel[1], -2 * m * W * vrel[0]], Feu = [m * Wd * r[1], -m * Wd * r[0]], Ftr = [-m * aO[0], -m * aO[1]];
        st.pmax = max((st.pmax || 1e-9) * (running ? 0.996 : 1), ...[Fcf, Fco, Feu, Ftr].map((f) => hypot(...f)), 1e-9);
        const hist = MB.app && MB.app.history; if (hist && hist.length > 1) { ctx.save(); ctx.strokeStyle = tok('plot4'); ctx.lineWidth = 1.4; ctx.setLineDash([2, 3]); ctx.beginPath(); const k0 = max(0, hist.length - 1200); let first = true; for (let k = k0; k < hist.length; k++) { const qq = hist[k].q; if (qq.length <= 3 * max(i, oi) + 2) continue; const dx = qq[3 * i] - qq[3 * oi], dy = qq[3 * i + 1] - qq[3 * oi + 1], tk2 = qq[3 * oi + 2], lx = cos(tk2) * dx + sin(tk2) * dy, ly = -sin(tk2) * dx + cos(tk2) * dy, wx = Oo[0] + cos(th) * lx - sin(th) * ly, wy = Oo[1] + sin(th) * lx + cos(th) * ly; first ? ctx.moveTo(v.X(wx), v.Y(wy)) : ctx.lineTo(v.X(wx), v.Y(wy)); first = false; } ctx.stroke(); ctx.restore(); }
        for (const [F0, lab] of [[Fcf, 'centrifugal'], [Fco, 'Coriolis'], [Feu, 'Euler'], [Ftr, '−m·a_O']]) { const e = smooth('ps:' + lab, F0), F = e.v, Fa = hypot(...F), al = vis(e, Fa / st.pmax, 0.03, 0.012); if (al > 0) arrowW(ctx, v, X, F, 22 + 60 * min(1, Fa / st.pmax), 'plot4', true, [4, 2], `${lab} ${f3(Fa)} N`, al); }
        y = box(ctx, v, y, [[`Observer turning with ${nm(S.model.bodies[oi])}`, 'plot4', true], [`Ω = ${f3(W)} rad/s · Ω̇ = ${f3(Wd)} rad/s²`, 'ink-2'], [`v_rel = ${f3(hypot(...vrel))} m/s (dotted: the path it sees)`, 'ink-2'], [`mΩ²r = ${f3(hypot(...Fcf))} N · 2mΩv_rel = ${f3(hypot(...Fco))} N`, 'plot4'], [`mΩ̇r = ${f3(hypot(...Feu))} N · m a_O = ${f3(hypot(...Ftr))} N`, 'plot4']]);
      } else y = box(ctx, v, y, [[`Observer turning with ${nm(b)}`, 'plot4', true], ['select another part to see the pseudo-forces on it', 'ink-3']]);
    }
    if (s0.ovMom) {
      let Mt = 0, p = [0, 0], c = [0, 0], L = 0; const g = s0.g, ga = s0.gAngle * D2R; let Fe = [0, 0];
      for (let k = 0; k < sim.nb; k++) { const mk = sim.mass[3 * k]; Mt += mk; p[0] += mk * qd[3 * k]; p[1] += mk * qd[3 * k + 1]; c[0] += mk * q[3 * k]; c[1] += mk * q[3 * k + 1]; L += q[3 * k] * mk * qd[3 * k + 1] - q[3 * k + 1] * mk * qd[3 * k] + sim.mass[3 * k + 2] * qd[3 * k + 2]; Fe[0] += mk * acc[3 * k]; Fe[1] += mk * acc[3 * k + 1]; }
      c = [c[0] / Mt, c[1] / Mt]; const W = [Mt * g * cos(ga), Mt * g * sin(ga)];
      if (st.p0 == null) { st.p0 = p.slice(); st.lastT = sim.t; st.Fprev = Fe.slice(); st.imp0 = sim.impP ? Array.from(sim.impP) : [0, 0, 0]; }
      if (sim.t > st.lastT) { const dt = sim.t - st.lastT, Fp = st.Fprev || Fe; st.I[0] += 0.5 * (Fp[0] + Fe[0]) * dt; st.I[1] += 0.5 * (Fp[1] + Fe[1]) * dt; }
      st.lastT = sim.t; st.Fprev = Fe.slice(); const ip = sim.impP ? [sim.impP[0] - st.imp0[0], sim.impP[1] - st.imp0[1]] : [0, 0], dp = [p[0] - st.p0[0], p[1] - st.p0[1]], Itot = [st.I[0] + ip[0], st.I[1] + ip[1]];
      st.mpmax = max((st.mpmax || 1e-9) * (running ? 0.997 : 1), hypot(...p)); st.mfmax = max((st.mfmax || 1e-9) * (running ? 0.997 : 1), hypot(...Fe));
      const ep = smooth('mp', p), ef = smooth('mf', Fe), ap = vis(ep, hypot(...ep.v) / st.mpmax, 0.03, 0.012), af = vis(ef, hypot(...ef.v) / st.mfmax, 0.03, 0.012);
      ctx.save(); ctx.fillStyle = tok('accent'); ctx.beginPath(); ctx.arc(v.X(c[0]), v.Y(c[1]), 4, 0, 2 * PI); ctx.fill(); ctx.restore();
      if (ap > 0) arrowW(ctx, v, c, ep.v, 20 + 50 * (hypot(...ep.v) / st.mpmax), 'accent', true, null, `p ${f3(hypot(...p))} N·s`, ap); if (af > 0) arrowW(ctx, v, c, ef.v, 20 + 40 * (hypot(...ef.v) / st.mfmax), 'load', true, [5, 3], `F_ext ${f3(hypot(...Fe))} N`, af);
      box(ctx, v, y, [['Momentum and impulse (whole system)', 'ink', true], [`p = Σmv = (${f3(p[0])}, ${f3(p[1])}) N·s`, 'accent'], [`L_O = Σ(r×mv + Jω) = ${f3(L)} N·m·s`, 'ink-2'], [`F_ext = Σm·a = (${f3(Fe[0])}, ${f3(Fe[1])}) N, weight (${f3(W[0])}, ${f3(W[1])})`, 'load'], [`Δp since t₀ = (${f3(dp[0])}, ${f3(dp[1])}) N·s`, 'accent'], [`∫F_ext dt + impact impulses = (${f3(Itot[0])}, ${f3(Itot[1])}) N·s`, 'load'], ['internal forces cancel in pairs; supports and impacts change p', 'ink-3']]);
    }
    for (const [k, e] of SM) if (frameNo - e.seen > 120) SM.delete(k);
  };
})(typeof window !== 'undefined' ? window : globalThis);
