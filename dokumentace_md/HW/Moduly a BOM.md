---
tags: [hw, bom]
aktualizováno: 2026-11-09
---
# Moduly a BOM

Parametry modulů OLED a enkodéru jsou převzaté z původního HW návrhu (údaje prodejce LaskaKit, ceny k 3. 11. 2026). Tyto moduly se ve skutečném zapojení použily beze změny, deska je jiná. Zapojení: [[HW zapojení]].

## Moduly
| Modul | Parametr | Hodnota |
|---|---|---|
| **LaskaKit ESP32-S3-DevKit** | modul | ESP32-S3-WROOM-1 N16 (16 MB flash) |
| | USB-UART | CH9102 |
| | v PlatformIO | `board = esp32-s3-devkitc-1`, `board_upload.flash_size = 16MB` |
| | navíc | konektor μŠup s napájením spínaným GPIO47 |
| **LaskaKit OLED 1,3" I²C** | řadič / rozlišení | SH1106, 128×64, monochromatický |
| | adresa I²C | `0x3C` (výchozí), `0x3D` pájecím můstkem |
| | pull-upy | 10 kΩ na SDA i SCL proti VCC displeje |
| | napájení | 3,3–5 V, max. 100 mA (v projektu 3,3 V z μŠup) |
| | konektory | 2× μŠup (Stemma QT / Qwiic), lišta 4 piny 2,54 mm |
| **Rotační enkodér s tlačítkem a RC filtrem** | rozlišení | 20 pulzů/otáčku, neomezené otáčení |
| | vývody | S1, S2, Key, 5V, GND |
| | napájení | v projektu 3,3 V (pin „5V“ na 3V3) |
| | dekódování | 4 hrany = 1 cvak – ověřeno firmwarem |

## Kusovník
| Ozn. | Ks | Položka | Kód | Cena/ks (Kč s DPH) |
|---|---|---|---|---|
| U1 | 1 | LaskaKit ESP32-S3-DevKit | – | – |
| U2 | 1 | LaskaKit OLED 128×64 1,3" I²C (bílý / modrý) | LA141084W / LA141084B | 168 |
| U3 | 1 | Rotační enkodér s tlačítkem a RC filtrem | LA132020 | 48 |
| – | 1 | kabel μŠup (OLED ↔ DevKit) | – | – |
| E1–E6 | 6 | dotyková ploška | – | – |
| – | 11 | propojovací vodiče (enkodér 5, plošky 6) | – | – |
| – | 1 | datový USB kabel | – | – |

Cena a kód desky S3 a provedení plošek (materiál, průměr, kryt, případný sériový rezistor) zatím nejsou zapsané – viz [[Otevřené otázky]].

← [[HW zapojení]]
