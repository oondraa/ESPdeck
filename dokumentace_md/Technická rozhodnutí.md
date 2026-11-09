---
tags: [projekt, rozhodnutí]
aktualizováno: 2026-11-09
---
# Technická rozhodnutí

Co se v projektu **skutečně používá**. Původní teoretický návrh ze 3. 11. (firmware v Rustu, Noise šifrování, párování s účtem, postcard/COBS, simulátor) se nerealizoval a byl z vaultu odstraněn.

| Oblast | Použito | Kde |
|---|---|---|
| Deska | LaskaKit ESP32-S3-DevKit (místo klasického ESP32 z PDF) | [[HW zapojení]] |
| Firmware | C++ / Arduino framework, PlatformIO, U8g2, ArduinoJson | [[Přehled firmwaru]] |
| Souběh ve firmwaru | síť a PC spojení ve FreeRTOS úlohách na jádře 0 | [[Přehled firmwaru]] |
| Spojení s PC | Wi-Fi, TCP :4545, JSON po řádcích, mDNS | [[Protokol deck–PC]] |
| Logika PC akcí | jen v aplikaci, deck posílá události | [[Zkratky na ploškách]] |
| Aplikace | Rust + egui/eframe 0.35, enigo, mdns-sd | [[Přehled aplikace]] |
| Horní lišta | převzatá z projektu OZBEAT | [[Editor UI]] |
| Grafika OLED | Display Designer → `assets.h` | [[Animace a Display Designer]] |
| Konfigurace decku | při kompilaci v `secrets.h` (mimo git) | [[Síťové funkce]] |

← [[Stav projektu]]
