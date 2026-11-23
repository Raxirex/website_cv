/* Dynamic Interactive Labs — constraint-based rigid multibody engine (part 1: build + constraints)
   Coordinates q = [x, y, θ] per body (centre of mass, rad). Equations of motion:
     M q̈ = Q(q, q̇, t) + Jᵀλ,   J q̈ = γ   (index-1 DAE), projected back onto C(q,t) = 0 every step. */
(function (G) {
  'use strict';
  const MB = G.MB;
  const { sin, cos, sqrt, atan2, PI, max, min } = Math;
  const TAU = 2 * PI, D2R = PI / 180;
  const wrapPi = (a) => a - TAU * Math.round(a / TAU);
  const unwrap = (raw, prev) => prev + wrapPi(raw - prev);
  MB.D2R = D2R; MB.TAU = TAU;

  /* Curves for the point-on-curve joint, in their own frame (x along the frame axis, y up):
     circle R; ellipse a, b; parabola (vertex radius R, opening up); cycloid (rolling radius R, bottom at the origin, cusps at ±πR);
     sine A, L; line. c(u), c′(u), c″(u) and the closest point by Newton iteration from the previous parameter. */
  const CURVE = {
    circle: { c: (k, u) => [k.R * cos(u), k.R * sin(u)], d1: (k, u) => [-k.R * sin(u), k.R * cos(u)], d2: (k, u) => [-k.R * cos(u), -k.R * sin(u)], closed: true, range: () => [0, TAU] },
    ellipse: { c: (k, u) => [k.a * cos(u), k.b * sin(u)], d1: (k, u) => [-k.a * sin(u), k.b * cos(u)], d2: (k, u) => [-k.a * cos(u), -k.b * sin(u)], closed: true, range: () => [0, TAU] },
    parabola: { c: (k, u) => [u, (u * u) / (2 * k.R)], d1: (k, u) => [1, u / k.R], d2: (k) => [0, 1 / k.R], range: (k) => [-(k.span || 2) / 2, (k.span || 2) / 2] },
    cycloid: { c: (k, u) => [k.R * (u + sin(u)), k.R * (1 - cos(u))], d1: (k, u) => [k.R * (1 + cos(u)), k.R * sin(u)], d2: (k, u) => [-k.R * sin(u), k.R * cos(u)], range: () => [-PI * 0.999, PI * 0.999] },
    sine: { c: (k, u) => [u, k.A * sin((TAU * u) / k.L)], d1: (k, u) => [1, ((k.A * TAU) / k.L) * cos((TAU * u) / k.L)], d2: (k, u) => [0, -k.A * ((TAU / k.L) ** 2) * sin((TAU * u) / k.L)], range: (k) => [-(k.span || 2) / 2, (k.span || 2) / 2] },
    line: { c: (k, u) => [u, 0], d1: () => [1, 0], d2: () => [0, 0], range: (k) => [-(k.span || 2) / 2, (k.span || 2) / 2] },
  };
  MB.CURVE = CURVE;
  MB.curveDefaults = () => ({ type: 'circle', R: 0.5, a: 0.6, b: 0.35, A: 0.15, L: 1, span: 2 });
  /* closest parameter to the local point (x, y), starting from u0 */
  MB.curveClosest = function (k, x, y, u0) {
    const C = CURVE[k.type] || CURVE.circle;
    if (k.type === 'circle') { const u = Math.atan2(y, x); return u0 == null ? u : unwrap(u, u0); }
    let u = u0;
    if (u == null || !isFinite(u)) { const [a, b] = C.range(k); let best = Infinity; for (let i = 0; i <= 200; i++) { const t = a + ((b - a) * i) / 200, p = C.c(k, t), d = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (d < best) { best = d; u = t; } } }
    for (let it = 0; it < 12; it++) {
      const p = C.c(k, u), d1 = C.d1(k, u), d2 = C.d2(k, u), rx = x - p[0], ry = y - p[1], f = d1[0] * rx + d1[1] * ry, fp = d2[0] * rx + d2[1] * ry - (d1[0] * d1[0] + d1[1] * d1[1]);
      let du = fp < -1e-12 ? -f / fp : f / (d1[0] * d1[0] + d1[1] * d1[1] + 1e-12);
      if (!C.closed) { const [a, b] = C.range(k); du = Math.max(a - u, Math.min(b - u, du)); }
      u += du; if (Math.abs(du) < 1e-13) break;
    }
    return u;
  };
  MB.curveFrame = function (k, u) { const C = CURVE[k.type] || CURVE.circle, p = C.c(k, u), d1 = C.d1(k, u), d2 = C.d2(k, u), L = Math.hypot(d1[0], d1[1]) || 1e-12, tx = d1[0] / L, ty = d1[1] / L; return { p, tx, ty, nx: -ty, ny: tx, kap: (d1[0] * d2[1] - d1[1] * d2[0]) / (L * L * L) }; };

  function Sim(model) { this.model = model; this.build(); }
  MB.Sim = Sim;
  const S = Sim.prototype;

  S.bodyIndex = function (id) {
    if (id == null) return -1;
    const i = this.bix.get(id);
    return i === undefined ? -2 : i;
  };

  S.build = function () {
    const M = this.model;
    const nb = (this.nb = M.bodies.length), n = (this.n = 3 * nb);
    this.bix = new Map(M.bodies.map((b, i) => [b.id, i]));
    this.q = new Float64Array(n); this.qd = new Float64Array(n);
    M.bodies.forEach((b, i) => {
      this.q[3 * i] = b.x; this.q[3 * i + 1] = b.y; this.q[3 * i + 2] = b.th * D2R;
      this.qd[3 * i] = b.vx; this.qd[3 * i + 1] = b.vy; this.qd[3 * i + 2] = b.om;
    });
    this.t = 0; this.warnings = []; this.freezeTime = false; this.grab = null;
    this.mass = new Float64Array(n); this.inv = new Float64Array(n);
    this.updateMass();

    this.cons = []; this.ropes = []; this.byEl = new Map();
    let row = 0;
    const add = (c) => { c.row = row; row += c.rows; this.cons.push(c); this.byEl.set(c.el.id, c); return c; };
    const P4 = () => new Float64Array(4), V2 = () => new Float64Array(2);

    for (const el of M.joints) {
      const ia = this.bodyIndex(el.a.body), ib = this.bodyIndex(el.b.body);
      if (ia === -2 || ib === -2) { this.warnings.push(`Joint ${el.name || el.type} refers to a missing body`); continue; }
      if (ia === ib) { this.warnings.push(`Joint ${el.name || el.type} connects a part to itself`); continue; }
      const c = { kind: 'joint', type: el.type, el, ia, ib, A: P4(), B: P4(), vA: V2(), vB: V2() };
      const drv = el.drive === 'speed' ? 1 : 0;
      switch (el.type) {
        case 'pin': c.rows = 2 + drv; break;
        case 'fixed': c.rows = 3; break;
        case 'roller': c.rows = 1 + drv; break;
        case 'slider': c.rows = 2 + drv; break;
        case 'rod': c.rows = 1; break;
        case 'path': c.rows = 1; c.curve = Object.assign(MB.curveDefaults(), el.curve || {}); break;
        case 'gear': if (ia < 0 || ib < 0) { this.warnings.push('Gears need two parts'); continue; } c.rows = 1; break;
        case 'rolling':
          if (ia !== -1 || ib < 0 || M.bodies[ib].shape !== 'disk') { this.warnings.push('Rolling contact needs a disk on ground'); continue; }
          c.rows = 2; break;
        default: continue;
      }
      add(c);
    }
    for (const el of M.stops) {
      const ia = this.bodyIndex(el.a.body), ib = this.bodyIndex(el.b.body);
      if (ia === -2 || ib === -2 || ia === ib) { this.warnings.push(`Stop ${el.name} is not attached correctly`); continue; }
      add({ kind: 'stop', el, ia, ib, rows: 1, A: P4(), B: P4() });
    }
    for (const el of M.ropes) {
      const nodes = []; let ok = el.nodes.length >= 2;
      for (const nd of el.nodes) {
        const i = this.bodyIndex(nd.body);
        if (i === -2) ok = false;
        nodes.push({ i, p: nd.p, r: max(0, +nd.r || 0), s: nd.dir >= 0 ? 1 : -1, stick: !!nd.stick, wound: max(0, +nd.wound || 0), eb: nd.bounce == null ? 0.85 : max(0, min(1, +nd.bounce)) });
      }
      if (!ok) { this.warnings.push(`Rope ${el.name} has a missing attachment`); continue; }
      const N = nodes.length;
      nodes[0].stick = nodes[0].r > 0; nodes[N - 1].stick = nodes[N - 1].r > 0;
      const bnd = [];
      for (let j = 0; j < N; j++) if (j === 0 || j === N - 1 || (nodes[j].stick && nodes[j].r > 0)) bnd.push(j);
      const subs = [];
      for (let s = 0; s < bnd.length - 1; s++) subs.push({ a: bnd[s], b: bnd[s + 1], c0: 0 });
      const F = () => new Float64Array(N);
      const R = {
        kind: 'rope', el, nodes, subs, rows: subs.length, tmp: P4(),
        g: { cx: F(), cy: F(), sx: F(), sy: F(), vx: F(), vy: F(), w: F(), th: F(), ux: F(), uy: F(), l: F(), phi: F(), psiA: F(), psiD: F() },
        mem: { phi: F(), psiA: F(), psiD: F() }, degenerate: false,
      };
      add(R); this.ropes.push(R);
    }
    /* surfaces: one contact object per (surface, other part); disks touch with their rim, blocks with their corners */
    this.surfs = [];
    for (const el of M.surfaces || []) {
      const io = this.bodyIndex(el.body);
      if (io === -2) { this.warnings.push(`Surface ${el.name} is attached to a missing part`); continue; }
      const pts = MB.surfacePoints(el), N = pts.length;
      if (N < 2) continue;
      const P = new Float64Array(2 * N);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      pts.forEach((p, k) => { P[2 * k] = p[0]; P[2 * k + 1] = p[1]; x0 = min(x0, p[0]); x1 = max(x1, p[0]); y0 = min(y0, p[1]); y1 = max(y1, p[1]); });
      const sf = { el, io, P, N, box: [x0, y0, x1, y1] };
      this.surfs.push(sf);
      M.bodies.forEach((b, ib) => {
        if (ib === io) return;
        const disk = b.shape === 'disk', hw = b.w / 2, hh = b.h / 2;
        const feats = disk ? [[0, 0]] : [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]], nf = feats.length;
        const c = { kind: 'contact', el, sf, ia: io, ib, disk, R: disk ? b.r : 0, feats, rows: 2 * nf, cache: new Int32Array(nf).fill(-1), side: new Int8Array(nf),
          px: new Float64Array(nf), py: new Float64Array(nf), nx: new Float64Array(nf), ny: new Float64Array(nf), reach: disk ? b.r : Math.hypot(hw, hh) };
        c.row = row; row += c.rows; this.cons.push(c);
      });
    }
    const m = (this.m = row);
    this.J = new Float64Array(m * n); this.C = new Float64Array(m); this.gam = new Float64Array(m); this.ct = new Float64Array(m);
    this.lam = new Float64Array(m); this.lamN = new Float64Array(m); this.act = new Uint8Array(m);
    this.uni = new Uint8Array(m); this.rest = new Float64Array(m); this.tgt = new Float64Array(m);
    this.A = new Float64Array(max(1, m * m)); this.b = new Float64Array(max(1, m)); this.x = new Float64Array(max(1, m));
    this.rl = new Int32Array(max(1, m)); this.used = new Uint8Array(max(1, m)); this.pr = new Int32Array(max(1, m));
    this.fric = new Uint8Array(m); this.cn = new Uint8Array(m); this.mu = new Float64Array(m); this.slip = new Int8Array(m);
    this.G = new Float64Array(m * n);
    for (const c of this.cons) {
      if (c.kind === 'contact') for (let f = 0; f < c.feats.length; f++) { const r = c.row + 2 * f; this.uni[r] = 1; this.cn[r] = 1; this.uni[r + 1] = 1; this.fric[r + 1] = 1; }
      if (c.kind === 'stop') { this.uni[c.row] = 1; this.rest[c.row] = c.el.e; }
      if (c.kind === 'rope' && c.el.slack) for (let k = 0; k < c.rows; k++) this.uni[c.row + k] = 1;
    }
    this.Q = new Float64Array(n); this.Qnc = new Float64Array(n); this.WQ = new Float64Array(n); this.acc = new Float64Array(n);
    ['k1', 'k2', 'k3', 'k4', 'k2q', 'k3q', 'k4q', 'qs', 'vs', 'tq'].forEach((k) => (this[k] = new Float64Array(n)));

    this.fl = [];
    for (const el of M.forces) {
      const ia = el.a ? this.bodyIndex(el.a.body) : -1, ib = el.b ? this.bodyIndex(el.b.body) : -1;
      if (ia === -2 || ib === -2) { this.warnings.push(`Element ${el.name} refers to a missing body`); continue; }
      if ((el.type === 'load' || el.type === 'torque') && ib < 0) continue;
      this.fl.push({ el, ia, ib, A: P4(), B: P4(), vA: V2(), vB: V2() });
    }
    this.initConstants();
    this.projectPos(true);
    this.updateMem();
    this.chooseActive();
    this.projectVel(null);
    this.initNets();
    this.Wnc = 0; this.Wimp = 0; this.impacts = 0;
    this.E0 = this.kinetic() + this.potential(this.q);
    for (const R of this.ropes) { R.u0x = Float64Array.from(R.g.ux); R.u0y = Float64Array.from(R.g.uy); }
    this.initRopeEnds();
  };

  /* Drum ends with a finite rope (node.wound > 0): track the length still wound on; see ropeEnds() in solver.js */
  S.initRopeEnds = function () {
    for (const R of this.ropes) {
      const N = R.nodes.length;
      R.ends = [];
      [0, N - 1].forEach((j) => {
        const nd = R.nodes[j];
        if (nd.r > 0 && nd.wound > 0) R.ends.push({ j, wd: nd.wound, pay0: this.ropePay(R, j), slept: false });
      });
    }
  };
  /* rope paid out from end drum j so far (grows while the drum unwinds) */
  S.ropePay = function (R, j) {
    const nd = R.nodes[j];
    return j === 0 ? -nd.s * nd.r * R.g.psiD[0] : nd.s * nd.r * R.g.psiA[j];
  };

  S.updateMass = function () {
    this.model.bodies.forEach((b, i) => {
      const m = max(1e-9, +b.m || 0), J = max(1e-12, MB.inertia(b) || 0);
      this.mass[3 * i] = this.mass[3 * i + 1] = m; this.mass[3 * i + 2] = J;
      this.inv[3 * i] = this.inv[3 * i + 1] = 1 / m; this.inv[3 * i + 2] = 1 / J;
    });
  };

  /* Point on body i (local p) → [x, y, sx, sy] with s = R(θ)p, the world offset from the COM */
  S.pt = function (i, p, q, o) {
    if (i < 0) { o[0] = p[0]; o[1] = p[1]; o[2] = 0; o[3] = 0; return o; }
    const th = q[3 * i + 2], c = cos(th), s = sin(th), sx = c * p[0] - s * p[1], sy = s * p[0] + c * p[1];
    o[0] = q[3 * i] + sx; o[1] = q[3 * i + 1] + sy; o[2] = sx; o[3] = sy; return o;
  };
  S.ptv = function (i, P, qd, o) {
    if (i < 0 || !qd) { o[0] = 0; o[1] = 0; return o; }
    const w = qd[3 * i + 2]; o[0] = qd[3 * i] - w * P[3]; o[1] = qd[3 * i + 1] + w * P[2]; return o;
  };
  S.aJ = function (r, i, jx, jy, jt) {
    if (i < 0) return;
    const o = r * this.n + 3 * i; this.J[o] += jx; this.J[o + 1] += jy; this.J[o + 2] += jt;
  };
  const th = (q, i) => (i < 0 ? 0 : q[3 * i + 2]);
  const om = (qd, i) => (i < 0 || !qd ? 0 : qd[3 * i + 2]);
  const tha0 = th;

  S.initConstants = function () {
    const q = this.q;
    for (const c of this.cons) {
      if (c.kind === 'joint') {
        const el = c.el;
        c.rel0 = th(q, c.ib) - th(q, c.ia);
        const A = this.pt(c.ia, el.a.p, q, c.A), B = this.pt(c.ib, el.b.p, q, c.B);
        if (c.type === 'rod') c.L0 = Math.hypot(B[0] - A[0], B[1] - A[1]);
        if (c.type === 'path') { const phi = el.angle * D2R + tha0(q, c.ia), dx = B[0] - A[0], dy = B[1] - A[1], lx = cos(phi) * dx + sin(phi) * dy, ly = -sin(phi) * dx + cos(phi) * dy; c.u = MB.curveClosest(c.curve, lx, ly, null); }
        if (c.type === 'gear') { c.tha0 = th(q, c.ia); c.thb0 = th(q, c.ib); c.sg = el.mesh === 'int' ? -1 : 1; }
        if (c.type === 'roller' || c.type === 'slider') {
          const al = el.angle * D2R + th(q, c.ia);
          c.s0 = cos(al) * (B[0] - A[0]) + sin(al) * (B[1] - A[1]);
        }
        if (c.type === 'rolling') {
          const b = this.model.bodies[c.ib], al = el.angle * D2R;
          let ux = cos(al), uy = sin(al), nx = -uy, ny = ux;
          const dx = q[3 * c.ib] - el.a.p[0], dy = q[3 * c.ib + 1] - el.a.p[1];
          if (nx * dx + ny * dy < 0) { ux = -ux; uy = -uy; nx = -nx; ny = -ny; }
          Object.assign(c, { ux, uy, nx, ny, R: b.r, P0: el.a.p, th0: q[3 * c.ib + 2], s0: ux * dx + uy * dy });
        }
      } else if (c.kind === 'stop') {
        const al = c.el.angle * D2R; c.nx = cos(al); c.ny = sin(al);
      } else if (c.kind === 'rope') {
        const R = c, mem = R.mem; mem.phi.fill(0); mem.psiA.fill(0); mem.psiD.fill(0);
        this.ropeGeo(R, q, null);
        for (let j = 0; j < R.nodes.length; j++) {
          mem.phi[j] = R.g.phi[j] < 0 ? R.g.phi[j] + TAU : R.g.phi[j];
          mem.psiA[j] = R.g.psiA[j]; mem.psiD[j] = R.g.psiD[j];
        }
        this.ropeGeo(R, q, null);
        R.subs.forEach((sub, si) => {
          sub.c0 = 0;
          const C = this.ropeC(R, si);
          sub.c0 = -C + (si === 0 ? max(0, +c.el.slack0 || 0) : 0);
        });
      }
    }
  };

  /* ---------- rope geometry: tangent lines between pulleys ---------- */
  S.ropeGeo = function (R, q, qd) {
    const N = R.nodes.length, g = R.g, mem = R.mem;
    R.degenerate = false;
    for (let j = 0; j < N; j++) {
      const nd = R.nodes[j], P = this.pt(nd.i, nd.p, q, R.tmp);
      g.cx[j] = P[0]; g.cy[j] = P[1]; g.sx[j] = P[2]; g.sy[j] = P[3];
      if (nd.i >= 0) {
        const w = qd ? qd[3 * nd.i + 2] : 0;
        g.w[j] = w; g.th[j] = q[3 * nd.i + 2];
        g.vx[j] = qd ? qd[3 * nd.i] - w * P[3] : 0; g.vy[j] = qd ? qd[3 * nd.i + 1] + w * P[2] : 0;
      } else { g.w[j] = 0; g.th[j] = 0; g.vx[j] = 0; g.vy[j] = 0; }
    }
    for (let k = 0; k < N - 1; k++) {
      const a = R.nodes[k], b = R.nodes[k + 1];
      const Dx = g.cx[k + 1] - g.cx[k], Dy = g.cy[k + 1] - g.cy[k], D2 = Dx * Dx + Dy * Dy;
      const rho = b.r * b.s - a.r * a.s;
      let l2 = D2 - rho * rho;
      if (l2 < 1e-14) { l2 = 1e-14; R.degenerate = true; }
      const l = sqrt(l2);
      if (D2 < 1e-20) { g.ux[k] = 1; g.uy[k] = 0; } else { g.ux[k] = (l * Dx + rho * Dy) / D2; g.uy[k] = (l * Dy - rho * Dx) / D2; }
      g.l[k] = l;
    }
    for (let j = 0; j < N; j++) {
      const nd = R.nodes[j];
      if (nd.r <= 0) continue;
      if (j > 0) g.psiA[j] = unwrap(atan2(-nd.s * g.ux[j - 1], nd.s * g.uy[j - 1]) - g.th[j], mem.psiA[j]);
      if (j < N - 1) g.psiD[j] = unwrap(atan2(-nd.s * g.ux[j], nd.s * g.uy[j]) - g.th[j], mem.psiD[j]);
      if (j > 0 && j < N - 1) {
        const ax = g.ux[j - 1], ay = g.uy[j - 1], bx = g.ux[j], by = g.uy[j];
        g.phi[j] = unwrap(nd.s * atan2(ax * by - ay * bx, ax * bx + ay * by), mem.phi[j]);
      }
    }
  };

  /* Sub-rope constraint value: material available − geometric length (≥ 0, = slack) */
  S.ropeC = function (R, si) {
    const g = R.g, sub = R.subs[si], a = sub.a, b = sub.b, na = R.nodes[a], nb = R.nodes[b];
    let L = 0;
    for (let k = a; k < b; k++) L += g.l[k];
    for (let j = a + 1; j < b; j++) L += R.nodes[j].r * g.phi[j];
    let C = sub.c0 - L;
    if (nb.r > 0) C += nb.s * nb.r * g.psiA[b];
    if (na.r > 0) C -= na.s * na.r * g.psiD[a];
    return C;
  };

  S.updateMem = function () {
    for (const R of this.ropes) {
      this.ropeGeo(R, this.q, null);
      R.mem.phi.set(R.g.phi); R.mem.psiA.set(R.g.psiA); R.mem.psiD.set(R.g.psiD);
    }
  };

  /* ---------- constraint evaluation: C, J, γ (= −J̇q̇ − C_tt), ∂C/∂t ---------- */
  S.evalCons = function (q, qd, t) {
    this.J.fill(0);
    for (const c of this.cons) {
      if (c.kind === 'joint') this.evJoint(c, q, qd, t);
      else if (c.kind === 'stop') this.evStop(c, q, qd);
      else if (c.kind === 'contact') this.evContact(c, q, qd);
      else this.evRope(c, q, qd);
    }
  };

  S.evJoint = function (c, q, qd, t) {
    const { ia, ib, row: r, el } = c;
    const A = this.pt(ia, el.a.p, q, c.A), B = this.pt(ib, el.b.p, q, c.B);
    const wa = om(qd, ia), wb = om(qd, ib), tha = th(q, ia), thb = th(q, ib);
    const C = this.C, g = this.gam, ct = this.ct;
    switch (c.type) {
      case 'pin': case 'fixed': {
        C[r] = B[0] - A[0]; C[r + 1] = B[1] - A[1]; ct[r] = 0; ct[r + 1] = 0;
        this.aJ(r, ib, 1, 0, -B[3]); this.aJ(r + 1, ib, 0, 1, B[2]);
        this.aJ(r, ia, -1, 0, A[3]); this.aJ(r + 1, ia, 0, -1, -A[2]);
        g[r] = wb * wb * B[2] - wa * wa * A[2]; g[r + 1] = wb * wb * B[3] - wa * wa * A[3];
        if (c.type === 'fixed' || el.drive === 'speed') {
          const rr = r + 2, W = c.type === 'fixed' ? 0 : +el.dv || 0, tt = this.freezeTime ? 0 : t;
          C[rr] = thb - tha - c.rel0 - W * tt; ct[rr] = this.freezeTime ? 0 : -W; g[rr] = 0;
          this.aJ(rr, ib, 0, 0, 1); this.aJ(rr, ia, 0, 0, -1);
        }
        break;
      }
      case 'roller': case 'slider': {
        const al = el.angle * D2R + tha, ux = cos(al), uy = sin(al), nx = -uy, ny = ux;
        const dx = B[0] - A[0], dy = B[1] - A[1];
        const vA = this.ptv(ia, A, qd, c.vA), vB = this.ptv(ib, B, qd, c.vB);
        const ddx = vB[0] - vA[0], ddy = vB[1] - vA[1];
        const nd = nx * dx + ny * dy, ud = ux * dx + uy * dy;
        C[r] = nd; ct[r] = 0;
        this.aJ(r, ib, nx, ny, B[2] * ny - B[3] * nx);
        this.aJ(r, ia, -nx, -ny, -ud - (A[2] * ny - A[3] * nx));
        g[r] = wa * wa * nd + 2 * wa * (ux * ddx + uy * ddy) + wb * wb * (nx * B[2] + ny * B[3]) - wa * wa * (nx * A[2] + ny * A[3]);
        let rr = r + 1;
        if (c.type === 'slider') {
          C[rr] = thb - tha - c.rel0; ct[rr] = 0; g[rr] = 0;
          this.aJ(rr, ib, 0, 0, 1); this.aJ(rr, ia, 0, 0, -1); rr++;
        }
        if (el.drive === 'speed') {
          const V = +el.dv || 0, tt = this.freezeTime ? 0 : t;
          C[rr] = ud - c.s0 - V * tt; ct[rr] = this.freezeTime ? 0 : -V;
          this.aJ(rr, ib, ux, uy, B[2] * uy - B[3] * ux);
          this.aJ(rr, ia, -ux, -uy, nd - (A[2] * uy - A[3] * ux));
          g[rr] = wa * wa * ud - 2 * wa * (nx * ddx + ny * ddy) + wb * wb * (ux * B[2] + uy * B[3]) - wa * wa * (ux * A[2] + uy * A[3]);
        }
        break;
      }
      case 'rolling': {
        const dx = q[3 * ib] - c.P0[0], dy = q[3 * ib + 1] - c.P0[1];
        C[r] = c.nx * dx + c.ny * dy - c.R; C[r + 1] = c.ux * dx + c.uy * dy + c.R * (thb - c.th0) - c.s0;
        this.aJ(r, ib, c.nx, c.ny, 0); this.aJ(r + 1, ib, c.ux, c.uy, c.R);
        g[r] = g[r + 1] = 0; ct[r] = ct[r + 1] = 0;
        break;
      }
      case 'path': { // C = n·(P − c(u*)): the point stays on the curve carried by A (or the ground)
        const k = c.curve, phi = el.angle * D2R + tha, cp = cos(phi), sp = sin(phi), dx = B[0] - A[0], dy = B[1] - A[1];
        const lx = cp * dx + sp * dy, ly = -sp * dx + cp * dy; c.u = MB.curveClosest(k, lx, ly, c.u);
        const fr = MB.curveFrame(k, c.u), tx = cp * fr.tx - sp * fr.ty, ty = sp * fr.tx + cp * fr.ty, nx = -ty, ny = tx;
        C[r] = fr.nx * (lx - fr.p[0]) + fr.ny * (ly - fr.p[1]); ct[r] = 0; c.n = [nx, ny]; c.t = [tx, ty]; c.kap = fr.kap; c.P = [B[0], B[1]];
        const XA = ia >= 0 ? [q[3 * ia], q[3 * ia + 1]] : [0, 0], ddx = B[0] - XA[0], ddy = B[1] - XA[1]; // d = P − X_A
        this.aJ(r, ib, nx, ny, B[2] * ny - B[3] * nx); this.aJ(r, ia, -nx, -ny, -(ddx * ny - ddy * nx));
        const vB = this.ptv(ib, B, qd, c.vB), vAx = ia >= 0 && qd ? qd[3 * ia] : 0, vAy = ia >= 0 && qd ? qd[3 * ia + 1] : 0, wx = vB[0] - vAx + wa * ddy, wy = vB[1] - vAy - wa * ddx, tw = tx * wx + ty * wy;
        g[r] = wb * wb * (nx * B[2] + ny * B[3]) + 2 * wa * tw + fr.kap * tw * tw - wa * wa * (nx * ddx + ny * ddy); c.vt = tw;
        break;
      }
      case 'gear': { // r_A (θ_A − θ_A0) ± r_B (θ_B − θ_B0) = 0
        const ra = +el.ra || 0.1, rb = +el.rb || 0.1;
        C[r] = ra * (tha - c.tha0) + c.sg * rb * (thb - c.thb0); ct[r] = 0; g[r] = 0;
        this.aJ(r, ia, 0, 0, ra); this.aJ(r, ib, 0, 0, c.sg * rb);
        break;
      }
      case 'rod': {
        const dx = B[0] - A[0], dy = B[1] - A[1], L = sqrt(dx * dx + dy * dy) || 1e-12, ex = dx / L, ey = dy / L;
        const vA = this.ptv(ia, A, qd, c.vA), vB = this.ptv(ib, B, qd, c.vB);
        const ddx = vB[0] - vA[0], ddy = vB[1] - vA[1], ed = ex * ddx + ey * ddy;
        C[r] = L - c.L0; ct[r] = 0;
        this.aJ(r, ib, ex, ey, B[2] * ey - B[3] * ex); this.aJ(r, ia, -ex, -ey, -(A[2] * ey - A[3] * ex));
        g[r] = -(ex * (-wb * wb * B[2] + wa * wa * A[2]) + ey * (-wb * wb * B[3] + wa * wa * A[3]) + (ddx * ddx + ddy * ddy - ed * ed) / L);
        break;
      }
    }
  };

  /* local stop: the normal turns with A (an end cap on a spinning rod), n = n(θ_A) */
  S.evStop = function (c, q, qd) {
    const { ia, ib, row: r, el } = c;
    const loc = el.local && ia >= 0, al = el.angle * D2R + (loc ? q[3 * ia + 2] : 0), nx = loc ? cos(al) : c.nx, ny = loc ? sin(al) : c.ny;
    const A = this.pt(ia, el.a.p, q, c.A), B = this.pt(ib, el.b.p, q, c.B);
    const wa = om(qd, ia), wb = om(qd, ib), dx = B[0] - A[0], dy = B[1] - A[1];
    this.C[r] = nx * dx + ny * dy - (+el.gap || 0); this.ct[r] = 0;
    const turn = loc ? -ny * dx + nx * dy : 0;
    this.aJ(r, ib, nx, ny, B[2] * ny - B[3] * nx); this.aJ(r, ia, -nx, -ny, -(A[2] * ny - A[3] * nx) + turn);
    let gam = wb * wb * (nx * B[2] + ny * B[3]) - wa * wa * (nx * A[2] + ny * A[3]);
    if (loc && qd) {
      const vB = this.ptv(ib, B, qd, c.vB || (c.vB = new Float64Array(2))), vA = this.ptv(ia, A, qd, c.vA || (c.vA = new Float64Array(2)));
      gam += wa * wa * (nx * dx + ny * dy) - 2 * wa * (-ny * (vB[0] - vA[0]) + nx * (vB[1] - vA[1]));
    }
    this.gam[r] = gam;
  };

  /* Ċ_i = Σ_j (û_out − û_in)·V_j + s_a r_a ω_a − s_b r_b ω_b ;  γ_i = Σ_k (ΔV_k·m̂_k)²/ℓ_k + Σ_j ω_j² f_j·s_j */
  S.evRope = function (R, q, qd) {
    this.ropeGeo(R, q, qd);
    const g = R.g;
    for (let si = 0; si < R.subs.length; si++) {
      const r = R.row + si, { a, b } = R.subs[si], na = R.nodes[a], nb = R.nodes[b];
      this.C[r] = this.ropeC(R, si); this.ct[r] = 0;
      let gam = 0;
      for (let j = a; j <= b; j++) {
        let fx = 0, fy = 0;
        if (j < b) { fx += g.ux[j]; fy += g.uy[j]; }
        if (j > a) { fx -= g.ux[j - 1]; fy -= g.uy[j - 1]; }
        const nd = R.nodes[j];
        if (nd.i >= 0) {
          this.aJ(r, nd.i, fx, fy, g.sx[j] * fy - g.sy[j] * fx);
          gam += g.w[j] * g.w[j] * (fx * g.sx[j] + fy * g.sy[j]);
        }
      }
      if (na.r > 0) this.aJ(r, na.i, 0, 0, na.s * na.r);
      if (nb.r > 0) this.aJ(r, nb.i, 0, 0, -nb.s * nb.r);
      for (let k = a; k < b; k++) {
        const dv = -(g.vx[k + 1] - g.vx[k]) * g.uy[k] + (g.vy[k + 1] - g.vy[k]) * g.ux[k];
        gam += (dv * dv) / max(g.l[k], 1e-3);
      }
      this.gam[r] = gam;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
