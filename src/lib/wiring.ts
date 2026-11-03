/**
 * Geometrie diagramu zapojení (viewBox 1200 × 820).
 * Pořadí pinů desky odpovídá běžnému 38pinovému ESP32 DevKit (USB dole), na který sedí
 * údaje z PDF: D21/D22/D23/D4 vpravo, D25/D26/D27/D14/D13/D33/D32 vlevo, CMD vedle 5V.
 * Pořadí vývodů modulů je schematické, ne fyzické.
 */
import { WIRES, type WireGroup } from '../data/espdeck';

export type Pt = readonly [number, number];

export interface EspPin {
  readonly key: string;
  readonly label: string;
  readonly side: 'L' | 'R';
  readonly x: number;
  readonly y: number;
  readonly flag?: 'strap' | 'cmd' | 'v5';
}

const PIN_Y0 = 170;
const PITCH = 24;
export const PIN_LX = 538;
export const PIN_RX = 662;

const LEFT: ReadonlyArray<[string, string, EspPin['flag']?]> = [
  ['3V3', '3V3'],
  ['EN', 'EN'],
  ['VP', 'VP'],
  ['VN', 'VN'],
  ['34', 'D34'],
  ['35', 'D35'],
  ['32', 'D32'],
  ['33', 'D33'],
  ['25', 'D25'],
  ['26', 'D26'],
  ['27', 'D27'],
  ['14', 'D14'],
  ['12', 'D12', 'strap'],
  ['GND_L', 'GND'],
  ['13', 'D13'],
  ['SD2', 'SD2'],
  ['SD3', 'SD3'],
  ['CMD', 'CMD', 'cmd'],
  ['5V', '5V', 'v5'],
];

const RIGHT: ReadonlyArray<[string, string, EspPin['flag']?]> = [
  ['GND_R', 'GND'],
  ['23', 'D23'],
  ['22', 'D22'],
  ['TX', 'TX'],
  ['RX', 'RX'],
  ['21', 'D21'],
  ['GND_R2', 'GND'],
  ['19', 'D19'],
  ['18', 'D18'],
  ['5', 'D5'],
  ['17', 'D17'],
  ['16', 'D16'],
  ['4', 'D4'],
  ['0', 'D0', 'strap'],
  ['2', 'D2', 'strap'],
  ['15', 'D15', 'strap'],
  ['SD1', 'SD1'],
  ['SD0', 'SD0'],
  ['CLK', 'CLK'],
];

const build = (rows: typeof LEFT, side: 'L' | 'R'): EspPin[] =>
  rows.map(([key, label, flag], i) => {
    const base = { key, label, side, x: side === 'L' ? PIN_LX : PIN_RX, y: PIN_Y0 + i * PITCH };
    return flag ? { ...base, flag } : base;
  });

export const ESP_PINS: readonly EspPin[] = [...build(LEFT, 'L'), ...build(RIGHT, 'R')];

export const BOARD = { x: 520, y: 128, w: 160, h: 502 } as const;

export interface ModulePin {
  readonly wire: number;
  readonly label: string;
  readonly x: number;
  readonly y: number;
}

export const OLED_BOX = { x: 900, y: 150, w: 220, h: 210 } as const;
export const ENC_BOX = { x: 60, y: 100, w: 180, h: 182 } as const;

export const OLED_PINS: readonly ModulePin[] = [
  { wire: 1, label: 'VCC', x: 914, y: 210 },
  { wire: 2, label: 'GND', x: 914, y: 245 },
  { wire: 4, label: 'SCL', x: 914, y: 280 },
  { wire: 3, label: 'SDA', x: 914, y: 315 },
];

export const ENC_PINS: readonly ModulePin[] = [
  { wire: 9, label: 'Key', x: 226, y: 130 },
  { wire: 5, label: '5V', x: 226, y: 160 },
  { wire: 7, label: 'S1', x: 226, y: 190 },
  { wire: 8, label: 'S2', x: 226, y: 220 },
  { wire: 6, label: 'GND', x: 226, y: 250 },
];

export interface PadPos {
  readonly wire: number;
  readonly id: string;
  readonly gpio: string;
  readonly x: number;
  readonly y: number;
}

export const PAD_R = 22;
export const PAD_POS: readonly PadPos[] = [
  { wire: 15, id: 'P6', gpio: 'GPIO32', x: 120, y: 750 },
  { wire: 14, id: 'P5', gpio: 'GPIO33', x: 200, y: 750 },
  { wire: 13, id: 'P4', gpio: 'GPIO27', x: 280, y: 750 },
  { wire: 12, id: 'P3', gpio: 'GPIO14', x: 360, y: 750 },
  { wire: 11, id: 'P2', gpio: 'GPIO13', x: 440, y: 750 },
  { wire: 10, id: 'P1', gpio: 'GPIO4', x: 760, y: 750 },
];

/** Trasy od vývodu modulu k pinu ESP32, ortogonální. */
const ROUTES: Readonly<Record<number, readonly Pt[]>> = {
  1: [[914, 210], [880, 210], [880, 70], [490, 70], [490, 170], [PIN_LX, 170]],
  2: [[914, 245], [840, 245], [840, 170], [PIN_RX, 170]],
  3: [[914, 315], [760, 315], [760, 290], [PIN_RX, 290]],
  4: [[914, 280], [800, 280], [800, 218], [PIN_RX, 218]],
  5: [[226, 160], [460, 160], [460, 170], [PIN_LX, 170]],
  6: [[226, 250], [360, 250], [360, 482], [PIN_LX, 482]],
  7: [[226, 190], [400, 190], [400, 362], [PIN_LX, 362]],
  8: [[226, 220], [380, 220], [380, 386], [PIN_LX, 386]],
  9: [[226, 130], [420, 130], [420, 48], [720, 48], [720, 194], [PIN_RX, 194]],
  10: [[760, 750 - PAD_R], [760, 458], [PIN_RX, 458]],
  11: [[440, 750 - PAD_R], [440, 704], [510, 704], [510, 506], [PIN_LX, 506]],
  12: [[360, 750 - PAD_R], [360, 688], [490, 688], [490, 434], [PIN_LX, 434]],
  13: [[280, 750 - PAD_R], [280, 672], [470, 672], [470, 410], [PIN_LX, 410]],
  14: [[200, 750 - PAD_R], [200, 656], [450, 656], [450, 338], [PIN_LX, 338]],
  15: [[120, 750 - PAD_R], [120, 640], [430, 640], [430, 314], [PIN_LX, 314]],
};

export interface Route {
  readonly n: number;
  readonly group: WireGroup;
  readonly d: string;
  readonly label: Pt;
}

const toPath = (pts: readonly Pt[]): string =>
  pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');

export const ROUTES_BUILT: readonly Route[] = WIRES.map((w) => {
  const pts = ROUTES[w.n];
  if (!pts || pts.length < 2) throw new Error(`Chybí trasa pro vodič ${w.n}`);
  const [a, b] = [pts[0], pts[1]] as [Pt, Pt];
  // Číslo vodiče kousek od vývodu modulu, ať se nepere s popisky uprostřed
  const label: Pt =
    a[1] === b[1]
      ? [a[0] + (b[0] > a[0] ? 18 : -26), a[1] - 7]
      : [a[0] + 8, a[1] + (b[1] > a[1] ? 26 : -18)];
  return { n: w.n, group: w.group, d: toPath(pts), label };
});

/** Které vodiče končí na daném pinu ESP32 (např. 3V3 → 1 a 5). */
export const wiresOnPin = (key: string): number[] => WIRES.filter((w) => w.espPin === key).map((w) => w.n);
