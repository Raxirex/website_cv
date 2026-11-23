/* Dynamic Interactive Labs — virtual work on top of the statics engine.
   · Unit-load method (principle of virtual forces): δ = Σ∫ M̄ (M/EI + κ_T) dx + Σ∫ N̄ (N/EA + ε_T) dx + Σ F̄_c F_c / c − Σ R̄ ĉ,
     with every product integral also written the way it is done by hand (integration table / Koppeltafel).
   · Force method (Kraftgrößenverfahren): release n restraints → statically determinate primary system; states 0 (loads) and
     i (X_i = 1); flexibilities δ_ik = Σ∫ M_i M_k/EI + N_i N_k/EA (+ springs); δ X = ĉ − δ₀; M = M₀ + Σ X_i M_i.
   · Virtual displacements and influence lines (Land / Müller-Breslau): impose a unit dislocation against the sought force;
     the displaced shape is its influence line, rigid (a kinematic chain with poles) for determinate structures. */
function StaticsVWFactory(G) {
  'use strict';
  const S = G.StaticsCore, VW = (G.StaticsVW = {});
  const { abs, max, min, sqrt, hypot, cos, sin, PI } = Math;
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const GP = [[-sqrt(0.6), 5 / 9], [0, 8 / 9], [sqrt(0.6), 5 / 9]];
  /* break points of a member (where some diagram may jump or kink) in either state */
  const breaks = (L, ...mls) => { const s = new Set([0, L]); for (const ml of mls) for (const k of ['pts', 'mom', 'disl']) for (const q of ml[k]) if (q.a > 1e-12 && q.a < L - 1e-12) s.add(q.a); return [...s].sort((a, b) => a - b); };
  /* ∫ f·g dx over a member, f and g from the at() closures of two states: 3-point Gauss on each piece (exact to degree 5) */
  function prod(d0, d1, i0, i1, xs) { let v = 0; for (let k = 1; k < xs.length; k++) { const a = xs[k - 1], b = xs[k], h = b - a; for (const [g, w] of GP) { const x = a + ((g + 1) * h) / 2; v += ((w * h) / 2) * d0.at(x)[i0] * d1.at(x)[i1]; } } return v; }
  function lin(d, i, xs) { let v = 0; for (let k = 1; k < xs.length; k++) { const a = xs[k - 1], b = xs[k], h = b - a; for (const [g, w] of GP) v += ((w * h) / 2) * d.at(a + ((g + 1) * h) / 2)[i]; } return v; }
  VW.prod = prod;

  /* one piece of a product integral, the way it is done by hand: M real = trapezoid (i₁, i₂) + parabola of bulge f; M̄ = trapezoid (k₁, k₂) */
  VW.kopp = function (l, i1, i2, f, k1, k2, cubic) {
    const val = (l / 6) * (i1 * (2 * k1 + k2) + i2 * (k1 + 2 * k2)) + (l / 3) * f * (k1 + k2), sc = max(abs(i1), abs(i2), abs(f), 1e-12), sk = max(abs(k1), abs(k2), 1e-12);
    const z = (v, s) => abs(v) < 1e-7 * s, eq = (a, b, s) => abs(a - b) < 1e-7 * s;
    const rs = z(f, sc) ? (eq(i1, i2, sc) ? 'rect' : z(i1, sc) || z(i2, sc) ? 'tri' : 'trap') : z(i1, sc) && z(i2, sc) ? 'para' : 'trap+para';
    const vs = eq(k1, k2, sk) ? 'rect' : z(k1, sk) || z(k2, sk) ? 'tri' : 'trap';
    let rule;
    if (cubic) rule = 'Gauss (cubic M)';
    else if (z(i1, sc) && z(i2, sc) && z(f, sc)) rule = '0';
    else if (rs === 'rect' && vs === 'rect') rule = 'l·i·k';
    else if ((rs === 'rect' && vs === 'tri') || (rs === 'tri' && vs === 'rect')) rule = '½·l·i·k';
    else if (rs === 'tri' && vs === 'tri') rule = (z(i1, sc) === z(k1, sk)) ? '⅓·l·i·k' : '⅙·l·i·k';
    else if (rs === 'para' && vs === 'rect') rule = '⅔·l·f·k';
    else if (rs === 'para') rule = '⅓·l·f·(k₁+k₂)';
    else rule = 'l/6·[i₁(2k₁+k₂)+i₂(k₁+2k₂)]' + (z(f, sc) ? '' : ' + l/3·f·(k₁+k₂)');
    return { val, rule, rs, vs };
  };
  /* table rows for ∫ M₀ M₁ dx over member mi: split at breaks, decompose, and note the rule used */
  function koppRows(e0, d0, e1, d1) {
    const L = e0.g.L, xs = breaks(L, e0.ml, e1.ml), rows = [];
    for (let k = 1; k < xs.length; k++) {
      const a = xs[k - 1], b = xs[k], l = b - a, ep = 1e-9 * L, M = (x) => d0.at(x)[2], Mb = (x) => d1.at(x)[2];
      const i1 = M(a + ep), i2 = M(b - ep), mid = M(a + l / 2), f = mid - (i1 + i2) / 2, k1 = Mb(a + ep), k2 = Mb(b - ep);
      const q1 = M(a + l / 4), q3 = M(a + (3 * l) / 4), quad = (t) => i1 * (1 - t) + i2 * t + 4 * f * t * (1 - t), sc = max(abs(i1), abs(i2), abs(mid), 1e-12);
      const cubic = abs(q1 - quad(0.25)) > 1e-6 * sc || abs(q3 - quad(0.75)) > 1e-6 * sc;
      const kp = VW.kopp(l, i1, i2, f, k1, k2, cubic), exact = prod(d0, d1, 2, 2, [a, b]);
      rows.push({ a, b, l, i1, i2, f, k1, k2, rule: kp.rule, val: cubic ? exact : kp.val, exact });
    }
    return rows;
  }
  VW.koppRows = koppRows;

  /* a copy of the model with every load, temperature, settlement and dislocation removed */
  VW.unloaded = (model) => { const m = clone(model); m.nloads = []; m.mloads = []; m.selfWeight = false; for (const sp of m.supports || []) { delete sp.dx; delete sp.dy; delete sp.dr; } return m; };
  /* global unit load vector for a target direction: 'h' → (1, 0), 'v' → (0, −1) (downwards), 'r' → counter-clockwise couple */
  const UNIT = { h: [1, 0, 0], v: [0, -1, 0], r: [0, 0, 1] };
  /* displacement of the real state in the target direction */
  function measure(res, model, t) {
    let ux, uy, th; if (t.k === 'node') { ux = res.u[3 * t.n]; uy = res.u[3 * t.n + 1]; th = res.u[3 * t.n + 2]; } else { [ux, uy, th] = S.dispAt(res, t.m, t.at * res.el[t.m].g.L); }
    const U = UNIT[t.dir]; return U[0] * ux + U[1] * uy + U[2] * th;
  }
  VW.measure = measure;
  /* work-equivalent spring and settlement terms between two states */
  function springTerm(rA, rB) { let v = 0; for (const [i, k] of rA.springs || []) v += (rA.Rloc[i] * rB.Rloc[i]) / k; return v; }
  function settleTerm(model, rV) { let v = 0; for (const sp of model.supports || []) { const fl = S.supFix(sp), pd = [sp.dx || 0, sp.dy || 0, sp.dr || 0]; for (let i = 0; i < 3; i++) if (fl[i] && pd[i]) v += rV.Rloc[3 * sp.n + i] * pd[i]; } return v; }

  /* ---------------- unit-load method ---------------- */
  VW.unitLoad = function (model, t) {
    const r0 = S.solve(model); if (!r0.ok) return { err: r0.err };
    const vm = VW.unloaded(model), U = UNIT[t.dir];
    if (t.k === 'node') vm.nloads = [{ n: t.n, Fx: U[0], Fy: U[1], M: U[2] }];
    else vm.mloads = [U[2] ? { m: t.m, type: 'moment', at: t.at, M: U[2] } : { m: t.m, type: 'point', at: t.at, Fx: U[0], Fy: U[1] }];
    const r1 = S.solve(vm); if (!r1.ok) return { err: r1.err };
    const rows = r0.el.map((e0, i) => {
      const e1 = r1.el[i], d0 = r0.members[i], d1 = r1.members[i], L = e0.g.L, xs = breaks(L, e0.ml, e1.ml), EI = e0.p.EI, EA = e0.p.EA, truss = e0.m.type === 'truss';
      const MM = truss ? 0 : prod(d0, d1, 2, 2, xs), NN = prod(d0, d1, 0, 0, xs), T = (d0.kT ? lin(d1, 2, xs) * d0.kT : 0) + (d0.eT ? lin(d1, 0, xs) * d0.eT : 0);
      return { mi: i, L, EI, EA, MM, NN, dM: MM / EI, dN: NN / EA, dT: T, kopp: truss ? [] : koppRows(e0, d0, e1, d1), Nr: d0.N, Nv: d1.N, truss };
    });
    const parts = { M: rows.reduce((s, r) => s + r.dM, 0), N: rows.reduce((s, r) => s + r.dN, 0), T: rows.reduce((s, r) => s + r.dT, 0), C: springTerm(r1, r0), S: -settleTerm(model, r1) };
    const total = parts.M + parts.N + parts.T + parts.C + parts.S;
    return { r0, r1, vm, rows, parts, total, direct: measure(r0, model, t) };
  };

  /* ---------------- force method ---------------- */
  const FIXNAME = { '110': 'pin', '010': 'roller', '100': 'rollerx', '111': 'fixed', '011': 'slidex', '101': 'slidey', '000': 'none' };
  /* the restraints that could be released, in the order engineers usually pick them */
  VW.candidates = function (model) {
    const out = [], sups = model.supports || [], first = sups.length ? sups[0].n : -1;
    for (const d of [2, 0, 1]) for (const sp of sups) { const fl = S.supFix(sp); if (!fl[d]) continue; if (d !== 2 && sp.n === first) continue; out.push({ k: 'sup', n: sp.n, d }); }
    const momentAt = new Array(model.nodes.length).fill(0); model.members.forEach((m) => { const r = S.rels(m); if (!r.includes(2)) momentAt[m.a]++; if (!r.includes(5)) momentAt[m.b]++; });
    for (const sp of sups) if (S.supFix(sp)[2]) momentAt[sp.n]++;
    model.members.forEach((m, mi) => { if (m.type === 'truss') return; const r = S.rels(m); if (!r.includes(5) && momentAt[m.b] > 1) out.push({ k: 'hinge', m: mi, end: 'b' }); if (!r.includes(2) && momentAt[m.a] > 1) out.push({ k: 'hinge', m: mi, end: 'a' }); });
    model.members.forEach((m, mi) => { if (m.type === 'truss' && !m.nb) out.push({ k: 'cut', m: mi }); });
    for (const d of [0, 1]) for (const sp of sups) if (sp.n === first && S.supFix(sp)[d]) out.push({ k: 'sup', n: sp.n, d });
    return out;
  };
  VW.key = (r) => (r.k === 'sup' ? `s${r.n}.${r.d}` : r.k === 'hinge' ? `h${r.m}${r.end}` : `c${r.m}`);
  VW.applyReleases = function (model, rels) {
    const m = clone(model);
    for (const r of rels) {
      if (r.k === 'sup') { const sp = m.supports.find((q) => q.n === r.n); if (!sp) continue; const fl = S.supFix(sp).slice(); fl[r.d] = 0; sp.fix = fl; const nm = FIXNAME[fl.join('')]; if (nm) { sp.type = nm; delete sp.fix; } if (r.d === 0) delete sp.dx; if (r.d === 1) delete sp.dy; if (r.d === 2) delete sp.dr; }
      else if (r.k === 'hinge') { if (r.end === 'a') m.members[r.m].ra = true; else m.members[r.m].rb = true; }
      else if (r.k === 'cut') m.members[r.m].nb = true;
    }
    return m;
  };
  /* the action X_i = 1 on the primary system (no other loads) */
  VW.unitState = function (primary, r) {
    const m = VW.unloaded(primary);
    if (r.k === 'sup') { const sp = primary.supports.find((q) => q.n === r.n), a = (((sp && sp.ang) || 0) * PI) / 180, c = cos(a), s = sin(a); m.nloads = [r.d === 0 ? { n: r.n, Fx: c, Fy: s } : r.d === 1 ? { n: r.n, Fx: -s, Fy: c } : { n: r.n, M: 1 }]; }
    else if (r.k === 'hinge') { const mm = primary.members[r.m], nd = r.end === 'a' ? mm.a : mm.b; m.mloads = [{ m: r.m, type: 'moment', at: r.end === 'a' ? 0 : 1, M: r.end === 'a' ? -1 : 1 }]; m.nloads = [{ n: nd, M: r.end === 'a' ? 1 : -1 }]; }
    else if (r.k === 'cut') { const g = S.geo(primary, r.m), mm = primary.members[r.m]; m.mloads = [{ m: r.m, type: 'point', at: 1, Fx: g.c, Fy: g.s }]; m.nloads = [{ n: mm.b, Fx: -g.c, Fy: -g.s }]; }
    return m;
  };
  /* prescribed displacement of the original structure in the direction of X_i (a settled support that was released) */
  const presc = (model, r) => { if (r.k !== 'sup') return 0; const sp = model.supports.find((q) => q.n === r.n); return sp ? [sp.dx || 0, sp.dy || 0, sp.dr || 0][r.d] : 0; };
  function flex(rA, rB, model) { let v = 0; rA.el.forEach((e, i) => { const xs = breaks(e.g.L, e.ml, rB.el[i].ml); if (e.m.type !== 'truss') v += prod(rA.members[i], rB.members[i], 2, 2, xs) / e.p.EI; v += prod(rA.members[i], rB.members[i], 0, 0, xs) / e.p.EA; }); return v + springTerm(rA, rB); }
  VW.autoReleases = function (model) {
    const d0 = S.determinacy(model); if (d0.kinDeg > 0) return null; let cur = d0.statDeg; const chosen = [];
    for (const c of VW.candidates(model)) { if (!cur) break; const d = S.determinacy(VW.applyReleases(model, [...chosen, c])); if (d.kinDeg === 0 && d.statDeg === cur - 1) { chosen.push(c); cur--; } }
    return chosen;
  };
  VW.forceMethod = function (model, rels) {
    const primary = VW.applyReleases(model, rels), det = S.determinacy(primary);
    if (det.kinDeg > 0) return { err: 'This choice makes the primary system a mechanism.', primary, det };
    const s0 = S.solve(primary); if (!s0.ok) return { err: s0.err, primary, det };
    const si = rels.map((r) => S.solve(VW.unitState(primary, r))); if (si.some((s) => !s.ok)) return { err: 'A unit state could not be solved.', primary, det };
    const n = rels.length, D = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, k) => flex(si[i], si[k], model)));
    const d0 = si.map((s) => { let v = flex(s, s0, model); s0.el.forEach((e, j) => { const d = s0.members[j], xs = breaks(e.g.L, e.ml, s.el[j].ml); if (d.kT) v += lin(s.members[j], 2, xs) * d.kT; if (d.eT) v += lin(s.members[j], 0, xs) * d.eT; }); return v - settleTerm(primary, s); });
    const rhs = rels.map((r, i) => presc(model, r) - d0[i]);
    // Gaussian elimination on the small flexibility system
    const A = D.map((r, i) => [...r, rhs[i]]); for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (abs(A[r][c]) > abs(A[p][c])) p = r; [A[p], A[c]] = [A[c], A[p]]; for (let r = 0; r < n; r++) { if (r === c) continue; const f = A[r][c] / A[c][c]; for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k]; } }
    const X = A.map((r, i) => r[n] / r[i]);
    // superposition, member by member on a common station set
    const members = s0.members.map((d, j) => {
      const xs = new Set(d.x); si.forEach((s) => s.members[j].x.forEach((x) => xs.add(x))); const xx = [...xs].sort((a, b) => a - b);
      const at = (x) => { const r = d.at(x).slice(); si.forEach((s, i) => { const q = s.members[j].at(x); for (let k = 0; k < 3; k++) r[k] += X[i] * q[k]; }); return r; };
      const vals = xx.map(at), w = xx.map((x) => S.interp(d, 'w', x) + si.reduce((acc, s, i) => acc + X[i] * S.interp(s.members[j], 'w', x), 0)), u = xx.map((x) => S.interp(d, 'u', x) + si.reduce((acc, s, i) => acc + X[i] * S.interp(s.members[j], 'u', x), 0));
      return { x: xx, N: vals.map((v) => v[0]), V: vals.map((v) => v[1]), M: vals.map((v) => v[2]), w, u, at, L: d.L };
    });
    const direct = S.solve(model);
    let dev = 0; if (direct.ok) members.forEach((c, j) => { for (const x of [0, c.L / 3, c.L / 2, c.L]) { const a = c.at(min(c.L, x)), b = direct.members[j].at(min(c.L, x)); dev = max(dev, abs(a[2] - b[2]), abs(a[0] - b[0])); } });
    const Rsum = new Float64Array(s0.R.length); for (let k = 0; k < Rsum.length; k++) Rsum[k] = s0.R[k] + si.reduce((acc, s, i) => acc + X[i] * s.R[k], 0);
    // a released support restraint carries the redundant itself
    rels.forEach((r, i) => { if (r.k !== 'sup') return; const sp = model.supports.find((q) => q.n === r.n), a = (((sp && sp.ang) || 0) * PI) / 180, c = cos(a), s = sin(a), b = 3 * r.n; if (r.d === 0) { Rsum[b] += c * X[i]; Rsum[b + 1] += s * X[i]; } else if (r.d === 1) { Rsum[b] -= s * X[i]; Rsum[b + 1] += c * X[i]; } else Rsum[b + 2] += X[i]; });
    return { primary, det, s0, si, D, d0, rhs, X, members, R: Rsum, direct, dev };
  };

  /* ---------------- influence lines and virtual displacements ---------------- */
  /* target: { k: 'sup', n, d } | { k: 'M' | 'V' | 'N', m, at } — the dislocation is imposed against the positive sense */
  VW.influence = function (model, t) {
    const m = VW.unloaded(model);
    if (t.k === 'sup') { const sp = m.supports.find((q) => q.n === t.n); if (!sp || !S.supFix(sp)[t.d]) return { err: 'Pick a restrained direction of a support.' }; sp[['dx', 'dy', 'dr'][t.d]] = -1; }
    else m.mloads = [{ m: t.m, type: 'disl', at: max(1e-6, min(1 - 1e-6, t.at)), kind: t.k === 'M' ? 'phi' : t.k === 'V' ? 'w' : 'u', v: t.k === 'V' ? -1 : 1 }]; // just inside the member, so an end section means the side on this member
    const r = S.solve(m); if (!r.ok) return { err: r.err };
    let fm = 0, um = 0; for (const d of r.members) { fm = max(fm, ...d.M.map(abs), ...d.V.map(abs), ...d.N.map(abs)); um = max(um, ...d.w.map(abs)); }
    const rigid = fm < 1e-6;
    // the value of the force for the model's own loads, by virtual work: S = Σ (load · displacement of the figure)
    const parts = [], add = (label, val, eta) => parts.push({ label, val, eta });
    for (const ld of model.nloads || []) { const ux = r.u[3 * ld.n], uy = r.u[3 * ld.n + 1], th = r.u[3 * ld.n + 2]; if (ld.Fx || ld.Fy) add(`F at node ${ld.n + 1}`, (ld.Fx || 0) * ux + (ld.Fy || 0) * uy, [ux, uy]); if (ld.M) add(`couple at node ${ld.n + 1}`, ld.M * th, [th]); }
    (model.mloads || []).forEach((ld) => {
      const e = r.el[ld.m]; if (!e) return; const L = e.g.L, g = e.g, a = (ld.at == null ? 0.5 : ld.at) * L;
      if (ld.type === 'point') { const q = S.dispAt(r, ld.m, a); add(`F on member ${ld.m + 1} at ${a.toFixed(2)} m`, (ld.Fx || 0) * q[0] + (ld.Fy || 0) * q[1], [q[0], q[1]]); }
      else if (ld.type === 'moment') { const th = S.dispAt(r, ld.m, a)[2]; add(`couple on member ${ld.m + 1} at ${a.toFixed(2)} m`, (ld.M || 0) * th, [th]); }
      else if (!ld.type) { // ∫ q·u dx with 3-point Gauss on every interval between stations (exact for the cubic pieces of the figure)
        const q1 = ld.q1 || 0, q2 = ld.q2 == null ? q1 : ld.q2, dir = ld.dir || 'gy', fct = dir === 'proj' ? abs(g.c) : 1, X = r.members[ld.m].x; let v = 0, A = 0;
        for (let k = 1; k < X.length; k++) { const a0 = X[k - 1], hh = X[k] - a0; if (hh <= 0) continue; for (const [gq, wq] of GP) { const x = a0 + ((gq + 1) * hh) / 2, q = q1 + ((q2 - q1) * x) / L, dd = S.dispAt(r, ld.m, x), wt = (wq * hh) / 2; let fx = 0, fy = 0; if (dir === 'local') { fx = -g.s * q; fy = g.c * q; } else if (dir === 'gx') fx = q; else fy = q * fct; v += (fx * dd[0] + fy * dd[1]) * wt; A += abs(dir === 'gx' ? dd[0] : dd[1]) * wt; } }
        add(`q on member ${ld.m + 1}`, v, [A]); }
    });
    const Sw = parts.reduce((acc, q) => acc + q.val, 0);
    const real = S.solve(model); let Sd = null;
    if (real.ok) { if (t.k === 'sup') Sd = real.Rloc[3 * t.n + t.d]; else { const x = max(1e-6, min(1 - 1e-6, t.at)) * real.el[t.m].g.L; Sd = real.members[t.m].at(x)[{ N: 0, V: 1, M: 2 }[t.k]]; } }
    return { r, rigid, um, Sw, Sd, real, parts };
  };
  /* bodies and poles of a rigid displacement figure: pieces of members (split at the dislocation), merged when they move alike */
  VW.poles = function (model, r, t) {
    const pieces = [], sc = max(1e-12, ...r.members.map((d) => max(...d.w.map(abs), ...d.u.map(abs))));
    model.members.forEach((mm, mi) => {
      const L = r.el[mi].g.L, cuts = [0, L]; if (t && t.m === mi && t.k !== 'sup') cuts.splice(1, 0, t.at * L);
      for (let k = 1; k < cuts.length; k++) { const a = cuts[k - 1], b = cuts[k], xm = (a + b) / 2, [ux, uy, th] = S.dispAt(r, mi, xm), P = S.pointOf(model, mi, xm / L), A = S.pointOf(model, mi, a / L), B = S.pointOf(model, mi, b / L); pieces.push({ mi, a, b, P, A, B, ux, uy, w: th }); }
    });
    const tol = 1e-6 * sc;
    function motionEq(p, q) { const dx = p.P[0] - q.P[0], dy = p.P[1] - q.P[1]; const qx = q.ux - q.w * dy, qy = q.uy + q.w * dx; return abs(p.w - q.w) < 1e-6 * (abs(p.w) + abs(q.w)) + 1e-12 && abs(p.ux - qx) < tol && abs(p.uy - qy) < tol; }
    const bodies = [];
    for (const p of pieces) {
      const rest = abs(p.w) < 1e-9 && abs(p.ux) < tol && abs(p.uy) < tol;
      if (rest) { p.body = 0; continue; }
      let b = bodies.find((bb) => motionEq(p, bb.ref)); if (!b) { b = { id: bodies.length + 1, ref: p, pieces: [] }; bodies.push(b); } b.pieces.push(p); p.body = b.id;
    }
    let size = 1; for (const a of model.nodes) for (const b of model.nodes) size = max(size, hypot(a.x - b.x, a.y - b.y));
    const poleOf = (P, ux, uy, w) => { if (abs(w) > 1e-15) { const x = P[0] - uy / w, y = P[1] + ux / w; if (hypot(x - P[0], y - P[1]) < 1e4 * size) return { x, y }; } return { inf: true, dir: [-uy, ux] }; };
    for (const b of bodies) { const p = b.ref; b.pole = poleOf(p.P, p.ux, p.uy, p.w); b.w = p.w; }
    // relative poles of touching bodies
    const rel = [], touch = (p, q) => [p.A, p.B].some((X) => [q.A, q.B].some((Y) => hypot(X[0] - Y[0], X[1] - Y[1]) < 1e-9));
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      if (!bodies[i].pieces.some((p) => bodies[j].pieces.some((q) => touch(p, q)))) continue;
      const p = bodies[i].ref, q = bodies[j].ref, dx = p.P[0] - q.P[0], dy = p.P[1] - q.P[1], qx = q.ux - q.w * dy, qy = q.uy + q.w * dx;
      rel.push({ i: bodies[i].id, j: bodies[j].id, pole: poleOf(p.P, p.ux - qx, p.uy - qy, p.w - q.w) });
    }
    return { bodies, rel, pieces };
  };
  return VW;
}
if (typeof window !== 'undefined') StaticsVWFactory(window); else if (typeof globalThis !== 'undefined') StaticsVWFactory(globalThis);
