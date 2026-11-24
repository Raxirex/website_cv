/* The Sphere: 3D layer (WebGL via three.js r128, which the page already loads).
 *
 * A mode opts in with `three: { init(S, X), update(S, X, now, dt), exit(S, X) }`. The layer then:
 * - loads the vendored three.js add-ons on first use (sphere/vendor/three; no third-party requests);
 * - creates ONE WebGL renderer behind the 2D canvas, with anti-aliasing, ACES filmic tone mapping,
 *   sRGB output, soft shadows and physically correct lights;
 * - gives the mode a fresh scene and camera, renders it every frame (through bloom when asked for),
 *   and disposes all of the mode's geometry, materials and textures when the mode is left.
 * The 2D canvas (letters, webs, particles, HUD effects) is still drawn on top.
 * See README.md, "3D modes".
 */
(function (global) {
  'use strict';
  const SP = global.SPHERE;
  if (!SP || !global.THREE) return;
  const THREE = global.THREE;

  const VENDOR = ['CopyShader', 'LuminosityHighPassShader', 'FXAAShader', 'EffectComposer', 'RenderPass', 'ShaderPass',
    'UnrealBloomPass', 'Sky', 'Water', 'ImprovedNoise', 'RoundedBoxGeometry', 'RoomEnvironment'];
  let loading = null;
  function loadVendor() {
    if (loading) return loading;
    const base = (global.SITE_ASSET_BASE || '') + 'sphere/vendor/three/';
    loading = VENDOR.reduce((p, name) => p.then(() => new Promise((res) => {
      const s = document.createElement('script');
      s.src = base + name + '.js';
      s.onload = res; s.onerror = () => { console.warn('[sphere-3d] could not load', name); res(); };
      document.head.appendChild(s);
    })), Promise.resolve());
    return loading;
  }

  // Final pass when post-processing: the composer renders in linear space, so tone map and encode here.
  const OutputShader = {
    uniforms: { tDiffuse: { value: null }, exposure: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: [
      'uniform sampler2D tDiffuse; uniform float exposure; varying vec2 vUv;',
      'vec3 aces(vec3 x){ x *= exposure; return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }',
      'vec3 toSRGB(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }',
      'void main(){ vec4 t = texture2D(tDiffuse, vUv); gl_FragColor = vec4(toSRGB(aces(t.rgb)), t.a); }'
    ].join('\n')
  };

  let renderer = null, glCanvas = null, X = null, active = null, pending = 0, failed = false;

  function ensureRenderer(S) {
    if (renderer || failed) return renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (err) { failed = true; console.warn('[sphere-3d] WebGL unavailable', err); return null; }
    glCanvas = renderer.domElement;
    glCanvas.id = 'sphere-gl';
    glCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;display:none;';
    S.container.insertBefore(glCanvas, S.canvas);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.physicallyCorrectLights = true;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);
    return renderer;
  }

  function disposeScene(scene) {
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach((m) => { Object.keys(m).forEach((k) => { if (m[k] && m[k].isTexture) m[k].dispose(); }); m.dispose(); });
    });
    if (scene.background && scene.background.isTexture) scene.background.dispose();
    if (scene.environment && scene.environment.isTexture) scene.environment.dispose();
  }

  function size(S) {
    if (!renderer) return;
    const pr = Math.min(S.DPR, X && X.maxPixelRatio ? X.maxPixelRatio : 1.5);
    renderer.setPixelRatio(pr);
    renderer.setSize(S.W, S.H, false);
    if (X) {
      X.camera.aspect = S.W / Math.max(1, S.H); X.camera.updateProjectionMatrix();
      if (X.composer) {
        X.composer.setPixelRatio(pr); X.composer.setSize(S.W, S.H);
        if (X.fxaa) X.fxaa.material.uniforms.resolution.value.set(1 / (S.W * pr), 1 / (S.H * pr));
      }
    }
  }

  function buildComposer(S) {
    if (!THREE.EffectComposer || !THREE.UnrealBloomPass) return;
    const pr = renderer.getPixelRatio();
    const rt = new THREE.WebGLRenderTarget(S.W * pr, S.H * pr, { type: THREE.HalfFloatType, format: THREE.RGBAFormat });
    const composer = new THREE.EffectComposer(renderer, rt);
    composer.addPass(new THREE.RenderPass(X.scene, X.camera));
    X.bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(S.W, S.H), X.bloom.strength, X.bloom.radius, X.bloom.threshold);
    composer.addPass(X.bloomPass);
    const out = new THREE.ShaderPass(OutputShader);
    out.uniforms.exposure.value = renderer.toneMappingExposure;
    X.outputPass = out;
    composer.addPass(out);
    if (THREE.FXAAShader) { X.fxaa = new THREE.ShaderPass(THREE.FXAAShader); composer.addPass(X.fxaa); }
    X.composer = composer;
    size(S);
  }

  function start(S, mode) {
    if (!ensureRenderer(S)) return;
    const camera = new THREE.PerspectiveCamera(45, S.W / Math.max(1, S.H), 0.1, 5000);
    camera.position.set(0, 0, 10);
    X = {
      THREE, renderer, camera, scene: new THREE.Scene(), mode,
      bloom: null, composer: null, bloomPass: null, maxPixelRatio: 1.5,
      noise: THREE.ImprovedNoise ? new THREE.ImprovedNoise() : null,
      // Ask for bloom: X.setBloom(strength, radius, threshold). Call in init; strength 0 turns it off.
      setBloom(strength, radius, threshold) {
        X.bloom = { strength, radius: radius === undefined ? 0.4 : radius, threshold: threshold === undefined ? 0.85 : threshold };
        if (strength > 0 && !X.composer) buildComposer(S);
        if (X.bloomPass) { X.bloomPass.strength = strength; X.bloomPass.radius = X.bloom.radius; X.bloomPass.threshold = X.bloom.threshold; }
      },
      setExposure(e) { renderer.toneMappingExposure = e; if (X.outputPass) X.outputPass.uniforms.exposure.value = e; },
      // Image-based lighting from a neutral studio environment (good for metals and glass).
      studioEnvironment() {
        if (!THREE.RoomEnvironment) return null;
        const pm = new THREE.PMREMGenerator(renderer);
        const tex = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
        pm.dispose();
        X.scene.environment = tex;
        return tex;
      },
      // A canvas you can draw on and use as a texture (procedural textures: windows, wood, noise...).
      canvasTexture(w, h, draw) {
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        draw(c.getContext('2d'), w, h);
        const t = new THREE.CanvasTexture(c);
        t.encoding = THREE.sRGBEncoding; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
        return t;
      },
      // World position -> screen pixels in the sphere canvas (for 2D overlays that follow 3D objects).
      toScreen(v) { const p = v.clone().project(camera); return { x: (p.x + 1) / 2 * S.W, y: (1 - p.y) / 2 * S.H, behind: p.z > 1 }; },
      // Screen pixels -> a world point on the plane z = planeZ (for pointer interaction).
      fromScreen(x, y, planeZ) {
        const ndc = new THREE.Vector3(x / S.W * 2 - 1, -(y / S.H) * 2 + 1, 0.5).unproject(camera);
        const dir = ndc.sub(camera.position).normalize();
        const t = ((planeZ || 0) - camera.position.z) / dir.z;
        return camera.position.clone().add(dir.multiplyScalar(t));
      }
    };
    renderer.toneMappingExposure = 1;
    renderer.setClearColor(0x000000, 0);
    size(S);
    try { mode.three.init(S, X); } catch (err) { console.error('[sphere-3d] init', mode.id, err); }
    size(S);
    glCanvas.style.display = 'block';
    active = mode;
  }

  function stop(S) {
    if (!X) return;
    try { if (active && active.three.exit) active.three.exit(S, X); } catch (err) { console.error('[sphere-3d] exit', err); }
    disposeScene(X.scene);
    if (X.composer) { X.composer.renderTarget1.dispose(); X.composer.renderTarget2.dispose(); }
    if (X.bloomPass) X.bloomPass.dispose();
    X = null; active = null;
    if (glCanvas) glCanvas.style.display = 'none';
    S.three = null;
  }

  SP.layer3d = {
    onMode(S, prev, next) {
      if (X) stop(S);
      if (!next || !next.three) return;
      const token = ++pending;
      loadVendor().then(() => { if (token === pending && S.mode === next) { start(S, next); S.three = X; } });
    },
    resize(S) { size(S); },
    render(S, now, dt) {
      if (!X || !active || S.mode !== active) return;
      try { if (active.three.update) active.three.update(S, X, now, dt); } catch (err) { if (!X.err) { X.err = 1; console.error('[sphere-3d] update', active.id, err); } }
      if (X.composer && X.bloom && X.bloom.strength > 0) X.composer.render(dt / 1000);
      else renderer.render(X.scene, X.camera);
    }
  };
})(window);
