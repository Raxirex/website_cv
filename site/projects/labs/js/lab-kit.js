/* Dynamic Interactive Labs — generic lab shell: view, header controls, tabs, render loop, panes, storage.
   A lab registers with MB.Lab({ id, tabs, init(L), frame(L, dt), open(L, sceneId) }) and the router calls L.show / L.hide. */
(function (G) {
  'use strict';
  const MB = G.MB, F = MB.F, h = F.h;
  /* solved challenges, remembered on this device: { 'lab:scene': timestamp } */
  MB.Solved = (() => { const KEY = 'pdl.stars.v1'; let d = {}; try { d = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { d = {}; } return { has: (lab, sc) => !!d[lab + ':' + sc], add: (lab, sc) => { if (d[lab + ':' + sc]) return; d[lab + ':' + sc] = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* storage unavailable: kept for this visit only */ } }, count: () => Object.keys(d).length, clear: () => { d = {}; try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } } }; })();
  const $ = (s) => document.querySelector(s);
  const { min, max, round } = Math;
  const LABS = (MB.Labs = {});

  MB.Lab = function (def) {
    const L = { def, id: def.id, running: def.autoRun !== false, speed: 1, visible: false, inited: false, raf: 0, last: 0, store: {} };
    LABS[def.id] = L;
    const KEY = `pdl.${def.id}.v1`;
    try { L.store = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { L.store = {}; }
    L.save = (patch) => { Object.assign(L.store, patch || {}); try { localStorage.setItem(KEY, JSON.stringify(L.store)); } catch (e) { /* storage unavailable */ } };

    /* ---- DOM ---- */
    const tabs = def.tabs || [['list', 'Scenes'], ['ctl', 'Controls'], ['th', 'Theory']];
    L.tabs = tabs;
    /* panel header: a back arrow to the scene list, the scene's name, and icon tabs (gear = the scene's controls, book = theory).
       The controls are what you see first; the scene list is one tap back. */
    const ICON = { list: 'i-list', ctl: 'i-gear', th: 'i-book' }, first = tabs.some(([k]) => k === 'ctl') ? 'ctl' : tabs[0][0];
    L.ptitle = h('span', { class: 'ptitle' }, '');
    const tabBtn = ([k, l]) => (k === 'list'
      ? h('button', { class: 'icon-btn sm pback', 'data-labtab': `${def.id}:${k}`, type: 'button', 'data-tip': 'All scenes', 'aria-label': 'All scenes' }, F.icon('i-chev-l'))
      : h('button', { class: 'icon-btn sm ptab' + (k === first ? ' on' : ''), 'data-labtab': `${def.id}:${k}`, type: 'button', 'data-tip': l, 'aria-label': l }, ICON[k] ? F.icon(ICON[k]) : l));
    const listTab = tabs.find(([k]) => k === 'list');
    /* phones: labs whose stage is taller than the screen show one picture at a time (see app.css, .onepane) */
    const ONE = ['kin', 'som', 'fe', 'stress', 'statics', 'stars', 'fluids', 'cycles', 'circuits', 'fourd'].includes(def.id);
    const view = h('section', { class: 'view cv ' + (def.paper ? 'paper' : 'space'), id: `view-${def.id}`, hidden: true },
      h('div', { class: 'cv-stage' }, (L.stageEl = h('div', { class: 'cstage lay-one', id: `${def.id}-stage` }))),
      h('aside', { class: 'panel cv-panel' },
        h('div', { class: 'tabs phead', role: 'tablist' }, listTab ? tabBtn(listTab) : null, L.ptitle, ...tabs.filter(([k]) => k !== 'list').map(tabBtn)),
        ...tabs.map(([k]) => h('div', { class: 'tabbody', id: `${def.id}-tab-${k}`, hidden: k === first ? null : true }))));
    if (ONE) { view.classList.add('onepane'); const bB = h('button', { type: 'button', 'aria-label': 'Show the next picture' }), bZ = h('button', { type: 'button', 'aria-label': 'Larger or smaller picture' }, '⤢'), sw = h('div', { class: 'panesw' }, bB, bZ), kick = () => setTimeout(() => window.dispatchEvent(new Event('resize')), 30);
      const upd = () => { const n = L.stageEl.children.length; let i = +L.stageEl.dataset.pane || 0; if (i >= n) i = 0; L.stageEl.dataset.pane = String(i); bB.hidden = n < 2; bB.textContent = `⇄ ${i + 1}/${n}`; };
      bB.onclick = () => { const n = L.stageEl.children.length || 1; L.stageEl.dataset.pane = String(((+L.stageEl.dataset.pane || 0) + 1) % n); upd(); kick(); }; bZ.onclick = () => { view.classList.toggle('big'); kick(); };
      view.querySelector('.cv-stage').append(sw); new MutationObserver(upd).observe(L.stageEl, { childList: true }); upd(); }
    L.curTab = first;
    const soon = $('#view-soon'); soon.parentNode.insertBefore(view, soon);
    const speeds = def.speeds || [0.25, 0.5, 1, 2, 4];
    L.titleEl = h('span', { class: 'lgen' });
    const sel = h('select', { class: 'select sm', 'aria-label': 'Speed' }, ...speeds.map((s) => h('option', { value: s, selected: s === 1 ? true : null }, `${s}×`)));
    sel.onchange = () => (L.speed = +sel.value);
    L.playBtn = h('button', { class: 'play running', type: 'button', title: 'Run or pause (space)' }, F.icon('i-pause'), h('span', { class: 'play-label' }, 'Pause'));
    L.playBtn.onclick = () => L.setRunning(!L.running);
    const reset = h('button', { class: 'icon-btn', type: 'button', title: 'Start this scene over' }, F.icon('i-reset'));
    reset.onclick = () => def.open && def.open(L, L.sceneId);
    const ctl = h('div', { class: 'modctl', 'data-for': def.id, hidden: true }, L.titleEl, h('div', { class: 'spacer' }), def.noSpeed ? null : sel, reset, def.noPlay ? null : L.playBtn);
    const homeCtl = document.querySelector('.modctl[data-for="home"]'); homeCtl.parentNode.insertBefore(ctl, homeCtl);
    view.querySelectorAll('[data-labtab]').forEach((t) => t.addEventListener('click', () => L.tab(t.dataset.labtab.split(':')[1])));

    L.tab = (k) => { view.querySelectorAll('[data-labtab]').forEach((x) => x.classList.toggle('on', x.dataset.labtab === `${def.id}:${k}`)); tabs.forEach(([q]) => ($(`#${def.id}-tab-${q}`).hidden = q !== k)); L.curTab = k; view.classList.toggle('on-list', k === 'list'); L.ptitle.textContent = k === 'list' ? 'Scenes' : L.sceneName || ''; if (MB.suite && MB.suite.nav) MB.suite.nav(); };
    L.body = (k) => $(`#${def.id}-tab-${k}`);
    L.setTitle = (t) => { L.titleEl.textContent = t; L.sceneName = t; if (L.curTab !== 'list') L.ptitle.textContent = t; };
    L.setRunning = (on) => { L.running = on; const b = L.playBtn; b.classList.toggle('running', on); b.querySelector('use').setAttribute('href', on ? '#i-pause' : '#i-play'); b.querySelector('.play-label').textContent = on ? 'Pause' : 'Run'; };
    L.setLayout = (cls) => { L.stageEl.className = 'cstage ' + cls; };
    L.clearStage = () => { L.stageEl.innerHTML = ''; };

    L.init = () => {
      if (L.inited) return; L.inited = true;
      window.addEventListener('keydown', (e) => { if (!L.visible) return; const tg = e.target; if (tg && /INPUT|TEXTAREA|SELECT/.test(tg.tagName)) return; if (e.key === ' ' && !def.noPlay) { e.preventDefault(); L.setRunning(!L.running); } if (def.key) def.key(L, e); });
      def.init && def.init(L);
    };
    const frame = (now) => {
      if (!L.visible) { L.raf = 0; return; }
      const dt = min(0.05, (now - (L.last || now)) / 1000); L.last = now;
      try { def.frame && def.frame(L, dt, now); } catch (e) { console.error(e); }
      L.raf = requestAnimationFrame(frame);
    };
    L.show = (opts) => {
      L.init(); L.visible = true; L.last = 0;
      if (opts && opts.scene) def.open(L, opts.scene);
      else if (!L.sceneId) def.open(L, L.store.scene || def.first);
      def.onShow && def.onShow(L);
      if (!L.raf) L.raf = requestAnimationFrame(frame);
    };
    L.hide = () => { L.visible = false; def.onHide && def.onHide(L); };
    /* opening a scene shows its controls (every device) */
    L.phoneTabs = () => { if (tabs.some(([k]) => k === 'ctl')) L.tab('ctl'); };
    return L;
  };

  /* ---- tooltips: any element with data-tip shows its name on hover (mouse, after a short delay) or on a long press (touch) ---- */
  (function tips() {
    if (typeof document === 'undefined') return;
    let box = null, timer = 0, cur = null, hideT = 0;
    const show = (el) => {
      if (!el.isConnected) return; if (!box) { box = h('div', { class: 'tipbox', role: 'tooltip' }); document.body.append(box); }
      box.textContent = el.dataset.tip; box.hidden = false; const r = el.getBoundingClientRect(), bw = box.offsetWidth, bh = box.offsetHeight;
      let x = r.left + r.width / 2 - bw / 2, y = r.bottom + 7; if (y + bh > window.innerHeight - 4) y = r.top - bh - 7; x = max(4, min(window.innerWidth - bw - 4, x));
      box.style.left = `${round(x)}px`; box.style.top = `${round(y)}px`;
    };
    const hide = () => { clearTimeout(timer); clearTimeout(hideT); cur = null; if (box) box.hidden = true; };
    document.addEventListener('pointerover', (e) => { if (e.pointerType !== 'mouse') return; const el = e.target.closest ? e.target.closest('[data-tip]') : null; if (el === cur) return; hide(); if (!el) return; cur = el; timer = setTimeout(() => show(el), 420); });
    document.addEventListener('pointerdown', (e) => { const el = e.target.closest ? e.target.closest('[data-tip]') : null; hide(); if (!el || e.pointerType === 'mouse') return; cur = el; timer = setTimeout(() => show(el), 380); }, true);
    document.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') return; clearTimeout(timer); if (box && !box.hidden) hideT = setTimeout(hide, 1100); }, true);
    for (const ev of ['pointercancel', 'scroll', 'keydown', 'wheel']) document.addEventListener(ev, hide, true);
    document.addEventListener('contextmenu', (e) => { if (e.target.closest && e.target.closest('[data-tip]')) e.preventDefault(); });
  })();

  /* ---- panes ---- */
  MB.LabKit = {
    pane(cls, label) {
      const cv = h('canvas', {}), tag = label ? h('div', { class: 'ctag' }, label) : null, stat = h('div', { class: 'cstat' });
      const el = h('div', { class: 'cpane ' + (cls || '') }, cv, tag, stat);
      return { el, cv, stat, tag };
    },
    /* resize a WebGL canvas to its CSS box; cap the device-pixel ratio (and an optional scale) for speed */
    fitGL(cv, cap, scale) {
      const dpr = min(cap || 1.5, window.devicePixelRatio || 1) * (scale || 1), W = cv.clientWidth, H = cv.clientHeight;
      if (!W || !H) return false;
      const w = max(1, round(W * dpr)), hh = max(1, round(H * dpr));
      if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; cv._resized = true; }
      cv._W = W; cv._H = H; cv._dpr = dpr;
      return true;
    },
    fit2d(cv, cap) {
      const dpr = min(cap || 2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
      if (!W || !H) return null;
      if (cv.width !== round(W * dpr) || cv.height !== round(H * dpr)) { cv.width = round(W * dpr); cv.height = round(H * dpr); }
      const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); cv._W = W; cv._H = H; cv._dpr = dpr;
      return c;
    },
    stat(p, html) { if (p.stat._h !== html) { p.stat.innerHTML = html; p.stat._h = html; } },
    /* The scene navigator (first tab). One view for every lab:
       · a lab that belongs to a family (Analysis, Algebra, …) gets the family’s parts as a sub menu, and the list can reach every
         scene of the family; picking one in another part switches lab;
       · groups fold: the group of the running scene is open, the others show their name and count;
       · a find box filters the whole family; ‹ › step to the neighbouring scene.
       What is open, the part being browsed and the query live on L._nav and survive rebuilds. */
    sceneList(L, root, scenes, onPick) {
      (MB.SceneReg = MB.SceneReg || {})[L.id] = scenes; /* every lab's scene list, also for the catalogue */
      const N = (L._nav = L._nav || { q: '', open: {}, part: null, last: null });
      if (N.last !== L.sceneId) { N.last = L.sceneId; N.part = null; }
      const fam = MB.suite && MB.suite.family ? MB.suite.family(L.id, scenes) : null;
      const parts = fam ? fam.parts : [{ name: '', lab: L.id, items: scenes.map((s) => Object.assign({ lab: L.id }, s)) }];
      const isCur = (s) => s.lab === L.id && s.id === L.sceneId;
      const curPart = Math.max(0, parts.findIndex((p) => p.items && p.items.some(isCur)));
      const flat = []; parts.forEach((p, pi) => (p.items || []).forEach((s) => flat.push(Object.assign({ pi }, s))));
      const pick = (s) => { N.q = ''; if (s.lab !== L.id) { MB.suite.go(s.lab, { scene: s.id }); return; } onPick(s.id); if (L.tab && L.curTab === 'list' && L.tabs.some(([k]) => k === 'ctl')) L.tab('ctl'); };
      const row = (s, tag) => h('button', { class: 'expitem' + (isCur(s) ? ' on' : ''), type: 'button', onclick: () => pick(s) }, h('div', { class: 'en' }, s.name, MB.Solved.has(s.lab, s.id) ? h('span', { class: 'navstar', title: 'challenge solved' }, ' ★') : null), tag ? h('div', { class: 'navtag' }, tag) : null, s.blurb ? h('div', { class: 'eb' }, s.blurb) : null);
      const body = h('div', { class: 'navbody' });
      const draw = () => {
        body.innerHTML = ''; const q = N.q.trim().toLowerCase();
        if (q) {
          const words = q.split(/\s+/), hit = flat.filter((s) => { const t = `${s.name} ${s.group || ''} ${s.blurb || ''} ${parts[s.pi].name}`.toLowerCase(); return words.every((w) => t.includes(w)); });
          body.append(h('div', { class: 'navcount' }, hit.length ? `${hit.length} of ${flat.length} scenes` : `Nothing matches “${N.q.trim()}”.`), h('div', { class: 'explist' }, ...hit.map((s) => row(s, [parts[s.pi].name, s.group].filter(Boolean).join(' · ')))));
          return;
        }
        const pi = N.part == null ? curPart : N.part, P = parts[pi];
        if (!P.items) { body.append(h('div', { class: 'explist' }, h('button', { class: 'expitem', type: 'button', onclick: () => MB.suite.go(P.lab) }, h('div', { class: 'en' }, 'Open ' + P.name), P.desc ? h('div', { class: 'eb' }, P.desc) : null))); return; }
        const groups = []; for (const s of P.items) { let g = groups.find((x) => x.name === (s.group || '')); if (!g) groups.push((g = { name: s.group || '', items: [] })); g.items.push(s); }
        const fold = groups.length > 1 && P.items.length > 6;
        for (const g of groups) {
          const key = `${pi}|${g.name}`, has = g.items.some(isCur), open = !fold || (key in N.open ? N.open[key] : has), list = h('div', { class: 'explist' }, ...(open ? g.items.map((s) => row(s)) : []));
          if (!fold) { body.append(groups.length > 1 || g.name ? F.section(g.name || 'Scenes', list) : list); continue; }
          body.append(h('div', { class: 'navgrp' + (open ? ' open' : '') + (has ? ' has' : '') }, h('button', { class: 'navgh', type: 'button', 'aria-expanded': String(open), onclick: () => { N.open[key] = !open; draw(); } }, h('span', { class: 'navchev' }, '›'), h('span', { class: 'navgn' }, g.name || 'Scenes'), !open ? h('span', { class: 'navpeek' }, g.items.map((s) => s.name.split(/[:—]/)[0]).join(' · ')) : null, (() => { const ns = g.items.filter((x) => MB.Solved.has(x.lab, x.id)).length; return ns ? h('span', { class: 'navnum navstar' }, `★ ${ns}`) : null; })(), h('span', { class: 'navnum' }, String(g.items.length))), list));
        }
      };
      root.innerHTML = '';
      if (fam) {
        const pi0 = N.part == null ? curPart : N.part;
        root.append(h('div', { class: 'navfam' }, h('div', { class: 'navfn' }, fam.name, h('span', { class: 'navnum' }, `${flat.length} scenes`), (() => { const ns = flat.filter((x) => MB.Solved.has(x.lab, x.id)).length; return ns ? h('span', { class: 'navnum navstar' }, `★ ${ns}`) : null; })()), h('div', { class: 'navparts', role: 'tablist' }, ...parts.map((p, i) => h('button', { class: 'navpart' + (i === pi0 ? ' on' : '') + (i === curPart ? ' cur' : '') + (p.main ? ' main' : ''), type: 'button', role: 'tab', onclick: (e) => { N.part = i; N.q = ''; if (N.input) N.input.value = ''; for (const b of e.currentTarget.parentNode.children) b.classList.toggle('on', b === e.currentTarget); draw(); } }, p.name, p.items ? h('span', { class: 'navnum' }, String(p.items.length)) : null)))));
      }
      if (flat.length > 6) {
        if (!N.input) { N.input = h('input', { type: 'search', class: 'navfind', 'aria-label': 'Find a scene' }); N.input.oninput = () => { N.q = N.input.value; if (N.redraw) N.redraw(); }; }
        N.input.placeholder = fam ? `Find in ${fam.name} …` : 'Find a scene …'; N.input.value = N.q;
        const ci = flat.findIndex(isCur), step = (d) => { const s = flat[ci + d]; if (s) pick(s); }, nb = (d, lab) => { const s = flat[ci + d]; return h('button', { class: 'icon-btn sm', type: 'button', disabled: s ? null : true, title: s ? `${lab}: ${s.name}` : null, 'aria-label': lab + ' scene', onclick: () => step(d) }, d < 0 ? '‹' : '›'); };
        root.append(h('div', { class: 'navbar' }, N.input, nb(-1, 'Previous'), h('span', { class: 'navpos' }, ci >= 0 ? `${ci + 1}/${flat.length}` : ''), nb(1, 'Next')));
      }
      N.redraw = draw; root.append(body); draw();
    },
    /* orbit camera driven by pointer: drag rotates, wheel / pinch zooms, two fingers pan */
    camera(cv, cam, onChange, opt) {
      const o = opt || {}, pts = new Map(); let pinch = null, drag = null;
      cv.style.touchAction = 'none';
      cv.addEventListener('pointerdown', (e) => {
        if (o.filter && o.filter(e) === false) return;
        cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
        if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2 }; drag = null; }
        else drag = { x: e.clientX, y: e.clientY, pan: e.shiftKey || e.button === 2 };
      });
      cv.addEventListener('pointermove', (e) => {
        if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
        if (pinch && pts.size === 2) {
          const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
          cam.dist = max(cam.min || 0.01, min(cam.max || 1e9, cam.dist * pinch.d / max(1, d)));
          if (cam.panX != null) { cam.panX -= (mx - pinch.mx) * cam.dist * 0.0025; cam.panY += (my - pinch.my) * cam.dist * 0.0025; }
          Object.assign(pinch, { d, mx, my }); onChange && onChange(); return;
        }
        if (!drag) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
        if (drag.pan && cam.panX != null) { cam.panX -= dx * cam.dist * 0.0025; cam.panY += dy * cam.dist * 0.0025; }
        else { cam.yaw -= dx * 0.006; cam.pitch = max(o.pmin != null ? o.pmin : -1.55, min(o.pmax != null ? o.pmax : 1.55, cam.pitch + dy * 0.006)); }
        onChange && onChange();
      });
      const end = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) drag = null; };
      cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
      cv.addEventListener('contextmenu', (e) => e.preventDefault());
      cv.addEventListener('wheel', (e) => { e.preventDefault(); cam.dist = max(cam.min || 0.01, min(cam.max || 1e9, cam.dist * Math.exp(e.deltaY * 0.0012))); onChange && onChange(); }, { passive: false });
    },
    /* seeded generator (mulberry32) and string → seed */
    rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; },
    seedOf(v) { const s = String(v == null ? '' : v).trim(); if (/^\d+$/.test(s)) return (+s) >>> 0; let hh = 2166136261; for (let i = 0; i < s.length; i++) { hh ^= s.charCodeAt(i); hh = Math.imul(hh, 16777619); } return hh >>> 0; },
    newSeed() { return (Math.random() * 1e9) | 0; },
    /* a seed row: text field + dice + optional copy */
    seedRow(label, get, set) {
      const inp = h('input', { class: 'field', value: String(get()), inputmode: 'numeric', 'aria-label': label });
      inp.addEventListener('change', () => set(MB.LabKit.seedOf(inp.value)));
      const dice = h('button', { class: 'btn ghost sm', type: 'button', title: 'New random seed' }, '⚄ Randomize');
      dice.onclick = () => { const s = MB.LabKit.newSeed(); inp.value = s; set(s); };
      return h('div', { class: 'seedrow' }, h('label', { class: 'flabel' }, label), inp, dice);
    },
    /* HSL → linear-ish RGB triple in 0..1 */
    hsl(hh, s, l) { hh = ((hh % 1) + 1) % 1; const a = s * Math.min(l, 1 - l), f = (n) => { const k = (n + hh * 12) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; return [f(0), f(8), f(4)]; },
    hex(c) { return '#' + c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join(''); },
    unhex(s) { const m = /^#?([0-9a-f]{6})$/i.exec(s || ''); if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; },
    swatches(cols) { return h('div', { class: 'swrow' }, ...cols.map(([nm, c]) => h('span', { class: 'swc', title: nm }, h('i', { style: `background:${MB.LabKit.hex(c)}` }), nm))); },
    text: 'rgba(235,240,255,0.82)', dim: 'rgba(235,240,255,0.45)', line: 'rgba(235,240,255,0.16)', bg: '#05070d',
    mono(c, t, x, y, size, col, align, base) { c.font = `${size || 10}px "B612 Mono", ui-monospace, monospace`; c.fillStyle = col || MB.LabKit.text; c.textAlign = align || 'left'; c.textBaseline = base || 'middle'; c.fillText(t, x, y); },
    /* dark line chart: series [{pts:[[x,y]], col, lw, dash, dots, bars (width; q[2] = colour), band, a}], o: {x0,x1,y0,y1, xt, yt, xf, yf, xl, yl, legend:[[name,col]], log} */
    chart(c, W, H, series, o) {
      const T = MB.LabKit; c.fillStyle = T.bg; c.fillRect(0, 0, W, H);
      const pl = 40, pr = 8, pt = 10, pb = 20, x0 = o.x0, x1 = o.x1, y0 = o.y0, y1 = o.y1;
      const X = (x) => pl + ((x - x0) / (x1 - x0 || 1)) * (W - pl - pr), Y = (y) => H - pb - ((y - y0) / (y1 - y0 || 1)) * (H - pt - pb);
      c.strokeStyle = T.line; c.lineWidth = 1; c.beginPath();
      for (const v of o.yt || []) { c.moveTo(pl, Math.round(Y(v)) + 0.5); c.lineTo(W - pr, Math.round(Y(v)) + 0.5); }
      for (const v of o.xt || []) { c.moveTo(Math.round(X(v)) + 0.5, pt); c.lineTo(Math.round(X(v)) + 0.5, H - pb); }
      c.stroke();
      for (const v of o.yt || []) T.mono(c, o.yf ? o.yf(v) : String(v), pl - 4, Y(v), 9, T.dim, 'right');
      for (const v of o.xt || []) T.mono(c, o.xf ? o.xf(v) : String(v), X(v), H - pb + 9, 9, T.dim, 'center');
      if (o.xl) T.mono(c, o.xl, W - pr, H - 5, 9, T.dim, 'right');
      if (o.yl) T.mono(c, o.yl, pl + 4, pt + 2, 9, T.text, 'left', 'top');
      c.save(); c.beginPath(); c.rect(pl, pt - 1, W - pl - pr, H - pt - pb + 2); c.clip();
      for (const s of series) {
        if (!s.pts || !s.pts.length) continue;
        c.save(); c.strokeStyle = c.fillStyle = s.col; c.lineWidth = s.lw || 1.4; c.globalAlpha = s.a == null ? 1 : s.a; if (s.dash) c.setLineDash(s.dash);
        if (s.band) { c.beginPath(); s.pts.forEach((q, k) => { const xx = X(q[0]), yy = Y(q[1]); k ? c.lineTo(xx, yy) : c.moveTo(xx, yy); }); for (let k = s.pts.length - 1; k >= 0; k--) c.lineTo(X(s.pts[k][0]), Y(s.pts[k][2])); c.closePath(); c.fill(); }
        else if (s.bars) { for (const q of s.pts) { const xa = X(q[0] - s.bars / 2), xb = X(q[0] + s.bars / 2), yy = Y(q[1]), yb = Y(y0); if (q[2]) c.fillStyle = q[2]; c.fillRect(xa, Math.min(yy, yb), xb - xa, Math.abs(yb - yy)); } }
        else if (s.dots) { for (const q of s.pts) { const xx = X(q[0]), yy = Y(q[1]); c.beginPath(); c.arc(xx, yy, s.dots, 0, 6.2832); c.fill(); if (q[2] != null) { c.beginPath(); c.moveTo(xx, Y(q[1] - q[2])); c.lineTo(xx, Y(q[1] + q[2])); c.stroke(); } } }
        else { c.beginPath(); s.pts.forEach((q, k) => { const xx = X(q[0]), yy = Y(q[1]); k ? c.lineTo(xx, yy) : c.moveTo(xx, yy); }); c.stroke(); }
        c.restore();
      }
      c.restore();
      if (o.legend) { let lx = W - pr - 4; for (let i = o.legend.length - 1; i >= 0; i--) { const [nm, col] = o.legend[i]; c.font = '9px "B612 Mono", ui-monospace, monospace'; const w = c.measureText(nm).width; lx -= w; T.mono(c, nm, lx, pt + 6, 9, col, 'left'); lx -= 12; } }
      return { X, Y };
    },
  };

  /* Blackbody colour: Planck spectrum × CIE 1931 colour-matching functions (multi-lobe Gaussian fit of Wyman, Sloan & Shirley 2013)
     → XYZ → linear sRGB, normalised to the brightest channel. */
  const g = (x, mu, s1, s2) => { const t = (x - mu) / (x < mu ? s1 : s2); return Math.exp(-0.5 * t * t); };
  const cmf = (l) => [1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2), 0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1), 1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8)];
  MB.blackbody = function (T) {
    let X = 0, Y = 0, Z = 0;
    for (let l = 380; l <= 780; l += 5) { const m = l * 1e-9, B = 1 / (Math.pow(m, 5) * (Math.exp(1.4388e-2 / (m * T)) - 1)), c = cmf(l); X += B * c[0]; Y += B * c[1]; Z += B * c[2]; }
    let r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z, gg = -0.9689 * X + 1.8758 * Y + 0.0415 * Z, b = 0.0557 * X - 0.204 * Y + 1.057 * Z;
    const m = Math.max(r, gg, b); r = Math.max(0, r / m); gg = Math.max(0, gg / m); b = Math.max(0, b / m);
    return [r, gg, b];
  };
})(typeof window !== 'undefined' ? window : globalThis);
