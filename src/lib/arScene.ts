import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { FACE_INDICES, FACE_POSITIONS } from "@/lib/faceMesh";
import type { Glasses } from "@/lib/glasses";

// ===================== TWEAK THESE if the glasses sit wrong =====================
// Units are centimetres on a real face (MediaPipe's "canonical face" space).
export const TUNE = {
  width: 13.8, // width of the frame. bigger = wider glasses
  y: 2.5, // up / down. bigger = higher on the face
  z: 4.6, // forward / back. bigger = further from the face
  pitch: 0.06, // tilts the frame (radians). bigger = top leans forward, like real glasses
  occluderScale: 0.96, // invisible face mask size. smaller = less of the nose hides the frame
  skullX: 6.0, // invisible head width. bigger hides the far arm earlier when you turn
  lensColor: "#3b3f44", // lens tint colour (only for models with separate lens parts)
  lensOpacity: 0.22, // 0 = fully clear, higher = darker
  shadowOpacity: 0.2, // darkness of the soft shadow the frame casts on your face
  fov: 63, // MediaPipe's camera field of view - leave at 63
  straighten: true, // reshape the arms so they sit against the sides of your head
  armX: 7.4, // how far apart the arms sit at the ears (half-width, cm). bigger = arms further from the head
  maskWidth: 0.86, // invisible face mask width (1 = full). smaller = arms are never cut off
  earZ: -5.2, // where the arms start to fade out behind the ear (cm, more negative = further back)
  earFade: 2.8, // how long the fade is
};
// =================================================================================

// ---------------------- One-Euro filter (smooth when still, quick when moving) ----------------------
const alpha = (cutoff: number, dt: number) => 1 / (1 + 1 / (2 * Math.PI * cutoff) / dt);
class OneEuro {
  private x = 0;
  private dx = 0;
  private t = 0;
  private ready = false;
  constructor(private minCutoff: number, private beta: number, private dCutoff = 1) {}
  reset() {
    this.ready = false;
  }
  filter(v: number, t: number) {
    if (!this.ready) {
      this.ready = true;
      this.x = v;
      this.dx = 0;
      this.t = t;
      return v;
    }
    const dt = Math.max(1e-3, t - this.t);
    this.t = t;
    this.dx += alpha(this.dCutoff, dt) * ((v - this.x) / dt - this.dx);
    this.x += alpha(this.minCutoff + this.beta * Math.abs(this.dx), dt) * (v - this.x);
    return this.x;
  }
}

// ---------------------- helpers ----------------------
const METAL_NAME = /gold|silver|rose|copper|bronze|gunmetal|chrome|steel|titan|platinum|brass|metal/i;
const PART_METAL = /metal|hrom|chrom|steel|hinge|screw/i;

type Std = THREE.MeshStandardMaterial;

function toPhysical(src: Std): THREE.MeshPhysicalMaterial {
  if ((src as unknown as { isMeshPhysicalMaterial?: boolean }).isMeshPhysicalMaterial)
    return src as THREE.MeshPhysicalMaterial;
  const p = new THREE.MeshPhysicalMaterial();
  p.name = src.name;
  p.color.copy(src.color);
  p.map = src.map;
  p.roughness = src.roughness;
  p.metalness = src.metalness;
  p.roughnessMap = src.roughnessMap;
  p.metalnessMap = src.metalnessMap;
  p.normalMap = src.normalMap;
  p.normalScale.copy(src.normalScale);
  p.aoMap = src.aoMap;
  p.emissive.copy(src.emissive);
  p.emissiveMap = src.emissiveMap;
  p.emissiveIntensity = src.emissiveIntensity;
  p.side = src.side;
  p.transparent = src.transparent;
  p.opacity = src.opacity;
  p.alphaTest = src.alphaTest;
  p.vertexColors = src.vertexColors;
  return p;
}

function isLens(m: THREE.Material, extra: string[]) {
  const x = m as unknown as { transmission?: number; opacity: number; transparent: boolean; name: string };
  return (
    (x.transmission ?? 0) > 0 ||
    (x.transparent && x.opacity < 0.5) ||
    /glass|lens|verre|lente|cristal|visor|shade|tint|transparent/i.test(x.name) ||
    extra.includes(x.name)
  );
}

