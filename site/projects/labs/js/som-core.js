/* Dynamic Interactive Labs — strength of materials (Festigkeitslehre) core.
   Cross-section axes as in Gross–Hauger–Schröder–Wall: y to the right, z downwards (x along the beam, into the page);
   Iy = ∫z² dA, Iz = ∫y² dA and the product moment with their sign, Iyz = −∫yz dA, so that the inertia tensor turns like the
   stress tensor (Mohr's circle of inertia). Units: mm, N, MPa unless stated; forces in kN and moments in kN·m at the interface.
   · section properties of composite sections (rectangles, circles, polygons, holes) with the Steiner table;
   · normal stress of oblique bending with the neutral axis;
   · shear flow in thin-walled open and closed (multi-cell) sections from equilibrium dq/ds = −t ∂σ/∂x and compatibility,
     the shear centre, and torsion (Bredt for cells + ⅓Σlt³ for open walls);
   · Jourawski's shear stress in solid sections; Saint-Venant torsion of rectangles;
   · the elastic line by four integrations (Euler–Bernoulli and Timoshenko) with the constants from the boundary conditions;
   · Castigliano / Menabrea on curved bars; Euler buckling. */
function SomCoreFactory(G) {
  'use strict';
  const SO = (G.SomCore = {});
  const { abs, sqrt, max, min, hypot, PI, cos, sin, atan2, tanh } = Math;

  /* ---------------- parts and shapes ---------------- */
  /* part: { kind: 'rect', y, z, b, h } (centre, width along y, height along z) | { kind: 'circle', y, z, r } | { kind: 'poly', pts }; sign −1 = hole */
  function partProps(p) {
    const s = p.sign || 1;
    if (p.kind === 'rect') { const A = p.b * p.h; return { A: s * A, y: p.y, z: p.z, Iy0: (s * p.b * p.h ** 3) / 12, Iz0: (s * p.h * p.b ** 3) / 12, Iyz0: 0 }; }
    if (p.kind === 'circle') { const A = PI * p.r * p.r, I = (PI * p.r ** 4) / 4; return { A: s * A, y: p.y, z: p.z, Iy0: s * I, Iz0: s * I, Iyz0: 0 }; }
    // polygon: exact area integrals (shoelace family); orientation-independent
    const P = p.pts, n = P.length; let A = 0, Sy = 0, Sz = 0, Jyy = 0, Jzz = 0, Jyz = 0;
    for (let i = 0; i < n; i++) { const [y0, z0] = P[i], [y1, z1] = P[(i + 1) % n], c = y0 * z1 - y1 * z0; A += c; Sy += (y0 + y1) * c; Sz += (z0 + z1) * c; Jyy += (y0 * y0 + y0 * y1 + y1 * y1) * c; Jzz += (z0 * z0 + z0 * z1 + z1 * z1) * c; Jyz += (y0 * z1 + 2 * y0 * z0 + 2 * y1 * z1 + y1 * z0) * c; }
    const o = A < 0 ? -1 : 1; A = (o * A) / 2; Sy = (o * Sy) / 6; Sz = (o * Sz) / 6; Jyy = (o * Jyy) / 12; Jzz = (o * Jzz) / 12; Jyz = (o * Jyz) / 24;
    const yc = Sy / A, zc = Sz / A;
    return { A: s * A, y: yc, z: zc, Iy0: s * (Jzz - A * zc * zc), Iz0: s * (Jyy - A * yc * yc), Iyz0: -s * (Jyz - A * yc * zc) };
  }
  SO.partProps = partProps;
  const R = (y, z, b, h, label, sign) => ({ kind: 'rect', y, z, b, h, label, sign });
  /* standard shapes; every shape also carries its thin-walled centreline model (nodes, segments with thickness) when it has one */
  SO.SHAPES = {
    rect: { name: 'Rectangle', dims: [['b', 'width b', 10, 400, 100], ['h', 'height h', 10, 600, 200]], make: (d) => ({ parts: [R(0, 0, d.b, d.h, 'rectangle')], solid: 'rect' }) },
    circle: { name: 'Circle', dims: [['d', 'diameter d', 10, 400, 100]], make: (d) => ({ parts: [{ kind: 'circle', y: 0, z: 0, r: d.d / 2, label: 'circle' }], solid: 'circle' }) },
    tube: { name: 'Tube', dims: [['D', 'outer diameter D', 20, 600, 200], ['t', 'wall t', 1, 50, 10]], make: (d) => { const n = 48, Rm = (d.D - d.t) / 2, nodes = [], segs = []; for (let i = 0; i < n; i++) { const a = (2 * PI * i) / n; nodes.push([Rm * cos(a), Rm * sin(a)]); segs.push({ a: i, b: (i + 1) % n, t: d.t }); } return { parts: [{ kind: 'circle', y: 0, z: 0, r: d.D / 2, label: 'outer circle' }, { kind: 'circle', y: 0, z: 0, r: d.D / 2 - d.t, label: 'hole', sign: -1 }], thin: { nodes, segs }, solid: 'tube' }; } },
    slit: { name: 'Slit tube', dims: [['D', 'outer diameter D', 20, 600, 200], ['t', 'wall t', 1, 50, 10]], make: (d) => { const n = 48, Rm = (d.D - d.t) / 2, nodes = [], segs = []; for (let i = 0; i <= n; i++) { const a = PI / 2 + (2 * PI * (i + 0.02)) / (n + 0.04); nodes.push([Rm * cos(a), Rm * sin(a)]); if (i) segs.push({ a: i - 1, b: i, t: d.t }); } return { parts: [{ kind: 'circle', y: 0, z: 0, r: d.D / 2, label: 'outer circle' }, { kind: 'circle', y: 0, z: 0, r: d.D / 2 - d.t, label: 'hole', sign: -1 }], thin: { nodes, segs } }; } },
    I: { name: 'I-section', dims: [['h', 'height h', 40, 1000, 200], ['b', 'flange width b', 20, 500, 100], ['tw', 'web t_w', 2, 50, 5.6], ['tf', 'flange t_f', 2, 60, 8.5]],
      make: (d) => { const hw = d.h - 2 * d.tf, zf = (d.h - d.tf) / 2; return { parts: [R(0, -zf, d.b, d.tf, 'top flange'), R(0, 0, d.tw, hw, 'web'), R(0, zf, d.b, d.tf, 'bottom flange')], thin: { nodes: [[-d.b / 2, -zf], [0, -zf], [d.b / 2, -zf], [-d.b / 2, zf], [0, zf], [d.b / 2, zf]], segs: [{ a: 0, b: 1, t: d.tf }, { a: 1, b: 2, t: d.tf }, { a: 1, b: 4, t: d.tw }, { a: 3, b: 4, t: d.tf }, { a: 4, b: 5, t: d.tf }] } }; } },
    T: { name: 'T-section', dims: [['h', 'height h', 30, 600, 120], ['b', 'flange width b', 20, 400, 120], ['tw', 'web t_w', 2, 50, 11], ['tf', 'flange t_f', 2, 60, 11]],
      make: (d) => { const hw = d.h - d.tf; return { parts: [R(0, d.tf / 2, d.b, d.tf, 'flange'), R(0, d.tf + hw / 2, d.tw, hw, 'web')], thin: { nodes: [[-d.b / 2, d.tf / 2], [0, d.tf / 2], [d.b / 2, d.tf / 2], [0, d.h]], segs: [{ a: 0, b: 1, t: d.tf }, { a: 1, b: 2, t: d.tf }, { a: 1, b: 3, t: d.tw }] } }; } },
    C: { name: 'Channel (U)', dims: [['h', 'height h', 40, 800, 200], ['b', 'flange width b', 20, 300, 75], ['tw', 'web t_w', 2, 40, 8.5], ['tf', 'flange t_f', 2, 40, 11.5]],
      make: (d) => { const hw = d.h - 2 * d.tf, zf = (d.h - d.tf) / 2, yw = d.tw / 2, bf = d.b - d.tw; return { parts: [R(d.tw + bf / 2, -zf, bf, d.tf, 'top flange'), R(yw, 0, d.tw, d.h, 'web'), R(d.tw + bf / 2, zf, bf, d.tf, 'bottom flange')], thin: { nodes: [[d.b, -zf], [yw, -zf], [yw, zf], [d.b, zf]], segs: [{ a: 0, b: 1, t: d.tf }, { a: 1, b: 2, t: d.tw }, { a: 2, b: 3, t: d.tf }] } }; } },
    L: { name: 'Angle (L)', dims: [['h', 'leg h', 20, 400, 100], ['b', 'leg b', 20, 400, 100], ['t', 'thickness t', 2, 40, 10]],
      make: (d) => ({ parts: [R(d.t / 2, d.h / 2, d.t, d.h, 'vertical leg'), R(d.t + (d.b - d.t) / 2, d.h - d.t / 2, d.b - d.t, d.t, 'horizontal leg')], thin: { nodes: [[d.t / 2, 0], [d.t / 2, d.h - d.t / 2], [d.b, d.h - d.t / 2]], segs: [{ a: 0, b: 1, t: d.t }, { a: 1, b: 2, t: d.t }] } }) },
    Z: { name: 'Z-section', dims: [['h', 'height h', 40, 600, 160], ['b', 'flange width b', 20, 300, 70], ['t', 'thickness t', 2, 30, 8]],
      make: (d) => { const zf = (d.h - d.t) / 2, hw = d.h - 2 * d.t; return { parts: [R(d.t / 2 - d.b / 2, -zf, d.b, d.t, 'top flange'), R(0, 0, d.t, hw, 'web'), R(d.b / 2 - d.t / 2, zf, d.b, d.t, 'bottom flange')], thin: { nodes: [[-(d.b - d.t / 2), -zf], [0, -zf], [0, zf], [d.b - d.t / 2, zf]], segs: [{ a: 0, b: 1, t: d.t }, { a: 1, b: 2, t: d.t }, { a: 2, b: 3, t: d.t }] } }; } },
    box: { name: 'Box (closed)', dims: [['h', 'height h', 30, 800, 200], ['b', 'width b', 30, 600, 120], ['tw', 'webs t_w', 1, 40, 6], ['tf', 'flanges t_f', 1, 40, 10]],
      make: (d) => { const zf = (d.h - d.tf) / 2, yw = (d.b - d.tw) / 2; return { parts: [R(0, 0, d.b, d.h, 'outer rectangle'), R(0, 0, d.b - 2 * d.tw, d.h - 2 * d.tf, 'hole', -1)], thin: { nodes: [[-yw, -zf], [yw, -zf], [yw, zf], [-yw, zf]], segs: [{ a: 0, b: 1, t: d.tf }, { a: 1, b: 2, t: d.tw }, { a: 2, b: 3, t: d.tf }, { a: 3, b: 0, t: d.tw }] } }; } },
    box2: { name: 'Two-cell box', dims: [['h', 'height h', 30, 800, 150], ['b', 'width b', 60, 1000, 300], ['t', 'walls t', 1, 40, 6]],
      make: (d) => { const zf = (d.h - d.t) / 2, yw = (d.b - d.t) / 2, wi = (d.b - 3 * d.t) / 2; return { parts: [R(0, 0, d.b, d.h, 'outer rectangle'), R(-(d.t + wi) / 2, 0, wi, d.h - 2 * d.t, 'left cell', -1), R((d.t + wi) / 2, 0, wi, d.h - 2 * d.t, 'right cell', -1)], thin: { nodes: [[-yw, -zf], [0, -zf], [yw, -zf], [yw, zf], [0, zf], [-yw, zf]], segs: [{ a: 0, b: 1, t: d.t }, { a: 1, b: 2, t: d.t }, { a: 2, b: 3, t: d.t }, { a: 3, b: 4, t: d.t }, { a: 4, b: 5, t: d.t }, { a: 5, b: 0, t: d.t }, { a: 1, b: 4, t: d.t }] } }; } },
  };
  SO.build = (key, dims) => { const S = SO.SHAPES[key], d = {}; for (const [k, , , , v] of S.dims) d[k] = dims && dims[k] != null ? dims[k] : v; const out = S.make(d); out.key = key; out.dims = d; out.name = S.name; return out; };

  /* ---------------- section properties with the Steiner table ---------------- */
  SO.props = function (sec) {
    const rows = sec.parts.map((p) => Object.assign({ label: p.label || p.kind, sign: p.sign || 1 }, partProps(p)));
    const A = rows.reduce((s, r) => s + r.A, 0), yS = rows.reduce((s, r) => s + r.A * r.y, 0) / A, zS = rows.reduce((s, r) => s + r.A * r.z, 0) / A;
    let Iy = 0, Iz = 0, Iyz = 0;
    for (const r of rows) { r.yb = r.y - yS; r.zb = r.z - zS; r.stY = r.A * r.zb * r.zb; r.stZ = r.A * r.yb * r.yb; r.stYZ = -r.A * r.yb * r.zb; Iy += r.Iy0 + r.stY; Iz += r.Iz0 + r.stZ; Iyz += r.Iyz0 + r.stYZ; }
    const m = (Iy + Iz) / 2, Rr = hypot((Iy - Iz) / 2, Iyz), phi = 0.5 * atan2(2 * Iyz, Iy - Iz);
    // extents relative to the centroid (vertices of rectangles and polygons, circle extremes)
    const pts = []; for (const p of sec.parts) { if ((p.sign || 1) < 0) continue; if (p.kind === 'rect') for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pts.push([p.y + (u * p.b) / 2 - yS, p.z + (v * p.h) / 2 - zS]); else if (p.kind === 'circle') for (let k = 0; k < 72; k++) pts.push([p.y + p.r * cos((k * PI) / 36) - yS, p.z + p.r * sin((k * PI) / 36) - zS]); else for (const q of p.pts) pts.push([q[0] - yS, q[1] - zS]); }
    const ymin = min(...pts.map((q) => q[0])), ymax = max(...pts.map((q) => q[0])), zmin = min(...pts.map((q) => q[1])), zmax = max(...pts.map((q) => q[1]));
    return { A, yS, zS, Iy, Iz, Iyz, I1: m + Rr, I2: m - Rr, phi, Ip: Iy + Iz, iy: sqrt(Iy / A), iz: sqrt(Iz / A), Wy: [Iy / abs(zmin), Iy / abs(zmax)], Wz: [Iz / abs(ymin), Iz / abs(ymax)], ext: { ymin, ymax, zmin, zmax }, rows, pts };
  };
  /* inertia about axes turned by φ (counter-clockwise from y towards −z on screen is a matter of drawing; formulas as for stresses) */
  SO.turn = (P, ph) => { const m = (P.Iy + P.Iz) / 2, d = (P.Iy - P.Iz) / 2, c2 = cos(2 * ph), s2 = sin(2 * ph); return { Ieta: m + d * c2 + P.Iyz * s2, Izeta: m - d * c2 - P.Iyz * s2, Ietazeta: -d * s2 + P.Iyz * c2 }; };

  /* ---------------- bending: σ = N/A + [(Iz My − Iyz Mz) z + (Iyz My − Iy Mz) y]/Δ ---------------- */
  SO.sigmaFn = (P, N, My, Mz) => { const D = P.Iy * P.Iz - P.Iyz * P.Iyz, a = (N * 1e3) / P.A, cz = ((P.Iz * My - P.Iyz * Mz) * 1e6) / D, cy = ((P.Iyz * My - P.Iy * Mz) * 1e6) / D; return { a, cy, cz, at: (y, z) => a + cy * y + cz * z }; }; // N kN, M kN·m, y z mm → MPa

  /* ---------------- solid sections: width b(z) and Jourawski τ(z) = Q S(z) / (I b(z)) ---------------- */
  function chord(sec, P, z) { // total width of the material at height z (centroid axes); also the first moment of the part below
    let b = 0; for (const p of sec.parts) { const s = p.sign || 1, zc = p.z - P.zS; if (p.kind === 'rect') { if (abs(z - zc) <= p.h / 2) b += s * p.b; } else if (p.kind === 'circle') { const d = z - zc; if (abs(d) <= p.r) b += s * 2 * sqrt(p.r * p.r - d * d); } else { const xs = []; const Q = p.pts; for (let i = 0; i < Q.length; i++) { const [y0, z0] = Q[i], [y1, z1] = Q[(i + 1) % Q.length]; const za = z0 - P.zS, zb = z1 - P.zS; if ((za <= z && zb > z) || (zb <= z && za > z)) xs.push(y0 + ((z - za) / (zb - za)) * (y1 - y0)); } xs.sort((u, v) => u - v); for (let i = 0; i + 1 < xs.length; i += 2) b += s * (xs[i + 1] - xs[i]); } }
    return max(0, b);
  }
  SO.jourawski = function (sec, P, Qz, n) {
    n = n || 2400; const z0 = P.ext.zmin, z1 = P.ext.zmax, zs = [], bs = [], S = [];
    for (let i = 0; i <= n; i++) { const z = z0 + ((z1 - z0) * i) / n; zs.push(z); bs.push(chord(sec, P, z)); }
    // S(z) = ∫_z^{z1} ζ b(ζ) dζ by Simpson on each interval (midpoint chord)
    S[n] = 0; for (let i = n - 1; i >= 0; i--) { const za = zs[i], zb = zs[i + 1], zm = (za + zb) / 2, f = (za * bs[i] + 4 * zm * chord(sec, P, zm) + zb * bs[i + 1]) / 6; S[i] = S[i + 1] + f * (zb - za); }
    const tau = zs.map((z, i) => (bs[i] > 1e-9 ? (Qz * 1e3 * S[i]) / (P.Iy * bs[i]) : 0));
    let im = 0; tau.forEach((t, i) => { if (abs(t) > abs(tau[im])) im = i; });
    return { z: zs, b: bs, S, tau, max: [zs[im], tau[im]] };
  };
  /* Saint-Venant torsion of a solid rectangle b ≤ h: I_T = c1 h b³, τ_max = T / (c2 h b²) from the series solution */
  SO.rectTorsion = (b0, h0) => { const b = min(b0, h0), h = max(b0, h0); let s1 = 0, s2 = 0; for (let n = 1; n < 80; n += 2) { s1 += tanh((n * PI * h) / (2 * b)) / n ** 5; s2 += 1 / (n * n * Math.cosh((n * PI * h) / (2 * b))); } const c1 = (1 - ((192 * b) / (PI ** 5 * h)) * s1) / 3, k = 1 - (8 / (PI * PI)) * s2, c2 = c1 / k; return { IT: c1 * h * b ** 3, c1, c2, k, Wt: c2 * h * b * b }; };

  /* ---------------- thin-walled sections: properties, shear flow, shear centre, torsion ---------------- */
  SO.thinProps = function (th) {
    let A = 0, Sy = 0, Sz = 0; const segs = th.segs.map((s) => { const [ya, za] = th.nodes[s.a], [yb, zb] = th.nodes[s.b], l = hypot(yb - ya, zb - za); return Object.assign({}, s, { ya, za, yb, zb, l, dy: (yb - ya) / l, dz: (zb - za) / l }); });
    for (const s of segs) { const a = s.l * s.t; A += a; Sy += a * (s.ya + s.yb) / 2; Sz += a * (s.za + s.zb) / 2; }
    const yS = Sy / A, zS = Sz / A; let Iy = 0, Iz = 0, Jyz = 0;
    // thin-walled theory: every wall is a line with area t ds (its own t³ terms are dropped, consistently with the shear-flow integrals)
    for (const s of segs) { const a = s.l * s.t, ym = (s.ya + s.yb) / 2 - yS, zm = (s.za + s.zb) / 2 - zS, L3 = (s.t * s.l ** 3) / 12; Iy += L3 * s.dz * s.dz + a * zm * zm; Iz += L3 * s.dy * s.dy + a * ym * ym; Jyz += L3 * s.dy * s.dz + a * ym * zm; }
    return { A, yS, zS, Iy, Iz, Iyz: -Jyz, segs };
  };
  /* topology: spanning tree (BFS from node 0), cut edges (one per cell), cells as signed edge lists */
  function topology(th) {
    const n = th.nodes.length, adj = Array.from({ length: n }, () => []); th.segs.forEach((s, e) => { adj[s.a].push([s.b, e]); adj[s.b].push([s.a, e]); });
    const parent = new Array(n).fill(-1), pedge = new Array(n).fill(-1), depth = new Array(n).fill(-1), order = [], inTree = new Uint8Array(th.segs.length);
    depth[0] = 0; const qu = [0]; while (qu.length) { const u = qu.shift(); order.push(u); for (const [v, e] of adj[u]) if (depth[v] < 0) { depth[v] = depth[u] + 1; parent[v] = u; pedge[v] = e; inTree[e] = 1; qu.push(v); } }
    const cuts = []; th.segs.forEach((s, e) => { if (!inTree[e]) cuts.push(e); });
    // cell of cut edge e = (a→b): along e from a to b, then the tree path from b back to a
    const cells = cuts.map((e) => { const s = th.segs[e], list = [[e, 1]], path = (u, v) => { const up = [], dn = []; let x = u, y = v; while (depth[x] > depth[y]) { up.push([pedge[x], th.segs[pedge[x]].a === x ? 1 : -1]); x = parent[x]; } while (depth[y] > depth[x]) { dn.push([pedge[y], th.segs[pedge[y]].a === parent[y] ? 1 : -1]); y = parent[y]; } while (x !== y) { up.push([pedge[x], th.segs[pedge[x]].a === x ? 1 : -1]); x = parent[x]; dn.push([pedge[y], th.segs[pedge[y]].a === parent[y] ? 1 : -1]); y = parent[y]; } return up.concat(dn.reverse()); };
      list.push(...path(s.b, s.a)); return list; });
    return { parent, pedge, order, inTree, cuts, cells, adj };
  }
  /* open-section flow: dq/ds = −t σ′(y, z), σ′ = ∂σ/∂x for dMy/dx = Qz, dMz/dx = −Qy (centroid axes); integrated from the free ends inwards */
  function openFlow(T, segs, topo, sp) {
    const nE = segs.length, q0 = new Float64Array(nE), dirs = new Int8Array(nE), integ = (s, x) => { const y = s.ya2 + (s.yb2 - s.ya2) * (x / s.l), z = s.za2 + (s.zb2 - s.za2) * (x / s.l); void y; void z; return -s.t * (sp.cy * (s.ya2 * x + ((s.yb2 - s.ya2) * x * x) / (2 * s.l)) + sp.cz * (s.za2 * x + ((s.zb2 - s.za2) * x * x) / (2 * s.l))); };
    // each edge is integrated in its own a→b direction from q0 at a; the tree is processed from the leaves (reverse BFS order)
    const inflow = new Float64Array(T.nodes.length); // net flow arriving at a node from edges already done (in the edge's a→b sense, arriving at b)
    for (const e of topo.cuts) { const s = segs[e]; q0[e] = 0; inflow[s.b] += integ(s, s.l); dirs[e] = 1; }
    for (let k = topo.order.length - 1; k > 0; k--) {
      const v = topo.order[k], e = topo.pedge[v], s = segs[e];
      // the edge between v and its parent carries away everything that arrived at v
      if (s.a === v) { q0[e] = inflow[v]; inflow[s.b] += q0[e] + integ(s, s.l); }
      else { // edge oriented parent→v: its end value at v must equal −inflow[v] so that nothing piles up at v
        const endInc = integ(s, s.l); q0[e] = -inflow[v] - endInc; inflow[s.a] -= q0[e]; }
    }
    return { q0, integ };
  }
  /* full shear-flow solution for shear forces Qy, Qz [kN] (no twist: compatibility ∮ q/t ds = 0 in every cell); flows in N/mm */
  SO.shearFlow = function (th, Qy, Qz, opt) {
    const TP = SO.thinProps(th), segs = TP.segs.map((s) => Object.assign({}, s, { ya2: s.ya - TP.yS, yb2: s.yb - TP.yS, za2: s.za - TP.zS, zb2: s.zb - TP.zS }));
    const topo = topology(th), D = TP.Iy * TP.Iz - TP.Iyz * TP.Iyz, Myp = Qz * 1e3, Mzp = -Qy * 1e3; // N·mm per mm
    const sp = { cz: (TP.Iz * Myp - TP.Iyz * Mzp) / D, cy: (TP.Iyz * Myp - TP.Iy * Mzp) / D };
    const of = openFlow(th, segs, topo, sp), nC = topo.cells.length;
    // ∫ q_open/t ds on each edge (exact: q is quadratic in s; Simpson)
    const qAt = (e, x) => of.q0[e] + of.integ(segs[e], x), intQ = (e) => { const s = segs[e]; return (s.l * (qAt(e, 0) + 4 * qAt(e, s.l / 2) + qAt(e, s.l))) / 6; };
    const sgn = Array.from({ length: segs.length }, () => new Float64Array(nC)); topo.cells.forEach((cell, i) => { for (const [e, sg] of cell) sgn[e][i] += sg; });
    let qc = new Float64Array(nC);
    if (nC) { const A = Array.from({ length: nC }, () => new Float64Array(nC)), b = new Float64Array(nC); segs.forEach((s, e) => { for (let j = 0; j < nC; j++) { if (!sgn[e][j]) continue; b[j] -= (sgn[e][j] * intQ(e)) / s.t; for (let i = 0; i < nC; i++) A[j][i] += (sgn[e][j] * sgn[e][i] * s.l) / s.t; } }); qc = solveSmall(A, b); }
    const flow = (e, x) => { let v = qAt(e, x); for (let i = 0; i < nC; i++) v += sgn[e][i] * qc[i]; return v; };
    // resultant and moment about the centroid: M_x = Σ ∫ q (y dz − z dy)
    let Fy = 0, Fz = 0, Mx = 0; segs.forEach((s, e) => { const I = (s.l * (flow(e, 0) + 4 * flow(e, s.l / 2) + flow(e, s.l))) / 6; Fy += I * s.dy; Fz += I * s.dz; Mx += (I * (s.ya2 * s.zb2 - s.yb2 * s.za2)) / s.l; });
    return { TP, segs, topo, flow, qc, Fy, Fz, Mx, nC };
  };
  /* shear centre (relative to the centroid): yM = Mx(Qz = 1), zM = −Mx(Qy = 1) */
  SO.shearCentre = (th) => { const a = SO.shearFlow(th, 0, 1), b = SO.shearFlow(th, 1, 0); return { yM: a.Mx / 1e3, zM: -b.Mx / 1e3 }; };
  /* torsion: closed cells by Bredt (∮ q/t ds = 2 A_j G θ′), open walls by ⅓ l t³; T [kN·m], G [MPa] */
  SO.torsion = function (th, T, G) {
    const TP = SO.thinProps(th), segs = TP.segs, topo = topology(th), nC = topo.cells.length, Tn = T * 1e6;
    const sgn = Array.from({ length: segs.length }, () => new Float64Array(nC)); topo.cells.forEach((cell, i) => { for (const [e, sg] of cell) sgn[e][i] += sg; });
    // signed cell areas Am = ½ ∮ (y dz − z dy) along the cell direction
    const Am = topo.cells.map((cell) => cell.reduce((acc, [e, sg]) => { const s = segs[e]; return acc + (sg * (s.ya * s.zb - s.yb * s.za)) / 2; }, 0));
    let ITc = 0, qunit = new Float64Array(nC); // flows per unit G θ′
    if (nC) { const A = Array.from({ length: nC }, () => new Float64Array(nC)); segs.forEach((s, e) => { for (let j = 0; j < nC; j++) for (let i = 0; i < nC; i++) if (sgn[e][j] && sgn[e][i]) A[j][i] += (sgn[e][j] * sgn[e][i] * s.l) / s.t; }); qunit = solveSmall(A, Am.map((a) => 2 * a)); ITc = Am.reduce((acc, a, j) => acc + 2 * a * qunit[j], 0); }
    const ITo = segs.reduce((acc, s) => acc + (s.l * s.t ** 3) / 3, 0), IT = ITc + ITo, Gth = Tn / IT; // G θ′ [N/mm²/mm]
    const q = Array.from(qunit, (v) => v * Gth), flowE = segs.map((_, e) => { let v = 0; for (let i = 0; i < nC; i++) v += sgn[e][i] * q[i]; return v; });
    const tauWall = segs.map((s, e) => ({ closed: flowE[e] / s.t, open: Gth * s.t })); // Bredt τ = q/t (uniform across t); open-wall τ = G θ′ t at the faces
    let tmax = 0; tauWall.forEach((tw) => (tmax = max(tmax, abs(tw.closed) + abs(tw.open))));
    return { TP, segs, topo, Am, q, flowE, ITc, ITo, IT, theta: Gth / G, Gth, tauWall, tmax, nC };
  };
  function solveSmall(A0, b0) { const n = b0.length, A = A0.map((r, i) => [...r, b0[i]]); for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (abs(A[r][c]) > abs(A[p][c])) p = r; [A[p], A[c]] = [A[c], A[p]]; for (let r = 0; r < n; r++) { if (r === c || !A[c][c]) continue; const f = A[r][c] / A[c][c]; for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k]; } } return A.map((r, i) => r[n] / r[i]); }
  SO.solveSmall = solveSmall;

  /* ---------------- the elastic line by four integrations ----------------
     German convention: w and q downwards, M positive sagging: Q′ = −q, M′ = Q, EI φ′ = M (φ = −w′ for Euler–Bernoulli),
     Timoshenko: w′ = −φ + Q/(κGA). Constants: Q(0) = C1, M(0) = C2, φ(0) = C3, w(0) = C4. Supports at x = 0 and x = L:
     fixed (w = 0, φ = 0), pin (w = 0, M = 0), free (M = 0, Q = 0), guided (φ = 0, Q = 0).
     Loads: q(x) linear from q1 to q2 [kN/m], point forces [{a, F}] (down +), couples [{a, M}] (clockwise + = sagging jump). */
  SO.elastic = function (o) {
    const L = o.L, EI = o.EI, kGA = o.kGA || Infinity, n = 1600, xs = [];
    for (let i = 0; i <= n; i++) xs.push((L * i) / n);
    // point loads sit just inside the span (a load at an end acts on the beam, next to the support)
    o = Object.assign({}, o, { F: (o.F || []).map((p) => Object.assign({}, p, { a: max(2e-9 * L, min(L * (1 - 2e-9), p.a)) })), Mc: (o.Mc || []).map((p) => Object.assign({}, p, { a: max(2e-9 * L, min(L * (1 - 2e-9), p.a)) })) });
    for (const p of [...o.F, ...o.Mc]) xs.push(p.a - 1e-9 * L, p.a + 1e-9 * L);
    xs.sort((a, b) => a - b); const N = xs.length;
    const qf = (x) => (o.q1 || 0) + (((o.q2 == null ? o.q1 || 0 : o.q2) - (o.q1 || 0)) * x) / L;
    const cum = (f) => { const out = new Float64Array(N); for (let i = 1; i < N; i++) { const h = xs[i] - xs[i - 1]; out[i] = out[i - 1] + (h * (f[i - 1] + f[i])) / 2; } return out; };
    // a field set for given constants: returns {Q, M, phi, w} arrays (cumulative trapezoid on a fine grid: exact for the linear parts)
    const field = (C, loads) => {
      const Q = new Float64Array(N); const qi = loads ? cum(xs.map(qf)) : new Float64Array(N);
      for (let i = 0; i < N; i++) { let v = C[0] - qi[i]; if (loads) for (const p of o.F || []) if (xs[i] > p.a) v -= p.F; Q[i] = v; }
      const Mi = cum(Q), M = new Float64Array(N); for (let i = 0; i < N; i++) { let v = C[1] + Mi[i]; if (loads) for (const p of o.Mc || []) if (xs[i] > p.a) v += p.M; M[i] = v; }
      const ph = cum(Array.from(M, (v) => v / EI)), phi = ph.map((v) => v + C[2]);
      const wI = cum(Array.from(phi, (v) => -v)), wS = isFinite(kGA) ? cum(Array.from(Q, (v) => v / kGA)) : new Float64Array(N), w = wI.map((v, i) => v + wS[i] + C[3]);
      return { Q, M, phi, w };
    };
    const P0 = field([0, 0, 0, 0], true), U = [0, 1, 2, 3].map((k) => { const C = [0, 0, 0, 0]; C[k] = 1; return field(C, false); });
    const bc = (type, idx) => (type === 'fixed' ? ['w', 'phi'] : type === 'pin' ? ['w', 'M'] : type === 'guided' ? ['phi', 'Q'] : ['M', 'Q']).map((f) => [f, idx]);
    const rows = [...bc(o.left, 0), ...bc(o.right, N - 1)], A = rows.map(([f, i]) => U.map((u) => u[f][i])), b = rows.map(([f, i]) => -P0[f][i]);
    const det = detN(A); if (abs(det) < 1e-12 * max(1, ...A.flat().map(abs)) ** 4) return { err: 'This support combination is a mechanism.' };
    const C = solveSmall(A, b), F = field(C, true);
    let iw = 0; F.w.forEach((v, i) => { if (abs(v) > abs(F.w[iw])) iw = i; });
    return { x: xs, Q: F.Q, M: F.M, phi: F.phi, w: F.w, C, rows, wmax: [xs[iw], F.w[iw]] };
  };
  function detN(A) { const n = A.length, M = A.map((r) => r.slice()); let d = 1; for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (abs(M[r][c]) > abs(M[p][c])) p = r; if (!M[p][c]) return 0; if (p !== c) { [M[p], M[c]] = [M[c], M[p]]; d = -d; } d *= M[c][c]; for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; for (let k = c; k < n; k++) M[r][k] -= f * M[c][k]; } } return d; }

  /* ---------------- energy methods on curved bars ----------------
     Quarter circle (radius R), clamped at φ = π/2, free end at φ = 0 with forces F (down) and H (to the right):
     M = F R sin φ − H R (1 − cos φ), N = F sin φ + H cos φ, Q = F cos φ − H sin φ; energy U = ∫ M²/2EI + N²/2EA + κQ²/2GA ds; δ = ∂U/∂F by differentiation under the integral. */
  SO.quarterArc = function (o) {
    const { R: Rr, EI, EA, kGA, F, H } = o, n = 400; let U = 0, dF = 0, dH = 0, UM = 0, UN = 0, UQ = 0;
    for (let i = 0; i < n; i++) { const p = ((i + 0.5) / n) * (PI / 2), ds = (Rr * PI) / 2 / n, s = sin(p), c = cos(p);
      const M = F * Rr * s - H * Rr * (1 - c), dMF = Rr * s, dMH = -Rr * (1 - c), Nn = F * s + H * c, dNF = s, dNH = c, Q = F * c - H * s, dQF = c, dQH = -s;
      UM += (M * M) / (2 * EI) * ds; UN += EA ? (Nn * Nn) / (2 * EA) * ds : 0; UQ += kGA ? (Q * Q) / (2 * kGA) * ds : 0;
      dF += ((M * dMF) / EI + (EA ? (Nn * dNF) / EA : 0) + (kGA ? (Q * dQF) / kGA : 0)) * ds; dH += ((M * dMH) / EI + (EA ? (Nn * dNH) / EA : 0) + (kGA ? (Q * dQH) / kGA : 0)) * ds; }
    U = UM + UN + UQ; return { U, UM, UN, UQ, dv: dF, dh: dH };
  };
  /* ring under two opposite forces F: by symmetry a quarter with the unknown moment X at the cut; Menabrea ∂U/∂X = 0 */
  SO.ring = function (o) {
    const { R: Rr, EI, F } = o, n = 600, U = (X) => { let u = 0; for (let i = 0; i < n; i++) { const p = ((i + 0.5) / n) * (PI / 2), M = X - ((F * Rr) / 2) * (1 - cos(p)); u += ((M * M) / (2 * EI)) * ((Rr * PI) / 2 / n); } return 4 * u; };
    const Xs = (F * Rr) * (0.5 - 1 / PI), dU = (X) => (U(X + 1e-6 * F * Rr) - U(X - 1e-6 * F * Rr)) / (2e-6 * F * Rr);
    return { U, X: Xs, Mload: Xs - (F * Rr) / 2, delta: ((PI / 4 - 2 / PI) * F * Rr ** 3) / EI, dU };
  };

  /* ---------------- buckling ---------------- */
  SO.EULER = [{ id: 'cant', name: 'Fixed – free', beta: 2, mode: (x) => 1 - cos((PI * x) / 2) }, { id: 'pp', name: 'Pinned – pinned', beta: 1, mode: (x) => sin(PI * x) }, { id: 'fp', name: 'Fixed – pinned', beta: PI / 4.493409457909064, mode: (x) => { const k = 4.493409457909064; return -sin(k * x) / k + cos(k * x) + x - 1; } }, { id: 'ff', name: 'Fixed – fixed', beta: 0.5, mode: (x) => (1 - cos(2 * PI * x)) / 2 }];
  SO.tetmajer = (lam) => 310 - 1.14 * lam; // S235 (St 37), MPa, valid for λ ≲ 105
  return SO;
}
if (typeof window !== 'undefined') SomCoreFactory(window); else if (typeof globalThis !== 'undefined') SomCoreFactory(globalThis);
