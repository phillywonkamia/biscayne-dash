// BISCAYNE DASH — the game layer. Blender made every model (build_world.py → assets/world.glb);
// this file loads them and adds the rules: lanes, traffic, cops, coins, nitro, score.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const LANES = [4.65, 0, -4.65];          // screen left → right (camera looks down +Z, so +X is screen-left)
const TILE = 40, TILES = 7, SPAWN_Z = 170;
const $ = id => document.getElementById(id);
const TOUCH = matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('touch');   // phone / tablet
if (TOUCH) document.body.classList.add('touch');
const baseFov = () => (innerWidth < innerHeight ? 84 : 62);   // portrait phones need a wider lens to see all 3 lanes

// ---------------------------------------------------------------- renderer + scene
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, TOUCH ? 1.25 : 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0318);
scene.fog = new THREE.Fog(0x0a0318, 40, 175);
const camera = new THREE.PerspectiveCamera(baseFov(), innerWidth / innerHeight, 0.1, 400);

scene.add(new THREE.HemisphereLight(0x6a4cff, 0x1a0010, 1.1));
const moon = new THREE.DirectionalLight(0x9fb4ff, 0.8); moon.position.set(-20, 40, -10); scene.add(moon);
const glow = new THREE.PointLight(0xff1a8c, 14, 9, 1.6); scene.add(glow);   // candy-pink underglow that rides with the car

// skyline: far silhouettes so the horizon isn't empty
{
  const g = new THREE.BoxGeometry(1, 1, 1), m = new THREE.MeshBasicMaterial({ color: 0x150828 });
  for (let i = 0; i < 40; i++) {
    const b = new THREE.Mesh(g, m), h = 20 + Math.random() * 60;
    b.scale.set(8 + Math.random() * 10, h, 8); b.position.set(-120 + i * 6 + Math.random() * 3, h / 2 - 2, 260);
    scene.add(b);
  }
  const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(14, 48), new THREE.MeshBasicMaterial({ color: 0xffb8e0 }));
  moonDisc.position.set(30, 70, 300); moonDisc.rotation.y = Math.PI; scene.add(moonDisc);
}

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight).multiplyScalar(TOUCH ? 0.5 : 1), 0.7, 0.35, 0.92);
composer.addPass(bloom);
if (new URLSearchParams(location.search).has('nobloom')) bloom.enabled = false;
composer.addPass(new OutputPass());
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});

// ---------------------------------------------------------------- load the Blender world
const kit = {};
const gltf = await new GLTFLoader().loadAsync('assets/world.glb');
for (const name of ['Player', 'Traffic_Teal', 'Traffic_Cop', 'Palm', 'Building_0', 'Building_1', 'Building_2', 'Coin', 'RoadTile']) {
  kit[name] = gltf.scene.getObjectByName(name);
}
const allMats = new Set();
gltf.scene.traverse(o => { if (o.isMesh) allMats.add(o.material); });
// Blender's emission strengths are tuned for its own render; dial them for the game's bloom
for (const m of allMats) {
  if (m.name === 'Window') m.emissiveIntensity *= 0.3;
  if (m.name.startsWith('Neon')) m.emissiveIntensity *= 0.3;
  if (m.name === 'GECoin') m.emissiveIntensity *= 0.45;
  if (m.name === 'LaneLine') m.emissiveIntensity *= 0.6;
}
const siren = { red: [], blue: [] };
for (const m of allMats) {
  if (m.name === 'SirenRed') siren.red.push(m);
  if (m.name === 'SirenBlue') siren.blue.push(m);
}

const player = kit.Player.clone(); scene.add(player);
player.traverse(o => { if (o.isMesh && o.material.name === 'CandyPink') {
  o.material = new THREE.MeshPhysicalMaterial({ color: o.material.color.clone(), name: 'CandyPink', metalness: 0.25, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 });
  allMats.add(o.material);
} });
const head = new THREE.SpotLight(0xfff1d0, 35, 50, 0.45, 0.6); head.position.set(0, 1, 2); head.target.position.set(0, 0, 25);
player.add(head, head.target);

// road tiles + scenery that loop forever
const road = [], scenery = [];
for (let i = 0; i < TILES; i++) {
  const t = kit.RoadTile.clone(); t.position.z = i * TILE - TILE; scene.add(t); road.push(t);
  for (const side of [1, -1]) {
    const b = kit['Building_' + ((i + (side > 0 ? 0 : 1)) % 3)].clone();
    const box = new THREE.Box3().setFromObject(b), w = box.max.x - box.min.x;
    b.position.set(side * (11.5 + w / 2), 0, i * TILE - TILE + (side > 0 ? 0 : 20));
    if (side > 0) b.rotation.y = Math.PI;               // windows + neon face the road
    scene.add(b); scenery.push(b);
    const p = kit.Palm.clone(); p.position.set(side * 8.6, 0.3, i * TILE - TILE + 10); p.rotation.y = Math.random() * 6;
    scene.add(p); scenery.push(p);
  }
}

