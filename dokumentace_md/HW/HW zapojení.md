---
tags: [hw]
status: sestaveno, ověřeno firmwarem
zdroj: ESP_C++_kod/test_obrazovky/src/main.cpp
aktualizováno: 2026-11-09
---
# HW zapojení

Skutečné zapojení prototypu podle firmwaru ([[Přehled firmwaru]]). Původní PDF „První návrh dokumentace HW zapojení“ počítalo s klasickým ESP32 (GPIO 21/22/25/26…) a **neplatí**. Moduly a kusovník: [[Moduly a BOM]] · oživení: [[Oživení a diagnostika]].

## Nákres zapojení
![[zapojeni_hw.svg]]

*Logické zapojení – ukazuje, co je kam připojené, ne fyzickou polohu pinů na desce. Schéma generuje `scripts/hw_diagram.py`.*

## Propojení drát po drátu
3 moduly + 6 plošek, 15 vodičů. Vše na **3,3 V**, žádný převodník úrovní.

| # | Modul | Pin modulu | ESP32-S3 | Funkce |
|---|---|---|---|---|
| 1 | OLED | VCC | 3V3 (μŠup) | napájení, spíná ho GPIO47 |
| 2 | OLED | GND | GND (μŠup) | zem |
| 3 | OLED | SDA | GPIO42 (μŠup) | I²C data |
| 4 | OLED | SCL | GPIO2 (μŠup) | I²C hodiny |
| 5 | Enkodér | 5V | **3V3** | napájení pull-upů a RC filtru |
| 6 | Enkodér | GND | GND | zem |
| 7 | Enkodér | S1 | GPIO15 | kanál A |
| 8 | Enkodér | S2 | GPIO16 | kanál B |
| 9 | Enkodér | Key | GPIO17 | tlačítko (aktivní v LOW) |
| 10 | Ploška P1 | – | GPIO4 | dotyk T4 |
| 11 | Ploška P2 | – | GPIO5 | dotyk T5 |
| 12 | Ploška P3 | – | GPIO6 | dotyk T6 |
| 13 | Ploška P4 | – | GPIO7 | dotyk T7 |
| 14 | Ploška P5 | – | GPIO8 | dotyk T8 |
| 15 | Ploška P6 | – | GPIO1 | dotyk T1 |

OLED je připojený kabelem do konektoru **μŠup** na DevKitu (vodiče 1–4 jsou v kabelu). Napájení konektoru se zapíná `GPIO47 = HIGH` – bez toho displej nesvítí ani neodpovídá na I²C.

> [!warning] Na co si dát pozor
> - Pin „5V“ enkodéru připoj na **3V3**. Pull-upy modulu by jinak daly na vstupy 5 V a ESP32-S3 není 5V tolerantní.
> - Displej napájej jen z μŠup (3,3 V), ne z 5 V – pull-upy 10 kΩ na modulu vedou proti jeho VCC.

## Pravidla pro piny ESP32-S3
| Piny | Proč |
|---|---|
| GPIO 1–14 | jen tyto umí dotyk (T1–T14); GPIO10 na DevKitu není vyvedený, proto P6 → GPIO1 |
| GPIO 0, 3, 45, 46 | strapping piny (start/boot) – nepoužívat pro plošky ani vstupy s pull-upem |
| GPIO 19, 20 | nativní USB (D−/D+) |
| GPIO 43, 44 | UART0 (TX/RX) přes CH9102 – nahrávání a sériová konzole |
| GPIO 26–32 | interní SPI flash |
| GPIO 47 | na LaskaKit DevKitu spíná napájení μŠup |

Na ESP32-S3 hodnota `touchRead()` při dotyku **roste** (na klasickém ESP32 klesá) – viz [[Dotykové plošky]].

## Odchylky od původního návrhu
| Oblast | Původní PDF (ESP32) | Skutečnost (ESP32-S3) |
|---|---|---|
| Deska | IoT ESP-WROOM-32 rev.1, CP2102 | ESP32-S3-DevKit, WROOM-1 N16, CH9102 |
| OLED | GPIO21/22, lišta 2,54 mm, 100 kHz | GPIO42/2 přes μŠup, 400 kHz |
| Enkodér | GPIO25/26/23, interní pull-upy vypnuté | GPIO15/16/17, interní pull-upy zapnuté, S1/S2 obráceně |
| Plošky | GPIO 4, 13, 14, 27, 33, 32 | GPIO 4, 5, 6, 7, 8, 1 |
| Detekce dotyku | pokles pod 80 % klidu | nárůst nad 120 % klidu |

← [[ESPDeck]]
