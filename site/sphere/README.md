# The Sphere: pack contract

The engine (`sphere-core.js`) draws everything on one transparent full-screen 2D canvas over the page's WebGL wave background. Packs are plain scripts, loaded after the engine and before `SPHERE.start()`, in this order: `pack-base.js`, `pack-shapes.js`, `pack-links.js`, `pack-cosmos.js`, `pack-modes.js`. Each pack is an IIFE: `(function (SP) { ... })(window.SPHERE);`. There is no build step, no modules and no network access. Everything is hand-written and self-contained.

Helpers: `SP.util = { TAU, GOLDEN, rand(a,b), pick(arr), clamp(v,a,b), hsl([h,s,l], hueShift, alpha), randomGlyph() }`.

## Shapes: `SP.addShape(key, def)`
- `name`: shown in the HUD.
- `make(n)`: returns an array of points `[x, y, z]` or `[x, y, z, w]`. Any scale works: the engine centres them and scales them into the unit ball.
- `fixed: true`: the shape has its own point count (a polyhedron's vertices), and `make` ignores `n`. Otherwise return exactly `n` points; the engine pads or truncates.
- `four: true`: a 4D shape. The engine rotates it in the xw and zw planes (speed `S.a4Speed`) and projects it to 3D.
- `edges: true | tolerance`: draw a wireframe joining every pair of points whose distance is at most tolerance × the shortest distance (default 1.04). Use it for polyhedra.
- `edgeList: [[i, j], ...]`: an explicit wireframe, for when the automatic one would be wrong.
- `noCenter: true`: skip centring.
- Points map to letters by index, so a shape morphs into the next point by point.

## Web (link) styles: `SP.addLink(key, draw)`
`draw(ctx, L, S)` is called for each infection link every frame. Before the call, the engine sets `strokeStyle` and `fillStyle` to the link colour, `lineWidth = L.width`, a round cap and no dash. It sets the composite to `'lighter'` from stage I on, otherwise `'source-over'`. It resets all of these afterwards.

`L` fields:
- `ax, ay`: the parent letter on screen. `bx, by`: the growing end. `fx, fy`: the child's full position. `grow` (0..1) is how far the link has grown.
- `alpha` (0..1): **multiply every alpha you draw with by this.** It includes the fade-out.
- `color(a)` and `colorA(a)`: CSS colours for this generation and the parent's.
- `gen`, `seed` (a stable random number per link, 0..1), `age` (ms), `now`, `stage` (0..3), `width`, `A`, `B` (the node objects).

Keep each draw cheap. There can be 240 links, at 60 fps.

## Modes: `SP.addMode(def)`
Data fields:
- `id`, `name` (UPPERCASE, shown in the HUD).
- `glyphs`: a string of letters, `'random'` (random characters from many scripts), or `function (S) { return oneGlyph; }`.
- `base: [h, s, l]` for clean letters. `palette: [[h, s, l], ...]` for infection generations.
- `link: 'key'`, or `links: ['k0', 'k1', 'k2', 'k3']` to switch web style per stage (0 to III). Unknown keys fall back to `'line'`.
- `shapes: ['key', ...]`: the shapes this mode cycles through. Unknown keys are skipped.
- `count`: the default number of letters, `'random'` (30 to 170 at every shape change), or omitted (80).
- `fade`: trail persistence per frame, 0..1 (1 means no trails). `opaque: true`: the canvas is cleared each frame and you paint your own background in `background()`.
- `mesh: true`: always draw a wireframe. `glyphScale` and `scale` (the sphere's radius factor). `noHueShift: true`: colours don't drift while holding. `glitchy: true`: random slice glitches while holding.

Hooks (all optional). `this` is the mode, and the first argument is always the engine state `S`:
- `init(S)`, `exit(S)`, `resize(S)`.
- `update(S, now, dt)`: runs every frame before projection.
- `warp(S, node)`: runs per node after projection. It can move `node.sx`/`node.sy` and scale `node.shrink`.
- `background(S, ctx, now, dt)`, `ambient(S, ctx, now, dt)` (before links), `under(S, ctx, now, dt)` (after links, before letters) and `over(S, ctx, now, dt)` (after letters). The engine resets the composite op and globalAlpha after each.
- `drawNode(S, ctx, node, glyph, size, alpha)`: return `true` to replace the default letter drawing for that node.
- `onPress(S, x, y)`, `onInfect(S, node, parent)`, `onTap(S, x, y)` (return `false` to cancel the default shape change).
- `onClimax(S)`: everything is infected. Return `false` to cancel the default burst and shape change.
- `onRelease(S, held, power)`: return `false` to cancel the default shockwave and particles.
- `hud(S)`: returns one short status line, shown under the main HUD lines. Good for jokes.

Keep per-mode state in `S.data`, which is reset on every mode change.

## Engine state `S`
- Canvas and geometry: `ctx`, `canvas`, `W`, `H`, `cx`, `cy`, `R` (sphere radius in px), `DPR`.
- Time: `now`, `dt`.
- Nodes: `nodes` (all, including ones fading out), `active` (the live ones, in shape order), `links`. A node has `p: [x, y, z, w]` (current 3D/4D position), `sx`, `sy` (screen), `sc` (perspective scale, about 0.6 to 2), `z`, `alpha`, `inf`, `gen`, `g` (glyph) and `data` (scratch).
- Interaction: `ptr {x, y}`, `down`, `holding`, `held` (ms), `stage` (0 to 3), `seed` (the first infected node), `infected`.
- Rotation: `hueShift`, `rotX`, `rotY`, `a4Speed`, `spinScale`.
- Current mode and shape: `mode`, `shape` (`.key`, `.name`, `.pts`, `.mesh`).
- Helpers:
  - `colorOf(gen, a)`, `baseColor(a)`, `hsl()`.
  - `spawn(x, y, vx, vy, cssColor, lifeMs, size, extra)`. Particles are drawn additively. `extra` may set `g` (gravity), `drag`, or `glyph` (draw a letter instead of a square).
  - `ring(x, y, maxRadius, [h, s, l], lifeMs)`, `flash(amount, 'r,g,b')`, `shake(px)`, `glitch(ms)`, `burst(x, y, size)`.
  - `nextShape(step)`, `setCount(n)`, `glyph()`, `offscreen(w, h)` (makes a canvas), `line(x1, y1, x2, y2)`.
  - `reduceMotion`: when it's true, skip flashing, strobing and shaking effects.

## Rules
- Per frame at stage III, aim for under 6 ms of your own work on a laptop. Prefer `fillRect` and paths over `shadowBlur`. Cache gradients and offscreen canvases.
- The canvas is transparent (unless `opaque`). Don't paint over the whole page unless the mode is meant to.
- No external requests, images or fonts. Draw everything procedurally.
