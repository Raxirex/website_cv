/* Dynamic Interactive Labs — application state, simulation loop, undo, persistence, plot bar, layout */
(function (G) {
  'use strict';
  const MB = G.MB, R = MB.R, F = MB.F, P = MB.P, C = MB.C, h = F.h;
  const $ = (s) => document.querySelector(s);
  const KEY = 'pdl.v1';
  const mqSmall = window.matchMedia('(max-width: 820px)');

  const app = (MB.app = {
    model: null, sim: null, view: new R.View(), tool: 'select', sel: null, hover: null, pending: null,
    running: false, history: [], nextSample: 0, acc: 0, lastSnap: null, cat: [], catMap: new Map(),
    undoS: [], redoS: [], dirty: true, plotDirty: true, modeAnim: null, rate: 1, lag: false, gridStep: 0.05,
  });

  const store = {
    get() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };
  let saveT = 0;
  app.save = () => { clearTimeout(saveT); saveT = setTimeout(() => store.set({ model: app.model, plots: app.plot ? app.plot.keys : [], speed: app.model.settings.speed, drawer: $('#drawer').classList.contains('collapsed') }), 300); };

  /* ---------- model / sim lifecycle ---------- */
  function normalise(m) {
    const base = MB.newModel(m.name);
    m.settings = Object.assign(base.settings, m.settings || {});
    for (const k of MB.collections) m[k] = Array.isArray(m[k]) ? m[k] : [];
    m.bodies = m.bodies.map((b) => MB.makeBody(b));
    m.joints = m.joints.map((j) => MB.makeJoint(j));
    m.forces = m.forces.map((f) => MB.makeForce(f));
    m.ropes = m.ropes.map((r) => MB.makeRope(Object.assign({}, r, { nodes: (r.nodes || []).map((n) => MB.makeNode(n)) })));
    m.stops = m.stops.map((s) => MB.makeStop(s));
    m.surfaces = m.surfaces.map((s) => MB.makeSurface(s));
    m.anchors = m.anchors.map((a) => MB.makeAnchor(a));
    MB.syncAnchors(m);
    return m;
  }

  app.buildSim = function () {
    try { app.sim = new MB.Sim(app.model); }
    catch (e) { console.error(e); app.toast('This configuration could not be assembled. Undo the last change.'); app.sim = new MB.Sim(MB.newModel('')); }
    app.cat = MB.channels(app.model, app.sim);
    app.catMap = new Map(app.cat.map((c) => [c.key, c]));
  };

  app.takeSample = function () {
    const s = app.sim.snapshot();
    const mk = R.markerPositions(app.sim);
    if (mk.length) { s.mk = new Float64Array(mk.length * 2); mk.forEach((p, i) => { s.mk[2 * i] = p[0]; s.mk[2 * i + 1] = p[1]; }); }
    app.lastSnap = s;
    app.history.push(s);
    if (app.history.length > 24000) app.history.splice(0, 4000);
    return s;
  };

  app.reset = function (opts) {
    const o = opts || {};
    app.running = false; app.acc = 0; app.lag = false; app.rate = 1; app.backup = null;
    if (app.modeAnim && !o.keepMode) app.modeAnim = null;
    app.buildSim();
    app.history = []; app.nextSample = 0;
    app.takeSample(); app.nextSample = app.model.settings.sampleDt;
    updatePlay();
    if (!o.quiet) { renderPanels(); renderPlotBar(); }
    app.invalidate(); app.invalidatePlot();
  };
  app.resetToEdit = () => { if (app.sim.t > 0 || app.running) app.reset(); };

  /* Rebuild without touching history or panels (used while dragging) */
  app.rebuildQuiet = function (sync) {
    MB.syncAnchors(app.model);
    app.buildSim();
    if (sync) app.syncPoses();
    app.history = []; app.lastSnap = null; app.nextSample = 0;
    app.invalidate();
  };
  app.syncPoses = function () {
    const q = app.sim.q;
    app.model.bodies.forEach((b, i) => {
      if (3 * i + 2 >= q.length) return;
      b.x = +q[3 * i].toFixed(10); b.y = +q[3 * i + 1].toFixed(10); b.th = +((q[3 * i + 2] * 180) / Math.PI).toFixed(8);
    });
  };

  app.edit = function (fn, opts) {
    const before = JSON.stringify(app.model);
    fn();
    app.commit(before, opts || {});
  };
  app.commit = function (before, opts) {
    const o = opts || {};
    MB.syncAnchors(app.model);
    if (JSON.stringify(app.model) === before) { if (!o.keepPanel) renderPanels(); return; }
    app.undoS.push(before); if (app.undoS.length > 120) app.undoS.shift();
    app.redoS = [];
    afterChange(o);
  };
  function afterChange(o) {
    app.save();
    if (o.live && app.sim.t > 0) {
      app.sim.updateMass();
      if (app.sim.refreshNets) app.sim.refreshNets(app.model.settings.dt);
      app.sim.cons.forEach((c) => { if (c.kind === 'stop') app.sim.rest[c.row] = c.el.e; });
      const e = app.sim.energy(); app.sim.E0 = e.T + e.V - app.sim.Wnc - app.sim.Wimp;
    } else if (o.live && !app.running && app.sim.t === 0) app.reset({ quiet: true });
    else if (!o.live) app.reset({ quiet: true });
    if (app.plot && !app.plot.keys.length && app.model.bodies.length) app.plot.keys = defaultPlots();
    if (o.keepPanel) { renderPlotBar(); updateUndo(); app.invalidate(); return; }
    renderPanels(); renderPlotBar(); updateUndo(); app.invalidate();
  }
  app.liveTweak = function (live) {
    if (live && app.sim.t > 0) { app.sim.updateMass(); if (app.sim.refreshNets) app.sim.refreshNets(app.model.settings.dt); const e = app.sim.energy(); app.sim.E0 = e.T + e.V - app.sim.Wnc - app.sim.Wimp; }
    else app.reset({ quiet: true });
    app.invalidate();
  };

  function restore(json) {
    const cur = JSON.stringify(app.model);
    app.model = normalise(JSON.parse(json));
    $('#modelName').textContent = app.model.name;
    if (app.sel && !MB.find(app.model, app.sel)) app.sel = null;
    P.analysis.modal = null; P.analysis.eq = null;
    app.reset(); app.save(); updateUndo();
    return cur;
  }
  app.undo = () => { if (!app.undoS.length) return; app.redoS.push(restore(app.undoS.pop())); app.toast('Undone'); };
  app.redo = () => { if (!app.redoS.length) return; app.undoS.push(restore(app.redoS.pop())); app.toast('Redone'); };
  function updateUndo() { $('#btnUndo').disabled = !app.undoS.length; $('#btnRedo').disabled = !app.redoS.length; }

  app.select = function (id, quiet) {
    if (app.sel === id) return;
    app.sel = id; app.pending = null;
    P.renderInspector();
    if (!quiet && id) app.showTab('inspect');
    if (!$('#tab-system').hidden) P.renderSystem();
    app.invalidate();
  };
  app.removeSel = function () {
    if (!app.sel) return;
    const f = MB.find(app.model, app.sel);
    if (!f) return;
    let removed = [];
    app.edit(() => { removed = MB.remove(app.model, app.sel); });
    app.sel = null; P.renderInspector();
    const nm = f.el.name ? MB.plainName(f.el.name) : MB.typeName(f.el);
    app.toast(removed.length > 1 ? `Deleted ${nm} and ${removed.length - 1} attached element${removed.length > 2 ? 's' : ''}` : `Deleted ${nm}`, 'Undo', app.undo);
  };
  app.duplicate = function (id) {
    const f = MB.find(app.model, id);
    if (!f || f.coll !== 'bodies') return;
    let nid;
    app.edit(() => { const b = MB.clone(f.el); b.id = MB.uid('b'); b.name = MB.nextName(app.model, R.splitName(f.el.name)[0] || 'm'); b.x += (b.shape === 'disk' ? b.r : b.w / 2) + 0.1; app.model.bodies.push(b); nid = b.id; });
    app.select(nid);
  };

  /* ---------- running ---------- */
  function updatePlay() {
    const b = $('#btnPlay');
    b.classList.toggle('running', app.running);
    b.querySelector('use').setAttribute('href', app.running ? '#i-pause' : '#i-play');
    b.querySelector('.play-label').textContent = app.running ? 'Pause' : app.sim && app.sim.t > 0 ? 'Resume' : 'Run';
  }
  app.togglePlay = function () {
    if (app.modeAnim) app.stopMode();
    if (app.tool !== 'select') { app.tool = 'select'; app.pending = null; C.renderTools(); C.renderOpts(); }
    app.running = !app.running; app.lag = false; app.rate = 1;
    if (app.running) last = performance.now();
    updatePlay(); app.invalidate();
  };
  app.stepOnce = function () {
    if (app.modeAnim) app.stopMode();
    app.running = false;
    app.sim.step(app.model.settings.dt);
    app.takeSample();
    updatePlay(); app.invalidate(); app.invalidatePlot(); P.updateLive(); updatePlotValues();
  };
  function advance(dtReal) {
    const st = app.model.settings, hstep = st.dt, sim = app.sim;
    app.acc += dtReal * st.speed;
    const n = Math.floor(app.acc / hstep), t0 = performance.now();
    if (!app.backup || sim.t - app.backup.t > 0.05) app.backup = sim.saveState();
    let done = 0;
    while (done < n) {
      sim.step(hstep); done++;
      if (sim.t >= app.nextSample - 1e-12) { app.takeSample(); app.nextSample = sim.t + st.sampleDt; }
      if ((done & 7) === 0) {
        if (!sim.healthy()) break;
        if (performance.now() - t0 > 13) break;
      }
    }
    app.acc -= done * hstep;
    const lagging = done < n;
    if (lagging) app.acc = 0;
    const r = dtReal > 0 ? (done * hstep) / (dtReal * st.speed) : 1;
    app.rate = app.rate * 0.85 + Math.min(1, r) * 0.15;
    app.lag = app.rate < 0.93;
    if (!sim.healthy()) {
      const t = sim.t;
      sim.grab = null;
      if (app.backup) { sim.loadState(app.backup); app.history = app.history.filter((s) => s.t <= sim.t + 1e-12); app.lastSnap = app.history[app.history.length - 1] || null; }
      app.running = false; app.backup = null; updatePlay();
      app.toast(`The run became unstable at t = ${t.toFixed(3)} s and was paused at the last stable state. Check for overlapping pulleys or very stiff springs; a smaller time step (System → Simulation) helps with stiffness.`);
    }
    if (app.history.length && (!app.lastSnap || app.lastSnap.t < sim.t - 1e-12) && done) app.lastSnap = app.history[app.history.length - 1];
  }

  /* ---------- view ---------- */
  app.bounds = function () {
    const m = app.model, s = app.sim;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const add = (x, y, r) => { const rr = r || 0; x0 = Math.min(x0, x - rr); x1 = Math.max(x1, x + rr); y0 = Math.min(y0, y - rr); y1 = Math.max(y1, y + rr); };
    m.bodies.forEach((b, i) => { const r = b.shape === 'disk' ? b.r : Math.hypot(b.w, b.h) / 2; add(s.q[3 * i], s.q[3 * i + 1], r); });
    for (const j of m.joints) if (!j.a.body && j.type !== 'rolling') add(j.a.p[0], j.a.p[1], 0.05);
    for (const f of m.forces) for (const r of [f.a, f.b]) if (r && !r.body && r.p) add(r.p[0], r.p[1], 0.05);
    for (const r of m.ropes) for (const n of r.nodes) if (!n.body) add(n.p[0], n.p[1], (n.r || 0) + 0.05);
    for (const st of m.stops) for (const r of [st.a, st.b]) if (!r.body) add(r.p[0], r.p[1], 0.05);
    for (const a of m.anchors || []) add(a.p[0], a.p[1], 0.1);
    for (const sf of m.surfaces || []) {
      const w = sf.pts.map((p) => MB.toWorld(m, { body: sf.body, p }));
      const ext = Math.max(...w.map((p) => p[0])) - Math.min(...w.map((p) => p[0])) + Math.max(...w.map((p) => p[1])) - Math.min(...w.map((p) => p[1]));
      if (ext < 12 || !m.bodies.length) w.forEach((p) => add(p[0], p[1], 0.05));
    }
    if (m.settings.frames) add(m.settings.origin[0] + 0.15, m.settings.origin[1] + 0.15, 0.2);
    if (!m.bodies.length) { x0 = Math.min(x0, -0.6); x1 = Math.max(x1, 2.4); y0 = Math.min(y0, -0.3); y1 = Math.max(y1, 1.8); }
    if (!Number.isFinite(x0)) { x0 = -0.6; x1 = 2.4; y0 = -0.3; y1 = 1.8; }
    return [x0, y0, x1, y1];
  };
  app.fit = function () {
    const [x0, y0, x1, y1] = app.bounds(), v = app.view;
    const w = Math.max(0.4, x1 - x0), hh = Math.max(0.4, y1 - y0);
    v.s = Math.max(10, Math.min(2000, Math.min((v.W - 40) / (w * 1.12), (v.H - 70) / (hh * 1.18))));
    v.x = (x0 + x1) / 2; v.y = (y0 + y1) / 2 + 12 / v.s;
    app.invalidate();
  };
  const zoom = (f) => { app.view.s = Math.max(8, Math.min(4000, app.view.s * f)); app.invalidate(); };

  app.scene = () => ({ model: app.model, sim: app.modeAnim ? app.modeAnim.sim : app.sim });
  app.invalidate = () => { app.dirty = true; };
  app.invalidatePlot = () => { app.plotDirty = true; };

  const cv = $('#cv'), ctx = cv.getContext('2d');
  if (MB.patchLineWidth) MB.patchLineWidth(ctx);
  const viewEl = $('#view-mechanics');
  app.onShow = function () { resize(); if (!app.shownOnce) { app.shownOnce = true; setTimeout(() => { resize(); app.fit(); }, 0); } app.invalidate(); app.invalidatePlot(); updateTrainFab(); };
  app.onHide = function () { if (app.running) app.togglePlay(); };
  function updateTrainFab() {
    const fab = $('#trainFab'), n = app.model && app.model.learn && MB.suite && MB.suite.mods.some((m) => m.id === 'learn') ? app.model.learn : 0;
    fab.hidden = !n;
    if (!n) return;
    fab.innerHTML = '';
    fab.append(F.icon('i-brain'), h('span', {}, 'Teach it to balance', h('small', {}, `Cart on a guide · ${n} link${n > 1 ? 's' : ''} · learning`)));
    fab.onclick = () => MB.suite && MB.suite.go('learn', { links: n });
  }
  app.updateTrainFab = updateTrainFab;
  function resize() {
    const r = $('#stage').getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    const W = Math.max(1, Math.round(r.width)), H = Math.max(1, Math.round(r.height));
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    app.view.W = W; app.view.H = H; app.dpr = dpr;
    app.invalidate(); app.invalidatePlot();
  }

  function render() {
    const v = app.view, sim = app.modeAnim ? app.modeAnim.sim : app.sim;
    ctx.setTransform(app.dpr, 0, 0, app.dpr, 0, 0);
    const S = app.sceneState = {
      model: app.model, sim, snap: app.modeAnim ? null : app.lastSnap, sel: app.sel, hover: app.hover, running: app.running,
      handles: C.handles(), history: app.model.settings.trails && !app.modeAnim ? app.history : null,
    };
    try { R.draw(ctx, v, S); } catch (e) { console.error(e); }
    app.gridStep = gridStepFor(v);
    C.drawOverlay(ctx, v);
    hud(S);
  }
  function gridStepFor(v) {
    const raw = 16 / v.s, e = Math.pow(10, Math.floor(Math.log10(raw)));
    return [1, 2, 5, 10].map((k) => k * e).find((s) => s >= raw);
  }
  let hudKey = '';
  function hud(S) {
    const sim = app.sim, st = app.model.settings, lines = [];
    if (app.modeAnim) {
      const md = P.analysis.modal && P.analysis.modal.modes[app.modeAnim.idx];
      lines.push(`<span class="t">Mode ${app.modeAnim.idx + 1}</span>`);
      if (md) lines.push(`f = ${md.fHz.toFixed(4)} Hz · shown at ${app.modeAnim.fv.toFixed(2)} Hz`);
    } else {
      lines.push(`<span class="t">t = ${sim.t.toFixed(3)} s</span>`);
      const sp = st.speed >= 1 ? `${+st.speed.toFixed(2)}×` : `${+st.speed.toFixed(3)}×`;
      lines.push(app.running ? (app.lag ? `${sp} requested · running at ${(st.speed * app.rate).toFixed(2)}×` : `${sp} speed`) : sim.t > 0 ? 'paused' : 'ready to run');
    }
    const warns = [...new Set([...(sim.warnings || []), ...(S.warnings || [])])].slice(0, 3);
    warns.forEach((w) => lines.push(`<span class="warn">${w.replace(/</g, '&lt;')}</span>`));
    const k = lines.join('|');
    if (k !== hudKey) { $('#hud').innerHTML = lines.join('<br>'); hudKey = k; }
  }

  /* ---------- plot bar ---------- */
  function renderPlotBar() {
    if (!app.plot) return;
    const chips = $('#plotChips'), cols = app.plot.colors();
    chips.innerHTML = '';
    app.plot.keys = app.plot.keys.filter((k) => app.catMap.has(k));
    app.plot.keys.forEach((k, i) => {
      const ch = app.catMap.get(k);
      chips.append(h('span', { class: 'pchip' }, h('span', { class: 'dot', style: `background:${cols[i % cols.length]}` }), h('span', {}, `${ch.label}`), h('span', { class: 'v', 'data-pv': k }, ''),
        h('button', { type: 'button', title: 'Remove', onclick: () => { app.plot.keys.splice(i, 1); renderPlotBar(); app.invalidatePlot(); app.save(); } }, F.icon('i-close', 'sm'))));
    });
    const sel = $('#plotAdd');
    sel.innerHTML = '';
    sel.append(h('option', { value: '' }, app.plot.keys.length >= 6 ? 'Max. 6 channels' : '+ Add channel'));
    const groups = new Map();
    for (const c of app.cat) { if (!groups.has(c.group)) groups.set(c.group, []); groups.get(c.group).push(c); }
    for (const [g, list] of groups) {
      const og = h('optgroup', { label: g });
      list.forEach((c) => og.append(h('option', { value: c.key, disabled: app.plot.keys.includes(c.key) || app.plot.keys.length >= 6 ? true : null }, `${c.label} [${c.unit}]`)));
      sel.append(og);
    }
    sel.value = '';
    updatePlotValues();
  }
  function updatePlotValues() {
    if (!app.plot) return;
    const last = app.plot.last || [];
    document.querySelectorAll('[data-pv]').forEach((el, i) => {
      const ch = app.catMap.get(el.getAttribute('data-pv'));
      const v = app.plot.mode === 'time' && last[i] != null ? last[i] : ch && app.lastSnap ? ch.fn(app.lastSnap) : NaN;
      el.textContent = Number.isFinite(v) ? `${MB.fmt(v)} ${ch ? ch.unit : ''}` : '';
    });
  }
  function defaultPlots() {
    const m = app.model;
    if (Array.isArray(m.plots) && m.plots.length) return m.plots.filter((k) => app.catMap.has(k));
    const keys = [];
    for (const b of m.bodies.slice(0, 2)) {
      const sup = m.joints.find((j) => !j.a.body && j.b.body === b.id);
      const c = sup && sup.type === 'slider' ? (Math.abs(Math.sin((sup.angle * Math.PI) / 180)) > 0.7 ? 'y' : 'x') : sup && sup.type === 'pin' ? 'th' : 'y';
      keys.push(`${b.id}|${c}`);
    }
    const r = app.sim.ropes[0];
    if (r) keys.push(`${r.el.id}|S0`);
    return keys.filter((k) => app.catMap.has(k)).slice(0, 3);
  }

  /* ---------- tabs / layout ---------- */
  app.showTab = function (name, onlyIfOpen) {
    const panel = $('#panel');
    if (mqSmall.matches && onlyIfOpen && panel.classList.contains('collapsed')) {
      const t = document.querySelector(`.tab[data-tab="${name}"]`); if (t) { t.animate([{ color: 'var(--accent)' }, { color: '' }], { duration: 900 }); }
      return;
    }
    if (name === 'plot' && !mqSmall.matches) name = 'inspect';
    document.querySelectorAll('#panel .tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === name));
    document.querySelectorAll('#panel .tabbody').forEach((b) => (b.hidden = b.id !== 'tab-' + name));
    app.tab = name;
    if (mqSmall.matches) panel.classList.remove('collapsed');
    if (name === 'system') P.renderSystem();
    if (name === 'analysis') P.renderAnalysis();
    if (name === 'inspect') P.renderInspector();
    if (name === 'plot') { app.invalidatePlot(); }
    setTimeout(resize, 0);
  };
  function renderPanels() {
    if (app.updateTrainFab) app.updateTrainFab();
    if (app.syncFollow) app.syncFollow();
    P.renderInspector();
    if (app.tab === 'system') P.renderSystem();
    if (app.tab === 'analysis') P.renderAnalysis();
    $('#modelName').textContent = app.model.name;
  }
  function placePlot() {
    const plot = $('#plot');
    if (mqSmall.matches) { if (plot.parentElement.id !== 'tab-plot') $('#tab-plot').append(plot); }
    else { if (plot.parentElement.id !== 'drawer') $('#drawer').append(plot); if (app.tab === 'plot') app.showTab('inspect'); $('#panel').classList.remove('collapsed', 'tall'); }
    setTimeout(resize, 0);
  }

  /* ---------- presets, data ---------- */
  app.openPresets = function () {
    const list = $('#presetList');
    list.innerHTML = '';
    for (const p of MB.presets) {
      list.append(h('button', { class: 'preset', type: 'button', onclick: () => app.loadPreset(p) },
        h('span', { class: 'nm' }, p.name), h('span', { class: 'tg' }, p.tag || ''), h('span', { class: 'bl' }, p.blurb || ''), p.expect ? h('span', { class: 'ex' }, p.expect) : null));
    }
    $('#presetScrim').hidden = false;
  };
  const closePresets = () => ($('#presetScrim').hidden = true);
  app.loadPreset = function (p, noUndo) {
    const before = JSON.stringify(app.model || {});
    const m = p.build();
    if (!m.notes) m.notes = [p.blurb, p.expect ? 'Expected: ' + p.expect : ''].filter(Boolean).join('\n');
    else if (p.expect) m.notes += '\nExpected: ' + p.expect;
    app.model = normalise(m);
    if (!noUndo && app.model && before !== '{}') { app.undoS.push(before); app.redoS = []; }
    app.sel = null; app.pending = null; P.analysis.modal = null; P.analysis.eq = null;
    app.tool = 'select'; C.renderTools(); C.renderOpts();
    app.reset();
    app.plot.keys = defaultPlots();
    renderPlotBar(); app.fit(); app.save(); updateUndo(); closePresets();
  };
  app.loadJSON = function (txt) {
    let m;
    try { m = JSON.parse(txt); } catch (e) { return app.toast('That text is not valid JSON'); }
    if (!m || !Array.isArray(m.bodies)) return app.toast('No system found in that JSON (missing "bodies")');
    const before = JSON.stringify(app.model);
    app.model = normalise(m);
    app.undoS.push(before); app.redoS = [];
    app.sel = null; app.reset(); app.plot.keys = defaultPlots(); renderPlotBar(); app.fit(); app.save(); updateUndo();
    app.toast('System loaded', 'Undo', app.undo);
  };
  app.copyText = function (text, fallback) {
    if (MB.copyText) return MB.copyText(text, fallback);
    const done = () => app.toast('Copied to the clipboard');
    const fb = () => { if (fallback) { fallback.value = text; fallback.focus(); fallback.select(); app.toast('Selected the text; copy it with your system shortcut'); } };
    try { navigator.clipboard.writeText(text).then(done, fb); } catch (e) { fb(); }
  };

  /* ---------- analysis actions ---------- */
  app.runEquilibrium = function () {
    if (app.running) app.togglePlay();
    app.toast('Searching for equilibrium…');
    setTimeout(() => {
      const res = MB.equilibrium(app.model);
      P.analysis.eq = res; P.analysis.modal = null;
      if (res.q) {
        app.edit(() => app.model.bodies.forEach((b, i) => { b.x = +res.q[3 * i].toFixed(9); b.y = +res.q[3 * i + 1].toFixed(9); b.th = +((res.q[3 * i + 2] * 180) / Math.PI).toFixed(7); b.vx = 0; b.vy = 0; b.om = 0; }));
        app.toast(res.ok ? 'Equilibrium stored as the initial state' : 'Stored the most settled state found', 'Undo', app.undo);
      } else app.toast(res.msg);
      P.renderAnalysis();
    }, 30);
  };
  app.runModal = function () {
    if (app.running) app.togglePlay();
    app.stopMode(true);
    try { P.analysis.modal = MB.modal(app.model); } catch (e) { console.error(e); P.analysis.modal = { ok: false, msg: 'The linearisation failed for this configuration.' }; }
    P.renderAnalysis();
  };
  app.animateMode = function (k) {
    const md = P.analysis.modal && P.analysis.modal.modes[k];
    if (!md) return;
    if (app.running) app.togglePlay();
    const sim = new MB.Sim(app.model); sim.freezeTime = true;
    const [x0, y0, x1, y1] = app.bounds(), ext = Math.hypot(x1 - x0, y1 - y0);
    let mx = 1e-12;
    app.model.bodies.forEach((b, i) => { const size = b.shape === 'disk' ? b.r : Math.hypot(b.w, b.h) / 2; mx = Math.max(mx, Math.hypot(md.shape[3 * i], md.shape[3 * i + 1]) + Math.abs(md.shape[3 * i + 2]) * size); });
    app.modeAnim = { idx: k, sim, q0: Float64Array.from(sim.q), shape: md.shape, amp: (0.07 * ext) / mx, fv: Math.max(0.45, Math.min(1.1, md.fHz || 0.6)), t0: performance.now() };
    P.renderAnalysis(); app.invalidate();
  };
  app.stopMode = function (quiet) { if (!app.modeAnim) return; app.modeAnim = null; if (!quiet) P.renderAnalysis(); app.invalidate(); };

  /* ---------- toast ---------- */
  let toastT = 0;
  app.toast = function (msg, act, fn) {
    const t = $('#toast');
    t.innerHTML = ''; t.append(h('span', {}, msg));
    if (act) t.append(h('button', { type: 'button', onclick: () => { t.hidden = true; fn(); } }, act));
    t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), act ? 5000 : 2600);
  };

  /* ---------- speed ---------- */
  function setSpeed(v) {
    const s = Math.max(0.01, Math.min(20, v));
    app.model.settings.speed = s;
    const txt = s >= 1 ? `${+s.toFixed(2)}×` : s >= 0.1 ? `${+s.toFixed(2)}×` : `${+s.toFixed(3)}×`;
    $('#speedLabel').textContent = txt; $('#speedVal').textContent = `${s.toFixed(s < 0.1 ? 3 : 2)}×`;
    $('#speedRange').value = Math.log10(s);
    document.querySelectorAll('#speedChips .chip').forEach((c) => c.classList.toggle('on', Math.abs(+c.dataset.v - s) < 1e-6));
    app.acc = 0; app.save();
  }

  /* ---------- main loop ---------- */
  let last = performance.now(), lastPanel = 0, lastPlot = 0;
  function frame(now) {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
    if (app.running) { advance(dt); app.dirty = true; app.plotDirty = true; }
    if (app.model.settings.follow && !app.modeAnim) {
      const st = app.model.settings, bs = app.model.bodies;
      let i = st.followId ? bs.findIndex((b) => b.id === st.followId) : -1;
      if (i < 0 && app.sel) i = bs.findIndex((b) => b.id === app.sel);
      if (i < 0 && bs.length) i = 0;
      if (i >= 0 && 3 * i + 1 < app.sim.q.length) {
        const tx = app.sim.q[3 * i], ty = app.sim.q[3 * i + 1], v = app.view, k = app.running ? 0.18 : 1;
        if (Math.abs(tx - v.x) * v.s > 0.5 || Math.abs(ty - v.y) * v.s > 0.5) { v.x += (tx - v.x) * k; v.y += (ty - v.y) * k; app.dirty = true; }
      }
    }
    if (app.modeAnim) {
      const M = app.modeAnim, tau = (now - M.t0) / 1000, sv = Math.sin(2 * Math.PI * M.fv * tau) * M.amp;
      for (let i = 0; i < M.q0.length; i++) M.sim.q[i] = M.q0[i] + sv * M.shape[i];
      M.sim.projectPos(false); M.sim.updateMem();
      app.dirty = true;
    }
    if (viewEl.hidden) { requestAnimationFrame(frame); return; }
    if (app.dirty) { render(); app.dirty = false; }
    const plotVisible = mqSmall.matches ? app.tab === 'plot' && !$('#panel').classList.contains('collapsed') : !$('#drawer').classList.contains('collapsed');
    if (plotVisible && app.plotDirty && now - lastPlot > 33) { app.plot.draw(app.history, app.cat); app.plotDirty = false; lastPlot = now; updatePlotValues(); }
    if (now - lastPanel > 150 && (app.running || app.liveDirty)) { P.updateLive(); lastPanel = now; app.liveDirty = false; if (!plotVisible) updatePlotValues(); }
    requestAnimationFrame(frame);
  }

  /* ---------- boot ---------- */
  function boot() {
    R.readTokens();
    const saved = store.get();
    app.plot = new MB.Plot(app);
    C.renderTools(); C.renderOpts();
    C.attach(cv); C.keys();
    resize();
    new ResizeObserver(resize).observe($('#stage'));
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { R.readTokens(); app.invalidate(); app.invalidatePlot(); });
    new MutationObserver(() => { R.readTokens(); app.invalidate(); app.invalidatePlot(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
    if (saved && saved.model && Array.isArray(saved.model.bodies)) {
      app.model = normalise(saved.model);
      app.reset();
      app.plot.keys = (saved.plots || []).filter((k) => app.catMap.has(k));
      if (!app.plot.keys.length) app.plot.keys = defaultPlots();
      if (saved.drawer) $('#drawer').classList.add('collapsed');
    } else {
      app.model = null;
      app.loadPreset(MB.presets[0], true);
      app.undoS = [];
    }
    setSpeed(app.model.settings.speed || 1);
    app.tab = 'inspect';
    placePlot();
    if (mqSmall.matches) $('#panel').classList.add('collapsed');
    mqSmall.addEventListener('change', placePlot);
    renderPanels(); renderPlotBar(); updateUndo();
    setTimeout(() => { resize(); app.fit(); }, 0);
    document.fonts && document.fonts.ready.then(() => { app.invalidate(); app.invalidatePlot(); });

    $('#btnPlay').onclick = app.togglePlay;
    $('#btnReset').onclick = () => app.reset();
    $('#btnStep').onclick = app.stepOnce;
    $('#btnUndo').onclick = app.undo; $('#btnRedo').onclick = app.redo;
    $('#btnFit').onclick = app.fit;
    const fb = $('#btnFollow');
    const syncFollow = () => fb.classList.toggle('on', !!app.model.settings.follow);
    fb.onclick = () => {
      const st = app.model.settings, on = !st.follow;
      const selBody = app.sel && app.model.bodies.find((b) => b.id === app.sel);
      st.follow = on; if (on && selBody) st.followId = selBody.id;
      syncFollow(); app.save();
      app.toast(on ? `Camera follows ${MB.plainName((app.model.bodies.find((b) => b.id === st.followId) || selBody || app.model.bodies[0] || { name: 'the first part' }).name)}` : 'Camera fixed');
    };
    app.syncFollow = syncFollow; syncFollow(); $('#btnZoomIn').onclick = () => zoom(1.25); $('#btnZoomOut').onclick = () => zoom(0.8);
    $('#btnPresets').onclick = app.openPresets; $('#presetClose').onclick = closePresets;
    $('#presetScrim').addEventListener('click', (e) => { if (e.target.id === 'presetScrim') closePresets(); });
    const pop = $('#speedPop');
    $('#btnSpeed').onclick = (e) => { e.stopPropagation(); pop.hidden = !pop.hidden; };
    document.addEventListener('pointerdown', (e) => { if (!pop.hidden && !pop.contains(e.target) && e.target.id !== 'btnSpeed' && !$('#btnSpeed').contains(e.target)) pop.hidden = true; });
    $('#speedRange').addEventListener('input', (e) => setSpeed(Math.pow(10, +e.target.value)));
    const chips = $('#speedChips');
    [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10].forEach((v) => chips.append(h('button', { class: 'chip', type: 'button', 'data-v': v, onclick: () => setSpeed(v) }, `${v}×`)));
    setSpeed(app.model.settings.speed || 1);
    document.querySelectorAll('#panel .tab').forEach((t) => t.addEventListener('click', () => {
      const panel = $('#panel');
      if (mqSmall.matches && t.classList.contains('on') && !panel.classList.contains('collapsed')) { panel.classList.add('collapsed'); panel.classList.remove('tall'); setTimeout(resize, 0); return; }
      app.showTab(t.dataset.tab);
    }));
    $('#sheetGrip').onclick = () => {
      const panel = $('#panel');
      if (panel.classList.contains('collapsed')) panel.classList.remove('collapsed');
      else panel.classList.toggle('tall');
      setTimeout(resize, 0);
    };
    $('#plotAdd').addEventListener('change', (e) => { const k = e.target.value; if (k && !app.plot.keys.includes(k)) app.plot.keys.push(k); renderPlotBar(); app.invalidatePlot(); app.save(); });
    $('#plotWin').addEventListener('change', (e) => { app.plot.win = +e.target.value; app.invalidatePlot(); });
    document.querySelectorAll('#plotMode button').forEach((b) => b.addEventListener('click', () => {
      app.plot.mode = b.dataset.v; document.querySelectorAll('#plotMode button').forEach((x) => x.classList.toggle('on', x === b));
      if (b.dataset.v === 'phase' && app.plot.keys.length < 2) app.toast('Phase plot: the first channel is the horizontal axis, the second the vertical');
      app.invalidatePlot();
    }));
    $('#plotToggle').onclick = () => { $('#drawer').classList.toggle('collapsed'); app.save(); setTimeout(resize, 0); };
    $('#plotCsv').onclick = () => {
      const chs = app.plot.resolve(app.cat);
      if (!chs.length) return app.toast('Add a channel first');
      const rows = [['t [s]', ...chs.map((c) => `${c.label} [${c.unit}]`)].join(',')];
      for (const s of app.history) rows.push([s.t.toFixed(6), ...chs.map((c) => { const v = c.fn(s); return Number.isFinite(v) ? v.toPrecision(8) : ''; })].join(','));
      app.copyText(rows.join('\n'), null);
    };
    requestAnimationFrame(frame);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof window !== 'undefined' ? window : globalThis);
