/* Dynamic Interactive Labs — suite shell: module registry, hash routing, launcher, placeholders, theme button */
(function (G) {
  'use strict';
  const MB = G.MB, F = MB.F, h = F.h, R = MB.R;
  const $ = (s) => document.querySelector(s);
  const { sin, cos, PI, sqrt, exp, random } = Math;

  const MODS = [
    { id: 'mechanics', cat: 'dyn', name: 'Mechanics Lab', status: 'ready', desc: 'Rigid parts, supports, joints, springs, dampers and any series/parallel network of them, ropes over pulleys, contact surfaces. Your pulley sketch lives here.' },
    { id: 'statics', cat: 'eng', name: 'Statics & Frames', status: 'ready', desc: 'A plane-frame editor with an icon toolbar: Fest-/Loslager, Einspannung, springs and dampers, M/Q/N hinges, couples anywhere, line loads, temperature; M, Q, N and D drawn on the structure at a click; the unit-load and force methods, influence lines with pole plans, and the dynamic response.' },
    { id: 'som', cat: 'eng', name: 'Strength of Materials', status: 'ready', desc: 'Festigkeitslehre: a beam with a cut you slide along it (side view, Q and M, the section at x with σ(z) and τ(z)); section properties with the Steiner table, principal axes and the circle of inertia; oblique bending with the neutral axis; Jourawski shear and shear-flow arrows in open and closed thin-walled sections, the shear centre; torsion (Saint-Venant, Bredt, open walls, the slit tube); bars in tension and compression; the elastic line (Euler–Bernoulli and Timoshenko); Castigliano and Menabrea; Euler buckling with the load ramped to F_k, eigenmodes and the four cases. Calculations typeset, each linked to its Math derivation.' },
  ];
  /* Families: several labs (or groups of scenes inside a lab) that belong to one subject and share one scene navigator.
     A part is a lab, optionally restricted to some of its scene groups. */
  const FAMS = [];
  const CATS = [
    ['dyn', 'Classical mechanics', 'Rigid parts, supports, joints, springs, dampers, ropes over pulleys and contact, simulated in the plane.'],
    ['eng', 'Engineering', 'Statics and strength of materials, built up from the fundamentals.'],
  ];

  /* ---------------- small preview drawings ---------------- */
  const P = {};
  P.mechanics = (c, W, H, t) => {
    c.strokeStyle = t.ink; c.lineWidth = 1.5; c.fillStyle = t.body;
    const gy = H - 26; c.beginPath(); c.moveTo(20, gy); c.lineTo(W - 20, gy); c.stroke();
    for (let x = 24; x < W - 20; x += 7) { c.beginPath(); c.moveTo(x, gy); c.lineTo(x - 5, gy + 6); c.stroke(); }
    c.fillRect(W * 0.18, gy - 30, W * 0.34, 28); c.strokeRect(W * 0.18, gy - 30, W * 0.34, 28);
    const px = W * 0.78, py = 26; c.beginPath(); c.arc(px, py, 10, 0, 2 * PI); c.fillStyle = t.paper; c.fill(); c.stroke();
    c.lineWidth = 3; c.beginPath(); c.moveTo(W * 0.48, gy - 34); c.lineTo(px - 8, py - 6); c.moveTo(px + 10, py); c.lineTo(px + 10, py + 50); c.stroke();
    c.lineWidth = 1.5; c.fillStyle = t.body; c.fillRect(px + 2, py + 50, 18, 26); c.strokeRect(px + 2, py + 50, 18, 26);
    c.beginPath(); c.arc(W * 0.35, 40, 18, 0, 2 * PI); c.fill(); c.stroke();
    c.beginPath(); for (let k = 0; k <= 60; k++) { const y = 4 + k * 0.3, x = W * 0.35 + 5 * sin(k * 0.6); k ? c.lineTo(x, y + 2) : c.moveTo(x, y); } c.stroke();
  };
  P.statics = (c, W, H, t) => { // a Pratt truss
    const x0 = 18, s = (W - 36) / 6, y0 = H * 0.72, hh = Math.min(H * 0.42, s * 1.1); c.lineWidth = 2; c.strokeStyle = t.ink;
    const nodes = []; for (let i = 0; i <= 6; i++) nodes.push([x0 + i * s, y0]); for (let i = 1; i <= 5; i++) nodes.push([x0 + i * s, y0 - hh]);
    const bars = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [7, 8], [8, 9], [9, 10], [10, 11], [0, 7], [11, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11], [7, 2], [8, 3], [10, 3], [11, 4]];
    bars.forEach(([a, b], i) => { c.strokeStyle = i < 6 ? t.load : i < 12 ? t.accent : t.ink; c.beginPath(); c.moveTo(...nodes[a]); c.lineTo(...nodes[b]); c.stroke(); });
    c.fillStyle = t.paper; c.strokeStyle = t.ink; c.lineWidth = 1.2; nodes.forEach((p) => { c.beginPath(); c.arc(p[0], p[1], 3, 0, 2 * PI); c.fill(); c.stroke(); });
  };
  P.som = (c, W, H, t) => { // an I-section with its shear-flow arrows and a twisted tube
    const cx = W * 0.32, cy = H / 2, b = Math.min(W * 0.36, H * 0.7), hh = H * 0.66, tf = 7, tw = 5; c.fillStyle = t.body; c.strokeStyle = t.ink; c.lineWidth = 1.2;
    c.fillRect(cx - b / 2, cy - hh / 2, b, tf); c.fillRect(cx - b / 2, cy + hh / 2 - tf, b, tf); c.fillRect(cx - tw / 2, cy - hh / 2, tw, hh);
    c.strokeRect(cx - b / 2, cy - hh / 2, b, tf); c.strokeRect(cx - b / 2, cy + hh / 2 - tf, b, tf); c.strokeRect(cx - tw / 2, cy - hh / 2 + tf, tw, hh - 2 * tf);
    c.strokeStyle = c.fillStyle = t.accent; c.lineWidth = 1.6; const ar = (x0, y0, x1, y1) => R.arrow(c, x0, y0, x1, y1, 6);
    ar(cx - b / 2 + 6, cy - hh / 2 - 7, cx - 10, cy - hh / 2 - 7); ar(cx + b / 2 - 6, cy - hh / 2 - 7, cx + 10, cy - hh / 2 - 7);
    ar(cx + 10, cy - hh / 4, cx + 10, cy + hh / 4); ar(cx - 10, cy + hh / 2 + 7, cx - b / 2 + 6, cy + hh / 2 + 7); ar(cx + 10, cy + hh / 2 + 7, cx + b / 2 - 6, cy + hh / 2 + 7);
    const mx = W * 0.76, r = Math.min(W, H) * 0.26; c.strokeStyle = t.ink; c.lineWidth = 2; c.beginPath(); c.arc(mx, cy, r, 0, 2 * PI); c.stroke(); c.beginPath(); c.arc(mx, cy, r * 0.8, 0, 2 * PI); c.stroke();
    c.strokeStyle = c.fillStyle = t.load; c.lineWidth = 1.4; for (let k = 0; k < 8; k++) { const a = k * PI / 4, rr = r * 0.9; ar(mx + rr * cos(a), cy + rr * sin(a), mx + rr * cos(a + 0.5), cy + rr * sin(a + 0.5)); }
  };

  function drawPreview(cv, id) {
    const dpr = window.devicePixelRatio || 1, W = cv.clientWidth || 260, H = cv.clientHeight || 132;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = R.tok.paper; c.fillRect(0, 0, W, H);
    c.strokeStyle = R.tok.grid; c.lineWidth = 1; c.beginPath();
    for (let x = 0.5; x < W; x += 16) { c.moveTo(x, 0); c.lineTo(x, H); } for (let y = 0.5; y < H; y += 16) { c.moveTo(0, y); c.lineTo(W, y); } c.stroke();
    c.lineCap = 'round'; c.lineJoin = 'round';
    try { (P[id] || (() => 0))(c, W, H, R.tok); } catch (e) { console.error(e); }
  }

  /* ---------------- views ---------------- */
  function renderHome() {
    const root = $('#view-home');
    root.innerHTML = '';
    const wrap = h('div', { class: 'home' });
    wrap.append(h('h1', {}, 'Simulations'), h('p', { class: 'lede' }, `${MODS.filter((m) => m.status === 'ready').length} labs in mechanics: a planar dynamics lab, statics and frames, and strength of materials. Pick one to open it.`));
    wrap.append(h('nav', { class: 'catnav' }, ...CATS.map(([k, n]) => h('button', { type: 'button', class: 'chip', onclick: () => { const el = document.getElementById('cat-' + k); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, n, h('span', { class: 'cnum' }, String(MODS.filter((m) => m.cat === k).length))))));
    for (const [k, n, d] of CATS) {
      const fo = (m) => { const i = FAMS.findIndex((f) => f.id === m.fam); return i < 0 ? 99 : i; }, mods = MODS.filter((m) => m.cat === k).sort((a, b) => fo(a) - fo(b)); if (!mods.length) continue;
      const cards = h('div', { class: 'cards' });
      const done = {};
      for (const m of mods) {
        const fam = m.fam && FAMS.find((f) => f.id === m.fam);
        if (fam) { /* one card for the family, with its parts as a sub menu */
          if (done[fam.id]) continue; done[fam.id] = 1; const F2 = S.family(m.id), n = F2.parts.reduce((u, p) => u + (p.items ? p.items.length : 0), 0), first = F2.parts[0];
          const open = (p) => S.go(p.lab, p.items && p.items[0] && p.groups ? { scene: p.items[0].id } : null);
          cards.append(h('div', { class: 'card fam' }, h('button', { class: 'famtop', type: 'button', onclick: () => open(first) }, h('canvas', { 'data-prev': fam.prev, 'aria-hidden': 'true' }),
            h('span', { class: 'cb' }, h('span', { class: 'cn' }, fam.name, h('span', { class: 'pill ok' }, n ? `${n} scenes` : '…')), h('span', { class: 'cd clamp', title: fam.desc }, fam.desc))),
            h('div', { class: 'famparts' }, ...F2.parts.map((p) => h('button', { class: 'chip' + (p.main ? ' main' : ''), type: 'button', title: p.main ? 'a main subject' : null, onclick: () => open(p) }, p.name, p.items ? h('span', { class: 'cnum' }, String(p.items.length)) : null)))));
          continue;
        }
        const cv = h('canvas', { 'data-prev': m.id, 'aria-hidden': 'true' });
        cards.append(h('button', { class: 'card' + (m.status === 'ready' ? '' : ' planned'), type: 'button', onclick: () => S.go(m.id) }, cv,
          h('span', { class: 'cb' }, h('span', { class: 'cn' }, m.name, h('span', { class: 'pill ' + (m.status === 'ready' ? 'ok' : '') }, m.status === 'ready' ? 'Ready' : `Chunk ${m.chunk}`)), h('span', { class: 'cd clamp', title: m.desc }, m.desc))));
      }
      wrap.append(h('section', { class: 'cat', id: 'cat-' + k }, h('div', { class: 'cathead' }, h('h2', {}, n), h('p', {}, d)), cards));
    }
    root.append(wrap);
    requestAnimationFrame(() => root.querySelectorAll('canvas[data-prev]').forEach((cv) => drawPreview(cv, cv.dataset.prev)));
  }

  function renderSoon(m) {
    const root = $('#view-soon');
    root.innerHTML = '';
    const cv = h('canvas', { 'data-prev': m.id });
    root.append(h('div', { class: 'soon' }, cv, h('h1', {}, m.name), h('p', { class: 'note', style: 'font-size:16px' }, m.desc),
      h('p', {}, h('span', { class: 'pill warn' }, `Planned · chunk ${m.chunk}`)),
      h('div', { class: 'eyebrow', style: 'margin-top:14px' }, 'What it will do'), h('ul', {}, ...(m.features || []).map((f) => h('li', {}, f))),
      h('div', { class: 'row', style: 'margin-top:16px' }, F.btn('All simulations', () => S.go('home'), '', 'i-home'))));
    requestAnimationFrame(() => drawPreview(cv, m.id));
  }

  const S = (MB.suite = { route: null, mods: MODS, cats: CATS });
  S.fams = FAMS;
  /* the family a lab belongs to, with the scenes of every part (scenes of the calling lab may be passed in) */
  S.family = function (labId, scenes) {
    const m = MODS.find((x) => x.id === labId), fam = m && m.fam && FAMS.find((f) => f.id === m.fam); if (!fam) return null;
    return { id: fam.id, name: fam.name, parts: fam.parts.map((p) => { const SL = MB.SceneLabs && MB.SceneLabs[p.lab], CT = MB.Catalogue && MB.Catalogue[p.lab], all = p.lab === labId && scenes ? scenes : SL ? SL.scenes : CT ? CT.map((q) => ({ id: q[0], name: q[1], group: q[2], blurb: q[3] })) : null, md = MODS.find((x) => x.id === p.lab);
      return { name: p.name, lab: p.lab, main: !!p.main, groups: p.groups || p.not || null, desc: md ? md.desc : '', items: all ? all.filter((sc) => (!p.groups || p.groups.includes(sc.group)) && (!p.not || !p.not.includes(sc.group))).map((sc) => ({ lab: p.lab, id: sc.id, name: sc.name, group: sc.group, blurb: sc.blurb })) : null }; }) };
  };
  /* scenes that moved to another lab keep their old addresses */
  const MOVED = { ana2: { measure: 'real', lebesgue: 'real', fubini: 'real', fourier: 'real', complex: 'cplx' } };
  S.moved = MOVED;
  S.go = function (id, opts) { if (opts && opts.scene && MOVED[id] && MOVED[id][opts.scene]) id = MOVED[id][opts.scene]; S.opts = opts || null; if (location.hash.slice(1) === id) S.show(id); else location.hash = id; };
  S.show = function (id) {
    if (/^eng(-|$)/.test(id || '') && id !== 'eng-math') id = 'home';
    /* code is fetched per lab: a route whose code is not here yet shows its name, loads what it needs, and comes back */
    if (MB.deferred && MB.deferred.load && id && id !== 'home' && (MODS.some((x) => x.id === id) || /^eng(-|$)/.test(id))) { const D = MB.deferred, mm = MODS.find((x) => x.id === id), whole = !mm || !D.groups[id]; if (whole ? !D.done : !D.has(id)) { const o = S.opts; S.opts = null; S.route = null; document.querySelectorAll('.view').forEach((v) => (v.hidden = true)); document.querySelectorAll('.modctl').forEach((c) => (c.hidden = true)); $('#modTitle').textContent = (mm ? mm.name : 'Dynamic Interactive Labs') + ' · loading …'; const back = () => { S.route = null; S.opts = o; S.show(id); }; if (whole) D.all(back); else D.load(D.need(id), back); return; } }
    const eng = /^eng(-|$)/.test(id || '') && MB.Eng;
    const m = MODS.find((x) => x.id === id);
    if (!m && id !== 'home' && !eng) id = 'home';
    const prev = S.route;
    if (prev === id && !S.opts) return;
    if (prev === 'mechanics' && id !== 'mechanics' && MB.app && MB.app.onHide) MB.app.onHide();
    if (prev === 'learn' && id !== 'learn' && MB.Learn) MB.Learn.onHide();
    if (prev === 'chaos' && id !== 'chaos' && MB.Chaos) MB.Chaos.onHide();
    if (prev === 'orbits' && id !== 'orbits' && MB.Orbits) MB.Orbits.onHide();
    if (prev && prev !== id && MB.Labs && MB.Labs[prev]) MB.Labs[prev].hide();
    S.route = id;
    const view = id === 'home' ? 'home' : eng ? 'eng' : m && m.status === 'ready' ? id : 'soon';
    document.querySelectorAll('.view').forEach((v) => (v.hidden = v.id !== 'view-' + view));
    document.querySelectorAll('.modctl').forEach((c) => (c.hidden = c.dataset.for !== view));
    $('#modTitle').textContent = id === 'home' ? 'Simulations' : eng ? MB.Eng.title(id) : m.name;
    if (view === 'home') renderHome();
    else if (view === 'eng') MB.Eng.render(id);
    else if (view === 'soon') renderSoon(m);
    else if (id === 'mechanics' && MB.app && MB.app.onShow) MB.app.onShow();
    else if (id === 'learn' && MB.Learn) MB.Learn.onShow(S.opts);
    else if (id === 'chaos' && MB.Chaos) MB.Chaos.onShow(S.opts);
    else if (id === 'orbits' && MB.Orbits) MB.Orbits.onShow(S.opts);
    else if (MB.Labs && MB.Labs[id]) MB.Labs[id].show(S.opts);
    S.opts = null; botNav();
    try { localStorage.setItem('pdl.route', id); } catch (e) { /* storage unavailable */ }
  };

  /* the bar at the bottom of a phone screen: home, the labs, the three parts of a lab's panel, search */
  function botNav() { const nav = $('#botNav'); if (!nav) return; const L = MB.Labs && MB.Labs[S.route], lab = !!(L && L.tab && L.tabs), has = (k) => lab && L.tabs.some((t) => t[0] === k), it = (icon, label, on, fn) => h('button', { type: 'button', class: on ? 'on' : '', 'aria-current': on ? 'page' : null, onclick: fn }, F.icon(icon), h('span', {}, label)), tab = (k) => () => { const v = document.getElementById('view-' + S.route); if (v) v.classList.remove('big'); L.tab(k); };
    nav.innerHTML = ''; nav.append(it('i-house', 'Home', S.route === 'home', () => S.go('home')), it('i-grid', 'Labs', false, (e) => { e.stopPropagation(); modMenu(); const pop = $('#modPop'); pop.hidden = !pop.hidden; }));
    if (lab) { if (has('list')) nav.append(it('i-list', 'Scenes', L.curTab === 'list', tab('list'))); if (has('ctl')) nav.append(it('i-gear', 'Controls', L.curTab === 'ctl', tab('ctl'))); if (has('th')) nav.append(it('i-book', 'Theory', L.curTab === 'th', tab('th'))); }
  }
  S.nav = botNav;
  function modMenu() {
    const pop = $('#modPop');
    pop.innerHTML = '';
    pop.append(h('button', { type: 'button', class: S.route === 'home' ? 'on' : '', onclick: () => { pop.hidden = true; S.go('home'); } }, F.icon('i-home', 'sm'), 'All simulations'));
    for (const [k, n] of CATS) { const fo = (m) => { const i = FAMS.findIndex((f) => f.id === m.fam); return i < 0 ? 99 : i; }, mods = MODS.filter((m) => m.cat === k).sort((a, b) => fo(a) - fo(b)); if (!mods.length) continue; pop.append(h('div', { class: 'popcat' }, n));
      const seen = {};
      for (const m of mods) { const fam = m.fam && FAMS.find((f) => f.id === m.fam);
        if (fam) { if (seen[fam.id]) continue; seen[fam.id] = 1; pop.append(h('div', { class: 'popfam' }, fam.name)); const cur = S.family(S.route), on = cur && cur.id === fam.id ? cur.parts.findIndex((p) => p.items && p.items.some((x) => x.lab === S.route && MB.Labs && MB.Labs[S.route] && MB.Labs[S.route].sceneId === x.id)) : -1;
          S.family(m.id).parts.forEach((p, i) => pop.append(h('button', { type: 'button', class: 'sub' + (i === on ? ' on' : ''), onclick: () => { pop.hidden = true; S.go(p.lab, p.items && p.items[0] && p.groups ? { scene: p.items[0].id } : null); } }, p.name))); continue; }
        pop.append(h('button', { type: 'button', class: S.route === m.id ? 'on' : '', onclick: () => { pop.hidden = true; S.go(m.id); } }, m.name, h('span', { class: 'st' }, m.status === 'ready' ? '' : `chunk ${m.chunk}`))); } }
  }

  function boot() {
    MB.Theme.apply();
    MB.Theme.onChange(() => { R.readTokens(); if (S.route === 'home') renderHome(); if (/^eng/.test(S.route || '') && MB.Eng) MB.Eng.render(S.route); if (S.route && !/^eng/.test(S.route) && !['home', 'mechanics', 'learn', 'chaos', 'orbits'].includes(S.route) && !(MB.Labs && MB.Labs[S.route])) renderSoon(MODS.find((m) => m.id === S.route)); });
    $('#btnHome').onclick = () => S.go('home');
    $('#btnTheme').onclick = () => MB.Theme.open();
    $('#themeScrim').addEventListener('click', (e) => { if (e.target.id === 'themeScrim') MB.Theme.close(); });
    const pop = $('#modPop');
    $('#btnModules').onclick = (e) => { e.stopPropagation(); modMenu(); pop.hidden = !pop.hidden; };
    document.addEventListener('pointerdown', (e) => { if (!pop.hidden && !pop.contains(e.target) && !$('#btnModules').contains(e.target)) pop.hidden = true; });
    { const nav = h('nav', { class: 'botnav', id: 'botNav', 'aria-label': 'Main menu' }); $('.views').after(nav); }
    window.addEventListener('hashchange', () => S.show(location.hash.slice(1) || 'home'));
    let start = location.hash.slice(1);
    if (!start) { try { start = localStorage.getItem('pdl.route') || 'home'; } catch (e) { start = 'home'; } }
    S.show(start);
    let rt = 0;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (S.route === 'home') renderHome(); }, 200); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof window !== 'undefined' ? window : globalThis);