// ---------------------- models with ONE baked texture (AI-generated) ----------------------
// These have no separate lens / frame materials. We find the lenses from the texture + shape
// and split the mesh in two, so the lenses can be see-through and the frame can be recoloured.
function findLens(mesh: THREE.Mesh): Uint8Array | null {
  const g = mesh.geometry;
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  const idx = g.index;
  const map = (mesh.material as THREE.MeshStandardMaterial).map;
  const img = map?.image as CanvasImageSource | undefined;
  if (!uv || !idx || !map || !img) return null;
  const n = pos.count;
  const M = mesh.matrixWorld;
  const P = new Float32Array(n * 3);
  const v = new THREE.Vector3();
  let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9, maxz = -1e9;
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(M);
    P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z;
    if (v.x < minx) minx = v.x; if (v.x > maxx) maxx = v.x;
    if (v.y < miny) miny = v.y; if (v.y > maxy) maxy = v.y;
    if (v.z > maxz) maxz = v.z;
  }
  const W = maxx - minx, cx = (maxx + minx) / 2, cy = (maxy + miny) / 2;

  // colour of the texture at every vertex
  const S = 1024;
  const cv = document.createElement("canvas");
  cv.width = S; cv.height = S;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, S, S);
  const px = ctx.getImageData(0, 0, S, S).data;
  const C = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = uv.getX(i), w = uv.getY(i);
    const X = Math.min(S - 1, Math.max(0, Math.floor((((u % 1) + 1) % 1) * S)));
    let Y = ((w % 1) + 1) % 1;
    if (map.flipY) Y = 1 - Y;
    Y = Math.min(S - 1, Math.max(0, Math.floor(Y * S)));
    const o = (Y * S + X) * 4;
    C[i * 3] = px[o]; C[i * 3 + 1] = px[o + 1]; C[i * 3 + 2] = px[o + 2];
  }

  // weld vertices that sit at the same spot (texture seams split them), so the surface is connected
  const q = 1 / (W * 1e-4);
  const key = new Map<string, number>();
  const canon = new Uint32Array(n);
  let m = 0;
  for (let i = 0; i < n; i++) {
    const k = Math.round(P[i * 3] * q) + "," + Math.round(P[i * 3 + 1] * q) + "," + Math.round(P[i * 3 + 2] * q);
    let id = key.get(k);
    if (id === undefined) { id = m++; key.set(k, id); }
    canon[i] = id;
  }
  const cc = new Float32Array(m * 3), cn = new Uint32Array(m), cp = new Float32Array(m * 3);
  for (let i = 0; i < n; i++) {
    const c = canon[i];
    cc[c * 3] += C[i * 3]; cc[c * 3 + 1] += C[i * 3 + 1]; cc[c * 3 + 2] += C[i * 3 + 2]; cn[c]++;
    cp[c * 3] = P[i * 3]; cp[c * 3 + 1] = P[i * 3 + 1]; cp[c * 3 + 2] = P[i * 3 + 2];
  }
  const f = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const h = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const L = new Float32Array(m * 3);
  for (let c = 0; c < m; c++) {
    const R = f(cc[c * 3] / cn[c]), G = f(cc[c * 3 + 1] / cn[c]), B = f(cc[c * 3 + 2] / cn[c]);
    const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
    const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
    const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
    L[c * 3] = 116 * h(Y) - 16; L[c * 3 + 1] = 500 * (h(X) - h(Y)); L[c * 3 + 2] = 200 * (h(Y) - h(Z));
  }
  const dE = (a: number, b: number) =>
    Math.hypot(L[a * 3] - L[b * 3], L[a * 3 + 1] - L[b * 3 + 1], L[a * 3 + 2] - L[b * 3 + 2]);

  // neighbours
  const ia = idx.array;
  const deg = new Uint32Array(m + 1);
  for (let t = 0; t < ia.length; t++) deg[canon[ia[t]] + 1] += 2;
  for (let i = 0; i < m; i++) deg[i + 1] += deg[i];
  const adj = new Uint32Array(deg[m]);
  const fill = deg.slice(0, m);
  for (let t = 0; t < ia.length; t += 3)
    for (let k = 0; k < 3; k++) {
      const a = canon[ia[t + k]], b = canon[ia[t + ((k + 1) % 3)]];
      adj[fill[a]++] = b; adj[fill[b]++] = a;
    }

  // seeds: points on the front of each lens (several heights, so gradient lenses are covered)
  const slab = 0.08 * W;
  const seeds: number[] = [], seedX: number[] = [];
  for (const sx of [-1, 1])
    for (const oy of [-0.14, -0.105, -0.07, -0.035, 0, 0.035, 0.07, 0.105, 0.14]) {
      const tx = cx + sx * 0.26 * W, ty = cy + oy * W;
      let best = -1, bd = 1e9;
      for (let i = 0; i < m; i++) {
        if (cp[i * 3 + 2] < maxz - slab) continue;
        const d = Math.hypot(cp[i * 3] - tx, cp[i * 3 + 1] - ty);
        if (d < bd) { bd = d; best = i; }
      }
      if (best >= 0) { seeds.push(best); seedX.push(cx + sx * 0.26 * W); }
    }

  // grow from each seed over neighbours with a similar colour, staying on the lens plane
  const out = new Uint8Array(m);
  for (let si = 0; si < seeds.length; si++) {
    const s = seeds[si], sideX = seedX[si], zs = cp[s * 3 + 2];
    const stack = [s];
    out[s] = 1;
    while (stack.length) {
      const a = stack.pop()!;
      for (let k = deg[a]; k < deg[a + 1]; k++) {
        const b = adj[k];
        if (out[b]) continue;
        if (Math.abs(cp[b * 3] - sideX) > 0.21 * W || Math.abs(cp[b * 3 + 1] - cy) > 0.3 * W) continue;
        if (Math.abs(cp[b * 3 + 2] - zs) > 0.04 * W) continue;
        if (dE(a, b) > 5 || dE(s, b) > 45) continue;
        out[b] = 1;
        stack.push(b);
      }
    }
  }
  const flag = new Uint8Array(n);
  let count = 0;
  for (let i = 0; i < n; i++) { flag[i] = out[canon[i]]; count += flag[i]; }
  return count > 300 ? flag : null;
}

