/**
 * Procedurální model prototypu: deska ESP32-S3, OLED modul, enkodér a šest plošek volně na stole.
 * Rozměry a rozložení jsou ilustrační, dokumentace je neuvádí. Žádný kryt ani hotový produkt.
 */
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  CatmullRomCurve3,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
  AdditiveBlending,
  LinearFilter,
  LinearMipmapLinearFilter,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import type { PartId } from './bus';

/* ---------- Pomocné ---------- */

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(w: number, h: number, paint: (c: CanvasRenderingContext2D) => void, srgb: boolean): CanvasTexture {
  const el = document.createElement('canvas');
  el.width = w;
  el.height = h;
  const c = el.getContext('2d');
  if (!c) throw new Error('Canvas 2D není dostupný');
  paint(c);
  const t = new CanvasTexture(el);
  if (srgb) t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function shadowed<T extends Mesh | InstancedMesh>(m: T, cast = true): T {
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}

function box(w: number, h: number, d: number, mat: Material | Material[], x = 0, y = 0, z = 0): Mesh {
  const m = shadowed(new Mesh(new BoxGeometry(w, h, d), mat));
  m.position.set(x, y + h / 2, z);
  return m;
}

function roundedRect(w: number, d: number, r: number): Shape {
  const s = new Shape();
  const x = -w / 2;
  const y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/* ---------- Materiály ---------- */

export interface Materials {
  readonly copper: MeshStandardMaterial[];
  readonly gold: MeshStandardMaterial;
  readonly mask: MeshStandardMaterial;
  readonly edge: MeshStandardMaterial;
  readonly steel: MeshStandardMaterial;
  readonly plastic: MeshStandardMaterial;
  readonly header: MeshStandardMaterial;
  readonly glass: MeshStandardMaterial;
  readonly connector: MeshStandardMaterial;
  readonly smdDark: MeshStandardMaterial;
  readonly smdTan: MeshStandardMaterial;
  readonly solder: MeshStandardMaterial;
}

function brushedRoughness(rand: () => number, size: number, strokes: number): CanvasTexture {
  const t = canvasTexture(
    size,
    size,
    (c) => {
      c.fillStyle = 'rgb(112,112,112)';
      c.fillRect(0, 0, size, size);
      for (let i = 0; i < strokes; i++) {
        const v = 86 + rand() * 72;
        c.fillStyle = `rgba(${v},${v},${v},0.34)`;
        c.fillRect(rand() * size - size * 0.18, rand() * size, size * (0.16 + rand() * 0.66), 0.6 + rand() * 1.3);
      }
    },
    false,
  );
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  return t;
}

function patina(rand: () => number, size: number): CanvasTexture {
  return canvasTexture(
    size,
    size,
    (c) => {
      c.fillStyle = '#c47f4c';
      c.fillRect(0, 0, size, size);
      for (let i = 0; i < 26; i++) {
        const x = rand() * size;
        const y = rand() * size;
        const r = (26 + rand() * 90) * (size / 256);
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        const dark = rand() > 0.5;
        g.addColorStop(0, dark ? 'rgba(128,78,48,0.14)' : 'rgba(236,184,140,0.12)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g;
        c.fillRect(0, 0, size, size);
      }
      for (let i = 0; i < 40; i++) {
        c.fillStyle = 'rgba(70,104,84,0.07)';
        c.beginPath();
        c.arc(rand() * size, rand() * size, 0.8 + rand() * 2.6, 0, Math.PI * 2);
        c.fill();
      }
    },
    true,
  );
}

export function createMaterials(simple: boolean): Materials {
  const rand = mulberry(7);
  const rough = brushedRoughness(rand, simple ? 128 : 512, simple ? 320 : 2600);
  const shared = simple ? patina(rand, 96) : null;
  const copper = Array.from({ length: 6 }, () => {
    const p = shared ?? patina(rand, 256);
    if (simple) {
      // Bez anizotropie: fyzikální shader je na telefonu nejdražší položka celé scény.
      return new MeshStandardMaterial({ map: p, metalness: 1, roughness: 0.74, roughnessMap: rough, envMapIntensity: 0.9 });
    }
    return new MeshPhysicalMaterial({
      map: p,
      color: 0xffffff,
      metalness: 1,
      roughness: 0.82,
      roughnessMap: rough,
      anisotropy: 0.75,
      anisotropyRotation: 0.12,
      envMapIntensity: 0.9,
    });
  });
  return {
    copper,
    gold: new MeshStandardMaterial({ color: 0xd9ad5b, metalness: 1, roughness: 0.32 }),
    mask: new MeshStandardMaterial({ color: 0x17181a, metalness: 0.15, roughness: 0.5, envMapIntensity: 0.4 }),
    edge: new MeshStandardMaterial({ color: 0x3a3a34, metalness: 0.05, roughness: 0.8 }),
    steel: new MeshStandardMaterial({ color: 0xaeb2b6, metalness: 1, roughness: 0.42, envMapIntensity: 0.62 }),
    plastic: new MeshStandardMaterial({ color: 0x25262a, metalness: 0, roughness: 0.82 }),
    header: new MeshStandardMaterial({ color: 0x18181a, metalness: 0, roughness: 0.68 }),
    glass: simple
      ? new MeshStandardMaterial({ color: 0x030405, metalness: 0, roughness: 0.2, envMapIntensity: 0.07 })
      : new MeshPhysicalMaterial({ color: 0x030405, metalness: 0, roughness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.12, envMapIntensity: 0.07 }),
    connector: new MeshStandardMaterial({ color: 0xe6e0d0, metalness: 0, roughness: 0.6 }),
    smdDark: new MeshStandardMaterial({ color: 0x101012, metalness: 0.1, roughness: 0.5 }),
    smdTan: new MeshStandardMaterial({ color: 0x9c7a55, metalness: 0, roughness: 0.55 }),
    solder: new MeshStandardMaterial({ color: 0xc8cccf, metalness: 1, roughness: 0.3 }),
  };
}

/* ---------- Desky ---------- */

function silk(c: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, align: CanvasTextAlign = 'left'): void {
  const px = (size * c.canvas.height) / 512;
  c.fillStyle = 'rgba(232,232,226,0.86)';
  c.font = `600 ${px}px "JetBrains Mono Variable", ui-monospace, monospace`;
  c.textAlign = align;
  c.textBaseline = 'middle';
  c.fillText(text, x, y);
}

function traces(c: CanvasRenderingContext2D, w: number, h: number, rand: () => number): void {
  c.strokeStyle = 'rgba(92,98,96,0.34)';
  c.lineWidth = 2;
  for (let i = 0; i < 34; i++) {
    let x = rand() * w;
    let y = rand() * h;
    c.beginPath();
    c.moveTo(x, y);
    for (let k = 0; k < 3; k++) {
      if (rand() > 0.5) x += (rand() - 0.5) * w * 0.5;
      else y += (rand() - 0.5) * h * 0.6;
      c.lineTo(x, y);
    }
    c.stroke();
  }
}

function pcb(mats: Materials, w: number, d: number, simple: boolean, paint: (c: CanvasRenderingContext2D, W: number, H: number) => void): Mesh {
  const H = simple ? 256 : 512;
  const W = Math.round((H * w) / d);
  const top = new MeshStandardMaterial({
    map: canvasTexture(
      W,
      H,
      (c) => {
        c.fillStyle = '#18191b';
        c.fillRect(0, 0, W, H);
        paint(c, W, H);
      },
      true,
    ),
    metalness: 0.15,
    roughness: 0.5,
    envMapIntensity: 0.55,
  });
  return box(w, 0.16, d, [mats.edge, mats.edge, top, mats.mask, mats.edge, mats.edge]);
}

function goldRow(mats: Materials, n: number, startX: number, stepX: number, z: number, y: number, size: number): InstancedMesh {
  const geo = new BoxGeometry(size, 0.012, size * 1.5);
  const inst = shadowed(new InstancedMesh(geo, mats.gold, n), false);
  const m = new Matrix4();
  for (let i = 0; i < n; i++) {
    m.setPosition(startX + i * stepX, y, z);
    inst.setMatrixAt(i, m);
  }
  return inst;
}

function headerStrip(mats: Materials, n: number, startX: number, stepX: number, z: number): Group {
  const g = new Group();
  g.add(box(n * stepX, 0.2, stepX * 0.92, mats.header, startX + ((n - 1) * stepX) / 2, 0.16, z));
  const inst = shadowed(new InstancedMesh(new BoxGeometry(0.06, 0.2, 0.06), mats.gold, n), false);
  const m = new Matrix4();
  for (let i = 0; i < n; i++) {
    m.setPosition(startX + i * stepX, 0.42, z);
    inst.setMatrixAt(i, m);
  }
  g.add(inst);
  return g;
}

function ring(mats: Materials, x: number, z: number): Mesh {
  const m = new Mesh(new CylinderGeometry(0.15, 0.15, 0.012, 20), mats.gold);
  m.position.set(x, 0.168, z);
  return m;
}

function microConnector(mats: Materials, x: number, z: number, rot = 0): Group {
  const g = new Group();
  g.add(box(0.62, 0.3, 0.34, mats.connector, 0, 0.16, 0));
  g.add(box(0.44, 0.2, 0.05, mats.plastic, 0, 0.21, 0.16));
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  return g;
}

export interface Layer {
  readonly obj: Object3D;
  readonly base: Vector3;
  readonly lift: Vector3;
}

export interface Part {
  readonly id: PartId;
  readonly root: Group;
  readonly home: Vector3;
  readonly spread: Vector3;
  readonly layers: readonly Layer[];
}

function layer(obj: Object3D, lift: number): Layer {
  return { obj, base: obj.position.clone(), lift: new Vector3(0, lift, 0) };
}

function buildEsp(mats: Materials, rand: () => number, simple: boolean): Part {
  const root = new Group();
  const w = 7;
  const d = 2.7;
  root.add(
    pcb(mats, w, d, simple, (c, W, H) => {
      traces(c, W, H, rand);
      silk(c, 'ESP32-S3 DevKit', W * 0.64, H * 0.74, 44);
      silk(c, 'CH9102', W * 0.82, H * 0.3, 30);
      silk(c, 'μŠup', W * 0.436, H * 0.6, 28, 'center');
    }),
  );

  const smd = new Group();
  const smdGeo = new BoxGeometry(0.16, 0.08, 0.09);
  for (const [mat, n] of [[mats.smdDark, 14], [mats.smdTan, 16]] as const) {
    const inst = shadowed(new InstancedMesh(smdGeo, mat, n), false);
    const m = new Matrix4();
    for (let i = 0; i < n; i++) {
      m.setPosition(0.2 + rand() * 2.9, 0.2, -0.75 + rand() * 1.5);
      inst.setMatrixAt(i, m);
    }
    smd.add(inst);
  }
  smd.add(box(0.6, 0.12, 0.6, mats.smdDark, 2.45, 0.16, -0.42));
  smd.add(box(0.75, 0.42, 0.7, mats.steel, 0.5, 0.16, 0.5));
  root.add(smd);

  const can = new Group();
  const canTop = new MeshStandardMaterial({
    map: canvasTexture(
      384,
      320,
      (c) => {
        c.fillStyle = '#b8bbbe';
        c.fillRect(0, 0, 384, 320);
        c.fillStyle = 'rgba(34,34,36,0.86)';
        c.font = '600 30px "JetBrains Mono Variable", ui-monospace, monospace';
        c.textAlign = 'center';
        c.fillText('ESP32-S3', 192, 130);
        c.fillText('WROOM-1', 192, 172);
        c.fillText('N16', 192, 214);
      },
      true,
    ),
    metalness: 0.92,
    roughness: 0.44,
    envMapIntensity: 0.62,
  });
  can.add(box(1.9, 0.32, 1.6, [mats.steel, mats.steel, canTop, mats.steel, mats.steel, mats.steel], -1.55, 0.16, 0));
  can.add(box(0.72, 0.06, 1.6, mats.mask, -2.86, 0.16, 0));
  root.add(can);

  root.add(goldRow(mats, 22, -3.2, 0.3, -1.22, 0.166, 0.14));
  root.add(goldRow(mats, 22, -3.2, 0.3, 1.22, 0.166, 0.14));
  root.add(headerStrip(mats, 20, -2.85, 0.3, -1.22));
  root.add(headerStrip(mats, 20, -2.85, 0.3, 1.22));

  root.add(box(0.72, 0.3, 0.9, mats.steel, 3.3, 0.16, 0));
  root.add(microConnector(mats, -0.45, 0.86));

  const home = new Vector3(-0.1, 0, -3.8);
  root.position.copy(home);
  root.rotation.y = 0.012;
  return {
    id: 'esp',
    root,
    home,
    spread: new Vector3(0.1, 0, 3.8),
    layers: [layer(can, 0.7)],
  };
}

export interface OledPart extends Part {
  readonly displayPlane: Mesh;
}

function buildOled(mats: Materials, rand: () => number, screen: Texture, simple: boolean): OledPart {
  const root = new Group();
  const w = 4.1;
  const d = 3.8;
  root.add(
    pcb(mats, w, d, simple, (c, W, H) => {
      traces(c, W, H, rand);
      silk(c, 'OLED 1.3" I2C  SH1106', W * 0.5, H * 0.915, 30, 'center');
    }),
  );
  for (const [x, z] of [[-1.8, -1.65], [1.8, -1.65], [-1.8, 1.65], [1.8, 1.65]] as const) root.add(ring(mats, x, z));
  root.add(goldRow(mats, 4, -0.45, 0.3, -1.68, 0.166, 0.14));
  root.add(microConnector(mats, -1.4, -1.62));
  root.add(microConnector(mats, 1.4, -1.62));

  const panel = new Group();
  panel.add(box(3.7, 0.12, 2.5, mats.glass, 0, 0.16, 0));
  const screenMat = new MeshBasicMaterial({
    map: screen,
    color: new Color(1.35, 1.35, 1.35),
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const displayPlane = new Mesh(new PlaneGeometry(3.3, 1.65), screenMat);
  displayPlane.rotation.x = -Math.PI / 2;
  displayPlane.position.set(0, 0.285, -0.06);
  displayPlane.renderOrder = 2;
  panel.add(displayPlane);
  root.add(panel);

  const home = new Vector3(-1.75, 0, 0.05);
  root.position.copy(home);
  root.rotation.y = -0.015;
  return {
    id: 'oled',
    root,
    home,
    spread: new Vector3(1.75, 2.5, -0.05),
    layers: [layer(panel, 0.6)],
    displayPlane,
  };
}

export interface EncoderPart extends Part {
  readonly knob: Group;
}

function knobShape(lobes: number, r: number, dr: number): Shape {
  const s = new Shape();
  const n = lobes * 8;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rad = r + dr * Math.cos(a * lobes);
    const x = Math.cos(a) * rad;
    const y = Math.sin(a) * rad;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  return s;
}

function buildEncoder(mats: Materials, rand: () => number, simple: boolean): EncoderPart {
  const root = new Group();
  const w = 3.2;
  const d = 3.4;
  root.add(
    pcb(mats, w, d, simple, (c, W, H) => {
      traces(c, W, H, rand);
      ['S1', 'S2', 'Key', '5V', 'GND'].forEach((t, i) => {
        silk(c, t, W * (0.5 + (-0.6 + i * 0.3) / w), H * 0.82, 21, 'center');
      });
    }),
  );
  root.add(goldRow(mats, 5, -0.6, 0.3, 1.45, 0.166, 0.14));
  const can = new Group();
  can.add(box(1.5, 0.62, 1.5, mats.steel, 0, 0.16, -0.25));
  can.add(shadowed(new Mesh(new CylinderGeometry(0.4, 0.4, 0.3, 28), mats.steel)));
  (can.children[1] as Mesh).position.set(0, 0.92, -0.25);
  root.add(can);

  const knob = new Group();
  const skirt = shadowed(
    new Mesh(
      new ExtrudeGeometry(knobShape(26, 0.74, 0.022), { depth: 0.72, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.05, bevelSegments: 2, curveSegments: 2 }),
      mats.plastic,
    ),
  );
  skirt.rotation.x = -Math.PI / 2;
  knob.add(skirt);
  const cap = new Mesh(new CylinderGeometry(0.58, 0.58, 0.02, 48), new MeshStandardMaterial({ color: 0x2c2d31, metalness: 0.1, roughness: 0.6 }));
  cap.position.y = 0.795;
  knob.add(cap);
  const mark = new Mesh(new BoxGeometry(0.06, 0.022, 0.34), new MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.5 }));
  mark.position.set(0, 0.808, -0.34);
  knob.add(mark);
  knob.position.set(0, 1.0, -0.25);
  root.add(knob);

  const home = new Vector3(2.75, 0, 0.05);
  root.position.copy(home);
  root.rotation.y = 0.02;
  return {
    id: 'enc',
    root,
    home,
    spread: new Vector3(-2.75, 4.9, -0.05),
    layers: [layer(can, 0.42), layer(knob, 1.05)],
    knob,
  };
}

export interface PadPart {
  readonly mesh: Mesh;
  readonly root: Group;
  readonly home: Vector3;
  readonly spread: Vector3;
  readonly mat: MeshStandardMaterial;
}

const PAD_SIZE = 1.14;

function buildPads(mats: Materials, rand: () => number): PadPart[] {
  const shape = roundedRect(PAD_SIZE, PAD_SIZE, 0.12);
  const geo = new ExtrudeGeometry(shape, { depth: 0.024, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 6 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0.012, 0);
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.7 + 0.5, uv.getY(i) * 0.7 + 0.5);
  uv.needsUpdate = true;

  return Array.from({ length: 6 }, (_, i) => {
    const root = new Group();
    const mat = mats.copper[i] as MeshStandardMaterial;
    const mesh = shadowed(new Mesh(geo, mat));
    root.add(mesh);
    const blob = new Mesh(new SphereGeometry(0.09, 12, 8), mats.solder);
    blob.scale.y = 0.45;
    blob.position.set(0.32, 0.05, -0.38);
    root.add(blob);
    const home = new Vector3(-3.75 + i * 1.5, 0, 3.5);
    root.position.copy(home);
    root.rotation.y = (rand() - 0.5) * 0.05;
    const spread = new Vector3(0, 8.3 + (i % 2) * 0.22, -3.5);
    return { mesh, root, home, spread, mat };
  });
}

/* ---------- Vodiče ---------- */

const WIRE_COLORS = { red: 0x9c3a33, black: 0x2a2a2c, green: 0x47705a, blue: 0x3d5f8c, amber: 0xb07a3a, grey: 0x7c7a74 } as const;

type P3 = readonly [number, number, number];

function wire(points: readonly P3[], color: number, radius: number, tubular: number, radial: number): Mesh {
  const curve = new CatmullRomCurve3(points.map(([x, y, z]) => new Vector3(x, y, z)), false, 'centripetal');
  const mat = new MeshStandardMaterial({ color, metalness: 0, roughness: 0.62 });
  return shadowed(new Mesh(new TubeGeometry(curve, tubular, radius, radial, false), mat));
}

/** Svazek vede kanálem mezi OLED a enkodérem, takže nekříží žádný popisek na DPS. */
function padWirePath(i: number): P3[] {
  const x = -3.75 + i * 1.5 + 0.32;
  const lane = 0.48 + i * 0.09;
  return [
    [x, 0.06, 3.12],
    [x + (lane - x) * 0.18, 0.14, 2.74],
    [x + (lane - x) * 0.82, 0.16, 2.42],
    [lane, 0.16, 1.7],
    [lane, 0.16, -1.2],
    [lane + (-0.25 + i * 0.3 - lane) * 0.7, 0.34, -2.2],
    [-0.25 + i * 0.3, 0.6, -2.58],
  ];
}

function buildWires(simple: boolean): Group {
  const g = new Group();
  const tubular = simple ? 14 : 36;
  const radial = simple ? 3 : 6;

  // Kabel μŠup: krátce z konektoru desky rovnou do OLED
  const usup: readonly number[] = [WIRE_COLORS.black, WIRE_COLORS.red, WIRE_COLORS.blue, WIRE_COLORS.amber];
  usup.forEach((color, i) => {
    const o = i * 0.07;
    g.add(
      wire(
        [
          [-0.66 + o, 0.34, -2.78],
          [-0.62 + o, 0.5, -2.4],
          [-0.5 + o, 0.42, -2.05],
          [-0.46 + o, 0.34, -1.74],
        ],
        color,
        0.03,
        tubular,
        radial,
      ),
    );
  });

  // Enkodér: pět vodičů vede pod modulem, popisky vývodů zůstávají volné
  const enc: readonly number[] = [WIRE_COLORS.red, WIRE_COLORS.black, WIRE_COLORS.green, WIRE_COLORS.blue, WIRE_COLORS.amber];
  const encWires = simple ? [0, 2, 4] : [0, 1, 2, 3, 4];
  encWires.forEach((i) => {
    const x = 2.15 + i * 0.3;
    const target = 1.55 + i * 0.3;
    g.add(
      wire(
        [
          [x, 0.2, 1.5],
          [x, 0.16, 1.82],
          [x, 0.03, 1.74],
          [x, 0.02, 0],
          [x + (target - x) * 0.7, 0.03, -1.72],
          [target, 0.3, -2.2],
          [target, 0.6, -2.58],
        ],
        enc[i] ?? WIRE_COLORS.grey,
        0.034,
        tubular,
        radial,
      ),
    );
  });

  // Plošky: každá vlastní vodič, na mobilu každý druhý kvůli počtu vykreslení
  const padWires = simple ? [0, 2, 3, 5] : [0, 1, 2, 3, 4, 5];
  padWires.forEach((i) => g.add(wire(padWirePath(i), WIRE_COLORS.grey, 0.03, simple ? 20 : 48, radial)));
  return g;
}

/* ---------- Sestavení ---------- */

export interface DeckModel {
  readonly root: Group;
  readonly parts: readonly Part[];
  readonly oled: OledPart;
  readonly encoder: EncoderPart;
  readonly pads: readonly PadPart[];
  readonly wires: Group;
}

export function createScreenTexture(canvas: HTMLCanvasElement): CanvasTexture {
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.magFilter = LinearFilter;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  return t;
}

const nextTask = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));

/** Stavba je rozdělená do krátkých úloh, aby neblokovala hlavní vlákno. */
export async function buildDeck(screen: Texture, simple: boolean): Promise<DeckModel> {
  const mats = createMaterials(simple);
  await nextTask();
  const rand = mulberry(21);
  const root = new Group();
  const esp = buildEsp(mats, rand, simple);
  await nextTask();
  const oled = buildOled(mats, rand, screen, simple);
  await nextTask();
  const encoder = buildEncoder(mats, rand, simple);
  await nextTask();
  const pads = buildPads(mats, rand);
  const wires = buildWires(simple);
  await nextTask();
  root.add(esp.root, oled.root, encoder.root, wires);
  pads.forEach((p) => root.add(p.root));
  return { root, parts: [esp, oled, encoder], oled, encoder, pads, wires };
}
