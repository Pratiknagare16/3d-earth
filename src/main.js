// ─────────────────────────────────────────────────────────────
//  NASA-Grade Interactive 3D Earth Visualization
//  Three.js r0.161 · ES Modules · PBR Pipeline
// ─────────────────────────────────────────────────────────────

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// ── Constants ──────────────────────────────────────────────
const EARTH_RADIUS = 5;
const EARTH_TILT = THREE.MathUtils.degToRad(23.44);
const MOON_DISTANCE = 18;
const MOON_RADIUS = 1.3;
const MOON_ORBITAL_TILT = THREE.MathUtils.degToRad(5.14);

// ── Renderer ───────────────────────────────────────────────
const container = document.getElementById("app");
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.physicallyCorrectLights = true;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

// ── Scene ──────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000005);

// ── Camera ─────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  500
);
camera.position.set(0, 8, 20);

// ── Controls ───────────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.04;
controls.minDistance = 8;
controls.maxDistance = 40;
controls.enablePan = false;
controls.rotateSpeed = 0.5;

// ── Texture Loader ─────────────────────────────────────────
const loader = new THREE.TextureLoader();

function loadTex(path, encoding) {
  const tex = loader.load(path);
  if (encoding === "srgb") tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

// ── Earth Group (tilted) ───────────────────────────────────
const earthGroup = new THREE.Group();
earthGroup.rotation.z = EARTH_TILT;
scene.add(earthGroup);

// ─────────────────────────────────────────────────────────
//  1. EARTH SURFACE (PBR)
// ─────────────────────────────────────────────────────────
function createEarth() {
  const geometry = new THREE.SphereGeometry(EARTH_RADIUS, 128, 128);

  const material = new THREE.MeshPhysicalMaterial({
    map: loadTex("textures/earth_albedo_8k.jpg", "srgb"),
    normalMap: loadTex("textures/earth_normal_8k.jpg"),
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughnessMap: loadTex("textures/earth_specular_8k.jpg"),
    metalness: 0.0,
    roughness: 1.0,
    clearcoat: 0.1,
    clearcoatRoughness: 0.4,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// ─────────────────────────────────────────────────────────
//  2. CLOUD LAYER
// ─────────────────────────────────────────────────────────
function createClouds() {
  const geometry = new THREE.SphereGeometry(EARTH_RADIUS + 0.05, 128, 128);

  const material = new THREE.MeshStandardMaterial({
    map: loadTex("textures/earth_clouds_4k.png", "srgb"),
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    roughness: 1.0,
    metalness: 0.0,
  });

  const mesh = new THREE.Mesh(geometry, material);
  return mesh;
}

// ─────────────────────────────────────────────────────────
//  3. ATMOSPHERE (Fresnel Rayleigh Glow)
// ─────────────────────────────────────────────────────────
function createAtmosphere() {
  const geometry = new THREE.SphereGeometry(EARTH_RADIUS + 0.3, 128, 128);

  const material = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        float fresnel = 1.0 - dot(vNormal, vViewDir);
        fresnel = pow(fresnel, 3.5);
        // Rayleigh blue scattering color
        vec3 atmosphereColor = vec3(0.3, 0.6, 1.0);
        gl_FragColor = vec4(atmosphereColor, fresnel * 0.65);
      }
    `,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  });

  return new THREE.Mesh(geometry, material);
}

// ─────────────────────────────────────────────────────────
//  4. NIGHT LIGHTS (city lights on dark side)
// ─────────────────────────────────────────────────────────
function createNightLights() {
  const geometry = new THREE.SphereGeometry(EARTH_RADIUS + 0.01, 128, 128);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      nightMap: { value: loadTex("textures/earth_night_8k.jpg", "srgb") },
      sunDirection: { value: new THREE.Vector3(1, 0, 1).normalize() },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalW;
      void main() {
        vUv = uv;
        vNormalW = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D nightMap;
      uniform vec3 sunDirection;
      varying vec2 vUv;
      varying vec3 vNormalW;
      void main() {
        float sunFacing = dot(vNormalW, sunDirection);
        // Only show lights on the dark side
        float nightFactor = smoothstep(-0.1, -0.3, sunFacing);
        vec4 nightColor = texture2D(nightMap, vUv);
        gl_FragColor = vec4(nightColor.rgb * nightFactor * 1.5, nightFactor * nightColor.r);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  return new THREE.Mesh(geometry, material);
}

// ─────────────────────────────────────────────────────────
//  5. MOON
// ─────────────────────────────────────────────────────────
function createMoon() {
  const orbitGroup = new THREE.Group();
  orbitGroup.rotation.x = MOON_ORBITAL_TILT;

  const geometry = new THREE.SphereGeometry(MOON_RADIUS, 64, 64);

  // Load moon normal map if available (may 404)
  const moonNormalTex = loader.load(
    "textures/moon_normal_4k.jpg",
    undefined,
    undefined,
    () => { } // silently ignore 404
  );

  const material = new THREE.MeshStandardMaterial({
    map: loadTex("textures/moon_albedo_4k.jpg", "srgb"),
    normalMap: moonNormalTex,
    normalScale: new THREE.Vector2(1.2, 1.2),
    roughness: 0.95,
    metalness: 0.0,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(MOON_DISTANCE, 0, 0);

  orbitGroup.add(mesh);
  return { orbitGroup, mesh };
}

// ─────────────────────────────────────────────────────────
//  6. SATELLITES
// ─────────────────────────────────────────────────────────
function createSatellite(orbitRadius, speed, color, size) {
  const orbitGroup = new THREE.Group();
  // Random orbital tilt for variety
  orbitGroup.rotation.x = THREE.MathUtils.degToRad(
    THREE.MathUtils.randFloat(20, 80)
  );
  orbitGroup.rotation.z = THREE.MathUtils.degToRad(
    THREE.MathUtils.randFloat(-30, 30)
  );

  // Main body
  const bodyGeom = new THREE.BoxGeometry(size, size * 0.6, size * 1.8);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.3,
    metalness: 0.8,
  });
  const body = new THREE.Mesh(bodyGeom, bodyMat);

  // Solar panels
  const panelGeom = new THREE.BoxGeometry(size * 3, size * 0.05, size * 0.8);
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0x1a3a6a,
    roughness: 0.2,
    metalness: 0.6,
  });
  const panelLeft = new THREE.Mesh(panelGeom, panelMat);
  panelLeft.position.x = -size * 1.8;
  const panelRight = new THREE.Mesh(panelGeom, panelMat);
  panelRight.position.x = size * 1.8;

  const satGroup = new THREE.Group();
  satGroup.add(body, panelLeft, panelRight);
  satGroup.position.set(orbitRadius, 0, 0);

  orbitGroup.add(satGroup);
  orbitGroup.userData = { speed, satGroup };

  return orbitGroup;
}

// ─────────────────────────────────────────────────────────
//  7. STARFIELD
// ─────────────────────────────────────────────────────────
function createStarfield() {
  const starCount = 6000;
  const positions = new Float32Array(starCount * 3);
  const sizes = new Float32Array(starCount);
  const colors = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i++) {
    // Uniform sphere distribution
    const r = 200 + Math.random() * 100;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    // Vary size for depth
    sizes[i] = 0.3 + Math.random() * 0.7;

    // Slight warm/cool color variation
    const temp = Math.random();
    if (temp < 0.15) {
      // warm orange-ish
      colors[i * 3] = 1.0;
      colors[i * 3 + 1] = 0.85;
      colors[i * 3 + 2] = 0.7;
    } else if (temp < 0.3) {
      // cool blue
      colors[i * 3] = 0.7;
      colors[i * 3 + 1] = 0.8;
      colors[i * 3 + 2] = 1.0;
    } else {
      // white
      colors[i * 3] = 1.0;
      colors[i * 3 + 1] = 1.0;
      colors[i * 3 + 2] = 1.0;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.5,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.55,
    vertexColors: true,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  return points;
}

// ─────────────────────────────────────────────────────────
//  8. LIGHTING
// ─────────────────────────────────────────────────────────
function createLighting() {
  // Directional sunlight
  const sunLight = new THREE.DirectionalLight(0xffffff, 3);
  sunLight.position.set(20, 5, 20);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 60;
  sunLight.shadow.camera.left = -15;
  sunLight.shadow.camera.right = 15;
  sunLight.shadow.camera.top = 15;
  sunLight.shadow.camera.bottom = -15;
  sunLight.shadow.bias = -0.0005;

  // Very subtle fill light
  const ambientLight = new THREE.AmbientLight(0x3a4a6a, 0.08);

  // Subtle back-rim light for cinematic look
  const rimLight = new THREE.DirectionalLight(0x4466aa, 0.3);
  rimLight.position.set(-15, 5, -15);

  return { sunLight, ambientLight, rimLight };
}

// ═════════════════════════════════════════════════════════
//  ASSEMBLE SCENE
// ═════════════════════════════════════════════════════════

// Earth surface
const earth = createEarth();
earthGroup.add(earth);

// Night lights
const nightLights = createNightLights();
earthGroup.add(nightLights);

// Clouds
const clouds = createClouds();
earthGroup.add(clouds);

// Atmosphere
const atmosphere = createAtmosphere();
earthGroup.add(atmosphere);

// Moon
const { orbitGroup: moonOrbit, mesh: moonMesh } = createMoon();
earthGroup.add(moonOrbit);

// Satellites
const satellites = [];
const sat1 = createSatellite(EARTH_RADIUS + 2.0, 0.5, 0xc0c0c0, 0.12);
const sat2 = createSatellite(EARTH_RADIUS + 3.5, 0.3, 0xaabbcc, 0.1);
const sat3 = createSatellite(EARTH_RADIUS + 1.5, 0.7, 0xdddddd, 0.08);
satellites.push(sat1, sat2, sat3);
satellites.forEach((s) => earthGroup.add(s));

// Starfield
const starfield = createStarfield();
scene.add(starfield);

// Lighting
const { sunLight, ambientLight, rimLight } = createLighting();
scene.add(sunLight, ambientLight, rimLight);

// ═════════════════════════════════════════════════════════
//  ANIMATION LOOP
// ═════════════════════════════════════════════════════════

const clockEl = document.getElementById("utc-clock");
let previousTime = performance.now() / 1000;

function animate() {
  requestAnimationFrame(animate);

  const currentTime = performance.now() / 1000;
  const delta = Math.min(currentTime - previousTime, 0.1); // clamp
  previousTime = currentTime;

  // ── UTC-based Earth rotation ──
  const now = new Date();
  const utcHours =
    now.getUTCHours() +
    now.getUTCMinutes() / 60 +
    now.getUTCSeconds() / 3600 +
    now.getUTCMilliseconds() / 3600000;

  earth.rotation.y = (utcHours / 24) * Math.PI * 2;
  nightLights.rotation.y = earth.rotation.y;

  // Update sun direction for night lights shader
  const sunDir = sunLight.position.clone().normalize();
  nightLights.material.uniforms.sunDirection.value.copy(sunDir);

  // ── Cloud drift (slightly faster than Earth) ──
  clouds.rotation.y = earth.rotation.y + currentTime * 0.003;

  // ── Moon orbit + tidal lock ──
  moonOrbit.rotation.y += delta * 0.08;
  moonMesh.rotation.y += delta * 0.08;

  // ── Satellite orbits ──
  satellites.forEach((sat) => {
    sat.rotation.y += delta * sat.userData.speed;
    // Spin the satellite itself slightly
    if (sat.userData.satGroup) {
      sat.userData.satGroup.rotation.y += delta * 0.3;
    }
  });

  // ── Starfield slow rotation ──
  starfield.rotation.y += delta * 0.001;

  // ── UTC clock display ──
  if (clockEl) {
    clockEl.textContent =
      "UTC " +
      String(now.getUTCHours()).padStart(2, "0") +
      ":" +
      String(now.getUTCMinutes()).padStart(2, "0") +
      ":" +
      String(now.getUTCSeconds()).padStart(2, "0");
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();

// ═════════════════════════════════════════════════════════
//  RESIZE HANDLER
// ═════════════════════════════════════════════════════════

function onWindowResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

window.addEventListener("resize", onWindowResize);