// ---------------------------------------------------------------- game state
let state = 'title', speed = 0, dist = 0, score = 0, coins = 0, nitro = 0, lane = 1, laneX = 0, t = 0;
let best = +localStorage.getItem('bdash-best') || 0, shake = 0, camMode = 0, blueprint = false, spawnIn = 0;
const traffic = [], pickups = [];
const keys = {};
const AUTO = new URLSearchParams(location.search).has('auto');   // autopilot (attract mode / testing)

function reset() {
  for (const o of [...traffic, ...pickups]) scene.remove(o);
  traffic.length = pickups.length = 0;
  speed = 28; dist = score = coins = 0; nitro = 0.3; lane = 1; laneX = 0; spawnIn = 1;
  player.position.set(0, 0, 0); player.rotation.set(0, 0, 0);
  $('hud').classList.remove('hidden'); $('nitro').classList.remove('hidden'); $('nlabel').classList.remove('hidden');
  $('title').classList.add('hidden'); $('over').classList.add('hidden'); $('nitrobtn').classList.add('on');
  state = 'play';
}

function spawn() {
  const used = new Set();
  const n = Math.random() < Math.min(0.15 + dist / 6000, 0.6) ? 2 : 1;   // denser the further you get
  for (let k = 0; k < n; k++) {
    let l; do { l = Math.floor(Math.random() * 3); } while (used.has(l)); used.add(l);
    const cop = Math.random() < 0.25 + Math.min(dist / 8000, 0.25);
    const c = (cop ? kit.Traffic_Cop : kit.Traffic_Teal).clone();
    c.position.set(LANES[l], 0, SPAWN_Z + k * 14);
    c.userData = { lane: l, cop, v: cop ? 0.55 : 0.4 + Math.random() * 0.2, weave: cop ? 1 + Math.random() * 2 : 0 };
    scene.add(c); traffic.push(c);
  }
  // coin trail in a free lane
  const free = [0, 1, 2].filter(l => !used.has(l));
  const cl = free[Math.floor(Math.random() * free.length)];
  for (let i = 0; i < 5; i++) {
    const p = kit.Coin.clone(); p.position.set(LANES[cl], 0, SPAWN_Z + 10 + i * 5); scene.add(p); pickups.push(p);
  }
}

function crash() {
  state = 'over'; shake = 1; touchBoost = false; $('nitrobtn').classList.remove('on');
  best = Math.max(best, Math.floor(score)); localStorage.setItem('bdash-best', best);
  $('final').innerHTML = `${Math.floor(score).toLocaleString()} PTS &nbsp;·&nbsp; ${coins} COINS &nbsp;·&nbsp; ${(dist / 1609).toFixed(2)} MI`;
  setTimeout(() => $('over').classList.remove('hidden'), 700);
}

function setBlueprint(on) {
  for (const m of allMats) m.wireframe = on;
  bloom.strength = on ? 0.4 : 0.7;
  scene.background.set(on ? 0x001a33 : 0x0a0318); scene.fog.color.set(on ? 0x001a33 : 0x0a0318);
}

// ---------------------------------------------------------------- input
addEventListener('keydown', e => {
  if (e.repeat) { keys[e.code] = true; return; }
  keys[e.code] = true;
  if (e.code === 'Space') { e.preventDefault(); if (state !== 'play' && !(state === 'over' && shake > 0.3)) reset(); }
  if (state === 'play') {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') lane = Math.max(0, lane - 1);
    if (e.code === 'ArrowRight' || e.code === 'KeyD') lane = Math.min(2, lane + 1);
  }
  if (e.code === 'KeyB') setBlueprint(blueprint = !blueprint);
  if (e.code === 'KeyC') camMode = (camMode + 1) % 3;
});
addEventListener('keyup', e => { keys[e.code] = false; });

// touch: tap left / right half = change lane, hold the NITRO button = boost, tap anywhere = start
let touchBoost = false;
const canStart = () => state !== 'play' && !(state === 'over' && shake > 0.3);
addEventListener('touchstart', e => {
  e.preventDefault();
  if (canStart()) { reset(); return; }
  for (const tch of e.changedTouches) {
    if (tch.target.closest && tch.target.closest('#nitrobtn')) { touchBoost = true; continue; }
    if (state === 'play') lane = tch.clientX < innerWidth / 2 ? Math.max(0, lane - 1) : Math.min(2, lane + 1);
  }
}, { passive: false });
const endTouch = e => { for (const tch of e.changedTouches) if (tch.target.closest && tch.target.closest('#nitrobtn')) touchBoost = false; };
addEventListener('touchend', endTouch); addEventListener('touchcancel', endTouch);

