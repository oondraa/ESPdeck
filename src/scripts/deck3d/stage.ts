/**
 * WebGL scéna. Jeden renderer se přesouvá mezi hostiteli (hero a sekce „Co je uvnitř“).
 * Canvas má pointer-events: none. Ovládání zajišťují malé HTML hotspoty nad modelem,
 * takže model neblokuje scroll ani kliknutí mimo sebe.
 */
import {
  ACESFilmicToneMapping,
  BackSide,
  Box3,
  BoxGeometry,
  Color,
  DirectionalLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  ShadowMaterial,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Object3D,
  type Texture,
} from 'three';
import type { DeckSim } from '../deck-sim';
import { explodeState, onExplode, type PartId } from './bus';
import { buildDeck, createScreenTexture, type DeckModel } from './model';

export type HostId = 'hero' | 'inside';

export interface StageHost {
  readonly id: HostId;
  readonly el: HTMLElement;
  readonly mount: HTMLElement;
}

export interface StageHandle {
  destroy(): void;
  capture(host: HostId, explode: number, width: number, height: number): string;
  corners(): readonly (readonly [number, number])[];
}

interface StageOptions {
  readonly simple: boolean;
  readonly dpr: number;
  readonly onReady: (id: HostId) => void;
  readonly onSlow: () => void;
  readonly skipGuard: boolean;
}

function studioEnvironment(renderer: WebGLRenderer): Texture {
  // Měkké softboxy v tmavém prostoru: odrazy na kovu bez neonu.
  const env = new Scene();
  env.add(new Mesh(new BoxGeometry(40, 40, 40), new MeshBasicMaterial({ color: 0x24211d, side: BackSide })));
  const panel = (w: number, h: number, c: number, i: number, x: number, y: number, z: number): void => {
    const col = new Color(c).multiplyScalar(i);
    const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: col, side: 2 }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel(22, 12, 0xfff6ea, 8, -4, 18, 3);
  panel(8, 22, 0xfff1e2, 3.4, -18, 7, 4);
  panel(10, 16, 0xe9eef5, 2.2, 18, 8, -2);
  panel(26, 4, 0xfff4e8, 2.6, 0, 7, 18);
  panel(36, 16, 0xfff0e2, 1.9, 0, 15, -16);
  const pmrem = new PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.03);
  pmrem.dispose();
  return rt.texture;
}

const nextTask = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));

interface Rect {
  l: number;
  t: number;
  r: number;
  b: number;
}

const overlaps = (a: Rect, b: Rect): boolean => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

/** Protíná úsečka obdélník? Stačí vzorkování, štítků je málo a úsečky krátké. */
function segmentHits(x1: number, y1: number, x2: number, y2: number, r: Rect): boolean {
  for (let i = 0; i <= 24; i++) {
    const k = i / 24;
    const x = x1 + (x2 - x1) * k;
    const y = y1 + (y2 - y1) * k;
    if (x > r.l && x < r.r && y > r.t && y < r.b) return true;
  }
  return false;
}

/** Pořadí rozkladu: nejdřív horní vrstva (plošky), jako poslední spodní (DevKit). */
const LAYER_DELAY: Readonly<Record<PartId, number>> = { pads: 0, enc: 0.1, oled: 0.2, esp: 0.3 };
const TAG_IDS: readonly PartId[] = ['esp', 'oled', 'enc', 'pads'];
const TAN_HALF_FOV = Math.tan((24 * Math.PI) / 360);

