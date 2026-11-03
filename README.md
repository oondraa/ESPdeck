# ESPDeck: prezentační web

Statický web projektu [ESPDeck](https://github.com/oondraa/ESPdeck), ovládacího panelu na ESP32 s OLED 128×64, šesti kapacitními ploškami a rotačním enkodérem.

Fakta na webu pochází z dokumentu *První návrh dokumentace HW zapojení.pdf* v repozitáři projektu. Všechna data jsou na jednom místě v `src/data/espdeck.ts`.

## Stack

- Astro 5 + TypeScript (strict), statický výstup bez backendu
- GSAP + ScrollTrigger a Lenis, načtené dynamicky a jen bez `prefers-reduced-motion`
- Písma Schibsted Grotesk a JetBrains Mono přes Fontsource (self-hosted, s latin-ext pro češtinu)
- Zvýraznění kódu přes Shiki, které je součástí Astra, v době buildu, bez JS na klientu

## Spuštění

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # astro check + build do dist/
npm run preview    # náhled buildu
npm run assets     # přegeneruje favicon a og.png (Node 22.18+)
```

Potřebuješ Node 18.20.8 nebo novější. `npm run assets` načítá `.ts` modul přímo, proto vyžaduje Node 22.18+.

## Nasazení

### GitHub Pages

1. V repozitáři nastav **Settings → Pages → Source: GitHub Actions**.
2. Pushni do `main`. Workflow `.github/workflows/deploy.yml` sestaví web s `SITE_URL=https://<owner>.github.io` a `BASE_PATH=/<repo>` a nasadí ho.

Ruční build pro Pages:

```bash
SITE_URL=https://oondraa.github.io BASE_PATH=/ESPdeck npm run build
```

### Vercel

Importuj repozitář. Vercel Astro pozná sám (build `npm run build`, výstup `dist`). Proměnné prostředí nenastavuj, base zůstane `/`. Pro vlastní doménu nastav `SITE_URL=https://tvoje-domena.cz`, aby canonical a Open Graph URL byly absolutní a správné.

## Struktura

```
src/
  data/espdeck.ts        fakta z PDF: vodiče, piny, BOM, kroky, firmware
  lib/pixelfont.ts       bitmapové glyfy 5×7 pro displej, logo a OG obrázek
  lib/wiring.ts          geometrie diagramu zapojení (piny, trasy)
  components/            sekce stránky
  scripts/simulator.ts   simulátor obrazovky testovacího firmwaru
  scripts/ui.ts          motiv, menu, kopírování, checklist, zvýraznění tras
  scripts/motion.ts      GSAP, ScrollTrigger, Lenis
scripts/assets.mjs       generátor favicon a og.png
```

## Přístupnost a chování

- Simulátor: plošky jsou tlačítka (`aria-pressed`, klávesy 1–6, Enter/mezerník), enkodér je `spinbutton` (šipky, PageUp/PageDown, Home, kolečko myši, tažení). Enter na enkodéru drží stisk osy. Canvas má průběžně aktualizovaný `aria-label`.
- Diagram: SVG má `title`/`desc`. Řádky tabulky 15 vodičů jdou zaměřit klávesnicí a zvýrazní trasu, šipky nahoru/dolů přepínají řádky, Esc zvýraznění zruší.
- Checklist oživení si pamatuje stav v `localStorage` (`espdeck:bringup:v1`). Funguje i bez úložiště, jen si nic nezapamatuje.
- Motiv: výchozí podle systému, ruční přepnutí se uloží (`espdeck:theme`).

## Licence

© 2026 Ondra (oondraa) a přispěvatelé projektu ESPDeck. Licence pro osobní nekomerční použití, viz [LICENSE](https://github.com/oondraa/ESPdeck/blob/main/LICENSE). Komerční využití jen po dohodě s autory přes https://github.com/oondraa.
