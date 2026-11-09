---
tags: [firmware]
cesta: ESP_C++_kod/test_obrazovky
fw_verze: 0.1.0
---
# Přehled firmwaru

Testovací firmware v **C++ / Arduino** přes **PlatformIO** (`espressif32`). Verze ohlašovaná aplikaci: `0.1.0` (`pc.cpp`).

## Build
```
cd ESP_C++_kod/test_obrazovky
cp src/secrets.example.h src/secrets.h   # vyplnit Wi-Fi a adresy
pio run -t upload        # env s3 (výchozí)
pio device monitor       # 115200 Bd
pio run -e i2cscan -t upload   # jen diagnostika pinů OLED
```
Knihovny: `olikraus/U8g2` (displej), `bblanchon/ArduinoJson` (protokol s PC).

## Soubory
| Soubor | Co dělá |
|---|---|
| `main.cpp` | piny, obrazovky, enkodér, plošky, overlaye, smyčka – [[Obrazovky a ovládání]], [[Dotykové plošky]] |
| `net.cpp/.h` | Wi-Fi, NTP, Bluesound, světla – [[Síťové funkce]] |
| `pc.cpp/.h` | TCP server + mDNS pro aplikaci – [[Protokol deck–PC]] |
| `assets.h` | bitmapy (velké číslice, ikony, malé písmo) vygenerované z Display Designeru – [[Animace a Display Designer]] |
| `i2c_scan.cpp` | diagnostika, kompiluje se jen s `-DI2C_PIN_SCAN` |
| `secrets.h` | Wi-Fi SSID/heslo, IP Bluesoundu, URL světel – **není v gitu** (`.gitignore`), vzor `secrets.example.h` |

## Běh
- `setup()`: zapne napájení μŠup → I2C sken do logu → enkodér (přerušení) → `netBegin()` → `pcBegin()` → čas z doby kompilace → po 300 ms kalibrace plošek (až po startu Wi-Fi kvůli šumu) → OLED.
- `loop()`: sériové příkazy, plošky, tlačítko, enkodér, převzetí stavu z Bluesoundu a textu z PC, překreslení (při animaci co 15 ms, jinak co 100 ms nebo při změně).
- Síť (`net`) a PC spojení (`pc`) běží jako **samostatné FreeRTOS úlohy na jádře 0** – UI na HTTP ani TCP nikdy nečeká. Data se předávají přes proměnné chráněné `portMUX`.

## Sériová konzole (115200)
`n`/`p` = enkodér dolů/nahoru · `o` = stisk · `l` = dlouhý stisk · `t` = hodnoty plošek · `c` = znovu kalibrovat plošky · `w` = stav Wi-Fi

## Druhá složka
`ESP_C++_kod/v.0.0.1/v.0.0.1.ino` je zatím prázdný `setup()`/`loop()`.

← [[ESPDeck]] · [[HW zapojení]]
