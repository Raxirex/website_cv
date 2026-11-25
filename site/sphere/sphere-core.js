/* The Sphere: engine.
 *
 * Packs (sphere/pack-*.js) register shapes, web (link) styles and modes with
 *   SPHERE.addShape(key, def)   SPHERE.addLink(key, draw)   SPHERE.addMode(def)
 * and the page calls SPHERE.start(container) once every pack has loaded.
 * The full contract for pack authors is in sphere/README.md.
 */
(function (global) {
  'use strict';

  const TAU = Math.PI * 2;
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));
  const STAGES = [0, 1200, 2500, 4500];
  const MIN_COUNT = 12, MAX_COUNT = 240, DEFAULT_COUNT = 80;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hsl = (c, shift, a) => `hsla(${((((c[0] + (shift || 0)) % 360) + 360) % 360).toFixed(1)},${c[1]}%,${c[2]}%,${a})`;
  const stageOf = (held) => (held > STAGES[3] ? 3 : held > STAGES[2] ? 2 : held > STAGES[1] ? 1 : 0);

  // Character ranges for "random" glyphs: Latin, Greek, Cyrillic, katakana, runes, maths, blocks, braille,
  // Devanagari, Georgian, geometric shapes, arrows.
  const GLYPH_RANGES = [[0x41, 0x5A], [0x3B1, 0x3C9], [0x410, 0x44F], [0x30A2, 0x30F3], [0x16A0, 0x16EA], [0x2200, 0x22FF],
    [0x2580, 0x259F], [0x2801, 0x28FF], [0x0905, 0x0939], [0x10D0, 0x10F0], [0x25A0, 0x25FF], [0x2190, 0x21FF]];
  function randomGlyph() { const r = pick(GLYPH_RANGES); return String.fromCodePoint(Math.floor(rand(r[0], r[1] + 1))); }

  /* ---------------- Registries ---------------- */
  // 2D packs load with the page. 3D packs load only when the 2D/3D switch is turned on; while they load,
  // SPHERE.loading3D is true and their web styles and modes go into separate registries, so a 3D pack can
  // never change how a 2D mode looks. A 3D mode with the same id as a 2D mode replaces it while 3D is on.
  const shapes = {}, links = {}, modes = [], links3d = {}, modes3d = {}, only3d = [];
  function addShape(key, def) { if (global.SPHERE.loading3D && shapes[key]) return; shapes[key] = def; }
  function addLink(key, draw) { (global.SPHERE.loading3D ? links3d : links)[key] = draw; }
  function addMode(def) {
    if (!global.SPHERE.loading3D) { modes.push(def); return; }
    def.is3D = true;
    modes3d[def.id] = def;
    if (!modes.some((m) => m.id === def.id)) only3d.push(def);
  }
  let dim3 = false; // the 2D/3D switch
  const list = () => (dim3 ? modes.map((m) => modes3d[m.id] || m).concat(only3d) : modes);

  // Points come back centred and scaled into the unit ball, with a mesh (pairs of point indexes) for wireframes.
  const shapeCache = {};
  function buildShape(key, n) {
    const def = shapes[key] || shapes.sphere;
    const ck = key + ':' + (def.fixed ? 'fixed' : n);
    if (shapeCache[ck]) return shapeCache[ck];
    let pts = (def.make(n) || []).map((p) => [p[0] || 0, p[1] || 0, p[2] || 0, p[3] || 0]);
    if (!pts.length) pts = [[0, 0, 0, 0]];
    if (!def.fixed) {
      const base = pts.length;
      while (pts.length < n) { const q = pts[pts.length % base]; pts.push([q[0] + rand(-0.01, 0.01), q[1] + rand(-0.01, 0.01), q[2] + rand(-0.01, 0.01), q[3]]); }
      pts = pts.slice(0, n);
    }
    const c = [0, 0, 0, 0];
    if (!def.noCenter) { pts.forEach((p) => p.forEach((v, j) => (c[j] += v / pts.length))); }
    let m = 0;
    pts.forEach((p) => { for (let j = 0; j < 4; j++) p[j] -= c[j]; m = Math.max(m, Math.hypot(p[0], p[1], p[2], p[3])); });
    pts.forEach((p) => { for (let j = 0; j < 4; j++) p[j] /= m || 1; });
    const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2 + (a[3] - b[3]) ** 2;
    let mesh = [];
    if (def.edgeList) mesh = def.edgeList.filter((e) => e[0] < pts.length && e[1] < pts.length);
    else if (def.edges) { // polyhedra: join every pair as close as the shortest edge
      const tol = (typeof def.edges === 'number' ? def.edges : 1.04) ** 2;
      let min = Infinity;
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const d = d2(pts[i], pts[j]); if (d > 1e-9 && d < min) min = d; }
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const d = d2(pts[i], pts[j]); if (d > 1e-9 && d <= min * tol) mesh.push([i, j]); }
    } else if (pts.length <= 260) { // two nearest neighbours of every point
      const seen = {};
      pts.forEach((p, i) => pts.map((q, j) => [j, d2(p, q)]).filter((e) => e[0] !== i).sort((a, b) => a[1] - b[1]).slice(0, 2)
        .forEach((e) => { const k = Math.min(i, e[0]) + ':' + Math.max(i, e[0]); if (!seen[k]) { seen[k] = 1; mesh.push([i, e[0]]); } }));
    }
    const out = { key, name: def.name || key, four: !!def.four, fixed: !!def.fixed, wire: !!(def.edges || def.edgeList), pts, mesh };
    shapeCache[ck] = out;
    return out;
  }

  /* ---------------- Engine ---------------- */
  function start(container) {
    if (!modes.length) return;
    const canvas = document.createElement('canvas');
    canvas.id = 'sphere-canvas';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const hud = document.createElement('div');
    hud.id = 'sphere-hud';
    hud.innerHTML = '<div class="l1"></div><div class="l2"></div><div class="l3 hint"></div>' +
      '<div class="ctl">' +
      '<button type="button" data-a="mode-1" aria-label="Previous mode">&#9664;</button><span>mode</span><button type="button" data-a="mode1" aria-label="Next mode">&#9654;</button>' +
      '<button type="button" data-a="shape-1" aria-label="Previous shape">&#9664;</button><span>shape</span><button type="button" data-a="shape1" aria-label="Next shape">&#9654;</button>' +
      '<button type="button" data-a="count-1" aria-label="Fewer letters">&minus;</button><span>letters</span><button type="button" data-a="count1" aria-label="More letters">+</button>' +
      '<button type="button" data-a="dim" aria-label="Switch between 2D and 3D">2D</button>' +
      '<button type="button" data-a="lock" aria-label="Lock the sphere again">lock</button>' +
      '</div>';
    container.appendChild(hud);
    const hudL1 = hud.querySelector('.l1'), hudL2 = hud.querySelector('.l2'), hudL3 = hud.querySelector('.l3');
    // Two stacked page-background layers that cross-fade when the mode changes (only while unlocked).
    const bgLayers = [0, 1].map(() => { const d = document.createElement('div'); d.className = 'page-bg'; document.body.prepend(d); return d; });
    let bgFront = 0;

    const reduceMotion = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const S = {
      ctx, canvas, TAU, GOLDEN, STAGES, rand, pick, clamp, hsl, randomGlyph, reduceMotion,
      W: 0, H: 0, cx: 0, cy: 0, R: 200, DPR: 1,
      nodes: [], active: [], links: [], data: {},
      ptr: { x: 0, y: 0 }, down: { x: 0, y: 0 }, holding: false, held: 0, stage: 0, seed: null,
      hueShift: 0, now: 0, dt: 16, rotX: 0.35, rotY: 0, a4: 0, a4Speed: 0.0006, spinScale: 1,
      mode: null, shape: null, countOverride: 0, infected: 0,
      ptrVel: { x: 0, y: 0 }, ptrInside: false, unlocked: false
    };
    global.SPHERE.state = S; // handy in the console
    S.container = container;
    try { S.unlocked = global.localStorage.getItem('sphere.unlocked') === '1'; } catch (err) { S.unlocked = false; }
    let unlockPresses = 0, lastLongPress = 0;

    let modeIdx = 0, shapeIdx = 0, shapeKeys = ['sphere'];
    let spinX = 0.004, spinY = 0.009, fourMix = 0;
    let rings = [], parts = [];
    let shake = 0, flash = 0, flashRGB = '255,255,255', glitchUntil = 0;
    let climaxed = false, moved = false, last = { x: 0, y: 0 };
    let lastInteract = performance.now(), lastMorph = performance.now(), tapTimer = null, lastHud = 0, hudKey = '';

    /* ---- helpers exposed to packs ---- */
    S.colorOf = (gen, a) => { const p = S.mode.palette; return hsl(p[((gen % p.length) + p.length) % p.length], S.mode.noHueShift ? 0 : S.hueShift, a); };
    S.baseColor = (a) => hsl(S.mode.base || [0, 0, 100], S.mode.noHueShift ? 0 : S.hueShift, a);
    S.spawn = (x, y, vx, vy, c, life, s, extra) => { if (parts.length < 2500) parts.push(Object.assign({ x, y, vx, vy, c, life, s, born: S.now, g: 0, drag: 0.985 }, extra || {})); };
    S.ring = (x, y, max, c, life) => rings.push({ x, y, born: S.now, max, c: c || S.mode.palette[0], life: life || 900 });
    S.flash = (a, rgb) => { if (!reduceMotion) { flash = Math.max(flash, a); flashRGB = rgb || '255,255,255'; } };
    S.shake = (a) => { if (!reduceMotion) shake = Math.max(shake, a); };
    S.glitch = (ms) => { glitchUntil = Math.max(glitchUntil, S.now + ms); };
    S.offscreen = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
    S.glyph = () => { const g = S.mode.glyphs; if (typeof g === 'function') return g(S); if (g === 'random' || !S.mode.glyphList.length) return randomGlyph(); return pick(S.mode.glyphList); };
    S.nextShape = (step) => { shapeIdx = (shapeIdx + (step || 1) + shapeKeys.length) % shapeKeys.length; loadShape(); lastMorph = S.now; };
    S.setMode = (i) => setMode(i);
    S.setCount = (n) => { S.countOverride = clamp(Math.round(n), MIN_COUNT, MAX_COUNT); loadShape(); };
    S.line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
    S.burst = (x, y, size) => burst(x, y, size);

    function resize() {
      S.DPR = Math.min(2, global.devicePixelRatio || 1);
      S.W = container.clientWidth; S.H = container.clientHeight;
      canvas.width = Math.round(S.W * S.DPR); canvas.height = Math.round(S.H * S.DPR);
      ctx.setTransform(S.DPR, 0, 0, S.DPR, 0, 0);
      S.cx = S.W / 2; S.cy = S.H / 2;
      if (S.mode && S.mode.resize) S.mode.resize(S);
      if (global.SPHERE.layer3d) global.SPHERE.layer3d.resize(S);
    }

    /* ---- nodes, shapes, modes ---- */
    function makeNode(p) { return { p: p.slice(), g: S.glyph(), scr: S.now + rand(200, 900), sx: S.cx, sy: S.cy, sc: 1, z: 0, shrink: 1, alpha: 0, inf: false, gen: 0, kids: 0, maxKids: 1, last: 0, dying: false, data: {} }; }
    function resizeNodes(n) {
      let active = S.nodes.filter((x) => !x.dying);
      if (active.length < n) {
        for (let k = active.length; k < n; k++) { const src = active.length ? pick(active).p : [0, 0, 0, 0]; S.nodes.push(makeNode(src)); }
      } else if (active.length > n) {
        active.slice(n).forEach((x) => { x.dying = true; x.inf = false; });
      }
      S.nodes.sort((a, b) => (a.dying ? 1 : 0) - (b.dying ? 1 : 0));
      S.active = S.nodes.filter((x) => !x.dying);
    }
    function loadShape() {
      const key = shapeKeys[shapeIdx];
      const def = shapes[key] || shapes.sphere;
      let n = S.countOverride || S.mode.count || DEFAULT_COUNT;
      if (n === 'random') n = Math.round(rand(30, 170));
      S.shape = buildShape(key, def.fixed ? 0 : n);
      resizeNodes(S.shape.pts.length);
      hudKey = '';
    }
    function setMode(i) {
      const now = S.now;
      if (S.mode && S.mode.exit) S.mode.exit(S);
      const prevMode = S.mode;
      const L = list();
      modeIdx = ((i % L.length) + L.length) % L.length;
      const m = L[modeIdx];
      if (!m.glyphList) m.glyphList = typeof m.glyphs === 'string' && m.glyphs !== 'random' ? Array.from(m.glyphs) : [];
      S.mode = m; S.data = {}; S.a4Speed = 0.0006; S.spinScale = 1;
      shapeKeys = (m.shapes || ['sphere']).filter((k) => shapes[k]);
      if (!shapeKeys.length) shapeKeys = ['sphere'];
      shapeIdx = 0; parts = []; lastMorph = now;
      loadShape();
      S.nodes.forEach((n) => { n.g = S.glyph(); n.scr = now + rand(200, 800); n.data = {}; });
      if (m.init) m.init(S);
      if (global.SPHERE.layer3d) global.SPHERE.layer3d.onMode(S, prevMode, m);
      burst(S.cx, S.cy, 1);
      applyPageBg();
      hudKey = '';
    }
    function applyPageBg() {
      if (!S.unlocked) { bgLayers.forEach((d) => (d.style.opacity = '0')); return; }
      const m = S.mode, h = m.palette[0][0], h2 = (m.palette[1] || m.palette[0])[0];
      const c = m.pageBg || [`hsl(${h},45%,8%)`, `hsl(${h2},45%,3%)`];
      bgFront = 1 - bgFront;
      bgLayers[bgFront].style.background = `linear-gradient(180deg, ${c[0]} 0%, ${c[1]} 100%)`;
      bgLayers[bgFront].style.opacity = '1';
      bgLayers[1 - bgFront].style.opacity = '0';
    }
    function setUnlocked(on) {
      S.unlocked = on;
      try { global.localStorage.setItem('sphere.unlocked', on ? '1' : '0'); } catch (err) { /* private mode */ }
      document.body.classList.toggle('sphere-unlocked', on);
      hud.hidden = !on;
      if (on) {
        S.flash(0.9); S.shake(16); S.glitch(600);
        [120, 260, 420, 640].forEach((r, i) => setTimeout(() => S.ring(S.cx, S.cy, r * 2, S.mode.palette[i % S.mode.palette.length], 1200), i * 120));
        for (let k = 0; k < 160; k++) { const a = rand(0, TAU), v = rand(2, 12); S.spawn(S.cx, S.cy, Math.cos(a) * v, Math.sin(a) * v, hsl([rand(0, 360), 100, 70], 0, 1), rand(800, 2200), rand(1.5, 3.5)); }
        S.nodes.forEach((n) => (n.scr = S.now + rand(300, 1500)));
        setMode(1 % list().length);
      } else {
        setMode(0);
      }
      global.dispatchEvent(new CustomEvent(on ? 'sphere:unlock' : 'sphere:lock'));
    }
    S.setUnlocked = setUnlocked;

    // 2D/3D switch. 2D is the default; the 3D packs are fetched the first time 3D is switched on.
    const dimBtn = hud.querySelector('button[data-a="dim"]');
    let loading3d = null;
    function load3dPacks() {
      if (loading3d) return loading3d;
      const base = (global.SITE_ASSET_BASE || '') + 'sphere/';
      const files = global.SPHERE.packs3d || [];
      loading3d = files.reduce((p, f) => p.then(() => new Promise((res) => {
        const s = document.createElement('script');
        s.src = base + f + (global.SITE_ASSET_VERSION ? '?v=' + global.SITE_ASSET_VERSION : ''); // CDN cache-busting
        s.onload = s.onerror = res;
        global.SPHERE.loading3D = true;
        document.head.appendChild(s);
      })), Promise.resolve()).then(() => { global.SPHERE.loading3D = false; });
      return loading3d;
    }
    function setDim(on) {
      try { global.localStorage.setItem('sphere.dim', on ? '3d' : '2d'); } catch (err) { /* private mode */ }
      const keepId = S.mode && S.mode.id;
      const apply = () => {
        dim3 = on;
        dimBtn.textContent = on ? '3D' : '2D';
        const L = list(), i = L.findIndex((m) => m.id === keepId);
        setMode(i >= 0 ? i : modeIdx);
      };
      if (on) { dimBtn.textContent = '…'; load3dPacks().then(apply); } else apply();
    }
    S.setDim = setDim;
    S.is3D = () => dim3;
    function burst(x, y, size) {
      S.ring(x, y, 260 * size, S.mode.palette[0]);
      S.flash(0.3 * size); S.shake(8 * size);
    }
    function infect(n, parent) {
      if (!n || n.inf || n.dying) return;
      n.inf = true; n.kids = 0; n.last = S.now;
      n.gen = parent ? parent.gen + 1 : 0;
      n.maxKids = parent ? 1 + Math.floor(Math.random() * 5) : 5; // every node may infect up to 5 more
      S.infected++;
      if (parent) { S.links.push({ A: parent, B: n, born: S.now, dying: 0, gen: n.gen, seed: Math.random() }); parent.kids++; parent.last = S.now; }
      if (S.mode.onInfect) S.mode.onInfect(S, n, parent);
    }

    /* ---- input ---- */
    function local(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function nearestNode(x, y) {
      let best = null, bd = Infinity;
      S.active.forEach((n) => { const d = (n.sx - x) ** 2 + (n.sy - y) ** 2; if (d < bd) { bd = d; best = n; } });
      return best;
    }
    canvas.addEventListener('pointerdown', (e) => {
      const p = local(e);
      S.ptr = p; S.down = p; last = { x: e.clientX, y: e.clientY }; moved = false;
      S.holding = true; S.holdStart = performance.now(); climaxed = false; lastInteract = S.holdStart;
      S.links.forEach((l) => { if (!l.dying) l.dying = S.now; });
      S.nodes.forEach((n) => (n.inf = false));
      S.infected = 0;
      S.seed = nearestNode(p.x, p.y);
      infect(S.seed, null);
      if (S.mode.onPress) S.mode.onPress(S, p.x, p.y);
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* not supported */ }
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = local(e);
      S.ptrVel.x += (p.x - S.ptr.x - S.ptrVel.x) * 0.5; S.ptrVel.y += (p.y - S.ptr.y - S.ptrVel.y) * 0.5;
      S.ptr = p; S.ptrInside = true;
      if (!S.holding) return;
      const dx = e.clientX - last.x, dy = e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
      if (Math.hypot(S.ptr.x - S.down.x, S.ptr.y - S.down.y) > 6) moved = true;
      S.rotY += dx * 0.005; S.rotX += dy * 0.005;
      spinY = dx * 0.002; spinX = dy * 0.002;
      lastInteract = S.now;
    });
    function endHold(quiet) {
      if (!S.holding) return;
      S.holding = false;
      const now = performance.now(), held = now - S.holdStart;
      if (!quiet && !S.unlocked) { // locked: three long presses in a row unlock the rest
        if (held >= 700) {
          unlockPresses = now - lastLongPress < 6000 ? unlockPresses + 1 : 1;
          lastLongPress = now;
          const s = S.seed || { sx: S.ptr.x, sy: S.ptr.y };
          for (let k = 0; k < unlockPresses; k++) S.ring(s.sx, s.sy, 60 + 50 * k, S.mode.palette[k % S.mode.palette.length], 700 + 200 * k);
          if (unlockPresses >= 3) { unlockPresses = 0; release(held); setUnlocked(true); }
          else release(held);
        } else unlockPresses = 0;
      } else if (!quiet && !moved && held < 250) {
        if (tapTimer) { clearTimeout(tapTimer); tapTimer = null; setMode(modeIdx + 1); }
        else {
          const x = S.ptr.x, y = S.ptr.y;
          tapTimer = setTimeout(() => {
            tapTimer = null;
            if (S.mode.onTap && S.mode.onTap(S, x, y) === false) return;
            S.nextShape(1); S.ring(x, y, 170, S.mode.palette[1 % S.mode.palette.length]);
          }, 260);
        }
      } else if (!quiet) {
        release(held);
      }
      S.nodes.forEach((n) => (n.inf = false));
      S.links.forEach((l) => { if (!l.dying) l.dying = now; });
      S.seed = null; S.infected = 0; lastInteract = now;
    }
    function release(held) {
      const power = clamp(held / 4000, 0.3, 1.5);
      if (S.mode.onRelease && S.mode.onRelease(S, held, power) === false) return;
      const s = S.seed || { sx: S.ptr.x, sy: S.ptr.y };
      S.ring(s.sx, s.sy, 220 + 260 * power, S.mode.palette[0]);
      S.active.forEach((n) => { if (n.inf) for (let k = 0; k < 4; k++) S.spawn(n.sx, n.sy, rand(-3, 3) * power, rand(-3, 3) * power, S.colorOf(n.gen, 1), rand(500, 1200), rand(1, 2.5)); });
      S.shake(6 * power); S.flash(0.22 * power);
    }
    canvas.addEventListener('pointerup', () => endHold(false));
    canvas.addEventListener('pointerleave', () => { if (!S.holding) S.ptrInside = false; });
    canvas.addEventListener('pointercancel', () => endHold(true)); // e.g. the page started scrolling on a phone
    function act(a) {
      if (!S.unlocked) return;
      lastInteract = S.now;
      if (a === 'lock') { setUnlocked(false); return; }
      if (a === 'dim') { setDim(!dim3); return; }
      if (a === 'mode1') setMode(modeIdx + 1);
      if (a === 'mode-1') setMode(modeIdx - 1);
      if (a === 'shape1') S.nextShape(1);
      if (a === 'shape-1') S.nextShape(-1);
      if (a === 'count1' || a === 'count-1') {
        const cur = S.countOverride || (typeof S.mode.count === 'number' ? S.mode.count : S.active.length);
        S.setCount(cur + (a === 'count1' ? 10 : -10));
      }
    }
    hud.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) act(b.dataset.a); });
    document.addEventListener('keydown', (e) => {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      const k = e.key;
      if (k === 'm' || k === 'M') act(e.shiftKey ? 'mode-1' : 'mode1');
      if (k === 'n' || k === 'N') act(e.shiftKey ? 'shape-1' : 'shape1');
      if (k === '+' || k === '=') act('count1');
      if (k === '-' || k === '_') act('count-1');
      if (k === 'd' || k === 'D') act('dim');
    });
    global.addEventListener('resize', resize);

    /* ---- simulation ---- */
    function update(now, dt) {
      const ease = 1 - Math.pow(0.93, dt / 16.7);
      const pts = S.shape.pts;
      S.active.forEach((n, i) => { const t = pts[i] || pts[i % pts.length]; for (let k = 0; k < 4; k++) n.p[k] += (t[k] - n.p[k]) * ease; n.alpha += (1 - n.alpha) * ease; });
      S.nodes.forEach((n) => { if (n.dying) { n.alpha -= dt / 400; for (let k = 0; k < 4; k++) n.p[k] *= 0.97; } });
      if (S.nodes.some((n) => n.dying && n.alpha <= 0)) {
        S.nodes = S.nodes.filter((n) => !(n.dying && n.alpha <= 0));
        S.links = S.links.filter((l) => S.nodes.indexOf(l.A) >= 0 && S.nodes.indexOf(l.B) >= 0);
      }
      fourMix += ((S.shape.four ? 1 : 0) - fourMix) * ease;
      if (!S.holding) {
        spinX += (0.0012 - spinX) * 0.02; spinY += (0.003 - spinY) * 0.02;
        S.rotX += spinX * S.spinScale * dt / 16.7; S.rotY += spinY * S.spinScale * dt / 16.7;
      }
      S.a4 += dt * S.a4Speed;
      if (S.holding && S.stage >= 1 && !S.mode.noHueShift) S.hueShift += dt * 0.015 * S.stage;

      if (S.holding && S.seed) { // infection: each infected node passes it to its nearest clean neighbour
        const interval = Math.max(45, 380 - S.held * 0.08);
        const allowed = 1 + S.stage * 2;
        for (const n of S.active) {
          if (!n.inf || n.kids >= Math.min(n.maxKids, allowed) || now - n.last < interval) continue;
          let best = null, bd = Infinity;
          for (const q of S.active) {
            if (q.inf) continue;
            const d = (q.p[0] - n.p[0]) ** 2 + (q.p[1] - n.p[1]) ** 2 + (q.p[2] - n.p[2]) ** 2 + (q.p[3] - n.p[3]) ** 2;
            if (d < bd) { bd = d; best = q; }
          }
          if (!best) break;
          infect(best, n);
        }
        if (!climaxed && S.infected >= S.active.length) {
          climaxed = true;
          if (!S.mode.onClimax || S.mode.onClimax(S) !== false) {
            burst(S.seed.sx, S.seed.sy, 1.4);
            S.hueShift += 50;
          }
        }
      }
      if (S.mode.update) S.mode.update(S, now, dt);
      const decay = Math.pow(0.9, dt / 16.7);
      shake *= decay; flash *= decay; S.ptrVel.x *= decay; S.ptrVel.y *= decay;
      S.R = Math.min(S.W * 0.42, S.H * 0.3) * (1 + 0.08 * Math.sin(now * 0.00021 + 1.5)) * (S.mode.scale || 1);
      project();
    }
    function project() {
      const sX = Math.sin(S.rotX), cX = Math.cos(S.rotX), sY = Math.sin(S.rotY), cY = Math.cos(S.rotY);
      const ang = S.a4 * fourMix, c4 = Math.cos(ang), s4 = Math.sin(ang), c5 = Math.cos(ang * 0.7), s5 = Math.sin(ang * 0.7);
      const warp = S.mode.warp;
      S.nodes.forEach((n) => {
        let x = n.p[0], y = n.p[1], z = n.p[2];
        const w = n.p[3];
        const x1 = x * c4 - w * s4, w1 = x * s4 + w * c4; // rotate in the xw and zw planes,
        const z1 = z * c5 - w1 * s5, w2 = z * s5 + w1 * c5; // then project 4D -> 3D
        const k = 1.6 / (1.6 - clamp(w2, -1.2, 1.2));
        x = x1 * k; y = y * k; z = z1 * k;
        const y2 = y * cX - z * sX, z2 = y * sX + z * cX;
        const x3 = x * cY + z2 * sY, z3 = -x * sY + z2 * cY;
        const sc = 2 / (2 - clamp(z3, -1.5, 1.5));
        n.rx = x3; n.ry = y2; n.rz = z3; // rotated unit coordinates, for 3D modes
        n.sx = S.cx + x3 * S.R * sc; n.sy = S.cy + y2 * S.R * sc; n.sc = sc; n.z = z3; n.shrink = 1;
        if (S.ptrInside && !S.holding) { // letters shy away from a hovering pointer
          const dx = n.sx - S.ptr.x, dy = n.sy - S.ptr.y, d = Math.hypot(dx, dy) + 0.01;
          const push = d < 90 ? (90 - d) * 0.5 : 0;
          n.hx = (n.hx || 0) + ((dx / d) * push - (n.hx || 0)) * 0.15; n.hy = (n.hy || 0) + ((dy / d) * push - (n.hy || 0)) * 0.15;
        } else { n.hx = (n.hx || 0) * 0.85; n.hy = (n.hy || 0) * 0.85; }
        n.sx += n.hx; n.sy += n.hy;
        if (warp) warp(S, n);
      });
    }

    /* ---- drawing ---- */
    function drawMesh() {
      const mesh = S.shape.mesh, act = S.active;
      if (!mesh.length) return;
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineWidth = S.shape.wire ? 1.2 : 1;
      ctx.strokeStyle = S.colorOf(0, (S.holding ? 0.32 : 0.14) * (S.shape.wire ? 1.6 : 1));
      ctx.beginPath();
      for (const e of mesh) { const a = act[e[0]], b = act[e[1]]; if (a && b) { ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); } }
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    const L = {}; // reused per link
    function drawLinks(now) {
      S.links = S.links.filter((l) => !l.dying || now - l.dying < 700);
      const m = S.mode;
      const style = m.links ? m.links[Math.min(S.stage, m.links.length - 1)] : m.link;
      const draw = (m.is3D && links3d[style]) || links[style] || links.line;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const l of S.links) {
        const A = l.A, B = l.B;
        L.grow = clamp((now - l.born) / 220, 0, 1);
        L.alpha = (l.dying ? 1 - (now - l.dying) / 700 : 1) * clamp(0.5 + 0.5 * A.sc, 0, 1) * Math.min(A.alpha, B.alpha) * (S.stage >= 1 ? 0.75 : 1);
        if (L.alpha <= 0.01) continue;
        L.ax = A.sx; L.ay = A.sy; L.fx = B.sx; L.fy = B.sy;
        L.bx = A.sx + (B.sx - A.sx) * L.grow; L.by = A.sy + (B.sy - A.sy) * L.grow;
        L.gen = l.gen; L.seed = l.seed; L.age = now - l.born; L.now = now; L.stage = S.stage; L.A = A; L.B = B; L.link = l;
        L.width = 1 + S.stage * 0.35;
        L.color = (a) => S.colorOf(l.gen, a);
        L.colorA = (a) => S.colorOf(Math.max(0, l.gen - 1), a);
        ctx.globalCompositeOperation = S.stage >= 1 ? 'lighter' : 'source-over';
        ctx.setLineDash([]);
        ctx.strokeStyle = L.color(L.alpha); ctx.fillStyle = L.color(L.alpha); ctx.lineWidth = L.width;
        draw(ctx, L, S);
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    function drawNodes(now) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const base = (16 + 8 * Math.abs(Math.sin(now * 0.0003))) * (S.mode.glyphScale || 1) * clamp(Math.sqrt(80 / Math.max(20, S.active.length)), 0.6, 1.4);
      const order = S.nodes.slice().sort((a, b) => a.z - b.z); // back to front
      const custom = S.mode.drawNode;
      for (const n of order) {
        if (n.alpha <= 0.01) continue;
        const size = base * (0.75 + 0.25 * n.sc) * n.shrink;
        const a = clamp(n.sc - 0.25, 0.3, 1) * clamp(n.alpha, 0, 1);
        const g = now < n.scr ? S.glyph() : n.g;
        if (custom && custom(S, ctx, n, g, size, a) === true) { ctx.globalCompositeOperation = 'source-over'; continue; }
        if (n.inf) {
          const glow = ctx.createRadialGradient(n.sx, n.sy, 0, n.sx, n.sy, size * 1.4);
          glow.addColorStop(0, S.colorOf(n.gen, 0.3 * a)); glow.addColorStop(1, S.colorOf(n.gen, 0));
          ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = glow;
          ctx.beginPath(); ctx.arc(n.sx, n.sy, size * 1.4, 0, TAU); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.font = `${size.toFixed(1)}px monospace`;
        ctx.fillStyle = n.inf ? S.colorOf(n.gen, a) : S.baseColor(a);
        ctx.fillText(g, n.sx, n.sy);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    function drawFx(now, dt) {
      rings = rings.filter((r) => now - r.born < r.life);
      rings.forEach((r) => {
        const t = clamp((now - r.born) / r.life, 0, 1);
        ctx.strokeStyle = hsl(r.c, S.hueShift, (1 - t) * 0.8); ctx.lineWidth = 1 + 5 * (1 - t);
        ctx.beginPath(); ctx.arc(r.x, r.y, Math.max(0, r.max * (1 - Math.pow(1 - t, 3))), 0, TAU); ctx.stroke();
      });
      parts = parts.filter((p) => now - p.born < p.life);
      ctx.globalCompositeOperation = 'lighter';
      parts.forEach((p) => {
        if (S.ptrInside) {
          const dx = p.x - S.ptr.x, dy = p.y - S.ptr.y, d2 = dx * dx + dy * dy + 100;
          if (S.holding && d2 < 90000) { const f = 60 / d2 * dt; p.vx += (-dx + dy * 0.8) * f; p.vy += (-dy - dx * 0.8) * f; }
          else if (d2 < 10000) { const f = 0.0006 * dt * (1 + Math.hypot(S.ptrVel.x, S.ptrVel.y) * 0.3); p.vx += dx * f + S.ptrVel.x * 0.02; p.vy += dy * f + S.ptrVel.y * 0.02; }
        }
        p.vy += p.g * dt / 16; p.x += p.vx * dt / 16; p.y += p.vy * dt / 16; p.vx *= p.drag; p.vy *= p.drag;
        ctx.globalAlpha = clamp(1 - (now - p.born) / p.life, 0, 1); ctx.fillStyle = p.c;
        if (p.glyph) { ctx.font = `${p.s}px monospace`; ctx.fillText(p.glyph, p.x, p.y); }
        else ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
      });
      ctx.globalAlpha = 1;
      if (S.holding) { // charge ring around the finger: how close the next stage is
        const st = S.stage, frac = st < 3 ? (S.held - STAGES[st]) / (STAGES[st + 1] - STAGES[st]) : 1;
        ctx.strokeStyle = S.colorOf(st, 0.9); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(S.ptr.x, S.ptr.y, 24, -Math.PI / 2, -Math.PI / 2 + frac * TAU); ctx.stroke();
        for (let k = 0; k < st; k++) { ctx.fillStyle = S.colorOf(k, 1); ctx.beginPath(); ctx.arc(S.ptr.x - 8 + k * 8, S.ptr.y + 34, 2.2, 0, TAU); ctx.fill(); }
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    function drawGlitch(now) {
      if (reduceMotion) return;
      const strength = now < glitchUntil ? 1 : (S.holding && S.mode.glitchy ? S.stage * 0.25 : 0);
      if (!strength || Math.random() > strength) return;
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      const count = 1 + Math.floor(Math.random() * 4 * strength);
      for (let k = 0; k < count; k++) {
        const h = Math.floor(rand(4, 40) * S.DPR), y = Math.floor(rand(0, canvas.height - h)), dx = Math.floor(rand(-50, 50) * S.DPR);
        ctx.drawImage(canvas, 0, y, canvas.width, h, dx, y, canvas.width, h);
      }
      ctx.restore();
    }
    function updateHud(now) {
      if (now - lastHud < 120) return;
      lastHud = now;
      const roman = ['', 'I', 'II', 'III'];
      let status = S.holding
        ? `INFECTED ${S.infected}/${S.active.length}${S.stage ? ' · STAGE ' + roman[S.stage] : ''}`
        : 'hold to infect · drag to spin · tap to morph · double-tap: next mode · keys M N + −';
      const extra = S.mode.hud ? S.mode.hud(S) || '' : '';
      const l1 = `>>> SPHERE // ${S.mode.name} (${modeIdx + 1}/${list().length}) ${dim3 ? '3D' : '2D'} // ${S.shape.name.toUpperCase()} · ${S.active.length}`;
      const key = l1 + status + extra;
      if (key === hudKey) return;
      hudKey = key;
      hudL1.textContent = l1; hudL2.textContent = status; hudL3.textContent = extra;
    }

    let prev = performance.now(), errors = 0;
    function frame(now) {
      requestAnimationFrame(frame); // schedule first: an error in a pack must not stop the animation
      try { step(Math.max(now, prev)); } catch (err) {
        for (let k = 0; k < 16; k++) ctx.restore(); // unwind any save() the failed frame left open
        ctx.setTransform(S.DPR, 0, 0, S.DPR, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.setLineDash([]);
        if (errors++ < 5) console.error('[sphere]', S.mode && S.mode.id, err);
      }
    }
    function step(now) {
      if (!S.mode) return;
      const dt = Math.min(50, Math.max(0, now - prev)); prev = now;
      S.now = now; S.dt = dt;
      S.held = S.holding ? now - S.holdStart : 0; S.stage = stageOf(S.held);
      update(now, dt);
      const m = S.mode;
      if (global.SPHERE.layer3d) global.SPHERE.layer3d.render(S, now, dt);
      if (m.opaque || m.three || reduceMotion) ctx.clearRect(0, 0, S.W, S.H);
      else { // fade the previous frame instead of clearing it: motion trails
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = `rgba(0,0,0,${m.fade || 0.5})`;
        ctx.fillRect(0, 0, S.W, S.H);
        ctx.globalCompositeOperation = 'source-over';
      }
      if (m.background) { m.background(S, ctx, now, dt); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
      ctx.save();
      if (shake > 0.3) ctx.translate(rand(-shake, shake), rand(-shake, shake));
      if (m.ambient) { m.ambient(S, ctx, now, dt); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
      if (m.mesh || S.shape.wire) drawMesh();
      drawLinks(now);
      if (m.under) { m.under(S, ctx, now, dt); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
      drawNodes(now);
      if (m.over) { m.over(S, ctx, now, dt); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
      drawFx(now, dt);
      ctx.restore();
      if (flash > 0.01) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(${flashRGB},${flash})`; ctx.fillRect(0, 0, S.W, S.H); ctx.globalCompositeOperation = 'source-over'; }
      drawGlitch(now);
      updateHud(now);
    }

    S.now = performance.now();
    resize();
    hud.hidden = !S.unlocked;
    document.body.classList.toggle('sphere-unlocked', S.unlocked);
    setMode(S.unlocked ? 1 % list().length : 0);
    if (S.unlocked) global.dispatchEvent(new CustomEvent('sphere:unlock'));
    try { if (S.unlocked && global.localStorage.getItem('sphere.dim') === '3d') setDim(true); } catch (err) { /* private mode */ }
    S.nodes.forEach((n) => { n.p = n.p.map((v) => v * 0.02); }); // start collapsed: the sphere unfolds on load
    requestAnimationFrame(frame);
  }

  global.SPHERE = { addShape, addLink, addMode, start, shapes, links, modes, links3d, modes3d, only3d, buildShape, util: { TAU, GOLDEN, rand, pick, clamp, hsl, randomGlyph } };
})(window);
