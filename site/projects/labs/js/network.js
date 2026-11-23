/* Dynamic Interactive Labs — spring–damper networks in any series/parallel arrangement.

   A network is a tree: { t: 'k', v } spring, { t: 'c', v } damper, { t: 's', items } series, { t: 'p', items } parallel.
   Its law between elongation x and force F (tension positive) is linear: F(s) = Z(s) X(s) with the dynamic stiffness
     spring Z = k,  damper Z = c s,  parallel Z = Z₁ + Z₂,  series 1/Z = 1/Z₁ + 1/Z₂.
   Every such network behaves exactly like a generalized Maxwell (Wiechert) model
     Z(s) = c∞ s + k₀ + Σᵢ kᵢ τᵢ s / (1 + τᵢ s)
   (a dashpot c∞, a spring k₀ and Maxwell arms kᵢ — cᵢ = kᵢτᵢ, all in parallel). Parallel connection just collects terms.
   For a series connection the relaxation times are the zeros of the compliance sum Y(σ) = Σ 1/Zⱼ(σ) on the negative real
   axis. Y decreases between its poles (the zeros of the Zⱼ), so each zero is bracketed and found by bisection; the arm
   stiffness follows from the residue, kᵢ = 1/(pᵢ Y′(pᵢ)) with pᵢ = −1/τᵢ. No polynomial roots, no cancellation trouble. */
