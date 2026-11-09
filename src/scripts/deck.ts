/**
 * Úvodní stránka: živý simulátor v hero, ovládací lišta, ukázky gest a rozhodnutí o 3D.
 * Three.js se načte až po dokončení stránky a jen na zařízeních, která ho utáhnou.
 */
import type { DemoAction } from '../data/espdeck';
import { DeckSim, formatEvent } from './deck-sim';

const PREFERS_REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface NetworkInfo {
  readonly saveData?: boolean;
}
interface DeviceNavigator extends Navigator {
  readonly deviceMemory?: number;
  readonly connection?: NetworkInfo;
}

function hasCapableGpu(): boolean {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
  if (!gl) return false;
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return !/swiftshader|llvmpipe|software|basic render/i.test(name);
}

function shouldUse3d(force: boolean): boolean {
  if (force) return true;
  if (PREFERS_REDUCED) return false;
  const nav = navigator as DeviceNavigator;
  if (nav.connection?.saveData === true) return false;
  if ((nav.deviceMemory ?? 8) <= 2 || navigator.hardwareConcurrency <= 2) return false;
  try {
    return hasCapableGpu();
  } catch {
    return false;
  }
}

function rail(detail: { kind: string; i?: number; down?: boolean; d?: number }): void {
  window.dispatchEvent(new CustomEvent('espdeck:rail', { detail }));
}

function bindRail(root: HTMLElement, sim: DeckSim, signal: AbortSignal): void {
  root.querySelectorAll<HTMLButtonElement>('[data-rail-pad]').forEach((btn) => {
    const i = Number(btn.dataset.railPad);
    const set = (down: boolean): void => {
      btn.setAttribute('aria-pressed', String(down));
      sim.touch(i, down);
      rail({ kind: 'pad', i, down });
    };
    btn.addEventListener('pointerdown', () => set(true), { signal });
    btn.addEventListener('pointerup', () => set(false), { signal });
    btn.addEventListener('pointercancel', () => set(false), { signal });
    btn.addEventListener('pointerleave', () => {
      if (btn.getAttribute('aria-pressed') === 'true') set(false);
    }, { signal });
    btn.addEventListener('keydown', (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
        e.preventDefault();
        set(true);
      }
    }, { signal });
    btn.addEventListener('keyup', (e) => {
      if (e.key === ' ' || e.key === 'Enter') set(false);
    }, { signal });
    btn.addEventListener('blur', () => {
      if (btn.getAttribute('aria-pressed') === 'true') set(false);
    }, { signal });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-rail-turn]').forEach((btn) => {
    const d = Number(btn.dataset.railTurn);
    btn.addEventListener('click', () => {
      sim.turn(d);
      rail({ kind: 'turn', d });
    }, { signal });
  });

  const press = root.querySelector<HTMLButtonElement>('[data-rail-press]');
  if (press) {
    const down = (): void => {
      sim.pressStart();
      rail({ kind: 'press', down: true });
    };
    const up = (cancel: boolean): void => {
      sim.pressEnd(cancel);
      rail({ kind: 'press', down: false });
    };
    press.addEventListener('pointerdown', down, { signal });
    press.addEventListener('pointerup', () => up(false), { signal });
    press.addEventListener('pointercancel', () => up(true), { signal });
    press.addEventListener('pointerleave', () => up(true), { signal });
    press.addEventListener('keydown', (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
        e.preventDefault();
        down();
      }
    }, { signal });
    press.addEventListener('keyup', (e) => {
      if (e.key === ' ' || e.key === 'Enter') up(false);
    }, { signal });
    press.addEventListener('blur', () => up(true), { signal });
  }
}

/* ---------- Ukázky gest v sekci „Co umí“ ---------- */

function initDemo(root: HTMLElement, signal: AbortSignal): void {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-demo-canvas]');
  const rows = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-demo]'));
  if (!canvas || rows.length === 0) return;
  const sim = new DeckSim(canvas);
  let timers: number[] = [];

  const clear = (): void => {
    timers.forEach((t) => window.clearTimeout(t));
    timers = [];
  };
  const later = (fn: () => void, ms: number): void => {
    timers.push(window.setTimeout(fn, ms));
  };

  const play = (action: DemoAction): void => {
    clear();
    if (sim.fw.screen !== 'clock' && action !== 'long') {
      sim.fw.longPress();
      sim.refresh();
    }
    const padPulse = (i: number): void => {
      sim.touch(i, true);
      later(() => sim.touch(i, false), 240);
    };
    switch (action) {
      case 'turn':
        sim.turn(4);
        later(() => sim.turn(3), 260);
        later(() => sim.turn(-2), 520);
        break;
      case 'press':
        sim.fw.press(performance.now());
        sim.refresh();
        break;
      case 'long':
        if (sim.fw.screen === 'clock') sim.fw.longPress();
        sim.fw.cursor = 0;
        sim.refresh();
        later(() => sim.turn(1), 500);
        later(() => sim.turn(1), 900);
        later(() => sim.turn(1), 1300);
        break;
      case 'light-on':
        padPulse(0);
        break;
      case 'light-off':
        padPulse(2);
        break;
      case 'shortcut':
        padPulse(1);
        break;
    }
  };

  const select = (btn: HTMLButtonElement): void => {
    rows.forEach((r) => r.setAttribute('aria-pressed', String(r === btn)));
    play((btn.dataset.demo ?? 'press') as DemoAction);
  };

  rows.forEach((btn) => {
    btn.addEventListener('click', () => select(btn), { signal });
    btn.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse') select(btn);
    }, { signal });
  });

  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) sim.start();
    else sim.stop();
  });
  io.observe(canvas);
  sim.refresh();
  signal.addEventListener('abort', () => {
    io.disconnect();
    clear();
    sim.destroy();
  });
}

