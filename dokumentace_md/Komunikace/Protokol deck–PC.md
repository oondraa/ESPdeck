---
tags: [komunikace]
zdroj: ESP_C++_kod/test_obrazovky/src/pc.cpp, app/espdeck-ui/src/link.rs
---
# Protokol deck–PC

## Spojení
- Deck je **TCP server na portu 4545** (spustí se po připojení k Wi-Fi).
- Ohlašuje se přes **mDNS** jako služba `_espdeck._tcp`, hostname `espdeck.local`, TXT záznamy `id` (MAC z eFuse, 12 hex znaků) a `fw`.
- Aplikace hledá službu přes mDNS; když nic nenajde, zkusí `espdeck.local:4545`. Pokus o připojení každé 2 s.
- Deck drží **jedno** spojení – nové spojení nahradí staré.
- Žádné šifrování ani ověření – viz [[Otevřené otázky]].

## Formát
Jedna JSON zpráva na řádek, ukončená `\n`. Pole `t` = typ zprávy.

### Deck → PC
| Zpráva | Kdy |
|---|---|
| `{"t":"hello","name":"ESPDeck","id":"…","fw":"0.1.0","pads":6}` | hned po připojení |
| `{"t":"touch","pad":1,"ev":"tap"}` | dotyk plošky (1–6) |
| `{"t":"enc","d":1}` | otočení enkodéru (± cvaky) |
| `{"t":"btn","ev":"press"}` / `"long"` | stisk / dlouhý stisk enkodéru |
| `{"t":"pong"}` | odpověď na ping |

### PC → deck
| Zpráva | Účinek |
|---|---|
| `{"t":"ping"}` | aplikace posílá co 2 s |
| `{"t":"show","text":"KOPIROVAT"}` | text se ukáže v okénku na OLED (max 23 znaků, převede se na velká písmena) |

## Hlídání spojení
- Deck: bez příchozích dat 6 s → odpojí klienta.
- Aplikace: bez příchozích dat 6 s → odpojí a hledá znovu.
- Deck neposílá nic, dokud není aplikace připojená (fronta 32 zpráv po 96 B se při odpojení vyprázdní).

## Kdo co dělá
Deck posílá jen **události**. Co se má na PC stát, ví jen aplikace – [[Zkratky na ploškách]]. Enkodér a tlačítko aplikace zatím jen zapisuje do logu.

← [[Přehled firmwaru]] · [[Přehled aplikace]]
