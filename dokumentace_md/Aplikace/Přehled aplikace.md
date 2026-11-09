---
tags: [aplikace]
cesta: app/espdeck-ui
verze: 0.1.0
---
# Přehled aplikace

Desktopová aplikace v **Rustu** (edice 2024) s GUI v **egui/eframe 0.35**. Binárka `espdeck` (Windows: `espdeck.exe`). Cargo workspace v kořeni repa má zatím jediný člen `app/espdeck-ui`.

## Build a spuštění
```
cargo run -p espdeck-ui              # debug
cargo build --release                # target/release/espdeck.exe (bez konzole)
cargo test -p espdeck-ui
```

## Závislosti
`eframe` (okno, GUI) · `enigo` (simulace kláves) · `mdns-sd` (hledání decku) · `serde`, `serde_json` · `dirs` (cesta ke konfiguraci).

## Moduly
| Soubor | Co dělá |
|---|---|
| `main.rs` | okno 1280×800 bez systémového rámu |
| `titlebar.rs` | vlastní horní lišta převzatá z OZBEAT (název vlevo, minimalizovat/maximalizovat/zavřít vpravo, změna velikosti za okraje) |
| `theme.rs` | barvy a písma z návrhu (Segoe UI, Consolas, Silkscreen v `assets/fonts`, licence OFL) |
| `app.rs` | celé okno: postranní panel, záhlaví, obrazovky – [[Editor UI]] |
| `link.rs` | vlákno na pozadí: mDNS, TCP spojení, ping, zpracování zpráv – [[Protokol deck–PC]] |
| `actions.rs` | přiřazení zkratek ploškám, jejich uložení a stisk – [[Zkratky na ploškách]] |
| `model.rs`, `deck.rs`, `draw.rs` | data a vykreslení decku v editoru, kreslicí pomocníci a ikony |

## Důležité chování
- Spojení s deckem běží ve **vlastním vlákně**, takže zkratky fungují i při minimalizovaném okně (okno ale musí běžet).
- Konfigurace: `%APPDATA%\ESPDeck\bindings.json`.

← [[ESPDeck]]
