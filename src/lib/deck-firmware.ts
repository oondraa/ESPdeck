/**
 * Port uživatelského rozhraní firmwaru (ESP_C++_kod/test_obrazovky/src/main.cpp) do TypeScriptu.
 * Souřadnice, časy i bitmapy odpovídají kódu v C++. Síť je nahrazená pevnou ukázkou:
 * Wi-Fi a aplikace jsou „připojené“ a zkratky plošek jsou výchozí přiřazení z aplikace.
 */
import {
  BIG_DIGITS,
  COLON_DOT,
  ICON_BT,
  ICON_PC,
  ICON_SUN,
  ICON_WIFI,
  SMALL_FONT,
} from './oled-assets';
import { OLED_W, type DrawColor, type Oled } from './oled';

const GLYPHS = new Map(SMALL_FONT.map(([c, w, bits]) => [c, { w, bits }]));
const SPACE_W = 3;
const R = 122;
const DAYS = ['NEDELE', 'PONDELI', 'UTERY', 'STREDA', 'CTVRTEK', 'PATEK', 'SOBOTA'] as const;

const ICON_BULB_OFF = [112, 136, 136, 80, 112, 112, 32];
const ICON_BULB_ON = [112, 248, 248, 112, 112, 112, 32];
const ICON_SPEAKER = [16, 52, 242, 242, 242, 52, 16];
const ICON_MUTE = [16, 48, 245, 242, 245, 48, 16];

const VOLUME_SHOW_MS = 1200;
const TOUCH_HOLD_MS = 700;
export const LONG_PRESS_MS = 600;

type Pt = readonly [number, number];
const ICON_PLAY: readonly (readonly Pt[])[] = [
  [[1, 0], [7.5, 4], [7.5, 12], [1, 16]],
  [[7.5, 4], [14, 8], [14, 8], [7.5, 12]],
];
const ICON_PAUSE: readonly (readonly Pt[])[] = [
  [[1, 0], [5.5, 0], [5.5, 16], [1, 16]],
  [[9.5, 0], [14, 0], [14, 16], [9.5, 16]],
];

const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
const easeOut = (t: number): number => 1 - (1 - clamp(t, 0, 1)) ** 3;
const easeInOut = (t: number): number => {
  const k = clamp(t, 0, 1);
  return k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
};

/** Text, který aplikace vrací na displej po zkratce (výchozí přiřazení). */
const PC_TEXT: Readonly<Record<number, string>> = { 1: 'KOPIROVAT', 3: 'VLOZIT', 4: 'VYSTRIZEK', 5: 'PLOCHA' };

const PAD_LIGHTS_ON = 0;
const PAD_LIGHTS_OFF = 2;

type TouchMsg = 'pad' | 'on' | 'off' | 'pc';
export type DeckScreen = 'clock' | 'settings';

export interface DeckClock {
  readonly hour: number;
  readonly minute: number;
  readonly weekday: number;
  readonly day: number;
  readonly month: number;
}

const FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Prague',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  day: '2-digit',
  month: '2-digit',
  weekday: 'short',
});
const WEEKDAY: Readonly<Record<string, number>> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Čas jako na decku: střední Evropa včetně letního času, nezávisle na zóně návštěvníka. */
export function pragueClock(date: Date): DeckClock {
  const get = new Map(FORMAT.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    hour: Number(get.get('hour') ?? 0),
    minute: Number(get.get('minute') ?? 0),
    weekday: WEEKDAY[get.get('weekday') ?? 'Sun'] ?? 0,
    day: Number(get.get('day') ?? 1),
    month: Number(get.get('month') ?? 1),
  };
}

export type DeckEvent =
  | { readonly t: 'touch'; readonly pad: number }
  | { readonly t: 'enc'; readonly d: number }
  | { readonly t: 'btn'; readonly long: boolean };

export class DeckFirmware {
  screen: DeckScreen = 'clock';
  cursor = 0;
  btOn = false;
  brightness = 70;
  editBrightness = false;
  volume = 50;
  musicPlaying = true;

  private volumeShownMs = -Infinity;
  private volumeVisible = false;
  private playAnimActive = false;
  private playAnimStart = 0;
  private lastTouched = -1;
  private lastTouchMs = 0;
  private touchMsg: TouchMsg = 'pad';
  private pcText = '';
  private readonly held = [false, false, false, false, false, false];