function subGeometry(g: THREE.BufferGeometry, flag: Uint8Array, wantLens: boolean) {
  const ia = g.index!.array;
  const n = g.attributes.position.count;
  const remap = new Int32Array(n).fill(-1);
  const out: number[] = [];
  let cnt = 0;
  for (let t = 0; t < ia.length; t += 3) {
    const a = ia[t], b = ia[t + 1], c = ia[t + 2];
    if (flag[a] + flag[b] + flag[c] >= 2 !== wantLens) continue;
    for (const vtx of [a, b, c]) {
      if (remap[vtx] < 0) remap[vtx] = cnt++;
      out.push(remap[vtx]);
    }
  }
  const ng = new THREE.BufferGeometry();
  for (const name of ["position", "normal", "uv"]) {
    const attr = g.attributes[name];
    if (!attr) continue;
    const arr = new Float32Array(cnt * attr.itemSize);
    for (let i = 0; i < n; i++) {
      const j = remap[i];
      if (j < 0) continue;
      for (let k = 0; k < attr.itemSize; k++) arr[j * attr.itemSize + k] = attr.getComponent(i, k);
    }
    ng.setAttribute(name, new THREE.BufferAttribute(arr, attr.itemSize));
  }
  ng.setIndex(out);
  return ng;
}

type Recolorable = {
  mat: THREE.MeshPhysicalMaterial;
  origColor: THREE.Color;
  origMap: THREE.Texture | null;
  origMetal: number;
  origRough: number;
};

type Built = {
  group: THREE.Group; // normalised: front of frame = 1 unit wide, origin at front centre
  recolor: Recolorable[];
  materials: THREE.Material[];
  lensMats: THREE.MeshBasicMaterial[];
  baked: boolean; // one baked texture: recolouring keeps the texture's light/dark detail
};

const loader = new GLTFLoader();
const cache = new Map<string, Promise<THREE.Group>>();
function loadGLB(url: string) {
  if (!cache.has(url)) cache.set(url, loader.loadAsync(url).then((g) => g.scene));
  return cache.get(url)!;
}

