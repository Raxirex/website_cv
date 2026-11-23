/* Dynamic Interactive Labs — engine part 2: applied forces, KKT solve, RK4 step, impacts, projection, energy */
(function (G) {
  'use strict';
  const MB = G.MB, S = MB.Sim.prototype;
  const { sin, cos, sqrt, PI, max, abs, tanh } = Math;
  const D2R = PI / 180, TAU = 2 * PI;
  const TOLP = 1e-6, TOLV = 1e-5, VEPS = 0.01, VSTICK = 1e-3;

  S.applyPair = function (Q, ia, A, ib, B, Fx, Fy) {
    if (ib >= 0) { Q[3 * ib] += Fx; Q[3 * ib + 1] += Fy; Q[3 * ib + 2] += B[2] * Fy - B[3] * Fx; }
    if (ia >= 0) { Q[3 * ia] -= Fx; Q[3 * ia + 1] -= Fy; Q[3 * ia + 2] -= A[2] * Fy - A[3] * Fx; }
  };

  /* Q = conservative (gravity, springs) + non-conservative (dampers, friction, loads, drives) */
  S.evalForces = function (q, qd, t) {
    const Q = this.Q, Qn = this.Qnc, st = this.model.settings, tt = this.freezeTime ? 0 : t;
    Q.fill(0); Qn.fill(0); this.Pint = 0;
    const ga = st.gAngle * D2R, gx = st.g * cos(ga), gy = st.g * sin(ga);
    for (let i = 0; i < this.nb; i++) { Q[3 * i] += this.mass[3 * i] * gx; Q[3 * i + 1] += this.mass[3 * i] * gy; }
    for (const f of this.fl) {
      const el = f.el;
      if (el.type === 'sd') {
        const A = this.pt(f.ia, el.a.p, q, f.A), B = this.pt(f.ib, el.b.p, q, f.B);
        const vA = this.ptv(f.ia, A, qd, f.vA), vB = this.ptv(f.ib, B, qd, f.vB);
        const dx = B[0] - A[0], dy = B[1] - A[1], L = sqrt(dx * dx + dy * dy) || 1e-12, ex = dx / L, ey = dy / L;
        const Ld = ex * (vB[0] - vA[0]) + ey * (vB[1] - vA[1]), del = L - el.L0;
        let fk, fc;
        if (f.gm) {
          // network as generalized Maxwell model: F = k₀x + Σ kᵢ(x − yᵢ) + c∞ẋ, τᵢ ẏᵢ = x − yᵢ (yᵢ: dashpot stroke of arm i)
          const g = f.gm, z = this.zuse, dz = this.dz, o = f.z0;
          fk = g.k0 * del; fc = g.cinf * Ld;
          for (let i = 0; i < g.arms.length; i++) { const a = g.arms[i], s = del - z[o + i], fa = a.k * s; fk += fa; dz[o + i] = s / a.tau; this.Pint -= (fa * s) / a.tau; }
        } else { fk = (+el.k || 0) * del + (+el.k3 || 0) * del * del * del; fc = (+el.c || 0) * Ld; }
        f.L = L; f.Ld = Ld; f.F = fk + fc;
        this.applyPair(Q, f.ia, A, f.ib, B, -fk * ex, -fk * ey);
        this.applyPair(Qn, f.ia, A, f.ib, B, -fc * ex, -fc * ey);
      } else if (el.type === 'torsion') {
        const rel = (f.ib >= 0 ? q[3 * f.ib + 2] : 0) - (f.ia >= 0 ? q[3 * f.ia + 2] : 0) - el.phi0 * D2R;
        const rr = (f.ib >= 0 && qd ? qd[3 * f.ib + 2] : 0) - (f.ia >= 0 && qd ? qd[3 * f.ia + 2] : 0);
        const Mk = -(+el.kt || 0) * rel, Mc = -(+el.ct || 0) * rr;
        f.F = -(Mk + Mc); f.rel = rel;
        if (f.ib >= 0) { Q[3 * f.ib + 2] += Mk; Qn[3 * f.ib + 2] += Mc; }
        if (f.ia >= 0) { Q[3 * f.ia + 2] -= Mk; Qn[3 * f.ia + 2] -= Mc; }
      } else if (el.type === 'load') {
        const B = this.pt(f.ib, el.b.p, q, f.B);
        const F = (+el.F0 || 0) + (+el.F1 || 0) * sin(TAU * (+el.f || 0) * tt + (+el.ph || 0) * D2R);
        const al = el.angle * D2R + (el.follower ? q[3 * f.ib + 2] : 0);
        const Fx = F * cos(al), Fy = F * sin(al);
        f.F = F;
        Qn[3 * f.ib] += Fx; Qn[3 * f.ib + 1] += Fy; Qn[3 * f.ib + 2] += B[2] * Fy - B[3] * Fx;
      } else if (el.type === 'torque') {
        const Mt = (+el.M0 || 0) + (+el.M1 || 0) * sin(TAU * (+el.f || 0) * tt);
        f.F = Mt; Qn[3 * f.ib + 2] += Mt;
      }
    }
    for (const c of this.cons) {
      if (c.kind !== 'joint') continue;
      const el = c.el, ia = c.ia, ib = c.ib;
      const effort = el.drive === 'effort' ? (+el.e0 || 0) + (+el.e1 || 0) * sin(TAU * (+el.ef || 0) * tt) : 0;
      if (c.type === 'pin') {
        const rr = (ib >= 0 && qd ? qd[3 * ib + 2] : 0) - (ia >= 0 && qd ? qd[3 * ia + 2] : 0);
        const Mz = -(+el.c || 0) * rr + effort;
        if (Mz !== 0) { if (ib >= 0) Qn[3 * ib + 2] += Mz; if (ia >= 0) Qn[3 * ia + 2] -= Mz; }
      } else if (c.type === 'roller' || c.type === 'slider') {
        if (!el.c && !el.mu && !effort) continue;
        const A = this.pt(ia, el.a.p, q, c.A), B = this.pt(ib, el.b.p, q, c.B);
        const vA = this.ptv(ia, A, qd, c.vA), vB = this.ptv(ib, B, qd, c.vB);
        const al = el.angle * D2R + (ia >= 0 ? q[3 * ia + 2] : 0), ux = cos(al), uy = sin(al);
        const v = ux * (vB[0] - vA[0]) + uy * (vB[1] - vA[1]);
        const N = abs(this.lamN[c.row]);
        const F = -(+el.c || 0) * v - (+el.mu || 0) * N * tanh(v / VEPS) + effort;
        this.applyPair(Qn, ia, A, ib, B, F * ux, F * uy);
      }
    }
    const drag = +st.drag || 0;
    if (drag > 0 && qd) for (let i = 0; i < this.n; i++) Qn[i] -= drag * this.mass[i] * qd[i];
    if (this.grab && this.grab.i < this.nb) {
      const gb = this.grab, i = gb.i, P = this.pt(i, gb.p, q, gb.P || (gb.P = new Float64Array(4)));
      const v = this.ptv(i, P, qd, gb.V || (gb.V = new Float64Array(2)));
      const k = gb.k, c = gb.c;
      let Fx = k * (gb.tx - P[0]) - c * v[0], Fy = k * (gb.ty - P[1]) - c * v[1];
      const Fm = Math.hypot(Fx, Fy), cap = gb.cap || Infinity;
      if (Fm > cap) { Fx *= cap / Fm; Fy *= cap / Fm; }
      Qn[3 * i] += Fx; Qn[3 * i + 1] += Fy; Qn[3 * i + 2] += P[2] * Fy - P[3] * Fx;
    }
    for (let i = 0; i < this.n; i++) Q[i] += Qn[i];
  };

  /* Dense symmetric solve with pivot dropping (redundant constraints get λ = 0) */
  S.lin = function (k) {
    const A = this.A, b = this.b, x = this.x, used = this.used, pr = this.pr;
    let dmax = 0;
    for (let i = 0; i < k; i++) { dmax = max(dmax, abs(A[i * k + i])); used[i] = 0; pr[i] = -1; }
    const tol = 1e-11 * max(1e-30, dmax);
    for (let col = 0; col < k; col++) {
      let p = -1, best = tol;
      for (let r = 0; r < k; r++) if (!used[r] && abs(A[r * k + col]) > best) { best = abs(A[r * k + col]); p = r; }
      if (p < 0) continue;
      used[p] = 1; pr[col] = p;
      const pv = A[p * k + col];
      for (let r = 0; r < k; r++) {
        if (r === p) continue;
        const f = A[r * k + col] / pv;
        if (f === 0) continue;
        for (let c2 = col; c2 < k; c2++) A[r * k + c2] -= f * A[p * k + c2];
        b[r] -= f * b[p];
      }
    }
    for (let col = 0; col < k; col++) x[col] = pr[col] < 0 ? 0 : b[pr[col]] / A[pr[col] * k + col];
    return x;
  };

  S.rows = function (sel) {
    let k = 0;
    for (let r = 0; r < this.m; r++) if (sel[r]) this.rl[k++] = r;
    return k;
  };
  /* A = J_R W G_Rᵀ  (G = J except for sliding contacts, whose normal force acts along n − μ s t) */
  S.assemble = function (k, Gm) {
    const n = this.n, J = this.J, G = Gm || J, inv = this.inv, A = this.A, R = this.rl, sym = G === J;
    for (let a = 0; a < k; a++) {
      const ra = R[a] * n;
      for (let c = sym ? a : 0; c < k; c++) {
        const rc = R[c] * n; let s = 0;
        for (let i = 0; i < n; i++) { const ja = J[ra + i]; if (ja !== 0) s += ja * inv[i] * G[rc + i]; }
        A[a * k + c] = s;
        if (sym) A[c * k + a] = s;
      }
    }
  };
  S.rowDot = function (r, v) { const n = this.n, o = r * n, J = this.J; let s = 0; for (let i = 0; i < n; i++) s += J[o + i] * v[i]; return s; };

  /* Builds G when some contacts slide; returns the matrix to use as the force direction */
  S.forceDirs = function () {
    let any = false;
    for (let r = 0; r < this.m; r++) if (this.cn[r] && this.act[r] && this.slip[r]) { any = true; break; }
    if (!any) return this.J;
    const n = this.n, J = this.J, Gm = this.G;
    Gm.set(J);
    for (let r = 0; r < this.m; r++) {
      if (!(this.cn[r] && this.act[r] && this.slip[r])) continue;
      const f = this.mu[r] * this.slip[r], o = r * n, ot = (r + 1) * n;
      for (let i = 0; i < n; i++) Gm[o + i] -= f * J[ot + i];
    }
    return Gm;
  };

  S.solveAcc = function (q, qd, t) {
    this.evalCons(q, qd, t); this.evalForces(q, qd, t);
    const n = this.n, inv = this.inv, Q = this.Q, WQ = this.WQ, R = this.rl;
    const k = this.rows(this.act), Gm = this.forceDirs();
    for (let i = 0; i < n; i++) WQ[i] = inv[i] * Q[i];
    this.assemble(k, Gm);
    for (let a = 0; a < k; a++) this.b[a] = this.gam[R[a]] - this.rowDot(R[a], WQ);
    const x = this.lin(k), acc = this.acc;
    acc.set(Q);
    for (let a = 0; a < k; a++) { const l = x[a], o = R[a] * n; if (l !== 0) for (let i = 0; i < n; i++) acc[i] += Gm[o + i] * l; }
    for (let i = 0; i < n; i++) acc[i] *= inv[i];
    this.lam.fill(0);
    let P = this.Pint || 0; // dissipation inside spring–damper networks
    for (let i = 0; i < n; i++) P += this.Qnc[i] * (qd ? qd[i] : 0);
    for (let a = 0; a < k; a++) {
      const r = R[a];
      this.lam[r] = x[a]; P -= x[a] * this.ct[r];
      if (Gm !== this.J && this.cn[r] && this.slip[r] && qd) P -= x[a] * this.mu[r] * this.slip[r] * (this.rowDot(r + 1, qd) + this.ct[r + 1]);
    }
    this.P = P;
    return acc;
  };

  /* Active set: unilateral rows (stops, slack ropes, contacts) closed and not separating with λ ≥ 0;
     contact friction sticks while |λ_t| ≤ μ λ_n, else slides against the relative tangential velocity. */
  S.chooseActive = function () {
    const q = this.q, qd = this.qd, t = this.t, act = this.act, m = this.m;
    if (this.surfs && this.surfs.length) this.refreshContactParams();
    this.evalCons(q, qd, t);
    for (let r = 0; r < m; r++) {
      if (this.fric[r]) continue;
      if (!this.uni[r]) { act[r] = 1; continue; }
      const cd = this.rowDot(r, qd) + this.ct[r];
      act[r] = this.C[r] < TOLP && cd < TOLV ? 1 : 0;
    }
    for (let r = 0; r < m; r++) {
      if (!this.fric[r]) continue;
      const rn = r - 1;
      if (!act[rn] || this.mu[r] <= 0) { act[r] = 0; this.slip[rn] = 0; continue; }
      const vt = this.rowDot(r, qd) + this.ct[r], prev = this.slip[rn];
      if (Math.abs(vt) < VSTICK || (prev && Math.sign(vt) !== prev)) { act[r] = 1; this.slip[rn] = 0; }
      else { act[r] = 0; this.slip[rn] = vt > 0 ? 1 : -1; }
    }
    for (let it = 0; it <= 2 * m; it++) {
      this.solveAcc(q, qd, t);
      let worst = -1, wv = -1e-9;
      for (let r = 0; r < m; r++) if (this.uni[r] && !this.fric[r] && act[r] && this.lam[r] < wv) { wv = this.lam[r]; worst = r; }
      if (worst >= 0) { act[worst] = 0; if (this.cn[worst]) { act[worst + 1] = 0; this.slip[worst] = 0; } continue; }
      let over = -1, ov = 0;
      for (let r = 0; r < m; r++) {
        if (!this.fric[r] || !act[r]) continue;
        const lim = this.mu[r] * Math.max(0, this.lam[r - 1]), ex = Math.abs(this.lam[r]) - lim;
        if (ex > 1e-9 + 1e-7 * lim && ex > ov) { ov = ex; over = r; }
      }
      if (over < 0) break;
      act[over] = 0; this.slip[over - 1] = this.lam[over] > 0 ? -1 : 1;
    }
    this.lamN.set(this.lam);
  };

  S.step = function (h) {
    if (this.nz && h !== this.netH) this.refreshNets(h);
    const n = this.n, q = this.q, qd = this.qd, t = this.t, nz = this.nz, z = this.z, zs = this.zs, dz = this.dz, Z = this.zk;
    this.zuse = z;
    this.chooseActive();
    const k1 = this.k1, k2 = this.k2, k3 = this.k3, k4 = this.k4, qs = this.qs, vs = this.vs;
    k1.set(this.acc); const P1 = this.P;
    // internal network states z ride along in the same RK4 stages
    if (nz) { Z[0].set(dz); for (let i = 0; i < nz; i++) zs[i] = z[i] + 0.5 * h * dz[i]; this.zuse = zs; }
    for (let i = 0; i < n; i++) { qs[i] = q[i] + 0.5 * h * qd[i]; vs[i] = qd[i] + 0.5 * h * k1[i]; }
    this.k2q.set(vs); k2.set(this.solveAcc(qs, vs, t + 0.5 * h)); const P2 = this.P;
    if (nz) { Z[1].set(dz); for (let i = 0; i < nz; i++) zs[i] = z[i] + 0.5 * h * dz[i]; }
    for (let i = 0; i < n; i++) { qs[i] = q[i] + 0.5 * h * this.k2q[i]; vs[i] = qd[i] + 0.5 * h * k2[i]; }
    this.k3q.set(vs); k3.set(this.solveAcc(qs, vs, t + 0.5 * h)); const P3 = this.P;
    if (nz) { Z[2].set(dz); for (let i = 0; i < nz; i++) zs[i] = z[i] + h * dz[i]; }
    for (let i = 0; i < n; i++) { qs[i] = q[i] + h * this.k3q[i]; vs[i] = qd[i] + h * k3[i]; }
    this.k4q.set(vs); k4.set(this.solveAcc(qs, vs, t + h)); const P4 = this.P;
    if (nz) { for (let i = 0; i < nz; i++) z[i] += (h / 6) * (Z[0][i] + 2 * Z[1][i] + 2 * Z[2][i] + dz[i]); this.zuse = z; }
    for (let i = 0; i < n; i++) {
      q[i] += (h / 6) * (qd[i] + 2 * this.k2q[i] + 2 * this.k3q[i] + this.k4q[i]);
      qd[i] += (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    }
    this.Wnc += (h / 6) * (P1 + 2 * P2 + 2 * P3 + P4);
    if (!this.freezeTime) this.t = t + h;
    this.updateMem();
    this.postStep();
    this.updateMem();
    if (this.ropes.length) this.ropeEnds();
  };

  /* Finite rope on an end drum (yo-yo). When the wound length runs out while the drum keeps turning, the rope
     flips to the other side of the drum and winds up again: the drum's velocity component along the rope is
     reversed, its spin kept (both scaled by the bounce factor e). When the turn-around speed is tiny the drum
     "sleeps": the rope end now holds the axle and the drum spins freely. */
  S.ropeEnds = function () {
    const q = this.q, qd = this.qd, T0 = this.kinetic();
    let changed = false;
    for (const R of this.ropes) {
      if (!R.ends || !R.ends.length) continue;
      for (const E of R.ends) {
        if (E.slept) continue;
        const j = E.j, nd = R.nodes[j];
        this.ropeGeo(R, q, null);
        const w = E.wd - (this.ropePay(R, j) - E.pay0);
        if (w >= 0) continue;
        const si = j === 0 ? 0 : R.subs.length - 1, Cb = this.ropeC(R, si), k = j === 0 ? 0 : j - 1, sg = j === 0 ? -1 : 1;
        const ux = sg * R.g.ux[k], uy = sg * R.g.uy[k], i = nd.i, taut = Cb < 1e-4;
        const va = i >= 0 ? qd[3 * i] * ux + qd[3 * i + 1] * uy : 0;
        if (taut && i >= 0 && Math.abs(va) < 0.12) {
          nd.r = 0; nd.stick = false; E.slept = true;               // sleeps at the end of the string
          qd[3 * i] = 0; qd[3 * i + 1] = 0;
        } else {
          nd.s = -nd.s;
          // the jerk at the end of the string: along-rope velocity reversed, all of the drum's motion scaled by e
          if (taut && i >= 0) { const e = nd.eb; qd[3 * i] -= (1 + e) * va * ux; qd[3 * i + 1] -= (1 + e) * va * uy; qd[3 * i] *= e; qd[3 * i + 1] *= e; qd[3 * i + 2] *= e; }
        }
        R.mem.psiA[j] = 0; R.mem.psiD[j] = 0;
        this.ropeGeo(R, q, null);
        R.mem.psiA.set(R.g.psiA); R.mem.psiD.set(R.g.psiD);
        this.ropeGeo(R, q, null);
        R.subs[si].c0 += max(0, Cb) - this.ropeC(R, si);
        E.wd = 0; E.pay0 = this.ropePay(R, j);
        changed = true; this.impacts++;
      }
    }
    if (changed) {
      this.chooseActive(); this.projectVel(null);
      this.Wimp += this.kinetic() - T0;
    }
  };

  /* Impacts (Newton restitution on newly closed contacts / ropes snapping taut), then projection.
     A closing contact first tries a rough impact (no tangential slip); if that needs more than μ times
     the normal impulse, it is redone without the tangential condition. */
  S.postStep = function () {
    const q = this.q, qd = this.qd, tgt = this.tgt, m = this.m, v0 = this.vpre || (this.vpre = new Float64Array(this.n)); v0.set(qd);
    this.evalCons(q, qd, this.t);
    tgt.fill(0);
    let imp = false;
    const fr = [], st = this.model.settings, vHit = max(0.02, 2 * abs(+st.g || 0) * (+st.dt || 0.001));
    for (let r = 0; r < m; r++) {
      if (!this.uni[r] || this.fric[r] || this.act[r] || this.C[r] >= TOLP) continue;
      const cd = this.rowDot(r, qd) + this.ct[r];
      // touching exactly (C ≈ 0) counts as an impact only when closing faster than gravity alone could in one step
      if (this.C[r] >= -TOLP && cd > -vHit) continue;
      this.act[r] = 1; imp = true;
      if (cd < -1e-3) tgt[r] = -this.rest[r] * cd;
      if (this.cn[r]) { this.slip[r] = 0; if (this.mu[r] > 0) { this.act[r + 1] = 1; fr.push(r); } }
    }
    const T0 = imp ? this.kinetic() : 0;
    this.projectPos(false);
    if (fr.length) {
      const save = Float64Array.from(qd);
      this.projectVel(tgt);
      let redo = false;
      for (const r of fr) {
        let xn = 0, xt = 0;
        for (let a = 0; a < this.kv; a++) { if (this.rl[a] === r) xn = this.x[a]; if (this.rl[a] === r + 1) xt = this.x[a]; }
        if (Math.abs(xt) > this.mu[r] * Math.max(0, xn) * (1 + 1e-6) + 1e-12) { this.act[r + 1] = 0; redo = true; }
      }
      if (redo) { qd.set(save); this.projectVel(tgt); }
    } else this.projectVel(tgt);
    if (imp) { this.Wimp += this.kinetic() - T0; this.impacts++; }
    // impulses delivered by the projection (impacts and drift correction): Σ m Δv and the angular impulse about the origin
    const ip = this.impP || (this.impP = new Float64Array(3));
    for (let i = 0; i < this.nb; i++) { const mi = this.mass[3 * i], dvx = qd[3 * i] - v0[3 * i], dvy = qd[3 * i + 1] - v0[3 * i + 1]; ip[0] += mi * dvx; ip[1] += mi * dvy; ip[2] += q[3 * i] * mi * dvy - q[3 * i + 1] * mi * dvx + this.mass[3 * i + 2] * (qd[3 * i + 2] - v0[3 * i + 2]); }
  };

  S.applyJT = function (k, x, out, scale) {
    const n = this.n, J = this.J, inv = this.inv, R = this.rl;
    for (let a = 0; a < k; a++) { const l = x[a] * scale, o = R[a] * n; if (l !== 0) for (let i = 0; i < n; i++) out[i] += inv[i] * J[o + i] * l; }
  };

  /* Newton projection onto C(q,t) = 0 for bilateral + active unilateral rows (+ violated ones) */
  S.projectPos = function (initial) {
    const q = this.q;
    for (let it = 0; it < 8; it++) {
      this.evalCons(q, this.qd, this.t);
      let k = 0, err = 0;
      for (let r = 0; r < this.m; r++) {
        if (this.fric[r]) continue;
        const on = !this.uni[r] || (initial ? this.C[r] < 0 : this.act[r] || this.C[r] < -TOLP);
        if (on) { this.rl[k++] = r; err = max(err, abs(this.C[r])); }
      }
      if (err < 1e-12 || k === 0) break;
      this.assemble(k);
      for (let a = 0; a < k; a++) this.b[a] = -this.C[this.rl[a]];
      const x = this.lin(k);
      this.applyJT(k, x, q, 1);
      if (this.ropes.length) this.updateMem();
    }
  };

  /* Velocity projection: J q̇ + ∂C/∂t = target on bilateral + active rows (sticking contacts included) */
  S.projectVel = function (tgt) {
    const q = this.q, qd = this.qd;
    this.evalCons(q, qd, this.t);
    let k = 0;
    for (let r = 0; r < this.m; r++) if (!this.uni[r] || this.act[r]) this.rl[k++] = r;
    this.kv = k;
    if (!k) return;
    this.assemble(k);
    for (let a = 0; a < k; a++) { const r = this.rl[a]; this.b[a] = (tgt ? tgt[r] : 0) - (this.rowDot(r, qd) + this.ct[r]); }
    const x = this.lin(k);
    this.applyJT(k, x, qd, 1);
  };

  S.kinetic = function () {
    let T = 0;
    for (let i = 0; i < this.n; i++) T += 0.5 * this.mass[i] * this.qd[i] * this.qd[i];
    return T;
  };
  S.potential = function (q) {
    const st = this.model.settings, ga = st.gAngle * D2R, gx = st.g * cos(ga), gy = st.g * sin(ga);
    let V = 0;
    for (let i = 0; i < this.nb; i++) V -= this.mass[3 * i] * (gx * q[3 * i] + gy * q[3 * i + 1]);
    for (const f of this.fl) {
      const el = f.el;
      if (el.type === 'sd') {
        const A = this.pt(f.ia, el.a.p, q, f.A), B = this.pt(f.ib, el.b.p, q, f.B);
        const d = Math.hypot(B[0] - A[0], B[1] - A[1]) - el.L0;
        if (f.gm) { V += 0.5 * f.gm.k0 * d * d; f.gm.arms.forEach((a, i) => { const s = d - this.z[f.z0 + i]; V += 0.5 * a.k * s * s; }); }
        else V += 0.5 * (+el.k || 0) * d * d + 0.25 * (+el.k3 || 0) * d * d * d * d;
      } else if (el.type === 'torsion') {
        const rel = (f.ib >= 0 ? q[3 * f.ib + 2] : 0) - (f.ia >= 0 ? q[3 * f.ia + 2] : 0) - el.phi0 * D2R;
        V += 0.5 * (+el.kt || 0) * rel * rel;
      }
    }
    return V;
  };
  S.energy = function () {
    const T = this.kinetic(), V = this.potential(this.q);
    return { T, V, E: T + V, Wnc: this.Wnc, Wimp: this.Wimp, drift: T + V - this.E0 - this.Wnc - this.Wimp };
  };

  /* Snapshot for plots/history (re-solves accelerations and multipliers at the current state) */
  S.snapshot = function () {
    this.chooseActive();
    const e = this.energy();
    const forces = new Float64Array(this.fl.length), len = new Float64Array(this.fl.length);
    this.fl.forEach((f, i) => { forces[i] = f.F || 0; len[i] = f.el.type === 'torsion' ? f.rel || 0 : f.L || 0; });
    return {
      t: this.t, q: Float64Array.from(this.q), qd: Float64Array.from(this.qd), a: Float64Array.from(this.acc),
      lam: Float64Array.from(this.lam), act: Uint8Array.from(this.act), slip: Int8Array.from(this.slip), forces, len, T: e.T, V: e.V, E: e.E, Wnc: e.Wnc, Wimp: e.Wimp, drift: e.drift,
    };
  };

  S.saveState = function () {
    return { q: Float64Array.from(this.q), qd: Float64Array.from(this.qd), t: this.t, Wnc: this.Wnc, Wimp: this.Wimp, impacts: this.impacts, z: Float64Array.from(this.z),
      mem: this.ropes.map((R) => [Float64Array.from(R.mem.phi), Float64Array.from(R.mem.psiA), Float64Array.from(R.mem.psiD)]),
      ends: this.ropes.map((R) => ({ nodes: R.nodes.map((n) => [n.s, n.r, n.stick]), c0: R.subs.map((s) => s.c0), ends: (R.ends || []).map((E) => Object.assign({}, E)) })) };
  };
  S.loadState = function (s) {
    this.q.set(s.q); this.qd.set(s.qd); this.t = s.t; this.Wnc = s.Wnc; this.Wimp = s.Wimp; this.impacts = s.impacts;
    if (s.z && s.z.length === this.z.length) this.z.set(s.z);
    this.ropes.forEach((R, i) => {
      R.mem.phi.set(s.mem[i][0]); R.mem.psiA.set(s.mem[i][1]); R.mem.psiD.set(s.mem[i][2]);
      const e = s.ends && s.ends[i];
      if (e) { R.nodes.forEach((n, k) => { [n.s, n.r, n.stick] = e.nodes[k]; }); R.subs.forEach((sb, k) => (sb.c0 = e.c0[k])); R.ends = e.ends.map((E) => Object.assign({}, E)); }
    });
  };

  /* Spring–damper networks: reduce each tree to its generalized Maxwell form and allocate one internal state per arm.
     States start relaxed (yᵢ = x: no force in the arms). refreshNets keeps the states when the arm count is unchanged. */
  const netLen = (sim, f, q) => { const A = sim.pt(f.ia, f.el.a.p, q, f.A), B = sim.pt(f.ib, f.el.b.p, q, f.B); return Math.hypot(B[0] - A[0], B[1] - A[1]) - f.el.L0; };
  S.initNets = function () { this.z = new Float64Array(0); this.nz = 0; this.refreshNets(this.model.settings.dt); };
  S.refreshNets = function (h) {
    const old = this.z || new Float64Array(0), oldOff = new Map(); let nz = 0;
    this.netH = h;
    for (const f of this.fl) {
      if (f.gm) oldOff.set(f, [f.z0, f.gm.arms.length]);
      f.gm = null;
      if (f.el.type !== 'sd' || !f.el.net || !MB.Net) continue;
      f.gm = MB.Net.forSim(f.el.net, h); f.z0 = nz; nz += f.gm.arms.length;
    }
    const z = new Float64Array(nz);
    for (const f of this.fl) {
      if (!f.gm) continue;
      const prev = oldOff.get(f), x = netLen(this, f, this.q);
      for (let i = 0; i < f.gm.arms.length; i++) z[f.z0 + i] = prev && prev[1] === f.gm.arms.length ? old[prev[0] + i] : x;
    }
    this.z = z; this.nz = nz; this.zuse = z; this.zs = new Float64Array(nz); this.dz = new Float64Array(nz);
    this.zk = [0, 1, 2].map(() => new Float64Array(nz));
  };

  S.healthy = function () {
    for (let i = 0; i < this.n; i++) if (!Number.isFinite(this.q[i]) || !Number.isFinite(this.qd[i]) || abs(this.q[i]) > 1e6) return false;
    return true;
  };

  /* Rope drawing data at configuration q: straight pieces, arcs on pulleys, slack per span */
  S.ropeDraw = function (R, q) {
    this.ropeGeo(R, q, null);
    const g = R.g, N = R.nodes.length, segs = [], arcs = [];
    const slack = R.subs.map((_, si) => max(0, this.ropeC(R, si)));
    const spanOf = new Int32Array(Math.max(1, N - 1));
    R.subs.forEach((s, si) => { for (let k = s.a; k < s.b; k++) spanOf[k] = si; });
    for (let k = 0; k < N - 1; k++) {
      const a = R.nodes[k], b = R.nodes[k + 1], ux = g.ux[k], uy = g.uy[k];
      segs.push({
        x0: g.cx[k] + a.r * a.s * uy, y0: g.cy[k] - a.r * a.s * ux,
        x1: g.cx[k + 1] + b.r * b.s * uy, y1: g.cy[k + 1] - b.r * b.s * ux,
        l: g.l[k], span: spanOf[k],
      });
    }
    for (let j = 0; j < N; j++) {
      const nd = R.nodes[j];
      if (nd.r <= 0) continue;
      const ang = (k) => Math.atan2(-nd.s * g.ux[k], nd.s * g.uy[k]);
      if (j > 0 && j < N - 1) arcs.push({ j, cx: g.cx[j], cy: g.cy[j], r: nd.r, a0: ang(j - 1), a1: ang(j), s: nd.s, len: nd.r * g.phi[j], stick: nd.stick, th: g.th[j] });
      else arcs.push({ j, cx: g.cx[j], cy: g.cy[j], r: nd.r, drum: true, a0: j === 0 ? ang(0) : ang(j - 1), s: nd.s, end: j === 0 ? 0 : 1, th: g.th[j] });
    }
    const n0 = R.nodes[0];
    const base = n0.r > 0 ? n0.s * n0.r * g.psiD[0] : 0;
    return { segs, arcs, slack, base, degenerate: R.degenerate };
  };
})(typeof window !== 'undefined' ? window : globalThis);
