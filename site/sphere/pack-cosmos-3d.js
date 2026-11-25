/* The Sphere: cosmos pack. Deep field with a black hole that really lenses, a galaxy cluster merger,
 * a star-forming nebula with a supernova, and an animatic orrery. Everything is procedural. */
(function (SP) {
  'use strict';
  const { TAU, rand, pick, clamp } = SP.util;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const gauss = () => (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 1.73; // ~N(0,1)
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  const sci = (v) => { const e = Math.floor(Math.log10(v)), m = v / Math.pow(10, e); return m.toFixed(1) + '×10' + String(e).split('').map((d) => SUP[+d] || '⁻').join(''); };
  const big = (v) => Math.round(v).toLocaleString('en-US');
  // A throw inside a hook would stop the engine's animation loop for good, so every hook here is guarded.
  const addMode = (def) => {
    Object.keys(def).forEach((k) => {
      const f = def[k];
      if (typeof f !== 'function') return;
      let warned = false;
      def[k] = function () { try { return f.apply(this, arguments); } catch (err) { if (!warned) { warned = true; console.error('[pack-cosmos] ' + def.id + '.' + k, err); } return k === 'drawNode' ? true : undefined; } };
    });
    SP.addMode(def);
  };

  /* ---------------- Stars: blackbody colours, sprites with JWST diffraction spikes ---------------- */
  // Approximate sRGB of blackbodies from ~3000 K (M) to ~30000 K (O), slightly saturated for the screen.
  const BB = [[255, 158, 80], [255, 196, 140], [255, 222, 186], [255, 241, 228], [238, 240, 255], [210, 222, 255], [186, 205, 255], [160, 188, 255]];
  const BB_W = [0.17, 0.2, 0.2, 0.16, 0.11, 0.08, 0.05, 0.03];
  const bbBin = () => { let u = Math.random(); for (let i = 0; i < BB_W.length; i++) { u -= BB_W[i]; if (u <= 0) return i; } return 3; };
  const rgb = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  let STAR = null, SPIKE = null;
  function starSprites() {
    if (STAR) return;
    STAR = BB.map((c) => {
      const s = mk(64, 64), g = s.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.07, rgb(c, 1)); gr.addColorStop(0.16, rgb(c, 0.45));
      gr.addColorStop(0.38, rgb(c, 0.1)); gr.addColorStop(1, rgb(c, 0));
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return s;
    });
    SPIKE = BB.map((c, i) => {
      const s = mk(256, 256), g = s.getContext('2d'), h = 128;
      g.globalCompositeOperation = 'lighter'; g.translate(h, h);
      const spike = (ang, len, w, a) => { // a thin tapered ray
        g.save(); g.rotate(ang);
        const gr = g.createLinearGradient(0, 0, len, 0);
        gr.addColorStop(0, rgb(c, a)); gr.addColorStop(0.25, rgb(c, a * 0.35)); gr.addColorStop(1, rgb(c, 0));
        g.fillStyle = gr; g.beginPath(); g.moveTo(0, -w); g.lineTo(len, 0); g.lineTo(0, w); g.closePath(); g.fill();
        g.restore();
      };
      for (let k = 0; k < 6; k++) spike(Math.PI / 2 + k * TAU / 6, h * 0.98, 2.2, 0.9); // the six big JWST spikes
      spike(0, h * 0.45, 1.2, 0.5); spike(Math.PI, h * 0.45, 1.2, 0.5); // and the two small struts
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, h * 0.32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.08, rgb(c, 1)); gr.addColorStop(0.3, rgb(c, 0.3)); gr.addColorStop(1, rgb(c, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, h * 0.32, 0, TAU); g.fill();
      return s;
    });
  }
  // A drifting population of foreground stars that black holes and shock waves can push around.
  function makeStars(S, n, spikes) {
    starSprites();
    const out = [];
    for (let i = 0; i < n; i++) {
      const f = Math.pow(Math.random(), 3.2), x = rand(0, S.W), y = rand(0, S.H);
      out.push({ hx: x, hy: y, x, y, vx: 0, vy: 0, bin: bbBin(), f, r: 1.2 + 7 * Math.pow(f, 0.8), spike: false, alive: true, a: 1, tw: rand(0, TAU), respawn: 0 });
    }
    out.sort((a, b) => b.f - a.f).slice(0, spikes).forEach((s) => { s.spike = true; s.r = Math.max(s.r, 5) * rand(1, 1.5); s.bin = Math.min(7, s.bin + 2); });
    return out;
  }
  const pvel = (S) => S.ptrVel || { x: 0, y: 0 };
  // Moves stars (or galaxy objects): gravity toward `pull`, a spring home otherwise, and a shove from a swiping pointer.
  // pull: {x, y, G, soft, swirl, swallow, lin (1/r instead of 1/r²), range (no pull beyond), keep (no respawn while held)}
  // opt: {px, py (pointer in the objects' coordinates), push (strength)}
  function stepStars(S, stars, dt, pull, opt) {
    const drag = Math.pow(0.975, dt / 16.7), v = pvel(S), sp0 = Math.hypot(v.x, v.y), PR = 140;
    const px = opt && opt.px !== undefined ? opt.px : S.ptr.x, py = opt && opt.py !== undefined ? opt.py : S.ptr.y, push = (opt && opt.push) || 1;
    const eaten = [];
    for (const s of stars) {
      if (!s.alive) { if (S.now > s.respawn) { s.alive = true; s.x = s.hx; s.y = s.hy; s.vx = s.vy = 0; s.a = 0; } continue; }
      s.a = Math.min(1, s.a + dt / 900);
      if (pull) {
        const dx = pull.x - s.x, dy = pull.y - s.y, d2 = dx * dx + dy * dy, d = Math.sqrt(d2) + 1e-3;
        let acc = pull.lin ? pull.G / (d + pull.soft) : pull.G / (d2 + pull.soft * pull.soft);
        if (pull.range) acc *= 1 - smooth(pull.range * 0.7, pull.range, d);
        s.vx += (dx / d - pull.swirl * dy / d) * acc * dt; s.vy += (dy / d + pull.swirl * dx / d) * acc * dt;
        if (pull.swallow && d < pull.swallow) { s.alive = false; s.respawn = pull.keep ? Infinity : S.now + rand(2500, 6000); eaten.push(s); continue; }
      } else { s.vx += (s.hx - s.x) * 1.4e-6 * dt; s.vy += (s.hy - s.y) * 1.4e-6 * dt; }
      if (sp0 > 0.4) { // a swipe drags things along and parts them
        const ex = s.x - px, ey = s.y - py, e2 = ex * ex + ey * ey;
        if (e2 < PR * PR) { const e = Math.sqrt(e2) + 1e-3, f = (1 - e / PR) * push * dt / 16.7; s.vx += (v.x * 0.0011 + ex / e * sp0 * 0.0006) * f; s.vy += (v.y * 0.0011 + ey / e * sp0 * 0.0006) * f; }
      }
      s.vx *= drag; s.vy *= drag;
      const sp = Math.hypot(s.vx, s.vy); if (sp > 2.5) { s.vx *= 2.5 / sp; s.vy *= 2.5 / sp; }
      s.x += s.vx * dt; s.y += s.vy * dt;
    }
    return eaten;
  }
  function drawStars(S, ctx, stars, now, hole) { // hole: {x, y, k} stretches stars radially near it
    ctx.globalCompositeOperation = 'lighter';
    for (const s of stars) {
      if (!s.alive) continue;
      const a = s.a * (0.82 + 0.18 * Math.sin(s.tw + now * 0.0025 * (1 + s.bin * 0.2)));
      const spr = s.spike ? SPIKE[s.bin] : STAR[s.bin], R = s.spike ? s.r * 7 : s.r * 2.2;
      let st = 1;
      if (hole) { const d = Math.hypot(s.x - hole.x, s.y - hole.y); st = 1 + Math.min(5, (hole.k / (d + 1)) ** 2); }
      ctx.globalAlpha = clamp(a, 0, 1);
      if (st < 1.05) ctx.drawImage(spr, s.x - R, s.y - R, R * 2, R * 2);
      else {
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(Math.atan2(s.y - hole.y, s.x - hole.x)); ctx.scale(st, 1 / Math.sqrt(st));
        ctx.drawImage(spr, -R, -R, R * 2, R * 2); ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------- FX: hextech shards, anime sparkles, shimmer trails, starbursts, impact frames ---------------- */
  const FXC = ['255,212,120', '110,220,255', '255,120,225', '185,140,255', '255,255,255'];
  let SPARK = null;
  function sparkSprites() {
    if (SPARK) return;
    SPARK = FXC.map((c) => {
      const s = mk(64, 64), g = s.getContext('2d');
      g.translate(32, 32); g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 16); gr.addColorStop(0, `rgba(${c},0.8)`); gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr; g.fillRect(-16, -16, 32, 32);
      const star = (L, w, rot, col) => { // a four-point sparkle with concave sides
        g.save(); g.rotate(rot); g.beginPath();
        for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; if (!k) g.moveTo(Math.cos(a) * L, Math.sin(a) * L); const b = a + Math.PI / 2; g.quadraticCurveTo(Math.cos(a + Math.PI / 4) * w, Math.sin(a + Math.PI / 4) * w, Math.cos(b) * L, Math.sin(b) * L); }
        g.fillStyle = col; g.fill(); g.restore();
      };
      star(31, 3, 0, `rgba(${c},0.85)`); star(14, 2, Math.PI / 4, `rgba(${c},0.6)`); star(18, 1.4, 0, 'rgba(255,255,255,0.95)');
      return s;
    });
  }
  function fx(D) { if (!D.fx) { D.fx = []; D.bursts = []; D.impact = null; sparkSprites(); } return D.fx; }
  // kinds: 0 spark, 1 shard (hextech crystal), 2 trail (shimmer / speed line)
  function fxAdd(D, kind, x, y, vx, vy, life, size, col, extra) { const F = fx(D); if (F.length < 600) F.push(Object.assign({ k: kind, x, y, vx, vy, born: performance.now(), life, s: size, c: col, rot: rand(0, TAU), vr: rand(-0.01, 0.01), drag: 0.985, tw: rand(0, TAU), pull: 0 }, extra || {})); }
  function fxBurst(D, x, y, R, col, life) { fx(D); D.bursts.push({ x, y, R, c: col, born: performance.now(), life: life || 700, rays: Array.from({ length: 16 }, () => [rand(0, TAU), rand(0.35, 1), rand(0.02, 0.06)]) }); }
  function fxImpact(S, D, x, y) { if (!S.reduceMotion) { fx(D); D.impact = { x, y, born: performance.now() }; } }
  function fxStep(S, D, dt, hole) { // hole: {x, y, G, r} pulls (and eats) fx particles
    const F = fx(D), now = performance.now(), v = pvel(S), sp0 = Math.hypot(v.x, v.y), P = S.ptr;
    let j = 0;
    for (let i = 0; i < F.length; i++) {
      const p = F[i];
      if (now - p.born > p.life) continue;
      if (hole && p.pull) {
        const dx = hole.x - p.x, dy = hole.y - p.y, d = Math.hypot(dx, dy) + 1e-3, acc = hole.G / (d + 20) * p.pull;
        p.vx += (dx / d - 0.8 * dy / d) * acc * dt; p.vy += (dy / d + 0.8 * dx / d) * acc * dt;
        if (d < hole.r) continue;
      }
      if (sp0 > 0.4) { const ex = p.x - P.x, ey = p.y - P.y, e2 = ex * ex + ey * ey; if (e2 < 14400) { const f = (1 - Math.sqrt(e2) / 120) * dt / 16.7; p.vx += v.x * 0.004 * f; p.vy += v.y * 0.004 * f; } }
      const dr = Math.pow(p.drag, dt / 16.7); p.vx *= dr; p.vy *= dr; if (p.g) p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      F[j++] = p;
    }
    F.length = j;
    if (!S.holding && sp0 > 7 && Math.random() < 0.6) fxAdd(D, Math.random() < 0.7 ? 0 : 2, P.x + rand(-6, 6), P.y + rand(-6, 6), v.x * 0.01 + rand(-0.03, 0.03), v.y * 0.01 + rand(-0.03, 0.03), rand(400, 900), rand(5, 11), pick([1, 2, 3, 0])); // pointer shimmer
  }
  function fxDraw(S, ctx, D) {
    const F = fx(D), now = performance.now();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of F) {
      const t = (now - p.born) / p.life, a = (1 - t) * (t < 0.1 ? t * 10 : 1);
      if (p.k === 0) {
        const s = p.s * (0.65 + 0.35 * Math.sin(p.tw + now * 0.02)) * (1 - t * 0.5);
        ctx.globalAlpha = a; ctx.drawImage(SPARK[p.c], p.x - s, p.y - s, s * 2, s * 2);
      } else if (p.k === 1) {
        const c = Math.cos(p.rot), sn = Math.sin(p.rot), L = p.s, w = p.s * 0.3;
        ctx.globalAlpha = 1; ctx.fillStyle = `rgba(${FXC[p.c]},${0.7 * a})`;
        ctx.beginPath(); ctx.moveTo(p.x - sn * L, p.y + c * L); ctx.lineTo(p.x + c * w, p.y + sn * w); ctx.lineTo(p.x + sn * L, p.y - c * L); ctx.lineTo(p.x - c * w, p.y - sn * w); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = `rgba(255,250,235,${0.65 * a * (0.6 + 0.4 * Math.sin(p.tw + now * 0.03))})`; ctx.lineWidth = 0.8; ctx.stroke();
      } else {
        const k = p.tail || 40;
        ctx.globalAlpha = 1; ctx.strokeStyle = `rgba(${FXC[p.c]},${a * (p.flat ? 0.5 : 0.35 + 0.4 * Math.random())})`; ctx.lineWidth = p.s * 0.25;
        ctx.beginPath(); ctx.moveTo(p.x - p.vx * k, p.y - p.vy * k); ctx.lineTo(p.x, p.y); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    D.bursts = D.bursts.filter((b) => now - b.born < b.life);
    for (const b of D.bursts) { // anime starburst: jagged rays and a ring
      const t = (now - b.born) / b.life, e = 1 - Math.pow(1 - t, 3), a = 1 - t;
      ctx.fillStyle = `rgba(${FXC[b.c]},${0.55 * a})`; ctx.beginPath();
      for (const r of b.rays) { const L = b.R * r[1] * e, r0 = b.R * 0.08 * e; ctx.moveTo(b.x + Math.cos(r[0] - r[2]) * r0, b.y + Math.sin(r[0] - r[2]) * r0); ctx.lineTo(b.x + Math.cos(r[0]) * L, b.y + Math.sin(r[0]) * L); ctx.lineTo(b.x + Math.cos(r[0] + r[2]) * r0, b.y + Math.sin(r[0] + r[2]) * r0); }
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${0.6 * a})`; ctx.lineWidth = 2 * a + 0.5; ctx.beginPath(); ctx.arc(b.x, b.y, b.R * 0.55 * e, 0, TAU); ctx.stroke();
    }
    const I = D.impact;
    if (I) { // manga impact frame: a split second of dark screen and converging speed lines
      const t = (now - I.born) / 220;
      if (t >= 1) D.impact = null;
      else {
        const W = S.W, H = S.H, L = Math.hypot(W, H), a = 1 - t;
        ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = `rgba(0,0,0,${0.5 * a})`; ctx.fillRect(-20, -20, W + 40, H + 40);
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,255,255,${0.55 * a})`; ctx.beginPath();
        for (let k = 0; k < 90; k++) { const ang = (k + Math.random() * 0.6) * TAU / 90, r0 = Math.min(W, H) * rand(0.12, 0.3), w = rand(0.002, 0.009); ctx.moveTo(I.x + Math.cos(ang) * r0, I.y + Math.sin(ang) * r0); ctx.lineTo(I.x + Math.cos(ang - w) * L, I.y + Math.sin(ang - w) * L); ctx.lineTo(I.x + Math.cos(ang + w) * L, I.y + Math.sin(ang + w) * L); }
        ctx.fill();
      }
    }
  }
  // A swipe of the pointer through a painted background leaves a short-lived wake that parts it.
  function wakeStep(S, D) {
    const v = pvel(S), sp = Math.hypot(v.x, v.y);
    if (!D.wakes) D.wakes = [];
    if (!S.holding && sp > 3 && S.now - (D.wakeT || 0) > 50) { D.wakeT = S.now; D.wakes.push({ x: S.ptr.x, y: S.ptr.y, t: S.now, r: clamp(30 + sp * 4, 45, 150) }); if (D.wakes.length > 6) D.wakes.shift(); }
  }
  function wakeDraw(S, ctx, D, img, k, ox, oy, amp) {
    if (!D.wakes) return;
    for (const w of D.wakes) {
      const age = (S.now - w.t) / 1100; if (age >= 1) continue;
      const r = w.r * (0.7 + 0.6 * age), A = amp * (1 - age) * (1 - age), radii = geo(r * 0.15, r, 7, []); radii.push(r);
      remap(ctx, img, k, ox, oy, w.x, w.y, radii, (th) => 1 - (1 - Math.pow(th / r, 0.6)) * A);
    }
  }
  // Letters get shoved by a swipe too.
  function swipeNode(S, n) {
    const d = n.data, v = pvel(S), sp = Math.hypot(v.x, v.y);
    if (d.swx === undefined) { d.swx = 0; d.swy = 0; }
    if (!S.holding && sp > 1) { const dx = n.sx - S.ptr.x, dy = n.sy - S.ptr.y, e2 = dx * dx + dy * dy; if (e2 < 14400) { const f = 1 - Math.sqrt(e2) / 120; d.swx = clamp(d.swx + v.x * 0.3 * f, -160, 160); d.swy = clamp(d.swy + v.y * 0.3 * f, -160, 160); } }
    const k = Math.pow(0.93, S.dt / 16.7); d.swx *= k; d.swy *= k; n.sx += d.swx; n.sy += d.swy;
  }

  const GLYPHS = {};
  function glyphSprite(g, col) {
    const key = g + col;
    if (!GLYPHS[key]) { const c = mk(64, 64), x = c.getContext('2d'); x.font = '44px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = `rgb(${col})`; x.fillText(g, 32, 33); GLYPHS[key] = c; }
    return GLYPHS[key];
  }
  /* ---------------- Galaxy sprites ---------------- */
  function spiralSprite(sz, minPitch) {
    const c = mk(sz, sz), g = c.getContext('2d'), h = sz / 2, R = h * 0.94, dot = sz / 128;
    const arms = pick([2, 2, 2, 3, 4]), b = rand(minPitch || 0.2, 0.4), r0 = R * rand(0.08, 0.15), th0 = rand(0, TAU), tmax = Math.log(R / r0) / b;
    const blue = rand(0.7, 1.15);
    g.globalCompositeOperation = 'lighter';
    let gr = g.createRadialGradient(h, h, 0, h, h, R);
    gr.addColorStop(0, 'rgba(255,236,205,0.55)'); gr.addColorStop(0.3, 'rgba(170,190,255,0.16)'); gr.addColorStop(1, 'rgba(110,140,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, sz, sz);
    for (let i = 0; i < sz * 5; i++) { // flocculent disk stars
      const r = R * Math.pow(Math.random(), 0.75), a = rand(0, TAU), d = dot * rand(0.8, 2);
      g.fillStyle = `rgba(175,198,255,${rand(0.03, 0.08)})`; g.fillRect(h + Math.cos(a) * r, h + Math.sin(a) * r, d, d);
    }
    for (let k = 0; k < arms; k++) {
      const off = th0 + k * TAU / arms;
      for (let t = 0; t < tmax; t += 0.035) {
        const r = r0 * Math.exp(b * t), a = off + t, fr = r / R, sp = r * 0.085 + dot * 1.5;
        for (let j = 0; j < 3; j++) {
          const d = dot * rand(1, 2.4);
          g.fillStyle = `rgba(${(150 + 70 * (1 - fr)) | 0},${(185 + 45 * (1 - fr)) | 0},255,${0.14 * blue * (1 - fr * 0.55)})`;
          g.fillRect(h + Math.cos(a) * r + gauss() * sp, h + Math.sin(a) * r + gauss() * sp, d, d);
        }
        if (fr > 0.2 && Math.random() < 0.07) { // HII regions: pink knots with a hot core
          const x = h + Math.cos(a + 0.04) * r + gauss() * r * 0.04, y = h + Math.sin(a + 0.04) * r + gauss() * r * 0.04, d = dot * rand(1.1, 2.4);
          g.fillStyle = 'rgba(255,105,190,0.55)'; g.beginPath(); g.arc(x, y, d, 0, TAU); g.fill();
          g.fillStyle = 'rgba(255,225,250,0.7)'; g.fillRect(x - d * 0.35, y - d * 0.35, d * 0.7, d * 0.7);
        } else if (fr > 0.15 && Math.random() < 0.05) {
          g.fillStyle = 'rgba(190,215,255,0.5)'; g.beginPath(); g.arc(h + Math.cos(a) * r, h + Math.sin(a) * r, dot * rand(0.8, 1.6), 0, TAU); g.fill();
        }
      }
    }
    g.globalCompositeOperation = 'destination-out'; g.lineCap = 'round'; // dust lanes on the inner edge of each arm
    for (let k = 0; k < arms; k++) {
      const off = th0 + k * TAU / arms;
      let px = null, py = null;
      for (let t = 0.6; t < tmax; t += 0.05) {
        const r = r0 * Math.exp(b * t) * 0.87, a = off + t, x = h + Math.cos(a) * r, y = h + Math.sin(a) * r, fr = r / R;
        if (px !== null) { g.strokeStyle = `rgba(0,0,0,${0.42 * (1 - fr * 0.6)})`; g.lineWidth = r * 0.06 + dot; g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke(); }
        px = x; py = y;
      }
    }
    g.globalCompositeOperation = 'lighter';
    const rb = R * rand(0.13, 0.24);
    if (Math.random() < 0.35) { // a bar
      g.save(); g.translate(h, h); g.rotate(th0); g.scale(2.4, 0.55);
      gr = g.createRadialGradient(0, 0, 0, 0, 0, rb); gr.addColorStop(0, 'rgba(255,225,170,0.6)'); gr.addColorStop(1, 'rgba(255,200,130,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rb, 0, TAU); g.fill(); g.restore();
    }
    gr = g.createRadialGradient(h, h, 0, h, h, rb);
    gr.addColorStop(0, 'rgba(255,252,240,1)'); gr.addColorStop(0.14, 'rgba(255,232,180,0.9)'); gr.addColorStop(0.45, 'rgba(255,200,120,0.35)'); gr.addColorStop(1, 'rgba(255,180,100,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(h, h, rb, 0, TAU); g.fill();
    return c;
  }
  function edgeOn(src) { // the same galaxy with a dust lane, for high inclinations
    const sz = src.width, c = mk(sz, sz), g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 3; k++) { g.fillStyle = 'rgba(0,0,0,0.33)'; g.beginPath(); g.ellipse(sz / 2, sz * 0.515, sz * (0.46 - k * 0.06), sz * (0.05 - k * 0.013), 0, 0, TAU); g.fill(); }
    return c;
  }
  function blobSprite(sz, core, col, mid) {
    const c = mk(sz, sz), g = c.getContext('2d'), h = sz / 2, gr = g.createRadialGradient(h, h, 0, h, h, h);
    gr.addColorStop(0, `rgba(${core},1)`); gr.addColorStop(0.05, `rgba(${col},0.9)`); gr.addColorStop(0.2, `rgba(${col},${mid})`);
    gr.addColorStop(0.5, `rgba(${col},${mid * 0.22})`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, sz, sz); return c;
  }
  function irregularSprite(sz) {
    const c = mk(sz, sz), g = c.getContext('2d'), h = sz / 2;
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 7; k++) {
      const x = h + gauss() * sz * 0.12, y = h + gauss() * sz * 0.12, r = sz * rand(0.06, 0.2), gr = g.createRadialGradient(x, y, 0, x, y, r);
      const pink = Math.random() < 0.3;
      gr.addColorStop(0, pink ? 'rgba(255,150,220,0.7)' : 'rgba(190,210,255,0.7)'); gr.addColorStop(1, 'rgba(140,170,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    return c;
  }
  let LIB = null;
  function galaxyLib() {
    if (LIB) return LIB;
    const sp = Array.from({ length: 10 }, () => spiralSprite(128));
    LIB = {
      sp, spE: sp.map(edgeOn), hero: [spiralSprite(320, 0.3), spiralSprite(256, 0.3)],
      el: [blobSprite(96, '255,250,236', '255,214,160', 0.42), blobSprite(96, '255,246,225', '255,200,140', 0.4), blobSprite(96, '255,252,240', '250,226,192', 0.45)],
      red: [blobSprite(32, '255,180,130', '255,110,60', 0.5), blobSprite(32, '255,200,150', '255,140,70', 0.5), blobSprite(32, '255,160,110', '230,80,50', 0.5)],
      irr: [irregularSprite(64), irregularSprite(64), irregularSprite(64)]
    };
    return LIB;
  }
  function drawGal(g, spr, x, y, size, rot, q, alpha) {
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(1, q); g.globalAlpha = alpha;
    g.drawImage(spr, -size / 2, -size / 2, size, size); g.restore();
  }
  function galaxySpec(s, lib) {
    const q = rand(0.12, 1), rot = rand(0, TAU), i = Math.floor(rand(0, 10));
    if (s > 16 ? Math.random() < 0.62 : Math.random() < 0.45) return { spr: q < 0.35 ? lib.spE[i] : lib.sp[i], size: s, rot, q, al: rand(0.75, 1) };
    if (Math.random() < 0.8) return { spr: pick(lib.el), size: s * 1.3, rot, q: rand(0.45, 1), al: rand(0.6, 1) };
    return { spr: pick(lib.irr), size: s, rot, q: rand(0.5, 1), al: rand(0.6, 1) };
  }
  function galObj(x, y, sp) { return Object.assign({ hx: x, hy: y, x, y, vx: 0, vy: 0, alive: true, a: 1, respawn: 0 }, sp); }
  // The Hubble/JWST deep field. `density` thins it out (for the cluster's background).
  function paintDeepField(S, g, density, objs) { // objs: if given, galaxies bigger than ~9 px become movable objects
    const W = S.W, H = S.H, A = W * H, lib = galaxyLib(), u = Math.min(W, H);
    g.globalCompositeOperation = 'source-over'; g.fillStyle = '#020308'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 4; k++) { // very faint large-scale glow so it isn't flat black
      const x = rand(0, W), y = rand(0, H), r = rand(0.4, 0.8) * Math.max(W, H), gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, pick(['rgba(30,40,80,0.13)', 'rgba(60,35,70,0.08)', 'rgba(20,45,60,0.1)'])); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    for (let i = 0; i < A / 650 * density; i++) { const f = Math.pow(Math.random(), 3), c = BB[bbBin()], d = 0.5 + 1.1 * f; g.fillStyle = rgb(c, 0.12 + 0.6 * f); g.fillRect(rand(0, W), rand(0, H), d, d); }
    for (let i = 0; i < A / 1500 * density; i++) drawGal(g, Math.random() < 0.8 ? pick(lib.red) : pick(lib.irr), rand(0, W), rand(0, H), rand(1.6, 5.5), rand(0, TAU), rand(0.4, 1), rand(0.5, 0.95));
    const clumps = Array.from({ length: 6 }, () => [rand(0, W), rand(0, H)]);
    let n = 0;
    for (let i = 0; i < A / 4200 * density; i++, n++) {
      const s = Math.min(u * 0.11, 4.5 * Math.pow(1 - Math.random(), -1 / 1.45));
      let x = rand(0, W), y = rand(0, H);
      if (Math.random() < 0.35) { const c = pick(clumps); x = c[0] + gauss() * u * 0.08; y = c[1] + gauss() * u * 0.08; }
      const sp = galaxySpec(s, lib);
      if (objs && s > 9) objs.push(galObj(x, y, sp)); else drawGal(g, sp.spr, x, y, sp.size, sp.rot, sp.q, sp.al);
    }
    return n;
  }

  /* ---------------- Lensing: redraw a disc of the background in concentric clipped annuli ---------------- */
  // img pixel = (p - o) * k for an unlensed screen point p (css px). For each annulus [a, b] the image at radius θ
  // shows the source at radius β = s(θ)·θ, which is a plain scale by 1/s about the centre.
  function remap(ctx, img, k, ox, oy, hx, hy, radii, sOf) {
    const iw = img.width, ih = img.height;
    for (let i = 0; i < radii.length - 1; i++) {
      const a = radii[i], b = radii[i + 1];
      let s = sOf(a > 0 ? Math.sqrt(a * b) : b * 0.5);
      if (Math.abs(s) < 0.025) s = s < 0 ? -0.025 : 0.025;
      if (Math.abs(s - 1) < 0.002) continue;
      const rs = Math.abs(s) * b + 2;
      const x0 = Math.max(0, (hx - rs - ox) * k), y0 = Math.max(0, (hy - rs - oy) * k), x1 = Math.min(iw, (hx + rs - ox) * k), y1 = Math.min(ih, (hy + rs - oy) * k);
      if (x1 - x0 < 1 || y1 - y0 < 1) continue;
      ctx.save();
      ctx.beginPath(); ctx.arc(hx, hy, b + 0.6, 0, TAU); if (a > 0.6) ctx.arc(hx, hy, a - 0.6, 0, TAU, true); ctx.clip();
      ctx.translate(hx, hy); ctx.scale(1 / s, 1 / s); ctx.translate(-hx, -hy);
      ctx.drawImage(img, x0, y0, x1 - x0, y1 - y0, ox + x0 / k, oy + y0 / k, (x1 - x0) / k, (y1 - y0) / k);
      ctx.restore();
    }
  }
  // Big lenses are rendered into a CSS-resolution buffer and composited once: at DPR 2 that is a quarter of the
  // pixels to rasterise for each of the ~25 clipped annuli, and the result is soft anyway (it is magnified).
  let LBUF = null;
  function remapBuffered(ctx, img, k, ox, oy, hx, hy, radii, sOf) {
    const R = radii[radii.length - 1], sc = Math.min(1, 1400 / (2 * R)), size = Math.ceil(2 * R * sc) + 2;
    if (!LBUF) LBUF = mk(size, size);
    if (LBUF.width < size || LBUF.height < size) { LBUF.width = Math.max(LBUF.width, size); LBUF.height = Math.max(LBUF.height, size); }
    const b = LBUF.getContext('2d');
    b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, size, size);
    b.setTransform(sc, 0, 0, sc, (R - hx) * sc, (R - hy) * sc);
    remap(b, img, k, ox, oy, hx, hy, radii, sOf);
    ctx.drawImage(LBUF, 0, 0, size, size, hx - R, hy - R, size / sc, size / sc);
  }
  const geo = (a, b, n, out) => { for (let i = 0; i < n; i++) out.push(a * Math.pow(b / a, i / n)); return out; };

  /* ---------------- Accretion disk ---------------- */
  let DISK_TEX = null, DISK = null, DOP_A = null, DOP_C = null;
  function diskSprites() {
    if (DISK_TEX) return;
    const c = mk(512, 512), g = c.getContext('2d'), h = 256, rin = 0.3 * h;
    g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(h, h, rin, h, h, h);
    gr.addColorStop(0, 'rgba(255,250,235,0.95)'); gr.addColorStop(0.12, 'rgba(255,220,160,0.75)'); gr.addColorStop(0.4, 'rgba(255,140,60,0.32)');
    gr.addColorStop(0.75, 'rgba(190,60,20,0.1)'); gr.addColorStop(1, 'rgba(120,30,10,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    g.lineCap = 'round';
    for (let i = 0; i < 1500; i++) {
      const fr = Math.pow(Math.random(), 1.7), r = rin + (h - rin) * fr, a0 = rand(0, TAU);
      const col = fr < 0.15 ? '255,245,225' : fr < 0.4 ? '255,200,120' : fr < 0.7 ? '255,140,60' : '210,80,30';
      g.strokeStyle = `rgba(${col},${rand(0.05, 0.3) * (1 - fr * 0.7)})`; g.lineWidth = rand(0.6, 2.6);
      g.beginPath(); g.arc(h, h, r, a0, a0 + rand(0.15, 1.5)); g.stroke();
    }
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 70; i++) { const r = rin + (h - rin) * Math.random(), a0 = rand(0, TAU); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = rand(1, 3); g.beginPath(); g.arc(h, h, r, a0, a0 + rand(0.3, 2)); g.stroke(); }
    g.fillStyle = '#000'; g.beginPath(); g.arc(h, h, rin, 0, TAU); g.fill();
    DISK_TEX = c; DISK = mk(512, 512);
    const d = DISK.getContext('2d');
    DOP_A = d.createLinearGradient(0, 0, 512, 0); DOP_A.addColorStop(0, 'rgba(0,0,0,1)'); DOP_A.addColorStop(0.5, 'rgba(0,0,0,0.6)'); DOP_A.addColorStop(1, 'rgba(0,0,0,0.2)');
    DOP_C = d.createLinearGradient(0, 0, 512, 0); DOP_C.addColorStop(0, 'rgba(150,185,255,0.5)'); DOP_C.addColorStop(0.45, 'rgba(255,255,255,0)'); DOP_C.addColorStop(0.55, 'rgba(255,255,255,0)'); DOP_C.addColorStop(1, 'rgba(255,60,10,0.45)');
  }
  function renderDisk(now) { // spin the texture, then Doppler beaming: the approaching (left) side is brighter and bluer
    const g = DISK.getContext('2d');
    g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, 512, 512);
    g.save(); g.translate(256, 256); g.rotate(-now * 0.0009); g.drawImage(DISK_TEX, -256, -256);
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.45; g.rotate(now * 0.0004 + 1); g.drawImage(DISK_TEX, -256, -256); g.restore();
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'destination-in'; g.fillStyle = DOP_A; g.fillRect(0, 0, 512, 512);
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = DOP_C; g.fillRect(0, 0, 512, 512);
    g.globalCompositeOperation = 'source-over';
  }

  // A faint, thin infection web that sits quietly over a lit 3D scene (an instrument overlay rather than neon).
  SP.addLink('cosmos-faint', (ctx, L, S) => { ctx.globalAlpha = 0.22 + 0.1 * L.stage; ctx.lineWidth = 0.6; S.line(L.ax, L.ay, L.bx, L.by); ctx.globalAlpha = 1; });
  /* ======================= 3D shared: GLSL, blackbody, star points, galaxies, lensing ======================= */
  // Blackbody colour (Tanner Helland's fit of the CIE data), returned in linear light.
  const GLSL_BB = `
  vec3 blackbody(float T) {
    T = clamp(T, 1000.0, 40000.0) / 100.0;
    float r = T <= 66.0 ? 1.0 : clamp(1.292936 * pow(T - 60.0, -0.1332047), 0.0, 1.0);
    float g = T <= 66.0 ? clamp(0.3900816 * log(T) - 0.6318414, 0.0, 1.0) : clamp(1.129891 * pow(T - 60.0, -0.0755148), 0.0, 1.0);
    float b = T >= 66.0 ? 1.0 : (T <= 19.0 ? 0.0 : clamp(0.5432068 * log(T - 10.0) - 1.1962541, 0.0, 1.0));
    return pow(vec3(r, g, b), vec3(2.2));
  }`;
  function bbLin(T) {
    T = clamp(T, 1000, 40000) / 100;
    const r = T <= 66 ? 1 : clamp(1.292936 * Math.pow(T - 60, -0.1332047), 0, 1);
    const g = T <= 66 ? clamp(0.3900816 * Math.log(T) - 0.6318414, 0, 1) : clamp(1.129891 * Math.pow(T - 60, -0.0755148), 0, 1);
    const b = T >= 66 ? 1 : T <= 19 ? 0 : clamp(0.5432068 * Math.log(T - 10) - 1.1962541, 0, 1);
    return [Math.pow(r, 2.2), Math.pow(g, 2.2), Math.pow(b, 2.2)];
  }
  const GLSL_NOISE = `
  float h13(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vn3(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h13(i), h13(i + vec3(1, 0, 0)), f.x), mix(h13(i + vec3(0, 1, 0)), h13(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(h13(i + vec3(0, 0, 1)), h13(i + vec3(1, 0, 1)), f.x), mix(h13(i + vec3(0, 1, 1)), h13(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float fbm3(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn3(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }`;
  // Point stars: a size in world units that never drops below ~2 px (brightness is scaled down instead, so faint
  // stars stay anti-aliased), and a soft Gaussian profile. Additive.
  const GLSL_POINT_FRAG = `
  varying vec3 vCol; varying float vB;
  void main() { vec2 q = gl_PointCoord * 2.0 - 1.0; float d2 = dot(q, q); if (d2 > 1.0) discard;
    float a = exp(-d2 * 5.5) + 0.12 * exp(-d2 * 1.2); gl_FragColor = vec4(vCol * a * vB, 1.0); }`;
  const GLSL_POINT_SIZE = `
    float s = aSize * uScale / max(0.001, -mv.z); float ps = max(s, 2.0);
    gl_PointSize = ps; vB = clamp((s * s) / (ps * ps), 0.02, 1.0);`;
  function pointScale(S, X) { return S.H * X.renderer.getPixelRatio() / (2 * Math.tan(X.camera.fov * Math.PI / 360)); }
  function simplePoints(THREE, n) { // position + aCol + aSize, updated from the CPU
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aCol', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(n), 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 800 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `uniform float uScale; attribute vec3 aCol; attribute float aSize; varying vec3 vCol; varying float vB;
        void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; vCol = aCol; ${GLSL_POINT_SIZE} if (aSize <= 0.0) gl_PointSize = 0.0; }`,
      fragmentShader: GLSL_POINT_FRAG
    });
    const p = new THREE.Points(g, m); p.frustumCulled = false;
    return p;
  }

  // A spiral galaxy as tens of thousands of stars. Stars orbit in the vertex shader on a flat rotation curve, so
  // the CPU can compute any star's position too (for capturing it). The arms are a density wave: young hot stars and
  // pink HII regions along logarithmic spirals, an old yellow bulge, and dark dust on the inner edge of each arm.
  function buildGalaxy(THREE, n, R, o) {
    o = o || {};
    const arms = o.arms || 2, pitch = o.pitch || 0.3, r0 = R * 0.1, Rd = R * 0.28;
    const aR = new Float32Array(n), aA = new Float32Array(n), aH = new Float32Array(n), aSize = new Float32Array(n), aAlive = new Float32Array(n), aCol = new Float32Array(n * 3);
    const lum = (lo, hi) => lo * Math.pow(hi / lo, Math.random() * Math.random());
    for (let i = 0; i < n; i++) {
      const u = Math.random();
      let r, a, h, T, L, sz;
      if (u < 0.13) { // bulge
        const x = gauss() * R * 0.07, y = gauss() * R * 0.045, z = gauss() * R * 0.07;
        r = Math.hypot(x, z); a = Math.atan2(z, x); h = y; T = rand(3200, 5400); L = lum(0.25, 2.2); sz = rand(0.025, 0.05);
      } else if (u < 0.45) { // old disk
        r = Math.min(R * 1.15, -Math.log(1 - Math.random()) * Rd + R * 0.03); a = rand(0, TAU); h = gauss() * R * 0.012 * (1 + r / R); T = rand(3500, 6800); L = lum(0.12, 1.2); sz = rand(0.02, 0.045);
      } else { // spiral arms
        r = Math.min(R * 1.05, r0 + -Math.log(1 - Math.random()) * Rd * 1.15) * (1 + gauss() * 0.05);
        const k = Math.floor(Math.random() * arms), spread = 0.26 + 0.16 * (r / R);
        a = k * TAU / arms + Math.log(Math.max(r, r0) / r0) / Math.tan(pitch) + gauss() * spread; h = gauss() * R * 0.007;
        if (u > 0.99) { T = 0; L = lum(0.6, 2.2); sz = rand(0.04, 0.08); } // HII region
        else { T = Math.random() < 0.6 ? rand(9000, 30000) : rand(5000, 9000); L = lum(0.15, 2.5); sz = rand(0.025, 0.06); }
      }
      const c = T ? bbLin(T) : [1, 0.22, 0.42];
      aR[i] = r; aA[i] = a; aH[i] = h; aSize[i] = sz * (0.7 + 0.5 * Math.sqrt(L)); aAlive[i] = 1;
      aCol[i * 3] = c[0] * L; aCol[i * 3 + 1] = c[1] * L; aCol[i * 3 + 2] = c[2] * L;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    [['aR', aR, 1], ['aA', aA, 1], ['aH', aH, 1], ['aSize', aSize, 1], ['aAlive', aAlive, 1], ['aCol', aCol, 3]].forEach(([k, v, s]) => g.setAttribute(k, new THREE.BufferAttribute(v, s)));
    const uni = { uTime: { value: 0 }, uOmega: { value: o.omega || 0.12 }, uScale: { value: 800 }, uSw: { value: new THREE.Vector4() }, uSwA: { value: 0 }, uBright: { value: o.bright || 1 } };
    const head = `uniform float uTime, uOmega, uScale, uSwA, uBright; uniform vec4 uSw; attribute float aR, aA, aH, aSize, aAlive; attribute vec3 aCol; varying vec3 vCol; varying float vB;
      vec3 galPos() { float ang = aA + uOmega * uTime / (0.3 + aR * 0.1); vec3 p = vec3(cos(ang) * aR, aH, sin(ang) * aR);
        vec2 d = p.xz - uSw.xy; p.xz += uSw.zw * uSwA * exp(-dot(d, d) * 0.35); return p; }`;
    const stars = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: head + `void main() { vec4 mv = modelViewMatrix * vec4(galPos(), 1.0); gl_Position = projectionMatrix * mv; vCol = aCol * uBright; ${GLSL_POINT_SIZE} vB *= aAlive; if (aAlive <= 0.0) gl_PointSize = 0.0; }`,
      fragmentShader: GLSL_POINT_FRAG
    }));
    stars.frustumCulled = false;
    // Dust: dark, soft, normally blended blobs on the concave (inner) edge of each arm and in a ring round the bulge.
    const nd = Math.round(n * 0.22), dR = new Float32Array(nd), dA = new Float32Array(nd), dH = new Float32Array(nd), dS = new Float32Array(nd), dAl = new Float32Array(nd).fill(1), dC = new Float32Array(nd * 3);
    for (let i = 0; i < nd; i++) {
      let r, a;
      if (Math.random() < 0.8) { r = Math.min(R, r0 * 1.4 + -Math.log(1 - Math.random()) * Rd); const k = Math.floor(Math.random() * arms); a = k * TAU / arms + Math.log(Math.max(r / 0.9, r0) / r0) / Math.tan(pitch) + gauss() * (0.12 + 0.08 * r / R); }
      else { r = R * rand(0.12, 0.2); a = rand(0, TAU); }
      dR[i] = r; dA[i] = a; dH[i] = gauss() * R * 0.004; dS[i] = rand(0.2, 0.5) * R * 0.045; const s = rand(0.5, 1);
      dC[i * 3] = 0.06 * s; dC[i * 3 + 1] = 0.035 * s; dC[i * 3 + 2] = 0.02 * s;
    }
    const gd = new THREE.BufferGeometry();
    gd.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nd * 3), 3));
    [['aR', dR, 1], ['aA', dA, 1], ['aH', dH, 1], ['aSize', dS, 1], ['aAlive', dAl, 1], ['aCol', dC, 3]].forEach(([k, v, s]) => gd.setAttribute(k, new THREE.BufferAttribute(v, s)));
    const dust = new THREE.Points(gd, new THREE.ShaderMaterial({
      uniforms: uni, transparent: true, depthWrite: false,
      vertexShader: head + `void main() { vec4 mv = modelViewMatrix * vec4(galPos(), 1.0); gl_Position = projectionMatrix * mv; vCol = aCol; ${GLSL_POINT_SIZE} }`,
      fragmentShader: `varying vec3 vCol; varying float vB; void main() { vec2 q = gl_PointCoord * 2.0 - 1.0; float d2 = dot(q, q); if (d2 > 1.0) discard; gl_FragColor = vec4(vCol, 0.2 * exp(-d2 * 3.0) * vB); }`
    }));
    dust.frustumCulled = false; dust.renderOrder = 2;
    // Unresolved starlight: an exponential disk and a bulge glow, both computed in the shader (no texture banding).
    const glowMat = (col, k, op, bb) => new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color(col) }, uK: { value: k }, uOp: { value: op } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: bb ? 'varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0); mv.xy += position.xy; gl_Position = projectionMatrix * mv; }'
        : 'varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uC; uniform float uK, uOp; varying vec2 vUv; void main(){ float r = length(vUv); float a = exp(-r * uK) * (1.0 - smoothstep(0.7, 1.0, r)); gl_FragColor = vec4(uC * a * uOp, 1.0); }' });
    const disk = new THREE.Mesh(new THREE.PlaneGeometry(R * 2.4, R * 2.4), glowMat(0x6a7898, 4.0, 0.22));
    disk.rotation.x = -Math.PI / 2;
    const bulge = new THREE.Mesh(new THREE.PlaneGeometry(R * 0.7, R * 0.7), glowMat(0xffc98a, 6.0, 0.55, true)); // a camera-facing billboard
    bulge.frustumCulled = false;
    const group = new THREE.Group(); group.add(disk); group.add(stars); group.add(dust); group.add(bulge);
    // CPU mirror of the vertex shader
    const posOf = (i, t, out) => { const ang = aA[i] + uni.uOmega.value * t / (0.3 + aR[i] * 0.1); out.set(Math.cos(ang) * aR[i], aH[i], Math.sin(ang) * aR[i]); return out; };
    return { group, stars, dust, uni, n, aR, aA, aH, aAlive, aCol, aSize, posOf, R };
  }

  // Deep-field background, painted once on a 2D canvas (2048 x 1152) and reused as a texture.
  let DEEP = null;
  function deepFieldCanvas(density) {
    if (DEEP && DEEP.d === density) return DEEP.c;
    const c = mk(2048, 1152), g = c.getContext('2d');
    paintDeepField({ W: 2048, H: 1152 }, g, density);
    DEEP = { c, d: density };
    return c;
  }
  function deepFieldTexture(THREE, density) { const t = new THREE.CanvasTexture(deepFieldCanvas(density)); t.encoding = THREE.sRGBEncoding; return t; }

  // Screen-space gravitational lensing as a post-processing pass (before bloom). For an image-plane offset θ from the
  // lens, the shader samples the unlensed render at β = θ(1 − θE²/|θ|²) (a point mass; optionally with a core and a
  // taper to the identity at uRmax). It also blacks out the shadow and adds the photon ring.
  const LensShader = {
    uniforms: { tDiffuse: { value: null }, uC: { value: null }, uRes: { value: null }, uThE: { value: 0 }, uRs: { value: 0 }, uRmax: { value: 1 }, uCore: { value: 0 }, uOn: { value: 0 }, uRing: { value: 0 }, uApp: { value: null }, uMode: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uC, uRes, uApp; uniform float uThE, uRs, uRmax, uCore, uOn, uRing, uMode; varying vec2 vUv;
      void main() {
        if (uOn < 0.001) { gl_FragColor = texture2D(tDiffuse, vUv); return; }
        vec2 p = (vUv - uC) * uRes; float r = length(p) + 1e-4;
        float taper = 1.0 - smoothstep(uRmax * 0.55, uRmax, r);
        float k;
        if (uMode < 0.5) k = uThE * uThE / (r * r);                                   // point mass (black hole)
        else { float q = r * r + uThE * uThE; k = 3.3 * uThE * uThE / q * (1.0 - exp(-r * r / max(1.0, uCore * uCore))); } // extended halo (cluster)
        vec2 src = uC + p * (1.0 - k * taper * uOn) / uRes;
        vec4 col = texture2D(tDiffuse, clamp(src, 0.0, 1.0));
        float edge = step(0.0, src.x) * step(src.x, 1.0) * step(0.0, src.y) * step(src.y, 1.0);
        col.rgb *= mix(1.0, edge, uOn);
        if (uRs > 0.0) {
          col.rgb *= smoothstep(uRs * 0.985, uRs * 1.015, r);
          float w = max(0.8, uRs * 0.022), dop = 1.0 + 0.7 * dot(p / r, uApp);
          col.rgb += uRing * dop * vec3(1.0, 0.78, 0.55) * (exp(-pow((r - uRs * 1.035) / w, 2.0)) + 0.25 * exp(-pow((r - uRs * 1.08) / (w * 3.0), 2.0)));
        }
        gl_FragColor = col;
      }`
  };
  function addLensPass(X) {
    const THREE = X.THREE, pass = new THREE.ShaderPass(LensShader);
    pass.uniforms.uC.value = new THREE.Vector2(0.5, 0.5); pass.uniforms.uRes.value = new THREE.Vector2(1, 1); pass.uniforms.uApp.value = new THREE.Vector2(-1, 0);
    X.composer.insertPass(pass, 1);
    return pass;
  }
  // Pointer ray -> intersection with a plane (normal n, point p0), in world space.
  function rayPlane(S, X, x, y, n, p0) {
    const THREE = X.THREE, cam = X.camera, ndc = new THREE.Vector3(x / S.W * 2 - 1, -(y / S.H) * 2 + 1, 0.5).unproject(cam);
    const dir = ndc.sub(cam.position).normalize(), den = dir.dot(n);
    if (Math.abs(den) < 1e-4) return null;
    const t = p0.clone().sub(cam.position).dot(n) / den;
    return t > 0 ? cam.position.clone().add(dir.multiplyScalar(t)) : null;
  }
  function pxPerUnit(S, X, dist) { return (S.H / 2) / (Math.tan(X.camera.fov * Math.PI / 360) * Math.max(0.01, dist)); }
  // A clean, understated letter overlay: small glyphs at their 3D positions, coloured by infection generation.
  function drawGlyph(S, ctx, n, g, size, a, scale) {
    ctx.font = `${(size * (scale || 0.62)).toFixed(1)}px monospace`;
    ctx.fillStyle = n.inf ? S.colorOf(n.gen, 0.85 * a) : S.baseColor(0.5 * a);
    ctx.fillText(g, n.sx, n.sy);
    return true;
  }

  /* ======================= 1. COSMOS: a 3D spiral galaxy and a black hole that eats it star by star ======================= */
  const NI = 3000; // most stars in flight at once
  const lin = (hslArr) => { const c = new (window.THREE.Color)(); c.setHSL(hslArr[0] / 360, hslArr[1] / 100, hslArr[2] / 100); return [Math.pow(c.r, 2.2), Math.pow(c.g, 2.2), Math.pow(c.b, 2.2)]; };
  function diskMaterial(THREE, uni, plane) {
    return new THREE.ShaderMaterial({
      uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, clipping: true, clippingPlanes: [plane],
      vertexShader: '#include <clipping_planes_pars_vertex>\nvarying vec3 vP; void main(){ vP = position; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;\n#include <clipping_planes_vertex>\n}',
      fragmentShader: `#include <clipping_planes_pars_fragment>
        uniform float uTime, uBright, uLayer; uniform vec3 uCam; varying vec3 vP; ${GLSL_BB} ${GLSL_NOISE}
        void main() {
          #include <clipping_planes_fragment>
          float x = length(vP.xy), phi = atan(vP.y, vP.x);
          // Novikov-Thorne-like temperature profile, peak ~16000 K just outside the ISCO (x = r / r_in)
          float prof = pow(x, -0.75) * pow(max(1.0 - sqrt(1.0 / x), 0.0), 0.25) / 0.488;
          vec3 los = normalize(uCam - vec3(vP.xy, 0.0)), vdir = vec3(-sin(phi), cos(phi), 0.0);
          float beta = clamp(0.42 / sqrt(x), 0.0, 0.5), g = sqrt(1.0 - beta * beta) / (1.0 - beta * dot(vdir, los)); // Doppler factor
          float a = phi - uTime * 1.1 * pow(x, -1.5) + uLayer * 2.0;
          float n = fbm3(vec3(x * 7.0 + uLayer, cos(a) * 2.2, sin(a) * 2.2));
          float streak = 0.3 + 1.6 * n * n;
          float I = pow(g, 3.0) * prof * streak * uBright;
          float fade = smoothstep(1.0, 1.06, x) * (1.0 - smoothstep(1.8, 4.6, x));
          gl_FragColor = vec4(blackbody(6500.0 * prof * g) * I * fade * 0.32, 1.0);
        }`
    });
  }
  function jetMaterial(THREE, uni) {
    return new THREE.ShaderMaterial({
      uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; varying vec3 vN, vV; void main(){ vUv = uv; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: `uniform float uTime, uJet; varying vec2 vUv; varying vec3 vN, vV; ${GLSL_NOISE}
        void main() { float v = vUv.y; float rim = pow(1.0 - abs(dot(vN, vV)), 1.5);
          float knots = 0.55 + 0.45 * fbm3(vec3(v * 9.0 - uTime * 2.2, vUv.x * 3.0, 0.0));
          float a = pow(1.0 - v, 1.6) * (0.25 + 0.75 * (1.0 - rim)) * knots * uJet;
          gl_FragColor = vec4(vec3(0.55, 0.7, 1.0) * a * a * 0.5, 1.0); }`
    });
  }
  function cosmos3dInit(S, X) {
    const THREE = X.THREE, D = S.data, sc = X.scene;
    X.maxPixelRatio = 1.25;
    X.renderer.localClippingEnabled = true;
    X.setBloom(0.75, 0.18, 0.85);
    X.setExposure(1);
    D.lens = addLensPass(X);
    const ov = new THREE.Scene(); const ovPass = new THREE.RenderPass(ov, X.camera); ovPass.clear = false; ovPass.clearDepth = true; X.composer.insertPass(ovPass, 2);
    D.ov = ov;
    sc.background = deepFieldTexture(THREE, 1);
    const n = Math.round(clamp(S.W * S.H / 20, 60000, 100000));
    const G = buildGalaxy(THREE, n, 10, { omega: 0.02, pitch: 0.29, bright: 0.9 });
    G.group.rotation.set(1.02, 0, 0.32);
    sc.add(G.group); D.G = G;
    D.letters = simplePoints(THREE, 240); sc.add(D.letters);
    D.inf = { n: 0, p: new Float32Array(NI * 3), v: new Float32Array(NI * 3), c: new Float32Array(NI * 3) };
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NI * 6), 3));
    lg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(NI * 6), 3));
    D.streaks = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    D.streaks.frustumCulled = false; sc.add(D.streaks);
    D.heads = simplePoints(THREE, NI); sc.add(D.heads);
    // the black hole: disk halves (far half lensed in the main scene, near half drawn over the shadow), jets
    D.bh = new THREE.Vector3(); D.bhL = new THREE.Vector3(); D.nW = new THREE.Vector3(0, 1, 0);
    D.farPlane = new THREE.Plane(); D.nearPlane = new THREE.Plane();
    D.dU = { uTime: { value: 0 }, uBright: { value: 1 }, uLayer: { value: 0 }, uCam: { value: new THREE.Vector3() } };
    D.jU = { uTime: { value: 0 }, uJet: { value: 0 } };
    const ring = new THREE.RingGeometry(1, 6.5, 192, 8);
    D.diskRigs = [[sc, D.farPlane], [ov, D.nearPlane]].map(([scene, plane]) => {
      const rig = new THREE.Group(), tilt = new THREE.Group(); rig.add(tilt); scene.add(rig);
      [-0.045, 0, 0.045].forEach((z, i) => { const u = Object.assign({}, D.dU, { uLayer: { value: i - 1 }, uBright: D.dU.uBright }); const m = new THREE.Mesh(ring, diskMaterial(THREE, u, plane)); m.position.z = z; m.frustumCulled = false; tilt.add(m); });
      rig.visible = false;
      return { rig, tilt };
    });
    const jg = new THREE.CylinderGeometry(0.03, 0.2, 1, 32, 12, true); jg.translate(0, 0.5, 0); jg.rotateX(Math.PI / 2);
    D.jets = [1, -1].map((s) => { const m = new THREE.Mesh(jg, jetMaterial(THREE, D.jU)); m.scale.set(1, 1, s); m.frustumCulled = false; D.diskRigs[1].tilt.add(m); return m; });
    D.diskRigs.forEach((d) => (d.rig.visible = true)); X.renderer.compile(sc, X.camera); X.renderer.compile(ov, X.camera); D.diskRigs.forEach((d) => (d.rig.visible = false)); // no shader-compile hitch on first hold
    D.tmp = new THREE.Vector3(); D.tmp2 = new THREE.Vector3(); D.tmp3 = new THREE.Vector3();
    D.revive = []; D.scan = 0; D.t0 = S.now; D.expo = 0;
    D.palLin = (S.mode.palette || []).map(lin); D.baseLin = lin(S.mode.base);
  }
  function cosmos3dUpdate(S, X, now, dt) {
    const THREE = X.THREE, D = S.data, G = D.G, h = D.hole, cam = X.camera, sdt = Math.min(0.05, dt / 1000), t = (now - D.t0) / 1000;
    G.uni.uTime.value = t; G.uni.uScale.value = pointScale(S, X);
    D.letters.material.uniforms.uScale.value = D.heads.material.uniforms.uScale.value = G.uni.uScale.value;
    // camera: a slow orbit, pointer parallax, and a dolly toward the hole while it grows
    const px = (S.ptr.x / Math.max(1, S.W) - 0.5) * (S.ptrInside ? 1 : 0), py = (S.ptr.y / Math.max(1, S.H) - 0.5) * (S.ptrInside ? 1 : 0);
    const orbit = S.reduceMotion ? 0 : 0.28 * Math.sin(t * 0.021), dist = 27 - 6 * h.P;
    D.camT = D.camT || new THREE.Vector3();
    D.camT.lerp(D.tmp.copy(D.bh).multiplyScalar(0.35 * h.P), 1 - Math.pow(0.97, dt / 16.7));
    const yaw = orbit + px * 0.12, pitch = 0.08 + py * 0.08;
    cam.position.set(D.camT.x + Math.sin(yaw) * dist * Math.cos(pitch), D.camT.y + Math.sin(pitch) * dist, D.camT.z + Math.cos(yaw) * dist * Math.cos(pitch));
    cam.lookAt(D.camT);
    G.group.updateMatrixWorld();
    // black hole position: the pointer's ray hits the galactic plane
    const nG = D.tmp2.set(0, 1, 0).applyQuaternion(G.group.quaternion);
    if (S.holding) {
      const hit = rayPlane(S, X, S.ptr.x, S.ptr.y, nG, G.group.position);
      if (hit) { const L = G.group.worldToLocal(hit); L.y = 0; if (L.length() > 13) L.setLength(13); if (h.P < 0.03 && !D.bhSet) { D.bhL.copy(L); D.bhSet = 1; } else D.bhL.lerp(L, 1 - Math.pow(0.92, dt / 16.7)); }
    } else D.bhSet = 0;
    D.bh.copy(D.bhL); G.group.localToWorld(D.bh);
    const rs = 0.14 + 0.5 * Math.pow(h.P, 1.1), rin = rs * 1.5;
    D.rs = rs; D.rin = rin;
    // disk orientation: nearly edge-on to the camera, with a little tilt, so the lensed far side arcs over the top
    const on = h.P > 0.02;
    D.diskRigs.forEach((d, i) => {
      d.rig.visible = on; d.rig.position.copy(D.bh); d.rig.quaternion.copy(cam.quaternion); d.rig.rotateZ(-0.1);
      d.tilt.rotation.set(-Math.PI / 2 + 0.14, 0, 0); d.rig.scale.setScalar(rin);
    });
    const tilt = D.diskRigs[0].tilt; tilt.updateMatrixWorld(true);
    const nW = D.nW.set(0, 0, 1).transformDirection(tilt.matrixWorld);
    const toCam = D.tmp3.copy(cam.position).sub(D.bh).normalize();
    D.nearPlane.setFromNormalAndCoplanarPoint(toCam, D.bh); D.farPlane.setFromNormalAndCoplanarPoint(toCam.clone().negate(), D.bh);
    const camLocal = tilt.children[1].worldToLocal(cam.position.clone());
    D.dU.uCam.value.copy(camLocal); D.dU.uTime.value = t;
    D.feed = (D.feed || 0) * Math.pow(0.5, sdt / 0.8);
    D.dU.uBright.value = smooth(0.12, 0.4, h.P) * (0.8 + Math.min(1.5, D.feed * 0.02)) + D.expo * 0.8;
    D.jU.uTime.value = t; D.jU.uJet.value = h.jet + D.expo * 0.8;
    D.jets.forEach((m) => { const L = (4 + 10 * h.jet) / rin; m.scale.x = m.scale.y = 0.6 + 0.6 * h.jet; m.scale.z = Math.sign(m.scale.z) * L; });
    // lens uniforms (screen space, css px)
    const U = D.lens.uniforms, p = D.tmp.copy(D.bh).project(cam), dCam = cam.position.distanceTo(D.bh), ppu = pxPerUnit(S, X, dCam);
    U.uC.value.set((p.x + 1) / 2, (p.y + 1) / 2); U.uRes.value.set(S.W, S.H);
    U.uOn.value = smooth(0.0, 0.08, h.P); U.uRs.value = on ? rs * ppu : 0; U.uThE.value = rs * ppu * 2.3; U.uRmax.value = Math.min(rs * ppu * 2.3 * 4.2, S.H * 0.6);
    U.uRing.value = 0.5 + 1.4 * smooth(0.1, 0.5, h.P);
    // approaching side of the disk, in screen space (for the photon ring's Doppler asymmetry)
    const vA = D.tmp.set(0, 1, 0).transformDirection(tilt.matrixWorld);
    U.uApp.value.set(vA.dot(toCam) > 0 ? 1 : -1, 0);
    D.screenBH = { x: (p.x + 1) / 2 * S.W, y: (1 - p.y) / 2 * S.H, rs: rs * ppu };
    if (D.expo > 0.001) { D.expo *= Math.pow(0.5, sdt / 0.35); X.setExposure(1 + D.expo); }
    // capture stars: scan a slice of the galaxy every frame; stars inside the reach fall in one at a time
    const AL = G.aAlive, aliveAttr = G.stars.geometry.attributes.aAlive; let dirty = false;
    if (S.holding && h.P > 0.04) {
      const reach = 0.9 + 9.5 * Math.pow(h.P, 1.4), cap = Math.round(3 + 45 * h.P), r2 = reach * reach, chunk = Math.min(G.n, 22000);
      let got = 0;
      for (let k = 0; k < chunk && got < cap && D.inf.n < NI; k++) {
        const i = D.scan; D.scan = (D.scan + 1) % G.n;
        if (AL[i] < 1) continue;
        G.posOf(i, t, D.tmp);
        const dx = D.tmp.x - D.bhL.x, dz = D.tmp.z - D.bhL.z, d2 = dx * dx + dz * dz;
        if (d2 > r2 || Math.random() > 0.35 * (1 - d2 / r2) + 0.05) continue;
        AL[i] = 0; dirty = true; got++;
        G.group.localToWorld(D.tmp);
        const j = D.inf.n++, P3 = D.inf.p, V3 = D.inf.v, C3 = D.inf.c;
        P3[j * 3] = D.tmp.x; P3[j * 3 + 1] = D.tmp.y; P3[j * 3 + 2] = D.tmp.z;
        const rel = D.tmp.sub(D.bh), dd = rel.length() + 1e-3, GM = 6 * (0.3 + h.P), tv = D.tmp2.crossVectors(nW, rel).normalize().multiplyScalar(Math.sqrt(GM / dd) * rand(0.55, 0.85));
        V3[j * 3] = tv.x - rel.x / dd * 0.15; V3[j * 3 + 1] = tv.y - rel.y / dd * 0.15; V3[j * 3 + 2] = tv.z - rel.z / dd * 0.15;
        C3[j * 3] = G.aCol[i * 3]; C3[j * 3 + 1] = G.aCol[i * 3 + 1]; C3[j * 3 + 2] = G.aCol[i * 3 + 2];
      }
    } else if (!S.holding) { // the galaxy refills slowly once the hole has gone
      for (let k = 0; k < 400 && D.revive.length < 20000; k++) { const i = Math.floor(Math.random() * G.n); if (AL[i] === 0) { AL[i] = 0.001; D.revive.push(i); } }
    }
    if (D.revive.length) { let w = 0; for (const i of D.revive) { AL[i] = Math.min(1, AL[i] + sdt * 0.5); if (AL[i] < 1) D.revive[w++] = i; } D.revive.length = w; dirty = true; }
    if (dirty) aliveAttr.needsUpdate = true;
    // integrate the infalling stars around the hole (in its disk plane), stretch them near the ISCO, feed the disk
    const I = D.inf, P3 = I.p, V3 = I.v, C3 = I.c, GM = 6 * (0.3 + Math.max(h.P, 0.15)), isco = rin * 1.25;
    const lp = D.streaks.geometry.attributes.position.array, lc = D.streaks.geometry.attributes.color.array;
    const hp = D.heads.geometry.attributes.position.array, hc = D.heads.geometry.attributes.aCol.array, hs = D.heads.geometry.attributes.aSize.array;
    let w = 0;
    for (let j = 0; j < I.n; j++) {
      let x = P3[j * 3] - D.bh.x, y = P3[j * 3 + 1] - D.bh.y, z = P3[j * 3 + 2] - D.bh.z, vx = V3[j * 3], vy = V3[j * 3 + 1], vz = V3[j * 3 + 2];
      for (let s = 0; s < 2; s++) {
        const st = sdt / 2, d2 = x * x + y * y + z * z, d = Math.sqrt(d2), a = -GM / (d2 * d + 0.02);
        const off = x * nW.x + y * nW.y + z * nW.z; // settle into the disk plane
        vx += (a * x - nW.x * off * 1.6) * st; vy += (a * y - nW.y * off * 1.6) * st; vz += (a * z - nW.z * off * 1.6) * st;
        const damp = Math.exp(-(0.18 + 0.5 / (1 + d)) * st); vx *= damp; vy *= damp; vz *= damp;
        x += vx * st; y += vy * st; z += vz * st;
      }
      const d = Math.sqrt(x * x + y * y + z * z);
      if (d < rs * 1.02 || !(d < 60)) { D.eaten = (D.eaten || 0) + 1; D.feed += 1; continue; }
      P3[w * 3] = x + D.bh.x; P3[w * 3 + 1] = y + D.bh.y; P3[w * 3 + 2] = z + D.bh.z;
      V3[w * 3] = vx; V3[w * 3 + 1] = vy; V3[w * 3 + 2] = vz;
      C3[w * 3] = C3[j * 3]; C3[w * 3 + 1] = C3[j * 3 + 1]; C3[w * 3 + 2] = C3[j * 3 + 2];
      const sp = Math.sqrt(vx * vx + vy * vy + vz * vz) + 1e-4, tid = Math.min(1, Math.pow(isco / d, 2.5)), len = 0.02 + 1.3 * tid; // tidal stretching
      const heat = 1 + 2.5 * tid, cr = C3[w * 3] * heat, cg = C3[w * 3 + 1] * heat, cb = C3[w * 3 + 2] * (heat + tid);
      lp[w * 6] = P3[w * 3]; lp[w * 6 + 1] = P3[w * 3 + 1]; lp[w * 6 + 2] = P3[w * 3 + 2];
      lp[w * 6 + 3] = P3[w * 3] - vx / sp * len; lp[w * 6 + 4] = P3[w * 3 + 1] - vy / sp * len; lp[w * 6 + 5] = P3[w * 3 + 2] - vz / sp * len;
      lc[w * 6] = cr; lc[w * 6 + 1] = cg; lc[w * 6 + 2] = cb; lc[w * 6 + 3] = 0; lc[w * 6 + 4] = 0; lc[w * 6 + 5] = 0;
      hp[w * 3] = lp[w * 6]; hp[w * 3 + 1] = lp[w * 6 + 1]; hp[w * 3 + 2] = lp[w * 6 + 2];
      hc[w * 3] = cr; hc[w * 3 + 1] = cg; hc[w * 3 + 2] = cb; hs[w] = 0.045 * (1 - tid * 0.5);
      w++;
    }
    for (let j = w; j < I.n; j++) hs[j] = 0;
    I.n = w;
    D.streaks.geometry.setDrawRange(0, w * 2);
    D.streaks.geometry.attributes.position.needsUpdate = D.streaks.geometry.attributes.color.needsUpdate = true;
    D.heads.geometry.setDrawRange(0, w);
    ['position', 'aCol', 'aSize'].forEach((k) => (D.heads.geometry.attributes[k].needsUpdate = true));
    // swipes leave a gravitational wake in the star field
    const v = S.ptrVel || { x: 0, y: 0 }, spd = Math.hypot(v.x, v.y);
    if (!S.holding && spd > 2 && S.ptrInside) {
      const hit = rayPlane(S, X, S.ptr.x, S.ptr.y, nG, G.group.position);
      if (hit) { const L = G.group.worldToLocal(hit); const hit2 = rayPlane(S, X, S.ptr.x + v.x, S.ptr.y + v.y, nG, G.group.position); if (hit2) { const L2 = G.group.worldToLocal(hit2); G.uni.uSw.value.set(L.x, L.z, (L2.x - L.x) * 0.25, (L2.z - L.z) * 0.25); G.uni.uSwA.value = 1; } }
    }
    G.uni.uSwA.value *= Math.pow(0.5, sdt / 0.6);
    // letters as stars in the scene
    const LP = D.letters.geometry.attributes.position.array, LC = D.letters.geometry.attributes.aCol.array, LS = D.letters.geometry.attributes.aSize.array;
    let k = 0;
    for (const n of S.active) {
      if (k >= 240) break;
      const q = n.data.w3;
      if (!q) continue;
      LP[k * 3] = q.x; LP[k * 3 + 1] = q.y; LP[k * 3 + 2] = q.z;
      const c = n.inf ? D.palLin[n.gen % D.palLin.length] : D.baseLin, b = (n.inf ? 2.2 : 0.9) * (1 - Math.pow(n.data.fall || 0, 3));
      LC[k * 3] = c[0] * b; LC[k * 3 + 1] = c[1] * b; LC[k * 3 + 2] = c[2] * b; LS[k] = n.inf ? 0.16 : 0.09;
      k++;
    }
    for (let j = k; j < 240; j++) LS[j] = 0;
    ['position', 'aCol', 'aSize'].forEach((a) => (D.letters.geometry.attributes[a].needsUpdate = true));
  }
  addMode({
    id: 'cosmos', name: 'COSMOS', pageBg: ['#04050c', '#020308'],
    glyphs: '✦✧★☆✶✷✸⋆∗☉☽☾♃♄♅♆♇⊕☿♀♂',
    base: [215, 45, 90], palette: [[45, 100, 70], [200, 100, 72], [320, 95, 74]],
    links: ['cosmos-faint'],
    shapes: ['galaxy', 'sphere', 'hopf', 'torus', 'sunflower', 'helix', 'lissajous'],
    glyphScale: 0.85,
    init(S) { S.data.hole = { P: 0, jet: 0 }; S.data.eaten = 0; S.data.letEaten = 0; },
    three: { init: cosmos3dInit, update: cosmos3dUpdate },
    update(S, now, dt) {
      const h = S.data.hole;
      if (S.holding) { h.P = Math.pow(clamp((S.held - 150) / 4350, 0, 1), 0.85); h.jet = clamp((S.held - 4300) / 900, 0, 1); }
      else { const k = Math.pow(0.5, dt / 450); h.P *= k; h.jet *= k; if (h.P < 0.004) h.P = 0; }
    },
    warp(S, n) { // letters live in the scene: a sphere of stars hovering over the galaxy; they fall in like everything else
      const X = S.three, D = S.data, d = n.data;
      if (!X || !D.G || n.rx === undefined) return;
      const THREE = X.THREE;
      if (!d.w3) { d.w3 = new THREE.Vector3(); d.fall = 0; d.phi = 0; }
      const R = 7.5, q = d.w3.set(n.rx * R, -n.ry * R + 1.5, n.rz * R);
      const dt = S.dt;
      if (S.holding && D.hole.P > 0.04) d.fall = Math.min(1, d.fall + dt * 0.00022 * D.hole.P * (0.4 + clamp(1 - q.distanceTo(D.bh) / 14, 0, 1) * 1.6));
      else d.fall = Math.max(0, d.fall - dt * 0.0009);
      if (d.fall > 0.001) {
        d.phi += dt * 0.0025 * d.fall * d.fall;
        const o = q.sub(D.bh), r0 = o.length(), rin = (D.rin || 0.3) * 1.3, rr = rin + (r0 - rin) * Math.pow(1 - d.fall, 1.6);
        o.applyAxisAngle(D.nW, d.phi * Math.min(1, d.fall * 3));
        const along = o.dot(D.nW); o.addScaledVector(D.nW, -along * (0.85 * d.fall * d.fall));
        o.setLength(rr); q.copy(D.bh).add(o);
        if (d.fall > 0.97 && !d.sw) { d.sw = 1; D.letEaten++; } else if (d.fall < 0.5) d.sw = 0;
      } else d.phi = 0;
      const s = X.toScreen(q); n.sx = s.x; n.sy = s.y; n.shrink *= 1 - 0.9 * Math.pow(d.fall, 3);
      n.z = -X.camera.position.distanceTo(q);
    },
    drawNode(S, ctx, n, g, size, a) {
      const f = n.data.fall || 0, B = S.data.screenBH;
      if (f < 0.12 || !B) return drawGlyph(S, ctx, n, g, size, a);
      a *= 1 - Math.pow(f, 3); if (a < 0.02) return true;
      const st = 1 + 4 * f * f, spr = glyphSprite(g, f > 0.45 ? '255,214,170' : '215,230,255'), k = size * 0.62 / 44;
      ctx.save(); ctx.translate(n.sx, n.sy); ctx.rotate(Math.atan2(n.sy - B.y, n.sx - B.x) + Math.PI / 2); ctx.scale(k / Math.sqrt(st), k * st);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = clamp(a, 0, 1); ctx.drawImage(spr, -32, -32); ctx.restore(); ctx.globalAlpha = 1;
      return true;
    },
    onClimax() { return false; }, // no flash: the hole just keeps feeding
    onRelease(S, held, power) { // a last burst of accretion: the jets and the disk flare, and the exposure adapts
      const D = S.data;
      if (D.hole.P > 0.3 && !S.reduceMotion) D.expo = 0.6 * D.hole.P;
      return false;
    },
    hud(S) {
      const D = S.data, h = D.hole;
      if (S.holding && h.P > 0.03) {
        const M = Math.pow(10, 6 + 4 * h.P), rs = 2953 * M / 1.496e11, L = 1.26e31 * M * 0.1 * (D.feed || 0) / 50;
        return `M = ${sci(M)} M☉ · r_s = ${rs < 100 ? rs.toFixed(1) : big(rs)} AU · ${big(D.eaten || 0)} stars accreted, one at a time${L > 1e30 ? ' · L ≈ ' + sci(L) + ' W' : ''}${h.jet > 0.5 ? ' · jets at 0.99c' : ''}`;
      }
      if ((D.eaten || 0) > 0) return `${big(D.eaten)} stars gone; the rest keep orbiting at ~220 km/s as if nothing happened`;
      return `grand-design spiral, ${big(D.G ? D.G.n : 0)} stars rendered of ~10¹¹ · hold anywhere to drop a black hole into the disk`;
    }
  });
  /* ======================= 2. GALAXY CLUSTER: a 3D cluster, its intracluster light, lensing and a merger ======================= */
  // Elliptical member galaxies as point sprites with a de Vaucouleurs (r^1/4) profile, each with its own axis ratio and
  // angle. While held, the dark-matter clump under the pointer drags them in (on the GPU), tidally stretching them.
  function memberMaterial(THREE, U) {
    return new THREE.ShaderMaterial({
      uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `uniform float uScale, uPull, uTime; uniform vec3 uAtt; attribute vec3 aCol; attribute float aSize, aQ, aAng, aPh; varying vec3 vCol; varying float vB, vQ, vAng, vStr;
        void main() {
          vec3 p = position, d = uAtt - p; float r = length(d) + 1e-3;
          float f = uPull * (1.0 - exp(-r * 0.12)) * smoothstep(0.0, 1.0, uPull * 1.4 - aPh * 0.4);
          float sw = f * (1.6 + 4.0 / (r + 1.0)) + uTime * 0.0;
          vec3 axis = normalize(cameraPosition - uAtt);
          vec3 o = p - uAtt; o = o * cos(sw) + cross(axis, o) * sin(sw) + axis * dot(axis, o) * (1.0 - cos(sw)); // swirl about the clump
          p = uAtt + o * (1.0 - 0.55 * f);
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; vCol = aCol;
          ${GLSL_POINT_SIZE}
          vec4 a = projectionMatrix * modelViewMatrix * vec4(uAtt, 1.0); vec2 toA = a.xy / a.w - gl_Position.xy / gl_Position.w;
          vStr = f; vQ = mix(aQ, 0.18, f * 0.85); vAng = mix(aAng, atan(toA.y, toA.x), f); // tidal stretch toward the clump
          gl_PointSize *= 1.0 + f; vB *= 1.0 - 0.6 * f;
        }`,
      fragmentShader: `varying vec3 vCol; varying float vB, vQ, vAng, vStr;
        void main() { vec2 q = gl_PointCoord * 2.0 - 1.0; q.y = -q.y; float c = cos(vAng), s = sin(vAng); vec2 e = vec2(c * q.x + s * q.y, (-s * q.x + c * q.y) / max(vQ, 0.1));
          float r = length(e); if (r > 1.0) discard;
          float I = exp(-7.67 * (pow(r * 6.0 + 0.02, 0.25) - 1.0)) * 0.06 * (1.0 - r * r);
          gl_FragColor = vec4(vCol * min(I, 2.5) * vB, 1.0); }`
    });
  }
  const GAS_FRAG = `uniform float uTime, uA, uKind; uniform vec2 uDir; varying vec2 vUv; ${GLSL_NOISE}
    void main() { float r = length(vUv); if (r > 1.0) discard;
      float n = fbm3(vec3(vUv * 2.6, uTime * 0.05 + uKind * 7.0));
      float a = smoothstep(1.0, 0.0, r) * smoothstep(0.25, 0.75, n) * 1.6;
      vec3 c = uKind < 0.5 ? mix(vec3(0.9, 0.25, 0.75), vec3(1.0, 0.55, 0.85), n) : vec3(0.25, 0.45, 1.0);
      if (uKind < 0.5) { float along = dot(normalize(vUv + 1e-4), uDir), band = exp(-pow((r - 0.55) / 0.06, 2.0)) * smoothstep(0.35, 0.9, along); a += band * 1.6 * length(uDir); } // a bow shock ahead of the gas
      gl_FragColor = vec4(c * a * a * uA, 1.0); }`;
  function cluster3dInit(S, X) {
    const THREE = X.THREE, D = S.data, sc = X.scene;
    X.maxPixelRatio = 1.25; X.setBloom(0.6, 0.2, 0.86); X.setExposure(1.05);
    D.lens = addLensPass(X); D.lens.uniforms.uMode.value = 1;
    sc.background = deepFieldTexture(THREE, 0.6);
    // only what lies behind the cluster is lensed: the members, the gas and the intracluster light are drawn after the lens pass
    const sc2 = new THREE.Scene(), ovPass = new THREE.RenderPass(sc2, X.camera); ovPass.clear = false; ovPass.clearDepth = true; X.composer.insertPass(ovPass, 2);
    // members: two clumps (a merger in progress, like El Gordo), red-sequence colours
    const nm = 1400, g = new THREE.BufferGeometry(), P3 = new Float32Array(nm * 3), C3 = new Float32Array(nm * 3), Sz = new Float32Array(nm), Q = new Float32Array(nm), A = new Float32Array(nm), Ph = new Float32Array(nm);
    const clumps = [[0, 0, 0, 1], [7.5, -1.5, -2, 0.55]];
    for (let i = 0; i < nm; i++) {
      const c = Math.random() < 0.68 ? clumps[0] : clumps[1], rr = -Math.log(1 - Math.random() * 0.97) * 3.2 * c[3];
      const v = new THREE.Vector3(gauss(), gauss() * 0.8, gauss()).normalize().multiplyScalar(rr);
      P3[i * 3] = c[0] + v.x * 1.3; P3[i * 3 + 1] = c[1] + v.y; P3[i * 3 + 2] = c[2] + v.z;
      const L = Math.pow(Math.random(), 3) * 1.6 + 0.08, col = bbLin(rand(3600, 4800)), blue = Math.random() < 0.12;
      const cc = blue ? bbLin(rand(7000, 12000)) : col;
      C3[i * 3] = cc[0] * L; C3[i * 3 + 1] = cc[1] * L; C3[i * 3 + 2] = cc[2] * L;
      Sz[i] = 0.12 + 0.55 * Math.pow(L, 0.7); Q[i] = rand(0.45, 1); A[i] = rand(0, TAU); Ph[i] = Math.random();
    }
    // the two brightest cluster galaxies, with their huge envelopes
    [[0, 0, 0, 7], [7.5, -1.5, -2, 4.5]].forEach((b, k) => { const i = k; P3[i * 3] = b[0]; P3[i * 3 + 1] = b[1]; P3[i * 3 + 2] = b[2]; const c = bbLin(4300); C3[i * 3] = c[0] * 9; C3[i * 3 + 1] = c[1] * 9; C3[i * 3 + 2] = c[2] * 9; Sz[i] = b[3]; Q[i] = 0.72; Ph[i] = 1; });
    [['position', P3, 3], ['aCol', C3, 3], ['aSize', Sz, 1], ['aQ', Q, 1], ['aAng', A, 1], ['aPh', Ph, 1]].forEach(([k, v, s]) => g.setAttribute(k, new THREE.BufferAttribute(v, s)));
    D.mU = { uScale: { value: 800 }, uPull: { value: 0 }, uTime: { value: 0 }, uAtt: { value: new THREE.Vector3(3, 0, 0) } };
    D.members = new THREE.Points(g, memberMaterial(THREE, D.mU)); D.members.frustumCulled = false; sc2.add(D.members);
    // intracluster light: diffuse starlight of shredded galaxies
    const icl = (x, y, z, s, op) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.ShaderMaterial({ uniforms: {}, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0); mv.xy += position.xy * vec2(1.3, 1.0); gl_Position = projectionMatrix * mv; }',
      fragmentShader: `varying vec2 vUv; void main(){ float r = length(vUv); gl_FragColor = vec4(vec3(1.0, 0.85, 0.65) * exp(-r * 3.2) * (1.0 - smoothstep(0.6, 1.0, r)) * ${op.toFixed(2)}, 1.0); }` })); m.position.set(x, y, z); m.frustumCulled = false; sc2.add(m); };
    icl(0, 0, 0, 22, 0.11); icl(7.5, -1.5, -2, 13, 0.08);
    // a handful of spiral members, as real point-cloud galaxies, falling in from the outskirts
    D.spirals = [];
    for (let k = 0; k < 5; k++) {
      const G = buildGalaxy(THREE, 6000, 10, { omega: 0.05, pitch: rand(0.25, 0.4), bright: 1.3 });
      const a = rand(0, TAU), rr = rand(9, 14); G.group.position.set(Math.cos(a) * rr, rand(-4, 4), Math.sin(a) * rr * 0.7);
      G.group.rotation.set(rand(0, TAU), rand(0, TAU), rand(0, TAU)); G.group.scale.setScalar(rand(0.08, 0.14));
      G.home = G.group.position.clone(); sc.add(G.group); D.spirals.push(G);
    }
    // the merger: dark matter (blue, as in lensing maps) leads, the hot X-ray gas (pink) lags and forms a bow shock
    D.gU = { uTime: { value: 0 }, uA: { value: 0 }, uKind: { value: 0 }, uDir: { value: new THREE.Vector2() } };
    D.dU2 = { uTime: D.gU.uTime, uA: { value: 0 }, uKind: { value: 1 }, uDir: { value: new THREE.Vector2() } };
    const bb = (U, s) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0); mv.xy += position.xy; gl_Position = projectionMatrix * mv; }', fragmentShader: GAS_FRAG })); m.frustumCulled = false; sc2.add(m); return m; };
    D.gas = bb(D.gU, 11); D.dm = bb(D.dU2, 15);
    D.letters = simplePoints(THREE, 240); sc2.add(D.letters);
    D.att = new THREE.Vector3(3, 0, 0); D.gasP = new THREE.Vector3(3, 0, 0); D.t0 = S.now; D.tmp = new THREE.Vector3();
    D.palLin = (S.mode.palette || []).map(lin); D.baseLin = lin(S.mode.base);
  }
  function cluster3dUpdate(S, X, now, dt) {
    const THREE = X.THREE, D = S.data, cam = X.camera, t = (now - D.t0) / 1000, m = D.dmS, sdt = Math.min(0.05, dt / 1000);
    const px = S.ptrInside ? S.ptr.x / S.W - 0.5 : 0, py = S.ptrInside ? S.ptr.y / S.H - 0.5 : 0, yaw = (S.reduceMotion ? 0 : t * 0.015) + px * 0.3 + S.rotY * 0.1, el = 0.15 + py * 0.2;
    cam.position.set(3 + Math.sin(yaw) * 30 * Math.cos(el), Math.sin(el) * 30, Math.cos(yaw) * 30 * Math.cos(el)); cam.lookAt(3, -0.5, -0.5); cam.updateMatrixWorld();
    const scl = pointScale(S, X); D.mU.uScale.value = scl; D.letters.material.uniforms.uScale.value = scl; D.mU.uTime.value = t;
    D.spirals.forEach((G) => { G.uni.uTime.value = t; G.uni.uScale.value = scl; });
    if (S.holding) { const hit = rayPlane(S, X, S.ptr.x, S.ptr.y, D.tmp.copy(cam.position).sub(new THREE.Vector3(3, -0.5, -0.5)).normalize(), new THREE.Vector3(3, -0.5, -0.5)); if (hit) { if (m.p < 0.05) { D.att.copy(hit); D.gasP.copy(hit); } else D.att.lerp(hit, 1 - Math.pow(0.9, dt / 16.7)); } }
    D.gasP.lerp(D.att, 1 - Math.pow(0.975, dt / 16.7));
    D.mU.uAtt.value.copy(D.att); D.mU.uPull.value = m.p;
    D.gas.position.copy(D.gasP); D.dm.position.copy(D.att); D.gU.uTime.value = t;
    D.gU.uA.value = 0.32 * m.p; D.dU2.uA.value = 0.12 * m.p; D.gas.scale.setScalar(0.6 + 0.8 * m.p); D.dm.scale.setScalar(0.6 + 0.8 * m.p);
    const a = D.att.clone().project(cam), b = D.gasP.clone().project(cam), dir = new THREE.Vector2(a.x - b.x, (a.y - b.y) / (S.W / S.H)); const dl = dir.length();
    D.gU.uDir.value.copy(dl > 0.005 ? dir.normalize().multiplyScalar(Math.min(1, dl * 12) * (S.stage >= 2 ? 1 : 0)) : dir.set(0, 0));
    // lensing by the dark matter clump (an extended halo: arcs near θE, untouched in the core)
    const U = D.lens.uniforms, pa = D.att.clone().project(cam), ppu = pxPerUnit(S, X, cam.position.distanceTo(D.att));
    U.uC.value.set((pa.x + 1) / 2, (pa.y + 1) / 2); U.uRes.value.set(S.W, S.H); U.uOn.value = m.p; U.uThE.value = 3.2 * ppu * m.p; U.uRmax.value = Math.min(3.2 * ppu * 4.5, S.H * 0.7); U.uCore.value = 1.2 * ppu; U.uRs.value = 0;
    // spirals fall toward the clump while held (and spring home after)
    D.spirals.forEach((G, i) => { const target = S.holding && m.p > 0.05 ? D.att : G.home; G.group.position.lerp(target, sdt * (S.holding ? 0.35 * m.p : 0.25)); G.group.rotation.y += sdt * 0.1 * (1 + 3 * m.p); });
    // letters: member galaxies near the centre, tinted by infection
    const LP = D.letters.geometry.attributes.position.array, LC = D.letters.geometry.attributes.aCol.array, LS = D.letters.geometry.attributes.aSize.array;
    let k = 0;
    for (const n of S.active) { if (k >= 240) break; const q = n.data.w3; if (!q) continue; LP[k * 3] = q.x; LP[k * 3 + 1] = q.y; LP[k * 3 + 2] = q.z; const c = n.inf ? D.palLin[n.gen % D.palLin.length] : D.baseLin, bb = n.inf ? 1.5 : 0.5; LC[k * 3] = c[0] * bb; LC[k * 3 + 1] = c[1] * bb; LC[k * 3 + 2] = c[2] * bb; LS[k] = n.inf ? 0.22 : 0.12; k++; }
    for (let j = k; j < 240; j++) LS[j] = 0;
    ['position', 'aCol', 'aSize'].forEach((x) => (D.letters.geometry.attributes[x].needsUpdate = true));
  }
  addMode({
    id: 'cluster', name: 'GALAXY CLUSTER', noHueShift: true, pageBg: ['#06060c', '#020308'],
    glyphs: '✦✧⋆∗✶◉◎⊙●○◌',
    base: [40, 70, 82], palette: [[38, 100, 70], [300, 90, 72], [195, 100, 70]],
    links: ['cosmos-faint'],
    shapes: ['sphere', 'galaxy', 'buckyball', 'torus', 'atom', 'lissajous'],
    init(S) { S.data.dmS = { p: 0 }; },
    three: { init: cluster3dInit, update: cluster3dUpdate },
    update(S, now, dt) { const m = S.data.dmS; if (S.holding) m.p = Math.pow(clamp((S.held - 150) / 4200, 0, 1), 0.8); else { m.p *= Math.pow(0.5, dt / 500); if (m.p < 0.004) m.p = 0; } },
    warp(S, n) { // letters are member galaxies; the clump drags them in too
      const X = S.three, D = S.data, d = n.data;
      if (!X || n.rx === undefined || !D.att) return;
      if (!d.w3) { d.w3 = new X.THREE.Vector3(); d.pull = 0; }
      const q = d.w3.set(3 + n.rx * 9, -0.5 - n.ry * 6, -0.5 + n.rz * 9), m = D.dmS;
      d.pull = S.holding ? Math.min(1, d.pull + S.dt * 0.0003 * m.p) : Math.max(0, d.pull - S.dt * 0.0008);
      if (d.pull > 0.001) { const o = q.clone().sub(D.att); o.applyAxisAngle(X.camera.position.clone().sub(D.att).normalize(), d.pull * 2.2); q.copy(D.att).addScaledVector(o, 1 - 0.6 * d.pull); }
      const s = X.toScreen(q); n.sx = s.x; n.sy = s.y; n.z = -X.camera.position.distanceTo(q);
    },
    drawNode(S, ctx, n, g, size, a) { return S.three ? drawGlyph(S, ctx, n, g, size, a * 0.75, 0.5) : false; },
    onClimax() { return false; },
    onRelease(S) { return S.data.dmS.p > 0.1 ? false : undefined; },
    hud(S) {
      const m = S.data.dmS;
      if (S.holding && m.p > 0.03) return `cluster merger at ${big(600 + 3900 * m.p)} km/s · gas ${sci(2e7 + 1.6e8 * m.p)} K, shocked${S.stage >= 2 ? ' (bow shock, Mach ' + (1 + 2.2 * m.p).toFixed(1) + ')' : ''} · the dark matter passes straight through`;
      return '~1,400 member galaxies, 2×10¹⁵ M☉ · 85% of it dark matter, seen only by how it bends the light behind · hold to merge';
    }
  });
  /* ======================= 3. NEBULA: ray-marched pillars of gas, lit by young stars, and a supernova ======================= */
  // Volume rendering at reduced resolution into a render target (every other frame), shown as the scene background.
  // Density: three eroded pillars, a dusty base and a diffuse back sheet. Light: a hot young cluster above the frame
  // ionises the surfaces facing it (Hα red, [OIII] teal in the hotter interior), dust absorbs along the ray.
  const NEB_FRAG = `
    uniform vec2 uRes; uniform mat4 uInvProj, uCamWorld; uniform vec3 uCam; uniform float uTime;
    uniform vec4 uSN; uniform float uSNage, uSNon; uniform vec4 uWake;
    varying vec2 vUv;
    ${GLSL_NOISE}
    float fbm2(vec3 p) { return 0.5 * vn3(p) + 0.25 * vn3(p * 2.03 + 3.1); }
    vec3 pushed(vec3 p) { // the supernova blast and the pointer's wake push the gas aside
      if (uSNon > 0.0) { vec3 d = p - uSN.xyz; float r = length(d) + 1e-3, R = uSN.w;
        if (r < R * 1.1) p = uSN.xyz + d / r * (r * pow(clamp(r / (R * 1.1), 0.0, 1.0), 0.8 * uSNon)); }
      if (uWake.w > 0.0) { vec2 d = p.xy - uWake.xy; p.xy -= d * 0.55 * uWake.w * exp(-dot(d, d) * 0.4); }
      return p;
    }
    float pillar(vec3 p, vec2 base, float top, float w, float lean) {
      float t = clamp((top - p.y) / (top + 7.0), 0.0, 1.0);
      vec2 c = base + vec2(lean * (1.0 - t), 0.0) + vec2(sin(p.y * 0.7 + base.x) * 0.25, 0.0);
      return length(vec2(length(p.xz - c), max(p.y - top, 0.0))) - w * (0.5 + 1.4 * t * t); // a rounded head on a widening column
    }
    float density(vec3 q, out float pill) {
      vec3 p = pushed(q);
      float n = fbm3(p * 0.55 + vec3(0.0, uTime * 0.006, 0.0));
      float d = min(min(pillar(p, vec2(-4.2, 0.0), 6.3, 1.1, 0.9), pillar(p, vec2(0.6, -0.5), 2.2, 0.9, -0.4)), pillar(p, vec2(4.6, 0.4), 0.2, 0.75, -0.7));
      d = min(d, p.y + 5.6 + (n - 0.5) * 2.5); // the dusty base the pillars rise from
      d += (n - 0.5) * 1.7 + (vn3(p * 2.3) - 0.5) * 0.5;
      pill = smoothstep(0.7, -0.5, d);
      float sheet = smoothstep(0.5, 0.8, fbm3(p * 0.3 + 4.0)) * smoothstep(-2.0, -5.0, p.z) * 0.3; // diffuse gas behind
      return pill * 1.6 + sheet;
    }
    void main() {
      vec4 v = uInvProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0); v /= v.w;
      vec3 rd = normalize((uCamWorld * vec4(v.xyz, 0.0)).xyz), ro = uCam;
      // march through the slab |z| < 6
      float t0 = (6.0 - ro.z) / rd.z, t1 = (-6.0 - ro.z) / rd.z; if (t0 > t1) { float s = t0; t0 = t1; t1 = s; }
      t0 = max(t0, 0.0);
      const int STEPS = 26; float ds = (t1 - t0) / float(STEPS);
      vec3 col = vec3(0.0); float T = 1.0;
      vec3 L = normalize(vec3(-0.15, 1.0, 0.25)); // the young cluster is above the frame
      float jitter = h13(vec3(gl_FragCoord.xy, uTime)) * ds;
      for (int i = 0; i < STEPS; i++) {
        vec3 p = ro + rd * (t0 + jitter + ds * float(i));
        float pill; float rho = density(p, pill);
        if (rho > 0.01) {
          float pl; float toward = density(p + L * 0.9, pl);
          float front = clamp((pill - pl) * 2.2, 0.0, 1.0) * smoothstep(0.05, 0.4, pill); // a pillar surface facing the cluster: an ionisation front
          float lit = exp(-toward * 1.4);
          float height = smoothstep(-6.0, 7.0, p.y);
          vec3 em = (vec3(1.0, 0.45, 0.22) * front * front * 0.9 + vec3(1.0, 0.1, 0.08) * front * 0.3) * (0.25 + height)   // ionisation fronts: hot rims, Hα red fringe
                  + vec3(0.10, 0.48, 0.50) * rho * (1.0 - pill) * (0.2 + height) * 0.28                          // [OIII] in the hot, thin gas
                  + vec3(0.16, 0.08, 0.04) * pill * lit * 0.12;                                                // dusty pillar bodies, faintly lit
          if (uSNon > 0.0) { // the supernova lights the gas: an expanding shell of light (a light echo) and the blast itself
            vec3 d = p - uSN.xyz; float r = length(d);
            float echo = exp(-pow((r - uSNage * 4.0) / 1.2, 2.0)) * exp(-uSNage * 0.25);
            float shell = exp(-pow((r - uSN.w) / 0.35, 2.0)) * (0.4 + 1.4 * fbm2(d * 2.5));
            em += vec3(0.55, 0.7, 1.0) * echo * rho * 0.6 * uSNon + (vec3(1.0, 0.25, 0.2) + vec3(0.1, 0.9, 0.8) * fbm2(d * 3.0 + 7.0)) * shell * 3.0 * uSNon;
          }
          col += T * em * ds;
          T *= exp(-(rho * 0.6 + pill * 2.2) * ds);
          if (T < 0.02) break;
        }
      }
      if (uSNon > 0.0) { vec3 d = uSN.xyz - ro; float b = dot(d, rd), r2 = dot(d, d) - b * b; // the shell seen in projection, where the gas is thin
        float r = sqrt(max(r2, 0.0)); col += T * (vec3(1.0, 0.3, 0.25) * exp(-pow((r - uSN.w) / 0.25, 2.0)) * 0.6 + vec3(0.6, 0.7, 1.0) * exp(-r * r * 8.0) * 3.0) * uSNon; }
      col += T * mix(vec3(0.004, 0.008, 0.016), vec3(0.03, 0.05, 0.07), smoothstep(-0.3, 0.6, rd.y)); // deep background haze
      gl_FragColor = vec4(col, 1.0);
    }`;
  function spikeStarMaterial(THREE) { // stars with JWST-style six-point diffraction spikes for the bright ones
    return new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 800 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `uniform float uScale; attribute vec3 aCol; attribute float aSize; varying vec3 vCol; varying float vB, vSp;
        void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; vCol = aCol; ${GLSL_POINT_SIZE} vSp = 0.0; if (aSize > 0.25) { gl_PointSize *= 7.0; vSp = 1.0; } }`,
      fragmentShader: `varying vec3 vCol; varying float vB, vSp;
        void main() { vec2 q = gl_PointCoord * 2.0 - 1.0; float d2 = dot(q, q); if (d2 > 1.0) discard;
          float a;
          if (vSp > 0.5) { float r = sqrt(d2), ang = atan(q.y, q.x), s = 0.0;
            for (int k = 0; k < 6; k++) { float th = 1.5708 + float(k) * 1.0472; s += exp(-pow(sin(ang - th) * r * 60.0, 2.0)) * step(0.0, cos(ang - th)); }
            s += 0.5 * exp(-pow(q.y * 60.0, 2.0)) * exp(-abs(q.x) * 6.0);
            a = exp(-d2 * 260.0) * 3.0 + (exp(-d2 * 18.0) * 0.25 + s * 0.6) * pow(1.0 - r, 2.0);
          } else a = exp(-d2 * 5.5);
          gl_FragColor = vec4(vCol * a * vB, 1.0); }`
    });
  }
  function nebula3dInit(S, X) {
    const THREE = X.THREE, D = S.data, sc = X.scene;
    X.maxPixelRatio = 1.25;
    X.setBloom(0.55, 0.15, 0.88); X.setExposure(1.15);
    D.q = 0.32;
    D.rt = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, depthBuffer: false });
    D.nU = { uRes: { value: new THREE.Vector2() }, uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uCam: { value: new THREE.Vector3() }, uTime: { value: 0 },
      uSN: { value: new THREE.Vector4() }, uSNage: { value: 0 }, uSNon: { value: 0 }, uWake: { value: new THREE.Vector4() } };
    D.gasScene = new THREE.Scene(); D.gasCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    D.gasQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: D.nU, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: NEB_FRAG, depthTest: false, depthWrite: false }));
    D.gasQuad.frustumCulled = false; D.gasScene.add(D.gasQuad);
    sc.background = D.rt.texture;
    // stars: field stars in front, newborn red ones at the pillar tips, a few bright blue ones with spikes
    const ns = 900, g = new THREE.BufferGeometry(), P3 = new Float32Array(ns * 3), C3 = new Float32Array(ns * 3), Sz = new Float32Array(ns);
    for (let i = 0; i < ns; i++) {
      let x = rand(-16, 16), y = rand(-10, 10), z = rand(-5, 7), T = rand(3000, 12000), L = Math.pow(Math.random(), 5) * 1.6 + 0.05, sz = 0.04 + 0.05 * L;
      if (i < 24) { const tips = [[-4.2 + 0.9, 5.5], [0.6 - 0.4, 1.4], [4.6 - 0.7, -0.6]], tp = tips[i % 3]; x = tp[0] + gauss() * 0.4; y = tp[1] + rand(-0.6, 0.4); z = gauss() * 0.4; T = rand(2200, 3200); L = rand(0.4, 1.2); sz = 0.06; }
      if (i >= 24 && i < 32) { T = rand(12000, 30000); L = rand(2, 4); sz = 0.3; }
      const c = bbLin(T); P3[i * 3] = x; P3[i * 3 + 1] = y; P3[i * 3 + 2] = z; C3[i * 3] = c[0] * L; C3[i * 3 + 1] = c[1] * L; C3[i * 3 + 2] = c[2] * L; Sz[i] = sz;
    }
    g.setAttribute('position', new THREE.BufferAttribute(P3, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(C3, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(Sz, 1));
    D.stars = new THREE.Points(g, spikeStarMaterial(THREE)); D.stars.frustumCulled = false; sc.add(D.stars);
    D.starHome = P3.slice();
    D.letters = simplePoints(THREE, 240); sc.add(D.letters);
    D.snPt = simplePoints(THREE, 1); sc.add(D.snPt);
    D.t0 = S.now; D.frame = 0; D.tmp = new THREE.Vector3();
    D.palLin = (S.mode.palette || []).map(lin); D.baseLin = lin(S.mode.base);
  }
  function nebula3dUpdate(S, X, now, dt) {
    const THREE = X.THREE, D = S.data, cam = X.camera, t = (now - D.t0) / 1000, sn = D.sn;
    // camera: a slow push-in with a little drift; the pointer adds parallax
    const px = S.ptrInside ? S.ptr.x / S.W - 0.5 : 0, py = S.ptrInside ? S.ptr.y / S.H - 0.5 : 0, slow = S.reduceMotion ? 0 : 1;
    cam.position.set(Math.sin(t * 0.03) * 1.6 * slow + px * 2.5, -0.5 + Math.sin(t * 0.021) * 0.6 * slow - py * 1.6, 19 - 2.5 * Math.sin(t * 0.015) * slow);
    cam.lookAt(0, 0.2, 0); cam.updateMatrixWorld();
    const pr = X.renderer.getPixelRatio(), w = Math.max(16, Math.round(S.W * pr * D.q)), h = Math.max(16, Math.round(S.H * pr * D.q));
    if (D.rt.width !== w || D.rt.height !== h) D.rt.setSize(w, h);
    const U = D.nU; U.uRes.value.set(w, h); U.uInvProj.value.copy(cam.projectionMatrixInverse); U.uCamWorld.value.copy(cam.matrixWorld); U.uCam.value.copy(cam.position); U.uTime.value = t;
    // the supernova (see update): progenitor, then the blast
    if (sn && sn.boom) { const age = (now - sn.boom) / 1000; U.uSNon.value = sn.A; U.uSNage.value = age; U.uSN.value.set(sn.p.x, sn.p.y, sn.p.z, 7.5 * (1 - Math.exp(-age / 2.6))); }
    else U.uSNon.value = 0;
    // the pointer's wake parts the gas
    const v = S.ptrVel || { x: 0, y: 0 }, spd = Math.hypot(v.x, v.y);
    if (!S.holding && spd > 3 && S.ptrInside) { const hit = rayPlane(S, X, S.ptr.x, S.ptr.y, new THREE.Vector3(0, 0, 1), new THREE.Vector3()); if (hit) U.uWake.value.set(hit.x, hit.y, 0, Math.min(1, spd / 25)); }
    U.uWake.value.w *= Math.pow(0.5, dt / 500);
    if (D.frame++ % 2 === 0 || (sn && sn.boom)) { const r = X.renderer, prev = r.getRenderTarget(); r.setRenderTarget(D.rt); r.render(D.gasScene, D.gasCam); r.setRenderTarget(prev); }
    const scl = pointScale(S, X); D.stars.material.uniforms.uScale.value = D.letters.material.uniforms.uScale.value = D.snPt.material.uniforms.uScale.value = scl;
    // the blast pushes the stars too; afterwards they drift home
    const P3 = D.stars.geometry.attributes.position.array, H3 = D.starHome, R = U.uSN.value.w * U.uSNon.value;
    for (let i = 0; i < P3.length; i += 3) {
      let x = H3[i], y = H3[i + 1], z = H3[i + 2];
      if (R > 0.1) { const dx = x - sn.p.x, dy = y - sn.p.y, dz = z - sn.p.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-3; if (d < R) { const f = R / d; x = sn.p.x + dx * f; y = sn.p.y + dy * f; z = sn.p.z + dz * f; } }
      P3[i] += (x - P3[i]) * 0.1; P3[i + 1] += (y - P3[i + 1]) * 0.1; P3[i + 2] += (z - P3[i + 2]) * 0.1;
    }
    D.stars.geometry.attributes.position.needsUpdate = true;
    // the progenitor / the remnant's pulsar as a single bright point
    const sp = D.snPt.geometry.attributes;
    if (sn) {
      sp.position.array.set([sn.p.x, sn.p.y, sn.p.z]);
      let c, s;
      if (!sn.boom) { const k = clamp((now - sn.t0) / 1200, 0, 1); c = bbLin(3200); s = 0.15 + 0.5 * k * (k > 0.9 ? Math.max(0, 1 - (k - 0.9) * 8) : 1); const L = 2 + 3 * k; c = c.map((x) => x * L * (sn.rel ? Math.max(0, 1 - (now - sn.rel) / 1200) : 1)); }
      else { const age = (now - sn.boom) / 1000, peak = Math.exp(-age / 1.1); c = bbLin(12000).map((x) => x * (40 * peak + 1.5) * sn.A); s = 0.2 + 1.8 * peak; }
      sp.aCol.array.set(c); sp.aSize.array[0] = s;
    } else sp.aSize.array[0] = 0;
    sp.position.needsUpdate = sp.aCol.needsUpdate = sp.aSize.needsUpdate = true;
    // letters: embedded protostars
    const LP = D.letters.geometry.attributes.position.array, LC = D.letters.geometry.attributes.aCol.array, LS = D.letters.geometry.attributes.aSize.array;
    let k = 0;
    for (const n of S.active) { if (k >= 240) break; const q = n.data.w3; if (!q) continue; LP[k * 3] = q.x; LP[k * 3 + 1] = q.y; LP[k * 3 + 2] = q.z; const c = n.inf ? D.palLin[n.gen % D.palLin.length] : D.baseLin, b = n.inf ? 1.6 : 0.6; LC[k * 3] = c[0] * b; LC[k * 3 + 1] = c[1] * b; LC[k * 3 + 2] = c[2] * b; LS[k] = n.inf ? 0.12 : 0.07; k++; }
    for (let j = k; j < 240; j++) LS[j] = 0;
    ['position', 'aCol', 'aSize'].forEach((a) => (D.letters.geometry.attributes[a].needsUpdate = true));
  }
  addMode({
    id: 'nebula', name: 'NEBULA', pageBg: ['#060b12', '#0c0806'],
    glyphs: '✦✧✶✷✸∗⁕※★',
    base: [35, 60, 88], palette: [[8, 100, 64], [175, 85, 58], [45, 100, 66]],
    links: ['cosmos-faint'],
    shapes: ['sphere', 'urchin', 'seashell', 'helix', 'lissajous'],
    init(S) { S.data.sn = null; S.data.count = 0; },
    three: { init: nebula3dInit, update: nebula3dUpdate, exit(S) { if (S.data.rt) S.data.rt.dispose(); } },
    onPress(S, x, y) { S.data.press = { x, y }; }, // the supernova starts only once a press outlasts a tap
    update(S, now) {
      const D = S.data, X = S.three;
      if (S.holding && D.press && S.held > 250 && X) { const hit = rayPlane(S, X, D.press.x, D.press.y, new X.THREE.Vector3(0, 0, 1), new X.THREE.Vector3(0, 0, 0.5)); if (hit) D.sn = { p: hit, t0: now, boom: 0, rel: 0, A: 1 }; D.press = null; }
      if (!S.holding) D.press = null;
      const sn = D.sn; if (!sn) return;
      if (!sn.boom && S.holding && now - sn.t0 > 1200) { sn.boom = now; D.count++; if (!S.reduceMotion && X) D.flashE = 0.5; }
      if (!S.holding && !sn.rel) sn.rel = now;
      if (sn.rel) sn.A = sn.boom ? clamp(1 - (now - Math.max(sn.rel, sn.boom + 3000)) / 6000, 0, 1) : 0;
      if (sn.rel && (sn.A <= 0) && now - sn.rel > 1300) D.sn = null;
      if (X && D.flashE > 0.001) { D.flashE *= 0.93; X.setExposure(1.15 + D.flashE); }
    },
    warp(S, n) { // letters are protostars inside the cloud; the blast wave carries them outward
      const X = S.three, D = S.data, d = n.data;
      if (!X || n.rx === undefined) return;
      if (!d.w3) d.w3 = new X.THREE.Vector3();
      const q = d.w3.set(n.rx * 6, -n.ry * 6 + 0.5, n.rz * 3), sn = D.sn;
      if (sn && sn.boom) { const R = 7.5 * (1 - Math.exp(-(S.now - sn.boom) / 2600)) * sn.A, o = q.clone().sub(sn.p), r = o.length() + 1e-3; if (r < R * 1.05) q.copy(sn.p).addScaledVector(o, R * 1.05 / r); }
      const s = X.toScreen(q); n.sx = s.x; n.sy = s.y; n.z = -X.camera.position.distanceTo(q);
    },
    drawNode(S, ctx, n, g, size, a) { return S.three ? drawGlyph(S, ctx, n, g, size, a * 0.7, 0.5) : false; },
    onClimax() { return false; },
    onRelease(S) { return S.data.sn && S.data.sn.boom ? false : undefined; },
    hud(S) {
      const D = S.data, sn = D.sn;
      if (sn && !sn.boom) return sn.rel ? 'the core collapsed quietly into a black hole: a failed supernova (they happen)' : `red supergiant, 18 M☉, iron core at 1.4 M☉ · collapse in ${Math.max(0, (1200 - (S.now - sn.t0)) / 1000).toFixed(1)} s`;
      if (sn && sn.boom) { const t = (S.now - sn.boom) / 1000; return `type II supernova · ejecta ${big(10000 * Math.exp(-t / 25))} km/s · the bright ring is a light echo, not matter · ${t > 3 ? 'remnant: a 20 km neutron star' : '10⁴⁴ J released in neutrinos'}`; }
      return `pillars of gas and dust ~4 ly tall, eroded by ultraviolet light from stars above the frame · Hα in red, [O III] in teal${D.count ? ' · supernovae: ' + D.count : ''}`;
    }
  });
  /* ======================= 4. ORRERY: a lit, textured solar system on real Kepler orbits ======================= */
  // a: semi-major axis (AU), e, i (deg), node and perihelion (deg), radius in the scene, sidereal period (years)
  const PLAN = [
    { n: 'Mercury', g: '☿', a: 0.387, e: 0.206, i: 7.0, O: 48, w: 29, r: 0.45, T: 0.241 },
    { n: 'Venus', g: '♀', a: 0.723, e: 0.007, i: 3.4, O: 77, w: 55, r: 0.69, T: 0.615, atm: [1.0, 0.85, 0.55, 1.6] },
    { n: 'Earth', g: '⊕', a: 1.0, e: 0.017, i: 0.0, O: 0, w: 114, r: 0.72, T: 1, atm: [0.35, 0.6, 1.0, 1.4], moons: [[2.6, 0.12, 27]] },
    { n: 'Mars', g: '♂', a: 1.524, e: 0.093, i: 1.85, O: 49, w: 287, r: 0.53, T: 1.88, atm: [1.0, 0.6, 0.45, 0.5] },
    { n: 'Jupiter', g: '♃', a: 5.2, e: 0.049, i: 1.3, O: 100, w: 274, r: 2.0, T: 11.86, moons: [[1.9, 0.07, 1.8], [2.3, 0.06, 3.6], [2.9, 0.09, 7.2], [3.6, 0.08, 16.7]] },
    { n: 'Saturn', g: '♄', a: 9.54, e: 0.057, i: 2.5, O: 113, w: 339, r: 1.75, T: 29.46, ring: 1, moons: [[3.4, 0.09, 16]] },
    { n: 'Uranus', g: '♅', a: 19.2, e: 0.046, i: 0.8, O: 74, w: 97, r: 1.2, T: 84, atm: [0.6, 0.95, 1.0, 1.0], tilt: 97.8 },
    { n: 'Neptune', g: '♆', a: 30.1, e: 0.009, i: 1.8, O: 131, w: 273, r: 1.15, T: 164.8, atm: [0.35, 0.55, 1.0, 1.1], moons: [[2.2, 0.06, -5.9]] },
    { n: 'Pluto', g: '♇', a: 39.5, e: 0.249, i: 17.1, O: 110, w: 113, r: 0.28, T: 248 }
  ];
  function voyager() { return 24.4e9 + (Date.now() - Date.UTC(2024, 0, 1)) / 1000 * 17; }
  const aScene = (aAU) => 5.5 + 27 * Math.sqrt(aAU / 30); // orbits compressed (sqrt), sizes exaggerated: an orrery
  const tScene = (T) => 9 * Math.pow(T, 0.55); // seconds per orbit (compressed)
  function keplerPos(P, aS, Tsec, t, M0, out) {
    const M = t / Tsec * TAU + M0, e = P.e;
    let E = M + e * Math.sin(M); for (let i = 0; i < 3; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    const x = aS * (Math.cos(E) - e), y = aS * Math.sqrt(1 - e * e) * Math.sin(E);
    const w = P.w * Math.PI / 180, O = P.O * Math.PI / 180, inc = P.i * Math.PI / 180;
    const xw = x * Math.cos(w) - y * Math.sin(w), yw = x * Math.sin(w) + y * Math.cos(w); // perihelion
    const yi = yw * Math.cos(inc), zi = yw * Math.sin(inc); // inclination
    return out.set(xw * Math.cos(O) - yi * Math.sin(O), zi, xw * Math.sin(O) + yi * Math.cos(O)); // node; y is up
  }
  // Equirectangular planet textures, painted from 3D Perlin noise on the sphere (seamless). Cached between visits.
  const PTEX = {};
  function paintPlanet(X, idx, w, h) {
    if (PTEX[idx]) return PTEX[idx];
    const N = X.noise, c = mk(w, h), g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
    const fbm = (x, y, z, o) => { let s = 0, a = 0.5; for (let k = 0; k < o; k++) { s += a * N.noise(x, y, z); x *= 2.03; y *= 2.03; z *= 2.03; a *= 0.5; } return s; };
    const bump = mk(w, h), bg = bump.getContext('2d'), bimg = bg.createImageData(w, h), bd = bimg.data;
    const seed = idx * 17.3;
    for (let j = 0; j < h; j++) {
      const lat = (0.5 - (j + 0.5) / h) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
      for (let i = 0; i < w; i++) {
        const lon = (i + 0.5) / w * TAU, x = cl * Math.cos(lon), y = sl, z = cl * Math.sin(lon);
        let r = 0, gg = 0, b = 0, hgt = 0.5;
        if (idx === 0 || idx === 8) { // Mercury, Pluto: regolith, craters as noise ridges
          const n = fbm(x * 4 + seed, y * 4, z * 4, 5), cr = Math.abs(N.noise(x * 11 + seed, y * 11, z * 11));
          hgt = 0.5 + n * 0.6 - Math.pow(1 - cr, 8) * 0.4;
          if (idx === 0) { const v = 105 + 70 * n - 40 * Math.pow(1 - cr, 8); r = v; gg = v * 0.96; b = v * 0.92; }
          else { const heart = smooth(0.25, 0.05, Math.hypot(x - 0.6, y + 0.1, z - 0.75)); r = 150 + 60 * n + 70 * heart; gg = 118 + 50 * n + 70 * heart; b = 90 + 40 * n + 70 * heart; }
        } else if (idx === 1) { // Venus: sulphuric cloud deck, sheared bands
          const n = fbm(x * 2 + fbm(x * 3, y * 8, z * 3, 3) * 1.5, y * 6, z * 2, 5);
          r = 225 + 25 * n; gg = 196 + 30 * n; b = 140 + 30 * n;
        } else if (idx === 2) { // Earth: oceans, continents, deserts, ice
          const n = fbm(x * 2.2 + seed, y * 2.2, z * 2.2, 6), land = n > 0.06, ice = Math.abs(sl) > 0.86 - 0.05 * n;
          if (ice) { r = gg = 236; b = 245; hgt = 0.7; }
          else if (land) { const dry = smooth(0.0, 0.35, 1 - Math.abs(Math.abs(sl) - 0.42) * 3 + fbm(x * 5, y * 5, z * 5, 3)); r = 70 + 110 * dry; gg = 95 + 60 * dry; b = 45 + 40 * dry; hgt = 0.6 + n; }
          else { const deep = clamp(-n * 3, 0, 1); r = 10 + 20 * (1 - deep); gg = 40 + 50 * (1 - deep); b = 95 + 60 * (1 - deep); hgt = 0.2; }
        } else if (idx === 3) { // Mars: rust, dark albedo regions, polar cap
          const n = fbm(x * 3 + seed, y * 3, z * 3, 6), cap = sl > 0.9 - 0.04 * n;
          if (cap) { r = gg = 240; b = 235; } else { r = 175 + 50 * n; gg = 85 + 30 * n; b = 50 + 20 * n; if (n < -0.08) { r *= 0.6; gg *= 0.6; b *= 0.65; } }
          hgt = 0.5 + n;
        } else { // gas and ice giants: latitude bands sheared by turbulence
          const turb = fbm(x * 3 + seed, y * 3, z * 3, 4), band = Math.sin((y + turb * 0.08) * (idx === 4 ? 26 : idx === 5 ? 20 : 10)) * 0.5 + 0.5, fine = fbm(x * 9, y * 40, z * 9, 3);
          const pal = idx === 4 ? [[216, 202, 180], [178, 128, 92]] : idx === 5 ? [[226, 208, 160], [196, 168, 116]] : idx === 6 ? [[178, 226, 232], [158, 210, 220]] : [[70, 110, 220], [46, 74, 170]];
          const k = clamp(band + fine * 0.6, 0, 1);
          r = pal[0][0] * k + pal[1][0] * (1 - k); gg = pal[0][1] * k + pal[1][1] * (1 - k); b = pal[0][2] * k + pal[1][2] * (1 - k);
          if (idx === 4) { const s = Math.hypot((lon - 4.2) * 1.2, (lat + 0.38) * 3); if (s < 0.35) { const f = smooth(0.35, 0.1, s); r = r * (1 - f) + 190 * f; gg = gg * (1 - f) + 95 * f; b = b * (1 - f) + 70 * f; } } // Great Red Spot
          if (idx === 7) { const s = Math.hypot((lon - 2) * 1.5, (lat + 0.35) * 3); if (s < 0.3) { r *= 0.55; gg *= 0.55; b *= 0.7; } }
        }
        const o = (j * w + i) * 4;
        d[o] = clamp(r, 0, 255); d[o + 1] = clamp(gg, 0, 255); d[o + 2] = clamp(b, 0, 255); d[o + 3] = 255;
        const hv = clamp(hgt * 255, 0, 255); bd[o] = bd[o + 1] = bd[o + 2] = hv; bd[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0); bg.putImageData(bimg, 0, 0);
    PTEX[idx] = { c, bump };
    return PTEX[idx];
  }
  function cloudCanvas(X) {
    if (PTEX.clouds) return PTEX.clouds;
    const N = X.noise, w = 512, h = 256, c = mk(w, h), g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
    for (let j = 0; j < h; j++) { const lat = (0.5 - (j + 0.5) / h) * Math.PI; for (let i = 0; i < w; i++) {
      const lon = (i + 0.5) / w * TAU, x = Math.cos(lat) * Math.cos(lon), y = Math.sin(lat), z = Math.cos(lat) * Math.sin(lon);
      let s = 0, a = 0.5, f = 3; for (let k = 0; k < 5; k++) { s += a * N.noise(x * f + 40, y * f * 1.6, z * f); f *= 2; a *= 0.5; }
      const v = clamp((s - 0.02) * 3.2, 0, 1), o = (j * w + i) * 4; d[o] = d[o + 1] = d[o + 2] = 255; d[o + 3] = v * 255; } }
    g.putImageData(img, 0, 0); PTEX.clouds = c; return c;
  }
  function ringCanvas() {
    if (PTEX.ring) return PTEX.ring;
    const c = mk(1024, 8), g = c.getContext('2d');
    for (let i = 0; i < 1024; i++) {
      const t = i / 1024; let a = 0.55 + 0.35 * Math.sin(t * 90) * Math.sin(t * 23 + 1) + 0.2 * Math.random();
      if (t > 0.56 && t < 0.62) a *= 0.08; // the Cassini division
      if (t < 0.12) a *= t / 0.12 * 0.5; if (t > 0.9) a *= (1 - t) / 0.1;
      const l = 190 + 50 * Math.sin(t * 40);
      g.fillStyle = `rgba(${l | 0},${(l * 0.9) | 0},${(l * 0.75) | 0},${clamp(a, 0, 1).toFixed(3)})`; g.fillRect(i, 0, 1, 8);
    }
    PTEX.ring = c; return c;
  }
  function texFrom(X, canvas, srgb) { const t = new X.THREE.CanvasTexture(canvas); if (srgb) t.encoding = X.THREE.sRGBEncoding; t.anisotropy = 4; return t; }
  function atmoMaterial(THREE, col, k) {
    return new THREE.ShaderMaterial({
      uniforms: { uC: { value: new THREE.Vector3(col[0], col[1], col[2]) }, uK: { value: k }, uSun: { value: new THREE.Vector3() } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
      vertexShader: 'varying vec3 vN, vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform vec3 uC, uSun; uniform float uK; varying vec3 vN, vW;
        void main() { vec3 V = normalize(cameraPosition - vW), L = normalize(uSun - vW); float rim = pow(1.0 - max(dot(vN, V), 0.0), 2.6);
          float day = smoothstep(-0.25, 0.4, dot(vN, L)); gl_FragColor = vec4(uC * rim * day * uK, 1.0); }`
    });
  }
  function orrery3dInit(S, X) {
    const THREE = X.THREE, D = S.data, sc = X.scene;
    X.maxPixelRatio = 1.5;
    X.setBloom(0.5, 0.1, 0.92); X.setExposure(1.1);
    sc.background = new THREE.Color(0x020308).convertSRGBToLinear();
    // the sky: blackbody stars and a faint Milky Way band, on a big sphere
    const ns = 9000, sky = simplePoints(THREE, ns), sp = sky.geometry.attributes.position.array, scol = sky.geometry.attributes.aCol.array, ss = sky.geometry.attributes.aSize.array;
    const band = new THREE.Vector3(0.3, 1, 0.2).normalize(), tmp = new THREE.Vector3();
    for (let i = 0; i < ns; i++) {
      tmp.set(gauss(), gauss(), gauss()).normalize();
      if (i < ns * 0.55) { tmp.addScaledVector(band, -tmp.dot(band) * (1 - Math.abs(gauss()) * 0.12)).normalize(); }
      tmp.multiplyScalar(900); sp[i * 3] = tmp.x; sp[i * 3 + 1] = tmp.y; sp[i * 3 + 2] = tmp.z;
      const c = bbLin(rand(3000, 12000)), L = Math.pow(Math.random(), 6) * 2 + 0.05;
      scol[i * 3] = c[0] * L; scol[i * 3 + 1] = c[1] * L; scol[i * 3 + 2] = c[2] * L; ss[i] = 1.6 + L * 2;
    }
    sc.add(sky); D.sky = sky;
    // the Sun: granulation and limb darkening in the shader, a corona glow, and the light (with shadows)
    D.sunU = { uTime: { value: 0 } };
    const sun = new THREE.Mesh(new THREE.SphereGeometry(2.4, 64, 48), new THREE.ShaderMaterial({
      uniforms: D.sunU,
      vertexShader: 'varying vec3 vN, vP, vW; void main(){ vP = position; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform float uTime; varying vec3 vN, vP, vW; ${GLSL_BB} ${GLSL_NOISE}
        void main() { vec3 V = normalize(cameraPosition - vW); float mu = max(dot(vN, V), 0.0);
          float gran = fbm3(vP * 9.0 + vec3(0.0, uTime * 0.15, 0.0)), spots = smoothstep(0.62, 0.7, fbm3(vP * 1.3 + 7.0));
          float limb = 0.4 + 0.6 * pow(mu, 0.5);
          vec3 c = blackbody(5200.0 + 1400.0 * mu) * (0.75 + 0.5 * gran) * limb * (1.0 - 0.7 * spots);
          gl_FragColor = vec4(c * 9.0, 1.0); }`
    }));
    sc.add(sun);
    const corona = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.ShaderMaterial({
      uniforms: D.sunU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0); mv.xy += position.xy; gl_Position = projectionMatrix * mv; }',
      fragmentShader: `uniform float uTime; varying vec2 vUv; ${GLSL_NOISE}
        void main() { float r = length(vUv) * 13.0, a = atan(vUv.y, vUv.x); float streak = 0.7 + 0.3 * fbm3(vec3(cos(a) * 3.0, sin(a) * 3.0, uTime * 0.05));
          float g = (exp(-(r - 2.4) * 0.9) * streak * step(2.3, r) + 0.12 * exp(-r * 0.3)) * (1.0 - smoothstep(0.6, 1.0, length(vUv))); gl_FragColor = vec4(vec3(1.0, 0.72, 0.42) * g * 1.4, 1.0); }`
    }));
    corona.frustumCulled = false; sc.add(corona);
    const light = new THREE.PointLight(0xfff1dc, 9, 0, 0); light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024); light.shadow.camera.near = 2.5; light.shadow.camera.far = 90; light.shadow.bias = -0.002; light.shadow.radius = 2;
    sc.add(light);
    sc.add(new THREE.HemisphereLight(0x223355, 0x110d08, 0.06));
    // planets
    D.planets = PLAN.map((P, k) => {
      const big = k === 2 || k === 4 || k === 5, tx = paintPlanet(X, k, big ? 512 : 256, big ? 256 : 128);
      const mat = new THREE.MeshStandardMaterial({ map: texFrom(X, tx.c, true), roughness: k >= 4 && k <= 7 ? 0.75 : 0.92, metalness: 0 });
      if (k === 0 || k === 2 || k === 3 || k === 8) { mat.bumpMap = texFrom(X, tx.bump, false); mat.bumpScale = 0.03; }
      if (k === 2) { mat.roughnessMap = texFrom(X, tx.bump, false); mat.roughness = 0.9; }
      const m = new THREE.Mesh(new THREE.SphereGeometry(P.r, 64, 40), mat); m.castShadow = m.receiveShadow = true;
      const pivot = new THREE.Group(); pivot.add(m); pivot.rotation.z = (P.tilt || [0, 177, 23, 25, 3, 27, 98, 28, 120][k]) * Math.PI / 180;
      const g = new THREE.Group(); g.add(pivot); sc.add(g);
      if (P.atm) { const a = new THREE.Mesh(new THREE.SphereGeometry(P.r * 1.06, 48, 32), atmoMaterial(THREE, P.atm, P.atm[3])); g.add(a); P._atm = a; }
      if (k === 2) { const cl = new THREE.Mesh(new THREE.SphereGeometry(P.r * 1.012, 64, 40), new THREE.MeshStandardMaterial({ alphaMap: texFrom(X, cloudCanvas(X), false), color: 0xffffff, transparent: true, depthWrite: false, roughness: 1 })); cl.castShadow = false; cl.receiveShadow = true; pivot.add(cl); D.clouds = cl; }
      if (P.ring) {
        const rg = new THREE.RingGeometry(P.r * 1.24, P.r * 2.3, 128, 1), pos = rg.attributes.position, uv = rg.attributes.uv;
        for (let i = 0; i < pos.count; i++) { const rr = Math.hypot(pos.getX(i), pos.getY(i)); uv.setXY(i, (rr - P.r * 1.24) / (P.r * 1.06), 0.5); }
        const rt = texFrom(X, ringCanvas(), true);
        const ring = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ map: rt, alphaMap: null, transparent: true, side: THREE.DoubleSide, roughness: 0.9, depthWrite: false, alphaTest: 0.02 }));
        ring.rotation.x = -Math.PI / 2; ring.castShadow = ring.receiveShadow = true; pivot.add(ring);
        ring.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: rt, alphaTest: 0.35 });
        ring.customDistanceMaterial = new THREE.MeshDistanceMaterial({ map: rt, alphaTest: 0.35 });
      }
      const moons = (P.moons || []).map((mo) => { const mm = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.05, mo[1]), 20, 14), new THREE.MeshStandardMaterial({ color: 0xb9b4ad, roughness: 1 })); mm.castShadow = mm.receiveShadow = true; g.add(mm); return mm; });
      // the orbit as a faint line
      const pts = [], o = new THREE.Vector3(), aS = aScene(P.a);
      for (let s = 0; s <= 256; s++) pts.push(keplerPos(P, aS, 1, s / 256, 0, o).clone());
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x5a6a8a, transparent: true, opacity: k === 8 ? 0.18 : 0.28, depthWrite: false }));
      sc.add(line);
      return { P, g, m, moons, aS, Tsec: tScene(P.T), M0: rand(0, TAU), off: new THREE.Vector3(), vel: new THREE.Vector3(), pos: new THREE.Vector3() };
    });
    // asteroids: the letters beyond the nine planets, as instanced lumpy rocks (main belt and Kuiper belt)
    const rock = new THREE.IcosahedronGeometry(1, 2), rp = rock.attributes.position;
    for (let i = 0; i < rp.count; i++) { const x = rp.getX(i), y = rp.getY(i), z = rp.getZ(i), f = 1 + 0.35 * X.noise.noise(x * 1.7 + 3, y * 1.7, z * 1.7) + 0.12 * X.noise.noise(x * 5, y * 5, z * 5); rp.setXYZ(i, x * f, y * f * 0.8, z * f); }
    rock.computeVertexNormals();
    D.rocks = new THREE.InstancedMesh(rock, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0.05 }), 240);
    D.rocks.castShadow = D.rocks.receiveShadow = true; D.rocks.instanceMatrix.setUsage(THREE.DynamicDrawUsage); sc.add(D.rocks);
    D.rocks.setColorAt(0, new THREE.Color()); // allocate instanceColor
    D.glow = simplePoints(THREE, 240); sc.add(D.glow); // infected bodies glow faintly
    // a static dusting of small belt objects
    const nb = 2500, belt = simplePoints(THREE, nb), bp = belt.geometry.attributes.position.array, bc = belt.geometry.attributes.aCol.array, bs = belt.geometry.attributes.aSize.array;
    for (let i = 0; i < nb; i++) { const kb = i % 3 === 0, r = kb ? aScene(rand(30, 48)) : aScene(rand(2.2, 3.3)), a = rand(0, TAU); bp[i * 3] = Math.cos(a) * r; bp[i * 3 + 1] = gauss() * (kb ? 1.2 : 0.25); bp[i * 3 + 2] = Math.sin(a) * r; const v = rand(0.05, 0.16); bc[i * 3] = v; bc[i * 3 + 1] = v * 0.9; bc[i * 3 + 2] = v * 0.8; bs[i] = 0.05; }
    D.belt = belt; sc.add(belt);
    // the rogue brown dwarf (appears while holding)
    const bdTex = X.canvasTexture(256, 128, (g, w, h) => { for (let y = 0; y < h; y++) { const v = 0.5 + 0.5 * Math.sin(y * 0.35 + Math.sin(y * 0.07) * 3); g.fillStyle = `rgb(${(90 + 80 * v) | 0},${(28 + 22 * v) | 0},${(18 + 10 * v) | 0})`; g.fillRect(0, y, w, 1); } });
    D.rogue = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshStandardMaterial({ map: bdTex, emissiveMap: bdTex, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.8 }));
    D.rogue.visible = false; sc.add(D.rogue);
    D.rogueLight = new THREE.PointLight(0xff5a30, 0, 0, 0); D.rogue.add(D.rogueLight);
    D.sunLight = light; D.sunMesh = sun;
    D.rg3 = new THREE.Vector3(); D.tmp = new THREE.Vector3(); D.m4 = new THREE.Matrix4(); D.q = new THREE.Quaternion(); D.col = new THREE.Color(); D.t0 = S.now;
    D.palLin = (S.mode.palette || []).map(lin); D.baseLin = lin(S.mode.base);
  }
  function orrery3dUpdate(S, X, now, dt) {
    const THREE = X.THREE, D = S.data, cam = X.camera, t = (now - D.t0) / 1000, sdt = Math.min(0.05, dt / 1000), r = D.rg;
    D.sunU.uTime.value = t;
    const scl = pointScale(S, X); D.sky.material.uniforms.uScale.value = D.glow.material.uniforms.uScale.value = D.belt.material.uniforms.uScale.value = scl;
    D.belt.rotation.y = t * 0.01;
    // camera: a slow orbit above the ecliptic, pointer parallax, drifting toward the rogue while it is near
    const px = S.ptrInside ? S.ptr.x / S.W - 0.5 : 0, py = S.ptrInside ? S.ptr.y / S.H - 0.5 : 0;
    const yaw = (S.reduceMotion ? 0 : t * 0.012) + S.rotY * 0.15 + px * 0.25, el = 0.38 + py * 0.15 + 0.1 * Math.sin(S.rotX), dist = 47 - 7 * r.p;
    D.look = D.look || new THREE.Vector3();
    D.look.lerp(D.tmp.copy(D.rg3).multiplyScalar(0.3 * r.p), 0.05);
    cam.position.set(D.look.x + Math.sin(yaw) * Math.cos(el) * dist, D.look.y + Math.sin(el) * dist, D.look.z + Math.cos(yaw) * Math.cos(el) * dist);
    cam.lookAt(D.look);
    // the rogue: on the ecliptic under the pointer
    if (S.holding) { const hit = rayPlane(S, X, S.ptr.x, S.ptr.y, new THREE.Vector3(0, 1, 0), new THREE.Vector3()); if (hit) { if (r.p < 0.05) D.rg3.copy(hit); else D.rg3.lerp(hit, 0.08); } }
    D.rogue.visible = r.p > 0.02; D.rogue.position.copy(D.rg3); D.rogue.scale.setScalar(0.4 + 0.9 * r.p); D.rogue.rotation.y = t * 0.6; D.rogueLight.intensity = 3 * r.p;
    // planets on Kepler orbits, perturbed by the rogue, sprung back afterwards (a slingshot on release)
    const G = S.holding ? 260 * r.p * r.p : 0, ks = S.holding ? 0.05 : 0.6;
    D.planets.forEach((pl, k) => {
      keplerPos(pl.P, pl.aS, pl.Tsec, t, pl.M0, pl.pos);
      const q = D.tmp.copy(pl.pos).add(pl.off), dx = D.rg3.x - q.x, dy = D.rg3.y - q.y, dz = D.rg3.z - q.z, d2 = dx * dx + dy * dy + dz * dz + 4, d = Math.sqrt(d2);
      const a = Math.min(40, G / d2);
      pl.vel.x += (dx / d * a - pl.off.x * ks) * sdt; pl.vel.y += (dy / d * a - pl.off.y * ks) * sdt; pl.vel.z += (dz / d * a - pl.off.z * ks) * sdt;
      pl.vel.multiplyScalar(Math.exp(-0.9 * sdt)); pl.off.addScaledVector(pl.vel, sdt);
      pl.g.position.copy(pl.pos).add(pl.off);
      pl.m.rotation.y = t * (k === 1 ? -0.05 : 0.4 + 0.3 * (k % 3));
      if (D.clouds && k === 2) D.clouds.rotation.y = t * 0.05;
      if (pl.P._atm) pl.P._atm.material.uniforms.uSun.value.set(0, 0, 0);
      pl.moons.forEach((mm, j) => { const mo = pl.P.moons[j], an = t / Math.abs(mo[2]) * TAU * 0.6 * Math.sign(mo[2]) + j * 2; mm.position.set(Math.cos(an) * pl.P.r * mo[0], Math.sin(an) * pl.P.r * mo[0] * 0.08, Math.sin(an) * pl.P.r * mo[0]); });
    });
    // asteroids (letters): each has its own small Kepler orbit in a belt; infection tints them and makes them glow
    const gp = D.glow.geometry.attributes.position.array, gc = D.glow.geometry.attributes.aCol.array, gs = D.glow.geometry.attributes.aSize.array;
    let k = 0;
    for (const n of S.active) {
      if (k >= 240) break;
      const d = n.data, idx = d.k;
      if (idx === undefined || idx < PLAN.length) continue;
      const o = d.ast3; if (!o) continue;
      D.q.setFromEuler(new THREE.Euler(t * o.spin, t * o.spin * 0.7, 0));
      D.m4.compose(d.w3, D.q, D.tmp.setScalar(o.size * (n.inf ? 1.25 : 1)));
      D.rocks.setMatrixAt(k, D.m4);
      const c = n.inf ? D.palLin[n.gen % D.palLin.length] : [0.42, 0.38, 0.34];
      D.rocks.setColorAt(k, D.col.setRGB(c[0], c[1], c[2]));
      gp[k * 3] = d.w3.x; gp[k * 3 + 1] = d.w3.y; gp[k * 3 + 2] = d.w3.z; gs[k] = n.inf ? 0.5 : 0;
      gc[k * 3] = c[0] * 0.6; gc[k * 3 + 1] = c[1] * 0.6; gc[k * 3 + 2] = c[2] * 0.6;
      k++;
    }
    for (let j = k; j < 240; j++) gs[j] = 0;
    D.rocks.count = k; D.rocks.instanceMatrix.needsUpdate = true; if (D.rocks.instanceColor) D.rocks.instanceColor.needsUpdate = true;
    ['position', 'aCol', 'aSize'].forEach((a) => (D.glow.geometry.attributes[a].needsUpdate = true));
    D.planets.forEach((pl, i) => { pl.screen = X.toScreen(pl.g.position); });
  }
  addMode({
    id: 'orrery', name: 'ORRERY', pageBg: ['#04050c', '#020309'],
    glyphs: '∗✧⋆•✦·',
    base: [40, 30, 82], palette: [[45, 100, 65], [200, 90, 66], [10, 90, 62]],
    links: ['cosmos-faint'],
    shapes: ['sphere', 'atom', 'torus', 'hopf', 'galaxy'],
    init(S) { S.data.rg = { p: 0 }; S.data.ejected = 0; S.data.line = 0; S.data.lineT = 0; },
    three: { init: orrery3dInit, update: orrery3dUpdate },
    update(S, now, dt) {
      const D = S.data, r = D.rg;
      S.active.forEach((n, i) => { n.data.k = i; });
      if (S.holding) r.p = Math.pow(clamp((S.held - 150) / 4300, 0, 1), 0.8); else { r.p *= Math.pow(0.5, dt / 300); if (r.p < 0.004) r.p = 0; }
      if (now - D.lineT > 6000) { D.lineT = now; D.line++; }
    },
    warp(S, n) { // asteroid letters: small Kepler orbits, perturbed by the rogue like the planets
      const X = S.three, D = S.data, d = n.data;
      if (!X || !D.planets) return;
      const THREE = X.THREE, k = d.k === undefined ? -1 : d.k;
      if (k >= 0 && k < PLAN.length) { const pl = D.planets[k], s = pl.screen || X.toScreen(pl.g.position); n.sx = s.x; n.sy = s.y; n.z = -X.camera.position.distanceTo(pl.g.position); return; }
      if (!d.ast3) { const kb = Math.random() < 0.3; d.ast3 = { P: { e: rand(0, 0.15), i: rand(0, kb ? 15 : 8), O: rand(0, 360), w: rand(0, 360) }, aS: kb ? aScene(rand(32, 46)) : aScene(rand(2.2, 3.3)), M0: rand(0, TAU), size: rand(0.08, 0.2), spin: rand(0.2, 1) }; d.ast3.T = tScene(Math.pow(d.ast3.aS > 30 ? 40 : 2.8, 1.5)); d.w3 = new THREE.Vector3(); d.off = new THREE.Vector3(); d.vel = new THREE.Vector3(); }
      const o = d.ast3, t = (S.now - D.t0) / 1000, sdt = Math.min(0.05, S.dt / 1000);
      keplerPos(o.P, o.aS, o.T, t, o.M0, d.w3);
      const r = D.rg;
      if (r.p > 0.02 || d.off.lengthSq() > 0.01) {
        const dx = D.rg3.x - d.w3.x - d.off.x, dy = D.rg3.y - d.w3.y - d.off.y, dz = D.rg3.z - d.w3.z - d.off.z, d2 = dx * dx + dy * dy + dz * dz + 2, dd = Math.sqrt(d2);
        const a = Math.min(60, (S.holding ? 260 * r.p * r.p : 0) / d2), ks = S.holding ? 0.05 : 0.6;
        d.vel.x += (dx / dd * a - d.off.x * ks) * sdt; d.vel.y += (dy / dd * a - d.off.y * ks) * sdt; d.vel.z += (dz / dd * a - d.off.z * ks) * sdt;
        d.vel.multiplyScalar(Math.exp(-0.9 * sdt)); d.off.addScaledVector(d.vel, sdt);
        if (!d.ej && d.off.length() > 12) { d.ej = 1; D.ejected++; } else if (d.off.length() < 2) d.ej = 0;
      }
      d.w3.add(d.off);
      const s = X.toScreen(d.w3); n.sx = s.x; n.sy = s.y; n.z = -X.camera.position.distanceTo(d.w3);
    },
    drawNode(S, ctx, n, g, size, a) { // planets get their symbol as a small instrument-style label; asteroid letters stay faint
      const k = n.data.k;
      if (k !== undefined && k < PLAN.length && S.three) { ctx.font = '11px monospace'; ctx.fillStyle = n.inf ? S.colorOf(n.gen, 0.8) : 'rgba(200,210,230,0.45)'; ctx.fillText(PLAN[k].g, n.sx + 14, n.sy - 12); return true; }
      return drawGlyph(S, ctx, n, g, size, a * 0.8, 0.45);
    },
    onClimax() { return false; },
    onRelease(S) { return S.data.rg.p > 0.1 ? false : undefined; },
    hud(S) {
      const D = S.data, r = D.rg;
      if (S.holding && r.p > 0.03) return `rogue brown dwarf, ${(13 + 60 * r.p).toFixed(0)} Jupiter masses, crossing the ecliptic · ${D.ejected} small bodies knocked off their orbits`;
      const lines = [
        () => `since this page opened, Earth has moved ${big(29.78 * performance.now() / 1000)} km along its orbit`,
        () => `Voyager 1: ${big(voyager())} km from the Sun, still sending 160 bits per second`,
        () => 'orbits are true Keplerian ellipses with real eccentricities and tilts; distances compressed, sizes exaggerated',
        () => 'Pluto: 17° inclination, crosses Neptune’s orbit, never meets it (3:2 resonance)',
        () => 'Uranus rolls on its side: axial tilt 97.8°',
        () => 'Mercury’s perihelion advances 43 arcseconds per century more than Newton allows: general relativity’s first win'
      ];
      return lines[D.line % lines.length]();
    }
  });
})(window.SPHERE);