  constructor(private readonly emit: (e: DeckEvent) => void = () => undefined) {}

  /** Běží animace, která potřebuje překreslení co 15 ms (jinak stačí 100 ms). */
  get animating(): boolean {
    return this.playAnimActive;
  }

  turn(d: number, now: number): void {
    if (d === 0) return;
    this.emit({ t: 'enc', d });
    if (this.screen === 'clock') {
      this.playAnimActive = false;
      this.volume = clamp(this.volume + d, 0, 100);
      this.volumeShownMs = now;
      this.volumeVisible = true;
      return;
    }
    if (this.editBrightness) this.brightness = clamp(this.brightness + d * 5, 5, 100);
    else this.cursor = clamp(this.cursor + d, 0, 3);
  }

  press(now: number): void {
    this.emit({ t: 'btn', long: false });
    if (this.screen === 'clock') {
      this.musicPlaying = !this.musicPlaying;
      this.playAnimActive = true;
      this.playAnimStart = now;
      this.volumeVisible = false;
      return;
    }
    if (this.cursor === 1) this.btOn = !this.btOn;
    if (this.cursor === 3) this.editBrightness = !this.editBrightness;
  }

  longPress(): void {
    this.emit({ t: 'btn', long: true });
    this.screen = this.screen === 'clock' ? 'settings' : 'clock';
    this.editBrightness = false;
  }

  touch(i: number, down: boolean, now: number): void {
    if (i < 0 || i > 5 || this.held[i] === down) return;
    this.held[i] = down;
    if (!down) {
      this.lastTouchMs = now;
      return;
    }
    this.touchMsg = i === PAD_LIGHTS_ON ? 'on' : i === PAD_LIGHTS_OFF ? 'off' : 'pad';
    const text = PC_TEXT[i];
    if (text !== undefined) {
      this.touchMsg = 'pc';
      this.pcText = text;
    }
    this.emit({ t: 'touch', pad: i + 1 });
    this.lastTouched = i;
    this.lastTouchMs = now;
  }

  describe(clock: DeckClock): string {
    if (this.screen === 'settings') {
      const rows = ['WIFI', 'BLUETOOTH', 'PC', 'JAS'] as const;
      return `Displej: Nastavení, vybraný řádek ${rows[this.cursor] ?? 'WIFI'}, jas ${this.brightness} %.`;
    }
    const mm = String(clock.minute).padStart(2, '0');
    return `Displej: Hodiny ${clock.hour}:${mm}, hlasitost ${this.volume}, ${this.musicPlaying ? 'hraje' : 'pauza'}.`;
  }

  draw(o: Oled, now: number, clock: DeckClock): void {
    o.clear();
    if (this.screen === 'clock') this.drawClock(o, now, clock);
    else this.drawSettings(o, now);
    this.drawVolumeOverlay(o, now);
    this.drawPlayOverlay(o, now);
    this.drawTouchOverlay(o, now);
  }

  /* ---------- Malé písmo ---------- */

