/* Dynamic Interactive Labs — scene drawing + hit testing */
(function (G) {
  'use strict';
  const MB = G.MB, R = MB.R;
  const { cos, sin, hypot, PI, max, min, abs, sqrt, atan2, round } = Math;
  const D2R = PI / 180;
  let hits = [];
  const H = (o) => hits.push(o);

  const nrm = (x, y) => { const l = hypot(x, y) || 1; return [x / l, y / l]; };
  function hatchTo(ctx, x0, y0, x1, y1, hx, hy, opt) {
    const ux = x1 - x0, uy = y1 - y0;
    R.hatch(ctx, x0, y0, x1, y1, -uy * hx + ux * hy >= 0 ? 1 : -1, opt);
  }
  /* World position of an attachment ref under the simulated state */
  function W(sim, ref) {
    const i = sim.bodyIndex(ref.body);
    if (i < 0) return [ref.p[0], ref.p[1], i];
    const q = sim.q, th = q[3 * i + 2], c = cos(th), s = sin(th);
    return [q[3 * i] + c * ref.p[0] - s * ref.p[1], q[3 * i + 1] + s * ref.p[0] + c * ref.p[1], i];
  }
  R.W = W;
  function halfExtent(b, th, nx, ny) {
    if (b.shape === 'disk') return b.r;
    const c = cos(th), s = sin(th);
    return abs((b.w / 2) * (c * nx + s * ny)) + abs((b.h / 2) * (-s * nx + c * ny));
  }
  R.halfExtent = halfExtent;

  function halo(ctx, S, id, draw) {
    if (S.sel !== id && S.hover !== id) return;
    ctx.save();
    ctx.strokeStyle = R.tok.accent; ctx.globalAlpha = S.sel === id ? 0.32 : 0.16;
    ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    draw(); ctx.restore();
  }

  /* ---------------- ground features ---------------- */
  function drawRails(ctx, v, S) {
    const { model, sim } = S, groups = new Map();
    for (const j of model.joints) {
      if (j.type !== 'slider' || j.a.body) continue;
      const bi = sim.bodyIndex(j.b.body);
      if (bi < 0) continue;
      const b = model.bodies[bi], al = j.angle * D2R, ux = cos(al), uy = sin(al), nx = -uy, ny = ux;
      const P = j.a.p, hb = halfExtent(b, b.th * D2R, nx, ny);
      const off = nx * P[0] + ny * P[1];
      // offset of body centre from the rail axis (keeps the channel centred on the body)
      const cOff = nx * (b.x - P[0]) + ny * (b.y - P[1]);
      const key = `${Math.round(j.angle * 10)}|${Math.round((off + cOff) * 1e3)}|${Math.round(hb * 1e3)}`;
      const ha = halfExtent(b, b.th * D2R, ux, uy);
      const t0 = ux * b.x + uy * b.y, tc = ux * sim.q[3 * bi] + uy * sim.q[3 * bi + 1];
      let g = groups.get(key);
      if (!g) { g = { ux, uy, nx, ny, off: off + cOff, hb, lo: Infinity, hi: -Infinity, ids: [] }; groups.set(key, g); }
      g.lo = min(g.lo, t0 - ha - 0.12, tc - ha - 0.05); g.hi = max(g.hi, t0 + ha + 0.12, tc + ha + 0.05); g.ids.push(j.id);
    }
    for (const g of groups.values()) {
      for (const s of model.stops) for (const ref of [s.a, s.b]) {
        if (ref.body) continue;
        if (abs(g.nx * ref.p[0] + g.ny * ref.p[1] - g.off) <= g.hb + 1e-3) {
          const t = g.ux * ref.p[0] + g.uy * ref.p[1]; g.lo = min(g.lo, t); g.hi = max(g.hi, t);
        }
      }
      for (const sgn of [1, -1]) {
        const o = g.off + sgn * (g.hb + 1.2 / v.s);
        const x0 = g.ux * g.lo + g.nx * o, y0 = g.uy * g.lo + g.ny * o, x1 = g.ux * g.hi + g.nx * o, y1 = g.uy * g.hi + g.ny * o;
        const X0 = v.X(x0), Y0 = v.Y(y0), X1 = v.X(x1), Y1 = v.Y(y1);
        const sel = g.ids.includes(S.sel) || g.ids.includes(S.hover);
        if (sel) halo(ctx, S, g.ids.includes(S.sel) ? S.sel : S.hover, () => R.line(ctx, X0, Y0, X1, Y1));
        hatchTo(ctx, X0, Y0, X1, Y1, g.nx * sgn, -g.ny * sgn);
        for (const id of g.ids) H({ id, pr: 2, t: 'seg', x0: X0, y0: Y0, x1: X1, y1: Y1, w: 7 });
      }
    }
  }

  /* Axis-aligned direction closest to (x, y); near-diagonals prefer horizontal. World coordinates. */
  function axisDir(x, y, fx, fy) {
    if (hypot(x, y) < 1e-9) return [fx, fy];
    return abs(x) >= 0.9 * abs(y) ? [Math.sign(x), 0] : [0, Math.sign(y)];
  }
  R.axisDir = axisDir;
  /* Pin and clamp symbols: ground below or above unless the part sits clearly to one side */
  function vertDir(x, y) {
    if (hypot(x, y) < 1e-9) return [0, 1];
    return abs(y) >= 0.25 * abs(x) ? [0, Math.sign(y)] : [Math.sign(x), 0];
  }
  const MOUNT = { below: [0, 1], above: [0, -1], left: [1, 0], right: [-1, 0] };

  /* Ground-side parts of a support (hatching, Festlager triangle, Loslager track) are fixed to the
     inertial frame: their orientation comes from the t = 0 configuration and never follows the motion. */
  function drawSupport(ctx, v, S, j) {
    const { sim, model } = S, bi = sim.bodyIndex(j.b.body);
    if (bi < 0) return;
    const b0 = model.bodies[bi], B = W(sim, j.b), X = v.X(B[0]), Y = v.Y(B[1]);
    const P0 = j.a.p, PX = v.X(P0[0]), PY = v.Y(P0[1]);
    const [dwx, dwy] = MOUNT[j.mount] || vertDir(b0.x - P0[0], b0.y - P0[1]);
    const dx = dwx, dy = -dwy;
    const draw = () => {
      if (j.type === 'pin') {
        const px = -dy, py = dx, bx0 = PX - dx * 17, by0 = PY - dy * 17;
        ctx.beginPath(); ctx.moveTo(PX, PY); ctx.lineTo(bx0 + px * 10, by0 + py * 10); ctx.lineTo(bx0 - px * 10, by0 - py * 10); ctx.closePath();
        ctx.fillStyle = R.tok.paper; ctx.fill(); ctx.stroke();
        hatchTo(ctx, bx0 + px * 15, by0 + py * 15, bx0 - px * 15, by0 - py * 15, -dx, -dy);
        R.ring(ctx, PX, PY, 3.6);
        if (j.drive !== 'none') { ctx.save(); ctx.strokeStyle = ctx.fillStyle = R.tok['ink-2']; ctx.lineWidth = 1.3; R.moment(ctx, PX, PY, 13, j.drive === 'speed' ? Math.sign(j.dv || 1) : Math.sign(j.e0 || j.e1 || 1)); ctx.restore(); }
        H({ id: j.id, pr: 3, t: 'pt', x: PX, y: PY, r: 14 });
      } else if (j.type === 'roller') {
        const al = j.angle * D2R, Bw0 = MB.toWorld(model, j.b);
        let nwx = -sin(al), nwy = cos(al);
        const side = nwx * (Bw0[0] - b0.x) + nwy * (Bw0[1] - b0.y);
        if (side < -1e-9 || (abs(side) <= 1e-9 && nwy > 0)) { nwx = -nwx; nwy = -nwy; }
        const nx = nwx, ny = -nwy, ux = cos(al), uy = -sin(al);
        const bx0 = X + nx * 15, by0 = Y + ny * 15;
        ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(bx0 + ux * 10, by0 + uy * 10); ctx.lineTo(bx0 - ux * 10, by0 - uy * 10); ctx.closePath();
        ctx.fillStyle = R.tok.paper; ctx.fill(); ctx.stroke();
        R.ring(ctx, bx0 + ux * 5 + nx * 3.2, by0 + uy * 5 + ny * 3.2, 3, R.tok.paper); R.ring(ctx, bx0 - ux * 5 + nx * 3.2, by0 - uy * 5 + ny * 3.2, 3, R.tok.paper);
        const GX = PX + nx * 21.5, GY = PY + ny * 21.5;
        const tc = (X - PX) * ux + (Y - PY) * uy, reach = max(30, halfExtent(b0, b0.th * D2R, cos(al), sin(al)) * v.s + 24);
        const t0 = min(-reach, tc - 30), t1 = max(reach, tc + 30);
        hatchTo(ctx, GX + ux * t1, GY + uy * t1, GX + ux * t0, GY + uy * t0, nx, ny);
        R.ring(ctx, X, Y, 3.6);
        H({ id: j.id, pr: 3, t: 'pt', x: X, y: Y, r: 14 });
      } else if (j.type === 'fixed') {
        const px = -dy, py = dx;
        hatchTo(ctx, PX + px * 16, PY + py * 16, PX - px * 16, PY - py * 16, -dx, -dy, { lw: 2.2 });
        H({ id: j.id, pr: 3, t: 'pt', x: PX, y: PY, r: 12 });
      } else if (j.type === 'rolling') {
        const al = j.angle * D2R, ux = cos(al), uy = sin(al);
        let nx = -uy, ny = ux;
        if (nx * (b0.x - P0[0]) + ny * (b0.y - P0[1]) < 0) { nx = -nx; ny = -ny; }
        const L = 4.5, x0 = P0[0] - ux * L, y0 = P0[1] - uy * L, x1 = P0[0] + ux * L, y1 = P0[1] + uy * L;
        hatchTo(ctx, v.X(x0), v.Y(y0), v.X(x1), v.Y(y1), -nx, ny);
        H({ id: j.id, pr: 2, t: 'seg', x0: v.X(x0), y0: v.Y(y0), x1: v.X(x1), y1: v.Y(y1), w: 7 });
      } else if (j.type === 'rod') {
        const Bw0 = MB.toWorld(model, j.b), [mx, my] = axisDir(P0[0] - Bw0[0], P0[1] - Bw0[1], 0, 1);
        const ex = mx, ey = -my, px = -ey, py = ex;
        ctx.save(); ctx.lineWidth = 3.2; R.line(ctx, X, Y, PX, PY); ctx.restore();
        hatchTo(ctx, PX + px * 12, PY + py * 12, PX - px * 12, PY - py * 12, ex, ey);
        R.ring(ctx, PX, PY, 3.4); R.ring(ctx, X, Y, 3.4);
        H({ id: j.id, pr: 2, t: 'seg', x0: X, y0: Y, x1: PX, y1: PY, w: 8 });
      } else if (j.type === 'slider') {
        if (j.drive !== 'none') { const al = j.angle * D2R; ctx.save(); ctx.strokeStyle = ctx.fillStyle = R.tok['ink-2']; ctx.lineWidth = 1.3; R.arrow(ctx, X - cos(al) * 12, Y + sin(al) * 12, X + cos(al) * 14, Y - sin(al) * 14, 6); ctx.restore(); }
      }
    };
    const fixedPt = j.type === 'pin' || j.type === 'rod' || j.type === 'fixed';
    halo(ctx, S, j.id, () => { ctx.beginPath(); ctx.arc(fixedPt ? PX : X, fixedPt ? PY : Y, 9, 0, 2 * PI); ctx.stroke(); });
    draw();
  }

  function drawStop(ctx, v, S, s) {
    const { sim } = S, A = W(sim, s.a), B = W(sim, s.b), ia = sim.bodyIndex(s.a.body), al = s.angle * D2R + (s.local && ia >= 0 ? sim.q[3 * ia + 2] : 0), nx = cos(al), ny = sin(al);
    const wxs = -ny, wys = nx;
    const half = (ref) => {
      const i = sim.bodyIndex(ref === s.a ? s.b.body : s.a.body);
      if (i < 0) return 0.15;
      return halfExtent(S.model.bodies[i], S.model.bodies[i].th * D2R, wxs, wys) + 0.05;
    };
    const lam = S.snap && sim.byEl.get(s.id) ? S.snap.lam[sim.byEl.get(s.id).row] : 0;
    const wall = (P, side) => {
      const h = half(P === A ? s.a : s.b), Pref = P;
      const x0 = v.X(Pref[0] - wxs * h), y0 = v.Y(Pref[1] - wys * h), x1 = v.X(Pref[0] + wxs * h), y1 = v.Y(Pref[1] + wys * h);
      halo(ctx, S, s.id, () => R.line(ctx, x0, y0, x1, y1));
      hatchTo(ctx, x0, y0, x1, y1, -nx * side, ny * side, { lw: 2 });
      H({ id: s.id, pr: 2, t: 'seg', x0, y0, x1, y1, w: 8 });
    };
    if (A[2] < 0) wall(A, 1);
    if (B[2] < 0) wall(B, -1);
    if (A[2] >= 0 && B[2] >= 0) {
      const mx = v.X((A[0] + B[0]) / 2), my = v.Y((A[1] + B[1]) / 2), px = -ny, py = -nx;
      ctx.save(); ctx.strokeStyle = lam > 1e-9 ? R.tok.react : R.tok['ink-3']; ctx.lineWidth = 1.4;
      halo(ctx, S, s.id, () => { ctx.beginPath(); ctx.arc(mx, my, 8, 0, 2 * PI); ctx.stroke(); });
      R.line(ctx, mx - nx * 3 + px * 6, my + ny * 3 + py * 6, mx - nx * 3 - px * 6, my + ny * 3 - py * 6);
      R.line(ctx, mx + nx * 3 + px * 6, my - ny * 3 + py * 6, mx + nx * 3 - px * 6, my - ny * 3 - py * 6);
      ctx.restore();
      H({ id: s.id, pr: 3, t: 'pt', x: mx, y: my, r: 10 });
    }
  }

  /* ---------------- springs, dampers ---------------- */
  function drawSD(ctx, v, S, f) {
    const { sim } = S;
    if (f.type === 'torsion') return drawTorsion(ctx, v, S, f);
    if (f.type !== 'sd') return;
    const A = W(sim, f.a), B = W(sim, f.b);
    const X0 = v.X(A[0]), Y0 = v.Y(A[1]), X1 = v.X(B[0]), Y1 = v.Y(B[1]);
    const L = hypot(X1 - X0, Y1 - Y0) || 1, ux = (X1 - X0) / L, uy = (Y1 - Y0) / L, nx = -uy, ny = ux;
    halo(ctx, S, f.id, () => R.line(ctx, X0, Y0, X1, Y1));
    if (f.color) ctx.strokeStyle = R.tok[f.color] || f.color;
    const k = +f.k || 0, c = +f.c || 0;
    let band = 0;
    if (f.net) band = drawNet(ctx, X0, Y0, X1, Y1, f.net);
    else if (k > 0 && c > 0) {
      const o = 9, lead = min(10, L * 0.12);
      const a0x = X0 + ux * lead, a0y = Y0 + uy * lead, b0x = X1 - ux * lead, b0y = Y1 - uy * lead;
      R.line(ctx, X0, Y0, a0x, a0y); R.line(ctx, X1, Y1, b0x, b0y);
      R.line(ctx, a0x + nx * o, a0y + ny * o, a0x - nx * o, a0y - ny * o); R.line(ctx, b0x + nx * o, b0y + ny * o, b0x - nx * o, b0y - ny * o);
      R.coil(ctx, a0x + nx * o, a0y + ny * o, b0x + nx * o, b0y + ny * o, { r: 6, lead: 4, loops: 6 });
      R.dashpot(ctx, a0x - nx * o, a0y - ny * o, b0x - nx * o, b0y - ny * o, { w: 6 });
    } else if (c > 0) R.dashpot(ctx, X0, Y0, X1, Y1, { w: 8 });
    else R.coil(ctx, X0, Y0, X1, Y1, { r: 8, loops: 7 });
    const A0 = MB.toWorld(S.model, f.a), B0 = MB.toWorld(S.model, f.b);
    for (const [P, X, Y, Q0, P0, ref] of [[A, X0, Y0, B0, A0, f.a], [B, X1, Y1, A0, B0, f.b]]) {
      if (P[2] < 0 && ref.anchor) R.ring(ctx, X, Y, 2.6);
      else if (P[2] < 0) {
        const [mx, my] = axisDir(P0[0] - Q0[0], P0[1] - Q0[1], 0, 1), hx = mx, hy = -my;
        hatchTo(ctx, X - hy * 13, Y + hx * 13, X + hy * 13, Y - hx * 13, hx, hy);
      } else R.ring(ctx, X, Y, 2.6);
    }
    H({ id: f.id, pr: 2, t: 'seg', x0: X0, y0: Y0, x1: X1, y1: Y1, w: max(10, band / 2) });
    if (S.model.settings.labels && f.name) {
      const off = f.net ? band / 2 + 22 : c > 0 && k > 0 ? 30 : 24, sg = ny > 0.2 || (abs(ny) <= 0.2 && nx < 0) ? -1 : 1;
      const lx = (X0 + X1) / 2 + nx * off * sg, ly = (Y0 + Y1) / 2 + ny * off * sg;
      S.labels.push([f.name, lx, ly, 15]);
    }
  }

  /* Schematic of a spring–damper network along A→B: series children follow each other along the line,
     parallel children sit side by side between two bars. Returns the band width in pixels. */
  function drawNet(ctx, X0, Y0, X1, Y1, net) {
    const L = hypot(X1 - X0, Y1 - Y0);
    if (L < 24) { R.line(ctx, X0, Y0, X1, Y1); return 10; }
    const ux = (X1 - X0) / L, uy = (Y1 - Y0) / L, nx = -uy, ny = ux, Nt = MB.Net, sz = Nt.size(net);
    const slot = Math.max(7, Math.min(18, 70 / sz.hgt)), lead = Math.min(10, L * 0.08);
    const P = (a, b) => [X0 + ux * a + nx * b, Y0 + uy * a + ny * b];
    const seg = (a0, b0, a1, b1) => { const p = P(a0, b0), q = P(a1, b1); R.line(ctx, p[0], p[1], q[0], q[1]); };
    const draw = (node, a0, a1, b) => {
      const len = a1 - a0;
      if (node.t === 'k') { const p = P(a0, b), q = P(a1, b); R.coil(ctx, p[0], p[1], q[0], q[1], { r: Math.min(6, slot * 0.36), lead: 3, loops: Math.max(2, Math.min(8, Math.round(len / 9))) }); return; }
      if (node.t === 'c') { const p = P(a0, b), q = P(a1, b); R.dashpot(ctx, p[0], p[1], q[0], q[1], { w: Math.min(7, slot * 0.38) }); return; }
      const it = node.items || [];
      if (!it.length) { seg(a0, b, a1, b); return; }
      const ss = it.map(Nt.size);
      if (node.t === 's') {
        const gap = Math.min(4, len * 0.04), tot = ss.reduce((s, q) => s + q.w, 0), free = len - gap * (it.length - 1);
        let a = a0;
        it.forEach((ch, i) => { const w = (free * ss[i].w) / tot; draw(ch, a, a + w, b); a += w; if (i < it.length - 1) { seg(a, b, a + gap, b); a += gap; } });
        return;
      }
      // parallel: bars at both ends, children stacked across the line
      const H = ss.reduce((s, q) => s + q.hgt, 0), e = Math.min(6, len * 0.12);
      let off = -H / 2, first = null, last = null;
      const pos = ss.map((q) => { const c = b + (off + q.hgt / 2) * slot; off += q.hgt; return c; });
      first = pos[0]; last = pos[pos.length - 1];
      seg(a0, b, a0 + e, b); seg(a1 - e, b, a1, b);
      if (it.length > 1) { seg(a0 + e, first, a0 + e, last); seg(a1 - e, first, a1 - e, last); }
      it.forEach((ch, i) => draw(ch, a0 + e, a1 - e, pos[i]));
    };
    R.line(ctx, X0, Y0, X0 + ux * lead, Y0 + uy * lead); R.line(ctx, X1 - ux * lead, Y1 - uy * lead, X1, Y1);
    draw(net, lead, L - lead, 0);
    return sz.hgt * slot;
  }

  function drawTorsion(ctx, v, S, f) {
    const { sim } = S, ib = sim.bodyIndex(f.b.body);
    if (ib < 0) return;
    const X = v.X(sim.q[3 * ib]), Y = v.Y(sim.q[3 * ib + 1]);
    halo(ctx, S, f.id, () => { ctx.beginPath(); ctx.arc(X, Y, 16, 0, 2 * PI); ctx.stroke(); });
    ctx.beginPath();
    for (let i = 0; i <= 80; i++) { const t = i / 80, a = t * 3.6 * PI + sim.q[3 * ib + 2], r = 4 + 12 * t; i ? ctx.lineTo(X + r * cos(a), Y - r * sin(a)) : ctx.moveTo(X + r * cos(a), Y - r * sin(a)); }
    ctx.stroke();
    const ia = sim.bodyIndex(f.a.body), ex = X + 16, ey = Y + 16;
    if (ia < 0) hatchTo(ctx, ex - 10, ey + 6, ex + 10, ey - 6, 1, 1);
    H({ id: f.id, pr: 3, t: 'pt', x: X, y: Y, r: 16 });
  }

  /* ---------------- bodies ---------------- */
  function drawBody(ctx, v, S, b, i) {
    const q = S.sim.q, x = q[3 * i], y = q[3 * i + 1], th = q[3 * i + 2], X = v.X(x), Y = v.Y(y);
    ctx.save();
    ctx.fillStyle = R.tok.body; ctx.lineWidth = 1.7;
    const fillC = b.color ? (R.tok[b.color] || b.color) : null;
    const fillShape = () => { if (fillC) { ctx.fillStyle = R.tok.paper; ctx.fill(); ctx.globalAlpha = 0.62; ctx.fillStyle = fillC; ctx.fill(); ctx.globalAlpha = 1; } else ctx.fill(); };
    const sel = S.sel === b.id, hov = S.hover === b.id;
    if (b.shape === 'disk') {
      const r = b.r * v.s;
      ctx.beginPath(); ctx.arc(X, Y, r, 0, 2 * PI); fillShape(); ctx.stroke();
      ctx.lineWidth = 1.1; ctx.strokeStyle = R.tok['ink-2'];
      R.line(ctx, X, Y, X + r * cos(th), Y - r * sin(th));
      ctx.strokeStyle = R.tok.ink; ctx.lineWidth = 1.5; R.ring(ctx, X, Y, 3.4);
      H({ id: b.id, pr: 1, t: 'circle', x: X, y: Y, r });
      if (sel || hov) { ctx.strokeStyle = R.tok.accent; ctx.lineWidth = sel ? 2.6 : 1.6; ctx.beginPath(); ctx.arc(X, Y, r + 3, 0, 2 * PI); ctx.stroke(); }
      if (S.model.settings.labels) S.labels.push([b.name, X - r * 0.4, Y + r * 0.42, Math.min(18, Math.max(12, r * 0.3)), true]);
    } else {
      const c = cos(th), s = sin(th), hw = b.w / 2, hh = b.h / 2, pts = [];
      for (const [lx, ly] of [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]) pts.push([v.X(x + c * lx - s * ly), v.Y(y + s * lx + c * ly)]);
      ctx.beginPath(); pts.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); fillShape(); ctx.stroke();
      H({ id: b.id, pr: 1, t: 'poly', pts });
      if (sel || hov) {
        ctx.strokeStyle = R.tok.accent; ctx.lineWidth = sel ? 2.6 : 1.6;
        ctx.beginPath(); pts.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.stroke();
      }
      if (S.model.settings.labels) {
        const small = min(b.w, b.h) * v.s < 26, off = hh * v.s + 11;
        S.labels.push([b.name, small ? X - sin(th) * off : X, small ? Y - cos(th) * off : Y, min(18, max(12, min(b.w, b.h) * v.s * 0.42))]);
      }
    }
    if (S.model.settings.frames && v.s * (b.shape === 'disk' ? b.r : min(b.w, b.h)) > 30) {
      ctx.strokeStyle = ctx.fillStyle = R.tok['ink-3']; ctx.lineWidth = 1;
      R.arrow(ctx, X, Y, X + 18 * cos(th), Y - 18 * sin(th), 5); R.arrow(ctx, X, Y, X - 18 * sin(th), Y - 18 * cos(th), 5);
    }
    ctx.restore();
  }

  /* ---------------- ropes & pulleys ---------------- */
  function drawSheaves(ctx, v, S, R0, d) {
    const { model, sim } = S, el = R0.el, g = R0.g, N = R0.nodes.length;
    R0.nodes.forEach((nd, j) => {
      if (nd.r <= 0) return;
      const body = nd.i >= 0 ? model.bodies[nd.i] : null;
      const X = v.X(g.cx[j]), Y = v.Y(g.cy[j]), r = nd.r * v.s;
      if (body && body.shape === 'disk' && hypot(nd.p[0], nd.p[1]) < 1e-6 && abs(nd.r - body.r) < 1e-6) return;
      if (body && body.shape === 'disk' && hypot(nd.p[0], nd.p[1]) < 1e-6) {
        ctx.save(); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(X, Y, r, 0, 2 * PI); ctx.stroke(); ctx.restore(); return;
      }
      ctx.save(); ctx.lineWidth = 1.5;
      if (body) {
        const hw = body.w / 2, hh = body.h / 2, px = nd.p[0], py = nd.p[1];
        if (body.shape !== 'disk' && (abs(px) > hw || abs(py) > hh)) {
          const qx = max(-hw, min(hw, px)), qy = max(-hh, min(hh, py)), th = sim.q[3 * nd.i + 2], c = cos(th), s = sin(th);
          const tx = abs(px) > hw && abs(py) <= hh ? 0 : 1, ty = 1 - tx, spread = nd.r * 0.95;
          for (const sg of [-1, 1]) {
            const lx = qx + tx * sg * spread, ly = qy + ty * sg * spread;
            const wx = sim.q[3 * nd.i] + c * lx - s * ly, wy = sim.q[3 * nd.i + 1] + s * lx + c * ly;
            R.line(ctx, X, Y, v.X(wx), v.Y(wy));
          }
        }
      } else {
        const u0x = R0.u0x || g.ux, u0y = R0.u0y || g.uy;
        let fx = 0, fy = 0;
        if (j < N - 1) { fx += u0x[j]; fy += u0y[j]; }
        if (j > 0) { fx -= u0x[j - 1]; fy -= u0y[j - 1]; }
        let [mx, my] = nrm(-fx, -fy); if (!fx && !fy) { mx = 0; my = 1; }
        const L = r + 14, ex = X + mx * L, ey = Y - my * L;
        R.line(ctx, X, Y, ex, ey);
        hatchTo(ctx, ex - my * 11, ey - mx * 11, ex + my * 11, ey + mx * 11, mx, -my);
      }
      ctx.fillStyle = R.tok.paper; ctx.beginPath(); ctx.arc(X, Y, r, 0, 2 * PI); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(X, Y, max(2, r * 0.42), 0, 2 * PI); ctx.lineWidth = 1; ctx.stroke();
      ctx.lineWidth = 1.4; R.ring(ctx, X, Y, 2.6, R.tok.ink);
      ctx.restore();
      H({ id: el.id, pr: 2, t: 'circle', x: X, y: Y, r: r + 4 });
    });
    void d;
  }

  /* World-space rope pieces (lines, sagging curves, arcs) with material lengths; optional screen path */
  function ropePath(v, d) {
    const path = v ? new Path2D() : { moveTo() {}, lineTo() {}, quadraticCurveTo() {}, arc() {} }, pieces = [];
    if (!v) v = { X: (x) => x, Y: (y) => y, s: 1 };
    const arcBy = new Map(d.arcs.filter((a) => !a.drum).map((a) => [a.j, a]));
    const spanMax = new Map();
    d.segs.forEach((sg, k) => { const cur = spanMax.get(sg.span); if (cur == null || d.segs[cur].l < sg.l) spanMax.set(sg.span, k); });
    d.segs.forEach((sg, k) => {
      const X0 = v.X(sg.x0), Y0 = v.Y(sg.y0), X1 = v.X(sg.x1), Y1 = v.Y(sg.y1);
      if (k === 0) path.moveTo(X0, Y0);
      const slack = spanMax.get(sg.span) === k ? d.slack[sg.span] : 0;
      if (slack > 1e-5) {
        const h = min(0.6 * sg.l, sqrt((3 * sg.l * slack) / 8));
        const ux = (sg.x1 - sg.x0) / (sg.l || 1), uy = (sg.y1 - sg.y0) / (sg.l || 1);
        let gx = 0 - (0 * ux - 1 * uy) * 0, gy = -1;
        const dot = gx * ux + gy * uy; gx -= dot * ux; gy -= dot * uy;
        let gl = hypot(gx, gy);
        if (gl < 0.25) { gx = -uy; gy = ux; gl = 1; }
        gx /= gl; gy /= gl;
        const cx = (sg.x0 + sg.x1) / 2 + gx * 2 * h, cy = (sg.y0 + sg.y1) / 2 + gy * 2 * h;
        path.quadraticCurveTo(v.X(cx), v.Y(cy), X1, Y1);
        pieces.push({ t: 'q', x0: sg.x0, y0: sg.y0, cx, cy, x1: sg.x1, y1: sg.y1, len: sg.l + slack });
      } else {
        path.lineTo(X1, Y1);
        pieces.push({ t: 'l', x0: sg.x0, y0: sg.y0, x1: sg.x1, y1: sg.y1, len: sg.l });
      }
      const arc = arcBy.get(k + 1);
      if (arc) {
        const rr = arc.r * v.s;
        let sweep = arc.len / arc.r;
        path.arc(v.X(arc.cx), v.Y(arc.cy), rr, -arc.a0, -(arc.a0 + arc.s * sweep), arc.s > 0);
        pieces.push({ t: 'a', cx: arc.cx, cy: arc.cy, r: arc.r, a0: arc.a0, s: arc.s, len: arc.len });
      }
    });
    return { path, pieces };
  }

  function pointAt(pieces, s) {
    let cum = 0;
    for (const p of pieces) {
      if (s <= cum + p.len || p === pieces[pieces.length - 1]) {
        const f = max(0, min(1, (s - cum) / (p.len || 1)));
        if (p.t === 'l') return [p.x0 + (p.x1 - p.x0) * f, p.y0 + (p.y1 - p.y0) * f];
        if (p.t === 'q') { const a = (1 - f) * (1 - f), b = 2 * f * (1 - f), c = f * f; return [a * p.x0 + b * p.cx + c * p.x1, a * p.y0 + b * p.cy + c * p.y1]; }
        const ang = p.a0 + p.s * f * (p.len / p.r);
        return [p.cx + p.r * cos(ang), p.cy + p.r * sin(ang)];
      }
      cum += p.len;
    }
    return null;
  }
  R.ropePointAt = pointAt;
  /* Positions of all rope markers at the simulator's current state: [[x, y], ...] in model order */
  R.markerPositions = function (sim) {
    const out = [];
    for (const R0 of sim.ropes) {
      const mks = R0.el.markers || [];
      if (!mks.length) continue;
      const d = sim.ropeDraw(R0, sim.q), { pieces } = ropePath(null, d);
      for (const mk of mks) out.push(pointAt(pieces, (+mk.s || 0) - d.base) || [NaN, NaN]);
    }
    return out;
  };

  function drawRope(ctx, v, S, R0) {
    const { sim } = S, el = R0.el, d = sim.ropeDraw(R0, sim.q);
    drawSheaves(ctx, v, S, R0, d);
    const { path, pieces } = ropePath(v, d);
    R0.pieces = pieces; R0.drawData = d;
    if (S.sel === el.id || S.hover === el.id) { ctx.save(); ctx.strokeStyle = R.tok.accent; ctx.globalAlpha = S.sel === el.id ? 0.32 : 0.16; ctx.lineWidth = 14; ctx.lineJoin = 'round'; ctx.stroke(path); ctx.restore(); }
    for (const a of d.arcs) {
      if (!a.drum) continue;
      // the rope still wound on a finite drum (yo-yo): the ring thins as it pays out
      const E = (R0.ends || []).find((e) => e.j === a.j), nd0 = R0.nodes[a.j];
      const fr = E ? Math.max(0, Math.min(1, (E.wd - (sim.ropePay(R0, a.j) - E.pay0)) / (nd0.wound || 1))) : 1;
      ctx.save(); ctx.lineWidth = E ? 1.4 + 4.6 * fr : 3.4; ctx.strokeStyle = R.tok.ink; ctx.beginPath(); ctx.arc(v.X(a.cx), v.Y(a.cy), a.r * v.s, 0, 2 * PI); ctx.stroke(); ctx.restore();
    }
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = el.color ? R.tok[el.color] || el.color : R.tok.ink; ctx.stroke(path);
    ctx.setLineDash([7, 6]); ctx.lineDashOffset = -d.base * v.s; ctx.lineWidth = 2.3; ctx.strokeStyle = R.tok['rope-gap']; ctx.stroke(path);
    ctx.restore();
    d.segs.forEach((sg) => H({ id: el.id, pr: 2, t: 'seg', x0: v.X(sg.x0), y0: v.Y(sg.y0), x1: v.X(sg.x1), y1: v.Y(sg.y1), w: 8 }));
    // end fittings
    const N = R0.nodes.length, g = R0.g;
    [[0, 0], [N - 1, N - 2]].forEach(([j, k]) => {
      const nd = R0.nodes[j];
      if (nd.r > 0) return;
      const X = v.X(g.cx[j]), Y = v.Y(g.cy[j]), sgn = j === 0 ? 1 : -1;
      let ux = g.ux[k] * sgn, uy = -g.uy[k] * sgn;
      if (nd.i < 0 && el.nodes[j] && el.nodes[j].anchor) R.ring(ctx, X, Y, 3.2);
      else if (nd.i < 0) {
        const [mx, my] = axisDir(-(R0.u0x ? R0.u0x[k] : g.ux[k]) * sgn, -(R0.u0y ? R0.u0y[k] : g.uy[k]) * sgn, -1, 0);
        ux = -mx; uy = my;
        const bx = X - ux * 14, by = Y - uy * 14, px = -uy, py = ux;
        ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(bx + px * 7, by + py * 7); ctx.lineTo(bx - px * 7, by - py * 7); ctx.closePath();
        ctx.fillStyle = R.tok.paper; ctx.fill(); ctx.stroke();
        hatchTo(ctx, bx + px * 13, by + py * 13, bx - px * 13, by - py * 13, -ux, -uy);
        R.ring(ctx, X, Y, 3.2);
      } else {
        const px = -uy, py = ux;
        ctx.beginPath(); ctx.moveTo(X + ux * 7, Y + uy * 7); ctx.lineTo(X + px * 5, Y + py * 5); ctx.lineTo(X - px * 5, Y - py * 5); ctx.closePath();
        ctx.fillStyle = R.tok.ink; ctx.fill();
      }
    });
    for (const mk of el.markers || []) {
      const p = pointAt(pieces, (+mk.s || 0) - d.base);
      if (!p) continue;
      const X = v.X(p[0]), Y = v.Y(p[1]);
      ctx.save(); ctx.fillStyle = R.tok.ink; ctx.beginPath(); ctx.arc(X, Y, 5, 0, 2 * PI); ctx.fill(); ctx.restore();
      S.labels.push([mk.name, X - 16, Y - 12, 16]);
      mk._w = p;
    }
    if (d.degenerate) S.warnings.push(`Rope ${MB.plainName(el.name)}: two pulleys overlap`);
    if (d.arcs.some((a) => !a.drum && a.len < -1e-6)) S.warnings.push(`Rope ${MB.plainName(el.name)} would lift off a pulley (negative wrap angle). Flip that pulley's wrap direction.`);
  }

  /* ---------------- loads ---------------- */
  function drawLoad(ctx, v, S, f) {
    const { sim } = S, ib = sim.bodyIndex(f.b.body);
    if (ib < 0) return;
    ctx.save(); ctx.strokeStyle = ctx.fillStyle = R.tok.load; ctx.lineWidth = 2;
    const t = S.running || sim.t > 0 ? sim.t : 0;
    if (f.type === 'load') {
      const P = W(sim, f.b), X = v.X(P[0]), Y = v.Y(P[1]);
      const amp = abs(+f.F0 || 0) + abs(+f.F1 || 0) || 1;
      const F = (+f.F0 || 0) + (+f.F1 || 0) * sin(2 * PI * (+f.f || 0) * t + (+f.ph || 0) * D2R);
      const al = f.angle * D2R + (f.follower ? sim.q[3 * ib + 2] : 0);
      const scale = sim.t > 0 ? F / amp : (F || 1) >= 0 ? 1 : -1, L = 46 * max(0.15, abs(scale)) * Math.sign(scale || 1);
      const dx = cos(al), dy = -sin(al);
      halo(ctx, S, f.id, () => R.line(ctx, X - dx * L, Y - dy * L, X, Y));
      R.arrow(ctx, X - dx * L, Y - dy * L, X, Y, 10);
      H({ id: f.id, pr: 3, t: 'seg', x0: X - dx * L, y0: Y - dy * L, x1: X, y1: Y, w: 9 });
      if (S.model.settings.labels) S.labels.push([f.name, X - dx * (abs(L) + 12), Y - dy * (abs(L) + 12), 16, false, R.tok.load]);
    } else {
      const X = v.X(sim.q[3 * ib]), Y = v.Y(sim.q[3 * ib + 1]);
      const M = (+f.M0 || 0) + (+f.M1 || 0) * sin(2 * PI * (+f.f || 0) * t);
      halo(ctx, S, f.id, () => { ctx.beginPath(); ctx.arc(X, Y, 22, 0, 2 * PI); ctx.stroke(); });
      R.moment(ctx, X, Y, 22, M >= 0 ? 1 : -1);
      H({ id: f.id, pr: 3, t: 'pt', x: X, y: Y - 22, r: 12 });
      if (S.model.settings.labels) S.labels.push([f.name, X + 28, Y - 22, 16, false, R.tok.load]);
    }
    ctx.restore();
  }

  /* point on a curve: the wire drawn in the frame of its carrier, the bead as a ring */
  function curveWorld(sim, c, j) { const ia = c.ia, phi = j.angle * D2R + (ia >= 0 ? sim.q[3 * ia + 2] : 0), A = W(sim, j.a), k = c.curve, C = MB.CURVE[k.type] || MB.CURVE.circle, rg = C.closed && k.from != null && k.to != null ? [k.from * D2R, k.to * D2R] : C.range(k), u0 = rg[0], u1 = rg[1], n = C.closed ? 120 : 90, pts = [];
    for (let i = 0; i <= n; i++) { const p = C.c(k, u0 + ((u1 - u0) * i) / n); pts.push([A[0] + cos(phi) * p[0] - sin(phi) * p[1], A[1] + sin(phi) * p[0] + cos(phi) * p[1]]); } return pts; }
  function drawPath(ctx, v, S, j) {
    const { sim } = S, c = sim.byEl.get(j.id); if (!c) return; const pts = curveWorld(sim, c, j), B = W(sim, j.b), X = v.X(B[0]), Y = v.Y(B[1]);
    halo(ctx, S, j.id, () => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(v.X(p[0]), v.Y(p[1])) : ctx.moveTo(v.X(p[0]), v.Y(p[1])))); ctx.stroke(); });
    ctx.save(); ctx.strokeStyle = R.tok['ink-2']; ctx.lineWidth = 3.2; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(v.X(p[0]), v.Y(p[1])) : ctx.moveTo(v.X(p[0]), v.Y(p[1])))); ctx.stroke();
    ctx.strokeStyle = R.tok.paper; ctx.lineWidth = 1; ctx.globalAlpha = 0.6; ctx.stroke(); ctx.restore();
    for (let i = 0; i < pts.length - 1; i += 6) { const q2 = pts[min(pts.length - 1, i + 6)]; H({ id: j.id, pr: 2, t: 'seg', x0: v.X(pts[i][0]), y0: v.Y(pts[i][1]), x1: v.X(q2[0]), y1: v.Y(q2[1]), w: 6 }); }
    ctx.save(); ctx.lineWidth = 1.6; ctx.strokeStyle = R.tok.ink; R.ring(ctx, X, Y, 4.2); ctx.restore(); H({ id: j.id, pr: 3, t: 'pt', x: X, y: Y, r: 10 });
  }
  /* gear pair: toothed pitch circles turning with the two parts */
  function drawGear(ctx, v, S, j) {
    const { sim } = S, c = sim.byEl.get(j.id); if (!c) return; const ia = c.ia, ib = c.ib, q = sim.q, ra = +j.ra || 0.1, rb = +j.rb || 0.1, p0 = (2 * PI * min(ra, rb)) / 12;
    const gear = (i, r) => { const x = q[3 * i], y = q[3 * i + 1], th = q[3 * i + 2], N = max(8, round((2 * PI * r) / p0)), hh = 0.16 * p0, X = v.X(x), Y = v.Y(y); ctx.beginPath(); for (let k = 0; k <= 4 * N; k++) { const a = th + (k * 2 * PI) / (4 * N), rr = (k % 4 === 0 || k % 4 === 3 ? r - hh : r + hh) * v.s; const px = X + rr * cos(a), py = Y - rr * sin(a); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.stroke(); ctx.save(); ctx.setLineDash([3, 3]); ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(X, Y, r * v.s, 0, 2 * PI); ctx.stroke(); ctx.restore(); return [x, y]; };
    ctx.save(); ctx.strokeStyle = R.tok['ink-2']; ctx.lineWidth = 1.4; const A = gear(ia, ra), B = gear(ib, rb); ctx.restore();
    const d = hypot(B[0] - A[0], B[1] - A[1]) || 1, mx = A[0] + ((B[0] - A[0]) * ra) / d, my = A[1] + ((B[1] - A[1]) * ra) / d; halo(ctx, S, j.id, () => { ctx.beginPath(); ctx.arc(v.X(mx), v.Y(my), 9, 0, 2 * PI); ctx.stroke(); });
    H({ id: j.id, pr: 3, t: 'pt', x: v.X(mx), y: v.Y(my), r: 11 });
  }
  function drawJoint(ctx, v, S, j) {
    const { sim } = S;
    if (j.type === 'path') return drawPath(ctx, v, S, j);
    if (j.type === 'gear') return drawGear(ctx, v, S, j);
    if (!j.a.body) return drawSupport(ctx, v, S, j);
    const A = W(sim, j.a), B = W(sim, j.b), X = v.X(B[0]), Y = v.Y(B[1]);
    halo(ctx, S, j.id, () => { ctx.beginPath(); ctx.arc(X, Y, 9, 0, 2 * PI); ctx.stroke(); });
    ctx.save(); ctx.lineWidth = 1.5;
    if (j.type === 'rod') {
      const X0 = v.X(A[0]), Y0 = v.Y(A[1]);
      halo(ctx, S, j.id, () => R.line(ctx, X0, Y0, X, Y));
      ctx.lineWidth = 3.2; R.line(ctx, X0, Y0, X, Y); ctx.lineWidth = 1.5;
      R.ring(ctx, X0, Y0, 3.4); R.ring(ctx, X, Y, 3.4);
      H({ id: j.id, pr: 2, t: 'seg', x0: X0, y0: Y0, x1: X, y1: Y, w: 8 });
    } else if (j.type === 'fixed') {
      ctx.fillStyle = R.tok.ink; ctx.fillRect(X - 4, Y - 4, 8, 8);
      H({ id: j.id, pr: 3, t: 'pt', x: X, y: Y, r: 10 });
    } else if (j.type === 'slider' || j.type === 'roller') {
      const ia = sim.bodyIndex(j.a.body), al = j.angle * D2R + sim.q[3 * ia + 2], ux = cos(al), uy = -sin(al);
      ctx.strokeStyle = R.tok['ink-2']; R.line(ctx, X - ux * 22, Y - uy * 22, X + ux * 22, Y + uy * 22);
      ctx.strokeStyle = R.tok.ink;
      if (j.type === 'slider') { ctx.save(); ctx.translate(X, Y); ctx.rotate(-al); ctx.fillStyle = R.tok.paper; ctx.fillRect(-9, -5, 18, 10); ctx.strokeRect(-9, -5, 18, 10); ctx.restore(); }
      else R.ring(ctx, X, Y, 3.6);
      H({ id: j.id, pr: 3, t: 'pt', x: X, y: Y, r: 11 });
    } else {
      R.ring(ctx, X, Y, 3.8);
      if (j.drive !== 'none') { ctx.strokeStyle = ctx.fillStyle = R.tok['ink-2']; ctx.lineWidth = 1.3; R.moment(ctx, X, Y, 12, 1); }
      H({ id: j.id, pr: 3, t: 'pt', x: X, y: Y, r: 11 });
    }
    ctx.restore();
  }

  /* Reaction forces / tensions (display option) */
  function drawReactions(ctx, v, S) {
    const { sim, snap } = S;
    if (!snap) return;
    const arrows = [];
    for (const c of sim.cons) {
      const r = c.row, lam = snap.lam;
      let fx = 0, fy = 0, P = null;
      if (c.kind === 'joint' && c.ia < 0 && c.ib >= 0) {
        P = W(sim, c.el.b);
        if (c.type === 'pin' || c.type === 'fixed') { fx = lam[r]; fy = lam[r + 1]; P = c.el.a.p; }
        else if (c.type === 'roller' || c.type === 'slider') { const al = c.el.angle * D2R; fx = -sin(al) * lam[r]; fy = cos(al) * lam[r]; }
        else if (c.type === 'rolling') { fx = c.nx * lam[r] + c.ux * lam[r + 1]; fy = c.ny * lam[r] + c.uy * lam[r + 1]; P = [sim.q[3 * c.ib] - c.nx * c.R, sim.q[3 * c.ib + 1] - c.ny * c.R]; }
        else if (c.type === 'path' && c.n && c.P) { fx = c.n[0] * lam[r]; fy = c.n[1] * lam[r]; P = c.P; }
      } else if (c.kind === 'stop' && lam[r] > 1e-9) {
        const B = W(sim, c.el.b); P = B; fx = c.nx * lam[r]; fy = c.ny * lam[r];
        if (B[2] < 0) { P = W(sim, c.el.a); fx = -fx; fy = -fy; }
      } else if (c.kind === 'contact') {
        for (let f = 0; f < c.feats.length; f++) {
          const rn = r + 2 * f, ln = lam[rn];
          if (!(ln > 1e-9)) continue;
          const sl = snap.slip ? snap.slip[rn] : 0, lt = sl ? -sim.mu[rn] * sl * ln : lam[rn + 1];
          const nx = c.nx[f], ny = c.ny[f];
          arrows.push([[c.px[f], c.py[f]], nx * ln - ny * lt, ny * ln + nx * lt]);
        }
      } else if (c.kind === 'rope' && c.drawData) {
        c.subs.forEach((sub, si) => {
          const sg = c.drawData.segs[sub.a];
          if (!sg) return;
          const T = lam[r + si], X = v.X((sg.x0 + sg.x1) / 2), Y = v.Y((sg.y0 + sg.y1) / 2);
          R.mono(ctx, `${MB.plainName(c.el.name)}${c.subs.length > 1 ? ' [' + (si + 1) + ']' : ''} = ${T.toFixed(1)} N`, X + 9, Y - 10, 11, R.tok.react);
        });
      }
      if (P && hypot(fx, fy) > 1e-6) arrows.push([P, fx, fy]);
    }
    const cur = arrows.reduce((m, a) => max(m, hypot(a[1], a[2])), 1e-9), RS = R._react || (R._react = { m: 1e-9, sim: null });
    if (RS.sim !== sim) { RS.sim = sim; RS.m = 1e-9; }
    const Fm = (RS.m = max(cur, RS.m * (S.running ? 0.996 : 1)));
    ctx.save(); ctx.strokeStyle = ctx.fillStyle = R.tok.react; ctx.lineWidth = 2;
    for (const [P, fx, fy] of arrows) {
      const F = hypot(fx, fy), L = 18 + 46 * (F / Fm), X = v.X(P[0]), Y = v.Y(P[1]);
      const ux = fx / F, uy = -fy / F;
      R.arrow(ctx, X - ux * L, Y - uy * L, X - ux * 4, Y - uy * 4, 9);
      R.mono(ctx, `${F.toFixed(1)} N`, X - ux * L + 4, Y - uy * L - 9, 11, R.tok.react);
    }
    ctx.restore();
  }

  /* Surface: polyline with continuous 45° hatching on its solid side; belt motion shown by chevrons */
  function drawSurface(ctx, v, S, sf) {
    const el = sf.el, sim = S.sim, io = sf.io, q = sim.q, P = sf.P, N = sf.N;
    let ca = 1, sa = 0, rx = 0, ry = 0;
    if (io >= 0) { rx = q[3 * io]; ry = q[3 * io + 1]; ca = cos(q[3 * io + 2]); sa = sin(q[3 * io + 2]); }
    const X = new Float64Array(N), Y = new Float64Array(N);
    for (let k = 0; k < N; k++) { X[k] = v.X(rx + ca * P[2 * k] - sa * P[2 * k + 1]); Y[k] = v.Y(ry + sa * P[2 * k] + ca * P[2 * k + 1]); }
    const path = () => { ctx.beginPath(); ctx.moveTo(X[0], Y[0]); for (let k = 1; k < N; k++) ctx.lineTo(X[k], Y[k]); };
    if (S.sel === el.id || S.hover === el.id) { ctx.save(); ctx.strokeStyle = R.tok.accent; ctx.globalAlpha = S.sel === el.id ? 0.32 : 0.16; ctx.lineWidth = 12; ctx.lineJoin = 'round'; path(); ctx.stroke(); ctx.restore(); }
    ctx.save();
    ctx.lineWidth = 1; ctx.strokeStyle = R.tok.ink; ctx.beginPath();
    const side = el.side >= 0 ? 1 : -1, gap = 7, len = 7;
    let carry = gap * 0.5;
    for (let k = 0; k < N - 1; k++) {
      const dx = X[k + 1] - X[k], dy = Y[k + 1] - Y[k], L = hypot(dx, dy);
      if (L < 1e-9) continue;
      const ux = dx / L, uy = dy / L, hx = -uy * side, hy = ux * side;
      let t = carry;
      for (; t <= L; t += gap) { const px = X[k] + ux * t, py = Y[k] + uy * t; ctx.moveTo(px, py); ctx.lineTo(px + hx * len - ux * len * 0.75, py + hy * len - uy * len * 0.75); }
      carry = t - L;
    }
    ctx.stroke();
    ctx.lineWidth = 1.8; path(); ctx.stroke();
    const belt = +el.belt || 0;
    if (belt) {
      ctx.strokeStyle = R.tok['ink-2']; ctx.lineWidth = 1.3;
      const shift = ((sim.t * belt * v.s) % 40 + 40) % 40;
      let acc = shift;
      for (let k = 0; k < N - 1; k++) {
        const dx = X[k + 1] - X[k], dy = Y[k + 1] - Y[k], L = hypot(dx, dy);
        if (L < 1e-9) continue;
        const ux = dx / L, uy = dy / L, hx = uy * side, hy = -ux * side, sg = Math.sign(belt);
        let t = acc;
        for (; t <= L; t += 40) {
          const px = X[k] + ux * t + hx * 5, py = Y[k] + uy * t + hy * 5;
          ctx.beginPath(); ctx.moveTo(px - sg * ux * 4 + hx * 3, py - sg * uy * 4 + hy * 3); ctx.lineTo(px + sg * ux * 2, py + sg * uy * 2); ctx.lineTo(px - sg * ux * 4 - hx * 3, py - sg * uy * 4 - hy * 3); ctx.stroke();
        }
        acc = t - L;
      }
    }
    ctx.restore();
    for (let k = 0; k < N - 1; k++) H({ id: el.id, pr: 2, t: 'seg', x0: X[k], y0: Y[k], x1: X[k + 1], y1: Y[k + 1], w: 8 });
    if (S.model.settings.labels && el.name) S.labels.push([el.name, X[0] + 10, Y[0] - 14, 14]);
  }

  /* Fixed point to hang things from: ring + hatched mount on the ground side */
  const ANCH = { above: [0, 1], below: [0, -1], left: [-1, 0], right: [1, 0] };
  function anchorSide(model, a) {
    if (ANCH[a.mount]) return ANCH[a.mount];
    let sx = 0, sy = 0;
    const other = (ref, oth) => { if (ref && ref.anchor === a.id && oth) { const w = MB.toWorld(model, oth); sx += w[0] - a.p[0]; sy += w[1] - a.p[1]; } };
    for (const f of model.forces) if (f.a && f.b) { other(f.a, f.b); other(f.b, f.a); }
    for (const j of model.joints) { other(j.a, j.b); other(j.b, j.a); }
    for (const s of model.stops) { other(s.a, s.b); other(s.b, s.a); }
    for (const r of model.ropes) r.nodes.forEach((n, k) => other(n, r.nodes[k === 0 ? 1 : k - 1]));
    if (hypot(sx, sy) < 1e-9) return [0, 1];
    return abs(sy) >= 0.5 * abs(sx) ? [0, -Math.sign(sy)] : [-Math.sign(sx), 0];
  }
  function drawAnchor(ctx, v, S, a) {
    const X = v.X(a.p[0]), Y = v.Y(a.p[1]), [gx, gy] = anchorSide(S.model, a), sx = gx, sy = -gy;
    const bx = X + sx * 11, by = Y + sy * 11, px = -sy, py = sx;
    halo(ctx, S, a.id, () => { ctx.beginPath(); ctx.arc(X, Y, 10, 0, 2 * PI); ctx.stroke(); });
    ctx.save(); ctx.lineWidth = 1.6; ctx.strokeStyle = R.tok.ink;
    R.line(ctx, X, Y, bx, by);
    hatchTo(ctx, bx + px * 14, by + py * 14, bx - px * 14, by - py * 14, sx, sy);
    R.ring(ctx, X, Y, 3.4);
    ctx.restore();
    H({ id: a.id, pr: 3, t: 'pt', x: X, y: Y, r: 12 });
    if (S.model.settings.labels && a.name) S.labels.push([a.name, X - px * 26 - sx * 4, Y - py * 26 - sy * 4, 14]);
  }

  function drawTrails(ctx, v, S) {
    const hist = S.history;
    if (!hist || hist.length < 2) return;
    const cols = ['plot1', 'plot2', 'plot3', 'plot4', 'plot5', 'plot6'];
    ctx.save(); ctx.lineWidth = 1.4; ctx.globalAlpha = 0.75;
    const nb = S.sim.nb, start = max(0, hist.length - 1500);
    for (let i = 0; i < nb; i++) {
      ctx.strokeStyle = R.tok[cols[i % cols.length]]; ctx.beginPath();
      for (let k = start; k < hist.length; k++) { const q = hist[k].q; if (q.length <= 3 * i + 1) continue; const X = v.X(q[3 * i]), Y = v.Y(q[3 * i + 1]); k === start ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y); }
      ctx.stroke();
    }
    ctx.restore();
  }

  R.draw = function (ctx, v, S) {
    hits = []; S.labels = []; S.warnings = [];
    const st = S.model.settings;
    ctx.fillStyle = R.tok.paper; ctx.fillRect(0, 0, v.W, v.H);
    if (st.grid) R.grid(ctx, v);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = R.tok.ink; ctx.fillStyle = R.tok.ink; ctx.lineWidth = 1.6;
    if (st.frames) R.frame(ctx, v.X(st.origin[0]), v.Y(st.origin[1]));
    drawRails(ctx, v, S);
    ctx.strokeStyle = R.tok.ink; ctx.lineWidth = 1.6;
    for (const s of S.model.stops) drawStop(ctx, v, S, s);
    for (const sf of S.sim.surfs || []) drawSurface(ctx, v, S, sf);
    for (const a of S.model.anchors || []) drawAnchor(ctx, v, S, a);
    for (const j of S.model.joints) if (!j.a.body && j.type === 'rolling') drawJoint(ctx, v, S, j);
    if (st.trails) drawTrails(ctx, v, S);
    /* layered elements: drawn in z order (MB.zOf), so parts can be brought to front or sent back */
    const items = [];
    for (const f of S.model.forces) if (f.type === 'sd' || f.type === 'torsion') items.push([f, () => drawSD(ctx, v, S, f)]);
    S.model.bodies.forEach((b, i) => items.push([b, () => drawBody(ctx, v, S, b, i)]));
    for (const R0 of S.sim.ropes) items.push([R0.el, () => drawRope(ctx, v, S, R0)]);
    for (const j of S.model.joints) if (j.a.body || j.type !== 'rolling') items.push([j, () => drawJoint(ctx, v, S, j)]);
    for (const f of S.model.forces) if (f.type === 'load' || f.type === 'torque') items.push([f, () => drawLoad(ctx, v, S, f)]);
    items.map((it, k) => [MB.zOf(it[0]), k, it[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).forEach((it) => {
      ctx.strokeStyle = R.tok.ink; ctx.fillStyle = R.tok.ink; ctx.lineWidth = 1.6; ctx.setLineDash([]); ctx.globalAlpha = 1;
      it[2]();
    });
    if (st.forces) drawReactions(ctx, v, S);
    if (MB.Overlay) { try { MB.Overlay.draw(ctx, v, S); } catch (e) { console.error(e); } }
    for (const [name, x, y, size, , col] of S.labels) {
      ctx.save(); ctx.font = `${size}px serif`; ctx.restore();
      R.label(ctx, name, x, y, size, col || R.tok.ink, 'center');
    }
    if (S.handles) {
      ctx.save();
      for (const h of S.handles) {
        const X = v.X(h.x), Y = v.Y(h.y);
        ctx.fillStyle = h.kind === 'rot' ? R.tok.paper : R.tok.accent; ctx.strokeStyle = h.kind === 'rot' ? R.tok.accent : R.tok.paper; ctx.lineWidth = 2;
        ctx.beginPath(); h.kind === 'rot' ? ctx.arc(X, Y, 7, 0, 2 * PI) : ctx.rect(X - 6, Y - 6, 12, 12); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }
  };

  /* Hit test against shapes recorded in the last draw: handles > points > lines > bodies */
  R.hit = function (v, S, sx, sy) {
    if (S.handles) for (let k = S.handles.length - 1; k >= 0; k--) { const h = S.handles[k]; if (hypot(v.X(h.x) - sx, v.Y(h.y) - sy) < 13) return { handle: h, id: h.id }; }
    /* small markers (pins, loads, stops) first; otherwise whatever is drawn on top */
    let best = null, bp = -1;
    for (let k = hits.length - 1; k >= 0; k--) {
      const h = hits[k], pr = h.pr === 3 ? 1 : 0;
      if (pr <= bp) continue;
      let ok = false, dist = 0;
      if (h.t === 'pt' || h.t === 'circle') ok = hypot(h.x - sx, h.y - sy) <= h.r + 3;
      else if (h.t === 'seg') {
        const dx = h.x1 - h.x0, dy = h.y1 - h.y0, L2 = dx * dx + dy * dy || 1;
        const u = max(0, min(1, ((sx - h.x0) * dx + (sy - h.y0) * dy) / L2));
        dist = hypot(h.x0 + u * dx - sx, h.y0 + u * dy - sy); ok = dist <= h.w;
      } else if (h.t === 'poly') {
        let inside = false; const p = h.pts;
        for (let a = 0, b = p.length - 1; a < p.length; b = a++) if ((p[a][1] > sy) !== (p[b][1] > sy) && sx < ((p[b][0] - p[a][0]) * (sy - p[a][1])) / (p[b][1] - p[a][1]) + p[a][0]) inside = !inside;
        ok = inside;
      }
      if (ok) { best = h; bp = pr; }
      void dist;
    }
    return best ? { id: best.id } : null;
  };

  /* Bodies under a world point (topmost first), using the simulated pose */
  R.bodiesAt = function (S, wx, wy, pad) {
    const out = [], sim = S.sim, p = pad || 0;
    S.model.bodies.forEach((b, i) => {
      const x = sim.q[3 * i], y = sim.q[3 * i + 1], th = sim.q[3 * i + 2], dx = wx - x, dy = wy - y;
      if (b.shape === 'disk') { if (hypot(dx, dy) <= b.r + p) out.push(b); }
      else { const lx = cos(th) * dx + sin(th) * dy, ly = -sin(th) * dx + cos(th) * dy; if (abs(lx) <= b.w / 2 + p && abs(ly) <= b.h / 2 + p) out.push(b); }
    });
    return out.reverse();
  };
  void atan2;
})(typeof window !== 'undefined' ? window : globalThis);
