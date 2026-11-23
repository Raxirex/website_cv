/* Dynamic Interactive Labs — typeset mathematics with KaTeX (vendored in vendor/katex, loaded on first use).
   MB.Tex.el(src, display)   one formula as an element; a readable plain-text fallback until KaTeX has loaded
   MB.Tex.mixed(str, tag)    text with $inline$ and $$display$$ math (the text parts may contain HTML of our own)
   MB.Tex.calc(lines)        a calculation block: an array of LaTeX lines, aligned at their first "&" (aligned env)
   MB.Tex.typeset(root)      typesets every [data-tex] below root (used for HTML strings built elsewhere)
   Formulas are rendered once; a queue waits for the script so nothing blocks the page. */
(function (G) {
  'use strict';
  const MB = G.MB;
  const T = (MB.Tex = { ready: false, failed: false });
  let loading = false, queue = [];
  const BASE = (window.SITE_ASSET_BASE || '') + 'vendor/katex/';
  /* LaTeX → a readable fallback: drop commands that only typeset, keep symbols */
  const SYM = { '\\cdot': '·', '\\times': '×', '\\pi': 'π', '\\sigma': 'σ', '\\tau': 'τ', '\\varphi': 'φ', '\\phi': 'φ', '\\theta': 'θ', '\\lambda': 'λ', '\\chi': 'χ', '\\Phi': 'Φ', '\\Delta': 'Δ', '\\delta': 'δ', '\\alpha': 'α', '\\beta': 'β', '\\kappa': 'κ', '\\eta': 'η', '\\zeta': 'ζ', '\\varepsilon': 'ε', '\\epsilon': 'ε', '\\mu': 'μ', '\\nu': 'ν', '\\rho': 'ρ', '\\omega': 'ω', '\\Omega': 'Ω', '\\gamma': 'γ', '\\int': '∫', '\\oint': '∮', '\\sum': 'Σ', '\\partial': '∂', '\\infty': '∞', '\\approx': '≈', '\\le': '≤', '\\ge': '≥', '\\leq': '≤', '\\geq': '≥', '\\neq': '≠', '\\pm': '±', '\\to': '→', '\\Rightarrow': '⇒', '\\quad': '  ', '\\qquad': '    ', '\\,': ' ', '\\;': ' ', '\\!': '', '\\left': '', '\\right': '', '\\sqrt': '√', '\\prime': '′', '\\perp': '⊥', '\\max': 'max', '\\min': 'min', '\\sin': 'sin', '\\cos': 'cos', '\\tan': 'tan', '\\ln': 'ln', '\\exp': 'exp' };
  T.plain = (s) => String(s).replace(/\\(?:mathrm|text|mathbf|boldsymbol|operatorname)\{([^{}]*)\}/g, '$1').replace(/\\(?:d|t)?frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)').replace(/\\[a-zA-Z]+|\\[,;!]/g, (m) => (SYM[m] != null ? SYM[m] : '')).replace(/[{}]/g, '').replace(/&/g, '').replace(/\\\\/g, '; ').replace(/\^/g, '^').replace(/\s+/g, ' ').trim();
  function render(span) {
    const src = span.dataset.tex, disp = span.dataset.disp === '1';
    try { G.katex.render(src, span, { displayMode: disp, throwOnError: false, strict: 'ignore', output: 'html', trust: false }); span.classList.add('tex-ok'); if (disp) fitLater(span); }
    catch (e) { span.textContent = T.plain(src); }
  }
  /* a display formula wider than its box is scaled down (to 70 % at most); beyond that it scrolls sideways */
  let fitQ = [], fitRAF = 0;
  function fitLater(span) { fitQ.push(span); if (!fitRAF && typeof requestAnimationFrame !== 'undefined') fitRAF = requestAnimationFrame(() => { fitRAF = 0; const q = fitQ; fitQ = []; for (const s of q) T.fit(s); }); }
  T.fit = function (span) { if (!span.isConnected || span.dataset.fit) return; const cw = span.clientWidth, sw = span.scrollWidth; if (!cw) { fitQ.push(span); return; } if (sw > cw + 1) { const fs = parseFloat(getComputedStyle(span).fontSize) || 13; span.style.fontSize = `${fs * Math.max(0.7, (cw / sw) * 0.98)}px`; } span.dataset.fit = '1'; };
  T.refit = function (root) { (root || document).querySelectorAll('.tex-d.tex-ok').forEach((s) => { delete s.dataset.fit; s.style.fontSize = ''; T.fit(s); }); };
  function flush() { const q = queue; queue = []; for (const s of q) render(s); }
  T.load = function () {
    if (T.ready || loading || T.failed || typeof document === 'undefined') return; loading = true;
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = BASE + 'katex.min.css'; document.head.append(css);
    const js = document.createElement('script'); js.src = BASE + 'katex.min.js'; js.async = true;
    js.onload = () => { T.ready = !!G.katex; loading = false; if (T.ready) { flush(); document.dispatchEvent(new CustomEvent('tex-ready')); } };
    js.onerror = () => { T.failed = true; loading = false; };
    document.head.append(js);
  };
  T.el = function (src, display, cls) {
    const span = document.createElement(display ? 'div' : 'span'); span.className = 'tex' + (display ? ' tex-d' : '') + (cls ? ' ' + cls : ''); span.dataset.tex = src; span.dataset.disp = display ? '1' : '0';
    if (T.ready) render(span); else { span.textContent = T.plain(src); queue.push(span); T.load(); }
    return span;
  };
  /* text with $…$ and $$…$$; \$ is a literal dollar */
  T.mixed = function (str, tag) {
    const el = document.createElement(tag || 'div'); T.fill(el, str); return el;
  };
  T.fill = function (el, str) {
    const maths = [], html = String(str).replace(/\$\$([\s\S]+?)\$\$|\$([^$]+?)\$/g, (m, d, i) => { maths.push(d != null ? [d, true] : [i, false]); return `<span data-mi="${maths.length - 1}"></span>`; });
    const t = document.createElement('template'); t.innerHTML = html;
    t.content.querySelectorAll('[data-mi]').forEach((sp) => { const [src, disp] = maths[+sp.dataset.mi]; sp.replaceWith(T.el(src, disp)); });
    el.append(t.content); return el;
  };
  /* aligned calculation: lines joined with \\ inside an aligned environment */
  T.calc = function (lines, cls) { const L = (Array.isArray(lines) ? lines : [lines]).filter(Boolean); return T.el(L.length > 1 || /&/.test(L[0] || '') ? `\\begin{aligned}${L.join('\\\\[2pt]')}\\end{aligned}` : L[0] || '', true, cls); };
  /* HTML strings with <span data-tex="…"> placeholders */
  T.typeset = function (root) { root.querySelectorAll('[data-tex]:not(.tex-ok)').forEach((s) => { if (!s.classList.contains('tex')) s.classList.add('tex'); if (T.ready) render(s); else { if (!s.textContent) s.textContent = T.plain(s.dataset.tex); queue.push(s); T.load(); } }); };
  /* numbers for LaTeX: a real minus, ·10^{e} for small and large magnitudes, p significant digits */
  T.num = function (v, p = 4) {
    if (v == null || !isFinite(v)) return '\\text{—}'; if (v === 0) return '0';
    const a = Math.abs(v), e = Math.floor(Math.log10(a));
    if (a >= 1e-3 && a < 1e6) { const d = Math.max(0, p - 1 - e); let s = v.toFixed(d); if (d > 0) s = s.replace(/0+$/, '').replace(/\.$/, ''); return s === '-0' ? '0' : s; }
    const m = v / 10 ** e; return `${(+m.toFixed(p - 1)).toString()}\\cdot 10^{${e}}`;
  };
  /* fixed decimals */
  T.fix = function (v, d = 2) { if (v == null || !isFinite(v)) return '\\text{—}'; const a = Math.abs(v) < 0.5 * 10 ** -d ? 0 : v; return a.toFixed(d); };
})(typeof window !== 'undefined' ? window : globalThis);
