/* Dynamic Interactive Labs — inspector, system and analysis panels */
(function (G) {
  'use strict';
  const MB = G.MB, F = MB.F, h = F.h;
  const P = (MB.P = {});
  const $ = (s) => document.querySelector(s);
  const D2R = Math.PI / 180;

  const icoFor = (el) => {
    const k = MB.kindOf(el);
    if (k === 'body') return el.shape === 'disk' ? 'i-disk' : 'i-block';
    if (k === 'rope') return 'i-rope';
    if (k === 'stop') return 'i-stop';
    if (k === 'surface') return 'i-surface';
    if (k === 'anchor') return 'i-anchor';
    if (k === 'joint') return el.type === 'gear' ? 'i-gear' : el.a.body ? 'i-joint' : 'i-support';
    if (el.type === 'sd') return !el.net && el.c > 0 && !(el.k > 0) ? 'i-damper' : 'i-spring';
    if (el.type === 'torsion') return 'i-spring';
    return el.type === 'torque' ? 'i-torque' : 'i-load';
  };
  P.icoFor = icoFor;
  const bname = (id) => { const b = MB.bodyById(MB.app.model, id); return b ? MB.nameHTML(b.name) : 'ground'; };

  /* ---------------- inspector ---------------- */
  P.renderInspector = function () {
    const app = MB.app, root = $('#tab-inspect'), st = root.scrollTop, fid = document.activeElement && root.contains(document.activeElement) ? document.activeElement.id : '';
    root.innerHTML = '';
    const f = app.sel && MB.find(app.model, app.sel);
    if (!f) { root.append(emptyState()); return; }
    const el = f.el, kind = MB.kindOf(el);
    const acts = h('div', { class: 'insp-actions' });
    if (kind === 'body') acts.append(h('button', { class: 'icon-btn', title: 'Duplicate', onclick: () => app.duplicate(el.id) }, F.icon('i-copy')));
    acts.append(h('button', { class: 'icon-btn', title: 'Delete (Del)', onclick: () => app.removeSel() }, F.icon('i-trash')));
    root.append(h('div', { class: 'insp-head' },
      h('div', { class: 'titles' }, h('div', { class: 'eyebrow' }, MB.typeName(el)), h('div', { class: 'insp-title', html: el.name ? MB.nameHTML(el.name) : MB.typeName(el) })), acts));
    ({ body: bodyForm, joint: jointForm, force: forceForm, rope: ropeForm, stop: stopForm, surface: surfaceForm, anchor: anchorForm })[kind](root, el);
    if (MB.layerable(app.model).includes(el)) root.append(appearance(el, kind));
    root.scrollTop = st;
    if (fid) { const e = document.getElementById(fid); if (e) e.focus({ preventScroll: true }); }
    P.updateLive();
  };

  function emptyState() {
    const app = MB.app, m = app.model;
    const box = h('div', {});
    box.append(h('div', { class: 'eyebrow' }, 'Nothing selected'));
    box.append(h('p', { class: 'note', style: 'font-size:15px;color:var(--ink-2)' }, 'Tap a part, spring, rope or support on the drawing to edit it. Pick a tool to add elements; parameters such as masses, stiffnesses and loads can be changed while the simulation runs.'));
    if (m.notes) box.append(F.section('About this system', h('p', { class: 'note', style: 'white-space:pre-line' }, m.notes)));
    const tips = [
      ['Block / Disk', 'tap to place, drag to size'],
      ['Support', 'tap a part where it rests on ground'],
      ['Joint', 'tap where two parts connect'],
      ['Spring, Damper', 'tap the two ends'],
      ['Stop', 'tap the wall, then the part'],
      ['Rope', 'tap start → pulleys → end, then Finish'],
      ['Load', 'tap a part to apply a force or torque'],
      ['Surface', 'tap start, corners, end; starting on a part makes it move with that part'],
      ['Fixed point', 'Support tool on empty space; hang springs or ropes from it'],
    ];
    box.append(F.section('Building', h('dl', { class: 'tips' }, ...tips.map(([a, b]) => [h('dt', {}, a), h('dd', {}, b)]).flat())));
    box.append(h('p', { class: 'note' }, 'Number fields accept expressions such as ', h('b', {}, '2*pi'), ', ', h('b', {}, 'sqrt(400/1)'), ' or ', h('b', {}, '0.5*g'), '. Drag a field label sideways to scrub its value.'));
    return box;
  }

  /* Colour and drawing order for parts, springs, ropes, joints and loads */
  function appearance(el, kind) {
    const app = MB.app, sec = F.section('Appearance');
    const colorable = kind === 'body' || kind === 'rope' || (kind === 'force' && el.type === 'sd');
    if (colorable) {
      const sw = h('div', { class: 'swatches' });
      const pick = (c) => app.edit(() => { if (c) el.color = c; else delete el.color; }, { live: true });
      sw.append(h('button', { class: 'swatch auto' + (!el.color ? ' on' : ''), type: 'button', title: 'Theme default', 'aria-label': 'Theme default', onclick: () => pick(null) }));
      ['plot1', 'plot2', 'plot3', 'plot4', 'plot5', 'plot6', 'ink-3'].forEach((t) => sw.append(h('button', { class: 'swatch' + (el.color === t ? ' on' : ''), type: 'button', title: t, 'aria-label': 'Colour ' + t, style: `background:var(--${t})`, onclick: () => pick(t) })));
      const ci = h('input', { type: 'color', class: 'swatch-in', title: 'Custom colour', 'aria-label': 'Custom colour', value: /^#[0-9a-f]{6}$/i.test(el.color || '') ? el.color : '#888888' });
      ci.addEventListener('change', () => pick(ci.value));
      sw.append(ci);
      sec.append(h('div', { class: 'flabel', style: 'margin-bottom:6px' }, kind === 'body' ? 'Fill' : 'Line colour'), sw);
    }
    const lay = (op, label, icon, tip) => h('button', { class: 'btn', type: 'button', title: tip, onclick: () => { let ch = false; app.edit(() => (ch = MB.layer(app.model, el.id, op)), { live: true }); if (!ch) app.toast(op === 'front' || op === 'up' ? 'Already on top' : 'Already at the back'); } }, F.icon(icon, 'sm'), label);
    sec.append(h('div', { class: 'flabel', style: 'margin:10px 0 6px' }, 'Drawing order'), h('div', { class: 'layerbar' },
      lay('back', 'To back', 'i-back', 'Send to back (Shift+[)'), lay('down', 'Backward', 'i-down', 'Send backward ([)'), lay('up', 'Forward', 'i-up', 'Bring forward (])'), lay('front', 'To front', 'i-front', 'Bring to front (Shift+])')));
    return sec;
  }

  function liveBox(rows) { return h('div', { class: 'live' }, h('div', { class: 'eyebrow', style: 'margin-bottom:6px' }, 'Live'), F.kv(rows)); }

  function bodyForm(root, b) {
    const app = MB.app;
    root.append(F.fields(F.text({ label: 'Name', id: 'f-name', get: () => b.name, set: (v) => (b.name = v) })));
    root.append(h('p', { class: 'note' }, 'Use an underscore for subscripts: m_1 → ', h('span', { html: MB.nameHTML('m_1') })));
    root.append(F.section('Geometry', h('div', { class: 'row', style: 'margin-bottom:8px' }, F.seg({ label: 'Shape', options: [['block', 'Block'], ['disk', 'Disk']], get: () => b.shape, set: (v) => (b.shape = v) })),
      b.shape === 'disk'
        ? F.fields(F.num({ label: 'Radius <i class="mi">r</i>', unit: 'm', id: 'f-r', min: 1e-3, get: () => b.r, set: (v) => (b.r = v) }))
        : F.fields(F.num({ label: 'Width <i class="mi">w</i>', unit: 'm', id: 'f-w', min: 1e-3, get: () => b.w, set: (v) => (b.w = v) }), F.num({ label: 'Height <i class="mi">h</i>', unit: 'm', id: 'f-h', min: 1e-3, get: () => b.h, set: (v) => (b.h = v) }))));
    const J = MB.inertia(b);
    root.append(F.section('Mass', F.fields(
      F.num({ label: 'Mass <i class="mi">m</i>', unit: 'kg', id: 'f-m', min: 1e-6, live: true, get: () => b.m, set: (v) => (b.m = v) }),
      b.Jauto ? [h('span', { class: 'flabel' }, h('span', { html: 'Inertia <i class="mi">J</i><sub>S</sub>' }), h('span', { class: 'u' }, 'kg·m²')), h('span', { class: 'field', style: 'border-style:dashed' }, F.fmtNum(J))]
        : F.num({ label: 'Inertia <i class="mi">J</i><sub>S</sub>', unit: 'kg·m²', id: 'f-J', min: 1e-9, live: true, get: () => b.J, set: (v) => (b.J = v) })),
      h('div', { class: 'row', style: 'margin-top:8px' }, F.toggle({ label: 'Inertia from shape (uniform density)', get: () => b.Jauto, set: (v) => { b.Jauto = v; if (!v) b.J = J; }, live: true }))));
    root.append(F.section('Initial state (t = 0)', F.fields(
      F.num({ label: '<i class="mi">x</i>', unit: 'm', id: 'f-x', get: () => b.x, set: (v) => (b.x = v), step: 0.005 }),
      F.num({ label: '<i class="mi">y</i>', unit: 'm', id: 'f-y', get: () => b.y, set: (v) => (b.y = v), step: 0.005 }),
      F.num({ label: '<i class="mi">φ</i>', unit: '°', id: 'f-th', get: () => b.th, set: (v) => (b.th = v), step: 0.5 }),
      F.num({ label: '<i class="mi">ẋ</i>', unit: 'm/s', id: 'f-vx', get: () => b.vx, set: (v) => (b.vx = v), step: 0.01 }),
      F.num({ label: '<i class="mi">ẏ</i>', unit: 'm/s', id: 'f-vy', get: () => b.vy, set: (v) => (b.vy = v), step: 0.01 }),
      F.num({ label: '<i class="mi">ω</i>', unit: 'rad/s', id: 'f-om', get: () => b.om, set: (v) => (b.om = v), step: 0.05 })),
      h('p', { class: 'note' }, 'Velocities that violate a constraint are projected onto the admissible motion when the run starts.')));
    root.append(liveBox([['<i class="mi">x</i>', `${b.id}|x`, 'm'], ['<i class="mi">y</i>', `${b.id}|y`, 'm'], ['<i class="mi">φ</i>', `${b.id}|th`, '°'],
      ['|<i class="mi">v</i>|', `${b.id}|v`, 'm/s'], ['<i class="mi">ω</i>', `${b.id}|om`, 'rad/s'], ['<i class="mi">ẍ</i>', `${b.id}|ax`, 'm/s²'], ['<i class="mi">ÿ</i>', `${b.id}|ay`, 'm/s²'], ['<i class="mi">ω̇</i>', `${b.id}|al`, 'rad/s²']]));
    void app;
  }

  /* point on a curve (bead on a wire) */
  function pathForm(root, j) {
    const app = MB.app, ground = !j.a.body, k = j.curve || (j.curve = { type: 'circle', R: 0.5 }), car = ground ? null : MB.bodyById(app.model, j.a.body);
    root.append(h('p', { class: 'note', html: `The point of <b>${bname(j.b.body)}</b> stays on a curve ${ground ? 'fixed in space' : `carried by <b>${bname(j.a.body)}</b> (it moves and turns with that part)`}; it slides along it without friction. One constraint equation C = n·(P − c(u*)) = 0 with the closest curve point u*; the multiplier λ is the normal force.` }));
    root.append(F.section('Name', F.fields(F.text({ label: 'Label', id: 'f-jname', get: () => j.name || '', set: (v) => (j.name = v) }))));
    root.append(F.section('Curve', h('div', { class: 'row', style: 'margin-bottom:8px' }, F.seg({ label: 'Curve', wrap: true, small: true, options: [['circle', 'Circle'], ['ellipse', 'Ellipse'], ['parabola', 'Parabola'], ['cycloid', 'Cycloid'], ['sine', 'Sine'], ['line', 'Line']], get: () => k.type, set: (v) => (k.type = v) })),
      F.fields(...({ circle: [['R', 'Radius <i class="mi">R</i>', 'm']], ellipse: [['a', 'Semi-axis <i class="mi">a</i>', 'm'], ['b', 'Semi-axis <i class="mi">b</i>', 'm']], parabola: [['R', 'Vertex radius <i class="mi">R</i>', 'm'], ['span', 'Drawn width', 'm']], cycloid: [['R', 'Rolling-circle radius <i class="mi">R</i>', 'm']], sine: [['A', 'Amplitude <i class="mi">A</i>', 'm'], ['L', 'Wavelength <i class="mi">L</i>', 'm'], ['span', 'Drawn width', 'm']], line: [['span', 'Drawn length', 'm']] }[k.type] || []).map(([key, label, unit]) => F.num({ label, unit, id: 'f-cv-' + key, min: 1e-3, get: () => (k[key] != null ? k[key] : 0.5), set: (v) => (k[key] = v), step: 0.01 }))),
      h('p', { class: 'note', html: { circle: 'c(u) = R(cos u, sin u) around the origin.', ellipse: 'c(u) = (a cos u, b sin u).', parabola: 'y = x²/(2R), vertex at the origin, opening upward: a bowl.', cycloid: 'x = R(u + sin u), y = R(1 − cos u): the tautochrone (every start reaches the bottom after π√(R/g)) and the brachistochrone.', sine: 'y = A sin(2πx/L).', line: 'A straight wire along the frame axis (a bead on a rod when the carrier turns).' }[k.type] || '' })));
    const org = MB.toWorld(app.model, j.a);
    root.append(F.section(ground ? 'Origin and turn of the curve' : 'Origin on the carrier (local) and turn', F.fields(
      F.num({ label: '<i class="mi">x</i>₀', unit: 'm', id: 'f-cx', get: () => (ground ? j.a.p[0] : j.a.p[0]), set: (v) => (j.a.p = [v, j.a.p[1]]), step: 0.005 }),
      F.num({ label: '<i class="mi">y</i>₀', unit: 'm', id: 'f-cy', get: () => j.a.p[1], set: (v) => (j.a.p = [j.a.p[0], v]), step: 0.005 }),
      F.num({ label: 'Angle', unit: '°', id: 'f-ang', get: () => j.angle, set: (v) => (j.angle = v), step: 1, hint: ground ? 'Counter-clockwise turn of the curve frame' : 'Turn of the curve frame relative to the carrier' })),
      h('p', { class: 'note' }, `Origin now at (${F.fmtNum(+org[0].toFixed(3))}, ${F.fmtNum(+org[1].toFixed(3))}) m. The point is pulled onto the curve when the run starts.`)));
    root.append(liveBox([['Normal force <i class="mi">N</i> = λ', `${j.id}|n`, 'N']]));
    void car;
  }
  /* gear pair */
  function gearForm(root, j) {
    root.append(h('p', { class: 'note', html: `Couples the rotations of <b>${bname(j.a.body)}</b> and <b>${bname(j.b.body)}</b>: r_A Δφ_A ${j.mesh === 'int' ? '−' : '+'} r_B Δφ_B = 0 (${j.mesh === 'int' ? 'same sense: internal gear or belt' : 'opposite senses: external gears'}). The axes need their own pins; λ is the tooth (or belt) force, the pins carry the rest.` }));
    root.append(F.section('Name', F.fields(F.text({ label: 'Label', id: 'f-jname', get: () => j.name || '', set: (v) => (j.name = v) }))));
    root.append(F.section('Gears', h('div', { class: 'row', style: 'margin-bottom:8px' }, F.seg({ label: 'Mesh', options: [['ext', 'External'], ['int', 'Internal / belt']], get: () => j.mesh || 'ext', set: (v) => (j.mesh = v) })),
      F.fields(F.num({ label: 'Pitch radius <i class="mi">r</i><sub>A</sub>', unit: 'm', id: 'f-ra', min: 1e-3, get: () => j.ra, set: (v) => (j.ra = v), step: 0.005 }), F.num({ label: 'Pitch radius <i class="mi">r</i><sub>B</sub>', unit: 'm', id: 'f-rb', min: 1e-3, get: () => j.rb, set: (v) => (j.rb = v), step: 0.005 })),
      h('p', { class: 'note' }, `Ratio i = ω_A/ω_B = ${F.fmtNum(+((j.mesh === 'int' ? 1 : -1) * (j.rb / j.ra)).toFixed(4))}`)));
    root.append(liveBox([['Tooth force', `${j.id}|f`, 'N']]));
  }
  function jointForm(root, j) {
    if (j.type === 'path') return pathForm(root, j);
    if (j.type === 'gear') return gearForm(root, j);
    const app = MB.app, ground = !j.a.body, bB = MB.bodyById(app.model, j.b.body);
    const opts = ground
      ? [['pin', 'Pin'], ['roller', 'Roller'], ['slider', 'Guide'], ['fixed', 'Clamp']].concat(bB && bB.shape === 'disk' ? [['rolling', 'Rolling']] : [])
      : [['pin', 'Pin'], ['slider', 'Prismatic'], ['roller', 'Slot'], ['fixed', 'Weld']];
    if (j.type === 'rod') opts.splice(0, opts.length, ['rod', 'Rod']);
    root.append(h('div', { class: 'row' }, F.seg({ label: 'Type', wrap: true, options: opts, get: () => j.type, set: (v) => {
      if (v === 'rolling') { j.a.p = [bB.x, bB.y - bB.r]; j.b.p = [0, 0]; j.angle = 0; j.drive = 'none'; }
      else if (j.type === 'rolling') { j.b.p = [0, 0]; j.a.p = [bB.x, bB.y]; }
      j.type = v;
      if (v === 'fixed' || v === 'rolling') j.drive = 'none';
    } })));
    root.append(h('p', { class: 'note', html: `Connects <b>${bname(j.a.body)}</b> to <b>${bname(j.b.body)}</b>. ` + ({
      pin: 'Locks both translations at the point; rotation free.', roller: 'Locks the translation normal to the axis; slides along it and rotates.',
      slider: 'Slides along the axis; normal translation and rotation locked.', fixed: 'Locks translation and rotation.',
      rolling: 'Disk rolls on the line without slipping.', rod: 'Massless rigid link: keeps the distance between the two points.' }[j.type] || '') }));
    root.append(F.section('Name', F.fields(F.text({ label: 'Label', id: 'f-jname', get: () => j.name || '', set: (v) => (j.name = v) }))));
    const world = MB.toWorld(app.model, j.b);
    if (j.type !== 'rod') {
      const move = (nx, ny) => { if (ground) j.a.p = j.type === 'rolling' ? j.a.p : [nx, ny]; else j.a.p = MB.toLocal(app.model, j.a.body, nx, ny); if (j.type !== 'rolling') j.b.p = MB.toLocal(app.model, j.b.body, nx, ny); };
      if (j.type !== 'rolling') root.append(F.section('Location', F.fields(
        F.num({ label: '<i class="mi">x</i>', unit: 'm', id: 'f-jx', get: () => MB.toWorld(app.model, j.b)[0], set: (v) => move(v, world[1]), step: 0.005 }),
        F.num({ label: '<i class="mi">y</i>', unit: 'm', id: 'f-jy', get: () => MB.toWorld(app.model, j.b)[1], set: (v) => move(world[0], v), step: 0.005 }))));
    }
    if (['roller', 'slider', 'rolling'].includes(j.type)) {
      root.append(F.section(j.type === 'rolling' ? 'Rolling line' : 'Guide axis', F.fields(
        F.num({ label: 'Angle', unit: '°', id: 'f-ang', get: () => j.angle, set: (v) => (j.angle = v), step: 1, hint: 'Measured counter-clockwise from the horizontal' + (ground ? '' : ', in the frame of the first part') })),
        h('div', { class: 'row', style: 'margin-top:8px' }, F.btn('Horizontal', () => app.edit(() => (j.angle = 0))), F.btn('Vertical', () => app.edit(() => (j.angle = 90))), F.btn('+90°', () => app.edit(() => (j.angle = ((j.angle + 90) % 360))), '', 'i-rotate'))));
    }
    if (ground && (j.type === 'pin' || j.type === 'fixed')) root.append(F.section('Symbol', h('div', { class: 'row' }, F.seg({ small: true, wrap: true, label: 'Ground side', live: true, options: [['auto', 'Auto'], ['below', 'Below'], ['above', 'Above'], ['left', 'Left'], ['right', 'Right']], get: () => j.mount || 'auto', set: (v) => (j.mount = v) })),
      h('p', { class: 'note' }, 'Where the hatched ground sits relative to the pin. Drawing only; the support is fixed to the inertial frame either way.')));
    if (j.type === 'pin') root.append(F.section('Bearing', F.fields(F.num({ label: 'Rotational damping', unit: 'N·m·s', id: 'f-c', min: 0, live: true, get: () => j.c, set: (v) => (j.c = v) }))));
    if (j.type === 'roller' || j.type === 'slider') root.append(F.section('Guide friction', F.fields(
      F.num({ label: 'Viscous <i class="mi">c</i>', unit: 'N·s/m', id: 'f-c', min: 0, live: true, get: () => j.c, set: (v) => (j.c = v) }),
      F.num({ label: 'Coulomb <i class="mi">μ</i>', unit: '–', id: 'f-mu', min: 0, live: true, get: () => j.mu, set: (v) => (j.mu = v), step: 0.01 })),
      h('p', { class: 'note' }, 'Coulomb friction uses the normal reaction from the previous step, regularised below 1 cm/s.')));
    if (['pin', 'roller', 'slider'].includes(j.type)) {
      const rot = j.type === 'pin';
      const sec = F.section('Drive', h('div', { class: 'row', style: 'margin-bottom:8px' }, F.seg({ label: 'Drive', options: [['none', 'None'], ['speed', rot ? 'Speed' : 'Velocity'], ['effort', rot ? 'Torque' : 'Force']], get: () => j.drive, set: (v) => (j.drive = v) })));
      if (j.drive === 'speed') {
        sec.append(F.fields(F.num({ label: rot ? 'Angular speed Ω' : 'Velocity <i class="mi">v</i>', unit: rot ? 'rad/s' : 'm/s', id: 'f-dv', get: () => j.dv, set: (v) => (j.dv = v) })));
        if (rot) sec.append(h('p', { class: 'note' }, `= ${F.fmtNum((j.dv * 60) / (2 * Math.PI))} rpm. Prescribed motion; the required torque is a plot channel.`));
      } else if (j.drive === 'effort') {
        const u = rot ? 'N·m' : 'N';
        sec.append(F.fields(
          F.num({ label: 'Constant', unit: u, id: 'f-e0', live: true, get: () => j.e0, set: (v) => (j.e0 = v) }),
          F.num({ label: 'Amplitude', unit: u, id: 'f-e1', live: true, get: () => j.e1, set: (v) => (j.e1 = v) }),
          F.num({ label: 'Frequency', unit: 'Hz', id: 'f-ef', min: 0, live: true, get: () => j.ef, set: (v) => (j.ef = v) })),
        h('p', { class: 'note' }, rot ? 'M(t) = M₀ + M̂·sin(2πft), acting on the second part.' : 'F(t) = F₀ + F̂·sin(2πft) along the axis.'));
      }
      root.append(sec);
    }
    const rows = [];
    if (j.type === 'pin' || j.type === 'fixed') rows.push(['<i class="mi">F</i><sub>x</sub>', `${j.id}|fx`, 'N'], ['<i class="mi">F</i><sub>y</sub>', `${j.id}|fy`, 'N'], ['|<i class="mi">F</i>|', `${j.id}|f`, 'N']);
    if (j.type === 'fixed') rows.push(['<i class="mi">M</i>', `${j.id}|m`, 'N·m']);
    if (j.type === 'roller' || j.type === 'slider' || j.type === 'rolling') rows.push(['Normal force <i class="mi">N</i>', `${j.id}|n`, 'N']);
    if (j.type === 'slider') rows.push(['Moment <i class="mi">M</i>', `${j.id}|m`, 'N·m']);
    if (j.type === 'rolling') rows.push(['Friction force', `${j.id}|h`, 'N']);
    if (j.type === 'rod') rows.push(['Rod force', `${j.id}|f`, 'N']);
    if (j.drive === 'speed') rows.push([j.type === 'pin' ? 'Drive torque' : 'Drive force', `${j.id}|drv`, j.type === 'pin' ? 'N·m' : 'N']);
    if (rows.length) root.append(liveBox(rows));
  }

  /* ---------- spring–damper network editor ---------- */
  function netEditor(root, f) {
    const app = MB.app, Nt = MB.Net, L = Nt.labels(f.net), fmt = (v) => F.fmtNum(+(+v).toPrecision(5));
    const ps = h('select', { class: 'select sm', 'aria-label': 'Load a classic model' }, h('option', { value: '' }, 'Load a classic model…'), ...Nt.presets.map((p) => h('option', { value: p.id }, p.name)));
    ps.addEventListener('change', () => { const p = Nt.presets.find((q) => q.id === ps.value); if (p) app.edit(() => (f.net = p.net()), { live: true }); });
    const group = (node, parent, idx) => {
      const head = h('div', { class: 'netgrp-h' },
        F.seg({ small: true, label: 'Group type', options: [['s', 'Series —'], ['p', 'Parallel ∥']], get: () => node.t, set: (v) => (node.t = v), live: true }),
        h('span', { class: 'netgrp-add' },
          F.btn('+k', () => app.edit(() => node.items.push({ t: 'k', v: 100 }), { live: true }), 'ghost sm'),
          F.btn('+d', () => app.edit(() => node.items.push({ t: 'c', v: 10 }), { live: true }), 'ghost sm'),
          F.btn(node.t === 's' ? '+∥' : '+—', () => app.edit(() => node.items.push({ t: node.t === 's' ? 'p' : 's', items: [{ t: 'k', v: 100 }, { t: 'c', v: 10 }] }), { live: true }), 'ghost sm'),
          parent ? F.btn('×', () => app.edit(() => parent.items.splice(idx, 1), { live: true }), 'ghost sm') : null));
      const list = h('div', { class: 'netgrp-l' });
      node.items.forEach((ch, i) => {
        if (ch.t === 'k' || ch.t === 'c') {
          const [lab, inp] = F.num({ label: `<i class="mi">${L.get(ch)[0]}</i><sub>${L.get(ch).slice(1)}</sub>`, unit: ch.t === 'k' ? 'N/m' : 'N·s/m', min: 0, live: true, get: () => ch.v, set: (v) => (ch.v = v) });
          list.append(h('div', { class: 'netleaf' }, F.icon(ch.t === 'k' ? 'i-spring' : 'i-damper', 'sm'), lab, inp, F.btn('×', () => app.edit(() => node.items.splice(i, 1), { live: true }), 'ghost sm')));
        } else list.append(group(ch, node, i));
      });
      if (!node.items.length) list.append(h('p', { class: 'note' }, 'Empty group: add a spring (+k), a damper (+d) or a sub-group.'));
      return h('div', { class: 'netgrp ' + (node.t === 's' ? 'ser' : 'par') }, head, list);
    };
    root.append(F.section('Network', ps, h('p', { class: 'note' }, `${Nt.text(f.net, L, true)}   (— series, ∥ parallel)`), group(f.net, null, 0),
      F.fields(F.num({ label: 'Free length <i class="mi">L</i><sub>0</sub>', unit: 'm', id: 'f-L0', min: 0, live: true, get: () => f.L0, set: (v) => (f.L0 = v), step: 0.002 })),
      h('div', { class: 'row', style: 'margin-top:8px' }, F.btn('Set L₀ to current length', () => app.edit(() => { const a = MB.toWorld(app.model, f.a), b = MB.toWorld(app.model, f.b); f.L0 = Math.hypot(b[0] - a[0], b[1] - a[1]); })))));
    // what the network does: its generalized Maxwell equivalent
    const g = Nt.gm(f.net), dt = app.model.settings.dt, kg = Nt.glassy(g), lines = [];
    if (!Nt.hasDamper(f.net)) {
      const form = (n) => n.t === 'k' ? fmt(n.v) : n.t === 'p' ? `(${n.items.map(form).join(' + ')})` : `1/(${n.items.map((c) => '1/' + form(c)).join(' + ')})`;
      lines.push(`Springs only: <i class="mi">k</i> = ${form(f.net)} = <b>${fmt(g.k0)} N/m</b> (parallel: stiffnesses add; series: compliances 1/k add).`);
    } else {
      lines.push(`Dynamic stiffness <i class="mi">F</i>(s) = Z(s)·Δ(s) with Z = ${[g.cinf > 0 ? `${fmt(g.cinf)}·s` : '', g.k0 > 0 ? fmt(g.k0) : ''].concat(g.arms.map((a) => `${fmt(a.k)}·${fmt(a.tau)}s/(1 + ${fmt(a.tau)}s)`)).filter(Boolean).join(' + ') || '0'}`);
      lines.push(`Static stiffness Z(0) = <b>${fmt(g.k0)} N/m</b>${g.k0 > 0 ? '' : ': none, so under a steady force it creeps without limit (a fluid-like element)'}.`);
      lines.push(g.cinf > 0 ? `A dashpot path c∞ = ${fmt(g.cinf)} N·s/m connects the ends directly, so a sudden stretch meets an infinite force at first.` : `Instantaneous (glassy) stiffness Z(∞) = k₀ + Σkᵢ = <b>${fmt(kg)} N/m</b>.`);
      if (g.arms.length) lines.push(`Relaxation after a stretch Δ held from t = 0: F(t) = Δ·[${fmt(g.k0)}${g.arms.map((a) => ` + ${fmt(a.k)}·e^(−t/${fmt(a.tau)} s)`).join('')}]. Equivalent arms (spring kᵢ — damper cᵢ = kᵢτᵢ): ${g.arms.map((a, i) => `k = ${fmt(a.k)}, c = ${fmt(a.k * a.tau)}, τ${i + 1} = ${fmt(a.tau)} s`).join('; ')}.`);
      const fast = g.arms.filter((a) => a.tau < 2 * dt);
      if (fast.length) lines.push(`${fast.length} relaxation time${fast.length > 1 ? 's are' : ' is'} shorter than two time steps (2·${dt} s); the simulation treats ${fast.length > 1 ? 'those arms' : 'that arm'} as plain dashpot${fast.length > 1 ? 's' : ''} c = kτ, exact for motions slower than 1/τ.`);
    }
    root.append(F.section('What it does', h('div', { class: 'note', html: lines.map((l) => `<p style="margin:0 0 6px">${l}</p>`).join('') }),
      h('p', { class: 'note' }, 'Every spring–damper network acts exactly like one spring k₀, one dashpot c∞ and Maxwell arms in parallel (generalized Maxwell model). The simulation integrates one internal stroke per arm in the same RK4 steps as the bodies.')));
  }

  function forceForm(root, f) {
    const app = MB.app;
    root.append(F.fields(F.text({ label: 'Name', id: 'f-name', get: () => f.name, set: (v) => (f.name = v) })));
    if (f.type === 'sd') {
      const Nt = MB.Net;
      root.append(F.section('Arrangement', F.seg({ small: true, options: [['simple', 'Spring ∥ damper'], ['net', 'Any network']], get: () => (f.net ? 'net' : 'simple'),
        set: (v) => {
          if (v === 'net') { const { K, C, P } = Nt.make, it = []; if (f.k > 0) it.push(K(+f.k)); if (f.c > 0) it.push(C(+f.c)); if (!it.length) it.push(K(100)); f.net = P(...it); }
          else { const g = Nt.gm(f.net); f.k = +(g.k0 > 0 ? g.k0 : Nt.glassy(g)).toPrecision(6); f.c = +(g.cinf + g.arms.reduce((a, b) => a + b.k * b.tau, 0)).toPrecision(6); delete f.net; }
        } }),
        h('p', { class: 'note' }, f.net ? 'Build any tree of springs and dampers: a series group shares one force and adds the stretches, a parallel group shares one stretch and adds the forces. Groups nest.' : 'One spring and one damper side by side (plus an optional cubic term). Switch to “Any network” for series, parallel and nested arrangements.')));
      if (f.net) netEditor(root, f);
      else {
        root.append(F.section('Parameters', F.fields(
          F.num({ label: 'Stiffness <i class="mi">k</i>', unit: 'N/m', id: 'f-k', min: 0, live: true, get: () => f.k, set: (v) => (f.k = v) }),
          F.num({ label: 'Damping <i class="mi">d</i>', unit: 'N·s/m', id: 'f-c', min: 0, live: true, get: () => f.c, set: (v) => (f.c = v) }),
          F.num({ label: 'Cubic <i class="mi">k</i><sub>3</sub>', unit: 'N/m³', id: 'f-k3', live: true, get: () => f.k3, set: (v) => (f.k3 = v), hint: 'Duffing term: F = kΔ + k₃Δ³' }),
          F.num({ label: 'Free length <i class="mi">L</i><sub>0</sub>', unit: 'm', id: 'f-L0', min: 0, live: true, get: () => f.L0, set: (v) => (f.L0 = v), step: 0.002 })),
          h('div', { class: 'row', style: 'margin-top:8px' }, F.btn('Set L₀ to current length', () => app.edit(() => { const a = MB.toWorld(app.model, f.a), b = MB.toWorld(app.model, f.b); f.L0 = Math.hypot(b[0] - a[0], b[1] - a[1]); }))),
          h('p', { class: 'note' }, 'Force along the line of action: F = kΔ + k₃Δ³ + d·Δ̇ with Δ = L − L₀ (tension positive).')));
        const ba = MB.bodyById(app.model, f.a.body), bb = MB.bodyById(app.model, f.b.body);
        const me = ba && bb ? (ba.m * bb.m) / (ba.m + bb.m) : (ba || bb) ? (ba || bb).m : 0;
        if (me > 0 && f.k > 0) {
          const z = f.c / (2 * Math.sqrt(f.k * me)), w = Math.sqrt(f.k / me);
          root.append(h('p', { class: 'note', html: `With the attached mass <i class="mi">m</i> = ${F.fmtNum(+me.toPrecision(4))} kg: ω₀ = √(k/m) = ${F.fmtNum(+w.toPrecision(4))} rad/s (${F.fmtNum(+(w / 2 / Math.PI).toPrecision(4))} Hz), damping ratio ζ = d / (2√(k·m)) = <b>${z.toFixed(3)}</b>${z === 0 ? ' — undamped, it will oscillate forever' : z < 1 ? ' — underdamped' : ' — overdamped'}. Critical damping d = ${F.fmtNum(+(2 * Math.sqrt(f.k * me)).toPrecision(4))} N·s/m. Estimate for this spring alone.` }),
            h('div', { class: 'row', style: 'margin-top:6px' }, ...[0.05, 0.2, 0.7, 1].map((zz) => F.btn(`ζ = ${zz}`, () => app.edit(() => (f.c = +(2 * zz * Math.sqrt(f.k * me)).toPrecision(3)), { live: true }), 'ghost'))));
        }
      }
      root.append(F.section('Attachment', h('p', { class: 'note', html: `From <b>${bname(f.a.body)}</b> to <b>${bname(f.b.body)}</b>. Drag the square handles on the drawing to move an end; dropping it on another part, a fixed point or a surface re-attaches it.` })));
      root.append(liveBox([['Length <i class="mi">L</i>', `${f.id}|L`, 'm'], ['Force <i class="mi">F</i>', `${f.id}|F`, 'N']]));
    } else if (f.type === 'torsion') {
      root.append(F.section('Parameters', F.fields(
        F.num({ label: 'Stiffness <i class="mi">k</i><sub>t</sub>', unit: 'N·m/rad', id: 'f-kt', min: 0, live: true, get: () => f.kt, set: (v) => (f.kt = v) }),
        F.num({ label: 'Damping <i class="mi">d</i><sub>t</sub>', unit: 'N·m·s', id: 'f-ct', min: 0, live: true, get: () => f.ct, set: (v) => (f.ct = v) }),
        F.num({ label: 'Unloaded angle', unit: '°', id: 'f-phi0', live: true, get: () => f.phi0, set: (v) => (f.phi0 = v) }))));
      root.append(liveBox([['Moment', `${f.id}|F`, 'N·m']]));
    } else if (f.type === 'load') {
      root.append(F.section('Magnitude', F.fields(
        F.num({ label: 'Constant <i class="mi">F</i><sub>0</sub>', unit: 'N', id: 'f-F0', live: true, get: () => f.F0, set: (v) => (f.F0 = v) }),
        F.num({ label: 'Amplitude <i class="mi">F̂</i>', unit: 'N', id: 'f-F1', live: true, get: () => f.F1, set: (v) => (f.F1 = v) }),
        F.num({ label: 'Frequency <i class="mi">f</i>', unit: 'Hz', id: 'f-ff', min: 0, live: true, get: () => f.f, set: (v) => (f.f = v), step: 0.01 }),
        F.num({ label: 'Phase', unit: '°', id: 'f-ph', live: true, get: () => f.ph, set: (v) => (f.ph = v) })),
        h('p', { class: 'note' }, `F(t) = F₀ + F̂·sin(2πft + phase). Ω = ${F.fmtNum(2 * Math.PI * f.f)} rad/s.`)));
      root.append(F.section('Direction', F.fields(F.num({ label: 'Angle', unit: '°', id: 'f-ang', live: true, get: () => f.angle, set: (v) => (f.angle = v), step: 1 })),
        h('div', { class: 'row', style: 'margin-top:8px' }, F.toggle({ label: 'Turns with the part (follower load)', get: () => f.follower, set: (v) => (f.follower = v), live: true }))));
      root.append(F.section('Point of application', F.fields(
        F.num({ label: 'Local <i class="mi">x</i>', unit: 'm', id: 'f-px', get: () => f.b.p[0], set: (v) => (f.b.p = [v, f.b.p[1]]), step: 0.005 }),
        F.num({ label: 'Local <i class="mi">y</i>', unit: 'm', id: 'f-py', get: () => f.b.p[1], set: (v) => (f.b.p = [f.b.p[0], v]), step: 0.005 }))));
      root.append(liveBox([['<i class="mi">F</i>(<i class="mi">t</i>)', `${f.id}|F`, 'N']]));
    } else if (f.type === 'torque') {
      root.append(F.section('Magnitude', F.fields(
        F.num({ label: 'Constant <i class="mi">M</i><sub>0</sub>', unit: 'N·m', id: 'f-M0', live: true, get: () => f.M0, set: (v) => (f.M0 = v) }),
        F.num({ label: 'Amplitude <i class="mi">M̂</i>', unit: 'N·m', id: 'f-M1', live: true, get: () => f.M1, set: (v) => (f.M1 = v) }),
        F.num({ label: 'Frequency <i class="mi">f</i>', unit: 'Hz', id: 'f-ff', min: 0, live: true, get: () => f.f, set: (v) => (f.f = v) })),
        h('p', { class: 'note' }, 'Counter-clockwise positive.')));
      root.append(liveBox([['<i class="mi">M</i>(<i class="mi">t</i>)', `${f.id}|F`, 'N·m']]));
    }
  }

  function ropeForm(root, r) {
    const app = MB.app, N = r.nodes.length;
    root.append(F.fields(F.text({ label: 'Name', id: 'f-name', get: () => r.name, set: (v) => (r.name = v) })));
    root.append(F.section('Rope', h('div', { class: 'row' }, F.toggle({ label: 'Can go slack (tension ≥ 0)', get: () => r.slack, set: (v) => (r.slack = v) })),
      F.fields(F.num({ label: 'Initial slack', unit: 'm', id: 'f-slack0', min: 0, get: () => r.slack0 || 0, set: (v) => (r.slack0 = v), step: 0.002 })),
      h('p', { class: 'note' }, 'Inextensible. At t = 0 the rope is laid taut along its route plus the initial slack. Tension is equal on both sides of a frictionless pulley; a no-slip pulley carries the difference.')));
    const list = h('div', { class: 'nodes' });
    r.nodes.forEach((nd, k) => {
      const end = k === 0 || k === N - 1, drum = end && nd.r > 0, wrap = nd.r > 0;
      const title = k === 0 ? 'Start' : k === N - 1 ? 'End' : 'Pulley';
      const tag = `${drum ? 'drum on ' : end ? 'fixed to ' : 'on '}${bname(nd.body)}`;
      const head = h('div', { class: 'node-head' }, h('span', {}, `${title} `, h('span', { class: 'tag', html: tag })));
      if (!end && N > 2) head.append(h('button', { class: 'icon-btn sm', title: 'Remove this pulley', onclick: () => app.edit(() => r.nodes.splice(k, 1)) }, F.icon('i-trash', 'sm')));
      const box = h('div', { class: 'node' }, head);
      if (wrap || !end) {
        box.append(F.fields(F.num({ label: 'Radius <i class="mi">r</i>', unit: 'm', id: `f-nr${k}`, min: end ? 0 : 1e-3, get: () => nd.r, set: (v) => (nd.r = v), step: 0.002 })));
        box.append(h('div', { class: 'row', style: 'margin-top:8px' },
          F.seg({ small: true, label: 'Wrap direction', options: [[1, '↺ ccw'], [-1, '↻ cw']], get: () => (nd.dir >= 0 ? 1 : -1), set: (v) => (nd.dir = v) }),
          end ? h('span', { class: 'note', style: 'margin:0' }, 'wound on, no slip') : F.seg({ small: true, label: 'Contact', options: [[false, 'Frictionless'], [true, 'No slip']], get: () => !!nd.stick, set: (v) => (nd.stick = v) })));
        if (drum) {
          box.append(F.fields(
            F.num({ label: 'Rope wound on', unit: 'm', id: `f-nw${k}`, min: 0, get: () => +nd.wound || 0, set: (v) => (nd.wound = v), step: 0.05 }),
            F.num({ label: 'Bounce <i class="mi">e</i> at the end', id: `f-ne${k}`, min: 0, max: 1, get: () => (nd.bounce == null ? 0.85 : nd.bounce), set: (v) => (nd.bounce = v), step: 0.05 })));
          box.append(h('p', { class: 'note' }, '0 = endless. With a finite length the drum turns past the end of the rope like a yo-yo: the rope rewinds from the other side and the drum climbs back, losing a factor e of its speed each time; when the turn-around gets very slow it hangs and spins (“sleeps”).'));
        }
      } else if (end && MB.bodyById(app.model, nd.body) && MB.bodyById(app.model, nd.body).shape === 'disk') {
        box.append(h('div', { class: 'row', style: 'margin-top:6px' }, F.btn('Wind the end onto this disk', () => app.edit(() => { const b = MB.bodyById(app.model, nd.body); nd.p = [0, 0]; nd.r = b.r; nd.dir = 1; }), 'ghost')));
      }
      list.append(box);
    });
    root.append(F.section('Route', list));
    const mk = h('div', { class: 'nodes' });
    (r.markers || []).forEach((m, k) => {
      mk.append(h('div', { class: 'node' }, h('div', { class: 'node-head' }, h('span', { html: `Point ${MB.nameHTML(m.name)}` }), h('button', { class: 'icon-btn sm', title: 'Remove marker', onclick: () => app.edit(() => r.markers.splice(k, 1)) }, F.icon('i-trash', 'sm'))),
        F.fields(F.text({ label: 'Name', get: () => m.name, set: (v) => (m.name = v) }), F.num({ label: 'Arc length from start', unit: 'm', id: `f-mk${k}`, min: 0, get: () => m.s, set: (v) => (m.s = v), step: 0.005 }))));
    });
    root.append(F.section('Material points', mk, h('div', { class: 'row', style: 'margin-top:8px' }, F.btn('Add point', () => app.edit(() => { r.markers = r.markers || []; r.markers.push({ name: 'P_' + (r.markers.length + 1), s: 0.5 }); }), '', 'i-plus')),
      h('p', { class: 'note' }, 'Points fixed to the rope material; they travel over the pulleys and can be plotted.')));
    const sim = app.sim, c = sim.byEl.get(r.id);
    if (c) root.append(liveBox(c.subs.map((s, i) => [`Tension${c.subs.length > 1 ? ' span ' + (i + 1) : ''}`, `${r.id}|S${i}`, 'N'])));
  }

  function stopForm(root, s) {
    const app = MB.app;
    root.append(F.fields(F.text({ label: 'Name', id: 'f-name', get: () => s.name, set: (v) => (s.name = v) })));
    root.append(h('p', { class: 'note', html: `Keeps the point on <b>${bname(s.b.body)}</b> on the positive side of the point on <b>${bname(s.a.body)}</b>, measured along the normal: <i class="mi">n</i>·(<i class="mi">r</i><sub>B</sub> − <i class="mi">r</i><sub>A</sub>) ≥ gap. Closing contacts are resolved as Newton impacts.` }));
    root.append(F.section('Contact', F.fields(
      F.num({ label: 'Normal angle', unit: '°', id: 'f-ang', get: () => s.angle, set: (v) => (s.angle = v), step: 1 }),
      F.num({ label: 'Minimum gap', unit: 'm', id: 'f-gap', get: () => s.gap, set: (v) => (s.gap = v), step: 0.002 }),
      F.num({ label: 'Restitution <i class="mi">e</i>', unit: '–', id: 'f-e', min: 0, max: 1, live: true, get: () => s.e, set: (v) => (s.e = v), step: 0.01 })),
      s.a.body ? h('div', { class: 'row', style: 'margin-top:8px' }, F.toggle({ label: `Normal turns with ${bname(s.a.body)}`, get: () => !!s.local, set: (v) => (s.local = v) })) : null,
      h('div', { class: 'row', style: 'margin-top:8px' }, F.btn('Flip normal', () => app.edit(() => { const a = s.a; s.a = s.b; s.b = a; }), '', 'i-flip'))));
    root.append(liveBox([['Contact force', `${s.id}|n`, 'N']]));
  }

  function surfaceForm(root, s) {
    const app = MB.app, owner = MB.bodyById(app.model, s.body);
    root.append(F.fields(F.text({ label: 'Name', id: 'f-name', get: () => s.name, set: (v) => (s.name = v) })));
    root.append(h('p', { class: 'note', html: owner ? `Carried by <b>${MB.nameHTML(owner.name)}</b>: it moves and turns with that part. Guide or drive the part to move the surface.` : 'Fixed to the ground.' }));
    root.append(F.section('Contact', F.fields(
      F.num({ label: 'Friction <i class="mi">μ</i>', unit: '–', id: 'f-mu', min: 0, live: true, get: () => s.mu, set: (v) => (s.mu = v), step: 0.01 }),
      F.num({ label: 'Restitution <i class="mi">e</i>', unit: '–', id: 'f-e', min: 0, max: 1, live: true, get: () => s.e, set: (v) => (s.e = v), step: 0.01 }),
      F.num({ label: 'Belt speed', unit: 'm/s', id: 'f-belt', live: true, get: () => s.belt, set: (v) => (s.belt = v), step: 0.05, hint: 'Speed of the surface material along its drawing direction, like a conveyor or treadmill' })),
      h('p', { class: 'note' }, 'Disks touch with their rim, blocks with their corners. Contacts stick while the friction needed stays below μ·N and slide otherwise; closing contacts are Newton impacts with restitution e. Belt speed moves the surface material without moving its shape.')));
    const list = h('div', { class: 'nodes' });
    (s.features || []).forEach((f, k) => {
      const head = h('div', { class: 'node-head' }, h('span', {}, f.type === 'bump' ? 'Bump' : 'Waves'), h('button', { class: 'icon-btn sm', title: 'Remove', onclick: () => app.edit(() => s.features.splice(k, 1)) }, F.icon('i-trash', 'sm')));
      const box = h('div', { class: 'node' }, head);
      if (f.type === 'bump') box.append(F.fields(
        F.num({ label: 'Centre at <i class="mi">s</i>', unit: 'm', id: `f-fa${k}`, get: () => f.at, set: (v) => (f.at = v), step: 0.05 }),
        F.num({ label: 'Length <i class="mi">L</i>', unit: 'm', id: `f-fl${k}`, min: 0.01, get: () => f.L, set: (v) => (f.L = v), step: 0.05 }),
        F.num({ label: 'Height <i class="mi">h</i>', unit: 'm', id: `f-fh${k}`, get: () => f.h, set: (v) => (f.h = v), step: 0.005, hint: 'Negative for a pothole' })));
      else box.append(F.fields(
        F.num({ label: 'From <i class="mi">s</i>', unit: 'm', id: `f-ff${k}`, get: () => f.from, set: (v) => (f.from = v), step: 0.1 }),
        F.num({ label: 'To <i class="mi">s</i>', unit: 'm', id: `f-ft${k}`, get: () => f.to, set: (v) => (f.to = v), step: 0.1 }),
        F.num({ label: 'Amplitude <i class="mi">A</i>', unit: 'm', id: `f-fA${k}`, get: () => f.A, set: (v) => (f.A = v), step: 0.002 }),
        F.num({ label: 'Wavelength <i class="mi">λ</i>', unit: 'm', id: `f-fL${k}`, min: 0.01, get: () => f.L, set: (v) => (f.L = v), step: 0.05 })));
      list.append(box);
    });
    let len = 0;
    for (let k = 0; k < s.pts.length - 1; k++) len += Math.hypot(s.pts[k + 1][0] - s.pts[k][0], s.pts[k + 1][1] - s.pts[k][1]);
    root.append(F.section('Profile', list,
      h('div', { class: 'row', style: 'margin-top:8px' },
        F.btn('Add bump', () => app.edit(() => { s.features = s.features || []; s.features.push({ type: 'bump', at: +(len / 2).toFixed(2), L: 1, h: 0.05 }); }), '', 'i-plus'),
        F.btn('Add waves', () => app.edit(() => { s.features = s.features || []; s.features.push({ type: 'waves', from: +(len * 0.25).toFixed(2), to: +(len * 0.75).toFixed(2), A: 0.02, L: 1 }); }), '', 'i-plus')),
      h('p', { class: 'note' }, `Positions s are measured along the surface from its first point (length ${F.fmtNum(+len.toFixed(3))} m). Bumps rise toward the open side; a wheel crossing a bump of length L at speed v is excited at f = v/L.`)));
    root.append(F.section('Drawing', h('div', { class: 'row' }, F.btn('Flip hatched side', () => app.edit(() => (s.side = s.side >= 0 ? -1 : 1)), '', 'i-flip'),
      F.btn('Reverse direction', () => app.edit(() => { s.pts.reverse(); s.side = -(s.side >= 0 ? 1 : -1); s.belt = -(+s.belt || 0); }), '', 'i-flip')),
      h('p', { class: 'note' }, 'Drag the square handles to move the corner points.')));
    const sim = app.sim, rows = [];
    for (const c of sim.cons) if (c.kind === 'contact' && c.el === s) rows.push([`Normal force on ${MB.nameHTML(sim.model.bodies[c.ib].name)}`, `${s.id}:${sim.model.bodies[c.ib].id}|N`, 'N'], [`Friction on ${MB.nameHTML(sim.model.bodies[c.ib].name)}`, `${s.id}:${sim.model.bodies[c.ib].id}|T`, 'N']);
    if (rows.length) root.append(liveBox(rows));
  }

  function anchorForm(root, a) {
    const app = MB.app, n = MB.anchorRefs(app.model).filter((r) => r.anchor === a.id).length;
    root.append(F.fields(F.text({ label: 'Name', id: 'f-name', get: () => a.name, set: (v) => (a.name = v) })));
    root.append(h('p', { class: 'note' }, `A point fixed to the ground. ${n ? n + ' element end' + (n > 1 ? 's are' : ' is') + ' attached; they move with it when you move it.' : 'Pick Spring, Damper, Rope or Joint → Rod and tap this point to hang something from it.'}`));
    root.append(F.section('Location', F.fields(
      F.num({ label: '<i class="mi">x</i>', unit: 'm', id: 'f-ax', get: () => a.p[0], set: (v) => (a.p = [v, a.p[1]]), step: 0.005 }),
      F.num({ label: '<i class="mi">y</i>', unit: 'm', id: 'f-ay', get: () => a.p[1], set: (v) => (a.p = [a.p[0], v]), step: 0.005 }))));
    root.append(F.section('Symbol', h('div', { class: 'row' }, F.seg({ small: true, wrap: true, label: 'Ground side', live: true, options: [['auto', 'Auto'], ['above', 'Above'], ['below', 'Below'], ['left', 'Left'], ['right', 'Right']], get: () => a.mount || 'auto', set: (v) => (a.mount = v) }))));
  }

  /* ---------------- system tab ---------------- */
  P.renderSystem = function () {
    const app = MB.app, m = app.model, st = m.settings, root = $('#tab-system'), sc = root.scrollTop, fid = document.activeElement && root.contains(document.activeElement) ? document.activeElement.id : '';
    root.innerHTML = '';
    root.append(F.fields(F.text({ label: 'System name', id: 's-name', get: () => m.name, set: (v) => (m.name = v) })));
    const notes = h('textarea', { class: 'field', id: 's-notes', rows: 3, placeholder: 'Notes, assumptions, expected results…', style: 'font-family:var(--f-ui);font-size:14px;margin-top:8px;min-height:64px' });
    notes.value = m.notes || '';
    notes.addEventListener('change', () => app.edit(() => (m.notes = notes.value), { live: true }));
    root.append(notes);
    root.append(F.section('Simulation', F.fields(
      F.num({ label: 'Gravity <i class="mi">g</i>', unit: 'm/s²', id: 's-g', min: 0, live: true, get: () => st.g, set: (v) => (st.g = v) }),
      F.num({ label: 'Gravity direction', unit: '°', id: 's-ga', live: true, get: () => st.gAngle, set: (v) => (st.gAngle = v), hint: '−90° points down' }),
      F.num({ label: 'Time step Δ<i class="mi">t</i>', unit: 's', id: 's-dt', min: 1e-5, max: 0.02, get: () => st.dt, set: (v) => (st.dt = v), step: 0.0001 }),
      F.num({ label: 'Plot sampling', unit: 's', id: 's-sdt', min: 1e-4, max: 0.1, get: () => st.sampleDt, set: (v) => (st.sampleDt = v), step: 0.001 }),
      F.num({ label: 'Air drag β', unit: '1/s', id: 's-drag', min: 0, live: true, get: () => st.drag || 0, set: (v) => (st.drag = v), step: 0.01, hint: 'Viscous drag on every part: F = −β·m·v, M = −β·J·ω' })),
      h('p', { class: 'note' }, 'Air drag damps every part in proportion to its mass (mass-proportional Rayleigh damping, ζ = β/(2ω) per mode). 0 keeps the system conservative.'),
      h('p', { class: 'note' }, 'Fixed-step 4th-order Runge–Kutta on the index-1 DAE M q̈ = Q + Jᵀλ, with position and velocity projection onto the constraints after every step. Halve Δt if stiff springs make the run diverge.')));
    root.append(F.section('Display', h('div', { style: 'display:grid;gap:8px' },
      F.toggle({ label: 'Grid', get: () => st.grid, set: (v) => (st.grid = v), live: true }),
      F.toggle({ label: 'Snap to grid and part key points', get: () => st.snap, set: (v) => (st.snap = v), live: true }),
      F.toggle({ label: 'Names', get: () => st.labels, set: (v) => (st.labels = v), live: true }),
      F.toggle({ label: 'Frames (inertial and body axes)', get: () => st.frames, set: (v) => (st.frames = v), live: true }),
      F.toggle({ label: 'Reaction forces and rope tensions', get: () => st.forces, set: (v) => (st.forces = v), live: true }),
      F.toggle({ label: 'Trails of the centres of mass', get: () => st.trails, set: (v) => (st.trails = v), live: true }))));
    root.append(F.section('Mechanics overlays', h('div', { style: 'display:grid;gap:8px' },
      F.toggle({ label: 'Free-body diagram of the selected part: every force with its value, constraint forces from λ, and m·a', get: () => st.ovFBD, set: (v) => (st.ovFBD = v), live: true }),
      F.toggle({ label: 'Kinematics of the selected part: v, a = a_t + a_n, osculating circle ρ = v²/a_n, its path', get: () => st.ovKin, set: (v) => (st.ovKin = v), live: true }),
      F.toggle({ label: 'Momentum and impulse: p, L, external force, Δp = ∫F dt', get: () => st.ovMom, set: (v) => (st.ovMom = v), live: true }),
      h('label', { class: 'flabel' }, 'Observer frame (pseudo-forces on the selected part)'),
      h('div', { class: 'row' }, F.seg({ small: true, wrap: true, label: 'Observer', live: true, options: [['', 'Inertial'], ...m.bodies.map((b) => [b.id, `rotating with ${MB.plainName(b.name)}`])], get: () => st.ovObs || '', set: (v) => (st.ovObs = v) })),
      h('p', { class: 'note' }, 'Tap a part to select it. In a frame turning with another part, the selected part feels the centrifugal force mΩ²r, the Coriolis force −2mΩ×v_rel and the Euler force −mΩ̇×r; its path as seen by that observer is drawn dotted.'))));
    const groups = [['Parts', m.bodies], ['Supports & joints', m.joints], ['Fixed points', m.anchors || []], ['Springs, dampers & loads', m.forces], ['Ropes', m.ropes], ['Surfaces', m.surfaces || []], ['Stops', m.stops]];
    const list = h('div', { class: 'list' });
    let any = false;
    for (const [title, arr] of groups) {
      if (!arr.length) continue;
      any = true;
      const g = h('div', { class: 'list-group' }, h('div', { class: 'eyebrow' }, `${title} · ${arr.length}`));
      for (const el of arr) g.append(h('button', { class: 'list-item' + (app.sel === el.id ? ' on' : ''), onclick: () => { app.select(el.id); app.showTab('inspect'); } }, F.icon(icoFor(el)), h('span', { class: 'nm', html: el.name ? MB.nameHTML(el.name) : MB.typeName(el) }), h('span', { class: 'ty' }, MB.typeName(el))));
      list.append(g);
    }
    root.append(F.section('Elements', any ? list : h('div', { class: 'empty' }, 'No elements yet. Pick ', h('b', {}, 'Block'), ' or ', h('b', {}, 'Disk'), ' in the toolbar and tap the drawing.')));
    const ta = h('textarea', { class: 'field', id: 's-json', placeholder: 'Paste a system exported from this lab, then press Load.', rows: 4 });
    root.append(F.section('Save & share',
      h('div', { class: 'row' }, F.btn('Presets…', () => app.openPresets(), '', 'i-grid'), F.btn('Copy as JSON', () => app.copyText(JSON.stringify(app.model), ta), '', 'i-copy')),
      h('p', { class: 'note' }, 'Your system is kept in this browser and restored when you come back. Copy the JSON to keep a file of it.'),
      ta, h('div', { class: 'row end', style: 'margin-top:6px' }, F.btn('Load JSON', () => app.loadJSON(ta.value), 'primary'))));
    root.scrollTop = sc;
    if (fid) { const e = document.getElementById(fid); if (e) e.focus({ preventScroll: true }); }
  };

  /* ---------------- analysis tab ---------------- */
  P.analysis = { modal: null, eq: null };
  P.renderAnalysis = function () {
    const app = MB.app, root = $('#tab-analysis'), sc = root.scrollTop, A = P.analysis;
    root.innerHTML = '';
    let d;
    try { d = MB.dof(app.model); } catch (e) { d = null; }
    if (d) {
      root.append(h('div', { class: 'eyebrow' }, 'Degrees of freedom'));
      root.append(h('div', { class: 'dof' }, h('span', { class: 'big' }, `f = ${d.f}`), h('span', { class: 'eq' }, `f = n − r = ${d.n} − ${d.rank} = ${d.f}`)));
      root.append(h('p', { class: 'note' }, `${d.nb} part${d.nb === 1 ? '' : 's'} × 3 coordinates (x, y, φ) = ${d.n}; ${d.rank} independent constraint equation${d.rank === 1 ? '' : 's'} at t = 0 (taut ropes and closed contacts included).`));
      if (d.redundant > 0) root.append(h('p', { class: 'note' }, h('span', { class: 'pill warn' }, `${d.redundant} redundant`), ' Some constraints repeat others (statically indeterminate). Motion is still computed; the split of the reaction forces among them is not unique.'));
      if (d.f === 0 && d.nb) root.append(h('p', { class: 'note' }, h('span', { class: 'pill' }, 'kinematically determined'), ' Every part is fully held, or moved by a drive.'));
      d.warnings.forEach((w) => root.append(h('p', { class: 'note' }, h('span', { class: 'pill bad' }, 'check'), ' ', w)));
    }
    root.append(F.section('Static equilibrium',
      h('p', { class: 'note' }, 'Settles the system by dynamic relaxation (time frozen at t = 0, kinetic energy removed at every peak) and stores the result as the new initial state.'),
      h('div', { class: 'row', style: 'margin-top:8px' }, F.btn('Find equilibrium', () => app.runEquilibrium(), 'primary')),
      A.eq ? h('p', { class: 'note' }, h('span', { class: 'pill ' + (A.eq.ok ? 'ok' : 'warn') }, A.eq.ok ? 'settled' : 'not settled'), ` ${A.eq.msg || ''} Residual acceleration ${MB.fmt(A.eq.residual)} (m/s² or rad/s²), ${A.eq.steps} relaxation steps.`) : null));
    const ms = F.section('Natural frequencies',
      h('p', { class: 'note' }, 'Linearised about the initial configuration: K and D are built in the tangent space of the constraints (geometric stiffness of rope tension included), then MΦ eigenproblem. Find the equilibrium first for physically meaningful results.'),
      h('div', { class: 'row', style: 'margin-top:8px' }, F.btn('Compute modes', () => app.runModal(), 'primary'), app.modeAnim ? F.btn('Stop animation', () => app.stopMode(), '') : null));
    if (A.modal) {
      if (!A.modal.ok) ms.append(h('p', { class: 'note' }, h('span', { class: 'pill warn' }, 'not available'), ' ', A.modal.msg));
      else {
        if (A.modal.residual > 1e-3) ms.append(h('p', { class: 'note' }, h('span', { class: 'pill warn' }, 'not in equilibrium'), ` Residual acceleration ${MB.fmt(A.modal.residual)}. Results describe small motions about a moving state.`));
        const tb = h('table', { class: 'modes' }, h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'f [Hz]'), h('th', {}, 'ω [rad/s]'), h('th', {}, 'T [s]'), h('th', {}, 'ζ'), h('th', {}, ''))));
        const tbody = h('tbody');
        A.modal.modes.forEach((md, k) => {
          const on = app.modeAnim && app.modeAnim.idx === k;
          const lab = md.kind === 'osc' ? null : md.kind === 'rigid' ? 'free' : 'unstable';
          tbody.append(h('tr', { class: on ? 'on' : '' },
            h('td', {}, String(k + 1)),
            h('td', {}, lab ? h('span', { class: 'pill ' + (lab === 'free' ? '' : 'bad') }, lab) : md.fHz.toFixed(4)),
            h('td', {}, md.kind === 'unstable' ? `${MB.fmt(Math.sqrt(-md.w2))}i` : md.w.toFixed(3)),
            h('td', {}, md.kind === 'osc' ? md.T.toFixed(4) : '—'),
            h('td', {}, md.kind === 'osc' ? md.zeta.toFixed(4) : '—'),
            h('td', {}, h('button', { class: 'btn ghost', style: 'padding:3px 8px', onclick: () => (on ? app.stopMode() : app.animateMode(k)) }, on ? 'Stop' : 'Show'))));
        });
        tb.append(tbody);
        ms.append(h('div', { class: 'table-wrap' }, tb), h('p', { class: 'note' }, 'ζ is the modal damping ratio φᵀDφ/(2ω), exact for proportional damping. Shapes are animated slowed down to stay readable.'));
      }
    }
    root.append(ms);
    root.append(F.section('Energy balance', F.kv([['Kinetic <i class="mi">T</i>', 'E|T', 'J'], ['Potential <i class="mi">V</i>', 'E|V', 'J'], ['<i class="mi">T</i> + <i class="mi">V</i>', 'E|E', 'J'], ['Work of dampers, loads, drives', 'E|W', 'J'], ['Lost in impacts', 'E|I', 'J'], ['Balance error', 'E|D', 'J']]),
      h('p', { class: 'note' }, 'Balance error = (T + V) − (T + V)₀ − W_nc − W_impact. It measures the integration error and should stay near zero.')));
    root.scrollTop = sc;
    P.updateLive();
  };

  /* ---------------- live values ---------------- */
  P.updateLive = function () {
    const app = MB.app, snap = app.lastSnap;
    if (!snap || !app.catMap) return;
    document.querySelectorAll('[data-live]').forEach((el) => {
      const key = el.getAttribute('data-live'), unit = el.getAttribute('data-unit');
      let v;
      if (key === 'E|I') v = snap.Wimp;
      else { const ch = app.catMap.get(key); if (!ch) { el.textContent = '—'; return; } v = ch.fn(snap); }
      el.textContent = `${MB.fmt(v)} ${unit}`;
    });
  };
  void D2R;
})(typeof window !== 'undefined' ? window : globalThis);
