// WORLD.JS — renderer, sky, sun, fog, water and the light rig that turns
// Puerto Sol into a postcard at the end of the day.
import * as THREE from 'three';
import { PALETTE, textureFromCanvas } from './neon.js';

const SKY_VERTEX = `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT = `
  varying vec3 vDirection;
  uniform vec3 uTop;
  uniform vec3 uMid;
  uniform vec3 uHorizon;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;
  uniform float uTime;

  void main() {
    vec3 dir = normalize(vDirection);
    float h = clamp(dir.y * 0.92 + 0.08, 0.0, 1.0);
    vec3 color = mix(uHorizon, uMid, smoothstep(0.0, 0.34, h));
    color = mix(color, uTop, smoothstep(0.28, 0.9, h));
    float sunDot = max(dot(dir, uSunDir), 0.0);
    color += uSunColor * pow(sunDot, 9.0) * 0.42;
    color += uSunColor * pow(sunDot, 90.0) * 0.55;
    float disc = smoothstep(0.9982, 0.9993, sunDot);
    color = mix(color, uSunColor, disc);
    // broad cloud bands drifting over the coast
    float bands = sin(dir.y * 58.0 + sin(dir.x * 8.0 + uTime * 0.02) * 2.0);
    float clouds = smoothstep(0.83, 0.995, bands) * smoothstep(0.02, 0.23, dir.y) * smoothstep(0.62, 0.2, dir.y);
    color = mix(color, mix(uMid, uSunColor, 0.55), clouds * 0.33);
    float haze = pow(1.0 - h, 4.0);
    color = mix(color, uHorizon, haze * 0.38);
    gl_FragColor = vec4(color, 1.0);
  }
