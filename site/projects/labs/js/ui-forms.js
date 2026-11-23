/* Dynamic Interactive Labs — small DOM toolkit: elements, numeric fields with expressions + scrubbing */
(function (G) {
  'use strict';
  const MB = G.MB;
  const F = (MB.F = {});

  F.h = function (tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'style') el.style.cssText = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
    return el;
  };
  F.icon = (id, cls) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('class', 'ico' + (cls ? ' ' + cls : ''));
    const u = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    u.setAttribute('href', '#' + id); s.append(u); return s;
  };

  /* Expression evaluator: numbers, + − * / ^, parentheses, pi, g, sqrt sin cos tan abs exp ln log deg rad */
  MB.evalExpr = function (src, vars) {
    const s = String(src).replace(/,/g, '.').replace(/×/g, '*').replace(/−/g, '-').trim();
    if (!s) return NaN;
    let i = 0;
    const V = Object.assign({ pi: Math.PI, π: Math.PI }, vars || {});
    const fn = { sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, abs: Math.abs, exp: Math.exp, ln: Math.log, log: Math.log10, deg: (x) => (x * 180) / Math.PI, rad: (x) => (x * Math.PI) / 180 };
    const ws = () => { while (s[i] === ' ') i++; };
    const num = () => {
      ws();
      const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i));
      if (m) { i += m[0].length; return parseFloat(m[0]); }
      const w = /^[a-zπ_]+/i.exec(s.slice(i));
      if (w) {
        i += w[0].length; const name = w[0].toLowerCase();
        if (fn[name]) { ws(); if (s[i] !== '(') throw 0; i++; const a = add(); ws(); if (s[i] !== ')') throw 0; i++; return fn[name](a); }
        if (name in V) return V[name];
        throw 0;
      }
      if (s[i] === '(') { i++; const a = add(); ws(); if (s[i] !== ')') throw 0; i++; return a; }
      throw 0;
    };
    const unary = () => { ws(); if (s[i] === '-') { i++; return -unary(); } if (s[i] === '+') { i++; return unary(); } return pow(); };
    const pow = () => { const b = num(); ws(); if (s[i] === '^') { i++; return Math.pow(b, unary()); } return b; };
    const mul = () => { let a = unary(); for (;;) { ws(); if (s[i] === '*') { i++; a *= unary(); } else if (s[i] === '/') { i++; a /= unary(); } else return a; } };
    const add = () => { let a = mul(); for (;;) { ws(); if (s[i] === '+') { i++; a += mul(); } else if (s[i] === '-') { i++; a -= mul(); } else return a; } };
    try { const r = add(); ws(); return i === s.length ? r : NaN; } catch (e) { return NaN; }
  };

  F.fmtNum = (v) => {
    if (!Number.isFinite(v)) return '';
    if (v === 0) return '0';
    const a = Math.abs(v);
    if (a >= 1e6 || a < 1e-4) return v.toExponential(4).replace(/\.?0+e/, 'e');
    return String(parseFloat(v.toPrecision(6)));
  };

  /* Numeric field. o: {label, unit, get, set, live, min, max, step, hint, id} */
  F.num = function (o) {
    const app = MB.app;
    const input = F.h('input', { class: 'field', inputmode: 'decimal', id: o.id || null, value: F.fmtNum(o.get()), 'aria-label': o.aria || o.label, enterkeyhint: 'done', autocomplete: 'off' });
    const lab = F.h('label', { class: 'flabel' + (o.noScrub ? '' : ' scrub'), for: o.id || null, title: o.hint || (o.noScrub ? '' : 'Drag sideways to adjust') }, F.h('span', { html: o.label }), o.unit ? F.h('span', { class: 'u' }, o.unit) : null);
    const apply = (v, commitOpts) => {
      if (!Number.isFinite(v)) return false;
      if (o.min != null && v < o.min) v = o.min;
      if (o.max != null && v > o.max) v = o.max;
      o.set(v);
      return commitOpts;
    };
    input.addEventListener('change', () => {
      const v = MB.evalExpr(input.value, { g: app.model.settings.g });
      if (!Number.isFinite(v)) { input.classList.add('bad'); return; }
      input.classList.remove('bad');
      app.edit(() => apply(v), { live: o.live });
      input.value = F.fmtNum(o.get());
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const cur = o.get(), st = o.step || Math.max(1e-3, Math.pow(10, Math.floor(Math.log10(Math.abs(cur) || 1)) - 1));
        app.edit(() => apply(cur + (e.key === 'ArrowUp' ? st : -st) * (e.shiftKey ? 10 : 1)), { live: o.live });
        input.value = F.fmtNum(o.get());
      }
    });
    if (!o.noScrub) {
      let sx = 0, v0 = 0, before = null, moved = false;
      lab.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        sx = e.clientX; v0 = o.get(); before = JSON.stringify(app.model); moved = false;
        lab.setPointerCapture(e.pointerId); e.preventDefault();
      });
      lab.addEventListener('pointermove', (e) => {
        if (before == null) return;
        const dx = e.clientX - sx;
        if (!moved && Math.abs(dx) < 3) return;
        moved = true;
        const st = o.step || Math.max(1e-3, Math.abs(v0) * 0.005);
        apply(v0 + dx * st * (e.shiftKey ? 0.1 : 1));
        input.value = F.fmtNum(o.get());
        app.liveTweak(o.live);
      });
      const end = () => {
        if (before == null) return;
        if (moved) app.commit(before, { live: o.live, keepPanel: true }); else input.focus();
        before = null;
      };
      lab.addEventListener('pointerup', end); lab.addEventListener('pointercancel', end);
    }
    return [lab, input];
  };

  F.text = function (o) {
    const input = F.h('input', { class: 'field text', value: o.get(), id: o.id || null, 'aria-label': o.label, autocomplete: 'off' });
    input.addEventListener('change', () => MB.app.edit(() => o.set(input.value.trim() || o.get()), {}));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
    return [F.h('label', { class: 'flabel', for: o.id || null, html: o.label }), input];
  };

  F.seg = function (o) {
    const wrap = F.h('div', { class: 'seg' + (o.small ? ' sm' : '') + (o.wrap ? ' wrap' : ''), role: 'group', 'aria-label': o.label || '' });
    for (const [val, txt] of o.options) {
      const b = F.h('button', { class: o.get() === val ? 'on' : '', type: 'button', html: txt });
      b.addEventListener('click', () => { if (o.get() === val) return; MB.app.edit(() => o.set(val), { live: o.live }); });
      wrap.append(b);
    }
    return wrap;
  };

  F.toggle = function (o) {
    const cb = F.h('input', { type: 'checkbox', id: o.id || null });
    cb.checked = !!o.get();
    cb.addEventListener('change', () => MB.app.edit(() => o.set(cb.checked), { live: o.live }));
    return F.h('label', { class: 'switch' }, cb, F.h('span', { html: o.label }));
  };

  F.section = (title, ...kids) => F.h('div', { class: 'section' }, F.h('div', { class: 'eyebrow' }, title), ...kids);
  F.fields = (...pairs) => F.h('div', { class: 'fields' }, ...pairs.flat());
  F.btn = (label, onclick, cls, icon) => F.h('button', { class: 'btn ' + (cls || ''), type: 'button', onclick }, icon ? F.icon(icon, 'sm') : null, label);
  F.kv = (rows) => F.h('div', { class: 'kv' }, ...rows.map(([k, key, unit]) => [F.h('span', { class: 'k', html: k }), F.h('span', { class: 'v', 'data-live': key, 'data-unit': unit || '' }, '—')]).flat());
})(typeof window !== 'undefined' ? window : globalThis);
