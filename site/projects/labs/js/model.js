/* Dynamic Interactive Labs — model definitions (plain data, JSON-serialisable) */
(function (G) {
  'use strict';
  const MB = (G.MB = G.MB || {});
  let ctr = 0;
  MB.uid = (p) => p + (ctr++).toString(36) + Math.random().toString(36).slice(2, 7);
  MB.clone = (o) => JSON.parse(JSON.stringify(o));

  MB.defaultSettings = () => ({
    g: 9.81, gAngle: -90, dt: 0.001, speed: 1, sampleDt: 0.005,
    grid: true, snap: true, labels: true, frames: true, forces: false, trails: false,
    origin: [0, 0], drag: 0, follow: false, followId: null, ovFBD: false, ovKin: false, ovMom: false, ovObs: '',
  });

  MB.newModel = (name) => ({
    version: 1, name: name || 'Untitled system', notes: '',
    settings: MB.defaultSettings(),
    bodies: [], joints: [], forces: [], ropes: [], stops: [], surfaces: [], anchors: [], view: null,
  });

  /* Bodies: angles in degrees (th), angular velocity in rad/s (om) */
  MB.makeBody = (o) => Object.assign({
    id: MB.uid('b'), name: 'm', shape: 'block', w: 0.4, h: 0.3, r: 0.2,
    m: 1, Jauto: true, J: 0.01, x: 0, y: 0, th: 0, vx: 0, vy: 0, om: 0,
  }, o);
  MB.inertia = (b) => (b.Jauto
    ? (b.shape === 'disk' ? 0.5 * b.m * b.r * b.r : (b.m * (b.w * b.w + b.h * b.h)) / 12)
    : b.J);

  /* Joints & supports. a = body A (null = ground, p global), b = body B (p local).
     type: pin | roller | slider | fixed | rolling | rod
     angle: guide axis in degrees, measured in A's frame (global for ground).
     drive: none | speed | effort (speed: rad/s or m/s; effort: N·m or N, e0 + e1·sin(2π·ef·t)) */
  MB.makeJoint = (o) => Object.assign({
    id: MB.uid('j'), type: 'pin', name: '',
    a: { body: null, p: [0, 0] }, b: { body: null, p: [0, 0] },
    angle: 0, c: 0, mu: 0, drive: 'none', dv: 0, e0: 0, e1: 0, ef: 1,
  }, o, o.type === 'path' ? { curve: Object.assign({ type: 'circle', R: 0.5, a: 0.6, b: 0.35, A: 0.15, L: 1, span: 2 }, o.curve || {}) } : {}, o.type === 'gear' ? { ra: o.ra || 0.1, rb: o.rb || 0.2, mesh: o.mesh || 'ext' } : {});

  /* Force elements
     sd      spring/damper  k [N/m], k3 [N/m³], c [N·s/m], L0 [m]
     torsion rotational spring/damper between A and B  kt [N·m/rad], ct, phi0 [deg]
     load    point force on body b  F0 + F1·sin(2π f t + ph)  at angle [deg] (global or body-fixed)
     torque  M0 + M1·sin(2π f t) on body b */
  MB.makeForce = (o) => {
    const base = { id: MB.uid('f'), name: '' };
    switch (o.type) {
      case 'sd': return Object.assign(base, { type: 'sd', a: { body: null, p: [0, 0] }, b: { body: null, p: [0, 0] }, k: 100, k3: 0, c: 0, L0: 0.5 }, o);
      case 'torsion': return Object.assign(base, { type: 'torsion', a: { body: null }, b: { body: null }, kt: 10, ct: 0, phi0: 0 }, o);
      case 'load': return Object.assign(base, { type: 'load', b: { body: null, p: [0, 0] }, F0: 10, F1: 0, f: 1, ph: 0, angle: -90, follower: false }, o);
      case 'torque': return Object.assign(base, { type: 'torque', b: { body: null }, M0: 1, M1: 0, f: 1 }, o);
    }
    return Object.assign(base, o);
  };

  /* Ropes: ordered route of nodes. r = 0 → attachment point; r > 0 → pulley / drum.
     dir: +1 rope runs counter-clockwise around the pulley, −1 clockwise.
     stick: no-slip contact (rope material moves with the pulley rim).
     First/last nodes with r > 0 are drums (rope end wound on, always no-slip). */
  MB.makeRope = (o) => Object.assign({
    id: MB.uid('r'), name: 'S', nodes: [], slack: true, slack0: 0, markers: [],
  }, o);
  MB.makeNode = (o) => Object.assign({ body: null, p: [0, 0], r: 0, dir: 1, stick: false }, o);

  /* Stops: unilateral contact  n·(pB − pA) ≥ gap, n at angle [deg] (global), restitution e */
  MB.makeStop = (o) => Object.assign({
    id: MB.uid('s'), name: '', a: { body: null, p: [0, 0] }, b: { body: null, p: [0, 0] }, angle: 0, gap: 0, e: 0.3,
  }, o);

  /* Surfaces: polyline (≥ 2 points) fixed to ground (body null, world coords) or carried by a part (local coords).
     Disks and block corners touch them: unilateral contact, Coulomb friction μ (stick/slip), restitution e.
     belt: tangential speed of the surface material along its drawing direction (conveyor / treadmill).
     side: +1 hatching on the right of the drawing direction (below for left → right).
     features: profile added along the arc length s, toward the free side:
       { type: 'bump', at, L, h }   raised-cosine bump centred at s = at (h < 0 = pothole)
       { type: 'waves', from, to, A, L }   sine waviness of amplitude A and wavelength L */
  MB.makeSurface = (o) => Object.assign({
    id: MB.uid('u'), name: '', body: null, pts: [[0, 0], [1, 0]], features: [], mu: 0.8, e: 0, belt: 0, side: 1,
  }, o);

  /* Fixed points: places on the ground to hang things from. Ends attached to one carry { anchor: id }. */
  MB.makeAnchor = (o) => Object.assign({ id: MB.uid('a'), name: '', p: [0, 0], mount: 'auto' }, o);

  /* Sampled profile of a surface in its own frame: [[x, y], ...] */
  MB.surfacePoints = function (el) {
    const base = el.pts || [], feats = (el.features || []).filter((f) => f && (f.type === 'bump' || f.type === 'waves'));
    if (base.length < 2 || !feats.length) return base.map((p) => p.slice());
    const segs = []; let S = 0;
    for (let k = 0; k < base.length - 1; k++) {
      const dx = base[k + 1][0] - base[k][0], dy = base[k + 1][1] - base[k][1], L = Math.hypot(dx, dy) || 1e-12;
      segs.push({ x0: base[k][0], y0: base[k][1], ux: dx / L, uy: dy / L, s0: S, L }); S += L;
    }
    const sd = el.side >= 0 ? 1 : -1;
    const span = (f) => (f.type === 'bump' ? [f.at - Math.abs(f.L) / 2, f.at + Math.abs(f.L) / 2] : [Math.min(f.from, f.to), Math.max(f.from, f.to)]);
    const off = (s) => {
      let o = 0;
      for (const f of feats) {
        const [a, b] = span(f);
        if (s < a || s > b) continue;
        if (f.type === 'bump') o += (+f.h || 0) * 0.5 * (1 + Math.cos((2 * Math.PI * (s - f.at)) / (Math.abs(f.L) || 1)));
        else o += (+f.A || 0) * Math.sin((2 * Math.PI * (s - Math.min(f.from, f.to))) / (Math.abs(f.L) || 1));
      }
      return o;
    };
    const dsAt = (s) => {
      let d = Infinity;
      for (const f of feats) { const [a, b] = span(f); if (s >= a - 1e-9 && s < b - 1e-9) d = Math.min(d, Math.max(0.005, Math.min(0.1, (Math.abs(f.L) || 1) / 64))); }
      return d;
    };
    const brk = [0, S];
    segs.forEach((g) => brk.push(g.s0));
    feats.forEach((f) => span(f).forEach((v) => { if (v > 0 && v < S) brk.push(v); }));
    brk.sort((a, b) => a - b);
    const at = (s) => {
      let g = segs[segs.length - 1];
      for (const sg of segs) if (s <= sg.s0 + sg.L + 1e-12) { g = sg; break; }
      const t = s - g.s0, o = off(s);
      return [g.x0 + g.ux * t - sd * g.uy * o, g.y0 + g.uy * t + sd * g.ux * o];
    };
    const out = []; let s = 0;
    out.push(at(0));
    while (s < S - 1e-9) {
      let nb = S;
      for (const b of brk) if (b > s + 1e-9) { nb = b; break; }
      s = Math.min(nb, s + dsAt(s));
      out.push(at(s));
    }
    return out;
  };

  MB.collections = ['bodies', 'joints', 'forces', 'ropes', 'stops', 'surfaces', 'anchors'];

  MB.find = (model, id) => {
    for (const k of MB.collections) {
      const i = (model[k] || []).findIndex((e) => e.id === id);
      if (i >= 0) return { coll: k, index: i, el: model[k][i] };
    }
    return null;
  };

  MB.refsBody = (el, bid) => {
    if (!el) return false;
    if (el.a && el.a.body === bid) return true;
    if (el.b && el.b.body === bid) return true;
    if (el.nodes && el.nodes.some((n) => n.body === bid)) return true;
    if ('pts' in el && el.body === bid) return true;
    return false;
  };

  /* Remove element; removing a body also removes every element attached to it. */
  MB.remove = (model, id) => {
    const f = MB.find(model, id);
    if (!f) return [];
    const removed = [f.el];
    model[f.coll].splice(f.index, 1);
    if (f.coll === 'bodies') {
      for (const k of ['joints', 'forces', 'ropes', 'stops', 'surfaces']) {
        model[k] = model[k].filter((e) => {
          if (MB.refsBody(e, id)) { removed.push(e); return false; }
          return true;
        });
      }
    }
    if (f.coll === 'anchors') MB.syncAnchors(model);
    return removed;
  };

  /* Every attachment ref linked to a fixed point; keeps their coordinates equal to the point's */
  MB.anchorRefs = (model) => {
    const out = [];
    for (const j of model.joints) for (const r of [j.a, j.b]) if (r && r.anchor) out.push(r);
    for (const f of model.forces) for (const r of [f.a, f.b]) if (r && r.anchor) out.push(r);
    for (const s of model.stops) for (const r of [s.a, s.b]) if (r && r.anchor) out.push(r);
    for (const r of model.ropes) for (const n of r.nodes) if (n.anchor) out.push(n);
    return out;
  };
  MB.syncAnchors = (model) => {
    const by = new Map((model.anchors || []).map((a) => [a.id, a]));
    for (const r of MB.anchorRefs(model)) {
      const a = by.get(r.anchor);
      if (!a || r.body) { delete r.anchor; continue; }
      r.p = a.p.slice();
    }
  };

  MB.kindOf = (el) => {
    if (!el) return '';
    if ('shape' in el) return 'body';
    if ('nodes' in el) return 'rope';
    if ('gap' in el) return 'stop';
    if ('pts' in el) return 'surface';
    if ('mount' in el && !('type' in el)) return 'anchor';
    if (['pin', 'roller', 'slider', 'fixed', 'rolling', 'rod', 'path', 'gear'].includes(el.type)) return 'joint';
    return 'force';
  };

  MB.typeName = (el) => {
    if (!el) return '';
    if ('shape' in el) return el.shape === 'disk' ? 'Disk' : 'Block';
    if ('nodes' in el) return 'Rope';
    if ('gap' in el) return 'Stop';
    if ('pts' in el) return el.body ? 'Moving surface' : 'Fixed surface';
    if ('mount' in el && !('type' in el)) return 'Fixed point';
    const g = el.a && !el.a.body;
    switch (el.type) {
      case 'pin': return g ? 'Fixed pin support' : 'Pin joint';
      case 'roller': return g ? 'Roller support' : 'Pin in slot';
      case 'slider': return g ? 'Sliding guide' : 'Prismatic joint';
      case 'fixed': return g ? 'Clamped support' : 'Weld';
      case 'rolling': return 'Rolling contact';
      case 'rod': return 'Rigid rod';
      case 'path': return g ? 'Point on a curve' : 'Point on a moving curve';
      case 'gear': return el.mesh === 'int' ? 'Gear pair (internal / belt)' : 'Gear pair';
      case 'sd': return el.net ? 'Spring–damper network' : el.k > 0 && el.c > 0 ? 'Spring–damper' : el.c > 0 && !(el.k > 0) ? 'Damper' : 'Spring';
      case 'torsion': return 'Torsion spring';
      case 'load': return 'Force';
      case 'torque': return 'Torque';
    }
    return 'Element';
  };

  const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', a: 'ₐ', e: 'ₑ', o: 'ₒ', x: 'ₓ', h: 'ₕ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', p: 'ₚ', s: 'ₛ', t: 'ₜ', '+': '₊', '-': '₋' };
  MB.plainName = (name) => {
    const s = String(name || ''), i = s.indexOf('_');
    if (i < 0) return s;
    const sub = s.slice(i + 1);
    return [...sub].every((c) => SUB[c]) ? s.slice(0, i) + [...sub].map((c) => SUB[c]).join('') : s;
  };

  /* Drawing order: explicit z (set by layer commands) or the default band of the element kind + 1000,
     so new elements appear on top of re-ordered ones and keep their natural order among themselves. */
  MB.zOf = (el) => {
    if (typeof el.z === 'number') return el.z;
    const k = MB.kindOf(el);
    const band = k === 'body' ? 20 : k === 'rope' ? 30 : k === 'joint' ? 40 : el.type === 'load' || el.type === 'torque' ? 50 : 10;
    return 1000 + band;
  };
  MB.layerable = (model) => {
    const out = [];
    model.forces.forEach((f) => { if (f.type === 'sd' || f.type === 'torsion') out.push(f); });
    model.bodies.forEach((b) => out.push(b));
    model.ropes.forEach((r) => out.push(r));
    model.joints.forEach((j) => { if (j.a.body || j.type !== 'rolling') out.push(j); });
    model.forces.forEach((f) => { if (f.type === 'load' || f.type === 'torque') out.push(f); });
    return out.map((el, k) => [el, MB.zOf(el), k]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map((x) => x[0]);
  };
  /* op: front | back | up | down */
  MB.layer = (model, id, op) => {
    const list = MB.layerable(model), i = list.findIndex((e) => e.id === id);
    if (i < 0) return false;
    const [el] = list.splice(i, 1);
    const ni = op === 'front' ? list.length : op === 'back' ? 0 : op === 'up' ? Math.min(list.length, i + 1) : Math.max(0, i - 1);
    list.splice(ni, 0, el);
    list.forEach((e, k) => (e.z = k));
    return ni !== i;
  };

  MB.nextName = (model, prefix) => {
    const used = new Set();
    for (const k of MB.collections) for (const e of model[k]) used.add(e.name);
    for (let i = 1; i < 999; i++) if (!used.has(prefix + '_' + i)) return prefix + '_' + i;
    return prefix;
  };

  /* Local ↔ world for an attachment reference using the model's initial pose */
  MB.bodyById = (model, id) => model.bodies.find((b) => b.id === id) || null;
  MB.toWorld = (model, ref) => {
    if (!ref.body) return [ref.p[0], ref.p[1]];
    const b = MB.bodyById(model, ref.body);
    if (!b) return [ref.p[0], ref.p[1]];
    const t = (b.th * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
    return [b.x + c * ref.p[0] - s * ref.p[1], b.y + s * ref.p[0] + c * ref.p[1]];
  };
  MB.toLocal = (model, bodyId, wx, wy) => {
    if (!bodyId) return [wx, wy];
    const b = MB.bodyById(model, bodyId);
    const t = (b.th * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
    const dx = wx - b.x, dy = wy - b.y;
    return [c * dx + s * dy, -s * dx + c * dy];
  };
})(typeof window !== 'undefined' ? window : globalThis);
