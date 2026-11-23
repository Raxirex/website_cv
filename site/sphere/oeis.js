/* OEIS ticker: a random (or chosen) integer sequence scrolling along the bottom of the page, shown once the
 * sphere is unlocked. Everything runs in the browser: the sequences come from a static library file
 * (sphere/oeis-library.json, fetched once from oeis.org when the site was built; OEIS data is CC BY-SA 4.0),
 * and if that file cannot be loaded a few classics are computed locally. Nothing is requested from oeis.org
 * at run time and the site's server does no work for it. */
(function () {
  'use strict';
  const bar = document.getElementById('oeis-bar');
  if (!bar) return;
  const pickEl = document.getElementById('oeis-pick'), randomEl = document.getElementById('oeis-random');
  const nameEl = document.getElementById('oeis-name'), track = document.getElementById('oeis-track');
  const LIBRARY = (window.SITE_ASSET_BASE || '') + 'sphere/oeis-library.json';
  let library = null; // [{ id, name, terms, famous }]

  const FAMOUS = [
    ['A000045', 'Fibonacci numbers'], ['A000040', 'The prime numbers'], ['A000108', 'Catalan numbers'],
    ['A000110', 'Bell numbers'], ['A000041', 'Partition numbers'], ['A005132', "Recamán's sequence"],
    ['A005150', 'Look and Say'], ['A006577', 'Collatz: steps to reach 1'], ['A000142', 'Factorials'],
    ['A000079', 'Powers of 2'], ['A000217', 'Triangular numbers'], ['A000290', 'Squares'],
    ['A001113', 'Decimal expansion of e'], ['A000796', 'Decimal expansion of π'], ['A001622', 'Decimal expansion of φ'],
    ['A000032', 'Lucas numbers'], ['A001006', 'Motzkin numbers'], ['A000073', 'Tribonacci numbers'],
    ['A002113', 'Palindromes in base 10'], ['A000043', 'Mersenne exponents'], ['A000396', 'Perfect numbers'],
    ['A001358', 'Semiprimes'], ['A007318', "Pascal's triangle read by rows"], ['A000010', "Euler's totient φ(n)"],
    ['A003215', 'Hex numbers'], ['A001045', 'Jacobsthal numbers'], ['A000984', 'Central binomial coefficients'],
    ['A000578', 'Cubes'], ['A001097', 'Twin primes'], ['A000594', "Ramanujan's tau function"]
  ];

  // Local fallbacks, computed here, for when the relay cannot be reached.
  const LOCAL = {
    A000045: () => { const a = [0n, 1n]; while (a.length < 60) a.push(a[a.length - 1] + a[a.length - 2]); return a; },
    A000040: () => { const p = []; for (let n = 2; p.length < 80; n++) if (p.every((q) => q * q > n || n % q)) p.push(n); return p; },
    A000108: () => { const c = [1n]; for (let n = 0; c.length < 40; n++) c.push(c[n] * 2n * (2n * BigInt(n) + 1n) / (BigInt(n) + 2n)); return c; },
    A000142: () => { const f = [1n]; for (let n = 1; f.length < 30; n++) f.push(f[n - 1] * BigInt(n)); return f; },
    A000079: () => Array.from({ length: 64 }, (_, i) => 2n ** BigInt(i)),
    A000217: () => Array.from({ length: 80 }, (_, n) => n * (n + 1) / 2),
    A000290: () => Array.from({ length: 80 }, (_, n) => n * n),
    A005132: () => { const a = [0], seen = new Set([0]); for (let n = 1; a.length < 80; n++) { let v = a[n - 1] - n; if (v < 0 || seen.has(v)) v = a[n - 1] + n; a.push(v); seen.add(v); } return a; },
    A006577: () => Array.from({ length: 80 }, (_, i) => { let n = i + 1, s = 0; while (n !== 1) { n = n % 2 ? 3 * n + 1 : n / 2; s++; } return s; }),
    A000032: () => { const a = [2n, 1n]; while (a.length < 60) a.push(a[a.length - 1] + a[a.length - 2]); return a; },
    A000073: () => { const a = [0n, 0n, 1n]; while (a.length < 60) a.push(a[a.length - 1] + a[a.length - 2] + a[a.length - 3]); return a; }
  };
  const nameOf = (id) => { const f = FAMOUS.find((x) => x[0] === id); return f ? f[1] : ''; };

  function fillPicker(list) {
    pickEl.replaceChildren();
    const groups = [['Famous', list.filter((x) => x.famous)], ['Random finds', list.filter((x) => !x.famous)]];
    groups.forEach(([label, items]) => {
      if (!items.length) return;
      const g = document.createElement('optgroup'); g.label = label;
      items.forEach((x) => { const o = document.createElement('option'); o.value = x.id; o.textContent = `${x.id} · ${x.name.slice(0, 60)}`; g.appendChild(o); });
      pickEl.appendChild(g);
    });
  }
  fillPicker(FAMOUS.map(([id, name]) => ({ id, name, famous: true })));

  function show(seq) {
    nameEl.textContent = `${seq.id} · ${seq.name}`;
    nameEl.href = `https://oeis.org/${seq.id}`;
    track.replaceChildren();
    seq.terms.forEach((t, i) => {
      if (i) { const sep = document.createElement('span'); sep.textContent = '·'; track.appendChild(sep); }
      track.appendChild(document.createTextNode(String(t)));
    });
    const len = seq.terms.join(' ').length;
    track.style.setProperty('--dur', `${Math.max(20, len * 0.22).toFixed(0)}s`);
    track.style.animation = 'none'; void track.offsetWidth; track.style.animation = ''; // restart the scroll
    if ([...pickEl.options].some((o) => o.value === seq.id)) pickEl.value = seq.id;
  }
  async function getLibrary() {
    if (library) return library;
    const r = await fetch(LIBRARY);
    if (!r.ok) throw new Error(r.status);
    const json = await r.json();
    library = (json.sequences || []).filter((x) => x && x.id && Array.isArray(x.terms) && x.terms.length);
    if (!library.length) throw new Error('empty library');
    fillPicker(library);
    return library;
  }
  async function load(id) {
    try {
      const lib = await getLibrary();
      const seq = id ? lib.find((x) => x.id === id) : lib[Math.floor(Math.random() * lib.length)];
      if (!seq) throw new Error('not in library');
      show(seq);
    } catch (err) {
      const ids = Object.keys(LOCAL), use = id && LOCAL[id] ? id : ids[Math.floor(Math.random() * ids.length)];
      show({ id: use, name: nameOf(use) + ' (computed locally)', terms: LOCAL[use]() });
    }
  }
  pickEl.addEventListener('change', () => load(pickEl.value));
  randomEl.addEventListener('click', () => load(null));
  let started = false;
  function start() { if (!started) { started = true; load(null); } }
  window.addEventListener('sphere:unlock', start);
  if (document.body.classList.contains('sphere-unlocked')) start();
})();