if (AUTO) reset();

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
const camPos = new THREE.Vector3(0, 3.4, -8.5), look = new THREE.Vector3();
function frame(dt, draw = true) {
  if (!(dt > 0)) dt = 1 / 60;
  t += dt;
  let v = 0;

  if (state === 'play') {
    const boosting = (keys.Space || touchBoost) && nitro > 0;
    if (boosting) nitro = Math.max(0, nitro - dt * 0.35);
    speed = Math.min(speed + dt * 0.9, 75);
    v = speed * (boosting ? 1.6 : 1);
    dist += v * dt; score += v * dt * (boosting ? 2 : 1) * 0.5;
    spawnIn -= dt * v / 30;
    if (spawnIn <= 0) { spawn(); spawnIn = Math.max(1.4 - dist / 9000, 0.75); }

    if (AUTO) {   // pick the lane whose nearest car is furthest away
      const near = [0, 1, 2].map(l => Math.min(999, ...traffic.filter(c => c.userData.lane === l && c.position.z > -3).map(c => c.position.z)));
      const bestL = near.indexOf(Math.max(...near));
      if (near[lane] < 40 && bestL !== lane) lane += Math.sign(bestL - lane);
    }
    const tx = LANES[lane], prev = laneX;
    laneX += (tx - laneX) * Math.min(1, dt * 9);
    player.position.x = laneX;
    player.rotation.y = dt > 0 ? (laneX - prev) / dt * 0.012 : 0;          // lean into the lane change
    camera.fov += ((boosting ? baseFov() + 16 : baseFov()) - camera.fov) * dt * 4; camera.updateProjectionMatrix();

    for (let i = traffic.length - 1; i >= 0; i--) {
      const c = traffic[i], u = c.userData;
      c.position.z -= v * dt - speed * u.v * dt;               // they drive too, just slower
      if (u.cop && c.position.z < 90 && c.position.z > 20) {   // cops swerve toward you
        u.weave -= dt;
        if (u.weave <= 0) { u.lane += Math.sign(lane - u.lane); u.weave = 1.6 + Math.random(); }
      }
      c.position.x += (LANES[u.lane] - c.position.x) * Math.min(1, dt * 3);
      if (Math.abs(c.position.x - laneX) < 2.0 && Math.abs(c.position.z) < 4.6) crash();
      if (c.position.z < -30) { scene.remove(c); traffic.splice(i, 1); score += 25; }
    }
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      p.position.z -= v * dt; p.rotation.y += dt * 5;
      if (Math.abs(p.position.x - laneX) < 1.6 && Math.abs(p.position.z) < 2.5) {
        scene.remove(p); pickups.splice(i, 1); coins++; score += 100; nitro = Math.min(1, nitro + 0.12);
      } else if (p.position.z < -20) { scene.remove(p); pickups.splice(i, 1); }
    }
    $('score').textContent = Math.floor(score).toLocaleString();
    $('best').innerHTML = `BEST ${best.toLocaleString()}<br>${(v * 2.237).toFixed(0)} MPH`;
    $('nitrobar').style.width = (nitro * 100) + '%';
  } else if (state === 'title') {
    v = 18; laneX = 0;
  } else {
    player.rotation.y += dt * 6 * shake; shake = Math.max(0, shake - dt);
  }

  // scroll the world
  for (const r of road) { r.position.z -= v * dt; if (r.position.z < -TILE * 1.5) r.position.z += TILE * TILES; }
  for (const s of scenery) { s.position.z -= v * dt; if (s.position.z < -TILE * 1.5) s.position.z += TILE * TILES; }

  // sirens flash
  const on = Math.sin(t * 18) > 0;
  for (const m of siren.red) m.emissiveIntensity = on ? 14 : 0.5;
  for (const m of siren.blue) m.emissiveIntensity = on ? 0.5 : 14;

  // camera
  glow.position.set(laneX, 0.25, 0);
  if (state === 'title') camPos.set(Math.sin(t * 0.3) * 9, 3 + Math.sin(t * 0.2), -9);
  else if (camMode === 0) camPos.set(laneX * 0.7, innerWidth < innerHeight ? 4.6 : 3.4, innerWidth < innerHeight ? -10 : -8.5);
  else if (camMode === 1) camPos.set(laneX, 1.4, -6.5);
  else camPos.set(laneX + 14, 26, -8);
  camera.position.lerp(camPos, Math.min(1, dt * 5));
  if (shake > 0) camera.position.add(new THREE.Vector3((Math.random() - .5) * shake, (Math.random() - .5) * shake, 0));
  look.set(laneX * 0.85, 1.4, 14); camera.lookAt(look);

  if (draw) composer.render();
}
const WARM = +new URLSearchParams(location.search).get('warm') || 0;   // fast-forward N seconds (testing)
for (let i = 0; i < WARM * 60; i++) frame(1 / 60, false);
if (new URLSearchParams(location.search).has('cam')) camMode = +new URLSearchParams(location.search).get('cam');
if (new URLSearchParams(location.search).has('bp')) setBlueprint(blueprint = true);
renderer.setAnimationLoop(() => frame(Math.min(clock.getDelta(), 0.05)));
