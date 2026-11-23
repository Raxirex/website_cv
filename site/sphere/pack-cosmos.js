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

  /* ======================= 1. COSMOS: the deep field and the black hole ======================= */
  const TILT = -0.16, INC = 0.2;
  function cosmosBuild(S) {
    const D = S.data;
    D.field.width = Math.round(S.W * S.DPR); D.field.height = Math.round(S.H * S.DPR);
    const g = D.field.getContext('2d'); g.setTransform(S.DPR, 0, 0, S.DPR, 0, 0);
    const gals = [];
    D.nGal = paintDeepField(S, g, 1, gals); // the faint far field is baked; the brighter galaxies stay movable
    const lib = galaxyLib(), u = Math.min(S.W, S.H);
    gals.push(galObj(S.W * rand(0.66, 0.78), S.H * rand(0.22, 0.34), { spr: lib.hero[0], size: u * 0.3, rot: rand(0, TAU), q: rand(0.45, 0.8), al: 1 })); // two hero galaxies on the thirds
    gals.push(galObj(S.W * rand(0.14, 0.26), S.H * rand(0.66, 0.78), { spr: lib.hero[1], size: u * 0.2, rot: rand(0, TAU), q: rand(0.3, 0.6), al: 0.95 }));
    gals.sort((a, b) => a.size - b.size);
    D.gals = gals; D.nGal += 2;
    D.stars = makeStars(S, Math.round(clamp(S.W * S.H / 13000, 50, 170)), 9);
  }
  function holeGeom(S, h) {
    const u = Math.min(S.W, S.H);
    h.rsh = u * (0.008 + 0.05 * Math.pow(h.P, 1.15));
    h.thE = h.rsh * 2.5;
    h.Rmax = Math.min(h.thE * 4, u * 0.6);
  }
  function galImg(ctx, G, x, y, phi, sr, st, al) {
    if (al <= 0.01) return;
    ctx.globalAlpha = Math.min(1, al); ctx.save(); ctx.translate(x, y);
    if (Math.abs(sr - 1) > 0.02 || Math.abs(st - 1) > 0.02) { ctx.rotate(phi); ctx.scale(sr, st); ctx.rotate(-phi); }
    ctx.rotate(G.rot); ctx.scale(1, G.q); ctx.drawImage(G.spr, -G.size / 2, -G.size / 2, G.size, G.size); ctx.restore();
  }
  // Movable galaxies, lensed analytically: a point lens makes two images of a source at β, at θ± = (β ± √(β² + 4θE²)) / 2,
  // stretched tangentially by θ/β and squeezed radially by 1 / (1 + θE²/θ²). Infalling galaxies are also spaghettified.
  function drawGalaxies(ctx, gals, h) {
    const on = h.P > 0.02, R = h.Rmax;
    ctx.globalCompositeOperation = 'lighter';
    for (const G of gals) {
      if (!G.alive) continue;
      const sp = Math.hypot(G.vx, G.vy), al = G.al * G.a;
      let spag = 1 + Math.min(3, sp * 2.5);
      if (!on) { galImg(ctx, G, G.x, G.y, Math.atan2(G.vy, G.vx), spag, 1 / Math.sqrt(spag), al); continue; }
      const dx = G.x - h.x, dy = G.y - h.y, b = Math.hypot(dx, dy) + 1e-3, phi = Math.atan2(dy, dx), fade = al * clamp((b - h.rsh) / (h.rsh * 1.5), 0, 1);
      spag *= 1 + Math.min(4, (h.thE * 1.1 / b) ** 2);
      if (b > R) { galImg(ctx, G, G.x, G.y, phi, spag, 1 / Math.sqrt(spag), fade); continue; }
      const t2 = h.thE * h.thE * (1 - smooth(R * 0.55, R, b)), root = Math.sqrt(b * b + 4 * t2), tp = (b + root) / 2, tm = (root - b) / 2, c = Math.cos(phi), s = Math.sin(phi);
      galImg(ctx, G, h.x + c * tp, h.y + s * tp, phi, spag / (1 + t2 / (tp * tp)), Math.min(7, tp / b) / Math.sqrt(spag), fade);
      if (tm > h.rsh * 0.95) galImg(ctx, G, h.x - c * tm, h.y - s * tm, phi, spag / (1 + t2 / (tm * tm)), Math.min(7, tm / b) / Math.sqrt(spag), fade * 0.85);
    }
    ctx.globalAlpha = 1;
  }
  addMode({
    id: 'cosmos', name: 'COSMOS', opaque: true, pageBg: ['#05060f', '#020308'],
    glyphs: '✦✧★☆✶✷✸⋆∗☉☽☾♃♄♅♆♇⊕☿♀♂',
    base: [215, 45, 90], palette: [[45, 100, 70], [200, 100, 72], [320, 95, 74]],
    links: ['line', 'beam', 'comet', 'gravity'],
    shapes: ['galaxy', 'sphere', 'hopf', 'torus', 'sunflower', 'helix', 'lissajous'],
    glyphScale: 0.9,
    init(S) {
      const D = S.data;
      D.field = S.offscreen(1, 1); diskSprites(); fx(D);
      cosmosBuild(S);
      D.hole = { x: S.cx, y: S.cy, P: 0, rsh: 0, thE: 0, Rmax: 0, jet: 0 };
      D.eaten = 0; D.swallowed = 0; D.galEaten = 0; D.flare = null; D.radii = [];
    },
    resize(S) { const D = S.data, m = this; clearTimeout(D.rt); D.rt = setTimeout(() => { if (S.mode === m && S.data === D) cosmosBuild(S); }, 160); },
    exit(S) { clearTimeout(S.data.rt); },
    onPress(S, x, y) { const h = S.data.hole; if (h.P < 0.05) { h.x = x; h.y = y; } },
    update(S, now, dt) {
      const D = S.data, h = D.hole, u = Math.min(S.W, S.H);
      if (S.holding) {
        h.P = Math.pow(clamp((S.held - 120) / 4380, 0, 1), 0.85);
        h.jet = clamp((S.held - 4300) / 700, 0, 1);
        const k = 1 - Math.pow(0.9, dt / 16.7); h.x += (S.ptr.x - h.x) * k; h.y += (S.ptr.y - h.y) * k;
      } else {
        const k = Math.pow(0.5, dt / 140); h.P *= k; h.jet *= k; if (h.P < 0.004) h.P = 0;
        for (const G of D.gals) if (!G.alive && G.respawn === Infinity) G.respawn = now + rand(1500, 9000); // the field refills
      }
      holeGeom(S, h);
      const pulling = h.P > 0.02 && S.holding;
      const eaten = stepStars(S, D.stars, dt, pulling ? { x: h.x, y: h.y, G: 4.5e-6 * u * u * h.P * h.P, soft: h.rsh * 2, swallow: h.rsh * 1.05, swirl: 0.6 } : null);
      const gEaten = stepStars(S, D.gals, dt, pulling ? { x: h.x, y: h.y, G: 6e-5 * u * h.P * h.P, soft: h.rsh * 2, swallow: h.rsh * 1.15, swirl: 0.35, lin: 1, range: u * (0.15 + 1.5 * Math.pow(h.P, 1.5)), keep: 1 } : null, { push: 0.5 });
      D.swallowed += eaten.length; D.galEaten += gEaten.length;
      eaten.concat(gEaten).forEach((o) => { // a little hextech glint where something went in
        fxAdd(D, 0, h.x + rand(-1, 1) * h.rsh, h.y + rand(-0.3, 0.3) * h.rsh, rand(-0.05, 0.05), rand(-0.05, 0.05), 600, o.size ? 16 : 9, o.size ? 2 : 0);
        for (let k = 0; k < (o.size ? 6 : 2); k++) fxAdd(D, 1, o.x, o.y, rand(-0.2, 0.2), rand(-0.2, 0.2), 1200, rand(3, 7), k % 2, { pull: 1 });
      });
      if (pulling && S.stage >= 1 && Math.random() < 0.55 * h.P) { // hextech shards spiralling into the hole
        const a = rand(0, TAU), r = h.rsh * rand(5, 10), v = 0.25 + 0.3 * h.P;
        fxAdd(D, 1, h.x + Math.cos(a) * r, h.y + Math.sin(a) * r, -Math.sin(a) * v, Math.cos(a) * v, 2600, rand(3, 8), Math.random() < 0.5 ? 0 : 1, { pull: 1, drag: 0.995 });
      }
      if (pulling && S.stage >= 3) for (let k = 0; k < 2; k++) { // speed lines rushing in
        const a = rand(0, TAU), r = u * rand(0.45, 0.85), v = rand(0.8, 1.4);
        fxAdd(D, 2, h.x + Math.cos(a) * r, h.y + Math.sin(a) * r, -Math.cos(a) * v, -Math.sin(a) * v, 700, rand(4, 7), 4, { pull: 1, tail: 45, flat: 1, drag: 1 });
      }
      wakeStep(S, D);
      fxStep(S, D, dt, h.P > 0.02 ? { x: h.x, y: h.y, G: 6e-5 * u * Math.max(0.2, h.P), r: h.rsh * 0.9 } : null);
    },
    background(S, ctx, now) {
      const D = S.data, h = D.hole, f = D.field;
      ctx.drawImage(f, 0, 0, f.width / S.DPR, f.height / S.DPR);
      const k = f.width / S.W;
      wakeDraw(S, ctx, D, f, k, 0, 0, 0.45);
      if (D.flare) { // the quasar's shock front: a refractive ripple racing outward through the field
        const t = (now - D.flare.t) / 2200;
        if (t >= 1) D.flare = null;
        else { // (two annuli only, and only while the ring is small enough to stay cheap)
          const Rs = D.flare.r0 + Math.max(S.W, S.H) * 0.9 * Math.pow(t, 0.7), w = 30 + 40 * t, amp = 0.16 * (1 - t) * D.flare.P;
          if (Rs < Math.max(S.W, S.H) * 0.6) remap(ctx, f, k, 0, 0, D.flare.x, D.flare.y, [Rs - w, Rs, Rs + w], (th) => th < Rs ? 1 + amp : 1 - amp);
        }
      }
      if (h.P > 0.02) {
        const thE2 = h.thE * h.thE, R = h.Rmax, radii = D.radii; radii.length = 0;
        geo(h.rsh * 0.97, h.thE, 7, radii); geo(h.thE, R, 17, radii); radii.push(R);
        remapBuffered(ctx, f, k, 0, 0, h.x, h.y, radii, (th) => 1 - (thE2 / (th * th)) * (1 - smooth(R * 0.55, R, th)));
      }
      drawGalaxies(ctx, D.gals, h);
      ctx.globalAlpha = 1;
      if (h.P <= 0.02) return;
      const dA = smooth(0.18, 0.45, h.P), Rd = h.rsh * 4.3;
      if (dA > 0.01) {
        renderDisk(now);
        ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(TILT); // far half of the disk, behind the hole
        ctx.beginPath(); ctx.rect(-Rd * 1.1, -Rd, Rd * 2.2, Rd); ctx.clip(); ctx.scale(1, INC); ctx.globalAlpha = dA; ctx.drawImage(DISK, -Rd, -Rd, Rd * 2, Rd * 2); ctx.restore();
        ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(TILT); // the far side bent up over the top and under the bottom
        ctx.beginPath(); ctx.arc(0, 0, h.rsh * 1.5, 0, TAU); ctx.arc(0, 0, h.rsh, 0, TAU, true); ctx.clip();
        const Rh = h.rsh * 3.45; ctx.scale(1, 0.94); ctx.globalAlpha = dA * 0.5; ctx.drawImage(DISK, -Rh, -Rh, Rh * 2, Rh * 2); ctx.restore();
      }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; // the shadow
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(h.x, h.y, h.rsh, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter'; // photon ring
      ctx.strokeStyle = `rgba(255,200,150,${0.18 + 0.2 * dA})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(h.x, h.y, h.rsh * 1.04, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(255,240,220,${0.5 + 0.4 * dA})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(h.x, h.y, h.rsh * 1.02, 0, TAU); ctx.stroke();
      if (dA > 0.01) { // near half of the disk, in front
        ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(TILT);
        ctx.beginPath(); ctx.rect(-Rd * 1.1, 0, Rd * 2.2, Rd); ctx.clip(); ctx.scale(1, INC); ctx.globalAlpha = dA; ctx.drawImage(DISK, -Rd, -Rd, Rd * 2, Rd * 2); ctx.restore();
      }
      if (h.jet > 0.01) { // relativistic jets along the spin axis, with knots flying out
        const L = Math.min(S.W, S.H) * 0.6 * Math.sqrt(h.jet), w0 = h.rsh * 0.12, j = h.jet, y0 = -h.rsh * 0.95;
        ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(TILT); ctx.globalAlpha = 1;
        for (const dir of [-1, 1]) {
          ctx.save(); ctx.scale(1, dir);
          const gr = ctx.createLinearGradient(0, y0, 0, -L);
          gr.addColorStop(0, `rgba(215,228,255,${0.75 * j})`); gr.addColorStop(0.1, `rgba(150,170,255,${0.3 * j})`); gr.addColorStop(0.55, `rgba(140,100,255,${0.08 * j})`); gr.addColorStop(1, 'rgba(120,80,255,0)');
          ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(-w0, y0); ctx.lineTo(-w0 - L * 0.03, -L); ctx.lineTo(w0 + L * 0.03, -L); ctx.lineTo(w0, y0); ctx.fill();
          const sp = ctx.createLinearGradient(0, y0, 0, -L * 0.85); sp.addColorStop(0, `rgba(240,245,255,${0.6 * j})`); sp.addColorStop(1, 'rgba(200,210,255,0)');
          ctx.fillStyle = sp; ctx.beginPath(); ctx.moveTo(-1.4, y0); ctx.lineTo(0, -L * 0.85); ctx.lineTo(1.4, y0); ctx.fill();
          for (let q = 0; q < 6; q++) { // knots: blobs of plasma shot out along the jet
            const fr = (now * 0.0005 + q / 6 + (dir > 0 ? 0.08 : 0)) % 1, y = y0 - (y0 + L) * Math.pow(fr, 1.15), r = w0 * (0.5 + 1.5 * fr) + 1;
            ctx.fillStyle = `rgba(225,232,255,${0.3 * (1 - fr) * j})`; ctx.beginPath(); ctx.ellipse(0, y, r * 0.6, r * 2.2, 0, 0, TAU); ctx.fill();
          }
          ctx.restore();
        }
        ctx.restore();
      }
    },
    ambient(S, ctx, now) { const h = S.data.hole; drawStars(S, ctx, S.data.stars, now, h.P > 0.02 ? { x: h.x, y: h.y, k: h.thE * 1.2 } : null); },
    over(S, ctx, now) {
      const D = S.data, F = D.flare;
      if (F && now - F.t < 900) {
        const t = now - F.t, r = F.r0 * (1.5 + t / 60), a = (1 - t / 900) * (S.reduceMotion ? 0.25 : 0.9) * F.P;
        const gr = ctx.createRadialGradient(F.x, F.y, 0, F.x, F.y, r);
        gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.2, `rgba(200,215,255,${a * 0.6})`); gr.addColorStop(1, 'rgba(120,140,255,0)');
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(F.x, F.y, r, 0, TAU); ctx.fill();
      }
      fxDraw(S, ctx, D);
    },
    warp(S, n) {
      swipeNode(S, n);
      const D = S.data, h = D.hole, d = n.data;
      if (d.fall === undefined) { d.fall = 0; d.phi = 0; d.fl = 0; d.ang = 0; }
      const dt = S.dt;
      const dx = n.sx - h.x, dy = n.sy - h.y, r0 = Math.hypot(dx, dy) + 1e-3;
      if (S.holding && h.P > 0.03) { const inf = clamp(1 - r0 / (S.R * 2.4), 0, 1); d.fall = Math.min(1, d.fall + dt * 0.00026 * h.P * (0.25 + 1.8 * inf)); }
      else d.fall = Math.max(0, d.fall - dt * 0.0011);
      d.fl *= Math.pow(0.94, dt / 16.7);
      if (d.fall < 0.001) d.phi = 0; else d.phi += dt * 0.0035 * d.fall * d.fall;
      if (d.fall < 0.001 && d.fl < 0.5) return;
      const f = d.fall, rin = h.rsh * 1.15;
      const rr = (r0 > rin ? rin + (r0 - rin) * Math.pow(1 - f, 1.6) : r0) + d.fl;
      const ang = Math.atan2(dy, dx) + d.phi * Math.min(1, f * 3);
      const x = Math.cos(ang) * rr, y = Math.sin(ang) * rr;
      const c = Math.cos(TILT), s = Math.sin(TILT), xr = x * c + y * s, yr = (-x * s + y * c) * (1 - 0.78 * f * f); // flatten into the disk plane
      n.sx = h.x + xr * c - yr * s; n.sy = h.y + xr * s + yr * c;
      n.shrink *= 1 - 0.9 * f * f * f; d.ang = ang;
      if (f > 0.97 && !d.sw) { d.sw = 1; D.eaten++; } else if (f < 0.5) d.sw = 0;
    },
    drawNode(S, ctx, n, g, size, a) { // spaghettification (stretched text is slow, so stretched letters use cached glyph sprites)
      const f = n.data.fall || 0;
      if (f < 0.12) return false;
      a *= 1 - Math.pow(f, 3);
      if (a < 0.02) return true;
      const st = 1 + 3.5 * f * f, spr = glyphSprite(g, f > 0.45 ? '255,196,140' : '215,230,255'), k = size / 44;
      ctx.save(); ctx.translate(n.sx, n.sy); ctx.rotate(n.data.ang + Math.PI / 2); ctx.scale(k / Math.sqrt(st), k * st);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = clamp(a, 0, 1); ctx.drawImage(spr, -32, -32); ctx.restore();
      ctx.globalAlpha = 1;
      return true;
    },
    onRelease(S, held, power) {
      const D = S.data, h = D.hole;
      if (h.P < 0.12) return; // a short hold: the default shockwave is enough
      const P = h.P, u = Math.min(S.W, S.H);
      D.flare = { t: S.now, x: h.x, y: h.y, P, r0: h.rsh };
      S.flash(0.18 + 0.3 * P, '205,218,255'); S.shake(5 + 12 * P);
      if (P > 0.5) fxImpact(S, D, h.x, h.y);
      fxBurst(D, h.x, h.y, u * (0.3 + 0.5 * P), 4, 800); fxBurst(D, h.x, h.y, u * (0.2 + 0.3 * P), 1, 600);
      S.ring(h.x, h.y, Math.max(S.W, S.H) * 0.8 * P + 150, [215, 90, 85], 1500);
      for (let k = 0; k < 140 * P; k++) { // a spray of hextech shards, sparkles and speed lines
        const a = rand(0, TAU), v = rand(0.2, 1.3) * (0.5 + P), x = h.x + Math.cos(a) * h.rsh, y = h.y + Math.sin(a) * h.rsh, kind = k % 3;
        fxAdd(D, kind, x, y, Math.cos(a) * v, Math.sin(a) * v, rand(700, 1800), kind === 1 ? rand(4, 9) : kind === 0 ? rand(6, 14) : 6, kind === 2 ? 4 : Math.floor(rand(0, 4)), { drag: 0.975, tail: 25, flat: 1 });
      }
      for (const s of D.stars.concat(D.gals)) { const dx = s.x - h.x, dy = s.y - h.y, d = Math.hypot(dx, dy) + 1, v = Math.min(1.8, 0.9 * P * Math.sqrt(h.thE * 3 / d)) * (s.size ? 0.4 : 1); s.vx += dx / d * v; s.vy += dy / d * v; }
      S.nodes.forEach((n) => { if (n.data.fall !== undefined) n.data.fl = (60 + 220 * P) * (0.35 + n.data.fall); });
      return false;
    },
    hud(S) {
      const D = S.data, h = D.hole;
      if (S.holding && h.P > 0.03) {
        const M = Math.pow(10, 6 + 4 * h.P), rs = 2953 * M / 1.496e11;
        return `BLACK HOLE · M = ${sci(M)} M☉ · r_s = ${rs < 100 ? rs.toFixed(1) : big(rs)} AU · eaten: ${D.galEaten} galaxies, ${D.swallowed} stars, ${D.eaten} letters${h.jet > 0.5 ? ' · JETS AT 0.99c' : ''}`;
      }
      if (D.flare && S.now - D.flare.t < 4000) return `QUASAR FLARE · L ≈ ${sci(1e38 * Math.pow(10, 3 * D.flare.P))} W · outshining ${big(1000 * Math.pow(10, 2 * D.flare.P))} Milky Ways`;
      return `DEEP FIELD · ${big(D.nGal)} galaxies · light up to 13.4 Gyr old · hold anywhere to open a black hole${D.galEaten ? ' · galaxies eaten so far: ' + D.galEaten : ''}`;
    }
  });
  /* ======================= 2. GALAXY CLUSTER: members, intracluster light, arcs, a merger ======================= */
  let GAS_PINK = null, GAS_BLUE = null;
  function cloudSprite(cols) {
    const c = mk(256, 256), g = c.getContext('2d');
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 46; k++) {
      const r = rand(18, 70), d = Math.abs(gauss()) * 34, a = rand(0, TAU), x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d * 0.8;
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${pick(cols)},0.06)`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    return c;
  }
  function tint(src, css, amt) { const c = mk(src.width, src.height), g = c.getContext('2d'); g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = amt; g.fillStyle = css; g.fillRect(0, 0, c.width, c.height); return c; }
  function clusterBuild(S) {
    const D = S.data, W = S.W, H = S.H, u = Math.min(W, H), lib = galaxyLib();
    D.field.width = Math.round(W * S.DPR); D.field.height = Math.round(H * S.DPR);
    const g = D.field.getContext('2d'); g.setTransform(S.DPR, 0, 0, S.DPR, 0, 0);
    paintDeepField(S, g, 0.45);
    const a0 = rand(-0.6, 0.6), main = { x: W * 0.5 + gauss() * u * 0.02, y: H * 0.47, m: 1, rot: rand(0, TAU) };
    const sub = { x: main.x + Math.cos(a0) * u * 0.42 * (W > H ? 1 : 0.6), y: main.y + Math.sin(a0) * u * 0.22, m: 0.55, rot: rand(0, TAU) };
    D.cc = [main, sub];
    g.globalCompositeOperation = 'lighter';
    for (const c of D.cc) for (const k of [1, 0.5, 0.22]) { // intracluster light: the stars of shredded galaxies
      g.save(); g.translate(c.x, c.y); g.rotate(c.rot); g.scale(1.4, 1);
      const R = u * 0.5 * c.m * k, gr = g.createRadialGradient(0, 0, 0, 0, 0, R);
      gr.addColorStop(0, `rgba(255,232,195,${0.13 * c.m})`); gr.addColorStop(0.45, `rgba(255,220,180,${0.045 * c.m})`); gr.addColorStop(1, 'rgba(255,210,170,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill(); g.restore();
    }
    let members = 0;
    for (let i = 0; i < 95; i++, members++) { // the red sequence: ellipticals and S0s crowding the cores
      const c = Math.random() < 0.65 ? main : sub, r = u * 0.3 * c.m * Math.sqrt(-Math.log(rand(0.03, 1))) * 0.55, a = rand(0, TAU);
      const sz = Math.min(u * 0.06, 5 * Math.pow(1 - Math.random(), -1 / 2.2));
      drawGal(g, pick(lib.el), c.x + Math.cos(a) * r * 1.35, c.y + Math.sin(a) * r, sz * 1.7, rand(0, TAU), rand(0.5, 1), rand(0.75, 1));
    }
    for (let i = 0; i < 14; i++, members++) { const a = rand(0, TAU), r = u * rand(0.3, 0.6); drawGal(g, pick(lib.sp), main.x + Math.cos(a) * r * 1.4, main.y + Math.sin(a) * r, rand(10, 26), rand(0, TAU), rand(0.2, 1), 0.9); }
    for (const c of D.cc) { // brightest cluster galaxies: giant cD ellipticals with a huge envelope
      drawGal(g, lib.el[0], c.x, c.y, u * 0.5 * c.m, c.rot, 0.7, 0.55);
      drawGal(g, lib.el[2], c.x, c.y, u * 0.2 * c.m, c.rot, 0.72, 1);
      drawGal(g, lib.el[1], c.x + u * 0.03 * c.m, c.y - u * 0.012, u * 0.07 * c.m, c.rot, 0.8, 0.9); // a cannibalised companion
    }
    D.arcs = 0;
    for (let k = 0; k < 13; k++, D.arcs++) { // strongly lensed background galaxies: thin blue tangential arcs
      const c = k < 10 ? main : sub, rE = u * (0.17 + 0.09 * Math.random()) * Math.sqrt(c.m), ang = rand(0, TAU), span = k === 0 ? 0.75 : rand(0.1, 0.42), th = k === 0 ? 4 : rand(1.2, 3);
      const n = Math.ceil(span * rE / 0.9);
      for (let j = 0; j < n; j++) {
        const t = j / n, a = ang + (t - 0.5) * span, prof = Math.pow(Math.sin(Math.PI * t), 0.6), r = rE + gauss() * th * 0.25;
        g.fillStyle = `rgba(175,200,255,${0.32 * prof})`; g.beginPath(); g.arc(c.x + Math.cos(a) * r * 1.15, c.y + Math.sin(a) * r, th * 0.55 * prof + 0.4, 0, TAU); g.fill();
        if (Math.random() < 0.04) { g.fillStyle = 'rgba(255,140,210,0.6)'; g.beginPath(); g.arc(c.x + Math.cos(a) * r * 1.15, c.y + Math.sin(a) * r, th * 0.4 + 0.5, 0, TAU); g.fill(); }
      }
    }
    starSprites();
    for (let k = 0; k < 6; k++) { const b = Math.floor(rand(2, 8)), r = rand(18, 40); g.drawImage(SPIKE[b], rand(0, W) - r, rand(0, H) - r, r * 2, r * 2); }
    D.members = members;
  }
  addMode({
    id: 'cluster', name: 'GALAXY CLUSTER', opaque: true, noHueShift: true, pageBg: ['#07060d', '#020308'],
    glyphs: '✦✧⋆∗✶◉◎⊙●○◌',
    base: [40, 70, 82], palette: [[38, 100, 70], [300, 90, 72], [195, 100, 70]],
    links: ['curve', 'gravity', 'comet', 'constellation'],
    shapes: ['sphere', 'galaxy', 'buckyball', 'torus', 'atom', 'lissajous'],
    glyphScale: 0.85,
    init(S) {
      const D = S.data, lib = galaxyLib();
      D.field = S.offscreen(1, 1); clusterBuild(S);
      if (!GAS_PINK) { GAS_PINK = cloudSprite(['255,80,200', '220,90,255', '255,140,220']); GAS_BLUE = cloudSprite(['70,120,255', '90,170,255', '120,110,255']); }
      const css = this.palette.map((c) => `hsl(${c[0]},${c[1]}%,${c[2]}%)`);
      D.spr = { base: [lib.el[0], lib.sp[0]], gen: css.map((c) => [tint(lib.el[0], c, 0.6), tint(lib.sp[1], c, 0.5)]) };
      D.dm = { x: S.cx, y: S.cy, gx: S.cx, gy: S.cy, p: 0, phi: 0 }; D.radii = []; fx(D);
    },
    resize(S) { const D = S.data, m = this; clearTimeout(D.rt); D.rt = setTimeout(() => { if (S.mode === m && S.data === D) clusterBuild(S); }, 160); },
    exit(S) { clearTimeout(S.data.rt); },
    onPress(S, x, y) { const m = S.data.dm; if (m.p < 0.05) { m.x = m.gx = x; m.y = m.gy = y; } },
    update(S, now, dt) {
      const m = S.data.dm;
      if (S.holding) {
        m.p = Math.pow(clamp((S.held - 150) / 4200, 0, 1), 0.8);
        const k = 1 - Math.pow(0.85, dt / 16.7); m.x += (S.ptr.x - m.x) * k; m.y += (S.ptr.y - m.y) * k;
      } else { m.p *= Math.pow(0.5, dt / 260); if (m.p < 0.004) m.p = 0; }
      const kg = 1 - Math.pow(0.975, dt / 16.7); m.gx += (m.x - m.gx) * kg; m.gy += (m.y - m.gy) * kg; // the gas lags behind the dark matter
      if (m.p > 0.1 && Math.random() < 0.5 * m.p) { const n = pick(S.active); if (n && n.data.pull > 0.1) fxAdd(S.data, 2, n.sx, n.sy, (m.x - n.sx) * 0.0015, (m.y - n.sy) * 0.0015, rand(500, 1100), rand(5, 9), pick([2, 3])); } // pink-purple shimmer streaming off the galaxies
      if (m.p > 0.4 && Math.random() < 0.25) fxAdd(S.data, 0, m.gx + gauss() * 40, m.gy + gauss() * 40, rand(-0.05, 0.05), rand(-0.05, 0.05), 700, rand(5, 10), pick([2, 3, 4]));
      wakeStep(S, S.data); fxStep(S, S.data, dt, null);
    },
    background(S, ctx, now) {
      const D = S.data, f = D.field, m = D.dm;
      ctx.drawImage(f, 0, 0, f.width / S.DPR, f.height / S.DPR);
      wakeDraw(S, ctx, D, f, f.width / S.W, 0, 0, 0.55); // a swipe shoves the galaxies aside
      if (m.p < 0.02) return;
      const u = Math.min(S.W, S.H), thE = u * 0.12 * m.p, R = Math.min(thE * 4.2, u * 0.55), t2 = thE * thE;
      const radii = D.radii; radii.length = 0; radii.push(0); geo(thE * 0.15, R, 26, radii); radii.push(R);
      remapBuffered(ctx, f, f.width / S.W, 0, 0, m.x, m.y, radii, (th) => { const q = th * th + t2; return 1 - 3.3 * t2 * th * th / (q * q) * (1 - smooth(R * 0.5, R, th)); }); // strongest at θE (arcs), untouched at the centre
    },
    ambient(S, ctx, now) { // dark matter (blue) and the hot X-ray gas (pink) that it leaves behind
      const m = S.data.dm; if (m.p < 0.02) return;
      const u = Math.min(S.W, S.H), p = m.p;
      ctx.globalCompositeOperation = 'screen'; // screen, not add: the gas tints the BCG instead of burning it white
      let r = u * (0.25 + 0.45 * p); ctx.globalAlpha = 0.38 * p; ctx.drawImage(GAS_BLUE, m.x - r, m.y - r, r * 2, r * 2);
      r = u * (0.2 + 0.35 * p); ctx.globalAlpha = 0.6 * p;
      ctx.save(); ctx.translate(m.gx, m.gy); ctx.rotate(now * 0.00005); ctx.drawImage(GAS_PINK, -r, -r, r * 2, r * 2); ctx.restore();
      const dx = m.x - m.gx, dy = m.y - m.gy, sp = Math.hypot(dx, dy);
      if (S.stage >= 2 && sp > 8) { // bow shock ahead of the moving gas (the Bullet Cluster's)
        const a = Math.atan2(dy, dx), rr = r * 0.42, sa = clamp(sp / 60, 0, 1) * p;
        ctx.globalAlpha = 1; ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,190,240,${0.55 * sa})`;
        ctx.beginPath(); ctx.arc(m.gx, m.gy, rr, a - 0.8, a + 0.8); ctx.stroke();
        ctx.lineWidth = 9; ctx.strokeStyle = `rgba(255,120,220,${0.15 * sa})`; ctx.beginPath(); ctx.arc(m.gx, m.gy, rr * 0.97, a - 0.7, a + 0.7); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
    under(S, ctx) { // tidal tails: where each galaxy has been
      ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      for (const n of S.nodes) {
        const d = n.data, tr = d.tr;
        if (!tr || tr.length < 6 || (d.pull < 0.05 && d.fl < 3)) continue;
        const L = tr.length;
        for (let seg = 0; seg < 3; seg++) {
          ctx.strokeStyle = n.inf ? S.colorOf(n.gen, 0.12 * (seg + 1) * n.alpha) : S.baseColor(0.08 * (seg + 1) * n.alpha);
          ctx.beginPath();
          const i0 = Math.floor(seg * L / 6) * 2, i1 = Math.min(L, Math.floor((seg + 1) * L / 6) * 2 + 2);
          ctx.moveTo(tr[i0], tr[i0 + 1]); for (let i = i0 + 2; i < i1; i += 2) ctx.lineTo(tr[i], tr[i + 1]);
          ctx.stroke();
        }
      }
    },
    over(S, ctx) { fxDraw(S, ctx, S.data); },
    warp(S, n) {
      swipeNode(S, n);
      const m = S.data.dm, d = n.data, dt = S.dt;
      if (d.pull === undefined) { d.pull = 0; d.tr = []; d.phi = 0; d.fl = 0; d.tt = 0; }
      const dx = n.sx - m.x, dy = n.sy - m.y, r0 = Math.hypot(dx, dy) + 1e-3;
      if (S.holding && m.p > 0.03) d.pull = Math.min(1, d.pull + dt * 0.00024 * m.p * (0.4 + clamp(1 - r0 / (S.R * 3), 0, 1)));
      else d.pull = Math.max(0, d.pull - dt * 0.0008);
      d.fl *= Math.pow(0.95, dt / 16.7);
      if (d.pull < 0.001) d.phi = 0; else d.phi += dt * 0.0016 * d.pull * (1 + 40 / (r0 + 40));
      if (d.pull > 0.001 || d.fl > 0.5) {
        const f = d.pull, rr = r0 * (1 - 0.45 * f * (2 - f)) + d.fl, ang = Math.atan2(dy, dx) + d.phi * Math.min(1, f * 2);
        n.sx = m.x + Math.cos(ang) * rr; n.sy = m.y + Math.sin(ang) * rr; n.shrink *= 1 - 0.45 * f;
      }
      if (S.now - d.tt > 45) { d.tt = S.now; d.tr.push(n.sx, n.sy); if (d.tr.length > 28) d.tr.splice(0, 2); }
    },
    drawNode(S, ctx, n, g, size, a) { // letters are member galaxies
      const D = S.data, d = n.data;
      if (d.q === undefined) { d.q = rand(0.45, 1); d.rot = rand(0, TAU); d.sp = Math.random() < 0.3; }
      const set = n.inf ? D.spr.gen[n.gen % D.spr.gen.length] : D.spr.base, spr = set[d.sp ? 1 : 0], s = size * (d.sp ? 2.6 : 2.1);
      ctx.save(); ctx.globalCompositeOperation = (d.pull || 0) > 0.05 ? 'source-over' : 'lighter'; ctx.globalAlpha = clamp(a * (1 - 0.7 * (d.pull || 0)), 0, 1); // no additive white-out when they pile up
      ctx.translate(n.sx, n.sy); ctx.rotate(d.rot); ctx.scale(1, d.q); ctx.drawImage(spr, -s / 2, -s / 2, s, s); ctx.restore();
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.font = `${(size * 0.62).toFixed(1)}px monospace`;
      ctx.fillStyle = n.inf ? S.colorOf(n.gen, 0.5 * a) : S.baseColor(0.32 * a);
      ctx.fillText(g, n.sx, n.sy + size * 0.55);
      return true;
    },
    onRelease(S, held, power) {
      const m = S.data.dm;
      if (m.p < 0.12) return;
      S.ring(m.gx, m.gy, Math.min(S.W, S.H) * 0.7 * m.p + 120, [310, 90, 70], 1400);
      S.ring(m.x, m.y, Math.min(S.W, S.H) * 0.5 * m.p + 80, [215, 90, 70], 1000);
      fxBurst(S.data, m.gx, m.gy, Math.min(S.W, S.H) * (0.2 + 0.4 * m.p), 2, 800);
      for (let k = 0; k < 110 * m.p; k++) { const a = rand(0, TAU), v = rand(0.1, 0.7), kind = k % 3; fxAdd(S.data, kind, m.gx, m.gy, Math.cos(a) * v, Math.sin(a) * v, rand(600, 1500), kind === 1 ? rand(4, 8) : rand(6, 12), pick([2, 3, 1]), { drag: 0.97, tail: 20 }); }
      S.nodes.forEach((n) => { if (n.data.pull !== undefined) n.data.fl = (40 + 160 * m.p) * (0.3 + n.data.pull); });
      S.shake(4 * m.p);
      return false;
    },
    hud(S) {
      const D = S.data, m = D.dm;
      if (S.holding && m.p > 0.03) return `CLUSTER MERGER · v = ${big(600 + 3900 * m.p)} km/s · T_gas = ${sci(2e7 + 1.6e8 * m.p)} K${S.stage >= 2 ? ' · bow shock Mach ' + (1 + 2.2 * m.p).toFixed(1) : ''} · dark matter: still not interacting`;
      return `GALAXY CLUSTER · ${D.members} members · M ≈ 2×10¹⁵ M☉, 85% dark matter · ${D.arcs} lensed arcs · hold to merge`;
    }
  });
  /* ======================= 3. NEBULA: pillars of creation and a supernova ======================= */
  const PERM = new Uint8Array(512);
  (function () { const q = Array.from({ length: 256 }, (_, i) => i); for (let i = 255; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = q[i]; q[i] = q[j]; q[j] = t; } for (let i = 0; i < 512; i++) PERM[i] = q[i & 255]; })();
  function vn(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, X = xi & 255, Y = yi & 255;
    const a = PERM[PERM[X] + Y], b = PERM[PERM[X + 1] + Y], c = PERM[PERM[X] + Y + 1], d = PERM[PERM[X + 1] + Y + 1];
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return ((a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v) / 255;
  }
  function fbm(x, y, o) { let s = 0, a = 0.5, n = 0; for (let i = 0; i < o; i++) { s += a * vn(x, y); n += a; const nx = x * 1.6 - y * 1.2 + 5.3, ny = x * 1.2 + y * 1.6 + 1.7; x = nx; y = ny; a *= 0.5; } return s / n; }
  let SHELL = null;
  function shellSprite() { // a filamentary supernova remnant (Crab / Cas A-ish): Hα red, [OIII] teal, [SII] orange
    if (SHELL) return SHELL;
    const c = mk(512, 512), g = c.getContext('2d'), h = 256, R = 200;
    g.globalCompositeOperation = 'lighter';
    let gr = g.createRadialGradient(h, h, 0, h, h, R * 0.9); gr.addColorStop(0, 'rgba(130,170,255,0.22)'); gr.addColorStop(0.7, 'rgba(110,140,255,0.08)'); gr.addColorStop(1, 'rgba(90,120,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    const cols = ['255,70,60', '255,70,60', '90,230,215', '255,160,80', '255,225,215'];
    g.lineCap = 'round';
    for (let i = 0; i < 1100; i++) {
      const a = rand(0, TAU), col = pick(cols);
      let r = R * (0.7 + 0.3 * Math.sqrt(Math.random())) + gauss() * 5, dir = a + gauss() * 0.6, x = h + Math.cos(a) * r, y = h + Math.sin(a) * r;
      g.strokeStyle = `rgba(${col},${rand(0.12, 0.45)})`; g.lineWidth = rand(0.5, 1.8);
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { dir += gauss() * 0.5; const L = rand(3, 12); x += Math.cos(dir) * L; y += Math.sin(dir) * L; g.lineTo(x, y); }
      g.stroke();
    }
    for (let i = 0; i < 160; i++) { const a = rand(0, TAU), r = R * rand(0.75, 1), col = pick(cols); g.fillStyle = `rgba(${col},0.5)`; g.beginPath(); g.arc(h + Math.cos(a) * r, h + Math.sin(a) * r, rand(0.8, 2.4), 0, TAU); g.fill(); }
    g.strokeStyle = 'rgba(150,190,255,0.25)'; g.lineWidth = 3; g.beginPath(); g.arc(h, h, R * 1.03, 0, TAU); g.stroke(); // the forward shock
    SHELL = c; return c;
  }
  function nebulaBuild(S) {
    const D = S.data, W = S.W, H = S.H, asp = W / H;
    const q = Math.min(0.42, Math.sqrt(230000 / (W * H))), gw = Math.ceil(W * q), gh = Math.ceil(H * q);
    D.gas.width = gw; D.gas.height = gh;
    const g = D.gas.getContext('2d'), img = g.createImageData(gw, gh), px = img.data, dens = new Float32Array(gw * gh);
    const wf = Math.min(1, asp * 0.75); // keep pillars slim on portrait screens
    const pil = [{ x: 0.3, top: 0.13, w: 0.07, lean: 0.07 }, { x: 0.56, top: 0.4, w: 0.056, lean: -0.03 }, { x: 0.79, top: 0.55, w: 0.045, lean: -0.06 }].map((p) => ({ x: p.x * asp, top: p.top, w: p.w * wf, lean: p.lean * wf }));
    D.pillars = pil;
    for (let j = 0; j < gh; j++) {
      const v = j / gh;
      for (let i = 0; i < gw; i++) {
        const uu = (i / gw) * asp;
        let d = 0;
        for (const p of pil) {
          const t = (v - p.top) / (1 - p.top);
          if (t < -0.12) continue;
          const tc = clamp(t, 0, 1), c0 = p.x + p.lean * (1 - tc), half = p.w * (0.55 + 1.6 * Math.pow(tc, 1.4));
          if (Math.abs(uu - c0) > half + 0.12) continue;
          const cx = c0 + (fbm(v * 3.2 + p.x * 7, p.x * 3, 3) - 0.5) * 0.1 * wf; // a curvy spine
          let dist = Math.abs(uu - cx) + (fbm(uu * 9 + p.x, v * 9, 3) - 0.5) * 0.06 * wf - half; // ragged, eroded edges
          const capY = p.top + p.w * 0.7; if (v < capY) dist = Math.max(dist, Math.hypot(uu - cx, (v - capY) * 0.85) - p.w * 0.9);
          d = Math.max(d, clamp(0.5 - dist / 0.035, 0, 1));
        }
        d = Math.max(d, smooth(0.8, 0.98, v + (fbm(uu * 4 + 9, v * 4, 2) - 0.5) * 0.14));
        d *= 0.5 + 0.65 * fbm(uu * 13 + 3, v * 13, 3);
        dens[j * gw + i] = clamp(d, 0, 0.93);
      }
    }
    const k = Math.max(1, Math.round(gh * 0.011)), kx = Math.max(1, Math.round(gw * 0.004));
    for (let j = 0; j < gh; j++) {
      const v = j / gh, glow = 0.25 + 0.75 * Math.pow(1 - v, 1.4);
      for (let i = 0; i < gw; i++) {
        const idx = j * gw + i, uu = (i / gw) * asp, d = dens[idx];
        const n1 = fbm(uu * 1.7, v * 1.7, 4), n2 = fbm(uu * 4.5 + 7, v * 4.5 + 2, 3), n3 = 0.7 + 0.6 * fbm(uu * 10 + 4, v * 10, 2), wisp = smooth(0.5, 0.72, fbm(uu * 3.5 + 11, v * 3.5, 2));
        const up = j >= k ? dens[idx - k * gw + (i + kx < gw ? kx : 0)] : 0, rim = clamp((d - up) * 2.6, 0, 1);
        const e = n1 * n1 * glow, f3 = n2 * n2 * n2 * glow;
        let r = (6 + 80 * e + 230 * f3) * n3, gg = (12 + 150 * e + 130 * f3) * n3, b = (20 + 135 * n1 * glow + 25 * n2) * n3; // teal [OIII] haze with golden knots
        const dk = 1 - 0.55 * wisp; r *= dk; gg *= dk; b *= dk;
        const bb = 0.12 + 0.6 * (1 - d) * (1 - d) + 0.3 * n2; // pillar body: dusty brown, darker in the dense core
        r = r * (1 - d * 0.9) + d * (16 + 105 * bb) + rim * 235 + rim * rim * 30;
        gg = gg * (1 - d * 0.9) + d * (9 + 56 * bb) + rim * 160;
        b = b * (1 - d * 0.9) + d * (6 + 30 * bb) + rim * 95;
        px[idx * 4] = r > 255 ? 255 : r; px[idx * 4 + 1] = gg > 255 ? 255 : gg; px[idx * 4 + 2] = b > 255 ? 255 : b; px[idx * 4 + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    const st = makeStars(S, Math.round(clamp(W * H / 11000, 60, 190)), 7);
    pil.forEach((p) => { for (let k2 = 0; k2 < 3; k2++) { const x = (p.x + p.lean + gauss() * p.w * 0.4) * H, y = (p.top + p.w * rand(0.3, 1.2)) * H; st.push({ hx: x, hy: y, x, y, vx: 0, vy: 0, bin: 0, f: 0.3, r: rand(2, 3.5), spike: false, alive: true, a: 1, tw: rand(0, TAU), respawn: 0 }); } }); // newborn stars in the tips
    D.stars = st;
  }
  function nebView(S, now) { const z = 1.05 + 0.025 * Math.sin(now * 0.00007); return { z, ox: -S.W * (z - 1) / 2 + Math.sin(now * 0.00011) * S.W * 0.012, oy: -S.H * (z - 1) / 2 + Math.cos(now * 0.00009) * S.H * 0.01 }; }
  addMode({
    id: 'nebula', name: 'NEBULA', opaque: true, pageBg: ['#0d1726', '#24150f'],
    glyphs: '✦✧✶✷✸✹✺∗⁕※☄★',
    base: [35, 60, 88], palette: [[8, 100, 64], [175, 85, 58], [45, 100, 66]],
    links: ['curve', 'comet', 'beam', 'comet'], // ('arc'/'plasma' halve the frame rate under the supernova at DPR 2)
    shapes: ['sphere', 'urchin', 'seashell', 'helix', 'lissajous'],
    init(S) { const D = S.data; D.gas = S.offscreen(1, 1); nebulaBuild(S); shellSprite(); fx(D); D.sn = null; D.radii = []; D.count = 0; },
    resize(S) { const D = S.data, m = this; clearTimeout(D.rt); D.rt = setTimeout(() => { if (S.mode === m && S.data === D) nebulaBuild(S); }, 200); },
    exit(S) { clearTimeout(S.data.rt); },
    onPress(S, x, y) { const v = nebView(S, S.now); S.data.press = { wx: (x - v.ox) / v.z, wy: (y - v.oy) / v.z }; }, // a supernova starts only once the press outlasts a tap

    update(S, now, dt) {
      const D = S.data, v = nebView(S, now);
      D.view = v;
      if (S.holding && D.press && S.held > 250) { D.sn = { wx: D.press.wx, wy: D.press.wy, t0: now, boom: 0, rel: 0, R: 0, A: 1 }; D.press = null; }
      if (!S.holding) D.press = null;
      const sn = D.sn;
      if (sn) {
        if (!sn.boom && S.holding && S.held > 1450) {
          sn.boom = now; D.count++;
          S.flash(0.45, '255,240,225'); S.shake(9);
          const x = v.ox + sn.wx * v.z, y = v.oy + sn.wy * v.z, u = Math.min(S.W, S.H);
          fxImpact(S, D, x, y); fxBurst(D, x, y, u * 0.6, 0, 900); fxBurst(D, x, y, u * 0.35, 1, 700);
          for (let k = 0; k < 170; k++) { const a = rand(0, TAU), sp = rand(0.15, 0.9), kind = k % 3; fxAdd(D, kind, x, y, Math.cos(a) * sp, Math.sin(a) * sp, rand(800, 2000), kind === 1 ? rand(4, 10) : rand(6, 13), kind === 2 ? pick([4, 0]) : Math.floor(rand(0, 3)), { drag: 0.97, tail: 30, flat: kind === 2 ? 1 : 0 }); }
        }
        if (!S.holding && !sn.rel) sn.rel = now;
        const u = Math.min(S.W, S.H);
        sn.R = sn.boom ? u * 0.55 * (1 - Math.exp(-(now - sn.boom) / 2400)) : 0;
        sn.A = sn.rel ? clamp(1 - (now - Math.max(sn.rel, sn.boom + 2500)) / 4500, 0, 1) : 1;
        if (sn.rel && (sn.A <= 0 || (!sn.boom && now - sn.rel > 1500))) D.sn = null;
      }
      const s2 = D.sn;
      if (s2 && s2.boom && s2.A > 0.05) { // the shock front snowplows stars outward
        const R = s2.R / v.z;
        for (const s of D.stars) { const dx = s.x - s2.wx, dy = s.y - s2.wy, d = Math.hypot(dx, dy) + 1e-3; if (d < R) { s.x = s2.wx + dx / d * R; s.y = s2.wy + dy / d * R; s.vx = dx / d * 0.05; s.vy = dy / d * 0.05; } }
      }
      stepStars(S, D.stars, dt, null, { px: (S.ptr.x - v.ox) / v.z, py: (S.ptr.y - v.oy) / v.z });
      if (Math.random() < 0.06) { const st = pick(D.stars); if (st.alive) fxAdd(D, 0, v.ox + st.x * v.z, v.oy + st.y * v.z, 0, 0, rand(500, 1000), rand(6, 12), pick([0, 1, 4])); } // stars twinkle into anime sparkles
      wakeStep(S, D); fxStep(S, D, dt, null);
    },
    background(S, ctx, now) {
      const D = S.data, v = D.view || nebView(S, now), gas = D.gas, sn = D.sn;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(gas, v.ox, v.oy, S.W * v.z, S.H * v.z);
      wakeDraw(S, ctx, D, gas, gas.width / (S.W * v.z), v.ox, v.oy, 0.85); // the pointer parts the gas
      if (!sn || !sn.boom) return;
      const x = v.ox + sn.wx * v.z, y = v.oy + sn.wy * v.z, Rs = sn.R, A = sn.A;
      if (Rs > 4 && A > 0.02) { // the blast clears a cavity and piles the gas up at the rim
        const radii = D.radii; radii.length = 0; geo(Math.max(2, Rs * 0.1), Rs, 22, radii); radii.push(Rs);
        remapBuffered(ctx, gas, gas.width / (S.W * v.z), v.ox, v.oy, x, y, radii, (th) => 1 - (1 - Math.pow(th / Rs, 0.7)) * A);
        const gr = ctx.createRadialGradient(x, y, 0, x, y, Rs);
        gr.addColorStop(0, `rgba(0,2,10,${0.55 * A})`); gr.addColorStop(0.85, `rgba(0,2,10,${0.3 * A})`); gr.addColorStop(1, 'rgba(0,2,10,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, Rs, 0, TAU); ctx.fill();
      }
    },
    ambient(S, ctx, now) {
      const D = S.data, v = D.view || nebView(S, now), sn = D.sn;
      ctx.save(); ctx.translate(v.ox, v.oy); ctx.scale(v.z, v.z); drawStars(S, ctx, D.stars, now, null); ctx.restore();
      if (!sn) return;
      const x = v.ox + sn.wx * v.z, y = v.oy + sn.wy * v.z, u = Math.min(S.W, S.H);
      ctx.globalCompositeOperation = 'lighter';
      if (!sn.boom) { // the progenitor: a red supergiant swelling, then the core collapses
        const t = (now - sn.t0) / 1200, fade = sn.rel ? clamp(1 - (now - sn.rel) / 1200, 0, 1) : 1;
        const r = (8 + 30 * Math.min(t, 0.9) * (1 + 0.08 * Math.sin(now * 0.02))) * (t > 0.9 ? Math.max(0, 1 - (t - 0.9) * 7) : 1);
        if (r <= 0.5) return;
        ctx.globalAlpha = fade; ctx.drawImage(STAR[0], x - r * 2, y - r * 2, r * 4, r * 4); ctx.globalAlpha = 1;
        return;
      }
      const t = now - sn.boom, A = sn.A;
      for (let k = 0; k < 3; k++) { // light echoes: the flash lighting up dust further and further out
        const r = t * 0.5 - k * 90; if (r < 10) continue;
        const a = 0.28 * (1 - r / (u * 1.4)) * A; if (a <= 0) continue;
        ctx.setLineDash([60 + k * 30, 14, 10, 18]); ctx.lineDashOffset = k * 40;
        ctx.strokeStyle = `rgba(200,225,255,${a})`; ctx.lineWidth = 1.5 + k; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
      }
      ctx.setLineDash([]);
      if (sn.R > 2) { const R = sn.R * 1.28; ctx.globalAlpha = A; ctx.save(); ctx.translate(x, y); ctx.rotate(now * 0.00004 + sn.wx); ctx.drawImage(SHELL, -R, -R, R * 2, R * 2); ctx.restore(); }
      const peak = Math.exp(-t / 900); // the explosion itself outshines the galaxy, then fades to a pulsar
      if (peak > 0.02) { const R = u * 0.16 * peak * (S.reduceMotion ? 0.5 : 1) + 8; ctx.globalAlpha = Math.min(1, peak * 1.5); ctx.drawImage(SPIKE[7], x - R, y - R, R * 2, R * 2); }
      ctx.globalAlpha = A;
      const pr = 3 + 2 * Math.sin(now * 0.03); ctx.drawImage(STAR[7], x - pr * 2, y - pr * 2, pr * 4, pr * 4);
      if (S.stage >= 3 || (sn.rel && t > 3000)) { // pulsar lighthouse beams
        ctx.save(); ctx.translate(x, y); ctx.rotate(now * 0.004);
        const L = u * 0.22, gr = ctx.createLinearGradient(0, 0, L, 0); gr.addColorStop(0, 'rgba(190,220,255,0.6)'); gr.addColorStop(1, 'rgba(190,220,255,0)');
        ctx.fillStyle = gr; for (const s of [1, -1]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s * L, -L * 0.05); ctx.lineTo(s * L, L * 0.05); ctx.fill(); }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    },
    over(S, ctx) { fxDraw(S, ctx, S.data); },
    warp(S, n) { // letters ride the blast wave
      swipeNode(S, n);
      const D = S.data, sn = D.sn, d = n.data;
      if (d.push === undefined) d.push = 0;
      d.push *= Math.pow(0.96, S.dt / 16.7);
      if (sn && sn.boom && D.view) {
        const v = D.view, x = v.ox + sn.wx * v.z, y = v.oy + sn.wy * v.z, dx = n.sx - x, dy = n.sy - y, r = Math.hypot(dx, dy) + 1e-3;
        if (r < sn.R * 1.04) d.push = Math.max(d.push, (sn.R * 1.04 - r) * sn.A);
        d.dx = dx / r; d.dy = dy / r;
      }
      if (d.push > 0.3) { n.sx += d.dx * d.push; n.sy += d.dy * d.push; }
    },
    onRelease(S) { return S.data.sn && S.data.sn.boom ? false : undefined; },
    hud(S) {
      const D = S.data, sn = D.sn;
      if (sn && !sn.boom) return sn.rel ? 'failed supernova: it collapsed quietly. Happens to the best stars.' : `PROGENITOR · 18 M☉ red supergiant · iron core · collapse in ${Math.max(0, (1450 - S.held) / 1000).toFixed(1)} s`;
      if (sn && sn.boom) {
        const t = (S.now - sn.boom) / 1000, ly = sn.R / Math.min(S.W, S.H) * 12;
        const echo = t * 500 / Math.min(S.W, S.H);
        return `SUPERNOVA (TYPE II) · shell ${ly.toFixed(1)} ly at ${big(10000 * Math.exp(-t / 25))} km/s · ${echo < 1.4 ? 'light echo ' + (echo * 12).toFixed(1) + ' ly' : 'light echo has left the frame'}${S.stage >= 3 || sn.rel ? ' · remnant: neutron star, 1.4 M☉ in 20 km, spinning 30×/s' : ''}`;
      }
      return `EAGLE-ISH NEBULA · 7,000 ly away · pillars 4 ly tall · ${D.stars.length} stars · hold for a supernova${D.count ? ' · supernovae so far: ' + D.count : ''}`;
    }
  });
  /* ======================= 4. ORRERY: an animatic solar system ======================= */
  const PLANETS = [
    { n: 'Mercury', g: '☿', a: 0.14, e: 0.2, s: 3.2, w: 0.5 }, { n: 'Venus', g: '♀', a: 0.205, e: 0.01, s: 5.4, w: 1.3 },
    { n: 'Earth', g: '⊕', a: 0.27, e: 0.017, s: 5.7, w: 1.8 }, { n: 'Mars', g: '♂', a: 0.345, e: 0.09, s: 4, w: 5 },
    { n: 'Jupiter', g: '♃', a: 0.52, e: 0.048, s: 12.5, w: 0.25 }, { n: 'Saturn', g: '♄', a: 0.65, e: 0.054, s: 10.5, w: 1.6 },
    { n: 'Uranus', g: '♅', a: 0.77, e: 0.047, s: 7.6, w: 3 }, { n: 'Neptune', g: '♆', a: 0.88, e: 0.009, s: 7.4, w: 4.6 },
    { n: 'Pluto', g: '♇', a: 0.94, e: 0.25, s: 2.4, w: 1.98 }
  ];
  const MOONS = { 2: [[2.4, 2.2, 1.6]], 3: [[1.7, 0.6, 0.7], [2.3, 1.1, 0.6]], 4: [[1.5, 0.9, 1.1], [1.9, 1.5, 1], [2.4, 2.4, 1.4], [3, 4, 1.3]], 5: [[2.6, 2.6, 1.5]], 7: [[2.2, -2, 1.2]] }; // [radius in planet radii, period s (negative: retrograde), size]
  let PSPR = null, SHADE = null, SUN = null;
  function planetSprites() {
    if (PSPR) return;
    const disc = (paint) => { const c = mk(64, 64), g = c.getContext('2d'); g.beginPath(); g.arc(32, 32, 31, 0, TAU); g.clip(); paint(g); return c; };
    const bands = (cols, spot) => disc((g) => { cols.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * 64 / cols.length, 64, 64 / cols.length + 1); }); for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${rand(0, 0.08)})`; g.fillRect(rand(0, 64), rand(0, 64), rand(6, 20), 1.5); } if (spot) { g.fillStyle = spot; g.beginPath(); g.ellipse(40, 40, 6, 3.5, 0, 0, TAU); g.fill(); } });
    const rocky = (base, dark, n) => disc((g) => { g.fillStyle = base; g.fillRect(0, 0, 64, 64); for (let i = 0; i < n; i++) { g.fillStyle = dark; g.globalAlpha = rand(0.15, 0.5); g.beginPath(); g.arc(rand(0, 64), rand(0, 64), rand(2, 9), 0, TAU); g.fill(); } g.globalAlpha = 1; });
    PSPR = [
      rocky('#9a948e', '#5d5853', 22),
      disc((g) => { const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, '#f3dfae'); gr.addColorStop(0.5, '#e8c98a'); gr.addColorStop(1, '#f6e6c0'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }),
      disc((g) => { g.fillStyle = '#2c62b8'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#3f8a3e'; for (let i = 0; i < 7; i++) { g.beginPath(); g.ellipse(rand(8, 56), rand(14, 50), rand(5, 12), rand(3, 8), rand(0, 3), 0, TAU); g.fill(); } g.fillStyle = 'rgba(255,255,255,0.75)'; for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(rand(0, 64), rand(0, 64), rand(5, 14), rand(1.5, 3), rand(-0.3, 0.3), 0, TAU); g.fill(); } g.fillRect(0, 0, 64, 5); g.fillRect(0, 59, 64, 5); }),
      disc((g) => { g.fillStyle = '#c1562c'; g.fillRect(0, 0, 64, 64); g.fillStyle = 'rgba(90,30,15,0.5)'; for (let i = 0; i < 8; i++) { g.beginPath(); g.ellipse(rand(0, 64), rand(18, 46), rand(4, 12), rand(2, 5), 0, 0, TAU); g.fill(); } g.fillStyle = '#f3ece6'; g.beginPath(); g.ellipse(32, 2, 14, 5, 0, 0, TAU); g.fill(); }),
      bands(['#e8d8bd', '#c9a27a', '#efe3cc', '#b5835a', '#e9dcc4', '#c99b6c', '#f0e4cf', '#b88a63', '#e4d4b8'], 'rgba(200,90,60,0.85)'),
      bands(['#efe0b5', '#e1c78f', '#f2e5c0', '#d8bc85', '#efe1b9', '#dcc290']),
      disc((g) => { const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, '#bdeef0'); gr.addColorStop(1, '#8fd3dc'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }),
      disc((g) => { const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, '#4b7be0'); gr.addColorStop(1, '#2d4fb5'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); g.fillStyle = 'rgba(20,30,90,0.6)'; g.beginPath(); g.ellipse(24, 38, 7, 4, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(10, 20, 30, 2); }),
      rocky('#d9c2a4', '#8b6f55', 10)
    ];
    SHADE = mk(64, 64); // night side on the right; rotated away from the Sun when drawn
    { const g = SHADE.getContext('2d'), gr = g.createLinearGradient(8, 0, 64, 0); gr.addColorStop(0, 'rgba(0,0,8,0)'); gr.addColorStop(0.42, 'rgba(0,0,8,0.25)'); gr.addColorStop(0.62, 'rgba(0,0,8,0.88)'); gr.addColorStop(1, 'rgba(0,0,8,0.96)'); g.beginPath(); g.arc(32, 32, 32, 0, TAU); g.clip(); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }
    SUN = mk(256, 256);
    { const g = SUN.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 120); // limb darkening and granulation
      gr.addColorStop(0, '#fffbea'); gr.addColorStop(0.55, '#ffe7a8'); gr.addColorStop(0.85, '#ffb44a'); gr.addColorStop(1, '#f2761e');
      g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 120, 0, TAU); g.fill(); g.save(); g.clip();
      for (let i = 0; i < 1600; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,230,0.12)' : 'rgba(190,90,10,0.1)'; g.beginPath(); g.arc(rand(0, 256), rand(0, 256), rand(1.5, 4), 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(60,20,0,0.6)'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(rand(70, 186), rand(90, 166), rand(3, 7), 0, TAU); g.fill(); }
      g.restore(); }
  }
  function orreryBuild(S) {
    const D = S.data, W = S.W, H = S.H, g = (D.bg.width = Math.round(W * S.DPR), D.bg.height = Math.round(H * S.DPR), D.bg.getContext('2d'));
    g.setTransform(S.DPR, 0, 0, S.DPR, 0, 0);
    g.fillStyle = '#03040a'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    g.save(); g.translate(W / 2, H / 2); g.rotate(-0.45); // a faint Milky Way band
    const L = Math.hypot(W, H), gr = g.createLinearGradient(0, -H * 0.3, 0, H * 0.3);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(70,75,110,0.16)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(-L / 2, -H * 0.3, L, H * 0.6);
    for (let i = 0; i < W * H / 500; i++) { const c = BB[bbBin()]; g.fillStyle = rgb(c, rand(0.08, 0.4)); g.fillRect(rand(-L / 2, L / 2), gauss() * H * 0.1, 1, 1); }
    g.restore();
    for (let i = 0; i < W * H / 1600; i++) { const f = Math.pow(Math.random(), 3), c = BB[bbBin()]; g.fillStyle = rgb(c, 0.15 + 0.7 * f); const d = 0.6 + 1.2 * f; g.fillRect(rand(0, W), rand(0, H), d, d); }
  }
  function kepler(M, e) { let E = M + e * Math.sin(M); for (let i = 0; i < 2; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); return E; }
  function voyager() { return 24.4e9 + (Date.now() - Date.UTC(2024, 0, 1)) / 1000 * 17; }
  addMode({
    id: 'orrery', name: 'ORRERY', opaque: true, pageBg: ['#04050c', '#03040a'],
    glyphs: '∗✧⋆•✦·☄',
    base: [40, 30, 82], palette: [[45, 100, 65], [200, 90, 66], [10, 90, 62]],
    links: ['curve', 'comet', 'beam', 'constellation'],
    shapes: ['sphere', 'atom', 'torus', 'hopf', 'galaxy'],
    init(S) {
      const D = S.data; planetSprites(); fx(D);
      D.bg = S.offscreen(1, 1); orreryBuild(S);
      D.M0 = PLANETS.map(() => rand(0, TAU)); D.trail = PLANETS.map(() => []); D.tt = 0;
      D.rg = { x: S.cx, y: S.cy, p: 0 }; D.ejected = 0; D.show = 0; D.showT = -1e9; D.line = 0; D.lineT = 0; D.pos = PLANETS.map(() => [0, 0, 0]);
    },
    resize(S) { const D = S.data, m = this; clearTimeout(D.rt); D.rt = setTimeout(() => { if (S.mode === m && S.data === D) orreryBuild(S); }, 160); },
    exit(S) { clearTimeout(S.data.rt); },
    onPress(S, x, y) { const r = S.data.rg; if (r.p < 0.05) { r.x = x; r.y = y; } },
    onTap(S) { S.data.showT = S.now; }, // show the new shape for a moment, then the planets fall back into orbit
    update(S, now, dt) {
      const D = S.data, r = D.rg, u = Math.min(S.W, S.H);
      S.active.forEach((n, i) => { n.data.k = i; });
      const t = now - D.showT; D.show = t < 0 ? 0 : t < 400 ? t / 400 : t < 1900 ? 1 : Math.max(0, 1 - (t - 1900) / 900);
      D.sq = 0.3 + 0.32 * (0.5 + 0.5 * Math.sin(S.rotX)); // the camera slowly tilts
      D.orb = Math.min(S.W * 0.44, S.H * 0.46 / D.sq, u * 0.75);
      D.sunR = u * 0.045;
      if (S.holding) { r.p = Math.pow(clamp((S.held - 150) / 4300, 0, 1), 0.8); const k = 1 - Math.pow(0.85, dt / 16.7); r.x += (S.ptr.x - r.x) * k; r.y += (S.ptr.y - r.y) * k; }
      else { r.p *= Math.pow(0.5, dt / 300); if (r.p < 0.004) r.p = 0; }
      if (now - D.lineT > 5000) { D.lineT = now; D.line++; }
      if (r.p > 0.05 && Math.random() < 0.8) fxAdd(D, 2, r.x + rand(-5, 5), r.y + rand(-5, 5), rand(-0.04, 0.04), rand(-0.04, 0.04), rand(500, 1000), rand(5, 10), pick([2, 3]), { tail: 12 }); // the rogue's shimmer wake
      fxStep(S, D, dt, null);
    },
    background(S, ctx) { const b = S.data.bg; ctx.drawImage(b, 0, 0, b.width / S.DPR, b.height / S.DPR); },
    ambient(S, ctx, now) { // orbits and trails
      const D = S.data, R = D.orb, sq = D.sq, A = 1 - D.show;
      ctx.lineWidth = 1;
      PLANETS.forEach((P, k) => {
        const b = P.a * Math.sqrt(1 - P.e * P.e);
        ctx.save(); ctx.translate(S.cx, S.cy); ctx.scale(1, sq); ctx.rotate(P.w); ctx.beginPath(); ctx.ellipse(-P.a * P.e * R, 0, P.a * R, b * R, 0, 0, TAU); ctx.restore();
        ctx.strokeStyle = `rgba(150,170,220,${(k === 8 ? 0.06 : 0.1) * A})`; ctx.stroke();
      });
      ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      D.trail.forEach((tr, k) => {
        const L = tr.length; if (L < 6) return;
        ctx.lineWidth = Math.min(3, PLANETS[k].s * 0.35);
        for (let seg = 0; seg < 4; seg++) {
          const i0 = Math.floor(seg * L / 8) * 2, i1 = Math.min(L, Math.floor((seg + 1) * L / 8) * 2 + 2);
          ctx.strokeStyle = `rgba(255,220,160,${0.07 * (seg + 1) * A})`; ctx.beginPath(); ctx.moveTo(tr[i0], tr[i0 + 1]);
          for (let i = i0 + 2; i < i1; i += 2) ctx.lineTo(tr[i], tr[i + 1]);
          ctx.stroke();
        }
      });
    },
    under(S, ctx, now) { // the Sun (drawn before the planets, which hide behind it via drawNode), and the rogue
      const D = S.data, R = D.sunR, x = S.cx, y = S.cy;
      ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createRadialGradient(x, y, R * 0.8, x, y, R * 5);
      gr.addColorStop(0, `rgba(255,200,110,${0.35 + 0.05 * Math.sin(now * 0.002)})`); gr.addColorStop(0.3, 'rgba(255,150,60,0.1)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, R * 5, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,130,60,0.35)'; ctx.lineWidth = 1.2; // prominences
      for (let k = 0; k < 3; k++) { const a = now * 0.00005 + k * 2.1, h = R * (0.1 + 0.07 * Math.sin(now * 0.001 + k)); ctx.beginPath(); ctx.arc(x + Math.cos(a) * R, y + Math.sin(a) * R, h, a - Math.PI * 0.9, a + Math.PI * 0.9); ctx.stroke(); }
      ctx.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.translate(x, y); ctx.rotate(now * 0.00003); ctx.drawImage(SUN, -R * 1.07, -R * 1.07, R * 2.14, R * 2.14); ctx.restore();
      const r = D.rg;
      if (r.p > 0.02) { // a rogue brown dwarf barging in
        const rr = 6 + 14 * r.p, g2 = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, rr * 4);
        g2.addColorStop(0, 'rgba(255,120,80,0.9)'); g2.addColorStop(0.25, `rgba(180,40,30,${0.5 * r.p})`); g2.addColorStop(1, 'rgba(120,20,20,0)');
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(r.x, r.y, rr * 4, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#3a120c'; ctx.beginPath(); ctx.arc(r.x, r.y, rr, 0, TAU); ctx.fill();
        ctx.strokeStyle = `rgba(255,110,70,${0.8 * r.p})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(r.x, r.y, rr, 0, TAU); ctx.stroke();
      }
    },
    warp(S, n) {
      const D = S.data, d = n.data, k = d.k === undefined ? -1 : d.k, R = D.orb, now = S.now, dt = S.dt;
      if (d.ox === undefined) { d.ox = 0; d.oy = 0; d.vx = 0; d.vy = 0; d.ast = { a: Math.random() < 0.72 ? rand(0.4, 0.47) : rand(1, 1.14), e: rand(0, 0.12), w: rand(0, TAU), M0: rand(0, TAU) }; }
      let a, e, w, M0, P = null;
      if (k >= 0 && k < PLANETS.length) { P = PLANETS[k]; a = P.a; e = P.e; w = P.w; M0 = D.M0[k]; } else { const o = d.ast; a = o.a; e = o.e; w = o.w; M0 = o.M0; }
      const T = 7000 * Math.pow(a / 0.14, 1.5), E = kepler(now / T * TAU + M0, e);
      const px = a * (Math.cos(E) - e), py = a * Math.sqrt(1 - e * e) * Math.sin(E), cw = Math.cos(w), sw = Math.sin(w);
      const x = (px * cw - py * sw) * R, y = (px * sw + py * cw) * R;
      let X = S.cx + x, Y = S.cy + y * D.sq;
      const r = D.rg;
      const pv0 = pvel(S);
      if (r.p > 0.02 || Math.abs(pv0.x) + Math.abs(pv0.y) > 1 || Math.abs(d.vx) + Math.abs(d.vy) > 0.001 || Math.abs(d.ox) + Math.abs(d.oy) > 0.5) { // perturbation from the rogue, sprung back to the orbit
        const qx = X + d.ox, qy = Y + d.oy, dx = r.x - qx, dy = r.y - qy, d2 = dx * dx + dy * dy, dd = Math.sqrt(d2) + 1e-3;
        const G = S.holding ? 7e-9 * Math.pow(Math.min(S.W, S.H), 3) * r.p * r.p : 0, acc = Math.min(0.01, G / (d2 + 900));
        const ks = S.holding ? 4e-7 : 2.5e-6, pv = pvel(S), ex = qx - S.ptr.x, ey = qy - S.ptr.y;
        if (!S.holding && ex * ex + ey * ey < 16000) { const f = 1 - Math.hypot(ex, ey) / 126; d.vx += pv.x * 0.003 * f; d.vy += pv.y * 0.003 * f; } // a swipe bats planets off course
        d.vx += (dx / dd * acc - d.ox * ks) * dt; d.vy += (dy / dd * acc - d.oy * ks) * dt;
        const damp = Math.pow(0.985, dt / 16.7); d.vx *= damp; d.vy *= damp;
        d.ox += d.vx * dt; d.oy += d.vy * dt;
        if (!d.ej && Math.hypot(d.ox, d.oy) > Math.min(S.W, S.H) * 0.45) { d.ej = 1; D.ejected++; fxAdd(D, 0, qx, qy, 0, 0, 800, 18, 4); }
        if (Math.hypot(d.ox, d.oy) < 20) d.ej = 0;
      }
      X += d.ox; Y += d.oy;
      const sh = D.show;
      n.sx = X + (n.sx - X) * sh; n.sy = Y + (n.sy - Y) * sh;
      n.z = sh > 0.5 ? n.z : y / R; d.back = y < 0;
      if (!P) n.shrink *= a > 0.9 ? 0.5 : 0.6;
      else if (S.now - D.tt > 0) { D.pos[k][0] = n.sx; D.pos[k][1] = n.sy; D.pos[k][2] = 1; }
    },
    drawNode(S, ctx, n, g, size, a) {
      const D = S.data, d = n.data, k = d.k === undefined ? -1 : d.k;
      if (d.back && Math.hypot(n.sx - S.cx, n.sy - S.cy) < D.sunR) return true; // behind the Sun
      if (k < 0 || k >= PLANETS.length || n.dying) return false;
      const P = PLANETS[k], s = P.s * Math.min(S.W, S.H) / 900 * (1 + 0.3 * D.show), x = n.sx, y = n.sy;
      if (n.inf) { const gr = ctx.createRadialGradient(x, y, s, x, y, s * 3); gr.addColorStop(0, S.colorOf(n.gen, 0.45 * a)); gr.addColorStop(1, S.colorOf(n.gen, 0)); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, s * 3, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
      if (k === 5) { ctx.strokeStyle = 'rgba(225,205,160,0.35)'; ctx.lineWidth = s * 0.45; ctx.beginPath(); ctx.ellipse(x, y, s * 2.1, s * 2.1 * D.sq, -0.15, Math.PI, TAU); ctx.stroke(); } // far half of Saturn's rings
      ctx.globalAlpha = clamp(a + 0.3, 0, 1);
      ctx.drawImage(PSPR[k], x - s, y - s, s * 2, s * 2);
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(y - S.cy, x - S.cx)); ctx.drawImage(SHADE, -s, -s, s * 2, s * 2); ctx.restore();
      if (k === 5) { ctx.strokeStyle = 'rgba(235,215,170,0.6)'; ctx.lineWidth = s * 0.45; ctx.beginPath(); ctx.ellipse(x, y, s * 2.1, s * 2.1 * D.sq, -0.15, 0, Math.PI); ctx.stroke(); ctx.strokeStyle = 'rgba(200,180,140,0.35)'; ctx.lineWidth = s * 0.2; ctx.beginPath(); ctx.ellipse(x, y, s * 1.55, s * 1.55 * D.sq, -0.15, 0, Math.PI); ctx.stroke(); }
      ctx.globalAlpha = 1;
      ctx.font = '11px monospace'; ctx.fillStyle = n.inf ? S.colorOf(n.gen, 0.85) : 'rgba(220,225,240,0.55)';
      ctx.fillText(P.g, x + s + 8, y - s - 4);
      (MOONS[k] || []).forEach((m) => { const an = S.now / (m[1] * 1000) * TAU + k, mr = m[0] * s * 1.4, mx = x + Math.cos(an) * mr, my = y + Math.sin(an) * mr * D.sq; if (Math.sin(an) < 0 && Math.abs(mx - x) < s) return; ctx.fillStyle = 'rgba(220,220,225,0.9)'; ctx.beginPath(); ctx.arc(mx, my, m[2] * Math.min(S.W, S.H) / 1000 + 0.5, 0, TAU); ctx.fill(); });
      return true;
    },
    over(S, ctx) { // fx, and record planet trails
      const D = S.data;
      fxDraw(S, ctx, D);
      if (S.now - D.tt < 60) return;
      D.tt = S.now;
      D.pos.forEach((p, k) => { if (!p[2]) return; const tr = D.trail[k]; tr.push(p[0], p[1]); if (tr.length > 90) tr.splice(0, 2); p[2] = 0; });
    },
    onRelease(S, held, power) { // slingshot: everything near the rogue gets a sideways kick
      const r = S.data.rg;
      if (r.p < 0.1) return;
      S.nodes.forEach((n) => { const d = n.data; if (d.ox === undefined) return; const dx = n.sx - r.x, dy = n.sy - r.y, dd = Math.hypot(dx, dy) + 30, v = Math.min(0.9, 60 * r.p / dd); d.vx += -dy / dd * v + dx / dd * v * 0.5; d.vy += dx / dd * v + dy / dd * v * 0.5; });
      S.ring(r.x, r.y, 160 + 200 * r.p, [10, 90, 62], 1000);
      fxBurst(S.data, r.x, r.y, Math.min(S.W, S.H) * (0.15 + 0.3 * r.p), 3, 600);
      for (let k = 0; k < 60 * r.p; k++) { const a = rand(0, TAU), v = rand(0.3, 1.1); fxAdd(S.data, k % 2 ? 2 : 0, r.x, r.y, Math.cos(a) * v, Math.sin(a) * v, rand(400, 900), rand(5, 10), k % 2 ? 4 : pick([0, 2]), { tail: 30, flat: 1, drag: 0.96 }); } // slingshot speed lines
    },
    hud(S) {
      const D = S.data, r = D.rg;
      if (S.holding && r.p > 0.03) return `ROGUE BROWN DWARF · ${(13 + 60 * r.p).toFixed(0)} M♃ · ${D.ejected} worlds flung off their orbits · Pluto: still not a planet`;
      const lines = [
        () => `Since you opened this page, Earth has moved ${big(29.78 * performance.now() / 1000)} km around the Sun`,
        () => `Voyager 1: ${big(voyager())} km from the Sun and counting`,
        () => 'Pluto: still not a planet. It has filed an appeal.',
        () => 'Mercury retrograde: an optical illusion. Your code is broken for other reasons.',
        () => `Jupiter: 318 Earths of gas, 95 known moons${D.ejected ? ' (fewer, after what you did)' : ''}`,
        () => 'Neptune: one year = 164.8 Earth years. It has finished about one since it was found in 1846.',
        () => 'Triton orbits Neptune backwards. Nobody asked it to.',
        () => 'Not to scale: with orbits this size the real Sun would be about a quarter of a pixel wide.'
      ];
      return lines[D.line % lines.length]();
    }
  });
})(window.SPHERE);
