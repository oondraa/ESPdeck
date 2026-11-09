---
tags: [firmware, ui]
zdroj: ESP_C++_kod/test_obrazovky/src/main.cpp
---
# Obrazovky a ovládání

## Obrazovky
**Hodiny** (výchozí)
- Velké číslice 22×40 px HH:MM, dvojtečka bliká po 500 ms.
- Dole den a datum malým písmem, např. `STREDA | 09.11`.
- Čas: do synchronizace NTP z času kompilace, pak NTP – [[Síťové funkce]].

**Nastavení** – 4 řádky, vybraný je invertovaný:
| Řádek | Zobrazuje | Akce stiskem |
|---|---|---|
| WIFI | název sítě + síla signálu (4 čárky podle RSSI), nebo `ODPOJENO` | – |
| BLUETOOTH | přepínač | přepne – **jen grafika, BT neexistuje** |
| PC | `PRIPOJENO` / `ODPOJENO` podle [[Protokol deck–PC]] | – |
| JAS | posuvník | zapne/vypne úpravu (knoflík bliká), krok 5 %, rozsah 5–100 %, mapováno na kontrast OLED |

Nastavení se neukládá – po restartu jas 70 %, BT vypnuto.

## Enkodér
| Gesto | Na Hodinách | V Nastavení |
|---|---|---|
| otočení | hlasitost Bluesoundu ±1 (okénko s pruhem 1,2 s) | posun kurzoru / změna jasu |
| krátký stisk | Play/Pauza Bluesoundu + animace | akce řádku |
| dlouhý stisk (> 600 ms) | přepne na Nastavení | přepne na Hodiny |

Každé otočení a stisk se zároveň posílá do PC aplikace (pokud je připojená). Dekódování: přerušení na obou kanálech, tabulka stavů, 4 hrany = 1 cvak. Tlačítko má debounce 30 ms.

## Překryvná okénka (overlaye)
- **Hlasitost** – ikona reproduktoru (při 0 přeškrtnutá), pruh, číslo.
- **Play/Pauza** – čtverec naskočí s přestřelem, ikona se plynule přetvaruje ▶ ↔ ❚❚ (interpolace vrcholů), po ~1,1 s zmizí.
- **Dotyk** – `DOTYK n`, nebo `SVETLA ZAP`/`SVETLA VYP` s žárovkou, nebo `BEZ WIFI`, nebo text poslaný z PC (`show`). Drží se po dobu dotyku + 700 ms.

Stav z Bluesoundu (hlasitost, hraje/nehraje) se převezme jen 3 s po poslední vlastní akci, aby hodnota „neskákala zpět“.

← [[Přehled firmwaru]]
