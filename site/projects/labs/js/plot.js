/* Dynamic Interactive Labs — channels (what can be plotted) + strip-chart / phase plot */
(function (G) {
  'use strict';
  const MB = G.MB, R = MB.R;
  const { max, min, abs, hypot, PI, floor, log10, pow, ceil } = Math;
  const R2D = 180 / PI;

  /* Channel catalogue for the current model/simulator */
  MB.channels = function (model, sim) {
    const out = [];
    const add = (key, group, label, unit, fn) => out.push({ key, group, label, unit, fn });
    model.bodies.forEach((b, i) => {
      const g = MB.plainName(b.name), k = b.id, bn = g;
      add(`${k}|x`, g, `${bn} · x`, 'm', (s) => s.q[3 * i]);
      add(`${k}|y`, g, `${bn} · y`, 'm', (s) => s.q[3 * i + 1]);
      add(`${k}|th`, g, `${bn} · φ`, '°', (s) => s.q[3 * i + 2] * R2D);
      add(`${k}|vx`, g, `${bn} · ẋ`, 'm/s', (s) => s.qd[3 * i]);
      add(`${k}|vy`, g, `${bn} · ẏ`, 'm/s', (s) => s.qd[3 * i + 1]);
      add(`${k}|om`, g, `${bn} · ω`, 'rad/s', (s) => s.qd[3 * i + 2]);
      add(`${k}|v`, g, `${bn} · |v|`, 'm/s', (s) => hypot(s.qd[3 * i], s.qd[3 * i + 1]));
      add(`${k}|ax`, g, `${bn} · ẍ`, 'm/s²', (s) => s.a[3 * i]);
      add(`${k}|ay`, g, `${bn} · ÿ`, 'm/s²', (s) => s.a[3 * i + 1]);
      add(`${k}|al`, g, `${bn} · ω̇`, 'rad/s²', (s) => s.a[3 * i + 2]);
    });
    for (const c of sim.cons) {
      const el = c.el, r = c.row, nm = MB.plainName(el.name) || MB.typeName(el);
      if (c.kind === 'joint') {
        const g = 'Supports & joints';
        if (c.type === 'pin' || c.type === 'fixed') {
          add(`${el.id}|fx`, g, `${nm} · Fₓ`, 'N', (s) => s.lam[r]);
          add(`${el.id}|fy`, g, `${nm} · F_y`, 'N', (s) => s.lam[r + 1]);
          add(`${el.id}|f`, g, `${nm} · |F|`, 'N', (s) => hypot(s.lam[r], s.lam[r + 1]));
          if (c.type === 'fixed') add(`${el.id}|m`, g, `${nm} · M`, 'N·m', (s) => s.lam[r + 2]);
          else if (el.drive === 'speed') add(`${el.id}|drv`, g, `${nm} · drive torque`, 'N·m', (s) => s.lam[r + 2]);
        } else if (c.type === 'roller' || c.type === 'slider') {
          add(`${el.id}|n`, g, `${nm} · N`, 'N', (s) => s.lam[r]);
          if (c.type === 'slider') add(`${el.id}|m`, g, `${nm} · M`, 'N·m', (s) => s.lam[r + 1]);
          if (el.drive === 'speed') add(`${el.id}|drv`, g, `${nm} · drive force`, 'N', (s) => s.lam[r + c.rows - 1]);
        } else if (c.type === 'rolling') {
          add(`${el.id}|n`, g, `${nm} · N`, 'N', (s) => s.lam[r]);
          add(`${el.id}|h`, g, `${nm} · friction`, 'N', (s) => s.lam[r + 1]);
        } else if (c.type === 'rod') add(`${el.id}|f`, g, `${nm} · rod force`, 'N', (s) => s.lam[r]);
        else if (c.type === 'path') add(`${el.id}|n`, g, `${nm} · normal force`, 'N', (s) => s.lam[r]);
        else if (c.type === 'gear') add(`${el.id}|f`, g, `${nm} · tooth force`, 'N', (s) => s.lam[r]);
      } else if (c.kind === 'stop') add(`${el.id}|n`, 'Stops', `${nm} · contact`, 'N', (s) => s.lam[r]);
      else if (c.kind === 'contact') {
        const b = model.bodies[c.ib], key = `${el.id}:${b.id}`, lab = `${nm} · ${MB.plainName(b.name)}`, nf = c.feats.length;
        add(`${key}|N`, 'Surfaces', `${lab} · normal force`, 'N', (s) => { let t = 0; for (let f = 0; f < nf; f++) t += s.lam[r + 2 * f]; return t; });
        add(`${key}|T`, 'Surfaces', `${lab} · friction`, 'N', (s) => {
          let t = 0;
          for (let f = 0; f < nf; f++) { const rn = r + 2 * f, sl = s.slip ? s.slip[rn] : 0; t += sl ? -sim.mu[rn] * sl * s.lam[rn] : s.lam[rn + 1]; }
          return t;
        });
      }
      else if (c.kind === 'rope') {
        c.subs.forEach((sub, si) => add(`${el.id}|S${si}`, 'Ropes', `${nm}${c.subs.length > 1 ? ' span ' + (si + 1) : ''} · tension`, 'N', (s) => s.lam[r + si]));
      }
    }
    let mi = 0;
    for (const R0 of sim.ropes) for (const mk of R0.el.markers || []) {
      const k = mi++;
      add(`${R0.el.id}|mx${k}`, 'Ropes', `point ${mk.name} · x`, 'm', (s) => (s.mk ? s.mk[2 * k] : NaN));
      add(`${R0.el.id}|my${k}`, 'Ropes', `point ${mk.name} · y`, 'm', (s) => (s.mk ? s.mk[2 * k + 1] : NaN));
    }
    sim.fl.forEach((f, i) => {
      const el = f.el, nm = MB.plainName(el.name) || MB.typeName(el), g = 'Springs & loads';
      if (el.type === 'sd') {
        add(`${el.id}|L`, g, `${nm} · length`, 'm', (s) => s.len[i]);
        add(`${el.id}|F`, g, `${nm} · force`, 'N', (s) => s.forces[i]);
      } else if (el.type === 'torsion') add(`${el.id}|F`, g, `${nm} · moment`, 'N·m', (s) => s.forces[i]);
      else if (el.type === 'load') add(`${el.id}|F`, g, `${nm} · F(t)`, 'N', (s) => s.forces[i]);
      else if (el.type === 'torque') add(`${el.id}|F`, g, `${nm} · M(t)`, 'N·m', (s) => s.forces[i]);
    });
    const g = 'Energy';
    add('E|T', g, 'Kinetic energy T', 'J', (s) => s.T);
    add('E|V', g, 'Potential energy V', 'J', (s) => s.V);
    add('E|E', g, 'Total energy T + V', 'J', (s) => s.E);
    add('E|W', g, 'Work of non-conservative forces', 'J', (s) => s.Wnc);
    add('E|D', g, 'Energy balance error', 'J', (s) => s.drift);
    return out;
  };

  const nice = (span) => {
    const e = pow(10, floor(log10(span || 1)));
    return [1, 2, 2.5, 5, 10].map((k) => k * e).find((s) => span / s <= 4) || 10 * e;
  };
  MB.fmt = function (v, d) {
    if (!Number.isFinite(v)) return '—';
    const a = abs(v);
    if (a < 1e-12) return (0).toFixed(d != null ? d : 3);
    if (a !== 0 && (a < 1e-3 || a >= 1e5)) return v.toExponential(2).replace('e', 'e');
    return v.toFixed(d != null ? d : a >= 100 ? 1 : a >= 10 ? 2 : 3);
  };

  MB.Plot = class {
    constructor(app) {
      this.app = app; this.keys = []; this.win = 10; this.mode = 'time'; this.cursor = null;
      this.cv = document.getElementById('plotCanvas'); this.ctx = this.cv.getContext('2d');
      const onMove = (e) => { const r = this.cv.getBoundingClientRect(); this.cursor = e.clientX - r.left; this.app.invalidatePlot(); };
      this.cv.addEventListener('pointermove', onMove);
      this.cv.addEventListener('pointerdown', onMove);
      this.cv.addEventListener('pointerleave', () => { this.cursor = null; this.app.invalidatePlot(); });
    }
    colors() { return ['plot1', 'plot2', 'plot3', 'plot4', 'plot5', 'plot6'].map((k) => R.tok[k]); }
    resolve(cat) { const by = new Map(cat.map((c) => [c.key, c])); return this.keys.map((k) => by.get(k)).filter(Boolean); }

    draw(hist, cat) {
      const cv = this.cv, dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
      if (!W || !H) return;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      const ctx = this.ctx; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = R.tok.panel; ctx.fillRect(0, 0, W, H);
      const chans = this.resolve(cat), cols = this.colors();
      this.last = [];
      if (!chans.length) { R.mono(ctx, 'Add a channel to plot it', W / 2, H / 2, 12, R.tok['ink-3'], 'center'); return; }
      if (!hist.length) { R.mono(ctx, 'Press play to record', W / 2, H / 2, 12, R.tok['ink-3'], 'center'); return; }
      if (this.mode === 'phase' && chans.length >= 2) return this.drawPhase(ctx, W, H, hist, chans, cols);
      const tEnd = hist[hist.length - 1].t, tStart = this.win ? max(hist[0].t, tEnd - this.win) : hist[0].t;
      const span = max(1e-6, tEnd - tStart), padL = 52, padR = 12, padB = 20, gap = 6;
      let i0 = 0;
      { let lo = 0, hi = hist.length - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (hist[mid].t < tStart) lo = mid + 1; else hi = mid; } i0 = lo; }
      const n = hist.length - i0, stride = max(1, floor(n / (W * 1.5)));
      const lanes = chans.length, laneH = (H - padB - gap * (lanes - 1) - 6) / lanes;
      const X = (t) => padL + ((t - tStart) / span) * (W - padL - padR);
      let ci = -1;
      if (this.cursor != null && this.cursor > padL) {
        const tc = tStart + ((this.cursor - padL) / (W - padL - padR)) * span;
        let lo = i0, hi = hist.length - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (hist[mid].t < tc) lo = mid + 1; else hi = mid; }
        ci = lo;
      }
      chans.forEach((ch, li) => {
        const top = 6 + li * (laneH + gap), bot = top + laneH;
        let lo = Infinity, hi = -Infinity;
        for (let k = i0; k < hist.length; k += stride) { const y = ch.fn(hist[k]); if (Number.isFinite(y)) { lo = min(lo, y); hi = max(hi, y); } }
        if (!Number.isFinite(lo)) { lo = -1; hi = 1; }
        if (hi - lo < 1e-9 * max(1, abs(hi))) { const c = (hi + lo) / 2, d = max(abs(c) * 0.05, 1e-6); lo = c - d; hi = c + d; }
        const st = nice((hi - lo) / 1), lo2 = floor(lo / st) * st, hi2 = ceil(hi / st) * st;
        const Y = (y) => bot - ((y - lo2) / (hi2 - lo2 || 1)) * (laneH - 4) - 2;
        ctx.strokeStyle = R.tok.line; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(padL, top); ctx.lineTo(padL, bot); ctx.lineTo(W - padR, bot); ctx.stroke();
        ctx.strokeStyle = R.tok.grid; ctx.beginPath();
        for (let y = lo2; y <= hi2 + st * 0.01; y += st) { const yy = Math.round(Y(y)) + 0.5; ctx.moveTo(padL, yy); ctx.lineTo(W - padR, yy); }
        ctx.stroke();
        const labs = laneH > 80 ? [lo2, (lo2 + hi2) / 2, hi2] : laneH > 44 ? [lo2, hi2] : [hi2];
        labs.forEach((y) => R.mono(ctx, MB.fmt(y), padL - 5, y === hi2 ? max(top + 5, Y(y)) : min(bot - 5, Y(y)), 10, R.tok['ink-3'], 'right'));
        if (lo2 < 0 && hi2 > 0) { ctx.strokeStyle = R.tok['grid-major']; ctx.beginPath(); ctx.moveTo(padL, Y(0)); ctx.lineTo(W - padR, Y(0)); ctx.stroke(); }
        const col = cols[li % cols.length];
        ctx.save(); ctx.beginPath(); ctx.rect(padL, top - 2, W - padL - padR, laneH + 4); ctx.clip();
        ctx.beginPath(); let first = true, lx = 0, ly = 0;
        for (let k = i0; k < hist.length; k += stride) {
          const y = ch.fn(hist[k]); if (!Number.isFinite(y)) continue;
          lx = X(hist[k].t); ly = Y(y);
          first ? ctx.moveTo(lx, ly) : ctx.lineTo(lx, ly); first = false;
        }
        const yl = ch.fn(hist[hist.length - 1]);
        if (Number.isFinite(yl)) { lx = X(hist[hist.length - 1].t); ly = Y(yl); ctx.lineTo(lx, ly); }
        ctx.strokeStyle = col; ctx.lineWidth = 1.7; ctx.lineJoin = 'round'; ctx.stroke();
        const base = Y(max(lo2, min(hi2, 0)));
        ctx.lineTo(lx, base); ctx.lineTo(X(hist[i0].t), base); ctx.closePath();
        ctx.globalAlpha = 0.08; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(lx, ly, 3.2, 0, 2 * PI); ctx.fill();
        ctx.restore();
        ctx.save(); ctx.font = '11.5px "Barlow Semi Condensed", system-ui, sans-serif'; ctx.textBaseline = 'top';
        const lt = `${ch.label} [${ch.unit}]`, lw = ctx.measureText(lt).width;
        ctx.globalAlpha = 0.85; ctx.fillStyle = R.tok.panel; ctx.fillRect(padL + 3, top + 1, lw + 8, 15); ctx.globalAlpha = 1;
        ctx.fillStyle = R.tok['ink-2']; ctx.fillText(lt, padL + 7, top + 2); ctx.restore();
        const vNow = ci >= 0 ? ch.fn(hist[ci]) : yl;
        this.last.push(vNow);
        if (ci >= 0) {
          const xc = X(hist[ci].t), yc = Y(vNow);
          ctx.fillStyle = col; ctx.beginPath(); ctx.arc(xc, yc, 3.5, 0, 2 * PI); ctx.fill();
        }
      });
      const rawT = span / max(1, (W - padL) / 70), eT = pow(10, floor(log10(rawT))), tst = [1, 2, 2.5, 5, 10].map((k) => k * eT).find((s) => s >= rawT);
      for (let t = ceil(tStart / tst) * tst; t <= tEnd + 1e-9; t += tst) R.mono(ctx, `${MB.fmt(t, tst < 0.1 ? 2 : 1)}`, X(t), H - 9, 10, R.tok['ink-3'], 'center');
      R.mono(ctx, 't [s]', W - padR, H - 9, 10, R.tok['ink-3'], 'right');
      if (ci >= 0) {
        const xc = X(hist[ci].t);
        ctx.strokeStyle = R.tok['ink-3']; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(xc, 4); ctx.lineTo(xc, H - padB); ctx.stroke(); ctx.setLineDash([]);
        R.mono(ctx, `t = ${hist[ci].t.toFixed(3)} s`, min(W - 80, xc + 6), 10, 10, R.tok.ink, 'left');
      }
    }

    drawPhase(ctx, W, H, hist, chans, cols) {
      const [cx, cy] = chans, pad = 46, n = hist.length, start = this.win ? max(0, n - floor(this.win / max(1e-4, hist[n - 1].t / n))) : 0;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let k = start; k < n; k++) { const x = cx.fn(hist[k]), y = cy.fn(hist[k]); if (Number.isFinite(x) && Number.isFinite(y)) { x0 = min(x0, x); x1 = max(x1, x); y0 = min(y0, y); y1 = max(y1, y); } }
      if (!Number.isFinite(x0)) return;
      const ex = max(1e-6, x1 - x0) * 0.08, ey = max(1e-6, y1 - y0) * 0.08;
      x0 -= ex; x1 += ex; y0 -= ey; y1 += ey;
      const X = (x) => pad + ((x - x0) / (x1 - x0)) * (W - pad - 12), Y = (y) => H - 24 - ((y - y0) / (y1 - y0)) * (H - 36);
      ctx.strokeStyle = R.tok.line; ctx.strokeRect(pad, 12, W - pad - 12, H - 36);
      R.mono(ctx, MB.fmt(x0 + ex), pad, H - 10, 10, R.tok['ink-3'], 'left'); R.mono(ctx, MB.fmt(x1 - ex), W - 12, H - 10, 10, R.tok['ink-3'], 'right');
      R.mono(ctx, MB.fmt(y1 - ey), pad - 4, 18, 10, R.tok['ink-3'], 'right'); R.mono(ctx, MB.fmt(y0 + ey), pad - 4, H - 28, 10, R.tok['ink-3'], 'right');
      R.mono(ctx, `${cx.label} [${cx.unit}] →`, (W + pad) / 2, H - 10, 10, R.tok['ink-2'], 'center');
      R.mono(ctx, `↑ ${cy.label} [${cy.unit}]`, pad + 6, 22, 10, R.tok['ink-2'], 'left');
      ctx.strokeStyle = cols[0]; ctx.lineWidth = 1.5; ctx.beginPath();
      let first = true;
      for (let k = start; k < n; k++) { const x = cx.fn(hist[k]), y = cy.fn(hist[k]); if (!Number.isFinite(x)) continue; first ? ctx.moveTo(X(x), Y(y)) : ctx.lineTo(X(x), Y(y)); first = false; }
      ctx.stroke();
      const xl = cx.fn(hist[n - 1]), yl = cy.fn(hist[n - 1]);
      ctx.fillStyle = cols[0]; ctx.beginPath(); ctx.arc(X(xl), Y(yl), 4, 0, 2 * PI); ctx.fill();
      this.last = [xl, yl];
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
