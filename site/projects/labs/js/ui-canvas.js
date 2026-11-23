/* Dynamic Interactive Labs — tools, canvas gestures (tap, drag, pinch, wheel), handles, snapping */
(function (G) {
  'use strict';
  const MB = G.MB, R = MB.R, F = MB.F, h = F.h;
  const C = (MB.C = {});
  const { hypot, atan2, round, PI, cos, sin, max, min, abs } = Math;
  const R2D = 180 / PI;

  C.TOOLS = [
    { id: 'select', icon: 'i-select', label: 'Select', key: 'v' }, '|',
    { id: 'block', icon: 'i-block', label: 'Block', key: 'b' },
    { id: 'disk', icon: 'i-disk', label: 'Disk', key: 'd' }, '|',
    { id: 'support', icon: 'i-support', label: 'Support', key: 's' },
    { id: 'joint', icon: 'i-joint', label: 'Joint', key: 'j' }, '|',
    { id: 'spring', icon: 'i-spring', label: 'Spring', key: 'k' },
    { id: 'damper', icon: 'i-damper', label: 'Damper', key: 'c' },
    { id: 'rope', icon: 'i-rope', label: 'Rope', key: 'p' },
    { id: 'stop', icon: 'i-stop', label: 'Stop', key: 'w' },
    { id: 'surface', icon: 'i-surface', label: 'Surface', key: 'u' },
    { id: 'load', icon: 'i-load', label: 'Load', key: 'l' },
  ];
  C.SUB = {
    support: [['pin', 'Pin'], ['roller', 'Roller'], ['guideH', 'Guide ↔'], ['guideV', 'Guide ↕'], ['fixed', 'Clamp'], ['rolling', 'Rolling'], ['curve', 'On a curve']],
    joint: [['pin', 'Pin'], ['slider', 'Prismatic'], ['fixed', 'Weld'], ['rod', 'Rod'], ['oncurve', 'On a moving curve'], ['gear', 'Gears']],
    spring: [['linear', 'Linear'], ['torsion', 'Torsion']],
    load: [['force', 'Force'], ['torque', 'Torque']],
  };
  C.sub = { support: 'pin', joint: 'pin', spring: 'linear', load: 'force' };

  C.renderTools = function () {
    const app = MB.app, root = document.getElementById('tools');
    root.innerHTML = '';
    for (const t of C.TOOLS) {
      if (t === '|') { root.append(h('div', { class: 'tool-sep' })); continue; }
      root.append(h('button', { class: 'tool' + (app.tool === t.id ? ' on' : ''), title: `${t.label} (${t.key.toUpperCase()})`, 'aria-pressed': app.tool === t.id ? 'true' : 'false', onclick: () => C.setTool(t.id) }, F.icon(t.icon), h('span', {}, t.label)));
    }
    root.append(h('div', { class: 'tool-sep show-sm' }));
    root.append(h('button', { class: 'tool show-sm', title: 'Undo', onclick: () => app.undo() }, F.icon('i-undo'), h('span', {}, 'Undo')));
    root.append(h('button', { class: 'tool show-sm', title: 'Redo', onclick: () => app.redo() }, F.icon('i-redo'), h('span', {}, 'Redo')));
    root.append(h('button', { class: 'tool show-sm', title: 'Advance one step', onclick: () => app.stepOnce() }, F.icon('i-step'), h('span', {}, 'Step')));
  };

  C.setTool = function (id) {
    const app = MB.app;
    app.tool = id; app.pending = null;
    if (id !== 'select' && (app.running || app.sim.t > 0)) app.resetToEdit();
    if (app.modeAnim) app.stopMode();
    C.renderTools(); C.renderOpts(); app.invalidate();
  };

  const HINT = {
    block: 'Tap to place a <b>block</b>, or drag to draw its size',
    disk: 'Tap to place a <b>disk</b>, or drag out its radius',
    support: 'Tap a part where it is <b>supported</b>, or empty space for a <b>fixed point</b> to hang things from',
    surface: 'Tap the <b>start</b> of the surface (on a part to make it move with that part)',
    joint: 'Tap where <b>two parts</b> connect',
    rod: 'Tap the <b>two ends</b> of the rigid rod',
    spring: 'Tap the <b>two ends</b> of the spring (part or ground)',
    torsion: 'Tap a part; a second part under the same point is coupled, otherwise the ground',
    damper: 'Tap the <b>two ends</b> of the damper',
    stop: 'Tap the <b>wall</b> or first contact point, then the point on the part that must stay clear',
    load: 'Tap a part to apply a <b>load</b>',
  };
  C.renderOpts = function () {
    const app = MB.app, box = document.getElementById('topts'), t = app.tool;
    box.innerHTML = '';
    if (t === 'select') { box.hidden = true; return; }
    box.hidden = false;
    const subs = C.SUB[t];
    if (subs) {
      const seg = h('div', { class: 'seg sm wrap' });
      subs.forEach(([v, l]) => seg.append(h('button', { class: C.sub[t] === v ? 'on' : '', type: 'button', onclick: () => { C.sub[t] = v; app.pending = null; C.renderOpts(); app.invalidate(); } }, l)));
      box.append(seg);
    }
    let hint = HINT[t];
    if (t === 'joint' && C.sub.joint === 'rod') hint = HINT.rod;
    if (t === 'joint' && C.sub.joint === 'gear') hint = 'Tap the <b>first gear</b>, then the <b>second</b> (both need their own pins)';
    if (t === 'joint' && C.sub.joint === 'oncurve') hint = 'Tap the <b>bead</b> (the point that slides), then the <b>part carrying the wire</b>: a disk gives a circle through the point, a block a straight rod';
    if (t === 'support' && C.sub.support === 'curve') hint = 'Tap the point of a part that must <b>slide on a curve</b> (a circle to start with; change it in the inspector)';
    if (t === 'spring' && C.sub.spring === 'torsion') hint = HINT.torsion;
    const p = app.pending;
    if (p && p.pts.length) {
      if (t === 'rope') hint = p.pts.length === 1 ? 'Tap a <b>pulley position</b> or a <b>disk</b> to wrap; the last tap is the end' : `${p.pts.length} points · tap more pulleys, or <b>Finish</b>`;
      else if (t === 'surface') hint = p.pts.length === 1 ? `Tap the <b>end</b>${p.pts[0].body ? ' (moves with ' + MB.plainName(p.pts[0].body.name) + ')' : ' (fixed to ground)'}` : `${p.pts.length} points · tap more corners, or <b>Finish</b>`;
      else if (t === 'joint' && C.sub.joint !== 'rod') hint = 'Tap the <b>second part</b>, or empty space to fix it to the ground';
      else hint = 'Now tap the <b>second point</b>';
    } else if (t === 'rope') hint = 'Tap the <b>start</b> of the rope (on a part or on the ground)';
    box.append(h('span', { class: 'hint', html: hint }));
    if ((t === 'rope' || t === 'surface') && p && p.pts.length) {
      box.append(h('button', { class: 'btn primary', type: 'button', disabled: p.pts.length < 2 ? true : null, onclick: () => (t === 'rope' ? C.finishRope() : C.finishSurface()) }, 'Finish'));
    }
    if (p && p.pts.length) box.append(h('button', { class: 'btn ghost', type: 'button', onclick: () => { app.pending = null; C.renderOpts(); app.invalidate(); } }, 'Cancel'));
    box.append(h('button', { class: 'icon-btn sm tclose', type: 'button', title: 'Back to Select (Esc)', 'aria-label': 'Back to Select', onclick: () => C.setTool('select') }, F.icon('i-close', 'sm')));
  };

  /* ---------- snapping ---------- */
  C.snap = function (wx, wy, opt) {
    const app = MB.app, v = app.view, sim = app.sim, st = app.model.settings;
    if (!st.snap || (opt && opt.free)) return { x: wx, y: wy, s: null };
    let best = null, bd = 12;
    const cand = (x, y, kind) => { const d = hypot(v.X(x) - v.X(wx), v.Y(y) - v.Y(wy)); if (d < bd) { bd = d; best = { x, y, s: kind }; } };
    app.model.bodies.forEach((b, i) => {
      if (opt && opt.skipBody === b.id) return;
      const x = sim.q[3 * i], y = sim.q[3 * i + 1], th = sim.q[3 * i + 2], c = cos(th), s = sin(th);
      const P = (lx, ly) => cand(x + c * lx - s * ly, y + s * lx + c * ly, 'key');
      P(0, 0);
      if (b.shape === 'disk') { P(b.r, 0); P(-b.r, 0); P(0, b.r); P(0, -b.r); }
      else { const a = b.w / 2, e = b.h / 2; [[-a, -e], [a, -e], [a, e], [-a, e], [0, -e], [0, e], [-a, 0], [a, 0]].forEach(([p, q]) => P(p, q)); }
    });
    for (const j of app.model.joints) if (!j.a.body) cand(j.a.p[0], j.a.p[1], 'key');
    for (const f of app.model.forces) for (const r of [f.a, f.b]) if (r && !r.body && r.p) cand(r.p[0], r.p[1], 'key');
    for (const r of app.model.ropes) for (const n of r.nodes) { const w = MB.toWorld(app.model, n); cand(w[0], w[1], 'key'); }
    for (const a of app.model.anchors || []) { const d = hypot(v.X(a.p[0]) - v.X(wx), v.Y(a.p[1]) - v.Y(wy)); if (d < 14 && d <= bd + 2) { bd = d; best = { x: a.p[0], y: a.p[1], s: 'anchor', anchor: a.id, owner: null, ownerSet: true }; } }
    if (best) return best;
    let sb = null, sd = 10;
    for (const sf of sim.surfs || []) {
      const io = sf.io, q = sim.q;
      let ca = 1, sa = 0, rx = 0, ry = 0;
      if (io >= 0) { rx = q[3 * io]; ry = q[3 * io + 1]; ca = cos(q[3 * io + 2]); sa = sin(q[3 * io + 2]); }
      const ex = wx - rx, ey = wy - ry, o = MB.closestOnPolyline(sf.P, 0, sf.N - 2, ca * ex + sa * ey, -sa * ex + ca * ey, {});
      const qx = rx + ca * o.qx - sa * o.qy, qy = ry + sa * o.qx + ca * o.qy, d = hypot(v.X(qx) - v.X(wx), v.Y(qy) - v.Y(wy));
      if (d < sd) { sd = d; sb = { x: qx, y: qy, s: 'surf', owner: io >= 0 ? app.model.bodies[io] : null, ownerSet: true }; }
    }
    if (sb) return sb;
    const g = app.gridStep || 0.05;
    return { x: round(wx / g) * g, y: round(wy / g) * g, s: 'grid' };
  };

  const niceLen = (px) => { const app = MB.app, raw = px / app.view.s, e = Math.pow(10, Math.floor(Math.log10(raw))); return [1, 2, 2.5, 5, 10].map((k) => k * e).find((s) => s >= raw * 0.8); };
  const refAt = (wx, wy, body, anchor) => (body ? { body: body.id, p: MB.toLocal(MB.app.model, body.id, wx, wy) } : anchor ? { body: null, p: [wx, wy], anchor } : { body: null, p: [wx, wy] });
  /* Effective mass seen by a two-point element: attached part, or reduced mass of two parts */
  const meff = (A, B) => (A && B ? (A.m * B.m) / (A.m + B.m) : (A || B) ? (A || B).m : 1);
  const topBody = (wx, wy) => R.bodiesAt(MB.app.scene(), wx, wy, 3 / MB.app.view.s)[0] || null;

  /* ---------- creation on tap ---------- */
  C.tap = function (wx, wy) {
    const app = MB.app, m = app.model, t = app.tool, sp = C.snap(wx, wy), x = sp.x, y = sp.y;
    const body = sp.ownerSet ? sp.owner : topBody(x, y), anchor = sp.anchor || null;
    const done = (id) => { app.select(id); C.setTool('select'); app.showTab('inspect', true); };
    if (t === 'block' || t === 'disk') {
      let id;
      app.edit(() => {
        const bw = niceLen(90), b = t === 'block' ? MB.makeBody({ name: MB.nextName(m, 'm'), w: bw, h: +(bw * 0.6).toPrecision(2), x, y }) : MB.makeBody({ name: MB.nextName(m, 'm'), shape: 'disk', r: niceLen(36), x, y });
        m.bodies.push(b); id = b.id;
      });
      return done(id);
    }
    if (t === 'support') {
      if (!body && anchor) return done(anchor);
      if (!body) {
        let id;
        app.edit(() => { const a = MB.makeAnchor({ p: [x, y] }); m.anchors.push(a); id = a.id; });
        app.toast('Fixed point added. Attach springs, dampers, ropes or rods to it.');
        return done(id);
      }
      const sub = C.sub.support;
      if (sub === 'rolling' && body.shape !== 'disk') return app.toast('Rolling contact needs a disk');
      if (sub === 'curve') { let id; app.edit(() => { const R0 = 0.5, j = MB.makeJoint({ type: 'path', name: '', a: { body: null, p: [x, y + R0] }, b: { body: body.id, p: MB.toLocal(m, body.id, x, y) }, curve: { type: 'circle', R: R0 } }); m.joints.push(j); id = j.id; }); app.toast('The point now slides on a circle of radius 0.5 m: change the curve in the inspector.'); return done(id); }
      let id;
      app.edit(() => {
        const type = sub === 'guideH' || sub === 'guideV' ? 'slider' : sub;
        const j = sub === 'rolling'
          ? MB.makeJoint({ type: 'rolling', a: { body: null, p: [body.x, body.y - body.r] }, b: { body: body.id, p: [0, 0] }, angle: 0, name: 'Rolling contact' })
          : MB.makeJoint({ type, a: { body: null, p: [x, y] }, b: { body: body.id, p: MB.toLocal(m, body.id, x, y) }, angle: sub === 'guideV' ? 90 : 0, name: '' });
        m.joints.push(j); id = j.id;
      });
      return done(id);
    }
    if (t === 'load') {
      if (!body) return app.toast('Tap on a part to load it');
      let id;
      app.edit(() => {
        const f = C.sub.load === 'torque'
          ? MB.makeForce({ type: 'torque', name: MB.nextName(m, 'M'), b: { body: body.id }, M0: 1 })
          : MB.makeForce({ type: 'load', name: MB.nextName(m, 'F'), b: { body: body.id, p: MB.toLocal(m, body.id, x, y) }, F0: 10, angle: -90 });
        m.forces.push(f); id = f.id;
      });
      return done(id);
    }
    if (t === 'spring' && C.sub.spring === 'torsion') {
      if (!body) return app.toast('Tap on a part');
      const other = R.bodiesAt(app.scene(), x, y, 0).find((b) => b !== body) || null;
      let id;
      app.edit(() => {
        const i = m.bodies.indexOf(body), oth = other ? other.th : 0;
        const f = MB.makeForce({ type: 'torsion', name: MB.nextName(m, 'k'), a: { body: other ? other.id : null }, b: { body: body.id }, kt: 10, phi0: body.th - oth });
        m.forces.push(f); id = f.id; void i;
      });
      return done(id);
    }
    /* multi-tap tools */
    const p = app.pending || (app.pending = { tool: t, pts: [] });
    if (t === 'joint' && C.sub.joint !== 'rod') {
      if (!p.pts.length) {
        const under = R.bodiesAt(app.scene(), x, y, 3 / app.view.s);
        if (!under.length) return app.toast('Tap on a part');
        if (under.length >= 2) { app.pending = null; return C.makeJoint(under[1], under[0], x, y); }
        p.pts.push({ x, y, body: under[0] });
        C.renderOpts(); return app.invalidate();
      }
      const first = p.pts[0];
      const second = R.bodiesAt(app.scene(), x, y, 3 / app.view.s).find((b) => b !== first.body) || null;
      app.pending = null;
      return C.makeJoint(second, first.body, first.x, first.y);
    }
    if (t === 'rope' || t === 'surface') {
      p.pts.push({ x, y, body: t === 'surface' && p.pts.length ? p.pts[0].body : body, anchor });
      if (p.pts.length >= 2) {
        const a = p.pts[p.pts.length - 1], b = p.pts[p.pts.length - 2];
        if (hypot(a.x - b.x, a.y - b.y) < 6 / app.view.s) { p.pts.pop(); return t === 'rope' ? C.finishRope() : C.finishSurface(); }
      }
      C.renderOpts(); return app.invalidate();
    }
    p.pts.push({ x, y, body, anchor });
    if (p.pts.length < 2) { C.renderOpts(); return app.invalidate(); }
    const [A, B] = p.pts;
    app.pending = null;
    if (!A.body && !B.body) { C.renderOpts(); return app.toast('At least one end has to be on a part'); }
    if (hypot(A.x - B.x, A.y - B.y) < 1e-6) { C.renderOpts(); return app.toast('The two points coincide'); }
    let id;
    app.edit(() => {
      const L = hypot(B.x - A.x, B.y - A.y);
      if (t === 'spring' || t === 'damper') {
        const k = 100, me = meff(A.body, B.body), c = t === 'damper' ? 10 : +(2 * 0.05 * Math.sqrt(k * me)).toPrecision(2);
        const f = MB.makeForce({ type: 'sd', name: MB.nextName(m, t === 'spring' ? 'k' : 'd'), a: refAt(A.x, A.y, A.body, A.anchor), b: refAt(B.x, B.y, B.body, B.anchor), k: t === 'spring' ? k : 0, c, L0: L });
        m.forces.push(f); id = f.id;
      } else if (t === 'joint') {
        let a = A, b = B;
        if (!b.body) { a = B; b = A; }
        const j = MB.makeJoint({ type: 'rod', a: refAt(a.x, a.y, a.body, a.anchor), b: refAt(b.x, b.y, b.body, b.anchor), name: '' });
        m.joints.push(j); id = j.id;
      } else if (t === 'stop') {
        const ang = round((atan2(B.y - A.y, B.x - A.x) * R2D) / 45) * 45;
        const s = MB.makeStop({ name: MB.nextName(m, 'Stop'), a: refAt(A.x, A.y, A.body, A.anchor), b: refAt(B.x, B.y, B.body, B.anchor), angle: ang, gap: 0, e: 0.3 });
        const n = [cos(ang / R2D), sin(ang / R2D)];
        const sep = n[0] * (B.x - A.x) + n[1] * (B.y - A.y);
        if (sep < 0) s.gap = sep;
        m.stops.push(s); id = s.id;
      }
    });
    done(id);
  };

  C.makeJoint = function (A, B, x, y) {
    const app = MB.app, m = app.model, type = C.sub.joint;
    if (!B) return app.toast('Tap on a part');
    let id;
    if (type === 'gear') { if (!A) return app.toast('Gears couple two parts: tap the second part'); app.edit(() => { const j = MB.makeJoint({ type: 'gear', name: '', a: { body: A.id, p: [0, 0] }, b: { body: B.id, p: [0, 0] }, ra: A.shape === 'disk' ? A.r : 0.1, rb: B.shape === 'disk' ? B.r : 0.1, mesh: 'ext' }); m.joints.push(j); id = j.id; }); app.select(id); C.setTool('select'); app.showTab('inspect', true); return; }
    if (type === 'oncurve') { app.edit(() => { let j; if (!A) j = MB.makeJoint({ type: 'path', name: '', a: { body: null, p: [x, y + 0.5] }, b: { body: B.id, p: MB.toLocal(m, B.id, x, y) }, curve: { type: 'circle', R: 0.5 } }); else { const d = Math.hypot(x - A.x, y - A.y); j = A.shape === 'disk' ? MB.makeJoint({ type: 'path', name: '', a: { body: A.id, p: [0, 0] }, b: { body: B.id, p: MB.toLocal(m, B.id, x, y) }, curve: { type: 'circle', R: Math.max(0.02, d) } }) : MB.makeJoint({ type: 'path', name: '', a: { body: A.id, p: [0, 0] }, b: { body: B.id, p: MB.toLocal(m, B.id, x, y) }, curve: { type: 'line', span: Math.max(A.w, A.h) } }); } m.joints.push(j); id = j.id; }); app.select(id); C.setTool('select'); app.showTab('inspect', true); return; }
    app.edit(() => {
      const j = MB.makeJoint({ type, a: refAt(x, y, A), b: refAt(x, y, B), name: '' });
      m.joints.push(j); id = j.id;
    });
    app.select(id); C.setTool('select'); app.showTab('inspect', true);
  };

  C.finishRope = function () {
    const app = MB.app, m = app.model, p = app.pending;
    if (!p || p.pts.length < 2) return;
    app.pending = null;
    const pts = p.pts, N = pts.length, nodes = [];
    const g = m.settings.gAngle / R2D, gx = cos(g), gy = sin(g);
    pts.forEach((pt, k) => {
      const end = k === 0 || k === N - 1, disk = pt.body && pt.body.shape === 'disk' && k > 0;
      if (disk) nodes.push(MB.makeNode({ body: pt.body.id, p: [0, 0], r: pt.body.r, stick: true, _c: [pt.body.x, pt.body.y] }));
      else if (end) nodes.push(MB.makeNode(Object.assign({ body: pt.body ? pt.body.id : null, p: pt.body ? MB.toLocal(m, pt.body.id, pt.x, pt.y) : [pt.x, pt.y], r: 0, _c: [pt.x, pt.y] }, !pt.body && pt.anchor ? { anchor: pt.anchor } : {})));
      else nodes.push(MB.makeNode({ body: pt.body ? pt.body.id : null, p: pt.body ? MB.toLocal(m, pt.body.id, pt.x, pt.y) : [pt.x, pt.y], r: niceLen(16), _c: [pt.x, pt.y] }));
    });
    for (let k = 1; k < N; k++) {
      const n = nodes[k];
      if (!(n.r > 0)) continue;
      const P = nodes[k - 1]._c, Cc = n._c;
      if (k < N - 1) {
        const Nn = nodes[k + 1]._c, cr = (Cc[0] - P[0]) * (Nn[1] - Cc[1]) - (Cc[1] - P[1]) * (Nn[0] - Cc[0]);
        n.dir = cr >= 0 ? 1 : -1;
      } else {
        const cr = (Cc[0] - P[0]) * gy - (Cc[1] - P[1]) * gx;
        n.dir = cr > 0 ? -1 : 1;
      }
    }
    nodes.forEach((n) => delete n._c);
    let id;
    app.edit(() => { const r = MB.makeRope({ name: MB.nextName(m, 'S'), nodes }); m.ropes.push(r); id = r.id; });
    app.select(id); C.setTool('select'); app.showTab('inspect', true);
  };

  C.finishSurface = function () {
    const app = MB.app, m = app.model, p = app.pending;
    if (!p || p.pts.length < 2) return;
    app.pending = null;
    const owner = p.pts[0].body || null;
    const pts = p.pts.map((pt) => (owner ? MB.toLocal(m, owner.id, pt.x, pt.y) : [pt.x, pt.y]));
    let id;
    app.edit(() => { const s = MB.makeSurface({ body: owner ? owner.id : null, pts }); m.surfaces.push(s); id = s.id; });
    app.select(id); C.setTool('select'); app.showTab('inspect', true);
  };

  /* ---------- handles of the selected element ---------- */
  C.handles = function () {
    const app = MB.app, m = app.model;
    if (app.running || app.tool !== 'select' || !app.sel || app.modeAnim) return null;
    const f = MB.find(m, app.sel);
    if (!f) return null;
    const el = f.el, kind = MB.kindOf(el), out = [], sim = app.sim;
    const W = (ref) => R.W(sim, ref);
    if (kind === 'body') {
      const i = m.bodies.indexOf(el), x = sim.q[3 * i], y = sim.q[3 * i + 1], th = sim.q[3 * i + 2];
      const d = (el.shape === 'disk' ? el.r : el.h / 2) + 26 / app.view.s;
      out.push({ id: el.id, key: 'rot', kind: 'rot', x: x - sin(th) * d, y: y + cos(th) * d });
    } else if (kind === 'force' && el.type === 'sd' || kind === 'stop' || (kind === 'joint' && el.type === 'rod')) {
      for (const k of ['a', 'b']) { const w = W(el[k]); out.push({ id: el.id, key: k, x: w[0], y: w[1] }); }
    } else if (kind === 'joint' && el.type !== 'rolling') {
      const w = W(el.b); out.push({ id: el.id, key: 'j', x: w[0], y: w[1] });
    } else if (kind === 'force' && el.type === 'load') {
      const w = W(el.b); out.push({ id: el.id, key: 'p', x: w[0], y: w[1] });
    } else if (kind === 'rope') {
      el.nodes.forEach((n, k) => { const w = W(n); out.push({ id: el.id, key: 'n' + k, x: w[0], y: w[1] }); });
    } else if (kind === 'surface') {
      el.pts.forEach((p, k) => { const w = W({ body: el.body, p }); out.push({ id: el.id, key: 's' + k, x: w[0], y: w[1] }); });
    } else if (kind === 'anchor') out.push({ id: el.id, key: 'anc', x: el.p[0], y: el.p[1] });
    return out;
  };

  function dragHandle(hd, wx, wy, final) {
    const app = MB.app, m = app.model, f = MB.find(m, hd.id);
    if (!f) return;
    const el = f.el, kind = MB.kindOf(el);
    if (hd.key === 'rot') {
      const i = m.bodies.indexOf(el), x = app.sim.q[3 * i], y = app.sim.q[3 * i + 1];
      let a = atan2(wy - y, wx - x) * R2D - 90;
      if (m.settings.snap) a = round(a / 15) * 15;
      app.syncPoses(); el.th = a;
      return;
    }
    const sp = C.snap(wx, wy, { skipBody: null }), x = sp.x, y = sp.y;
    app.snapMark = sp.s ? [x, y] : null;
    const reattach = (ref) => {
      const b = final ? (sp.ownerSet ? sp.owner : topBody(x, y)) : ref.body ? MB.bodyById(m, ref.body) : null;
      return final ? refAt(x, y, b, sp.anchor) : ref.body ? { body: ref.body, p: MB.toLocal(m, ref.body, x, y) } : { body: null, p: [x, y] };
    };
    if (hd.key === 'anc') { el.p = [x, y]; MB.syncAnchors(m); return; }
    if (hd.key[0] === 's') { const k = +hd.key.slice(1); el.pts[k] = el.body ? MB.toLocal(m, el.body, x, y) : [x, y]; return; }
    if (hd.key === 'a' || hd.key === 'b') {
      const r = reattach(el[hd.key]);
      const other = el[hd.key === 'a' ? 'b' : 'a'];
      if (final && !r.body && !other.body) return;
      if (final && r.body && r.body === other.body) return;
      el[hd.key] = r;
      if (kind === 'joint' && !el.b.body && el.a.body) { const t = el.a; el.a = el.b; el.b = t; }
    } else if (hd.key === 'j') {
      if (!el.a.body) el.a.p = [x, y]; else el.a.p = MB.toLocal(m, el.a.body, x, y);
      el.b.p = MB.toLocal(m, el.b.body, x, y);
    } else if (hd.key === 'p') {
      el.b.p = MB.toLocal(m, el.b.body, x, y);
    } else if (hd.key[0] === 'n') {
      const k = +hd.key.slice(1), nd = el.nodes[k];
      if (final) {
        const b = topBody(x, y);
        if (b && b.shape === 'disk' && (nd.r > 0 || (k === el.nodes.length - 1 && k > 0))) { nd.body = b.id; nd.p = [0, 0]; if (nd.r > 0) nd.r = b.r; }
        else { nd.body = b ? b.id : null; nd.p = b ? MB.toLocal(m, b.id, x, y) : [x, y]; if (!b && sp.anchor) nd.anchor = sp.anchor; else delete nd.anchor; }
      } else nd.p = nd.body ? MB.toLocal(m, nd.body, x, y) : [x, y];
    }
  }

  /* ---------- gestures ---------- */
  C.attach = function (cv) {
    const app = MB.app, ptrs = new Map();
    let g = null;
    const loc = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId);
      const [sx, sy] = loc(e);
      ptrs.set(e.pointerId, [sx, sy]);
      if (ptrs.size === 2) {
        if (g && g.type === 'drag') finishDrag(false);
        const [a, b] = [...ptrs.values()];
        g = { type: 'pinch', d0: hypot(a[0] - b[0], a[1] - b[1]), s0: app.view.s, cx: app.view.wx((a[0] + b[0]) / 2), cy: app.view.wy((a[1] + b[1]) / 2), m0: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
        app.sim.grab = null;
        return;
      }
      if (ptrs.size > 2) return;
      g = { type: 'press', sx, sy, x0: sx, y0: sy, t0: performance.now(), moved: false, button: e.button };
      if (e.button === 1 || e.button === 2) { g.type = 'pan'; return; }
      if (app.tool === 'select') {
        const hit = R.hit(app.view, app.sceneState, sx, sy);
        g.hit = hit;
        if (hit && hit.handle) g.mode = 'handle';
        else if (hit && MB.find(app.model, hit.id) && MB.kindOf(MB.find(app.model, hit.id).el) === 'body') {
          g.mode = app.running ? 'grab' : 'body';
          if (app.running) {
            const b = MB.find(app.model, hit.id).el, i = app.model.bodies.indexOf(b), wx = app.view.wx(sx), wy = app.view.wy(sy);
            const q = app.sim.q, th = q[3 * i + 2], dx = wx - q[3 * i], dy = wy - q[3 * i + 1];
            const k = 160 * b.m;
            app.sim.grab = { i, p: [cos(th) * dx + sin(th) * dy, -sin(th) * dx + cos(th) * dy], tx: wx, ty: wy, k, c: 2 * 0.9 * Math.sqrt(k * b.m), cap: 8 * b.m * Math.max(1, app.model.settings.g) };
            app.select(hit.id);
          }
        } else g.mode = 'pan';
      } else if (app.tool === 'block' || app.tool === 'disk') g.mode = 'size';
      else g.mode = 'tap';
    });

    cv.addEventListener('pointermove', (e) => {
      const [sx, sy] = loc(e);
      if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, [sx, sy]);
      if (g && g.type === 'pinch' && ptrs.size >= 2) {
        const [a, b] = [...ptrs.values()], d = hypot(a[0] - b[0], a[1] - b[1]), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        app.view.s = max(8, min(4000, g.s0 * (d / (g.d0 || 1))));
        app.view.x = g.cx - (mx - app.view.W / 2) / app.view.s;
        app.view.y = g.cy + (my - app.view.H / 2) / app.view.s;
        app.invalidate(); return;
      }
      if (!g || !ptrs.has(e.pointerId)) {
        if (e.pointerType === 'mouse') {
          const hit = app.tool === 'select' ? R.hit(app.view, app.sceneState, sx, sy) : null;
          const id = hit ? hit.id : null;
          cv.style.cursor = app.tool !== 'select' ? 'crosshair' : hit ? (hit.handle ? 'move' : MB.kindOf((MB.find(app.model, hit.id) || {}).el) === 'body' ? (app.running ? 'grab' : 'move') : 'pointer') : 'default';
          if (id !== app.hover) { app.hover = id; app.invalidate(); }
          if (app.pending) { app.cursorW = [app.view.wx(sx), app.view.wy(sy)]; app.invalidate(); }
          if (app.tool !== 'select' && app.tool !== 'rope') { const sp = C.snap(app.view.wx(sx), app.view.wy(sy)); app.snapMark = sp.s === 'key' ? [sp.x, sp.y] : null; app.invalidate(); }
        }
        return;
      }
      const dx = sx - g.sx, dy = sy - g.sy;
      if (!g.moved && hypot(sx - g.x0, sy - g.y0) < (e.pointerType === 'touch' ? 8 : 4)) return;
      if (!g.moved) startDrag(g);
      g.moved = true;
      if (g.mode === 'pan' || g.type === 'pan') { app.view.x -= dx / app.view.s; app.view.y += dy / app.view.s; }
      else if (g.mode === 'grab') { const gb = app.sim.grab; if (gb) { gb.tx = app.view.wx(sx); gb.ty = app.view.wy(sy); } }
      else if (g.mode === 'body') {
        const b = g.body, wx = app.view.wx(sx), wy = app.view.wy(sy);
        let nx = g.bx + (wx - g.wx0), ny = g.by + (wy - g.wy0);
        if (app.model.settings.snap) { const sp = C.snap(nx, ny, { skipBody: b.id }); if (sp.s === 'grid') { nx = sp.x; ny = sp.y; } }
        b.x = nx; b.y = ny;
        app.rebuildQuiet(true);
        g.bx = b.x - (wx - g.wx0); g.by = b.y - (wy - g.wy0);
      } else if (g.mode === 'handle') { dragHandle(g.hit.handle, app.view.wx(sx), app.view.wy(sy), false); app.rebuildQuiet(g.hit.handle.key === 'rot'); }
      else if (g.mode === 'size') { g.cur = [app.view.wx(sx), app.view.wy(sy)]; app.sizePreview = { tool: app.tool, a: g.a, b: C.snap(g.cur[0], g.cur[1]) }; }
      g.sx = sx; g.sy = sy;
      app.invalidate();
    });

    function startDrag(g) {
      if (g.mode === 'body' || g.mode === 'handle') {
        if (app.sim.t > 0) app.resetToEdit();
        g.before = JSON.stringify(app.model);
        if (g.mode === 'body') {
          const b = MB.find(app.model, g.hit.id).el;
          app.select(b.id, true);
          g.body = b; g.wx0 = app.view.wx(g.x0); g.wy0 = app.view.wy(g.y0); g.bx = b.x; g.by = b.y;
        }
      }
      if (g.mode === 'size') { const sp = C.snap(app.view.wx(g.x0), app.view.wy(g.y0)); g.a = [sp.x, sp.y]; }
    }

    function finishDrag(ok) {
      if (!g) return;
      if (g.mode === 'body' || g.mode === 'handle') {
        if (g.mode === 'handle') dragHandle(g.hit.handle, app.view.wx(g.sx), app.view.wy(g.sy), true);
        app.syncPoses();
        app.snapMark = null;
        if (g.before) app.commit(g.before, {});
      }
      if (g.mode === 'size' && ok && app.sizePreview) {
        const { a, b } = app.sizePreview, m = app.model;
        app.sizePreview = null;
        let id;
        if (app.tool === 'block') {
          const w = abs(b.x - a[0]), hh = abs(b.y - a[1]);
          if (w < 0.01 || hh < 0.01) return app.toast('Drag a larger rectangle');
          app.edit(() => { const bb = MB.makeBody({ name: MB.nextName(m, 'm'), w, h: hh, x: (a[0] + b.x) / 2, y: (a[1] + b.y) / 2 }); m.bodies.push(bb); id = bb.id; });
        } else {
          const r = hypot(b.x - a[0], b.y - a[1]);
          if (r < 0.01) return app.toast('Drag out a larger radius');
          app.edit(() => { const bb = MB.makeBody({ name: MB.nextName(m, 'm'), shape: 'disk', r, x: a[0], y: a[1] }); m.bodies.push(bb); id = bb.id; });
        }
        app.select(id); C.setTool('select'); app.showTab('inspect', true);
      }
      app.sizePreview = null;
    }

    const up = (e) => {
      const had = ptrs.has(e.pointerId);
      ptrs.delete(e.pointerId);
      if (!had) return;
      if (g && g.type === 'pinch') { if (ptrs.size === 0) g = null; else g = { type: 'press', sx: [...ptrs.values()][0][0], sy: [...ptrs.values()][0][1], x0: 0, y0: 0, moved: true, mode: 'pan' }; return; }
      if (!g) return;
      if (g.mode === 'grab') { app.sim.grab = null; }
      if (g.moved) finishDrag(e.type === 'pointerup');
      else if (e.type === 'pointerup') {
        const wx = app.view.wx(g.x0), wy = app.view.wy(g.y0);
        if (app.tool === 'select') app.select(g.hit && !g.hit.handle ? g.hit.id : g.hit && g.hit.handle ? g.hit.id : null);
        else { if (app.sim.t > 0) app.resetToEdit(); C.tap(wx, wy); }
      }
      g = null; app.invalidate();
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const [sx, sy] = loc(e), wx = app.view.wx(sx), wy = app.view.wy(sy);
      const f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016));
      app.view.s = max(8, min(4000, app.view.s * f));
      app.view.x = wx - (sx - app.view.W / 2) / app.view.s; app.view.y = wy + (sy - app.view.H / 2) / app.view.s;
      app.invalidate();
    }, { passive: false });
  };

  /* Overlay for tools in progress */
  C.drawOverlay = function (ctx, v) {
    const app = MB.app, p = app.pending;
    ctx.save(); ctx.strokeStyle = R.tok.accent; ctx.fillStyle = R.tok.accent; ctx.lineWidth = 1.6;
    if (app.snapMark) { ctx.beginPath(); ctx.arc(v.X(app.snapMark[0]), v.Y(app.snapMark[1]), 6, 0, 2 * PI); ctx.stroke(); }
    const gb = app.sim.grab;
    if (gb && gb.P) {
      ctx.setLineDash([4, 4]); R.line(ctx, v.X(gb.P[0]), v.Y(gb.P[1]), v.X(gb.tx), v.Y(gb.ty)); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(v.X(gb.P[0]), v.Y(gb.P[1]), 4, 0, 2 * PI); ctx.fill();
      ctx.beginPath(); ctx.arc(v.X(gb.tx), v.Y(gb.ty), 7, 0, 2 * PI); ctx.stroke();
    }
    if (p && p.pts.length) {
      ctx.setLineDash([5, 4]); ctx.beginPath();
      p.pts.forEach((q, k) => (k ? ctx.lineTo(v.X(q.x), v.Y(q.y)) : ctx.moveTo(v.X(q.x), v.Y(q.y))));
      if (app.cursorW) ctx.lineTo(v.X(app.cursorW[0]), v.Y(app.cursorW[1]));
      ctx.stroke(); ctx.setLineDash([]);
      p.pts.forEach((q) => {
        ctx.beginPath();
        if (p.tool === 'rope' && q.body && q.body.shape === 'disk' && q !== p.pts[0]) ctx.arc(v.X(q.body.x), v.Y(q.body.y), q.body.r * v.s + 4, 0, 2 * PI), ctx.stroke();
        else ctx.arc(v.X(q.x), v.Y(q.y), 5, 0, 2 * PI), ctx.fill();
      });
    }
    const sp = app.sizePreview;
    if (sp) {
      ctx.setLineDash([5, 4]); ctx.fillStyle = R.tok['accent-soft'];
      if (sp.tool === 'block') { const x0 = v.X(min(sp.a[0], sp.b.x)), y0 = v.Y(max(sp.a[1], sp.b.y)), w = abs(sp.b.x - sp.a[0]) * v.s, hh = abs(sp.b.y - sp.a[1]) * v.s; ctx.fillRect(x0, y0, w, hh); ctx.strokeRect(x0, y0, w, hh); R.mono(ctx, `${abs(sp.b.x - sp.a[0]).toFixed(3)} × ${abs(sp.b.y - sp.a[1]).toFixed(3)} m`, x0 + w + 8, y0 + 10, 11, R.tok.accent); }
      else { const r = hypot(sp.b.x - sp.a[0], sp.b.y - sp.a[1]); ctx.beginPath(); ctx.arc(v.X(sp.a[0]), v.Y(sp.a[1]), r * v.s, 0, 2 * PI); ctx.fill(); ctx.stroke(); R.mono(ctx, `r = ${r.toFixed(3)} m`, v.X(sp.a[0]) + r * v.s + 8, v.Y(sp.a[1]), 11, R.tok.accent); }
    }
    ctx.restore();
  };

  /* ---------- keyboard ---------- */
  C.keys = function () {
    const app = MB.app;
    window.addEventListener('keydown', (e) => {
      const tg = e.target, typing = tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT');
      if (typing) return;
      if (MB.suite && MB.suite.route !== 'mechanics') return;
      const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
      if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? app.redo() : app.undo(); return; }
      if (mod && k === 'y') { e.preventDefault(); app.redo(); return; }
      if (mod) return;
      if (k === ' ') { e.preventDefault(); app.togglePlay(); return; }
      if (k === 'escape') { if (app.pending) { app.pending = null; C.renderOpts(); app.invalidate(); } else if (app.tool !== 'select') C.setTool('select'); else app.select(null); return; }
      if (k === 'delete' || k === 'backspace') { if (app.sel) { e.preventDefault(); app.removeSel(); } return; }
      if (k === 'enter' && app.tool === 'rope') { C.finishRope(); return; }
      if (k === 'enter' && app.tool === 'surface') { C.finishSurface(); return; }
      if ((k === ']' || k === '[' || k === '}' || k === '{') && app.sel) { const op = k === ']' ? 'up' : k === '[' ? 'down' : k === '}' ? 'front' : 'back'; app.edit(() => MB.layer(app.model, app.sel, e.shiftKey && k === ']' ? 'front' : e.shiftKey && k === '[' ? 'back' : op), { live: true }); return; }
      if (k === 'r') { app.reset(); return; }
      if (k === 'f') { app.fit(); return; }
      if (k === '.') { app.stepOnce(); return; }
      const t = C.TOOLS.find((x) => x !== '|' && x.key === k);
      if (t) C.setTool(t.id);
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
