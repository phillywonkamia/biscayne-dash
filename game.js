// BISCAYNE DASH — the game layer. Blender made every model (build_world.py → assets/world.glb);
// this file loads them and adds the rules: lanes, traffic, cops, coins, nitro, close calls,
// the Miami route, the garage, rolling roadblocks, and the leaderboard. Sound lives in audio.js.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Sound } from './audio.js?v=202611190203';   // version tag: a phone can never mix old + new files

const Q = new URLSearchParams(location.search);
const LANES = [4.65, 0, -4.65];          // screen left → right (camera looks down +Z, so +X is screen-left)
const TILE = 40, TILES = 7, SPAWN_Z = 170;
const $ = id => document.getElementById(id);
const TOUCH = matchMedia('(pointer: coarse)').matches || Q.has('touch');   // phone / tablet
if (TOUCH) document.body.classList.add('touch');
const baseFov = () => (innerWidth < innerHeight ? 84 : 62);   // portrait phones need a wider lens to see all 3 lanes

// ---------------------------------------------------------------- the Miami route: one district per mile, heading north.
// Miami Gardens is the last stop and keeps going forever.
const DLEN = 1609;
const DISTRICTS = [
  { name: 'BISCAYNE', sub: 'BOULEVARD', bg: 0x0a0318, bld: ['Building_0', 'Building_1', 'Building_2'], palms: 1 },
  { name: 'BRICKELL', sub: 'FINANCIAL DISTRICT', bg: 0x040a1e, bld: ['Tower_0', 'Tower_1', 'Tower_0', 'Building_1'], lamps: true },
  { name: 'OCEAN DRIVE', sub: 'SOUTH BEACH', bg: 0x16041e, bld: ['Deco_0', 'Deco_1', 'Deco_2'], palms: 2, double: true },
  { name: 'MACARTHUR', sub: 'CAUSEWAY', bg: 0x02121c, bld: [], lamps: true, rails: true },
  { name: 'OVERTOWN', sub: 'HISTORIC', bg: 0x120806, bld: ['Brick_0', 'Brick_1', 'Store_0'], metro: true },
  { name: 'WYNWOOD', sub: 'ARTS DISTRICT', bg: 0x0e0418, bld: ['Warehouse_0', 'Warehouse_1'], lamps: true },
  { name: 'LITTLE HAITI', sub: 'TI AYITI', bg: 0x08100a, bld: ['House_0', 'House_1', 'House_2', 'House_3', 'Store_0'], palms: 1, double: true },
  { name: 'LIBERTY CITY', sub: 'NORTHWEST', bg: 0x0a0812, bld: ['Brick_1', 'Store_0', 'House_1', 'Building_2'], lamps: true },
  { name: 'MIAMI GARDENS', sub: 'NORTH MIAMI-DADE', bg: 0x06081a, bld: ['House_0', 'House_2', 'House_3', 'Store_0'], palms: 2, double: true, stadium: true },
];
const districtIdx = d => Math.min(Math.floor(Math.max(0, d) / DLEN), DISTRICTS.length - 1);
const districtAt = d => DISTRICTS[districtIdx(d)];

// ---------------------------------------------------------------- renderer + scene
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, TOUCH ? 1.25 : 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const skyCol = new THREE.Color(DISTRICTS[0].bg), skyTarget = new THREE.Color();
scene.background = skyCol.clone();
scene.fog = new THREE.Fog(skyCol.clone(), 40, 175);
const camera = new THREE.PerspectiveCamera(baseFov(), innerWidth / innerHeight, 0.1, 400);

scene.add(new THREE.HemisphereLight(0x6a4cff, 0x1a0010, 1.1));
const moon = new THREE.DirectionalLight(0x9fb4ff, 0.8); moon.position.set(-20, 40, -10); scene.add(moon);
const glow = new THREE.PointLight(0xff1a8c, 14, 9, 1.6); scene.add(glow);   // underglow that rides with the car

// skyline + moon + bay water
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
const water = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshStandardMaterial({ color: 0x07203a, roughness: 0.2, metalness: 0.7 }));
water.rotation.x = -Math.PI / 2; water.position.y = -0.6; scene.add(water);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight).multiplyScalar(TOUCH ? 0.5 : 1), 0.7, 0.35, 0.92);
composer.addPass(bloom);
if (Q.has('nobloom')) bloom.enabled = false;
composer.addPass(new OutputPass());
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});

