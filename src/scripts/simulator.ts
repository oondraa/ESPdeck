/**
 * Simulátor obrazovky testovacího firmwaru (kap. 8).
 * Kreslí přesně to, co loop():
 *   setCursor(0,12) "ENC: %ld"   setCursor(0,26) "KEY: %s"
 *   6× rámeček/box 16×16 na x = 4 + i*20, y = 40
 * Plošky a tlačítko jsou momentové jako ve firmwaru: svítí, dokud je drží prst.
 */
import { textPixels } from '../lib/pixelfont';

const W = 128;
const H = 64;
const DETENTS = 20;
const STEP_DEG = 360 / DETENTS;
const WHEEL_STEP = 60;

interface SimState {
  detent: number;
  touched: number;
  key: boolean;
  /** natočení knoflíku ve stupních (plynulé při tažení) */
  angle: number;
}

function readColor(el: Element, prop: string, fallback: string): string {
  const v = getComputedStyle(el).getPropertyValue(prop).trim();
  return v.length > 0 ? v : fallback;
}

export function initSimulator(root: HTMLElement, reduceMotion: boolean): () => void {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-sim-canvas]');
  const knob = root.querySelector<HTMLElement>('[data-sim-knob]');
  const rotor = root.querySelector<SVGGElement>('[data-sim-rotor]');
  const keyBtn = root.querySelector<HTMLButtonElement>('[data-sim-key]');
  const log = root.querySelector<HTMLElement>('[data-sim-log]');
  const pads = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-sim-pad]'));
  const ctx = canvas?.getContext('2d', { alpha: false }) ?? null;

  if (!canvas || !ctx || !knob || !rotor || !keyBtn || pads.length !== 6) {
    return () => undefined;
  }

  const ac = new AbortController();
  const { signal } = ac;
  const state: SimState = { detent: 0, touched: 0, key: false, angle: 0 };
  let booted = reduceMotion;
  let raf = 0;
  let labelTimer = 0;
  let colors = { on: '#e3edf8', off: '#0b0d10' };

  const refreshColors = (): void => {
    colors = {
      on: readColor(root, '--oled', '#e3edf8'),
      off: readColor(root, '--oled-off', '#0b0d10'),
    };
  };

  /* ---------- Kreslení ---------- */

  const drawFrame = (): void => {
    ctx.fillStyle = colors.off;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = colors.on;
    // C celočíselné dělení: encCount / 4 ořezává k nule, detent už je celé číslo
    for (const [x, y] of textPixels(`ENC: ${state.detent}`, 0, 12)) ctx.fillRect(x, y, 1, 1);
    for (const [x, y] of textPixels(`KEY: ${state.key ? 'STISK' : '-'}`, 0, 26)) ctx.fillRect(x, y, 1, 1);
    for (let i = 0; i < 6; i++) {
      const x = 4 + i * 20;
      if (state.touched & (1 << i)) {
        ctx.fillRect(x, 40, 16, 16);
      } else {
        ctx.fillRect(x, 40, 16, 1);
        ctx.fillRect(x, 55, 16, 1);
        ctx.fillRect(x, 40, 1, 16);
        ctx.fillRect(x + 15, 40, 1, 16);
      }
    }
  };

  const schedule = (): void => {
    if (!booted || raf !== 0) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      drawFrame();
      rotor.style.transform = `rotate(${state.angle}deg)`;
    });
  };

  const describe = (): string => {
    const names = [0, 1, 2, 3, 4, 5].filter((i) => (state.touched & (1 << i)) !== 0).map((i) => `P${i + 1}`);
    return `Displej testovacího firmwaru: ENC: ${state.detent}, KEY: ${state.key ? 'STISK' : '-'}, ${
      names.length ? `vyplněno ${names.join(', ')}` : 'žádná ploška se nedotýká'
    }.`;
  };

  const updateLabels = (): void => {
    window.clearTimeout(labelTimer);
    labelTimer = window.setTimeout(() => {
      canvas.setAttribute('aria-label', describe());
    }, 250);
  };

  /* ---------- Zapínací sekvence ---------- */

  const boot = (): void => {
    refreshColors();
    if (reduceMotion) {
      booted = true;
      if (log) log.textContent = 'loop()';
      drawFrame();
      return;
    }
    // Po připojení napájení drží RAM řadiče SH1106 náhodný obsah, než ho firmware smaže.
    const img = ctx.createImageData(W, H);
    const on = hexToRgb(colors.on);
    const off = hexToRgb(colors.off);
    let frame = 0;
    const noise = (): void => {
      if (signal.aborted) return;
      for (let p = 0; p < W * H; p++) {
        const lit = Math.random() < 0.42 - frame * 0.06;
        const c = lit ? on : off;
        const o = p * 4;
        img.data[o] = c[0];
        img.data[o + 1] = c[1];
        img.data[o + 2] = c[2];
        img.data[o + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      frame++;
      if (frame < 6) {
        window.setTimeout(noise, 55);
      } else {
        ctx.fillStyle = colors.off;
        ctx.fillRect(0, 0, W, H);
        if (log) log.textContent = 'calibrateTouch()  plošek se nedotýkej';
        // calibrateTouch: 6 kanálů × 32 vzorků × 2 ms ≈ 384 ms
        window.setTimeout(() => {
          if (signal.aborted) return;
          booted = true;
          if (log) log.textContent = 'loop()';
          drawFrame();
        }, 384);
      }
    };
    if (log) log.textContent = 'oled.begin()';
    noise();
  };

  /* ---------- Plošky ---------- */

  const setPad = (i: number, down: boolean): void => {
    const pad = pads[i];
    if (!pad) return;
    const bit = 1 << i;
    const was = (state.touched & bit) !== 0;
    if (was === down) return;
    state.touched = down ? state.touched | bit : state.touched & ~bit;
    pad.setAttribute('aria-pressed', String(down));
    schedule();
    updateLabels();
  };

  pads.forEach((pad, i) => {
    pad.addEventListener(
      'pointerdown',
      (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        capture(pad, e.pointerId);
        setPad(i, true);
      },
      { signal },
    );
    const release = (): void => setPad(i, false);
    pad.addEventListener('pointerup', release, { signal });
    pad.addEventListener('pointercancel', release, { signal });
    pad.addEventListener('lostpointercapture', release, { signal });
    pad.addEventListener(
      'keydown',
      (e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
          e.preventDefault();
          setPad(i, true);
        }
      },
      { signal },
    );
    pad.addEventListener(
      'keyup',
      (e) => {
        if (e.key === ' ' || e.key === 'Enter') setPad(i, false);
      },
      { signal },
    );
    pad.addEventListener('blur', release, { signal });
    pad.addEventListener('contextmenu', (e) => e.preventDefault(), { signal });
  });

  /* ---------- Tlačítko enkodéru ---------- */

  const setKey = (down: boolean): void => {
    if (state.key === down) return;
    state.key = down;
    if (down) knob.setAttribute('data-key', '');
    else knob.removeAttribute('data-key');
    schedule();
    updateLabels();
  };

  keyBtn.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      capture(keyBtn, e.pointerId);
      setKey(true);
    },
    { signal },
  );
  const keyUp = (): void => setKey(false);
  keyBtn.addEventListener('pointerup', keyUp, { signal });
  keyBtn.addEventListener('pointercancel', keyUp, { signal });
  keyBtn.addEventListener('lostpointercapture', keyUp, { signal });

  /* ---------- Otáčení ---------- */

  const setDetent = (next: number): void => {
    if (!Number.isFinite(next)) return;
    const clamped = Math.max(-999_999, Math.min(999_999, Math.trunc(next)));
    if (clamped === state.detent) return;
    state.detent = clamped;
    knob.setAttribute('aria-valuenow', String(clamped));
    knob.setAttribute('aria-valuetext', `ENC ${clamped}`);
    updateLabels();
  };

  const stepBy = (delta: number): void => {
    setDetent(state.detent + delta);
    state.angle = state.detent * STEP_DEG;
    schedule();
  };

  knob.addEventListener(
    'keydown',
    (e) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          e.preventDefault();
          stepBy(1);
          break;
        case 'ArrowLeft':
        case 'ArrowDown':
          e.preventDefault();
          stepBy(-1);
          break;
        case 'PageUp':
          e.preventDefault();
          stepBy(5);
          break;
        case 'PageDown':
          e.preventDefault();
          stepBy(-5);
          break;
        case 'Home':
          e.preventDefault();
          stepBy(-state.detent);
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (!e.repeat) setKey(true);
          break;
        default:
          break;
      }
    },
    { signal },
  );
  knob.addEventListener(
    'keyup',
    (e) => {
      if (e.key === 'Enter' || e.key === ' ') setKey(false);
    },
    { signal },
  );
  knob.addEventListener('blur', keyUp, { signal });

  let wheelAcc = 0;
  knob.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 20 : e.deltaMode === 2 ? 400 : 1;
      wheelAcc += e.deltaY * unit;
      while (Math.abs(wheelAcc) >= WHEEL_STEP) {
        const dir = wheelAcc > 0 ? -1 : 1;
        stepBy(dir);
        wheelAcc -= -dir * WHEEL_STEP;
      }
    },
    { signal, passive: false },
  );

  // Tažení: úhel kolem středu knoflíku, 18° = 1 cvaknutí
  let dragId: number | null = null;
  let lastAngle = 0;
  let accDeg = 0;
  const pointerAngle = (e: PointerEvent): number => {
    const r = knob.getBoundingClientRect();
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
  };

  knob.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0 || e.target === keyBtn || keyBtn.contains(e.target as Node)) return;
      dragId = e.pointerId;
      capture(knob, e.pointerId);
      lastAngle = pointerAngle(e);
      accDeg = 0;
      knob.focus({ preventScroll: true });
    },
    { signal },
  );
  knob.addEventListener(
    'pointermove',
    (e) => {
      if (dragId !== e.pointerId) return;
      const a = pointerAngle(e);
      let d = a - lastAngle;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      lastAngle = a;
      accDeg += d;
      const steps = Math.trunc(accDeg / STEP_DEG);
      if (steps !== 0) {
        setDetent(state.detent + steps);
        accDeg -= steps * STEP_DEG;
      }
      state.angle = state.detent * STEP_DEG + accDeg;
      schedule();
    },
    { signal },
  );
  const endDrag = (e: PointerEvent): void => {
    if (dragId !== e.pointerId) return;
    dragId = null;
    accDeg = 0;
    state.angle = state.detent * STEP_DEG;
    schedule();
  };
  knob.addEventListener('pointerup', endDrag, { signal });
  knob.addEventListener('pointercancel', endDrag, { signal });

  /* ---------- Klávesy 1–6, když je fokus v simulátoru ---------- */

  root.addEventListener(
    'keydown',
    (e) => {
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= 6) {
        e.preventDefault();
        setPad(n - 1, true);
      }
    },
    { signal },
  );
  root.addEventListener(
    'keyup',
    (e) => {
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= 6) setPad(n - 1, false);
    },
    { signal },
  );
  root.addEventListener(
    'focusout',
    (e) => {
      if (!root.contains(e.relatedTarget as Node | null)) {
        for (let i = 0; i < 6; i++) setPad(i, false);
        setKey(false);
      }
    },
    { signal },
  );

  /* ---------- Motiv a viditelnost ---------- */

  const themeObserver = new MutationObserver(() => {
    refreshColors();
    if (booted) drawFrame();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((en) => en.isIntersecting)) {
        io.disconnect();
        boot();
      }
    },
    { threshold: 0.35 },
  );
  // Do zapnutí ukaž zhasnutý displej
  ctx.fillStyle = '#0b0d10';
  ctx.fillRect(0, 0, W, H);
  io.observe(canvas);

  return () => {
    ac.abort();
    io.disconnect();
    themeObserver.disconnect();
    if (raf) cancelAnimationFrame(raf);
    window.clearTimeout(labelTimer);
  };
}

function capture(el: Element, id: number): void {
  try {
    el.setPointerCapture(id);
  } catch {
    /* ukazatel už neexistuje; stav uvolní pointerup/blur */
  }
}

function hexToRgb(input: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(input.trim());
  if (!m || !m[1]) return [227, 237, 248];
  const n = Number.parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
