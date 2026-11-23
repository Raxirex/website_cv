/* The Sphere: shapes pack. Polyhedra and stellations, 4D polytopes, knots, surfaces, fractals and strange attractors. */
(function (SP) {
  'use strict';
  const { TAU, GOLDEN, clamp } = SP.util;
  const PHI = (1 + Math.sqrt(5)) / 2;
  const grid = (n, f) => Array.from({ length: n }, (_, i) => f(i, n));
  const fib = (i, n) => { const y = 1 - 2 * (i + 0.5) / n, r = Math.sqrt(Math.max(0, 1 - y * y)), t = GOLDEN * i; return [Math.cos(t) * r, y, Math.sin(t) * r]; };
  const dot = (a, b) => a.reduce((s, v, k) => s + v * b[k], 0);
  const sub = (a, b) => a.map((v, k) => v - b[k]);
  const add = (a, b) => a.map((v, k) => v + b[k]);
  const mul = (a, s) => a.map((v) => v * s);
  const len = (a) => Math.sqrt(dot(a, a));
  const unit = (a) => mul(a, 1 / (len(a) || 1));
  const dist = (a, b) => len(sub(a, b));
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  // every sign combination of the non-zero entries, deduplicated
  const signs = (v) => { let out = [[]]; v.forEach((c) => { out = c ? out.flatMap((p) => [p.concat(c), p.concat(-c)]) : out.map((p) => p.concat(0)); }); return out; };
  const cyc3 = (v) => [[v[0], v[1], v[2]], [v[1], v[2], v[0]], [v[2], v[0], v[1]]];
  const uniq = (pts) => { const seen = {}, out = []; pts.forEach((p) => { const k = p.map((v) => Math.round(v * 1e6)).join(','); if (!seen[k]) { seen[k] = 1; out.push(p); } }); return out; };
  const allSigned = (bases, permute) => uniq(bases.flatMap((b) => permute(b).flatMap(signs)));
  function perms4(even) { // permutations of [0..3], optionally only the even ones
    const out = [], a = [0, 1, 2, 3];
    const rec = (k, par) => { if (k === 4) { if (!even || !par) out.push(a.slice()); return; } for (let i = k; i < 4; i++) { [a[k], a[i]] = [a[i], a[k]]; rec(k + 1, par ^ (i !== k ? 1 : 0)); [a[k], a[i]] = [a[i], a[k]]; } };
    rec(0, 0); return out;
  }
  // all pairs whose distance is within tol of the shortest one
  function nearPairs(pts, tol) {
    let min = Infinity; const out = [];
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const d = dist(pts[i], pts[j]); if (d > 1e-9 && d < min) min = d; }
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const d = dist(pts[i], pts[j]); if (d > 1e-9 && d <= min * (tol || 1.001)) out.push([i, j]); }
    return out;
  }
  // a fixed solid whose points and explicit wireframe are built together (small, so built at load)
  function fixedSolid(key, name, build) {
    const s = build();
    SP.addShape(key, { name, fixed: true, edgeList: s.edges, make: () => s.pts.map((p) => p.slice()) });
  }

  /* ---------------- Platonic bases ---------------- */
  const ICO = allSigned([[0, 1, PHI]], cyc3); // 12
  const DODE = allSigned([[1, 1, 1], [0, 1 / PHI, PHI]], cyc3); // 20
  const ICO_E = nearPairs(ICO); // 30
  const ICO_F = []; // 20 triangles
  ICO_E.forEach(([a, b]) => ICO.forEach((_, c) => { if (c > b && ICO_E.some((e) => e[0] === a && e[1] === c) && ICO_E.some((e) => e[0] === b && e[1] === c)) ICO_F.push([a, b, c]); }));
  const centroid = (ids, P) => mul(ids.reduce((s, i) => add(s, P[i]), [0, 0, 0]), 1 / ids.length);

  fixedSolid('icosahedron', 'Icosahedron', () => ({ pts: ICO, edges: ICO_E }));
  fixedSolid('dodecahedron', 'Dodecahedron', () => ({ pts: DODE, edges: nearPairs(DODE) }));
  fixedSolid('octahedron', 'Octahedron', () => { const p = allSigned([[1, 0, 0]], cyc3); return { pts: p, edges: nearPairs(p) }; });
  fixedSolid('cube', 'Cube', () => { const p = signs([1, 1, 1]); return { pts: p, edges: nearPairs(p) }; });

  // Stella octangula: 8 tips on the cube's corners, 6 valley points where the two tetrahedra's edges cross
  fixedSolid('stella_octangula', 'Stella octangula', () => {
    const tips = signs([1, 1, 1]), oct = allSigned([[1, 0, 0]], cyc3), pts = tips.concat(oct), edges = [];
    tips.forEach((t, i) => oct.forEach((o, j) => { if (dot(t, o) > 0.5) edges.push([i, 8 + j]); }));
    nearPairs(oct).forEach(([a, b]) => edges.push([8 + a, 8 + b]));
    return { pts, edges }; // 14 points, 24 spike + 12 valley edges
  });

  // Rhombic triacontahedron: 12 five-fold + 20 three-fold vertices, 60 edges, faces planar golden rhombi
  fixedSolid('rhombic_triacontahedron', 'Rhombic triacontahedron', () => {
    const [a, b] = ICO_E[0], m = unit(add(ICO[a], ICO[b])), h = dot(ICO[a], m);
    const f0 = ICO_F.find((f) => f.includes(a) && f.includes(b)), c0 = unit(centroid(f0, ICO)), s = h / dot(c0, m);
    const pts = ICO.concat(ICO_F.map((f) => mul(unit(centroid(f, ICO)), s))), edges = [];
    ICO_F.forEach((f, k) => f.forEach((v) => edges.push([v, 12 + k])));
    return { pts, edges };
  });

  // Rhombic hexecontahedron: 12 five-fold tips, 20 three-fold tips, 30 two-fold valleys, 120 edges, 60 golden rhombi
  fixedSolid('rhombic_hexecontahedron', 'Rhombic hexecontahedron', () => {
    const V = ICO.map(unit), C = ICO_F.map((f) => unit(centroid(f, ICO))), E = ICO_E.map(([a, b]) => unit(add(ICO[a], ICO[b])));
    const f = ICO_F[0], v = f[0], ia = ICO_E.findIndex((e) => e.includes(v) && e.includes(f[1])), ib = ICO_E.findIndex((e) => e.includes(v) && e.includes(f[2]));
    const geo = (r5) => { // the rhombus v, e1, c, e2 for a given five-fold radius (valleys at radius 1)
      const pv = mul(V[v], r5), e1 = E[ia], e2 = E[ib], nrm = cross(sub(e1, pv), sub(e2, pv)), r3 = dot(nrm, pv) / dot(nrm, C[0]);
      return { pv, e1, e2, pc: mul(C[0], r3), r3 };
    };
    let lo = 0.36, hi = 0.98; // make it a rhombus: |v-e1| = |c-e1| (the five-fold points sit in dimples, the three-fold ones are the spikes)
    for (let k = 0; k < 80; k++) { const mid = (lo + hi) / 2, g = geo(mid); if (dist(g.pv, g.e1) < dist(g.pc, g.e1)) lo = mid; else hi = mid; }
    const r5 = (lo + hi) / 2, r3 = geo(r5).r3;
    const pts = V.map((p) => mul(p, r5)).concat(C.map((p) => mul(p, r3)), E), edges = [];
    ICO_E.forEach(([a, b], k) => { edges.push([a, 32 + k], [b, 32 + k]); });
    ICO_F.forEach((fc, k) => ICO_E.forEach(([a, b], j) => { if (fc.includes(a) && fc.includes(b)) edges.push([12 + k, 32 + j]); }));
    return { pts, edges };
  });

  // Small stellated dodecahedron (visible hull): a dodecahedron with a pentagonal spike on every face
  fixedSolid('small_stellated_dodecahedron', 'Small stellated dodecahedron', () => {
    const FN = allSigned([[0, PHI, 1]], cyc3), faces = FN.map((d) => { const u = unit(d); return DODE.map((p, i) => [i, dot(p, u)]).sort((x, y) => y[1] - x[1]).slice(0, 5).map((e) => e[0]); });
    const tips = FN.map((d, k) => { const u = unit(d), inr = dot(DODE[faces[k][0]], u); return mul(u, inr * Math.sqrt(5)); });
    const pts = tips.concat(DODE), edges = [];
    faces.forEach((fc, k) => fc.forEach((i) => edges.push([k, 12 + i])));
    nearPairs(DODE).forEach(([a, b]) => edges.push([12 + a, 12 + b]));
    return { pts, edges }; // 12 tips + 20 valleys, 60 spike + 30 valley edges
  });

  // Great stellated dodecahedron (visible hull): an icosahedron with a triangular spike on every face
  fixedSolid('great_stellated_dodecahedron', 'Great stellated dodecahedron', () => {
    // a pentagram plane sits over icosahedron vertex v and holds v's five neighbours; the spike tips on it lie on that plane
    const v = 0, vh = unit(ICO[v]), nb = ICO_E.filter((e) => e.includes(v)).map((e) => e[0] === v ? e[1] : e[0]), d = dot(ICO[nb[0]], vh);
    const ring = ICO_F.find((fc) => !fc.includes(v) && fc.filter((i) => nb.includes(i)).length === 2), rt = d / dot(unit(centroid(ring, ICO)), vh);
    const pts = ICO.concat(ICO_F.map((fc) => mul(unit(centroid(fc, ICO)), rt))), edges = ICO_E.slice();
    ICO_F.forEach((fc, k) => fc.forEach((i) => edges.push([i, 12 + k])));
    return { pts, edges }; // 12 valleys + 20 tips, 30 valley + 60 spike edges
  });

  // Buckyball: truncated icosahedron, 60 vertices and 90 equal edges
  const BUCKY = allSigned([[0, 1, 3 * PHI], [1, 2 + PHI, 2 * PHI], [PHI, 2, PHI * PHI * PHI]], cyc3);
  SP.addShape('buckyball', { name: 'Buckyball C₆₀', fixed: true, edges: true, make: () => BUCKY.map((p) => p.slice()) });

  // Sea urchin: spikes from a sphere. Point 2i is a spike's base, 2i+1 its tip, so the wireframe works for any n.
  SP.addShape('urchin', {
    name: 'Sea urchin', edgeList: grid(120, (i) => [2 * i, 2 * i + 1]),
    make: (n) => { const k = Math.ceil(n / 2), out = []; for (let i = 0; i < k; i++) { const d = fib(i, k), t = 1 + 0.12 * Math.sin(i * 7.31); out.push(mul(d, 0.42), mul(d, t)); } return out.slice(0, n); }
  });

  /* ---------------- 4D polytopes ---------------- */
  const sign4 = (v) => signs(v);
  const CELL600 = uniq([].concat(
    perms4(false).flatMap((p) => sign4(p.map((k) => [1, 0, 0, 0][k]))),
    sign4([0.5, 0.5, 0.5, 0.5]),
    perms4(true).flatMap((p) => sign4(p.map((k) => [PHI / 2, 0.5, 1 / (2 * PHI), 0][k])))
  ));
  const cell = (key, name, P) => SP.addShape(key, { name, four: true, fixed: true, edges: true, make: () => P.map((p) => p.slice()) });
  cell('cell5', '5-cell (4D)', [[1, 1, 1, -1 / Math.sqrt(5)], [1, -1, -1, -1 / Math.sqrt(5)], [-1, 1, -1, -1 / Math.sqrt(5)], [-1, -1, 1, -1 / Math.sqrt(5)], [0, 0, 0, Math.sqrt(5) - 1 / Math.sqrt(5)]]);
  cell('cell16', '16-cell (4D)', uniq(perms4(false).flatMap((p) => sign4(p.map((k) => [1, 0, 0, 0][k])))));
  cell('cell24', '24-cell (4D)', uniq(perms4(false).flatMap((p) => sign4(p.map((k) => [1, 1, 0, 0][k])))));
  cell('cell600', '600-cell (4D)', CELL600);
  SP.addShape('clifford_torus', { name: 'Clifford torus (4D)', four: true, make: (n) => {
    const rows = Math.max(3, Math.round(Math.sqrt(n))), cols = Math.ceil(n / rows);
    return grid(n, (i) => { const u = TAU * (i % cols) / cols, v = TAU * Math.floor(i / cols) / rows + u / rows; return [Math.cos(u), Math.sin(u), Math.cos(v), Math.sin(v)]; });
  } });

  /* ---------------- Curves and surfaces ---------------- */
  // a (cols x rows) parameter grid; u in [0,1) around, v in [0,1] (or [0,1) when vClosed)
  const surf = (n, ratio, vClosed, f) => {
    const rows = Math.max(2, Math.round(Math.sqrt(n / ratio))), cols = Math.ceil(n / rows);
    return grid(n, (i) => f((i % cols) / cols, Math.floor(i / cols) / (vClosed ? rows : rows - 1)));
  };
  const torusKnot = (p, q) => (n) => grid(n, (i) => { const t = TAU * i / n, r = 2 + Math.cos(q * t); return [r * Math.cos(p * t), -Math.sin(q * t), r * Math.sin(p * t)]; });
  SP.addShape('torus_knot', { name: 'Torus knot (3,7)', make: torusKnot(3, 7) });
  SP.addShape('cinquefoil', { name: 'Cinquefoil knot', make: torusKnot(2, 5) });

  SP.addShape('hopf', { name: 'Hopf fibration', make: (n) => {
    const C = clamp(Math.round(n / 10), 3, 12), etas = C >= 9 ? [0.3, 0.58, 0.85] : [0.4, 0.8], per = Math.ceil(C / etas.length), out = [];
    for (let i = 0; i < n; i++) {
      const c = Math.floor(i * C / n), c0 = Math.ceil(c * n / C), c1 = Math.ceil((c + 1) * n / C), t = TAU * (i - c0) / (c1 - c0);
      const ti = c % etas.length, j = Math.floor(c / etas.length), eta = etas[ti], al = TAU * j / per + ti * 0.7;
      const x1 = Math.cos(eta) * Math.cos(t + al), x2 = Math.cos(eta) * Math.sin(t + al), x3 = Math.sin(eta) * Math.cos(t), x4 = Math.sin(eta) * Math.sin(t), k = 1 / (1 - x4);
      out.push([x1 * k, x3 * k, x2 * k]);
    }
    return out;
  } });

  SP.addShape('seashell', { name: 'Seashell', make: (n) => surf(n, 5, true, (u, v) => {
    const t = u * 6 * Math.PI, a = Math.exp(0.1 * t), s = TAU * v, r = a * (1 + 0.55 * Math.cos(s));
    return [r * Math.cos(t), 1.5 * a + 0.55 * a * Math.sin(s), r * Math.sin(t)];
  }) });
  SP.addShape('enneper', { name: 'Enneper surface', make: (n) => surf(n, 2.5, false, (a, b) => {
    const r = 0.15 + 1.05 * b, th = TAU * a, u = r * Math.cos(th), v = r * Math.sin(th);
    return [u - u * u * u / 3 + u * v * v, u * u - v * v, v - v * v * v / 3 + v * u * u];
  }) });
  SP.addShape('boy', { name: "Boy's surface", make: (n) => surf(n, 1.6, true, (a, b) => {
    const u = Math.PI * a, v = Math.PI * (b + 0.031), s2 = Math.SQRT2, cv = Math.cos(v), d = 2 - s2 * Math.sin(3 * u) * Math.sin(2 * v);
    return [(s2 * cv * cv * Math.cos(2 * u) + Math.cos(u) * Math.sin(2 * v)) / d, -(3 * cv * cv) / d, (s2 * cv * cv * Math.sin(2 * u) - Math.sin(u) * Math.sin(2 * v)) / d];
  }) });
  SP.addShape('catenoid', { name: 'Catenoid', make: (n) => surf(n, 2, false, (a, b) => { const u = TAU * a, v = -1.2 + 2.4 * b, c = Math.cosh(v); return [c * Math.cos(u), v, c * Math.sin(u)]; }) });
  SP.addShape('helicoid', { name: 'Helicoid', make: (n) => { const cols = 6, rows = Math.ceil(n / cols); return grid(n, (i) => { const v = -1 + 2 * (i % cols) / (cols - 1), u = -2 * Math.PI + 4 * Math.PI * Math.floor(i / cols) / Math.max(1, rows - 1); return [v * Math.cos(u), u * 0.22, v * Math.sin(u)]; }); } });
  SP.addShape('dupin', { name: 'Dupin cyclide', make: (n) => surf(n, 2.2, true, (a, b) => {
    const A = 1, c = 0.4, d = 0.55, B = Math.sqrt(A * A - c * c), u = TAU * a, v = TAU * b, den = A - c * Math.cos(u) * Math.cos(v);
    return [(d * (c - A * Math.cos(u) * Math.cos(v)) + B * B * Math.cos(u)) / den, B * Math.sin(v) * (c * Math.cos(u) - d) / den, B * Math.sin(u) * (A - d * Math.cos(v)) / den];
  }) });
  SP.addShape('gyroid', { name: 'Gyroid', make: (n) => {
    const R = rng(1234567), out = [], L = Math.PI;
    for (let tries = 0; out.length < n && tries < n * 40; tries++) {
      let x = (R() * 2 - 1) * L, y = (R() * 2 - 1) * L, z = (R() * 2 - 1) * L, f = 1;
      for (let k = 0; k < 6; k++) {
        const sx = Math.sin(x), cx = Math.cos(x), sy = Math.sin(y), cy = Math.cos(y), sz = Math.sin(z), cz = Math.cos(z);
        f = sx * cy + sy * cz + sz * cx;
        const gx = cx * cy - sz * sx, gy = cy * cz - sx * sy, gz = cz * cx - sy * sz, g2 = gx * gx + gy * gy + gz * gz || 1;
        x -= f * gx / g2; y -= f * gy / g2; z -= f * gz / g2;
      }
      if (Math.abs(f) < 1e-3 && Math.abs(x) <= L && Math.abs(y) <= L && Math.abs(z) <= L) out.push([x, y, z]);
    }
    return out;
  } });
  SP.addShape('mandelbulb', { name: 'Mandelbulb⁸', make: (n) => {
    const inside = (cx, cy, cz) => {
      let x = cx, y = cy, z = cz;
      for (let k = 0; k < 10; k++) {
        const r = Math.sqrt(x * x + y * y + z * z);
        if (r > 2) return false;
        const th = Math.acos(clamp(z / (r || 1), -1, 1)) * 8, ph = Math.atan2(y, x) * 8, r8 = Math.pow(r, 8);
        x = r8 * Math.sin(th) * Math.cos(ph) + cx; y = r8 * Math.sin(th) * Math.sin(ph) + cy; z = r8 * Math.cos(th) + cz;
      }
      return true;
    };
    return grid(n, (i) => {
      const [dx, dy, dz] = fib(i, n), step = 0.03;
      let r = 1.3;
      while (r > 0.05 && !inside(dx * r, dz * r, dy * r)) r -= step;
      let lo = r, hi = r + step;
      for (let k = 0; k < 6; k++) { const m = (lo + hi) / 2; if (inside(dx * m, dz * m, dy * m)) lo = m; else hi = m; }
      return [dx * lo, dy * lo, dz * lo];
    });
  } });
  // Taubin's heart (x² + 9/4 y² + z² − 1)³ − x² z³ − 9/80 y² z³ = 0, z up; the boundary radius found along Fibonacci directions
  SP.addShape('heart', { name: 'Heart', make: (n) => {
    const F = (x, y, z) => { const a = x * x + 2.25 * y * y + z * z - 1; return a * a * a - x * x * z * z * z - 0.1125 * y * y * z * z * z; };
    return grid(n, (i) => {
      const [dx, dz, dy] = fib(i, n), step = 0.04, oz = 0.15; // march in from outside, centred a little above the origin
      let r = 1.8;
      while (r > 0.02 && F(dx * r, dy * r, oz + dz * r) > 0) r -= step;
      let lo = r, hi = r + step;
      for (let k = 0; k < 12; k++) { const m = (lo + hi) / 2; if (F(dx * m, dy * m, oz + dz * m) <= 0) lo = m; else hi = m; }
      return [dx * lo, -(oz + dz * lo), dy * lo];
    });
  } });
  SP.addShape('rose', { name: 'Spherical rose', make: (n) => grid(n, (i) => { const t = TAU * (i + 0.37) / n, k = 4, s = Math.sin(k * t); return [s * Math.cos(t), Math.cos(k * t), s * Math.sin(t)]; }) });
  SP.addShape('sunflower', { name: 'Sunflower', make: (n) => grid(n, (i) => { const r = Math.sqrt((i + 0.5) / n), t = i * GOLDEN; return [r * Math.cos(t), r * Math.sin(t), 0.28 * (1 - r * r)]; }) });
  SP.addShape('atom', { name: 'Atom', make: (n) => {
    const k = Math.max(4, Math.round(n * 0.2)), out = [];
    for (let i = 0; i < k; i++) out.push(mul(fib(i, k), 0.2 * Math.cbrt((i + 0.5) / k) + 0.04));
    const rest = n - k;
    for (let i = 0; i < rest; i++) {
      const ring = Math.floor(i * 3 / rest), r0 = Math.ceil(ring * rest / 3), r1 = Math.ceil((ring + 1) * rest / 3), t = TAU * (i - r0) / (r1 - r0) + ring;
      const x = Math.cos(t), z = Math.sin(t), tilt = 1.1, y1 = -z * Math.sin(tilt), z1 = z * Math.cos(tilt), yaw = ring * TAU / 3;
      out.push([x * Math.cos(yaw) + z1 * Math.sin(yaw), y1, -x * Math.sin(yaw) + z1 * Math.cos(yaw)]);
    }
    return out;
  } });
  SP.addShape('crown', { name: 'Crown', make: (n) => surf(n, 5, false, (a, b) => {
    const th = TAU * a, f = (a * 8) % 1, peak = 1 - Math.abs(f * 2 - 1), top = -0.15 - 0.85 * peak * peak, y = 0.6 + (top - 0.6) * b, r = 1 + 0.12 * b;
    return [r * Math.cos(th), y, r * Math.sin(th)];
  }) });

  /* ---------------- Fractals ---------------- */
  // 3D Hilbert curve, order 2 (Skilling's transpose algorithm)
  const HILBERT = grid(64, (h) => {
    const X = [0, 0, 0];
    for (let b = 1; b >= 0; b--) for (let d = 0; d < 3; d++) X[d] |= ((h >> (b * 3 + 2 - d)) & 1) << b;
    let t = X[2] >> 1;
    for (let i = 2; i > 0; i--) X[i] ^= X[i - 1];
    X[0] ^= t;
    for (let Q = 2; Q !== 4; Q <<= 1) { const P = Q - 1; for (let i = 2; i >= 0; i--) { if (X[i] & Q) X[0] ^= P; else { t = (X[0] ^ X[i]) & P; X[0] ^= t; X[i] ^= t; } } }
    return X;
  });
  SP.addShape('hilbert', { name: 'Hilbert curve (3D)', make: (n) => grid(n, (i) => { // resample the 63 unit steps evenly
    const s = n > 1 ? i * 63 / (n - 1) : 0, k = Math.min(62, Math.floor(s)), f = s - k, a = HILBERT[k], b = HILBERT[k + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  }) });
  // Menger sponge: level-2 cube centres, dealt out evenly over the 20 level-1 cubes so the holes always show
  const MENGER1 = [];
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) if ((x === 0) + (y === 0) + (z === 0) <= 1) MENGER1.push([x, y, z]);
  const MRANK = MENGER1.slice().sort((p, q) => { const k = (v) => (v.includes(0) ? 2 : v[0] * v[1] * v[2] > 0 ? 0 : 1); return k(p) - k(q); });
  SP.addShape('menger', { name: 'Menger sponge', make: (n) => grid(n, (i) => { const r = Math.floor(i / 20) % 20; return add(mul(MENGER1[i % 20], 3), MRANK[r]); }) });
  // Sierpinski tetrahedron: corner points of the sub-tetrahedra, coarse levels first
  const SIERP = (() => {
    const T = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]], seen = {}, levels = [];
    let tets = [T];
    for (let L = 0; L <= 4; L++) {
      const fresh = [];
      tets.forEach((t) => t.forEach((p) => { const k = p.map((v) => Math.round(v * 1e5)).join(','); if (!seen[k]) { seen[k] = 1; fresh.push(p); } }));
      levels.push(fresh);
      tets = tets.flatMap((t) => t.map((c) => t.map((p) => mul(add(c, p), 0.5))));
    }
    return levels;
  })();
  SP.addShape('sierpinski', { name: 'Sierpiński tetrahedron', make: (n) => {
    const out = [];
    for (const lv of SIERP) {
      const need = n - out.length;
      if (need <= 0) break;
      if (lv.length <= need) out.push(...lv); else for (let i = 0; i < need; i++) out.push(lv[Math.floor(i * lv.length / need)]);
    }
    return out;
  } });

  /* ---------------- Strange attractors ---------------- */
  function attractor(f, p0, dt, transient, steps, map) {
    return (n) => {
      let p = p0.slice(); const out = [];
      const st = (q, k, h) => [q[0] + k[0] * h, q[1] + k[1] * h, q[2] + k[2] * h];
      const rk = () => { const k1 = f(p), k2 = f(st(p, k1, dt / 2)), k3 = f(st(p, k2, dt / 2)), k4 = f(st(p, k3, dt)); for (let j = 0; j < 3; j++) p[j] += dt / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]); };
      for (let s = 0; s < transient; s++) rk();
      let next = 0;
      for (let s = 0; out.length < n; s++) { if (s >= Math.floor(next)) { out.push(map(p)); next += steps / n; } rk(); }
      return out;
    };
  }
  SP.addShape('rossler', { name: 'Rössler attractor', make: attractor(([x, y, z]) => [-y - z, x + 0.2 * y, 0.2 + z * (x - 5.7)], [1, 1, 0], 0.02, 3000, 6000, ([x, y, z]) => [x, -z * 0.5, y]) });
  SP.addShape('aizawa', { name: 'Aizawa attractor', make: attractor(([x, y, z]) => [(z - 0.7) * x - 3.5 * y, 3.5 * x + (z - 0.7) * y, 0.6 + 0.95 * z - z * z * z / 3 - (x * x + y * y) * (1 + 0.25 * z) + 0.1 * z * x * x * x], [0.1, 0, 0], 0.015, 2000, 16000, ([x, y, z]) => [x, -z, y]) });
  SP.addShape('thomas', { name: 'Thomas attractor', make: attractor(([x, y, z]) => [Math.sin(y) - 0.208186 * x, Math.sin(z) - 0.208186 * y, Math.sin(x) - 0.208186 * z], [1.1, 1.1, -0.01], 0.08, 1000, 7000, (p) => p.slice()) });
  SP.addShape('halvorsen', { name: 'Halvorsen attractor', make: attractor(([x, y, z]) => [-1.4 * x - 4 * y - 4 * z - y * y, -1.4 * y - 4 * z - 4 * x - z * z, -1.4 * z - 4 * x - 4 * y - x * x], [-1.48, -1.51, 2.04], 0.004, 2000, 25000, (p) => p.slice()) });
  SP.addShape('chen', { name: 'Chen attractor', make: attractor(([x, y, z]) => [35 * (y - x), -7 * x - x * z + 28 * y, x * y - 3 * z], [-10, 0, 37], 0.002, 3000, 25000, ([x, y, z]) => [x, -(z - 22), y]) });
  SP.addShape('dadras', { name: 'Dadras attractor', make: attractor(([x, y, z]) => [y - 3 * x + 2.7 * y * z, 1.7 * y - x * z + z, 2 * x * y - 9 * z], [1.1, 2.1, -2], 0.005, 4000, 30000, (p) => p.slice()) });
  /* =============== More shapes: the library =============== */
  const perms3 = (v) => [[v[0], v[1], v[2]], [v[0], v[2], v[1]], [v[1], v[0], v[2]], [v[1], v[2], v[0]], [v[2], v[0], v[1]], [v[2], v[1], v[0]]];
  const EDGE_MID = ICO_E.map(([a, b]) => unit(add(ICO[a], ICO[b]))); // 30 two-fold axes
  const FACE_C = ICO_F.map((f) => unit(centroid(f, ICO))); // 20 three-fold axes
  const ICO_U = ICO.map(unit); // 12 five-fold axes
  const ICO_AXES = ICO_U.concat(FACE_C, EDGE_MID);
  // a fixed solid that is built on first use (the engine reads edgeList right after make)
  function lazySolid(key, name, build, extra) {
    let c = null;
    const def = Object.assign({ name, fixed: true, edgeList: [], make: () => { if (!c) { c = build(); def.edgeList = c.edges; } return c.pts.map((p) => p.slice()); } }, extra || {});
    SP.addShape(key, def);
  }
  const vertexSolid = (key, name, P, tol) => fixedSolid(key, name, () => ({ pts: P, edges: nearPairs(P, tol) }));

  /* ---- Archimedean ---- */
  const CUBOCT = allSigned([[1, 1, 0]], perms3);
  const ICOSIDODE = allSigned([[0, 0, PHI], [0.5, PHI / 2, PHI * PHI / 2]], cyc3);
  const TRUNC_OCT = allSigned([[0, 1, 2]], perms3);
  const swapXY = (P) => P.map((p) => [p[1], p[0], p[2]]); // the textbook coordinates below use the mirror orientation of ICO
  const TRUNC_DODE = swapXY(allSigned([[0, 1 / PHI, 2 + PHI], [1 / PHI, PHI, 2 * PHI], [PHI, 2, PHI + 1]], cyc3));
  const RHOMBICOSI = swapXY(allSigned([[1, 1, PHI * PHI * PHI], [PHI * PHI, PHI, 2 * PHI], [2 + PHI, 0, PHI * PHI]], cyc3));
  const TRUNC_ICOSIDODE = swapXY(allSigned([[1 / PHI, 1 / PHI, 3 + PHI], [2 / PHI, PHI, 1 + 2 * PHI], [1 / PHI, PHI * PHI, 3 * PHI - 1], [2 * PHI - 1, 2, 2 + PHI], [PHI, 3, 2 * PHI]], cyc3));
  vertexSolid('cuboctahedron', 'Cuboctahedron', CUBOCT);
  vertexSolid('icosidodecahedron', 'Icosidodecahedron', ICOSIDODE);
  vertexSolid('truncated_octahedron', 'Truncated octahedron', TRUNC_OCT);
  vertexSolid('truncated_dodecahedron', 'Truncated dodecahedron', TRUNC_DODE);
  vertexSolid('rhombicosidodecahedron', 'Rhombicosidodecahedron', RHOMBICOSI);
  vertexSolid('truncated_icosidodecahedron', 'Truncated icosidodecahedron', TRUNC_ICOSIDODE);

  // Snub solids, solved numerically: every face of the parent is shrunk and twisted until all edges are equal
  function snub(axes, parent, k) {
    const faces = axes.map((a) => { const n = unit(a); return parent.map((p) => [p, dot(p, n)]).sort((x, y) => y[1] - x[1]).slice(0, k).map((e) => unit(sub(e[0], mul(n, e[1])))); });
    const ns = axes.map(unit);
    const B = []; ns.forEach((n, f) => faces[f].forEach((b) => B.push([n, b, cross(n, b)])));
    const build = (rho, th) => B.map(([n, b, nb]) => add(n, mul(add(mul(b, Math.cos(th)), mul(nb, Math.sin(th))), rho)));
    const err = (rho, th) => { // vertex 0 must sit at one edge length from its face-mate and from three vertices of other faces
      const c = Math.cos(th) * rho, s = Math.sin(th) * rho, P = B.map(([n, b, nb]) => [n[0] + b[0] * c + nb[0] * s, n[1] + b[1] * c + nb[1] * s, n[2] + b[2] * c + nb[2] * s]);
      const v = P[0], d = (q) => Math.hypot(q[0] - v[0], q[1] - v[1], q[2] - v[2]);
      let own = Infinity; for (let i = 1; i < k; i++) own = Math.min(own, d(P[i]));
      let m1 = Infinity, m2 = Infinity, m3 = Infinity;
      for (let i = k; i < P.length; i++) { const x = d(P[i]); if (x < m1) { m3 = m2; m2 = m1; m1 = x; } else if (x < m2) { m3 = m2; m2 = x; } else if (x < m3) m3 = x; }
      return (m1 / own - 1) ** 2 + (m2 / own - 1) ** 2 + (m3 / own - 1) ** 2;
    };
    let best = [0.5, 0.3], span = [0.6, Math.PI / k];
    for (let round = 0; round < 9; round++) {
      let bv = Infinity, bp = best;
      for (let i = -10; i <= 10; i++) for (let j = -10; j <= 10; j++) {
        const r = best[0] + span[0] * i / 10, t = best[1] + span[1] * j / 10;
        if (r <= 0.02 || t <= 0.001 || t >= Math.PI / k) continue;
        const e = err(r, t); if (e < bv) { bv = e; bp = [r, t]; }
      }
      best = bp; span = [span[0] / 4, span[1] / 4];
    }
    return build(best[0], best[1]);
  }
  lazySolid('snub_cube', 'Snub cube', () => { const P = snub(allSigned([[1, 0, 0]], cyc3), signs([1, 1, 1]), 4); return { pts: P, edges: nearPairs(P, 1.01) }; });
  lazySolid('snub_dodecahedron', 'Snub dodecahedron', () => { const P = snub(allSigned([[0, PHI, 1]], cyc3), DODE, 5); return { pts: P, edges: nearPairs(P, 1.01) }; });

  /* ---- Catalan: the polar duals of the Archimedean solids ---- */
  // one vertex per face of the parent (its axis scaled by 1/plane distance); two are joined when their faces share an edge
  function catalan(parent, axes) {
    const faces = axes.map((a) => { const d = Math.max(...parent.map((p) => dot(p, a))); return { d, ids: parent.map((p, i) => (dot(p, a) > d - 1e-6 ? i : -1)).filter((i) => i >= 0) }; });
    const pts = axes.map((a, i) => mul(a, 1 / faces[i].d)), edges = [];
    for (let i = 0; i < faces.length; i++) for (let j = i + 1; j < faces.length; j++) if (faces[i].ids.filter((x) => faces[j].ids.includes(x)).length >= 2) edges.push([i, j]);
    return { pts, edges };
  }
  const CUBE_AXES = allSigned([[1, 0, 0]], cyc3).concat(signs([1, 1, 1]).map(unit));
  fixedSolid('rhombic_dodecahedron', 'Rhombic dodecahedron', () => catalan(CUBOCT, CUBE_AXES));
  fixedSolid('deltoidal_hexecontahedron', 'Deltoidal hexecontahedron', () => catalan(RHOMBICOSI, ICO_AXES));
  fixedSolid('pentakis_dodecahedron', 'Pentakis dodecahedron', () => catalan(BUCKY, ICO_U.concat(FACE_C)));
  fixedSolid('triakis_icosahedron', 'Triakis icosahedron', () => catalan(TRUNC_DODE, ICO_U.concat(FACE_C)));
  fixedSolid('disdyakis_triacontahedron', 'Disdyakis triacontahedron', () => catalan(TRUNC_ICOSIDODE, ICO_AXES));

  /* ---- Compounds ---- */
  const pairsAt = (P, d) => { const out = []; for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) if (Math.abs(dist(P[i], P[j]) - d) < 1e-6) out.push([i, j]); return out; };
  fixedSolid('compound_five_cubes', 'Compound of five cubes', () => ({ pts: DODE, edges: pairsAt(DODE, 2) }));
  fixedSolid('compound_five_tetrahedra', 'Compound of five tetrahedra', () => {
    const E = pairsAt(DODE, 2 * Math.SQRT2), adj = (a, b) => E.some((e) => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a)), tets = [];
    for (let a = 0; a < 20; a++) for (let b = a + 1; b < 20; b++) if (adj(a, b)) for (let c = b + 1; c < 20; c++) if (adj(a, c) && adj(b, c)) for (let d = c + 1; d < 20; d++) if (adj(a, d) && adj(b, d) && adj(c, d)) tets.push([a, b, c, d]);
    let pick = null; // five of the ten tetrahedra that use every vertex once (one of the two chiral compounds)
    const rec = (start, used, chosen) => { if (pick) return; if (chosen.length === 5) { pick = chosen.slice(); return; } for (let t = start; t < tets.length; t++) if (tets[t].every((v) => !used[v])) { tets[t].forEach((v) => (used[v] = 1)); chosen.push(tets[t]); rec(t + 1, used, chosen); chosen.pop(); tets[t].forEach((v) => (used[v] = 0)); } };
    rec(0, {}, []);
    const edges = []; pick.forEach((t) => { for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) edges.push([t[i], t[j]]); });
    return { pts: DODE, edges };
  });
  fixedSolid('compound_five_octahedra', 'Compound of five octahedra', () => {
    const P = EDGE_MID.concat(EDGE_MID.map((p) => mul(p, -1))), edges = [];
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) if (Math.abs(dot(P[i], P[j])) < 1e-9) edges.push([i, j]);
    return { pts: uniq(P), edges }; // the 15 two-fold axes fall into 5 orthogonal triples
  });

  /* ---- Kepler–Poinsot outer surfaces, computed from the star faces ---- */
  // inside = nonzero winding number of the self-intersecting faces; the visible vertices are corners of that region's boundary
  function starHull(polys) {
    const R = Math.max(...polys.flat().map(len)), planes = [], tris = [];
    polys.forEach((P0) => {
      let nrm = [0, 0, 0];
      P0.forEach((p, i) => { const q = P0[(i + 1) % P0.length]; nrm = add(nrm, cross(p, q)); });
      let P = P0; if (dot(nrm, P0[0]) < 0) { P = P0.slice().reverse(); nrm = mul(nrm, -1); }
      const n = unit(nrm); planes.push({ n, d: dot(n, P[0]) });
      for (let k = 1; k < P.length - 1; k++) tris.push([P[0], P[k], P[k + 1]]);
    });
    const T = new Float64Array(tris.flat(2)), nt = tris.length, FOUR_PI = 4 * Math.PI;
    const inside = (px, py, pz) => { // |winding number| > 1/2, summed from the signed solid angles of the triangles
      let s = 0;
      for (let t = 0; t < nt; t++) {
        const o = t * 9, ax = T[o] - px, ay = T[o + 1] - py, az = T[o + 2] - pz, bx = T[o + 3] - px, by = T[o + 4] - py, bz = T[o + 5] - pz, cx = T[o + 6] - px, cy = T[o + 7] - py, cz = T[o + 8] - pz;
        const la = Math.sqrt(ax * ax + ay * ay + az * az), lb = Math.sqrt(bx * bx + by * by + bz * bz), lc = Math.sqrt(cx * cx + cy * cy + cz * cz);
        const num = ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
        s += 2 * Math.atan2(num, la * lb * lc + (ax * bx + ay * by + az * bz) * lc + (ax * cx + ay * cy + az * cz) * lb + (bx * cx + by * cy + bz * cz) * la);
      }
      return Math.abs(s / FOUR_PI) > 0.5;
    };
    const eps = 2e-3 * R, del = 2e-5 * R;
    const flips = (q, n) => inside(q[0] + n[0] * del, q[1] + n[1] * del, q[2] + n[2] * del) !== inside(q[0] - n[0] * del, q[1] - n[1] * del, q[2] - n[2] * del);
    const visible = (c, pl, dirs) => { // does plane pl carry visible surface right next to c (sampled along dirs, or all round)?
      if (!dirs) { const t1 = unit(cross(pl.n, Math.abs(pl.n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])), t2 = cross(pl.n, t1); dirs = grid(16, (k) => add(mul(t1, Math.cos(k * TAU / 16)), mul(t2, Math.sin(k * TAU / 16)))); }
      return dirs.some((t) => flips(add(c, mul(t, eps)), pl.n));
    };
    const OFF = signs([1, 1, 1]).concat(allSigned([[1.7, 0, 0]], cyc3)).map((o) => mul(o, eps));
    const onBoundary = (c) => { return !OFF.every((o) => inside(c[0] + o[0], c[1] + o[1], c[2] + o[2])); }; // skips only points buried inside
    const solve = (A, B, C) => { const det = dot(A.n, cross(B.n, C.n)); if (Math.abs(det) < 1e-9) return null; return mul(add(add(mul(cross(B.n, C.n), A.d), mul(cross(C.n, A.n), B.d)), mul(cross(A.n, B.n), C.d)), 1 / det); };
    const cand = [];
    for (let i = 0; i < planes.length; i++) for (let j = i + 1; j < planes.length; j++) for (let k = j + 1; k < planes.length; k++) { const c = solve(planes[i], planes[j], planes[k]); if (c && len(c) < R + 1e-6) cand.push(c); }
    const verts = [];
    uniq(cand).forEach((c) => { if (!onBoundary(c)) return; const vis = planes.filter((pl) => Math.abs(dot(pl.n, c) - pl.d) < 1e-7 * R && visible(c, pl)); if (vis.length >= 3) verts.push({ p: c, vis }); });
    const pts = verts.map((v) => v.p), edges = [], seenE = {};
    planes.forEach((P1, i) => planes.forEach((P2, j) => { // along each line where two visible planes meet, join neighbouring vertices
      if (j <= i) return;
      const on = verts.map((v, k) => (v.vis.includes(P1) && v.vis.includes(P2) ? k : -1)).filter((k) => k >= 0);
      if (on.length < 2) return;
      const e = unit(cross(P1.n, P2.n));
      on.sort((x, y) => dot(pts[x], e) - dot(pts[y], e));
      for (let k = 0; k + 1 < on.length; k++) {
        const a = on[k], b = on[k + 1], key = Math.min(a, b) + ':' + Math.max(a, b);
        if (seenE[key]) continue;
        const m = mul(add(pts[a], pts[b]), 0.5); // a crease: both planes carry surface beside the midpoint
        if ([P1, P2].every((pl) => { const t = unit(cross(pl.n, e)); return visible(m, pl, [t, mul(t, -1)]); })) { seenE[key] = 1; edges.push([a, b]); }
      }
    }));
    return { pts, edges };
  }
  const ICO_NB = ICO.map((_, v) => ICO_E.filter((e) => e.includes(v)).map((e) => (e[0] === v ? e[1] : e[0])));
  const ringOrder = (ids, axis) => { const n = unit(axis), t1 = unit(cross(n, Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])), t2 = cross(n, t1); return ids.slice().sort((a, b) => Math.atan2(dot(ICO[a], t2), dot(ICO[a], t1)) - Math.atan2(dot(ICO[b], t2), dot(ICO[b], t1))); };
  // great dodecahedron: 12 pentagons, each through the five neighbours of a vertex
  lazySolid('great_dodecahedron', 'Great dodecahedron', () => starHull(ICO.map((v, i) => ringOrder(ICO_NB[i], v).map((k) => ICO[k]))));
  // great icosahedron: 20 big triangles joining vertices two steps apart
  lazySolid('great_icosahedron', 'Great icosahedron', () => {
    const far = (a, b) => Math.abs(dist(ICO[a], ICO[b]) - 2 * PHI) < 1e-6, tri = [];
    for (let a = 0; a < 12; a++) for (let b = a + 1; b < 12; b++) if (far(a, b)) for (let c = b + 1; c < 12; c++) if (far(a, c) && far(b, c)) tri.push([ICO[a], ICO[b], ICO[c]]);
    return starHull(tri);
  });

  /* ---- 4D ---- */
  cell('duoprism', '6-6 duoprism (4D)', grid(36, (i) => { const a = TAU * (i % 6) / 6, b = TAU * Math.floor(i / 6) / 6; return [Math.cos(a), Math.sin(a), Math.cos(b), Math.sin(b)]; }));
  cell('rectified_tesseract', 'Rectified tesseract (4D)', uniq(perms4(false).flatMap((p) => signs(p.map((k) => [0, 1, 1, 1][k])))));
  cell('runcinated_tesseract', 'Runcinated tesseract (4D)', uniq(perms4(false).flatMap((p) => signs(p.map((k) => [1, 1, 1, 1 + Math.SQRT2][k])))));
  SP.addShape('glome', { name: '3-sphere (4D)', four: true, make: (n) => grid(n, (i) => { // even spread on S³ in Hopf coordinates
    const s = Math.sqrt((i + 0.5) / n), c = Math.sqrt(1 - s * s), a = TAU * ((i * 0.7548776662) % 1), b = TAU * ((i * 0.5698402910) % 1);
    return [c * Math.cos(a), s * Math.cos(b), c * Math.sin(a), s * Math.sin(b)];
  }) });

  /* ---- Surfaces ---- */
  const hemi = (n) => grid(n, (i) => { const y = 1 - (i + 0.5) / n, r = Math.sqrt(1 - y * y), t = GOLDEN * i; return [Math.cos(t) * r, y, Math.sin(t) * r]; });
  SP.addShape('roman_surface', { name: 'Roman surface (Steiner)', make: (n) => hemi(n).map(([x, y, z]) => [y * z, x * z, x * y]) });
  SP.addShape('cross_cap', { name: 'Cross-cap', make: (n) => hemi(n).map(([X, Z, Y]) => [Y * Z, X * X - Y * Y, 2 * X * Y]) });
  SP.addShape('dini', { name: "Dini's surface", make: (n) => surf(n, 3, false, (a, b) => {
    const u = 4 * Math.PI * a, v = 0.3 + 1.6 * b;
    return [Math.cos(u) * Math.sin(v), -(Math.cos(v) + Math.log(Math.tan(v / 2)) + 0.14 * u), Math.sin(u) * Math.sin(v)];
  }) });
  SP.addShape('kuen', { name: 'Kuen surface', make: (n) => surf(n, 1, false, (a, b) => {
    const s = -4.4 + 8.8 * a, v = -3 + 6 * b, ch = Math.cosh(v), D = ch * ch + s * s;
    return [2 * ch * (Math.cos(s) + s * Math.sin(s)) / D, -(v - 2 * Math.sinh(v) * ch / D), 2 * ch * (-s * Math.cos(s) + Math.sin(s)) / D];
  }) });
  SP.addShape('breather', { name: 'Breather surface', make: (n) => surf(n, 1.6, false, (a, b) => {
    const A = 0.4, w = Math.sqrt(1 - A * A), u = -7.5 + 15 * b, v = -37.4 * (1 - 2 * a), ca = Math.cosh(A * u), D = A * ((w * ca) ** 2 + (A * Math.sin(w * v)) ** 2);
    return [-u + 2 * w * w * ca * Math.sinh(A * u) / D, 2 * w * ca * (-(w * Math.cos(v) * Math.cos(w * v)) - Math.sin(v) * Math.sin(w * v)) / D, 2 * w * ca * (-(w * Math.sin(v) * Math.cos(w * v)) + Math.cos(v) * Math.sin(w * v)) / D];
  }) });
  SP.addShape('bour', { name: "Bour's minimal surface", make: (n) => surf(n, 3, false, (a, b) => {
    const t = 4 * Math.PI * (a + 0.013), r = 0.15 + 0.85 * b;
    return [r * Math.cos(t) - r * r * Math.cos(2 * t) / 2, (4 / 3) * Math.pow(r, 1.5) * Math.cos(1.5 * t), -r * Math.sin(t) - r * r * Math.sin(2 * t) / 2];
  }) });
  // Costa's minimal surface from the Weierstrass ζ and ℘ functions of the square lattice (lattice sums, |m|,|n| <= 10)
  const COSTA = (() => {
    const cm = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]], ci = (a) => { const d = a[0] * a[0] + a[1] * a[1]; return [a[0] / d, -a[1] / d]; };
    const L = [];
    for (let m = -10; m <= 10; m++) for (let k = -10; k <= 10; k++) if (m || k) { const w = [m, k], iw = ci(w); L.push({ w, iw, iw2: cm(iw, iw) }); }
    const zeta = (z) => { let r = ci(z); for (const l of L) { const q = ci([z[0] - l.w[0], z[1] - l.w[1]]), t = cm(z, l.iw2); r = [r[0] + q[0] + l.iw[0] + t[0], r[1] + q[1] + l.iw[1] + t[1]]; } return r; };
    const wp = (z) => { const z1 = ci(z); let r = cm(z1, z1); for (const l of L) { const q = ci([z[0] - l.w[0], z[1] - l.w[1]]), q2 = cm(q, q); r = [r[0] + q2[0] - l.iw2[0], r[1] + q2[1] - l.iw2[1]]; } return r; };
    return { zeta, wp, e1: wp([0.5, 0])[0] };
  })();
  SP.addShape('costa', { name: 'Costa minimal surface', make: (n) => {
    const { zeta, wp, e1 } = COSTA, rows = Math.max(3, Math.round(Math.sqrt(n))), cols = Math.ceil(n / rows), PI = Math.PI, k = PI / (2 * e1);
    const raw = grid(n, (i) => {
      const u = ((i % cols) + 0.5) / cols, v = (Math.floor(i / cols) + 0.5) / rows, z = [u, v];
      const Z0 = zeta(z), Z1 = zeta([u - 0.5, v]), Z2 = zeta([u, v - 0.5]), P = wp(z);
      const x = 0.5 * (-Z0[0] + PI * u + PI * PI / (4 * e1) + k * (Z1[0] - Z2[0]));
      const y = 0.5 * (Z0[1] + PI * v + PI * PI / (4 * e1) + k * (Z1[1] - Z2[1]));
      const num = Math.hypot(P[0] - e1, P[1]), den = Math.hypot(P[0] + e1, P[1]);
      return [x, Math.sqrt(2 * PI) / 4 * Math.log(num / den), y];
    });
    const cx = raw.reduce((s, p) => s + p[0], 0) / n, cz = raw.reduce((s, p) => s + p[2], 0) / n;
    return raw.map(([x, y, z]) => { const p = [x - cx, -y, z - cz], r = len(p) || 1, f = 1.6 * Math.tanh(r / 1.6) / r; return mul(p, f); }); // squash the three ends
  } });
  SP.addShape('spherical_spiral', { name: 'Loxodrome', make: (n) => grid(n, (i) => { // even in latitude = even in arc length
    const lat = (-0.5 + (i + 0.5) / n) * Math.PI * 0.96, t = Math.atanh(Math.sin(lat)) / 0.11;
    return [Math.cos(lat) * Math.cos(t), -Math.sin(lat), Math.cos(lat) * Math.sin(t)];
  }) });

  // Weaire–Phelan foam: the Voronoi cells of the A15 lattice (2 pentagonal dodecahedra + 6 tetrakaidecahedra per repeat)
  lazySolid('weaire_phelan', 'Weaire–Phelan foam', () => {
    const base = [[0, 0, 0], [0.5, 0.5, 0.5], [0.25, 0.5, 0], [0.75, 0.5, 0], [0, 0.25, 0.5], [0, 0.75, 0.5], [0.5, 0, 0.25], [0.5, 0, 0.75]];
    const sites = [];
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) base.forEach((s, i) => sites.push({ p: [s[0] + a, s[1] + b, s[2] + c], own: !a && !b && !c }));
    const verts = [], seen = {};
    sites.forEach((s, si) => {
      if (!s.own) return;
      const local = sites.map((q, i) => i).filter((i) => dist(sites[i].p, s.p) < 1.4); // anything that could be closer to a vertex of this cell
      const nb = local.filter((i) => i !== si && dist(sites[i].p, s.p) < 0.65); // the face-sharing neighbours
      for (let i = 0; i < nb.length; i++) for (let j = i + 1; j < nb.length; j++) for (let k = j + 1; k < nb.length; k++) {
        const A = s.p, r1 = sub(sites[nb[i]].p, A), r2 = sub(sites[nb[j]].p, A), r3 = sub(sites[nb[k]].p, A), det = 2 * dot(r1, cross(r2, r3));
        if (Math.abs(det) < 1e-9) continue;
        const c = add(A, mul(add(add(mul(cross(r2, r3), dot(r1, r1)), mul(cross(r3, r1), dot(r2, r2))), mul(cross(r1, r2), dot(r3, r3))), 1 / det));
        const R = dist(c, A); let ok = true; const eq = [];
        for (const q of local) { const dq = Math.hypot(sites[q].p[0] - c[0], sites[q].p[1] - c[1], sites[q].p[2] - c[2]); if (dq < R - 1e-7) { ok = false; break; } if (dq < R + 1e-7) eq.push(q); }
        if (!ok) continue; // some site is closer: not a Voronoi vertex
        const key = c.map((v) => Math.round(v * 1e6)).join(',');
        if (!seen[key]) { seen[key] = 1; verts.push({ p: c, s: eq }); } else { const v = verts.find((w) => w.p.map((x) => Math.round(x * 1e6)).join(',') === key); eq.forEach((q) => { if (!v.s.includes(q)) v.s.push(q); }); }
      }
    });
    const edges = [];
    for (let i = 0; i < verts.length; i++) for (let j = i + 1; j < verts.length; j++) { const sh = verts[i].s.filter((x) => verts[j].s.includes(x)); if (sh.length >= 3 && sh.some((x) => sites[x].own)) edges.push([i, j]); }
    return { pts: verts.map((v) => v.p), edges };
  });
})(window.SPHERE);
