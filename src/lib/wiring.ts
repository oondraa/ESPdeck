/**
 * Geometrie logického diagramu zapojení (viewBox 1200 × 720).
 * Ukazuje, co je kam připojené, ne fyzickou polohu pinů na desce (HW/HW zapojení.md).
 */
import { WIRES, type WireGroup } from '../data/espdeck';

export type Pt = readonly [number, number];

export interface EspPin {
  readonly key: string;
  readonly label: string;
  readonly side: 'L' | 'R' | 'B';
  readonly x: number;
  readonly y: number;
}

export const BOARD = { x: 450, y: 130, w: 300, h: 390 } as const;
export const USUP_BOX = { x: 600, y: 168, w: 150, h: 222 } as const;

const LEFT_X = BOARD.x;
const RIGHT_X = BOARD.x + BOARD.w;
const BOTTOM_Y = BOARD.y + BOARD.h;

export const ESP_PINS: readonly EspPin[] = [
  { key: '3V3', label: '3V3', side: 'L', x: LEFT_X, y: 210 },
  { key: 'GND', label: 'GND', side: 'L', x: LEFT_X, y: 250 },
  { key: '15', label: 'GPIO15', side: 'L', x: LEFT_X, y: 300 },
  { key: '16', label: 'GPIO16', side: 'L', x: LEFT_X, y: 340 },
  { key: '17', label: 'GPIO17', side: 'L', x: LEFT_X, y: 380 },
  { key: 'U_3V3', label: '3V3', side: 'R', x: RIGHT_X, y: 210 },
  { key: 'U_GND', label: 'GND', side: 'R', x: RIGHT_X, y: 250 },
  { key: '42', label: 'GPIO42', side: 'R', x: RIGHT_X, y: 300 },
  { key: '2', label: 'GPIO2', side: 'R', x: RIGHT_X, y: 340 },
  { key: '4', label: '4', side: 'B', x: 500, y: BOTTOM_Y },
  { key: '5', label: '5', side: 'B', x: 540, y: BOTTOM_Y },
  { key: '6', label: '6', side: 'B', x: 580, y: BOTTOM_Y },
  { key: '7', label: '7', side: 'B', x: 620, y: BOTTOM_Y },
  { key: '8', label: '8', side: 'B', x: 660, y: BOTTOM_Y },
  { key: '1', label: '1', side: 'B', x: 700, y: BOTTOM_Y },
];

export interface ModulePin {
  readonly wire: number;
  readonly label: string;
  readonly x: number;
  readonly y: number;
}

export const OLED_BOX = { x: 930, y: 160, w: 220, h: 220 } as const;
export const ENC_BOX = { x: 50, y: 160, w: 220, h: 260 } as const;

export const OLED_PINS: readonly ModulePin[] = [
  { wire: 1, label: 'VCC', x: OLED_BOX.x, y: 210 },
  { wire: 2, label: 'GND', x: OLED_BOX.x, y: 250 },
  { wire: 3, label: 'SDA', x: OLED_BOX.x, y: 300 },
  { wire: 4, label: 'SCL', x: OLED_BOX.x, y: 340 },
];

export const ENC_PINS: readonly ModulePin[] = [
  { wire: 5, label: '5V', x: ENC_BOX.x + ENC_BOX.w, y: 210 },
  { wire: 6, label: 'GND', x: ENC_BOX.x + ENC_BOX.w, y: 250 },
  { wire: 7, label: 'S1', x: ENC_BOX.x + ENC_BOX.w, y: 300 },
  { wire: 8, label: 'S2', x: ENC_BOX.x + ENC_BOX.w, y: 340 },
  { wire: 9, label: 'Key', x: ENC_BOX.x + ENC_BOX.w, y: 380 },
];

export interface PadPos {
  readonly wire: number;
  readonly id: string;
  readonly gpio: string;
  readonly x: number;
  readonly y: number;
}

export const PAD_R = 22;
const PAD_Y = 650;
export const PAD_POS: readonly PadPos[] = [
  { wire: 10, id: 'P1', gpio: 'GPIO4', x: 340, y: PAD_Y },
  { wire: 11, id: 'P2', gpio: 'GPIO5', x: 460, y: PAD_Y },
  { wire: 12, id: 'P3', gpio: 'GPIO6', x: 580, y: PAD_Y },
  { wire: 13, id: 'P4', gpio: 'GPIO7', x: 700, y: PAD_Y },
  { wire: 14, id: 'P5', gpio: 'GPIO8', x: 820, y: PAD_Y },
  { wire: 15, id: 'P6', gpio: 'GPIO1', x: 940, y: PAD_Y },
];

const padTop = PAD_Y - PAD_R;

