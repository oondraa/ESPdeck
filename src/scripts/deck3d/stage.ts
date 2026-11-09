/**
 * WebGL scéna. Jeden renderer se přesouvá mezi hostiteli (hero a sekce „Co je uvnitř“).
 * Canvas má pointer-events: none. Ovládání zajišťují malé HTML hotspoty nad modelem,
 * takže model neblokuje scroll ani kliknutí mimo sebe.
 */
import {
  ACESFilmicToneMapping,
  BackSide,
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

const PART_FOCUS: Readonly<Record<PartId, Vector3>> = {
  esp: new Vector3(0, 0.6, -2.4),
  oled: new Vector3(-1.9, 1.2, -0.2),
  enc: new Vector3(2.2, 1.2, 0),
  pads: new Vector3(0, 0.4, 2),
};

const easeSpread = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export function createStage(sim: DeckSim, hosts: readonly StageHost[], opts: StageOptions): StageHandle {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
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

  const scene = new Scene();
  const envTex = studioEnvironment(renderer);

  const key = new DirectionalLight(0xfff3e6, 1.5);
  key.position.set(-6, 15, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(opts.simple ? 1024 : 2048, opts.simple ? 1024 : 2048);
  key.shadow.radius = 7;
  key.shadow.bias = -0.0006;
  const sc = key.shadow.camera;
  sc.left = -11;
  sc.right = 11;
  sc.top = 11;
  sc.bottom = -11;
  sc.far = 40;
  scene.add(key);

  const floor = new Mesh(new PlaneGeometry(60, 60), new ShadowMaterial({ opacity: 0.32 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.002;
  floor.receiveShadow = true;
  scene.add(floor);

  const screenTex = createScreenTexture(sim.canvas);
  const model: DeckModel = buildDeck(screenTex, opts.simple);
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

  const camera = new PerspectiveCamera(24, 4 / 3, 1, 90);
  const lookAt = new Vector3();

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
  let readyFired = new Set<HostId>();

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

  const applyExplode = (): void => {
    const p = active?.id === 'inside' ? easeSpread(explodeState.progress) : 0;
    model.wires.visible = p < 0.03;
    for (const part of model.parts) {
      part.root.position.copy(part.home).addScaledVector(part.spread, p);
      for (const l of part.layers) l.obj.position.copy(l.base).addScaledVector(l.lift, p);
    }
    model.pads.forEach((pad) => pad.root.position.copy(pad.home).addScaledVector(pad.spread, p));
  };

  const placeCamera = (id: HostId, explode: number, focus: PartId | null): void => {
    const narrow = camera.aspect < 1.15;
    const distance = narrow ? 1.28 : 1;
    if (id === 'hero') {
      camera.position.set(parallaxX * 0.9, 16.6 * distance - parallaxY * 0.35, 12.8 * distance);
      lookAt.set(0, 0, -0.05);
    } else {
      const e = easeSpread(explode);
      camera.position.set(0.8 * e, (16.6 + 4.8 * e) * distance, (12.8 + 6.8 * e) * distance);
      lookAt.set(0, 0.9 * e, 0.1);
      if (focus) lookAt.lerp(PART_FOCUS[focus], 0.28);
    }
    camera.lookAt(lookAt);
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

  const layoutTags = (): void => {
    if (!active || active.id !== 'inside') return;
    const host = active;
    const reveal = explodeState.progress > 0.08;
    host.el.querySelectorAll<HTMLElement>('[data-tag]').forEach((el) => {
      const id = el.dataset.tag as PartId;
      if (id === 'pads') {
        const a = model.pads[2];
        if (!a) return;
        a.root.getWorldPosition(world);
      } else {
        const part = model.parts.find((p) => p.id === id);
        if (!part) return;
        world.copy(part.anchor);
        part.root.localToWorld(world);
      }
      const c = project(world, host);
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const x = Math.max(6, Math.min(host.mount.clientWidth - w - 6, c.x - w / 2));
      const y = Math.max(6, Math.min(host.mount.clientHeight - h - 6, c.y - h - 8));
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      el.toggleAttribute('data-on', reveal && (explodeState.active === null || explodeState.active === id));
    });
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
    const knobBase = model.encoder.layers[1]?.base.y ?? 1;
    const lift = (model.encoder.layers[1]?.lift.y ?? 0) * (active.id === 'inside' ? easeSpread(explodeState.progress) : 0);
    model.encoder.knob.position.y = knobBase + lift - knobPress * 0.09;

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
      applyExplode();
      const focus = active.id === 'inside' ? explodeState.active : null;
      placeCamera(active.id, explodeState.progress, focus);
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
      const e = easeSpread(explode);
      model.wires.visible = e < 0.03;
      for (const part of model.parts) {
        part.root.position.copy(part.home).addScaledVector(part.spread, e);
        for (const l of part.layers) l.obj.position.copy(l.base).addScaledVector(l.lift, e);
      }
      model.pads.forEach((pad) => pad.root.position.copy(pad.home).addScaledVector(pad.spread, e));
      parallaxX = 0;
      parallaxY = 0;
      placeCamera(hostId, explode, null);
      renderer.render(scene, camera);
      const url = canvas.toDataURL('image/png');
      renderer.setPixelRatio(prevRatio);
      active = prevActive;
      size();
      return url;
    },
  };
}
