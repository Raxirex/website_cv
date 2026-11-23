/* Dynamic Interactive Labs — derivation player in the spirit of manim: formulas whose pieces move to their new places from one
   step to the next (matching by key, like manim's TransformMatchingTex), new pieces fade in, dropped ones fade out, while a
   canvas drawing advances with eased time. Built on the Web Animations API with the FLIP technique; no dependencies.

   Formula spec: a string of space-separated tokens and/or helper objects.
     'σ_x'  → σ with subscript x          'x^2'  → x with superscript 2        'σ_{xy}' braces for longer scripts
     'F@F1' → text F with explicit key F1 (otherwise the key is the text plus its occurrence number in the formula)
     D.fr(num, den)   fraction            D.mat(rows)  matrix (rows of specs)     D.sq(spec) square root
     D.c('load', spec)  coloured group (theme token)   D.b(spec) boxed result      D.sp  thin space */
(function (G) {
  'use strict';
  const MB = G.MB, F = MB.F, h = F.h;
  const { min, max } = Math;
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  /* 'σ_{xy}^2' → html */
  function tokHTML(t) {
    let out = '', i = 0;
    const take = () => { if (t[i] === '{') { const j = t.indexOf('}', i); const s = t.slice(i + 1, j < 0 ? t.length : j); i = j < 0 ? t.length : j + 1; return s; } const s = t[i]; i++; return s || ''; };
    while (i < t.length) {
      const ch = t[i];
      if (ch === '_' && i > 0) { i++; out += `<sub>${esc(take())}</sub>`; }
      else if (ch === '^' && i > 0) { i++; out += `<sup>${esc(take())}</sup>`; }
      else { out += esc(ch); i++; }
    }
    return out;
  }
  const isVar = (t) => /^[A-Za-zα-ωΑ-Ω]$/.test(t[0]) && !/^(sin|cos|tan|ln|log|exp|max|min|det|tr|d)$/.test(t.split(/[_^]/)[0]);
  const D = {
    fr: (n, d) => ({ fr: [n, d] }), mat: (rows, br) => ({ mat: rows, br: br || '[' }), sq: (s) => ({ sq: s }), c: (col, s) => ({ col, s }), b: (s) => ({ box: s }), sp: { sp: 1 },
  };
  /* build DOM for a spec; counts = key occurrence counter */
  function build(spec, counts, cls) {
    const frag = h('span', { class: 'dv-g' });
    const items = Array.isArray(spec) ? spec : [spec];
    for (const it of items) {
      if (it == null) continue;
      if (typeof it === 'string' || typeof it === 'number') {
        for (const raw of String(it).split(/\s+/).filter(Boolean)) {
          const at = raw.lastIndexOf('@'), text = at > 0 ? raw.slice(0, at) : raw, kb = at > 0 ? raw.slice(at + 1) : text;
          const n = (counts[kb] = (counts[kb] || 0) + 1), key = at > 0 ? kb : `${kb}#${n}`;
          const op = /^[=+−\-×·/<>≤≥≈→⇒⇔,;:()[\]{}|]$/.test(text) || text === '...';
          frag.append(h('span', { class: 'dv-t' + (op ? ' op' : '') + (isVar(text) && !/^\d/.test(text) ? ' v' : '') + (cls ? ' ' + cls : ''), 'data-k': key, html: tokHTML(text) }));
        }
      } else if (it.fr) { const k = `fr#${(counts.__fr = (counts.__fr || 0) + 1)}`; frag.append(h('span', { class: 'dv-frac' }, h('span', { class: 'dv-num' }, build(it.fr[0], counts, cls)), h('span', { class: 'dv-bar', 'data-k': k + 'bar' }), h('span', { class: 'dv-den' }, build(it.fr[1], counts, cls)))); }
      else if (it.mat) {
        const k = `mat#${(counts.__mat = (counts.__mat || 0) + 1)}`, cols = max(...it.mat.map((r) => r.length));
        const grid = h('span', { class: 'dv-grid', style: `grid-template-columns:repeat(${cols},auto)` }); for (const row of it.mat) for (let j = 0; j < cols; j++) grid.append(h('span', { class: 'dv-cell' }, build(row[j] == null ? '' : row[j], counts, cls)));
        frag.append(h('span', { class: 'dv-mat' + (it.br === '|' ? ' det' : '') }, h('span', { class: 'dv-br l', 'data-k': k + 'l' }), grid, h('span', { class: 'dv-br r', 'data-k': k + 'r' })));
      } else if (it.sq) { frag.append(h('span', { class: 'dv-sq' }, h('span', { class: 'dv-sqs', 'data-k': `sq#${(counts.__sq = (counts.__sq || 0) + 1)}` }, '√'), h('span', { class: 'dv-sqb' }, build(it.sq, counts, cls)))); }
      else if (it.col) frag.append(build(it.s, counts, (cls ? cls + ' ' : '') + 'dv-c-' + it.col));
      else if (it.box) frag.append(h('span', { class: 'dv-box' }, build(it.box, counts, cls)));
      else if (it.sp) frag.append(h('span', { class: 'dv-sp' }));
      else if (Array.isArray(it)) frag.append(build(it, counts, cls));
    }
    return frag;
  }
  const rectsOf = (root) => { const base = root.getBoundingClientRect(), m = new Map(); root.querySelectorAll('[data-k]').forEach((el) => { const r = el.getBoundingClientRect(); m.set(el.dataset.k, { el, x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height }); }); return m; };

  /* morph a formula box from its current content to a new spec */
  function morph(box, spec, dur) {
    const T = dur == null ? 650 : dur, old = rectsOf(box), oldHTML = box.innerHTML;
    box.innerHTML = ''; box.append(build(spec, {}));
    if (!oldHTML || !box.animate || T <= 0) return;
    const neu = rectsOf(box), base = box.getBoundingClientRect();
    for (const [k, n] of neu) {
      const o = old.get(k);
      if (o) { const dx = o.x - n.x, dy = o.y - n.y, sx = n.w > 0 && o.w > 0 && n.el.classList.contains('dv-bar') ? o.w / n.w : 1; if (dx || dy || sx !== 1) n.el.animate([{ transform: `translate(${dx}px,${dy}px) scaleX(${sx})`, transformOrigin: 'left center' }, { transform: 'none', transformOrigin: 'left center' }], { duration: T, easing: 'cubic-bezier(.65,0,.35,1)' }); }
      else n.el.animate([{ opacity: 0, transform: 'translateY(0.45em)' }, { opacity: 0, offset: 0.35 }, { opacity: 1, transform: 'none' }], { duration: T * 1.1, easing: 'ease-out' });
    }
    for (const [k, o] of old) {
      if (neu.has(k)) continue;
      const g = o.el.cloneNode(true); g.classList.add('dv-ghost'); g.style.left = o.x + 'px'; g.style.top = o.y + 'px'; g.style.width = o.w + 'px'; g.style.height = o.h + 'px'; box.append(g);
      g.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-0.5em)' }], { duration: T * 0.6, easing: 'ease-in' }).onfinish = () => g.remove();
    }
    void base;
  }

  /* player: steps = [{ t: title, f: spec, say: html, dur }], paint(ctx, W, H, k, p, time) draws the picture of step k at progress p */
  function player(o) {
    const st = { k: 0, t0: performance.now(), play: !!o.autoplay, steps: o.steps || [], paint: o.paint, raf: 0 };
    const title = h('div', { class: 'dv-title' }), box = h('div', { class: 'dv-formula' }), say = h('div', { class: 'dv-say' }), dots = h('div', { class: 'dv-dots' });
    const btn = (icon, label, fn, cls) => h('button', { class: 'btn sm ' + (cls || 'ghost'), type: 'button', title: label, onclick: fn }, F.icon(icon, 'sm'), h('span', {}, label));
    const playB = btn('i-play', 'Play', () => setPlay(!st.play));
    const bar = h('div', { class: 'dv-bar-row' }, btn('i-reset', 'Back', () => go(st.k - 1)), playB, btn('i-step', 'Next', () => go(st.k + 1), 'primary'), dots);
    const el = h('div', { class: 'dv' }, title, box, say, bar);
    function setPlay(on) { st.play = on; playB.querySelector('use').setAttribute('href', on ? '#i-pause' : '#i-play'); playB.querySelector('span').textContent = on ? 'Pause' : 'Play'; st.tk = performance.now(); }
    function render(anim) {
      const s = st.steps[st.k]; if (!s) return;
      title.innerHTML = `<b>${st.k + 1}/${st.steps.length}</b> ${s.t || ''}`; say.innerHTML = s.say || '';
      morph(box, s.f || '', anim ? s.mdur : 0);
      dots.innerHTML = ''; st.steps.forEach((_, i) => dots.append(h('button', { class: 'dv-dot' + (i === st.k ? ' on' : i < st.k ? ' done' : ''), type: 'button', 'aria-label': `step ${i + 1}`, onclick: () => go(i) })));
      if (o.onStep) o.onStep(st.k);
    }
    function go(k) { const kk = max(0, min(st.steps.length - 1, k)); if (kk === st.k && st.started) return; const anim = st.started && abs1(kk - st.k); st.k = kk; st.t0 = performance.now(); st.tk = st.t0; st.started = true; render(anim); }
    const abs1 = (d) => d === 1 || d === -1;
    /* progress of the current step's picture, eased */
    st.progress = () => { const s = st.steps[st.k] || {}, d = (s.dur || 1.4) * 1000, x = min(1, (performance.now() - st.t0) / d); return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2; };
    st.tick = () => { if (st.play && performance.now() - st.tk > ((st.steps[st.k] || {}).hold || 3.2) * 1000 + ((st.steps[st.k] || {}).dur || 1.4) * 1000) { if (st.k < st.steps.length - 1) go(st.k + 1); else setPlay(false); } };
    st.el = el; st.go = go; st.setSteps = (s) => { st.steps = s; st.k = 0; st.started = false; go(0); }; st.setPlay = setPlay;
    go(0); if (st.play) setPlay(true);
    return st;
  }
  MB.Derive = { D, player, morph, build, tokHTML };
})(typeof window !== 'undefined' ? window : globalThis);
