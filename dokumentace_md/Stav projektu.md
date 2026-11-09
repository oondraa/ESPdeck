---
tags: [projekt, stav]
aktualizováno: 2026-11-09
---
# Stav projektu

> [!summary] Aktuálně
> Existuje **funkční testovací firmware** (C++/Arduino, PlatformIO) na LaskaKit ESP32-S3 DevKit a **desktopová aplikace** v Rustu/egui, která se s deckem spojí přes Wi-Fi a podle dotyků mačká zkratky. Release build aplikace proběhl (8. 11. 2026). Vše je zatím **necommitnuté** v gitu.

## Co funguje (podle kódu, část ověřena na HW)
| Oblast | Stav | Detail |
|---|---|---|
| OLED SH1106 přes μŠup | ✅ ověřeno na HW | piny našel I2C sken – [[HW zapojení]] |
| Enkodér + tlačítko | ✅ ověřeno na HW | směr otočen (`ENC_REVERSE`) – [[Obrazovky a ovládání]] |
| 6 dotykových plošek | ✅ ověřeno na HW | kalibrace, IIR filtr, hystereze – [[Dotykové plošky]] |
| Obrazovky Hodiny a Nastavení | ✅ | grafika z Display Designeru – [[Animace a Display Designer]] |
| Wi-Fi, NTP čas (CET/CEST) | ✅ | [[Síťové funkce]] |
| Bluesound: hlasitost, Play/Pauza, čtení stavu | ✅ | BluOS HTTP API |
| Světla zap/vyp (ploška 1/3) | ✅ | HTTP GET na lokální server |
| Spojení s PC aplikací | ✅ | [[Protokol deck–PC]] |
| Aplikace: zkratky na ploškách, živý log | ✅ | [[Zkratky na ploškách]] |
| Aplikace: editor Hardware / Functions | 🟡 jen vzhled | ukázková data z návrhu – [[Editor UI]] |

## Co neexistuje
- Zabezpečení spojení (šifrování, párování) – spojení je otevřené TCP v LAN, viz [[Otevřené otázky]].
- Bluetooth – přepínač na decku i v aplikaci nic nedělá.
- Ukládání nastavení na decku (jas, BT) – po restartu se vrací výchozí hodnoty.
- Konfigurace decku z aplikace – Wi-Fi a adresy se zadávají při kompilaci v `secrets.h`.
- `ESP_C++_kod/v.0.0.1/v.0.0.1.ino` – prázdná kostra.
- Testy firmwaru; Rust má pár unit testů (`model.rs`, `actions.rs`).

## Co je zastaralé mimo vault
- Web (`src/data/espdeck.ts`) popisuje **klasický ESP32** s jinými piny. Platí [[HW zapojení]].
- `První návrh dokumentace HW zapojení.pdf` (také pro klasický ESP32) byl z pracovní složky smazán; v gitu je zatím vedený jako smazaný soubor. Nahrazuje ho `ESPDeck dokumentace.pdf`.

Historie: [[Deník/2026-11-03]] · [[Deník/2026-11-04]] · [[Deník/2026-11-08]] · [[Deník/2026-11-09]]
