// Generuje favicon a Open Graph obrázek z bitmapového písma webu.
// Spuštění: npm run assets   (Node 22.18+ kvůli načtení .ts modulu)
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { textPixels, ADVANCE, GLYPH_H } from '../src/lib/pixelfont.ts';

const out = fileURLToPath(new URL('../public/', import.meta.url));
await mkdir(out, { recursive: true });

const BG = '#100e0c';
const FG = '#ece7df';
const OLED = '#e3edf8';
const CU = '#d0844f';

const pix = (text, x, baseline, s, color) =>
  `<path fill="${color}" d="${textPixels(text, 0, GLYPH_H)
    .map(([px, py]) => `M${x + px * s} ${baseline - GLYPH_H * s + py * s}h${s}v${s}h-${s}z`)
    .join('')}"/>`;

/* ---------- Favicon: 6 rámečků displeje, první vyplněný ---------- */
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges">
<rect width="32" height="32" fill="${BG}"/>
<rect x="4" y="6" width="11" height="9" fill="${CU}"/>
<rect x="17.5" y="6.5" width="10" height="8" fill="none" stroke="${OLED}"/>
<rect x="4.5" y="17.5" width="10" height="8" fill="none" stroke="${OLED}"/>
<rect x="17.5" y="17.5" width="10" height="8" fill="none" stroke="${OLED}"/>
</svg>`;
await writeFile(`${out}favicon.svg`, favicon);
await sharp(Buffer.from(favicon)).resize(32, 32).png().toFile(`${out}favicon-32.png`);
await sharp(Buffer.from(favicon)).resize(180, 180, { kernel: 'nearest' }).png().toFile(`${out}apple-touch-icon.png`);

/* ---------- OG 1200×630: obrazovka testovacího firmwaru ---------- */
const S = 5; // 1 bod displeje = 5 px
const ox = 560;
const oy = 155;
const screen = [];
screen.push(pix('ENC: 12', ox, oy + 12 * S, S, OLED));
screen.push(pix('KEY: -', ox, oy + 26 * S, S, OLED));
for (let i = 0; i < 6; i++) {
  const x = ox + (4 + i * 20) * S;
  const y = oy + 40 * S;
  screen.push(
    i === 1 || i === 4
      ? `<rect x="${x}" y="${y}" width="${16 * S}" height="${16 * S}" fill="${OLED}"/>`
      : `<rect x="${x + S / 2}" y="${y + S / 2}" width="${15 * S}" height="${15 * S}" fill="none" stroke="${OLED}" stroke-width="${S}"/>`,
  );
}
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" shape-rendering="crispEdges">
<rect width="1200" height="630" fill="${BG}"/>
<rect x="530" y="125" width="${128 * S + 60}" height="${64 * S + 60}" fill="#07080a" stroke="#4a4239"/>
${screen.join('\n')}
${pix('ESPDeck', 64, 300, 11, FG)}
<rect x="64" y="340" width="${(7 * ADVANCE - 1) * 11}" height="6" fill="${CU}"/>
</svg>`;
await sharp(Buffer.from(og)).png({ compressionLevel: 9 }).toFile(`${out}og.png`);
console.log('assets ok');