// ---------------------------------------------------------------- load the Blender world
const kit = {};
const gltf = await new GLTFLoader().loadAsync('assets/world.glb?v=202611190203');
for (const o of gltf.scene.children) kit[o.name] = o;
const allMats = new Set();
gltf.scene.traverse(o => { if (o.isMesh) allMats.add(o.material); });
const matsNamed = n => [...allMats].filter(m => m.name === n);
// Blender's emission strengths are tuned for its own render; dial them for the game's bloom
for (const m of allMats) {
  if (m.name === 'Window' || m.name.startsWith('Neon')) m.emissiveIntensity *= 0.3;
  if (m.name === 'TowerStrip') m.emissiveIntensity *= 0.12;
  if (m.name === 'LampGlow') m.emissiveIntensity *= 0.4;
  if (m.name === 'LaneLine') m.emissiveIntensity *= 0.6;
  if (m.name === 'GECoin') { m.emissiveIntensity *= 0.12; m.transparent = true; m.opacity = 0.55; m.depthWrite = false; }   // dim see-through rings: never outshine taillights
  if (m.name === 'Taillight') m.emissiveIntensity *= 1.7;   // traffic reads first
  if (m.name === 'Teal' || m.name === 'CopWhite') { m.emissive.copy(m.color); m.emissiveIntensity = 0.12; }   // bodies hold a silhouette at night
  if (m.name.startsWith('Mural') || m.name === 'NeonOpen') m.emissiveIntensity *= 0.4;
  if (m.name === 'StadiumGlow') m.emissiveIntensity *= 0.6;
}
const siren = { red: matsNamed('SirenRed'), blue: matsNamed('SirenBlue') };
const WIDTH = {};
for (const k of Object.keys(kit)) { const b = new THREE.Box3().setFromObject(kit[k]); WIDTH[k] = b.max.x - b.min.x; }

const player = kit.Player.clone(); scene.add(player);
const paintMats = [], rimMats = [];
player.traverse(o => {
  if (!o.isMesh) return;
  if (o.material.name === 'CandyPink') {
    o.material = new THREE.MeshPhysicalMaterial({ color: o.material.color.clone(), name: 'CandyPink', metalness: 0.25, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 });
    paintMats.push(o.material); allMats.add(o.material);
  } else if (o.material.name === 'Rim') { o.material = o.material.clone(); rimMats.push(o.material); allMats.add(o.material); }
  else if (o.material.name === 'Taillight') { o.material = o.material.clone(); o.material.emissiveIntensity *= 0.35; allMats.add(o.material); }   // your own tails stay soft so they don't glare
});
const FACTORY_PAINT = paintMats[0].color.getHex();   // whatever color build_world.py gave the car
const head = new THREE.SpotLight(0xfff1d0, 35, 50, 0.45, 0.6); head.position.set(0, 1, 2); head.target.position.set(0, 0, 25);
player.add(head, head.target);

// ---------------------------------------------------------------- road tiles, dressed per district as they loop
const tiles = [];
for (let i = 0; i < TILES; i++) {
  const g = new THREE.Group(); g.position.z = i * TILE - TILE;
  g.add(kit.RoadTile.clone());
  const slots = new THREE.Group(); g.add(slots); g.userData.slots = slots;
  scene.add(g); tiles.push(g);
}
const pick = a => a[Math.floor(Math.random() * a.length)];
function place(slots, key, x, z, side, extra = {}) {
  const o = kit[key].clone(); o.position.set(x, extra.y || 0, z);
  if (side > 0) o.rotation.y = Math.PI;               // detail faces the road on both sides
  if (extra.spin) o.rotation.y = Math.random() * 6;
  slots.add(o);
}
function dress(tile) {
  const d = districtAt(dist + tile.position.z);
  if (tile.userData.dname === d.name) return;
  tile.userData.dname = d.name;
  const s = tile.userData.slots; s.clear();
  for (const side of [1, -1]) {
    if (d.bld.length) {
      for (const z of d.double ? [-10, 10] : [side > 0 ? -10 : 10]) { const k = pick(d.bld); place(s, k, side * (11.5 + WIDTH[k] / 2), z, side); }
    }
    for (let p = 0; p < (d.palms || 0); p++) place(s, 'Palm', side * 8.6, p ? -14 : 4 * side, side, { y: 0.3, spin: true });
    if (d.lamps) place(s, 'Lamp', side * 8.4, side * 10, -side);
    if (d.rails) place(s, 'Rail', side * 10.8, 0, side);
  }
  if (d.metro) place(s, 'Metro', -13.5, 0, 1);                            // Metrorail runs overhead on the right
  if (d.stadium && Math.random() < 0.18) place(s, 'Stadium', 120, 0, 1);  // the stadium glowing off to the left
}


