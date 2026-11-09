/** Běhové prostředí portu firmwaru: časování, vykreslení do canvasu a odběratelé snímků. */
import { DeckFirmware, LONG_PRESS_MS, pragueClock, type DeckEvent } from '../lib/deck-firmware';
import { Oled, OLED_H, OLED_W } from '../lib/oled';

const SCALE = 4;
const TINT: readonly [number, number, number] = [227, 237, 248];

export class DeckSim {
  readonly fw: DeckFirmware;
  readonly canvas: HTMLCanvasElement;
  private readonly oled = new Oled();
  private readonly ctx: CanvasRenderingContext2D;
  private readonly image: ImageData;
  private readonly last = new Uint8Array(OLED_W * OLED_H);
  private readonly listeners = new Set<() => void>();
  private timer = 0;
  private running = false;
  private lastBrightness = -1;
  private pressTimer = 0;
  private pressFired = false;
  private pressing = false;
  private labelTimer = 0;

  constructor(canvas: HTMLCanvasElement, onEvent?: (e: DeckEvent) => void) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D není dostupný');
    canvas.width = OLED_W * SCALE;
    canvas.height = OLED_H * SCALE;
    this.canvas = canvas;
    this.ctx = ctx;
    this.image = ctx.createImageData(canvas.width, canvas.height);
    this.fw = new DeckFirmware(onEvent);
  }

  onFrame(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.tick();
  }

  stop(): void {
    this.running = false;
    window.clearTimeout(this.timer);
  }

  /** Překreslí hned, aby vstup nečekal na další periodu. */
  refresh(): void {
    if (!this.running) {
      this.render();
      return;
    }
    window.clearTimeout(this.timer);
    this.tick();
  }

  private tick = (): void => {
    this.render();
    if (this.running) this.timer = window.setTimeout(this.tick, this.fw.animating ? 15 : 100);
  };

  private render(): void {
    const now = performance.now();
    this.fw.draw(this.oled, now, pragueClock(new Date()));
    const { px } = this.oled;
    const b = this.fw.brightness;
    let changed = b !== this.lastBrightness;
    if (!changed) {
      for (let i = 0; i < px.length; i++) {
        if (px[i] !== this.last[i]) {
          changed = true;
          break;
        }
      }
    }
    if (!changed) return;
    this.last.set(px);
    this.lastBrightness = b;
    this.paint(b);
    this.listeners.forEach((fn) => fn());
    window.clearTimeout(this.labelTimer);
    this.labelTimer = window.setTimeout(() => {
      this.canvas.setAttribute('aria-label', this.fw.describe(pragueClock(new Date())));
    }, 300);
  }

  /** Jeden bod displeje jsou 4×4 pixely, ať textura zůstane při zvětšení ostrá. */
  private paint(brightness: number): void {
    const k = 0.42 + (brightness / 100) * 0.58;
    const r = TINT[0] * k;
    const g = TINT[1] * k;
    const bl = TINT[2] * k;
    const { data, width } = this.image;
    const { px } = this.oled;
    data.fill(0);
    for (let i = 3; i < data.length; i += 4) data[i] = 255;
    for (let y = 0; y < OLED_H; y++) {
      for (let x = 0; x < OLED_W; x++) {
        if (!px[y * OLED_W + x]) continue;
        for (let j = 0; j < SCALE; j++) {
          for (let i = 0; i < SCALE; i++) {
            const o = ((y * SCALE + j) * width + x * SCALE + i) * 4;
            data[o] = r;
            data[o + 1] = g;
            data[o + 2] = bl;
          }
        }
      }
    }
    this.ctx.putImageData(this.image, 0, 0);
  }

  /* ---------- Vstupy ---------- */

  turn(d: number): void {
    this.fw.turn(d, performance.now());
    this.refresh();
  }

  touch(i: number, down: boolean): void {
    this.fw.touch(i, down, performance.now());
    this.refresh();
  }

  /** Začátek stisku: po 600 ms se bez puštění spustí dlouhý stisk jako ve firmwaru. */
  pressStart(): void {
    if (this.pressing) return;
    this.pressing = true;
    this.pressFired = false;
    window.clearTimeout(this.pressTimer);
    this.pressTimer = window.setTimeout(() => {
      this.pressFired = true;
      this.fw.longPress();
      this.refresh();
    }, LONG_PRESS_MS);
  }

  pressEnd(cancel = false): void {
    if (!this.pressing) return;
    this.pressing = false;
    window.clearTimeout(this.pressTimer);
    if (cancel || this.pressFired) return;
    this.fw.press(performance.now());
    this.refresh();
  }

  destroy(): void {
    this.stop();
    window.clearTimeout(this.pressTimer);
    window.clearTimeout(this.labelTimer);
    this.listeners.clear();
  }
}

export function formatEvent(e: DeckEvent): string {
  if (e.t === 'touch') return `{"t":"touch","pad":${e.pad},"ev":"tap"}`;
  if (e.t === 'enc') return `{"t":"enc","d":${e.d}}`;
  return `{"t":"btn","ev":"${e.long ? 'long' : 'press'}"}`;
}
