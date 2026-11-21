// Rendu 3D de la cité avec Three.js.
// Terrain en texture, eau transparente, forêts et rochers instanciés, bâtiments décrits par parts.js
// et dessinés en « instancing » (une géométrie par type de pièce), passants et charrettes animés.

import * as THREE from 'three';
import { MAP_W, MAP_H, T, center, inMap, noise01 } from '../engine/sim.js';
import { K, DEFS, GOODS, isProducer } from '../engine/defs.js';
import { buildingPieces, mix } from './parts.js';

// ---------- géométries unitaires (bas à y = 0, centrées en x et z) ----------
function makeGeometries() {
  const gable = (() => {
    const s = new THREE.Shape();
    s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
    g.translate(0, 0, -0.5); g.rotateY(Math.PI / 2);
    return g;
  })();
  return {
    box: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
    gable,
    cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 14).translate(0, 0.5, 0),
    cone: new THREE.ConeGeometry(0.5, 1, 12).translate(0, 0.5, 0),
    sphere: new THREE.SphereGeometry(0.5, 12, 8).translate(0, 0.5, 0),
    dome: new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 2, 1),
    pyr: new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0),
    half: new THREE.CylinderGeometry(0.5, 0.5, 1, 18, 1, false, 0, Math.PI).translate(0, 0.5, 0),
  };
}

// Réserve d'instances d'une géométrie, agrandie à la demande.
class Pool {
  constructor(scene, geom, material, cap = 512, shadows = true) {
    this.scene = scene; this.geom = geom; this.material = material; this.shadows = shadows;
    this.count = 0;
    this.alloc(cap);
  }
  alloc(cap) {
    if (this.mesh) { this.scene.remove(this.mesh); this.mesh.dispose(); }
    this.cap = cap;
    this.mesh = new THREE.InstancedMesh(this.geom, this.material, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    this.mesh.castShadow = this.shadows; this.mesh.receiveShadow = this.shadows;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.scene.add(this.mesh);
  }
  begin() { this.count = 0; this.items = []; }
  push(m, c) { this.items.push(m, c); this.count++; }
  end() {
    if (this.count > this.cap) { let c = this.cap; while (c < this.count) c *= 2; this.alloc(c); }
    const col = new THREE.Color();
    for (let i = 0; i < this.count; i++) {
      this.mesh.setMatrixAt(i, this.items[i * 2]);
      this.mesh.setColorAt(i, col.setHex(this.items[i * 2 + 1]));
    }
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.items = null;
  }
}

// Couleurs du terrain.
const TERRAIN_RGB = { [T.Grass]: [118, 150, 72], [T.Water]: [40, 82, 110], [T.Fertile]: [138, 140, 66], [T.Forest]: [86, 120, 60], [T.Rock]: [140, 132, 118] };

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpP = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

// Matrice d'une pièce posée à (bx, bz) en coordonnées monde.
function pieceMatrix(pc, bx, bz, lift = 0) {
  tmpQ.setFromAxisAngle(UP, pc.r || 0);
  tmpP.set(bx + pc.x, pc.y + lift, bz + pc.z);
  tmpS.set(pc.w, pc.h, pc.d);
  return new THREE.Matrix4().compose(tmpP, tmpQ, tmpS);
}

export class CityRenderer {
  constructor(canvas, { shadows = true, preserve = false } = {}) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: preserve, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.shadows = shadows;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xb7cfe0);
    this.scene.fog = new THREE.Fog(0xb7cfe0, 60, 160);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
    this.cam = { x: 20, z: 45, dist: 26, yaw: 0.6, pitch: 0.92 };