  private smallWidth(s: string, track: number): number {
    let w = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s.charAt(i);
      if (c === ' ') {
        w += SPACE_W;
        continue;
      }
      const g = GLYPHS.get(c);
      if (!g) continue;
      w += g.w;
      if (i < s.length - 1) w += track;
    }
    return w;
  }

  private drawSmall(o: Oled, x0: number, y: number, s: string, track: number): void {
    let x = x0;
    for (let i = 0; i < s.length; i++) {
      const c = s.charAt(i);
      if (c === ' ') {
        x += SPACE_W;
        continue;
      }
      const g = GLYPHS.get(c);
      if (!g) continue;
      const n = g.w * 5;
      for (let k = 0; k < n; k++) {
        if (g.bits & (2 ** (n - 1 - k))) o.pixel(x + (k % g.w), y + Math.floor(k / g.w));
      }
      x += g.w;
      if (i < s.length - 1) x += track;
    }
  }

  /* ---------- Obrazovky ---------- */

  private drawBig(o: Oled, x: number, y: number, d: number): void {
    o.bitmap(x, y, 3, 40, BIG_DIGITS[d] ?? []);
  }

  private drawClock(o: Oled, now: number, t: DeckClock): void {
    this.drawBig(o, 6, 5, Math.floor(t.hour / 10));
    this.drawBig(o, 33, 5, t.hour % 10);
    this.drawBig(o, 73, 5, Math.floor(t.minute / 10));
    this.drawBig(o, 100, 5, t.minute % 10);
    if (Math.floor(now / 500) % 2 === 0) {
      o.bitmap(62, 16, 1, 4, COLON_DOT);
      o.bitmap(62, 30, 1, 4, COLON_DOT);
    }
    const dd = String(t.day).padStart(2, '0');
    const mm = String(t.month).padStart(2, '0');
    const line = `${DAYS[t.weekday] ?? DAYS[0]} | ${dd}.${mm}`;
    this.drawSmall(o, Math.floor((OLED_W - this.smallWidth(line, 2)) / 2), 53, line, 2);
  }

  private drawSettings(o: Oled, now: number): void {
    const title = 'NASTAVENI';
    this.drawSmall(o, 5, 3, title, 2);
    const ix = 5 + this.smallWidth(title, 2) - 3;
    o.pixel(ix + 2, 0);
    o.pixel(ix + 1, 1);

    for (let i = 0; i < 4; i++) {
      const y = 13 + i * 12;
      const sel = i === this.cursor;
      const fg: DrawColor = sel ? 0 : 1;
      if (sel) {
        o.color = 1;
        o.rbox(1, y, 126, 11, 3);
      }
      o.color = fg;
      if (i === 0) this.rowWifi(o, y);
      if (i === 1) this.rowBluetooth(o, y, fg);
      if (i === 2) this.rowPc(o, y);
      if (i === 3) this.rowBrightness(o, y, now);
    }
    o.color = 1;
  }

  private rowWifi(o: Oled, y: number): void {
    o.bitmap(5, y + 2, 1, 7, ICON_WIFI);
    this.drawSmall(o, 17, y + 3, 'WIFI', 1);
    for (let k = 0; k < 4; k++) o.vline(R - 6 + k * 2, y + 3 + (3 - k), 2 + k);
    const name = 'DEMO';
    this.drawSmall(o, R - 10 - this.smallWidth(name, 1), y + 3, name, 1);
  }

  private rowBluetooth(o: Oled, y: number, fg: DrawColor): void {
    o.bitmap(6, y + 2, 1, 7, ICON_BT);
    this.drawSmall(o, 17, y + 3, 'BLUETOOTH', 1);
    if (this.btOn) {
      o.rbox(R - 12, y + 2, 13, 7, 3);
      o.color = fg === 1 ? 0 : 1;
      o.disc(R - 3, y + 5, 2);
    } else {
      o.rframe(R - 12, y + 2, 13, 7, 3);
      o.disc(R - 8, y + 5, 2);
    }
  }

  private rowPc(o: Oled, y: number): void {
    o.bitmap(5, y + 2, 1, 7, ICON_PC);
    this.drawSmall(o, 17, y + 3, 'PC', 1);
    const st = 'PRIPOJENO';
    this.drawSmall(o, R - this.smallWidth(st, 1) + 1, y + 3, st, 1);
  }

  private rowBrightness(o: Oled, y: number, now: number): void {
    o.bitmap(5, y + 2, 1, 7, ICON_SUN);
    this.drawSmall(o, 17, y + 3, 'JAS', 1);
    const x0 = R - 35;
    const fill = Math.floor((this.brightness * 35) / 100);
    o.hline(x0, y + 5, 36);
    o.box(x0, y + 4, fill, 3);
    if (!this.editBrightness || Math.floor(now / 250) % 2 === 0) {
      o.box(x0 + Math.max(fill - 1, 0), y + 2, 3, 7);
    }
  }

  /* ---------- Překryvná okénka ---------- */

  private drawVolumeOverlay(o: Oled, now: number): void {
    if (!this.volumeVisible) return;
    if (now - this.volumeShownMs > VOLUME_SHOW_MS) {
      this.volumeVisible = false;
      return;
    }
    const bw = 100;
    const bh = 17;
    const bx = (OLED_W - bw) / 2;
    const by = Math.floor((64 - bh) / 2);
    o.color = 0;
    o.rbox(bx - 2, by - 2, bw + 4, bh + 4, 5);
    o.color = 1;
    o.rbox(bx, by, bw, bh, 4);
    o.color = 0;
    o.bitmap(bx + 6, by + 5, 1, 7, this.volume === 0 ? ICON_MUTE : ICON_SPEAKER);
    const tx = bx + 19;
    const ty = by + 5;
    const tw = 56;
    const th = 7;
    o.rframe(tx, ty, tw, th, 2);
    const fill = Math.floor(((tw - 4) * this.volume) / 100);
    if (fill > 0) o.box(tx + 2, ty + 2, fill, th - 4);
    const num = String(this.volume);
    this.drawSmall(o, bx + bw - 6 - this.smallWidth(num, 1), by + 6, num, 1);
    o.color = 1;
  }

  private drawPlayOverlay(o: Oled, now: number): void {
    if (!this.playAnimActive) return;
    const IN = 140;
    const MORPH_FROM = 80;
    const MORPH = 280;
    const HOLD = 950;
    const OUT = 160;
    const t = now - this.playAnimStart;
    if (t > HOLD + OUT) {
      this.playAnimActive = false;
      return;
    }
    let s = 1;
    if (t < IN) s = 0.5 + 0.6 * easeOut(t / IN);
    else if (t < IN + 80) s = 1.1 - 0.1 * ((t - IN) / 80);
    else if (t > HOLD) s = 1 - 0.6 * easeInOut((t - HOLD) / OUT);

    const cx = 64;
    const cy = 32;
    const half = Math.floor(16 * s + 0.5);
    const r = Math.max(2, Math.floor(6 * s));
    o.color = 0;
    o.rbox(cx - half - 2, cy - half - 2, 2 * half + 4, 2 * half + 4, r + 1);
    o.color = 1;
    o.rbox(cx - half, cy - half, 2 * half, 2 * half, r);

    const m = easeInOut(Math.max(0, t - MORPH_FROM) / MORPH);
    const from = this.musicPlaying ? ICON_PAUSE : ICON_PLAY;
    const to = this.musicPlaying ? ICON_PLAY : ICON_PAUSE;
    const is = s * 0.95;
    const ox = cx - 7.5 * is;
    const oy = cy - 8 * is;
    o.color = 0;
    for (let q = 0; q < 2; q++) {
      const pts: Pt[] = [];
      for (let v = 0; v < 4; v++) {
        const a = from[q]?.[v] ?? [0, 0];
        const b = to[q]?.[v] ?? [0, 0];
        pts.push([Math.round(ox + (a[0] + (b[0] - a[0]) * m) * is), Math.round(oy + (a[1] + (b[1] - a[1]) * m) * is)]);
      }
      const [p0, p1, p2, p3] = pts as [Pt, Pt, Pt, Pt];
      o.triangle(p0[0], p0[1], p1[0], p1[1], p2[0], p2[1]);
      o.triangle(p0[0], p0[1], p2[0], p2[1], p3[0], p3[1]);
    }
    o.color = 1;
  }

  private drawTouchOverlay(o: Oled, now: number): void {
    if (this.lastTouched < 0) return;
    const held = this.held[this.lastTouched] === true;
    if (!held && now - this.lastTouchMs > TOUCH_HOLD_MS) {
      this.lastTouched = -1;
      return;
    }
    let txt = `DOTYK ${this.lastTouched + 1}`;
    let icon: readonly number[] | null = null;
    if (this.touchMsg === 'on') {
      txt = 'SVETLA ZAP';
      icon = ICON_BULB_ON;
    } else if (this.touchMsg === 'off') {
      txt = 'SVETLA VYP';
      icon = ICON_BULB_OFF;
    } else if (this.touchMsg === 'pc') {
      txt = this.pcText;
    }
    const w = this.smallWidth(txt, 2) + (icon ? 10 : 0);
    const bw = w + 16;
    const bh = 15;
    const bx = Math.floor((OLED_W - bw) / 2);
    const by = Math.floor((64 - bh) / 2);
    o.color = 0;
    o.rbox(bx - 2, by - 2, bw + 4, bh + 4, 5);
    o.color = 1;
    o.rbox(bx, by, bw, bh, 4);
    o.color = 0;
    let tx = bx + 8;
    if (icon) {
      o.bitmap(tx, by + 4, 1, 7, icon);
      tx += 10;
    }
    this.drawSmall(o, tx, by + 5, txt, 2);
    o.color = 1;
  }
}