/** Trasy od vývodu modulu k pinu ESP32, ortogonální. Zapojení je logické, ne fyzické pořadí pinů. */
const ROUTES: Readonly<Record<number, readonly Pt[]>> = {
  1: [[OLED_BOX.x, 210], [RIGHT_X, 210]],
  2: [[OLED_BOX.x, 250], [RIGHT_X, 250]],
  3: [[OLED_BOX.x, 300], [RIGHT_X, 300]],
  4: [[OLED_BOX.x, 340], [RIGHT_X, 340]],
  5: [[ENC_BOX.x + ENC_BOX.w, 210], [LEFT_X, 210]],
  6: [[ENC_BOX.x + ENC_BOX.w, 250], [LEFT_X, 250]],
  7: [[ENC_BOX.x + ENC_BOX.w, 300], [LEFT_X, 300]],
  8: [[ENC_BOX.x + ENC_BOX.w, 340], [LEFT_X, 340]],
  9: [[ENC_BOX.x + ENC_BOX.w, 380], [LEFT_X, 380]],
  10: [[340, padTop], [340, 556], [500, 556], [500, BOTTOM_Y]],
  11: [[460, padTop], [460, 580], [540, 580], [540, BOTTOM_Y]],
  12: [[580, padTop], [580, BOTTOM_Y]],
  13: [[700, padTop], [700, 590], [620, 590], [620, BOTTOM_Y]],
  14: [[820, padTop], [820, 570], [660, 570], [660, BOTTOM_Y]],
  15: [[940, padTop], [940, 550], [700, 550], [700, BOTTOM_Y]],
};

export interface Route {
  readonly n: number;
  readonly group: WireGroup;
  readonly d: string;
  readonly label: Pt;
}

/* ---------- Můstky na kříženích ---------- */

export const HOP_R = 7;

interface Seg {
  readonly wire: number;
  readonly a: Pt;
  readonly b: Pt;
}

const segsOf = (n: number, pts: readonly Pt[]): Seg[] =>
  pts.slice(1).map((b, i) => ({ wire: n, a: pts[i] as Pt, b }));

const ALL_SEGS: readonly Seg[] = Object.entries(ROUTES).flatMap(([n, pts]) => segsOf(Number(n), pts));

const isH = (s: Seg): boolean => s.a[1] === s.b[1] && s.a[0] !== s.b[0];
const isV = (s: Seg): boolean => s.a[0] === s.b[0] && s.a[1] !== s.b[1];
const between = (v: number, p: number, q: number, margin: number): boolean =>
  v > Math.min(p, q) + margin && v < Math.max(p, q) - margin;

/** X souřadnice, kde vodorovný úsek kříží svislé úseky jiných vodičů (bez společných koncových bodů). */
const crossingsOf = (h: Seg): number[] => {
  const y = h.a[1];
  return ALL_SEGS.filter(
    (v) => v.wire !== h.wire && isV(v) && between(v.a[0], h.a[0], h.b[0], HOP_R + 1) && between(y, v.a[1], v.b[1], 1),
  ).map((v) => v.a[0]);
};

const toPath = (n: number, pts: readonly Pt[]): string => {
  const first = pts[0];
  if (!first) return '';
  let d = `M${first[0]} ${first[1]}`;
  for (const s of segsOf(n, pts)) {
    if (isH(s)) {
      const dir = Math.sign(s.b[0] - s.a[0]);
      const xs = crossingsOf(s).sort((p, q) => (p - q) * dir);
      // Oblouk vždy nahoru: při pohybu doprava sweep 1, doleva sweep 0
      const sweep = dir > 0 ? 1 : 0;
      for (const xc of xs) {
        d += ` L${xc - dir * HOP_R} ${s.a[1]} A${HOP_R} ${HOP_R} 0 0 ${sweep} ${xc + dir * HOP_R} ${s.a[1]}`;
      }
    }
    d += ` L${s.b[0]} ${s.b[1]}`;
  }
  return d;
};

/** Počet můstků v celém diagramu (pro kontrolu a popis). */
export const HOP_COUNT = ALL_SEGS.filter(isH).reduce((sum, s) => sum + crossingsOf(s).length, 0);

export const ROUTES_BUILT: readonly Route[] = WIRES.map((w) => {
  const pts = ROUTES[w.n];
  if (!pts || pts.length < 2) throw new Error(`Chybí trasa pro vodič ${w.n}`);
  const [a, b] = [pts[0], pts[1]] as [Pt, Pt];
  // Číslo vodiče kousek od vývodu modulu, ať se nepere s popisky uprostřed
  const label: Pt =
    a[1] === b[1]
      ? [a[0] + (b[0] > a[0] ? 18 : -26), a[1] - 7]
      : [a[0] + 8, a[1] + (b[1] > a[1] ? 26 : -18)];
  return { n: w.n, group: w.group, d: toPath(w.n, pts), label };
});

/** Které vodiče končí na daném pinu ESP32 (např. 3V3 → 1 a 5). */
export const wiresOnPin = (key: string): number[] => WIRES.filter((w) => w.espPin === key).map((w) => w.n);