// ---------------------------------------------------------------- garage
const PAINTS = [
  { id: 'factory', name: 'FACTORY', hex: FACTORY_PAINT, price: 0 },
  { id: 'teal', name: 'MIAMI TEAL', hex: 0x00c2b8, price: 150 },
  { id: 'orange', name: 'SUNSET', hex: 0xff5a00, price: 250 },
  { id: 'purple', name: 'ELECTRIC', hex: 0x7b2cff, price: 400 },
  { id: 'white', name: 'PEARL', hex: 0xf2f0ff, price: 600 },
  { id: 'gold', name: 'GOLD FLAKE', hex: 0xd4a017, price: 900, metal: 0.85 },
  { id: 'black', name: 'MIDNIGHT', hex: 0x101014, price: 1200, metal: 0.5 },
];
const GLOWS = [
  { id: 'pink', name: 'PINK', hex: 0xff1a8c, price: 0 }, { id: 'cyan', name: 'CYAN', hex: 0x00e5ff, price: 100 },
  { id: 'green', name: 'GREEN', hex: 0x22ff66, price: 200 }, { id: 'purple', name: 'PURPLE', hex: 0x9b30ff, price: 300 },
  { id: 'gold', name: 'GOLD', hex: 0xffc400, price: 500 },
];
const RIMS = [
  { id: 'chrome', name: 'CHROME', hex: 0xe6e6f0, price: 0 }, { id: 'black', name: 'BLACKOUT', hex: 0x151515, price: 200 },
  { id: 'gold', name: 'GOLD', hex: 0xd4a017, price: 300 }, { id: 'red', name: 'CANDY RED', hex: 0xff2030, price: 400 },
];
const SIRENS = [
  { id: 'hilo', name: 'HI-LO', hex: 0x3060ff, price: 0 }, { id: 'yelp', name: 'YELP', hex: 0xff3030, price: 0 },
  { id: 'wail', name: 'WAIL', hex: 0xffffff, price: 0 }, { id: 'rumbler', name: 'RUMBLER', hex: 0x9b30ff, price: 0 },
  { id: 'off', name: 'OFF', hex: 0x333333, price: 0 },
];
const SHOP = { paint: PAINTS, glow: GLOWS, rim: RIMS, siren: SIRENS };
const Garage = {
  load() {
    const def = { spent: 0, owned: { paint: ['factory'], glow: ['pink'], rim: ['chrome'] }, equip: { paint: 'factory', glow: 'pink', rim: 'chrome' } };
    let g; try { g = Object.assign(def, JSON.parse(localStorage.getItem('bdash-garage')) || {}); } catch { g = def; }
    g.owned.siren = SIRENS.map(x => x.id); g.equip.siren = g.equip.siren || 'hilo';   // sirens are free
    return g;
  },
  save(g) { localStorage.setItem('bdash-garage', JSON.stringify(g)); },
  wallet() { return (Career.load().coins || 0) + (+Q.get('coins') || 0) - this.load().spent; },
};
function applyLook(preview = false) {
  const g = Garage.load(), p = PAINTS.find(x => x.id === g.equip.paint) || PAINTS[0];
  Sound.setSiren(g.equip.siren, preview);
  for (const m of paintMats) { m.color.setHex(p.hex); m.metalness = p.metal ?? 0.25; }
  glow.color.setHex((GLOWS.find(x => x.id === g.equip.glow) || GLOWS[0]).hex);
  for (const m of rimMats) m.color.setHex((RIMS.find(x => x.id === g.equip.rim) || RIMS[0]).hex);
}
function renderGarage(msg = '') {
  const g = Garage.load(), w = Garage.wallet();
  $('wallet').textContent = `${w.toLocaleString()} COINS`;
  $('gmsg').textContent = msg;
  for (const [cat, list] of Object.entries(SHOP)) {
    $('g-' + cat).innerHTML = list.map(it => {
      const own = g.owned[cat].includes(it.id), on = g.equip[cat] === it.id;
      const tag = on ? 'ON' : own ? 'EQUIP' : it.price.toLocaleString();
      return `<button class="sw${on ? ' on' : ''}${!own && it.price > w ? ' poor' : ''}" data-cat="${cat}" data-id="${it.id}">
        <i style="background:#${it.hex.toString(16).padStart(6, '0')}"></i><b>${it.name}</b><span>${tag}</span></button>`;
    }).join('');
  }
}
$('garage').addEventListener('click', e => {
  const b = e.target.closest('.sw'); if (!b) return;
  const g = Garage.load(), cat = b.dataset.cat, it = SHOP[cat].find(x => x.id === b.dataset.id);
  if (!g.owned[cat].includes(it.id)) {
    const w = Garage.wallet();
    if (it.price > w) { renderGarage(`NEED ${(it.price - w).toLocaleString()} MORE COINS`); return; }
    g.spent += it.price; g.owned[cat].push(it.id); Sound.buy();
  }
  g.equip[cat] = it.id; Garage.save(g); applyLook(cat === 'siren'); renderGarage();
});
function openGarage() { Sound.start(); state = 'garage'; $('title').classList.add('hidden'); $('garage').classList.remove('hidden'); renderGarage(); }
function closeGarage() { state = 'title'; $('garage').classList.add('hidden'); $('title').classList.remove('hidden'); showTitleBoard(); }
$('garageBtn').addEventListener('click', openGarage);
$('gback').addEventListener('click', closeGarage);
applyLook();

