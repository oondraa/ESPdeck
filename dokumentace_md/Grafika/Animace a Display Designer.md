---
tags: [grafika]
cesta: ANIMACE/
---
# Animace a Display Designer

Obrazovky decku se kreslí v nástroji **Display Designer** (není součástí repa) a ukládají jako JSON do `ANIMACE/`.

| Soubor | Obsah |
|---|---|
| `hodiny.v.0.0.1.json` | obrazovka Hodiny, 2 snímky (blikající dvojtečka po 500 ms) |
| `espdeck_nastaveni_0.0.1.json` | obrazovka Nastavení, 4 snímky |

Formát: `name`, `width` 128, `height` 64, `driver` (`Ssd1306`), `tint`, `background`, `frames[]` – každý snímek má `duration_ms` a `shapes`.

## Cesta do firmwaru
Z JSON návrhů vznikl `ESP_C++_kod/test_obrazovky/src/assets.h` (hlavička: „Vygenerováno z návrhů v Display Designeru. Needitovat ručně.“):
- velké číslice 0–9 (22×40 px), tečka dvojtečky,
- ikony WIFI, BT, PC, SUN,
- malé pixelové písmo (glyfy 5 px vysoké).

Rozvržení obrazovek je pak ručně přepsané v `main.cpp` – [[Obrazovky a ovládání]]. Skript, který `assets.h` generuje, v repu není.

Pozn.: návrhy uvádějí driver `Ssd1306`, skutečný displej je SH1106 ([[HW zapojení]]) – firmware používá U8g2 driver SH1106.

← [[ESPDeck]]
