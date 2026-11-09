/** 1bitový snímek displeje SH1106 s kreslicími primitivy ve stylu knihovny U8g2. */

export const OLED_W = 128;
export const OLED_H = 64;

export type DrawColor = 0 | 1;

export class Oled {
  readonly px = new Uint8Array(OLED_W * OLED_H);
  color: DrawColor = 1;

  clear(): void {
    this.px.fill(0);
    this.color = 1;
  }

  pixel(x: number, y: number): void {
    if (x < 0 || y < 0 || x >= OLED_W || y >= OLED_H) return;
    this.px[y * OLED_W + x] = this.color;
  }

  box(x: number, y: number, w: number, h: number): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.pixel(x + i, y + j);
  }

  hline(x: number, y: number, w: number): void {
    this.box(x, y, w, 1);
  }

  vline(x: number, y: number, h: number): void {
    this.box(x, y, 1, h);
  }

  /** O kolik pixelů je řádek y (0 až h-1) odsazený od kraje zaobleného obdélníku. */
  private static inset(y: number, h: number, r: number): number {
    const fromEdge = Math.min(y, h - 1 - y);
    if (fromEdge >= r) return 0;
    const d = r - fromEdge - 0.5;
    return Math.round(r - Math.sqrt(Math.max(0, r * r - d * d)));
  }

  rbox(x: number, y: number, w: number, h: number, r: number): void {
    for (let j = 0; j < h; j++) {
      const inset = Oled.inset(j, h, r);
      this.hline(x + inset, y + j, w - inset * 2);
    }
  }

  rframe(x: number, y: number, w: number, h: number, r: number): void {
    for (let j = 0; j < h; j++) {
      const inset = Oled.inset(j, h, r);
      const prev = j > 0 ? Oled.inset(j - 1, h, r) : w;
      const next = j < h - 1 ? Oled.inset(j + 1, h, r) : w;
      const span = Math.max(1, Math.max(prev, next) - inset);
      if (j === 0 || j === h - 1) {
        this.hline(x + inset, y + j, w - inset * 2);
        continue;
      }
      this.hline(x + inset, y + j, Math.min(span, w));
      this.hline(x + w - inset - span, y + j, Math.min(span, w));
    }
  }

  disc(cx: number, cy: number, r: number): void {
    for (let j = -r; j <= r; j++) {
      for (let i = -r; i <= r; i++) {
        if (i * i + j * j <= r * r + 1) this.pixel(cx + i, cy + j);
      }
    }
  }

  /** Průhledná bitmapa: kreslí jen nastavené bity (setBitmapMode(1)). */
  bitmap(x: number, y: number, bytesPerRow: number, h: number, data: readonly number[]): void {
    for (let j = 0; j < h; j++) {
      for (let b = 0; b < bytesPerRow; b++) {
        const v = data[j * bytesPerRow + b] ?? 0;
        for (let bit = 0; bit < 8; bit++) {
          if (v & (0x80 >> bit)) this.pixel(x + b * 8 + bit, y + j);
        }
      }
    }
  }

  triangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number): void {
    const minX = Math.floor(Math.min(x0, x1, x2));
    const maxX = Math.ceil(Math.max(x0, x1, x2));
    const minY = Math.floor(Math.min(y0, y1, y2));
    const maxY = Math.ceil(Math.max(y0, y1, y2));
    const edge = (ax: number, ay: number, bx: number, by: number, px: number, py: number): number =>
      (bx - ax) * (py - ay) - (by - ay) * (px - ax);
    const area = edge(x0, y0, x1, y1, x2, y2);
    if (area === 0) return;
    const s = Math.sign(area);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (
          edge(x0, y0, x1, y1, x, y) * s >= 0 &&
          edge(x1, y1, x2, y2, x, y) * s >= 0 &&
          edge(x2, y2, x0, y0, x, y) * s >= 0
        ) {
          this.pixel(x, y);
        }
      }
    }
  }
}