`;

const WATER_VERTEX = `
  uniform float uTime;
  varying vec3 vWorld;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.y += sin(p.x * 0.045 + uTime * 0.85) * 0.28;
    p.y += sin(p.z * 0.075 - uTime * 0.62) * 0.2;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const WATER_FRAGMENT = `
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uGlint;
  uniform vec3 uSunDir;
  uniform vec3 uHorizon;
  varying vec3 vWorld;
  varying vec2 vUv;

  void main() {
    float roll = sin(vWorld.z * 0.18 + sin(vWorld.x * 0.07 + uTime * 0.3) * 2.2 + uTime * 0.28);
    float chop = sin(vWorld.x * 0.34 - uTime * 0.7) * sin(vWorld.z * 0.21 + uTime * 0.4);
    vec3 normal = normalize(vec3(chop * 0.08, 1.0, roll * 0.07));
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 2.4);
    float shore = smoothstep(420.0, 145.0, vWorld.x);
    vec3 color = mix(uDeep, uShallow, shore * 0.7 + 0.12);
    color = mix(color, uHorizon, fresnel * 0.45);
    float glitter = pow(max(dot(reflect(-uSunDir, normal), viewDir), 0.0), 55.0);
    color += uGlint * glitter * 1.9;
    float streak = smoothstep(0.55, 0.98, sin(vWorld.z * 0.145 + uTime * 0.18 + roll * 0.7) * 0.5 + 0.5);
    color += uGlint * streak * 0.055 * (0.4 + shore);
    float foam = smoothstep(0.92, 1.0, sin(vWorld.z * 0.42 + uTime * 0.65) * 0.5 + 0.5);
    foam *= smoothstep(220.0, 155.0, vWorld.x) * smoothstep(120.0, 164.0, vWorld.x);
    color = mix(color, vec3(0.95, 0.86, 0.73), foam * 0.5);
    gl_FragColor = vec4(color, 1.0);
  }
`;

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.skyMid);
    this.scene.fog = new THREE.FogExp2(0xd78d80, 0.0016);
    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 2200);
    this.camera.position.set(97, 4, 30);
    this.camera.lookAt(97, 1, 10);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.glowMats = [];
    this.waterUniforms = null;
    this.skyUniforms = null;
    this.sunDir = new THREE.Vector3(0.86, 0.17, 0.26).normalize();
    this.sun = new THREE.DirectionalLight(0xffc491, 2.4);
    this.focusPoint = new THREE.Vector3();
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
  }

  build() {
    this.buildSky();
    this.buildLights();
    this.buildWater();
    this.buildLand();
    this.buildDistantSkyline();
    this.buildClouds();
    return this;
  }

  buildSky() {
    this.skyUniforms = {
      uTop: { value: new THREE.Color(PALETTE.skyTop) },
      uMid: { value: new THREE.Color(PALETTE.skyMid) },
      uHorizon: { value: new THREE.Color(PALETTE.skyHorizon) },
      uSunColor: { value: new THREE.Color(PALETTE.sun) },
      uSunDir: { value: this.sunDir.clone() },
      uTime: { value: 0 },
    };
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(1500, 48, 24),
      new THREE.ShaderMaterial({
        uniforms: this.skyUniforms,
        vertexShader: SKY_VERTEX,
        fragmentShader: SKY_FRAGMENT,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    );
    sky.name = 'sunset-sky';
    this.scene.add(sky);

    const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: textureFromCanvas((ctx, w, h) => {
        const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        g.addColorStop(0, 'rgba(255,246,204,1)');
        g.addColorStop(0.14, 'rgba(255,211,131,0.98)');
        g.addColorStop(0.42, 'rgba(255,126,87,0.28)');
        g.addColorStop(1, 'rgba(255,100,70,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }, 256, 256),
      color: 0xffffff,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      toneMapped: false,
    }));
    sunSprite.position.copy(this.sunDir).multiplyScalar(1180);
    sunSprite.scale.set(460, 460, 1);
    this.scene.add(sunSprite);
  }

  buildLights() {
    const hemi = new THREE.HemisphereLight(0xffc9a0, 0x26334c, 1.05);
    this.scene.add(hemi);
    const ambient = new THREE.AmbientLight(0x74699d, 0.5);
    this.scene.add(ambient);
    this.sun.position.set(180, 110, 60);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 420;
    this.sun.shadow.camera.left = -95;
    this.sun.shadow.camera.right = 95;
    this.sun.shadow.camera.top = 95;
    this.sun.shadow.camera.bottom = -95;
    this.sun.shadow.bias = -0.0012;
    this.sun.shadow.normalBias = 0.6;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    const rim = new THREE.DirectionalLight(0x5fe6dc, 0.34);
    rim.position.set(-100, 40, -200);
    this.scene.add(rim);
  }

  buildWater() {
    this.waterUniforms = {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(PALETTE.waterDeep) },
      uShallow: { value: new THREE.Color(0x0e8393) },
      uGlint: { value: new THREE.Color(0xffd99a) },
      uSunDir: { value: this.sunDir.clone() },
      uHorizon: { value: new THREE.Color(0xffc39a) },
    };
    const geometry = new THREE.PlaneGeometry(2800, 2800, 120, 120);
    geometry.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(
      geometry,
      new THREE.ShaderMaterial({
        uniforms: this.waterUniforms,
        vertexShader: WATER_VERTEX,
        fragmentShader: WATER_FRAGMENT,
        side: THREE.DoubleSide,
        fog: false,
        toneMapped: false,
      }),
    );
    water.position.set(900, -0.55, 0);
    water.receiveShadow = false;
    water.name = 'bahia-water';
    this.scene.add(water);
  }

  buildLand() {
    const land = new THREE.Mesh(
      new THREE.BoxGeometry(460, 1.6, 430),
      new THREE.MeshStandardMaterial({ color: 0x6f5c51, roughness: 1 }),
    );
    land.position.set(-65, -0.82, 0);
    land.receiveShadow = true;
    this.scene.add(land);
    // A muted landfill edge so the shore reads from the water side.
    const lip = new THREE.Mesh(
      new THREE.BoxGeometry(3, 2.4, 430),
      new THREE.MeshStandardMaterial({ color: 0x8d765b, roughness: 1 }),
    );
    lip.position.set(164, -0.4, 0);
    this.scene.add(lip);
  }

  buildDistantSkyline() {
    const group = new THREE.Group();
    group.name = 'isla-sol-skyline';
    const palette = [0x483b5e, 0x544068, 0x3d4a61, 0x6b4c62, 0x35405a];
    const windowMat = new THREE.MeshBasicMaterial({ color: 0xffc783, toneMapped: false });
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const rng = (n) => Math.abs(Math.sin(n * 127.31) * 43758.5453) % 1;
    for (let i = 0; i < 42; i++) {
      const h = 18 + rng(i + 2) * 95;
      const w = 12 + rng(i + 8) * 24;
      const d = 12 + rng(i + 4) * 22;
      const x = 430 + rng(i + 1) * 330;
      const z = -390 + rng(i + 12) * 760;
      const building = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: palette[i % palette.length], fog: true }));
      building.scale.set(w, h, d);
      building.position.set(x, h / 2 - 0.4, z);
      group.add(building);
      const rows = Math.floor(h / 9);
      for (let row = 0; row < rows; row++) {
        if (rng(i * 5 + row) < 0.35) continue;
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.55, 0.8), windowMat);
        strip.position.set(x - w / 2 - 0.2, 4 + row * 7, z + (rng(row * 3 + i) - 0.5) * d * 0.4);
        strip.rotation.y = -Math.PI / 2;
        group.add(strip);
      }
      if (h > 55) {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.5, 12, 5), new THREE.MeshBasicMaterial({ color: 0x2b2b44 }));
        mast.position.set(x, h + 5, z);
        group.add(mast);
        const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xff5d6c, toneMapped: false }));
        beacon.position.set(x, h + 11.5, z);
        beacon.scale.set(4, 4, 1);
        group.add(beacon);
      }
    }
    this.scene.add(group);
    // low dark islands framing the bay
    const islandMat = new THREE.MeshBasicMaterial({ color: 0x30344b });
    for (let i = 0; i < 4; i++) {
      const island = new THREE.Mesh(new THREE.ConeGeometry(120 + i * 32, 26 + i * 9, 9), islandMat);
      island.position.set(900 + i * 110, 4, -620 + i * 330);
      island.scale.z = 0.4;
      this.scene.add(island);
    }
  }

  buildClouds() {
    const cloudTexture = textureFromCanvas((ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < 10; i++) {
        const x = 40 + Math.sin(i * 3.7) * 120 + w * 0.3;
        const y = h * 0.52 + Math.cos(i * 2.1) * 18;
        const r = 22 + (i % 4) * 16;
        const g = ctx.createRadialGradient(x, y, 2, x, y, r * 2.2);
        g.addColorStop(0, 'rgba(255,206,176,0.45)');
        g.addColorStop(0.6, 'rgba(255,163,143,0.18)');
        g.addColorStop(1, 'rgba(255,140,120,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
    }, 512, 128);
    const rand = (n) => Math.abs(Math.sin(n * 91.7) * 3371.12) % 1;
    for (let i = 0; i < 9; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: cloudTexture,
        transparent: true,
        opacity: 0.5 + rand(i) * 0.28,
        depthWrite: false,
        color: i % 2 ? 0xffc2ab : 0xffd9c2,
        toneMapped: false,
      }));
      sprite.position.set(80 + rand(i + 8) * 900, 110 + rand(i + 2) * 130, -500 + rand(i + 20) * 900);
      sprite.scale.set(210 + rand(i + 4) * 220, 55 + rand(i + 5) * 45, 1);
      this.scene.add(sprite);
    }
  }

  update(dt, time, focus) {
    if (this.waterUniforms) this.waterUniforms.uTime.value = time;
    if (this.skyUniforms) this.skyUniforms.uTime.value = time;
    if (focus) {
      this.focusPoint.set(focus.x, 0, focus.z);
      this.sun.target.position.copy(this.focusPoint);
      this.sun.position.set(focus.x + 150, 105, focus.z + 55);
    }
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(width, height);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