// ---------------------------------------------------------------- leaderboard + career
// Saved on this device (localStorage). Written behind load/save so an online board can plug in later.
const Board = {
  load: () => { try { return JSON.parse(localStorage.getItem('bdash-board')) || []; } catch { return []; } },
  save: list => localStorage.setItem('bdash-board', JSON.stringify(list.slice(0, 10))),
  qualifies(pts) { const l = this.load(); return pts > 0 && (l.length < 10 || pts > l[l.length - 1].score); },
  add(entry) { const l = this.load(); l.push(entry); l.sort((a, b) => b.score - a.score); this.save(l); return l.indexOf(entry); },
};
const Career = {
  load: () => { try { return JSON.parse(localStorage.getItem('bdash-career')) || {}; } catch { return {}; } },
  record(run) {
    const c = Object.assign({ runs: 0, coins: 0, miles: 0, bestMiles: 0, bestCoins: 0, cops: 0, closeCalls: 0 }, this.load());
    c.runs++; c.coins += run.coins; c.miles += run.miles; c.closeCalls += run.closeCalls;
    c.bestMiles = Math.max(c.bestMiles, run.miles); c.bestCoins = Math.max(c.bestCoins, run.coins);
    if (run.byCop) c.cops++;
    localStorage.setItem('bdash-career', JSON.stringify(c)); return c;
  },
};
// ---------------------------------------------------------------- world scoreboard (Supabase)
// Every phone posts named runs here and reads one shared Top 10. Offline runs wait in an outbox.
// The key below is a PUBLIC key by design: the database only allows reading and adding scores.
const SB = 'https://ctgwavompqcfiyntnusw.supabase.co/rest/v1/scores';
const SB_KEY = 'sb_publishable_aVG0C2xhekk-aNrQQ9M68g_1dKBjASq';
const DEVICE = Q.has('testdevice') ? 'claude-test' : localStorage.getItem('bdash-device') || (() => {
  const id = 'd-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  localStorage.setItem('bdash-device', id); return id;
})();
const World = {
  top: [], ok: false,
  async refresh() {
    try {
      const r = await fetch(`${SB}?select=name,score,device&device=neq.claude-test&order=score.desc&limit=10`, { headers: { apikey: SB_KEY } });
      if (!r.ok) throw new Error(r.status);
      this.top = await r.json(); this.ok = true;
    } catch { this.ok = false; }
    return this.top;
  },
  qualifies(pts) { return this.ok && pts > 0 && (this.top.length < 10 || pts > this.top[this.top.length - 1].score); },
  rank(pts) { return this.top.filter(r => r.score >= pts).length + 1; },
  queue(run) {
    const ob = JSON.parse(localStorage.getItem('bdash-outbox') || '[]');
    ob.push({
      name: String(run.name).toUpperCase().slice(0, 10) || 'DRIVER', score: Math.min(1999999, Math.floor(run.score)),
      coins: Math.min(19999, run.coins | 0), miles: Math.min(499, +run.miles || 0), device: DEVICE,
    });
    localStorage.setItem('bdash-outbox', JSON.stringify(ob));
  },
  async flush() {   // one row per request so a single bad row can't block the rest
    const ob = JSON.parse(localStorage.getItem('bdash-outbox') || '[]'), left = [];
    for (const row of ob) {
      try {
        const r = await fetch(`${SB}?on_conflict=device,score,name`, {
          method: 'POST', body: JSON.stringify(row),
          headers: { apikey: SB_KEY, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
        });
        if (!r.ok && r.status !== 400) left.push(row);   // 400 = rejected by the rules, drop it
      } catch { left.push(row); }
    }
    localStorage.setItem('bdash-outbox', JSON.stringify(left));
  },
};
// first run of this version: send this phone's existing Top 10 up so nobody loses their scores
if (!localStorage.getItem('bdash-synced')) {
  for (const r of JSON.parse(localStorage.getItem('bdash-board') || '[]')) World.queue(r);
  localStorage.setItem('bdash-synced', '1');
}
async function syncWorld() { await World.flush(); await World.refresh(); if (state === 'title') showTitleBoard(); }
addEventListener('online', syncWorld);

const esc = t => String(t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
function renderBoard(el, rows, hi = -1, head = 'TOP 10') {
  if (!rows.length) { el.innerHTML = `<div class="bhead">${head}</div><div class="bempty">No scores yet. Be the first.</div>`; return; }
  el.innerHTML = `<div class="bhead">${head}</div>` + rows.map((r, i) =>
    `<div class="brow${i === hi || (hi === -2 && r.device === DEVICE) ? ' me' : ''}"><span class="bn">${i + 1}</span><span class="bname">${esc(r.name)}</span><span class="bpts">${r.score.toLocaleString()}</span></div>`).join('');
}
function renderCareer() {
  const c = Career.load();
  $('career').innerHTML = c.runs ? `CAREER &nbsp;·&nbsp; ${c.runs} RUNS &nbsp;·&nbsp; ${c.coins.toLocaleString()} COINS &nbsp;·&nbsp; ${c.miles.toFixed(1)} MI &nbsp;·&nbsp; ${(c.closeCalls || 0)} CLOSE CALLS &nbsp;·&nbsp; LONGEST ${c.bestMiles.toFixed(2)} MI` : '';
}
function showTitleBoard() {
  if (World.ok) renderBoard($('boardTitle'), World.top, -2, 'WORLD TOP 10');
  else renderBoard($('boardTitle'), Board.load().slice(0, 5), -1, 'TOP 5 · THIS PHONE');
  const mine = (Board.load()[0] || {}).score;
  $('mybest').textContent = mine ? `YOUR BEST ${mine.toLocaleString()}` : '';
  renderCareer();
}
function showOverBoard() {
  if (World.ok) renderBoard($('boardOver'), World.top, -2, 'WORLD TOP 10');
  else renderBoard($('boardOver'), Board.load(), -1, 'TOP 10 · THIS PHONE (OFFLINE)');
}

let pendingRun = null;   // a run waiting for its name
function saveName() {
  if (!pendingRun) return;
  const name = ($('name').value.trim().toUpperCase() || 'DRIVER').slice(0, 10);
  localStorage.setItem('bdash-name', name);
  pendingRun.name = name;
  if (Board.qualifies(pendingRun.score)) Board.add(pendingRun);
  World.queue(pendingRun); pendingRun = null;
  $('name').blur(); $('entry').classList.add('hidden'); $('again').classList.remove('hidden');
  showOverBoard();
  syncWorld().then(showOverBoard);
}
$('save').addEventListener('click', saveName);
$('name').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') saveName(); });

// ---------------------------------------------------------------- game state
let state = 'title', speed = 0, dist = 0, score = 0, coins = 0, nitro = 0, lane = 1, laneX = 0, t = 0;
let best = (Board.load()[0] || {}).score || 0, shake = 0, camMode = 0, blueprint = false, spawnIn = 0;
let curDistrict = 0, roadblockQueued = false, nextRB = 0;
let combo = 0, lastCloseT = -9, lastCloseSide = 0, closeCalls = 0, lastLaneT = -9;
const traffic = [], pickups = [];
const keys = {};
const canStart = () => (state === 'title' || state === 'over') && !pendingRun && !(state === 'over' && shake > 0.3);
const AUTO = Q.has('auto');          // autopilot (attract mode / testing)
const GOD = Q.has('god');            // testing: no crashes
const START_DIST = +Q.get('dist') || 0;   // testing: start further down the route
let walls = 0, wallFrames = 0;
showTitleBoard();
syncWorld();
for (const tl of tiles) dress(tl);

function reset() {
  Sound.start(); Sound.setPlaying(true);
  best = Math.max(best, (Board.load()[0] || {}).score || 0, (World.top[0] || {}).score || 0);
  for (const o of [...traffic, ...pickups]) scene.remove(o);
  traffic.length = pickups.length = 0;
  speed = 28; dist = START_DIST; score = coins = 0; nitro = 0.3; lane = 1; laneX = 0; spawnIn = 1;
  roadblockQueued = false; nextRB = START_DIST + 1800; combo = 0; closeCalls = 0;
  curDistrict = districtIdx(dist);
  for (const tl of tiles) { tl.userData.dname = null; dress(tl); }
  player.position.set(0, 0, 0); player.rotation.set(0, 0, 0);
  for (const id of ['hud', 'nitro', 'nlabel']) $(id).classList.remove('hidden');
  $('title').classList.add('hidden'); $('over').classList.add('hidden'); $('nitrobtn').classList.add('on');
  state = 'play';
  banner(districtAt(dist).name, districtAt(dist).sub);
}

// FAIR PLAY RULE: within any stretch of road you cover in ~1 s (32 m minimum), at most 2 of the 3 lanes may hold a car,
// so there is always a way through. Spawns, cop swerves and roadblocks all check it.
const ROW_MIN = 32;
const row = () => Math.max(ROW_MIN, speed * 0.55 + 10);
function lanesNear(z, skip) {
  const s = new Set();
  for (const c of traffic) if (c !== skip && Math.abs(c.position.z - z) < row()) {
    s.add(c.userData.lane);
    s.add(Math.round((LANES[0] - c.position.x) / LANES[0]));   // a cop mid-swerve blocks the lane it's leaving too
  }
  return s;
}
function addCar(l, z, cop, extra = {}) {
  const c = (cop ? kit.Traffic_Cop : kit.Traffic_Teal).clone();
  c.position.set(LANES[l], 0, z);
  c.userData = Object.assign({ lane: l, cop, v: 0.45, weave: cop ? 1 + Math.random() * 2 : 0, threat: -9 }, extra);
  scene.add(c); traffic.push(c); return c;
}
function coinTrail(l, z) {
  for (let i = 0; i < 5; i++) { const p = kit.Coin.clone(); p.scale.setScalar(0.62); p.position.set(LANES[l], 0.15, z + i * 5); scene.add(p); pickups.push(p); }
}
function spawn() {
  if (roadblockQueued) return;   // clear the road for the roadblock
  const used = new Set(lanesNear(SPAWN_Z + 7));
  const want = Math.random() < Math.min(0.15 + dist / 6000, 0.6) ? 2 : 1;   // denser the further you get
  const n = Math.min(want, 2 - used.size);   // never fill the third lane
  const taken = new Set(used);
  for (let k = 0; k < n; k++) {
    let l; do { l = Math.floor(Math.random() * 3); } while (taken.has(l)); taken.add(l);
    addCar(l, SPAWN_Z + k * 9, Math.random() < 0.25 + Math.min(dist / 8000, 0.25));
  }
  const free = [0, 1, 2].filter(l => !taken.has(l));
  coinTrail(free[Math.floor(Math.random() * free.length)], SPAWN_Z + 10);
}
// rolling roadblock: two cruisers side by side, one gap, coins in the gap
function tryRoadblock() {
  if (lanesNear(SPAWN_Z).size) return;
  const gap = Math.floor(Math.random() * 3);
  for (const l of [0, 1, 2]) if (l !== gap) addCar(l, SPAWN_Z, true, { rb: true });
  coinTrail(gap, SPAWN_Z - 10);
  roadblockQueued = false;
}

let lastHit = null;
function crash() {
  state = 'over'; shake = 1; touchBoost = false; $('nitrobtn').classList.remove('on');
  Sound.crash(); Sound.setPlaying(false);
  const pts = Math.floor(score), miles = (dist - START_DIST) / 1609, reached = districtAt(dist).name;
  best = Math.max(best, pts);
  $('final').innerHTML = `${pts.toLocaleString()} PTS &nbsp;·&nbsp; ${coins} COINS &nbsp;·&nbsp; ${miles.toFixed(2)} MI<div class="sub">${closeCalls} CLOSE CALLS &nbsp;·&nbsp; MADE IT TO ${reached}</div>`;
  Career.record({ coins, miles, closeCalls, byCop: !!lastHit?.userData.cop });
  $('busted').textContent = lastHit?.userData.cop ? 'BUSTED' : 'WRECKED';
  if (Board.qualifies(pts) || World.qualifies(pts)) {
    pendingRun = { score: pts, coins, miles: +miles.toFixed(2), date: new Date().toISOString().slice(0, 10) };
    const onWorld = World.qualifies(pts), rank = onWorld ? World.rank(pts) : Board.load().filter(r => r.score >= pts).length + 1;
    $('rank').textContent = onWorld ? (rank === 1 ? 'NEW WORLD #1' : `WORLD TOP 10 · #${rank}`) : (rank === 1 ? 'NEW PERSONAL BEST' : `NEW HIGH SCORE · #${rank} ON THIS PHONE`);
    $('name').value = localStorage.getItem('bdash-name') || '';
    $('entry').classList.remove('hidden'); $('again').classList.add('hidden');
  } else {
    $('entry').classList.add('hidden'); $('again').classList.remove('hidden');
  }
  showOverBoard();
  setTimeout(() => {
    $('over').classList.remove('hidden'); if (pendingRun && !TOUCH) $('name').focus();
    const tn = Q.get('tname');   // testing: auto-enter a name
    if (tn && pendingRun) { $('name').value = tn; saveName(); }
  }, 700);
}

// ---------------------------------------------------------------- pop-ups
let popTimer;
function pop(text, cls = '') {
  const el = $('pop'); el.className = ''; void el.offsetWidth; el.className = 'show ' + cls; el.innerHTML = text;
  clearTimeout(popTimer); popTimer = setTimeout(() => { el.className = ''; }, 1100);
}
function banner(name, sub) {
  const el = $('banner'); el.innerHTML = `<small>NOW ENTERING</small>${name}<em>${sub}</em>`;
  el.className = ''; void el.offsetWidth; el.className = 'show';
}

function setBlueprint(on) {
  for (const m of allMats) m.wireframe = on;
  bloom.strength = on ? 0.4 : 0.7;
}

// ---------------------------------------------------------------- input
function steer(dir) { const n = Math.max(0, Math.min(2, lane + dir)); if (n !== lane) { lane = n; lastLaneT = t; } }
addEventListener('keydown', e => {
  if (e.repeat) { keys[e.code] = true; return; }
  keys[e.code] = true;
  if (e.target === $('name')) return;
  if (e.code === 'Space') { e.preventDefault(); if (canStart()) reset(); }
  if (state === 'play') {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') steer(-1);
    if (e.code === 'ArrowRight' || e.code === 'KeyD') steer(1);
  }
  if (e.code === 'KeyG' && state === 'title') openGarage();
  else if ((e.code === 'KeyG' || e.code === 'Escape') && state === 'garage') closeGarage();
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'KeyB') setBlueprint(blueprint = !blueprint);
  if (e.code === 'KeyC') camMode = (camMode + 1) % 3;
});
addEventListener('keyup', e => { keys[e.code] = false; });
function toggleMute() { $('mute').classList.toggle('off', Sound.toggleMute()); }
$('mute').classList.toggle('off', Sound.muted);
$('mute').addEventListener('click', e => { e.stopPropagation(); Sound.start(); toggleMute(); });

// touch: tap left / right half = change lane, hold the NITRO button = boost, tap anywhere = start
let touchBoost = false;
addEventListener('touchstart', e => {
  if (e.target.closest && e.target.closest('#entry, button, #garage')) return;   // real buttons get their click
  e.preventDefault();
  if (canStart()) { reset(); return; }
  for (const tch of e.changedTouches) {
    if (tch.target.closest && tch.target.closest('#nitrobtn')) { touchBoost = true; continue; }
    if (state === 'play') steer(tch.clientX < innerWidth / 2 ? -1 : 1);
  }
}, { passive: false });
const endTouch = e => { for (const tch of e.changedTouches) if (tch.target.closest && tch.target.closest('#nitrobtn')) touchBoost = false; };
addEventListener('touchend', endTouch); addEventListener('touchcancel', endTouch);

if (AUTO) reset();
if (Q.has('garage')) openGarage();

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
const camPos = new THREE.Vector3(0, 3.4, -8.5), look = new THREE.Vector3(), tmp = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0);
function frame(dt, draw = true) {
  if (!(dt > 0)) dt = 1 / 60;
  t += dt;
  let v = 0, boosting = false, sirenLvl = 0;

  if (state === 'play') {
    boosting = (keys.Space || touchBoost) && nitro > 0;
    if (boosting) nitro = Math.max(0, nitro - dt * 0.35);
    speed = Math.min(speed + dt * 0.9, 75);
    v = speed * (boosting ? 1.6 : 1);
    dist += v * dt; score += v * dt * (boosting ? 2 : 1) * 0.5;
    spawnIn -= dt * v / 30;
    if (spawnIn <= 0) { spawn(); spawnIn = Math.max(1.4 - dist / 9000, 0.75); }
    if (roadblockQueued) tryRoadblock();

    // new district?
    const di = districtIdx(dist);
    if (di !== curDistrict) { curDistrict = di; const d = districtAt(dist); banner(d.name, d.sub); Sound.chime(); }

    if (AUTO) {   // pick the lane whose nearest car is furthest away
      const near = [0, 1, 2].map(l => Math.min(999, ...traffic.filter(c => c.userData.lane === l && c.position.z > -3).map(c => c.position.z)));
      const bestL = near.indexOf(Math.max(...near));
      if (near[lane] < 40 && bestL !== lane) steer(Math.sign(bestL - lane));
    }
    const tx = LANES[lane], prev = laneX;
    laneX += (tx - laneX) * Math.min(1, dt * 9);
    player.position.x = laneX;
    player.rotation.y = (laneX - prev) / dt * 0.012;          // lean into the lane change
    camera.fov += ((boosting ? baseFov() + 16 : baseFov()) - camera.fov) * dt * 4; camera.updateProjectionMatrix();

    for (let i = traffic.length - 1; i >= 0; i--) {
      const c = traffic[i], u = c.userData, z0 = c.position.z;
      c.position.z -= v * dt - speed * u.v * dt;               // they drive too, just slower
      if (u.cop && !u.rb && c.position.z < 90 && c.position.z > 20) {   // cops swerve toward you
        u.weave -= dt;
        if (u.weave <= 0) {
          const to = u.lane + Math.sign(lane - u.lane), near = lanesNear(c.position.z, c);
          if (to !== u.lane && !near.has(to) && new Set([...near, to]).size < 3) u.lane = to;   // only if a gap stays open
          u.weave = 1.6 + Math.random();
        }
      }
      c.position.x += (LANES[u.lane] - c.position.x) * Math.min(1, dt * 3);
      if (u.cop && c.position.z > -8 && c.position.z < 110) sirenLvl = Math.max(sirenLvl, 1 - Math.abs(c.position.z) / 110);
      // close call: you were in its lane in the last second, and it just slid past right next to you
      if (u.lane === lane && c.position.z > 0 && c.position.z < 24) u.threat = t;
      if (z0 > 0 && c.position.z <= 0) {
        const dx = Math.abs(c.position.x - laneX);
        if (dx > 2.0 && dx < 6.5 && t - u.threat < 0.7) closeCall(Math.sign(c.position.x - laneX));
      }
      if (!GOD && state === 'play' && Math.abs(c.position.x - laneX) < 2.0 && Math.abs(c.position.z) < 4.6) { lastHit = c; crash(); }
      if (c.position.z < -30) { scene.remove(c); traffic.splice(i, 1); score += 25; }
    }
    if (GOD) {   // wall detector: all 3 lanes covered inside one 16 m slice ahead
      let wall = false;
      for (const a of traffic) if (a.position.z > 0 && a.position.z < 140) {
        const ls = new Set(traffic.filter(b => Math.abs(b.position.z - a.position.z) < 16).map(b => Math.round((4.65 - b.position.x) / 4.65)));
        if (ls.size >= 3) wall = true;
      }
      if (wall && !wallFrames) walls++; wallFrames = wall ? wallFrames + 1 : 0;
    }
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      p.position.z -= v * dt; p.rotation.y += dt * 5;
      if (Math.abs(p.position.x - laneX) < 1.6 && Math.abs(p.position.z) < 2.5) {
        scene.remove(p); pickups.splice(i, 1); coins++; score += 100; nitro = Math.min(1, nitro + 0.12); Sound.coin();
      } else if (p.position.z < -20) { scene.remove(p); pickups.splice(i, 1); }
    }

    // a rolling roadblock every mile or so (always one open lane, coins in the gap)
    if (dist > nextRB && !roadblockQueued) {
      roadblockQueued = true; nextRB = dist + 1100 + Math.random() * 700;
      pop('ROADBLOCK AHEAD', 'warn'); Sound.alarm();
    }
    if (t - lastCloseT > 3 && combo) { combo = 0; }
    $('score').textContent = Math.floor(score).toLocaleString();
    $('best').innerHTML = `BEST ${best.toLocaleString()}<br>${(v * 2.237).toFixed(0)} MPH`;
    $('nitrobar').style.width = (nitro * 100) + '%';
  } else if (state === 'title' || state === 'garage') {
    v = state === 'garage' ? 6 : 18; laneX = 0;
  } else {
    player.rotation.y += dt * 6 * shake; shake = Math.max(0, shake - dt);
  }

  // scroll the world; tiles re-dress for whatever district they wrap into
  for (const tl of tiles) {
    tl.position.z -= v * dt;
    if (tl.position.z < -TILE * 1.5) { tl.position.z += TILE * TILES; dress(tl); }
  }
  water.position.z = camera.position.z + 300;

  // sky + fog drift toward the district color
  const target = blueprint ? 0x001a33 : districtAt(dist).bg;
  skyCol.lerp(skyTarget.setHex(target), Math.min(1, dt * 0.8));
  scene.background.copy(skyCol); scene.fog.color.copy(skyCol);

  // sirens pulse
  const ph = (Math.sin(t * 6) + 1) / 2;   // soft red/blue pulse, not a strobe
  for (const m of siren.red) m.emissiveIntensity = 1 + 3.2 * ph;
  for (const m of siren.blue) m.emissiveIntensity = 1 + 3.2 * (1 - ph);


  // camera
  glow.position.set(laneX, 0.25, 0);
  if (state === 'title') camPos.set(Math.sin(t * 0.3) * 9, 3 + Math.sin(t * 0.2), -9);
  else if (state === 'garage') camPos.set(Math.sin(t * 0.4) * 8, 3.6, Math.cos(t * 0.4) * 8);
  else if (camMode === 0) camPos.set(laneX * 0.7, innerWidth < innerHeight ? 4.6 : 3.4, innerWidth < innerHeight ? -10 : -8.5);
  else if (camMode === 1) camPos.set(laneX, 1.4, -6.5);
  else camPos.set(laneX + 14, 26, -8);
  camera.position.lerp(camPos, Math.min(1, dt * (state === 'garage' ? 3 : 5)));
  if (shake > 0) camera.position.add(new THREE.Vector3((Math.random() - .5) * shake, (Math.random() - .5) * shake, 0));
  if (state === 'garage') look.set(0, -1.4, 0); else look.set(laneX * 0.85, 1.4, 14);
  camera.lookAt(look);

  Sound.update(Math.min(1, Math.max(0, (v - 28) / 92)), boosting, sirenLvl, 0, state === 'play');
  if (draw) composer.render();
}

function closeCall(side) {
  const chain = t - lastCloseT < 3;
  const thread = t - lastCloseT < 0.35 && side !== lastCloseSide;
  combo = chain ? Math.min(combo + 1, 5) : 1;
  const pts = 250 * combo + (thread ? 500 : 0);
  score += pts; closeCalls++; nitro = Math.min(1, nitro + 0.1);
  lastCloseT = t; lastCloseSide = side;
  pop(thread ? `THREADED THE NEEDLE<br><b>+${pts}</b>` : `CLOSE CALL${combo > 1 ? ' x' + combo : ''}<br><b>+${pts}</b>`, thread ? 'gold' : '');
  Sound.close(combo);
}

const WARM = +Q.get('warm') || 0;   // fast-forward N seconds (testing)
for (let i = 0; i < WARM * 60; i++) frame(1 / 60, false);
if (Q.has('cam')) camMode = +Q.get('cam');
if (Q.has('bp')) setBlueprint(blueprint = true);
if (GOD) console.log('WALLS', walls, 'in', WARM, 's, dist', Math.round(dist), 'close', closeCalls);
renderer.setAnimationLoop(() => frame(Math.min(clock.getDelta(), 0.05)));
window.BD_READY = true;
