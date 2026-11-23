/* Dynamic Interactive Labs — statics engine: plane frames and trusses by the direct stiffness method (Euler–Bernoulli elements).
   Units: m, kN, kN·m; E in GPa, A in cm², I in cm⁴, W in cm³, section depth h in mm (converted inside). Global X right, Y up,
   rotations counter-clockwise. Member end a → b, local x along the member, local y = x turned +90°; the "bottom" fibre (the
   dashed fibre of German drawings) is the local −y side.
   Internal forces on the left part's cut face: N tension positive; V positive pointing −y; M positive when the bottom fibre is
   in tension (sagging). Then dN/dx = −q_x, dV/dx = q_y, dM/dx = V, and EI w″ = M + EI κ_T.
   Member ends can release the moment (hinge), the shear force (Querkraftgelenk) or the normal force (Normalkraftgelenk); the
   released end displacements are condensed out of the element. A truss bar is a member with both end moments released.
   Member loads: point forces, point moments, linear line loads (global, projected, local), temperature (uniform change and a
   gradient across the depth) and imposed dislocations (a kink Δφ, a transverse jump Δw or an axial jump Δu at a point; used for
   influence lines by Land's theorem). Supports may be inclined, sprung or settled. */
function StaticsCoreFactory(G) {
  'use strict';
  const S = (G.StaticsCore = {});
  const { abs, sqrt, max, min, hypot, PI, cos, sin } = Math;
  /* E [GPa], f_y [MPa], ρ [kg/m³], α [1/K] */
  S.MATS = {
    s235: { name: 'Steel S235', E: 210, fy: 235, rho: 7850, alpha: 1.2e-5 }, s355: { name: 'Steel S355', E: 210, fy: 355, rho: 7850, alpha: 1.2e-5 },
    alu: { name: 'Aluminium 6082-T6', E: 70, fy: 260, rho: 2700, alpha: 2.3e-5 }, c24: { name: 'Timber C24', E: 11, fy: 24, rho: 420, alpha: 5e-6 },
    c30: { name: 'Concrete C30/37', E: 33, fy: 20, rho: 2400, alpha: 1e-5 }, ti: { name: 'Titanium Ti-6Al-4V', E: 114, fy: 880, rho: 4430, alpha: 8.6e-6 },
  };
  /* A [cm²], I [cm⁴], W [cm³], h [mm]: European IPE/HEB tables, plus parametric sections */
  S.SECS = {
    ipe100: { name: 'IPE 100', A: 10.3, I: 171, W: 34.2, h: 100 }, ipe160: { name: 'IPE 160', A: 20.1, I: 869, W: 109, h: 160 }, ipe200: { name: 'IPE 200', A: 28.5, I: 1943, W: 194, h: 200 },
    ipe240: { name: 'IPE 240', A: 39.1, I: 3892, W: 324, h: 240 }, ipe300: { name: 'IPE 300', A: 53.8, I: 8356, W: 557, h: 300 }, ipe400: { name: 'IPE 400', A: 84.5, I: 23130, W: 1156, h: 400 },
    ipe500: { name: 'IPE 500', A: 116, I: 48200, W: 1928, h: 500 }, heb200: { name: 'HEB 200', A: 78.1, I: 5696, W: 570, h: 200 },
    rhs100: { name: 'SHS 100×5', A: 18.7, I: 279, W: 55.9, h: 100 }, tube60: { name: 'Tube 60.3×4', A: 7.07, I: 28.2, W: 9.34, h: 60.3 },
    rect: { name: 'Rectangle 100×200', A: 200, I: 6666.7, W: 666.7, h: 200 }, rod20: { name: 'Round bar Ø20', A: 3.142, I: 0.785, W: 0.785, h: 20 },
  };
  S.rectSec = (b, hh) => ({ name: `Rectangle ${b}×${hh}`, A: (b * hh) / 100, I: (b * hh ** 3) / 12 / 1e4, W: (b * hh ** 2) / 6 / 1e3, h: hh });
  const secOf = (m) => m.secObj || S.SECS[m.sec] || S.SECS.ipe200, matOf = (m) => S.MATS[m.mat] || S.MATS.s235;
  /* SI stiffness: EA [kN], EI [kN·m²]; h [m] */
  S.props = (m) => { const sc = secOf(m), mt = matOf(m), E = mt.E * 1e6; return { EA: E * sc.A * 1e-4, EI: E * sc.I * 1e-8, A: sc.A * 1e-4, I: sc.I * 1e-8, W: sc.W * 1e-6, h: (sc.h || 100) / 1000, alpha: mt.alpha || 1.2e-5, sec: sc, mat: mt }; };
  /* restrained directions [x′, y′, rotation] in the support's own frame (turned by ang degrees) */
  const SUP = { pin: [1, 1, 0], roller: [0, 1, 0], rollerx: [1, 0, 0], fixed: [1, 1, 1], slidex: [0, 1, 1], slidey: [1, 0, 1], spring: [0, 0, 0], none: [0, 0, 0] };
  S.SUP = SUP;
  S.supFix = (sp) => sp.fix || SUP[sp.type] || SUP.none;
  S.SUP_NAMES = { pin: 'Pinned support (Festlager)', roller: 'Roller (Loslager)', rollerx: 'Roller, horizontal reaction', fixed: 'Fixed support (Einspannung)', slidex: 'Sliding clamp (Parallelführung)', slidey: 'Sliding clamp, vertical (Schiebehülse)', spring: 'Spring support (Federlager)' };

  /* local element stiffness (6×6) of a frame member */
  function kLocal(EA, EI, L) {
    const k = Array.from({ length: 6 }, () => new Float64Array(6)), a = EA / L, b = (12 * EI) / L ** 3, c = (6 * EI) / L ** 2, d = (4 * EI) / L, e = (2 * EI) / L;
    k[0][0] = k[3][3] = a; k[0][3] = k[3][0] = -a;
    k[1][1] = k[4][4] = b; k[1][4] = k[4][1] = -b; k[1][2] = k[2][1] = c; k[1][5] = k[5][1] = c; k[2][4] = k[4][2] = -c; k[4][5] = k[5][4] = -c;
    k[2][2] = k[5][5] = d; k[2][5] = k[5][2] = e;
    return k;
  }
  /* Hermite / linear shape functions at ξ = x/L and their x-derivatives: [N_u1, N_v1, N_θ1, N_u2, N_v2, N_θ2] */
  const shape = (xi, L) => [1 - xi, 1 - 3 * xi * xi + 2 * xi ** 3, L * (xi - 2 * xi * xi + xi ** 3), xi, 3 * xi * xi - 2 * xi ** 3, L * (-xi * xi + xi ** 3)];
  const dN = (xi, L) => [-1 / L, (-6 * xi + 6 * xi * xi) / L, 1 - 4 * xi + 3 * xi * xi, 1 / L, (6 * xi - 6 * xi * xi) / L, -2 * xi + 3 * xi * xi];
  const d2N = (xi, L) => [0, (-6 + 12 * xi) / (L * L), (-4 + 6 * xi) / L, 0, (6 - 12 * xi) / (L * L), (-2 + 6 * xi) / L];
  const d3N = (xi, L) => [0, 12 / L ** 3, 6 / (L * L), 0, -12 / L ** 3, 6 / (L * L)];
  S.shape = shape;
  const cl01 = (t) => max(0, min(1, t));
  /* member loads in local axes: linear pieces, point forces, point moments, thermal strains and dislocations */
  function memberLoads(model, mi, geo, p) {
    const out = { dist: [], pts: [], mom: [], disl: [], kT: 0, eT: 0 }, { c, s, L } = geo;
    for (const ld of model.mloads || []) {
      if (ld.m !== mi) continue;
      const a = cl01(ld.at == null ? 0.5 : ld.at) * L;
      if (ld.type === 'point') { const Fx = ld.Fx || 0, Fy = ld.Fy || 0; out.pts.push({ a, Px: c * Fx + s * Fy, Py: -s * Fx + c * Fy }); continue; }
      if (ld.type === 'moment') { out.mom.push({ a, M: ld.M || 0 }); continue; }
      if (ld.type === 'temp') { out.eT += p.alpha * (ld.dT || 0); out.kT += (p.alpha * (ld.dTM || 0)) / p.h; continue; }
      if (ld.type === 'disl') { out.disl.push({ a, kind: ld.kind, v: ld.v || 0 }); continue; }
      const q1 = ld.q1 || 0, q2 = ld.q2 == null ? q1 : ld.q2; // kN/m
      if (ld.dir === 'local') out.dist.push({ x1: 0, x2: 0, y1: q1, y2: q2 });
      else if (ld.dir === 'gx') out.dist.push({ x1: c * q1, x2: c * q2, y1: -s * q1, y2: -s * q2 });
      else { const f = ld.dir === 'proj' ? abs(c) : 1; out.dist.push({ x1: s * q1 * f, x2: s * q2 * f, y1: c * q1 * f, y2: c * q2 * f }); } // global Y, per member length or per horizontal projection
    }
    if (model.selfWeight) { const q = -p.A * p.mat.rho * 9.81e-3; out.dist.push({ x1: s * q, x2: s * q, y1: c * q, y2: c * q }); }
    return out;
  }
  const qAt = (ml, x, L) => { let qx = 0, qy = 0; const xi = x / L; for (const d of ml.dist) { qx += d.x1 + (d.x2 - d.x1) * xi; qy += d.y1 + (d.y2 - d.y1) * xi; } return [qx, qy]; };
  /* equivalent (consistent) nodal loads: f₀ = ∫ Nᵀ q dx + Σ N(a)ᵀ P + Σ N′(a)ᵀ M + ∫ B ᵀ D ε₀ dx for imposed strains */
  function feq(ml, L, p) {
    const f = new Float64Array(6), gp = [[-sqrt(0.6), 5 / 9], [0, 8 / 9], [sqrt(0.6), 5 / 9]];
    for (const [g, w] of gp) { const x = (L * (g + 1)) / 2, N = shape(x / L, L), [qx, qy] = qAt(ml, x, L), wt = (w * L) / 2; f[0] += N[0] * qx * wt; f[3] += N[3] * qx * wt; f[1] += N[1] * qy * wt; f[2] += N[2] * qy * wt; f[4] += N[4] * qy * wt; f[5] += N[5] * qy * wt; }
    for (const q of ml.pts) { const N = shape(q.a / L, L); f[0] += N[0] * q.Px; f[3] += N[3] * q.Px; f[1] += N[1] * q.Py; f[2] += N[2] * q.Py; f[4] += N[4] * q.Py; f[5] += N[5] * q.Py; }
    for (const q of ml.mom) { const d = dN(q.a / L, L); for (const i of [1, 2, 4, 5]) f[i] += d[i] * q.M; } // a couple does work M·w′(a)
    if (ml.eT) { f[0] -= p.EA * ml.eT; f[3] += p.EA * ml.eT; } // restrained expansion pushes the ends apart
    if (ml.kT) { f[2] -= p.EI * ml.kT; f[5] += p.EI * ml.kT; } // restrained thermal curvature: end couples EI κ_T
    for (const q of ml.disl) {
      const xi = q.a / L;
      if (q.kind === 'phi') { const d = d2N(xi, L); for (const i of [1, 2, 4, 5]) f[i] += p.EI * q.v * d[i]; } // concentrated curvature Δφ δ(x − a): f = EI Δφ N″(a)
      else if (q.kind === 'w') { const d = d3N(xi, L); for (const i of [1, 2, 4, 5]) f[i] -= p.EI * q.v * d[i]; } // transverse jump: conjugate to the shear force
      else if (q.kind === 'u') { f[0] -= (p.EA * q.v) / L; f[3] += (p.EA * q.v) / L; } // axial jump: concentrated axial strain
    }
    return f;
  }
  /* condense released local dofs out of (k, f) */
  function condense(k, f, rel) {
    const K = k.map((r) => Float64Array.from(r)), Fv = Float64Array.from(f);
    for (const r of rel) { const krr = K[r][r]; if (abs(krr) < 1e-300) continue; for (let i = 0; i < 6; i++) { if (i === r) continue; const fac = K[i][r] / krr; for (let j = 0; j < 6; j++) K[i][j] -= fac * K[r][j]; Fv[i] -= fac * Fv[r]; } for (let j = 0; j < 6; j++) { K[r][j] = 0; K[j][r] = 0; } Fv[r] = 0; }
    return { K, F: Fv };
  }
  S.geo = (model, mi) => { const m = model.members[mi], A = model.nodes[m.a], B = model.nodes[m.b], L = hypot(B.x - A.x, B.y - A.y) || 1e-9; return { L, c: (B.x - A.x) / L, s: (B.y - A.y) / L }; };
  /* released local dofs: moment (2, 5), shear (1, 4), normal force (0, 3) */
  const rels = (m) => { const r = []; if (m.na) r.push(0); if (m.va) r.push(1); if (m.type === 'truss' || m.ra) r.push(2); if (m.nb) r.push(3); if (m.vb) r.push(4); if (m.type === 'truss' || m.rb) r.push(5); return r; };
  S.rels = rels;
  /* small dense solve with zero pivots skipped (their unknowns set to 0) */
  function smallSolve(A, b) {
    const n = b.length, M = A.map((r, i) => [...r, b[i]]), x = new Array(n).fill(0), piv = [];
    for (let c = 0, r0 = 0; c < n && r0 < n; c++) { let p = r0; for (let r = r0 + 1; r < n; r++) if (abs(M[r][c]) > abs(M[p][c])) p = r; if (abs(M[p][c]) < 1e-12) continue; [M[p], M[r0]] = [M[r0], M[p]]; for (let r = 0; r < n; r++) { if (r === r0) continue; const f = M[r][c] / M[r0][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[r0][k]; } piv.push([r0, c]); r0++; }
    for (const [r, c] of piv) x[c] = M[r][n] / M[r][c];
    return x;
  }

  /* consistent mass of a frame member in local axes (t, t·m, t·m²); members with releases get lumped masses */
  function mLocal(mu, L, lumped) {
    const m = Array.from({ length: 6 }, () => new Float64Array(6)), c = (mu * L) / 420;
    if (lumped) { const h2 = (mu * L) / 2, J = c * 4 * L * L; m[0][0] = m[1][1] = m[3][3] = m[4][4] = h2; m[2][2] = m[5][5] = J; return m; }
    const v = [[140, 0, 0, 70, 0, 0], [0, 156, 22 * L, 0, 54, -13 * L], [0, 22 * L, 4 * L * L, 0, 13 * L, -3 * L * L], [70, 0, 0, 140, 0, 0], [0, 54, 13 * L, 0, 156, -22 * L], [0, -13 * L, -3 * L * L, 0, -22 * L, 4 * L * L]];
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) m[i][j] = c * v[i][j];
    return m;
  }
  /* global matrices: K (and M, C when asked), load vector F, support frames, restraints, springs, dampers */
  function assemble(model, dyn) {
    const nN = model.nodes.length, nD = 3 * nN, K = Array.from({ length: nD }, () => new Float64Array(nD)), F = new Float64Array(nD), el = [];
    const Mm = dyn ? Array.from({ length: nD }, () => new Float64Array(nD)) : null, Cm = dyn ? Array.from({ length: nD }, () => new Float64Array(nD)) : null;
    for (const ld of model.nloads || []) { if (ld.n >= nN) continue; F[3 * ld.n] += ld.Fx || 0; F[3 * ld.n + 1] += ld.Fy || 0; F[3 * ld.n + 2] += ld.M || 0; }
    const toGlobal = (A, T) => { const out = Array.from({ length: 6 }, () => new Float64Array(6)); for (let j = 0; j < 6; j++) { const e = new Float64Array(6); e[j] = 1; const Te = T(e), col = T(A.map((row) => row.reduce((acc, v, i) => acc + v * Te[i], 0)), true); for (let i = 0; i < 6; i++) out[i][j] = col[i]; } return out; };
    model.members.forEach((m, mi) => {
      const g = S.geo(model, mi), p = S.props(m), k = kLocal(p.EA, p.EI, g.L), ml = memberLoads(model, mi, g, p), f0 = feq(ml, g.L, p), r = rels(m), cd = condense(k, f0, r);
      const T = (v, inv) => { const o = new Float64Array(6); for (const b of [0, 3]) { if (!inv) { o[b] = g.c * v[b] + g.s * v[b + 1]; o[b + 1] = -g.s * v[b] + g.c * v[b + 1]; } else { o[b] = g.c * v[b] - g.s * v[b + 1]; o[b + 1] = g.s * v[b] + g.c * v[b + 1]; } o[b + 2] = v[b + 2]; } return o; };
      const dofs = [3 * m.a, 3 * m.a + 1, 3 * m.a + 2, 3 * m.b, 3 * m.b + 1, 3 * m.b + 2];
      const kg = toGlobal(cd.K, T), fg = T(cd.F, true);
      for (let i = 0; i < 6; i++) { F[dofs[i]] += fg[i]; for (let j = 0; j < 6; j++) K[dofs[i]][dofs[j]] += kg[i][j]; }
      if (dyn) { const mg = toGlobal(mLocal((p.A * p.mat.rho) / 1000, g.L, r.length > 0), T); for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) Mm[dofs[i]][dofs[j]] += mg[i][j]; }
      el.push({ m, mi, g, p, k, f0, r, cd, ml, T, dofs, kg, fg });
    });
    if (dyn) for (let n = 0; n < nN; n++) { const nm = (model.nodes[n].mass || 0) / 1000; if (nm) { Mm[3 * n][3 * n] += nm; Mm[3 * n + 1][3 * n + 1] += nm; } }
    // inclined supports: turn the node's translational dofs into the support frame, K′ = Qᵀ K Q, F′ = Qᵀ F (and M, C alike)
    const rot = new Map();
    for (const sp of model.supports || []) if (sp.ang && sp.n < nN && !rot.has(sp.n)) { const a = (sp.ang * PI) / 180; rot.set(sp.n, [cos(a), sin(a)]); }
    const turn = (A, ia, ib, c, s) => { for (let i = 0; i < nD; i++) { const a = A[i][ia], b = A[i][ib]; A[i][ia] = c * a + s * b; A[i][ib] = -s * a + c * b; } const ra = A[ia], rb = A[ib]; for (let j = 0; j < nD; j++) { const a = ra[j], b = rb[j]; ra[j] = c * a + s * b; rb[j] = -s * a + c * b; } };
    for (const [n, [c, s]] of rot) { const ia = 3 * n, ib = ia + 1; turn(K, ia, ib, c, s); if (dyn) turn(Mm, ia, ib, c, s); const fa = F[ia], fb = F[ib]; F[ia] = c * fa + s * fb; F[ib] = -s * fa + c * fb; }
    // restraints, springs, dampers and settlements (all in the support frame)
    const fixed = new Uint8Array(nD), presc = new Float64Array(nD), notes = [], springs = [];
    for (const sp of model.supports || []) {
      if (sp.n >= nN) continue; const fl = S.supFix(sp), b = 3 * sp.n, kk = [sp.kx || 0, sp.ky || 0, sp.kr || 0], pd = [sp.dx || 0, sp.dy || 0, sp.dr || 0], cc = [sp.cx || 0, sp.cy || 0, sp.cr || 0];
      for (let i = 0; i < 3; i++) { if (fl[i]) { fixed[b + i] = 1; presc[b + i] = pd[i]; } else { if (kk[i] > 0) { K[b + i][b + i] += kk[i]; springs.push([b + i, kk[i], sp]); } if (dyn && cc[i] > 0) Cm[b + i][b + i] += cc[i]; } }
    }
    // rotations nobody resists (pin-jointed truss nodes, nodes where every end is hinged): drop them
    let kmax = 0; for (let i = 0; i < nD; i++) kmax = max(kmax, abs(K[i][i]));
    const dropped = [];
    for (let n = 0; n < nN; n++) { const i = 3 * n + 2; if (!fixed[i] && abs(K[i][i]) < 1e-12 * kmax) { if (abs(F[i]) > 1e-9) notes.push(`A moment acts on node ${n + 1}, but nothing there can take a moment.`); fixed[i] = 2; dropped.push(n); } }
    return { nN, nD, K, F, el, M: Mm, C: Cm, rot, fixed, presc, notes, springs, dropped, kmax };
  }

  /* ---------------- solve ---------------- */
  S.solve = function (model) {
    const { nN, nD, K, F, el, rot, fixed, presc, notes, springs, dropped, kmax } = assemble(model, false);
    const free = [], fx = []; for (let i = 0; i < nD; i++) (fixed[i] ? fx : free).push(i);
    const nf = free.length, A = Array.from({ length: nf }, (_, i) => Float64Array.from(free.map((j) => K[free[i]][j]))), b = Float64Array.from(free.map((i) => { let v = F[i]; for (const j of fx) v -= K[i][j] * presc[j]; return v; }));
    // Gaussian elimination with partial pivoting; a vanishing pivot means a mechanism
    let mech = null;
    for (let c = 0; c < nf; c++) {
      let p = c; for (let r = c + 1; r < nf; r++) if (abs(A[r][c]) > abs(A[p][c])) p = r;
      if (abs(A[p][c]) < 1e-9 * kmax) { mech = free[c]; break; }
      if (p !== c) { const t = A[p]; A[p] = A[c]; A[c] = t; const tb = b[p]; b[p] = b[c]; b[c] = tb; }
      for (let r = c + 1; r < nf; r++) { const f = A[r][c] / A[c][c]; if (!f) continue; for (let k2 = c; k2 < nf; k2++) A[r][k2] -= f * A[c][k2]; b[r] -= f * b[c]; }
    }
    if (mech != null || !nN) { const n = ((mech || 0) / 3) | 0, d = ['moving sideways', 'moving up and down', 'turning'][(mech || 0) % 3]; return { ok: false, err: `Mechanism: node ${n + 1} can move without resistance (${d}).`, mechDof: mech, notes }; }
    const x = new Float64Array(nf); for (let r = nf - 1; r >= 0; r--) { let v = b[r]; for (let c = r + 1; c < nf; c++) v -= A[r][c] * x[c]; x[r] = v / A[r][r]; }
    const up = Float64Array.from(presc); free.forEach((i, k) => (up[i] = x[k]));
    // reactions in the support frame: R′ = K′u′ − F′ at restrained dofs, −k u′ at springs
    const Rp = new Float64Array(nD);
    for (const i of fx) { if (fixed[i] === 2) continue; let v = -F[i]; for (let j = 0; j < nD; j++) v += K[i][j] * up[j]; Rp[i] = v; }
    for (const [i, k] of springs) Rp[i] = -k * up[i];
    // back to global: u = Q u′, R = Q R′
    const u = Float64Array.from(up), Rr = Float64Array.from(Rp);
    for (const [n, [c, s]] of rot) { const ia = 3 * n, ib = ia + 1; u[ia] = c * up[ia] - s * up[ib]; u[ib] = s * up[ia] + c * up[ib]; Rr[ia] = c * Rp[ia] - s * Rp[ib]; Rr[ib] = s * Rp[ia] + c * Rp[ib]; }
    // member end forces (local, acting on the member) and the displacements of released ends
    for (const e of el) {
      const ul = e.T(Float64Array.from(e.dofs.map((d) => u[d]))), f = new Float64Array(6), r = e.r;
      if (r.length) { const A2 = r.map((ri) => r.map((rj) => e.k[ri][rj])), b2 = r.map((ri) => { let v = e.f0[ri]; for (let j = 0; j < 6; j++) if (!r.includes(j)) v -= e.k[ri][j] * ul[j]; return v; }), xs = smallSolve(A2, b2); r.forEach((ri, k) => (ul[ri] = xs[k])); }
      for (let i = 0; i < 6; i++) { let v = -e.f0[i]; for (let j = 0; j < 6; j++) v += e.k[i][j] * ul[j]; f[i] = v; }
      e.ul = ul; e.f = f;
    }
    const res = { ok: true, u, R: Rr, Rloc: Rp, fixed, el, notes, dropped, model, springs, rot };
    res.members = el.map((e) => S.diagram(e));
    return res;
  };
  /* internal forces and deflection along a member, with stations on both sides of every jump */
  S.diagram = function (e) {
    const L = e.g.L, f = e.f, ml = e.ml, xs = new Set(), n = 64; for (let i = 0; i <= n; i++) xs.add((i / n) * L);
    const jumps = [...ml.pts.map((q) => q.a), ...ml.mom.map((q) => q.a), ...ml.disl.map((q) => q.a)];
    for (const a of jumps) { xs.add(max(0, a - 1e-9 * L)); xs.add(min(L, a + 1e-9 * L)); }
    const X = [...xs].sort((a, b) => a - b);
    /* closed forms: ∫₀ˣ q dt and ∫₀ˣ (x − t) q dt for linear q, plus the point forces and couples left of x */
    const at = (x) => { let Iqx = 0, Iqy = 0, Mq = 0; const xi = x / L;
      for (const d of ml.dist) { Iqx += d.x1 * x + ((d.x2 - d.x1) * x * xi) / 2; Iqy += d.y1 * x + ((d.y2 - d.y1) * x * xi) / 2; Mq += (d.y1 * x * x) / 2 + ((d.y2 - d.y1) * x * x * xi) / 6; }
      for (const q of ml.pts) if (q.a < x) { Iqx += q.Px; Iqy += q.Py; Mq += (x - q.a) * q.Py; }
      for (const q of ml.mom) if (q.a < x) Mq -= q.M;
      return [-f[0] - Iqx, f[1] + Iqy, -f[2] + x * f[1] + Mq]; };
    const N = [], V = [], M = []; for (const x of X) { const r = at(x); N.push(r[0]); V.push(r[1]); M.push(r[2]); }
    /* deflection: w = w_a + θ′x + ∫₀ˣ (x − t) κ dt + dislocations, κ = M/EI + κ_T; θ′ from w(L) = w_b; Simpson per segment */
    const EI = e.p.EI, kT = ml.kT, c1 = [0], c2 = [0];
    for (let i = 1; i < X.length; i++) { const hh = X[i] - X[i - 1], k0 = M[i - 1] / EI + kT, k1 = M[i] / EI + kT, km = at(X[i - 1] + hh / 2)[2] / EI + kT; c1.push(c1[i - 1] + (hh * (k0 + 4 * km + k1)) / 6); c2.push(c2[i - 1] + hh * c1[i - 1] + (hh * hh * (k0 + 2 * km)) / 6); }
    const wd = (x) => { let v = 0; for (const q of ml.disl) { if (q.kind === 'phi' && x > q.a) v += q.v * (x - q.a); else if (q.kind === 'w' && x > q.a) v += q.v; } return v; };
    const td = (x) => { let v = 0; for (const q of ml.disl) if (q.kind === 'phi' && x > q.a) v += q.v; return v; };
    const ud = (x) => { let v = 0; for (const q of ml.disl) if (q.kind === 'u' && x > q.a) v += q.v; return v; };
    const wa = e.ul[1], wb = e.ul[4], th = (wb - wa - c2[c2.length - 1] - wd(L)) / L, ua = e.ul[0], ub = e.ul[3], duT = ub - ua - ud(L);
    const w = X.map((x, i) => wa + th * x + c2[i] + wd(x)), slope = X.map((x, i) => th + c1[i] + td(x)), uu = X.map((x) => ua + (duT * x) / L + ud(x));
    let im = 0, iv = 0, in2 = 0, iw = 0; for (let i = 0; i < X.length; i++) { if (abs(M[i]) > abs(M[im])) im = i; if (abs(V[i]) > abs(V[iv])) iv = i; if (abs(N[i]) > abs(N[in2])) in2 = i; if (abs(w[i]) > abs(w[iw])) iw = i; }
    const p = e.p, smax = max(...X.map((_, i) => abs(N[i]) / p.A + abs(M[i]) / p.W)) / 1000;
    return { x: X, N, V, M, w, u: uu, th: slope, L, at, kT, eT: ml.eT, max: { M: [X[im], M[im]], V: [X[iv], V[iv]], N: [X[in2], N[in2]], w: [X[iw], w[iw]] }, sigma: smax, util: smax / p.mat.fy, Ncr: (PI * PI * p.EI) / (L * L), comp: N.some((v) => v < -1e-9) ? min(...N) : 0 };
  };
  /* value of a diagram array at x by linear interpolation (right-continuous at jumps) */
  S.interp = (d, key, x) => { const X = d.x; if (x <= X[0]) return d[key][0]; for (let i = 1; i < X.length; i++) if (X[i] >= x) { const t = (x - X[i - 1]) / (X[i] - X[i - 1] || 1); return d[key][i - 1] + (d[key][i] - d[key][i - 1]) * t; } return d[key][X.length - 1]; };
  /* global displacement [ux, uy] and rotation of member mi at local x */
  /* deflection at x by cubic Hermite interpolation of w and its slope between stations (fourth-order accurate) */
  S.wAt = (d, x) => { const X = d.x; let i = 1; while (i < X.length - 1 && X[i] < x) i++; const h = X[i] - X[i - 1] || 1, t = max(0, min(1, (x - X[i - 1]) / h)), t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * d.w[i - 1] + (t3 - 2 * t2 + t) * h * d.th[i - 1] + (-2 * t3 + 3 * t2) * d.w[i] + (t3 - t2) * h * d.th[i]; };
  S.dispAt = (res, mi, x) => { const d = res.members[mi], g = res.el[mi].g, lu = S.interp(d, 'u', x), lw = S.wAt(d, x); return [g.c * lu - g.s * lw, g.s * lu + g.c * lw, S.interp(d, 'th', x)]; };
  S.pointOf = (model, mi, t) => { const m = model.members[mi], A = model.nodes[m.a], B = model.nodes[m.b]; return [A.x + (B.x - A.x) * t, A.y + (B.y - A.y) * t]; };

  /* ---------------- linear dynamics ----------------
     M ü + C u̇ + K u = F, the static loads switched on at t = 0 (a step load) from rest. M: consistent element masses (lumped for
     members with releases) plus point masses; C: support dampers plus stiffness-proportional damping β K with ζ at the first mode.
     Newmark's average-acceleration rule (unconditionally stable). The response swings about the static solution and settles on it. */
  function lu(A) { const n = A.length, L = A.map((r) => Float64Array.from(r)), piv = new Int32Array(n); for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (abs(L[r][c]) > abs(L[p][c])) p = r; piv[c] = p; if (p !== c) { const t = L[p]; L[p] = L[c]; L[c] = t; } const d = L[c][c]; if (abs(d) < 1e-300) return null; for (let r = c + 1; r < n; r++) { const f = (L[r][c] /= d); if (f) for (let k = c + 1; k < n; k++) L[r][k] -= f * L[c][k]; } } return { L, piv, n }; }
  function luSolve(F, b) { const { L, piv, n } = F, x = Float64Array.from(b); for (let c = 0; c < n; c++) { const p = piv[c]; if (p !== c) { const t = x[p]; x[p] = x[c]; x[c] = t; } } for (let r = 1; r < n; r++) { let v = x[r]; const Lr = L[r]; for (let k = 0; k < r; k++) v -= Lr[k] * x[k]; x[r] = v; } for (let r = n - 1; r >= 0; r--) { let v = x[r]; for (let k = r + 1; k < n; k++) v -= L[r][k] * x[k]; x[r] = v / L[r][r]; } return x; }
  const mv = (A, x) => { const y = new Float64Array(A.length); for (let i = 0; i < A.length; i++) { let v = 0; const r = A[i]; for (let j = 0; j < x.length; j++) v += r[j] * x[j]; y[i] = v; } return y; };
  const dot = (a, b) => { let v = 0; for (let i = 0; i < a.length; i++) v += a[i] * b[i]; return v; };
  /* split every beam into ns elements (loads, releases and masses carried over) so that the mass is distributed well enough */
  S.subdivide = function (model, ns) {
    const m = JSON.parse(JSON.stringify(model)), out = { nodes: m.nodes, members: [], supports: m.supports || [], nloads: m.nloads || [], mloads: [], selfWeight: m.selfWeight };
    m.members.forEach((mm, mi) => {
      const k = mm.type === 'truss' ? 1 : ns, A = m.nodes[mm.a], B = m.nodes[mm.b], ids = [mm.a];
      for (let j = 1; j < k; j++) { out.nodes.push({ x: A.x + ((B.x - A.x) * j) / k, y: A.y + ((B.y - A.y) * j) / k }); ids.push(out.nodes.length - 1); } ids.push(mm.b);
      const first = out.members.length;
      for (let j = 0; j < k; j++) { const e = Object.assign({}, mm, { a: ids[j], b: ids[j + 1] }); if (j > 0) { delete e.ra; delete e.va; delete e.na; } if (j < k - 1) { delete e.rb; delete e.vb; delete e.nb; } e.parent = mi; out.members.push(e); }
      for (const ld of m.mloads || []) { if (ld.m !== mi) continue; const at = ld.at == null ? 0.5 : ld.at;
        if (ld.type === 'point' || ld.type === 'moment' || ld.type === 'disl') { const j = Math.min(k - 1, Math.floor(at * k - 1e-12 < 0 ? 0 : at * k - 1e-12)); out.mloads.push(Object.assign({}, ld, { m: first + j, at: at * k - j })); }
        else if (ld.type === 'temp') for (let j = 0; j < k; j++) out.mloads.push(Object.assign({}, ld, { m: first + j }));
        else { const q1 = ld.q1 || 0, q2 = ld.q2 == null ? q1 : ld.q2; for (let j = 0; j < k; j++) out.mloads.push(Object.assign({}, ld, { m: first + j, q1: q1 + ((q2 - q1) * j) / k, q2: q1 + ((q2 - q1) * (j + 1)) / k })); } }
    });
    return out;
  };
  S.dynamics = function (model0, o) {
    o = o || {}; const model = S.subdivide(model0, o.sub || 4), st = S.solve(model); if (!st.ok) return { ok: false, err: st.err };
    const A = assemble(model, true), { nD, K, F, M, C, fixed, presc, el, rot } = A, free = []; for (let i = 0; i < nD; i++) if (!fixed[i]) free.push(i); const n = free.length; if (!n) return { ok: false, err: 'Nothing can move.' };
    const red = (X) => free.map((i) => Float64Array.from(free.map((j) => X[i][j]))), Kr = red(K), Mr = red(M), Cd = red(C);
    const Fr = Float64Array.from(free.map((i) => { let v = F[i]; for (let j = 0; j < nD; j++) if (fixed[j]) v -= K[i][j] * presc[j]; return v; }));
    let mmax = 0; for (let i = 0; i < n; i++) mmax = max(mmax, Mr[i][i]); for (let i = 0; i < n; i++) if (Mr[i][i] < 1e-7 * mmax) Mr[i][i] = 1e-7 * mmax; // keep M regular at massless rotations
    const Kf = lu(Kr), Mf = lu(Mr); if (!Kf || !Mf) return { ok: false, err: 'Singular system.' };
    // first mode by inverse iteration: x ← K⁻¹ M x
    let x = new Float64Array(n).map((_, i) => 1 + 0.1 * Math.sin(i * 1.7)), w2 = 0;
    for (let it = 0; it < 80; it++) { const y = luSolve(Kf, mv(Mr, x)), nm = sqrt(dot(y, mv(Mr, y))) || 1; for (let i = 0; i < n; i++) x[i] = y[i] / nm; const w2n = dot(x, mv(Kr, x)) / dot(x, mv(Mr, x)); if (it > 5 && abs(w2n - w2) < 1e-12 * w2n) { w2 = w2n; break; } w2 = w2n; }
    const w1 = sqrt(max(w2, 1e-12)), zeta = o.zeta == null ? 0.02 : o.zeta, beta = (2 * zeta) / w1, Cr = Cd.map((r, i) => r.map((v, j) => v + beta * Kr[i][j]));
    const zeta1 = dot(x, mv(Cr, x)) / (2 * w1 * dot(x, mv(Mr, x)));
    const T1 = (2 * PI) / w1, dt = o.dt || T1 / 60, g = 0.5, b = 0.25, a0 = 1 / (b * dt * dt), a1 = g / (b * dt), a2 = 1 / (b * dt), a3 = 1 / (2 * b) - 1, a4 = g / b - 1, a5 = (dt / 2) * (g / b - 2);
    const Kh = lu(Kr.map((r, i) => r.map((v, j) => v + a0 * Mr[i][j] + a1 * Cr[i][j])));
    const sys = { ok: true, n, w1, f1: w1 / (2 * PI), T1, zeta1, zeta, dt, t: 0, static: st, mode: x, model };
    let u = new Float64Array(n), v = new Float64Array(n), ac = luSolve(Mf, Fr);
    sys.reset = () => { u = new Float64Array(n); v = new Float64Array(n); ac = luSolve(Mf, Fr); sys.t = 0; };
    sys.step = (k) => { for (let s2 = 0; s2 < (k || 1); s2++) { const r = new Float64Array(n); for (let i = 0; i < n; i++) { let m1 = 0, c1 = 0; const Mi = Mr[i], Ci = Cr[i]; for (let j = 0; j < n; j++) { m1 += Mi[j] * (a0 * u[j] + a2 * v[j] + a3 * ac[j]); c1 += Ci[j] * (a1 * u[j] + a4 * v[j] + a5 * ac[j]); } r[i] = Fr[i] + m1 + c1; } const un = luSolve(Kh, r); for (let i = 0; i < n; i++) { const an = a0 * (un[i] - u[i]) - a2 * v[i] - a3 * ac[i]; v[i] += dt * ((1 - g) * ac[i] + g * an); ac[i] = an; u[i] = un[i]; } sys.t += dt; } };
    /* global displacements now (support frames turned back) */
    sys.u = () => { const up = Float64Array.from(presc); free.forEach((i, k) => (up[i] = u[k])); const ug = Float64Array.from(up); for (const [nn, [c, s]] of rot) { const ia = 3 * nn, ib = ia + 1; ug[ia] = c * up[ia] - s * up[ib]; ug[ib] = s * up[ia] + c * up[ib]; } return ug; };
    /* member shapes: Hermite interpolation of the end values plus the member's own (clamped) deflection under its loads */
    const herm = (e, ul, X) => X.map((xx) => { const N = shape(xx / e.g.L, e.g.L); return [N[0] * ul[0] + N[3] * ul[3], N[1] * ul[1] + N[2] * ul[2] + N[4] * ul[4] + N[5] * ul[5]]; });
    const endVals = (e, ug) => { const ul = e.T(Float64Array.from(e.dofs.map((d) => ug[d]))), r = e.r; if (r.length) { const A2 = r.map((ri) => r.map((rj) => e.k[ri][rj])), b2 = r.map((ri) => { let q = e.f0[ri]; for (let j = 0; j < 6; j++) if (!r.includes(j)) q -= e.k[ri][j] * ul[j]; return q; }), xs = smallSolve(A2, b2); r.forEach((ri, k) => (ul[ri] = xs[k])); } return ul; };
    const part = st.members.map((d, i) => { const h0 = herm(st.el[i], st.el[i].ul, d.x); return d.x.map((_, k) => [d.u[k] - h0[k][0], d.w[k] - h0[k][1]]); });
    sys.shapes = () => { const ug = sys.u(); return el.map((e, i) => { const d = st.members[i], h1 = herm(e, endVals(e, ug), d.x); return { x: d.x, u: d.x.map((_, k) => h1[k][0] + part[i][k][0]), w: d.x.map((_, k) => h1[k][1] + part[i][k][1]), L: d.L }; }); };
    // the most-displaced translational dof, for a time history
    let best = -1, bv = 0; free.forEach((i) => { if (i % 3 < 2 && abs(st.u[i]) > bv) { bv = abs(st.u[i]); best = i; } }); sys.track = best; sys.trackStatic = best >= 0 ? st.u[best] : 0;
    return sys;
  };
  S.lu = lu; S.luSolve = luSolve;

  /* ---------------- determinacy: counting criterion and the rank of the equilibrium matrix ---------------- */
  /* null space of a few constraint rows on (N, M_a, M_b) */
  function null3(rows) {
    const R = rows.map((r) => r.slice()), piv = []; let r0 = 0;
    for (let c = 0; c < 3 && r0 < R.length; c++) { let p = r0; for (let r = r0 + 1; r < R.length; r++) if (abs(R[r][c]) > abs(R[p][c])) p = r; if (abs(R[p][c]) < 1e-12) continue; [R[p], R[r0]] = [R[r0], R[p]]; const d = R[r0][c]; for (let k = 0; k < 3; k++) R[r0][k] /= d; for (let r = 0; r < R.length; r++) if (r !== r0) { const f = R[r][c]; for (let k = 0; k < 3; k++) R[r][k] -= f * R[r0][k]; } piv.push(c); r0++; }
    const basis = []; for (let fc = 0; fc < 3; fc++) { if (piv.includes(fc)) continue; const v = [0, 0, 0]; v[fc] = 1; piv.forEach((pc, i) => (v[pc] = -R[i][fc])); basis.push(v); }
    return basis;
  }
  S.determinacy = function (model) {
    const nN = model.nodes.length, hasMoment = new Uint8Array(nN);
    model.members.forEach((m) => { const r = rels(m); if (!r.includes(2)) hasMoment[m.a] = 1; if (!r.includes(5)) hasMoment[m.b] = 1; });
    for (const sp of model.supports || []) { const fl = S.supFix(sp); if (fl[2] || sp.kr) hasMoment[sp.n] = 1; }
    for (const ld of model.nloads || []) if (ld.M) hasMoment[ld.n] = 1;
    const eqIndex = []; let ne = 0; for (let n = 0; n < nN; n++) { eqIndex.push([ne, ne + 1, hasMoment[n] ? ne + 2 : -1]); ne += hasMoment[n] ? 3 : 2; }
    let unk = 0; const B = [], col = () => { const c = new Float64Array(ne); B.push(c); unk++; return c; };
    const add = (c, n, fxg, fyg, mz) => { const ix = eqIndex[n]; c[ix[0]] += fxg; c[ix[1]] += fyg; if (ix[2] >= 0) c[ix[2]] += mz; };
    model.members.forEach((m, mi) => {
      const g = S.geo(model, mi), r = rels(m), raw = [new Float64Array(ne), new Float64Array(ne), new Float64Array(ne)];
      add(raw[0], m.a, g.c, g.s, 0); add(raw[0], m.b, -g.c, -g.s, 0); // unit tension pulls both nodes towards each other
      for (const [k, end] of [[1, 'a'], [2, 'b']]) { const V = 1 / g.L; add(raw[k], m.a, g.s * V, -g.c * V, end === 'a' ? -1 : 0); add(raw[k], m.b, -g.s * V, g.c * V, end === 'b' ? -1 : 0); } // unit end couple: V = (M_a + M_b)/L
      const cons = []; if (r.includes(2)) cons.push([0, 1, 0]); if (r.includes(5)) cons.push([0, 0, 1]); if (r.includes(1) || r.includes(4)) cons.push([0, 1, 1]); if (r.includes(0) || r.includes(3)) cons.push([1, 0, 0]);
      for (const bv of cons.length ? null3(cons) : [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) { const c = col(); for (let i = 0; i < ne; i++) c[i] = bv[0] * raw[0][i] + bv[1] * raw[1][i] + bv[2] * raw[2][i]; }
    });
    const memUnk = unk; let a = 0;
    for (const sp of model.supports || []) { const fl = S.supFix(sp), ix = eqIndex[sp.n], an = ((sp.ang || 0) * PI) / 180, c = cos(an), s = sin(an); if (!ix) continue;
      for (let i = 0; i < 3; i++) if (fl[i] || [sp.kx, sp.ky, sp.kr][i]) { const cc = col(); if (i === 0) { cc[ix[0]] = c; cc[ix[1]] = s; } else if (i === 1) { cc[ix[0]] = -s; cc[ix[1]] = c; } else if (ix[2] >= 0) cc[ix[2]] = 1; a++; } }
    // rank by Gaussian elimination on the ne × unk matrix
    const Mx = Array.from({ length: ne }, (_, i) => Float64Array.from(B.map((c) => c[i]))); let rank = 0; const cmax = Mx.reduce((s, r) => max(s, ...r.map(abs)), 0) || 1;
    for (let c = 0, r0 = 0; c < unk && r0 < ne; c++) { let p = r0; for (let r = r0 + 1; r < ne; r++) if (abs(Mx[r][c]) > abs(Mx[p][c])) p = r; if (abs(Mx[p][c]) < 1e-10 * cmax) continue; [Mx[p], Mx[r0]] = [Mx[r0], Mx[p]]; for (let r = r0 + 1; r < ne; r++) { const f = Mx[r][c] / Mx[r0][c]; if (f) for (let k = c; k < unk; k++) Mx[r][k] -= f * Mx[r0][k]; } r0++; rank++; }
    return { a, z: memUnk, e: ne, n: unk - ne, rank, statDeg: unk - rank, kinDeg: ne - rank, eqNodes: ne };
  };
  return S;
}
if (typeof window !== 'undefined') StaticsCoreFactory(window); else if (typeof globalThis !== 'undefined') StaticsCoreFactory(globalThis);
