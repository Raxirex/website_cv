/* Dynamic Interactive Labs — the slider row of the Chaos lab's panel kit (chaos-ui.js), which the Strength of Materials lab
   uses; the Chaos lab itself is not part of this build. */
(function (G) {
  'use strict';
  const MB = G.MB, F = MB.F, h = F.h;
  const { abs } = Math;
  function sliderRow(q, get, set, commit) {
    const fmt = (v) => (abs(v) >= 100 ? v.toFixed(1) : +v.toPrecision(6) + '');
    const val = h('input', { class: 'field num-in', value: fmt(get()), inputmode: 'decimal', 'aria-label': q.l });
    const inp = h('input', { type: 'range', min: q.min, max: q.max, step: q.step || 0.001, value: get(), 'aria-label': q.l });
    inp.addEventListener('input', () => { set(+inp.value); val.value = fmt(+inp.value); });
    inp.addEventListener('change', () => commit && commit(+inp.value));
    val.addEventListener('change', () => { const v = MB.evalExpr ? MB.evalExpr(val.value, {}) : +val.value; if (!isFinite(v)) return; set(v); inp.value = v; val.value = fmt(v); if (commit) commit(v); });
    return h('label', { class: 'theme-sl chaos-sl' }, h('span', { html: q.l }), inp, val);
  }
  MB.ChaosKit = MB.ChaosKit || { sliderRow };
})(typeof window !== 'undefined' ? window : globalThis);