const easeSpread = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export async function createStage(sim: DeckSim, hosts: readonly StageHost[], opts: StageOptions): Promise<StageHandle> {
  const renderer = new WebGLRenderer({ antialias: !opts.simple, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.setPixelRatio(opts.dpr);
  const canvas = renderer.domElement;
  canvas.className = 'stage-canvas';
  canvas.setAttribute('aria-hidden', 'true');

  await nextTask();
  const scene = new Scene();
  const envTex = studioEnvironment(renderer);
  await nextTask();

  const key = new DirectionalLight(0xfff3e6, 1.5);
  key.position.set(-9, 24, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(opts.simple ? 512 : 2048, opts.simple ? 512 : 2048);
  key.shadow.radius = opts.simple ? 4 : 7;
  key.shadow.bias = -0.0006;
  const sc = key.shadow.camera;
  sc.left = -11;
  sc.right = 11;
  sc.top = 11;
  sc.bottom = -11;
  sc.far = 60;
  scene.add(key);

  const floor = new Mesh(new PlaneGeometry(60, 60), new ShadowMaterial({ opacity: 0.32 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.002;
  floor.receiveShadow = true;
  scene.add(floor);

  const screenTex = createScreenTexture(sim.canvas);
  const model: DeckModel = await buildDeck(screenTex, opts.simple);
  scene.add(model.root);
  // Intenzitu odrazů řídí materiál, a to Three.js umí jen s envMap přímo na materiálu.
  model.root.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (m instanceof MeshStandardMaterial) {
        m.envMap = envTex;
        m.needsUpdate = true;
      }
    }
  });

  const camera = new PerspectiveCamera(24, 4 / 3, 1, 120);
  const lookAt = new Vector3();
  // Shadery se překládají mimo hlavní vlákno, kde to prohlížeč umí.
  await renderer.compileAsync(scene, camera);
  await nextTask();

  /* ---------- Stav ---------- */

  let active: StageHost | null = null;
  let running = false;
  let raf = 0;
  let dirty = true;
  let knobAngle = 0;
  let knobTarget = 0;
  let knobPress = 0;
  let knobPressTarget = 0;
  const padDown = [0, 0, 0, 0, 0, 0];
  const padTarget = [0, 0, 0, 0, 0, 0];
  let parallaxX = 0;
  let parallaxY = 0;
  let parallaxTX = 0;
  let parallaxTY = 0;
  let frames = 0;
  let renderMs = 0;
  let guarded = !opts.skipGuard;
  const readyFired = new Set<HostId>();
  const lastCorners: [number, number][] = [];
  const tagSlot = new Map<PartId, number>();

  const invalidate = (): void => {
    dirty = true;
    if (running && raf === 0) raf = requestAnimationFrame(loop);
  };

  const size = (): void => {
    if (!active) return;
    const w = active.mount.clientWidth;
    const h = active.mount.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    invalidate();
  };

  const layerAmount = (id: PartId, p: number): number =>
    easeSpread(Math.min(1, Math.max(0, (p - LAYER_DELAY[id]) / 0.7)));

  const pose = (p: number): void => {
    model.wires.visible = p < 0.02;
    for (const part of model.parts) {
      const e = layerAmount(part.id, p);
      part.root.position.copy(part.home).addScaledVector(part.spread, e);
      for (const l of part.layers) l.obj.position.copy(l.base).addScaledVector(l.lift, e);
    }
    const e = layerAmount('pads', p);
    model.pads.forEach((pad) => pad.root.position.copy(pad.home).addScaledVector(pad.spread, e));
  };

  const heroDistance = (): number => (camera.aspect < 1.15 ? 26.8 : 20.96);

  /** Vzdálenost, ze které se rozložený sloupec vejde na výšku i na šířku. */
  const fitDistance = (): number => Math.max(14 / (2 * TAN_HALF_FOV), 12.5 / (2 * TAN_HALF_FOV * camera.aspect));

  const orbit = (azimuth: number, elevation: number, distance: number): void => {
    camera.position.set(
      lookAt.x + Math.sin(azimuth) * Math.cos(elevation) * distance,
      lookAt.y + Math.sin(elevation) * distance,
      lookAt.z + Math.cos(azimuth) * Math.cos(elevation) * distance,
    );
    camera.lookAt(lookAt);
  };

  const placeCamera = (id: HostId, explode: number, travel: number): void => {
    if (id === 'hero') {
      const scale = heroDistance() / 20.96;
      key.shadow.intensity = 1;
      lookAt.set(0, 0, -0.05);
      camera.position.set(parallaxX * 0.9, 16.6 * scale - parallaxY * 0.35, 12.8 * scale);
      camera.lookAt(lookAt);
      return;
    }
    const e = easeSpread(explode);
    // Vrstvy nad sebou by si navzájem stínily, proto stín s rozkladem slábne.
    key.shadow.intensity = 1 - 0.85 * e;
    // Z pohledu shora se kamera plynule sklopí a pak pomalu stoupá podél sloupce vrstev.
    lookAt.set(0, e * (3.9 + (travel - 0.5) * 1.4), -0.05 * (1 - e));
    orbit(-0.4 * e, 0.914 + (0.42 - 0.914) * e, heroDistance() + (fitDistance() - heroDistance()) * e);
  };

  /* ---------- Hotspoty a popisky ---------- */

  const v = new Vector3();
  const project = (world: Vector3, host: StageHost): { x: number; y: number } => {
    v.copy(world).project(camera);
    return { x: ((v.x + 1) / 2) * host.mount.clientWidth, y: ((1 - v.y) / 2) * host.mount.clientHeight };
  };
  const world = new Vector3();

  const layoutHotspots = (): void => {
    if (!active || active.id !== 'hero') return;
    active.el.querySelectorAll<HTMLElement>('[data-hot-pad]').forEach((el) => {
      const i = Number(el.dataset.hotPad);
      const pad = model.pads[i];
      if (!pad) return;
      pad.root.getWorldPosition(world);
      const c = project(world, active as StageHost);
      world.x += 0.57;
      const edge = project(world, active as StageHost);
      const size = Math.max(32, Math.abs(edge.x - c.x) * 2.3);
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.transform = `translate3d(${c.x - size / 2}px, ${c.y - size / 2}px, 0)`;
    });
    const knob = active.el.querySelector<HTMLElement>('[data-hot-knob]');
    if (knob) {
      model.encoder.knob.getWorldPosition(world);
      world.y += 0.75;
      const c = project(world, active);
      world.x += 0.78;
      const edge = project(world, active);
      const size = Math.max(52, Math.abs(edge.x - c.x) * 2.4);
      knob.style.width = `${size}px`;
      knob.style.height = `${size}px`;
      knob.style.transform = `translate3d(${c.x - size / 2}px, ${c.y - size / 2}px, 0)`;
    }
  };

  const box = new Box3();
  const corner = new Vector3();

  const screenRect = (objects: readonly Object3D[], host: StageHost): Rect => {
    const rect: Rect = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity };
    for (const obj of objects) {
      box.setFromObject(obj);
      for (let i = 0; i < 8; i++) {
        corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
        const c = project(corner, host);
        rect.l = Math.min(rect.l, c.x);
        rect.t = Math.min(rect.t, c.y);
        rect.r = Math.max(rect.r, c.x);
        rect.b = Math.max(rect.b, c.y);
      }
    }
    return rect;
  };

  const layoutTags = (): void => {
    if (!active || active.id !== 'inside') return;
    const host = active;
    const W = host.mount.clientWidth;
    const H = host.mount.clientHeight;
    const reveal = explodeState.progress > 0.62;
    const rects = new Map<PartId, Rect>();
    if (reveal) {
      for (const part of model.parts) rects.set(part.id, screenRect([part.root], host));
      rects.set('pads', screenRect(model.pads.map((p) => p.root), host));
    }
    const placed: Rect[] = [];
    const GAP = 16;
    const MARGIN = 6;

    for (const id of TAG_IDS) {
      const el = host.el.querySelector<HTMLElement>(`[data-tag="${id}"]`);
      const line = host.el.querySelector<SVGLineElement>(`[data-leader="${id}"]`);
      if (!el || !line) continue;
      const target = rects.get(id);
      let done = false;
      if (reveal && target) {
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        const cy = (target.t + target.b) / 2 - h / 2;
        const cx = (target.l + target.r) / 2 - w / 2;
        const slots: readonly (readonly [number, number])[] = [
          [target.r + GAP, cy],
          [target.l - GAP - w, cy],
          [target.r + GAP, target.t],
          [target.l - GAP - w, target.t],
          [target.r + GAP, target.b - h],
          [target.l - GAP - w, target.b - h],
          [cx, target.t - GAP - h],
          [cx, target.b + GAP],
        ];
        // Předchozí poloha má přednost, aby štítek při scrollu nepřeskakoval.
        const prev = tagSlot.get(id);
        const order = prev === undefined ? slots.map((_, i) => i) : [prev, ...slots.map((_, i) => i).filter((i) => i !== prev)];
        for (const i of order) {
          const [x, y] = slots[i] as readonly [number, number];
          const r: Rect = { l: x, t: y, r: x + w, b: y + h };
          if (r.l < MARGIN || r.t < MARGIN || r.r > W - MARGIN || r.b > H - MARGIN) continue;
          const pad = 4;
          const grown: Rect = { l: r.l - pad, t: r.t - pad, r: r.r + pad, b: r.b + pad };
          if ([...rects.values()].some((other) => overlaps(grown, other))) continue;
          if (placed.some((other) => overlaps(grown, other))) continue;
          const tx = Math.max(r.l, Math.min(r.r, (target.l + target.r) / 2));
          const ty = Math.max(r.t, Math.min(r.b, (target.t + target.b) / 2));
          const ex = Math.max(target.l, Math.min(target.r, tx));
          const ey = Math.max(target.t, Math.min(target.b, ty));
          let blocked = false;
          for (const [otherId, other] of rects) {
            if (otherId !== id && segmentHits(tx, ty, ex, ey, other)) blocked = true;
          }
          if (blocked || placed.some((other) => segmentHits(tx, ty, ex, ey, other))) continue;
          el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
          line.setAttribute('x1', String(tx));
          line.setAttribute('y1', String(ty));
          line.setAttribute('x2', String(ex));
          line.setAttribute('y2', String(ey));
          placed.push(r);
          tagSlot.set(id, i);
          done = true;
          break;
        }
      }
      // Když se štítek nikam nevejde, schová se. Stejný údaj je v seznamu vedle scény.
      el.toggleAttribute('data-on', done);
      el.toggleAttribute('data-active', done && explodeState.active === id);
      line.toggleAttribute('data-on', done);
    }
  };

  /* ---------- Smyčka ---------- */

  const damp = (cur: number, target: number, k: number): number =>
    Math.abs(target - cur) < 0.0006 ? target : cur + (target - cur) * k;

  function loop(): void {
    raf = 0;
    if (!running || !active) return;
    const prevKnob = knobAngle;
    knobAngle = damp(knobAngle, knobTarget, 0.3);
    knobPress = damp(knobPress, knobPressTarget, 0.4);
    let moving = knobAngle !== prevKnob || knobPress !== knobPressTarget;
    model.encoder.knob.rotation.y = -knobAngle;

    model.pads.forEach((pad, i) => {
      const cur = padDown[i] ?? 0;
      const target = padTarget[i] ?? 0;
      const next = damp(cur, target, 0.45);
      padDown[i] = next;
      if (next !== target) moving = true;
      pad.mesh.position.y = -next * 0.006;
      pad.mat.color.setScalar(1 - next * 0.32);
      pad.mat.envMapIntensity = 0.9 + next * 0.5;
    });

    const prevX = parallaxX;
    parallaxX = damp(parallaxX, parallaxTX, 0.1);
    parallaxY = damp(parallaxY, parallaxTY, 0.1);
    if (parallaxX !== prevX || parallaxX !== parallaxTX || parallaxY !== parallaxTY) moving = true;

    if (dirty || moving) {
      dirty = false;
      pose(active.id === 'inside' ? explodeState.progress : 0);
      model.encoder.knob.position.y -= knobPress * 0.09;
      placeCamera(active.id, explodeState.progress, explodeState.travel);
      const t0 = performance.now();
      renderer.render(scene, camera);
      const spent = performance.now() - t0;
      layoutHotspots();
      layoutTags();
      if (!readyFired.has(active.id)) {
        readyFired.add(active.id);
        opts.onReady(active.id);
      }
      if (guarded) {
        frames++;
        if (frames > 3) renderMs += spent;
        if (frames === 15) {
          guarded = false;
          if (renderMs / 12 > 36) opts.onSlow();
        }
      }
    }
    if (moving) raf = requestAnimationFrame(loop);
  }

  /* ---------- Hostitelé ---------- */

  const attach = (host: StageHost | null): void => {
    if (active === host) return;
    active = host;
    if (host) {
      host.mount.appendChild(canvas);
      size();
      resume();
    } else {
      pause();
    }
  };

  const resume = (): void => {
    if (running || !active || document.hidden) return;
    running = true;
    sim.start();
    invalidate();
  };

  const pause = (): void => {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    sim.stop();
  };

  const ratios = new Map<HostId, number>();
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        const id = (en.target as HTMLElement).dataset.stageHost as HostId;
        ratios.set(id, en.isIntersecting ? en.intersectionRatio : 0);
      }
      let best: StageHost | null = null;
      let bestR = 0;
      for (const h of hosts) {
        const r = ratios.get(h.id) ?? 0;
        if (r > bestR) {
          bestR = r;
          best = h;
        }
      }
      attach(best);
    },
    { threshold: [0, 0.05, 0.2, 0.5, 0.8, 1] },
  );
  hosts.forEach((h) => io.observe(h.el));

  const ro = new ResizeObserver(size);
  hosts.forEach((h) => ro.observe(h.mount));

  const onVisibility = (): void => {
    if (document.hidden) pause();
    else resume();
  };
  document.addEventListener('visibilitychange', onVisibility);

  const offFrame = sim.onFrame(() => {
    screenTex.needsUpdate = true;
    invalidate();
  });
  const offExplode = onExplode(invalidate);

  /* ---------- Vstupy z hotspotů ---------- */

  const ac = new AbortController();
  const { signal } = ac;
  const STEP = (Math.PI * 2) / 20;
  const heroHost = hosts.find((h) => h.id === 'hero');

  const capture = (el: HTMLElement, id: number): void => {
    try {
      el.setPointerCapture(id);
    } catch {
      /* ukazatel už neexistuje, stav uvolní pointerup */
    }
  };

  if (heroHost) {
    heroHost.el.querySelectorAll<HTMLElement>('[data-hot-pad]').forEach((el) => {
      const i = Number(el.dataset.hotPad);
      const set = (down: boolean): void => {
        padTarget[i] = down ? 1 : 0;
        sim.touch(i, down);
        invalidate();
      };
      el.addEventListener('pointerdown', (e) => {
        capture(el, e.pointerId);
        set(true);
      }, { signal });
      el.addEventListener('pointerup', () => set(false), { signal });
      el.addEventListener('pointercancel', () => set(false), { signal });
    });

    const knob = heroHost.el.querySelector<HTMLElement>('[data-hot-knob]');
    if (knob) {
      let last = 0;
      let acc = 0;
      let moved = false;
      let id: number | null = null;
      const angle = (e: PointerEvent): number => {
        const r = knob.getBoundingClientRect();
        return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
      };
      knob.addEventListener('pointerdown', (e) => {
        id = e.pointerId;
        capture(knob, e.pointerId);
        last = angle(e);
        acc = 0;
        moved = false;
        knobPressTarget = 1;
        sim.pressStart();
        invalidate();
      }, { signal });
      knob.addEventListener('pointermove', (e) => {
        if (id !== e.pointerId) return;
        const a = angle(e);
        let d = a - last;
        if (d > 180) d -= 360;
        if (d < -180) d += 360;
        last = a;
        acc += d;
        const steps = Math.trunc(acc / 18);
        if (steps !== 0) {
          if (!moved) sim.pressEnd(true);
          moved = true;
          knobPressTarget = 0;
          acc -= steps * 18;
          knobTarget += steps * STEP;
          sim.turn(steps);
          invalidate();
        }
      }, { signal });
      const end = (e: PointerEvent): void => {
        if (id !== e.pointerId) return;
        id = null;
        knobPressTarget = 0;
        sim.pressEnd(moved);
        invalidate();
      };
      knob.addEventListener('pointerup', end, { signal });
      knob.addEventListener('pointercancel', end, { signal });
    }

    if (window.matchMedia('(pointer: fine)').matches) {
      heroHost.el.addEventListener('pointermove', (e) => {
        const r = heroHost.el.getBoundingClientRect();
        parallaxTX = ((e.clientX - r.left) / r.width - 0.5) * 2;
        parallaxTY = ((e.clientY - r.top) / r.height - 0.5) * 2;
        invalidate();
      }, { signal, passive: true });
      heroHost.el.addEventListener('pointerleave', () => {
        parallaxTX = 0;
        parallaxTY = 0;
        invalidate();
      }, { signal, passive: true });
    }
  }

  // Ovládací lišta pod modelem pohybuje stejnými díly.
  const syncFromRail = (e: Event): void => {
    const d = (e as CustomEvent<{ kind: string; i?: number; down?: boolean; d?: number }>).detail;
    if (d.kind === 'pad' && d.i !== undefined) padTarget[d.i] = d.down ? 1 : 0;
    if (d.kind === 'turn' && d.d !== undefined) knobTarget += d.d * STEP;
    if (d.kind === 'press') knobPressTarget = d.down ? 1 : 0;
    invalidate();
  };
  window.addEventListener('espdeck:rail', syncFromRail, { signal });

  return {
    destroy(): void {
      ac.abort();
      pause();
      io.disconnect();
      ro.disconnect();
      offFrame();
      offExplode();
      document.removeEventListener('visibilitychange', onVisibility);
      renderer.dispose();
      envTex.dispose();
      canvas.remove();
    },
    capture(hostId, explode, width, height): string {
      const prevActive = active;
      const prevRatio = renderer.getPixelRatio();
      renderer.setPixelRatio(1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      pose(explode);
      parallaxX = 0;
      parallaxY = 0;
      placeCamera(hostId, explode, 0.5);
      // Na statickém obrázku nesmí být konkrétní čas, displej je zhasnutý.
      const plane = model.oled.displayPlane;
      plane.visible = false;
      renderer.render(scene, camera);
      const url = canvas.toDataURL('image/png');
      plane.visible = true;
      plane.updateWorldMatrix(true, false);
      lastCorners.length = 0;
      for (const [x, y] of [[-1.65, 0.825], [1.65, 0.825], [1.65, -0.825], [-1.65, -0.825]] as const) {
        corner.set(x, y, 0).applyMatrix4(plane.matrixWorld).project(camera);
        lastCorners.push([(corner.x + 1) / 2, (1 - corner.y) / 2]);
      }
      renderer.setPixelRatio(prevRatio);
      active = prevActive;
      size();
      return url;
    },
    corners: () => lastCorners,
  };
}