(function (G) {
  'use strict';
  const MB = G.MB;
  const { abs, max, min } = Math;
  const N = (MB.Net = {});

  const ZERO = () => ({ cinf: 0, k0: 0, arms: [] });
  const isZero = (g) => !(g.cinf > 0) && !(g.k0 > 0) && !g.arms.length;
  /* value of Z on the real axis (σ may sit exactly on a pole: then ±Infinity) */
  N.Z = (g, s) => { let z = g.cinf * s + g.k0; for (const a of g.arms) z += (a.k * a.tau * s) / (1 + a.tau * s); return z; };
  N.dZ = (g, s) => { let d = g.cinf; for (const a of g.arms) { const q = 1 + a.tau * s; d += (a.k * a.tau) / (q * q); } return d; };
  const glassy = (g) => g.k0 + g.arms.reduce((s, a) => s + a.k, 0);
  function tidy(g) {
    // merge arms with equal relaxation times, drop vanishing ones, sort by τ
    const arms = g.arms.filter((a) => a.k > 0 && a.tau > 0 && isFinite(a.k) && isFinite(a.tau)).sort((a, b) => a.tau - b.tau), out = [];
    for (const a of arms) { const l = out[out.length - 1]; if (l && abs(l.tau - a.tau) <= 1e-9 * a.tau) l.k += a.k; else out.push({ k: a.k, tau: a.tau }); }
    const scale = max(g.k0, glassy({ k0: 0, arms: out }), 1e-300);
    return { cinf: g.cinf, k0: g.k0, arms: out.filter((a) => a.k > 1e-12 * scale) };
  }
  function bisect(f, a, b, fa) {
    // f(a) has sign fa, f(b) the opposite; returns the crossing
    for (let i = 0; i < 200; i++) {
      const m = 0.5 * (a + b); if (m === a || m === b) break;
      const v = f(m); if (v === 0) return m;
      if ((v > 0) === (fa > 0)) a = m; else b = m;
    }
    return 0.5 * (a + b);
  }
  const leftBracket = (f, p, wantPos) => { let d = max(abs(p), 1e-6); for (let i = 0; i < 400; i++) { const x = p - d; const v = f(x); if (wantPos ? v > 0 : v < 0) return x; d *= 2; } return null; };
  /* zeros of a generalized Maxwell function on (−∞, 0] */
  function zerosOf(g) {
    const Zf = (s) => N.Z(g, s), P = g.arms.map((a) => -1 / a.tau).sort((a, b) => a - b), out = [];
    if (!P.length) { if (g.cinf > 0) out.push(-g.k0 / g.cinf); return out; }
    // left of the most negative pole: Z rises from −∞ (a dashpot dominates) to +∞
    if (g.cinf > 0) { const x = leftBracket(Zf, P[0], false); if (x != null) out.push(bisect(Zf, x, P[0], -1)); }
    for (let i = 0; i + 1 < P.length; i++) out.push(bisect(Zf, P[i], P[i + 1], -1));
    if (g.k0 > 0) out.push(bisect(Zf, P[P.length - 1], 0, -1)); else out.push(0);
    return out;
  }
  function parallelOf(kids) { const g = ZERO(); for (const k of kids) { g.cinf += k.cinf; g.k0 += k.k0; g.arms.push(...k.arms.map((a) => ({ k: a.k, tau: a.tau }))); } return tidy(g); }
  function seriesOf(kids) {
    if (!kids.length) return ZERO();
    if (kids.some(isZero)) return ZERO();
    if (kids.length === 1) return kids[0];
    const Y = (s) => { let y = 0; for (const k of kids) y += 1 / N.Z(k, s); return y; };
    // poles of Y = zeros of the children
    const P = []; kids.forEach((k) => P.push(...zerosOf(k))); P.sort((a, b) => a - b);
    const Pu = []; for (const p of P) { const l = Pu[Pu.length - 1]; if (l == null || abs(p - l) > 1e-10 * max(abs(p), abs(l), 1e-300)) Pu.push(p); }
    const poles = [];
    if (Pu.length) {
      const Yinf = kids.reduce((s, k) => s + (k.cinf > 0 ? 0 : 1 / glassy(k)), 0);
      if (Yinf > 0) { const x = leftBracket(Y, Pu[0], true); if (x != null) poles.push(bisect(Y, x, Pu[0], 1)); }
      for (let i = 0; i + 1 < Pu.length; i++) poles.push(bisect(Y, Pu[i], Pu[i + 1], 1));
    }
    const g = { cinf: kids.every((k) => k.cinf > 0) ? 1 / kids.reduce((s, k) => s + 1 / k.cinf, 0) : 0, k0: kids.some((k) => !(k.k0 > 0)) ? 0 : 1 / kids.reduce((s, k) => s + 1 / k.k0, 0), arms: [] };
    for (const p of poles) {
      if (!(p < 0)) continue;
      // Y′(p) = −Σ Zⱼ′/Zⱼ² (analytic); a child sitting exactly on its own pole falls back to a Richardson difference
      let dY = 0; for (const c of kids) { const z = N.Z(c, p); dY -= N.dZ(c, p) / (z * z); }
      if (!isFinite(dY)) { const D = (d) => (Y(p + d) - Y(p - d)) / (2 * d), d = 1e-4 * abs(p); dY = (4 * D(d / 2) - D(d)) / 3; }
      const k = 1 / (p * dY);
      if (k > 0 && isFinite(k)) g.arms.push({ k, tau: -1 / p });
    }
    return tidy(g);
  }
  /* generalized Maxwell form of a network tree */
  N.gm = function (node) {
    if (!node) return ZERO();
    if (node.t === 'k') return { cinf: 0, k0: max(0, +node.v || 0), arms: [] };
    if (node.t === 'c') return { cinf: max(0, +node.v || 0), k0: 0, arms: [] };
    const kids = (node.items || []).map(N.gm);
    return node.t === 'p' ? parallelOf(kids.filter((k) => !isZero(k))) : seriesOf(kids);
  };
  /* direct evaluation of the tree (for checks): Z(s) at a real s > 0 */
  N.zTree = function (node, s) {
    if (node.t === 'k') return +node.v || 0;
    if (node.t === 'c') return (+node.v || 0) * s;
    const z = (node.items || []).map((n) => N.zTree(n, s));
    if (node.t === 'p') return z.reduce((a, b) => a + b, 0);
    if (z.some((v) => v === 0)) return 0;
    return 1 / z.reduce((a, b) => a + 1 / b, 0);
  };
  /* For the integrator: arms faster than about two time steps act as plain dashpots c = kτ (their low-frequency limit) */
  N.forSim = function (node, h) {
    const g = N.gm(node), fast = g.arms.filter((a) => a.tau < 2 * h);
    return { cinf: g.cinf + fast.reduce((s, a) => s + a.k * a.tau, 0), k0: g.k0, arms: g.arms.filter((a) => a.tau >= 2 * h), fast: fast.length, full: g };
  };
  N.glassy = glassy;

  /* names k1, k2, …, d1, d2, … in depth-first order (a Map, so the model itself is not touched) */
  N.labels = function (node) {
    let nk = 0, nc = 0; const L = new Map();
    const walk = (n) => { if (n.t === 'k') L.set(n, `k${++nk}`); else if (n.t === 'c') L.set(n, `d${++nc}`); else (n.items || []).forEach(walk); };
    if (node) walk(node); return L;
  };
  N.text = function (node, L, top) {
    if (node.t === 'k' || node.t === 'c') return L.get(node) || node.t;
    const it = (node.items || []).map((n) => N.text(n, L));
    const s = it.join(node.t === 's' ? ' — ' : ' ∥ ');
    return top || it.length < 2 ? s || '(empty)' : `(${s})`;
  };
  N.hasDamper = (node) => node.t === 'c' || ((node.items || []).some(N.hasDamper));
  N.count = (node) => (node.t === 'k' || node.t === 'c' ? 1 : (node.items || []).reduce((s, n) => s + N.count(n), 0));
  /* layout weights: length units along the line (w) and parallel slots across it (hgt) */
  N.size = function (node) {
    if (node.t === 'k' || node.t === 'c') return { w: 1, hgt: 1 };
    const s = (node.items || []).map(N.size);
    if (!s.length) return { w: 1, hgt: 1 };
    return node.t === 's' ? { w: s.reduce((a, b) => a + b.w, 0) + 0.2 * (s.length - 1), hgt: max(...s.map((q) => q.hgt)) } : { w: max(...s.map((q) => q.w)) + 0.4, hgt: s.reduce((a, b) => a + b.hgt, 0) };
  };

  const K = (v) => ({ t: 'k', v }), C = (v) => ({ t: 'c', v }), S = (...items) => ({ t: 's', items }), Pp = (...items) => ({ t: 'p', items });
  N.presets = [
    { id: 'kv', name: 'Kelvin–Voigt (k ∥ d)', net: () => Pp(K(200), C(4)) },
    { id: 'maxwell', name: 'Maxwell (k — d)', net: () => S(K(200), C(20)) },
    { id: 'zener', name: 'Standard linear solid, Zener (k₁ ∥ (k₂ — d))', net: () => Pp(K(100), S(K(300), C(15))) },
    { id: 'pt', name: 'Poynting–Thomson (k₁ — (k₂ ∥ d))', net: () => S(K(400), Pp(K(150), C(15))) },
    { id: 'burgers', name: 'Burgers ((k₁ — d₁) — (k₂ ∥ d₂))', net: () => S(K(300), C(60), Pp(K(150), C(10))) },
    { id: 'wiechert', name: 'Generalized Maxwell, 2 arms', net: () => Pp(K(80), S(K(200), C(4)), S(K(150), C(40))) },
    { id: 'kseries', name: 'Two springs in series', net: () => S(K(100), K(200)) },
    { id: 'kpar', name: 'Two springs in parallel', net: () => Pp(K(100), K(200)) },
    { id: 'mixed', name: 'Springs: k₁ — (k₂ ∥ k₃)', net: () => S(K(300), Pp(K(100), K(200))) },
  ];
  N.make = { K, C, S, P: Pp };
  N.clone = (n) => JSON.parse(JSON.stringify(n));
})(typeof window !== 'undefined' ? window : globalThis);
