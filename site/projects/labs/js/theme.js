/* Dynamic Interactive Labs — modular themes: presets are slider sets; sliders generate every colour token;
   single tokens can be overridden; the whole state is editable as JSON and exportable as CSS. */
(function (G) {
  'use strict';
  const MB = (G.MB = G.MB || {});
  const KEY = 'pdl.theme.v1';
  const TOK = ['paper', 'panel', 'panel-2', 'field', 'line', 'ink', 'ink-2', 'ink-3', 'body', 'body-2', 'accent', 'accent-ink', 'accent-soft',
    'load', 'react', 'warn', 'grid', 'grid-major', 'rope-gap', 'plot1', 'plot2', 'plot3', 'plot4', 'plot5', 'plot6'];

  /* Slider set: hue/sat of background, its lightness, contrast, accent hue/sat, part tint, grid strength, line weight */
  const PRESETS = {
    auto: { name: 'Auto (follows system)', s: null },
    drafting: { name: 'Drafting', s: { bgH: 200, bgS: 9, bgL: 94, con: 1, accH: 216, accS: 81, bodyS: 7, grid: 1, lw: 1 } },
    night: { name: 'Drafting night', s: { bgH: 205, bgS: 14, bgL: 8, con: 1, accH: 214, accS: 84, bodyS: 10, grid: 1, lw: 1 } },
    blueprint: { name: 'Blueprint', s: { bgH: 214, bgS: 62, bgL: 24, con: 1.1, accH: 48, accS: 95, bodyS: 35, grid: 1.6, lw: 1 } },
    graphite: { name: 'Graphite & amber', s: { bgH: 30, bgS: 6, bgL: 11, con: 1, accH: 36, accS: 92, bodyS: 8, grid: 0.8, lw: 1.1 } },
    chalk: { name: 'Chalkboard', s: { bgH: 150, bgS: 22, bgL: 17, con: 1.05, accH: 52, accS: 90, bodyS: 15, grid: 0.7, lw: 1.3 } },
    print: { name: 'High contrast print', s: { bgH: 0, bgS: 0, bgL: 100, con: 1.4, accH: 222, accS: 100, bodyS: 0, grid: 0.9, lw: 1.35 } },
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hsl = (h, s, l, a) => (a == null ? `hsl(${Math.round(((h % 360) + 360) % 360)} ${clamp(s, 0, 100).toFixed(0)}% ${clamp(l, 0, 100).toFixed(1)}%)` : `hsl(${Math.round(((h % 360) + 360) % 360)} ${clamp(s, 0, 100).toFixed(0)}% ${clamp(l, 0, 100).toFixed(1)}% / ${a})`);

  function generate(s) {
    const dark = s.bgL < 50, d = dark ? 1 : -1, c = s.con;
    const L = s.bgL, inkL = dark ? clamp(L + 82 * c, 0, 98) : clamp(L - 85 * c, 2, 100);
    const t = {
      paper: hsl(s.bgH, s.bgS, L),
      panel: hsl(s.bgH, s.bgS, clamp(L + (dark ? 3.5 : 3), 0, 100)),
      'panel-2': hsl(s.bgH, s.bgS, clamp(L + d * 7, 0, 100)),
      field: hsl(s.bgH, s.bgS, dark ? clamp(L + 1, 0, 100) : 100),
      line: hsl(s.bgH, Math.max(4, s.bgS), clamp(L + d * 15 * c, 0, 100)),
      ink: hsl(s.bgH, Math.min(s.bgS, 18), inkL),
      'ink-2': hsl(s.bgH, Math.min(s.bgS, 14), clamp(L + d * 55 * c, 0, 100)),
      'ink-3': hsl(s.bgH, Math.min(s.bgS, 10), clamp(L + d * 40 * c, 0, 100)),
      body: hsl(s.bgH, s.bodyS, dark ? clamp(L + 24, 0, 100) : clamp(L - 15, 0, 100)),
      'body-2': hsl(s.bgH, s.bodyS, dark ? clamp(L + 30, 0, 100) : clamp(L - 21, 0, 100)),
      accent: hsl(s.accH, s.accS, dark ? 64 : 42),
      'accent-ink': dark ? hsl(s.accH, 60, 10) : '#ffffff',
      'accent-soft': hsl(s.accH, s.accS, dark ? 64 : 42, 0.15),
      load: hsl(6, 72, dark ? 66 : 47),
      react: hsl(150, 52, dark ? 56 : 31),
      warn: hsl(36, 85, dark ? 58 : 35),
      grid: hsl(s.bgH, 10, dark ? 90 : 10, (0.05 * s.grid).toFixed(3)),
      'grid-major': hsl(s.bgH, 10, dark ? 90 : 10, (0.11 * s.grid).toFixed(3)),
      'rope-gap': hsl(s.bgH, s.bgS, dark ? L : clamp(L + 3, 0, 100)),
    };
    [0, 160, 110, 40, 270, 320].forEach((o, i) => (t['plot' + (i + 1)] = hsl(s.accH + o, Math.max(55, s.accS * 0.8), dark ? 64 : 42)));
    return t;
  }

  const Th = (MB.Theme = {
    TOK, PRESETS, generate,
    state: { preset: 'auto', sliders: null, overrides: {} },
    lwScale: 1,
    load() { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && typeof s === 'object') this.state = Object.assign({ preset: 'auto', sliders: null, overrides: {} }, s); } catch (e) { /* storage unavailable */ } },
    save() { try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch (e) { /* storage unavailable */ } },
    tokens() {
      const st = this.state, s = st.sliders || (PRESETS[st.preset] && PRESETS[st.preset].s);
      if (!s) return null;
      return Object.assign(generate(s), st.overrides || {});
    },
    apply() {
      const root = document.documentElement, t = this.tokens();
      TOK.forEach((k) => root.style.removeProperty('--' + k));
      root.style.removeProperty('color-scheme');
      const st = this.state, s = st.sliders || (PRESETS[st.preset] && PRESETS[st.preset].s);
      this.lwScale = s ? s.lw || 1 : 1;
      if (t) {
        for (const k of TOK) if (t[k]) root.style.setProperty('--' + k, t[k]);
        root.style.setProperty('color-scheme', s.bgL < 50 ? 'dark' : 'light');
      } else if (st.overrides && Object.keys(st.overrides).length) {
        for (const k of Object.keys(st.overrides)) root.style.setProperty('--' + k, st.overrides[k]);
      }
      if (MB.R && MB.R.readTokens) MB.R.readTokens();
      (this.listeners || []).forEach((f) => f());
    },
    onChange(f) { (this.listeners = this.listeners || []).push(f); },
    css() {
      const cs = getComputedStyle(document.documentElement);
      return ':root {\n' + TOK.map((k) => `  --${k}: ${cs.getPropertyValue('--' + k).trim()};`).join('\n') + '\n}';
    },
    current() { const st = this.state; return st.sliders || (PRESETS[st.preset] && PRESETS[st.preset].s) || Object.assign({}, PRESETS[matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'drafting'].s); },
  });

  /* Line weights on a canvas follow the theme's line-weight slider */
  MB.patchLineWidth = function (ctx) {
    const proto = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'lineWidth');
    if (!proto || ctx.__lwPatched) return;
    Object.defineProperty(ctx, 'lineWidth', { configurable: true, get() { return proto.get.call(this) / (Th.lwScale || 1); }, set(v) { proto.set.call(this, v * (Th.lwScale || 1)); } });
    ctx.__lwPatched = true;
  };

  /* ---------------- drawer UI ---------------- */
  Th.render = function (root) {
    const F = MB.F, h = F.h;
    root.innerHTML = '';
    const st = this.state, cur = this.current();
    root.append(h('div', { class: 'sheet-head' }, h('h2', {}, 'Theme'), h('button', { class: 'icon-btn', title: 'Close', onclick: () => Th.close() }, F.icon('i-close'))));
    root.append(h('p', { class: 'sheet-note' }, 'Pick a preset, shape it with the sliders, override single colours, or edit the JSON. Saved in this browser.'));
    const grid = h('div', { class: 'theme-grid' });
    for (const [id, p] of Object.entries(PRESETS)) {
      const t = p.s ? generate(p.s) : null;
      const sw = h('button', { class: 'theme-card' + (st.preset === id && !st.sliders ? ' on' : ''), type: 'button', onclick: () => { st.preset = id; st.sliders = null; st.overrides = {}; Th.apply(); Th.save(); Th.render(root); } },
        h('span', { class: 'theme-sw', style: t ? `background:${t.paper};border-color:${t.line}` : 'background:linear-gradient(135deg,#eef1f2 50%,#111518 50%)' },
          t ? h('span', { style: `background:${t.body};border:1.5px solid ${t.ink}` }) : null, t ? h('i', { style: `background:${t.accent}` }) : null),
        h('span', { class: 'theme-nm' }, p.name));
      grid.append(sw);
    }
    root.append(grid);
    const sl = (key, label, min, max, step) => {
      const inp = h('input', { type: 'range', min, max, step, value: cur[key], 'aria-label': label });
      const val = h('span', { class: 'num' }, String(cur[key]));
      inp.addEventListener('input', () => { const s = Object.assign({}, Th.current()); s[key] = +inp.value; st.sliders = s; val.textContent = inp.value; Th.apply(); });
      inp.addEventListener('change', () => { Th.save(); Th.render(root); });
      return h('label', { class: 'theme-sl' }, h('span', {}, label), inp, val);
    };
    root.append(F.section('Shape it', h('div', { class: 'theme-sls' },
      sl('bgL', 'Background lightness', 0, 100, 1), sl('bgH', 'Background hue', 0, 360, 1), sl('bgS', 'Background saturation', 0, 80, 1),
      sl('con', 'Contrast', 0.6, 1.5, 0.05), sl('accH', 'Accent hue', 0, 360, 1), sl('accS', 'Accent saturation', 0, 100, 1),
      sl('bodyS', 'Part tint', 0, 60, 1), sl('grid', 'Grid strength', 0, 3, 0.1), sl('lw', 'Line weight', 0.6, 2.2, 0.05))));
    const tok = this.tokens() || {};
    const cs = getComputedStyle(document.documentElement);
    const list = h('div', { class: 'theme-toks' });
    TOK.filter((k) => !['accent-soft', 'grid', 'grid-major'].includes(k)).forEach((k) => {
      const v = (st.overrides && st.overrides[k]) || tok[k] || cs.getPropertyValue('--' + k).trim();
      const ci = h('input', { type: 'color', value: toHex(v), 'aria-label': k });
      ci.addEventListener('input', () => { st.overrides = Object.assign({}, st.overrides, { [k]: ci.value }); if (!st.sliders && st.preset === 'auto') st.sliders = Object.assign({}, Th.current()); Th.apply(); });
      ci.addEventListener('change', () => Th.save());
      list.append(h('label', { class: 'theme-tok' + (st.overrides && st.overrides[k] ? ' set' : '') }, ci, h('span', {}, k)));
    });
    root.append(F.section('Single colours', list, h('div', { class: 'row', style: 'margin-top:8px' }, F.btn('Clear overrides', () => { st.overrides = {}; Th.apply(); Th.save(); Th.render(root); }, 'ghost'))));
    const ta = h('textarea', { class: 'field', rows: 7, id: 'theme-json' });
    ta.value = JSON.stringify(st, null, 1);
    root.append(F.section('JSON & CSS', ta, h('div', { class: 'row', style: 'margin-top:8px' },
      F.btn('Apply JSON', () => { try { const o = JSON.parse(ta.value); Th.state = Object.assign({ preset: 'auto', sliders: null, overrides: {} }, o); Th.apply(); Th.save(); Th.render(root); MB.app && MB.app.toast && MB.app.toast('Theme applied'); } catch (e) { MB.app.toast('That JSON could not be read'); } }, 'primary'),
      F.btn('Copy JSON', () => MB.copyText(JSON.stringify(Th.state, null, 1), ta)),
      F.btn('Copy CSS', () => MB.copyText(Th.css(), ta))),
      h('p', { class: 'note' }, 'The CSS block is the full token set; paste it into app.css to make it the default when you host the files yourself.')));
  };
  function toHex(v) {
    const c = document.createElement('canvas').getContext('2d');
    c.fillStyle = '#000'; c.fillStyle = v; const s = c.fillStyle;
    if (s.startsWith('#')) return s.length === 7 ? s : '#000000';
    const m = s.match(/\d+(\.\d+)?/g); if (!m) return '#000000';
    return '#' + m.slice(0, 3).map((x) => Math.round(+x).toString(16).padStart(2, '0')).join('');
  }
  Th.open = function () { const sc = document.getElementById('themeScrim'); Th.render(document.getElementById('themeSheet')); sc.hidden = false; };
  Th.close = function () { document.getElementById('themeScrim').hidden = true; };

  MB.copyText = function (text, fallback) {
    const ok = () => MB.app && MB.app.toast && MB.app.toast('Copied to the clipboard');
    const fb = () => { if (fallback) { fallback.value = text; fallback.focus(); fallback.select(); } MB.app && MB.app.toast && MB.app.toast('Selected the text; copy it with your system shortcut'); };
    try { navigator.clipboard.writeText(text).then(ok, fb); } catch (e) { fb(); }
  };

  Th.load();
})(typeof window !== 'undefined' ? window : globalThis);
