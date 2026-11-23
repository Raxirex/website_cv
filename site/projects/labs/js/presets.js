/* Dynamic Interactive Labs — preset systems (the user's sketch + analytic validation cases) */
(function (G) {
  'use strict';
  const MB = G.MB;
  const g0 = 9.81;

  function kit(name) {
    const m = MB.newModel(name);
    const body = (o) => { const b = MB.makeBody(o); m.bodies.push(b); return b; };
    const support = (type, b, p, o) => {
      const j = MB.makeJoint(Object.assign({ type, a: { body: null, p: MB.toWorld(m, { body: b.id, p }) }, b: { body: b.id, p: p.slice() } }, o));
      m.joints.push(j); return j;
    };
    const joint = (type, A, pa, B, pb, o) => {
      const j = MB.makeJoint(Object.assign({ type, a: { body: A.id, p: pa.slice() }, b: { body: B.id, p: pb.slice() } }, o));
      m.joints.push(j); return j;
    };
    const ref = (b, p) => (b ? { body: b.id, p: p.slice() } : { body: null, p: p.slice() });
    const spring = (A, pa, B, pb, o) => {
      const f = MB.makeForce(Object.assign({ type: 'sd', a: ref(A, pa), b: ref(B, pb) }, o));
      if (o.L0 == null) { const wa = MB.toWorld(m, f.a), wb = MB.toWorld(m, f.b); f.L0 = Math.hypot(wb[0] - wa[0], wb[1] - wa[1]); }
      m.forces.push(f); return f;
    };
    const stop = (A, pa, B, pb, o) => { const s = MB.makeStop(Object.assign({ a: ref(A, pa), b: ref(B, pb) }, o)); m.stops.push(s); return s; };
    const rope = (nodes, o) => {
      const r = MB.makeRope(Object.assign({ nodes: nodes.map((n) => MB.makeNode(Object.assign({}, n, { body: n.b ? n.b.id : null, b: undefined }))) }, o));
      r.nodes.forEach((n) => delete n.b);
      m.ropes.push(r); return r;
    };
    const force = (o) => { const f = MB.makeForce(o); m.forces.push(f); return f; };
    return { m, body, support, joint, spring, stop, rope, force, ref };
  }

  /* Material coordinate of the rope point closest to (x, y) in the initial configuration */
  MB.ropeMarkerAt = function (model, rope, x, y) {
    const sim = new MB.Sim(model), R = sim.ropes.find((r) => r.el === rope);
    if (!R) return 0;
    const d = sim.ropeDraw(R, sim.q);
    let s = d.base, best = Infinity, bestS = 0;
    const arcBy = new Map(d.arcs.filter((a) => !a.drum).map((a) => [a.j, a]));
    d.segs.forEach((sg, k) => {
      const dx = sg.x1 - sg.x0, dy = sg.y1 - sg.y0, L2 = dx * dx + dy * dy || 1e-12;
      const u = Math.max(0, Math.min(1, ((x - sg.x0) * dx + (y - sg.y0) * dy) / L2));
      const px = sg.x0 + u * dx, py = sg.y0 + u * dy, dd = Math.hypot(px - x, py - y);
      if (dd < best) { best = dd; bestS = s + u * sg.l; }
      s += sg.l;
      const arc = arcBy.get(k + 1);
      if (arc) s += arc.len;
    });
    return bestS;
  };

  const P = [];

  P.push({
    id: 'sketch', name: 'Pulley system', tag: 'From your sketch',
    blurb: 'm₁ and m₂ slide in a channel of length D, coupled by a spring. A rope runs from the wall over the pulleys on m₁, over the hanging disk m₄ (no slip) and the fixed pulley down to m₃, which is guided vertically and sprung to the floor.',
    build() {
      const { m, body, support, spring, stop, rope } = kit('Pulley system');
      m.settings.origin = [0.125, 1.265];
      const m1 = body({ name: 'm_1', w: 1.15, h: 0.34, m: 4, x: 1.11, y: 0.205 });
      const m2 = body({ name: 'm_2', w: 0.34, h: 0.34, m: 1, x: 2.265, y: 0.205 });
      const m3 = body({ name: 'm_3', w: 0.245, h: 0.685, m: 2, x: 3.35, y: 0.945 });
      const m4 = body({ name: 'm_4', shape: 'disk', r: 0.34, m: 3, x: 1.32, y: 1.47 });
      support('slider', m1, [0, 0], { name: 'Guide 1', angle: 0 });
      support('slider', m2, [0, 0], { name: 'Guide 2', angle: 0 });
      support('slider', m3, [0, 0], { name: 'Guide 3', angle: 90 });
      spring(m1, [0.575, 0], m2, [-0.17, 0], { name: 'k_1', k: 150, L0: 0.41 });
      spring(null, [1.32, 2.22], m4, [0, 0], { name: 'k_4', k: 400, L0: 0.59 });
      spring(null, [3.35, 0], m3, [0, -0.3425], { name: 'k_3', k: 100, L0: 0.6025 });
      stop(null, [0, 0.205], m1, [-0.575, 0], { name: 'Wall left', angle: 0, e: 0.4 });
      stop(m1, [0.575, 0], m2, [-0.17, 0], { name: 'Contact m₁–m₂', angle: 0, e: 0.4 });
      stop(m2, [0.17, 0], null, [2.635, 0.205], { name: 'Wall right', angle: 0, e: 0.4 });
      const r = rope([
        { b: null, p: [0.125, 1.265] },
        { b: m1, p: [-0.375, 0.44], r: 0.11, dir: 1 },
        { b: m4, p: [0, 0], r: 0.34, dir: -1, stick: true },
        { b: m1, p: [0.375, 0.44], r: 0.11, dir: 1 },
        { b: null, p: [3.245, 2.005], r: 0.11, dir: -1 },
        { b: m3, p: [0, 0.3425] },
      ], { name: 'S' });
      r.markers.push({ name: 'C', s: +MB.ropeMarkerAt(m, r, 1.46, 0.865).toFixed(4) });
      m.plots = [`${m1.id}|x`, `${m3.id}|y`, `${r.id}|S0`, `${r.id}|S1`];
      m.notes = 'D = 2.635 m. Pulleys on m₁ and the top pulley are ideal (massless, frictionless). The rope does not slip on m₄, so m₄ rotates.\nUndamped as drawn, so it never comes to rest. Give k₁, k₃, k₄ a damping d, or set Air drag in System → Simulation, to let it settle.';
      return m;
    },
  });

  P.push({
    id: 'atwood', name: 'Atwood machine', tag: 'Validation',
    blurb: 'Two masses over an ideal fixed pulley. m₂ lands on the floor after 0.6 m (restitution e = 0.3); m₁ flies on, falls back and jerks the rope taut until everything rests.',
    expect: 'a = g(m₂−m₁)/(m₁+m₂) = 1.962 m/s², rope tension S = 2m₁m₂g/(m₁+m₂) = 23.544 N. Landing after t = √(2·0.6/1.962) = 0.782 s at v = 1.534 m/s; m₁ then rises another v²/2g = 0.120 m.',
    build() {
      const { m, body, rope, stop } = kit('Atwood machine');
      const a = body({ name: 'm_1', w: 0.2, h: 0.3, m: 2, x: -0.15, y: 0.9 });
      const b = body({ name: 'm_2', w: 0.2, h: 0.3, m: 3, x: 0.15, y: 1.1 });
      const r = rope([{ b: a, p: [0, 0.15] }, { b: null, p: [0, 2], r: 0.15, dir: -1 }, { b, p: [0, 0.15] }], { name: 'S' });
      stop(null, [0.15, 0.35], b, [0, -0.15], { name: 'Floor', angle: 90, e: 0.3 });
      stop(null, [-0.15, 0.35], a, [0, -0.15], { name: 'Floor', angle: 90, e: 0.3 });
      m.plots = [`${a.id}|y`, `${a.id}|ay`, `${r.id}|S0`];
      return m;
    },
  });

  P.push({
    id: 'yoyo', name: 'Yo-yo (rope unwinding)', tag: 'Validation',
    blurb: 'A uniform disk (R = 0.2 m) unwinds from a string wound on its axle (r = 0.04 m), fixed to the ceiling. 1.2 m of string is wound on. At the end of the string the yo-yo keeps spinning, the string rewinds from the other side and it climbs back (bounce factor e = 0.85 per turn-around). When the turn-around gets very slow it “sleeps”: it hangs at the end of the string and spins.',
    expect: 'J = ½mR² = 0.02 kg·m², a = g/(1 + J/(m r²)) = 9.81/13.5 = 0.7267 m/s², S = m(g − a) = 9.083 N, ω̇ = a/r = 18.17 rad/s². At the end of the string v = √(2·0.7267·1.2) = 1.321 m/s, ω = v/r = 33.0 rad/s; after the turn-around it climbs e²·1.2 = 0.867 m.',
    build() {
      const { m, body, rope } = kit('Yo-yo');
      const d = body({ name: 'm', shape: 'disk', r: 0.2, m: 1, x: 0, y: 2.2 });
      const r = rope([{ b: null, p: [-0.04, 2.9] }, { b: d, p: [0, 0], r: 0.04, dir: 1, wound: 1.2, bounce: 0.85 }], { name: 'S' });
      m.plots = [`${d.id}|y`, `${d.id}|vy`, `${r.id}|S0`];
      return m;
    },
  });

  P.push({
    id: 'incline', name: 'Rolling vs sliding', tag: 'Validation',
    blurb: 'A disk rolling without slip and a block sliding with Coulomb friction μ = 0.1 on 20° inclines, 2 m long, each ending at a buffer (restitution e = 0.5).',
    expect: 'Disk: a = ⅔·g·sin20° = 2.237 m/s². Block: a = g(sin20° − μcos20°) = 2.433 m/s². The block reaches its buffer after √(2·2/2.433) = 1.282 s, the disk after √(2·2/2.237) = 1.337 s.',
    build() {
      const { m, body, support, stop } = kit('Rolling vs sliding');
      const al = (-20 * Math.PI) / 180, ux = Math.cos(al), uy = Math.sin(al), nx = -uy, ny = ux;
      const d = body({ name: 'm_1', shape: 'disk', r: 0.2, m: 2, x: 0 + nx * 0.2, y: 1.3 + ny * 0.2 });
      m.joints.push(MB.makeJoint({ type: 'rolling', name: 'Rolling contact', a: { body: null, p: [0, 1.3] }, b: { body: d.id, p: [0, 0] }, angle: -20 }));
      const blk = body({ name: 'm_2', w: 0.3, h: 0.2, m: 2, th: -20, x: 0 + nx * 0.1, y: 0.4 + ny * 0.1 });
      support('slider', blk, [0, -0.1], { name: 'Incline', angle: -20, mu: 0.1 });
      // buffers 2 m down each incline; the normal points back up the slope
      stop(null, [nx * 0.2 + 2 * ux, 1.3 + ny * 0.2 + 2 * uy], d, [0, 0], { name: 'Buffer 1', angle: 160, gap: 0.2, e: 0.5 });
      stop(null, [nx * 0.1 + 2 * ux, 0.4 + ny * 0.1 + 2 * uy], blk, [0, 0], { name: 'Buffer 2', angle: 160, gap: 0.15, e: 0.5 });
      m.plots = [`${d.id}|v`, `${blk.id}|v`];
      return m;
    },
  });

  P.push({
    id: 'forced', name: 'Forced oscillator', tag: 'Validation',
    blurb: 'Mass on a spring–damper, harmonically excited close to resonance.',
    expect: 'ω₀ = √(k/m) = 20 rad/s (3.183 Hz), ζ = c/(2√(km)) = 0.10. Steady amplitude at 3.0 Hz: x̂ = (F̂/k)/√((1−η²)²+(2ζη)²) = 57.0 mm',
    build() {
      const { m, body, support, spring, force } = kit('Forced oscillator');
      const b = body({ name: 'm', w: 0.3, h: 0.3, m: 1, x: 0, y: 1.0 });
      support('slider', b, [0, 0], { name: 'Guide', angle: 90 });
      spring(null, [0, 2.0], b, [0, 0.15], { name: 'k', k: 400, c: 4, L0: 0.85 - g0 / 400 });
      const F1 = force({ type: 'load', name: 'F', b: { body: b.id, p: [0, -0.15] }, F0: 0, F1: 5, f: 3.0, angle: -90 });
      m.plots = [`${b.id}|y`, `${F1.id}|F`];
      return m;
    },
  });

  P.push({
    id: 'absorber', name: 'Vibration absorber', tag: 'Dynamics',
    blurb: 'Primary mass m₁ on k₁ excited at its own natural frequency; the tuned absorber m₂ on k₂ (√(k₂/m₂) = √(k₁/m₁)) keeps m₁ almost still.',
    expect: 'Run the modal analysis: the single resonance at 20 rad/s splits into two modes around it.',
    build() {
      const { m, body, support, spring, force } = kit('Vibration absorber');
      const a = body({ name: 'm_1', w: 0.4, h: 0.25, m: 5, x: 0, y: 1.0 });
      const b = body({ name: 'm_2', w: 0.2, h: 0.15, m: 0.5, x: 0, y: 1.6 });
      support('slider', a, [0, 0], { name: 'Guide 1', angle: 90 });
      support('slider', b, [0, 0], { name: 'Guide 2', angle: 90 });
      spring(null, [0, 0.3], a, [0, -0.125], { name: 'k_1', k: 2000, c: 2, L0: 0.575 + (5 * g0) / 2000 });
      spring(a, [0, 0.125], b, [0, -0.075], { name: 'k_2', k: 200, c: 1, L0: 0.4 + (0.5 * g0) / 200 });
      force({ type: 'load', name: 'F', b: { body: a.id, p: [0.2, 0] }, F0: 0, F1: 20, f: 20 / (2 * Math.PI), angle: 90 });
      m.plots = [`${a.id}|y`, `${b.id}|y`];
      return m;
    },
  });

  P.push({
    id: 'double', name: 'Double pendulum', tag: 'Dynamics',
    blurb: 'Two uniform bars joined by pins. Chaotic for large swings; energy should stay constant.',
    build() {
      const { m, body, support, joint } = kit('Double pendulum');
      const c = Math.cos(Math.PI / 6), s = Math.sin(Math.PI / 6);
      const b1 = body({ name: 'm_1', w: 0.6, h: 0.05, m: 1, th: 30, x: 0.3 * c, y: 1.5 + 0.3 * s });
      const b2 = body({ name: 'm_2', w: 0.6, h: 0.05, m: 1, th: 0, x: 0.6 * c + 0.3, y: 1.5 + 0.6 * s });
      support('pin', b1, [-0.3, 0], { name: 'Pivot' });
      joint('pin', b1, [0.3, 0], b2, [-0.3, 0], { name: 'Hinge' });
      m.settings.trails = true;
      m.plots = [`${b1.id}|th`, `${b2.id}|th`, 'E|D'];
      m.learn = 2;
      return m;
    },
  });

  P.push({
    id: 'triple', name: 'Triple pendulum', tag: 'Dynamics',
    blurb: 'Three uniform bars hinged in a chain. Released from a bent pose it becomes chaotic within seconds.',
    build() {
      const { m, body, support, joint } = kit('Triple pendulum');
      const L = 0.5, angs = [40, 10, -20];
      let px = 0, py = 1.8; const bars = [];
      angs.forEach((a, i) => {
        const r = (a * Math.PI) / 180, cx = px + (L / 2) * Math.cos(r), cy = py + (L / 2) * Math.sin(r);
        const b = body({ name: `m_${i + 1}`, w: L, h: 0.045, m: 1, th: a, x: cx, y: cy });
        if (i === 0) support('pin', b, [-L / 2, 0], { name: 'Pivot', mount: 'above' }); else joint('pin', bars[i - 1], [L / 2, 0], b, [-L / 2, 0], { name: `Hinge ${i}` });
        bars.push(b); px += L * Math.cos(r); py += L * Math.sin(r);
      });
      Object.assign(m.settings, { trails: true });
      m.plots = bars.map((b) => `${b.id}|th`).concat(['E|D']);
      m.learn = 3;
      return m;
    },
  });

  P.push({
    id: 'crank', name: 'Slider–crank', tag: 'Mechanism',
    blurb: 'Crank driven at 60 rpm by a speed-controlled motor; the piston works against a damper. Plot the motor torque.',
    build() {
      const { m, body, support, joint, spring } = kit('Slider–crank');
      const crank = body({ name: 'm_1', w: 0.3, h: 0.06, m: 0.5, x: 0.12, y: 1.0 });
      const rod = body({ name: 'm_2', w: 0.8, h: 0.05, m: 0.8, x: 0.64, y: 1.0 });
      const pis = body({ name: 'm_3', w: 0.25, h: 0.18, m: 1, x: 1.04, y: 1.0 });
      const mot = support('pin', crank, [-0.12, 0], { name: 'Motor', drive: 'speed', dv: 2 * Math.PI });
      joint('pin', crank, [0.12, 0], rod, [-0.4, 0], { name: 'Crank pin' });
      joint('pin', rod, [0.4, 0], pis, [0, 0], { name: 'Wrist pin' });
      support('slider', pis, [0, 0], { name: 'Cylinder', angle: 0 });
      spring(pis, [0.125, 0], null, [1.8, 1.0], { name: 'd', k: 0, c: 15 });
      m.plots = [`${pis.id}|x`, `${pis.id}|vx`, `${mot.id}|drv`];
      return m;
    },
  });

  P.push({
    id: 'hang', name: 'Hanging mass: undamped vs damped', tag: 'Damping',
    blurb: 'Two identical masses hang from fixed points on springs, both pulled down 0.2 m below their rest position. Left: d = 0, the energy stays in the system and it bounces forever. Right: ζ = 0.1, it settles at the static deflection.',
    expect: 'ω₀ = √(k/m) = 10 rad/s, static deflection mg/k = 0.098 m; the damped bounce decays like e^(−ζω₀t) = e^(−t)',
    build() {
      const { m, body } = kit('Hanging mass: undamped vs damped');
      [[0, 0, 'k_1'], [1.6, 4, 'k_2']].forEach(([x0, c, name], i) => {
        const a = MB.makeAnchor({ p: [x0, 2.2], name: i ? 'B' : 'A' }); m.anchors.push(a);
        const b = body({ name: `m_${i + 1}`, w: 0.3, h: 0.25, m: 2, x: x0, y: 1.125 });
        m.forces.push(MB.makeForce({ type: 'sd', name, a: { body: null, p: a.p.slice(), anchor: a.id }, b: { body: b.id, p: [0, 0.125] }, k: 200, c, L0: 0.7 }));
      });
      m.settings.trails = true;
      m.plots = [`${m.bodies[0].id}|y`, `${m.bodies[1].id}|y`, 'E|E'];
      return m;
    },
  });

  P.push({
    id: 'visco', name: 'Creep test: four spring–damper networks', tag: 'Networks',
    blurb: 'Four 2 kg blocks on vertical guides (viscous guide friction 20 N·s/m) hang from four arrangements of springs and dampers, unloaded at t = 0, then gravity pulls. Kelvin–Voigt k ∥ d creeps to a limit, Maxwell k — d flows without limit until the block lands on the floor, the standard linear solid jumps and then relaxes, Burgers does all three. Select a network to edit it: any series/parallel tree.',
    expect: 'Final sag mg/k₀ = 19.62/200 = 0.098 m for Kelvin–Voigt and Zener. Maxwell and Burgers sink steadily at v = mg/(d₁ + d_guide) = 19.62/(800 + 20) = 0.0239 m/s. Zener first acts with k₁ + k₂ = 400 N/m, then relaxes with τ = d/k₂ = 1 s.',
    build() {
      const { m, body, support } = kit('Creep test: spring–damper networks');
      const { K, C, S, P: Pp } = MB.Net.make;
      const nets = [['KV', Pp(K(200), C(40))], ['Maxwell', S(K(200), C(800))], ['Zener', Pp(K(200), S(K(200), C(200)))], ['Burgers', S(K(200), C(800), Pp(K(200), C(200)))]];
      nets.forEach(([name, net], i) => {
        const x0 = 1.1 * i, a = MB.makeAnchor({ p: [x0, 2.4], name: String.fromCharCode(65 + i) }); m.anchors.push(a);
        const b = body({ name: `m_${i + 1}`, w: 0.3, h: 0.25, m: 2, x: x0, y: 2.4 - 0.8 - 0.125 });
        support('slider', b, [0, 0], { name: `Guide ${i + 1}`, angle: 90, c: 20 });
        m.stops.push(MB.makeStop({ name: 'Floor', a: { body: null, p: [x0, 0.3] }, b: { body: b.id, p: [0, -0.125] }, angle: 90, e: 0 }));
        m.forces.push(MB.makeForce({ type: 'sd', name, a: { body: null, p: a.p.slice(), anchor: a.id }, b: { body: b.id, p: [0, 0.125] }, L0: 0.8, net }));
      });
      m.plots = m.bodies.map((b) => `${b.id}|y`);
      return m;
    },
  });

  P.push({
    id: 'car', name: 'Car over bumps', tag: 'Contact',
    blurb: 'Half-car: chassis (bounce and pitch) on two wheels with spring–damper suspension, rolling at 5 m/s on a road with a bump and a wavy section. Ramps at both ends send it back. Change the suspension damping d of k_f and k_r and run it again.',
    expect: 'Body bounce ≈ √(k/(m_c/2))/2π = 1.59 Hz. The waves (λ = 3 m) at 5 m/s excite at v/λ = 1.67 Hz, close to that resonance.',
    build() {
      const { m, body, joint, spring } = kit('Car over bumps');
      const v = 5, r = 0.3;
      const ch = body({ name: 'm_c', w: 2.6, h: 0.5, m: 600, x: 0, y: 1.0, vx: v });
      const wheels = [[-1.2, 'r', 'Rear axle'], [1.2, 'f', 'Front axle']].map(([x, s, nm]) => {
        const w = body({ name: `m_${s}`, shape: 'disk', r, m: 35, x, y: r, vx: v, om: -v / r });
        joint('roller', ch, [x, -0.7], w, [0, 0], { name: nm, angle: 90 });
        const sp = spring(w, [0, 0], ch, [x, -0.25], { name: `k_${s}`, k: 30000, c: 1800, L0: 0.45 + (300 * g0) / 30000 });
        return [w, sp];
      });
      // the road ends in two smooth ramps (y = 2·(Δx/12)²) so the car rolls back and forth instead of leaving the scene
      const ramp = (x0, sg) => Array.from({ length: 25 }, (_, k) => { const d = (12 * (k + 1)) / 25; return [x0 + sg * d, 2 * (d / 12) ** 2]; });
      const pts = ramp(-4, -1).reverse().concat([[-4, 0], [62, 0]], ramp(62, 1));
      const road = MB.makeSurface({ name: 'Road', pts, mu: 0.9, e: 0, features: [{ type: 'bump', at: 28.4, L: 2, h: 0.06 }, { type: 'waves', from: 38.4, to: 58.4, A: 0.025, L: 3 }] });
      m.surfaces.push(road);
      Object.assign(m.settings, { follow: true, followId: ch.id, frames: false });
      m.plots = [`${ch.id}|y`, `${ch.id}|th`, `${wheels[1][1].id}|F`, `${road.id}:${wheels[1][0].id}|N`];
      return m;
    },
  });

  P.push({
    id: 'tauto', name: 'Tautochrone: cycloid vs circle', tag: 'Constraints',
    blurb: 'Beads slide without friction on wires: two on a cycloid (left), two on a circle of the same curvature at the bottom (right), released from the same pair of heights. Point-on-curve joints; the multiplier is the normal force.',
    expect: 'Cycloid: both beads reach the bottom together after π√(R/g) = 0.634 s (R = 0.4 m), whatever the height. Circle (radius 4R, the same curvature at the bottom): 0.676 s from the higher start, 0.648 s from the lower — a pendulum is not isochronous.',
    build() {
      const { m, body } = kit('Tautochrone');
      const R = 0.4, cyc = (u) => [R * (u + Math.sin(u)), R * (1 - Math.cos(u))], Rc = 4 * R, xc = 3.0;
      const add = (name, x, y, curve, org) => { const b = body({ name, shape: 'disk', r: 0.035, m: 0.1, x, y }); m.joints.push(MB.makeJoint({ type: 'path', name: '', a: { body: null, p: org }, b: { body: b.id, p: [0, 0] }, curve })); return b; };
      const p1 = cyc(2.5), p2 = cyc(-1.2), h1 = p1[1], h2 = p2[1], f1 = Math.acos(1 - h1 / Rc), f2 = Math.acos(1 - h2 / Rc);
      const a1 = add('c_1', p1[0], p1[1], { type: 'cycloid', R }, [0, 0]), a2 = add('c_2', p2[0], p2[1], { type: 'cycloid', R }, [0, 0]);
      const b1 = add('k_1', xc + Rc * Math.sin(f1), Rc - Rc * Math.cos(f1), { type: 'circle', R: Rc, from: -160, to: -20 }, [xc, Rc]), b2 = add('k_2', xc - Rc * Math.sin(f2), Rc - Rc * Math.cos(f2), { type: 'circle', R: Rc, from: -160, to: -20 }, [xc, Rc]);
      m.settings.origin = [0, 0]; Object.assign(m.settings, { ovFBD: true, ovSel: a1.id }); m.plots = [`${a1.id}|x`, `${a2.id}|x`, `${b1.id}|x`, `${b2.id}|x`];
      return m;
    },
  });

  P.push({
    id: 'rodbead', name: 'Bead on a spinning rod (Coriolis)', tag: 'Constraints',
    blurb: 'A rod turns at a constant Ω = 2 rad/s in a horizontal plane (g = 0); a bead slides on it without friction. Its distance grows like r₀ cosh Ωt and the rod has to push it sideways with the Coriolis force. An end cap at 0.65 m catches it (e = 0.5); then the cap supplies the centripetal force.',
    expect: 'r = r₀ cosh Ωt; normal force N = 2mΩṙ = 2mΩ²r₀ sinh Ωt (0.58 N at t = 1 s for m = 0.2 kg, r₀ = 0.1 m). It reaches the cap (r = 0.62 m) at t = arcosh(6.2)/Ω = 1.256 s; resting there the cap pushes mΩ²r = 0.496 N. Pick “rotating with rod” as observer to see the centrifugal and Coriolis forces.',
    build() {
      const { m, body, support } = kit('Bead on a spinning rod');
      m.settings.g = 0; const W = 2, r0 = 0.1;
      const rod = body({ name: 'rod', w: 1.4, h: 0.035, m: 2, x: 0, y: 1 });
      support('pin', rod, [0, 0], { name: 'motor', drive: 'speed', dv: W });
      const bead = body({ name: 'bead', shape: 'disk', r: 0.03, m: 0.2, x: r0, y: 1, vy: W * r0 });
      const j = MB.makeJoint({ type: 'path', name: 'rod wire', a: { body: rod.id, p: [0, 0] }, b: { body: bead.id, p: [0, 0] }, curve: { type: 'line', span: 1.4 } }); m.joints.push(j);
      // end cap at r = 0.65 m, its normal turns with the rod
      m.stops.push(MB.makeStop({ name: 'End cap', a: { body: rod.id, p: [0.65, 0] }, b: { body: bead.id, p: [0, 0] }, angle: 180, gap: 0.03, e: 0.5, local: true }));
      Object.assign(m.settings, { ovKin: true, ovFBD: true, ovObs: rod.id, ovSel: bead.id });
      m.plots = [`${bead.id}|x`, `${bead.id}|v`, `${j.id}|n`];
      return m;
    },
  });

  P.push({
    id: 'whirl', name: 'Bead on a whirling hoop', tag: 'Constraints',
    blurb: 'A hoop is spun at Ω = 3 rad/s about a pin on its rim, in a horizontal plane (g = 0). The bead on it swings about the far point like a pendulum in the centrifugal field.',
    expect: 'Relative motion ψ̈ = −Ω² sin ψ: small swings with period 2π/Ω = 2.094 s, independent of the hoop size; from ψ₀ = 40°, T = (4/Ω)·K(sin 20°) = 2.160 s. The Coriolis force does no work in the hoop frame.',
    build() {
      const { m, body, support } = kit('Bead on a whirling hoop');
      m.settings.g = 0; const W = 3, R = 0.4, ps = (40 * Math.PI) / 180;
      const hoop = body({ name: 'hoop', shape: 'disk', r: R, m: 1, x: R, y: 0, vy: W * R, om: W });
      support('pin', hoop, [-R, 0], { name: 'pivot', drive: 'speed', dv: W });
      const bx = R + R * Math.cos(ps), by = R * Math.sin(ps), bead = body({ name: 'bead', shape: 'disk', r: 0.03, m: 0.1, x: bx, y: by, vx: -W * by, vy: W * bx });
      const j = MB.makeJoint({ type: 'path', name: 'wire', a: { body: hoop.id, p: [0, 0] }, b: { body: bead.id, p: [0, 0] }, curve: { type: 'circle', R } }); m.joints.push(j);
      Object.assign(m.settings, { ovObs: hoop.id, ovSel: bead.id, ovKin: true });
      m.plots = [`${bead.id}|x`, `${j.id}|n`];
      return m;
    },
  });

  P.push({
    id: 'gears', name: 'Gear train with a motor', tag: 'Mechanism',
    blurb: 'A motor torque M = 2 N·m drives pinion A; idler B passes the motion to gear C, whose bearing has rotational damping c = 0.5 N·m·s. Gear joints couple the rotations; the pins carry the shafts.',
    expect: 'Steady state: M ω_A = c ω_C², ω_A = ω_C r_C/r_A → ω_C = M r_C/(r_A c) = 10 rad/s, ω_A = 25 rad/s. Tooth force in the steady state at C: c ω_C/r_C = 25 N.',
    build() {
      const { m, body, support } = kit('Gear train');
      const A = body({ name: 'A', shape: 'disk', r: 0.08, m: 0.5, x: 0, y: 1 }), B = body({ name: 'B', shape: 'disk', r: 0.12, m: 0.8, x: 0.2, y: 1 }), C = body({ name: 'C', shape: 'disk', r: 0.2, m: 3, x: 0.52, y: 1 });
      support('pin', A, [0, 0], { name: 'motor', drive: 'effort', e0: 2 }); support('pin', B, [0, 0], { name: '' }); support('pin', C, [0, 0], { name: 'load', c: 0.5 });
      const g1 = MB.makeJoint({ type: 'gear', name: 'AB', a: { body: A.id, p: [0, 0] }, b: { body: B.id, p: [0, 0] }, ra: 0.08, rb: 0.12 }), g2 = MB.makeJoint({ type: 'gear', name: 'BC', a: { body: B.id, p: [0, 0] }, b: { body: C.id, p: [0, 0] }, ra: 0.12, rb: 0.2 });
      m.joints.push(g1, g2); m.plots = [`${A.id}|om`, `${C.id}|om`, `${g2.id}|f`];
      return m;
    },
  });

  P.push({
    id: 'empty', name: 'Empty canvas', tag: 'Start fresh', blurb: 'Gravity and a floor at y = 0 (μ = 0.5, e = 0.3), so whatever you build lands instead of falling for ever. Select the floor and delete it if you do not need it.',
    build: () => { const m = MB.newModel('New system'); m.surfaces.push(MB.makeSurface({ name: 'Floor', pts: [[-4, 0], [8, 0]], mu: 0.5, e: 0.3 })); return m; },
  });

  MB.presets = P;
})(typeof window !== 'undefined' ? window : globalThis);