// ---------------------- the scene ----------------------
export class ARScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  private anchor = new THREE.Group(); // follows the head
  private glassesHolder = new THREE.Group();
  private key: THREE.DirectionalLight;
  private fill: THREE.HemisphereLight;
  private built: Built | null = null;
  private token = 0;
  private envTex: THREE.Texture | null = null;

  private lastSeen = -1;
  // screen position (u, v) is filtered fast so the glasses stay glued to the face;
  // depth (d) is noisy so it is filtered slowly. Filtering x/y/z separately made the glasses swim.
  private fu = new OneEuro(1.2, 20);
  private fv = new OneEuro(1.2, 20);
  private fd = new OneEuro(0.9, 0.1);
  private fq = [0, 1, 2, 3].map(() => new OneEuro(1.8, 4));
  private fs = new OneEuro(0.5, 0);
  private fade = {
    uHeadInv: { value: new THREE.Matrix4() },
    uFadeA: { value: TUNE.earZ },
    uFadeB: { value: TUNE.earZ - TUNE.earFade },
  };
  private prevQ = new THREE.Quaternion();
  private hasPrev = false;
  private tmp = {
    m: new THREE.Matrix4(),
    p: new THREE.Vector3(),
    s: new THREE.Vector3(),
    q: new THREE.Quaternion(),
  };

  color: string | null = null;
  colorName = "Original";

  constructor(canvas: HTMLCanvasElement) {
    const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
    r.setClearColor(0x000000, 0);
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = (THREE as unknown as { NeutralToneMapping?: THREE.ToneMapping }).NeutralToneMapping ?? THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.VSMShadowMap;
    this.renderer = r;

    this.camera = new THREE.PerspectiveCamera(TUNE.fov, 4 / 3, 1, 2000);
    this.camera.position.set(0, 0, 0);

    // soft studio reflections (no download needed)
    const pm = new THREE.PMREMGenerator(r);
    this.envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    this.scene.environment = this.envTex;
    (this.scene as unknown as { environmentIntensity: number }).environmentIntensity = 0.9;

    this.fill = new THREE.HemisphereLight(0xffffff, 0x8a7566, 0.35);
    this.scene.add(this.fill);

    this.key = new THREE.DirectionalLight(0xffffff, 1.5);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    const sc = this.key.shadow.camera;
    sc.left = -12; sc.right = 12; sc.top = 12; sc.bottom = -12; sc.near = 5; sc.far = 90;
    this.key.shadow.radius = 7;
    this.key.shadow.blurSamples = 16;
    this.key.shadow.bias = -0.0004;
    this.scene.add(this.key, this.key.target);

    // ---- the head: invisible mask + skull (write depth only) and a soft shadow catcher ----
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(FACE_POSITIONS, 3));
    geo.setIndex(FACE_INDICES);
    geo.computeVertexNormals();

    const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false });
    this.depthOnly = depthOnly;
    const face = new THREE.Mesh(geo, depthOnly);
    face.scale.set(TUNE.occluderScale * TUNE.maskWidth, TUNE.occluderScale, TUNE.occluderScale);
    face.renderOrder = -2;
    this.face = face;

    const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), depthOnly);
    skull.position.set(0, 0.5, -3.5);
    skull.scale.set(TUNE.skullX, 9, 8.5);
    skull.renderOrder = -2;

    const catcher = new THREE.Mesh(
      geo,
      new THREE.ShadowMaterial({ color: 0x1a0f08, opacity: TUNE.shadowOpacity, depthWrite: false })
    );
    (catcher.material as THREE.ShadowMaterial).polygonOffset = true;
    (catcher.material as THREE.ShadowMaterial).polygonOffsetFactor = -2;
    catcher.receiveShadow = true;
    catcher.renderOrder = -1;
    this.catcher = catcher;
    this.skull = skull;

    this.anchor.matrixAutoUpdate = false;
    this.anchor.visible = false;
    this.anchor.add(face, skull, catcher, this.glassesHolder);
    this.scene.add(this.anchor);
  }
  private face: THREE.Mesh;
  private catcher: THREE.Mesh;
  private skull: THREE.Mesh;
  private depthOnly: THREE.MeshBasicMaterial;

  /** debug: show the invisible face mask + skull as a red ghost */
  showMask(on: boolean) {
    const m = this.depthOnly;
    m.colorWrite = on;
    m.transparent = on;
    m.opacity = on ? 0.35 : 1;
    m.color.set(on ? 0xff2020 : 0xffffff);
    m.needsUpdate = true;
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setFov(fov: number) {
    TUNE.fov = fov;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  /** light estimation: luma 0..1 and an rgb tint from the camera picture */
  setLight(luma: number, rgb: [number, number, number]) {
    const k = THREE.MathUtils.clamp(0.45 + luma * 1.1, 0.6, 1.35);
    this.renderer.toneMappingExposure = k;
    const m = Math.max(rgb[0], rgb[1], rgb[2]) || 1;
    const tint = new THREE.Color(0.75 + 0.25 * (rgb[0] / m), 0.75 + 0.25 * (rgb[1] / m), 0.75 + 0.25 * (rgb[2] / m));
    this.key.color.copy(tint);
    this.fill.color.copy(tint);
  }

  // ---------------------- building the glasses ----------------------
  async setProduct(product: Glasses, color: string | null, colorName: string) {
    const my = ++this.token;
    this.color = color;
    this.colorName = colorName;
    const src = await loadGLB(product.model);
    if (my !== this.token) return;
    const built = this.build(src, product);
    if (my !== this.token) return;
    if (this.built) {
      this.glassesHolder.remove(this.built.group);
      this.built.materials.forEach((m) => m.dispose());
    }
    this.built = built;
    this.glassesHolder.add(built.group);
    this.applyColor();
  }

  setColor(color: string | null, name: string) {
    this.color = color;
    this.colorName = name;
    this.applyColor();
  }

  private applyColor() {
    if (!this.built) return;
    const color = this.color;
    const metal = color ? METAL_NAME.test(this.colorName) : null;
    for (const r of this.built.recolor) {
      const m = r.mat;
      const tint = m.userData.tint as { uTint: { value: THREE.Color }; uTintAmt: { value: number } } | undefined;
      if (color) {
        if (this.built.baked && tint) {
          // baked texture: keep its light/dark detail but swap its colour
          m.map = r.origMap;
          m.color.set(0xffffff);
          tint.uTint.value.set(color);
          tint.uTintAmt.value = 1;
        } else {
          m.map = null;
          m.color.set(color);
        }
        if (metal) {
          m.metalness = 0.95; m.roughness = 0.3; m.clearcoat = 0;
        } else {
          m.metalness = 0; m.roughness = 0.4; m.clearcoat = 0.5; m.clearcoatRoughness = 0.18;
        }
      } else {
        m.map = r.origMap;
        m.color.copy(r.origColor);
        if (tint) tint.uTintAmt.value = 0;
        if (r.origMetal > 0.5) {
          m.metalness = 0.95; m.roughness = Math.min(Math.max(r.origRough, 0.2), 0.4); m.clearcoat = 0;
        } else {
          m.metalness = 0; m.roughness = Math.min(Math.max(r.origRough, 0.3), 0.45); m.clearcoat = 0.5; m.clearcoatRoughness = 0.18;
        }
      }
      m.needsUpdate = true;
    }
  }

  private build(source: THREE.Group, product: Glasses): Built {
    const lensExtra = product.lens ?? [];
    const hide = product.hide ?? [];
    const recolorNames = product.recolor ?? [];
    const clone = source.clone(true);
    clone.updateMatrixWorld(true);

    // ---- AI-generated model with one mesh + one baked texture? split the lenses off the frame ----
    let baked = false;
    {
      const ms: THREE.Mesh[] = [];
      clone.traverse((o) => { if ((o as THREE.Mesh).isMesh) ms.push(o as THREE.Mesh); });
      const only = ms.length === 1 ? ms[0] : null;
      const om = only && !Array.isArray(only.material) ? (only.material as THREE.MeshStandardMaterial) : null;
      if (only && om && om.map && !isLens(om, lensExtra) && only.geometry.index) {
        const flag = findLens(only);
        if (flag) {
          const lensMesh = new THREE.Mesh(
            subGeometry(only.geometry, flag, true),
            new THREE.MeshBasicMaterial({ name: "Lens", map: om.map })
          );
          lensMesh.name = "LensSplit";
          lensMesh.position.copy(only.position);
          lensMesh.quaternion.copy(only.quaternion);
          lensMesh.scale.copy(only.scale);
          only.geometry = subGeometry(only.geometry, flag, false);
          only.parent!.add(lensMesh);
          baked = true;
        }
      }
    }

    const recolor: Recolorable[] = [];
    const materials: THREE.Material[] = [];
    const lensMeshes: THREE.Mesh[] = [];
    const lensMats: THREE.MeshBasicMaterial[] = [];
    const frameMats = new Map<THREE.MeshPhysicalMaterial, { name: string; verts: number }>();

    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const fix = (mat: THREE.Material): THREE.Material => {
        if (hide.includes(mat.name)) {
          mesh.visible = false;
          return mat;
        }
        if (isLens(mat, lensExtra)) {
          lensMeshes.push(mesh);
          const lensTex = (mat as THREE.MeshBasicMaterial).map;
          const absorb = new THREE.MeshBasicMaterial({
            color: lensTex ? new THREE.Color(0xffffff) : new THREE.Color(TUNE.lensColor),
            map: lensTex ?? null,
            transparent: true,
            opacity: lensTex ? Math.min(0.9, TUNE.lensOpacity * 2.2) : TUNE.lensOpacity,
            depthWrite: false,
          });
          absorb.userData.baked = !!lensTex;
          materials.push(absorb);
          lensMats.push(absorb);
          return absorb;
        }
        const std = toPhysical(mat as Std);
        const p = std === mat ? (mat.clone() as THREE.MeshPhysicalMaterial) : std;
        materials.push(p);
        p.envMapIntensity = 1;
        // arms fade out once they pass the ear, so they look like they go behind it
        p.transparent = true;
        const tint = { uTint: { value: new THREE.Color(1, 1, 1) }, uTintAmt: { value: 0 } };
        p.userData.tint = tint;
        p.onBeforeCompile = (sh) => {
          sh.uniforms.uTint = tint.uTint;
          sh.uniforms.uTintAmt = tint.uTintAmt;
          sh.uniforms.uHeadInv = this.fade.uHeadInv;
          sh.uniforms.uFadeA = this.fade.uFadeA;
          sh.uniforms.uFadeB = this.fade.uFadeB;
          sh.vertexShader = sh.vertexShader
            .replace("#include <common>", "#include <common>\nuniform mat4 uHeadInv;\nvarying float vHeadZ;")
            .replace(
              "#include <project_vertex>",
              "#include <project_vertex>\nvHeadZ = (uHeadInv * modelMatrix * vec4(transformed, 1.0)).z;"
            );
          sh.fragmentShader = sh.fragmentShader
            .replace("#include <common>", "#include <common>\nuniform float uFadeA;\nuniform float uFadeB;\nvarying float vHeadZ;\nuniform vec3 uTint;\nuniform float uTintAmt;")
            .replace(
              "#include <map_fragment>",
              "#include <map_fragment>\nif (uTintAmt > 0.5) { float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)); diffuseColor.rgb = uTint * clamp(lum / 0.5, 0.0, 1.5); }"
            )
            .replace(
              "#include <alphamap_fragment>",
              "#include <alphamap_fragment>\ndiffuseColor.a *= smoothstep(uFadeB, uFadeA, vHeadZ);"
            );
        };
        p.customProgramCacheKey = () => "earfade";
        frameMats.set(p, { name: mat.name, verts: mesh.geometry.attributes.position.count });
        return p;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(fix) : fix(mesh.material);
      mesh.castShadow = mesh.visible;
    });

    // ---- which materials can be recoloured: the ones named in glasses.ts, else the biggest frame material ----
    const groups = new Map<string, number>();
    frameMats.forEach((fm) => groups.set(fm.name, (groups.get(fm.name) ?? 0) + fm.verts));
    const chosen = new Set<string>(recolorNames.filter((n) => groups.has(n)));
    if (!chosen.size) {
      let best = "", bestV = -1;
      groups.forEach((vv, nn) => {
        if (!PART_METAL.test(nn) && vv > bestV) { best = nn; bestV = vv; }
      });
      if (bestV >= 0) chosen.add(best);
    }
    frameMats.forEach((fm, p) => {
      if (chosen.has(fm.name)) {
        recolor.push({ mat: p, origColor: p.color.clone(), origMap: p.map, origMetal: p.metalness, origRough: p.roughness });
      } else if (PART_METAL.test(fm.name)) {
        p.metalness = 0.9;
        p.roughness = Math.min(p.roughness, 0.3);
      } else {
        p.roughness = Math.min(p.roughness, 0.45);
      }
    });

    // glossy reflection layer on top of each tinted lens (adds light, doesn't hide the eyes)
    const refl = new THREE.MeshPhysicalMaterial({
      color: 0x000000,
      roughness: 0.04,
      metalness: 0,
      ior: 2.0,
      envMapIntensity: 1.1,
      transparent: true,
      // adds light on top without touching the canvas transparency (plain "additive" made the lens opaque black)
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
      depthWrite: false,
    });
    materials.push(refl);
    for (const lm of lensMeshes) {
      lm.castShadow = false;
      lm.renderOrder = 2;
      const r = new THREE.Mesh(lm.geometry, refl);
      r.renderOrder = 3;
      lm.add(r);
    }

    // ---- normalise: front of the frame 1 unit wide, origin at the front centre ----
    const holder = new THREE.Group();
    holder.rotation.y = baked ? 0 : product.turn ?? 0; // AI-generated models already face forward
    holder.add(clone);
    const outer = new THREE.Group();
    outer.add(holder);
    outer.updateMatrixWorld(true);

    const all = new THREE.Box3().setFromObject(outer);
    const slabMin = all.max.z - 0.12 * (all.max.z - all.min.z);
    const front = new THREE.Box3();
    const v = new THREE.Vector3();
    outer.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const pos = mesh.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
        if (v.z >= slabMin) front.expandByPoint(v);
      }
    });
    const fw = front.max.x - front.min.x;
    const cx = (front.min.x + front.max.x) / 2;
    const cy = (front.min.y + front.max.y) / 2;
    holder.position.set(-cx, -cy, -all.max.z + 0.08 * fw);
    outer.scale.setScalar(1 / fw);
    outer.updateMatrixWorld(true);

    if (TUNE.straighten) this.fitArms(outer);

    console.log(
      `[Lumiere] ${product.model}: ${lensMeshes.length} lens mesh(es), baked=${baked}, recolouring: ${[...chosen].join(", ") || "nothing"}`
    );
    return { group: outer, recolor, materials, lensMats, baked };
  }

  /**
   * Reshape the arms so they run from the hinge to the sides of the head (like real glasses that
   * flex open when worn). Works for any model: it measures where the arms are and moves them.
   */
  private fitArms(outer: THREE.Group) {
    // mesh.matrixWorld already includes the 1/width scale, so it maps straight into normalised units
    const v = new THREE.Vector3();
    const meshes: { mesh: THREE.Mesh; M: THREE.Matrix4 }[] = [];
    const N = 9; // slices for z in -0.1 .. -1.0
    const slices: number[][] = Array.from({ length: N }, () => []);
    const hinge: number[] = [];
    outer.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.visible) return;
      const M = mesh.matrixWorld.clone();
      meshes.push({ mesh, M });
      const pos = mesh.geometry.attributes.position;
      const step = Math.max(1, Math.floor(pos.count / 6000));
      for (let i = 0; i < pos.count; i += step) {
        v.fromBufferAttribute(pos, i).applyMatrix4(M);
        const ax = Math.abs(v.x);
        if (v.z <= 0.02 && v.z > -0.12 && ax > 0.44) hinge.push(ax);
        const k = Math.floor((-v.z - 0.1) / 0.1);
        if (k >= 0 && k < N && ax > 0.3) slices[k].push(ax);
      }
    });
    const med = (a: number[]) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)];
    const xh = hinge.length > 10 ? med(hinge) : 0.49;
    // median |x| of the arms per slice (null where there is no data)
    const m: (number | null)[] = slices.map((s) => (s.length >= 6 ? med(s) : null));
    if (m.filter((x) => x !== null).length < 2) return;
    // fill the gaps
    for (let k = 0; k < N; k++) {
      if (m[k] !== null) continue;
      let lo = k - 1, hi = k + 1;
      while (lo >= 0 && m[lo] === null) lo--;
      while (hi < N && m[hi] === null) hi++;
      if (lo >= 0 && hi < N) m[k] = (m[lo]! * (hi - k) + m[hi]! * (k - lo)) / (hi - lo);
      else m[k] = lo >= 0 ? m[lo] : m[hi];
    }
    const earX = TUNE.armX / TUNE.width;
    const sm = (a: number, b: number, x: number) => {
      const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };
    // how far to move the arm at each slice (outward = positive)
    const shift = m.map((x, k) => xh + (earX - xh) * sm(0.1, 0.55, 0.15 + 0.1 * k) - x!);
    const shiftAt = (z: number) => {
      const f = Math.min(N - 1, Math.max(0, (-z - 0.15) / 0.1));
      const i = Math.floor(f);
      const j = Math.min(N - 1, i + 1);
      return shift[i] + (shift[j] - shift[i]) * (f - i);
    };

    const zh = -0.05;
    const Minv = new THREE.Matrix4();
    for (const { mesh, M } of meshes) {
      mesh.geometry = mesh.geometry.clone();
      Minv.copy(M).invert();
      const pos = mesh.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(M);
        if (v.z < zh && Math.abs(v.x) > 0.25) {
          v.x += Math.sign(v.x) * shiftAt(v.z) * Math.min(1, (zh - v.z) / 0.05);
          v.applyMatrix4(Minv);
          pos.setXYZ(i, v.x, v.y, v.z);
        }
      }
      (pos as THREE.BufferAttribute).needsUpdate = true;
      mesh.geometry.computeBoundingSphere();
      mesh.geometry.computeBoundingBox();
    }
  }

  // ---------------------- every frame ----------------------
  /** m = MediaPipe face matrix (or null when no face). t = seconds. */
  setPose(m: THREE.Matrix4 | null, t: number) {
    if (!m) {
      if (this.lastSeen >= 0 && t - this.lastSeen > 0.25) {
        this.anchor.visible = false;
        this.fu.reset();
        this.fv.reset();
        this.fd.reset();
        this.fq.forEach((f) => f.reset());
        this.fs.reset();
        this.hasPrev = false;
      }
      return;
    }
    const { p, s, q } = this.tmp;
    m.decompose(p, q, s);
    const d = -p.z;
    if (d < 5) return; // nonsense pose, skip this frame
    this.lastSeen = t;
    if (this.hasPrev && q.dot(this.prevQ) < 0) q.set(-q.x, -q.y, -q.z, -q.w);

    const th = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const ax = th * this.camera.aspect;
    const u = this.fu.filter(p.x / d / ax, t);
    const v = this.fv.filter(p.y / d / th, t);
    const dd = this.fd.filter(d, t);
    p.set(u * dd * ax, v * dd * th, -dd);

    q.set(
      this.fq[0].filter(q.x, t),
      this.fq[1].filter(q.y, t),
      this.fq[2].filter(q.z, t),
      this.fq[3].filter(q.w, t)
    ).normalize();
    this.prevQ.copy(q);
    this.hasPrev = true;
    const k = this.fs.filter(s.x, t);
    this.anchor.matrix.compose(p, q, s.set(k, k, k));
    this.anchor.matrixWorldNeedsUpdate = true;
    this.anchor.visible = true;
  }

  render() {
    // keep tunables live
    this.glassesHolder.position.set(0, TUNE.y, TUNE.z);
    this.glassesHolder.rotation.x = TUNE.pitch;
    this.glassesHolder.scale.setScalar(TUNE.width);
    this.skull.scale.x = TUNE.skullX;
    this.face.scale.set(TUNE.occluderScale * TUNE.maskWidth, TUNE.occluderScale, TUNE.occluderScale);
    this.fade.uFadeA.value = TUNE.earZ;
    this.fade.uFadeB.value = TUNE.earZ - TUNE.earFade;
    this.fade.uHeadInv.value.copy(this.anchor.matrix).invert();
    (this.catcher.material as THREE.ShadowMaterial).opacity = TUNE.shadowOpacity;
    if (this.built) {
      for (const lm of this.built.lensMats) {
        if (lm.userData.baked) {
          lm.opacity = Math.min(0.9, TUNE.lensOpacity * 2.2);
        } else {
          lm.opacity = TUNE.lensOpacity;
          lm.color.set(TUNE.lensColor);
        }
      }
    }

    if (this.anchor.visible) {
      // room light stays fixed in the camera's world while the head moves under it
      const hp = this.tmp.p.setFromMatrixPosition(this.anchor.matrix);
      this.key.position.set(hp.x + 4, hp.y + 15, hp.z + 28);
      this.key.target.position.copy(hp);
      this.key.target.updateMatrixWorld();
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.token++;
    this.built?.materials.forEach((m) => m.dispose());
    this.envTex?.dispose();
    this.renderer.dispose();
  }
}