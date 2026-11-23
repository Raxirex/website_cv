/* Dynamic Interactive Labs — contact between parts and surfaces (disk rims and block corners vs polylines)
   Normal row:   C = gap ≥ 0 (unilateral, Newton restitution on closing)
   Friction row: velocity-level stick condition t·(v_B − v_A) − belt = 0 while |λ_t| ≤ μ λ_n;
                 otherwise sliding with the normal force acting along n − μ·sign(v_t)·t. */
(function (G) {
  'use strict';
  const MB = G.MB, S = MB.Sim.prototype;
  const { sqrt, max, min, cos, sin, hypot } = Math;

  /* Closest point of segments k0..k1 (segment k = P[k] → P[k+1]) to (x, y) */
  function closest(P, k0, k1, x, y, o) {
    let best = Infinity;
    for (let k = k0; k <= k1; k++) {
      const ax = P[2 * k], ay = P[2 * k + 1], dx = P[2 * k + 2] - ax, dy = P[2 * k + 3] - ay, L2 = dx * dx + dy * dy || 1e-30;
      let u = ((x - ax) * dx + (y - ay) * dy) / L2;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const qx = ax + u * dx, qy = ay + u * dy, d2 = (x - qx) * (x - qx) + (y - qy) * (y - qy);
      if (d2 < best) { best = d2; o.k = k; o.u = u; o.qx = qx; o.qy = qy; o.d2 = d2; o.dx = dx; o.dy = dy; }
    }
    return o;
  }
  MB.closestOnPolyline = closest;

  S.evContact = function (c, q, qd) {
    const sf = c.sf, P = sf.P, N = sf.N, ia = c.ia, ib = c.ib, el = c.el;
    const C = this.C, gam = this.gam, ct = this.ct;
    let rax = 0, ray = 0, ca = 1, sa = 0, wa = 0, vax = 0, vay = 0;
    if (ia >= 0) {
      rax = q[3 * ia]; ray = q[3 * ia + 1]; ca = cos(q[3 * ia + 2]); sa = sin(q[3 * ia + 2]);
      if (qd) { vax = qd[3 * ia]; vay = qd[3 * ia + 1]; wa = qd[3 * ia + 2]; }
    }
    const rbx = q[3 * ib], rby = q[3 * ib + 1], cb = cos(q[3 * ib + 2]), sbn = sin(q[3 * ib + 2]);
    const vbx = qd ? qd[3 * ib] : 0, vby = qd ? qd[3 * ib + 1] : 0, wb = qd ? qd[3 * ib + 2] : 0;
    const box = sf.box, o = this._cp || (this._cp = {});
    for (let f = 0; f < c.feats.length; f++) {
      const r = c.row + 2 * f, rt = r + 1, fl = c.feats[f];
      ct[r] = 0; ct[rt] = 0; gam[r] = 0; gam[rt] = 0; C[rt] = 0;
      const sBx = cb * fl[0] - sbn * fl[1], sBy = sbn * fl[0] + cb * fl[1];
      const ex = rbx + sBx - rax, ey = rby + sBy - ray, lx = ca * ex + sa * ey, ly = -sa * ex + ca * ey;
      const pad = (c.disk ? c.R : 0) + 0.05;
      if (lx < box[0] - pad || lx > box[2] + pad || ly < box[1] - pad || ly > box[3] + pad) { C[r] = 1e3; c.cache[f] = -1; continue; }
      const kc = c.cache[f];
      let k0 = 0, k1 = N - 2;
      if (kc >= 0) { k0 = max(0, kc - 3); k1 = min(N - 2, kc + 3); }
      closest(P, k0, k1, lx, ly, o);
      if (kc >= 0 && ((o.k === k0 && o.u === 0 && k0 > 0) || (o.k === k1 && o.u === 1 && k1 < N - 2))) closest(P, 0, N - 2, lx, ly, o);
      c.cache[f] = o.k;
      const dlx = lx - o.qx, dly = ly - o.qy, dist = sqrt(o.d2);
      const sl = hypot(o.dx, o.dy) || 1, lnx = -o.dy / sl, lny = o.dx / sl;
      const vertex = o.u <= 0 || o.u >= 1;
      let nlx, nly, gap;
      if (c.disk) {
        if (dist > 1e-9) { nlx = dlx / dist; nly = dly / dist; } else { nlx = lnx; nly = lny; }
        gap = dist - c.R;
      } else {
        const sd = lnx * dlx + lny * dly;
        let sg = c.side[f];
        if (!sg || (!this.act[r] && dist > 0.02)) sg = c.side[f] = sd >= 0 ? 1 : -1;
        if (!vertex || dist < 1e-9) { nlx = sg * lnx; nly = sg * lny; }
        else { nlx = dlx / dist; nly = dly / dist; if ((nlx * lnx + nly * lny) * sg < 0) { nlx = -nlx; nly = -nly; } }
        gap = nlx * dlx + nly * dly;
      }
      const nx = ca * nlx - sa * nly, ny = sa * nlx + ca * nly;
      const Qx = rax + ca * o.qx - sa * o.qy, Qy = ray + sa * o.qx + ca * o.qy;
      c.px[f] = Qx; c.py[f] = Qy; c.nx[f] = nx; c.ny[f] = ny;
      C[r] = gap;
      if (gap > 0.25 + c.reach) continue;
      const sAx = Qx - rax, sAy = Qy - ray;
      if (c.disk) this.aJ(r, ib, nx, ny, 0); else this.aJ(r, ib, nx, ny, sBx * ny - sBy * nx);
      if (ia >= 0) this.aJ(r, ia, -nx, -ny, -(sAx * ny - sAy * nx));
      let g = 0;
      if (!c.disk) g += wb * wb * (nx * sBx + ny * sBy);
      if (ia >= 0) g -= wa * wa * (nx * sAx + ny * sAy);
      if (c.disk && vertex && dist > 1e-6 && qd) {
        const svx = ia >= 0 ? vax - wa * sAy : 0, svy = ia >= 0 ? vay + wa * sAx : 0;
        const dvx = vbx - svx, dvy = vby - svy, dn = dvx * nx + dvy * ny;
        g -= (dvx * dvx + dvy * dvy - dn * dn) / dist;
      }
      gam[r] = g;
      const tx = -ny, ty = nx, sTx = c.disk ? -nx * c.R : sBx, sTy = c.disk ? -ny * c.R : sBy;
      this.aJ(rt, ib, tx, ty, sTx * ty - sTy * tx);
      if (ia >= 0) this.aJ(rt, ia, -tx, -ty, -(sAx * ty - sAy * tx));
      const belt = +el.belt || 0;
      if (belt) { const ux = o.dx / sl, uy = o.dy / sl; ct[rt] = -belt * (tx * (ca * ux - sa * uy) + ty * (sa * ux + ca * uy)); }
      gam[rt] = (c.disk ? 0 : wb * wb * (tx * sBx + ty * sBy)) - (ia >= 0 ? wa * wa * (tx * sAx + ty * sAy) : 0);
    }
  };

  S.refreshContactParams = function () {
    for (const c of this.cons) {
      if (c.kind !== 'contact') continue;
      const mu = Math.max(0, +c.el.mu || 0), e = Math.max(0, Math.min(1, +c.el.e || 0));
      for (let f = 0; f < c.feats.length; f++) { const r = c.row + 2 * f; this.mu[r] = this.mu[r + 1] = mu; this.rest[r] = e; }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
