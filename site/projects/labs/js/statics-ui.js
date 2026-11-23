/* Dynamic Interactive Labs — Statics & frames ('statics'): a plane-frame editor with an icon toolbar.
   Draw nodes, beams and truss bars; set Festlager, Loslager, Einspannung, Parallelführung and spring supports (turnable,
   settable); moment, shear and normal-force hinges; point forces and couples anywhere on a member, uniform and trapezoidal line
   loads, temperature. Every change is solved at once by the direct stiffness method (statics-core.js): reactions, the internal
   forces M (red), Q (blue), N (green) drawn on the structure, the deflected shape D (purple), stresses and the determinacy check.
   The virtual-work scenes (statics-vw.js) show the unit-load method, the force method and influence lines with pole plans,
   every product integral written out; two derivations play the stiffness method and the principle of virtual work. */
(function (G) {
  'use strict';
  const MB = G.MB, F = MB.F, h = F.h, K = MB.LabKit, R = MB.R, S = G.StaticsCore, VW = G.StaticsVW, DV = MB.Derive, D = DV.D;
  const { sqrt, abs, min, max, PI, sin, cos, atan2, hypot, round, sign } = Math;
  const TAU = 2 * PI, phone = () => window.innerWidth < 820;
  const SU = (MB.Statics = {});
  const st = { L: null, models: {}, vw: {}, sel: null, tool: 'select', show: { R: true, dg: 'M', D: false, V: true }, values: true, snap: true, grid: 0.5, scale: 0, auto: true, fixSc: {}, labels: false, undo: [], redo: [], t: 0, newSec: 'ipe200', newMat: 's235', panes: {}, hover: null, pend: null, dyn: { on: false, hist: [] } };
  SU.st = st;
  const tk = (k) => R.tok[k] || '#888';
  const CV = { M: 'plot2', Q: 'plot1', N: 'plot3', w: 'plot5', D: 'plot5', R: 'plot6', V: 'plot4' }, col = (k) => tk(CV[k]);
  const KEYOF = { M: 'M', Q: 'V', N: 'N', w: 'w' }, UNIT = { M: 'kN·m', Q: 'kN', N: 'kN', w: 'mm' };
  /* the deflection as a diagram: the solver's w (m, positive towards the member's left normal) in mm */
  const dgM = (ms) => (st.show.dg === 'w' ? ms.map((d) => Object.assign({}, d, { w: Array.from(d.w || [], (q) => q * 1000) })) : ms);
  const SELC = 'rgba(255, 184, 0, 0.5)';
  const fitP = (cv) => { const c = K.fit2d(cv, 2); if (!c) return null; c.fillStyle = tk('paper'); c.fillRect(0, 0, cv._W, cv._H); c.lineCap = 'round'; c.lineJoin = 'round'; return c; };
  const fmt = (v, d = 2) => { if (v == null || !isFinite(v)) return '—'; const a = abs(v) < 0.5 * 10 ** -d ? 0 : v; return a.toFixed(d).replace('-', '−'); };
  const fmtE = (v) => { if (!isFinite(v)) return '—'; if (v === 0) return '0'; const e = Math.floor(Math.log10(abs(v))); if (e >= -2 && e < 5) return fmt(v, max(0, 3 - e)); const m = v / 10 ** e; return `${fmt(m, 3)}·10${String(e).replace('-', '⁻').replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d])}`; };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const mem = (a, b, o) => Object.assign({ a, b, mat: 's235', sec: 'ipe200', type: 'frame' }, o || {});
  const SUB = (n) => String(n).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[d]);
  const LET = (i) => String.fromCharCode(65 + (i % 26));
  const txt = (c, s, x, y, colr, al, size, base) => { c.save(); c.font = `${size || 11}px "B612 Mono", ui-monospace, monospace`; c.textAlign = al || 'center'; c.textBaseline = base || 'middle'; c.lineJoin = 'round'; c.lineWidth = 3.6; c.strokeStyle = tk('paper'); c.strokeText(s, x, y); c.fillStyle = colr || tk('ink'); c.fillText(s, x, y); c.restore(); };

  /* text with a subscript: base, sub, rest (e.g. A, V, " 25.00") */
  const txtS = (c, base, sub, rest, x, y, colr, al, size) => { size = size || 11; c.save(); const f1 = `${size}px "B612 Mono", ui-monospace, monospace`, f2 = `${round(size * 0.75)}px "B612 Mono", ui-monospace, monospace`; c.font = f1; const w1 = c.measureText(base).width, w3 = c.measureText(rest).width; c.font = f2; const w2 = c.measureText(sub).width + 1; const W = w1 + w2 + w3; let x0 = al === 'right' ? x - W : al === 'center' ? x - W / 2 : x; c.restore(); txt(c, base, x0, y, colr, 'left', size); c.save(); c.font = f2; c.textAlign = 'left'; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.lineWidth = 3; c.strokeStyle = tk('paper'); c.strokeText(sub, x0 + w1, y + size * 0.3); c.fillStyle = colr; c.fillText(sub, x0 + w1, y + size * 0.3); c.restore(); txt(c, rest, x0 + w1 + w2, y, colr, 'left', size); };

  /* ---------------- structures ---------------- */
  const EIof = (m) => S.props(m).EI;
  const MODELS = {
    beam: () => ({ nodes: [{ x: 0, y: 0 }, { x: 6, y: 0 }], members: [mem(0, 1)], supports: [{ n: 0, type: 'pin' }, { n: 1, type: 'roller' }], mloads: [{ m: 0, type: 'point', at: 0.5, Fy: -20 }, { m: 0, q1: -5 }] }),
    cantilever: () => ({ nodes: [{ x: 0, y: 0 }, { x: 3, y: 0 }], members: [mem(0, 1)], supports: [{ n: 0, type: 'fixed' }], mloads: [{ m: 0, q1: -8 }], nloads: [{ n: 1, Fy: -5 }] }),
    mbeam: () => ({ nodes: [{ x: 0, y: 0 }, { x: 6, y: 0 }], members: [mem(0, 1)], supports: [{ n: 0, type: 'pin' }, { n: 1, type: 'roller' }], mloads: [{ m: 0, type: 'moment', at: 1 / 3, M: 12 }] }),
    continuous: () => ({ nodes: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }], members: [mem(0, 1), mem(1, 2)], supports: [{ n: 0, type: 'pin' }, { n: 1, type: 'roller' }, { n: 2, type: 'roller' }], mloads: [{ m: 0, q1: -10 }, { m: 1, q1: -10 }] }),
    propped: () => ({ nodes: [{ x: 0, y: 0 }, { x: 6, y: 0 }], members: [mem(0, 1)], supports: [{ n: 0, type: 'fixed' }, { n: 1, type: 'roller' }], mloads: [{ m: 0, q1: -10 }] }),
    gerber: () => ({ nodes: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 6, y: 0 }], members: [mem(0, 1, { rb: true }), mem(1, 2)], supports: [{ n: 0, type: 'fixed' }, { n: 2, type: 'roller' }], mloads: [{ m: 0, q1: -10 }, { m: 1, q1: -10 }] }),
    gerberL: () => ({ nodes: [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 8, y: 0 }, { x: 12, y: 0 }], members: [mem(0, 1), mem(1, 2, { rb: true }), mem(2, 3)], supports: [{ n: 0, type: 'pin' }, { n: 1, type: 'roller' }, { n: 3, type: 'roller' }], mloads: [{ m: 0, q1: -10 }, { m: 1, q1: -10 }, { m: 2, q1: -10 }, { m: 2, type: 'point', at: 0.5, Fy: -20 }] }),
    frame: () => ({ nodes: [{ x: 0, y: 0 }, { x: 0, y: 4 }, { x: 3, y: 4 }, { x: 6, y: 4 }, { x: 6, y: 0 }], members: [mem(0, 1), mem(1, 2, { rb: true }), mem(2, 3), mem(3, 4)], supports: [{ n: 0, type: 'pin' }, { n: 4, type: 'pin' }], mloads: [{ m: 1, q1: -10 }, { m: 2, q1: -10 }] }),
    twohinged: () => ({ nodes: [{ x: 0, y: 0 }, { x: 0, y: 4 }, { x: 6, y: 4 }, { x: 6, y: 0 }], members: [mem(0, 1, { sec: 'heb200' }), mem(1, 2, { sec: 'ipe300' }), mem(2, 3, { sec: 'heb200' })], supports: [{ n: 0, type: 'pin' }, { n: 3, type: 'pin' }], mloads: [{ m: 1, q1: -10 }] }),
    portal: () => ({ nodes: [{ x: 0, y: 0 }, { x: 0, y: 4 }, { x: 6, y: 4 }, { x: 6, y: 0 }], members: [mem(0, 1, { sec: 'heb200' }), mem(1, 2, { sec: 'ipe300' }), mem(2, 3, { sec: 'heb200' })], supports: [{ n: 0, type: 'fixed' }, { n: 3, type: 'fixed' }], mloads: [{ m: 1, q1: -12 }], nloads: [{ n: 1, Fx: 15 }] }),
    truss: () => { const n = [], mm = [], s = 2; for (let i = 0; i <= 6; i++) n.push({ x: i * s, y: 0 }); for (let i = 1; i <= 5; i++) n.push({ x: i * s, y: 2 }); const t = (a, b) => mm.push(mem(a, b, { type: 'truss', sec: 'rhs100' }));
      for (let i = 0; i < 6; i++) t(i, i + 1); for (let i = 7; i < 11; i++) t(i, i + 1); t(0, 7); t(11, 6); for (let i = 1; i <= 5; i++) t(i, i + 6); t(7, 2); t(8, 3); t(10, 3); t(11, 4); /* Pratt: diagonals in tension under gravity */
      return { nodes: n, members: mm, supports: [{ n: 0, type: 'pin' }, { n: 6, type: 'roller' }], nloads: [1, 2, 3, 4, 5].map((i) => ({ n: i, Fy: -10 })) }; },
    crane: () => ({ nodes: [{ x: 0, y: 0 }, { x: 0, y: 2 }, { x: 3, y: 0 }], members: [mem(0, 2, { type: 'truss', sec: 'tube60' }), mem(1, 2, { type: 'truss', sec: 'rod20' })], supports: [{ n: 0, type: 'pin' }, { n: 1, type: 'pin' }], nloads: [{ n: 2, Fy: -20 }] }),
    truss2: () => ({ nodes: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 3 }, { x: 0, y: 3 }], members: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [1, 3]].map(([a, b]) => mem(a, b, { type: 'truss', sec: 'rhs100' })), supports: [{ n: 0, type: 'pin' }, { n: 1, type: 'roller' }], nloads: [{ n: 2, Fx: 10 }, { n: 3, Fy: -10 }] }),
    inclined: () => ({ nodes: [{ x: 0, y: 0 }, { x: 6, y: 0 }], members: [mem(0, 1)], supports: [{ n: 0, type: 'pin' }, { n: 1, type: 'roller', ang: 30 }], mloads: [{ m: 0, type: 'point', at: 0.5, Fy: -20 }] }),
    springs: () => ({ nodes: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 8, y: 0 }], members: [mem(0, 1), mem(1, 2)], supports: [{ n: 0, type: 'pin' }, { n: 1, type: 'spring', ky: 2000 }, { n: 2, type: 'roller' }], mloads: [{ m: 0, q1: -10 }, { m: 1, q1: -10 }] }),
    qhinge: () => ({ nodes: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 6, y: 0 }], members: [mem(0, 1, { vb: true }), mem(1, 2)], supports: [{ n: 0, type: 'fixed' }, { n: 2, type: 'fixed' }], mloads: [{ m: 0, q1: -10 }, { m: 1, q1: -10 }] }),
    fixedfixed: () => ({ nodes: [{ x: 0, y: 0 }, { x: 4, y: 0 }], members: [mem(0, 1)], supports: [{ n: 0, type: 'fixed' }, { n: 1, type: 'fixed' }], mloads: [{ m: 0, q1: -12 }] }),
    dampers: () => ({ nodes: [{ x: 0, y: 0 }, { x: 6, y: 0, mass: 2000 }], members: [mem(0, 1)], supports: [{ n: 0, type: 'pin' }, { n: 1, type: 'spring', ky: 200, cy: 5 }], nloads: [{ n: 1, Fy: -20 }] }),
    mechanism: () => ({ nodes: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 6, y: 0 }], members: [mem(0, 1, { rb: true }), mem(1, 2)], supports: [{ n: 0, type: 'pin' }, { n: 2, type: 'pin' }], nloads: [{ n: 1, Fy: -10 }] }),
    lframe: () => ({ nodes: [{ x: 0, y: 0 }, { x: 0, y: 3 }, { x: 2, y: 3 }], members: [mem(0, 1), mem(1, 2)], supports: [{ n: 0, type: 'fixed' }], mloads: [{ m: 1, q1: -6 }], nloads: [{ n: 2, Fy: -10 }] }),
    beamT: () => ({ nodes: [{ x: 0, y: 0 }, { x: 6, y: 0 }], members: [mem(0, 1)], supports: [{ n: 0, type: 'pin' }, { n: 1, type: 'roller', dy: -0.01 }], mloads: [{ m: 0, q1: -5 }, { m: 0, type: 'temp', dTM: 20 }] }),
    custom: () => ({ nodes: [{ x: 0, y: 0 }, { x: 4, y: 0 }], members: [mem(0, 1)], supports: [{ n: 0, type: 'pin' }, { n: 1, type: 'roller' }], mloads: [{ m: 0, q1: -10 }] }),
  };
  /* closed-form checks: [label, exact, computed] */
  const CHECK = {
    beam: (r, m) => { const L = 6, P = 20, q = 5, EI = EIof(m.members[0]), d = r.members[0]; return [['A_V = (P + qL)/2', (P + q * L) / 2, r.R[1]], ['M_max = PL/4 + qL²/8', (P * L) / 4 + (q * L * L) / 8, d.at(3)[2]], ['w_mid = PL³/48EI + 5qL⁴/384EI [mm]', ((P * L ** 3) / (48 * EI) + (5 * q * L ** 4) / (384 * EI)) * 1000, -S.wAt(d, 3) * 1000]]; },
    cantilever: (r, m) => { const L = 3, q = 8, P = 5, EI = EIof(m.members[0]), d = r.members[0]; return [['M_A = −qL²/2 − PL', -(q * L * L) / 2 - P * L, d.M[0]], ['w_B = qL⁴/8EI + PL³/3EI [mm]', ((q * L ** 4) / (8 * EI) + (P * L ** 3) / (3 * EI)) * 1000, -d.w[d.w.length - 1] * 1000]]; },
    mbeam: (r) => { const d = r.members[0]; return [['A_V = M/L', 2, r.R[1]], ['M left of the couple = A_V·a', 4, d.at(2 - 1e-6)[2]], ['M right of it = A_V·a − M', -8, d.at(2 + 1e-6)[2]]]; },
    continuous: (r) => [['M_B = −qL²/8', -31.25, r.members[0].M[r.members[0].M.length - 1]], ['A_V = 3qL/8', 18.75, r.R[1]], ['B_V = 10qL/8', 62.5, r.R[4]]],
    propped: (r) => { const d = r.members[0]; return [['B_V = 3qL/8', 22.5, r.R[4]], ['M_A = −qL²/8', -45, d.M[0]], ['M_field = 9qL²/128 at 5L/8', 25.3125, d.at(3.75)[2]]]; },
    gerber: (r) => [['C_V = q·2/2', 10, r.R[7]], ['A_V = q·4 + 10', 50, r.R[1]], ['M_A = q·4·2 + 10·4', 120, r.R[2]], ['M at the hinge', 0, r.members[0].M[r.members[0].M.length - 1]]],
    frame: (r) => [['A_V = qℓ/2', 30, r.R[1]], ['A_H = (A_V·3 − q·3·1.5)/4', 11.25, r.R[0]], ['corner M = −A_H·4', -45, r.members[0].M[r.members[0].M.length - 1]]],
    twohinged: (r, m) => { const Ib = S.props(m.members[1]).I, Ic = S.props(m.members[0]).I, k = (Ib * 4) / (Ic * 6), H = (10 * 36) / (4 * 4 * (3 + 2 * k)); return [['A_V = qℓ/2', 30, r.R[1]], ['A_H ≈ qℓ²/(4h(3 + 2k)), no axial strain', H, r.R[0]]]; },
    portal: (r) => [['ΣH: A_H + B_H = −15', -15, r.R[0] + r.R[9]], ['ΣV: A_V + B_V = q·6', 72, r.R[1] + r.R[10]]],
    truss: (r) => { const top = r.members.slice(6, 10).map((d) => d.N[0]), bot = r.members.slice(0, 6).map((d) => d.N[0]); return [['A_V = 5·10/2', 25, r.R[1]], ['top chord −M(6 m)/h', -45, min(...top)], ['bottom chord M(4 m)/h', 40, max(...bot)]]; },
    crane: (r) => [['tie P/sin α, tan α = 2/3', 20 / (2 / sqrt(13)), r.members[1].N[0]], ['strut −P/tan α', -30, r.members[0].N[0]]],
    inclined: (r) => [['B_V = P/2', 10, r.R[4]], ['B_H = −B_V tan 30°', -10 * Math.tan(PI / 6), r.R[3]], ['A_H = −B_H', 10 * Math.tan(PI / 6), r.R[0]]],
    springs: (r, m) => { const EI = EIof(m.members[0]), L = 8, q = 10, k = 2000, Rs = ((5 * q * L ** 4) / (384 * EI)) / (L ** 3 / (48 * EI) + 1 / k); return [['spring force (5qL⁴/384EI)/(L³/48EI + 1/k)', Rs, r.R[4]], ['spring shortening R/k [mm]', (Rs / k) * 1000, -r.u[4] * 1000]]; },
    dampers: (r, m) => { const mu = (S.props(m.members[0]).A * 7850) / 1000, meq = 2 + (mu * 6) / 3, d = st.dsys; return [['static spring force = 20 kN', 20, r.R[4]], ['spring shortening P/k [mm]', 100, -r.u[4] * 1000], ...(d && d.ok ? [['f₁ = √(k/m_eq)/2π [Hz], m_eq = m + μL/3', sqrt(200 / meq) / (2 * PI), d.f1], ['ζ₁ = c/(2√(k m_eq)) + 2 % (structure) [%]', (100 * 5) / (2 * sqrt(200 * meq)) + 2, 100 * d.zeta1]] : [])]; },
    qhinge: (r) => [['Q at the shear hinge', 0, r.members[0].V[r.members[0].V.length - 1]], ['M_A = −qa²/3 (a = 3 m)', -30, r.members[0].M[0]], ['M at the hinge = qa²/6', 15, r.members[0].M[r.members[0].M.length - 1]]],
  };
  /* scenes */
  const SCENES = [
    { id: 'custom', group: 'Editor', kind: 'edit', name: 'Free editor', blurb: 'An empty beam to build on.' },
    { id: 'beam', group: 'Beams', kind: 'edit', name: 'Simply supported beam', blurb: 'Point and line load: M_max = PL/4 + qL²/8.' },
    { id: 'cantilever', group: 'Beams', kind: 'edit', name: 'Cantilever', blurb: 'Clamped at one end.' },
    { id: 'mbeam', group: 'Beams', kind: 'edit', name: 'A couple on the span', blurb: 'The moment diagram jumps by the couple.' },
    { id: 'continuous', group: 'Beams', kind: 'edit', name: 'Continuous beam', blurb: 'Two spans, once indeterminate.' },
    { id: 'propped', group: 'Beams', kind: 'edit', name: 'Propped cantilever', blurb: 'B_V = 3qL/8.' },
    { id: 'gerber', group: 'Beams', kind: 'edit', name: 'Gerber beam', blurb: 'A hinge keeps it determinate.' },
    { id: 'frame', group: 'Frames', kind: 'edit', name: 'Three-hinged frame', blurb: 'Thrust from the ridge hinge.' },
    { id: 'twohinged', group: 'Frames', kind: 'edit', name: 'Two-hinged frame', blurb: 'Once indeterminate.' },
    { id: 'portal', group: 'Frames', kind: 'edit', name: 'Portal frame, fixed feet', blurb: 'Three times indeterminate.' },
    { id: 'truss', group: 'Trusses', kind: 'edit', name: 'Pratt truss', blurb: 'Axial forces only.' },
    { id: 'crane', group: 'Trusses', kind: 'edit', name: 'Wall crane', blurb: 'Tie and strut.' },
    { id: 'inclined', group: 'Supports and hinges', kind: 'edit', name: 'Inclined roller', blurb: 'A turned Loslager gives horizontal reactions.' },
    { id: 'springs', group: 'Supports and hinges', kind: 'edit', name: 'Spring support', blurb: 'The support yields: R = k·w.' },
    { id: 'qhinge', group: 'Supports and hinges', kind: 'edit', name: 'Shear hinge (Querkraftgelenk)', blurb: 'Q = 0 at the joint, M passes.' },
    { id: 'dampers', group: 'Supports and hinges', kind: 'edit', name: 'Spring and damper (dynamics)', blurb: 'A mass on a spring–damper support swings and settles.' },
    { id: 'mechanism', group: 'Supports and hinges', kind: 'edit', name: 'When counting lies', blurb: 'n = 0, yet a mechanism.' },
    { id: 'pvk', group: 'Virtual work', kind: 'pvk', name: 'Unit-load method', blurb: 'Displacements by virtual forces (PvK).' },
    { id: 'kgv', group: 'Virtual work', kind: 'kgv', name: 'Force method', blurb: 'Kraftgrößenverfahren: δ₁₀ + X₁δ₁₁ = 0.' },
    { id: 'pvv', group: 'Virtual work', kind: 'pvv', name: 'Virtual displacements and influence lines', blurb: 'PvV, pole plan, Müller-Breslau.' },
    { id: 'pvwd', group: 'Virtual work', kind: 'derive', name: 'Derivation: virtual work', blurb: 'From M″ + q = 0 to the unit-load method.' },
    { id: 'stiffness', group: 'Derivations', kind: 'derive', name: 'The direct stiffness method', blurb: 'A two-bar truss, step by step.' },
  ];
  const sceneOf = (id) => SCENES.find((s) => s.id === id) || SCENES[1];
  /* virtual-work scenes: the structures they offer and their default targets */
  const VWS = {
    pvk: { structs: [['lframe', 'L-frame'], ['cantilever', 'Cantilever'], ['beamT', 'Beam: q, ΔT, settlement'], ['crane', 'Two-bar truss']], def: 'lframe' },
    kgv: { structs: [['twohinged', 'Two-hinged frame'], ['continuous', 'Continuous beam'], ['propped', 'Propped cantilever'], ['fixedfixed', 'Fixed-fixed beam'], ['portal', 'Portal, n = 3'], ['truss2', 'Truss, redundant bar']], def: 'twohinged' },
    pvv: { structs: [['gerberL', 'Gerber beam'], ['frame', 'Three-hinged frame'], ['beam', 'Simple beam'], ['continuous', 'Continuous beam, n = 1']], def: 'gerberL' },
  };
  const DEF_T = {
    pvk: { lframe: { k: 'node', n: 2, dir: 'v' }, cantilever: { k: 'node', n: 1, dir: 'v' }, beamT: { k: 'member', m: 0, at: 0.5, dir: 'v' }, crane: { k: 'node', n: 2, dir: 'v' } },
    pvv: { gerberL: { k: 'M', m: 0, at: 0.5 }, frame: { k: 'sup', n: 0, d: 0 }, beam: { k: 'M', m: 0, at: 1 / 3 }, continuous: { k: 'M', m: 0, at: 1 } },
  };
  const model = () => st.models[st.L.sceneId];
  const kind = () => sceneOf(st.L.sceneId).kind;
  const vws = () => st.vw[st.L.sceneId] || (st.vw[st.L.sceneId] = {});
  const save = () => { if (st.L) st.L.save({ models: st.models, vw: st.vw, scene: st.L.sceneId, show: st.show, values: st.values, snap: st.snap, grid: st.grid, scale: st.scale, auto: st.auto, labels: st.labels, fixSc: st.fixSc }); };
  const push = () => { st.undo.push(JSON.stringify(model())); if (st.undo.length > 80) st.undo.shift(); st.redo = []; };
  function undo() { const u = st.undo.pop(); if (!u) return; st.redo.push(JSON.stringify(model())); st.models[st.L.sceneId] = JSON.parse(u); st.sel = null; commit(); }
  function redo() { const u = st.redo.pop(); if (!u) return; st.undo.push(JSON.stringify(model())); st.models[st.L.sceneId] = JSON.parse(u); st.sel = null; commit(); }

  /* ---------------- analysis ---------------- */
  /* nodes no member touches get a hidden clamp, so a node placed for later does not make the whole system a mechanism */
  function solvable(m) { const used = new Uint8Array(m.nodes.length); for (const mm of m.members) { used[mm.a] = 1; used[mm.b] = 1; } const orphans = []; used.forEach((u, i) => { if (!u) orphans.push(i); }); if (!orphans.length) return { m, orphans }; const c = clone(m); c.supports = (c.supports || []).filter((sp) => used[sp.n]); for (const n of orphans) c.supports.push({ n, type: 'fixed' }); c.nloads = (c.nloads || []).filter((l) => used[l.n]); return { m: c, orphans }; }
  function analyse() {
    const m = model(); st.res = null; st.det = null; st.mode = null; st.vwr = null; if (!m || !m.members.length) return;
    validate(m);
    try {
      const { m: mm, orphans } = solvable(m); st.det = S.determinacy(mm); if (orphans.length) { st.det.a -= 3 * orphans.length; st.det.e -= 3 * orphans.length; }
      st.res = S.solve(mm); if (!st.res.ok) st.mode = mechMode(mm);
      const k = kind(), w = vws();
      st.dsys = null; if (st.dyn.on && st.res.ok && k === 'edit') { st.dsys = S.dynamics(mm); st.dyn.hist = []; }
      if (k === 'pvk' && w.t) st.vwr = VW.unitLoad(mm, w.t);
      if (k === 'kgv' && st.res.ok) { const rels = w.rels || VW.autoReleases(mm) || []; w.cur = rels; st.vwr = rels.length ? VW.forceMethod(mm, rels) : { err: st.det.statDeg ? 'Pick releases.' : 'This structure is statically determinate: nothing to release.' }; }
      if (k === 'pvv' && w.t) { st.vwr = VW.influence(mm, w.t); if (st.vwr && !st.vwr.err && st.vwr.rigid) st.vwr.poles = VW.poles(mm, st.vwr.r, w.t); }
    } catch (e) { console.error(e); st.res = { ok: false, err: String(e) }; }
  }
  /* keep targets and selections pointing at things that exist */
  function validate(m) {
    const w = st.vw[st.L.sceneId]; if (w && w.t) { const t = w.t; const ok = t.k === 'node' ? t.n < m.nodes.length : t.k === 'sup' ? (m.supports || []).some((sp) => sp.n === t.n && S.supFix(sp)[t.d]) : t.m < m.members.length; if (!ok) w.t = null; }
    if (w && w.rels && w.rels.some((r) => (r.k === 'sup' ? !(m.supports || []).some((sp) => sp.n === r.n) : r.m >= m.members.length))) w.rels = null;
    const s = st.sel; if (s && ((s.k === 'n' && s.i >= m.nodes.length) || (s.k === 'm' && s.i >= m.members.length) || (s.k === 'nl' && !(m.nloads || [])[s.i]) || (s.k === 'ml' && !(m.mloads || [])[s.i]))) st.sel = null;
  }
  /* the mechanism's motion: null vector of the singular stiffness matrix (inverse iteration on a lightly sprung copy) */
  function mechMode(m) {
    try {
      const sp = VW.unloaded(m), nN = sp.nodes.length, nD = 3 * nN, eps = 1e-3; sp.supports = (sp.supports || []).slice(); for (let n = 0; n < nN; n++) sp.supports.push({ n, type: 'none', kx: eps, ky: eps, kr: eps });
      let x = new Float64Array(nD).map(() => Math.random() - 0.5);
      for (let it = 0; it < 6; it++) { sp.nloads = []; for (let n = 0; n < nN; n++) sp.nloads.push({ n, Fx: x[3 * n], Fy: x[3 * n + 1], M: x[3 * n + 2] }); const r = S.solve(sp); if (!r.ok) return null; let nm = 0; for (let i = 0; i < nD; i++) if (i % 3 < 2) nm = max(nm, abs(r.u[i])); x = r.u.map((v) => v / (nm || 1)); }
      return x;
    } catch (e) { return null; }
  }

  /* ---------------- view ---------------- */
  const bounds = (m) => { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const n of m.nodes) { x0 = min(x0, n.x); x1 = max(x1, n.x); y0 = min(y0, n.y); y1 = max(y1, n.y); } if (!m.nodes.length) { x0 = -1; x1 = 5; y0 = -1; y1 = 3; } return [x0, x1, y0, y1]; };
  const lenScale = (m) => { const [x0, x1, y0, y1] = bounds(m); return max(1, x1 - x0, y1 - y0); };
  function fitView(P, W, H, m) {
    const v = P.view || (P.view = new R.View()), [x0, x1, y0, y1] = bounds(m), Ls = max(1, x1 - x0, y1 - y0), pad = 0.15 * Ls, ph = phone();
    const top = ph ? 118 : 124, bot = ph ? 126 : 150, left = ph ? 34 : 70, right = ph ? 62 : 100;
    v.W = W; v.H = H; v.s = min(260, (W - left - right) / (x1 - x0 + 2 * pad), (H - top - bot) / (y1 - y0 + 2 * pad));
    v.x = (x0 + x1) / 2 + (right - left) / 2 / v.s; v.y = (y0 + y1) / 2 + (top - bot) / 2 / v.s;
  }
  const scl = () => 2 ** st.scale;

  /* ---------------- drawing: supports and hinges ---------------- */
  /* screen rotation of a support symbol: the symbol's "up" is the restrained direction pointing from the ground to the node */
  function supAngle(m, sp) {
    if ((sp.type === 'fixed' || sp.type === 'spring') && sp.ang == null) { let dx = 0, dy = 0; for (const mm of m.members) { if (mm.a !== sp.n && mm.b !== sp.n) continue; const o = m.nodes[mm.a === sp.n ? mm.b : mm.a], n = m.nodes[sp.n], L = hypot(o.x - n.x, o.y - n.y) || 1; dx += (o.x - n.x) / L; dy += (o.y - n.y) / L; } if (sp.type === 'fixed' && hypot(dx, dy) > 1e-6) return atan2(dx, dy); return 0; }
    let a = -((sp.ang || 0) * PI) / 180; if (sp.type === 'rollerx' || sp.type === 'slidey') a += PI / 2; return a;
  }
  const zig = (c, x0, y0, x1, y1, n, amp) => { const L = hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L, nx = -uy, ny = ux, lead = L * 0.18; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + ux * lead, y0 + uy * lead); for (let i = 0; i < n; i++) { const t = lead + ((L - 2 * lead) * (i + 0.5)) / n, s = i % 2 ? -1 : 1; c.lineTo(x0 + ux * t + nx * amp * s, y0 + uy * t + ny * amp * s); } c.lineTo(x1 - ux * lead, y1 - uy * lead); c.lineTo(x1, y1); c.stroke(); };
  function drawSupport(c, X, Y, sp, phi, z, colr) {
    c.save(); c.translate(X, Y); c.rotate(phi); c.strokeStyle = colr || tk('ink'); c.fillStyle = tk('paper'); c.lineWidth = 1.6;
    const ground = (y, w, lw) => R.hatch(c, -w, y, w, y, 1, { len: 6.5, gap: 5.5, lw: lw || 1.8 });
    const tri = () => { c.beginPath(); c.moveTo(0, 0); c.lineTo(-z, 1.6 * z); c.lineTo(z, 1.6 * z); c.closePath(); c.fill(); c.stroke(); return 1.6 * z; };
    const t = sp.type;
    if (t === 'pin') { const yb = tri(); ground(yb, 1.55 * z); }
    else if (t === 'roller' || t === 'rollerx') { const yb = tri(); ground(yb + 5, 1.55 * z); }
    else if (t === 'fixed') ground(0, 1.65 * z, 2.6);
    else if (t === 'slidex' || t === 'slidey') { c.lineWidth = 2.6; R.line(c, 0, 0, 0, 0.75 * z); R.line(c, -1.25 * z, 0.75 * z, 1.25 * z, 0.75 * z); c.lineWidth = 1.4; const yr = 0.75 * z + 4.2; R.ring(c, -0.7 * z, yr, 3, tk('paper')); R.ring(c, 0.7 * z, yr, 3, tk('paper')); ground(yr + 4.2, 1.55 * z); }
    const fr = S.supFix(sp);
    if (t === 'spring' || t === 'none' || (!fr[1] && (sp.ky || sp.cy)) || (!fr[0] && (sp.kx || sp.cx))) {
      c.lineWidth = 1.6; const ky = !fr[1] && sp.ky, cy = !fr[1] && sp.cy, kx = !fr[0] && sp.kx, cx = !fr[0] && sp.cx;
      if (ky || cy) { const L2 = 2.6 * z; if (ky && cy) { R.line(c, 0, 0, 0, 5); R.line(c, -7, 5, 7, 5); zig(c, -7, 5, -7, L2, 5, 4); R.dashpot(c, 7, 5, 7, L2, { w: 5 }); ground(L2, 1.25 * z); } else if (ky) { zig(c, 0, 4, 0, L2, 6, 5); ground(L2, 1.1 * z); } else { R.dashpot(c, 0, 0, 0, L2, { w: 5 }); ground(L2, 1.1 * z); } }
      if (kx || cx) { const L2 = 2.6 * z; if (kx && cx) { R.line(c, 0, 0, -5, 0); R.line(c, -5, -7, -5, 7); zig(c, -5, -7, -L2, -7, 5, 4); R.dashpot(c, -5, 7, -L2, 7, { w: 5 }); } else if (kx) zig(c, -4, 0, -L2, 0, 6, 5); else R.dashpot(c, 0, 0, -L2, 0, { w: 5 }); R.hatch(c, -L2, 1.2 * z, -L2, -1.2 * z, 1, { len: 6, gap: 5.5, lw: 1.8 }); }
    }
    if (sp.kr && !S.supFix(sp)[2]) { c.lineWidth = 1.5; c.beginPath(); for (let i = 0; i <= 60; i++) { const a = -PI / 2 + (i / 60) * 1.75 * TAU, r = 5 + (i / 60) * 9; i ? c.lineTo(r * cos(a), r * sin(a)) : c.moveTo(r * cos(a), r * sin(a)); } c.stroke(); c.beginPath(); c.moveTo(14 * cos(-PI / 2 + 1.75 * TAU), 14 * sin(-PI / 2 + 1.75 * TAU)); c.lineTo(20, 7); c.stroke(); R.hatch(c, 20, 0, 20, 14, -1, { len: 5, gap: 5, lw: 1.6 }); }
    c.restore();
    if (t === 'pin' || t === 'roller' || t === 'rollerx') { c.save(); c.strokeStyle = colr || tk('ink'); c.lineWidth = 1.6; R.ring(c, X, Y, 3.6, tk('paper')); c.restore(); }
  }
  /* the screen depth a support symbol reaches below its node (for reaction arrows) */
  const supDepth = (sp, z) => (sp.type === 'fixed' ? 8 : sp.type === 'spring' ? 2.6 * z + 7 : sp.type === 'slidex' || sp.type === 'slidey' ? 0.75 * z + 16 : 1.6 * z + (sp.type === 'pin' ? 7 : 12));
  const endsAt = (m, n) => { const out = []; m.members.forEach((mm, i) => { if (mm.a === n) out.push([i, 'a']); if (mm.b === n) out.push([i, 'b']); }); return out; };
  const mRel = (mm, end) => mm.type === 'truss' || !!mm['r' + end];
  /* link-pair symbol of a shear (along: links along the axis) or normal-force hinge (links across the axis) */
  function linkPair(c, x, y, ux, uy, along) {
    const nx = -uy, ny = ux, g = 5, w = 6.5, P = (a, b) => [x + ux * a + nx * b, y + uy * a + ny * b];
    c.save(); c.lineWidth = 2.2; const pl = (a1, b1, a2, b2) => { const p = P(a1, b1), q = P(a2, b2); R.line(c, p[0], p[1], q[0], q[1]); };
    if (along) { pl(-g, -w, -g, w); pl(g, -w, g, w); c.lineWidth = 1.3; pl(-g, -w * 0.62, g, -w * 0.62); pl(-g, w * 0.62, g, w * 0.62); }
    else { pl(-g - 3, -w * 0.9, g, -w * 0.9); pl(-g, w * 0.9, g + 3, w * 0.9); c.lineWidth = 1.3; pl(-g * 0.45, -w * 0.9, -g * 0.45, w * 0.9); pl(g * 0.45, -w * 0.9, g * 0.45, w * 0.9); }
    c.restore();
  }

  /* ---------------- drawing: structure and loads ---------------- */
  function drawStructure(c, v, m, o) {
    const X = (x) => v.X(x), Y = (y) => v.Y(y), z = phone() ? 11 : 13, fade = o.fade || 1;
    c.save(); c.globalAlpha = fade;
    // selection halo
    const s = o.sel; c.strokeStyle = SELC; c.lineWidth = 13;
    if (s && s.k === 'm' && m.members[s.i]) { const mm = m.members[s.i], A = m.nodes[mm.a], B = m.nodes[mm.b]; R.line(c, X(A.x), Y(A.y), X(B.x), Y(B.y)); }
    if (s && s.k === 'n' && m.nodes[s.i]) { c.fillStyle = SELC; c.beginPath(); c.arc(X(m.nodes[s.i].x), Y(m.nodes[s.i].y), 11, 0, TAU); c.fill(); }
    // members, with the dashed bottom fibre (gestrichelte Faser) of beams
    m.members.forEach((mm, i) => {
      const A = m.nodes[mm.a], B = m.nodes[mm.b], g = S.geo(m, i), ax = X(A.x), ay = Y(A.y), bx = X(B.x), by = Y(B.y), truss = mm.type === 'truss';
      c.strokeStyle = o.colr ? o.colr(i) : tk('ink'); c.lineWidth = o.thin ? 1.6 : truss ? 2.6 : 4.2; R.line(c, ax, ay, bx, by);
      if (!truss && !o.thin && o.fibre !== false) { const Ls = hypot(bx - ax, by - ay), off = 5.2, nx = g.s * off, ny = g.c * off, tr = min(0.4, 8 / max(1, Ls)); c.save(); c.strokeStyle = tk('ink-3'); c.lineWidth = 1; c.setLineDash([4, 3]); R.line(c, ax + (bx - ax) * tr + nx, ay + (by - ay) * tr + ny, bx - (bx - ax) * tr + nx, by - (by - ay) * tr + ny); c.restore(); }
      if (o.labels) txt(c, `${i + 1}`, (ax + bx) / 2 - g.s * 13, (ay + by) / 2 - g.c * 13, tk('ink-3'), 'center', 10);
    });
    // releases
    m.nodes.forEach((n, ni) => {
      const ends = endsAt(m, ni); if (!ends.length) return; const frame = ends.filter(([i]) => m.members[i].type !== 'truss'), rel = ends.filter(([i, e]) => mRel(m.members[i], e)), sp = (m.supports || []).find((q) => q.n === ni), clamp = sp && (S.supFix(sp)[2] || sp.kr);
      const full = rel.length === ends.length && (ends.length > 1 || !clamp);
      c.strokeStyle = tk('ink'); c.lineWidth = 1.7;
      if (full && (frame.length || ends.length)) R.ring(c, X(n.x), Y(n.y), frame.length ? 4.6 : 3.8, tk('paper'));
      else for (const [i, e] of rel) { if (m.members[i].type === 'truss') continue; const mm = m.members[i], A = m.nodes[e === 'a' ? mm.a : mm.b], B = m.nodes[e === 'a' ? mm.b : mm.a], Lp = hypot(X(B.x) - X(A.x), Y(B.y) - Y(A.y)) || 1, f = 9 / Lp; R.ring(c, X(A.x) + (X(B.x) - X(A.x)) * f, Y(A.y) + (Y(B.y) - Y(A.y)) * f, 4.3, tk('paper')); }
      for (const [i, e] of ends) { const mm = m.members[i]; for (const [k, along] of [['v', true], ['n', false]]) { if (!mm[k + e]) continue; const A = m.nodes[e === 'a' ? mm.a : mm.b], B = m.nodes[e === 'a' ? mm.b : mm.a], Lp = hypot(X(B.x) - X(A.x), Y(B.y) - Y(A.y)) || 1, ux = (X(B.x) - X(A.x)) / Lp, uy = (Y(B.y) - Y(A.y)) / Lp; c.strokeStyle = tk('ink'); linkPair(c, X(A.x) + ux * 14, Y(A.y) + uy * 14, ux, uy, along); } }
      if (!frame.length || rel.length || full) return;
      c.fillStyle = tk('ink'); c.beginPath(); c.arc(X(n.x), Y(n.y), 2.8, 0, TAU); c.fill();
    });
    // supports
    (m.supports || []).forEach((sp, k) => { const n = m.nodes[sp.n]; if (!n) return; drawSupport(c, X(n.x), Y(n.y), sp, supAngle(m, sp), z, o.supCol ? o.supCol(sp) : null); if (o.letters) txt(c, LET(k), X(n.x) - 15, Y(n.y) - 14, tk('ink-2'), 'center', 11.5); });
    // point masses
    m.nodes.forEach((n) => { if (!n.mass) return; const r = 5 + 2.2 * Math.log10(1 + n.mass / 100); c.save(); c.fillStyle = tk('ink'); c.beginPath(); c.arc(X(n.x), Y(n.y), r, 0, TAU); c.fill(); c.restore(); txt(c, `${fmt(n.mass, 0)} kg`, X(n.x) - r - 4, Y(n.y) - r - 6, tk('ink-2'), 'right', 10); });
    // truss joints and node numbers
    m.nodes.forEach((n, i) => { const truss = endsAt(m, i).every(([j]) => m.members[j].type === 'truss'); if (truss && endsAt(m, i).length) { c.strokeStyle = tk('ink'); c.lineWidth = 1.5; R.ring(c, X(n.x), Y(n.y), 3.6, tk('paper')); } if (!endsAt(m, i).length) { c.strokeStyle = tk('ink-2'); c.lineWidth = 1.5; R.ring(c, X(n.x), Y(n.y), 4, tk('paper')); } if (o.labels) txt(c, `${i + 1}`, X(n.x) + 9, Y(n.y) - 11, tk('ink-2'), 'left', 10); });
    c.restore();
  }
  /* loads; registers hit regions in P.hits for selecting them */
  function drawLoads(c, v, m, o, hits) {
    const X = (x) => v.X(x), Y = (y) => v.Y(y), ink = o.colr || tk('ink'); c.save(); c.globalAlpha = o.fade || 1;
    let qm = 1e-9; for (const ld of m.mloads || []) if (!ld.type) qm = max(qm, abs(ld.q1 || 0), abs(ld.q2 == null ? ld.q1 || 0 : ld.q2)); const hq = 30 / qm;
    // height and screen direction of the line-load block on each member, so point forces stand on top of it
    const block = new Map(); for (const ld of m.mloads || []) { if (ld.type || !m.members[ld.m]) continue; const g = S.geo(m, ld.m), q = abs(ld.q1 || 0) >= abs(ld.q2 == null ? ld.q1 || 0 : ld.q2) ? ld.q1 || 0 : ld.q2, dir = ld.dir === 'local' ? [-g.s * sign(q || 1), -g.c * sign(q || 1)] : ld.dir === 'gx' ? [sign(q || 1), 0] : [0, -sign(q || 1)], hgt = max(abs(ld.q1 || 0), abs(ld.q2 == null ? ld.q1 || 0 : ld.q2)) * hq + 3, b = block.get(ld.m); if (!b || hgt > b.h) block.set(ld.m, { h: hgt, d: dir }); }
    const selOf = (k, i) => o.sel && o.sel.k === k && o.sel.i === i;
    const force = (px0, py0, Fx, Fy, k, i, lab, mi) => { const F2 = hypot(Fx, Fy); if (F2 < 1e-12) return; const ux = Fx / F2, uy = -Fy / F2, b = mi != null ? block.get(mi) : null, off = b && ux * b.d[0] + uy * b.d[1] > 0.5 ? b.h : 0, px = px0 - ux * off, py = py0 - uy * off, Lp = 44, tx = px - ux * Lp, ty = py - uy * Lp; if (selOf(k, i)) { c.save(); c.strokeStyle = SELC; c.lineWidth = 12; R.line(c, tx, ty, px - ux * 3, py - uy * 3); c.restore(); } c.strokeStyle = c.fillStyle = ink; c.lineWidth = 2.2; R.arrow(c, tx, ty, px - ux * 3, py - uy * 3, 10); txt(c, lab || `${fmt(F2, 1)} kN`, tx - ux * 4 + (abs(uy) > 0.7 ? 8 : 0), ty - uy * 9, ink, abs(uy) > 0.7 ? 'left' : ux > 0 ? 'right' : 'left', 11); if (hits) hits.push({ k, i, seg: [tx, ty, px, py] }); };
    const couple = (px, py, M, k, i) => { if (selOf(k, i)) { c.save(); c.strokeStyle = SELC; c.lineWidth = 10; c.beginPath(); c.arc(px, py, 17, 0, TAU); c.stroke(); c.restore(); } c.strokeStyle = c.fillStyle = ink; c.lineWidth = 2; R.moment(c, px, py, 17, M); txt(c, `${fmt(abs(M), 1)} kN·m`, px + 21, py - 21, ink, 'left', 11); if (hits) hits.push({ k, i, ring: [px, py, 17] }); };
    (m.mloads || []).forEach((ld, li) => {
      const mm = m.members[ld.m]; if (!mm) return; const g = S.geo(m, ld.m), A = m.nodes[mm.a], B = m.nodes[mm.b], at = ld.at == null ? 0.5 : ld.at, px = X(A.x + (B.x - A.x) * at), py = Y(A.y + (B.y - A.y) * at);
      if (ld.type === 'point') return force(px, py, ld.Fx || 0, ld.Fy || 0, 'ml', li, null, ld.m);
      if (ld.type === 'moment') return couple(px, py, ld.M || 0, 'ml', li);
      if (ld.type === 'disl') return;
      if (ld.type === 'temp') { const mx = (X(A.x) + X(B.x)) / 2, my = (Y(A.y) + Y(B.y)) / 2, nx = g.s, ny = g.c, lab = [ld.dT ? `ΔT ${fmt(ld.dT, 0)} K` : '', ld.dTM ? `ΔT_M ${fmt(ld.dTM, 0)} K` : ''].filter(Boolean).join(' · ') || 'ΔT 0'; if (selOf('ml', li)) { c.save(); c.strokeStyle = SELC; c.lineWidth = 12; R.line(c, X(A.x), Y(A.y), X(B.x), Y(B.y)); c.restore(); }
        c.save(); c.lineWidth = 2.4; if (ld.dTM) { c.strokeStyle = ld.dTM > 0 ? tk('plot2') : tk('plot1'); R.line(c, X(A.x) + nx * 9, Y(A.y) + ny * 9, X(B.x) + nx * 9, Y(B.y) + ny * 9); c.strokeStyle = ld.dTM > 0 ? tk('plot1') : tk('plot2'); R.line(c, X(A.x) - nx * 9, Y(A.y) - ny * 9, X(B.x) - nx * 9, Y(B.y) - ny * 9); } c.restore();
        txt(c, lab, mx + nx * 22, my + ny * 22, ink, 'center', 10.5); if (hits) hits.push({ k: 'ml', i: li, seg: [X(A.x) + nx * 18, Y(A.y) + ny * 18, X(B.x) + nx * 18, Y(B.y) + ny * 18] }); return; }
      const q1 = ld.q1 || 0, q2 = ld.q2 == null ? q1 : ld.q2, loc = ld.dir === 'local', gx = ld.dir === 'gx';
      const dirOf = (q) => (loc ? [-g.s * sign(q || 1), -g.c * sign(q || 1)] : gx ? [sign(q || 1), 0] : [0, -sign(q || 1)]); // screen direction of the load arrows
      const Lpx = hypot(X(B.x) - X(A.x), Y(B.y) - Y(A.y)), n = max(4, round(Lpx / 24)), tops = [], base = [];
      for (let k = 0; k <= n; k++) { const t = k / n, q = q1 + (q2 - q1) * t, d = dirOf(q), bx = X(A.x) + (X(B.x) - X(A.x)) * t, by = Y(A.y) + (Y(B.y) - Y(A.y)) * t, Lq = abs(q) * hq; tops.push([bx - d[0] * (Lq + 3), by - d[1] * (Lq + 3)]); base.push([bx - d[0] * 3, by - d[1] * 3]); }
      if (selOf('ml', li)) { c.save(); c.fillStyle = SELC; c.beginPath(); tops.forEach((p, k) => (k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); for (let k = base.length - 1; k >= 0; k--) c.lineTo(base[k][0], base[k][1]); c.closePath(); c.fill(); c.restore(); }
      c.save(); c.fillStyle = ink; c.globalAlpha = (o.fade || 1) * 0.07; c.beginPath(); tops.forEach((p, k) => (k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); for (let k = base.length - 1; k >= 0; k--) c.lineTo(base[k][0], base[k][1]); c.closePath(); c.fill(); c.restore();
      c.strokeStyle = c.fillStyle = ink; c.lineWidth = 1.3; for (let k = 0; k <= n; k++) if (hypot(tops[k][0] - base[k][0], tops[k][1] - base[k][1]) > 5) R.arrow(c, tops[k][0], tops[k][1], base[k][0], base[k][1], 6.5);
      c.lineWidth = 1.5; c.beginPath(); tops.forEach((p, k) => (k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke();
      const lab = `${fmt(abs(q1), 1)}${q2 !== q1 ? '…' + fmt(abs(q2), 1) : ''} kN/m${ld.dir === 'proj' ? ' (proj.)' : ''}`, tm = abs(q2) >= abs(q1) ? tops[n] : tops[0], tm0 = abs(q2) >= abs(q1) ? base[n] : base[0];
      const ox = tm[0] - tm0[0], oy = tm[1] - tm0[1], ol = hypot(ox, oy) || 1; txt(c, lab, (tops[round(n / 2)][0] + tm[0]) / 2 + (ox / ol) * 10, (tops[round(n / 2)][1] + tm[1]) / 2 + (oy / ol) * 10, ink, 'center', 10.5);
      if (hits) hits.push({ k: 'ml', i: li, poly: [...tops, ...base.slice().reverse()] });
    });
    (m.nloads || []).forEach((ld, li) => { const n = m.nodes[ld.n]; if (!n) return; force(X(n.x), Y(n.y), ld.Fx || 0, ld.Fy || 0, 'nl', li); if (ld.M) couple(X(n.x), Y(n.y), ld.M, 'nl', li); });
    c.restore();
  }
  /* reaction arrows in global components, labelled A_H, A_V, M_A */
  function drawReactions(c, v, m, Rv) {
    const X = (x) => v.X(x), Y = (y) => v.Y(y), z = phone() ? 11 : 13, cr = col('R'); c.save(); c.strokeStyle = c.fillStyle = cr; c.lineWidth = 2.2;
    (m.supports || []).forEach((sp, k) => {
      const n = m.nodes[sp.n]; if (!n) return; const i = 3 * sp.n, Rx = Rv[i], Ry = Rv[i + 1], Mz = Rv[i + 2], x = X(n.x), y = Y(n.y), L = LET(k), ph = supAngle(m, sp), dep = abs(cos(ph)) > 0.7 ? supDepth(sp, z) : 6, below = y + (cos(ph) > 0 ? dep : 4);
      if (abs(Ry) > 1e-6) { const s = sign(Ry), y0 = below + 6, y1 = y0 + 38; if (s > 0) R.arrow(c, x + 14, y1, x + 14, y0, 9); else R.arrow(c, x + 14, y0, x + 14, y1, 9); txtS(c, L, 'V', ` ${fmt(abs(Ry))}`, x + 20, y1 - 4, cr, 'left', 11); }
      if (abs(Rx) > 1e-6) { const s = sign(Rx), yy = below + 2, xa = x - 16 - 40, xb = x - 16; if (s > 0) R.arrow(c, xa, yy, xb, yy, 9); else R.arrow(c, xb, yy, xa, yy, 9); txtS(c, L, 'H', ` ${fmt(abs(Rx))}`, (xa + xb) / 2, yy + 14, cr, 'center', 11); }
      if (abs(Mz) > 1e-6 && (S.supFix(sp)[2] || sp.kr)) { R.moment(c, x, y, 25, Mz); txtS(c, 'M', L, ` ${fmt(abs(Mz))}`, x - 28, y - 30, cr, 'right', 11); }
    });
    c.restore();
  }
  /* an internal-force diagram on the members; returns the labels to draw on top */
  function diagScale(key, vmax, v) { const hpx = max(30, min(84, 0.085 * min(v.W, v.H))); const auto = hpx / vmax; if (st.auto || !st.fixSc[key]) { st.lastSc = st.lastSc || {}; st.lastSc[key] = auto; return auto * scl(); } return st.fixSc[key] * scl(); }
  function drawDiagram(c, v, m, dms, key, colr, o) {
    o = o || {}; const f = KEYOF[key] || key, labels = []; let vm = 0; for (const d of dms) for (const q of d[f]) vm = max(vm, abs(q)); if (vm < 1e-9) return labels;
    const sc = o.sc || diagScale(o.skey || key, vm, v), side = f === 'M' ? -1 : 1;
    dms.forEach((d, i) => {
      const mm = m.members[i]; if (!mm) return; const A = m.nodes[mm.a], g = S.geo(m, i), P = (x, val) => { const ly = side * val * sc; return [v.X(A.x + g.c * x) - g.s * ly, v.Y(A.y + g.s * x) - g.c * ly]; };
      const vals = d[f];
      if (mm.type === 'truss' && f === 'N') { // a bar: thickness by |N|, the value at mid-length (tension +)
        const B = m.nodes[mm.b], Nv = vals[0], ax = v.X(A.x), ay = v.Y(A.y), bx = v.X(B.x), by = v.Y(B.y); c.save(); c.strokeStyle = colr; c.globalAlpha = abs(Nv) < 1e-6 * vm ? 0.25 : 0.55; c.lineWidth = 3 + 9 * (abs(Nv) / vm); if (Nv < 0) c.setLineDash([9, 4]); R.line(c, ax, ay, bx, by); c.restore();
        if (st.values && !o.noLabels) labels.push([abs(Nv) < 1e-6 * vm ? '0' : (Nv > 0 ? '+' : '') + fmt(Nv * (o.mul || 1), 2), (ax + bx) / 2 + g.s * 13, (ay + by) / 2 + g.c * 13, colr]); return; }
      if (vals.every((q) => abs(q) < 1e-9 * vm)) return;
      c.save(); c.fillStyle = colr; c.globalAlpha = o.alpha == null ? 0.16 : o.alpha; c.beginPath(); let p = P(d.x[0], 0); c.moveTo(p[0], p[1]); d.x.forEach((x, k) => { const q = P(x, vals[k]); c.lineTo(q[0], q[1]); }); p = P(d.x[d.x.length - 1], 0); c.lineTo(p[0], p[1]); c.closePath(); c.fill(); c.restore();
      c.save(); c.strokeStyle = colr; c.lineWidth = o.lw || 1.8; if (o.dash) c.setLineDash(o.dash); c.beginPath(); d.x.forEach((x, k) => { const q = P(x, vals[k]); k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.stroke();
      // ordinate hatching every ~14 px, the way diagrams are drawn by hand
      if (!o.dash) { c.lineWidth = 0.8; c.globalAlpha = 0.55; const Lp = d.L * v.s, n = max(2, round(Lp / 14)); for (let k = 1; k < n; k++) { const x = (k / n) * d.L, val = S.interp(d, f, x), a = P(x, 0), b = P(x, val); if (abs(val) > 1e-9 * vm) R.line(c, a[0], a[1], b[0], b[1]); } }
      c.restore();
      if (!st.values || o.noLabels) return;
      const pick = new Set([0, d.x.length - 1]); for (let k = 1; k < d.x.length - 1; k++) { if (d.x[k + 1] - d.x[k] < 1e-6 * d.L || d.x[k] - d.x[k - 1] < 1e-6 * d.L) pick.add(k); }
      let ie = 0; vals.forEach((q, k) => { if (abs(q) > abs(vals[ie])) ie = k; }); if (d.x[ie] > 0.03 * d.L && d.x[ie] < 0.97 * d.L) pick.add(ie);
      if (f === 'M') { const V = d.V; for (let k = 1; k < V.length; k++) if (V[k - 1] * V[k] < 0 && d.x[k] - d.x[k - 1] > 1e-6 * d.L) pick.add(abs(vals[k]) > abs(vals[k - 1]) ? k : k - 1); }
      for (const k of pick) { const val = vals[k]; if (abs(val) < 1e-3 * vm) continue; const p = P(d.x[k], val), b = P(d.x[k], 0), dx = p[0] - b[0], dy = p[1] - b[1], dl = hypot(dx, dy) || 1; const lo = 10 + (o.lofs || 0); labels.push([fmt(val * (o.mul || 1), o.dec == null ? 2 : o.dec), p[0] + (dx / dl) * lo, p[1] + (dy / dl) * lo + (abs(dy) < 3 ? -8 - (o.lofs || 0) : 0), colr]); }
    });
    return labels;
  }
  const drawLabels = (c, labels) => { const seen = []; for (const [s, x, y, colr] of labels) { if (seen.some(([a, b, t]) => t === s && hypot(a - x, b - y) < 26)) continue; seen.push([x, y, s]); txt(c, s, x, y, colr, 'center', 10.5); } };
  /* deflected shape, magnified */
  function drawDeformed(c, v, m, dms, o) {
    o = o || {}; let um = 0, best = null; dms.forEach((d, i) => { for (let k = 0; k < d.w.length; k++) { const q = hypot(d.w[k], d.u[k]); if (q > um) { um = q; best = [i, k]; } } }); if (um < 1e-12) return;
    const base = (0.075 * lenScale(m)) / um; let mag; if (st.auto || !st.fixSc.D) { st.lastSc = st.lastSc || {}; st.lastSc.D = base; mag = base * scl(); } else mag = st.fixSc.D * scl(); st.defMag = mag;
    const colr = o.colr || col('D'); c.save(); c.strokeStyle = colr; c.lineWidth = o.lw || 2.2; if (o.dash) c.setLineDash(o.dash);
    const pt = (i, x, u, w) => { const mm = m.members[i], A = m.nodes[mm.a], g = S.geo(m, i), lx = x + u * mag, ly = w * mag; return [v.X(A.x + g.c * lx - g.s * ly), v.Y(A.y + g.s * lx + g.c * ly)]; };
    dms.forEach((d, i) => { if (!m.members[i]) return; c.beginPath(); d.x.forEach((x, k) => { const p = pt(i, x, d.u[k], d.w[k]); k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); }); c.stroke(); });
    c.restore();
    if (best && st.values && !o.noLabels) { const [i, k] = best, d = dms[i], p = pt(i, d.x[k], d.u[k], d.w[k]); c.save(); c.fillStyle = colr; c.beginPath(); c.arc(p[0], p[1], 3.2, 0, TAU); c.fill(); c.restore(); const lft = p[0] > v.W * 0.62; txt(c, `${fmt(um * 1000, 2)} mm`, p[0] + (lft ? -10 : 8), p[1] + 14, colr, lft ? 'right' : 'left', 10.5); }
  }

  /* ---------------- scene painters ---------------- */
  function paintEdit(c, P, m) {
    const v = P.view, res = st.res, ok = res && res.ok, hits = (P.hits = []);
    if (st.mode && !ok) { const x = st.mode, a = sin(st.t * 2.2) * 0.07 * lenScale(m); c.save(); c.strokeStyle = tk('warn'); c.lineWidth = 3; c.globalAlpha = 0.85; m.members.forEach((mm) => { const A = m.nodes[mm.a], B = m.nodes[mm.b]; R.line(c, v.X(A.x + x[3 * mm.a] * a), v.Y(A.y + x[3 * mm.a + 1] * a), v.X(B.x + x[3 * mm.b] * a), v.Y(B.y + x[3 * mm.b + 1] * a)); }); c.restore(); }
    let labels = [];
    if (ok && st.show.dg) labels = drawDiagram(c, v, m, dgM(res.members), st.show.dg, col(st.show.dg));
    const dy = st.dyn.on && st.dsys && st.dsys.ok ? st.dsys : null;
    if (dy) { const prevAuto = st.auto, mag0 = st.lastSc && st.lastSc.D; drawDeformed(c, v, m, res.members, { colr: col('D'), lw: 1.2, dash: [5, 4], noLabels: true }); st.auto = false; const keep = st.fixSc.D; st.fixSc.D = (st.lastSc && st.lastSc.D) || mag0 || 1; drawDeformed(c, v, dy.model, dy.shapes(), { colr: col('D'), lw: 2.6 }); st.fixSc.D = keep; st.auto = prevAuto; }
    else if (ok && st.show.D) drawDeformed(c, v, m, res.members);
    drawStructure(c, v, m, { sel: st.sel, labels: st.labels, letters: st.show.R && ok });
    drawLoads(c, v, m, { sel: st.sel, fade: st.show.dg ? 0.55 : 1 }, hits);
    if (ok && st.show.R) drawReactions(c, v, m, res.R);
    drawLabels(c, labels);
    if (dy) plotHistory(c, v, dy);
  }
  /* advance the dynamic response in slow motion (one period of the first mode ≈ 1.6 s on screen) and record the tracked displacement */
  function stepDyn(dt) {
    const d = st.dsys; if (!d || !d.ok) return; const slow = d.T1 / 1.6, steps = Math.min(400, Math.max(1, round((dt * slow) / d.dt))); d.step(steps); const u = d.u(); st.dyn.hist.push([d.t, d.track >= 0 ? u[d.track] : 0]); if (st.dyn.hist.length > 900) st.dyn.hist.shift();
    const tEnd = Math.min(30 * d.T1, max(8 * d.T1, 5 / max(1e-6, d.zeta1 * d.w1))); if (d.t > tEnd) { d.reset(); st.dyn.hist = []; }
  }
  function plotHistory(c, v, d) {
    const ph = phone(), W = ph ? v.W - 84 : 250, Hh = ph ? 62 : 92, x0 = ph ? 10 : v.W - W - 16, y0 = ph ? 58 : v.H - Hh - 70, hs = st.dyn.hist; if (!hs.length || d.track < 0) return;
    const tEnd = Math.min(30 * d.T1, max(8 * d.T1, 5 / max(1e-6, d.zeta1 * d.w1))), us = d.trackStatic, um = max(abs(us) * 2.05, ...hs.map((q) => abs(q[1]))) || 1, X = (t) => x0 + 6 + ((W - 12) * t) / tEnd, Y = (u) => y0 + 10 + ((Hh - 20) * (1 - u / um)) / 2;
    c.save(); c.fillStyle = tk('panel'); c.globalAlpha = 0.94; c.fillRect(x0, y0, W, Hh); c.globalAlpha = 1; c.strokeStyle = tk('line'); c.strokeRect(x0 + 0.5, y0 + 0.5, W, Hh);
    c.strokeStyle = tk('ink-3'); c.lineWidth = 1; R.line(c, x0 + 6, Y(0), x0 + W - 6, Y(0)); c.setLineDash([4, 3]); R.line(c, x0 + 6, Y(us), x0 + W - 6, Y(us)); c.setLineDash([]);
    c.strokeStyle = col('D'); c.lineWidth = 1.6; c.beginPath(); hs.forEach(([t, u], k) => (k ? c.lineTo(X(t), Y(u)) : c.moveTo(X(t), Y(u)))); c.stroke(); c.restore();
    const dir = d.track % 3 === 0 ? 'u' : 'v', nd = d.model.nodes[(d.track / 3) | 0]; R.mono(c, ph ? `${dir}(t) [mm]` : `${dir}(t) at (${fmt(nd.x, 1)}, ${fmt(nd.y, 1)}) m [mm]`, x0 + 8, y0 + 9, 10, tk('ink-2')); R.mono(c, `static ${fmt(us * 1000, 2)}`, x0 + W - 8, Y(us) + (us < 0 ? 9 : -9), 10, tk('ink-3'), 'right'); R.mono(c, `t = ${fmt(d.t, 2)} s`, x0 + W - 8, y0 + 9, 10, tk('ink-2'), 'right');
  }
  /* the target marker of the virtual-work scenes: a unit force, couple, or the dislocation of an influence line */
  function targetPos(m, t) { if (t.k === 'node') { const n = m.nodes[t.n]; return n ? [n.x, n.y] : null; } if (t.k === 'sup') { const n = m.nodes[t.n]; return n ? [n.x, n.y] : null; } return m.members[t.m] ? S.pointOf(m, t.m, t.at) : null; }
  function paintPvk(c, P, m) {
    const v = P.view, r = st.vwr, w = vws(), hits = (P.hits = []); if (!r || r.err) { paintEdit(c, P, m); return; }
    let labels = [];
    if (st.show.dg) labels = drawDiagram(c, v, m, dgM(r.r0.members), st.show.dg, col(st.show.dg));
    if (st.show.V) { const f = st.show.dg && st.show.dg !== 'M' ? 'N' : 'M'; labels.push(...drawDiagram(c, v, m, r.r1.members, f === 'M' ? 'M' : 'N', col('V'), { skey: 'V' + f, dash: [6, 4], alpha: 0.1, lofs: 14 })); }
    if (st.show.D) drawDeformed(c, v, m, r.r0.members);
    drawStructure(c, v, m, { sel: st.sel, labels: st.labels, letters: st.show.R });
    drawLoads(c, v, m, { sel: st.sel, fade: st.show.dg ? 0.55 : 1 }, hits);
    if (st.show.R) drawReactions(c, v, m, r.r0.R);
    const tp = targetPos(m, w.t); if (tp) { const x = v.X(tp[0]), y = v.Y(tp[1]), cv = col('V'); c.save(); c.strokeStyle = c.fillStyle = cv; c.lineWidth = 2.6; if (w.t.dir === 'r') { R.moment(c, x, y, 22, 1); txt(c, '1', x + 26, y - 24, cv, 'left', 13); } else { const d = w.t.dir === 'h' ? [1, 0] : [0, 1], o2 = w.t.dir === 'h' ? [0, -16] : [18, 0]; R.arrow(c, x - d[0] * 50 + o2[0], y - d[1] * 50 + o2[1], x - d[0] * 6 + o2[0], y - d[1] * 6 + o2[1], 11); txt(c, '1', x - d[0] * 50 + o2[0] + 9, y - d[1] * 50 + o2[1] + 2, cv, 'left', 13); } c.beginPath(); c.arc(x, y, 6, 0, TAU); c.stroke(); c.restore(); }
    drawLabels(c, labels);
  }
  function paintKgv(c, P, m) {
    const v = P.view, fm = st.vwr, w = vws(), hits = (P.hits = []); if (!fm || fm.err) { paintEdit(c, P, m); if (fm && fm.err) txt(c, fm.err, v.W / 2, v.H - 86, tk('load'), 'center', 12); return; }
    const state = w.state == null ? 'sum' : w.state; let labels = [];
    if (state === 'sum') {
      if (st.show.dg) labels = drawDiagram(c, v, m, dgM(fm.members), st.show.dg, col(st.show.dg));
      if (st.show.D) drawDeformed(c, v, m, fm.members);
      drawStructure(c, v, m, { sel: st.sel, labels: st.labels, letters: st.show.R }); drawLoads(c, v, m, { sel: st.sel, fade: st.show.dg ? 0.55 : 1 }, hits); if (st.show.R) drawReactions(c, v, m, fm.R);
      fm.primary && (w.cur || []).forEach((r, i) => markRelease(c, v, m, r, i, `X${SUB(i + 1)} = ${fmt(fm.X[i])}`));
    } else {
      const k = +state, res = k === 0 ? fm.s0 : fm.si[k - 1], pm = fm.primary, um = k === 0 ? pm : VW.unitState(pm, w.cur[k - 1]);
      if (st.show.dg) labels = drawDiagram(c, v, pm, res.members, st.show.dg, col(st.show.dg), { skey: st.show.dg + 's' + k });
      if (st.show.D) drawDeformed(c, v, pm, res.members);
      drawStructure(c, v, pm, { labels: st.labels, letters: st.show.R });
      if (k === 0) drawLoads(c, v, pm, {}, null); else drawLoads(c, v, um, { colr: col('V') }, null);
      if (st.show.R) drawReactions(c, v, pm, res.R);
      (w.cur || []).forEach((r, i) => markRelease(c, v, pm, r, i, k === i + 1 ? `X${SUB(i + 1)} = 1` : `X${SUB(i + 1)}`));
    }
    drawLabels(c, labels);
  }
  /* show where a redundant was released */
  function markRelease(c, v, m, r, i, lab) {
    const cv = col('V'); c.save(); c.strokeStyle = c.fillStyle = cv; c.lineWidth = 2;
    if (r.k === 'sup') { const n = m.nodes[r.n]; if (n) { const x = v.X(n.x), y = v.Y(n.y), sp = (m.supports || []).find((q) => q.n === r.n), a = (((sp && sp.ang) || 0) * PI) / 180; if (r.d === 2) { R.moment(c, x, y, 30, 1); txt(c, lab, x + 34, y - 30, cv, 'left', 11.5); } else { const d = r.d === 0 ? [cos(a), -sin(a)] : [-sin(a), -cos(a)]; R.arrow(c, x - d[0] * 64 + d[1] * 0, y - d[1] * 64, x - d[0] * 12, y - d[1] * 12, 10); txt(c, lab, x - d[0] * 70 + (r.d === 0 ? 0 : 10), y - d[1] * 70 + (r.d === 0 ? -12 : 0), cv, r.d === 0 ? 'center' : 'left', 11.5); } } }
    else if (r.k === 'hinge') { const mm = m.members[r.m]; if (mm) { const A = m.nodes[r.end === 'a' ? mm.a : mm.b], B = m.nodes[r.end === 'a' ? mm.b : mm.a], Lp = hypot(v.X(B.x) - v.X(A.x), v.Y(B.y) - v.Y(A.y)) || 1, f = 9 / Lp, x = v.X(A.x) + (v.X(B.x) - v.X(A.x)) * f, y = v.Y(A.y) + (v.Y(B.y) - v.Y(A.y)) * f; c.lineWidth = 1.8; R.moment(c, x, y, 16, 1); R.moment(c, x, y, 24, -1); txt(c, lab, x + 10, y - 34, cv, 'left', 11.5); } }
    else if (r.k === 'cut') { const mm = m.members[r.m]; if (mm) { const A = m.nodes[mm.a], B = m.nodes[mm.b], mx = v.X((A.x + B.x) / 2), my = v.Y((A.y + B.y) / 2); c.beginPath(); c.arc(mx, my, 7, 0, TAU); c.stroke(); txt(c, lab, mx + 10, my - 14, cv, 'left', 11.5); } }
    c.restore();
  }
  function paintPvv(c, P, m) {
    const v = P.view, il = st.vwr, w = vws(), hits = (P.hits = []), cv = col('V');
    drawStructure(c, v, m, { sel: st.sel, labels: st.labels, fade: 0.55 });
    drawLoads(c, v, m, { sel: st.sel, fade: 0.55 }, hits);
    if (!il || il.err) { if (il && il.err) txt(c, il.err, v.W / 2, v.H - 86, tk('load'), 'center', 12); return; }
    // the displaced figure = the influence line (vertical components for vertical loads), magnified to ~18 % of the size
    const r = il.r, Ls = lenScale(m); let um = 0; for (const d of r.members) for (let k = 0; k < d.w.length; k++) um = max(um, hypot(d.w[k], d.u[k])); if (um < 1e-12) return;
    const mag = ((0.17 * Ls) / um) * scl(); st.ilMag = mag;
    const pt = (i, x) => { const q = S.dispAt(r, i, x), pp = S.pointOf(m, i, x / r.el[i].g.L); return [v.X(pp[0] + q[0] * mag), v.Y(pp[1] + q[1] * mag)]; };
    r.members.forEach((d, i) => { const n = max(24, round(d.L * v.s / 6)), xs = []; for (let k = 0; k <= n; k++) xs.push((k / n) * d.L); for (const x of d.x) xs.push(x); xs.sort((a, b) => a - b);
      c.save(); c.fillStyle = cv; c.globalAlpha = 0.14; c.beginPath(); xs.forEach((x, k) => { const p = pt(i, x); k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); }); for (let k = xs.length - 1; k >= 0; k--) { const pp = S.pointOf(m, i, xs[k] / d.L); c.lineTo(v.X(pp[0]), v.Y(pp[1])); } c.closePath(); c.fill(); c.restore();
      c.save(); c.strokeStyle = cv; c.lineWidth = 2.6; c.beginPath(); xs.forEach((x, k) => { const p = pt(i, x); k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); }); c.stroke(); c.restore(); });
    // ordinates η = −v at the nodes and at the target, with their sign (positive = downwards, in the load direction)
    const labels = [];
    if (st.values) { m.nodes.forEach((n, i) => { const ux = r.u[3 * i], uy = r.u[3 * i + 1]; if (abs(uy) > 1e-6 * um || abs(ux) > 1e-6 * um) { const e = -uy; if (abs(e) > 1e-9) labels.push([fmt(e, 3), v.X(n.x + ux * mag), v.Y(n.y + uy * mag) + (e > 0 ? 14 : -12), cv]); } }); }
    const t = w.t, tp = targetPos(m, t);
    if (t.k !== 'sup' && st.values) { const L = r.el[t.m].g.L, x = t.at * L, e0 = -S.dispAt(r, t.m, max(0, x - 1e-7 * L))[1], e1 = -S.dispAt(r, t.m, min(L, x + 1e-7 * L))[1], p0 = pt(t.m, max(0, x - 1e-7 * L)), p1 = pt(t.m, min(L, x + 1e-7 * L)); if (abs(e0) > 1e-9) labels.push([fmt(e0, 3), p0[0] - 6, p0[1] + (e0 > 0 ? 14 : -12), cv]); if (abs(e1 - e0) > 1e-6) labels.push([fmt(e1, 3), p1[0] + 6, p1[1] + (e1 > 0 ? 14 : -12), cv]); }
    if (tp) { const x = v.X(tp[0]), y = v.Y(tp[1]); c.save(); c.strokeStyle = cv; c.lineWidth = 2; c.setLineDash([3, 3]); c.beginPath(); c.arc(x, y, 9, 0, TAU); c.stroke(); c.restore(); txt(c, t.k === 'M' ? 'Δφ = 1' : t.k === 'V' ? 'Δw = 1' : t.k === 'N' ? 'Δu = 1' : 'δ = 1', x, y + 24, cv, 'center', 11.5); }
    // poles of the kinematic chain
    if (il.poles && st.show.V) {
      const pl = il.poles, pp = (q) => [v.X(q.x), v.Y(q.y)], pmap = new Map(); for (const b of pl.bodies) pmap.set(b.id, b.pole);
      c.save(); c.strokeStyle = tk('ink-3'); c.lineWidth = 1; c.setLineDash([5, 4]);
      for (const q of pl.rel) { const a = pmap.get(q.i), b = pmap.get(q.j); if (!a || !b || a.inf || b.inf || q.pole.inf) continue; const A = pp(a), B = pp(b); R.line(c, A[0], A[1], B[0], B[1]); }
      for (const b of pl.bodies) { if (b.pole.inf) continue; const A = pp(b.pole); for (const p of b.pieces) { const M2 = [v.X(p.P[0]), v.Y(p.P[1])]; R.line(c, A[0], A[1], M2[0], M2[1]); } }
      c.restore();
      for (const b of pl.bodies) { const mid = b.pieces[0].P; txt(c, `(${b.id})`, v.X(mid[0]), v.Y(mid[1]) - 16, tk('ink-2'), 'center', 10.5); if (b.pole.inf) continue; const [x, y] = pp(b.pole); c.save(); c.fillStyle = cv; c.beginPath(); c.arc(x, y, 5, 0, TAU); c.fill(); c.restore(); txt(c, `${b.id}`, x + 8, y - 10, cv, 'left', 11); }
      for (const q of pl.rel) { if (q.pole.inf) continue; const [x, y] = pp(q.pole); c.save(); c.strokeStyle = cv; c.fillStyle = tk('paper'); c.lineWidth = 2; c.beginPath(); c.arc(x, y, 5, 0, TAU); c.fill(); c.stroke(); c.restore(); txt(c, `${q.i},${q.j}`, x + 8, y + 12, cv, 'left', 11); }
    }
    drawLabels(c, labels);
  }

  /* ---------------- probe (hover or tap on a member) ---------------- */
  function hitMember(P, sx, sy, tol) {
    const m = model(), v = P.view; let best = null;
    m.members.forEach((mm, i) => { const A = m.nodes[mm.a], B = m.nodes[mm.b], ax = v.X(A.x), ay = v.Y(A.y), bx = v.X(B.x), by = v.Y(B.y), dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1, t = max(0, min(1, ((sx - ax) * dx + (sy - ay) * dy) / L2)), d = hypot(ax + t * dx - sx, ay + t * dy - sy); if (d < (tol || 11) && (!best || d < best.d)) best = { mi: i, t, d }; });
    return best;
  }
  function paintProbe(c, P, m) {
    const hv = st.hover; if (!hv || st.tool !== 'select' || P.drag) return; const hm = hitMember(P, hv[0], hv[1], 12); if (!hm) return;
    const k = kind(), v = P.view, [x, y] = S.pointOf(m, hm.mi, hm.t); let lines = [];
    if (k === 'pvv') { const il = st.vwr; if (!il || il.err) return; const L = il.r.el[hm.mi].g.L, e = -S.dispAt(il.r, hm.mi, hm.t * L)[1]; lines = [[`η = ${fmt(e, 3)}`, col('V')]]; }
    else { let d = null; if (k === 'kgv' && st.vwr && !st.vwr.err && (vws().state == null || vws().state === 'sum')) d = st.vwr.members[hm.mi]; else if (k === 'pvk' && st.vwr && !st.vwr.err) d = st.vwr.r0.members[hm.mi]; else if (st.res && st.res.ok) d = st.res.members[hm.mi]; if (!d) return; const xx = hm.t * d.L, q = d.at(xx); lines = [[`M ${fmt(q[2])}`, col('M')], [`Q ${fmt(q[1])}`, col('Q')], [`N ${fmt(q[0])}`, col('N')]]; if (d.w) lines.push([`w ${fmt(-S.wAt(d, xx) * 1000)} mm`, col('D')]); lines.unshift([`x = ${fmt(xx)} m`, tk('ink-2')]); }
    const sx = v.X(x), sy = v.Y(y); c.save(); c.strokeStyle = tk('ink'); c.lineWidth = 1.5; c.fillStyle = tk('paper'); c.beginPath(); c.arc(sx, sy, 4.5, 0, TAU); c.fill(); c.stroke(); c.restore();
    const bx = sx + 14, by = sy - 18 - lines.length * 14, W = 112; c.save(); c.fillStyle = tk('panel'); c.strokeStyle = tk('line'); c.globalAlpha = 0.94; c.fillRect(bx - 4, by - 9, W, lines.length * 14 + 6); c.globalAlpha = 1; c.strokeRect(bx - 4, by - 9, W, lines.length * 14 + 6); c.restore();
    lines.forEach(([s, cc], i) => R.mono(c, s, bx + 2, by + i * 14, 11, cc, 'left'));
  }

  /* ---------------- frame ---------------- */
  function drawScene(dt, P) {
    st.t += dt; const id = st.L.sceneId, sc = sceneOf(id);
    if (sc.kind === 'derive') { P.player.tick(); const c = fitP(P.main.cv); if (c) (id === 'stiffness' ? paintStiff : paintPvw)(c, P.main.cv._W, P.main.cv._H, P.player.k, P.player.progress()); return; }
    const m = model(), cv = P.main.cv, c = fitP(cv); if (!c || !m) return; const W = cv._W, H = cv._H;
    if (!P.view || P.fit || P.view.W !== W || P.view.H !== H) { fitView(P, W, H, m); P.fit = false; }
    R.grid(c, P.view);
    if (sc.kind === 'edit' && st.dyn.on && st.dsys && !P.drag) stepDyn(dt);
    ({ edit: paintEdit, pvk: paintPvk, kgv: paintKgv, pvv: paintPvv })[sc.kind](c, P, m);
    paintDrag(c, P, m); paintProbe(c, P, m); if (!phone()) scaleBar(c, P.view); info(P);
  }
  /* a 1-2-5 scale bar at the lower right, like a drawing's */
  function scaleBar(c, v) {
    const L = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100].find((q) => q * v.s >= 60) || 100, px = L * v.s, x1 = v.W - 24, x0 = x1 - px, y = v.H - 20;
    c.save(); c.strokeStyle = tk('ink-2'); c.lineWidth = 1.4; R.line(c, x0, y, x1, y); R.line(c, x0, y - 5, x0, y + 5); R.line(c, x1, y - 5, x1, y + 5); c.restore();
    txt(c, `${L} m`, (x0 + x1) / 2, y - 10, tk('ink-2'), 'center', 10.5);
  }
  function paintDrag(c, P, m) {
    const d = P.drag, v = P.view, cw = tk('accent');
    if (st.pend && (st.tool === 'beam' || st.tool === 'bar') && st.hover) { const a = st.pend, b = snapPoint(P, st.hover[0], st.hover[1]); c.save(); c.strokeStyle = cw; c.lineWidth = 3; c.setLineDash([6, 4]); R.line(c, v.X(a.x), v.Y(a.y), v.X(b.x), v.Y(b.y)); c.restore(); txt(c, `${fmt(hypot(b.x - a.x, b.y - a.y))} m`, v.X(b.x) + 10, v.Y(b.y) - 10, cw, 'left', 11); }
    if (!d) return;
    if (d.k === 'mem' && d.b) { c.save(); c.strokeStyle = cw; c.lineWidth = 3.4; c.setLineDash([6, 4]); R.line(c, v.X(d.a.x), v.Y(d.a.y), v.X(d.b.x), v.Y(d.b.y)); c.restore(); txt(c, `${fmt(hypot(d.b.x - d.a.x, d.b.y - d.a.y))} m`, v.X(d.b.x) + 10, v.Y(d.b.y) - 10, cw, 'left', 11); }
    if (d.k === 'force' && d.x2 != null) { const [Fx, Fy] = dragForce(d); if (Fx || Fy) { const F2 = hypot(Fx, Fy), px = v.X(d.at.x), py = v.Y(d.at.y), ux = Fx / F2, uy = -Fy / F2; c.save(); c.strokeStyle = c.fillStyle = cw; c.lineWidth = 2.4; R.arrow(c, px - ux * 48, py - uy * 48, px - ux * 3, py - uy * 3, 11); c.restore(); txt(c, `${fmt(F2, 0)} kN`, px - ux * 48, py - uy * 48 - 12, cw, 'center', 11); } }
  }
  /* infobox: system status, then a legend of what is drawn */
  function info(P) {
    const r = st.res, dt = st.det, k = kind(), w = vws(); let html = '';
    if (!r) html = '<b>Draw a member to start</b>';
    else if (!r.ok) html = `<span class="dot" style="background:var(--load)"></span><b>Kinematic system</b> (a mechanism)`;
    else { const n = dt ? dt.statDeg : 0; html = `<span class="dot" style="background:var(--react)"></span><b>Stable system</b> · ${n ? `${n}× statically indeterminate` : 'statically determinate'}`; }
    const lg = []; if (r && r.ok) { if (st.show.dg) lg.push(`<span style="--c:var(--${CV[st.show.dg]})">${st.show.dg}</span> [${UNIT[st.show.dg]}]`); if (st.show.D && st.defMag) lg.push(`<span style="--c:var(--plot5)">D</span> [mm] ×${fmt(st.defMag, 0)}`); if (st.show.R) lg.push(`<span style="--c:var(--plot6)">A</span> [kN, kN·m]`); }
    if (k === 'edit' && st.dyn.on) { const d = st.dsys; html += d && d.ok ? `<br>f<sub>1</sub> = <b>${fmt(d.f1, 2)} Hz</b> · T<sub>1</sub> = ${fmt(d.T1, 3)} s · ζ<sub>1</sub> = ${fmt(100 * d.zeta1, 1)} % · slow motion ×${fmt(1.6 / d.T1, d.T1 > 0.5 ? 1 : 0)}` : `<br>${d ? d.err : 'no dynamics for a mechanism'}`; lg.push(`<span style="--c:var(--plot5)">D(t)</span> step response, dashed: static`); }
    if (k === 'pvk' && st.vwr && !st.vwr.err) { const q = st.vwr, rot = w.t && w.t.dir === 'r', f = rot ? 1000 : 1000; html += `<br>${rot ? 'φ' : 'δ'} = <b>${fmt(q.total * f, 3)} ${rot ? 'mrad' : 'mm'}</b> by virtual work · stiffness method ${fmt(q.direct * f, 3)} ${abs(q.total - q.direct) < 1e-9 + 1e-7 * abs(q.direct) ? '✓' : ''}`; if (st.show.V) lg.push(`<span style="--c:var(--plot4)">${st.show.dg === 'N' ? 'N̄' : 'M̄'}</span> unit state`); }
    if (k === 'kgv' && st.vwr && !st.vwr.err) { const q = st.vwr; html += `<br>${q.X.map((x, i) => `X${SUB(i + 1)} = <b>${fmt(x, 3)}</b>`).join(' · ')} · vs stiffness method Δ = ${fmtE(q.dev)}`; }
    if (k === 'pvv' && st.vwr && !st.vwr.err) { const q = st.vwr; html += `<br>${tName(model(), w.t)} = Σ P·η = <b>${fmt(q.Sw, 3)}</b> · direct ${fmt(q.Sd, 3)} ${q.Sd != null && abs(q.Sw - q.Sd) < 1e-6 * max(1, abs(q.Sd)) ? '✓' : ''} · ${q.rigid ? 'rigid chain' : 'elastic line'}`; }
    if (lg.length) html += `<div class="lg">${lg.join('')}</div>`;
    if (P.info._h !== html) { P.info.innerHTML = html; P.info._h = html; }
    const hint = st.pend ? 'Tap the end point' : HINT[st.tool] || ''; if (P.hint._h !== hint) { P.hint.textContent = hint; P.hint._h = hint; }
  }
  const HINT = { damper: 'Tap a node: spring + damper in y′ · ▶ shows the motion', node: 'Tap to place a node · tap a member to split it', beam: 'Drag, or tap two points', bar: 'Drag, or tap two points', pin: 'Tap a node or a member · tap again to turn', roller: 'Tap a node or a member · tap again to turn', fixed: 'Tap a node', slidex: 'Tap a node · tap again to turn', spring: 'Tap a node', hinge: 'Tap a node, a member end, or a point on a member', qhinge: 'Tap a member end or a point on a member', nhinge: 'Tap a member end or a point on a member', force: 'Tap or drag from a node or a member', moment: 'Tap a node or any point on a member · tap it again to flip', qload: 'Tap a member', trap: 'Tap a member', temp: 'Tap a member', del: 'Tap what to remove', target: 'Tap a node, a support, or a point on a member' };

  /* ---------------- editing helpers ---------------- */
  function splitMember(m, mi, t) {
    const mm = m.members[mi], A = m.nodes[mm.a], B = m.nodes[mm.b]; m.nodes.push({ x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t }); const n = m.nodes.length - 1;
    const m2 = Object.assign(clone(mm), { a: n, ra: false, va: false, na: false }); mm.b = n; mm.rb = false; mm.vb = false; mm.nb = false; m.members.push(m2); const m2i = m.members.length - 1, add = [];
    for (const ld of m.mloads || []) { if (ld.m !== mi) continue; const a = ld.at == null ? 0.5 : ld.at;
      if (ld.type === 'point' || ld.type === 'moment' || ld.type === 'disl') { if (a <= t) ld.at = t > 0 ? a / t : 0; else { ld.m = m2i; ld.at = (a - t) / (1 - t); } }
      else if (ld.type === 'temp') add.push(Object.assign(clone(ld), { m: m2i }));
      else { const q1 = ld.q1 || 0, q2 = ld.q2 == null ? q1 : ld.q2, qt = q1 + (q2 - q1) * t; add.push(Object.assign(clone(ld), { m: m2i, q1: qt, q2 })); ld.q2 = qt; } }
    m.mloads = (m.mloads || []).concat(add); return n;
  }
  function delMember(m, mi) { m.members.splice(mi, 1); m.mloads = (m.mloads || []).filter((l) => l.m !== mi).map((l) => (l.m > mi ? Object.assign(l, { m: l.m - 1 }) : l)); }
  function delNode(m, n) { for (let i = m.members.length - 1; i >= 0; i--) if (m.members[i].a === n || m.members[i].b === n) delMember(m, i); m.nodes.splice(n, 1); const fix = (k) => (k > n ? k - 1 : k); m.members.forEach((mm) => { mm.a = fix(mm.a); mm.b = fix(mm.b); }); m.supports = (m.supports || []).filter((s) => s.n !== n).map((s) => Object.assign(s, { n: fix(s.n) })); m.nloads = (m.nloads || []).filter((l) => l.n !== n).map((l) => Object.assign(l, { n: fix(l.n) })); }
  function dropOrphans(m) { for (let n = m.nodes.length - 1; n >= 0; n--) if (!m.members.some((mm) => mm.a === n || mm.b === n) && !(m.supports || []).some((s) => s.n === n)) delNode(m, n); }
  const nodeAt = (P, sx, sy, tol) => { const m = model(), v = P.view; let best = -1, bd = tol || 14; m.nodes.forEach((n, i) => { const d = hypot(v.X(n.x) - sx, v.Y(n.y) - sy); if (d < bd) { bd = d; best = i; } }); return best; };
  const snapv = (x) => (st.snap ? round(x / st.grid) * st.grid : round(x * 1000) / 1000);
  /* where a tap lands: an existing node, a point on a member (snapped along it), or a snapped free point */
  function snapPoint(P, sx, sy) {
    const m = model(), v = P.view, n = nodeAt(P, sx, sy); if (n >= 0) return { n, x: m.nodes[n].x, y: m.nodes[n].y };
    const hm = hitMember(P, sx, sy, 9); if (hm && hm.t > 0.001 && hm.t < 0.999) { const L = S.geo(m, hm.mi).L; let t = hm.t; if (st.snap) { const st2 = st.grid / L; t = max(st2 > 0.5 ? 0.5 : st2, min(1 - (st2 > 0.5 ? 0.5 : st2), round(t / st2) * st2)); } const [x, y] = S.pointOf(m, hm.mi, t); return { mi: hm.mi, t, x, y }; }
    return { x: snapv(v.wx(sx)), y: snapv(v.wy(sy)) };
  }
  /* make a point into a node (splitting a member if it lies on one) */
  function realize(m, p) { if (p.n != null) return p.n; if (p.mi != null) return splitMember(m, p.mi, p.t); const i = m.nodes.findIndex((n) => abs(n.x - p.x) < 1e-9 && abs(n.y - p.y) < 1e-9); if (i >= 0) return i; m.nodes.push({ x: p.x, y: p.y }); return m.nodes.length - 1; }
  const dragForce = (d) => { const dx = d.x2 - d.x, dy = d.y2 - d.y, L = hypot(dx, dy); if (L < 12) return [0, -10]; let a = atan2(-dy, dx); a = round(a / (PI / 12)) * (PI / 12); const mag = max(5, round(L / 4 / 5) * 5); return [round(cos(a) * mag * 100) / 100, round(sin(a) * mag * 100) / 100]; };
  function hitLoad(P, sx, sy) {
    for (const hh of (P.hits || []).slice().reverse()) {
      if (hh.seg) { const [x0, y0, x1, y1] = hh.seg, dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1, t = max(0, min(1, ((sx - x0) * dx + (sy - y0) * dy) / L2)); if (hypot(x0 + t * dx - sx, y0 + t * dy - sy) < 9 && t < 0.9) return hh; }
      else if (hh.ring) { const d = hypot(hh.ring[0] - sx, hh.ring[1] - sy); if (abs(d - hh.ring[2]) < 8) return hh; }
      else if (hh.poly) { let ins = false; const p = hh.poly; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > sy) !== (p[j][1] > sy) && sx < ((p[j][0] - p[i][0]) * (sy - p[i][1])) / (p[j][1] - p[i][1] || 1e-9) + p[i][0]) ins = !ins; if (ins) return hh; }
    }
    return null;
  }
  function setSupport(m, n, type) {
    m.supports = m.supports || []; const k = m.supports.findIndex((s) => s.n === n);
    if (type === 'damper') { let sp = m.supports[k]; if (!sp) { sp = { n, type: 'spring', ky: 1000 }; m.supports.push(sp); } else if (S.supFix(sp)[1]) { sp.type = 'spring'; delete sp.fix; sp.ky = sp.ky || 1000; } if (sp.cy) delete sp.cy; else sp.cy = 20; return; }
    if (k >= 0 && m.supports[k].type === type) { const sp = m.supports[k]; if (type === 'fixed' && sp.ang == null) sp.ang = 0; else sp.ang = (((sp.ang || 0) + 90) % 360); if (type === 'fixed' || type === 'pin') sp.ang = sp.ang % 360; return; }
    const sp = { n, type }; if (type === 'spring') sp.ky = 1000; if (k >= 0) m.supports[k] = sp; else m.supports.push(sp);
  }
  function toggleRelease(m, kindR, p) {
    const key = kindR === 'hinge' ? 'r' : kindR === 'qhinge' ? 'v' : 'n';
    if (p.n != null) {
      const ends = endsAt(m, p.n).filter(([i]) => m.members[i].type !== 'truss'); if (!ends.length) return false;
      if (key === 'r') { const all = ends.every(([i, e]) => m.members[i]['r' + e]); for (const [i, e] of ends) m.members[i]['r' + e] = !all; return true; }
      if (ends.length < 2) return false; const [i, e] = ends[ends.length - 1]; m.members[i][key + e] = !m.members[i][key + e]; return true;
    }
    if (p.mi != null) { const mm = m.members[p.mi]; if (mm.type === 'truss') return false; if (p.t < 0.2 || p.t > 0.8) { const e = p.t < 0.5 ? 'a' : 'b'; mm[key + e] = !mm[key + e]; return true; } const mi = p.mi; splitMember(m, mi, p.t); m.members[mi][key + 'b'] = true; return true; }
    return false;
  }

  /* ---------------- pointer input ---------------- */
  function bindEditor(P) {
    const cv = P.main.cv; cv.style.touchAction = 'none'; const pts = new Map(); let pinch = null, drag = null;
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.offsetX, e.offsetY]); closeMenu(P);
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: hypot(a[0] - b[0], a[1] - b[1]) }; drag = null; P.drag = null; return; }
      if (kind() === 'derive') return;
      const sx = e.offsetX, sy = e.offsetY, m = model(), t = st.tool; st.hover = e.pointerType === 'mouse' ? [sx, sy] : null;
      if (t === 'select') {
        const ld = hitLoad(P, sx, sy), n = nodeAt(P, sx, sy);
        if (n >= 0) { st.sel = { k: 'n', i: n }; drag = { k: 'node', i: n, moved: false, x: sx, y: sy }; }
        else if (ld) st.sel = { k: ld.k, i: ld.i };
        else { const hm = hitMember(P, sx, sy, 11); if (hm) { st.sel = { k: 'm', i: hm.mi }; if (e.pointerType !== 'mouse') st.hover = [sx, sy]; } else { st.sel = null; drag = { k: 'pan', x: sx, y: sy }; } }
        buildPanels(st.L); P.drag = drag; return;
      }
      if (t === 'beam' || t === 'bar') { const a = snapPoint(P, sx, sy); drag = { k: 'mem', a, b: null, x: sx, y: sy }; P.drag = drag; return; }
      if (t === 'force') { const p = snapPoint(P, sx, sy); if (p.n == null && p.mi == null) return; drag = { k: 'force', at: p, x: sx, y: sy, x2: sx, y2: sy }; P.drag = drag; return; }
      if (t === 'del') { const ld = hitLoad(P, sx, sy); push(); if (ld) { (ld.k === 'nl' ? m.nloads : m.mloads).splice(ld.i, 1); st.sel = null; return commit(); } const n = nodeAt(P, sx, sy, 12); if (n >= 0) { const k = (m.supports || []).findIndex((s) => s.n === n); if (k >= 0) m.supports.splice(k, 1); else delNode(m, n); st.sel = null; return commit(); } const hm = hitMember(P, sx, sy); if (hm) { delMember(m, hm.mi); dropOrphans(m); st.sel = null; return commit(); } st.undo.pop(); return; }
      if (t === 'target') { pickTarget(P, sx, sy); return; }
      const p = snapPoint(P, sx, sy);
      if (t === 'node') { if (p.n != null) { st.sel = { k: 'n', i: p.n }; buildPanels(st.L); return; } push(); const n = realize(m, p); st.sel = { k: 'n', i: n }; return commit(); }
      if (['pin', 'roller', 'fixed', 'slidex', 'spring', 'damper'].includes(t)) { if (p.n == null && p.mi == null) return; push(); const n = realize(m, p); setSupport(m, n, t); st.sel = { k: 'n', i: n }; return commit(); }
      if (t === 'hinge' || t === 'qhinge' || t === 'nhinge') { const hm = p.n == null ? hitMember(P, sx, sy) : null, q = p.n != null ? p : hm ? { mi: hm.mi, t: p.mi != null ? p.t : hm.t } : null; if (!q) return; push(); if (!toggleRelease(m, t, q)) { st.undo.pop(); return; } return commit(); }
      if (t === 'moment') { const ld = hitLoad(P, sx, sy); if (ld && ld.ring) { push(); const L2 = ld.k === 'nl' ? m.nloads[ld.i] : m.mloads[ld.i]; L2.M = -(L2.M || 0); st.sel = { k: ld.k, i: ld.i }; return commit(); } if (p.n == null && p.mi == null) return; push(); if (p.n != null) { m.nloads = m.nloads || []; m.nloads.push({ n: p.n, M: 10 }); st.sel = { k: 'nl', i: m.nloads.length - 1 }; } else { m.mloads = m.mloads || []; m.mloads.push({ m: p.mi, type: 'moment', at: p.t, M: 10 }); st.sel = { k: 'ml', i: m.mloads.length - 1 }; } return commit(); }
      if (t === 'qload' || t === 'trap' || t === 'temp') { const hm = hitMember(P, sx, sy, 14); if (!hm) { const ld = hitLoad(P, sx, sy); if (ld) { st.sel = { k: ld.k, i: ld.i }; buildPanels(st.L); } return; } const ex = (m.mloads || []).findIndex((l) => l.m === hm.mi && (t === 'temp' ? l.type === 'temp' : !l.type)); if (ex >= 0) { st.sel = { k: 'ml', i: ex }; buildPanels(st.L); return; } push(); m.mloads = m.mloads || []; m.mloads.push(t === 'qload' ? { m: hm.mi, q1: -10 } : t === 'trap' ? { m: hm.mi, q1: 0, q2: -10 } : { m: hm.mi, type: 'temp', dT: 0, dTM: 20 }); st.sel = { k: 'ml', i: m.mloads.length - 1 }; return commit(); }
    });
    cv.addEventListener('pointermove', (e) => {
      const sx = e.offsetX, sy = e.offsetY; if (pts.has(e.pointerId)) pts.set(e.pointerId, [sx, sy]);
      if (pinch && pts.size === 2) { const [a, b] = [...pts.values()], d = hypot(a[0] - b[0], a[1] - b[1]), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, v = P.view, wx = v.wx(mx), wy = v.wy(my); v.s *= d / pinch.d; v.x = wx - (mx - v.W / 2) / v.s; v.y = wy + (my - v.H / 2) / v.s; pinch.d = d; return; }
      if (e.pointerType === 'mouse' || drag) st.hover = [sx, sy];
      if (!drag) return; const m = model(), v = P.view;
      if (drag.k === 'node') { if (!drag.moved && hypot(sx - drag.x, sy - drag.y) < 4) return; if (!drag.moved) { push(); drag.moved = true; } const n = m.nodes[drag.i]; n.x = snapv(v.wx(sx)); n.y = snapv(v.wy(sy)); analyse(); }
      else if (drag.k === 'pan') { v.x -= (sx - drag.x) / v.s; v.y += (sy - drag.y) / v.s; drag.x = sx; drag.y = sy; }
      else if (drag.k === 'mem') { if (hypot(sx - drag.x, sy - drag.y) > 6) drag.b = snapPoint(P, sx, sy); }
      else if (drag.k === 'force') { drag.x2 = sx; drag.y2 = sy; }
    });
    const end = (e) => {
      pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!drag) { if (e.pointerType !== 'mouse' && st.tool !== 'select') st.hover = null; return; } const m = model(), d = drag; drag = null; P.drag = null;
      if (d.k === 'node' && d.moved) commit();
      else if (d.k === 'mem') { const b = d.b; if (b && hypot(b.x - d.a.x, b.y - d.a.y) > 1e-6) makeMember(m, d.a, b); else if (!b) { if (st.pend) { const a = st.pend; st.pend = null; const bb = d.a; if (hypot(bb.x - a.x, bb.y - a.y) > 1e-6) makeMember(m, a, bb); } else { st.pend = d.a; st.hover = [e.offsetX, e.offsetY]; } } }
      else if (d.k === 'force') { const [Fx, Fy] = dragForce(d); push(); if (d.at.n != null) { m.nloads = m.nloads || []; m.nloads.push({ n: d.at.n, Fx, Fy }); st.sel = { k: 'nl', i: m.nloads.length - 1 }; } else { m.mloads = m.mloads || []; m.mloads.push({ m: d.at.mi, type: 'point', at: d.at.t, Fx, Fy }); st.sel = { k: 'ml', i: m.mloads.length - 1 }; } commit(); }
    };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end); cv.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !drag) st.hover = null; });
    cv.addEventListener('wheel', (e) => { e.preventDefault(); const v = P.view; if (!v) return; const f = Math.exp(-e.deltaY * 0.0012), wx = v.wx(e.offsetX), wy = v.wy(e.offsetY); v.s *= f; v.x = wx - (e.offsetX - v.W / 2) / v.s; v.y = wy + (e.offsetY - v.H / 2) / v.s; }, { passive: false });
  }
  function makeMember(m, a, b) { push(); const ia = realize(m, a), ib = realize(m, b.mi != null && a.mi === b.mi ? Object.assign({}, b, { mi: b.t > a.t ? m.members.length - 1 : b.mi, t: b.t > a.t ? (b.t - a.t) / (1 - a.t) : b.t / a.t }) : b); if (ia === ib || m.members.some((q) => (q.a === ia && q.b === ib) || (q.a === ib && q.b === ia))) { st.undo.pop(); return; } const truss = st.tool === 'bar'; m.members.push(mem(ia, ib, { type: truss ? 'truss' : 'frame', sec: truss ? 'rhs100' : st.newSec, mat: st.newMat })); st.sel = { k: 'm', i: m.members.length - 1 }; commit(); }
  function pickTarget(P, sx, sy) {
    const m = model(), k = kind(), w = vws(), n = nodeAt(P, sx, sy, 16), sp = n >= 0 ? (m.supports || []).find((q) => q.n === n) : null;
    if (k === 'pvk') { if (n >= 0) w.t = { k: 'node', n, dir: (w.t && w.t.dir) || 'v' }; else { const hm = hitMember(P, sx, sy, 14); if (!hm) return; const L = S.geo(m, hm.mi).L, step = st.snap ? st.grid / L : 0.001; w.t = { k: 'member', m: hm.mi, at: max(0, min(1, round(hm.t / step) * step)), dir: (w.t && w.t.dir) || 'v' }; } }
    else if (k === 'pvv') { if (sp) { const fl = S.supFix(sp), d = [1, 0, 2].find((q) => fl[q]); if (d == null) return; w.t = { k: 'sup', n, d }; } else { const hm = hitMember(P, sx, sy, 14); if (!hm) return; const L = S.geo(m, hm.mi).L, step = st.snap ? st.grid / L : 0.001; w.t = { k: w.q || 'M', m: hm.mi, at: max(0, min(1, round(hm.t / step) * step)) }; } }
    commit();
  }
  function commit() { analyse(); save(); buildPanels(st.L); const P = st.panes[st.L.sceneId]; if (P && P.sync) P.sync(); }

  /* ---------------- toolbars ---------------- */
  const TOP = [['select', 'i-select', 'Select and move (V)'], ['node', 'i-st-node', 'Node (N)'], ['beam', 'i-st-beam', 'Beam (B)'], ['bar', 'i-st-bar', 'Truss bar (T)'], '|',
    ['pin', 'i-st-pin', 'Pinned support · Festlager'], ['roller', 'i-st-roller', 'Roller · Loslager'], ['fixed', 'i-st-fixed', 'Fixed support · Einspannung'], ['slidex', 'i-st-slide', 'Sliding clamp · Parallelführung'], ['spring', 'i-st-spring', 'Spring support · Feder'], ['damper', 'i-damper', 'Damper · Dämpfer (acts in motion)'], '|',
    ['hinge', 'i-st-hinge', 'Moment hinge · Momentengelenk'], ['qhinge', 'i-st-qhinge', 'Shear hinge · Querkraftgelenk'], ['nhinge', 'i-st-nhinge', 'Normal-force hinge · Normalkraftgelenk'], '|', ['del', 'i-trash', 'Delete (Del)']];
  const SIDE = [['force', 'i-st-force', 'Point force (F)'], ['moment', 'i-st-moment', 'Couple, anywhere (M)'], ['qload', 'i-st-qload', 'Uniform line load (Q)'], ['trap', 'i-st-trap', 'Trapezoidal line load'], ['temp', 'i-st-temp', 'Temperature']];
  const tbtn = (icon, tip, onclick, data) => { const b = h('button', { class: 'tb', type: 'button', 'data-tip': tip, 'aria-label': tip, onclick }, F.icon(icon)); if (data) Object.assign(b.dataset, data); return b; };
  function setTool(P, t) { st.tool = st.tool === t && t !== 'select' ? 'select' : t; st.pend = null; P.sync(); }
  function makeBars(P, sc) {
    const top = h('div', { class: 'stbar top' }), side = h('div', { class: 'stbar side' }), bot = h('div', { class: 'stbar bot' });
    for (const t of TOP) top.append(t === '|' ? h('span', { class: 'tbsep' }) : tbtn(t[1], t[2], () => setTool(P, t[0]), { t: t[0] }));
    top.append(h('span', { class: 'tbsep' }), tbtn('i-undo', 'Undo (Ctrl+Z)', undo, { act: 'undo' }), tbtn('i-redo', 'Redo (Ctrl+Y)', redo, { act: 'redo' }), tbtn('i-fit', 'Fit to the screen', () => { P.fit = true; }), tbtn('i-dots', 'More', () => toggleMenu(P), { act: 'more' }));
    if (sc.kind === 'pvk' || sc.kind === 'pvv') side.append(tbtn('i-st-target', sc.kind === 'pvk' ? 'Where the displacement is wanted' : 'Which force: a support or a section', () => setTool(P, 'target'), { t: 'target' }), h('span', { class: 'tbsep' }));
    for (const t of SIDE) side.append(tbtn(t[1], t[2], () => setTool(P, t[0]), { t: t[0] }));
    const letter = (k, label, tip, on) => { const b = h('button', { class: 'tb tl', type: 'button', 'data-tip': tip, 'aria-label': tip, style: `--c:var(--${CV[k]})`, onclick: on }, label); b.dataset.l = k; return b; };
    bot.append(tbtn('i-st-react', 'Support reactions', () => { st.show.R = !st.show.R; save(); P.sync(); }, { tg: 'R' }), h('span', { class: 'tbsep' }));
    if (sc.kind === 'pvv') bot.append(letter('V', 'η', 'Influence line and poles', () => { st.show.V = !st.show.V; save(); P.sync(); }));
    else { for (const [k, tip] of [['M', 'Bending moment M'], ['Q', 'Shear force Q'], ['N', 'Normal force N'], ['w', 'Deflection w(x) as a curve along each member']]) bot.append(letter(k, k, tip, () => { st.show.dg = st.show.dg === k ? null : k; save(); P.sync(); }));
      bot.append(letter('D', 'D', 'Deformation', () => { st.show.D = !st.show.D; save(); P.sync(); })); if (sc.kind === 'pvk') bot.append(letter('V', 'M̄', 'Unit-load state', () => { st.show.V = !st.show.V; save(); P.sync(); })); }
    if (sc.kind === 'edit') bot.append(h('span', { class: 'tbsep' }), tbtn('i-play', 'Dynamic response: the loads switched on at t = 0', () => { st.dyn.on = !st.dyn.on; analyse(); save(); P.sync(); buildPanels(st.L); }, { tg: 'dyn' }));
    const sl = h('input', { type: 'range', min: -2, max: 2, step: 0.05, value: st.scale, 'aria-label': 'Scale of the diagrams' }); sl.oninput = () => { st.scale = +sl.value; }; sl.onchange = save;
    bot.append(h('span', { class: 'tbsep' }), h('span', { class: 'stscale', 'data-tip': 'Scale of diagrams and deformation' }, F.icon('i-st-scale'), sl),
      tbtn('i-st-auto', 'Auto scale (off: keep the scale while you edit)', () => { st.auto = !st.auto; if (!st.auto) st.fixSc = Object.assign({}, st.lastSc || {}); save(); P.sync(); }, { tg: 'auto' }),
      tbtn('i-st-snap', 'Grid snap · Rasterfang', () => { st.snap = !st.snap; save(); P.sync(); }, { tg: 'snap' }), tbtn('i-st-values', 'Values on the diagrams', () => { st.values = !st.values; save(); P.sync(); }, { tg: 'values' }));
    P.slider = sl; P.info = h('div', { class: 'stinfo2' }); P.hint = h('div', { class: 'sthint' }); P.menu = h('div', { class: 'stmenu', hidden: true });
    P.main.el.append(top, side, bot, P.info, P.hint, P.menu); P.bars = [top, side, bot];
    P.sync = () => {
      for (const b of P.main.el.querySelectorAll('.tb[data-t]')) b.classList.toggle('on', b.dataset.t === st.tool);
      for (const b of P.main.el.querySelectorAll('.tb[data-l]')) { const k = b.dataset.l; b.classList.toggle('on', k === 'D' ? st.show.D : k === 'V' ? st.show.V : st.show.dg === k); }
      for (const b of P.main.el.querySelectorAll('.tb[data-tg]')) { const k = b.dataset.tg; b.classList.toggle('on', k === 'R' ? st.show.R : k === 'dyn' ? st.dyn.on : !!st[k]); if (k === 'dyn') { const u = b.querySelector('use'); if (u) u.setAttribute('href', st.dyn.on ? '#i-pause' : '#i-play'); } }
      const u = P.main.el.querySelector('[data-act="undo"]'), r = P.main.el.querySelector('[data-act="redo"]'); if (u) u.disabled = !st.undo.length; if (r) r.disabled = !st.redo.length; sl.value = st.scale;
      P.main.cv.style.cursor = st.tool === 'select' ? 'default' : 'crosshair';
    };
    P.sync();
  }
  const closeMenu = (P) => { if (P && P.menu) P.menu.hidden = true; };
  function toggleMenu(P) {
    const mn = P.menu; if (!mn.hidden) { mn.hidden = true; return; } mn.innerHTML = ''; const m = model(), id = st.L.sceneId;
    const chip = (l, on, f) => h('button', { class: 'relbtn' + (on ? ' on' : ''), type: 'button', onclick: () => { f(); toggleMenu(P); toggleMenu(P); } }, l);
    const sw = (l, get, set) => { const c = h('input', { type: 'checkbox' }); c.checked = !!get(); c.onchange = () => { set(c.checked); }; return h('label', { class: 'switch' }, c, h('span', {}, l)); };
    mn.append(h('div', { class: 'mlab' }, 'Grid'), h('div', { class: 'mrow' }, ...[0.1, 0.25, 0.5, 1].map((g) => chip(`${g} m`, st.grid === g, () => { st.grid = g; save(); }))),
      sw('Node and member numbers', () => st.labels, (v) => { st.labels = v; save(); }),
      sw('Self-weight', () => m.selfWeight, (v) => { push(); m.selfWeight = v; commit(); }),
      h('div', { class: 'mlab' }, 'New beams'),
      (() => { const s1 = h('select', { class: 'select sm' }, ...Object.entries(S.SECS).map(([k, q]) => h('option', { value: k, selected: k === st.newSec ? true : null }, q.name))); s1.onchange = () => { st.newSec = s1.value; }; const s2 = h('select', { class: 'select sm' }, ...Object.entries(S.MATS).map(([k, q]) => h('option', { value: k, selected: k === st.newMat ? true : null }, q.name))); s2.onchange = () => { st.newMat = s2.value; }; return h('div', { class: 'mrow' }, s1, s2); })(),
      h('div', { class: 'mrow' }, F.btn('Reset', () => { push(); resetModel(id); P.fit = true; mn.hidden = true; commit(); }, 'ghost', 'i-reset'), F.btn('Clear', () => { push(); st.models[id] = { nodes: [], members: [], supports: [], nloads: [], mloads: [] }; st.sel = null; mn.hidden = true; commit(); }, 'ghost', 'i-trash')));
    mn.hidden = false;
  }
  function resetModel(id) { const sc = sceneOf(id); if (VWS[sc.kind]) { const w = vws(); st.models[id] = MODELS[w.struct || VWS[sc.kind].def](); w.t = DEF_T[sc.kind] ? clone(DEF_T[sc.kind][w.struct || VWS[sc.kind].def]) : null; w.rels = null; w.state = 'sum'; } else st.models[id] = MODELS[id](); st.sel = null; }

  /* ---------------- right panel: controls ---------------- */
  const card = (title, ...kids) => h('div', { class: 'stcard' }, h('h5', {}, title), ...kids);
  const eqn = (html) => h('div', { class: 'eqn', html });
  const field = (label, get, set, o) => { o = o || {}; const inp = h('input', { class: 'field', value: fmt(get() * (o.mul || 1), o.dec == null ? 3 : o.dec).replace('−', '-'), inputmode: 'decimal' }); inp.onchange = () => { const v = MB.evalExpr ? MB.evalExpr(inp.value, {}) : +inp.value; if (!isFinite(v)) return; push(); set(v / (o.mul || 1)); commit(); }; return h('label', { class: 'stfield' }, h('span', { html: label }), inp); };
  const icoTog = (icon, tip, on, f) => h('button', { class: 'tb' + (on ? ' on' : ''), type: 'button', 'data-tip': tip, 'aria-label': tip, onclick: f }, F.icon(icon));
  function buildPanels(L) {
    const id = L.sceneId, sc = sceneOf(id), cb = L.body('ctl'); cb.innerHTML = '';
    K.sceneList(L, L.body('list'), SCENES, (s) => SU.open(L, s));
    const tb = L.body('th'); tb.innerHTML = ''; tb.append(h('div', { class: 'theory', html: theory(id) }));
    if (sc.kind === 'derive') { cb.append(card('Derivation', h('p', { class: 'note' }, 'Next and Back step through it; Play runs it.'))); return; }
    if (!model()) return;
    if (sc.kind === 'pvk') cb.append(pvkCard()); else if (sc.kind === 'kgv') cb.append(kgvCard()); else if (sc.kind === 'pvv') cb.append(pvvCard());
    if (st.sel) { const c = selCard(st.sel); if (c) cb.append(c); }
    cb.append(resultsCard());
  }
  /* the selected node, member or load */
  function selCard(s) {
    const m = model();
    if (s.k === 'n' && m.nodes[s.i]) {
      const n = m.nodes[s.i], sp = (m.supports || []).find((q) => q.n === s.i), setT = (t) => { push(); m.supports = (m.supports || []).filter((q) => q.n !== s.i); if (t !== 'none') m.supports.push(Object.assign({ n: s.i, type: t }, t === 'spring' ? { ky: 1000 } : {})); commit(); };
      const kids = [h('div', { class: 'stfields' }, field('x [m]', () => n.x, (v) => (n.x = v)), field('y [m]', () => n.y, (v) => (n.y = v))),
        h('div', { class: 'icorow' }, ...[['none', 'i-st-node', 'No support'], ['pin', 'i-st-pin', 'Festlager'], ['roller', 'i-st-roller', 'Loslager'], ['fixed', 'i-st-fixed', 'Einspannung'], ['slidex', 'i-st-slide', 'Parallelführung'], ['spring', 'i-st-spring', 'Spring']].map(([t, ic, tip]) => icoTog(ic, tip, (sp ? sp.type : 'none') === t, () => setT(t))))];
      if (sp) {
        const fl = S.supFix(sp);
        kids.push(h('div', { class: 'stfields n3' }, field('angle [°]', () => sp.ang || 0, (v) => (sp.ang = v), { dec: 1 }), ...['x′', 'y′', 'φ'].map((nm, i) => (fl[i] ? field(`${i < 2 ? 'Δ' + nm + ' [mm]' : 'Δφ [mrad]'}`, () => [sp.dx, sp.dy, sp.dr][i] || 0, (v) => (sp[['dx', 'dy', 'dr'][i]] = v || undefined), { mul: 1000, dec: 2 }) : field(`k_${nm} ${i < 2 ? '[kN/m]' : '[kN·m]'}`, () => [sp.kx, sp.ky, sp.kr][i] || 0, (v) => (sp[['kx', 'ky', 'kr'][i]] = max(0, v) || undefined), { dec: 0 })))));
        if (!fl[0] || !fl[1]) kids.push(h('div', { class: 'stfields n3' }, ...[0, 1].filter((i) => !fl[i]).map((i) => field(`c_${['x′', 'y′'][i]} [kN·s/m]`, () => [sp.cx, sp.cy][i] || 0, (v) => (sp[['cx', 'cy'][i]] = max(0, v) || undefined), { dec: 1 }))));
        kids.push(h('p', { class: 'note' }, 'Restrained directions take a settlement Δ; free ones a spring k and a damper c (dampers act only in motion: ▶).'));
      }
      kids.push(h('div', { class: 'stfields' }, field('point mass [kg]', () => n.mass || 0, (v) => (n.mass = max(0, v) || undefined), { dec: 0 })));
      return card(`Node ${s.i + 1}${sp ? ' · ' + (S.SUP_NAMES[sp.type] || sp.type) : ''}`, ...kids, h('div', { class: 'row' }, F.btn('Delete node', () => { push(); delNode(model(), s.i); st.sel = null; commit(); }, 'danger', 'i-trash')));
    }
    if (s.k === 'm' && m.members[s.i]) {
      const mm = m.members[s.i], p = S.props(mm), rel = (k, e) => h('button', { class: 'relbtn' + (mm[k + e] || (k === 'r' && mm.type === 'truss') ? ' on' : ''), type: 'button', disabled: mm.type === 'truss' ? true : null, onclick: () => { push(); mm[k + e] = !mm[k + e]; commit(); } }, { r: 'M', v: 'Q', n: 'N' }[k] + ' = 0');
      return card(`Member ${s.i + 1} · ${fmt(S.geo(m, s.i).L)} m`,
        h('div', { class: 'icorow' }, icoTog('i-st-beam', 'Beam: bending, shear and axial force', mm.type !== 'truss', () => { push(); mm.type = 'frame'; commit(); }), icoTog('i-st-bar', 'Truss bar: axial force only', mm.type === 'truss', () => { push(); mm.type = 'truss'; commit(); }),
          h('span', { class: 'tbsep' }), ...SIDE.map(([t, ic, tip]) => icoTog(ic, 'Add: ' + tip, false, () => { push(); m.mloads = m.mloads || []; m.mloads.push(t === 'force' ? { m: s.i, type: 'point', at: 0.5, Fy: -10 } : t === 'moment' ? { m: s.i, type: 'moment', at: 0.5, M: 10 } : t === 'qload' ? { m: s.i, q1: -10 } : t === 'trap' ? { m: s.i, q1: 0, q2: -10 } : { m: s.i, type: 'temp', dT: 0, dTM: 20 }); st.sel = { k: 'ml', i: m.mloads.length - 1 }; commit(); }))),
        mm.type !== 'truss' ? h('div', { class: 'stkv', style: 'margin:6px 0' }, h('span', { class: 'k' }, `start (node ${mm.a + 1})`), h('div', { class: 'stchips' }, rel('r', 'a'), rel('v', 'a'), rel('n', 'a')), h('span', { class: 'k' }, `end (node ${mm.b + 1})`), h('div', { class: 'stchips' }, rel('r', 'b'), rel('v', 'b'), rel('n', 'b'))) : null,
        (() => { const s1 = h('select', { class: 'select sm' }, ...Object.entries(S.SECS).map(([k, q]) => h('option', { value: k, selected: k === mm.sec ? true : null }, q.name))); s1.onchange = () => { push(); mm.sec = s1.value; delete mm.secObj; commit(); }; const s2 = h('select', { class: 'select sm' }, ...Object.entries(S.MATS).map(([k, q]) => h('option', { value: k, selected: k === mm.mat ? true : null }, q.name))); s2.onchange = () => { push(); mm.mat = s2.value; commit(); }; return h('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' }, s1, s2); })(),
        eqn(`A = ${p.sec.A} cm², I = ${p.sec.I} cm⁴, W = ${p.sec.W} cm³, h = ${p.sec.h} mm<br>E = ${p.mat.E} GPa → EA = ${fmt(p.EA, 0)} kN, EI = ${fmt(p.EI, 1)} kN·m²`),
        h('div', { class: 'row' }, F.btn('Delete member', () => { push(); delMember(m, s.i); dropOrphans(m); st.sel = null; commit(); }, 'danger', 'i-trash')));
    }
    if (s.k === 'ml' && m.mloads && m.mloads[s.i]) {
      const ld = m.mloads[s.i], del = h('div', { class: 'row' }, F.btn('Delete load', () => { push(); m.mloads.splice(s.i, 1); st.sel = null; commit(); }, 'danger', 'i-trash')), L = S.geo(m, ld.m).L, atF = field('at x [m]', () => (ld.at == null ? 0.5 : ld.at) * L, (v) => (ld.at = max(0, min(1, v / L))));
      if (ld.type === 'point') return card(`Point force on member ${ld.m + 1}`, h('div', { class: 'stfields n3' }, field('F_x [kN]', () => ld.Fx || 0, (v) => (ld.Fx = v)), field('F_y [kN]', () => ld.Fy || 0, (v) => (ld.Fy = v)), atF), del);
      if (ld.type === 'moment') return card(`Couple on member ${ld.m + 1}`, h('div', { class: 'stfields' }, field('M [kN·m], ccw +', () => ld.M || 0, (v) => (ld.M = v)), atF), del);
      if (ld.type === 'temp') return card(`Temperature on member ${ld.m + 1}`, h('div', { class: 'stfields' }, field('ΔT uniform [K]', () => ld.dT || 0, (v) => (ld.dT = v)), field('T<sub>u</sub> − T<sub>o</sub> [K]', () => ld.dTM || 0, (v) => (ld.dTM = v))), eqn(`α = ${S.props(m.members[ld.m]).alpha} 1/K · ε<sub>T</sub> = αΔT, κ<sub>T</sub> = α(T<sub>u</sub> − T<sub>o</sub>)/h`), del);
      if (ld.type === 'disl') return null;
      return card(`Line load on member ${ld.m + 1}`, h('div', { class: 'stfields' }, field('q start [kN/m]', () => ld.q1 || 0, (v) => (ld.q1 = v)), field('q end [kN/m]', () => (ld.q2 == null ? ld.q1 || 0 : ld.q2), (v) => (ld.q2 = v))),
        h('div', { class: 'stchips' }, ...[['gy', 'vertical'], ['proj', 'per horizontal length'], ['local', 'normal to the member'], ['gx', 'horizontal']].map(([k, l]) => h('button', { class: 'relbtn' + ((ld.dir || 'gy') === k ? ' on' : ''), type: 'button', onclick: () => { push(); ld.dir = k; commit(); } }, l))), del);
    }
    if (s.k === 'nl' && m.nloads && m.nloads[s.i]) { const ld = m.nloads[s.i]; return card(`Load at node ${ld.n + 1}`, h('div', { class: 'stfields n3' }, field('F_x [kN]', () => ld.Fx || 0, (v) => (ld.Fx = v)), field('F_y [kN]', () => ld.Fy || 0, (v) => (ld.Fy = v)), field('M [kN·m]', () => ld.M || 0, (v) => (ld.M = v))), h('div', { class: 'row' }, F.btn('Delete load', () => { push(); m.nloads.splice(s.i, 1); st.sel = null; commit(); }, 'danger', 'i-trash'))); }
    return null;
  }
  /* reactions, extremes and the checks */
  function resultsCard() {
    const m = model(), r = st.res, dt = st.det, id = st.L.sceneId; if (!r) return card('Results', h('p', { class: 'note' }, 'Draw a member: pick the beam icon and drag.'));
    if (!r.ok) return card('Results', h('p', { class: 'note', style: 'color:var(--load)' }, r.err), dt ? eqn(`n = a + z − e = ${dt.a} + ${dt.z} − ${dt.e} = ${dt.n}${dt.n >= 0 ? ' (the count is fine, the arrangement is not)' : ''}`) : null, h('p', { class: 'note' }, 'The orange line shows how it can move. Add a support or remove a hinge.'));
    const k = kind(), w = vws(); let Rv = r.R, dms = r.members; if (k === 'kgv' && st.vwr && !st.vwr.err) { Rv = st.vwr.R; dms = st.vwr.members; } else if (k === 'pvk' && st.vwr && !st.vwr.err) { Rv = st.vwr.r0.R; dms = st.vwr.r0.members; }
    const rows = (m.supports || []).map((sp, i) => { const j = 3 * sp.n; return `<tr><td><b>${LET(i)}</b> <span class="dim">n${sp.n + 1}</span></td><td class="c">${fmt(Rv[j])}</td><td class="c">${fmt(Rv[j + 1])}</td><td class="c">${S.supFix(sp)[2] || sp.kr ? fmt(Rv[j + 2]) : ''}</td></tr>`; }).join('');
    const ext = (key) => { let b = [0, 0, 0]; dms.forEach((d, i) => { const f = KEYOF[key]; d[f].forEach((v2, kk) => { if (abs(v2) > abs(b[0])) b = [v2, i, d.x[kk]]; }); }); return b; };
    const allTruss = m.members.every((q) => q.type === 'truss'), ex = (allTruss ? ['N'] : ['M', 'Q', 'N']).map((q) => { const [v2, i, x] = ext(q); return `<tr><td class="mq" style="--c:var(--${CV[q]})">${q}<sub>max</sub></td><td class="c">${fmt(v2)} ${UNIT[q]}</td><td class="dim">member ${i + 1}, x = ${fmt(x)} m</td></tr>`; }).join('');
    let wm = [0, 0, 0]; dms.forEach((d, i) => d.w.forEach((v2, kk) => { if (abs(v2) > abs(wm[0])) wm = [v2, i, d.x[kk]]; }));
    const kids = [h('div', { html: `<table class="sttab"><tr><th>support</th><th class="c">H [kN]</th><th class="c">V [kN]</th><th class="c">M [kN·m]</th></tr>${rows}</table><table class="sttab">${ex}<tr><td class="mq" style="--c:var(--plot5)">w<sub>max</sub></td><td class="c">${fmt(wm[0] * 1000)} mm</td><td class="dim">member ${wm[1] + 1}, x = ${fmt(wm[2])} m</td></tr></table>` })];
    // global equilibrium (ΣH, ΣV, ΣM about node 1)
    if (k !== 'kgv' || !w.state || w.state === 'sum') {
      let fx = 0, fy = 0, mz = 0; const O = m.nodes[0], res0 = k === 'pvk' && st.vwr && !st.vwr.err ? st.vwr.r0 : r;
      for (const ld of m.nloads || []) { const n = m.nodes[ld.n]; fx += ld.Fx || 0; fy += ld.Fy || 0; mz += (ld.M || 0) + (n.x - O.x) * (ld.Fy || 0) - (n.y - O.y) * (ld.Fx || 0); }
      for (const e of res0.el) { const L = e.g.L, A = m.nodes[e.m.a], N2 = 60; for (let q = 0; q < N2; q++) { const x = ((q + 0.5) / N2) * L, qq = [0, 0]; for (const d of e.ml.dist) { qq[0] += d.x1 + ((d.x2 - d.x1) * x) / L; qq[1] += d.y1 + ((d.y2 - d.y1) * x) / L; } const gx = (e.g.c * qq[0] - e.g.s * qq[1]) * (L / N2), gy = (e.g.s * qq[0] + e.g.c * qq[1]) * (L / N2), px = A.x + e.g.c * x, py = A.y + e.g.s * x; fx += gx; fy += gy; mz += (px - O.x) * gy - (py - O.y) * gx; }
        for (const p of e.ml.pts) { const gx = e.g.c * p.Px - e.g.s * p.Py, gy = e.g.s * p.Px + e.g.c * p.Py, px = A.x + e.g.c * p.a, py = A.y + e.g.s * p.a; fx += gx; fy += gy; mz += (px - O.x) * gy - (py - O.y) * gx; } for (const q of e.ml.mom) mz += q.M; }
      let rx = 0, ry = 0, rm = 0; for (const sp of m.supports || []) { const n = m.nodes[sp.n], i = 3 * sp.n; rx += Rv[i]; ry += Rv[i + 1]; rm += Rv[i + 2] + (n.x - O.x) * Rv[i + 1] - (n.y - O.y) * Rv[i]; }
      kids.push(h('details', {}, h('summary', {}, 'Equilibrium check'), eqn(`ΣH: ${fmt(fx)} + ${fmt(rx)} = ${fmt(fx + rx, 6)} kN<br>ΣV: ${fmt(fy)} + ${fmt(ry)} = ${fmt(fy + ry, 6)} kN<br>ΣM<sub>(node 1)</sub>: ${fmt(mz)} + ${fmt(rm)} = ${fmt(mz + rm, 6)} kN·m`)));
    }
    if (CHECK[id] && k === 'edit') { try { const ch = CHECK[id](r, m); kids.push(h('details', { open: true }, h('summary', {}, 'Closed-form check'), h('div', { html: `<table class="sttab"><tr><th>formula</th><th class="c">exact</th><th class="c">computed</th></tr>${ch.map(([l, ex2, cp]) => `<tr><td>${l}</td><td class="c">${fmt(ex2, 3)}</td><td class="c"><b>${fmt(cp, 3)}</b></td></tr>`).join('')}</table>` }))); } catch (e) { /* edited away from the preset */ } }
    if (k === 'edit' || k === 'pvk') { const mr = r.members.map((d, i) => { const mm = m.members[i], p = S.props(mm), buck = d.comp < -1e-6 ? abs(d.comp) / d.Ncr : 0; return `<tr><td>${i + 1}</td><td>${p.sec.name}<br><span class="dim">${p.mat.name}</span></td><td class="c">${fmt(d.sigma, 0)}</td><td class="c">${(100 * d.util).toFixed(0)} %${buck > 0 ? `<br><span class="${buck > 1 ? 'bad' : 'dim'}">buckling ${(100 * buck).toFixed(0)} %</span>` : ''}</td></tr>`; }).join(''); kids.push(h('details', {}, h('summary', {}, 'Stresses and buckling'), h('div', { html: `<table class="sttab"><tr><th>#</th><th>section</th><th class="c">σ<sub>max</sub> MPa</th><th class="c">use</th></tr>${mr}</table><p class="note">σ = |N|/A + |M|/W at the worst section, "use" = σ/f<sub>y</sub>; buckling |N|/N<sub>cr</sub>, N<sub>cr</sub> = π²EI/L².</p>` }))); }
    if (dt) kids.push(h('details', {}, h('summary', {}, 'Determinacy'), eqn(`n = a + z − e = ${dt.a} + ${dt.z} − ${dt.e} = <b>${dt.n}</b><br>rank of the ${dt.e} × ${dt.a + dt.z} equilibrium matrix: ${dt.rank} → ${dt.kinDeg ? `<b>${dt.kinDeg} kinematic degree(s) of freedom</b>` : dt.statDeg ? `<b>${dt.statDeg}× statically indeterminate</b>` : '<b>statically determinate</b>'}`), h('p', { class: 'note' }, 'a: support reactions; z: member forces (N, M at both ends, minus one per released end force); e: equilibrium equations at the nodes (3, or 2 where no moment can act).')));
    return card('Results', ...kids);
  }
  /* ---------- the virtual-work cards (every number of the hand calculation) ---------- */
  function structChips(sc) { const w = vws(), cur = w.struct || VWS[sc].def; return h('div', { class: 'stchips' }, ...VWS[sc].structs.map(([k, l]) => h('button', { class: 'relbtn' + (k === cur ? ' on' : ''), type: 'button', onclick: () => { w.struct = k; push(); resetModel(st.L.sceneId); st.panes[st.L.sceneId].fit = true; commit(); } }, l))); }
  const tDesc = (m, t) => (t.k === 'node' ? `node ${t.n + 1}` : `member ${t.m + 1} at x = ${fmt(t.at * S.geo(m, t.m).L)} m`);
  function pvkCard() {
    const m = model(), w = vws(), r = st.vwr, t = w.t, kids = [structChips('pvk')];
    if (!t) { kids.push(h('p', { class: 'note' }, 'Pick a point with the target tool.')); return card('Unit-load method', ...kids); }
    kids.push(h('div', { class: 'stchips' }, ...[['v', '↓ deflection'], ['h', '→ horizontal'], ['r', '↺ rotation']].map(([d, l]) => h('button', { class: 'relbtn' + (t.dir === d ? ' on' : ''), type: 'button', onclick: () => { t.dir = d; commit(); } }, l))));
    if (!r || r.err) { kids.push(h('p', { class: 'note' }, r ? r.err : '')); return card('Unit-load method', ...kids); }
    const rot = t.dir === 'r', U = rot ? 'mrad' : 'mm', f = 1000, sym = rot ? 'φ' : t.dir === 'h' ? 'u' : 'w';
    kids.push(eqn(`${sym} at ${tDesc(m, t)}: a unit ${rot ? 'couple' : 'force'} "1" there gives the virtual state M̄, N̄.`), eqn(`1 · ${sym} = Σ ∫ M̄ M / EI dx + Σ ∫ N̄ N / EA dx${r.parts.T ? ' + Σ ∫ M̄ κ<sub>T</sub> + N̄ ε<sub>T</sub> dx' : ''}${r.parts.C ? ' + Σ F̄ F / k' : ''}${r.parts.S ? ' − Σ R̄ ĉ' : ''}`));
    const lines = [];
    r.rows.forEach((row) => {
      if (row.truss) { const N0 = row.Nr[0], N1 = row.Nv[0]; lines.push(`<b>bar ${row.mi + 1}</b>: N·N̄·l/EA = ${fmt(N0)}·${fmt(N1, 3)}·${fmt(row.L)}/${fmt(row.EA, 0)} = ${fmt(row.dN * f, 4)} ${U}`); return; }
      const segs = row.kopp.filter((q) => abs(q.val) > 1e-12 || abs(q.exact) > 1e-12);
      const body = segs.map((q) => `&nbsp;&nbsp;${q.rule} with l = ${fmt(q.l)}, i = ${fmt(q.i1)}${abs(q.i2 - q.i1) > 1e-9 ? '…' + fmt(q.i2) : ''}${abs(q.f) > 1e-9 ? `, f = ${fmt(q.f)}` : ''}, k = ${fmt(q.k1, 3)}${abs(q.k2 - q.k1) > 1e-9 ? '…' + fmt(q.k2, 3) : ''} → ${fmt(q.val, 3)}`).join('<br>');
      lines.push(`<b>member ${row.mi + 1}</b> (EI = ${fmt(row.EI, 1)} kN·m²): ∫M̄M dx = ${fmt(row.MM, 3)} → /EI = <b>${fmt(row.dM * f, 4)} ${U}</b>${body ? '<br>' + body : ''}${abs(row.dN) > 1e-9 ? `<br>&nbsp;&nbsp;axial ∫N̄N dx/EA = ${fmt(row.dN * f, 4)} ${U}` : ''}${abs(row.dT) > 1e-12 ? `<br>&nbsp;&nbsp;temperature = ${fmt(row.dT * f, 4)} ${U}` : ''}`);
    });
    kids.push(h('div', { class: 'eqn', html: lines.join('<br>') }));
    const P2 = r.parts; kids.push(eqn(`${sym} = ${fmt(P2.M * f, 4)} (M) + ${fmt(P2.N * f, 4)} (N)${P2.T ? ` + ${fmt(P2.T * f, 4)} (ΔT)` : ''}${P2.C ? ` + ${fmt(P2.C * f, 4)} (springs)` : ''}${P2.S ? ` + ${fmt(P2.S * f, 4)} (settlement)` : ''} = <b>${fmt(r.total * f, 4)} ${U}</b>`), eqn(`stiffness method: ${fmt(r.direct * f, 4)} ${U} <span class="ok">${abs(r.total - r.direct) < 1e-9 + 1e-7 * abs(r.direct) ? '✓' : ''}</span>`));
    return card('Unit-load method (PvK)', ...kids);
  }
  const relName = (m, r) => (r.k === 'sup' ? `${['H', 'V', 'M'][r.d]} at support node ${r.n + 1}` : r.k === 'hinge' ? `M at the ${r.end === 'a' ? 'start' : 'end'} of member ${r.m + 1}` : `N in bar ${r.m + 1}`);
  function kgvCard() {
    const m = model(), w = vws(), fm = st.vwr, dt = st.det, kids = [structChips('kgv')];
    if (dt) kids.push(eqn(`n = ${dt.statDeg}: ${dt.statDeg ? `${dt.statDeg} redundant${dt.statDeg > 1 ? 's' : ''} X<sub>i</sub>` : 'statically determinate'}`));
    if (!st.res || !st.res.ok || !dt || !dt.statDeg) { if (fm && fm.err) kids.push(h('p', { class: 'note' }, fm.err)); return card('Force method', ...kids); }
    const cands = VW.candidates((solvable(m)).m).filter((c) => !(c.k === 'sup' && (solvable(m)).orphans.includes(c.n))), cur = w.cur || [], keys = cur.map(VW.key);
    kids.push(eqn(cur.map((r, i) => `X${SUB(i + 1)}: ${relName(m, r)}`).join('<br>')), h('details', {}, h('summary', {}, 'Choose the released restraints'), h('div', { class: 'stchips' }, ...cands.map((c) => { const i = keys.indexOf(VW.key(c)); return h('button', { class: 'relbtn' + (i >= 0 ? ' on' : ''), type: 'button', onclick: () => { const nw = cur.slice(); if (i >= 0) nw.splice(i, 1); else nw.push(c); w.rels = nw; w.state = 'sum'; commit(); } }, (i >= 0 ? `X${SUB(i + 1)}: ` : '') + relName(m, c)); }), h('button', { class: 'relbtn', type: 'button', onclick: () => { w.rels = null; w.state = 'sum'; commit(); } }, 'auto'))));
    if (!fm || fm.err) { kids.push(h('p', { class: 'note', style: 'color:var(--load)' }, fm ? fm.err : '')); if (fm && fm.det) kids.push(eqn(`primary system: n = ${fm.det.statDeg}, ${fm.det.kinDeg ? 'kinematic' : 'stable'}`)); return card('Force method', ...kids); }
    const n = fm.X.length, sts = ['sum', ...Array.from({ length: n + 1 }, (_, i) => i)];
    kids.push(h('div', { class: 'stchips' }, ...sts.map((s) => h('button', { class: 'relbtn' + ((w.state == null ? 'sum' : w.state) === s ? ' on' : ''), type: 'button', onclick: () => { w.state = s; save(); buildPanels(st.L); } }, s === 'sum' ? 'final M' : s === 0 ? 'state 0: loads' : `state ${s}: X${SUB(s)} = 1`))));
    if (fm.det.statDeg) kids.push(h('p', { class: 'note', style: 'color:var(--warn)' }, `The primary system is still ${fm.det.statDeg}× indeterminate; the method still works, but by hand you would release more.`));
    const lines = [], u = 'm/kN';
    const flexRows = (sa, sb) => sa.el.map((e, j) => { if (e.m.type === 'truss') { const Na = sa.members[j].N[0], Nb = sb.members[j].N[0]; return abs(Na * Nb) > 1e-12 ? `&nbsp;&nbsp;bar ${j + 1}: ${fmt(Na, 3)}·${fmt(Nb, 3)}·${fmt(e.g.L)}/EA` : ''; } const rows = VW.koppRows(sb.el[j], sb.members[j], e, sa.members[j]).filter((q) => abs(q.val) > 1e-12); return rows.length ? `&nbsp;&nbsp;member ${j + 1} (EI ${fmt(e.p.EI, 0)}): ` + rows.map((q) => `${q.rule} = ${fmt(q.val, 3)}`).join(' + ') : ''; }).filter(Boolean).join('<br>');
    for (let i = 0; i < n; i++) for (let k2 = i; k2 < n; k2++) lines.push(`δ${SUB(i + 1)}${SUB(k2 + 1)} = Σ∫M${SUB(i + 1)}M${SUB(k2 + 1)}/EI dx + Σ∫N${SUB(i + 1)}N${SUB(k2 + 1)}/EA dx = <b>${fmtE(fm.D[i][k2])}</b> ${u}`);
    for (let i = 0; i < n; i++) lines.push(`δ${SUB(i + 1)}${SUB(0)} = Σ∫M${SUB(i + 1)}M${SUB(0)}/EI dx + … = <b>${fmtE(fm.d0[i])}</b> m`);
    kids.push(h('div', { class: 'eqn', html: lines.join('<br>') }));
    kids.push(h('details', {}, h('summary', {}, 'Product integrals by table'), h('div', { class: 'eqn', html: Array.from({ length: n }, (_, i) => `<b>δ${SUB(i + 1)}${SUB(0)}</b><br>${flexRows(fm.si[i], fm.s0)}<br><b>δ${SUB(i + 1)}${SUB(i + 1)}</b><br>${flexRows(fm.si[i], fm.si[i])}`).join('<br>') })));
    if (n === 1) kids.push(eqn(`δ₁₀ + X₁ δ₁₁ = ${fmt(fm.rhs[0] + fm.d0[0], 6) !== '0.000000' ? 'ĉ' : '0'} ⇒ X₁ = ${fm.rhs[0] + fm.d0[0] ? `(${fmtE(fm.rhs[0] + fm.d0[0])} − (${fmtE(fm.d0[0])}))` : `−(${fmtE(fm.d0[0])})`} / ${fmtE(fm.D[0][0])} = <b>${fmt(fm.X[0], 4)}</b> ${fm.primary && w.cur[0].k === 'sup' && w.cur[0].d === 2 ? 'kN·m' : w.cur[0].k === 'hinge' ? 'kN·m' : 'kN'}`));
    else kids.push(eqn(`[δ<sub>ik</sub>] · X = ĉ − δ<sub>i0</sub> ⇒ ${fm.X.map((x, i) => `X${SUB(i + 1)} = <b>${fmt(x, 4)}</b>`).join(', ')}`));
    kids.push(eqn(`M = M₀ + ${fm.X.map((_, i) => `X${SUB(i + 1)}·M${SUB(i + 1)}`).join(' + ')} · check against the stiffness method: max |Δ| = ${fmtE(fm.dev)} <span class="ok">${fm.dev < 1e-6 ? '✓' : ''}</span>`));
    return card('Force method (Kraftgrößenverfahren)', ...kids);
  }
  const tName = (m, t) => (!t ? '' : t.k === 'sup' ? `${['H', 'V', 'M'][t.d]}${SUB(t.n + 1)}` : `${t.k === 'V' ? 'Q' : t.k}(${fmt(t.at * S.geo(m, t.m).L)} m on ${t.m + 1})`);
  function pvvCard() {
    const m = model(), w = vws(), il = st.vwr, t = w.t, kids = [structChips('pvv')];
    kids.push(h('div', { class: 'stchips' }, ...[['M', 'M'], ['V', 'Q'], ['N', 'N']].map(([q, l]) => h('button', { class: 'relbtn' + ((t && t.k === q) || (!t && (w.q || 'M') === q) ? ' on' : ''), type: 'button', onclick: () => { w.q = q; if (t && t.k !== 'sup') t.k = q; else if (t && t.k === 'sup') w.t = { k: q, m: 0, at: 0.5 }; commit(); } }, `section ${l}`)),
      ...(m.supports || []).flatMap((sp) => [0, 1, 2].filter((d) => S.supFix(sp)[d]).map((d) => h('button', { class: 'relbtn' + (t && t.k === 'sup' && t.n === sp.n && t.d === d ? ' on' : ''), type: 'button', onclick: () => { w.t = { k: 'sup', n: sp.n, d }; commit(); } }, `${['H', 'V', 'M'][d]} at node ${sp.n + 1}`)))));
    if (!t) { kids.push(h('p', { class: 'note' }, 'Tap a section or a support with the target tool.')); return card('Virtual displacements', ...kids); }
    if (!il || il.err) { kids.push(h('p', { class: 'note' }, il ? il.err : '')); return card('Virtual displacements', ...kids); }
    const what = t.k === 'sup' ? `the reaction ${['H', 'V', 'M'][t.d]} at node ${t.n + 1}` : `${t.k === 'V' ? 'Q' : t.k} at x = ${fmt(t.at * S.geo(m, t.m).L)} m on member ${t.m + 1}`;
    kids.push(eqn(`Influence line of ${what}: release it and impose ${t.k === 'M' ? 'a kink Δφ = 1' : t.k === 'V' ? 'a jump Δw = 1 (parallel sides)' : t.k === 'N' ? 'an axial gap Δu = 1' : 'a unit displacement'} against its positive sense.`),
      eqn(il.rigid ? 'Statically determinate: the released system is a kinematic chain; the figure is made of straight lines, each body turning about its pole (numbers on the drawing).' : 'Statically indeterminate: the structure bends to close the dislocation, so the figure is curved (Müller-Breslau).'),
      eqn(`PvV: ${tName(m, t)} · (−1) + Σ P·δ = 0 ⇒ ${tName(m, t)} = Σ P·η + ∫ q·η dx, η = downward ordinate`));
    const pl = il.parts.map((q) => `${q.label}: ${fmt(q.val, 3)}`).join('<br>');
    kids.push(h('div', { class: 'eqn', html: pl }), eqn(`Σ = <b>${fmt(il.Sw, 3)}</b> · stiffness method ${fmt(il.Sd, 3)} <span class="ok">${il.Sd != null && abs(il.Sw - il.Sd) < 1e-6 * max(1, abs(il.Sd)) ? '✓' : ''}</span>`));
    if (il.poles) kids.push(h('details', {}, h('summary', {}, 'Pole plan'), eqn(il.poles.bodies.map((b) => `body ${b.id}: main pole ${b.pole.inf ? 'at infinity (translation)' : `(${fmt(b.pole.x)}, ${fmt(b.pole.y)}) m`}`).concat(il.poles.rel.map((q) => `relative pole (${q.i},${q.j}): ${q.pole.inf ? 'at infinity' : `(${fmt(q.pole.x)}, ${fmt(q.pole.y)}) m`}`)).join('<br>')), h('p', { class: 'note' }, 'Main pole of a body, the relative pole of two bodies and the main pole of the other lie on one line.')));
    return card('Virtual displacements (PvV)', ...kids);
  }

  /* ---------------- derivations ---------------- */
  const EAr = 210e6 * 3.142e-4, Lb = 2.5, kE = EAr / Lb, v3 = -10 / (0.72 * kE);
  const STEPS = [
    { t: 'The problem', f: ['K u = F'], say: 'Two bars of a Ø20 steel rod (EA = 65 982 kN) meet at node 3 and carry P = 10 kN. Nodes 1 and 2 are pinned. The computer sets up K u = F: stiffness times displacements equals loads.' },
    { t: 'One bar along its own axis', f: ['N =', D.fr('EA', 'L'), 'Δ', ',', 'k =', D.fr('EA', 'L'), D.mat([['1', '−1'], ['−1', '1']])], say: 'Hooke for a bar: the axial force is EA/L times the elongation Δ = u₂ − u₁. The end forces (−N, +N) give the 2×2 element matrix.' },
    { t: 'Turned by an angle α', f: ['Δ = c (u_2 − u_1) + s (v_2 − v_1)', ',', 'c = cos α', ',', 's = sin α'], say: 'In the global frame each end moves (u, v); only the part along the bar stretches it.' },
    { t: 'Element matrix in global axes', f: ['k_e =', D.fr('EA', 'L'), D.mat([['c^2', 'cs', '−c^2', '−cs'], ['cs', 's^2', '−cs', '−s^2'], ['−c^2', '−cs', 'c^2', 'cs'], ['−cs', '−s^2', 'cs', 's^2']])], say: 'k_e = Tᵀ k T with T = [c s 0 0; 0 0 c s]. Rows and columns belong to (u₁, v₁, u₂, v₂).' },
    { t: 'Bar 1 (node 1 → 3): c = 0.8, s = 0.6', f: ['k_1 =', D.fr('EA', 'L'), D.mat([['…', '…', '…'], ['…', '0.64@a1', '0.48@b1'], ['…', '0.48@c1', '0.36@d1']])], say: 'Only the block of node 3 will survive the supports. EA/L = 26 393 kN/m for both bars (L = 2.5 m).' },
    { t: 'Bar 2 (node 2 → 3): c = −0.8, s = 0.6', f: ['k_2 =', D.fr('EA', 'L'), D.mat([['…', '…', '…'], ['…', '0.64@a2', '−0.48@b2'], ['…', '−0.48@c2', '0.36@d2']])], say: 'The sign of c flips the coupling terms cs.' },
    { t: 'Assembly: add the blocks of node 3', f: ['K =', D.fr('EA', 'L'), D.mat([[['0.64@a1', '+', '0.64@a2'], ['0.48@b1', '−', '0.48@b2']], [['0.48@c1', '−', '0.48@c2'], ['0.36@d1', '+', '0.36@d2']]])], say: 'Every element adds its entries where its degrees of freedom sit in the global list. Supported degrees of freedom are struck out.' },
    { t: 'The reduced system', f: [D.fr('EA', 'L'), D.mat([['1.28', '0'], ['0', '0.72']]), D.mat([['u_3'], ['v_3']]), '=', D.mat([['0'], ['−10']])], say: 'Two equations for the two unknown displacements of node 3; the right side is the load.' },
    { t: 'Solve', f: ['u_3 = 0', ',', 'v_3 = −10 / (0.72 · 26 393) =', D.b(`${(v3 * 1000).toFixed(3)} mm`)], say: 'Symmetry makes u₃ zero; the node drops by about half a millimetre.' },
    { t: 'Bar forces', f: ['N_1 =', D.fr('EA', 'L'), '(c u_3 + s v_3) = 26 393 · 0.6 · v_3 =', D.b('−8.333 kN')], say: 'Back in each bar: the elongation along the bar times EA/L. Negative: both bars are struts in compression.' },
    { t: 'Check by the method of joints', f: ['2 N sin α + P = 0', '⇒', 'N = −', D.fr('P', '2 sin α'), '=', D.b('−8.333 kN')], say: 'Equilibrium at node 3 alone gives the same force. The stiffness method needs no such insight, which is why it also solves indeterminate structures.' },
  ];
  function paintStiff(c, W, H, k, p) {
    const s = min(W / 6.2, (H - 40) / 3.2), ox = W / 2 - 2 * s, oy = H * 0.68, X = (x) => ox + x * s, Y = (y) => oy - y * s;
    const nodes = [[0, 0], [4, 0], [2, 1.5]], dy = k >= 8 ? v3 * (k === 8 ? p : 1) * 600 : 0, n3 = [2, 1.5 + dy], colr = (i) => (k >= 9 ? tk('accent') : k === 4 && i === 0 ? tk('warn') : k === 5 && i === 1 ? tk('warn') : tk('ink'));
    c.lineWidth = 3; [[0, n3], [1, n3]].forEach(([i, b], j) => { c.strokeStyle = colr(j); R.line(c, X(nodes[i][0]), Y(nodes[i][1]), X(b[0]), Y(b[1])); });
    if (k >= 8) { c.strokeStyle = tk('ink-3'); c.lineWidth = 1; c.setLineDash([4, 4]); R.line(c, X(0), Y(0), X(2), Y(1.5)); R.line(c, X(4), Y(0), X(2), Y(1.5)); c.setLineDash([]); R.mono(c, 'displacement ×600', X(2) + 12, Y(1.5) + 20, 11, tk('ink-2')); }
    for (const [i, n] of [[0, nodes[0]], [1, nodes[1]]]) { drawSupport(c, X(n[0]), Y(n[1]), { type: 'pin' }, 0, 11.5); R.mono(c, `${i + 1}`, X(n[0]) - 16, Y(n[1]) - 10, 12, tk('ink-2')); }
    c.strokeStyle = tk('ink'); c.lineWidth = 1.4; R.ring(c, X(n3[0]), Y(n3[1]), 4.5, k >= 6 && k <= 8 ? tk('warn') : tk('paper')); R.mono(c, '3', X(n3[0]) + 10, Y(n3[1]) - 14, 12, tk('ink-2'));
    c.strokeStyle = c.fillStyle = tk('ink'); c.lineWidth = 2.4; R.arrow(c, X(n3[0]), Y(n3[1]) - 60, X(n3[0]), Y(n3[1]) - 6, 11); R.mono(c, 'P = 10 kN', X(n3[0]) + 8, Y(n3[1]) - 54, 11, tk('ink'));
    if (k === 1 || k === 2) { const a = Math.atan2(1.5, 2), mx = X(1), my = Y(0.75); c.strokeStyle = tk('warn'); c.lineWidth = 1.4; c.beginPath(); c.arc(X(0), Y(0), 40, 0, -a, true); c.stroke(); R.mono(c, 'α', X(0) + 48, Y(0) - 12, 13, tk('warn')); R.mono(c, 'x local', mx + 10, my - 10, 11, tk('ink-2')); }
    if (k >= 9) { R.mono(c, 'N = −8.33 kN', X(1) - 60, Y(0.75), 12, tk('accent'), 'right'); R.mono(c, 'N = −8.33 kN', X(3) + 60, Y(0.75), 12, tk('accent')); }
  }
  /* the principle of virtual work, from equilibrium to the unit-load method and the force method */
  const PSTEPS = [
    { t: 'Equilibrium of a slice dx', f: ['dQ/dx = −q', ',', 'dM/dx = Q', '⇒', 'M″ + q = 0'], say: 'Cut a slice dx out of a loaded beam (q downwards, w downwards): the vertical forces and the moments balance. Together, the bending moment obeys M″ + q = 0 at every x.' },
    { t: 'Weight it with a virtual deflection', f: ['∫_0^l', '(', 'M″', '+', 'q', ')', 'δw', 'dx', '=', '0'], say: 'If M″ + q vanishes everywhere, so does its integral against any function δw(x). δw is a virtual deflection: imagined, small, and compatible with the supports (δw = 0 where the beam is held).' },
    { t: 'Integrate by parts twice', f: ['∫_0^l', 'M″', 'δw', 'dx', '=', '[', 'M′δw', '−', 'Mδw′', ']_0^l', '+', '∫_0^l', 'M', 'δw″', 'dx'], say: 'The two derivatives move from M onto δw and leave boundary terms: shear force times deflection and moment times slope at the ends.' },
    { t: 'The boundary terms drop out', f: ['−', '∫_0^l', 'M', 'δw″', 'dx', '=', '∫_0^l', 'q', 'δw', 'dx'], say: 'At a support δw = 0; at a free end Q = M = 0; at a hinge M = 0. With the virtual curvature δκ = −δw″, internal virtual work equals external virtual work.' },
    { t: 'Principle of virtual displacements (PvV)', f: ['∫', 'M', 'δκ', 'dx', '=', 'Σ', 'F', 'δw', '+', '∫', 'q', 'δw', 'dx'], say: 'Real forces, virtual displacements. Release one restraint of a statically determinate structure: it becomes a kinematic chain, δκ = 0 except at the release, and δW = 0 gives that one force. Drawn, the chain is the influence line.' },
    { t: 'Swap the roles: principle of virtual forces (PvK)', f: ['Σ', 'F̄', 'w', '=', '∫', 'M̄', 'κ', 'dx', ',', 'κ', '=', D.fr('M', 'EI')], say: 'Now a virtual force system that only has to be in equilibrium, and the real, compatible deformation. The same identity holds with the roles exchanged.' },
    { t: 'The unit-load method', f: ['1', '·', 'δ', '=', '∫', D.fr('M̄ M', 'EI'), 'dx', '+', '∫', D.fr('N̄ N', 'EA'), 'dx', '+', '∫', 'M̄', D.fr('α ΔT', 'h'), 'dx'], say: 'Put a single unit force (or couple) where the displacement (or rotation) is wanted. Its moment diagram M̄ weighs the real curvature; axial and thermal strains add their terms.' },
    { t: 'Product integrals by table', f: ['∫_0^l', 'M', 'M̄', 'dx', '=', D.fr('l', '6'), '[', 'i_1', '(', '2k_1', '+', 'k_2', ')', '+', 'i_2', '(', 'k_1', '+', '2k_2', ')', ']', '+', D.fr('l', '3'), 'f', '(', 'k_1', '+', 'k_2', ')'], say: 'On each piece the real M is a trapezoid (i₁, i₂) plus a parabola of bulge f, and M̄ is a straight line (k₁, k₂). The classic table entries l·i·k, l/2·i·k, l/3·i·k, l/6·i·k and ⅔·l·f·k are its special cases.' },
    { t: 'Example: the tip of a cantilever', f: ['w_B', '=', D.fr('1', 'EI'), '·', D.fr('l', '3'), '·', '(−PL)', '·', '(−L)', '=', D.b(['P L^3', '/', '3EI'])], say: 'Real M: a triangle from −PL at the wall to 0 at the tip. Unit load at the tip: the same triangle with P = 1. Two triangles over the same length: l/3·i·k.' },
    { t: 'Statically indeterminate: the force method', f: ['δ_{10}', '+', 'X_1', 'δ_{11}', '=', '0', '⇒', 'X_1', '=', '−', D.fr('δ_{10}', 'δ_{11}')], say: 'Release one restraint (the prop of a propped cantilever): the primary system is statically determinate. The gap the loads open, δ₁₀, must be closed by the redundant X₁, whose unit value opens δ₁₁.' },
    { t: 'Propped cantilever with a line load', f: ['δ_{11}', '=', D.fr('L^3', '3EI'), ',', 'δ_{10}', '=', '−', D.fr('qL^4', '8EI'), '⇒', D.b(['X_1', '=', D.fr('3', '8'), 'qL'])], say: 'δ₁₁: triangle × triangle, L/3·L·L/EI. δ₁₀: the parabola −qx²/2 (no slope at the tip) × the triangle, L/4·(−qL²/2)·L/EI. The prop carries 3qL/8. The force-method scene does this for any structure you draw.' },
  ];
  function paintPvw(c, W, H, k, p) {
    const x0 = W * 0.12, x1 = W * 0.88, yb = H * (k >= 5 ? 0.3 : 0.42), Lp = x1 - x0, X = (t) => x0 + Lp * t, ink = tk('ink'), cv = col('V'), cm = col('M');
    const cant = k >= 8, propped = k >= 9; c.strokeStyle = ink; c.lineWidth = 4.2; R.line(c, x0, yb, x1, yb);
    if (cant) { drawSupport(c, x0, yb, { type: 'fixed' }, PI / 2, 11.5); if (propped) drawSupport(c, x1, yb, { type: 'roller' }, 0, 11.5); }
    else { drawSupport(c, x0, yb, { type: 'pin' }, 0, 11.5); drawSupport(c, x1, yb, { type: 'roller' }, 0, 11.5); }
    // loads
    c.strokeStyle = c.fillStyle = ink; c.lineWidth = 1.3;
    if (!cant || propped) { for (let i = 0; i <= 12; i++) R.arrow(c, X(i / 12), yb - 30, X(i / 12), yb - 4, 6); R.line(c, x0, yb - 30, x1, yb - 30); R.mono(c, 'q', X(0.5), yb - 40, 13, ink, 'center'); }
    else { c.lineWidth = 2.4; R.arrow(c, x1, yb - 56, x1, yb - 5, 11); R.mono(c, 'P', x1 + 8, yb - 50, 13, ink); }
    if (k === 0) { const a = X(0.47), b = X(0.53); c.save(); c.fillStyle = tk('accent-soft'); c.fillRect(a, yb - 14, b - a, 28); c.restore(); R.mono(c, 'dx', (a + b) / 2, yb + 26, 12, tk('accent'), 'center'); }
    if (k >= 1 && k <= 4) { const amp = 34 * (k === 1 ? p : 1); c.save(); c.strokeStyle = cv; c.lineWidth = 2.4; c.setLineDash([7, 5]); c.beginPath(); for (let i = 0; i <= 80; i++) { const t = i / 80, y = yb + amp * (k === 4 ? (t < 0.5 ? 2 * t : 2 - 2 * t) : sin(PI * t)); i ? c.lineTo(X(t), y) : c.moveTo(X(t), y); } c.stroke(); c.restore(); R.mono(c, k === 4 ? 'δw: a chain (hinge released)' : 'δw(x)', X(0.5), yb + amp + 18, 12, cv, 'center'); }
    // diagrams below the beam
    const yd = yb + 64, hD = min(70, H * 0.16), line = (f, colr, dash) => { c.save(); c.strokeStyle = colr; c.lineWidth = 2; if (dash) c.setLineDash(dash); c.beginPath(); for (let i = 0; i <= 80; i++) { const t = i / 80, y = yd + f(t) * hD; i ? c.lineTo(X(t), y) : c.moveTo(X(t), y); } c.stroke(); c.globalAlpha = 0.12; c.fillStyle = colr; c.lineTo(X(1), yd); c.lineTo(X(0), yd); c.closePath(); c.fill(); c.restore(); };
    if (k >= 5 && k <= 7) { c.strokeStyle = tk('ink-3'); c.lineWidth = 1; R.line(c, x0, yd, x1, yd); line((t) => 4 * t * (1 - t), cm); line((t) => (t < 0.5 ? 2 * t : 2 - 2 * t) * 0.8, cv, [6, 4]); R.mono(c, 'M (q)', X(0.18), yd + hD * 0.62 + 14, 12, cm, 'center'); R.mono(c, 'M̄ (1 at mid)', X(0.82), yd + hD * 0.5 + 16, 12, cv, 'center'); c.strokeStyle = c.fillStyle = cv; c.lineWidth = 2.4; R.arrow(c, X(0.5), yb - 66, X(0.5), yb - 34, 10); R.mono(c, '1', X(0.5) + 8, yb - 62, 13, cv); }
    if (k === 8) { c.strokeStyle = tk('ink-3'); c.lineWidth = 1; R.line(c, x0, yd, x1, yd); line((t) => -(1 - t), cm); line((t) => -(1 - t) * 0.75, cv, [6, 4]); R.mono(c, 'M = −P(L − x)', X(0.3), yd - hD - 10, 12, cm, 'center'); R.mono(c, 'M̄ = −(L − x)', X(0.62), yd - hD * 0.4 - 6, 12, cv, 'center'); }
    if (k >= 9) { c.strokeStyle = tk('ink-3'); c.lineWidth = 1; R.line(c, x0, yd, x1, yd); line((t) => -((1 - t) ** 2) * 0.9, cm); line((t) => (1 - t) * 0.7, cv, [6, 4]); R.mono(c, 'M₀ = −q(L − x)²/2', X(0.32), yd - hD * 0.6, 12, cm, 'center'); R.mono(c, 'M₁ = (L − x)', X(0.3), yd + hD * 0.62 + 12, 12, cv, 'center'); c.strokeStyle = c.fillStyle = cv; c.lineWidth = 2.6; R.arrow(c, x1 + 0, yb + 64 - 6, x1, yb + 30, 10); R.mono(c, 'X₁', x1 + 8, yb + 50, 13, cv); }
  }

  /* ---------------- theory ---------------- */
  const REFS = 'D. Gross, W. Hauger, J. Schröder, W. A. Wall, <i>Technische Mechanik 1: Statik</i> and <i>2: Elastostatik</i> (Springer) · W. B. Krätzig, R. Harte, K. Meskouris, U. Wittek, <i>Tragwerke 1 and 2</i> (Springer) · R. Dallmann, <i>Baustatik 1–3</i> (Hanser) · R. C. Hibbeler, <i>Structural Analysis</i> (Pearson) · W. McGuire, R. H. Gallagher, R. D. Ziemian, <i>Matrix Structural Analysis</i> (2nd ed., 2000) · A. K. Chopra, <i>Dynamics of Structures</i> (Pearson) · ArcelorMittal section tables';
  function theory(id) {
    const r = `<h4>Further reading</h4><p class="refs">${REFS}</p>`, sc = sceneOf(id);
    if (id === 'stiffness') return `<h3>The direct stiffness method</h3><p>Every member is a spring between its end nodes. Written in global coordinates, its stiffness matrix k_e = Tᵀ k T maps end displacements to end forces. Adding all k_e into one matrix K, striking the rows and columns of supported degrees of freedom and solving K u = F gives all displacements; back in each member, k u − f₀ gives the end forces.</p><p>For beams the element matrix comes from EI w⁗ = q with cubic (Hermite) shape functions: 12EI/L³, 6EI/L², 4EI/L and 2EI/L. Member loads become consistent nodal loads f₀ = ∫ Nᵀ q dx; a couple M at x = a gives f₀ = N′(a)ᵀ M; temperature gives end forces EAαΔT and EIκ_T. A hinge is a released end force, condensed out of the element. A singular K means a mechanism.</p>${r}`;
    if (id === 'pvwd' || sc.kind === 'pvk' || sc.kind === 'kgv' || sc.kind === 'pvv') return `<h3>The principle of virtual work</h3><p>Equilibrium M″ + q = 0, multiplied by any admissible virtual deflection δw and integrated by parts twice, becomes ∫ M δκ dx = Σ F δw + ∫ q δw dx: internal virtual work equals external virtual work. Read one way (real forces, virtual displacements) it is the <b>principle of virtual displacements</b>; read the other way (virtual forces, real deformation) it is the <b>principle of virtual forces</b>.</p>
      <ul><li><b>Unit-load method.</b> 1·δ = Σ∫ M̄M/EI dx + Σ∫ N̄N/EA dx + Σ∫ M̄ αΔT_M/h dx + Σ∫ N̄ αΔT dx + Σ F̄F/k − Σ R̄ĉ. The product integrals are done piece by piece: trapezoid (i₁, i₂) plus parabola (bulge f) times a straight line (k₁, k₂) gives l/6·[i₁(2k₁ + k₂) + i₂(k₁ + 2k₂)] + l/3·f·(k₁ + k₂).</li>
      <li><b>Force method.</b> Release n restraints so that a statically determinate primary system remains; load it (state 0) and apply each redundant as a unit pair (state i). Compatibility at every release: Σ δ_ik X_k + δ_i0 = ĉ_i, with δ_ik = Σ∫ M_iM_k/EI + N_iN_k/EA. Then M = M₀ + Σ X_i M_i. The choice of releases is free as long as the primary system stays stable; the result is the same.</li>
      <li><b>Virtual displacements and influence lines.</b> Release the force S and impose a unit dislocation against it (a kink for M, a parallel jump for Q, a gap for N, a settlement for a reaction). The displaced shape η(x) is the influence line (Land, Müller-Breslau): S = Σ P η + ∫ q η dx. For a statically determinate structure the released system is a kinematic chain; each body turns about its main pole, and the main poles of two bodies lie on one line with their relative pole.</li></ul>${r}`;
    return `<h3>Statics of plane frames and trusses</h3><p>A structure is in equilibrium when every part is: ΣF_x = 0, ΣF_y = 0, ΣM = 0 for the whole and for every cut-out piece. Cutting a member exposes the internal forces (Schnittgrößen): the normal force N (tension positive), the shear force Q and the bending moment M, positive when it stretches the dashed fibre. They obey dN/dx = −n, dQ/dx = −q and dM/dx = Q, so M peaks where Q crosses zero, has a kink under a point force and a jump at a couple.</p>
      <ul><li><b>Supports.</b> Festlager (two forces), Loslager (one force normal to its rolling plane, turnable), Einspannung (two forces and a moment), Parallelführung (a force and a moment), springs (force = stiffness × displacement). Settlements are imposed displacements.</li>
      <li><b>Hinges.</b> A moment hinge sets M = 0, a shear hinge Q = 0, a normal-force hinge N = 0 at that point; each removes one internal force.</li>
      <li><b>Determinacy.</b> n = a + z − e, with a support reactions, z member forces and e equilibrium equations at the nodes. n &lt; 0 is a mechanism, n = 0 statically determinate, n &gt; 0 indeterminate. The count can be fooled (three hinges in a line); the rank of the equilibrium matrix cannot, and decides the infobox.</li>
      <li><b>Solution.</b> The direct stiffness method solves every case, determinate or not; deflection curves come from integrating EI w″ = M + EIκ_T exactly along each member. The design check is σ = |N|/A + |M|/W against f_y and Euler buckling π²EI/L² for struts.</li>
      <li><b>Dynamics (▶).</b> M ü + C u̇ + K u = F with the loads switched on at t = 0. M holds the consistent beam masses (ρA, every member cut into four elements) and point masses; C the dampers at the supports plus 2 % stiffness-proportional damping at the first mode. Newmark's average-acceleration rule steps it in time; the first mode comes from inverse iteration, ζ₁ = φᵀCφ / (2ω₁ φᵀMφ). An undamped step load overshoots to twice the static deflection; a damped one by 1 + e^(−ζπ/√(1−ζ²)), then settles on the static solution. Dampers carry no static force.</li></ul>${r}`;
  }

  /* ---------------- lifecycle ---------------- */
  function panesFor(id) {
    if (st.panes[id]) return st.panes[id];
    const sc = sceneOf(id), P = { main: K.pane('main') };
    if (sc.kind === 'derive') { P.dom = h('div', { class: 'cpane dom' }); P.player = DV.player({ steps: id === 'stiffness' ? STEPS : PSTEPS }); P.dom.append(P.player.el); P.layout = 'lay-derive'; P.els = [P.main.el, P.dom]; }
    else { P.layout = 'lay-one statics'; P.els = [P.main.el]; makeBars(P, sc); bindEditor(P); }
    st.panes[id] = P; return P;
  }
  SU.open = function (L, id) {
    const sc = sceneOf(id); L.sceneId = sc.id; L.setTitle(sc.name); st.sel = null; st.undo = []; st.redo = []; st.pend = null; st.tool = sc.kind === 'pvk' || sc.kind === 'pvv' ? 'select' : st.tool === 'target' ? 'select' : st.tool;
    if (sc.kind !== 'derive') {
      if (VWS[sc.kind]) { const w = vws(); if (!st.models[sc.id]) { st.models[sc.id] = MODELS[w.struct || VWS[sc.kind].def](); } if (DEF_T[sc.kind] && !w.t) w.t = clone(DEF_T[sc.kind][w.struct || VWS[sc.kind].def]); }
      else if (!st.models[sc.id]) st.models[sc.id] = MODELS[sc.id]();
      if (st.lastScene !== sc.id) { const mm = st.models[sc.id]; if (mm.members.length && mm.members.every((q) => q.type === 'truss')) st.show.dg = 'N'; else if (st.show.dg === 'N' || !st.show.dg) st.show.dg = 'M'; }
    }
    if (st.lastScene !== sc.id) st.dyn.on = sc.id === 'dampers';
    st.lastScene = sc.id;
    const P = panesFor(sc.id); P.fit = true; L.setLayout(P.layout); L.clearStage(); L.stageEl.append(...P.els); if (sc.kind !== 'derive') { analyse(); if (P.sync) P.sync(); } save(); buildPanels(L); L.phoneTabs();
  };
  const KEYS = { v: 'select', n: 'node', b: 'beam', t: 'bar', f: 'force', m: 'moment', q: 'qload' };
  MB.Lab({
    id: 'statics', first: 'beam', paper: true, noSpeed: true, noPlay: true,
    init(L) { st.L = L; const s = L.store || {}; st.models = s.models || {}; st.vw = s.vw || {}; for (const k of ['values', 'snap', 'grid', 'scale', 'auto', 'labels']) if (s[k] != null) st[k] = s[k]; if (s.show) Object.assign(st.show, s.show); if (s.fixSc) st.fixSc = s.fixSc; },
    open: (L, id) => SU.open(L, id),
    frame(L, dt) { const P = st.panes[L.sceneId]; if (!st.bentBtn) { st.bentBtn = h('button', { class: 'benttog low', type: 'button', onclick: () => { st.show.D = !st.show.D; save(); const Q = st.panes[st.L.sceneId]; if (Q && Q.sync) Q.sync(); } }); L.stageEl.parentNode.append(st.bentBtn); } { const show = !!(P && P.sync), lab = st.show.D ? `Drawn bent${st.defMag ? ' ×' + fmt(st.defMag, 0) : ''} — tap for straight` : 'Drawn straight — tap to bend it'; if (st.bentBtn.hidden === show) st.bentBtn.hidden = !show; if (st.bentBtn.textContent !== lab) { st.bentBtn.textContent = lab; st.bentBtn.classList.toggle('on', !!st.show.D); } } if (P) { try { drawScene(dt, P); } catch (e) { console.error(e); } } },
    key(L, e) {
      const P = st.panes[L.sceneId]; if (!P || !P.sync) return; const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; } if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (k === 'escape') { st.pend = null; setTool(P, 'select'); return; }
      if ((k === 'delete' || k === 'backspace') && st.sel) { const m = model(), s = st.sel; push(); if (s.k === 'n') delNode(m, s.i); else if (s.k === 'm') { delMember(m, s.i); dropOrphans(m); } else if (s.k === 'nl') m.nloads.splice(s.i, 1); else if (s.k === 'ml') m.mloads.splice(s.i, 1); st.sel = null; commit(); return; }
      if (KEYS[k]) { st.tool = KEYS[k]; st.pend = null; P.sync(); }
    },
  });
  Object.assign(SU, { MODELS, CHECK, analyse, STEPS, PSTEPS, SCENES });
})(typeof window !== 'undefined' ? window : globalThis);
