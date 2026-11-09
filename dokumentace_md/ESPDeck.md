---
tags: [moc]
aliases: [Domů, Index]
aktualizováno: 2026-11-09
---
# ESPDeck – rozcestník

Ovládací panel na **ESP32-S3** (OLED 128×64, 6 dotykových plošek, rotační enkodér) a desktopová aplikace v Rustu (egui). Deck běží i bez PC: ukazuje hodiny, přes Wi-Fi ovládá Bluesound reprák a světla. Když se k němu připojí aplikace, mačkají jeho plošky klávesové zkratky na PC.

> [!info] Kde jsme
> [[Stav projektu]] · poslední záznam: [[Deník/2026-11-09]]

> [!note] Pravidlo vaultu
> Píše se sem jen to, co **opravdu existuje v kódu** nebo bylo ověřeno na HW. Plány patří do [[Otevřené otázky]], ne do popisu systému.

## Mapa vaultu
- **Projekt:** [[Stav projektu]] · [[Otevřené otázky]] · [[Technická rozhodnutí]]
- **HW:** [[HW zapojení]] (s nákresem) · [[Moduly a BOM]] · [[Oživení a diagnostika]]
- **Firmware** (`ESP_C++_kod/test_obrazovky`): [[Přehled firmwaru]] → [[Obrazovky a ovládání]] · [[Dotykové plošky]] · [[Síťové funkce]]
- **Komunikace:** [[Protokol deck–PC]]
- **Aplikace** (`app/espdeck-ui`): [[Přehled aplikace]] → [[Zkratky na ploškách]] · [[Editor UI]]
- **Grafika:** [[Animace a Display Designer]]

## Jak to spolu souvisí
```
[ESP32-S3 deck] --HTTP--> Bluesound (BluOS :11000), světla (:8181)
       |  TCP :4545, JSON řádky, nalezení přes mDNS _espdeck._tcp
       v
[espdeck.exe na PC] --enigo--> stisk klávesové zkratky
```
