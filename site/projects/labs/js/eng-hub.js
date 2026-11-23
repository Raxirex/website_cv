/* Dynamic Interactive Labs — Math: the derivation notes the labs link to (math-notes.js), typeset with KaTeX.
   Trimmed from the Engineering hub: the curriculum map, the Index and the other labs' notes are not part of this build.
   Route: #eng-math (the list), opened from a lab with MB.Eng.openNote(topic, { lab, scene, label }). */
(function (G) {
  'use strict';
  const MB = G.MB, F = MB.F, h = F.h;
  const pill = () => h('span', { class: 'pill ok' }, 'Built');
  const hasLab = (id) => (MB.suite.mods || []).some((m) => m.id === id);
  const NOTES = () => (MB.MathNotes ? MB.MathNotes.list : []);
  const openNote = (id, from) => MB.suite.go('eng-math', { topic: id, from: from || null });
  function trackMath(root) {
    const o = MB.suite.opts || {}, note = o.topic && MB.MathNotes && MB.MathNotes.byId(o.topic);
    if (note) return mathNote(root, note, o.from);
    root.append(h('div', { class: 'eng-top' }, F.btn('All simulations', () => MB.suite.go('home'), 'ghost', 'i-home'), h('div', { class: 'eyebrow' }, 'Math'), h('h1', {}, 'Where the formulas come from'), h('p', { class: 'lede' }, 'The formulas the labs use, each derived step by step and reachable from the lab with one click.')));
    const notes = NOTES();
    if (notes.length) root.append(h('section', { class: 'eng-mod' }, h('div', { class: 'eng-mh' }, h('h2', {}, 'Where the formulas come from'), h('span', { class: 'eng-when' }, `${notes.length} derivations, linked from the labs`)),
      h('div', { class: 'eng-topics' }, ...notes.map((n) => h('div', { class: 'eng-topic link', role: 'button', tabindex: 0, onclick: () => openNote(n.id), onkeydown: (e) => { if (e.key === 'Enter') openNote(n.id); } }, h('div', { class: 'et' }, n.title, h('span', { class: 'en' }, `${n.area} · used in ${n.used.map((u) => u[0]).join(', ')}`)), pill('built'))))));
  }
  /* one derivation note, typeset; back to the lab it was opened from */
  function mathNote(root, n, from) {
    const labName = (id) => { const m = (MB.suite.mods || []).find((x) => x.id === id); return m ? m.name : id; };
    const backs = h('div', { class: 'row', style: 'gap:8px;flex-wrap:wrap' },
      from && from.lab ? F.btn(`Back to ${from.label || labName(from.lab)}`, () => MB.suite.go(from.lab, from.scene ? { scene: from.scene } : null), 'primary', 'i-chev-l') : null,
      F.btn('All Math topics', () => MB.suite.go('eng-math', {}), from && from.lab ? 'ghost' : 'primary', 'i-home'));
    root.append(h('div', { class: 'eng-top' }, backs, h('div', { class: 'eyebrow' }, `Math · ${n.area}`), h('h1', {}, n.title)));
    const art = h('article', { class: 'mathnote theory' }); MB.Tex.fill(art, n.body); root.append(art);
    const list = NOTES(), k = list.indexOf(n);
    root.append(h('section', { class: 'eng-sec' }, h('h2', {}, 'Used in'), h('div', { class: 'row', style: 'gap:8px;flex-wrap:wrap' }, ...n.used.filter((u) => hasLab(u[1])).map(([t, lab, scene]) => F.btn(t, () => MB.suite.go(lab, scene ? { scene } : null), '', null))),
      h('div', { class: 'row', style: 'gap:8px;margin-top:14px;flex-wrap:wrap' }, k > 0 ? F.btn(`← ${list[k - 1].title}`, () => openNote(list[k - 1].id, from), 'ghost', null) : null, k < list.length - 1 ? F.btn(`${list[k + 1].title} →`, () => openNote(list[k + 1].id, from), 'ghost', null) : null)));
  }
  MB.Eng = {
    render(id) {
      const root = document.querySelector('#view-eng'); root.innerHTML = ''; const wrap = h('div', { class: 'home eng' }); root.append(wrap);
      trackMath(wrap);
      window.scrollTo(0, 0);
    },
    title() { return 'Math'; },
    openNote,
  };
})(typeof window !== 'undefined' ? window : globalThis);
