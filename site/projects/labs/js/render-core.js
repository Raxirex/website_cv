/* Dynamic Interactive Labs — drawing primitives in the visual language of mechanics textbooks */
(function (G) {
  'use strict';
  const MB = G.MB;
  const R = (MB.R = {});
  const { cos, sin, hypot, PI, max, min, abs } = Math;

  R.tok = {};
  R.readTokens = function () {
    const cs = getComputedStyle(document.documentElement);
    ['paper', 'panel', 'panel-2', 'field', 'ink', 'ink-2', 'ink-3', 'body', 'body-2', 'accent', 'accent-soft', 'load', 'react', 'warn',
      'grid', 'grid-major', 'rope-gap', 'line', 'plot1', 'plot2', 'plot3', 'plot4', 'plot5', 'plot6'].forEach((k) => (R.tok[k] = cs.getPropertyValue('--' + k).trim() || '#888'));
  };

  R.View = class {
    constructor() { this.x = 1.3; this.y = 1.1; this.s = 160; this.W = 1; this.H = 1; }
    X(x) { return this.W / 2 + (x - this.x) * this.s; }
    Y(y) { return this.H / 2 - (y - this.y) * this.s; }
    wx(sx) { return this.x + (sx - this.W / 2) / this.s; }
    wy(sy) { return this.y - (sy - this.H / 2) / this.s; }
  };

  /* Name with subscript: "m_1" → m₁ (canvas) / <i>m</i><sub>1</sub> (DOM) */
  R.splitName = (name) => {
    const s = String(name || '');
    const i = s.indexOf('_');
    return i < 0 ? [s, ''] : [s.slice(0, i), s.slice(i + 1)];
  };
  MB.nameHTML = (name) => {
    const [a, b] = R.splitName(name);
    const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const isMath = a.length <= 3 && /^[A-Za-zα-ωΑ-Ω]+$/.test(a);
    return (isMath ? `<i class="mi">${esc(a)}</i>` : esc(a)) + (b ? `<sub>${esc(b)}</sub>` : '');
  };
  R.label = function (ctx, name, x, y, size, color, align) {
    const [a, b] = R.splitName(name);
    const isMath = a.length <= 3 && /^[A-Za-zα-ωΑ-Ω]+$/.test(a);
    ctx.save();
    ctx.fillStyle = color || R.tok.ink;
    ctx.textBaseline = 'middle';
    const fA = (isMath ? 'italic ' : '') + `${size}px "STIX Two Text", "Times New Roman", serif`;
    const fB = `${Math.round(size * 0.68)}px "STIX Two Text", "Times New Roman", serif`;
    ctx.font = fA; const wa = ctx.measureText(a).width;
    ctx.font = fB; const wb = b ? ctx.measureText(b).width + 1 : 0;
    let x0 = x;
    if (align === 'center' || !align) x0 = x - (wa + wb) / 2;
    else if (align === 'right') x0 = x - (wa + wb);
    ctx.font = fA; ctx.textAlign = 'left'; ctx.fillText(a, x0, y);
    if (b) { ctx.font = fB; ctx.fillText(b, x0 + wa + 1, y + size * 0.3); }
    ctx.restore();
    return wa + wb;
  };
  R.mono = function (ctx, text, x, y, size, color, align, base) {
    ctx.save();
    ctx.font = `${size}px "B612 Mono", ui-monospace, monospace`;
    ctx.fillStyle = color || R.tok['ink-2']; ctx.textAlign = align || 'left'; ctx.textBaseline = base || 'middle';
    ctx.fillText(text, x, y); ctx.restore();
  };

  R.line = function (ctx, x0, y0, x1, y1) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };

  /* Ground line with 45° hatching on one side (side = +1 → left of the direction x0→x1) */
  R.hatch = function (ctx, x0, y0, x1, y1, side, opt) {
    const o = opt || {}, L = hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / L, uy = (y1 - y0) / L;
    const nx = -uy * side, ny = ux * side, len = o.len || 7, gap = o.gap || 6;
    ctx.save();
    ctx.lineWidth = o.lw || 1.6; R.line(ctx, x0, y0, x1, y1);
    ctx.lineWidth = 1; ctx.beginPath();
    for (let t = gap * 0.5; t <= L; t += gap) {
      const px = x0 + ux * t, py = y0 + uy * t;
      ctx.moveTo(px, py); ctx.lineTo(px + nx * len - ux * len * 0.75, py + ny * len - uy * len * 0.75);
    }
    ctx.stroke(); ctx.restore();
  };

  /* Helical coil spring seen from the side (prolate trochoid, loops close up under compression) */
  R.coil = function (ctx, x0, y0, x1, y1, opt) {
    const o = opt || {}, L = hypot(x1 - x0, y1 - y0);
    if (L < 1) return;
    const ux = (x1 - x0) / L, uy = (y1 - y0) / L, nx = -uy, ny = ux;
    const rad = o.r || 7, loops = o.loops || 7, lead = min(o.lead || 9, L * 0.18), Lc = L - 2 * lead;
    ctx.beginPath(); ctx.moveTo(x0, y0);
    const ax = x0 + ux * lead, ay = y0 + uy * lead;
    ctx.lineTo(ax, ay);
    const N = loops * 22, k = 0.5 * rad, Lb = Lc - k * 0.9;
    for (let i = 1; i <= N; i++) {
      const ph = (i / N) * loops * 2 * PI;
      const along = (Lb * i) / N + k * (1 - cos(ph)), perp = rad * sin(ph);
      ctx.lineTo(ax + ux * along + nx * perp, ay + uy * along + ny * perp);
    }
    ctx.lineTo(x1 - ux * lead, y1 - uy * lead); ctx.lineTo(x1, y1);
    ctx.stroke();
  };

  /* Dashpot: cylinder + piston */
  R.dashpot = function (ctx, x0, y0, x1, y1, opt) {
    const o = opt || {}, L = hypot(x1 - x0, y1 - y0);
    if (L < 1) return;
    const ux = (x1 - x0) / L, uy = (y1 - y0) / L, nx = -uy, ny = ux, w = o.w || 8;
    const cyl = min(26, L * 0.45), c0 = L * 0.5 - cyl * 0.5, c1 = c0 + cyl, pis = c0 + cyl * 0.55;
    const P = (a, b) => [x0 + ux * a + nx * b, y0 + uy * a + ny * b];
    ctx.beginPath();
    let p = P(0, 0); ctx.moveTo(p[0], p[1]); p = P(c0, 0); ctx.lineTo(p[0], p[1]);
    p = P(c1, w); ctx.moveTo(p[0], p[1]); p = P(c0, w); ctx.lineTo(p[0], p[1]); p = P(c0, -w); ctx.lineTo(p[0], p[1]); p = P(c1, -w); ctx.lineTo(p[0], p[1]);
    p = P(pis, w * 0.7); ctx.moveTo(p[0], p[1]); p = P(pis, -w * 0.7); ctx.lineTo(p[0], p[1]);
    p = P(pis, 0); ctx.moveTo(p[0], p[1]); p = P(L, 0); ctx.lineTo(p[0], p[1]);
    ctx.stroke();
  };

  R.arrow = function (ctx, x0, y0, x1, y1, head) {
    const L = hypot(x1 - x0, y1 - y0);
    if (L < 0.5) return;
    const ux = (x1 - x0) / L, uy = (y1 - y0) / L, h = min(head || 9, L * 0.6);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - ux * h * 0.8, y1 - uy * h * 0.8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - ux * h - uy * h * 0.38, y1 - uy * h + ux * h * 0.38);
    ctx.lineTo(x1 - ux * h + uy * h * 0.38, y1 - uy * h - ux * h * 0.38);
    ctx.closePath(); ctx.fill();
  };

  R.ring = function (ctx, x, y, r, fill) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * PI);
    ctx.fillStyle = fill || R.tok.paper; ctx.fill(); ctx.stroke();
  };

  /* Curved moment arrow around (x,y); sign > 0 counter-clockwise (screen y down → flip) */
  R.moment = function (ctx, x, y, r, sign) {
    const a0 = -0.35 * PI, a1 = 0.95 * PI, ccw = sign >= 0;
    ctx.beginPath();
    ctx.arc(x, y, r, ccw ? -a0 : -a1, ccw ? -a1 : -a0, ccw);
    ctx.stroke();
    const ae = ccw ? -a1 : -a0, ex = x + r * cos(ae), ey = y + r * sin(ae);
    const tx = ccw ? sin(ae) : -sin(ae), ty = ccw ? -cos(ae) : cos(ae);
    const h = 8;
    ctx.beginPath(); ctx.moveTo(ex + tx * h * 0.2, ey + ty * h * 0.2);
    ctx.lineTo(ex - tx * h - ty * h * 0.4, ey - ty * h + tx * h * 0.4);
    ctx.lineTo(ex - tx * h + ty * h * 0.4, ey - ty * h - tx * h * 0.4);
    ctx.closePath(); ctx.fill();
  };

  /* Adaptive engineering grid with 1-2-5 spacing and metre labels */
  R.grid = function (ctx, v) {
    const raw = 16 / v.s, e = Math.pow(10, Math.floor(Math.log10(raw)));
    const minor = [1, 2, 5, 10].map((k) => k * e).find((s) => s >= raw);
    const major = Math.pow(10, Math.ceil(Math.log10(minor * 1.01)));
    const x0 = v.wx(0), x1 = v.wx(v.W), y0 = v.wy(v.H), y1 = v.wy(0);
    ctx.save(); ctx.lineWidth = 1;
    for (const [step, col] of [[minor, R.tok.grid], [major, R.tok['grid-major']]]) {
      ctx.strokeStyle = col; ctx.beginPath();
      for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) { const X = Math.round(v.X(x)) + 0.5; ctx.moveTo(X, 0); ctx.lineTo(X, v.H); }
      for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) { const Y = Math.round(v.Y(y)) + 0.5; ctx.moveTo(0, Y); ctx.lineTo(v.W, Y); }
      ctx.stroke();
    }
    const dec = Math.max(0, -Math.floor(Math.log10(major) + 1e-9));
    for (let x = Math.ceil(x0 / major) * major; x <= x1; x += major) R.mono(ctx, x.toFixed(dec), v.X(x) + 3, v.H - 8, 10, R.tok['ink-3'], 'left');
    for (let y = Math.ceil(y0 / major) * major; y <= y1; y += major) if (v.Y(y) > 78) R.mono(ctx, y.toFixed(dec), 4, v.Y(y) - 7, 10, R.tok['ink-3'], 'left');
    ctx.restore();
    return minor;
  };

  /* Inertial frame triad  I e₁, I e₂ */
  R.frame = function (ctx, X, Y) {
    ctx.save(); ctx.strokeStyle = R.tok.ink; ctx.fillStyle = R.tok.ink; ctx.lineWidth = 1.6;
    R.arrow(ctx, X, Y, X + 46, Y, 9); R.arrow(ctx, X, Y, X, Y - 46, 9);
    R.ring(ctx, X, Y, 3.2);
    const lab = (x, y, sub) => {
      ctx.font = '10px "STIX Two Text", serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = R.tok.ink;
      ctx.fillText('I', x, y + 3);
      ctx.font = 'italic 15px "STIX Two Text", serif'; ctx.fillText('e', x + 6, y);
      ctx.lineWidth = 1; R.line(ctx, x + 6.5, y - 8, x + 13, y - 8); R.line(ctx, x + 13, y - 8, x + 10.5, y - 10); R.line(ctx, x + 13, y - 8, x + 10.5, y - 6);
      ctx.font = '10px "STIX Two Text", serif'; ctx.fillText(sub, x + 14, y + 4);
    };
    lab(X + 50, Y, '1'); lab(X - 8, Y - 58, '2');
    ctx.restore();
  };

  R.clampLen = (v, lo, hi) => max(lo, min(hi, v));
  R.abs = abs;
})(typeof window !== 'undefined' ? window : globalThis);