    this.scene.add(new THREE.HemisphereLight(0xe4eef8, 0x5a4a32, 1.1));
    this.sun = new THREE.DirectionalLight(0xfff0d8, 2.0);
    this.sun.castShadow = shadows;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);

    this.geoms = makeGeometries();
    this.mat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 });
    this.pools = {};
    for (const [k, g] of Object.entries(this.geoms)) this.pools[k] = new Pool(this.scene, g, this.mat, 1024, shadows);
    // décor (arbres, rochers) : réserves séparées, reconstruites quand le terrain change
    this.deco = {
      trunk: new Pool(this.scene, this.geoms.cyl, this.mat, 2048, shadows),
      leaves: new Pool(this.scene, this.geoms.cone, this.mat, 2048, shadows),
      rocks: new Pool(this.scene, this.geoms.sphere, this.mat, 1024, shadows),
    };
    this.walkerBody = new Pool(this.scene, this.geoms.box, this.mat, 256, false);
    this.walkerHead = new Pool(this.scene, this.geoms.sphere, this.mat, 256, false);

    // sol et eau
    this.groundCanvas = document.createElement('canvas');
    this.groundCanvas.width = MAP_W * 8; this.groundCanvas.height = MAP_H * 8;
    this.groundTex = new THREE.CanvasTexture(this.groundCanvas);
    this.groundTex.colorSpace = THREE.SRGBColorSpace;
    this.groundTex.anisotropy = 4;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W, MAP_H), new THREE.MeshStandardMaterial({ map: this.groundTex, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(MAP_W / 2, 0, MAP_H / 2); ground.receiveShadow = true;
    this.scene.add(ground);
    this.maskCanvas = document.createElement('canvas');
    this.maskCanvas.width = MAP_W * 4; this.maskCanvas.height = MAP_H * 4;
    this.maskTex = new THREE.CanvasTexture(this.maskCanvas);
    this.waterMat = new THREE.MeshStandardMaterial({ color: 0x3f86b8, roughness: 0.15, metalness: 0.15, transparent: true, opacity: 0.82, alphaMap: this.maskTex, depthWrite: false });
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W, MAP_H), this.waterMat);
    this.water.rotation.x = -Math.PI / 2; this.water.position.set(MAP_W / 2, 0.06, MAP_H / 2);
    this.scene.add(this.water);
    // bordure de la carte
    const skirt = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W * 4, MAP_H * 4), new THREE.MeshStandardMaterial({ color: 0x7c8f5c, roughness: 1 }));
    skirt.rotation.x = -Math.PI / 2; skirt.position.set(MAP_W / 2, -0.05, MAP_H / 2);
    this.scene.add(skirt);

    // calque coloré par case (disésrelie)
    this.ovCanvas = document.createElement('canvas');
    this.ovCanvas.width = MAP_W; this.ovCanvas.height = MAP_H;
    this.ovTex = new THREE.CanvasTexture(this.ovCanvas);
    this.ovTex.magFilter = THREE.NearestFilter;
    this.ovPlane = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W, MAP_H), new THREE.MeshBasicMaterial({ map: this.ovTex, transparent: true, opacity: 0.6, depthWrite: false }));
    this.ovPlane.rotation.x = -Math.PI / 2; this.ovPlane.position.set(MAP_W / 2, 0.09, MAP_H / 2); this.ovPlane.visible = false;
    this.scene.add(this.ovPlane);

    // sélection, fantôme, rayon
    this.selBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), new THREE.LineBasicMaterial({ color: 0xffd24a }));
    this.selBox.visible = false; this.scene.add(this.selBox);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.visible = false; this.scene.add(this.ring);
    this.ghost = new THREE.Group(); this.scene.add(this.ghost);
    this.ghostKey = '';
    this.ghostMat = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.6, roughness: 0.8 });
    this.footOk = new THREE.MeshBasicMaterial({ color: 0x50dc64, transparent: true, opacity: 0.35, depthWrite: false });
    this.footBad = new THREE.MeshBasicMaterial({ color: 0xe63c32, transparent: true, opacity: 0.45, depthWrite: false });
    this.footGeom = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

    this.game = null; this.builtVersion = -1; this.terrVersion = -1; this.overlayKey = '';
    this.walkers = []; this.time = 0;
    this.overlay = null; // fonction (b) => couleur | null
    this.popIn = null; // animation d'apparition (vidéo)
  }

  setGame(game) { this.game = game; this.builtVersion = -1; this.terrVersion = -1; this.walkers = []; }

  resize(w, h) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  // ---------- caméra ----------
  clampCam() {
    const c = this.cam;
    c.x = Math.max(-2, Math.min(MAP_W + 2, c.x));
    c.z = Math.max(-2, Math.min(MAP_H + 2, c.z));
    c.dist = Math.max(6, Math.min(130, c.dist));
    c.pitch = Math.max(0.35, Math.min(1.45, c.pitch));
  }
  pan(dx, dz) {
    const c = this.cam; const s = Math.sin(c.yaw); const co = Math.cos(c.yaw);
    c.x += dx * co + dz * s; c.z += -dx * s + dz * co;
    this.clampCam();
  }
  zoom(f) { this.cam.dist *= f; this.clampCam(); }
  rotate(da, dp = 0) { this.cam.yaw += da; this.cam.pitch += dp; this.clampCam(); }
  centerOn(x, z) { this.cam.x = x; this.cam.z = z; this.clampCam(); }
  updateCamera() {
    const c = this.cam;
    const cp = Math.cos(c.pitch);
    this.camera.position.set(c.x + Math.sin(c.yaw) * cp * c.dist, Math.sin(c.pitch) * c.dist, c.z + Math.cos(c.yaw) * cp * c.dist);
    this.camera.lookAt(c.x, 0, c.z);
    this.sun.position.set(c.x - 30, 55, c.z + 18);
    this.sun.target.position.set(c.x, 0, c.z);
    const sh = Math.max(20, c.dist * 1.3);
    const cam = this.sun.shadow.camera;
    cam.left = -sh; cam.right = sh; cam.top = sh; cam.bottom = -sh; cam.near = 1; cam.far = 160;
    cam.updateProjectionMatrix();
    this.scene.fog.near = c.dist * 1.6; this.scene.fog.far = c.dist * 5 + 40;
  }

  // Case pointée par la souris (coordonnées écran relatives au canvas) : { x, z } flottants, ou null.
  pick(px, py) {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2((px / rect.width) * 2 - 1, -(py / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const o = ray.ray.origin; const d = ray.ray.direction;
    if (Math.abs(d.y) < 1e-6) return null;
    const t = -o.y / d.y;
    if (t < 0) return null;
    return { x: o.x + d.x * t, z: o.z + d.z * t };
  }

  // Empreinte de la vue sur le sol (pour la minicarte).
  viewCorners() {
    const rect = this.canvas.getBoundingClientRect();
    return [[0, 0], [rect.width, 0], [rect.width, rect.height], [0, rect.height]].map(([x, y]) => this.pick(x, y) || { x: this.cam.x, z: this.cam.z });
  }

  // ---------- terrain ----------
  buildTerrain() {
    const g = this.game;
    const ctx = this.groundCanvas.getContext('2d');
    const px = 8;
    for (let x = 0; x < MAP_W; x++) {
      for (let y = 0; y < MAP_H; y++) {
        const t = g.tile(x, y);
        const n = noise01(x, y); const n2 = noise01(x * 3 + 7, y * 5 + 1);
        const [r, gg, b] = TERRAIN_RGB[t];
        const f = 0.9 + n * 0.16;
        const lift = t === T.Grass ? n2 * 18 : 0;
        ctx.fillStyle = `rgb(${Math.min(255, r * f + lift)},${Math.min(255, gg * f + lift * 0.6)},${Math.min(255, b * f)})`;
        ctx.fillRect(x * px, y * px, px, px);
        if (t === T.Fertile) {
          ctx.fillStyle = 'rgba(96,84,40,0.35)';
          for (let i = 1; i < 4; i++) ctx.fillRect(x * px, y * px + i * 2, px, 1);
        }
        if (t !== T.Water) {
          ctx.fillStyle = 'rgb(210,192,140)';
          const s = 2;
          if (inMap(x, y - 1) && g.tile(x, y - 1) === T.Water) ctx.fillRect(x * px, y * px, px, s);
          if (inMap(x, y + 1) && g.tile(x, y + 1) === T.Water) ctx.fillRect(x * px, y * px + px - s, px, s);
          if (inMap(x - 1, y) && g.tile(x - 1, y) === T.Water) ctx.fillRect(x * px, y * px, s, px);
          if (inMap(x + 1, y) && g.tile(x + 1, y) === T.Water) ctx.fillRect(x * px + px - s, y * px, s, px);
        }
      }
    }
    this.groundTex.needsUpdate = true;
    const mctx = this.maskCanvas.getContext('2d');
    mctx.fillStyle = '#000'; mctx.fillRect(0, 0, MAP_W * 4, MAP_H * 4);
    mctx.fillStyle = '#fff';
    for (let x = 0; x < MAP_W; x++) for (let y = 0; y < MAP_H; y++) if (g.tile(x, y) === T.Water) mctx.fillRect(x * 4, y * 4, 4, 4);
    this.maskTex.needsUpdate = true;
    // arbres et rochers
    const { trunk, leaves, rocks } = this.deco;
    trunk.begin(); leaves.begin(); rocks.begin();
    for (let x = 0; x < MAP_W; x++) {
      for (let y = 0; y < MAP_H; y++) {
        const t = g.tile(x, y);
        if (g.bidAt(x, y)) continue;
        if (t === T.Forest) {
          for (let i = 0; i < 2; i++) {
            const ox = x + 0.25 + noise01(x * 13 + i, y * 17) * 0.5; const oz = y + 0.25 + noise01(x * 7, y * 11 + i) * 0.5;
            const s = 0.7 + noise01(x + i * 31, y) * 0.6;
            trunk.push(pieceMatrix({ x: 0, z: 0, y: 0, w: 0.08 * s, h: 0.3 * s, d: 0.08 * s }, ox, oz), 0x563c26);
            leaves.push(pieceMatrix({ x: 0, z: 0, y: 0.2 * s, w: 0.55 * s, h: 0.95 * s, d: 0.55 * s }, ox, oz), mix(0x2f5c30, 0x4b7d3a, noise01(x, y + i)));
          }
        } else if (t === T.Rock) {
          for (let i = 0; i < 2; i++) {
            const s = 0.35 + noise01(x * 3 + i, y * 5) * 0.4;
            rocks.push(pieceMatrix({ x: 0, z: 0, y: -0.05, w: s, h: s * 0.6, d: s * 0.9, r: i }, x + 0.3 + i * 0.4, y + 0.35 + noise01(x, y * 3 + i) * 0.3), mix(0x8a8478, 0xb4ae9e, noise01(x + i, y)));
          }
        }
      }
    }
    trunk.end(); leaves.end(); rocks.end();
  }

  // ---------- bâtiments ----------
  buildCity() {
    const g = this.game;
    for (const p of Object.values(this.pools)) p.begin();
    const ov = this.overlay;
    const pop = this.popIn;
    for (const b of g.Buildings.values()) {
      let scale = 1;
      if (pop) { scale = pop(b); if (scale <= 0) continue; }
      const pieces = buildingPieces(b, g);
      let tint = null;
      if (ov && b.Kind !== K.Road) tint = ov(b);
      const df = DEFS[b.Kind];
      for (const pc of pieces) {
        let c = pc.c;
        if (tint !== null && tint !== undefined) c = tint;
        else if (ov && b.Kind !== K.Road) c = mix(c, 0x777777, 0.65);
        if (scale !== 1) {
          const sp = { ...pc, x: df.W / 2 + (pc.x - df.W / 2) * scale, z: df.H / 2 + (pc.z - df.H / 2) * scale, y: pc.y * scale, w: pc.w * scale, h: pc.h * scale, d: pc.d * scale };
          this.pools[pc.g].push(pieceMatrix(sp, b.X, b.Y), c);
        } else this.pools[pc.g].push(pieceMatrix(pc, b.X, b.Y), c);
      }
      // indicateurs : pas de route, incendie
      if (b.Kind !== K.Road && b.Kind !== K.Rubble && df.workers > 0 && !b.HasRoad && !pop) {
        this.pools.sphere.push(pieceMatrix({ x: df.W / 2, z: df.H / 2, y: 1.6, w: 0.3, h: 0.3, d: 0.3 }, b.X, b.Y), 0xd22828);
      }
      if (b.Fire > 70 && b.Kind !== K.Road && b.Kind !== K.Rubble) {
        for (let i = 0; i < 3; i++) this.pools.cone.push(pieceMatrix({ x: df.W * (0.3 + i * 0.2), z: df.H / 2, y: 0.4, w: 0.25, h: 0.5, d: 0.25 }, b.X, b.Y), 0xff8a1e);
      }
    }
    for (const p of Object.values(this.pools)) p.end();
  }

  setOverlay(fn, key) { this.overlay = fn; if (key !== this.overlayKey) { this.overlayKey = key; this.builtVersion = -1; } }
  forceRebuild() { this.builtVersion = -1; }

  // calque de disésrelie
  showDesirability(on) {
    this.ovPlane.visible = on;
    if (!on) return;
    const g = this.game;
    const ctx = this.ovCanvas.getContext('2d');
    const img = ctx.createImageData(MAP_W, MAP_H);
    for (let x = 0; x < MAP_W; x++) {
      for (let y = 0; y < MAP_H; y++) {
        const v = Math.max(-1, Math.min(1, g.desirAt(x + 0.5, y + 0.5, -1) / 8));
        const i = (y * MAP_W + x) * 4;
        if (v >= 0) { img.data[i] = 60; img.data[i + 1] = 200; img.data[i + 2] = 90; } else { img.data[i] = 220; img.data[i + 1] = 60; img.data[i + 2] = 50; }
        img.data[i + 3] = Math.round(Math.abs(v) * 220 + 20);
      }
    }
    ctx.putImageData(img, 0, 0);
    this.ovTex.needsUpdate = true;
  }

  // ---------- sélection et fantôme ----------
  setSelection(b) {
    if (!b) { this.selBox.visible = false; this.ring.visible = false; return; }
    const df = DEFS[b.Kind];
    this.selBox.visible = true;
    this.selBox.position.set(b.X + df.W / 2, 0, b.Y + df.H / 2);
    this.selBox.scale.set(df.W + 0.08, 1.2, df.H + 0.08);
    let r = df.radius ? df.radius * (0.5 + 0.5 * b.Eff) : 0;
    if (b.Kind === K.Reservoir) r = 12;
    this.ring.visible = r > 0;
    if (r > 0) { const [cx, cz] = center(b); this.ring.position.set(cx, 0.12, cz); this.ring.scale.set(r, r, 1); }
  }

  // spots : [{ x, y, ok }], kind : bâtiment (ou K.None pour une zone)
  setGhost(kind, spots, radius = 0) {
    const key = kind + ':' + spots.map((s) => `${s.x},${s.y},${s.ok ? 1 : 0}`).join(';');
    if (key === this.ghostKey) return;
    this.ghostKey = key;
    for (const c of [...this.ghost.children]) { this.ghost.remove(c); }
    if (!spots.length) { this.ring.visible = false; return; }
    const df = DEFS[kind] || DEFS[K.Road];
    const w = kind === K.None ? 1 : df.W; const h = kind === K.None ? 1 : df.H;
    for (const s of spots) {
      const foot = new THREE.Mesh(this.footGeom, s.ok ? this.footOk : this.footBad);
      foot.position.set(s.x + w / 2, 0.1, s.y + h / 2); foot.scale.set(w, 1, h);
      this.ghost.add(foot);
      if (!s.ok || kind === K.None || kind === K.Road || spots.length > 40) continue;
      const fake = { Kind: kind, X: s.x, Y: s.y, Level: 3, Pop: 1, HasRoad: true, Eff: 1, Fire: 0 };
      for (const pc of buildingPieces(fake, this.game)) {
        const m = new THREE.Mesh(this.geoms[pc.g], this.ghostMat);
        m.matrixAutoUpdate = false;
        m.matrix.copy(pieceMatrix(pc, s.x, s.y));
        this.ghost.add(m);
      }
    }
    if (radius > 0 && spots.length === 1) {
      const s = spots[0];
      this.ring.visible = true;
      this.ring.position.set(s.x + w / 2, 0.12, s.y + h / 2);
      this.ring.scale.set(radius, radius, 1);
    } else if (spots.length > 0) this.ring.visible = false;
  }

  // ---------- passants ----------
  updateWalkers(dt, speed) {
    const g = this.game;
    if (!this.roads || this.roadsVersion !== g.version) {
      this.roads = [];
      for (let x = 0; x < MAP_W; x++) for (let y = 0; y < MAP_H; y++) if (g.connected(x, y)) this.roads.push([x, y]);
      this.roadsVersion = g.version;
      this.produced = [];
      for (let i = 0; i < GOODS.length; i++) if (g.LastProd[i] > 0) this.produced.push(i);
    }
    const target = Math.min(180, Math.floor(g.population() / 12) + Math.floor(this.roads.length / 12));
    if (this.roads.length && this.walkers.length < target && Math.random() < 0.3) {
      const [x, y] = this.roads[Math.floor(Math.random() * this.roads.length)];
      const cart = this.produced.length > 0 && Math.random() < 0.25;
      this.walkers.push({
        x, y, tx: x, ty: y, px: -1, py: -1, life: 15 + Math.random() * 25, cart,
        col: cart ? parseInt(GOODS[this.produced[Math.floor(Math.random() * this.produced.length)]].color.slice(1), 16) : [0xb43228, 0xdcd2b4, 0x3c5a96, 0x96783c, 0x5a8246, 0xe6e6e6][Math.floor(Math.random() * 6)],
      });
    }
    const sp = speed * dt * 1.6;
    this.walkerBody.begin(); this.walkerHead.begin();
    this.walkers = this.walkers.filter((w) => {
      w.life -= dt;
      if (w.life <= 0 || !g.connected(w.tx, w.ty)) return false;
      const dx = w.tx - w.x; const dy = w.ty - w.y; const dist = Math.hypot(dx, dy);
      if (dist <= sp || dist === 0) {
        w.x = w.tx; w.y = w.ty;
        let opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [w.tx + a, w.ty + b]).filter(([nx, ny]) => g.connected(nx, ny) && !(nx === w.px && ny === w.py));
        if (!opts.length && w.px >= 0) opts = [[w.px, w.py]];
        if (opts.length) { const n = opts[Math.floor(Math.random() * opts.length)]; w.px = w.tx; w.py = w.ty; [w.tx, w.ty] = n; }
      } else if (sp > 0) { w.x += dx / dist * sp; w.y += dy / dist * sp; }
      const yaw = Math.atan2(w.tx - w.x, w.ty - w.y);
      if (w.cart) {
        this.walkerBody.push(pieceMatrix({ x: 0.5, z: 0.5, y: 0.04, w: 0.22, h: 0.14, d: 0.38, r: yaw }, w.x, w.y), 0x7a553a);
        this.walkerHead.push(pieceMatrix({ x: 0.5, z: 0.5, y: 0.14, w: 0.2, h: 0.12, d: 0.28 }, w.x, w.y), w.col);
      } else {
        const ox = 0.35 + (w.px >= 0 ? 0.1 : 0);
        this.walkerBody.push(pieceMatrix({ x: ox, z: 0.5, y: 0.04, w: 0.1, h: 0.2, d: 0.08, r: yaw }, w.x, w.y), w.col);
        this.walkerHead.push(pieceMatrix({ x: ox, z: 0.5, y: 0.24, w: 0.08, h: 0.08, d: 0.08 }, w.x, w.y), 0xd6aa82);
      }
      return true;
    });
    this.walkerBody.end(); this.walkerHead.end();
  }

  // ---------- image ----------
  frame(dt, speed = 1) {
    this.time += dt;
    const g = this.game;
    if (!g) return;
    if (this.terrVersion !== g.TerrainVer) { this.buildTerrain(); this.terrVersion = g.TerrainVer; this.builtVersion = -1; }
    if (this.builtVersion !== g.version) { this.buildCity(); this.builtVersion = g.version; if (this.ovPlane.visible) this.showDesirability(true); }
    this.updateWalkers(dt, speed);
    this.waterMat.color.setHex(mix(0x3f86b8, 0x5a9cc6, 0.5 + 0.5 * Math.sin(this.time * 0.8)));
    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.dispose();
  }
}
