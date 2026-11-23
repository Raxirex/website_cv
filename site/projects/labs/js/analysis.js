/* Dynamic Interactive Labs — analysis: degrees of freedom, static equilibrium, linearised modal analysis */
(function (G) {
  'use strict';
  const MB = G.MB;
  const { sqrt, abs, max, PI } = Math;

  /* Rank of the active constraint Jacobian → f = n − rank */
  MB.dof = function (model) {
    const sim = new MB.Sim(model);
    sim.qd.fill(0);
    sim.chooseActive();
    sim.evalCons(sim.q, sim.qd, sim.t);
    const n = sim.n, rows = [];
    for (let r = 0; r < sim.m; r++) if (sim.act[r]) rows.push(Array.from(sim.J.subarray(r * n, r * n + n)));
    const rank = rankOf(rows, n);
    const uniTotal = sim.uni.reduce((a, b) => a + b, 0);
    return { n, k: rows.length, rank, f: n - rank, redundant: rows.length - rank, uniTotal, nb: sim.nb, warnings: sim.warnings };
  };

  function rankOf(rows, n) {
    const A = rows.map((r) => r.slice());
    let rank = 0, scale = 0;
    A.forEach((r) => r.forEach((v) => (scale = max(scale, abs(v)))));
    const tol = 1e-9 * max(1, scale);
    for (let c = 0; c < n && rank < A.length; c++) {
      let p = -1, best = tol;
      for (let r = rank; r < A.length; r++) if (abs(A[r][c]) > best) { best = abs(A[r][c]); p = r; }
      if (p < 0) continue;
      [A[rank], A[p]] = [A[p], A[rank]];
      for (let r = 0; r < A.length; r++) {
        if (r === rank) continue;
        const f = A[r][c] / A[rank][c];
        if (f) for (let k = c; k < n; k++) A[r][k] -= f * A[rank][k];
      }
      rank++;
    }
    return rank;
  }

  /* Null space of J (rows) as columns; returned M-orthonormal (Nᵀ M N = I) */
  function nullSpace(rows, n, mass) {
    const A = rows.map((r) => r.slice());
    let scale = 0;
    A.forEach((r) => r.forEach((v) => (scale = max(scale, abs(v)))));
    const tol = 1e-9 * max(1, scale), piv = [];
    let rank = 0;
    for (let c = 0; c < n && rank < A.length; c++) {
      let p = -1, best = tol;
      for (let r = rank; r < A.length; r++) if (abs(A[r][c]) > best) { best = abs(A[r][c]); p = r; }
      if (p < 0) continue;
      [A[rank], A[p]] = [A[p], A[rank]];
      const pv = A[rank][c];
      for (let k = 0; k < n; k++) A[rank][k] /= pv;
      for (let r = 0; r < A.length; r++) {
        if (r === rank) continue;
        const f = A[r][c];
        if (f) for (let k = 0; k < n; k++) A[r][k] -= f * A[rank][k];
      }
      piv.push(c); rank++;
    }
    const pivSet = new Set(piv), basis = [];
    for (let fcol = 0; fcol < n; fcol++) {
      if (pivSet.has(fcol)) continue;
      const v = new Float64Array(n); v[fcol] = 1;
      piv.forEach((pc, r) => (v[pc] = -A[r][fcol]));
      basis.push(v);
    }
    const dotM = (a, b) => { let s = 0; for (let i = 0; i < n; i++) s += mass[i] * a[i] * b[i]; return s; };
    const out = [];
    for (const v of basis) {
      for (const u of out) { const d = dotM(v, u); for (let i = 0; i < n; i++) v[i] -= d * u[i]; }
      const nn = sqrt(dotM(v, v));
      if (nn > 1e-12) { for (let i = 0; i < n; i++) v[i] /= nn; out.push(v); }
    }
    return out;
  }

  /* Cyclic Jacobi eigen-decomposition of a symmetric matrix (array of rows) */
  function jacobi(S) {
    const n = S.length, A = S.map((r) => r.slice()), V = [];
    for (let i = 0; i < n; i++) { V.push(new Array(n).fill(0)); V[i][i] = 1; }
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
      if (off < 1e-22) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (abs(A[p][q]) < 1e-300) continue;
        const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(th || 1) / (abs(th) + sqrt(th * th + 1));
        const c = 1 / sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = A[k][p], akq = A[k][q];
          A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p][k], aqk = A[q][k];
          A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k][p], vkq = V[k][q];
          V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq;
        }
      }
    }
    return { values: A.map((r, i) => r[i]), vectors: V };
  }

  const hasDrive = (model) => model.joints.some((j) => j.drive === 'speed');
  const hasTimeLoad = (model) => model.forces.some((f) => (f.type === 'load' || f.type === 'torque') && (f.F1 || f.M1));

  /* Static equilibrium by kinetic damping (dynamic relaxation), time frozen at t = 0 */
  MB.equilibrium = function (model, budgetMs) {
    if (hasDrive(model)) return { ok: false, msg: 'Speed-driven joints move the system for all time, so there is no static equilibrium. Switch the drive off first.' };
    const sim = new MB.Sim(model);
    sim.freezeTime = true; sim.qd.fill(0);
    const h = Math.min(model.settings.dt, 0.002), t0 = Date.now(), lim = budgetMs || 2500;
    let Tprev = 0, steps = 0, res = Infinity;
    while (Date.now() - t0 < lim) {
      for (let k = 0; k < 200; k++) {
        sim.step(h); steps++;
        const T = sim.kinetic();
        if (T < Tprev) { sim.qd.fill(0); Tprev = 0; } else Tprev = T;
      }
      if (!sim.healthy()) return { ok: false, msg: 'The search diverged. Check that every part is held by supports, springs or ropes.' };
      sim.qd.fill(0);
      sim.chooseActive();
      res = 0;
      for (let i = 0; i < sim.n; i++) res = max(res, abs(sim.acc[i]));
      if (res < 1e-7) break;
    }
    const creeps = model.forces.some((f) => f.type === 'sd' && f.net && MB.Net && !(MB.Net.gm(f.net).k0 > 0));
    return { ok: res < 1e-3, residual: res, steps, q: Array.from(sim.q), sim, msg: res < 1e-3 ? '' : creeps ? 'Did not settle: a spring–damper network without static stiffness (Maxwell-like, no spring path between its ends) keeps creeping under load, so there is no static equilibrium.' : 'Did not settle fully. The system may have a free direction (a mechanism) or be very lightly constrained.' };
  };

  /* Linearised modes about the current initial configuration (velocities zero, time frozen) */
  MB.modal = function (model) {
    if (hasDrive(model)) return { ok: false, msg: 'Modal analysis needs a system without speed drives.' };
    const sim = new MB.Sim(model);
    sim.freezeTime = true; sim.qd.fill(0); sim.grab = null;
    sim.chooseActive();
    const n = sim.n, q0 = Float64Array.from(sim.q), mass = sim.mass;
    let res = 0;
    for (let i = 0; i < n; i++) res = max(res, abs(sim.acc[i]));
    sim.evalCons(sim.q, sim.qd, 0);
    const rows = [];
    for (let r = 0; r < sim.m; r++) if (sim.act[r]) rows.push(Array.from(sim.J.subarray(r * n, r * n + n)));
    const N = nullSpace(rows, n, mass), f = N.length;
    if (!f) return { ok: false, msg: 'The system has no degrees of freedom.' };
    const gen = (q, qd) => {
      sim.q.set(q); sim.qd.set(qd); sim.updateMem();
      const a = sim.solveAcc(sim.q, sim.qd, 0);
      return N.map((v) => { let s = 0; for (let i = 0; i < n; i++) s += v[i] * mass[i] * a[i]; return s; });
    };
    const zero = new Float64Array(n), h = 1e-5, K = [], Cd = [];
    for (let j = 0; j < f; j++) { K.push(new Array(f).fill(0)); Cd.push(new Array(f).fill(0)); }
    for (let j = 0; j < f; j++) {
      const proj = (sgn) => {
        sim.q.set(q0); sim.qd.fill(0); sim.updateMem();
        for (let i = 0; i < n; i++) sim.q[i] += sgn * h * N[j][i];
        sim.projectPos(false);
        return Float64Array.from(sim.q);
      };
      const qp = proj(1), qm = proj(-1);
      const gp = gen(qp, zero), gm = gen(qm, zero);
      const vp = N[j].map((v) => v * h), vm = N[j].map((v) => -v * h);
      const cp = gen(q0, vp), cm = gen(q0, vm);
      for (let i = 0; i < f; i++) { K[i][j] = -(gp[i] - gm[i]) / (2 * h); Cd[i][j] = -(cp[i] - cm[i]) / (2 * h); }
    }
    sim.q.set(q0); sim.qd.fill(0); sim.updateMem();
    const Ks = K.map((r, i) => r.map((v, j) => 0.5 * (v + K[j][i])));
    const { values, vectors } = jacobi(Ks);
    const modes = values.map((w2, k) => {
      const phi = vectors.map((r) => r[k]);
      const shape = new Float64Array(n);
      for (let j = 0; j < f; j++) for (let i = 0; i < n; i++) shape[i] += N[j][i] * phi[j];
      let cphi = 0;
      for (let i = 0; i < f; i++) for (let j = 0; j < f; j++) cphi += phi[i] * Cd[i][j] * phi[j];
      const w = w2 > 0 ? sqrt(w2) : 0;
      return { w2, w, fHz: w / (2 * PI), T: w > 0 ? (2 * PI) / w : Infinity, zeta: w > 1e-9 ? cphi / (2 * w) : 0, shape, kind: w2 > 1e-6 ? 'osc' : w2 < -1e-6 ? 'unstable' : 'rigid' };
    }).sort((a, b) => a.w2 - b.w2);
    return { ok: true, f, modes, residual: res, q0 };
  };

  MB.hasTimeLoad = hasTimeLoad;
})(typeof window !== 'undefined' ? window : globalThis);