/* ---------- Tok událostí v sekci „Jak to funguje“ ---------- */

function initFlow(root: HTMLElement, signal: AbortSignal): void {
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-flow]'));
  buttons.forEach((b) => {
    b.addEventListener('click', () => {
      buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      root.dataset.route = b.dataset.route ?? '';
      const out = root.querySelector('[data-flow-out]');
      const back = root.querySelector('[data-flow-back]');
      if (out) out.textContent = b.dataset.out ?? '';
      if (back) back.textContent = b.dataset.back ?? '';
      root.removeAttribute('data-run');
      void root.offsetWidth;
      root.setAttribute('data-run', '');
    }, { signal });
  });
}

/* ---------- Spuštění ---------- */

export function initDeck(): () => void {
  const ac = new AbortController();
  const { signal } = ac;

  const demo = document.querySelector<HTMLElement>('[data-demo-root]');
  if (demo) initDemo(demo, signal);
  const flow = document.querySelector<HTMLElement>('[data-flow-root]');
  if (flow) initFlow(flow, signal);

  const heroRoot = document.querySelector<HTMLElement>('[data-hero]');
  const canvas = heroRoot?.querySelector<HTMLCanvasElement>('[data-sim-canvas]');
  if (!heroRoot || !canvas) return () => ac.abort();

  const log = heroRoot.querySelector<HTMLElement>('[data-sim-log]');
  const sim = new DeckSim(canvas, (e) => {
    if (log) log.textContent = formatEvent(e);
  });
  bindRail(heroRoot, sim, signal);
  sim.start();

  const offIO = new IntersectionObserver((entries) => {
    if (document.documentElement.dataset.stage === '3d') return;
    if (entries.some((e) => e.isIntersecting)) sim.start();
    else sim.stop();
  });
  offIO.observe(canvas);

  const params = new URLSearchParams(location.search);
  const force = params.get('3d') === '1';
  let destroyStage: (() => void) | null = null;

  const fallback = (): void => {
    document.documentElement.dataset.stage = 'static';
    destroyStage?.();
    destroyStage = null;
  };

  const load3d = async (): Promise<void> => {
    if (signal.aborted) return;
    try {
      const { createStage } = await import('./deck3d/stage');
      if (signal.aborted) return;
      const hosts = Array.from(document.querySelectorAll<HTMLElement>('[data-stage-host]')).flatMap((el) => {
        const mount = el.querySelector<HTMLElement>('[data-stage-mount]');
        const id = el.dataset.stageHost;
        return mount && (id === 'hero' || id === 'inside') ? [{ id, el, mount } as const] : [];
      });
      const narrow = window.matchMedia('(max-width: 760px)').matches;
      const stage = createStage(sim, hosts, {
        simple: narrow,
        dpr: Math.min(window.devicePixelRatio || 1, narrow ? 1.5 : 2),
        skipGuard: force,
        onSlow: fallback,
        onReady: (id) => {
          document.documentElement.dataset.stage = '3d';
          hosts.find((h) => h.id === id)?.el.setAttribute('data-ready', '');
        },
      });
      destroyStage = () => stage.destroy();
      if (import.meta.env.DEV) {
        (window as unknown as { __espdeckCapture: typeof stage.capture }).__espdeckCapture = stage.capture;
      }
    } catch (err) {
      console.error('[ESPDeck] 3D se nenačetlo, zůstává statický obrázek', err);
      fallback();
    }
  };

  if (shouldUse3d(force)) {
    const idle = (): void => {
      const start = (): void => void load3d();
      if ('requestIdleCallback' in window) window.requestIdleCallback(start, { timeout: 2500 });
      else setTimeout(start, 400);
    };
    // Na telefonu se Three.js stáhne až při prvním dotyku nebo scrollu, do té doby stačí obrázek.
    const onDemand = !force && window.matchMedia('(max-width: 960px), (pointer: coarse)').matches;
    if (onDemand) {
      const events = ['scroll', 'touchstart', 'pointerdown', 'keydown'] as const;
      const once = (): void => {
        events.forEach((ev) => window.removeEventListener(ev, once));
        idle();
      };
      events.forEach((ev) => window.addEventListener(ev, once, { passive: true, signal }));
    } else if (document.readyState === 'complete') {
      idle();
    } else {
      window.addEventListener('load', idle, { once: true, signal });
    }
  } else {
    fallback();
  }

  return () => {
    ac.abort();
    offIO.disconnect();
    destroyStage?.();
    sim.destroy();
  };
}
